/**
 * Envío a Supabase con System2.
 *
 * System2 limita el cuerpo de un POST a 2048 bytes, y un mix 5v5 ocupa ~8 KB.
 * Por eso el JSON se codifica en base64 y se manda en partes a la función
 * ingest_server_chunk, que lo reconstruye cuando llega la última parte.
 */

#if defined _csstv_http_included
	#endinput
#endif
#define _csstv_http_included

#define CHUNK_CHARS 1400
#define B64_MAX 90000

char g_sB64[B64_MAX];
int g_iB64Len;
char g_sSendingUid[64];
int g_iSendPart;
int g_iSendTotal;
bool g_bSending;
int g_iBackoff;
Handle g_hProcessTimer;
char g_sLastError[256];

bool Http_Available()
{
	return GetFeatureStatus(FeatureType_Native, "System2HTTPRequest.System2HTTPRequest") == FeatureStatus_Available;
}

void Http_ModeText(char[] text, int maxlen)
{
	if (!g_cvSend.BoolValue)
		strcopy(text, maxlen, "desactivado (csstv_send 0, usar csstv_uploader.py)");
	else if (!Http_Available())
		strcopy(text, maxlen, "System2 no disponible (usar csstv_uploader.py)");
	else if (!Http_Configured())
		strcopy(text, maxlen, "falta configurar csstv_api_url, csstv_api_key o csstv_server_token");
	else
		strcopy(text, maxlen, "System2");
}

bool Http_Configured()
{
	char a[8], b[8], c[8];
	g_cvApiUrl.GetString(a, sizeof(a));
	g_cvApiKey.GetString(b, sizeof(b));
	g_cvToken.GetString(c, sizeof(c));
	return a[0] && b[0] && c[0];
}

void Http_ResetBackoff()
{
	g_iBackoff = 0;
}

void Http_ScheduleProcess(float delay)
{
	if (g_hProcessTimer != null)
		KillTimer(g_hProcessTimer);
	g_hProcessTimer = CreateTimer(delay, Timer_Process);
}

public Action Timer_Process(Handle timer)
{
	g_hProcessTimer = null;
	Http_ProcessQueue();
	return Plugin_Stop;
}

void Http_ScheduleRetry()
{
	int wait = g_cvRetrySeconds.IntValue;
	for (int i = 0; i < g_iBackoff && wait < 900; i++)
		wait *= 2;
	if (wait > 900)
		wait = 900;
	g_iBackoff++;
	Http_ScheduleProcess(float(wait));
}

void Http_ProcessQueue()
{
	if (g_bSending || !g_cvEnabled.BoolValue || !g_cvSend.BoolValue || !Http_Available() || !Http_Configured() || !License_Allows())
		return;
	char uid[64];
	if (!Queue_Next(uid, sizeof(uid)))
		return;
	if (!Queue_Load(uid))
	{
		Format(g_sLastError, sizeof(g_sLastError), "No se pudo leer %s.json; se mueve a failed/.", uid);
		LogError("%s", g_sLastError);
		Queue_Move(uid, true);
		Http_ScheduleProcess(1.0);
		return;
	}
	g_iB64Len = Base64Encode(g_sJson, g_iJsonLen, g_sB64, B64_MAX);
	strcopy(g_sSendingUid, sizeof(g_sSendingUid), uid);
	g_iSendTotal = (g_iB64Len + CHUNK_CHARS - 1) / CHUNK_CHARS;
	g_iSendPart = 1;
	g_bSending = true;
	Http_SendPart();
}

void Http_SendPart()
{
	char url[256], key[512], token[128], chunk[CHUNK_CHARS + 1], body[2047];
	g_cvApiUrl.GetString(url, sizeof(url));
	g_cvApiKey.GetString(key, sizeof(key));
	g_cvToken.GetString(token, sizeof(token));
	SanitizeId(token);

	strcopy(chunk, sizeof(chunk), g_sB64[(g_iSendPart - 1) * CHUNK_CHARS]);
	Format(body, sizeof(body), "{\"p_token\":\"%s\",\"p_uid\":\"%s\",\"p_part\":%d,\"p_total\":%d,\"p_data\":\"%s\"}",
		token, g_sSendingUid, g_iSendPart, g_iSendTotal, chunk);

	System2HTTPRequest req = new System2HTTPRequest(Http_OnResponse, "%s", url);
	req.SetHeader("apikey", "%s", key);
	req.SetHeader("Authorization", "Bearer %s", key);
	req.SetHeader("Content-Type", "application/json");
	req.SetHeader("Prefer", "return=representation");
	req.SetUserAgent("CSSTV-Reporter/%s", PLUGIN_VERSION);
	req.SetData("%s", body);
	req.Timeout = 30;
	req.POST();
	delete req;
}

public void Http_OnResponse(bool success, const char[] error, System2HTTPRequest request, System2HTTPResponse response, HTTPRequestMethod method)
{
	int status = success && response != null ? response.StatusCode : 0;

	if (status >= 200 && status < 300)
	{
		if (g_iSendPart < g_iSendTotal)
		{
			g_iSendPart++;
			Http_SendPart();
			return;
		}
		char content[128];
		response.GetContent(content, sizeof(content));
		StripQuotes(content);
		LogMessage("Resultado %s enviado (%d partes). Partida en la web: %s", g_sSendingUid, g_iSendTotal, content);
		PrintToChatAll("%s Resultado enviado a CSSTV.", PREFIX);
		Queue_Move(g_sSendingUid, false);
		g_sLastError[0] = '\0';
		g_bSending = false;
		Http_ResetBackoff();
		Http_ScheduleProcess(1.0);
		return;
	}

	char detail[192];
	if (status == 0)
		strcopy(detail, sizeof(detail), error);
	else if (response != null)
		response.GetContent(detail, sizeof(detail));

	g_bSending = false;
	if (status >= 400 && status < 500 && status != 408 && status != 429)
	{
		Format(g_sLastError, sizeof(g_sLastError), "HTTP %d en %s (parte %d/%d): %s. Archivo movido a failed/.", status, g_sSendingUid, g_iSendPart, g_iSendTotal, detail);
		LogError("%s", g_sLastError);
		Queue_Move(g_sSendingUid, true);
		Http_ScheduleProcess(1.0);
	}
	else
	{
		Format(g_sLastError, sizeof(g_sLastError), "Error transitorio (%d) en %s: %s. Se reintenta.", status, g_sSendingUid, detail);
		LogError("%s", g_sLastError);
		Http_ScheduleRetry();
	}
}

int Base64Encode(const char[] src, int len, char[] dst, int maxlen)
{
	static const char table[] = "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
	int o = 0;
	for (int i = 0; i < len && o + 4 < maxlen; i += 3)
	{
		int b0 = src[i] & 0xFF;
		int b1 = i + 1 < len ? (src[i + 1] & 0xFF) : 0;
		int b2 = i + 2 < len ? (src[i + 2] & 0xFF) : 0;
		dst[o++] = table[b0 >> 2];
		dst[o++] = table[((b0 & 0x03) << 4) | (b1 >> 4)];
		int c2 = '=', c3 = '=';
		if (i + 1 < len) c2 = table[((b1 & 0x0F) << 2) | (b2 >> 6)];
		if (i + 2 < len) c3 = table[b2 & 0x3F];
		dst[o++] = c2;
		dst[o++] = c3;
	}
	dst[o] = '\0';
	return o;
}
