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
 * Desde la 1.1.0 (plan docs/bitacora/2026-11-02-qol-tanda-3):
 *   - quien se va en vivo y vuelve en la misma mitad recupera su plata y, si estaba vivo, su equipo;
 *   - csstv_qol_eq segundos antes de que termine el freezetime, cada equipo ve qué tiene cada uno (y !eq);
 *   - "Fulano: 1 vs 3" en el centro para los muertos y los espectadores, y en el chat si lo gana;
 *   - !nades en el calentamiento: granadas infinitas, trayectoria visible y !rethrow.
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
#include <sdkhooks>

#define PLUGIN_VERSION "1.1.0"
#define AMMO_HE    11
#define AMMO_FLASH 12
#define AMMO_SMOKE 13
#define TEAM_T  2
#define TEAM_CT 3
#define C4_MOVE 32.0   // unidades que tiene que moverse para no contar como quieto

public Plugin myinfo =
{
	name = "CSSTV QOL",
	author = "CMLeague",
	description = "Calentamiento, mejor de la ronda, C4 de un quieto, reconexión, equipamiento, clutch y práctica de granadas",
	version = PLUGIN_VERSION,
	url = ""
};

ConVar g_cvRespawn;
ConVar g_cvRoundBest;
ConVar g_cvC4Afk;
ConVar g_cvEndKick;
ConVar g_cvRestore;
ConVar g_cvEq;
ConVar g_cvClutch;
ConVar g_cvNades;
ConVar g_cvFreezeTime;
ConVar g_cvStartMoney;
ConVar g_cvTag;

char g_sLastClutch[64];             // último clutch anunciado, para sm_qol_status
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

StringMap g_hSaved;                 // SteamID -> plata y equipo de quien se fue en vivo
int g_iHalf;                        // sube en cada medio tiempo: lo guardado vale solo en la misma mitad
int g_iClutch[4];                   // por lado: userid del último vivo, ya anunciado
int g_iClutchVs[4];
bool g_bNades[MAXPLAYERS + 1];
float g_fThrowPos[MAXPLAYERS + 1][3];
float g_fThrowAng[MAXPLAYERS + 1][3];
char g_sThrowWeapon[MAXPLAYERS + 1][24];
int g_iBeam;
int g_iHalo;

public void OnPluginStart()
{
	CreateConVar("csstv_qol_version", PLUGIN_VERSION, "Versión de CSSTV QOL.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvRespawn   = CreateConVar("csstv_qol_warmup_respawn", "1", "Reaparecer a los 1,5 s en el calentamiento del reporter.", _, true, 0.0, true, 1.0);
	g_cvRoundBest = CreateConVar("csstv_qol_round_best", "1", "Con la partida en vivo, decir al final de cada ronda quién hizo más daño y más kills.", _, true, 0.0, true, 1.0);
	g_cvC4Afk     = CreateConVar("csstv_qol_c4_afk", "20", "Segundos después del freezetime: si quien tiene la C4 no se movió, la tira (0 = no).", _, true, 0.0, true, 120.0);
	g_cvEndKick   = CreateConVar("csstv_qol_end_kick", "40", "Segundos después del fin de la partida: contraseña al azar, expulsar a todos y cambiar de mapa (0 = no). Que le dé tiempo a la SourceTV de mostrar el final.", _, true, 0.0, true, 120.0);
	g_cvRestore   = CreateConVar("csstv_qol_restore", "1", "Quien se va en vivo y vuelve en la misma mitad recupera su plata y su equipo.", _, true, 0.0, true, 1.0);
	g_cvEq        = CreateConVar("csstv_qol_eq", "6", "Segundos antes del fin del freezetime para mostrarle a cada equipo qué tiene cada uno (0 = no; !eq siempre).", _, true, 0.0, true, 60.0);
	g_cvClutch    = CreateConVar("csstv_qol_clutch", "1", "Anunciar los clutch (1 vs 2 o más) a los muertos y los espectadores.", _, true, 0.0, true, 1.0);
	g_cvNades     = CreateConVar("csstv_qol_nades", "1", "Permitir !nades (práctica de granadas) en el calentamiento.", _, true, 0.0, true, 1.0);
	AutoExecConfig(true, "csstv_qol");
	g_cvFreezeTime = FindConVar("mp_freezetime");
	g_hSaved = new StringMap();
	RegConsoleCmd("sm_eq", Cmd_Eq, "Qué tiene cada uno de tu equipo: armas, chaleco, kit, granadas y plata.");
	RegConsoleCmd("sm_nades", Cmd_Nades, "Práctica de granadas en el calentamiento: infinitas y con la trayectoria.");
	RegConsoleCmd("sm_rethrow", Cmd_Rethrow, "Práctica de granadas: volver al lugar y la mira de la última que tiraste.");
	g_cvStartMoney = FindConVar("mp_startmoney");

	HookEvent("player_death", Event_PlayerDeath);
	HookEvent("player_hurt", Event_PlayerHurt);
	HookEvent("player_spawn", Event_PlayerSpawn);
	HookEvent("player_team", Event_PlayerTeam);
	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	HookEvent("round_freeze_end", Event_FreezeEnd, EventHookMode_PostNoCopy);
	HookEvent("round_end", Event_RoundEnd);
	RegAdminCmd("sm_qol_status", Cmd_Status, ADMFLAG_GENERIC, "Estado de CSSTV QOL: qué lee del reporter y de los otros modos.");
	CreateTimer(1.0, Timer_State, _, TIMER_REPEAT);
}

public Action Cmd_Status(int client, int args)
{
	ReplyToCommand(client, "[QOL] v%s · reporter: %s · otro modo: %s · en vivo esta ronda: %s · último: %s · clutch: %s", PLUGIN_VERSION,
		g_sState[0] ? g_sState : "-", g_bOtherMode ? "sí" : "no", g_bLive ? "sí" : "no", g_sLastBest[0] ? g_sLastBest : "-", g_sLastClutch[0] ? g_sLastClutch : "-");
	return Plugin_Handled;
}

/** ServerCommandEx desde un timer y no desde los eventos. */
public Action Timer_State(Handle timer)
{
	bool wasOver = StrEqual(g_sState, "terminada");
	bool wasHalf = StrEqual(g_sState, "medio tiempo");
	ReporterState(g_sState, sizeof(g_sState));
	if (!wasHalf && StrEqual(g_sState, "medio tiempo"))
		g_iHalf++;
	if (!StrEqual(g_sState, "en vivo") && !StrEqual(g_sState, "medio tiempo"))
		g_hSaved.Clear();   // fuera de una partida no hay nada que devolver
	if (!wasOver && StrEqual(g_sState, "terminada") && g_cvEndKick.IntValue > 0)
		CreateTimer(g_cvEndKick.FloatValue - 1.0, Timer_EndKick, _, TIMER_FLAG_NO_MAPCHANGE);   // el estado se lee con hasta 1 s de atraso
	g_bOtherMode = ModeOn("sm_retake") || ModeOn("sm_2v2") || ModeOn("sm_dm");
	if (!InWarmup())
		for (int i = 1; i <= MaxClients; i++)
			if (g_bNades[i])
				Nades_Off(i, true);
	return Plugin_Continue;
}

public void OnMapStart()
{
	g_iBeam = PrecacheModel("materials/sprites/laser.vmt");
	g_iHalo = PrecacheModel("materials/sprites/halo01.vmt");
}

public void OnClientDisconnect(int client)
{
	Restore_Save(client);
	g_bNades[client] = false;
	g_sThrowWeapon[client][0] = '\0';
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
	if (g_cvClutch.BoolValue && IsLive())
		RequestFrame(Frame_Clutch);
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
	for (int t = 0; t < 4; t++)
		g_iClutch[t] = 0;
	if (g_cvEq.IntValue > 0 && IsLive() && g_cvFreezeTime != null)
	{
		float wait = g_cvFreezeTime.FloatValue - g_cvEq.FloatValue;
		CreateTimer(wait < 2.0 ? 2.0 : wait, Timer_Eq, g_iRound, TIMER_FLAG_NO_MAPCHANGE);
	}
}

public void Event_PlayerSpawn(Event event, const char[] name, bool dontBroadcast)
{
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0)
		g_iLastHp[client] = 100;
	if (client > 0 && g_cvRestore.BoolValue && IsLive())
		CreateTimer(0.3, Timer_Restore, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);   // después de las armas de la aparición
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
	Clutch_RoundEnd(event.GetInt("winner"));
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

// ---------------------------------------------------------------------------
// Volver con tu plata y tu equipo
// ---------------------------------------------------------------------------

/** SteamID; los bots (solo en pruebas) por nombre. */
bool RestoreKey(int client, char[] key, int len)
{
	if (IsFakeClient(client))
	{
		Format(key, len, "bot:%N", client);
		return true;
	}
	return GetClientAuthId(client, AuthId_Steam2, key, len) && !StrEqual(key, "STEAM_ID_PENDING");
}

int Ammo(int client, int idx)
{
	return GetEntProp(client, Prop_Send, "m_iAmmo", _, idx);
}

/** Al irse en vivo: "mitad|plata|vivo|chaleco|casco|kit|HE|FB|SM|arma1,arma2". */
void Restore_Save(int client)
{
	if (!g_cvRestore.BoolValue || !IsClientInGame(client) || !IsLive())
		return;
	int team = GetClientTeam(client);
	if (team != TEAM_T && team != TEAM_CT)
		return;
	char key[64];
	if (!RestoreKey(client, key, sizeof(key)))
		return;
	bool alive = IsPlayerAlive(client);
	char guns[96], cls[32];
	if (alive)
	{
		for (int slot = 0; slot <= 1; slot++)
		{
			int w = GetPlayerWeaponSlot(client, slot);
			if (w <= 0)
				continue;
			GetEdictClassname(w, cls, sizeof(cls));
			if (guns[0])
				StrCat(guns, sizeof(guns), ",");
			StrCat(guns, sizeof(guns), cls);
		}
	}
	char val[160];
	Format(val, sizeof(val), "%d|%d|%d|%d|%d|%d|%d|%d|%d|%s", g_iHalf, GetEntProp(client, Prop_Send, "m_iAccount"), alive,
		alive ? GetEntProp(client, Prop_Send, "m_ArmorValue") : 0, alive ? GetEntProp(client, Prop_Send, "m_bHasHelmet") : 0,
		alive && team == TEAM_CT ? GetEntProp(client, Prop_Send, "m_bHasDefuser") : 0,
		alive ? Ammo(client, AMMO_HE) : 0, alive ? Ammo(client, AMMO_FLASH) : 0, alive ? Ammo(client, AMMO_SMOKE) : 0, guns);
	g_hSaved.SetString(key, val);
}

public Action Timer_Restore(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client <= 0 || !IsClientInGame(client) || !IsPlayerAlive(client))
		return Plugin_Stop;
	char key[64], val[160];
	if (!RestoreKey(client, key, sizeof(key)) || !g_hSaved.GetString(key, val, sizeof(val)))
		return Plugin_Stop;
	g_hSaved.Remove(key);
	char f[10][96];
	if (ExplodeString(val, "|", f, sizeof(f), sizeof(f[])) < 9 || StringToInt(f[0]) != g_iHalf)
		return Plugin_Stop;   // se fue en la otra mitad: ya empezó de cero
	int money = StringToInt(f[1]);
	if (money > GetEntProp(client, Prop_Send, "m_iAccount"))
		SetEntProp(client, Prop_Send, "m_iAccount", money);
	char tag[32];
	Tag(tag, sizeof(tag));
	if (!StringToInt(f[2]))
	{
		PrintToChat(client, "\x04[%s]\x01 Volviste: recuperaste tu plata ($%d).", tag, money);
		return Plugin_Stop;
	}
	if (f[9][0])
	{
		char guns[2][32];
		int n = ExplodeString(f[9], ",", guns, sizeof(guns), sizeof(guns[]));
		for (int g = 0; g < n; g++)
		{
			int slot = StrEqual(guns[g], "weapon_glock") || StrEqual(guns[g], "weapon_usp") || StrEqual(guns[g], "weapon_p228")
				|| StrEqual(guns[g], "weapon_deagle") || StrEqual(guns[g], "weapon_elite") || StrEqual(guns[g], "weapon_fiveseven") ? 1 : 0;
			int old = GetPlayerWeaponSlot(client, slot);
			if (old > 0)
			{
				RemovePlayerItem(client, old);
				AcceptEntityInput(old, "Kill");
			}
			GivePlayerItem(client, guns[g]);
		}
	}
	SetEntProp(client, Prop_Send, "m_ArmorValue", StringToInt(f[3]));
	SetEntProp(client, Prop_Send, "m_bHasHelmet", StringToInt(f[4]));
	if (GetClientTeam(client) == TEAM_CT)
		SetEntProp(client, Prop_Send, "m_bHasDefuser", StringToInt(f[5]));
	static const char nades[3][] = { "weapon_hegrenade", "weapon_flashbang", "weapon_smokegrenade" };
	for (int k = 0; k < 3; k++)
		for (int c = Ammo(client, AMMO_HE + k); c < StringToInt(f[6 + k]); c++)
			GivePlayerItem(client, nades[k]);
	PrintToChat(client, "\x04[%s]\x01 Volviste: recuperaste tu plata y tu equipo.", tag);
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Equipamiento del equipo
// ---------------------------------------------------------------------------

void GunName(const char[] cls, char[] out, int len)
{
	static const char from[][] = { "weapon_ak47", "weapon_m4a1", "weapon_awp", "weapon_deagle", "weapon_galil", "weapon_famas",
		"weapon_sg552", "weapon_aug", "weapon_scout", "weapon_g3sg1", "weapon_sg550", "weapon_m249", "weapon_mp5navy", "weapon_ump45",
		"weapon_p90", "weapon_mac10", "weapon_tmp", "weapon_m3", "weapon_xm1014", "weapon_glock", "weapon_usp", "weapon_p228",
		"weapon_elite", "weapon_fiveseven" };
	static const char to[][] = { "AK-47", "M4A1", "AWP", "Deagle", "Galil", "FAMAS", "SG 552", "AUG", "Scout", "G3SG1", "SG 550",
		"M249", "MP5", "UMP", "P90", "MAC-10", "TMP", "M3", "XM1014", "Glock", "USP", "P228", "Dualies", "Five-SeveN" };
	for (int i = 0; i < sizeof(from); i++)
	{
		if (StrEqual(cls, from[i]))
		{
			strcopy(out, len, to[i]);
			return;
		}
	}
	strcopy(out, len, cls[StrContains(cls, "weapon_") == 0 ? 7 : 0]);
}

void EqLine(int client, char[] out, int len)
{
	char gun[24], pistol[24], cls[32];
	gun = "-";
	pistol = "-";
	int w = GetPlayerWeaponSlot(client, 0);
	if (w > 0)
	{
		GetEdictClassname(w, cls, sizeof(cls));
		GunName(cls, gun, sizeof(gun));
	}
	w = GetPlayerWeaponSlot(client, 1);
	if (w > 0)
	{
		GetEdictClassname(w, cls, sizeof(cls));
		GunName(cls, pistol, sizeof(pistol));
	}
	int armor = GetEntProp(client, Prop_Send, "m_ArmorValue");
	char extra[64];
	Format(extra, sizeof(extra), "%s%s", armor > 0 ? (GetEntProp(client, Prop_Send, "m_bHasHelmet") ? " · chaleco y casco" : " · chaleco") : " · sin chaleco",
		GetClientTeam(client) == TEAM_CT && GetEntProp(client, Prop_Send, "m_bHasDefuser") ? " · kit" : "");
	char nades[32];
	int he = Ammo(client, AMMO_HE), fb = Ammo(client, AMMO_FLASH), sm = Ammo(client, AMMO_SMOKE);
	if (he + fb + sm > 0)
		Format(nades, sizeof(nades), " ·%s%s%s", he ? " HE" : "", fb == 2 ? " 2 flash" : (fb ? " flash" : ""), sm ? " humo" : "");
	Format(out, len, "\x04%N\x01: %s · %s%s%s · $%d", client, gun, pistol, extra, nades, GetEntProp(client, Prop_Send, "m_iAccount"));
}

/** viewer 0: a la consola del servidor, sin colores (sm_eq por rcon). */
void Eq_ShowTo(int viewer, int team)
{
	char line[192];
	for (int i = 1; i <= MaxClients; i++)
	{
		if (IsClientInGame(i) && IsPlayerAlive(i) && GetClientTeam(i) == team)
		{
			EqLine(i, line, sizeof(line));
			if (viewer)
				PrintToChat(viewer, "%s", line);
			else
			{
				ReplaceString(line, sizeof(line), "\x04", "");
				ReplaceString(line, sizeof(line), "\x01", "");
				PrintToServer("[%s] %s", team == TEAM_T ? "T" : "CT", line);
			}
		}
	}
}

public Action Timer_Eq(Handle timer, int round)
{
	if (round != g_iRound || !IsLive())
		return Plugin_Stop;
	for (int v = 1; v <= MaxClients; v++)
	{
		if (IsClientInGame(v) && !IsFakeClient(v) && (GetClientTeam(v) == TEAM_T || GetClientTeam(v) == TEAM_CT))
		{
			PrintToChat(v, "\x04— Equipo —");
			Eq_ShowTo(v, GetClientTeam(v));
		}
	}
	return Plugin_Stop;
}

public Action Cmd_Eq(int client, int args)
{
	if (client == 0)
	{
		Eq_ShowTo(0, TEAM_T);
		Eq_ShowTo(0, TEAM_CT);
		return Plugin_Handled;
	}
	if (GetClientTeam(client) != TEAM_T && GetClientTeam(client) != TEAM_CT)
		return Plugin_Handled;
	Eq_ShowTo(client, GetClientTeam(client));
	return Plugin_Handled;
}

// ---------------------------------------------------------------------------
// Clutch
// ---------------------------------------------------------------------------

int AliveOn(int team, int &last)
{
	int n;
	last = 0;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (IsClientInGame(i) && IsPlayerAlive(i) && GetClientTeam(i) == team)
		{
			n++;
			last = i;
		}
	}
	return n;
}

public void Frame_Clutch(any data)
{
	for (int team = TEAM_T; team <= TEAM_CT; team++)
	{
		if (g_iClutch[team])
			continue;
		int last, other;
		int mine = AliveOn(team, last);
		int vs = AliveOn(team == TEAM_T ? TEAM_CT : TEAM_T, other);
		if (mine != 1 || vs < 2)
			continue;
		g_iClutch[team] = GetClientUserId(last);
		g_iClutchVs[team] = vs;
		Format(g_sLastClutch, sizeof(g_sLastClutch), "%N 1 vs %d", last, vs);
		for (int i = 1; i <= MaxClients; i++)
			if (IsClientInGame(i) && !IsFakeClient(i) && !IsPlayerAlive(i))
				PrintCenterText(i, "%N: 1 vs %d", last, vs);
	}
}

void Clutch_RoundEnd(int winner)
{
	if (winner != TEAM_T && winner != TEAM_CT || !g_iClutch[winner] || !IsLive())
		return;
	int client = GetClientOfUserId(g_iClutch[winner]);
	g_iClutch[winner] = 0;
	if (client <= 0)
		return;
	char tag[32];
	Tag(tag, sizeof(tag));
	PrintToChatAll("\x04[%s]\x01 ¡\x04%N\x01 ganó el clutch 1 vs %d!", tag, client, g_iClutchVs[winner]);
}

// ---------------------------------------------------------------------------
// Práctica de granadas
// ---------------------------------------------------------------------------

public Action Cmd_Nades(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (g_bNades[client])
	{
		Nades_Off(client, false);
		return Plugin_Handled;
	}
	if (!g_cvNades.BoolValue || !InWarmup())
	{
		ReplyToCommand(client, "[Granadas] Solo en el calentamiento.");
		return Plugin_Handled;
	}
	g_bNades[client] = true;
	if (IsPlayerAlive(client))
	{
		if (!Ammo(client, AMMO_HE)) GivePlayerItem(client, "weapon_hegrenade");
		while (Ammo(client, AMMO_FLASH) < 2) { if (GivePlayerItem(client, "weapon_flashbang") == -1) break; }
		if (!Ammo(client, AMMO_SMOKE)) GivePlayerItem(client, "weapon_smokegrenade");
	}
	PrintToChat(client, "\x04[Granadas]\x01 Práctica prendida: granadas infinitas y con trayectoria. !rethrow vuelve a donde tiraste la última. !nades para apagarla.");
	return Plugin_Handled;
}

void Nades_Off(int client, bool auto)
{
	g_bNades[client] = false;
	if (IsClientInGame(client))
		PrintToChat(client, "\x04[Granadas]\x01 Práctica apagada%s.", auto ? ": se terminó el calentamiento" : "");
}

public Action Cmd_Rethrow(int client, int args)
{
	if (client <= 0 || !g_bNades[client] || !IsPlayerAlive(client))
	{
		ReplyToCommand(client, "[Granadas] Primero prendé la práctica con !nades.");
		return Plugin_Handled;
	}
	if (!g_sThrowWeapon[client][0])
	{
		ReplyToCommand(client, "[Granadas] Todavía no tiraste ninguna.");
		return Plugin_Handled;
	}
	float zero[3];
	TeleportEntity(client, g_fThrowPos[client], g_fThrowAng[client], zero);
	FakeClientCommandEx(client, "use %s", g_sThrowWeapon[client]);
	return Plugin_Handled;
}

public void OnEntityCreated(int entity, const char[] classname)
{
	if (StrEqual(classname, "hegrenade_projectile") || StrEqual(classname, "flashbang_projectile") || StrEqual(classname, "smokegrenade_projectile"))
		RequestFrame(Frame_Projectile, EntIndexToEntRef(entity));
}

public void Frame_Projectile(int ref)
{
	int ent = EntRefToEntIndex(ref);
	if (ent == INVALID_ENT_REFERENCE)
		return;
	int owner = GetEntPropEnt(ent, Prop_Send, "m_hThrower");
	if (owner <= 0 || owner > MaxClients || !g_bNades[owner] || !IsClientInGame(owner))
		return;
	char cls[32];
	GetEdictClassname(ent, cls, sizeof(cls));
	ReplaceString(cls, sizeof(cls), "_projectile", "");
	Format(g_sThrowWeapon[owner], sizeof(g_sThrowWeapon[]), "weapon_%s", cls);
	GetClientAbsOrigin(owner, g_fThrowPos[owner]);
	GetClientEyeAngles(owner, g_fThrowAng[owner]);
	int color[4] = { 255, 200, 40, 255 };
	TE_SetupBeamFollow(ent, g_iBeam, g_iHalo, 6.0, 1.5, 1.5, 1, color);
	TE_SendToAll();
	CreateTimer(0.4, Timer_GiveNade, GetClientUserId(owner), TIMER_FLAG_NO_MAPCHANGE);
}

/** Devuelve la que tiró, si ya no le queda de ese tipo. */
public Action Timer_GiveNade(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client <= 0 || !g_bNades[client] || !IsPlayerAlive(client))
		return Plugin_Stop;
	int idx = StrEqual(g_sThrowWeapon[client], "weapon_hegrenade") ? AMMO_HE : (StrEqual(g_sThrowWeapon[client], "weapon_flashbang") ? AMMO_FLASH : AMMO_SMOKE);
	if (!Ammo(client, idx))
		GivePlayerItem(client, g_sThrowWeapon[client]);
	return Plugin_Stop;
}
