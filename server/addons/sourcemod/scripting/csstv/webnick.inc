/**
 * Los nombres de los jugadores (2.10.1, 2.10.3; planes: docs/bitacora/2026-11-12-cuchillo-por-vida-y-nombre-web y
 * docs/bitacora/2026-11-25-nombre-web-en-vivo). Es el único plugin nuestro que los toca: desde la 2.10.3 también hace el
 * bloqueo con la partida empezada, que antes era de csstv_qol (los dos a la vez se peleaban sin fin).
 *
 *  - Ficha: al entrar, a quien tiene una ficha vinculada a su SteamID (principal o adicional) se le pone el nick de la
 *    ficha (players.nick). Lo da la base: csstv_web_nick(token, steam). Si se lo cambia, vuelve. Después de un !claim que
 *    vincula, se vuelve a pedir. csstv_web_names 0 lo apaga.
 *  - VIP (Kyan, 2026-11-12): usa el nombre que quiera, también con la partida empezada.
 *  - Sin ficha, ficha privada o la web no responde: su nombre. Con la partida empezada no se lo puede cambiar
 *    (csstv_lock_names 0 lo apaga).
 *  - El nick se limpia antes de ponerlo (WebNick_Clean): lo que el motor saca, lo que el anticheat no acepta y lo que no
 *    se ve en el juego (emojis, invisibles, marcas apiladas). Si no queda nada que se lea, sigue con su nombre.
 *  - Si el motor le pone "(1)" por estar repetido, se acepta. Y hay un tope de reposiciones por jugador, para que otro
 *    plugin que toque los nombres no arme un bucle.
 *  - csstv_webnick_fake <userid> <nick> [vip] simula la respuesta de la base (pruebas con bots).
 */

#if defined _csstv_webnick_included
	#endinput
#endif
#define _csstv_webnick_included

#define WEBNICK_WARN_EVERY 10
#define WEBNICK_LEN        32    // el motor guarda 31 bytes. No MAX_NAME_LENGTH: en los include de SourceMod 1.10 es 128
#define WEBNICK_SETS_MAX   5     // reposiciones, como mucho, en WEBNICK_SETS_TIME segundos
#define WEBNICK_SETS_TIME  10

ConVar g_cvWebNames;
ConVar g_cvLockNames;
char g_sWebNick[MAXPLAYERS + 1][WEBNICK_LEN];       // nick de la ficha ("" = sin ficha o sin respuesta todavía)
char g_sWebNickOwn[MAXPLAYERS + 1][WEBNICK_LEN];    // su nombre antes de que empezara la partida (sin ficha, no se lo cambia)
bool g_bWebNickVip[MAXPLAYERS + 1];                 // es VIP: usa el nombre que quiera
int g_iWebNickSets[MAXPLAYERS + 1];                 // reposiciones desde g_iWebNickSetsAt
int g_iWebNickSetsAt[MAXPLAYERS + 1];
bool g_bWebNickWait[MAXPLAYERS + 1];                // pasó el tope: hay una reposición pendiente con timer
bool g_bWebNickSetting[MAXPLAYERS + 1];             // el plugin le está poniendo el nombre: no es un cambio del jugador
int g_iWebNickWarnAt[MAXPLAYERS + 1];

void WebNick_Init()
{
	g_cvWebNames = CreateConVar("csstv_web_names", "1", "A quien tiene ficha en la web se le pone el nick de la ficha y no se lo puede cambiar (0 = cada uno con su nombre).", _, true, 0.0, true, 1.0);
	g_cvLockNames = CreateConVar("csstv_lock_names", "1", "Con la partida empezada, quien no tiene ficha no se puede cambiar el nombre.", _, true, 0.0, true, 1.0);
	g_cvWebNames.AddChangeHook(WebNick_OnCvarChanged);
	RegServerCmd("csstv_webnick_fake", Cmd_WebNickFake, "Solo pruebas: csstv_webnick_fake <userid> <nick> [vip] (como si la base respondiera ese nick; \"\" = sin ficha; 1 = VIP).");
}

void WebNick_ClientReset(int client)
{
	g_sWebNick[client][0] = '\0';
	GetClientName(client, g_sWebNickOwn[client], sizeof(g_sWebNickOwn[]));
	g_bWebNickVip[client] = false;
	g_iWebNickSets[client] = 0;
	g_iWebNickSetsAt[client] = 0;
	g_bWebNickWait[client] = false;
	g_bWebNickSetting[client] = false;
	g_iWebNickWarnAt[client] = 0;
}

public void WebNick_OnCvarChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	if (!cv.BoolValue)
		for (int i = 1; i <= MaxClients; i++)
		{
			g_sWebNick[i][0] = '\0';
			g_bWebNickVip[i] = false;
		}
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
	char ok[8], vip[8], nick[128];   // el alias tiene hasta 24 caracteres de hasta 4 bytes
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
	g_bWebNickVip[client] = vip;
	g_sWebNick[client][0] = '\0';
	if (vip)
	{
		LogMessage("Nombre de la web: %N es VIP, sigue con su nombre.", client);
		return;
	}
	if (!WebNick_Clean(nick, g_sWebNick[client], sizeof(g_sWebNick[])))
	{
		if (nick[0])
			LogMessage("Nombre de la web: el de %N no se puede poner en el juego (%s), sigue con el suyo.", client, nick);
		g_sWebNick[client][0] = '\0';
		return;
	}
	if (WebNick_IsOk(client))
		return;
	LogMessage("Nombre de la web: %N pasa a llamarse %s.", client, g_sWebNick[client]);
	WebNick_Set(client, g_sWebNick[client]);
	QolChat(client, "%s En este servidor usás el nombre de tu ficha: {#amarillo}%s{#normal}.", PREFIX, g_sWebNick[client]);
}

/**
 * El nick como va en el juego. Saca lo que el motor saca solo (% y ~, # al principio: si no, nunca quedaría igual), lo que
 * el anticheat no acepta (caracteres de control, & al principio o antes de #, espacio duro), las comillas y barras
 * invertidas, y lo que no se ve: 4 bytes (emojis), invisibles, dirección del texto y marcas apiladas. Corta en 31 bytes
 * sin partir un carácter. Devuelve false si no quedan al menos 2 caracteres.
 */
bool WebNick_Clean(const char[] nick, char[] out, int maxlen)
{
	int len = strlen(nick), j, count;
	out[0] = '\0';
	for (int i = 0; i < len;)
	{
		int c = nick[i] & 0xFF, n = c < 0x80 ? 1 : (c & 0xE0) == 0xC0 ? 2 : (c & 0xF0) == 0xE0 ? 3 : (c & 0xF8) == 0xF0 ? 4 : 0;
		int code = n == 1 ? c : n == 2 ? c & 0x1F : n == 3 ? c & 0x0F : c & 0x07;
		bool bad = n == 0 || i + n > len;
		for (int k = 1; k < n && !bad; k++)
		{
			if ((nick[i + k] & 0xC0) != 0x80)
				bad = true;
			code = (code << 6) | (nick[i + k] & 0x3F);
		}
		if (bad)
		{
			i++;
			continue;
		}
		int at = i;
		i += n;
		if (n == 4 || WebNick_Hidden(code))
			continue;
		if (code == 0xA0 || code == 0x3000 || (code >= 0x2000 && code <= 0x200A) || code == 0x202F || code == 0x205F)
			code = ' ';
		else if (code == '"')
			code = '\'';
		else if (code == '\\')
			code = '/';
		else if (code == '{')
			code = '(';
		else if (code == '}')
			code = ')';
		if (code < 32 || code == 127 || code == '%' || code == '~')
			continue;
		if (code == '&' && (j == 0 || nick[i] == '#'))
			continue;
		if (code == '#' && j == 0)
			continue;
		if (code == ' ' && (j == 0 || out[j - 1] == ' '))
			continue;
		if (code < 0x80)
			n = 1;
		if (j + n > maxlen - 1)
			break;
		if (n == 1)
			out[j++] = view_as<char>(code);
		else
			for (int k = 0; k < n; k++)
				out[j++] = nick[at + k];
		if (code != ' ')
			count++;
	}
	while (j > 0 && out[j - 1] == ' ')
		j--;
	out[j] = '\0';
	return count >= 2;
}

/** No se ve en el juego o cambia cómo se ve el resto: invisibles, dirección del texto, variantes y marcas apiladas. */
bool WebNick_Hidden(int c)
{
	return c == 0xAD || (c >= 0x80 && c < 0xA0) || (c >= 0x300 && c <= 0x36F) || (c >= 0x483 && c <= 0x489)
		|| (c >= 0x591 && c <= 0x5C7) || (c >= 0x610 && c <= 0x61C) || (c >= 0x64B && c <= 0x65F) || (c >= 0x115F && c <= 0x1160)
		|| (c >= 0x180B && c <= 0x180E) || (c >= 0x1AB0 && c <= 0x1AFF) || (c >= 0x1DC0 && c <= 0x1DFF)
		|| (c >= 0x200B && c <= 0x200F) || (c >= 0x2028 && c <= 0x202E) || (c >= 0x2060 && c <= 0x206F)
		|| (c >= 0x20D0 && c <= 0x20FF) || c == 0x2800 || c == 0x3164 || (c >= 0xD800 && c <= 0xF8FF)
		|| (c >= 0xFE00 && c <= 0xFE0F) || (c >= 0xFE20 && c <= 0xFE2F) || c == 0xFEFF || c == 0xFFA0 || (c >= 0xFFF0 && c <= 0xFFFF);
}

void WebNick_Set(int client, const char[] name)
{
	g_bWebNickSetting[client] = true;
	SetClientName(client, name);
	g_bWebNickSetting[client] = false;
}

bool WebNick_InMatch()
{
	return g_State == State_Starting || g_State == State_Live || g_State == State_Halftime || g_State == State_Knife;
}

/** El nombre que tiene que tener: el de la ficha o, con la partida empezada, el que traía. false: el que quiera. */
bool WebNick_Want(int client, char[] name, int maxlen)
{
	if (g_bWebNickVip[client])
		return false;
	if (g_sWebNick[client][0] && g_cvWebNames.BoolValue)
		return strcopy(name, maxlen, g_sWebNick[client]) > 0;
	if (g_cvLockNames.BoolValue && WebNick_InMatch())
		return strcopy(name, maxlen, g_sWebNickOwn[client]) > 0;
	return false;
}

/** Tiene el nombre que tiene que tener, o ese con el "(1)" que le pone el motor si otro ya lo usa. */
bool WebNick_IsOk(int client)
{
	char want[WEBNICK_LEN], name[WEBNICK_LEN];
	if (!WebNick_Want(client, want, sizeof(want)))
		return true;
	GetClientName(client, name, sizeof(name));
	if (StrEqual(name, want))
		return true;
	if (name[0] != '(')
		return false;
	int i = 1;
	while (IsCharNumeric(name[i]))
		i++;
	if (i == 1 || name[i] != ')')
		return false;
	// Con el "(1)" adelante, el motor puede cortar el final.
	int len = strlen(name[i + 1]);
	return len > 0 && strncmp(name[i + 1], want, len) == 0 && (len == strlen(want) || strlen(name) >= WEBNICK_LEN - 4);
}

/** El jugador se cambió el nombre (o cualquier otro ajuste): si no es el que tiene que tener, vuelve. */
public void OnClientSettingsChanged(int client)
{
	if (client <= 0 || g_bWebNickSetting[client] || !IsClientInGame(client) || IsClientSourceTV(client))
		return;
	if (!WebNick_IsOk(client))
		// Un cuadro después: en este momento el motor todavía está aplicando el nombre nuevo.
		RequestFrame(WebNick_Restore, GetClientUserId(client));
	else if (!WebNick_InMatch() && !g_sWebNick[client][0])
		GetClientName(client, g_sWebNickOwn[client], sizeof(g_sWebNickOwn[]));
}

public void WebNick_Restore(int userid)
{
	int client = GetClientOfUserId(userid);
	char want[WEBNICK_LEN];
	if (!client || !IsClientInGame(client) || g_bWebNickWait[client] || WebNick_IsOk(client) || !WebNick_Want(client, want, sizeof(want)))
		return;
	int now = GetTime();
	if (now - g_iWebNickSetsAt[client] >= WEBNICK_SETS_TIME)
	{
		g_iWebNickSetsAt[client] = now;
		g_iWebNickSets[client] = 0;
	}
	if (++g_iWebNickSets[client] > WEBNICK_SETS_MAX)
	{
		g_bWebNickWait[client] = true;
		LogMessage("Nombre de la web: %N cambió de nombre %d veces en %d s; se repone en un rato.", client, WEBNICK_SETS_MAX, WEBNICK_SETS_TIME);
		CreateTimer(float(WEBNICK_SETS_TIME), WebNick_RestoreLater, userid, TIMER_FLAG_NO_MAPCHANGE);
		return;
	}
	WebNick_Set(client, want);
	if (now >= g_iWebNickWarnAt[client])
	{
		g_iWebNickWarnAt[client] = now + WEBNICK_WARN_EVERY;
		if (g_sWebNick[client][0])
			QolChat(client, "%s En este servidor usás el nombre de tu ficha. Para cambiarlo, cambialo en tu perfil de {#amarillo}cmleague.lat{#normal}.", PREFIX);
		else
			QolChat(client, "%s Durante la partida no se puede cambiar el nombre.", PREFIX);
	}
}

public Action WebNick_RestoreLater(Handle timer, any userid)
{
	int client = GetClientOfUserId(userid);
	if (client)
	{
		g_bWebNickWait[client] = false;
		WebNick_Restore(userid);
	}
	return Plugin_Stop;
}

public Action Cmd_WebNickFake(int args)
{
	char buf[16], nick[128], vip[4];
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
