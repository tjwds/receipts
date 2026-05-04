import { notFound } from "next/navigation";

import {
  mergeBlockDiffsForFile,
  readAllBlocks,
  readBranchDiff,
  readReviewMeta,
} from "@/lib/store";
import { CheckCounts } from "@/components/check-counts";
import { DiffView } from "@/components/diff-view";
import { FileHoverView } from "@/components/file-hover-view";

export default async function FilePage({
  params,
}: {
  params: Promise<{ branch: string; path: string[] }>;
}) {
  const { branch, path: pathSegments } = await params;
  const filePath = pathSegments.join("/");
  const review = await readReviewMeta(branch);

  if (!review || !review.files.includes(filePath)) notFound();

  const allBlocks = await readAllBlocks(branch);
  const blocks = allBlocks.filter((b) => b.paths.includes(filePath));
  const mergedDiff = mergeBlockDiffsForFile(blocks, filePath);
  const fallbackDiff =
    blocks.length === 0 ? await readBranchDiff(branch, filePath) : null;

  const counts = blocks.reduce(
    (acc, b) => ({
      ok: acc.ok + b.counts.ok,
      warn: acc.warn + b.counts.warn,
      fail: acc.fail + b.counts.fail,
    }),
    { ok: 0, warn: 0, fail: 0 },
  );

  return (
    <div className="space-y-6">
      <header>
        <div className="text-xs uppercase tracking-wider text-muted/70">
          File
        </div>
        <h2 className="mt-1 font-mono text-xl font-semibold tracking-tight break-all">
          {filePath}
        </h2>
        <div className="mt-2 flex items-center gap-3 text-xs text-muted">
          {blocks.length === 0 ? (
            <span className="italic">not reviewed</span>
          ) : (
            <>
              <span>
                {blocks.length} {blocks.length === 1 ? "block" : "blocks"}
              </span>
              <span aria-hidden>·</span>
              <CheckCounts counts={counts} />
            </>
          )}
        </div>
      </header>

      {blocks.length === 0 && (
        <>
          <div className="rounded-lg border border-dashed border-separator p-4 text-sm text-muted">
            This file is in the branch but no review blocks have been written
            yet. Ask <code>/receipts</code> to review it, or read the diff
            below.
          </div>
          {fallbackDiff && fallbackDiff.length > 0 && (
            <DiffView files={fallbackDiff} />
          )}
        </>
      )}

      {blocks.length > 0 && mergedDiff && (
        <FileHoverView
          blocks={blocks}
          filePath={filePath}
          mergedDiff={mergedDiff}
        />
      )}
    </div>
  );
}
