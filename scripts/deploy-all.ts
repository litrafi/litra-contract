import { getDeployConfig } from "./deploy-config";
import { BoostProxyDeployer } from "./deployer/dao/boost-proxy.deployer";
import { FeeManagerDeployer } from "./deployer/dao/fee-manager.deployer";
import { GaugeControllerDeployer } from "./deployer/dao/gauge-controller.deployer";
import { LADeployer } from "./deployer/dao/la.deployer";
import { MinterDeployer } from "./deployer/dao/minter.deployer";
import { VotingEscrowDeployer } from "./deployer/dao/voting-escrow.deployer";
import { VotingDeployer } from "./deployer/dao/voting.deployer";
import { NftVaultDeployer } from "./deployer/tokenize/nft-vault.deployer";
import { namehash, toDecimals } from "./lib/utils";

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
    // deploy voting
    const { dao } = getDeployConfig();
    await new VotingDeployer().getOrDeployInstance({
        appId: namehash(dao.appId),
        token: ve.address,
        supportRequiredPct: toDecimals(dao.supportRequiredPct, 16),
        minAcceptQuorumPct: toDecimals(dao.minAcceptQuorumPct, 16), 
        voteTime: dao.voteTime,
        minBalance: dao.minBalance,
        minTime: dao.minTime,
        minBalanceLowerLimit: dao.minBalanceLowerLimit,
        minBalanceUpperLimit: dao.minBalanceUpperLimit,
        minTimeLowerLimit: dao.minTimeLowerLimit,
        minTimeUpperLimit: dao.minTimeUpperLimit
    })
    await new BoostProxyDeployer().getOrDeployInstance({ ve: ve.address });
}

deployAll();