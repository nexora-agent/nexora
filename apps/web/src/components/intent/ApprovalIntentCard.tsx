"use client";

import type { TransactionIntent } from "@nexora/shared";

type ApprovalIntentCardProps = {
  intent: TransactionIntent;
};

export function ApprovalIntentCard({ intent }: ApprovalIntentCardProps) {
  if (intent.kind !== "erc20_approval") {
    return null;
  }

  return (
    <article className="intent-kind-card">
      <h3>ERC-20 Approval</h3>
      <p>{intent.summary}</p>
    </article>
  );
}
