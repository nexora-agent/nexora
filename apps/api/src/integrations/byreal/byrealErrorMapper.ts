export function mapByrealError(error: unknown) {
  if (error instanceof Error) {
    return error.message;
  }

  return "Byreal / RealClaw adapter is unavailable.";
}
