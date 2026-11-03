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
 * Desde la 1.2.0 (plan docs/bitacora/2026-11-02-qol-tanda-4):
 *   - quien queda último vivo de su equipo deja de escuchar a sus compañeros muertos hasta el final
 *     de la ronda (!voz lo desactiva para uno mismo);
 *   - al empezar cada ronda en vivo, los espectadores y la SourceTV ven la plata de cada equipo y si
 *     le alcanza para comprar todo (los coaches de csstv_coach no);
 *   - 4 kills y ace al final de la ronda; a los T, quién tiene la C4 y dónde quedó si muere con ella;
 *   - durante la partida: espectadores sin chat general ni voz para los jugadores, nombres bloqueados
 *     y aviso de quién se fue con su K/D; !admins.
 *   Los avisos de fin de ronda salen 0,3 s después: en el mismo instante no quedan en la demo.
 *   - 1.2.1: en el calentamiento los cuerpos desaparecen a los 2 s y las armas tiradas a los
 *     csstv_qol_warmup_cleanup segundos.
 *
 * El estado del mix se lee de la ConVar csstv_state del reporter (2.7.7 o más nuevo) y el de los otros
 * modos de sm_retake_on, sm_2v2_on y sm_dm_on. Si no existen, de las respuestas de sm_csstv_status y de
 * cada comando, que en estos servidores salen en la consola. Con retake, wingman o deathmatch prendidos
 * no hace nada: tienen sus propias reglas.
 * Sin licencia.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <cstrike>
#include <nextmap>
#include <sdkhooks>

#define PLUGIN_VERSION "1.2.1"
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
char g_sLastMoney[128];             // última plata mostrada a los espectadores, para sm_qol_status
char g_sLastAce[48];                // y los últimos 4 kills o ace, aviso de la C4 y despedida
char g_sLastC4[96];
char g_sLastBye[64];
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
ConVar g_cvMute;
ConVar g_cvSpecMoney;
bool g_bMuting[MAXPLAYERS + 1];                    // quedó solo y ya se silenció a sus compañeros muertos
bool g_bMuted[MAXPLAYERS + 1][MAXPLAYERS + 1];     // [vivo][muerto]: silenciado por el clutch
bool g_bVoiceOn[MAXPLAYERS + 1];                   // !voz: no silenciar

ConVar g_cvAce;
ConVar g_cvC4Info;
ConVar g_cvSpecChat;
ConVar g_cvSpecVoice;
ConVar g_cvLockNames;
ConVar g_cvGoodbye;
ConVar g_cvBlockKill;
ConVar g_cvCleanup;
int g_iCleaned;                                    // cuerpos y armas borrados en el calentamiento, para sm_qol_status
int g_iRoundKills[MAXPLAYERS + 1];                 // kills a rivales en esta ronda, para el ace
bool g_bSpecMuted[MAXPLAYERS + 1][MAXPLAYERS + 1]; // [jugador][espectador]: silenciado durante la partida
bool g_bNameRevert[MAXPLAYERS + 1];                // el próximo cambio de nombre es la vuelta al anterior

native bool CSSTV_IsCoach(int client);   // csstv_coach 1.1.0

public APLRes AskPluginLoad2(Handle myself, bool late, char[] error, int err_max)
{
	MarkNativeAsOptional("CSSTV_IsCoach");
	return APLRes_Success;
}

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
	g_cvMute      = CreateConVar("csstv_qol_clutch_mute", "1", "Quien queda último vivo de su equipo no escucha a sus compañeros muertos hasta el final de la ronda (!voz lo desactiva para uno).", _, true, 0.0, true, 1.0);
	g_cvSpecMoney = CreateConVar("csstv_qol_spec_money", "1", "Al empezar cada ronda en vivo, mostrarles a los espectadores y a la SourceTV la plata de cada equipo (no a los coaches).", _, true, 0.0, true, 1.0);
	g_cvAce       = CreateConVar("csstv_qol_ace", "1", "Con la partida en vivo, anunciar al final de la ronda a quien hizo 4 kills o un ace.", _, true, 0.0, true, 1.0);
	g_cvC4Info    = CreateConVar("csstv_qol_c4_info", "1", "A los T: quién tiene la C4 al empezar la ronda y dónde quedó si muere quien la llevaba.", _, true, 0.0, true, 1.0);
	g_cvSpecChat  = CreateConVar("csstv_qol_spec_chat", "1", "Durante la partida, los espectadores no escriben en el chat general (los admins sí).", _, true, 0.0, true, 1.0);
	g_cvSpecVoice = CreateConVar("csstv_qol_spec_voice", "1", "Durante la partida, los jugadores no escuchan a los espectadores (el coach sí, a su equipo).", _, true, 0.0, true, 1.0);
	g_cvLockNames = CreateConVar("csstv_qol_lock_names", "1", "Durante la partida no se puede cambiar el nombre.", _, true, 0.0, true, 1.0);
	g_cvCleanup   = CreateConVar("csstv_qol_warmup_cleanup", "8", "En el calentamiento: segundos para borrar un arma tirada que nadie levantó (los cuerpos, a los 2 s). 0 = no limpiar.", _, true, 0.0, true, 120.0);
	g_cvBlockKill = CreateConVar("csstv_qol_block_kill", "1", "Durante la partida, kill y explode (suicidarse por consola) no hacen nada.", _, true, 0.0, true, 1.0);
	g_cvGoodbye   = CreateConVar("csstv_qol_goodbye", "1", "Durante la partida, avisar quién se fue y con qué K/D.", _, true, 0.0, true, 1.0);
	AutoExecConfig(true, "csstv_qol");
	RegConsoleCmd("sm_voz", Cmd_Voz, "Cuando quedás solo: seguir escuchando (o no) a tus compañeros muertos.");
	RegConsoleCmd("sm_admins", Cmd_Admins, "Qué admins están conectados.");
	for (int i = 1; i <= MaxClients; i++)   // recarga del plugin con jugadores adentro
		if (IsClientInGame(i))
			OnClientPutInServer(i);
	AddCommandListener(Cmd_Say, "say");
	AddCommandListener(Cmd_Suicide, "kill");
	AddCommandListener(Cmd_Suicide, "explode");
	HookEvent("bomb_dropped", Event_BombDropped);
	HookEvent("player_changename", Event_ChangeName);
	HookEvent("player_disconnect", Event_Disconnect, EventHookMode_Pre);
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
	ReplyToCommand(client, "[QOL] v%s · reporter: %s · otro modo: %s · en vivo esta ronda: %s · último: %s · clutch: %s · plata: %s", PLUGIN_VERSION,
		g_sState[0] ? g_sState : "-", g_bOtherMode ? "sí" : "no", g_bLive ? "sí" : "no", g_sLastBest[0] ? g_sLastBest : "-", g_sLastClutch[0] ? g_sLastClutch : "-",
		g_sLastMoney[0] ? g_sLastMoney : "-");
	ReplyToCommand(client, "[QOL] 4k/ace: %s · C4: %s · se fue: %s · limpiados en el calentamiento: %d", g_sLastAce[0] ? g_sLastAce : "-", g_sLastC4[0] ? g_sLastC4 : "-", g_sLastBye[0] ? g_sLastBye : "-", g_iCleaned);
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
	SpecVoice_Update();
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
	Mute_Clear(client);
	for (int c = 1; c <= MaxClients; c++)
		if (g_bMuted[c][client])
		{
			g_bMuted[c][client] = false;
			if (IsClientInGame(c))
				SetListenOverride(c, client, Listen_Default);
		}
	g_bVoiceOn[client] = false;
	g_bNameRevert[client] = false;
	for (int i = 1; i <= MaxClients; i++)
		g_bSpecMuted[client][i] = g_bSpecMuted[i][client] = false;   // el slot que sigue empieza sin overrides
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
	ConVar state = FindConVar("csstv_state");   // reporter 2.7.7 o más nuevo: leerla no imprime nada en la consola
	if (state != null)
	{
		state.GetString(out, len);
		return;
	}
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

/** sm_retake_on, sm_2v2_on y sm_dm_on desde la 1.0.1 de cada modo; antes, la respuesta del comando. */
bool ModeOn(const char[] cmd)
{
	char name[32];
	Format(name, sizeof(name), "%s_on", cmd);
	ConVar on = FindConVar(name);
	if (on != null)
		return on.BoolValue;
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

/** Hay una partida en juego: cuchillo, LO3, en vivo o medio tiempo. */
bool InMatch()
{
	return !g_bOtherMode && (StrEqual(g_sState, "en vivo") || StrEqual(g_sState, "medio tiempo")
		|| StrEqual(g_sState, "iniciando (LO3)") || StrEqual(g_sState, "ronda de cuchillo"));
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
	if (IsLive() && attacker > 0 && attacker != victim && victim > 0 && GetClientTeam(attacker) != GetClientTeam(victim))
		g_iRoundKills[attacker]++;
	if (victim > 0 && g_cvRespawn.BoolValue && InWarmup())
		CreateTimer(1.5, Timer_Respawn, GetClientUserId(victim), TIMER_FLAG_NO_MAPCHANGE);
	if (victim > 0 && g_cvCleanup.IntValue > 0 && InWarmup())
		CreateTimer(2.0, Timer_RemoveBody, GetClientUserId(victim), TIMER_FLAG_NO_MAPCHANGE);
	if (g_cvClutch.BoolValue && IsLive())
		RequestFrame(Frame_Clutch);
	if (g_cvMute.BoolValue && IsLive())
		RequestFrame(Frame_Mute);
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

// ---------------------------------------------------------------------------
// Calentamiento: sin cuerpos ni armas tiradas. No hay reinicio de ronda que limpie el mapa.
// ---------------------------------------------------------------------------

public void OnClientPutInServer(int client)
{
	SDKHook(client, SDKHook_WeaponDropPost, Hook_WeaponDrop);
}

/** El cuerpo (cs_ragdoll) a los 2 s de morir. */
public Action Timer_RemoveBody(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client <= 0 || !IsClientInGame(client) || !InWarmup())
		return Plugin_Stop;
	// En v34 el jugador no tiene m_hRagdoll: se busca el cuerpo que apunta a él.
	int body = -1;
	while ((body = FindEntityByClassname(body, "cs_ragdoll")) != -1)
	{
		if (!HasEntProp(body, Prop_Send, "m_hPlayer") || GetEntPropEnt(body, Prop_Send, "m_hPlayer") != client)
			continue;
		AcceptEntityInput(body, "Kill");
		g_iCleaned++;
	}
	return Plugin_Stop;
}

/** Un arma tirada (al morir o con la G) se borra a los csstv_qol_warmup_cleanup segundos si nadie la levantó. La C4 no. */
public void Hook_WeaponDrop(int client, int weapon)
{
	if (weapon <= MaxClients || g_cvCleanup.IntValue <= 0 || !InWarmup() || !IsValidEntity(weapon))
		return;
	char cls[32];
	GetEdictClassname(weapon, cls, sizeof(cls));
	if (StrEqual(cls, "weapon_c4"))
		return;
	CreateTimer(g_cvCleanup.FloatValue, Timer_RemoveWeapon, EntIndexToEntRef(weapon), TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_RemoveWeapon(Handle timer, int ref)
{
	int weapon = EntRefToEntIndex(ref);
	if (weapon == INVALID_ENT_REFERENCE || !InWarmup() || GetEntPropEnt(weapon, Prop_Send, "m_hOwnerEntity") != -1)
		return Plugin_Stop;
	AcceptEntityInput(weapon, "Kill");
	g_iCleaned++;
	return Plugin_Stop;
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
		g_iRoundKills[i] = 0;
	}
	if (g_cvC4Info.BoolValue)
		CreateTimer(2.5, Timer_C4Holder, g_iRound, TIMER_FLAG_NO_MAPCHANGE);   // el estado se lee con hasta 2 s de atraso
	g_bLive = g_cvRoundBest.BoolValue && IsLive();
	for (int t = 0; t < 4; t++)
		g_iClutch[t] = 0;
	Mute_Clear();
	if (g_cvSpecMoney.BoolValue)
		CreateTimer(2.5, Timer_SpecMoney, g_iRound, TIMER_FLAG_NO_MAPCHANGE);   // el estado se lee con hasta 2 s de atraso
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
	Mute_Clear();
	// Los mensajes van 0,3 s después: lo que se manda en el mismo instante del fin de la ronda no queda en la demo.
	CreateTimer(0.3, Timer_RoundEndMsgs, event.GetInt("winner"), TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_RoundEndMsgs(Handle timer, int winner)
{
	Clutch_RoundEnd(winner);
	Ace_RoundEnd();
	RoundBest_Show();
	return Plugin_Stop;
}

void RoundBest_Show()
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
			if (IsClientInGame(i) && (IsClientSourceTV(i) || (!IsFakeClient(i) && !IsPlayerAlive(i))))
				PrintCenterText(i, "%N: 1 vs %d", last, vs);
	}
}

// ---------------------------------------------------------------------------
// Silencio en el clutch: el último vivo no escucha a sus compañeros muertos
// ---------------------------------------------------------------------------

public void Frame_Mute(any data)
{
	if (!g_cvMute.BoolValue || !IsLive())
		return;
	for (int team = TEAM_T; team <= TEAM_CT; team++)
	{
		int last, other;
		if (AliveOn(team, last) != 1 || AliveOn(team == TEAM_T ? TEAM_CT : TEAM_T, other) < 1)
			continue;
		if (IsFakeClient(last) || g_bVoiceOn[last] || g_bMuting[last])
			continue;
		int n;
		for (int i = 1; i <= MaxClients; i++)
		{
			if (i != last && IsClientInGame(i) && !IsFakeClient(i) && !IsPlayerAlive(i) && GetClientTeam(i) == team)
			{
				SetListenOverride(last, i, Listen_No);
				g_bMuted[last][i] = true;
				n++;
			}
		}
		g_bMuting[last] = true;
		if (n)
		{
			char tag[32];
			Tag(tag, sizeof(tag));
			PrintToChat(last, "\x04[%s]\x01 Quedaste solo: no escuchás a tus compañeros muertos hasta el final de la ronda. \x04!voz\x01 para escucharlos.", tag);
		}
	}
}

/** Devuelve la voz de todos los que silenció; con only > 0, solo los de ese jugador. */
void Mute_Clear(int only = 0)
{
	for (int c = 1; c <= MaxClients; c++)
	{
		if (only && c != only)
			continue;
		for (int i = 1; i <= MaxClients; i++)
		{
			if (!g_bMuted[c][i])
				continue;
			g_bMuted[c][i] = false;
			if (IsClientInGame(c) && IsClientInGame(i))
				SetListenOverride(c, i, Listen_Default);
		}
		g_bMuting[c] = false;
	}
}

public Action Cmd_Voz(int client, int args)
{
	if (client <= 0)
		return Plugin_Handled;
	g_bVoiceOn[client] = !g_bVoiceOn[client];
	if (g_bVoiceOn[client])
		Mute_Clear(client);
	char tag[32];
	Tag(tag, sizeof(tag));
	PrintToChat(client, "\x04[%s]\x01 %s", tag, g_bVoiceOn[client]
		? "Cuando quedes solo vas a seguir escuchando a tus compañeros muertos."
		: "Cuando quedes solo no vas a escuchar a tus compañeros muertos hasta el final de la ronda.");
	return Plugin_Handled;
}

// ---------------------------------------------------------------------------
// Plata de los dos equipos para los espectadores y la SourceTV
// ---------------------------------------------------------------------------

public Action Timer_SpecMoney(Handle timer, int round)
{
	if (round != g_iRound || !IsLive() || !g_cvSpecMoney.BoolValue)
		return Plugin_Stop;
	char ct[96], t[96];
	if (!Money_Line(TEAM_CT, ct, sizeof(ct)) || !Money_Line(TEAM_T, t, sizeof(t)))
		return Plugin_Stop;
	char tag[32];
	Tag(tag, sizeof(tag));
	Format(g_sLastMoney, sizeof(g_sLastMoney), "%s · %s", ct, t);
	ReplaceString(g_sLastMoney, sizeof(g_sLastMoney), "\x04", "");
	ReplaceString(g_sLastMoney, sizeof(g_sLastMoney), "\x01", "");
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		bool tv = IsClientSourceTV(i);
		if (!tv && (IsFakeClient(i) || GetClientTeam(i) > 1 || IsCoach(i)))
			continue;
		PrintToChat(i, "\x04[%s]\x01 Plata · %s · %s", tag, ct, t);
	}
	return Plugin_Stop;
}

/**
 * "CT $23.400 (compra completa)". A un jugador le alcanza para todo si tiene la plata del rifle, el
 * chaleco con casco (y el kit, si es CT), o si ya tiene un arma principal y $1000 para el chaleco.
 * Compra completa: a 4 de cada 5. Eco: a 1 de cada 5 o menos, con menos de $2000 de promedio.
 */
bool Money_Line(int team, char[] out, int len)
{
	int total, n, full;
	int need = team == TEAM_CT ? 4300 : 3500;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || GetClientTeam(i) != team)
			continue;
		int money = GetEntProp(i, Prop_Send, "m_iAccount");
		total += money;
		n++;
		if (money >= need || (IsPlayerAlive(i) && GetPlayerWeaponSlot(i, 0) != -1 && money >= 1000))
			full++;
	}
	if (!n)
		return false;
	char label[24], amount[16];
	if (full * 5 >= n * 4)
		strcopy(label, sizeof(label), "compra completa");
	else if (full * 5 <= n && total / n < 2000)
		strcopy(label, sizeof(label), "eco");
	else
		strcopy(label, sizeof(label), "compra parcial");
	Thousands(total, amount, sizeof(amount));
	Format(out, len, "\x04%s\x01 $%s (%s)", team == TEAM_CT ? "CT" : "T", amount, label);
	return true;
}

/** 23400 -> "23.400" */
void Thousands(int value, char[] out, int len)
{
	if (value < 1000)
		Format(out, len, "%d", value);
	else
		Format(out, len, "%d.%03d", value / 1000, value % 1000);
}

bool IsCoach(int client)
{
	return LibraryExists("csstv_coach") && CSSTV_IsCoach(client);
}

// ---------------------------------------------------------------------------
// 4 kills y ace
// ---------------------------------------------------------------------------

void Ace_RoundEnd()
{
	if (!g_cvAce.BoolValue)
		return;
	char tag[32];
	Tag(tag, sizeof(tag));
	for (int i = 1; i <= MaxClients; i++)
	{
		int k = g_iRoundKills[i];
		g_iRoundKills[i] = 0;
		if (k < 4 || !IsClientInGame(i))
			continue;
		if (k >= 5)
			PrintToChatAll("\x04[%s]\x01 ¡\x04%N\x01 hizo un \x04ACE\x01!", tag, i);
		else
			PrintToChatAll("\x04[%s]\x01 \x04%N\x01 hizo 4 kills en la ronda.", tag, i);
		Format(g_sLastAce, sizeof(g_sLastAce), "%N %d", i, k);
	}
}

// ---------------------------------------------------------------------------
// La C4: quién la tiene y dónde quedó
// ---------------------------------------------------------------------------

public Action Timer_C4Holder(Handle timer, int round)
{
	if (round != g_iRound || !IsLive())
		return Plugin_Stop;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (IsClientInGame(i) && IsPlayerAlive(i) && GetClientTeam(i) == TEAM_T && C4Of(i) != -1)
		{
			char tag[32];
			Tag(tag, sizeof(tag));
			Format(g_sLastC4, sizeof(g_sLastC4), "la tiene %N", i);
			for (int j = 1; j <= MaxClients; j++)
				if (IsClientInGame(j) && GetClientTeam(j) == TEAM_T)
					PrintToChat(j, "\x04[%s]\x01 La C4 la tiene \x04%N\x01.", tag, i);
			break;
		}
	}
	return Plugin_Stop;
}

public void Event_BombDropped(Event event, const char[] name, bool dontBroadcast)
{
	if (g_cvC4Info.BoolValue && IsLive())
		RequestFrame(Frame_BombDropped, event.GetInt("userid"));   // al morir, la C4 cae antes de que cuente como muerto
}

public void Frame_BombDropped(int userid)
{
	int client = GetClientOfUserId(userid);
	if (client <= 0 || !IsClientInGame(client) || IsPlayerAlive(client))
		return;
	char place[64], tag[32];
	PlaceOf(client, place, sizeof(place));
	Tag(tag, sizeof(tag));
	Format(g_sLastC4, sizeof(g_sLastC4), "%N murió con la C4 en %s", client, place[0] ? place : "-");
	for (int j = 1; j <= MaxClients; j++)
	{
		if (!IsClientInGame(j) || GetClientTeam(j) != TEAM_T)
			continue;
		if (place[0])
			PrintToChat(j, "\x04[%s]\x01 %N murió con la C4: quedó en \x04%s\x01.", tag, client, place);
		else
			PrintToChat(j, "\x04[%s]\x01 %N murió con la C4: quedó donde cayó.", tag, client);
	}
}

/** Lugar del mapa donde está el jugador (el del radar), con los más comunes en castellano. */
void PlaceOf(int client, char[] out, int len)
{
	out[0] = '\0';
	if (!HasEntProp(client, Prop_Send, "m_szLastPlaceName"))
		return;
	GetEntPropString(client, Prop_Send, "m_szLastPlaceName", out, len);
	static const char from[][] = { "BombsiteA", "BombsiteB", "BombsiteC", "CTSpawn", "TSpawn", "Middle", "LongA", "ShortA", "Tunnels", "UpperTunnel", "LowerTunnel", "Catwalk", "Ramp", "Bridge" };
	static const char to[][]   = { "el sitio A", "el sitio B", "el sitio C", "la base CT", "la base T", "Mid", "Long A", "Short A", "Túneles", "Túnel de arriba", "Túnel de abajo", "Catwalk", "la rampa", "el puente" };
	for (int i = 0; i < sizeof(from); i++)
	{
		if (StrEqual(out, from[i]))
		{
			strcopy(out, len, to[i]);
			return;
		}
	}
}

// ---------------------------------------------------------------------------
// Espectadores durante la partida: sin chat general y sin voz para los jugadores
// ---------------------------------------------------------------------------

bool IsSpectator(int client)
{
	return IsClientInGame(client) && !IsFakeClient(client) && GetClientTeam(client) <= 1;
}

public Action Cmd_Say(int client, const char[] command, int argc)
{
	if (client <= 0 || !g_cvSpecChat.BoolValue || !IsSpectator(client) || !InMatch())
		return Plugin_Continue;
	if (CheckCommandAccess(client, "csstv_spec_chat", ADMFLAG_CHAT))
		return Plugin_Continue;
	char msg[8];
	GetCmdArg(1, msg, sizeof(msg));
	if (msg[0] == '!' || msg[0] == '/')   // los comandos del chat siguen andando
		return Plugin_Continue;
	char tag[32];
	Tag(tag, sizeof(tag));
	PrintToChat(client, "\x04[%s]\x01 Durante la partida los espectadores no escriben en el chat general.", tag);
	return Plugin_Handled;
}

/** Cada segundo, desde Timer_State. El coach queda afuera: su voz la maneja csstv_coach. */
void SpecVoice_Update()
{
	bool on = g_cvSpecVoice.BoolValue && InMatch();
	for (int s = 1; s <= MaxClients; s++)
	{
		bool mute = on && IsSpectator(s) && !IsCoach(s);
		for (int p = 1; p <= MaxClients; p++)
		{
			if (p == s)
				continue;
			bool want = mute && IsClientInGame(p) && !IsFakeClient(p) && GetClientTeam(p) > 1;
			if (want == g_bSpecMuted[p][s])
				continue;
			g_bSpecMuted[p][s] = want;
			if (IsClientInGame(p) && IsClientInGame(s))
				SetListenOverride(p, s, want ? Listen_No : Listen_Default);
		}
	}
}

/** Suicidarse por consola durante la partida le regala la kill a nadie y le quita la plata al rival. */
public Action Cmd_Suicide(int client, const char[] command, int argc)
{
	if (client <= 0 || !g_cvBlockKill.BoolValue || !InMatch() || !IsClientInGame(client) || !IsPlayerAlive(client))
		return Plugin_Continue;
	char tag[32];
	Tag(tag, sizeof(tag));
	PrintToChat(client, "\x04[%s]\x01 Durante la partida no te podés suicidar con %s.", tag, command);
	return Plugin_Handled;
}

// ---------------------------------------------------------------------------
// Nombres bloqueados durante la partida
// ---------------------------------------------------------------------------

public void Event_ChangeName(Event event, const char[] name, bool dontBroadcast)
{
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client <= 0)
		return;
	if (g_bNameRevert[client])
	{
		g_bNameRevert[client] = false;
		return;
	}
	if (!g_cvLockNames.BoolValue || !InMatch())
		return;
	char old[MAX_NAME_LENGTH];
	event.GetString("oldname", old, sizeof(old));
	DataPack pack = new DataPack();
	pack.WriteCell(GetClientUserId(client));
	pack.WriteString(old);
	RequestFrame(Frame_NameRevert, pack);
}

public void Frame_NameRevert(DataPack pack)
{
	pack.Reset();
	int client = GetClientOfUserId(pack.ReadCell());
	char old[MAX_NAME_LENGTH];
	pack.ReadString(old, sizeof(old));
	delete pack;
	if (client <= 0 || !IsClientInGame(client))
		return;
	g_bNameRevert[client] = true;
	SetClientInfo(client, "name", old);
	if (HasEntProp(client, Prop_Data, "m_szNetname"))
		SetEntPropString(client, Prop_Data, "m_szNetname", old);
	char tag[32];
	Tag(tag, sizeof(tag));
	PrintToChat(client, "\x04[%s]\x01 Durante la partida no se puede cambiar el nombre.", tag);
}

// ---------------------------------------------------------------------------
// !admins y despedida
// ---------------------------------------------------------------------------

public Action Cmd_Admins(int client, int args)
{
	char names[256];
	int n;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsFakeClient(i) || !CheckCommandAccess(i, "csstv_admins_list", ADMFLAG_GENERIC, true))
			continue;
		Format(names, sizeof(names), "%s%s%N", names, n ? ", " : "", i);
		n++;
	}
	char tag[32];
	Tag(tag, sizeof(tag));
	if (n)
		ReplyToCommand(client, "[%s] Admins conectados: %s", tag, names);
	else
		ReplyToCommand(client, "[%s] No hay admins conectados. Usá !calladmin si necesitás uno.", tag);
	return Plugin_Handled;
}

public Action Event_Disconnect(Event event, const char[] name, bool dontBroadcast)
{
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client <= 0 || !IsClientInGame(client) || IsClientSourceTV(client) || !g_cvGoodbye.BoolValue || !InMatch())
		return Plugin_Continue;
	int team = GetClientTeam(client);
	if (team != TEAM_T && team != TEAM_CT)
		return Plugin_Continue;
	char tag[32];
	Tag(tag, sizeof(tag));
	Format(g_sLastBye, sizeof(g_sLastBye), "%N %d/%d", client, GetClientFrags(client), GetClientDeaths(client));
	PrintToChatAll("\x04[%s]\x01 %N se fue de la partida (%d/%d).", tag, client, GetClientFrags(client), GetClientDeaths(client));
	return Plugin_Continue;
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
