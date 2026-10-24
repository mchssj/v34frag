import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"
import { authKeys, missingSession } from "@/auth/queries"
import { tokenStore, toSession } from "@/auth/tokenStore"

export const profileKeys = {
  mine: ["profile", "mine"] as const,
}

export const myProfileOptions = queryOptions({
  queryKey: profileKeys.mine,
  queryFn: ({ signal }) => unwrap(api.GET("/api/v1/me/profile", { signal })),
})

export function useUpdateProfile() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (body: Schemas["ProfilePatch"]) =>
      unwrap(api.PATCH("/api/v1/me/profile", { body })),
    onSuccess: (profile) => queryClient.setQueryData(profileKeys.mine, profile),
  })
}

export function useUploadAvatar() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (blob: Blob) =>
      unwrap(
        api.POST("/api/v1/me/avatar", {
          // El schema tipa `file` como string (binary); se arma el multipart a mano.
          body: { file: "" },
          bodySerializer: () => {
            const form = new FormData()
            form.append("file", blob, "avatar.jpg")
            return form
          },
        })
      ),
    onSuccess: () =>
      queryClient.invalidateQueries({ queryKey: profileKeys.mine }),
  })
}

/** Ficha del jugador (nivel, privacidad…). La comparten el pie del sidebar y Mi perfil. */
export function playerDetailOptions(id: string) {
  return queryOptions({
    queryKey: ["player", id] as const,
    queryFn: ({ signal }) =>
      unwrap(
        api.GET("/api/v1/players/{id}", { params: { path: { id } }, signal })
      ),
    staleTime: 5 * 60_000,
  })
}

/**
 * Cambia la contraseña. El backend cierra todas las sesiones de la cuenta (también esta) y
 * devuelve una nueva: se guarda en lugar de la anterior, con el mismo "Recordarme".
 */
export function useChangePassword() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: async (body: Schemas["PasswordChangeBody"]) => {
      const session = await unwrap(api.POST("/api/v1/me/password", { body }))
      if (!session) throw missingSession()
      queryClient.setQueryData(authKeys.me, session.user)
      tokenStore.setSession(toSession(session), tokenStore.getState().remember)
      return session.user
    },
  })
}

/** Cambia el alias (una vez cada 15 días; 409 si está tomado, 400 si falta esperar). */
export function useChangeAlias() {
  const queryClient = useQueryClient()
  return useMutation({
    mutationFn: (alias: string) =>
      unwrap(api.PUT("/api/v1/me/alias", { body: { alias } })),
    onSuccess: () => {
      void queryClient.invalidateQueries({ queryKey: profileKeys.mine })
      void queryClient.invalidateQueries({ queryKey: authKeys.me })
    },
  })
}
