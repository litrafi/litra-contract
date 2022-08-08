import { task } from "hardhat/config";

task('mint-nft')
.addParam('account', 'reciever', '0xc595C9Fa22F4aAE187cD468a01aD4273D6f1AdB6')
.addParam('nft', 'address of nft', '0x2d6d72f813a4546b53661341e0Bbb0e9fd45D09f')
.addParam('amount', 'amount of nfts', '1')
.setAction(async ({ account, nft, amount }, hre) => {
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