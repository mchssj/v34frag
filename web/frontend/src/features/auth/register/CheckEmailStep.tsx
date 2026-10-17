import { LinkIcon, MailCheckIcon, TargetIcon } from "lucide-react"

import { maskEmail } from "./helpers"

export function CheckEmailStep({
  alias,
  email,
}: {
  alias: string
  email: string
}) {
  return (
    <>
      <div className="flex flex-col items-center gap-3.5 py-3 text-center">
        <span className="grid size-14 place-items-center rounded-full bg-primary/14">
          <MailCheckIcon className="size-[26px] text-primary" aria-hidden />
        </span>
        <h1 className="text-[26px] font-semibold tracking-[-0.6px]">
          Revisa tu correo
        </h1>
        <p className="max-w-[400px] text-sm leading-[1.55] text-pretty text-muted-foreground">
          Tu cuenta <b className="text-foreground">{alias}</b> está creada.
          Enviamos un enlace a{" "}
          <b className="text-foreground">{maskEmail(email)}</b>: confírmalo y
          luego inicia sesión.
        </p>
      </div>
      <div className="flex flex-col gap-2.5 rounded-tile border bg-card px-4 py-3.5">
        <span className="text-[13px] font-semibold">
          Al entrar por primera vez
        </span>
        <span className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <TargetIcon className="size-4 shrink-0" aria-hidden />
          Elige tu puesto preferido y país (opcional)
        </span>
        <span className="flex items-center gap-2.5 text-[13px] text-muted-foreground">
          <LinkIcon className="size-4 shrink-0" aria-hidden />
          Vincula tu jugador con !claim en el servidor (opcional)
        </span>
      </div>
    </>
  )
}
