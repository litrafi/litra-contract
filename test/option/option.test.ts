import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { OptionBookDeployer } from "../../scripts/deployer/option/option-book.deployer";
import { NftVaultDeployer } from "../../scripts/deployer/tokenize/nft-vault.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { OptionSynchroniser } from "../../scripts/synchroniser/option.synchroniser";
import { TokenizeSynchroniser } from "../../scripts/synchroniser/tokenize.synchroniser";
import { Ntoken, OptionBook } from "../../typechain";
import { BalanceComparator } from "../mock-util/comparator.util";
import { deployMockNtoken, mockEnvForTokenizeModule } from "../mock-util/deploy.util";
import { clear, fastForward } from "../mock-util/env.util";

enum OptionExpiration {
    ONE_WEEK,
    TOW_WEEKS,
    ONE_MONTH
}

enum OptionStatus {
    UNFILLED,
    PURCHASED,
    CLOSED
}

describe('Option', () => {
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

    let optionBookContract: OptionBook & Contract;
    let tnftContract: Ntoken & Contract;

    beforeEach(async () => {
        clear();

        const users = await ethers.getSigners();
        seller = users[0];
        buyer = users[1];

        await mockEnvForTokenizeModule();
        await new TokenizeSynchroniser().sychornise();
        await new OptionSynchroniser().sychornise();

        optionBookContract = await new OptionBookDeployer().getInstance();
        const vault = await new NftVaultDeployer().getInstance();
        tnftContract = await deployMockNtoken(vault);
    })

    it('Create & Purchase & Execute', async () => {
        const STRIKE_AMOUNT = BigNumber.from(E18).mul(2);
        const STRIKE_PRICE = 2;
        const PREMIUM_AMOUNT = BigNumber.from(E18);
        const EXPIRATION = OptionExpiration.ONE_WEEK;
        const EXPIRATION_SECONDS = 7 * 24 * 3600; 

        const buyerComparator = new BalanceComparator(buyer.address);
        const sellerComparator = new BalanceComparator(seller.address);
        // create
        await tnftContract.approve(optionBookContract.address, STRIKE_AMOUNT);
        const multiplier = await optionBookContract.STRIKE_PRICE_MULTIPLIER();
        await optionBookContract.createOption(
            tnftContract.address,
            ZERO,
            STRIKE_AMOUNT,
            multiplier.mul(STRIKE_PRICE),
            PREMIUM_AMOUNT,
            EXPIRATION
        )
        let option = await optionBookContract.options(0);
        // buy option
        // try without enough premium
        await sellerComparator.setBeforeBalance(ZERO);
        let err = await optionBookContract
            .connect(buyer)
            .purchaseOption(option.optionId, { value: PREMIUM_AMOUNT.div(2)})
            .catch(err => {
                expect(err.message).includes("Wrong value");
                return "err";
            })
        expect(err).eq("err");
        // purchase with enough offer
        await optionBookContract
            .connect(buyer)
            .purchaseOption(option.optionId, { value: PREMIUM_AMOUNT });
        // check assets
        await sellerComparator.setAfterBalance(ZERO);
        let diff = await sellerComparator.compare(ZERO);
        expect(diff).eq(PREMIUM_AMOUNT);
        sellerComparator.clear();
        // check status
        option = await optionBookContract.options(option.optionId);
        expect(option.buyer).eq(buyer.address);
        expect(option.status).eq(OptionStatus.PURCHASED);

        // execute option
        const payment = STRIKE_AMOUNT.mul(STRIKE_PRICE);
        await buyerComparator.setBeforeBalance(tnftContract.address);
        await sellerComparator.setBeforeBalance(ZERO);
        // try to execute before expiration
        err = await optionBookContract
            .connect(buyer)
            .executeOption(option.optionId, { value: payment })
            .catch(err => {
                expect(err.message).includes(`Can't execute now`);
                return "err";
            });
        expect(err).eq("err");
        // move time
        await fastForward(EXPIRATION_SECONDS);
        // try to execute without insufficient offer
        err = await optionBookContract
            .connect(buyer)
            .executeOption(option.optionId, { value: payment.div(2) })
            .catch(err => {
                expect(err.message).includes(`Wrong value`);
                return "err";
            });
        // try to execute by wrong user
        err = await optionBookContract
            .executeOption(option.optionId, { value: payment })
            .catch(err => {
                expect(err.message).includes(`Forbidden`);
                return "err";
            });
        // execute
        await optionBookContract
            .connect(buyer)
            .executeOption(option.optionId, { value: payment })
        // check assets
        await buyerComparator.setAfterBalance(tnftContract.address);
        await sellerComparator.setAfterBalance(ZERO);
        diff = buyerComparator.compare(tnftContract.address);
        expect(diff).eq(STRIKE_AMOUNT);
        const diffReadable = await sellerComparator.readableCompare(ZERO);
        const pamentReadable = await BalanceComparator.getReadableAmount(ZERO, payment);
        expect(diffReadable).closeTo(pamentReadable, pamentReadable / 1e4)
    })

    it('Cancel option by seller', async () => {
        const STRIKE_AMOUNT = BigNumber.from(E18).mul(2);
        const STRIKE_PRICE = 2;
        const PREMIUM_AMOUNT = BigNumber.from(E18);
        const EXPIRATION = OptionExpiration.ONE_WEEK;
        // create option
        await tnftContract.approve(optionBookContract.address, STRIKE_AMOUNT);
        const multiplier = await optionBookContract.STRIKE_PRICE_MULTIPLIER();
        await optionBookContract.createOption(
            tnftContract.address,
            ZERO,
            STRIKE_AMOUNT,
            multiplier.mul(STRIKE_PRICE),
            PREMIUM_AMOUNT,
            EXPIRATION
        )
        // cancel option
        const comparator = new BalanceComparator(seller.address);
        await comparator.setBeforeBalance(tnftContract.address);
        
        await optionBookContract.sellerCancelOption(0);

        await comparator.setAfterBalance(tnftContract.address);
        const diff = comparator.compare(tnftContract.address);
        expect(diff).eq(STRIKE_AMOUNT);

        const option = await optionBookContract.options(0);
        expect(option.status).eq(OptionStatus.CLOSED);
    })

    it('Cancel option by buyer', async () => {
        const STRIKE_AMOUNT = BigNumber.from(E18).mul(2);
        const STRIKE_PRICE = 2;
        const PREMIUM_AMOUNT = BigNumber.from(E18);
        const EXPIRATION = OptionExpiration.ONE_WEEK;
        // create option
        await tnftContract.approve(optionBookContract.address, STRIKE_AMOUNT);
        const multiplier = await optionBookContract.STRIKE_PRICE_MULTIPLIER();
        await optionBookContract.createOption(
            tnftContract.address,
            ZERO,
            STRIKE_AMOUNT,
            multiplier.mul(STRIKE_PRICE),
            PREMIUM_AMOUNT,
            EXPIRATION
        )
        // purchase option
        await optionBookContract
            .connect(buyer)
            .purchaseOption(0, { value: PREMIUM_AMOUNT });
        // cancel option
        // try cacnle by wrong user
        const err = await optionBookContract
            .connect(seller)
            .buyerCancelOption(0)
            .catch(err => {
                expect(err.message).includes("Forbidden");
                return "err"
            });
        expect(err).eq("err");
        // cancel option
        await optionBookContract.connect(buyer).buyerCancelOption(0);
    })

    it('Peronal', async () => {
        const STRIKE_AMOUNT = BigNumber.from(E18).mul(2);
        const STRIKE_PRICE = 2;
        const PREMIUM_AMOUNT = BigNumber.from(E18);
        const EXPIRATION = OptionExpiration.ONE_WEEK;
        // create option
        await tnftContract.approve(optionBookContract.address, STRIKE_AMOUNT);
        const multiplier = await optionBookContract.STRIKE_PRICE_MULTIPLIER();
        await optionBookContract.createOption(
            tnftContract.address,
            ZERO,
            STRIKE_AMOUNT,
            multiplier.mul(STRIKE_PRICE),
            PREMIUM_AMOUNT,
            EXPIRATION
        )
    })
})