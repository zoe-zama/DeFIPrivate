"use client";

import { useFhevm } from "../fhevm/useFhevm";
import { useInMemoryStorage } from "../hooks/useInMemoryStorage";
import { useMetaMaskEthersSigner } from "../hooks/metamask/useMetaMaskEthersSigner";
import { useDeFiContract } from "@/hooks/useDeFiContract";
import { errorNotDeployed } from "./ErrorNotDeployed";
import { useState } from "react";
import { ethers } from "ethers";

export const DeFiContractDemo = () => {
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
    canDeposit,
    canSubmitCredit,
    canChoosePackage,
    canRequestBorrow,
    canRepay,
    canWithdrawPool,
    deposit,
    submitCreditProfile,
    choosePackage,
    requestBorrow,
    repay,
    withdrawPool,
    refreshState,
    message,
    lender,
    actualPool,
    isLender,
    creditSubmitted,
    chosenPackage,
    decryptedTotalRepay,
    hasActiveLoan,
    isRefreshing,
    isDepositing,
    isSubmittingCredit,
    isChoosingPackage,
    isRequestingBorrow,
    isRepaying,
    isWithdrawing,
    isDeployed,
  } = useDeFiContract({
    instance: fhevmInstance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider: provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  });

  const [depositAmount, setDepositAmount] = useState<number>(1000000000000000); // 0.001 ETH in wei
  const [salary, setSalary] = useState<number>(50000); // Example salary
  const [creditScore, setCreditScore] = useState<number>(700); // Example credit score
  const [packageId, setPackageId] = useState<1 | 2 | 3>(1);
  const [borrowAmount, setBorrowAmount] = useState<number>(500000000000000); // 0.0005 ETH in wei

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
          <span className="font-mono font-normal text-gray-400">DeFiContract.sol</span>
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
        {printProperty("DeFiContract", contractAddress)}
        {printProperty("isDeployed", isDeployed)}
        {printProperty("Is Lender", isLender)}
      </div>
      <div className="col-span-full mx-20 px-4 pb-4 rounded-lg bg-white border-2 border-black">
        <p className={titleClass}>Lending State</p>
        {printProperty("Lender", lender)}
        {printProperty("Actual Pool", `${ethers.formatEther(actualPool)} ETH`)}
        {printProperty("Credit Submitted", creditSubmitted)}
        {printProperty("Chosen Package", chosenPackage)}
        {printProperty("Decrypted Total Repay", `${ethers.formatEther(decryptedTotalRepay)} ETH`)}
        {printProperty("Has Active Loan", hasActiveLoan)}
      </div>
      <div className="grid grid-cols-3 mx-20 gap-4">
        <button
          className={buttonClass}
          disabled={!canGetState}
          onClick={refreshState}
        >
          {canGetState ? "Refresh State" : "DeFiContract is not available"}
        </button>
        <div>
          <label>Deposit:</label>
          <input
            type="number"
            placeholder="Deposit Amount (wei)"
            value={depositAmount}
            onChange={(e) => setDepositAmount(Number(e.target.value))}
            className="border-2 border-black p-2 rounded mb-2 w-full"
            disabled={!canDeposit}
            min="1"
          />
          <button
            className={buttonClass}
            disabled={!canDeposit || depositAmount <= 0}
            onClick={() => deposit(depositAmount)}
          >
            {canDeposit ? "Deposit" : isDepositing ? "Depositing..." : "Cannot deposit"}
          </button>
        </div>
        <div>
          <label>Your salary:</label>
          <input
            type="number"
            placeholder="Salary"
            value={salary}
            onChange={(e) => setSalary(Number(e.target.value))}
            className="border-2 border-black p-2 rounded mb-2 w-full"
            disabled={!canSubmitCredit}
            min="1"
          />
          <label>Your credit score:</label>
          <input
            type="number"
            placeholder="Credit Score"
            value={creditScore}
            onChange={(e) => setCreditScore(Number(e.target.value))}
            className="border-2 border-black p-2 rounded mb-2 w-full"
            disabled={!canSubmitCredit}
            min="1"
          />
          <button
            className={buttonClass}
            disabled={!canSubmitCredit || salary <= 0 || creditScore <= 0}
            onClick={() => submitCreditProfile(salary, creditScore)}
          >
            {canSubmitCredit ? "Submit Credit" : isSubmittingCredit ? "Submitting..." : "Cannot submit credit"}
          </button>
        </div>
      </div>
      <div className="grid grid-cols-3 mx-20 gap-4">
        <div>
        <label>Chose package:</label>
          <select
            value={packageId}
            onChange={(e) => setPackageId(Number(e.target.value) as 1 | 2 | 3)}
            className="border-2 border-black p-2 rounded mb-2 w-full"
            disabled={!canChoosePackage}
          >
            <option value={1}>1 month (6% APR)</option>
            <option value={2}>6 months (8% APR)</option>
            <option value={3}>12 months (10% APR)</option>
          </select>
          <button
            className={buttonClass}
            disabled={!canChoosePackage}
            onClick={() => choosePackage(packageId)}
          >
            {canChoosePackage ? "Choose Package" : isChoosingPackage ? "Choosing..." : "Cannot choose package"}
          </button>
        </div>
        <div>
        <label>Borrow:</label>
          <input
            type="number"
            placeholder="Borrow Amount (wei)"
            value={borrowAmount}
            onChange={(e) => setBorrowAmount(Number(e.target.value))}
            className="border-2 border-black p-2 rounded mb-2 w-full"
            disabled={!canRequestBorrow}
            min="1"
          />
          <button
            className={buttonClass}
            disabled={!canRequestBorrow || borrowAmount <= 0}
            onClick={() => requestBorrow(borrowAmount)}
          >
            {canRequestBorrow ? "Request Borrow" : isRequestingBorrow ? "Requesting..." : "Cannot request borrow"}
          </button>
        </div>
        <button
          className={buttonClass}
          disabled={!canRepay}
          onClick={repay}
        >
          {canRepay ? "Repay Full" : isRepaying ? "Repaying..." : "Cannot repay"}
        </button>
      </div>
      <div className="grid grid-cols-3 mx-20 gap-4">
        <button
          className={buttonClass}
          disabled={!canWithdrawPool}
          onClick={withdrawPool}
        >
          {canWithdrawPool ? "Withdraw Pool" : isWithdrawing ? "Withdrawing..." : "Cannot withdraw"}
        </button>
      </div>
      <div className="col-span-full mx-20 p-4 rounded-lg bg-white border-2 border-black">
        {printProperty("Message", message)}
      </div>
    </div>
  );
};

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