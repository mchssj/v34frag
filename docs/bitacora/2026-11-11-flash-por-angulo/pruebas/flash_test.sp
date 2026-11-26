/**
 * Solo para pruebas en el servidor local. Simula lo que hace el juego cuando explota una flash cerca de un
 * jugador (o bot), en una dirección relativa a hacia dónde mira y a una distancia dada:
 *   1. pone m_flFlashDuration y m_flFlashMaxAlpha como el juego (base × escalón de ángulo; 200 de espaldas),
 *   2. dispara player_blind,
 *   3. dispara flashbang_detonate con la posición.
 * csstv_flash recalcula en el paso 3. Después se escriben en el log los valores finales.
 *
 * sm_flashsim <userid> <grados> <distancia> [base]
 *   grados: 0 = delante, 90 = a la derecha, 180 = detrás (en horizontal, a la altura de los ojos).
 *   base: duración del juego mirándola de frente (3.0 por defecto).
 *
 * Una flash de verdad no se puede crear desde un plugin en el v34: flashbang_projectile creado con
 * CreateEntityByName no explota (el temporizador lo pone el código del arma al tirarla).
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>

public Plugin myinfo = { name = "Flash test", author = "CSSTV", description = "Prueba de csstv_flash", version = "1.1.0", url = "" };

public void OnPluginStart()
{
	RegServerCmd("sm_flashsim", Cmd_FlashSim);
	HookEvent("weapon_fire", Event_WeaponFire);
	HookEvent("player_spawn", Event_Spawn);
}

// Granadas infinitas (solo servidor local): al tirar una, se devuelve; al aparecer, las tres.
public void Event_WeaponFire(Event event, const char[] name, bool dontBroadcast)
{
	char w[32];
	event.GetString("weapon", w, sizeof(w));
	if (StrEqual(w, "flashbang") || StrEqual(w, "hegrenade") || StrEqual(w, "smokegrenade"))
	{
		DataPack pack = new DataPack();
		pack.WriteCell(event.GetInt("userid"));
		pack.WriteString(w);
		CreateTimer(1.2, Timer_Give, pack, TIMER_DATA_HNDL_CLOSE);
	}
}

public Action Timer_Give(Handle timer, DataPack pack)
{
	char w[32], cls[40];
	pack.Reset();
	int client = GetClientOfUserId(pack.ReadCell());
	pack.ReadString(w, sizeof(w));
	if (client > 0 && IsClientInGame(client) && IsPlayerAlive(client))
	{
		Format(cls, sizeof(cls), "weapon_%s", w);
		GivePlayerItem(client, cls);
	}
	return Plugin_Stop;
}

public void Event_Spawn(Event event, const char[] name, bool dontBroadcast)
{
	CreateTimer(0.3, Timer_SpawnGive, event.GetInt("userid"));
}

public Action Timer_SpawnGive(Handle timer, any userid)
{
	int client = GetClientOfUserId(userid);
	if (client > 0 && IsClientInGame(client) && IsPlayerAlive(client) && !IsFakeClient(client))
	{
		GivePlayerItem(client, "weapon_flashbang");
		GivePlayerItem(client, "weapon_hegrenade");
		GivePlayerItem(client, "weapon_smokegrenade");
	}
	return Plugin_Stop;
}

public Action Cmd_FlashSim(int args)
{
	char buf[16];
	GetCmdArg(1, buf, sizeof(buf));
	int client = GetClientOfUserId(StringToInt(buf));
	if (client <= 0 || !IsPlayerAlive(client))
	{
		PrintToServer("[test] userid inválido o muerto");
		return Plugin_Handled;
	}
	GetCmdArg(2, buf, sizeof(buf));
	float deg = StringToFloat(buf);
	GetCmdArg(3, buf, sizeof(buf));
	float dist = StringToFloat(buf);
	float base = 3.0;
	if (args >= 4)
	{
		GetCmdArg(4, buf, sizeof(buf));
		base = StringToFloat(buf);
	}

	float eye[3], ang[3], dir[3], pos[3];
	GetClientEyePosition(client, eye);
	GetClientEyeAngles(client, ang);
	float yaw = ang[1];
	ang[0] = 0.0;
	ang[1] -= deg;   // el yaw crece hacia la izquierda: restar = girar a la derecha
	GetAngleVectors(ang, dir, NULL_VECTOR, NULL_VECTOR);
	for (int i = 0; i < 3; i++)
		pos[i] = eye[i] + dir[i] * dist;

	// Lo que haría el juego: escalón por el ángulo real (con la inclinación de la vista incluida).
	float fwd[3], los[3];
	GetClientEyeAngles(client, ang);
	GetAngleVectors(ang, fwd, NULL_VECTOR, NULL_VECTOR);
	MakeVectorFromPoints(eye, pos, los);
	NormalizeVector(los, los);
	float dot = GetVectorDotProduct(fwd, los);
	float tier = dot >= 0.5 ? 1.0 : (dot >= -0.5 ? 0.7 : 0.4);
	float alpha = dot >= -0.5 ? 255.0 : 200.0;
	SetEntPropFloat(client, Prop_Send, "m_flFlashDuration", base * tier);
	SetEntPropFloat(client, Prop_Send, "m_flFlashMaxAlpha", alpha);

	Event e = CreateEvent("player_blind", true);
	e.SetInt("userid", GetClientUserId(client));
	e.Fire();
	e = CreateEvent("flashbang_detonate", true);
	e.SetInt("userid", GetClientUserId(client));
	e.SetFloat("x", pos[0]);
	e.SetFloat("y", pos[1]);
	e.SetFloat("z", pos[2]);
	e.Fire();

	LogMessage("[test] %N · %.0f° a %.0f u (vista %.0f/%.0f) · juego %.2fs/%.0f → final %.2fs/%.0f",
		client, deg, dist, ang[0], yaw, base * tier, alpha,
		GetEntPropFloat(client, Prop_Send, "m_flFlashDuration"), GetEntPropFloat(client, Prop_Send, "m_flFlashMaxAlpha"));
	return Plugin_Handled;
}
