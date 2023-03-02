import { getNowRoughly } from "../../test/mock-util/env.util";
import { getDeployConfig } from "../deploy-config";
import { BoostProxyDeployer } from "../deployer/dao/boost-proxy.deployer";
import { FeeManagerDeployer } from "../deployer/dao/fee-manager.deployer";
import { GaugeControllerDeployer } from "../deployer/dao/gauge-controller.deployer";
import { LADeployer } from "../deployer/dao/la.deployer";
import { MinterDeployer } from "../deployer/dao/minter.deployer";
import { VotingEscrowDeployer } from "../deployer/dao/voting-escrow.deployer";
import { ANY_ENTITY, VotingDeployer } from "../deployer/dao/voting.deployer";
import { NftVaultDeployer } from "../deployer/tokenize/nft-vault.deployer";
import { ZERO } from "../lib/constant";
import { getSelfAddress, namehash, toDecimals } from "../lib/utils";
import { DeployConfig } from "../type";
import { FeeDistributorDeployer } from "./dao/fee-distributor.deployer";

export async function deployAll() {
    const self = await getSelfAddress();
    const vault = await new NftVaultDeployer().getOrDeployInstance({});
    const la = await new LADeployer().getOrDeployInstance({});
    const ve = await new VotingEscrowDeployer().getOrDeployInstance({ token: la.address, admin: self });
    const { dao } = getDeployConfig();
    const oVoting = await deployDAO('Ownership', 'Voting-Ownership', dao, ve.address, [ANY_ENTITY]);
    const pVoting = await deployDAO('Parameter', 'Voting-Parameter', dao, ve.address, [ANY_ENTITY]);
    const eVoting = await deployDAO('EmergencyDAO', 'Voting-Emergency', dao, ve.address, [self]);

    const gaugeController = await new GaugeControllerDeployer().getOrDeployInstance({
        token: la.address,
        ve: ve.address,
        admin: oVoting.address
    });
    await new MinterDeployer().deploy({ token: la.address, controller: gaugeController.address });
    const feeManager = await new FeeManagerDeployer().getOrDeployInstance({
        vault: vault.address,
        oAdmin: oVoting.address,
        pAdmin: pVoting.address,
        eAdmin: eVoting.address
    });
    await vault.setFeeManager(feeManager.address);
    // deploy voting
    await new BoostProxyDeployer().getOrDeployInstance({
        ve: ve.address,
        ownershipAdmin: oVoting.address,
        emergencyAdmin: eVoting.address,
        delegation: ZERO
    });
    await new FeeDistributorDeployer().getOrDeployInstance({
        ve: ve.address,
        starTime: getNowRoughly(),
        ownershipAdmin: oVoting.address,
        emergencyAdmin: eVoting.address
    })
}

async function deployDAO(
    type: string,
    appId: string,
    daoConfig: DeployConfig['dao'],
    token: string,
    members: string[]
) {
    const voting = await new VotingDeployer(type).getOrDeployInstance({
        members,
        token,
        appId: namehash(appId),
        supportRequiredPct: toDecimals(daoConfig.supportRequiredPct, 16),
        minAcceptQuorumPct: toDecimals(daoConfig.minAcceptQuorumPct, 16), 
        voteTime: daoConfig.voteTime,
        minBalance: daoConfig.minBalance,
        minTime: daoConfig.minTime,
        minBalanceLowerLimit: daoConfig.minBalanceLowerLimit,
        minBalanceUpperLimit: daoConfig.minBalanceUpperLimit,
        minTimeLowerLimit: daoConfig.minTimeLowerLimit,
        minTimeUpperLimit: daoConfig.minTimeUpperLimit
    });

    return voting
}