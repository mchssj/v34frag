/**
 * Estadísticas por jugador. Cada jugador tiene un registro identificado por su
 * SteamID, así que si se desconecta y vuelve sigue sumando en el mismo registro.
 */

#if defined _csstv_stats_included
	#endinput
#endif
#define _csstv_stats_included

#define MAX_REC 64
#define MAX_ROUND_LOG 160

enum
{
	ST_KILLS = 0,
	ST_DEATHS,
	ST_ASSISTS,
	ST_HS,
	ST_DAMAGE,
	ST_ROUNDS,
	ST_ROUNDS_A,
	ST_ROUNDS_B,
	ST_K1,
	ST_K2,
	ST_K3,
	ST_K4,
	ST_K5,
	ST_FK,
	ST_FD,
	ST_PLANTS,
	ST_DEFUSES,
	ST_TK,
	ST_SUICIDES,
	ST_COUNT
};

int g_Stats[MAX_REC][ST_COUNT];
char g_RecSteam[MAX_REC][40];
char g_RecName[MAX_REC][MAX_NAME_LENGTH];
int g_iRecCount;
StringMap g_hRecIndex;
int g_iClientRec[MAXPLAYERS + 1];

// Datos de la ronda en curso
int g_iRoundKills[MAXPLAYERS + 1];
int g_iRoundDmg[MAXPLAYERS + 1][MAXPLAYERS + 1];   // [atacante][víctima]
int g_iLastHealth[MAXPLAYERS + 1];
bool g_bFirstKillDone;

// Registro de rondas
int g_iRoundLogCount;
int g_iRoundLogWinner[MAX_ROUND_LOG];   // 1 = A, 2 = B
int g_iRoundLogSideA[MAX_ROUND_LOG];    // lado del equipo A en esa ronda
int g_iRoundLogReason[MAX_ROUND_LOG];

void Stats_Init()
{
	g_hRecIndex = new StringMap();
	Stats_Reset();
}

void Stats_Reset()
{
	g_hRecIndex.Clear();
	g_iRecCount = 0;
	g_iRoundLogCount = 0;
	for (int r = 0; r < MAX_REC; r++)
	{
		for (int s = 0; s < ST_COUNT; s++)
			g_Stats[r][s] = 0;
		g_RecSteam[r][0] = '\0';
		g_RecName[r][0] = '\0';
	}
	for (int i = 0; i <= MaxClients; i++)
		g_iClientRec[i] = -1;
	Stats_RoundStart();
}

void Stats_ClientReset(int client)
{
	g_iClientRec[client] = -1;
	g_iRoundKills[client] = 0;
	g_iLastHealth[client] = 100;
	for (int i = 0; i <= MaxClients; i++)
	{
		g_iRoundDmg[client][i] = 0;
		g_iRoundDmg[i][client] = 0;
	}
}

void Stats_ClientLeave(int client)
{
	int rec = g_iClientRec[client];
	if (rec >= 0 && IsClientInGame(client))
		GetClientName(client, g_RecName[rec], sizeof(g_RecName[]));
	Stats_ClientReset(client);
}

/**
 * Devuelve el registro del jugador, creándolo si hace falta.
 * -1 si no se debe contar (bot, sin SteamID utilizable o sin lugar).
 */
int Stats_GetRec(int client)
{
	if (client <= 0 || client > MaxClients || !IsClientInGame(client))
		return -1;
	if (g_iClientRec[client] >= 0)
		return g_iClientRec[client];

	char key[40];
	if (IsFakeClient(client))
	{
		if (!g_cvIncludeBots.BoolValue)
			return -1;
		Format(key, sizeof(key), "BOT:%d", GetClientUserId(client));
	}
	else if (!GetClientAuthId(client, AuthId_Steam2, key, sizeof(key), g_cvValidateId.BoolValue)
		|| StrContains(key, "STEAM_ID", false) == 0 || StrContains(key, "STEAM_", false) != 0)
	{
		// SteamID inválido (LAN, pendiente, etc.): se cuenta igual pero no se podrá vincular.
		Format(key, sizeof(key), "NOSTEAM:%d", GetClientUserId(client));
	}

	int rec;
	if (!g_hRecIndex.GetValue(key, rec))
	{
		if (g_iRecCount >= MAX_REC)
			return -1;
		rec = g_iRecCount++;
		strcopy(g_RecSteam[rec], sizeof(g_RecSteam[]), key);
		g_hRecIndex.SetValue(key, rec);
	}
	GetClientName(client, g_RecName[rec], sizeof(g_RecName[]));
	g_iClientRec[client] = rec;
	return rec;
}

void Stats_Add(int client, int stat, int value)
{
	int rec = Stats_GetRec(client);
	if (rec >= 0)
		g_Stats[rec][stat] += value;
}

void Stats_RoundStart()
{
	g_bFirstKillDone = false;
	for (int i = 0; i <= MaxClients; i++)
	{
		g_iRoundKills[i] = 0;
		g_iLastHealth[i] = 100;
		for (int j = 0; j <= MaxClients; j++)
			g_iRoundDmg[i][j] = 0;
	}
}

void Stats_OnSpawn(int client)
{
	g_iLastHealth[client] = 100;
}

void Stats_OnHurt(int victim, int attacker, int dmgHealth, int healthLeft, bool live)
{
	int before = g_iLastHealth[victim];
	int real;
	if (dmgHealth > 0)
		real = dmgHealth < before ? dmgHealth : before;   // el daño no puede superar la vida que quedaba
	else
		real = before - (healthLeft > 0 ? healthLeft : 0);
	if (real < 0)
		real = 0;
	g_iLastHealth[victim] = before - real;

	if (!live || attacker <= 0 || attacker == victim || !IsClientInGame(attacker))
		return;
	if (GetClientTeam(attacker) == GetClientTeam(victim))
		return;
	g_iRoundDmg[attacker][victim] += real;
	Stats_Add(attacker, ST_DAMAGE, real);
}

void Stats_OnDeath(int victim, int attacker, bool headshot)
{
	Stats_Add(victim, ST_DEATHS, 1);

	if (attacker <= 0 || attacker == victim || !IsClientInGame(attacker))
	{
		Stats_Add(victim, ST_SUICIDES, 1);
		return;
	}
	int team = GetClientTeam(attacker);
	if (team == GetClientTeam(victim))
	{
		Stats_Add(attacker, ST_TK, 1);
		return;
	}

	Stats_Add(attacker, ST_KILLS, 1);
	if (headshot)
		Stats_Add(attacker, ST_HS, 1);
	g_iRoundKills[attacker]++;

	if (!g_bFirstKillDone)
	{
		g_bFirstKillDone = true;
		Stats_Add(attacker, ST_FK, 1);
		Stats_Add(victim, ST_FD, 1);
	}

	// Asistencia: el compañero que más daño le hizo a la víctima, si supera el mínimo.
	int best = -1, bestDmg = g_cvAssistDamage.IntValue - 1;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (i == attacker || !IsClientInGame(i) || GetClientTeam(i) != team)
			continue;
		if (g_iRoundDmg[i][victim] > bestDmg)
		{
			bestDmg = g_iRoundDmg[i][victim];
			best = i;
		}
	}
	if (best > 0)
		Stats_Add(best, ST_ASSISTS, 1);
}

/**
 * Cierra la ronda: rondas jugadas por jugador (y de qué lado) y multikills.
 */
void Stats_RoundEnd(int sideA)
{
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		int team = GetClientTeam(i);
		if (team != TEAM_T && team != TEAM_CT)
			continue;
		int rec = Stats_GetRec(i);
		if (rec < 0)
			continue;
		g_Stats[rec][ST_ROUNDS]++;
		g_Stats[rec][team == sideA ? ST_ROUNDS_A : ST_ROUNDS_B]++;
		int k = g_iRoundKills[i];
		if (k > 5)
			k = 5;
		if (k > 0)
			g_Stats[rec][ST_K1 + k - 1]++;
		GetClientName(i, g_RecName[rec], sizeof(g_RecName[]));
	}
}

void Stats_LogRound(int winner, int sideA, int reason)
{
	if (g_iRoundLogCount >= MAX_ROUND_LOG)
		return;
	g_iRoundLogWinner[g_iRoundLogCount] = winner;
	g_iRoundLogSideA[g_iRoundLogCount] = sideA;
	g_iRoundLogReason[g_iRoundLogCount] = reason;
	g_iRoundLogCount++;
}
