/**
 * Licencia del servidor.
 *
 * Al cargar cada mapa y cada 30 minutos se llama a csstv_license(token, versión) en
 * Supabase. Sin una licencia válida no se pueden empezar partidas, sm_team no anda y
 * la cola de resultados espera. Una partida en curso nunca se corta.
 *
 * Si Supabase no responde (red, 5xx, etc.) se usa la última validación buena, guardada
 * en data/csstv/license.txt, durante LICENSE_GRACE segundos. Solo un "ok: false" de
 * Supabase bloquea de inmediato.
 */

#if defined _csstv_license_included
	#endinput
#endif
#define _csstv_license_included

#define LICENSE_GRACE   259200   // 72 horas
#define LICENSE_RECHECK 1800.0   // 30 minutos
#define LICENSE_RETRY   60.0     // reintento tras una falla de red

enum LicenseState
{
	Lic_Unknown = 0,  // todavía no hubo respuesta y no hay validación guardada
	Lic_Ok,           // Supabase dijo que sí
	Lic_Grace,        // sin respuesta, pero hubo una validación buena hace menos de 72 h
	Lic_Denied        // Supabase dijo que no, o no hay forma de validar
};

LicenseState g_License = Lic_Unknown;
char g_sLicenseReason[48];   // motivo del rechazo (token, expired, ip, build, …)
char g_sLicenseName[48];     // nombre del servidor en la web
char g_sLicenseExpires[40];  // vencimiento (vacío = no vence)
int g_iLicenseOkAt;          // GetTime() de la última validación buena
bool g_bLicenseChecking;
Handle g_hLicenseRetry;

void License_Init()
{
	RegAdminCmd("sm_csstv_license", Cmd_License, ADMFLAG_RCON, "Vuelve a validar la licencia del servidor con CSSTV.");
	g_iLicenseOkAt = License_LoadCache();
	if (g_iLicenseOkAt > 0 && GetTime() - g_iLicenseOkAt < LICENSE_GRACE)
		g_License = Lic_Grace;
	CreateTimer(LICENSE_RECHECK, Timer_LicenseRecheck, _, TIMER_REPEAT);
}

bool License_Allows()
{
	return g_License == Lic_Ok || g_License == Lic_Grace;
}

void License_ReasonText(char[] text, int maxlen)
{
	if (StrEqual(g_sLicenseReason, "token"))
		strcopy(text, maxlen, "token inválido o revocado");
	else if (StrEqual(g_sLicenseReason, "expired"))
		strcopy(text, maxlen, "la licencia venció");
	else if (StrEqual(g_sLicenseReason, "ip"))
		strcopy(text, maxlen, "el token no está autorizado desde la IP de este servidor");
	else if (StrEqual(g_sLicenseReason, "build"))
		strcopy(text, maxlen, "este plugin fue compilado para otro servidor");
	else if (StrEqual(g_sLicenseReason, "config"))
		strcopy(text, maxlen, "falta configurar csstv_api_url, csstv_api_key o csstv_server_token");
	else if (StrEqual(g_sLicenseReason, "system2"))
		strcopy(text, maxlen, "falta la extensión System2");
	else if (g_sLicenseReason[0])
		Format(text, maxlen, "no se pudo validar (%s)", g_sLicenseReason);
	else
		strcopy(text, maxlen, "validando…");
}

// Respuesta a quien intenta usar algo bloqueado.
void License_Reply(int client)
{
	char why[96];
	License_ReasonText(why, sizeof(why));
	ReplyToCommand(client, "[%s] Este servidor no tiene una licencia válida de CSSTV (%s). Los mixes están desactivados.", g_sTag, why);
}

void License_StatusText(char[] text, int maxlen)
{
	char why[96];
	switch (g_License)
	{
		case Lic_Ok:
			Format(text, maxlen, "válida · %s · %s", g_sLicenseName, g_sLicenseExpires[0] ? g_sLicenseExpires : "no vence");
		case Lic_Grace:
		{
			License_ReasonText(why, sizeof(why));
			Format(text, maxlen, "sin respuesta de Supabase (%s); se usa la validación de hace %d min", why, (GetTime() - g_iLicenseOkAt) / 60);
		}
		case Lic_Denied:
		{
			License_ReasonText(why, sizeof(why));
			Format(text, maxlen, "NO VÁLIDA: %s", why);
		}
		default:
			strcopy(text, maxlen, "validando…");
	}
}

public Action Cmd_License(int client, int args)
{
	License_Check();
	ReplyToCommand(client, "[%s] Validando la licencia. Mirá el resultado con sm_csstv_status.", g_sTag);
	return Plugin_Handled;
}

public Action Timer_LicenseRecheck(Handle timer)
{
	License_Check();
	return Plugin_Continue;
}

public Action Timer_LicenseRetry(Handle timer)
{
	g_hLicenseRetry = null;
	License_Check();
	return Plugin_Stop;
}

void License_Check()
{
	if (g_bLicenseChecking)
		return;
	if (!Http_Available())
	{
		License_Set(Lic_Denied, "system2");
		return;
	}
	if (!Http_Configured())
	{
		License_Set(Lic_Denied, "config");
		return;
	}

	// csstv_api_url apunta a …/rest/v1/rpc/ingest_server_chunk: se cambia la función.
	char url[256], key[512], token[128], body[256];
	g_cvApiUrl.GetString(url, sizeof(url));
	int rpc = StrContains(url, "/rpc/", false);
	if (rpc == -1)
	{
		License_Set(Lic_Denied, "config");
		return;
	}
	url[rpc + 5] = '\0';
	StrCat(url, sizeof(url), "csstv_license");
	g_cvApiKey.GetString(key, sizeof(key));
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);
	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_version\":\"%s\"}", token, PLUGIN_VERSION);

	System2HTTPRequest req = new System2HTTPRequest(License_OnResponse, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CSSTV-Reporter/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 20;
	req.POST();
	delete req;
	g_bLicenseChecking = true;
}

public void License_OnResponse(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	g_bLicenseChecking = false;
	int status = success && response != null ? response.StatusCode : 0;
	char content[512];
	if (response != null)
		response.GetContent(content, sizeof(content));

	if (status == 200 && (StrContains(content, "\"ok\": true") != -1 || StrContains(content, "\"ok\":true") != -1))
	{
		static const char expected[] = CSSTV_LICENSE_ID;
		char id[40];
		JsonField(content, "server_id", id, sizeof(id));
		if (expected[0] && !StrEqual(id, expected, false))
		{
			License_Set(Lic_Denied, "build");
			return;
		}
		JsonField(content, "name", g_sLicenseName, sizeof(g_sLicenseName));
		JsonField(content, "expires_at", g_sLicenseExpires, sizeof(g_sLicenseExpires));
		g_iLicenseOkAt = GetTime();
		License_SaveCache(g_iLicenseOkAt);
		License_Set(Lic_Ok, "");
		return;
	}
	if (status == 200 && (StrContains(content, "\"ok\": false") != -1 || StrContains(content, "\"ok\":false") != -1))
	{
		char reason[32];
		JsonField(content, "reason", reason, sizeof(reason));
		License_SaveCache(0);
		g_iLicenseOkAt = 0;
		License_Set(Lic_Denied, reason[0] ? reason : "token");
		return;
	}

	// Falla de red o respuesta inesperada: no es un "no" de Supabase.
	char why[48];
	if (status == 0)
		strcopy(why, sizeof(why), "sin conexión");
	else
		Format(why, sizeof(why), "HTTP %d", status);
	LogError("No se pudo validar la licencia: %s %s", why, status == 0 ? error : content);
	bool grace = g_iLicenseOkAt > 0 && GetTime() - g_iLicenseOkAt < LICENSE_GRACE;
	License_Set(grace ? Lic_Grace : Lic_Denied, why);
	if (g_hLicenseRetry == null)
		g_hLicenseRetry = CreateTimer(LICENSE_RETRY, Timer_LicenseRetry);
}

void License_Set(LicenseState state, const char[] reason)
{
	bool before = License_Allows();
	g_License = state;
	strcopy(g_sLicenseReason, sizeof(g_sLicenseReason), reason);
	bool now = License_Allows();
	if (before == now)
		return;

	char text[160];
	License_StatusText(text, sizeof(text));
	if (now)
	{
		LogMessage("Licencia: %s", text);
		Http_ScheduleProcess(1.0);   // la cola pudo quedar esperando
	}
	else
	{
		LogError("Licencia: %s. Los mixes quedan desactivados.", text);
		PrintToChatAll("%s Este servidor no tiene una licencia válida de CSSTV. Los mixes están desactivados.", PREFIX);
	}
}

// Valor de "campo": "texto" (o sin comillas) en el JSON plano que devuelve csstv_license.
void JsonField(const char[] json, const char[] field, char[] out, int maxlen)
{
	out[0] = '\0';
	char needle[48];
	Format(needle, sizeof(needle), "\"%s\":", field);
	int pos = StrContains(json, needle);
	if (pos == -1)
		return;
	pos += strlen(needle);
	while (json[pos] == ' ')
		pos++;
	if (json[pos] == '"')
	{
		pos++;
		int i;
		while (json[pos] != '\0' && json[pos] != '"' && i < maxlen - 1)
			out[i++] = json[pos++];
		out[i] = '\0';
	}
	else if (StrContains(json[pos], "null") != 0)
	{
		int i;
		while (json[pos] != '\0' && json[pos] != ',' && json[pos] != '}' && i < maxlen - 1)
			out[i++] = json[pos++];
		out[i] = '\0';
	}
}

int License_LoadCache()
{
	char path[PLATFORM_MAX_PATH], line[32];
	BuildPath(Path_SM, path, sizeof(path), "data/csstv/license.txt");
	File f = OpenFile(path, "r");
	if (f == null)
		return 0;
	int okAt;
	if (f.ReadLine(line, sizeof(line)))
	{
		TrimString(line);
		okAt = StringToInt(line);
	}
	delete f;
	return okAt > GetTime() ? 0 : okAt;   // una fecha en el futuro no vale
}

void License_SaveCache(int okAt)
{
	char path[PLATFORM_MAX_PATH];
	BuildPath(Path_SM, path, sizeof(path), "data/csstv/license.txt");
	File f = OpenFile(path, "w");
	if (f == null)
		return;
	f.WriteLine("%d", okAt);
	delete f;
}
