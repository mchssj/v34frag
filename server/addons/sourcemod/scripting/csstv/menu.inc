/**
 * Categoría del servidor (csstv_chat_tag, hoy "CMLeague") en el menú de admin de SourceMod (sm_admin): las mismas acciones que
 * los comandos, sin escribir. Cada opción usa el permiso de su comando (sm_live, sm_team…),
 * así que respeta los overrides del servidor. Las opciones que no aplican en el momento
 * (por ejemplo, cancelar en el calentamiento) se ven deshabilitadas. Las respuestas van al
 * chat del admin que usó el menú.
 *
 * El menú de admin es opcional: si adminmenu.smx no está cargado, el plugin funciona igual.
 */

#if defined _csstv_menu_included
	#endinput
#endif
#define _csstv_menu_included

TopMenu g_hAdminMenu;
TopMenuObject g_oMenuCat = INVALID_TOPMENUOBJECT;
bool g_bMenuKnife[MAXPLAYERS + 1];
char g_sMenuTarget[MAXPLAYERS + 1][24];

void Menu_Init()
{
	TopMenu topmenu;
	if (LibraryExists("adminmenu") && ((topmenu = GetAdminTopMenu()) != null))
		OnAdminMenuReady(topmenu);
}

public void OnLibraryRemoved(const char[] name)
{
	if (StrEqual(name, "adminmenu"))
	{
		g_hAdminMenu = null;
		g_oMenuCat = INVALID_TOPMENUOBJECT;
	}
}

public void OnAdminMenuCreated(Handle aTopMenu)
{
	TopMenu topmenu = TopMenu.FromHandle(aTopMenu);
	if (topmenu == g_hAdminMenu && g_oMenuCat != INVALID_TOPMENUOBJECT)
		return;
	g_oMenuCat = topmenu.AddCategory("v34frag", Menu_CategoryHandler);
}

public void OnAdminMenuReady(Handle aTopMenu)
{
	TopMenu topmenu = TopMenu.FromHandle(aTopMenu);
	if (g_oMenuCat == INVALID_TOPMENUOBJECT)
		OnAdminMenuCreated(topmenu);
	if (topmenu == g_hAdminMenu)
		return;
	g_hAdminMenu = topmenu;
	topmenu.AddItem("v34frag_live", Menu_ItemHandler, g_oMenuCat, "sm_live", ADMFLAG_GENERIC);
	topmenu.AddItem("v34frag_cancel", Menu_ItemHandler, g_oMenuCat, "sm_cancelmatch", ADMFLAG_GENERIC);
	topmenu.AddItem("v34frag_rr", Menu_ItemHandler, g_oMenuCat, "sm_rr", ADMFLAG_GENERIC);
	topmenu.AddItem("v34frag_pause", Menu_ItemHandler, g_oMenuCat, "sm_forcepause", ADMFLAG_GENERIC);
	topmenu.AddItem("v34frag_unpause", Menu_ItemHandler, g_oMenuCat, "sm_forceunpause", ADMFLAG_GENERIC);
	topmenu.AddItem("v34frag_team", Menu_ItemHandler, g_oMenuCat, "sm_team", ADMFLAG_GENERIC);
	topmenu.AddItem("v34frag_swap", Menu_ItemHandler, g_oMenuCat, "sm_swap", ADMFLAG_GENERIC);
	topmenu.AddItem("v34frag_status", Menu_ItemHandler, g_oMenuCat, "sm_csstv_status", ADMFLAG_RCON);
}

public void Menu_CategoryHandler(TopMenu topmenu, TopMenuAction action, TopMenuObject object_id, int param, char[] buffer, int maxlength)
{
	if (action == TopMenuAction_DisplayTitle || action == TopMenuAction_DisplayOption)
		strcopy(buffer, maxlength, g_sTag);
}

public void Menu_ItemHandler(TopMenu topmenu, TopMenuAction action, TopMenuObject object_id, int param, char[] buffer, int maxlength)
{
	char name[32];
	topmenu.GetObjName(object_id, name, sizeof(name));
	if (action == TopMenuAction_DisplayOption)
		Menu_ItemLabel(name, buffer, maxlength);
	else if (action == TopMenuAction_DrawOption)
		buffer[0] = Menu_ItemEnabled(name) ? ITEMDRAW_DEFAULT : ITEMDRAW_DISABLED;
	else if (action == TopMenuAction_SelectOption)
		Menu_ItemSelect(param, name);
}

void Menu_ItemLabel(const char[] name, char[] buffer, int maxlength)
{
	if (StrEqual(name, "v34frag_live"))
		strcopy(buffer, maxlength, "Iniciar partida");
	else if (StrEqual(name, "v34frag_cancel"))
		strcopy(buffer, maxlength, "Cancelar partida");
	else if (StrEqual(name, "v34frag_rr"))
		strcopy(buffer, maxlength, "Repetir ronda (!rr)");
	else if (StrEqual(name, "v34frag_pause"))
		strcopy(buffer, maxlength, "Pausa de admin");
	else if (StrEqual(name, "v34frag_unpause"))
		strcopy(buffer, maxlength, "Quitar pausa");
	else if (StrEqual(name, "v34frag_team"))
		strcopy(buffer, maxlength, "Cambiar de equipo");
	else if (StrEqual(name, "v34frag_swap"))
		strcopy(buffer, maxlength, "Intercambiar equipos (!swap)");
	else if (StrEqual(name, "v34frag_status"))
		strcopy(buffer, maxlength, "Estado del plugin");
}

bool Menu_ItemEnabled(const char[] name)
{
	if (StrEqual(name, "v34frag_live") || StrEqual(name, "v34frag_swap"))
		return g_State == State_Warmup;
	if (StrEqual(name, "v34frag_cancel"))
		return MatchInProgress();
	if (StrEqual(name, "v34frag_rr"))
		return g_State == State_Live && !g_bRestarting;
	if (StrEqual(name, "v34frag_pause"))
		return g_State == State_Live && !g_bRestarting && !g_bPaused && !g_bPauseRequested;
	if (StrEqual(name, "v34frag_unpause"))
		return g_bPaused || g_bPauseRequested;
	return true;
}

void Menu_ItemSelect(int client, const char[] name)
{
	if (StrEqual(name, "v34frag_live"))
		Menu_ShowLiveKnife(client);
	else if (StrEqual(name, "v34frag_cancel"))
		Menu_ShowConfirm(client, "cancel", "¿Cancelar la partida? Si se jugó al menos una ronda, queda guardada como cancelada.");
	else if (StrEqual(name, "v34frag_rr"))
		Menu_ShowConfirm(client, "rr", "¿Repetir la ronda actual? Marcador, plata y armas vuelven a como estaban al empezarla.");
	else if (StrEqual(name, "v34frag_team"))
		Menu_ShowTeamTargets(client);
	else
	{
		ReplySource old = SetCmdReplySource(SM_REPLY_TO_CHAT);
		if (StrEqual(name, "v34frag_pause"))
			Cmd_ForcePause(client, 0);
		else if (StrEqual(name, "v34frag_unpause"))
			Cmd_ForceUnpause(client, 0);
		else if (StrEqual(name, "v34frag_swap"))
			Cmd_Swap(client, 0);
		else if (StrEqual(name, "v34frag_status"))
			Cmd_Status(client, 0);
		SetCmdReplySource(old);
		Menu_BackToCategory(client);
	}
}

void Menu_BackToCategory(int client)
{
	if (g_hAdminMenu != null && g_oMenuCat != INVALID_TOPMENUOBJECT && IsClientInGame(client))
		g_hAdminMenu.DisplayCategory(g_oMenuCat, client);
}

/** Atrás en un submenú: vuelve a la categoría del servidor. */
void Menu_HandleCancel(int client, int reason)
{
	if (reason == MenuCancel_ExitBack)
		Menu_BackToCategory(client);
}

// ---------------------------------------------------------------------------
// Iniciar partida: cuchillo sí/no → formato
// ---------------------------------------------------------------------------

void Menu_ShowLiveKnife(int client)
{
	Menu menu = new Menu(Menu_LiveKnifeHandler);
	menu.SetTitle("Iniciar partida (con los jugadores como están)");
	menu.AddItem("0", "Sin ronda de cuchillo");
	menu.AddItem("1", "Con ronda de cuchillo (el ganador elige lado)");
	menu.ExitBackButton = true;
	menu.Display(client, MENU_TIME_FOREVER);
}

public int Menu_LiveKnifeHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char info[4];
		menu.GetItem(item, info, sizeof(info));
		g_bMenuKnife[client] = StringToInt(info) == 1;
		Menu_ShowLiveFormat(client);
	}
	else if (action == MenuAction_Cancel)
		Menu_HandleCancel(client, item);
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

void Menu_ShowLiveFormat(int client)
{
	static const int formats[] = { 12, 10, 8, 5, 4, 3 };
	Menu menu = new Menu(Menu_LiveFormatHandler);
	menu.SetTitle("Formato de la partida%s", g_bMenuKnife[client] ? " (con cuchillo)" : "");
	char info[4], label[48];
	Format(label, sizeof(label), "Partida completa (MR%d)", g_cvMaxRounds.IntValue / 2);
	menu.AddItem("0", label);
	for (int i = 0; i < sizeof(formats); i++)
	{
		IntToString(formats[i], info, sizeof(info));
		Format(label, sizeof(label), "MR%d (gana el primero en llegar a %d)", formats[i], formats[i] + 1);
		menu.AddItem(info, label);
	}
	menu.ExitBackButton = true;
	menu.Display(client, MENU_TIME_FOREVER);
}

public int Menu_LiveFormatHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char info[4];
		menu.GetItem(item, info, sizeof(info));
		ReplySource old = SetCmdReplySource(SM_REPLY_TO_CHAT);
		Live_Request(client, StringToInt(info), g_bMenuKnife[client]);
		SetCmdReplySource(old);
	}
	else if (action == MenuAction_Cancel)
	{
		if (item == MenuCancel_ExitBack)
			Menu_ShowLiveKnife(client);
	}
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

// ---------------------------------------------------------------------------
// Confirmación (cancelar partida, repetir ronda)
// ---------------------------------------------------------------------------

void Menu_ShowConfirm(int client, const char[] what, const char[] question)
{
	Menu menu = new Menu(Menu_ConfirmHandler);
	menu.SetTitle(question);
	menu.AddItem(what, "Sí");
	menu.AddItem("", "No");
	menu.ExitBackButton = true;
	menu.Display(client, MENU_TIME_FOREVER);
}

public int Menu_ConfirmHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char what[16];
		menu.GetItem(item, what, sizeof(what));
		ReplySource old = SetCmdReplySource(SM_REPLY_TO_CHAT);
		if (StrEqual(what, "cancel"))
			Cmd_Cancel(client, 0);
		else if (StrEqual(what, "rr"))
			Cmd_Rr(client, 0);
		SetCmdReplySource(old);
		Menu_BackToCategory(client);
	}
	else if (action == MenuAction_Cancel)
		Menu_HandleCancel(client, item);
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

// ---------------------------------------------------------------------------
// Cambiar de equipo: a quién → a qué equipo
// ---------------------------------------------------------------------------

void Menu_ShowTeamTargets(int client)
{
	Menu menu = new Menu(Menu_TeamTargetHandler);
	menu.SetTitle("Cambiar de equipo: ¿a quién?");
	menu.AddItem("@all", "Todos");
	menu.AddItem("@ct", "Todos los CT");
	menu.AddItem("@t", "Todos los T");
	menu.AddItem("@spec", "Todos los espectadores");
	char info[16], label[64];
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsClientSourceTV(i))
			continue;
		int team = GetClientTeam(i);
		Format(info, sizeof(info), "#%d", GetClientUserId(i));
		Format(label, sizeof(label), "%N [%s]", i, team == TEAM_CT ? "CT" : (team == TEAM_T ? "T" : "Spec"));
		menu.AddItem(info, label);
	}
	menu.ExitBackButton = true;
	menu.Display(client, MENU_TIME_FOREVER);
}

public int Menu_TeamTargetHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char label[64];
		menu.GetItem(item, g_sMenuTarget[client], sizeof(g_sMenuTarget[]), _, label, sizeof(label));
		Menu m = new Menu(Menu_TeamSideHandler);
		m.SetTitle("¿A qué equipo pasa %s?", label);
		m.AddItem("3", "CT");
		m.AddItem("2", "T");
		m.AddItem("1", "Espectador");
		m.ExitBackButton = true;
		m.Display(client, MENU_TIME_FOREVER);
	}
	else if (action == MenuAction_Cancel)
		Menu_HandleCancel(client, item);
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

public int Menu_TeamSideHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char info[4];
		menu.GetItem(item, info, sizeof(info));
		ReplySource old = SetCmdReplySource(SM_REPLY_TO_CHAT);
		Team_Apply(client, g_sMenuTarget[client], StringToInt(info));
		SetCmdReplySource(old);
		Menu_ShowTeamTargets(client);
	}
	else if (action == MenuAction_Cancel)
	{
		if (item == MenuCancel_ExitBack)
			Menu_ShowTeamTargets(client);
	}
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}
