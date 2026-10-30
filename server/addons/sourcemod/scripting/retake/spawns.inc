/**
 * Puntos de cada mapa: configs/retake/<mapa>.cfg (KeyValues). Por sitio, el punto de la bomba
 * y los spawns de T y de CT, con posición y hacia dónde mira el jugador.
 * Los comandos de admin guardan el archivo al instante.
 */

#if defined _retake_spawns_included
	#endinput
#endif
#define _retake_spawns_included

#define SITE_A 0
#define SITE_B 1
#define SIDE_T 0
#define SIDE_CT 1
#define POINT_MIN_DIST 64.0     // más cerca que esto, dos jugadores aparecen trabados
#define POINT_DEL_DIST 128.0
#define SHOW_TIME 30.0

ArrayList g_aPoints[2][2];      // [sitio][lado] -> { x, y, z, yaw }
ArrayList g_aBombs[2];          // [sitio] -> { x, y, z, yaw }; cada ronda se usa uno al azar
int g_iBeamSprite, g_iHaloSprite;

void Spawns_Init()
{
	for (int s = 0; s < 2; s++)
	{
		g_aBombs[s] = new ArrayList(4);
		for (int t = 0; t < 2; t++)
			g_aPoints[s][t] = new ArrayList(4);
	}
	RegAdminCmd("sm_retake_spawn", Cmd_Spawn, ADMFLAG_GENERIC, "Guarda un spawn donde estás parado. Uso: sm_retake_spawn <a|b> <t|ct>");
	RegAdminCmd("sm_retake_bomb", Cmd_Bomb, ADMFLAG_GENERIC, "Agrega un punto de bomba al sitio (cada ronda se usa uno al azar). Uso: sm_retake_bomb <a|b>");
	RegAdminCmd("sm_retake_delspawn", Cmd_DelSpawn, ADMFLAG_GENERIC, "Borra el punto más cercano a vos.");
	RegAdminCmd("sm_retake_spawns", Cmd_Spawns, ADMFLAG_GENERIC, "Muestra los puntos del mapa y cuántos hay por sitio y lado.");
}

void Spawns_OnMapStart()
{
	g_iBeamSprite = PrecacheModel("materials/sprites/laser.vmt");
	g_iHaloSprite = PrecacheModel("materials/sprites/halo01.vmt");
	Spawns_Load();
}

void Spawns_Path(const char[] map, char[] path, int maxlen)
{
	BuildPath(Path_SM, path, maxlen, "configs/retake/%s.cfg", map);
}

/** Si un mapa tiene archivo de puntos (para la votación). */
bool Spawns_MapHasFile(const char[] map)
{
	char path[PLATFORM_MAX_PATH];
	Spawns_Path(map, path, sizeof(path));
	return FileExists(path);
}

void Spawns_ReadPoint(KeyValues kv, ArrayList into)
{
	float p[4];
	p[0] = kv.GetFloat("x");
	p[1] = kv.GetFloat("y");
	p[2] = kv.GetFloat("z");
	p[3] = kv.GetFloat("yaw");
	into.PushArray(p);
}

void Spawns_ReadList(KeyValues kv, const char[] key, ArrayList into)
{
	if (!kv.JumpToKey(key))
		return;
	if (kv.GetDataType("x") != KvData_None)   // archivo viejo: un solo punto de bomba
		Spawns_ReadPoint(kv, into);
	else if (kv.GotoFirstSubKey())
	{
		do
		{
			Spawns_ReadPoint(kv, into);
		}
		while (kv.GotoNextKey());
		kv.GoBack();
	}
	kv.GoBack();
}

void Spawns_Load()
{
	for (int s = 0; s < 2; s++)
	{
		g_aBombs[s].Clear();
		g_aPoints[s][SIDE_T].Clear();
		g_aPoints[s][SIDE_CT].Clear();
	}
	char map[PLATFORM_MAX_PATH], path[PLATFORM_MAX_PATH];
	GetCurrentMap(map, sizeof(map));
	Spawns_Path(map, path, sizeof(path));
	KeyValues kv = new KeyValues("retake");
	if (FileExists(path) && kv.ImportFromFile(path))
	{
		for (int s = 0; s < 2; s++)
		{
			if (!kv.JumpToKey(s == SITE_A ? "a" : "b"))
				continue;
			Spawns_ReadList(kv, "bomb", g_aBombs[s]);
			Spawns_ReadList(kv, "t", g_aPoints[s][SIDE_T]);
			Spawns_ReadList(kv, "ct", g_aPoints[s][SIDE_CT]);
			kv.GoBack();
		}
	}
	delete kv;
}

void Spawns_WritePoint(KeyValues kv, const char[] key, const float[] p)
{
	kv.JumpToKey(key, true);
	kv.SetFloat("x", p[0]);
	kv.SetFloat("y", p[1]);
	kv.SetFloat("z", p[2]);
	kv.SetFloat("yaw", p[3]);
	kv.GoBack();
}

bool Spawns_Save()
{
	char map[PLATFORM_MAX_PATH], path[PLATFORM_MAX_PATH], dir[PLATFORM_MAX_PATH], key[8];
	GetCurrentMap(map, sizeof(map));
	Spawns_Path(map, path, sizeof(path));
	BuildPath(Path_SM, dir, sizeof(dir), "configs/retake");
	if (!DirExists(dir))
		CreateDirectory(dir, 511);
	KeyValues kv = new KeyValues("retake");
	for (int s = 0; s < 2; s++)
	{
		kv.JumpToKey(s == SITE_A ? "a" : "b", true);
		for (int list = 0; list < 3; list++)
		{
			ArrayList points = list == 0 ? g_aBombs[s] : g_aPoints[s][list - 1];
			kv.JumpToKey(list == 0 ? "bomb" : (list - 1 == SIDE_T ? "t" : "ct"), true);
			for (int i = 0; i < points.Length; i++)
			{
				float p[4];
				points.GetArray(i, p);
				IntToString(i, key, sizeof(key));
				Spawns_WritePoint(kv, key, p);
			}
			kv.GoBack();
		}
		kv.GoBack();
	}
	kv.Rewind();
	bool ok = kv.ExportToFile(path);
	delete kv;
	if (!ok)
		LogError("No se pudo escribir %s", path);
	return ok;
}

/** Los dos sitios tienen bomba y al menos un punto de cada lado. */
bool Spawns_Ready()
{
	for (int s = 0; s < 2; s++)
		if (g_aBombs[s].Length == 0 || g_aPoints[s][SIDE_T].Length == 0 || g_aPoints[s][SIDE_CT].Length == 0)
			return false;
	return true;
}

bool Spawns_ParseSite(const char[] arg, int &site)
{
	if (StrEqual(arg, "a", false))
		site = SITE_A;
	else if (StrEqual(arg, "b", false))
		site = SITE_B;
	else
		return false;
	return true;
}

/** Un punto del mismo sitio demasiado cerca (bomba incluida). */
bool Spawns_TooClose(int site, const float pos[3])
{
	float other[3];
	for (int list = 0; list < 3; list++)
	{
		ArrayList points = list == 0 ? g_aBombs[site] : g_aPoints[site][list - 1];
		for (int i = 0; i < points.Length; i++)
		{
			float p[4];
			points.GetArray(i, p);
			other[0] = p[0]; other[1] = p[1]; other[2] = p[2];
			if (GetVectorDistance(pos, other) < POINT_MIN_DIST)
				return true;
		}
	}
	return false;
}

bool Spawns_CanEdit(int client)
{
	if (client <= 0 || !IsClientInGame(client) || !IsPlayerAlive(client))
	{
		ReplyToCommand(client, "[Retake] Tenés que estar vivo y parado en el lugar.");
		return false;
	}
	if (!(GetEntityFlags(client) & FL_ONGROUND))
	{
		ReplyToCommand(client, "[Retake] Tenés que estar apoyado en el suelo.");
		return false;
	}
	return true;
}

/** Guarda un spawn en la posición de `client`. Devuelve false y explica si no se pudo. */
bool Spawns_AddFrom(int client, int reply, int site, int side)
{
	float pos[3], ang[3];
	GetClientAbsOrigin(client, pos);
	GetClientEyeAngles(client, ang);
	if (Spawns_TooClose(site, pos))
	{
		ReplyToCommand(reply, "[Retake] Hay otro punto a menos de %.0f unidades.", POINT_MIN_DIST);
		return false;
	}
	float p[4];
	p[0] = pos[0]; p[1] = pos[1]; p[2] = pos[2]; p[3] = ang[1];
	g_aPoints[site][side].PushArray(p);
	if (!Spawns_Save())
	{
		ReplyToCommand(reply, "[Retake] No se pudo guardar el archivo. Mirá el log de errores.");
		return false;
	}
	ReplyToCommand(reply, "[Retake] Spawn %s del sitio %s guardado (%d).", side == SIDE_T ? "T" : "CT", site == SITE_A ? "A" : "B", g_aPoints[site][side].Length);
	return true;
}

/** Si la posición cae dentro de un func_bomb_target. m_bInBombZone no sirve: es solo para quien lleva la C4. */
bool Spawns_InBombZone(const float pos[3])
{
	int ent = -1;
	while ((ent = FindEntityByClassname(ent, "func_bomb_target")) != -1)
	{
		float mins[3], maxs[3];
		GetEntPropVector(ent, Prop_Send, "m_vecMins", mins);
		GetEntPropVector(ent, Prop_Send, "m_vecMaxs", maxs);
		if (pos[0] >= mins[0] && pos[0] <= maxs[0] && pos[1] >= mins[1] && pos[1] <= maxs[1] && pos[2] >= mins[2] - 16.0 && pos[2] <= maxs[2])
			return true;
	}
	return false;
}

bool Spawns_SetBombFrom(int client, int reply, int site)
{
	float pos[3], ang[3];
	GetClientAbsOrigin(client, pos);
	GetClientEyeAngles(client, ang);
	if (!Spawns_InBombZone(pos))
	{
		ReplyToCommand(reply, "[Retake] Ese lugar está fuera de la zona de bomba: ahí no se puede plantar.");
		return false;
	}
	if (Spawns_TooClose(site, pos))
	{
		ReplyToCommand(reply, "[Retake] Hay otro punto a menos de %.0f unidades.", POINT_MIN_DIST);
		return false;
	}
	float p[4];
	p[0] = pos[0]; p[1] = pos[1]; p[2] = pos[2]; p[3] = ang[1];
	g_aBombs[site].PushArray(p);
	if (!Spawns_Save())
	{
		ReplyToCommand(reply, "[Retake] No se pudo guardar el archivo. Mirá el log de errores.");
		return false;
	}
	ReplyToCommand(reply, "[Retake] Punto de bomba del sitio %s guardado (%d).", site == SITE_A ? "A" : "B", g_aBombs[site].Length);
	return true;
}

public Action Cmd_Spawn(int client, int args)
{
	char a[8], b[8];
	GetCmdArg(1, a, sizeof(a));
	GetCmdArg(2, b, sizeof(b));
	int site;
	bool t = StrEqual(b, "t", false), ct = StrEqual(b, "ct", false);
	if (args != 2 || !Spawns_ParseSite(a, site) || (!t && !ct))
	{
		ReplyToCommand(client, "[Retake] Uso: sm_retake_spawn <a|b> <t|ct>");
		return Plugin_Handled;
	}
	if (Spawns_CanEdit(client))
		Spawns_AddFrom(client, client, site, t ? SIDE_T : SIDE_CT);
	return Plugin_Handled;
}

public Action Cmd_Bomb(int client, int args)
{
	char a[8];
	GetCmdArg(1, a, sizeof(a));
	int site;
	if (args != 1 || !Spawns_ParseSite(a, site))
	{
		ReplyToCommand(client, "[Retake] Uso: sm_retake_bomb <a|b>");
		return Plugin_Handled;
	}
	if (Spawns_CanEdit(client))
		Spawns_SetBombFrom(client, client, site);
	return Plugin_Handled;
}

public Action Cmd_DelSpawn(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	float pos[3], other[3];
	GetClientAbsOrigin(client, pos);
	float best = POINT_DEL_DIST;
	int bestSite = -1, bestSide = -1, bestIndex = -1;
	for (int s = 0; s < 2; s++)
	{
		for (int list = 0; list < 3; list++)
		{
			ArrayList points = list == 0 ? g_aBombs[s] : g_aPoints[s][list - 1];
			for (int i = 0; i < points.Length; i++)
			{
				float p[4];
				points.GetArray(i, p);
				other[0] = p[0]; other[1] = p[1]; other[2] = p[2];
				float d = GetVectorDistance(pos, other);
				if (d < best)
				{
					best = d; bestSite = s; bestSide = list - 1; bestIndex = i;
				}
			}
		}
	}
	if (bestSite == -1)
	{
		ReplyToCommand(client, "[Retake] No hay ningún punto a menos de %.0f unidades.", POINT_DEL_DIST);
		return Plugin_Handled;
	}
	if (bestSide == -1)
		g_aBombs[bestSite].Erase(bestIndex);
	else
		g_aPoints[bestSite][bestSide].Erase(bestIndex);
	Spawns_Save();
	ReplyToCommand(client, "[Retake] Punto borrado del sitio %s (%s).", bestSite == SITE_A ? "A" : "B", bestSide == -1 ? "bomba" : (bestSide == SIDE_T ? "T" : "CT"));
	return Plugin_Handled;
}

void Spawns_Ring(int client, const float p[4], const int color[4])
{
	float pos[3];
	pos[0] = p[0]; pos[1] = p[1]; pos[2] = p[2] + 8.0;
	TE_SetupBeamRingPoint(pos, 30.0, 32.0, g_iBeamSprite, g_iHaloSprite, 0, 10, SHOW_TIME, 3.0, 0.0, color, 0, 0);
	TE_SendToClient(client);
}

public Action Cmd_Spawns(int client, int args)
{
	static const int red[4] = { 255, 60, 60, 255 }, blue[4] = { 60, 120, 255, 255 }, yellow[4] = { 255, 220, 40, 255 };
	for (int s = 0; s < 2; s++)
	{
		ReplyToCommand(client, "[Retake] Sitio %s: %d de bomba, %d T, %d CT.", s == SITE_A ? "A" : "B", g_aBombs[s].Length, g_aPoints[s][SIDE_T].Length, g_aPoints[s][SIDE_CT].Length);
		if (client <= 0 || !IsClientInGame(client))
			continue;
		for (int i = 0; i < g_aBombs[s].Length; i++)
		{
			float p[4];
			g_aBombs[s].GetArray(i, p);
			Spawns_Ring(client, p, yellow);
		}
		for (int t = 0; t < 2; t++)
		{
			for (int i = 0; i < g_aPoints[s][t].Length; i++)
			{
				float p[4];
				g_aPoints[s][t].GetArray(i, p);
				Spawns_Ring(client, p, t == SIDE_T ? red : blue);
			}
		}
	}
	return Plugin_Handled;
}
