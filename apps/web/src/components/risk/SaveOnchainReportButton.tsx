"use client";

import type { OnchainReportRecord } from "@nexora/shared";
import { useState } from "react";
import { recordRiskReportOnchain } from "@/lib/contracts/onchainRegistry";

type SaveOnchainReportButtonProps = {
  record: OnchainReportRecord;
};

function formatHash(hash: `0x${string}`) {
  return `${hash.slice(0, 10)}...${hash.slice(-6)}`;
}

export function SaveOnchainReportButton({
  record,
}: SaveOnchainReportButtonProps) {
  const [error, setError] = useState("");
  const [isSaving, setIsSaving] = useState(false);
  const [transactionHash, setTransactionHash] = useState<`0x${string}`>();

  const saveReport = async () => {
    setError("");
    setIsSaving(true);

    try {
      const hash = await recordRiskReportOnchain(record);
      setTransactionHash(hash);
    } catch (caughtError) {
      setError(
        caughtError instanceof Error
          ? caughtError.message
          : "Could not save report on-chain.",
      );
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="onchain-action-panel">
      <button
        className="primary-action"
        disabled={isSaving || Boolean(transactionHash)}
        onClick={() => void saveReport()}
        type="button"
      >
        {isSaving ? "Saving..." : transactionHash ? "Saved on Mantle" : "Save to Mantle"}
      </button>
      {transactionHash && (
        <p className="success-text">Transaction {formatHash(transactionHash)}</p>
      )}
      {error && <p className="error-text">{error}</p>}
    </div>
  );
}
