import { task } from "hardhat/config";
import { DeployRecorder } from "./lib/deploy-recorder";
// goerli test lp: 0x435F78F51Ee7835495401f9D3c99b2a848fe4434
task('new-gauge')
.addParam('lpToken')
.addOptionalParam('admin')
.addOptionalParam('minter')
.addOptionalParam('la')
.addOptionalParam('ve')
.addOptionalParam('controller')
.addOptionalParam('veBoostProxy')
.setAction(async (args, hre) => {
    const { lpToken } = args;
    let { admin, minter, la, ve, controller, veBoostProxy } = args;
    const self = await hre.ethers.getSigners().then(arr => arr[0].address);

    const recorder = DeployRecorder.getDeployRecorder(hre.network.name);
    admin = admin || self;
    minter = minter || recorder.getContractAddr('Minter');
    la = la || recorder.getContractAddr('LA');
    ve = ve || recorder.getContractAddr('VotingEscrow');
    controller = controller || recorder.getContractAddr('GaugeController');
    veBoostProxy = veBoostProxy || recorder.getContractAddr('VEBoostProxy');

    const LiquidityGauge = await hre.ethers.getContractFactory('LiquidityGauge');
    const gauge = await LiquidityGauge.deploy(
        lpToken,
        admin,
        minter,
        la,
        ve,
        controller,
        veBoostProxy
    )
    console.log(`Gauge is deployed: ${gauge.address}`);
})