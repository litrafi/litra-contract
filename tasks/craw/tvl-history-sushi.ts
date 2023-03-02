import BigNumber from "bignumber.js";
import { writeFileSync } from "fs";
import { task } from "hardhat/config";
import { join } from "path";
import { E18 } from "../../scripts/lib/constant";

task('tvl-history-sushi')
.addParam('pairAddr')
.addParam('token0')
.addParam('token1')
.addParam('price0')
.addParam('price1')
.addParam('interval')
.addParam('count')
.addOptionalParam('endBlock')
.setAction(async ({pairAddr, token0, token1, interval, count, price0, price1, endBlock}, hre) => {
    interval = Number(interval);
    count = Number(count);
    count = count < 0 ? 0 :count;
    const blockNumberInterval = Number(interval) / 12;

    token0 = await hre.ethers.getContractAt('IERC20', token0);
    token1 = await hre.ethers.getContractAt('IERC20', token1);

    const now = Date.now();
    let blockNumber = await hre.ethers.provider.getBlockNumber();
    const rows = ['Time\tTVL ($)'];
    
    for (let index = 0; index < count; index++) {
        blockNumber = endBlock && blockNumber < Number(endBlock) ? Number(endBlock) : blockNumber;
        const balance0 = await token0.balanceOf(pairAddr, { blockTag: blockNumber});
        const balance1 = await token1.balanceOf(pairAddr, { blockTag: blockNumber});
        const tvl0 = new BigNumber(balance0.toString()).div(E18).multipliedBy(price0).toNumber();
        const tvl1 = new BigNumber(balance1.toString()).div(E18).multipliedBy(price1).toNumber();
        rows.push(`${new Date(now - interval * index * 1000)}\t${tvl0 + tvl1}`)
        blockNumber -= blockNumberInterval;
    }
    writeFileSync(join(__dirname, 'output/tvl-history-sushi.xlsx'), rows.join('\n'));
})