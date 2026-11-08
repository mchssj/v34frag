import { Link } from "@tanstack/react-router"

import { LegalLayout, Wip, type LegalSection } from "../components/LegalLayout"
import { LEGAL_UPDATED } from "../lib/meta"

// Mismo texto que terms/terminos.html (`terms/` de la raíz del repo): si cambia uno, cambia el otro.
const SECTIONS: LegalSection[] = [
  {
    id: "quienes",
    title: "Quiénes somos",
    body: (
      <>
        <p>
          CMLeague es una liga comunitaria de Counter-Strike: Source v34,
          organizada por un equipo de administradores. No tenemos relación con
          Valve Corporation ni con los desarrolladores de ClientMod, y Valve no
          patrocina ni respalda CMLeague. Counter-Strike y Steam son marcas de
          Valve.
        </p>
        <p>
          CMLeague es un proyecto independiente de desarrollo de software con
          domicilio en la República Argentina, provincia de Buenos Aires. No es
          una sociedad comercial. En estos términos, «CMLeague», «nosotros» o
          «el equipo» se refiere a sus desarrolladores y administradores. Los
          canales de contacto están en la <a href="#contacto">sección 22</a>.
        </p>
      </>
    ),
  },
  {
    id: "cuenta",
    title: "Tu cuenta",
    body: (
      <ul>
        <li>
          Necesitas tener al menos 13 años. Si eres menor de edad en tu país,
          necesitas el permiso de tu madre, padre o tutor, sobre todo para pagar
          el VIP o instalar el anticheat.
        </li>
        <li>
          Te registras con un correo, una contraseña y un <em>tag</em> (tu
          nombre en la liga). Una persona, una cuenta: no se permiten cuentas
          duplicadas para saltar un baneo, inflar el ELO o jugar por otro.
        </li>
        <li>
          Eres responsable de lo que pase con tu cuenta. Cuida tu contraseña y
          no la compartas. Nunca te vamos a pedir tu contraseña de la web ni de
          Steam por Discord o por el chat del juego.
        </li>
        <li>
          El tag, el avatar y los datos del perfil no pueden suplantar a otra
          persona, a un equipo ni al staff, ni tener contenido ofensivo. Si lo
          hacen, los cambiamos o los quitamos.
        </li>
        <li>
          Las preferencias de privacidad del perfil (público, solo miembros o
          privado) ocultan el cuerpo del perfil, pero las estadísticas de las
          partidas, el ELO, los resultados y los baneos de la liga son públicos.
        </li>
      </ul>
    ),
  },
  {
    id: "steam",
    title: "SteamID y fichas de jugador",
    body: (
      <ul>
        <li>
          Cada vez que juegas en un servidor de la liga se crea o se actualiza
          una ficha con tu SteamID, los nicks que usaste y tus estadísticas,
          aunque no tengas cuenta en la web.
        </li>
        <li>
          Puedes reclamar tu ficha y vincularla a tu cuenta desde la web o con{" "}
          <code>!claim</code> en el servidor. Solo puedes reclamar SteamID que
          sean tuyos. Reclamar uno ajeno es motivo de baneo.
        </li>
        <li>
          Los administradores pueden aprobar, rechazar, revocar o corregir una
          vinculación, unir fichas que son de la misma persona y separar las que
          no lo son.
        </li>
      </ul>
    ),
  },
  {
    id: "conducta",
    title: "Conducta",
    body: (
      <>
        <p>
          En los servidores, la web, el chat de las partidas y el Discord no se
          permite:
        </p>
        <ul>
          <li>
            Insultos, acoso, amenazas, discriminación o contenido sexual,
            violento o ilegal.
          </li>
          <li>Spam, publicidad no autorizada, estafas o enlaces maliciosos.</li>
          <li>
            Abandonar partidas a propósito, tirar partidas, arreglar resultados
            o apostar sobre partidas en las que juegas.
          </li>
          <li>
            Hacer <em>ghosting</em> (mirar la transmisión de la partida en la
            que juegas), compartir información con el rival o usar bugs del mapa
            o del juego para sacar ventaja.
          </li>
          <li>
            Atacar, saturar o intentar entrar a los servidores, a la web, a la
            API o a las cuentas de otros, y usar la API o la web de formas que
            no ofrecemos (por ejemplo, para juntar datos en masa).
          </li>
          <li>
            Mentir en los reportes de resultados, en las capturas o en las
            denuncias.
          </li>
          <li>
            Molestar al staff con <code>!calladmin</code> u otros comandos sin
            motivo.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "juego-limpio",
    title: "Juego limpio",
    body: (
      <ul>
        <li>
          Está prohibido cualquier programa, script o modificación que dé
          ventaja: aimbot, wallhack, triggerbot, macros, scripts de bhop o de no
          recoil, texturas modificadas, y cualquier otra cosa que cambie el
          juego o lea su memoria.
        </li>
        <li>
          Los servidores de la liga usan protecciones propias y de terceros (
          <code>sv_pure</code>, anti-wallhack, controles de ClientMod y otros).
          Intentar esquivarlas es lo mismo que hacer trampa.
        </li>
        <li>
          Las configs que compartas pueden ser revisadas. Una config con scripts
          prohibidos se rechaza o queda en revisión, y usarla en partidas es
          motivo de sanción.
        </li>
        <li>
          Las demos de las partidas se graban y el staff puede revisarlas para
          decidir sanciones.
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
          CMLeague Anticheat es una aplicación para Windows que la liga puede
          exigir en mixes, matchmaking o torneos.{" "}
          <Wip>Todavía no disponible</Wip> Cuando lo esté:
        </p>
        <ul>
          <li>
            Antes de usarla te muestra qué recopila y te pide tu consentimiento.
            La vinculas con tu cuenta de cmleague.lat con un código que
            confirmas en la web.
          </li>
          <li>
            <strong>Solo recopila mientras tienes una sesión abierta</strong>,
            es decir, mientras juegas en un servidor de la liga que la exige.
            Durante la sesión puede enviar la lista de procesos abiertos
            (nombre, ruta, huella del archivo y firma) y capturas de la ventana
            del juego, solo cuando el juego está al frente. Al pedirte una
            captura, te avisa.
          </li>
          <li>
            No lee la memoria del juego, no se inyecta en él, no lee tus
            archivos personales, tu micrófono ni tu cámara, y no recopila nada
            fuera de las sesiones.
          </li>
          <li>
            La evidencia se guarda en un almacenamiento privado, solo la ve el
            staff y se borra a los 30 días, salvo que forme parte de una sanción
            en curso.
          </li>
          <li>
            El sistema no decide ni sanciona solo: el staff revisa los hechos y
            decide. Si no tienes una sesión válida en un mix que la exige, el
            servidor te puede expulsar de esa partida.
          </li>
          <li>
            No estás obligado a instalarla. Si no la instalas, no vas a poder
            entrar a las partidas que la exigen.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "sanciones",
    title: "Moderación y baneos",
    body: (
      <ul>
        <li>
          Los moderadores y administradores pueden advertirte, silenciarte,
          expulsarte de una partida, quitarte ELO, anular resultados,
          descalificar a tu equipo de un torneo o banearte de todos los
          servidores de la liga y de la web, por un tiempo o para siempre.
        </li>
        <li>
          Un baneo alcanza a tu ficha y a todos sus SteamID, también a los que
          sumes después. La lista de baneos <Wip /> va a ser pública y va a
          mostrar a quién, desde cuándo, hasta cuándo y el motivo.
        </li>
        <li>
          En el matchmaking, abandonar una partida te resta ELO (menos que una
          derrota si tu equipo gana; si pierde, al menos lo que cuesta una
          derrota) y puede sumar escalones de espera antes de volver a buscar
          partida. Si te desconectas, tu equipo puede votar en el servidor para
          darte por abandonado sin esperar a que se termine tu plazo para
          volver, y la liga puede llamar a otro jugador para que entre en tu
          lugar. Si vuelves después de que entró, quedas de espectador. Irte en
          la última ronda, o cuando ya terminó la partida, no cuenta como
          abandono.
        </li>
        <li>
          Los servidores de la liga registran tu IP, tu SteamID y tu nick al
          conectarte, para la seguridad de los servidores y para detectar
          cuentas duplicadas y evasión de baneos. Solo los administradores ven
          las IP.
        </li>
        <li>
          Si crees que una sanción es injusta, puedes apelarla por el Discord de
          la liga. El staff la revisa, pero la decisión final es de los
          administradores.
        </li>
      </ul>
    ),
  },
  {
    id: "mixes",
    title: "Mixes, matchmaking y ELO",
    body: (
      <ul>
        <li>
          Las partidas que juegas en los servidores de la liga se registran con
          sus estadísticas (bajas, muertes, asistencias, daño, rating y otras) y
          se publican en la web.
        </li>
        <li>
          El ELO y los niveles se calculan con las reglas de la liga, que vamos
          a publicar en la web <Wip />. Podemos cambiar esas reglas, recalcular
          el ELO de todos, borrar un mix (por ejemplo, si hubo trampa o se cayó
          el servidor) o ajustar el ELO a mano. Las temporadas pueden reiniciar
          el ranking.
        </li>
        <li>
          El ELO, los puntos, los niveles y el ranking no tienen valor económico
          y no son tuyos: son una medida de la liga.
        </li>
        <li>
          El matchmaking <Wip>En prueba</Wip> arma los equipos según el ELO (y,
          si la liga lo enciende, también según el rating de tus partidas
          recientes, para que queden parejos), te pide confirmar la partida y te
          asigna un servidor. Si confirmas, te comprometes a jugarla entera.
        </li>
        <li>
          Si alguien abandona una partida del matchmaking, la liga puede
          publicar en su Discord un aviso con un link para entrar en su lugar.
          El aviso muestra el modo, el mapa y el marcador, no los nombres de los
          jugadores. Si entras como reemplazo, ganas o pierdes ELO como
          cualquier jugador, según las rondas que juegues. Si tomas el lugar y
          no te conectas a tiempo, recibes la misma sanción que quien no se
          conecta a su partida. Con tu sesión iniciada, la página del link
          muestra la sala con los nombres de los jugadores; la IP y la
          contraseña del servidor, solo a quien toma el lugar.
        </li>
      </ul>
    ),
  },
  {
    id: "torneos",
    title: "Torneos, PCW y premios",
    body: (
      <ul>
        <li>
          Cada torneo tiene su reglamento (formato, mapas, fechas, cupos y
          premio), que se publica en la web y prevalece sobre estos términos en
          lo que sea propio del torneo.
        </li>
        <li>
          El dueño o capitán del equipo inscribe al equipo y responde por su
          plantel. Todos los jugadores tienen que tener cuenta y cumplir estos
          términos. Un jugador no puede estar en dos equipos del mismo torneo.
        </li>
        <li>
          El resultado de cada partida lo registra el servidor de la liga al
          terminar. Si el servidor no pudo registrarlo o hay un problema, decide
          un administrador. Mentir sobre un resultado es motivo de
          descalificación.
        </li>
        <li>
          Los torneos que crea un organizador y los mixes que vincula a sus
          partidas se publican después de que los aprueba un administrador o un
          moderador de la liga. Los torneos que crea un moderador se publican
          después de que los aprueba un administrador. Mientras tanto no se
          muestran y no suman al ranking.
        </li>
        <li>
          La liga puede publicar el registro de torneos jugados antes o fuera de
          la plataforma (torneos históricos): el nombre, la sigla y el logo de
          los equipos, sus resultados y, si se cargan, sus jugadores. Si
          apareces en uno y quieres que corrijamos o quitemos tu nombre,
          escríbenos.
        </li>
        <li>
          Los premios los entrega quien organiza el torneo, como diga el
          reglamento. Para cobrar un premio puede hacer falta demostrar tu
          identidad y que jugaste limpio. Un premio se puede retener si hay una
          investigación abierta. Los impuestos del premio corren por cuenta de
          quien lo recibe.
        </li>
        <li>
          Las PCW (prácticas entre equipos) <Wip /> no mueven el ELO de los
          jugadores, pero cuentan para el ranking de equipos y se rigen por las
          mismas reglas de conducta.
        </li>
      </ul>
    ),
  },
  {
    id: "contenido",
    title: "Lo que subes y publicas",
    body: (
      <ul>
        <li>
          Tu avatar, tu biografía, tus mensajes en el chat, tus capturas de
          resultados, tus configs y cualquier otra cosa que subas siguen siendo
          tuyos. Nos das permiso para guardarlos, mostrarlos en la web y en el
          Discord y adaptarlos (por ejemplo, recortar o comprimir una imagen),
          mientras los tengas publicados.
        </li>
        <li>
          Solo puedes subir lo que es tuyo o tienes permiso para usar. No se
          permiten archivos ejecutables ni nada que pueda dañar a otros.
        </li>
        <li>
          Las configs <Wip /> se revisan antes de publicarse: se quitan las
          contraseñas que encontremos, pero revisa tú también que no tengan
          datos privados.
        </li>
        <li>
          Podemos quitar cualquier contenido que no cumpla estos términos, sin
          aviso previo.
        </li>
      </ul>
    ),
  },
  {
    id: "clips",
    title: "Demos, clips y transmisiones",
    body: (
      <ul>
        <li>
          Las partidas se graban con SourceTV. Las demos se publican en la web y
          se borran a los 90 días.
        </li>
        <li>
          Las mejores jugadas (aces, multikills y clutches) se graban como clips
          en video desde las demos y se publican en la web, en el Discord de la
          liga y en Google Drive, con tu nick del juego. Ver la{" "}
          <Link to="/privacidad">política de privacidad</Link>.
        </li>
        <li>
          Las partidas se pueden transmitir en vivo por SourceTV, con el HUD de
          la liga, y los streamers pueden usar el widget de CMLeague en OBS. Al
          jugar en la liga aceptas que tu nick, tus estadísticas y tus jugadas
          aparezcan en esas transmisiones y en los clips.
        </li>
        <li>
          Puedes pedir que se borre un clip tuyo por el Discord de la liga.
        </li>
        <li>
          Tu ficha pública muestra tus clips destacados: los que elijas en tu
          perfil o, si no eliges, tus mejores clips, hasta el tope de la liga
          (más con VIP).
        </li>
        <li>
          La liga puede rechazar un clip que salió mal: deja de verse en la web,
          no se publica y su video se borra.
        </li>
      </ul>
    ),
  },
  {
    id: "vip",
    title: "VIP",
    body: (
      <>
        <p>
          El VIP es una membresía paga que ayuda a mantener los servidores.
          Varias de sus ventajas están <Wip>En preparación</Wip>
        </p>
        <ul>
          <li>
            Precios: 1 mes, $3.000; 3 meses, $8.100 (10 % menos), y 6 meses,
            $15.300 (15 % menos), en pesos argentinos. Los precios pueden
            cambiar, pero se respeta el que pagaste durante el período
            contratado. Hasta que la web cobre sola, el pago se acuerda con el
            staff y un administrador activa el VIP en tu cuenta.
          </li>
          <li>
            El VIP es de tu <strong>cuenta</strong>, no se transfiere ni se
            vende a otra persona. Dura el período que pagaste; los meses nuevos
            se suman a los que te quedan. El VIP de por vida dura mientras
            exista CMLeague y tu cuenta.
          </li>
          <li>
            Al vencer hay unos días de gracia. Después se apagan las ventajas:
            los cosméticos y las monedas VIP quedan congelados y vuelven si
            renuevas.
          </li>
          <li>
            El VIP da ventajas de comodidad y estética (cosméticos, estadísticas
            avanzadas, comparador, favoritas, configs, créditos, ver quién
            visitó tu perfil y visitar hasta 15 perfiles por semana sin dejar
            rastro, y similares).{" "}
            <strong>Nunca da ventaja dentro de la partida</strong> ni sobre el
            ELO ni sobre las sanciones.
          </li>
          <li>
            Podemos cambiar, sumar o quitar ventajas del VIP. Si quitamos una
            ventaja importante que estabas pagando, te lo avisamos.
          </li>
          <li>
            <strong>Derecho de arrepentimiento:</strong> como el VIP se contrata
            a distancia, puedes revocar la compra dentro de los 10 días corridos
            desde que se activa, sin dar motivos y sin costo, como establecen el
            artículo 34 de la Ley 24.240 de Defensa del Consumidor y el artículo
            1110 del Código Civil y Comercial. Se pide por los canales de la{" "}
            <a href="#contacto">sección 22</a> y te devolvemos lo pagado por el
            mismo medio.
          </li>
          <li>
            Pasados esos 10 días, el VIP no se reembolsa, salvo que no hayamos
            podido darte el servicio por una causa nuestra. Si te baneamos por
            trampa o por una falta grave comprobada, pierdes el VIP sin
            reembolso del tiempo que quedaba.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "tienda",
    title: "Puntos, tienda y misiones",
    body: (
      <>
        <p>
          <Wip />
        </p>
        <ul>
          <li>
            Ganas puntos jugando y completando misiones. Con los puntos compras
            cosméticos para tu perfil (marcos, fondos, avatares, stickers, temas
            y nombres).
          </li>
          <li>
            <strong>
              Los puntos no se compran con dinero, no se canjean por dinero ni
              por premios
            </strong>
            , no se transfieren y no tienen valor fuera de CMLeague.
          </li>
          <li>
            Si un mix se borra o se recalcula, los puntos que diste por él se
            corrigen. Lo que ya compraste no se pierde, pero si tu saldo queda
            negativo no puedes comprar hasta recuperarlo.
          </li>
          <li>
            Los cosméticos son una licencia para usarlos en tu perfil de
            CMLeague, no una propiedad. Podemos cambiar sus precios y retirar
            artículos de la venta. Hacer trampa para ganar puntos o misiones es
            motivo de sanción y de perder lo ganado.
          </li>
        </ul>
      </>
    ),
  },
  {
    id: "servidores",
    title: "Servidores de terceros",
    body: (
      <ul>
        <li>
          Algunos servidores de la liga pertenecen a terceros (otras
          comunidades) que usan nuestros plugins con una licencia. Las partidas
          que se juegan ahí cuentan igual para la liga y siguen estas reglas.
        </li>
        <li>
          Cada dueño de servidor es responsable de su servidor, sus admins y su
          conexión. Una licencia se puede revocar si el servidor no cumple la
          configuración y las reglas de la liga.
        </li>
        <li>
          Los plugins, el backend y la licencia son de CMLeague. No se pueden
          copiar, descompilar, modificar para quitar la licencia ni redistribuir
          sin permiso.
        </li>
      </ul>
    ),
  },
  {
    id: "propiedad",
    title: "Propiedad intelectual",
    body: (
      <p>
        El nombre y la marca CMLeague, la web, los diseños, los cosméticos, el
        HUD, los plugins y la aplicación del anticheat son de CMLeague o de sus
        autores. No puedes usarlos fuera de la liga sin permiso. Los mapas,
        modelos y sonidos del juego son de sus respectivos dueños.
      </p>
    ),
  },
  {
    id: "servicio",
    title: "Servicio recreativo, «tal cual está»",
    body: (
      <>
        <p>
          CMLeague es un servicio de uso <strong>recreativo</strong>,
          desarrollado y mantenido de forma independiente y sin fines de lucro.
          El acceso y el uso de la plataforma son <strong>gratuitos</strong>. El
          VIP es opcional, no hace falta para jugar y lo recaudado se destina a
          mantener los servidores.
        </p>
        <p>
          La plataforma se provee{" "}
          <strong>«tal cual está» y «según disponibilidad»</strong> (
          <em>as is</em> y <em>as available</em>). No garantizamos que funcione
          sin interrupciones ni errores, que esté disponible en un momento
          determinado ni que los resultados, estadísticas o rankings estén
          libres de errores. Los servidores, la web, la API, las demos y los
          clips pueden caerse, tener fallas o perder datos por causas técnicas,
          de los proveedores de infraestructura, de conectividad o de ataques de
          terceros. Podemos modificar, suspender o discontinuar cualquier
          función, servidor o temporada, temporal o definitivamente.
        </p>
      </>
    ),
  },
  {
    id: "responsabilidad",
    title: "Limitación de responsabilidad",
    body: (
      <>
        <p>En la máxima medida permitida por la ley argentina:</p>
        <ul>
          <li>
            CMLeague y sus desarrolladores y administradores{" "}
            <strong>no responden</strong> por fallas técnicas, interrupciones,
            caídas de servidores, pérdida o corrupción de datos, errores en el
            cálculo del ELO, los puntos o el ranking, partidas canceladas o
            anuladas, ni por la pérdida de cosméticos, puntos o progreso.
          </li>
          <li>
            Tampoco responden por los daños indirectos, el lucro cesante ni la
            pérdida de chance que surjan del uso o de la imposibilidad de usar
            la plataforma.
          </li>
          <li>
            No responden por los actos, mensajes o contenidos de otros usuarios,
            de los dueños de servidores de terceros, de los organizadores de
            torneos ni de los servicios externos (Steam, ClientMod, Discord,
            Google y los proveedores de infraestructura).
          </li>
          <li>
            Si se reconociera alguna responsabilidad vinculada al VIP, queda
            limitada al importe que hayas pagado por el VIP en los últimos 6
            meses.
          </li>
          <li>
            Respondes por los daños que causes a CMLeague o a terceros por no
            cumplir estos términos, por ejemplo con trampas, ataques a los
            servidores o contenido ilegal.
          </li>
        </ul>
        <p>
          Nada de lo anterior excluye la responsabilidad por dolo o culpa grave,
          ni limita los derechos que te reconocen la Ley 24.240 de Defensa del
          Consumidor y el Código Civil y Comercial de la Nación cuando no se
          pueden renunciar. Las cláusulas que la ley considere abusivas se
          tienen por no escritas, sin afectar al resto.
        </p>
      </>
    ),
  },
  {
    id: "baja",
    title: "Cerrar tu cuenta",
    body: (
      <ul>
        <li>
          Puedes pedir el cierre de tu cuenta por los canales de la{" "}
          <a href="#contacto">sección 22</a>. Se borran tus datos personales de
          la cuenta (correo, nombre real, redes y avatar), pero los resultados y
          las estadísticas de las partidas que jugaste quedan, porque forman
          parte del historial de la liga y de otros jugadores.
        </li>
        <li>
          Al cerrar la cuenta pierdes el VIP, los puntos y los cosméticos, sin
          reembolso.
        </li>
        <li>
          Podemos suspender o cerrar una cuenta que no cumpla estos términos.
        </li>
      </ul>
    ),
  },
  {
    id: "cambios",
    title: "Cambios a estos términos",
    body: (
      <p>
        Podemos cambiar estos términos. Cuando el cambio sea importante, lo
        avisamos en la web o en el Discord con anticipación. Si sigues usando
        CMLeague después del cambio, aceptas los términos nuevos.
      </p>
    ),
  },
  {
    id: "ley",
    title: "Ley aplicable",
    body: (
      <>
        <p>
          Estos términos, la{" "}
          <Link to="/privacidad">política de privacidad</Link> y toda relación
          entre CMLeague y sus usuarios se rigen por las leyes de la{" "}
          <strong>República Argentina</strong>, en especial el Código Civil y
          Comercial de la Nación, la Ley 24.240 de Defensa del Consumidor y la
          Ley 25.326 de Protección de los Datos Personales. Esto vale aunque
          uses la plataforma desde otro país.
        </p>
        <p>
          Si un tribunal declara inválida alguna cláusula, esa cláusula se
          ajusta o se deja sin efecto y el resto sigue vigente. Que no hagamos
          valer un derecho en un caso no significa que renunciemos a él.
        </p>
      </>
    ),
  },
  {
    id: "jurisdiccion",
    title: "Jurisdicción",
    body: (
      <ul>
        <li>
          Antes de iniciar cualquier acción, te pedimos que nos escribas por los
          canales de la <a href="#contacto">sección 22</a> para intentar
          resolver el problema de buena fe. Nos comprometemos a responder dentro
          de los 15 días hábiles.
        </li>
        <li>
          Si no se resuelve, las controversias se someten a los tribunales
          ordinarios competentes de la provincia de Buenos Aires, República
          Argentina, con renuncia a cualquier otro fuero o jurisdicción.
        </li>
        <li>
          Si actúas como <strong>consumidor</strong> según la Ley 24.240, puedes
          iniciar la acción ante los tribunales de tu domicilio, como lo
          establece el artículo 36 de esa ley, y reclamar también ante la
          autoridad de defensa del consumidor de tu jurisdicción o por el
          Sistema Nacional de Arbitraje de Consumo.
        </li>
      </ul>
    ),
  },
  {
    id: "contacto",
    title: "Información de contacto",
    body: (
      <>
        <p>
          CMLeague es un proyecto independiente: no tiene razón social ni
          oficinas de atención al público. Para consultas, reclamos, apelaciones
          de sanciones, pedidos sobre tus datos personales, ejercer el derecho
          de arrepentimiento o cualquier notificación sobre estos términos, usa
          estos canales:
        </p>
        <ul>
          <li>
            <strong>Correo de soporte:</strong>{" "}
            <a href="mailto:cmleaguev34@gmail.com">cmleaguev34@gmail.com</a>. Es
            el canal formal: los reclamos y las notificaciones se consideran
            recibidos cuando llegan a esta casilla.
          </li>
          <li>
            <strong>Discord oficial:</strong>{" "}
            <a href="https://discord.gg/bn5Yxsh9tc">discord.gg/bn5Yxsh9tc</a>,
            en el canal de soporte. Sirve para consultas rápidas y para hablar
            con un administrador.
          </li>
        </ul>
        <p>
          Nunca te vamos a pedir tu contraseña ni datos de pago por estos
          canales.
        </p>
      </>
    ),
  },
]

export function TermsPage() {
  return (
    <LegalLayout
      eyebrow="Legales"
      title="Términos y condiciones"
      updated={LEGAL_UPDATED}
      sections={SECTIONS}
      intro={
        <>
          <p>
            Estos términos son las reglas para usar CMLeague: la web
            cmleague.lat, los servidores de Counter-Strike: Source v34 de la
            liga, sus plugins, el Discord, la aplicación CMLeague Anticheat y
            todo lo que ofrecemos alrededor (mixes, matchmaking, torneos, clips,
            demos, VIP y tienda). Al crear una cuenta, entrar a un servidor de
            la liga o usar la web, aceptas estos términos y la{" "}
            <Link to="/privacidad">política de privacidad</Link>.
          </p>
          <p>
            CMLeague crece todo el tiempo. Algunas funciones que se describen
            acá <strong>todavía no están disponibles o están en prueba</strong>.
            Cuando salgan, se rigen por estos términos desde el primer día.
          </p>
        </>
      }
    />
  )
}
