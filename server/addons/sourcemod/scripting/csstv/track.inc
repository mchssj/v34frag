/**
 * Repetición 2D y mapa de calor (docs/bitacora/2026-11-12-repeticion-2d-y-mapa-de-calor).
 *
 * Mientras se graba la demo de un mix, escribe csstv_demos/<uid>.trk al lado del .dem: cada
 * TRACK_INTERVAL segundos, dónde está cada jugador vivo, más las kills, la bomba y el fin de cada ronda.
 * El Worker de demos lo sube a R2 con la demo y la web lo dibuja sobre el radar.
 * Los tiempos son ticks desde el inicio de la grabación (los mismos que los clips).
 *
 * Una línea por registro, separada por espacios:
 *   V 1 <mapa> <tickrate> <intervalo en ticks>
 *   J <slot> <equipo 2|3> <steamid> <nick>        jugador (se repite si cambia de equipo o de nick)
 *   R <n> <tick>                                  empieza la ronda n (con !rr se repite el mismo n: vale la última)
 *   Z <tick> <segundos de ronda>                  termina el tiempo de compra (mp_roundtime en segundos)
 *   $ <tick> <slot>,<plata>;…                     la plata de cada uno al terminar el tiempo de compra
 *   F <tick> <slot>,<x>,<y>,<z>,<yaw>,<hp>,<arma>[,b];…  cuadro con los vivos (arma en mano sin "weapon_"; b = lleva la bomba)
 *   S <tick> <x>,<y>,<empieza a irse>,<se fue>;…  humos en el mapa (env_particlesmokegrenade), con m_FadeStartTime y
 *                                                 m_FadeEndTime (segundos desde que salió): lo que dura en la pantalla del juego
 *   K <tick> <mata> <muere> <arma> <hs 0|1> <x> <y> <vx> <vy>   (mata 0 = el mundo o suicidio; x y = - )
 *   B <tick> <plant|defuse|explode> <x> <y> [segundos del C4, solo plant]
 *   D <tick> <slot> <kit 0|1>                     empieza a desactivar; A <tick> <slot> = la deja
 *   H <tick> <atacante> <víctima> <daño> <vida que le queda> <arma> <zona>   un golpe (atacante 0 = el mundo)
 *   E <tick> <ganador 2|3> <motivo>
 *   N <tick> <tipo>,<ent>,<slot>,<x>,<y>;…        granadas en el aire (cada TRACK_NADE_INTERVAL); tipo he|flash|smoke,
 *                                                 ent = la entidad (para unir los puntos), slot = quien la tiró
 *   G <tick> <he|flash|smoke> <slot> <x> <y>      dónde explotó (el humo dura TRACK_SMOKE_SECONDS en la web)
 *   L <tick> <slot> <segundos>                    una flash cegó a ese jugador (la web la une con la G de flash del mismo tick)
 *
 * Las kills con posición también van en el resultado (Track_WriteJson, "kill_pos") para el mapa de calor.
 */

#if defined _csstv_track_included
	#endinput
#endif
#define _csstv_track_included

#define TRACK_INTERVAL 0.5
#define TRACK_MAX_KILLS 512
#define TRACK_NADE_INTERVAL 0.1   // las granadas vuelan uno o dos segundos: más puntos para dibujar el tiro

ConVar g_cvTrack;
File g_hTrack;
Handle g_hTrackTimer;
Handle g_hTrackNadeTimer;
int g_iTrackTeam[MAXPLAYERS + 1];          // equipo con el que se escribió su línea J (0 = ninguna)
char g_sTrackName[MAXPLAYERS + 1][MAX_NAME_LENGTH];
float g_fTrackPlant[3];                   // dónde se plantó la bomba en esta ronda
bool g_bTrackPlanted;

// Kills de la partida para "kill_pos": ronda, registros del que mata y del que muere, arma, hs y posiciones.
int g_iKpCount;
int g_iKpRound[TRACK_MAX_KILLS];
int g_iKpKiller[TRACK_MAX_KILLS];          // -1 = sin registro (mundo, suicidio o bot)
int g_iKpVictim[TRACK_MAX_KILLS];
bool g_bKpHs[TRACK_MAX_KILLS];
int g_iKpPos[TRACK_MAX_KILLS][4];          // x y del que mata, x y del que muere
char g_sKpWeapon[TRACK_MAX_KILLS][24];

void Track_Init()
{
	g_cvTrack = CreateConVar("csstv_track", "1", "Grabar las posiciones de cada ronda (repetición 2D y mapa de calor) al lado de la demo.", _, true, 0.0, true, 1.0);
	HookEventEx("hegrenade_detonate", Event_TrackNade);
	HookEventEx("flashbang_detonate", Event_TrackNade);
	HookEventEx("smokegrenade_detonate", Event_TrackNade);
	HookEventEx("player_blind", Event_TrackBlind);
	HookEventEx("bomb_begindefuse", Event_TrackDefuse);
	HookEventEx("bomb_abortdefuse", Event_TrackDefuse);
}

/** Partida nueva o vuelta al calentamiento. */
void Track_Clear()
{
	g_iKpCount = 0;
}

/** Con Demo_Start, cuando la demo empieza a grabarse. */
void Track_Start()
{
	Track_Stop();
	g_iKpCount = 0;
	if (!g_cvTrack.BoolValue)
		return;
	char path[PLATFORM_MAX_PATH], map[64];
	Format(path, sizeof(path), "%s/%s.trk", DEMO_DIR, g_sMatchUid);
	Track_Lower(path);   // tv_record guarda la demo en minúsculas: los dos con el mismo nombre
	g_hTrack = OpenFile(path, "w");
	if (g_hTrack == null)
	{
		LogError("No se pudo abrir %s: la partida queda sin repetición 2D.", path);
		return;
	}
	for (int i = 0; i <= MaxClients; i++)
		g_iTrackTeam[i] = 0;
	GetCurrentMap(map, sizeof(map));
	int rate = Clips_Tickrate();
	g_hTrack.WriteLine("V 1 %s %d %d", map, rate, RoundToNearest(TRACK_INTERVAL * rate));
	// La línea R de la primera ronda la escribe Track_OnRoundStart, en el mismo round_start.
	g_hTrackTimer = CreateTimer(TRACK_INTERVAL, Timer_TrackFrame, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
	g_hTrackNadeTimer = CreateTimer(TRACK_NADE_INTERVAL, Timer_TrackNades, _, TIMER_REPEAT | TIMER_FLAG_NO_MAPCHANGE);
}

/** Con Demo_Stop: cierra el archivo (la demo ya no graba). */
void Track_Stop()
{
	delete g_hTrackTimer;
	delete g_hTrackNadeTimer;
	if (g_hTrack != null)
	{
		g_hTrack.Flush();
		delete g_hTrack;
	}
}

bool Track_On()
{
	return g_hTrack != null && g_State == State_Live && !g_bRestarting;
}

/** Al empezar cada ronda en vivo. Con !rr se descartan las kills de la ronda que se vuelve a jugar. */
void Track_OnRoundStart()
{
	int n = g_iRoundLogCount + 1;
	int keep = 0;
	for (int k = 0; k < g_iKpCount; k++)
	{
		if (g_iKpRound[k] < n)
			keep = k + 1;
	}
	g_iKpCount = keep;
	g_bTrackPlanted = false;
	if (Track_On())
		g_hTrack.WriteLine("R %d %d", n, Clips_Tick());
}

void Track_OnFreezeEnd()
{
	if (!Track_On())
		return;
	ConVar rt = FindConVar("mp_roundtime");
	g_hTrack.WriteLine("Z %d %d", Clips_Tick(), rt != null ? RoundToNearest(rt.FloatValue * 60.0) : 0);
	char line[1024], part[32];
	Format(line, sizeof(line), "$ %d ", Clips_Tick());
	bool any = false;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || !IsPlayerAlive(i) || GetClientTeam(i) < TEAM_T)
			continue;
		Track_WritePlayer(i);
		Format(part, sizeof(part), "%s%d,%d", any ? ";" : "", i, GetEntProp(i, Prop_Send, "m_iAccount"));
		StrCat(line, sizeof(line), part);
		any = true;
	}
	if (any)
		g_hTrack.WriteLine("%s", line);
}

/** player_hurt en vivo: el golpe, para marcarlo en la repetición y sumar el daño de las granadas. */
void Track_OnHurt(int victim, int attacker, int dmg, int health, const char[] weapon, int hitgroup)
{
	if (!Track_On() || dmg <= 0)
		return;
	Track_WritePlayer(victim);
	bool hasAttacker = attacker > 0 && attacker <= MaxClients && IsClientInGame(attacker);
	if (hasAttacker)
		Track_WritePlayer(attacker);
	g_hTrack.WriteLine("H %d %d %d %d %d %s %d", Clips_Tick(), hasAttacker ? attacker : 0, victim, dmg, health,
		weapon[0] ? weapon : "-", hitgroup);
}

public void Event_TrackDefuse(Event event, const char[] name, bool dontBroadcast)
{
	if (!Track_On())
		return;
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client <= 0 || !IsClientInGame(client))
		return;
	Track_WritePlayer(client);
	if (StrEqual(name, "bomb_begindefuse"))
		g_hTrack.WriteLine("D %d %d %d", Clips_Tick(), client, event.GetBool("haskit") ? 1 : 0);
	else
		g_hTrack.WriteLine("A %d %d", Clips_Tick(), client);
}

/** player_death en vivo. */
void Track_OnDeath(int victim, int attacker, const char[] weapon, bool hs)
{
	float v[3], a[3];
	GetClientAbsOrigin(victim, v);
	bool hasAttacker = attacker > 0 && attacker != victim && IsClientInGame(attacker);
	if (hasAttacker)
		GetClientAbsOrigin(attacker, a);
	if (Track_On())
	{
		Track_WritePlayer(victim);
		if (hasAttacker)
		{
			Track_WritePlayer(attacker);
			g_hTrack.WriteLine("K %d %d %d %s %d %d %d %d %d", Clips_Tick(), attacker, victim, weapon[0] ? weapon : "-", hs ? 1 : 0,
				RoundToFloor(a[0]), RoundToFloor(a[1]), RoundToFloor(v[0]), RoundToFloor(v[1]));
		}
		else
			g_hTrack.WriteLine("K %d 0 %d %s 0 - - %d %d", Clips_Tick(), victim, weapon[0] ? weapon : "-", RoundToFloor(v[0]), RoundToFloor(v[1]));
	}
	if (g_iKpCount >= TRACK_MAX_KILLS)
		return;
	int k = g_iKpCount++;
	g_iKpRound[k] = g_iRoundLogCount + 1;
	g_iKpVictim[k] = Stats_FindRec(victim);
	g_iKpKiller[k] = hasAttacker ? Stats_FindRec(attacker) : -1;
	g_bKpHs[k] = hs;
	strcopy(g_sKpWeapon[k], sizeof(g_sKpWeapon[]), weapon);
	g_iKpPos[k][0] = hasAttacker ? RoundToFloor(a[0]) : 0;
	g_iKpPos[k][1] = hasAttacker ? RoundToFloor(a[1]) : 0;
	g_iKpPos[k][2] = RoundToFloor(v[0]);
	g_iKpPos[k][3] = RoundToFloor(v[1]);
}

void Track_OnBomb(const char[] what, int client)
{
	// La plantada solo en vivo; la explosión y la desactivación, mientras el .trk esté abierto (pueden llegar
	// después de round_end, con la partida ya en el medio tiempo o terminada).
	if (g_hTrack == null || g_bRestarting || (StrEqual(what, "plant") && g_State != State_Live))
		return;
	float p[3];
	int bomb = FindEntityByClassname(-1, "planted_c4");
	if (bomb > 0)
		GetEntPropVector(bomb, Prop_Send, "m_vecOrigin", p);
	else if (!StrEqual(what, "plant") && g_bTrackPlanted)
		p = g_fTrackPlant;   // al explotar, la bomba ya no está: la posición de la plantada
	else if (client > 0 && IsClientInGame(client))
		GetClientAbsOrigin(client, p);
	else
		return;
	if (StrEqual(what, "plant"))
	{
		g_fTrackPlant = p;
		g_bTrackPlanted = true;
	}
	if (StrEqual(what, "plant"))
	{
		ConVar c4 = FindConVar("mp_c4timer");
		g_hTrack.WriteLine("B %d %s %d %d %d", Clips_Tick(), what, RoundToFloor(p[0]), RoundToFloor(p[1]), c4 != null ? c4.IntValue : 35);
	}
	else
		g_hTrack.WriteLine("B %d %s %d %d", Clips_Tick(), what, RoundToFloor(p[0]), RoundToFloor(p[1]));
}

/** En OnRoundCompleted (rondas que cuentan). */
void Track_OnRoundEnd(int winnerSide, int reason)
{
	if (g_hTrack == null)
		return;
	g_hTrack.WriteLine("E %d %d %d", Clips_Tick(), winnerSide, reason);
	g_hTrack.Flush();
}

/** Escribe la línea J del jugador si todavía no está o cambió de equipo o de nick. */
void Track_WritePlayer(int client)
{
	int team = GetClientTeam(client);
	char name[MAX_NAME_LENGTH], steam[40];
	GetClientName(client, name, sizeof(name));
	if (g_iTrackTeam[client] == team && StrEqual(g_sTrackName[client], name))
		return;
	if (!GetClientAuthId(client, AuthId_Steam2, steam, sizeof(steam)))
		strcopy(steam, sizeof(steam), IsFakeClient(client) ? "BOT" : "-");
	ReplaceString(steam, sizeof(steam), " ", "_");
	g_iTrackTeam[client] = team;
	strcopy(g_sTrackName[client], sizeof(g_sTrackName[]), name);
	g_hTrack.WriteLine("J %d %d %s %s", client, team, steam, name);
}

void Track_OnDisconnect(int client)
{
	g_iTrackTeam[client] = 0;
}

public Action Timer_TrackFrame(Handle timer)
{
	if (g_hTrack == null)
	{
		g_hTrackTimer = null;
		return Plugin_Stop;
	}
	if (!Track_On())
		return Plugin_Continue;
	int carrier = -1;
	int c4 = FindEntityByClassname(-1, "weapon_c4");
	if (c4 > 0)
		carrier = GetEntPropEnt(c4, Prop_Send, "m_hOwnerEntity");
	char line[1024], part[96], weapon[32];
	Format(line, sizeof(line), "F %d ", Clips_Tick());
	bool any = false;
	float p[3], ang[3];
	for (int i = 1; i <= MaxClients; i++)
	{
		if (!IsClientInGame(i) || !IsPlayerAlive(i))
			continue;
		int team = GetClientTeam(i);
		if (team != TEAM_T && team != TEAM_CT)
			continue;
		Track_WritePlayer(i);
		GetClientAbsOrigin(i, p);
		GetClientEyeAngles(i, ang);
		weapon[0] = '\0';
		GetClientWeapon(i, weapon, sizeof(weapon));
		ReplaceString(weapon, sizeof(weapon), "weapon_", "");
		if (!weapon[0])
			strcopy(weapon, sizeof(weapon), "-");
		Format(part, sizeof(part), "%s%d,%d,%d,%d,%d,%d,%s%s", any ? ";" : "", i, RoundToFloor(p[0]), RoundToFloor(p[1]), RoundToFloor(p[2]),
			RoundToNearest(ang[1]), GetClientHealth(i), weapon, i == carrier ? ",b" : "");
		StrCat(line, sizeof(line), part);
		any = true;
	}
	if (any)
		g_hTrack.WriteLine("%s", line);
	// Los humos: la entidad vive lo que dura el humo en el juego (la web lo dibuja mientras aparezca).
	Format(line, sizeof(line), "S %d ", Clips_Tick());
	any = false;
	int smoke = -1;
	while ((smoke = FindEntityByClassname(smoke, "env_particlesmokegrenade")) != -1)
	{
		GetEntPropVector(smoke, Prop_Send, "m_vecOrigin", p);
		Format(part, sizeof(part), "%s%d,%d,%.1f,%.1f", any ? ";" : "", RoundToFloor(p[0]), RoundToFloor(p[1]),
			GetEntPropFloat(smoke, Prop_Send, "m_FadeStartTime"), GetEntPropFloat(smoke, Prop_Send, "m_FadeEndTime"));
		StrCat(line, sizeof(line), part);
		any = true;
	}
	if (any)
		g_hTrack.WriteLine("%s", line);
	return Plugin_Continue;
}

void Track_Lower(char[] s)
{
	for (int i = 0; s[i]; i++)
		s[i] = CharToLower(s[i]);
}

/** he, flash o smoke según la clase de la entidad o el evento; "" si no es una granada. */
void Track_NadeKind(const char[] name, char[] kind, int maxlen)
{
	if (StrContains(name, "hegrenade") == 0)
		strcopy(kind, maxlen, "he");
	else if (StrContains(name, "flashbang") == 0)
		strcopy(kind, maxlen, "flash");
	else if (StrContains(name, "smokegrenade") == 0)
		strcopy(kind, maxlen, "smoke");
	else
		kind[0] = '\0';
}

public Action Timer_TrackNades(Handle timer)
{
	if (g_hTrack == null)
	{
		g_hTrackNadeTimer = null;
		return Plugin_Stop;
	}
	if (!Track_On())
		return Plugin_Continue;
	static const char classes[][] = { "hegrenade_projectile", "flashbang_projectile", "smokegrenade_projectile" };
	char line[1024], part[64], kind[8];
	Format(line, sizeof(line), "N %d ", Clips_Tick());
	bool any = false;
	float p[3], vel[3];
	for (int c = 0; c < sizeof(classes); c++)
	{
		Track_NadeKind(classes[c], kind, sizeof(kind));
		int ent = -1;
		while ((ent = FindEntityByClassname(ent, classes[c])) != -1)
		{
			// Quieta en el piso (el humo deja el proyectil hasta que se va): ya no está en el aire.
			GetEntPropVector(ent, Prop_Data, "m_vecAbsVelocity", vel);
			if (GetVectorLength(vel) < 1.0)
				continue;
			GetEntPropVector(ent, Prop_Send, "m_vecOrigin", p);
			int owner = GetEntPropEnt(ent, Prop_Send, "m_hThrower");
			if (owner < 1 || owner > MaxClients)
				owner = 0;
			Format(part, sizeof(part), "%s%s,%d,%d,%d,%d", any ? ";" : "", kind, ent, owner, RoundToFloor(p[0]), RoundToFloor(p[1]));
			if (strlen(line) + strlen(part) >= sizeof(line) - 1)
				break;
			StrCat(line, sizeof(line), part);
			any = true;
		}
	}
	if (any)
		g_hTrack.WriteLine("%s", line);
	return Plugin_Continue;
}

public void Event_TrackNade(Event event, const char[] name, bool dontBroadcast)
{
	if (!Track_On())
		return;
	char kind[8];
	Track_NadeKind(name, kind, sizeof(kind));
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client > 0 && IsClientInGame(client))
		Track_WritePlayer(client);
	g_hTrack.WriteLine("G %d %s %d %d %d", Clips_Tick(), kind, client > 0 ? client : 0,
		RoundToFloor(event.GetFloat("x")), RoundToFloor(event.GetFloat("y")));
}

public void Event_TrackBlind(Event event, const char[] name, bool dontBroadcast)
{
	if (!Track_On())
		return;
	int client = GetClientOfUserId(event.GetInt("userid"));
	if (client <= 0 || !IsClientInGame(client) || !IsPlayerAlive(client))
		return;
	float secs = GetEntPropFloat(client, Prop_Send, "m_flFlashDuration");
	if (secs <= 0.0)
		return;
	Track_WritePlayer(client);
	g_hTrack.WriteLine("L %d %d %.1f", Clips_Tick(), client, secs);
}

/** Borra el .trk de una partida descartada (con Demo_Discard). */
void Track_Discard(const char[] uid)
{
	char path[PLATFORM_MAX_PATH];
	Format(path, sizeof(path), "%s/%s.trk", DEMO_DIR, uid);
	Track_Lower(path);
	if (FileExists(path) && DeleteFile(path))
		LogMessage("Repetición descartada: %s", path);
}

/**
 * Agrega ,"kill_pos":[[ronda,"mata","muere","arma",hs,x,y,vx,vy],…] al resultado (no a las fotos en vivo).
 * "mata" vacío = el mundo, un suicidio o un bot. Si no entra en el buffer, se saca sin cortar el resto.
 */
void Track_WriteJson()
{
	if (g_iKpCount == 0)
		return;
	int start = g_iJsonLen;
	J_Raw(",\"kill_pos\":[");
	bool first = true;
	for (int k = 0; k < g_iKpCount; k++)
	{
		if (g_iKpVictim[k] < 0 || g_iKpRound[k] > g_iRoundLogCount)
			continue;   // un bot o la ronda que no se terminó
		if (!first) J_Char(',');
		first = false;
		J_Char('[');
		J_Int(g_iKpRound[k]);
		J_Char(',');
		J_Str(g_iKpKiller[k] >= 0 ? g_RecSteam[g_iKpKiller[k]] : "");
		J_Char(',');
		J_Str(g_RecSteam[g_iKpVictim[k]]);
		J_Char(',');
		J_Str(g_sKpWeapon[k]);
		J_Raw(g_bKpHs[k] ? ",1" : ",0");
		for (int c = 0; c < 4; c++)
		{
			J_Char(',');
			J_Int(g_iKpPos[k][c]);
		}
		J_Char(']');
	}
	J_Char(']');
	if (g_iJsonLen >= JSON_MAX - 128)
	{
		LogError("Partida %s: las kills con posición no entran en el resultado; se manda sin ellas.", g_sMatchUid);
		g_iJsonLen = start;
		g_sJson[start] = '\0';
	}
}
