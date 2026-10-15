/**
 * Ronda de cuchillo (!live knife): antes del LO3 se juega una ronda solo con cuchillo, sin
 * compras ni C4. El equipo que la gana elige lado con !stay o !switch (vale el primero que
 * lo escribe; si nadie elige en csstv_knife_time segundos, se queda). No cuenta para las
 * estadísticas, el marcador ni la demo, que empiezan con el LO3.
 *
 * La usan !live knife y, desde la 1.8.0, el inicio por !ready (csstv_ready_knife 1, por defecto).
 * !live solo no la usa.
 */

#if defined _csstv_knife_included
	#endinput
#endif
#define _csstv_knife_included

ConVar g_cvKnifeTime;
bool g_bKnifeChoosing;         // ya hay ganador y se espera !stay / !switch
int g_iKnifeWinner;            // equipo que ganó: 0 = A, 1 = B
Handle g_hKnifeTimer;

void Knife_Init()
{
	g_cvKnifeTime = CreateConVar("csstv_knife_time", "60", "Segundos que tiene el ganador de la ronda de cuchillo para elegir lado con !stay o !switch.", _, true, 10.0, true, 300.0);
	RegConsoleCmd("sm_stay", Cmd_Stay, "Ronda de cuchillo: el equipo ganador se queda en su lado.");
	RegConsoleCmd("sm_switch", Cmd_Switch, "Ronda de cuchillo: el equipo ganador cambia de lado.");
	AddCommandListener(Cmd_KnifeBuy, "buy");
	AddCommandListener(Cmd_KnifeBuy, "autobuy");
	AddCommandListener(Cmd_KnifeBuy, "rebuy");
	AddCommandListener(Cmd_KnifeBuy, "buyammo1");
	AddCommandListener(Cmd_KnifeBuy, "buyammo2");
}

void Knife_Reset()
{
	g_bKnifeChoosing = false;
	delete g_hKnifeTimer;
}

/** Desde StartMatch: los equipos ya tienen nombre. */
void Knife_Begin()
{
	g_State = State_Knife;
	QolChatAll("%s {#amarillo}Ronda de cuchillo{#normal}: %s (%s) vs %s (%s). El que gana elige lado.", PREFIX,
		g_sTeam[0], g_iSideA == TEAM_CT ? "{#ct}CT{#normal}" : "{#t}T{#normal}",
		g_sTeam[1], g_iSideA == TEAM_CT ? "{#t}T{#normal}" : "{#ct}CT{#normal}");
	BeginRestarts(1, PURPOSE_KNIFE);
}

void Knife_OnRestartsDone()
{
	QolChatAll("%s {#amarillo}¡A cuchillo!{#normal} No se puede comprar en esta ronda.", PREFIX);
	for (int i = 1; i <= MaxClients; i++)
		if (IsClientInGame(i) && IsPlayerAlive(i))
			CreateTimer(0.1, Timer_KnifeStrip, GetClientUserId(i), TIMER_FLAG_NO_MAPCHANGE);
}

/** Cada vez que alguien aparece durante la ronda de cuchillo (y mientras se elige lado). */
void Knife_OnSpawn(int client)
{
	if (g_State == State_Knife)
		CreateTimer(0.1, Timer_KnifeStrip, GetClientUserId(client), TIMER_FLAG_NO_MAPCHANGE);
}

/** Saca todo menos el cuchillo (también la C4). */
public Action Timer_KnifeStrip(Handle timer, int userid)
{
	int client = GetClientOfUserId(userid);
	if (client <= 0 || !IsClientInGame(client) || !IsPlayerAlive(client) || g_State != State_Knife)
		return Plugin_Stop;
	bool hasKnife;
	int size = GetEntPropArraySize(client, Prop_Send, "m_hMyWeapons");
	char cls[32];
	for (int i = 0; i < size; i++)
	{
		int w = GetEntPropEnt(client, Prop_Send, "m_hMyWeapons", i);
		if (w <= 0 || !IsValidEdict(w))
			continue;
		GetEdictClassname(w, cls, sizeof(cls));
		if (StrEqual(cls, "weapon_knife"))
		{
			hasKnife = true;
			continue;
		}
		if (RemovePlayerItem(client, w))
			AcceptEntityInput(w, "Kill");
	}
	if (!hasKnife)
		GivePlayerItem(client, "weapon_knife");
	if (!IsFakeClient(client))
		FakeClientCommandEx(client, "use weapon_knife");
	return Plugin_Stop;
}

public Action Cmd_KnifeBuy(int client, const char[] command, int argc)
{
	if (g_State != State_Knife || client <= 0)
		return Plugin_Continue;
	PrintCenterText(client, "Ronda de cuchillo: no se puede comprar.");
	return Plugin_Handled;
}

void Knife_OnRoundEnd(int winnerSide)
{
	if (g_bKnifeChoosing)
		return;   // las rondas mientras se elige lado no cuentan
	if (winnerSide != TEAM_CT && winnerSide != TEAM_T)
	{
		QolChatAll("%s La ronda de cuchillo terminó empatada: se juega otra.", PREFIX);
		BeginRestarts(1, PURPOSE_KNIFE);
		return;
	}
	g_iKnifeWinner = winnerSide == g_iSideA ? 0 : 1;
	g_bKnifeChoosing = true;
	int secs = g_cvKnifeTime.IntValue;
	QolChatAll("%s Ganó la ronda de cuchillo el {#amarillo}%s{#normal} (%s). Escriban {#verde}!stay{#normal} para quedarse o {#verde}!switch{#normal} para cambiar de lado (%d s).", PREFIX,
		g_sTeam[g_iKnifeWinner], winnerSide == TEAM_CT ? "{#ct}CT{#normal}" : "{#t}T{#normal}", secs);
	delete g_hKnifeTimer;
	g_hKnifeTimer = CreateTimer(float(secs), Timer_KnifeTimeout, _, TIMER_FLAG_NO_MAPCHANGE);
}

public Action Timer_KnifeTimeout(Handle timer)
{
	g_hKnifeTimer = null;
	if (g_State == State_Knife && g_bKnifeChoosing)
		Knife_Decide(0, false);
	return Plugin_Stop;
}

public Action Cmd_Stay(int client, int args)
{
	Knife_Choose(client, false);
	return Plugin_Handled;
}

public Action Cmd_Switch(int client, int args)
{
	Knife_Choose(client, true);
	return Plugin_Handled;
}

void Knife_Choose(int client, bool swap)
{
	if (client <= 0 || !IsClientInGame(client))
		return;
	if (g_State != State_Knife || !g_bKnifeChoosing)
	{
		QolReply(client, "[%s] !stay y !switch solo sirven después de ganar la ronda de cuchillo.", g_sTag);
		return;
	}
	if (!IsTeamSide(GetClientTeam(client)) || TeamIndexOf(client) != g_iKnifeWinner)
	{
		QolReply(client, "[%s] Solo puede elegir el %s, que ganó la ronda de cuchillo.", g_sTag, g_sTeam[g_iKnifeWinner]);
		return;
	}
	Knife_Decide(client, swap);
}

/** client = 0: se acabó el tiempo. */
void Knife_Decide(int client, bool swap)
{
	g_bKnifeChoosing = false;
	delete g_hKnifeTimer;
	int side = g_iKnifeWinner == 0 ? g_iSideA : OtherSide(g_iSideA);
	if (swap)
		side = OtherSide(side);
	if (client > 0)
		QolChatAll("%s {#amarillo}%N{#normal} eligió %s: el %s juega de %s.", PREFIX, client,
			swap ? "cambiar de lado" : "quedarse", g_sTeam[g_iKnifeWinner], side == TEAM_CT ? "CT" : "T");
	else
		QolChatAll("%s Nadie eligió a tiempo: el %s se queda en su lado.", PREFIX, g_sTeam[g_iKnifeWinner]);
	LogMessage("Partida %s: ronda de cuchillo para el equipo %s, %s.", g_sMatchUid, g_iKnifeWinner == 0 ? "A" : "B", swap ? "cambia de lado" : "se queda");
	if (swap)
		SwapTeams();
	GoLive();
}
