/**
 * CSSTV HUD
 *
 * Datos para el HUD de observer (plan docs/bitacora/2026-10-22-hud-observer):
 *   - le manda al relay, por UDP, lo que cambió de cada jugador como mucho cada csstv_hud_interval segundos;
 *   - cada csstv_hud_full segundos manda la foto completa y los nombres, por si se perdió un paquete;
 *   - las kills, la bomba y los cambios de fase de la ronda salen al instante;
 *   - no contesta pedidos: cuesta lo mismo con 1 o con 50 espectadores mirando el HUD.
 *
 * El retraso (tv_delay) lo aplica el relay, nunca el plugin: lo que sale de acá es en vivo.
 * Requiere la extensión Socket 3.0.1 (sfPlayer), que ya está en los dos servidores; el envío corre en el hilo
 * de la extensión. Independiente de csstv_reporter. Sin licencia. Sin csstv_hud_host no hace nada.
 *
 * Paquetes (texto; campos con |, jugadores con ;, nunca más de MAX_PACKET bytes):
 *   CMH1|<clave>|<secuencia>|F|<tv_delay>|<mapa>|<ronda>|<puntos T>|<puntos CT>|<fase>|<segundos>|<jugadores>
 *   CMH1|<clave>|<secuencia>|N|<uid>,<steamid>,<nombre>;…
 *   CMH1|<clave>|<secuencia>|D|<jugadores que cambiaron>
 *   CMH1|<clave>|<secuencia>|E|kill|<uid atacante>|<uid víctima>|<arma>|<headshot>|<uid asistente>|<asistió con flash>
 *        |<paredes atravesadas>|<atacante ciego>|<a través del humo>|<sin mira>   (lo agrega clientmod_deathnotice;
 *        sin ese plugin van en 0)
 *   CMH1|<clave>|<secuencia>|E|phase|<fase>|<segundos>          fase: freeze, live, planted, over
 *   CMH1|<clave>|<secuencia>|E|bomb|<plant|defuse|explode>|<uid>
 *   CMH1|<clave>|<secuencia>|E|end|<equipo ganador>|<motivo>
 * Jugador: uid,equipo,vivo,vida,chaleco,casco,kit,plata,principal,secundaria,en_mano,he,flash,humo,bomba,kills,
 *          muertes,daño de la ronda
 *
 * Compilación de depuración (HUD_DEBUG=): escribe cada paquete en logs/csstv_hud_AAAAMMDD.log.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <socket>

#define PLUGIN_VERSION "1.1.0"
#define TEAM_T         2
#define TEAM_CT        3
#define SLOT_C4        4
#define MAX_PACKET     1200
#define LINE_LEN       128
#define RETRY_SECONDS  10.0

public Plugin myinfo =
{
	name = "CSSTV HUD",
	author = "CMLeague",
	description = "Datos para el HUD de observer: cambios de los jugadores por UDP al relay",
	version = PLUGIN_VERSION,
	url = ""
};

ConVar g_cvEnabled;
ConVar g_cvHost;
ConVar g_cvPort;
ConVar g_cvKey;
ConVar g_cvInterval;
ConVar g_cvFull;
ConVar g_cvTvDelay;
ConVar g_cvFreezeTime;
ConVar g_cvRoundTime;
ConVar g_cvC4Timer;

// Socket UDP "conectado": la extensión resuelve el dominio en su hilo y después cada envío va directo.
Socket g_hSocket = null;
bool g_bConnected;
Handle g_hRetry = null;
Handle g_hTick = null;
char g_sHost[128];
int g_iPort;
char g_sKey[64];
char g_sLastError[64];

int g_iSeq;
int g_iPackets;
int g_iBytes;
float g_fLastSend;
float g_fLastFull;
bool g_bFullPending;

// Lo último que se mandó de cada jugador ("" = no estaba en T ni en CT).
char g_sLine[MAXPLAYERS + 1][LINE_LEN];
char g_sName[MAXPLAYERS + 1][MAX_NAME_LENGTH];
int g_iRoundDmg[MAXPLAYERS + 1];
int g_iLastHealth[MAXPLAYERS + 1];

char g_sPhase[12] = "live";
float g_fPhaseEnd;          // GetGameTime() en que termina la fase; 0 = sin reloj

static const char g_sNade[][] = { "weapon_hegrenade", "weapon_flashbang", "weapon_smokegrenade" };
int g_iNadeAmmo[3] = { -1, -1, -1 };   // índice de m_iAmmo de cada granada, se averigua la primera vez

#if defined HUD_DEBUG
char g_sLog[PLATFORM_MAX_PATH];
#endif

public void OnPluginStart()
{
	CreateConVar("csstv_hud_version", PLUGIN_VERSION, "Versión de CSSTV HUD.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvEnabled = CreateConVar("csstv_hud", "1", "1: manda los datos del HUD al relay. 0: no manda nada.", _, true, 0.0, true, 1.0);
	g_cvHost = CreateConVar("csstv_hud_host", "", "Dominio o IP del relay del HUD. Vacío: no manda nada.", FCVAR_PROTECTED);
	g_cvPort = CreateConVar("csstv_hud_port", "0", "Puerto UDP del relay del HUD.", _, true, 0.0, true, 65535.0);
	g_cvKey = CreateConVar("csstv_hud_key", "", "Clave compartida con el relay (va en cada paquete).", FCVAR_PROTECTED);
	g_cvInterval = CreateConVar("csstv_hud_interval", "0.25", "Cada cuántos segundos revisa qué cambió en los jugadores.", _, true, 0.1, true, 2.0);
	g_cvFull = CreateConVar("csstv_hud_full", "3", "Cada cuántos segundos manda la foto completa.", _, true, 1.0, true, 30.0);
	AutoExecConfig(true, "csstv_hud");

	g_cvHost.AddChangeHook(OnTargetChanged);
	g_cvPort.AddChangeHook(OnTargetChanged);
	g_cvKey.AddChangeHook(OnKeyChanged);
	g_cvInterval.AddChangeHook(OnIntervalChanged);
	g_cvEnabled.AddChangeHook(OnEnabledChanged);

	g_cvTvDelay = FindConVar("tv_delay");
	g_cvFreezeTime = FindConVar("mp_freezetime");
	g_cvRoundTime = FindConVar("mp_roundtime");
	g_cvC4Timer = FindConVar("mp_c4timer");

	HookEvent("player_spawn", Event_PlayerSpawn);
	HookEvent("player_hurt", Event_PlayerHurt);
	HookEvent("player_death", Event_PlayerDeath);
	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	HookEvent("round_freeze_end", Event_FreezeEnd, EventHookMode_PostNoCopy);
	HookEvent("round_end", Event_RoundEnd);
	HookEvent("bomb_planted", Event_BombPlanted);
	HookEvent("bomb_defused", Event_BombDefused);
	HookEvent("bomb_exploded", Event_BombExploded);

	RegAdminCmd("csstv_hud_status", Cmd_Status, ADMFLAG_RCON, "Estado del envío al relay del HUD.");

#if defined HUD_DEBUG
	char date[16];
	FormatTime(date, sizeof(date), "%Y%m%d");
	BuildPath(Path_SM, g_sLog, sizeof(g_sLog), "logs/csstv_hud_%s.log", date);
#endif

	StartTick();
}

public void OnConfigsExecuted()
{
	g_cvKey.GetString(g_sKey, sizeof(g_sKey));
	// En cada mapa se ejecuta el cfg: solo se reconecta si cambió el destino o si no hay socket.
	char host[128];
	g_cvHost.GetString(host, sizeof(host));
	if (g_hSocket == null || !StrEqual(host, g_sHost) || g_cvPort.IntValue != g_iPort)
		Reconnect();
}

public void OnMapStart()
{
	strcopy(g_sPhase, sizeof(g_sPhase), "live");
	g_fPhaseEnd = 0.0;
	g_bFullPending = true;
}

public void OnClientDisconnect(int client)
{
	if (g_sLine[client][0] != '\0')
		g_bFullPending = true;
	g_sLine[client][0] = '\0';
	g_sName[client][0] = '\0';
	g_iRoundDmg[client] = 0;
}

// ---------------------------------------------------------------------------------------------------------
// Socket
// ---------------------------------------------------------------------------------------------------------

public void OnTargetChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	Reconnect();
}

public void OnKeyChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	strcopy(g_sKey, sizeof(g_sKey), newValue);
}

public void OnEnabledChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	g_bFullPending = true;
}

void CloseSocket()
{
	if (g_hSocket != null)
		delete g_hSocket;
	g_bConnected = false;
}

void Reconnect()
{
	CloseSocket();
	if (g_hRetry != null)
		delete g_hRetry;

	g_cvHost.GetString(g_sHost, sizeof(g_sHost));
	TrimString(g_sHost);
	g_iPort = g_cvPort.IntValue;
	if (g_sHost[0] == '\0' || g_iPort <= 0)
	{
		strcopy(g_sLastError, sizeof(g_sLastError), "sin destino");
		return;
	}

	g_hSocket = SocketCreate(SOCKET_UDP, OnSocketError);
	if (g_hSocket == null)
	{
		strcopy(g_sLastError, sizeof(g_sLastError), "no se pudo crear el socket");
		ScheduleRetry();
		return;
	}
	strcopy(g_sLastError, sizeof(g_sLastError), "conectando");
	SocketConnect(g_hSocket, OnSocketConnected, OnSocketReceive, OnSocketDisconnected, g_sHost, g_iPort);
}

void ScheduleRetry()
{
	if (g_hRetry == null)
		g_hRetry = CreateTimer(RETRY_SECONDS, Timer_Retry);
}

public Action Timer_Retry(Handle timer)
{
	g_hRetry = null;
	Reconnect();
	return Plugin_Stop;
}

public void OnSocketConnected(Socket socket, any arg)
{
	if (socket != g_hSocket)
		return;
	g_bConnected = true;
	g_bFullPending = true;
	g_sLastError[0] = '\0';
	LogMessage("Enviando al relay %s:%d", g_sHost, g_iPort);
}

public void OnSocketReceive(Socket socket, const char[] data, const int size, any arg)
{
	// El relay no contesta nada.
}

public void OnSocketDisconnected(Socket socket, any arg)
{
	if (socket == g_hSocket)
	{
		g_hSocket = null;
		g_bConnected = false;
		strcopy(g_sLastError, sizeof(g_sLastError), "desconectado");
		ScheduleRetry();
	}
	delete socket;
}

public void OnSocketError(Socket socket, const int errorType, const int errorNum, any arg)
{
	if (socket == g_hSocket)
	{
		g_hSocket = null;
		g_bConnected = false;
		FormatEx(g_sLastError, sizeof(g_sLastError), "error %d (%d)", errorType, errorNum);
		LogError("Relay %s:%d: error %d (%d); se reintenta en %.0f s", g_sHost, g_iPort, errorType, errorNum, RETRY_SECONDS);
		ScheduleRetry();
	}
	delete socket;
}

void SendPacket(const char[] type, const char[] body)
{
	if (!g_bConnected || !g_cvEnabled.BoolValue)
		return;

	char buf[MAX_PACKET];
	int len = FormatEx(buf, sizeof(buf), "CMH1|%s|%d|%s|%s", g_sKey, ++g_iSeq, type, body);
	if (len >= sizeof(buf) - 1)
		LogError("Paquete %s recortado a %d bytes", type, len);
	SocketSend(g_hSocket, buf, len);
	g_iPackets++;
	g_iBytes += len;
	g_fLastSend = GetEngineTime();

#if defined HUD_DEBUG
	LogToFileEx(g_sLog, "%s", buf);
#endif
}

// ---------------------------------------------------------------------------------------------------------
// Revisión periódica
// ---------------------------------------------------------------------------------------------------------

public void OnIntervalChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	StartTick();
}

void StartTick()
{
	if (g_hTick != null)
		delete g_hTick;
	g_hTick = CreateTimer(g_cvInterval.FloatValue, Timer_Tick, _, TIMER_REPEAT);
}

public Action Timer_Tick(Handle timer)
{
	if (!g_bConnected || !g_cvEnabled.BoolValue || !AnyPlayer())
		return Plugin_Continue;

	if (g_bFullPending || GetEngineTime() - g_fLastFull >= g_cvFull.FloatValue)
		SendFull();
	else
		SendDelta();
	return Plugin_Continue;
}

bool InPlay(int client)
{
	if (!IsClientInGame(client))
		return false;
	int team = GetClientTeam(client);
	return team == TEAM_T || team == TEAM_CT;
}

bool AnyPlayer()
{
	for (int i = 1; i <= MaxClients; i++)
		if (InPlay(i))
			return true;
	return false;
}

void SendDelta()
{
	char body[MAX_PACKET], line[LINE_LEN], name[MAX_NAME_LENGTH];
	int len;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!InPlay(i))
		{
			if (g_sLine[i][0] != '\0')
			{
				SendFull();   // alguien salió o se fue a espectador
				return;
			}
			continue;
		}
		GetClientName(i, name, sizeof(name));
		if (g_sLine[i][0] == '\0' || !StrEqual(name, g_sName[i]))
		{
			SendFull();       // jugador nuevo o cambio de nombre: el relay necesita la lista de nombres
			return;
		}

		BuildLine(i, line, sizeof(line));
		if (StrEqual(line, g_sLine[i]))
			continue;
		strcopy(g_sLine[i], LINE_LEN, line);

		if (len + strlen(line) + 1 >= sizeof(body) - 100)
		{
			SendPacket("D", body);
			len = 0;
			body[0] = '\0';
		}
		len += FormatEx(body[len], sizeof(body) - len, "%s%s", len ? ";" : "", line);
	}
	if (len)
		SendPacket("D", body);
}

void SendFull()
{
	char players[MAX_PACKET], names[MAX_PACKET], line[LINE_LEN], steam[32], name[MAX_NAME_LENGTH];
	int plen, nlen;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!InPlay(i))
		{
			g_sLine[i][0] = '\0';
			continue;
		}
		BuildLine(i, line, sizeof(line));
		strcopy(g_sLine[i], LINE_LEN, line);
		plen += FormatEx(players[plen], sizeof(players) - plen, "%s%s", plen ? ";" : "", line);

		GetClientName(i, name, sizeof(name));
		strcopy(g_sName[i], sizeof(g_sName[]), name);
		Sanitize(name);
		if (!GetClientAuthId(i, AuthId_Steam2, steam, sizeof(steam), false))
			strcopy(steam, sizeof(steam), "BOT");
		nlen += FormatEx(names[nlen], sizeof(names) - nlen, "%s%d,%s,%s", nlen ? ";" : "", GetClientUserId(i), steam, name);
	}

	char map[64], body[MAX_PACKET];
	GetCurrentMap(map, sizeof(map));
	int scoreT = GetTeamScore(TEAM_T), scoreCT = GetTeamScore(TEAM_CT);
	FormatEx(body, sizeof(body), "%d|%s|%d|%d|%d|%s|%d|%s",
		g_cvTvDelay != null ? g_cvTvDelay.IntValue : 0, map, scoreT + scoreCT + 1, scoreT, scoreCT,
		g_sPhase, PhaseSeconds(), players);

	SendPacket("N", names);
	SendPacket("F", body);
	g_fLastFull = GetEngineTime();
	g_bFullPending = false;
}

void BuildLine(int client, char[] line, int maxlen)
{
	bool alive = IsPlayerAlive(client);
	char prim[24], sec[24], act[24];
	int he, flash, smoke, armor, c4;
	if (alive)
	{
		WeaponName(GetPlayerWeaponSlot(client, 0), prim, sizeof(prim));
		WeaponName(GetPlayerWeaponSlot(client, 1), sec, sizeof(sec));
		WeaponName(GetEntPropEnt(client, Prop_Send, "m_hActiveWeapon"), act, sizeof(act));
		he = NadeCount(client, 0);
		flash = NadeCount(client, 1);
		smoke = NadeCount(client, 2);
		armor = GetEntProp(client, Prop_Send, "m_ArmorValue");
		c4 = GetPlayerWeaponSlot(client, SLOT_C4) != -1;
	}
	FormatEx(line, maxlen, "%d,%d,%d,%d,%d,%d,%d,%d,%s,%s,%s,%d,%d,%d,%d,%d,%d,%d",
		GetClientUserId(client), GetClientTeam(client), alive, alive ? GetClientHealth(client) : 0,
		armor, alive && GetEntProp(client, Prop_Send, "m_bHasHelmet") != 0, alive && GetEntProp(client, Prop_Send, "m_bHasDefuser") != 0,
		GetEntProp(client, Prop_Send, "m_iAccount"), prim, sec, act, he, flash, smoke, c4,
		GetClientFrags(client), GetClientDeaths(client), g_iRoundDmg[client]);
}

void WeaponName(int weapon, char[] dest, int maxlen)
{
	dest[0] = '\0';
	if (weapon <= MaxClients || !IsValidEdict(weapon))
		return;
	char cls[32];
	GetEdictClassname(weapon, cls, sizeof(cls));
	strcopy(dest, maxlen, cls[StrContains(cls, "weapon_") == 0 ? 7 : 0]);
}

int NadeCount(int client, int n)
{
	if (g_iNadeAmmo[n] < 0)
	{
		int ent = FindEntityByClassname(-1, g_sNade[n]);
		if (ent == -1)
			return 0;   // ninguna en el mapa: nadie la tiene
		g_iNadeAmmo[n] = GetEntProp(ent, Prop_Send, "m_iPrimaryAmmoType");
		if (g_iNadeAmmo[n] < 0)
			return 0;
	}
	return GetEntProp(client, Prop_Send, "m_iAmmo", _, g_iNadeAmmo[n]);
}

// Los nombres van en un texto separado por | ; y ,
void Sanitize(char[] s)
{
	for (int i = 0; s[i] != '\0'; i++)
		if (s[i] == '|' || s[i] == ';' || s[i] == ',' || s[i] == '\n' || s[i] == '\r')
			s[i] = ' ';
}

int PhaseSeconds()
{
	if (g_fPhaseEnd <= 0.0)
		return -1;
	float left = g_fPhaseEnd - GetGameTime();
	return left > 0.0 ? RoundToCeil(left) : 0;
}

void SetPhase(const char[] phase, float seconds)
{
	strcopy(g_sPhase, sizeof(g_sPhase), phase);
	g_fPhaseEnd = seconds > 0.0 ? GetGameTime() + seconds : 0.0;

	char body[48];
	FormatEx(body, sizeof(body), "phase|%s|%d", phase, PhaseSeconds());
	SendPacket("E", body);
}

// ---------------------------------------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------------------------------------

public void Event_PlayerSpawn(Event event, const char[] name, bool dontBroadcast)
{
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0)
		g_iLastHealth[client] = 100;
}

public void Event_PlayerHurt(Event event, const char[] name, bool dontBroadcast)
{
	int victim = GetClientOfUserId(event.GetInt("userid"));
	if (victim <= 0)
		return;
	int attacker = GetClientOfUserId(event.GetInt("attacker"));

	// Mismo cálculo que el !hp del reporter: el daño no puede superar la vida que le quedaba a la víctima.
	int before = g_iLastHealth[victim];
	int dmg = event.GetInt("dmg_health");
	int left = event.GetInt("health");
	int real = dmg > 0 ? (dmg < before ? dmg : before) : before - (left > 0 ? left : 0);
	if (real < 0)
		real = 0;
	g_iLastHealth[victim] = before - real;

	if (attacker > 0 && attacker != victim && IsClientInGame(attacker) && GetClientTeam(attacker) != GetClientTeam(victim))
		g_iRoundDmg[attacker] += real;
}

public void Event_PlayerDeath(Event event, const char[] name, bool dontBroadcast)
{
	char weapon[32], body[128];
	event.GetString("weapon", weapon, sizeof(weapon));
	Sanitize(weapon);
	// assister, assistedflash, penetrated, attackerblind, smoke y noscope los agrega clientmod_deathnotice al
	// player_death (resource/modevents.res), para el mismo kill feed que ven los jugadores.
	FormatEx(body, sizeof(body), "kill|%d|%d|%s|%d|%d|%d|%d|%d|%d|%d", event.GetInt("attacker"), event.GetInt("userid"), weapon,
		event.GetBool("headshot"), event.GetInt("assister"), event.GetBool("assistedflash"), event.GetInt("penetrated"),
		event.GetBool("attackerblind"), event.GetBool("smoke"), event.GetBool("noscope"));
	SendPacket("E", body);
}

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	for (int i = 1; i <= MaxClients; i++)
		g_iRoundDmg[i] = 0;
	float freeze = g_cvFreezeTime != null ? g_cvFreezeTime.FloatValue : 0.0;
	if (freeze > 0.0)
		SetPhase("freeze", freeze);
	else
		SetPhase("live", RoundSeconds());
	g_bFullPending = true;
}

public void Event_FreezeEnd(Event event, const char[] name, bool dontBroadcast)
{
	SetPhase("live", RoundSeconds());
}

float RoundSeconds()
{
	return g_cvRoundTime != null ? g_cvRoundTime.FloatValue * 60.0 : 0.0;
}

public void Event_RoundEnd(Event event, const char[] name, bool dontBroadcast)
{
	SetPhase("over", 0.0);
	char body[48];
	FormatEx(body, sizeof(body), "end|%d|%d", event.GetInt("winner"), event.GetInt("reason"));
	SendPacket("E", body);
	g_bFullPending = true;   // el marcador nuevo sale en la próxima foto
}

public void Event_BombPlanted(Event event, const char[] name, bool dontBroadcast)
{
	SendBomb("plant", event.GetInt("userid"));
	SetPhase("planted", g_cvC4Timer != null ? g_cvC4Timer.FloatValue : 0.0);
}

public void Event_BombDefused(Event event, const char[] name, bool dontBroadcast)
{
	SendBomb("defuse", event.GetInt("userid"));
}

public void Event_BombExploded(Event event, const char[] name, bool dontBroadcast)
{
	SendBomb("explode", event.GetInt("userid"));
}

void SendBomb(const char[] what, int userid)
{
	char body[48];
	FormatEx(body, sizeof(body), "bomb|%s|%d", what, userid);
	SendPacket("E", body);
}

// ---------------------------------------------------------------------------------------------------------
// Consola
// ---------------------------------------------------------------------------------------------------------

public Action Cmd_Status(int client, int args)
{
	char state[64];
	if (!g_cvEnabled.BoolValue)
		strcopy(state, sizeof(state), "apagado (csstv_hud 0)");
	else if (g_bConnected)
		strcopy(state, sizeof(state), "enviando");
	else
		strcopy(state, sizeof(state), g_sLastError);

	float ago = g_iPackets ? GetEngineTime() - g_fLastSend : -1.0;
	ReplyToCommand(client, "CSSTV HUD %s · %s · destino %s:%d · %d paquetes (%d bytes) · último hace %.1f s",
		PLUGIN_VERSION, state, g_sHost[0] ? g_sHost : "-", g_iPort, g_iPackets, g_iBytes, ago);
	return Plugin_Handled;
}
