pragma solidity ^0.8.0;

import "../PublicConfig.sol";
import "../libs/TransferLib.sol";
import "../utils/NftReceiver.sol";

import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";

contract AuctionBook is OwnableUpgradeable, ReentrancyGuardUpgradeable, NftReceiver {
    using SafeMathUpgradeable for uint256;
    using AddressUpgradeable for address payable;

    event CreateAuction(uint256 indexed auctionId, address creator);
    event CancelAuction(uint256 indexed auctionId, address operator);
    event MakeOffer(uint256 indexed auctionId, uint256 indexed bidId, address bidder);
    event ExecuteAuctionResult(uint256 indexed auctionId, uint256 indexed highestBid, address operator);
    
    enum AuctionStatus {
        ACTIVE,
        CLOSED
    }

    struct Auction {
        uint256 auctionId;
        address nft;
        uint256 tokenId;
        address creator;
        address pricingToken;
        uint256 highestOffer;
        uint256 startingPrice;
        uint256 minimumOffer;
        uint256 totalBids;
        address finalBuyer;
        uint256 endTime;
        AuctionStatus status;
    }

    struct Bid {
        uint256 bidId;
        address bidder;
        uint256 auctionId;
        uint256 offerPrice;
        uint256 bidTime;
    }

    Bid[] public bids;
    Auction[] public auctions;
    PublicConfig public config;
    // auctionId => bidId[]
    mapping(uint256 => uint256[]) public auctionBids;
    // user address => auction id => bid id
    mapping(address => mapping(uint256 => uint256)) public userBids;

    uint256 public activceAuctionsNum;
    uint256 public allAuctionsNum;

    function initialize(PublicConfig _config) public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();

        config = _config;
        _initBids();
    }

    function _initBids() internal {
        // bid id should be great than 0 because the defualt uint value is 0
        bids.push(Bid({
            bidId: 0,
            bidder: address(0),
            auctionId: 0,
            offerPrice: 0,
            bidTime: 0
        }));
    }

    // ======== External Modify ======== //

    /**
    TODO: Authenticity of NFT need to be verified
    */
    function createAuction(
        address _nft,
        uint256 _tokenId,
        address _pricingToken,
        uint256 _startingPrice,
        uint256 _endTime
    ) external {
        require(_nft != address(0), "Invalid ntf");
        require(_startingPrice > 0, "Invalid minimum offer");
        require(_endTime > block.timestamp, "Invalid end time");

        TransferLib.nftTransferFrom(_nft, msg.sender, address(this), _tokenId);

        uint256 auctionId = auctions.length;
        auctions.push(Auction({
            auctionId: auctionId,
            nft: _nft,
            tokenId: _tokenId,
            creator: msg.sender,
            highestOffer: 0,
            pricingToken: _pricingToken,
            startingPrice: _startingPrice,
            minimumOffer: 0,
            totalBids: 0,
            finalBuyer: address(0),
            endTime: _endTime,
            status: AuctionStatus.ACTIVE
        }));

        activceAuctionsNum = activceAuctionsNum.add(1);
        allAuctionsNum = allAuctionsNum.add(1);

        emit CreateAuction(auctionId, msg.sender);
    }

    function cancelAuction(uint256 auctionId) external {
        require(auctionId < auctions.length, "Invalid auction id");
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Invalid auction");
        require(msg.sender == auction.creator, "Forbidden");
        require(auction.highestOffer == 0, "Auction has already starteds");

        auction.status = AuctionStatus.CLOSED;
        activceAuctionsNum = activceAuctionsNum.sub(1);
        allAuctionsNum = allAuctionsNum.sub(1);

        TransferLib.nftTransferFrom(auction.nft, address(this), auction.creator, auction.tokenId);

        emit CancelAuction(auctionId, msg.sender);
    }

    function makeOffer(uint256 auctionId, uint256 offer) external payable nonReentrant {
        require(auctionId < auctions.length, "Invalid auction id");
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Invalid auction");
        require(block.timestamp <= auction.endTime, "Auction was end");
        require(offer >= auction.startingPrice && offer > auction.highestOffer, "Offer is low");

        uint256 bidId = userBids[msg.sender][auctionId];
        Bid storage bid;
        // user has never bidden
        if(bidId == 0) {
            TransferLib.transferFrom(auction.pricingToken, msg.sender, payable(address(this)), offer, msg.value);
            bidId = bids.length;
            bids.push(Bid({
                bidId: bidId,
                bidder: msg.sender,
                auctionId: auctionId,
                offerPrice: offer,
                bidTime: block.timestamp
            }));
            // first bid
            if(auctionBids[auctionId].length == 0) {
                auction.minimumOffer = offer;
            }
            auctionBids[auctionId].push(bidId);
            userBids[msg.sender][auctionId] = bidId;
            bid = bids[bidId];
            auction.totalBids = auction.totalBids.add(1);
        } else {
            // user has already bidden
            bid = bids[bidId];
            require(offer > bid.offerPrice, "New price should be higher");
            uint256 offerPlus = offer.sub(bid.offerPrice);
            TransferLib.transferFrom(auction.pricingToken, bid.bidder, payable(address(this)), offerPlus, msg.value);
            bid.offerPrice = offer;
            bid.bidTime = block.timestamp;
        }
        
        auction.highestOffer = offer;

        emit MakeOffer(auctionId, bidId, bid.bidder);
    }

    function executeAuctionResult(uint256 auctionId) external nonReentrant {
        require(auctionId < auctions.length, "Invalid auction id");
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Invalid auction");
        require(block.timestamp >= auction.endTime, "Auction is not end yet");

        auction.status = AuctionStatus.CLOSED;
        uint256[] memory _bidsId = auctionBids[auctionId];
        // No one bid, return the NFT
        if(_bidsId.length == 0) {
            TransferLib.nftTransferFrom(auction.nft, address(this), auction.creator, auction.tokenId);
            return;
        }
        // Transfer NFT the final bidder and transfer the offer to auction creator
        Bid memory finalBid = bids[_bidsId[_bidsId.length - 1]];
        // In case of unexpectable condition caused the data cann't match
        require(finalBid.offerPrice == auction.highestOffer, "Unknown error");
        auction.finalBuyer = finalBid.bidder;
        auction.endTime = block.timestamp;
        TransferLib.nftTransferFrom(auction.nft, address(this), finalBid.bidder, auction.tokenId);
        TransferLib.transfer(auction.pricingToken, payable(auction.creator), finalBid.offerPrice);
        // Return offers to those lost the bid
        if(_bidsId.length > 1) {
            for (uint256 index = 0; index < _bidsId.length - 1; index++) {
                Bid memory bid = bids[_bidsId[index]];
                TransferLib.transfer(auction.pricingToken, payable(bid.bidder), bid.offerPrice);
            }
        }

        emit ExecuteAuctionResult(auctionId, auction.highestOffer, msg.sender);
    }
}