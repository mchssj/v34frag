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
#define GUN_SLOTS 4
#define GUN_OPTIONS 4

// Clase y nombre de cada opción, por casillero. La primera es la que se usa sin elección.
static const char g_sGunClass[GUN_SLOTS][GUN_OPTIONS][24] = {
	{ "weapon_ak47", "weapon_galil", "weapon_sg552", "" },
	{ "weapon_glock", "weapon_deagle", "weapon_p228", "weapon_elite" },
	{ "weapon_m4a1", "weapon_famas", "weapon_aug", "" },
	{ "weapon_usp", "weapon_deagle", "weapon_p228", "weapon_fiveseven" }
};
static const char g_sGunName[GUN_SLOTS][GUN_OPTIONS][16] = {
	{ "AK-47", "Galil", "SG 552", "" },
	{ "Glock", "Deagle", "P228", "Dual Elites" },
	{ "M4A1", "FAMAS", "AUG", "" },
	{ "USP", "Deagle", "P228", "Five-SeveN" }
};
static const char g_sSlotName[GUN_SLOTS][16] = { "Primaria T", "Pistola T", "Primaria CT", "Pistola CT" };

Handle g_hCookieGun[GUN_SLOTS];
Handle g_hCookieAwp;
Handle g_hCookieSeen;
int g_iGun[MAXPLAYERS + 1][GUN_SLOTS];
bool g_bWantsAwp[MAXPLAYERS + 1];
bool g_bSeenMenu[MAXPLAYERS + 1];

void Guns_Init()
{
	g_hCookieGun[GUN_T_PRIMARY] = RegClientCookie("retake_t_primary", "Retake: primaria de T", CookieAccess_Private);
	g_hCookieGun[GUN_T_PISTOL] = RegClientCookie("retake_t_pistol", "Retake: pistola de T", CookieAccess_Private);
	g_hCookieGun[GUN_CT_PRIMARY] = RegClientCookie("retake_ct_primary", "Retake: primaria de CT", CookieAccess_Private);
	g_hCookieGun[GUN_CT_PISTOL] = RegClientCookie("retake_ct_pistol", "Retake: pistola de CT", CookieAccess_Private);
	g_hCookieAwp = RegClientCookie("retake_awp", "Retake: anotado para la AWP", CookieAccess_Private);
	g_hCookieSeen = RegClientCookie("retake_seen", "Retake: ya vio el menú de armas", CookieAccess_Private);
	RegConsoleCmd("sm_guns", Cmd_Guns, "Elegir armas del retake.");
}

void Guns_Reset(int client)
{
	for (int s = 0; s < GUN_SLOTS; s++)
		g_iGun[client][s] = 0;
	g_bWantsAwp[client] = false;
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
	Format(label, sizeof(label), "Quiero AWP: %s", g_bWantsAwp[client] ? "Sí" : "No");
	menu.AddItem("awp", label);
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
void Guns_Describe(int client, int side, bool pistolRound, bool awp, char[] out, int maxlen)
{
	int pistol = side == SIDE_T ? GUN_T_PISTOL : GUN_CT_PISTOL;
	int primary = side == SIDE_T ? GUN_T_PRIMARY : GUN_CT_PRIMARY;
	if (pistolRound)
		strcopy(out, maxlen, g_sGunName[pistol][g_iGun[client][pistol]]);
	else
		Format(out, maxlen, "%s + %s", awp ? "AWP" : g_sGunName[primary][g_iGun[client][primary]], g_sGunName[pistol][g_iGun[client][pistol]]);
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
