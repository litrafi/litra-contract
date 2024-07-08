import { expect } from "chai";
import { loadFixture } from "@nomicfoundation/hardhat-toolbox/network-helpers";
import { deployAll } from "../../scripts/deploy-all";
import { ethers } from "hardhat";
import { WrappedNFT } from "../../typechain-types";

describe('NFTVault', () => {
    describe('Fungiblize', () => {

        it('Succeed to wrap two nfts in the same nft contract', async () => {
            const {nftVault} = await loadFixture(deployAll);
            const MockNFT = await ethers.getContractFactory('MockNFT');
            const nftContract = await MockNFT.deploy('Mock NFT', 'mNFT');
            const depositor = (await ethers.getSigners())[0];

            const tokenIds = [0, 1];
            await Promise.all(tokenIds.map(async tokenId => {
                await nftContract.mint(depositor, tokenId);
                await nftContract.connect(depositor).approve(nftVault.getAddress(), tokenId);
                await nftVault.connect(depositor).wrap(nftContract.getAddress(), tokenId);
            }))
            
            expect(await nftVault.nextWnftId()).eq(2);
            const wnftId = await nftVault.wnftIds(nftContract.getAddress())
            expect(wnftId).eq(1);
            const wnftInfo = await nftVault.wnfts(wnftId);
            expect(wnftInfo.nftAddr).eq(await nftContract.getAddress());
            expect(wnftInfo.wnftAddr).not.eq(ethers.ZeroAddress);
            expect(await nftVault.wnftAddrToId(wnftInfo.wnftAddr)).eq(wnftId);
            expect(await nftVault.nftsLength()).eq(2);
            const nfts = await nftVault.nftsInWnft(wnftId);
            expect(nfts).deep.eq([0, 1])
            let wrapdNft = await nftVault.wrappedNfts(0);
            expect(wrapdNft.nftAddr).eq(await nftContract.getAddress());
            expect(wrapdNft.tokenId).eq(tokenIds[0]);
            expect(wrapdNft.inVault).eq(true);
            wrapdNft = await nftVault.wrappedNfts(1);
            expect(wrapdNft.nftAddr).eq(await nftContract.getAddress());
            expect(wrapdNft.tokenId).eq(tokenIds[1]);
            expect(wrapdNft.inVault).eq(true);
        })

        it('Fungiblized multiple nfts in the different nft contract', async () => {
            const {nftVault} = await loadFixture(deployAll);
            const MockNFT = await ethers.getContractFactory('MockNFT');
            const tokenId = 0;
            const nftContracts = [
                await MockNFT.deploy('Mock NFT_1', 'mNFT_1'),
                await MockNFT.deploy('Mock NFT', 'mNFT_2')
            ]
            const depositor = (await ethers.getSigners())[0];

            await Promise.all(nftContracts.map(async nftContract => {
                await nftContract.mint(depositor, tokenId);
                await nftContract.connect(depositor).approve(nftVault.getAddress(), tokenId);
                await nftVault.connect(depositor).wrap(nftContract.getAddress(), tokenId);
            }));

            expect(await nftVault.nextWnftId()).eq(3);
            for (let index = 0; index < nftContracts.length; index++) {
                const nftContract = nftContracts[index];
                const ftId = await nftVault.wnftIds(nftContract.getAddress());
                expect(ftId).eq(index + 1);
                const nfts = await nftVault.nftsInWnft(ftId);
                expect(nfts).deep.eq([index])
                const wnftInfo = await nftVault.wnfts(ftId);
                expect(wnftInfo.nftAddr).eq(await nftContract.getAddress());
                expect(wnftInfo.wnftAddr).not.eq(ethers.ZeroAddress);
                const wrapdNft = await nftVault.wrappedNfts(index);
                expect(wrapdNft.nftAddr).eq(await nftContract.getAddress());
                expect(wrapdNft.tokenId).eq(tokenId);
                expect(wrapdNft.inVault).eq(true);
                const WrappedNFT = await ethers.getContractFactory('WrappedNFT');
                const wnft: WrappedNFT = <any>await WrappedNFT.attach(wnftInfo.wnftAddr);
                const nftName = await nftContract.name();
                const nftSymbol = await nftContract.symbol();
                expect(await wnft.name()).eq(`${nftName} Wrapped NFT`);
                expect(await wnft.symbol()).eq(`${nftSymbol}wnft`);
                expect(await wnft.totalSupply()).eq(ethers.parseEther('1'));
                expect(await wnft.balanceOf(depositor)).eq(ethers.parseEther('1'));
            }
        })
    })

    describe('Unwrap', () => {
        async function deployAndWrapOne() {
            const {nftVault} = await deployAll();
            const MockNFT = await ethers.getContractFactory('MockNFT');
            const nftContract = await MockNFT.deploy('Mock NFT', 'mNFT');
            const [depositor, redeemer] = await ethers.getSigners();
            const tokenId = 0;

            await nftContract.mint(depositor, tokenId);
            await nftContract.connect(depositor).approve(nftVault.getAddress(), tokenId);
            await nftVault.connect(depositor).wrap(nftContract.getAddress(), tokenId);

            const wnftId = await nftVault.wnftIds(nftContract.getAddress())
            const wnftInfo = await nftVault.wnfts(wnftId);
            const WrappedNFT = await ethers.getContractFactory('WrappedNFT');
            const wnft: WrappedNFT = <any>await WrappedNFT.attach(wnftInfo.wnftAddr);

            const nftId = 0;

            return {nftVault, nftContract, depositor, redeemer, wnftId, wnftInfo, wnft, nftId };
        }
        
        it('Unwrap succeed', async () => {
            const {nftVault, nftContract, depositor, redeemer, wnftId, nftId, wnft} = await deployAndWrapOne();
            await wnft.connect(depositor).transfer(redeemer, ethers.parseEther('1'));
            await wnft.connect(redeemer).approve(nftVault.getAddress(), ethers.parseEther('1'));
            await nftVault.connect(redeemer).unwrap(wnftId, nftId);
            const balance = await wnft.balanceOf(redeemer);
            expect(balance).eq(0);

            const nftInfo = await nftVault.wrappedNfts(nftId);
            expect(nftInfo.inVault).eq(false);
            expect(await nftContract.ownerOf(nftInfo.tokenId)).eq(redeemer.address);
        })

        it('Unwrap failed: insufficient fts', async () => {
            const {nftVault, redeemer, wnftId, nftId, wnft} = await deployAndWrapOne();
            await wnft.connect(redeemer).approve(nftVault.getAddress(), ethers.parseEther('1'));
            await expect(nftVault.connect(redeemer).unwrap(wnftId, nftId))
                .to.be.revertedWith('Insufficient wNFT');
        })
    })

    describe('Batch Proxy', () => {
        it('batch wrap', async () => {
            const {nftVault, batchProxy} = await loadFixture(deployAll);
            const MockNFT = await ethers.getContractFactory('MockNFT');
            const depositor = (await ethers.getSigners())[0];
            const NFTS_LENGTH = 5;
            const nfts: string[] = [];
            const tokenIds: number[] = [];

            for (let index = 0; index < NFTS_LENGTH; index++) {
                const nft = await MockNFT.deploy('Mock NFT', 'MNFT');
                await nft.mint(depositor, index)
                await nft.connect(depositor).approve(batchProxy.getAddress(), index);
                nfts.push(await nft.getAddress());
                tokenIds.push(index);
            }

            await batchProxy.batchWrap(nfts, tokenIds);

            // confirm
            for (let index = 0; index < nfts.length; index++) {
                const wnftId = await nftVault.wnftIds(nfts[index]);
                const wnftInfo = await nftVault.wnfts(wnftId);
                const WrappedNFT = await ethers.getContractFactory('WrappedNFT');
                const wnft: WrappedNFT = <any>await WrappedNFT.attach(wnftInfo.wnftAddr);
                const balance = await wnft.balanceOf(depositor);
                expect(balance.toString()).eq(ethers.parseEther('1'))
            }
        })
    })
})