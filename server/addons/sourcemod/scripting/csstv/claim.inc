/**
 * !claim: vincular el SteamID del jugador a su cuenta de la web
 * (plan: docs/bitacora/2026-10-18-plugin-claim; reglas: docs/bitacora/2026-10-16-claim-steamid).
 *
 *  - !claim <código>: el código de 6 caracteres que la cuenta genera en Mi perfil (vale 10 minutos).
 *    El primer SteamID de la cuenta queda vinculado al instante; uno adicional queda como pedido
 *    que aprueba un admin. Las reglas las aplica la base (claim_with_code).
 *  - En cualquier momento (calentamiento o partida). Un pedido cada 10 segundos por jugador.
 *  - La respuesta va solo al jugador.
 *
 * claim_with_code responde siempre 200 con { ok, pending, message, alias }: un "no" llega en
 * message, y un error HTTP o sin conexión es una falla de la web.
 */

#if defined _csstv_claim_included
	#endinput
#endif
#define _csstv_claim_included

#define CLAIM_CODE_LEN 6
#define CLAIM_COOLDOWN 10

int g_iClaimLast[MAXPLAYERS + 1];   // GetTime() del último pedido del jugador
ConVar g_cvClaim;

void Claim_Init()
{
	// En 0 hasta el corte: claim_with_code es del replanteo y no existe en la base de producción.
	g_cvClaim = CreateConVar("csstv_claim", "1", "!claim habilitado (0 hasta que la web nueva esté en producción).", _, true, 0.0, true, 1.0);
	RegConsoleCmd("sm_claim", Cmd_Claim, "Vincular tu SteamID a tu cuenta de la web: !claim <código> (el código está en Mi perfil).");
}

void Claim_ClientReset(int client)
{
	g_iClaimLast[client] = 0;
}

public Action Cmd_Claim(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (!License_Allows())
	{
		License_Reply(client);
		return Plugin_Handled;
	}
	if (!g_cvClaim.BoolValue)
	{
		QolReply(client, "[%s] !claim todavía no está disponible: llega con la web nueva.", g_sTag);
		return Plugin_Handled;
	}
	if (!g_cvSend.BoolValue || !Http_Available() || !Http_Configured())
	{
		QolReply(client, "[%s] !claim no está disponible en este servidor.", g_sTag);
		return Plugin_Handled;
	}

	char code[16];
	GetCmdArg(1, code, sizeof(code));
	if (args == 0 || !Claim_NormalizeCode(code))
	{
		QolReply(client, "[%s] Generá tu código en la web ({#amarillo}Mi perfil{#normal}) y escribí {#amarillo}!claim <código>{#normal} (6 letras o números).", g_sTag);
		return Plugin_Handled;
	}

	char steam[40];
	if (!Link_ClientKey(client, steam, sizeof(steam)))
	{
		QolReply(client, "[%s] {#rojo}El servidor no tiene tu SteamID{#normal}: no se puede vincular. Reconectá y probá de nuevo.", g_sTag);
		return Plugin_Handled;
	}

	int now = GetTime();
	if (g_iClaimLast[client] && now - g_iClaimLast[client] < CLAIM_COOLDOWN)
	{
		QolReply(client, "[%s] Esperá %d segundos antes de probar de nuevo.", g_sTag, CLAIM_COOLDOWN - (now - g_iClaimLast[client]));
		return Plugin_Handled;
	}
	g_iClaimLast[client] = now;
	Claim_Send(client, steam, code);
	return Plugin_Handled;
}

/** Deja el código en mayúsculas; false si no tiene la forma de un código. */
bool Claim_NormalizeCode(char[] code)
{
	TrimString(code);
	if (strlen(code) != CLAIM_CODE_LEN)
		return false;
	for (int i = 0; i < CLAIM_CODE_LEN; i++)
	{
		code[i] = CharToUpper(code[i]);
		if (!IsCharAlpha(code[i]) && !IsCharNumeric(code[i]))
			return false;
	}
	return true;
}

void Claim_Send(int client, const char[] steam, const char[] code)
{
	char url[256], key[512], token[128], nick[MAX_NAME_LENGTH], nickJson[MAX_NAME_LENGTH * 2], body[512];
	g_cvApiUrl.GetString(url, sizeof(url));
	int rpc = StrContains(url, "/rpc/", false);
	if (rpc == -1)
	{
		QolReply(client, "[%s] !claim no está disponible en este servidor.", g_sTag);
		return;
	}
	url[rpc + 5] = '\0';
	StrCat(url, sizeof(url), "claim_with_code");
	g_cvApiKey.GetString(key, sizeof(key));
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);
	GetClientName(client, nick, sizeof(nick));
	Claim_SafeNick(nick, nickJson, sizeof(nickJson));
	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_steam\":\"%s\",\"p_code\":\"%s\",\"p_nick\":\"%s\"}", token, steam, code, nickJson);

	System2HTTPRequest req = new System2HTTPRequest(Claim_OnResponse, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CSSTV-Reporter/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 15;
	req.Any = GetClientUserId(client);
	req.POST();
	delete req;
	QolReply(client, "[%s] Vinculando tu SteamID…", g_sTag);
}

public void Claim_OnResponse(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	int client = GetClientOfUserId(request.Any);
	int status = success && response != null ? response.StatusCode : 0;
	char text[1024];
	if (response != null)
		response.GetContent(text, sizeof(text));

	if (status != 200)
	{
		LogError("claim_with_code: %s %s", status ? "HTTP" : "sin conexión", status ? text : error);
		if (client)
			QolReply(client, "[%s] No se pudo consultar la web (%s). Probá de nuevo.", g_sTag, status ? "error del servidor" : "sin conexión");
		return;
	}

	char ok[8], pending[8], message[192], alias[64];
	Claim_JsonField(text, "ok", ok, sizeof(ok));
	Claim_JsonField(text, "pending", pending, sizeof(pending));
	Claim_JsonField(text, "message", message, sizeof(message));
	Claim_JsonField(text, "alias", alias, sizeof(alias));
	ReplaceString(message, sizeof(message), "{", "(");   // que la base no pueda meter colores
	ReplaceString(alias, sizeof(alias), "{", "(");
	if (!message[0])
		strcopy(message, sizeof(message), "No se pudo vincular: probá de nuevo en un rato");

	bool isOk = StrEqual(ok, "true"), isPending = StrEqual(pending, "true");
	if (client)
	{
		char auth[40];
		if (!Link_ClientKey(client, auth, sizeof(auth)))
			strcopy(auth, sizeof(auth), "?");
		LogMessage("!claim de %N [%s]: %s", client, auth, message);
		if (isOk && !isPending && alias[0])
			QolReply(client, "[%s] {#verde}%s{#normal} (cuenta {#amarillo}%s{#normal}).", g_sTag, message, alias);
		else
			QolReply(client, "[%s] %s%s{#normal}.", g_sTag, isPending ? "{#amarillo}" : (isOk ? "{#verde}" : "{#rojo}"), message);
	}
	else
		LogMessage("!claim de un jugador que ya se fue: %s", message);
}

/**
 * El nick listo para ir entre comillas en el JSON (solo queda en el registro de reclamos): sin
 * comillas, barras ni caracteres de control, y "?" en lugar de los bytes que no son UTF-8 válido.
 * No usa J_Str porque escribe en el buffer del resultado de la partida.
 */
void Claim_SafeNick(const char[] s, char[] out, int maxlen)
{
	int len = strlen(s), i, j;
	while (i < len && j < maxlen - 5)
	{
		int c = s[i] & 0xFF;
		if (c < 0x80)
		{
			if (c >= 0x20 && c != '"' && c != '\\')
				out[j++] = c;
			i++;
			continue;
		}
		int n = 0;
		if (c >= 0xC2 && c <= 0xDF) n = 2;
		else if (c >= 0xE0 && c <= 0xEF) n = 3;
		else if (c >= 0xF0 && c <= 0xF4) n = 4;
		bool valid = n > 0 && i + n <= len;
		for (int k = 1; valid && k < n; k++)
			if ((s[i + k] & 0xFF) < 0x80 || (s[i + k] & 0xFF) > 0xBF)
				valid = false;
		if (valid)
		{
			for (int k = 0; k < n; k++)
				out[j++] = s[i + k];
			i += n;
		}
		else
		{
			out[j++] = '?';
			i++;
		}
	}
	out[j] = '\0';
}

/**
 * Valor de una clave del objeto JSON de primer nivel: el texto sin comillas para un string,
 * o tal cual para true, false, null y números. Vacío si no está o es null.
 */
void Claim_JsonField(const char[] json, const char[] key, char[] out, int maxlen)
{
	out[0] = '\0';
	char needle[40];
	Format(needle, sizeof(needle), "\"%s\"", key);
	int p = StrContains(json, needle);
	if (p == -1)
		return;
	p += strlen(needle);
	while (json[p] == ' ' || json[p] == ':')
		p++;
	int j;
	if (json[p] == '"')
	{
		p++;
		while (json[p] != '\0' && json[p] != '"' && j < maxlen - 1)
		{
			if (json[p] == '\\' && json[p + 1] != '\0')
			{
				p++;
				switch (json[p])
				{
					case 'n', 't': out[j++] = ' ';
					case 'r': {}
					case 'u': { out[j++] = '?'; p += 4; }   // los textos en UTF-8 vienen sin escapar
					default: out[j++] = json[p];
				}
				p++;
				continue;
			}
			out[j++] = json[p++];
		}
	}
	else
	{
		while (json[p] != '\0' && json[p] != ',' && json[p] != '}' && json[p] != ' ' && j < maxlen - 1)
			out[j++] = json[p++];
		if (StrEqual(out, "null"))
			j = 0;
	}
	out[j] = '\0';
}
