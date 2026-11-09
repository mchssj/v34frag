# Autoaceptar partida para VIP: guía de implementación

## Estado

**La web y la API están hechas; la migración 89 no se probó en una base** (2026-11-09, `kyan/pruebas`, sin commit).

- **La base local está atrasada:** no tiene `mm_my_profile`, que es de la 59, y la cadena de migraciones falla en la 68 (`team_rename`).
- **Prueba pendiente:** la tiene que correr Daniel en una base con todo hasta la 88, antes de aplicarla.
- **La web puede salir antes que la 89:** sin la 89 la API no manda `auto_accept`. La web lo trata como opcional: no muestra el interruptor y la ventana de aceptar funciona como siempre.

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/89_mm_autoaceptar_vip.sql` y su inversa en `reversas/` | Preferencia, función, trigger y `mm_my_profile` |
| `web/backend/src/routes/mm.ts` | `PUT /api/v1/mm/auto-accept` |
| `web/frontend/src/features/matchmaking/`: `types.ts`, `source.ts`, `demo.ts`, `SoundSettings.tsx`, `AcceptDialog.tsx`, `PlayPage.tsx`, `MatchAlerts.tsx` | La web |
| `docs/manual/jugador/buscar-partida.md` | "Autoaceptar (VIP)" |
| Términos y privacidad (web y `terms/`) | |

## Despliegue (Daniel)

1. **Probar la 89** en una base con todo hasta la 88, dentro de una transacción con `rollback`:
   - aplicar la 89;
   - con una cuenta VIP: `mm_set_auto_accept(true)`;
   - armar una sala con esa cuenta y ver que `accepted_at` sale lleno;
   - con una cuenta sin VIP: `mm_set_auto_accept(true)` tiene que fallar;
   - `mm_my_state()->'auto_accept'`;
   - aplicar la inversa y comparar la estructura con `estructura.sql`.
2. **Antes de aplicarla en producción:** respaldo, sin salas en curso ni nadie en la cola, y `cmleague-mm` parado, como con las otras del matchmaking. El trigger corre dentro de `mm_tick`.
3. Aplicar la 89 y `notify pgrst, 'reload schema'`.
4. API y web.
5. **Ramas:** la 89 y `mm.ts` van también en `feat/frontend-fase-1` y `feat/mm-claim-en-sala`; la web, solo en `feat/frontend-fase-1`. Antes de pasarlo, preguntar.

## Pruebas

- **Web:** las 24 pruebas de `features/matchmaking`, el perfil y `components/brand`, en verde (160 pruebas).
- **En el navegador, en `/demo/matchmaking`:**
  - Configuración › Autoaceptar partida: se prende y avisa "Autoaceptar activado".
  - Buscar partida y "Siguiente paso": la ventana sale con "1 de 10 aceptaron", "la aceptamos por ti (autoaceptar)" y "Aceptada sola".
- **API:** compila y las 569 pruebas pasan. No hay una prueba propia de la ruta: usa el mismo `action()` que el resto de `mm.ts`.
- **No se probó:** la 89 en una base, ni el autoaceptar con una sala real.

## En qué se apartó del plan

Nada.
