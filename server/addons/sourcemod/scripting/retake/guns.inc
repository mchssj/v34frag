/**
 * !guns: menú con las armas comunes de retake. La elección se guarda con clientprefs y se aplica
 * desde la ronda siguiente. "Quiero AWP" anota al jugador en el sorteo de cada ronda de full buy.
 */

#if defined _retake_guns_included
	#endinput
#endif
#define _retake_guns_included

#define GUN_T_PRIMARY 0
#define GUN_T_PISTOL 1
#define GUN_CT_PRIMARY 2
#define GUN_CT_PISTOL 3
#define GUN_T_FORCE 4
#define GUN_CT_FORCE 5
#define GUN_SLOTS 6
#define GUN_OPTIONS 4
#define FORCE_ONLY_DEAGLE 2   // en los casilleros de force: esta opción no lleva la pistola elegida

// Clase y nombre de cada opción, por casillero. La primera es la que se usa sin elección.
static const char g_sGunClass[GUN_SLOTS][GUN_OPTIONS][24] = {
	{ "weapon_ak47", "weapon_galil", "weapon_sg552", "" },
	{ "weapon_glock", "weapon_deagle", "weapon_p228", "weapon_elite" },
	{ "weapon_m4a1", "weapon_famas", "weapon_aug", "weapon_scout" },
	{ "weapon_usp", "weapon_deagle", "weapon_p228", "weapon_fiveseven" },
	{ "weapon_galil", "weapon_mp5navy", "weapon_deagle", "" },
	{ "weapon_famas", "weapon_mp5navy", "weapon_deagle", "" }
};
static const char g_sGunName[GUN_SLOTS][GUN_OPTIONS][16] = {
	{ "AK-47", "Galil", "SG 552", "" },
	{ "Glock", "Deagle", "P228", "Dual Elites" },
	{ "M4A1", "FAMAS", "AUG", "Scout" },
	{ "USP", "Deagle", "P228", "Five-SeveN" },
	{ "Galil", "MP5", "Solo Deagle", "" },
	{ "FAMAS", "MP5", "Solo Deagle", "" }
};
static const char g_sSlotName[GUN_SLOTS][16] = { "Primaria T", "Pistola T", "Primaria CT", "Pistola CT", "Force T", "Force CT" };

Handle g_hCookieGun[GUN_SLOTS];
Handle g_hCookieAwp;
Handle g_hCookieScout;
Handle g_hCookieSeen;
int g_iGun[MAXPLAYERS + 1][GUN_SLOTS];
bool g_bWantsAwp[MAXPLAYERS + 1];
bool g_bWantsScout[MAXPLAYERS + 1];
bool g_bSeenMenu[MAXPLAYERS + 1];

void Guns_Init()
{
	g_hCookieGun[GUN_T_PRIMARY] = RegClientCookie("retake_t_primary", "Retake: primaria de T", CookieAccess_Private);
	g_hCookieGun[GUN_T_PISTOL] = RegClientCookie("retake_t_pistol", "Retake: pistola de T", CookieAccess_Private);
	g_hCookieGun[GUN_CT_PRIMARY] = RegClientCookie("retake_ct_primary", "Retake: primaria de CT", CookieAccess_Private);
	g_hCookieGun[GUN_CT_PISTOL] = RegClientCookie("retake_ct_pistol", "Retake: pistola de CT", CookieAccess_Private);
	g_hCookieGun[GUN_T_FORCE] = RegClientCookie("retake_t_force", "Retake: force de T", CookieAccess_Private);
	g_hCookieGun[GUN_CT_FORCE] = RegClientCookie("retake_ct_force", "Retake: force de CT", CookieAccess_Private);
	g_hCookieAwp = RegClientCookie("retake_awp", "Retake: anotado para la AWP", CookieAccess_Private);
	g_hCookieScout = RegClientCookie("retake_scout", "Retake: anotado para la Scout en force", CookieAccess_Private);
	g_hCookieSeen = RegClientCookie("retake_seen", "Retake: ya vio el menú de armas", CookieAccess_Private);
	RegConsoleCmd("sm_guns", Cmd_Guns, "Elegir armas del retake.");
}

void Guns_Reset(int client)
{
	for (int s = 0; s < GUN_SLOTS; s++)
		g_iGun[client][s] = 0;
	g_bWantsAwp[client] = false;
	g_bWantsScout[client] = false;
	g_bSeenMenu[client] = false;
}

public void OnClientCookiesCached(int client)
{
	char value[8];
	for (int s = 0; s < GUN_SLOTS; s++)
	{
		GetClientCookie(client, g_hCookieGun[s], value, sizeof(value));
		int gun = StringToInt(value);
		// Un valor fuera de la lista (por una lista vieja) vuelve a la opción por defecto.
		g_iGun[client][s] = (gun >= 0 && gun < GUN_OPTIONS && g_sGunClass[s][gun][0]) ? gun : 0;
	}
	GetClientCookie(client, g_hCookieAwp, value, sizeof(value));
	g_bWantsAwp[client] = StringToInt(value) == 1;
	GetClientCookie(client, g_hCookieScout, value, sizeof(value));
	g_bWantsScout[client] = StringToInt(value) == 1;
	GetClientCookie(client, g_hCookieSeen, value, sizeof(value));
	g_bSeenMenu[client] = StringToInt(value) == 1;
}

/** El menú se abre solo la primera vez que el jugador entra con el modo prendido. */
void Guns_ShowFirstTime(int client)
{
	if (g_bSeenMenu[client] || IsFakeClient(client) || !AreClientCookiesCached(client))
		return;
	g_bSeenMenu[client] = true;
	SetClientCookie(client, g_hCookieSeen, "1");
	Guns_ShowMain(client);
}

void Guns_ShowMain(int client)
{
	Menu menu = new Menu(Guns_MainHandler);
	menu.SetTitle("Armas del retake (se aplican la próxima ronda)");
	char info[4], label[64];
	for (int s = 0; s < GUN_SLOTS; s++)
	{
		IntToString(s, info, sizeof(info));
		Format(label, sizeof(label), "%s: %s", g_sSlotName[s], g_sGunName[s][g_iGun[client][s]]);
		menu.AddItem(info, label);
	}
	Format(label, sizeof(label), "Quiero AWP (CT, full buy): %s", g_bWantsAwp[client] ? "Sí" : "No");
	menu.AddItem("awp", label);
	Format(label, sizeof(label), "Quiero Scout (CT, force): %s", g_bWantsScout[client] ? "Sí" : "No");
	menu.AddItem("scout", label);
	menu.Pagination = MENU_NO_PAGINATION;   // 8 opciones: entran todas en una sola página
	menu.ExitButton = true;
	menu.Display(client, MENU_TIME_FOREVER);
}

public int Guns_MainHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char info[4];
		menu.GetItem(item, info, sizeof(info));
		if (StrEqual(info, "awp"))
		{
			g_bWantsAwp[client] = !g_bWantsAwp[client];
			SetClientCookie(client, g_hCookieAwp, g_bWantsAwp[client] ? "1" : "0");
			Guns_ShowMain(client);
		}
		else if (StrEqual(info, "scout"))
		{
			g_bWantsScout[client] = !g_bWantsScout[client];
			SetClientCookie(client, g_hCookieScout, g_bWantsScout[client] ? "1" : "0");
			Guns_ShowMain(client);
		}
		else
			Guns_ShowSlot(client, StringToInt(info));
	}
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

void Guns_ShowSlot(int client, int slot)
{
	Menu menu = new Menu(Guns_SlotHandler);
	menu.SetTitle(g_sSlotName[slot]);
	char info[8];
	for (int i = 0; i < GUN_OPTIONS; i++)
	{
		if (!g_sGunClass[slot][i][0])
			continue;
		Format(info, sizeof(info), "%d %d", slot, i);
		menu.AddItem(info, g_sGunName[slot][i]);
	}
	menu.ExitBackButton = true;
	menu.Display(client, MENU_TIME_FOREVER);
}

public int Guns_SlotHandler(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_Select)
	{
		char info[8], parts[2][4];
		menu.GetItem(item, info, sizeof(info));
		ExplodeString(info, " ", parts, 2, 4);
		int slot = StringToInt(parts[0]);
		g_iGun[client][slot] = StringToInt(parts[1]);
		SetClientCookie(client, g_hCookieGun[slot], parts[1]);
		Guns_ShowMain(client);
	}
	else if (action == MenuAction_Cancel && item == MenuCancel_ExitBack)
		Guns_ShowMain(client);
	else if (action == MenuAction_End)
		delete menu;
	return 0;
}

public Action Cmd_Guns(int client, int args)
{
	if (client > 0 && IsClientInGame(client))
		Guns_ShowMain(client);
	return Plugin_Handled;
}

/** Texto con las armas que recibió el jugador esta ronda. */
void Guns_Describe(int client, int side, bool pistolRound, bool forceRound, bool awp, bool scout, char[] out, int maxlen)
{
	int pistol = side == SIDE_T ? GUN_T_PISTOL : GUN_CT_PISTOL;
	int primary = side == SIDE_T ? GUN_T_PRIMARY : GUN_CT_PRIMARY;
	if (pistolRound)
		strcopy(out, maxlen, g_sGunName[pistol][g_iGun[client][pistol]]);
	else if (forceRound)
	{
		int slot = side == SIDE_T ? GUN_T_FORCE : GUN_CT_FORCE;
		if (scout)
			Format(out, maxlen, "Scout + %s", g_sGunName[pistol][g_iGun[client][pistol]]);
		else if (Guns_ForceChoice(client, side) == FORCE_ONLY_DEAGLE)
			strcopy(out, maxlen, "Deagle");
		else
			Format(out, maxlen, "%s + %s", g_sGunName[slot][g_iGun[client][slot]], g_sGunName[pistol][g_iGun[client][pistol]]);
	}
	else
		Format(out, maxlen, "%s + %s", awp ? "AWP" : g_sGunName[primary][g_iGun[client][primary]], g_sGunName[pistol][g_iGun[client][pistol]]);
}

int Guns_ForceChoice(int client, int side)
{
#if defined RETAKE_DEBUG
	if (IsFakeClient(client))
		return g_cvDebugBotForce.IntValue;
#endif
	return g_iGun[client][side == SIDE_T ? GUN_T_FORCE : GUN_CT_FORCE];
}

/** Las armas de la ronda force, según lo que eligió el jugador. */
void Guns_GiveForce(int client, int side, bool scout)
{
	if (scout)
	{
		Guns_GivePistol(client, side);
		GivePlayerItem(client, "weapon_scout");
		return;
	}
	int choice = Guns_ForceChoice(client, side);
	if (choice != FORCE_ONLY_DEAGLE)
		Guns_GivePistol(client, side);
	GivePlayerItem(client, g_sGunClass[side == SIDE_T ? GUN_T_FORCE : GUN_CT_FORCE][choice]);
}

void Guns_GivePrimary(int client, int side)
{
	int slot = side == SIDE_T ? GUN_T_PRIMARY : GUN_CT_PRIMARY;
	GivePlayerItem(client, g_sGunClass[slot][g_iGun[client][slot]]);
}

void Guns_GivePistol(int client, int side)
{
	int slot = side == SIDE_T ? GUN_T_PISTOL : GUN_CT_PISTOL;
	GivePlayerItem(client, g_sGunClass[slot][g_iGun[client][slot]]);
}
