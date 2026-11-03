import { Link } from "@tanstack/react-router"

import { DISCORD } from "@/config/site"
import { LegalLayout, Wip, type LegalSection } from "../components/LegalLayout"
import { LEGAL_UPDATED } from "../lib/meta"

const SECTIONS: LegalSection[] = [
  {
    id: "cuenta",
    title: "Cuenta y perfil",
    body: (
      <>
        <h3>¿Necesito una cuenta para jugar?</h3>
        <p>
          No. Cada vez que juegas en un servidor de la liga se arma una ficha
          con tu SteamID y tus estadísticas. La cuenta en la web sirve para
          tener tu perfil, armar o sumarte a un equipo, inscribirte en torneos y
          publicar PCW.
        </p>
        <h3>¿Cómo vinculo mi SteamID con mi cuenta?</h3>
        <p>
          Escribe <code>!claim</code> en un servidor de la liga y sigue los
          pasos, o pídelo desde tu perfil en la web. Un administrador revisa el
          pedido y, cuando lo aprueba, tu ficha pasa a tu cuenta con todo su
          historial.
        </p>
        <h3>¿Puedo cambiar mi nombre en la liga?</h3>
        <p>
          Sí, tu <em>tag</em> se cambia desde tu perfil. Tiene que tener entre 2
          y 24 caracteres y no puede estar usado por otra persona.
        </p>
        <h3>Me olvidé la contraseña</h3>
        <p>
          La recuperación desde la web está <Wip />. Mientras tanto, escríbenos
          desde el correo de tu cuenta por los canales de{" "}
          <Link to="/soporte">Soporte</Link>.
        </p>
      </>
    ),
  },
  {
    id: "jugar",
    title: "Jugar en los servidores",
    body: (
      <>
        <h3>¿Cómo empieza un mix?</h3>
        <p>
          Cuando todos los jugadores de los dos equipos escriben{" "}
          <code>!ready</code>, la partida arranca sola con una ronda de cuchillo
          para elegir lado.
        </p>
        <h3>Comandos útiles</h3>
        <ul>
          <li>
            <code>!ready</code> / <code>!unready</code>: marcarte listo o no.
          </li>
          <li>
            <code>!pause</code> / <code>!unpause</code>: pausa táctica de tu
            equipo. <code>!tech</code>: pausa técnica, si se te cayó el juego o
            la conexión.
          </li>
          <li>
            <code>!gg</code>: votar la rendición de tu equipo cuando va
            perdiendo por mucho.
          </li>
          <li>
            <code>!rtv</code> y <code>!vote &lt;mapa&gt;</code>: pedir otro mapa
            en el calentamiento.
          </li>
          <li>
            <code>!status</code>: cómo está configurada la partida.
          </li>
          <li>
            <code>!calladmin</code>: avisarle al staff que hace falta un
            administrador.
          </li>
        </ul>
        <h3>¿Qué pasa si se cae el servidor en medio de un mix?</h3>
        <p>
          El mix queda como interrumpido con la última ronda jugada. Si se jugó
          al menos el 35 % de las rondas y no estaba empatado, un administrador
          puede aprobar el ELO.
        </p>
        <h3>¿Hay matchmaking?</h3>
        <p>
          Está <Wip>En prueba</Wip> Vas a poder buscar partida desde la web,
          solo o con un amigo, y el sistema arma los equipos según el ELO.
        </p>
      </>
    ),
  },
  {
    id: "elo",
    title: "ELO, niveles y ranking",
    body: (
      <>
        <h3>¿Cómo funciona el ELO?</h3>
        <p>
          Todos empiezan en 1000. Cada mix que terminas te suma o te resta según
          el resultado y la fuerza de los dos equipos, con un pequeño extra por
          tu rendimiento. Los niveles van del 1 al 10.
        </p>
        <h3>¿Qué partidas cuentan?</h3>
        <p>
          Solo los mixes. Las partidas oficiales de torneo y las PCW no cambian
          el ELO. Además cuenta lo que jugaste: con menos del 35 % de las rondas
          el ELO no cambia y desde el 90 % cuenta completo.
        </p>
        <h3>¿Por qué cambió mi ELO sin jugar?</h3>
        <p>
          Puede pasar si se borró un mix (por ejemplo, por trampa o por una
          caída del servidor) o si se recalculó el ELO de todos. Las temporadas,
          además, reinician el ranking.
        </p>
      </>
    ),
  },
  {
    id: "equipos",
    title: "Equipos, torneos y PCW",
    body: (
      <>
        <h3>¿Cómo armo un equipo?</h3>
        <p>
          Desde la web, con <strong>Solicitar equipo</strong> (nombre y sigla).
          Cuando un administrador lo aprueba, quedas como dueño y capitán, y
          puedes sumar a tus jugadores.
        </p>
        <h3>¿Qué hace el capitán?</h3>
        <p>
          Inscribe al equipo en los torneos, veta los mapas y reporta los
          resultados con capturas. Puede pasarle la capitanía a otro jugador del
          equipo.
        </p>
        <h3>¿Qué es una PCW?</h3>
        <p>
          Una práctica entre equipos. Publicas un anuncio en la sección PCW,
          otro equipo lo acepta y se juega con el mismo veto y reporte que una
          partida oficial. No cuenta para el ranking.
        </p>
      </>
    ),
  },
  {
    id: "vip",
    title: "VIP, puntos y tienda",
    body: (
      <>
        <h3>¿Qué es el VIP?</h3>
        <p>
          Una membresía opcional que ayuda a mantener los servidores: 1 mes a
          $3.000, 3 meses a $8.100 y 6 meses a $15.300. Da ventajas de comodidad
          y estética, como cosméticos y estadísticas avanzadas.{" "}
          <strong>Nunca da ventaja dentro de la partida.</strong>
        </p>
        <h3>¿Puedo arrepentirme de la compra?</h3>
        <p>
          Sí, dentro de los 10 días corridos desde que se activa. Pídelo por los
          canales de <Link to="/soporte">Soporte</Link>.
        </p>
        <h3>¿Cómo consigo puntos?</h3>
        <p>
          Jugando mixes y completando misiones <Wip />. Con los puntos compras
          cosméticos para tu perfil. Los puntos no se compran ni se canjean por
          dinero.
        </p>
      </>
    ),
  },
  {
    id: "demos",
    title: "Demos y clips",
    body: (
      <>
        <h3>¿Dónde veo la demo de una partida?</h3>
        <p>
          En el detalle de cada partida, en la web. Las demos se guardan 90 días
          y después se borran.
        </p>
        <h3>¿Cómo se hacen los clips?</h3>
        <p>
          Se graban solos desde las demos: los aces, las multikills y los
          clutches. Las mejores jugadas de cada mix se publican también en el
          Discord. Si quieres que se borre un clip tuyo, pídelo por{" "}
          <Link to="/soporte">Soporte</Link>.
        </p>
      </>
    ),
  },
  {
    id: "anticheat",
    title: "CMLeague Anticheat",
    body: (
      <>
        <h3>¿Qué es?</h3>
        <p>
          Una aplicación para Windows que la liga va a poder exigir en mixes,
          matchmaking o torneos <Wip>Todavía no disponible</Wip> Solo recopila
          mientras juegas en un servidor que la pide, y nunca lee la memoria del
          juego ni tus archivos.
        </p>
        <h3>¿Qué datos envía?</h3>
        <p>
          Lo contamos en detalle en <Link to="/privacidad">Privacidad</Link> y
          en <Link to="/seguridad">Seguridad</Link>. ¿Te quedó otra duda?
          Pregunta en el{" "}
          <a href={DISCORD.inviteUrl} target="_blank" rel="noopener noreferrer">
            Discord
          </a>
          .
        </p>
      </>
    ),
  },
]

export function FaqPage() {
  return (
    <LegalLayout
      eyebrow="Ayuda"
      title="Preguntas frecuentes"
      updated={LEGAL_UPDATED}
      sections={SECTIONS}
      intro={
        <p>
          Lo que más nos preguntan sobre la cuenta, los servidores, el ELO, los
          equipos y el VIP. Si no encuentras tu respuesta, escríbenos desde{" "}
          <Link to="/soporte">Soporte</Link>.
        </p>
      }
    />
  )
}
