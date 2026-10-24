import { act, renderHook } from "@testing-library/react"
import { beforeEach, describe, expect, it } from "vitest"

import { THEME_FX_KEY, getThemeFxPref, useThemeFxPref } from "./pref"

beforeEach(() => localStorage.clear())

describe("preferencia de efectos de tema", () => {
  it("sin valor o con un valor desconocido es null", () => {
    expect(getThemeFxPref()).toBeNull()
    localStorage.setItem(THEME_FX_KEY, "otra-cosa")
    expect(getThemeFxPref()).toBeNull()
  })

  it("guardar actualiza localStorage y a quien la use", () => {
    const { result } = renderHook(() => useThemeFxPref())
    expect(result.current[0]).toBeNull()
    act(() => result.current[1]("silent"))
    expect(result.current[0]).toBe("silent")
    expect(localStorage.getItem(THEME_FX_KEY)).toBe("silent")
  })

  it("toma el cambio hecho en otra pestaña", () => {
    const { result } = renderHook(() => useThemeFxPref())
    act(() => {
      localStorage.setItem(THEME_FX_KEY, "off")
      window.dispatchEvent(new StorageEvent("storage", { key: THEME_FX_KEY }))
    })
    expect(result.current[0]).toBe("off")
  })
})
