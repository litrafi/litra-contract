import { SignerWithAddress } from "@nomiclabs/hardhat-ethers/dist/src/signer-with-address"
import { expect } from "chai";
import { BigNumber, Contract } from "ethers";
import { ethers } from "hardhat";
import { AuctionBookDeployer } from "../../scripts/deployer/auction/auction-book.deployer";
import { E18, ZERO } from "../../scripts/lib/constant";
import { AuctionSynchroniser } from "../../scripts/synchroniser/auction.syncrhoniser";
import { AuctionBook, Nft } from "../../typechain";
import { BalanceComparator } from "../mock-util/comparator.util";
import { deployMockNft } from "../mock-util/deploy.util";
import { clear, currentTime, fastForward } from "../mock-util/env.util";
import { expectCloseTo, shouldThrow } from "../mock-util/expect-plus.util";

enum AuctionStatus {
    ACTIVE,
    CLOSED
}

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
        // check auction list
        const list = await auctionBookContract.getAuctionsInfoByFiler(false, AuctionStatus.ACTIVE);
        expect(list.length).eq(1);
        // check auction info
        const auction = list[0];
        expect(auction.auctionId).eq(BigNumber.from(0));
        expect(auction.nft).eq(nftContract.address);
        expect(auction.tokenId).eq(tokenId);
        expect(auction.creator).eq(auctionCreator.address);
        expect(auction.highestOffer).eq(BigNumber.from(0));
        expect(auction.minimumOffer).eq(BigNumber.from(0));
        expect(auction.totalBids).eq(BigNumber.from(0));
        expect(auction.finalBuyer).eq(ZERO);
        expect(auction.endTime).eq(BigNumber.from(END_TIME));
        expect(auction.status).eq(AuctionStatus.ACTIVE);
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
        let now = await currentTime();
        const END_TIME = now + AUCTION_PERIOD;
        // create
        await nftContract.approve(auctionBookContract.address, tokenId);
        await auctionBookContract.createAuction(
            nftContract.address,
            tokenId,
            MINIMUM_OFFER,
            END_TIME
        );
        // Make offer
        shouldThrow(
            auctionBookContract
                .connect(bidder)
                .makeOffer(0),
            "Offer is low"
        )
        await auctionBookContract
            .connect(bidder)
            .makeOffer(0, { value: MINIMUM_OFFER });
        await shouldThrow(
            auctionBookContract
                .connect(bidder2)
                .makeOffer(0, { value: MINIMUM_OFFER }),
            "Offer is low"
        );
        // check bid list
        let list = await auctionBookContract.getOfferHistory(0);
        expect(list.length).eq(1);
        // check bid info
        let bid = list[0];
        expect(bid.auctionId).eq(BigNumber.from(0));
        expect(bid.bidId).eq(BigNumber.from(1));
        expect(bid.bidder).eq(bidder.address);
        now = await currentTime();
        expectCloseTo(bid.bidTime, BigNumber.from(now), 9)
        expect(bid.offerPrice).eq(BigNumber.from(MINIMUM_OFFER));
        // check auction info
        let auction = await auctionBookContract.auctions(0);
        expect(auction.totalBids).eq(BigNumber.from(MINIMUM_OFFER));
        expect(auction.highestOffer).eq(BigNumber.from(MINIMUM_OFFER));
        // re-bid
        const OFFER = MINIMUM_OFFER.add(E18);
        await auctionBookContract
            .connect(bidder)
            .makeOffer(0, { value: OFFER });
        list = await auctionBookContract.getOfferHistory(0);
        expect(list.length).eq(1);
        // check bid info
        bid = list[0];
        now = await currentTime();
        expect(bid.bidTime).eq(BigNumber.from(now));
        expect(bid.offerPrice).eq(BigNumber.from(OFFER));
        // check auction info
        auction = await auctionBookContract.auctions(0);
        expect(auction.totalBids).eq(BigNumber.from(OFFER));
        expect(auction.highestOffer).eq(BigNumber.from(OFFER));
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
            MINIMUM_OFFER,
            END_TIME
        );
        // make offer
        await auctionBookContract
            .connect(bidder2)
            .makeOffer(0, { value: MINIMUM_OFFER });
        await auctionBookContract
            .connect(bidder)
            .makeOffer(0, { value: FINAL_OFFER });
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
        // check list
        const list = await auctionBookContract.getAuctionsInfoByFiler(true, AuctionStatus.CLOSED);
        expect(list.length).eq(1);
        // check auction info
        const auction = list[0];
        expect(auction.finalBuyer).eq(bidder.address);
        expect(auction.status).eq(AuctionStatus.CLOSED);
        const time = await currentTime();
        expect(auction.endTime).eq(BigNumber.from(time));
        expect(auction.totalBids).eq(MINIMUM_OFFER.add(FINAL_OFFER));
        expect(auction.highestOffer).eq(FINAL_OFFER);
    })
})