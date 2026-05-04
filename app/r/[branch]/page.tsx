import { notFound } from "next/navigation";

import { readBranchChecks } from "@/lib/store";
import { CheckCounts } from "@/components/check-counts";
import { CheckItem } from "@/components/check-item";

export default async function BranchChecksPage({
  params,
}: {
  params: Promise<{ branch: string }>;
}) {
  const { branch } = await params;
  const data = await readBranchChecks(branch);

  if (!data) notFound();

  return (
    <section className="space-y-4">
      <header>
        <div className="text-xs uppercase tracking-wider text-muted/70">
          Branch
        </div>
        <h2 className="mt-1 text-xl font-semibold tracking-tight">
          {data.title}
        </h2>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
          <span>
            {data.checks.length}{" "}
            {data.checks.length === 1 ? "check" : "checks"}
          </span>
          <span aria-hidden>·</span>
          <CheckCounts counts={data.counts} />
        </div>
      </header>
      {data.intro && (
        <p className="max-w-3xl text-sm leading-relaxed text-foreground/85">
          {data.intro}
        </p>
      )}
      <div className="divide-y divide-separator/30 rounded-lg border border-separator/40 px-3">
        {data.checks.map((check, idx) => (
          <CheckItem key={idx} check={check} />
        ))}
      </div>
    </section>
  );
}
