import { ethers } from "hardhat";
import { DeployRecorder } from "../../scripts/lib/deploy-recorder";

export function clear() {
    DeployRecorder.getDeployRecorder().clearTestRecorder();
}

export function getNowRoughly() {
    return Math.floor(Date.now() / 1000)
}

export function currentTime() {
    return ethers.provider.getBlock('last').then(b => b.timestamp);
}

export function fastForward(seconds: number) {
    return ethers.provider.send('evm_increaseTime', [seconds])
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