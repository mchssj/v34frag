import { Link } from "@tanstack/react-router"
import { InfoIcon } from "lucide-react"
import type { ComponentProps } from "react"
import Markdown, { type Components } from "react-markdown"
import remarkGfm from "remark-gfm"

import { Skeleton } from "@/components/ui/skeleton"
import type { AppPath } from "@/features/shell/lib/nav"
import { useManualImage } from "../api/queries"
import { imageFile, linkKind } from "../lib/links"

/** Captura del manual: se pide con la sesión (la API filtra por rol). */
function ManualImage({
  seccion,
  src,
  alt,
}: {
  seccion: string
  src: string
  alt: string
}) {
  const archivo = imageFile(src)
  const { url, isError } = useManualImage(seccion, archivo)
  if (!archivo || isError)
    return (
      <span className="block rounded-lg border border-dashed p-4 text-center text-xs text-muted-foreground">
        No se pudo cargar la captura{alt ? `: ${alt}` : ""}.
      </span>
    )
  if (!url) return <Skeleton className="block aspect-video w-full rounded-lg" />
  return (
    <img
      src={url}
      alt={alt}
      className="w-full rounded-lg border"
      loading="lazy"
    />
  )
}

function ManualLink({ href = "", children, ...rest }: ComponentProps<"a">) {
  const cls =
    "font-medium text-primary underline underline-offset-3 hover:text-primary/80"
  const kind = linkKind(href)
  // Una ruta de la web (otra página del manual o una pantalla) va con el router.
  if (kind === "internal")
    return (
      <Link to={href as AppPath} className={cls}>
        {children}
      </Link>
    )
  if (kind === "external")
    return (
      <a href={href} target="_blank" rel="noreferrer" className={cls} {...rest}>
        {children}
      </a>
    )
  // Anclas y lo que no se reconoce: texto, sin link (no se abre nada raro, como javascript:).
  return <span>{children}</span>
}

const components = (seccion: string): Components => ({
  h1: ({ children }) => (
    <h2 className="mt-6 text-xl font-semibold tracking-[-0.3px]">{children}</h2>
  ),
  h2: ({ children }) => (
    <h2 className="mt-6 text-lg font-semibold tracking-[-0.2px]">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="mt-4 text-base font-semibold">{children}</h3>
  ),
  p: ({ children }) => <p className="mt-3 leading-relaxed">{children}</p>,
  ul: ({ children }) => (
    <ul className="mt-3 list-disc space-y-1.5 pl-5">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="mt-3 list-decimal space-y-1.5 pl-5">{children}</ol>
  ),
  li: ({ children }) => (
    <li className="leading-relaxed [&>p]:mt-1">{children}</li>
  ),
  a: ManualLink,
  img: ({ src, alt }) => (
    <ManualImage
      seccion={seccion}
      src={typeof src === "string" ? src : ""}
      alt={alt ?? ""}
    />
  ),
  code: ({ children }) => (
    <code className="rounded bg-muted px-1 py-0.5 font-mono text-[0.85em]">
      {children}
    </code>
  ),
  pre: ({ children }) => (
    <pre className="mt-3 overflow-x-auto overflow-y-hidden rounded-lg bg-muted p-3 font-mono text-xs [&_code]:bg-transparent [&_code]:p-0">
      {children}
    </pre>
  ),
  // Las citas son avisos (`> **Ojo:** …`).
  blockquote: ({ children }) => (
    <div
      role="note"
      className="mt-4 flex gap-2.5 rounded-lg border border-amber-500/40 bg-amber-50 px-3 py-2.5 text-amber-950 dark:border-amber-500/30 dark:bg-amber-950 dark:text-amber-50 [&_p]:mt-0 [&_p+p]:mt-2"
    >
      <InfoIcon
        aria-hidden
        className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400"
      />
      <div className="min-w-0">{children}</div>
    </div>
  ),
  table: ({ children }) => (
    <div className="mt-4 overflow-x-auto overflow-y-hidden rounded-lg border">
      <table className="w-full text-sm">{children}</table>
    </div>
  ),
  th: ({ children }) => (
    <th className="border-b bg-muted/50 px-3 py-2 text-left font-medium">
      {children}
    </th>
  ),
  td: ({ children }) => (
    <td className="border-b px-3 py-2 align-top">{children}</td>
  ),
  hr: () => <hr className="my-6" />,
})

/** El texto de una página del manual. Sin HTML crudo: react-markdown no lo interpreta. */
export function ManualMarkdown({
  markdown,
  seccion,
}: {
  markdown: string
  seccion: string
}) {
  return (
    <div className="text-sm [&>*:first-child]:mt-0">
      <Markdown remarkPlugins={[remarkGfm]} components={components(seccion)}>
        {markdown}
      </Markdown>
    </div>
  )
}
