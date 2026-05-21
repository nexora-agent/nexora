import type { AgentRecord, ObjectiveRun, PolicyProfile } from "@nexora/shared";
import { BenchmarkScoreCard } from "../benchmark/BenchmarkScoreCard";
import { ByrealActionProposal } from "../byreal/ByrealActionProposal";
import { ByrealPoolCard } from "../byreal/ByrealPoolCard";
import { TransactionIntentCard } from "../intent/TransactionIntentCard";
import { inspectByrealPool } from "@/lib/byreal/byrealAdapter";
import { BlockedExecutionCard } from "../execution/BlockedExecutionCard";
import { ExecuteProposalButton } from "../execution/ExecuteProposalButton";
import { ExecutionStatusCard } from "../execution/ExecutionStatusCard";
import { ProposalCard } from "../proposal/ProposalCard";
import { ProposalRiskPanel } from "../proposal/ProposalRiskPanel";
import { ToolTracePanel } from "../proposal/ToolTracePanel";
import { buildRegistryRecord } from "@/lib/registry/buildRegistryRecord";
import { OnchainReportCard } from "../risk/OnchainReportCard";
import { RiskReportPanel } from "../risk/RiskReportPanel";

type ObjectiveResultCardProps = {
  agent: AgentRecord;
  policy: PolicyProfile;
  run: ObjectiveRun;
  onRunUpdated?: (run: ObjectiveRun) => void;
};

export function ObjectiveResultCard({
  agent,
  policy,
  run,
  onRunUpdated,
}: ObjectiveResultCardProps) {
  const byrealPool =
    run.harnessId === "byreal-defi" ? inspectByrealPool(run.objective) : undefined;
  const registryRecord = buildRegistryRecord(run);

  return (
    <section className="objective-result-card" aria-label="Objective result">
      <div className="console-topline">
        <span>Objective Result</span>
        <span className="status-pill status-ready">{run.status}</span>
      </div>
      <dl>
        <div>
          <dt>Objective</dt>
          <dd>{run.objective}</dd>
        </div>
        <div>
          <dt>Harness</dt>
          <dd>{run.harnessId}</dd>
        </div>
      </dl>
      {byrealPool && <ByrealPoolCard pool={byrealPool} />}
      <ToolTracePanel trace={run.toolTrace} />
      {run.proposal && <ProposalCard proposal={run.proposal} />}
      {run.proposal && (
        <ProposalRiskPanel proposal={run.proposal} report={run.riskReport} />
      )}
      {run.proposal && run.harnessId === "byreal-defi" && (
        <ByrealActionProposal proposal={run.proposal} />
      )}
      {run.benchmarkScore && <BenchmarkScoreCard score={run.benchmarkScore} />}
      <OnchainReportCard record={registryRecord} />
      {!run.execution && onRunUpdated && (
        <ExecuteProposalButton
          agent={agent}
          policy={policy}
          run={run}
          onExecution={onRunUpdated}
        />
      )}
      {run.execution?.status === "executed" && (
        <ExecutionStatusCard execution={run.execution} />
      )}
      {run.execution?.status === "blocked" && (
        <BlockedExecutionCard execution={run.execution} />
      )}
      {run.intent && <TransactionIntentCard intent={run.intent} />}
      {run.riskReport && <RiskReportPanel report={run.riskReport} />}
    </section>
  );
}
