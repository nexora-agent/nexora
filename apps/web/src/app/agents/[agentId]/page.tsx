"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import type { AgentRecord } from "@nexora/shared";
import { Header } from "@/components/Header";
import { AgentProfileCard } from "@/components/agent/AgentProfileCard";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { getLocalAgent } from "@/lib/agents/localAgentRegistry";

export default function AgentProfilePage() {
  const params = useParams<{ agentId: string }>();
  const { address } = useWalletConnection();
  const [agent, setAgent] = useState<AgentRecord | undefined>();
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    setAgent(getLocalAgent(params.agentId));
    setLoaded(true);
  }, [params.agentId]);

  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <p className="eyebrow">Agent profile</p>
          <h1>Agent Identity</h1>
          <p>
            The profile records the agent owner and metadata before wallet,
            policy, and reputation modules are attached.
          </p>
        </div>

        {agent ? (
          <AgentProfileCard agent={agent} connectedAddress={address} />
        ) : (
          loaded && (
            <section className="agent-profile-card">
              <h2>Agent not found</h2>
              <p className="ownership-note">
                Create an agent first, then return to this profile route.
              </p>
            </section>
          )
        )}
      </section>
    </main>
  );
}
