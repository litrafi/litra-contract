import { ethers } from "hardhat";
import { DeployRecorder } from "../../scripts/lib/deploy-recorder";

export function clear() {
    DeployRecorder.getDeployRecorder().clearTestRecorder();
}

export function getNowRoughly() {
    return Math.floor(Date.now() / 1000)
}

export async function currentTime() {
    const blockNum = await ethers.provider.getBlockNumber();
    return ethers.provider.getBlock(blockNum).then(b => b.timestamp);
}

export async function fastForward(seconds: number) {
    await ethers.provider.send('evm_increaseTime', [seconds]);
    await ethers.provider.send('evm_mine', []);
}

export async function fastForwardTo(time: number) {
    const now = await currentTime();
    if(time <= now) {
        throw new Error('Too early time: ' + time);
    }
    await fastForward(time - now);
}

export function getBalance(user: string) {
    return ethers.provider.getBalance(user);
}