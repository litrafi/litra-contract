import moment from "moment";
import { types } from "util";
import { ethers, upgrades } from "hardhat";
import { BigNumber, Contract, ContractFactory } from "ethers";
// import BigNumberjs from "bignumber.js";
// import { DeployRecorder } from "./deploy-recorder";
// import { getNetworkConfig } from "../network-config";
// import { TaskParamWrongError } from "../errors/task-param-wrong-error";
// eslint-disable-next-line node/no-extraneous-import
import { TransactionResponse } from '@ethersproject/abstract-provider';
import { ZERO } from "./constant";
import { concat, defaultAbiCoder, hexlify, keccak256, nameprep, toUtf8Bytes } from "ethers/lib/utils";

async function tryExecute(func: () => Promise<any>, funcTag: string, tryTimes = 3) {
    while(true) {
        try{
            return await func();
        } catch(err) {
            if(tryTimes) {
                tryTimes --;
            } else {
                console.error(`${funcTag} 执行失败!`);
                throw err;
            }
        }
    }
}

export async function deployAndWait<ContractType = any>(
    contract: ContractFactory | string,
    args?: any[],
    opt?: { initializer: string },
): Promise<Contract & ContractType> {
    let factory: ContractFactory;
    if(typeof contract === 'string') {
        factory = await ethers.getContractFactory(contract);
    } else {
        factory = contract;
    }
    return tryExecute(
        async () => {
            const instance = await upgrades.deployProxy(factory, args, opt);
            await instance.deployTransaction.wait();
            return getRetryContract(instance);
        },
        'deployAndWait'
    )
}

export async function construcAndWait<ContractType = any>(
    contract: ContractFactory | string,
    args: any[] = [],
): Promise<Contract & ContractType> {
    let factory: ContractFactory;
    if(typeof contract === 'string') {
        factory = await ethers.getContractFactory(contract);
    } else {
        factory = contract;
    }
    return tryExecute(
        async () => {
            const instance = await factory.deploy(...args);
            await instance.deployTransaction.wait();
            return getRetryContract(instance);
        },
        'construcAndWait'
    )
}

export async function executeAndWait(func: () => Promise<TransactionResponse>) {
    return tryExecute(
        async () => {
            const tx = await func();
            return tx.wait();
        },
        'executeAndWait'
    )
}

export function formatTime() {
    return moment().format('YYYY-MM-DD HH:mm:ss');
}

export async function getSelfAddress() {
    return (await ethers.getSigners())[0].address;
}

// export function getTokenAddress(tokenName: string) {
//     let tokenAddress;
//     if(tokenName === 'ERA') {
//         const deployRecorder = DeployRecorder.getDeployRecorder();
//         tokenAddress = deployRecorder.recorder.era.address;
//     } else {
//         tokenAddress = getNetworkConfig().tokensDetail[tokenName].address;
//     }
//     if(!tokenAddress) throw new TaskParamWrongError('tokenName/earnedToken', tokenName, 'the token address is not in network config file.')
//     return tokenAddress;
// }

// export function getTokenName(tokenAddress: string) {
//     const tokensInfo = getNetworkConfig().tokensDetail;
//     for (const tokenName in tokensInfo) {
//         if(tokensInfo[tokenName].address.toUpperCase() === tokenAddress.toUpperCase()) return tokenName;
//     }
//     throw new TaskParamWrongError('tokenAddress', tokenAddress, 'the token name is not in network config file.')
// }

// export function getTokenDecimals(tokenName: string) {
//     if(tokenName === 'ERA') {
//         return 18;
//     }
//     return getNetworkConfig().tokensDetail[tokenName].decimals;
// }

// export function getReadableAmount(tokenName: string, amount: BigNumber | string, decimals?: number): number{
//     if(!decimals) decimals = getTokenDecimals(tokenName);
//     const accuracy: string = '1' + new Array(decimals).fill('0').join('');
//     return new BigNumberjs(amount.toString()).div(accuracy).toNumber();
// }

// export function getOriginAmount(tokenName: string, amount: number, decimals?: number): BigNumber {
//     if(!decimals) decimals = getTokenDecimals(tokenName);
//     const accuracy: string = '1' + new Array(decimals).fill('0').join('');
//     return BigNumber.from(new BigNumberjs(amount).multipliedBy(accuracy).toString(10).split('.')[0]);
// }

export async function getContractAt<ContractType>(contractName: string, address: string): Promise<ContractType & Contract> {
    const contract = await ethers.getContractAt(contractName, address);
    return <any>getRetryContract(contract);
}

export function is10Timestamp(time: number) {
    return time.toString().length === 10
}

export function getDifferent<T>(based: T[], news: T[]): {
    deleted: T[],
    added: T[]
} {
    const basedSet = new Set(based);
    const newsSet = new Set(news);

    for (const element of newsSet) {
        if(basedSet.has(element)) {
            basedSet.delete(element);
            newsSet.delete(element);
        }
    }

    return {
        deleted: [...basedSet],
        added: [...newsSet]
    }
}

function getRetryContract(originContract: Contract): Contract {
    const retryContract: any = {};
    // wrap Contract with retry
    for (const key in originContract) {
      const originFunc = originContract[key];
      if(typeof originFunc === 'function') {
          const retryFunc = (...args: any) => {
          const result = originFunc.bind(originContract)(...args);
          if(!types.isPromise(result)) {
            return result;
          }

          const errorHandler = (err : Error) => {
              if(
                  err.message.includes('timeout')
                  || err.message.includes('Time-out')
                  || err.message.includes('could not detect network')
                  || err.message.includes('502 Bad Gateway')
                  || err.message.includes('timed out')
                ) {
                return originFunc.bind(originContract)(...args);
              }
              throw err;
          }
          // retry twice
          return result
            .catch(errorHandler)
            .catch(errorHandler)
        }
        retryContract[key] = retryFunc;
      } else {
        retryContract[key] = originContract[key];
      }
    }
    return retryContract;
}

export const getEventArgument = async (
    contract: Contract,
    txHash: string,
    eventName: string,
    eventArg?: string
  ): Promise<any> => {
    const filterFn = contract.filters[eventName];
  
    if (!filterFn) {
      throw new Error(`Event ${eventName} not found in contract`);
    }
  
    const filter = filterFn();
    const events = await contract.queryFilter(filter);
    // Filter both by tx hash and event signature hash
    const [event] = events.filter(
      (event) =>
        event.transactionHash === txHash && event.topics[0] === filter.topics[0]
    );
  
    if (eventArg) {
      const argValue = event.args[eventArg];
  
      if (!argValue) {
        throw new Error(`Argument ${eventArg} not found in event ${eventName}`);
      }
  
      return argValue;
    } else {
      return event.args;
    }
  };

export const toDecimals = (
    amount: number | string,
    decimals = 18
): BigNumber => {
    const [integer, decimal] = String(amount).split(".");
    return BigNumber.from(
        (integer !== "0" ? integer : "") + (decimal || "").padEnd(decimals, "0") ||
        "0"
    );
};

export const pct16 = (x: number | string) => toDecimals(x, 16);

export function namehash(name: string): string {
    /* istanbul ignore if */
    if (typeof(name) !== "string") {
        throw new Error("invalid ENS name; not a string " + name);
    }

    let current = name;
    let result: string | Uint8Array = ZERO;
    while (current.length) {
        const partition = current.match(/^((.*)\.)?([^.]+)$/);
        if (partition == null || partition[2] === "") {
            throw new Error("invalid ENS address; missing component " + name);
        }
        const label = toUtf8Bytes(nameprep(partition[3]));
        result = keccak256(concat([result, keccak256(label)]));

        current = partition[2] || "";
    }

    return hexlify(result);
}