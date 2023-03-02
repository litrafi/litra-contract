import { writeTestDeployConfig } from "../../scripts/deploy-config";
import { ALPHA_DEPLOY_CONFIG } from "../../scripts/deploy-config/alpha.config";
import { BoostProxyDeployer } from "../../scripts/deployer/dao/boost-proxy.deployer";
import { GaugeControllerDeployer } from "../../scripts/deployer/dao/gauge-controller.deployer";
import { LADeployer } from "../../scripts/deployer/dao/la.deployer";
import { MinterDeployer } from "../../scripts/deployer/dao/minter.deployer";
import { VotingEscrowDeployer } from "../../scripts/deployer/dao/voting-escrow.deployer";
import { deployAll } from "../../scripts/deployer/litra-deployer";
import { construcAndWait } from "../../scripts/lib/utils"
import { LiquidityGaugeV5, MockERC20 } from "../../typechain";
import { clear } from "../mock-util/env.util";

describe('Gauge', () => {
    it('Deploy gauge', async () => {
        clear();
        writeTestDeployConfig(ALPHA_DEPLOY_CONFIG);
        await deployAll();

        const wnft = await construcAndWait<MockERC20>('MockERC20', ['Wrapped NFT', 'WNFT']);
        const la = await new LADeployer().getInstance();
        const gaugeCtl = await new GaugeControllerDeployer().getInstance();
        const minter = await new MinterDeployer().getInstance();
        const boostProxy = await new BoostProxyDeployer().getInstance();
        const ve = await new VotingEscrowDeployer().getInstance();

        await construcAndWait<LiquidityGaugeV5>('LiquidityGaugeV5', [
            wnft.address,
            la.address,
            gaugeCtl.address,
            minter.address,
            boostProxy.address,
            ve.address
        ]);
    })
})