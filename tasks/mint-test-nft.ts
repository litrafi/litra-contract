import { task } from "hardhat/config";

task('mint-nft')
.addOptionalParam('account', 'reciever')
.addParam('nft', 'address of nft', '0x2d6d72f813a4546b53661341e0Bbb0e9fd45D09f')
.addParam('amount', 'amount of nfts', '1')
.setAction(async ({ account, nft, amount }, hre) => {
    if(!account) {
        account = await hre.ethers.getSigners().then(r => r[0].address)
    }
    const nftContract = await hre.ethers.getContractAt('Nft', nft);
    amount = Number(amount);
    for (let index = 0; index < amount; index++) {
        console.log('Start Mint')
        const tx = await nftContract.mint(account);
        console.log('Wait Minting')
        await tx.wait();
        console.log(`Minted: ${index+1}`)
    }
})