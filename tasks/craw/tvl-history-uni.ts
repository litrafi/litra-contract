import BigNumber from "bignumber.js";
import { writeFileSync } from "fs";
import { task } from "hardhat/config";
import { join } from "path";
import { E18 } from "../../scripts/lib/constant";

const FACTORY_ADDR: {[key in string]: string} = {
    mainnet: '0x1F98431c8aD98523631AE4a59f267346ea31F984'
}

task('tvl-history-uni')
.addParam('token0')
.addParam('token1')
.addParam('fee')
.addParam('interval')
.addParam('count')
.addParam('price0')
.addParam('price1')
.addOptionalParam('endBlock')
.setAction(async ({token0, token1, fee, interval, count, price0, price1, endBlock}, hre) => {
    interval = Number(interval);
    count = Number(count);
    count = count < 0 ? 0 :count;
    const blockNumberInterval = Number(interval) / 12;

    token0 = await hre.ethers.getContractAt('IERC20', token0);
    token1 = await hre.ethers.getContractAt('IERC20', token1);
    const factory = FACTORY_ADDR[hre.network.name];
    if(!factory) {
        throw new Error('Factory address is not configured!')
    }
    const ABI = [
        "function getPool(address token0, address token1, uint24 fee)"
    ]
    const data = new hre.ethers.utils.Interface(ABI).encodeFunctionData('getPool', [token0.address, token1.address, fee])
    const poolAddr = await hre.ethers.provider.call({
        to: factory,
        data
    }).then(rawData => hre.ethers.utils.defaultAbiCoder.decode(['address'], rawData)[0])
    const now = Date.now();
    let blockNumber = await hre.ethers.provider.getBlockNumber();
    const rows = ['Time\tTVL ($)'];
    
    for (let index = 0; index < count; index++) {
        blockNumber = endBlock && blockNumber < Number(endBlock) ? Number(endBlock) : blockNumber;
        const balance0 = await token0.balanceOf(poolAddr, { blockTag: blockNumber});
        const balance1 = await token1.balanceOf(poolAddr, { blockTag: blockNumber});
        const tvl0 = new BigNumber(balance0.toString()).div(E18).multipliedBy(price0).toNumber();
        const tvl1 = new BigNumber(balance1.toString()).div(E18).multipliedBy(price1).toNumber();
        rows.push(`${new Date(now - interval * index * 1000)}\t${tvl0 + tvl1}`)
        blockNumber -= blockNumberInterval;
    }
    writeFileSync(join(__dirname, 'output/tvl-history-uni.xlsx'), rows.join('\n'));
})