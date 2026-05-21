"use client";

import { Header } from "@/components/Header";
import { AgentList } from "@/components/agent/AgentList";
import { useAgents } from "@/hooks/useAgents";

export default function DashboardPage() {
  const { agents, loaded } = useAgents();

  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <h1>Smart Wallets</h1>
        </div>

        <AgentList agents={agents} loaded={loaded} />
      </section>
    </main>
  );
}
