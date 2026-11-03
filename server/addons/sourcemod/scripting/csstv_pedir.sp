/**
 * CSSTV Pedir
 *
 * Pedir un arma y que la pague un compañero (plan docs/bitacora/2026-11-02-qol-tanda-3):
 *   - en el freezetime, la R (recargar) abre un menú con las armas de tu lado;
 *   - tu equipo ve el pedido, y el primero que aprieta la E (usar) en la zona de compra y en el tiempo
 *     de compra te la compra: se le descuenta a él, no a vos. Si apunta a quien pidió le compra a ese;
 *     si no, al pedido más viejo;
 *   - el arma llega como una compra: la que tenías en ese lugar se tira al piso.
 *
 * Solo con el reporter en calentamiento o en vivo, y sin retake, wingman ni deathmatch prendidos.
 * Compilación de depuración (PEDIR_DEBUG=): sm_pedir_fake y sm_pedir_fakeuse para probar con bots.
 * Independiente de csstv_reporter. Sin licencia.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <cstrike>

#define PLUGIN_VERSION "1.0.1"
#define TEAM_T  2
#define TEAM_CT 3

public Plugin myinfo =
{
	name = "CSSTV Pedir",
	author = "CMLeague",
	description = "Pedir un arma con la R y que un compañero la compre con la E",
	version = PLUGIN_VERSION,
	url = ""
};

static const char g_sCat[][] = { "Pistolas", "Escopetas", "Subfusiles", "Rifles", "Francotiradores", "Ametralladora" };
// Armas: clase, nombre, precio, lado (0 los dos), categoría (0 pistolas … 5 ametralladora) y lugar (0 principal, 1 pistola).
static const char g_sGunCls[][] = { "weapon_glock", "weapon_usp", "weapon_p228", "weapon_deagle", "weapon_elite", "weapon_fiveseven", "weapon_m3", "weapon_xm1014", "weapon_mac10", "weapon_tmp", "weapon_mp5navy", "weapon_ump45", "weapon_p90", "weapon_galil", "weapon_famas", "weapon_ak47", "weapon_m4a1", "weapon_sg552", "weapon_aug", "weapon_scout", "weapon_awp", "weapon_g3sg1", "weapon_sg550", "weapon_m249" };
static const char g_sGunName[][] = { "Glock", "USP", "P228", "Deagle", "Dualies", "Five-SeveN", "M3", "XM1014", "MAC-10", "TMP", "MP5", "UMP", "P90", "Galil", "FAMAS", "AK-47", "M4A1", "SG 552", "AUG", "Scout", "AWP", "G3SG1", "SG 550", "M249" };
static const int g_iGunPrice[] = { 400, 500, 600, 650, 800, 750, 1700, 3000, 1400, 1250, 1500, 1700, 2350, 2000, 2250, 2500, 3100, 3500, 3500, 2750, 4750, 5000, 4200, 5750 };
static const int g_iGunTeam[] = { TEAM_T, TEAM_CT, 0, 0, TEAM_T, TEAM_CT, 0, 0, TEAM_T, TEAM_CT, 0, 0, 0, TEAM_T, TEAM_CT, TEAM_T, TEAM_CT, TEAM_T, TEAM_CT, 0, 0, TEAM_T, TEAM_CT, 0 };
static const int g_iGunCat[] = { 0, 0, 0, 0, 0, 0, 1, 1, 2, 2, 2, 2, 2, 3, 3, 3, 3, 3, 3, 4, 4, 4, 4, 5 };
static const int g_iGunSlot[] = { 1, 1, 1, 1, 1, 1, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0, 0 };

ConVar g_cvEnabled;
ConVar g_cvBuyTime;
ConVar g_cvTag;
char g_sState[32];
bool g_bOtherMode;
int g_iReq[MAXPLAYERS + 1] = { -1, ... };   // arma pedida (índice en g_sGunCls) o -1
float g_fReqAt[MAXPLAYERS + 1];
int g_iLastButtons[MAXPLAYERS + 1];

public void OnPluginStart()
{
	CreateConVar("csstv_pedir_version", PLUGIN_VERSION, "Versión de CSSTV Pedir.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvEnabled = CreateConVar("csstv_pedir", "1", "Pedir un arma con la R en el freezetime y que un compañero la compre con la E.", _, true, 0.0, true, 1.0);
	AutoExecConfig(true, "csstv_pedir");
	g_cvBuyTime = FindConVar("mp_buytime");


	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	CreateTimer(1.0, Timer_State, _, TIMER_REPEAT);
#if defined PEDIR_DEBUG
	RegAdminCmd("sm_pedir_fake", Cmd_Fake, ADMFLAG_ROOT, "sm_pedir_fake <jugador> <arma>: pide un arma por otro (solo depuración).");
	RegAdminCmd("sm_pedir_fakeuse", Cmd_FakeUse, ADMFLAG_ROOT, "sm_pedir_fakeuse <jugador>: aprieta la E por otro (solo depuración).");
#endif
}

public void OnConfigsExecuted()
{
	g_cvTag = FindConVar("csstv_chat_tag");
}

public void OnClientDisconnect(int client)
{
	g_iReq[client] = -1;
	g_iLastButtons[client] = 0;
}

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	for (int i = 1; i <= MaxClients; i++)
		g_iReq[i] = -1;
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

/** sm_retake_on, sm_2v2_on y sm_dm_on desde la 1.0.1 de cada modo; antes, la respuesta del comando. */
bool ModeOn(const char[] cmd)
{
	char name[32];
	Format(name, sizeof(name), "%s_on", cmd);
	ConVar on = FindConVar(name);
	if (on != null)
		return on.BoolValue;
	if (!CommandExists(cmd))
		return false;
	char out[256];
	ServerCommandEx(out, sizeof(out), cmd);
	return StrContains(out, "prendido") != -1;
}

/** ServerCommandEx desde un timer y no desde OnPlayerRunCmd. */
public Action Timer_State(Handle timer)
{
	g_sState[0] = '\0';
	ConVar state = FindConVar("csstv_state");   // reporter 2.7.7 o más nuevo: leerla no imprime nada en la consola
	if (state != null)
		state.GetString(g_sState, sizeof(g_sState));
	else if (CommandExists("sm_csstv_status"))
	{
		char buf[512];
		ServerCommandEx(buf, sizeof(buf), "sm_csstv_status");
		int at = StrContains(buf, "estado: ");
		if (at != -1)
		{
			strcopy(g_sState, sizeof(g_sState), buf[at + 8]);
			int end = StrContains(g_sState, " ·");
			if (end != -1)
				g_sState[end] = '\0';
		}
	}
	g_bOtherMode = ModeOn("sm_retake") || ModeOn("sm_2v2") || ModeOn("sm_dm");
	return Plugin_Continue;
}

bool Active()
{
	return g_cvEnabled.BoolValue && !g_bOtherMode && (StrEqual(g_sState, "calentamiento") || StrEqual(g_sState, "en vivo"));
}

bool InFreeze()
{
	return GameRules_GetProp("m_bFreezePeriod") != 0;
}

/** Igual que el juego: el tiempo de compra cuenta desde que termina el freezetime. */
bool InBuyTime()
{
	if (InFreeze())
		return true;
	float buy = g_cvBuyTime != null ? g_cvBuyTime.FloatValue * 60.0 : 15.0;
	return GetGameTime() - GameRules_GetPropFloat("m_fRoundStartTime") < buy;
}

bool OnTeam(int client)
{
	int team = GetClientTeam(client);
	return team == TEAM_T || team == TEAM_CT;
}

void Tag(char[] out, int len)
{
	if (g_cvTag != null)
		g_cvTag.GetString(out, len);
	if (!out[0])
		strcopy(out, len, "CMLeague");
}

void TeamChat(int team, const char[] fmt, any ...)
{
	char msg[192], tag[32];
	VFormat(msg, sizeof(msg), fmt, 3);
	Tag(tag, sizeof(tag));
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && GetClientTeam(i) == team)
			PrintToChat(i, "\x04[%s]\x01 %s", tag, msg);
}

// ---------------------------------------------------------------------------
// R y E
// ---------------------------------------------------------------------------

public Action OnPlayerRunCmd(int client, int &buttons, int &impulse, float vel[3], float angles[3], int &weapon)
{
	int pressed = buttons & ~g_iLastButtons[client];
	g_iLastButtons[client] = buttons;
	if (!(pressed & (IN_RELOAD | IN_USE)) || IsFakeClient(client) || !IsPlayerAlive(client) || !OnTeam(client) || !Active())
		return Plugin_Continue;
	if (pressed & IN_RELOAD && InFreeze())
		Ask_Menu(client);
	if (pressed & IN_USE)
		Buy_For(client, true);
	return Plugin_Continue;
}

void Ask_Menu(int client)
{
	Menu m = new Menu(Menu_Cat);
	m.SetTitle("Pedir un arma (la paga un compañero con la E)");
	char info[8];
	for (int c = 0; c < sizeof(g_sCat); c++)
	{
		IntToString(c, info, sizeof(info));
		m.AddItem(info, g_sCat[c]);
	}
	if (g_iReq[client] != -1)
		m.AddItem("x", "Cancelar mi pedido");
	m.Display(client, 15);
}

public int Menu_Cat(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
		delete menu;
	else if (action == MenuAction_Select)
	{
		char info[8];
		menu.GetItem(item, info, sizeof(info));
		if (info[0] == 'x')
		{
			g_iReq[client] = -1;
			TeamChat(GetClientTeam(client), "%N canceló su pedido.", client);
			return 0;
		}
		int cat = StringToInt(info), team = GetClientTeam(client);
		Menu m = new Menu(Menu_Gun);
		m.SetTitle("%s", g_sCat[cat]);
		char text[32];
		for (int i = 0; i < sizeof(g_sGunCls); i++)
		{
			if (g_iGunCat[i] != cat || (g_iGunTeam[i] && g_iGunTeam[i] != team))
				continue;
			IntToString(i, info, sizeof(info));
			Format(text, sizeof(text), "%s ($%d)", g_sGunName[i], g_iGunPrice[i]);
			m.AddItem(info, text);
		}
		m.ExitBackButton = true;
		m.Display(client, 15);
	}
	return 0;
}

public int Menu_Gun(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
		delete menu;
	else if (action == MenuAction_Cancel && item == MenuCancel_ExitBack)
		Ask_Menu(client);
	else if (action == MenuAction_Select)
	{
		char info[8];
		menu.GetItem(item, info, sizeof(info));
		Ask(client, StringToInt(info));
	}
	return 0;
}

void Ask(int client, int idx)
{
	if (!IsPlayerAlive(client) || !InBuyTime())
		return;
	g_iReq[client] = idx;
	g_fReqAt[client] = GetGameTime();
	int team = GetClientTeam(client);
	TeamChat(team, "\x04%N\x01 pide \x04%s\x01 ($%d). Apretá \x04E\x01 en la zona de compra para comprársela.", client, g_sGunName[idx], g_iGunPrice[idx]);
	for (int i = 1; i <= MaxClients; i++)
		if (i != client && IsClientInGame(i) && IsPlayerAlive(i) && GetClientTeam(i) == team)
			PrintCenterText(i, "%N pide %s ($%d): apretá E", client, g_sGunName[idx], g_iGunPrice[idx]);
}

/** La E de buyer: le compra a quien apunta si pidió algo, o al pedido más viejo de su equipo. */
void Buy_For(int buyer, bool quiet)
{
	if (!InBuyTime() || !GetEntProp(buyer, Prop_Send, "m_bInBuyZone"))
		return;
	int team = GetClientTeam(buyer);
	int target = GetClientAimTarget(buyer, true);
	if (target <= 0 || target == buyer || GetClientTeam(target) != team || g_iReq[target] == -1)
	{
		target = 0;
		for (int i = 1; i <= MaxClients; i++)
			if (i != buyer && g_iReq[i] != -1 && IsClientInGame(i) && GetClientTeam(i) == team && (!target || g_fReqAt[i] < g_fReqAt[target]))
				target = i;
	}
	if (!target)
	{
		if (!quiet)
			PrintToConsole(buyer, "[Pedir] No hay pedidos en tu equipo.");
		return;
	}
	if (!IsPlayerAlive(target))
	{
		g_iReq[target] = -1;
		return;
	}
	int idx = g_iReq[target];
	int money = GetEntProp(buyer, Prop_Send, "m_iAccount");
	if (money < g_iGunPrice[idx])
	{
		PrintCenterText(buyer, "No te alcanza para %s ($%d)", g_sGunName[idx], g_iGunPrice[idx]);
		return;
	}
	SetEntProp(buyer, Prop_Send, "m_iAccount", money - g_iGunPrice[idx]);
	int old = GetPlayerWeaponSlot(target, g_iGunSlot[idx]);
	if (old > 0)
		CS_DropWeapon(target, old, true);
	GivePlayerItem(target, g_sGunCls[idx]);
	g_iReq[target] = -1;
	TeamChat(team, "\x04%N\x01 le compró \x04%s\x01 a %N ($%d).", buyer, g_sGunName[idx], target, g_iGunPrice[idx]);
}

#if defined PEDIR_DEBUG
int FindByName(const char[] name)
{
	char n[64];
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && GetClientName(i, n, sizeof(n)) && StrEqual(n, name, false))
			return i;
	return 0;
}

public Action Cmd_Fake(int client, int args)
{
	char name[64], gun[32];
	GetCmdArg(1, name, sizeof(name));
	GetCmdArg(2, gun, sizeof(gun));
	int who = FindByName(name);
	for (int i = 0; i < sizeof(g_sGunCls); i++)
	{
		if (who && StrEqual(g_sGunCls[i][7], gun, false))
		{
			Ask(who, i);
			ReplyToCommand(client, "[Pedir] %s pidió %s.", name, g_sGunName[i]);
			return Plugin_Handled;
		}
	}
	ReplyToCommand(client, "[Pedir] No se encontró el jugador o el arma.");
	return Plugin_Handled;
}

public Action Cmd_FakeUse(int client, int args)
{
	char name[64];
	GetCmdArg(1, name, sizeof(name));
	int who = FindByName(name);
	if (who && IsPlayerAlive(who) && OnTeam(who) && Active())
		Buy_For(who, false);
	ReplyToCommand(client, "[Pedir] %s apretó la E.", name);
	return Plugin_Handled;
}
#endif
