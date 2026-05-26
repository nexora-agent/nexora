import type { ByrealPool } from "@/lib/byreal/byrealAdapter";

type ByrealPoolCardProps = {
  pool: ByrealPool;
};

export function ByrealPoolCard({ pool }: ByrealPoolCardProps) {
  return (
    <section className="byreal-pool-card" aria-label="Byreal pool">
      <div className="console-topline">
        <span>{pool.name}</span>
        <span className="status-pill status-ready">Pool</span>
      </div>
      <dl>
        <div>
          <dt>Pair</dt>
          <dd>{pool.pair}</dd>
        </div>
        <div>
          <dt>Pool Address</dt>
          <dd>{pool.address}</dd>
        </div>
        <div>
          <dt>TVL</dt>
          <dd>${pool.tvlUsd.toLocaleString()}</dd>
        </div>
        <div>
          <dt>APR</dt>
          <dd>{(pool.aprBps / 100).toFixed(2)}%</dd>
        </div>
        <div>
          <dt>Volatility</dt>
          <dd>{pool.volatility}</dd>
        </div>
        <div>
          <dt>Risk Note</dt>
          <dd>{pool.riskNote}</dd>
        </div>
      </dl>
    </section>
  );
}
