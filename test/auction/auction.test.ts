import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { AuctionBookDeployer } from "../../scripts/deployer/auction/auction-book.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { AuctionSynchroniser } from "../../scripts/synchroniser/auction.syncrhoniser";
import { TokenizeSynchroniser } from "../../scripts/synchroniser/tokenize.synchroniser";
import { AuctionBook, Nft } from "../../typechain";
import { BalanceComparator } from "../mock-util/comparator.util";
import { deployMockNft, mockEnvForTokenizeModule } from "../mock-util/deploy.util";
import { clear, currentTime, fastForward } from "../mock-util/env.util";
import { shouldThrow } from "../mock-util/expect-plus.util";

describe('Auction', () => {
    let auctionCreator: SignerWithAddress;
    let bidder: SignerWithAddress;
    let bidder2: SignerWithAddress;

    let auctionBookContract: AuctionBook & Contract;
    let nftContract: Nft & Contract;

    let tokenId: number;

    beforeEach(async () => {
        clear();
        const users = await ethers.getSigners();
        auctionCreator = users[0];
        bidder = users[1];
        bidder2 = users[2];

        await mockEnvForTokenizeModule();
        await new TokenizeSynchroniser().sychornise();
        await new AuctionSynchroniser().sychornise();

        auctionBookContract = await new AuctionBookDeployer().getInstance();
        nftContract = await deployMockNft(auctionCreator.address);
        tokenId = 0;
    })

    it('Create auction', async () => {
        const MINIMUM_OFFER = BigNumber.from(E18);
        const AUCTION_PERIOD = 7 * 24 * 3600;
        const now = await currentTime();
        const END_TIME = now + AUCTION_PERIOD;
        // create
        await nftContract.approve(auctionBookContract.address, tokenId);
        await auctionBookContract.createAuction(
            nftContract.address,
            tokenId,
            ZERO,
            MINIMUM_OFFER,
            END_TIME
        )
        // check assets
        const nftOwner = await nftContract.ownerOf(tokenId);
        expect(nftOwner).eq(auctionBookContract.address);
        // check statistic data
        const activceAuctionsNum = await auctionBookContract.activceAuctionsNum();
        const allAuctionsNum = await auctionBookContract.allAuctionsNum();
        expect(activceAuctionsNum).eq(BigNumber.from(1));
        expect(allAuctionsNum).eq(BigNumber.from(1));
    })

    it('Cancel auction', async () => {
        const MINIMUM_OFFER = BigNumber.from(E18);
        const AUCTION_PERIOD = 7 * 24 * 3600;
        const now = await currentTime();
        const END_TIME = now + AUCTION_PERIOD;
        // create
        await nftContract.approve(auctionBookContract.address, tokenId);
        await auctionBookContract.createAuction(
            nftContract.address,
            tokenId,
            ZERO,
            MINIMUM_OFFER,
            END_TIME
        );
        // cancel auction
        await auctionBookContract.cancelAuction(0);
        // check asset
        const nftOwner = await nftContract.ownerOf(tokenId);
        expect(nftOwner).eq(auctionCreator.address);
    })

    it('Make offer', async () => {
        const MINIMUM_OFFER = BigNumber.from(E18);
        const AUCTION_PERIOD = 7 * 24 * 3600;
        const now = await currentTime();
        const END_TIME = now + AUCTION_PERIOD;
        // create
        await nftContract.approve(auctionBookContract.address, tokenId);
        await auctionBookContract.createAuction(
            nftContract.address,
            tokenId,
            ZERO,
            MINIMUM_OFFER,
            END_TIME
        );
        // Make offer
        await shouldThrow(
            auctionBookContract
                .connect(bidder)
                .makeOffer(0, MINIMUM_OFFER),
            "TrasferLib: failed! Wrong value"
        )
        await auctionBookContract
            .connect(bidder)
            .makeOffer(0, MINIMUM_OFFER, { value: MINIMUM_OFFER });
        await shouldThrow(
            auctionBookContract
                .connect(bidder2)
                .makeOffer(0, MINIMUM_OFFER, { value: MINIMUM_OFFER }),
            "Offer is low"
        );
        // re-bid
        const OFFER = MINIMUM_OFFER.add(E18);
        await auctionBookContract
            .connect(bidder)
            .makeOffer(0, OFFER, { value: BigNumber.from(E18) });
    })

    it('Execute auction result', async () => {
        const MINIMUM_OFFER = BigNumber.from(E18);
        const FINAL_OFFER = MINIMUM_OFFER.add(E18);
        const AUCTION_PERIOD = 7 * 24 * 3600;
        const now = await currentTime();
        const END_TIME = now + AUCTION_PERIOD;
        // create
        await nftContract.approve(auctionBookContract.address, tokenId);
        await auctionBookContract.createAuction(
            nftContract.address,
            tokenId,
            ZERO,
            MINIMUM_OFFER,
            END_TIME
        );
        // make offer
        await auctionBookContract
            .connect(bidder2)
            .makeOffer(0, MINIMUM_OFFER, { value: MINIMUM_OFFER });
        await auctionBookContract
            .connect(bidder)
            .makeOffer(0, FINAL_OFFER, { value: FINAL_OFFER });
        // execute auction result
        await shouldThrow(
            auctionBookContract.executeAuctionResult(0),
            "Auction is not end yet"
        )
        await fastForward(AUCTION_PERIOD);
        const creatorComparator = new BalanceComparator(auctionCreator.address);
        const bidder2Comparator = new BalanceComparator(bidder2.address);
        await creatorComparator.setBeforeBalance(ZERO);
        await bidder2Comparator.setBeforeBalance(ZERO);
        await auctionBookContract
            .connect(bidder)
            .executeAuctionResult(0);
        // check asset
        await creatorComparator.setAfterBalance(ZERO);
        let diff = creatorComparator.compare(ZERO);
        expect(diff).eq(FINAL_OFFER);
        await bidder2Comparator.setAfterBalance(ZERO);
        diff = bidder2Comparator.compare(ZERO);
        // return the offer
        expect(diff).eq(MINIMUM_OFFER);
        const owner = await nftContract.ownerOf(tokenId);
        expect(owner).eq(bidder.address);
    })

    it('Personal', async () => {
        const MINIMUM_OFFER = BigNumber.from(E18);
        const AUCTION_PERIOD = 7 * 24 * 3600;
        const now = await currentTime();
        const END_TIME = now + AUCTION_PERIOD;
        // create auction
        await nftContract.approve(auctionBookContract.address, tokenId);
        await auctionBookContract.createAuction(
            nftContract.address,
            tokenId,
            ZERO,
            MINIMUM_OFFER,
            END_TIME
        );
    })
})