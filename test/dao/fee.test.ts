/* eslint-disable no-unused-expressions */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers"
import { ethers } from "hardhat";
import { E18, ZERO } from "../../scripts/lib/constant";
import { construcAndWait } from "../../scripts/lib/utils";
import { FeeDistributor, FeeManager, MockERC20, MockPoolFactory, SimpleBurner, WBNB } from "../../typechain"
import { BalanceComparator } from "../mock-util/comparator.util";
import { getNowRoughly } from "../mock-util/env.util";
import { shouldThrow } from "../mock-util/expect-plus.util";

describe('Fee', () => {
    let feeManager: FeeManager & Contract;
    let feeDistributor: FeeDistributor & Contract;
    let wnft: MockERC20 & Contract;

    let defaultUser: SignerWithAddress;
    let ownerAdmin: SignerWithAddress,
        parameterAdmin: SignerWithAddress,
        emergencyAdmin: SignerWithAddress;

    let users: SignerWithAddress[]
    
    const COLLECTED_FEE = BigNumber.from(E18);

    beforeEach(async () => {
        users = await ethers.getSigners();
        defaultUser = users[0];

        ownerAdmin = users[1];
        parameterAdmin = users[2];
        emergencyAdmin = users[3];

        feeManager = await construcAndWait('FeeManager',[
            ZERO,
            ownerAdmin.address,
            parameterAdmin.address,
            emergencyAdmin.address
        ]);
        feeDistributor = await construcAndWait('FeeDistributor', [
            ZERO,
            getNowRoughly(),
            ownerAdmin.address,
            emergencyAdmin.address
        ]);
        wnft = await construcAndWait('MockERC20', ['Wrapped NFT', 'WNFT']);
        // deploy and set burner
        const weth = await construcAndWait<WBNB>('WBNB');
        const factory = await construcAndWait<MockPoolFactory>('MockPoolFactory', [weth.address]);
        await factory.deployPool(wnft.address, weth.address);
        const poolAddr = await factory.find_pool_for_coins(wnft.address, weth.address);
        const vaultUser = users[9];
        await vaultUser.sendTransaction({
            to: poolAddr,
            value: E18
        })
        const burner = await construcAndWait<SimpleBurner>('SimpleBurner', [
            ownerAdmin.address,
            emergencyAdmin.address,
            feeDistributor.address,
            weth.address,
            factory.address
        ])
        await feeManager.connect(ownerAdmin).setBurner(wnft.address, burner.address);
        // Simulate fee manager get fee
        await wnft.mint(feeManager.address, COLLECTED_FEE);
    })

    describe('Set fee', () => {
        it('Succeed to set', async () => {
            const WRAP_FEE = 300;
            const UNWRAP_FEE = 400;

            const WNFT_ADDR = ZERO;

            await feeManager.connect(parameterAdmin).setWrapFee(WNFT_ADDR, WRAP_FEE);
            const wrapFee = await feeManager.wrapFee(WNFT_ADDR);
            expect(wrapFee.toNumber()).eq(WRAP_FEE);

            await feeManager.connect(parameterAdmin).setUnwrapFee(WNFT_ADDR, UNWRAP_FEE);
            const unwrapFee = await feeManager.unwrapFee(WNFT_ADDR);
            expect(unwrapFee.toNumber()).eq(UNWRAP_FEE);
        })

        it('Fail to set', async () => {
            const FEE = 100;
            const WNFT_ADDR = ZERO;
            
            expect(defaultUser.address).not.eq(parameterAdmin.address);
            // init value
            await feeManager.setWrapFee(WNFT_ADDR, FEE);
            await shouldThrow(feeManager.setWrapFee(WNFT_ADDR, FEE), '! parameter admin') ;
            // init value
            await feeManager.setUnwrapFee(WNFT_ADDR, FEE);
            await shouldThrow(feeManager.setUnwrapFee(WNFT_ADDR, FEE), '! parameter admin') ;
        })
    })

    describe('Burn', () => {
        it('Succeed to burn', async () => {
            const receiverComparator = new BalanceComparator(feeDistributor.address);
            let feeBalance = await wnft.balanceOf(feeManager.address);
            await receiverComparator.setBeforeBalance(ZERO);
            await feeManager.burn(wnft.address);
            await receiverComparator.setAfterBalance(ZERO);
            expect(receiverComparator.compare(ZERO)).deep.eq(feeBalance);
            feeBalance = await wnft.balanceOf(feeManager.address);
            expect(feeBalance.eq(0)).true;
        })
    })
})