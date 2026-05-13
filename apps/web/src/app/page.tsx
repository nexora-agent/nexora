import { mvpLoop } from "@nexora/shared";
import { Header } from "@/components/Header";
import { ConnectWalletButton } from "@/components/wallet/ConnectWalletButton";
import { OwnerWalletCard } from "@/components/wallet/OwnerWalletCard";

export default function HomePage() {
  return (
    <main>
      <Header />
      <section className="hero-shell">
        <div className="hero-copy">
          <p className="eyebrow">Mantle hackathon MVP</p>
          <h1>Nexora</h1>
          <p className="subtitle">
            Verifiable safety layer for on-chain AI agents.
          </p>
          <p className="lede">
            Create an AI agent, give it a limited smart wallet, set safety
            rules, let it propose actions, and record reputation on-chain.
          </p>
          <div className="actions">
            <a className="primary-action" href="/demo">
              Open Demo Route
            </a>
            <ConnectWalletButton variant="secondary" />
          </div>
        </div>

        <div className="agent-console" aria-label="Nexora wallet preview">
          <div className="console-topline">
            <span>Mantle readiness</span>
            <span className="status-pill">Delivery 2</span>
          </div>
          <OwnerWalletCard />
        </div>
      </section>

      <section className="content-band">
        <div className="section-heading">
          <p className="eyebrow">Strong MVP loop</p>
          <h2>Smallest real product path</h2>
        </div>
        <div className="loop-grid">
          {mvpLoop.map((step, index) => (
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
