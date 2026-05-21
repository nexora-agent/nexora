"use client";

import type { TransactionIntent } from "@nexora/shared";

type TransferIntentCardProps = {
  intent: TransactionIntent;
};

export function TransferIntentCard({ intent }: TransferIntentCardProps) {
  if (intent.kind !== "erc20_transfer") {
    return null;
  }

  return (
    <article className="intent-kind-card">
      <h3>ERC-20 Transfer</h3>
      <p>{intent.summary}</p>
    </article>
  );
}
