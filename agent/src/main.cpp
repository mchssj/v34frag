// CMLeague Anticheat: ventana, bandeja y trabajo en segundo plano (vincular, latido cada 30 s, detectar ClientMod).
// Opciones: --install --uninstall --silent --portable --render <pantalla> <png>
// Solo en la versión de pruebas (AC_TEST): --api --data-dir --no-browser --auto-link --beat --capture-title --capture-no-foreground --capture-every
#include "core.h"
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

static bool GameOpen() {
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return false;
    PROCESSENTRY32W e{};
    e.dwSize = sizeof(e);
    bool found = false;
    // Solo se busca el launcher por su nombre: no se guarda ni se envía la lista.
    for (BOOL ok = Process32FirstW(snap, &e); ok && !found; ok = Process32NextW(snap, &e))
        found = _wcsicmp(e.szExeFile, L"CMLauncher.exe") == 0;
    CloseHandle(snap);
    return found;
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

static void Forget() {
    EvidenceUpdate(L"", 0, 0, {});
    DeleteSecret(L"access");
    DeleteSecret(L"refresh");
    Update([](UiState& s) { s.linked = s.online = s.session = false; s.screen = Screen::Unlinked; s.userCode.clear(); });
}

static std::string VersionField() { return JsonEscape(AC_VERSION); }

static bool RunLink() {
    wchar_t name[64] = L"PC";
    DWORD len = 64;
    GetComputerNameW(name, &len);
    Update([](UiState& s) { s.detail.clear(); });
    auto r = HttpPost(g_api, L"/api/v1/anticheat/link", "{\"device_name\":\"" + JsonEscape(name) + "\",\"agent_version\":\"" + VersionField() + "\"}");
    if (r.status != 201) {
        Log(L"vincular: la API respondió " + std::to_wstring(r.status));
        Update([&](UiState& s) { s.screen = Screen::Unlinked; s.detail = r.status == 0 ? L"No se pudo conectar con CMLeague. Prueba de nuevo." : L"El servicio no está disponible ahora."; });
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
        bool open = GameOpen();
        Update([&](UiState& s) { s.gameOpen = open; });

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

        auto r = HttpPost(g_api, L"/api/v1/anticheat/heartbeat", "{\"agent_version\":\"" + VersionField() + "\"}", Widen(LoadSecret(L"access")));
        if (r.status == 401) {
            if (Refresh()) continue;
            if (LoadSecret(L"access").empty()) continue;
        }
        if (r.status == 200) {
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
        if (Sleep_(g_beatMs)) return;
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
            else g_wantUnlink = true;
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
    if (name == L"consent") s.screen = Screen::Consent;
    else if (name == L"unlinked") s.screen = Screen::Unlinked;
    else if (name == L"linking") { s.screen = Screen::Linking; s.userCode = L"K7QM2XPD"; }
    else if (name == L"ready") { s.screen = Screen::Ready; s.linked = s.online = true; }
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
