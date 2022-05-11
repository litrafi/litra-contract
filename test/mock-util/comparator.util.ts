import { BigNumber } from "ethers";
import { BigNumber as BigNumberJs } from "bignumber.js";
import { getContractAt } from "../../scripts/lib/utils";
import { ERC20 } from "../../typechain";

export class BalanceComparator {
    private beforeBalance: Map<string, BigNumber> = new Map();
    private afterBalance: Map<string, BigNumber> = new Map();

    private async getBalance(tokenAddress: string, userAddress: string): Promise<BigNumber> {
        const tokenContract = await getContractAt<ERC20>('ERC20', tokenAddress);
        return tokenContract.balanceOf(userAddress);
    }

    static async getReadableAmount(tokenAddress: string, amount: BigNumber): Promise<number> {
        const tokenContract = await getContractAt<ERC20>('ERC20', tokenAddress);
        const decimals = await tokenContract.decimals();
        const divisor = 1 + new Array(decimals).fill('0').join('');
        return new BigNumberJs(amount.toString()).div(divisor).toNumber();
    }

    async setBeforeBalance(tokenAddress: string, userAddress: string) {
        const balance = await this.getBalance(tokenAddress ,userAddress);
        this.beforeBalance.set(tokenAddress, balance);
    }

    async setAfterBalance(tokenAddress: string, userAddress: string) {
        const balance = await this.getBalance(tokenAddress, userAddress);
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