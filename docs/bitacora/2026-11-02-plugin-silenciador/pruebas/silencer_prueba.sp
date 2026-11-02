/**
 * Prueba con bots de csstv_silencer. Solo para el servidor local.
 * Cuando hay un bot vivo le da M4A1 y USP nuevas y escribe el estado en el log. Después le saca la M4A1, le apaga
 * el silenciador y se la vuelve a equipar, como un arma levantada del piso: debe seguir apagado.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>

bool g_bDone;

public void OnMapStart()
{
	g_bDone = false;
	CreateTimer(5.0, Timer_Find, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
}

void Report(const char[] step, int weapon)
{
	LogMessage("[silencer_prueba] %s: m_bSilencerOn=%d", step, GetEntProp(weapon, Prop_Send, "m_bSilencerOn"));
}

public Action Timer_Find(Handle timer)
{
	if (g_bDone)
		return Plugin_Stop;
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && IsFakeClient(i) && !IsClientSourceTV(i) && IsPlayerAlive(i))
		{
			g_bDone = true;
			Run(i);
			return Plugin_Stop;
		}
	return Plugin_Continue;
}

void Run(int bot)
{
	for (int slot = 0; slot < 2; slot++)
	{
		int w = GetPlayerWeaponSlot(bot, slot);
		if (w != -1)
		{
			RemovePlayerItem(bot, w);
			AcceptEntityInput(w, "Kill");
		}
	}
	int m4 = GivePlayerItem(bot, "weapon_m4a1");
	int usp = GivePlayerItem(bot, "weapon_usp");
	Report("M4A1 nueva (esperado 1)", m4);
	Report("USP nueva (esperado 1)", usp);
	RemovePlayerItem(bot, m4);
	SetEntProp(m4, Prop_Send, "m_bSilencerOn", 0);
	DataPack pack;
	CreateDataTimer(0.5, Timer_Pick, pack);
	pack.WriteCell(GetClientUserId(bot));
	pack.WriteCell(EntIndexToEntRef(m4));
}

public Action Timer_Pick(Handle timer, DataPack pack)
{
	pack.Reset();
	int bot = GetClientOfUserId(pack.ReadCell());
	int m4 = EntRefToEntIndex(pack.ReadCell());
	if (bot && m4 != -1 && IsPlayerAlive(bot))
	{
		EquipPlayerWeapon(bot, m4);
		Report("M4A1 ya existente, reequipada (esperado 0)", m4);
	}
	return Plugin_Stop;
}
