// Prueba descartable: ¿los timers de SourceMod corren con el motor en pausa?
// ¿El juego pisa SetTeamScore al reiniciar / terminar la ronda?
#pragma semicolon 1
#pragma newdecls required
#include <sourcemod>
#include <sdktools>

char g_sLog[PLATFORM_MAX_PATH];
int g_iTick;
bool g_bReapply;
int g_iWantCT = -1, g_iWantT = -1;

public void OnPluginStart()
{
	BuildPath(Path_SM, g_sLog, sizeof(g_sLog), "logs/csstv_spike.log");
	CreateTimer(1.0, Timer_Tick, _, TIMER_REPEAT);
	RegServerCmd("spike_pause", Cmd_Pause);
	RegServerCmd("spike_score", Cmd_Score);
	RegServerCmd("spike_botpause", Cmd_BotPause);
	RegServerCmd("spike_reapply", Cmd_Reapply);
	HookEvent("round_start", Ev_Round);
	HookEvent("round_end", Ev_Round);
	LogToFileEx(g_sLog, "spike cargado");
}

public Action Timer_Tick(Handle t)
{
	g_iTick++;
	LogToFileEx(g_sLog, "tick %d game=%.2f engine=%.2f CT=%d T=%d", g_iTick, GetGameTime(), GetEngineTime(), GetTeamScore(3), GetTeamScore(2));
	return Plugin_Continue;
}

public Action Cmd_Pause(int args)
{
	char a[32];
	GetCmdArg(1, a, sizeof(a));
	LogToFileEx(g_sLog, "spike_pause %s engine=%.2f", a, GetEngineTime());
	ServerCommand("sv_pausable 1");
	ServerCommand("%s", a[0] ? a : "pause");
	return Plugin_Handled;
}

public Action Cmd_Score(int args)
{
	g_iWantCT = GetCmdArgInt(1);
	g_iWantT = GetCmdArgInt(2);
	SetTeamScore(3, g_iWantCT);
	SetTeamScore(2, g_iWantT);
	LogToFileEx(g_sLog, "spike_score set CT=%d T=%d -> lee CT=%d T=%d", g_iWantCT, g_iWantT, GetTeamScore(3), GetTeamScore(2));
	return Plugin_Handled;
}

public Action Cmd_Reapply(int args)
{
	g_bReapply = GetCmdArgInt(1) != 0;
	LogToFileEx(g_sLog, "reapply=%d", g_bReapply);
	return Plugin_Handled;
}

int GetCmdArgInt(int n)
{
	char s[16];
	GetCmdArg(n, s, sizeof(s));
	return StringToInt(s);
}

public void Ev_Round(Event e, const char[] name, bool db)
{
	LogToFileEx(g_sLog, "%s winner=%d en el evento: CT=%d T=%d", name, e.GetInt("winner"), GetTeamScore(3), GetTeamScore(2));
	DataPack dp;
	CreateDataTimer(0.2, Timer_After, dp);
	dp.WriteString(name);
}

public Action Timer_After(Handle t, DataPack dp)
{
	char name[32];
	dp.Reset();
	dp.ReadString(name, sizeof(name));
	LogToFileEx(g_sLog, "%s +0.2s: CT=%d T=%d", name, GetTeamScore(3), GetTeamScore(2));
	if (g_bReapply && g_iWantCT >= 0)
	{
		if (StrEqual(name, "round_end"))
		{
			// el plugin real suma la ronda; acá alcanza con reaplicar lo pedido
		}
		SetTeamScore(3, g_iWantCT);
		SetTeamScore(2, g_iWantT);
		LogToFileEx(g_sLog, "%s reaplicado: CT=%d T=%d", name, GetTeamScore(3), GetTeamScore(2));
	}
	return Plugin_Stop;
}

public Action Cmd_BotPause(int args)
{
	char a[32];
	GetCmdArg(1, a, sizeof(a));
	ConVar c = FindConVar("sv_pausable");
	c.BoolValue = true;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (IsClientInGame(i))
		{
			FakeClientCommandEx(i, "%s", a[0] ? a : "pause");
			LogToFileEx(g_sLog, "botpause %s via %N engine=%.2f", a, i, GetEngineTime());
			break;
		}
	}
	return Plugin_Handled;
}
