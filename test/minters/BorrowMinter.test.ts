import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { BorrowMinter, NFTVaultV2 } from "../../typechain-types";
import { Iterator, getEventSpecifiedArg } from "../utils/helper.util";
import { loadFixture, time } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe('BorrowMinter', () => {
    const deployed = async () => {
        const LTV = ethers.parseUnits('0.75', 5);
        const LIQUIDATION_FEE = ethers.parseUnits('0.05', 5);

        const signers = new Iterator(await ethers.getSigners());
        const deployer = signers.next();
        const feeReceiver = signers.next();

        const NFTVaultV2 = await ethers.getContractFactory('NFTVaultV2');
        const BorrowMinter = await ethers.getContractFactory('BorrowMinter');
        const MockBorrowRateModel = await ethers.getContractFactory('MockBorrowRateModel');
        const NFT = await ethers.getContractFactory('MockNFT');

        const nftVaultV2 = <NFTVaultV2><unknown>await upgrades.deployProxy(NFTVaultV2);

        const rateModel = await MockBorrowRateModel.deploy();
        const borrowMinter = <BorrowMinter><unknown>await upgrades.deployProxy(
            BorrowMinter,
            [
                await nftVaultV2.getAddress(),
                await rateModel.getAddress(),
                feeReceiver.address,
                LTV,
                LIQUIDATION_FEE
            ]
        )
        const nft = await NFT.deploy('', '');

        await nftVaultV2.setMinter(borrowMinter, true);

        return {
            signers,
            deployer,
            feeReceiver,
            rateModel,
            borrowMinter,
            nftVaultV2,
            nft,
            LTV,
            LIQUIDATION_FEE
        }
    }

    const borrowed = async () => {
        const args = await deployed();
        const {
            signers,
            borrowMinter,
            nft
        } = args;

        const user = signers.next();

        const BORROW_AMOUNT = ethers.parseUnits('1', 18);
        const TOKEN_IDS = [0, 1];

        for (const tokenId of TOKEN_IDS) {
            await nft.mint(user, tokenId);
            await nft.connect(user).approve(borrowMinter, tokenId);
        }

        const res = await borrowMinter.connect(user).createWNFTAndOpenPosition(
            nft,
            '',
            '',
            TOKEN_IDS,
            BORROW_AMOUNT
        );
        const positionId = await getEventSpecifiedArg(
            borrowMinter,
            res,
            'OpenPosition',
            'positionId'
        )
        const pos = await borrowMinter.positionInfo(positionId);
        return {
            ...args,
            BORROW_AMOUNT,
            TOKEN_IDS,
            user,
            pos,
            positionId,
        };
    }

    it('borrow', async () => {
        const {
            BORROW_AMOUNT,
            user,
            nft,
            pos
        } = await loadFixture(borrowed);
        expect(pos.owner).eq(user.address);
        expect(pos.nftAddr).eq(await nft.getAddress());
        expect(pos.tokenIds).deep.eq([0n, 1n]);
        expect(pos.debtTokens).eq(BORROW_AMOUNT);
        expect(pos.borrowed).eq(BORROW_AMOUNT);
        expect(pos.paid).eq(0);
    })

    it('increase position', async () => {
        const {
            BORROW_AMOUNT,
            user,
            nft,
            borrowMinter,
            positionId
        } = await loadFixture(borrowed);

        const passBy = 3600 * 24;
        await time.increase(passBy);

        let increaseAmount = ethers.parseUnits('1', 18);
        await expect(
            borrowMinter.connect(user).increasePosition(positionId, increaseAmount)
        ).revertedWith('Position is not healthy');

        increaseAmount = ethers.parseUnits('0.2', 18);
        await borrowMinter.connect(user).increasePosition(positionId, increaseAmount)

        const pos = await borrowMinter.positionInfo(positionId);
        const borrowedAmount = BORROW_AMOUNT + increaseAmount;
        expect(pos.borrowed).eq(ethers.parseUnits('1.2', 18));
        expect(pos.debtTokens).gt(BORROW_AMOUNT);
        expect(pos.debtTokens).lt(borrowedAmount)
        const debtAmount = await borrowMinter.debtTokensToAmount(nft, pos.debtTokens)
        expect(debtAmount).gt(borrowedAmount);
        expect(pos.borrowed).deep.eq(borrowedAmount);
    })

    it('decrease position', async () => {
        const {
            BORROW_AMOUNT,
            user,
            nft,
            nftVaultV2,
            borrowMinter,
            positionId
        } = await loadFixture(borrowed);

        const passBy = 3600 * 24;
        await time.increase(passBy);

        const decreaseDebtToken = BORROW_AMOUNT / 2n;
        const wnftAddr = await nftVaultV2.nftToWNFT(nft);
        const wnft = await ethers.getContractAt('WrappedNFT', wnftAddr);
        await wnft.connect(user).approve(borrowMinter, ethers.MaxUint256);
        // decrease position
        const tx = await borrowMinter.connect(user).decreasePosition(positionId, decreaseDebtToken);
        const amount = await getEventSpecifiedArg(wnft, tx, 'Transfer', 'value');
        expect(amount).gt(decreaseDebtToken);
        // check position
        const pos = await borrowMinter.positionInfo(positionId);
        expect(pos.paid).eq(amount);
        expect(pos.debtTokens).eq(BORROW_AMOUNT - decreaseDebtToken);
    })

    it('close position', async () => {
        const {
            TOKEN_IDS,
            user,
            nft,
            nftVaultV2,
            borrowMinter,
            pos,
            positionId
        } = await loadFixture(borrowed);

        const passBy = 3600 * 24;
        await time.increase(passBy);

        const wnftAddr = await nftVaultV2.nftToWNFT(nft);
        const wnft = await ethers.getContractAt('WrappedNFT', wnftAddr);
        await wnft.connect(user).approve(borrowMinter, ethers.MaxUint256);
        // close position
        await expect(borrowMinter.connect(user).closePosition(positionId)).revertedWith('Unpaid debt');

        const wrappedNFTTokenId = 2;
        await nft.mint(user, wrappedNFTTokenId);
        await nft.connect(user).approve(nftVaultV2, wrappedNFTTokenId);
        await nftVaultV2.connect(user).wrap(nft, wrappedNFTTokenId);
        await borrowMinter.connect(user).decreasePosition(positionId, pos.debtTokens);
        await borrowMinter.connect(user).closePosition(positionId);
        await expect(nft.ownerOf(TOKEN_IDS[0])).eventually.eq(user.address);
        await expect(nft.ownerOf(TOKEN_IDS[1])).eventually.eq(user.address);
        // position deleted
        await expect(borrowMinter.positionInfo(positionId).then(res => res.nftAddr)).eventually.eq(ethers.ZeroAddress);
    })

    it('liquidate', async () => {
        const args = await deployed();
        const {
            signers,
            borrowMinter,
            nft,
            nftVaultV2,
            rateModel,
            LTV,
            LIQUIDATION_FEE
        } = args;

        const user = signers.next();
        // create full position
        const BORROW_AMOUNT = ethers.parseUnits('2', 18) * LTV / ethers.parseUnits('1', 5);
        const TOKEN_IDS = [0, 1];

        for (const tokenId of TOKEN_IDS) {
            await nft.mint(user, tokenId);
            await nft.connect(user).approve(borrowMinter, tokenId);
        }
        const res = await borrowMinter.connect(user).createWNFTAndOpenPosition(
            nft,
            '',
            '',
            TOKEN_IDS,
            BORROW_AMOUNT
        );
        const createPosititonTime = await res.getBlock().then(block => block?.timestamp);
        const positionId = await getEventSpecifiedArg(
            borrowMinter,
            res,
            'OpenPosition',
            'positionId'
        )
        const pos = await borrowMinter.positionInfo(positionId);
        // time pass
        const passBy = 3600 * 24;
        await time.increase(passBy);
        const { isHealthy } = await borrowMinter.positionInfoWrite.staticCall(positionId);
        expect(isHealthy).be.false;
        // liquidate
        const liquidator = signers.next();
        const liquidateFee = ethers.parseUnits(TOKEN_IDS.length.toString()) * LIQUIDATION_FEE / ethers.parseUnits('1', 5);
        const wnftAddr = await nftVaultV2.nftToWNFT(nft);
        const wnft = await ethers.getContractAt('WrappedNFT', wnftAddr);
        const liquidationTime = await borrowMinter.connect(liquidator).liquidatePositon(positionId)
            .then(r => r.wait())
            .then(receipt => receipt?.getBlock())
            .then(block => block?.timestamp);
        await expect(wnft.balanceOf(liquidator)).eventually.eq(liquidateFee);
        const backAmount = await wnft.balanceOf(user).then(r => r - BORROW_AMOUNT);
        const interestRate = await rateModel.borrowRate(pos.nftAddr);
        const interest = BigInt(BORROW_AMOUNT) * interestRate * BigInt(<number>liquidationTime - <number>createPosititonTime) / ethers.parseUnits('1');
        expect(backAmount)
            .gt(0)
            .eq(ethers.parseUnits(TOKEN_IDS.length.toString()) - BORROW_AMOUNT - liquidateFee - interest);
    })
})