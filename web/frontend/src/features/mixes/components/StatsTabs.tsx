import { Tabs, TabsList, TabsTrigger } from "@/components/ui/tabs"
import { STATS_TABS, STATS_TAB_LABEL, type StatsTab } from "../lib/stats"

/** Selector de pestañas de estadísticas: uno solo, cambia las tablas de los dos bandos. */
export function StatsTabs({
  value,
  onChange,
}: {
  value: StatsTab
  onChange: (tab: StatsTab) => void
}) {
  return (
    <Tabs
      value={value}
      onValueChange={(t) => onChange(t as StatsTab)}
      className="max-w-full overflow-x-auto"
    >
      <TabsList
        aria-label="Estadísticas"
        className="h-auto gap-0.5 group-data-horizontal/tabs:h-auto"
      >
        {STATS_TABS.map((t) => (
          <TabsTrigger
            key={t}
            value={t}
            className="h-7 flex-none rounded-md border-0 px-3 text-[13px] text-muted-foreground hover:text-foreground data-active:bg-card data-active:text-foreground group-data-[variant=default]/tabs-list:data-active:shadow-xs dark:data-active:border-transparent dark:data-active:bg-card"
          >
            {STATS_TAB_LABEL[t]}
          </TabsTrigger>
        ))}
      </TabsList>
    </Tabs>
  )
}
