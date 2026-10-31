// CMLeague Anticheat: tipos y funciones compartidas.
#pragma once
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <windows.h>
#include <string>
#include <thread>
#include <vector>

#define AC_VERSION L"0.3.0"
#define AC_NAME L"CMLeague Anticheat"

enum class Screen { Consent, Unlinked, Linking, Ready, Session, Offline };

struct UiState {
    Screen screen = Screen::Consent;
    std::wstring userCode;      // Vinculando: el código que el jugador ve también en la web
    std::wstring detail;        // Último aviso para el jugador
    bool linked = false;
    bool online = false;
    bool gameOpen = false;
    bool session = false;
};

// ---------- ui.cpp ----------
struct Hit { RECT r; int id; };
enum ButtonId { BtnNone = 0, BtnPrimary, BtnSecondary, BtnClose, BtnMinimize };
constexpr int kWidth = 420, kHeight = 600, kTitleBar = 56;

void UiInit();
void UiShutdown();
void UiPaint(HDC dc, const UiState& s, float scale, int hover);
int UiHitTest(const UiState& s, int x, int y);
bool UiRenderPng(const UiState& s, const wchar_t* path);
HICON UiMakeIcon(int size);
bool UiEncodeJpeg(const BYTE* bgra, int w, int h, int stride, int quality, std::vector<BYTE>& out);

// ---------- net.cpp ----------
struct HttpResult { int status = 0; std::string body; };
HttpResult HttpSend(const std::wstring& base, const wchar_t* path, const std::string& body, const wchar_t* contentType, const std::wstring& agentToken = L"", const std::wstring& extraHeaders = L"");
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
    std::wstring gameTitle = L"CS:S v34 ClientMod";
    int minWidth = 640;              // Minimizada, o el launcher chico, no es el juego
    bool ignoreForeground = false;   // Solo en la versión de pruebas
    int everySeconds = 0;            // Solo en la versión de pruebas
};
void EvidenceStart(const std::wstring& api, const EvidenceOptions& opt);
void EvidenceUpdate(const std::wstring& session, int minS, int maxS, const std::vector<std::wstring>& requests);
void EvidenceStop();
void EvidenceForget();  // Desvinculado: lo pendiente, la cadena y la clave ya no sirven

// ---------- main.cpp ----------
void AcNotice(const wchar_t* text);
