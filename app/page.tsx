import NextLink from "next/link";

import { listReviews } from "@/lib/store";
import { StatusBadge } from "@/components/status-badge";

function formatDuration(start: string, end?: string): string {
  if (!end) return "—";
  const ms = new Date(end).getTime() - new Date(start).getTime();
  const minutes = Math.round(ms / 60000);
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  return `${hours}h ${minutes % 60}m`;
}

export default async function Home() {
  const reviews = await listReviews();

  return (
    <section className="py-8">
      <header className="mb-8">
        <h1 className="text-2xl font-bold tracking-tight">Reviews</h1>
        <p className="mt-1 text-sm text-muted">
          Per-block evidence ledgers for the branches you&apos;ve reviewed.
        </p>
      </header>
      <ul className="space-y-3">
        {reviews.map((r) => (
          <li
            key={r.slug}
            className="rounded-xl border border-separator bg-surface hover:border-accent/40 transition-colors"
          >
            <NextLink className="block p-4" href={`/r/${r.slug}`}>
              <div className="flex items-start justify-between gap-4">
                <div className="min-w-0">
                  <div className="flex items-center gap-2 text-xs text-muted">
                    <span className="font-mono">{r.repo}</span>
                    <span>·</span>
                    <span>#{r.pr_number}</span>
                  </div>
                  <h2 className="mt-1 text-lg font-semibold tracking-tight truncate">
                    {r.title}
                  </h2>
                  <p className="mt-2 text-sm text-foreground/80 line-clamp-2">
                    {r.summary}
                  </p>
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
                    <span className="font-mono">
                      <span className="text-accent">{r.branch}</span>
                      <span className="mx-1 text-muted/60">→</span>
                      <span>{r.base}</span>
                    </span>
                    <span>{r.author_name ?? r.author}</span>
                    <span>{r.files_changed} files</span>
                    <span>
                      <span className="text-success">+{r.additions}</span>{" "}
                      <span className="text-danger">−{r.deletions}</span>
                    </span>
                    <span>ran in {formatDuration(r.started_at, r.finished_at)}</span>
                  </div>
                </div>
                <div className="shrink-0 text-xs uppercase tracking-wide text-muted">
                  {r.status === "complete" ? "complete" : r.status}
                </div>
              </div>
            </NextLink>
          </li>
        ))}
        {reviews.length === 0 && (
          <li className="rounded-xl border border-dashed border-separator p-8 text-center text-sm text-muted">
            No reviews yet. Run <code>/receipts</code> in Claude Code on a
            branch to populate this directory.
          </li>
        )}
      </ul>
    </section>
  );
}
