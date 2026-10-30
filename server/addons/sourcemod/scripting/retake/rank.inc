/**
 * Ranking del retake: puntos por jugador en data/sqlite/v34_retake.sq3, en el propio servidor.
 * !rank muestra tu puesto y !top abre el ranking en un menú con páginas. Solo cuentan los duelos entre jugadores reales
 * con el modo prendido. Los puntos se guardan al terminar cada ronda y al desconectarse.
 */

#if defined _retake_rank_included
	#endinput
#endif
#define _retake_rank_included

#define RANK_START 1000
#define RANK_PAGE 7
#define RANK_KEY_PREV 8
#define RANK_KEY_NEXT 9
#define RANK_KEY_EXIT 10       // la tecla 0
#define RANK_KEY_LEN 64
#define RANK_RATIO_MIN 0.5
#define RANK_RATIO_MAX 2.0

ConVar g_cvRankKill;
ConVar g_cvRankHeadshot;
ConVar g_cvRankDeath;
ConVar g_cvRankDefuse;
#if defined RETAKE_DEBUG
ConVar g_cvDebugBotRank;
#endif

Database g_hDb;
bool g_bRankLoaded[MAXPLAYERS + 1];
bool g_bRankDirty[MAXPLAYERS + 1];
char g_sRankKey[MAXPLAYERS + 1][RANK_KEY_LEN];
int g_iPoints[MAXPLAYERS + 1];
int g_iKills[MAXPLAYERS + 1];
int g_iDeaths[MAXPLAYERS + 1];
int g_iHeadshots[MAXPLAYERS + 1];
int g_iDefuses[MAXPLAYERS + 1];
int g_iTopPage[MAXPLAYERS + 1];

void Rank_Init()
{
	g_cvRankKill     = CreateConVar("sm_retake_rank_kill", "6", "Puntos por baja.", _, true, 0.0, true, 100.0);
	g_cvRankHeadshot = CreateConVar("sm_retake_rank_headshot", "2", "Puntos extra por tiro a la cabeza.", _, true, 0.0, true, 100.0);
	g_cvRankDeath    = CreateConVar("sm_retake_rank_death", "3", "Puntos que se pierden al morir.", _, true, 0.0, true, 100.0);
	g_cvRankDefuse   = CreateConVar("sm_retake_rank_defuse", "8", "Puntos por desactivar la bomba.", _, true, 0.0, true, 100.0);
	RegConsoleCmd("sm_rank", Cmd_Rank, "Tu puesto en el ranking del retake.");
	RegConsoleCmd("sm_top", Cmd_Top, "Ranking del retake, con páginas.");
	HookEvent("player_death", Rank_OnDeath);
	HookEvent("bomb_defused", Rank_OnDefuse);
#if defined RETAKE_DEBUG
	g_cvDebugBotRank = CreateConVar("retake_debug_bot_rank", "0", "Los bots suman puntos.");
#endif

	char error[256];
	g_hDb = SQLite_UseDatabase("v34_retake", error, sizeof(error));
	if (g_hDb == null)
	{
		LogError("No se pudo abrir el ranking: %s", error);
		return;
	}
	if (!SQL_FastQuery(g_hDb, "CREATE TABLE IF NOT EXISTS retake_rank (steamid TEXT PRIMARY KEY, name TEXT NOT NULL, points INTEGER NOT NULL, kills INTEGER NOT NULL, deaths INTEGER NOT NULL, headshots INTEGER NOT NULL, defuses INTEGER NOT NULL)"))
	{
		SQL_GetError(g_hDb, error, sizeof(error));
		LogError("No se pudo crear la tabla del ranking: %s", error);
	}
	for (int i = 1; i <= MaxClients; i++)   // recarga del plugin con jugadores adentro
		if (IsClientInGame(i) && IsClientAuthorized(i))
			Rank_Load(i);
}

bool Rank_Counts(int client)
{
	return client > 0 && g_bRankLoaded[client] && IsClientInGame(client);
}

/** En LAN no hay SteamID: se usa la IP, para poder probarlo en el servidor local. */
bool Rank_GetKey(int client, char[] key, int maxlen)
{
	if (IsFakeClient(client))
	{
#if defined RETAKE_DEBUG
		Format(key, maxlen, "BOT:%N", client);
		return g_cvDebugBotRank.BoolValue;
#else
		return false;
#endif
	}
	if (!GetClientAuthId(client, AuthId_Steam2, key, maxlen, false))
		return false;
	if (StrEqual(key, "STEAM_ID_LAN"))
	{
		char ip[32];
		GetClientIP(client, ip, sizeof(ip));
		Format(key, maxlen, "LAN:%s", ip);
		return true;
	}
	return !StrEqual(key, "STEAM_ID_PENDING");
}

public void OnClientPostAdminCheck(int client)
{
	Rank_Load(client);
}

void Rank_Load(int client)
{
	g_bRankLoaded[client] = false;
	g_bRankDirty[client] = false;
	if (g_hDb == null || !Rank_GetKey(client, g_sRankKey[client], RANK_KEY_LEN))
		return;
	char esc[RANK_KEY_LEN * 2 + 1], query[256];
	g_hDb.Escape(g_sRankKey[client], esc, sizeof(esc));
	Format(query, sizeof(query), "SELECT points, kills, deaths, headshots, defuses FROM retake_rank WHERE steamid = '%s'", esc);
	g_hDb.Query(Rank_OnLoaded, query, GetClientUserId(client));
}

public void Rank_OnLoaded(Database db, DBResultSet results, const char[] error, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client == 0)
		return;
	if (results == null)
	{
		LogError("No se pudieron leer los puntos de %N: %s", client, error);
		return;
	}
	if (results.FetchRow())
	{
		g_iPoints[client] = results.FetchInt(0);
		g_iKills[client] = results.FetchInt(1);
		g_iDeaths[client] = results.FetchInt(2);
		g_iHeadshots[client] = results.FetchInt(3);
		g_iDefuses[client] = results.FetchInt(4);
	}
	else
	{
		g_iPoints[client] = RANK_START;
		g_iKills[client] = g_iDeaths[client] = g_iHeadshots[client] = g_iDefuses[client] = 0;
	}
	g_bRankLoaded[client] = true;
}

void Rank_BuildSave(int client, char[] query, int maxlen)
{
	char name[MAX_NAME_LENGTH], escName[MAX_NAME_LENGTH * 2 + 1], escKey[RANK_KEY_LEN * 2 + 1];
	GetClientName(client, name, sizeof(name));
	g_hDb.Escape(name, escName, sizeof(escName));
	g_hDb.Escape(g_sRankKey[client], escKey, sizeof(escKey));
	Format(query, maxlen, "INSERT OR REPLACE INTO retake_rank (steamid, name, points, kills, deaths, headshots, defuses) VALUES ('%s', '%s', %d, %d, %d, %d, %d)",
		escKey, escName, g_iPoints[client], g_iKills[client], g_iDeaths[client], g_iHeadshots[client], g_iDefuses[client]);
}

public void Rank_OnSaveError(Database db, any data, int numQueries, const char[] error, int failIndex, any[] queryData)
{
	LogError("No se pudo guardar el ranking: %s", error);
}

/** Todos juntos en una transacción, para que el disco se escriba una sola vez. */
void Rank_SaveAll()
{
	if (g_hDb == null)
		return;
	Transaction txn;
	char query[512];
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!g_bRankDirty[i] || !IsClientInGame(i))
			continue;
		if (txn == null)
			txn = new Transaction();
		Rank_BuildSave(i, query, sizeof(query));
		txn.AddQuery(query);
		g_bRankDirty[i] = false;
	}
	if (txn != null)
		g_hDb.Execute(txn, _, Rank_OnSaveError);
}

void Rank_SaveClient(int client)
{
	if (g_hDb == null || !g_bRankDirty[client])
		return;
	char query[512];
	Rank_BuildSave(client, query, sizeof(query));
	g_bRankDirty[client] = false;
	SQL_FastQuery(g_hDb, query);
}

void Rank_OnClientDisconnect(int client)
{
	Rank_SaveClient(client);
	g_bRankLoaded[client] = false;
}

/** Al descargar el plugin no quedan consultas en cola: se guarda en el momento. */
void Rank_OnPluginEnd()
{
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i))
			Rank_SaveClient(i);
}

void Rank_Add(int client, int points, const char[] reason)
{
	if (points == 0)
		return;
	g_iPoints[client] += points;
	if (g_iPoints[client] < 0)
		g_iPoints[client] = 0;
	g_bRankDirty[client] = true;
	Chat(client, "{#verde}CMLeague {#blanco}| Tus puntos: {#amarillo}%d {#blanco}[%s: %s%d]", g_iPoints[client], reason, points > 0 ? "+" : "", points);
}

public void Rank_OnDeath(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return;
	int victim = GetClientOfUserId(event.GetInt("userid"));
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	if (attacker == victim || !Rank_Counts(attacker) || !Rank_Counts(victim) || GetClientTeam(attacker) == GetClientTeam(victim))
		return;
	// Se calcula con los puntos de antes de esta baja: el que mata no cambia lo que pierde el otro.
	float ratio = Rank_Ratio(g_iPoints[victim], g_iPoints[attacker]);
	g_iKills[attacker]++;
	Rank_Add(attacker, Rank_Scale(g_cvRankKill.IntValue, ratio), "Baja");
	if (event.GetBool("headshot"))
	{
		g_iHeadshots[attacker]++;
		Rank_Add(attacker, g_cvRankHeadshot.IntValue, "Tiro a la cabeza");
	}
	g_iDeaths[victim]++;
	Rank_Add(victim, -Rank_Scale(g_cvRankDeath.IntValue, ratio), "Muerte");
}

/**
 * Cuánto vale la baja según los puntos de los dos: matar a alguien mejor da más y a él le quita más;
 * matar a alguien peor da menos y a él le quita menos. Con límites, para que una cuenta nueva
 * no gane de golpe demasiado contra el primero del ranking.
 */
float Rank_Ratio(int victimPoints, int attackerPoints)
{
	float ratio = float(victimPoints > 0 ? victimPoints : 1) / float(attackerPoints > 0 ? attackerPoints : 1);
	if (ratio < RANK_RATIO_MIN)
		return RANK_RATIO_MIN;
	return ratio > RANK_RATIO_MAX ? RANK_RATIO_MAX : ratio;
}

int Rank_Scale(int base, float ratio)
{
	if (base == 0)
		return 0;
	int points = RoundToNearest(base * ratio);
	return points < 1 ? 1 : points;
}

public void Rank_OnDefuse(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bActive)
		return;
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (!Rank_Counts(client))
		return;
	g_iDefuses[client]++;
	Rank_Add(client, g_cvRankDefuse.IntValue, "Bomba desactivada");
}

// ---------------------------------------------------------------------------
// !rank y !top
// ---------------------------------------------------------------------------

public Action Cmd_Rank(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (g_hDb == null || !g_bRankLoaded[client])
	{
		Chat(client, "%s Tu ranking todavía no está disponible.", RETAKE_PREFIX);
		return Plugin_Handled;
	}
	Rank_SaveAll();   // la consulta va después en la misma cola: el puesto sale con los puntos al día
	char query[192];
	Format(query, sizeof(query), "SELECT (SELECT COUNT(*) FROM retake_rank WHERE points > %d) + 1, (SELECT COUNT(*) FROM retake_rank)", g_iPoints[client]);
	g_hDb.Query(Rank_OnRankResult, query, GetClientUserId(client));
	return Plugin_Handled;
}

public void Rank_OnRankResult(Database db, DBResultSet results, const char[] error, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client == 0)
		return;
	if (results == null || !results.FetchRow())
	{
		LogError("No se pudo calcular el puesto: %s", error);
		return;
	}
	int place = results.FetchInt(0), total = results.FetchInt(1) > 0 ? results.FetchInt(1) : 1;
	int deaths = g_iDeaths[client] > 0 ? g_iDeaths[client] : 1;
	int kills = g_iKills[client] > 0 ? g_iKills[client] : 1;
	float kd = float(g_iKills[client]) / float(deaths);
	ChatAll("{#verde}CMLeague {#blanco}| {#amarillo}%N{#blanco}: puesto {#amarillo}%d{#blanco} de %d, {#amarillo}%d{#blanco} puntos, K/D %.2f", client, place, total, g_iPoints[client], kd);

	// Un Panel y no un Menu: el Menu le pone número a cada línea aunque no se pueda elegir.
	Panel panel = new Panel();
	char line[64];
	Format(line, sizeof(line), "Tu ranking: puesto %d de %d", place, total);
	panel.SetTitle(line);
	Format(line, sizeof(line), "Puntos: %d", g_iPoints[client]);
	panel.DrawText(line);
	Format(line, sizeof(line), "Bajas: %d", g_iKills[client]);
	panel.DrawText(line);
	Format(line, sizeof(line), "Muertes: %d", g_iDeaths[client]);
	panel.DrawText(line);
	Format(line, sizeof(line), "K/D: %.2f", kd);
	panel.DrawText(line);
	Format(line, sizeof(line), "Tiros a la cabeza: %d (%d%%)", g_iHeadshots[client], g_iHeadshots[client] * 100 / kills);
	panel.DrawText(line);
	Format(line, sizeof(line), "Bombas desactivadas: %d", g_iDefuses[client]);
	panel.DrawText(line);
	panel.DrawText(" ");
	panel.CurrentKey = RANK_KEY_EXIT;
	panel.DrawItem("Salir");
	panel.Send(client, Rank_PanelHandler, MENU_TIME_FOREVER);
	delete panel;
}

public int Rank_PanelHandler(Menu menu, MenuAction action, int client, int key)
{
	return 0;
}

public Action Cmd_Top(int client, int args)
{
	if (g_hDb == null)
	{
		ReplyToCommand(client, "[Retake] El ranking no está disponible.");
		return Plugin_Handled;
	}
	Rank_SaveAll();
	g_iTopPage[client] = 0;
	Rank_QueryTop(client);
	return Plugin_Handled;
}

/** Pide una fila de más: si llega, hay página siguiente. */
void Rank_QueryTop(int client)
{
	char query[192];
	Format(query, sizeof(query), "SELECT name, points, kills, deaths FROM retake_rank ORDER BY points DESC, kills DESC LIMIT %d OFFSET %d", RANK_PAGE + 1, g_iTopPage[client] * RANK_PAGE);
	g_hDb.Query(Rank_OnTopResult, query, client > 0 ? GetClientUserId(client) : 0);
}

public void Rank_OnTopResult(Database db, DBResultSet results, const char[] error, int userid)
{
	if (results == null)
	{
		LogError("No se pudo leer el top: %s", error);
		return;
	}
	int client = GetClientOfUserId(userid);
	if (userid != 0 && client == 0)
		return;
	int page = g_iTopPage[client];
	Panel panel = client > 0 ? new Panel() : null;
	char name[MAX_NAME_LENGTH], line[96];
	if (panel != null)
	{
		Format(line, sizeof(line), "Ranking del retake (página %d)", page + 1);
		panel.SetTitle(line);
	}
	int shown;
	bool more;
	while (results.FetchRow())
	{
		if (shown == RANK_PAGE)
		{
			more = true;
			break;
		}
		results.FetchString(0, name, sizeof(name));
		int deaths = results.FetchInt(3);
		Format(line, sizeof(line), "#%d %s - %d (K/D %.2f)", page * RANK_PAGE + ++shown, name, results.FetchInt(1), float(results.FetchInt(2)) / float(deaths > 0 ? deaths : 1));
		if (panel != null)
			panel.DrawText(line);
		else
			PrintToServer("%s", line);
	}
	if (panel == null)
		return;
	if (shown == 0)
		panel.DrawText("Todavía no hay nadie en el ranking");
	panel.DrawText(" ");
	if (page > 0)
	{
		panel.CurrentKey = RANK_KEY_PREV;
		panel.DrawItem("Anterior");
	}
	if (more)
	{
		panel.CurrentKey = RANK_KEY_NEXT;
		panel.DrawItem("Siguiente");
	}
	panel.CurrentKey = RANK_KEY_EXIT;
	panel.DrawItem("Salir");
	panel.Send(client, Rank_TopHandler, MENU_TIME_FOREVER);
	delete panel;
}

public int Rank_TopHandler(Menu menu, MenuAction action, int client, int key)
{
	if (action != MenuAction_Select || g_hDb == null)
		return 0;
	if (key == RANK_KEY_PREV && g_iTopPage[client] > 0)
	{
		g_iTopPage[client]--;
		Rank_QueryTop(client);
	}
	else if (key == RANK_KEY_NEXT)
	{
		g_iTopPage[client]++;
		Rank_QueryTop(client);
	}
	return 0;
}
