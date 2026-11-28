// CMLeague Anticheat: tipos y funciones compartidas.
#pragma once
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <memory>
#include <string>
#include <thread>
#include <vector>

#define AC_VERSION L"0.6.0"
#define AC_NAME L"CMLeague Anticheat"

enum class Screen { Consent, Unlinked, Linking, Ready, Session, Offline };

struct UiState {
    Screen screen = Screen::Consent;
    std::wstring userCode;      // Vinculando: el código que el jugador ve también en la web
    std::wstring detail;        // Último aviso para el jugador
    bool linked = false;
    bool online = false;
    bool gameOpen = false;      // Hay un CMLauncher.exe abierto
    bool hl2Open = false;       // Hay un hl2.exe abierto: el servidor expulsa. No se muestra
    bool eacOn = false;         // El juego se abrió con el EAC de ClientMod: está prohibido y sí se le dice (AC-6, replanteo 160)
    bool session = false;
    // Perfil de la cuenta vinculada y servidor de la sesión, del latido (replanteo 156)
    std::wstring nick, memberSince, serverName;
    std::shared_ptr<const std::vector<BYTE>> avatar;  // La foto tal como vino (jpg, png o gif; GDI+ no lee webp)
};

// El juego es CMLauncher.exe. Un hl2.exe abierto (un emulador de ClientMod, o el CS:S de Steam) expulsa
// (docs/bitacora/2026-11-27-anticheat-ver-el-juego).
// El EAC de ClientMod está prohibido (docs/bitacora/2026-11-27-anticheat-sin-eac): eac dice si está prendido y eacWhy por qué
// (parent, ini, service o denied). Con eac, el agente no lee nada de dentro del juego.
struct GameState {
    bool clientmod = false; bool hl2 = false; DWORD pid = 0;
    std::wstring dir;            // Carpeta de CMLauncher.exe, con su clientmod.ini. Vacía si Windows no dejó leer la ruta
    bool eac = false; const char* eacWhy = nullptr;
    bool eacService = false;     // El servicio EasyAntiCheat_EOS está corriendo (solo para --detect y para confirmar)
};

// ---------- ui.cpp ----------
struct Hit { RECT r; int id; };
enum ButtonId { BtnNone = 0, BtnPrimary, BtnSecondary, BtnClose, BtnMinimize, BtnLink };
constexpr int kWidth = 460, kHeight = 320, kTitleBar = 40;

void UiInit();
void UiShutdown();
void UiPaint(HDC dc, const UiState& s, float scale, int hover);
int UiHitTest(const UiState& s, int x, int y);
bool UiRenderPng(const UiState& s, const wchar_t* path);
HICON UiMakeIcon(int size);
bool UiEncodeJpeg(const BYTE* bgra, int w, int h, int stride, int quality, std::vector<BYTE>& out, int* outW = nullptr, int* outH = nullptr);

// ---------- net.cpp ----------
struct HttpResult { int status = 0; std::string body; };
HttpResult HttpSend(const std::wstring& base, const wchar_t* path, const std::string& body, const wchar_t* contentType, const std::wstring& agentToken = L"", const std::wstring& extraHeaders = L"");
HttpResult HttpGet(const std::wstring& url, size_t maxBytes = 2 * 1024 * 1024);
HttpResult HttpPost(const std::wstring& base, const wchar_t* path, const std::string& json, const std::wstring& agentToken = L"");
std::vector<std::string> JsonStrings(const std::string& body, const char* key);
int JsonInt(const std::string& body, const char* key);
std::string JsonStr(const std::string& body, const char* key);
bool JsonIsNull(const std::string& body, const char* key);
std::string JsonEscape(const std::wstring& s);
std::wstring Widen(const std::string& s);

// ---------- store.cpp ----------
std::wstring InstallDir();
void SetDataDir(const std::wstring& dir);
std::wstring DataDir();
void Log(const std::wstring& line);
bool SaveSecret(const wchar_t* name, const std::string& value);
std::string LoadSecret(const wchar_t* name);
void DeleteSecret(const wchar_t* name);
bool ConsentGiven();
void SaveConsent();
bool Install(std::wstring* installedExe);
void Uninstall();

// ---------- evidence.cpp ----------
struct EvidenceOptions {
    std::wstring gameTitle;          // Solo en la versión de pruebas: capturar una ventana por título y no la de CMLauncher.exe
    int minWidth = 640;              // Minimizada, o el launcher chico, no es el juego
    bool ignoreForeground = false;   // Solo en la versión de pruebas
    int everySeconds = 0;            // Solo en la versión de pruebas
};
void EvidenceStart(const std::wstring& api, const EvidenceOptions& opt);
void EvidenceUpdate(const std::wstring& session, int minS, int maxS, const std::vector<std::wstring>& requests);
void EvidenceStop();
void EvidenceForget();  // Desvinculado: lo pendiente, la cadena y la clave ya no sirven
GameState GameScan();   // Solo nombres de proceso: no guarda ni envía la lista
std::wstring FileSha256(const std::wstring& path);
std::wstring TextSha256(const std::string& data);
std::string SignText(const std::string& text);  // ECDSA P-256 con la clave del equipo, en base64; vacío si falla
bool EvidenceEnsureKey(const std::wstring& token);  // Registra la clave del equipo una vez por vinculación

// Lo que se puede cambiar desde el panel sin sacar otra versión (ac_config.agent_config, replanteo 157).
struct AgentConfig {
    bool handles = true, overlays = true, drivers = true, gameFiles = true;
    int handlesEvery = 10, overlaysEvery = 5, modulesEvery = 5;
    std::vector<std::wstring> files;  // Archivos del juego a revisar, relativos a la carpeta de CMLauncher.exe
};
void EvidenceConfigure(const AgentConfig& c);
AgentConfig EvidenceCurrentConfig();

// ---------- detect.cpp ----------
// Hallazgos que van como eventos de la sesión (replanteo 157). detail: un objeto JSON ya armado.
struct DetectItem { DWORD pid = 0; std::wstring name, path, note, key; std::string detail; };
std::vector<DetectItem> DetectHandles(DWORD gamePid);    // Procesos con permiso de leer o escribir la memoria del juego
std::vector<DetectItem> DetectOverlays(DWORD gamePid);   // Ventanas transparentes de otros procesos encima del juego
std::vector<DetectItem> DetectDrivers();                 // Drivers cargados
std::vector<DetectItem> DetectGameFiles(DWORD gamePid, const std::vector<std::wstring>& files);
std::vector<int> GamePorts(DWORD gamePid);               // Puertos UDP locales del juego
std::string MachineIds();                                // Identificadores de la máquina, en JSON (la API los pasa por HMAC)
std::wstring ProcessPath(DWORD pid);

// ---------- main.cpp ----------
void AcNotice(const wchar_t* text);
