// IPs de los jugadores (plan docs/bitacora/2026-10-29-ips-jugadores).
// Junta en memoria cada intento de conexión (por IP) y cada entrada con el SteamID validado, y los manda cada
// 60 segundos a csstv_connections. Un pedido por conexión sería otra forma de tumbar el servidor en un ataque.
// 2.6.1: con un pico de intentos manda antes, y los intentos pendientes se copian a disco (ips_intentos.txt) para
// mandarlos después de una caída. Las entradas solo viven en memoria. Si un envío falla, se descarta.

#define IPS_FLUSH_SECONDS 60.0
#define IPS_SAVE_SECONDS  5.0   // copia a disco de los intentos pendientes, si cambiaron
#define IPS_MAX_SEEN      64    // entradas guardadas a la vez
#define IPS_MAX_ATTEMPTS  1024  // IPs distintas guardadas a la vez (el archivo no pasa de unos 40 KB)
#define IPS_BODY_MAX      1900  // el resto de los envíos del plugin usa cuerpos de menos de 2 KB
#define IPS_MAX_REQUESTS  8     // pedidos por vuelta; lo que no entra queda para la siguiente
#define IPS_SPIKE_TOTAL   30    // intentos desde el último envío que lo adelantan
#define IPS_SPIKE_IP      10    // intentos de una sola IP que lo adelantan
#define IPS_SPIKE_GAP     5.0   // segundos mínimos entre dos envíos adelantados
#define IPS_KEEP_HOURS    48    // al arrancar, lo del archivo más viejo que esto se descarta

ConVar g_cvIps;
StringMap g_hIpAttempts;   // IP -> {intentos, primer intento (unix)} desde el último envío
ArrayList g_hIpSeen;       // cada elemento: {"steam":"…","ip":"…","nick":"…"}
bool g_bIpsDirty;
int g_iIpsSinceSend;
float g_fIpsLastSend;
char g_sIpsFile[PLATFORM_MAX_PATH];

void Ips_Init()
{
	g_cvIps = CreateConVar("csstv_ips", "1", "Registra la IP de cada entrada al servidor y los intentos de conexión (solo los ven los admins de la web).", _, true, 0.0, true, 1.0);
	g_hIpAttempts = new StringMap();
	g_hIpSeen = new ArrayList(ByteCountToCells(192));
	BuildPath(Path_SM, g_sIpsFile, sizeof(g_sIpsFile), "data/csstv/ips_intentos.txt");
	Ips_Load();
	CreateTimer(IPS_FLUSH_SECONDS, Timer_IpsFlush, _, TIMER_REPEAT);
	CreateTimer(IPS_SAVE_SECONDS, Timer_IpsSave, _, TIMER_REPEAT);
	// Lo recuperado del archivo sale apenas se cargó el cfg (token y URL), sin esperar la primera vuelta.
	if (g_hIpAttempts.Size > 0)
		CreateTimer(15.0, Timer_IpsFlush);
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
	int times = n[0] ? StringToInt(n) : 1;
	for (int i = 0; i < times; i++)
		Ips_Count(ip);
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
	if (GetClientIP(client, ip, sizeof(ip)))
		Ips_Count(ip);
}

/** Suma un intento a la IP y, si hay un pico, manda sin esperar la vuelta de 60 segundos. */
static void Ips_Count(const char[] ip)
{
	int v[2];
	if (!g_hIpAttempts.GetArray(ip, v, sizeof(v)))
	{
		if (g_hIpAttempts.Size >= IPS_MAX_ATTEMPTS)
			return;
		v[0] = 0;
		v[1] = GetTime();
	}
	v[0]++;
	g_hIpAttempts.SetArray(ip, v, sizeof(v));
	g_bIpsDirty = true;
	g_iIpsSinceSend++;
	if ((g_iIpsSinceSend >= IPS_SPIKE_TOTAL || v[0] >= IPS_SPIKE_IP) && GetEngineTime() - g_fIpsLastSend >= IPS_SPIKE_GAP)
		Timer_IpsFlush(null);
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
		if (g_hIpAttempts.Size > 0)
		{
			g_hIpAttempts.Clear();
			Ips_Save();
		}
		return Plugin_Continue;
	}
	g_fIpsLastSend = GetEngineTime();
	g_iIpsSinceSend = 0;
	for (int r = 0; r < IPS_MAX_REQUESTS && (g_hIpSeen.Length > 0 || g_hIpAttempts.Size > 0); r++)
		Ips_SendOne();
	Ips_Save();
	return Plugin_Continue;
}

public Action Timer_IpsSave(Handle timer)
{
	if (g_bIpsDirty)
		Ips_Save();
	return Plugin_Continue;
}

/** Reescribe el archivo con los intentos pendientes (una línea por IP: ip intentos primer_intento). Vacío, lo borra. */
static void Ips_Save()
{
	g_bIpsDirty = false;
	if (g_hIpAttempts.Size == 0)
	{
		if (FileExists(g_sIpsFile))
			DeleteFile(g_sIpsFile);
		return;
	}
	File f = OpenFile(g_sIpsFile, "w");
	if (f == null)
		return;
	char ip[48];
	int v[2];
	StringMapSnapshot snap = g_hIpAttempts.Snapshot();
	for (int i = 0; i < snap.Length; i++)
	{
		snap.GetKey(i, ip, sizeof(ip));
		if (g_hIpAttempts.GetArray(ip, v, sizeof(v)))
			f.WriteLine("%s %d %d", ip, v[0], v[1]);
	}
	delete snap;
	delete f;
}

/** Al arrancar: suma lo que quedó en el archivo (una caída o un reinicio antes de mandarlo). */
static void Ips_Load()
{
	if (!FileExists(g_sIpsFile))
		return;
	File f = OpenFile(g_sIpsFile, "r");
	if (f == null)
		return;
	char line[96], parts[3][48];
	int oldest = GetTime() - IPS_KEEP_HOURS * 3600, n;
	while (f.ReadLine(line, sizeof(line)) && g_hIpAttempts.Size < IPS_MAX_ATTEMPTS)
	{
		TrimString(line);
		if (ExplodeString(line, " ", parts, sizeof(parts), sizeof(parts[])) != 3)
			continue;
		int v[2];
		v[0] = StringToInt(parts[1]);
		v[1] = StringToInt(parts[2]);
		if (v[0] < 1 || v[1] < oldest)
			continue;
		g_hIpAttempts.SetArray(parts[0], v, sizeof(v));
		n++;
	}
	delete f;
	if (n > 0)
		LogMessage("IPs: %d IPs con intentos recuperadas de %s.", n, g_sIpsFile);
	Ips_Save();
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
		int v[2];
		snap.GetKey(i, ip, sizeof(ip));
		g_hIpAttempts.GetArray(ip, v, sizeof(v));
		// t: el primer intento, para que la base lo cuente en su hora (también si se recuperó del archivo).
		Format(entry, sizeof(entry), "{\"ip\":\"%s\",\"n\":%d,\"t\":%d}", ip, v[0], v[1]);
		if (used + strlen(entry) + 1 > IPS_BODY_MAX)
			break;
		if (att[0])
			StrCat(att, sizeof(att), ",");
		StrCat(att, sizeof(att), entry);
		used += strlen(entry) + 1;
		g_hIpAttempts.Remove(ip);
		g_bIpsDirty = true;
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
