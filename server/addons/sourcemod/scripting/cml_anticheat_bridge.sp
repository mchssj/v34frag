/**
 * CMLeague Anticheat: Bridge (plan docs/bitacora/2026-10-30-anticheat-evidencia, replanteo 45).
 *
 * Le pregunta a la base por cada jugador real, al entrar y cada minuto, y aplica la respuesta en los mixes:
 *   - allow: sigue jugando. kick: se le avisa y, si en 20 s no cambió, se lo expulsa. Expulsar no es una sanción: no crea un ban.
 *   - Si la base no responde: quien fue verificado hace poco sigue jugando, para no cortar una partida. Pasados 5 minutos sin
 *     verificación, en un mix se expulsa. Un admin puede abrir los mixes con sm_ac_open <minutos>, incluso con la red caída.
 *
 * Qué es un mix lo dice cml_ac_mix: lo ponen cfg/csstv/live.cfg (1) y end.cfg y warmup.cfg (0), sin tocar el reporter.
 * Un servidor con ac_server_policy.enforce_always (replanteo 159) expulsa también fuera de un mix: eso lo decide la base.
 * 1.4.0 (Daniel, 2026-11-27): un minuto de gracia desde que entra para quien no tiene el SteamID vinculado (no_profile, para
 * que escriba !claim, y se lo revisa a los segundos de escribirlo) y para quien no tiene SteamID (AC-0). AC-0 expulsa también
 * fuera de un mix si la base dijo que el servidor está en Siempre (always en la respuesta).
 * No recopila procesos ni capturas: eso es de la aplicación. Una base sin política para este servidor responde allow.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <system2>

#define PLUGIN_VERSION "1.4.0"
#define KICK_GRACE     20.0
#define RECHECK        60.0
#define STALE_SECONDS  300
#define JOIN_GRACE     60

public Plugin myinfo =
{
	name = "CMLeague Anticheat Bridge",
	author = "CMLeague",
	description = "Vincula a los jugadores con su sesión del anticheat. No recopila nada del cliente.",
	version = PLUGIN_VERSION,
	url = "https://cmleague.lat"
};

ConVar g_cvUrl;
ConVar g_cvKey;
ConVar g_cvToken;
ConVar g_cvMix;

int g_iVerifiedAt[MAXPLAYERS + 1];
bool g_bWarned[MAXPLAYERS + 1];
int g_iJoinedAt[MAXPLAYERS + 1];
int g_iJoinedUser[MAXPLAYERS + 1];
bool g_bClaimNoticed[MAXPLAYERS + 1];
int g_iOpenUntil;
bool g_bServiceDown;
bool g_bAlways;   // La última respuesta de la base: el servidor está en Siempre. Sin respuesta todavía, false.

public void OnPluginStart()
{
	g_cvUrl   = CreateConVar("cml_ac_api_url", "", "Base de las RPC, terminada en /rest/v1/rpc/.", FCVAR_PROTECTED);
	g_cvKey   = CreateConVar("cml_ac_api_key", "", "Clave pública (anon) de la base.", FCVAR_PROTECTED);
	g_cvToken = CreateConVar("cml_ac_server_token", "", "Token del servidor, el mismo de csstv_server_token.", FCVAR_PROTECTED | FCVAR_DONTRECORD);
	g_cvMix   = CreateConVar("cml_ac_mix", "0", "1 mientras se juega un mix. Lo ponen live.cfg, end.cfg y warmup.cfg.", _, true, 0.0, true, 1.0);
	g_cvMix.AddChangeHook(OnMixChanged);
#if defined BRIDGE_DEBUG
	CreateConVar("cml_ac_debug_steam", "", "Solo pruebas: SteamID64 que se informa.");
	CreateConVar("cml_ac_debug_ip", "", "Solo pruebas: IP que se informa.");
#endif
	AutoExecConfig(true, "cml_anticheat");

	RegAdminCmd("sm_ac_open", Cmd_Open, ADMFLAG_RCON, "sm_ac_open <minutos>: abre los mixes en este servidor si el anticheat tiene problemas. 0 los cierra.");
	RegAdminCmd("sm_ac_status", Cmd_Status, ADMFLAG_GENERIC, "Estado del Bridge.");
	AddCommandListener(OnSay, "say");
	AddCommandListener(OnSay, "say_team");
	CreateTimer(RECHECK, Timer_CheckAll, _, TIMER_REPEAT);
}

// Un aviso pendiente se pierde con el cambio de mapa (TIMER_FLAG_NO_MAPCHANGE): se avisa de nuevo antes de expulsar.
public void OnMapStart()
{
	for (int i = 1; i <= MaxClients; i++)
		g_bWarned[i] = false;
}

public void OnClientPostAdminCheck(int client)
{
	g_iVerifiedAt[client] = 0;
	g_bWarned[client] = false;
	// El minuto de gracia cuenta desde que entró, no desde cada cambio de mapa: el userid sigue igual entre mapas.
	int userid = GetClientUserId(client);
	if (g_iJoinedUser[client] != userid)
	{
		g_iJoinedUser[client] = userid;
		g_iJoinedAt[client] = GetTime();
		g_bClaimNoticed[client] = false;
	}
	if (IsRealPlayer(client))
		Check(client);
}

// Segundos que le quedan del minuto de gracia desde que entró (0: ya pasó).
int GraceLeft(int client)
{
	int left = JOIN_GRACE - (GetTime() - g_iJoinedAt[client]);
	return left > 0 ? left : 0;
}

// Después de un !claim (lo atiende csstv_reporter), se lo revisa a los pocos segundos, sin esperar el minuto.
public Action OnSay(int client, const char[] command, int argc)
{
	if (client <= 0 || !IsRealPlayer(client))
		return Plugin_Continue;
	char text[64];
	GetCmdArgString(text, sizeof(text));
	StripQuotes(text);
	TrimString(text);
	if (StrContains(text, "!claim", false) == 0 || StrContains(text, "/claim", false) == 0)
	{
		CreateTimer(5.0, Timer_Recheck, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
		CreateTimer(15.0, Timer_Recheck, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
	}
	return Plugin_Continue;
}

public void OnClientDisconnect(int client)
{
	if (!IsRealPlayer(client))
		return;
	char id[32];
	if (!GetClientAuthId(client, AuthId_SteamID64, id, sizeof(id)))
		return;
	char body[256], token[128];
	g_cvToken.GetString(token, sizeof(token));
	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_steam\":\"%s\"}", token, id);
	Post("ac_bridge_end", body, OnEndResponse, 0);
}

public void OnEndResponse(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
}

public void OnMixChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	if (cv.BoolValue)
		CreateTimer(1.0, Timer_CheckAll);
}

public Action Timer_CheckAll(Handle timer)
{
	for (int i = 1; i <= MaxClients; i++)
		if (IsRealPlayer(i))
			Check(i);
	return Plugin_Continue;
}

public Action Timer_Recheck(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client > 0 && IsRealPlayer(client))
		Check(client);
	return Plugin_Stop;
}

bool IsRealPlayer(int client)
{
	return client > 0 && client <= MaxClients && IsClientConnected(client) && !IsFakeClient(client) && !IsClientSourceTV(client) && !IsClientReplay(client);
}

bool MixesOpen()
{
	return g_iOpenUntil > GetTime();
}

bool Check(int client)
{
	char url[8];
	g_cvUrl.GetString(url, sizeof(url));
	if (!url[0])
		return false;

	char id[32], ip[64], token[128], body[512];
	// Sin SteamID válido no hay cómo reconocerlo: en un mix cuenta como no verificado, no como aprobado.
#if defined BRIDGE_DEBUG
	// Compilación de pruebas (BRIDGE_DEBUG=): un servidor LAN no da SteamID. Nunca se despliega.
	GetConVarString(FindConVar("cml_ac_debug_steam"), id, sizeof(id));
	if (!id[0] || !GetClientIP(client, ip, sizeof(ip)))
#else
	if (!GetClientAuthId(client, AuthId_SteamID64, id, sizeof(id)) || !GetClientIP(client, ip, sizeof(ip)))
#endif
	{
		// Steam a veces tarda en validar: un minuto desde que entró antes de avisar. En Siempre, también fuera de un mix.
		if (g_cvMix.BoolValue || g_bAlways)
		{
			int left = GraceLeft(client);
			if (left > 0)
				CreateTimer(float(left) + 1.0, Timer_Recheck, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
			else
				Enforce(client, "sin SteamID válido", "AC-0");
		}
		return false;
	}
#if defined BRIDGE_DEBUG
	GetConVarString(FindConVar("cml_ac_debug_ip"), ip, sizeof(ip));
#endif
	// El puerto que ve el servidor (replanteo 156): si no es ninguno de los del juego en la PC del agente, es una marca leve.
	char full[64];
	int port = 0;
	if (GetClientIP(client, full, sizeof(full), false))
	{
		int colon = FindCharInString(full, ':', true);
		if (colon != -1)
			port = StringToInt(full[colon + 1]);
	}
	g_cvToken.GetString(token, sizeof(token));
	if (port > 0)
		Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_steam\":\"%s\",\"p_ip\":\"%s\",\"p_in_mix\":%s,\"p_port\":%d}", token, id, ip, g_cvMix.BoolValue ? "true" : "false", port);
	else
		Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_steam\":\"%s\",\"p_ip\":\"%s\",\"p_in_mix\":%s}", token, id, ip, g_cvMix.BoolValue ? "true" : "false");
	Post("ac_bridge_player", body, OnPlayerResponse, GetClientUserId(client));
	return true;
}

void Post(const char[] rpc, const char[] body, System2HTTPResponseCallback callback, any data)
{
	char url[256], key[512];
	g_cvUrl.GetString(url, sizeof(url));
	g_cvKey.GetString(key, sizeof(key));
	StrCat(url, sizeof(url), rpc);

	System2HTTPRequest req = new System2HTTPRequest(callback, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CMLeague-Bridge/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 10;
	req.Any = data;
	req.POST();
	delete req;
}

public void OnPlayerResponse(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	int client = GetClientOfUserId(request.Any);
	int status = success && response != null ? response.StatusCode : 0;
	if (status != 200)
	{
		if (!g_bServiceDown)
			LogMessage("La base no responde (%d). Con los mixes cerrados, quien no se verifique en %d s queda afuera.", status, STALE_SECONDS);
		g_bServiceDown = true;
		if (client > 0 && IsRealPlayer(client))
			OnServiceDown(client);
		return;
	}
	g_bServiceDown = false;
	if (client <= 0 || !IsRealPlayer(client))
		return;

	char content[512];
	response.GetContent(content, sizeof(content));
	g_bAlways = StrContains(content, "\"always\": true") != -1 || StrContains(content, "\"always\":true") != -1;
	if (StrContains(content, "\"linked\": true") != -1 || StrContains(content, "\"linked\":true") != -1)
		g_iVerifiedAt[client] = GetTime();

	if (StrContains(content, "\"action\": \"kick\"") == -1 && StrContains(content, "\"action\":\"kick\"") == -1)
	{
		g_bWarned[client] = false;
		return;
	}
	// Al jugador no se le dice qué se detectó (Kyan, 2026-11-27): solo un código que lee el staff. El motivo va al log.
	//   AC-1: sin agente o sin sesión. AC-2: el agente no ve el juego. AC-3: un hl2.exe abierto.
	//   AC-4: el agente está modificado o es una versión vieja. AC-5: la máquina está baneada.
	//   AC-6: el juego se abrió con el EAC de ClientMod, que está prohibido (replanteo 159). Este sí dice qué hacer.
	if (StrContains(content, "machine_banned") != -1)
		Enforce(client, "machine_banned", "AC-5", true);
	else if (StrContains(content, "agent_modified") != -1)
		Enforce(client, "agent_modified", "AC-4", true);
	else if (StrContains(content, "agent_outdated") != -1)
		Enforce(client, "agent_outdated", "AC-4", true);
	else if (StrContains(content, "hl2_detected") != -1)
		Enforce(client, "hl2_detected", "AC-3", true);
	else if (StrContains(content, "game_not_seen") != -1)
		Enforce(client, "game_not_seen", "AC-2", false);
	else if (StrContains(content, "eac_on") != -1)
		Enforce(client, "eac_on", "AC-6", false);
	else if (StrContains(content, "no_profile") != -1)
		EnforceClaim(client);
	else
		Enforce(client, "sin sesión del anticheat", "AC-1", false);
}

// always: expulsa aunque un admin haya abierto los mixes (hl2.exe, Kyan, 2026-11-26).
void Enforce(int client, const char[] why, const char[] code = "AC-1", bool always = false)
{
	if (MixesOpen() && !always)
		return;
	if (!g_bWarned[client])
	{
		g_bWarned[client] = true;
		if (StrEqual(code, "AC-1"))
			PrintToChat(client, "\x04[CMLeague]\x01 Para jugar aquí abre CMLeague Anticheat y vincula tu cuenta. Tienes %d segundos.", RoundToFloor(KICK_GRACE));
		else if (StrEqual(code, "AC-0"))
			PrintToChat(client, "\x04[CMLeague]\x01 No pudimos leer tu SteamID. Vuelve a entrar al servidor. Tienes %d segundos.", RoundToFloor(KICK_GRACE));
		else if (StrEqual(code, "AC-6"))
			PrintToChat(client, "\x04[CMLeague]\x01 Apaga el anticheat de ClientMod (EAC): en CM Launcher, debajo de Play tiene que decir Anticheat: Disabled. Después vuelve a abrir el juego (AC-6). Tienes %d segundos.", RoundToFloor(KICK_GRACE));
		else
			PrintToChat(client, "\x04[CMLeague]\x01 CMLeague Anticheat no te deja jugar (%s). Tienes %d segundos.", code, RoundToFloor(KICK_GRACE));
		CreateTimer(KICK_GRACE, Timer_Recheck, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
		return;
	}
	LogMessage("%L expulsado: %s (%s).", client, why, code);
	if (StrEqual(code, "AC-1"))
		KickClient(client, "Para jugar aquí necesitas CMLeague Anticheat abierto y vinculado (cmleague.lat)");
	else if (StrEqual(code, "AC-0"))
		KickClient(client, "No pudimos leer tu SteamID. Vuelve a entrar al servidor");
	else if (StrEqual(code, "AC-6"))
		KickClient(client, "Apaga el anticheat de ClientMod (EAC): en CM Launcher tiene que decir Anticheat: Disabled. Después vuelve a abrir el juego (AC-6)");
	else
		KickClient(client, "CMLeague Anticheat no te deja jugar (%s). Si crees que es un error, habla con el staff", code);
}

// SteamID sin vincular (no_profile): no se sabe de quién es, así que tampoco si tiene el anticheat. Un minuto desde que entró
// para que escriba !claim (Daniel, 2026-11-27); el aviso dice qué hacer, como AC-0 y AC-6. Pasado el minuto, AC-1.
void EnforceClaim(int client)
{
	if (MixesOpen())
		return;
	int left = GraceLeft(client);
	if (left > 0)
	{
		if (!g_bClaimNoticed[client])
		{
			g_bClaimNoticed[client] = true;
			PrintToChat(client, "[CMLeague] Vincula tu SteamID: escribe en el chat el !claim que te muestra la sala o Mi perfil en cmleague.lat. Tienes %d segundos.", left);
		}
		CreateTimer(float(left) + 1.0, Timer_Recheck, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
		return;
	}
	LogMessage("%L expulsado: SteamID sin vincular (AC-1).", client);
	KickClient(client, "Para jugar aquí vincula tu SteamID con !claim y abre CMLeague Anticheat (cmleague.lat)");
}

void OnServiceDown(int client)
{
	if (!g_cvMix.BoolValue || MixesOpen())
		return;
	if (g_iVerifiedAt[client] == 0)
		g_iVerifiedAt[client] = GetTime();   // Primera vez sin datos: se le da el mismo margen que al resto.
	if (GetTime() - g_iVerifiedAt[client] < STALE_SECONDS)
		return;
	LogMessage("%L expulsado del mix: anticheat sin respuesta y sin verificación reciente.", client);
	KickClient(client, "El anticheat de CMLeague no responde. Un admin puede abrir los mixes");
}

public Action Cmd_Open(int client, int args)
{
	if (args != 1)
	{
		ReplyToCommand(client, "[CMLeague] Uso: sm_ac_open <minutos>. 0 los cierra.");
		return Plugin_Handled;
	}
	char arg[16];
	GetCmdArg(1, arg, sizeof(arg));
	int minutes = StringToInt(arg);
	if (minutes < 0 || minutes > 720)
	{
		ReplyToCommand(client, "[CMLeague] Los minutos van de 0 a 720.");
		return Plugin_Handled;
	}
	g_iOpenUntil = minutes > 0 ? GetTime() + minutes * 60 : 0;
	LogAction(client, -1, "\"%L\" abrió los mixes sin anticheat por %d minutos.", client, minutes);
	ReplyToCommand(client, "[CMLeague] %s", minutes > 0 ? "Mixes abiertos: no se expulsa a nadie por el anticheat." : "Mixes cerrados otra vez.");
	return Plugin_Handled;
}

public Action Cmd_Status(int client, int args)
{
	ReplyToCommand(client, "[CMLeague] Bridge %s, mix=%d, siempre=%d, abiertos=%d, servicio=%s", PLUGIN_VERSION, g_cvMix.IntValue, g_bAlways, MixesOpen(), g_bServiceDown ? "sin respuesta" : "ok");
	return Plugin_Handled;
}
