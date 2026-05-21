import { mantleSepolia } from "@/lib/chains/mantle";

type ExplorerLinkProps = {
  address: `0x${string}`;
};

export function ExplorerLink({ address }: ExplorerLinkProps) {
  const explorerUrl = `${mantleSepolia.blockExplorers.default.url}/address/${address}`;

  return (
    <a
      className="secondary-action"
      href={explorerUrl}
      rel="noreferrer"
      target="_blank"
    >
      Open in Explorer
    </a>
  );
}
