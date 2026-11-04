/**
 * Categoría "Retake" en el menú de admin de SourceMod (!admin). Cada opción ejecuta su comando como
 * el admin que la eligió, así que respeta sus permisos. El menú de admin es opcional: si adminmenu.smx
 * no está cargado, el plugin funciona igual.
 */

#if defined _retake_menu_included
	#endinput
#endif
#define _retake_menu_included

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
	g_oMenuCat = topmenu.AddCategory("v34retake", Menu_CategoryHandler);
}

public void OnAdminMenuReady(Handle aTopMenu)
{
	TopMenu topmenu = TopMenu.FromHandle(aTopMenu);
	if (g_oMenuCat == INVALID_TOPMENUOBJECT)
		OnAdminMenuCreated(topmenu);
	if (topmenu == g_hAdminMenu)
		return;
	g_hAdminMenu = topmenu;
	topmenu.AddItem("rt_toggle", Menu_ItemHandler, g_oMenuCat, "sm_retake", ADMFLAG_GENERIC);
	topmenu.AddItem("rt_show", Menu_ItemHandler, g_oMenuCat, "sm_retake_spawns", ADMFLAG_GENERIC);
}

public void Menu_CategoryHandler(TopMenu topmenu, TopMenuAction action, TopMenuObject object_id, int param, char[] buffer, int maxlength)
{
	if (action == TopMenuAction_DisplayTitle || action == TopMenuAction_DisplayOption)
		strcopy(buffer, maxlength, "Retake");
}

public void Menu_ItemHandler(TopMenu topmenu, TopMenuAction action, TopMenuObject object_id, int param, char[] buffer, int maxlength)
{
	char name[32];
	topmenu.GetObjName(object_id, name, sizeof(name));
	if (action == TopMenuAction_DisplayOption)
	{
		if (StrEqual(name, "rt_toggle"))
			strcopy(buffer, maxlength, g_bActive ? "Apagar el retake" : "Prender el retake");
		else
			strcopy(buffer, maxlength, "Ver spawns del mapa");
	}
	else if (action == TopMenuAction_SelectOption)
	{
		if (StrEqual(name, "rt_toggle"))
			FakeClientCommand(param, "sm_retake %d", g_bActive ? 0 : 1);
		else
			FakeClientCommand(param, "sm_retake_spawns");
		if (g_hAdminMenu != null && g_oMenuCat != INVALID_TOPMENUOBJECT)
			g_hAdminMenu.DisplayCategory(g_oMenuCat, param);
	}
}
