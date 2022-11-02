import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers"
import { ethers } from "hardhat";
import { NftVaultDeployer } from "../../scripts/deployer/tokenize/nft-vault.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { construcAndWait, getContractAt } from "../../scripts/lib/utils";
import { FToken, Nft, NftVault } from "../../typechain"
import { clear } from "../mock-util/env.util";

describe('NftVault', () => {
    let nftVault: NftVault & Contract;
    let nftContracts: Array<Contract & Nft>;
    let users: SignerWithAddress[];

    beforeEach(async () => {
        clear();

        nftVault = await new NftVaultDeployer().getOrDeployInstance({});
        const bayc = await construcAndWait<Nft>('Nft', ['BoredApeYachtClub', 'BAYC ', '']);
        const cryptoPunks = await construcAndWait<Nft>('Nft', ['CRYPTOPUNKS', 'C', '']) ;
        nftContracts = [bayc, cryptoPunks];

        users = await ethers.getSigners();
    })

    describe('Fungiblize', () => {
        let depositor: SignerWithAddress;

        beforeEach(async () => {
            depositor = users[0];
        })

        it('Succeed to fungiblize one nft', async () => {
            const tokenId: number = 0;
            const nftContract = nftContracts[0];
            await nftContract.mint(depositor.address);
            await nftContract.connect(depositor).approve(nftVault.address, tokenId);

            await nftVault.connect(depositor).fungiblize(nftContract.address, tokenId);
            const owner = await nftContract.ownerOf(tokenId);
            expect(owner).eq(nftVault.address);
            const nextFtId = await nftVault.nextFtId();
            expect(nextFtId).eq(BigNumber.from(2));
            let ftId = await nftVault.ftIds(nftContract.address);
            expect(ftId).eq(BigNumber.from(1));
            const ftInfo = await nftVault.fts(1);
            expect(ftInfo.nftAddr).eq(nftContract.address);
            expect(ftInfo.ftAddr).not.eq(ZERO);
            ftId = await nftVault.ftIds(ftInfo.ftAddr);
            expect(ftId).eq(BigNumber.from(1));
            const nftsLength = await nftVault.nftsLength();
            expect(nftsLength).eq(1);
            const fungiblizedNft = await nftVault.fungiblizedNFTs(0);
            expect(fungiblizedNft.nftAddr).eq(nftContract.address);
            expect(fungiblizedNft.tokenId).eq(BigNumber.from(tokenId));
            expect(fungiblizedNft.inVault).eq(true);
            const ft = await getContractAt<FToken>('FToken', ftInfo.ftAddr);
            const nftName = await nftContract.name();
            const nftSymbol = await nftContract.symbol();
            const ftName = await ft.name();
            const ftSymbol = await ft.symbol();
            const ftSupply = await ft.totalSupply();
            const ftBalance = await ft.balanceOf(depositor.address);
            expect(ftName).eq(`${nftName} Fungible Token`);
            expect(ftSymbol).eq(`${nftSymbol}ft`);
            expect(ftSupply).eq(BigNumber.from(E18));
            expect(ftBalance).eq(BigNumber.from(E18));
        })

        it('Succeed to fungiblize two nfts in the same nft contract', async () => {
            const tokenIds = [0, 1];
            const nftContract = nftContracts[0];
            await Promise.all(tokenIds.map(async tokenId => {
                await nftContract.mint(depositor.address);
                await nftContract.connect(depositor).approve(nftVault.address, tokenId);
                await nftVault.connect(depositor).fungiblize(nftContract.address, tokenId);
            }))
            
            const nextFtId = await nftVault.nextFtId();
            expect(nextFtId).eq(BigNumber.from(2));
            let ftId = await nftVault.ftIds(nftContract.address);
            expect(ftId).eq(BigNumber.from(1));
            const ftInfo = await nftVault.fts(1);
            expect(ftInfo.nftAddr).eq(nftContract.address);
            expect(ftInfo.ftAddr).not.eq(ZERO);
            ftId = await nftVault.ftIds(ftInfo.ftAddr);
            expect(ftId).eq(BigNumber.from(1));
            const nftsLength = await nftVault.nftsLength();
            expect(nftsLength).eq(2);
            const nfts = await nftVault.nftsInFt(ftId);
            expect(nfts).deep.eq([BigNumber.from(0), BigNumber.from(1)])
            let fungiblizedNft = await nftVault.fungiblizedNFTs(0);
            expect(fungiblizedNft.nftAddr).eq(nftContract.address);
            expect(fungiblizedNft.tokenId).eq(BigNumber.from(tokenIds[0]));
            expect(fungiblizedNft.inVault).eq(true);
            fungiblizedNft = await nftVault.fungiblizedNFTs(1);
            expect(fungiblizedNft.nftAddr).eq(nftContract.address);
            expect(fungiblizedNft.tokenId).eq(BigNumber.from(tokenIds[1]));
            expect(fungiblizedNft.inVault).eq(true);
            const ft = await getContractAt<FToken>('FToken', ftInfo.ftAddr);
            const nftName = await nftContract.name();
            const nftSymbol = await nftContract.symbol();
            const ftName = await ft.name();
            const ftSymbol = await ft.symbol();
            const ftSupply = await ft.totalSupply();
            expect(ftName).eq(`${nftName} Fungible Token`);
            expect(ftSymbol).eq(`${nftSymbol}ft`);
            expect(ftSupply).eq(BigNumber.from(E18).mul(2));
        })

        it('Fungiblized two nfts in the different nft contract', async () => {
            const tokenId = 0;
            await Promise.all(nftContracts.map(async nftContract => {
                await nftContract.mint(depositor.address);
                await nftContract.connect(depositor).approve(nftVault.address, tokenId);
                await nftVault.connect(depositor).fungiblize(nftContract.address, tokenId);
            }));

            const nextFtId = await nftVault.nextFtId();
            expect(nextFtId).eq(BigNumber.from(3));
            for (let index = 0; index < nftContracts.length; index++) {
                const nftContract = nftContracts[index];
                const ftId = await nftVault.ftIds(nftContract.address);
                expect(ftId).eq(BigNumber.from(index + 1));
                const nfts = await nftVault.nftsInFt(ftId);
                expect(nfts).deep.eq([BigNumber.from(index)])
                const ftInfo = await nftVault.fts(ftId);
                expect(ftInfo.nftAddr).eq(nftContract.address);
                expect(ftInfo.ftAddr).not.eq(ZERO);
                const fungiblizedNft = await nftVault.fungiblizedNFTs(index);
                expect(fungiblizedNft.nftAddr).eq(nftContract.address);
                expect(fungiblizedNft.tokenId).eq(BigNumber.from(tokenId));
                expect(fungiblizedNft.inVault).eq(true);
                const ft = await getContractAt<FToken>('FToken', ftInfo.ftAddr);
                const nftName = await nftContract.name();
                const nftSymbol = await nftContract.symbol();
                const ftName = await ft.name();
                const ftSymbol = await ft.symbol();
                const ftSupply = await ft.totalSupply();
                expect(ftName).eq(`${nftName} Fungible Token`);
                expect(ftSymbol).eq(`${nftSymbol}ft`);
                expect(ftSupply).eq(BigNumber.from(E18));
            }
            
            
        })
    })

    describe('Redeem', () => {
        let nftContract: Nft & Contract;
        let depositor: SignerWithAddress;
        let redeemer: SignerWithAddress;
        let ft: FToken & Contract;
        let ftId: number;
        let nftIds: BigNumber[];
        const tokenIds = [0, 1];

        beforeEach(async () => {
            nftContract = nftContracts[0];
            depositor = users[0]
            redeemer = users[1];

            await Promise.all(tokenIds.map(async tokenId => {
                await nftContract.mint(depositor.address);
                await nftContract.connect(depositor).approve(nftVault.address, tokenId);
                await nftVault.connect(depositor).fungiblize(nftContract.address, tokenId);
            }))

            ftId = 1;
            const ftInfo = await nftVault.fts(ftId);
            ft = await getContractAt<FToken>('FToken', ftInfo.ftAddr);
            nftIds = await nftVault.nftsInFt(ftId);
        })
        
        it('Redeem succeed: nondirectional', async () => {
            await ft.connect(depositor).transfer(redeemer.address, BigNumber.from(E18));
            await ft.connect(redeemer).approve(nftVault.address, BigNumber.from(E18));
            await nftVault.connect(redeemer).redeem(ftId, -1);
            const balance = await ft.balanceOf(redeemer.address);
            expect(balance).eq(BigNumber.from(0));

            let nftInfo = await nftVault.fungiblizedNFTs(nftIds[nftIds.length - 1]);
            expect(nftInfo.inVault).eq(false);
            let owner = await nftContract.ownerOf(nftInfo.tokenId);
            expect(owner).eq(redeemer.address);
            nftInfo = await nftVault.fungiblizedNFTs(nftIds[nftIds.length - 2]);;
            expect(nftInfo.inVault).eq(true);
            owner = await nftContract.ownerOf(nftInfo.tokenId);
            expect(owner).eq(nftVault.address);
        })

        it('Redeem failed: insufficient fts', async () => {
            const redeemedNftId = nftIds[0];
            const resetNftId = nftIds[1];
            await ft.connect(depositor).transfer(redeemer.address, BigNumber.from(E18));
            await ft.connect(redeemer).approve(nftVault.address, BigNumber.from(E18));
            await nftVault.connect(redeemer).redeem(ftId, redeemedNftId);

            let nftInfo = await nftVault.fungiblizedNFTs(redeemedNftId);
            expect(nftInfo.inVault).eq(false);
            let owner = await nftContract.ownerOf(nftInfo.tokenId);
            expect(owner).eq(redeemer.address);
            nftInfo = await nftVault.fungiblizedNFTs(resetNftId);;
            expect(nftInfo.inVault).eq(true);
            owner = await nftContract.ownerOf(nftInfo.tokenId);
            expect(owner).eq(nftVault.address);
        })
    })
})