/**
 * Prueba rápida para !rr y el contador de vivos en CS:S v34:
 *  - spike_inv <userid>        lista armas (m_hMyWeapons), balas (m_iClip1), reservas (m_iAmmo), chaleco, casco y kit
 *  - spike_strip <userid>      saca todas las armas con RemovePlayerItem (gamedata) y las borra
 *  - spike_give <userid> <arma> GivePlayerItem (gamedata)
 *  - spike_hud                  ShowSyncHudText y KeyHintText a todos; escribe en el log lo que devuelven
 */

#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>

Handle g_hSync;

public void OnPluginStart()
{
	RegServerCmd("spike_inv", Cmd_Inv);
	RegServerCmd("spike_strip", Cmd_Strip);
	RegServerCmd("spike_give", Cmd_Give);
	RegServerCmd("spike_hud", Cmd_Hud);
	g_hSync = CreateHudSynchronizer();
	LogMessage("[spike] CreateHudSynchronizer: %s · HudMsg id %d · KeyHintText id %d",
		g_hSync == null ? "null" : "ok", GetUserMessageId("HudMsg"), GetUserMessageId("KeyHintText"));
}

int Target()
{
	char a[16];
	GetCmdArg(1, a, sizeof(a));
	return GetClientOfUserId(StringToInt(a));
}

public Action Cmd_Inv(int args)
{
	int c = Target();
	if (c <= 0)
		return Plugin_Handled;
	LogMessage("[spike] %N vivo %d · TAB %d/%d · plata %d · chaleco %d · casco %d · kit %d", c, IsPlayerAlive(c), GetClientFrags(c), GetClientDeaths(c),
		GetEntProp(c, Prop_Send, "m_iAccount"), GetClientArmor(c), GetEntProp(c, Prop_Send, "m_bHasHelmet"), GetEntProp(c, Prop_Send, "m_bHasDefuser"));
	int n = GetEntPropArraySize(c, Prop_Send, "m_hMyWeapons");
	char cls[32];
	for (int i = 0; i < n; i++)
	{
		int w = GetEntPropEnt(c, Prop_Send, "m_hMyWeapons", i);
		if (w <= 0 || !IsValidEdict(w))
			continue;
		GetEdictClassname(w, cls, sizeof(cls));
		LogMessage("[spike]   [%d] %s clip %d ammotype %d", i, cls, GetEntProp(w, Prop_Send, "m_iClip1"), GetEntProp(w, Prop_Send, "m_iPrimaryAmmoType"));
	}
	int na = GetEntPropArraySize(c, Prop_Send, "m_iAmmo");
	char line[256];
	for (int i = 0; i < na; i++)
		Format(line, sizeof(line), "%s %d", line, GetEntProp(c, Prop_Send, "m_iAmmo", _, i));
	LogMessage("[spike]   m_iAmmo (%d):%s", na, line);
	return Plugin_Handled;
}

public Action Cmd_Strip(int args)
{
	int c = Target();
	if (c <= 0)
		return Plugin_Handled;
	int n = GetEntPropArraySize(c, Prop_Send, "m_hMyWeapons");
	for (int i = 0; i < n; i++)
	{
		int w = GetEntPropEnt(c, Prop_Send, "m_hMyWeapons", i);
		if (w <= 0 || !IsValidEdict(w))
			continue;
		bool ok = RemovePlayerItem(c, w);
		LogMessage("[spike] RemovePlayerItem %d -> %d", w, ok);
		AcceptEntityInput(w, "Kill");
	}
	return Plugin_Handled;
}

public Action Cmd_Give(int args)
{
	int c = Target();
	char w[32];
	GetCmdArg(2, w, sizeof(w));
	if (c <= 0)
		return Plugin_Handled;
	int e = GivePlayerItem(c, w);
	LogMessage("[spike] GivePlayerItem %N %s -> %d", c, w, e);
	return Plugin_Handled;
}

public Action Cmd_Hud(int args)
{
	SetHudTextParams(-1.0, 0.03, 3.0, 255, 255, 255, 255, 0, 0.0, 0.1, 0.2);
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || IsFakeClient(i))
			continue;
		int r = ShowSyncHudText(i, g_hSync, "CT 5 vs 4 T (HudMsg)");
		LogMessage("[spike] ShowSyncHudText %N -> %d", i, r);
		Handle um = StartMessageOne("KeyHintText", i);
		if (um != null)
		{
			BfWriteByte(um, 1);
			BfWriteString(um, "CT 5 vs 4 T (KeyHintText)");
			EndMessage();
		}
		LogMessage("[spike] KeyHintText %N -> %s", i, um == null ? "null" : "ok");
	}
	return Plugin_Handled;
}
