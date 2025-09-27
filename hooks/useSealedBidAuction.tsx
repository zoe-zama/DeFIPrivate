
"use client";

import { ethers } from "ethers";
import { RefObject, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { FhevmInstance } from "@/fhevm/fhevmTypes";
import { GenericStringStorage } from "@/fhevm/GenericStringStorage";
import { SealedBidAuctionAddresses } from "@/abi/SealedBidAuctionAddresses";
import { SealedBidAuctionABI } from "@/abi/SealedBidAuctionABI";

type SealedBidAuctionInfoType = {
  abi: typeof SealedBidAuctionABI.abi;
  address?: `0x${string}`;
  chainId?: number;
  chainName?: string;
};

function getSealedBidAuctionByChainId(chainId: number | undefined): SealedBidAuctionInfoType {
  if (!chainId) {
    return { abi: SealedBidAuctionABI.abi };
  }

  const chainIdStr = chainId.toString() as keyof typeof SealedBidAuctionAddresses;
  const entry = SealedBidAuctionAddresses[chainIdStr];

  if (!entry || !("address" in entry) || entry.address === ethers.ZeroAddress) {
    return { abi: SealedBidAuctionABI.abi, chainId };
  }

  return {
    address: entry?.address as `0x${string}` | undefined,
    chainId: entry?.chainId ?? chainId,
    chainName: entry?.chainName,
    abi: SealedBidAuctionABI.abi,
  };
}

export const useSealedBidAuction = (parameters: {
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
  const [auctionItem, setAuctionItem] = useState<string>("");
  const [startTime, setStartTime] = useState<number>(0);
  const [endTime, setEndTime] = useState<number>(0);
  const [auctionStarted, setAuctionStarted] = useState<boolean>(false);
  const [auctionEnded, setAuctionEnded] = useState<boolean>(false);
  const [deposit, setDeposit] = useState<string>("0");
  const [winner, setWinner] = useState<string>(ethers.ZeroAddress);
  const [winningAmount, setWinningAmount] = useState<number>(0);
  const [decryptedTotalWinningAmount, setDecryptedTotalWinningAmount] = useState<string>("0");
  const [isAdmin, setIsAdmin] = useState<boolean>(false);
  const [currentTimestamp, setCurrentTimestamp] = useState<number>(0);
  const [isRefreshing, setIsRefreshing] = useState<boolean>(false);
  const [isStartingAuction, setIsStartingAuction] = useState<boolean>(false);
  const [isSettingItem, setIsSettingItem] = useState<boolean>(false);
  const [isPlacingBid, setIsPlacingBid] = useState<boolean>(false);
  const [isEndingAuction, setIsEndingAuction] = useState<boolean>(false);
  const [isRequestingDecryption, setIsRequestingDecryption] = useState<boolean>(false);
  const [isRefunding, setIsRefunding] = useState<boolean>(false);
  const [isResettingAuction, setIsResettingAuction] = useState<boolean>(false);
  const [isWithdrawingProceeds, setIsWithdrawingProceeds] = useState<boolean>(false);
  const [message, setMessage] = useState<string>("");
  const [isComplatedDecrypt, setIsComplatedDecrypt] = useState<boolean>(false);
  const [hasFetchedWinner, setHasFetchedWinner] = useState<boolean>(false);
  const [auctionSessionId, setAuctionSessionId] = useState<number>(0);

  const sealedBidAuctionRef = useRef<SealedBidAuctionInfoType | undefined>(undefined);
  const isRefreshingRef = useRef<boolean>(isRefreshing);
  const isStartingAuctionRef = useRef<boolean>(isStartingAuction);
  const isSettingItemRef = useRef<boolean>(isSettingItem);
  const isPlacingBidRef = useRef<boolean>(isPlacingBid);
  const isEndingAuctionRef = useRef<boolean>(isEndingAuction);
  const isRequestingDecryptionRef = useRef<boolean>(isRequestingDecryption);
  const isRefundingRef = useRef<boolean>(isRefunding);
  const isResettingAuctionRef = useRef<boolean>(isResettingAuction);
  const isWithdrawingProceedsRef = useRef<boolean>(isWithdrawingProceeds);

  // SealedBidAuction Contract
  const sealedBidAuction = useMemo(() => {
    const c = getSealedBidAuctionByChainId(chainId);

    sealedBidAuctionRef.current = c;

    if (!c.address) {
      setMessage(`SealedBidAuction deployment not found for chainId=${chainId}.`);
    }

    return c;
  }, [chainId]);

  // isDeployed
  const isDeployed = useMemo(() => {
    if (!sealedBidAuction) {
      return undefined;
    }
    return Boolean(sealedBidAuction.address) && sealedBidAuction.address !== ethers.ZeroAddress;
  }, [sealedBidAuction]);

  // canGetState
  const canGetState = useMemo(() => {
    return sealedBidAuction.address && ethersReadonlyProvider && eip1193Provider && !isRefreshing;
  }, [sealedBidAuction.address, ethersReadonlyProvider, eip1193Provider, isRefreshing]);

  // canStartAuction
  const canStartAuction = useMemo(() => {
    return sealedBidAuction.address && ethersSigner && !isRefreshing && !isStartingAuction && !auctionStarted;
  }, [sealedBidAuction.address, ethersSigner, isRefreshing, isStartingAuction, auctionStarted]);

  // canSetAuctionItem
  const canSetAuctionItem = useMemo(() => {
    return sealedBidAuction.address && ethersSigner && isAdmin && !isRefreshing && !isSettingItem;
  }, [sealedBidAuction.address, ethersSigner, isAdmin, isRefreshing, isSettingItem]);

  // canPlaceBid
  const canPlaceBid = useMemo(() => {
    return sealedBidAuction.address && instance && ethersSigner && !isRefreshing && !isPlacingBid && auctionStarted && !auctionEnded && currentTimestamp >= startTime && currentTimestamp <= endTime;
  }, [sealedBidAuction.address, instance, ethersSigner, isRefreshing, isPlacingBid, auctionStarted, auctionEnded, currentTimestamp, startTime, endTime]);

  // canEndAuction
  const canEndAuction = useMemo(() => {
    return sealedBidAuction.address && ethersSigner && isAdmin && !isRefreshing && !isEndingAuction && auctionStarted && !auctionEnded;
  }, [sealedBidAuction.address, ethersSigner, isAdmin, isRefreshing, isEndingAuction, auctionStarted, auctionEnded]);

  // canRequestDecryption
  const canRequestDecryption = useMemo(() => {
    return sealedBidAuction.address && ethersSigner && isAdmin && !isRefreshing && !isRequestingDecryption && auctionEnded;
  }, [sealedBidAuction.address, ethersSigner, isAdmin, isRefreshing, isRequestingDecryption, auctionEnded]);

  // canRefund
  const canRefund = useMemo(() => {
    return sealedBidAuction.address && ethersSigner && !isRefreshing && !isRefunding && auctionEnded && winner !== ethers.ZeroAddress && Number(winningAmount) > 0 && Number(deposit) > 0;
  }, [sealedBidAuction.address, ethersSigner, isRefreshing, isRefunding, auctionEnded, winner, winningAmount, deposit]);

  // canResetAuction
  const canResetAuction = useMemo(() => {
    return sealedBidAuction.address && ethersSigner && isAdmin && !isRefreshing && !isResettingAuction && auctionEnded;
  }, [sealedBidAuction.address, ethersSigner, isAdmin, isRefreshing, isResettingAuction, auctionEnded]);

  // canWithdrawProceeds
  const canWithdrawProceeds = useMemo(() => {
    return sealedBidAuction.address && ethersSigner && isAdmin && !isRefreshing && !isWithdrawingProceeds;
  }, [sealedBidAuction.address, ethersSigner, isAdmin, isRefreshing, isWithdrawingProceeds]);

  // Refresh State
  const refreshState = useCallback(async () => {
    console.log("[useSealedBidAuction] Starting refreshState");
    if (isRefreshingRef.current) {
      console.log("[useSealedBidAuction] Already refreshing, skipping");
      return;
    }

    if (
      !sealedBidAuctionRef.current ||
      !sealedBidAuctionRef.current?.chainId ||
      !sealedBidAuctionRef.current?.address ||
      !ethersReadonlyProvider ||
      !ethersSigner ||
      !eip1193Provider
    ) {
      console.log("[useSealedBidAuction] Missing required parameters for refresh");
      return;
    }

    await new Promise((resolve) => setTimeout(resolve, 500));

    isRefreshingRef.current = true;
    setIsRefreshing(true);

    const thisChainId = sealedBidAuctionRef.current.chainId;
    const thisSealedBidAuctionAddress = sealedBidAuctionRef.current.address;

    const thisSealedBidAuctionContract = new ethers.Contract(
      thisSealedBidAuctionAddress,
      sealedBidAuctionRef.current.abi,
      ethersReadonlyProvider,
    );

    try {
      const provider = new ethers.BrowserProvider(eip1193Provider);
      const latestBlock = await provider.getBlock("latest");
      const currentTs = latestBlock ? latestBlock.timestamp : 0;
      console.log("[useSealedBidAuction] Current Timestamp:", currentTs);
      setCurrentTimestamp(currentTs);

      const userAddress = await ethersSigner.getAddress();
      console.log("[useSealedBidAuction] User Address:", userAddress);

      // Get auction state
      const adminAddr = await thisSealedBidAuctionContract.admin();
      setIsAdmin(adminAddr.toLowerCase() === userAddress.toLowerCase());
      setAuctionItem(await thisSealedBidAuctionContract.auctionItem());
      const newStartTime = Number(await thisSealedBidAuctionContract.startTime());
      setStartTime(newStartTime);
      setEndTime(Number(await thisSealedBidAuctionContract.endTime()));
      setAuctionStarted(await thisSealedBidAuctionContract.auctionStarted());
      const ended = await thisSealedBidAuctionContract.auctionEnded();
      setAuctionEnded(ended);
      setDeposit((await thisSealedBidAuctionContract.deposits(userAddress)).toString());
      setDecryptedTotalWinningAmount((await thisSealedBidAuctionContract.decryptedTotalWinningAmount()).toString());

      // Check if auction session has changed
      if (newStartTime !== auctionSessionId && newStartTime !== 0) {
        setAuctionSessionId(newStartTime);
        setHasFetchedWinner(false);
        setIsComplatedDecrypt(false);
        setWinner(ethers.ZeroAddress);
        setWinningAmount(0);
      }

      // Call getWinnerInfo only if decryption is completed and not yet fetched for this session
      if (ended && isComplatedDecrypt && !hasFetchedWinner) {
        try {
          const [win, winAmt] = await thisSealedBidAuctionContract.getWinnerInfo();
          console.log("[useSealedBidAuction] Winner:", win, "Winning Amount:", winAmt);
          setWinner(win);
          setWinningAmount(Number(winAmt));
          setHasFetchedWinner(true);
        } catch (e) {
          console.warn("[useSealedBidAuction] getWinnerInfo failed, likely winner not announced:", (e as Error).message);
          setWinner(ethers.ZeroAddress);
          setWinningAmount(0);
        }
      } else if (!ended || !isComplatedDecrypt) {
        setWinner(ethers.ZeroAddress);
        setWinningAmount(0);
      }

      if (sameChain.current(thisChainId) && thisSealedBidAuctionAddress === sealedBidAuctionRef.current?.address) {
        console.log("[useSealedBidAuction] States updated successfully");
      }
    } catch (e) {
      console.error("[useSealedBidAuction] State refresh failed:", (e as Error).message);
      setMessage("SealedBidAuction state refresh failed! error=" + (e as Error).message);
    } finally {
      isRefreshingRef.current = false;
      setIsRefreshing(false);
      console.log("[useSealedBidAuction] Refresh completed");
    }
  }, [ethersReadonlyProvider, eip1193Provider, ethersSigner, sameChain, isComplatedDecrypt, hasFetchedWinner, auctionSessionId]);

  // Auto refresh
  useEffect(() => {
    console.log("[useSealedBidAuction] Triggering auto-refresh");
    refreshState();
  }, [refreshState]);

  // Listen for Events
  useEffect(() => {
    if (!sealedBidAuction.address || !ethersReadonlyProvider) return;

    const contract = new ethers.Contract(
      sealedBidAuction.address,
      sealedBidAuction.abi,
      ethersReadonlyProvider,
    );

    const userAddress = ethersSigner ? ethersSigner.address.toLowerCase() : undefined;

    if (userAddress) {
      const auctionStartedFilter = contract.filters.AuctionStarted(userAddress);
      contract.on(auctionStartedFilter, (admin, start, end) => {
        console.log("[useSealedBidAuction] AuctionStarted event received");
        setMessage("Auction started successfully");
        setAuctionSessionId(Number(start));
        setHasFetchedWinner(false);
        setIsComplatedDecrypt(false);
        refreshState();
      });

      const winnerAnnouncedFilter = contract.filters.AuctionWinnerAnnounced();
      contract.on(winnerAnnouncedFilter, (winner, amount) => {
        console.log("[useSealedBidAuction] AuctionWinnerAnnounced event received");
        setMessage(`Winner announced: ${winner} with ${amount} wei`);
        refreshState();
      });

      const proceedsWithdrawnFilter = contract.filters.TotalProceedsWithdrawn(userAddress);
      contract.on(proceedsWithdrawnFilter, (admin, amount) => {
        console.log("[useSealedBidAuction] TotalProceedsWithdrawn event received");
        setMessage(`Proceeds withdrawn: ${amount} wei`);
        refreshState();
      });
    }

    return () => {
      contract.removeAllListeners("AuctionStarted");
      contract.removeAllListeners("AuctionWinnerAnnounced");
      contract.removeAllListeners("TotalProceedsWithdrawn");
    };
  }, [sealedBidAuction.address, ethersReadonlyProvider, ethersSigner, refreshState]);

  // Start Auction
  const startAuction = useCallback(
    async (duration: number) => {
      if (isRefreshingRef.current || isStartingAuctionRef.current) {
        console.log("[useSealedBidAuction] Already refreshing or starting auction, skipping");
        return;
      }

      if (!sealedBidAuction.address || !ethersSigner || duration <= 0) {
        setMessage("Invalid duration (>0) or missing parameters");
        return;
      }

      const thisChainId = chainId;
      const thisSealedBidAuctionAddress = sealedBidAuction.address;
      const thisEthersSigner = ethersSigner;
      const thisSealedBidAuctionContract = new ethers.Contract(
        thisSealedBidAuctionAddress,
        sealedBidAuction.abi,
        thisEthersSigner,
      );

      isStartingAuctionRef.current = true;
      setIsStartingAuction(true);
      setMessage(`Starting auction with duration ${duration} seconds...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisSealedBidAuctionAddress !== sealedBidAuctionRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          setMessage(`Calling startAuction...`);
          const tx: ethers.TransactionResponse = await thisSealedBidAuctionContract.startAuction(duration);
          setMessage(`Waiting for tx: ${tx.hash}...`);
          const receipt = await tx.wait();
          if (receipt?.status !== 1) {
            throw new Error("Transaction failed");
          }
          setMessage(`Auction started, status=${receipt?.status}.`);
          if (isStale()) {
            setMessage(`Ignore startAuction`);
            return;
          }
          // Reset session states
          setAuctionSessionId(0);
          setHasFetchedWinner(false);
          setIsComplatedDecrypt(false);
          await refreshState();
        } catch (e) {
          console.error("[useSealedBidAuction] Start auction failed:", (e as Error).message);
          setMessage(`Start Auction Failed! error=${(e as Error).message}`);
          await refreshState();
        } finally {
          isStartingAuctionRef.current = false;
          setIsStartingAuction(false);
        }
      };

      run();
    },
    [ethersSigner, sealedBidAuction.address, sealedBidAuction.abi, chainId, refreshState, sameChain, sameSigner],
  );

  // Set Auction Item
  const updateAuctionItem = useCallback(
    async (item: string) => {
      if (isRefreshingRef.current || isSettingItemRef.current) {
        console.log("[useSealedBidAuction] Already refreshing or setting item, skipping");
        return;
      }

      if (!sealedBidAuction.address || !ethersSigner || !item) {
        setMessage("Invalid item or missing parameters");
        return;
      }

      const thisChainId = chainId;
      const thisSealedBidAuctionAddress = sealedBidAuction.address;
      const thisEthersSigner = ethersSigner;
      const thisSealedBidAuctionContract = new ethers.Contract(
        thisSealedBidAuctionAddress,
        sealedBidAuction.abi,
        thisEthersSigner,
      );

      isSettingItemRef.current = true;
      setIsSettingItem(true);
      setMessage(`Setting auction item to ${item}...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisSealedBidAuctionAddress !== sealedBidAuctionRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          setMessage(`Calling setAuctionItem...`);
          const tx: ethers.TransactionResponse = await thisSealedBidAuctionContract.setAuctionItem(item);
          setMessage(`Waiting for tx: ${tx.hash}...`);
          const receipt = await tx.wait();
          if (receipt?.status !== 1) {
            throw new Error("Transaction failed");
          }
          setMessage(`Auction item set, status=${receipt?.status}.`);
          if (isStale()) {
            setMessage(`Ignore setAuctionItem`);
            return;
          }
          await refreshState();
        } catch (e) {
          console.error("[useSealedBidAuction] Set auction item failed:", (e as Error).message);
          setMessage(`Set Auction Item Failed! error=${(e as Error).message}`);
          await refreshState();
        } finally {
          isSettingItemRef.current = false;
          setIsSettingItem(false);
        }
      };

      run();
    },
    [ethersSigner, sealedBidAuction.address, sealedBidAuction.abi, chainId, refreshState, sameChain, sameSigner],
  );

  // Place Bid
  const placeBid = useCallback(
    async (bidAmount: number, depositAmount: number) => {
      if (isRefreshingRef.current || isPlacingBidRef.current) {
        console.log("[useSealedBidAuction] Already refreshing or placing bid, skipping");
        return;
      }

      if (!sealedBidAuction.address || !instance || !ethersSigner || bidAmount <= 0 || depositAmount <= 0) {
        setMessage("Invalid bid or deposit amount (>0) or missing parameters");
        return;
      }

      if (bidAmount > Number.MAX_SAFE_INTEGER || bidAmount > 2 ** 64 - 1) {
        setMessage("Bid amount exceeds uint64 limit");
        return;
      }

      const value = BigInt(depositAmount);

      const thisChainId = chainId;
      const thisSealedBidAuctionAddress = sealedBidAuction.address;
      const thisEthersSigner = ethersSigner;
      const thisSealedBidAuctionContract = new ethers.Contract(
        thisSealedBidAuctionAddress,
        sealedBidAuction.abi,
        thisEthersSigner,
      );

      isPlacingBidRef.current = true;
      setIsPlacingBid(true);
      setMessage(`Placing bid of ${bidAmount} wei with deposit ${depositAmount} wei...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisSealedBidAuctionAddress !== sealedBidAuctionRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          const signerAddr = await thisEthersSigner.getAddress();
          const input = instance.createEncryptedInput(thisSealedBidAuctionAddress, signerAddr);
          input.add64(bidAmount);
          const enc = await input.encrypt();

          if (isStale()) {
            setMessage(`Ignore placeBid`);
            return;
          }

          setMessage(`Calling placeBid...`);
          const tx: ethers.TransactionResponse = await thisSealedBidAuctionContract.placeBid(
            enc.handles[0],
            enc.inputProof,
            { value }
          );
          setMessage(`Waiting for tx: ${tx.hash}...`);
          const receipt = await tx.wait();
          if (receipt?.status !== 1) {
            throw new Error("Transaction failed");
          }
          setMessage(`Bid placed, status=${receipt?.status}.`);
          if (isStale()) {
            setMessage(`Ignore placeBid`);
            return;
          }
          await refreshState();
        } catch (e) {
          console.error("[useSealedBidAuction] Place bid failed:", (e as Error).message);
          setMessage(`Place Bid Failed! error=${(e as Error).message}`);
          await refreshState();
        } finally {
          isPlacingBidRef.current = false;
          setIsPlacingBid(false);
        }
      };

      run();
    },
    [ethersSigner, sealedBidAuction.address, sealedBidAuction.abi, instance, chainId, refreshState, sameChain, sameSigner],
  );

  // End Auction
  const endAuction = useCallback(
    async () => {
      if (isRefreshingRef.current || isEndingAuctionRef.current) {
        console.log("[useSealedBidAuction] Already refreshing or ending auction, skipping");
        return;
      }

      if (!sealedBidAuction.address || !ethersSigner) {
        setMessage("Missing parameters");
        return;
      }

      const thisChainId = chainId;
      const thisSealedBidAuctionAddress = sealedBidAuction.address;
      const thisEthersSigner = ethersSigner;
      const thisSealedBidAuctionContract = new ethers.Contract(
        thisSealedBidAuctionAddress,
        sealedBidAuction.abi,
        thisEthersSigner,
      );

      isEndingAuctionRef.current = true;
      setIsEndingAuction(true);
      setMessage(`Ending auction...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisSealedBidAuctionAddress !== sealedBidAuctionRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          setMessage(`Calling endAuction...`);
          const tx: ethers.TransactionResponse = await thisSealedBidAuctionContract.endAuction();
          setMessage(`Waiting for tx: ${tx.hash}...`);
          const receipt = await tx.wait();
          if (receipt?.status !== 1) {
            throw new Error("Transaction failed");
          }
          setMessage(`Auction ended, status=${receipt?.status}.`);
          if (isStale()) {
            setMessage(`Ignore endAuction`);
            return;
          }
          await refreshState();
        } catch (e) {
          console.error("[useSealedBidAuction] End auction failed:", (e as Error).message);
          setMessage(`End Auction Failed! error=${(e as Error).message}`);
          await refreshState();
        } finally {
          isEndingAuctionRef.current = false;
          setIsEndingAuction(false);
        }
      };

      run();
    },
    [ethersSigner, sealedBidAuction.address, sealedBidAuction.abi, chainId, refreshState, sameChain, sameSigner],
  );

  // Request Decryption
  const requestDecryption = useCallback(
    async () => {
      if (isRefreshingRef.current || isRequestingDecryptionRef.current) {
        console.log("[useSealedBidAuction] Already refreshing or requesting decryption, skipping");
        return;
      }

      if (!sealedBidAuction.address || !ethersSigner) {
        setMessage("Missing parameters");
        return;
      }

      const thisChainId = chainId;
      const thisSealedBidAuctionAddress = sealedBidAuction.address;
      const thisEthersSigner = ethersSigner;
      const thisSealedBidAuctionContract = new ethers.Contract(
        thisSealedBidAuctionAddress,
        sealedBidAuction.abi,
        thisEthersSigner,
      );

      isRequestingDecryptionRef.current = true;
      setIsRequestingDecryption(true);
      setMessage(`Requesting decryption...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisSealedBidAuctionAddress !== sealedBidAuctionRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          setMessage(`Calling requestDecryption...`);
          const tx: ethers.TransactionResponse = await thisSealedBidAuctionContract.requestDecryption();
          setMessage(`Waiting for tx: ${tx.hash}...`);
          const receipt = await tx.wait();
          if (receipt?.status !== 1) {
            throw new Error("Transaction failed");
          }
          setMessage(`Decryption requested, status=${receipt?.status}.`);
          if (isStale()) {
            setMessage(`Ignore requestDecryption`);
            return;
          }
          setIsComplatedDecrypt(true);
          await refreshState();
        } catch (e) {
          console.error("[useSealedBidAuction] Request decryption failed:", (e as Error).message);
          setMessage(`Request Decryption Failed! error=${(e as Error).message}`);
          await refreshState();
        } finally {
          isRequestingDecryptionRef.current = false;
          setIsRequestingDecryption(false);
        }
      };

      run();
    },
    [ethersSigner, sealedBidAuction.address, sealedBidAuction.abi, chainId, refreshState, sameChain, sameSigner],
  );

  // Refund
  const refund = useCallback(
    async () => {
      if (isRefreshingRef.current || isRefundingRef.current) {
        console.log("[useSealedBidAuction] Already refreshing or refunding, skipping");
        return;
      }

      if (!sealedBidAuction.address || !ethersSigner) {
        setMessage("Missing parameters");
        return;
      }

      const thisChainId = chainId;
      const thisSealedBidAuctionAddress = sealedBidAuction.address;
      const thisEthersSigner = ethersSigner;
      const thisSealedBidAuctionContract = new ethers.Contract(
        thisSealedBidAuctionAddress,
        sealedBidAuction.abi,
        thisEthersSigner,
      );

      isRefundingRef.current = true;
      setIsRefunding(true);
      setMessage(`Requesting refund...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisSealedBidAuctionAddress !== sealedBidAuctionRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          setMessage(`Calling refund...`);
          const tx: ethers.TransactionResponse = await thisSealedBidAuctionContract.refund();
          setMessage(`Waiting for tx: ${tx.hash}...`);
          const receipt = await tx.wait();
          if (receipt?.status !== 1) {
            throw new Error("Transaction failed");
          }
          setMessage(`Refund completed, status=${receipt?.status}.`);
          if (isStale()) {
            setMessage(`Ignore refund`);
            return;
          }
          await refreshState();
        } catch (e) {
          console.error("[useSealedBidAuction] Refund failed:", (e as Error).message);
          setMessage(`Refund Failed! error=${(e as Error).message}`);
          await refreshState();
        } finally {
          isRefundingRef.current = false;
          setIsRefunding(false);
        }
      };

      run();
    },
    [ethersSigner, sealedBidAuction.address, sealedBidAuction.abi, chainId, refreshState, sameChain, sameSigner],
  );

  // Reset Auction
  const resetAuction = useCallback(
    async () => {
      if (isRefreshingRef.current || isResettingAuctionRef.current) {
        console.log("[useSealedBidAuction] Already refreshing or resetting auction, skipping");
        return;
      }

      if (!sealedBidAuction.address || !ethersSigner) {
        setMessage("Missing parameters");
        return;
      }

      const thisChainId = chainId;
      const thisSealedBidAuctionAddress = sealedBidAuction.address;
      const thisEthersSigner = ethersSigner;
      const thisSealedBidAuctionContract = new ethers.Contract(
        thisSealedBidAuctionAddress,
        sealedBidAuction.abi,
        thisEthersSigner,
      );

      isResettingAuctionRef.current = true;
      setIsResettingAuction(true);
      setMessage(`Resetting auction...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisSealedBidAuctionAddress !== sealedBidAuctionRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          setMessage(`Calling resetAuction...`);
          const tx: ethers.TransactionResponse = await thisSealedBidAuctionContract.resetAuction();
          setMessage(`Waiting for tx: ${tx.hash}...`);
          const receipt = await tx.wait();
          if (receipt?.status !== 1) {
            throw new Error("Transaction failed");
          }
          setMessage(`Auction reset, status=${receipt?.status}.`);
          if (isStale()) {
            setMessage(`Ignore resetAuction`);
            return;
          }
          // Reset session states
          setAuctionSessionId(0);
          setHasFetchedWinner(false);
          setIsComplatedDecrypt(false);
          setWinner(ethers.ZeroAddress);
          setWinningAmount(0);
          await refreshState();
        } catch (e) {
          console.error("[useSealedBidAuction] Reset auction failed:", (e as Error).message);
          setMessage(`Reset Auction Failed! error=${(e as Error).message}`);
          await refreshState();
        } finally {
          isResettingAuctionRef.current = false;
          setIsResettingAuction(false);
        }
      };

      run();
    },
    [ethersSigner, sealedBidAuction.address, sealedBidAuction.abi, chainId, refreshState, sameChain, sameSigner],
  );

  // Withdraw Total Proceeds
  const withdrawTotalProceeds = useCallback(
    async () => {
      if (isRefreshingRef.current || isWithdrawingProceedsRef.current) {
        console.log("[useSealedBidAuction] Already refreshing or withdrawing proceeds, skipping");
        return;
      }

      if (!sealedBidAuction.address || !ethersSigner) {
        setMessage("Missing parameters");
        return;
      }

      const thisChainId = chainId;
      const thisSealedBidAuctionAddress = sealedBidAuction.address;
      const thisEthersSigner = ethersSigner;
      const thisSealedBidAuctionContract = new ethers.Contract(
        thisSealedBidAuctionAddress,
        sealedBidAuction.abi,
        thisEthersSigner,
      );

      isWithdrawingProceedsRef.current = true;
      setIsWithdrawingProceeds(true);
      setMessage(`Withdrawing total proceeds...`);

      const run = async () => {
        await new Promise((resolve) => setTimeout(resolve, 100));

        const isStale = () =>
          thisSealedBidAuctionAddress !== sealedBidAuctionRef.current?.address ||
          !sameChain.current(thisChainId) ||
          !sameSigner.current(thisEthersSigner);

        try {
          setMessage(`Calling withdrawTotalProceeds...`);
          const tx: ethers.TransactionResponse = await thisSealedBidAuctionContract.withdrawTotalProceeds();
          setMessage(`Waiting for tx: ${tx.hash}...`);
          const receipt = await tx.wait();
          if (receipt?.status !== 1) {
            throw new Error("Transaction failed");
          }
          setMessage(`Proceeds withdrawn, status=${receipt?.status}.`);
          if (isStale()) {
            setMessage(`Ignore withdrawTotalProceeds`);
            return;
          }
          await refreshState();
        } catch (e) {
          console.error("[useSealedBidAuction] Withdraw proceeds failed:", (e as Error).message);
          setMessage(`Withdraw Proceeds Failed! error=${(e as Error).message}`);
          await refreshState();
        } finally {
          isWithdrawingProceedsRef.current = false;
          setIsWithdrawingProceeds(false);
        }
      };

      run();
    },
    [ethersSigner, sealedBidAuction.address, sealedBidAuction.abi, chainId, refreshState, sameChain, sameSigner],
  );

  return {
    contractAddress: sealedBidAuction.address,
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
  };
};