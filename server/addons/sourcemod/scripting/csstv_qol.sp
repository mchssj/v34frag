/**
 * CSSTV QOL
 *
 * Mejoras chicas para los jugadores (plan docs/bitacora/2026-11-02-qol-tanda-2):
 *   - en el calentamiento, el que muere reaparece a los 1,5 s con la plata de mp_startmoney;
 *   - con la partida en vivo, al terminar cada ronda dice quién hizo más daño y más kills;
 *   - si quien tiene la C4 no se mueve en los primeros csstv_qol_c4_afk segundos después del
 *     freezetime, la tira al piso;
 *   - csstv_qol_end_kick segundos después de que termina una partida pone una contraseña al azar
 *     (con !rpw de csstv_password; con matchmaking la maneja la web), expulsa a todos y cambia al
 *     mapa siguiente, para que el servidor quede libre. 40 s por defecto: la SourceTV va atrasada y
 *     tiene que llegar a mostrar el final. Si para entonces ya empezó otra partida, no hace nada.
 *
 * El estado del mix se lee de sm_csstv_status, como hace v34_retake, así no depende de la versión
 * del reporter. Con retake, wingman o deathmatch prendidos no hace nada: tienen sus propias reglas.
 * Sin licencia.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <cstrike>
#include <nextmap>

#define PLUGIN_VERSION "1.0.1"
#define TEAM_T  2
#define TEAM_CT 3
#define C4_MOVE 32.0   // unidades que tiene que moverse para no contar como quieto

public Plugin myinfo =
{
	name = "CSSTV QOL",
	author = "CMLeague",
	description = "Reaparecer en el calentamiento, mejor de la ronda y C4 de un jugador quieto",
	version = PLUGIN_VERSION,
	url = ""
};

ConVar g_cvRespawn;
ConVar g_cvRoundBest;
ConVar g_cvC4Afk;
ConVar g_cvEndKick;
ConVar g_cvStartMoney;
ConVar g_cvTag;

char g_sLastBest[192];              // último "mejor de la ronda", para sm_qol_status
char g_sState[32];                  // estado del reporter, leído cada segundo
bool g_bOtherMode;                  // retake, wingman o deathmatch prendido
bool g_bLive;                       // el reporter dice "en vivo" en esta ronda
int g_iDamage[MAXPLAYERS + 1];
int g_iKills[MAXPLAYERS + 1];
int g_iLastHp[MAXPLAYERS + 1];
int g_iRound;                       // cuenta las rondas, para que un timer viejo no actúe en la siguiente
int g_iC4Carrier;                   // userid de quien tenía la C4 al terminar el freezetime
float g_fC4Pos[3];

public void OnPluginStart()
{
	CreateConVar("csstv_qol_version", PLUGIN_VERSION, "Versión de CSSTV QOL.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvRespawn   = CreateConVar("csstv_qol_warmup_respawn", "1", "Reaparecer a los 1,5 s en el calentamiento del reporter.", _, true, 0.0, true, 1.0);
	g_cvRoundBest = CreateConVar("csstv_qol_round_best", "1", "Con la partida en vivo, decir al final de cada ronda quién hizo más daño y más kills.", _, true, 0.0, true, 1.0);
	g_cvC4Afk     = CreateConVar("csstv_qol_c4_afk", "20", "Segundos después del freezetime: si quien tiene la C4 no se movió, la tira (0 = no).", _, true, 0.0, true, 120.0);
	g_cvEndKick   = CreateConVar("csstv_qol_end_kick", "40", "Segundos después del fin de la partida: contraseña al azar, expulsar a todos y cambiar de mapa (0 = no). Que le dé tiempo a la SourceTV de mostrar el final.", _, true, 0.0, true, 120.0);
	AutoExecConfig(true, "csstv_qol");
	g_cvStartMoney = FindConVar("mp_startmoney");

	HookEvent("player_death", Event_PlayerDeath);
	HookEvent("player_hurt", Event_PlayerHurt);
	HookEvent("player_spawn", Event_PlayerSpawn);
	HookEvent("player_team", Event_PlayerTeam);
	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	HookEvent("round_freeze_end", Event_FreezeEnd, EventHookMode_PostNoCopy);
	HookEvent("round_end", Event_RoundEnd, EventHookMode_PostNoCopy);
	RegAdminCmd("sm_qol_status", Cmd_Status, ADMFLAG_GENERIC, "Estado de CSSTV QOL: qué lee del reporter y de los otros modos.");
	CreateTimer(1.0, Timer_State, _, TIMER_REPEAT);
}

public Action Cmd_Status(int client, int args)
{
	ReplyToCommand(client, "[QOL] v%s · reporter: %s · otro modo: %s · en vivo esta ronda: %s · último: %s", PLUGIN_VERSION,
		g_sState[0] ? g_sState : "-", g_bOtherMode ? "sí" : "no", g_bLive ? "sí" : "no", g_sLastBest[0] ? g_sLastBest : "-");
	return Plugin_Handled;
}

/** ServerCommandEx desde un timer y no desde los eventos. */
public Action Timer_State(Handle timer)
{
	bool wasOver = StrEqual(g_sState, "terminada");
	ReporterState(g_sState, sizeof(g_sState));
	if (!wasOver && StrEqual(g_sState, "terminada") && g_cvEndKick.IntValue > 0)
		CreateTimer(g_cvEndKick.FloatValue - 1.0, Timer_EndKick, _, TIMER_FLAG_NO_MAPCHANGE);   // el estado se lee con hasta 1 s de atraso
	g_bOtherMode = ModeOn("sm_retake") || ModeOn("sm_2v2") || ModeOn("sm_dm");
	return Plugin_Continue;
}

public void OnConfigsExecuted()
{
	g_cvTag = FindConVar("csstv_chat_tag");
}

// ---------------------------------------------------------------------------
// Estado del reporter y de los otros modos
// ---------------------------------------------------------------------------

/** "calentamiento", "en vivo", etc. Vacío si el reporter no está cargado. */
void ReporterState(char[] out, int len)
{
	out[0] = '\0';
	if (!CommandExists("sm_csstv_status"))
		return;
	char buf[512];
	ServerCommandEx(buf, sizeof(buf), "sm_csstv_status");
	int at = StrContains(buf, "estado: ");
	if (at == -1)
		return;
	strcopy(out, len, buf[at + 8]);
	int end = StrContains(out, " ·");
	if (end != -1)
		out[end] = '\0';
}

bool ModeOn(const char[] cmd)
{
	if (!CommandExists(cmd))
		return false;
	char out[256];
	ServerCommandEx(out, sizeof(out), cmd);
	return StrContains(out, "prendido") != -1;
}

bool InWarmup()
{
	return StrEqual(g_sState, "calentamiento") && !g_bOtherMode;
}

bool IsLive()
{
	return StrEqual(g_sState, "en vivo");
}

void Tag(char[] out, int len)
{
	if (g_cvTag != null)
		g_cvTag.GetString(out, len);
	if (!out[0])
		strcopy(out, len, "CMLeague");
}

// ---------------------------------------------------------------------------
// Calentamiento: reaparecer
// ---------------------------------------------------------------------------

public void Event_PlayerDeath(Event event, const char[] name, bool dontBroadcast)
{
	int victim = GetClientOfUserId(event.GetInt("userid"));
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	if (g_bLive && attacker > 0 && attacker != victim && victim > 0 && GetClientTeam(attacker) != GetClientTeam(victim))
		g_iKills[attacker]++;
	if (victim > 0 && g_cvRespawn.BoolValue && InWarmup())
		CreateTimer(1.5, Timer_Respawn, GetClientUserId(victim), TIMER_FLAG_NO_MAPCHANGE);
}

public void Event_PlayerTeam(Event event, const char[] name, bool dontBroadcast)
{
	if (event.GetBool("disconnect"))
		return;
	int team = event.GetInt("team");
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0 && (team == TEAM_T || team == TEAM_CT) && g_cvRespawn.BoolValue && InWarmup())
		CreateTimer(1.5, Timer_Respawn, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_Respawn(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client <= 0 || !IsClientInGame(client) || IsPlayerAlive(client))
		return Plugin_Stop;
	int team = GetClientTeam(client);
	if ((team != TEAM_T && team != TEAM_CT) || !InWarmup())
		return Plugin_Stop;
	CS_RespawnPlayer(client);
	if (g_cvStartMoney != null)
		SetEntProp(client, Prop_Send, "m_iAccount", g_cvStartMoney.IntValue);
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Mejor de la ronda
// ---------------------------------------------------------------------------

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	g_iRound++;
	g_iC4Carrier = 0;
	for (int i = 1; i <= MaxClients; i++)
	{
		g_iDamage[i] = 0;
		g_iKills[i] = 0;
	}
	g_bLive = g_cvRoundBest.BoolValue && IsLive();
}

public void Event_PlayerSpawn(Event event, const char[] name, bool dontBroadcast)
{
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0)
		g_iLastHp[client] = 100;
}

public void Event_PlayerHurt(Event event, const char[] name, bool dontBroadcast)
{
	int victim = GetClientOfUserId(event.GetInt("userid"));
	if (victim <= 0)
		return;
	int left = event.GetInt("health");
	int dmg = g_iLastHp[victim] - (left > 0 ? left : 0);   // sin pasar la vida que tenía
	g_iLastHp[victim] = left;
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	if (g_bLive && attacker > 0 && attacker != victim && dmg > 0 && GetClientTeam(attacker) != GetClientTeam(victim))
		g_iDamage[attacker] += dmg;
}

public void Event_RoundEnd(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bLive)
		return;
	g_bLive = false;
	int bestDmg, bestKills;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		if (g_iDamage[i] > 0 && (!bestDmg || g_iDamage[i] > g_iDamage[bestDmg]))
			bestDmg = i;
		if (g_iKills[i] > 0 && (!bestKills || g_iKills[i] > g_iKills[bestKills]))
			bestKills = i;
	}
	if (!bestDmg && !bestKills)
		return;
	char tag[32];
	Tag(tag, sizeof(tag));
	char msg[192];
	if (bestDmg && bestDmg == bestKills)
		Format(msg, sizeof(msg), "\x04%N\x01, %d kill%s y %d de daño.", bestDmg, g_iKills[bestDmg], g_iKills[bestDmg] == 1 ? "" : "s", g_iDamage[bestDmg]);
	else if (bestDmg && bestKills)
		Format(msg, sizeof(msg), "más daño \x04%N\x01 (%d) · más kills \x04%N\x01 (%d).", bestDmg, g_iDamage[bestDmg], bestKills, g_iKills[bestKills]);
	else if (bestDmg)
		Format(msg, sizeof(msg), "más daño \x04%N\x01 (%d).", bestDmg, g_iDamage[bestDmg]);
	else
		Format(msg, sizeof(msg), "más kills \x04%N\x01 (%d).", bestKills, g_iKills[bestKills]);
	PrintToChatAll("\x04[%s]\x01 Mejor de la ronda: %s", tag, msg);
	strcopy(g_sLastBest, sizeof(g_sLastBest), msg);
	ReplaceString(g_sLastBest, sizeof(g_sLastBest), "\x04", "");
	ReplaceString(g_sLastBest, sizeof(g_sLastBest), "\x01", "");
}

// ---------------------------------------------------------------------------
// C4 de un jugador quieto
// ---------------------------------------------------------------------------

int C4Of(int client)
{
	int w = GetPlayerWeaponSlot(client, 4);
	if (w <= 0)
		return -1;
	char cls[32];
	GetEdictClassname(w, cls, sizeof(cls));
	return StrEqual(cls, "weapon_c4") ? w : -1;
}

public void Event_FreezeEnd(Event event, const char[] name, bool dontBroadcast)
{
	if (g_cvRoundBest.BoolValue && !g_bLive)
		g_bLive = IsLive();   // el primer round del LO3: el reporter pasa a "en vivo" en el round_start
	int secs = g_cvC4Afk.IntValue;
	if (secs <= 0 || g_bOtherMode)
		return;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (IsClientInGame(i) && IsPlayerAlive(i) && GetClientTeam(i) == TEAM_T && C4Of(i) != -1)
		{
			g_iC4Carrier = GetClientUserId(i);
			GetClientAbsOrigin(i, g_fC4Pos);
			CreateTimer(float(secs), Timer_C4Afk, g_iRound, TIMER_FLAG_NO_MAPCHANGE);
			return;
		}
	}
}

public Action Timer_C4Afk(Handle timer, int round)
{
	if (round != g_iRound)
		return Plugin_Stop;
	int client = GetClientOfUserId(g_iC4Carrier);
	g_iC4Carrier = 0;
	if (client <= 0 || !IsClientInGame(client) || !IsPlayerAlive(client))
		return Plugin_Stop;
	int c4 = C4Of(client);
	if (c4 == -1)
		return Plugin_Stop;
	float pos[3];
	GetClientAbsOrigin(client, pos);
	if (GetVectorDistance(pos, g_fC4Pos) >= C4_MOVE)
		return Plugin_Stop;
	CS_DropWeapon(client, c4, true);
	char tag[32];
	Tag(tag, sizeof(tag));
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && GetClientTeam(i) == TEAM_T)
			PrintToChat(i, "\x04[%s]\x01 %N no se movió en %d segundos: tiró la C4.", tag, client, g_cvC4Afk.IntValue);
	PrintCenterText(client, "Tiraste la C4 por estar quieto.");
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Fin de la partida: liberar el servidor
// ---------------------------------------------------------------------------

public Action Timer_EndKick(Handle timer)
{
	if (g_sState[0] && !StrEqual(g_sState, "calentamiento") && !StrEqual(g_sState, "terminada"))
	{
		LogMessage("Fin de la partida: no se expulsa a nadie porque ya empezó otra (%s).", g_sState);
		return Plugin_Stop;
	}
	ServerCommand("sm_rpw");   // csstv_password la guarda para los mapas siguientes; con matchmaking no hace nada
	char tag[32];
	Tag(tag, sizeof(tag));
	int n;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (IsClientInGame(i) && !IsFakeClient(i) && !IsClientSourceTV(i))
		{
			KickClient(i, "[%s] La partida terminó. ¡Gracias por jugar!", tag);
			n++;
		}
	}
	char map[64];
	if (!GetNextMap(map, sizeof(map)) || !map[0] || !IsMapValid(map))
		GetCurrentMap(map, sizeof(map));
	LogMessage("Fin de la partida: contraseña nueva, %d expulsados y cambio a %s.", n, map);
	DataPack pack;
	CreateDataTimer(1.0, Timer_EndMap, pack, TIMER_FLAG_NO_MAPCHANGE);
	pack.WriteString(map);
	return Plugin_Stop;
}

public Action Timer_EndMap(Handle timer, DataPack pack)
{
	char map[64];
	pack.Reset();
	pack.ReadString(map, sizeof(map));
	ForceChangeLevel(map, "CMLeague: fin de la partida");
	return Plugin_Stop;
}
