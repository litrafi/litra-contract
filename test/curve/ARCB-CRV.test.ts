import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { Contract, BigNumber } from "ethers";
import { ethers } from "hardhat"
import { E18 } from "../../scripts/lib/constant";
import { deployAndWait } from "../../scripts/lib/utils";
import { ArchebaseCurveToken, MockERC20 } from "../../typechain";
import { BalanceComparator } from "../mock-util/comparator.util";
import { fastForward } from "../mock-util/env.util";
import { mockCurveEnv } from "./curve-util";

describe('ARCB-CRV-Token', () => {
    const LOCK_PERCENT = 5e5;
    const DEPOSIT_AMOUNT = BigNumber.from(E18);
    let self: SignerWithAddress, voter: SignerWithAddress;
    let acToken: ArchebaseCurveToken & Contract;
    let metaToken: MockERC20 & Contract;
    let crv: MockERC20 & Contract;
    let cvx: MockERC20 & Contract;

    beforeEach(async () => {
        const singers = await ethers.getSigners();
        self = singers[0];
        voter = singers[1];

        const {
            booster,
            metaToken: _metaToken,
            crv: _crv,
            cvx: _cvx
        } = await mockCurveEnv();
        crv = _crv;
        cvx = _cvx;
        metaToken = _metaToken;

        const ArchebaseCurveToken = await ethers.getContractFactory('ArchebaseCurveToken');
        acToken = await deployAndWait(ArchebaseCurveToken, [
            voter.address,
            LOCK_PERCENT,
            booster.address,
            0,
            crv.address,
            cvx.address
        ]);

        await metaToken.mint(self.address, DEPOSIT_AMOUNT);
        await metaToken.approve(acToken.address, DEPOSIT_AMOUNT);
    })

    describe('add liquidity', () => {
        it('succeed', async () => {
            // record balance
            const comparator = new BalanceComparator(self.address);
            await comparator.setBeforeBalance(metaToken.address)
            await comparator.setBeforeBalance(acToken.address);
            // add liquidity
            await acToken.deposit(DEPOSIT_AMOUNT)
            // record balance
            await comparator.setAfterBalance(metaToken.address)
            await comparator.setAfterBalance(acToken.address);
            // compara balance
            expect(comparator.compare(metaToken.address)).eq(DEPOSIT_AMOUNT);
            expect(comparator.compare(acToken.address).gt('0'));
        })
    })

    describe('Claim reward', () => {
        it('Succeed: has added liquidity', async () => {
            // add liquidity
            await acToken.deposit(DEPOSIT_AMOUNT)
            // wait for a hour
            await fastForward(3600);
            // record balance
            const comparator = new BalanceComparator(self.address);
            await comparator.setBeforeBalance(crv.address);
            await comparator.setBeforeBalance(cvx.address);
            // get reward
            await acToken.claimReward();
            // record balance
            await comparator.setAfterBalance(crv.address);
            await comparator.setAfterBalance(cvx.address);
            // compare balance
            const crvReward = comparator.compare(crv.address);
            const cvxReward = comparator.compare(cvx.address);
            expect(crvReward.gt('0'));
            expect(cvxReward.gt('0'));
            // confirm lock percent
            const crvLocked = await crv.balanceOf(voter.address);
            const cvxLocked = await cvx.balanceOf(voter.address);
            const rewardPercent = 1e6 - LOCK_PERCENT;
            expect(crvLocked.mul(1e6).div(LOCK_PERCENT)).eq(crvReward.mul(1e6).div(rewardPercent));
            expect(cvxLocked.mul(1e6).div(LOCK_PERCENT)).eq(cvxReward.mul(1e6).div(rewardPercent));
        })

        it('Fail: has no liquidity', async () => {
            // record balance
            const comparator = new BalanceComparator(self.address);
            await comparator.setBeforeBalance(crv.address);
            await comparator.setBeforeBalance(cvx.address);
            // get reward
            await acToken.claimReward();
            // record balance
            await comparator.setAfterBalance(crv.address);
            await comparator.setAfterBalance(cvx.address);
            // compare balance
            expect(comparator.compare(crv.address).eq('0'));
            expect(comparator.compare(cvx.address).eq('0'));
        })
    })

    describe('Withdraw', () => {
        it('Succeed: without reward', async () => {
            // add liquidity
            await acToken.deposit(DEPOSIT_AMOUNT);
            // record balance
            const comparator = new BalanceComparator(self.address);
            await comparator.setBeforeBalance(metaToken.address)
            await comparator.setBeforeBalance(acToken.address);
            // withdraw
            const balance = await acToken.balanceOf(self.address);
            await acToken.withdraw(balance);
            // record balance
            await comparator.setAfterBalance(metaToken.address)
            await comparator.setAfterBalance(acToken.address);
            // compara balance
            expect(comparator.compare(metaToken.address)).gt('0');
            expect(comparator.compare(acToken.address)).eq(balance);
        })

        it('Succeed: with reward', async () => {
            // add liquidity
            await acToken.deposit(DEPOSIT_AMOUNT)
            // wait for a hour
            await fastForward(3600);
            // record balance of reward token
            const comparator = new BalanceComparator(self.address);
            await comparator.setBeforeBalance(crv.address);
            await comparator.setBeforeBalance(cvx.address);
            // withdraw
            const balance = await acToken.balanceOf(self.address);
            await acToken.withdraw(balance);
            // record balance of reward token
            await comparator.setAfterBalance(crv.address);
            await comparator.setAfterBalance(cvx.address);
            // compare balance
            expect(comparator.compare(crv.address).gt('0'));
            expect(comparator.compare(cvx.address).gt('0'));
        })
    })
})