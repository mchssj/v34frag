/**
 * CSSTV Coach
 *
 * Un coach por equipo, como en FACEIT (plan docs/bitacora/2026-11-02-qol-tanda-2):
 *   - !coach en el calentamiento abre el menú (CT o T); !coach ct, !coach t o !coach off directo;
 *   - el coach queda de espectador y solo puede mirar a jugadores vivos de su equipo, en primera
 *     persona o de cerca (nunca la cámara libre);
 *   - habla por voz y escribe con say_team solo con su equipo, en los dos sentidos;
 *   - sigue a su equipo en el cambio de lado: su lado es donde está la mayoría de los jugadores
 *     que había en el equipo cuando se anotó.
 *
 * El estado del mix se lee de sm_csstv_status. Independiente de csstv_reporter. Sin licencia.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>

#define PLUGIN_VERSION "1.0.0"
#define TEAM_SPEC 1
#define TEAM_T    2
#define TEAM_CT   3
#define OBS_IN_EYE 4
#define OBS_CHASE  5

public Plugin myinfo =
{
	name = "CSSTV Coach",
	author = "CMLeague",
	description = "!coach: un espectador por equipo que mira y habla solo con su equipo",
	version = PLUGIN_VERSION,
	url = ""
};

ConVar g_cvEnabled;
ConVar g_cvTag;
char g_sState[32];
int g_iSide[MAXPLAYERS + 1];                    // lado que coachea (0 = no es coach)
bool g_bRoster[MAXPLAYERS + 1][MAXPLAYERS + 1]; // [coach][jugador]: estaba en el equipo al anotarse
int g_iRosterUser[MAXPLAYERS + 1][MAXPLAYERS + 1];

public void OnPluginStart()
{
	CreateConVar("csstv_coach_version", PLUGIN_VERSION, "Versión de CSSTV Coach.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvEnabled = CreateConVar("csstv_coach", "1", "Permitir !coach en el calentamiento.", _, true, 0.0, true, 1.0);
	AutoExecConfig(true, "csstv_coach");
	RegConsoleCmd("sm_coach", Cmd_Coach, "!coach [ct|t|off]: ser el coach de un equipo (en el calentamiento).");
	AddCommandListener(Cmd_SayTeam, "say_team");
	AddCommandListener(Cmd_SpecNext, "spec_next");
	AddCommandListener(Cmd_SpecPrev, "spec_prev");
	AddCommandListener(Cmd_SpecMode, "spec_mode");
	AddCommandListener(Cmd_JoinTeam, "jointeam");
	HookEvent("player_death", Event_PlayerDeath);
	HookEvent("player_team", Event_PlayerTeam);
	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
	CreateTimer(1.0, Timer_State, _, TIMER_REPEAT);
	CreateTimer(0.1, Timer_Camera, _, TIMER_REPEAT);
}

public void OnConfigsExecuted()
{
	g_cvTag = FindConVar("csstv_chat_tag");
}

public void OnClientDisconnect(int client)
{
	if (g_iSide[client])
		Coach_Clear(client, false);
	for (int c = 1; c <= MaxClients; c++)
		g_bRoster[c][client] = false;
}

// ---------------------------------------------------------------------------
// Estado
// ---------------------------------------------------------------------------

public Action Timer_State(Handle timer)
{
	g_sState[0] = '\0';
	if (!CommandExists("sm_csstv_status"))
		return Plugin_Continue;
	char buf[512];
	ServerCommandEx(buf, sizeof(buf), "sm_csstv_status");
	int at = StrContains(buf, "estado: ");
	if (at == -1)
		return Plugin_Continue;
	strcopy(g_sState, sizeof(g_sState), buf[at + 8]);
	int end = StrContains(g_sState, " ·");
	if (end != -1)
		g_sState[end] = '\0';
	return Plugin_Continue;
}

/** Sin reporter también se puede: el servidor no tiene mixes. */
bool InWarmup()
{
	return !g_sState[0] || StrEqual(g_sState, "calentamiento");
}

void Tag(char[] out, int len)
{
	if (g_cvTag != null)
		g_cvTag.GetString(out, len);
	if (!out[0])
		strcopy(out, len, "CMLeague");
}

int CoachOf(int side)
{
	for (int c = 1; c <= MaxClients; c++)
		if (g_iSide[c] == side && IsClientInGame(c))
			return c;
	return 0;
}

bool OnSide(int client, int side)
{
	return IsClientInGame(client) && !IsClientSourceTV(client) && GetClientTeam(client) == side;
}

// ---------------------------------------------------------------------------
// !coach
// ---------------------------------------------------------------------------

public Action Cmd_Coach(int client, int args)
{
	if (client <= 0)
		return Plugin_Handled;
	char arg[8];
	GetCmdArg(1, arg, sizeof(arg));
	if (StrEqual(arg, "off", false))
	{
		if (g_iSide[client])
			Coach_Clear(client, true);
		else
			ReplyToCommand(client, "[Coach] No sos coach.");
		return Plugin_Handled;
	}
	if (StrEqual(arg, "ct", false))
		Coach_Set(client, TEAM_CT);
	else if (StrEqual(arg, "t", false))
		Coach_Set(client, TEAM_T);
	else
		Coach_Menu(client);
	return Plugin_Handled;
}

void Coach_Menu(int client)
{
	Menu m = new Menu(Menu_Coach);
	m.SetTitle("Coach: elegí el equipo");
	m.AddItem("ct", CoachOf(TEAM_CT) ? "CT (ya tiene coach)" : "CT", CoachOf(TEAM_CT) ? ITEMDRAW_DISABLED : ITEMDRAW_DEFAULT);
	m.AddItem("t", CoachOf(TEAM_T) ? "T (ya tiene coach)" : "T", CoachOf(TEAM_T) ? ITEMDRAW_DISABLED : ITEMDRAW_DEFAULT);
	if (g_iSide[client])
		m.AddItem("off", "Dejar de ser coach");
	m.Display(client, 20);
}

public int Menu_Coach(Menu menu, MenuAction action, int client, int item)
{
	if (action == MenuAction_End)
		delete menu;
	else if (action == MenuAction_Select)
	{
		char info[8];
		menu.GetItem(item, info, sizeof(info));
		if (StrEqual(info, "off"))
		{
			if (g_iSide[client])
				Coach_Clear(client, true);
		}
		else
			Coach_Set(client, StrEqual(info, "ct") ? TEAM_CT : TEAM_T);
	}
	return 0;
}

void Coach_Set(int client, int side)
{
	if (!g_cvEnabled.BoolValue)
	{
		ReplyToCommand(client, "[Coach] El coach está desactivado en este servidor.");
		return;
	}
	if (!InWarmup())
	{
		ReplyToCommand(client, "[Coach] Solo se puede elegir coach en el calentamiento.");
		return;
	}
	int other = CoachOf(side);
	if (other && other != client)
	{
		ReplyToCommand(client, "[Coach] Ese equipo ya tiene coach: %N.", other);
		return;
	}
	if (g_iSide[client])
		Coach_Clear(client, false);
	int n;
	for (int i = 1; i <= MaxClients; i++)
	{
		g_bRoster[client][i] = i != client && OnSide(i, side);
		g_iRosterUser[client][i] = g_bRoster[client][i] ? GetClientUserId(i) : 0;
		if (g_bRoster[client][i])
			n++;
	}
	if (!n)
	{
		ReplyToCommand(client, "[Coach] Ese equipo todavía no tiene jugadores.");
		return;
	}
	g_iSide[client] = side;
	if (GetClientTeam(client) != TEAM_SPEC)
		ChangeClientTeam(client, TEAM_SPEC);
	Coach_UpdateVoice();
	char tag[32];
	Tag(tag, sizeof(tag));
	PrintToChatAll("\x04[%s]\x01 \x04%N\x01 es el coach de los %s.", tag, client, side == TEAM_CT ? "CT" : "T");
	PrintToChat(client, "\x04[%s]\x01 Mirás y hablás solo con tu equipo. !coach off para dejarlo.", tag);
}

void Coach_Clear(int client, bool announce)
{
	g_iSide[client] = 0;
	for (int i = 1; i <= MaxClients; i++)
	{
		g_bRoster[client][i] = false;
		if (i != client && IsClientInGame(i) && IsClientInGame(client))
		{
			SetListenOverride(i, client, Listen_Default);
			SetListenOverride(client, i, Listen_Default);
		}
	}
	if (announce)
	{
		char tag[32];
		Tag(tag, sizeof(tag));
		PrintToChatAll("\x04[%s]\x01 %N ya no es coach.", tag, client);
	}
}

/** En el calentamiento, entrar a un equipo deja de ser coach; durante la partida no se puede. */
public Action Cmd_JoinTeam(int client, const char[] command, int argc)
{
	if (client <= 0 || !g_iSide[client])
		return Plugin_Continue;
	if (!InWarmup())
	{
		PrintToChat(client, "[Coach] Durante la partida el coach no puede entrar a un equipo.");
		return Plugin_Handled;
	}
	Coach_Clear(client, true);
	return Plugin_Continue;
}

public void Event_PlayerTeam(Event event, const char[] name, bool dontBroadcast)
{
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0 && g_iSide[client] && event.GetInt("team") != TEAM_SPEC && !event.GetBool("disconnect"))
		Coach_Clear(client, true);
	RequestFrame(Frame_UpdateVoice);
}

// ---------------------------------------------------------------------------
// Lado (sigue al equipo en el medio tiempo) y voz
// ---------------------------------------------------------------------------

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	for (int c = 1; c <= MaxClients; c++)
	{
		if (!g_iSide[c] || !IsClientInGame(c))
			continue;
		int ct, t;
		for (int i = 1; i <= MaxClients; i++)
		{
			if (!g_bRoster[c][i] || GetClientOfUserId(g_iRosterUser[c][i]) != i)
				continue;
			int team = GetClientTeam(i);
			if (team == TEAM_CT) ct++;
			else if (team == TEAM_T) t++;
		}
		if (ct != t)
			g_iSide[c] = ct > t ? TEAM_CT : TEAM_T;
	}
	Coach_UpdateVoice();
}

public void Frame_UpdateVoice(any data)
{
	Coach_UpdateVoice();
}

void Coach_UpdateVoice()
{
	for (int c = 1; c <= MaxClients; c++)
	{
		if (!g_iSide[c] || !IsClientInGame(c))
			continue;
		for (int i = 1; i <= MaxClients; i++)
		{
			if (i == c || !IsClientInGame(i) || IsFakeClient(i))
				continue;
			ListenOverride lo = GetClientTeam(i) == g_iSide[c] ? Listen_Yes : Listen_Default;
			SetListenOverride(i, c, lo);
			SetListenOverride(c, i, lo);
		}
	}
}

// ---------------------------------------------------------------------------
// Chat de equipo
// ---------------------------------------------------------------------------

public Action Cmd_SayTeam(int client, const char[] command, int argc)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Continue;
	char msg[192];
	GetCmdArgString(msg, sizeof(msg));
	StripQuotes(msg);
	TrimString(msg);
	if (!msg[0] || msg[0] == '!' || msg[0] == '/')
		return Plugin_Continue;
	if (g_iSide[client])
	{
		for (int i = 1; i <= MaxClients; i++)
			if (i == client || OnSide(i, g_iSide[client]))
				PrintToChat(i, "\x04(Coach) %N\x01: %s", client, msg);
		return Plugin_Handled;
	}
	int c = CoachOf(GetClientTeam(client));
	if (c && c != client)
		PrintToChat(c, "\x04(Equipo) %N\x01: %s", client, msg);
	return Plugin_Continue;
}

// ---------------------------------------------------------------------------
// Cámara: solo jugadores vivos de su equipo
// ---------------------------------------------------------------------------

bool GoodTarget(int coach, int target)
{
	return target > 0 && target <= MaxClients && IsClientInGame(target) && IsPlayerAlive(target) && GetClientTeam(target) == g_iSide[coach];
}

/** El siguiente vivo de su equipo después de from (dir = 1 o -1). 0 si no queda nadie. */
int NextTarget(int coach, int from, int dir)
{
	int i = from;
	for (int n = 0; n < MaxClients; n++)
	{
		i += dir;
		if (i > MaxClients) i = 1;
		if (i < 1) i = MaxClients;
		if (GoodTarget(coach, i))
			return i;
	}
	return 0;
}

void Camera_Fix(int coach, bool force, int dir)
{
	if (IsPlayerAlive(coach))
		return;
	int target = GetEntPropEnt(coach, Prop_Send, "m_hObserverTarget");
	int mode = GetEntProp(coach, Prop_Send, "m_iObserverMode");
	if (force || !GoodTarget(coach, target))
	{
		int next = NextTarget(coach, GoodTarget(coach, target) ? target : 0, dir);
		if (next)
			SetEntPropEnt(coach, Prop_Send, "m_hObserverTarget", next);
	}
	if (mode != OBS_IN_EYE && mode != OBS_CHASE)
		SetEntProp(coach, Prop_Send, "m_iObserverMode", OBS_IN_EYE);
}

public Action Timer_Camera(Handle timer)
{
	for (int c = 1; c <= MaxClients; c++)
		if (g_iSide[c] && IsClientInGame(c) && GetClientTeam(c) == TEAM_SPEC)
			Camera_Fix(c, false, 1);
	return Plugin_Continue;
}

public void Event_PlayerDeath(Event event, const char[] name, bool dontBroadcast)
{
	RequestFrame(Frame_Camera);
}

public void Frame_Camera(any data)
{
	for (int c = 1; c <= MaxClients; c++)
		if (g_iSide[c] && IsClientInGame(c) && GetClientTeam(c) == TEAM_SPEC)
			Camera_Fix(c, false, 1);
}

public Action Cmd_SpecNext(int client, const char[] command, int argc)
{
	if (client <= 0 || !g_iSide[client] || GetClientTeam(client) != TEAM_SPEC)
		return Plugin_Continue;
	Camera_Fix(client, true, 1);
	return Plugin_Handled;
}

public Action Cmd_SpecPrev(int client, const char[] command, int argc)
{
	if (client <= 0 || !g_iSide[client] || GetClientTeam(client) != TEAM_SPEC)
		return Plugin_Continue;
	Camera_Fix(client, true, -1);
	return Plugin_Handled;
}

/** Alterna entre primera persona y de cerca; nunca la cámara libre. */
public Action Cmd_SpecMode(int client, const char[] command, int argc)
{
	if (client <= 0 || !g_iSide[client] || GetClientTeam(client) != TEAM_SPEC)
		return Plugin_Continue;
	int mode = GetEntProp(client, Prop_Send, "m_iObserverMode");
	SetEntProp(client, Prop_Send, "m_iObserverMode", mode == OBS_IN_EYE ? OBS_CHASE : OBS_IN_EYE);
	Camera_Fix(client, false, 1);
	return Plugin_Handled;
}
