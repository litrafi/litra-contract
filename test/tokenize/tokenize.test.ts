import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { UniswapFactoryDeployer } from "../../scripts/deployer/amm/factory.deployer";
import { UniswapRouterDeployer } from "../../scripts/deployer/amm/router.deployer";
import { NtokenPricerDeployer } from "../../scripts/deployer/ntoken-pricer.deployer";
import { OrderBookDeployer } from "../../scripts/deployer/order/order-book.deployer";
import { NftVaultDeployer } from "../../scripts/deployer/tokenize/nft-vault.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { construcAndWait, getContractAt } from "../../scripts/lib/utils";
import { getNetworkConfig } from "../../scripts/network-config";
import { TokenizeSynchroniser } from "../../scripts/synchroniser/tokenize.synchroniser"
import { MockERC20, Nft, NftVault, Ntoken, NtokenPricer, OrderBook, UniswapV2Factory, UniswapV2Router02, WBNB } from "../../typechain";
import { MockERC1155 } from "../../typechain/MockERC1155";
import { BalanceComparator } from "../mock-util/comparator.util";
import { deployMockNft, mockEnvForTokenizeModule } from "../mock-util/deploy.util";
import { clear, currentTime } from "../mock-util/env.util";
import { expectCloseTo } from "../mock-util/expect-plus.util";

describe("Tokenize", () => {
    let nftVaultContract: NftVault & Contract;
    let nftContract: Nft & Contract;
    let factoryContract: UniswapV2Factory & Contract;
    let routerContract: UniswapV2Router02 & Contract;
    let orderBookContract: OrderBook & Contract;
    let pricerContract: NtokenPricer & Contract;
    let weth: WBNB & Contract;
    let usdt: MockERC20 & Contract;

    let creator: SignerWithAddress;
    let buyer: SignerWithAddress;

    let tokenId: number;
    beforeEach(async () => {
        clear();

        const users = await ethers.getSigners();
        creator = users[0];
        buyer = users[1]

        await mockEnvForTokenizeModule();
        const networkConfig = getNetworkConfig();

        const synchroniser = new TokenizeSynchroniser();
        await synchroniser.sychornise();

        weth = await getContractAt<WBNB>('WBNB', networkConfig.weth);
        usdt = await getContractAt<MockERC20>('MockERC20', networkConfig.tokensInfo.USDT.address);
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
        const priceFromAmm = await pricerContract.getPriceFromAmm(tnft.address, weth.address);
        expect(priceFromAmm).eq(BigNumber.from('1000000000000000000'));
        // Make an order transaction
        const SELL_AMOUNT = BigNumber.from(E18).mul(2);
        const PRICE = BigNumber.from(E18);
        await tnft.approve(orderBookContract.address, SELL_AMOUNT);
        await orderBookContract.placeOrder(
            tnft.address,
            SELL_AMOUNT,
            usdt.address,
            PRICE,
        );
        await usdt.mint(buyer.address, PRICE);
        await usdt.connect(buyer).approve(orderBookContract.address, PRICE);
        await orderBookContract
            .connect(buyer)
            .buyOrder(0);
        // Get price from order book
        const priceFromOrder = await orderBookContract.getTnftPrice(tnft.address, usdt.address);
        expect(priceFromOrder).eq(BigNumber.from(E18).div(2));
        // Get price from pricer
        const { pricingToken, amount, maxValuation: price } = await pricerContract.getTnftPrice(tnft.address);
        expect(pricingToken).eq(ZERO);
        expect(amount).eq(priceFromAmm);
        // Redemm
        let tnfnBalance = await tnft.balanceOf(creator.address);
        const totalSupply = await tnft.totalSupply();
        const redeemValue = totalSupply.sub(tnfnBalance).mul(price).div(E18);
        await tnft.approve(nftVaultContract.address, tnfnBalance);
        await usdt.mint(creator.address, redeemValue);
        await usdt.approve(nftVaultContract.address, redeemValue);
        await nftVaultContract.redeem(tnft.address, tnfnBalance);
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
        await comparator.setBeforeBalance(usdt.address);
        await nftVaultContract
            .connect(buyer)
            .collectNtokens(tnft.address, SELL_AMOUNT);
        await comparator.setAfterBalance(tnft.address);
        await comparator.setAfterBalance(usdt.address);
        let diff = await comparator.compare(tnft.address);
        expect(diff).eq(SELL_AMOUNT);;
        diff = await comparator.compare(usdt.address);
        expectCloseTo(diff, SELL_AMOUNT.mul(price).div(E18), 3);
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
            ZERO,
            PRICE
        );
        await orderBookContract
            .connect(buyer)
            .buyOrder(0, { value: PRICE });
        // check collection value
        const wethValue = await pricerContract.getValuation(ZERO, SUPPLY.sub(SELL_AMOUNT).mul(PRICE).div(SELL_AMOUNT));
        const collectionValue = await nftVaultContract.getUserCollectionValue(creator.address);
        expect(collectionValue).eq(wethValue);
    })

    it('Deposit & Redeem ERC1155', async () => {
        const erc1155Nft = await construcAndWait<MockERC1155>('MockERC1155', ['']);
        // tokenize
        const SUPPLY = BigNumber.from(E18).mul(1e5);
        const REDEEM_RATIO = SUPPLY.mul(60).div(100);
        const TOKEN_ID = 0;
        const TOKEN_NAME = 'MockNft';
        const DESCRIPTION = 'description of MockNft';
        const TNFT_NAME = 'MockTNFT'
        await erc1155Nft.mint(creator.address, 0, 1, [0]);
        await erc1155Nft.setApprovalForAll(nftVaultContract.address, true);
        await nftVaultContract.deposit(
            erc1155Nft.address,
            TOKEN_ID,
            TOKEN_NAME,
            DESCRIPTION,
            TNFT_NAME,
            SUPPLY,
            REDEEM_RATIO
        )
        const nft = await nftVaultContract.nftInfo(1);
        let balance = await erc1155Nft.balanceOf(creator.address, 0);
        expect(balance).eq(BigNumber.from(0));
        // redeem
        const tnft = await getContractAt<Ntoken>('Ntoken', nft.ntokenAddress);
        await tnft.approve(nftVaultContract.address, SUPPLY);
        await nftVaultContract.redeem(nft.ntokenAddress, SUPPLY);
        balance = await erc1155Nft.balanceOf(creator.address, 0);
        expect(balance).eq(BigNumber.from(1));
    })
})