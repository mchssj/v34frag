# Fichas que perdieron el vínculo con su cuenta: guía de implementación

## Estado

Hecho y probado en local el 2026-10-25, sin commit. **Producción sin tocar:** las 10 fichas siguen sin cuenta y la web vieja sigue con el error del panel (no se toca).

## Archivos

| Archivo | Cambio |
|---|---|
| `supabase/replanteo/15_claim.sql` | Sección 10: vincula los reclamos aprobados que perdieron el vínculo y avisa si queda alguno |
| Base local (Docker) | `players.user_id` de las 10 fichas, desde `claim_log` |

## Despliegue

Nada desplegado. Falta:

1. **En el corte:** la migración `15` las vincula sola, incluidas las que el panel viejo llegue a desvincular hasta entonces (si el reclamo sigue aprobado).
2. **Opcional, antes del corte (con OK de Daniel):** vincular las 10 en producción con el mismo `update` de la migración, para que las vean en la web vieja.

## Pruebas

### Diagnóstico (producción, solo lectura)

- La ficha daniloev tiene `user_id` vacío y la cuenta no tiene ficha; su reclamo está aprobado.
- 31 reclamos aprobados: 21 vinculados y 10 sin cuenta (todos del 2026-10-06 al 2026-10-13).
- Ninguna función de `public` pone `players.user_id` en null; `players` no tiene triggers propios.

### Migración `15`

- La consulta de la sección 10, corrida contra producción en modo solo lectura, encuentra **10 fichas distintas**: las 10 del diagnóstico.
- La sección completa corre sin errores en la base local, dentro de una transacción que se deshizo (con una `profile_requests` vacía de prueba): `UPDATE 0` y el bloque `DO`.

### Base local

`UPDATE 10`. La ficha daniloev quedó con la cuenta de Daniel; en la web nueva, Privacidad deja de decir "Se aplica cuando vincules tu jugador".

## En qué se apartó del plan

- **`index.html` sin cambios:** el arreglo del panel viejo se hizo y se revirtió el mismo día, porque Daniel decidió no tocar la página vieja. La migración `15` cubre también las fichas que se desvinculen hasta el corte.

## Cómo revertir

- La migración: `git checkout -- supabase/replanteo/15_claim.sql`.
- Base local: `update players set user_id = null where id in (...)` con los ids de las 10 fichas (o volver a cargar la copia de producción).
