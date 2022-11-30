/* eslint-disable no-unused-expressions */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/signers";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers"
import { ethers } from "hardhat";
import { VotingDeployer } from "../../scripts/deployer/dao/voting.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { construcAndWait, getEventArgument, namehash, pct16 } from "../../scripts/lib/utils";
import { LA, FeeDistributor, FeeManager, GaugeController, LiquidityGauge, Minter, MockERC20, MockPoolFactory, SimpleBurner, VEBoostProxy, VotingEscrow, WBNB, Voting, ExecutionTarget } from "../../typechain"
import { BalanceComparator } from "../mock-util/comparator.util";
import { clear, currentTime, fastForward, fastForwardTo, MINUTE, WEEK, YEAR } from "../mock-util/env.util";
import { expectCloseTo, shouldThrow } from "../mock-util/expect-plus.util";
import { encodeCallScript } from "./dao.util";

describe('DAO', () => {
    let la: LA & Contract;
    let votingEscrow: VotingEscrow & Contract;
    let gaugeController: GaugeController & Contract;
    let minter: Minter & Contract;
    let veBoostProxy: VEBoostProxy & Contract;

    let defaultUser: SignerWithAddress,
        ownerAdmin: SignerWithAddress,
        parameterAdmin: SignerWithAddress,
        emergencyAdmin: SignerWithAddress;

    const INITIAL_RATE = '3191241046289407268';
    const LAUNCH_DELY = 86400;

    beforeEach(async () => {
        const users = await ethers.getSigners();
        defaultUser = users[0];
        ownerAdmin = users[1];
        parameterAdmin = users[2];
        emergencyAdmin = users[3];

        la = await construcAndWait<LA>('LA');
        votingEscrow = await construcAndWait('VotingEscrow', [la.address])
        veBoostProxy = await construcAndWait('VEBoostProxy', [votingEscrow.address])
        gaugeController = await construcAndWait('GaugeController', [la.address, votingEscrow.address])
        minter = await construcAndWait('Minter', [la.address, gaugeController.address])
        await la.setMinter(minter.address)
        // set admins
        await votingEscrow.commitOwnershipAdmin(ownerAdmin.address);
        await votingEscrow.connect(ownerAdmin).applyOwnershipAdmin();

        await gaugeController.commitOwnershipAdmin(ownerAdmin.address);
        await gaugeController.connect(ownerAdmin).applyOwnershipAdmin();
    })

    describe('LA mining', () => {
        it('Start mining', async () => {
            let rate = await la.rate();
            expect(rate.eq(0)).true;
            await shouldThrow(la.updateMiningParamters(), 'Not time');
            await fastForward(LAUNCH_DELY);
            await la.updateMiningParamters();
            rate = await la.rate();
            expect(rate.eq(INITIAL_RATE)).true
        })

        it('Run 2 years', async () => {
            await fastForward(86400);
            let currenRate = BigNumber.from(INITIAL_RATE);
            for (let index = 0; index < 2; index++) {
                await la.updateMiningParamters();
                const _rate = await la.rate();
                expect(_rate.eq(currenRate)).true;
                
                await fastForward(31536000)
                currenRate = currenRate.mul(E18).div('1252000000000000000');
            }
            await la.updateMiningParamters();
        })
    })

    describe('VotingEscrow', () => {
        const LA_BALANCE = BigNumber.from(E18).mul(10);
        const MAX_LOCK_TIME = 4 * YEAR;

        beforeEach(async () => {
            await la.approve(votingEscrow.address, LA_BALANCE); 
        })

        describe('Deposit', () => {
            it('Create Lock', async () => {
                const LOCK_VALUE = LA_BALANCE;
                const LOCK_DURATION = YEAR * 3;
                const now = await currentTime();
                const UNLOCK_TIME = LOCK_DURATION + now;
                // deposit
                const comparator = new BalanceComparator(defaultUser.address);
                await comparator.setBeforeBalance(la.address);
                await votingEscrow.createLock(LA_BALANCE, UNLOCK_TIME);
                await comparator.setAfterBalance(la.address);
                expect(comparator.compare(la.address).eq(LOCK_VALUE)).true;
                // check balance
                let veBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                expectCloseTo(veBalance, LOCK_VALUE.mul(LOCK_DURATION).div(MAX_LOCK_TIME), 2)
                // Half time passed
                await fastForward(LOCK_DURATION / 2);
                veBalance = await votingEscrow["balanceOf(address)"](defaultUser.address);
                expectCloseTo(veBalance, LOCK_VALUE.mul(LOCK_DURATION).div(MAX_LOCK_TIME).div(2), 1);
                // Withdraw
                await shouldThrow(votingEscrow.withdraw(), `The lock didn't expire`);
                await fastForward(LOCK_DURATION / 2);
                await comparator.setBeforeBalance(la.address);
                await votingEscrow.withdraw();
                await comparator.setAfterBalance(la.address);
                expect(comparator.compare(la.address).eq(LOCK_VALUE)).true;
            })

            it('Deposit for', async () => {
                const ORIGIN_DEPOSIT_AMOUNT = LA_BALANCE.div(2);
                const APPEND_DEPOSIT_AMOUNT = LA_BALANCE.div(2);
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
                const ORIGIN_DEPOSIT_AMOUNT = LA_BALANCE.div(2);
                const INCREASE_DEPOSIT_AMOUNT = LA_BALANCE.div(2);
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
                const ORIGIN_DEPOSIT_AMOUNT = LA_BALANCE;
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
            await la.updateMiningParamters();

            await gaugeController.connect(ownerAdmin).addType('curve_lp', GAUGE_WEIGHTS[0]);
            await gaugeController.connect(ownerAdmin).addType('uniswap_lp', GAUGE_WEIGHTS[1]);
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
                la.address,
                votingEscrow.address,
                gaugeController.address,
                veBoostProxy.address
            ])
            await gaugeController.connect(ownerAdmin).addGauge(gauge.address, type, weight);
            return { lpToken, gauge }
        }

        describe('Add guage', () => {
            it('Add one gauge and stake', async () => {
                // add gauge
                const GAUGE_WEIGHT = 1;
                const GAUGE_TYPE = 0;
                const { lpToken, gauge } = await deployGauge(defaultUser.address, GAUGE_TYPE, GAUGE_WEIGHT);
                // Wait weight to take effect
                const timeWeight = await gaugeController.timeWeight(gauge.address);
                let weight = await gaugeController["gaugeRelativeWeight(address)"](gauge.address);
                await fastForwardTo(timeWeight.toNumber());
                weight = await gaugeController["gaugeRelativeWeight(address)"](gauge.address);
                expect(weight.eq(BigNumber.from(E18).mul(GAUGE_WEIGHT))).true
                // stake
                const STAKE_AMOUNT = BigNumber.from(E18);
                await lpToken.mint(defaultUser.address, STAKE_AMOUNT);
                await lpToken.approve(gauge.address, STAKE_AMOUNT);
                await gauge.deposit(STAKE_AMOUNT, defaultUser.address, false);
                // Check claimable
                let rewards = await callClaimableTokens(gauge, defaultUser)
                expect(rewards.eq(0)).true
                await fastForward(WEEK)
                rewards = await callClaimableTokens(gauge, defaultUser)
                expectCloseTo(rewards, BigNumber.from(INITIAL_RATE).mul(WEEK));
                weight = await gaugeController["gaugeRelativeWeight(address)"](gauge.address);
                expect(weight.eq(0)).true
                // Get reward
                const comparator = new BalanceComparator(defaultUser.address);
                await comparator.setBeforeBalance(la.address);
                await minter.mint(gauge.address);
                await comparator.setAfterBalance(la.address)
                expect(comparator.compare(la.address).eq(rewards)).true;
            })

            it('Add two gauge with different type', async () => {
                const GAUGE_TYPE_0 = 0;
                const GAUGE_TYPE_1 = 1;
                const GAUGE_WEIGHT_0 = 1;
                const GAUGE_WEIGHT_1 = 1;

                const { lpToken: lpToken0, gauge: gauge0 } = await deployGauge(defaultUser.address, GAUGE_TYPE_0, GAUGE_WEIGHT_0);
                const { gauge: gauge1 } = await deployGauge(defaultUser.address, GAUGE_TYPE_1, GAUGE_WEIGHT_1);
                // confirm weight
                const timeWeight = await gaugeController.timeWeight(gauge0.address);
                let weight0 = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge0.address, timeWeight);
                let weight1 = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge1.address, timeWeight);
                expect(weight0).deep.eq(BigNumber.from(E18).mul(2).div(3));
                expect(weight1).deep.eq(BigNumber.from(E18).div(3));
                // change weight
                await gaugeController.connect(ownerAdmin).changeGaugeWeight(gauge1.address, 2);
                weight0 = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge0.address, timeWeight);
                weight1 = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge1.address, timeWeight);
                expect(weight0).deep.eq(BigNumber.from(E18).div(2));
                expect(weight1).deep.eq(BigNumber.from(E18).div(2));
                // Weight take effect
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
                    .mul(weight0)
                    .div(weight0.add(weight1))
                expectCloseTo(rewards, expectClaimable);
            } )
        })

        describe('Vote for gauge weight', () => {
            it('Vote', async () => {
                // add gauges
                const GAUGE_WEIGHT = 0;
                const GAUGE_TYPE = 0;
                const { gauge: gauge0 } = await deployGauge(defaultUser.address, GAUGE_TYPE, GAUGE_WEIGHT);
                const { gauge: gauge1 } = await deployGauge(defaultUser.address, GAUGE_TYPE, GAUGE_WEIGHT);
                // Get veLA
                const DEPOSIT_LA_AMOUNT = BigNumber.from(E18);
                const LOCK_DURATION = YEAR * 2;
                const now = await currentTime();
                const UNLOCK_TIME = now + LOCK_DURATION;
                await la.approve(votingEscrow.address, DEPOSIT_LA_AMOUNT);
                await votingEscrow.createLock(DEPOSIT_LA_AMOUNT, UNLOCK_TIME);
                // Vote for gauge
                const USER_WEIGHT = 5000;
                const timeWeight = await gaugeController.timeWeight(gauge0.address);
                let nextWeight = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge0.address, timeWeight);
                expect(nextWeight.eq(0)).true;
                await gaugeController.voteForGaugeWeights(gauge0.address, USER_WEIGHT);
                nextWeight = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge0.address, timeWeight);
                expect(nextWeight.eq(BigNumber.from(E18))).true;
                await gaugeController.voteForGaugeWeights(gauge1.address, USER_WEIGHT);
                nextWeight = await gaugeController["gaugeRelativeWeight(address,uint256)"](gauge0.address, timeWeight);
                expect(nextWeight.eq(BigNumber.from(E18).div(2))).true;
            })
        })
    })

    describe('Fee', () => {
        let feeManager: FeeManager & Contract;
        let feeDistributor: FeeDistributor & Contract;
        let wnft: MockERC20 & Contract;
        
        let startTime;
        const COLLECTED_FEE = BigNumber.from(E18);

        beforeEach(async () => {
            const users = await ethers.getSigners();

            startTime = await currentTime();
            feeDistributor = await construcAndWait('FeeDistributor', [votingEscrow.address, startTime])
            feeManager = await construcAndWait('FeeManager', [ZERO]);
            wnft = await construcAndWait('MockERC20', ['Wrapped NFT', 'WNFT']);
            // set admin
            await feeDistributor.commitOwnershipAdmin(ownerAdmin.address);
            await feeDistributor.commitEmergencyAdmin(emergencyAdmin.address);
            await feeManager.commitOwnershipAdmin(ownerAdmin.address);
            await feeManager.commitParameterAdmin(parameterAdmin.address);
            await feeManager.commitEmergencyAdmin(emergencyAdmin.address);

            await feeDistributor.connect(ownerAdmin).applyOwnershipAdmin();
            await feeDistributor.connect(emergencyAdmin).applyEmergencyAdmin();
            await feeManager.connect(ownerAdmin).applyOwnershipAdmin();
            await feeManager.connect(parameterAdmin).applyParameterAdmin();
            await feeManager.connect(emergencyAdmin).applyEmergencyAdmin();
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
                const DEFAULT_WRAP_FEE = 100;
                const DEFAULT_UNWRAP_FEE = 200;
                const WRAP_FEE = 300;
                const UNWRAP_FEE = 400;

                await feeManager.connect(parameterAdmin).setDefaultWrapFee(DEFAULT_WRAP_FEE);
                const defaultWrapFee = await feeManager.defaultWrapFee();
                expect(defaultWrapFee.toNumber()).eq(DEFAULT_WRAP_FEE);

                await feeManager.connect(parameterAdmin).setDefaultUnwrapFee(DEFAULT_UNWRAP_FEE);
                const defaultUnwrapFee = await feeManager.defaultUnwrapFee();
                expect(defaultUnwrapFee.toNumber()).eq(DEFAULT_UNWRAP_FEE);

                const WNFT_ADDR = ZERO;

                await feeManager.connect(parameterAdmin).setWrapFee(WNFT_ADDR, WRAP_FEE);
                const wrapFee = await feeManager.wrapFees(WNFT_ADDR);
                expect(wrapFee.toNumber()).eq(WRAP_FEE);

                await feeManager.connect(parameterAdmin).setUnwrapFee(WNFT_ADDR, UNWRAP_FEE);
                const unwrapFee = await feeManager.unwrapFees(WNFT_ADDR);
                expect(unwrapFee.toNumber()).eq(UNWRAP_FEE);
            })

            it('Fail to set', async () => {
                const FEE = 100;
                const WNFT_ADDR = ZERO;
                
                expect(defaultUser.address).not.eq(parameterAdmin.address);
                await shouldThrow(feeManager.setDefaultWrapFee(FEE), '! parameter admin') ;
                await shouldThrow(feeManager.setDefaultUnwrapFee(FEE), '! parameter admin') ;
                await shouldThrow(feeManager.setWrapFee(WNFT_ADDR, FEE), '! parameter admin') ;
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
                expect(receiverComparator.compare(ZERO).eq(feeBalance)).true;
                feeBalance = await wnft.balanceOf(feeManager.address);
                expect(feeBalance.eq(0)).true;
            })
        })

        describe('Distribute Fee', () => {
            async function callClaimable(user: SignerWithAddress) {
                const reward = await user.call({
                    to: feeDistributor.address,
                    data: feeDistributor.interface.encodeFunctionData("claim", [user.address])
                })
                return BigNumber.from(reward)
            }

            it('Burn and distribute fee', async () => {
                // burn fee
                await feeDistributor.connect(ownerAdmin).checkpointToken();
                await feeDistributor.connect(ownerAdmin).toggleAllowCheckpointToken();
                await feeManager.burn(wnft.address);
                // Get veLA before checkpoint
                const DEPOSIT_LA_AMOUNT = BigNumber.from(E18);
                const LOCK_DURATION = YEAR * 2;
                const now = await currentTime();
                const UNLOCK_TIME = now + LOCK_DURATION;
                await la.approve(votingEscrow.address, DEPOSIT_LA_AMOUNT);
                await votingEscrow.createLock(DEPOSIT_LA_AMOUNT, UNLOCK_TIME);
                // Claim reward
                // first week
                // weekCursor = (ts + 1 weeks - 1) / 1 weeks * 1 weeks
                // weekCursor > now / week * week, return 0
                let claimable = await callClaimable(defaultUser);
                expect(claimable).deep.eq(BigNumber.from(0));
                // second week
                // weekCursor = now / week * week, return 0
                await fastForward(WEEK);
                claimable = await callClaimable(defaultUser);
                expect(claimable).deep.eq(BigNumber.from(0));
                // third week
                // weekCursor < now / week * week, return 0
                // get reward of last week
                await fastForward(WEEK);
                claimable = await callClaimable(defaultUser);
                expect(claimable).not.deep.eq(BigNumber.from(0));
                // claim
                const comparator = new BalanceComparator(defaultUser.address);
                await comparator.setBeforeBalance(ZERO);
                await feeDistributor.claim(defaultUser.address);
                await comparator.setAfterBalance(ZERO);
                expectCloseTo(comparator.compare(ZERO), claimable, 2)
            })
        })
    })

    describe('Voting', () => {
        let voting: Voting & Contract;
        let executionTarget: ExecutionTarget & Contract;
        const appId = namehash('litra-voting.open.aragonpm.eth')
        const supportRequiredPct = pct16(50);
        const minAcceptQuorumPct = pct16(20);
        const voteTime = 10 * MINUTE;
        const minTime = 10 * MINUTE;
        const minBalance = 1;
        const minBalanceLowerLimit = 1;
        const minBalanceUpperLimit = 10;
        const minTimeLowerLimit = 5 * MINUTE;
        const minTimeUpperLimit = 15 * MINUTE;

        beforeEach(async () => {
            // Initialization params
            clear();
            voting = await new VotingDeployer().getOrDeployInstance({
                appId,
                token: votingEscrow.address,
                supportRequiredPct,
                minAcceptQuorumPct, 
                voteTime,
                minBalance,
                minTime,
                minBalanceLowerLimit,
                minBalanceUpperLimit,
                minTimeLowerLimit,
                minTimeUpperLimit
            })
            executionTarget = await construcAndWait<ExecutionTarget>('ExecutionTarget')
        })

        it('create voting', async () => {
            // Get vote power
            const DEPOSIT_LA_AMOUNT = BigNumber.from(E18).mul(2);
            const LOCK_DURATION = YEAR * 4;
            const now = await currentTime();
            const UNLOCK_TIME = now + LOCK_DURATION;
            await la.approve(votingEscrow.address, DEPOSIT_LA_AMOUNT);
            await votingEscrow.createLock(DEPOSIT_LA_AMOUNT, UNLOCK_TIME);
            console.log('totalSply', await votingEscrow["totalSupply()"]())
            // new vote
            const action = {
                to: executionTarget.address,
                data: executionTarget.interface.encodeFunctionData("execute"),
            };
            const tx = await voting["newVote(bytes,string)"](
                encodeCallScript([action]),
                ""
            );
            const voteId = await getEventArgument(
                voting,
                tx.hash,
                "StartVote",
                "voteId"
            );
            // Get vote info
            const voteInfo = await voting.getVote(voteId);
            expect(voteInfo.executed).eq(false);
            expect(voteInfo.open).eq(true);
        })
    })
})