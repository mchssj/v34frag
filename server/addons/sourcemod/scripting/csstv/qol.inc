/**
 * Mejoras de calidad de vida durante el mix:
 * marcador estable (rondas de cada equipo y kills/muertes de cada jugador),
 * encabezado de ronda, reporte de daño, plata del equipo, !hp, pausa táctica,
 * demo automática, equipos bloqueados durante la partida, reconexión al mismo
 * equipo, contador de vivos, TAB sin los puntos de la bomba y mensaje de créditos.
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
ConVar g_cvChatColors;
ConVar g_cvChatTag;
ConVar g_cvLockTeams;
ConVar g_cvAliveHud;
ConVar g_cvBombFrags;
ConVar g_cvCreditsInterval;

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

// Contador de vivos y créditos
Handle g_hAliveSync;
Handle g_hCreditsTimer;

// Kills y muertes del scoreboard (por registro de jugador, es decir por SteamID)
int g_iBoardFrags[MAX_REC];
int g_iBoardDeaths[MAX_REC];
bool g_bBoardSaved[MAX_REC];
bool g_bBoardPending[MAXPLAYERS + 1];   // se reconectó: restaurar al reaparecer

// Equipo de cada jugador en la partida (por registro, es decir por SteamID): 0 = ninguno, 1 = A, 2 = B
int g_iRecTeam[MAX_REC];

void Qol_Init()
{
	g_cvRoundHeader  = CreateConVar("csstv_round_header", "1", "Encabezado al empezar cada ronda y avisos de último round y match point.", _, true, 0.0, true, 1.0);
	g_cvDamageReport = CreateConVar("csstv_damage_report", "1", "Mostrar a cada jugador el daño de la ronda anterior.", _, true, 0.0, true, 1.0);
	g_cvTeamMoney    = CreateConVar("csstv_team_money", "1", "Mostrar a cada equipo su plata al empezar la ronda.", _, true, 0.0, true, 1.0);
	g_cvHpOnDeath    = CreateConVar("csstv_hp_on_death", "1", "Al morir, mostrar quién te mató y cuánta vida le quedó (y el comando !hp).", _, true, 0.0, true, 1.0);
	g_cvPauseMode    = CreateConVar("csstv_pause_mode", "3", "Pausas: 0 desactivadas, 1 con tiempo, 2 hasta !unpause de los dos equipos, 3 con tiempo o !unpause.", _, true, 0.0, true, 3.0);
	g_cvPauseMax     = CreateConVar("csstv_pause_max", "2", "Pausas por equipo y por partida.", _, true, 0.0, true, 20.0);
	g_cvPauseTime    = CreateConVar("csstv_pause_time", "60", "Segundos de cada pausa (modos 1 y 3).", _, true, 5.0, true, 600.0);
	g_cvDemo         = CreateConVar("csstv_demo", "1", "Grabar un demo de SourceTV por partida (requiere tv_enable 1 al cargar el mapa).", _, true, 0.0, true, 1.0);
	g_cvDemoKeep     = CreateConVar("csstv_demo_keep", "50", "Demos que se conservan en csstv_demos/ (0 = todos).", _, true, 0.0, true, 10000.0);
	g_cvChatColors   = CreateConVar("csstv_chat_colors", "1", "Colores del chat: 0 solo básicos, 1 RGB para quien usa ClientMod (detectado con su API), 2 siempre RGB.", _, true, 0.0, true, 2.0);
	g_cvChatTag      = CreateConVar("csstv_chat_tag", "CMLeague", "Texto del prefijo de los mensajes: [CMLeague].");
	g_cvChatTag.AddChangeHook(OnChatTagChanged);
	g_cvLockTeams    = CreateConVar("csstv_lock_teams", "1", "Durante la partida: no se puede cambiar de equipo, y elegir modelo estando vivo no mata al jugador.", _, true, 0.0, true, 1.0);
	g_cvAliveHud     = CreateConVar("csstv_alive_hud", "1", "Contador de vivos (CT 5 vs 4 T) fijo durante la partida: 0 no, 1 arriba al centro (HudMsg), 2 en el centro de la pantalla.", _, true, 0.0, true, 2.0);
	g_cvBombFrags    = CreateConVar("csstv_bomb_frags", "3", "Puntos que el juego suma en el TAB al desactivar o hacer explotar la bomba y que el plugin descuenta (0 = no tocar).", _, true, 0.0, true, 10.0);
	g_cvCreditsInterval = CreateConVar("csstv_credits_interval", "720", "Segundos entre los mensajes de créditos del plugin (0 = nunca).", _, true, 0.0, true, 7200.0);
	g_cvCreditsInterval.AddChangeHook(OnCreditsIntervalChanged);
	g_hAliveSync = CreateHudSynchronizer();
	CreateTimer(1.0, Timer_AliveShow, _, TIMER_REPEAT);
	Credits_Schedule();

	AddCommandListener(Cmd_JoinTeam, "jointeam");
	AddCommandListener(Cmd_JoinTeam, "chooseteam");
	AddCommandListener(Cmd_JoinClass, "joinclass");
	RegAdminCmd("sm_team", Cmd_Team, ADMFLAG_GENERIC, "Cambia de equipo: sm_team <jugador|@all|@ct|@t|@spec> <ct|t|spec>. Si está vivo muere y aparece en la próxima ronda.");
	LoadTranslations("common.phrases");   // ProcessTargetString

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

public void OnChatTagChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	strcopy(g_sTag, sizeof(g_sTag), newValue[0] ? newValue : "CMLeague");
	Format(g_sPrefix, sizeof(g_sPrefix), "\x04[%s]\x01", g_sTag);
}

/*
 * Colores del chat. Los mensajes llevan etiquetas ({#verde}, {#rojo}…) que se
 * convierten al enviar:
 *  - ClientMod acepta colores RGB (\x07RRGGBB) en mensajes SayText2;
 *  - el cliente original de v34 no: ahí {#verde} pasa a ser el verde básico
 *    (\x04) y las demás etiquetas, el color normal.
 * Quién usa ClientMod lo dice la API de ClientMod (clientmod.smx), si está cargada.
 */
native int CM_GetClientModAuth(int client);   // clientmod.inc: 2 = ClientMod, 3 = ClientMod desactualizado

static const char g_sColorTag[][] = { "{#normal}", "{#verde}", "{#rojo}", "{#amarillo}", "{#ct}", "{#t}" };
static const char g_sColorRgb[][] = { "\x01", "\x073EFF3E", "\x07FF4040", "\x07FFD700", "\x0799CCFF", "\x07EAB93D" };
static const char g_sColorBasic[][] = { "\x01", "\x04", "\x01", "\x01", "\x01", "\x01" };

bool ChatUsesRgb(int client)
{
	int mode = g_cvChatColors.IntValue;
	if (mode == 0)
		return false;
	if (mode == 2)
		return true;
	if (GetFeatureStatus(FeatureType_Native, "CM_GetClientModAuth") != FeatureStatus_Available)
		return false;
	return CM_GetClientModAuth(client) >= 2;
}

/** Reemplaza las etiquetas de color (rgb = colores de ClientMod; si no, básicos; strip = sin color). */
void ApplyColorTags(char[] text, int len, bool rgb, bool strip = false)
{
	for (int i = 0; i < sizeof(g_sColorTag); i++)
		ReplaceString(text, len, g_sColorTag[i], strip ? "" : (rgb ? g_sColorRgb[i] : g_sColorBasic[i]), false);
}

/** Envía un mensaje con etiquetas de color a un jugador, según su cliente. */
void ColorSend(int client, const char[] text)
{
	char buf[256];
	strcopy(buf, sizeof(buf), text);
#if defined CSSTV_DEBUG
	char plain[256];
	strcopy(plain, sizeof(plain), text);
	ApplyColorTags(plain, sizeof(plain), false, true);
	LogMessage("[chat %N%s] %s", client, ChatUsesRgb(client) ? ", RGB" : "", plain);
#endif
	if (IsFakeClient(client))
		return;
	if (!ChatUsesRgb(client))
	{
		ApplyColorTags(buf, sizeof(buf), false);
		PrintToChat(client, "%s", buf);
		return;
	}
	ApplyColorTags(buf, sizeof(buf), true);
	char msg[256];
	Format(msg, sizeof(msg), "\x01%s", buf);   // SayText2 necesita empezar con \x01 para mostrar colores
	Handle um = StartMessageOne("SayText2", client, USERMSG_RELIABLE | USERMSG_BLOCKHOOKS);
	if (um == null)
	{
		ApplyColorTags(buf, sizeof(buf), false);
		PrintToChat(client, "%s", buf);
		return;
	}
	BfWriteByte(um, client);   // autor
	BfWriteByte(um, true);     // mensaje de chat
	BfWriteString(um, msg);
	EndMessage();
}

void QolChat(int client, const char[] fmt, any ...)
{
	char buf[256];
	SetGlobalTransTarget(client);
	VFormat(buf, sizeof(buf), fmt, 3);
	ColorSend(client, buf);
}

void QolReply(int client, const char[] fmt, any ...)
{
	char buf[256];
	SetGlobalTransTarget(client);
	VFormat(buf, sizeof(buf), fmt, 3);
	ApplyColorTags(buf, sizeof(buf), false, true);
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
#if defined CSSTV_DEBUG
	char plain[256];
	strcopy(plain, sizeof(plain), buf);
	ApplyColorTags(plain, sizeof(plain), false, true);
	LogMessage("[chat todos] %s", plain);
#endif
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && !IsFakeClient(i))
			ColorSend(i, buf);
	ApplyColorTags(buf, sizeof(buf), false, true);
	PrintToServer("%s", buf);
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
	Board_Reset();
	for (int r = 0; r < MAX_REC; r++)
		g_iRecTeam[r] = 0;
	g_bDemoRecorded = false;
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

/*
 * Kills y muertes de cada jugador en el scoreboard. mp_restartgame (medio tiempo y
 * prórroga) las pone en 0, y quien se reconecta también empieza en 0. Se guardan
 * los valores del scoreboard (no los del plugin, que no restan teamkills) al
 * terminar cada ronda, antes de cada reinicio y al desconectarse, y se devuelven
 * después del reinicio o cuando el que se reconectó reaparece.
 */

bool MatchRunning()
{
	return g_State == State_Live || g_State == State_Halftime;
}

void Board_Reset()
{
	for (int r = 0; r < MAX_REC; r++)
		g_bBoardSaved[r] = false;
	for (int i = 0; i <= MaxClients; i++)
		g_bBoardPending[i] = false;
}

void Board_SaveClient(int client)
{
	// Quien se reconectó y todavía no reapareció tiene 0: no pisar lo guardado.
	if (!MatchRunning() || g_bBoardPending[client] || !IsClientInGame(client) || !IsTeamSide(GetClientTeam(client)))
		return;
	int rec = Stats_GetRec(client);
	if (rec < 0)
		return;
	g_iBoardFrags[rec] = GetClientFrags(client);
	g_iBoardDeaths[rec] = GetClientDeaths(client);
	g_bBoardSaved[rec] = true;
}

void Board_SaveAll()
{
	for (int i = 1; i <= MaxClients; i++)
		Board_SaveClient(i);
}

void Board_Restore(int client)
{
	g_bBoardPending[client] = false;
	int rec = Stats_GetRec(client);
	if (rec < 0 || !g_bBoardSaved[rec])
		return;
	SetEntProp(client, Prop_Data, "m_iFrags", g_iBoardFrags[rec]);
	SetEntProp(client, Prop_Data, "m_iDeaths", g_iBoardDeaths[rec]);
#if defined CSSTV_DEBUG
	LogMessage("[scoreboard] %N: %d kills / %d muertes restaurados", client, g_iBoardFrags[rec], g_iBoardDeaths[rec]);
#endif
}

/** Al entrar al servidor con la partida en curso. */
void Board_OnClientPut(int client)
{
	g_bBoardPending[client] = MatchRunning();
}

/** Al reaparecer: si se había reconectado, recupera sus kills y muertes. */
void Board_OnSpawn(int client)
{
	if (g_bBoardPending[client] && MatchRunning())
		Board_Restore(client);
}

/** Después del reinicio del medio tiempo o de la prórroga. */
void Board_ScheduleRestoreAll()
{
	CreateTimer(0.3, Timer_BoardRestoreAll, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_BoardRestoreAll(Handle timer)
{
	if (!MatchRunning())
		return Plugin_Stop;
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && IsTeamSide(GetClientTeam(i)))
			Board_Restore(i);
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
	Rr_Snapshot();
	return Plugin_Stop;
}

bool IsTeamSide(int team)
{
	return team == TEAM_T || team == TEAM_CT;
}

void Qol_RoundHeader()
{
	// Lado de cada equipo, con el color del lado: CT celeste, T dorado.
	char sideA[24], sideB[24];
	strcopy(sideA, sizeof(sideA), g_iSideA == TEAM_CT ? "{#ct}CT{#normal}" : "{#t}T{#normal}");
	strcopy(sideB, sizeof(sideB), g_iSideA == TEAM_CT ? "{#t}T{#normal}" : "{#ct}CT{#normal}");
	if (g_iSegment == 0)
		QolChatAll("%s Ronda {#amarillo}%d/%d{#normal} · %s (%s) {#amarillo}%d - %d{#normal} %s (%s)", PREFIX,
			g_iSegRound + 1, g_iSegLen, g_sTeam[0], sideA, g_iTotA, g_iTotB, g_sTeam[1], sideB);
	else
		QolChatAll("%s Prórroga %d · ronda {#amarillo}%d/%d{#normal} · %s (%s) {#amarillo}%d - %d{#normal} %s (%s)", PREFIX,
			g_iSegment, g_iSegRound + 1, g_iSegLen, g_sTeam[0], sideA, g_iTotA, g_iTotB, g_sTeam[1], sideB);

	int half = g_iSegLen / 2;
	if (g_iSegA == half)
		QolChatAll("%s {#amarillo}Match point para el %s.", PREFIX, g_sTeam[0]);
	else if (g_iSegB == half)
		QolChatAll("%s {#amarillo}Match point para el %s.", PREFIX, g_sTeam[1]);
	if (g_iSegRound + 1 == half)
		QolChatAll("%s {#amarillo}Última ronda antes del cambio de lado.", PREFIX);
}

/**
 * Daño de la ronda anterior, con el formato de la consola del juego:
 *   [CMLeague] Damage Given to "Rival" - 54 in 2 hits      (verde)
 *   [CMLeague] Damage Taken from "Rival" - 27 in 1 hit     (rojo)
 * Primero todo el daño dado y después el recibido; solo rivales con daño.
 */
void Qol_DamageReport(int client)
{
	for (int j = 1; j <= MaxClients; j++)
	{
		if (j == client || !IsClientInGame(j) || g_iPrevDmg[client][j] <= 0)
			continue;
		int hits = g_iPrevHits[client][j];
		QolChat(client, "%s {#verde}Damage Given{#normal} to \"%N\" - {#verde}%d{#normal} in %d %s", PREFIX,
			j, g_iPrevDmg[client][j], hits, hits == 1 ? "hit" : "hits");
	}
	for (int j = 1; j <= MaxClients; j++)
	{
		if (j == client || !IsClientInGame(j) || g_iPrevDmg[j][client] <= 0)
			continue;
		int hits = g_iPrevHits[j][client];
		QolChat(client, "%s {#rojo}Damage Taken{#normal} from \"%N\" - {#rojo}%d{#normal} in %d %s", PREFIX,
			j, g_iPrevDmg[j][client], hits, hits == 1 ? "hit" : "hits");
	}
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

	char line[256], part[96], name[MAX_NAME_LENGTH], amount[16];
	FormatMoney(total, amount, sizeof(amount));
	Format(line, sizeof(line), "%s Plata del equipo: {#verde}%s", PREFIX, amount);
	PrintToTeam(team, line);
	line[0] = '\0';
	for (int k = 0; k < n; k++)
	{
		GetClientName(clients[k], name, sizeof(name));
		TruncateUtf8(name, 14);
		FormatMoney(money[k], amount, sizeof(amount));
		Format(part, sizeof(part), "%s%s {#verde}%s{#normal}", line[0] ? " · " : "", name, amount);
		// Con las etiquetas contadas: al convertirlas a color el texto queda más corto.
		if (strlen(line) + strlen(part) > 190)
		{
			PrintTeamLine(team, line);
			Format(part, sizeof(part), "%s {#verde}%s{#normal}", name, amount);
			line[0] = '\0';
		}
		StrCat(line, sizeof(line), part);
	}
	if (line[0])
		PrintTeamLine(team, line);
}

void PrintTeamLine(int team, const char[] text)
{
	char line[256];
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
	// En player_death la víctima todavía puede figurar viva: se cuenta un instante después.
	CreateTimer(0.1, Timer_AliveShowOnce, _, TIMER_FLAG_NO_MAPCHANGE);
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
		QolChat(victim, "%s Te mató {#rojo}%N{#normal} (%s) · también está muerto.", PREFIX, killer, g_sKillerWeapon[victim]);
		return;
	}
	QolChat(victim, "%s Te mató {#rojo}%N{#normal} (%s) · le quedan {#amarillo}%d HP{#normal} y %d de chaleco.", PREFIX,
		killer, g_sKillerWeapon[victim], GetClientHealth(killer), GetClientArmor(killer));
}

public Action Cmd_Hp(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (!g_cvHpOnDeath.BoolValue || g_State != State_Live)
		QolReply(client, "[%s] !hp solo funciona durante la partida.", g_sTag);
	else if (!g_iKillerUserId[client])
		QolReply(client, "[%s] En esta ronda no te mató ningún rival.", g_sTag);
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
		QolReply(client, "[%s] Solo se puede pausar durante la partida.", g_sTag);
		return false;
	}
	if (g_bPaused || g_bPauseRequested)
	{
		QolReply(client, "[%s] Ya hay una pausa %s.", g_sTag, g_bPaused ? "en curso" : "pedida para la próxima ronda");
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
		QolReply(client, "[%s] Las pausas están desactivadas en este servidor.", g_sTag);
		return Plugin_Handled;
	}
	if (!IsTeamSide(GetClientTeam(client)))
	{
		QolReply(client, "[%s] Solo los jugadores de un equipo pueden pausar.", g_sTag);
		return Plugin_Handled;
	}
	if (!CanPauseNow(client))
		return Plugin_Handled;
	int t = TeamIndexOf(client), max = g_cvPauseMax.IntValue;
	if (g_iPausesUsed[t] >= max)
	{
		QolReply(client, "[%s] Tu equipo ya usó %s.", g_sTag, max == 1 ? "su pausa" : "todas sus pausas");
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
		QolChatAll("%s {#amarillo}%N pidió una pausa para el %s.{#normal} Empieza al inicio de la próxima ronda (!unpause para cancelarla).",
			PREFIX, client, g_sTeam[t]);
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
		QolChatAll("%s {#amarillo}Un admin pidió una pausa.{#normal} Empieza al inicio de la próxima ronda.", PREFIX);
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
		QolChatAll("%s {#amarillo}Pausa del admin.{#normal} Sigue con !forceunpause o cuando los dos equipos escriban !unpause.", PREFIX);
	}
	else
	{
		g_iPausesUsed[g_iPauseBy]++;
		QolChatAll("%s {#amarillo}Pausa táctica del %s (%d de %d).", PREFIX, g_sTeam[g_iPauseBy], g_iPausesUsed[g_iPauseBy], g_cvPauseMax.IntValue);
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
			QolChatAll("%s La pausa termina en {#amarillo}%d s{#normal}.", PREFIX, left);
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
	QolChatAll("%s En pausa. Para seguir: !unpause (%s %s · %s %s).", PREFIX,
		g_sTeam[0], g_bUnpauseReady[0] ? "listo" : "falta", g_sTeam[1], g_bUnpauseReady[1] ? "listo" : "falta");
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
			QolReply(client, "[%s] Solo el equipo que pidió la pausa puede cancelarla.", g_sTag);
			return Plugin_Handled;
		}
		g_bPauseRequested = false;
		QolChatAll("%s %N canceló la pausa pedida.", PREFIX, client);
		return Plugin_Handled;
	}
	if (!g_bPaused)
	{
		QolReply(client, "[%s] No hay ninguna pausa.", g_sTag);
		return Plugin_Handled;
	}
	if (g_bPauseTimed && g_cvPauseMode.IntValue == PAUSE_TIMED)
	{
		QolReply(client, "[%s] Esta pausa termina sola en %d s.", g_sTag, RoundToCeil(g_fPauseEnds - GetGameTime()));
		return Plugin_Handled;
	}
	if (!g_bUnpauseReady[t])
	{
		g_bUnpauseReady[t] = true;
		QolChatAll("%s %N: el %s está listo para seguir.", PREFIX, client, g_sTeam[t]);
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
		QolReply(client, "[%s] No hay ninguna pausa.", g_sTag);
	return Plugin_Handled;
}

void Pause_End(const char[] reason)
{
	g_bPaused = false;
	delete g_hPauseTimer;
	if (g_State == State_Live && InFreezeTime())
		GameRules_SetPropFloat("m_fRoundStartTime", GetGameTime() + 3.0);
	QolChatAll("%s {#verde}%s Se sigue en 3 segundos.", PREFIX, reason);
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
	g_bDemoRecorded = true;
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

/** Borra el demo de una partida descartada (cuando el motor ya lo cerró). */
void Demo_Discard(const char[] uid)
{
	DataPack pack = new DataPack();
	pack.WriteString(uid);
	CreateTimer(3.0, Timer_DemoDiscard, pack, TIMER_DATA_HNDL_CLOSE);
}

public Action Timer_DemoDiscard(Handle timer, DataPack pack)
{
	char uid[64], path[PLATFORM_MAX_PATH];
	pack.Reset();
	pack.ReadString(uid, sizeof(uid));
	Format(path, sizeof(path), "%s/%s.dem", DEMO_DIR, uid);
	if (FileExists(path) && DeleteFile(path))
		LogMessage("Demo descartado: %s", path);
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

// ---------------------------------------------------------------------------
// Equipos bloqueados durante la partida
// ---------------------------------------------------------------------------

/*
 * En el medio tiempo el juego les abre a los jugadores el menú de modelos aunque el plugin
 * ya les asignó uno y los hizo reaparecer. Si alguien elige tarde, el joinclass le llega
 * al motor con el jugador ya vivo y lo deja muerto. Durante la partida:
 *  - quien está en CT o T no puede cambiar de equipo (los admins sí pueden moverlo);
 *  - joinclass de un jugador vivo solo guarda el modelo para la próxima vez que aparezca.
 */

bool TeamsLocked()
{
	return g_cvLockTeams.BoolValue && MatchInProgress();
}

public Action Cmd_JoinTeam(int client, const char[] command, int argc)
{
	if (client <= 0 || !IsClientInGame(client) || !TeamsLocked())
		return Plugin_Continue;
	if (!IsTeamSide(GetClientTeam(client)))
		return Recon_Place(client) ? Plugin_Handled : Plugin_Continue;   // si se reconectó, va a su equipo
	QolChat(client, "%s Durante la partida no se puede cambiar de equipo. Un admin puede moverte con !team.", PREFIX);
	return Plugin_Handled;
}

public Action Cmd_JoinClass(int client, const char[] command, int argc)
{
	if (client <= 0 || !IsClientInGame(client) || !TeamsLocked())
		return Plugin_Continue;
	char arg[8];
	GetCmdArg(1, arg, sizeof(arg));
	int cls = StringToInt(arg), team = GetClientTeam(client);
	bool alive = IsPlayerAlive(client);
#if defined CSSTV_DEBUG
	LogMessage("[joinclass] %N clase %d · equipo %d · vivo %d · estado %d · freezetime %d", client, cls, team, alive,
		GetEntProp(client, Prop_Send, "m_iPlayerState"), InFreezeTime());
#endif
	if (!alive)
		return Plugin_Continue;
	// T 1-4, CT 5-8; 0 = al azar (se queda con el que tiene).
	if ((team == TEAM_T && cls >= 1 && cls <= 4) || (team == TEAM_CT && cls >= 5 && cls <= 8))
		SetEntProp(client, Prop_Send, "m_iClass", cls);
	return Plugin_Handled;
}

public Action Cmd_Team(int client, int args)
{
	if (args < 2)
	{
		QolReply(client, "[%s] Uso: sm_team <jugador|@all|@ct|@t|@spec> <ct|t|spec>. Ejemplos: !team daniloev ct · !team @all spec", g_sTag);
		return Plugin_Handled;
	}
	char pattern[MAX_NAME_LENGTH], side[8];
	GetCmdArg(1, pattern, sizeof(pattern));
	GetCmdArg(2, side, sizeof(side));
	int to;
	if (StrEqual(side, "ct", false))
		to = TEAM_CT;
	else if (StrEqual(side, "t", false))
		to = TEAM_T;
	else if (StrEqual(side, "spec", false))
		to = TEAM_SPEC;
	else
	{
		QolReply(client, "[%s] El equipo tiene que ser ct, t o spec.", g_sTag);
		return Plugin_Handled;
	}
	Team_Apply(client, pattern, to);
	return Plugin_Handled;
}

/**
 * !team y el menú de admin. pattern: nick (o parte), #userid o un grupo de SourceMod
 * (@all, @ct, @t, @spec, @alive, @dead, @humans, @bots). Un nick que coincide con varios
 * jugadores no mueve a nadie.
 */
void Team_Apply(int client, const char[] pattern, int to)
{
	if (!License_Allows())
	{
		License_Reply(client);
		return;
	}
	int targets[MAXPLAYERS];
	char targetName[MAX_TARGET_LENGTH];
	bool ml;
	int n = ProcessTargetString(pattern, client, targets, sizeof(targets), COMMAND_FILTER_NO_IMMUNITY, targetName, sizeof(targetName), ml);
	if (n <= 0)
	{
		ReplyToTargetError(client, n);
		return;
	}
	int moved, last;
	for (int k = 0; k < n; k++)
	{
		int target = targets[k];
		if (IsClientSourceTV(target) || GetClientTeam(target) == to)
			continue;   // el bot de SourceTV queda siempre de espectador
		// El cambio de equipo anota una muerte en el TAB: se guarda antes y se devuelve al reaparecer.
		Board_SaveClient(target);
		g_bBoardPending[target] = MatchRunning();
		if (to == TEAM_SPEC)
		{
			ChangeClientTeam(target, TEAM_SPEC);
			Recon_Forget(target);   // si se reconecta, no vuelve a un equipo
		}
		else
		{
			MoveToTeam(target, to);
			Recon_Remember(target);
		}
		moved++;
		last = target;
	}
	char where[16];
	strcopy(where, sizeof(where), to == TEAM_CT ? "CT" : (to == TEAM_T ? "T" : "espectador"));
	if (!moved)
		QolReply(client, "[%s] %s ya %s en %s.", g_sTag, n == 1 ? "Ese jugador" : "Todos", n == 1 ? "está" : "están", where);
	else if (moved == 1)
		QolChatAll("%s Un admin pasó a {#amarillo}%N{#normal} a %s.", PREFIX, last, where);
	else
		QolChatAll("%s Un admin pasó a {#amarillo}%d jugadores{#normal} a %s.", PREFIX, moved, where);
}

// ---------------------------------------------------------------------------
// Reconexión: quien se cae durante la partida vuelve a su equipo
// ---------------------------------------------------------------------------

/** Desde el LO3 (o la ronda de cuchillo) hasta el fin de la partida. */
bool MatchInProgress()
{
	return g_State == State_Starting || g_State == State_Live || g_State == State_Halftime || g_State == State_Knife;
}

/** Anota en qué equipo (A o B, no CT o T) juega el jugador. */
void Recon_Remember(int client)
{
	if (!MatchInProgress() || !IsClientInGame(client) || !IsTeamSide(GetClientTeam(client)))
		return;
	int rec = Stats_GetRec(client);
	if (rec >= 0)
		g_iRecTeam[rec] = GetClientTeam(client) == g_iSideA ? 1 : 2;
}

void Recon_RememberAll()
{
	for (int i = 1; i <= MaxClients; i++)
		Recon_Remember(i);
}

void Recon_Forget(int client)
{
	int rec = Stats_GetRec(client);
	if (rec >= 0)
		g_iRecTeam[rec] = 0;
}

/** Al entrar (ya con SteamID): si jugaba esta partida, se lo pone en su equipo. */
void Recon_OnJoin(int client)
{
#if !defined CSSTV_DEBUG
	if (IsFakeClient(client))
		return;
#endif
	if (!MatchInProgress() || !Recon_WantedSide(client))
		return;
	// Un instante después, cuando el cliente ya terminó de entrar.
	CreateTimer(1.0, Timer_ReconPlace, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_ReconPlace(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client > 0 && IsClientInGame(client) && MatchInProgress())
		Recon_Place(client);
	return Plugin_Stop;
}

/** Lado (CT o T) donde juega ahora el equipo del jugador; 0 si no jugaba esta partida. */
int Recon_WantedSide(int client)
{
	int rec = Stats_FindRec(client);
	if (rec < 0 || !g_iRecTeam[rec])
		return 0;
	return g_iRecTeam[rec] == 1 ? g_iSideA : OtherSide(g_iSideA);
}

/** Pone al jugador en el lado de su equipo. false si no jugaba esta partida o ya está ahí. */
bool Recon_Place(int client)
{
	int want = Recon_WantedSide(client);
	if (!want || GetClientTeam(client) == want)
		return false;
	MoveToTeam(client, want);
	QolChatAll("%s {#amarillo}%N{#normal} volvió y sigue en el %s.", PREFIX, client, g_sTeam[want == g_iSideA ? 0 : 1]);
	return true;
}

// ---------------------------------------------------------------------------
// Contador de vivos (CT 5 vs 4 T)
// ---------------------------------------------------------------------------

/** Cada segundo durante la partida (texto fijo) y al instante en cada muerte. */
public Action Timer_AliveShow(Handle timer)
{
	Alive_Show();
	return Plugin_Continue;
}

public Action Timer_AliveShowOnce(Handle timer)
{
	Alive_Show();
	return Plugin_Stop;
}

void Alive_Show()
{
	int mode = g_cvAliveHud.IntValue;
	if (mode == 0 || !MatchRunning() || g_bRestarting)
		return;
	int ct, t;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || !IsPlayerAlive(i))
			continue;
		int team = GetClientTeam(i);
		if (team == TEAM_CT)
			ct++;
		else if (team == TEAM_T)
			t++;
	}
	char text[32];
	Format(text, sizeof(text), "CT %d vs %d T", ct, t);
	// Se reenvía cada segundo y dura 1.5 s, sin fundidos: queda fijo y sin parpadeo.
	if (mode == 1)
		SetHudTextParams(-1.0, 0.02, 1.5, 255, 255, 255, 255, 0, 0.0, 0.0, 0.0);
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsFakeClient(i))
			continue;
		if (mode == 1)
			ShowSyncHudText(i, g_hAliveSync, "%s", text);
		else
			PrintCenterText(i, "%s", text);
	}
}

// ---------------------------------------------------------------------------
// Puntos de la bomba en el TAB
// ---------------------------------------------------------------------------

/*
 * El juego suma puntos (frags) en el TAB a quien desactiva la bomba y a quien la plantó si
 * explota. El TAB tiene que mostrar solo kills: se descuentan un instante después del evento,
 * cuando el juego ya los sumó. Las estadísticas del plugin no cuentan esos puntos.
 */
void Qol_OnBombScore(int client)
{
	if (g_cvBombFrags.IntValue <= 0 || client <= 0 || !IsClientInGame(client))
		return;
	DataPack pack = new DataPack();
	pack.WriteCell(GetClientUserId(client));
	pack.WriteCell(GetClientFrags(client));
	CreateTimer(0.1, Timer_BombFrags, pack, TIMER_FLAG_NO_MAPCHANGE | TIMER_DATA_HNDL_CLOSE);
}

public Action Timer_BombFrags(Handle timer, DataPack pack)
{
	pack.Reset();
	int client = GetClientOfUserId(pack.ReadCell());
#if defined CSSTV_DEBUG
	int before = pack.ReadCell();
#endif
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Stop;
	int frags = GetClientFrags(client);
	SetEntProp(client, Prop_Data, "m_iFrags", frags - g_cvBombFrags.IntValue);
	Board_SaveClient(client);   // el fin de ronda ya pudo guardar el TAB con los puntos
#if defined CSSTV_DEBUG
	LogMessage("[bomba] %N: TAB %d en el evento, %d después; queda en %d", client, before, frags, frags - g_cvBombFrags.IntValue);
#endif
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Créditos
// ---------------------------------------------------------------------------

public void OnCreditsIntervalChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	Credits_Schedule();
}

void Credits_Schedule()
{
	delete g_hCreditsTimer;
	float secs = g_cvCreditsInterval.FloatValue;
	if (secs > 0.0)
		g_hCreditsTimer = CreateTimer(secs, Timer_Credits, _, TIMER_REPEAT);
}

public Action Timer_Credits(Handle timer)
{
	QolChatAll("%s Plugin made by {#amarillo}kyan & daniloev", PREFIX);
	return Plugin_Continue;
}
