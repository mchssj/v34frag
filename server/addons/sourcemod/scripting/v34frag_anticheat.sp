#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>

#define AC_VERSION "0.1.0"

public Plugin myinfo =
{
    name = "v34FRAGNATION AntiCheat Telemetry",
    author = "v34FRAGNATION",
    description = "Captura pasiva de eventos para revisión manual; no sanciona.",
    version = AC_VERSION,
    url = "https://csstv.gamer.ad"
};

ConVar gCvarEnabled;
bool gEventHookedWeaponFire;
bool gEventHookedPlayerHurt;
bool gEventHookedPlayerDeath;
bool gEventHookedRoundStart;
bool gEventHookedRoundEnd;

public void OnPluginStart()
{
    gCvarEnabled = CreateConVar(
        "sm_ac_telemetry_enabled",
        "1",
        "Activa el registro pasivo de eventos anticheat (0=off, 1=on).",
        FCVAR_NONE,
        true,
        0.0,
        true,
        1.0
    );

    gEventHookedWeaponFire = HookEventEx("weapon_fire", Event_WeaponFire, EventHookMode_Post);
    gEventHookedPlayerHurt = HookEventEx("player_hurt", Event_PlayerHurt, EventHookMode_Post);
    gEventHookedPlayerDeath = HookEventEx("player_death", Event_PlayerDeath, EventHookMode_Post);
    gEventHookedRoundStart = HookEventEx("round_start", Event_RoundStart, EventHookMode_Post);
    gEventHookedRoundEnd = HookEventEx("round_end", Event_RoundEnd, EventHookMode_Post);

    RegAdminCmd("sm_ac_status", Command_Status, ADMFLAG_GENERIC, "Muestra el estado de telemetría anticheat.");
    RegAdminCmd("sm_ac_testlog", Command_TestLog, ADMFLAG_GENERIC, "Escribe un evento de prueba en el log local.");

    LogToFileEx("v34frag_anticheat.log",
        "START version=%s enabled=%d hooks weapon_fire=%d player_hurt=%d player_death=%d round_start=%d round_end=%d",
        AC_VERSION,
        gCvarEnabled.BoolValue,
        gEventHookedWeaponFire,
        gEventHookedPlayerHurt,
        gEventHookedPlayerDeath,
        gEventHookedRoundStart,
        gEventHookedRoundEnd
    );
}

public void OnPluginEnd()
{
    LogToFileEx("v34frag_anticheat.log", "STOP version=%s", AC_VERSION);
}

public void OnClientPutInServer(int client)
{
    if (!IsClientInGame(client) || IsFakeClient(client))
    {
        return;
    }

    LogPlayerEvent("CONNECT", client, "source=OnClientPutInServer");
}

public void OnClientDisconnect(int client)
{
    if (IsFakeClient(client))
    {
        return;
    }

    LogPlayerEvent("DISCONNECT", client, "source=OnClientDisconnect");
}

public Action Command_Status(int client, int args)
{
    ReplyToCommand(client,
        "[v34FRAGNATION AC] version=%s enabled=%d mode=passive sanctions=disabled",
        AC_VERSION,
        gCvarEnabled.BoolValue
    );

    ReplyToCommand(client,
        "[v34FRAGNATION AC] hooks weapon_fire=%d player_hurt=%d player_death=%d round_start=%d round_end=%d",
        gEventHookedWeaponFire,
        gEventHookedPlayerHurt,
        gEventHookedPlayerDeath,
        gEventHookedRoundStart,
        gEventHookedRoundEnd
    );

    return Plugin_Handled;
}

public Action Command_TestLog(int client, int args)
{
    LogToFileEx("v34frag_anticheat.log",
        "TEST actor=%N userid=%d mode=passive sanctions=disabled",
        client,
        GetClientUserId(client)
    );

    ReplyToCommand(client, "[v34FRAGNATION AC] Evento de prueba escrito en logs/v34frag_anticheat.log.");
    return Plugin_Handled;
}

public void Event_WeaponFire(Event event, const char[] name, bool dontBroadcast)
{
    if (!gCvarEnabled.BoolValue)
    {
        return;
    }

    int userid = event.GetInt("userid");
    int client = GetClientOfUserId(userid);
    if (client <= 0 || !IsClientInGame(client) || IsFakeClient(client))
    {
        return;
    }

    char weapon[64];
    event.GetString("weapon", weapon, sizeof(weapon));
    LogPlayerEvent("WEAPON_FIRE", client, weapon);
}

public void Event_PlayerHurt(Event event, const char[] name, bool dontBroadcast)
{
    if (!gCvarEnabled.BoolValue)
    {
        return;
    }

    int attacker = GetClientOfUserId(event.GetInt("attacker"));
    int victim = GetClientOfUserId(event.GetInt("userid"));

    if (attacker > 0 && IsClientInGame(attacker) && !IsFakeClient(attacker))
    {
        char detail[128];
        Format(detail, sizeof(detail), "victim_userid=%d damage=%d hitgroup=%d",
            event.GetInt("userid"),
            event.GetInt("dmg_health"),
            event.GetInt("hitgroup")
        );
        LogPlayerEvent("PLAYER_HURT_ATTACKER", attacker, detail);
    }

    if (victim > 0 && IsClientInGame(victim) && !IsFakeClient(victim))
    {
        char detail[96];
        Format(detail, sizeof(detail), "attacker_userid=%d damage=%d",
            event.GetInt("attacker"),
            event.GetInt("dmg_health")
        );
        LogPlayerEvent("PLAYER_HURT_VICTIM", victim, detail);
    }
}

public void Event_PlayerDeath(Event event, const char[] name, bool dontBroadcast)
{
    if (!gCvarEnabled.BoolValue)
    {
        return;
    }

    int victim = GetClientOfUserId(event.GetInt("userid"));
    int attacker = GetClientOfUserId(event.GetInt("attacker"));

    if (victim > 0 && IsClientInGame(victim) && !IsFakeClient(victim))
    {
        char detail[128];
        Format(detail, sizeof(detail), "attacker_userid=%d headshot=%d weapon=%s",
            event.GetInt("attacker"),
            event.GetBool("headshot"),
            event.GetString("weapon", detail, sizeof(detail)) ? detail : "unknown"
        );
        LogPlayerEvent("PLAYER_DEATH_VICTIM", victim, detail);
    }

    if (attacker > 0 && IsClientInGame(attacker) && !IsFakeClient(attacker) && attacker != victim)
    {
        LogPlayerEvent("PLAYER_DEATH_ATTACKER", attacker, "source=player_death");
    }
}

public void Event_RoundStart(Event event, const char[] name, bool dontBroadcast)
{
    if (gCvarEnabled.BoolValue)
    {
        LogToFileEx("v34frag_anticheat.log", "ROUND_START map=%s", GetCurrentMapSafe());
    }
}

public void Event_RoundEnd(Event event, const char[] name, bool dontBroadcast)
{
    if (gCvarEnabled.BoolValue)
    {
        LogToFileEx("v34frag_anticheat.log", "ROUND_END map=%s", GetCurrentMapSafe());
    }
}

void LogPlayerEvent(const char[] eventName, int client, const char[] detail)
{
    if (!gCvarEnabled.BoolValue || client <= 0 || client > MaxClients || !IsClientConnected(client))
    {
        return;
    }

    char steamId[64];
    char playerName[MAX_NAME_LENGTH];
    GetClientName(client, playerName, sizeof(playerName));

    if (!GetClientAuthId(client, AuthId_Steam2, steamId, sizeof(steamId), true))
    {
        strcopy(steamId, sizeof(steamId), "unavailable");
    }

    LogToFileEx("v34frag_anticheat.log",
        "EVENT type=%s userid=%d steamid=%s name=%s detail=%s map=%s",
        eventName,
        GetClientUserId(client),
        steamId,
        playerName,
        detail,
        GetCurrentMapSafe()
    );
}

void GetCurrentMapSafe(char[] buffer, int maxlen)
{
    GetCurrentMap(buffer, maxlen);
}

char[] GetCurrentMapSafe()
{
    char map[PLATFORM_MAX_PATH];
    GetCurrentMap(map, sizeof(map));
    return map;
}
