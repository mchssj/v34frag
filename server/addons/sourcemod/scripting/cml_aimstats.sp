/**
 * CMLeague: estadísticas de aim del lado del servidor (plan docs/bitacora/2026-11-27-anticheat-deteccion, replanteo 158).
 *
 * Mientras se juega un mix (cml_ac_mix 1, la misma del Bridge), por cada kill de un jugador real cuenta:
 *   - headshot;
 *   - snap: el giro de mira más grande entre dos ticks seguidos, en los 8 ticks antes de la kill, supera cml_aim_snap grados;
 *   - a través del humo: la línea entre los ojos del que mata y los del que muere pasa por un humo activo (sin que ninguno
 *     de los dos esté adentro).
 * Al terminar el mix (cml_ac_mix vuelve a 0) o el mapa, manda los totales por jugador a ac_aim_report, que marca lo anormal
 * en la sesión del anticheat. No sanciona y no le dice nada al jugador.
 *
 * Usa la URL, la clave y el token del Bridge (cml_ac_api_url, cml_ac_api_key y cml_ac_server_token). Sin el Bridge, no manda nada.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <system2>

#define PLUGIN_VERSION "1.0.0"
#define HIST           16
#define LOOKBACK       8
#define MAX_SMOKES     16
#define SMOKE_LIFE     18.0
#define SMOKE_RADIUS   140.0

// Índices de cada fila de estadísticas.
#define S_KILLS  0
#define S_HS     1
#define S_SNAPS  2
#define S_SMOKE  3
#define S_MAX10  4   // giro máximo × 10, como entero
#define S_LEN    5

public Plugin myinfo =
{
	name = "CMLeague Aim Stats",
	author = "CMLeague",
	description = "Estadísticas de aim por mix para el staff. No sanciona.",
	version = PLUGIN_VERSION,
	url = "https://cmleague.lat"
};

ConVar g_cvSnap;
ConVar g_cvMix;
bool g_bHooked;
bool g_bLive;

float g_fAng[MAXPLAYERS + 1][HIST][2];
int g_iPos[MAXPLAYERS + 1];
int g_iFill[MAXPLAYERS + 1];

float g_fSmoke[MAX_SMOKES][3];
float g_fSmokeAt[MAX_SMOKES];
int g_iSmokeNext;

StringMap g_hStats;

public void OnPluginStart()
{
	g_cvSnap = CreateConVar("cml_aim_snap", "25.0", "Giro de mira por tick (grados) que cuenta como snap.", _, true, 5.0, true, 180.0);
	AutoExecConfig(true, "cml_aimstats");
	g_hStats = new StringMap();
	HookEvent("player_death", Event_Death);
	HookEvent("smokegrenade_detonate", Event_Smoke);
	HookEvent("round_start", Event_RoundStart, EventHookMode_PostNoCopy);
}

public void OnConfigsExecuted()
{
	if (g_bHooked)
		return;
	g_cvMix = FindConVar("cml_ac_mix");
	if (g_cvMix == null)
		return;
	g_cvMix.AddChangeHook(OnMixChanged);
	g_bHooked = true;
	g_bLive = g_cvMix.BoolValue;
}

public void OnMixChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	bool live = cv.BoolValue;
	if (live && !g_bLive)
	{
		g_hStats.Clear();
		ClearSmokes();
	}
	else if (!live && g_bLive)
	{
		Send();
	}
	g_bLive = live;
}

public void OnMapEnd()
{
	// Un mix cortado por un cambio de mapa: se manda lo que haya.
	if (g_bLive)
		Send();
	ClearSmokes();
}

public void OnClientPutInServer(int client)
{
	g_iPos[client] = 0;
	g_iFill[client] = 0;
}

public Action OnPlayerRunCmd(int client, int &buttons, int &impulse, float vel[3], float angles[3], int &weapon)
{
	if (!g_bLive || client <= 0 || client > MaxClients || IsFakeClient(client))
		return Plugin_Continue;
	int i = g_iPos[client];
	g_fAng[client][i][0] = angles[0];
	g_fAng[client][i][1] = angles[1];
	g_iPos[client] = (i + 1) % HIST;
	if (g_iFill[client] < HIST)
		g_iFill[client]++;
	return Plugin_Continue;
}

// El giro más grande entre dos ticks seguidos, en los últimos LOOKBACK ticks.
float MaxSnap(int client)
{
	float best = 0.0;
	int n = g_iFill[client] - 1;
	if (n > LOOKBACK)
		n = LOOKBACK;
	for (int k = 0; k < n; k++)
	{
		int cur = (g_iPos[client] - 1 - k + HIST * 2) % HIST;
		int prev = (cur - 1 + HIST) % HIST;
		float dp = g_fAng[client][cur][0] - g_fAng[client][prev][0];
		float dy = g_fAng[client][cur][1] - g_fAng[client][prev][1];
		while (dy > 180.0) dy -= 360.0;
		while (dy < -180.0) dy += 360.0;
		float d = SquareRoot(dp * dp + dy * dy);
		if (d > best)
			best = d;
	}
	return best;
}

void ClearSmokes()
{
	for (int i = 0; i < MAX_SMOKES; i++)
		g_fSmokeAt[i] = 0.0;
	g_iSmokeNext = 0;
}

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
	ClearSmokes();
}

public void Event_Smoke(Event event, const char[] name, bool dontBroadcast)
{
	int i = g_iSmokeNext;
	g_fSmoke[i][0] = event.GetFloat("x");
	g_fSmoke[i][1] = event.GetFloat("y");
	g_fSmoke[i][2] = event.GetFloat("z") + 48.0;  // El centro de la nube, un poco arriba de donde cayó
	g_fSmokeAt[i] = GetGameTime();
	g_iSmokeNext = (i + 1) % MAX_SMOKES;
}

float DistSq(const float a[3], const float b[3])
{
	float dx = a[0] - b[0], dy = a[1] - b[1], dz = a[2] - b[2];
	return dx * dx + dy * dy + dz * dz;
}

// La línea de a a b pasa por un humo activo, y ninguno de los dos está adentro.
bool ThroughSmoke(const float a[3], const float b[3])
{
	float now = GetGameTime();
	float r2 = SMOKE_RADIUS * SMOKE_RADIUS;
	float ab[3];
	ab[0] = b[0] - a[0];
	ab[1] = b[1] - a[1];
	ab[2] = b[2] - a[2];
	float len2 = ab[0] * ab[0] + ab[1] * ab[1] + ab[2] * ab[2];
	if (len2 < 1.0)
		return false;
	for (int i = 0; i < MAX_SMOKES; i++)
	{
		if (g_fSmokeAt[i] <= 0.0 || now - g_fSmokeAt[i] > SMOKE_LIFE)
			continue;
		float c[3];
		c[0] = g_fSmoke[i][0];
		c[1] = g_fSmoke[i][1];
		c[2] = g_fSmoke[i][2];
		if (DistSq(a, c) < r2 || DistSq(b, c) < r2)
			continue;
		float t = ((c[0] - a[0]) * ab[0] + (c[1] - a[1]) * ab[1] + (c[2] - a[2]) * ab[2]) / len2;
		if (t <= 0.0 || t >= 1.0)
			continue;
		float p[3];
		p[0] = a[0] + ab[0] * t;
		p[1] = a[1] + ab[1] * t;
		p[2] = a[2] + ab[2] * t;
		if (DistSq(p, c) < r2)
			return true;
	}
	return false;
}

public void Event_Death(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bLive)
		return;
	int victim = GetClientOfUserId(event.GetInt("userid"));
	int attacker = GetClientOfUserId(event.GetInt("attacker"));
	if (attacker <= 0 || attacker > MaxClients || attacker == victim || victim <= 0 || !IsClientInGame(attacker) || IsFakeClient(attacker))
		return;
	char steam[32];
	if (!GetClientAuthId(attacker, AuthId_SteamID64, steam, sizeof(steam)))
		return;

	int row[S_LEN];
	if (!g_hStats.GetArray(steam, row, S_LEN))
	{
		for (int i = 0; i < S_LEN; i++)
			row[i] = 0;
	}
	row[S_KILLS]++;
	if (event.GetBool("headshot"))
		row[S_HS]++;
	float snap = MaxSnap(attacker);
	if (snap >= g_cvSnap.FloatValue)
		row[S_SNAPS]++;
	int snap10 = RoundToFloor(snap * 10.0);
	if (snap10 > row[S_MAX10])
		row[S_MAX10] = snap10;
	if (IsClientInGame(victim))
	{
		float a[3], b[3];
		GetClientEyePosition(attacker, a);
		GetClientEyePosition(victim, b);
		if (ThroughSmoke(a, b))
			row[S_SMOKE]++;
	}
	g_hStats.SetArray(steam, row, S_LEN);
}

void Send()
{
	ConVar cvUrl = FindConVar("cml_ac_api_url");
	ConVar cvKey = FindConVar("cml_ac_api_key");
	ConVar cvToken = FindConVar("cml_ac_server_token");
	StringMapSnapshot snap = g_hStats.Snapshot();
	int n = snap.Length;
	if (n == 0 || cvUrl == null || cvKey == null || cvToken == null)
	{
		delete snap;
		g_hStats.Clear();
		return;
	}

	char url[256], key[512], token[128], map[64], body[8192], item[160], steam[32];
	cvUrl.GetString(url, sizeof(url));
	cvKey.GetString(key, sizeof(key));
	cvToken.GetString(token, sizeof(token));
	GetCurrentMap(map, sizeof(map));
	if (!url[0])
	{
		delete snap;
		g_hStats.Clear();
		return;
	}
	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_map\":\"%s\",\"p_rows\":[", token, map);
	int row[S_LEN];
	for (int i = 0; i < n && i < 64; i++)
	{
		snap.GetKey(i, steam, sizeof(steam));
		g_hStats.GetArray(steam, row, S_LEN);
		Format(item, sizeof(item), "%s{\"steam\":\"%s\",\"kills\":%d,\"hs\":%d,\"snaps\":%d,\"smoke\":%d,\"max_snap\":%d.%d}",
			i > 0 ? "," : "", steam, row[S_KILLS], row[S_HS], row[S_SNAPS], row[S_SMOKE], row[S_MAX10] / 10, row[S_MAX10] % 10);
		StrCat(body, sizeof(body), item);
	}
	StrCat(body, sizeof(body), "]}");
	delete snap;
	g_hStats.Clear();

	StrCat(url, sizeof(url), "ac_aim_report");
	System2HTTPRequest req = new System2HTTPRequest(OnReport, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetUserAgent("CMLeague-AimStats/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 15;
	req.POST();
	delete req;
}

public void OnReport(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	int status = success && response != null ? response.StatusCode : 0;
	if (status != 200)
		LogMessage("ac_aim_report respondió %d (%s)", status, error);
}
