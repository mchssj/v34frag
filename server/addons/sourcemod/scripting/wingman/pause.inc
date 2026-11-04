/**
 * Pausas, con las mismas reglas que los mixes (csstv/qol.inc): alargan el freezetime con
 * m_fRoundStartTime. Si se pide fuera del freezetime, empieza al inicio de la próxima ronda.
 * Los comandos son los mismos que los del reporter: se toman con un listener, y si el modo está
 * apagado siguen de largo.
 */

#if defined _wingman_pause_included
	#endinput
#endif
#define _wingman_pause_included

#define PAUSE_OFF 0
#define PAUSE_TIMED 1
#define PAUSE_UNTIL 2
#define PAUSE_BOTH 3
#define PAUSE_BY_ADMIN 2       // g_iPauseBy: 0 = pareja A, 1 = pareja B, 2 = admin
#define PAUSE_HOLD 600.0
#define PAUSE_RESUME 3.0

ConVar g_cvPauseMode;
ConVar g_cvPauseMax;
ConVar g_cvPauseTime;
int g_iPausesUsed[2];
bool g_bPauseRequested;
bool g_bPaused;
int g_iPauseBy;
bool g_bPauseTimed;
float g_fPauseEnds;
bool g_bUnpauseReady[2];
int g_iPauseTicks;
Handle g_hPauseTimer;

void Pause_Init()
{
	g_cvPauseMode = CreateConVar("sm_2v2_pause_mode", "3", "Pausas: 0 desactivadas, 1 con tiempo, 2 hasta !unpause de los dos equipos, 3 con tiempo o !unpause.", _, true, 0.0, true, 3.0);
	g_cvPauseMax  = CreateConVar("sm_2v2_pause_max", "2", "Pausas por equipo y por partida.", _, true, 0.0, true, 20.0);
	g_cvPauseTime = CreateConVar("sm_2v2_pause_time", "60", "Segundos de cada pausa (modos 1 y 3).", _, true, 5.0, true, 600.0);
	static const char commands[][] = { "sm_pause", "sm_unpause", "sm_forcepause", "sm_forceunpause" };
	for (int i = 0; i < sizeof(commands); i++)
	{
		RegConsoleCmd(commands[i], Cmd_ReadyNoop, "Pausas del 2v2.");
		AddCommandListener(Pause_Listener, commands[i]);
	}
}

public Action Pause_Listener(int client, const char[] command, int argc)
{
	if (!g_bActive)
		return Plugin_Continue;
	if (StrEqual(command, "sm_pause", false))
		Pause_Ask(client);
	else if (StrEqual(command, "sm_unpause", false))
		Pause_Unpause(client);
	else if (client == 0 || CheckCommandAccess(client, "sm_forcepause", ADMFLAG_GENERIC))
	{
		if (StrEqual(command, "sm_forcepause", false))
			Pause_Force(client);
		else
			Pause_ForceEnd(client);
	}
	return Plugin_Stop;
}

void Pause_Reply(int client, const char[] text)
{
	if (client > 0)
		Chat(client, "%s %s", WM_PREFIX, text);
	else
		PrintToServer("[2v2] %s", text);
}

int Pause_TeamIndex(int client)
{
	return GetClientTeam(client) == g_iSideA ? 0 : 1;
}

bool Pause_InFreeze()
{
	return GameRules_GetProp("m_bFreezePeriod") != 0;
}

bool Pause_CanNow(int client)
{
	if (g_iState != State_Live || g_bRestarting)
	{
		Pause_Reply(client, "Solo se puede pausar durante la partida.");
		return false;
	}
	if (g_bPaused || g_bPauseRequested)
	{
		Pause_Reply(client, g_bPaused ? "Ya hay una pausa en curso." : "Ya hay una pausa pedida para la próxima ronda.");
		return false;
	}
	return true;
}

void Pause_Ask(int client)
{
	if (client <= 0 || !IsClientInGame(client))
		return;
	if (g_cvPauseMode.IntValue == PAUSE_OFF)
	{
		Pause_Reply(client, "Las pausas están desactivadas en este servidor.");
		return;
	}
	if (GetClientTeam(client) < TEAM_T)
	{
		Pause_Reply(client, "Solo los jugadores de un equipo pueden pausar.");
		return;
	}
	if (!Pause_CanNow(client))
		return;
	int t = Pause_TeamIndex(client);
	if (g_iPausesUsed[t] >= g_cvPauseMax.IntValue)
	{
		Pause_Reply(client, "Tu equipo ya usó todas sus pausas.");
		return;
	}
	g_iPauseBy = t;
	if (Pause_InFreeze())
		Pause_Start();
	else
	{
		g_bPauseRequested = true;
		ChatAll("%s {#amarillo}%N pidió una pausa para la pareja %s.{#blanco} Empieza al inicio de la próxima ronda (!unpause para cancelarla).", WM_PREFIX, client, t == 0 ? "A" : "B");
	}
}

void Pause_Force(int client)
{
	if (!Pause_CanNow(client))
		return;
	g_iPauseBy = PAUSE_BY_ADMIN;
	if (Pause_InFreeze())
		Pause_Start();
	else
	{
		g_bPauseRequested = true;
		ChatAll("%s {#amarillo}Un admin pidió una pausa.{#blanco} Empieza al inicio de la próxima ronda.", WM_PREFIX);
	}
}

/** Al preparar la ronda: empieza la pausa que se había pedido. */
void Pause_OnRoundPrepared()
{
	if (g_bPauseRequested && !g_bPaused && g_iState == State_Live && Pause_InFreeze())
		Pause_Start();
}

void Pause_Start()
{
	int mode = g_cvPauseMode.IntValue;
	bool admin = g_iPauseBy == PAUSE_BY_ADMIN;
	g_bPauseRequested = false;
	g_bPaused = true;
	g_bUnpauseReady[0] = false;
	g_bUnpauseReady[1] = false;
	g_bPauseTimed = !admin && (mode == PAUSE_TIMED || mode == PAUSE_BOTH);
	float secs = g_bPauseTimed ? g_cvPauseTime.FloatValue : PAUSE_HOLD;
	g_fPauseEnds = GetGameTime() + secs;
	g_iPauseTicks = 0;
	GameRules_SetPropFloat("m_fRoundStartTime", g_fPauseEnds);
	if (admin)
		ChatAll("%s {#amarillo}Pausa del admin.{#blanco} Sigue con !forceunpause o cuando los dos equipos escriban !unpause.", WM_PREFIX);
	else
	{
		g_iPausesUsed[g_iPauseBy]++;
		ChatAll("%s {#amarillo}Pausa de la pareja %s (%d de %d).", WM_PREFIX, g_iPauseBy == 0 ? "A" : "B", g_iPausesUsed[g_iPauseBy], g_cvPauseMax.IntValue);
		if (mode == PAUSE_TIMED)
			ChatAll("%s Dura %d segundos.", WM_PREFIX, RoundToFloor(secs));
		else if (mode == PAUSE_UNTIL)
			ChatAll("%s Sigue cuando los dos equipos escriban !unpause.", WM_PREFIX);
		else
			ChatAll("%s Dura %d segundos, o menos si los dos equipos escriben !unpause.", WM_PREFIX, RoundToFloor(secs));
	}
	delete g_hPauseTimer;
	g_hPauseTimer = CreateTimer(1.0, Timer_PauseTick, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
#if defined WINGMAN_DEBUG
	LogMessage("WM_DBG pausa por=%d conTiempo=%d", g_iPauseBy, g_bPauseTimed);
#endif
}

public Action Timer_PauseTick(Handle timer)
{
	if (!g_bPaused || g_iState != State_Live)
	{
		g_hPauseTimer = null;
		return Plugin_Stop;
	}
	int left = RoundToCeil(g_fPauseEnds - GetGameTime());
	if (g_bPauseTimed)
	{
		if (left <= 0)
		{
			g_hPauseTimer = null;
			Pause_End("Se terminó el tiempo de la pausa.");
			return Plugin_Stop;
		}
		if (left == 30 || left == 10 || left <= 5)
			ChatAll("%s La pausa termina en {#amarillo}%d s{#blanco}.", WM_PREFIX, left);
	}
	else
	{
		if (left < 60)   // pausa sin tiempo: se mantiene el freezetime lejos
		{
			g_fPauseEnds = GetGameTime() + PAUSE_HOLD;
			GameRules_SetPropFloat("m_fRoundStartTime", g_fPauseEnds);
		}
		if (++g_iPauseTicks % 30 == 0)
			Pause_PrintStatus();
	}
	return Plugin_Continue;
}

void Pause_PrintStatus()
{
	ChatAll("%s En pausa. Para seguir: !unpause (pareja A %s, pareja B %s).", WM_PREFIX, g_bUnpauseReady[0] ? "lista" : "falta", g_bUnpauseReady[1] ? "lista" : "falta");
}

void Pause_Unpause(int client)
{
	if (client <= 0 || !IsClientInGame(client) || GetClientTeam(client) < TEAM_T)
		return;
	int t = Pause_TeamIndex(client);
	if (g_bPauseRequested)
	{
		if (g_iPauseBy != t)
		{
			Pause_Reply(client, "Solo el equipo que pidió la pausa puede cancelarla.");
			return;
		}
		g_bPauseRequested = false;
		ChatAll("%s %N canceló la pausa pedida.", WM_PREFIX, client);
		return;
	}
	if (!g_bPaused)
	{
		Pause_Reply(client, "No hay ninguna pausa.");
		return;
	}
	if (g_bPauseTimed && g_cvPauseMode.IntValue == PAUSE_TIMED)
	{
		Pause_Reply(client, "Esta pausa termina sola.");
		return;
	}
	if (!g_bUnpauseReady[t])
	{
		g_bUnpauseReady[t] = true;
		ChatAll("%s %N: la pareja %s está lista para seguir.", WM_PREFIX, client, t == 0 ? "A" : "B");
	}
	if (g_bUnpauseReady[0] && g_bUnpauseReady[1])
		Pause_End("Los dos equipos están listos.");
	else
		Pause_PrintStatus();
}

void Pause_ForceEnd(int client)
{
	if (g_bPauseRequested)
	{
		g_bPauseRequested = false;
		ChatAll("%s Un admin canceló la pausa pedida.", WM_PREFIX);
	}
	else if (g_bPaused)
		Pause_End("Un admin terminó la pausa.");
	else
		Pause_Reply(client, "No hay ninguna pausa.");
}

void Pause_End(const char[] reason)
{
	g_bPaused = false;
	delete g_hPauseTimer;
	if (g_iState == State_Live && Pause_InFreeze())
	{
		GameRules_SetPropFloat("m_fRoundStartTime", GetGameTime() + PAUSE_RESUME);
		// La compra sigue el resto de su tiempo, contado desde que termina la pausa.
		float extra = g_cvBuyTime.FloatValue * 60.0 - g_cvFreeze.FloatValue;
		g_fBuyUntil = GetGameTime() + PAUSE_RESUME + (extra > 0.0 ? extra : 0.0);
	}
	ChatAll("%s {#verde}%s Se sigue en 3 segundos.", WM_PREFIX, reason);
#if defined WINGMAN_DEBUG
	LogMessage("WM_DBG finpausa");
#endif
}

/** Sin mensajes: al empezar, cancelar o terminar la partida. */
void Pause_Clear()
{
	g_bPauseRequested = false;
	g_bPaused = false;
	delete g_hPauseTimer;
	g_iPausesUsed[0] = 0;
	g_iPausesUsed[1] = 0;
}
