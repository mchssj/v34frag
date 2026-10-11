/**
 * Mejoras de calidad de vida durante el mix:
 * marcador estable, encabezado de ronda, reporte de daño, plata del equipo,
 * !hp, pausa táctica y demo automática.
 */

#if defined _csstv_qol_included
	#endinput
#endif
#define _csstv_qol_included

#define PAUSE_OFF      0
#define PAUSE_TIMED    1
#define PAUSE_UNTIL    2
#define PAUSE_BOTH     3
#define PAUSE_BY_ADMIN 2       // g_iPauseBy: 0 = equipo A, 1 = equipo B, 2 = admin
#define PAUSE_HOLD     3600.0  // segundos que se alarga el freezetime en una pausa sin tiempo
#define DEMO_DIR       "csstv_demos"

ConVar g_cvRoundHeader;
ConVar g_cvDamageReport;
ConVar g_cvTeamMoney;
ConVar g_cvHpOnDeath;
ConVar g_cvPauseMode;
ConVar g_cvPauseMax;
ConVar g_cvPauseTime;
ConVar g_cvDemo;
ConVar g_cvDemoKeep;

// !hp
int g_iKillerUserId[MAXPLAYERS + 1];
char g_sKillerWeapon[MAXPLAYERS + 1][32];

// Pausa
int g_iPausesUsed[2];          // por equipo (A, B), no por lado
bool g_bPauseRequested;
bool g_bPaused;
int g_iPauseBy;
bool g_bPauseTimed;
float g_fPauseEnds;            // GetGameTime() en que termina una pausa con tiempo
bool g_bUnpauseReady[2];
int g_iPauseTicks;
Handle g_hPauseTimer;

// Demo
bool g_bRecording;

void Qol_Init()
{
	g_cvRoundHeader  = CreateConVar("csstv_round_header", "1", "Encabezado al empezar cada ronda y avisos de último round y match point.", _, true, 0.0, true, 1.0);
	g_cvDamageReport = CreateConVar("csstv_damage_report", "1", "Mostrar a cada jugador el daño de la ronda anterior.", _, true, 0.0, true, 1.0);
	g_cvTeamMoney    = CreateConVar("csstv_team_money", "1", "Mostrar a cada equipo su plata al empezar la ronda.", _, true, 0.0, true, 1.0);
	g_cvHpOnDeath    = CreateConVar("csstv_hp_on_death", "1", "Al morir, mostrar quién te mató y cuánta vida le quedó (y el comando !hp).", _, true, 0.0, true, 1.0);
	g_cvPauseMode    = CreateConVar("csstv_pause_mode", "3", "Pausas: 0 desactivadas, 1 con tiempo, 2 hasta !unpause de los dos equipos, 3 con tiempo o !unpause.", _, true, 0.0, true, 3.0);
	g_cvPauseMax     = CreateConVar("csstv_pause_max", "2", "Pausas por equipo y por partida.", _, true, 0.0, true, 20.0);
	g_cvPauseTime    = CreateConVar("csstv_pause_time", "60", "Segundos de cada pausa (modos 1 y 3).", _, true, 10.0, true, 600.0);
	g_cvDemo         = CreateConVar("csstv_demo", "1", "Grabar un demo de SourceTV por partida (requiere tv_enable 1 al cargar el mapa).", _, true, 0.0, true, 1.0);
	g_cvDemoKeep     = CreateConVar("csstv_demo_keep", "50", "Demos que se conservan en csstv_demos/ (0 = todos).", _, true, 0.0, true, 10000.0);

	RegConsoleCmd("sm_hp", Cmd_Hp, "Muestra quién te mató en esta ronda y cuánta vida le queda.");
	RegConsoleCmd("sm_pause", Cmd_Pause, "Pide una pausa táctica para tu equipo.");
	RegConsoleCmd("sm_unpause", Cmd_Unpause, "Seguir después de una pausa (o cancelar la que pediste).");
	RegAdminCmd("sm_forcepause", Cmd_ForcePause, ADMFLAG_GENERIC, "Pausa de admin: dura hasta sm_forceunpause o !unpause de los dos equipos.");
	RegAdminCmd("sm_forceunpause", Cmd_ForceUnpause, ADMFLAG_GENERIC, "Termina la pausa ahora.");
#if defined CSSTV_DEBUG
	RegServerCmd("csstv_debug_fakecmd", Cmd_DebugFake);
#endif
}

/**
 * Destinatarios de los mensajes personales. Con CSSTV_DEBUG (solo para pruebas)
 * también los bots, y cada mensaje se copia al log del servidor.
 */
bool QolTarget(int client)
{
#if defined CSSTV_DEBUG
	return IsClientInGame(client);
#else
	return IsClientInGame(client) && !IsFakeClient(client);
#endif
}

void QolChat(int client, const char[] fmt, any ...)
{
	char buf[256];
	SetGlobalTransTarget(client);
	VFormat(buf, sizeof(buf), fmt, 3);
	PrintToChat(client, "%s", buf);
#if defined CSSTV_DEBUG
	LogMessage("[chat %N] %s", client, buf);
#endif
}

void QolReply(int client, const char[] fmt, any ...)
{
	char buf[256];
	SetGlobalTransTarget(client);
	VFormat(buf, sizeof(buf), fmt, 3);
	ReplyToCommand(client, "%s", buf);
#if defined CSSTV_DEBUG
	LogMessage("[respuesta a %N] %s", client, buf);
#endif
}

void QolChatAll(const char[] fmt, any ...)
{
	char buf[256];
	SetGlobalTransTarget(LANG_SERVER);
	VFormat(buf, sizeof(buf), fmt, 2);
	PrintToChatAll("%s", buf);
#if defined CSSTV_DEBUG
	LogMessage("[chat todos] %s", buf);
#endif
}

#if defined CSSTV_DEBUG
// csstv_debug_fakecmd <userid> <comando>: ejecuta un comando como si lo escribiera ese jugador (bots incluidos).
public Action Cmd_DebugFake(int args)
{
	char uid[16], cmd[128];
	GetCmdArg(1, uid, sizeof(uid));
	GetCmdArgString(cmd, sizeof(cmd));
	strcopy(cmd, sizeof(cmd), cmd[strlen(uid) + 1]);
	int client = GetClientOfUserId(StringToInt(uid));
	if (client > 0)
		FakeClientCommandEx(client, "%s", cmd);
	return Plugin_Handled;
}
#endif

void Qol_Reset()
{
	Pause_Clear();
	g_iPausesUsed[0] = 0;
	g_iPausesUsed[1] = 0;
	for (int i = 0; i <= MaxClients; i++)
		g_iKillerUserId[i] = 0;
}

// ---------------------------------------------------------------------------
// Marcador
// ---------------------------------------------------------------------------

/**
 * El juego vuelve a escribir su propio contador de victorias en el scoreboard al
 * reiniciar y al terminar cada ronda. Se reaplica el marcador del plugin después.
 */
void Qol_ScheduleScoreSync()
{
	if (g_State != State_Warmup)
		CreateTimer(0.2, Timer_ScoreSync, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_ScoreSync(Handle timer)
{
	if (g_State != State_Warmup)
		ApplyTeamScores();
#if defined CSSTV_DEBUG
	LogMessage("[marcador] CT %d - %d T (A %d - %d B, A juega de %s)", GetTeamScore(TEAM_CT), GetTeamScore(TEAM_T),
		g_iTotA, g_iTotB, g_iSideA == TEAM_CT ? "CT" : "T");
#endif
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Inicio de ronda en vivo
// ---------------------------------------------------------------------------

void Qol_OnLiveRoundStart()
{
	for (int i = 0; i <= MaxClients; i++)
		g_iKillerUserId[i] = 0;
	if (g_bPauseRequested)
		CreateTimer(0.1, Timer_StartRequestedPause, _, TIMER_FLAG_NO_MAPCHANGE);
	// La plata del inicio de ronda ya está acreditada medio segundo después.
	CreateTimer(0.5, Timer_RoundInfo, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_RoundInfo(Handle timer)
{
	if (g_State != State_Live)
		return Plugin_Stop;
	if (g_cvRoundHeader.BoolValue)
		Qol_RoundHeader();
	if (g_cvDamageReport.BoolValue && g_iPrevRound > 0)
	{
		for (int i = 1; i <= MaxClients; i++)
			if (QolTarget(i) && IsTeamSide(GetClientTeam(i)))
				Qol_DamageReport(i);
	}
	if (g_cvTeamMoney.BoolValue)
	{
		Qol_TeamMoney(TEAM_T);
		Qol_TeamMoney(TEAM_CT);
	}
	return Plugin_Stop;
}

bool IsTeamSide(int team)
{
	return team == TEAM_T || team == TEAM_CT;
}

void Qol_RoundHeader()
{
	char sideA[4], sideB[4];
	strcopy(sideA, sizeof(sideA), g_iSideA == TEAM_CT ? "CT" : "T");
	strcopy(sideB, sizeof(sideB), g_iSideA == TEAM_CT ? "T" : "CT");
	if (g_iSegment == 0)
		QolChatAll("%s Ronda %d/%d · Equipo A (%s) %d - %d Equipo B (%s)", PREFIX,
			g_iSegRound + 1, g_iSegLen, sideA, g_iTotA, g_iTotB, sideB);
	else
		QolChatAll("%s Prórroga %d · ronda %d/%d · Equipo A (%s) %d - %d Equipo B (%s)", PREFIX,
			g_iSegment, g_iSegRound + 1, g_iSegLen, sideA, g_iTotA, g_iTotB, sideB);

	int half = g_iSegLen / 2;
	if (g_iSegA == half)
		QolChatAll("%s \x04Match point para el Equipo A.", PREFIX);
	else if (g_iSegB == half)
		QolChatAll("%s \x04Match point para el Equipo B.", PREFIX);
	if (g_iSegRound + 1 == half)
		QolChatAll("%s Última ronda antes del cambio de lado.", PREFIX);
}

void Qol_DamageReport(int client)
{
	int lines;
	for (int j = 1; j <= MaxClients; j++)
	{
		if (j == client || !IsClientInGame(j))
			continue;
		int given = g_iPrevDmg[client][j], taken = g_iPrevDmg[j][client];
		if (given <= 0 && taken <= 0)
			continue;
		if (!lines)
			QolChat(client, "%s Daño ronda %d:", PREFIX, g_iPrevRound);
		char g[24], t[24];
		DmgText(given, g_iPrevHits[client][j], g, sizeof(g));
		DmgText(taken, g_iPrevHits[j][client], t, sizeof(t));
		QolChat(client, "%s » %N: diste %s · recibiste %s", PREFIX, j, g, t);
		lines++;
	}
	if (!lines)
		QolChat(client, "%s Daño ronda %d: sin daño.", PREFIX, g_iPrevRound);
}

void DmgText(int dmg, int hits, char[] out, int len)
{
	if (dmg <= 0)
		strcopy(out, len, "0");
	else
		Format(out, len, "%d (%d)", dmg, hits);
}

void Qol_TeamMoney(int team)
{
	int clients[MAXPLAYERS], money[MAXPLAYERS], n, total;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || GetClientTeam(i) != team)
			continue;
		clients[n] = i;
		money[n] = GetEntProp(i, Prop_Send, "m_iAccount");
		total += money[n];
		n++;
	}
	if (!n)
		return;
	// Orden de mayor a menor (son 5 o 6 jugadores: alcanza con inserción).
	for (int a = 1; a < n; a++)
	{
		int c = clients[a], m = money[a], b = a - 1;
		while (b >= 0 && money[b] < m)
		{
			clients[b + 1] = clients[b];
			money[b + 1] = money[b];
			b--;
		}
		clients[b + 1] = c;
		money[b + 1] = m;
	}

	char line[192], part[64], name[MAX_NAME_LENGTH], amount[16];
	FormatMoney(total, amount, sizeof(amount));
	Format(line, sizeof(line), "%s Plata del equipo: %s", PREFIX, amount);
	PrintToTeam(team, line);
	line[0] = '\0';
	for (int k = 0; k < n; k++)
	{
		GetClientName(clients[k], name, sizeof(name));
		TruncateUtf8(name, 14);
		FormatMoney(money[k], amount, sizeof(amount));
		Format(part, sizeof(part), "%s%s %s", line[0] ? " · " : "", name, amount);
		if (strlen(line) + strlen(part) > 150)
		{
			PrintTeamLine(team, line);
			Format(part, sizeof(part), "%s %s", name, amount);
			line[0] = '\0';
		}
		StrCat(line, sizeof(line), part);
	}
	if (line[0])
		PrintTeamLine(team, line);
}

void PrintTeamLine(int team, const char[] text)
{
	char line[192];
	Format(line, sizeof(line), "%s %s", PREFIX, text);
	PrintToTeam(team, line);
}

void PrintToTeam(int team, const char[] text)
{
	for (int i = 1; i <= MaxClients; i++)
		if (QolTarget(i) && GetClientTeam(i) == team)
			QolChat(i, "%s", text);
}

/** $21.350 */
void FormatMoney(int value, char[] out, int len)
{
	if (value >= 1000)
		Format(out, len, "$%d.%03d", value / 1000, value % 1000);
	else
		Format(out, len, "$%d", value);
}

/** Corta a 'max' bytes sin partir un carácter UTF-8. */
void TruncateUtf8(char[] s, int max)
{
	if (strlen(s) <= max)
		return;
	int cut = max;
	while (cut > 0 && (s[cut] & 0xC0) == 0x80)
		cut--;
	s[cut] = '\0';
}

// ---------------------------------------------------------------------------
// !hp
// ---------------------------------------------------------------------------

void Qol_OnDeath(int victim, int attacker, const char[] weapon)
{
	if (!g_cvHpOnDeath.BoolValue || !QolTarget(victim))
		return;
	if (attacker <= 0 || attacker == victim || !IsClientInGame(attacker) || GetClientTeam(attacker) == GetClientTeam(victim))
		return;
	g_iKillerUserId[victim] = GetClientUserId(attacker);
	strcopy(g_sKillerWeapon[victim], sizeof(g_sKillerWeapon[]), weapon);
	Qol_PrintKiller(victim);
}

void Qol_PrintKiller(int victim)
{
	int killer = GetClientOfUserId(g_iKillerUserId[victim]);
	if (killer <= 0 || !IsClientInGame(killer))
	{
		QolChat(victim, "%s Quien te mató ya no está en el servidor.", PREFIX);
		return;
	}
	if (!IsPlayerAlive(killer))
	{
		QolChat(victim, "%s Te mató %N (%s) · también está muerto.", PREFIX, killer, g_sKillerWeapon[victim]);
		return;
	}
	QolChat(victim, "%s Te mató %N (%s) · le quedan %d HP y %d de chaleco.", PREFIX,
		killer, g_sKillerWeapon[victim], GetClientHealth(killer), GetClientArmor(killer));
}

public Action Cmd_Hp(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (!g_cvHpOnDeath.BoolValue || g_State != State_Live)
		QolReply(client, "[CSSTV] !hp solo funciona durante la partida.");
	else if (!g_iKillerUserId[client])
		QolReply(client, "[CSSTV] En esta ronda no te mató ningún rival.");
	else
		Qol_PrintKiller(client);
	return Plugin_Handled;
}

// ---------------------------------------------------------------------------
// Pausa táctica (alargando el freezetime con m_fRoundStartTime)
// ---------------------------------------------------------------------------

int TeamIndexOf(int client)
{
	return GetClientTeam(client) == g_iSideA ? 0 : 1;
}

bool InFreezeTime()
{
	return GameRules_GetProp("m_bFreezePeriod") != 0;
}

bool CanPauseNow(int client)
{
	if (g_State != State_Live || g_bRestarting)
	{
		QolReply(client, "[CSSTV] Solo se puede pausar durante la partida.");
		return false;
	}
	if (g_bPaused || g_bPauseRequested)
	{
		QolReply(client, "[CSSTV] Ya hay una pausa %s.", g_bPaused ? "en curso" : "pedida para la próxima ronda");
		return false;
	}
	return true;
}

public Action Cmd_Pause(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (g_cvPauseMode.IntValue == PAUSE_OFF)
	{
		QolReply(client, "[CSSTV] Las pausas están desactivadas en este servidor.");
		return Plugin_Handled;
	}
	if (!IsTeamSide(GetClientTeam(client)))
	{
		QolReply(client, "[CSSTV] Solo los jugadores de un equipo pueden pausar.");
		return Plugin_Handled;
	}
	if (!CanPauseNow(client))
		return Plugin_Handled;
	int t = TeamIndexOf(client), max = g_cvPauseMax.IntValue;
	if (g_iPausesUsed[t] >= max)
	{
		QolReply(client, "[CSSTV] Tu equipo ya usó %s.", max == 1 ? "su pausa" : "todas sus pausas");
		return Plugin_Handled;
	}
	g_iPauseBy = t;
	if (InFreezeTime())
	{
		Pause_Start();
	}
	else
	{
		g_bPauseRequested = true;
		QolChatAll("%s %N pidió una pausa para el Equipo %s. Empieza al inicio de la próxima ronda (!unpause para cancelarla).",
			PREFIX, client, t == 0 ? "A" : "B");
	}
	return Plugin_Handled;
}

public Action Cmd_ForcePause(int client, int args)
{
	if (!CanPauseNow(client))
		return Plugin_Handled;
	g_iPauseBy = PAUSE_BY_ADMIN;
	if (InFreezeTime())
		Pause_Start();
	else
	{
		g_bPauseRequested = true;
		QolChatAll("%s Un admin pidió una pausa. Empieza al inicio de la próxima ronda.", PREFIX);
	}
	return Plugin_Handled;
}

public Action Timer_StartRequestedPause(Handle timer)
{
	if (g_bPauseRequested && !g_bPaused && g_State == State_Live && InFreezeTime())
		Pause_Start();
	return Plugin_Stop;
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
	{
		QolChatAll("%s Pausa del admin. Sigue con !forceunpause o cuando los dos equipos escriban !unpause.", PREFIX);
	}
	else
	{
		g_iPausesUsed[g_iPauseBy]++;
		char who[16];
		Format(who, sizeof(who), "Equipo %s", g_iPauseBy == 0 ? "A" : "B");
		QolChatAll("%s Pausa táctica del %s (%d de %d).", PREFIX, who, g_iPausesUsed[g_iPauseBy], g_cvPauseMax.IntValue);
		if (mode == PAUSE_TIMED)
			QolChatAll("%s Dura %d segundos.", PREFIX, RoundToFloor(secs));
		else if (mode == PAUSE_UNTIL)
			QolChatAll("%s Sigue cuando los dos equipos escriban !unpause.", PREFIX);
		else
			QolChatAll("%s Dura %d segundos, o menos si los dos equipos escriben !unpause.", PREFIX, RoundToFloor(secs));
	}
	delete g_hPauseTimer;
	g_hPauseTimer = CreateTimer(1.0, Timer_PauseTick, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_PauseTick(Handle timer)
{
	if (!g_bPaused || g_State != State_Live)
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
			QolChatAll("%s La pausa termina en %d s.", PREFIX, left);
	}
	else
	{
		// Pausa sin tiempo: se mantiene el freezetime lejos y se recuerda cómo seguir.
		if (left < 60)
		{
			g_fPauseEnds = GetGameTime() + PAUSE_HOLD;
			GameRules_SetPropFloat("m_fRoundStartTime", g_fPauseEnds);
		}
		if (++g_iPauseTicks % 30 == 0)
			PrintUnpauseStatus();
	}
	return Plugin_Continue;
}

void PrintUnpauseStatus()
{
	QolChatAll("%s En pausa. Para seguir: !unpause (Equipo A %s · Equipo B %s).", PREFIX,
		g_bUnpauseReady[0] ? "listo" : "falta", g_bUnpauseReady[1] ? "listo" : "falta");
}

public Action Cmd_Unpause(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client) || !IsTeamSide(GetClientTeam(client)))
		return Plugin_Handled;
	int t = TeamIndexOf(client);
	if (g_bPauseRequested)
	{
		if (g_iPauseBy != t)
		{
			QolReply(client, "[CSSTV] Solo el equipo que pidió la pausa puede cancelarla.");
			return Plugin_Handled;
		}
		g_bPauseRequested = false;
		QolChatAll("%s %N canceló la pausa pedida.", PREFIX, client);
		return Plugin_Handled;
	}
	if (!g_bPaused)
	{
		QolReply(client, "[CSSTV] No hay ninguna pausa.");
		return Plugin_Handled;
	}
	if (g_bPauseTimed && g_cvPauseMode.IntValue == PAUSE_TIMED)
	{
		QolReply(client, "[CSSTV] Esta pausa termina sola en %d s.", RoundToCeil(g_fPauseEnds - GetGameTime()));
		return Plugin_Handled;
	}
	if (!g_bUnpauseReady[t])
	{
		g_bUnpauseReady[t] = true;
		QolChatAll("%s %N: el Equipo %s está listo para seguir.", PREFIX, client, t == 0 ? "A" : "B");
	}
	if (g_bUnpauseReady[0] && g_bUnpauseReady[1])
		Pause_End("Los dos equipos están listos.");
	else
		PrintUnpauseStatus();
	return Plugin_Handled;
}

public Action Cmd_ForceUnpause(int client, int args)
{
	if (g_bPauseRequested)
	{
		g_bPauseRequested = false;
		QolChatAll("%s Un admin canceló la pausa pedida.", PREFIX);
	}
	else if (g_bPaused)
		Pause_End("Un admin terminó la pausa.");
	else
		QolReply(client, "[CSSTV] No hay ninguna pausa.");
	return Plugin_Handled;
}

void Pause_End(const char[] reason)
{
	g_bPaused = false;
	delete g_hPauseTimer;
	if (g_State == State_Live && InFreezeTime())
		GameRules_SetPropFloat("m_fRoundStartTime", GetGameTime() + 3.0);
	QolChatAll("%s %s Se sigue en 3 segundos.", PREFIX, reason);
}

/** Sin mensajes: al cancelar, terminar la partida o cambiar de mapa. */
void Pause_Clear()
{
	g_bPauseRequested = false;
	g_bPaused = false;
	delete g_hPauseTimer;
}

// ---------------------------------------------------------------------------
// Demo
// ---------------------------------------------------------------------------

void Demo_Start()
{
	if (!g_cvDemo.BoolValue || g_bRecording)
		return;
	ConVar tv = FindConVar("tv_enable");
	if (tv == null || !tv.BoolValue)
	{
		LogMessage("Demo no grabado: tv_enable está en 0 (hay que activarlo antes de cargar el mapa).");
		return;
	}
	if (!DirExists(DEMO_DIR))
		CreateDirectory(DEMO_DIR, 511);
	ServerCommand("tv_record \"%s/%s\"", DEMO_DIR, g_sMatchUid);
	g_bRecording = true;
	LogMessage("Grabando demo %s/%s.dem", DEMO_DIR, g_sMatchUid);
}

void Demo_Stop()
{
	if (!g_bRecording)
		return;
	ServerCommand("tv_stoprecord");
	g_bRecording = false;
	CreateTimer(3.0, Timer_DemoCleanup);
}

public Action Timer_DemoCleanup(Handle timer)
{
	Demo_Cleanup();
	return Plugin_Stop;
}

/** Deja solo los últimos csstv_demo_keep demos. */
void Demo_Cleanup()
{
	int keep = g_cvDemoKeep.IntValue;
	if (keep <= 0)
		return;
	DirectoryListing dir = OpenDirectory(DEMO_DIR);
	if (dir == null)
		return;
	ArrayList names = new ArrayList(ByteCountToCells(PLATFORM_MAX_PATH));
	ArrayList times = new ArrayList();
	char file[PLATFORM_MAX_PATH], path[PLATFORM_MAX_PATH];
	FileType type;
	while (dir.GetNext(file, sizeof(file), type))
	{
		int len = strlen(file);
		if (type != FileType_File || len < 5 || !StrEqual(file[len - 4], ".dem", false))
			continue;
		Format(path, sizeof(path), "%s/%s", DEMO_DIR, file);
		names.PushString(path);
		times.Push(GetFileTime(path, FileTime_LastChange));
	}
	delete dir;
	while (names.Length > keep)
	{
		int oldest;
		for (int i = 1; i < times.Length; i++)
			if (times.Get(i) < times.Get(oldest))
				oldest = i;
		names.GetString(oldest, path, sizeof(path));
		if (DeleteFile(path))
			LogMessage("Demo viejo borrado: %s", path);
		names.Erase(oldest);
		times.Erase(oldest);
	}
	delete names;
	delete times;
}
