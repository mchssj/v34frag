/**
 * CSSTV Flash: la flash ciega según hacia dónde mirás y a qué distancia, parecido a CS:GO y CS2
 * (plan docs/bitacora/2026-11-11-flash-por-angulo).
 *
 * El juego calcula la duración y la opacidad de la flash con la distancia, la visibilidad y el ángulo,
 * pero el ángulo tiene solo tres escalones y de espaldas la pantalla igual queda casi blanca. Este plugin
 * deshace el escalón del juego y aplica una curva suave de ángulo y una caída extra por distancia.
 *
 * Orden de los eventos dentro de la explosión: primero player_blind (uno por jugador encandilado) y después
 * flashbang_detonate (con la posición), en el mismo tick. Los jugadores se juntan en el primero y se
 * recalculan en el segundo. El cliente dibuja la flash con m_flFlashDuration y m_flFlashMaxAlpha.
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>

#define PLUGIN_VERSION "1.0.0"

ConVar g_cvEnable;
ConVar g_cvDebug;
ConVar g_cvFullAngle;
ConVar g_cvBackAngle;
ConVar g_cvBackScale;
ConVar g_cvBackAlpha;
ConVar g_cvDistNear;
ConVar g_cvDistFar;
ConVar g_cvDistScale;
ConVar g_cvMin;

bool g_bPending[MAXPLAYERS + 1];
bool g_bAnyPending;

public Plugin myinfo =
{
	name = "CSSTV Flash",
	author = "CSSTV",
	description = "La flash ciega según el ángulo y la distancia, como en CS:GO",
	version = PLUGIN_VERSION,
	url = ""
};

public void OnPluginStart()
{
	if (FindSendPropInfo("CCSPlayer", "m_flFlashDuration") <= 0 || FindSendPropInfo("CCSPlayer", "m_flFlashMaxAlpha") <= 0)
		SetFailState("Este juego no tiene m_flFlashDuration o m_flFlashMaxAlpha.");

	g_cvEnable = CreateConVar("csstv_flash_enable", "1", "Recalcular la flash según el ángulo y la distancia (0 = como el juego).", _, true, 0.0, true, 1.0);
	g_cvDebug = CreateConVar("csstv_flash_debug", "0", "Escribir en el log de SourceMod el valor del juego y el nuevo de cada jugador.", _, true, 0.0, true, 1.0);
	g_cvFullAngle = CreateConVar("csstv_flash_full_angle", "50", "Grados desde el centro de la vista hasta donde la flash ciega completa.", _, true, 0.0, true, 180.0);
	g_cvBackAngle = CreateConVar("csstv_flash_back_angle", "135", "Grados desde el centro de la vista a partir de los que cuenta como de espaldas.", _, true, 0.0, true, 180.0);
	g_cvBackScale = CreateConVar("csstv_flash_back_scale", "0.15", "Parte de la duración que queda de espaldas.", _, true, 0.0, true, 1.0);
	g_cvBackAlpha = CreateConVar("csstv_flash_back_alpha", "140", "Opacidad máxima de la pantalla de espaldas (255 = blanca).", _, true, 0.0, true, 255.0);
	g_cvDistNear = CreateConVar("csstv_flash_dist_near", "400", "Distancia hasta la que no se baja nada extra.", _, true, 0.0);
	g_cvDistFar = CreateConVar("csstv_flash_dist_far", "1500", "Distancia desde la que se aplica toda la baja extra.", _, true, 1.0);
	g_cvDistScale = CreateConVar("csstv_flash_dist_scale", "0.4", "Parte de la duración que queda desde csstv_flash_dist_far.", _, true, 0.0, true, 1.0);
	g_cvMin = CreateConVar("csstv_flash_min", "0.1", "Por debajo de esta duración (s) la flash no encandila.", _, true, 0.0, true, 5.0);
	CreateConVar("csstv_flash_version", PLUGIN_VERSION, "Versión de CSSTV Flash.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	AutoExecConfig(true, "csstv_flash");

	HookEvent("player_blind", Event_PlayerBlind);
	HookEvent("flashbang_detonate", Event_FlashDetonate);
}

public void OnClientDisconnect(int client)
{
	g_bPending[client] = false;
}

public void Event_PlayerBlind(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_cvEnable.BoolValue)
		return;
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client <= 0 || !IsClientInGame(client) || IsClientSourceTV(client))
		return;
	g_bPending[client] = true;
	if (!g_bAnyPending)
	{
		g_bAnyPending = true;
		RequestFrame(Frame_ClearPending);   // si flashbang_detonate no llega, queda el cálculo del juego
	}
}

public void Frame_ClearPending(any data)
{
	if (!g_bAnyPending)
		return;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (g_bPending[i] && g_cvDebug.BoolValue && IsClientInGame(i))
			LogMessage("%N: sin flashbang_detonate, queda el valor del juego", i);
		g_bPending[i] = false;
	}
	g_bAnyPending = false;
}

public void Event_FlashDetonate(Event event, const char[] name, bool dontBroadcast)
{
	if (!g_bAnyPending)
		return;
	float pos[3];
	pos[0] = event.GetFloat("x");
	pos[1] = event.GetFloat("y");
	pos[2] = event.GetFloat("z");
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!g_bPending[i])
			continue;
		g_bPending[i] = false;
		if (IsClientInGame(i))
			Recalc(i, pos);
	}
	g_bAnyPending = false;
}

/** Escalón de ángulo del juego (proporción de la duración frente a mirarla de frente). */
float GameTier(float dot)
{
	if (dot >= 0.5)
		return 1.0;
	if (dot >= -0.5)
		return 0.7;
	return 0.4;
}

float Clamp01(float x)
{
	if (x < 0.0)
		return 0.0;
	if (x > 1.0)
		return 1.0;
	return x;
}

/** 1 hasta full_angle, 0 desde back_angle, smoothstep entre los dos. */
float AngleT(float deg)
{
	float full = g_cvFullAngle.FloatValue;
	float back = g_cvBackAngle.FloatValue;
	if (back <= full)
		return deg <= full ? 1.0 : 0.0;
	float t = Clamp01((deg - full) / (back - full));
	t = t * t * (3.0 - 2.0 * t);
	return 1.0 - t;
}

float DistFactor(float dist)
{
	float near = g_cvDistNear.FloatValue;
	float far = g_cvDistFar.FloatValue;
	float scale = g_cvDistScale.FloatValue;
	if (far <= near)
		return dist <= near ? 1.0 : scale;
	float t = Clamp01((dist - near) / (far - near));
	return 1.0 - t * (1.0 - scale);
}

void Recalc(int client, const float flashPos[3])
{
	float gameDur = GetEntPropFloat(client, Prop_Send, "m_flFlashDuration");
	float gameAlpha = GetEntPropFloat(client, Prop_Send, "m_flFlashMaxAlpha");
	if (gameDur <= 0.0)
		return;

	float eye[3], ang[3], fwd[3], los[3];
	GetClientEyePosition(client, eye);
	GetClientEyeAngles(client, ang);
	GetAngleVectors(ang, fwd, NULL_VECTOR, NULL_VECTOR);
	MakeVectorFromPoints(eye, flashPos, los);
	float dist = GetVectorLength(los);
	if (dist > 0.0)
		NormalizeVector(los, los);
	float dot = dist > 0.0 ? GetVectorDotProduct(fwd, los) : 1.0;
	if (dot > 1.0)
		dot = 1.0;
	else if (dot < -1.0)
		dot = -1.0;
	float deg = RadToDeg(ArcCosine(dot));

	float a = AngleT(deg);
	float base = gameDur / GameTier(dot);
	float angScale = g_cvBackScale.FloatValue + (1.0 - g_cvBackScale.FloatValue) * a;
	float dur = base * angScale * DistFactor(dist);
	if (dur > gameDur)
		dur = gameDur;   // solo baja: entre 60° y 85° la curva daría más que el escalón de costado del juego
	float alpha = g_cvBackAlpha.FloatValue + (255.0 - g_cvBackAlpha.FloatValue) * a;
	if (alpha > gameAlpha && gameAlpha > 0.0)
		alpha = gameAlpha;
	if (dur < g_cvMin.FloatValue)
	{
		dur = 0.0;
		alpha = 0.0;
	}

	SetEntPropFloat(client, Prop_Send, "m_flFlashDuration", dur);
	SetEntPropFloat(client, Prop_Send, "m_flFlashMaxAlpha", alpha);

	if (g_cvDebug.BoolValue)
		LogMessage("%N: dist %.0f ang %.0f° · juego %.2fs/%.0f · nuevo %.2fs/%.0f",
			client, dist, deg, gameDur, gameAlpha, dur, alpha);
}
