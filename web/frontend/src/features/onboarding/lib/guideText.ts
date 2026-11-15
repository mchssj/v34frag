// Textos de la guía de la primera vez en español, portugués e inglés (Kyan, 2026-11-14).
// Solo la guía: el resto de la web sigue en español. El manual está solo en español.

export const GUIDE_LANGS = ["es", "pt", "en"] as const
export type GuideLang = (typeof GUIDE_LANGS)[number]

export const LANG_LABEL: Record<GuideLang, string> = {
  es: "Español",
  pt: "Português",
  en: "English",
}

export type AskText = {
  question: string
  yes: string
  no: string
  okText: string
  fixTitle: string
  fixItems: string[]
  download?: string
}

export type StepText = {
  title: string
  body: string
  toLabel?: string
  ask?: AskText
}

export type GuideUi = {
  start: string
  next: string
  back: string
  skip: string
  done: string
  readHelp: string
  steps: string
  step: string
  language: string
}

type GuideText = { ui: GuideUi; steps: Record<string, StepText> }

const ES: GuideText = {
  ui: {
    start: "Empezar",
    next: "Siguiente",
    back: "Anterior",
    skip: "Saltar guía",
    done: "Listo",
    readHelp: "Leer en la ayuda",
    steps: "Pasos de la guía",
    step: "Paso",
    language: "Idioma",
  },
  steps: {
    welcome: {
      title: "Bienvenido a CM League",
      body: "Mixes, matchmaking y torneos de Counter-Strike: Source v34. Antes de jugar, revisemos dos cosas que necesitas en tu PC; después te mostramos dónde está cada cosa en la web.",
    },
    clientmod: {
      title: "ClientMod: el juego con el que se juega",
      body: "Todas nuestras partidas se juegan en CS:S v34 con ClientMod, una versión del juego mantenida por la comunidad. No es el Counter-Strike: Source que se descarga de Steam: es otro juego y se instala aparte.",
      ask: {
        question: "¿Ya tienes ClientMod instalado?",
        yes: "Sí, lo tengo",
        no: "No",
        okText:
          "Perfecto. Con ClientMod abres el juego y te conectas a nuestros servidores.",
        fixTitle: "Cómo instalarlo",
        fixItems: [
          "Descárgalo desde su página oficial.",
          "Instálalo y ábrelo una vez para que termine de preparar el juego.",
          "Si algo falla, pregunta en el canal de soporte del Discord.",
        ],
        download: "Descargar ClientMod",
      },
    },
    console: {
      title: "La consola del juego",
      body: "La consola es la ventana donde escribes comandos dentro del juego. La vas a usar para entrar a un servidor pegando el connect que te da la sala de la partida.",
      ask: {
        question: "¿Tienes la consola activada?",
        yes: "Sí, la abro",
        no: "No sé / No",
        okText:
          "Bien. Se abre con la tecla que está debajo de Esc (º o ~, según tu teclado).",
        fixTitle: "Cómo activarla",
        fixItems: [
          "En el juego, entra a Opciones › Teclado › Avanzado.",
          "Marca «Habilitar consola de desarrollador (~)» y acepta.",
          "Ábrela con la tecla que está debajo de Esc (º o ~, según tu teclado).",
        ],
      },
    },
    play: {
      title: "Busca partida",
      body: "En Jugar buscas partida solo o con tu grupo. Cuando se arma, la aceptas, votas el mapa y entras al servidor con Conectar o pegando el connect en la consola.",
      toLabel: "Ir a Jugar",
    },
    claim: {
      title: "Vincula tu SteamID",
      body: "En tu primera partida escribe !claim en el chat del juego y sigue los pasos. Así la web sabe que ese jugador eres tú: sin eso, tus partidas no suman ELO ni estadísticas.",
      toLabel: "Ver mi vinculación",
    },
    matches: {
      title: "Partidas y ranking",
      body: "En Partidas ves lo que se está jugando y los resultados, con la demo y los clips. Todos empiezan con 1000 de ELO: los mixes lo suben o lo bajan, y con él se ordena el Ranking.",
      toLabel: "Ir a Partidas",
    },
    teams: {
      title: "Equipos y torneos",
      body: "En Mi equipo creas el tuyo o pides entrar a uno. Con un equipo se anotan en los torneos, que están en Torneos.",
      toLabel: "Ir a Mi equipo",
    },
    admin: {
      title: "Administración",
      body: "Tu cuenta tiene acceso a Administración: lo ves al final del menú, con las secciones que te tocan. En Ayuda tienes también las páginas de tu rol.",
      toLabel: "Ir a Administración",
    },
    help: {
      title: "¿Dudas? Ayuda",
      body: "En Ayuda está el manual completo: cómo se juega, los comandos del servidor, las sanciones y más. Desde ahí puedes volver a ver esta guía cuando quieras.",
      toLabel: "Ir a Ayuda",
    },
  },
}

const PT: GuideText = {
  ui: {
    start: "Começar",
    next: "Próximo",
    back: "Anterior",
    skip: "Pular guia",
    done: "Pronto",
    readHelp: "Ler na ajuda (em espanhol)",
    steps: "Passos do guia",
    step: "Passo",
    language: "Idioma",
  },
  steps: {
    welcome: {
      title: "Bem-vindo à CM League",
      body: "Mixes, matchmaking e campeonatos de Counter-Strike: Source v34. Antes de jogar, vamos conferir duas coisas que você precisa no seu PC; depois mostramos onde fica cada coisa no site.",
    },
    clientmod: {
      title: "ClientMod: o jogo que usamos",
      body: "Todas as nossas partidas são jogadas no CS:S v34 com o ClientMod, uma versão do jogo mantida pela comunidade. Não é o Counter-Strike: Source que se baixa na Steam: é outro jogo e é instalado à parte.",
      ask: {
        question: "Você já tem o ClientMod instalado?",
        yes: "Sim, tenho",
        no: "Não",
        okText:
          "Perfeito. Com o ClientMod você abre o jogo e se conecta aos nossos servidores.",
        fixTitle: "Como instalar",
        fixItems: [
          "Baixe na página oficial.",
          "Instale e abra uma vez para ele terminar de preparar o jogo.",
          "Se algo der errado, pergunte no canal de suporte do Discord.",
        ],
        download: "Baixar ClientMod",
      },
    },
    console: {
      title: "O console do jogo",
      body: "O console é a janela onde você digita comandos dentro do jogo. Você vai usá-lo para entrar num servidor colando o connect que a sala da partida te dá.",
      ask: {
        question: "Você tem o console ativado?",
        yes: "Sim, abro ele",
        no: "Não sei / Não",
        okText:
          "Ótimo. Ele abre com a tecla abaixo do Esc (' ou ~, dependendo do teclado).",
        fixTitle: "Como ativar",
        fixItems: [
          "No jogo, vá em Opções › Teclado › Avançado.",
          "Marque «Ativar console do desenvolvedor (~)» e confirme.",
          "Abra com a tecla abaixo do Esc (' ou ~, dependendo do teclado).",
        ],
      },
    },
    play: {
      title: "Procure partida",
      body: "Em Jugar (Jogar) você procura partida sozinho ou com seu grupo. Quando ela fecha, você aceita, vota no mapa e entra no servidor com Conectar ou colando o connect no console.",
      toLabel: "Ir para Jogar",
    },
    claim: {
      title: "Vincule seu SteamID",
      body: "Na sua primeira partida, digite !claim no chat do jogo e siga os passos. Assim o site sabe que esse jogador é você: sem isso, suas partidas não somam ELO nem estatísticas.",
      toLabel: "Ver minha vinculação",
    },
    matches: {
      title: "Partidas e ranking",
      body: "Em Partidas você vê o que está sendo jogado e os resultados, com a demo e os clipes. Todos começam com 1000 de ELO: os mixes aumentam ou diminuem, e com ele o Ranking é ordenado.",
      toLabel: "Ir para Partidas",
    },
    teams: {
      title: "Times e campeonatos",
      body: "Em Mi equipo (Meu time) você cria o seu ou pede para entrar em um. Com um time vocês se inscrevem nos campeonatos, que ficam em Torneos (Campeonatos).",
      toLabel: "Ir para Meu time",
    },
    admin: {
      title: "Administração",
      body: "Sua conta tem acesso a Administración (Administração): fica no final do menu, com as seções que te cabem. Na Ayuda (Ajuda) também estão as páginas do seu cargo.",
      toLabel: "Ir para Administração",
    },
    help: {
      title: "Dúvidas? Ajuda",
      body: "Na Ayuda (Ajuda) está o manual completo (em espanhol): como se joga, os comandos do servidor, as punições e mais. De lá você pode rever este guia quando quiser.",
      toLabel: "Ir para Ajuda",
    },
  },
}

const EN: GuideText = {
  ui: {
    start: "Start",
    next: "Next",
    back: "Back",
    skip: "Skip guide",
    done: "Done",
    readHelp: "Read the help (in Spanish)",
    steps: "Guide steps",
    step: "Step",
    language: "Language",
  },
  steps: {
    welcome: {
      title: "Welcome to CM League",
      body: "Mixes, matchmaking and tournaments for Counter-Strike: Source v34. Before you play, let's check two things you need on your PC; then we'll show you where everything is on the site.",
    },
    clientmod: {
      title: "ClientMod: the game we play on",
      body: "All our matches are played on CS:S v34 with ClientMod, a community-maintained version of the game. It isn't the Counter-Strike: Source you get on Steam: it's a separate game, installed on its own.",
      ask: {
        question: "Do you already have ClientMod installed?",
        yes: "Yes, I do",
        no: "No",
        okText:
          "Great. With ClientMod you open the game and connect to our servers.",
        fixTitle: "How to install it",
        fixItems: [
          "Download it from its official page.",
          "Install it and open it once so it finishes setting up the game.",
          "If something goes wrong, ask in the Discord support channel.",
        ],
        download: "Download ClientMod",
      },
    },
    console: {
      title: "The game console",
      body: "The console is the window where you type commands in the game. You'll use it to join a server by pasting the connect command the match room gives you.",
      ask: {
        question: "Is your console enabled?",
        yes: "Yes, I can open it",
        no: "Not sure / No",
        okText:
          "Good. It opens with the key below Esc (~ or `, depending on your keyboard).",
        fixTitle: "How to enable it",
        fixItems: [
          "In the game, go to Options › Keyboard › Advanced.",
          "Check “Enable developer console (~)” and confirm.",
          "Open it with the key below Esc (~ or `, depending on your keyboard).",
        ],
      },
    },
    play: {
      title: "Find a match",
      body: "In Jugar (Play) you queue alone or with your group. When a match is found, you accept it, vote on the map and join the server with Conectar or by pasting the connect command in the console.",
      toLabel: "Go to Play",
    },
    claim: {
      title: "Link your SteamID",
      body: "In your first match, type !claim in the game chat and follow the steps. That's how the site knows that player is you: without it, your matches don't count for ELO or stats.",
      toLabel: "See my link",
    },
    matches: {
      title: "Matches and ranking",
      body: "In Partidas (Matches) you see what's being played and past results, with the demo and clips. Everyone starts at 1000 ELO: mixes raise or lower it, and the Ranking is sorted by it.",
      toLabel: "Go to Matches",
    },
    teams: {
      title: "Teams and tournaments",
      body: "In Mi equipo (My team) you create your own or ask to join one. With a team you sign up for tournaments, listed under Torneos.",
      toLabel: "Go to My team",
    },
    admin: {
      title: "Administration",
      body: "Your account can access Administración: it's at the bottom of the menu, with the sections for your role. Ayuda (Help) also has the pages for your role.",
      toLabel: "Go to Administration",
    },
    help: {
      title: "Questions? Help",
      body: "Ayuda (Help) has the full manual (in Spanish): how to play, server commands, penalties and more. From there you can open this guide again whenever you want.",
      toLabel: "Go to Help",
    },
  },
}

export const GUIDE_TEXT: Record<GuideLang, GuideText> = {
  es: ES,
  pt: PT,
  en: EN,
}

const langKey = "csstv.guide-lang"

/** El idioma elegido; si no eligió, el del navegador (pt o en), y si no, español. */
export function initialGuideLang(): GuideLang {
  try {
    const saved = localStorage.getItem(langKey)
    if (saved && (GUIDE_LANGS as readonly string[]).includes(saved))
      return saved as GuideLang
  } catch {
    // Sin storage: se usa el del navegador.
  }
  const nav = (typeof navigator !== "undefined" ? navigator.language : "")
    .slice(0, 2)
    .toLowerCase()
  return nav === "pt" || nav === "en" ? nav : "es"
}

export function saveGuideLang(lang: GuideLang) {
  try {
    localStorage.setItem(langKey, lang)
  } catch {
    // Sin storage: vuelve al del navegador la próxima vez.
  }
}
