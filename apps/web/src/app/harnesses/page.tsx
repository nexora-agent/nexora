"use client";

import Link from "next/link";
import { Header } from "@/components/Header";
import { HarnessDetailPanel } from "@/components/harness/HarnessDetailPanel";
import { useCustomHarnesses } from "@/hooks/useCustomHarnesses";
import { harnessTemplates } from "@/lib/harness/harnessTemplates";

export default function HarnessesPage() {
  const { harnesses, loaded } = useCustomHarnesses();

  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <h1>Harnesses</h1>
        </div>

        <div className="harness-page-actions">
          <Link className="primary-action" href="/harnesses/new">
            Create Harness
          </Link>
        </div>

        <div className="harness-library-grid">
          {loaded &&
            harnesses.map((harness) => (
              <HarnessDetailPanel harness={harness} key={harness.id} />
            ))}
          {harnessTemplates.map((harness) => (
            <HarnessDetailPanel harness={harness} key={harness.id} />
          ))}
        </div>
      </section>
    </main>
  );
}
