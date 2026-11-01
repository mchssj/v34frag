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
#define WEAPON_COUNT 26   // g_sWeapons

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
	// 2.7.0: datos para las medallas
	ST_SURVIVED,
	ST_WON_CT,
	ST_WON_T,
	ST_PISTOL_WON,
	ST_ECO_WON,
	ST_BOMBS,        // bombas que plantó y explotaron
	ST_CLUTCH1,      // clutchs ganados 1v1 … 1v5 (ST_CLUTCH1 + n - 1)
	ST_CLUTCH2,
	ST_CLUTCH3,
	ST_CLUTCH4,
	ST_CLUTCH5,
	ST_CLUTCH_TRIES,
	ST_WKILLS,       // kills por arma: ST_WKILLS + índice en g_sWeapons
	ST_WHS = ST_WKILLS + WEAPON_COUNT,
	ST_COUNT = ST_WHS + WEAPON_COUNT
};

// Armas de v34 tal como las nombra player_death, con su precio (para el equipamiento de la ronda).
char g_sWeapons[WEAPON_COUNT][] = {
	"glock", "usp", "p228", "deagle", "elite", "fiveseven",
	"m3", "xm1014", "mac10", "tmp", "mp5navy", "ump45", "p90",
	"galil", "famas", "ak47", "m4a1", "sg552", "aug",
	"scout", "sg550", "awp", "g3sg1", "m249", "knife", "hegrenade"
};
int g_iWeaponPrice[WEAPON_COUNT] = {
	400, 500, 600, 650, 800, 750,
	1700, 3000, 1400, 1250, 1500, 1700, 2350,
	2000, 2250, 2500, 3100, 3500, 3500,
	2750, 4200, 4750, 5000, 5750, 0, 300
};

// Ecos: equipamiento promedio del bando por debajo de ECO_MAX y el del rival desde ECO_RIVAL_MIN.
#define ECO_MAX       1500
#define ECO_RIVAL_MIN 3500

int g_Stats[MAX_REC][ST_COUNT];
char g_RecSteam[MAX_REC][40];
char g_RecName[MAX_REC][MAX_NAME_LENGTH];
int g_iRecCount;
StringMap g_hRecIndex;
int g_iClientRec[MAXPLAYERS + 1];

// Datos de la ronda en curso
int g_iRoundKills[MAXPLAYERS + 1];
int g_iRoundDmg[MAXPLAYERS + 1][MAXPLAYERS + 1];   // [atacante][víctima]
int g_iRoundHits[MAXPLAYERS + 1][MAXPLAYERS + 1];  // [atacante][víctima]
int g_iLastHealth[MAXPLAYERS + 1];
bool g_bFirstKillDone;

// Daño de la ronda anterior (para el reporte al empezar la ronda)
int g_iPrevDmg[MAXPLAYERS + 1][MAXPLAYERS + 1];
int g_iPrevHits[MAXPLAYERS + 1][MAXPLAYERS + 1];
int g_iPrevRound;          // número de la ronda guardada; 0 = no hay
bool g_bPrevAlive[MAXPLAYERS + 1];   // seguía vivo al terminar esa ronda

// Registro de rondas
int g_iRoundLogCount;
int g_iRoundLogWinner[MAX_ROUND_LOG];   // 1 = A, 2 = B
int g_iRoundLogSideA[MAX_ROUND_LOG];    // lado del equipo A en esa ronda
int g_iRoundLogReason[MAX_ROUND_LOG];
int g_iRoundLogEqA[MAX_ROUND_LOG];      // equipamiento promedio del equipo A (-1 = sin medir)
int g_iRoundLogEqB[MAX_ROUND_LOG];

// Ronda en curso (2.7.0)
int g_iRoundEq[4];             // equipamiento promedio por lado (TEAM_T, TEAM_CT) al terminar el freezetime; -1 = sin medir
bool g_bRoundOver;             // ya terminó la ronda: las muertes de después no cuentan para los clutchs
int g_iClutchRec[4];           // registro del último vivo de cada lado (-1 = no hubo clutch)
int g_iClutchVs[4];            // contra cuántos rivales quedó

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
	g_iPrevRound = 0;
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
		g_iRoundHits[client][i] = 0;
		g_iRoundHits[i][client] = 0;
		g_iPrevDmg[client][i] = 0;
		g_iPrevDmg[i][client] = 0;
		g_iPrevHits[client][i] = 0;
		g_iPrevHits[i][client] = 0;
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
 * Clave del registro del jugador (su SteamID). false si no se debe contar (bot sin
 * csstv_include_bots).
 */
bool Stats_ClientKey(int client, char[] key, int maxlen)
{
	if (IsFakeClient(client))
	{
		if (!g_cvIncludeBots.BoolValue)
			return false;
#if defined CSSTV_DEBUG
		// Solo en la compilación de pruebas: SteamID falso y estable por nombre de bot,
		// para que la web les aplique ELO. Rango STEAM_0:x:9990xxxxx, fácil de reconocer.
		char botName[MAX_NAME_LENGTH];
		GetClientName(client, botName, sizeof(botName));
		int h = 5381;
		for (int i = 0; botName[i] != '\0'; i++)
			h = ((h << 5) + h + botName[i]) & 0x7FFFFFFF;
		Format(key, maxlen, "STEAM_0:%d:%d", h & 1, 999000000 + (h >> 1) % 100000);
#else
		Format(key, maxlen, "BOT:%d", GetClientUserId(client));
#endif
	}
#if defined CSSTV_DEBUG
	else if (GetClientAuthId(client, AuthId_Steam2, key, maxlen, false) && StrEqual(key, "STEAM_ID_LAN", false))
	{
		// Solo en la compilación de pruebas: con sv_lan 1 no hay SteamID; se usa el falso por nombre, como a los bots.
		char lanName[MAX_NAME_LENGTH];
		GetClientName(client, lanName, sizeof(lanName));
		int h = 5381;
		for (int i = 0; lanName[i] != '\0'; i++)
			h = ((h << 5) + h + lanName[i]) & 0x7FFFFFFF;
		Format(key, maxlen, "STEAM_0:%d:%d", h & 1, 999000000 + (h >> 1) % 100000);
	}
#endif
	else if (!GetClientAuthId(client, AuthId_Steam2, key, maxlen, g_cvValidateId.BoolValue)
		|| StrContains(key, "STEAM_ID", false) == 0 || StrContains(key, "STEAM_", false) != 0)
	{
		// SteamID inválido (LAN, pendiente, etc.): se cuenta igual pero no se podrá vincular.
		Format(key, maxlen, "NOSTEAM:%d", GetClientUserId(client));
	}
	return true;
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
	if (!Stats_ClientKey(client, key, sizeof(key)))
		return -1;

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

/** Como Stats_GetRec, pero sin crear el registro: -1 si el jugador todavía no jugó esta partida. */
int Stats_FindRec(int client)
{
	if (client <= 0 || client > MaxClients || !IsClientInGame(client))
		return -1;
	if (g_iClientRec[client] >= 0)
		return g_iClientRec[client];
	char key[40];
	int rec;
	if (!Stats_ClientKey(client, key, sizeof(key)) || !g_hRecIndex.GetValue(key, rec))
		return -1;
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
	g_bRoundOver = false;
	for (int t = 0; t < 4; t++)
	{
		g_iRoundEq[t] = -1;
		g_iClutchRec[t] = -1;
		g_iClutchVs[t] = 0;
	}
	for (int i = 0; i <= MaxClients; i++)
	{
		g_iRoundKills[i] = 0;
		g_iLastHealth[i] = 100;
		for (int j = 0; j <= MaxClients; j++)
		{
			g_iRoundDmg[i][j] = 0;
			g_iRoundHits[i][j] = 0;
		}
	}
}

/**
 * Guarda el daño de la ronda que terminó para mostrarlo al empezar la siguiente.
 */
void Stats_SnapshotRound(int roundNumber)
{
	for (int i = 0; i <= MaxClients; i++)
	{
		for (int j = 0; j <= MaxClients; j++)
		{
			g_iPrevDmg[i][j] = g_iRoundDmg[i][j];
			g_iPrevHits[i][j] = g_iRoundHits[i][j];
		}
		g_bPrevAlive[i] = i > 0 && IsClientInGame(i) && IsPlayerAlive(i);
	}
	g_iPrevRound = roundNumber;
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
	if (real > 0)
		g_iRoundHits[attacker][victim]++;
	Stats_Add(attacker, ST_DAMAGE, real);
}

int Stats_WeaponIndex(const char[] weapon)
{
	for (int w = 0; w < WEAPON_COUNT; w++)
		if (StrEqual(weapon, g_sWeapons[w]))
			return w;
	return -1;
}

void Stats_OnDeath(int victim, int attacker, bool headshot, const char[] weapon)
{
	Stats_ClutchCheck(victim);
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
	int w = Stats_WeaponIndex(weapon);
	if (w >= 0)
	{
		Stats_Add(attacker, ST_WKILLS + w, 1);
		if (headshot)
			Stats_Add(attacker, ST_WHS + w, 1);
	}
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
 * Clutchs: cuando un lado se queda con un solo vivo contra al menos un rival, ese jugador
 * intenta el clutch (una vez por ronda y por lado). victim acaba de morir y no se cuenta.
 */
void Stats_ClutchCheck(int victim)
{
	if (g_bRoundOver)
		return;
	int alive[4], last[4];
	for (int i = 1; i <= MaxClients; i++)
	{
		if (i == victim || !IsClientInGame(i) || !IsPlayerAlive(i))
			continue;
		int team = GetClientTeam(i);
		if (team == TEAM_T || team == TEAM_CT)
		{
			alive[team]++;
			last[team] = i;
		}
	}
	for (int team = TEAM_T; team <= TEAM_CT; team++)
	{
		int vs = alive[team == TEAM_T ? TEAM_CT : TEAM_T];
		if (g_iClutchRec[team] >= 0 || alive[team] != 1 || vs < 1)
			continue;
		int rec = Stats_GetRec(last[team]);
		if (rec < 0)
			continue;
		g_iClutchRec[team] = rec;
		g_iClutchVs[team] = vs > 5 ? 5 : vs;
		g_Stats[rec][ST_CLUTCH_TRIES]++;
	}
}

/** Valor del equipamiento de un jugador: armas (sin la C4), granadas, chaleco, casco y kit. */
int Stats_Equipment(int client)
{
	int value, size = GetEntPropArraySize(client, Prop_Send, "m_hMyWeapons");
	char cls[32];
	for (int i = 0; i < size; i++)
	{
		int ent = GetEntPropEnt(client, Prop_Send, "m_hMyWeapons", i);
		if (ent <= 0 || !IsValidEdict(ent))
			continue;
		GetEdictClassname(ent, cls, sizeof(cls));
		if (StrContains(cls, "weapon_") != 0)
			continue;
		if (StrEqual(cls[7], "flashbang"))
			value += 200;
		else if (StrEqual(cls[7], "smokegrenade"))
			value += 300;
		else
		{
			int w = Stats_WeaponIndex(cls[7]);
			if (w >= 0)
				value += g_iWeaponPrice[w];
		}
	}
	if (GetClientArmor(client) > 0)
		value += GetEntProp(client, Prop_Send, "m_bHasHelmet") ? 1000 : 650;
	if (GetClientTeam(client) == TEAM_CT && GetEntProp(client, Prop_Send, "m_bHasDefuser"))
		value += 200;
	return value;
}

/** Al terminar el freezetime: equipamiento promedio de cada lado. */
void Stats_FreezeEnd()
{
	int sum[4], n[4];
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || !IsPlayerAlive(i))
			continue;
		int team = GetClientTeam(i);
		if (team != TEAM_T && team != TEAM_CT)
			continue;
		sum[team] += Stats_Equipment(i);
		n[team]++;
	}
	for (int team = TEAM_T; team <= TEAM_CT; team++)
		g_iRoundEq[team] = n[team] > 0 ? sum[team] / n[team] : -1;
}

/**
 * Cierra la ronda: rondas jugadas por jugador (y de qué lado), multikills, rondas
 * sobrevividas y ganadas, pistolas, ecos y clutchs.
 * pistol: primera ronda de una mitad del reglamentario. ecoOk: no es la primera de una mitad.
 */
void Stats_RoundEnd(int sideA, int winnerSide, bool pistol, bool ecoOk)
{
	g_bRoundOver = true;
	int loserSide = winnerSide == TEAM_CT ? TEAM_T : TEAM_CT;
	bool eco = ecoOk && g_iRoundEq[winnerSide] >= 0 && g_iRoundEq[loserSide] >= 0
		&& g_iRoundEq[winnerSide] < ECO_MAX && g_iRoundEq[loserSide] >= ECO_RIVAL_MIN;
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
		if (IsPlayerAlive(i))
			g_Stats[rec][ST_SURVIVED]++;
		if (team == winnerSide)
		{
			g_Stats[rec][team == TEAM_CT ? ST_WON_CT : ST_WON_T]++;
			if (pistol)
				g_Stats[rec][ST_PISTOL_WON]++;
			if (eco)
				g_Stats[rec][ST_ECO_WON]++;
		}
		GetClientName(i, g_RecName[rec], sizeof(g_RecName[]));
	}
	// El clutch cuenta si su lado gana la ronda, aunque él muera después (por ejemplo, con la bomba).
	int rec = g_iClutchRec[winnerSide];
	if (rec >= 0)
		g_Stats[rec][ST_CLUTCH1 + g_iClutchVs[winnerSide] - 1]++;
}

void Stats_LogRound(int winner, int sideA, int reason)
{
	if (g_iRoundLogCount >= MAX_ROUND_LOG)
		return;
	g_iRoundLogWinner[g_iRoundLogCount] = winner;
	g_iRoundLogSideA[g_iRoundLogCount] = sideA;
	g_iRoundLogReason[g_iRoundLogCount] = reason;
	int sideB = sideA == TEAM_CT ? TEAM_T : TEAM_CT;
	g_iRoundLogEqA[g_iRoundLogCount] = g_iRoundEq[sideA];
	g_iRoundLogEqB[g_iRoundLogCount] = g_iRoundEq[sideB];
	g_iRoundLogCount++;
}
