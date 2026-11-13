/**
 * Nombre de la web (2.12.0, plan: docs/bitacora/2026-11-12-cuchillo-por-vida-y-nombre-web).
 *
 *  - Al entrar, a quien tiene una ficha vinculada a su SteamID (principal o adicional) se le pone el nick de la ficha
 *    (players.nick), el que se ve en el perfil, el ranking y las partidas. Lo da la base: csstv_web_nick(token, steam).
 *  - Mientras está en el servidor no se lo puede cambiar: si se cambia el nombre, se le vuelve a poner y se le avisa.
 *  - Los VIP se saltan la regla (Kyan, 2026-11-12): siguen con el nombre que quieran y lo pueden cambiar.
 *  - Sin ficha, o si la web no responde, queda con su nombre de Steam (se vuelve a pedir en el próximo mapa).
 *  - Después de un !claim que vincula, se vuelve a pedir.
 *  - csstv_web_names 0 lo apaga. csstv_webnick_fake <userid> <nick> [vip] simula la respuesta de la base (pruebas con bots).
 */

#if defined _csstv_webnick_included
	#endinput
#endif
#define _csstv_webnick_included

#define WEBNICK_WARN_EVERY 10

ConVar g_cvWebNames;
char g_sWebNick[MAXPLAYERS + 1][MAX_NAME_LENGTH];   // nick de la ficha ("" = sin ficha o sin respuesta todavía)
bool g_bWebNickSetting[MAXPLAYERS + 1];             // el plugin le está poniendo el nombre: no es un cambio del jugador
int g_iWebNickWarnAt[MAXPLAYERS + 1];

void WebNick_Init()
{
	g_cvWebNames = CreateConVar("csstv_web_names", "1", "A quien tiene ficha en la web se le pone el nick de la ficha y no se lo puede cambiar (0 = cada uno con su nombre).", _, true, 0.0, true, 1.0);
	g_cvWebNames.AddChangeHook(WebNick_OnCvarChanged);
	RegServerCmd("csstv_webnick_fake", Cmd_WebNickFake, "Solo pruebas: csstv_webnick_fake <userid> <nick> [vip] (como si la base respondiera ese nick; \"\" = sin ficha; 1 = VIP).");
}

void WebNick_ClientReset(int client)
{
	g_sWebNick[client][0] = '\0';
	g_bWebNickSetting[client] = false;
	g_iWebNickWarnAt[client] = 0;
}

public void WebNick_OnCvarChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	if (!cv.BoolValue)
		for (int i = 1; i <= MaxClients; i++)
			g_sWebNick[i][0] = '\0';
	else
		for (int i = 1; i <= MaxClients; i++)
			if (IsClientInGame(i))
				WebNick_Request(i);
}

/** Desde OnClientPostAdminCheck y después de un !claim que vincula. */
void WebNick_Request(int client)
{
	if (!g_cvWebNames.BoolValue || !IsClientInGame(client) || IsFakeClient(client) || IsClientSourceTV(client))
		return;
	if (!g_cvSend.BoolValue || !Http_Available() || !Http_Configured())
		return;
	char steam[40];
	if (!Link_ClientKey(client, steam, sizeof(steam)))
		return;

	char url[256], key[512], token[128], body[256];
	g_cvApiUrl.GetString(url, sizeof(url));
	int rpc = StrContains(url, "/rpc/", false);
	if (rpc == -1)
		return;
	url[rpc + 5] = '\0';
	StrCat(url, sizeof(url), "csstv_web_nick");
	g_cvApiKey.GetString(key, sizeof(key));
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);
	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_steam\":\"%s\"}", token, steam);

	System2HTTPRequest req = new System2HTTPRequest(WebNick_OnResponse, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CSSTV-Reporter/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 15;
	req.Any = GetClientUserId(client);
	req.POST();
	delete req;
}

public void WebNick_OnResponse(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	int client = GetClientOfUserId(request.Any);
	if (!client)
		return;
	int status = success && response != null ? response.StatusCode : 0;
	char text[512];
	if (response != null)
		response.GetContent(text, sizeof(text));
	if (status != 200)
	{
		LogError("csstv_web_nick: %s %s", status ? "HTTP" : "sin conexión", status ? text : error);
		return;
	}
	char ok[8], vip[8], nick[MAX_NAME_LENGTH * 2];
	Claim_JsonField(text, "ok", ok, sizeof(ok));
	Claim_JsonField(text, "vip", vip, sizeof(vip));
	if (StrEqual(ok, "true"))
		Whois_Field(text, "nick", nick, sizeof(nick));   // Whois_Field deshace los escapes de JSON
	WebNick_Apply(client, nick, StrEqual(vip, "true"));
}

/** nick = "": sin ficha (queda con su nombre). vip: se salta la regla (queda con su nombre). */
void WebNick_Apply(int client, const char[] nick, bool vip)
{
	if (!g_cvWebNames.BoolValue || !IsClientInGame(client))
		return;
	if (vip)
	{
		g_sWebNick[client][0] = '\0';
		LogMessage("Nombre de la web: %N es VIP, sigue con su nombre.", client);
		return;
	}
	strcopy(g_sWebNick[client], sizeof(g_sWebNick[]), nick);
	TrimString(g_sWebNick[client]);
	TruncateUtf8(g_sWebNick[client], MAX_NAME_LENGTH - 1);
	if (!g_sWebNick[client][0])
		return;
	char name[MAX_NAME_LENGTH];
	GetClientName(client, name, sizeof(name));
	if (StrEqual(name, g_sWebNick[client]))
		return;
	LogMessage("Nombre de la web: %s pasa a llamarse %s.", name, g_sWebNick[client]);
	WebNick_Set(client);
	QolChat(client, "%s En este servidor usás el nombre de tu ficha: {#amarillo}%s{#normal}.", PREFIX, g_sWebNick[client]);
}

void WebNick_Set(int client)
{
	g_bWebNickSetting[client] = true;
	SetClientName(client, g_sWebNick[client]);
	g_bWebNickSetting[client] = false;
}

/** El jugador se cambió el nombre (o cualquier otro ajuste): si tiene ficha, vuelve al de la ficha. */
public void OnClientSettingsChanged(int client)
{
	if (client <= 0 || g_bWebNickSetting[client] || !g_sWebNick[client][0] || !g_cvWebNames.BoolValue || !IsClientInGame(client))
		return;
	char name[MAX_NAME_LENGTH];
	GetClientName(client, name, sizeof(name));
	if (StrEqual(name, g_sWebNick[client]))
		return;
	// Un cuadro después: en este momento el motor todavía está aplicando el nombre nuevo.
	RequestFrame(WebNick_Restore, GetClientUserId(client));
}

public void WebNick_Restore(int userid)
{
	int client = GetClientOfUserId(userid);
	if (!client || !g_sWebNick[client][0] || !g_cvWebNames.BoolValue)
		return;
	char name[MAX_NAME_LENGTH];
	GetClientName(client, name, sizeof(name));
	if (StrEqual(name, g_sWebNick[client]))
		return;
	WebNick_Set(client);
	int now = GetTime();
	if (now >= g_iWebNickWarnAt[client])
	{
		g_iWebNickWarnAt[client] = now + WEBNICK_WARN_EVERY;
		QolChat(client, "%s En este servidor usás el nombre de tu ficha. Para cambiarlo, cambialo en tu perfil de {#amarillo}cmleague.lat{#normal}.", PREFIX);
	}
}

public Action Cmd_WebNickFake(int args)
{
	char buf[16], nick[MAX_NAME_LENGTH], vip[4];
	GetCmdArg(1, buf, sizeof(buf));
	GetCmdArg(2, nick, sizeof(nick));
	GetCmdArg(3, vip, sizeof(vip));
	int client = GetClientOfUserId(StringToInt(buf));
	if (!client)
	{
		PrintToServer("csstv_webnick_fake: no hay nadie con el userid %s", buf);
		return Plugin_Handled;
	}
	WebNick_Apply(client, nick, StringToInt(vip) == 1);
	PrintToServer("csstv_webnick_fake: %N, nick de la web '%s'", client, g_sWebNick[client]);
	return Plugin_Handled;
}
