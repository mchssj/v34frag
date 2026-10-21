/**
 * Resumen al terminar la partida (también por !gg; no en una cancelada):
 *   [v34frag] Fin de la partida: Equipo daniloev 16 - 12 Equipo pepe. ¡Gana Equipo daniloev!
 *   [v34frag] MVP: daniloev (27 kills, 98 ADR)
 *   [v34frag] 1. daniloev  27/14/5  ADR 98  HS 52%
 *   (top 3)
 * y a cada jugador, en privado:
 *   [v34frag] Tu partida: 18/16/4 · ADR 82 · HS 44% · 3 primeras kills
 * y al final, a todos:
 *   [v34frag] ¡Gracias por jugar! Únete a nuestro Discord: dsc.gg/v34frag
 * El MVP es el de más kills; si empatan, el de más daño. ADR = daño / rondas jugadas.
 */

#if defined _csstv_summary_included
	#endinput
#endif
#define _csstv_summary_included

void Summary_Print()
{
	Summary_Result();

	// Jugadores que completaron al menos una ronda, ordenados por kills y después por daño.
	int order[MAX_REC], n;
	for (int p = 0; p < g_iRecCount; p++)
		if (g_Stats[p][ST_ROUNDS] > 0)
			order[n++] = p;
	for (int a = 1; a < n; a++)
	{
		int r = order[a], b = a - 1;
		while (b >= 0 && Summary_Better(r, order[b]))
		{
			order[b + 1] = order[b];
			b--;
		}
		order[b + 1] = r;
	}
	if (!n)
	{
		Summary_Discord();
		return;
	}

	char name[MAX_NAME_LENGTH];
	Summary_Name(order[0], name, sizeof(name));
	int mvpKills = g_Stats[order[0]][ST_KILLS];
	QolChatAll("%s MVP: {#amarillo}%s{#normal} (%d %s, %d ADR)", PREFIX, name, mvpKills, mvpKills == 1 ? "kill" : "kills", Summary_Adr(order[0]));
	for (int k = 0; k < n && k < 3; k++)
	{
		int r = order[k];
		Summary_Name(r, name, sizeof(name));
		QolChatAll("%s %d. %s  {#amarillo}%d/%d/%d{#normal}  ADR %d  HS %d%%", PREFIX, k + 1, name,
			g_Stats[r][ST_KILLS], g_Stats[r][ST_DEATHS], g_Stats[r][ST_ASSISTS], Summary_Adr(r), Summary_Hs(r));
	}

	for (int i = 1; i <= MaxClients; i++)
	{
		if (!QolTarget(i))
			continue;
		int r = Stats_FindRec(i);
		if (r < 0 || g_Stats[r][ST_ROUNDS] <= 0)
			continue;
		char fk[40];
		int f = g_Stats[r][ST_FK];
		if (f > 0)
			Format(fk, sizeof(fk), " · %d %s", f, f == 1 ? "primera kill" : "primeras kills");
		QolChat(i, "%s Tu partida: {#amarillo}%d/%d/%d{#normal} · ADR %d · HS %d%%%s", PREFIX,
			g_Stats[r][ST_KILLS], g_Stats[r][ST_DEATHS], g_Stats[r][ST_ASSISTS], Summary_Adr(r), Summary_Hs(r), fk);
	}
	Summary_Discord();
}

void Summary_Discord()
{
	QolChatAll("%s ¡Gracias por jugar! Únete a nuestro Discord: {#amarillo}%s", PREFIX, DISCORD_INVITE);
}

/** Primera línea: el ganador primero. */
void Summary_Result()
{
	if (g_bSurrender)
	{
		int loser = g_iSurrenderTeam, winner = 1 - loser;
		QolChatAll("%s {#amarillo}%s se rindió (gg).{#normal} %s {#amarillo}%d - %d{#normal} %s. ¡Gana {#verde}%s{#normal}!", PREFIX,
			g_sTeam[loser], g_sTeam[winner], Summary_Score(winner), Summary_Score(loser), g_sTeam[loser], g_sTeam[winner]);
	}
	else if (g_iTotA != g_iTotB)
	{
		int winner = g_iTotA > g_iTotB ? 0 : 1, loser = 1 - winner;
		QolChatAll("%s Fin de la partida: %s {#amarillo}%d - %d{#normal} %s. ¡Gana {#verde}%s{#normal}!", PREFIX,
			g_sTeam[winner], Summary_Score(winner), Summary_Score(loser), g_sTeam[loser], g_sTeam[winner]);
	}
	else
		QolChatAll("%s Fin de la partida: %s {#amarillo}%d - %d{#normal} %s. Empate.", PREFIX, g_sTeam[0], g_iTotA, g_iTotB, g_sTeam[1]);
}

int Summary_Score(int t)
{
	return t == 0 ? g_iTotA : g_iTotB;
}

bool Summary_Better(int r, int than)
{
	if (g_Stats[r][ST_KILLS] != g_Stats[than][ST_KILLS])
		return g_Stats[r][ST_KILLS] > g_Stats[than][ST_KILLS];
	return g_Stats[r][ST_DAMAGE] > g_Stats[than][ST_DAMAGE];
}

int Summary_Adr(int r)
{
	return g_Stats[r][ST_ROUNDS] > 0 ? RoundToNearest(float(g_Stats[r][ST_DAMAGE]) / float(g_Stats[r][ST_ROUNDS])) : 0;
}

int Summary_Hs(int r)
{
	return g_Stats[r][ST_KILLS] > 0 ? RoundToNearest(100.0 * float(g_Stats[r][ST_HS]) / float(g_Stats[r][ST_KILLS])) : 0;
}

/** Nick guardado, sin llaves (para que no se lean como etiquetas de color). */
void Summary_Name(int r, char[] out, int len)
{
	strcopy(out, len, g_RecName[r]);
	ReplaceString(out, len, "{", "(");
}
