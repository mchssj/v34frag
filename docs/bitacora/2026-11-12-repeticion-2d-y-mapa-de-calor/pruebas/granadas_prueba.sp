/**
 * Solo para las pruebas con bots de la repetición 2D: al terminar el tiempo de compra le da a cada uno un humo,
 * dos flashes y una HE, así los bots las tiran y el .trk trae humos (líneas S), cegados y desactivaciones.
 * No va a ningún servidor.
 */
#include <sourcemod>
#include <sdktools>

public Plugin myinfo = { name = "Granadas para la prueba", author = "CMLeague", version = "1.0.0" };

public void OnPluginStart()
{
	HookEvent("round_freeze_end", Event_FreezeEnd, EventHookMode_PostNoCopy);
}

public void Event_FreezeEnd(Event event, const char[] name, bool dontBroadcast)
{
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || !IsPlayerAlive(i) || GetClientTeam(i) < 2)
			continue;
		GivePlayerItem(i, "weapon_smokegrenade");
		GivePlayerItem(i, "weapon_flashbang");
		GivePlayerItem(i, "weapon_hegrenade");
		if (GetClientTeam(i) == 3)
			SetEntProp(i, Prop_Send, "m_bHasDefuser", 1);
	}
}
