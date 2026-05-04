"use client";

import clsx from "clsx";

import type { DiffFile, DiffLineStatus } from "@/lib/diff";

interface Props {
  files: DiffFile[];
  hoveredBlockId?: string | null;
}

function gutterClass(status: DiffLineStatus | undefined): string {
  if (!status) return "";
  if (status === "ok") return "bg-success/80";
  if (status === "warn") return "bg-warning/80";

  return "bg-danger/80";
}

export function DiffView({ files, hoveredBlockId }: Props) {
  return (
    <div className="overflow-hidden rounded-lg border border-separator bg-surface">
      {files.map((file, fIdx) => (
        <div
          key={fIdx}
          className={fIdx > 0 ? "mt-2 border-t border-separator" : ""}
        >
          <div className="flex items-center gap-2 border-b border-separator bg-background/40 px-3 py-2 text-xs font-mono">
            <span className="font-semibold text-foreground">{file.path}</span>
            {file.isNew && (
              <span className="rounded bg-success/15 px-1.5 py-0.5 text-success">
                new file
              </span>
            )}
          </div>
          <pre className="overflow-x-auto text-xs leading-relaxed font-mono text-foreground">
            <div className="min-w-max">
            {file.lines.map((line, idx) => {
              const isHovering = hoveredBlockId != null;
              const isMatch =
                isHovering && line.blockId === hoveredBlockId;
              const dimGutter = isHovering && !isMatch && !!line.blockStatus;

              return (
              <div
                key={idx}
                className={clsx(
                  "flex transition-opacity",
                  line.kind === "add" && "bg-success/15",
                  line.kind === "del" && "bg-danger/15",
                  line.kind === "hunk" && "bg-accent/15 text-accent italic",
                )}
              >
                <span
                  aria-hidden
                  className={clsx(
                    "select-none shrink-0 transition-all",
                    isMatch ? "w-1.5" : "w-1",
                    gutterClass(line.blockStatus),
                    dimGutter && "opacity-25",
                  )}
                />
                <span className="select-none w-10 shrink-0 text-right pr-2 text-foreground/40 border-r border-separator/50">
                  {line.kind === "del" || line.kind === "ctx"
                    ? line.oldNum ?? ""
                    : ""}
                </span>
                <span className="select-none w-10 shrink-0 text-right pr-2 text-foreground/40 border-r border-separator/50">
                  {line.kind === "add" || line.kind === "ctx"
                    ? line.newNum ?? ""
                    : ""}
                </span>
                <span
                  className={clsx(
                    "select-none w-4 shrink-0 text-center font-bold",
                    line.kind === "add" && "text-success",
                    line.kind === "del" && "text-danger",
                    line.kind !== "add" &&
                      line.kind !== "del" &&
                      "text-foreground/40",
                  )}
                >
                  {line.kind === "add"
                    ? "+"
                    : line.kind === "del"
                      ? "-"
                      : line.kind === "hunk"
                        ? ""
                        : " "}
                </span>
                <span className="whitespace-pre pl-2 pr-3">
                  {line.text || " "}
                </span>
              </div>
              );
            })}
            </div>
          </pre>
        </div>
      ))}
    </div>
  );
}
