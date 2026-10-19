/**
 * CSSTV Perf: diagnóstico de tirones (plan docs/bitacora/2026-10-18-diagnostico-red-servidor).
 *
 * En cada tick mide cuánto pasó desde el anterior. Cada csstv_perf_interval segundos escribe en
 * addons/sourcemod/logs/csstv_perf_AAAAMMDD.log cuántos ticks salieron tarde y el peor, y para cada
 * jugador humano su ping, pérdida, choke y tasas. Al cambiar de mapa anota el tickrate y las cvars de red.
 * No manda nada a los jugadores.
 *
 * Además fija fps_max (csstv_perf_fps_max, 600 por defecto): el plugin del hosting (extreme_host.smx) lo pone
 * en 150 en cada mapa, y con 101 de tickrate eso hace que los ticks salgan a destiempo. Cada vez que alguien
 * cambia fps_max, se vuelve a poner el valor fijado y se anota en el log.
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>

#define PLUGIN_VERSION "1.1.0"

ConVar g_cvInterval;
ConVar g_cvPlayers;
ConVar g_cvFpsWanted;   // csstv_perf_fps_max
ConVar g_cvFpsMax;      // fps_max del motor

float g_fInterval;      // intervalo de tick esperado (s)
float g_fLast;          // GetEngineTime() del tick anterior (0 = recién empieza)
float g_fWindowStart;
int g_iTicks;
int g_iLate15;          // ticks que tardaron más de 1,5 intervalos
int g_iLate2;           // más de 2 intervalos
int g_iLate5;           // más de 5 intervalos
float g_fWorst;         // peor tiempo entre ticks de la ventana (s)
char g_sLog[PLATFORM_MAX_PATH];

public Plugin myinfo =
{
	name = "CSSTV Perf",
	author = "CSSTV",
	description = "Diagnóstico de ticks del servidor y de la red de cada jugador",
	version = PLUGIN_VERSION,
	url = ""
};

public void OnPluginStart()
{
	g_cvInterval = CreateConVar("csstv_perf_interval", "30", "Segundos entre líneas del log de diagnóstico (0 = apagado).", _, true, 0.0, true, 600.0);
	g_cvPlayers = CreateConVar("csstv_perf_players", "1", "Anotar ping, pérdida y choke de cada jugador en cada línea.", _, true, 0.0, true, 1.0);
	CreateConVar("csstv_perf_version", PLUGIN_VERSION, "Versión de CSSTV Perf.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvFpsWanted = CreateConVar("csstv_perf_fps_max", "600", "fps_max que se mantiene aunque otro plugin lo cambie (0 = no tocarlo).", _, true, 0.0, true, 1000.0);
	RegAdminCmd("sm_perf", Cmd_Perf, ADMFLAG_RCON, "Muestra los ticks de la ventana actual.");
	g_cvFpsMax = FindConVar("fps_max");
	if (g_cvFpsMax != null)
		g_cvFpsMax.AddChangeHook(OnFpsMaxChanged);
	g_cvFpsWanted.AddChangeHook(OnFpsWantedChanged);
	Fps_Enforce("al cargar");
	CreateTimer(1.0, Timer_Check, _, TIMER_REPEAT);
	g_fInterval = GetTickInterval();
	Reset();
}

public void OnMapStart()
{
	char map[64];
	SetLogPath();
	GetCurrentMap(map, sizeof(map));
	g_fInterval = GetTickInterval();
	LogToFileEx(g_sLog, "mapa %s · tickrate %.1f · %s", map, 1.0 / g_fInterval, NetCvars());
	Reset();
}

public void OnConfigsExecuted()
{
	Fps_Enforce("después de los cfg");
}

public void OnFpsMaxChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	int wanted = g_cvFpsWanted.IntValue;
	if (wanted > 0 && StringToInt(newValue) != wanted)
	{
		DataPack pack = new DataPack();
		pack.WriteString(newValue);
		RequestFrame(Fps_Restore, pack);   // fuera del hook, para no cambiar la cvar dentro de su propio aviso
	}
}

public void OnFpsWantedChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	Fps_Enforce("csstv_perf_fps_max cambió");
}

public void Fps_Restore(DataPack pack)
{
	char was[16];
	pack.Reset();
	pack.ReadString(was, sizeof(was));
	delete pack;
	Fps_Enforce(was);
}

/** Pone fps_max en el valor fijado si no lo tiene. why: de dónde venía (va al log). */
void Fps_Enforce(const char[] why)
{
	int wanted = g_cvFpsWanted.IntValue;
	if (g_cvFpsMax == null || wanted <= 0 || g_cvFpsMax.IntValue == wanted)
		return;
	int before = g_cvFpsMax.IntValue;
	g_cvFpsMax.IntValue = wanted;
	if (!g_sLog[0])
		SetLogPath();
	LogToFileEx(g_sLog, "fps_max %d → %d (%s)", before, wanted, why);
}

void SetLogPath()
{
	char date[16];
	FormatTime(date, sizeof(date), "%Y%m%d");
	BuildPath(Path_SM, g_sLog, sizeof(g_sLog), "logs/csstv_perf_%s.log", date);
}

void Reset()
{
	g_fLast = 0.0;
	g_fWindowStart = GetEngineTime();
	g_iTicks = 0;
	g_iLate15 = 0;
	g_iLate2 = 0;
	g_iLate5 = 0;
	g_fWorst = 0.0;
}

public void OnGameFrame()
{
	float now = GetEngineTime();
	if (g_fLast > 0.0)
	{
		float d = now - g_fLast;
		g_iTicks++;
		if (d > g_fWorst)
			g_fWorst = d;
		if (d > g_fInterval * 1.5)
		{
			g_iLate15++;
			if (d > g_fInterval * 2.0)
			{
				g_iLate2++;
				if (d > g_fInterval * 5.0)
					g_iLate5++;
			}
		}
	}
	g_fLast = now;
}

public Action Timer_Check(Handle timer)
{
	float every = g_cvInterval.FloatValue;
	if (every > 0.0 && GetEngineTime() - g_fWindowStart >= every)
		WriteWindow();
	return Plugin_Continue;
}

/** "ticks 2970/3030 · tarde >15ms 3 · >20ms 1 · >50ms 0 · peor 24.1 ms" */
void WindowText(char[] out, int maxlen)
{
	float secs = GetEngineTime() - g_fWindowStart;
	int expected = g_fInterval > 0.0 ? RoundToNearest(secs / g_fInterval) : 0;
	Format(out, maxlen, "ticks %d/%d · tarde >%.0fms %d · >%.0fms %d · >%.0fms %d · peor %.1f ms",
		g_iTicks, expected, g_fInterval * 1500.0, g_iLate15, g_fInterval * 2000.0, g_iLate2, g_fInterval * 5000.0, g_iLate5, g_fWorst * 1000.0);
}

void WriteWindow()
{
	char text[192];
	WindowText(text, sizeof(text));
	int humans;
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && !IsFakeClient(i))
			humans++;
	LogToFileEx(g_sLog, "servidor · %s · jugadores %d", text, humans);
	if (g_cvPlayers.BoolValue)
	{
		for (int i = 1; i <= MaxClients; i++)
		{
			if (!IsClientInGame(i) || IsFakeClient(i))
				continue;
			char line[256];
			PlayerText(i, line, sizeof(line));
			LogToFileEx(g_sLog, "  %s", line);
		}
	}
	Reset();
}

/** "Nick [STEAM_0:1:2] ping 45 ms · pérdida 0.0%/0.0% · choke 0.0%/0.0% · rate 30000 · upd 101 · cmd 101" */
void PlayerText(int client, char[] out, int maxlen)
{
	char auth[32], rate[16], upd[8], cmd[8];
	if (!GetClientAuthId(client, AuthId_Steam2, auth, sizeof(auth), false))
		strcopy(auth, sizeof(auth), "?");
	GetClientInfo(client, "rate", rate, sizeof(rate));
	GetClientInfo(client, "cl_updaterate", upd, sizeof(upd));
	GetClientInfo(client, "cl_cmdrate", cmd, sizeof(cmd));
	// Saliente = del servidor al jugador; entrante = del jugador al servidor.
	Format(out, maxlen, "%N [%s] ping %.0f ms · pérdida %.1f%%/%.1f%% · choke %.1f%%/%.1f%% · rate %s · upd %s · cmd %s",
		client, auth, GetClientAvgLatency(client, NetFlow_Both) * 1000.0,
		GetClientAvgLoss(client, NetFlow_Outgoing) * 100.0, GetClientAvgLoss(client, NetFlow_Incoming) * 100.0,
		GetClientAvgChoke(client, NetFlow_Outgoing) * 100.0, GetClientAvgChoke(client, NetFlow_Incoming) * 100.0,
		rate, upd, cmd);
}

char[] NetCvars()
{
	static const char names[][] = { "fps_max", "sv_minrate", "sv_maxrate", "sv_minupdaterate", "sv_maxupdaterate", "sv_mincmdrate", "sv_maxcmdrate" };
	char out[256], v[16];
	for (int i = 0; i < sizeof(names); i++)
	{
		ConVar c = FindConVar(names[i]);
		if (c == null)
			strcopy(v, sizeof(v), "?");
		else
			c.GetString(v, sizeof(v));
		Format(out, sizeof(out), "%s%s%s %s", out, i ? " · " : "", names[i], v);
	}
	return out;
}

public Action Cmd_Perf(int client, int args)
{
	char text[192];
	WindowText(text, sizeof(text));
	ReplyToCommand(client, "[perf] %s", text);
	return Plugin_Handled;
}
