// SPDX-License-Identifier: MIT
pragma solidity ^0.8.24;

import { FHE, euint64, externalEuint64, eaddress, ebool } from "@fhevm/solidity/lib/FHE.sol";
import { SepoliaConfig } from "@fhevm/solidity/config/ZamaConfig.sol";

/// @title Confidential Sealed-Bid Auction using fhEVM
/// @notice This contract implements a first-price sealed-bid auction where bids are encrypted using FHE.
/// Users deposit a public amount that must be at least their encrypted bid.
/// After the auction ends, the admin requests decryption of the highest bidder and bid amount.
/// Losers get full refund, winner gets refund of deposit minus bid amount.
/// Total winning amounts are accumulated in an encrypted totalWinningAmount and decrypted only during withdrawal.
contract SealedBidAuction is SepoliaConfig {
    address public admin;
    string public auctionItem;
    uint256 public startTime;
    uint256 public endTime;
    bool public auctionStarted;
    bool public auctionEnded;
    bool public isWithdraw;

    mapping(address => euint64) private bids;
    mapping(address => uint256) public deposits;
    address[] private bidders;

    euint64 private highestBid;
    eaddress private highestBidder;

    address public winner;
    uint64 public winningAmount;
    euint64 private totalWinningAmount; // Encrypted total winning amount (euint64)
    uint64 public decryptedTotalWinningAmount; // Decrypted value after withdrawal

    // For decryption request IDs
    uint256 private decryptionRequestIdBidder;
    uint256 private decryptionRequestIdAmount;
    uint256 private decryptionRequestIdTotalAmount; // For totalWinningAmount decryption

    // Events
    event AuctionStarted(address indexed admin, uint256 startTime, uint256 endTime);
    event AuctionWinnerAnnounced(address indexed winner, uint64 winningAmount);
    event TotalProceedsWithdrawn(address indexed admin, uint64 amount);

    modifier onlyAdmin() {
        require(msg.sender == admin, "Only admin can call this");
        _;
    }

    modifier onlyDuringAuction() {
        require(auctionStarted && !auctionEnded && block.timestamp >= startTime
                        && block.timestamp <= endTime, "Auction not active");
        _;
    }

    modifier onlyAfterAuction() {
        require(auctionEnded, "Auction not ended");
        _;
    }

    constructor() {
        admin = address(0); // No admin initially
        highestBid = FHE.asEuint64(0);
        highestBidder = FHE.asEaddress(address(0));
        totalWinningAmount = FHE.asEuint64(0); // Initialize encrypted totalWinningAmount
        decryptedTotalWinningAmount = 0;

        // Allow access for FHE variables
        FHE.allowThis(highestBid);
        FHE.allowThis(highestBidder);
        FHE.allowThis(totalWinningAmount);
    }

    // Admin: Input auction item
    function setAuctionItem(string calldata _item) external onlyAdmin {
        auctionItem = _item;
    }

    // Anyone: Start the auction and become admin
    function startAuction(uint256 _duration) external {
        require(!auctionStarted, "Auction already started");
        require(admin == address(0), "Admin already set");
        admin = msg.sender; // Set caller as admin
        startTime = block.timestamp;
        endTime = block.timestamp + _duration;
        auctionStarted = true;
        emit AuctionStarted(admin, startTime, endTime);
    }

    // User: Participate in auction (place bid)
    function placeBid(externalEuint64 encryptedBid, bytes calldata inputProof) external payable onlyDuringAuction {
        require(msg.value > 0, "Deposit required");
        euint64 bid = FHE.fromExternal(encryptedBid, inputProof);
        
        // Update if this is the highest bid
        ebool isHigher = FHE.gt(bid, highestBid);
        highestBid = FHE.select(isHigher, bid, highestBid);
        eaddress newBidder = FHE.asEaddress(msg.sender);
        highestBidder = FHE.select(isHigher, newBidder, highestBidder);
        
        // Store bid and deposit
        bids[msg.sender] = bid;
        deposits[msg.sender] += msg.value;
        bidders.push(msg.sender);
        
        // Allow access for updated variables
        FHE.allowThis(highestBid);
        FHE.allowThis(highestBidder);
    }

    // Admin: End the auction
    function endAuction() external onlyAdmin {
        require(auctionStarted && !auctionEnded, "Cannot end auction");
        auctionEnded = true;
    }

    // Admin: Reset auction
    function resetAuction() external onlyAdmin onlyAfterAuction {
        require(auctionEnded , "Auction is not end");
        // No dependency on withdrawals
        auctionStarted = false;
        auctionEnded = false;
        auctionItem = "";
        startTime = 0;
        endTime = 0;
        highestBid = FHE.asEuint64(0);
        highestBidder = FHE.asEaddress(address(0));
        winner = address(0);
        winningAmount = 0;
        decryptionRequestIdBidder = 0;
        decryptionRequestIdAmount = 0;
        admin = address(0); // Reset admin for new auction
        totalWinningAmount = FHE.asEuint64(0); // Reset total winning amount
        decryptedTotalWinningAmount = 0; // Reset decrypted total

        // Clear bids and bidders
        for (uint256 i = 0; i < bidders.length; i++) {
            bids[bidders[i]] = FHE.asEuint64(0); // Reset encrypted bids
        }
        delete bidders; // Clear the bidders array

        // Re-allow FHE access for reset variables
        FHE.allowThis(highestBid);
        FHE.allowThis(highestBidder);
        FHE.allowThis(totalWinningAmount);
    }

    // Admin: Request decryption for winner and amount
    function requestDecryption() external onlyAdmin onlyAfterAuction {
        require(decryptionRequestIdBidder == 0, "Decryption already requested");
        
        // Prepare ciphertext for highestBidder
        bytes32[] memory ctsBidder = new bytes32[](1);
        ctsBidder[0] = FHE.toBytes32(highestBidder);
        decryptionRequestIdBidder = FHE.requestDecryption(ctsBidder, this.callbackDecryptBidder.selector);

        // Prepare ciphertext for highestBid
        bytes32[] memory ctsAmount = new bytes32[](1);
        ctsAmount[0] = FHE.toBytes32(highestBid);
        decryptionRequestIdAmount = FHE.requestDecryption(ctsAmount, this.callbackDecryptAmount.selector);
    }

    // Callback for decrypting bidder
    function callbackDecryptBidder(uint256 requestId, bytes memory cleartexts, bytes memory decryptionProof) external {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);
        require(requestId == decryptionRequestIdBidder, "Invalid request ID");
        address decryptedBidder = abi.decode(cleartexts, (address));
        winner = decryptedBidder;

        // Emit event if both winner and amount are decrypted
        if (winningAmount > 0) {
            emit AuctionWinnerAnnounced(winner, winningAmount);
        }
    }

    // Callback for decrypting amount
    function callbackDecryptAmount(uint256 requestId, bytes memory cleartexts, bytes memory decryptionProof) external {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);
        require(requestId == decryptionRequestIdAmount, "Invalid request ID");
        uint64 decryptedAmount = abi.decode(cleartexts, (uint64));
        winningAmount = decryptedAmount;

        // Accumulate the winning bid amount
        totalWinningAmount = FHE.add(totalWinningAmount, FHE.asEuint64(winningAmount)); // Accumulate encrypted
        FHE.allowThis(totalWinningAmount);
        
        // Allow withdraw again
        isWithdraw = false;

        // Emit event if both winner and amount are decrypted
        if (winner != address(0)) {
            emit AuctionWinnerAnnounced(winner, winningAmount);
        }
    }

    // Admin: Withdraw accumulated total proceeds (requests decryption)
    function withdrawTotalProceeds() external onlyAdmin {
        require(!isWithdraw, "Decryption already requested");

        // Prepare ciphertext for totalWinningAmount
        bytes32[] memory ctsTotalAmount = new bytes32[](1);
        ctsTotalAmount[0] = FHE.toBytes32(totalWinningAmount);
        decryptionRequestIdTotalAmount = FHE.requestDecryption(ctsTotalAmount,
                                                                this.callbackDecryptTotalAmount.selector);
    }

    // Callback for decrypting totalWinningAmount
    function callbackDecryptTotalAmount(uint256 requestId, bytes memory cleartexts,
                                                    bytes memory decryptionProof) external {
        FHE.checkSignatures(requestId, cleartexts, decryptionProof);
        require(requestId == decryptionRequestIdTotalAmount, "Invalid request ID");
        uint64 decryptedAmount = abi.decode(cleartexts, (uint64));
        decryptedTotalWinningAmount = decryptedAmount;
        totalWinningAmount = FHE.asEuint64(0); // Reset encrypted amount
        decryptionRequestIdTotalAmount = 0; // Reset request ID
        isWithdraw = true;
        FHE.allowThis(totalWinningAmount); // Re-allow access
        payable(admin).transfer(decryptedAmount);
        emit TotalProceedsWithdrawn(admin, decryptedAmount);
    }

    // View function for frontend to get winner information
    function getWinnerInfo() external view onlyAfterAuction returns (address, uint64) {
        require(winner != address(0) && winningAmount > 0, "Winner not announced yet");
        return (winner, winningAmount);
    }

    // Users: Refund after announcement
    function refund() external onlyAfterAuction {
        require(winner != address(0) && winningAmount > 0, "Winner not announced yet");
        uint256 deposit = deposits[msg.sender];
        require(deposit > 0, "No deposit");
        
        deposits[msg.sender] = 0;
        if (msg.sender == winner) {
            // Refund deposit - winningAmount
            payable(msg.sender).transfer(deposit - winningAmount);
        } else {
            // Full refund
            payable(msg.sender).transfer(deposit);
        }
    }
}