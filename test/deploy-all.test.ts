import { clear, DAY } from "./mock-util/env.util"
import { deployAll } from "../scripts/deploy-all";
import { writeTestDeployConfig } from "../scripts/deploy-config";

describe('Deploy all', () => {
    it('run script', async () => {
        clear();
        writeTestDeployConfig({
            dao: {
                appId: 'litra-voting.aragonpm.eth',
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
})