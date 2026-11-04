/**
 * Ayuda para probar la tanda de QOL con bots en cssds. Solo para pruebas locales, nunca en un servidor real.
 *   sm_fakecmd <bot> <comando…>  el bot ejecuta el comando (sm_coach ct, sm_switch, spec_mode…)
 *   sm_t_obs <nombre>            equipo, modo de cámara y a quién mira
 *   sm_t_c4                      quién tiene la C4 y dónde está
 *   sm_t_info <nombre>           vivo, equipo y plata
 */
#pragma semicolon 1
#pragma newdecls required
#include <sourcemod>
#include <sdktools>

public Plugin myinfo = { name = "QOL prueba", author = "CMLeague", description = "Solo pruebas", version = "1.0", url = "" };

public void OnPluginStart()
{
	RegServerCmd("sm_fakecmd", Cmd_Fake);
	RegServerCmd("sm_t_obs", Cmd_Obs);
	RegServerCmd("sm_t_c4", Cmd_C4);
	RegServerCmd("sm_t_info", Cmd_Info);
}

int Find(const char[] name)
{
	char n[64];
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && GetClientName(i, n, sizeof(n)) && StrEqual(n, name, false))
			return i;
	return 0;
}

public Action Cmd_Fake(int args)
{
	char name[64], full[256];
	GetCmdArg(1, name, sizeof(name));
	GetCmdArgString(full, sizeof(full));
	int c = Find(name);
	if (!c) { PrintToServer("[t] no está %s", name); return Plugin_Handled; }
	FakeClientCommand(c, "%s", full[strlen(name) + 1]);
	PrintToServer("[t] %s ejecutó: %s", name, full[strlen(name) + 1]);
	return Plugin_Handled;
}

public Action Cmd_Obs(int args)
{
	char name[64];
	GetCmdArg(1, name, sizeof(name));
	int c = Find(name);
	if (!c) { PrintToServer("[t] no está %s", name); return Plugin_Handled; }
	int t = GetEntPropEnt(c, Prop_Send, "m_hObserverTarget");
	char tn[64] = "-";
	if (t > 0 && t <= MaxClients && IsClientInGame(t))
		Format(tn, sizeof(tn), "%N (equipo %d, %s)", t, GetClientTeam(t), IsPlayerAlive(t) ? "vivo" : "muerto");
	PrintToServer("[t] %s equipo=%d modo=%d mira=%s", name, GetClientTeam(c), GetEntProp(c, Prop_Send, "m_iObserverMode"), tn);
	return Plugin_Handled;
}

public Action Cmd_C4(int args)
{
	int c4 = FindEntityByClassname(-1, "weapon_c4");
	if (c4 == -1) { PrintToServer("[t] no hay C4"); return Plugin_Handled; }
	int owner = GetEntPropEnt(c4, Prop_Send, "m_hOwnerEntity");
	float pos[3];
	GetEntPropVector(c4, Prop_Send, "m_vecOrigin", pos);
	if (owner > 0 && owner <= MaxClients)
		PrintToServer("[t] C4 de %N", owner);
	else
		PrintToServer("[t] C4 en el piso en %.0f %.0f %.0f", pos[0], pos[1], pos[2]);
	return Plugin_Handled;
}

public Action Cmd_Info(int args)
{
	char name[64];
	GetCmdArg(1, name, sizeof(name));
	int c = Find(name);
	if (!c) { PrintToServer("[t] no está %s", name); return Plugin_Handled; }
	PrintToServer("[t] %s equipo=%d %s plata=%d", name, GetClientTeam(c), IsPlayerAlive(c) ? "vivo" : "muerto", GetEntProp(c, Prop_Send, "m_iAccount"));
	return Plugin_Handled;
}
