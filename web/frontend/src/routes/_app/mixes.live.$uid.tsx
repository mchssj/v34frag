import { createFileRoute } from "@tanstack/react-router"

import { MixLiveRoom } from "@/features/mixes/MixRoomPages"

export const Route = createFileRoute("/_app/mixes/live/$uid")({
  component: LiveMixPage,
})

function LiveMixPage() {
  const { uid } = Route.useParams()
  return <MixLiveRoom uid={uid} />
}
