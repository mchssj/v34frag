/**
 * Mensajes con color. Las etiquetas ({#verde}, {#rojo}…) se convierten al enviar, como en
 * csstv_reporter: ClientMod acepta RGB (\x07RRGGBB) en SayText2 y el cliente original de v34 no, así
 * que ahí {#verde} es el verde básico y las demás, el color normal.
 */

#if defined _retake_chat_included
	#endinput
#endif
#define _retake_chat_included

native int CM_GetClientModAuth(int client);   // clientmod.inc: 2 = ClientMod, 3 = ClientMod desactualizado

static const char g_sColorTag[][] = { "{#blanco}", "{#verde}", "{#rojo}", "{#amarillo}", "{#ct}", "{#t}" };
static const char g_sColorRgb[][] = { "\x07FFFFFF", "\x073EFF3E", "\x07FF4040", "\x07FFD700", "\x0799CCFF", "\x07EAB93D" };
static const char g_sColorBasic[][] = { "\x01", "\x04", "\x01", "\x01", "\x01", "\x01" };

public APLRes AskPluginLoad2(Handle myself, bool late, char[] error, int err_max)
{
	MarkNativeAsOptional("CM_GetClientModAuth");
	return APLRes_Success;
}

bool Chat_UsesRgb(int client)
{
	if (GetFeatureStatus(FeatureType_Native, "CM_GetClientModAuth") != FeatureStatus_Available)
		return false;
	return CM_GetClientModAuth(client) >= 2;
}

void Chat_ApplyTags(char[] text, int len, bool rgb)
{
	for (int i = 0; i < sizeof(g_sColorTag); i++)
		ReplaceString(text, len, g_sColorTag[i], rgb ? g_sColorRgb[i] : g_sColorBasic[i], false);
}

void Chat_Send(int client, const char[] text)
{
	if (IsFakeClient(client))
		return;
	char buf[256], msg[256];
	strcopy(buf, sizeof(buf), text);
	Handle um = Chat_UsesRgb(client) ? StartMessageOne("SayText2", client, USERMSG_RELIABLE | USERMSG_BLOCKHOOKS) : null;
	if (um == null)
	{
		Chat_ApplyTags(buf, sizeof(buf), false);
		PrintToChat(client, "%s", buf);
		return;
	}
	Chat_ApplyTags(buf, sizeof(buf), true);
	Format(msg, sizeof(msg), "\x01%s", buf);   // SayText2 necesita empezar con \x01 para mostrar colores
	BfWriteByte(um, client);
	BfWriteByte(um, true);
	BfWriteString(um, msg);
	EndMessage();
}

void Chat(int client, const char[] fmt, any ...)
{
	char buf[256];
	SetGlobalTransTarget(client);
	VFormat(buf, sizeof(buf), fmt, 3);
	Chat_Send(client, buf);
}

void ChatAll(const char[] fmt, any ...)
{
	char buf[256];
	SetGlobalTransTarget(LANG_SERVER);
	VFormat(buf, sizeof(buf), fmt, 2);
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i))
			Chat_Send(i, buf);
}
