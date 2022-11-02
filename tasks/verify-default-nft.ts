import { task } from "hardhat/config";

task('verify-default-nft')
.addParam('addr', "address of nft")
.setAction(async ({ addr }, hre) => {
    await hre.run('verify:verify', {
        address: addr,
        constructorArguments: ['Archebase Test Nfts', 'ATN', 'https://archebase.com/metadata/']
    })
})