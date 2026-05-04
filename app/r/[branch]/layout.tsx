import { notFound } from "next/navigation";
import NextLink from "next/link";

import {
  groupBlocksByFile,
  listBlocks,
  readBranchChecks,
  readReviewMeta,
} from "@/lib/store";
import { CheckCounts } from "@/components/check-counts";

export default async function ReviewLayout({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ branch: string }>;
}) {
  const { branch } = await params;
  const review = await readReviewMeta(branch);

  if (!review) notFound();
  const [blocks, branchChecks] = await Promise.all([
    listBlocks(branch),
    readBranchChecks(branch),
  ]);
  const fileGroups = groupBlocksByFile(blocks, review.files);

  return (
    <div>
      <header className="border-b border-separator pb-6 pt-2">
        <div className="flex items-center gap-2 text-xs text-muted">
          <NextLink className="hover:text-accent" href="/">
            Reviews
          </NextLink>
          <span>/</span>
          <span className="font-mono">{review.repo}</span>
          <span>·</span>
          <a
            className="hover:text-accent"
            href={review.pr_url}
            rel="noopener noreferrer"
            target="_blank"
          >
            #{review.pr_number} ↗
          </a>
        </div>
        <h1 className="mt-1 text-2xl font-bold tracking-tight">
          {review.title}
        </h1>
        <div className="mt-3 flex flex-wrap items-center gap-3 text-xs text-muted">
          <span className="font-mono">
            <span className="text-accent">{review.branch}</span>
            <span className="mx-1 text-muted/60">→</span>
            <span>{review.base}</span>
          </span>
          <span>by {review.author_name ?? review.author}</span>
          <span>{review.files_changed} files</span>
          <span>
            <span className="text-success">+{review.additions}</span>{" "}
            <span className="text-danger">−{review.deletions}</span>
          </span>
          <span className="font-mono">
            {review.commit_sha.slice(0, 8)}
          </span>
        </div>
        <p className="mt-4 max-w-3xl text-sm leading-relaxed text-foreground/80">
          {review.summary}
        </p>
      </header>

      <div className="grid grid-cols-12 gap-6 pt-6">
        <aside className="col-span-12 md:col-span-3 lg:col-span-3">
          <nav className="sticky top-20 space-y-1">
            <NextLink
              className="block rounded-md px-3 py-2 text-sm hover:bg-surface"
              href={`/r/${branch}`}
            >
              <span className="text-xs text-muted/70 uppercase tracking-wider">
                Branch
              </span>
              <div className="font-medium">Branch checks</div>
              {branchChecks && (
                <div className="mt-1 flex items-center gap-2 text-xs text-muted">
                  <span>{branchChecks.checks.length}</span>
                  <span aria-hidden>·</span>
                  <CheckCounts counts={branchChecks.counts} size="sm" />
                </div>
              )}
            </NextLink>
            <div className="px-3 pb-1 pt-3 text-xs uppercase tracking-wider text-muted/70">
              Files ({fileGroups.length})
            </div>
            {fileGroups.map((group) => {
              const reviewed = group.blocks.length > 0;

              return (
                <NextLink
                  key={group.path}
                  className="block rounded-md px-3 py-2 hover:bg-surface"
                  href={`/r/${branch}/file/${group.path}`}
                >
                  <span
                    className={
                      reviewed
                        ? "block font-mono text-xs text-foreground/90 break-all leading-tight"
                        : "block font-mono text-xs text-foreground/50 break-all leading-tight"
                    }
                  >
                    {group.path}
                  </span>
                  <span className="mt-1 flex items-center gap-2 text-xs text-muted">
                    {reviewed ? (
                      <>
                        <span>
                          {group.blocks.length}{" "}
                          {group.blocks.length === 1 ? "block" : "blocks"}
                        </span>
                        <span aria-hidden>·</span>
                        <CheckCounts counts={group.counts} size="sm" />
                      </>
                    ) : (
                      <span className="italic text-muted/70">
                        not reviewed
                      </span>
                    )}
                  </span>
                </NextLink>
              );
            })}
          </nav>
        </aside>
        <section className="col-span-12 md:col-span-9 lg:col-span-9">
          {children}
        </section>
      </div>
    </div>
  );
}
