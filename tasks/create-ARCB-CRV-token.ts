import { task } from "hardhat/config";

task('create-ARCB-CRV-token')
.addParam('voterAccount')
.addParam('rewardLockedPercent')
.addParam('booster', 'address of booster', '0xF403C135812408BFbE8713b5A23a04b3D48AAE31')
.addParam('boosterPoolId')
.addParam('crv', 'address of CRV', '0xD533a949740bb3306d119CC777fa900bA034cd52')
.addParam('cvx', 'address of CVX', '0x4e3FBD56CD56c3e72c1403e103b45Db9da5B9D2B')
.setAction(async ({
    voterAccount,
    rewardLockedPercent,
    booster,
    boosterPoolId,
    crv,
    cvx
}, hre) => {
    const ArchebaseCurveToken = await hre.ethers.getContractFactory('ArchebaseCurveToken');
    const token = await hre.upgrades.deployProxy(ArchebaseCurveToken, [
        voterAccount,
        rewardLockedPercent,
        booster,
        boosterPoolId,
        crv,
        cvx
    ]);
    console.log(`Deploy succeed: ${token.address}`);
})