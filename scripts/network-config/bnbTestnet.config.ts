import { ZERO } from "../lib/constant";
import { CommonNetworkConfig } from "../type";

export const NETWORK_CONFIG_BNBTESTNET: CommonNetworkConfig = {
    weth: '0x7EEb21aD5f15f95090bd6Cd8Cc04Ae2d34625B4d',
    usdt: '0x9e99Ec422184e8Aa690f98dd9576110959c43649',
    tokensInfo: {
        USDT: {
            address: '0x9e99Ec422184e8Aa690f98dd9576110959c43649',
            dataFeed: '0x6400aaF2A9650BB2f626b606822a5FF9eD6F3567'
        },
        USDC: {
            address: '0xDaf5ac16E6b62D762A52BA83A6f8fAc1F355db92',
            dataFeed: '0x6400aaF2A9650BB2f626b606822a5FF9eD6F3567'
        },
        ETH: {
            address: ZERO,
            dataFeed: '0x47f0AfAF50bf9bFFa72bEC15479d62a560d63315'
        }
    }
}