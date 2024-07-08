import { ethers, upgrades } from "hardhat";
import { expect } from "chai";
import { NFTVaultV2 } from "../../typechain-types";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";

describe('NFTVaultV2', () => {
    const deployed = async () => {
        const signers = await ethers.getSigners();
        const admin = signers[0];

        const NFTVaultV2 = await ethers.getContractFactory('NFTVaultV2');
        const NFT = await ethers.getContractFactory('MockNFT');

        const nftVaultV2 = <NFTVaultV2><unknown>await upgrades.deployProxy(NFTVaultV2);
        const nft = await NFT.deploy('', '');
        
        return {
            signers,
            admin,
            nftVaultV2,
            nft
        }
    }

    it('wrap and unwrap', async () => {
        const {
            signers,
            nftVaultV2,
            nft
        } = await loadFixture(deployed);
        const user = signers[1];
        await nft.mint(user, 0);
        // wrap
        await nft.connect(user).approve(nftVaultV2, 0);
        await nftVaultV2.connect(user).createAndWrap(nft, 0, 'wnft', 'wnft');
        const wnftAddr = await nftVaultV2.nftToWNFT(nft);
        expect(wnftAddr).not.eq(ethers.ZeroAddress);
        const wnft = await ethers.getContractAt('WrappedNFT', wnftAddr);
        await expect(wnft.balanceOf(user)).eventually.eq(ethers.parseEther('1'));
        await expect(nft.ownerOf(0)).eventually.eq(await nftVaultV2.getAddress());
        // unwrap
        await wnft.connect(user).approve(nftVaultV2, ethers.parseEther('1'));
        await nftVaultV2.connect(user).unwrap(nft, 0);
        await expect(wnft.balanceOf(user)).eventually.eq(0);
        await expect(nft.ownerOf(0)).eventually.eq(user.address);
    })
})