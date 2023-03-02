import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { writeTestDeployConfig } from "../../scripts/deploy-config";
import { GaugeControllerDeployer } from "../../scripts/deployer/dao/gauge-controller.deployer";
import { LADeployer } from "../../scripts/deployer/dao/la.deployer";
import { VotingEscrowDeployer } from "../../scripts/deployer/dao/voting-escrow.deployer";
import { VotingDeployer } from "../../scripts/deployer/dao/voting.deployer";
import { deployAll } from "../../scripts/deployer/litra-deployer";
import { E18 } from "../../scripts/lib/constant";
import { construcAndWait } from "../../scripts/lib/utils";
import { ExecutionTarget, GaugeController, Voting } from "../../typechain";
import { clear, DAY, fastForward, getNowRoughly, YEAR } from "../mock-util/env.util";

describe('Voting', async () => {
    const VOTE_TIME = 7 * DAY;

    let ownershipVoting: Voting & Contract;
    let gaugeCtl: GaugeController & Contract;

    beforeEach(async () => {
        writeTestDeployConfig({
            dao: {
                supportRequiredPct: 50, 
                minAcceptQuorumPct: 20, 
                voteTime: VOTE_TIME,
                minBalance: 2500,
                minTime: DAY,
                minBalanceLowerLimit: 2000,
                minBalanceUpperLimit: 5000,
                minTimeLowerLimit: DAY,
                minTimeUpperLimit: 14 * DAY
            }
        })

        clear()
        await deployAll();
        ownershipVoting = await new VotingDeployer('Ownership').getInstance();
        gaugeCtl = await new GaugeControllerDeployer().getInstance();
        const ve = await new VotingEscrowDeployer().getInstance();
        const la = await new LADeployer().getInstance()
        // get votes
        const STAKE_AMOUNT = BigNumber.from(E18).mul(300000);
        const END_TIME = getNowRoughly() + YEAR * 4;
        await la.approve(ve.address, STAKE_AMOUNT);
        await ve.create_lock(STAKE_AMOUNT, END_TIME);
    })

    it('Test execute voting', async () => {
        const executionTarget = await construcAndWait<ExecutionTarget>('ExecutionTarget');
        await ownershipVoting["newVote(bytes,string)"](
            encodeExecutionScript([{
                to: executionTarget.address,
                data: executionTarget.interface.encodeFunctionData('execute')
            }]),
            "Execute target"
        );
        await fastForward(7 * DAY);
        await ownershipVoting.executeVote(0);
        const counter = await executionTarget.counter();
        expect(counter.toNumber()).eq(1);
    })  

    it('Add Type', async () => {
        const TYPE_NAME = 'Mainnet';
        await ownershipVoting["newVote(bytes,string)"](
            encodeExecutionScript([{
                to: gaugeCtl.address,
                data: gaugeCtl.interface.encodeFunctionData('add_type(string,uint256)', [TYPE_NAME, 1])
            }]),
            "Add type Mainnet with weight 1"
        )
        let canExecute = await ownershipVoting.canExecute(0);
        expect(canExecute).eq(false);
        await fastForward(7 * DAY);
        canExecute = await ownershipVoting.canExecute(0);
        expect(canExecute).eq(true);
        console.log('123123')
        console.log('admin', await gaugeCtl.admin())
        await ownershipVoting.executeVote(0);
        const newTypeName = await gaugeCtl.gauge_type_names(0)
        expect(newTypeName).eq(TYPE_NAME);
    })
})

export function encodeExecutionScript(executions: {
    to: string,
    data: string
}[]) {
    return executions.reduce((script: string, { to, data }) => {
        const address = ethers.utils.defaultAbiCoder.encode(["address"], [to]);
        const dataLength = ethers.utils.defaultAbiCoder.encode(
          ["uint256"],
          [(data.length - 2) / 2]
        );
    
        return script + address.slice(26) + dataLength.slice(58) + data.slice(2);
    }, "0x00000001");
}