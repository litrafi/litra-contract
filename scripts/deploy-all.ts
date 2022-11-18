import { ethers } from "hardhat";
import { FeeManagerDeployer } from "./deployer/dao/fee-manager.deployer";
import { GaugeControllerDeployer } from "./deployer/dao/gauge-controller.deployer";
import { LADeployer } from "./deployer/dao/la.deployer";
import { MinterDeployer } from "./deployer/dao/minter.deployer";
import { VotingEscrowDeployer } from "./deployer/dao/voting-escrow.deployer";
import { NftVaultDeployer } from "./deployer/tokenize/nft-vault.deployer";

export async function deployAll() {
    const vault = await new NftVaultDeployer().getOrDeployInstance({});
    const la = await new LADeployer().getOrDeployInstance({});
    const ve = await new VotingEscrowDeployer().getOrDeployInstance({ token: la.address});
    const gaugeController = await new GaugeControllerDeployer().getOrDeployInstance({ token: la.address, ve: ve.address });
    await new MinterDeployer().deploy({ token: la.address, controller: gaugeController.address });
    const feeManager = await new FeeManagerDeployer().getOrDeployInstance({
        vault: vault.address
    });
    await vault.setFeeManager(feeManager.address);
}

deployAll();