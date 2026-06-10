export type NexoraDemoMode = "hosted" | "local";

export function getNexoraDemoMode(): NexoraDemoMode {
  return process.env.NEXT_PUBLIC_NEXORA_DEMO_MODE === "hosted"
    ? "hosted"
    : "local";
}

export function isHostedPreviewMode() {
  return (
    process.env.NEXT_PUBLIC_NEXORA_HOSTED_PREVIEW === "true" ||
    getNexoraDemoMode() === "hosted"
  );
}
