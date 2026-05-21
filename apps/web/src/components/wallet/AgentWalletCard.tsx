"use client";

import type { AgentRecord } from "@nexora/shared";
import { useEffect, useState } from "react";
import { useCreateAgentWallet } from "@/hooks/useCreateAgentWallet";
import { useWalletConnection } from "@/hooks/useWalletConnection";
import { CopyAddressButton } from "./CopyAddressButton";
import { ExplorerLink } from "./ExplorerLink";

type AgentWalletCardProps = {
  agent: AgentRecord;
  isOwner: boolean;
  onWalletCreated: (agent: AgentRecord) => void;
};

function formatAddress(address: string) {
  return `${address.slice(0, 6)}...${address.slice(-4)}`;
}

export function AgentWalletCard({
  agent,
  isOwner,
  onWalletCreated,
}: AgentWalletCardProps) {
  const { address, isReady } = useWalletConnection();
  const { createAgentWallet, error, isCreating } = useCreateAgentWallet();
  const [isMounted, setIsMounted] = useState(false);
  const [notice, setNotice] = useState("");
  const canCreateWallet = Boolean(isMounted && isReady);

  useEffect(() => {
    setIsMounted(true);
  }, []);

  const createWallet = async () => {
    if (!address || !isReady) {
      return;
    }

    const updatedAgent = await createAgentWallet(agent, address);
    setNotice(
      updatedAgent.walletAddress === agent.walletAddress
        ? "Existing wallet linked."
        : "Smart wallet created.",
    );
    onWalletCreated(updatedAgent);
  };

  return (
    <section className="agent-wallet-card" aria-label="Smart wallet">
      <div className="console-topline">
        <span>Smart Wallet</span>
        <span
          className={
            agent.walletAddress
              ? "status-pill status-ready"
              : "status-pill status-disconnected"
          }
        >
          {agent.walletAddress ? "Deployed" : "Not created"}
        </span>
      </div>

      <dl>
        <div>
          <dt>Smart Wallet</dt>
          <dd>
            {agent.walletAddress
              ? formatAddress(agent.walletAddress)
              : "Not created"}
          </dd>
        </div>
        <div>
          <dt>Owner</dt>
          <dd>{formatAddress(agent.ownerAddress)}</dd>
        </div>
        <div>
          <dt>Wallet ID</dt>
          <dd>{agent.id}</dd>
        </div>
      </dl>

      {agent.walletAddress && (
        <div className="wallet-action-row" aria-label="Wallet actions">
          <CopyAddressButton address={agent.walletAddress} />
          <ExplorerLink address={agent.walletAddress} />
        </div>
      )}

      {isOwner && !agent.walletAddress && (
        <button
          className="primary-action form-submit"
          disabled={!canCreateWallet || isCreating}
          onClick={() => void createWallet()}
          type="button"
        >
          {isCreating ? "Creating..." : "Create Smart Wallet"}
        </button>
      )}

      {isOwner && agent.walletAddress && (
        <button
          className="secondary-action wallet-disconnect"
          onClick={() => void createWallet()}
          type="button"
        >
          Show Existing Wallet
        </button>
      )}

      {!isOwner && (
        <p className="ownership-note">
          Only the owner wallet can control this smart wallet.
        </p>
      )}

      {notice && <p className="success-text">{notice}</p>}
      {error && <p className="error-text">{error}</p>}
    </section>
  );
}
