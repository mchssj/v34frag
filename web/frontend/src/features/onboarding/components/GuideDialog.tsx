import { cn } from "cn"
import {
  ArrowLeftIcon,
  ArrowRightIcon,
  BookOpenIcon,
  CircleCheckIcon,
  ExternalLinkIcon,
} from "lucide-react"
import { useState } from "react"

import { Button } from "@/components/ui/button"
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogTitle,
} from "@/components/ui/dialog"
import type { Role } from "@/auth/queries"
import { guideSteps, type GuideAsk } from "../lib/guide"
import {
  GUIDE_LANGS,
  GUIDE_TEXT,
  LANG_LABEL,
  initialGuideLang,
  saveGuideLang,
  type GuideLang,
} from "../lib/guideText"

type Answer = "yes" | "no"

/**
 * Guía de la web en pasos (la primera vez que se entra, o desde Ayuda).
 * En español, portugués o inglés: el idioma se elige arriba y se recuerda en el navegador.
 * `onGo` recibe la ruta de "Ir a …" o del manual; cerrar por cualquier lado llama a `onClose`.
 */
export function GuideDialog({
  open,
  role,
  onClose,
  onGo,
}: {
  open: boolean
  role: Role
  onClose: () => void
  onGo: (href: string) => void
}) {
  const [index, setIndex] = useState(0)
  const [answers, setAnswers] = useState<Record<string, Answer>>({})
  const [lang, setLang] = useState<GuideLang>(initialGuideLang)
  const ui = GUIDE_TEXT[lang].ui
  const steps = guideSteps(role, lang)
  const step = steps[Math.min(index, steps.length - 1)]
  const isFirst = index === 0
  const isLast = index === steps.length - 1
  const Icon = step.icon

  function close() {
    onClose()
    setIndex(0)
  }

  function go(href: string) {
    close()
    onGo(href)
  }

  return (
    <Dialog open={open} onOpenChange={(o) => !o && close()}>
      <DialogContent
        showCloseButton={false}
        className="gap-0 overflow-hidden p-0 leading-design sm:max-w-[440px]"
        onKeyDown={(e) => {
          if (e.key === "ArrowRight" && !isLast) setIndex((i) => i + 1)
          if (e.key === "ArrowLeft" && !isFirst) setIndex((i) => i - 1)
        }}
      >
        <div className="relative flex flex-col gap-4 bg-[color-mix(in_oklch,var(--primary)_6%,var(--popover))] px-6 pt-6 pb-5">
          <div className="flex items-center justify-between">
            <span className="grid size-11 place-items-center rounded-tile bg-primary/14">
              <Icon className="size-5.5 text-primary" aria-hidden />
            </span>
            <div className="flex items-center gap-3">
              <div
                className="flex rounded-md border bg-card p-0.5"
                role="group"
                aria-label={ui.language}
              >
                {GUIDE_LANGS.map((l) => (
                  <button
                    key={l}
                    type="button"
                    lang={l}
                    title={LANG_LABEL[l]}
                    aria-label={LANG_LABEL[l]}
                    aria-pressed={l === lang}
                    onClick={() => {
                      setLang(l)
                      saveGuideLang(l)
                    }}
                    className={cn(
                      "rounded-[5px] px-1.5 py-0.5 font-mono text-[11px] uppercase transition-colors",
                      l === lang
                        ? "bg-primary text-primary-foreground"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    {l}
                  </button>
                ))}
              </div>
              <span className="font-mono text-xs text-muted-foreground">
                {index + 1} / {steps.length}
              </span>
            </div>
          </div>
          <div className="flex flex-col gap-2">
            <DialogTitle className="text-lg font-semibold tracking-[-0.3px]">
              {step.title}
            </DialogTitle>
            <DialogDescription className="text-[13.5px] leading-relaxed">
              {step.body}
            </DialogDescription>
          </div>
          {step.ask && (
            <AskBlock
              ask={step.ask}
              answer={answers[step.key]}
              onAnswer={(a) =>
                setAnswers((prev) => ({ ...prev, [step.key]: a }))
              }
            />
          )}
          {(step.to || step.help) && (
            <div className="flex flex-wrap gap-2">
              {step.to && (
                <Button
                  size="sm"
                  variant="outline"
                  className="text-[13px]"
                  onClick={() => go(step.to!)}
                >
                  {step.toLabel}
                  <ArrowRightIcon data-icon="inline-end" aria-hidden />
                </Button>
              )}
              {step.help && (
                <Button
                  size="sm"
                  variant="ghost"
                  className="text-[13px] text-muted-foreground"
                  onClick={() => go(step.help!)}
                >
                  <BookOpenIcon data-icon="inline-start" aria-hidden />
                  {ui.readHelp}
                </Button>
              )}
            </div>
          )}
        </div>

        <div className="flex items-center gap-3 border-t px-6 py-4">
          <div
            className="flex flex-1 items-center gap-1.5"
            role="tablist"
            aria-label={ui.steps}
          >
            {steps.map((s, i) => (
              <button
                key={s.key}
                type="button"
                role="tab"
                aria-selected={i === index}
                aria-label={`${ui.step} ${i + 1}: ${s.title}`}
                onClick={() => setIndex(i)}
                className={cn(
                  "h-1.5 rounded-full transition-all",
                  i === index
                    ? "w-5 bg-primary"
                    : i < index
                      ? "w-1.5 bg-primary/45"
                      : "w-1.5 bg-muted-foreground/25 hover:bg-muted-foreground/45"
                )}
              />
            ))}
          </div>
          {isFirst ? (
            <Button variant="ghost" size="sm" onClick={close}>
              {ui.skip}
            </Button>
          ) : (
            <Button
              variant="ghost"
              size="sm"
              onClick={() => setIndex((i) => i - 1)}
            >
              <ArrowLeftIcon data-icon="inline-start" aria-hidden />
              {ui.back}
            </Button>
          )}
          {isLast ? (
            <Button size="sm" onClick={close}>
              {ui.done}
            </Button>
          ) : (
            <Button size="sm" onClick={() => setIndex((i) => i + 1)}>
              {isFirst ? ui.start : ui.next}
              <ArrowRightIcon data-icon="inline-end" aria-hidden />
            </Button>
          )}
        </div>
      </DialogContent>
    </Dialog>
  )
}

/** Pregunta de sí o no del paso; con "No", cómo resolverlo. */
function AskBlock({
  ask,
  answer,
  onAnswer,
}: {
  ask: GuideAsk
  answer: Answer | undefined
  onAnswer: (a: Answer) => void
}) {
  return (
    <div className="flex flex-col gap-3 rounded-xl border bg-card p-4">
      <span className="text-sm font-semibold">{ask.question}</span>
      <div className="flex gap-2" role="group" aria-label={ask.question}>
        {(["yes", "no"] as const).map((a) => (
          <Button
            key={a}
            size="sm"
            variant={answer === a ? "default" : "outline"}
            aria-pressed={answer === a}
            className="flex-1 text-[13px]"
            onClick={() => onAnswer(a)}
          >
            {a === "yes" ? ask.yes : ask.no}
          </Button>
        ))}
      </div>
      {answer === "yes" && (
        <p className="flex items-start gap-2 text-[13px] text-win">
          <CircleCheckIcon className="mt-0.5 size-3.5 shrink-0" aria-hidden />
          {ask.okText}
        </p>
      )}
      {answer === "no" && (
        <div className="flex flex-col gap-2.5">
          <span className="text-[13px] font-medium">{ask.fix.title}</span>
          <ol className="flex list-decimal flex-col gap-1 pl-5 text-[13px] text-muted-foreground">
            {ask.fix.items.map((item) => (
              <li key={item}>{item}</li>
            ))}
          </ol>
          {ask.fix.download && (
            <Button asChild size="sm" className="self-start text-[13px]">
              <a
                href={ask.fix.download.href}
                target="_blank"
                rel="noopener noreferrer"
              >
                {ask.fix.download.label}
                <ExternalLinkIcon data-icon="inline-end" aria-hidden />
              </a>
            </Button>
          )}
        </div>
      )}
    </div>
  )
}
