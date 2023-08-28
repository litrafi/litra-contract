import { ethers } from "hardhat";
import { PoolDeployer } from "../../typechain";
import { construcAndWait } from "../lib/utils";

export async function mockCurve() {
    const self = await ethers.getSigners().then(r => r[0].address);
    const weth = await construcAndWait('WETH');
    const poolImpl = await construcAndWait('PoolImpl', [weth.address]);
    const tokenImpl = await construcAndWait('TokenImpl');
    const gaugeImpl = await construcAndWait('GaugeImpl');
    const poolDeployer = await construcAndWait<PoolDeployer>('PoolDeployer', [
        self,
        poolImpl.address,
        tokenImpl.address,
        gaugeImpl.address,
        weth.address
    ]);

    console.log('Pool Deployer: ', poolDeployer.address)
    console.log('WETH: ', weth.address)

    return {
        poolDeployer,
        weth
    }
}