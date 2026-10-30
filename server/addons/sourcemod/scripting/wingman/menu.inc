/**
 * Categoría "2v2" en el menú de admin de SourceMod (!admin): las mismas acciones que los comandos,
 * sin escribir. Cada opción ejecuta su comando como el admin que la eligió, así que respeta sus
 * permisos. Las que no aplican en el momento se ven deshabilitadas. El menú de admin es opcional:
 * si adminmenu.smx no está cargado, el plugin funciona igual.
 */

#if defined _wingman_menu_included
	#endinput
#endif
#define _wingman_menu_included

TopMenu g_hAdminMenu;
TopMenuObject g_oMenuCat = INVALID_TOPMENUOBJECT;

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
	g_oMenuCat = topmenu.AddCategory("v34wingman", Menu_CategoryHandler);
}

public void OnAdminMenuReady(Handle aTopMenu)
{
	TopMenu topmenu = TopMenu.FromHandle(aTopMenu);
	if (g_oMenuCat == INVALID_TOPMENUOBJECT)
		OnAdminMenuCreated(topmenu);
	if (topmenu == g_hAdminMenu)
		return;
	g_hAdminMenu = topmenu;
	topmenu.AddItem("wm_toggle", Menu_ItemHandler, g_oMenuCat, "sm_2v2", ADMFLAG_GENERIC);
	topmenu.AddItem("wm_start", Menu_ItemHandler, g_oMenuCat, "sm_2v2_start", ADMFLAG_GENERIC);
	topmenu.AddItem("wm_cancel", Menu_ItemHandler, g_oMenuCat, "sm_2v2_cancel", ADMFLAG_GENERIC);
	topmenu.AddItem("wm_pause", Menu_ItemHandler, g_oMenuCat, "sm_2v2", ADMFLAG_GENERIC);
	topmenu.AddItem("wm_unpause", Menu_ItemHandler, g_oMenuCat, "sm_2v2", ADMFLAG_GENERIC);
	topmenu.AddItem("wm_show", Menu_ItemHandler, g_oMenuCat, "sm_2v2_show", ADMFLAG_GENERIC);
}

public void Menu_CategoryHandler(TopMenu topmenu, TopMenuAction action, TopMenuObject object_id, int param, char[] buffer, int maxlength)
{
	if (action == TopMenuAction_DisplayTitle || action == TopMenuAction_DisplayOption)
		strcopy(buffer, maxlength, "2v2");
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
	if (StrEqual(name, "wm_toggle"))
		strcopy(buffer, maxlength, g_bActive ? "Apagar el modo 2v2" : "Prender el modo 2v2");
	else if (StrEqual(name, "wm_start"))
		strcopy(buffer, maxlength, "Empezar partida");
	else if (StrEqual(name, "wm_cancel"))
		strcopy(buffer, maxlength, "Cancelar partida");
	else if (StrEqual(name, "wm_pause"))
		strcopy(buffer, maxlength, "Pausa de admin");
	else if (StrEqual(name, "wm_unpause"))
		strcopy(buffer, maxlength, "Quitar pausa");
	else if (StrEqual(name, "wm_show"))
		strcopy(buffer, maxlength, "Ver sitio, spawns y zonas");
}

bool Menu_ItemEnabled(const char[] name)
{
	if (StrEqual(name, "wm_start"))
		return g_bActive && g_iState == State_Warmup;
	if (StrEqual(name, "wm_cancel"))
		return g_bActive && g_iState != State_Warmup;
	if (StrEqual(name, "wm_pause"))
		return g_bActive && g_iState == State_Live && !g_bPaused && !g_bPauseRequested;
	if (StrEqual(name, "wm_unpause"))
		return g_bActive && (g_bPaused || g_bPauseRequested);
	return true;
}

void Menu_ItemSelect(int client, const char[] name)
{
	if (StrEqual(name, "wm_toggle"))
		FakeClientCommand(client, "sm_2v2 %d", g_bActive ? 0 : 1);
	else if (StrEqual(name, "wm_start"))
		FakeClientCommand(client, "sm_2v2_start");
	else if (StrEqual(name, "wm_cancel"))
		FakeClientCommand(client, "sm_2v2_cancel");
	else if (StrEqual(name, "wm_pause"))
		FakeClientCommand(client, "sm_forcepause");
	else if (StrEqual(name, "wm_unpause"))
		FakeClientCommand(client, "sm_forceunpause");
	else if (StrEqual(name, "wm_show"))
		FakeClientCommand(client, "sm_2v2_show");
	if (g_hAdminMenu != null && g_oMenuCat != INVALID_TOPMENUOBJECT)
		g_hAdminMenu.DisplayCategory(g_oMenuCat, client);
}
