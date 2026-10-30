import { describe, expect, it, vi } from "vitest"

import {
  ApiError,
  applyFieldErrors,
  errorFromResponse,
  errorMessage,
  networkError,
} from "./errors"

function res(status: number, headers: Record<string, string> = {}) {
  return new Response(null, { status, headers })
}

describe("errorFromResponse", () => {
  it("lee code, message, details y requestId del formato de la API", () => {
    const e = errorFromResponse(res(400), {
      error: {
        code: "VALIDATION_ERROR",
        message: "Los datos enviados no son válidos.",
        details: [{ path: "tag", message: "Muy corto" }, { nope: true }],
        requestId: "req-1",
      },
    })
    expect(e).toBeInstanceOf(ApiError)
    expect(e).toMatchObject({
      status: 400,
      code: "VALIDATION_ERROR",
      requestId: "req-1",
    })
    expect(e.details).toEqual([{ path: "tag", message: "Muy corto" }])
  })

  it("lee Retry-After en segundos", () => {
    const e = errorFromResponse(res(429, { "Retry-After": "12" }), {
      error: { code: "RATE_LIMITED" },
    })
    expect(e.retryAfter).toBe(12)
  })

  it("si el code no se conoce, lo deduce del status", () => {
    expect(errorFromResponse(res(409), { error: { code: "RARO" } }).code).toBe(
      "CONFLICT"
    )
    expect(errorFromResponse(res(502), null).code).toBe("INTERNAL")
  })

  it("reconoce los códigos de Equipo y Torneos y muestra el mensaje del backend", () => {
    const e = errorFromResponse(res(409), {
      error: {
        code: "REGISTRATION_CLOSED",
        message: "Las inscripciones cerraron el 05 nov.",
      },
    })
    expect(e.code).toBe("REGISTRATION_CLOSED")
    expect(errorMessage(e)).toBe("Las inscripciones cerraron el 05 nov.")
    const full = errorFromResponse(res(409), { error: { code: "ROSTER_FULL" } })
    expect(errorMessage(full)).toBe("El equipo ya tiene el roster completo.")
  })

  it("toma el requestId del header si no viene en el cuerpo", () => {
    const e = errorFromResponse(res(500, { "X-Request-Id": "hdr" }), {})
    expect(e.requestId).toBe("hdr")
  })
})

describe("errorMessage", () => {
  it("decide por code, no por el texto", () => {
    const e = new ApiError({
      status: 401,
      code: "INVALID_CREDENTIALS",
      message: "Invalid login",
    })
    expect(errorMessage(e)).toBe("Email o contraseña incorrectos.")
  })

  it("muestra tal cual el mensaje de las reglas de negocio", () => {
    const e = new ApiError({
      status: 400,
      code: "BUSINESS_RULE",
      message: "El formato BO5 no está habilitado.",
    })
    expect(errorMessage(e)).toBe("El formato BO5 no está habilitado.")
  })

  it("incluye el requestId en los errores internos", () => {
    const e = new ApiError({
      status: 500,
      code: "INTERNAL",
      message: "x",
      requestId: "abc",
    })
    expect(errorMessage(e)).toContain("abc")
  })

  it("tiene un mensaje para la red caída y para errores desconocidos", () => {
    expect(errorMessage(networkError())).toMatch(/conectar/)
    expect(errorMessage(new Error("x"))).toBe("Ocurrió un error inesperado.")
  })
})

describe("applyFieldErrors", () => {
  it("marca solo los campos del formulario, con el nombre traducido", () => {
    const setError = vi.fn()
    const e = new ApiError({
      status: 400,
      code: "VALIDATION_ERROR",
      message: "",
      details: [
        { path: "tag", message: "Tomado" },
        { path: "otro", message: "x" },
      ],
    })
    expect(
      applyFieldErrors(e, setError, ["alias"] as const, { tag: "alias" })
    ).toBe(true)
    expect(setError).toHaveBeenCalledExactlyOnceWith("alias", {
      type: "server",
      message: "Tomado",
    })
  })

  it("devuelve false si no hay campos para marcar", () => {
    const setError = vi.fn()
    const e = new ApiError({
      status: 409,
      code: "CONFLICT",
      message: "Ya hay una cuenta con ese email.",
    })
    expect(applyFieldErrors(e, setError, ["email"] as const)).toBe(false)
    expect(setError).not.toHaveBeenCalled()
  })
})
