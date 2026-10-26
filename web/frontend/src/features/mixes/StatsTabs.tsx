import { cn } from "cn"

import { STATS_TABS, STATS_TAB_LABEL, type StatsTab } from "./stats"

/** Selector de pestañas de estadísticas: uno solo, cambia las tablas de los dos bandos. */
export function StatsTabs({
  value,
  onChange,
}: {
  value: StatsTab
  onChange: (tab: StatsTab) => void
}) {
  return (
    <div className="max-w-full overflow-x-auto">
      <div
        role="tablist"
        aria-label="Estadísticas"
        className="inline-flex gap-0.5 rounded-lg bg-muted p-[3px]"
      >
        {STATS_TABS.map((t) => (
          <button
            key={t}
            type="button"
            role="tab"
            aria-selected={value === t}
            onClick={() => onChange(t)}
            className={cn(
              "h-7 rounded-md px-3 text-[13px] font-medium whitespace-nowrap text-muted-foreground transition-colors hover:text-foreground",
              value === t && "bg-card text-foreground shadow-xs"
            )}
          >
            {STATS_TAB_LABEL[t]}
          </button>
        ))}
      </div>
    </div>
  )
}
