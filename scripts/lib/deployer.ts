import { Contract } from 'ethers';
import { DeployRecorder } from "./deploy-recorder";
import { ContractNotDeployedError } from '../errors/contract-not-deployed-error';
import { construcAndWait, getContractAt } from './utils';

export abstract class ContractDeployer<ContractType, DeployArgs> {
    protected abstract getContractName(): string;

    protected getDeployArgsArr(args: DeployArgs): any[] {
        return [];
    }

    protected getRecordKey(): string {
        return this.getContractName();
    }

    protected async _deploy(args: DeployArgs): Promise<string> {
        const instance = await construcAndWait<ContractType>(this.getContractName(), this.getDeployArgsArr(args));
        return instance.address;
    }

    async deploy(args: DeployArgs) {
        const contractName = this.getContractName();
        const recordKey = this.getRecordKey();
        const deployRecorder = DeployRecorder.getDeployRecorder();
        if(deployRecorder.recorder[recordKey]) {
            console.log(`contract ${recordKey} has been deployed, address: ` + deployRecorder.recorder[recordKey].address)
            return;
        }
        const instanceAddr = await this._deploy(args).catch(err => {
            console.error(`${contractName} deploy failed!`)
            throw err;
        });
        if(instanceAddr) { 
            console.log(`${recordKey} deploy succeed ! address: ${instanceAddr}`);
            deployRecorder.setRecord(recordKey, instanceAddr);
        }
        deployRecorder.writeRecorder();
    }

    getInstance(): Promise<ContractType & Contract> {
        const deployRecorder = DeployRecorder.getDeployRecorder();
        const recordKey = this.getRecordKey();
        const contractName = this.getContractName();
        if(deployRecorder.recorder[recordKey]) {
            return getContractAt<ContractType>(contractName, deployRecorder.recorder[recordKey].address)
        }
        throw new ContractNotDeployedError(recordKey);
    }

    async getOrDeployInstance(deployArgs: DeployArgs): Promise<ContractType & Contract> {
        const deployRecoder = DeployRecorder.getDeployRecorder();
        const recordKey = this.getRecordKey();
        const contractName = this.getContractName();
        if(!deployRecoder.recorder[recordKey]) {
            await this.deploy(deployArgs);
            deployRecoder.readRecorder();
        }
        if(!deployRecoder.recorder[recordKey]) {
            throw new Error(`getOrDeployInstance 部署失败!recorderKey: ${recordKey}`)
        }
        return getContractAt<ContractType>(contractName, deployRecoder.recorder[recordKey].address)
    }

    hasDeployed() {
        const deployRecorder = DeployRecorder.getDeployRecorder();
        const recordKey = this.getRecordKey();
        return !!deployRecorder.recorder[recordKey];
    }
}