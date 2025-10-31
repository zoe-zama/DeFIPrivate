"use client";

import { ethers } from "ethers";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { DeFiContractAddresses } from "@/abi/DeFiContractAddresses";
import { DeFiContractABI } from "@/abi/DeFiContractABI";

type DeFiContractInfoType = {
  abi: typeof DeFiContractABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getDeFiContractByChainId(chainId: number | undefined): DeFiContractInfoType {
  if (!chainId) {
    return { abi: DeFiContractABI.abi };
  }

  const chainIdStr = chainId.toString() as keyof typeof DeFiContractAddresses;
  const entry = DeFiContractAddresses[chainIdStr];

  if (!entry || !("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: DeFiContractABI.abi, chainId };
  }

  return {
    address: entry?.address as `0x${string}` | undefined,
    chainId: entry?.chainId ?? chainId,
    chainName: entry?.chainName,
    abi: DeFiContractABI.abi,
  };
}

export const useDeFiContract = (parameters: {
  instance: FhevmInstance | undefined;
  fhevmDecryptionSignatureStorage: GenericStringStorage;
  eip1193Provider: ethers.Eip1193Provider | undefined;
  chainId: number | undefined;
  ethersSigner: ethers.JsonRpcSigner | undefined;
  ethersReadonlyProvider: ethers.ContractRunner | undefined;
  sameChain: RefObject<(chainId: number | undefined) => boolean>;
  sameSigner: RefObject<(ethersSigner: ethers.JsonRpcSigner | undefined) => boolean>;
}) => {
  const {
    instance,
    fhevmDecryptionSignatureStorage,
    eip1193Provider,
    chainId,
    ethersSigner,
    ethersReadonlyProvider,
    sameChain,
    sameSigner,
  } = parameters;

  // States and Refs
  const [lender, setLender] = useState<string>(ethers.ZeroAddress);
  const [actualPool, setActualPool] = useState<string>("0");
  const [isLender, setIsLender] = useState<boolean>(false);
  const [creditSubmitted, setCreditSubmitted] = useState<boolean>(false);
  const [chosenPackage, setChosenPackage] = useState<string>("None");
  const [decryptedTotalRepay, setDecryptedTotalRepay] = useState<string>("0");
  const [hasActiveLoan, setHasActiveLoan] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isDepositing, setIsDepositing] = useState<boolean>(false);
  const [isSubmittingCredit, setIsSubmittingCredit] = useState<boolean>(false);
  const [isChoosingPackage, setIsChoosingPackage] = useState<boolean>(false);
  const [isRequestingBorrow, setIsRequestingBorrow] = useState<boolean>(false);
  const [isRepaying, setIsRepaying] = useState<boolean>(false);
  const [isWithdrawing, setIsWithdrawing] = useState<boolean>(false);

  const deFiContractRef = useRef<DeFiContractInfoType | undefined>(undefined);
  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const isDepositingRef = useRef<boolean>(isDepositing);
  const isSubmittingCreditRef = useRef<boolean>(isSubmittingCredit);
  const isChoosingPackageRef = useRef<boolean>(isChoosingPackage);
  const isRequestingBorrowRef = useRef<boolean>(isRequestingBorrow);
  const isRepayingRef = useRef<boolean>(isRepaying);
  const isWithdrawingRef = useRef<boolean>(isWithdrawing);
  const pendingBorrowAmountRef = useRef<string>("0");

  // Contract
  const deFiContract = useMemo(() => {
    const c = getDeFiContractByChainId(chainId);
    deFiContractRef.current = c;
    if (!c.address) {
      setMessage(`DeFiContract deployment not found for chainId=${chainId}.`);
    }
    return c;
  }, [chainId]);

  const isDeployed = useMemo(() => {
    if (!deFiContract) return undefined;
    return Boolean(deFiContract.address) && deFiContract.address !== ethers.ZeroAddress;
  }, [deFiContract]);

  const canGetState = useMemo(() => {
    return deFiContract.address && ethersReadonlyProvider && eip1193Provider && !isRefreshing;
  }, [deFiContract.address, ethersReadonlyProvider, eip1193Provider, isRefreshing]);

  const canDeposit = useMemo(() => {
    return deFiContract.address && instance && ethersSigner && isLender && !isRefreshing && !isDepositing;
  }, [deFiContract.address, instance, ethersSigner, isLender, isRefreshing, isDepositing]);

  const canSubmitCredit = useMemo(() => {
    return deFiContract.address && instance && ethersSigner && !isLender && !creditSubmitted && !isRefreshing && !isSubmittingCredit;
  }, [deFiContract.address, instance, ethersSigner, isLender, creditSubmitted, isRefreshing, isSubmittingCredit]);

  const canChoosePackage = useMemo(() => {
    return deFiContract.address && ethersSigner && !isLender && creditSubmitted && chosenPackage === "None" && !isRefreshing && !isChoosingPackage;
  }, [deFiContract.address, ethersSigner, isLender, creditSubmitted, chosenPackage, isRefreshing, isChoosingPackage]);

  const canRequestBorrow = useMemo(() => {
    return (
      deFiContract.address &&
      instance &&
      ethersSigner &&
      !isLender &&
      !hasActiveLoan &&
      creditSubmitted &&
      chosenPackage !== "None" &&
      !isRefreshing &&
      !isRequestingBorrow &&
      Number(actualPool) > 0
    );
  }, [
    deFiContract.address,
    instance,
    ethersSigner,
    isLender,
    hasActiveLoan,
    creditSubmitted,
    chosenPackage,
    isRefreshing,
    isRequestingBorrow,
    actualPool
  ]);

  const canRepay = useMemo(() => {
    return (
      deFiContract.address &&
      instance &&
      ethersSigner &&
      !isLender &&
      hasActiveLoan &&
      !isRefreshing &&
      !isRepaying &&
      Number(decryptedTotalRepay) > 0
    );
  }, [
    deFiContract.address,
    instance,
    ethersSigner,
    isLender,
    hasActiveLoan,
    isRefreshing,
    isRepaying,
    decryptedTotalRepay
  ]);

  const canWithdrawPool = useMemo(() => {
    return deFiContract.address && ethersSigner && isLender && !isRefreshing && !isWithdrawing;
  }, [deFiContract.address, ethersSigner, isLender, isRefreshing, isWithdrawing]);

  // Refresh State
  const refreshState = useCallback(async () => {
    if (isRefreshingRef.current) {
      setMessage("Refresh already in progress...");
      return;
    }

    if (
      !deFiContractRef.current ||
      !deFiContractRef.current?.chainId ||
      !deFiContractRef.current?.address ||
      !ethersReadonlyProvider ||
      !ethersSigner ||
      !eip1193Provider
    ) {
      setMessage("Missing required parameters for refresh");
      return;
    }

    isRefreshingRef.current = true;
    setIsRefreshing(true);
    setMessage("Refreshing state...");

    const thisChainId = deFiContractRef.current.chainId;
    const thisDeFiContractAddress = deFiContractRef.current.address;

    const thisDeFiContractContract = new ethers.Contract(
      thisDeFiContractAddress,
      deFiContractRef.current.abi,
      ethersReadonlyProvider,
    );

    try {
      const userAddress = await ethersSigner.getAddress();

      setLender(await thisDeFiContractContract.lender());
      setIsLender((await thisDeFiContractContract.lender()).toLowerCase() === userAddress.toLowerCase());
      setActualPool((await thisDeFiContractContract.actualPool()).toString());
      setCreditSubmitted(await thisDeFiContractContract.creditProfiles(userAddress).then((p: any) => p.submitted));

      const packageId = await thisDeFiContractContract.chosenPackage(userAddress);
      const packageNames = ["", "1 month (6% APR)", "6 months (8% APR)", "12 months (10% APR)"];
      setChosenPackage(packageNames[Number(packageId)] || "None");

      const agreed = await thisDeFiContractContract.agreed(userAddress);
      setHasActiveLoan(agreed);

      const loanAmount = await thisDeFiContractContract.loans(userAddress);
      setDecryptedTotalRepay(loanAmount.toString());

      if (sameChain.current(thisChainId) && thisDeFiContractAddress === deFiContractRef.current?.address) {
        setMessage("State refreshed successfully");
      }
    } catch (e) {
      setMessage(`State refresh failed: ${(e as Error).message}`);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      setTimeout(() => setMessage(""), 3000);
    }
  }, [ethersReadonlyProvider, eip1193Provider, ethersSigner, sameChain]);

  // Auto refresh on mount
  useEffect(() => {
    refreshState();
  }, [refreshState]);

  // Listen for Events
  useEffect(() => {
    if (!deFiContract.address || !ethersReadonlyProvider) return;

    const contract = new ethers.Contract(
      deFiContract.address,
      deFiContract.abi,
      ethersReadonlyProvider,
    );

    const userAddress = ethersSigner ? ethersSigner.address.toLowerCase() : undefined;

    if (userAddress) {
      contract.on("PackageChosen", (borrower, packageId) => {
        if (borrower.toLowerCase() === userAddress) {
          const packageNames = ["", "1 month (6% APR)", "6 months (8% APR)", "12 months (10% APR)"];
          setChosenPackage(packageNames[Number(packageId)]);
          setMessage(`Package ${packageId} chosen successfully`);
        }
      });

      contract.on("BorrowConfirmed", async (borrower, amount, totalRepay, durationDays) => {
        if (borrower.toLowerCase() === userAddress) {
          setMessage(`Borrow confirmed: ${ethers.formatEther(amount)} ETH borrowed, repay ${ethers.formatEther(totalRepay)} ETH in ${durationDays} days`);
          setHasActiveLoan(true);
          setDecryptedTotalRepay(totalRepay.toString());
          pendingBorrowAmountRef.current = "0";
          await refreshState();
        }
      });

      contract.on("Repaid", async (borrower, amount) => {
        if (borrower.toLowerCase() === userAddress) {
          setMessage(`Repaid: ${ethers.formatEther(amount)} ETH`);
          setHasActiveLoan(false);
          setDecryptedTotalRepay("0");
          await refreshState();
        }
      });
    }

    return () => {
      contract.removeAllListeners();
    };
  }, [deFiContract.address, ethersReadonlyProvider, ethersSigner, refreshState]);

  // Choose Package
  const choosePackage = useCallback(
    async (packageId: 1 | 2 | 3) => {
      if (isRefreshingRef.current || isChoosingPackageRef.current) {
        setMessage("Choosing package already in progress...");
        return;
      }

      if (!deFiContract.address || !ethersSigner) {
        setMessage("Missing parameters for choose package");
        return;
      }

      const thisChainId = chainId;
      const thisDeFiContractAddress = deFiContract.address;
      const thisEthersSigner = ethersSigner;
      const thisDeFiContractContract = new ethers.Contract(
        thisDeFiContractAddress,
        deFiContract.abi,
        thisEthersSigner,
      );

      isChoosingPackageRef.current = true;
      setIsChoosingPackage(true);
      setMessage("Preparing to choose package...");

      const isStale = () =>
        thisDeFiContractAddress !== deFiContractRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        setMessage(`Sending choose package ${packageId} transaction...`);
        const tx = await thisDeFiContractContract.choosePackage(packageId);
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();
        if (receipt?.status !== 1) {
          throw new Error("Transaction failed");
        }

        const packageNames = ["", "1 month (6% APR)", "6 months (8% APR)", "12 months (10% APR)"];
        setChosenPackage(packageNames[packageId]);
        setMessage(`Package ${packageId} chosen successfully`);

        setTimeout(() => {
          if (!isStale()) refreshState();
        }, 2000);
      } catch (e) {
        setMessage(`Choose package failed: ${(e as Error).message}`);
      } finally {
        isChoosingPackageRef.current = false;
        setIsChoosingPackage(false);
        setTimeout(() => setMessage(""), 5000);
      }
    },
    [deFiContract.address, ethersSigner, chainId, refreshState, sameChain, sameSigner],
  );

  // Request Borrow
  const requestBorrow = useCallback(
    async (amount: number) => {
      if (isRefreshingRef.current || isRequestingBorrowRef.current) {
        setMessage("Borrow request already in progress...");
        return;
      }

      if (!deFiContract.address || !ethersSigner || !instance || amount > Number.MAX_SAFE_INTEGER || amount <= 0) {
        setMessage("Invalid or missing parameters for borrow request");
        return;
      }

      const thisChainId = chainId;
      const thisDeFiContractAddress = deFiContract.address;
      const thisEthersSigner = ethersSigner;
      const thisDeFiContractContract = new ethers.Contract(
        thisDeFiContractAddress,
        deFiContract.abi,
        thisEthersSigner,
      );

      isRequestingBorrowRef.current = true;
      setIsRequestingBorrow(true);
      setMessage("Preparing borrow request...");

      const isStale = () =>
        thisDeFiContractAddress !== deFiContractRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        setMessage(`Encrypting borrow amount (${ethers.formatEther(amount)} ETH)...`);
        const enc = await instance.createEncryptedInput(thisDeFiContractAddress, ethersSigner.address).add64(amount).encrypt();
        setMessage("Sending borrow request transaction...");
        const tx = await thisDeFiContractContract.requestBorrow(enc.handles[0], enc.inputProof);
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();
        if (receipt?.status !== 1) {
          throw new Error("Transaction failed");
        }

        setMessage(`Borrow request for ${ethers.formatEther(amount)} ETH submitted`);
        setHasActiveLoan(true);
        pendingBorrowAmountRef.current = amount.toString();

        if (!isStale()) {
          await refreshState();
        }
      } catch (e) {
        setMessage(`Borrow request failed: ${(e as Error).message}`);
      } finally {
        isRequestingBorrowRef.current = false;
        setIsRequestingBorrow(false);
        setTimeout(() => setMessage(""), 5000);
      }
    },
    [deFiContract.address, ethersSigner, instance, chainId, refreshState, sameChain, sameSigner],
  );

  // Deposit
  const deposit = useCallback(
    async (amount: number) => {
      if (isRefreshingRef.current || isDepositingRef.current) {
        setMessage("Deposit already in progress...");
        return;
      }

      if (!deFiContract.address || !ethersSigner || !instance || amount > Number.MAX_SAFE_INTEGER || amount <= 0) {
        setMessage("Invalid or missing parameters for deposit");
        return;
      }

      const thisChainId = chainId;
      const thisDeFiContractAddress = deFiContract.address;
      const thisEthersSigner = ethersSigner;
      const thisDeFiContractContract = new ethers.Contract(
        thisDeFiContractAddress,
        deFiContract.abi,
        thisEthersSigner,
      );

      isDepositingRef.current = true;
      setIsDepositing(true);
      setMessage("Preparing deposit...");

      const isStale = () =>
        thisDeFiContractAddress !== deFiContractRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        setMessage("Encrypting deposit amount...");
        const enc = await instance.createEncryptedInput(thisDeFiContractAddress, ethersSigner.address).add64(amount).encrypt();
        setMessage(`Sending deposit transaction for ${ethers.formatEther(amount)} ETH...`);
        const tx = await thisDeFiContractContract.deposit(enc.handles[0], enc.inputProof, { value: amount });
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();
        if (receipt?.status !== 1) {
          throw new Error("Transaction failed");
        }
        setMessage(`Deposit of ${ethers.formatEther(amount)} ETH successful`);
        if (!isStale()) {
          await refreshState();
        }
      } catch (e) {
        setMessage(`Deposit failed: ${(e as Error).message}`);
      } finally {
        isDepositingRef.current = false;
        setIsDepositing(false);
        setTimeout(() => setMessage(""), 5000);
      }
    },
    [deFiContract.address, ethersSigner, instance, chainId, refreshState, sameChain, sameSigner],
  );

  // Submit Credit Profile
  const submitCreditProfile = useCallback(
    async (salary: number, creditScore: number) => {
      if (isRefreshingRef.current || isSubmittingCreditRef.current) {
        setMessage("Submitting credit already in progress...");
        return;
      }

      if (!deFiContract.address || !ethersSigner || !instance || salary <= 0 || creditScore <= 0) {
        setMessage("Invalid or missing parameters for submit credit");
        return;
      }

      const thisChainId = chainId;
      const thisDeFiContractAddress = deFiContract.address;
      const thisEthersSigner = ethersSigner;
      const thisDeFiContractContract = new ethers.Contract(
        thisDeFiContractAddress,
        deFiContract.abi,
        thisEthersSigner,
      );

      isSubmittingCreditRef.current = true;
      setIsSubmittingCredit(true);
      setMessage("Preparing to submit credit profile...");

      const isStale = () =>
        thisDeFiContractAddress !== deFiContractRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        setMessage("Encrypting salary and credit score...");
        const encSalary = await instance.createEncryptedInput(thisDeFiContractAddress, ethersSigner.address)
          .add64(salary)
          .encrypt();
        const encCreditScore = await instance.createEncryptedInput(thisDeFiContractAddress, ethersSigner.address)
          .add64(creditScore)
          .encrypt();
        setMessage("Sending submit credit transaction...");
        const tx = await thisDeFiContractContract.submitCreditProfile(encSalary.handles[0], encCreditScore.handles[0], encSalary.inputProof, encCreditScore.inputProof);
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();
        if (receipt?.status !== 1) {
          throw new Error("Transaction failed");
        }
        setMessage("Credit profile submitted successfully");
        if (!isStale()) {
          setCreditSubmitted(true);
          await refreshState();
        }
      } catch (e) {
        setMessage(`Submit credit failed: ${(e as Error).message}`);
      } finally {
        isSubmittingCreditRef.current = false;
        setIsSubmittingCredit(false);
        setTimeout(() => setMessage(""), 5000);
      }
    },
    [deFiContract.address, ethersSigner, instance, chainId, refreshState, sameChain, sameSigner],
  );

  // Repay
  const repay = useCallback(
    async () => {
      if (isRefreshingRef.current || isRepayingRef.current) {
        setMessage("Repay already in progress...");
        return;
      }

      if (!deFiContract.address || !ethersSigner || !instance || Number(decryptedTotalRepay) <= 0) {
        setMessage("Invalid or missing parameters for repay");
        return;
      }

      const amount = Number(decryptedTotalRepay);

      const thisChainId = chainId;
      const thisDeFiContractAddress = deFiContract.address;
      const thisEthersSigner = ethersSigner;
      const thisDeFiContractContract = new ethers.Contract(
        thisDeFiContractAddress,
        deFiContract.abi,
        thisEthersSigner,
      );

      isRepayingRef.current = true;
      setIsRepaying(true);
      setMessage(`Preparing repay of ${ethers.formatEther(amount)} ETH...`);

      const isStale = () =>
        thisDeFiContractAddress !== deFiContractRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        setMessage(`Encrypting repay amount (${ethers.formatEther(amount)} ETH)...`);
        const enc = await instance.createEncryptedInput(thisDeFiContractAddress, ethersSigner.address).add64(amount).encrypt();
        setMessage("Sending repay transaction...");
        const tx = await thisDeFiContractContract.repay(enc.handles[0], enc.inputProof, { value: amount });
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();
        if (receipt?.status !== 1) {
          throw new Error("Transaction failed");
        }
        setMessage(`Repay of ${ethers.formatEther(amount)} ETH successful`);
        if (!isStale()) {
          setHasActiveLoan(false);
          setDecryptedTotalRepay("0");
          await refreshState();
        }
      } catch (e) {
        setMessage(`Repay failed: ${(e as Error).message}`);
      } finally {
        isRepayingRef.current = false;
        setIsRepaying(false);
        setTimeout(() => setMessage(""), 5000);
      }
    },
    [deFiContract.address, ethersSigner, instance, chainId, refreshState, sameChain, sameSigner, decryptedTotalRepay],
  );

  // Withdraw Pool
  const withdrawPool = useCallback(
    async () => {
      if (isRefreshingRef.current || isWithdrawingRef.current) {
        setMessage("Withdrawal already in progress...");
        return;
      }

      if (!deFiContract.address || !ethersSigner) {
        setMessage("Missing parameters for withdrawal");
        return;
      }

      const thisChainId = chainId;
      const thisDeFiContractAddress = deFiContract.address;
      const thisEthersSigner = ethersSigner;
      const thisDeFiContractContract = new ethers.Contract(
        thisDeFiContractAddress,
        deFiContract.abi,
        thisEthersSigner,
      );

      isWithdrawingRef.current = true;
      setIsWithdrawing(true);
      setMessage("Preparing withdrawal...");

      const isStale = () =>
        thisDeFiContractAddress !== deFiContractRef.current?.address ||
        !sameChain.current(thisChainId) ||
        !sameSigner.current(thisEthersSigner);

      try {
        setMessage("Sending withdrawal transaction...");
        const tx = await thisDeFiContractContract.withdrawPool();
        setMessage(`Waiting for transaction ${tx.hash}...`);
        const receipt = await tx.wait();
        if (receipt?.status !== 1) {
          throw new Error("Transaction failed");
        }
        setMessage("Withdrawal successful");
        if (!isStale()) {
          await refreshState();
        }
      } catch (e) {
        setMessage(`Withdrawal failed: ${(e as Error).message}`);
      } finally {
        isWithdrawingRef.current = false;
        setIsWithdrawing(false);
        setTimeout(() => setMessage(""), 5000);
      }
    },
    [deFiContract.address, ethersSigner, chainId, refreshState, sameChain, sameSigner],
  );

  return {
    contractAddress: deFiContract.address,
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
  };
};