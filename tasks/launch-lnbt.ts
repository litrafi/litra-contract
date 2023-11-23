import { task } from "hardhat/config";

task('launch-lnbt')
.addParam('uri')
.addParam('mintAmount', 'how many NFT will be minted now')
.addOptionalParam('receiver')
.setAction(async ({ uri, mintAmount, receiver }, hre) => {
    const constructorArguments = ['Litra NFT for Beta Testing', 'LNBT', uri];
    const Nft = await hre.ethers.getContractFactory('Nft');
    const nft = await Nft.deploy(...constructorArguments);
    await nft.deployTransaction.wait();
    console.log(`NFT deployed: ${nft.address}`);
    // await sleep(waitSeconds * 1000);
    // console.log('Wake up');
    if(!mintAmount || !receiver) {
        return;
    }
    console.log(`Will mint ${mintAmount} to ${receiver}`)
    for (let index = 0; index < mintAmount; index++) {
        console.log(`Start to mint ${index + 1}th`)
        await nft.mint(receiver, index);
        console.log(`${index + 1}th was minted successfully!`)
    }
    
    // await hre.run('verify:verify', {
    //     address: nft.address,
    //     constructorArguments
    // })
    // console.log('Nft verified');
})

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), ms);
    })
}