/**
 * !status: cómo está configurada la partida, para cualquiera (espectadores incluidos).
 * Estado, formato, inicio, pausas, !gg, vínculo con la web (!match) y demo.
 * sm_csstv_status (RCON) sigue siendo el estado técnico: cola de envíos y licencia.
 */

#if defined _csstv_status_included
	#endinput
#endif
#define _csstv_status_included

void Status_Init()
{
	RegConsoleCmd("sm_status", Cmd_PublicStatus, "Muestra cómo está configurada la partida.");
}

public Action Cmd_PublicStatus(int client, int args)
{
	char line[256];

	// Estado
	switch (g_State)
	{
		case State_Warmup:
			Format(line, sizeof(line), "calentamiento · %d/%d listos (!ready)", CountReady(), CountTeamPlayers());
		case State_Starting:
			strcopy(line, sizeof(line), "empezando (LO3)");
		case State_Knife:
			strcopy(line, sizeof(line), "faka (ronda de cuchillo)");
		case State_Halftime:
			Format(line, sizeof(line), "medio tiempo · %s %d-%d %s", g_sTeam[0], g_iTotA, g_iTotB, g_sTeam[1]);
		case State_Finished:
			Format(line, sizeof(line), "terminada · %s %d-%d %s", g_sTeam[0], g_iTotA, g_iTotB, g_sTeam[1]);
		default:
			Format(line, sizeof(line), "en vivo · %s %d-%d %s · ronda %d de %d%s", g_sTeam[0], g_iTotA, g_iTotB, g_sTeam[1],
				g_iSegRound + 1, g_iSegLen, g_iSegment ? " (prórroga)" : "");
	}
	if (g_bPaused)
		StrCat(line, sizeof(line), " · EN PAUSA");
	QolReply(client, "[%s] Estado: %s", g_sTag, line);

	// Formato
	int maxRounds = g_iMatchMaxRounds > 0 ? g_iMatchMaxRounds : g_cvMaxRounds.IntValue;
	if (g_cvOvertime.BoolValue)
		QolReply(client, "[%s] Formato: MR%d (%d rondas) · prórroga MR%d con $%d", g_sTag, maxRounds / 2, maxRounds,
			g_cvOtMaxRounds.IntValue / 2, g_cvOtStartMoney.IntValue);
	else
		QolReply(client, "[%s] Formato: MR%d (%d rondas) · sin prórroga", g_sTag, maxRounds / 2, maxRounds);

	// Inicio
	if (g_cvReadySystem.BoolValue)
		QolReply(client, "[%s] Inicio: !ready %s%s, mínimo %d jugadores", g_sTag,
			g_cvReadyKnife.BoolValue ? "con faka (ronda de cuchillo)" : "sin faka",
			g_cvLo3.BoolValue ? ", LO3" : "", g_cvMinPlayers.IntValue);
	else
		QolReply(client, "[%s] Inicio: lo empieza un admin con !live%s", g_sTag, g_cvLo3.BoolValue ? " (LO3)" : "");

	// Pausas y !gg
	char pause[96], gg[64];
	switch (g_cvPauseMode.IntValue)
	{
		case 0: strcopy(pause, sizeof(pause), "desactivadas");
		case 1: Format(pause, sizeof(pause), "%d por equipo de %d s", g_cvPauseMax.IntValue, g_cvPauseTime.IntValue);
		case 2: Format(pause, sizeof(pause), "%d por equipo, hasta !unpause de los dos", g_cvPauseMax.IntValue);
		default: Format(pause, sizeof(pause), "%d por equipo de %d s (o !unpause de los dos)", g_cvPauseMax.IntValue, g_cvPauseTime.IntValue);
	}
	if (g_cvGgMinDiff.IntValue > 0)
		Format(gg, sizeof(gg), "con %d rondas abajo", g_cvGgMinDiff.IntValue);
	else
		strcopy(gg, sizeof(gg), "desactivado");
	QolReply(client, "[%s] Pausas: %s · !gg %s", g_sTag, pause, gg);

	// Vínculo con la web
	if (MatchInProgress() || g_State == State_Finished)
	{
		if (g_sMatchLinkCode[0])
			QolReply(client, "[%s] Vinculado a {#amarillo}%s{#normal} · BO%d · serie %d-%d · código %s", g_sTag,
				g_sLinkTitle, g_iLinkBestOf, g_iLinkScore[0], g_iLinkScore[1], g_sMatchLinkCode);
		else
			QolReply(client, "[%s] Sin vincular: se guarda como mix", g_sTag);
	}
	else if (g_LinkState == Link_Active)
		QolReply(client, "[%s] Vinculado a {#amarillo}%s{#normal} · BO%d · serie %d-%d · código %s", g_sTag,
			g_sLinkTitle, g_iLinkBestOf, g_iLinkScore[0], g_iLinkScore[1], g_sLinkCode);
	else if (g_LinkState == Link_Pending)
		QolReply(client, "[%s] Pendiente: {#amarillo}%s{#normal}, falta que confirme alguien de %s (código %s)", g_sTag,
			g_sLinkTitle, g_sLinkTeamName[2 - g_iLinkProposer], g_sLinkCode);
	else
		QolReply(client, "[%s] Sin vincular: se guarda como mix (!match <código> para vincular a un torneo o PCW)", g_sTag);

	// Demo
	if (!g_cvDemo.BoolValue)
		strcopy(line, sizeof(line), "desactivada");
	else if (MatchInProgress())
		strcopy(line, sizeof(line), g_bDemoRecorded ? "grabando" : "sin grabar (falta tv_enable 1)");
	else
		strcopy(line, sizeof(line), "se graba al empezar la partida");
	QolReply(client, "[%s] Demo: %s", g_sTag, line);
	return Plugin_Handled;
}
