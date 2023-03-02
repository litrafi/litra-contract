/* eslint-disable no-unused-expressions */
import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers"
import { ethers } from "hardhat";
import { NftVaultDeployer } from "../../scripts/deployer/tokenize/nft-vault.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { construcAndWait, getContractAt } from "../../scripts/lib/utils";
import { FeeManager, WrappedNFT, Nft, NftVault } from "../../typechain"
import { BalanceComparator } from "../mock-util/comparator.util";
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

        it('Succeed to wrap one nft', async () => {
            const tokenId: number = 0;
            const nftContract = nftContracts[0];
            await nftContract.mint(depositor.address);
            await nftContract.connect(depositor).approve(nftVault.address, tokenId);

            await nftVault.connect(depositor).wrap(nftContract.address, tokenId);
            const owner = await nftContract.ownerOf(tokenId);
            expect(owner).eq(nftVault.address);
            const nextWnftId = await nftVault.nextWnftId();
            expect(nextWnftId).eq(BigNumber.from(2));
            let ftId = await nftVault.wnftIds(nftContract.address);
            expect(ftId).eq(BigNumber.from(1));
            const ftInfo = await nftVault.wnfts(1);
            expect(ftInfo.nftAddr).eq(nftContract.address);
            expect(ftInfo.wnftAddr).not.eq(ZERO);
            ftId = await nftVault.wnftIds(ftInfo.wnftAddr);
            expect(ftId).eq(BigNumber.from(1));
            const nftsLength = await nftVault.nftsLength();
            expect(nftsLength).eq(1);
            const wrapdNft = await nftVault.wrappedNfts(0);
            expect(wrapdNft.nftAddr).eq(nftContract.address);
            expect(wrapdNft.tokenId).eq(BigNumber.from(tokenId));
            expect(wrapdNft.inVault).eq(true);
            const ft = await getContractAt<WrappedNFT>('WrappedNFT', ftInfo.wnftAddr);
            const nftName = await nftContract.name();
            const nftSymbol = await nftContract.symbol();
            const ftName = await ft.name();
            const ftSymbol = await ft.symbol();
            const ftSupply = await ft.totalSupply();
            const ftBalance = await ft.balanceOf(depositor.address);
            expect(ftName).eq(`${nftName} Wrapped NFT`);
            expect(ftSymbol).eq(`${nftSymbol}wnft`);
            expect(ftSupply).eq(BigNumber.from(E18));
            expect(ftBalance).eq(BigNumber.from(E18));
        })

        it('Succeed to wrap two nfts in the same nft contract', async () => {
            const tokenIds = [0, 1];
            const nftContract = nftContracts[0];
            await Promise.all(tokenIds.map(async tokenId => {
                await nftContract.mint(depositor.address);
                await nftContract.connect(depositor).approve(nftVault.address, tokenId);
                await nftVault.connect(depositor).wrap(nftContract.address, tokenId);
            }))
            
            const nextWnftId = await nftVault.nextWnftId();
            expect(nextWnftId).eq(BigNumber.from(2));
            let ftId = await nftVault.wnftIds(nftContract.address);
            expect(ftId).eq(BigNumber.from(1));
            const ftInfo = await nftVault.wnfts(1);
            expect(ftInfo.nftAddr).eq(nftContract.address);
            expect(ftInfo.wnftAddr).not.eq(ZERO);
            ftId = await nftVault.wnftIds(ftInfo.wnftAddr);
            expect(ftId).eq(BigNumber.from(1));
            const nftsLength = await nftVault.nftsLength();
            expect(nftsLength).eq(2);
            const nfts = await nftVault.nftsInWnft(ftId);
            expect(nfts).deep.eq([BigNumber.from(0), BigNumber.from(1)])
            let wrapdNft = await nftVault.wrappedNfts(0);
            expect(wrapdNft.nftAddr).eq(nftContract.address);
            expect(wrapdNft.tokenId).eq(BigNumber.from(tokenIds[0]));
            expect(wrapdNft.inVault).eq(true);
            wrapdNft = await nftVault.wrappedNfts(1);
            expect(wrapdNft.nftAddr).eq(nftContract.address);
            expect(wrapdNft.tokenId).eq(BigNumber.from(tokenIds[1]));
            expect(wrapdNft.inVault).eq(true);
            const ft = await getContractAt<WrappedNFT>('WrappedNFT', ftInfo.wnftAddr);
            const nftName = await nftContract.name();
            const nftSymbol = await nftContract.symbol();
            const ftName = await ft.name();
            const ftSymbol = await ft.symbol();
            const ftSupply = await ft.totalSupply();
            expect(ftName).eq(`${nftName} Wrapped NFT`);
            expect(ftSymbol).eq(`${nftSymbol}wnft`);
            expect(ftSupply).eq(BigNumber.from(E18).mul(2));
        })

        it('Fungiblized two nfts in the different nft contract', async () => {
            const tokenId = 0;
            await Promise.all(nftContracts.map(async nftContract => {
                await nftContract.mint(depositor.address);
                await nftContract.connect(depositor).approve(nftVault.address, tokenId);
                await nftVault.connect(depositor).wrap(nftContract.address, tokenId);
            }));

            const nextWnftId = await nftVault.nextWnftId();
            expect(nextWnftId).eq(BigNumber.from(3));
            for (let index = 0; index < nftContracts.length; index++) {
                const nftContract = nftContracts[index];
                const ftId = await nftVault.wnftIds(nftContract.address);
                expect(ftId).eq(BigNumber.from(index + 1));
                const nfts = await nftVault.nftsInWnft(ftId);
                expect(nfts).deep.eq([BigNumber.from(index)])
                const ftInfo = await nftVault.wnfts(ftId);
                expect(ftInfo.nftAddr).eq(nftContract.address);
                expect(ftInfo.wnftAddr).not.eq(ZERO);
                const wrapdNft = await nftVault.wrappedNfts(index);
                expect(wrapdNft.nftAddr).eq(nftContract.address);
                expect(wrapdNft.tokenId).eq(BigNumber.from(tokenId));
                expect(wrapdNft.inVault).eq(true);
                const ft = await getContractAt<WrappedNFT>('WrappedNFT', ftInfo.wnftAddr);
                const nftName = await nftContract.name();
                const nftSymbol = await nftContract.symbol();
                const ftName = await ft.name();
                const ftSymbol = await ft.symbol();
                const ftSupply = await ft.totalSupply();
                expect(ftName).eq(`${nftName} Wrapped NFT`);
                expect(ftSymbol).eq(`${nftSymbol}wnft`);
                expect(ftSupply).eq(BigNumber.from(E18));
            }
            
            
        })
    })

    describe('Unwrap', () => {
        let nftContract: Nft & Contract;
        let depositor: SignerWithAddress;
        let redeemer: SignerWithAddress;
        let ft: WrappedNFT & Contract;
        let ftId: number;
        let nwnftIds: BigNumber[];
        const tokenIds = [0, 1];

        beforeEach(async () => {
            nftContract = nftContracts[0];
            depositor = users[0]
            redeemer = users[1];

            await Promise.all(tokenIds.map(async tokenId => {
                await nftContract.mint(depositor.address);
                await nftContract.connect(depositor).approve(nftVault.address, tokenId);
                await nftVault.connect(depositor).wrap(nftContract.address, tokenId);
            }))

            ftId = 1;
            const ftInfo = await nftVault.wnfts(ftId);
            ft = await getContractAt<WrappedNFT>('WrappedNFT', ftInfo.wnftAddr);
            nwnftIds = await nftVault.nftsInWnft(ftId);
        })
        
        it('Unwrap succeed', async () => {
            await ft.connect(depositor).transfer(redeemer.address, BigNumber.from(E18));
            await ft.connect(redeemer).approve(nftVault.address, BigNumber.from(E18));
            await nftVault.connect(redeemer).unwrap(ftId, nwnftIds[nwnftIds.length - 1]);
            const balance = await ft.balanceOf(redeemer.address);
            expect(balance).eq(BigNumber.from(0));

            let nftInfo = await nftVault.wrappedNfts(nwnftIds[nwnftIds.length - 1]);
            expect(nftInfo.inVault).eq(false);
            let owner = await nftContract.ownerOf(nftInfo.tokenId);
            expect(owner).eq(redeemer.address);
            nftInfo = await nftVault.wrappedNfts(nwnftIds[nwnftIds.length - 2]);;
            expect(nftInfo.inVault).eq(true);
            owner = await nftContract.ownerOf(nftInfo.tokenId);
            expect(owner).eq(nftVault.address);
        })

        it('Unwrap failed: insufficient fts', async () => {
            const redeemedNftId = nwnftIds[0];
            const resetNftId = nwnftIds[1];
            await ft.connect(depositor).transfer(redeemer.address, BigNumber.from(E18));
            await ft.connect(redeemer).approve(nftVault.address, BigNumber.from(E18));
            await nftVault.connect(redeemer).unwrap(ftId, redeemedNftId);

            let nftInfo = await nftVault.wrappedNfts(redeemedNftId);
            expect(nftInfo.inVault).eq(false);
            let owner = await nftContract.ownerOf(nftInfo.tokenId);
            expect(owner).eq(redeemer.address);
            nftInfo = await nftVault.wrappedNfts(resetNftId);;
            expect(nftInfo.inVault).eq(true);
            owner = await nftContract.ownerOf(nftInfo.tokenId);
            expect(owner).eq(nftVault.address);
        })
    })

    describe('Fee manager', () => {
        let feeManager: FeeManager & Contract;
        let oAdmin: SignerWithAddress;
        let pAdmin: SignerWithAddress;
        let eAdmin: SignerWithAddress;

        beforeEach(async () => {
            oAdmin = users[0]
            pAdmin = users[1]
            eAdmin = users[2]

            feeManager = await construcAndWait<FeeManager>('FeeManager', [
                nftVault.address,
                oAdmin.address,
                pAdmin.address,
                eAdmin.address
            ]);
            await nftVault.setFeeManager(feeManager.address);
        })

        describe('Charge', () => {
            const WRAP_FEE = 5e8;
            const UNWRAP_FEE = 35e7;
            let depositor: SignerWithAddress;

            beforeEach(async () => {
                depositor = users[0];
            })

            it('Charge wrap & unwrap fee', async () => {
                // wrap
                let tokenId: number = 0;
                const nftContract = nftContracts[0];
                await nftContract.mint(depositor.address);
                await nftContract.connect(depositor).approve(nftVault.address, tokenId);
                await nftVault.connect(depositor).wrap(nftContract.address, tokenId);
                const wnftInfo = await nftVault.wnfts(1);
                const wnft = await getContractAt<WrappedNFT>('WrappedNFT', wnftInfo.wnftAddr);
                let wnftBalance = await wnft.balanceOf(depositor.address);
                // first wrap without fee
                let expectBalance = BigNumber.from(E18);
                expect(wnftBalance).deep.eq(expectBalance);
                wnftBalance = await wnft.balanceOf(feeManager.address);
                expectBalance = BigNumber.from(0);
                expect(wnftBalance.eq(expectBalance)).true;
                // set fee
                await feeManager.connect(pAdmin).setWrapFee(wnft.address, WRAP_FEE);
                await feeManager.connect(pAdmin).setUnwrapFee(wnft.address, UNWRAP_FEE);
                // wrap another
                tokenId = 1;
                await nftContract.mint(depositor.address);
                await nftContract.connect(depositor).approve(nftVault.address, tokenId);
                const userComparator = new BalanceComparator(depositor.address);
                await userComparator.setBeforeBalance(wnft.address);
                await nftVault.connect(depositor).wrap(nftContract.address, tokenId);
                await userComparator.setAfterBalance(wnft.address);
                expect(userComparator.compare(wnft.address)).deep.eq(BigNumber.from(E18).sub(WRAP_FEE));
                // unwrap
                const fee = BigNumber.from(UNWRAP_FEE);
                const managerComparator = new BalanceComparator(feeManager.address);
                userComparator.clear();
                await userComparator.setBeforeBalance(wnft.address);
                await managerComparator.setBeforeBalance(wnft.address);
                await wnft.approve(nftVault.address, fee.add(E18));
                await nftVault.unwrap(1, 0);
                await userComparator.setAfterBalance(wnft.address);
                await managerComparator.setAfterBalance(wnft.address);
                expect(userComparator.compare(wnft.address).eq(BigNumber.from(E18).add(fee))).true;
                expect(managerComparator.compare(wnft.address).eq(fee)).true;
            })
        })
    })
})