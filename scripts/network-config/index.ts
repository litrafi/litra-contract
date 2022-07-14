import { network } from "hardhat";
import { CommonNetworkConfig } from "../type";
import { NETWORK_CONFIG_RINKEBY } from "./rinkeby.config";
import { NETWORK_CONFIG_ROPSTEN } from "./ropsten.config";

const networkConfigs: {
    [key in string]: CommonNetworkConfig
} = {
    rinkeby: NETWORK_CONFIG_RINKEBY,
    ropsten: NETWORK_CONFIG_ROPSTEN
}

export function getNetworkConfig(): CommonNetworkConfig {
    return networkConfigs[network.name];
}

export function setTestNetworkConfig(jsonObj: CommonNetworkConfig) {
    if(!isTestEnv()) throw new Error('Cannot set network config in Non-Test env');
    setNetworkConfig(jsonObj);
}

export function updateMainNetwrokConfig(jsonObj: any) {
    const originConfig = getNetworkConfig();
    const { deletedKeys, addedKeys, updatedKeys } = getDifferFromTwoObj(originConfig, jsonObj);
    console.log(`
    update ${network.name} network config:
    Updated key: ${updatedKeys}
    Added key: ${addedKeys}
    Deleted key: ${deletedKeys}
    `)
    setNetworkConfig(jsonObj)
}

export function setNetworkConfig(jsonObj: any) {
    networkConfigs[network.name] = jsonObj;
}

export function isTestEnv(networkName?: string) {
    if(!networkName) networkName = network.name;
    if(networkName === 'hardhat' || networkName === 'localhost') return true;
    return false;
}

function getDifferFromTwoObj(obj0: any, obj1: any) {
    const deletedKeys = [];
    const addedKeys = [];
    const updatedKeys = [];
    for (const key in obj0) {
        if(obj1[key] === undefined) deletedKeys.push(key);
        else if(JSON.stringify(obj1[key]) !== JSON.stringify(obj0[key])) updatedKeys.push(key);
    }
    for (const key in obj1) {
        if(obj1[key] === undefined) addedKeys.push(key);
    }
    return { deletedKeys, addedKeys, updatedKeys }
}