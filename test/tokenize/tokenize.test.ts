import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address";
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { NftVaultDeployer } from "../../scripts/deployer/tokenize/nft-vault.deployer";
import { E18 } from "../../scripts/lib/constant";
import { TokenizeSynchroniser } from "../../scripts/synchroniser/tokenize.synchroniser"
import { Nft, NftVault } from "../../typechain";
import { deployMockNft } from "../mock-util/deploy.util";
import { clear } from "../mock-util/env.util";

describe("Tokenize", async () => {
    let nftVaultContract: NftVault & Contract;
    let nftContract: Nft & Contract;
    let user: SignerWithAddress;

    beforeEach(async () => {
        clear();

        const synchroniser = new TokenizeSynchroniser();
        await synchroniser.sychornise();

        user = (await ethers.getSigners())[0];

        nftVaultContract = await new NftVaultDeployer().getInstance();
        nftContract = await deployMockNft(user.address);

    })

    it('deposit', async () => {
        const SUPPLY = BigNumber.from(E18).mul(1e5);
        const REDEEM_RATIO = SUPPLY.mul(60).div(100);
        const TOKEN_ID = 0;
        const TOKEN_NAME = 'MockNft';
        const DESCRIPTION = 'description of MockNft';
        const TNFT_NAME = 'MockTNFT'
        // deposit
        await nftContract.approve(nftVaultContract.address, 0);
        await nftVaultContract.deposit(
            nftContract.address,
            TOKEN_ID,
            TOKEN_NAME,
            DESCRIPTION,
            TNFT_NAME,
            SUPPLY,
            REDEEM_RATIO
        )
        // check status
        const nftLength = await nftVaultContract.nftInfoLength();
        const index = nftLength.toNumber() - 1;
        const nftInfo = await nftVaultContract.nftInfo(index);
        expect(nftInfo.owner).eq(user.address);
        expect(nftInfo.nftAddress).eq(nftContract.address);
        expect(nftInfo.tokenId.toNumber()).eq(0);
        expect(nftInfo.name).eq(TOKEN_NAME);
        expect(nftInfo.description).eq(DESCRIPTION);
        expect(nftInfo.supply.toString()).eq(SUPPLY.toString());
        expect(nftInfo.redeemRatio.toString()).eq(REDEEM_RATIO.toString());
        expect(nftInfo.redeemAmount.toNumber()).eq(0);
        expect(nftInfo.redeemPrice.toNumber()).eq(0);
        expect(nftInfo.status).eq(0);
        
        const pid = await nftVaultContract.pidFromNtoken(nftInfo.ntokenAddress);
        expect(pid.toNumber()).eq(0);

        const depositList = await nftVaultContract.getDepositedNftList(user.address);
        expect(depositList).deep.eq([BigNumber.from(0)])
    })
})