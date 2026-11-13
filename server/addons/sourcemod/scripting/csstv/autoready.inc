/**
 * !ready automático (bitácora 2026-11-13-ready-automatico).
 *
 * En el calentamiento de un mix libre o de una sala del matchmaking, el que entra a CT o T queda listo solo y se
 * revisa el arranque de siempre (CheckReadyStart). En torneos y PCW (vínculo de otro tipo o pendiente) se sigue
 * escribiendo !ready. Con el deathmatch, el retake o el 2v2 prendidos no hace nada: esos modos bloquean !ready.
 * Quien escribe !unready no vuelve a quedar listo solo hasta que escriba !ready o cambie el mapa.
 */

#if defined _csstv_autoready_included
	#endinput
#endif
#define _csstv_autoready_included

ConVar g_cvAutoReady;
bool g_bAutoReadyOff[MAXPLAYERS + 1];   // usó !unready: no se lo vuelve a marcar solo

void AutoReady_Init()
{
	g_cvAutoReady = CreateConVar("csstv_auto_ready", "1", "En el calentamiento de un mix o de una sala del matchmaking, el que entra a CT o T queda listo solo (!unready para frenar).", _, true, 0.0, true, 1.0);
	HookEvent("player_team", AutoReady_OnTeam);
}

void AutoReady_ClientReset(int client)
{
	g_bAutoReadyOff[client] = false;
}

void AutoReady_Reset()
{
	for (int i = 1; i <= MaxClients; i++)
		g_bAutoReadyOff[i] = false;
}

/** !unready la apaga para ese jugador; !ready la vuelve a prender. */
void AutoReady_SetOff(int client, bool off)
{
	g_bAutoReadyOff[client] = off;
}

bool AutoReady_ModeOn(const char[] cvar)
{
	ConVar cv = FindConVar(cvar);
	return cv != null && cv.BoolValue;
}

/** Si en este momento se entra listo solo (sin mirar al jugador). */
bool AutoReady_Applies()
{
	if (!g_cvAutoReady.BoolValue || !g_cvEnabled.BoolValue || !g_cvReadySystem.BoolValue || g_State != State_Warmup)
		return false;
	if (g_LinkState == Link_Pending || (g_LinkState == Link_Active && !StrEqual(g_sLinkKind, "mm")))
		return false;
	return !AutoReady_ModeOn("sm_dm_on") && !AutoReady_ModeOn("sm_retake_on") && !AutoReady_ModeOn("sm_2v2_on");
}

/**
 * Marca a los que ya estaban en un equipo cuando empezó a valer (por ejemplo, una sala tomada sin cambiar de mapa:
 * no hay evento de equipo). Se llama con el recordatorio del calentamiento.
 */
void AutoReady_Sweep()
{
	if (!AutoReady_Applies() || !License_Allows())
		return;
	int n;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!g_bReady[i] && !g_bAutoReadyOff[i] && IsCountedPlayer(i))
		{
			g_bReady[i] = true;
			n++;
		}
	}
	if (n)
		CheckReadyStart();
}

public void AutoReady_OnTeam(Event event, const char[] name, bool dontBroadcast)
{
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client <= 0 || event.GetBool("disconnect"))
		return;
	int team = event.GetInt("team");
	if (team != TEAM_T && team != TEAM_CT)
		return;
	// El equipo se aplica después del evento: se mira en el próximo frame.
	RequestFrame(AutoReady_Frame, GetClientUserId(client));
}

public void AutoReady_Frame(int userid)
{
	int client = GetClientOfUserId(userid);
	if (client <= 0 || g_bReady[client] || g_bAutoReadyOff[client] || !IsCountedPlayer(client) || !AutoReady_Applies()
		|| !License_Allows())
		return;
	g_bReady[client] = true;
	PrintToChatAll("%s %N está listo (%d/%d). !unready si necesitás un momento.", PREFIX, client, CountReady(), CountTeamPlayers());
	CheckReadyStart();
}
