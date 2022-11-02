import { network } from "hardhat"
import { DeployConfig } from "../type";
import { isTestEnv } from "../network-config";


const configs: {
    [key in string]: DeployConfig
} = {}

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