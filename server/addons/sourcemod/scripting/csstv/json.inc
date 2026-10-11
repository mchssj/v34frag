/**
 * Armado del JSON del resultado (SourceMod 1.8 no trae JSON nativo).
 * Los textos se escapan y los bytes que no son UTF-8 válido se reemplazan por '?',
 * porque un nick mal codificado haría que Supabase rechace todo el JSON.
 */

#if defined _csstv_json_included
	#endinput
#endif
#define _csstv_json_included

#define JSON_MAX 65536

char g_sJson[JSON_MAX];
int g_iJsonLen;

void J_Reset()
{
	g_sJson[0] = '\0';
	g_iJsonLen = 0;
}

void J_Raw(const char[] s)
{
	if (g_iJsonLen < JSON_MAX - 1)
		g_iJsonLen += strcopy(g_sJson[g_iJsonLen], JSON_MAX - g_iJsonLen, s);
}

void J_Char(int c)
{
	if (g_iJsonLen < JSON_MAX - 1)
	{
		g_sJson[g_iJsonLen++] = c;
		g_sJson[g_iJsonLen] = '\0';
	}
}

void J_Int(int value)
{
	char buf[16];
	IntToString(value, buf, sizeof(buf));
	J_Raw(buf);
}

/** Agrega un string JSON entre comillas, escapado. */
void J_Str(const char[] s)
{
	J_Char('"');
	int len = strlen(s);
	int i = 0;
	while (i < len)
	{
		int c = s[i] & 0xFF;
		if (c < 0x80)
		{
			if (c == '"' || c == '\\')
			{
				J_Char('\\');
				J_Char(c);
			}
			else if (c < 0x20)
			{
				char esc[8];
				Format(esc, sizeof(esc), "\\u%04x", c);
				J_Raw(esc);
			}
			else
			{
				J_Char(c);
			}
			i++;
			continue;
		}
		int n = 0;
		if (c >= 0xC2 && c <= 0xDF) n = 2;
		else if (c >= 0xE0 && c <= 0xEF) n = 3;
		else if (c >= 0xF0 && c <= 0xF4) n = 4;
		bool valid = n > 0 && i + n <= len;
		for (int k = 1; valid && k < n; k++)
		{
			int cc = s[i + k] & 0xFF;
			if (cc < 0x80 || cc > 0xBF)
				valid = false;
		}
		if (valid)
		{
			for (int k = 0; k < n; k++)
				J_Char(s[i + k] & 0xFF);
			i += n;
		}
		else
		{
			J_Char('?');
			i++;
		}
	}
	J_Char('"');
}

void J_KeyInt(const char[] key, int value, bool comma = true)
{
	if (comma) J_Char(',');
	J_Str(key);
	J_Char(':');
	J_Int(value);
}

void J_KeyStr(const char[] key, const char[] value, bool comma = true)
{
	if (comma) J_Char(',');
	J_Str(key);
	J_Char(':');
	J_Str(value);
}

void Json_BuildPayload(int endedAt)
{
	char map[64], tag[24];
	GetCurrentMap(map, sizeof(map));
	g_cvServerTag.GetString(tag, sizeof(tag));
	SanitizeId(tag);

	J_Reset();
	J_Char('{');
	J_KeyInt("schema", 1, false);
	J_KeyStr("plugin_version", PLUGIN_VERSION);
	J_KeyStr("server_tag", tag);
	J_KeyStr("match_uid", g_sMatchUid);
	J_KeyStr("map", map);
	J_KeyInt("started_at", g_iStartedAt);
	J_KeyInt("ended_at", endedAt);
	J_KeyInt("max_rounds", g_cvMaxRounds.IntValue);
	J_KeyInt("overtimes", g_iSegment);

	J_Raw(",\"score\":{");
	J_KeyInt("a", g_iTotA, false);
	J_KeyInt("b", g_iTotB);
	J_Char('}');

	J_Raw(",\"winner\":");
	if (g_iTotA > g_iTotB) J_Str("a");
	else if (g_iTotB > g_iTotA) J_Str("b");
	else J_Raw("null");

	J_Raw(",\"rounds\":[");
	for (int r = 0; r < g_iRoundLogCount; r++)
	{
		if (r) J_Char(',');
		J_Char('{');
		J_KeyInt("n", r + 1, false);
		J_KeyStr("winner", g_iRoundLogWinner[r] == 1 ? "a" : "b");
		J_KeyStr("a_side", g_iRoundLogSideA[r] == TEAM_CT ? "CT" : "T");
		J_KeyInt("reason", g_iRoundLogReason[r]);
		J_Char('}');
	}
	J_Char(']');

	J_Raw(",\"players\":[");
	bool first = true;
	for (int p = 0; p < g_iRecCount; p++)
	{
		if (g_Stats[p][ST_ROUNDS] == 0)
			continue; // no llegó a jugar una ronda completa
		if (!first) J_Char(',');
		first = false;
		J_Char('{');
		J_KeyStr("steamid", g_RecSteam[p], false);
		J_KeyStr("name", g_RecName[p]);
		J_KeyStr("team", g_Stats[p][ST_ROUNDS_A] >= g_Stats[p][ST_ROUNDS_B] ? "a" : "b");
		J_KeyInt("rounds", g_Stats[p][ST_ROUNDS]);
		J_KeyInt("kills", g_Stats[p][ST_KILLS]);
		J_KeyInt("deaths", g_Stats[p][ST_DEATHS]);
		J_KeyInt("assists", g_Stats[p][ST_ASSISTS]);
		J_KeyInt("headshots", g_Stats[p][ST_HS]);
		J_KeyInt("damage", g_Stats[p][ST_DAMAGE]);
		J_KeyInt("k1", g_Stats[p][ST_K1]);
		J_KeyInt("k2", g_Stats[p][ST_K2]);
		J_KeyInt("k3", g_Stats[p][ST_K3]);
		J_KeyInt("k4", g_Stats[p][ST_K4]);
		J_KeyInt("k5", g_Stats[p][ST_K5]);
		J_KeyInt("first_kills", g_Stats[p][ST_FK]);
		J_KeyInt("first_deaths", g_Stats[p][ST_FD]);
		J_KeyInt("plants", g_Stats[p][ST_PLANTS]);
		J_KeyInt("defuses", g_Stats[p][ST_DEFUSES]);
		J_KeyInt("teamkills", g_Stats[p][ST_TK]);
		J_KeyInt("suicides", g_Stats[p][ST_SUICIDES]);
		J_Char('}');
	}
	J_Raw("]}");
}
