import type { AgentProposal } from "./AgentProposal";
import type { BenchmarkScore } from "./BenchmarkScore";
import type { ExecutionRecord } from "./Execution";
import type { RiskReport } from "./RiskReport";
import type { ReportEnvelope } from "./ReportEnvelope";
import type { ToolTraceEntry } from "./McpTool";
import type { TransactionIntent } from "./TransactionIntent";

export type ObjectiveRun = {
  id: string;
  agentId: string;
  harnessId: string;
  objective: string;
  status: "completed" | "failed";
  createdAt: string;
  intent?: TransactionIntent;
  proposal?: AgentProposal;
  benchmarkScore?: BenchmarkScore;
  riskReport?: RiskReport;
  reportEnvelope?: ReportEnvelope;
  execution?: ExecutionRecord;
  toolTrace: ToolTraceEntry[];
  summary: string;
};
