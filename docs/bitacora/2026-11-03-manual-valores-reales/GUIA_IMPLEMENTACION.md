# Valores reales de la base en el manual: guía de implementación

## Estado

**Implementado y probado (2026-11-03), sin commit.** El replanteo `65` está **aplicado en staging**, con el visto bueno de Daniel. La API solo corre en local (contra staging); no se desplegó.

## Ramas

| Parte | Rama | Carpeta |
|---|---|---|
| Replanteo `65` e inversa | Las dos: `feat/mm-claim-en-sala` y `feat/frontend-fase-1` | `v34frag-mmclaim` y `v34frag` |
| API | `feat/mm-claim-en-sala` | `E:\Css V34 Web\v34frag-mmclaim\web\backend` |
| Manual, plan y bitácora | `feat/frontend-fase-1` | `E:\Css V34 Web\v34frag` |

La API del manual (`2026-11-02-manual-usuario`) tampoco tiene commit todavía: los dos requerimientos salen juntos.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/65_manual_valores.sql` | Nuevo: `manual_valores()` |
| `docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/65_manual_valores.sql` | Nuevo: la inversa |
| `web/backend/src/lib/manual.ts` | `MARCADORES`, `duracion`, `formatearValor`, `aplicarMarcadores`, `marcadoresDesconocidos` y la validación en `armarManual` |
| `web/backend/src/routes/manual.ts` | `valoresDelManual` (caché de 60 s), `olvidarValores` (pruebas) y el reemplazo en la página |
| `web/backend/test/unit/manual.test.ts` | 7 pruebas nuevas |
| `docs/manual/jugador/buscar-partida.md` | Marcadores; la tabla de sanciones pasa a ser una frase (la cantidad de escalones también se configura) |
| `docs/manual/jugador/baneos-y-sanciones.md`, `equipo.md`, `clips-y-demos.md`, `elo-y-estadisticas.md`, `vincular-steamid.md` | Marcadores. En `elo-y-estadisticas`, "alrededor de un tercio" y "casi toda" pasan a ser los porcentajes reales |
| `docs/manual/moderador/sanciones-matchmaking.md` | La escalera con `{{mm.sanciones}}` |
| `docs/manual/README.md` | Sección "Valores de la configuración" |

## Pruebas

### Base

`pruebas/correr.sh` aplica la `65`, las pruebas y la inversa en una sola transacción que se deshace. Corrido contra staging antes de aplicarla:

```
NOTICE:  OK 1: 15 claves como authenticated
NOTICE:  OK 2: sigue a mm_config
NOTICE:  OK 3: anon no puede
NOTICE:  OK: la inversa la borra
```

### API

```bash
cd web/backend && pnpm typecheck && pnpm test     # 475 en verde, 7 nuevas
MANUAL_DIR="E:/Css V34 Web/v34frag/docs/manual" pnpm build   # 10 páginas, sin errores
```

Las pruebas nuevas cubren duraciones (minutos, horas y días), singular y plural, separador de miles, valores raros o ausentes (valor por defecto), que todo el catálogo tenga un valor por defecto que se pueda mostrar, el marcador desconocido, mal escrito o en el resumen, la caché de 60 s y la base caída.

### De punta a punta (API local contra staging, cuenta `daniloev`)

| Momento | `jugador/buscar-partida` |
|---|---|
| Antes de aplicar la `65` | "tienes **15 segundos**" (valor por defecto) y un aviso en el log |
| Después de aplicarla | "tienes **20 segundos**", el valor de staging. Sanciones: "5 minutos, 15 minutos, 1 hora y 24 horas. Desde ahí, cada falta nueva te deja 24 horas sin buscar." |

## En qué se apartó del plan

- **Un marcador más, `claim.max_steam_ids`:** `vincular-steamid` decía "hasta 3 cuentas de Steam", y el tope se cambia en Administración (`set_claim_config`). Se sumó a la función, al catálogo y a las pruebas antes de aplicar la `65` en staging.
- **Sin el formato "duración" suelto:** los tiempos de un solo valor van en segundos o en minutos; la duración en palabras solo hace falta para la escalera.

## Despliegue
> **En staging desde el 2026-11-03**, en una sola tanda con el manual, los valores reales del manual, los legales, la imagen del login (`67`), el resumen del matchmaking (`66`) y los reportes, clips y nombre del equipo (`68`): base `66` y `67` aplicadas (la `65` y la `68` ya estaban), API `0d5732881cbe` (merge temporal "tmp: API de staging" de `034d280a` de `feat/mm-claim-en-sala` sobre `f5f6d7b9`, en `v34frag-deploy`, con `MANUAL_DIR` = `v34frag/docs/manual`: 37 páginas) y web `e53200f83840` (checkout limpio de `feat/frontend-fase-1`). Detalle en [`2026-11-03-reportes-clips-nombre-equipo`](../2026-11-03-reportes-clips-nombre-equipo/GUIA_IMPLEMENTACION.md).

1. **Staging, base:** hecho el 2026-11-03 (`psql -v ON_ERROR_STOP=1 -f supabase/replanteo/65_manual_valores.sql`). Verificado: `authenticated` la puede llamar, `anon` no.
2. **Staging, API:** con el del manual (`2026-11-02-manual-usuario`, ver su guía). Comprobar en el log que no aparezca `manual: no se pudieron leer los valores`.
3. **Producción:** con el corte, después de la `64`.

## Cómo revertir

- **Base:** `psql -v ON_ERROR_STOP=1 -f docs/bitacora/2026-10-14-replanteo-modelo-datos/reversas/65_manual_valores.sql`. La API sigue andando con los valores por defecto (y un aviso en el log cada 60 s).
- **API:** revertir los cambios de `lib/manual.ts` y `routes/manual.ts`. Ojo: las páginas con marcadores quedarían mostrando `{{…}}`; hay que volver también los `.md`.
