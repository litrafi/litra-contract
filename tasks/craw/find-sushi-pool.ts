import { task } from "hardhat/config";

const MASTER_ADDR: {
    [key in string]: string
} = {
    mainnet: '0xc2EdaD668740f1aA35E4D8f227fB8E17dcA888Cd'
}

task('find-sushi-pool')
.addParam('pair')
.setAction(async ({pair}, hre)  => {
    const masterAddr = MASTER_ADDR[hre.network.name];
    if(!masterAddr) {
        throw new Error('Master chef is not configured!')
    }
    const contractInterface = new hre.ethers.utils.Interface([
        'function poolLength()',
        'function poolInfo(uint256 id)'
    ])
    const poolLength = await hre.ethers.provider.call({
        to: masterAddr,
        data: contractInterface.encodeFunctionData('poolLength')
    })
        .then(result => hre.ethers.utils.defaultAbiCoder.decode(['uint256'], result)[0])
        .then(bn => bn.toNumber())
    console.log('pool length', poolLength)
    for (let index = 0; index < poolLength; index++) {
        const [
            lpToken, allocPoint, lastRewardBlock, accSushiPerShare
        ] = await hre.ethers.provider.call({
            to: masterAddr,
            data: contractInterface.encodeFunctionData('poolInfo', [index])
        })
            .then(result => hre.ethers.utils.defaultAbiCoder.decode(['address', 'uint256', 'uint256', 'uint256'], result))
        console.log(index, lpToken, pair)
        if(lpToken.toLocaleLowerCase() === pair.toLocaleLowerCase()) {
            console.log('Find pool id:', index, {
                allocPoint, lastRewardBlock, accSushiPerShare
            });
            break;
        }
    }
    console.log('The pair is not there')
})