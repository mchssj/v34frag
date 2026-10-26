/**
 * CSSTV Password
 *
 * Contraseña del servidor desde el chat para admins y moderadores (plan docs/bitacora/2026-10-25-plugin-password):
 *   - !pw <contraseña>: la pone (las comillas son opcionales); !pw sin texto dice si hay y quién la puso;
 *   - !npw: la saca;
 *   - !rpw: pone una aleatoria de 6 caracteres sin los que se confunden.
 *
 * Solo quien la puso ve el valor (se lo reconoce por SteamID, aunque se reconecte); los demás ven "X le puso
 * contraseña al servidor". El chat de "!pw abc" no se muestra: OnClientSayCommand lo atrapa antes, para que la
 * contraseña no salga en el chat de todos.
 *
 * El server.cfg se ejecuta en cada mapa y trae su propio sv_password: el plugin vuelve a aplicar lo suyo en
 * OnConfigsExecuted. Si sv_password cambia por fuera (rcon, panel) fuera de la carga del mapa, el plugin deja
 * de tocarla y manda el server.cfg. Un reinicio vuelve a la del server.cfg.
 *
 * Acceso: flag b (moderadores y admins), con override de sm_pw, sm_npw y sm_rpw. Independiente de
 * csstv_reporter. Sin licencia.
 * Compilación de depuración (PW_DEBUG=): escribe en el log los mensajes, reconoce a los bots por nombre y
 * agrega comandos para que un bot use el plugin.
 */
#pragma semicolon 1
#pragma newdecls required

#include <sourcemod>

#define PLUGIN_VERSION "1.0.0"
#define PW_MAX         32
#define RANDOM_LEN     6

public Plugin myinfo =
{
	name = "CSSTV Password",
	author = "CMLeague",
	description = "!pw, !npw y !rpw: contraseña del servidor para admins y moderadores",
	version = PLUGIN_VERSION,
	url = ""
};

enum PwState
{
	Pw_Untouched = 0,   // manda el server.cfg
	Pw_Set,             // la puso alguien con !pw o !rpw
	Pw_Cleared          // la sacó alguien con !npw
};

// Sin 0, o, 1, l ni i.
static const char g_sRandomChars[] = "abcdefghjkmnpqrstuvwxyz23456789";

ConVar g_cvEnabled;
ConVar g_cvPassword;
PwState g_State = Pw_Untouched;
char g_sPassword[PW_MAX + 1];
char g_sSetterKey[64];
char g_sSetterName[MAX_NAME_LENGTH];
bool g_bApplying;      // el cambio de sv_password es del plugin
bool g_bMapLoading;    // entre el fin del mapa y OnConfigsExecuted: el server.cfg cambia sv_password
int g_iSayTick[MAXPLAYERS + 1] = { -1, ... };   // tick en que OnClientSayCommand ya resolvió un !pw

public APLRes AskPluginLoad2(Handle myself, bool late, char[] error, int err_max)
{
	MarkNativeAsOptional("CM_GetClientModAuth");
	return APLRes_Success;
}

public void OnPluginStart()
{
	CreateConVar("csstv_pw_version", PLUGIN_VERSION, "Versión de CSSTV Password.", FCVAR_NOTIFY | FCVAR_DONTRECORD);
	g_cvEnabled = CreateConVar("csstv_pw_enabled", "1", "Activa !pw, !npw y !rpw (y que la contraseña se mantenga entre mapas).", _, true, 0.0, true, 1.0);
	AutoExecConfig(true, "csstv_password");

	g_cvPassword = FindConVar("sv_password");
	if (g_cvPassword == null)
		SetFailState("No existe sv_password");
	g_cvPassword.AddChangeHook(OnPasswordChanged);

	RegConsoleCmd("sm_pw", Cmd_Pw, "!pw <contraseña>: pone la contraseña del servidor. Sin texto dice si hay.");
	RegConsoleCmd("sm_npw", Cmd_Npw, "!npw: saca la contraseña del servidor.");
	RegConsoleCmd("sm_rpw", Cmd_Rpw, "!rpw: pone una contraseña aleatoria.");
#if defined PW_DEBUG
	RegAdminCmd("csstv_pw_fakecmd", Cmd_DebugFake, ADMFLAG_ROOT, "csstv_pw_fakecmd <userid> <comando>: un bot ejecuta un comando (solo depuración).");
	RegAdminCmd("csstv_pw_setadmin", Cmd_DebugSetAdmin, ADMFLAG_ROOT, "csstv_pw_setadmin <userid> <grupo|root|none>: permisos de un bot (solo depuración).");
	RegAdminCmd("csstv_pw_state", Cmd_DebugState, ADMFLAG_ROOT, "csstv_pw_state: estado del plugin y sv_password (solo depuración).");
#endif
}

public void OnMapEnd()
{
	g_bMapLoading = true;
}

public void OnConfigsExecuted()
{
	g_bMapLoading = false;
	if (!g_cvEnabled.BoolValue)
		return;
	if (g_State == Pw_Set)
		ApplyPassword(g_sPassword);
	else if (g_State == Pw_Cleared)
		ApplyPassword("");
}

public void OnPasswordChanged(ConVar convar, const char[] oldValue, const char[] newValue)
{
	if (g_bApplying || g_bMapLoading || g_State == Pw_Untouched)
		return;
	// Alguien la cambió por fuera (rcon o el panel): el plugin deja de tocarla.
	g_State = Pw_Untouched;
	LogMessage("sv_password cambió por fuera del plugin: vuelve a mandar el server.cfg");
}

void ApplyPassword(const char[] pw)
{
	g_bApplying = true;
	g_cvPassword.SetString(pw);
	g_bApplying = false;
}

// ---------------------------------------------------------------------------
// Comandos
// ---------------------------------------------------------------------------

public Action Cmd_Pw(int client, int args)
{
	if (FromHandledSay(client))
		return Plugin_Handled;
	char arg[256];
	GetCmdArgString(arg, sizeof(arg));
	DoPw(client, arg);
	return Plugin_Handled;
}

public Action Cmd_Npw(int client, int args)
{
	if (FromHandledSay(client))
		return Plugin_Handled;
	DoNpw(client);
	return Plugin_Handled;
}

public Action Cmd_Rpw(int client, int args)
{
	if (FromHandledSay(client))
		return Plugin_Handled;
	DoRpw(client);
	return Plugin_Handled;
}

/**
 * SourceMod 1.10 ejecuta el trigger público ("!pw") en su hook post aunque OnClientSayCommand devuelva
 * Plugin_Stop. Como el forward ya lo resolvió, se ignora esa segunda llamada (viene del chat en el mismo tick).
 */
bool FromHandledSay(int client)
{
	return client > 0 && GetCmdReplySource() == SM_REPLY_TO_CHAT && g_iSayTick[client] == GetGameTickCount();
}

/**
 * "!pw abc" en el chat: SourceMod mostraría el mensaje a todos y después ejecutaría sm_pw. Este forward llega
 * antes que el trigger de chat: con Plugin_Stop no se muestra el mensaje. El trigger igual llega a sm_pw y ahí
 * se ignora (FromHandledSay). "/pw" ya es silencioso, pero pasa por acá igual. Sin acceso no se corta: lo
 * maneja SourceMod como cualquier comando.
 */
public Action OnClientSayCommand(int client, const char[] command, const char[] sArgs)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Continue;
	char text[256];
	strcopy(text, sizeof(text), sArgs);
	StripQuotes(text);
	TrimString(text);
	if (text[0] != '!' && text[0] != '/')
		return Plugin_Continue;

	char word[8];
	int rest = BreakString(text[1], word, sizeof(word));
	int which;
	if (StrEqual(word, "pw", false))
		which = 1;
	else if (StrEqual(word, "npw", false))
		which = 2;
	else if (StrEqual(word, "rpw", false))
		which = 3;
	else
		return Plugin_Continue;
	if (!CanUse(client, which))
		return Plugin_Continue;
	g_iSayTick[client] = GetGameTickCount();

	if (which == 1 && rest == -1)
		DoPw(client, "");
	else if (which == 1)
		DoPw(client, text[1 + rest]);
	else if (which == 2)
		DoNpw(client);
	else
		DoRpw(client);
	return Plugin_Stop;
}

bool CanUse(int client, int which)
{
	static const char cmds[][] = { "", "sm_pw", "sm_npw", "sm_rpw" };
	return HasAccess(client, cmds[which], ADMFLAG_GENERIC);
}

bool CheckUse(int client, int which)
{
	if (!CanUse(client, which))
	{
		Reply(client, "No tienes acceso a este comando.");
		return false;
	}
	if (!g_cvEnabled.BoolValue)
	{
		Reply(client, "Los comandos de contraseña están desactivados.");
		return false;
	}
	return true;
}

void DoPw(int client, const char[] argIn)
{
	if (!CheckUse(client, 1))
		return;
	char arg[256];
	strcopy(arg, sizeof(arg), argIn);
	TrimString(arg);
	StripQuotes(arg);
	TrimString(arg);
	if (!arg[0])
	{
		ShowCurrent(client);
		return;
	}
	if (!IsValidPassword(arg))
	{
		Reply(client, "Contraseña inválida: de 1 a %d caracteres, solo letras, números, {#amarillo}- _ .{#normal} y sin espacios.", PW_MAX);
		return;
	}
	SetPassword(client, arg);
}

void DoRpw(int client)
{
	if (!CheckUse(client, 3))
		return;
	char pw[RANDOM_LEN + 1];
	int n = strlen(g_sRandomChars);
	for (int i = 0; i < RANDOM_LEN; i++)
		pw[i] = g_sRandomChars[GetURandomInt() % n];
	pw[RANDOM_LEN] = '\0';
	SetPassword(client, pw);
}

void DoNpw(int client)
{
	if (!CheckUse(client, 2))
		return;
	char current[PW_MAX + 1];
	g_cvPassword.GetString(current, sizeof(current));
	g_State = Pw_Cleared;
	g_sPassword[0] = '\0';
	g_sSetterKey[0] = '\0';
	g_sSetterName[0] = '\0';
	ApplyPassword("");
	if (!current[0])
	{
		Reply(client, "El servidor ya no tenía contraseña. Queda sin contraseña también en los próximos mapas.");
		return;
	}
	char name[MAX_NAME_LENGTH];
	ActorName(client, name, sizeof(name));
	ChatAllExcept(client, "{#amarillo}%s{#normal} le sacó la contraseña al servidor.", name);
	Reply(client, "Le sacaste la contraseña al servidor.");
	LogAction(client, -1, "\"%L\" le sacó la contraseña al servidor", client);
}

void SetPassword(int client, const char[] pw)
{
	strcopy(g_sPassword, sizeof(g_sPassword), pw);
	ClientKey(client, g_sSetterKey, sizeof(g_sSetterKey));
	ActorName(client, g_sSetterName, sizeof(g_sSetterName));
	g_State = Pw_Set;
	ApplyPassword(pw);
	ChatAllExcept(client, "{#amarillo}%s{#normal} le puso contraseña al servidor.", g_sSetterName);
	Reply(client, "Contraseña puesta: {#verde}%s{#normal}. Solo la ves tú: compártela si quieres.", pw);
	LogAction(client, -1, "\"%L\" le puso contraseña al servidor", client);
}

void ShowCurrent(int client)
{
	char current[PW_MAX + 1];
	g_cvPassword.GetString(current, sizeof(current));
	if (!current[0])
	{
		Reply(client, "El servidor no tiene contraseña.");
		return;
	}
	if (g_State != Pw_Set)
	{
		Reply(client, "El servidor tiene la contraseña de siempre (la del server.cfg).");
		return;
	}
	char key[64];
	ClientKey(client, key, sizeof(key));
	if (StrEqual(key, g_sSetterKey))
		Reply(client, "La contraseña es {#verde}%s{#normal} (la pusiste tú).", g_sPassword);
	else
		Reply(client, "El servidor tiene contraseña: la puso {#amarillo}%s{#normal}.", g_sSetterName);
}

bool IsValidPassword(const char[] pw)
{
	int len = strlen(pw);
	if (len < 1 || len > PW_MAX)
		return false;
	for (int i = 0; i < len; i++)
	{
		int c = pw[i];
		if (!IsCharAlpha(c) && !IsCharNumeric(c) && c != '-' && c != '_' && c != '.')
			return false;
		if (c < 33 || c > 126)   // sin tildes ni ñ: IsCharAlpha las acepta
			return false;
	}
	return true;
}

/** Quién la puso: SteamID (sigue valiendo si se reconecta). En la build de depuración, el bot por su nombre. */
void ClientKey(int client, char[] key, int len)
{
	if (client == 0)
	{
		strcopy(key, len, "CONSOLE");
		return;
	}
#if defined PW_DEBUG
	if (IsFakeClient(client))
	{
		Format(key, len, "BOT:%N", client);
		return;
	}
#endif
	if (!GetClientAuthId(client, AuthId_Steam2, key, len))
		Format(key, len, "USERID:%d", GetClientUserId(client));
}

void ActorName(int client, char[] name, int len)
{
	if (client == 0)
		strcopy(name, len, "La consola");
	else
		GetClientName(client, name, len);
}

/**
 * CheckCommandAccess. En la build de depuración, a un bot se le revisa su AdminId con CheckAccess, porque
 * CheckCommandAccess nunca le da acceso a un bot.
 */
bool HasAccess(int client, const char[] cmd, int flags)
{
	if (client == 0)
		return true;
#if defined PW_DEBUG
	if (IsFakeClient(client))
		return CheckAccess(GetUserAdmin(client), cmd, flags);
#endif
	return CheckCommandAccess(client, cmd, flags);
}

// ---------------------------------------------------------------------------
// Chat (mismos colores y prefijo que csstv_reporter, si está cargado)
// ---------------------------------------------------------------------------

native int CM_GetClientModAuth(int client);   // clientmod.inc: 2 = ClientMod, 3 = ClientMod desactualizado

static const char g_sColorTag[][] = { "{#normal}", "{#verde}", "{#rojo}", "{#amarillo}" };
static const char g_sColorRgb[][] = { "\x01", "\x073EFF3E", "\x07FF4040", "\x07FFD700" };
static const char g_sColorBasic[][] = { "\x01", "\x04", "\x01", "\x01" };

bool ChatUsesRgb(int client)
{
	ConVar cv = FindConVar("csstv_chat_colors");
	int mode = cv == null ? 1 : cv.IntValue;
	if (mode == 0)
		return false;
	if (mode == 2)
		return true;
	if (GetFeatureStatus(FeatureType_Native, "CM_GetClientModAuth") != FeatureStatus_Available)
		return false;
	return CM_GetClientModAuth(client) >= 2;
}

void ApplyColorTags(char[] text, int len, bool rgb, bool strip = false)
{
	for (int i = 0; i < sizeof(g_sColorTag); i++)
		ReplaceString(text, len, g_sColorTag[i], strip ? "" : (rgb ? g_sColorRgb[i] : g_sColorBasic[i]), false);
}

/** Respuesta a quien usó el comando: en el chat, o en la consola del servidor si fue la consola. */
void Reply(int client, const char[] fmt, any ...)
{
	char text[224];
	VFormat(text, sizeof(text), fmt, 3);
	if (client == 0)
	{
		ApplyColorTags(text, sizeof(text), false, true);
		PrintToServer("[csstv_password] %s", text);
		return;
	}
	Chat(client, "%s", text);
}

void ChatAllExcept(int except, const char[] fmt, any ...)
{
	char text[224];
	VFormat(text, sizeof(text), fmt, 3);
	for (int i = 1; i <= MaxClients; i++)
	{
		if (i != except && IsClientInGame(i))
			Chat(i, "%s", text);
	}
}

/** Mensaje de chat solo para el jugador, con el prefijo [CMLeague] y etiquetas de color según su cliente. */
void Chat(int client, const char[] fmt, any ...)
{
	char tag[32], text[224], buf[256];
	ConVar cv = FindConVar("csstv_chat_tag");
	if (cv != null)
		cv.GetString(tag, sizeof(tag));
	SetGlobalTransTarget(client);
	VFormat(text, sizeof(text), fmt, 3);
	Format(buf, sizeof(buf), "[%s] %s", tag[0] ? tag : "CMLeague", text);
#if defined PW_DEBUG
	char plain[256];
	strcopy(plain, sizeof(plain), buf);
	ApplyColorTags(plain, sizeof(plain), false, true);
	LogMessage("[respuesta a %N] %s", client, plain);
#endif
	if (IsFakeClient(client))
		return;
	if (!ChatUsesRgb(client))
	{
		ApplyColorTags(buf, sizeof(buf), false);
		PrintToChat(client, "%s", buf);
		return;
	}
	ApplyColorTags(buf, sizeof(buf), true);
	char msg[256];
	Format(msg, sizeof(msg), "\x01%s", buf);   // SayText2 necesita empezar con \x01 para mostrar colores
	Handle um = StartMessageOne("SayText2", client, USERMSG_RELIABLE | USERMSG_BLOCKHOOKS);
	if (um == null)
	{
		ApplyColorTags(buf, sizeof(buf), false);
		PrintToChat(client, "%s", buf);
		return;
	}
	BfWriteByte(um, client);   // autor
	BfWriteByte(um, true);     // mensaje de chat
	BfWriteString(um, msg);
	EndMessage();
}

// ---------------------------------------------------------------------------
// Depuración
// ---------------------------------------------------------------------------

#if defined PW_DEBUG
int DebugTarget(int client, int arg)
{
	char buf[16];
	GetCmdArg(arg, buf, sizeof(buf));
	int target = GetClientOfUserId(StringToInt(buf));
	if (!target || !IsClientInGame(target))
	{
		ReplyToCommand(client, "userid inválido");
		return 0;
	}
	return target;
}

public Action Cmd_DebugFake(int client, int args)
{
	if (args < 2)
	{
		ReplyToCommand(client, "Uso: csstv_pw_fakecmd <userid> <comando>");
		return Plugin_Handled;
	}
	int target = DebugTarget(client, 1);
	if (!target)
		return Plugin_Handled;
	char arg[16], full[256];
	GetCmdArg(1, arg, sizeof(arg));
	GetCmdArgString(full, sizeof(full));
	FakeClientCommandEx(target, "%s", full[strlen(arg) + 1]);
	return Plugin_Handled;
}

/** Permisos de un bot: un admin temporal con ese grupo (o root), o ninguno. */
public Action Cmd_DebugSetAdmin(int client, int args)
{
	int target = DebugTarget(client, 1);
	if (!target)
		return Plugin_Handled;
	char what[32];
	GetCmdArg(2, what, sizeof(what));
	AdminId old = GetUserAdmin(target);
	if (old != INVALID_ADMIN_ID)
	{
		SetUserAdmin(target, INVALID_ADMIN_ID);
		RemoveAdmin(old);
	}
	if (StrEqual(what, "none"))
	{
		ReplyToCommand(client, "%N sin permisos", target);
		return Plugin_Handled;
	}
	AdminId admin = CreateAdmin("pw_debug");
	if (StrEqual(what, "root"))
		admin.SetFlag(Admin_Root, true);
	else
	{
		GroupId group = FindAdmGroup(what);
		if (group == INVALID_GROUP_ID)
		{
			RemoveAdmin(admin);
			ReplyToCommand(client, "No existe el grupo %s", what);
			return Plugin_Handled;
		}
		admin.InheritGroup(group);
	}
	SetUserAdmin(target, admin, true);
	ReplyToCommand(client, "%N ahora es %s (flags %d)", target, what, GetUserFlagBits(target));
	return Plugin_Handled;
}

public Action Cmd_DebugState(int client, int args)
{
	char current[PW_MAX + 1];
	g_cvPassword.GetString(current, sizeof(current));
	ReplyToCommand(client, "estado=%d sv_password=[%s] guardada=[%s] puso=[%s|%s]", view_as<int>(g_State), current,
		g_sPassword, g_sSetterName, g_sSetterKey);
	return Plugin_Handled;
}
#endif
