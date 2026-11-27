// CMLeague Anticheat: ventana, bandeja y trabajo en segundo plano (vincular, latido cada 30 s, ver si están CMLauncher.exe y hl2.exe).
// Opciones: --install --uninstall --silent --portable --render <pantalla> <png>
// Solo en la versión de pruebas (AC_TEST): --api --data-dir --no-browser --auto-link --beat --capture-title --capture-no-foreground --capture-every
#include "core.h"
#include "obf.h"
#include <winhttp.h>
#include <ctime>
#include <algorithm>
#include <objbase.h>
#include <shellapi.h>
#include <tlhelp32.h>
#include <windowsx.h>
#include <mutex>
#include <thread>
#include <vector>

#pragma comment(lib, "winhttp")
#pragma comment(lib, "gdiplus")
#pragma comment(lib, "crypt32")
#pragma comment(lib, "shell32")
#pragma comment(lib, "ole32")
#pragma comment(lib, "user32")
#pragma comment(lib, "gdi32")
#pragma comment(lib, "advapi32")

#define WM_STATE (WM_APP + 1)
#define WM_TRAY (WM_APP + 2)

static HWND g_wnd;
static std::mutex g_mu;
static UiState g_state;
static std::wstring g_api = L"https://api.cmleague.lat", g_verifyUrl;
static bool g_noBrowser = false;
static DWORD g_beatMs = 30000;
static EvidenceOptions g_evidence;
static HANDLE g_wake, g_quit;
static bool g_wantLink = false, g_cancelLink = false, g_wantUnlink = false;
static int g_hover = BtnNone;
static float g_scale = 1.f;
static NOTIFYICONDATAW g_tray{};

template <class F>
static void Update(F f) {
    {
        std::lock_guard<std::mutex> l(g_mu);
        f(g_state);
    }
    if (g_wnd) PostMessageW(g_wnd, WM_STATE, 0, 0);
}

// Espera; true si hay que salir. El evento despierta antes si el jugador tocó algo.
static bool Sleep_(DWORD ms) {
    HANDLE h[] = {g_quit, g_wake};
    return WaitForMultipleObjects(2, h, FALSE, ms) == WAIT_OBJECT_0;
}

static void OpenWeb(const std::wstring& url) {
    if (g_noBrowser || (url.rfind(L"https://", 0) != 0 && url.rfind(L"http://", 0) != 0)) return;
    ShellExecuteW(nullptr, L"open", url.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
}

void AcNotice(const wchar_t* text) {
    std::wstring t = text;
    Update([&](UiState& s) { s.detail = t; });
    NOTIFYICONDATAW n = g_tray;
    n.uFlags = NIF_INFO;
    wcscpy_s(n.szInfoTitle, AC_NAME);
    wcsncpy_s(n.szInfo, text, _TRUNCATE);
    Shell_NotifyIconW(NIM_MODIFY, &n);
}

static std::wstring g_avatarUrl;

static void Forget() {
    EvidenceUpdate(L"", 0, 0, {});
    EvidenceForget();
    DeleteSecret(L"access");
    DeleteSecret(L"refresh");
    g_avatarUrl.clear();
    Update([](UiState& s) {
        s.linked = s.online = s.session = false;
        s.screen = Screen::Unlinked;
        s.userCode.clear();
        s.nick.clear();
        s.memberSince.clear();
        s.serverName.clear();
        s.avatar.reset();
    });
}

// "2026-03-10T…" → "Miembro desde el 10 de marzo de 2026".
static std::wstring MemberSince(const std::string& iso) {
    static const wchar_t* kMonths[] = {L"enero", L"febrero", L"marzo", L"abril", L"mayo", L"junio", L"julio", L"agosto", L"septiembre", L"octubre", L"noviembre", L"diciembre"};
    int y = 0, m = 0, d = 0;
    if (sscanf_s(iso.c_str(), "%d-%d-%d", &y, &m, &d) != 3 || m < 1 || m > 12) return {};
    return L"Miembro desde el " + std::to_wstring(d) + L" de " + kMonths[m - 1] + L" de " + std::to_wstring(y);
}

// Perfil y servidor del latido. La foto se baja solo cuando cambia.
static void ApplyProfile(const std::string& body) {
    std::wstring nick = Widen(JsonStr(body, "nick")), since = MemberSince(JsonStr(body, "member_since"));
    std::wstring server = Widen(JsonStr(body, "server_name")), url = Widen(JsonStr(body, "avatar_url"));
    bool newAvatar = url != g_avatarUrl;
    std::shared_ptr<const std::vector<BYTE>> img;
    if (newAvatar) {
        g_avatarUrl = url;
        if (!url.empty()) {
            auto a = HttpGet(url);
            if (a.status == 200 && !a.body.empty()) img = std::make_shared<const std::vector<BYTE>>(a.body.begin(), a.body.end());
            else Log(L"foto del perfil: la descarga respondió " + std::to_wstring(a.status));
        }
    }
    Update([&](UiState& s) {
        s.nick = nick;
        s.memberSince = since;
        s.serverName = server;
        if (newAvatar) s.avatar = img;
    });
}

static std::string VersionField() { return JsonEscape(AC_VERSION); }

static std::wstring g_selfSha;  // Hash del propio .exe, en cada latido (replanteo 156)

// X-AC-Ts y X-AC-Sig: la firma del latido con la clave del equipo, sobre "v1|hb|<unix>|<sha256 del token>".
static std::wstring SignedHeaders(const std::wstring& token) {
    long long ts = (long long)time(nullptr);
    std::string text = "v1|hb|" + std::to_string(ts) + "|" + JsonEscape(TextSha256(JsonEscape(token)));
    std::string sig = SignText(text);
    if (sig.empty()) return {};
    return L"X-AC-Ts: " + std::to_wstring(ts) + L"\r\nX-AC-Sig: " + Widen(sig) + L"\r\n";
}

static bool JsonBool(const std::string& body, const char* key, bool def) {
    std::string k = std::string("\"") + key + "\"";
    size_t p = body.find(k);
    if (p == std::string::npos) return def;
    p = body.find(':', p + k.size());
    if (p == std::string::npos) return def;
    size_t v = body.find_first_not_of(" \t\r\n", p + 1);
    if (v == std::string::npos) return def;
    if (body.compare(v, 4, "true") == 0) return true;
    if (body.compare(v, 5, "false") == 0) return false;
    return def;
}

// Configuración remota (ac_config.agent_config): qué revisa y cada cuánto. Lo que no viene, queda como estaba.
static void ApplyConfig(const std::string& body) {
    if (body.find("\"config\"") == std::string::npos) return;
    AgentConfig c = EvidenceCurrentConfig();
    c.handles = JsonBool(body, "handles", c.handles);
    c.overlays = JsonBool(body, "overlays", c.overlays);
    c.drivers = JsonBool(body, "drivers", c.drivers);
    c.gameFiles = JsonBool(body, "game_files", c.gameFiles);
    if (int v = JsonInt(body, "handles_every")) c.handlesEvery = v;
    if (int v = JsonInt(body, "overlays_every")) c.overlaysEvery = v;
    if (int v = JsonInt(body, "modules_every")) c.modulesEvery = v;
    auto files = JsonStrings(body, "files");
    if (!files.empty()) {
        c.files.clear();
        for (const auto& f : files) c.files.push_back(Widen(f));
    }
    EvidenceConfigure(c);
}

// Actualización automática, fuera de una sesión: baja la versión nueva de cmleague.lat, comprueba el SHA-256 y se reemplaza.
static void TryUpdate(const std::string& body, bool inSession) {
    static std::string tried;
    std::string version = JsonStr(body, "update_version"), sha = JsonStr(body, "update_sha256");
    std::wstring url = Widen(JsonStr(body, "update_url"));
    if (version.empty() || sha.size() != 64 || url.empty() || inSession || version == tried) return;
    tried = version;
    URL_COMPONENTS u{};
    u.dwStructSize = sizeof(u);
    wchar_t host[256];
    u.lpszHostName = host;
    u.dwHostNameLength = 256;
    std::wstring h = WinHttpCrackUrl(url.c_str(), 0, 0, &u) ? std::wstring(host) : L"";
    std::wstring suffix = OBF(L"cmleague.lat");
    bool ours = h == suffix || (h.size() > suffix.size() && h.compare(h.size() - suffix.size() - 1, std::wstring::npos, L"." + suffix) == 0);
    if (u.nScheme != INTERNET_SCHEME_HTTPS || !ours) { Log(L"actualización rechazada: no es de cmleague.lat"); return; }
    wchar_t self[MAX_PATH];
    GetModuleFileNameW(nullptr, self, MAX_PATH);
    if (_wcsicmp(self, (InstallDir() + L"\\CMLeagueAC.exe").c_str()) != 0) return;  // Solo la instalada se reemplaza
    auto r = HttpGet(url, 16 * 1024 * 1024);
    if (r.status != 200 || r.body.empty()) { Log(L"actualización: la descarga respondió " + std::to_wstring(r.status)); return; }
    if (JsonEscape(TextSha256(r.body)) != sha) { Log(L"actualización rechazada: el SHA-256 no coincide"); return; }
    std::wstring next = InstallDir() + L"\\CMLeagueAC.new.exe", old = InstallDir() + L"\\CMLeagueAC.old.exe";
    HANDLE f = CreateFileW(next.c_str(), GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, 0, nullptr);
    if (f == INVALID_HANDLE_VALUE) return;
    DWORD w = 0;
    BOOL ok = WriteFile(f, r.body.data(), (DWORD)r.body.size(), &w, nullptr) && w == r.body.size();
    CloseHandle(f);
    // Un .exe en uso se puede renombrar, no pisar.
    if (!ok || !MoveFileExW(self, old.c_str(), MOVEFILE_REPLACE_EXISTING)) { DeleteFileW(next.c_str()); return; }
    if (!MoveFileExW(next.c_str(), self, MOVEFILE_REPLACE_EXISTING)) { MoveFileExW(old.c_str(), self, MOVEFILE_REPLACE_EXISTING); return; }
    Log(L"actualizado a " + Widen(version) + L": se reinicia");
    ShellExecuteW(nullptr, L"open", self, nullptr, nullptr, SW_SHOWNORMAL);
    PostMessageW(g_wnd, WM_CLOSE, 0, 0);
}

static bool RunLink() {
    wchar_t name[64] = L"PC";
    DWORD len = 64;
    GetComputerNameW(name, &len);
    Update([](UiState& s) { s.detail.clear(); });
    auto r = HttpPost(g_api, OBF(L"/api/v1/anticheat/link").c_str(),
                      "{\"device_name\":\"" + JsonEscape(name) + "\",\"agent_version\":\"" + VersionField() + "\",\"hw\":" + MachineIds() + "}");
    if (r.status != 201) {
        Log(L"vincular: la API respondió " + std::to_wstring(r.status));
        Update([&](UiState& s) {
            s.screen = Screen::Unlinked;
            s.detail = r.status == 0     ? L"No se pudo conectar con CMLeague. Prueba de nuevo."
                       : r.status == 403 ? L"No se puede usar CMLeague Anticheat en este equipo (AC-5)."
                                         : L"El servicio no está disponible ahora.";
        });
        return false;
    }
    std::string device = JsonStr(r.body, "device_code");
    std::wstring code = Widen(JsonStr(r.body, "user_code"));
    {
        std::lock_guard<std::mutex> l(g_mu);
        g_verifyUrl = Widen(JsonStr(r.body, "verification_url"));
    }
    Log(L"vinculación iniciada, código " + code);
    Update([&](UiState& s) { s.screen = Screen::Linking; s.userCode = code; });
    OpenWeb(g_verifyUrl);

    for (;;) {
        if (Sleep_(5000)) return false;
        if (g_cancelLink) { g_cancelLink = false; Update([](UiState& s) { s.screen = Screen::Unlinked; s.userCode.clear(); }); return false; }
        auto c = HttpPost(g_api, L"/api/v1/anticheat/link/claim", "{\"device_code\":\"" + device + "\"}");
        if (c.status != 200) continue;  // Se reintenta hasta que venza
        std::string st = JsonStr(c.body, "status");
        if (st == "approved") {
            SaveSecret(L"access", JsonStr(c.body, "access_token"));
            SaveSecret(L"refresh", JsonStr(c.body, "refresh_token"));
            Log(L"cuenta vinculada");
            Update([](UiState& s) { s.linked = true; s.online = true; s.screen = Screen::Ready; s.userCode.clear(); });
            return true;
        }
        if (st == "expired") {
            Update([](UiState& s) { s.screen = Screen::Unlinked; s.userCode.clear(); s.detail = L"El código venció. Vuelve a vincular."; });
            return false;
        }
    }
}

// true si quedó con tokens nuevos.
static bool Refresh() {
    auto r = HttpPost(g_api, L"/api/v1/anticheat/token", "{\"refresh_token\":\"" + LoadSecret(L"refresh") + "\"}");
    if (r.status == 200) {
        SaveSecret(L"access", JsonStr(r.body, "access_token"));
        SaveSecret(L"refresh", JsonStr(r.body, "refresh_token"));
        return true;
    }
    if (r.status == 401) {
        Log(L"tokens rechazados: hay que volver a vincular");
        Forget();
    }
    return false;
}

static void Worker() {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    bool wasSession = false;
    for (;;) {
        bool consent = false;
        {
            std::lock_guard<std::mutex> l(g_mu);
            consent = g_state.screen != Screen::Consent;
        }
        if (!consent) {
            if (Sleep_(INFINITE)) return;
            continue;
        }
        GameState game = GameScan();
        // Al jugador no se le muestra qué ve el agente (Kyan, 2026-11-27): solo se informa a la API.
        Update([&](UiState& s) { s.gameOpen = game.clientmod; s.hl2Open = game.hl2; });

        if (g_wantUnlink) {
            g_wantUnlink = false;
            // Se revoca en el servidor; sin red, igual se olvida acá y el token vence solo.
            auto u = HttpPost(g_api, L"/api/v1/anticheat/unlink", "{}", Widen(LoadSecret(L"access")));
            Log(L"equipo desvinculado, la API respondió " + std::to_wstring(u.status));
            Forget();
            wasSession = false;
        }
        if (LoadSecret(L"access").empty()) {
            if (g_wantLink) {
                g_wantLink = false;
                RunLink();
                continue;
            }
            if (Sleep_(5000)) return;
            continue;
        }

        std::wstring token = Widen(LoadSecret(L"access"));
        EvidenceEnsureKey(token);  // La clave va antes del primer latido firmado (replanteo 156)
        std::string ports;
        for (int p : GamePorts(game.pid)) ports += (ports.empty() ? "" : ",") + std::to_string(p);
        std::string beat = "{\"agent_version\":\"" + VersionField() + "\",\"game\":{\"clientmod\":" + (game.clientmod ? "true" : "false") +
                           ",\"hl2\":" + (game.hl2 ? "true" : "false") + ",\"ports\":[" + ports + "]}" +
                           (g_selfSha.empty() ? "" : ",\"agent_sha\":\"" + JsonEscape(g_selfSha) + "\"") + ",\"hw\":" + MachineIds() + "}";
        auto r = HttpSend(g_api, OBF(L"/api/v1/anticheat/heartbeat").c_str(), beat, L"application/json", token, SignedHeaders(token));
        if (r.status == 401) {
            // Una firma rechazada no se arregla renovando el token: se reintenta en el próximo latido.
            if (r.body.find("firma") == std::string::npos) {
                if (Refresh()) continue;
                if (LoadSecret(L"access").empty()) continue;
            } else {
                Log(L"latido: firma rechazada");
            }
        }
        if (r.status == 200) {
            ApplyProfile(r.body);
            ApplyConfig(r.body);
            TryUpdate(r.body, !JsonIsNull(r.body, "session"));
            bool session = !JsonIsNull(r.body, "session");
            std::vector<std::wstring> requests;
            for (const auto& q : JsonStrings(r.body, "requests")) requests.push_back(Widen(q));
            EvidenceUpdate(session ? Widen(JsonStr(r.body, "id")) : L"", JsonInt(r.body, "capture_min_s"), JsonInt(r.body, "capture_max_s"), requests);
            if (session != wasSession) {
                // Al cerrarse la sesión se deja de recopilar: EvidenceUpdate ya recibió la sesión vacía.
                Log(session ? L"sesión abierta" : L"sesión cerrada");
                wasSession = session;
            }
            Update([&](UiState& s) { s.linked = true; s.online = true; s.session = session; if (!session) s.detail.clear(); s.screen = session ? Screen::Session : Screen::Ready; });
        } else {
            if (wasSession) Log(L"sin contacto durante la sesión");
            Log(L"latido fallido: " + std::to_wstring(r.status));
            // Sin contacto no se sabe si la sesión sigue: se deja de recopilar hasta confirmarla.
            EvidenceUpdate(L"", 0, 0, {});
            wasSession = false;
            Update([](UiState& s) { s.linked = true; s.online = false; s.session = false; s.screen = Screen::Offline; });
        }
        // En sesión, más seguido: las capturas que pide el staff llegan por el latido.
        if (Sleep_(wasSession ? std::min<DWORD>(g_beatMs, 10000) : g_beatMs)) return;
    }
}

static void ShowMain() {
    ShowWindow(g_wnd, SW_SHOWNORMAL);
    SetForegroundWindow(g_wnd);
}

static void Press(int id) {
    Screen sc;
    std::wstring url;
    {
        std::lock_guard<std::mutex> l(g_mu);
        sc = g_state.screen;
        url = g_verifyUrl;
    }
    switch (id) {
        case BtnClose: ShowWindow(g_wnd, SW_HIDE); break;  // Sigue visible en la bandeja
        case BtnMinimize: ShowWindow(g_wnd, SW_MINIMIZE); break;
        case BtnLink: OpenWeb(L"https://cmleague.lat/privacidad"); break;
        case BtnPrimary:
            if (sc == Screen::Consent) {
                SaveConsent();
                Update([](UiState& s) { s.screen = Screen::Unlinked; });
            } else if (sc == Screen::Unlinked) {
                g_wantLink = true;
            } else if (sc == Screen::Linking) {
                OpenWeb(url);
            }
            SetEvent(g_wake);
            break;
        case BtnSecondary:
            if (sc == Screen::Consent) { PostQuitMessage(0); break; }
            if (sc == Screen::Linking) g_cancelLink = true;
            else if (MessageBoxW(g_wnd, L"¿Cerrar sesión en este equipo? Para jugar los mixes vas a tener que vincularlo de nuevo.", AC_NAME, MB_YESNO | MB_ICONQUESTION) == IDYES)
                g_wantUnlink = true;
            SetEvent(g_wake);
            break;
    }
}

static LRESULT CALLBACK WndProc(HWND h, UINT m, WPARAM w, LPARAM l) {
    switch (m) {
        case WM_ERASEBKGND: return 1;
        case WM_PAINT: {
            PAINTSTRUCT ps;
            HDC dc = BeginPaint(h, &ps);
            UiState s;
            {
                std::lock_guard<std::mutex> lk(g_mu);
                s = g_state;
            }
            UiPaint(dc, s, g_scale, g_hover);
            EndPaint(h, &ps);
            return 0;
        }
        case WM_STATE: InvalidateRect(h, nullptr, FALSE); return 0;
        case WM_NCHITTEST: {
            POINT p{GET_X_LPARAM(l), GET_Y_LPARAM(l)};
            ScreenToClient(h, &p);
            UiState s;
            {
                std::lock_guard<std::mutex> lk(g_mu);
                s = g_state;
            }
            int x = (int)(p.x / g_scale), y = (int)(p.y / g_scale);
            if (y < kTitleBar && UiHitTest(s, x, y) == BtnNone) return HTCAPTION;
            return HTCLIENT;
        }
        case WM_MOUSEMOVE: {
            UiState s;
            {
                std::lock_guard<std::mutex> lk(g_mu);
                s = g_state;
            }
            int hit = UiHitTest(s, (int)(GET_X_LPARAM(l) / g_scale), (int)(GET_Y_LPARAM(l) / g_scale));
            if (hit != g_hover) { g_hover = hit; InvalidateRect(h, nullptr, FALSE); }
            TRACKMOUSEEVENT t{sizeof(t), TME_LEAVE, h, 0};
            TrackMouseEvent(&t);
            return 0;
        }
        case WM_MOUSELEAVE: g_hover = BtnNone; InvalidateRect(h, nullptr, FALSE); return 0;
        case WM_LBUTTONUP: {
            UiState s;
            {
                std::lock_guard<std::mutex> lk(g_mu);
                s = g_state;
            }
            Press(UiHitTest(s, (int)(GET_X_LPARAM(l) / g_scale), (int)(GET_Y_LPARAM(l) / g_scale)));
            return 0;
        }
        case WM_TRAY:
            if (LOWORD(l) == WM_LBUTTONUP) ShowMain();
            else if (LOWORD(l) == WM_RBUTTONUP) {
                HMENU menu = CreatePopupMenu();
                AppendMenuW(menu, MF_STRING, 1, L"Abrir");
                AppendMenuW(menu, MF_STRING, 2, L"Salir");
                POINT p;
                GetCursorPos(&p);
                SetForegroundWindow(h);
                int c = TrackPopupMenu(menu, TPM_RETURNCMD | TPM_NONOTIFY, p.x, p.y, 0, h, nullptr);
                DestroyMenu(menu);
                if (c == 1) ShowMain();
                else if (c == 2) PostQuitMessage(0);
            }
            return 0;
        case WM_DESTROY: PostQuitMessage(0); return 0;
    }
    return DefWindowProcW(h, m, w, l);
}

static bool RenderDemo(const std::wstring& name, const wchar_t* path) {
    UiState s;
    s.nick = L"Kyan";
    s.memberSince = L"Miembro desde el 10 de marzo de 2026";
    s.serverName = L"CMLeague #1";
    if (name == L"consent") s.screen = Screen::Consent;
    else if (name == L"unlinked") s.screen = Screen::Unlinked;
    else if (name == L"linking") { s.screen = Screen::Linking; s.userCode = L"K7QM2XPD"; }
    else if (name == L"ready") { s.screen = Screen::Ready; s.linked = s.online = true; }
    else if (name == L"ready-game") { s.screen = Screen::Ready; s.linked = s.online = s.gameOpen = true; }
    else if (name == L"session") { s.screen = Screen::Session; s.linked = s.online = s.gameOpen = s.session = true; }
    else if (name == L"offline") { s.screen = Screen::Offline; s.linked = true; s.gameOpen = true; }
    else return false;
    return UiRenderPng(s, path);
}

int WINAPI wWinMain(HINSTANCE inst, HINSTANCE, PWSTR, int) {
    SetProcessDPIAware();
    CoInitializeEx(nullptr, COINIT_APARTMENTTHREADED);
    UiInit();

    int argc = 0;
    LPWSTR* argv = CommandLineToArgvW(GetCommandLineW(), &argc);
    bool install = false, uninstall = false, silent = false, portable = false;
    for (int i = 1; i < argc; i++) {
        std::wstring a = argv[i];
        if (a == L"--install") install = true;
        else if (a == L"--uninstall") uninstall = true;
        else if (a == L"--silent") silent = true;
        else if (a == L"--portable") portable = true;
#ifdef AC_TEST
        else if (a == L"--no-browser") g_noBrowser = true;
        else if (a == L"--auto-link") g_wantLink = true;
        else if (a == L"--beat" && i + 1 < argc) g_beatMs = (DWORD)_wtoi(argv[++i]) * 1000;
        else if (a == L"--api" && i + 1 < argc) g_api = argv[++i];
        else if (a == L"--data-dir" && i + 1 < argc) SetDataDir(argv[++i]);
        else if (a == L"--capture-title" && i + 1 < argc) { g_evidence.gameTitle = argv[++i]; g_evidence.minWidth = 100; }
        else if (a == L"--capture-no-foreground") g_evidence.ignoreForeground = true;
        else if (a == L"--capture-every" && i + 1 < argc) g_evidence.everySeconds = _wtoi(argv[++i]);
        else if (a == L"--detect" && i + 2 < argc) {
            // Solo pruebas: qué ve el agente sobre un proceso cualquiera, en un archivo de texto.
            DWORD pid = (DWORD)_wtoi(argv[i + 1]);
            std::wstring outText;
            auto dump = [&](const wchar_t* kind, const std::vector<DetectItem>& v) {
                for (const auto& d : v) outText += std::wstring(kind) + L"\t" + std::to_wstring(d.pid) + L"\t" + d.name + L"\t" + d.path + L"\t" + d.note + L"\t" + Widen(d.detail) + L"\r\n";
            };
            dump(L"handle", DetectHandles(pid));
            dump(L"overlay", DetectOverlays(pid));
            auto drv = DetectDrivers();
            outText += L"drivers\t" + std::to_wstring(drv.size()) + L"\r\n";
            std::wstring ports;
            for (int p : GamePorts(pid)) ports += std::to_wstring(p) + L" ";
            outText += L"ports\t" + ports + L"\r\nmachine\t" + Widen(MachineIds()) + L"\r\n";
            std::string u8;
            int n = WideCharToMultiByte(CP_UTF8, 0, outText.c_str(), (int)outText.size(), nullptr, 0, nullptr, nullptr);
            u8.resize(n);
            WideCharToMultiByte(CP_UTF8, 0, outText.c_str(), (int)outText.size(), u8.data(), n, nullptr, nullptr);
            HANDLE f = CreateFileW(argv[i + 2], GENERIC_WRITE, 0, nullptr, CREATE_ALWAYS, 0, nullptr);
            DWORD w = 0;
            if (f != INVALID_HANDLE_VALUE) { WriteFile(f, u8.data(), (DWORD)u8.size(), &w, nullptr); CloseHandle(f); }
            UiShutdown();
            return 0;
        }
#endif
        else if (a == L"--render" && i + 2 < argc) {
            bool ok = RenderDemo(argv[i + 1], argv[i + 2]);
            UiShutdown();
            return ok ? 0 : 1;
        }
    }

    if (uninstall) {
        if (silent || MessageBoxW(nullptr, L"¿Desinstalar CMLeague Anticheat y borrar sus datos de esta PC?", AC_NAME, MB_YESNO | MB_ICONQUESTION) == IDYES)
            Uninstall();
        return 0;
    }
    if (install) return Install(nullptr) ? 0 : 1;

    // Abierto desde otra carpeta: ofrece instalarse.
    wchar_t self[MAX_PATH];
    GetModuleFileNameW(nullptr, self, MAX_PATH);
    if (!portable && _wcsicmp(self, (InstallDir() + L"\\CMLeagueAC.exe").c_str()) != 0) {
        int a = MessageBoxW(nullptr, L"¿Instalar CMLeague Anticheat en esta PC?\n\nNo necesita permisos de administrador y no se abre sola con Windows. Se puede desinstalar desde Configuración de Windows.", AC_NAME, MB_YESNOCANCEL | MB_ICONQUESTION);
        if (a == IDCANCEL) return 0;
        if (a == IDYES) {
            std::wstring exe;
            if (!Install(&exe)) { MessageBoxW(nullptr, L"No se pudo instalar.", AC_NAME, MB_ICONERROR); return 1; }
            ShellExecuteW(nullptr, L"open", exe.c_str(), nullptr, nullptr, SW_SHOWNORMAL);
            return 0;
        }
    }

    HANDLE single = CreateMutexW(nullptr, TRUE, L"Local\\CMLeagueAC");
    if (GetLastError() == ERROR_ALREADY_EXISTS) {
        if (HWND other = FindWindowW(L"CMLeagueACWindow", nullptr)) { ShowWindow(other, SW_SHOWNORMAL); SetForegroundWindow(other); }
        return 0;
    }

    g_state.screen = ConsentGiven() ? (LoadSecret(L"access").empty() ? Screen::Unlinked : Screen::Offline) : Screen::Consent;
    g_state.linked = !LoadSecret(L"access").empty();
    g_quit = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    g_wake = CreateEventW(nullptr, FALSE, FALSE, nullptr);

    HDC screen = GetDC(nullptr);
    g_scale = GetDeviceCaps(screen, LOGPIXELSX) / 96.f;
    ReleaseDC(nullptr, screen);

    HICON iconBig = UiMakeIcon(48), iconSmall = UiMakeIcon(16);
    WNDCLASSEXW wc{sizeof(wc)};
    wc.lpfnWndProc = WndProc;
    wc.hInstance = inst;
    wc.hCursor = LoadCursor(nullptr, IDC_ARROW);
    wc.lpszClassName = L"CMLeagueACWindow";
    wc.hIcon = iconBig;
    wc.hIconSm = iconSmall;
    RegisterClassExW(&wc);

    int w = (int)(kWidth * g_scale), h = (int)(kHeight * g_scale);
    int x = (GetSystemMetrics(SM_CXSCREEN) - w) / 2, y = (GetSystemMetrics(SM_CYSCREEN) - h) / 2;
    g_wnd = CreateWindowExW(0, wc.lpszClassName, AC_NAME, WS_POPUP | WS_MINIMIZEBOX | WS_SYSMENU, x, y, w, h, nullptr, nullptr, inst, nullptr);
    if (!g_wnd) return 1;

    g_tray.cbSize = sizeof(g_tray);
    g_tray.hWnd = g_wnd;
    g_tray.uID = 1;
    g_tray.uFlags = NIF_ICON | NIF_MESSAGE | NIF_TIP;
    g_tray.uCallbackMessage = WM_TRAY;
    g_tray.hIcon = iconSmall;
    wcscpy_s(g_tray.szTip, AC_NAME);
    Shell_NotifyIconW(NIM_ADD, &g_tray);

    ShowMain();
    Log(L"inicio");
    g_selfSha = FileSha256(self);
    DeleteFileW((InstallDir() + L"\\CMLeagueAC.old.exe").c_str());  // Lo que quedó de una actualización
    EvidenceStart(g_api, g_evidence);
    std::thread worker(Worker);

    MSG msg;
    while (GetMessageW(&msg, nullptr, 0, 0) > 0) {
        TranslateMessage(&msg);
        DispatchMessageW(&msg);
    }

    SetEvent(g_quit);
    worker.join();
    EvidenceStop();
    Log(L"salida");
    Shell_NotifyIconW(NIM_DELETE, &g_tray);
    DestroyIcon(iconBig);
    DestroyIcon(iconSmall);
    CloseHandle(single);
    UiShutdown();
    return 0;
}
