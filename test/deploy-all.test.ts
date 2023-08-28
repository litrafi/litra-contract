import { clear, DAY } from "./mock-util/env.util"
import { writeTestDeployConfig } from "../scripts/deploy-config";
import { deployAll } from "../scripts/deployer/litra-deployer";
import { mockCurve } from "../scripts/deployer/curve-deployer";
import { construcAndWait } from "../scripts/lib/utils";

describe('Deploy all', () => {
    it('run script', async () => {
        clear();
        writeTestDeployConfig({
            dao: {
                supportRequiredPct: 50, 
                minAcceptQuorumPct: 20, 
                voteTime: 7 * DAY,
                minBalance: 2500,
                minTime: DAY,
                minBalanceLowerLimit: 2000,
                minBalanceUpperLimit: 5000,
                minTimeLowerLimit: DAY,
                minTimeUpperLimit: 14 * DAY
            }
        })
        await deployAll()
    })

    it('mock curve', async () => {
        const deployment = await mockCurve();
        console.log('1')
        const A = await construcAndWait('MockERC20', ['', '']);
        console.log('2')
        const B = await construcAndWait('MockERC20', ['', '']);
        console.log('3')
        const p = await deployment.poolDeployer.deploy_pool_test([A.address, B.address]);
        console.log('p', p)
    })
})