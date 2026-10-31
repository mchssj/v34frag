/**
 * v34 Wingman
 *
 * Modo 2v2 para CS:S v34, con las reglas de Wingman de CS2: un solo sitio, primero a 9, máximo 16
 * rondas y cambio de lado tras la 8. Arranca con ronda de cuchillo para elegir lado. Inactivo al
 * cargar: lo prende un admin con sm_2v2 1 o se prende solo con sm_2v2_autostart 1. No envía nada a
 * ningún lado y no depende de csstv_reporter.
 *
 * wingman/map.inc (sitio, spawns y zonas por mapa), wingman/rank.inc (ranking) y retake/chat.inc (colores).
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <cstrike>
#include <sdkhooks>
#undef REQUIRE_PLUGIN
#include <adminmenu>
#define REQUIRE_PLUGIN

#define PLUGIN_VERSION "1.0.0"
#define WM_PREFIX "{#verde}[2v2]{#blanco}"
#define TEAM_SPEC 1
#define TEAM_T 2
#define TEAM_CT 3
#define TEAM_SIZE 2
#define PREPARE_DELAY 0.1
#define RESPAWN_DELAY 1.0
#define WARMUP_MONEY 16000
#define KEEP_ON_DELAY 5.0
#define KNIFE_CHOICE_TIME 20.0
#define HALFTIME_DELAY 3.0
#define END_DELAY 8.0
#define CAMERA_TICK 0.2
#define OBS_DEATHCAM_LAST 2
#define OBS_IN_EYE 4
#define ZONE_DRAW_EVERY 2.0
#define ZONE_DRAW_TIME 2.2
#define MAX_BONUS_STEPS 8

public Plugin myinfo =
{
	name = "v34 Wingman",
	author = "v34frag",
	description = "Modo 2v2 con las reglas de Wingman de CS2",
	version = PLUGIN_VERSION,
	url = ""
};

enum WmState
{
	State_Warmup = 0,
	State_Knife,
	State_KnifeChoice,
	State_Live,
	State_Ended
};

ConVar g_cvAutostart;
ConVar g_cvWinRounds;
ConVar g_cvHalfRounds;
ConVar g_cvFreeze;
ConVar g_cvC4Time;
ConVar g_cvRoundTime;
ConVar g_cvBuyTime;
ConVar g_cvStartMoney;
ConVar g_cvMaxMoney;
ConVar g_cvLossBonus;
ConVar g_cvZoneShow;
ConVar g_cvAbandon;

bool g_bActive;
WmState g_iState = State_Warmup;
int g_iSideA = TEAM_CT;         // lado donde juega la pareja A
int g_iScoreA, g_iScoreB;
int g_iRound;
int g_iLossA, g_iLossB;         // derrotas seguidas de cada pareja
int g_iKnifeWinner;
bool g_bRestarting;             // el próximo round_end/start viene de un mp_restartgame
bool g_bRoundOn;
bool g_bReady[MAXPLAYERS + 1];
float g_fBuyUntil;
float g_fLastGood[MAXPLAYERS + 1][3];
bool g_bHasLastGood[MAXPLAYERS + 1];
int g_iAbandonSince;
int g_iRoundSerial;
#if defined WINGMAN_DEBUG
int g_iDebugPlanter;
#endif
int g_iDamageTo[MAXPLAYERS + 1][MAXPLAYERS + 1];
int g_iHitsTo[MAXPLAYERS + 1][MAXPLAYERS + 1];

static const char g_sManaged[][] = { "mp_c4timer", "mp_freezetime", "mp_roundtime", "mp_buytime", "mp_startmoney", "mp_autoteambalance", "mp_limitteams", "mp_timelimit", "mp_maxrounds", "mp_winlimit", "mp_forcecamera", "sv_alltalk" };
char g_sManagedSaved[sizeof(g_sManaged)][32];

#include "retake/chat.inc"
#include "wingman/map.inc"
#include "wingman/rank.inc"
#include "wingman/pause.inc"
#include "wingman/menu.inc"

public void OnPluginStart()
{
	g_cvAutostart  = CreateConVar("sm_2v2_autostart", "0", "Prender el modo solo en cada mapa, para un servidor que es solo de 2v2 (0 = lo prende un admin con sm_2v2 1).", _, true, 0.0, true, 1.0);
	g_cvWinRounds  = CreateConVar("sm_2v2_win_rounds", "9", "Rondas para ganar.", _, true, 2.0, true, 30.0);
	g_cvHalfRounds = CreateConVar("sm_2v2_half_rounds", "8", "Rondas de cada mitad. Con 8-8 hay empate.", _, true, 1.0, true, 30.0);
	g_cvFreeze     = CreateConVar("sm_2v2_freeze", "10", "Segundos de freezetime.", _, true, 0.0, true, 60.0);
	g_cvC4Time     = CreateConVar("sm_2v2_c4_time", "40", "Segundos de la bomba.", _, true, 10.0, true, 90.0);
	g_cvRoundTime  = CreateConVar("sm_2v2_round_time", "1.5", "Minutos de la ronda.", _, true, 1.0, true, 9.0);
	g_cvBuyTime    = CreateConVar("sm_2v2_buy_time", "0.33", "Minutos de compra, contando el freezetime.", _, true, 0.1, true, 9.0);
	g_cvStartMoney = CreateConVar("sm_2v2_start_money", "800", "Plata al empezar cada mitad.", _, true, 800.0, true, 16000.0);
	g_cvMaxMoney   = CreateConVar("sm_2v2_max_money", "8000", "Plata máxima.", _, true, 800.0, true, 16000.0);
	g_cvLossBonus  = CreateConVar("sm_2v2_loss_bonus", "0 0 0 0", "Extra por jugador según las derrotas seguidas (1, 2, 3, 4 o más). Ejemplo: \"0 300 600 800\".");
	g_cvZoneShow   = CreateConVar("sm_2v2_zone_show", "1", "Dibujar siempre las zonas prohibidas con el modo prendido.", _, true, 0.0, true, 1.0);
	g_cvAbandon    = CreateConVar("sm_2v2_abandon_seconds", "120", "Segundos que se espera a un reemplazo antes de cancelar la partida.", _, true, 10.0, true, 900.0);
	CreateConVar("v34_wingman_version", PLUGIN_VERSION, "Versión de v34 Wingman.", FCVAR_NOTIFY | FCVAR_DONTRECORD);

	RegAdminCmd("sm_2v2", Cmd_Mode, ADMFLAG_GENERIC, "Prende o apaga el modo. Uso: sm_2v2 <1|0>");
	RegAdminCmd("sm_2v2_start", Cmd_ForceStart, ADMFLAG_GENERIC, "Empieza la partida sin esperar los !ready.");
	RegAdminCmd("sm_2v2_cancel", Cmd_Cancel, ADMFLAG_GENERIC, "Cancela la partida y vuelve al calentamiento.");
	RegConsoleCmd("sm_ready", Cmd_ReadyNoop, "Marcarse listo.");
	RegConsoleCmd("sm_stay", Cmd_ReadyNoop, "Quedarse de este lado tras ganar el cuchillo.");
	RegConsoleCmd("sm_switch", Cmd_ReadyNoop, "Cambiar de lado tras ganar el cuchillo.");
	AddCommandListener(Cmd_ReadyListener, "sm_ready");
	AddCommandListener(Cmd_ChoiceListener, "sm_stay");
	AddCommandListener(Cmd_ChoiceListener, "sm_switch");
	AddCommandListener(Cmd_JoinTeam, "jointeam");
	AddCommandListener(Cmd_JoinClass, "joinclass");
	static const char blockedBuy[][] = { "buy", "buymenu", "autobuy", "rebuy", "buyammo1", "buyammo2" };
	for (int i = 0; i < sizeof(blockedBuy); i++)
		AddCommandListener(Cmd_BlockBuy, blockedBuy[i]);
	static const char blockedMix[][] = { "sm_live", "sm_rtv", "sm_nominate" };
	for (int i = 0; i < sizeof(blockedMix); i++)
		AddCommandListener(Cmd_BlockMix, blockedMix[i]);
	HookUserMessage(GetUserMessageId("VGUIMenu"), Msg_VguiMenu, true);

	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	HookEvent("round_end", Event_RoundEnd);
	HookEvent("player_hurt", Event_PlayerHurt);
	HookEvent("player_death", Event_PlayerDeath);
	HookEvent("player_team", Event_PlayerTeamPre, EventHookMode_Pre);

	Map_Init();
	Rank_Init();
	Pause_Init();
	Menu_Init();
	CreateTimer(ZONE_DRAW_EVERY, Timer_DrawZones, _, TIMER_REPEAT);
	CreateTimer(CAMERA_TICK, Timer_Camera, _, TIMER_REPEAT);
	CreateTimer(1.0, Timer_Second, _, TIMER_REPEAT);
	AutoExecConfig(true, "v34_wingman");
	for (int i = 1; i <= MaxClients; i++)   // recarga del plugin con jugadores adentro
		if (IsClientInGame(i))
			SDKHook(i, SDKHook_PostThinkPost, Hook_PostThinkPost);

#if defined WINGMAN_DEBUG
	RegServerCmd("wm_debug_gen", Cmd_DebugGen);
	RegServerCmd("wm_debug_fake", Cmd_DebugFake);
	RegServerCmd("wm_debug_score", Cmd_DebugScore);
	RegServerCmd("wm_debug_zone", Cmd_DebugZone);
	RegServerCmd("wm_debug_state", Cmd_DebugState);
	RegServerCmd("wm_debug_plant", Cmd_DebugPlant);
	HookEvent("bomb_planted", Event_DebugPlanted);
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
	Map_OnMapStart();
}

public void OnConfigsExecuted()
{
	if (g_cvAutostart.BoolValue)
		CreateTimer(KEEP_ON_DELAY, Timer_TurnOn, 0, TIMER_FLAG_NO_MAPCHANGE);
}

public void OnMapEnd()
{
	if (g_bActive)
		Mode_Off();
}

public void OnClientPutInServer(int client)
{
	g_bReady[client] = false;
	g_bHasLastGood[client] = false;
	g_bHasCorner[client] = false;
	SDKHook(client, SDKHook_PostThinkPost, Hook_PostThinkPost);
}

public void OnClientDisconnect(int client)
{
	Rank_OnClientDisconnect(client);
	g_bReady[client] = false;
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

/** Si v34_retake está cargado y prendido: los dos modos no pueden correr a la vez. Llamar desde un timer. */
bool Mode_RetakeIsOn()
{
	if (!CommandExists("sm_retake"))
		return false;
	char out[256];
	ServerCommandEx(out, sizeof(out), "sm_retake");
	return StrContains(out, "prendido") != -1;
}

public Action Cmd_Mode(int client, int args)
{
	char arg[8];
	GetCmdArg(1, arg, sizeof(arg));
	if (args != 1 || (!StrEqual(arg, "1") && !StrEqual(arg, "0")))
	{
		ReplyToCommand(client, "[2v2] Uso: sm_2v2 <1|0>. Ahora está %s.", g_bActive ? "prendido" : "apagado");
		return Plugin_Handled;
	}
	if (StrEqual(arg, "0"))
	{
		if (g_bActive)
		{
			Mode_Off();
			ServerCommand("mp_restartgame 1");
			ChatAll("%s Modo apagado.", WM_PREFIX);
		}
		ReplyToCommand(client, "[2v2] Modo apagado.");
		return Plugin_Handled;
	}
	if (g_bActive)
	{
		ReplyToCommand(client, "[2v2] El modo ya está prendido.");
		return Plugin_Handled;
	}
	if (!Map_Ready())
	{
		ReplyToCommand(client, "[2v2] Este mapa no está listo. Hacen falta el sitio y %d spawns por equipo (sm_2v2_show).", SPAWNS_PER_TEAM);
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
			Chat(client, "%s Hay un mix en curso: terminalo o cancelalo antes de prender el modo.", WM_PREFIX);
		else
			PrintToServer("[2v2] Hay un mix en curso: terminalo o cancelalo antes de prender el modo.");
		return Plugin_Stop;
	}
	if (Mode_RetakeIsOn())
	{
		if (client > 0)
			Chat(client, "%s El retake está prendido: apagalo con !retake 0 antes de prender el 2v2.", WM_PREFIX);
		else
			PrintToServer("[2v2] El retake está prendido: apagalo con sm_retake 0 antes de prender el 2v2.");
		return Plugin_Stop;
	}
	if (!Map_Ready())
	{
		LogError("Este mapa no está listo para el 2v2: el modo queda apagado.");
		return Plugin_Stop;
	}
	Mode_On();
	return Plugin_Stop;
}

void Mode_SetInt(const char[] name, int value)
{
	ConVar cv = FindConVar(name);
	if (cv != null)
		cv.SetInt(value);
}

void Mode_On()
{
	for (int i = 0; i < sizeof(g_sManaged); i++)
	{
		ConVar cv = FindConVar(g_sManaged[i]);
		if (cv != null)
			cv.GetString(g_sManagedSaved[i], sizeof(g_sManagedSaved[]));
	}
	Mode_SetInt("mp_c4timer", g_cvC4Time.IntValue);
	Mode_SetInt("mp_freezetime", g_cvFreeze.IntValue);
	FindConVar("mp_roundtime").SetFloat(g_cvRoundTime.FloatValue);
	FindConVar("mp_buytime").SetFloat(g_cvBuyTime.FloatValue);
	Mode_SetInt("mp_startmoney", g_cvStartMoney.IntValue);
	Mode_SetInt("mp_autoteambalance", 0);
	Mode_SetInt("mp_limitteams", 0);
	Mode_SetInt("mp_timelimit", 0);
	Mode_SetInt("mp_maxrounds", 0);
	Mode_SetInt("mp_winlimit", 0);
	Mode_SetInt("mp_forcecamera", 1);    // al morir solo se mira al propio equipo
	Mode_SetInt("sv_alltalk", 0);
	g_bActive = true;
	Match_ToWarmup();
	ChatAll("%s Modo {#amarillo}2v2{#blanco} prendido. Elegí equipo y escribí {#verde}!ready{#blanco}.", WM_PREFIX);
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
	Pause_Clear();
	g_bActive = false;
	g_bRoundOn = false;
	g_iState = State_Warmup;
	Voice_Apply();
	Mode_RestoreCvars();
}

// ---------------------------------------------------------------------------
// Comandos durante el modo
// ---------------------------------------------------------------------------

public Action Cmd_ReadyNoop(int client, int args)
{
	return Plugin_Handled;
}

public Action Cmd_BlockBuy(int client, const char[] command, int argc)
{
	if (!g_bActive)
		return Plugin_Continue;
	if (g_iState == State_Knife || g_iState == State_KnifeChoice)
		return Plugin_Stop;
	// El comando se procesa ahora mismo: se marca justo antes, por si el frame ya lo había reseteado.
	if (client > 0 && IsClientInGame(client) && IsPlayerAlive(client) && Buy_IsOpen())
		SetEntProp(client, Prop_Send, "m_bInBuyZone", 1);
	return Plugin_Continue;
}

public Action Cmd_BlockMix(int client, const char[] command, int argc)
{
	if (!g_bActive)
		return Plugin_Continue;
	ReplyToCommand(client, "[2v2] No disponible durante el 2v2.");
	return Plugin_Stop;
}

int Teams_Count(int team)
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && !IsClientSourceTV(i) && GetClientTeam(i) == team)
			n++;
	return n;
}

/**
 * Máximo 2 por lado. En plena partida solo se puede entrar a cubrir un lugar vacío, y nadie cambia de
 * lado. Quien sobra mira como espectador. El modelo lo elige el plugin, sin abrir el menú.
 */
public Action Cmd_JoinTeam(int client, const char[] command, int argc)
{
	if (!g_bActive || client <= 0 || !IsClientInGame(client) || IsFakeClient(client))
		return Plugin_Continue;
	char arg[8];
	GetCmdArg(1, arg, sizeof(arg));
	int want = StringToInt(arg), team = GetClientTeam(client);
	bool inMatch = g_iState != State_Warmup;
	if (want == TEAM_SPEC)
	{
		if (inMatch && team >= TEAM_T)
		{
			Chat(client, "%s En plena partida no podés dejar tu equipo.", WM_PREFIX);
			return Plugin_Stop;
		}
		g_bReady[client] = false;
		return Plugin_Continue;
	}
	if (inMatch && team >= TEAM_T)
	{
		Chat(client, "%s En plena partida no podés cambiar de equipo.", WM_PREFIX);
		return Plugin_Stop;
	}
	if (want != TEAM_T && want != TEAM_CT)
		want = Teams_Count(TEAM_T) <= Teams_Count(TEAM_CT) ? TEAM_T : TEAM_CT;
	if (want == team)
		return Plugin_Stop;
	if (Teams_Count(want) >= TEAM_SIZE)
	{
		Chat(client, "%s Ese equipo está lleno: máximo %d jugadores.", WM_PREFIX, TEAM_SIZE);
		if (team < TEAM_SPEC)
			ChangeClientTeam(client, TEAM_SPEC);
		return Plugin_Stop;
	}
	g_bReady[client] = false;
	ChangeClientTeam(client, want);
	FakeClientCommandEx(client, "joinclass %d", want == TEAM_T ? GetRandomInt(1, 4) : GetRandomInt(5, 8));
	// En el calentamiento no se espera a la próxima ronda: puede no llegar si no hay nadie más.
	if (g_iState == State_Warmup)
		CreateTimer(RESPAWN_DELAY, Timer_Respawn, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
	return Plugin_Stop;
}

/** Elegir modelo estando vivo mataría al jugador: solo se deja si está muerto. */
public Action Cmd_JoinClass(int client, const char[] command, int argc)
{
	if (!g_bActive || client <= 0 || !IsClientInGame(client) || !IsPlayerAlive(client))
		return Plugin_Continue;
	return Plugin_Stop;
}

public Action Msg_VguiMenu(UserMsg msgId, BfRead msg, const int[] players, int playersNum, bool reliable, bool init)
{
	if (!g_bActive)
		return Plugin_Continue;
	char panel[32];
	msg.ReadString(panel, sizeof(panel));
	return StrContains(panel, "class_") == 0 ? Plugin_Handled : Plugin_Continue;
}

public Action Event_PlayerTeamPre(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return Plugin_Continue;
	event.BroadcastDisabled = true;
	return Plugin_Changed;
}

// ---------------------------------------------------------------------------
// Calentamiento
// ---------------------------------------------------------------------------

public Action Cmd_ReadyListener(int client, const char[] command, int argc)
{
	if (!g_bActive)
		return Plugin_Continue;
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Stop;
	if (g_iState != State_Warmup)
	{
		Chat(client, "%s Ahora no se puede marcar listo.", WM_PREFIX);
		return Plugin_Stop;
	}
	if (GetClientTeam(client) < TEAM_T)
	{
		Chat(client, "%s Primero elegí un equipo.", WM_PREFIX);
		return Plugin_Stop;
	}
	g_bReady[client] = true;
	Match_CheckReady();
	return Plugin_Stop;
}

void Match_CheckReady()
{
	int ready, total;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsClientSourceTV(i) || GetClientTeam(i) < TEAM_T)
			continue;
		total++;
		if (g_bReady[i] || IsFakeClient(i))
			ready++;
	}
	ChatAll("%s Listos: {#amarillo}%d/%d{#blanco}. Escribí {#verde}!ready{#blanco}.", WM_PREFIX, ready, TEAM_SIZE * 2);
	if (ready == TEAM_SIZE * 2 && total == TEAM_SIZE * 2 && Teams_Count(TEAM_T) == TEAM_SIZE && Teams_Count(TEAM_CT) == TEAM_SIZE)
		Match_StartKnife();
}

public Action Cmd_ForceStart(int client, int args)
{
	if (!g_bActive || g_iState != State_Warmup)
	{
		ReplyToCommand(client, "[2v2] Solo se puede empezar en el calentamiento con el modo prendido.");
		return Plugin_Handled;
	}
	if (Teams_Count(TEAM_T) != TEAM_SIZE || Teams_Count(TEAM_CT) != TEAM_SIZE)
	{
		ReplyToCommand(client, "[2v2] Hacen falta %d jugadores en cada equipo.", TEAM_SIZE);
		return Plugin_Handled;
	}
	Match_StartKnife();
	return Plugin_Handled;
}

public Action Cmd_Cancel(int client, int args)
{
	if (!g_bActive || g_iState == State_Warmup)
	{
		ReplyToCommand(client, "[2v2] No hay ninguna partida en curso.");
		return Plugin_Handled;
	}
	ChatAll("%s Partida cancelada por un admin.", WM_PREFIX);
	Match_ToWarmup();
	return Plugin_Handled;
}

void Match_Restart()
{
	g_bRestarting = true;
	g_bRoundOn = false;
	ServerCommand("mp_restartgame 1");
}

void Match_ToWarmup()
{
	g_iState = State_Warmup;
	g_iScoreA = g_iScoreB = g_iRound = 0;
	g_iLossA = g_iLossB = 0;
	g_iAbandonSince = 0;
	g_iSideA = TEAM_CT;
	Pause_Clear();
	for (int i = 0; i <= MaxClients; i++)
		g_bReady[i] = false;
	Match_Restart();
}

// ---------------------------------------------------------------------------
// Cuchillo
// ---------------------------------------------------------------------------

void Match_StartKnife()
{
	g_iState = State_Knife;
	ChatAll("%s {#amarillo}Ronda de cuchillo{#blanco}: quien gana elige lado.", WM_PREFIX);
	Match_Restart();
}

public Action Cmd_ChoiceListener(int client, const char[] command, int argc)
{
	if (!g_bActive)
		return Plugin_Continue;
	if (g_iState != State_KnifeChoice || client <= 0 || !IsClientInGame(client))
		return Plugin_Stop;
	if (GetClientTeam(client) != g_iKnifeWinner)
	{
		Chat(client, "%s Elige el equipo que ganó el cuchillo.", WM_PREFIX);
		return Plugin_Stop;
	}
	Match_StartLive(StrEqual(command, "sm_switch", false));
	return Plugin_Stop;
}

public Action Timer_KnifeChoice(Handle timer)
{
	if (g_bActive && g_iState == State_KnifeChoice)
	{
		ChatAll("%s Nadie eligió: se quedan de este lado.", WM_PREFIX);
		Match_StartLive(false);
	}
	return Plugin_Stop;
}

void Teams_SwapAll()
{
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsClientSourceTV(i))
			continue;
		int team = GetClientTeam(i);
		if (team >= TEAM_T)
			CS_SwitchTeam(i, team == TEAM_T ? TEAM_CT : TEAM_T);
	}
}

void Match_StartLive(bool swap)
{
	if (swap)
		Teams_SwapAll();
	g_iState = State_Live;
	g_iSideA = TEAM_CT;
	g_iScoreA = g_iScoreB = g_iRound = 0;
	g_iLossA = g_iLossB = 0;
	Pause_Clear();
	ChatAll("%s {#verde}Empieza la partida{#blanco}: primero a {#amarillo}%d{#blanco}. Máximo %d rondas.", WM_PREFIX, g_cvWinRounds.IntValue, g_cvHalfRounds.IntValue * 2);
	Match_Restart();
}

// ---------------------------------------------------------------------------
// Ronda
// ---------------------------------------------------------------------------

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return;
	g_bRestarting = false;
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

void Round_StripSlot(int client, int slot)
{
	int weapon;
	while ((weapon = GetPlayerWeaponSlot(client, slot)) != -1)
	{
		RemovePlayerItem(client, weapon);
		AcceptEntityInput(weapon, "Kill");
	}
}

void Round_PlaceTeam(int team, int side)
{
	int idx[SPAWNS_PER_TEAM], n;
	for (int i = 0; i < SPAWNS_PER_TEAM; i++)
		idx[i] = i;
	if (GetRandomInt(0, 1) == 1)
	{
		idx[0] = 1;
		idx[1] = 0;
	}
	for (int i = 1; i <= MaxClients && n < g_iSpawns[side]; i++)
	{
		if (!IsClientInGame(i) || GetClientTeam(i) != team || !IsPlayerAlive(i))
			continue;
		float pos[3], ang[3], stop[3];
		int s = idx[n++];
		pos[0] = g_fSpawn[side][s][0]; pos[1] = g_fSpawn[side][s][1]; pos[2] = g_fSpawn[side][s][2];
		ang[1] = g_fSpawn[side][s][3];
		TeleportEntity(i, pos, ang, stop);
	}
}

int Bonus_For(int losses)
{
	if (losses <= 0)
		return 0;
	char value[64], parts[MAX_BONUS_STEPS][12];
	g_cvLossBonus.GetString(value, sizeof(value));
	int n = ExplodeString(value, " ", parts, MAX_BONUS_STEPS, sizeof(parts[]));
	int step = losses > n ? n : losses;
	return StringToInt(parts[step - 1]);
}

void Round_GiveBonus()
{
	int bonusA = Bonus_For(g_iLossA), bonusB = Bonus_For(g_iLossB);
	if (bonusA == 0 && bonusB == 0)
		return;
	int sideB = g_iSideA == TEAM_CT ? TEAM_T : TEAM_CT;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		int team = GetClientTeam(i);
		int bonus = team == g_iSideA ? bonusA : (team == sideB ? bonusB : 0);
		if (bonus <= 0)
			continue;
		Money_Set(i, GetEntProp(i, Prop_Send, "m_iAccount") + bonus);
		Chat(i, "%s Bonificación por derrotas: {#verde}+$%d", WM_PREFIX, bonus);
	}
}

void Money_Set(int client, int value)
{
	int cap = g_cvMaxMoney.IntValue;
	SetEntProp(client, Prop_Send, "m_iAccount", value > cap ? cap : value);
}

void Round_Prepare()
{
	g_bRoundOn = true;
	for (int i = 1; i <= MaxClients; i++)
	{
		for (int j = 1; j <= MaxClients; j++)
		{
			g_iDamageTo[i][j] = 0;
			g_iHitsTo[i][j] = 0;
		}
		g_bHasLastGood[i] = false;   // al reaparecer, la posición anterior ya no vale
	}
	Map_DisableOtherSites();
	Round_PlaceTeam(TEAM_T, SIDE_T);
	Round_PlaceTeam(TEAM_CT, SIDE_CT);
	g_fBuyUntil = GetGameTime() + g_cvBuyTime.FloatValue * 60.0;

	if (g_iState == State_Warmup)
	{
		for (int i = 1; i <= MaxClients; i++)
		{
			if (!IsClientInGame(i) || GetClientTeam(i) < TEAM_T)
				continue;
			SetEntProp(i, Prop_Send, "m_iAccount", WARMUP_MONEY);
			if (IsPlayerAlive(i))
				Round_StripSlot(i, CS_SLOT_C4);
		}
		ChatAll("%s Calentamiento: elegí equipo y escribí {#verde}!ready{#blanco}.", WM_PREFIX);
	}
	else if (g_iState == State_Knife || g_iState == State_KnifeChoice)
	{
		for (int i = 1; i <= MaxClients; i++)
		{
			if (!IsClientInGame(i) || !IsPlayerAlive(i) || GetClientTeam(i) < TEAM_T)
				continue;
			Round_StripSlot(i, CS_SLOT_PRIMARY);
			Round_StripSlot(i, CS_SLOT_SECONDARY);
			Round_StripSlot(i, CS_SLOT_GRENADE);
			Round_StripSlot(i, CS_SLOT_C4);
			SetEntProp(i, Prop_Send, "m_iAccount", 0);
		}
		if (g_iState == State_KnifeChoice)
			g_bRoundOn = false;
	}
	else if (g_iState == State_Live)
	{
		SetTeamScore(g_iSideA, g_iScoreA);
		SetTeamScore(g_iSideA == TEAM_CT ? TEAM_T : TEAM_CT, g_iScoreB);
		Round_GiveBonus();
		int total = g_iRound + 1;
		ChatAll("%s Ronda {#amarillo}%d/%d{#blanco} | Marcador {#amarillo}%d - %d", WM_PREFIX, total, g_cvHalfRounds.IntValue * 2, g_iScoreA, g_iScoreB);
		for (int i = 1; i <= MaxClients; i++)
		{
			if (!IsClientInGame(i) || IsFakeClient(i))
				continue;
			int team = GetClientTeam(i);
			if (team >= TEAM_T)
				PrintHintText(i, "RONDA %d | %d - %d\nJugás de %s", total, team == g_iSideA ? g_iScoreA : g_iScoreB, team == g_iSideA ? g_iScoreB : g_iScoreA, team == TEAM_T ? "T" : "CT");
			else
				PrintHintText(i, "RONDA %d | %d - %d", total, g_iScoreA, g_iScoreB);
		}
#if defined WINGMAN_DEBUG
		LogMessage("WM_DBG ronda n=%d a=%d b=%d ladoA=%d T=%d CT=%d", total, g_iScoreA, g_iScoreB, g_iSideA, Teams_Count(TEAM_T), Teams_Count(TEAM_CT));
#endif
		Pause_OnRoundPrepared();
	}
}

public void Event_RoundEnd(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive || g_bRestarting || !g_bRoundOn)
		return;
	g_bRoundOn = false;
	int winner = event.GetInt("winner");
	Round_DamageReport();
	Rank_SaveAll();

	if (g_iState == State_Knife)
	{
		if (winner != TEAM_T && winner != TEAM_CT)
		{
			ChatAll("%s Empate en el cuchillo: se repite.", WM_PREFIX);
			Match_Restart();
			return;
		}
		g_iKnifeWinner = winner;
		g_iState = State_KnifeChoice;
		ChatAll("%s Ganaron los {#amarillo}%s{#blanco}: escriban {#verde}!stay{#blanco} o {#verde}!switch{#blanco} (%.0f s).", WM_PREFIX, winner == TEAM_T ? "T" : "CT", KNIFE_CHOICE_TIME);
		CreateTimer(KNIFE_CHOICE_TIME, Timer_KnifeChoice, _, TIMER_FLAG_NO_MAPCHANGE);
		return;
	}
	if (g_iState != State_Live || (winner != TEAM_T && winner != TEAM_CT))
		return;

	g_iRound++;
	if (winner == g_iSideA)
	{
		g_iScoreA++;
		g_iLossA = 0;
		g_iLossB++;
	}
	else
	{
		g_iScoreB++;
		g_iLossB = 0;
		g_iLossA++;
	}
#if defined WINGMAN_DEBUG
	LogMessage("WM_DBG fin n=%d ganador=%d razon=%d a=%d b=%d", g_iRound, winner, event.GetInt("reason"), g_iScoreA, g_iScoreB);
#endif
	Match_AfterRound();
}

void Match_AfterRound()
{
	SetTeamScore(g_iSideA, g_iScoreA);
	SetTeamScore(g_iSideA == TEAM_CT ? TEAM_T : TEAM_CT, g_iScoreB);
	int win = g_cvWinRounds.IntValue, half = g_cvHalfRounds.IntValue;
	if (g_iScoreA >= win || g_iScoreB >= win || g_iRound >= half * 2)
	{
		g_iState = State_Ended;
		if (g_iScoreA == g_iScoreB)
			ChatAll("%s {#amarillo}Empate %d - %d{#blanco}.", WM_PREFIX, g_iScoreA, g_iScoreB);
		else
			ChatAll("%s {#verde}Ganó la pareja %s{#blanco}: {#amarillo}%d - %d", WM_PREFIX, g_iScoreA > g_iScoreB ? "A" : "B", g_iScoreA, g_iScoreB);
#if defined WINGMAN_DEBUG
		LogMessage("WM_DBG partida a=%d b=%d rondas=%d", g_iScoreA, g_iScoreB, g_iRound);
#endif
		CreateTimer(END_DELAY, Timer_End, _, TIMER_FLAG_NO_MAPCHANGE);
		return;
	}
	if (g_iRound == half)
		CreateTimer(HALFTIME_DELAY, Timer_Halftime, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_Halftime(Handle timer)
{
	if (!g_bActive || g_iState != State_Live)
		return Plugin_Stop;
	Teams_SwapAll();
	g_iSideA = g_iSideA == TEAM_CT ? TEAM_T : TEAM_CT;
	g_iLossA = g_iLossB = 0;
	ChatAll("%s {#amarillo}Cambio de lado{#blanco}. La plata vuelve a $%d.", WM_PREFIX, g_cvStartMoney.IntValue);
#if defined WINGMAN_DEBUG
	LogMessage("WM_DBG cambio n=%d ladoA=%d", g_iRound, g_iSideA);
#endif
	Match_Restart();
	return Plugin_Stop;
}

public Action Timer_End(Handle timer)
{
	if (g_bActive && g_iState == State_Ended)
		Match_ToWarmup();
	return Plugin_Stop;
}

public void Event_PlayerDeath(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive || g_iState != State_Warmup)
		return;
	CreateTimer(RESPAWN_DELAY, Timer_Respawn, event.GetInt("userid"), TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_Respawn(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (g_bActive && g_iState == State_Warmup && client > 0 && GetClientTeam(client) >= TEAM_T && !IsPlayerAlive(client))
	{
		CS_RespawnPlayer(client);
		// El spawn del mapa puede quedar dentro de una zona prohibida: reaparece en uno de los propios.
		int side = GetClientTeam(client) == TEAM_T ? SIDE_T : SIDE_CT;
		if (g_iSpawns[side] > 0)
		{
			float pos[3], ang[3], stop[3];
			int s = GetRandomInt(0, g_iSpawns[side] - 1);
			pos[0] = g_fSpawn[side][s][0]; pos[1] = g_fSpawn[side][s][1]; pos[2] = g_fSpawn[side][s][2];
			ang[1] = g_fSpawn[side][s][3];
			TeleportEntity(client, pos, ang, stop);
		}
		g_bHasLastGood[client] = false;
		SetEntProp(client, Prop_Send, "m_iAccount", WARMUP_MONEY);
		Round_StripSlot(client, CS_SLOT_C4);
	}
	return Plugin_Stop;
}

public void Event_PlayerHurt(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return;
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	int victim = GetClientOfUserId(event.GetInt("userid"));
	if (attacker <= 0 || victim <= 0 || attacker == victim)
		return;
	g_iDamageTo[attacker][victim] += event.GetInt("dmg_health");
	g_iHitsTo[attacker][victim]++;
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
			int hitsGiven = g_iHitsTo[client][other], hitsTaken = g_iHitsTo[other][client];
			if (hitsGiven == 0 && hitsTaken == 0)
				continue;
			if (!header)
			{
				Chat(client, "{#verde}------ CMLeague ------");
				header = true;
			}
			Chat(client, "{#verde}Dado: {#blanco}%d (%d) | {#rojo}Recibido: {#blanco}%d (%d) - %N %s",
				g_iDamageTo[client][other], hitsGiven, g_iDamageTo[other][client], hitsTaken, other, IsPlayerAlive(other) ? "{#verde}[VIVO]" : "{#rojo}[MUERTO]");
		}
	}
}

// ---------------------------------------------------------------------------
// Cada tanto
// ---------------------------------------------------------------------------

/** Con el modo prendido las zonas se ven siempre. El reinicio de ronda borra los dibujos: se repiten. */
public Action Timer_DrawZones(Handle timer)
{
	if (!g_bActive || !g_cvZoneShow.BoolValue)
		return Plugin_Continue;
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && !IsFakeClient(i))
			for (int z = 0; z < g_iZones; z++)
				Map_DrawZone(i, z, ZONE_DRAW_TIME);
	return Plugin_Continue;
}

/**
 * En la partida cada uno escucha solo a su equipo, esté vivo o muerto; los espectadores no escuchan
 * a los que juegan, para que no puedan pasar información. En el calentamiento se escucha como siempre.
 */
void Voice_Apply()
{
	bool restrict = g_bActive && g_iState != State_Warmup;
	for (int r = 1; r <= MaxClients; r++)
	{
		if (!IsClientInGame(r) || IsFakeClient(r))
			continue;
		for (int s = 1; s <= MaxClients; s++)
		{
			if (s == r || !IsClientInGame(s) || IsFakeClient(s))
				continue;
			if (!restrict)
				SetListenOverride(r, s, Listen_Default);
			else
				SetListenOverride(r, s, GetClientTeam(r) == GetClientTeam(s) ? Listen_Yes : Listen_No);
		}
	}
}

/**
 * En la partida, quien murió mira en primera persona: mp_forcecamera solo limita a quién se mira.
 * La cámara de muerte (modos 1 y 2) se deja terminar.
 */
public Action Timer_Camera(Handle timer)
{
	if (!g_bActive || g_iState == State_Warmup)
		return Plugin_Continue;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsFakeClient(i) || IsPlayerAlive(i) || GetClientTeam(i) < TEAM_T)
			continue;
		if (GetEntProp(i, Prop_Send, "m_iObserverMode") > OBS_DEATHCAM_LAST && GetEntProp(i, Prop_Send, "m_iObserverMode") != OBS_IN_EYE)
			SetEntProp(i, Prop_Send, "m_iObserverMode", OBS_IN_EYE);
	}
	return Plugin_Continue;
}

/** Recorta la plata y, si falta alguien en plena partida, espera a un reemplazo antes de cancelar. */
public Action Timer_Second(Handle timer)
{
	if (!g_bActive)
		return Plugin_Continue;
	Voice_Apply();
	if (g_iState != State_Warmup)
	{
		int cap = g_cvMaxMoney.IntValue;
		for (int i = 1; i <= MaxClients; i++)
			if (IsClientInGame(i) && GetClientTeam(i) >= TEAM_T && GetEntProp(i, Prop_Send, "m_iAccount") > cap)
				SetEntProp(i, Prop_Send, "m_iAccount", cap);
	}
	if (g_iState == State_Warmup || g_iState == State_Ended)
	{
		g_iAbandonSince = 0;
		return Plugin_Continue;
	}
	// Se fueron todos: no tiene sentido esperar a un reemplazo, y la ronda no termina sola.
	if (Teams_Count(TEAM_T) == 0 && Teams_Count(TEAM_CT) == 0)
	{
		LogMessage("No queda nadie: la partida se cancela.");
		Match_ToWarmup();
		return Plugin_Continue;
	}
	if (Teams_Count(TEAM_T) >= TEAM_SIZE && Teams_Count(TEAM_CT) >= TEAM_SIZE)
	{
		g_iAbandonSince = 0;
		return Plugin_Continue;
	}
	int now = GetTime();
	if (g_iAbandonSince == 0)
	{
		g_iAbandonSince = now;
		ChatAll("%s Falta un jugador: se espera un reemplazo %d s. Un espectador puede elegir el equipo.", WM_PREFIX, g_cvAbandon.IntValue);
	}
	else if (now - g_iAbandonSince >= g_cvAbandon.IntValue)
	{
		ChatAll("%s Nadie reemplazó al jugador que falta: partida cancelada.", WM_PREFIX);
		Match_ToWarmup();
	}
	return Plugin_Continue;
}

bool Buy_IsOpen()
{
	return g_bActive && (g_iState == State_Warmup || (g_iState == State_Live && (g_bPaused || GetGameTime() < g_fBuyUntil)));
}

/**
 * Los spawns propios pueden quedar fuera de la zona de compra del mapa. El juego recalcula
 * m_bInBuyZone al procesar a cada jugador: se marca justo después, durante el tiempo de compra.
 */
public void Hook_PostThinkPost(int client)
{
	if (!g_bActive || !IsPlayerAlive(client) || GetClientTeam(client) < TEAM_T)
		return;
	if (Buy_IsOpen())
		SetEntProp(client, Prop_Send, "m_bInBuyZone", 1);
	Zones_Block(client);
}

/**
 * Las zonas funcionan como paredes: quien entra vuelve a la última posición válida, sin velocidad.
 * Se mira después de que el juego movió al jugador, y con el ancho del jugador, así que una zona
 * marcada como una línea fina también frena.
 */
void Zones_Block(int client)
{
	if (g_iZones == 0)
		return;
	float pos[3];
	GetClientAbsOrigin(client, pos);
	if (Map_ZoneAt(pos) == -1)
	{
		g_fLastGood[client] = pos;
		g_bHasLastGood[client] = true;
		return;
	}
	if (!g_bHasLastGood[client])
		return;
	float stop[3];
	TeleportEntity(client, g_fLastGood[client], NULL_VECTOR, stop);
#if defined WINGMAN_DEBUG
	LogMessage("WM_DBG zona bloqueado=%d", client);
#endif
}

/** No se planta en los sitios que no se juegan. */
public Action OnPlayerRunCmd(int client, int &buttons, int &impulse, float vel[3], float angles[3], int &weapon)
{
	if (!g_bActive || !IsPlayerAlive(client))
		return Plugin_Continue;
#if defined WINGMAN_DEBUG
	if (client == g_iDebugPlanter)
	{
		int dbg = GetPlayerWeaponSlot(client, CS_SLOT_C4);
		if (dbg != -1 && GetEntPropEnt(client, Prop_Send, "m_hActiveWeapon") != dbg)
			weapon = dbg;
		vel[0] = vel[1] = vel[2] = 0.0;
		buttons = IN_ATTACK;
	}
#endif
	if (!(buttons & IN_ATTACK) || GetClientTeam(client) != TEAM_T)
		return Plugin_Continue;
	int c4 = GetPlayerWeaponSlot(client, CS_SLOT_C4);
	if (c4 == -1 || GetEntPropEnt(client, Prop_Send, "m_hActiveWeapon") != c4)
		return Plugin_Continue;
	float pos[3];
	GetClientAbsOrigin(client, pos);
	if (!Map_InDisabledSite(pos))
#if defined WINGMAN_DEBUG
		return client == g_iDebugPlanter ? Plugin_Changed : Plugin_Continue;
#else
		return Plugin_Continue;
#endif
	buttons &= ~IN_ATTACK;
	PrintCenterText(client, "En este mapa no se juega este sitio.");
	return Plugin_Changed;
}

#if defined WINGMAN_DEBUG
/** Sitio y spawns de prueba alrededor del func_bomb_target indicado, solo para probar con bots. */
public Action Cmd_DebugGen(int args)
{
	char s[8];
	GetCmdArg(1, s, sizeof(s));
	int index = StringToInt(s), ent = -1, i;
	while ((ent = FindEntityByClassname(ent, "func_bomb_target")) != -1)
	{
		float mins[3], maxs[3];
		Map_Bounds(ent, mins, maxs);
		PrintToServer("sitio %d: mins %.0f %.0f %.0f maxs %.0f %.0f %.0f", i, mins[0], mins[1], mins[2], maxs[0], maxs[1], maxs[2]);
		if (i++ != index || args < 1)
			continue;
		g_fSite[0] = (mins[0] + maxs[0]) / 2.0;
		g_fSite[1] = (mins[1] + maxs[1]) / 2.0;
		g_fSite[2] = mins[2] + 8.0;
		g_bHasSite = true;
		g_iSpawns[SIDE_T] = g_iSpawns[SIDE_CT] = 0;
		for (int side = 0; side < 2; side++)
		{
			int tries;
			float radius = side == SIDE_T ? 200.0 : 700.0;
			while (g_iSpawns[side] < SPAWNS_PER_TEAM && tries++ < 3000)
			{
				float a = GetRandomFloat(0.0, 6.28), r = radius + GetRandomFloat(0.0, 300.0), from[3], to[3], end[3];
				static const float hullMin[3] = { -16.0, -16.0, 0.0 }, hullMax[3] = { 16.0, 16.0, 72.0 };
				from[0] = g_fSite[0] + r * Cosine(a);
				from[1] = g_fSite[1] + r * Sine(a);
				from[2] = maxs[2] + 150.0;
				to = from;
				to[2] -= 700.0;
				TR_TraceHull(from, to, hullMin, hullMax, MASK_PLAYERSOLID);
				if (TR_GetFraction() <= 0.0 || TR_GetFraction() >= 1.0)
					continue;
				TR_GetEndPosition(end);
				int n = g_iSpawns[side]++;
				g_fSpawn[side][n][0] = end[0];
				g_fSpawn[side][n][1] = end[1];
				g_fSpawn[side][n][2] = end[2] + 2.0;
				g_fSpawn[side][n][3] = 0.0;
			}
		}
		Map_Save();
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

/** wm_debug_score <a> <b> <rondas>: para llegar rápido al cambio de lado, al 9 o al 8-8. */
public Action Cmd_DebugScore(int args)
{
	char s[8];
	GetCmdArg(1, s, sizeof(s));
	g_iScoreA = StringToInt(s);
	GetCmdArg(2, s, sizeof(s));
	g_iScoreB = StringToInt(s);
	GetCmdArg(3, s, sizeof(s));
	g_iRound = StringToInt(s);
	return Plugin_Handled;
}

/** Zona de prueba alrededor de un jugador, solo en memoria. */
public Action Cmd_DebugZone(int args)
{
	char id[16];
	GetCmdArg(1, id, sizeof(id));
	int client = GetClientOfUserId(StringToInt(id));
	if (client > 0 && g_iZones < MAX_ZONES)
	{
		float pos[3], a[3], b[3];
		GetClientAbsOrigin(client, pos);
		a = pos; b = pos;
		a[0] -= 2000.0; a[1] -= 2000.0;
		b[0] += 2000.0; b[1] += 2000.0;
		Map_AddZone(a, b);
	}
	return Plugin_Handled;
}

/** wm_debug_plant <0|1> [userid t con c4]: lleva a un T al sitio pedido y le aprieta el ataque. 0 = el que no se juega. */
public Action Cmd_DebugPlant(int args)
{
	char s[8];
	GetCmdArg(1, s, sizeof(s));
	bool allowed = StringToInt(s) == 1;
	int planter;
	for (int i = 1; i <= MaxClients && planter == 0; i++)
		if (IsClientInGame(i) && IsPlayerAlive(i) && GetClientTeam(i) == TEAM_T && GetPlayerWeaponSlot(i, CS_SLOT_C4) != -1)
			planter = i;
	if (planter == 0)
	{
		PrintToServer("nadie tiene la C4");
		return Plugin_Handled;
	}
	int ent = -1;
	while ((ent = FindEntityByClassname(ent, "func_bomb_target")) != -1)
	{
		float mins[3], maxs[3];
		Map_Bounds(ent, mins, maxs);
		if (Map_InBox(g_fSite, mins, maxs) != allowed)
			continue;
		float from[3], to[3], end[3], stop[3];
		static const float hullMin[3] = { -16.0, -16.0, 0.0 }, hullMax[3] = { 16.0, 16.0, 72.0 };
		for (int t = 0; t < 500; t++)
		{
			from[0] = GetRandomFloat(mins[0] + 20.0, maxs[0] - 20.0);
			from[1] = GetRandomFloat(mins[1] + 20.0, maxs[1] - 20.0);
			from[2] = maxs[2];
			to = from;
			to[2] = mins[2] - 16.0;
			TR_TraceHull(from, to, hullMin, hullMax, MASK_PLAYERSOLID);
			if (TR_GetFraction() <= 0.0 || TR_GetFraction() >= 1.0)
				continue;
			TR_GetEndPosition(end);
			end[2] += 2.0;
			TeleportEntity(planter, end, NULL_VECTOR, stop);
			g_iDebugPlanter = planter;
			PrintToServer("planta %d en sitio permitido=%d", planter, allowed);
			return Plugin_Handled;
		}
	}
	return Plugin_Handled;
}

public void Event_DebugPlanted(Event event, const char[] name, bool dontBroadcast)
{
	g_iDebugPlanter = 0;
	int client = GetClientOfUserId(event.GetInt("userid"));
	float pos[3];
	if (client > 0)
		GetClientAbsOrigin(client, pos);
	LogMessage("WM_DBG plantada ensitiojugado=%d endesactivado=%d", GetVectorDistance(pos, g_fSite) < 800.0, Map_InDisabledSite(pos));
}

public Action Cmd_DebugState(int args)
{
	char line[512];
	Format(line, sizeof(line), "estado=%d ronda=%d a=%d b=%d ladoA=%d T=%d CT=%d zonas=%d freeze=%d pausa=%d pedida=%d usadas=%d/%d", view_as<int>(g_iState), g_iRound, g_iScoreA, g_iScoreB, g_iSideA, Teams_Count(TEAM_T), Teams_Count(TEAM_CT), g_iZones, Pause_InFreeze(), g_bPaused, g_bPauseRequested, g_iPausesUsed[0], g_iPausesUsed[1]);
	PrintToServer("%s", line);
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && GetClientTeam(i) >= TEAM_T)
			PrintToServer("  %d userid=%d equipo=%d vivo=%d plata=%d buyzone=%d primaria=%d", i, GetClientUserId(i), GetClientTeam(i), IsPlayerAlive(i), GetEntProp(i, Prop_Send, "m_iAccount"), GetEntProp(i, Prop_Send, "m_bInBuyZone"), GetPlayerWeaponSlot(i, CS_SLOT_PRIMARY));
	return Plugin_Handled;
}
#endif
