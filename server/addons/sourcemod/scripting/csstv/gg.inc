/**
 * !gg: rendición. Solo la puede pedir el equipo que va perdiendo por csstv_gg_min_diff rondas
 * o más. Hace falta el voto de todos los jugadores del equipo menos csstv_gg_missing, en
 * GG_VOTE_TIME segundos. Si se aprueba, la partida termina en el momento como terminada
 * (gana el que iba adelante, cuenta para el ELO) y se envía con end_reason = "surrender".
 */

#if defined _csstv_gg_included
	#endinput
#endif
#define _csstv_gg_included

#define GG_VOTE_TIME 30.0

ConVar g_cvGgMinDiff;
ConVar g_cvGgMissing;
int g_iGgTeam = -1;            // equipo que está votando (0 = A, 1 = B); -1 = ninguna votación
bool g_bGgVote[MAXPLAYERS + 1];
Handle g_hGgTimer;

void Gg_Init()
{
	g_cvGgMinDiff = CreateConVar("csstv_gg_min_diff", "8", "!gg: rondas de diferencia que tiene que ir perdiendo un equipo para poder rendirse (0 = !gg desactivado).", _, true, 0.0, true, 30.0);
	g_cvGgMissing = CreateConVar("csstv_gg_missing", "1", "!gg: votos que pueden faltar en el equipo (1 = todos menos uno: 4 de 5).", _, true, 0.0, true, 10.0);
	RegConsoleCmd("sm_gg", Cmd_Gg, "Votar para que tu equipo se rinda.");
}

void Gg_Reset()
{
	Gg_Clear();
}

/** Corta la votación sin mensajes (al terminar, cancelar o empezar otra partida). */
void Gg_Clear()
{
	g_iGgTeam = -1;
	delete g_hGgTimer;
	for (int i = 0; i <= MaxClients; i++)
		g_bGgVote[i] = false;
}

void Gg_ClientReset(int client)
{
	g_bGgVote[client] = false;
}

int Gg_TeamSide(int t)
{
	return t == 0 ? g_iSideA : OtherSide(g_iSideA);
}

/** Jugadores del equipo y cuántos de ellos votaron. */
void Gg_Count(int t, int &players, int &votes)
{
	players = 0;
	votes = 0;
	int side = Gg_TeamSide(t);
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsCountedPlayer(i) || GetClientTeam(i) != side)
			continue;
		players++;
		if (g_bGgVote[i])
			votes++;
	}
}

int Gg_Needed(int players)
{
	int needed = players - g_cvGgMissing.IntValue;
	return needed < 1 ? 1 : needed;
}

public Action Cmd_Gg(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	int minDiff = g_cvGgMinDiff.IntValue;
	if (minDiff <= 0)
	{
		QolReply(client, "[%s] La rendición está desactivada en este servidor.", g_sTag);
		return Plugin_Handled;
	}
	if (g_State != State_Live || g_bRestarting)
	{
		QolReply(client, "[%s] !gg solo funciona con la partida en vivo.", g_sTag);
		return Plugin_Handled;
	}
	if (!IsTeamSide(GetClientTeam(client)))
	{
		QolReply(client, "[%s] Solo los jugadores de un equipo pueden votar !gg.", g_sTag);
		return Plugin_Handled;
	}
	int t = TeamIndexOf(client);
	int mine = t == 0 ? g_iTotA : g_iTotB, theirs = t == 0 ? g_iTotB : g_iTotA;
	if (theirs - mine < minDiff)
	{
		QolReply(client, "[%s] Solo se puede rendir el equipo que pierde por %d %s o más (van %d - %d).", g_sTag, minDiff, minDiff == 1 ? "ronda" : "rondas", mine, theirs);
		return Plugin_Handled;
	}
	if (g_iGgTeam != -1 && g_iGgTeam != t)
	{
		QolReply(client, "[%s] Ya hay otra votación de rendición en curso.", g_sTag);
		return Plugin_Handled;
	}
	if (g_bGgVote[client])
	{
		QolReply(client, "[%s] Ya votaste !gg.", g_sTag);
		return Plugin_Handled;
	}
	bool first = g_iGgTeam == -1;
	if (first)
	{
		g_iGgTeam = t;
		g_hGgTimer = CreateTimer(GG_VOTE_TIME, Timer_GgExpire, _, TIMER_FLAG_NO_MAPCHANGE);
	}
	g_bGgVote[client] = true;
	int players, votes;
	Gg_Count(t, players, votes);
	int needed = Gg_Needed(players);
	if (first)
		QolChatAll("%s {#amarillo}%N propone rendirse (gg).{#normal} El %s necesita %d %s: escriban {#verde}!gg{#normal} (%d s). Votos: %d/%d.", PREFIX,
			client, g_sTeam[t], needed, needed == 1 ? "voto" : "votos", RoundToFloor(GG_VOTE_TIME), votes, needed);
	else
		QolChatAll("%s %N votó gg (%d/%d).", PREFIX, client, votes, needed);
	if (votes >= needed)
		Gg_Surrender(t);
	return Plugin_Handled;
}

public Action Timer_GgExpire(Handle timer)
{
	g_hGgTimer = null;
	if (g_iGgTeam == -1)
		return Plugin_Stop;
	int players, votes;
	Gg_Count(g_iGgTeam, players, votes);
	QolChatAll("%s La votación para rendirse del %s no llegó a los votos (%d/%d). La partida sigue.", PREFIX, g_sTeam[g_iGgTeam], votes, Gg_Needed(players));
	Gg_Clear();
	return Plugin_Stop;
}

void Gg_Surrender(int t)
{
	Gg_Clear();
	g_bSurrender = true;
	g_iSurrenderTeam = t;
	LogMessage("Partida %s: el equipo %s se rinde (%d-%d).", g_sMatchUid, t == 0 ? "A" : "B", g_iTotA, g_iTotB);
	FinishMatch();
}
