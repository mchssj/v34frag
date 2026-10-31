/**
 * v34 Deathmatch
 *
 * Deathmatch T contra CT para CS:S v34. Solo funciona en el mapa de sm_dm_map ($2000$) y ahí se prende
 * solo; a ese mapa se llega porque un admin lo cambia. No hay rondas: nadie gana y el juego sigue hasta
 * que cambie el mapa. No envía nada a ningún lado y no depende de csstv_reporter.
 *
 * dm/rank.inc (ranking) y retake/chat.inc (colores).
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <sdkhooks>
#include <cstrike>
#include <clientprefs>
#undef REQUIRE_PLUGIN
#include <adminmenu>
#define REQUIRE_PLUGIN

#define PLUGIN_VERSION "1.0.0"
#define DM_PREFIX "{#verde}[DM]{#blanco}"
#define TEAM_T 2
#define TEAM_CT 3
#define ON_DELAY 3.0
#define EQUIP_DELAY 0.1
#define RESPAWN_RETRY 1.0
#define CLEAN_EVERY 5.0
#define HITGROUP_HEAD 1
#define SPAWN_MIN_DIST 64.0
#define GUN_COUNT_PRIMARY 8
#define GUN_COUNT_PISTOL 3

public Plugin myinfo =
{
	name = "v34 Deathmatch",
	author = "v34frag",
	description = "Deathmatch T contra CT, solo en su mapa",
	version = PLUGIN_VERSION,
	url = ""
};

static const char g_sPrimaryClass[GUN_COUNT_PRIMARY][] = { "weapon_ak47", "weapon_m4a1", "weapon_galil", "weapon_famas", "weapon_sg552", "weapon_aug", "weapon_awp", "weapon_scout" };
static const char g_sPrimaryName[GUN_COUNT_PRIMARY][] = { "AK-47", "M4A1", "Galil", "FAMAS", "SG 552", "AUG", "AWP", "Scout" };
static const int g_iPrimaryClip[GUN_COUNT_PRIMARY] = { 30, 30, 35, 25, 30, 30, 10, 10 };
static const char g_sPistolClass[GUN_COUNT_PISTOL][] = { "weapon_deagle", "weapon_usp", "weapon_glock" };
static const char g_sPistolName[GUN_COUNT_PISTOL][] = { "Deagle", "USP", "Glock" };
static const int g_iPistolClip[GUN_COUNT_PISTOL] = { 7, 12, 20 };

static const char g_sManaged[][] = { "mp_freezetime", "mp_roundtime", "mp_timelimit", "mp_maxrounds", "mp_winlimit", "mp_buytime", "mp_autoteambalance", "mp_limitteams", "mp_friendlyfire" };
char g_sManagedSaved[sizeof(g_sManaged)][32];

ConVar g_cvMap;
ConVar g_cvHsAll;
ConVar g_cvRespawn;
ConVar g_cvProtect;
ConVar g_cvKillHp;

bool g_bActive;
bool g_bHs[MAXPLAYERS + 1];
bool g_bProtected[MAXPLAYERS + 1];
int g_iPrimary[MAXPLAYERS + 1];
int g_iPistol[MAXPLAYERS + 1];
bool g_bSeenMenu[MAXPLAYERS + 1];
Handle g_hCookiePrimary, g_hCookiePistol, g_hCookieHs, g_hCookieSeen;
ArrayList g_aSpawns[2];    // [0] T, [1] CT -> { x, y, z, yaw }
TopMenu g_hAdminMenu;
TopMenuObject g_oMenuCat = INVALID_TOPMENUOBJECT;
#if defined DM_DEBUG
int g_iDbgDeaths, g_iDbgRoundEnds, g_iDbgBlocked, g_iDbgHeadKills;
int g_iDbgHits[8];
#endif

#include "retake/chat.inc"
#include "dm/rank.inc"

public void OnPluginStart()
{
	g_cvMap     = CreateConVar("sm_dm_map", "$2000$", "Único mapa donde funciona el deathmatch.");
	g_cvHsAll   = CreateConVar("sm_dm_hs", "0", "Solo cabeza para todos.", _, true, 0.0, true, 1.0);
	g_cvRespawn = CreateConVar("sm_dm_respawn", "1.0", "Segundos para reaparecer.", _, true, 0.1, true, 30.0);
	g_cvProtect = CreateConVar("sm_dm_protect", "1.5", "Segundos de protección al aparecer. Termina al disparar.", _, true, 0.0, true, 10.0);
	g_cvKillHp  = CreateConVar("sm_dm_kill_hp", "15", "Vida que da una baja.", _, true, 0.0, true, 100.0);
	CreateConVar("v34_dm_version", PLUGIN_VERSION, "Versión de v34 Deathmatch.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvHsAll.AddChangeHook(OnHsAllChanged);

	g_aSpawns[0] = new ArrayList(4);
	g_aSpawns[1] = new ArrayList(4);

	RegAdminCmd("sm_dm", Cmd_Mode, ADMFLAG_GENERIC, "Prende o apaga el deathmatch en su mapa. Uso: sm_dm <1|0>");
	RegConsoleCmd("sm_guns", Cmd_Guns, "Elegir armas del deathmatch.");
	RegConsoleCmd("sm_hs", Cmd_Hs, "Solo cabeza para tus tiros.");
	g_hCookiePrimary = RegClientCookie("dm_primary", "DM: arma principal", CookieAccess_Private);
	g_hCookiePistol = RegClientCookie("dm_pistol", "DM: pistola", CookieAccess_Private);
	g_hCookieHs = RegClientCookie("dm_hs", "DM: solo cabeza", CookieAccess_Private);
	g_hCookieSeen = RegClientCookie("dm_seen", "DM: ya vio el menú", CookieAccess_Private);

	HookEvent("player_spawn", Event_PlayerSpawn);
	HookEvent("player_death", Event_PlayerDeath);
	HookEvent("player_team", Event_PlayerTeam);
	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);

	static const char blockedBuy[][] = { "buy", "buymenu", "autobuy", "rebuy", "buyammo1", "buyammo2" };
	for (int i = 0; i < sizeof(blockedBuy); i++)
		AddCommandListener(Cmd_BlockBuy, blockedBuy[i]);
	static const char blockedMix[][] = { "sm_ready", "sm_live", "sm_rtv", "sm_nominate" };
	for (int i = 0; i < sizeof(blockedMix); i++)
		AddCommandListener(Cmd_BlockMix, blockedMix[i]);

	Rank_Init();
	CreateTimer(CLEAN_EVERY, Timer_Clean, _, TIMER_REPEAT);
	AutoExecConfig(true, "v34_dm");
	for (int i = 1; i <= MaxClients; i++)   // recarga del plugin con jugadores adentro
		if (IsClientInGame(i))
			SDKHook(i, SDKHook_TraceAttack, Hook_TraceAttack);
	TopMenu topmenu;
	if (LibraryExists("adminmenu") && ((topmenu = GetAdminTopMenu()) != null))
		OnAdminMenuReady(topmenu);
#if defined DM_DEBUG
	RegServerCmd("dm_debug_stats", Cmd_DebugStats);
#endif
}

public void OnPluginEnd()
{
	Rank_OnPluginEnd();
	if (g_bActive)
		Mode_RestoreCvars();
}

bool Mode_IsDmMap()
{
	char map[PLATFORM_MAX_PATH], want[PLATFORM_MAX_PATH];
	GetCurrentMap(map, sizeof(map));
	g_cvMap.GetString(want, sizeof(want));
	return StrEqual(map, want, false);
}

void Spawns_Collect(const char[] cls, int side)
{
	g_aSpawns[side].Clear();
	int ent = -1;
	while ((ent = FindEntityByClassname(ent, cls)) != -1)
	{
		float pos[3], ang[3], p[4];
		GetEntPropVector(ent, Prop_Data, "m_vecOrigin", pos);
		GetEntPropVector(ent, Prop_Data, "m_angRotation", ang);
		p[0] = pos[0]; p[1] = pos[1]; p[2] = pos[2]; p[3] = ang[1];
		g_aSpawns[side].PushArray(p);
	}
}

public void OnConfigsExecuted()
{
	if (Mode_IsDmMap())
		CreateTimer(ON_DELAY, Timer_TurnOn, 0, TIMER_FLAG_NO_MAPCHANGE);
}

public void OnMapEnd()
{
	if (g_bActive)
		Mode_Off();
}

public void OnClientPutInServer(int client)
{
	g_bHs[client] = false;
	g_bProtected[client] = false;
	g_iPrimary[client] = 0;
	g_iPistol[client] = 0;
	g_bSeenMenu[client] = false;
	SDKHook(client, SDKHook_TraceAttack, Hook_TraceAttack);
}

public void OnClientDisconnect(int client)
{
	Rank_OnClientDisconnect(client);
}

public void OnClientCookiesCached(int client)
{
	char value[8];
	GetClientCookie(client, g_hCookiePrimary, value, sizeof(value));
	int gun = StringToInt(value);
	g_iPrimary[client] = gun >= 0 && gun < GUN_COUNT_PRIMARY ? gun : 0;
	GetClientCookie(client, g_hCookiePistol, value, sizeof(value));
	gun = StringToInt(value);
	g_iPistol[client] = gun >= 0 && gun < GUN_COUNT_PISTOL ? gun : 0;
	GetClientCookie(client, g_hCookieHs, value, sizeof(value));
	g_bHs[client] = StringToInt(value) == 1;
	GetClientCookie(client, g_hCookieSeen, value, sizeof(value));
	g_bSeenMenu[client] = StringToInt(value) == 1;
}

// ---------------------------------------------------------------------------
// Prender y apagar
// ---------------------------------------------------------------------------

/** Si csstv_reporter tiene una partida en curso. Llamar desde un timer. Si no se puede leer, se asume que sí. */
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

public Action Cmd_Mode(int client, int args)
{
	char arg[8];
	GetCmdArg(1, arg, sizeof(arg));
	if (args != 1 || (!StrEqual(arg, "1") && !StrEqual(arg, "0")))
	{
		ReplyToCommand(client, "[DM] Uso: sm_dm <1|0>. Ahora está %s.", g_bActive ? "prendido" : "apagado");
		return Plugin_Handled;
	}
	if (StrEqual(arg, "0"))
	{
		if (g_bActive)
		{
			Mode_Off();
			ServerCommand("mp_restartgame 1");
			ChatAll("%s Deathmatch apagado.", DM_PREFIX);
		}
		ReplyToCommand(client, "[DM] Deathmatch apagado.");
		return Plugin_Handled;
	}
	if (!Mode_IsDmMap())
	{
		char want[PLATFORM_MAX_PATH];
		g_cvMap.GetString(want, sizeof(want));
		ReplyToCommand(client, "[DM] El deathmatch solo funciona en %s.", want);
		return Plugin_Handled;
	}
	if (g_bActive)
	{
		ReplyToCommand(client, "[DM] Ya está prendido.");
		return Plugin_Handled;
	}
	CreateTimer(0.1, Timer_TurnOn, client > 0 ? GetClientUserId(client) : 0, TIMER_FLAG_NO_MAPCHANGE);
	return Plugin_Handled;
}

public Action Timer_TurnOn(Handle timer, int userid)
{
	if (g_bActive || !Mode_IsDmMap())
		return Plugin_Stop;
	if (Mode_MixInProgress())
	{
		int client = GetClientOfUserId(userid);
		if (client > 0)
			Chat(client, "%s Hay un mix en curso: terminalo o cancelalo antes de prender el deathmatch.", DM_PREFIX);
		LogMessage("Hay un mix en curso: el deathmatch no se prende.");
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
	Mode_SetInt("mp_freezetime", 0);
	Mode_SetInt("mp_roundtime", 9);
	Mode_SetInt("mp_timelimit", 0);       // el mapa lo cambia un admin
	Mode_SetInt("mp_maxrounds", 0);
	Mode_SetInt("mp_winlimit", 0);
	Mode_SetInt("mp_buytime", 0);
	Mode_SetInt("mp_autoteambalance", 1);
	Mode_SetInt("mp_limitteams", 1);
	Mode_SetInt("mp_friendlyfire", 0);
	Spawns_Collect("info_player_terrorist", 0);
	Spawns_Collect("info_player_counterterrorist", 1);
	g_bActive = true;
	ChatAll("%s Deathmatch prendido. {#verde}!guns{#blanco} armas, {#verde}!hs{#blanco} solo cabeza, {#verde}!rank{#blanco} tu puesto.", DM_PREFIX);
	ServerCommand("mp_restartgame 1");
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
	g_bActive = false;
	Mode_RestoreCvars();
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && IsPlayerAlive(i))
			Protect_End(i);
}

public void OnHsAllChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	if (g_bActive)
		ChatAll("%s Solo cabeza para todos: {#amarillo}%s{#blanco}.", DM_PREFIX, cv.BoolValue ? "prendido" : "apagado");
}

// ---------------------------------------------------------------------------
// Sin rondas
// ---------------------------------------------------------------------------

/** No termina ninguna ronda. El arranque de partida se deja, porque el juego lo necesita para empezar. */
public Action CS_OnTerminateRound(float &delay, CSRoundEndReason &reason)
{
	if (!g_bActive || reason == CSRoundEnd_GameStart)
		return Plugin_Continue;
#if defined DM_DEBUG
	g_iDbgBlocked++;
#endif
	return Plugin_Handled;
}

public Action Cmd_BlockBuy(int client, const char[] command, int argc)
{
	return g_bActive ? Plugin_Stop : Plugin_Continue;
}

public Action Cmd_BlockMix(int client, const char[] command, int argc)
{
	if (!g_bActive)
		return Plugin_Continue;
	ReplyToCommand(client, "[DM] No disponible durante el deathmatch.");
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Aparecer
// ---------------------------------------------------------------------------

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return;
#if defined DM_DEBUG
	g_iDbgRoundEnds++;
#endif
	// Sin esto el reloj llega a 0 cada 9 minutos, y sin fin de ronda los que entran no aparecen.
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && GetClientTeam(i) >= TEAM_T && !IsPlayerAlive(i))
			CreateTimer(g_cvRespawn.FloatValue, Timer_Respawn, GetClientUserId(i), TIMER_FLAG_NO_MAPCHANGE);
}

public void Event_PlayerTeam(Event event, const char[] name, bool dontBroadcast)
{
	if (g_bActive && event.GetInt("team") >= TEAM_T)
		CreateTimer(g_cvRespawn.FloatValue, Timer_Respawn, event.GetInt("userid"), TIMER_FLAG_NO_MAPCHANGE);
}

public void Event_PlayerSpawn(Event event, const char[] name, bool dontBroadcast)
{
	if (g_bActive)
		CreateTimer(EQUIP_DELAY, Timer_Equip, event.GetInt("userid"), TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_Respawn(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (!g_bActive || client == 0 || GetClientTeam(client) < TEAM_T || IsPlayerAlive(client))
		return Plugin_Stop;
	// Quien recién eligió equipo todavía puede estar eligiendo modelo: se reintenta hasta que termine.
	if (!IsFakeClient(client) && GetEntProp(client, Prop_Send, "m_iClass") == 0)
	{
		CreateTimer(RESPAWN_RETRY, Timer_Respawn, userid, TIMER_FLAG_NO_MAPCHANGE);
		return Plugin_Stop;
	}
	CS_RespawnPlayer(client);
	return Plugin_Stop;
}

void Equip_Strip(int client)
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

/** El punto del equipo más lejos del rival vivo más cercano. */
bool Spawn_Pick(int client, float best[4])
{
	int side = GetClientTeam(client) == TEAM_T ? 0 : 1;
	if (g_aSpawns[side].Length == 0)
		return false;
	float bestScore = -1.0;
	for (int i = 0; i < g_aSpawns[side].Length; i++)
	{
		float p[4], pos[3];
		g_aSpawns[side].GetArray(i, p);
		pos[0] = p[0]; pos[1] = p[1]; pos[2] = p[2];
		float enemy = 999999.0, anyone = 999999.0;
		for (int o = 1; o <= MaxClients; o++)
		{
			if (o == client || !IsClientInGame(o) || !IsPlayerAlive(o))
				continue;
			float other[3];
			GetClientAbsOrigin(o, other);
			float d = GetVectorDistance(pos, other);
			if (d < anyone)
				anyone = d;
			if (GetClientTeam(o) != GetClientTeam(client) && d < enemy)
				enemy = d;
		}
		if (anyone < SPAWN_MIN_DIST)
			continue;
		if (enemy > bestScore)
		{
			bestScore = enemy;
			best = p;
		}
	}
	return bestScore >= 0.0;
}

public Action Timer_Equip(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (!g_bActive || client == 0 || !IsPlayerAlive(client) || GetClientTeam(client) < TEAM_T)
		return Plugin_Stop;
	float p[4];
	if (Spawn_Pick(client, p))
	{
		float pos[3], ang[3], stop[3];
		pos[0] = p[0]; pos[1] = p[1]; pos[2] = p[2];
		ang[1] = p[3];
		TeleportEntity(client, pos, ang, stop);
	}
	Equip_Strip(client);
	GivePlayerItem(client, "weapon_knife");
	GivePlayerItem(client, g_sPistolClass[g_iPistol[client]]);
	GivePlayerItem(client, g_sPrimaryClass[g_iPrimary[client]]);
	SetEntProp(client, Prop_Send, "m_ArmorValue", 100);
	SetEntProp(client, Prop_Send, "m_bHasHelmet", 1);
	SetEntProp(client, Prop_Send, "m_iAccount", 0);
	Protect_Start(client);
	if (!IsFakeClient(client) && !g_bSeenMenu[client] && AreClientCookiesCached(client))
	{
		g_bSeenMenu[client] = true;
		SetClientCookie(client, g_hCookieSeen, "1");
		Guns_Show(client);
	}
	return Plugin_Stop;
}

void Protect_Start(int client)
{
	float secs = g_cvProtect.FloatValue;
	if (secs <= 0.0)
		return;
	g_bProtected[client] = true;
	SetEntProp(client, Prop_Data, "m_takedamage", 0);
	SetEntityRenderMode(client, RENDER_TRANSCOLOR);
	SetEntityRenderColor(client, 255, 255, 255, 150);
	CreateTimer(secs, Timer_ProtectEnd, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
}

void Protect_End(int client)
{
	if (!g_bProtected[client])
		return;
	g_bProtected[client] = false;
	SetEntProp(client, Prop_Data, "m_takedamage", 2);
	SetEntityRenderColor(client, 255, 255, 255, 255);
}

public Action Timer_ProtectEnd(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client > 0 && IsPlayerAlive(client))
		Protect_End(client);
	return Plugin_Stop;
}

public Action OnPlayerRunCmd(int client, int &buttons, int &impulse, float vel[3], float angles[3], int &weapon)
{
	if (g_bActive && g_bProtected[client] && (buttons & IN_ATTACK))
		Protect_End(client);
	return Plugin_Continue;
}

// ---------------------------------------------------------------------------
// Solo cabeza y bajas
// ---------------------------------------------------------------------------

public Action Hook_TraceAttack(int victim, int &attacker, int &inflictor, float &damage, int &damagetype, int &ammotype, int hitbox, int hitgroup)
{
#if defined DM_DEBUG
	if (hitgroup >= 0 && hitgroup < 8)
		g_iDbgHits[hitgroup]++;
#endif
	if (!g_bActive || attacker <= 0 || attacker > MaxClients || hitgroup == HITGROUP_HEAD)
		return Plugin_Continue;
	if (!g_cvHsAll.BoolValue && !g_bHs[attacker])
		return Plugin_Continue;
	damage = 0.0;
	return Plugin_Handled;
}

public Action Cmd_Hs(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (g_cvHsAll.BoolValue)
	{
		Chat(client, "%s Solo cabeza ya está prendido para todos.", DM_PREFIX);
		return Plugin_Handled;
	}
	g_bHs[client] = !g_bHs[client];
	SetClientCookie(client, g_hCookieHs, g_bHs[client] ? "1" : "0");
	Chat(client, "%s Solo cabeza para tus tiros: {#amarillo}%s{#blanco}.", DM_PREFIX, g_bHs[client] ? "prendido" : "apagado");
	return Plugin_Handled;
}

void Kill_Reload(int client)
{
	int weapon = GetEntPropEnt(client, Prop_Send, "m_hActiveWeapon");
	if (weapon == -1)
		return;
	int clip = -1;
	if (weapon == GetPlayerWeaponSlot(client, CS_SLOT_PRIMARY))
		clip = g_iPrimaryClip[g_iPrimary[client]];
	else if (weapon == GetPlayerWeaponSlot(client, CS_SLOT_SECONDARY))
		clip = g_iPistolClip[g_iPistol[client]];
	if (clip > 0)
		SetEntProp(weapon, Prop_Send, "m_iClip1", clip);
}

public void Event_PlayerDeath(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return;
#if defined DM_DEBUG
	g_iDbgDeaths++;
	if (event.GetBool("headshot"))
		g_iDbgHeadKills++;
#endif
	int victim = GetClientOfUserId(event.GetInt("userid"));
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	if (victim > 0)
		CreateTimer(g_cvRespawn.FloatValue, Timer_Respawn, GetClientUserId(victim), TIMER_FLAG_NO_MAPCHANGE);
	if (attacker <= 0 || attacker == victim || !IsPlayerAlive(attacker))
		return;
	int health = GetClientHealth(attacker) + g_cvKillHp.IntValue;
	SetEntityHealth(attacker, health > 100 ? 100 : health);
	Kill_Reload(attacker);
}

public Action Timer_Clean(Handle timer)
{
	if (!g_bActive)
		return Plugin_Continue;
	char cls[32];
	int maxEnts = GetMaxEntities();
	for (int ent = MaxClients + 1; ent < maxEnts; ent++)
	{
		if (!IsValidEdict(ent) || !GetEdictClassname(ent, cls, sizeof(cls)))
			continue;
		if (StrContains(cls, "weapon_") == 0 && GetEntPropEnt(ent, Prop_Send, "m_hOwnerEntity") == -1)
			AcceptEntityInput(ent, "Kill");
	}
	return Plugin_Continue;
}

// ---------------------------------------------------------------------------
// !guns
// ---------------------------------------------------------------------------

public Action Cmd_Guns(int client, int args)
{
	if (client > 0 && IsClientInGame(client))
		Guns_Show(client);
	return Plugin_Handled;
}

void Guns_Show(int client)
{
	Menu menu = new Menu(Guns_Handler);
	menu.SetTitle("Armas del deathmatch (al reaparecer)");
	char label[48];
	Format(label, sizeof(label), "Principal: %s", g_sPrimaryName[g_iPrimary[client]]);
	menu.AddItem("p", label);
	Format(label, sizeof(label), "Pistola: %s", g_sPistolName[g_iPistol[client]]);
	menu.AddItem("s", label);
	menu.Display(client, MENU_TIME_FOREVER);
}

public int Guns_Handler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char info[4];
		menu.GetItem(item, info, sizeof(info));
		Menu sub = new Menu(Guns_SubHandler);
		bool primary = info[0] == 'p';
		sub.SetTitle(primary ? "Arma principal" : "Pistola");
		char key[8];
		int count = primary ? GUN_COUNT_PRIMARY : GUN_COUNT_PISTOL;
		for (int i = 0; i < count; i++)
		{
			Format(key, sizeof(key), "%s%d", info, i);
			sub.AddItem(key, primary ? g_sPrimaryName[i] : g_sPistolName[i]);
		}
		sub.ExitBackButton = true;
		sub.Display(client, MENU_TIME_FOREVER);
	}
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

public int Guns_SubHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char key[8];
		menu.GetItem(item, key, sizeof(key));
		if (key[0] == 'p')
		{
			g_iPrimary[client] = StringToInt(key[1]);
			SetClientCookie(client, g_hCookiePrimary, key[1]);
		}
		else
		{
			g_iPistol[client] = StringToInt(key[1]);
			SetClientCookie(client, g_hCookiePistol, key[1]);
		}
		Guns_Show(client);
	}
	else if (action == MenuAction_Cancel && item == MenuCancel_ExitBack)
		Guns_Show(client);
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

// ---------------------------------------------------------------------------
// !admin
// ---------------------------------------------------------------------------

public void OnLibraryRemoved(const char[] name)
{
	if (StrEqual(name, "adminmenu"))
	{
		g_hAdminMenu = null;
		g_oMenuCat = INVALID_TOPMENUOBJECT;
	}
}

public void OnAdminMenuCreated(Handle aTopMenu)
{
	TopMenu topmenu = TopMenu.FromHandle(aTopMenu);
	if (topmenu == g_hAdminMenu && g_oMenuCat != INVALID_TOPMENUOBJECT)
		return;
	g_oMenuCat = topmenu.AddCategory("v34dm", Menu_CategoryHandler);
}

public void OnAdminMenuReady(Handle aTopMenu)
{
	TopMenu topmenu = TopMenu.FromHandle(aTopMenu);
	if (g_oMenuCat == INVALID_TOPMENUOBJECT)
		OnAdminMenuCreated(topmenu);
	if (topmenu == g_hAdminMenu)
		return;
	g_hAdminMenu = topmenu;
	topmenu.AddItem("dm_toggle", Menu_ItemHandler, g_oMenuCat, "sm_dm", ADMFLAG_GENERIC);
	topmenu.AddItem("dm_hs", Menu_ItemHandler, g_oMenuCat, "sm_dm", ADMFLAG_GENERIC);
}

public void Menu_CategoryHandler(TopMenu topmenu, TopMenuAction action, TopMenuObject object_id, int param, char[] buffer, int maxlength)
{
	if (action == TopMenuAction_DisplayTitle || action == TopMenuAction_DisplayOption)
		strcopy(buffer, maxlength, "Deathmatch");
}

public void Menu_ItemHandler(TopMenu topmenu, TopMenuAction action, TopMenuObject object_id, int param, char[] buffer, int maxlength)
{
	char name[32];
	topmenu.GetObjName(object_id, name, sizeof(name));
	bool isToggle = StrEqual(name, "dm_toggle");
	if (action == TopMenuAction_DisplayOption)
	{
		if (isToggle)
			strcopy(buffer, maxlength, g_bActive ? "Apagar el deathmatch" : "Prender el deathmatch");
		else
			strcopy(buffer, maxlength, g_cvHsAll.BoolValue ? "Solo cabeza para todos: sí" : "Solo cabeza para todos: no");
	}
	else if (action == TopMenuAction_SelectOption)
	{
		if (isToggle)
			FakeClientCommand(param, "sm_dm %d", g_bActive ? 0 : 1);
		else
			g_cvHsAll.SetBool(!g_cvHsAll.BoolValue);
		if (g_hAdminMenu != null && g_oMenuCat != INVALID_TOPMENUOBJECT)
			g_hAdminMenu.DisplayCategory(g_oMenuCat, param);
	}
}

#if defined DM_DEBUG
public Action Cmd_DebugStats(int args)
{
	int t, ct, alive;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		if (GetClientTeam(i) == TEAM_T) t++;
		else if (GetClientTeam(i) == TEAM_CT) ct++;
		if (IsPlayerAlive(i) && GetClientTeam(i) >= TEAM_T) alive++;
	}
	PrintToServer("activo=%d muertes=%d cabeza=%d inicios_de_ronda=%d fines_bloqueados=%d T=%d CT=%d vivos=%d impactos=%d/%d/%d/%d/%d", g_bActive, g_iDbgDeaths, g_iDbgHeadKills, g_iDbgRoundEnds, g_iDbgBlocked, t, ct, alive, g_iDbgHits[0], g_iDbgHits[1], g_iDbgHits[2], g_iDbgHits[3], g_iDbgHits[4]);
	return Plugin_Handled;
}
#endif
