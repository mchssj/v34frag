/**
 * !match: vincular el mix a una partida de torneo o PCW de la web
 * (plan: docs/bitacora/2026-10-15-match-y-status).
 *
 *  - !match <código>: un jugador inscrito en uno de los dos equipos propone; uno del otro equipo
 *    confirma escribiendo el mismo código. Un admin vincula solo. Solo en el calentamiento.
 *  - !match: desvincula (inscritos de los dos equipos o admin). Durante la partida, el juego se
 *    guarda como mix común.
 *  - Con el vínculo activo, cada inscrito va al lado de su equipo y no puede pasarse al rival; el
 *    resto va a espectador y entra solo al lado de su equipo, con tope de 5 por lado y de
 *    stand-ins (2 en PCW, ninguno en torneo). !ready no arranca hasta que cada lado cumple.
 *  - Al terminar, el resultado lleva link_code y link_side_a (qué equipo de la partida fue el
 *    equipo A). La base lo verifica y suma el mapa a la partida.
 *  - El vínculo sigue entre mapas (series BO3/BO5) hasta que la serie termina o se desvincula.
 *
 * Los datos salen de csstv_match_lookup (texto clave=valor, el plugin no tiene lector de JSON);
 * los planteles vienen como STEAM_0:X:Y.
 */

#if defined _csstv_match_included
	#endinput
#endif
#define _csstv_match_included

#define LINK_MAX_SIDE 5

enum LinkState
{
	Link_None = 0,
	Link_Pending,   // propuesto por un equipo, falta que confirme el otro
	Link_Active
};

LinkState g_LinkState = Link_None;
char g_sLinkCode[8];
char g_sLinkKind[12];             // official | pcw
char g_sLinkTitle[160];           // "PCW: Simbations vs Strix" / "Titan · Final: Alfa vs Beta"
char g_sLinkTeamName[2][48];      // [0] = team1 de la partida, [1] = team2
char g_sLinkRoster[2][1024];      // ",STEAM_0:X:Y,STEAM_0:X:Y," (con comas en los bordes)
int g_iLinkBestOf = 1;
int g_iLinkScore[2];
int g_iLinkMaxStandins;
int g_iLinkMinRoster;
int g_iLinkProposer;              // equipo (1 o 2) de quien propuso
int g_iLinkCtTeam = 1;            // equipo de la partida (1 o 2) que juega de CT en el calentamiento

// Consulta a la base en curso (una a la vez).
bool g_bLookupBusy;
int g_iLookupUser;                // userid de quien escribió !match (0 = refresco automático)
int g_iReadyBlockedAt;            // GetTime() del último aviso de "todavía no puede empezar"

void Match_Init()
{
	RegConsoleCmd("sm_match", Cmd_Match, "Vincular este mix a una partida de torneo o PCW: !match <código>. Sin código: desvincular.");
	AddCommandListener(Cmd_MatchJoinTeam, "jointeam");
}

/** Lo que vive solo durante una partida (lo llama ResetMatch). El vínculo en sí sigue. */
void Match_Reset()
{
	g_sMatchLinkCode[0] = '\0';
	g_iMatchLinkSideA = 0;
	g_iReadyBlockedAt = 0;
}

// ---------------------------------------------------------------------------
// Identidad de los jugadores
// ---------------------------------------------------------------------------

/** STEAM_0:X:Y del jugador (también el falso de los bots en la build de pruebas). false si no hay. */
bool Link_ClientKey(int client, char[] key, int maxlen)
{
	if (!Stats_ClientKey(client, key, maxlen) || StrContains(key, "STEAM_", false) != 0 || strlen(key) < 10)
		return false;
	key[6] = '0';   // STEAM_1:… y STEAM_0:… son el mismo jugador
	return true;
}

/** Equipo de la partida (1 o 2) en cuyo plantel está el jugador; 0 si en ninguno. */
int Link_TeamOf(int client)
{
	char key[40], needle[48];
	if (!Link_ClientKey(client, key, sizeof(key)))
		return 0;
	Format(needle, sizeof(needle), ",%s,", key);
	for (int k = 0; k < 2; k++)
		if (StrContains(g_sLinkRoster[k], needle, false) != -1)
			return k + 1;
	return 0;
}

/** Lado (CT o T) del equipo k de la partida. */
int Link_SideOf(int k)
{
	return k == g_iLinkCtTeam ? TEAM_CT : TEAM_T;
}

/** Equipo de la partida que juega en el lado side. */
int Link_TeamOfSide(int side)
{
	return side == TEAM_CT ? g_iLinkCtTeam : 3 - g_iLinkCtTeam;
}

bool Link_IsAdmin(int client)
{
	return client > 0 && CheckCommandAccess(client, "sm_live", ADMFLAG_GENERIC);
}

/** Jugadores en el lado side (sin contar a except). standins: solo los que no son del plantel de ese lado. */
int Link_SideCount(int side, int except = 0, bool standins = false)
{
	int n, k = Link_TeamOfSide(side);
	for (int i = 1; i <= MaxClients; i++)
	{
		if (i == except || !IsClientInGame(i) || IsClientSourceTV(i) || GetClientTeam(i) != side)
			continue;
		if (IsFakeClient(i) && !g_cvIncludeBots.BoolValue)
			continue;
		if (!standins || Link_TeamOf(i) != k)
			n++;
	}
	return n;
}

// ---------------------------------------------------------------------------
// !match
// ---------------------------------------------------------------------------

public Action Cmd_Match(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (!License_Allows())
	{
		License_Reply(client);
		return Plugin_Handled;
	}

	if (args == 0)
	{
		Link_RequestUnlink(client);
		return Plugin_Handled;
	}

	char code[16];
	GetCmdArg(1, code, sizeof(code));
	if (!Link_NormalizeCode(code))
	{
		QolReply(client, "[%s] El código tiene 5 letras o números (lo ves en la partida, en la web).", g_sTag);
		return Plugin_Handled;
	}
	if (g_State != State_Warmup)
	{
		QolReply(client, "[%s] Solo se puede vincular antes de empezar la partida.", g_sTag);
		return Plugin_Handled;
	}
	if (g_LinkState == Link_Active)
	{
		if (StrEqual(code, g_sLinkCode))
			QolReply(client, "[%s] Ya está vinculado a {#amarillo}%s{#normal}.", g_sTag, g_sLinkTitle);
		else
			QolReply(client, "[%s] Ya está vinculado a {#amarillo}%s{#normal}. Escribí !match para desvincular primero.", g_sTag, g_sLinkTitle);
		return Plugin_Handled;
	}
	Link_Lookup(code, GetClientUserId(client));
	return Plugin_Handled;
}

/** Deja el código en mayúsculas; false si no tiene la forma de un código. */
bool Link_NormalizeCode(char[] code)
{
	TrimString(code);
	int n = strlen(code);
	if (n != 5)
		return false;
	for (int i = 0; i < n; i++)
	{
		code[i] = CharToUpper(code[i]);
		if (!IsCharAlpha(code[i]) && !IsCharNumeric(code[i]))
			return false;
	}
	return true;
}

void Link_RequestUnlink(int client)
{
	if (g_LinkState == Link_None)
	{
		QolReply(client, "[%s] No hay ninguna partida vinculada. Para vincular: !match <código>.", g_sTag);
		return;
	}
	if (!Link_IsAdmin(client) && !Link_TeamOf(client))
	{
		QolReply(client, "[%s] Solo un jugador de %s o de %s (o un admin) puede desvincular.", g_sTag, g_sLinkTeamName[0], g_sLinkTeamName[1]);
		return;
	}
	char who[MAX_NAME_LENGTH];
	GetClientName(client, who, sizeof(who));
	if (MatchInProgress())
	{
		g_sMatchLinkCode[0] = '\0';
		Link_Clear();
		QolChatAll("%s {#amarillo}%s{#normal} desvinculó la partida: al terminar se guarda como un mix común.", PREFIX, who);
		return;
	}
	Link_Clear();
	QolChatAll("%s {#amarillo}%s{#normal} desvinculó la partida: se juega como un mix común y los equipos son libres.", PREFIX, who);
}

void Link_Clear()
{
	g_LinkState = Link_None;
	g_sLinkCode[0] = '\0';
	g_sLinkTitle[0] = '\0';
	g_sLinkKind[0] = '\0';
	g_iLinkProposer = 0;
	g_iLinkCtTeam = 1;
	for (int k = 0; k < 2; k++)
	{
		g_sLinkTeamName[k][0] = '\0';
		g_sLinkRoster[k][0] = '\0';
		g_iLinkScore[k] = 0;
	}
}

// ---------------------------------------------------------------------------
// Consulta a la base (csstv_match_lookup)
// ---------------------------------------------------------------------------

void Link_Lookup(const char[] code, int userid)
{
	int client = userid ? GetClientOfUserId(userid) : 0;
	if (g_bLookupBusy)
	{
		if (client)
			QolReply(client, "[%s] Hay una consulta en curso: probá de nuevo en unos segundos.", g_sTag);
		return;
	}
	if (!Http_Available() || !Http_Configured())
	{
		if (client)
			QolReply(client, "[%s] El servidor no puede consultar la web (System2 o la configuración de CSSTV).", g_sTag);
		return;
	}
	char url[256], key[512], token[128], body[256];
	g_cvApiUrl.GetString(url, sizeof(url));
	int rpc = StrContains(url, "/rpc/", false);
	if (rpc == -1)
		return;
	url[rpc + 5] = '\0';
	StrCat(url, sizeof(url), "csstv_match_lookup");
	g_cvApiKey.GetString(key, sizeof(key));
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);
	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_code\":\"%s\"}", token, code);

	System2HTTPRequest req = new System2HTTPRequest(Link_OnLookup, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CSSTV-Reporter/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 15;
	req.POST();
	delete req;
	g_bLookupBusy = true;
	g_iLookupUser = userid;
	if (client)
		QolReply(client, "[%s] Buscando la partida %s…", g_sTag, code);
}

public void Link_OnLookup(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	g_bLookupBusy = false;
	int userid = g_iLookupUser;
	int client = userid ? GetClientOfUserId(userid) : 0;
	int status = success && response != null ? response.StatusCode : 0;
	char text[4096];
	if (response != null)
		response.GetContent(text, sizeof(text));

	if (status != 200)
	{
		LogError("csstv_match_lookup: %s %s", status ? "HTTP" : "sin conexión", status ? text : error);
		if (client)
			QolReply(client, "[%s] No se pudo consultar la web (%s). Probá de nuevo.", g_sTag, status ? "error del servidor" : "sin conexión");
		return;
	}
	Link_UnescapeJsonString(text);

	char ok[4], err[160];
	Link_Field(text, "ok", ok, sizeof(ok));
	if (!StrEqual(ok, "1"))
	{
		Link_Field(text, "error", err, sizeof(err));
		if (userid == 0)
		{
			// Refresco automático (cambio de mapa o fin de un juego): la serie ya no está abierta.
			if (g_LinkState == Link_Active)
			{
				QolChatAll("%s La partida vinculada ({#amarillo}%s{#normal}) ya no está abierta: %s. Se desvincula.", PREFIX, g_sLinkTitle, err);
				Link_Clear();
			}
			return;
		}
		if (client)
			QolReply(client, "[%s] %s.", g_sTag, err[0] ? err : "No se encontró la partida");
		return;
	}

	if (userid == 0)
	{
		if (g_LinkState == Link_Active)
		{
			Link_Store(text);   // marcador de la serie y planteles al día
			// Mapa siguiente de la serie (o vuelta al calentamiento): cada equipo sigue en el lado donde
			// quedó (después del medio tiempo suele ser el otro) y se acomoda a los inscritos sueltos.
			if (g_State == State_Warmup)
			{
				Link_AdoptSides();
				Link_Arrange(true);
				Link_AnnounceSides();
			}
		}
		return;
	}
	if (client)
		Link_OnProposal(client, text);
}

/** Copia los datos de la consulta al vínculo. */
void Link_Store(const char[] text)
{
	char num[12], list[1024];
	Link_Field(text, "code", g_sLinkCode, sizeof(g_sLinkCode));
	Link_Field(text, "kind", g_sLinkKind, sizeof(g_sLinkKind));
	Link_Field(text, "title", g_sLinkTitle, sizeof(g_sLinkTitle));
	ReplaceString(g_sLinkTitle, sizeof(g_sLinkTitle), "{", "(");   // que un nombre no pueda meter colores
	Link_Field(text, "team1", g_sLinkTeamName[0], sizeof(g_sLinkTeamName[]));
	Link_Field(text, "team2", g_sLinkTeamName[1], sizeof(g_sLinkTeamName[]));
	ReplaceString(g_sLinkTeamName[0], sizeof(g_sLinkTeamName[]), "{", "(");
	ReplaceString(g_sLinkTeamName[1], sizeof(g_sLinkTeamName[]), "{", "(");
	for (int k = 0; k < 2; k++)
	{
		Link_Field(text, k == 0 ? "t1" : "t2", list, sizeof(list));
		Format(g_sLinkRoster[k], sizeof(g_sLinkRoster[]), ",%s,", list);
		Link_Field(text, k == 0 ? "score1" : "score2", num, sizeof(num));
		g_iLinkScore[k] = StringToInt(num);
	}
	Link_Field(text, "best_of", num, sizeof(num));
	g_iLinkBestOf = StringToInt(num) > 0 ? StringToInt(num) : 1;
	Link_Field(text, "max_standins", num, sizeof(num));
	g_iLinkMaxStandins = StringToInt(num);
	Link_Field(text, "min_roster", num, sizeof(num));
	g_iLinkMinRoster = StringToInt(num);
}

void Link_OnProposal(int client, const char[] text)
{
	if (g_State != State_Warmup)
	{
		QolReply(client, "[%s] La partida ya empezó: solo se puede vincular antes.", g_sTag);
		return;
	}
	char code[8];
	Link_Field(text, "code", code, sizeof(code));
	bool admin = Link_IsAdmin(client);

	// Equipo de quien escribió, según los planteles de esta consulta.
	char t1[1024], t2[1024], mine[40], needle[48];
	Link_Field(text, "t1", t1, sizeof(t1));
	Link_Field(text, "t2", t2, sizeof(t2));
	Format(t1, sizeof(t1), ",%s,", t1);
	Format(t2, sizeof(t2), ",%s,", t2);
	int k;
	if (Link_ClientKey(client, mine, sizeof(mine)))
	{
		Format(needle, sizeof(needle), ",%s,", mine);
		k = StrContains(t1, needle, false) != -1 ? 1 : (StrContains(t2, needle, false) != -1 ? 2 : 0);
	}

	char who[MAX_NAME_LENGTH];
	GetClientName(client, who, sizeof(who));

	if (g_LinkState == Link_Pending && StrEqual(code, g_sLinkCode))
	{
		if (admin || (k && k != g_iLinkProposer))
		{
			Link_Store(text);
			Link_Activate(who);
			return;
		}
		if (!k)
			QolReply(client, "[%s] Solo puede confirmar un jugador inscrito en {#amarillo}%s{#normal}.", g_sTag, g_sLinkTeamName[2 - g_iLinkProposer]);
		else
			QolReply(client, "[%s] Ya lo propuso tu equipo: falta que confirme alguien de {#amarillo}%s{#normal} con !match %s.", g_sTag,
				g_sLinkTeamName[2 - g_iLinkProposer], g_sLinkCode);
		return;
	}

	// Propuesta nueva (reemplaza a una pendiente con otro código).
	if (!admin && !k)
	{
		char n1[48], n2[48];
		Link_Field(text, "team1", n1, sizeof(n1));
		Link_Field(text, "team2", n2, sizeof(n2));
		QolReply(client, "[%s] Solo pueden vincular jugadores inscritos en %s o en %s (o un admin).", g_sTag, n1, n2);
		return;
	}
	Link_Store(text);
	if (admin)
	{
		Link_Activate(who);
		return;
	}
	g_LinkState = Link_Pending;
	g_iLinkProposer = k;
	QolChatAll("%s {#amarillo}%s{#normal} (%s) propone jugar {#amarillo}%s{#normal}. Para confirmar, alguien de {#amarillo}%s{#normal} escribe !match %s.",
		PREFIX, who, g_sLinkTeamName[k - 1], g_sLinkTitle, g_sLinkTeamName[2 - k], g_sLinkCode);
}

void Link_Activate(const char[] by)
{
	g_LinkState = Link_Active;
	g_iLinkProposer = 0;
	g_iLinkCtTeam = 1;
	Link_Arrange();
	QolChatAll("%s Vinculado a {#amarillo}%s{#normal} (BO%d, serie %d-%d), confirmado por %s.", PREFIX,
		g_sLinkTitle, g_iLinkBestOf, g_iLinkScore[0], g_iLinkScore[1], by);
	Link_AnnounceSides();
}

void Link_AnnounceSides()
{
	if (g_iLinkMaxStandins > 0)
		QolChatAll("%s {#amarillo}%s{#normal} juega de %s y {#amarillo}%s{#normal} de %s. Stand-ins: entren al lado de su equipo (hasta %d por lado, %d jugadores en total).",
			PREFIX, g_sLinkTeamName[g_iLinkCtTeam - 1], "{#ct}CT{#normal}", g_sLinkTeamName[2 - g_iLinkCtTeam], "{#t}T{#normal}",
			g_iLinkMaxStandins, LINK_MAX_SIDE);
	else
		QolChatAll("%s {#amarillo}%s{#normal} juega de %s y {#amarillo}%s{#normal} de %s. Partida de torneo: solo juegan los inscritos de cada equipo.",
			PREFIX, g_sLinkTeamName[g_iLinkCtTeam - 1], "{#ct}CT{#normal}", g_sLinkTeamName[2 - g_iLinkCtTeam], "{#t}T{#normal}");
}

/**
 * Pone a cada inscrito en el lado de su equipo. Los demás van a espectador; con keepStandins
 * (mapa siguiente de una serie) se quedan si ya están en un lado y entran en sus cupos.
 */
void Link_Arrange(bool keepStandins = false)
{
	bool moved;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsClientSourceTV(i))
			continue;
		int team = GetClientTeam(i);
		int k = Link_TeamOf(i);
		if (k)
		{
			int want = Link_SideOf(k);
			if (team != want)
			{
				MoveToTeam(i, want);
				moved = true;
			}
		}
		else if (team == TEAM_T || team == TEAM_CT)
		{
			if (keepStandins && g_iLinkMaxStandins > 0 && Link_SideCount(team, i, true) < g_iLinkMaxStandins
				&& Link_SideCount(team, i) < LINK_MAX_SIDE)
				continue;
			ChangeClientTeam(i, TEAM_SPEC);
			g_bReady[i] = false;
			moved = true;
		}
	}
	if (moved)
		ServerCommand("mp_restartgame 1");   // para que todos aparezcan en su lado
}

/** Toma como lado de cada equipo el de la mayoría de sus inscritos presentes (si no hay ninguno, no cambia). */
void Link_AdoptSides()
{
	int ct, t;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsClientSourceTV(i))
			continue;
		int k = Link_TeamOf(i), team = GetClientTeam(i);
		if (!k || (team != TEAM_CT && team != TEAM_T))
			continue;
		// Votos por "team1 de la partida juega de CT".
		if ((k == 1) == (team == TEAM_CT))
			ct++;
		else
			t++;
	}
	if (ct != t)
		g_iLinkCtTeam = ct > t ? 1 : 2;
}

Handle g_hLinkPlaceTimer;

/**
 * Un inscrito que entra en el calentamiento va al lado de su equipo. Se acomoda a todos juntos unos
 * segundos después de la última entrada: en un cambio de mapa vuelven todos de a uno, y moverlos de
 * a uno con el tope de 5 podía trabar a los dos equipos si tenían que cambiar de lado.
 */
void Match_OnClientJoin(int client)
{
	if (g_LinkState != Link_Active || g_State != State_Warmup)
		return;
	CreateTimer(2.0, Timer_LinkGreet, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
	delete g_hLinkPlaceTimer;
	g_hLinkPlaceTimer = CreateTimer(4.0, Timer_LinkPlace);   // sin NO_MAPCHANGE: el handle sigue válido hasta que dispara
}

public Action Timer_LinkGreet(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client <= 0 || !IsClientInGame(client) || g_LinkState != Link_Active || g_State != State_Warmup)
		return Plugin_Stop;
	int k = Link_TeamOf(client);
	if (k)
		QolChat(client, "%s Partida vinculada: {#amarillo}%s{#normal}. Jugás con {#amarillo}%s{#normal}.", PREFIX, g_sLinkTitle, g_sLinkTeamName[k - 1]);
	else
		QolChat(client, "%s Partida vinculada: {#amarillo}%s{#normal}. Si sos stand-in, entrá al lado de tu equipo.", PREFIX, g_sLinkTitle);
	return Plugin_Stop;
}

public Action Timer_LinkPlace(Handle timer)
{
	g_hLinkPlaceTimer = null;
	if (g_LinkState == Link_Active && g_State == State_Warmup)
	{
		Link_AdoptSides();
		Link_Arrange(true);
	}
	return Plugin_Stop;
}

/** En el calentamiento con vínculo: cada inscrito solo a su lado; stand-ins dentro de los cupos. */
public Action Cmd_MatchJoinTeam(int client, const char[] command, int argc)
{
	if (client <= 0 || !IsClientInGame(client) || g_LinkState != Link_Active || g_State != State_Warmup)
		return Plugin_Continue;
	char arg[8];
	GetCmdArg(1, arg, sizeof(arg));
	int to = StringToInt(arg);
	if (to == TEAM_SPEC)
		return Plugin_Continue;

	int k = Link_TeamOf(client);
	if (to != TEAM_T && to != TEAM_CT)
	{
		// Selección automática: el inscrito va a su lado; el resto tiene que elegir.
		if (k && GetClientTeam(client) != Link_SideOf(k))
			MoveToTeam(client, Link_SideOf(k));
		else if (!k)
			QolChat(client, "%s Partida vinculada: elegí el lado de tu equipo ({#ct}CT{#normal} %s, {#t}T{#normal} %s).", PREFIX,
				g_sLinkTeamName[g_iLinkCtTeam - 1], g_sLinkTeamName[2 - g_iLinkCtTeam]);
		return Plugin_Handled;
	}

	int sideTeam = Link_TeamOfSide(to);
	if (k && k != sideTeam)
	{
		QolChat(client, "%s Sos de {#amarillo}%s{#normal}: tu equipo juega de %s.", PREFIX, g_sLinkTeamName[k - 1],
			Link_SideOf(k) == TEAM_CT ? "{#ct}CT{#normal}" : "{#t}T{#normal}");
		return Plugin_Handled;
	}
	if (Link_SideCount(to, client) >= LINK_MAX_SIDE)
	{
		QolChat(client, "%s El lado de {#amarillo}%s{#normal} ya tiene %d jugadores.", PREFIX, g_sLinkTeamName[sideTeam - 1], LINK_MAX_SIDE);
		return Plugin_Handled;
	}
	if (!k)
	{
		if (g_iLinkMaxStandins == 0)
		{
			QolChat(client, "%s Es una partida de torneo: solo juegan los inscritos de cada equipo.", PREFIX);
			return Plugin_Handled;
		}
		if (Link_SideCount(to, client, true) >= g_iLinkMaxStandins)
		{
			QolChat(client, "%s {#amarillo}%s{#normal} ya tiene sus %d stand-ins.", PREFIX, g_sLinkTeamName[sideTeam - 1], g_iLinkMaxStandins);
			return Plugin_Handled;
		}
	}
	return Plugin_Continue;
}

// ---------------------------------------------------------------------------
// Inicio, fin y cambio de mapa
// ---------------------------------------------------------------------------

/**
 * ¿Cada lado cumple la regla del vínculo? Si no, deja en why qué falta.
 * Torneo: min_roster (5) inscritos y ningún stand-in. PCW: al menos min_roster (3) inscritos,
 * hasta max_standins (2) stand-ins y 5 en total.
 */
bool Match_SidesOk(char[] why, int maxlen)
{
	why[0] = '\0';
	if (g_LinkState != Link_Active)
		return true;
	for (int k = 1; k <= 2; k++)
	{
		int side = Link_SideOf(k);
		int total = Link_SideCount(side);
		int standins = Link_SideCount(side, 0, true);
		int roster = total - standins;
		// Cuenta solo a los del plantel que están jugando en ese lado: los suplentes que no juegan no importan.
		char problem[128];
		if (roster < g_iLinkMinRoster)
			Format(problem, sizeof(problem), "necesita %s%d jugadores de su plantel en su lado (hay %d)",
				g_iLinkMaxStandins ? "al menos " : "", g_iLinkMinRoster, roster);
		else if (standins > g_iLinkMaxStandins)
			Format(problem, sizeof(problem), g_iLinkMaxStandins ? "tiene demasiados stand-ins (máximo %d)" : "no puede tener stand-ins en un torneo", g_iLinkMaxStandins);
		else if (total > LINK_MAX_SIDE)
			Format(problem, sizeof(problem), "tiene más de %d jugadores", LINK_MAX_SIDE);
		if (problem[0])
			Format(why, maxlen, "%s%s%s %s", why, why[0] ? " · " : "", g_sLinkTeamName[k - 1], problem);
	}
	return why[0] == '\0';
}

/** Para el inicio por !ready: con vínculo, cada lado tiene que cumplir. Avisa por qué no (cada 10 s como mucho). */
bool Match_ReadyAllows()
{
	char why[256];
	if (Match_SidesOk(why, sizeof(why)))
		return true;
	if (GetTime() - g_iReadyBlockedAt >= 10)
	{
		g_iReadyBlockedAt = GetTime();
		QolChatAll("%s Todos listos, pero la partida vinculada todavía no puede empezar: %s.", PREFIX, why);
	}
	return false;
}

/** Al empezar la partida (StartMatch): fija lo que va en el resultado. */
void Match_OnMatchStart()
{
	if (g_LinkState == Link_Pending)
	{
		QolChatAll("%s Nadie de {#amarillo}%s{#normal} confirmó el vínculo: esta partida se juega como un mix común.", PREFIX, g_sLinkTeamName[2 - g_iLinkProposer]);
		Link_Clear();
		return;
	}
	if (g_LinkState != Link_Active)
		return;
	strcopy(g_sMatchLinkCode, sizeof(g_sMatchLinkCode), g_sLinkCode);
	// El equipo A del mix es el que empieza de CT (g_iSideA).
	g_iMatchLinkSideA = g_iSideA == TEAM_CT ? g_iLinkCtTeam : 3 - g_iLinkCtTeam;
	char why[256];
	if (!Match_SidesOk(why, sizeof(why)))
		QolChatAll("%s Atención: la partida vinculada no cumple las reglas (%s). Si no cuadra, al terminar se guarda como mix.", PREFIX, why);
}

/** Después de PickTeamNames: con vínculo, los equipos se llaman como en la web. */
void Match_ApplyTeamNames()
{
	if (!g_sMatchLinkCode[0])
		return;
	for (int t = 0; t < 2; t++)
	{
		int k = t == 0 ? g_iMatchLinkSideA : 3 - g_iMatchLinkSideA;
		strcopy(g_sTeamNick[t], sizeof(g_sTeamNick[]), g_sLinkTeamName[k - 1]);
		TruncateUtf8(g_sTeamNick[t], 20);
		strcopy(g_sTeam[t], sizeof(g_sTeam[]), g_sLinkTeamName[k - 1]);
	}
}

/** !swap del admin en el calentamiento: los equipos de la partida cambian de lado. */
void Match_OnSwap()
{
	if (g_LinkState == Link_Active)
		g_iLinkCtTeam = 3 - g_iLinkCtTeam;
}

/** Cambio de mapa o vuelta al calentamiento: un pendiente se descarta; uno activo se actualiza. */
void Match_OnMapReady()
{
	if (g_LinkState == Link_Pending)
		Link_Clear();
	else if (g_LinkState == Link_Active)
		Link_Lookup(g_sLinkCode, 0);
}

public Action Timer_LinkRefresh(Handle timer)
{
	if (g_LinkState == Link_Active && g_State == State_Warmup)
		Link_Lookup(g_sLinkCode, 0);
	return Plugin_Stop;
}

// ---------------------------------------------------------------------------
// Texto de la consulta
// ---------------------------------------------------------------------------

/**
 * PostgREST devuelve el texto como un string JSON ("ok=1\nkind=…"): se sacan las comillas y se
 * desescapa en el lugar.
 */
void Link_UnescapeJsonString(char[] s)
{
	int n = strlen(s), j;
	int start = (n > 0 && s[0] == '"') ? 1 : 0;
	int end = (n > 1 && s[n - 1] == '"') ? n - 1 : n;
	for (int i = start; i < end; i++)
	{
		if (s[i] == '\\' && i + 1 < end)
		{
			i++;
			switch (s[i])
			{
				case 'n': s[j++] = '\n';
				case 't': s[j++] = ' ';
				case 'r': {}
				case 'u': { s[j++] = '?'; i += 4; }   // los nombres en UTF-8 vienen sin escapar
				default: s[j++] = s[i];
			}
		}
		else
			s[j++] = s[i];
	}
	s[j] = '\0';
}

/** Valor de la línea "key=…" del texto (vacío si no está). */
void Link_Field(const char[] text, const char[] key, char[] out, int maxlen)
{
	out[0] = '\0';
	char needle[32];
	int pos = -1, len = strlen(key);
	if (strncmp(text, key, len) == 0 && text[len] == '=')
		pos = 0;
	else
	{
		Format(needle, sizeof(needle), "\n%s=", key);
		int p = StrContains(text, needle);
		if (p != -1)
			pos = p + 1;
	}
	if (pos == -1)
		return;
	pos += len + 1;
	int i;
	while (text[pos + i] != '\0' && text[pos + i] != '\n' && i < maxlen - 1)
	{
		out[i] = text[pos + i];
		i++;
	}
	out[i] = '\0';
}
