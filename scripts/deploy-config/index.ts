import { network } from "hardhat"
import { DeployConfig } from "../type";
import { isTestEnv } from "../network-config";
import { DEPLOY_CONFIG_RINKEBY } from "./rinkeby.config";
import { DEPLOY_CONFIG_ROPSTEN } from "./ropsten.config";
import { DEPLOY_CONFIG_BNBTEST } from "./bnbTestnet.config";

const configs: {
    [key in string]: DeployConfig
} = {
    rinkeby: DEPLOY_CONFIG_RINKEBY,
    ropsten: DEPLOY_CONFIG_ROPSTEN,
    bnbTestnet: DEPLOY_CONFIG_BNBTEST
}

export function getDeployConfig(): DeployConfig {
    const config = configs[network.name];
    if(config === undefined) {
        throw new Error('无效的部署配置: ' + network.name)
    }
    return config;
}

export function writeTestDeployConfig(config: DeployConfig) {
    if(!isTestEnv()) throw new Error('非测试环境下不允许写入deploy-config')
    configs[network.name] = config;
}