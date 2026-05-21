"use client";

import Link from "next/link";
import { ConnectWalletButton } from "./wallet/ConnectWalletButton";

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        Nexora
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/dashboard">Dashboard</Link>
        <Link href="/create-wallet">Create Smart Wallet</Link>
        <Link href="/harnesses">Harnesses</Link>
        <Link href="/arena">Arena</Link>
        <ConnectWalletButton variant="compact" />
      </nav>
    </header>
  );
}
