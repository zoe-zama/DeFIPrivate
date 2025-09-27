# Sealed Bid Auction with FHEVM - README
This project implements a Confidential Sealed-Bid Auction using the Fully Homomorphic Encryption Virtual Machine (FHEVM). It allows users to place encrypted bids on an auction item, ensuring privacy until the auction ends. The admin manages the auction lifecycle, and bids are decrypted only when necessary, leveraging FHE for secure computation.
# Table of Contents

Overview
Features
Prerequisites
Setup Instructions
Usage
Smart Contract Details
Frontend Details
Troubleshooting

# Overview
The SealedBidAuction smart contract is deployed on a blockchain network supporting FHEVM (e.g., Zama's Sepolia testnet). It enables a first-price sealed-bid auction where:

Bids are encrypted using FHE to ensure confidentiality.
Users deposit a public amount that must cover their encrypted bid.
The admin starts and ends the auction, requests decryption of the highest bid, and withdraws proceeds.
Losers receive full refunds, while the winner's deposit is refunded minus their bid amount.

The frontend, built with React and TypeScript, integrates with MetaMask and ethers.js to interact with the smart contract.

# Features

Encrypted Bidding: Bids are encrypted using FHE, ensuring privacy during the auction.
Admin Controls: The admin can start, end, and reset auctions, set auction items, and withdraw proceeds.
User Actions: Users can place bids with deposits, request refunds, and view auction status.
Event-Driven Updates: Real-time updates via contract events (e.g., AuctionStarted, AuctionWinnerAnnounced).
Responsive UI: A clean React-based interface for interacting with the auction.

# Prerequisites

Node.js: Version 18 or higher.
MetaMask: Installed in your browser and connected to a supported network (e.g., Zama Sepolia).
Yarn or npm: For managing dependencies.
FHEVM Environment: Access to an FHEVM-compatible blockchain (e.g., Zama's Sepolia testnet).
ETH for Gas Fees: Testnet ETH for transactions on the target network.

# Setup Instructions

Clone the Repository:
git clone <repository-url>
cd sealed-bid-auction


# Install Dependencies:
yarn install

or
npm install


# Configure Environment:

Ensure MetaMask is connected to the correct network (e.g., Zama Sepolia).
Update the SealedBidAuctionAddresses.ts file with the deployed contract address for your target chain ID.


# Run the Application:
yarn start

or
npm start

The app will be available at http://localhost:3000.

Deploy the Smart Contract (if not already deployed):

Use tools like Hardhat or Remix to deploy SealedBidAuction.sol to an FHEVM-compatible network.
Update SealedBidAuctionAddresses.ts with the deployed contract address.



# Usage

Connect MetaMask:

Click "Connect to MetaMask" to link your wallet.
Ensure you're on the correct network (e.g., Zama Sepolia).


Admin Actions:

Start Auction: Set a duration (in seconds) and click "Start Auction" to begin. The first user to start an auction becomes the admin.
Set Auction Item: Enter an item description and click "Set Auction Item".
End Auction: Click "End Auction" to stop bidding.
Request Decryption: After the auction ends, click "Request Decryption" to reveal the winner and highest bid.
Reset Auction: Click "Reset Auction" to clear the auction state and start a new auction.
Withdraw Proceeds: Click "Withdraw Proceeds" to retrieve accumulated winning bids.


User Actions:

Place Bid: Enter a bid amount and deposit amount (in wei), then click "Place Bid". The deposit must be at least the bid amount.
Refund: After the auction ends and the winner is announced, click "Refund" to retrieve your deposit (full refund for losers, deposit minus bid for the winner).


View Auction State:

The UI displays the auction item, start/end times, user deposit, winner, and winning amount.
Use the "Refresh State" button to update the auction state manually.



# Smart Contract Details
The SealedBidAuction.sol contract includes:

Modifiers:
onlyAdmin: Restricts actions to the admin.
onlyDuringAuction: Ensures bids are placed during the active auction period.
onlyAfterAuction: Restricts actions like refunds and decryption to post-auction.


Key Functions:
setAuctionItem: Sets the auction item (admin only).
startAuction: Starts the auction and sets the caller as admin.
placeBid: Allows users to place encrypted bids with a deposit.
endAuction: Ends the auction (admin only).
requestDecryption: Requests decryption of the highest bid and bidder (admin only).
refund: Refunds deposits after the winner is announced.
resetAuction: Resets the auction state (admin only).
withdrawTotalProceeds: Withdraws accumulated proceeds (admin only).


Events:
AuctionStarted: Emitted when the auction starts.
AuctionWinnerAnnounced: Emitted when the winner and amount are decrypted.
TotalProceedsWithdrawn: Emitted when proceeds are withdrawn.



# Frontend Details
The frontend is built with React, TypeScript, and ethers.js, using the following key files:

useSealedBidAuction.tsx: A custom React hook for interacting with the SealedBidAuction contract.
SealedBidAuctionDemo.tsx: The main component rendering the auction UI.
Dependencies:
ethers: For Ethereum interactions.
fhevm: For FHE encryption/decryption.
useMetaMaskEthersSigner: Custom hook for MetaMask integration.
useInMemoryStorage: Manages FHEVM decryption signatures.



The UI includes:

Chain Info: Displays chain ID, MetaMask accounts, contract address, and admin status.
Auction State: Shows auction item, start/end times, user deposit, winner, and winning amount.
Action Buttons: For starting/ending auctions, placing bids, requesting decryption, refunds, and withdrawing proceeds.

# Troubleshooting

MetaMask Connection Issues:
Ensure MetaMask is installed and unlocked.
Verify the correct network is selected in MetaMask.


# Contract Not Deployed:
Check SealedBidAuctionAddresses.ts for the correct contract address.
Deploy the contract if it hasn't been deployed yet.


# FHEVM Errors:
Ensure the fhevm library is properly initialized.
Verify the network supports FHEVM (e.g., Zama Sepolia).


# Transaction Failures:
Check for sufficient gas and ETH in your wallet.
Review console logs for error messages from useSealedBidAuction.
