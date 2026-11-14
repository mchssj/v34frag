import { fireEvent, render, screen } from "@testing-library/react"
import { describe, expect, it } from "vitest"

import { AvatarThumb, FramedAvatar, NameFx, Stickers } from "./cosmetics"
import { ItemPreviewDialog, ItemThumb } from "./ItemPreview"
import { withItem } from "./ShopPage"
import type { Equipped } from "./types"

const empty: Equipped = {
  frame: null,
  avatar: null,
  background: null,
  theme: null,
  name: null,
  stickers: [],
}
const sticker = (id: string) => ({ id, kind: "sticker" as const })

describe("withItem", () => {
  it("pone y saca uno por tipo", () => {
    const e = withItem(empty, { id: "marco-fuego", kind: "frame" }, true)
    expect(e.frame).toBe("marco-fuego")
    expect(
      withItem(e, { id: "marco-fuego", kind: "frame" }, false).frame
    ).toBeNull()
  })

  it("hasta 3 stickers: el cuarto deja afuera al más viejo y no se repiten", () => {
    let e = empty
    for (const id of ["a1", "b2", "c3"]) e = withItem(e, sticker(id), true)
    expect(e.stickers).toEqual(["a1", "b2", "c3"])
    expect(withItem(e, sticker("d4"), true).stickers).toEqual([
      "b2",
      "c3",
      "d4",
    ])
    expect(withItem(e, sticker("a1"), true).stickers).toEqual([
      "b2",
      "c3",
      "a1",
    ])
    expect(withItem(e, sticker("b2"), false).stickers).toEqual(["a1", "c3"])
  })
})

describe("cosméticos", () => {
  it("el efecto de nombre lleva la clase y el texto en data-nombre", () => {
    render(<NameFx text="kyan" effect={{ css_class: "nombre-brillo" }} />)
    const el = screen.getByText("kyan")
    expect(el).toHaveClass("nombre-brillo")
    expect(el).toHaveAttribute("data-nombre", "kyan")
  })

  it("el marco sale de /cosmetics/ y sin marco queda la foto sola", () => {
    const { container, rerender } = render(
      <FramedAvatar
        alias="kyan"
        src="/foto.png"
        frame={{ file: "marcos/fuego.svg" }}
        size={40}
      />
    )
    expect(container.querySelector(".avf-marco")).toHaveAttribute(
      "src",
      "/cosmetics/marcos/fuego.svg"
    )
    rerender(<FramedAvatar alias="kyan" src="/foto.png" size={40} />)
    expect(container.querySelector(".avf-marco")).toBeNull()
    expect(container.querySelector("img")).toHaveAttribute("src", "/foto.png")
  })

  it("los stickers con su nombre; sin stickers, nada", () => {
    const { container, rerender } = render(
      <Stickers
        size={32}
        items={[
          {
            id: "sticker-gg",
            kind: "sticker",
            name: "GG",
            file: "stickers/gg.svg",
            css_class: null,
          },
        ]}
      />
    )
    expect(screen.getByAltText("GG")).toHaveAttribute(
      "src",
      "/cosmetics/stickers/gg.svg"
    )
    rerender(<Stickers size={32} items={[]} />)
    expect(container).toBeEmptyDOMElement()
  })
})

describe("avatares animados", () => {
  const avatar = { file: "avatars/avatar-rana-estrella.webm" }

  it("withItem: el avatar es uno solo, aparte del marco", () => {
    const e = withItem(
      withItem(empty, { id: "marco-fuego", kind: "frame" }, true),
      { id: "avatar-x", kind: "avatar" },
      true
    )
    expect(e).toMatchObject({ frame: "marco-fuego", avatar: "avatar-x" })
  })

  it("en la ficha reemplaza la foto con el video en bucle, mudo y con su póster", () => {
    const { container } = render(
      <FramedAvatar alias="kyan" src="/foto.png" avatar={avatar} size={120} />
    )
    const video = container.querySelector("video")!
    expect(video).toHaveAttribute(
      "src",
      "/cosmetics/avatars/avatar-rana-estrella.webm"
    )
    expect(video).toHaveAttribute(
      "poster",
      "/cosmetics/avatars/avatar-rana-estrella.webp"
    )
    expect(video.muted).toBe(true)
    expect(video).toHaveAttribute("loop")
    expect(container.querySelector('img[src="/foto.png"]')).toBeNull()
  })

  it("en una fila se ve quieto y se anima al pasar el mouse", () => {
    const { container } = render(<AvatarThumb avatar={avatar} size={30} />)
    expect(container.querySelector("video")).toBeNull()
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/cosmetics/avatars/avatar-rana-estrella.webp"
    )
    fireEvent.mouseEnter(container.firstElementChild!)
    expect(container.querySelector("video")).not.toBeNull()
    fireEvent.mouseLeave(container.firstElementChild!)
    expect(container.querySelector("video")).toBeNull()
  })
})

describe("avatares SVG de Kyan", () => {
  it("se ven como imagen, sin video, en la ficha y en las filas", () => {
    const avatar = { file: "avatares/samurai.svg" }
    const { container, rerender } = render(
      <FramedAvatar alias="kyan" src="/foto.png" avatar={avatar} size={120} />
    )
    expect(container.querySelector("video")).toBeNull()
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/cosmetics/avatares/samurai.svg"
    )
    rerender(<AvatarThumb avatar={avatar} size={30} />)
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/cosmetics/avatares/samurai.svg"
    )
  })
})

describe("vista previa en ventana", () => {
  const fondo = {
    id: "fondo-extra-cerezos",
    kind: "background" as const,
    name: "Cerezos en flor",
    description: "Pétalos que caen.",
    file: "fondos/extra-cerezos.svg",
    css_class: null,
    collection: "anime",
    animated: true,
    vip_only: false,
  }

  it("muestra el artículo, dónde se ve, el perfil, el lobby y la fila, con los botones", () => {
    render(
      <ItemPreviewDialog
        item={fondo}
        onClose={() => {}}
        alias="kyan"
        photo={null}
        level={7}
        price={<span>800 puntos</span>}
        actions={<button type="button">Comprar</button>}
      />
    )
    expect(screen.getByRole("dialog")).toHaveTextContent("Cerezos en flor")
    expect(screen.getByText(/Fondos de miniperfil · Anime · Animado/)).toBeInTheDocument()
    expect(screen.getByText("En tu perfil")).toBeInTheDocument()
    expect(screen.getByText("En el lobby de Jugar")).toBeInTheDocument()
    expect(screen.getByText("En el ranking y en la sala")).toBeInTheDocument()
    expect(screen.getByText("Nivel 7")).toBeInTheDocument()
    expect(screen.getByText("800 puntos")).toBeInTheDocument()
    expect(screen.getByRole("button", { name: "Comprar" })).toBeInTheDocument()
    // El fondo grande y detrás de la tarjeta del lobby.
    expect(
      screen
        .getByRole("dialog")
        .querySelectorAll('img[src="/cosmetics/fondos/extra-cerezos.svg"]')
        .length
    ).toBe(2)
  })

  it("sin artículo no abre nada", () => {
    render(
      <ItemPreviewDialog
        item={null}
        onClose={() => {}}
        alias="kyan"
        photo={null}
        level={null}
      />
    )
    expect(screen.queryByRole("dialog")).toBeNull()
  })

  it("la miniatura de un avatar en video usa su imagen fija", () => {
    const { container } = render(
      <ItemThumb
        item={{
          ...fondo,
          id: "avatar-x",
          kind: "avatar",
          file: "avatars/avatar-x.webm",
        }}
      />
    )
    expect(container.querySelector("img")).toHaveAttribute(
      "src",
      "/cosmetics/avatars/avatar-x.webp"
    )
  })
})
