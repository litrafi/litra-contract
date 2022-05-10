import {
  readFileSync,
  writeFileSync,
  existsSync,
  mkdirSync,
  unlinkSync,
} from "fs";
import { join } from "path";
import moment from "moment";
import { isTestEnv } from "../network-config";
import { network as blockNetwork } from "hardhat";

export class DeployRecorder {
  public recorder: any;
  public recorderFilePath: string;
  private static _deployRecorder: DeployRecorder;

  private constructor() {
    const network = blockNetwork.name;
    if (!network){
      throw Error("[DeployRecorder]: invalid network: " + network);
    }

    this.recorderFilePath = join(
      __dirname,
      "..",
      "deployed",
      "deployed-contract",
      `${network}_deployed_contract_info.json`
    );
    this.recorder = {};
    this.readRecorder();
  }

  static getDeployRecorder() {
    if(this._deployRecorder === undefined) {
      this._deployRecorder = new DeployRecorder();
    }
    return this._deployRecorder;
  }

  readRecorder() {
    if (!existsSync(this.recorderFilePath)) {
      mkdirSync(join(this.recorderFilePath, "../"), { recursive: true });
      writeFileSync(this.recorderFilePath, "{}");
    }
    this.recorder = JSON.parse(readFileSync(this.recorderFilePath).toString());
  }

  writeRecorder() {
    writeFileSync(
      this.recorderFilePath,
      JSON.stringify(this.recorder, null, "\t")
    );
  }

  setRecord(contractName: string, address: string) {
    this.recorder[contractName] = {
      address,
      time: moment().format("YYYY-MM-DD HH:mm:ss"),
    };
  }

  printDeployRecord(contractName: string, address: string) {
    console.log(`${contractName} deploy succeed ! address: ${address}`);
  }

  clearTestRecorder() {
    if (!isTestEnv()) throw new Error("非测试环境不得删除部署记录");
    unlinkSync(this.recorderFilePath);
    this.readRecorder();
  }
}
