/**
 * Clips automáticos: las jugadas destacadas de cada ronda en vivo (incluida la prórroga).
 *
 * Por jugador y por ronda se anota el tick de cada kill y, si quedó último vivo de su equipo,
 * contra cuántos rivales (clutch). Al cerrar la ronda se guarda un registro si tiene 3 kills o
 * más, o un clutch que su equipo ganó. El plugin manda hechos, no tipos: la web clasifica (ace,
 * 4k, clutch 1v3…), ordena y aplica los topes, así que la escala se cambia sin tocar el plugin.
 *
 * Los ticks cuentan desde el inicio de la grabación de la demo (o desde el inicio del vivo si
 * no se graba), para ubicar la jugada en el .dem. Los registros viajan al final del JSON del
 * resultado y de la foto en vivo; si no entran en el buffer, el resultado sale sin clips.
 */

#if defined _csstv_clips_included
	#endinput
#endif
#define _csstv_clips_included

#define MAX_CLIPS 60
#define CLIP_MAX_KILLS 5

ConVar g_cvClips;
int g_iClipsBaseTick;          // GetGameTickCount() al empezar el vivo (el de la demo)

// Registros guardados de la partida
int g_iClipCount;
int g_iClipRec[MAX_CLIPS];               // registro de jugador (stats.inc)
int g_iClipRound[MAX_CLIPS];
int g_iClipSeconds[MAX_CLIPS];
bool g_bClipWon[MAX_CLIPS];
int g_iClipKills[MAX_CLIPS];
int g_iClipTicks[MAX_CLIPS][CLIP_MAX_KILLS];
int g_iClipVs[MAX_CLIPS];                // 0 = sin clutch
int g_iClipStart[MAX_CLIPS];
int g_iClipEnd[MAX_CLIPS];

// Ronda en curso, por cliente
int g_iRoundKillCount[MAXPLAYERS + 1];
int g_iRoundKillTicks[MAXPLAYERS + 1][CLIP_MAX_KILLS];
float g_fRoundFirstEvent[MAXPLAYERS + 1];   // GetGameTime() de su primera kill o del inicio del clutch
int g_iRoundClutchVs[MAXPLAYERS + 1];
int g_iRoundClutchTick[MAXPLAYERS + 1];
int g_iTeamClutcher[4];                     // por equipo: quién quedó en clutch esta ronda (0 = nadie)
int g_iTeamMaxAlive[4];                     // por equipo: el máximo de vivos que se vio en la ronda

void Clips_Init()
{
	g_cvClips = CreateConVar("csstv_clips", "1", "Detectar las jugadas destacadas de cada ronda y mandarlas con el resultado (clips).", _, true, 0.0, true, 1.0);
	Clips_Clear();
}

/** Partida nueva o vuelta al calentamiento. */
void Clips_Clear()
{
	g_iClipCount = 0;
	g_iClipsBaseTick = GetGameTickCount();
	Clips_RoundStart();
}

/** Al empezar el vivo, en el mismo cuadro que Demo_Start. */
void Clips_OnLiveStart()
{
	g_iClipsBaseTick = GetGameTickCount();
}

void Clips_RoundStart()
{
	for (int i = 0; i <= MaxClients; i++)
		Clips_ClientReset(i);
	for (int t = 0; t < 4; t++)
	{
		g_iTeamClutcher[t] = 0;
		g_iTeamMaxAlive[t] = 0;
	}
}

void Clips_ClientReset(int client)
{
	g_iRoundKillCount[client] = 0;
	g_fRoundFirstEvent[client] = 0.0;
	g_iRoundClutchVs[client] = 0;
	g_iRoundClutchTick[client] = 0;
	for (int t = 0; t < 4; t++)
	{
		if (g_iTeamClutcher[t] == client)
			g_iTeamClutcher[t] = 0;
	}
}

int Clips_Tick()
{
	int t = GetGameTickCount() - g_iClipsBaseTick;
	return t > 0 ? t : 0;
}

int Clips_Tickrate()
{
	return RoundToNearest(1.0 / GetTickInterval());
}

/** player_death en vivo, después de Stats_OnDeath. */
void Clips_OnDeath(int victim, int attacker)
{
	if (!g_cvClips.BoolValue)
		return;
	if (attacker > 0 && attacker != victim && IsClientInGame(attacker) && GetClientTeam(attacker) != GetClientTeam(victim))
	{
		int n = g_iRoundKillCount[attacker];
		if (n < CLIP_MAX_KILLS)
			g_iRoundKillTicks[attacker][n] = Clips_Tick();
		g_iRoundKillCount[attacker] = n + 1;
		if (g_fRoundFirstEvent[attacker] == 0.0)
			g_fRoundFirstEvent[attacker] = GetGameTime();
	}
	Clips_CheckClutch(victim, true);
}

/** Un jugador se va durante la ronda: puede dejar a un compañero en clutch. */
void Clips_OnLeave(int client)
{
	if (g_cvClips.BoolValue && g_State == State_Live && !g_bRestarting && IsClientInGame(client))
		Clips_CheckClutch(client, IsPlayerAlive(client));
	Clips_ClientReset(client);
}

/**
 * Cuenta los vivos de cada equipo sin contar a gone (el que acaba de morir o de irse; goneAlive:
 * si estaba vivo hasta recién, para el máximo de la ronda). Si un
 * equipo quedó con uno solo, que antes tenía compañeros, y ese jugador no estaba ya en clutch,
 * empieza su clutch contra los vivos del rival en este momento. Un 1v3 que llega al 1v1 sigue
 * siendo 1v3; el rival que en ese momento queda solo empieza su propio 1v1.
 */
void Clips_CheckClutch(int gone, bool goneAlive)
{
	int alive[4], last[4];
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		int team = GetClientTeam(i);
		if (team != TEAM_T && team != TEAM_CT)
			continue;
		if (i == gone)
		{
			// Hasta recién estaba vivo: cuenta para el máximo de la ronda, no para el clutch.
			if (goneAlive)
				alive[team]++;
			continue;
		}
		if (IsPlayerAlive(i))
		{
			alive[team]++;
			last[team] = i;
		}
	}
	for (int team = TEAM_T; team <= TEAM_CT; team++)
	{
		if (alive[team] > g_iTeamMaxAlive[team])
			g_iTeamMaxAlive[team] = alive[team];
		if (goneAlive && gone > 0 && IsClientInGame(gone) && GetClientTeam(gone) == team)
			alive[team]--;
	}
	for (int team = TEAM_T; team <= TEAM_CT; team++)
	{
		int rival = team == TEAM_T ? TEAM_CT : TEAM_T;
		if (alive[team] != 1 || alive[rival] < 1 || g_iTeamClutcher[team] != 0 || g_iTeamMaxAlive[team] < 2)
			continue;
		int c = last[team];
		g_iTeamClutcher[team] = c;
		g_iRoundClutchVs[c] = alive[rival] > 5 ? 5 : alive[rival];
		g_iRoundClutchTick[c] = Clips_Tick();
		if (g_fRoundFirstEvent[c] == 0.0)
			g_fRoundFirstEvent[c] = GetGameTime();
	}
}

/** Ronda en vivo terminada (antes de FinishMatch y de la foto en vivo). round: número de ronda de la partida. */
void Clips_RoundEnd(int winnerSide, int round)
{
	if (!g_cvClips.BoolValue)
		return;
	int endTick = Clips_Tick();
	float roundStart = GameRules_GetPropFloat("m_fRoundStartTime");   // fin del freezetime
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		int team = GetClientTeam(i);
		if (team != TEAM_T && team != TEAM_CT)
			continue;
		bool won = team == winnerSide;
		int kills = g_iRoundKillCount[i];
		if (kills > CLIP_MAX_KILLS)
			kills = CLIP_MAX_KILLS;
		bool clutch = g_iRoundClutchVs[i] > 0;
		if (kills < 3 && !(clutch && won))
			continue;
		int rec = Stats_GetRec(i);
		if (rec < 0)
			continue;
		int slot = Clips_Slot(kills, clutch && won ? g_iRoundClutchVs[i] : 0);
		if (slot < 0)
			continue;
		int secs = RoundToFloor(g_fRoundFirstEvent[i] - roundStart);
		g_iClipRec[slot] = rec;
		g_iClipRound[slot] = round;
		g_iClipSeconds[slot] = secs < 0 ? 0 : (secs > 3600 ? 3600 : secs);
		g_bClipWon[slot] = won;
		g_iClipKills[slot] = kills;
		for (int k = 0; k < kills; k++)
			g_iClipTicks[slot][k] = g_iRoundKillTicks[i][k];
		g_iClipVs[slot] = clutch ? g_iRoundClutchVs[i] : 0;
		g_iClipStart[slot] = g_iRoundClutchTick[i];
		g_iClipEnd[slot] = endTick;
	}
}

/** Valor para elegir qué se descarta si se llena: kills más el clutch ganado. */
int Clips_Value(int kills, int wonVs)
{
	return kills + wonVs;
}

/** Lugar para un registro nuevo: el siguiente libre o, lleno, el de menor valor si el nuevo vale más. -1 = no entra. */
int Clips_Slot(int kills, int wonVs)
{
	if (g_iClipCount < MAX_CLIPS)
		return g_iClipCount++;
	int worst = -1, worstValue = Clips_Value(kills, wonVs);
	for (int s = 0; s < MAX_CLIPS; s++)
	{
		int v = Clips_Value(g_iClipKills[s], g_bClipWon[s] ? g_iClipVs[s] : 0);
		if (v < worstValue)
		{
			worstValue = v;
			worst = s;
		}
	}
	return worst;
}

/**
 * Agrega ,"tickrate":N y ,"clips":[…] al JSON (json.inc), justo antes de cerrarlo. Si los clips
 * no entran en el buffer, los saca: el resultado nunca sale cortado por los clips.
 */
void Clips_WriteJson()
{
	J_KeyInt("tickrate", Clips_Tickrate());
	if (!g_cvClips.BoolValue)
		return;
	int start = g_iJsonLen;
	J_Raw(",\"clips\":[");
	for (int s = 0; s < g_iClipCount; s++)
	{
		int rec = g_iClipRec[s];
		if (s) J_Char(',');
		J_Char('{');
		J_KeyInt("round", g_iClipRound[s], false);
		J_KeyStr("steamid", g_RecSteam[rec]);
		J_KeyStr("name", g_RecName[rec]);
		J_KeyInt("round_seconds", g_iClipSeconds[s]);
		J_Raw(",\"round_won\":");
		J_Raw(g_bClipWon[s] ? "true" : "false");
		J_Raw(",\"kill_ticks\":[");
		for (int k = 0; k < g_iClipKills[s]; k++)
		{
			if (k) J_Char(',');
			J_Int(g_iClipTicks[s][k]);
		}
		J_Char(']');
		if (g_iClipVs[s] > 0)
		{
			J_KeyInt("clutch_vs", g_iClipVs[s]);
			J_KeyInt("clutch_start_tick", g_iClipStart[s]);
			J_KeyInt("end_tick", g_iClipEnd[s]);
		}
		J_Char('}');
	}
	J_Char(']');
	// Lleno (J_Raw corta sin avisar): fuera los clips. El margen deja lugar para cerrar el JSON y
	// para el texto que agrega Live_Recover al pasar una foto a cancelada por caída.
	if (g_iJsonLen >= JSON_MAX - 128)
	{
		LogError("Partida %s: los %d clips no entran en el resultado; se manda sin clips.", g_sMatchUid, g_iClipCount);
		g_iJsonLen = start;
		g_sJson[start] = '\0';
	}
}
