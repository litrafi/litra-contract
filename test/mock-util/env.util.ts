import { ethers } from "hardhat";
import { DeployRecorder } from "../../scripts/lib/deploy-recorder";

export const MINUTE = 60;
export const DAY = 3600 * 24;
export const WEEK = 3600 * 24 * 7; 
export const YEAR = 3600 * 24 * 365; 

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