# CSSTV – frontend nuevo (`web/`)

Reescritura del frontend de `index.html` (raíz del repo). Mientras dure la migración, el `index.html` actual sigue siendo el de producción. El detalle de cada vista a migrar está en [docs/VISTAS.md](../docs/VISTAS.md).

## Stack

| Pieza | Uso |
|---|---|
| Vite + React 19 + TypeScript | Base del proyecto |
| TanStack Router | Rutas por archivo en `src/routes/` (el plugin genera `src/routeTree.gen.ts`) |
| TanStack Query | Consultas y caché de datos remotos (Supabase) |
| shadcn/ui (Radix, preset `b3PBYm`, estilo `radix-nova`) | Componentes en `src/components/ui/` |
| Tailwind CSS 4 | Estilos; tema en `src/index.css` |
| pnpm | Gestor de paquetes |

## Requisitos

Node 24 y pnpm 11. Las versiones están fijadas con [mise](https://mise.jdx.dev) en `.mise.toml`, en la carpeta que contiene el repo (`CSSTV/`).

## Comandos

```bash
pnpm install
pnpm dev         # servidor de desarrollo
pnpm build       # typecheck + build a dist/
pnpm lint
pnpm typecheck
pnpm format
```

Agregar componentes de shadcn:

```bash
pnpm dlx shadcn@latest add dialog table tabs
```

## Rutas

Cada archivo en `src/routes/` es una ruta (`index.tsx` → `/`, `__root.tsx` → layout raíz). `src/routeTree.gen.ts` se regenera solo con `pnpm dev` o `pnpm build` y se versiona; no se edita a mano.
