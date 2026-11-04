/**
 * Votación de mapa: se abre al llegar a sm_retake_vote_round y el ganador se juega al terminar
 * la última ronda. Usa la misma lista que la votación de csstv_reporter: la sección "csstv" de
 * configs/maplists.cfg o, si no existe, el mapcycle. Solo entran mapas con puntos cargados.
 */

#if defined _retake_vote_included
	#endinput
#endif
#define _retake_vote_included

#define VOTE_TIME 20
#define VOTE_MAX_OPTIONS 6
#define VOTE_RETRY 5.0

bool g_bVoteDone;
bool g_bVoteActive;
char g_sNextMap[PLATFORM_MAX_PATH];

void Vote_Reset()
{
	g_bVoteDone = false;
	g_bVoteActive = false;
	g_sNextMap[0] = '\0';
}

/** Mapas que se pueden votar, mezclados y sin el actual. */
ArrayList Vote_ListMaps()
{
	int serial = -1;
	ArrayList all = new ArrayList(ByteCountToCells(PLATFORM_MAX_PATH));
	ReadMapList(all, serial, "csstv", MAPLIST_FLAG_CLEARARRAY);
	ArrayList maps = new ArrayList(ByteCountToCells(PLATFORM_MAX_PATH));
	char current[PLATFORM_MAX_PATH], map[PLATFORM_MAX_PATH];
	GetCurrentMap(current, sizeof(current));
	for (int i = 0; i < all.Length; i++)
	{
		all.GetString(i, map, sizeof(map));
		if (!StrEqual(map, current, false) && IsMapValid(map) && Spawns_MapHasFile(map) && maps.FindString(map) == -1)
			maps.PushString(map);
	}
	delete all;
	for (int i = maps.Length - 1; i > 0; i--)
		maps.SwapAt(i, GetRandomInt(0, i));
	return maps;
}

void Vote_Start()
{
	if (g_bVoteDone || g_bVoteActive)
		return;
	if (IsVoteInProgress())
	{
		CreateTimer(VOTE_RETRY, Timer_VoteRetry, _, TIMER_FLAG_NO_MAPCHANGE);
		return;
	}
	g_bVoteDone = true;
	ArrayList maps = Vote_ListMaps();
	if (maps.Length == 0)
	{
		delete maps;
		ChatAll("%s No hay otros mapas con spawns cargados: se sigue en este.", RETAKE_PREFIX);
		return;
	}
	Menu menu = new Menu(Vote_Handler, MENU_ACTIONS_DEFAULT);
	menu.VoteResultCallback = Vote_Result;
	menu.SetTitle("¿Qué mapa jugamos después?");
	char map[PLATFORM_MAX_PATH];
	for (int i = 0; i < maps.Length && i < VOTE_MAX_OPTIONS; i++)
	{
		maps.GetString(i, map, sizeof(map));
		menu.AddItem(map, map);
	}
	delete maps;
	menu.AddItem("", "Seguir en este mapa");
	menu.ExitButton = false;
	g_bVoteActive = true;
	if (!menu.DisplayVoteToAll(VOTE_TIME))
	{
		g_bVoteActive = false;
		delete menu;
		return;
	}
	if (g_bVoteActive)
		ChatAll("%s Votación de mapa: elegí en el menú (%d s).", RETAKE_PREFIX, VOTE_TIME);
}

public Action Timer_VoteRetry(Handle timer)
{
	if (g_bActive)
		Vote_Start();
	return Plugin_Stop;
}

public int Vote_Handler(Menu menu, MenuAction action, int param1, int param2)
{
	if (action == MenuAction_VoteCancel)
	{
		g_bVoteActive = false;
		ChatAll("%s Nadie votó: se sigue en este mapa.", RETAKE_PREFIX);
	}
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

/** Gana la opción con más votos; en un empate, la que está más arriba en el menú. */
public void Vote_Result(Menu menu, int num_votes, int num_clients, const int[][] client_info, int num_items, const int[][] item_info)
{
	g_bVoteActive = false;
	int best = item_info[0][VOTEINFO_ITEM_INDEX], bestVotes = item_info[0][VOTEINFO_ITEM_VOTES];
	for (int i = 1; i < num_items; i++)
		if (item_info[i][VOTEINFO_ITEM_VOTES] == bestVotes && item_info[i][VOTEINFO_ITEM_INDEX] < best)
			best = item_info[i][VOTEINFO_ITEM_INDEX];
	menu.GetItem(best, g_sNextMap, sizeof(g_sNextMap));
	if (g_sNextMap[0])
	{
		SetNextMap(g_sNextMap);
		ChatAll("%s Ganó %s (%d de %d votos). Se juega al terminar la ronda %d.", RETAKE_PREFIX, g_sNextMap, bestVotes, num_votes, g_cvMaxRounds.IntValue);
	}
	else
		ChatAll("%s Se sigue en este mapa.", RETAKE_PREFIX);
}
