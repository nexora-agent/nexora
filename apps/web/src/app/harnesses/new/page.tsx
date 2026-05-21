import { Header } from "@/components/Header";
import { HarnessBuilder } from "@/components/harness-builder/HarnessBuilder";

export default function NewHarnessPage() {
  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <h1>Create Harness</h1>
        </div>
        <HarnessBuilder />
      </section>
    </main>
  );
}
