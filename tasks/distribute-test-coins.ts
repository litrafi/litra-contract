import { BigNumber } from "ethers";
import { task } from "hardhat/config";
import { E18 } from "../scripts/lib/constant";

task('distribute-test-coins')
.addParam('account')
.setAction(async ({ account }, hre) => {
    const ETH_AMOUNT = BigNumber.from(E18).mul(10);

    const self = await hre.ethers.getSigners().then(arr => arr[0]);
    await self.sendTransaction({
        to: account,
        value: ETH_AMOUNT
    })
})