# Prueba de captura (etapa 0b): guía

## Estado

Pantalla completa exclusiva probada en una PC el 2026-10-30. Quedan pendientes las pruebas de campo. Nada desplegado.

## Archivos

| Archivo | Cambio |
|---|---|
| `pruebas/CapturaPrueba.cs` | Prueba cuatro métodos de captura |
| `pruebas/Ritmo.cs` | Mide el tiempo entre cuadros mientras se captura. Compila, sin ejecutar |
| `docs/bitacora/2026-10-30-anticheat-etapa-0-auditoria/DOCUMENTACION.md` | Correcciones: instalación de `C:` y resultado de la captura |
| `docs/bitacora/2026-10-30-anticheat-etapa-0-auditoria/GUIA_IMPLEMENTACION.md` | La pregunta sobre EAC queda respondida |
| `docs/bitacora/README.md`, `docs/PENDIENTES.md` | Fila y estado |

## Despliegue

No aplica.

## Pruebas

Compilar, sin instalar nada:

```bash
csc /nologo /platform:x64 /r:System.Drawing.dll /out:CapturaPrueba.exe CapturaPrueba.cs
csc /nologo /platform:x64 /out:Ritmo.exe Ritmo.cs
```

`csc` está en `C:\Windows\Microsoft.NET\Framework64\v4.0.30319\`.

Medir, con el juego al frente:

```bash
CapturaPrueba.exe "CS:S v34 ClientMod" salida etiqueta
```

Medición de tirones: dejar el juego en pantalla completa y moverse por el mapa durante 2 minutos.

```bash
Ritmo.exe CapturaPrueba.exe "CS:S v34 ClientMod" salida
```

Los resultados están en `DOCUMENTACION.md`. **Después de medir, mirar las imágenes:** los números solos no detectaron la imagen congelada.

## En qué se apartó del plan

- **EAC:** el plan preveía comprobar la convivencia si el launcher lo abría. Kyan lo descartó: no se prueba nada con EAC.
- **Modos:** solo pantalla completa, a pedido de Kyan.
- **Tirones:** se agregó esa medición al plan, y quedó sin ejecutar porque las pruebas de campo van al final.

## Incidentes durante las pruebas

- El vigilante no encontraba el juego porque buscaba la clase `Valve001` y el proceso `hl2`. Se buscó por título.
- Desktop Duplication dio negro por un error de la herramienta (primer cuadro vacío). Se corrigió.
- La auditoría midió `D:\CSSv34_ClientMod`, que es un respaldo. La real es la de `C:`.

## Cómo revertir

Hacer `git revert` del commit. Borrar la carpeta temporal con las imágenes.
