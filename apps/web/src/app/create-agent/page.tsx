import { Header } from "@/components/Header";
import { AgentCreationForm } from "@/components/agent/AgentCreationForm";

export default function CreateAgentPage() {
  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <p className="eyebrow">Delivery 3</p>
          <h1>Create Agent Identity</h1>
          <p>
            Register the agent profile that will own a limited smart wallet and
            build reputation through policy-checked actions.
          </p>
        </div>
        <AgentCreationForm />
      </section>
    </main>
  );
}
