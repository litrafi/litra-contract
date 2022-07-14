import { ZERO } from "../lib/constant";
import { CommonNetworkConfig } from "../type";

export const NETWORK_CONFIG_ROPSTEN: CommonNetworkConfig = {
    weth: '0x0d8da793A9062D72D15bc9B34c532B40BB205e84',
    usdt: '0xa290dE16E2d19a123A1efE51985937E1Fc3172c2',
    tokensInfo: {
        USDT: {
            address: '0xa290dE16E2d19a123A1efE51985937E1Fc3172c2',
            dataFeed: '0x56c0D65966a26918c1bfA5A97504DA2bd1aeCE0D'
        },
        USDC: {
            address: '0xA4F16688D8289ceDaB48D9Df18A7ce331a7Ee5E4',
            dataFeed: '0x56c0D65966a26918c1bfA5A97504DA2bd1aeCE0D'
        },
        ETH: {
            address: ZERO,
            dataFeed: '0x10992e3E26496BFE22Db406F405116C5aa227828'
        }
    }
}