import { Contract } from 'ethers';
import { DeployRecorder } from "./deploy-recorder";
import { ContractNotDeployedError } from '../errors/contract-not-deployed-error';
import { getContractAt } from './utils';

export abstract class ContractDeployer<ContractType, DeployArgs> {
    public contractName: string;
    public recorderKey: string;

    constructor() {
        const {
            contractName,
            recorderKey
        } = this.getDeployerConfig();

        this.contractName = contractName;
        this.recorderKey = recorderKey || contractName;
    }

    protected abstract getDeployerConfig(): {
        contractName: string,
        recorderKey?: string
    };

    protected abstract _deploy(args: DeployArgs): Promise<string>;

    async deploy(args: DeployArgs) {
        const deployRecorder = DeployRecorder.getDeployRecorder();
        if(deployRecorder.recorder[this.recorderKey]) {
            console.log(`contract ${this.recorderKey} has been deployed, address: ` + deployRecorder.recorder[this.recorderKey].address)
            return;
        }
        const instanceAddr = await this._deploy(args).catch(err => {
            console.error(`${this.contractName} deploy failed!`)
            throw err;
        });
        if(instanceAddr) { 
            console.log(`${this.recorderKey} deploy succeed ! address: ${instanceAddr}`);
            deployRecorder.setRecord(this.recorderKey, instanceAddr);
        }
        deployRecorder.writeRecorder();
    }

    getInstance(): Promise<ContractType & Contract> {
        const deployRecorder = DeployRecorder.getDeployRecorder();
        if(deployRecorder.recorder[this.recorderKey]) {
            return getContractAt<ContractType>(this.contractName, deployRecorder.recorder[this.recorderKey].address)
        }
        throw new ContractNotDeployedError(this.recorderKey);
    }

    async getOrDeployInstance(deployArgs: DeployArgs): Promise<ContractType & Contract> {
        const deployRecoder = DeployRecorder.getDeployRecorder();
        if(!deployRecoder.recorder[this.recorderKey]) {
            await this.deploy(deployArgs);
            deployRecoder.readRecorder();
        }
        if(!deployRecoder.recorder[this.recorderKey]) {
            throw new Error(`getOrDeployInstance 部署失败!recorderKey: ${this.recorderKey}`)
        }
        return getContractAt<ContractType>(this.contractName, deployRecoder.recorder[this.recorderKey].address)
    }

    hasDeployed() {
        const deployRecorder = DeployRecorder.getDeployRecorder();
        return !!deployRecorder.recorder[this.recorderKey];
    }
}