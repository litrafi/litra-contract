import { ethers } from 'hardhat';
import { TaskLogger } from './utils/log.util';

export async function deployAll() {
    const NFTVault = await ethers.getContractFactory('NFTVault');
    const BatchProxy = await ethers.getContractFactory('BatchProxy');
    const logger = new TaskLogger();
    
    const nftVault = await NFTVault.deploy();
    await logger.logDeployment('NFTVault', nftVault);
    const batchProxy = await BatchProxy.deploy(nftVault.getAddress());
    await logger.logDeployment('BatchProxy', batchProxy);

    return {nftVault, batchProxy}
}