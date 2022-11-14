import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers"
import { ethers } from "hardhat";
import { E18 } from "../../scripts/lib/constant";
import { construcAndWait } from "../../scripts/lib/utils";
import { ARCB, GaugeController, LiquidityGauge, Minter, MockERC20, VEBoostProxy, VotingEscrow } from "../../typechain"
import { BalanceComparator } from "../mock-util/comparator.util";
import { currentTime, fastForward, fastForwardTo, WEEK, YEAR } from "../mock-util/env.util";
import { expectCloseTo, shouldThrow } from "../mock-util/expect-plus.util";

describe('DAO', () => {
    let arcb: ARCB & Contract;
    let votingEscrow: VotingEscrow & Contract;
    let gaugeController: GaugeController & Contract;
    let minter: Minter & Contract;
    let veBoostProxy: VEBoostProxy & Contract;

    let defaultUser: SignerWithAddress;

    const INITIAL_RATE = '3191241046289407268';
    const LAUNCH_DELY = 86400;

    beforeEach(async () => {
        arcb = await construcAndWait<ARCB>('ARCB');
        votingEscrow = await construcAndWait('VotingEscrow', [arcb.address])
        veBoostProxy = await construcAndWait('VEBoostProxy', [votingEscrow.address])
        gaugeController = await construcAndWait('GaugeController', [arcb.address, votingEscrow.address])
        minter = await construcAndWait('Minter', [arcb.address, gaugeController.address])
        await arcb.setMinter(minter.address)

        const users = await ethers.getSigners();
        defaultUser = users[0];
    })

    describe('ARCB mining', () => {
        it('Start mining', async () => {
            let rate = await arcb.rate();
            expect(rate.eq(0));
            await shouldThrow(arcb.updateMiningParamters(), 'Not time');
            await fastForward(LAUNCH_DELY);
            await arcb.updateMiningParamters();
            rate = await arcb.rate();
            expect(rate.eq(INITIAL_RATE))
        })

        it('Run 2 years', async () => {
            await fastForward(86400);
            let currenRate = BigNumber.from(INITIAL_RATE);
            for (let index = 0; index < 2; index++) {
                await arcb.updateMiningParamters();
                const _rate = await arcb.rate();
                expect(_rate.eq(currenRate));
                
                await fastForward(31536000)
                currenRate = currenRate.mul(E18).div('1252000000000000000');
            }
            await arcb.updateMiningParamters();
        })
    })

    describe('VotingEscrow', () => {
        const ARCB_BALANCE = BigNumber.from(E18).mul(10);
        const MAX_LOCK_TIME = 4 * YEAR;

        beforeEach(async () => {
            await arcb.approve(votingEscrow.address, ARCB_BALANCE); 
        })

        describe('Deposit', () => {
            it('Create Lock', async () => {
                const LOCK_VALUE = ARCB_BALANCE;
                const LOCK_DURATION = YEAR * 3;
                const now = await currentTime();
                const UNLOCK_TIME = LOCK_DURATION + now;
                // deposit
                const comparator = new BalanceComparator(defaultUser.address);
                await comparator.setBeforeBalance(arcb.address);
                await votingEscrow.createLock(ARCB_BALANCE, UNLOCK_TIME);
                await comparator.setAfterBalance(arcb.address);
                expect(comparator.compare(arcb.address).eq(LOCK_VALUE));
                // check balance
                let veBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                expectCloseTo(veBalance, LOCK_VALUE.mul(LOCK_DURATION).div(MAX_LOCK_TIME), 2)
                // Half time passed
                await fastForward(LOCK_DURATION / 2);
                veBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                expectCloseTo(veBalance, LOCK_VALUE.mul(LOCK_DURATION).div(MAX_LOCK_TIME).div(2), 2);
                // Withdraw
                await shouldThrow(votingEscrow.withdraw(), `The lock didn't expire`);
                await fastForward(LOCK_DURATION / 2);
                await comparator.setBeforeBalance(arcb.address);
                await votingEscrow.withdraw();
                await comparator.setAfterBalance(arcb.address);
                expect(comparator.compare(arcb.address).eq(LOCK_VALUE));
            })

            it('Deposit for', async () => {
                const ORIGIN_DEPOSIT_AMOUNT = ARCB_BALANCE.div(2);
                const APPEND_DEPOSIT_AMOUNT = ARCB_BALANCE.div(2);
                const LOCK_DURATION = YEAR * 3;
                const now = await currentTime();
                const UNLOCK_TIME = LOCK_DURATION + now;
                // create Lock
                await votingEscrow.createLock(ORIGIN_DEPOSIT_AMOUNT, UNLOCK_TIME);
                const originBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                // deposit for
                await votingEscrow.depositFor(defaultUser.address, APPEND_DEPOSIT_AMOUNT);
                const appendedBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                expectCloseTo(appendedBalance, originBalance.mul(2), 2)
            })

            it('Increase deposit amount', async () => {
                const ORIGIN_DEPOSIT_AMOUNT = ARCB_BALANCE.div(2);
                const INCREASE_DEPOSIT_AMOUNT = ARCB_BALANCE.div(2);
                const LOCK_DURATION = YEAR * 3;
                const now = await currentTime();
                const UNLOCK_TIME = LOCK_DURATION + now;
                // create Lock
                await votingEscrow.createLock(ORIGIN_DEPOSIT_AMOUNT, UNLOCK_TIME);
                const originBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                // incraese amount
                await votingEscrow.increaseAmount(INCREASE_DEPOSIT_AMOUNT);
                const appendedBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                expectCloseTo(appendedBalance, originBalance.mul(2), 2)
            })

            it('Increase unlock time', async () => {
                const ORIGIN_DEPOSIT_AMOUNT = ARCB_BALANCE;
                const ORIGIN_LOCK_DURATION = YEAR * 2;
                const INCREASE_LOCK_DURATION = ORIGIN_LOCK_DURATION * 2;
                const now = await currentTime();
                const ORIGIN_UNLOCK_TIME = ORIGIN_LOCK_DURATION + now;
                const INCREASED_UNLOCK_TIME = INCREASE_LOCK_DURATION + now;
                // create Lock
                await votingEscrow.createLock(ORIGIN_DEPOSIT_AMOUNT, ORIGIN_UNLOCK_TIME);
                const originBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                // increase unlock time
                await votingEscrow.increaseUnlockTime(INCREASED_UNLOCK_TIME);
                const appendedBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                expectCloseTo(appendedBalance, originBalance.mul(2), 2)
            })
        })
    })

    describe('Gauge', () => {
        const GAUGE_WEIGHTS = [2, 1]

        beforeEach(async () => {
            // start mining
            await fastForward(LAUNCH_DELY);
            await arcb.updateMiningParamters();

            await gaugeController.addType('curve_lp', GAUGE_WEIGHTS[0]);
            await gaugeController.addType('uniswap_lp', GAUGE_WEIGHTS[1]);
        })

        async function callClaimableTokens(gauge: LiquidityGauge, user: SignerWithAddress) {
            const reward = await user.call({
                to: gauge.address,
                data: gauge.interface.encodeFunctionData("claimableTokens", [user.address])
            })
            return BigNumber.from(reward)
        }

        async function deployGauge(admin: string, type: number, weight: number) {
            const lpToken = await construcAndWait<MockERC20>('MockERC20', ['lp', 'LP']);
            const gauge = await construcAndWait<LiquidityGauge>('LiquidityGauge', [
                lpToken.address,
                admin,
                minter.address,
                arcb.address,
                votingEscrow.address,
                gaugeController.address,
                veBoostProxy.address
            ])
            await gaugeController.addGauge(gauge.address, type, weight);
            return { lpToken, gauge }
        }

        describe('Add guage', () => {
            it('Add one gauge and stake', async () => {
                // add gauge
                const GAUGE_WEIGHT = 1;
                const GAUGE_TYPE = 0;
                const { lpToken, gauge } = await deployGauge(defaultUser.address, GAUGE_TYPE, GAUGE_WEIGHT);
                // Wait weight to take effect
                let timeWeight = await gaugeController.timeWeight(gauge.address);
                let weight = await gaugeController["gaugeRelativeWeight(address)"](gauge.address);
                expect(weight.eq(0))
                await fastForwardTo(timeWeight.toNumber());
                weight = await gaugeController["gaugeRelativeWeight(address)"](gauge.address);
                expect(weight.eq(BigNumber.from(E18).mul(GAUGE_WEIGHT)))
                // stake
                const STAKE_AMOUNT = BigNumber.from(E18);
                await lpToken.mint(defaultUser.address, STAKE_AMOUNT);
                await lpToken.approve(gauge.address, STAKE_AMOUNT);
                await gauge.deposit(STAKE_AMOUNT, defaultUser.address, false);
                // Check claimable
                let rewards = await callClaimableTokens(gauge, defaultUser)
                expect(rewards.eq(0))
                await fastForward(WEEK)
                rewards = await callClaimableTokens(gauge, defaultUser)
                expect(rewards.eq(BigNumber.from(INITIAL_RATE).mul(WEEK)));
                weight = await gaugeController["gaugeRelativeWeight(address)"](gauge.address);
                expect(weight.eq(0))
                // Get reward
                const comparator = new BalanceComparator(defaultUser.address);
                await comparator.setBeforeBalance(arcb.address);
                await minter.mint(gauge.address);
                await comparator.setAfterBalance(arcb.address)
                expect(comparator.compare(arcb.address).eq(rewards));
                // Change weight
                const CHANGED_GAUGE_WEIGHT = 2;
                await gaugeController.changeGaugeWeight(gauge.address, CHANGED_GAUGE_WEIGHT);
                weight = await gaugeController["gaugeRelativeWeight(address)"](gauge.address);
                expect(weight.eq(0))
                timeWeight = await gaugeController.timeWeight(gauge.address);
                await fastForwardTo(timeWeight.toNumber());
                weight = await gaugeController["gaugeRelativeWeight(address)"](gauge.address);
                expect(weight.eq(BigNumber.from(E18).mul(CHANGED_GAUGE_WEIGHT)));
            })

            it('Add two gauge with different type', async () => {
                const GAUGE_TYPE_0 = 0;
                const GAUGE_TYPE_1 = 1;
                const GAUGE_WEIGHT_0 = 1;
                const GAUGE_WEIGHT_1 = 1;

                const { lpToken: lpToken0, gauge: gauge0 } = await deployGauge(defaultUser.address, GAUGE_TYPE_0, GAUGE_WEIGHT_0);
                await deployGauge(defaultUser.address, GAUGE_TYPE_1, GAUGE_WEIGHT_1);
                // Weight take effect
                const timeWeight = await gaugeController.timeWeight(gauge0.address);
                await fastForwardTo(timeWeight.toNumber());
                // Stake
                const STAKE_AMOUNT = BigNumber.from(E18);
                await lpToken0.mint(defaultUser.address, STAKE_AMOUNT);
                await lpToken0.approve(gauge0.address, STAKE_AMOUNT);
                await gauge0.deposit(STAKE_AMOUNT, defaultUser.address, false);
                // Check claimable
                await fastForward(WEEK)
                const rewards = await callClaimableTokens(gauge0, defaultUser);
                const expectClaimable = BigNumber.from(INITIAL_RATE)
                    .mul(WEEK)
                    .mul(GAUGE_WEIGHT_0 * GAUGE_WEIGHTS[0])
                    .div(GAUGE_WEIGHT_0 * GAUGE_WEIGHTS[0] + GAUGE_WEIGHT_1 * GAUGE_WEIGHTS[1])
                expect(rewards.eq(expectClaimable));
            } )
        })

        describe('Vote for gauge weight', () => {
            it('Vote', async () => {
                // add gauges
                const GAUGE_WEIGHT = 0;
                const GAUGE_TYPE = 0;
                const { gauge: gauge0 } = await deployGauge(defaultUser.address, GAUGE_TYPE, GAUGE_WEIGHT);
                const { gauge: gauge1 } = await deployGauge(defaultUser.address, GAUGE_TYPE, GAUGE_WEIGHT);
                // Get veARCB
                const DEPOSIT_ARCB_AMOUNT = BigNumber.from(E18);
                const LOCK_DURATION = YEAR * 2;
                const now = await currentTime();
                const UNLOCK_TIME = now + LOCK_DURATION;
                await arcb.approve(votingEscrow.address, DEPOSIT_ARCB_AMOUNT);
                await votingEscrow.createLock(DEPOSIT_ARCB_AMOUNT, UNLOCK_TIME);
                // Vote for gauge
                const USER_WEIGHT = 5000;
                const timeWeight = await gaugeController.timeWeight(gauge0.address);
                let nextWeight = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge0.address, timeWeight);
                expect(nextWeight.eq(0));
                await gaugeController.voteForGaugeWeights(gauge0.address, USER_WEIGHT);
                nextWeight = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge0.address, timeWeight);
                expect(nextWeight.eq(BigNumber.from(E18)));
                await gaugeController.voteForGaugeWeights(gauge1.address, USER_WEIGHT);
                nextWeight = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge0.address, timeWeight);
                expect(nextWeight.eq(BigNumber.from(E18).div(2)));
            })
        })
    })

})