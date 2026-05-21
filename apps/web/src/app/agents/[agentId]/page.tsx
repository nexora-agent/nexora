import { redirect } from "next/navigation";

type LegacySmartWalletPageProps = {
  params: Promise<{ agentId: string }>;
};

export default async function LegacySmartWalletPage({
  params,
}: LegacySmartWalletPageProps) {
  const { agentId } = await params;
  redirect(`/wallets/${agentId}`);
}
