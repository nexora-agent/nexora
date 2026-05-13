import Link from "next/link";
import { ConnectWalletButton } from "./wallet/ConnectWalletButton";

export function Header() {
  return (
    <header className="site-header">
      <Link className="brand" href="/">
        Nexora
      </Link>
      <nav aria-label="Primary navigation">
        <Link href="/demo">Demo</Link>
        <Link href="/docs">Docs</Link>
        <ConnectWalletButton variant="compact" />
      </nav>
    </header>
  );
}
