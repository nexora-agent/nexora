export type AgentRuntimeId =
  | "nexora-local"
  | "openai-gpt-4o-mini"
  | "openai-gpt-4o";

export type AgentRuntime = {
  id: AgentRuntimeId;
  label: string;
  model: string;
  toolUse: boolean;
};
