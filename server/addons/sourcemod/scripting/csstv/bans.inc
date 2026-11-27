/**
 * Baneos de CMLeague en los servidores (2.12.0; plan docs/bitacora/2026-11-26-baneos-en-los-servidores).
 * La web (bans y ban_ips) es la única lista: vale en los tres servidores y en la plataforma.
 *
 *  - Al entrar: primero la copia local (echa al instante) y después csstv_ban_check_ip (SteamID e IP, con las
 *    excepciones de los rangos). Base caída y sin copia: deja entrar.
 *  - Copia local: csstv_bans_compact y csstv_ban_ips_compact al cargar, en cada mapa y cada 5 minutos, guardada en
 *    data/csstv/bans.txt. Después de cada sincronización echa a los conectados que quedaron baneados.
 *  - !ban / sm_ban / sm_addban: se toman con OnBanClient y OnBanIdentity y no se escribe banned_user.cfg. Van a
 *    csstv_ban_add; si quien banea es admin (flag z) y el jugador está conectado, también su IP exacta, por el mismo
 *    tiempo. Permanente (0 minutos) solo un admin.
 *  - !banip <IP o rango> <minutos> [motivo] y !unbanip <IP o rango>: solo admins. Rango hasta /16.
 *  - !unban <SteamID | IP o rango>: levanta en la web.
 *  - Si la web no responde, el pedido queda en data/csstv/bans_pend.txt y se reintenta en la próxima sincronización.
 *  - csstv_bans 0 lo apaga (vuelve el banned_user.cfg de SourceMod).
 *  - csstv_bans_fake <userid> <minutos> <motivo> simula que la base lo da por baneado (pruebas con bots), y
 *    csstv_bans_test <SteamID> <IP> dice qué responde la copia local.
 */

#if defined _csstv_bans_included
	#endinput
#endif
#define _csstv_bans_included

#define BANS_SYNC_SECONDS 300.0
#define BANS_BUF          32768
#define BANS_SITE         "cmleague.lat"

ConVar g_cvBans;
StringMap g_hBanSteam;     // STEAM_0:x:y -> vencimiento (unix; 0 = permanente)
ArrayList g_hBanIps;       // {red, máscara, vencimiento}
ArrayList g_hBanIpExc;     // ",STEAM_0:..,STEAM_0:..," de cada rango (mismo índice)
ArrayList g_hBanIpText;    // "181.21.0.0/16" (mismo índice)
char g_sBansFile[PLATFORM_MAX_PATH];
char g_sBansPend[PLATFORM_MAX_PATH];
char g_sBansBuf[BANS_BUF];
char g_sBansSteamRaw[BANS_BUF];
char g_sBansIpRaw[BANS_BUF];
bool g_bBansSyncing;

void Bans_Init()
{
	g_cvBans = CreateConVar("csstv_bans", "1", "Los baneos de la web valen en este servidor y !ban, !banip y !unban pasan por la web (0 = los de SourceMod, solo en este servidor).", _, true, 0.0, true, 1.0);
	g_hBanSteam = new StringMap();
	g_hBanIps = new ArrayList(3);
	g_hBanIpExc = new ArrayList(ByteCountToCells(1024));
	g_hBanIpText = new ArrayList(ByteCountToCells(24));
	BuildPath(Path_SM, g_sBansFile, sizeof(g_sBansFile), "data/csstv/bans.txt");
	BuildPath(Path_SM, g_sBansPend, sizeof(g_sBansPend), "data/csstv/bans_pend.txt");
	Bans_LoadFile();
	CreateTimer(BANS_SYNC_SECONDS, Timer_BansSync, _, TIMER_REPEAT);
	AddCommandListener(Bans_OnCmdBan, "sm_ban");
	AddCommandListener(Bans_OnCmdBanIp, "sm_banip");
	AddCommandListener(Bans_OnCmdUnban, "sm_unban");
	RegAdminCmd("sm_unbanip", Cmd_UnbanIp, ADMFLAG_ROOT, "sm_unbanip <IP o rango>: levanta un baneo por IP en la web y en los tres servidores.");
	RegAdminCmd("sm_csstv_bans", Cmd_BansStatus, ADMFLAG_BAN, "Muestra cuántos baneos tiene la copia local y sincroniza ahora.");
	RegServerCmd("csstv_bans_test", Cmd_BansTest, "csstv_bans_test <SteamID> <IP>: dice si la copia local lo da por baneado.");
	RegServerCmd("csstv_bans_fake", Cmd_BansFake, "Solo pruebas: csstv_bans_fake <userid> <minutos> <motivo> (como si la base lo diera por baneado).");
}

void Bans_OnConfigsExecuted()
{
	CreateTimer(3.0, Timer_BansSync);
}

public Action Timer_BansSync(Handle timer)
{
	Bans_Sync();
	return Plugin_Continue;
}

bool Bans_On()
{
	return g_cvBans != null && g_cvBans.BoolValue;
}

bool Bans_CanSend()
{
	return g_cvSend.BoolValue && Http_Available() && Http_Configured();
}

// ---------------------------------------------------------------------------------------------------------------
// La copia local
// ---------------------------------------------------------------------------------------------------------------

/** "a.b.c.d" a un entero (los 32 bits, con signo). false si no es una IPv4. */
bool Bans_ParseIp(const char[] text, int &value)
{
	char parts[4][8];
	if (ExplodeString(text, ".", parts, 4, sizeof(parts[])) != 4)
		return false;
	value = 0;
	for (int i = 0; i < 4; i++)
	{
		TrimString(parts[i]);
		if (!parts[i][0] || !IsCharNumeric(parts[i][0]))
			return false;
		int n = StringToInt(parts[i]);
		if (n < 0 || n > 255)
			return false;
		value = (value << 8) | n;
	}
	return true;
}

/** "a.b.c.d/n" o "a.b.c.d": red y máscara. */
bool Bans_ParseRange(const char[] text, int &net, int &mask)
{
	char parts[2][24];
	int n = ExplodeString(text, "/", parts, 2, sizeof(parts[]));
	int bits = n == 2 ? StringToInt(parts[1]) : 32;
	if (bits < 1 || bits > 32 || !Bans_ParseIp(parts[0], net))
		return false;
	mask = bits == 32 ? -1 : ~((1 << (32 - bits)) - 1);
	net &= mask;
	return true;
}

/** Arma la copia desde el texto de la base: "STEAM|exp;..." y "red/n|exp|STEAM,STEAM;...". */
void Bans_Apply(const char[] steams, const char[] ips)
{
	g_hBanSteam.Clear();
	g_hBanIps.Clear();
	g_hBanIpExc.Clear();
	g_hBanIpText.Clear();
	char rec[1100], f[3][1024];
	int pos, next;
	while ((next = SplitString(steams[pos], ";", rec, sizeof(rec))) != -1 || steams[pos])
	{
		if (next == -1)
		{
			strcopy(rec, sizeof(rec), steams[pos]);
			pos += strlen(steams[pos]);
		}
		else
			pos += next;
		if (ExplodeString(rec, "|", f, 2, sizeof(f[])) == 2 && StrContains(f[0], "STEAM_") == 0)
			g_hBanSteam.SetValue(f[0], StringToInt(f[1]));
	}
	pos = 0;
	while ((next = SplitString(ips[pos], ";", rec, sizeof(rec))) != -1 || ips[pos])
	{
		if (next == -1)
		{
			strcopy(rec, sizeof(rec), ips[pos]);
			pos += strlen(ips[pos]);
		}
		else
			pos += next;
		f[2][0] = '\0';
		int net, mask;
		if (ExplodeString(rec, "|", f, 3, sizeof(f[])) < 2 || !Bans_ParseRange(f[0], net, mask))
			continue;
		int item[3];
		item[0] = net;
		item[1] = mask;
		item[2] = StringToInt(f[1]);
		g_hBanIps.PushArray(item);
		char exc[1024];
		Format(exc, sizeof(exc), ",%s,", f[2]);
		g_hBanIpExc.PushString(exc);
		g_hBanIpText.PushString(f[0]);
	}
}

void Bans_LoadFile()
{
	g_sBansSteamRaw[0] = '\0';
	g_sBansIpRaw[0] = '\0';
	File fh = OpenFile(g_sBansFile, "r");
	if (fh == null)
		return;
	fh.ReadLine(g_sBansSteamRaw, sizeof(g_sBansSteamRaw));
	fh.ReadLine(g_sBansIpRaw, sizeof(g_sBansIpRaw));
	delete fh;
	TrimString(g_sBansSteamRaw);
	TrimString(g_sBansIpRaw);
	Bans_Apply(g_sBansSteamRaw, g_sBansIpRaw);
}

void Bans_SaveFile()
{
	File fh = OpenFile(g_sBansFile, "w");
	if (fh == null)
		return;
	fh.WriteLine("%s", g_sBansSteamRaw);
	fh.WriteLine("%s", g_sBansIpRaw);
	delete fh;
}

/** Baneado según la copia local: 1 por SteamID, 2 por IP; 0 si no. expires: vencimiento (0 = permanente). */
int Bans_LocalCheck(const char[] steam, const char[] ip, int &expires)
{
	int now = GetTime();
	if (steam[0] && g_hBanSteam.GetValue(steam, expires) && (expires == 0 || expires > now))
		return 1;
	int value;
	if (!ip[0] || !Bans_ParseIp(ip, value))
		return 0;
	char needle[48], exc[1024];
	Format(needle, sizeof(needle), ",%s,", steam);
	for (int i = 0; i < g_hBanIps.Length; i++)
	{
		int item[3];
		g_hBanIps.GetArray(i, item);
		if ((value & item[1]) != item[0] || (item[2] != 0 && item[2] <= now))
			continue;
		g_hBanIpExc.GetString(i, exc, sizeof(exc));
		if (steam[0] && StrContains(exc, needle) != -1)
			continue;
		expires = item[2];
		return 2;
	}
	return 0;
}

// ---------------------------------------------------------------------------------------------------------------
// Pedidos a la base
// ---------------------------------------------------------------------------------------------------------------

/** "texto" con lo que rompería el JSON escapado. */
void Bans_JsonEsc(const char[] src, char[] dst, int maxlen)
{
	int j;
	for (int i = 0; src[i] != '\0' && j < maxlen - 2; i++)
	{
		int c = src[i];
		if (c == '"' || c == '\\')
		{
			dst[j++] = '\\';
			dst[j++] = c;
		}
		else if (c < 32)
			dst[j++] = ' ';
		else
			dst[j++] = c;
	}
	dst[j] = '\0';
}

/** Pedido a /rpc/<fn> con el token del servidor. body: el resto de los campos (sin p_token), ya en JSON. */
bool Bans_Post(const char[] fn, const char[] body, System2HTTPResponseCallback cb, any data = 0)
{
	if (!Bans_CanSend())
		return false;
	char url[256], key[512], token[128];
	g_cvApiUrl.GetString(url, sizeof(url));
	int rpc = StrContains(url, "/rpc/", false);
	if (rpc == -1)
		return false;
	url[rpc + 5] = '\0';
	StrCat(url, sizeof(url), fn);
	g_cvApiKey.GetString(key, sizeof(key));
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);

	System2HTTPRequest req = new System2HTTPRequest(cb, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CSSTV-Reporter/%s", PLUGIN_VERSION);
	req.SetData("{\"p_token\":\"%s\"%s%s}", token, body[0] ? "," : "", body);
	req.Timeout = 15;
	req.Any = data;
	req.POST();
	delete req;
	return true;
}

/** La respuesta como texto (sin las comillas de un string JSON). Devuelve el status (0 = sin conexión). */
int Bans_Read(bool success, System2HTTPResponse response, char[] out, int maxlen)
{
	out[0] = '\0';
	if (!success || response == null)
		return 0;
	response.GetContent(out, maxlen);
	int len = strlen(out);
	if (len >= 2 && out[0] == '"' && out[len - 1] == '"')
	{
		out[len - 1] = '\0';
		strcopy(out, maxlen, out[1]);
	}
	return response.StatusCode;
}

void Bans_Sync()
{
	if (!Bans_On() || g_bBansSyncing || !Bans_CanSend())
		return;
	g_bBansSyncing = true;
	if (!Bans_Post("csstv_bans_compact", "", Bans_OnSyncSteam))
		g_bBansSyncing = false;
}

public void Bans_OnSyncSteam(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	int status = Bans_Read(success, response, g_sBansBuf, sizeof(g_sBansBuf));
	if (status != 200)
	{
		g_bBansSyncing = false;
		LogError("csstv_bans_compact: %s %s", status ? "HTTP" : "sin conexión", status ? g_sBansBuf : error);
		return;
	}
	strcopy(g_sBansSteamRaw, sizeof(g_sBansSteamRaw), g_sBansBuf);
	if (!Bans_Post("csstv_ban_ips_compact", "", Bans_OnSyncIps))
		g_bBansSyncing = false;
}

public void Bans_OnSyncIps(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	g_bBansSyncing = false;
	int status = Bans_Read(success, response, g_sBansBuf, sizeof(g_sBansBuf));
	if (status != 200)
	{
		LogError("csstv_ban_ips_compact: %s %s", status ? "HTTP" : "sin conexión", status ? g_sBansBuf : error);
		return;
	}
	strcopy(g_sBansIpRaw, sizeof(g_sBansIpRaw), g_sBansBuf);
	Bans_Apply(g_sBansSteamRaw, g_sBansIpRaw);
	Bans_SaveFile();
	Bans_KickConnected();
	Bans_RetryPending();
}

void Bans_KickConnected()
{
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && !IsFakeClient(i) && !IsClientSourceTV(i))
			Bans_CheckLocal(i);
}

// ---------------------------------------------------------------------------------------------------------------
// Al entrar
// ---------------------------------------------------------------------------------------------------------------

void Bans_KickMsg(int client, const char[] reason, int expires, bool ip)
{
	char until[48], msg[256];
	if (expires == 0)
		strcopy(until, sizeof(until), "de forma permanente");
	else
		FormatTime(until, sizeof(until), "hasta el %d/%m/%Y %H:%M", expires);
	Format(msg, sizeof(msg), "%s baneado de CMLeague %s.%s%s Más info en %s",
		ip ? "Esta conexión está" : "Estás", until, reason[0] ? " Motivo: " : "", reason, BANS_SITE);
	char steam[40], addr[48];
	Link_ClientKey(client, steam, sizeof(steam));
	GetClientIP(client, addr, sizeof(addr));
	LogMessage("Baneo: expulsado %N (%s, %s) por %s.", client, steam, addr, ip ? "IP" : "SteamID");
	KickClient(client, "%s", msg);
}

/** true si lo echó. */
bool Bans_CheckLocal(int client)
{
	char steam[40], ip[48];
	if (!Link_ClientKey(client, steam, sizeof(steam)))
		steam[0] = '\0';
	GetClientIP(client, ip, sizeof(ip));
	int expires;
	int kind = Bans_LocalCheck(steam, ip, expires);
	if (!kind)
		return false;
	Bans_KickMsg(client, "", expires, kind == 2);
	return true;
}

/** Desde OnClientPostAdminCheck. */
void Bans_OnJoin(int client)
{
	if (!Bans_On() || IsFakeClient(client) || IsClientSourceTV(client))
		return;
	if (Bans_CheckLocal(client))
		return;
	char steam[40], ip[48], body[160];
	if (!Link_ClientKey(client, steam, sizeof(steam)))
		return;
	GetClientIP(client, ip, sizeof(ip));
	Format(body, sizeof(body), "\"p_steam\":\"%s\",\"p_ip\":\"%s\"", steam, ip);
	Bans_Post("csstv_ban_check_ip", body, Bans_OnCheck, GetClientUserId(client));
}

public void Bans_OnCheck(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	int client = GetClientOfUserId(request.Any);
	char text[1024];
	int status = Bans_Read(success, response, text, sizeof(text));
	if (status != 200)
	{
		LogError("csstv_ban_check_ip: %s %s", status ? "HTTP" : "sin conexión", status ? text : error);
		return;
	}
	if (!client || !IsClientInGame(client))
		return;
	char banned[8], kind[8], reason[256], expires[16];
	Claim_JsonField(text, "banned", banned, sizeof(banned));
	if (!StrEqual(banned, "true"))
		return;
	Claim_JsonField(text, "kind", kind, sizeof(kind));
	Claim_JsonField(text, "reason", reason, sizeof(reason));
	Claim_JsonField(text, "expires", expires, sizeof(expires));
	Bans_KickMsg(client, reason, StringToInt(expires), StrEqual(kind, "ip"));
}

public Action Cmd_BansFake(int args)
{
	char uid[12], minutes[12], reason[128];
	GetCmdArg(1, uid, sizeof(uid));
	GetCmdArg(2, minutes, sizeof(minutes));
	GetCmdArg(3, reason, sizeof(reason));
	int client = GetClientOfUserId(StringToInt(uid));
	if (!client)
	{
		PrintToServer("[CSSTV] csstv_bans_fake: no hay nadie con el userid %s.", uid);
		return Plugin_Handled;
	}
	int m = StringToInt(minutes);
	Bans_KickMsg(client, reason, m ? GetTime() + m * 60 : 0, false);
	return Plugin_Handled;
}

public Action Cmd_BansTest(int args)
{
	// La consola corta los argumentos en los ':' del SteamID: se lee la línea entera.
	char line[128], steam[40], ip[48];
	GetCmdArgString(line, sizeof(line));
	StripQuotes(line);
	TrimString(line);
	int sp = FindCharInString(line, ' ');
	ip[0] = '\0';
	if (sp != -1)
	{
		strcopy(ip, sizeof(ip), line[sp + 1]);
		TrimString(ip);
		line[sp] = '\0';
	}
	strcopy(steam, sizeof(steam), line);
	if (StrContains(steam, "STEAM_") == 0)
		steam[6] = '0';
	int expires;
	int kind = Bans_LocalCheck(steam, ip, expires);
	PrintToServer("[CSSTV] csstv_bans_test %s %s: %s (vence %d)", steam, ip, kind == 1 ? "baneado por SteamID" : kind == 2 ? "baneado por IP" : "no baneado", expires);
	return Plugin_Handled;
}

public Action Cmd_BansStatus(int client, int args)
{
	ReplyToCommand(client, "[CSSTV] Baneos: %d SteamID y %d IPs o rangos en la copia local (csstv_bans %d). Sincronizando...",
		g_hBanSteam.Size, g_hBanIps.Length, g_cvBans.IntValue);
	Bans_Sync();
	return Plugin_Handled;
}

// ---------------------------------------------------------------------------------------------------------------
// !ban, !banip y !unban
// ---------------------------------------------------------------------------------------------------------------

void Bans_AdminInfo(int source, char[] steam, int steamLen, char[] name, int nameLen)
{
	steam[0] = '\0';
	if (source > 0 && IsClientInGame(source))
	{
		Link_ClientKey(source, steam, steamLen);
		GetClientName(source, name, nameLen);
	}
	else
		strcopy(name, nameLen, "Consola");
}

bool Bans_IsAdmin(int source)
{
	return source == 0 || CheckCommandAccess(source, "csstv_bans_admin", ADMFLAG_ROOT, true);
}

/** Permanente solo un admin: se revisa antes de que basebans anuncie el baneo. */
public Action Bans_OnCmdBan(int client, const char[] command, int argc)
{
	if (!Bans_On() || argc < 2 || Bans_IsAdmin(client) || !CheckCommandAccess(client, "sm_ban", ADMFLAG_BAN))
		return Plugin_Continue;
	char minutes[16];
	GetCmdArg(2, minutes, sizeof(minutes));
	if (StringToInt(minutes) == 0)
	{
		ReplyToCommand(client, "%s Solo un admin puede banear de forma permanente. Indica los minutos.", PREFIX);
		return Plugin_Stop;
	}
	return Plugin_Continue;
}

public Action OnBanClient(int client, int time, int flags, const char[] reason, const char[] kick_message, const char[] command, any source)
{
	if (!Bans_On() || (flags & BANFLAG_IP))
		return Plugin_Continue;
	char steam[40], nick[64], ip[48];
	if (!Link_ClientKey(client, steam, sizeof(steam)))
		return Plugin_Continue;
	GetClientName(client, nick, sizeof(nick));
	GetClientIP(client, ip, sizeof(ip));
	// La IP exacta solo con el !ban de un admin (Daniel, 2026-11-26), por el mismo tiempo.
	Bans_SendAdd(steam, nick, source, time, reason, Bans_IsAdmin(source) ? ip : "");
	if (!(flags & BANFLAG_NOKICK))
		Bans_KickMsg(client, reason, time ? GetTime() + time * 60 : 0, false);
	return Plugin_Handled;
}

public Action OnBanIdentity(const char[] identity, int time, int flags, const char[] reason, const char[] command, any source)
{
	if (!Bans_On() || (flags & BANFLAG_IP) || StrContains(identity, "STEAM_", false) != 0)
		return Plugin_Continue;
	if (time == 0 && !Bans_IsAdmin(source))
	{
		if (source > 0 && IsClientInGame(source))
			PrintToChat(source, "%s Solo un admin puede banear de forma permanente.", PREFIX);
		return Plugin_Handled;
	}
	char steam[40];
	strcopy(steam, sizeof(steam), identity);
	steam[6] = '0';
	Bans_SendAdd(steam, "", source, time, reason, "");
	for (int i = 1; i <= MaxClients; i++)
	{
		char key[40];
		if (IsClientInGame(i) && Link_ClientKey(i, key, sizeof(key)) && StrEqual(key, steam))
			Bans_KickMsg(i, reason, time ? GetTime() + time * 60 : 0, false);
	}
	return Plugin_Handled;
}

/** sm_banip <IP, rango o #userid> <minutos> [motivo]: solo admins. */
public Action Bans_OnCmdBanIp(int client, const char[] command, int argc)
{
	if (!Bans_On())
		return Plugin_Continue;
	if (!Bans_IsAdmin(client))
	{
		ReplyToCommand(client, "%s Solo un admin puede banear por IP.", PREFIX);
		return Plugin_Stop;
	}
	if (argc < 2)
	{
		ReplyToCommand(client, "%s Uso: !banip <IP, rango (181.21.0.0/16) o #userid> <minutos, 0 = permanente> [motivo]", PREFIX);
		return Plugin_Stop;
	}
	char target[48], minutes[16], reason[200];
	GetCmdArg(1, target, sizeof(target));
	GetCmdArg(2, minutes, sizeof(minutes));
	reason[0] = '\0';
	for (int i = 3; i <= argc; i++)
	{
		char w[64];
		GetCmdArg(i, w, sizeof(w));
		Format(reason, sizeof(reason), "%s%s%s", reason, reason[0] ? " " : "", w);
	}
	int victim = 0;
	if (target[0] == '#')
	{
		victim = GetClientOfUserId(StringToInt(target[1]));
		if (!victim)
		{
			ReplyToCommand(client, "%s No hay nadie con el userid %s.", PREFIX, target[1]);
			return Plugin_Stop;
		}
		GetClientIP(victim, target, sizeof(target));
	}
	int net, mask;
	if (!Bans_ParseRange(target, net, mask) || (StrContains(target, "/") != -1 && StringToInt(target[StrContains(target, "/") + 1]) < 16))
	{
		ReplyToCommand(client, "%s IP o rango inválido: %s (como mucho /16, por ejemplo 181.21.0.0/16).", PREFIX, target);
		return Plugin_Stop;
	}
	int m = StringToInt(minutes);
	char adminSteam[40], adminName[64];
	Bans_AdminInfo(client, adminSteam, sizeof(adminSteam), adminName, sizeof(adminName));
	Bans_SendIpAdd(target, m, reason, adminSteam, adminName, "");
	ReplyToCommand(client, "%s Baneada %s %s. Vale en los tres servidores y en la web.", PREFIX, target, m ? "por un tiempo" : "de forma permanente");
	LogAction(client, -1, "\"%L\" baneó la IP o rango %s (%d minutos, motivo \"%s\")", client, target, m, reason);
	// Echa a los conectados desde ahí (las excepciones se ven en la próxima sincronización)
	int item[3];
	item[0] = net;
	item[1] = mask;
	item[2] = m ? GetTime() + m * 60 : 0;
	g_hBanIps.PushArray(item);
	g_hBanIpExc.PushString(",,");
	g_hBanIpText.PushString(target);
	for (int i = 1; i <= MaxClients; i++)
	{
		char ip[48];
		int value;
		if (!IsClientInGame(i) || IsFakeClient(i) || i == client)
			continue;
		GetClientIP(i, ip, sizeof(ip));
		if (Bans_ParseIp(ip, value) && (value & mask) == net)
			Bans_KickMsg(i, reason, item[2], true);
	}
	return Plugin_Stop;
}

/** sm_unban <SteamID | IP o rango>. */
public Action Bans_OnCmdUnban(int client, const char[] command, int argc)
{
	if (!Bans_On() || !CheckCommandAccess(client, "sm_unban", ADMFLAG_UNBAN))
		return Plugin_Continue;
	if (argc < 1)
	{
		ReplyToCommand(client, "%s Uso: !unban <SteamID> o !unbanip <IP o rango>", PREFIX);
		return Plugin_Stop;
	}
	char arg[64];
	GetCmdArgString(arg, sizeof(arg));
	StripQuotes(arg);
	TrimString(arg);
	if (StrContains(arg, "STEAM_", false) != 0)
	{
		Bans_UnbanIp(client, arg);
		return Plugin_Stop;
	}
	arg[6] = '0';
	char adminSteam[40], adminName[64], body[256], esc[128];
	Bans_AdminInfo(client, adminSteam, sizeof(adminSteam), adminName, sizeof(adminName));
	Bans_JsonEsc(adminName, esc, sizeof(esc));
	Format(body, sizeof(body), "\"p_steam\":\"%s\",\"p_admin_steam\":\"%s\",\"p_admin_name\":\"%s\"", arg, adminSteam, esc);
	Bans_SendOrQueue("csstv_ban_lift", body);
	g_hBanSteam.Remove(arg);
	ReplyToCommand(client, "%s Levantado el baneo de %s en la web y en los tres servidores.", PREFIX, arg);
	LogAction(client, -1, "\"%L\" levantó el baneo de %s", client, arg);
	return Plugin_Stop;
}

public Action Cmd_UnbanIp(int client, int args)
{
	if (args < 1)
	{
		ReplyToCommand(client, "%s Uso: !unbanip <IP o rango>", PREFIX);
		return Plugin_Handled;
	}
	char arg[48];
	GetCmdArg(1, arg, sizeof(arg));
	Bans_UnbanIp(client, arg);
	return Plugin_Handled;
}

void Bans_UnbanIp(int client, const char[] ip)
{
	if (!Bans_IsAdmin(client))
	{
		ReplyToCommand(client, "%s Solo un admin puede levantar un baneo por IP.", PREFIX);
		return;
	}
	int net, mask;
	if (!Bans_ParseRange(ip, net, mask))
	{
		ReplyToCommand(client, "%s IP o rango inválido: %s", PREFIX, ip);
		return;
	}
	char adminSteam[40], adminName[64], body[256], esc[128];
	Bans_AdminInfo(client, adminSteam, sizeof(adminSteam), adminName, sizeof(adminName));
	Bans_JsonEsc(adminName, esc, sizeof(esc));
	Format(body, sizeof(body), "\"p_ip\":\"%s\",\"p_admin_steam\":\"%s\",\"p_admin_name\":\"%s\"", ip, adminSteam, esc);
	Bans_SendOrQueue("csstv_ban_ip_lift", body);
	for (int i = g_hBanIps.Length - 1; i >= 0; i--)
	{
		int item[3];
		g_hBanIps.GetArray(i, item);
		if (item[0] == net && item[1] == mask)
		{
			g_hBanIps.Erase(i);
			g_hBanIpExc.Erase(i);
			g_hBanIpText.Erase(i);
		}
	}
	ReplyToCommand(client, "%s Levantado el baneo de %s en la web y en los tres servidores.", PREFIX, ip);
	LogAction(client, -1, "\"%L\" levantó el baneo de la IP o rango %s", client, ip);
}

// ---------------------------------------------------------------------------------------------------------------
// Envío, con la cola a disco si la web no responde
// ---------------------------------------------------------------------------------------------------------------

void Bans_SendAdd(const char[] steam, const char[] nick, int source, int minutes, const char[] reason, const char[] ip)
{
	char adminSteam[40], adminName[64], eNick[128], eName[128], eReason[400], body[900];
	Bans_AdminInfo(source, adminSteam, sizeof(adminSteam), adminName, sizeof(adminName));
	Bans_JsonEsc(nick, eNick, sizeof(eNick));
	Bans_JsonEsc(adminName, eName, sizeof(eName));
	Bans_JsonEsc(reason, eReason, sizeof(eReason));
	Format(body, sizeof(body), "\"p_steam\":\"%s\",\"p_nick\":\"%s\",\"p_admin_steam\":\"%s\",\"p_admin_name\":\"%s\",\"p_minutes\":%d,\"p_reason\":\"%s\"",
		steam, eNick, adminSteam, eName, minutes, eReason);
	g_hBanSteam.SetValue(steam, minutes ? GetTime() + minutes * 60 : 0);
	if (ip[0])
	{
		// La IP va después, con el ban_id: si el baneo no llega, la IP tampoco (queda en la cola con él).
		DataPack dp = new DataPack();
		dp.WriteString(body);
		dp.WriteString(ip);
		dp.WriteString(adminSteam);
		dp.WriteString(eName);
		if (!Bans_Post("csstv_ban_add", body, Bans_OnAddWithIp, dp))
		{
			delete dp;
			Bans_Queue("csstv_ban_add", body);
		}
	}
	else
		Bans_SendOrQueue("csstv_ban_add", body);
}

public void Bans_OnAddWithIp(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	DataPack dp = view_as<DataPack>(request.Any);
	char body[900], ip[48], adminSteam[40], eName[128], text[512], banId[48], ipBody[400];
	dp.Reset();
	dp.ReadString(body, sizeof(body));
	dp.ReadString(ip, sizeof(ip));
	dp.ReadString(adminSteam, sizeof(adminSteam));
	dp.ReadString(eName, sizeof(eName));
	delete dp;
	int status = Bans_Read(success, response, text, sizeof(text));
	if (status != 200)
	{
		LogError("csstv_ban_add: %s %s (queda en la cola, sin la IP)", status ? "HTTP" : "sin conexión", status ? text : error);
		Bans_Queue("csstv_ban_add", body);
		return;
	}
	Claim_JsonField(text, "ban_id", banId, sizeof(banId));
	if (!banId[0])
	{
		LogError("csstv_ban_add: %s", text);
		return;
	}
	SanitizeId(banId);
	Format(ipBody, sizeof(ipBody), "\"p_ip\":\"%s\",\"p_minutes\":0,\"p_reason\":null,\"p_admin_steam\":\"%s\",\"p_admin_name\":\"%s\",\"p_ban_id\":\"%s\"",
		ip, adminSteam, eName, banId);
	Bans_SendOrQueue("csstv_ban_ip_add", ipBody);
}

void Bans_SendIpAdd(const char[] ip, int minutes, const char[] reason, const char[] adminSteam, const char[] adminName, const char[] banId)
{
	char eName[128], eReason[400], body[700];
	Bans_JsonEsc(adminName, eName, sizeof(eName));
	Bans_JsonEsc(reason, eReason, sizeof(eReason));
	Format(body, sizeof(body), "\"p_ip\":\"%s\",\"p_minutes\":%d,\"p_reason\":\"%s\",\"p_admin_steam\":\"%s\",\"p_admin_name\":\"%s\"%s%s%s",
		ip, minutes, eReason, adminSteam, eName, banId[0] ? ",\"p_ban_id\":\"" : "", banId, banId[0] ? "\"" : "");
	Bans_SendOrQueue("csstv_ban_ip_add", body);
}

void Bans_SendOrQueue(const char[] fn, const char[] body)
{
	DataPack dp = new DataPack();
	dp.WriteString(fn);
	dp.WriteString(body);
	if (!Bans_Post(fn, body, Bans_OnSent, dp))
	{
		delete dp;
		Bans_Queue(fn, body);
	}
}

public void Bans_OnSent(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	DataPack dp = view_as<DataPack>(request.Any);
	char fn[40], body[900], text[512];
	dp.Reset();
	dp.ReadString(fn, sizeof(fn));
	dp.ReadString(body, sizeof(body));
	delete dp;
	int status = Bans_Read(success, response, text, sizeof(text));
	if (status == 200)
	{
		char ok[8];
		Claim_JsonField(text, "ok", ok, sizeof(ok));
		if (!StrEqual(ok, "true"))
			LogError("%s: %s", fn, text);
		return;
	}
	LogError("%s: %s %s (queda en la cola)", fn, status ? "HTTP" : "sin conexión", status ? text : error);
	// Un error de la base (4xx) no se arregla reintentando
	if (status == 0 || status >= 500)
		Bans_Queue(fn, body);
}

/** Una línea "fn\tbody" en bans_pend.txt. */
void Bans_Queue(const char[] fn, const char[] body)
{
	File fh = OpenFile(g_sBansPend, "a");
	if (fh == null)
	{
		LogError("No se pudo guardar el pedido %s en %s", fn, g_sBansPend);
		return;
	}
	fh.WriteLine("%s\t%s", fn, body);
	delete fh;
}

void Bans_RetryPending()
{
	if (!FileExists(g_sBansPend))
		return;
	File fh = OpenFile(g_sBansPend, "r");
	if (fh == null)
		return;
	ArrayList lines = new ArrayList(ByteCountToCells(960));
	char line[960];
	while (fh.ReadLine(line, sizeof(line)))
	{
		TrimString(line);
		if (line[0])
			lines.PushString(line);
	}
	delete fh;
	DeleteFile(g_sBansPend);
	for (int i = 0; i < lines.Length; i++)
	{
		lines.GetString(i, line, sizeof(line));
		int tab = FindCharInString(line, '\t');
		if (tab == -1)
			continue;
		line[tab] = '\0';
		Bans_SendOrQueue(line, line[tab + 1]);
	}
	if (lines.Length)
		LogMessage("Baneos: reintentados %d pedidos pendientes.", lines.Length);
	delete lines;
}
