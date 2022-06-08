pragma solidity ^0.8.0;

import "@openzeppelin/contracts/token/ERC721/IERC721.sol";
import "@openzeppelin/contracts-upgradeable/utils/AddressUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/access/OwnableUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/utils/math/SafeMathUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/security/ReentrancyGuardUpgradeable.sol";
import "@openzeppelin/contracts-upgradeable/token/ERC721/IERC721ReceiverUpgradeable.sol";

contract AuctionBook is Initializable, OwnableUpgradeable, ReentrancyGuardUpgradeable, IERC721ReceiverUpgradeable {
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

    Auction[] public auctions;
    Bid[] public bids;
    // auctionId => bidId[]
    mapping(uint256 => uint256[]) public auctionBids;
    // user address => auction id => bid id
    mapping(address => mapping(uint256 => uint256)) public userBids;

    uint256 public activceAuctionsNum;
    uint256 public allAuctionsNum;

    function initialize() public initializer {
        __Ownable_init();
        __ReentrancyGuard_init();
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

    function getAuctionsInfoByFiler(bool _mine, bool _ignoreStatus, AuctionStatus _status) external view returns(Auction[] memory _auctions){
        uint256 count = 0;
        for (uint256 index = 0; index < auctions.length; index++) {
            Auction memory _auction = auctions[index];
            bool isRelevant = _auction.creator == msg.sender || userBids[msg.sender][index] != 0;
            if(
                (!_mine || isRelevant)
                && (_ignoreStatus || _auction.status == _status)
            ) {
                count ++;
            }
        }

        _auctions = new Auction[](count);
        count = 0;
        for (uint256 index = 0; index < auctions.length; index++) {
            Auction memory _auction = auctions[index];
            bool isRelevant = _auction.creator == msg.sender || userBids[msg.sender][index] != 0;
            if(
                (!_mine || isRelevant)
                && (_ignoreStatus || _auction.status == _status)
            ) {
                _auctions[count] = auctions[index];
                count ++;
            }
        }
    }

    function getOfferHistory(uint256 auctionId) external view returns(Bid[] memory _bids) {
        uint256[] memory bidsId = auctionBids[auctionId];
        _bids = new Bid[](bidsId.length);
        for (uint256 index = 0; index < bidsId.length; index++) {
            _bids[index] = bids[bidsId[index]];
        }
    }

    /**
    TODO: Authenticity of NFT need to be verified
    */
    function createAuction(
        address _nft,
        uint256 _tokenId,
        uint256 _startingPrice,
        uint256 _endTime
    ) external {
        require(_nft != address(0), "Invalid ntf");
        require(_startingPrice > 0, "Invalid minimum offer");
        require(_endTime > block.timestamp, "Invalid end time");

        IERC721(_nft).safeTransferFrom(msg.sender, address(this), _tokenId);

        uint256 auctionId = auctions.length;
        auctions.push(Auction({
            auctionId: auctionId,
            nft: _nft,
            tokenId: _tokenId,
            creator: msg.sender,
            highestOffer: 0,
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

        IERC721(auction.nft).safeTransferFrom(address(this), auction.creator, auction.tokenId);

        emit CancelAuction(auctionId, msg.sender);
    }

    function makeOffer(uint256 auctionId) external payable nonReentrant {
        require(auctionId < auctions.length, "Invalid auction id");
        Auction storage auction = auctions[auctionId];
        require(auction.status == AuctionStatus.ACTIVE, "Invalid auction");
        require(block.timestamp <= auction.endTime, "Auction was end");
        require(msg.value >= auction.startingPrice && msg.value > auction.highestOffer, "Offer is low");

        uint256 bidId = userBids[msg.sender][auctionId];
        Bid storage bid;
        // user has never bidden
        if(bidId == 0) {
            bidId = bids.length;
            bids.push(Bid({
                bidId: bidId,
                bidder: msg.sender,
                auctionId: auctionId,
                offerPrice: msg.value,
                bidTime: block.timestamp
            }));
            // first bid
            if(auctionBids[auctionId].length == 0) {
                auction.minimumOffer = msg.value;
            }
            auctionBids[auctionId].push(bidId);
            userBids[msg.sender][auctionId] = bidId;
            bid = bids[bidId];
            auction.totalBids = auction.totalBids.add(msg.value);
        } else {
            // user has already bidden
            bid = bids[bidId];
            require(msg.value > bid.offerPrice, "New price should be higher");
            payable(bid.bidder).sendValue(bid.offerPrice);
            auction.totalBids = auction.totalBids.sub(bid.offerPrice).add(msg.value);
            bid.offerPrice = msg.value;
            bid.bidTime = block.timestamp;
        }
        
        auction.highestOffer = msg.value;

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
            IERC721(auction.nft).safeTransferFrom(address(this), auction.creator, auction.tokenId);
            return;
        }
        // Transfer NFT the final bidder and transfer the offer to auction creator
        Bid memory finalBid = bids[_bidsId[_bidsId.length - 1]];
        // In case of unexpectable condition caused the data cann't match
        require(finalBid.offerPrice == auction.highestOffer, "Unknown error");
        auction.finalBuyer = finalBid.bidder;
        auction.endTime = block.timestamp;
        IERC721(auction.nft).safeTransferFrom(address(this), finalBid.bidder, auction.tokenId);
        payable(auction.creator).sendValue(finalBid.offerPrice);
        // Return offers to those lost the bid
        if(_bidsId.length > 1) {
            for (uint256 index = 0; index < _bidsId.length - 1; index++) {
                Bid memory bid = bids[_bidsId[index]];
                payable(bid.bidder).sendValue(bid.offerPrice);
            }
        }

        emit ExecuteAuctionResult(auctionId, auction.highestOffer, msg.sender);
    }

    function onERC721Received(address, address, uint256, bytes memory) public virtual override returns (bytes4) {
        return this.onERC721Received.selector;
    }
}