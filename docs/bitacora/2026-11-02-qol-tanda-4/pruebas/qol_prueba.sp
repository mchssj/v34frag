/**
 * Ayuda para probar la tanda de QOL con bots en cssds. Solo para pruebas locales, nunca en un servidor real.
 *   sm_fakecmd <bot> <comando…>  el bot ejecuta el comando (sm_coach ct, sm_switch, spec_mode…)
 *   sm_t_obs <nombre>            equipo, modo de cámara y a quién mira
 *   sm_t_c4                      quién tiene la C4 y dónde está
 *   sm_t_info <nombre>           vivo, equipo, plata, armas y granadas
 *   sm_t_money <nombre> <plata>  le pone esa plata
 *   sm_t_kill <atacante> <víctima>  la víctima muere y la kill cuenta para el atacante
 *   sm_t_ground                  cuántas armas hay en el piso (sin dueño)
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
	RegServerCmd("sm_t_money", Cmd_Money);
	RegServerCmd("sm_t_kill", Cmd_Kill);
	RegServerCmd("sm_t_ground", Cmd_Ground);
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
	char w0[32] = "-", w1[32] = "-";
	int w = GetPlayerWeaponSlot(c, 0);
	if (w > 0) GetEdictClassname(w, w0, sizeof(w0));
	w = GetPlayerWeaponSlot(c, 1);
	if (w > 0) GetEdictClassname(w, w1, sizeof(w1));
	PrintToServer("[t] %s equipo=%d %s plata=%d armas=%s,%s granadas=%d/%d/%d chaleco=%d", name, GetClientTeam(c), IsPlayerAlive(c) ? "vivo" : "muerto",
		GetEntProp(c, Prop_Send, "m_iAccount"), w0, w1, GetEntProp(c, Prop_Send, "m_iAmmo", _, 11), GetEntProp(c, Prop_Send, "m_iAmmo", _, 12),
		GetEntProp(c, Prop_Send, "m_iAmmo", _, 13), GetEntProp(c, Prop_Send, "m_ArmorValue"));
	return Plugin_Handled;
}

public Action Cmd_Money(int args)
{
	char name[64], amount[16];
	GetCmdArg(1, name, sizeof(name));
	GetCmdArg(2, amount, sizeof(amount));
	int c = Find(name);
	if (c)
		SetEntProp(c, Prop_Send, "m_iAccount", StringToInt(amount));
	return Plugin_Handled;
}

public Action Cmd_Kill(int args)
{
	char a[64], v[64];
	GetCmdArg(1, a, sizeof(a));
	GetCmdArg(2, v, sizeof(v));
	int ca = Find(a), cv = Find(v);
	if (!ca || !cv || !IsPlayerAlive(cv))
		return Plugin_Handled;
	// El daño de SDKHooks no mata en este servidor: se avisa la muerte con atacante y después se mata a la víctima.
	Event e = CreateEvent("player_death");
	e.SetInt("userid", GetClientUserId(cv));
	e.SetInt("attacker", GetClientUserId(ca));
	e.SetString("weapon", "ak47");
	e.Fire();
	ForcePlayerSuicide(cv);
	return Plugin_Handled;
}

public Action Cmd_Ground(int args)
{
	int n, ent = -1;
	char cls[32];
	for (ent = MaxClients + 1; ent < GetMaxEntities(); ent++)
	{
		if (!IsValidEdict(ent) || !GetEdictClassname(ent, cls, sizeof(cls)) || StrContains(cls, "weapon_") != 0)
			continue;
		if (GetEntPropEnt(ent, Prop_Send, "m_hOwnerEntity") == -1)
			n++;
	}
	PrintToServer("[t] armas en el piso: %d", n);
	return Plugin_Handled;
}
