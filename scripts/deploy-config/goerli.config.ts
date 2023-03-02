import { DAY } from "../../test/mock-util/env.util";
import { DeployConfig } from "../type";

export const GOERLI_DEPLOY_CONFIG: DeployConfig = {
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
}