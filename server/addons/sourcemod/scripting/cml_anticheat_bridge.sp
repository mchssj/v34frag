/**
 * CMLeague Anticheat: Bridge (plan docs/bitacora/2026-10-30-anticheat-evidencia, replanteo 39).
 *
 * Le pregunta a la base por cada jugador real, al entrar y cada minuto, y aplica la respuesta en los mixes:
 *   - allow: sigue jugando. kick: se le avisa y, si en 20 s no cambió, se lo expulsa. Expulsar no es una sanción: no crea un ban.
 *   - Si la base no responde: quien fue verificado hace poco sigue jugando, para no cortar una partida. Pasados 5 minutos sin
 *     verificación, en un mix se expulsa. Un admin puede abrir los mixes con sm_ac_open <minutos>, incluso con la red caída.
 *
 * Qué es un mix lo dice cml_ac_mix: lo ponen cfg/csstv/live.cfg (1) y end.cfg y warmup.cfg (0), sin tocar el reporter.
 * No recopila procesos ni capturas: eso es de la aplicación. Una base sin política para este servidor responde allow.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <system2>

#define PLUGIN_VERSION "1.0.0"
#define KICK_GRACE     20.0
#define RECHECK        60.0
#define STALE_SECONDS  300

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
int g_iOpenUntil;
bool g_bServiceDown;

public void OnPluginStart()
{
	g_cvUrl   = CreateConVar("cml_ac_api_url", "", "Base de las RPC, terminada en /rest/v1/rpc/.", FCVAR_PROTECTED);
	g_cvKey   = CreateConVar("cml_ac_api_key", "", "Clave pública (anon) de la base.", FCVAR_PROTECTED);
	g_cvToken = CreateConVar("cml_ac_server_token", "", "Token del servidor, el mismo de csstv_server_token.", FCVAR_PROTECTED | FCVAR_DONTRECORD);
	g_cvMix   = CreateConVar("cml_ac_mix", "0", "1 mientras se juega un mix. Lo ponen live.cfg, end.cfg y warmup.cfg.", _, true, 0.0, true, 1.0);
	g_cvMix.AddChangeHook(OnMixChanged);
	AutoExecConfig(true, "cml_anticheat");

	RegAdminCmd("sm_ac_open", Cmd_Open, ADMFLAG_RCON, "sm_ac_open <minutos>: abre los mixes en este servidor si el anticheat tiene problemas. 0 los cierra.");
	RegAdminCmd("sm_ac_status", Cmd_Status, ADMFLAG_GENERIC, "Estado del Bridge.");
	CreateTimer(RECHECK, Timer_CheckAll, _, TIMER_REPEAT);
}

public void OnClientPostAdminCheck(int client)
{
	g_iVerifiedAt[client] = 0;
	g_bWarned[client] = false;
	if (IsRealPlayer(client))
		Check(client);
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
		if (IsRealPlayer(i) && IsClientAuthorized(i))
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
	if (!GetClientAuthId(client, AuthId_SteamID64, id, sizeof(id)) || !GetClientIP(client, ip, sizeof(ip)))
		return false;
	g_cvToken.GetString(token, sizeof(token));
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
	if (StrContains(content, "\"linked\": true") != -1 || StrContains(content, "\"linked\":true") != -1)
		g_iVerifiedAt[client] = GetTime();

	if (StrContains(content, "\"action\": \"kick\"") == -1 && StrContains(content, "\"action\":\"kick\"") == -1)
	{
		g_bWarned[client] = false;
		return;
	}
	if (MixesOpen())
		return;
	if (!g_bWarned[client])
	{
		g_bWarned[client] = true;
		PrintToChat(client, "\x04[CMLeague]\x01 Para jugar este mix abre CMLeague Anticheat y vincula tu cuenta. Tienes %d segundos.", RoundToFloor(KICK_GRACE));
		CreateTimer(KICK_GRACE, Timer_Recheck, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
		return;
	}
	LogMessage("%L expulsado del mix: sin sesión del anticheat.", client);
	KickClient(client, "Para jugar mixes necesitas CMLeague Anticheat abierto y vinculado (cmleague.lat)");
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
	ReplyToCommand(client, "[CMLeague] Bridge %s, mix=%d, abiertos=%d, servicio=%s", PLUGIN_VERSION, g_cvMix.IntValue, MixesOpen(), g_bServiceDown ? "sin respuesta" : "ok");
	return Plugin_Handled;
}
