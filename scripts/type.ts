export declare type DeployConfig = {
    feeTo: string,
    pricingTokens: string[]
};

export declare type CommonNetworkConfig = {
    weth: string,
    usdt: string,
    tokensInfo: {
        [key in string]: {
            address: string,
            dataFeed?: string
        }
    }
}