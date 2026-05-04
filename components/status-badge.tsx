import clsx from "clsx";

import type { CheckStatus } from "@/lib/store";

const map: Record<
  CheckStatus,
  { symbol: string; label: string; cls: string }
> = {
  ok: {
    symbol: "✓",
    label: "verified",
    cls: "bg-success/15 text-success",
  },
  warn: {
    symbol: "⚠",
    label: "concern",
    cls: "bg-warning/20 text-warning",
  },
  fail: {
    symbol: "✗",
    label: "failed",
    cls: "bg-danger/20 text-danger",
  },
};

interface Props {
  status: CheckStatus;
  showLabel?: boolean;
  size?: "sm" | "md";
}

export function StatusBadge({ status, showLabel = false, size = "md" }: Props) {
  const cfg = map[status];

  return (
    <span
      className={clsx(
        "inline-flex items-center gap-1 rounded-full font-medium",
        cfg.cls,
        size === "sm" ? "px-1.5 py-0.5 text-xs" : "px-2 py-0.5 text-sm",
      )}
    >
      <span aria-hidden>{cfg.symbol}</span>
      {showLabel && <span>{cfg.label}</span>}
    </span>
  );
}
