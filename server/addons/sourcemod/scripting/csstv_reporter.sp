/**
 * CSSTV Match Reporter
 *
 * Controla un mix en CS:S v34 (ready / live / medio tiempo / prórroga / fin),
 * junta las estadísticas de cada jugador y envía el resultado a Supabase.
 * También agrega mejoras de calidad de vida (csstv/qol.inc): marcador estable,
 * encabezado de ronda, daño y plata en el chat, !hp, pausa táctica y demo.
 *
 * El resultado se guarda primero en addons/sourcemod/data/csstv/queue/<uid>.json
 * y después se envía con la extensión System2 en partes de menos de 2 KB
 * (System2 no admite cuerpos más grandes). Si System2 no está disponible,
 * el archivo queda en la cola para que lo suba el script csstv_uploader.py.
 */

#pragma semicolon 1
#pragma newdecls required
#pragma dynamic 262144

#include <sourcemod>
#include <sdktools>
#undef REQUIRE_EXTENSIONS
#include <system2>
#define REQUIRE_EXTENSIONS

#define PLUGIN_VERSION "1.1.0"
#define PREFIX "\x04[CSSTV]\x01"

#define TEAM_SPEC 1
#define TEAM_T 2
#define TEAM_CT 3

public Plugin myinfo =
{
	name = "CSSTV Match Reporter",
	author = "CSSTV",
	description = "Controla mixes y envía resultados y estadísticas a CSSTV",
	version = PLUGIN_VERSION,
	url = ""
};

enum MatchState
{
	State_Warmup = 0,
	State_Starting,   // LO3 en curso
	State_Live,
	State_Halftime,   // medio tiempo o inicio de prórroga
	State_Finished
};

#define PURPOSE_LIVE   1
#define PURPOSE_RESUME 2

// Cvars
ConVar g_cvEnabled;
ConVar g_cvApiUrl;
ConVar g_cvApiKey;
ConVar g_cvToken;
ConVar g_cvServerTag;
ConVar g_cvMaxRounds;
ConVar g_cvOvertime;
ConVar g_cvOtMaxRounds;
ConVar g_cvOtStartMoney;
ConVar g_cvMinPlayers;
ConVar g_cvLo3;
ConVar g_cvReadySystem;
ConVar g_cvSend;
ConVar g_cvRetrySeconds;
ConVar g_cvAssistDamage;
ConVar g_cvIncludeBots;
ConVar g_cvValidateId;
ConVar g_cvHalftimeDelay;

// Estado de la partida
MatchState g_State = State_Warmup;
char g_sMatchUid[64];
int g_iStartedAt;
int g_iSideA = TEAM_CT;        // lado donde juega el equipo A
int g_iSegment;                // 0 = tiempo reglamentario, 1..n = prórroga n
int g_iSegLen;                 // rondas del segmento actual
int g_iSegRound;               // rondas jugadas en el segmento
int g_iSegA, g_iSegB;          // marcador del segmento
int g_iTotA, g_iTotB;          // marcador total
bool g_bRestarting;
int g_iRestartsLeft;
int g_iRestartPurpose;
int g_iSavedStartMoney = -1;
bool g_bReady[MAXPLAYERS + 1];
Handle g_hReadyTimer;

#include "csstv/stats.inc"
#include "csstv/json.inc"
#include "csstv/queue.inc"
#include "csstv/http.inc"
#include "csstv/qol.inc"

public void OnPluginStart()
{
	g_cvEnabled       = CreateConVar("csstv_enabled", "1", "Activa el plugin.", _, true, 0.0, true, 1.0);
	g_cvApiUrl        = CreateConVar("csstv_api_url", "", "URL de la función ingest_server_chunk (…/rest/v1/rpc/ingest_server_chunk).", FCVAR_PROTECTED);
	g_cvApiKey        = CreateConVar("csstv_api_key", "", "Anon key pública de Supabase.", FCVAR_PROTECTED);
	g_cvToken         = CreateConVar("csstv_server_token", "", "Token secreto del servidor (se crea en Admin > Servidores).", FCVAR_PROTECTED | FCVAR_DONTRECORD);
	g_cvServerTag     = CreateConVar("csstv_server_tag", "srv1", "Identificador corto del servidor (letras, números y guiones).");
	g_cvMaxRounds     = CreateConVar("csstv_maxrounds", "30", "Rondas del tiempo reglamentario (30 = MR15).", _, true, 2.0, true, 60.0);
	g_cvOvertime      = CreateConVar("csstv_overtime", "1", "Jugar prórroga si hay empate.", _, true, 0.0, true, 1.0);
	g_cvOtMaxRounds   = CreateConVar("csstv_ot_maxrounds", "24", "Rondas de cada prórroga (24 = MR12, 6 = MR3).", _, true, 2.0, true, 60.0);
	g_cvOtStartMoney  = CreateConVar("csstv_ot_startmoney", "10000", "Dinero inicial en prórroga.", _, true, 0.0, true, 16000.0);
	g_cvMinPlayers    = CreateConVar("csstv_min_players", "8", "Jugadores mínimos en CT+T para empezar.", _, true, 2.0, true, 32.0);
	g_cvLo3           = CreateConVar("csstv_lo3", "1", "Hacer tres reinicios antes de empezar (LO3).", _, true, 0.0, true, 1.0);
	g_cvReadySystem   = CreateConVar("csstv_ready_system", "1", "Empezar solo cuando todos escriben !ready.", _, true, 0.0, true, 1.0);
	g_cvSend          = CreateConVar("csstv_send", "1", "Enviar con System2. Con 0 solo se guarda en la cola (para csstv_uploader.py).", _, true, 0.0, true, 1.0);
	g_cvRetrySeconds  = CreateConVar("csstv_retry_seconds", "60", "Primer reintento tras un error; se duplica hasta 15 minutos.", _, true, 10.0, true, 900.0);
	g_cvAssistDamage  = CreateConVar("csstv_assist_damage", "41", "Daño mínimo para contar una asistencia.", _, true, 1.0, true, 100.0);
	g_cvIncludeBots   = CreateConVar("csstv_include_bots", "0", "Contar bots (solo para pruebas).", _, true, 0.0, true, 1.0);
	g_cvValidateId    = CreateConVar("csstv_validate_steamid", "0", "Exigir SteamID validado por Steam (dejar en 0 en servidores no-Steam).", _, true, 0.0, true, 1.0);
	g_cvHalftimeDelay = CreateConVar("csstv_halftime_delay", "3.0", "Segundos tras la última ronda antes de cambiar de lados.", _, true, 1.0, true, 10.0);
	CreateConVar("csstv_reporter_version", PLUGIN_VERSION, "Versión de CSSTV Match Reporter.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	AutoExecConfig(true, "csstv_reporter");

	RegAdminCmd("sm_live", Cmd_Live, ADMFLAG_GENERIC, "Empieza la partida. Uso: sm_live [force]");
	RegAdminCmd("sm_cancelmatch", Cmd_Cancel, ADMFLAG_GENERIC, "Cancela la partida sin enviar el resultado.");
	RegAdminCmd("sm_csstv_status", Cmd_Status, ADMFLAG_RCON, "Estado del plugin y de la cola.");
	RegAdminCmd("sm_csstv_flush", Cmd_Flush, ADMFLAG_RCON, "Reintenta ahora los envíos pendientes.");
	RegAdminCmd("sm_csstv_retryfailed", Cmd_RetryFailed, ADMFLAG_RCON, "Devuelve a la cola los envíos rechazados.");
	RegConsoleCmd("sm_ready", Cmd_Ready, "Marcarse listo.");
	RegConsoleCmd("sm_unready", Cmd_Unready, "Quitar el listo.");
	RegConsoleCmd("sm_notready", Cmd_Unready, "Quitar el listo.");
	RegConsoleCmd("sm_score", Cmd_Score, "Muestra el marcador.");

	HookEventEx("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	HookEventEx("round_end", Event_RoundEnd);
	HookEventEx("player_spawn", Event_PlayerSpawn);
	HookEventEx("player_hurt", Event_PlayerHurt);
	HookEventEx("player_death", Event_PlayerDeath);
	HookEventEx("bomb_planted", Event_BombPlanted);
	HookEventEx("bomb_defused", Event_BombDefused);

	Stats_Init();
	Queue_Init();
	Qol_Init();
}

public void OnMapStart()
{
	ResetMatch();
	Queue_EnsureDirs();
}

public void OnConfigsExecuted()
{
	ExecIfExists("csstv/warmup.cfg");
	StartReadyTimer();
	Http_ScheduleProcess(5.0);
}

public void OnMapEnd()
{
	if (g_State == State_Starting || g_State == State_Live || g_State == State_Halftime)
	{
		LogMessage("Partida %s abortada por cambio de mapa (%d-%d). No se envía.", g_sMatchUid, g_iTotA, g_iTotB);
	}
	Demo_Stop();
	RestoreStartMoney();
	g_hReadyTimer = null;
	g_hPauseTimer = null;   // los timers TIMER_FLAG_NO_MAPCHANGE mueren con el mapa
	Pause_Clear();
}

public void OnClientPutInServer(int client)
{
	g_bReady[client] = false;
	Stats_ClientReset(client);
}

public void OnClientDisconnect(int client)
{
	g_bReady[client] = false;
	Stats_ClientLeave(client);
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

public Action Cmd_Live(int client, int args)
{
	if (!g_cvEnabled.BoolValue)
	{
		ReplyToCommand(client, "[CSSTV] El plugin está desactivado (csstv_enabled 0).");
		return Plugin_Handled;
	}
	if (g_State != State_Warmup)
	{
		ReplyToCommand(client, "[CSSTV] Ya hay una partida en curso.");
		return Plugin_Handled;
	}
	char arg[16];
	GetCmdArg(1, arg, sizeof(arg));
	bool force = StrEqual(arg, "force", false);
	int players = CountTeamPlayers();
	if (!force && players < g_cvMinPlayers.IntValue)
	{
		ReplyToCommand(client, "[CSSTV] Hay %d jugadores en equipos y el mínimo es %d. Usá sm_live force para empezar igual.", players, g_cvMinPlayers.IntValue);
		return Plugin_Handled;
	}
	StartMatch();
	return Plugin_Handled;
}

public Action Cmd_Cancel(int client, int args)
{
	if (g_State == State_Warmup)
	{
		ReplyToCommand(client, "[CSSTV] No hay ninguna partida en curso.");
		return Plugin_Handled;
	}
	if (g_State == State_Finished)
	{
		ReplyToCommand(client, "[CSSTV] La partida ya terminó y su resultado está en la cola.");
		return Plugin_Handled;
	}
	LogMessage("Partida %s cancelada por %N (%d-%d).", g_sMatchUid, client, g_iTotA, g_iTotB);
	PrintToChatAll("%s Partida cancelada. No se envía ningún resultado.", PREFIX);
	BackToWarmup();
	return Plugin_Handled;
}

public Action Cmd_Ready(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (!g_cvReadySystem.BoolValue || g_State != State_Warmup)
	{
		ReplyToCommand(client, "[CSSTV] Ahora no se puede marcar listo.");
		return Plugin_Handled;
	}
	int team = GetClientTeam(client);
	if (team != TEAM_T && team != TEAM_CT)
	{
		ReplyToCommand(client, "[CSSTV] Uníte a CT o T para marcarte listo.");
		return Plugin_Handled;
	}
	if (!g_bReady[client])
	{
		g_bReady[client] = true;
		PrintToChatAll("%s %N está listo (%d/%d).", PREFIX, client, CountReady(), CountTeamPlayers());
	}
	CheckReadyStart();
	return Plugin_Handled;
}

public Action Cmd_Unready(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (g_State == State_Warmup && g_bReady[client])
	{
		g_bReady[client] = false;
		PrintToChatAll("%s %N ya no está listo (%d/%d).", PREFIX, client, CountReady(), CountTeamPlayers());
	}
	return Plugin_Handled;
}

public Action Cmd_Score(int client, int args)
{
	if (g_State == State_Warmup)
	{
		ReplyToCommand(client, "[CSSTV] Calentamiento. Listos: %d/%d.", CountReady(), CountTeamPlayers());
	}
	else
	{
		ReplyToCommand(client, "[CSSTV] Equipo A (%s) %d - %d Equipo B (%s) · %s, ronda %d de %d.",
			g_iSideA == TEAM_CT ? "CT" : "T", g_iTotA, g_iTotB, g_iSideA == TEAM_CT ? "T" : "CT",
			g_iSegment == 0 ? "reglamentario" : "prórroga", g_iSegRound + 1, g_iSegLen);
	}
	return Plugin_Handled;
}

public Action Cmd_Status(int client, int args)
{
	static const char stateNames[][] = { "calentamiento", "iniciando (LO3)", "en vivo", "medio tiempo", "terminada" };
	ReplyToCommand(client, "[CSSTV] v%s · estado: %s · partida: %s · %d-%d", PLUGIN_VERSION, stateNames[view_as<int>(g_State)],
		g_sMatchUid[0] ? g_sMatchUid : "-", g_iTotA, g_iTotB);
	char mode[96];
	Http_ModeText(mode, sizeof(mode));
	ReplyToCommand(client, "[CSSTV] Envío: %s · en cola: %d · rechazados: %d", mode, Queue_Count(false), Queue_Count(true));
	if (g_sLastError[0])
		ReplyToCommand(client, "[CSSTV] Último error: %s", g_sLastError);
	return Plugin_Handled;
}

public Action Cmd_Flush(int client, int args)
{
	Http_ResetBackoff();
	Http_ScheduleProcess(0.1);
	ReplyToCommand(client, "[CSSTV] Procesando la cola (%d archivos).", Queue_Count(false));
	return Plugin_Handled;
}

public Action Cmd_RetryFailed(int client, int args)
{
	int n = Queue_RequeueFailed();
	Http_ResetBackoff();
	Http_ScheduleProcess(0.1);
	ReplyToCommand(client, "[CSSTV] %d archivo(s) devueltos a la cola.", n);
	return Plugin_Handled;
}

// ---------------------------------------------------------------------------
// Ready
// ---------------------------------------------------------------------------

void StartReadyTimer()
{
	if (g_hReadyTimer == null)
		g_hReadyTimer = CreateTimer(30.0, Timer_ReadyReminder, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_ReadyReminder(Handle timer)
{
	if (!g_cvEnabled.BoolValue || !g_cvReadySystem.BoolValue || g_State != State_Warmup)
		return Plugin_Continue;
	int total = CountTeamPlayers();
	if (total == 0)
		return Plugin_Continue;
	char names[256];
	int missing;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsCountedPlayer(i) || g_bReady[i])
			continue;
		char n[MAX_NAME_LENGTH];
		GetClientName(i, n, sizeof(n));
		if (missing < 6)
			Format(names, sizeof(names), "%s%s%s", names, missing ? ", " : "", n);
		missing++;
	}
	PrintToChatAll("%s Calentamiento. Listos %d/%d (mínimo %d). Escribí !ready para empezar.", PREFIX, total - missing, total, g_cvMinPlayers.IntValue);
	if (missing)
		PrintToChatAll("%s Faltan: %s%s", PREFIX, names, missing > 6 ? "…" : "");
	return Plugin_Continue;
}

void CheckReadyStart()
{
	int total = CountTeamPlayers();
	if (total >= g_cvMinPlayers.IntValue && CountReady() == total)
		StartMatch();
}

int CountReady()
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (IsCountedPlayer(i) && g_bReady[i])
			n++;
	return n;
}

int CountTeamPlayers()
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (IsCountedPlayer(i))
			n++;
	return n;
}

bool IsCountedPlayer(int client)
{
	if (!IsClientInGame(client))
		return false;
	if (IsFakeClient(client) && !g_cvIncludeBots.BoolValue)
		return false;
	int team = GetClientTeam(client);
	return team == TEAM_T || team == TEAM_CT;
}

// ---------------------------------------------------------------------------
// Flujo de la partida
// ---------------------------------------------------------------------------

void ResetMatch()
{
	g_State = State_Warmup;
	g_sMatchUid[0] = '\0';
	g_iStartedAt = 0;
	g_iSideA = TEAM_CT;
	g_iSegment = 0;
	g_iSegLen = 0;
	g_iSegRound = 0;
	g_iSegA = 0;
	g_iSegB = 0;
	g_iTotA = 0;
	g_iTotB = 0;
	g_bRestarting = false;
	g_iRestartsLeft = 0;
	for (int i = 1; i <= MaxClients; i++)
		g_bReady[i] = false;
	Stats_Reset();
	Qol_Reset();
}

void BackToWarmup()
{
	Demo_Stop();
	RestoreStartMoney();
	ResetMatch();
	ExecIfExists("csstv/warmup.cfg");
}

void StartMatch()
{
	ResetMatch();
	g_State = State_Starting;
	g_iSegLen = g_cvMaxRounds.IntValue;
	if (g_iSegLen % 2)
		g_iSegLen++;

	char tag[24];
	g_cvServerTag.GetString(tag, sizeof(tag));
	SanitizeId(tag);
	FormatTime(g_sMatchUid, sizeof(g_sMatchUid), "%Y%m%dT%H%M%S", GetTime());
	Format(g_sMatchUid, sizeof(g_sMatchUid), "%s-%s-%04x", tag[0] ? tag : "srv", g_sMatchUid, GetRandomInt(0, 0xFFFF));

	// El plugin decide cuándo termina la partida, no el juego.
	ServerCommand("mp_maxrounds 0; mp_winlimit 0; mp_timelimit 0");
	ExecIfExists("csstv/live.cfg");

	PrintToChatAll("%s La partida empieza. Equipo A = CT, Equipo B = T. MR%d.", PREFIX, g_iSegLen / 2);
	BeginRestarts(g_cvLo3.BoolValue ? 3 : 1, PURPOSE_LIVE);
}

void BeginRestarts(int count, int purpose)
{
	g_bRestarting = true;
	g_iRestartsLeft = count;
	g_iRestartPurpose = purpose;
	ServerCommand("mp_restartgame 1");
}

public Action Timer_NextRestart(Handle timer)
{
	if (g_bRestarting)
		ServerCommand("mp_restartgame 1");
	return Plugin_Stop;
}

void OnRestartsDone()
{
	g_State = State_Live;
	ApplyTeamScores();
	if (g_iRestartPurpose == PURPOSE_LIVE)
	{
		g_iStartedAt = GetTime();
		char map[64];
		GetCurrentMap(map, sizeof(map));
		LogMessage("Partida %s en vivo en %s.", g_sMatchUid, map);
		PrintToChatAll("%s ¡EN VIVO! ¡EN VIVO! ¡EN VIVO! Suerte a todos.", PREFIX);
		Demo_Start();
	}
	else
	{
		PrintToChatAll("%s ¡EN VIVO! Equipo A %d - %d Equipo B.", PREFIX, g_iTotA, g_iTotB);
	}
}

void ApplyTeamScores()
{
	SetTeamScore(g_iSideA, g_iTotA);
	SetTeamScore(OtherSide(g_iSideA), g_iTotB);
}

int OtherSide(int side)
{
	return side == TEAM_CT ? TEAM_T : TEAM_CT;
}

void OnRoundCompleted(int winnerSide, int reason)
{
	bool aWon = winnerSide == g_iSideA;
	Stats_RoundEnd(g_iSideA);
	Stats_LogRound(aWon ? 1 : 2, g_iSideA, reason);

	if (aWon) { g_iSegA++; g_iTotA++; }
	else      { g_iSegB++; g_iTotB++; }
	g_iSegRound++;
	Stats_SnapshotRound(g_iTotA + g_iTotB);

	int half = g_iSegLen / 2;
	PrintToChatAll("%s Equipo A %d - %d Equipo B", PREFIX, g_iTotA, g_iTotB);

	if (g_iSegA > half || g_iSegB > half)
	{
		FinishMatch();
	}
	else if (g_iSegRound >= g_iSegLen)
	{
		if (g_cvOvertime.BoolValue)
			StartOvertime();
		else
			FinishMatch();
	}
	else if (g_iSegRound == half)
	{
		g_State = State_Halftime;
		PrintToChatAll("%s Medio tiempo. Se cambian los lados.", PREFIX);
		CreateTimer(g_cvHalftimeDelay.FloatValue, Timer_Halftime, _, TIMER_FLAG_NO_MAPCHANGE);
	}
}

public Action Timer_Halftime(Handle timer)
{
	if (g_State != State_Halftime)
		return Plugin_Stop;
	SwapTeams();
	BeginRestarts(1, PURPOSE_RESUME);
	return Plugin_Stop;
}

void StartOvertime()
{
	g_State = State_Halftime;
	g_iSegment++;
	g_iSegLen = g_cvOtMaxRounds.IntValue;
	if (g_iSegLen % 2)
		g_iSegLen++;
	g_iSegRound = 0;
	g_iSegA = 0;
	g_iSegB = 0;
	PrintToChatAll("%s Empate %d-%d. Prórroga %d (MR%d).", PREFIX, g_iTotA, g_iTotB, g_iSegment, g_iSegLen / 2);
	CreateTimer(g_cvHalftimeDelay.FloatValue, Timer_OvertimeStart, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_OvertimeStart(Handle timer)
{
	if (g_State != State_Halftime)
		return Plugin_Stop;
	ConVar money = FindConVar("mp_startmoney");
	if (money != null)
	{
		if (g_iSavedStartMoney < 0)
			g_iSavedStartMoney = money.IntValue;
		money.IntValue = g_cvOtStartMoney.IntValue;
	}
	BeginRestarts(1, PURPOSE_RESUME);
	return Plugin_Stop;
}

void RestoreStartMoney()
{
	if (g_iSavedStartMoney < 0)
		return;
	ConVar money = FindConVar("mp_startmoney");
	if (money != null)
		money.IntValue = g_iSavedStartMoney;
	g_iSavedStartMoney = -1;
}

void SwapTeams()
{
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		int team = GetClientTeam(i);
		if (team != TEAM_T && team != TEAM_CT)
			continue;
		// ChangeClientTeam deja al jugador sin clase y esperando elegir modelo: los bots
		// no reaparecen nunca. Se le asigna el modelo equivalente del otro lado
		// (T 1-4 <-> CT 5-8) y se lo marca activo para que reaparezca con el reinicio.
		// En v34 no sirven CS_SwitchTeam (firma de otra versión) ni FakeClientCommand
		// "joinclass" (tumba el servidor con bots).
		int cls = GetEntProp(i, Prop_Send, "m_iClass");
		int to = OtherSide(team);
		ChangeClientTeam(i, to);
		if (cls >= 1 && cls <= 4)
			cls += 4;
		else if (cls >= 5 && cls <= 8)
			cls -= 4;
		else
			cls = to == TEAM_T ? GetRandomInt(1, 4) : GetRandomInt(5, 8);
		SetEntProp(i, Prop_Send, "m_iClass", cls);
		SetEntProp(i, Prop_Send, "m_iPlayerState", 0);   // STATE_ACTIVE
	}
	g_iSideA = OtherSide(g_iSideA);
}

void FinishMatch()
{
	g_State = State_Finished;
	Pause_Clear();
	Demo_Stop();
	int endedAt = GetTime();
	char winner[8];
	if (g_iTotA > g_iTotB)
		strcopy(winner, sizeof(winner), "A");
	else if (g_iTotB > g_iTotA)
		strcopy(winner, sizeof(winner), "B");
	else
		strcopy(winner, sizeof(winner), "");

	if (winner[0])
		PrintToChatAll("%s Fin de la partida: Equipo A %d - %d Equipo B. Gana el equipo %s.", PREFIX, g_iTotA, g_iTotB, winner);
	else
		PrintToChatAll("%s Fin de la partida: empate %d-%d.", PREFIX, g_iTotA, g_iTotB);

	Json_BuildPayload(endedAt);
	if (Queue_Save(g_sMatchUid))
	{
		LogMessage("Partida %s terminada %d-%d. Resultado guardado en la cola.", g_sMatchUid, g_iTotA, g_iTotB);
		PrintToChatAll("%s Enviando el resultado a CSSTV…", PREFIX);
		Http_ResetBackoff();
		Http_ScheduleProcess(1.0);
	}
	else
	{
		LogError("No se pudo guardar el resultado de %s en la cola.", g_sMatchUid);
		PrintToChatAll("%s No se pudo guardar el resultado. Avisá a un admin.", PREFIX);
	}

	RestoreStartMoney();
	ExecIfExists("csstv/end.cfg");
	CreateTimer(15.0, Timer_AfterFinish, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_AfterFinish(Handle timer)
{
	if (g_State == State_Finished)
		BackToWarmup();
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Eventos
// ---------------------------------------------------------------------------

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	Stats_RoundStart();
	Qol_ScheduleScoreSync();
	if (g_bRestarting)
	{
		g_iRestartsLeft--;
		if (g_iRestartsLeft > 0)
		{
			PrintToChatAll("%s Reinicio %d…", PREFIX, 3 - g_iRestartsLeft);
			CreateTimer(1.5, Timer_NextRestart, _, TIMER_FLAG_NO_MAPCHANGE);
			return;
		}
		g_bRestarting = false;
		OnRestartsDone();
	}
	if (g_State == State_Live)
		Qol_OnLiveRoundStart();
}

public void Event_RoundEnd(Event event, const char[] name, bool dontBroadcast)
{
	Qol_ScheduleScoreSync();
	if (g_State != State_Live || g_bRestarting)
		return;
	int winner = event.GetInt("winner");
	if (winner != TEAM_T && winner != TEAM_CT)
		return; // ronda empatada o reinicio: no cuenta
	OnRoundCompleted(winner, event.GetInt("reason"));
}

public void Event_PlayerSpawn(Event event, const char[] name, bool dontBroadcast)
{
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0)
		Stats_OnSpawn(client);
}

public void Event_PlayerHurt(Event event, const char[] name, bool dontBroadcast)
{
	int victim = GetClientOfUserId(event.GetInt("userid"));
	if (victim <= 0)
		return;
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	Stats_OnHurt(victim, attacker, event.GetInt("dmg_health"), event.GetInt("health"), g_State == State_Live && !g_bRestarting);
}

public void Event_PlayerDeath(Event event, const char[] name, bool dontBroadcast)
{
	if (g_State != State_Live || g_bRestarting)
		return;
	int victim = GetClientOfUserId(event.GetInt("userid"));
	if (victim <= 0)
		return;
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	Stats_OnDeath(victim, attacker, event.GetBool("headshot"));
	char weapon[32];
	event.GetString("weapon", weapon, sizeof(weapon));
	Qol_OnDeath(victim, attacker, weapon);
}

public void Event_BombPlanted(Event event, const char[] name, bool dontBroadcast)
{
	if (g_State != State_Live || g_bRestarting)
		return;
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0)
		Stats_Add(client, ST_PLANTS, 1);
}

public void Event_BombDefused(Event event, const char[] name, bool dontBroadcast)
{
	if (g_State != State_Live || g_bRestarting)
		return;
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0)
		Stats_Add(client, ST_DEFUSES, 1);
}

// ---------------------------------------------------------------------------
// Utilidades
// ---------------------------------------------------------------------------

void ExecIfExists(const char[] cfg)
{
	char path[PLATFORM_MAX_PATH];
	Format(path, sizeof(path), "cfg/%s", cfg);
	if (FileExists(path))
		ServerCommand("exec %s", cfg);
}

void SanitizeId(char[] s)
{
	int j;
	for (int i = 0; s[i] != '\0'; i++)
	{
		int c = s[i];
		if ((c >= 'a' && c <= 'z') || (c >= 'A' && c <= 'Z') || (c >= '0' && c <= '9') || c == '-' || c == '_')
			s[j++] = s[i];
	}
	s[j] = '\0';
}
