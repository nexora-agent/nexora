export type HarnessToolKind =
  | "builtin"
  | "contract-read"
  | "intent-builder"
  | "http"
  | "code";

export type HarnessTool = {
  id: string;
  name: string;
  description: string;
  sponsorSurface: "mantle" | "byreal" | "mirana" | "nexora";
  kind?: HarnessToolKind;
  contractAddress?: `0x${string}`;
  abiFunction?: string;
  httpMethod?: "GET" | "POST";
  httpUrl?: string;
  sourcePreview?: string;
};
