/**
 * CSSTV CallAdmin
 *
 * !calladmin y cambio de mapa del moderador (plan docs/bitacora/2026-10-19-calladmin-moderadores):
 *   - !calladmin <motivo>: manda el reporte al canal de Discord del webhook y menciona al rol de moderadores;
 *   - !calladmin sin texto: menú para elegir al jugador y el motivo ("Otro" pide el motivo por el chat);
 *   - cooldown por jugador y entre reportes del servidor; el de Discord avisa también a los admins y
 *     moderadores conectados (acceso a csstv_calladmin_notify, por defecto flag b);
 *   - !map del moderador (acceso a csstv_mod_map, sin el flag g): solo sin mix en curso.
 *
 * El mensaje dice de qué servidor viene (csstv_calladmin_server): el servidor real y RBK mandan al mismo canal.
 * Solo menciona al rol de csstv_calladmin_role (allowed_mentions): un @everyone escrito por un jugador no suena.
 * System2 limita el cuerpo de un POST a 2048 bytes: el mensaje se arma para no pasarse.
 *
 * Si hay mix lo dice sm_csstv_status de csstv_reporter (leído con ServerCommandEx), así que no hace falta
 * cambiar ese plugin. Si no se puede leer, el moderador no cambia el mapa.
 * sm_map es de basecommands.smx: un listener lo atrapa antes, deja pasar a quien tiene acceso de verdad
 * (flag g o root) y resuelve el pedido del moderador sin que llegue a basecommands. El "Cambiar mapa" de
 * sm_admin no pasa por sm_map, por eso el moderador no tiene g y no lo ve.
 *
 * Independiente de csstv_reporter. Sin licencia.
 * Compilación de depuración (CALLADMIN_DEBUG=): escribe en el log los mensajes y el cuerpo enviado, marca los
 * reportes como prueba, deja reportar bots y agrega comandos para que un bot use el plugin.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <system2>

#define PLUGIN_VERSION   "1.0.1"
#define REASON_MAX       128
#define BODY_MAX         2047     // límite de System2
#define AWAIT_SECONDS    45       // "Otro": tiempo para escribir el motivo en el chat
#define MAP_CHANGE_DELAY 3.0      // como sm_map
#define TEAM_SPEC        1
#define TEAM_T           2
#define TEAM_CT          3

public Plugin myinfo =
{
	name = "CSSTV CallAdmin",
	author = "CMLeague",
	description = "!calladmin a Discord y !map del moderador sin mix en curso",
	version = PLUGIN_VERSION,
	url = ""
};

enum MixState
{
	Mix_None = 0,    // calentamiento o partida terminada
	Mix_Active,      // cuchillo, LO3, en vivo o medio tiempo
	Mix_Unknown      // no se pudo leer sm_csstv_status
};

ConVar g_cvEnabled;
ConVar g_cvWebhook;
ConVar g_cvRole;
ConVar g_cvServer;
ConVar g_cvAddress;
ConVar g_cvCooldown;
ConVar g_cvGlobalCooldown;
ConVar g_cvModMap;

StringMap g_smLastReport;   // SteamID -> hora del último reporte enviado
int g_iLastGlobal;

// Reporte en camino (uno por vez: el cooldown global los separa).
bool g_bSending;
bool g_bRetried;
int g_iSendUserId;
char g_sSendAuth[32];
char g_sBody[BODY_MAX + 1];

// Menú y "Otro": a quién se reporta, guardado al elegirlo (aunque se desconecte después).
bool g_bHasTarget[MAXPLAYERS + 1];
char g_sTargetName[MAXPLAYERS + 1][MAX_NAME_LENGTH];
char g_sTargetAuth[MAXPLAYERS + 1][32];
char g_sTargetId64[MAXPLAYERS + 1][24];
int g_iAwaitUntil[MAXPLAYERS + 1];

bool g_bMapChanging;
char g_sLogFile[PLATFORM_MAX_PATH];

public APLRes AskPluginLoad2(Handle myself, bool late, char[] error, int err_max)
{
	MarkNativeAsOptional("CM_GetClientModAuth");
	return APLRes_Success;
}

public void OnPluginStart()
{
	LoadTranslations("common.phrases");
	CreateConVar("csstv_calladmin_version", PLUGIN_VERSION, "Versión de CSSTV CallAdmin.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvEnabled        = CreateConVar("csstv_calladmin_enabled", "1", "Activa !calladmin.", _, true, 0.0, true, 1.0);
	g_cvWebhook        = CreateConVar("csstv_calladmin_webhook", "", "URL del webhook de Discord del canal de reportes.", FCVAR_PROTECTED | FCVAR_DONTRECORD);
	g_cvRole           = CreateConVar("csstv_calladmin_role", "1561742511045738526", "ID del rol de Discord a mencionar (vacío = sin mención).");
	g_cvServer         = CreateConVar("csstv_calladmin_server", "", "Nombre del servidor en el mensaje (ej. CMLeague #1). Vacío = hostname.");
	g_cvAddress        = CreateConVar("csstv_calladmin_address", "", "IP:puerto público para conectarse (vacío = ip y hostport del servidor).");
	g_cvCooldown       = CreateConVar("csstv_calladmin_cooldown", "120", "Segundos entre dos reportes del mismo jugador.", _, true, 0.0, true, 3600.0);
	g_cvGlobalCooldown = CreateConVar("csstv_calladmin_global_cooldown", "30", "Segundos entre dos reportes del servidor.", _, true, 0.0, true, 3600.0);
	g_cvModMap         = CreateConVar("csstv_calladmin_modmap", "1", "El moderador (csstv_mod_map) puede cambiar el mapa sin mix en curso.", _, true, 0.0, true, 1.0);
	AutoExecConfig(true, "csstv_calladmin");

	RegConsoleCmd("sm_calladmin", Cmd_CallAdmin, "!calladmin <motivo>: avisa a los moderadores en Discord. Sin motivo abre un menú.");
	AddCommandListener(Listener_Map, "sm_map");

	g_smLastReport = new StringMap();
	BuildPath(Path_SM, g_sLogFile, sizeof(g_sLogFile), "logs/calladmin.log");
#if defined CALLADMIN_DEBUG
	RegAdminCmd("csstv_calladmin_fakecmd", Cmd_DebugFake, ADMFLAG_ROOT, "csstv_calladmin_fakecmd <userid> <comando>: un bot ejecuta un comando (solo depuración).");
	RegAdminCmd("csstv_calladmin_setadmin", Cmd_DebugSetAdmin, ADMFLAG_ROOT, "csstv_calladmin_setadmin <userid> <grupo|root|none>: permisos de un bot (solo depuración).");
	RegAdminCmd("csstv_calladmin_menu", Cmd_DebugMenu, ADMFLAG_ROOT, "csstv_calladmin_menu <userid> <userid del reportado|0> <motivo>: lo que elige un bot en el menú (solo depuración).");
	RegAdminCmd("csstv_calladmin_access", Cmd_DebugAccess, ADMFLAG_ROOT, "csstv_calladmin_access <userid> <comando>: si un bot tendría acceso (solo depuración).");
	RegAdminCmd("csstv_calladmin_mixstate", Cmd_DebugMixState, ADMFLAG_ROOT, "csstv_calladmin_mixstate: estado del mix como lo lee el plugin (solo depuración).");
#endif
}

public void OnMapStart()
{
	g_bMapChanging = false;
}

public void OnClientConnected(int client)
{
	g_bHasTarget[client] = false;
	g_iAwaitUntil[client] = 0;
}

// ---------------------------------------------------------------------------
// !calladmin
// ---------------------------------------------------------------------------

public Action Cmd_CallAdmin(int client, int args)
{
	if (client == 0)
	{
		ReplyToCommand(client, "!calladmin se usa desde el juego.");
		return Plugin_Handled;
	}
	if (!CanReport(client))
		return Plugin_Handled;

	if (args > 0)
	{
		char reason[REASON_MAX + 1];
		GetCmdArgString(reason, sizeof(reason));
		StripQuotes(reason);
		TrimString(reason);
		if (reason[0])
		{
			// Si eligió "Otro" en el menú, el reportado es el que eligió.
			bool target = g_iAwaitUntil[client] >= GetTime() && g_bHasTarget[client];
			g_iAwaitUntil[client] = 0;
			if (!target)
				g_bHasTarget[client] = false;
			SendReport(client, reason);
			return Plugin_Handled;
		}
	}
	g_bHasTarget[client] = false;
	ShowTargetMenu(client);
	return Plugin_Handled;
}

/** Revisa todo lo que impide reportar ahora y le explica al jugador por qué. */
bool CanReport(int client)
{
	if (!g_cvEnabled.BoolValue)
	{
		Chat(client, "!calladmin está desactivado en este servidor.");
		return false;
	}
	char url[8];
	g_cvWebhook.GetString(url, sizeof(url));
	if (!url[0])
	{
		Chat(client, "!calladmin no está configurado en este servidor.");
		return false;
	}
	if (g_bSending)
	{
		Chat(client, "Se está enviando otro reporte. Prueba de nuevo en unos segundos.");
		return false;
	}
	int now = GetTime();
	int wait = g_iLastGlobal + g_cvGlobalCooldown.IntValue - now;
	if (wait > 0)
	{
		Chat(client, "Hace un momento se envió un reporte. Espera {#amarillo}%d s{#normal}.", wait);
		return false;
	}
	char auth[32];
	ClientKey(client, auth, sizeof(auth));
	int last;
	if (g_smLastReport.GetValue(auth, last))
	{
		wait = last + g_cvCooldown.IntValue - now;
		if (wait > 0)
		{
			Chat(client, "Ya enviaste un reporte. Puedes enviar otro en {#amarillo}%d s{#normal}.", wait);
			return false;
		}
	}
	return true;
}

void ShowTargetMenu(int client)
{
	Menu menu = new Menu(MenuHandler_Target);
	menu.SetTitle("!calladmin: ¿a quién reportas?");
	char info[12], name[MAX_NAME_LENGTH];
	for (int i = 1; i <= MaxClients; i++)
	{
		if (i == client || !IsClientInGame(i) || !CanBeReported(i))
			continue;
		IntToString(GetClientUserId(i), info, sizeof(info));
		GetClientName(i, name, sizeof(name));
		menu.AddItem(info, name);
	}
	menu.AddItem("0", "Ningún jugador en particular");
	menu.Display(client, 30);
}

bool CanBeReported(int client)
{
#if defined CALLADMIN_DEBUG
	return !IsClientSourceTV(client);
#else
	return !IsFakeClient(client);
#endif
}

public int MenuHandler_Target(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
		delete menu;
	else if (action == MenuAction_Select)
	{
		char info[12];
		menu.GetItem(item, info, sizeof(info));
		ChooseTarget(client, StringToInt(info));
	}
	return 0;
}

/** userid 0: sin reportado. Guarda nombre y SteamID ahora, por si se desconecta mientras elige el motivo. */
bool ChooseTarget(int client, int userid)
{
	g_bHasTarget[client] = false;
	if (userid != 0)
	{
		int target = GetClientOfUserId(userid);
		if (!target || !IsClientInGame(target))
		{
			Chat(client, "Ese jugador ya no está en el servidor.");
			return false;
		}
		GetClientName(target, g_sTargetName[client], sizeof(g_sTargetName[]));
		if (!GetClientAuthId(target, AuthId_Steam2, g_sTargetAuth[client], sizeof(g_sTargetAuth[])))
			strcopy(g_sTargetAuth[client], sizeof(g_sTargetAuth[]), "sin SteamID");
		if (!GetClientAuthId(target, AuthId_SteamID64, g_sTargetId64[client], sizeof(g_sTargetId64[])))
			g_sTargetId64[client][0] = '\0';
		g_bHasTarget[client] = true;
	}
	ShowReasonMenu(client);
	return true;
}

void ShowReasonMenu(int client)
{
	Menu menu = new Menu(MenuHandler_Reason);
	if (g_bHasTarget[client])
		menu.SetTitle("!calladmin: ¿qué hace %s?", g_sTargetName[client]);
	else
		menu.SetTitle("!calladmin: ¿qué pasa?");
	menu.AddItem("cheats", "Cheats (wall, aim, speed…)");
	menu.AddItem("toxico", "Tóxico o insultos");
	menu.AddItem("molesta", "Molesta al equipo (flash, bloqueo, TK)");
	menu.AddItem("otro", "Otro motivo (lo escribes en el chat)");
	menu.Display(client, 30);
}

public int MenuHandler_Reason(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
		delete menu;
	else if (action == MenuAction_Select)
	{
		char info[12];
		menu.GetItem(item, info, sizeof(info));
		ChooseReason(client, info);
	}
	return 0;
}

void ChooseReason(int client, const char[] key)
{
	if (StrEqual(key, "otro"))
	{
		g_iAwaitUntil[client] = GetTime() + AWAIT_SECONDS;
		Chat(client, "Escribe el motivo en el chat (solo lo ven los moderadores). Para no enviar nada, escribe {#amarillo}cancelar{#normal}.");
		return;
	}
	if (!CanReport(client))
		return;
	if (StrEqual(key, "cheats"))
		SendReport(client, "Cheats");
	else if (StrEqual(key, "toxico"))
		SendReport(client, "Tóxico o insultos");
	else if (StrEqual(key, "molesta"))
		SendReport(client, "Molesta al equipo");
}

/** "Otro": el siguiente mensaje del chat es el motivo y no se muestra a los demás. */
public Action OnClientSayCommand(int client, const char[] command, const char[] sArgs)
{
	if (client <= 0 || g_iAwaitUntil[client] == 0)
		return Plugin_Continue;
	if (g_iAwaitUntil[client] < GetTime())
	{
		g_iAwaitUntil[client] = 0;
		return Plugin_Continue;
	}
	if (sArgs[0] == '!' || sArgs[0] == '/')   // otro comando (o !calladmin <motivo>, que lo resuelve solo)
		return Plugin_Continue;

	char reason[REASON_MAX + 1];
	strcopy(reason, sizeof(reason), sArgs);
	StripQuotes(reason);
	TrimString(reason);
	g_iAwaitUntil[client] = 0;
	if (StrEqual(reason, "cancelar", false))
	{
		Chat(client, "Reporte cancelado.");
		return Plugin_Stop;
	}
	if (reason[0] && CanReport(client))
		SendReport(client, reason);
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Envío a Discord
// ---------------------------------------------------------------------------

void SendReport(int client, const char[] reasonIn)
{
	char reason[REASON_MAX + 1];
	strcopy(reason, sizeof(reason), reasonIn);

	char name[MAX_NAME_LENGTH], auth[32], id64[24], server[64], host[64], address[64], map[PLATFORM_MAX_PATH];
	GetClientName(client, name, sizeof(name));
	if (!GetClientAuthId(client, AuthId_Steam2, auth, sizeof(auth)))
		strcopy(auth, sizeof(auth), "sin SteamID");
	if (!GetClientAuthId(client, AuthId_SteamID64, id64, sizeof(id64)))
		id64[0] = '\0';
	FindConVar("hostname").GetString(host, sizeof(host));
	g_cvServer.GetString(server, sizeof(server));
	if (!server[0])
		strcopy(server, sizeof(server), host);
	ServerAddress(address, sizeof(address));
	GetCurrentMap(map, sizeof(map));

	int ct, t, spec;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsFakeClient(i))
			continue;
		switch (GetClientTeam(i))
		{
			case TEAM_CT: ct++;
			case TEAM_T: t++;
			default: spec++;
		}
	}

	char mixState[32], mixUid[64], mixScore[16];
	MixState mix = GetMixState(mixState, sizeof(mixState), mixUid, sizeof(mixUid), mixScore, sizeof(mixScore));

	// Campos ya escapados para JSON (y para el markdown de Discord los que escribe un jugador).
	char eReason[REASON_MAX * 3], eName[MAX_NAME_LENGTH * 3], eTarget[MAX_NAME_LENGTH * 3], eServer[192], eTitle[192], eHost[192], eMap[96];
	JsonEscape(reason, eReason, sizeof(eReason), true);
	JsonEscape(name, eName, sizeof(eName), true);
	JsonEscape(server, eServer, sizeof(eServer), true);
	JsonEscape(server, eTitle, sizeof(eTitle), false);   // el título del embed no usa markdown
	JsonEscape(host, eHost, sizeof(eHost), true);
	JsonEscape(map, eMap, sizeof(eMap), true);

	char reporter[256], reported[256], mixText[160], role[24], mention[48], title[160];
	PlayerField(eName, auth, id64, reporter, sizeof(reporter));
	if (g_bHasTarget[client])
	{
		JsonEscape(g_sTargetName[client], eTarget, sizeof(eTarget), true);
		PlayerField(eTarget, g_sTargetAuth[client], g_sTargetId64[client], reported, sizeof(reported));
	}
	if (mix == Mix_Active)
		Format(mixText, sizeof(mixText), "%s · %s\\n`%s`", mixState, mixScore, mixUid);
	else if (mix == Mix_None)
		strcopy(mixText, sizeof(mixText), "Sin mix en curso");
	else
		strcopy(mixText, sizeof(mixText), "No se pudo leer");

	g_cvRole.GetString(role, sizeof(role));
	if (!IsDigits(role))
		role[0] = '\0';
	if (role[0])
		Format(mention, sizeof(mention), "<@&%s> ", role);
#if defined CALLADMIN_DEBUG
	Format(title, sizeof(title), "[PRUEBA] !calladmin en %s", eTitle);
#else
	Format(title, sizeof(title), "!calladmin en %s", eTitle);
#endif

	char fields[1400];
	Format(fields, sizeof(fields), "{\"name\":\"Motivo\",\"value\":\"%s\"},{\"name\":\"Reporta\",\"value\":\"%s\",\"inline\":true}", eReason, reporter);
	if (g_bHasTarget[client])
		Format(fields, sizeof(fields), "%s,{\"name\":\"Reportado\",\"value\":\"%s\",\"inline\":true}", fields, reported);
	Format(fields, sizeof(fields), "%s,{\"name\":\"Servidor\",\"value\":\"%s%s%s%s\"}", fields, eHost,
		address[0] ? "\\n`connect " : "", address, address[0] ? "`" : "");
	Format(fields, sizeof(fields), "%s,{\"name\":\"Mapa\",\"value\":\"%s\\nCT %d · T %d · espect. %d\",\"inline\":true}", fields, eMap, ct, t, spec);
	Format(fields, sizeof(fields), "%s,{\"name\":\"Mix\",\"value\":\"%s\",\"inline\":true},{\"name\":\"Hora\",\"value\":\"<t:%d:f>\",\"inline\":true}",
		fields, mixText, GetTime());

	char body[4096];
	Format(body, sizeof(body), "{\"content\":\"%sReporte en **%s**\",\"allowed_mentions\":{\"parse\":[],\"roles\":[%s%s%s]},\"embeds\":[{\"title\":\"%s\",\"color\":15158332,\"fields\":[%s]}]}",
		mention, eServer, role[0] ? "\"" : "", role, role[0] ? "\"" : "", title, fields);
	if (strlen(body) > BODY_MAX)
	{
		LogError("El reporte de %L ocupa %d bytes (máximo %d) y no se envía.", client, strlen(body), BODY_MAX);
		Chat(client, "No se pudo enviar el reporte. Prueba con un motivo más corto.");
		return;
	}
	strcopy(g_sBody, sizeof(g_sBody), body);
#if defined CALLADMIN_DEBUG
	LogMessage("[calladmin] cuerpo (%d bytes): %s", strlen(body), body);
#endif

	g_bSending = true;
	g_bRetried = false;
	g_iSendUserId = GetClientUserId(client);
	ClientKey(client, g_sSendAuth, sizeof(g_sSendAuth));
	PostBody();

	LogToFileEx(g_sLogFile, "%L reportó%s%s%s%s: %s", client,
		g_bHasTarget[client] ? " a " : "", g_bHasTarget[client] ? g_sTargetName[client] : "",
		g_bHasTarget[client] ? " " : "", g_bHasTarget[client] ? g_sTargetAuth[client] : "", reason);
	NotifyStaff(client, reason);
	g_bHasTarget[client] = false;
}

void PlayerField(const char[] eName, const char[] auth, const char[] id64, char[] out, int len)
{
	if (id64[0])
		Format(out, len, "%s\\n`%s` · [perfil](https://steamcommunity.com/profiles/%s)", eName, auth, id64);
	else
		Format(out, len, "%s\\n`%s`", eName, auth);
}

void PostBody()
{
	char url[512];
	g_cvWebhook.GetString(url, sizeof(url));
	System2HTTPRequest req = new System2HTTPRequest(Http_OnResponse, "%s", url);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CSSTV-CallAdmin/%s", PLUGIN_VERSION);
	req.SetData("%s", g_sBody);
	req.Timeout = 15;
	req.POST();
	delete req;
}

public void Http_OnResponse(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	int status = success && response != null ? response.StatusCode : 0;
	if (status == 429 && !g_bRetried)
	{
		g_bRetried = true;
		CreateTimer(2.0, Timer_Retry);
		return;
	}

	g_bSending = false;
	int client = GetClientOfUserId(g_iSendUserId);
	if (status >= 200 && status < 300)
	{
		int now = GetTime();
		g_iLastGlobal = now;
		g_smLastReport.SetValue(g_sSendAuth, now);
		if (client && IsClientInGame(client))
			Chat(client, "{#verde}Reporte enviado.{#normal} Un moderador lo va a revisar.");
		return;
	}

	char detail[192];
	if (status == 0)
		strcopy(detail, sizeof(detail), error);
	else
		response.GetContent(detail, sizeof(detail));
	LogError("Discord rechazó el reporte (HTTP %d): %s", status, detail);
	LogToFileEx(g_sLogFile, "No se pudo enviar el último reporte a Discord (HTTP %d): %s", status, detail);
	if (client && IsClientInGame(client))
		Chat(client, "{#rojo}No se pudo enviar el reporte.{#normal} Prueba de nuevo en un rato.");
}

public Action Timer_Retry(Handle timer)
{
	PostBody();
	return Plugin_Stop;
}

/** Aviso en el chat a los admins y moderadores conectados. */
void NotifyStaff(int client, const char[] reason)
{
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || !CanBeReported(i) || !HasAccess(i, "csstv_calladmin_notify", ADMFLAG_GENERIC, true))
			continue;
		if (g_bHasTarget[client])
			Chat(i, "{#rojo}!calladmin{#normal} de {#amarillo}%N{#normal} contra {#amarillo}%s{#normal}: %s", client, g_sTargetName[client], reason);
		else
			Chat(i, "{#rojo}!calladmin{#normal} de {#amarillo}%N{#normal}: %s", client, reason);
	}
}

/**
 * Clave del cooldown por jugador: el SteamID, para que reconectarse no lo saltee. Sin un SteamID propio
 * (STEAM_ID_LAN, STEAM_ID_PENDING, BOT), la IP; un bot, su userid.
 */
void ClientKey(int client, char[] key, int len)
{
	if (IsFakeClient(client))
		Format(key, len, "bot-%d", GetClientUserId(client));
	else if (!GetClientAuthId(client, AuthId_Steam2, key, len) || StrContains(key, "STEAM_ID_") == 0 || StrContains(key, "STEAM_") != 0)
		GetClientIP(client, key, len);
}

void ServerAddress(char[] out, int len)
{
	g_cvAddress.GetString(out, len);
	if (out[0])
		return;
	char ip[32];
	ConVar cv = FindConVar("ip");
	if (cv != null)
		cv.GetString(ip, sizeof(ip));
	if (!ip[0] || StrEqual(ip, "0.0.0.0") || StrEqual(ip, "localhost"))
	{
		out[0] = '\0';
		return;
	}
	Format(out, len, "%s:%d", ip, FindConVar("hostport").IntValue);
}

bool IsDigits(const char[] s)
{
	if (!s[0])
		return false;
	for (int i = 0; s[i]; i++)
		if (s[i] < '0' || s[i] > '9')
			return false;
	return true;
}

/**
 * Copia src escapado para un string de JSON. Con markdown, además escapa lo que Discord usaría como formato o link.
 * Una arroba lleva un espacio de ancho cero después: nunca forma una mención. Corta sin partir caracteres UTF-8.
 */
void JsonEscape(const char[] src, char[] dst, int len, bool markdown)
{
	int j;
	int i;
	while (src[i])
	{
		int c = src[i] & 0xFF;
		int n = c >= 0xF0 ? 4 : (c >= 0xE0 ? 3 : (c >= 0xC0 ? 2 : 1));
		char piece[16];
		if (n > 1)
		{
			int k;
			for (k = 0; k < n && src[i + k]; k++)
				piece[k] = src[i + k];
			if (k < n)
				break;   // carácter cortado al final
			piece[n] = '\0';
		}
		else if (c == '"')
			strcopy(piece, sizeof(piece), "\\\"");
		else if (c == '\\')
			strcopy(piece, sizeof(piece), markdown ? "\\\\\\\\" : "\\\\");
		else if (c < 0x20)
			strcopy(piece, sizeof(piece), " ");
		else if (c == '@')
			strcopy(piece, sizeof(piece), "@\\u200b");
		else if (markdown && FindCharInString("*_~`|[]()>#-", src[i]) != -1)
			Format(piece, sizeof(piece), "\\\\%c", src[i]);
		else
		{
			piece[0] = src[i];
			piece[1] = '\0';
		}
		int pl = strlen(piece);
		if (j + pl >= len)
			break;
		strcopy(dst[j], len - j, piece);
		j += pl;
		i += n;
	}
	dst[j] = '\0';
}

// ---------------------------------------------------------------------------
// Estado del mix (de csstv_reporter)
// ---------------------------------------------------------------------------

/**
 * Lee la primera línea de sm_csstv_status: "[tag] vX · estado: <estado> · partida: <uid> · <a>-<b>".
 * Calentamiento o terminada: sin mix. Cualquier otro estado conocido: mix en curso. Lo demás: no se sabe.
 * No depende del separador "·": según cómo se compiló el plugin de los mixes, no siempre son los mismos bytes.
 */
MixState GetMixState(char[] state, int stateLen, char[] uid, int uidLen, char[] score, int scoreLen)
{
	char out[1024];
	state[0] = '\0';
	uid[0] = '\0';
	score[0] = '\0';
	ServerCommandEx(out, sizeof(out), "sm_csstv_status");
	int nl = FindCharInString(out, '\n');
	if (nl != -1)
		out[nl] = '\0';   // solo la primera línea
	int a = StrContains(out, "estado: ");
	int p = StrContains(out, " partida: ");
	if (a == -1 || p == -1 || p < a)
		return Mix_Unknown;
	a += strlen("estado: ");
	strcopy(state, p - a + 1 < stateLen ? p - a + 1 : stateLen, out[a]);
	// Saca el separador del final (espacios y bytes que no son ASCII).
	int n = strlen(state);
	while (n > 0 && (state[n - 1] == ' ' || (state[n - 1] & 0x80)))
		state[--n] = '\0';

	p += strlen(" partida: ");
	strcopy(uid, uidLen, out[p]);
	int sp = FindCharInString(uid, ' ');
	if (sp != -1)
		uid[sp] = '\0';
	int last = FindCharInString(out, ' ', true);   // el marcador es lo último de la línea
	if (last > p)
		strcopy(score, scoreLen, out[last + 1]);
	TrimString(score);

	if (StrEqual(state, "calentamiento") || StrEqual(state, "terminada"))
		return Mix_None;
	if (StrEqual(state, "en vivo") || StrEqual(state, "medio tiempo") || StrEqual(state, "ronda de cuchillo") || StrContains(state, "iniciando") == 0)
		return Mix_Active;
	return Mix_Unknown;
}

// ---------------------------------------------------------------------------
// !map del moderador
// ---------------------------------------------------------------------------

/**
 * Antes de basecommands: los admins (flag g o root) y quienes no son moderadores siguen de largo, sin cambios.
 * Al moderador se lo atiende acá y el comando no llega a basecommands (que le diría que no tiene acceso).
 */
public Action Listener_Map(int client, const char[] command, int argc)
{
#if defined CALLADMIN_DEBUG
	if (client > 0)
		LogMessage("[calladmin] listener %s de %N: acceso a sm_map %d, moderador %d", command, client,
			HasAccess(client, "sm_map", ADMFLAG_CHANGEMAP), IsModerator(client));
#endif
	if (client <= 0 || !IsClientInGame(client) || !g_cvModMap.BoolValue)
		return Plugin_Continue;
	if (HasAccess(client, "sm_map", ADMFLAG_CHANGEMAP))
		return Plugin_Continue;
	if (!IsModerator(client))
		return Plugin_Continue;
#if defined CALLADMIN_DEBUG
	char args[96];
	GetCmdArgString(args, sizeof(args));
	LogMessage("[calladmin] %N (moderador): %s %s", client, command, args);
#endif

	if (argc < 1)
	{
		if (CanModChangeMap(client))
			ShowMapMenu(client);
		return Plugin_Stop;
	}
	char arg[PLATFORM_MAX_PATH], map[PLATFORM_MAX_PATH];
	GetCmdArg(1, arg, sizeof(arg));
	if (!ResolveMap(arg, map, sizeof(map)))
	{
		Chat(client, "No se encontró el mapa {#amarillo}%s{#normal}.", arg);
		return Plugin_Stop;
	}
	if (CanModChangeMap(client))
		ModChangeMap(client, map);
	return Plugin_Stop;
}

/**
 * CheckCommandAccess. En la build de depuración, a un bot se le revisa su AdminId con CheckAccess, porque
 * CheckCommandAccess nunca le da acceso a un bot.
 */
bool HasAccess(int client, const char[] cmd, int flags, bool overrideOnly = false)
{
#if defined CALLADMIN_DEBUG
	if (IsFakeClient(client))
		return CheckAccess(GetUserAdmin(client), cmd, flags, overrideOnly);
#endif
	return CheckCommandAccess(client, cmd, flags, overrideOnly);
}

bool IsModerator(int client)
{
	return HasAccess(client, "csstv_mod_map", ADMFLAG_ROOT, true);
}

bool CanModChangeMap(int client)
{
	if (g_bMapChanging)
	{
		Chat(client, "El mapa ya se está cambiando.");
		return false;
	}
	char state[32], uid[64], score[16];
	MixState mix = GetMixState(state, sizeof(state), uid, sizeof(uid), score, sizeof(score));
	if (mix == Mix_Active)
	{
		Chat(client, "{#rojo}Hay un mix en curso{#normal} (%s): no se puede cambiar el mapa. Si hace falta, llama a un admin.", state);
		return false;
	}
	if (mix == Mix_Unknown)
	{
		Chat(client, "{#rojo}No se pudo saber si hay un mix en curso{#normal}: no se cambia el mapa. Llama a un admin.");
		return false;
	}
	return true;
}

/**
 * Nombre exacto, con de_ o cs_ adelante ("dust" -> de_dust) o, si no, el único mapa de la lista que lo
 * contiene ("mirage" -> de_mirage_rc1).
 */
bool ResolveMap(const char[] arg, char[] map, int len)
{
	static const char prefixes[][] = { "", "de_", "cs_" };
	for (int i = 0; i < sizeof(prefixes); i++)
	{
		Format(map, len, "%s%s", prefixes[i], arg);
		if (IsMapValid(map))
			return true;
	}
	map[0] = '\0';
	ArrayList maps = LoadMapNames();
	int found = -1;
	char name[PLATFORM_MAX_PATH];
	for (int i = 0; i < maps.Length; i++)
	{
		maps.GetString(i, name, sizeof(name));
		if (StrContains(name, arg, false) == -1)
			continue;
		if (found != -1)
		{
			found = -1;   // más de uno: que lo escriba completo
			break;
		}
		found = i;
	}
	if (found != -1)
		maps.GetString(found, map, len);
	delete maps;
	return found != -1;
}

/** Mapas de la sección "csstv" de configs/maplists.cfg (la votación de los jugadores) o del mapcycle. */
ArrayList LoadMapNames()
{
	int serial = -1;
	ArrayList all = new ArrayList(ByteCountToCells(PLATFORM_MAX_PATH));
	ReadMapList(all, serial, "csstv", MAPLIST_FLAG_CLEARARRAY);
	ArrayList maps = new ArrayList(ByteCountToCells(PLATFORM_MAX_PATH));
	char map[PLATFORM_MAX_PATH];
	for (int i = 0; i < all.Length; i++)
	{
		all.GetString(i, map, sizeof(map));
		if (IsMapValid(map) && maps.FindString(map) == -1)
			maps.PushString(map);
	}
	delete all;
	return maps;
}

void ShowMapMenu(int client)
{
	ArrayList maps = LoadMapNames();
	Menu menu = new Menu(MenuHandler_Map);
	menu.SetTitle("Cambiar el mapa");
	char map[PLATFORM_MAX_PATH], current[PLATFORM_MAX_PATH];
	GetCurrentMap(current, sizeof(current));
	for (int i = 0; i < maps.Length; i++)
	{
		maps.GetString(i, map, sizeof(map));
		menu.AddItem(map, map, StrEqual(map, current, false) ? ITEMDRAW_DISABLED : ITEMDRAW_DEFAULT);
	}
	delete maps;
	if (menu.ItemCount == 0)
	{
		delete menu;
		Chat(client, "No hay mapas en la lista. Usa {#amarillo}!map <mapa>{#normal}.");
		return;
	}
	menu.Display(client, MENU_TIME_FOREVER);
}

public int MenuHandler_Map(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
		delete menu;
	else if (action == MenuAction_Select)
	{
		char map[PLATFORM_MAX_PATH];
		menu.GetItem(item, map, sizeof(map));
		// Se vuelve a revisar todo: entre abrir el menú y elegir pudo empezar un mix o cambiar sus permisos.
		if (IsModerator(client) && IsMapValid(map) && CanModChangeMap(client))
			ModChangeMap(client, map);
	}
	return 0;
}

/** Igual que sm_map: aviso a todos, log y cambio en 3 s. */
void ModChangeMap(int client, const char[] map)
{
	g_bMapChanging = true;
	ShowActivity2(client, "[SM] ", "%t", "Changing map", map);
	LogAction(client, -1, "\"%L\" changed map to \"%s\" (moderador, sin mix en curso)", client, map);
	DataPack dp;
	CreateDataTimer(MAP_CHANGE_DELAY, Timer_ModChangeMap, dp, TIMER_FLAG_NO_MAPCHANGE);
	dp.WriteCell(GetClientUserId(client));
	dp.WriteString(map);
}

public Action Timer_ModChangeMap(Handle timer, DataPack dp)
{
	dp.Reset();
	int client = GetClientOfUserId(dp.ReadCell());
	char map[PLATFORM_MAX_PATH];
	dp.ReadString(map, sizeof(map));

	// En esos 3 s un admin pudo empezar un mix: entonces no se cambia.
	char state[32], uid[64], score[16];
	if (GetMixState(state, sizeof(state), uid, sizeof(uid), score, sizeof(score)) != Mix_None)
	{
		g_bMapChanging = false;
		LogAction(-1, -1, "Cambio de mapa del moderador a \"%s\" cancelado: empezó un mix", map);
		PrintToChatAll("[SM] Se canceló el cambio de mapa: empezó un mix.");
		if (client)
			Chat(client, "Se canceló el cambio de mapa: empezó un mix.");
		return Plugin_Stop;
	}
	ForceChangeLevel(map, "csstv_calladmin: moderador");
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Chat (mismos colores y prefijo que csstv_reporter, si está cargado)
// ---------------------------------------------------------------------------

native int CM_GetClientModAuth(int client);   // clientmod.inc: 2 = ClientMod, 3 = ClientMod desactualizado

static const char g_sColorTag[][] = { "{#normal}", "{#verde}", "{#rojo}", "{#amarillo}" };
static const char g_sColorRgb[][] = { "\x01", "\x073EFF3E", "\x07FF4040", "\x07FFD700" };
static const char g_sColorBasic[][] = { "\x01", "\x04", "\x01", "\x01" };

bool ChatUsesRgb(int client)
{
	ConVar cv = FindConVar("csstv_chat_colors");
	int mode = cv == null ? 1 : cv.IntValue;
	if (mode == 0)
		return false;
	if (mode == 2)
		return true;
	if (GetFeatureStatus(FeatureType_Native, "CM_GetClientModAuth") != FeatureStatus_Available)
		return false;
	return CM_GetClientModAuth(client) >= 2;
}

void ApplyColorTags(char[] text, int len, bool rgb, bool strip = false)
{
	for (int i = 0; i < sizeof(g_sColorTag); i++)
		ReplaceString(text, len, g_sColorTag[i], strip ? "" : (rgb ? g_sColorRgb[i] : g_sColorBasic[i]), false);
}

/** Mensaje de chat solo para el jugador, con el prefijo [CMLeague] y etiquetas de color según su cliente. */
void Chat(int client, const char[] fmt, any ...)
{
	char tag[32], text[224], buf[256];
	ConVar cv = FindConVar("csstv_chat_tag");
	if (cv != null)
		cv.GetString(tag, sizeof(tag));
	SetGlobalTransTarget(client);
	VFormat(text, sizeof(text), fmt, 3);
	Format(buf, sizeof(buf), "[%s] %s", tag[0] ? tag : "CMLeague", text);
#if defined CALLADMIN_DEBUG
	char plain[256];
	strcopy(plain, sizeof(plain), buf);
	ApplyColorTags(plain, sizeof(plain), false, true);
	LogMessage("[respuesta a %N] %s", client, plain);
#endif
	if (IsFakeClient(client))
		return;
	if (!ChatUsesRgb(client))
	{
		ApplyColorTags(buf, sizeof(buf), false);
		PrintToChat(client, "%s", buf);
		return;
	}
	ApplyColorTags(buf, sizeof(buf), true);
	char msg[256];
	Format(msg, sizeof(msg), "\x01%s", buf);   // SayText2 necesita empezar con \x01 para mostrar colores
	Handle um = StartMessageOne("SayText2", client, USERMSG_RELIABLE | USERMSG_BLOCKHOOKS);
	if (um == null)
	{
		ApplyColorTags(buf, sizeof(buf), false);
		PrintToChat(client, "%s", buf);
		return;
	}
	BfWriteByte(um, client);   // autor
	BfWriteByte(um, true);     // mensaje de chat
	BfWriteString(um, msg);
	EndMessage();
}

// ---------------------------------------------------------------------------
// Depuración
// ---------------------------------------------------------------------------

#if defined CALLADMIN_DEBUG
int DebugTarget(int client, int arg)
{
	char buf[16];
	GetCmdArg(arg, buf, sizeof(buf));
	int target = GetClientOfUserId(StringToInt(buf));
	if (!target || !IsClientInGame(target))
	{
		ReplyToCommand(client, "userid inválido");
		return 0;
	}
	return target;
}

public Action Cmd_DebugFake(int client, int args)
{
	if (args < 2)
	{
		ReplyToCommand(client, "Uso: csstv_calladmin_fakecmd <userid> <comando>");
		return Plugin_Handled;
	}
	int target = DebugTarget(client, 1);
	if (!target)
		return Plugin_Handled;
	char arg[16], full[256];
	GetCmdArg(1, arg, sizeof(arg));
	GetCmdArgString(full, sizeof(full));
	FakeClientCommandEx(target, "%s", full[strlen(arg) + 1]);
	return Plugin_Handled;
}

/** Permisos de un bot: un admin temporal con ese grupo (o root), o ninguno. */
public Action Cmd_DebugSetAdmin(int client, int args)
{
	int target = DebugTarget(client, 1);
	if (!target)
		return Plugin_Handled;
	char what[32];
	GetCmdArg(2, what, sizeof(what));
	AdminId old = GetUserAdmin(target);
	if (old != INVALID_ADMIN_ID)
	{
		SetUserAdmin(target, INVALID_ADMIN_ID);
		RemoveAdmin(old);
	}
	if (StrEqual(what, "none"))
	{
		ReplyToCommand(client, "%N sin permisos", target);
		return Plugin_Handled;
	}
	AdminId admin = CreateAdmin("calladmin_debug");
	if (StrEqual(what, "root"))
		admin.SetFlag(Admin_Root, true);
	else
	{
		GroupId group = FindAdmGroup(what);
		if (group == INVALID_GROUP_ID)
		{
			RemoveAdmin(admin);
			ReplyToCommand(client, "No existe el grupo %s", what);
			return Plugin_Handled;
		}
		admin.InheritGroup(group);
	}
	SetUserAdmin(target, admin, true);
	ReplyToCommand(client, "%N ahora es %s (flags %d)", target, what, GetUserFlagBits(target));
	return Plugin_Handled;
}

public Action Cmd_DebugMenu(int client, int args)
{
	int bot = DebugTarget(client, 1);
	if (!bot)
		return Plugin_Handled;
	char buf[16], reason[16];
	GetCmdArg(2, buf, sizeof(buf));
	GetCmdArg(3, reason, sizeof(reason));
	if (!CanReport(bot))
		return Plugin_Handled;
	if (ChooseTarget(bot, StringToInt(buf)))
		ChooseReason(bot, reason);
	return Plugin_Handled;
}

/** Si un bot tendría acceso a un comando con sus permisos (incluye los overrides). */
public Action Cmd_DebugAccess(int client, int args)
{
	int target = DebugTarget(client, 1);
	if (!target)
		return Plugin_Handled;
	char cmd[64];
	GetCmdArg(2, cmd, sizeof(cmd));
	ReplyToCommand(client, "%N -> %s: %d", target, cmd, HasAccess(target, cmd, ADMFLAG_ROOT));
	return Plugin_Handled;
}

public Action Cmd_DebugMixState(int client, int args)
{
	char state[32], uid[64], score[16];
	MixState mix = GetMixState(state, sizeof(state), uid, sizeof(uid), score, sizeof(score));
	char raw[256];
	ServerCommandEx(raw, sizeof(raw), "sm_csstv_status");
	ReplyToCommand(client, "salida: %s", raw);
	ReplyToCommand(client, "mix=%d estado=[%s] partida=[%s] marcador=[%s]", view_as<int>(mix), state, uid, score);
	return Plugin_Handled;
}
#endif
