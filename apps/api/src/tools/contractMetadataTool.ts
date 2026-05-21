export function contractMetadataTool(address: string) {
  const verified = new Set([
    "0x0000000000000000000000000000000000000003",
    "0x0000000000000000000000000000000000000004",
  ]);

  return {
    address,
    verified: verified.has(address.toLowerCase()),
  };
}
