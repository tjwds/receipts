"use client";

import { useState } from "react";

import type { DiffFile } from "@/lib/diff";
import type { Block } from "@/lib/store";
import { DiffView } from "@/components/diff-view";
import { StatusBadge } from "@/components/status-badge";
import { CheckItem } from "@/components/check-item";

interface Props {
  filePath: string;
  mergedDiff: DiffFile;
  blocks: Block[];
}

export function FileHoverView({ filePath, mergedDiff, blocks }: Props) {
  const [hoveredId, setHoveredId] = useState<string | null>(null);

  return (
    <div className="grid grid-cols-1 gap-6 lg:grid-cols-12">
      <div className="lg:col-span-7">
        <DiffView files={[mergedDiff]} hoveredBlockId={hoveredId} />
      </div>
      <div className="lg:col-span-5 space-y-6">
        {blocks.map((block, blockIdx) => {
          const otherPaths = block.paths.filter((p) => p !== filePath);

          return (
            <article
              key={block.id}
              className={
                blockIdx > 0
                  ? "scroll-mt-24 border-t border-separator pt-6"
                  : "scroll-mt-24"
              }
              id={`block-${block.id}`}
              onMouseEnter={() => setHoveredId(block.id)}
              onMouseLeave={() => setHoveredId(null)}
            >
              <header>
                <div className="flex items-center gap-2 text-xs text-muted font-mono">
                  <span>Block {block.id}</span>
                  <span aria-hidden>·</span>
                  <span>
                    lines {block.range[0]}–{block.range[1]}
                  </span>
                </div>
                <h3 className="mt-1 flex items-start gap-2 text-base font-semibold tracking-tight leading-snug">
                  <StatusBadge status={block.status} />
                  <span className="flex-1">{block.title}</span>
                </h3>
                {otherPaths.length > 0 && (
                  <div className="mt-1 text-xs text-foreground/60 font-mono">
                    also affects: {otherPaths.join(", ")}
                  </div>
                )}
              </header>
              {block.intro && (
                <details className="group mt-3">
                  <summary className="flex cursor-pointer select-none items-center gap-1 text-xs uppercase tracking-wider text-muted/70 list-none [&::-webkit-details-marker]:hidden">
                    <span
                      aria-hidden
                      className="inline-block text-foreground/40 transition-transform group-open:rotate-90"
                    >
                      ▶
                    </span>
                    Description
                  </summary>
                  <p className="mt-2 text-xs leading-relaxed text-foreground/85">
                    {block.intro}
                  </p>
                </details>
              )}
              <div className="mt-3 text-xs uppercase tracking-wider text-muted/70">
                Checks ({block.checks.length})
              </div>
              <div className="mt-1 divide-y divide-separator/30 rounded-lg border border-separator/40 px-3">
                {block.checks.map((check, idx) => (
                  <CheckItem key={idx} check={check} />
                ))}
              </div>
            </article>
          );
        })}
      </div>
    </div>
  );
}
