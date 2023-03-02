import BigNumber from "bignumber.js";
import { writeFileSync } from "fs";
import { task } from "hardhat/config";
import { join } from "path";
import { E18 } from "../../scripts/lib/constant";

task('tvl-history-curve')
.addParam('poolAddr')
.addParam('interval')
.addParam('count')
.addParam('price0')
.addParam('price1')
.addOptionalParam('endBlock')
.setAction(async ({poolAddr, interval, count, price0, price1, endBlock}, hre) => {
    interval = Number(interval);
    count = Number(count);
    count = count < 0 ? 0 :count;
    const blockNumberInterval = Number(interval) / 12;

    const pool = await hre.ethers.getContractAt('PoolImpl', poolAddr);
    const now = Date.now();
    let blockNumber = await hre.ethers.provider.getBlockNumber();
    const rows = ['Time\tTVL ($)'];
    
    for (let index = 0; index < count; index++) {
        blockNumber = endBlock && blockNumber < Number(endBlock) ? Number(endBlock) : blockNumber;
        const balance0 = await pool.balances(0, { blockTag: blockNumber});
        const balance1 = await pool.balances(1, { blockTag: blockNumber});
        const tvl0 = new BigNumber(balance0.toString()).div(E18).multipliedBy(price0).toNumber();
        const tvl1 = new BigNumber(balance1.toString()).div(E18).multipliedBy(price1).toNumber();
        rows.push(`${new Date(now - interval * index * 1000)}\t${tvl0 + tvl1}`)
        blockNumber -= blockNumberInterval;
    }
    writeFileSync(join(__dirname, 'output/tvl-history-curve.xlsx'), rows.join('\n'));
})