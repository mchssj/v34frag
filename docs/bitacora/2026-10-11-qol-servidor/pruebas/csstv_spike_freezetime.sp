// Prueba descartable 2: alargar / cortar el freezetime con m_fRoundStartTime.
// Y ver si el juego pisa SetTeamScore.
#pragma semicolon 1
#pragma newdecls required
#include <sourcemod>
#include <sdktools>
#include <cstrike>

char g_sLog[PLATFORM_MAX_PATH];
int g_iWantCT = -1, g_iWantT = -1;
bool g_bReapply;

public void OnPluginStart()
{
	BuildPath(Path_SM, g_sLog, sizeof(g_sLog), "logs/csstv_spike.log");
	RegServerCmd("spike_freeze", Cmd_Freeze);
	RegServerCmd("spike_info", Cmd_Info);
	RegServerCmd("spike_players", Cmd_Players);
	RegServerCmd("spike_switch", Cmd_Switch);
	RegServerCmd("spike_score", Cmd_Score);
	RegServerCmd("spike_reapply", Cmd_Reapply);
	HookEvent("round_start", Ev_Round);
	HookEvent("round_end", Ev_Round);
	HookEventEx("round_freeze_end", Ev_Round);
	LogToFileEx(g_sLog, "spike2 cargado");
}

void Info(const char[] tag)
{
	LogToFileEx(g_sLog, "%s now=%.2f roundstart=%.2f freeze=%d roundtime=%d CT=%d T=%d alive=%d", tag, GetGameTime(),
		GameRules_GetPropFloat("m_fRoundStartTime"), GameRules_GetProp("m_bFreezePeriod"), GameRules_GetProp("m_iRoundTime"), GetTeamScore(3), GetTeamScore(2), CountAlive());
}

public Action Cmd_Info(int args)
{
	Info("info");
	return Plugin_Handled;
}

// spike_freeze <segundos desde ahora>
public Action Cmd_Freeze(int args)
{
	char a[16];
	GetCmdArg(1, a, sizeof(a));
	Info("antes");
	GameRules_SetPropFloat("m_fRoundStartTime", GetGameTime() + StringToFloat(a));
	Info("despues");
	return Plugin_Handled;
}

public Action Cmd_Score(int args)
{
	char a[16];
	GetCmdArg(1, a, sizeof(a)); g_iWantCT = StringToInt(a);
	GetCmdArg(2, a, sizeof(a)); g_iWantT = StringToInt(a);
	SetTeamScore(3, g_iWantCT);
	SetTeamScore(2, g_iWantT);
	Info("score");
	return Plugin_Handled;
}

public Action Cmd_Reapply(int args)
{
	char a[8];
	GetCmdArg(1, a, sizeof(a));
	g_bReapply = StringToInt(a) != 0;
	return Plugin_Handled;
}

public void Ev_Round(Event e, const char[] name, bool db)
{
	Info(name);
	DataPack dp;
	CreateDataTimer(0.2, Timer_After, dp);
	dp.WriteString(name);
}

public Action Timer_After(Handle t, DataPack dp)
{
	char name[40];
	dp.Reset();
	dp.ReadString(name, sizeof(name));
	StrCat(name, sizeof(name), " +0.2s");
	Info(name);
	if (g_bReapply && g_iWantCT >= 0)
	{
		SetTeamScore(3, g_iWantCT);
		SetTeamScore(2, g_iWantT);
		Info("reaplicado");
	}
	return Plugin_Stop;
}

int CountAlive()
{
	int n;
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && IsPlayerAlive(i))
			n++;
	return n;
}

public Action Cmd_Players(int args)
{
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i))
			continue;
		LogToFileEx(g_sLog, "player %N team=%d alive=%d class=%d", i, GetClientTeam(i), IsPlayerAlive(i),
			HasEntProp(i, Prop_Send, "m_iClass") ? GetEntProp(i, Prop_Send, "m_iClass") : -1);
	}
	return Plugin_Handled;
}

// spike_switch <userid>: prueba CS_SwitchTeam al otro lado
public Action Cmd_Switch(int args)
{
	char a[16];
	GetCmdArg(1, a, sizeof(a));
	int c = GetClientOfUserId(StringToInt(a));
	if (c <= 0) return Plugin_Handled;
	int to = GetClientTeam(c) == 2 ? 3 : 2;
	LogToFileEx(g_sLog, "switch %N %d -> %d", c, GetClientTeam(c), to);
	CS_SwitchTeam(c, to);
	LogToFileEx(g_sLog, "switch ok: team=%d class=%d alive=%d", GetClientTeam(c), GetEntProp(c, Prop_Send, "m_iClass"), IsPlayerAlive(c));
	return Plugin_Handled;
}
