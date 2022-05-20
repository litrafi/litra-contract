import { readFileSync } from "fs";
import { task } from "hardhat/config";
import { getDeployedRecordFilePath } from "../constant";

task("upgrade-contract")
.addParam('recordKey', "record key in deployed file")
.addOptionalParam('contractName', "name of contract")
.setAction(async (args, hre) => {
    const filePath = getDeployedRecordFilePath(hre.network.name);
    const records = JSON.parse(readFileSync(filePath).toString());
    const contractName = args.contractName ? args.contractName : args.recordKey;
    const factory = await hre.ethers.getContractFactory(contractName);
    const record = records[args.recordKey];
    await hre.upgrades.upgradeProxy(record.address, factory);
    console.log(`Upgrade successful ${contractName}: ${record.address}`);
})