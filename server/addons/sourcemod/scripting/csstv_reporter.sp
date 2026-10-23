/**
 * CSSTV Match Reporter
 *
 * Controla un mix en CS:S v34 (ready / live / medio tiempo / prórroga / fin),
 * junta las estadísticas de cada jugador y envía el resultado a Supabase.
 * También agrega mejoras de calidad de vida (csstv/qol.inc): marcador estable,
 * encabezado de ronda, daño y plata en el chat, !hp, pausa táctica, demo,
 * equipos bloqueados, contador de vivos y créditos. csstv/rr.inc agrega !rr.
 * csstv/license.inc valida la licencia del servidor: sin ella no se juegan mixes.
 * csstv/knife.inc (ronda de cuchillo), csstv/gg.inc (rendición), csstv/summary.inc
 * (resumen final), csstv/menu.inc (categoría CMLeague del menú de admin) y csstv/maps.inc
 * (votación de mapa de los jugadores: !rtv, !vote <mapa>, !mapas). csstv/live.inc manda una foto
 * del mix al final de cada ronda (mixes en vivo en la web) y recupera un mix cortado por una caída.
 * csstv/claim.inc (!claim) vincula el SteamID del jugador a su cuenta de la web (csstv_claim lo apaga).
 * csstv/whois.inc (!whois, admins y moderadores): nicks que usó un jugador en las partidas y su perfil en la web.
 * csstv/clips.inc anota las jugadas destacadas de cada ronda (ticks de cada kill y clutches) y las
 * manda con el resultado; la web arma los clips (csstv_clips lo apaga).
 *
 * El resultado se guarda primero en addons/sourcemod/data/csstv/queue/<uid>.json
 * y después se envía con la extensión System2 en partes de menos de 2 KB
 * (System2 no admite cuerpos más grandes). Si System2 no está disponible,
 * el archivo queda en la cola para que lo suba el script csstv_uploader.py.
 */

#pragma semicolon 1
#pragma newdecls required
#pragma dynamic 262144

#include <sourcemod>
#include <sdktools>
#undef REQUIRE_EXTENSIONS
#include <system2>
#define REQUIRE_EXTENSIONS
#undef REQUIRE_PLUGIN
#include <adminmenu>
#define REQUIRE_PLUGIN

#define PLUGIN_VERSION "2.5.0"
// Prefijo de los mensajes: [<csstv_chat_tag>] en verde. Se usa siempre como argumento "%s".
char g_sTag[32] = "CMLeague";
char g_sPrefix[48] = "\x04[CMLeague]\x01";
#define PREFIX g_sPrefix
// Invitación al Discord: al final del resumen de la partida y en los consejos del chat.
#define DISCORD_INVITE "dsc.gg/v34frag"

#define TEAM_SPEC 1
#define TEAM_T 2
#define TEAM_CT 3

public Plugin myinfo =
{
	name = "CSSTV Match Reporter",
	author = "CSSTV",
	description = "Controla mixes y envía resultados y estadísticas a CSSTV",
	version = PLUGIN_VERSION,
	url = ""
};

enum MatchState
{
	State_Warmup = 0,
	State_Starting,   // LO3 en curso
	State_Live,
	State_Halftime,   // medio tiempo o inicio de prórroga
	State_Finished,
	State_Knife       // ronda de cuchillo y elección de lado
};

#define PURPOSE_LIVE   1
#define PURPOSE_RESUME 2
#define PURPOSE_REROUND 3   // !rr
#define PURPOSE_KNIFE  4

// Cvars
ConVar g_cvEnabled;
ConVar g_cvApiUrl;
ConVar g_cvApiKey;
ConVar g_cvToken;
ConVar g_cvServerTag;
ConVar g_cvMaxRounds;
ConVar g_cvOvertime;
ConVar g_cvOtMaxRounds;
ConVar g_cvOtStartMoney;
ConVar g_cvMinPlayers;
ConVar g_cvLo3;
ConVar g_cvReadySystem;
ConVar g_cvReadyKnife;
ConVar g_cvSend;
ConVar g_cvRetrySeconds;
ConVar g_cvAssistDamage;
ConVar g_cvIncludeBots;
ConVar g_cvValidateId;
ConVar g_cvHalftimeDelay;
ConVar g_cvAbandonPlayers;
ConVar g_cvAbandonSeconds;
ConVar g_cvEndDelay;

// Estado de la partida
MatchState g_State = State_Warmup;
char g_sMatchUid[64];
int g_iStartedAt;
int g_iMatchMaxRounds;         // rondas del reglamentario de esta partida (csstv_maxrounds o !live mrN)
int g_iAbandonSince;           // GetTime() desde que hay menos jugadores que csstv_abandon_players (0 = no)
bool g_bAbandonWarned;
int g_iSideA = TEAM_CT;        // lado donde juega el equipo A
int g_iSegment;                // 0 = tiempo reglamentario, 1..n = prórroga n
int g_iSegLen;                 // rondas del segmento actual
int g_iSegRound;               // rondas jugadas en el segmento
int g_iSegA, g_iSegB;          // marcador del segmento
int g_iTotA, g_iTotB;          // marcador total
bool g_bRestarting;
int g_iRestartsLeft;
int g_iRestartPurpose;
int g_iSavedStartMoney = -1;
bool g_bReady[MAXPLAYERS + 1];
bool g_bDemoRecorded;          // la partida actual tiene demo (va en el resultado; lo maneja qol.inc)
Handle g_hReadyTimer;
// Nombres de los equipos de la partida: "Equipo <nick>" (A = el que empezó de CT).
char g_sTeamNick[2][24];
char g_sTeam[2][40];
bool g_bSurrender;             // la partida terminó por !gg
int g_iSurrenderTeam;          // 0 = A, 1 = B
// !match (csstv/match.inc): lo que viaja en el resultado. Se fija al empezar; desvincular durante la partida lo borra.
char g_sMatchLinkCode[8];
int g_iMatchLinkSideA;         // equipo de la partida de la web (1 o 2) que es el equipo A de este mix

#include "csstv/stats.inc"
#include "csstv/json.inc"
#include "csstv/clips.inc"
#include "csstv/queue.inc"
#include "csstv/live.inc"
#include "csstv/http.inc"
#include "csstv/license_id.inc"
#include "csstv/license.inc"
#include "csstv/qol.inc"
#include "csstv/rr.inc"
#include "csstv/knife.inc"
#include "csstv/gg.inc"
#include "csstv/summary.inc"
#include "csstv/menu.inc"
#include "csstv/maps.inc"
#include "csstv/match.inc"
#include "csstv/status.inc"
#include "csstv/claim.inc"
#include "csstv/whois.inc"
#include "csstv/tips.inc"

public APLRes AskPluginLoad2(Handle myself, bool late, char[] error, int err_max)
{
	// API de ClientMod (clientmod.smx): opcional, para saber quién acepta colores RGB.
	MarkNativeAsOptional("CM_GetClientModAuth");
	return APLRes_Success;
}

public void OnPluginStart()
{
	g_cvEnabled       = CreateConVar("csstv_enabled", "1", "Activa el plugin.", _, true, 0.0, true, 1.0);
	g_cvApiUrl        = CreateConVar("csstv_api_url", "", "URL de la función ingest_server_chunk (…/rest/v1/rpc/ingest_server_chunk).", FCVAR_PROTECTED);
	g_cvApiKey        = CreateConVar("csstv_api_key", "", "Anon key pública de Supabase.", FCVAR_PROTECTED);
	g_cvToken         = CreateConVar("csstv_server_token", "", "Token secreto del servidor (se crea en Admin > Servidores).", FCVAR_PROTECTED | FCVAR_DONTRECORD);
	g_cvServerTag     = CreateConVar("csstv_server_tag", "srv1", "Identificador corto del servidor (letras, números y guiones).");
	g_cvMaxRounds     = CreateConVar("csstv_maxrounds", "30", "Rondas del tiempo reglamentario (30 = MR15).", _, true, 2.0, true, 60.0);
	g_cvOvertime      = CreateConVar("csstv_overtime", "1", "Jugar prórroga si hay empate.", _, true, 0.0, true, 1.0);
	g_cvOtMaxRounds   = CreateConVar("csstv_ot_maxrounds", "24", "Rondas de cada prórroga (24 = MR12, 6 = MR3).", _, true, 2.0, true, 60.0);
	g_cvOtStartMoney  = CreateConVar("csstv_ot_startmoney", "10000", "Dinero inicial en prórroga.", _, true, 0.0, true, 16000.0);
	g_cvMinPlayers    = CreateConVar("csstv_min_players", "8", "Jugadores mínimos en CT+T para el inicio automático por !ready (!live no lo pide).", _, true, 2.0, true, 32.0);
	g_cvLo3           = CreateConVar("csstv_lo3", "1", "Hacer tres reinicios antes de empezar (LO3).", _, true, 0.0, true, 1.0);
	g_cvReadySystem   = CreateConVar("csstv_ready_system", "1", "Empezar solo cuando todos escriben !ready.", _, true, 0.0, true, 1.0);
	g_cvReadyKnife    = CreateConVar("csstv_ready_knife", "1", "El inicio por !ready empieza con ronda de cuchillo, como !live knife (0 = directo al LO3).", _, true, 0.0, true, 1.0);
	g_cvSend          = CreateConVar("csstv_send", "1", "Enviar con System2. Con 0 solo se guarda en la cola (para csstv_uploader.py).", _, true, 0.0, true, 1.0);
	g_cvRetrySeconds  = CreateConVar("csstv_retry_seconds", "60", "Primer reintento tras un error; se duplica hasta 15 minutos.", _, true, 10.0, true, 900.0);
	g_cvAssistDamage  = CreateConVar("csstv_assist_damage", "41", "Daño mínimo para contar una asistencia.", _, true, 1.0, true, 100.0);
	g_cvIncludeBots   = CreateConVar("csstv_include_bots", "0", "Contar bots (solo para pruebas).", _, true, 0.0, true, 1.0);
	g_cvValidateId    = CreateConVar("csstv_validate_steamid", "0", "Exigir SteamID validado por Steam (dejar en 0 en servidores no-Steam).", _, true, 0.0, true, 1.0);
	g_cvHalftimeDelay = CreateConVar("csstv_halftime_delay", "3.0", "Segundos tras la última ronda antes de cambiar de lados.", _, true, 1.0, true, 10.0);
	g_cvAbandonPlayers = CreateConVar("csstv_abandon_players", "4", "Con menos jugadores que esto en CT+T, la partida se cancela sola (0 = nunca).", _, true, 0.0, true, 32.0);
	g_cvAbandonSeconds = CreateConVar("csstv_abandon_seconds", "180", "Segundos seguidos con pocos jugadores antes de cancelar por abandono.", _, true, 5.0, true, 1800.0);
	g_cvEndDelay     = CreateConVar("csstv_end_delay", "15", "Segundos entre el fin de la partida y la vuelta al calentamiento.", _, true, 1.0, true, 60.0);
	CreateConVar("csstv_reporter_version", PLUGIN_VERSION, "Versión de CSSTV Match Reporter.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	AutoExecConfig(true, "csstv_reporter");

	RegAdminCmd("sm_live", Cmd_Live, ADMFLAG_GENERIC, "Empieza la partida con los equipos como están. Uso: sm_live [knife] [mrN] (knife = ronda de cuchillo para elegir lado; mr3 = gana el primero en llegar a 4)");
	RegAdminCmd("sm_cancelmatch", Cmd_Cancel, ADMFLAG_GENERIC, "Cancela la partida. Si se jugó al menos una ronda, se guarda como cancelada (con su demo).");
	RegAdminCmd("sm_swap", Cmd_Swap, ADMFLAG_GENERIC, "En el calentamiento: pasa los CT a T y los T a CT.");
	RegAdminCmd("sm_csstv_status", Cmd_Status, ADMFLAG_RCON, "Estado del plugin y de la cola.");
	RegAdminCmd("sm_csstv_flush", Cmd_Flush, ADMFLAG_RCON, "Reintenta ahora los envíos pendientes.");
	RegAdminCmd("sm_csstv_retryfailed", Cmd_RetryFailed, ADMFLAG_RCON, "Devuelve a la cola los envíos rechazados.");
	RegConsoleCmd("sm_ready", Cmd_Ready, "Marcarse listo.");
	RegConsoleCmd("sm_unready", Cmd_Unready, "Quitar el listo.");
	RegConsoleCmd("sm_notready", Cmd_Unready, "Quitar el listo.");
	RegConsoleCmd("sm_score", Cmd_Score, "Muestra el marcador.");

	CreateTimer(1.0, Timer_AbandonCheck, _, TIMER_REPEAT);

	HookEventEx("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	HookEventEx("round_end", Event_RoundEnd);
	HookEventEx("player_spawn", Event_PlayerSpawn);
	HookEventEx("player_hurt", Event_PlayerHurt);
	HookEventEx("player_death", Event_PlayerDeath);
	HookEventEx("bomb_planted", Event_BombPlanted);
	HookEventEx("bomb_defused", Event_BombDefused);
	HookEventEx("bomb_exploded", Event_BombExploded);

	Stats_Init();
	Queue_Init();
	Live_Init();   // después de Queue_Init: un mix cortado por una caída pasa a la cola
	Qol_Init();
	Rr_Init();
	Knife_Init();
	Gg_Init();
	License_Init();
	Menu_Init();
	Maps_Init();
	Match_Init();
	Status_Init();
	Claim_Init();
	Whois_Init();
	Tips_Init();
	Clips_Init();
}

public void OnMapStart()
{
	ResetMatch();
	Queue_EnsureDirs();
	Live_FlushMapChange();   // mix cortado por el fin del mapa anterior: ahora sí es un cambio de mapa
	Maps_OnMapStart();
}

public void OnConfigsExecuted()
{
	ExecIfExists("csstv/warmup.cfg");
	StartReadyTimer();
	License_Check();
	Http_ScheduleProcess(5.0);
	Match_OnMapReady();   // vínculo con la web: un pendiente se descarta, uno activo se actualiza (series)
}

public void OnMapEnd()
{
	if (g_State == State_Starting || g_State == State_Live || g_State == State_Halftime || g_State == State_Knife)
		CancelMatch("map_change", "");
	Demo_Stop();
	RestoreStartMoney();
	g_hReadyTimer = null;
	g_hPauseTimer = null;   // los timers TIMER_FLAG_NO_MAPCHANGE mueren con el mapa
	g_hKnifeTimer = null;
	g_hGgTimer = null;
	Pause_Clear();
}

public void OnClientPutInServer(int client)
{
	g_bReady[client] = false;
	Gg_ClientReset(client);
	Stats_ClientReset(client);
	Board_OnClientPut(client);
	Claim_ClientReset(client);
	Whois_ClientReset(client);
	Clips_ClientReset(client);
}

public void OnClientPostAdminCheck(int client)
{
	Recon_OnJoin(client);
	Match_OnClientJoin(client);
}

public void OnClientDisconnect(int client)
{
	g_bReady[client] = false;
	Recon_Remember(client);
	Board_SaveClient(client);
	Clips_OnLeave(client);   // antes de Stats_ClientLeave: puede dejar a un compañero en clutch
	Stats_ClientLeave(client);
	Maps_OnClientDisconnect(client);
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

public Action Cmd_Live(int client, int args)
{
	// Argumentos en cualquier orden: "knife" y "mrN" (N rondas por lado: gana quien llega a N+1).
	// "force" se acepta por los binds viejos: !live ya no pide el mínimo de jugadores.
	bool knife;
	int mr;
	char arg[16];
	for (int i = 1; i <= args; i++)
	{
		GetCmdArg(i, arg, sizeof(arg));
		if (StrEqual(arg, "force", false))
			continue;
		if (StrEqual(arg, "knife", false) || StrEqual(arg, "cuchillo", false))
			knife = true;
		else if ((arg[0] == 'm' || arg[0] == 'M') && (arg[1] == 'r' || arg[1] == 'R') && IsDigits(arg[2]))
		{
			mr = StringToInt(arg[2]);
			if (mr < 1 || mr > 30)
			{
				ReplyToCommand(client, "[%s] El formato va de mr1 a mr30 (mr15 = partida completa).", g_sTag);
				return Plugin_Handled;
			}
		}
		else
		{
			ReplyToCommand(client, "[%s] Uso: sm_live [knife] [mrN]. Ejemplos: !live · !live mr3 · !live knife mr4", g_sTag);
			return Plugin_Handled;
		}
	}
	Live_Request(client, mr, knife);
	return Plugin_Handled;
}

/** !live y el menú de admin. mr = 0: csstv_maxrounds. Empieza con los jugadores como están. */
void Live_Request(int client, int mr, bool knife)
{
	if (!g_cvEnabled.BoolValue)
	{
		ReplyToCommand(client, "[%s] El plugin está desactivado (csstv_enabled 0).", g_sTag);
		return;
	}
	if (!License_Allows())
	{
		License_Reply(client);
		return;
	}
	if (g_State != State_Warmup)
	{
		ReplyToCommand(client, "[%s] Ya hay una partida en curso.", g_sTag);
		return;
	}
	if (Maps_ChangePending())
	{
		ReplyToCommand(client, "[%s] El mapa está por cambiar: la partida se empieza en el mapa nuevo.", g_sTag);
		return;
	}
	if (CountTeamPlayers() < 2)
	{
		ReplyToCommand(client, "[%s] Hacen falta al menos 2 jugadores en los equipos.", g_sTag);
		return;
	}
	StartMatch(mr * 2, knife);
}

public Action Cmd_Swap(int client, int args)
{
	if (g_State != State_Warmup)
	{
		ReplyToCommand(client, "[%s] Los equipos solo se pueden intercambiar en el calentamiento.", g_sTag);
		return Plugin_Handled;
	}
	SwapTeams();
	Match_OnSwap();
	g_iSideA = TEAM_CT;
	ServerCommand("mp_restartgame 1");   // para que todos aparezcan en su lado nuevo
	PrintToChatAll("%s Un admin intercambió los equipos: los CT pasan a T y los T a CT.", PREFIX);
	return Plugin_Handled;
}

public Action Cmd_Cancel(int client, int args)
{
	if (g_State == State_Warmup)
	{
		ReplyToCommand(client, "[%s] No hay ninguna partida en curso.", g_sTag);
		return Plugin_Handled;
	}
	if (g_State == State_Finished)
	{
		ReplyToCommand(client, "[%s] La partida ya terminó y su resultado está en la cola.", g_sTag);
		return Plugin_Handled;
	}
	char by[MAX_NAME_LENGTH];
	if (client > 0)
		GetClientName(client, by, sizeof(by));
	else
		strcopy(by, sizeof(by), "Consola");
	CancelMatch("admin", by);
	BackToWarmup();
	return Plugin_Handled;
}

public Action Cmd_Ready(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (!License_Allows())
	{
		License_Reply(client);
		return Plugin_Handled;
	}
	if (!g_cvReadySystem.BoolValue || g_State != State_Warmup)
	{
		ReplyToCommand(client, "[%s] Ahora no se puede marcar listo.", g_sTag);
		return Plugin_Handled;
	}
	int team = GetClientTeam(client);
	if (team != TEAM_T && team != TEAM_CT)
	{
		ReplyToCommand(client, "[%s] Uníte a CT o T para marcarte listo.", g_sTag);
		return Plugin_Handled;
	}
	if (!g_bReady[client])
	{
		g_bReady[client] = true;
		PrintToChatAll("%s %N está listo (%d/%d).", PREFIX, client, CountReady(), CountTeamPlayers());
	}
	CheckReadyStart();
	return Plugin_Handled;
}

public Action Cmd_Unready(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (g_State == State_Warmup && g_bReady[client])
	{
		g_bReady[client] = false;
		PrintToChatAll("%s %N ya no está listo (%d/%d).", PREFIX, client, CountReady(), CountTeamPlayers());
	}
	return Plugin_Handled;
}

public Action Cmd_Score(int client, int args)
{
	if (g_State == State_Warmup)
	{
		ReplyToCommand(client, "[%s] Calentamiento. Listos: %d/%d.", g_sTag, CountReady(), CountTeamPlayers());
	}
	else
	{
		ReplyToCommand(client, "[%s] %s (%s) %d - %d %s (%s) · %s, ronda %d de %d.", g_sTag,
			g_sTeam[0], g_iSideA == TEAM_CT ? "CT" : "T", g_iTotA, g_iTotB, g_sTeam[1], g_iSideA == TEAM_CT ? "T" : "CT",
			g_iSegment == 0 ? "reglamentario" : "prórroga", g_iSegRound + 1, g_iSegLen);
	}
	return Plugin_Handled;
}

public Action Cmd_Status(int client, int args)
{
	static const char stateNames[][] = { "calentamiento", "iniciando (LO3)", "en vivo", "medio tiempo", "terminada", "ronda de cuchillo" };
	ReplyToCommand(client, "[%s] v%s · estado: %s · partida: %s · %d-%d", g_sTag, PLUGIN_VERSION, stateNames[view_as<int>(g_State)],
		g_sMatchUid[0] ? g_sMatchUid : "-", g_iTotA, g_iTotB);
	char mode[96];
	Http_ModeText(mode, sizeof(mode));
	ReplyToCommand(client, "[%s] Envío: %s · en cola: %d · rechazados: %d", g_sTag, mode, Queue_Count(false), Queue_Count(true));
	char live[96];
	Live_StatusText(live, sizeof(live));
	ReplyToCommand(client, "[%s] Fotos en vivo: %s", g_sTag, live);
	char lic[160];
	License_StatusText(lic, sizeof(lic));
	ReplyToCommand(client, "[%s] Licencia: %s", g_sTag, lic);
	if (g_sLastError[0])
		ReplyToCommand(client, "[%s] Último error: %s", g_sTag, g_sLastError);
	return Plugin_Handled;
}

public Action Cmd_Flush(int client, int args)
{
	Http_ResetBackoff();
	Http_ScheduleProcess(0.1);
	ReplyToCommand(client, "[%s] Procesando la cola (%d archivos).", g_sTag, Queue_Count(false));
	return Plugin_Handled;
}

public Action Cmd_RetryFailed(int client, int args)
{
	int n = Queue_RequeueFailed();
	Http_ResetBackoff();
	Http_ScheduleProcess(0.1);
	ReplyToCommand(client, "[%s] %d archivo(s) devueltos a la cola.", g_sTag, n);
	return Plugin_Handled;
}

// ---------------------------------------------------------------------------
// Ready
// ---------------------------------------------------------------------------

void StartReadyTimer()
{
	if (g_hReadyTimer == null)
		g_hReadyTimer = CreateTimer(30.0, Timer_ReadyReminder, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_ReadyReminder(Handle timer)
{
	if (!g_cvEnabled.BoolValue || !g_cvReadySystem.BoolValue || g_State != State_Warmup)
		return Plugin_Continue;
	int total = CountTeamPlayers();
	if (total == 0)
		return Plugin_Continue;
	if (!License_Allows())
	{
		char why[96];
		License_ReasonText(why, sizeof(why));
		PrintToChatAll("%s Este servidor no tiene una licencia válida de CSSTV (%s). Los mixes están desactivados.", PREFIX, why);
		return Plugin_Continue;
	}
	char names[256];
	int missing;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsCountedPlayer(i) || g_bReady[i])
			continue;
		char n[MAX_NAME_LENGTH];
		GetClientName(i, n, sizeof(n));
		if (missing < 6)
			Format(names, sizeof(names), "%s%s%s", names, missing ? ", " : "", n);
		missing++;
	}
	PrintToChatAll("%s Calentamiento. Listos %d/%d (mínimo %d). Escribí !ready para empezar.", PREFIX, total - missing, total, g_cvMinPlayers.IntValue);
	if (missing)
		PrintToChatAll("%s Faltan: %s%s", PREFIX, names, missing > 6 ? "…" : "");
	if (g_LinkState == Link_Active)
		QolChatAll("%s Partida vinculada: {#amarillo}%s{#normal} (BO%d, serie %d-%d). !status para ver los detalles.", PREFIX, g_sLinkTitle, g_iLinkBestOf, g_iLinkScore[0], g_iLinkScore[1]);
	else if (g_LinkState == Link_Pending)
		QolChatAll("%s Vínculo pendiente: {#amarillo}%s{#normal}. Falta que confirme alguien de %s con !match %s.", PREFIX, g_sLinkTitle, g_sLinkTeamName[2 - g_iLinkProposer], g_sLinkCode);
	return Plugin_Continue;
}

void CheckReadyStart()
{
	int total = CountTeamPlayers();
	if (License_Allows() && !Maps_ChangePending() && total >= g_cvMinPlayers.IntValue && CountReady() == total && Match_ReadyAllows())
		StartMatch(0, g_cvReadyKnife.BoolValue);
}

int CountReady()
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (IsCountedPlayer(i) && g_bReady[i])
			n++;
	return n;
}

int CountTeamPlayers()
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (IsCountedPlayer(i))
			n++;
	return n;
}

bool IsCountedPlayer(int client)
{
	if (!IsClientInGame(client) || IsClientSourceTV(client))
		return false;
	if (IsFakeClient(client) && !g_cvIncludeBots.BoolValue)
		return false;
	int team = GetClientTeam(client);
	return team == TEAM_T || team == TEAM_CT;
}

// ---------------------------------------------------------------------------
// Flujo de la partida
// ---------------------------------------------------------------------------

void ResetMatch()
{
	g_State = State_Warmup;
	g_sMatchUid[0] = '\0';
	Live_Reset();
	g_iStartedAt = 0;
	g_iMatchMaxRounds = 0;
	g_iAbandonSince = 0;
	g_bAbandonWarned = false;
	g_iSideA = TEAM_CT;
	g_iSegment = 0;
	g_iSegLen = 0;
	g_iSegRound = 0;
	g_iSegA = 0;
	g_iSegB = 0;
	g_iTotA = 0;
	g_iTotB = 0;
	g_bRestarting = false;
	g_iRestartsLeft = 0;
	g_bSurrender = false;
	for (int t = 0; t < 2; t++)
	{
		g_sTeamNick[t][0] = '\0';
		strcopy(g_sTeam[t], sizeof(g_sTeam[]), t == 0 ? "Equipo A" : "Equipo B");
	}
	for (int i = 1; i <= MaxClients; i++)
		g_bReady[i] = false;
	Stats_Reset();
	Clips_Clear();
	Qol_Reset();
	Rr_Reset();
	Knife_Reset();
	Gg_Reset();
	Match_Reset();
}

void BackToWarmup()
{
	Demo_Stop();
	RestoreStartMoney();
	ResetMatch();
	ExecIfExists("csstv/warmup.cfg");
	// Partida vinculada (serie BO3/BO5): se actualiza el marcador de la serie cuando la web ya recibió el resultado.
	if (g_LinkState == Link_Active)
		CreateTimer(8.0, Timer_LinkRefresh, _, TIMER_FLAG_NO_MAPCHANGE);
}

/** maxRounds: rondas del reglamentario (0 = csstv_maxrounds). knife: ronda de cuchillo antes del LO3. */
void StartMatch(int maxRounds = 0, bool knife = false)
{
	ResetMatch();
	Maps_OnMatchStart();
	g_State = State_Starting;
	g_iSegLen = maxRounds > 0 ? maxRounds : g_cvMaxRounds.IntValue;
	if (g_iSegLen % 2)
		g_iSegLen++;
	g_iMatchMaxRounds = g_iSegLen;

	char tag[24];
	g_cvServerTag.GetString(tag, sizeof(tag));
	SanitizeId(tag);
	FormatTime(g_sMatchUid, sizeof(g_sMatchUid), "%Y%m%dT%H%M%S", GetTime());
	Format(g_sMatchUid, sizeof(g_sMatchUid), "%s-%s-%04x", tag[0] ? tag : "srv", g_sMatchUid, GetRandomInt(0, 0xFFFF));

	// El plugin decide cuándo termina la partida, no el juego.
	ServerCommand("mp_maxrounds 0; mp_winlimit 0; mp_timelimit 0");
	ExecIfExists("csstv/live.cfg");

	Match_OnMatchStart();
	PickTeamNames();
	Match_ApplyTeamNames();
	Recon_RememberAll();
	if (knife)
		Knife_Begin();
	else
		GoLive();
}

/** Anuncia la partida y hace el LO3. Al empezar, o después de la ronda de cuchillo. */
void GoLive()
{
	g_State = State_Starting;
	QolChatAll("%s La partida empieza: {#amarillo}%s{#normal} (%s) vs {#amarillo}%s{#normal} (%s). MR%d: gana el primero en llegar a %d.", PREFIX,
		g_sTeam[0], g_iSideA == TEAM_CT ? "{#ct}CT{#normal}" : "{#t}T{#normal}",
		g_sTeam[1], g_iSideA == TEAM_CT ? "{#t}T{#normal}" : "{#ct}CT{#normal}",
		g_iSegLen / 2, g_iSegLen / 2 + 1);
	BeginRestarts(g_cvLo3.BoolValue ? 3 : 1, PURPOSE_LIVE);
}

/**
 * Nombre de cada equipo: un jugador al azar de cada lado (humanos primero). El equipo A es el
 * que empieza de CT. El nombre queda fijo toda la partida, aunque ese jugador se vaya.
 */
void PickTeamNames()
{
	for (int t = 0; t < 2; t++)
	{
		int side = t == 0 ? g_iSideA : OtherSide(g_iSideA);
		int humans[MAXPLAYERS], bots[MAXPLAYERS], nh, nb;
		for (int i = 1; i <= MaxClients; i++)
		{
			if (!IsClientInGame(i) || IsClientSourceTV(i) || GetClientTeam(i) != side)
				continue;
			if (IsFakeClient(i))
				bots[nb++] = i;
			else
				humans[nh++] = i;
		}
		int pick = nh ? humans[GetRandomInt(0, nh - 1)] : (nb ? bots[GetRandomInt(0, nb - 1)] : 0);
		if (!pick)
			continue;
		GetClientName(pick, g_sTeamNick[t], sizeof(g_sTeamNick[]));
		ReplaceString(g_sTeamNick[t], sizeof(g_sTeamNick[]), "{", "(");   // que un nick no pueda meter etiquetas de color
		TrimString(g_sTeamNick[t]);
		TruncateUtf8(g_sTeamNick[t], 16);
		if (g_sTeamNick[t][0])
			Format(g_sTeam[t], sizeof(g_sTeam[]), "Equipo %s", g_sTeamNick[t]);
	}
}

void BeginRestarts(int count, int purpose)
{
	g_bRestarting = true;
	g_iRestartsLeft = count;
	g_iRestartPurpose = purpose;
	ServerCommand("mp_restartgame 1");
}

public Action Timer_NextRestart(Handle timer)
{
	if (g_bRestarting)
		ServerCommand("mp_restartgame 1");
	return Plugin_Stop;
}

void OnRestartsDone()
{
	if (g_iRestartPurpose == PURPOSE_KNIFE)
	{
		g_State = State_Knife;
		Knife_OnRestartsDone();
		return;
	}
	g_State = State_Live;
	ApplyTeamScores();
	if (g_iRestartPurpose == PURPOSE_LIVE)
	{
		g_iStartedAt = GetTime();
		char map[64];
		GetCurrentMap(map, sizeof(map));
		LogMessage("Partida %s en vivo en %s.", g_sMatchUid, map);
		PrintToChatAll("%s ¡EN VIVO! ¡EN VIVO! ¡EN VIVO! Suerte a todos.", PREFIX);
		Clips_OnLiveStart();   // en el mismo cuadro: los ticks de los clips cuentan desde la demo
		Demo_Start();
	}
	else
	{
		PrintToChatAll("%s ¡EN VIVO! %s %d - %d %s.", PREFIX, g_sTeam[0], g_iTotA, g_iTotB, g_sTeam[1]);
		Board_ScheduleRestoreAll();
		if (g_iRestartPurpose == PURPOSE_REROUND)
			Rr_ScheduleRestore();
	}
}

void ApplyTeamScores()
{
	SetTeamScore(g_iSideA, g_iTotA);
	SetTeamScore(OtherSide(g_iSideA), g_iTotB);
}

int OtherSide(int side)
{
	return side == TEAM_CT ? TEAM_T : TEAM_CT;
}

void OnRoundCompleted(int winnerSide, int reason)
{
	bool aWon = winnerSide == g_iSideA;
	Stats_RoundEnd(g_iSideA);
	Stats_LogRound(aWon ? 1 : 2, g_iSideA, reason);

	if (aWon) { g_iSegA++; g_iTotA++; }
	else      { g_iSegB++; g_iTotB++; }
	g_iSegRound++;
	Clips_RoundEnd(winnerSide, g_iTotA + g_iTotB);   // antes de FinishMatch y de la foto en vivo
	Stats_SnapshotRound(g_iTotA + g_iTotB);
	Board_SaveAll();

	int half = g_iSegLen / 2;
	PrintToChatAll("%s %s %d - %d %s", PREFIX, g_sTeam[0], g_iTotA, g_iTotB, g_sTeam[1]);

	if (g_iSegA > half || g_iSegB > half)
	{
		FinishMatch();
	}
	else if (g_iSegRound >= g_iSegLen)
	{
		if (g_cvOvertime.BoolValue)
			StartOvertime();
		else
			FinishMatch();
	}
	else if (g_iSegRound == half)
	{
		g_State = State_Halftime;
		PrintToChatAll("%s Medio tiempo. Se cambian los lados.", PREFIX);
		CreateTimer(g_cvHalftimeDelay.FloatValue, Timer_Halftime, _, TIMER_FLAG_NO_MAPCHANGE);
	}
	if (g_State != State_Finished)
		Live_Snapshot();
}

public Action Timer_Halftime(Handle timer)
{
	if (g_State != State_Halftime)
		return Plugin_Stop;
	Board_SaveAll();   // incluye las kills después del fin de la ronda; antes del cambio, que suma una muerte
	SwapTeams();
	BeginRestarts(1, PURPOSE_RESUME);
	return Plugin_Stop;
}

void StartOvertime()
{
	g_State = State_Halftime;
	g_iSegment++;
	// La prórroga nunca es más larga que el reglamentario (en un mr3 se juega MR3, no MR12).
	g_iSegLen = g_cvOtMaxRounds.IntValue < g_iMatchMaxRounds ? g_cvOtMaxRounds.IntValue : g_iMatchMaxRounds;
	if (g_iSegLen % 2)
		g_iSegLen++;
	g_iSegRound = 0;
	g_iSegA = 0;
	g_iSegB = 0;
	PrintToChatAll("%s Empate %d-%d. Prórroga %d (MR%d).", PREFIX, g_iTotA, g_iTotB, g_iSegment, g_iSegLen / 2);
	CreateTimer(g_cvHalftimeDelay.FloatValue, Timer_OvertimeStart, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_OvertimeStart(Handle timer)
{
	if (g_State != State_Halftime)
		return Plugin_Stop;
	ConVar money = FindConVar("mp_startmoney");
	if (money != null)
	{
		if (g_iSavedStartMoney < 0)
			g_iSavedStartMoney = money.IntValue;
		money.IntValue = g_cvOtStartMoney.IntValue;
	}
	Board_SaveAll();
	BeginRestarts(1, PURPOSE_RESUME);
	return Plugin_Stop;
}

void RestoreStartMoney()
{
	if (g_iSavedStartMoney < 0)
		return;
	ConVar money = FindConVar("mp_startmoney");
	if (money != null)
		money.IntValue = g_iSavedStartMoney;
	g_iSavedStartMoney = -1;
}

void SwapTeams()
{
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsClientSourceTV(i))
			continue;
		int team = GetClientTeam(i);
		if (team == TEAM_T || team == TEAM_CT)
			MoveToTeam(i, OtherSide(team));
	}
	g_iSideA = OtherSide(g_iSideA);
}

/**
 * Pasa a un jugador a CT o T sin dejarlo esperando en el menú de modelos.
 * ChangeClientTeam deja al jugador sin clase y esperando elegir modelo: los bots
 * no reaparecen nunca. Se le asigna el modelo equivalente del otro lado
 * (T 1-4 <-> CT 5-8) y se lo marca activo para que reaparezca con el próximo
 * reinicio o la próxima ronda. En v34 no sirven CS_SwitchTeam (firma de otra
 * versión) ni FakeClientCommand "joinclass" (tumba el servidor con bots).
 */
void MoveToTeam(int client, int to)
{
	int cls = GetEntProp(client, Prop_Send, "m_iClass");
	ChangeClientTeam(client, to);
	if (to == TEAM_T && cls >= 5 && cls <= 8)
		cls -= 4;
	else if (to == TEAM_CT && cls >= 1 && cls <= 4)
		cls += 4;
	else if (!((to == TEAM_T && cls >= 1 && cls <= 4) || (to == TEAM_CT && cls >= 5 && cls <= 8)))
		cls = to == TEAM_T ? GetRandomInt(1, 4) : GetRandomInt(5, 8);
	SetEntProp(client, Prop_Send, "m_iClass", cls);
	SetEntProp(client, Prop_Send, "m_iPlayerState", 0);   // STATE_ACTIVE
}

void FinishMatch()
{
	g_State = State_Finished;
	Pause_Clear();
	Demo_Stop();
	Gg_Clear();
	int endedAt = GetTime();
	Summary_Print();

	Json_BuildPayload(endedAt);
	if (QueueResult("terminada"))
		PrintToChatAll("%s Enviando el resultado a CSSTV…", PREFIX);
	Live_Discard();

	RestoreStartMoney();
	ExecIfExists("csstv/end.cfg");
	CreateTimer(g_cvEndDelay.FloatValue, Timer_AfterFinish, _, TIMER_FLAG_NO_MAPCHANGE);
}

/**
 * Corta la partida en curso (reason: "admin" o "map_change"). Si se jugó al menos una ronda
 * se guarda como cancelada, con su marcador parcial y su demo; si no, se descarta y el demo se borra.
 * No vuelve al calentamiento: eso lo hace quien la llama.
 */
void CancelMatch(const char[] reason, const char[] by)
{
	Pause_Clear();
	Gg_Clear();
	Knife_Reset();
	Demo_Stop();
	if (g_iTotA + g_iTotB < 1 || CountReportedPlayers() < 2)
	{
		LogMessage("Partida %s cancelada (%s %s) sin rondas jugadas. No se guarda.", g_sMatchUid, reason, by);
		PrintToChatAll("%s Partida cancelada. No se jugó ninguna ronda, así que no se guarda.", PREFIX);
		if (g_bDemoRecorded)
			Demo_Discard(g_sMatchUid);
		Live_Discard();
		return;
	}
	PrintToChatAll("%s Partida cancelada (%s %d - %d %s). Queda guardada como cancelada.", PREFIX, g_sTeam[0], g_iTotA, g_iTotB, g_sTeam[1]);
	Json_BuildPayload(GetTime(), true, reason, by);
	if (StrEqual(reason, "map_change"))
	{
		// Se encola al arrancar el mapa siguiente (csstv/live.inc): si el servidor se reinicia en el
		// medio, al volver queda como interrumpido. Sin foto en vivo, se encola ya, como antes.
		if (Live_DeferMapChange())
		{
			Live_Reset();
			return;
		}
		QueueResult("cancelada por cambio de mapa");
	}
	else if (StrEqual(reason, "abandoned"))
		QueueResult("cancelada por abandono");
	else
		QueueResult("cancelada por un admin");
	Live_Discard();
}

/**
 * Cada segundo: si una partida en curso se queda con menos de csstv_abandon_players jugadores en CT+T
 * durante csstv_abandon_seconds seguidos, se cancela sola (motivo "abandoned"). Así nunca queda una
 * partida "en vivo" para siempre con SourceTV grabando un servidor vacío.
 */
public Action Timer_AbandonCheck(Handle timer)
{
	int min = g_cvAbandonPlayers.IntValue;
	if (min <= 0 || !(g_State == State_Starting || g_State == State_Live || g_State == State_Halftime || g_State == State_Knife))
	{
		g_iAbandonSince = 0;
		g_bAbandonWarned = false;
		return Plugin_Continue;
	}
	int players = CountTeamPlayers();
	int limit = g_cvAbandonSeconds.IntValue;
	if (players >= min)
	{
		if (g_iAbandonSince)
			PrintToChatAll("%s Volvieron los jugadores: la partida sigue.", PREFIX);
		g_iAbandonSince = 0;
		g_bAbandonWarned = false;
		return Plugin_Continue;
	}
	int now = GetTime();
	if (!g_iAbandonSince)
	{
		g_iAbandonSince = now;
		PrintToChatAll("%s Quedan %d jugadores en los equipos (mínimo %d). Si no vuelven, la partida se cancela en %d s.", PREFIX, players, min, limit);
		LogMessage("Partida %s con %d jugadores: se cancela en %d s si no vuelven.", g_sMatchUid, players, limit);
		return Plugin_Continue;
	}
	int left = limit - (now - g_iAbandonSince);
	if (left <= 0)
	{
		CancelMatch("abandoned", "");
		BackToWarmup();
	}
	else if (left <= 60 && !g_bAbandonWarned)
	{
		g_bAbandonWarned = true;
		PrintToChatAll("%s Siguen faltando jugadores: la partida se cancela en %d s.", PREFIX, left);
	}
	return Plugin_Continue;
}

bool IsDigits(const char[] s)
{
	if (!s[0])
		return false;
	for (int i = 0; s[i]; i++)
		if (!IsCharNumeric(s[i]))
			return false;
	return true;
}

/** Pone g_sJson en la cola y programa el envío. */
bool QueueResult(const char[] what)
{
	if (!Queue_Save(g_sMatchUid))
	{
		LogError("No se pudo guardar el resultado de %s en la cola.", g_sMatchUid);
		PrintToChatAll("%s No se pudo guardar el resultado. Avisá a un admin.", PREFIX);
		return false;
	}
	LogMessage("Partida %s %s %d-%d. Resultado guardado en la cola.", g_sMatchUid, what, g_iTotA, g_iTotB);
	Http_ResetBackoff();
	Http_ScheduleProcess(1.0);
	return true;
}

/** Jugadores que entrarían en el resultado (los que completaron al menos una ronda). */
int CountReportedPlayers()
{
	int n;
	for (int p = 0; p < g_iRecCount; p++)
		if (g_Stats[p][ST_ROUNDS] > 0)
			n++;
	return n;
}

public Action Timer_AfterFinish(Handle timer)
{
	if (g_State == State_Finished)
		BackToWarmup();
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	Stats_RoundStart();
	Clips_RoundStart();
	Rr_OnRoundStart();
	Qol_ScheduleScoreSync();
	if (g_bRestarting)
	{
		g_iRestartsLeft--;
		if (g_iRestartsLeft > 0)
		{
			PrintToChatAll("%s Reinicio %d…", PREFIX, 3 - g_iRestartsLeft);
			CreateTimer(1.5, Timer_NextRestart, _, TIMER_FLAG_NO_MAPCHANGE);
			return;
		}
		g_bRestarting = false;
		OnRestartsDone();
	}
	if (g_State == State_Live)
		Qol_OnLiveRoundStart();
}

public void Event_RoundEnd(Event event, const char[] name, bool dontBroadcast)
{
	Qol_ScheduleScoreSync();
	if (g_State == State_Knife && !g_bRestarting)
	{
		Knife_OnRoundEnd(event.GetInt("winner"));
		return;
	}
	if (g_State != State_Live || g_bRestarting)
		return;
	int winner = event.GetInt("winner");
	if (winner != TEAM_T && winner != TEAM_CT)
		return; // ronda empatada o reinicio: no cuenta
	OnRoundCompleted(winner, event.GetInt("reason"));
}

public void Event_PlayerSpawn(Event event, const char[] name, bool dontBroadcast)
{
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0)
	{
		Stats_OnSpawn(client);
		Board_OnSpawn(client);
		Knife_OnSpawn(client);
	}
}

public void Event_PlayerHurt(Event event, const char[] name, bool dontBroadcast)
{
	int victim = GetClientOfUserId(event.GetInt("userid"));
	if (victim <= 0)
		return;
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	Stats_OnHurt(victim, attacker, event.GetInt("dmg_health"), event.GetInt("health"), g_State == State_Live && !g_bRestarting);
}

public void Event_PlayerDeath(Event event, const char[] name, bool dontBroadcast)
{
	if (g_State != State_Live || g_bRestarting)
		return;
	int victim = GetClientOfUserId(event.GetInt("userid"));
	if (victim <= 0)
		return;
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	Stats_OnDeath(victim, attacker, event.GetBool("headshot"));
	Clips_OnDeath(victim, attacker);
	char weapon[32];
	event.GetString("weapon", weapon, sizeof(weapon));
	Qol_OnDeath(victim, attacker, weapon);
}

public void Event_BombPlanted(Event event, const char[] name, bool dontBroadcast)
{
	if (g_State != State_Live || g_bRestarting)
		return;
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0)
		Stats_Add(client, ST_PLANTS, 1);
}

public void Event_BombDefused(Event event, const char[] name, bool dontBroadcast)
{
	if (g_State != State_Live || g_bRestarting)
		return;
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0)
	{
		Stats_Add(client, ST_DEFUSES, 1);
		Qol_OnBombScore(client);
	}
}

public void Event_BombExploded(Event event, const char[] name, bool dontBroadcast)
{
	if (g_State != State_Live || g_bRestarting)
		return;
	Qol_OnBombScore(GetClientOfUserId(event.GetInt("userid")));   // quien la plantó
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

void ExecIfExists(const char[] cfg)
{
	char path[PLATFORM_MAX_PATH];
	Format(path, sizeof(path), "cfg/%s", cfg);
	if (FileExists(path))
		ServerCommand("exec %s", cfg);
}

void SanitizeId(char[] s)
{
	int j;
	for (int i = 0; s[i] != '\0'; i++)
	{
		int c = s[i];
		if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_')
			s[j++] = s[i];
	}
	s[j] = '\0';
}
