import { task } from "hardhat/config";

task('mint-nft')
.addParam('account', 'reciever', '0xc595C9Fa22F4aAE187cD468a01aD4273D6f1AdB6')
.addParam('nft', 'address of nft', '0x2d6d72f813a4546b53661341e0Bbb0e9fd45D09f')
.setAction(async ({ account, nft }, hre) => {
    const nftContract = await hre.ethers.getContractAt('Nft', nft);
    await nftContract.mint(account);
})