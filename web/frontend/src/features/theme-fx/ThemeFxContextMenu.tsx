import { useRef, type ReactNode } from "react"

import {
  ContextMenu,
  ContextMenuContent,
  ContextMenuLabel,
  ContextMenuRadioGroup,
  ContextMenuRadioItem,
  ContextMenuTrigger,
} from "@/components/ui/context-menu"
import { THEME_FX_OPTIONS, useThemeFxPref, type ThemeFxPref } from "./pref"

/**
 * Menú "Efectos de tema" sobre el selector: clic derecho, o pulsación larga en táctil (la
 * resuelve Radix). Sin preferencia guardada se marca "Con sonido", como en el diseño.
 */
export function ThemeFxContextMenu({ children }: { children: ReactNode }) {
  const [pref, setPref] = useThemeFxPref()
  const touch = useRef(false)
  return (
    <ContextMenu
      onOpenChange={(open) => {
        if (open && touch.current && "vibrate" in navigator)
          navigator.vibrate(10)
      }}
    >
      <ContextMenuTrigger
        asChild
        onPointerDown={(e) => {
          touch.current = e.pointerType !== "mouse"
        }}
      >
        <div title="Clic derecho: efectos" className="shrink-0">
          {children}
        </div>
      </ContextMenuTrigger>
      <ContextMenuContent className="w-[232px] rounded-[var(--radius)] p-1.5 leading-design shadow-[0_12px_32px_-12px_rgb(0_0_0/.35)]">
        <ContextMenuLabel className="px-2.5 pt-1.5 pb-1 text-xs font-semibold">
          Efectos de tema
        </ContextMenuLabel>
        <ContextMenuRadioGroup
          value={pref ?? "full"}
          onValueChange={(v) => setPref(v as ThemeFxPref)}
        >
          {THEME_FX_OPTIONS.map(({ value, label, icon: Icon }) => (
            <ContextMenuRadioItem
              key={value}
              value={value}
              className="h-9 gap-2.5 rounded-[calc(var(--radius)-4px)] pl-2.5 text-sm [&>span:first-child]:text-primary"
            >
              <Icon className="size-[15px] text-muted-foreground" aria-hidden />
              {label}
            </ContextMenuRadioItem>
          ))}
        </ContextMenuRadioGroup>
      </ContextMenuContent>
    </ContextMenu>
  )
}
