/**
 * Datos de cada mapa: configs/2v2/<mapa>.cfg (KeyValues). El sitio que se juega, 2 spawns por equipo
 * y las zonas prohibidas. Los comandos de admin guardan el archivo al instante.
 */

#if defined _wingman_map_included
	#endinput
#endif
#define _wingman_map_included

#define SIDE_T 0
#define SIDE_CT 1
#define SPAWNS_PER_TEAM 2
#define MAX_ZONES 32
#define PLAYER_RADIUS 16.0
#define ZONE_HEIGHT 256.0       // alto que se le suma a la caja: en la práctica, una pared
#define SHOW_TIME 30.0

bool g_bHasSite;
float g_fSite[3];
float g_fSpawn[2][SPAWNS_PER_TEAM][4];
int g_iSpawns[2];
float g_fZoneMin[MAX_ZONES][3];
float g_fZoneMax[MAX_ZONES][3];
int g_iZones;
float g_fCorner[MAXPLAYERS + 1][3];
bool g_bHasCorner[MAXPLAYERS + 1];
int g_iBeamSprite, g_iHaloSprite;

void Map_Init()
{
	RegAdminCmd("sm_2v2_site", Cmd_Site, ADMFLAG_GENERIC, "Marca el sitio que se juega. Hay que estar parado dentro de él.");
	RegAdminCmd("sm_2v2_spawn", Cmd_Spawn, ADMFLAG_GENERIC, "Guarda un spawn donde estás parado (2 por equipo). Uso: sm_2v2_spawn <t|ct>");
	RegAdminCmd("sm_2v2_delspawn", Cmd_DelSpawn, ADMFLAG_GENERIC, "Borra el spawn más cercano a vos.");
	RegAdminCmd("sm_2v2_zone1", Cmd_Zone1, ADMFLAG_GENERIC, "Marca la primera esquina de una zona prohibida.");
	RegAdminCmd("sm_2v2_zone2", Cmd_Zone2, ADMFLAG_GENERIC, "Marca la esquina opuesta y guarda la zona prohibida.");
	RegAdminCmd("sm_2v2_delzone", Cmd_DelZone, ADMFLAG_GENERIC, "Borra la zona prohibida en la que estás parado.");
	RegAdminCmd("sm_2v2_show", Cmd_Show, ADMFLAG_GENERIC, "Muestra el sitio, los spawns y las zonas del mapa.");
}

void Map_OnMapStart()
{
	g_iBeamSprite = PrecacheModel("materials/sprites/laser.vmt");
	g_iHaloSprite = PrecacheModel("materials/sprites/halo01.vmt");
	Map_Load();
}

void Map_Path(char[] path, int maxlen)
{
	char map[PLATFORM_MAX_PATH];
	GetCurrentMap(map, sizeof(map));
	BuildPath(Path_SM, path, maxlen, "configs/2v2/%s.cfg", map);
}

void Map_Load()
{
	g_bHasSite = false;
	g_iSpawns[SIDE_T] = g_iSpawns[SIDE_CT] = 0;
	g_iZones = 0;
	char path[PLATFORM_MAX_PATH];
	Map_Path(path, sizeof(path));
	KeyValues kv = new KeyValues("2v2");
	if (FileExists(path) && kv.ImportFromFile(path))
	{
		if (kv.JumpToKey("site"))
		{
			g_fSite[0] = kv.GetFloat("x");
			g_fSite[1] = kv.GetFloat("y");
			g_fSite[2] = kv.GetFloat("z");
			g_bHasSite = true;
			kv.GoBack();
		}
		for (int side = 0; side < 2; side++)
		{
			if (!kv.JumpToKey(side == SIDE_T ? "t" : "ct"))
				continue;
			if (kv.GotoFirstSubKey())
			{
				do
				{
					if (g_iSpawns[side] == SPAWNS_PER_TEAM)
						break;
					int n = g_iSpawns[side]++;
					g_fSpawn[side][n][0] = kv.GetFloat("x");
					g_fSpawn[side][n][1] = kv.GetFloat("y");
					g_fSpawn[side][n][2] = kv.GetFloat("z");
					g_fSpawn[side][n][3] = kv.GetFloat("yaw");
				}
				while (kv.GotoNextKey());
				kv.GoBack();
			}
			kv.GoBack();
		}
		if (kv.JumpToKey("zones"))
		{
			if (kv.GotoFirstSubKey())
			{
				do
				{
					if (g_iZones == MAX_ZONES)
						break;
					g_fZoneMin[g_iZones][0] = kv.GetFloat("x1");
					g_fZoneMin[g_iZones][1] = kv.GetFloat("y1");
					g_fZoneMin[g_iZones][2] = kv.GetFloat("z1");
					g_fZoneMax[g_iZones][0] = kv.GetFloat("x2");
					g_fZoneMax[g_iZones][1] = kv.GetFloat("y2");
					g_fZoneMax[g_iZones][2] = kv.GetFloat("z2");
					g_iZones++;
				}
				while (kv.GotoNextKey());
				kv.GoBack();
			}
			kv.GoBack();
		}
	}
	delete kv;
}

bool Map_Save()
{
	char path[PLATFORM_MAX_PATH], dir[PLATFORM_MAX_PATH], key[8];
	Map_Path(path, sizeof(path));
	BuildPath(Path_SM, dir, sizeof(dir), "configs/2v2");
	if (!DirExists(dir))
		CreateDirectory(dir, 511);
	KeyValues kv = new KeyValues("2v2");
	if (g_bHasSite)
	{
		kv.JumpToKey("site", true);
		kv.SetFloat("x", g_fSite[0]);
		kv.SetFloat("y", g_fSite[1]);
		kv.SetFloat("z", g_fSite[2]);
		kv.GoBack();
	}
	for (int side = 0; side < 2; side++)
	{
		kv.JumpToKey(side == SIDE_T ? "t" : "ct", true);
		for (int i = 0; i < g_iSpawns[side]; i++)
		{
			IntToString(i, key, sizeof(key));
			kv.JumpToKey(key, true);
			kv.SetFloat("x", g_fSpawn[side][i][0]);
			kv.SetFloat("y", g_fSpawn[side][i][1]);
			kv.SetFloat("z", g_fSpawn[side][i][2]);
			kv.SetFloat("yaw", g_fSpawn[side][i][3]);
			kv.GoBack();
		}
		kv.GoBack();
	}
	kv.JumpToKey("zones", true);
	for (int i = 0; i < g_iZones; i++)
	{
		IntToString(i, key, sizeof(key));
		kv.JumpToKey(key, true);
		kv.SetFloat("x1", g_fZoneMin[i][0]);
		kv.SetFloat("y1", g_fZoneMin[i][1]);
		kv.SetFloat("z1", g_fZoneMin[i][2]);
		kv.SetFloat("x2", g_fZoneMax[i][0]);
		kv.SetFloat("y2", g_fZoneMax[i][1]);
		kv.SetFloat("z2", g_fZoneMax[i][2]);
		kv.GoBack();
	}
	kv.GoBack();
	kv.Rewind();
	bool ok = kv.ExportToFile(path);
	delete kv;
	if (!ok)
		LogError("No se pudo escribir %s", path);
	return ok;
}

/** El mapa está listo para jugar: sitio y 2 spawns por equipo. Las zonas son opcionales. */
bool Map_Ready()
{
	return g_bHasSite && g_iSpawns[SIDE_T] == SPAWNS_PER_TEAM && g_iSpawns[SIDE_CT] == SPAWNS_PER_TEAM;
}

void Map_Bounds(int ent, float mins[3], float maxs[3])
{
	GetEntPropVector(ent, Prop_Send, "m_vecMins", mins);
	GetEntPropVector(ent, Prop_Send, "m_vecMaxs", maxs);
}

bool Map_InBox(const float pos[3], const float mins[3], const float maxs[3])
{
	return pos[0] >= mins[0] && pos[0] <= maxs[0] && pos[1] >= mins[1] && pos[1] <= maxs[1] && pos[2] >= mins[2] - 16.0 && pos[2] <= maxs[2];
}

/** Si en esa posición no se puede plantar: dentro de un sitio que no es el que se juega. */
bool Map_InDisabledSite(const float pos[3])
{
	int ent = -1;
	while ((ent = FindEntityByClassname(ent, "func_bomb_target")) != -1)
	{
		float mins[3], maxs[3];
		Map_Bounds(ent, mins, maxs);
		if (Map_InBox(pos, mins, maxs) && !Map_InBox(g_fSite, mins, maxs))
			return true;
	}
	return false;
}

/** Desactiva los sitios que no se juegan. El mapa los vuelve a crear en cada ronda. */
void Map_DisableOtherSites()
{
	int ent = -1;
	while ((ent = FindEntityByClassname(ent, "func_bomb_target")) != -1)
	{
		float mins[3], maxs[3];
		Map_Bounds(ent, mins, maxs);
		if (!Map_InBox(g_fSite, mins, maxs))
			AcceptEntityInput(ent, "Disable");
	}
}

/** La zona que toca un jugador en esa posición, contando su ancho. -1 si no toca ninguna. */
int Map_ZoneAt(const float pos[3])
{
	for (int i = 0; i < g_iZones; i++)
		if (pos[0] >= g_fZoneMin[i][0] - PLAYER_RADIUS && pos[0] <= g_fZoneMax[i][0] + PLAYER_RADIUS && pos[1] >= g_fZoneMin[i][1] - PLAYER_RADIUS && pos[1] <= g_fZoneMax[i][1] + PLAYER_RADIUS && pos[2] >= g_fZoneMin[i][2] && pos[2] <= g_fZoneMax[i][2])
			return i;
	return -1;
}

bool Map_CanEdit(int client)
{
	if (client <= 0 || !IsClientInGame(client) || !IsPlayerAlive(client))
	{
		ReplyToCommand(client, "[2v2] Tenés que estar vivo y parado en el lugar.");
		return false;
	}
	return true;
}

public Action Cmd_Site(int client, int args)
{
	if (!Map_CanEdit(client))
		return Plugin_Handled;
	float pos[3];
	GetClientAbsOrigin(client, pos);
	int ent = -1;
	while ((ent = FindEntityByClassname(ent, "func_bomb_target")) != -1)
	{
		float mins[3], maxs[3];
		Map_Bounds(ent, mins, maxs);
		if (Map_InBox(pos, mins, maxs))
		{
			g_fSite = pos;
			g_bHasSite = true;
			ReplyToCommand(client, Map_Save() ? "[2v2] Sitio guardado." : "[2v2] No se pudo guardar. Mirá el log de errores.");
			return Plugin_Handled;
		}
	}
	ReplyToCommand(client, "[2v2] Estás fuera de la zona de bomba de cualquier sitio.");
	return Plugin_Handled;
}

public Action Cmd_Spawn(int client, int args)
{
	char arg[8];
	GetCmdArg(1, arg, sizeof(arg));
	bool t = StrEqual(arg, "t", false), ct = StrEqual(arg, "ct", false);
	if (args != 1 || (!t && !ct))
	{
		ReplyToCommand(client, "[2v2] Uso: sm_2v2_spawn <t|ct>");
		return Plugin_Handled;
	}
	if (!Map_CanEdit(client))
		return Plugin_Handled;
	if (!(GetEntityFlags(client) & FL_ONGROUND))
	{
		ReplyToCommand(client, "[2v2] Tenés que estar apoyado en el suelo.");
		return Plugin_Handled;
	}
	int side = t ? SIDE_T : SIDE_CT;
	if (g_iSpawns[side] == SPAWNS_PER_TEAM)
	{
		ReplyToCommand(client, "[2v2] Ese equipo ya tiene sus %d spawns. Borrá uno con sm_2v2_delspawn.", SPAWNS_PER_TEAM);
		return Plugin_Handled;
	}
	float pos[3], ang[3];
	GetClientAbsOrigin(client, pos);
	GetClientEyeAngles(client, ang);
	int n = g_iSpawns[side]++;
	g_fSpawn[side][n][0] = pos[0];
	g_fSpawn[side][n][1] = pos[1];
	g_fSpawn[side][n][2] = pos[2];
	g_fSpawn[side][n][3] = ang[1];
	Map_Save();
	ReplyToCommand(client, "[2v2] Spawn de %s guardado (%d de %d).", t ? "T" : "CT", g_iSpawns[side], SPAWNS_PER_TEAM);
	return Plugin_Handled;
}

public Action Cmd_DelSpawn(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	float pos[3], other[3];
	GetClientAbsOrigin(client, pos);
	float best = 128.0;
	int bestSide = -1, bestIndex = -1;
	for (int side = 0; side < 2; side++)
	{
		for (int i = 0; i < g_iSpawns[side]; i++)
		{
			other[0] = g_fSpawn[side][i][0]; other[1] = g_fSpawn[side][i][1]; other[2] = g_fSpawn[side][i][2];
			float d = GetVectorDistance(pos, other);
			if (d < best)
			{
				best = d; bestSide = side; bestIndex = i;
			}
		}
	}
	if (bestSide == -1)
	{
		ReplyToCommand(client, "[2v2] No hay ningún spawn a menos de %.0f unidades.", best);
		return Plugin_Handled;
	}
	for (int i = bestIndex; i < g_iSpawns[bestSide] - 1; i++)
		for (int c = 0; c < 4; c++)
			g_fSpawn[bestSide][i][c] = g_fSpawn[bestSide][i + 1][c];
	g_iSpawns[bestSide]--;
	Map_Save();
	ReplyToCommand(client, "[2v2] Spawn de %s borrado.", bestSide == SIDE_T ? "T" : "CT");
	return Plugin_Handled;
}

public Action Cmd_Zone1(int client, int args)
{
	if (!Map_CanEdit(client))
		return Plugin_Handled;
	GetClientAbsOrigin(client, g_fCorner[client]);
	g_bHasCorner[client] = true;
	ReplyToCommand(client, "[2v2] Primera esquina marcada. Andá a la opuesta y escribí sm_2v2_zone2.");
	return Plugin_Handled;
}

void Map_AddZone(const float a[3], const float b[3])
{
	for (int c = 0; c < 3; c++)
	{
		g_fZoneMin[g_iZones][c] = a[c] < b[c] ? a[c] : b[c];
		g_fZoneMax[g_iZones][c] = a[c] > b[c] ? a[c] : b[c];
	}
	g_fZoneMin[g_iZones][2] -= 32.0;
	g_fZoneMax[g_iZones][2] += ZONE_HEIGHT;
	g_iZones++;
}

public Action Cmd_Zone2(int client, int args)
{
	if (!Map_CanEdit(client))
		return Plugin_Handled;
	if (!g_bHasCorner[client])
	{
		ReplyToCommand(client, "[2v2] Primero marcá una esquina con sm_2v2_zone1.");
		return Plugin_Handled;
	}
	if (g_iZones == MAX_ZONES)
	{
		ReplyToCommand(client, "[2v2] Ya hay %d zonas, el máximo.", MAX_ZONES);
		return Plugin_Handled;
	}
	float pos[3];
	GetClientAbsOrigin(client, pos);
	Map_AddZone(g_fCorner[client], pos);
	g_bHasCorner[client] = false;
	Map_Save();
	Map_DrawZone(client, g_iZones - 1);
	ReplyToCommand(client, "[2v2] Zona prohibida guardada (%d).", g_iZones);
	return Plugin_Handled;
}

public Action Cmd_DelZone(int client, int args)
{
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	float pos[3];
	GetClientAbsOrigin(client, pos);
	int zone = Map_ZoneAt(pos);
	if (zone == -1)
	{
		ReplyToCommand(client, "[2v2] No estás dentro de ninguna zona prohibida.");
		return Plugin_Handled;
	}
	for (int i = zone; i < g_iZones - 1; i++)
	{
		g_fZoneMin[i] = g_fZoneMin[i + 1];
		g_fZoneMax[i] = g_fZoneMax[i + 1];
	}
	g_iZones--;
	Map_Save();
	ReplyToCommand(client, "[2v2] Zona borrada. Quedan %d.", g_iZones);
	return Plugin_Handled;
}

void Map_Beam(int client, const float a[3], const float b[3], const int color[4], float time)
{
	TE_SetupBeamPoints(a, b, g_iBeamSprite, g_iHaloSprite, 0, 0, time, 3.0, 3.0, 0, 0.0, color, 0);
	TE_SendToClient(client);
}

/** Dibuja el perímetro de la zona abajo y arriba, y las cuatro esquinas: se ve como una pared. */
void Map_DrawZone(int client, int zone, float time = SHOW_TIME)
{
	static const int red[4] = { 255, 40, 40, 255 };
	float x1 = g_fZoneMin[zone][0], y1 = g_fZoneMin[zone][1], x2 = g_fZoneMax[zone][0], y2 = g_fZoneMax[zone][1];
	float z1 = g_fZoneMin[zone][2] + 32.0, z2 = z1 + 128.0;
	float xs[4], ys[4];
	xs[0] = x1; ys[0] = y1;
	xs[1] = x2; ys[1] = y1;
	xs[2] = x2; ys[2] = y2;
	xs[3] = x1; ys[3] = y2;
	for (int i = 0; i < 4; i++)
	{
		int n = (i + 1) % 4;
		float a[3], b[3];
		a[0] = xs[i]; a[1] = ys[i]; a[2] = z1;
		b[0] = xs[n]; b[1] = ys[n]; b[2] = z1;
		Map_Beam(client, a, b, red, time);
		a[2] = z2; b[2] = z2;
		Map_Beam(client, a, b, red, time);
		b[0] = xs[i]; b[1] = ys[i]; b[2] = z1;
		Map_Beam(client, a, b, red, time);
	}
}

void Map_Ring(int client, const float p[3], const int color[4])
{
	float pos[3];
	pos = p;
	pos[2] += 8.0;
	TE_SetupBeamRingPoint(pos, 30.0, 32.0, g_iBeamSprite, g_iHaloSprite, 0, 10, SHOW_TIME, 3.0, 0.0, color, 0, 0);
	TE_SendToClient(client);
}

public Action Cmd_Show(int client, int args)
{
	static const int red[4] = { 255, 60, 60, 255 }, blue[4] = { 60, 120, 255, 255 }, yellow[4] = { 255, 220, 40, 255 };
	ReplyToCommand(client, "[2v2] Sitio: %s. Spawns: %d T, %d CT (de %d). Zonas: %d.", g_bHasSite ? "sí" : "NO", g_iSpawns[SIDE_T], g_iSpawns[SIDE_CT], SPAWNS_PER_TEAM, g_iZones);
	if (client <= 0 || !IsClientInGame(client))
		return Plugin_Handled;
	if (g_bHasSite)
		Map_Ring(client, g_fSite, yellow);
	for (int side = 0; side < 2; side++)
	{
		for (int i = 0; i < g_iSpawns[side]; i++)
		{
			float p[3];
			p[0] = g_fSpawn[side][i][0]; p[1] = g_fSpawn[side][i][1]; p[2] = g_fSpawn[side][i][2];
			Map_Ring(client, p, side == SIDE_T ? red : blue);
		}
	}
	for (int i = 0; i < g_iZones; i++)
		Map_DrawZone(client, i);
	return Plugin_Handled;
}
