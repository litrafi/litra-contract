import { task } from "hardhat/config";

task('launch-default-nft', async (args, hre) => {
    const constructorArguments = ['Archebase Test Nfts', 'ATN', 'https://archebase.com/metadata/'];
    const Nft = await hre.ethers.getContractFactory('Nft');
    const nft = await Nft.deploy(...constructorArguments);
    const waitSeconds = 60;
    console.log(`Nft deployed: ${nft.address}, wait ${waitSeconds} seconds`);
    await sleep(waitSeconds * 1000);
    console.log('Wake up');
    await hre.run('verify:verify', {
        address: nft.address,
        constructorArguments
    })
    console.log('Nft verified');
})

function sleep(ms: number) {
    return new Promise<void>((resolve) => {
        setTimeout(() => resolve(), ms);
    })
}