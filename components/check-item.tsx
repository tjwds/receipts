import clsx from "clsx";

import { StatusBadge } from "@/components/status-badge";
import type { Check } from "@/lib/store";

interface Props {
  check: Check;
}

const trailerOrder = ["Verified-by", "Method", "Source"];

export function CheckItem({ check }: Props) {
  const orderedTrailers = [
    ...trailerOrder.filter((k) => k in check.trailers),
    ...Object.keys(check.trailers).filter((k) => !trailerOrder.includes(k)),
  ];
  const hasDetails = check.body || orderedTrailers.length > 0;
  const defaultOpen = check.status === "fail";

  return (
    <details className="group" open={defaultOpen}>
      <summary
        className={clsx(
          "flex items-start gap-3 py-1.5 list-none cursor-pointer select-none",
          "[&::-webkit-details-marker]:hidden",
        )}
      >
        <StatusBadge status={check.status} />
        <h4 className="flex-1 text-xs font-semibold leading-relaxed">
          {check.title}
          {hasDetails && (
            <span
              aria-hidden
              className="ml-1 inline-block text-foreground/40 transition-transform group-open:rotate-90"
            >
              ▶
            </span>
          )}
        </h4>
      </summary>
      {hasDetails && (
        <div className="pb-2 pl-9 pt-1">
          {check.body && (
            <div className="whitespace-pre-wrap text-xs leading-relaxed text-foreground/90">
              {check.body}
            </div>
          )}
          {orderedTrailers.length > 0 && (
            <dl
              className={clsx(
                "space-y-0.5 text-[11px] font-mono text-muted",
                check.body && "mt-2",
              )}
            >
              {orderedTrailers.map((key) => (
                <div key={key} className="flex gap-2">
                  <dt className="shrink-0 text-muted/80">{key}:</dt>
                  <dd className="break-all text-foreground/70">
                    {check.trailers[key]}
                  </dd>
                </div>
              ))}
            </dl>
          )}
        </div>
      )}
    </details>
  );
}
