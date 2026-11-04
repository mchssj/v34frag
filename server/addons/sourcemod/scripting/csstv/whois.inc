/**
 * !whois: nicks que usó un jugador en las partidas y su perfil en la web
 * (planes: docs/bitacora/2026-10-19-plugin-whois y 2026-10-20-whois-menu).
 *
 *  - !whois <nombre | SteamID>: solo admins y moderadores (ADMFLAG_GENERIC, flag b).
 *  - Un SteamID, o el nombre exacto de un conectado (sin distinguir mayúsculas), va directo.
 *  - Si no, la base busca el texto en los nicks de las partidas, el nick de la ficha y el alias de la
 *    cuenta, y suma los conectados cuyo nombre lo contiene (el plugin le manda sus SteamID). Los
 *    candidatos son personas: un conectado que también aparece por un nick viejo sale una vez, y
 *    después del corte los SteamID de una misma ficha son uno solo.
 *  - Con un candidato muestra sus datos. Con varios abre un menú (hasta 15, conectados primero);
 *    desde la consola, la lista en texto con los SteamID.
 *  - La respuesta va solo al que preguntó (chat o consola) y queda en el log quién buscó a quién.
 *  - La base (csstv_whois) responde siempre 200 con un objeto plano: { ok, message } si no hay
 *    nada, { ok, multiple, total, candidates } si hay varios, o los datos de uno. candidates:
 *    "steam|online|nick|partidas|ficha" separados por ";".
 */

#if defined _csstv_whois_included
	#endinput
#endif
#define _csstv_whois_included

#define WHOIS_COOLDOWN 3
#define WHOIS_MENU_MAX 15
#define WHOIS_MENU_TIME 30

int g_iWhoisLast[MAXPLAYERS + 1];               // GetTime() de la última consulta del admin
char g_sWhoisLabel[MAXPLAYERS + 1][MAX_NAME_LENGTH];   // nombre del conectado consultado ("" si es un desconectado)
ReplySource g_iWhoisReply[MAXPLAYERS + 1];      // chat o consola: la respuesta llega después del comando

void Whois_Init()
{
	RegAdminCmd("sm_whois", Cmd_Whois, ADMFLAG_GENERIC, "!whois <nombre | SteamID>: nicks que usó en las partidas y su perfil en la web (también desconectados).");
}

void Whois_ClientReset(int client)
{
	g_iWhoisLast[client] = 0;
	g_sWhoisLabel[client][0] = '\0';
}

public Action Cmd_Whois(int client, int args)
{
	if (!License_Allows())
	{
		License_Reply(client);
		return Plugin_Handled;
	}
	if (!g_cvSend.BoolValue || !Http_Available() || !Http_Configured())
	{
		QolReply(client, "[%s] !whois no está disponible en este servidor.", g_sTag);
		return Plugin_Handled;
	}

	char text[64];
	GetCmdArgString(text, sizeof(text));
	StripQuotes(text);
	TrimString(text);
	if (args == 0 || strlen(text) < 2)
	{
		QolReply(client, "[%s] Uso: {#amarillo}!whois <nombre o SteamID>{#normal} (también jugadores desconectados).", g_sTag);
		return Plugin_Handled;
	}

	// La consola del servidor (client 0) no tiene espera.
	int now = GetTime();
	if (client > 0 && g_iWhoisLast[client] && now - g_iWhoisLast[client] < WHOIS_COOLDOWN)
	{
		QolReply(client, "[%s] Esperá %d segundos antes de probar de nuevo.", g_sTag, WHOIS_COOLDOWN - (now - g_iWhoisLast[client]));
		return Plugin_Handled;
	}

	char steam[40], label[MAX_NAME_LENGTH], online[1024];
	if (Whois_IsSteamId(text))
	{
		strcopy(steam, sizeof(steam), text);
	}
	else
	{
		int exact = Whois_MatchConnected(text, online, sizeof(online));
		if (exact > 0)
		{
			GetClientName(exact, label, sizeof(label));
			if (!Link_ClientKey(exact, steam, sizeof(steam)))
			{
				QolReply(client, "[%s] {#amarillo}%s{#normal} no tiene SteamID (¿es un bot?).", g_sTag, label);
				return Plugin_Handled;
			}
		}
	}

	if (client > 0)
	{
		g_iWhoisLast[client] = now;
		g_iWhoisReply[client] = GetCmdReplySource();
		strcopy(g_sWhoisLabel[client], sizeof(g_sWhoisLabel[]), label);
	}
	if (steam[0])
		Whois_Send(client, steam, "", "");
	else
		Whois_Send(client, "", text, online);
	return Plugin_Handled;
}

/** STEAM_X:Y:Z o SteamID64. */
bool Whois_IsSteamId(const char[] s)
{
	if (StrContains(s, "STEAM_", false) == 0)
	{
		int colons;
		for (int i = 6; s[i] != '\0'; i++)
		{
			if (s[i] == ':')
				colons++;
			else if (!IsCharNumeric(s[i]))
				return false;
		}
		return colons == 2;
	}
	int len = strlen(s);
	if (len != 17 || strncmp(s, "765611", 6) != 0)
		return false;
	for (int i = 0; i < len; i++)
		if (!IsCharNumeric(s[i]))
			return false;
	return true;
}

/**
 * El conectado cuyo nombre es exactamente el texto (sin distinguir mayúsculas), o 0. En online deja
 * los SteamID de los conectados cuyo nombre contiene el texto, separados por coma (sin los bots).
 */
int Whois_MatchConnected(const char[] text, char[] online, int maxlen)
{
	int exact;
	char name[MAX_NAME_LENGTH], key[40];
	online[0] = '\0';
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsClientSourceTV(i))
			continue;
		GetClientName(i, name, sizeof(name));
		if (StrEqual(name, text, false))
			exact = i;
		if (StrContains(name, text, false) != -1 && Link_ClientKey(i, key, sizeof(key))
		    && strlen(online) + strlen(key) + 2 < maxlen)
			Format(online, maxlen, "%s%s%s", online, online[0] ? "," : "", key);
	}
	return exact;
}

/** El conectado con ese SteamID (STEAM_0:X:Y), o 0. */
int Whois_ClientBySteam(const char[] steam)
{
	if (!steam[0])
		return 0;
	char key[40];
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && Link_ClientKey(i, key, sizeof(key)) && StrEqual(key, steam, false))
			return i;
	return 0;
}

void Whois_Send(int client, const char[] steam, const char[] query, const char[] online)
{
	char url[256], key[512], token[128], steamJson[48], queryJson[128], onlineJson[1024], body[1536];
	g_cvApiUrl.GetString(url, sizeof(url));
	int rpc = StrContains(url, "/rpc/", false);
	if (rpc == -1)
	{
		QolReply(client, "[%s] !whois no está disponible en este servidor.", g_sTag);
		return;
	}
	url[rpc + 5] = '\0';
	StrCat(url, sizeof(url), "csstv_whois");
	g_cvApiKey.GetString(key, sizeof(key));
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);
	Claim_SafeNick(steam, steamJson, sizeof(steamJson));
	Claim_SafeNick(query, queryJson, sizeof(queryJson));
	Claim_SafeNick(online, onlineJson, sizeof(onlineJson));
	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_steam\":\"%s\",\"p_query\":\"%s\",\"p_online\":\"%s\"}", token, steamJson, queryJson, onlineJson);

	System2HTTPRequest req = new System2HTTPRequest(Whois_OnResponse, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CSSTV-Reporter/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 15;
	req.Any = client > 0 ? GetClientUserId(client) : 0;
	req.POST();
	delete req;

	char who[MAX_NAME_LENGTH];
	if (client > 0)
		GetClientName(client, who, sizeof(who));
	else
		strcopy(who, sizeof(who), "consola");
	LogMessage("!whois de %s: %s", who, steam[0] ? steam : query);
}

public void Whois_OnResponse(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	// 0 = la consola del servidor; si el admin ya se fue, no hay a quién responder.
	int client = request.Any ? GetClientOfUserId(request.Any) : 0;
	if (request.Any && !client)
		return;
	int status = success && response != null ? response.StatusCode : 0;
	char text[4096];
	if (response != null)
		response.GetContent(text, sizeof(text));

	// QolReply responde por donde preguntó el admin (fuera del comando, SourceMod respondería por consola).
	ReplySource old = SetCmdReplySource(client > 0 ? g_iWhoisReply[client] : SM_REPLY_TO_CONSOLE);
	Whois_Show(client, status, text, error);
	SetCmdReplySource(old);
}

void Whois_Show(int client, int status, const char[] text, const char[] error)
{
	if (status != 200)
	{
		LogError("csstv_whois: %s %s", status ? "HTTP" : "sin conexión", status ? text : error);
		QolReply(client, "[%s] No se pudo consultar la web (%s). Probá de nuevo.", g_sTag, status ? "error del servidor" : "sin conexión");
		return;
	}

	char ok[8];
	Claim_JsonField(text, "ok", ok, sizeof(ok));
	if (!StrEqual(ok, "true"))
	{
		char message[160];
		Whois_Field(text, "message", message, sizeof(message));
		QolReply(client, "[%s] {#rojo}%s{#normal}.", g_sTag, message[0] ? message : "No se encontró a nadie");
		return;
	}

	char multiple[8];
	Claim_JsonField(text, "multiple", multiple, sizeof(multiple));
	if (StrEqual(multiple, "true"))
	{
		Whois_ShowCandidates(client, text);
		return;
	}

	char steam[40], steamCount[8], nicks[160], nickCount[8], matches[8], last[16], playerId[48], playerNick[64], alias[64];
	Whois_Field(text, "steam_id", steam, sizeof(steam));
	Claim_JsonField(text, "steam_count", steamCount, sizeof(steamCount));
	Whois_Field(text, "nicks", nicks, sizeof(nicks));
	Claim_JsonField(text, "nick_count", nickCount, sizeof(nickCount));
	Claim_JsonField(text, "matches", matches, sizeof(matches));
	Claim_JsonField(text, "last_played", last, sizeof(last));
	Claim_JsonField(text, "player_id", playerId, sizeof(playerId));
	Whois_Field(text, "player_nick", playerNick, sizeof(playerNick));
	Whois_Field(text, "alias", alias, sizeof(alias));

	// Encabezado: el nombre del conectado consultado o, si es un desconectado, el último nick.
	char title[MAX_NAME_LENGTH];
	if (client > 0 && g_sWhoisLabel[client][0])
		strcopy(title, sizeof(title), g_sWhoisLabel[client]);
	else if (Whois_ClientBySteam(steam))
		GetClientName(Whois_ClientBySteam(steam), title, sizeof(title));
	else if (nicks[0])
	{
		if (SplitString(nicks, ",", title, sizeof(title)) == -1)
			strcopy(title, sizeof(title), nicks);
	}
	else
		strcopy(title, sizeof(title), playerNick[0] ? playerNick : "?");
	ReplaceString(title, sizeof(title), "{", "(");
	int extra = StringToInt(steamCount) - 1;
	if (extra > 0)
		QolReply(client, "[%s] {#amarillo}%s{#normal} (%s, y %d SteamID más en su ficha)", g_sTag, title, steam, extra);
	else
		QolReply(client, "[%s] {#amarillo}%s{#normal} (%s)", g_sTag, title, steam);

	int total = StringToInt(nickCount);
	if (total > 0)
		QolReply(client, "  Nicks (%d, en %s partidas, la última el %s): %s%s", total, matches, last, nicks, total > 6 ? ", …" : "");
	else
		QolReply(client, "  Sin partidas registradas.");

	if (!playerId[0])
	{
		QolReply(client, "  Sin perfil en la web.");
		return;
	}
	QolReply(client, "  En la web: ficha {#verde}%s{#normal}%s%s", playerNick, alias[0] ? " · cuenta " : "", alias);
}

/** Varios candidatos: menú si preguntó por el chat; si no, la lista en texto. */
void Whois_ShowCandidates(int client, const char[] text)
{
	char totalText[8], list[2048], items[WHOIS_MENU_MAX][160];
	Claim_JsonField(text, "total", totalText, sizeof(totalText));
	Whois_Field(text, "candidates", list, sizeof(list));
	int total = StringToInt(totalText);
	int count = ExplodeString(list, ";", items, sizeof(items), sizeof(items[]));

	bool useMenu = client > 0 && g_iWhoisReply[client] == SM_REPLY_TO_CHAT;
	Menu menu;
	if (useMenu)
	{
		menu = new Menu(Whois_MenuHandler);
		menu.SetTitle("¿A quién querés revisar? (%d)", total);
	}
	else
		QolReply(client, "[%s] Hay %d jugadores parecidos:", g_sTag, total);

	for (int k = 0; k < count; k++)
	{
		// steam|online|nick|partidas|ficha
		char parts[5][64];
		if (ExplodeString(items[k], "|", parts, sizeof(parts), sizeof(parts[])) < 5)
			continue;
		char name[MAX_NAME_LENGTH], line[128];
		int target = Whois_ClientBySteam(parts[1]);
		if (target)
			GetClientName(target, name, sizeof(name));
		else
			strcopy(name, sizeof(name), parts[2][0] ? parts[2] : "?");
		bool ficha = StrEqual(parts[4], "1");
		if (parts[1][0])
			Format(line, sizeof(line), "%s · conectado%s", name, ficha ? " · ficha" : "");
		else
			Format(line, sizeof(line), "%s · %s partidas%s", name, parts[3], ficha ? " · ficha" : "");

		if (useMenu)
		{
			char info[96];
			Format(info, sizeof(info), "%s|%s", parts[0], parts[1]);
			menu.AddItem(info, line);
		}
		else
		{
			ReplaceString(line, sizeof(line), "{", "(");
			QolReply(client, "  %s (%s)", line, parts[0]);
		}
	}

	if (!useMenu)
	{
		if (total > count)
			QolReply(client, "  … y %d más: escribí más del nombre.", total - count);
		QolReply(client, "[%s] Usá {#amarillo}!whois <SteamID>{#normal} para ver uno.", g_sTag);
		return;
	}
	if (total > count)
	{
		char more[64];
		Format(more, sizeof(more), "Hay %d: escribí más del nombre", total);
		menu.AddItem("", more, ITEMDRAW_DISABLED);
	}
	menu.Display(client, WHOIS_MENU_TIME);
}

public int Whois_MenuHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
	{
		delete menu;
	}
	else if (action == MenuAction_Select)
	{
		// info: "steam|online" (online vacío si está desconectado). Sin la espera de 3 segundos.
		char info[96], parts[2][48];
		menu.GetItem(item, info, sizeof(info));
		ExplodeString(info, "|", parts, sizeof(parts), sizeof(parts[]));
		int target = Whois_ClientBySteam(parts[1]);
		if (target)
			GetClientName(target, g_sWhoisLabel[client], sizeof(g_sWhoisLabel[]));
		else
			g_sWhoisLabel[client][0] = '\0';
		g_iWhoisReply[client] = SM_REPLY_TO_CHAT;
		Whois_Send(client, parts[0], "", "");
	}
	return 0;
}

/** Un texto de la respuesta, sin llaves (que la base no pueda meter colores). */
void Whois_Field(const char[] json, const char[] key, char[] out, int maxlen)
{
	Claim_JsonField(json, key, out, maxlen);
	ReplaceString(out, maxlen, "{", "(");
}
