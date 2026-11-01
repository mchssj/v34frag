import { useQuery } from "@tanstack/react-query"
import { toast } from "sonner"

import { errorMessage } from "@/api/errors"
import { Button } from "@/components/ui/button"
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card"
import { Skeleton } from "@/components/ui/skeleton"
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table"
import { LOBBY_TITLE, fmtDateTime } from "../labels"
import { adminLobbiesOptions, useMmAdminMutation } from "../queries"
import { useMmSource } from "../source"

/** Administración › Matchmaking › Salas: las activas y cancelar una trabada. */
export function LobbiesPanel() {
  const source = useMmSource()
  const { data } = useQuery(adminLobbiesOptions(source))
  const cancel = useMmAdminMutation((id: string) => source.cancelLobby(id))

  return (
    <Card>
      <CardHeader>
        <CardTitle>Salas activas</CardTitle>
        <CardDescription>
          Cancelar libera el servidor y no sanciona a nadie.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {!data && <Skeleton className="h-24 w-full" />}
        {data?.length === 0 && (
          <p className="text-sm text-muted-foreground">No hay salas activas.</p>
        )}
        {!!data?.length && (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Modo</TableHead>
                <TableHead>Estado</TableHead>
                <TableHead>Mapa</TableHead>
                <TableHead>Servidor</TableHead>
                <TableHead>Desde</TableHead>
                <TableHead />
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.map((l) => (
                <TableRow key={l.id}>
                  <TableCell className="font-mono">{l.mode}</TableCell>
                  <TableCell>{LOBBY_TITLE[l.status]}</TableCell>
                  <TableCell className="font-mono">{l.map ?? "—"}</TableCell>
                  <TableCell>{l.server ?? "—"}</TableCell>
                  <TableCell className="text-muted-foreground">
                    {fmtDateTime(l.created_at)}
                  </TableCell>
                  <TableCell className="text-right">
                    <Button
                      variant="destructive"
                      size="sm"
                      disabled={cancel.isPending}
                      onClick={() =>
                        cancel.mutate(l.id, {
                          onSuccess: () => toast.success("Sala cancelada"),
                          onError: (e) => toast.error(errorMessage(e)),
                        })
                      }
                    >
                      Cancelar
                    </Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        )}
      </CardContent>
    </Card>
  )
}
