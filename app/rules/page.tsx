import { readRules } from "@/lib/store";

export default async function RulesPage() {
  const rules = await readRules();

  return (
    <section className="py-8">
      <header className="mb-6">
        <h1 className="text-2xl font-bold tracking-tight">Repo rules</h1>
        <p className="mt-1 text-sm text-muted">
          Persistent checklist rules the agent applies to every block. Editable
          here, in <code>.receipts/rules.md</code>, or by asking{" "}
          <code>/receipts</code> to update them.
        </p>
      </header>
      <article className="rounded-xl border border-separator bg-surface p-6">
        <pre className="whitespace-pre-wrap text-sm leading-relaxed font-sans text-foreground/90">
          {rules ?? "No rules.md found in .receipts/."}
        </pre>
      </article>
    </section>
  );
}
