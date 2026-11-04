/**
 * Consejos de comandos en el chat (plan docs/bitacora/2026-10-20-consejos-y-discord):
 * cada csstv_tips_interval segundos, el siguiente de la rotación que aplique ahora.
 *   - !pause y !gg solo con la partida en vivo o en el medio tiempo;
 *   - !rtv y !ready solo en el calentamiento;
 *   - !sell y !calladmin solo si su plugin está cargado y prendido.
 * Los números salen de las cvars al mostrar el mensaje.
 */

#if defined _csstv_tips_included
	#endinput
#endif
#define _csstv_tips_included

#define TIP_COUNT 9

ConVar g_cvTipsInterval;
Handle g_hTipsTimer;
int g_iTipNext;

void Tips_Init()
{
	g_cvTipsInterval = CreateConVar("csstv_tips_interval", "180", "Segundos entre los consejos de comandos en el chat (0 = nunca).", _, true, 0.0, true, 7200.0);
	g_cvTipsInterval.AddChangeHook(OnTipsIntervalChanged);
	Tips_Schedule();
}

public void OnTipsIntervalChanged(ConVar cv, const char[] oldValue, const char[] newValue)
{
	Tips_Schedule();
}

void Tips_Schedule()
{
	delete g_hTipsTimer;
	float secs = g_cvTipsInterval.FloatValue;
	if (secs > 0.0)
		g_hTipsTimer = CreateTimer(secs, Timer_Tips, _, TIMER_REPEAT);
}

public Action Timer_Tips(Handle timer)
{
	char msg[256];
	for (int tries = 0; tries < TIP_COUNT; tries++)
	{
		int tip = g_iTipNext;
		g_iTipNext = (g_iTipNext + 1) % TIP_COUNT;
		if (Tips_Build(tip, msg, sizeof(msg)))
		{
			QolChatAll("%s %s", PREFIX, msg);
			break;
		}
	}
	return Plugin_Continue;
}

/** El mensaje del consejo, o false si ahora no aplica. */
bool Tips_Build(int tip, char[] msg, int len)
{
	bool warmup = g_State == State_Warmup;
	bool live = g_State == State_Live || g_State == State_Halftime;
	switch (tip)
	{
		case 0:
		{
			int window;
			if (!Tips_PluginOn("csstv_sell.smx", "csstv_sell") || !Tips_CvarInt("csstv_sell_window", window))
				return false;
			char until[48] = "hasta el fin del freezetime";
			if (window > 0)
				Format(until, sizeof(until), "hasta %d s después del freezetime", window);
			Format(msg, len, "¿Compraste mal? Escribe {#amarillo}!sell{#normal} para vender lo que compraste en la ronda, %s. {#amarillo}!sell all{#normal} vende todo.", until);
		}
		case 1:
		{
			int mode = g_cvPauseMode.IntValue;
			if (!live || mode == PAUSE_OFF)
				return false;
			int max = g_cvPauseMax.IntValue, secs = g_cvPauseTime.IntValue;
			char rules[48], end[160];
			if (mode == PAUSE_UNTIL)
				Format(rules, sizeof(rules), "%d por partida", max);
			else
				Format(rules, sizeof(rules), "%d por partida, de %d s", max, secs);
			if (mode == PAUSE_TIMED)
				strcopy(end, sizeof(end), "Empieza en la próxima ronda.");
			else if (mode == PAUSE_UNTIL)
				strcopy(end, sizeof(end), "Empieza en la próxima ronda y termina cuando los dos equipos escriben {#amarillo}!unpause{#normal}.");
			else
				strcopy(end, sizeof(end), "Empieza en la próxima ronda y termina antes si los dos equipos escriben {#amarillo}!unpause{#normal}.");
			Format(msg, len, "{#amarillo}!pause{#normal} pide una pausa táctica para tu equipo (%s). %s", rules, end);
		}
		case 2:
		{
			if (!Tips_PluginOn("csstv_calladmin.smx", "csstv_calladmin_enabled"))
				return false;
			strcopy(msg, len, "¿Alguien hace trampa o molesta? Escribe {#amarillo}!calladmin <motivo>{#normal} para avisar a los moderadores en Discord. Sin motivo se abre un menú.");
		}
		case 3:
		{
			int diff = g_cvGgMinDiff.IntValue, missing = g_cvGgMissing.IntValue;
			if (!live || diff <= 0)
				return false;
			char votes[48] = "de todo el equipo";
			if (missing == 1)
				strcopy(votes, sizeof(votes), "de todo el equipo menos uno");
			else if (missing > 1)
				Format(votes, sizeof(votes), "de todo el equipo menos %d", missing);
			Format(msg, len, "¿Van perdiendo por %d %s o más? Escribe {#amarillo}!gg{#normal} para votar la rendición: hacen falta los votos %s.",
				diff, diff == 1 ? "ronda" : "rondas", votes);
		}
		case 4:
		{
			if (!g_cvHpOnDeath.BoolValue)
				return false;
			strcopy(msg, len, "Escribe {#amarillo}!hp{#normal} para ver quién te mató en la ronda y cuánta vida le queda.");
		}
		case 5:
		{
			if (!warmup || !g_cvRtv.BoolValue)
				return false;
			strcopy(msg, len, "En el calentamiento: {#amarillo}!rtv{#normal} pide cambiar de mapa y {#amarillo}!nominate <mapa>{#normal} vota uno ({#amarillo}!mapas{#normal} muestra la lista).");
		}
		case 6:
		{
			if (!warmup || !g_cvReadySystem.BoolValue)
				return false;
			strcopy(msg, len, "Escribe {#amarillo}!ready{#normal} cuando estés listo para empezar la partida ({#amarillo}!unready{#normal} lo quita).");
		}
		case 7:
			strcopy(msg, len, "{#amarillo}!score{#normal} muestra el marcador y {#amarillo}!status{#normal} cómo está configurada la partida.");
		case 8:
			Format(msg, len, "Únete a nuestro Discord: {#amarillo}%s", DISCORD_INVITE);
		default:
			return false;
	}
	return true;
}

/** Otro plugin (csstv_sell, csstv_calladmin) corriendo y prendido. Su cvar sola no alcanza: queda después de descargarlo. */
bool Tips_PluginOn(const char[] file, const char[] enabledCvar)
{
	Handle plugin = FindPluginByFile(file);
	int on;
	return plugin != null && GetPluginStatus(plugin) == Plugin_Running && Tips_CvarInt(enabledCvar, on) && on != 0;
}

bool Tips_CvarInt(const char[] name, int &value)
{
	ConVar cv = FindConVar(name);
	if (cv == null)
		return false;
	value = cv.IntValue;
	return true;
}
