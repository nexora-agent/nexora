import { Header } from "@/components/Header";

const docs = [
  ["README", "/README.md"],
  ["Concept", "/docs/concept.md"],
  ["Architecture", "/docs/architecture.md"],
  ["Demo Script", "/docs/demo-script.md"],
] as const;

export default function DocsPage() {
  return (
    <main>
      <Header />
      <section className="page-shell">
        <div className="section-heading">
          <p className="eyebrow">Project docs</p>
          <h1>Setup instructions are present</h1>
          <p>
            Start with the root README, then use the supporting docs to keep the
            build aligned with the MVP loop.
          </p>
        </div>
        <div className="docs-grid">
          {docs.map(([title, path]) => (
            <article className="doc-card" key={path}>
              <h2>{title}</h2>
              <code>{path}</code>
            </article>
          ))}
        </div>
      </section>
    </main>
  );
}
