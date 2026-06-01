"use client";

import Link from "next/link";
import { ThemeToggle } from "./ThemeToggle";
import { ConnectWalletButton } from "./wallet/ConnectWalletButton";

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/" prefetch={false}>
        Nexora
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/dashboard" prefetch={false}>Dashboard</Link>
        <Link href="/create-wallet" prefetch={false}>Create Smart Wallet</Link>
        <Link href="/harnesses" prefetch={false}>Harnesses</Link>
        <Link href="/arena" prefetch={false}>Arena</Link>
        <ThemeToggle />
        <ConnectWalletButton variant="compact" />
      </nav>
    </header>
  );
}
