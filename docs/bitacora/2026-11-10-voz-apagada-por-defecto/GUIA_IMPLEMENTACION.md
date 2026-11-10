# `!voz` apagado por defecto: guía de implementación

## Estado

- **Plugin:** `csstv_qol` **1.4.0**. Compila con `spcomp` 1.8 sin advertencias (md5 `fe36dbcd308a112addfa7cca03dd49e4`, 36053 bytes). **No se probó con jugadores.**
- **Desplegado el 2026-11-10 (~14:10 UTC)** en los cuatro servidores. Sin recargar: entra en el próximo cambio de mapa (`CLAUDE.md`: no recargar con una partida en curso).

## Cambio respecto del plan

Los servidores no tenían la 1.3.1 de `main` sino la **1.3.2** de Kyan (`11638b76`, solo en `kyan/pruebas`: sin el menú de modelos al entrar a un equipo). Para no sacársela, se trajo ese cambio del `.sp` y del `csstv_qol.cfg` a `main` y la 1.4.0 se armó encima.

## Compilar

```bash
SC="E:/CSS DEDICATED SERVER/server/cstrike/addons/sourcemod/scripting"
cd server/addons/sourcemod/scripting
"$SC/spcomp.exe" csstv_qol.sp -i"$SC/include" -iinclude -o<scratchpad>/csstv_qol.smx
```

## Despliegue

El SFTP de la máquina de MVZG (`190.104.34.3:2022`) no respondió desde la PC (timeout), así que se subió por la API del panel (`SFTP_CSS_API_KEY`, `POST /files/write` con el binario) y se verificó bajándolo con `/files/download`.

| Servidor | Cómo | Antes | Respaldo | Verificado |
|---|---|---|---|---|
| **#1** (`157703b5`) | API del panel | 1.3.2 (md5 `5fee9978…`) | `plugins/disabled/csstv_qol_1.3.2.smx` | md5 `fe36dbcd…` ✓ |
| **#2** (`cd1be322`) | API del panel | 1.3.2 | `plugins/disabled/csstv_qol_1.3.2.smx` | ✓ |
| **#3** (`16c850ff`) | API del panel | 1.3.2 | `plugins/disabled/csstv_qol_1.3.2.smx` | ✓ |
| Retake (`aurav34`) | SFTP (`SFTP_CSS_*`) | 1.3.2 | `plugins/disabled/csstv_qol_1.3.2.smx` | ✓ |

El `csstv_qol.cfg` de los servidores no se tocó: `csstv_qol_clutch_mute "1"` sigue valiendo y solo cambiaron los comentarios del repo.

## Para volver atrás

Copiar `plugins/disabled/csstv_qol_1.3.2.smx` sobre `plugins/csstv_qol.smx` en cada servidor; entra en el próximo cambio de mapa.

## Pendiente

- Confirmar en el próximo cambio de mapa de cada servidor que `sm_qol_status` diga `v1.4.0`.
- Probarlo en un mix: quedar último vivo sin `!voz` (se escucha al equipo) y con `!voz` (aviso y silencio hasta el final de la ronda).
