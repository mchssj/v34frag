/**
 * !rr (admin): repite la ronda actual. Medio segundo después de cada inicio de ronda en vivo
 * se saca una foto de la partida (marcador, estadísticas, TAB, pausas) y del equipamiento de
 * cada jugador (plata, armas, balas, chaleco, casco, kit). !rr vuelve el plugin a esa foto,
 * hace un mp_restartgame y, cuando los jugadores reaparecen, les devuelve plata y equipamiento.
 *
 * Todo se guarda por registro de jugador (SteamID), así que también sirve si alguien se
 * reconectó durante la ronda. Quien no estaba al inicio de la ronda queda con lo del reinicio.
 * La C4 no se toca: la reparte el juego al reiniciar.
 */

#if defined _csstv_rr_included
	#endinput
#endif
#define _csstv_rr_included

#define RR_MAX_WEAPONS 12
#define RR_MAX_AMMO    32

bool g_bRrValid;               // hay foto de la ronda en curso (o de la que acaba de terminar)
int g_iRrSegA, g_iRrSegB, g_iRrSegRound, g_iRrTotA, g_iRrTotB, g_iRrRoundLog, g_iRrClips;
int g_iRrPauses[2];
int g_iRrStats[MAX_REC][ST_COUNT];
int g_iRrBoardFrags[MAX_REC];
int g_iRrBoardDeaths[MAX_REC];
bool g_bRrBoardSaved[MAX_REC];

// Equipamiento por registro de jugador
bool g_bRrHas[MAX_REC];
int g_iRrMoney[MAX_REC];
int g_iRrArmor[MAX_REC];
bool g_bRrHelmet[MAX_REC];
bool g_bRrDefuser[MAX_REC];
bool g_bRrNvg[MAX_REC];
int g_iRrWeaponCount[MAX_REC];
char g_sRrWeapon[MAX_REC][RR_MAX_WEAPONS][32];
int g_iRrClip[MAX_REC][RR_MAX_WEAPONS];
int g_iRrAmmo[MAX_REC][RR_MAX_AMMO];

void Rr_Init()
{
	RegAdminCmd("sm_rr", Cmd_Rr, ADMFLAG_GENERIC, "Repite la ronda actual: marcador, estadísticas, plata y armas vuelven a como estaban al empezarla.");
}

void Rr_Reset()
{
	g_bRrValid = false;
}

/** round_start: hasta que se saque la foto nueva, la anterior ya no corresponde. */
void Rr_OnRoundStart()
{
	g_bRrValid = false;
}

/** Medio segundo después del inicio de una ronda en vivo (la plata ya está acreditada). */
void Rr_Snapshot()
{
	g_iRrSegA = g_iSegA;
	g_iRrSegB = g_iSegB;
	g_iRrSegRound = g_iSegRound;
	g_iRrTotA = g_iTotA;
	g_iRrTotB = g_iTotB;
	g_iRrRoundLog = g_iRoundLogCount;
	g_iRrClips = g_iClipCount;
	g_iRrPauses[0] = g_iPausesUsed[0];
	g_iRrPauses[1] = g_iPausesUsed[1];
	Board_SaveAll();
	for (int r = 0; r < MAX_REC; r++)
	{
		for (int s = 0; s < ST_COUNT; s++)
			g_iRrStats[r][s] = g_Stats[r][s];
		g_iRrBoardFrags[r] = g_iBoardFrags[r];
		g_iRrBoardDeaths[r] = g_iBoardDeaths[r];
		g_bRrBoardSaved[r] = g_bBoardSaved[r];
		g_bRrHas[r] = false;
	}
	for (int i = 1; i <= MaxClients; i++)
	{
		if (IsClientInGame(i) && IsPlayerAlive(i) && IsTeamSide(GetClientTeam(i)))
			Rr_SaveEquipment(i);
	}
	g_bRrValid = true;
}

void Rr_SaveEquipment(int client)
{
	int rec = Stats_GetRec(client);
	if (rec < 0)
		return;
	g_bRrHas[rec] = true;
	g_iRrMoney[rec] = GetEntProp(client, Prop_Send, "m_iAccount");
	g_iRrArmor[rec] = GetClientArmor(client);
	g_bRrHelmet[rec] = GetEntProp(client, Prop_Send, "m_bHasHelmet") != 0;
	g_bRrDefuser[rec] = GetEntProp(client, Prop_Send, "m_bHasDefuser") != 0;
	g_bRrNvg[rec] = GetEntProp(client, Prop_Send, "m_bHasNightVision") != 0;

	int n, size = GetEntPropArraySize(client, Prop_Send, "m_hMyWeapons");
	char cls[32];
	for (int i = 0; i < size && n < RR_MAX_WEAPONS; i++)
	{
		int w = GetEntPropEnt(client, Prop_Send, "m_hMyWeapons", i);
		if (w <= 0 || !IsValidEdict(w))
			continue;
		GetEdictClassname(w, cls, sizeof(cls));
		if (StrEqual(cls, "weapon_c4"))
			continue;
		strcopy(g_sRrWeapon[rec][n], sizeof(g_sRrWeapon[][]), cls);
		g_iRrClip[rec][n] = GetEntProp(w, Prop_Send, "m_iClip1");
		n++;
	}
	g_iRrWeaponCount[rec] = n;

	int ammo = GetEntPropArraySize(client, Prop_Send, "m_iAmmo");
	for (int a = 0; a < RR_MAX_AMMO; a++)
		g_iRrAmmo[rec][a] = a < ammo ? GetEntProp(client, Prop_Send, "m_iAmmo", _, a) : 0;
}

public Action Cmd_Rr(int client, int args)
{
	if (g_State != State_Live || g_bRestarting)
	{
		ReplyToCommand(client, "[%s] !rr solo funciona con la partida en vivo (no en el LO3, el medio tiempo ni el cambio a prórroga).", g_sTag);
		return Plugin_Handled;
	}
	if (!g_bRrValid)
	{
		ReplyToCommand(client, "[%s] Todavía no está guardado el inicio de esta ronda. Probá de nuevo en un segundo.", g_sTag);
		return Plugin_Handled;
	}
	char by[MAX_NAME_LENGTH];
	if (client > 0)
		GetClientName(client, by, sizeof(by));
	else
		strcopy(by, sizeof(by), "Consola");

	// El plugin vuelve al inicio de la ronda.
	g_iSegA = g_iRrSegA;
	g_iSegB = g_iRrSegB;
	g_iSegRound = g_iRrSegRound;
	g_iTotA = g_iRrTotA;
	g_iTotB = g_iRrTotB;
	g_iRoundLogCount = g_iRrRoundLog;
	if (g_iClipCount > g_iRrClips)
		g_iClipCount = g_iRrClips;   // los clips de la ronda anulada
	Pause_Clear();
	g_iPausesUsed[0] = g_iRrPauses[0];
	g_iPausesUsed[1] = g_iRrPauses[1];
	for (int r = 0; r < MAX_REC; r++)
	{
		for (int s = 0; s < ST_COUNT; s++)
			g_Stats[r][s] = g_iRrStats[r][s];
		g_iBoardFrags[r] = g_iRrBoardFrags[r];
		g_iBoardDeaths[r] = g_iRrBoardDeaths[r];
		g_bBoardSaved[r] = g_bRrBoardSaved[r];
	}
	g_bRrValid = false;

	LogMessage("Partida %s: %s repite la ronda %d (%d-%d).", g_sMatchUid, by, g_iTotA + g_iTotB + 1, g_iTotA, g_iTotB);
	PrintToChatAll("%s %s repite la ronda %d. Marcador, plata y armas vuelven a como estaban al empezarla.", PREFIX, by, g_iTotA + g_iTotB + 1);
	BeginRestarts(1, PURPOSE_REROUND);
	return Plugin_Handled;
}

/** Después del reinicio de !rr, cuando los jugadores ya reaparecieron. */
void Rr_ScheduleRestore()
{
	CreateTimer(0.2, Timer_RrRestore, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_RrRestore(Handle timer)
{
	if (g_State != State_Live)
		return Plugin_Stop;
	for (int i = 1; i <= MaxClients; i++)
	{
		if (IsClientInGame(i) && IsPlayerAlive(i) && IsTeamSide(GetClientTeam(i)))
			Rr_RestoreEquipment(i);
	}
	return Plugin_Stop;
}

void Rr_RestoreEquipment(int client)
{
	int rec = Stats_GetRec(client);
	if (rec < 0 || !g_bRrHas[rec])
		return;

	// Fuera lo que dio el reinicio (menos la C4), y adentro lo que tenía.
	int size = GetEntPropArraySize(client, Prop_Send, "m_hMyWeapons");
	char cls[32];
	for (int i = 0; i < size; i++)
	{
		int w = GetEntPropEnt(client, Prop_Send, "m_hMyWeapons", i);
		if (w <= 0 || !IsValidEdict(w))
			continue;
		GetEdictClassname(w, cls, sizeof(cls));
		if (StrEqual(cls, "weapon_c4"))
			continue;
		if (RemovePlayerItem(client, w))
			AcceptEntityInput(w, "Kill");
	}
	// Primero la principal, que es la que queda en la mano; después pistola, granadas y cuchillo.
	for (int order = 0; order < 4; order++)
		for (int k = 0; k < g_iRrWeaponCount[rec]; k++)
			if (Rr_GiveOrder(g_sRrWeapon[rec][k]) == order)
				Rr_Give(client, rec, k);

	// Balas de reserva y cantidad de granadas.
	int ammo = GetEntPropArraySize(client, Prop_Send, "m_iAmmo");
	for (int a = 0; a < ammo && a < RR_MAX_AMMO; a++)
		SetEntProp(client, Prop_Send, "m_iAmmo", g_iRrAmmo[rec][a], _, a);

	SetEntProp(client, Prop_Send, "m_ArmorValue", g_iRrArmor[rec]);
	SetEntProp(client, Prop_Send, "m_bHasHelmet", g_bRrHelmet[rec]);
	SetEntProp(client, Prop_Send, "m_bHasDefuser", g_bRrDefuser[rec]);
	SetEntProp(client, Prop_Send, "m_bHasNightVision", g_bRrNvg[rec]);
	SetEntProp(client, Prop_Send, "m_iAccount", g_iRrMoney[rec]);
#if defined CSSTV_DEBUG
	LogMessage("[rr] %N: $%d, %d armas, chaleco %d", client, g_iRrMoney[rec], g_iRrWeaponCount[rec], g_iRrArmor[rec]);
#endif
}

int Rr_GiveOrder(const char[] cls)
{
	static const char pistols[][] = { "weapon_glock", "weapon_usp", "weapon_p228", "weapon_deagle", "weapon_elite", "weapon_fiveseven" };
	if (StrEqual(cls, "weapon_knife"))
		return 3;
	if (StrContains(cls, "grenade") != -1 || StrEqual(cls, "weapon_flashbang"))
		return 2;
	for (int i = 0; i < sizeof(pistols); i++)
		if (StrEqual(cls, pistols[i]))
			return 1;
	return 0;
}

void Rr_Give(int client, int rec, int k)
{
	int w = GivePlayerItem(client, g_sRrWeapon[rec][k]);
	if (w > 0 && IsValidEdict(w))
		SetEntProp(w, Prop_Send, "m_iClip1", g_iRrClip[rec][k]);
	else
		LogError("!rr: no se pudo devolver %s a %N.", g_sRrWeapon[rec][k], client);
}
