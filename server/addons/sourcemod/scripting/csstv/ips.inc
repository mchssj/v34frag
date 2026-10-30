// IPs de los jugadores (plan docs/bitacora/2026-10-29-ips-jugadores).
// Junta en memoria cada intento de conexión (por IP) y cada entrada con el SteamID validado, y los manda cada
// 60 segundos a csstv_connections. Un pedido por conexión sería otra forma de tumbar el servidor en un ataque.
// Es un registro: si el envío falla, se descarta.

#define IPS_FLUSH_SECONDS 60.0
#define IPS_MAX_SEEN      64    // entradas guardadas a la vez
#define IPS_MAX_ATTEMPTS  256   // IPs distintas guardadas a la vez
#define IPS_BODY_MAX      1900  // el resto de los envíos del plugin usa cuerpos de menos de 2 KB
#define IPS_MAX_REQUESTS  8     // pedidos por vuelta; lo que no entra queda para la siguiente

ConVar g_cvIps;
StringMap g_hIpAttempts;   // IP -> conexiones desde el último envío
ArrayList g_hIpSeen;       // cada elemento: {"steam":"…","ip":"…","nick":"…"}

void Ips_Init()
{
	g_cvIps = CreateConVar("csstv_ips", "1", "Registra la IP de cada entrada al servidor y los intentos de conexión (solo los ven los admins de la web).", _, true, 0.0, true, 1.0);
	g_hIpAttempts = new StringMap();
	g_hIpSeen = new ArrayList(ByteCountToCells(192));
	CreateTimer(IPS_FLUSH_SECONDS, Timer_IpsFlush, _, TIMER_REPEAT);
	RegAdminCmd("sm_csstv_ips", Cmd_Ips, ADMFLAG_RCON, "Muestra cuántas entradas e IPs esperan para registrarse y las manda ahora.");
#if defined CSSTV_DEBUG
	RegServerCmd("csstv_ips_fake", Cmd_IpsFake, "Solo pruebas: csstv_ips_fake <steam> <ip> <nick> [intentos].");
#endif
}

public Action Cmd_Ips(int client, int args)
{
	ReplyToCommand(client, "[CSSTV] IPs: %d entradas y %d IPs con intentos por mandar (csstv_ips %d).",
		g_hIpSeen.Length, g_hIpAttempts.Size, g_cvIps.IntValue);
	Timer_IpsFlush(null);
	return Plugin_Handled;
}

#if defined CSSTV_DEBUG
public Action Cmd_IpsFake(int args)
{
	char steam[32], ip[48], nick[64], n[12], entry[192];
	GetCmdArg(1, steam, sizeof(steam));
	GetCmdArg(2, ip, sizeof(ip));
	GetCmdArg(3, nick, sizeof(nick));
	GetCmdArg(4, n, sizeof(n));
	if (steam[0] && !StrEqual(steam, "-"))
	{
		Format(entry, sizeof(entry), "{\"steam\":\"%s\",\"ip\":\"%s\",\"nick\":\"%s\"}", steam, ip, nick);
		g_hIpSeen.PushString(entry);
	}
	int have;
	g_hIpAttempts.GetValue(ip, have);
	g_hIpAttempts.SetValue(ip, have + (n[0] ? StringToInt(n) : 1));
	PrintToServer("[CSSTV] IPs falsas: %d entradas y %d IPs.", g_hIpSeen.Length, g_hIpAttempts.Size);
	return Plugin_Handled;
}
#endif

static bool Ips_On()
{
	return g_cvEnabled.BoolValue && g_cvIps.BoolValue && g_cvSend.BoolValue;
}

/** OnClientConnect: todavía sin SteamID validado. Cuenta también los que nunca terminan de entrar. */
void Ips_OnConnect(int client)
{
	if (!Ips_On() || IsFakeClient(client))
		return;
	char ip[48];
	if (!GetClientIP(client, ip, sizeof(ip)))
		return;
	int n;
	if (!g_hIpAttempts.GetValue(ip, n) && g_hIpAttempts.Size >= IPS_MAX_ATTEMPTS)
		return;
	g_hIpAttempts.SetValue(ip, n + 1);
}

/** OnClientPostAdminCheck: el SteamID ya está validado. */
void Ips_OnJoin(int client)
{
	if (!Ips_On() || IsFakeClient(client) || g_hIpSeen.Length >= IPS_MAX_SEEN)
		return;
	char steam[32], ip[48], name[MAX_NAME_LENGTH], nick[MAX_NAME_LENGTH * 2], entry[192];
	if (!GetClientAuthId(client, AuthId_Steam2, steam, sizeof(steam), true) || StrContains(steam, "STEAM_", false) != 0)
		return;
	if (!GetClientIP(client, ip, sizeof(ip)))
		return;
	GetClientName(client, name, sizeof(name));
	Claim_SafeNick(name, nick, sizeof(nick));
	Format(entry, sizeof(entry), "{\"steam\":\"%s\",\"ip\":\"%s\",\"nick\":\"%s\"}", steam, ip, nick);
	g_hIpSeen.PushString(entry);
}

public Action Timer_IpsFlush(Handle timer)
{
	if (!Ips_On())
	{
		g_hIpSeen.Clear();
		g_hIpAttempts.Clear();
		return Plugin_Continue;
	}
	for (int r = 0; r < IPS_MAX_REQUESTS && (g_hIpSeen.Length > 0 || g_hIpAttempts.Size > 0); r++)
		Ips_SendOne();
	return Plugin_Continue;
}

/** Arma un pedido de menos de IPS_BODY_MAX con lo que entre y lo saca de la memoria. */
static void Ips_SendOne()
{
	char url[256], key[512], token[128], seen[IPS_BODY_MAX], att[IPS_BODY_MAX], entry[192], ip[48], body[IPS_BODY_MAX + 256];
	g_cvApiUrl.GetString(url, sizeof(url));
	int rpc = StrContains(url, "/rpc/", false);
	if (rpc == -1)
	{
		g_hIpSeen.Clear();
		g_hIpAttempts.Clear();
		return;
	}
	url[rpc + 5] = '\0';
	StrCat(url, sizeof(url), "csstv_connections");
	g_cvApiKey.GetString(key, sizeof(key));
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);

	// Las entradas primero; los intentos con el lugar que queda.
	int used = 64;
	while (g_hIpSeen.Length > 0)
	{
		g_hIpSeen.GetString(0, entry, sizeof(entry));
		if (used + strlen(entry) + 1 > IPS_BODY_MAX)
			break;
		if (seen[0])
			StrCat(seen, sizeof(seen), ",");
		StrCat(seen, sizeof(seen), entry);
		used += strlen(entry) + 1;
		g_hIpSeen.Erase(0);
	}
	StringMapSnapshot snap = g_hIpAttempts.Snapshot();
	for (int i = 0; i < snap.Length; i++)
	{
		int n;
		snap.GetKey(i, ip, sizeof(ip));
		g_hIpAttempts.GetValue(ip, n);
		Format(entry, sizeof(entry), "{\"ip\":\"%s\",\"n\":%d}", ip, n);
		if (used + strlen(entry) + 1 > IPS_BODY_MAX)
			break;
		if (att[0])
			StrCat(att, sizeof(att), ",");
		StrCat(att, sizeof(att), entry);
		used += strlen(entry) + 1;
		g_hIpAttempts.Remove(ip);
	}
	delete snap;

	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_seen\":[%s],\"p_attempts\":[%s]}", token, seen, att);
	System2HTTPRequest req = new System2HTTPRequest(Ips_OnResponse, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CSSTV-Reporter/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 15;
	req.POST();
	delete req;
}

public void Ips_OnResponse(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	int status = success && response != null ? response.StatusCode : 0;
	char text[256];
	if (response != null)
		response.GetContent(text, sizeof(text));
	if (status == 200 && (StrContains(text, "\"ok\": true") != -1 || StrContains(text, "\"ok\":true") != -1))
		return;
	LogError("IPs: no se pudieron registrar (HTTP %d): %s %s", status, error, text);
}
