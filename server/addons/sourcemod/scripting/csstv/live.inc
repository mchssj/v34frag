/**
 * Mixes en vivo.
 *   data/csstv/live/<uid>.json   última foto del mix en curso
 *
 * Al final de cada ronda se guarda una foto del mix (el mismo JSON del resultado, con
 * "status":"live" y "live_seq") y se manda a la web, que la muestra en la lista de mixes.
 * La cola manda primero los resultados finales; la foto viaja con el uid "<uid>_v<seq>"
 * para que la base no mezcle las partes de dos fotos.
 * Si el servidor se cae o el plugin se recarga con un mix en curso, la foto queda en el disco.
 * Al cargar el plugin pasa a la cola como cancelada por caída ("crash"), y en la web un admin
 * decide si da ELO.
 */

#if defined _csstv_live_included
	#endinput
#endif
#define _csstv_live_included

ConVar g_cvLive;
char g_sLiveDir[PLATFORM_MAX_PATH];
int g_iLiveSeq;          // última foto guardada de la partida actual (0 = ninguna)
int g_iLiveSentSeq;      // última foto que llegó a la web
int g_iLiveSendingSeq;   // foto que se está enviando (0 = se envía un resultado de la cola)
char g_sLiveSendingMatch[64];   // partida de esa foto (puede haber empezado otra mientras se enviaba)

void Live_Init()
{
	g_cvLive = CreateConVar("csstv_live", "1", "Mandar a la web una foto del mix al final de cada ronda (mixes en vivo).", _, true, 0.0, true, 1.0);
	BuildPath(Path_SM, g_sLiveDir, sizeof(g_sLiveDir), "data/csstv/live");
	Live_EnsureDir();
	int n = Live_Recover();
	if (n > 0)
		Http_ScheduleProcess(5.0);
}

void Live_EnsureDir()
{
	Queue_EnsureDirs();
	if (!DirExists(g_sLiveDir))
		CreateDirectory(g_sLiveDir, FPERM_U_READ | FPERM_U_WRITE | FPERM_U_EXEC | FPERM_G_READ | FPERM_G_EXEC | FPERM_O_READ | FPERM_O_EXEC);
}

/** Partida nueva o vuelta al calentamiento. No borra la foto: eso lo hacen el fin y la cancelación. */
void Live_Reset()
{
	g_iLiveSeq = 0;
	g_iLiveSentSeq = 0;
}

/** Después de cada ronda que no termina el mix. */
void Live_Snapshot()
{
	if (!g_cvLive.BoolValue || !g_sMatchUid[0] || CountReportedPlayers() < 2)
		return;
	g_iLiveSeq++;
	Json_BuildPayload(GetTime(), false, "", "", g_iLiveSeq);
	if (!Live_Save(g_sMatchUid))
	{
		LogError("No se pudo guardar la foto en vivo de %s.", g_sMatchUid);
		return;
	}
	Http_ScheduleProcess(1.0);
}

/** El mix terminó o se canceló (su resultado ya está en la cola): la foto ya no hace falta. */
void Live_Discard()
{
	if (g_sMatchUid[0])
	{
		char path[PLATFORM_MAX_PATH];
		Format(path, sizeof(path), "%s/%s.json", g_sLiveDir, g_sMatchUid);
		if (FileExists(path))
			DeleteFile(path);
	}
	Live_Reset();
}

/**
 * Mix cortado por un fin de mapa: su resultado (cancelado por cambio de mapa, ya en g_sJson) se
 * guarda como live/<uid>.mapchange y la foto se conserva. Live_FlushMapChange lo pasa a la cola
 * cuando arranca el mapa siguiente. Si en cambio el servidor se apaga o se reinicia (el panel
 * también termina el mapa), el mapa siguiente nunca arranca y Live_Recover lo trata como caída.
 * Devuelve false si no hay foto (csstv_live 0 o ninguna ronda): entonces se encola como siempre.
 */
bool Live_DeferMapChange()
{
	if (!g_cvLive.BoolValue || !g_iLiveSeq || !g_sMatchUid[0])
		return false;
	char path[PLATFORM_MAX_PATH];
	Format(path, sizeof(path), "%s/%s.json", g_sLiveDir, g_sMatchUid);
	if (!FileExists(path) || !Live_Save(g_sMatchUid, "mapchange"))
		return false;
	LogMessage("Partida %s cortada por fin de mapa (%d-%d): se guarda como cancelada cuando arranque el mapa siguiente.", g_sMatchUid, g_iTotA, g_iTotB);
	return true;
}

/** Al arrancar un mapa: los mixes cortados por el fin del mapa anterior pasan a la cola. */
void Live_FlushMapChange()
{
	DirectoryListing dir = OpenDirectory(g_sLiveDir);
	if (dir == null)
		return;
	ArrayList uids = new ArrayList(ByteCountToCells(PLATFORM_MAX_PATH));
	char name[PLATFORM_MAX_PATH];
	FileType type;
	while (dir.GetNext(name, sizeof(name), type))
	{
		int len = strlen(name);
		if (type != FileType_File || len <= 10 || !StrEqual(name[len - 10], ".mapchange", false))
			continue;
		name[len - 10] = '\0';
		uids.PushString(name);
	}
	delete dir;

	char path[PLATFORM_MAX_PATH];
	for (int i = 0; i < uids.Length; i++)
	{
		uids.GetString(i, name, sizeof(name));
		Format(path, sizeof(path), "%s/%s.mapchange", g_sLiveDir, name);
		if (!Live_Load(path) || !Queue_Save(name))
		{
			LogError("No se pudo pasar a la cola el mix %s cortado por cambio de mapa; queda en live/.", name);
			continue;
		}
		DeleteFile(path);
		Format(path, sizeof(path), "%s/%s.json", g_sLiveDir, name);
		if (FileExists(path))
			DeleteFile(path);
		LogMessage("Partida %s cancelada por cambio de mapa. Resultado guardado en la cola.", name);
	}
	delete uids;
}

/** Guarda g_sJson como live/<uid>.<ext> (se escribe en .tmp y se renombra). */
bool Live_Save(const char[] uid, const char[] ext = "json")
{
	Live_EnsureDir();
	char path[PLATFORM_MAX_PATH], tmp[PLATFORM_MAX_PATH];
	Format(path, sizeof(path), "%s/%s.%s", g_sLiveDir, uid, ext);
	Format(tmp, sizeof(tmp), "%s/%s.tmp", g_sLiveDir, uid);
	File f = OpenFile(tmp, "wb");
	if (f == null)
		return false;
	bool ok = f.WriteString(g_sJson, false);
	delete f;
	if (!ok)
		return false;
	if (FileExists(path))
		DeleteFile(path);
	return RenameFile(path, tmp);
}

bool Live_Load(const char[] path)
{
	File f = OpenFile(path, "rb");
	if (f == null)
		return false;
	int n = ReadFileString(f, g_sJson, JSON_MAX, -1);
	delete f;
	if (n <= 0)
		return false;
	g_iJsonLen = strlen(g_sJson);
	return g_iJsonLen > 0;
}

/**
 * Para la cola de envío: si hay una foto más nueva que la última enviada, la carga en g_sJson
 * y devuelve en sendUid el uid de sus partes ("<uid>_v<seq>").
 */
bool Live_Pending(char[] sendUid, int maxlen)
{
	if (!g_cvLive.BoolValue || !g_sMatchUid[0] || g_iLiveSeq <= g_iLiveSentSeq)
		return false;
	char path[PLATFORM_MAX_PATH];
	Format(path, sizeof(path), "%s/%s.json", g_sLiveDir, g_sMatchUid);
	if (!FileExists(path) || !Live_Load(path))
		return false;
	Format(sendUid, maxlen, "%s_v%d", g_sMatchUid, g_iLiveSeq);
	g_iLiveSendingSeq = g_iLiveSeq;
	strcopy(g_sLiveSendingMatch, sizeof(g_sLiveSendingMatch), g_sMatchUid);
	return true;
}

/** Terminó el envío de una foto. sent = false si la web la rechazó (no se reintenta). */
void Live_OnSent(bool sent, const char[] error = "")
{
	if (!sent)
		LogError("La web rechazó la foto en vivo %d de %s: %s", g_iLiveSendingSeq, g_sLiveSendingMatch, error);
	if (StrEqual(g_sLiveSendingMatch, g_sMatchUid) && g_iLiveSendingSeq > g_iLiveSentSeq)
		g_iLiveSentSeq = g_iLiveSendingSeq;
	g_iLiveSendingSeq = 0;
}

/**
 * Al cargar el plugin no hay ningún mix en curso: cada foto que quedó es de un mix cortado por una
 * caída o una recarga. Pasa a la cola como cancelada por "crash", salvo que su resultado ya esté
 * guardado (la caída fue justo después de terminar). Devuelve cuántas pasaron a la cola.
 */
int Live_Recover()
{
	DirectoryListing dir = OpenDirectory(g_sLiveDir);
	if (dir == null)
		return 0;
	ArrayList uids = new ArrayList(ByteCountToCells(PLATFORM_MAX_PATH));
	char name[PLATFORM_MAX_PATH];
	FileType type;
	while (dir.GetNext(name, sizeof(name), type))
	{
		int len = strlen(name);
		if (type != FileType_File || len <= 5 || !StrEqual(name[len - 5], ".json", false))
			continue;
		name[len - 5] = '\0';
		uids.PushString(name);
	}
	delete dir;

	char path[PLATFORM_MAX_PATH], other[PLATFORM_MAX_PATH];
	int n;
	for (int i = 0; i < uids.Length; i++)
	{
		uids.GetString(i, name, sizeof(name));
		Format(path, sizeof(path), "%s/%s.json", g_sLiveDir, name);
		// Cancelado por fin de mapa pero el mapa siguiente nunca arrancó: el servidor se apagó o se
		// reinició en el medio (el panel también termina el mapa). Cuenta como caída.
		Format(other, sizeof(other), "%s/%s.mapchange", g_sLiveDir, name);
		if (FileExists(other))
			DeleteFile(other);
		Format(other, sizeof(other), "%s/%s.json", g_sQueueDir, name);
		bool saved = FileExists(other);
		Format(other, sizeof(other), "%s/%s.json", g_sSentDir, name);
		saved = saved || FileExists(other);
		Format(other, sizeof(other), "%s/%s.json", g_sFailedDir, name);
		saved = saved || FileExists(other);
		if (saved)
		{
			DeleteFile(path);
			continue;
		}
		if (!Live_Load(path)
			|| ReplaceString(g_sJson, JSON_MAX, "\"status\":\"live\"", "\"status\":\"cancelled\",\"cancel_reason\":\"crash\",\"cancelled_by\":\"\"") != 1)
		{
			LogError("La foto en vivo %s no se pudo leer: se descarta.", name);
			DeleteFile(path);
			continue;
		}
		g_iJsonLen = strlen(g_sJson);
		if (!Queue_Save(name))
		{
			LogError("No se pudo pasar a la cola el mix interrumpido %s; la foto queda en live/.", name);
			continue;
		}
		DeleteFile(path);
		LogMessage("Partida %s interrumpida (caída o reinicio del servidor, o recarga del plugin): se guarda como cancelada con la última ronda jugada.", name);
		n++;
	}
	delete uids;
	Live_FlushMapChange();   // un .mapchange sin foto no debería quedar, pero si queda es un resultado válido
	return n;
}

/** Línea de sm_csstv_status. */
void Live_StatusText(char[] text, int maxlen)
{
	if (!g_cvLive.BoolValue)
		strcopy(text, maxlen, "apagadas (csstv_live 0)");
	else if (!g_iLiveSeq)
		strcopy(text, maxlen, "activadas · sin foto de esta partida");
	else
		Format(text, maxlen, "activadas · foto %d (enviada: %d)", g_iLiveSeq, g_iLiveSentSeq);
}
