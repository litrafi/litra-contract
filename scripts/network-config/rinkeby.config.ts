import { ZERO } from "../lib/constant";
import { CommonNetworkConfig } from "../type";

export const NETWORK_CONFIG_RINKEBY: CommonNetworkConfig = {
    weth: '0xFA2095e0b0b00a6FC927D900818b4dD637998C02',
    usdt: '',
    tokensInfo: {
        USDT: {
            address: '',
            dataFeed: ''
        },
        USDC: {
            address: '',
            dataFeed: ''
        },
        ETH: {
            address: ZERO,
            dataFeed: '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e'
        }
    }
}