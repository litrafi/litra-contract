import { task } from "hardhat/config";
import { boolean } from "hardhat/internal/core/params/argumentTypes";

task('launch-default-nft')
.addOptionalParam('mint', 'Whether to min one', false, boolean)
.setAction(async ({ mint }, hre) => {
    const constructorArguments = ['Archebase Test Nfts', 'ATN', 'https://archebase.com/metadata/'];
    const Nft = await hre.ethers.getContractFactory('Nft');
    const nft = await Nft.deploy(...constructorArguments);
    const waitSeconds = 60;
    console.log(`Nft deployed: ${nft.address}, wait ${waitSeconds} seconds`);
    await sleep(waitSeconds * 1000);
    console.log('Wake up');
    if(mint) {
        const account = await hre.ethers.getSigners().then(r => r[0].address)
        await nft.mint(account)
    }
    
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