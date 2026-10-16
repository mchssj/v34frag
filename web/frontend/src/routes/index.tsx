import { createFileRoute } from "@tanstack/react-router"

import { Button } from "@/components/ui/button"

export const Route = createFileRoute("/")({
  component: HomePage,
})

function HomePage() {
  return (
    <div className="flex min-h-svh items-center justify-center p-6">
      <div className="flex max-w-md min-w-0 flex-col gap-4 text-sm leading-loose">
        <h1 className="font-heading text-2xl font-semibold">CSSTV</h1>
        <p className="text-muted-foreground">
          Nuevo frontend: Vite + React + TanStack Router + TanStack Query +
          shadcn/ui.
        </p>
        <Button className="w-fit">Empezar</Button>
      </div>
    </div>
  )
}
