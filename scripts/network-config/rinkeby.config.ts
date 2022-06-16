import { ZERO } from "../lib/constant";
import { CommonNetworkConfig } from "../type";

export const NETWORK_CONFIG_RINKEBY: CommonNetworkConfig = {
    weth: '0xFA2095e0b0b00a6FC927D900818b4dD637998C02',
    usdt: '0x654327aE89e8A891B874B443e116CC6aCe7aDAE1',
    tokensInfo: {
        USDT: {
            address: '0x654327aE89e8A891B874B443e116CC6aCe7aDAE1',
            dataFeed: '0x96156986c01FbE976D507a63dA5235511f7bF44a'
        },
        USDC: {
            address: '0xD33904896c2CE7Ff4f69b32F95ffFf884983FA61',
            dataFeed: '0xa24de01df22b63d23Ebc1882a5E3d4ec0d907bFB'
        },
        ETH: {
            address: ZERO,
            dataFeed: '0x8A753747A1Fa494EC906cE90E9f37563A8AF630e'
        }
    }
}