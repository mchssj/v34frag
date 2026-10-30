/**
 * v34 Retake
 *
 * Modo de juego para CS:S v34: cada ronda arranca con la bomba plantada en un sitio al azar,
 * los T la defienden y los CT entran a desactivarla. Inactivo al cargar: un admin lo prende con
 * sm_retake 1. No envía nada a ningún lado y no depende de csstv_reporter.
 *
 * v34 no permite crear planted_c4 desde un plugin (la entidad queda sin temporizador), así que un
 * T aparece en el punto de la bomba y el plugin le aprieta el ataque mientras todos esperan
 * congelados. La bomba se planta de verdad, con su cuenta y sus eventos.
 *
 * retake/spawns.inc (puntos por mapa), retake/guns.inc (!guns) y retake/vote.inc (votación de mapa).
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <cstrike>
#include <clientprefs>

#define PLUGIN_VERSION "1.0.0"
#define RETAKE_PREFIX "{#verde}[Retake]{#blanco}"
#define TEAM_SPEC 1
#define TEAM_T 2
#define TEAM_CT 3
#define PREPARE_DELAY 0.1
#define ARRANGE_DELAY 1.0
#define PLANT_TIMEOUT 6.0
#define MAP_END_DELAY 5.0
#define WAIT_CHECK 3.0
#define KEEP_ON_DELAY 5.0
#define ROUND_TIME "2"
#define ROUND_END_DELAY 5.0
#define SHUFFLE_TRIES 20
#define DEFUSE_TIME_KIT 5.0
#define DEFUSE_TIME_NO_KIT 10.0
#define SITE_TEXT_Y 0.32
#define SITE_TEXT_TIME 5.0

public Plugin myinfo =
{
	name = "v34 Retake",
	author = "v34frag",
	description = "Modo retake: la ronda arranca con la bomba plantada",
	version = PLUGIN_VERSION,
	url = ""
};

enum ArrangeMode
{
	Arrange_Keep = 0,   // quedan los T y se completa hasta la proporción
	Arrange_CtWin,      // los CT con más daño pasan a T
	Arrange_Shuffle     // todos al azar
};

ConVar g_cvAutostart;
ConVar g_cvSiteStreak;
ConVar g_cvAwpSoloChance;
ConVar g_cvInstantDefuse;
ConVar g_cvC4Time;
ConVar g_cvTRatio;
ConVar g_cvMinPlayers;
ConVar g_cvMaxPerTeam;
ConVar g_cvKitPistol;
ConVar g_cvKitFullbuy;
ConVar g_cvPistolRounds;
ConVar g_cvTStreak;
ConVar g_cvMaxRounds;
ConVar g_cvVoteRound;
ConVar g_cvAfkRounds;
#if defined RETAKE_DEBUG
ConVar g_cvDebugBotAwp;
#endif

bool g_bActive;
bool g_bKeepOn;                 // el modo sigue en el mapa que ganó la votación
bool g_bRoundOn;                // la ronda en curso la preparó el plugin
bool g_bWaiting;                // faltan jugadores
bool g_bFreezing;               // todos congelados mientras se planta
bool g_bPistol;
int g_iRound;
int g_iSite;
int g_iBombPoint;
int g_iSiteStreak;
bool g_bDefuseWarned;
float g_fBombPlantedAt;
int g_iTStreak;
int g_iPlanter;
int g_iRoundSerial;
Handle g_hSiteText;
bool g_bGotAwp[MAXPLAYERS + 1];
int g_iDamage[MAXPLAYERS + 1];
int g_iDamageTo[MAXPLAYERS + 1][MAXPLAYERS + 1];
int g_iHitsTo[MAXPLAYERS + 1][MAXPLAYERS + 1];
bool g_bQueued[MAXPLAYERS + 1];     // espera para entrar
int g_iQueueOrder[MAXPLAYERS + 1];  // menor = primero en la cola
int g_iQueueFirst, g_iQueueLast;
#if defined RETAKE_DEBUG
bool g_bDebugVip[MAXPLAYERS + 1];
#endif
bool g_bPriority[MAXPLAYERS + 1];   // la ronda pasada se quedó sin spawn
bool g_bMoved[MAXPLAYERS + 1];
int g_iAfkRounds[MAXPLAYERS + 1];

static const char g_sManaged[][] = { "mp_c4timer", "mp_freezetime", "mp_roundtime", "mp_autoteambalance", "mp_limitteams", "mp_buytime", "mp_timelimit" };
char g_sManagedSaved[sizeof(g_sManaged)][32];

#include "retake/chat.inc"
#include "retake/spawns.inc"
#include "retake/guns.inc"
#include "retake/vote.inc"
#include "retake/rank.inc"

public void OnPluginStart()
{
	g_cvAutostart    = CreateConVar("sm_retake_autostart", "0", "Prender el modo solo en cada mapa, para un servidor que es solo de retake (0 = lo prende un admin con sm_retake 1).", _, true, 0.0, true, 1.0);
	g_cvSiteStreak   = CreateConVar("sm_retake_site_streak", "2", "Veces seguidas que puede salir el mismo sitio.", _, true, 1.0, true, 30.0);
	g_cvInstantDefuse = CreateConVar("sm_retake_instant_defuse", "1", "Sin T vivos, si el CT llega a desactivar con el tiempo que queda, se desactiva al instante.", _, true, 0.0, true, 1.0);
	g_cvAwpSoloChance = CreateConVar("sm_retake_awp_solo_chance", "30", "Probabilidad (%) de AWP cuando hay un solo anotado en el equipo. Con más de uno, se sortea y sale seguro.", _, true, 0.0, true, 100.0);
	g_cvC4Time       = CreateConVar("sm_retake_c4_time", "40", "Segundos de la bomba.", _, true, 10.0, true, 90.0);
	g_cvTRatio       = CreateConVar("sm_retake_t_ratio", "0.4", "Parte de los jugadores que juega de T.", _, true, 0.1, true, 0.9);
	g_cvMinPlayers   = CreateConVar("sm_retake_min_players", "2", "Jugadores mínimos para jugar.", _, true, 2.0, true, 32.0);
	g_cvMaxPerTeam   = CreateConVar("sm_retake_max_per_team", "5", "Jugadores máximos por equipo. Los que sobran esperan como espectadores y rotan.", _, true, 1.0, true, 16.0);
	g_cvKitPistol    = CreateConVar("sm_retake_kit_pistol", "50", "Probabilidad (%) de kit de cada CT en ronda de pistola.", _, true, 0.0, true, 100.0);
	g_cvKitFullbuy   = CreateConVar("sm_retake_kit_fullbuy", "85", "Probabilidad (%) de kit de cada CT en ronda de full buy.", _, true, 0.0, true, 100.0);
	g_cvPistolRounds = CreateConVar("sm_retake_pistol_rounds", "5", "Rondas de pistola al empezar.", _, true, 0.0, true, 30.0);
	g_cvTStreak      = CreateConVar("sm_retake_t_streak", "3", "Victorias seguidas de T que se toleran: con una más se mezclan los equipos.", _, true, 1.0, true, 30.0);
	g_cvMaxRounds    = CreateConVar("sm_retake_max_rounds", "30", "Rondas de la partida.", _, true, 2.0, true, 100.0);
	g_cvVoteRound    = CreateConVar("sm_retake_vote_round", "25", "Ronda en la que se abre la votación de mapa.", _, true, 1.0, true, 100.0);
	g_cvAfkRounds    = CreateConVar("sm_retake_afk_rounds", "2", "Rondas seguidas sin moverse para pasar a espectador (0 = nunca).", _, true, 0.0, true, 30.0);
	CreateConVar("v34_retake_version", PLUGIN_VERSION, "Versión de v34 Retake.", FCVAR_NOTIFY | FCVAR_DONTRECORD);

	g_hSiteText = CreateHudSynchronizer();
	CreateTimer(1.0, Timer_ZeroMoney, _, TIMER_REPEAT);
	RegAdminCmd("sm_retake", Cmd_Retake, ADMFLAG_GENERIC, "Prende o apaga el modo. Uso: sm_retake <1|0>");
	Spawns_Init();
	Guns_Init();
	Rank_Init();
	AutoExecConfig(true, "v34_retake");

	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	HookEvent("round_end", Event_RoundEnd);
	HookEvent("bomb_planted", Event_BombPlanted, EventHookMode_PostNoCopy);
	HookEvent("player_hurt", Event_PlayerHurt);
	HookEvent("bomb_begindefuse", Event_BeginDefuse, EventHookMode_PostNoCopy);
	HookEvent("player_death", Event_DefuseDeath, EventHookMode_PostNoCopy);
	HookEvent("player_team", Event_PlayerTeamPre, EventHookMode_Pre);

	static const char blockedBuy[][] = { "buy", "autobuy", "rebuy", "buyammo1", "buyammo2" };
	for (int i = 0; i < sizeof(blockedBuy); i++)
		AddCommandListener(Cmd_BlockBuy, blockedBuy[i]);
	AddCommandListener(Cmd_BlockDrop, "drop");
	AddCommandListener(Cmd_JoinTeam, "jointeam");
	HookUserMessage(GetUserMessageId("VGUIMenu"), Msg_VguiMenu, true);
	// Lo que en csstv_reporter empezaría un mix o cambiaría el mapa mientras se juega el retake.
	static const char blockedMix[][] = { "sm_ready", "sm_live", "sm_rtv", "sm_nominate" };
	for (int i = 0; i < sizeof(blockedMix); i++)
		AddCommandListener(Cmd_BlockMix, blockedMix[i]);

#if defined RETAKE_DEBUG
	g_cvDebugBotAwp = CreateConVar("retake_debug_bot_awp", "0", "Los bots se anotan para la AWP.");
	RegServerCmd("retake_debug_gen", Cmd_DebugGen);
	RegServerCmd("retake_debug_fake", Cmd_DebugFake);
	RegServerCmd("retake_debug_vip", Cmd_DebugVip);
	RegServerCmd("retake_debug_next", Cmd_DebugNext);
	RegServerCmd("retake_debug_step", Cmd_DebugStep);
	RegServerCmd("retake_debug_queue", Cmd_DebugQueue);
#endif
}

public void OnPluginEnd()
{
	Rank_OnPluginEnd();
	if (g_bActive)
		Mode_RestoreCvars();
}

public void OnMapStart()
{
	Spawns_OnMapStart();
}

public void OnConfigsExecuted()
{
	if (g_bKeepOn || g_cvAutostart.BoolValue)
		CreateTimer(KEEP_ON_DELAY, Timer_KeepOn, _, TIMER_FLAG_NO_MAPCHANGE);
}

public void OnMapEnd()
{
	if (g_bActive)
		Mode_Off();
}

public void OnClientPutInServer(int client)
{
	g_iDamage[client] = 0;
	g_bQueued[client] = false;
	g_bPriority[client] = false;
	g_iAfkRounds[client] = 0;
	g_bMoved[client] = false;
	Guns_Reset(client);
}

public void OnClientDisconnect(int client)
{
	Rank_OnClientDisconnect(client);
	g_bQueued[client] = false;
	if (g_bActive && g_bFreezing && client == g_iPlanter)
	{
		g_iPlanter = 0;
		CreateTimer(0.1, Timer_NewPlanter, _, TIMER_FLAG_NO_MAPCHANGE);
	}
}

// ---------------------------------------------------------------------------
// Prender y apagar
// ---------------------------------------------------------------------------

/**
 * Si csstv_reporter tiene una partida en curso. Se lee de sm_csstv_status para no depender de él.
 * Llamar desde un timer: dentro de otro comando ServerCommandEx devuelve vacío. Si no se puede leer
 * el estado se responde que sí, porque prender el modo cancelaría la partida.
 */
bool Mode_MixInProgress()
{
	if (!CommandExists("sm_csstv_status"))
		return false;
	char out[512];
	ServerCommandEx(out, sizeof(out), "sm_csstv_status");
	if (StrContains(out, "estado:") == -1)
	{
		LogError("No se pudo leer el estado de csstv_reporter: se asume que hay un mix.");
		return true;
	}
	return StrContains(out, "estado: calentamiento") == -1 && StrContains(out, "estado: terminada") == -1;
}

public Action Cmd_Retake(int client, int args)
{
	char arg[8];
	GetCmdArg(1, arg, sizeof(arg));
	if (args != 1 || (!StrEqual(arg, "1") && !StrEqual(arg, "0")))
	{
		ReplyToCommand(client, "[Retake] Uso: sm_retake <1|0>. Ahora está %s.", g_bActive ? "prendido" : "apagado");
		return Plugin_Handled;
	}
	if (StrEqual(arg, "0"))
	{
		g_bKeepOn = false;
		if (g_bActive)
		{
			Mode_Off();
			ServerCommand("mp_restartgame 1");
			ChatAll("%s Modo apagado.", RETAKE_PREFIX);
		}
		ReplyToCommand(client, "[Retake] Modo apagado.");
		return Plugin_Handled;
	}
	if (g_bActive)
	{
		ReplyToCommand(client, "[Retake] El modo ya está prendido.");
		return Plugin_Handled;
	}
	if (!Spawns_Ready())
	{
		ReplyToCommand(client, "[Retake] Este mapa no tiene los puntos cargados. Hacen falta los dos sitios con bomba y al menos un spawn de T y uno de CT (sm_retake_spawns).");
		return Plugin_Handled;
	}
	CreateTimer(0.1, Timer_TurnOn, client > 0 ? GetClientUserId(client) : 0, TIMER_FLAG_NO_MAPCHANGE);
	return Plugin_Handled;
}

public Action Timer_TurnOn(Handle timer, int userid)
{
	if (g_bActive)
		return Plugin_Stop;
	int client = GetClientOfUserId(userid);
	if (Mode_MixInProgress())
	{
		if (client > 0)
			Chat(client, "%s Hay un mix en curso: terminalo o cancelalo antes de prender el modo.", RETAKE_PREFIX);
		else
			PrintToServer("[Retake] Hay un mix en curso: terminalo o cancelalo antes de prender el modo.");
		return Plugin_Stop;
	}
	Mode_On();
	return Plugin_Stop;
}

void Mode_On()
{
	for (int i = 0; i < sizeof(g_sManaged); i++)
	{
		ConVar cv = FindConVar(g_sManaged[i]);
		if (cv != null)
			cv.GetString(g_sManagedSaved[i], sizeof(g_sManagedSaved[]));
	}
	Mode_SetCvar("mp_c4timer", g_cvC4Time.IntValue);
	Mode_SetCvar("mp_freezetime", 0);    // el freeze lo hace el plugin mientras se planta
	Mode_SetCvar("mp_autoteambalance", 0);
	Mode_SetCvar("mp_limitteams", 0);
	Mode_SetCvar("mp_buytime", 0);
	Mode_SetCvar("mp_timelimit", 0);     // el mapa lo cambia la votación al terminar la partida
	FindConVar("mp_roundtime").SetString(ROUND_TIME);
	g_bActive = true;
	g_bKeepOn = false;
	Mode_ResetMatch();
	Teams_Arrange(Arrange_Keep);
	ChatAll("%s Modo retake prendido. Escribí !guns para elegir tus armas.", RETAKE_PREFIX);
	ServerCommand("mp_restartgame 1");
}

void Mode_SetCvar(const char[] name, int value)
{
	ConVar cv = FindConVar(name);
	if (cv != null)
		cv.SetInt(value);
}

void Mode_RestoreCvars()
{
	for (int i = 0; i < sizeof(g_sManaged); i++)
	{
		ConVar cv = FindConVar(g_sManaged[i]);
		if (cv != null)
			cv.SetString(g_sManagedSaved[i]);
	}
}

void Mode_Off()
{
	Round_Unfreeze();
	g_bActive = false;
	g_bRoundOn = false;
	g_bWaiting = false;
	g_iPlanter = 0;
	Mode_RestoreCvars();
	for (int i = 1; i <= MaxClients; i++)
		g_bQueued[i] = g_bPriority[i] = false;
}

void Mode_ResetMatch()
{
	g_iRound = 0;
	g_iTStreak = 0;
	g_bRoundOn = false;
	g_bWaiting = false;
	Vote_Reset();
}

public Action Timer_KeepOn(Handle timer)
{
	if (g_bActive || (!g_bKeepOn && !g_cvAutostart.BoolValue))
		return Plugin_Stop;
	g_bKeepOn = false;
	if (Mode_MixInProgress())
		LogMessage("Hay un mix en curso: el modo no se prende solo.");
	else if (Spawns_Ready())
		Mode_On();
	else
		LogError("Este mapa no tiene los puntos completos: el modo queda apagado.");
	return Plugin_Stop;
}

/** Durante el modo no se abre el menú de modelos: el plugin elige uno al pasar al jugador a un equipo. */
public Action Msg_VguiMenu(UserMsg msgId, BfRead msg, const int[] players, int playersNum, bool reliable, bool init)
{
	if (!g_bActive)
		return Plugin_Continue;
	char panel[32];
	msg.ReadString(panel, sizeof(panel));
	return StrContains(panel, "class_") == 0 ? Plugin_Handled : Plugin_Continue;
}

// ---------------------------------------------------------------------------
// Comandos que se bloquean durante el modo
// ---------------------------------------------------------------------------

public Action Cmd_BlockBuy(int client, const char[] command, int argc)
{
	return g_bActive ? Plugin_Stop : Plugin_Continue;
}

/** Mientras se planta nadie suelta nada: sin C4 no habría bomba y la ronda terminaría en empate. */
public Action Cmd_BlockDrop(int client, const char[] command, int argc)
{
	return g_bActive && g_bFreezing ? Plugin_Stop : Plugin_Continue;
}

public Action Cmd_BlockMix(int client, const char[] command, int argc)
{
	if (!g_bActive)
		return Plugin_Continue;
	ReplyToCommand(client, "[Retake] No disponible durante el retake. El mapa se vota en la ronda %d.", g_cvVoteRound.IntValue);
	return Plugin_Stop;
}

/** Los equipos los arma el modo. Se puede ir a espectador; el resto espera a la ronda siguiente. */
public Action Cmd_JoinTeam(int client, const char[] command, int argc)
{
	if (!g_bActive || client <= 0 || !IsClientInGame(client) || IsFakeClient(client))
		return Plugin_Continue;
	char arg[8];
	GetCmdArg(1, arg, sizeof(arg));
	if (StringToInt(arg) == TEAM_SPEC)
	{
		g_bQueued[client] = false;
		return Plugin_Continue;
	}
	int team = GetClientTeam(client);
	if (team == TEAM_T || team == TEAM_CT)
	{
		Chat(client, "%s Los equipos los arma el modo.", RETAKE_PREFIX);
		return Plugin_Stop;
	}
	if (!g_bQueued[client])
		Teams_Enqueue(client, false);
	g_iAfkRounds[client] = 0;
	if (team != TEAM_SPEC)
		ChangeClientTeam(client, TEAM_SPEC);
	Chat(client, "%s Entrás cuando termine la ronda, si hay lugar.", RETAKE_PREFIX);
	Guns_ShowFirstTime(client);
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Equipos
// ---------------------------------------------------------------------------

bool Teams_Plays(int client)
{
	if (!IsClientInGame(client) || IsClientSourceTV(client))
		return false;
	int team = GetClientTeam(client);
	return team == TEAM_T || team == TEAM_CT || g_bQueued[client];
}

int Teams_CountPlayers()
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (Teams_Plays(i))
			n++;
	return n;
}

void Teams_Shuffle(int[] list, int from, int to)
{
	for (int i = to - 1; i > from; i--)
	{
		int j = GetRandomInt(from, i);
		int tmp = list[i]; list[i] = list[j]; list[j] = tmp;
	}
}

void Teams_Move(int client, int team)
{
	bool fromSpec = GetClientTeam(client) < TEAM_T;
	g_bQueued[client] = false;
	if (fromSpec)
	{
		ChangeClientTeam(client, team);
		// joinclass en un bot tira el servidor en v34: solo los jugadores reales eligen modelo.
		if (!IsFakeClient(client))
			FakeClientCommandEx(client, "joinclass %d", team == TEAM_T ? GetRandomInt(1, 4) : GetRandomInt(5, 8));
	}
	else if (GetClientTeam(client) != team)
		CS_SwitchTeam(client, team);
}

bool Teams_IsVip(int client)
{
#if defined RETAKE_DEBUG
	if (g_bDebugVip[client])
		return true;
#endif
	return CheckCommandAccess(client, "retake_vip", ADMFLAG_CUSTOM1, true);
}

/** Entra a la cola. front: al principio, para quien perdió su lugar por un VIP. */
void Teams_Enqueue(int client, bool front)
{
	g_bQueued[client] = true;
	g_iQueueOrder[client] = front ? --g_iQueueFirst : ++g_iQueueLast;
}

int Teams_RemoveFrom(int[] order, int n, int client)
{
	for (int i = 0; i < n; i++)
	{
		if (order[i] == client)
		{
			order[i] = order[n - 1];
			return n - 1;
		}
	}
	return n;
}

void Teams_Bench(int client, bool front)
{
	if (GetClientTeam(client) != TEAM_SPEC)
		ChangeClientTeam(client, TEAM_SPEC);
	if (!g_bQueued[client] || front)
		Teams_Enqueue(client, front);
}

/** Un jugador que está jugando y no es VIP, al azar. 0 si no hay. */
int Teams_PickVictim(const int[] order, int n)
{
	int[] pool = new int[n];
	int count;
	for (int i = 0; i < n; i++)
		if (!g_bQueued[order[i]] && !Teams_IsVip(order[i]))
			pool[count++] = order[i];
	return count > 0 ? pool[GetRandomInt(0, count - 1)] : 0;
}

/**
 * Aplica el tope por equipo. No hay rotación: quien está jugando se queda y los que sobran esperan
 * en orden de llegada hasta que se libere un lugar. Un VIP no espera: entra y saca a un jugador no
 * VIP al azar, que pasa primero en la cola. Devuelve cuántos juegan.
 */
int Teams_BenchExtras(int[] order, int n)
{
	int capacity = 2 * g_cvMaxPerTeam.IntValue;
	int waiters[MAXPLAYERS], nWaiters, playing;
	for (int i = 0; i < n; i++)
	{
		if (g_bQueued[order[i]])
			waiters[nWaiters++] = order[i];
		else
			playing++;
	}
	while (playing > capacity)   // por ejemplo, si un admin bajó el tope
	{
		int victim = Teams_PickVictim(order, n);
		if (victim == 0)
			break;
		Teams_Bench(victim, true);
		n = Teams_RemoveFrom(order, n, victim);
		playing--;
	}
	for (int i = 1; i < nWaiters; i++)   // VIP primero y después por orden de llegada
	{
		int cur = waiters[i], j = i - 1;
		while (j >= 0 && Teams_QueueBefore(cur, waiters[j]))
		{
			waiters[j + 1] = waiters[j];
			j--;
		}
		waiters[j + 1] = cur;
	}
	for (int i = 0; i < nWaiters; i++)
	{
		int client = waiters[i];
		if (playing < capacity)
		{
			playing++;
			continue;
		}
		int victim = Teams_IsVip(client) ? Teams_PickVictim(order, n) : 0;
		if (victim != 0)
		{
			Teams_Bench(victim, true);
			n = Teams_RemoveFrom(order, n, victim);
			Chat(victim, "%s Un VIP tomó tu lugar: sos el primero en la cola.", RETAKE_PREFIX);
			Chat(client, "%s Entrás directo por ser VIP.", RETAKE_PREFIX);
#if defined RETAKE_DEBUG
			LogMessage("RETAKE_DBG vip entra=%d sale=%d", client, victim);
#endif
			continue;
		}
		n = Teams_RemoveFrom(order, n, client);
		Chat(client, "%s Los equipos están llenos: esperás a que se libere un lugar.", RETAKE_PREFIX);
#if defined RETAKE_DEBUG
		LogMessage("RETAKE_DBG espera jugador=%d orden=%d", client, g_iQueueOrder[client]);
#endif
	}
	return n;
}

bool Teams_QueueBefore(int a, int b)
{
	bool vipA = Teams_IsVip(a), vipB = Teams_IsVip(b);
	if (vipA != vipB)
		return vipA;
	return g_iQueueOrder[a] < g_iQueueOrder[b];
}

/**
 * Pone a los jugadores en orden de prioridad para ser T y toma los primeros según la proporción.
 * Así la misma cuenta sirve para rotar, mezclar y completar cuando alguien se fue o entró.
 */
void Teams_Arrange(ArrangeMode mode)
{
	int order[MAXPLAYERS], n;
	for (int i = 1; i <= MaxClients; i++)
		if (Teams_Plays(i))
			order[n++] = i;
	if (n < 2)
		return;
	n = Teams_BenchExtras(order, n);
	int target = RoundToNearest(n * g_cvTRatio.FloatValue);
	if (target < 1)
		target = 1;
	if (target > n - 1)
		target = n - 1;
	// El tope manda sobre la proporción: con 10 jugadores son 5 y 5, no 4 y 6.
	int maxTeam = g_cvMaxPerTeam.IntValue;
	if (n - target > maxTeam)
		target = n - maxTeam;
	if (target > maxTeam)
		target = maxTeam;

	Teams_Shuffle(order, 0, n);
	if (mode == Arrange_Shuffle)
	{
		// Al azar pueden quedar los mismos T (con 2 jugadores, la mitad de las veces): se repite hasta que cambie alguno.
		for (int tries = 0; tries < SHUFFLE_TRIES && Teams_SameTs(order, target); tries++)
			Teams_Shuffle(order, 0, n);
	}
	else
	{
		int first = mode == Arrange_CtWin ? TEAM_CT : TEAM_T;
		int head;
		for (int i = 0; i < n; i++)
		{
			if (GetClientTeam(order[i]) == first)
			{
				int tmp = order[head]; order[head] = order[i]; order[i] = tmp;
				head++;
			}
		}
		if (mode == Arrange_CtWin)
		{
			for (int i = 1; i < head; i++)   // inserción: más daño primero, los empates quedan al azar
			{
				int cur = order[i], j = i - 1;
				while (j >= 0 && g_iDamage[order[j]] < g_iDamage[cur])
				{
					order[j + 1] = order[j];
					j--;
				}
				order[j + 1] = cur;
			}
		}
	}
	int moved;
	for (int i = 0; i < n; i++)
	{
		int team = i < target ? TEAM_T : TEAM_CT;
		if (GetClientTeam(order[i]) != team)
			moved++;
		Teams_Move(order[i], team);
	}
	static const char modeNames[][] = { "completar", "rotacion por daño", "mezcla" };
	LogMessage("Equipos (%s) tras la ronda %d: %d jugadores, %d T, %d cambiaron de equipo.", modeNames[view_as<int>(mode)], g_iRound, n, target, moved);
}

/** Si los primeros `target` de la lista ya son exactamente los T de ahora. */
bool Teams_SameTs(const int[] order, int target)
{
	for (int i = 0; i < target; i++)
		if (GetClientTeam(order[i]) != TEAM_T)
			return false;
	return true;
}

// ---------------------------------------------------------------------------
// Ronda
// ---------------------------------------------------------------------------

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return;
	g_iRoundSerial++;
	g_bRoundOn = false;
	CreateTimer(PREPARE_DELAY, Timer_Prepare, g_iRoundSerial, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_Prepare(Handle timer, int serial)
{
	if (g_bActive && serial == g_iRoundSerial)
		Round_Prepare();
	return Plugin_Stop;
}

void Round_StripPlayer(int client)
{
	for (int slot = 0; slot <= CS_SLOT_C4; slot++)
	{
		int weapon;
		while ((weapon = GetPlayerWeaponSlot(client, slot)) != -1)
		{
			RemovePlayerItem(client, weapon);
			AcceptEntityInput(weapon, "Kill");
		}
	}
}

void Round_ClearFloor()
{
	char cls[32];
	int maxEnts = GetMaxEntities();
	for (int ent = MaxClients + 1; ent < maxEnts; ent++)
	{
		if (!IsValidEdict(ent) || !GetEdictClassname(ent, cls, sizeof(cls)))
			continue;
		if (StrContains(cls, "weapon_") == 0 && GetEntPropEnt(ent, Prop_Send, "m_hOwnerEntity") == -1)
			AcceptEntityInput(ent, "Kill");
	}
}

void Round_Teleport(int client, const float p[4])
{
	float pos[3], ang[3], stop[3];
	pos[0] = p[0]; pos[1] = p[1]; pos[2] = p[2];
	ang[1] = p[3];
	TeleportEntity(client, pos, ang, stop);
}

void Round_Freeze(int client, bool frozen)
{
	SetEntPropFloat(client, Prop_Data, "m_flLaggedMovementValue", frozen ? 0.0 : 1.0);
}

void Round_Unfreeze()
{
	g_bFreezing = false;
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && IsPlayerAlive(i))
			Round_Freeze(i, false);
}

/** Da un spawn distinto a cada jugador. Quien queda sin punto mira esta ronda y juega la siguiente. */
void Round_PlaceSide(int site, int side, int[] list, int count)
{
	ArrayList points = g_aPoints[site][side].Clone();
	for (int i = points.Length - 1; i > 0; i--)
		points.SwapAt(i, GetRandomInt(0, i));
	int next;
	for (int pass = 0; pass < 2; pass++)   // primero los que la ronda pasada no tuvieron lugar
	{
		for (int i = 0; i < count; i++)
		{
			int client = list[i];
			if (g_bPriority[client] != (pass == 0))
				continue;
			if (client == g_iPlanter)
				continue;
			if (next >= points.Length)
			{
				g_bPriority[client] = true;
				Teams_Enqueue(client, true);
				ChangeClientTeam(client, TEAM_SPEC);
				Chat(client, "%s No hay lugar para vos esta ronda: entrás en la siguiente.", RETAKE_PREFIX);
				LogMessage("Sitio %s sin spawns suficientes de %s en %s: %N queda afuera esta ronda.", site == SITE_A ? "A" : "B", side == SIDE_T ? "T" : "CT", "este mapa", client);
				Round_WarnAdmins(site, side);
				continue;
			}
			float p[4];
			points.GetArray(next++, p);
			g_bPriority[client] = false;
			Round_Teleport(client, p);
			Round_Freeze(client, true);
#if defined RETAKE_DEBUG
			LogMessage("RETAKE_DBG punto ronda=%d lado=%d indice=%d jugador=%d", g_iRound, side, next - 1, client);
#endif
		}
	}
	delete points;
}

void Round_WarnAdmins(int site, int side)
{
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && !IsFakeClient(i) && CheckCommandAccess(i, "sm_retake", ADMFLAG_GENERIC))
			Chat(i, "%s Faltan spawns de %s en el sitio %s para todos los jugadores.", RETAKE_PREFIX, side == SIDE_T ? "T" : "CT", site == SITE_A ? "A" : "B");
}

void Round_Equip(int client, int side)
{
	GivePlayerItem(client, "weapon_knife");
	SetEntProp(client, Prop_Send, "m_iAccount", 0);
	SetEntProp(client, Prop_Send, "m_ArmorValue", 100);
	SetEntProp(client, Prop_Send, "m_bHasHelmet", g_bPistol ? 0 : 1);
	if (!g_bPistol)
	{
		GivePlayerItem(client, "weapon_flashbang");
		GivePlayerItem(client, "weapon_smokegrenade");
	}
	Guns_GivePistol(client, side);
	if (side == SIDE_CT)
	{
		int chance = g_bPistol ? g_cvKitPistol.IntValue : g_cvKitFullbuy.IntValue;
		SetEntProp(client, Prop_Send, "m_bHasDefuser", GetRandomInt(1, 100) <= chance ? 1 : 0);
	}
}

/** Sortea la AWP entre los anotados del lado. Devuelve el ganador o 0. */
int Round_DrawAwp(int[] list, int count)
{
	int[] pool = new int[count];
	int n;
	for (int i = 0; i < count; i++)
	{
#if defined RETAKE_DEBUG
		if (g_bWantsAwp[list[i]] || (IsFakeClient(list[i]) && g_cvDebugBotAwp.BoolValue))
#else
		if (g_bWantsAwp[list[i]])
#endif
			pool[n++] = list[i];
	}
	if (n == 0)
		return 0;
	// Con varios anotados la AWP sale seguro para uno; si hay uno solo, no la tiene siempre.
	if (n == 1)
		return GetRandomInt(1, 100) <= g_cvAwpSoloChance.IntValue ? pool[0] : 0;
	return pool[GetRandomInt(0, n - 1)];
}

void Round_GivePrimaries(int[] list, int count, int side)
{
	int awp = Round_DrawAwp(list, count);
	for (int i = 0; i < count; i++)
	{
		g_bGotAwp[list[i]] = list[i] == awp;
		if (list[i] == awp)
			GivePlayerItem(list[i], "weapon_awp");
		else
			Guns_GivePrimary(list[i], side);
	}
#if defined RETAKE_DEBUG
	LogMessage("RETAKE_DBG awp ronda=%d lado=%d ganador=%d", g_iRound, side, awp);
#endif
}

bool Round_SetPlanter(int client)
{
	float p[4];
	g_aBombs[g_iSite].GetArray(g_iBombPoint, p);
	g_iPlanter = client;
	Round_Teleport(client, p);
	Round_Freeze(client, false);   // con el movimiento en 0 el armado no avanza; OnPlayerRunCmd ya lo deja quieto
	int c4 = GetPlayerWeaponSlot(client, CS_SLOT_C4);
	if (c4 == -1)
		c4 = GivePlayerItem(client, "weapon_c4");
	return c4 != -1;
}

/** Sitio al azar, salvo que el último ya haya salido el máximo de veces seguidas: ahí toca el otro. */
void Round_PickSite()
{
	int site = GetRandomInt(SITE_A, SITE_B);
	if (g_iSiteStreak >= g_cvSiteStreak.IntValue && site == g_iSite)
		site = site == SITE_A ? SITE_B : SITE_A;
	g_iSiteStreak = site == g_iSite ? g_iSiteStreak + 1 : 1;
	g_iSite = site;
}

void Round_Prepare()
{
	int minPlayers = g_cvMinPlayers.IntValue;
	if (Teams_CountPlayers() < minPlayers)
	{
		if (!g_bWaiting)
		{
			g_bWaiting = true;
			ChatAll("%s Faltan jugadores: hacen falta %d.", RETAKE_PREFIX, minPlayers);
			CreateTimer(WAIT_CHECK, Timer_WaitPlayers, _, TIMER_FLAG_NO_MAPCHANGE | TIMER_REPEAT);
		}
		return;
	}

	int ts[MAXPLAYERS], cts[MAXPLAYERS], nT, nCt;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsClientSourceTV(i))
			continue;
		int team = GetClientTeam(i);
		if (team == TEAM_T)
			ts[nT++] = i;
		else if (team == TEAM_CT)
			cts[nCt++] = i;
	}
	if (nT == 0 || nCt == 0)
	{
		Teams_Arrange(Arrange_Keep);
		ServerCommand("mp_restartgame 1");
		return;
	}

	g_iRound++;
	g_bRoundOn = true;
	Round_PickSite();
	g_iBombPoint = GetRandomInt(0, g_aBombs[g_iSite].Length - 1);
	g_bPistol = g_iRound <= g_cvPistolRounds.IntValue;
	g_bFreezing = true;
	g_bDefuseWarned = false;
	Round_ClearFloor();

	for (int i = 1; i <= MaxClients; i++)
	{
		g_iDamage[i] = 0;
		g_bMoved[i] = false;
		for (int j = 1; j <= MaxClients; j++)
		{
			g_iDamageTo[i][j] = 0;
			g_iHitsTo[i][j] = 0;
		}
	}
	for (int side = 0; side < 2; side++)
	{
		int count = side == SIDE_T ? nT : nCt;
		for (int i = 0; i < count; i++)
		{
			int client = side == SIDE_T ? ts[i] : cts[i];
			if (!IsPlayerAlive(client))
				CS_RespawnPlayer(client);
			Round_StripPlayer(client);
			Round_Equip(client, side);
			Guns_ShowFirstTime(client);
		}
	}
	if (!g_bPistol)
	{
		Round_GivePrimaries(ts, nT, SIDE_T);
		Round_GivePrimaries(cts, nCt, SIDE_CT);
	}

	Round_SetPlanter(ts[GetRandomInt(0, nT - 1)]);
	Round_PlaceSide(g_iSite, SIDE_T, ts, nT);
	Round_PlaceSide(g_iSite, SIDE_CT, cts, nCt);
	CreateTimer(PLANT_TIMEOUT, Timer_PlantCheck, g_iRoundSerial, TIMER_FLAG_NO_MAPCHANGE);

	char site[2], kind[16];
	strcopy(site, sizeof(site), g_iSite == SITE_A ? "A" : "B");
	strcopy(kind, sizeof(kind), g_bPistol ? "pistola" : "full buy");
	ChatAll("%s {#blanco}Sitio {#amarillo}%s{#blanco}, {#verde}%s{#blanco}, ronda {#amarillo}%d", RETAKE_PREFIX, site, kind, g_iRound);
	Round_Banner(site, kind);
#if defined RETAKE_DEBUG
	Round_DebugLog();
#endif
	if (g_iRound >= g_cvVoteRound.IntValue)
		Vote_Start();
}

/** Cuadro de aviso del juego (el texto del HUD no tiene fondo): sitio, tipo, ronda y armas del jugador. */
void Round_Banner(const char[] site, const char[] kind)
{
	char upper[16], weapons[64];
	strcopy(upper, sizeof(upper), kind);
	for (int c = 0; upper[c]; c++)
		upper[c] = CharToUpper(upper[c]);
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsFakeClient(i))
			continue;
		// El cuadro no admite color: el sitio va además bien visible arriba de la mira, A y B de distinto color.
		if (g_iSite == SITE_A)
			SetHudTextParams(-1.0, SITE_TEXT_Y, SITE_TEXT_TIME, 255, 90, 40, 255, 0, 0.0, 0.1, 0.5);
		else
			SetHudTextParams(-1.0, SITE_TEXT_Y, SITE_TEXT_TIME, 60, 170, 255, 255, 0, 0.0, 0.1, 0.5);
		ShowSyncHudText(i, g_hSiteText, ">>>  SITIO %s  <<<", site);
		int team = GetClientTeam(i);
		if (team < TEAM_T)
		{
			PrintHintText(i, "SITIO %s | %s | RONDA %d", site, upper, g_iRound);
			continue;
		}
		Guns_Describe(i, team == TEAM_T ? SIDE_T : SIDE_CT, g_bPistol, g_bGotAwp[i], weapons, sizeof(weapons));
		PrintHintText(i, "SITIO %s | %s | RONDA %d\n%s", site, upper, g_iRound, weapons);
	}
}

public Action Timer_WaitPlayers(Handle timer)
{
	if (!g_bActive || !g_bWaiting)
		return Plugin_Stop;
	if (Teams_CountPlayers() < g_cvMinPlayers.IntValue)
		return Plugin_Continue;
	g_bWaiting = false;
	Teams_Arrange(Arrange_Keep);
	ServerCommand("mp_restartgame 1");
	return Plugin_Stop;
}

public Action Timer_NewPlanter(Handle timer)
{
	if (!g_bActive || !g_bFreezing)
		return Plugin_Stop;
	int ts[MAXPLAYERS], n;
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && GetClientTeam(i) == TEAM_T && IsPlayerAlive(i))
			ts[n++] = i;
	if (n > 0)
		Round_SetPlanter(ts[GetRandomInt(0, n - 1)]);
	return Plugin_Stop;
}

/** Si por algo la bomba no se plantó, la ronda no puede quedar colgada. */
public Action Timer_PlantCheck(Handle timer, int serial)
{
	if (g_bActive && serial == g_iRoundSerial && g_bFreezing)
	{
#if defined RETAKE_DEBUG
		if (g_iPlanter > 0 && IsClientInGame(g_iPlanter))
			LogMessage("RETAKE_DBG noplanto zona=%d suelo=%d activa=%d c4=%d", GetEntProp(g_iPlanter, Prop_Send, "m_bInBombZone"), (GetEntityFlags(g_iPlanter) & FL_ONGROUND) != 0, GetEntPropEnt(g_iPlanter, Prop_Send, "m_hActiveWeapon"), GetPlayerWeaponSlot(g_iPlanter, CS_SLOT_C4));
#endif
		LogError("La bomba no se plantó en el sitio %s (ronda %d): se termina la ronda. Revisá el punto de la bomba.", g_iSite == SITE_A ? "A" : "B", g_iRound);
		Round_Unfreeze();
		g_iPlanter = 0;
		CS_TerminateRound(3.0, CSRoundEnd_Draw);
	}
	return Plugin_Stop;
}

public void Event_BombPlanted(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return;
	g_iPlanter = 0;
	g_fBombPlantedAt = GetGameTime();
	Round_Unfreeze();
}

// ---------------------------------------------------------------------------
// Desactivación al instante
// ---------------------------------------------------------------------------

public void Event_BeginDefuse(Event event, const char[] name, bool dontBroadcast)
{
	if (g_bActive)
		RequestFrame(Frame_CheckDefuse);   // el juego termina de preparar el desactivado después del evento
}

/** Si muere el último T con un CT ya desactivando, también vale. */
public void Event_DefuseDeath(Event event, const char[] name, bool dontBroadcast)
{
	if (g_bActive)
		RequestFrame(Frame_CheckDefuse);
}

bool Round_AnyTAlive()
{
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && GetClientTeam(i) == TEAM_T && IsPlayerAlive(i))
			return true;
	return false;
}

public void Frame_CheckDefuse(any data)
{
	if (!g_bActive || !g_bRoundOn || !g_cvInstantDefuse.BoolValue || Round_AnyTAlive())
		return;
	int c4 = FindEntityByClassname(-1, "planted_c4");
	if (c4 == -1)
		return;
	// En v34 la bomba no expone quién la desactiva: se mira en los jugadores.
	int defuser;
	for (int i = 1; i <= MaxClients && defuser == 0; i++)
		if (IsClientInGame(i) && IsPlayerAlive(i) && GetEntProp(i, Prop_Send, "m_bIsDefusing"))
			defuser = i;
	if (defuser == 0)
		return;
	float now = GetGameTime();
	// m_flC4Blow no sirve en v34 (no cambia): se calcula desde el momento en que se plantó.
	float left = g_fBombPlantedAt + FindConVar("mp_c4timer").FloatValue - now;
	bool kit = GetEntProp(defuser, Prop_Send, "m_bHasDefuser") != 0;
	float needed = kit ? DEFUSE_TIME_KIT : DEFUSE_TIME_NO_KIT;
	if (left < needed)
	{
		if (!g_bDefuseWarned)
			ChatAll("%s {#rojo}%N no llega a desactivar{#blanco}: faltan %.1f s para la explosión y necesita %.0f s.", RETAKE_PREFIX, defuser, left, needed);
		g_bDefuseWarned = true;
#if defined RETAKE_DEBUG
		LogMessage("RETAKE_DBG nollega ronda=%d restante=%.1f necesario=%.0f kit=%d", g_iRound, left, needed, kit);
#endif
		return;
	}
	// m_flDefuseCountDown tampoco hace nada en v34: se saca la bomba y se termina la ronda como desactivada.
	SetEntProp(defuser, Prop_Send, "m_bIsDefusing", 0);
	SetEntProp(defuser, Prop_Send, "m_iProgressBarDuration", 0);   // si no, la barra de desactivar queda en pantalla
	AcceptEntityInput(c4, "Kill");
	Event defused = CreateEvent("bomb_defused");
	if (defused != null)
	{
		defused.SetInt("userid", GetClientUserId(defuser));
		defused.Fire();
	}
	CS_TerminateRound(ROUND_END_DELAY, CSRoundEnd_BombDefused);
	ChatAll("%s {#verde}%N desactivó al instante{#blanco}: no quedaban T, faltaban %.1f s y necesitaba %.0f s.", RETAKE_PREFIX, defuser, left, needed);
#if defined RETAKE_DEBUG
	LogMessage("RETAKE_DBG instantaneo ronda=%d restante=%.1f necesario=%.0f kit=%d", g_iRound, left, needed, kit);
#endif
}

public void Event_PlayerHurt(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return;
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	int victim = GetClientOfUserId(event.GetInt("userid"));
	if (attacker <= 0 || attacker == victim)
		return;
	int damage = event.GetInt("dmg_health");
	g_iDamage[attacker] += damage;
	if (victim > 0)
	{
		g_iDamageTo[attacker][victim] += damage;
		g_iHitsTo[attacker][victim]++;
	}
}

/** Con el modo prendido los equipos cambian seguido: no se avisa cada cambio en el chat. */
public Action Event_PlayerTeamPre(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return Plugin_Continue;
	event.BroadcastDisabled = true;
	return Plugin_Changed;
}

/** En el retake no se compra: la plata que dan las bajas y las rondas no se muestra. */
public Action Timer_ZeroMoney(Handle timer)
{
	if (!g_bActive)
		return Plugin_Continue;
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && GetClientTeam(i) >= TEAM_T)
			SetEntProp(i, Prop_Send, "m_iAccount", 0);
	return Plugin_Continue;
}

/** Resumen de la ronda: una línea por cada rival con el que se cruzaron daño, con daño e impactos. */
void Round_DamageReport()
{
	for (int client = 1; client <= MaxClients; client++)
	{
		if (!IsClientInGame(client) || IsFakeClient(client) || GetClientTeam(client) < TEAM_T)
			continue;
		bool header;
		for (int other = 1; other <= MaxClients; other++)
		{
			if (other == client || !IsClientInGame(other))
				continue;
			int given = g_iDamageTo[client][other], taken = g_iDamageTo[other][client];
			int hitsGiven = g_iHitsTo[client][other], hitsTaken = g_iHitsTo[other][client];
			if (hitsGiven == 0 && hitsTaken == 0)
				continue;
			if (!header)
			{
				Chat(client, "{#verde}------ CMLeague ------");
				header = true;
			}
			Chat(client, "{#verde}Dado: {#blanco}%d (%d) | {#rojo}Recibido: {#blanco}%d (%d) - %N %s",
				given, hitsGiven, taken, hitsTaken, other, IsPlayerAlive(other) ? "{#verde}[VIVO]" : "{#rojo}[MUERTO]");
		}
	}
}

public void Event_RoundEnd(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive || !g_bRoundOn)
		return;
	g_bRoundOn = false;
	Round_Unfreeze();
	g_iPlanter = 0;
	int winner = event.GetInt("winner");
	Round_DamageReport();
	Rank_SaveAll();
	Round_CheckAfk();
#if defined RETAKE_DEBUG
	LogMessage("RETAKE_DBG fin ronda=%d ganador=%d razon=%d", g_iRound, winner, event.GetInt("reason"));
#endif

	if (g_iRound >= g_cvMaxRounds.IntValue)
	{
		ChatAll("%s Fin de la partida: %d rondas.", RETAKE_PREFIX, g_iRound);
		CreateTimer(MAP_END_DELAY, Timer_MatchEnd, _, TIMER_FLAG_NO_MAPCHANGE);
		return;
	}

	ArrangeMode mode = Arrange_Keep;
	if (winner == TEAM_CT)
	{
		g_iTStreak = 0;
		mode = Arrange_CtWin;
		ChatAll("%s Ganaron los CT: {#amarillo}rotan los equipos{#blanco}. Los CT con más daño pasan a T.", RETAKE_PREFIX);
	}
	else if (winner == TEAM_T && ++g_iTStreak > g_cvTStreak.IntValue)
	{
		g_iTStreak = 0;
		mode = Arrange_Shuffle;
#if defined RETAKE_DEBUG
		LogMessage("RETAKE_DBG mezcla ronda=%d", g_iRound);
#endif
		ChatAll("%s Los T ganaron %d rondas seguidas: se mezclan los equipos.", RETAKE_PREFIX, g_cvTStreak.IntValue + 1);
	}
	CreateTimer(ARRANGE_DELAY, Timer_Arrange, mode, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_Arrange(Handle timer, ArrangeMode mode)
{
	if (g_bActive)
		Teams_Arrange(mode);
	return Plugin_Stop;
}

void Round_CheckAfk()
{
	int limit = g_cvAfkRounds.IntValue;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsFakeClient(i) || GetClientTeam(i) < TEAM_T)
			continue;
		if (g_bMoved[i])
		{
			g_iAfkRounds[i] = 0;
			continue;
		}
		if (limit > 0 && ++g_iAfkRounds[i] >= limit)
		{
			g_iAfkRounds[i] = 0;
			ChangeClientTeam(i, TEAM_SPEC);
			Chat(i, "%s Pasaste a espectador por no moverte. Elegí un equipo para volver.", RETAKE_PREFIX);
		}
	}
}

public Action Timer_MatchEnd(Handle timer)
{
	if (!g_bActive)
		return Plugin_Stop;
	if (g_sNextMap[0])
	{
		g_bKeepOn = true;
		ForceChangeLevel(g_sNextMap, "v34 Retake: votación de mapa");
		return Plugin_Stop;
	}
	Mode_ResetMatch();
	Teams_Arrange(Arrange_Shuffle);
	ChatAll("%s Empieza una partida nueva en este mapa.", RETAKE_PREFIX);
	ServerCommand("mp_restartgame 1");
	return Plugin_Stop;
}

public Action OnPlayerRunCmd(int client, int &buttons, int &impulse, float vel[3], float angles[3], int &weapon)
{
	if (!g_bActive)
		return Plugin_Continue;
	if (!g_bFreezing)
	{
		if (!g_bMoved[client] && (buttons & (IN_FORWARD | IN_BACK | IN_MOVELEFT | IN_MOVERIGHT | IN_ATTACK | IN_JUMP | IN_DUCK)))
			g_bMoved[client] = true;
		return Plugin_Continue;
	}
	if (client != g_iPlanter)
	{
		buttons &= ~(IN_ATTACK | IN_ATTACK2 | IN_JUMP | IN_USE);
		return Plugin_Changed;
	}
	if (!IsPlayerAlive(client))
		return Plugin_Continue;
	// El que planta no puede hacer otra cosa: ni moverse ni cambiar de arma, hasta que la bomba quede plantada.
	vel[0] = vel[1] = vel[2] = 0.0;
	buttons = 0;
	impulse = 0;
	weapon = 0;
	int c4 = GetPlayerWeaponSlot(client, CS_SLOT_C4);
	if (c4 == -1)   // la soltó por otra vía (por ejemplo, otro plugin): se le da de nuevo
		c4 = GivePlayerItem(client, "weapon_c4");
	if (c4 != -1)
	{
		if (GetEntPropEnt(client, Prop_Send, "m_hActiveWeapon") != c4)
			weapon = c4;
		else
			buttons = IN_ATTACK;
	}
	return Plugin_Changed;
}

#if defined RETAKE_DEBUG
void Round_DebugLog()
{
	char cls[32];
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || !IsPlayerAlive(i) || GetClientTeam(i) < TEAM_T)
			continue;
		int primary = GetPlayerWeaponSlot(i, CS_SLOT_PRIMARY);
		cls = "-";
		if (primary != -1)
			GetEdictClassname(primary, cls, sizeof(cls));
		LogMessage("RETAKE_DBG jugador ronda=%d sitio=%d tipo=%s id=%d equipo=%d primaria=%s kit=%d casco=%d planta=%d", g_iRound, g_iSite, g_bPistol ? "pistola" : "fullbuy", i, GetClientTeam(i), cls,
			GetEntProp(i, Prop_Send, "m_bHasDefuser"), GetEntProp(i, Prop_Send, "m_bHasHelmet"), i == g_iPlanter ? 1 : 0);
	}
}

/** Puntos de prueba alrededor del centro de un func_bomb_target, solo para probar con bots. */
public Action Cmd_DebugGen(int args)
{
	char s[8];
	GetCmdArg(1, s, sizeof(s));
	int index = StringToInt(s);
	GetCmdArg(2, s, sizeof(s));
	int site;
	Spawns_ParseSite(s, site);
	GetCmdArg(3, s, sizeof(s));
	int count = StringToInt(s);
	int ent = -1, i;
	float center[3];
	while ((ent = FindEntityByClassname(ent, "func_bomb_target")) != -1)
	{
		if (i++ != index)
			continue;
		float mins[3], maxs[3];
		GetEntPropVector(ent, Prop_Send, "m_vecMins", mins);
		GetEntPropVector(ent, Prop_Send, "m_vecMaxs", maxs);
		center[0] = (mins[0] + maxs[0]) / 2.0;
		center[1] = (mins[1] + maxs[1]) / 2.0;
		center[2] = maxs[2];
		float floorPos[3], probeBomb[3];
		for (int t = 0; t < 500 && g_aBombs[site].Length == 0; t++)
		{
			probeBomb[0] = t == 0 ? center[0] : GetRandomFloat(mins[0] + 16.0, maxs[0] - 16.0);
			probeBomb[1] = t == 0 ? center[1] : GetRandomFloat(mins[1] + 16.0, maxs[1] - 16.0);
			probeBomb[2] = maxs[2];
			if (Debug_Floor(probeBomb, floorPos) && floorPos[2] >= mins[2] - 4.0)
			{
				float bomb[4];
				bomb[0] = floorPos[0]; bomb[1] = floorPos[1]; bomb[2] = floorPos[2];
				g_aBombs[site].PushArray(bomb);
			}
		}
		for (int side = 0; side < 2; side++)
		{
			int made, tries;
			float radius = side == SIDE_T ? 150.0 : 500.0;
			while (made < count && tries++ < 2000)
			{
				float ang = GetRandomFloat(0.0, 6.28);
				float r = radius + GetRandomFloat(0.0, 250.0);
				float probe[3], pos[3];
				probe[0] = center[0] + r * Cosine(ang);
				probe[1] = center[1] + r * Sine(ang);
				probe[2] = center[2] + 100.0;
				if (!Debug_Floor(probe, pos) || Spawns_TooClose(site, pos))
					continue;
				float p[4];
				p[0] = pos[0]; p[1] = pos[1]; p[2] = pos[2];
				g_aPoints[site][side].PushArray(p);
				made++;
			}
			PrintToServer("Sitio %s lado %d: %d puntos", s, side, made);
		}
		Spawns_Save();
		return Plugin_Handled;
	}
	return Plugin_Handled;
}

bool Debug_Floor(const float from[3], float out[3])
{
	static const float hullMin[3] = { -16.0, -16.0, 0.0 }, hullMax[3] = { 16.0, 16.0, 72.0 };
	float down[3];
	down = from;
	down[2] -= 600.0;
	TR_TraceHull(from, down, hullMin, hullMax, MASK_PLAYERSOLID);
	if (TR_GetFraction() <= 0.0 || TR_GetFraction() >= 1.0)
		return false;
	TR_GetEndPosition(out);
	out[2] += 2.0;
	return true;
}

/** retake_debug_step <userid> <spec|team|class>: un paso del cambio de equipo por vez. */
public Action Cmd_DebugStep(int args)
{
	char id[16], step[16];
	GetCmdArg(1, id, sizeof(id));
	GetCmdArg(2, step, sizeof(step));
	int client = GetClientOfUserId(StringToInt(id));
	if (client == 0)
		return Plugin_Handled;
	if (StrEqual(step, "spec"))
		ChangeClientTeam(client, TEAM_SPEC);
	else if (StrEqual(step, "team"))
		ChangeClientTeam(client, TEAM_CT);
	else if (StrEqual(step, "class"))
		FakeClientCommandEx(client, "joinclass %d", GetRandomInt(5, 8));
	else if (StrEqual(step, "respawn"))
		CS_RespawnPlayer(client);
	PrintToServer("paso %s: equipo=%d vivo=%d", step, GetClientTeam(client), IsPlayerAlive(client));
	return Plugin_Handled;
}

public Action Cmd_DebugNext(int args)
{
	GetCmdArg(1, g_sNextMap, sizeof(g_sNextMap));
	return Plugin_Handled;
}

public Action Cmd_DebugQueue(int args)
{
	int ct, t;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		if (g_bQueued[i])
			PrintToServer("cola %d orden=%d", GetClientUserId(i), g_iQueueOrder[i]);
		if (GetClientTeam(i) == TEAM_T)
			t++;
		else if (GetClientTeam(i) == TEAM_CT)
			ct++;
	}
	PrintToServer("equipos T=%d CT=%d ronda=%d", t, ct, g_iRound);
	return Plugin_Handled;
}

public Action Cmd_DebugVip(int args)
{
	char id[16];
	GetCmdArg(1, id, sizeof(id));
	int client = GetClientOfUserId(StringToInt(id));
	if (client > 0)
	{
		g_bDebugVip[client] = !g_bDebugVip[client];
		PrintToServer("VIP de %N: %d, en cola: %d", client, g_bDebugVip[client], g_bQueued[client]);
	}
	return Plugin_Handled;
}

public Action Cmd_DebugFake(int args)
{
	char id[16], cmd[64];
	GetCmdArg(1, id, sizeof(id));
	GetCmdArg(2, cmd, sizeof(cmd));
	int client = GetClientOfUserId(StringToInt(id));
	if (client > 0)
		FakeClientCommand(client, "%s", cmd);
	return Plugin_Handled;
}
#endif
