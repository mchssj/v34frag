# Siluetas propias de las armas para los marcos arma-*.svg (Daniel, 2026-11-14: las de antes se veían deformes).
# Dibujadas a mano en perfil, el caño a la derecha; no son los íconos del juego (arte de Valve).
# Cada arma: (caja x0 y0 ancho alto, paths) con fill-rule evenodd: los agujeros son subpaths.
# Uso: python armas_marcos.py web/frontend/public/cosmetics
import sys, re, io, os

W = {
 "ak": ((0, 4, 230, 58), [
   # culata de madera
   "M2 15 L60 20 L60 31 L42 33 L6 43 L2 43 Z",
   # cajón, tapa con el escalón de atrás, alza
   "M60 18 L66 15 L118 15 L118 31 L60 31 Z",
   "M114 11 L128 11 L128 15 L114 15 Z",
   # empuñadura inclinada hacia atrás
   "M70 30 L81 30 L75 48 L64 47 Z",
   # guardamonte
   "M81 30 L83 37 L97 37 L99 30 Z M85 31 L86 34 L94 34 L95 31 Z",
   # cargador curvo
   "M99 30 L114 30 Q117 45 129 55 L118 61 Q104 49 99 30 Z",
   # guardamanos de abajo y de arriba, tubo de gases y su bloque
   "M118 20 L156 20 Q160 25 156 30 L118 30 Z",
   "M124 14 L156 14 L158 19 L122 19 Z",
   "M156 15 L176 15 L176 18.5 L156 18.5 Z",
   "M172 14 L178 14 L180 23 L172 23 Z",
   # cañón, baqueta y bocacha
   "M156 19.5 L214 19.5 L214 23 L156 23 Z",
   "M158 24.5 L204 24.5 L204 26 L158 26 Z",
   "M213 18 L224 18 L228 25 L213 25 Z",
   # mira delantera
   "M202 19.5 L205 11 L211 11 L213 19.5 Z",
 ]),
 "m4": ((0, 0, 228, 58), [
   # culata retráctil y tubo
   "M2 13 L34 14 L36 18 L36 28 L28 29 L10 40 L2 40 Z",
   "M34 17 L58 17 L58 25 L34 25 Z",
   # cajón superior e inferior
   "M58 14 L124 14 L124 23 L58 23 Z",
   "M58 23 L114 23 L114 32 L66 32 Z",
   # asa de transporte con su hueco y el alza
   "M66 14 L68 5 L112 5 L114 14 Z M74 14 L75 9.5 L106 9.5 L107 14 Z",
   "M68 1 L78 1 L78 5 L68 5 Z",
   # empuñadura
   "M70 31 L81 31 L76 48 L65 47 Z",
   # guardamonte
   "M81 31 L82 37 L98 37 L100 31 Z M85 31.5 L86 34 L95 34 L96 31.5 Z",
   # cargador recto con leve curva
   "M100 31 L114 31 L118 55 L104 56 Z",
   # anillo y guardamanos redondo con ranuras
   "M124 12 L129 12 L129 32 L124 32 Z",
   "M129 14 L168 14 Q171 21 168 29 L129 29 Z M136 18 L160 18 L160 19.5 L136 19.5 Z M136 23 L160 23 L160 24.5 L136 24.5 Z",
   # cañón, mira delantera en A y apagallamas
   "M168 19 L214 19 L214 23 L168 23 Z",
   "M168 23 L172 6 L180 6 L184 23 Z M173.5 19 L175.5 11 L177 11 L179 19 Z",
   "M175 2 L177 2 L177 6 L175 6 Z",
   "M212 17.5 L226 17.5 L226 24.5 L212 24.5 Z",
 ]),
 "awp": ((0, 2, 238, 46), [
   # culata con agujero para el pulgar y empuñadura
   "M2 16 L44 19 L84 21 L84 30 L76 30 L72 46 L61 46 L62 36 L42 34 L6 42 L2 42 Z M46 24 L66 25.5 L62 31 L47 30 Z",
   # acción y cerrojo
   "M84 20 L140 20 L140 30 L84 30 Z",
   "M95 27 L101 37 L98 38.5 L92 28 Z",
   "M100 38 m-3.5 0 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0 Z",
   # guardamonte y cargador corto
   "M76 30 L78 36 L90 36 L92 30 Z M80 31 L81 33.5 L88 33.5 L89 31 Z",
   "M106 30 L120 30 L120 39 L106 39 Z",
   # guardamanos
   "M140 21 L172 22 L172 29 L140 30 Z",
   # cañón largo y freno de boca
   "M140 22 L224 22.5 L224 25.5 L140 26 Z",
   "M222 20 L236 20 L236 28 L222 28 Z M226 22 L228 22 L228 26 L226 26 Z M231 22 L233 22 L233 26 L231 26 Z",
   # mira telescópica: ocular, tubo, torreta, objetivo y monturas
   "M80 6.5 L92 9 L92 16 L80 18.5 Z",
   "M92 10 L142 10 L142 15 L92 15 Z",
   "M112 5 L120 5 L120 10 L112 10 Z",
   "M142 9.5 L156 5 L158 5 L158 20 L156 20 L142 15.5 Z",
   "M98 15 L105 15 L105 20 L98 20 Z M128 15 L135 15 L135 20 L128 20 Z",
 ]),
 "scout": ((0, 6, 230, 40), [
   # culata fina con la ranura del cargador de repuesto y el pistolete
   "M2 19 L80 20 L80 28 L74 28 L70 44 L61 44 L62 31 L40 30 L4 37 L2 37 Z M14 24 L32 24 L32 28 L14 28.5 Z",
   # cajón delgado y cerrojo con la manija plana
   "M80 19.5 L128 19.5 L128 27 L80 27 Z",
   "M90 25 L96 32 L99 31 L101 34 L95 36 L87 26 Z",
   "M74 28 L76 33 L88 33 L90 28 Z M78 28.5 L79 31 L86 31 L87 28.5 Z",
   "M100 27 L112 27 L112 31 L100 31 Z",
   # guardamanos largo y fino con el bípode plegado debajo
   "M128 20 L188 21.5 L188 26 L128 27 Z",
   "M134 28 L184 27 L184 29.5 L134 30.5 Z M131 28.5 m-2.5 0 a2.5 2.5 0 1 0 5 0 a2.5 2.5 0 1 0 -5 0 Z",
   # cañón fino y largo con estrías, sin freno de boca
   "M188 22 L226 22.5 L226 25 L188 25.5 Z",
   "M226 22 L229 22 L229 25.5 L226 25.5 Z",
   # mira delgada: ocular, tubo largo, torreta chica, objetivo chico y monturas bajas
   "M84 10.5 L94 11.5 L94 16.5 L84 17.5 Z",
   "M94 12 L152 12 L152 15.5 L94 15.5 Z",
   "M119 9 L125 9 L125 12 L119 12 Z",
   "M152 11.5 L160 9.5 L163 9.5 L163 18 L160 18 L152 16 Z",
   "M100 15.5 L106 15.5 L106 19.5 L100 19.5 Z M138 15.5 L144 15.5 L144 19.5 L138 19.5 Z",
 ]),
 "mp5": ((0, 2, 200, 60), [
   # culata fija
   "M2 13 L50 17 L50 28 L36 30 L8 42 L2 42 Z",
   # cajón (tubo), alza de tambor
   "M50 14 L146 14 L146 26 L50 26 Z",
   "M59 11 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z",
   # grupo del disparador, empuñadura y guardamonte
   "M58 26 L96 26 L96 32 L58 32 Z",
   "M62 31 L74 31 L69 50 L57 49 Z",
   "M74 32 L75 38 L90 38 L92 32 Z M78 32.5 L79 35.5 L87 35.5 L88 32.5 Z",
   # cargador muy curvo
   "M104 26 L117 26 Q119 42 133 53 L123 60 Q107 46 104 26 Z",
   # guardamanos grueso
   "M126 21 L166 21 Q171 28 166 35 L126 35 Z",
   # tubo de la palanca de carga y la palanca
   "M146 14 L174 14 L174 19 L146 19 Z",
   "M160 14 L164 7 L168 8 L165 14 Z",
   # túnel de la mira delantera (anillo)
   "M177 12 m-7 0 a7 7 0 1 0 14 0 a7 7 0 1 0 -14 0 Z M177 12 m-4 0 a4 4 0 1 0 8 0 a4 4 0 1 0 -8 0 Z",
   "M172 17 L182 17 L182 21 L172 21 Z",
   # cañón con las tres pestañas
   "M174 19 L196 19 L196 24 L174 24 Z",
   "M186 17.5 L198 17.5 L198 25.5 L186 25.5 Z",
 ]),
 "deagle": ((-3, -1, 159, 77), [
   # corredera de atrás, baja, con estrías inclinadas y el alza de orejas
   "M6 7 L66 7 L66 24 L6 24 L4 15 Z M10 10 L13 10 L11 21 L8 21 Z M15 10 L18 10 L16 21 L13 21 Z M20 10 L23 10 L21 21 L18 21 Z",
   "M7 2.5 L10 2.5 L10 4.5 L14 4.5 L14 2.5 L17 2.5 L17 7 L7 7 Z",
   # cañón largo, más alto que la corredera, con el riel arriba (ranuras) y las dos líneas del perfil
   "M66 4 L152 4 L152 22 L66 22 Z M76 13 L146 13 L146 14.5 L76 14.5 Z",
   "M70 0 L150 0 L150 4 L70 4 Z M78 1 L80 1 L80 4 L78 4 Z M88 1 L90 1 L90 4 L88 4 Z M98 1 L100 1 L100 4 L98 4 Z M108 1 L110 1 L110 4 L108 4 Z M118 1 L120 1 L120 4 L118 4 Z M128 1 L130 1 L130 4 L128 4 Z M138 1 L140 1 L140 4 L138 4 Z",
   # armazón hasta la boca, con el frente de abajo biselado, y la palanca de desarme
   "M42 22 L152 22 L152 29 L145 35 L42 35 Z M92 26 L140 26 L140 27.5 L92 27.5 Z",
   "M82 28.5 m-3.5 0 a3.5 3.5 0 1 0 7 0 a3.5 3.5 0 1 0 -7 0 Z",
   # martillo de anillo grande
   "M6 9 L-2 6 Q-5 13 0 19 L6 20 Z M-0.5 10 L3 10.5 L3 15.5 L0 15 Z",
   # guardamonte cuadrado con el gancho adelante
   "M50 35 L50 49 Q50 55 56 55 L78 55 L84 51 L80 48 L80 35 Z M54 35 L54 48 Q54 51 57 51 L76 51 L76 35 Z",
   # empuñadura atrás, inclinada, con cola de castor y el talón
   "M14 22 L50 34 L49 41 L39 72 Q38 76 34 76 L13 76 Q9 76 10 72 L20 38 Q20 30 11 26 Z",
   "M62 35 Q59 41 63 46 L65 46 Q62 41 65 35 Z",
 ]),
 "usp": ((-3, 1, 156, 68), [
   # corredera con estrías atrás, alza y guión
   "M8 6 L96 6 L96 22 L8 22 L6 11 Z M12 9 L14 9 L14 19 L12 19 Z M17 9 L19 9 L19 19 L17 19 Z M22 9 L24 9 L24 19 L22 19 Z",
   "M10 3 L17 3 L17 6 L10 6 Z M88 3.5 L92 3.5 L92 6 L88 6 Z",
   # silenciador largo enroscado en la boca
   "M96 11 L101 11 L101 18 L96 18 Z",
   "M101 7 L150 7 Q153 7 153 10 L153 19 Q153 22 150 22 L101 22 Z M108 10.5 L146 10.5 L146 12 L108 12 Z",
   # armazón de adelante cortado en diagonal, con la ranura del riel
   "M42 22 L95 22 L90 32 L42 32 Z M58 25.5 L86 25.5 L86 27 L58 27 Z",
   # martillo redondo
   "M8 10 L2 9 Q-3 12 1 17 L8 19 Z",
   # guardamonte redondeado con el gancho adelante
   "M46 32 L46 46 Q46 52 52 52 L70 52 Q75 52 76 47 L79 42 L76 40 L76 32 Z M50 32 L50 45 Q50 48 53 48 L69 48 Q72 48 72 45 L72 32 Z",
   # empuñadura con la palanca de desamartillar arriba
   "M14 22 L46 32 L45 38 L36 65 Q35 68 32 68 L14 68 Q10 68 11 64 L19 36 Q19 28 11 25 Z",
   "M20 24 L30 25 L30 28 L20 27.5 Z",
   "M58 32 Q55 38 59 42 L61 42 Q58 38 61 32 Z",
 ]),
 "glock": ((0, 2, 96, 60), [
   # corredera cuadrada, frente plano, estrías
   "M4 4 L94 4 L94 20 L4 20 Z M9 7 L11 7 L11 17 L9 17 Z M14 7 L16 7 L16 17 L14 17 Z M19 7 L21 7 L21 17 L19 17 Z",
   "M86 1.5 L90 1.5 L90 4 L86 4 Z M8 1.5 L13 1.5 L13 4 L8 4 Z",
   # armazón de polímero con riel
   "M22 20 L90 20 L90 27 L22 27 Z M72 23 L88 23 L88 24.5 L72 24.5 Z",
   # guardamonte cuadrado
   "M40 27 L40 39 L68 39 L68 27 Z M44 27 L44 35 L64 35 L64 27 Z",
   # empuñadura más inclinada, con base del cargador
   "M6 20 L40 24 L30 57 L4 57 Z",
   "M3 56 L31 56 L31 60 L3 60 Z",
   "M52 27 L50 33 L53 33 L55 27 Z",
 ]),
 "cuchillo": ((0, 4, 176, 34), [
   # pomo, mango con estrías, guarda y hoja con punta de clip y lomo aserrado
   "M2 14 L10 12 L10 30 L2 28 Z",
   "M10 12 L60 13 L60 29 L10 30 Z M20 13 L22 13 L22 29 L20 29 Z M30 13 L32 13 L32 29 L30 29 Z M40 13 L42 13 L42 29 L40 29 Z M50 13 L52 13 L52 29 L50 29 Z",
   "M60 5 L67 5 L67 37 L60 37 Z",
   "M67 12 L76 10 L79 12 L82 10 L85 12 L88 10 L91 12 L94 10 L97 12 L132 12 L174 22 Q140 30 67 29 Z M78 18 L138 18 L138 20.5 L78 20.5 Z",
 ]),
 "he": ((0, 0, 74, 62), [
   # cuerpo ovalado con las líneas de fragmentación
   "M30 60 C12 60 6 46 6 38 C6 26 16 18 30 18 C44 18 54 26 54 38 C54 46 48 60 30 60 Z M10 34 L50 34 L50 36 L10 36 Z M8 44 L52 44 L52 46 L8 46 Z",
   # espoleta
   "M22 10 L38 10 L38 19 L22 19 Z",
   # cuchara a lo largo del cuerpo
   "M36 10 L44 8 L58 16 L60 40 L56 40 L54 18 L42 13 Z",
   # anilla y seguro
   "M14 8 m-8 0 a8 8 0 1 0 16 0 a8 8 0 1 0 -16 0 Z M14 8 m-5 0 a5 5 0 1 0 10 0 a5 5 0 1 0 -10 0 Z",
   "M20 11 L24 12 L24 14 L20 13 Z",
 ]),
}

# Dónde va el arma: en el marco, centrada en la placa de abajo (el grupo ya está trasladado a 128 230), con borde
# oscuro; en el sticker, en la etiqueta de arriba (centro 64 50), con el borde blanco del sticker.
DONDE = {
    "marcos": dict(cx=0, cy=0, w=124, h=28, stroke="#111", px=0.7),
    "stickers": dict(cx=64, cy=50, w=104, h=44, stroke="#fff", px=0.9),
}


def group(name, cx, cy, w, h, stroke, px):
    (x0, y0, bw, bh), paths = W[name]
    s = min(w / bw, h / bh)
    tx, ty = cx - (x0 + bw / 2) * s, cy - (y0 + bh / 2) * s
    d = "".join(f'<path d="{p}"/>' for p in paths)
    return (f'<g transform="translate({tx:.2f} {ty:.2f}) scale({s:.4f})" fill="url(#sk)" stroke="{stroke}" '
            f'stroke-width="{round(px / s, 2)}" stroke-linejoin="round" fill-rule="evenodd">{d}</g>')


if __name__ == "__main__":
    # Uso: python armas_marcos.py web/frontend/public/cosmetics   (cambia marcos/arma-*.svg y stickers/arma-*.svg)
    base = sys.argv[1]
    for carpeta, conf in DONDE.items():
        for n in W:
            p = os.path.join(base, carpeta, f"arma-{n}.svg")
            s = io.open(p, encoding="utf-8").read()
            new, k = re.subn(r'<g transform="(?:scale\(1\.45\)|translate\([^"]*\) scale\([^"]*\))" fill="url\(#sk\)".*?</g>',
                             lambda m: group(n, **conf), s, count=1, flags=re.S)
            assert k == 1, (carpeta, n)
            io.open(p, "w", encoding="utf-8", newline="\n").write(new)
        print("ok", carpeta, len(W))
