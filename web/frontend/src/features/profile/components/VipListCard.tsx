import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query"
import { Link } from "@tanstack/react-router"
import { toast } from "sonner"

import { api, unwrap } from "@/api/client"
import { errorMessage } from "@/api/errors"
import { Switch } from "@/components/ui/switch"
import { CardTitle, SectionCard } from "./ui"

// (replanteo 87) Un VIP elige si aparece en "Gracias a los VIP" de la página del Equipo. Solo se ve si es VIP.

const KEY = ["me", "vip-list"] as const

export function VipListCard() {
  const queryClient = useQueryClient()
  const { data } = useQuery({
    queryKey: KEY,
    queryFn: () => unwrap(api.GET("/api/v1/me/vip-list")),
  })
  const set = useMutation({
    mutationFn: (hidden: boolean) =>
      unwrap(api.PUT("/api/v1/me/vip-list", { body: { hidden } })),
    onSuccess: (d) => {
      queryClient.setQueryData(KEY, d)
      void queryClient.invalidateQueries({ queryKey: ["staff"] })
    },
    onError: (e) => toast.error(errorMessage(e)),
  })
  if (!data?.vip) return null
  return (
    <SectionCard className="flex items-start gap-3.5 p-5">
      <CardTitle
        className="flex-1"
        title="Aparecer en la lista de VIP"
        description={
          <>
            Tu nick en «Gracias a los VIP» de la página{" "}
            <Link to="/equipo" className="underline">
              Quiénes somos
            </Link>
            .
          </>
        }
      />
      <Switch
        aria-label="Aparecer en la lista de VIP"
        checked={!data.hidden}
        disabled={set.isPending}
        onCheckedChange={(on) => set.mutate(!on)}
      />
    </SectionCard>
  )
}
