import { task } from "hardhat/config";
import { ZERO } from "../scripts/lib/constant";
import { DeployRecorder } from "./lib/deploy-recorder";
// goerli test lp: 0x435F78F51Ee7835495401f9D3c99b2a848fe4434
task('new-gauge')
.addParam('wnft')
.addParam('weth')
.addParam('deployer')
.addOptionalParam('minter')
.addOptionalParam('la')
.addOptionalParam('ve')
.addOptionalParam('controller')
.addOptionalParam('veBoostProxy')
.setAction(async (args, hre) => {
    const { wnft, weth } = args;
    let { minter, la, ve, controller, veBoostProxy, deployer } = args;

    const recorder = DeployRecorder.getDeployRecorder(hre.network.name);
    minter = minter || recorder.getContractAddr('Minter');
    la = la || recorder.getContractAddr('LA');
    ve = ve || recorder.getContractAddr('VotingEscrow');
    controller = controller || recorder.getContractAddr('GaugeController');
    veBoostProxy = veBoostProxy || recorder.getContractAddr('VEBoostProxy');
    const poolDeployer = await hre.ethers.getContractAt('PoolDeployer', deployer);
    const poolAddr = await poolDeployer["find_pool_for_coins(address,address)"](wnft, weth);
    if(poolAddr === ZERO) {
        console.log('Can not find the pool')
        return;
    }
    const pool = await hre.ethers.getContractAt('PoolImpl', poolAddr);
    const lpToken = await pool.token();

    const LiquidityGauge = await hre.ethers.getContractFactory('LiquidityGaugeV5');
    const gauge = await LiquidityGauge.deploy(
        lpToken,
        la,
        controller,
        minter,
        veBoostProxy,
        ve
    )
    console.log(`Gauge is deployed: ${gauge.address}`);
})