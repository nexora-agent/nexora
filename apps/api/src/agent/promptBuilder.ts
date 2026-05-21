export function buildObjectivePrompt(objective: string, harnessName: string) {
  return [
    `Objective: ${objective}`,
    `Harness: ${harnessName}`,
    "Use available tools before proposing an action.",
    "Return a structured intent, risk report, and tool trace.",
  ].join("\n");
}
