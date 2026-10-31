import * as React from "react"
import { cva, type VariantProps } from "class-variance-authority"
import { cn } from "cn"
import { Slot } from "radix-ui"

const badgeVariants = cva(
  "group/badge inline-flex h-5 w-fit shrink-0 items-center justify-center gap-1 overflow-hidden rounded-4xl border border-transparent px-2 py-0.5 text-xs font-medium whitespace-nowrap transition-all focus-visible:border-ring focus-visible:ring-[3px] focus-visible:ring-ring/50 has-data-[icon=inline-end]:pr-1.5 has-data-[icon=inline-start]:pl-1.5 aria-invalid:border-destructive aria-invalid:ring-destructive/20 dark:aria-invalid:ring-destructive/40 [&>svg]:pointer-events-none [&>svg]:size-3!",
  {
    variants: {
      variant: {
        default: "bg-primary text-primary-foreground [a]:hover:bg-primary/80",
        secondary:
          "bg-secondary text-secondary-foreground [a]:hover:bg-secondary/80",
        destructive:
          "bg-destructive/10 text-destructive focus-visible:ring-destructive/20 dark:bg-destructive/20 dark:focus-visible:ring-destructive/40 [a]:hover:bg-destructive/20",
        outline:
          "border-border text-foreground [a]:hover:bg-muted [a]:hover:text-muted-foreground",
        ghost:
          "hover:bg-muted hover:text-muted-foreground dark:hover:bg-muted/50",
        link: "text-primary underline-offset-4 hover:underline",
        // Tonos de CM League (estados, roles, resultados). Sin borde: miden igual que los de antes.
        neutral: "border-border text-muted-foreground",
        muted: "border-0 bg-muted text-muted-foreground",
        soft: "border-0 bg-secondary text-secondary-foreground",
        win: "border-0 bg-win/15 text-win",
        winSoft: "border-0 bg-win/15 text-foreground",
        primary: "border-0 bg-primary/15 text-primary",
        solid: "border-0 bg-primary text-primary-foreground",
        danger: "border-0 bg-destructive/15 text-destructive",
        live: "border-0 bg-destructive text-white",
        strong: "border-0 bg-foreground text-background",
        warn: "border-0 bg-amber-500/15 text-amber-700 dark:text-amber-400",
        vip: "border-0 bg-yellow-500/15 text-yellow-700 dark:text-yellow-300",
        gold: "border-0 bg-amber-400 text-amber-950",
      },
      shape: {
        pill: "rounded-full",
        soft: "rounded-[calc(var(--radius)-4px)]",
        tag: "rounded-[4px]",
      },
      size: {
        xs: "h-[18px] px-1.5 text-[10px]",
        sm: "h-5 px-1.5 text-[11px]",
        md: "h-[22px] px-2 text-xs",
      },
    },
    defaultVariants: {
      variant: "default",
    },
  }
)

type BadgeVariant = NonNullable<VariantProps<typeof badgeVariants>["variant"]>

function Badge({
  className,
  variant = "default",
  shape,
  size,
  asChild = false,
  ...props
}: React.ComponentProps<"span"> &
  VariantProps<typeof badgeVariants> & { asChild?: boolean }) {
  const Comp = asChild ? Slot.Root : "span"

  return (
    <Comp
      data-slot="badge"
      data-variant={variant}
      className={cn(badgeVariants({ variant, shape, size }), className)}
      {...props}
    />
  )
}

export { Badge, badgeVariants, type BadgeVariant }
