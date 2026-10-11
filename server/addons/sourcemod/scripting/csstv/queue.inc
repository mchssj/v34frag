/**
 * Cola local de resultados.
 *   data/csstv/queue/<uid>.json   pendientes de envío
 *   data/csstv/sent/<uid>.json    enviados (se conservan como respaldo)
 *   data/csstv/failed/<uid>.json  rechazados por la API (token o datos inválidos)
 */

#if defined _csstv_queue_included
	#endinput
#endif
#define _csstv_queue_included

char g_sQueueDir[PLATFORM_MAX_PATH];
char g_sSentDir[PLATFORM_MAX_PATH];
char g_sFailedDir[PLATFORM_MAX_PATH];

void Queue_Init()
{
	BuildPath(Path_SM, g_sQueueDir, sizeof(g_sQueueDir), "data/csstv/queue");
	BuildPath(Path_SM, g_sSentDir, sizeof(g_sSentDir), "data/csstv/sent");
	BuildPath(Path_SM, g_sFailedDir, sizeof(g_sFailedDir), "data/csstv/failed");
	Queue_EnsureDirs();
}

void Queue_EnsureDirs()
{
	char base[PLATFORM_MAX_PATH];
	BuildPath(Path_SM, base, sizeof(base), "data/csstv");
	int mode = FPERM_U_READ | FPERM_U_WRITE | FPERM_U_EXEC | FPERM_G_READ | FPERM_G_EXEC | FPERM_O_READ | FPERM_O_EXEC;
	if (!DirExists(base)) CreateDirectory(base, mode);
	if (!DirExists(g_sQueueDir)) CreateDirectory(g_sQueueDir, mode);
	if (!DirExists(g_sSentDir)) CreateDirectory(g_sSentDir, mode);
	if (!DirExists(g_sFailedDir)) CreateDirectory(g_sFailedDir, mode);
}

/** Guarda g_sJson como <uid>.json en la cola. */
bool Queue_Save(const char[] uid)
{
	Queue_EnsureDirs();
	char path[PLATFORM_MAX_PATH], tmp[PLATFORM_MAX_PATH];
	Format(path, sizeof(path), "%s/%s.json", g_sQueueDir, uid);
	Format(tmp, sizeof(tmp), "%s/%s.tmp", g_sQueueDir, uid);
	File f = OpenFile(tmp, "wb");
	if (f == null)
		return false;
	bool ok = f.WriteString(g_sJson, false);
	delete f;
	if (!ok)
		return false;
	// Se escribe en .tmp y se renombra, así el uploader externo nunca lee un archivo a medias.
	return RenameFile(path, tmp);
}

/** Busca el primer .json pendiente. Devuelve false si la cola está vacía. */
bool Queue_Next(char[] uid, int maxlen)
{
	DirectoryListing dir = OpenDirectory(g_sQueueDir);
	if (dir == null)
		return false;
	char name[PLATFORM_MAX_PATH];
	FileType type;
	bool found = false;
	while (dir.GetNext(name, sizeof(name), type))
	{
		int len = strlen(name);
		if (type != FileType_File || len <= 5 || !StrEqual(name[len - 5], ".json", false))
			continue;
		name[len - 5] = '\0';
		strcopy(uid, maxlen, name);
		found = true;
		break;
	}
	delete dir;
	return found;
}

/** Carga <uid>.json en g_sJson. */
bool Queue_Load(const char[] uid)
{
	char path[PLATFORM_MAX_PATH];
	Format(path, sizeof(path), "%s/%s.json", g_sQueueDir, uid);
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

void Queue_Move(const char[] uid, bool failed)
{
	char from[PLATFORM_MAX_PATH], to[PLATFORM_MAX_PATH];
	Format(from, sizeof(from), "%s/%s.json", g_sQueueDir, uid);
	Format(to, sizeof(to), "%s/%s.json", failed ? g_sFailedDir : g_sSentDir, uid);
	if (FileExists(to))
		DeleteFile(to);
	if (!RenameFile(to, from))
		DeleteFile(from);
}

int Queue_Count(bool failed)
{
	DirectoryListing dir = OpenDirectory(failed ? g_sFailedDir : g_sQueueDir);
	if (dir == null)
		return 0;
	char name[PLATFORM_MAX_PATH];
	FileType type;
	int n;
	while (dir.GetNext(name, sizeof(name), type))
	{
		int len = strlen(name);
		if (type == FileType_File && len > 5 && StrEqual(name[len - 5], ".json", false))
			n++;
	}
	delete dir;
	return n;
}

int Queue_RequeueFailed()
{
	DirectoryListing dir = OpenDirectory(g_sFailedDir);
	if (dir == null)
		return 0;
	char name[PLATFORM_MAX_PATH], from[PLATFORM_MAX_PATH], to[PLATFORM_MAX_PATH];
	FileType type;
	int n;
	while (dir.GetNext(name, sizeof(name), type))
	{
		int len = strlen(name);
		if (type != FileType_File || len <= 5 || !StrEqual(name[len - 5], ".json", false))
			continue;
		Format(from, sizeof(from), "%s/%s", g_sFailedDir, name);
		Format(to, sizeof(to), "%s/%s", g_sQueueDir, name);
		if (RenameFile(to, from))
			n++;
	}
	delete dir;
	return n;
}
