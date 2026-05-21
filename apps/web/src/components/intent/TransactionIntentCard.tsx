"use client";

import type { TransactionIntent } from "@nexora/shared";
import { ApprovalIntentCard } from "./ApprovalIntentCard";
import { TransferIntentCard } from "./TransferIntentCard";

type TransactionIntentCardProps = {
  intent: TransactionIntent;
};

function shortHex(value: string) {
  return `${value.slice(0, 10)}...${value.slice(-8)}`;
}

export function TransactionIntentCard({ intent }: TransactionIntentCardProps) {
  return (
    <section className="transaction-intent-card" aria-label="Transaction intent">
      <div className="console-topline">
        <span>Transaction Intent</span>
        <span className="status-pill status-ready">Hash ready</span>
      </div>

      <TransferIntentCard intent={intent} />
      <ApprovalIntentCard intent={intent} />

      <dl>
        <div>
          <dt>Intent Hash</dt>
          <dd>{shortHex(intent.intentHash)}</dd>
        </div>
        <div>
          <dt>Target</dt>
          <dd>{shortHex(intent.target)}</dd>
        </div>
        <div>
          <dt>Token</dt>
          <dd>{intent.tokenSymbol}</dd>
        </div>
        <div>
          <dt>Amount</dt>
          <dd>{intent.amount}</dd>
        </div>
        <div>
          <dt>Calldata</dt>
          <dd>{shortHex(intent.calldata)}</dd>
        </div>
      </dl>
    </section>
  );
}
