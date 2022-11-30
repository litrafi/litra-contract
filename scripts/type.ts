export declare type DeployConfig = {
    dao: {
        appId: string,
        supportRequiredPct: number, 
        minAcceptQuorumPct: number, 
        voteTime: number,
        minBalance: number,
        minTime: number,
        minBalanceLowerLimit: number,
        minBalanceUpperLimit: number,
        minTimeLowerLimit: number,
        minTimeUpperLimit: number
    }
};

export declare type CommonNetworkConfig = {}