/**
 * Votación de mapa para jugadores, solo en el calentamiento:
 *  - !vote <mapa> / !nominate <mapa>: vota un mapa (acepta parte del nombre). Si un mapa junta
 *    csstv_rtv_ratio de los jugadores, se cambia directo. Votar un mapa también cuenta como !rtv.
 *  - !rtv (o "rtv" en el chat): pide cambiar de mapa. Cuando !rtv + !vote juntan csstv_rtv_ratio
 *    de los jugadores, se abre una votación con menú (los más votados, mapas al azar y "No cambiar").
 *  - !mapas / !maps: menú con la lista y los votos de cada mapa. !unrtv quita el voto.
 *
 * Cuentan todos los jugadores humanos conectados (también los espectadores). La lista sale de la
 * sección "csstv" de configs/maplists.cfg o, si no existe, del mapcycle del servidor.
 * sm_vote es el comando de votación de admin de basevotes.smx: se intercepta con un listener y solo
 * se deja pasar cuando un admin lo usa para otra cosa que votar un mapa.
 */

#if defined _csstv_maps_included
	#endinput
#endif
#define _csstv_maps_included

#define MAPS_VOTE_TIME 20
#define MAPS_CHANGE_DELAY 5.0

ConVar g_cvRtv;
ConVar g_cvRtvRatio;
ConVar g_cvRtvWait;
ConVar g_cvRtvCooldown;
ConVar g_cvRtvOptions;
ArrayList g_aMaps;                 // mapas que se pueden votar (sin el actual)
int g_iMapVote[MAXPLAYERS + 1] = { -1, ... };   // índice en g_aMaps; -1 = ninguno
bool g_bRtv[MAXPLAYERS + 1];
int g_iMapsLoadedAt;               // GetTime() al cargar el mapa
int g_iRtvBlockedUntil;            // GetTime() hasta el que no se puede votar (tras un "No cambiar")
bool g_bMapVoteActive;             // votación con menú en curso
bool g_bMapChanging;               // ya se decidió el mapa y se está por cambiar
char g_sNextMap[PLATFORM_MAX_PATH];

void Maps_Init()
{
	g_cvRtv         = CreateConVar("csstv_rtv", "1", "Votación de mapa de los jugadores en el calentamiento (!rtv, !vote <mapa>, !mapas).", _, true, 0.0, true, 1.0);
	g_cvRtvRatio    = CreateConVar("csstv_rtv_ratio", "0.6", "Parte de los jugadores (espectadores incluidos) que hace falta para cambiar de mapa (0.6 = 6 de 10).", _, true, 0.05, true, 1.0);
	g_cvRtvWait     = CreateConVar("csstv_rtv_wait", "30", "Segundos desde que carga el mapa antes de poder votar.", _, true, 0.0, true, 600.0);
	g_cvRtvCooldown = CreateConVar("csstv_rtv_cooldown", "120", "Segundos de espera después de una votación que no cambió el mapa.", _, true, 0.0, true, 1800.0);
	g_cvRtvOptions  = CreateConVar("csstv_rtv_options", "5", "Mapas en el menú de la votación (además de \"No cambiar de mapa\").", _, true, 2.0, true, 6.0);
	RegConsoleCmd("sm_rtv", Cmd_Rtv, "Pedir cambiar de mapa (solo en el calentamiento).");
	RegConsoleCmd("sm_unrtv", Cmd_Unrtv, "Quitar tu !rtv y tu voto de mapa.");
	RegConsoleCmd("sm_nominate", Cmd_MapVote, "Votar un mapa: !nominate <mapa> (sin mapa abre el menú).");
	RegConsoleCmd("sm_mapas", Cmd_Mapas, "Lista de mapas para votar.");
	RegConsoleCmd("sm_maps", Cmd_Mapas, "Lista de mapas para votar.");
	AddCommandListener(Cmd_VoteListener, "sm_vote");
	g_aMaps = new ArrayList(ByteCountToCells(PLATFORM_MAX_PATH));
}

void Maps_OnMapStart()
{
	g_iMapsLoadedAt = GetTime();
	g_iRtvBlockedUntil = 0;
	g_bMapVoteActive = false;   // los menús de votación se cierran con el mapa
	g_bMapChanging = false;
	Maps_ClearVotes();
	Maps_LoadList();
}

void Maps_LoadList()
{
	int serial = -1;
	ArrayList all = new ArrayList(ByteCountToCells(PLATFORM_MAX_PATH));
	ReadMapList(all, serial, "csstv", MAPLIST_FLAG_CLEARARRAY);
	char current[PLATFORM_MAX_PATH], map[PLATFORM_MAX_PATH];
	GetCurrentMap(current, sizeof(current));
	g_aMaps.Clear();
	for (int i = 0; i < all.Length; i++)
	{
		all.GetString(i, map, sizeof(map));
		if (!StrEqual(map, current, false) && IsMapValid(map) && g_aMaps.FindString(map) == -1)
			g_aMaps.PushString(map);
	}
	delete all;
}

void Maps_ClearVotes()
{
	for (int i = 0; i <= MaxClients; i++)
	{
		g_iMapVote[i] = -1;
		g_bRtv[i] = false;
	}
}

/** Al empezar una partida: se borran los votos y se corta la votación en curso. */
void Maps_OnMatchStart()
{
	if (g_bMapVoteActive && IsVoteInProgress())
		CancelVote();
	g_bMapVoteActive = false;
	Maps_ClearVotes();
}

/** El mapa ya se eligió y se cambia en unos segundos: no se empieza una partida. */
bool Maps_ChangePending()
{
	return g_bMapChanging;
}

void Maps_OnClientDisconnect(int client)
{
	g_iMapVote[client] = -1;
	g_bRtv[client] = false;
	// Con un jugador menos puede alcanzar el umbral. Se revisa cuando ya se fue.
	if (Maps_CountRtv() > 0)
		CreateTimer(0.5, Timer_MapsRecheck, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_MapsRecheck(Handle timer)
{
	if (Maps_CanVote(0))
		Maps_Check();
	return Plugin_Stop;
}

bool Maps_IsVoter(int client)
{
	return QolTarget(client) && !IsClientSourceTV(client);
}

int Maps_CountVoters()
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (Maps_IsVoter(i))
			n++;
	return n;
}

int Maps_Needed()
{
	int needed = RoundToCeil(Maps_CountVoters() * g_cvRtvRatio.FloatValue);
	return needed < 1 ? 1 : needed;
}

int Maps_CountRtv()
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (g_bRtv[i] && Maps_IsVoter(i))
			n++;
	return n;
}

int Maps_CountFor(int index)
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (g_iMapVote[i] == index && Maps_IsVoter(i))
			n++;
	return n;
}

/** Si ahora se puede votar. client > 0: le explica por qué no; 0: sin mensajes. */
bool Maps_CanVote(int client)
{
	int now = GetTime();
	if (!g_cvRtv.BoolValue)
	{
		if (client > 0)
			QolReply(client, "[%s] La votación de mapa está desactivada en este servidor.", g_sTag);
		return false;
	}
	if (g_State != State_Warmup)
	{
		if (client > 0)
			QolReply(client, "[%s] El mapa solo se puede votar en el calentamiento.", g_sTag);
		return false;
	}
	if (g_bMapChanging)
	{
		if (client > 0)
			QolReply(client, "[%s] El mapa ya se eligió: se cambia a %s.", g_sTag, g_sNextMap);
		return false;
	}
	if (g_bMapVoteActive)
	{
		if (client > 0)
			QolReply(client, "[%s] Ya hay una votación de mapa en curso.", g_sTag);
		return false;
	}
	int wait = g_iMapsLoadedAt + g_cvRtvWait.IntValue - now;
	if (wait > 0)
	{
		if (client > 0)
			QolReply(client, "[%s] Se puede votar el mapa en %d s.", g_sTag, wait);
		return false;
	}
	if (g_iRtvBlockedUntil > now)
	{
		if (client > 0)
			QolReply(client, "[%s] Hubo una votación hace poco. Se puede volver a votar en %d s.", g_sTag, g_iRtvBlockedUntil - now);
		return false;
	}
	if (g_aMaps.Length == 0)
	{
		if (client > 0)
			QolReply(client, "[%s] No hay otros mapas para votar en este servidor.", g_sTag);
		return false;
	}
	return true;
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

public Action Cmd_Rtv(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client) || !Maps_CanVote(client))
		return Plugin_Handled;
	int needed = Maps_Needed();
	if (g_bRtv[client])
	{
		QolReply(client, "[%s] Ya pediste cambiar de mapa (%d/%d).", g_sTag, Maps_CountRtv(), needed);
		return Plugin_Handled;
	}
	g_bRtv[client] = true;
	QolChatAll("%s {#amarillo}%N quiere cambiar de mapa{#normal} (%d/%d). Escriban {#verde}!rtv{#normal} o {#verde}!vote <mapa>{#normal} (!mapas para ver la lista).", PREFIX,
		client, Maps_CountRtv(), needed);
	Maps_Check();
	return Plugin_Handled;
}

public Action Cmd_Unrtv(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (!g_bRtv[client])
	{
		QolReply(client, "[%s] No habías pedido cambiar de mapa.", g_sTag);
		return Plugin_Handled;
	}
	g_bRtv[client] = false;
	g_iMapVote[client] = -1;
	if (g_State == State_Warmup && !g_bMapVoteActive && !g_bMapChanging)
		QolChatAll("%s %N ya no quiere cambiar de mapa (%d/%d).", PREFIX, client, Maps_CountRtv(), Maps_Needed());
	return Plugin_Handled;
}

public Action Cmd_MapVote(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client) || !Maps_CanVote(client))
		return Plugin_Handled;
	if (args < 1)
	{
		Maps_ShowList(client, "");
		return Plugin_Handled;
	}
	char arg[PLATFORM_MAX_PATH];
	GetCmdArg(1, arg, sizeof(arg));
	Maps_VoteByName(client, arg);
	return Plugin_Handled;
}

public Action Cmd_Mapas(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (g_aMaps.Length == 0)
	{
		QolReply(client, "[%s] No hay otros mapas para votar en este servidor.", g_sTag);
		return Plugin_Handled;
	}
	Maps_ShowList(client, "");
	return Plugin_Handled;
}

/**
 * sm_vote (y !vote) es de basevotes.smx (votación de admin con pregunta). Lo toma este plugin
 * salvo que lo use un admin con permiso de sm_vote y el argumento no sea un mapa de la lista.
 */
public Action Cmd_VoteListener(int client, const char[] command, int argc)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Continue;
	if (CheckCommandAccess(client, "sm_vote", ADMFLAG_VOTE))
	{
		if (argc != 1)
			return Plugin_Continue;
		char arg[PLATFORM_MAX_PATH];
		GetCmdArg(1, arg, sizeof(arg));
		int matches[1];
		if (Maps_Find(arg, matches, sizeof(matches)) == 0)
			return Plugin_Continue;
	}
	Cmd_MapVote(client, argc);
	return Plugin_Stop;
}

public void OnClientSayCommand_Post(int client, const char[] command, const char[] sArgs)
{
	if (client > 0 && StrEqual(sArgs, "rtv", false))
		Cmd_Rtv(client, 0);
}

// ---------------------------------------------------------------------------
// Votos
// ---------------------------------------------------------------------------

/** Mapas de la lista que coinciden: el nombre exacto, o si no los que lo contienen. Devuelve cuántos hay. */
int Maps_Find(const char[] text, int[] out, int max)
{
	char map[PLATFORM_MAX_PATH];
	for (int i = 0; i < g_aMaps.Length; i++)
	{
		g_aMaps.GetString(i, map, sizeof(map));
		if (StrEqual(map, text, false))
		{
			out[0] = i;
			return 1;
		}
	}
	int n;
	for (int i = 0; i < g_aMaps.Length; i++)
	{
		g_aMaps.GetString(i, map, sizeof(map));
		if (StrContains(map, text, false) != -1)
		{
			if (n < max)
				out[n] = i;
			n++;
		}
	}
	return n;
}

void Maps_VoteByName(int client, const char[] text)
{
	int matches[64];
	int n = Maps_Find(text, matches, sizeof(matches));
	if (n == 0)
		QolReply(client, "[%s] No hay ningún mapa que coincida con \"%s\". Escribí !mapas para ver la lista.", g_sTag, text);
	else if (n == 1)
		Maps_SetVote(client, matches[0]);
	else
		Maps_ShowList(client, text);
}

void Maps_SetVote(int client, int index)
{
	char map[PLATFORM_MAX_PATH];
	g_aMaps.GetString(index, map, sizeof(map));
	if (g_iMapVote[client] == index)
	{
		QolReply(client, "[%s] Ya votaste por %s (%d/%d).", g_sTag, map, Maps_CountFor(index), Maps_Needed());
		return;
	}
	g_iMapVote[client] = index;
	g_bRtv[client] = true;
	QolChatAll("%s %N vota por {#amarillo}%s{#normal} (%d/%d). Para cambiar de mapa: %d/%d.", PREFIX,
		client, map, Maps_CountFor(index), Maps_Needed(), Maps_CountRtv(), Maps_Needed());
	Maps_Check();
}

/** Un mapa con suficientes votos cambia directo; si no, suficientes !rtv abren la votación. */
void Maps_Check()
{
	if (g_State != State_Warmup || g_bMapVoteActive || g_bMapChanging)
		return;
	int needed = Maps_Needed();
	char map[PLATFORM_MAX_PATH];
	for (int i = 0; i < g_aMaps.Length; i++)
	{
		if (Maps_CountFor(i) >= needed)
		{
			g_aMaps.GetString(i, map, sizeof(map));
			QolChatAll("%s {#amarillo}%s{#normal} juntó los votos (%d/%d).", PREFIX, map, Maps_CountFor(i), needed);
			Maps_ChangeTo(map);
			return;
		}
	}
	if (Maps_CountRtv() >= needed)
		Maps_StartVote();
}

// ---------------------------------------------------------------------------
// Menú de mapas (!mapas, !vote sin mapa o con varias coincidencias)
// ---------------------------------------------------------------------------

void Maps_ShowList(int client, const char[] filter)
{
	Menu menu = new Menu(Maps_ListHandler);
	if (filter[0])
		menu.SetTitle("Mapas con \"%s\"", filter);
	else
		menu.SetTitle("Votar mapa (para cambiar: %d/%d)", Maps_CountRtv(), Maps_Needed());
	char map[PLATFORM_MAX_PATH], info[8], label[PLATFORM_MAX_PATH + 24];
	bool can = Maps_CanVote(0);
	for (int i = 0; i < g_aMaps.Length; i++)
	{
		g_aMaps.GetString(i, map, sizeof(map));
		if (filter[0] && StrContains(map, filter, false) == -1)
			continue;
		int votes = Maps_CountFor(i);
		if (votes > 0)
			Format(label, sizeof(label), "%s (%d)%s", map, votes, g_iMapVote[client] == i ? " - tu voto" : "");
		else
			strcopy(label, sizeof(label), map);
		IntToString(i, info, sizeof(info));
		menu.AddItem(info, label, can ? ITEMDRAW_DEFAULT : ITEMDRAW_DISABLED);
	}
	menu.Display(client, MENU_TIME_FOREVER);
}

public int Maps_ListHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char info[8];
		menu.GetItem(item, info, sizeof(info));
		ReplySource old = SetCmdReplySource(SM_REPLY_TO_CHAT);
		int index = StringToInt(info);
		if (Maps_CanVote(client) && index < g_aMaps.Length)
			Maps_SetVote(client, index);
		SetCmdReplySource(old);
	}
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

// ---------------------------------------------------------------------------
// Votación con menú
// ---------------------------------------------------------------------------

void Maps_StartVote()
{
	if (IsVoteInProgress())
	{
		QolChatAll("%s Hay otra votación en curso. La votación de mapa empieza cuando termine.", PREFIX);
		CreateTimer(5.0, Timer_MapsRecheck, _, TIMER_FLAG_NO_MAPCHANGE);
		return;
	}
	int count = g_aMaps.Length;
	int options = g_cvRtvOptions.IntValue;
	// Primero los mapas votados (de más a menos votos), después al azar.
	int[] order = new int[count];
	int[] votes = new int[count];
	for (int i = 0; i < count; i++)
	{
		order[i] = i;
		votes[i] = Maps_CountFor(i);
	}
	for (int i = count - 1; i > 0; i--)
	{
		int j = GetRandomInt(0, i);
		int tmp = order[i]; order[i] = order[j]; order[j] = tmp;
	}
	for (int i = 1; i < count; i++)   // inserción estable: los empates quedan en orden al azar
	{
		int cur = order[i], j = i - 1;
		while (j >= 0 && votes[order[j]] < votes[cur])
		{
			order[j + 1] = order[j];
			j--;
		}
		order[j + 1] = cur;
	}

	Menu menu = new Menu(Maps_VoteHandler, MENU_ACTIONS_DEFAULT);
	menu.VoteResultCallback = Maps_VoteResult;
	menu.SetTitle("¿A qué mapa cambiamos?");
	char map[PLATFORM_MAX_PATH];
	for (int i = 0; i < count && i < options; i++)
	{
		g_aMaps.GetString(order[i], map, sizeof(map));
		menu.AddItem(map, map);
	}
	menu.AddItem("", "No cambiar de mapa");
	menu.ExitButton = false;
	g_bMapVoteActive = true;
	if (!menu.DisplayVoteToAll(MAPS_VOTE_TIME))
	{
		delete menu;
		Maps_VoteFailed("no se pudo mostrar el menú");
		return;
	}
	if (g_bMapVoteActive)   // sin nadie que pueda votar, SourceMod la termina en el momento
		QolChatAll("%s {#amarillo}Votación de mapa{#normal}: elegí en el menú (%d s).", PREFIX, MAPS_VOTE_TIME);
}

public int Maps_VoteHandler(Menu menu, MenuAction action, int param1, int param2)
{
	if (action == MenuAction_VoteCancel)
	{
		if (g_bMapVoteActive)
			Maps_VoteFailed(param1 == VoteCancel_NoVotes ? "nadie votó" : "se canceló");
	}
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

/** Gana la opción con más votos; en un empate, la que está más arriba en el menú. */
public void Maps_VoteResult(Menu menu, int num_votes, int num_clients, const int[][] client_info, int num_items, const int[][] item_info)
{
	if (!g_bMapVoteActive)
		return;
	g_bMapVoteActive = false;
	int best = item_info[0][VOTEINFO_ITEM_INDEX], bestVotes = item_info[0][VOTEINFO_ITEM_VOTES];
	for (int i = 1; i < num_items; i++)
	{
		if (item_info[i][VOTEINFO_ITEM_VOTES] == bestVotes && item_info[i][VOTEINFO_ITEM_INDEX] < best)
			best = item_info[i][VOTEINFO_ITEM_INDEX];
	}
	char map[PLATFORM_MAX_PATH];
	menu.GetItem(best, map, sizeof(map));
	if (g_State != State_Warmup)
		return;
	if (!map[0])
	{
		Maps_VoteFailed("ganó \"No cambiar de mapa\"");
		return;
	}
	QolChatAll("%s Ganó {#amarillo}%s{#normal} (%d de %d votos).", PREFIX, map, bestVotes, num_votes);
	Maps_ChangeTo(map);
}

void Maps_VoteFailed(const char[] why)
{
	g_bMapVoteActive = false;
	Maps_ClearVotes();
	int cooldown = g_cvRtvCooldown.IntValue;
	g_iRtvBlockedUntil = GetTime() + cooldown;
	if (g_State == State_Warmup)
		QolChatAll("%s El mapa no cambia (%s). Se puede volver a votar en %d s.", PREFIX, why, cooldown);
}

void Maps_ChangeTo(const char[] map)
{
	g_bMapChanging = true;
	strcopy(g_sNextMap, sizeof(g_sNextMap), map);
	SetNextMap(map);
	LogMessage("Votación de jugadores: cambio a %s.", map);
	QolChatAll("%s Cambiando a {#amarillo}%s{#normal} en %d s.", PREFIX, map, RoundToFloor(MAPS_CHANGE_DELAY));
	CreateTimer(MAPS_CHANGE_DELAY, Timer_MapsChange, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_MapsChange(Handle timer)
{
	if (g_bMapChanging && g_State == State_Warmup)
		ForceChangeLevel(g_sNextMap, "CMLeague: votación de mapa de los jugadores");
	else
		g_bMapChanging = false;
	return Plugin_Stop;
}
