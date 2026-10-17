import { cn } from "cn"

/** Texto de la marca: "CSS" + "TV" en el color primario. Tamaño y tracking los pone quien lo usa. */
export function Wordmark({ className }: { className?: string }) {
  return (
    <span
      className={cn(
        "font-extrabold whitespace-nowrap text-foreground",
        className
      )}
    >
      CSS<span className="text-primary">TV</span>
    </span>
  )
}
