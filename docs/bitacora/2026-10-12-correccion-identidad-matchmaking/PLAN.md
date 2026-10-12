# Plan: corregir identidad y acceso al matchmaking

## Problemas reportados
- La cola rechaza a una cuenta que ya tiene SteamID64 vinculado.
- En la tarjeta del matchmaking se muestra el email/local-part en lugar del nickname.

## Objetivos
1. Aceptar los dos formatos de SteamID64 que ya reconoce el sistema de CSSTV.
2. Priorizar el nickname del jugador asociado a la cuenta, luego el tag de perfil, y usar el email solo como último respaldo.
3. Dar un mensaje de error que aclare que la cuenta debe estar asociada al perfil de jugador, además de tener SteamID64.

## Alcance y límites
- No auto-vincular perfiles por un SteamID escrito manualmente; eso podría permitir reclamar estadísticas de otra persona.
- No modificar datos existentes de usuarios ni asociar perfiles automáticamente.
- Aplicar la migración en Supabase y probar con la cuenta afectada antes de considerar el problema resuelto.
