import { ZERO } from "../lib/constant";
import { CommonNetworkConfig } from "../type";

export const NETWORK_CONFIG_GOERLI: CommonNetworkConfig = {
    weth: '0x04c68A7fB750ca0Ba232105B3b094926a0f77645',
    usdt: '0x79c3c97B2b0a41591928Ebdd32B5F1Ad960426bf',
    tokensInfo: {
        USDT: {
            address: '0x79c3c97B2b0a41591928Ebdd32B5F1Ad960426bf',
            dataFeed: '0xFA2095e0b0b00a6FC927D900818b4dD637998C02'
        },
        USDC: {
            address: '0x84eF713716a456D006f1000b26b0cD5508dd478C',
            dataFeed: '0xFA2095e0b0b00a6FC927D900818b4dD637998C02'
        },
        ETH: {
            address: ZERO,
            dataFeed: '0x0D28282c33786887502370A71B4a01f6c03ae3A9'
        }
    }
}