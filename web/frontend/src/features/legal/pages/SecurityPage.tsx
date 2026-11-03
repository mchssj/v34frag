import { Link } from "@tanstack/react-router"

import { DISCORD } from "@/config/site"
import { LegalLayout, Wip, type LegalSection } from "../components/LegalLayout"
import { LEGAL_UPDATED } from "../lib/meta"

const SECURITY_EMAIL = "cmleaguev34@gmail.com"

const SECTIONS: LegalSection[] = [
  {
    id: "contrasena",
    title: "Tu contraseña",
    body: (
      <ul>
        <li>
          Usa una contraseña que no uses en ningún otro sitio, de al menos 8
          caracteres, con números y mayúsculas.
        </li>
        <li>
          No la compartas con nadie, tampoco con tus compañeros de equipo.
        </li>
        <li>
          Marca <strong>Recordarme</strong> solo en tu propia computadora. Sin
          esa opción, la sesión se cierra al cerrar la pestaña.
        </li>
      </ul>
    ),
  },
  {
    id: "estafas",
    title: "Lo que nunca te vamos a pedir",
    body: (
      <>
        <ul>
          <li>Tu contraseña de la web ni la de Steam.</li>
          <li>Los códigos de Steam Guard.</li>
          <li>Los datos de tu tarjeta o de tu cuenta bancaria.</li>
          <li>
            Que instales un programa que no sea el anticheat oficial de la liga.
          </li>
        </ul>
        <p>
          Si alguien te escribe por privado diciendo que es del staff y te pide
          algo de esto, es una estafa. Los únicos canales oficiales son la web{" "}
          <strong>cmleague.lat</strong> y el Discord{" "}
          <a href={DISCORD.inviteUrl} target="_blank" rel="noopener noreferrer">
            dsc.gg/v34frag
          </a>
          . Ante la duda, pregunta en el canal de soporte.
        </p>
      </>
    ),
  },
  {
    id: "steam",
    title: "Steam y tu ficha",
    body: (
      <ul>
        <li>
          Tu ficha de jugador está atada a tu SteamID: si alguien entra a tu
          cuenta de Steam, puede jugar con tu nombre. Ten activado Steam Guard.
        </li>
        <li>
          Si ves partidas que no jugaste o alguien reclamó tu SteamID, avísanos
          por <Link to="/soporte">Soporte</Link>.
        </li>
      </ul>
    ),
  },
  {
    id: "servidores",
    title: "En los servidores",
    body: (
      <ul>
        <li>
          Al conectarte, el servidor registra tu IP para frenar ataques y
          detectar cuentas duplicadas. Solo la ven los administradores.
        </li>
        <li>
          No compartas la contraseña de un servidor que te pasó el staff para
          una partida.
        </li>
        <li>
          Las configs que se comparten en la web se revisan, y se rechaza
          cualquier archivo ejecutable. No instales configs ni programas de
          otros que vengan por fuera de la web.
        </li>
      </ul>
    ),
  },
  {
    id: "anticheat",
    title: "CMLeague Anticheat",
    body: (
      <>
        <p>
          <Wip>Todavía no disponible</Wip> Cuando lo esté, la aplicación:
        </p>
        <ul>
          <li>
            Te pide tu consentimiento y te muestra qué recopila antes de
            empezar.
          </li>
          <li>
            Solo recopila durante una partida que la exige: la lista de procesos
            abiertos y capturas de la ventana del juego.
          </li>
          <li>
            No lee la memoria del juego, no se inyecta en él y no accede a tus
            archivos, tu micrófono ni tu cámara.
          </li>
          <li>
            Guarda la evidencia 30 días y no sanciona sola: la revisa una
            persona del staff.
          </li>
        </ul>
        <p>
          El detalle de los datos está en{" "}
          <Link to="/privacidad">Privacidad</Link>.
        </p>
      </>
    ),
  },
  {
    id: "nosotros",
    title: "Lo que hacemos nosotros",
    body: (
      <ul>
        <li>
          Las contraseñas se guardan cifradas: nadie del staff puede verlas.
        </li>
        <li>
          La sesión usa credenciales que vencen cada hora y se renuevan solas.
        </li>
        <li>
          El acceso a los datos está limitado por reglas en la base de datos:
          los datos sensibles, como las IP, solo los ven los administradores.
        </li>
        <li>La web no usa herramientas de analítica ni publicidad.</li>
      </ul>
    ),
  },
  {
    id: "robo",
    title: "Si crees que entraron a tu cuenta",
    body: (
      <ol className="flex list-decimal flex-col gap-1.5 pl-5">
        <li>Cambia la contraseña de tu correo y la de Steam.</li>
        <li>
          Escríbenos desde el correo de tu cuenta a{" "}
          <a href={`mailto:${SECURITY_EMAIL}`}>{SECURITY_EMAIL}</a> para que
          revisemos la cuenta y te ayudemos a recuperarla. El cambio de
          contraseña desde la web está <Wip />.
        </li>
        <li>
          Si alguien jugó con tu nombre, avísanos para revisar esas partidas.
        </li>
      </ol>
    ),
  },
  {
    id: "vulnerabilidades",
    title: "Reportar una vulnerabilidad",
    body: (
      <>
        <p>
          Si encontraste una falla de seguridad en la web, la API, los
          servidores o los plugins, escríbenos a{" "}
          <a href={`mailto:${SECURITY_EMAIL}`}>{SECURITY_EMAIL}</a> con el
          asunto «Seguridad». Cuéntanos qué encontraste y cómo reproducirlo.
        </p>
        <ul>
          <li>
            No uses la falla para entrar a cuentas o datos de otros, ni para
            tirar un servidor.
          </li>
          <li>No la publiques hasta que la hayamos arreglado.</li>
          <li>
            Si cumples estas reglas y actúas de buena fe, no vamos a tomar
            medidas en tu contra, y si quieres te nombramos en los
            agradecimientos.
          </li>
        </ul>
      </>
    ),
  },
]

export function SecurityPage() {
  return (
    <LegalLayout
      eyebrow="Ayuda"
      title="Seguridad"
      updated={LEGAL_UPDATED}
      sections={SECTIONS}
      intro={
        <p>
          Cómo cuidar tu cuenta, cómo reconocer una estafa y cómo avisarnos si
          encuentras una falla de seguridad.
        </p>
      }
    />
  )
}
