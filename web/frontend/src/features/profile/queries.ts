import {
  queryOptions,
  useMutation,
  useQueryClient,
} from "@tanstack/react-query"

import { api, unwrap, type Schemas } from "@/api/client"

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
