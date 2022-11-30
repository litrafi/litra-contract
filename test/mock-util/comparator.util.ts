import { BigNumber } from "ethers";
import { BigNumber as BigNumberJs } from "bignumber.js";
import { getContractAt } from "../../scripts/lib/utils";
import { ERC20 } from "../../typechain";
import { ZERO } from "../../scripts/lib/constant";
import { getBalance } from "./env.util";
import { expect } from "chai";

export class BalanceComparator {
    private beforeBalance: Map<string, BigNumber> = new Map();
    private afterBalance: Map<string, BigNumber> = new Map();

    // eslint-disable-next-line no-useless-constructor
    constructor(public readonly userAddress: string) {}

    private async getBalance(tokenAddress: string): Promise<BigNumber> {
        if(tokenAddress === ZERO ){
            return getBalance(this.userAddress);
        }
        const tokenContract = await getContractAt<ERC20>('@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20', tokenAddress);
        return tokenContract.balanceOf(this.userAddress);
    }

    static async getReadableAmount(tokenAddress: string, amount: BigNumber): Promise<number> {
        let decimals;
        if(tokenAddress === ZERO) {
            decimals = 18;
        } else {
            const tokenContract = await getContractAt<ERC20>('@openzeppelin/contracts/token/ERC20/ERC20.sol:ERC20', tokenAddress);
            decimals = await tokenContract.decimals();
        }
        
        return getReadableAmount(amount, decimals);
    }

    async setBeforeBalance(tokenAddress: string) {
        const balance = await this.getBalance(tokenAddress);
        this.beforeBalance.set(tokenAddress, balance);
    }

    async setAfterBalance(tokenAddress: string) {
        const balance = await this.getBalance(tokenAddress);
        this.afterBalance.set(tokenAddress, balance);
    }

    clear() {
        for (const [key] of this.beforeBalance) {
            this.beforeBalance.delete(key);
        }
        for (const [key] of this.afterBalance) {
            this.beforeBalance.delete(key);
        }
    }

    compare(tokenAddress: string) {
        const before = this.beforeBalance.get(tokenAddress);
        const after = this.afterBalance.get(tokenAddress);

        if(before === undefined) {
            throw new Error(`未注册操作前 ${tokenAddress}余额`);
        }
        if(after === undefined) {
            console.log(this.beforeBalance, this.afterBalance);
            throw new Error(`未注册操作后 ${tokenAddress}余额`);
        }

        return before.gt(after) ? before.sub(after) : after.sub(before);
    }

    async readableCompare(tokenAddress: string) {
        const diff = this.compare(tokenAddress);
        return BalanceComparator.getReadableAmount(tokenAddress, diff);
    }
}

export function getReadableAmount(amount: BigNumber, decimals: number = 18) {
    const divisor = 1 + new Array(decimals).fill('0').join('');
    return new BigNumberJs(amount.toString()).div(divisor).toNumber();
}