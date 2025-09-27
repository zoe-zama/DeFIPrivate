"use client";

import type { ReactNode } from "react";
import { MetaMaskProvider } from "@/hooks/metamask/useMetaMaskProvider";
import { InMemoryStorageProvider } from "@/hooks/useInMemoryStorage";
import { MetaMaskEthersSignerProvider } from "@/hooks/metamask/useMetaMaskEthersSigner";

type Props = {
  children: ReactNode;
};

export function Providers({ children }: Props) {
  return (
    <MetaMaskProvider>
      <MetaMaskEthersSignerProvider
        initialMockChains={{ 11155111: "https://sepolia.infura.io/v3/1228ce4d672247089d08bbc9be8d32ab" }}
      >
        <InMemoryStorageProvider>{children}</InMemoryStorageProvider>
      </MetaMaskEthersSignerProvider>
    </MetaMaskProvider>
  );
}
