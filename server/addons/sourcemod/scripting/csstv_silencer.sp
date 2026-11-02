/**
 * CSSTV Silencer
 *
 * M4A1 y USP con silenciador automático (plan docs/bitacora/2026-11-02-plugin-silenciador):
 *   - solo en armas recién creadas: compra, USP inicial o entregadas por otro plugin; las del piso no se tocan;
 *   - !as abre el menú para activarlo o no en cada arma. Se guarda con clientprefs y empieza activado;
 *   - se pone antes del Deploy, así el arma aparece con su animación correcta y sin la espera del clic derecho.
 *
 * Independiente de csstv_reporter. Sin licencia.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <sdkhooks>
#include <clientprefs>

#define PLUGIN_VERSION "1.0.0"
#define MAX_ENTITIES   2048

#define GUN_M4A1 0
#define GUN_USP  1
#define GUNS     2

public Plugin myinfo =
{
	name = "CSSTV Silencer",
	author = "CMLeague",
	description = "M4A1 y USP con silenciador automático; !as para elegir",
	version = PLUGIN_VERSION,
	url = ""
};

static const char g_sClass[GUNS][] = { "weapon_m4a1", "weapon_usp" };
static const char g_sName[GUNS][] = { "M4A1", "USP" };
static const char g_sCookie[GUNS][] = { "silencer_m4a1", "silencer_usp" };

ConVar g_cvEnabled;
Handle g_hCookie[GUNS];
bool g_bWants[MAXPLAYERS + 1][GUNS];
int g_iCreatedTick[MAX_ENTITIES];

public void OnPluginStart()
{
	CreateConVar("csstv_silencer_version", PLUGIN_VERSION, "Versión de CSSTV Silencer.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvEnabled = CreateConVar("csstv_silencer", "1", "1: M4A1 y USP con silenciador automático según !as. 0: desactivado.", _, true, 0.0, true, 1.0);
	RegConsoleCmd("sm_as", Cmd_As, "!as: elegir si la M4A1 y la USP aparecen con silenciador.");
	for (int g = 0; g < GUNS; g++)
		g_hCookie[g] = RegClientCookie(g_sCookie[g], "Silenciador automático", CookieAccess_Private);
	for (int i = 1; i <= MaxClients; i++)
	{
		if (IsClientConnected(i))
			OnClientConnected(i);
		if (IsClientInGame(i))
			OnClientPutInServer(i);
		if (AreClientCookiesCached(i))
			OnClientCookiesCached(i);
	}
}

public void OnClientConnected(int client)
{
	for (int g = 0; g < GUNS; g++)
		g_bWants[client][g] = true;
}

public void OnClientPutInServer(int client)
{
	SDKHook(client, SDKHook_WeaponEquip, Hook_WeaponEquip);
}

public void OnClientCookiesCached(int client)
{
	char value[4];
	for (int g = 0; g < GUNS; g++)
	{
		GetClientCookie(client, g_hCookie[g], value, sizeof(value));
		g_bWants[client][g] = value[0] != '0';
	}
}

// ---------------------------------------------------------------------------
// El silenciador
// ---------------------------------------------------------------------------

int GunOf(const char[] classname)
{
	for (int g = 0; g < GUNS; g++)
		if (StrEqual(classname, g_sClass[g]))
			return g;
	return -1;
}

public void OnEntityCreated(int entity, const char[] classname)
{
	if (entity > MaxClients && entity < MAX_ENTITIES && GunOf(classname) != -1)
		g_iCreatedTick[entity] = GetGameTickCount();
}

public Action Hook_WeaponEquip(int client, int weapon)
{
	if (!g_cvEnabled.BoolValue || weapon <= MaxClients || weapon >= MAX_ENTITIES || g_iCreatedTick[weapon] != GetGameTickCount())
		return Plugin_Continue;
	char cls[32];
	if (!GetEdictClassname(weapon, cls, sizeof(cls)))
		return Plugin_Continue;
	int g = GunOf(cls);
	if (g != -1 && g_bWants[client][g])
		SetEntProp(weapon, Prop_Send, "m_bSilencerOn", 1);
	return Plugin_Continue;
}

// ---------------------------------------------------------------------------
// El menú
// ---------------------------------------------------------------------------

public Action Cmd_As(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (!g_cvEnabled.BoolValue)
	{
		PrintToChat(client, "[CMLeague] !as está desactivado en este servidor.");
		return Plugin_Handled;
	}
	ShowMenu(client);
	return Plugin_Handled;
}

void ShowMenu(int client)
{
	Menu menu = new Menu(Menu_As);
	menu.SetTitle("Silenciador automático");
	char info[4], line[48];
	for (int g = 0; g < GUNS; g++)
	{
		IntToString(g, info, sizeof(info));
		Format(line, sizeof(line), "%s: %s", g_sName[g], g_bWants[client][g] ? "Activado" : "Desactivado");
		menu.AddItem(info, line);
	}
	menu.ExitButton = true;
	menu.Display(client, MENU_TIME_FOREVER);
}

public int Menu_As(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
		delete menu;
	else if (action == MenuAction_Select)
	{
		char info[4];
		menu.GetItem(item, info, sizeof(info));
		int g = StringToInt(info);
		g_bWants[client][g] = !g_bWants[client][g];
		if (AreClientCookiesCached(client))
			SetClientCookie(client, g_hCookie[g], g_bWants[client][g] ? "1" : "0");
		ShowMenu(client);
	}
	return 0;
}
