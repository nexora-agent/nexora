import { demoAgent, demoPolicy, mvpLoop } from "@nexora/shared";
import { Header } from "@/components/Header";

export default function DemoPage() {
  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <p className="eyebrow">Planned judge journey</p>
          <h1>Demo Flow</h1>
          <p>
            This route locks the product story for Delivery 1 and becomes the
            checklist for the live MVP.
          </p>
        </div>

        <div className="demo-layout">
          <section className="panel">
            <h2>Agent Profile</h2>
            <dl>
              <div>
                <dt>Agent Name</dt>
                <dd>{demoAgent.name}</dd>
              </div>
              <div>
                <dt>Goal</dt>
                <dd>{demoAgent.goal}</dd>
              </div>
              <div>
                <dt>Risk Mode</dt>
                <dd>Conservative</dd>
              </div>
            </dl>
          </section>

          <section className="panel">
            <h2>Safety Policy</h2>
            <dl>
              <div>
                <dt>Max risk score</dt>
                <dd>{demoPolicy.maxRiskScore}</dd>
              </div>
              <div>
                <dt>Max transaction size</dt>
                <dd>{demoPolicy.maxTransactionSizeUsd} USDC</dd>
              </div>
              <div>
                <dt>Unlimited approvals</dt>
                <dd>Blocked</dd>
              </div>
              <div>
                <dt>Risk report</dt>
                <dd>Required</dd>
              </div>
            </dl>
          </section>
        </div>

        <section className="journey-table" aria-label="Full planned journey">
          <h2>End-to-end path</h2>
          <ol>
            {mvpLoop.map((step) => (
              <li key={step}>{step}</li>
            ))}
          </ol>
        </section>
      </section>
    </main>
  );
}
