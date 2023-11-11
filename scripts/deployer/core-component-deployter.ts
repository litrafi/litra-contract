import { ethers } from "hardhat";
import { FeeManagerDeployer } from "./dao/fee-manager.deployer";
import { BatchProxyDeployer } from "./tokenize/batch-proxy.deployer";
import { NFTVaultDeployer } from "./tokenize/nft-vault.deployer";

export async function deployCoreComponent() {
    const admin = await ethers.getSigners().then(arr => arr[0].address);
    const valut = await new NFTVaultDeployer().getOrDeployInstance({})
    await new BatchProxyDeployer().getOrDeployInstance({ vault: valut.address })
    await new FeeManagerDeployer().getOrDeployInstance({
        vault: valut.address,
        oAdmin: admin,
        pAdmin: admin,
        eAdmin: admin
    });
}