
"use client";

import { useFhevm } from "../fhevm/useFhevm";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { useSealedBidAuction } from "@/hooks/useSealedBidAuction";
import { errorNotDeployed } from "./ErrorNotDeployed";
import { useState } from "react";
import { ethers } from "ethers";

export const SealedBidAuctionDemo = () => {
  const { storage: fhevmDecryptionSignatureStorage } = useInMemoryStorage();
  const {
    provider,
    chainId,
    accounts,
    isConnected,
    connect,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
    initialMockChains,
  } = useMetaMaskEthersSigner();

  const { instance: fhevmInstance, status: fhevmStatus, error: fhevmError } = useFhevm({
    provider,
    chainId,
    initialMockChains,
    enabled: true,
  });

  const {
    contractAddress,
    canGetState,
    canStartAuction,
    canSetAuctionItem,
    canPlaceBid,
    canEndAuction,
    canRequestDecryption,
    canRefund,
    canResetAuction,
    canWithdrawProceeds,
    startAuction,
    updateAuctionItem,
    placeBid,
    endAuction,
    requestDecryption,
    refund,
    resetAuction,
    withdrawTotalProceeds,
    refreshState,
    message,
    auctionItem,
    startTime,
    endTime,
    auctionStarted,
    auctionEnded,
    deposit,
    winner,
    winningAmount,
    decryptedTotalWinningAmount,
    isAdmin,
    currentTimestamp,
    isRefreshing,
    isStartingAuction,
    isSettingItem,
    isPlacingBid,
    isEndingAuction,
    isRequestingDecryption,
    isRefunding,
    isResettingAuction,
    isWithdrawingProceeds,
    isDeployed,
  } = useSealedBidAuction({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider: provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  });


  const [duration, setDuration] = useState<number>(3600); // Default 1 hour in seconds
  const [item, setItem] = useState<string>("");
  const [bidAmount, setBidAmount] = useState<number>(1000000000000000); // Default 0.001 ETH in wei
  const [depositAmount, setDepositAmount] = useState<number>(1000000000000000); // Default 0.001 ETH in wei

  const buttonClass =
    "inline-flex items-center justify-center rounded-xl bg-black px-4 py-4 font-semibold text-white shadow-sm " +
    "transition-colors duration-200 hover:bg-blue-700 active:bg-blue-800 " +
    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-blue-500 focus-visible:ring-offset-2 " +
    "disabled:opacity-50 disabled:pointer-events-none";

  const titleClass = "font-semibold text-black text-lg mt-4";

  if (!isConnected) {
    return (
      <div className="mx-auto">
        <button className={buttonClass} disabled={isConnected} onClick={connect}>
          <span className="text-4xl p-6">Connect to MetaMask</span>
        </button>
      </div>
    );
  }

  if (isDeployed === false) {
    return errorNotDeployed(chainId);
  }

  return (
    <div className="grid w-full gap-4">
      <div className="col-span-full mx-20 bg-black text-white">
        <p className="font-semibold text-3xl m-5">
          FHEVM React Minimal Template -{" "}
          <span className="font-mono font-normal text-gray-400">SealedBidAuction.sol</span>
        </p>
      </div>
      <div className="col-span-full mx-20 mt-4 px-5 pb-4 rounded-lg bg-white border-2 border-black">
        <p className={titleClass}>Chain Infos</p>
        {printProperty("ChainId", chainId)}
        {printProperty(
          "Metamask accounts",
          accounts
            ? accounts.length === 0
              ? "No accounts"
              : `{ length: ${accounts.length}, [${accounts[0]}, ...] }`
            : "undefined",
        )}
        {printProperty("SealedBidAuction", contractAddress)}
        {printProperty("isDeployed", isDeployed)}
        {printProperty("Is Admin", isAdmin)}
      </div>
      <div className="col-span-full mx-20 px-4 pb-4 rounded-lg bg-white border-2 border-black">
        <p className={titleClass}>Auction State</p>
        {printProperty("Auction Item", auctionItem || "Not set")}
        {printProperty("Auction Started", auctionStarted)}
        {printProperty("Auction Ended", auctionEnded)}
        {printProperty("Start Time", startTime ? new Date(startTime * 1000).toLocaleString() : "Not started")}
        {printProperty("End Time", endTime ? new Date(endTime * 1000).toLocaleString() : "Not started")}
        {printProperty("Current Timestamp", currentTimestamp ? new Date(currentTimestamp * 1000).toLocaleString() : "N/A")}
        {printProperty("User Deposit", `${ethers.formatEther(deposit)} ETH`)}
        {printProperty("Winner", winner === ethers.ZeroAddress ? "Not announced" : winner)}
        {printProperty("Winning Amount", `${ethers.formatEther(winningAmount)} ETH`)}
      </div>
      <div className="grid grid-cols-3 mx-20 gap-4">
        <button
          className={buttonClass}
          disabled={!canGetState}
          onClick={refreshState}
        >
          {canGetState ? "Refresh State" : "SealedBidAuction is not available"}
        </button>
        <div>
          <input
            type="number"
            placeholder="Duration (seconds)"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
            className="border-2 border-black p-2 rounded mb-2 w-full"
            disabled={!canStartAuction}
            min="1"
          />
          <button
            className={buttonClass}
            disabled={!canStartAuction || duration <= 0}
            onClick={() => startAuction(duration)}
          >
            {canStartAuction ? "Start Auction" : isStartingAuction ? "Starting..." : "Cannot start auction"}
          </button>
        </div>
        <div>
          <input
            type="text"
            placeholder="Auction Item"
            value={item}
            onChange={(e) => setItem(e.target.value)}
            className="border-2 border-black p-2 rounded mb-2 w-full"
            disabled={!canSetAuctionItem}
          />
          <button
            className={buttonClass}
            disabled={!canSetAuctionItem || !item}
            onClick={() => updateAuctionItem(item)}
          >
            {canSetAuctionItem ? "Set Auction Item" : isSettingItem ? "Setting..." : "Cannot set item"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 mx-20 gap-4">
        <div>
          <input
            type="number"
            placeholder="Bid Amount (wei)"
            value={bidAmount}
            onChange={(e) => setBidAmount(Number(e.target.value))}
            className="border-2 border-black p-2 rounded mb-2 w-full"
            disabled={!canPlaceBid}
            min="1"
          />
          <input
            type="number"
            placeholder="Deposit Amount (wei)"
            value={depositAmount}
            onChange={(e) => setDepositAmount(Number(e.target.value))}
            className="border-2 border-black p-2 rounded mb-2 w-full"
            disabled={!canPlaceBid}
            min="1"
          />
          <button
            className={buttonClass}
            disabled={!canPlaceBid || bidAmount <= 0 || depositAmount <= 0}
            onClick={() => placeBid(bidAmount, depositAmount)}
          >
            {canPlaceBid ? "Place Bid" : isPlacingBid ? "Placing..." : "Cannot place bid"}
          </button>
        </div>
        <button
          className={buttonClass}
          disabled={!canEndAuction}
          onClick={endAuction}
        >
          {canEndAuction ? "End Auction" : isEndingAuction ? "Ending..." : "Cannot end auction"}
        </button>
        <button
          className={buttonClass}
          disabled={!canRequestDecryption}
          onClick={requestDecryption}
        >
          {canRequestDecryption ? "Request Decryption" : isRequestingDecryption ? "Requesting..." : "Cannot request decryption"}
        </button>
      </div>
      <div className="grid grid-cols-3 mx-20 gap-4">
        <button
          className={buttonClass}
          disabled={!canRefund}
          onClick={refund}
        >
          {canRefund ? "Refund" : isRefunding ? "Refunding..." : "Cannot refund"}
        </button>
        <button
          className={buttonClass}
          disabled={!canResetAuction}
          onClick={resetAuction}
        >
          {canResetAuction ? "Reset Auction" : isResettingAuction ? "Resetting..." : "Cannot reset auction"}
        </button>
        <button
          className={buttonClass}
          disabled={!canWithdrawProceeds}
          onClick={withdrawTotalProceeds}
        >
          {canWithdrawProceeds ? "Withdraw Proceeds" : isWithdrawingProceeds ? "Withdrawing..." : "Cannot withdraw proceeds"}
        </button>
      </div>
      <div className="col-span-full mx-20 p-4 rounded-lg bg-white border-2 border-black">
        {printProperty("Message", message)}
      </div>
    </div>
  );
};

// printProperty and printBooleanProperty
function printProperty(name: string, value: unknown) {
  let displayValue: string;

  if (typeof value === "boolean") {
    return printBooleanProperty(name, value);
  } else if (typeof value === "string" || typeof value === "number") {
    displayValue = String(value);
  } else if (typeof value === "bigint") {
    displayValue = String(value);
  } else if (value === null) {
    displayValue = "null";
  } else if (value === undefined) {
    displayValue = "undefined";
  } else if (value instanceof Error) {
    displayValue = value.message;
  } else {
    displayValue = JSON.stringify(value);
  }
  return (
    <p className="text-black">
      {name}: <span className="font-mono font-semibold text-black">{displayValue}</span>
    </p>
  );
}

function printBooleanProperty(name: string, value: boolean) {
  if (value) {
    return (
      <p className="text-black">
        {name}: <span className="font-mono font-semibold text-green-500">true</span>
      </p>
    );
  }

  return (
    <p className="text-black">
      {name}: <span className="font-mono font-semibold text-red-500">false</span>
    </p>
  );
}