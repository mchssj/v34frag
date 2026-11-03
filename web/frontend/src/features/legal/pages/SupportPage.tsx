import { Link } from "@tanstack/react-router"

import { DISCORD } from "@/config/site"
import { LegalLayout, type LegalSection } from "../components/LegalLayout"
import { LEGAL_UPDATED } from "../lib/meta"

// Mismos canales que la sección "Información de contacto" de los términos.
const SUPPORT_EMAIL = "cmleaguev34@gmail.com"

const SECTIONS: LegalSection[] = [
  {
    id: "antes",
    title: "Antes de escribirnos",
    body: (
      <>
        <p>
          Muchas dudas ya están respondidas en las{" "}
          <Link to="/ayuda">preguntas frecuentes</Link>. Si igual necesitas
          ayuda, mándanos todo lo que puedas para resolverlo rápido:
        </p>
        <ul>
          <li>Tu tag en la web y tu SteamID.</li>
          <li>El servidor, el día y la hora aproximada.</li>
          <li>Qué pasó y qué esperabas que pasara.</li>
          <li>Capturas o, si es algo de una partida, el link y la ronda.</li>
        </ul>
      </>
    ),
  },
  {
    id: "canales",
    title: "Canales de soporte",
    body: (
      <ul>
        <li>
          <strong>Discord:</strong>{" "}
          <a href={DISCORD.inviteUrl} target="_blank" rel="noopener noreferrer">
            dsc.gg/v34frag
          </a>
          , en el canal de soporte. Es lo más rápido para dudas y problemas del
          día a día.
        </li>
        <li>
          <strong>Correo:</strong>{" "}
          <a href={`mailto:${SUPPORT_EMAIL}`}>{SUPPORT_EMAIL}</a>. Es el canal
          formal: reclamos, apelaciones, pedidos sobre tus datos personales y el
          derecho de arrepentimiento del VIP.
        </li>
      </ul>
    ),
  },
  {
    id: "servidor",
    title: "Problemas en el servidor",
    body: (
      <ul>
        <li>
          Si hace falta un administrador en plena partida, escribe{" "}
          <code>!calladmin</code> con el motivo. El aviso les llega a los
          moderadores en el Discord.
        </li>
        <li>
          Si se te cayó el juego o la conexión, tu equipo puede pedir una pausa
          técnica con <code>!tech</code>.
        </li>
        <li>
          Usa <code>!calladmin</code> solo cuando haga falta: molestar al staff
          sin motivo es una falta.
        </li>
      </ul>
    ),
  },
  {
    id: "reportar",
    title: "Reportar a un jugador",
    body: (
      <>
        <p>
          Si crees que alguien hace trampa o no respeta las reglas, avisa con{" "}
          <code>!calladmin</code> en el momento o escríbenos por el Discord con
          el link de la partida y la ronda. El staff revisa la demo y decide.
        </p>
        <p>
          No publiques acusaciones en los canales públicos: si estás equivocado,
          le haces daño a alguien que no hizo nada.
        </p>
      </>
    ),
  },
  {
    id: "apelar",
    title: "Apelar una sanción",
    body: (
      <p>
        Si crees que una sanción es injusta, escríbenos por correo o por el
        Discord con tu tag, tu SteamID y por qué no estás de acuerdo. Un miembro
        del staff que no la puso la revisa. La decisión final es de los
        administradores.
      </p>
    ),
  },
  {
    id: "cuenta",
    title: "Tu cuenta y tus datos",
    body: (
      <>
        <p>
          Puedes pedirnos ver, corregir o borrar tus datos, vincular o
          desvincular una ficha, o cerrar tu cuenta. Escríbenos desde el correo
          de tu cuenta, así sabemos que eres tú.
        </p>
        <p>
          Respondemos los pedidos de acceso a tus datos dentro de los 10 días
          corridos y los de corrección o borrado dentro de los 5 días hábiles.
          Más detalle en <Link to="/privacidad">Privacidad</Link>.
        </p>
      </>
    ),
  },
  {
    id: "vip",
    title: "VIP y pagos",
    body: (
      <p>
        Si tienes un problema con tu VIP, o quieres arrepentirte de la compra
        dentro de los 10 días corridos desde que se activó, escríbenos por
        correo. Te devolvemos lo pagado por el mismo medio. Las condiciones
        completas están en los{" "}
        <Link to="/terminos" hash="vip">
          Términos de uso
        </Link>
        .
      </p>
    ),
  },
]

export function SupportPage() {
  return (
    <LegalLayout
      eyebrow="Ayuda"
      title="Soporte"
      updated={LEGAL_UPDATED}
      sections={SECTIONS}
      intro={
        <p>
          Cómo pedir ayuda, reportar a un jugador o apelar una sanción. Para
          reclamos formales, el plazo de respuesta es de 15 días hábiles.
        </p>
      }
    />
  )
}
