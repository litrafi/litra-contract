import { task } from "hardhat/config";

task('get-contract-size')
.addParam('contract', 'name of contract')
.setAction(async ({contract} , hre) => {
    const Contract = await hre.ethers.getContractFactory(contract);
    console.log(`${contract} code size: ${Contract.bytecode.length / 2 / 1024} Kb`);
})