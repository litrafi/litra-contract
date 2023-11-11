import { task } from "hardhat/config";
import { DeployRecorder } from "./lib/deploy-recorder";

task('set-wrap-fee')
.addParam('wnft')
.addParam('fee')
.setAction(async (args, hre) => {
    const deployRecorder = DeployRecorder.getDeployRecorder(hre.network.name);
    const feeManagerAddr = deployRecorder.getContractAddr('FeeManager');
    const feeManagerContract = await hre.ethers.getContractAt('FeeManager', feeManagerAddr);
    await feeManagerContract.setWrapFee(args.wnft, args.fee);
})