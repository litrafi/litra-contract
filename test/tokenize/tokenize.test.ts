import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { writeTestDeployConfig } from "../../scripts/deploy-config";
import { UniswapFactoryDeployer } from "../../scripts/deployer/amm/factory.deployer";
import { UniswapRouterDeployer } from "../../scripts/deployer/amm/router.deployer";
import { NtokenPricerDeployer } from "../../scripts/deployer/ntoken-pricer.deployer";
import { OrderBookDeployer } from "../../scripts/deployer/order/order-book.deployer";
import { NftVaultDeployer } from "../../scripts/deployer/tokenize/nft-vault.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { getContractAt } from "../../scripts/lib/utils";
import { setTestNetworkConfig } from "../../scripts/network-config";
import { TokenizeSynchroniser } from "../../scripts/synchroniser/tokenize.synchroniser"
import { Nft, NftVault, Ntoken, NtokenPricer, OrderBook, UniswapV2Factory, UniswapV2Router02, WBNB } from "../../typechain";
import { BalanceComparator } from "../mock-util/comparator.util";
import { deployMockNft, deployMockWETH } from "../mock-util/deploy.util";
import { clear, currentTime } from "../mock-util/env.util";
import { expectCloseTo, shouldThrow } from "../mock-util/expect-plus.util";

enum NftStatus{
    TRADING,
    REDEEMED,
    END
}

describe("Tokenize", () => {
    let nftVaultContract: NftVault & Contract;
    let nftContract: Nft & Contract;
    let factoryContract: UniswapV2Factory & Contract;
    let routerContract: UniswapV2Router02 & Contract;
    let orderBookContract: OrderBook & Contract;
    let pricerContract: NtokenPricer & Contract;
    let weth: WBNB & Contract;

    let creator: SignerWithAddress;
    let buyer: SignerWithAddress;

    let tokenId: number;
    beforeEach(async () => {
        clear();

        const users = await ethers.getSigners();
        creator = users[0];
        buyer = users[1]
        const feeTo = users[2];

        weth = await deployMockWETH();
        setTestNetworkConfig({ weth: weth.address });
        writeTestDeployConfig({ feeTo: feeTo.address });

        const synchroniser = new TokenizeSynchroniser();
        await synchroniser.sychornise();

        nftVaultContract = await new NftVaultDeployer().getInstance();
        factoryContract = await new UniswapFactoryDeployer().getInstance();
        routerContract = await new UniswapRouterDeployer().getInstance();
        orderBookContract = await new OrderBookDeployer().getInstance();
        pricerContract = await new NtokenPricerDeployer().getInstance();
        nftContract = await deployMockNft(creator.address);
        tokenId = 0;
    })

    it('deposit', async () => {
        const SUPPLY = BigNumber.from(E18).mul(1e5);
        const REDEEM_RATIO = SUPPLY.mul(60).div(100);
        const TOKEN_ID = 0;
        const TOKEN_NAME = 'MockNft';
        const DESCRIPTION = 'description of MockNft';
        const TNFT_NAME = 'MockTNFT'
        // deposit
        await nftContract.approve(nftVaultContract.address, 0);
        await nftVaultContract.deposit(
            nftContract.address,
            TOKEN_ID,
            TOKEN_NAME,
            DESCRIPTION,
            TNFT_NAME,
            SUPPLY,
            REDEEM_RATIO
        )
        // check status
        const nftLength = await nftVaultContract.nftInfoLength();
        const index = nftLength.toNumber() - 1;
        const nftInfo = await nftVaultContract.nftInfo(index);
        expect(nftInfo.owner).eq(creator.address);
        expect(nftInfo.nftAddress).eq(nftContract.address);
        expect(nftInfo.tokenId.toNumber()).eq(0);
        expect(nftInfo.name).eq(TOKEN_NAME);
        expect(nftInfo.description).eq(DESCRIPTION);
        expect(nftInfo.supply.toString()).eq(SUPPLY.toString());
        expect(nftInfo.redeemRatio.toString()).eq(REDEEM_RATIO.toString());
        expect(nftInfo.redeemAmount.toNumber()).eq(0);
        expect(nftInfo.redeemPrice.toNumber()).eq(0);
        expect(nftInfo.status).eq(0);
        
        const pid = await nftVaultContract.pidFromNtoken(nftInfo.ntokenAddress);
        expect(pid.toNumber()).eq(1);

        const depositList = await nftVaultContract.getDepositedNftList(creator.address);
        expect(depositList).deep.eq([BigNumber.from(1)])
    })

    it('Redeem', async () => {
        // tokenize
        const SUPPLY = BigNumber.from(E18).mul(1e5);
        const REDEEM_RATIO = SUPPLY.mul(60).div(100);
        const TOKEN_ID = 0;
        const TOKEN_NAME = 'MockNft';
        const DESCRIPTION = 'description of MockNft';
        const TNFT_NAME = 'MockTNFT'
        await nftContract.approve(nftVaultContract.address, 0);
        await nftVaultContract.deposit(
            nftContract.address,
            TOKEN_ID,
            TOKEN_NAME,
            DESCRIPTION,
            TNFT_NAME,
            SUPPLY,
            REDEEM_RATIO
        )
        const nftInfo = await nftVaultContract.nftInfo(1);
        const tnft = await getContractAt<Ntoken>('Ntoken', nftInfo.ntokenAddress);
        // create pair
        await factoryContract.createPair(tnft.address, weth.address);
        // add liquidity
        const TNFT_AMOUNT = BigNumber.from(E18).mul(2);
        const WETH_AMOUNT = BigNumber.from(E18).mul(2);
        await weth.deposit({ value: WETH_AMOUNT });
        await tnft.approve(routerContract.address, TNFT_AMOUNT);
        await weth.approve(routerContract.address, WETH_AMOUNT);
        const now = await currentTime();
        await routerContract.addLiquidity(
            tnft.address,
            weth.address,
            TNFT_AMOUNT,
            WETH_AMOUNT,
            0, 0,
            creator.address,
            now + 1
        )
        // Get price from amm
        const priceFromAmm = await pricerContract.getPriceFromAmm(tnft.address);
        expect(priceFromAmm).eq(BigNumber.from('665331998665331998'));
        // Make an order transaction
        const SELL_AMOUNT = BigNumber.from(E18).mul(2);
        const PRICE = BigNumber.from(E18);
        await tnft.approve(orderBookContract.address, SELL_AMOUNT);
        await orderBookContract.placeOrder(
            tnft.address,
            SELL_AMOUNT,
            PRICE
        );
        await orderBookContract
            .connect(buyer)
            .buyOrder(0, { value: PRICE });
        // Get price from order book
        const priceFromOrder = await orderBookContract.getTnftPrice(tnft.address);
        expect(priceFromOrder).eq(BigNumber.from(E18).div(2));
        // Get price from pricer
        const priceFromPricer = await pricerContract.getTnftPrice(tnft.address);
        expect(priceFromPricer).eq(priceFromAmm);
        // Redemm
        let tnfnBalance = await tnft.balanceOf(creator.address);
        const totalSupply = await tnft.totalSupply();
        const ethAmount = totalSupply.sub(tnfnBalance).mul(priceFromPricer).div(E18);
        await tnft.approve(nftVaultContract.address, tnfnBalance);
        await shouldThrow(
            nftVaultContract.redeem(tnft.address, tnfnBalance),
            "NftVault#redeem: the eth is not enough."
        )
        await nftVaultContract.redeem(tnft.address, tnfnBalance, { value: ethAmount });
        const nftOwner = await nftContract.ownerOf(tokenId);
        expect(nftOwner).eq(creator.address);
        tnfnBalance = await tnft.balanceOf(creator.address);
        expect(tnfnBalance).eq(BigNumber.from(0));
        // collect rest of tnfts
        await tnft
            .connect(buyer)
            .approve(nftVaultContract.address, SELL_AMOUNT);
        const comparator = new BalanceComparator(buyer.address);
        await comparator.setBeforeBalance(tnft.address);
        await comparator.setBeforeBalance(ZERO);
        await nftVaultContract
            .connect(buyer)
            .collectNtokens(tnft.address, SELL_AMOUNT);
        await comparator.setAfterBalance(tnft.address);
        await comparator.setAfterBalance(ZERO);
        let diff = await comparator.compare(tnft.address);
        expect(diff).eq(SELL_AMOUNT);;
        diff = await comparator.compare(ZERO);
        expectCloseTo(diff, SELL_AMOUNT.mul(priceFromPricer).div(E18), 3);
    })

    it('List', async () => {
        // tokenize
        const SUPPLY = BigNumber.from(E18).mul(1e5);
        const REDEEM_RATIO = SUPPLY.mul(60).div(100);
        const TOKEN_ID = 0;
        const TOKEN_NAME = 'MockNft';
        const DESCRIPTION = 'description of MockNft';
        const TNFT_NAME = 'MockTNFT'
        await nftContract.approve(nftVaultContract.address, 0);
        await nftVaultContract.deposit(
            nftContract.address,
            TOKEN_ID,
            TOKEN_NAME,
            DESCRIPTION,
            TNFT_NAME,
            SUPPLY,
            REDEEM_RATIO
        )
        const nftInfo = await nftVaultContract.nftInfo(1);
        const tnft = await getContractAt<Ntoken>('Ntoken', nftInfo.ntokenAddress);
        // Make an order transaction
        const SELL_AMOUNT = BigNumber.from(E18).mul(2);
        const PRICE = BigNumber.from(E18);
        await tnft.approve(orderBookContract.address, SELL_AMOUNT);
        await orderBookContract.placeOrder(
            tnft.address,
            SELL_AMOUNT,
            PRICE
        );
        await orderBookContract
            .connect(buyer)
            .buyOrder(0, { value: PRICE });
        // estimate valuation
        const price = await pricerContract.getTnftPrice(tnft.address);
        const valuation = price.mul(SUPPLY).div(E18);
        // check list
        let list = await nftVaultContract.getTNFTListByFilter(
            valuation.sub(1),
            valuation.add(1),
            SUPPLY.sub(1),
            SUPPLY.add(1),
            NftStatus.TRADING
        )
        expect(list).deep.eq([BigNumber.from(1)]);
        list = await nftVaultContract.getTNFTListByFilter(
            valuation.sub(2),
            valuation.sub(1),
            SUPPLY.sub(1),
            SUPPLY.add(1),
            NftStatus.TRADING
        )
        expect(list.length).eq(0);
        list = await nftVaultContract.getTNFTListByFilter(
            valuation.sub(1),
            valuation.add(1),
            SUPPLY.sub(2),
            SUPPLY.sub(1),
            NftStatus.TRADING
        )
        expect(list.length).eq(0);
        list = await nftVaultContract.getTNFTListByFilter(
            valuation.sub(1),
            valuation.add(1),
            SUPPLY.sub(1),
            SUPPLY.add(1),
            NftStatus.REDEEMED
        )
        expect(list.length).eq(0);
    })

    it('Personal', async () => {
        // tokenize
        const SUPPLY = BigNumber.from(E18).mul(1e5);
        const REDEEM_RATIO = SUPPLY.mul(60).div(100);
        const TOKEN_ID = 0;
        const TOKEN_NAME = 'MockNft';
        const DESCRIPTION = 'description of MockNft';
        const TNFT_NAME = 'MockTNFT'
        await nftContract.approve(nftVaultContract.address, 0);
        await nftVaultContract.deposit(
            nftContract.address,
            TOKEN_ID,
            TOKEN_NAME,
            DESCRIPTION,
            TNFT_NAME,
            SUPPLY,
            REDEEM_RATIO
        )
        const nftInfo = await nftVaultContract.nftInfo(1);
        const tnft = await getContractAt<Ntoken>('Ntoken', nftInfo.ntokenAddress);
        // Make an order transaction
        const SELL_AMOUNT = BigNumber.from(E18).mul(2);
        const PRICE = BigNumber.from(E18);
        await tnft.approve(orderBookContract.address, SELL_AMOUNT);
        await orderBookContract.placeOrder(
            tnft.address,
            SELL_AMOUNT,
            PRICE
        );
        await orderBookContract
            .connect(buyer)
            .buyOrder(0, { value: PRICE });
        // check collection value
        const collectionValue = await nftVaultContract.getUserCollectionValue(creator.address);
        expect(collectionValue).eq(SUPPLY.sub(SELL_AMOUNT).mul(PRICE).div(SELL_AMOUNT));
    })
})