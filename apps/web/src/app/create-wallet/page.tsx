import { Header } from "@/components/Header";
import { AgentCreationWizard } from "@/components/agent/AgentCreationWizard";

export default function CreateWalletPage() {
  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <h1>Smart Wallets</h1>
        </div>
        <AgentCreationWizard />
      </section>
    </main>
  );
}
