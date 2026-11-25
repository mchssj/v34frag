import { expect, it } from "vitest"

import { savable } from "./search"

it("lo que se guarda no lleva la página ni lo vacío", () => {
  expect(savable({ kd: 1, page: 3, per: 50, q: undefined })).toEqual({ kd: 1 })
})
