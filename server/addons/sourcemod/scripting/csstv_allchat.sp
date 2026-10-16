/**
 * CSSTV All Chat
 *
 * El chat de texto lo leen todos, vivos o muertos (plan docs/bitacora/2026-10-16-chat-vivos-muertos):
 *   - chat global: todos;
 *   - chat de equipo de CT o T: solo su equipo (vivos y muertos), no los espectadores;
 *   - chat de equipo de un espectador: los espectadores.
 *
 * Cómo: escucha el SayText2 de chat que manda el juego SIN modificarlo ni bloquearlo, anota a quién le llegó
 * y en el frame siguiente le manda el mismo mensaje a quienes les faltaba. Nunca abre un mensaje dentro del
 * gancho: el plugin "DeadChat" lo hacía y chocaba con los avisos de csstv_reporter (crash del 2026-10-15).
 * Sus envíos van con USERMSG_BLOCKHOOKS, así ningún plugin los vuelve a procesar.
 *
 * Independiente de csstv_reporter (funciona con la 1.8.0 y la 2.0.0). Sin licencia.
 * Compilación de depuración (ALLCHAT_DEBUG=): escribe en el log a quién reenvía y agrega csstv_allchat_say.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>

#define PLUGIN_VERSION "1.0.1"
#define MAX_QUEUE      32     // mensajes por frame (más que suficiente: el chat tiene antiflood)
#define MAX_PARAMS     4      // SayText2: frase + hasta 4 parámetros
#define TEAM_SPEC      1
#define TEAM_T         2
#define TEAM_CT        3

public Plugin myinfo =
{
	name = "CSSTV All Chat",
	author = "v34frag",
	description = "El chat de texto lo leen vivos y muertos (el de equipo, solo su equipo)",
	version = PLUGIN_VERSION,
	url = ""
};

ConVar g_cvEnabled;
UserMsg g_umSayText2;

// Cola de mensajes del frame: se llena en el gancho y se vacía en el frame siguiente.
int g_iCount;
int g_iAuthor[MAX_QUEUE];
bool g_bChat[MAX_QUEUE];
char g_sKey[MAX_QUEUE][64];
char g_sParam[MAX_QUEUE][MAX_PARAMS][256];
int g_iParams[MAX_QUEUE];
bool g_bGot[MAX_QUEUE][MAXPLAYERS + 1];
bool g_bFlushPending;

public void OnPluginStart()
{
	CreateConVar("csstv_allchat_version", PLUGIN_VERSION, "Versión de CSSTV All Chat.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvEnabled = CreateConVar("csstv_allchat", "1", "1: vivos y muertos leen todo el chat (el de equipo, solo su equipo). 0: chat normal del juego.", _, true, 0.0, true, 1.0);
	g_umSayText2 = GetUserMessageId("SayText2");
	if (g_umSayText2 == INVALID_MESSAGE_ID)
		SetFailState("Este juego no tiene SayText2.");
	HookUserMessage(g_umSayText2, Hook_SayText2, false);
#if defined ALLCHAT_DEBUG
	RegAdminCmd("csstv_allchat_say", Cmd_DebugSay, ADMFLAG_ROOT, "csstv_allchat_say <userid> <say|say_team> <texto>: hace hablar a un bot (solo depuración).");
#endif
}

/** Frase de chat de jugadores del juego (con o sin '#'): 1 = global, 2 = de equipo, 0 = no es chat de jugadores. */
int ChatKind(const char[] key)
{
	int i = key[0] == '#' ? 1 : 0;
	if (StrContains(key[i], "Cstrike_Chat_", true) != 0)
		return 0;
	if (StrContains(key[i], "Cstrike_Chat_All", true) == 0)
		return 1;
	if (StrContains(key[i], "Cstrike_Chat_CT", true) == 0 || StrContains(key[i], "Cstrike_Chat_T", true) == 0 || StrEqual(key[i], "Cstrike_Chat_Spec", true))
		return 2;
	return 0;
}

/**
 * Gancho de solo lectura: copia el mensaje y quiénes lo recibieron. No envía nada acá adentro.
 * El juego manda un SayText2 por cada destinatario: los iguales del mismo frame se juntan en una sola entrada.
 */
public Action Hook_SayText2(UserMsg msg_id, BfRead msg, const int[] players, int playersNum, bool reliable, bool init)
{
	if (!g_cvEnabled.BoolValue)
		return Plugin_Continue;

	int author = msg.ReadByte();
	bool chat = msg.ReadByte() != 0;
	char key[64];
	msg.ReadString(key, sizeof(key));
	if (author < 1 || author > MaxClients || !ChatKind(key))
		return Plugin_Continue;
	char param[MAX_PARAMS][256];
	int p;
	while (p < MAX_PARAMS && msg.BytesLeft > 0)
	{
		msg.ReadString(param[p], sizeof(param[]));
		p++;
	}

	int n = FindQueued(author, key, param, p);
	if (n == -1)
	{
		if (g_iCount >= MAX_QUEUE)
			return Plugin_Continue;
		n = g_iCount++;
		g_iAuthor[n] = author;
		g_bChat[n] = chat;
		strcopy(g_sKey[n], sizeof(g_sKey[]), key);
		for (int i = 0; i < p; i++)
			strcopy(g_sParam[n][i], sizeof(g_sParam[][]), param[i]);
		g_iParams[n] = p;
		for (int i = 1; i <= MaxClients; i++)
			g_bGot[n][i] = false;
	}
	for (int i = 0; i < playersNum; i++)
		if (players[i] >= 1 && players[i] <= MaxClients)
			g_bGot[n][players[i]] = true;
#if defined ALLCHAT_DEBUG
	LogMessage("[allchat] gancho: %s autor=%d entrada=%d destinatarios=%d [%s|%s]", key, author, n, playersNum,
		p > 0 ? param[0] : "", p > 1 ? param[1] : "");
#endif

	if (!g_bFlushPending)
	{
		g_bFlushPending = true;
		RequestFrame(Frame_Flush);
	}
	return Plugin_Continue;
}

/** Entrada de la cola con el mismo mensaje (mismo autor, frase y parámetros), o -1. */
int FindQueued(int author, const char[] key, const char[][] param, int p)
{
	for (int n = 0; n < g_iCount; n++)
	{
		if (g_iAuthor[n] != author || g_iParams[n] != p || !StrEqual(g_sKey[n], key))
			continue;
		bool same = true;
		for (int i = 0; i < p && same; i++)
			same = StrEqual(g_sParam[n][i], param[i]);
		if (same)
			return n;
	}
	return -1;
}

/** Quién debería leer el mensaje n según las reglas. */
bool ShouldRead(int n, int client)
{
	if (ChatKind(g_sKey[n]) == 1)
		return true;
	int team = GetClientTeam(client);
	int author = g_iAuthor[n];
	int from = IsClientInGame(author) ? GetClientTeam(author) : TEAM_SPEC;
	if (from == TEAM_T || from == TEAM_CT)
		return team == from;    // equipo de CT o T: solo ese equipo, vivos y muertos (no los espectadores)
	return team <= TEAM_SPEC;   // equipo de un espectador: solo los espectadores
}

public void Frame_Flush(any data)
{
	g_bFlushPending = false;
	int count = g_iCount;
	g_iCount = 0;
	for (int n = 0; n < count; n++)
	{
		int to[MAXPLAYERS];
		int total;
		for (int i = 1; i <= MaxClients; i++)
		{
			if (g_bGot[n][i] || !IsClientInGame(i) || !ShouldRead(n, i))
				continue;
#if defined ALLCHAT_DEBUG
			LogMessage("[allchat] %s de %N: reenvío a %N%s", g_sKey[n], g_iAuthor[n], i, IsFakeClient(i) ? " (bot: no se envía)" : "");
#endif
			if (!IsFakeClient(i))
				to[total++] = i;
		}
		if (!total)
			continue;
		BfWrite bf = view_as<BfWrite>(StartMessage("SayText2", to, total, USERMSG_RELIABLE | USERMSG_BLOCKHOOKS));
		if (bf == null)
			continue;
		bf.WriteByte(g_iAuthor[n]);
		bf.WriteByte(g_bChat[n]);
		bf.WriteString(g_sKey[n]);
		for (int p = 0; p < g_iParams[n]; p++)
			bf.WriteString(g_sParam[n][p]);
		EndMessage();
	}
}

#if defined ALLCHAT_DEBUG
public Action Cmd_DebugSay(int client, int args)
{
	if (args < 3)
	{
		ReplyToCommand(client, "Uso: csstv_allchat_say <userid> <say|say_team> <texto>");
		return Plugin_Handled;
	}
	char arg[16], cmd[16], text[192];
	GetCmdArg(1, arg, sizeof(arg));
	GetCmdArg(2, cmd, sizeof(cmd));
	GetCmdArg(3, text, sizeof(text));
	int target = GetClientOfUserId(StringToInt(arg));
	if (!target || !IsClientInGame(target) || (!StrEqual(cmd, "say") && !StrEqual(cmd, "say_team")))
	{
		ReplyToCommand(client, "userid o comando inválido");
		return Plugin_Handled;
	}
	FakeClientCommandEx(target, "%s \"%s\"", cmd, text);
	return Plugin_Handled;
}
#endif
