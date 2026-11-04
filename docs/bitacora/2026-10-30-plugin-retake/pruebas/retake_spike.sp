/**
 * Prueba de la bomba plantada en v34 (sección 5 del plan). No se despliega.
 *  spike_props: netprops que necesita el plugin.
 *  spike_team <userid> <equipo> / spike_respawn <userid> / spike_end: natives de cstrike.
 *  spike_a <sitio>: opción A, crea planted_c4 en el centro del sitio.
 *  spike_b <userid> <sitio>: opción B, lleva a un T al sitio con la C4 y le aprieta el ataque.
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#include <cstrike>

public Plugin myinfo = { name = "retake_spike", author = "v34frag", description = "Prueba de la bomba plantada", version = "0", url = "" };

int g_iPlanter;

public void OnPluginStart()
{
	RegServerCmd("spike_props", Cmd_Props);
	RegServerCmd("spike_team", Cmd_Team);
	RegServerCmd("spike_respawn", Cmd_Respawn);
	RegServerCmd("spike_end", Cmd_End);
	RegServerCmd("spike_a", Cmd_A);
	RegServerCmd("spike_b", Cmd_B);
	HookEvent("bomb_planted", Event_Log);
	HookEvent("bomb_exploded", Event_Log);
	HookEvent("bomb_defused", Event_Log);
	HookEvent("round_end", Event_Log);
	HookEvent("round_start", Event_Log);
}

public void Event_Log(Event event, const char[] name, bool dontBroadcast)
{
	LogMessage("SPIKE evento %s t=%.1f", name, GetGameTime());
	if (StrEqual(name, "bomb_planted"))
		g_iPlanter = 0;
}

void Prop(const char[] cls, const char[] prop)
{
	PrintToServer("%s.%s = %d", cls, prop, FindSendPropInfo(cls, prop));
}

public Action Cmd_Props(int args)
{
	Prop("CCSPlayer", "m_iAccount");
	Prop("CCSPlayer", "m_bHasDefuser");
	Prop("CCSPlayer", "m_bHasHelmet");
	Prop("CCSPlayer", "m_ArmorValue");
	Prop("CCSPlayer", "m_bInBombZone");
	Prop("CPlantedC4", "m_bBombTicking");
	Prop("CPlantedC4", "m_flC4Blow");
	Prop("CPlantedC4", "m_flTimerLength");
	Prop("CC4", "m_bStartedArming");
	Prop("CC4", "m_fArmedTime");
	return Plugin_Handled;
}

int ArgClient(int n)
{
	char s[16];
	GetCmdArg(n, s, sizeof(s));
	return GetClientOfUserId(StringToInt(s));
}

public Action Cmd_Team(int args)
{
	int client = ArgClient(1);
	char s[8];
	GetCmdArg(2, s, sizeof(s));
	CS_SwitchTeam(client, StringToInt(s));
	PrintToServer("SwitchTeam ok, equipo %d", GetClientTeam(client));
	return Plugin_Handled;
}

public Action Cmd_Respawn(int args)
{
	CS_RespawnPlayer(ArgClient(1));
	PrintToServer("RespawnPlayer ok");
	return Plugin_Handled;
}

public Action Cmd_End(int args)
{
	CS_TerminateRound(3.0, CSRoundEnd_Draw);
	PrintToServer("TerminateRound ok");
	return Plugin_Handled;
}

/** Centro del sitio n, apoyado en el suelo. */
bool SitePos(int n, float pos[3])
{
	int ent = -1, i;
	while ((ent = FindEntityByClassname(ent, "func_bomb_target")) != -1)
	{
		if (i++ != n)
			continue;
		float mins[3], maxs[3];
		GetEntPropVector(ent, Prop_Send, "m_vecMins", mins);
		GetEntPropVector(ent, Prop_Send, "m_vecMaxs", maxs);
		float top[3], down[3] = { 90.0, 0.0, 0.0 };
		top[0] = (mins[0] + maxs[0]) / 2.0;
		top[1] = (mins[1] + maxs[1]) / 2.0;
		top[2] = maxs[2];
		TR_TraceRay(top, down, MASK_SOLID, RayType_Infinite);
		TR_GetEndPosition(pos);
		pos[2] += 8.0;
		PrintToServer("Sitio %d: mins %.0f %.0f %.0f, maxs %.0f %.0f %.0f, suelo %.0f %.0f %.0f", n, mins[0], mins[1], mins[2], maxs[0], maxs[1], maxs[2], pos[0], pos[1], pos[2]);
		return true;
	}
	PrintToServer("No existe el sitio %d", n);
	return false;
}

public Action Cmd_A(int args)
{
	char s[8];
	GetCmdArg(1, s, sizeof(s));
	float pos[3];
	if (!SitePos(StringToInt(s), pos))
		return Plugin_Handled;
	int ent = CreateEntityByName("planted_c4");
	PrintToServer("planted_c4 = %d", ent);
	if (ent == -1)
		return Plugin_Handled;
	TeleportEntity(ent, pos, NULL_VECTOR, NULL_VECTOR);
	DispatchSpawn(ent);
	SetEntProp(ent, Prop_Send, "m_bBombTicking", 1);
	SetEntPropFloat(ent, Prop_Send, "m_flC4Blow", GetGameTime() + 15.0);
	SetEntPropFloat(ent, Prop_Send, "m_flTimerLength", 15.0);
	CreateTimer(25.0, Timer_Check, EntIndexToEntRef(ent));
	return Plugin_Handled;
}

public Action Timer_Check(Handle timer, int ref)
{
	LogMessage("SPIKE opcion A, 25 s despues: entidad %s", EntRefToEntIndex(ref) == INVALID_ENT_REFERENCE ? "ya no existe" : "sigue existiendo");
	return Plugin_Stop;
}

public Action Cmd_B(int args)
{
	int client = ArgClient(1);
	char s[8];
	GetCmdArg(2, s, sizeof(s));
	float pos[3];
	if (client == 0 || !SitePos(StringToInt(s), pos))
		return Plugin_Handled;
	TeleportEntity(client, pos, NULL_VECTOR, NULL_VECTOR);
	int c4 = GetPlayerWeaponSlot(client, CS_SLOT_C4);
	if (c4 == -1)
		c4 = GivePlayerItem(client, "weapon_c4");
	PrintToServer("c4 = %d, m_fArmedTime datamap=%d", c4, c4 == -1 ? -1 : FindDataMapInfo(c4, "m_fArmedTime"));
	if (c4 == -1)
		return Plugin_Handled;
	g_iPlanter = client;
	return Plugin_Handled;
}

public Action OnPlayerRunCmd(int client, int &buttons, int &impulse, float vel[3], float angles[3], int &weapon)
{
	if (client != g_iPlanter || !IsPlayerAlive(client))
		return Plugin_Continue;
	int c4 = GetPlayerWeaponSlot(client, CS_SLOT_C4);
	if (c4 == -1)
		return Plugin_Continue;
	if (GetEntPropEnt(client, Prop_Send, "m_hActiveWeapon") != c4)
	{
		weapon = c4;
		return Plugin_Changed;
	}
	buttons |= IN_ATTACK;
	vel[0] = vel[1] = vel[2] = 0.0;
	return Plugin_Changed;
}
