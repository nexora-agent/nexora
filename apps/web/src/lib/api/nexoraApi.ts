export const nexoraApiBaseUrl =
  process.env.NEXT_PUBLIC_NEXORA_API_URL?.replace(/\/$/, "") ??
  "http://localhost:4000";

export async function postNexoraApi<TResponse>(
  path: string,
  body: unknown,
): Promise<TResponse> {
  const response = await fetch(`${nexoraApiBaseUrl}${path}`, {
    body: JSON.stringify(body),
    cache: "no-store",
    headers: {
      "content-type": "application/json",
    },
    method: "POST",
  });
  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Nexora API returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  return payload as TResponse;
}

export async function getNexoraApi<TResponse>(path: string): Promise<TResponse> {
  const response = await fetch(`${nexoraApiBaseUrl}${path}`, {
    cache: "no-store",
    method: "GET",
  });
  const payload = await response.json().catch(() => undefined);

  if (!response.ok) {
    const message =
      payload && typeof payload === "object" && "error" in payload
        ? String(payload.error)
        : `Nexora API returned HTTP ${response.status}.`;
    throw new Error(message);
  }

  return payload as TResponse;
}
