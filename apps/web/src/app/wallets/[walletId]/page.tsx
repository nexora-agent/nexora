"use client";

import { useParams } from "next/navigation";
import { useEffect, useState } from "react";
import { Header } from "@/components/Header";
import { AgentProfileCard } from "@/components/agent/AgentProfileCard";
import { useAgentProfile } from "@/hooks/useAgentProfile";
import { useWalletConnection } from "@/hooks/useWalletConnection";

export default function SmartWalletPage() {
  const params = useParams<{ walletId: string }>();
  const { address } = useWalletConnection();
  const [isMounted, setIsMounted] = useState(false);
  const { agent, loaded } = useAgentProfile(params.walletId);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <h1>Smart Wallet Dashboard</h1>
        </div>

        {agent ? (
          <AgentProfileCard
            agent={agent}
            connectedAddress={isMounted ? address : undefined}
          />
        ) : (
          loaded && (
            <section className="agent-profile-card">
              <h2>Smart wallet not found</h2>
            </section>
          )
        )}
      </section>
    </main>
  );
}
