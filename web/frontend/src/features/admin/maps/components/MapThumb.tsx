import { cn } from "cn"
import { ImageIcon } from "lucide-react"

export function MapThumb({
  image,
  dim,
  className,
}: {
  image: string | null
  dim?: boolean
  className?: string
}) {
  return (
    <span
      aria-hidden
      className={cn(
        "grid h-10 w-[72px] shrink-0 place-items-center overflow-hidden rounded-md bg-muted text-muted-foreground",
        dim && "opacity-50",
        className
      )}
    >
      {image ? (
        <img src={image} alt="" className="size-full object-cover" />
      ) : (
        <ImageIcon className="size-4" />
      )}
    </span>
  )
}
