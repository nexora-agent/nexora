let objectiveRunCounter = 0;

export function createObjectiveRunId(prefix = "objective") {
  objectiveRunCounter = (objectiveRunCounter + 1) % 1_000_000;

  const entropy =
    typeof crypto !== "undefined" && typeof crypto.randomUUID === "function"
      ? crypto.randomUUID().slice(0, 8)
      : Math.random().toString(36).slice(2, 10);

  return `${prefix}-${Date.now()}-${objectiveRunCounter}-${entropy}`;
}
