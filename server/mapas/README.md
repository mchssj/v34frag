# Herramientas de mapas

Scripts para dejar mapas listos para CS:S v34 (no-steam, ClientMod) y para armar versiones "_ob" (sin techo: las granadas pasan por arriba de todo, como `de_dust2_ob`).

La carpeta de trabajo, fuera del repo, es `C:\Users\Agus\Documents\mapas_trabajo\`:

- `bspsrc\`: BSPSource 1.4.8 (descompilador, necesita Java).
- `juego\gameinfo.txt`: carpeta de juego para compilar. Usa el contenido del CS:S de Steam, el de `C:\CSSv34_ClientMod\cstrike_downloads` y el pak del mapa que se está armando (una línea `game ".../<mapa>/pak"` por mapa).
- Una carpeta por mapa (`de_tuscan\`, …).

Compiladores: los del CS:S de Steam (`...\Counter-Strike Source\bin\vbsp.exe`, `vvis.exe`, `vrad.exe`). Lo que sacan no lo lee v34 tal cual: hay que pasarlo por `post_ob.py`.

## Scripts

| Script | Para qué |
|---|---|
| `bsp.py mapa.bsp` | Resumen de un `.bsp`: lumps, límites, props estáticos (versión), pak. |
| `brushes.py mapa.bsp` | Bloques por textura de herramientas y contenido (cielo, clip, nodraw). |
| `sprp_v5.py entrada.bsp salida.bsp` | Pasa los props estáticos de v10 a v5. Arregla los mapas que tiran abajo el servidor al cargar. |
| `bsp_unlzma.py entrada.bsp salida.bsp` | Descomprime un `.bsp` con LZMA (lumps, game lumps y pak) y pasa los props a v5. |
| `sin_techo_vmf.py entrada.vmf salida.vmf [--techo 2560]` | Borra el cielo de la zona de juego y la encierra en una caja de cielo con el techo alto. No toca el cielo 3D. Lee la zona de juego del `.bsp` que está al lado del `.vmf`. |
| `semillas.py original.bsp compilado.bsp entrada.vmf salida.vmf` | Control después de `vbsp`: busca zonas que en el original eran parte del mapa y en el compilado quedaron rellenas o "afuera". Tiene que dar 0 (o solo puntos en el borde de un bloque que también está en el original). Si encuentra espacios cerrados de verdad (un patio que se ve por una ventana y que en el original mantenía una luz), les pone un `info_target`. |
| `post_ob.py compilado.bsp original.bsp salida.bsp` | Deja el compilado listo para v34: props v5, sin comprimir, y el pak del original sumado (con los cubemaps pasados al nombre nuevo). |

## Cómo se arma un mapa "_ob"

Ejemplo con `de_x` (todo en `mapas_trabajo\de_x\`):

1. Copiar `de_x.bsp` del servidor (o del cliente, si es igual) a la carpeta.
2. Revisar con `bsp.py`: si tiene props v10 o LZMA, pasarlo antes por `sprp_v5.py` o `bsp_unlzma.py`.
3. Descompilar (lo corre una persona: Claude Code no deja ejecutar BSPSource):
   `java -jar ...\mapas_trabajo\bspsrc\bspsrc.jar -o de_x.vmf de_x.bsp`
4. Sacar el pak del `.bsp` a `de_x\pak\` y sumar esa carpeta en `juego\gameinfo.txt`.
5. `python sin_techo_vmf.py de_x.vmf de_x_ob.vmf`. Además del cielo, arregla los clips: BSPSource los deja como `toolstrigger` en el mundo y vbsp los compila sólidos (rellenan zonas enteras, frenan granadas y balas). Los busca en el `.bsp` original y les pone `toolsclip` o `toolsplayerclip` según su contenido. Revisar que "sin par" dé 0.
6. `vbsp -game <juego> de_x_ob` (segundos). Revisar en `vbsp.log` que no haya `leak` ni `Static prop ... outside the map`, y correr `semillas.py`. Si algo falla, corregir antes de seguir, porque vvis tarda.
7. `vvis -game <juego> de_x_ob` y `vrad -both -game <juego> de_x_ob`. Con el techo alto, vvis tarda bastante más que en el mapa original (tuscan: unos 22 minutos).
8. `python post_ob.py de_x_ob.bsp de_x.bsp listo\de_x_ob.bsp`
9. Probar que cargue en el servidor local (`Downloads\cssds`) y probar a mano que las granadas pasen y se vean.
10. Copiar también el `.nav` del original como `de_x_ob.nav`.

Por qué no alcanza con editar el `.bsp`: sacarle lo sólido al cielo deja pasar las granadas, pero arriba queda el vacío de afuera del mapa, y el juego no manda ni dibuja lo que está ahí. La granada desaparece mientras está arriba. Hace falta recompilar con el techo alto para que ese espacio sea parte del mapa.

Detalle: [`docs/bitacora/2026-11-13-mapas-nuevos`](../../docs/bitacora/2026-11-13-mapas-nuevos/).
