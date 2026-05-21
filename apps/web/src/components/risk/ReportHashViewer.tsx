type ReportHashViewerProps = {
  reportHash: `0x${string}`;
};

function shortHash(hash: string) {
  return `${hash.slice(0, 10)}...${hash.slice(-8)}`;
}

export function ReportHashViewer({ reportHash }: ReportHashViewerProps) {
  return (
    <div>
      <dt>Report Hash</dt>
      <dd>{shortHash(reportHash)}</dd>
    </div>
  );
}
