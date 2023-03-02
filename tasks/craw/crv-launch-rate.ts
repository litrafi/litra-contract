import { task } from "hardhat/config";
import axios from "axios";
import { BigNumber } from "ethers";
import { BigNumber as BigNumberJS } from "bignumber.js";
import { E18, YEAR } from "../../scripts/lib/constant";
import { writeFileSync } from "fs";
import { join } from "path";

export const WEEK = 3600 * 24 * 7;
const CURVE_CTL_ADDRESS: {[key in string]: string} = {
    mainnet: '0x2F50D538606Fa9EDD2B11E2446BEb18C9D5846bB'
}

const CURVE_CRV_ADDRESS : {[key in string]: string} = {
    mainnet: '0xD533a949740bb3306d119CC777fa900bA034cd52'
}

const RATE_REDUCTION_COEFFICIENT = BigNumber.from(10).pow(15).mul(1252);
const RATE_DENOMINATOR = BigNumber.from(E18)
const FIRT_EPOCH_TIME = 1597357048;

task('crv-launch-rate')
.addParam('pools')
.addParam('weeks')
.addOptionalParam('crvPrice')
.setAction(async ({pools, weeks, crvPrice}, hre) => {
    const gaugesInfo = await axios.get('https://api.curve.fi/api/getAllGauges')
        .then(result => result.data.data);
    const poolsArr = pools.split(',')
    const weekArr = weeks.split(',').sort(((a: number, b: number) => a-b))
    const choosedGauge: {[key in string]: string} = {};
    let rate: string = '0';
    for (const poolName in gaugesInfo) {
        if(rate === '0') {
            rate = gaugesInfo[poolName].gauge_data.inflation_rate;
        }
        for (const poolInput of poolsArr) {
            if(poolName.includes(poolInput)) {
                choosedGauge[poolName] = gaugesInfo[poolName].gauge;
            }
        }
    }
    const crvAddr = CURVE_CRV_ADDRESS[hre.network.name];
    if(crvAddr) {
        const crvContract = await hre.ethers.getContractAt('LA', crvAddr);
        let startEpochTime = await crvContract.start_epoch_time().then(t => t.toNumber());
        let rate = await crvContract.rate();
        const ctlAddress = CURVE_CTL_ADDRESS[hre.network.name];
        if(ctlAddress) {
            const ctlContract = await hre.ethers.getContractAt('GaugeController', ctlAddress)
            const rows: string[] = [
                ['Weeks', 'Pool', 'Weight', 'Inflation (CRV / second)', 'Rate (CRV / second)', 'Rate (CRV / Week)', 'Week Emission ($)'].join('\t')
            ];
            for (const week of weekArr) {
                const time = Math.floor(Date.now() / 1000) + WEEK - Number(week) * WEEK;
                if(time < startEpochTime) {
                    rate = rate.mul(RATE_DENOMINATOR).div(RATE_REDUCTION_COEFFICIENT)
                    startEpochTime = startEpochTime - YEAR;
                }
                for (const poolName in choosedGauge) {
                    const gaugeAddr = choosedGauge[poolName];
                    const weight = await ctlContract["gauge_relative_weight(address,uint256)"](gaugeAddr, time);
                    const gaugeRate = BigNumber.from(rate).mul(weight).div(E18);
                    const rateNumber = new BigNumberJS(gaugeRate.toString()).div(E18).toNumber();
                    const weekEmissions = rateNumber * WEEK;
                    const arr = [
                        Math.floor((time - FIRT_EPOCH_TIME) / WEEK) + `(${week})`,
                        poolName,
                        new BigNumberJS(weight.toString()).div(E18).multipliedBy(100).toFixed(2) + '%',
                        new BigNumberJS(rate.toString()).div(E18).toNumber(),
                        rateNumber.toString(),
                        weekEmissions.toString(),
                        crvPrice ? (Number(crvPrice) * weekEmissions).toString() : '0'
                    ]
                    rows.push(arr.join('\t'))
                }
            }
            writeFileSync(join(__dirname, 'output/crv-launch-rate.xlsx'), rows.join('\n'));
        } else {
            console.error('Curve controller address is not configured!')
        }
    } else {
        console.error('CRV address is not configured!')
    }
})