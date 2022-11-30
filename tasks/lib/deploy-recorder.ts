import {
    readFileSync,
    existsSync,
  } from "fs";
import { getDeployedRecordFilePath } from "../../constant";

export class DeployRecorder {
    public recorder: any;
    public recorderFilePath: string;
    private static _deployRecorder: DeployRecorder;

    private constructor(network: string) {
        if (!network){
            throw Error("[DeployRecorder]: invalid network: " + network);
        }

        this.recorderFilePath = getDeployedRecordFilePath(network.toString());
        this.recorder = {};
        this.readRecorder();
    }

    static getDeployRecorder(network: string) {
        if(this._deployRecorder === undefined) {
            this._deployRecorder = new DeployRecorder(network);
        }
        return this._deployRecorder;
    }

    readRecorder() {
        if (!existsSync(this.recorderFilePath)) {
            throw new Error(`No record file: ${this.recorderFilePath}`)
        }
        this.recorder = JSON.parse(readFileSync(this.recorderFilePath).toString());
    }

    getContractAddr(recordKey: string) {
        const record = this.recorder[recordKey];
        if(!record) {
            throw new Error(`Contract ${recordKey} was not deployed`);
        }
        return record.address;
    }
}
  