import { ethers } from "hardhat";
import { construcAndWait } from "../../scripts/lib/utils";
import { MockERC20 } from "../../typechain";

export async function mockCurveEnv() {
    const MockERC20 = await ethers.getContractFactory('MockERC20');
    const MockRewards = await ethers.getContractFactory('MockRewards');
    const MockBooster = await ethers.getContractFactory('MockBooster');

    const crv = await construcAndWait<MockERC20>(MockERC20, ['CRV', 'CRV']);
    const cvx = await construcAndWait<MockERC20>(MockERC20, ['CVX', 'CVX']);
    const metaToken = await construcAndWait<MockERC20>(MockERC20, ['MetaLp', 'MetaLp']);
    const convexLiquidity =await construcAndWait<MockERC20>(MockERC20, ['Convex Liquidity', 'CL']);

    const booster = await MockBooster.deploy();
    const rewards = await MockRewards.deploy(convexLiquidity.address, crv.address, cvx.address, booster.address, 0);
    await booster.addPool(metaToken.address, convexLiquidity.address, rewards.address);

    return {
        crv,
        cvx,
        metaToken,
        convexLiquidity,
        booster,
        rewards,
    }
}