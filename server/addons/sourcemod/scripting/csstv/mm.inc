/**
 * Matchmaking: el servidor toma las salas que arma la web (plan: docs/bitacora/2026-10-28-matchmaking).
 *
 *  - Libre (calentamiento, sin !match): cada csstv_mm_poll segundos pregunta a csstv_mm_poll si tiene una sala.
 *  - Al tomarla: avisa "taken", guarda la sala en data/csstv/mm.txt, pone la contraseña, activa el vínculo de
 *    csstv/match.inc con los planteles (sin stand-ins y sin que nadie escriba !match) y cambia al mapa.
 *  - Conectando: avisa "connected" por cada jugador del plantel. El inicio es el de siempre (!ready). Si no
 *    llegan a tiempo, cancela la base (es quien sanciona) y el plugin se entera en el poll siguiente.
 *  - En vivo: avisa "live", "left" y "back". El resultado sale con link_code como cualquier !match.
 *  - Al terminar: pone una contraseña al azar antes de avisar nada y queda libre. La sala sigue en mm.txt como
 *    terminada hasta que la base la cierra con el resultado, para no retomarla. Si en MM_DONE_WAIT segundos no
 *    la cerró (resultado rechazado, por ejemplo), la cancela.
 *
 * Sin SteamID vinculado (bitácora 2026-11-02-mm-claim-en-sala): la web deja entrar a la cola sin SteamID. Quien no
 * está en el plantel queda de espectador y se le recuerda el !claim; cuando lo hace, el poll siguiente (adelantado por
 * Mm_OnClaimLinked) trae su SteamID en t1/t2 y Mm_UpdateRoster lo pasa a su equipo. n1/n2 son todos los de la sala,
 * con o sin SteamID: el !ready no arranca hasta que estén todos.
 *
 * La contraseña vigente fuera de una sala vive en data/csstv/mm_pw.txt (valor, id y si falta confirmarla a la
 * base): sobrevive a reinicios y se reintenta hasta que la base la tiene. Nunca va al log ni al chat.
 * Las respuestas son texto clave=valor, como csstv_match_lookup. Con csstv_mm 0 nada de esto corre.
 *
 * Reservas de torneo y PCW (2.9.0, bitácora 2026-11-02-iniciar-torneo-pcw): el poll trae kind=official|pcw y los mismos
 * datos que csstv_match_lookup. Se toman como una sala (contraseña, vínculo sin confirmar el código y mapa), pero duran toda
 * la serie: al terminar un mapa no se suelta el servidor; cuando la base suma el mapa (map_no sube), se esperan
 * MM_SERIES_DELAY segundos (csstv_series_next_delay) para SourceTV y se carga el mapa siguiente del veto. Un mapa que no
 * sumó (cancelado, reinicio o resultado rechazado) se avisa con "mapover" y se vuelve a jugar. En cada poll va el estado de
 * cada equipo (p_state "ok1,ok2,n1,n2"): con eso la base decide el abandono de una PCW. Con auto_start=1 (PCW con la
 * espera vencida y los dos equipos en regla) el mapa arranca sin !ready.
 *
 * Reemplazos (2.10.0, bitácora 2026-11-04-mm-reemplazos): en vivo, el poll trae el plantel (t1/t2, sin los reemplazados y con
 * el reemplazo), si se puede pedir un reemplazo en cada equipo (replace=), el voto (replace_vote=porcentaje,segundos,espera)
 * y los desconectados (away=SteamID|equipo|nick;…). El reemplazo que entra va al lado de su equipo y el reemplazado, si
 * vuelve, queda de espectador (Mm_LiveSide, que usa Recon). !callreplace abre un voto entre los compañeros conectados del que
 * falta; si pasa con más del porcentaje (el que no vota cuenta como No), se avisa "callreplace" y la base lo da por abandonado
 * y llama al reemplazo en Discord.
 */

#if defined _csstv_mm_included
	#endinput
#endif
#define _csstv_mm_included

#define MM_PW_LEN 8
#define MM_DONE_WAIT 300
#define MM_RETRY_SECONDS 10
#define MM_OUT_MAX 768
#define MM_LIVE_POLL 10
#define MM_CLAIM_EVERY 20

#define MM_BOOKING_MIN_SIDE 4

ConVar g_cvMm;
ConVar g_cvMmPoll;
ConVar g_cvSeriesDelay;
char g_sMmKind[12];            // reserva: official o pcw; vacío en una sala del matchmaking
int g_iMmMapNo;                // reserva: número del mapa de la serie que está cargado
bool g_bMmBetween;             // reserva: terminó un mapa y se espera el siguiente
bool g_bMmMapOverSent;
int g_iMmBetweenAt;
int g_iMmWaitUntil;            // reserva: hasta cuándo se espera a los equipos (para el chat)
int g_iMmWaitNagAt;
char g_sMmLobby[40];           // sala tomada, o terminada si g_bMmDone
char g_sMmMap[PLATFORM_MAX_PATH];
char g_sMmPassword[33];        // contraseña de la sala
bool g_bMmDone;
bool g_bMmDoneAborted;
int g_iMmDoneAt;
bool g_bMmLive;
int g_iMmAbandons[2];          // abandonos confirmados de cada equipo de la sala
bool g_bMmLoaded;
int g_iMmRosterTotal;
int g_iMmUnlinked;             // de la sala sin SteamID vinculado (tienen que hacer !claim)
int g_iMmClaimNagAt;
bool g_bMmPollBusy;
int g_iMmLastPoll;
int g_iMmPollErrors;
// Avisos a la base, de a uno y en orden. Cada entrada: "función|argumentos JSON".
ArrayList g_hMmOut;
bool g_bMmOutBusy;
int g_iMmOutRetryAt;
// Contraseña fuera de una sala (mm_pw.txt).
char g_sMmIdlePw[33];
char g_sMmIdleUid[64];
bool g_bMmIdlePending;
bool g_bMmIdleQueued;
// Reemplazos (2.10.0).
bool g_bMmReplaceOk[2];        // la base deja pedir un reemplazo para el equipo 1 o 2 de la sala
char g_sMmAway[1024];          // desconectados: "STEAM_0:X:Y|equipo|nick;…"
char g_sMmJoined[256];         // los que entraron al plantel con la partida en vivo (los reemplazos): ",STEAM_0:X:Y,…"
int g_iMmVotePct = 80;
int g_iMmVoteSeconds = 30;
int g_iMmVoteCooldown = 60;
int g_iMmVoteNextAt[2];        // hasta cuándo espera cada equipo para otro voto
bool g_bMmVoteActive;
int g_iMmVoteTeam;
int g_iMmVoteVoters;
int g_iMmVoteBots;             // solo en la build de pruebas: bots del equipo, que votan Sí solos
char g_sMmVoteKey[40];
char g_sMmVoteNick[32];

void Mm_Init()
{
	g_cvMm = CreateConVar("csstv_mm", "0", "Este servidor toma salas del matchmaking de la web. La contraseña pasa a manejarla la web.", _, true, 0.0, true, 1.0);
	g_cvMmPoll = CreateConVar("csstv_mm_poll", "5", "Segundos entre consultas a la web cuando el servidor está libre.", _, true, 2.0, true, 60.0);
	g_cvSeriesDelay = CreateConVar("csstv_series_next_delay", "90", "Reserva de torneo o PCW: segundos entre el fin de un mapa y el mapa siguiente de la serie (para SourceTV).", _, true, 60.0, true, 120.0);
	g_hMmOut = new ArrayList(ByteCountToCells(MM_OUT_MAX));
	RegConsoleCmd("sm_callreplace", Cmd_MmCallReplace, "Matchmaking: votar con tu equipo para pedir un reemplazo de un compañero desconectado.");
#if defined CSSTV_DEBUG
	RegAdminCmd("sm_mm_sides", Cmd_MmSides, ADMFLAG_ROOT, "Pruebas: el lado de cada jugador (nombre=lado;…, 2 T, 3 CT, 1 espectador).");
	RegAdminCmd("sm_callreplace_as", Cmd_MmCallReplaceAs, ADMFLAG_ROOT, "Pruebas: sm_callreplace_as <bot> <nick o SteamID del desconectado>.");
#endif
	CreateTimer(1.0, Timer_MmTick, _, TIMER_REPEAT);
}

bool Mm_On()
{
	return g_cvMm.BoolValue && g_cvEnabled.BoolValue;
}

/** Hay una sala tomada y sin terminar: manda ella (mapa, vínculo y contraseña). */
bool Mm_HasLobby()
{
	return g_sMmLobby[0] != '\0' && !g_bMmDone;
}

/** La sala es una reserva de torneo o PCW (no del matchmaking). */
bool Mm_IsBooking()
{
	return Mm_HasLobby() && g_sMmKind[0] != '\0';
}

/** Jugadores que pide la sala para el inicio por !ready; si no hay sala, el mínimo de siempre. */
int Mm_MinPlayers()
{
	return Mm_HasLobby() && g_iMmRosterTotal > 0 ? g_iMmRosterTotal : g_cvMinPlayers.IntValue;
}

/** csstv_abandon_players pensado para un 5v5: en una sala chica, la mitad del plantel. */
int Mm_AbandonMin(int min)
{
	return Mm_HasLobby() && g_iMmRosterTotal > 0 && g_iMmRosterTotal / 2 < min ? g_iMmRosterTotal / 2 : min;
}

void Mm_StatusText(char[] text, int maxlen)
{
	if (!Mm_On())
		strcopy(text, maxlen, "apagado");
	else if (Mm_IsBooking())
		Format(text, maxlen, "reserva %s (%s, mapa %d%s) en %s", g_sMmLobby, g_sMmKind, g_iMmMapNo,
			g_bMmLive ? " en vivo" : (g_bMmBetween ? ", entre mapas" : ""), g_sMmMap);
	else if (Mm_HasLobby())
		Format(text, maxlen, "sala %s%s en %s", g_sMmLobby, g_bMmLive ? " en vivo" : "", g_sMmMap);
	else if (g_sMmLobby[0])
		Format(text, maxlen, "libre, esperando que la web cierre la sala %s", g_sMmLobby);
	else
		strcopy(text, maxlen, "libre");
}

// ---------------------------------------------------------------------------
// Archivos
// ---------------------------------------------------------------------------

void Mm_LobbyPath(char[] path, int maxlen)
{
	BuildPath(Path_SM, path, maxlen, "data/csstv/mm.txt");
}

void Mm_SaveLobby()
{
	char path[PLATFORM_MAX_PATH];
	Mm_LobbyPath(path, sizeof(path));
	if (!g_sMmLobby[0])
	{
		if (FileExists(path))
			DeleteFile(path);
		return;
	}
	File f = OpenFile(path, "w");
	if (f == null)
	{
		LogError("Matchmaking: no se pudo guardar %s.", path);
		return;
	}
	f.WriteLine("%s", g_sMmLobby);
	f.WriteLine("%d", g_bMmDone ? 1 : 0);
	delete f;
}

void Mm_LoadLobby()
{
	char path[PLATFORM_MAX_PATH], line[40];
	Mm_LobbyPath(path, sizeof(path));
	File f = OpenFile(path, "r");
	if (f == null)
		return;
	if (f.ReadLine(line, sizeof(line)))
	{
		TrimString(line);
		strcopy(g_sMmLobby, sizeof(g_sMmLobby), line);
		g_bMmDone = f.ReadLine(line, sizeof(line)) && StringToInt(line) == 1;
		g_iMmDoneAt = GetTime();
	}
	delete f;
}

void Mm_IdlePath(char[] path, int maxlen)
{
	BuildPath(Path_SM, path, maxlen, "data/csstv/mm_pw.txt");
}

void Mm_SaveIdle()
{
	char path[PLATFORM_MAX_PATH];
	Mm_IdlePath(path, sizeof(path));
	File f = OpenFile(path, "w");
	if (f == null)
	{
		LogError("Matchmaking: no se pudo guardar %s.", path);
		return;
	}
	f.WriteLine("%s", g_sMmIdlePw);
	f.WriteLine("%s", g_sMmIdleUid);
	f.WriteLine("%d", g_bMmIdlePending ? 1 : 0);
	delete f;
}

void Mm_LoadIdle()
{
	char path[PLATFORM_MAX_PATH], line[64];
	Mm_IdlePath(path, sizeof(path));
	File f = OpenFile(path, "r");
	if (f == null)
		return;
	if (f.ReadLine(g_sMmIdlePw, sizeof(g_sMmIdlePw)) && f.ReadLine(g_sMmIdleUid, sizeof(g_sMmIdleUid)) && f.ReadLine(line, sizeof(line)))
	{
		TrimString(g_sMmIdlePw);
		TrimString(g_sMmIdleUid);
		g_bMmIdlePending = StringToInt(line) == 1;
	}
	delete f;
}

// ---------------------------------------------------------------------------
// Contraseña
// ---------------------------------------------------------------------------

void Mm_SetPassword(const char[] pw)
{
	ConVar cv = FindConVar("sv_password");
	if (cv != null)
		cv.SetString(pw);
}

/** Una al azar, puesta antes de avisar nada: el servidor queda cerrado aunque la web no responda. */
void Mm_RotatePassword()
{
	static const char chars[] = "abcdefghjkmnpqrstuvwxyz23456789";
	int n = strlen(chars);
	for (int i = 0; i < MM_PW_LEN; i++)
		g_sMmIdlePw[i] = chars[GetURandomInt() % n];
	g_sMmIdlePw[MM_PW_LEN] = '\0';
	Mm_SetPassword(g_sMmIdlePw);
	Format(g_sMmIdleUid, sizeof(g_sMmIdleUid), "idle-%d-%04x", GetTime(), GetRandomInt(0, 0xFFFF));
	g_bMmIdlePending = true;
	g_bMmIdleQueued = false;
	Mm_SaveIdle();
}

/** Rotación pedida por un admin desde la web: se pone y se confirma con su id. */
void Mm_ApplyRotation(const char[] id, const char[] pw)
{
	if (StrEqual(id, g_sMmIdleUid))
		return;
	strcopy(g_sMmIdlePw, sizeof(g_sMmIdlePw), pw);
	strcopy(g_sMmIdleUid, sizeof(g_sMmIdleUid), id);
	Mm_SetPassword(pw);
	g_bMmIdlePending = true;
	g_bMmIdleQueued = false;
	Mm_SaveIdle();
}

/**
 * En cada mapa, después del server.cfg (que trae su propio sv_password): vuelve a poner la vigente. También
 * retoma la sala de mm.txt la primera vez y, si el mapa cambió por fuera, vuelve al de la sala.
 */
void Mm_OnConfigsExecuted()
{
	if (!Mm_On())
		return;
	if (!g_bMmLoaded)
	{
		g_bMmLoaded = true;
		Mm_LoadLobby();
		Mm_LoadIdle();
	}
	if (Mm_HasLobby() && g_sMmPassword[0])
		Mm_SetPassword(g_sMmPassword);
	else if (g_sMmIdlePw[0])
		Mm_SetPassword(g_sMmIdlePw);
	else
		Mm_RotatePassword();
	if (Mm_HasLobby() && g_sMmMap[0])
		Mm_GoToMap();
}

// ---------------------------------------------------------------------------
// Consulta a la web
// ---------------------------------------------------------------------------

bool Mm_RpcUrl(const char[] rpc, char[] url, int maxlen)
{
	g_cvApiUrl.GetString(url, maxlen);
	int pos = StrContains(url, "/rpc/", false);
	if (pos == -1)
		return false;
	url[pos + 5] = '\0';
	StrCat(url, maxlen, rpc);
	return true;
}

System2HTTPRequest Mm_Request(System2HTTPResponseCallback callback, const char[] url, const char[] body)
{
	char key[512];
	g_cvApiKey.GetString(key, sizeof(key));
	System2HTTPRequest req = new System2HTTPRequest(callback, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CSSTV-Reporter/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 15;
	return req;
}

public Action Timer_MmTick(Handle timer)
{
	// Con csstv_send 0 tampoco se consulta: el servidor local de pruebas apunta a la base real.
	if (!Mm_On() || !g_cvSend.BoolValue || !Http_Available() || !Http_Configured() || !License_Allows())
		return Plugin_Continue;
	if (g_bMmIdlePending && !g_bMmIdleQueued)
	{
		g_bMmIdleQueued = true;
		char args[192];
		Format(args, sizeof(args), "\"p_uid\":\"%s\",\"p_password\":\"%s\",\"p_kind\":\"idle\"", g_sMmIdleUid, g_sMmIdlePw);
		Mm_Queue("csstv_mm_password", args);
	}
	Mm_FlushOut();
	Mm_LiveEnforce();
	Mm_ClaimNag();
	Mm_WaitNag();
	// Un mix o un !match en curso: la web lo ve fuera de línea y no le asigna nada. Una sala en vivo sí
	// consulta, más espaciado: derrota automática, anulación y cuántos abandonos lleva cada equipo.
	bool live = g_bMmLive && Mm_HasLobby();
	if (!live && (g_State != State_Warmup || (!Mm_HasLobby() && g_LinkState != Link_None)))
		return Plugin_Continue;
	int every = live && g_cvMmPoll.IntValue < MM_LIVE_POLL ? MM_LIVE_POLL : g_cvMmPoll.IntValue;
	if (g_bMmPollBusy || GetTime() - g_iMmLastPoll < every)
		return Plugin_Continue;
	Mm_Poll();
	return Plugin_Continue;
}

void Mm_Poll()
{
	char url[256], token[128], body[320], state[32];
	if (!Mm_RpcUrl("csstv_mm_poll", url, sizeof(url)))
		return;
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);
	if (Mm_IsBooking() && g_LinkState == Link_Active)
	{
		// Estado de cada equipo de la partida: en regla con 4 o más en su lado, y cuántos tiene en su lado.
		char problem[128];
		int n1 = Link_TeamCount(1), n2 = Link_TeamCount(2);
		bool ok1 = n1 >= MM_BOOKING_MIN_SIDE && Link_TeamOk(1, problem, sizeof(problem));
		bool ok2 = n2 >= MM_BOOKING_MIN_SIDE && Link_TeamOk(2, problem, sizeof(problem));
		Format(state, sizeof(state), ",\"p_state\":\"%d,%d,%d,%d\"", ok1 ? 1 : 0, ok2 ? 1 : 0, n1, n2);
	}
	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_version\":\"%s\"%s}", token, PLUGIN_VERSION, state);
	System2HTTPRequest req = Mm_Request(Mm_OnPoll, url, body);
	req.POST();
	delete req;
	g_bMmPollBusy = true;
	g_iMmLastPoll = GetTime();
}

public void Mm_OnPoll(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	g_bMmPollBusy = false;
	int status = success && response != null ? response.StatusCode : 0;
	char text[4096];
	if (response != null)
		response.GetContent(text, sizeof(text));
	if (status != 200)
	{
		if (g_iMmPollErrors++ == 0)
			LogError("csstv_mm_poll: %s %s", status ? "HTTP" : "sin conexión", status ? text : error);
		return;
	}
	Link_UnescapeJsonString(text);
	char ok[4];
	Link_Field(text, "ok", ok, sizeof(ok));
	if (!StrEqual(ok, "1"))
	{
		char err[160];
		Link_Field(text, "error", err, sizeof(err));
		if (g_iMmPollErrors++ == 0)
			LogError("csstv_mm_poll: %s", err);
		return;
	}
	g_iMmPollErrors = 0;
	if (g_bMmLive && Mm_HasLobby())
	{
		Mm_OnLivePoll(text);
		return;
	}
	// La respuesta pudo tardar: si en el medio empezó una partida, no se toca nada.
	if (g_State != State_Warmup)
		return;

	char lobby[40];
	Link_Field(text, "lobby", lobby, sizeof(lobby));
	if (!lobby[0])
	{
		Mm_OnNoLobby(text);
		return;
	}
	if (g_bMmDone && StrEqual(lobby, g_sMmLobby))
	{
		// La web todavía no recibió el resultado. Si no llega, se cancela para que el servidor no quede trabado.
		if (!g_bMmDoneAborted && GetTime() - g_iMmDoneAt >= MM_DONE_WAIT)
		{
			g_bMmDoneAborted = true;
			Mm_Report("abort", "El resultado de la partida no llegó a la web");
		}
		return;
	}
	if (g_bMmDone)
		Mm_Forget();

	// Reserva de torneo o PCW (2.9.0).
	char kind[12];
	Link_Field(text, "kind", kind, sizeof(kind));
	if (kind[0])
	{
		Mm_OnBookingPoll(lobby, kind, text);
		return;
	}

	char st[16];
	Link_Field(text, "status", st, sizeof(st));
	if (StrEqual(st, "live"))
	{
		// La sala figura en vivo y acá no hay partida: se reinició el servidor en el medio.
		strcopy(g_sMmLobby, sizeof(g_sMmLobby), lobby);
		Mm_Close("El servidor se reinició durante la partida");
		return;
	}
	if (Mm_HasLobby() && !StrEqual(lobby, g_sMmLobby))
		Mm_Release();
	bool known = StrEqual(lobby, g_sMmLobby);
	if (known && g_LinkState == Link_Active)
	{
		Mm_UpdateRoster(text);
		return;
	}
	if (g_LinkState != Link_None || Maps_ChangePending())
		return;
	Mm_Take(lobby, text, StrEqual(st, "assigned"));
}

/** Con la sala en vivo: la web la anuló o un equipo perdió por abandonos. */
void Mm_OnLivePoll(const char[] text)
{
	char lobby[40], num[16], parts[2][8];
	Link_Field(text, "lobby", lobby, sizeof(lobby));
	if (!StrEqual(lobby, g_sMmLobby))
	{
		if (Mm_IsBooking())
		{
			// La reserva se cerró (PCW abandonada o cancelada por un moderador): se suelta antes de cortar.
			QolChatAll("%s La web cerró la reserva de esta partida.", PREFIX);
			Mm_Release();
		}
		else
			QolChatAll("%s La web anuló la partida.", PREFIX);
		CancelMatch("admin", "Web");
		BackToWarmup();
		return;
	}
	if (Mm_IsBooking())
		return;
	Mm_ReadReplace(text);
	Mm_LiveRoster(text);
	Link_Field(text, "abandons", num, sizeof(num));
	if (ExplodeString(num, ",", parts, 2, 8) == 2)
	{
		g_iMmAbandons[0] = StringToInt(parts[0]);
		g_iMmAbandons[1] = StringToInt(parts[1]);
	}
	Link_Field(text, "forfeit", num, sizeof(num));
	int team = StringToInt(num);
	if ((team == 1 || team == 2) && g_State == State_Live && !g_bRestarting)
	{
		int t = team == g_iMatchLinkSideA ? 0 : 1;
		QolChatAll("%s {#amarillo}%s{#normal} pierde la partida: abandonaron 2 jugadores.", PREFIX, g_sTeam[t]);
		Gg_Surrender(t);
	}
}

/** !gg: el equipo que perdió a un jugador se puede rendir yendo abajo por cualquier diferencia. */
int Mm_GgMinDiff(int t, int minDiff)
{
	if (!g_bMmLive || !Mm_HasLobby())
		return minDiff;
	int team = t == 0 ? g_iMatchLinkSideA : 3 - g_iMatchLinkSideA;
	return (team == 1 || team == 2) && g_iMmAbandons[team - 1] > 0 ? 1 : minDiff;
}

void Mm_OnNoLobby(const char[] text)
{
	if (Mm_HasLobby())
	{
		if (Mm_IsBooking())
			QolChatAll("%s Terminó la reserva de {#amarillo}%s{#normal}: el servidor queda libre.", PREFIX, g_sLinkTitle);
		else
			QolChatAll("%s La sala del matchmaking se canceló desde la web.", PREFIX);
		Mm_Release();
		Mm_RotatePassword();
	}
	else if (g_bMmDone)
		Mm_Forget();
	char id[64], pw[33];
	Link_Field(text, "idle_id", id, sizeof(id));
	Link_Field(text, "idle_password", pw, sizeof(pw));
	if (id[0] && pw[0])
		Mm_ApplyRotation(id, pw);
}

// ---------------------------------------------------------------------------
// Sala
// ---------------------------------------------------------------------------

int Mm_CountRoster(const char[] list)
{
	if (!list[0])
		return 0;
	int n = 1;
	for (int i = 0; list[i]; i++)
		if (list[i] == ',')
			n++;
	return n;
}

/**
 * Jugadores de cada equipo de la sala. n1/n2 los cuentan a todos, con o sin SteamID (base con el replanteo 49); si no
 * vienen, se cuentan los SteamID de t1/t2, como antes. También guarda cuántos no tienen SteamID.
 */
void Mm_RosterSizes(const char[] text, const char[] t1, const char[] t2, int &n1, int &n2)
{
	char num[16];
	Link_Field(text, "n1", num, sizeof(num));
	n1 = num[0] ? StringToInt(num) : Mm_CountRoster(t1);
	Link_Field(text, "n2", num, sizeof(num));
	n2 = num[0] ? StringToInt(num) : Mm_CountRoster(t2);
	Link_Field(text, "unlinked", num, sizeof(num));
	g_iMmUnlinked = StringToInt(num);
}

/**
 * Poll con la sala ya tomada, en el calentamiento: si alguien hizo !claim, su SteamID llega en t1/t2. Se actualiza el
 * plantel, se acomoda a todos y se avisa "connected" de los que se reconocieron recién.
 */
void Mm_UpdateRoster(const char[] text)
{
	char t1[1024], t2[1024], r1[1024], r2[1024];
	Link_Field(text, "t1", t1, sizeof(t1));
	Link_Field(text, "t2", t2, sizeof(t2));
	int n1, n2;
	Mm_RosterSizes(text, t1, t2, n1, n2);
	Format(r1, sizeof(r1), ",%s,", t1);
	Format(r2, sizeof(r2), ",%s,", t2);
	if (StrEqual(r1, g_sLinkRoster[0], false) && StrEqual(r2, g_sLinkRoster[1], false))
		return;
	bool before[MAXPLAYERS + 1];
	for (int i = 1; i <= MaxClients; i++)
		before[i] = IsClientInGame(i) && Link_TeamOf(i) != 0;
	strcopy(g_sLinkRoster[0], sizeof(g_sLinkRoster[]), r1);
	strcopy(g_sLinkRoster[1], sizeof(g_sLinkRoster[]), r2);
	g_iMmRosterTotal = n1 + n2;
	g_iLinkMinRoster = n1 < n2 ? n1 : n2;
	LogMessage("Matchmaking: plantel de la sala %s actualizado (%d sin SteamID).", g_sMmLobby, g_iMmUnlinked);
	Link_AdoptSides();
	Link_Arrange(true);
	for (int i = 1; i <= MaxClients; i++)
		if (!before[i] && IsClientInGame(i) && !IsFakeClient(i) && Link_TeamOf(i))
			Mm_ReportClient("connected", i);
}

/**
 * Este jugador no está en el plantel de la sala (o de la reserva): puede ser alguien sin SteamID vinculado o alguien que
 * entró con otra cuenta de Steam (otra PC). Desde 2.9.1, también con todos vinculados: el !claim suma el SteamID al instante.
 */
bool Mm_WaitingClaim(int client)
{
	return Mm_On() && Mm_HasLobby() && !g_bMmLive && !g_bMmBetween && IsClientInGame(client)
		&& !IsFakeClient(client) && !IsClientSourceTV(client) && !Link_TeamOf(client);
}

void Mm_ClaimHint(int client)
{
	if (g_iMmUnlinked > 0)
		QolChat(client, "%s Si sos de esta sala y todavía no vinculaste tu SteamID, escribí {#amarillo}!claim <código>{#normal}. El código está en la sala de la web.", PREFIX);
	else
		QolChat(client, "%s Si sos de esta partida y entraste con otra cuenta de Steam, escribí {#amarillo}!claim <código>{#normal}. El código está en la web, en Mi perfil › Vinculación.", PREFIX);
}

/** Cada MM_CLAIM_EVERY segundos, el recordatorio a los que pueden ser de la sala y no están en el plantel. */
void Mm_ClaimNag()
{
	if (!Mm_HasLobby() || g_bMmLive || g_bMmBetween || GetTime() - g_iMmClaimNagAt < MM_CLAIM_EVERY)
		return;
	g_iMmClaimNagAt = GetTime();
	for (int i = 1; i <= MaxClients; i++)
		if (Mm_WaitingClaim(i))
			Mm_ClaimHint(i);
}

/** !claim que vinculó el SteamID con una sala tomada: se adelanta el poll para pasarlo a su equipo enseguida. */
void Mm_OnClaimLinked()
{
	if (Mm_On() && Mm_HasLobby() && !g_bMmLive)
		g_iMmLastPoll = 0;
}

/** Toma la sala (o la retoma después de un reinicio: announce = false, sin "taken"). */
void Mm_Take(const char[] lobby, const char[] text, bool announce)
{
	char map[PLATFORM_MAX_PATH], t1[1024], t2[1024], args[256];
	Link_Field(text, "map", map, sizeof(map));
	Link_Field(text, "t1", t1, sizeof(t1));
	Link_Field(text, "t2", t2, sizeof(t2));
	strcopy(g_sMmLobby, sizeof(g_sMmLobby), lobby);
	g_bMmDone = false;
	g_bMmDoneAborted = false;
	g_bMmLive = false;
	if (!IsMapValid(map))
	{
		LogError("Matchmaking: la sala %s pide el mapa %s, que este servidor no tiene.", lobby, map);
		Mm_Close("El servidor no tiene el mapa");
		return;
	}
	if (announce)
		Mm_Report("taken", "");
	Mm_SaveLobby();

	Link_Field(text, "password", g_sMmPassword, sizeof(g_sMmPassword));
	Mm_SetPassword(g_sMmPassword);
	Format(args, sizeof(args), "\"p_uid\":\"mix-%s\",\"p_password\":\"%s\",\"p_kind\":\"mix\",\"p_lobby\":\"%s\"", lobby, g_sMmPassword, lobby);
	Mm_Queue("csstv_mm_password", args);

	// El vínculo de !match, directo y sin stand-ins.
	Link_Clear();
	Link_Field(text, "code", g_sLinkCode, sizeof(g_sLinkCode));
	strcopy(g_sLinkKind, sizeof(g_sLinkKind), "mm");
	Link_Field(text, "team1", g_sLinkTeamName[0], sizeof(g_sLinkTeamName[]));
	Link_Field(text, "team2", g_sLinkTeamName[1], sizeof(g_sLinkTeamName[]));
	ReplaceString(g_sLinkTeamName[0], sizeof(g_sLinkTeamName[]), "{", "(");
	ReplaceString(g_sLinkTeamName[1], sizeof(g_sLinkTeamName[]), "{", "(");
	Format(g_sLinkTitle, sizeof(g_sLinkTitle), "Matchmaking: %s vs %s", g_sLinkTeamName[0], g_sLinkTeamName[1]);
	Format(g_sLinkRoster[0], sizeof(g_sLinkRoster[]), ",%s,", t1);
	Format(g_sLinkRoster[1], sizeof(g_sLinkRoster[]), ",%s,", t2);
	int n1, n2;
	Mm_RosterSizes(text, t1, t2, n1, n2);
	g_iMmRosterTotal = n1 + n2;
	g_iLinkBestOf = 1;
	g_iLinkMaxStandins = 0;
	g_iLinkMinRoster = n1 < n2 ? n1 : n2;
	g_LinkState = Link_Active;
	Match_SyncCoach();

	Maps_OnMatchStart();   // corta una votación de mapa en curso
	strcopy(g_sMmMap, sizeof(g_sMmMap), map);
	LogMessage("Matchmaking: sala %s tomada, mapa %s, %d jugadores.", lobby, map, g_iMmRosterTotal);
	if (!Mm_GoToMap())
	{
		Link_Arrange();
		Link_AnnounceSides();
		for (int i = 1; i <= MaxClients; i++)
			if (IsClientInGame(i) && Link_TeamOf(i))
				Mm_ReportClient("connected", i);
	}
}

// ---------------------------------------------------------------------------
// Reservas de torneo y PCW (2.9.0)
// ---------------------------------------------------------------------------

/** Poll con una reserva, fuera de un mapa en vivo (calentamiento o entre mapas). */
void Mm_OnBookingPoll(const char[] lobby, const char[] kind, const char[] text)
{
	char st[16], num[12];
	Link_Field(text, "status", st, sizeof(st));
	Link_Field(text, "map_no", num, sizeof(num));
	int mapNo = StringToInt(num);
	bool known = Mm_HasLobby() && StrEqual(lobby, g_sMmLobby);

	if (Mm_HasLobby() && !known)
		Mm_Release();

	if (StrEqual(st, "live"))
	{
		if (known && g_bMmBetween)
		{
			// Terminó el mapa y la base todavía no lo sumó. Si no llega, el mapa no contó: se vuelve a jugar.
			if (!g_bMmMapOverSent && GetTime() - g_iMmBetweenAt >= MM_DONE_WAIT)
			{
				g_bMmMapOverSent = true;
				Mm_Report("mapover", "El resultado del mapa no llego a la web");
			}
			return;
		}
		// La base lo tiene en vivo y acá no hay partida: el servidor se reinició en el medio. Se vuelve a jugar el mapa.
		strcopy(g_sMmLobby, sizeof(g_sMmLobby), lobby);
		strcopy(g_sMmKind, sizeof(g_sMmKind), kind);
		Mm_Report("mapover", "El servidor se reinicio durante el mapa");
		g_sMmLobby[0] = '\0';
		g_sMmKind[0] = '\0';
		return;
	}

	if (!known)
	{
		if (g_LinkState != Link_None || Maps_ChangePending())
			return;
		Mm_TakeBooking(lobby, kind, text, StrEqual(st, "assigned"));
		return;
	}

	// Entre mapas: cuando la base ya sumó el mapa (o lo dio por no jugado) y pasó la espera para SourceTV.
	if (g_bMmBetween)
	{
		if (GetTime() - g_iMmBetweenAt < g_cvSeriesDelay.IntValue)
			return;
		g_bMmBetween = false;
		g_bMmMapOverSent = false;
		Mm_ApplyBooking(text);
		char map[PLATFORM_MAX_PATH];
		Link_Field(text, "map", map, sizeof(map));
		g_iMmMapNo = mapNo;
		if (map[0] && IsMapValid(map))
		{
			strcopy(g_sMmMap, sizeof(g_sMmMap), map);
			QolChatAll("%s Serie %d-%d. Mapa %d: {#amarillo}%s{#normal}.", PREFIX, g_iLinkScore[0], g_iLinkScore[1], mapNo, map);
			// El mismo mapa (se vuelve a jugar): se recarga igual, para empezar de cero.
			ForceChangeLevel(g_sMmMap, "CMLeague: mapa siguiente de la serie");
		}
		else
			Mm_Close("El servidor no tiene el mapa siguiente de la serie");
		return;
	}

	// Calentamiento con la reserva tomada: planteles, mínimos y arranque automático.
	Mm_ApplyBooking(text);
	Link_Field(text, "auto_start", num, sizeof(num));
	if (StringToInt(num) == 1 && g_State == State_Warmup && License_Allows() && !Maps_ChangePending())
	{
		char why[256];
		if (Match_SidesOk(why, sizeof(why)))
		{
			QolChatAll("%s Se terminó la espera y están los dos equipos: la partida empieza.", PREFIX);
			StartMatch(0, g_cvReadyKnife.BoolValue);
		}
	}
}

/** Copia los datos de la reserva al vínculo: planteles, marcador de la serie, mínimos y la espera. */
void Mm_ApplyBooking(const char[] text)
{
	char before[2][1024], num[12];
	strcopy(before[0], sizeof(before[]), g_sLinkRoster[0]);
	strcopy(before[1], sizeof(before[]), g_sLinkRoster[1]);
	Link_Store(text);
	Link_Field(text, "min1", num, sizeof(num));
	g_iLinkMinTeam[0] = StringToInt(num);
	Link_Field(text, "min2", num, sizeof(num));
	g_iLinkMinTeam[1] = StringToInt(num);
	g_iMmRosterTotal = Link_MinRoster(1) + Link_MinRoster(2);
	Link_Field(text, "wait_seconds", num, sizeof(num));
	g_iMmWaitUntil = StringToInt(num) > 0 ? GetTime() + StringToInt(num) : 0;
	if (g_State == State_Warmup && (!StrEqual(before[0], g_sLinkRoster[0], false) || !StrEqual(before[1], g_sLinkRoster[1], false)))
	{
		Link_AdoptSides();
		Link_Arrange(true);
	}
}

/** Toma la reserva (o la retoma después de un reinicio: announce = false, sin "taken"). */
void Mm_TakeBooking(const char[] lobby, const char[] kind, const char[] text, bool announce)
{
	char map[PLATFORM_MAX_PATH], num[12], args[256];
	Link_Field(text, "map", map, sizeof(map));
	Link_Field(text, "map_no", num, sizeof(num));
	strcopy(g_sMmLobby, sizeof(g_sMmLobby), lobby);
	strcopy(g_sMmKind, sizeof(g_sMmKind), kind);
	g_bMmDone = false;
	g_bMmDoneAborted = false;
	g_bMmLive = false;
	g_bMmBetween = false;
	g_bMmMapOverSent = false;
	g_iMmMapNo = StringToInt(num);
	if (!map[0] || !IsMapValid(map))
	{
		LogError("Reserva %s: pide el mapa %s, que este servidor no tiene.", lobby, map);
		Mm_Close("El servidor no tiene el mapa");
		return;
	}
	if (announce)
		Mm_Report("taken", "");
	Mm_SaveLobby();

	Link_Field(text, "password", g_sMmPassword, sizeof(g_sMmPassword));
	Mm_SetPassword(g_sMmPassword);
	Format(args, sizeof(args), "\"p_uid\":\"mix-%s-%d\",\"p_password\":\"%s\",\"p_kind\":\"mix\",\"p_lobby\":\"%s\"", lobby, g_iMmMapNo, g_sMmPassword, lobby);
	Mm_Queue("csstv_mm_password", args);

	// El vínculo de !match, sin que nadie escriba ni confirme el código: lo dio la web.
	Link_Clear();
	Mm_ApplyBooking(text);
	g_LinkState = Link_Active;
	Match_SyncCoach();

	Maps_OnMatchStart();   // corta una votación de mapa en curso
	strcopy(g_sMmMap, sizeof(g_sMmMap), map);
	LogMessage("Reserva %s (%s) tomada: %s, mapa %d (%s).", lobby, kind, g_sLinkTitle, g_iMmMapNo, map);
	if (!Mm_GoToMap())
	{
		Link_Arrange();
		Link_AnnounceSides();
	}
}

/** Cada 30 s en el calentamiento de una reserva: cuánto falta de la espera. */
void Mm_WaitNag()
{
	if (!Mm_IsBooking() || g_bMmLive || g_bMmBetween || g_State != State_Warmup || GetTime() - g_iMmWaitNagAt < 30)
		return;
	g_iMmWaitNagAt = GetTime();
	int left = g_iMmWaitUntil - GetTime();
	if (left > 0)
		QolChatAll("%s {#amarillo}%s{#normal}: quedan %d:%02d de espera para que estén los dos equipos.", PREFIX, g_sLinkTitle, left / 60, left % 60);
	else if (StrEqual(g_sMmKind, "official"))
		QolChatAll("%s {#amarillo}%s{#normal}: se terminó la espera. Decide el organizador del torneo.", PREFIX, g_sLinkTitle);
}

/** Cambia al mapa de la sala si hace falta. true si lo está cambiando. */
bool Mm_GoToMap()
{
	char current[PLATFORM_MAX_PATH];
	GetCurrentMap(current, sizeof(current));
	if (StrEqual(current, g_sMmMap, false) || !IsMapValid(g_sMmMap))
		return false;
	ForceChangeLevel(g_sMmMap, "CMLeague: sala del matchmaking");
	return true;
}

/** Suelta la sala sin avisar a la base (ya no la tiene activa). */
void Mm_Release()
{
	Link_Clear();
	Mm_Forget();
}

void Mm_Forget()
{
	g_sMmLobby[0] = '\0';
	g_sMmMap[0] = '\0';
	g_sMmPassword[0] = '\0';
	g_bMmDone = false;
	g_bMmDoneAborted = false;
	g_bMmLive = false;
	g_iMmRosterTotal = 0;
	g_iMmUnlinked = 0;
	g_sMmKind[0] = '\0';
	g_iMmMapNo = 0;
	g_bMmBetween = false;
	g_bMmMapOverSent = false;
	g_iMmWaitUntil = 0;
	Mm_ReplaceReset();
	Mm_SaveLobby();
}

/**
 * Terminó la partida de la sala. reason vacío: hay resultado y la base la cierra al recibirlo. Con motivo: se
 * cancela. Siempre queda como terminada hasta que la base deje de devolverla.
 */
void Mm_Close(const char[] reason)
{
	if (reason[0])
		Mm_Report("abort", reason);
	g_bMmDone = true;
	g_bMmLive = false;
	g_iMmDoneAt = GetTime();
	g_bMmDoneAborted = reason[0] != '\0';
	g_iMmRosterTotal = 0;
	g_iMmUnlinked = 0;
	g_sMmPassword[0] = '\0';
	g_sMmMap[0] = '\0';
	g_sMmKind[0] = '\0';
	g_bMmBetween = false;
	g_iMmWaitUntil = 0;
	Mm_ReplaceReset();
	Mm_SaveLobby();
	Link_Clear();
	Mm_RotatePassword();
}

// ---------------------------------------------------------------------------
// Reemplazos (2.10.0, bitácora 2026-11-04-mm-reemplazos)
// ---------------------------------------------------------------------------

void Mm_ReplaceReset()
{
	g_bMmReplaceOk[0] = false;
	g_bMmReplaceOk[1] = false;
	g_sMmAway[0] = '\0';
	g_sMmJoined[0] = '\0';
	g_iMmVoteNextAt[0] = 0;
	g_iMmVoteNextAt[1] = 0;
	g_bMmVoteActive = false;
}

/** Cuenta como jugador para los reemplazos: los de verdad y, en la build de pruebas, también los bots. */
bool Mm_Counts(int client)
{
#if defined CSSTV_DEBUG
	return IsClientInGame(client) && !IsClientSourceTV(client);
#else
	return IsClientInGame(client) && !IsFakeClient(client);
#endif
}

/**
 * Con la sala en vivo, alguien con un SteamID válido que no es de la sala (de afuera, o el que abandonó y ya tiene
 * reemplazo). Sin SteamID válido (Steam todavía no lo validó) no se lo toca: podría ser uno de la sala.
 */
bool Mm_IsOutsider(int client)
{
	char key[40];
	return Mm_LiveSide(client) == 0 && Link_ClientKey(client, key, sizeof(key));
}

/** Cada segundo, con la sala en vivo: los que no son de la sala no juegan (un bot entra directo a un lado, sin jointeam). */
void Mm_LiveEnforce()
{
	if (Mm_LiveSide(0) == -1)
		return;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!Mm_Counts(i) || !IsTeamSide(GetClientTeam(i)) || !Mm_IsOutsider(i))
			continue;
		ChangeClientTeam(i, TEAM_SPEC);
		LogMessage("Matchmaking: %L no es de la sala %s, pasa a espectador.", i, g_sMmLobby);
		QolChat(i, "%s Es una sala del matchmaking: solo juegan los de la sala.", PREFIX);
	}
}

/** Del poll en vivo: si se puede pedir un reemplazo en cada equipo, cómo es el voto y quiénes están desconectados. */
void Mm_ReadReplace(const char[] text)
{
	char num[32], parts[3][8];
	Link_Field(text, "replace", num, sizeof(num));
	if (ExplodeString(num, ",", parts, 2, 8) == 2)
	{
		g_bMmReplaceOk[0] = StringToInt(parts[0]) == 1;
		g_bMmReplaceOk[1] = StringToInt(parts[1]) == 1;
	}
	else
	{
		// Base sin el replanteo 75: no hay reemplazos.
		g_bMmReplaceOk[0] = false;
		g_bMmReplaceOk[1] = false;
	}
	Link_Field(text, "replace_vote", num, sizeof(num));
	if (ExplodeString(num, ",", parts, 3, 8) == 3)
	{
		g_iMmVotePct = StringToInt(parts[0]);
		g_iMmVoteSeconds = StringToInt(parts[1]);
		g_iMmVoteCooldown = StringToInt(parts[2]);
	}
	Link_Field(text, "away", g_sMmAway, sizeof(g_sMmAway));
}

/**
 * En vivo, en una sala del matchmaking: el lado (CT o T) donde juega ahora el equipo de la sala del jugador, o 0 si no es de
 * la sala (alguien de afuera, o el que abandonó y ya tiene reemplazo). -1 si no aplica (no hay sala en vivo).
 */
int Mm_LiveSide(int client)
{
	if (!Mm_On() || !g_bMmLive || !Mm_HasLobby() || Mm_IsBooking() || g_LinkState != Link_Active || !g_iMatchLinkSideA
		|| !MatchInProgress())
		return -1;
	if (client <= 0)
		return 0;   // Mm_LiveSide(0): solo pregunta si hay sala en vivo
	int k = Link_TeamOf(client);
	if (!k)
		return 0;
	return k == g_iMatchLinkSideA ? g_iSideA : OtherSide(g_iSideA);
}

/**
 * Poll en vivo: si el plantel cambió (entró un reemplazo), se actualiza sin mp_restartgame. El reemplazo que ya está en el
 * servidor va al lado de su equipo y se avisa a la base; el reemplazado que volvió pasa a espectador.
 */
void Mm_LiveRoster(const char[] text)
{
	char t1[1024], t2[1024], r1[1024], r2[1024];
	Link_Field(text, "t1", t1, sizeof(t1));
	Link_Field(text, "t2", t2, sizeof(t2));
	if (!t1[0] || !t2[0])
		return;   // base vieja o respuesta incompleta: el plantel no se toca
	Format(r1, sizeof(r1), ",%s,", t1);
	Format(r2, sizeof(r2), ",%s,", t2);
	if (StrEqual(r1, g_sLinkRoster[0], false) && StrEqual(r2, g_sLinkRoster[1], false))
		return;
	Mm_NoteJoined(t1, g_sLinkRoster[0]);
	Mm_NoteJoined(t2, g_sLinkRoster[1]);
	strcopy(g_sLinkRoster[0], sizeof(g_sLinkRoster[]), r1);
	strcopy(g_sLinkRoster[1], sizeof(g_sLinkRoster[]), r2);
	// (Puede ser el mismo plantel en otro orden: entonces nadie se mueve y no se anota nada.)
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!Mm_Counts(i))
			continue;
		int side = Mm_LiveSide(i), team = GetClientTeam(i);
		if (side > 0 && !IsTeamSide(team))
		{
			MoveToTeam(i, side);
			LogMessage("Matchmaking: %L entró de reemplazo en la sala %s.", i, g_sMmLobby);
			QolChatAll("%s {#amarillo}%N{#normal} entró de reemplazo en {#amarillo}%s{#normal}.", PREFIX, i, g_sTeam[side == g_iSideA ? 0 : 1]);
			Mm_ReportClient("back", i);
		}
		else if (IsTeamSide(team) && Mm_IsOutsider(i))
		{
			ChangeClientTeam(i, TEAM_SPEC);
			LogMessage("Matchmaking: %L ya tiene reemplazo en la sala %s, pasa a espectador.", i, g_sMmLobby);
			QolChat(i, "%s Entró un reemplazo en tu lugar: quedás de espectador.", PREFIX);
		}
	}
}

/** Anota los SteamID de list que no estaban en el plantel anterior (old: ",a,b,"): son reemplazos. */
void Mm_NoteJoined(const char[] list, const char[] old)
{
	char keys[12][40], needle[48];
	int n = ExplodeString(list, ",", keys, sizeof(keys), sizeof(keys[]));
	for (int i = 0; i < n; i++)
	{
		Format(needle, sizeof(needle), ",%s,", keys[i]);
		if (keys[i][0] && StrContains(old, needle, false) == -1 && StrContains(g_sMmJoined, needle, false) == -1)
			Format(g_sMmJoined, sizeof(g_sMmJoined), "%s%s,", g_sMmJoined[0] ? g_sMmJoined : ",", keys[i]);
	}
}

/** ¿Entró a la sala con la partida en vivo (un reemplazo)? */
bool Mm_IsReplacement(int client)
{
	char key[40], needle[48];
	if (!g_sMmJoined[0] || !Link_ClientKey(client, key, sizeof(key)))
		return false;
	Format(needle, sizeof(needle), ",%s,", key);
	return StrContains(g_sMmJoined, needle, false) != -1;
}

/** ¿Hay alguien en el servidor con este SteamID (STEAM_0:X:Y)? */
bool Mm_KeyInGame(const char[] key)
{
	char k[40];
	for (int i = 1; i <= MaxClients; i++)
		if (Mm_Counts(i) && Link_ClientKey(i, k, sizeof(k)) && StrEqual(k, key, false))
			return true;
	return false;
}

/** Suma al menú los compañeros desconectados del equipo k de la sala. Devuelve cuántos. */
int Mm_AwayItems(int k, Menu menu)
{
	char entries[10][96], f[3][40];
	int n, count = ExplodeString(g_sMmAway, ";", entries, sizeof(entries), sizeof(entries[]));
	for (int e = 0; e < count; e++)
	{
		if (ExplodeString(entries[e], "|", f, 3, sizeof(f[])) != 3 || StringToInt(f[1]) != k || Mm_KeyInGame(f[0]))
			continue;
		ReplaceString(f[2], sizeof(f[]), "{", "(");
		menu.AddItem(f[0], f[2][0] ? f[2] : f[0]);
		n++;
	}
	return n;
}

/** Mensaje a los compañeros del equipo k de la sala que están en el servidor. */
void Mm_TeamChat(int k, const char[] fmt, any ...)
{
	char buf[256];
	VFormat(buf, sizeof(buf), fmt, 3);
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && !IsFakeClient(i) && Link_TeamOf(i) == k)
			QolChat(i, "%s", buf);
}

/** ¿Este jugador puede pedir un voto ahora? Si no, le dice por qué. Devuelve el equipo de la sala (0 si no puede). */
int Mm_CanCallReplace(int client)
{
	if (!Mm_On() || !Mm_HasLobby() || Mm_IsBooking() || !g_bMmLive || !MatchInProgress())
	{
		QolChat(client, "%s {#amarillo}!callreplace{#normal} sirve en una sala del matchmaking en juego.", PREFIX);
		return 0;
	}
	int k = Link_TeamOf(client);
	if (!k || !IsTeamSide(GetClientTeam(client)))
	{
		QolChat(client, "%s Solo los jugadores de la sala pueden pedir un reemplazo.", PREFIX);
		return 0;
	}
	if (!g_bMmReplaceOk[k - 1])
	{
		QolChat(client, "%s Ahora no se puede pedir un reemplazo para tu equipo: ya hay uno pedido, falta poco para el final o los reemplazos están apagados.", PREFIX);
		return 0;
	}
	if (g_bMmVoteActive || IsVoteInProgress())
	{
		QolChat(client, "%s Ya hay un voto en curso.", PREFIX);
		return 0;
	}
	int wait = g_iMmVoteNextAt[k - 1] - GetTime();
	if (wait > 0)
	{
		QolChat(client, "%s Tu equipo tiene que esperar %d s para otro voto.", PREFIX, wait);
		return 0;
	}
	return k;
}

public Action Cmd_MmCallReplace(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	int k = Mm_CanCallReplace(client);
	if (!k)
		return Plugin_Handled;
	Menu menu = new Menu(Menu_MmCallReplace);
	menu.SetTitle("¿A quién hay que reemplazar?");
	if (!Mm_AwayItems(k, menu))
	{
		delete menu;
		QolChat(client, "%s No hay ningún compañero desconectado.", PREFIX);
		return Plugin_Handled;
	}
	menu.Display(client, 20);
	return Plugin_Handled;
}

public int Menu_MmCallReplace(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
		delete menu;
	else if (action == MenuAction_Select)
	{
		char key[40], nick[40];
		menu.GetItem(item, key, sizeof(key), _, nick, sizeof(nick));
		Mm_StartReplaceVote(client, key, nick);
	}
	return 0;
}

#if defined CSSTV_DEBUG
/** Pruebas: "lados=Arnold=3;Albert=3;…" con el equipo actual de cada uno. */
public Action Cmd_MmSides(int client, int args)
{
	char out[512];
	strcopy(out, sizeof(out), "lados=");
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && !IsClientSourceTV(i))
			Format(out, sizeof(out), "%s%N=%d;", out, i, GetClientTeam(i));
	ReplyToCommand(client, "%s", out);
	return Plugin_Handled;
}

/** Pruebas: un bot pide el reemplazo de un compañero desconectado, como si hubiera elegido en el menú. */
public Action Cmd_MmCallReplaceAs(int client, int args)
{
	char who[MAX_NAME_LENGTH], target[40], entries[10][96], f[3][40];
	GetCmdArg(1, who, sizeof(who));
	GetCmdArg(2, target, sizeof(target));
	int bot = FindTarget(client, who, false, false);
	if (bot <= 0)
		return Plugin_Handled;
	int count = ExplodeString(g_sMmAway, ";", entries, sizeof(entries), sizeof(entries[]));
	for (int e = 0; e < count; e++)
	{
		if (ExplodeString(entries[e], "|", f, 3, sizeof(f[])) == 3 && (StrEqual(f[2], target, false) || StrEqual(f[0], target, false)))
		{
			Mm_StartReplaceVote(bot, f[0], f[2]);
			return Plugin_Handled;
		}
	}
	ReplyToCommand(client, "[csstv] %s no está entre los desconectados (away=%s).", target, g_sMmAway);
	return Plugin_Handled;
}
#endif

/** El voto Sí/No entre los compañeros conectados del que falta (Daniel, 2026-11-05: solo su equipo). */
void Mm_StartReplaceVote(int client, const char[] key, const char[] nick)
{
	int k = Mm_CanCallReplace(client);
	if (!k)
		return;
	if (Mm_KeyInGame(key))
	{
		QolChat(client, "%s {#amarillo}%s{#normal} ya volvió.", PREFIX, nick);
		return;
	}
	int voters[MAXPLAYERS], n, bots;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!Mm_Counts(i) || Link_TeamOf(i) != k || !IsTeamSide(GetClientTeam(i)))
			continue;
		if (IsFakeClient(i))
			bots++;   // solo en la build de pruebas (Mm_Counts): votan Sí solos
		else
			voters[n++] = i;
	}
	g_iMmVoteTeam = k;
	g_iMmVoteBots = bots;
	// La espera del equipo corre desde que se pide el voto, pase o no (también con solo bots, en la build de pruebas).
	g_iMmVoteNextAt[k - 1] = GetTime() + g_iMmVoteSeconds + g_iMmVoteCooldown;
	strcopy(g_sMmVoteKey, sizeof(g_sMmVoteKey), key);
	strcopy(g_sMmVoteNick, sizeof(g_sMmVoteNick), nick);
	if (!n)
	{
		if (bots)
			Mm_ReplaceVoteEnd(bots, bots);   // build de pruebas: solo bots en el equipo
		return;
	}
	Menu vote = new Menu(Menu_MmReplaceVote, MENU_ACTIONS_DEFAULT);
	vote.VoteResultCallback = Mm_ReplaceVoteResult;
	vote.SetTitle("¿Pedir un reemplazo para %s?", nick);
	vote.AddItem("yes", "Sí");
	vote.AddItem("no", "No");
	vote.ExitButton = false;
	g_bMmVoteActive = true;
	g_iMmVoteVoters = n;
	if (!vote.DisplayVote(voters, n, g_iMmVoteSeconds > 0 ? g_iMmVoteSeconds : 30))
	{
		delete vote;
		g_bMmVoteActive = false;
		QolChat(client, "%s No se pudo abrir el voto.", PREFIX);
		return;
	}
	Mm_TeamChat(k, "%s {#amarillo}%N{#normal} pidió un reemplazo para {#amarillo}%s{#normal}. Votá en el menú: hace falta más del %d %% del equipo.",
		PREFIX, client, nick, g_iMmVotePct);
}

public int Menu_MmReplaceVote(Menu menu, MenuAction action, int param1, int param2)
{
	if (action == MenuAction_VoteCancel && g_bMmVoteActive)
	{
		g_bMmVoteActive = false;
		Mm_ReplaceVoteEnd(g_iMmVoteBots, g_iMmVoteVoters + g_iMmVoteBots);   // nadie votó: todos cuentan como No
	}
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

public void Mm_ReplaceVoteResult(Menu menu, int num_votes, int num_clients, const int[][] client_info, int num_items, const int[][] item_info)
{
	if (!g_bMmVoteActive)
		return;
	g_bMmVoteActive = false;
	int yes;
	for (int i = 0; i < num_items; i++)
		if (item_info[i][VOTEINFO_ITEM_INDEX] == 0)
			yes = item_info[i][VOTEINFO_ITEM_VOTES];
	Mm_ReplaceVoteEnd(yes + g_iMmVoteBots, (num_clients > g_iMmVoteVoters ? num_clients : g_iMmVoteVoters) + g_iMmVoteBots);
}

/** Pasa con más de replace_vote_pct de los que podían votar; el que no votó cuenta como No. */
void Mm_ReplaceVoteEnd(int yes, int voters)
{
	int k = g_iMmVoteTeam;
	if (!g_bMmLive || !Mm_HasLobby() || k < 1 || k > 2)
		return;
	if (voters <= 0 || yes * 100 <= g_iMmVotePct * voters)
	{
		Mm_TeamChat(k, "%s No pasó el voto para reemplazar a {#amarillo}%s{#normal} (%d de %d).", PREFIX, g_sMmVoteNick, yes, voters);
		return;
	}
	if (Mm_KeyInGame(g_sMmVoteKey))
	{
		Mm_TeamChat(k, "%s {#amarillo}%s{#normal} volvió: no se pide el reemplazo.", PREFIX, g_sMmVoteNick);
		return;
	}
	Mm_Report("callreplace", g_sMmVoteKey);
	g_bMmReplaceOk[k - 1] = false;
	g_iMmLastPoll = 0;   // el poll siguiente trae el estado nuevo
	QolChatAll("%s Pasó el voto: se busca un reemplazo para {#amarillo}%s{#normal}. Si alguien toma el link, entra a este equipo.", PREFIX, g_sMmVoteNick);
}

// ---------------------------------------------------------------------------
// Avisos desde el reporter
// ---------------------------------------------------------------------------

/** StartMatch: la sala pasa a en vivo. */
void Mm_OnMatchStart()
{
	if (!Mm_On() || !Mm_HasLobby())
		return;
	g_bMmLive = true;
	g_bMmBetween = false;
	g_iMmAbandons[0] = 0;
	g_iMmAbandons[1] = 0;
	Mm_ReplaceReset();
	Mm_Report("live", "");
}

/**
 * FinishMatch y CancelMatch. Un mix suelto en un servidor del matchmaking también rota la contraseña.
 * Reserva: el servidor no se suelta; queda esperando el mapa siguiente (o el mismo, si este no contó).
 */
void Mm_OnMatchOver(const char[] cancelReason)
{
	if (!Mm_On())
		return;
	if (Mm_IsBooking())
	{
		g_bMmLive = false;
		g_bMmBetween = true;
		g_bMmMapOverSent = false;
		g_iMmBetweenAt = GetTime();
		if (cancelReason[0])
		{
			g_bMmMapOverSent = true;
			Mm_Report("mapover", cancelReason);
		}
		return;
	}
	if (Mm_HasLobby())
		Mm_Close(cancelReason);
	else
		Mm_RotatePassword();
}

void Mm_OnClientJoin(int client)
{
	if (!Mm_On() || !Mm_HasLobby() || Mm_IsBooking() || !Link_TeamOf(client))
		return;
	Mm_ReportClient(g_bMmLive ? "back" : "connected", client);
}

void Mm_OnClientLeave(int client)
{
	if (!Mm_On() || !g_bMmLive || !Mm_HasLobby() || Mm_IsBooking() || !IsClientInGame(client) || !Link_TeamOf(client))
		return;
	Mm_ReportClient("left", client);
}

void Mm_ReportClient(const char[] event, int client)
{
	char key[40];
	if (Link_ClientKey(client, key, sizeof(key)))
		Mm_Report(event, key);
}

/** data: sin comillas ni barras (SteamID o un motivo escrito acá). */
void Mm_Report(const char[] event, const char[] data)
{
	char args[256];
	Format(args, sizeof(args), "\"p_lobby\":\"%s\",\"p_event\":\"%s\"", g_sMmLobby, event);
	if (data[0])
		Format(args, sizeof(args), "%s,\"p_data\":\"%s\"", args, data);
	Mm_Queue("csstv_mm_report", args);
}

// ---------------------------------------------------------------------------
// Cola de avisos
// ---------------------------------------------------------------------------

void Mm_Queue(const char[] rpc, const char[] args)
{
	char entry[MM_OUT_MAX];
	Format(entry, sizeof(entry), "%s|%s", rpc, args);
	g_hMmOut.PushString(entry);
}

void Mm_FlushOut()
{
	if (g_bMmOutBusy || g_hMmOut.Length == 0 || GetTime() < g_iMmOutRetryAt)
		return;
	char entry[MM_OUT_MAX], url[256], token[128], body[MM_OUT_MAX + 160];
	g_hMmOut.GetString(0, entry, sizeof(entry));
	int sep = FindCharInString(entry, '|');
	if (sep == -1)
	{
		g_hMmOut.Erase(0);
		return;
	}
	entry[sep] = '\0';
	if (!Mm_RpcUrl(entry, url, sizeof(url)))
		return;
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);
	Format(body, sizeof(body), "{\"p_token\":\"%s\",%s}", token, entry[sep + 1]);
	System2HTTPRequest req = Mm_Request(Mm_OnOut, url, body);
	req.POST();
	delete req;
	g_bMmOutBusy = true;
}

public void Mm_OnOut(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	g_bMmOutBusy = false;
	int status = success && response != null ? response.StatusCode : 0;
	char entry[MM_OUT_MAX];
	if (g_hMmOut.Length > 0)
		g_hMmOut.GetString(0, entry, sizeof(entry));
	bool idle = g_sMmIdleUid[0] && StrContains(entry, g_sMmIdleUid) != -1;

	if (status >= 200 && status < 300)
	{
		g_hMmOut.Erase(0);
		g_iMmOutRetryAt = 0;
		if (idle)
		{
			g_bMmIdlePending = false;
			g_bMmIdleQueued = false;
			Mm_SaveIdle();
		}
		return;
	}
	// Solo el nombre de la función: los argumentos pueden llevar la contraseña.
	int sep = FindCharInString(entry, '|');
	if (sep != -1)
		entry[sep] = '\0';
	char detail[192];
	if (status == 0)
		strcopy(detail, sizeof(detail), error);
	else if (response != null)
		response.GetContent(detail, sizeof(detail));
	if (status >= 400 && status < 500 && status != 408 && status != 429)
	{
		LogError("%s rechazado (HTTP %d): %s", entry, status, detail);
		g_hMmOut.Erase(0);
		if (idle)
			g_bMmIdleQueued = false;
		g_iMmOutRetryAt = GetTime() + MM_RETRY_SECONDS;
		return;
	}
	LogError("%s: error transitorio (%d), se reintenta: %s", entry, status, detail);
	g_iMmOutRetryAt = GetTime() + MM_RETRY_SECONDS;
}
