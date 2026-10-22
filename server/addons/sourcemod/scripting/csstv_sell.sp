/**
 * CSSTV Sell
 *
 * !sell: vender lo comprado en la ronda (plan docs/bitacora/2026-10-18-plugin-sell):
 *   - solo lo comprado en esta ronda y que sigue siendo tuyo (no lo de la ronda anterior ni lo levantado del piso);
 *   - desde que empieza la ronda hasta 5 s después del fin del freezetime (la pausa táctica lo alarga solo);
 *   - devuelve lo que pagaste, sin pasar de 16 000;
 *   - !sell abre el menú; !sell all vende todo sin menú.
 *
 * Cómo sabe qué compraste: antes de cada comando de compra saca una foto del jugador (plata, armas, chaleco,
 * kit, visión nocturna, granadas) y un frame después la compara. Lo nuevo queda anotado con lo que costó: la
 * plata que se le descontó, repartida con la tabla de precios si fueron varias cosas a la vez (autobuy, rebuy).
 *
 * Al vender un arma no vuelve la que el juego tiró al comprarla. Un arma disparada se vende igual. Se vende en
 * cualquier lado del mapa. Independiente de csstv_reporter. Sin licencia.
 * Compilación de depuración (SELL_DEBUG=): escribe en el log las compras, ventas y mensajes, y agrega
 * csstv_sell_fakecmd para que un bot ejecute comandos.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>

#define PLUGIN_VERSION "1.0.1"
#define MAX_MONEY      16000
#define TEAM_T         2
#define TEAM_CT        3

// Lo que se puede vender: una anotación por tipo y por jugador.
#define KIND_PRIMARY   0
#define KIND_SECONDARY 1
#define KIND_ARMOR     2
#define KIND_DEFUSER   3
#define KIND_NVG       4
#define KIND_HE        5
#define KIND_FLASH     6
#define KIND_SMOKE     7
#define KINDS          8
#define NADES          3     // KIND_HE, KIND_FLASH, KIND_SMOKE

public Plugin myinfo =
{
	name = "CSSTV Sell",
	author = "CMLeague",
	description = "!sell: vender lo comprado en la ronda hasta 5 s después del freezetime",
	version = PLUGIN_VERSION,
	url = ""
};

// Precios de v34 (solo para repartir la plata cuando se compran varias cosas a la vez).
static const char g_sWeapon[][] = { "glock", "usp", "p228", "deagle", "elite", "fiveseven", "m3", "xm1014", "mac10", "tmp",
	"mp5navy", "ump45", "p90", "galil", "famas", "ak47", "m4a1", "sg552", "aug", "scout", "awp", "g3sg1", "sg550", "m249" };
static const char g_sWeaponName[][] = { "Glock", "USP", "P228", "Desert Eagle", "Dual Elites", "Five-SeveN", "M3", "XM1014",
	"MAC-10", "TMP", "MP5", "UMP45", "P90", "Galil", "FAMAS", "AK-47", "M4A1", "SG 552", "AUG", "Scout", "AWP", "G3SG1", "SG 550", "M249" };
static const int g_iWeaponPrice[] = { 400, 500, 600, 650, 800, 750, 1700, 3000, 1400, 1250,
	1500, 1700, 2350, 2000, 2250, 2500, 3100, 3500, 3500, 2750, 4750, 5000, 4200, 5750 };
static const char g_sNade[][] = { "weapon_hegrenade", "weapon_flashbang", "weapon_smokegrenade" };
static const char g_sNadeName[][] = { "Granada HE", "Flash", "Humo" };
static const int g_iNadePrice[] = { 300, 200, 300 };
#define PRICE_VEST     650
#define PRICE_VESTHELM 1000
#define PRICE_HELMET   350
#define PRICE_DEFUSER  200
#define PRICE_NVG      1250

ConVar g_cvEnabled;
ConVar g_cvWindow;
bool g_bRoundOver;

// Foto de un jugador: la de antes del comando de compra se compara con la de un frame después.
#define S_MONEY        0
#define S_WEAPON       1     // 1 y 2: referencias de entidad de las ranuras 0 y 1
#define S_ARMOR        3
#define S_HELMET       4
#define S_DEFUSER      5
#define S_NVG          6
#define S_NADE         7     // 7 a 9: cantidad de cada granada
#define S_FIELDS       10
int g_iBefore[MAXPLAYERS + 1][S_FIELDS];
bool g_bPending[MAXPLAYERS + 1];

// Lo comprado en la ronda.
int g_iPaid[MAXPLAYERS + 1][KINDS];         // 0 = nada anotado
int g_iWeaponRef[MAXPLAYERS + 1][2];
int g_iArmorBefore[MAXPLAYERS + 1], g_iArmorAfter[MAXPLAYERS + 1];
bool g_bHelmBefore[MAXPLAYERS + 1], g_bHelmAfter[MAXPLAYERS + 1];
int g_iNadeBase[MAXPLAYERS + 1][NADES];     // las que tenía antes de la primera compra de la ronda
int g_iNadeBought[MAXPLAYERS + 1][NADES];

bool g_bMenuOpen[MAXPLAYERS + 1];

public APLRes AskPluginLoad2(Handle myself, bool late, char[] error, int err_max)
{
	MarkNativeAsOptional("CM_GetClientModAuth");
	return APLRes_Success;
}

public void OnPluginStart()
{
	CreateConVar("csstv_sell_version", PLUGIN_VERSION, "Versión de CSSTV Sell.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvEnabled = CreateConVar("csstv_sell", "1", "1: !sell vende lo comprado en la ronda. 0: desactivado.", _, true, 0.0, true, 1.0);
	g_cvWindow = CreateConVar("csstv_sell_window", "5", "Segundos después del fin del freezetime en los que todavía se puede vender.", _, true, 0.0, true, 60.0);
	RegConsoleCmd("sm_sell", Cmd_Sell, "!sell: menú para vender lo comprado en la ronda. !sell all: vender todo.");
	AddCommandListener(Cmd_Buy, "buy");
	AddCommandListener(Cmd_Buy, "autobuy");
	AddCommandListener(Cmd_Buy, "rebuy");
	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	HookEvent("round_end", Event_RoundEnd, EventHookMode_PostNoCopy);
	CreateTimer(1.0, Timer_RefreshMenus, _, TIMER_REPEAT);
#if defined SELL_DEBUG
	RegAdminCmd("csstv_sell_fakecmd", Cmd_DebugFake, ADMFLAG_ROOT, "csstv_sell_fakecmd <userid> <comando>: un bot ejecuta un comando (solo depuración).");
	RegAdminCmd("csstv_sell_fakebuy", Cmd_DebugBuy, ADMFLAG_ROOT, "csstv_sell_fakebuy <userid> <ítem> [<ítem>…]: compra simulada en el mismo frame (los bots no obedecen buy; solo depuración).");
	RegAdminCmd("csstv_sell_dump", Cmd_DebugDump, ADMFLAG_ROOT, "csstv_sell_dump <userid> [chaleco|-] [plata|-] [flashes]: inventario del jugador; con chaleco, plata o cantidad de flashes, se los pone en ese valor (solo depuración).");
#endif
}

public void OnClientConnected(int client)
{
	ClearClient(client);
}

void ClearClient(int client)
{
	g_bPending[client] = false;
	g_bMenuOpen[client] = false;
	for (int k = 0; k < KINDS; k++)
		g_iPaid[client][k] = 0;
	g_iWeaponRef[client][0] = INVALID_ENT_REFERENCE;
	g_iWeaponRef[client][1] = INVALID_ENT_REFERENCE;
	for (int n = 0; n < NADES; n++)
	{
		g_iNadeBase[client][n] = 0;
		g_iNadeBought[client][n] = 0;
	}
}

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	g_bRoundOver = false;
	for (int i = 1; i <= MaxClients; i++)
	{
		bool open = g_bMenuOpen[i];
		ClearClient(i);
		if (open && IsClientInGame(i))
			CancelClientMenu(i);
	}
}

public void Event_RoundEnd(Event event, const char[] name, bool dontBroadcast)
{
	g_bRoundOver = true;
	for (int i = 1; i <= MaxClients; i++)
		if (g_bMenuOpen[i] && IsClientInGame(i))
		{
			g_bMenuOpen[i] = false;
			CancelClientMenu(i);
		}
}

// ---------------------------------------------------------------------------
// La ventana de venta
// ---------------------------------------------------------------------------

/** Segundos que quedan para vender (0 o menos: ya no se puede). m_fRoundStartTime es el fin del freezetime. */
float WindowLeft()
{
	if (g_bRoundOver)
		return 0.0;
	return GameRules_GetPropFloat("m_fRoundStartTime") + g_cvWindow.FloatValue - GetGameTime();
}

bool InFreezeTime()
{
	return GameRules_GetProp("m_bFreezePeriod") != 0;
}

// ---------------------------------------------------------------------------
// Las compras
// ---------------------------------------------------------------------------

int Money(int client)
{
	return GetEntProp(client, Prop_Send, "m_iAccount");
}

/** Entidad de la granada n que lleva el jugador, o -1. */
int FindNade(int client, int n)
{
	int size = GetEntPropArraySize(client, Prop_Send, "m_hMyWeapons");
	char cls[32];
	for (int i = 0; i < size; i++)
	{
		int w = GetEntPropEnt(client, Prop_Send, "m_hMyWeapons", i);
		if (w > MaxClients && IsValidEdict(w) && GetEdictClassname(w, cls, sizeof(cls)) && StrEqual(cls, g_sNade[n]))
			return w;
	}
	return -1;
}

int NadeCount(int client, int n)
{
	int w = FindNade(client, n);
	if (w == -1)
		return 0;
	int type = GetEntProp(w, Prop_Send, "m_iPrimaryAmmoType");
	return type < 0 ? 0 : GetEntProp(client, Prop_Send, "m_iAmmo", _, type);
}

void TakeSnapshot(int client, int[] s)
{
	s[S_MONEY] = Money(client);
	for (int slot = 0; slot < 2; slot++)
	{
		int w = GetPlayerWeaponSlot(client, slot);
		s[S_WEAPON + slot] = w == -1 ? INVALID_ENT_REFERENCE : EntIndexToEntRef(w);
	}
	s[S_ARMOR] = GetEntProp(client, Prop_Send, "m_ArmorValue");
	s[S_HELMET] = GetEntProp(client, Prop_Send, "m_bHasHelmet");
	s[S_DEFUSER] = GetEntProp(client, Prop_Send, "m_bHasDefuser");
	s[S_NVG] = GetEntProp(client, Prop_Send, "m_bHasNightVision");
	for (int n = 0; n < NADES; n++)
		s[S_NADE + n] = NadeCount(client, n);
}

public Action Cmd_Buy(int client, const char[] command, int argc)
{
	if (!g_cvEnabled.BoolValue || client <= 0 || client > MaxClients || !IsClientInGame(client) || !IsPlayerAlive(client))
		return Plugin_Continue;
#if defined SELL_DEBUG
	char args[64];
	GetCmdArgString(args, sizeof(args));
	LogMessage("[sell] %N: %s %s (zona de compra %d)", client, command, args, GetEntProp(client, Prop_Send, "m_bInBuyZone"));
#endif
	// Varias compras en el mismo frame (un bind con varios buy) se comparan juntas contra la primera foto.
	if (!g_bPending[client])
	{
		TakeSnapshot(client, g_iBefore[client]);
		g_bPending[client] = true;
		RequestFrame(Frame_AfterBuy, GetClientUserId(client));
	}
	return Plugin_Continue;
}

int WeaponIndex(int w)
{
	char cls[32];
	if (!GetEdictClassname(w, cls, sizeof(cls)) || StrContains(cls, "weapon_") != 0)
		return -1;
	for (int i = 0; i < sizeof(g_sWeapon); i++)
		if (StrEqual(cls[7], g_sWeapon[i]))
			return i;
	return -1;
}

public void Frame_AfterBuy(int userid)
{
	int client = GetClientOfUserId(userid);
	if (!client)
		return;
	g_bPending[client] = false;
	if (!IsClientInGame(client) || !IsPlayerAlive(client))
		return;
	int b[S_FIELDS], a[S_FIELDS];
	for (int f = 0; f < S_FIELDS; f++)
		b[f] = g_iBefore[client][f];
	TakeSnapshot(client, a);
	int spent = b[S_MONEY] - a[S_MONEY];
	if (spent <= 0)
		return;

	// Lo nuevo, con su precio de tabla. Las granadas, de a una por compra.
	int kinds[KINDS], table[KINDS], total;
	int count;
	for (int slot = 0; slot < 2; slot++)
	{
		int w = EntRefToEntIndex(a[S_WEAPON + slot]);
		if (w == -1 || a[S_WEAPON + slot] == b[S_WEAPON + slot])
			continue;
		int i = WeaponIndex(w);
		kinds[count] = slot;
		table[count] = i == -1 ? 0 : g_iWeaponPrice[i];
		count++;
	}
	bool armorUp = a[S_ARMOR] > b[S_ARMOR], helmUp = a[S_HELMET] && !b[S_HELMET];
	if (armorUp || helmUp)
	{
		kinds[count] = KIND_ARMOR;
		table[count] = armorUp && helmUp ? PRICE_VESTHELM : (armorUp ? PRICE_VEST : PRICE_HELMET);
		count++;
	}
	if (a[S_DEFUSER] && !b[S_DEFUSER])
	{
		kinds[count] = KIND_DEFUSER;
		table[count++] = PRICE_DEFUSER;
	}
	if (a[S_NVG] && !b[S_NVG])
	{
		kinds[count] = KIND_NVG;
		table[count++] = PRICE_NVG;
	}
	for (int n = 0; n < NADES; n++)
		if (a[S_NADE + n] > b[S_NADE + n])
		{
			kinds[count] = KIND_HE + n;
			table[count++] = g_iNadePrice[n] * (a[S_NADE + n] - b[S_NADE + n]);
		}
	if (!count)
		return;
	for (int c = 0; c < count; c++)
		total += table[c];

	// El precio de cada cosa: la plata descontada. Si son varias y la tabla no da la misma suma, se reparte la
	// plata en orden con la tabla y la última se lleva lo que sobra: nunca se devuelve más de lo que se pagó.
	int left = spent;
	for (int c = 0; c < count; c++)
	{
		int price;
		if (count == 1)
			price = spent;
		else if (total == spent)
			price = table[c];
		else
			price = c == count - 1 ? left : (table[c] < left ? table[c] : left);
		left -= price;
		Record(client, kinds[c], price, b, a);
	}
#if defined SELL_DEBUG
	LogMessage("[sell] %N compró %d cosa(s) por $%d (tabla $%d)", client, count, spent, total);
#endif
}

void Record(int client, int kind, int price, const int[] b, const int[] a)
{
	if (kind == KIND_PRIMARY || kind == KIND_SECONDARY)
	{
		g_iPaid[client][kind] = price;   // otra compra en la misma ranura reemplaza a la anterior (que quedó en el piso)
		g_iWeaponRef[client][kind] = a[S_WEAPON + kind];
	}
	else if (kind == KIND_ARMOR)
	{
		if (!g_iPaid[client][kind])
		{
			g_iArmorBefore[client] = b[S_ARMOR];
			g_bHelmBefore[client] = b[S_HELMET] != 0;
		}
		g_iPaid[client][kind] += price;
		g_iArmorAfter[client] = a[S_ARMOR];
		g_bHelmAfter[client] = a[S_HELMET] != 0;
	}
	else if (kind >= KIND_HE)
	{
		int n = kind - KIND_HE;
		if (!g_iNadeBought[client][n])
			g_iNadeBase[client][n] = b[S_NADE + n];
		g_iNadeBought[client][n] += a[S_NADE + n] - b[S_NADE + n];
		g_iPaid[client][kind] += price;
	}
	else
		g_iPaid[client][kind] = price;
#if defined SELL_DEBUG
	char name[32];
	KindName(client, kind, name, sizeof(name));
	LogMessage("[sell] %N anotado: %s $%d", client, name, price);
#endif
}

// ---------------------------------------------------------------------------
// Qué se puede vender
// ---------------------------------------------------------------------------

/** Cuántas unidades de ese tipo se pueden vender ahora (armas, chaleco, kit y visión: 0 o 1). */
int Sellable(int client, int kind)
{
	if (!g_iPaid[client][kind])
		return 0;
	switch (kind)
	{
		case KIND_PRIMARY, KIND_SECONDARY:
		{
			int w = EntRefToEntIndex(g_iWeaponRef[client][kind]);
			return w != -1 && GetPlayerWeaponSlot(client, kind) == w && GetEntPropEnt(w, Prop_Send, "m_hOwnerEntity") == client ? 1 : 0;
		}
		case KIND_ARMOR:
			return GetEntProp(client, Prop_Send, "m_ArmorValue") == g_iArmorAfter[client]
				&& (GetEntProp(client, Prop_Send, "m_bHasHelmet") != 0) == g_bHelmAfter[client] ? 1 : 0;
		case KIND_DEFUSER:
			return GetEntProp(client, Prop_Send, "m_bHasDefuser") != 0 ? 1 : 0;
		case KIND_NVG:
			return GetEntProp(client, Prop_Send, "m_bHasNightVision") != 0 ? 1 : 0;
	}
	int n = kind - KIND_HE;
	int extra = NadeCount(client, n) - g_iNadeBase[client][n];
	return extra < g_iNadeBought[client][n] ? (extra < 0 ? 0 : extra) : g_iNadeBought[client][n];
}

/** Lo que devuelve vender una unidad. */
int UnitPrice(int client, int kind)
{
	if (kind >= KIND_HE)
	{
		int n = kind - KIND_HE;
		return g_iNadeBought[client][n] ? g_iPaid[client][kind] / g_iNadeBought[client][n] : 0;
	}
	return g_iPaid[client][kind];
}

void KindName(int client, int kind, char[] name, int len)
{
	switch (kind)
	{
		case KIND_PRIMARY, KIND_SECONDARY:
		{
			int w = EntRefToEntIndex(g_iWeaponRef[client][kind]);
			int i = w == -1 ? -1 : WeaponIndex(w);
			strcopy(name, len, i == -1 ? "Arma" : g_sWeaponName[i]);
		}
		case KIND_ARMOR:
		{
			bool vest = g_iArmorAfter[client] > g_iArmorBefore[client], helm = g_bHelmAfter[client] && !g_bHelmBefore[client];
			strcopy(name, len, vest && helm ? "Chaleco + casco" : (vest ? "Chaleco" : "Casco"));
		}
		case KIND_DEFUSER:
			strcopy(name, len, "Kit de desactivación");
		case KIND_NVG:
			strcopy(name, len, "Visión nocturna");
		default:
			strcopy(name, len, g_sNadeName[kind - KIND_HE]);
	}
}

// ---------------------------------------------------------------------------
// La venta
// ---------------------------------------------------------------------------

/** Saca el arma al jugador; si la tenía en la mano, pasa a la mejor que le quede. */
void RemoveWeapon(int client, int w)
{
	bool active = GetEntPropEnt(client, Prop_Send, "m_hActiveWeapon") == w;
	RemovePlayerItem(client, w);
	AcceptEntityInput(w, "Kill");
	if (!active)
		return;
	char cls[32];
	for (int slot = 0; slot < 4; slot++)
	{
		int other = GetPlayerWeaponSlot(client, slot);
		if (other != -1 && other != w && GetEdictClassname(other, cls, sizeof(cls)))
		{
			FakeClientCommandEx(client, "use %s", cls);
			return;
		}
	}
}

/** Vende una unidad de ese tipo. Devuelve lo que se le devolvió al jugador (0 si no se pudo). */
int SellOne(int client, int kind)
{
	if (!Sellable(client, kind))
		return 0;
	int price = UnitPrice(client, kind);
	switch (kind)
	{
		case KIND_PRIMARY, KIND_SECONDARY:
		{
			RemoveWeapon(client, EntRefToEntIndex(g_iWeaponRef[client][kind]));
			g_iPaid[client][kind] = 0;
		}
		case KIND_ARMOR:
		{
			SetEntProp(client, Prop_Send, "m_ArmorValue", g_iArmorBefore[client]);
			SetEntProp(client, Prop_Send, "m_bHasHelmet", g_bHelmBefore[client]);
			g_iPaid[client][kind] = 0;
		}
		case KIND_DEFUSER:
		{
			SetEntProp(client, Prop_Send, "m_bHasDefuser", 0);
			g_iPaid[client][kind] = 0;
		}
		case KIND_NVG:
		{
			SetEntProp(client, Prop_Send, "m_bNightVisionOn", 0);
			SetEntProp(client, Prop_Send, "m_bHasNightVision", 0);
			g_iPaid[client][kind] = 0;
		}
		default:
		{
			int n = kind - KIND_HE;
			int w = FindNade(client, n);
			int type = GetEntProp(w, Prop_Send, "m_iPrimaryAmmoType");
			int have = GetEntProp(client, Prop_Send, "m_iAmmo", _, type);
			if (have <= 1)
			{
				SetEntProp(client, Prop_Send, "m_iAmmo", 0, _, type);
				RemoveWeapon(client, w);
			}
			else
				SetEntProp(client, Prop_Send, "m_iAmmo", have - 1, _, type);
			g_iPaid[client][kind] -= price;
			g_iNadeBought[client][n]--;
		}
	}
	int money = Money(client) + price;
	SetEntProp(client, Prop_Send, "m_iAccount", money > MAX_MONEY ? MAX_MONEY : money);
	return price;
}

/** Comprueba que el jugador puede vender ahora; si no, le dice por qué. */
bool CanSell(int client)
{
	if (!g_cvEnabled.BoolValue)
	{
		SellChat(client, "!sell está desactivado en este servidor.");
		return false;
	}
	int team = GetClientTeam(client);
	if ((team != TEAM_T && team != TEAM_CT) || !IsPlayerAlive(client))
	{
		SellChat(client, "Solo los jugadores vivos pueden vender.");
		return false;
	}
	if (WindowLeft() <= 0.0)
	{
		SellChat(client, "Ya no se puede vender: solo hasta %d s después del freezetime.", g_cvWindow.IntValue);
		return false;
	}
	return true;
}

bool HasSellable(int client)
{
	for (int k = 0; k < KINDS; k++)
		if (Sellable(client, k))
			return true;
	return false;
}

/** Avisa lo vendido: "Vendiste AK-47: +$2500" (y si llegó al tope de plata). */
void ReportSale(int client, const char[] what, int refund, int moneyBefore)
{
	int got = Money(client) - moneyBefore;
	if (got < refund)
		SellChat(client, "Vendiste %s: {#verde}+$%d{#normal} (llegaste al tope de $%d).", what, got, MAX_MONEY);
	else
		SellChat(client, "Vendiste %s: {#verde}+$%d{#normal}.", what, refund);
}

void SellAll(int client)
{
	int moneyBefore = Money(client), refund, items;
	char what[32];
	for (int k = 0; k < KINDS; k++)
	{
		if (Sellable(client, k))
			KindName(client, k, what, sizeof(what));   // si es una sola cosa, el aviso la nombra
		int got;
		while ((got = SellOne(client, k)) > 0)
		{
			refund += got;
			items++;
		}
	}
	if (!items)
		SellChat(client, "No compraste nada en esta ronda que puedas vender.");
	else
		ReportSale(client, items == 1 ? what : "todo", refund, moneyBefore);
}

public Action Cmd_Sell(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client) || !CanSell(client))
		return Plugin_Handled;
	char arg[16];
	GetCmdArg(1, arg, sizeof(arg));
	if (StrEqual(arg, "all", false) || StrEqual(arg, "todo", false))
	{
		SellAll(client);
		return Plugin_Handled;
	}
	if (!HasSellable(client))
	{
		SellChat(client, "No compraste nada en esta ronda que puedas vender.");
		return Plugin_Handled;
	}
	ShowSellMenu(client);
	return Plugin_Handled;
}

// ---------------------------------------------------------------------------
// El menú
// ---------------------------------------------------------------------------

void ShowSellMenu(int client)
{
	Menu menu = new Menu(Menu_Sell);
	float left = WindowLeft();
	if (InFreezeTime() && left > 60.0)
		menu.SetTitle("Vender (hasta %d s después del freezetime)", g_cvWindow.IntValue);
	else
		menu.SetTitle("Vender (te quedan %d s)", RoundToCeil(left));
	char info[4], name[32], line[64];
	int all;
	for (int k = 0; k < KINDS; k++)
	{
		int units = Sellable(client, k);
		if (!units)
			continue;
		int price = UnitPrice(client, k);
		all += price * units;
		KindName(client, k, name, sizeof(name));
		if (units > 1)
			Format(line, sizeof(line), "%s (x%d) - $%d c/u", name, units, price);
		else
			Format(line, sizeof(line), "%s - $%d", name, price);
		IntToString(k, info, sizeof(info));
		menu.AddItem(info, line);
	}
	Format(line, sizeof(line), "Vender todo - $%d", all);
	menu.AddItem("all", line);
	menu.ExitButton = true;
	menu.Display(client, MENU_TIME_FOREVER);   // lo cierra Timer_RefreshMenus al terminar la ventana
	g_bMenuOpen[client] = true;
}

public int Menu_Sell(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
		delete menu;
	else if (action == MenuAction_Cancel)
	{
		if (item != MenuCancel_Interrupted)
			g_bMenuOpen[client] = false;
	}
	else if (action == MenuAction_Select)
	{
		g_bMenuOpen[client] = false;
		if (!CanSell(client))
			return 0;
		char info[8];
		menu.GetItem(item, info, sizeof(info));
		if (StrEqual(info, "all"))
		{
			SellAll(client);
			return 0;
		}
		int kind = StringToInt(info);
		char name[32];
		KindName(client, kind, name, sizeof(name));
		int moneyBefore = Money(client);
		int refund = SellOne(client, kind);
		if (refund)
			ReportSale(client, name, refund, moneyBefore);
		else
			SellChat(client, "Ya no tienes %s para vender.", name);
		if (HasSellable(client))
			ShowSellMenu(client);
	}
	return 0;
}

/** Cada segundo: actualiza el tiempo del menú abierto y lo cierra cuando termina la ventana. */
public Action Timer_RefreshMenus(Handle timer)
{
	bool open = WindowLeft() > 0.0;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!g_bMenuOpen[i] || !IsClientInGame(i))
			continue;
		if (open && IsPlayerAlive(i) && HasSellable(i))
			ShowSellMenu(i);
		else
		{
			g_bMenuOpen[i] = false;
			CancelClientMenu(i);
		}
	}
	return Plugin_Continue;
}

// ---------------------------------------------------------------------------
// Chat (mismos colores y prefijo que csstv_reporter, si está cargado)
// ---------------------------------------------------------------------------

native int CM_GetClientModAuth(int client);   // clientmod.inc: 2 = ClientMod, 3 = ClientMod desactualizado

static const char g_sColorTag[][] = { "{#normal}", "{#verde}", "{#rojo}", "{#amarillo}" };
static const char g_sColorRgb[][] = { "\x01", "\x073EFF3E", "\x07FF4040", "\x07FFD700" };
static const char g_sColorBasic[][] = { "\x01", "\x04", "\x01", "\x01" };

bool ChatUsesRgb(int client)
{
	ConVar cv = FindConVar("csstv_chat_colors");
	int mode = cv == null ? 1 : cv.IntValue;
	if (mode == 0)
		return false;
	if (mode == 2)
		return true;
	if (GetFeatureStatus(FeatureType_Native, "CM_GetClientModAuth") != FeatureStatus_Available)
		return false;
	return CM_GetClientModAuth(client) >= 2;
}

void ApplyColorTags(char[] text, int len, bool rgb, bool strip = false)
{
	for (int i = 0; i < sizeof(g_sColorTag); i++)
		ReplaceString(text, len, g_sColorTag[i], strip ? "" : (rgb ? g_sColorRgb[i] : g_sColorBasic[i]), false);
}

/** Mensaje de chat solo para el jugador, con el prefijo [CMLeague] y etiquetas de color según su cliente. */
void SellChat(int client, const char[] fmt, any ...)
{
	char tag[32], text[224], buf[256];
	ConVar cv = FindConVar("csstv_chat_tag");
	if (cv != null)
		cv.GetString(tag, sizeof(tag));
	SetGlobalTransTarget(client);
	VFormat(text, sizeof(text), fmt, 3);
	Format(buf, sizeof(buf), "[%s] %s", tag[0] ? tag : "CMLeague", text);
#if defined SELL_DEBUG
	char plain[256];
	strcopy(plain, sizeof(plain), buf);
	ApplyColorTags(plain, sizeof(plain), false, true);
	LogMessage("[respuesta a %N] %s", client, plain);
#endif
	if (IsFakeClient(client))
		return;
	if (!ChatUsesRgb(client))
	{
		ApplyColorTags(buf, sizeof(buf), false);
		PrintToChat(client, "%s", buf);
		return;
	}
	ApplyColorTags(buf, sizeof(buf), true);
	char msg[256];
	Format(msg, sizeof(msg), "\x01%s", buf);   // SayText2 necesita empezar con \x01 para mostrar colores
	Handle um = StartMessageOne("SayText2", client, USERMSG_RELIABLE | USERMSG_BLOCKHOOKS);
	if (um == null)
	{
		ApplyColorTags(buf, sizeof(buf), false);
		PrintToChat(client, "%s", buf);
		return;
	}
	BfWriteByte(um, client);   // autor
	BfWriteByte(um, true);     // mensaje de chat
	BfWriteString(um, msg);
	EndMessage();
}

#if defined SELL_DEBUG
public Action Cmd_DebugFake(int client, int args)
{
	if (args < 2)
	{
		ReplyToCommand(client, "Uso: csstv_sell_fakecmd <userid> <comando>");
		return Plugin_Handled;
	}
	char arg[16], full[256], cmd[192];
	GetCmdArg(1, arg, sizeof(arg));
	GetCmdArgString(full, sizeof(full));
	int target = GetClientOfUserId(StringToInt(arg));
	if (!target || !IsClientInGame(target))
	{
		ReplyToCommand(client, "userid inválido");
		return Plugin_Handled;
	}
	strcopy(cmd, sizeof(cmd), full[strlen(arg) + 1]);
	FakeClientCommandEx(target, "%s", cmd);
	return Plugin_Handled;
}

/**
 * Compra simulada como la hace el juego: el listener saca la foto, el arma de la misma ranura cae al piso, se
 * entrega el ítem y se descuenta su precio. Ítems: los de g_sWeapon, hegrenade, flashbang, smokegrenade, vest,
 * vesthelm, defuser y nvgs.
 */
public Action Cmd_DebugBuy(int client, int args)
{
	char arg[32];
	GetCmdArg(1, arg, sizeof(arg));
	int target = GetClientOfUserId(StringToInt(arg));
	if (!target || !IsClientInGame(target) || !IsPlayerAlive(target))
	{
		ReplyToCommand(client, "userid inválido");
		return Plugin_Handled;
	}
	Cmd_Buy(target, "buy", 0);
	for (int i = 2; i <= args; i++)
	{
		GetCmdArg(i, arg, sizeof(arg));
		int price, money = Money(target);
		if (StrEqual(arg, "vest") || StrEqual(arg, "vesthelm"))
		{
			bool helm = StrEqual(arg, "vesthelm");
			price = helm ? (GetEntProp(target, Prop_Send, "m_ArmorValue") == 100 ? PRICE_HELMET : PRICE_VESTHELM) : PRICE_VEST;
			SetEntProp(target, Prop_Send, "m_ArmorValue", 100);
			if (helm)
				SetEntProp(target, Prop_Send, "m_bHasHelmet", 1);
		}
		else if (StrEqual(arg, "defuser"))
		{
			price = PRICE_DEFUSER;
			SetEntProp(target, Prop_Send, "m_bHasDefuser", 1);
		}
		else if (StrEqual(arg, "nvgs"))
		{
			price = PRICE_NVG;
			SetEntProp(target, Prop_Send, "m_bHasNightVision", 1);
		}
		else
		{
			char cls[40];
			Format(cls, sizeof(cls), "weapon_%s", arg);
			for (int n = 0; n < NADES; n++)
				if (StrEqual(cls, g_sNade[n]))
					price = g_iNadePrice[n];
			for (int w = 0; w < sizeof(g_sWeapon); w++)
				if (StrEqual(arg, g_sWeapon[w]))
				{
					price = g_iWeaponPrice[w];
					int old = GetPlayerWeaponSlot(target, w < 6 ? 1 : 0);
					char oldCls[32];
					if (old != -1 && GetEdictClassname(old, oldCls, sizeof(oldCls)))
					{
						FakeClientCommand(target, "use %s", oldCls);   // inmediato (el Ex espera un frame)
						FakeClientCommand(target, "drop");
					}
				}
			if (!price)
			{
				ReplyToCommand(client, "ítem desconocido: %s", arg);
				continue;
			}
			GivePlayerItem(target, cls);
		}
		SetEntProp(target, Prop_Send, "m_iAccount", money - price);
	}
	return Plugin_Handled;
}

public Action Cmd_DebugDump(int client, int args)
{
	char arg[16];
	GetCmdArg(1, arg, sizeof(arg));
	int target = GetClientOfUserId(StringToInt(arg));
	if (!target || !IsClientInGame(target))
	{
		ReplyToCommand(client, "userid inválido");
		return Plugin_Handled;
	}
	if (args >= 2)
	{
		GetCmdArg(2, arg, sizeof(arg));
		if (!StrEqual(arg, "-"))
			SetEntProp(target, Prop_Send, "m_ArmorValue", StringToInt(arg));
	}
	if (args >= 3)
	{
		GetCmdArg(3, arg, sizeof(arg));
		if (!StrEqual(arg, "-"))
			SetEntProp(target, Prop_Send, "m_iAccount", StringToInt(arg));
	}
	int flash = FindNade(target, 1);
	if (args >= 4 && flash != -1)
	{
		GetCmdArg(4, arg, sizeof(arg));   // como si hubiera lanzado flashes (no se pueden tirar al piso)
		SetEntProp(target, Prop_Send, "m_iAmmo", StringToInt(arg), _, GetEntProp(flash, Prop_Send, "m_iPrimaryAmmoType"));
	}
	int s[S_FIELDS];
	TakeSnapshot(target, s);
	char w[2][32] = { "-", "-" };
	for (int slot = 0; slot < 2; slot++)
	{
		int e = EntRefToEntIndex(s[S_WEAPON + slot]);
		if (e != -1)
			GetEdictClassname(e, w[slot], sizeof(w[]));
	}
	ReplyToCommand(client, "%N: $%d | %s | %s | chaleco %d casco %d | kit %d | visión %d | HE %d flash %d humo %d | ventana %.1f s",
		target, s[S_MONEY], w[0], w[1], s[S_ARMOR], s[S_HELMET], s[S_DEFUSER], s[S_NVG], s[S_NADE], s[S_NADE + 1], s[S_NADE + 2], WindowLeft());
	return Plugin_Handled;
}
#endif
