/**
 * CSSTV Matchmaking Dispatcher (independiente).
 * NO modifica CSSTV Match Reporter.
 *
 * Requiere SourceMod + System2. Consulta Supabase por RPC autenticada con token
 * del servidor, aplica sv_password y restringe conexiones a los SteamID asignados.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>
#include <sdktools>
#undef REQUIRE_EXTENSIONS
#include <system2>
#define REQUIRE_EXTENSIONS

#define MM_VERSION "1.1.0"
#define MM_MAX_STEAMIDS 10

public Plugin myinfo =
{
    name = "CSSTV Matchmaking Dispatcher",
    author = "CSSTV",
    description = "Despacho seguro de matchmaking 1v1/2v2/3v3/5v5 independiente del reporter",
    version = MM_VERSION,
    url = ""
};

ConVar g_cvApiUrl;
ConVar g_cvApiKey;
ConVar g_cvToken;
ConVar g_cvIdlePassword;
ConVar g_cvPollSeconds;
ConVar g_cvKickUnknown;
ConVar g_cvChangeMap;

char g_sRoster[MM_MAX_STEAMIDS][32];
int g_iRosterCount;
char g_sMatchId[40];
char g_sMatchPassword[32];
char g_sMatchMap[64];
bool g_bMatchActive;

public void OnPluginStart()
{
    g_cvApiUrl = CreateConVar("csstv_mm_api_url", "", "URL REST RPC base de Supabase (https://PROJECT.supabase.co/rest/v1/rpc).", FCVAR_PROTECTED);
    g_cvApiKey = CreateConVar("csstv_mm_api_key", "", "Anon/publishable key de Supabase.", FCVAR_PROTECTED);
    g_cvToken = CreateConVar("csstv_mm_server_token", "", "Token secreto del servidor creado desde Admin > Servidores.", FCVAR_PROTECTED | FCVAR_DONTRECORD);
    g_cvIdlePassword = CreateConVar("csstv_mm_idle_password", "", "Contraseña privada mientras no hay mix. Configurala antes de habilitar el plugin.", FCVAR_PROTECTED | FCVAR_DONTRECORD);
    g_cvPollSeconds = CreateConVar("csstv_mm_poll_seconds", "5", "Intervalo de consulta a Supabase.", _, true, 3.0, true, 30.0);
    g_cvKickUnknown = CreateConVar("csstv_mm_kick_unknown", "1", "Expulsar jugadores que no estén en el roster asignado.", _, true, 0.0, true, 1.0);
    g_cvChangeMap = CreateConVar("csstv_mm_change_map", "1", "Cambiar automáticamente al mapa asignado.", _, true, 0.0, true, 1.0);
    AutoExecConfig(true, "csstv_matchmaking_dispatcher");

    RegAdminCmd("sm_csstv_mm_status", Cmd_MMStatus, ADMFLAG_GENERIC, "Estado del dispatcher.");
    RegAdminCmd("sm_csstv_mm_reset", Cmd_MMReset, ADMFLAG_ROOT, "Restablecer roster local y volver a contraseña idle.");

    ApplyIdlePassword();
    CreateTimer(g_cvPollSeconds.FloatValue, Timer_Poll, _, TIMER_REPEAT);
}

public void OnConfigsExecuted()
{
    ApplyIdlePassword();
}

public void OnClientPostAdminCheck(int client)
{
    if (!IsClientInGame(client) || IsFakeClient(client))
        return;

    if (!g_bMatchActive)
    {
        if (g_cvKickUnknown.BoolValue)
            CreateTimer(1.0, Timer_KickIfUnassigned, GetClientUserId(client));
        return;
    }

    if (!ClientInRoster(client) && !CheckCommandAccess(client, "csstv_mm_admin_bypass", ADMFLAG_ROOT, true))
        CreateTimer(0.2, Timer_KickIfUnassigned, GetClientUserId(client));
}

public Action Timer_KickIfUnassigned(Handle timer, any userid)
{
    int client = GetClientOfUserId(userid);
    if (client <= 0 || !IsClientInGame(client))
        return Plugin_Stop;

    if (CheckCommandAccess(client, "csstv_mm_admin_bypass", ADMFLAG_ROOT, true))
        return Plugin_Stop;

    if (!g_bMatchActive || !ClientInRoster(client))
        KickClient(client, "Este servidor esta reservado para un mix de CSSTV.");
    return Plugin_Stop;
}

bool ClientInRoster(int client)
{
    char auth[32];
    if (!GetClientAuthId(client, AuthId_Steam2, auth, sizeof(auth), true))
        return false;

    for (int i = 0; i < g_iRosterCount; i++)
        if (StrEqual(auth, g_sRoster[i], false))
            return true;
    return false;
}

public Action Timer_Poll(Handle timer)
{
    char base[256], key[512], token[160], url[384];
    g_cvApiUrl.GetString(base, sizeof(base));
    g_cvApiKey.GetString(key, sizeof(key));
    g_cvToken.GetString(token, sizeof(token));

    if (!base[0] || !key[0] || !token[0])
        return Plugin_Continue;

    int n = strlen(base);
    while (n > 0 && base[n - 1] == '/')
        base[--n] = '\0';
    Format(url, sizeof(url), "%s/matchmaking_server_poll", base);

    char body[256];
    Format(body, sizeof(body), "{\"p_token\":\"%s\"}", token);
    System2HTTPRequest req = new System2HTTPRequest(Http_OnPoll, "%s", url);
    req.SetHeader("apikey", "%s", key);
    req.SetHeader("Authorization", "Bearer %s", key);
    req.SetHeader("Content-Type", "application/json");
    req.SetUserAgent("CSSTV-Matchmaking-Dispatcher/%s", MM_VERSION);
    req.SetData("%s", body);
    req.Timeout = 10;
    req.POST();
    delete req;
    return Plugin_Continue;
}

public void Http_OnPoll(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
    if (!success || response == null || response.StatusCode < 200 || response.StatusCode >= 300)
    {
        char errorBody[768];
        errorBody[0] = '\0';
        if (response != null)
            response.GetContent(errorBody, sizeof(errorBody));
        LogError("[CSSTV MM] Error consultando despacho: HTTP %d / %s | body: %s", response == null ? 0 : response.StatusCode, error, errorBody);
        return;
    }

    char payload[1024];
    response.GetContent(payload, sizeof(payload));
    TrimString(payload);
    // PostgREST serializa el retorno text como un string JSON: quitar comillas externas.
    int len = strlen(payload);
    if (len >= 2 && payload[0] == '"' && payload[len - 1] == '"')
    {
        payload[len - 1] = '\0';
        for (int i = 0; i < len - 1; i++)
            payload[i] = payload[i + 1];
        payload[len - 2] = '\0';
    }

    if (StrEqual(payload, "IDLE", false))
    {
        if (g_bMatchActive)
        {
            g_bMatchActive = false;
            g_iRosterCount = 0;
            g_sMatchId[0] = '\0';
            g_sMatchPassword[0] = '\0';
            ApplyIdlePassword();
            LogMessage("[CSSTV MM] Sin mix activo; restaurada contraseña idle.");
        }
        return;
    }

    if (StrContains(payload, "ERROR|", false) == 0)
    {
        LogError("[CSSTV MM] Supabase no pudo despachar la partida: %s", payload);
        return;
    }

    char parts[4][512];
    if (ExplodeString(payload, "|", parts, sizeof(parts), sizeof(parts[])) != 4)
    {
        LogError("[CSSTV MM] Respuesta de despacho inválida.");
        return;
    }

    if (StrEqual(g_sMatchId, parts[0]) && g_bMatchActive)
        return; // mismo mix: no volver a cambiar password/mapa.

    char ids[MM_MAX_STEAMIDS][32];
    int count = ExplodeString(parts[3], ",", ids, sizeof(ids), sizeof(ids[]));
    // Compatible con respuestas que agregan =equipo al SteamID.
    for (int i = 0; i < count; i++)
    {
        int eq = FindCharInString(ids[i], 61);
        if (eq > 0) ids[i][eq] = 0;
    }
    // La cola admite 1v1, 2v2, 3v3 y 5v5: 2, 4, 6 o 10 SteamID.
    // Validar antes de aplicar la contraseña evita dejar el servidor en estado
    // parcialmente asignado si Supabase devuelve un roster incompleto.
    if (count != 2 && count != 4 && count != 6 && count != MM_MAX_STEAMIDS)
    {
        LogError("[CSSTV MM] Roster inválido: se esperaban 2, 4, 6 o 10 SteamID; recibidos: %d.", count);
        return;
    }

    strcopy(g_sMatchId, sizeof(g_sMatchId), parts[0]);
    strcopy(g_sMatchPassword, sizeof(g_sMatchPassword), parts[1]);
    strcopy(g_sMatchMap, sizeof(g_sMatchMap), parts[2]);
    g_iRosterCount = count;
    for (int i = 0; i < count; i++)
        strcopy(g_sRoster[i], sizeof(g_sRoster[]), ids[i]);
    g_bMatchActive = true;

    ServerCommand("sv_password \"%s\"", g_sMatchPassword);
    ServerExecute();
    PrintToChatAll("\x04[CSSTV]\x01 Mix asignado. Contraseña: \x03%s\x01", g_sMatchPassword);
    LogMessage("[CSSTV MM] Mix %s aplicado; roster autorizado: %d.", g_sMatchId, g_iRosterCount);

    if (g_cvChangeMap.BoolValue && g_sMatchMap[0])
    {
        char current[64];
        GetCurrentMap(current, sizeof(current));
        if (!StrEqual(current, g_sMatchMap, false))
        {
            ServerCommand("changelevel \"%s\"", g_sMatchMap);
        }
    }

    for (int client = 1; client <= MaxClients; client++)
    {
        if (IsClientInGame(client) && !IsFakeClient(client) && !ClientInRoster(client)
            && !CheckCommandAccess(client, "csstv_mm_admin_bypass", ADMFLAG_ROOT, true))
            KickClient(client, "Servidor reservado para el mix asignado.");
    }
}

void ApplyIdlePassword()
{
    char pwd[128];
    g_cvIdlePassword.GetString(pwd, sizeof(pwd));
    if (!pwd[0])
    {
        Format(pwd, sizeof(pwd), "frag%04d", GetRandomInt(0, 9999));
        g_cvIdlePassword.SetString(pwd);
        LogMessage("[CSSTV MM] Se generó una contraseña idle aleatoria. Configurá csstv_mm_idle_password si querés una fija.");
    }
    ServerCommand("sv_password \"%s\"", pwd);
    ServerExecute();
}

public Action Cmd_MMStatus(int client, int args)
{
    ReplyToCommand(client, "[CSSTV MM] activo=%d match=%s roster=%d", g_bMatchActive, g_sMatchId[0] ? g_sMatchId : "-", g_iRosterCount);
    return Plugin_Handled;
}

public Action Cmd_MMReset(int client, int args)
{
    g_bMatchActive = false;
    g_iRosterCount = 0;
    g_sMatchId[0] = '\0';
    ApplyIdlePassword();
    ReplyToCommand(client, "[CSSTV MM] Estado local restablecido; la próxima consulta puede volver a aplicar el mix si sigue activo en Supabase.");
    return Plugin_Handled;
}
