import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { OrderBookDeployer } from "../../scripts/deployer/order/order-book.deployer";
import { NftVaultDeployer } from "../../scripts/deployer/tokenize/nft-vault.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { TokenizeSynchroniser } from "../../scripts/synchroniser/tokenize.synchroniser";
import { Ntoken, OrderBook } from "../../typechain";
import { BalanceComparator } from "../mock-util/comparator.util";
import { deployMockNtoken, mockEnvForTokenizeModule } from "../mock-util/deploy.util";
import { clear } from "../mock-util/env.util"

describe('Order', () => {
    let seller: SignerWithAddress;
    let buyer: SignerWithAddress;

    let orderBookContract: OrderBook & Contract;
    let tnftContract: Ntoken & Contract;
    
    beforeEach(async () => {
        clear();

        const users = await ethers.getSigners();
        seller = users[0];
        buyer = users[1];

        await mockEnvForTokenizeModule();
        await new TokenizeSynchroniser().sychornise();

        orderBookContract = await new OrderBookDeployer().getInstance();
        const vault = await new NftVaultDeployer().getInstance();
        tnftContract = await deployMockNtoken(vault);
    })

    it('Place order', async () => {
        const SELL_AMOUNT = BigNumber.from(E18).mul(2);
        const PRICE = BigNumber.from(E18);

        const comparator = new BalanceComparator(seller.address);
        await comparator.setBeforeBalance(tnftContract.address);

        await tnftContract.approve(orderBookContract.address, SELL_AMOUNT);
        await orderBookContract.placeOrder(
            tnftContract.address,
            SELL_AMOUNT,
            ZERO,
            PRICE
        )

        await comparator.setAfterBalance(tnftContract.address);
        const diff = comparator.compare(tnftContract.address);
        expect(diff.toString()).eq(SELL_AMOUNT.toString());
    })

    it('Buy order', async () => {
        const SELL_AMOUNT = BigNumber.from(E18).mul(2);
        const PRICE = BigNumber.from(E18);
        // place order
        await tnftContract.approve(orderBookContract.address, SELL_AMOUNT);
        await orderBookContract.placeOrder(
            tnftContract.address,
            SELL_AMOUNT,
            ZERO,
            PRICE
        );
        // buy order
        const comparator = new BalanceComparator(buyer.address);
        await comparator.setBeforeBalance(tnftContract.address);

        // try buy without enough offer
        const err = await orderBookContract
            .connect(buyer)
            .buyOrder(0, { value: PRICE.div(2) })
            .catch(() => "err");
        expect(err).eq("err");
        // buy with enough offer
        await orderBookContract
            .connect(buyer)
            .buyOrder(0, { value: PRICE });

        await comparator.setAfterBalance(tnftContract.address);
        const diff = comparator.compare(tnftContract.address);
        expect(diff).eq(SELL_AMOUNT);
    })
})