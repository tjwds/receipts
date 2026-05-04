import clsx from "clsx";

import type { CheckCounts as Counts } from "@/lib/store";

interface Props {
  counts: Counts;
  size?: "sm" | "md";
}

const items: { key: keyof Counts; symbol: string; cls: string }[] = [
  { key: "ok", symbol: "✓", cls: "text-success" },
  { key: "warn", symbol: "⚠", cls: "text-warning" },
  { key: "fail", symbol: "✗", cls: "text-danger" },
];

export function CheckCounts({ counts, size = "md" }: Props) {
  const total = counts.ok + counts.warn + counts.fail;

  if (total === 0) return null;

  return (
    <div
      className={clsx(
        "inline-flex items-center gap-2 font-mono",
        size === "sm" ? "text-[11px]" : "text-xs",
      )}
    >
      {items.map(({ key, symbol, cls }) => (
        <span
          key={key}
          className={clsx(
            "inline-flex items-center gap-0.5",
            counts[key] === 0 ? "text-foreground/25" : cls,
          )}
        >
          <span aria-hidden>{symbol}</span>
          <span>{counts[key]}</span>
        </span>
      ))}
    </div>
  );
}
