import { Header } from "@/components/Header";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { OwnerWalletCard } from "@/components/wallet/OwnerWalletCard";

const workflow = ["Smart Wallets", "Harnesses", "Policies", "Arena"];

export default function HomePage() {
  return (
    <main>
      <Header />
      <section className="hero-shell">
        <div className="hero-copy">
          <h1>Nexora</h1>
          <p className="subtitle">
            Verifiable safety layer for programmable smart wallets.
          </p>
          <div className="actions">
            <a className="primary-action" href="/create-wallet">
              Create Smart Wallet
            </a>
            <ConnectWalletButton variant="secondary" />
          </div>
        </div>

        <div className="agent-console" aria-label="Nexora wallet preview">
          <div className="console-topline">
            <span>Wallet</span>
            <span className="status-pill">Ready</span>
          </div>
          <OwnerWalletCard />
        </div>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <h2>Workspace</h2>
        </div>
        <div className="loop-grid">
          {workflow.map((step, index) => (
            <article className="loop-tile" key={step}>
              <span>{String(index + 1).padStart(2, "0")}</span>
              <strong>{step}</strong>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
