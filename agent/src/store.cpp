// Datos locales, registro e instalación por usuario (sin administrador y sin inicio con Windows).
#include "core.h"
#include <dpapi.h>
#include <shlobj.h>
#include <shobjidl.h>
#include <fstream>
#include <vector>

#define UNINSTALL_KEY L"Software\\Microsoft\\Windows\\CurrentVersion\\Uninstall\\CMLeagueAC"

static std::wstring g_dataDir;

static std::wstring KnownFolder(REFKNOWNFOLDERID id) {
    PWSTR p = nullptr;
    std::wstring out;
    if (SUCCEEDED(SHGetKnownFolderPath(id, 0, nullptr, &p))) out = p;
    CoTaskMemFree(p);
    return out;
}

std::wstring InstallDir() { return KnownFolder(FOLDERID_LocalAppData) + L"\\Programs\\CMLeagueAC"; }
void SetDataDir(const std::wstring& dir) { g_dataDir = dir; }

std::wstring DataDir() {
    std::wstring d = g_dataDir.empty() ? KnownFolder(FOLDERID_LocalAppData) + L"\\CMLeagueAC" : g_dataDir;
    SHCreateDirectoryExW(nullptr, d.c_str(), nullptr);
    return d;
}

// Nunca se registran tokens.
void Log(const std::wstring& line) {
    SYSTEMTIME t;
    GetSystemTime(&t);
    wchar_t stamp[32];
    swprintf_s(stamp, L"%04d-%02d-%02dT%02d:%02d:%02dZ ", t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute, t.wSecond);
    std::wstring all = stamp + line + L"\n";
    int n = WideCharToMultiByte(CP_UTF8, 0, all.data(), (int)all.size(), nullptr, 0, nullptr, nullptr);
    std::string u(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, all.data(), (int)all.size(), u.data(), n, nullptr, nullptr);
    std::ofstream(DataDir() + L"\\agent.log", std::ios::app | std::ios::binary) << u;
}

bool SaveSecret(const wchar_t* name, const std::string& value) {
    DATA_BLOB in{(DWORD)value.size(), (BYTE*)value.data()}, out{};
    if (!CryptProtectData(&in, L"CMLeagueAC", nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &out)) return false;
    std::ofstream f(DataDir() + L"\\" + name + L".bin", std::ios::binary | std::ios::trunc);
    f.write((const char*)out.pbData, out.cbData);
    LocalFree(out.pbData);
    return f.good();
}

std::string LoadSecret(const wchar_t* name) {
    std::ifstream f(DataDir() + L"\\" + name + L".bin", std::ios::binary);
    if (!f) return {};
    std::vector<char> enc((std::istreambuf_iterator<char>(f)), {});
    DATA_BLOB in{(DWORD)enc.size(), (BYTE*)enc.data()}, out{};
    if (!CryptUnprotectData(&in, nullptr, nullptr, nullptr, nullptr, CRYPTPROTECT_UI_FORBIDDEN, &out)) return {};
    std::string v((char*)out.pbData, out.cbData);
    LocalFree(out.pbData);
    return v;
}

void DeleteSecret(const wchar_t* name) { DeleteFileW((DataDir() + L"\\" + name + L".bin").c_str()); }

bool ConsentGiven() { return GetFileAttributesW((DataDir() + L"\\consent-2.txt").c_str()) != INVALID_FILE_ATTRIBUTES; }

void SaveConsent() {
    std::ofstream(DataDir() + L"\\consent-2.txt") << "version=2\n";
    Log(L"consentimiento aceptado, versión 2");
}

static std::wstring ShortcutPath() { return KnownFolder(FOLDERID_Programs) + L"\\CMLeague Anticheat.lnk"; }

bool Install(std::wstring* installedExe) {
    wchar_t self[MAX_PATH];
    GetModuleFileNameW(nullptr, self, MAX_PATH);
    std::wstring dir = InstallDir(), exe = dir + L"\\CMLeagueAC.exe";
    SHCreateDirectoryExW(nullptr, dir.c_str(), nullptr);
    if (_wcsicmp(self, exe.c_str()) != 0 && !CopyFileW(self, exe.c_str(), FALSE)) return false;

    IShellLinkW* link = nullptr;
    if (SUCCEEDED(CoCreateInstance(CLSID_ShellLink, nullptr, CLSCTX_INPROC_SERVER, IID_PPV_ARGS(&link)))) {
        link->SetPath(exe.c_str());
        link->SetDescription(AC_NAME);
        IPersistFile* pf = nullptr;
        if (SUCCEEDED(link->QueryInterface(IID_PPV_ARGS(&pf)))) {
            pf->Save(ShortcutPath().c_str(), TRUE);
            pf->Release();
        }
        link->Release();
    }

    HKEY k;
    if (RegCreateKeyExW(HKEY_CURRENT_USER, UNINSTALL_KEY, 0, nullptr, 0, KEY_SET_VALUE, nullptr, &k, nullptr) == ERROR_SUCCESS) {
        auto put = [&](const wchar_t* n, const std::wstring& v) {
            RegSetValueExW(k, n, 0, REG_SZ, (const BYTE*)v.c_str(), (DWORD)((v.size() + 1) * sizeof(wchar_t)));
        };
        put(L"DisplayName", AC_NAME);
        put(L"DisplayVersion", AC_VERSION);
        put(L"Publisher", L"CMLeague");
        put(L"InstallLocation", dir);
        put(L"DisplayIcon", exe);
        put(L"UninstallString", L"\"" + exe + L"\" --uninstall");
        DWORD one = 1;
        RegSetValueExW(k, L"NoModify", 0, REG_DWORD, (const BYTE*)&one, sizeof(one));
        RegSetValueExW(k, L"NoRepair", 0, REG_DWORD, (const BYTE*)&one, sizeof(one));
        RegCloseKey(k);
    }
    if (installedExe) *installedExe = exe;
    return true;
}

// Borra acceso directo, registro, datos locales y programa. Un .exe en uso no se puede borrar a sí mismo: lo hace cmd al salir.
void Uninstall() {
    DeleteFileW(ShortcutPath().c_str());
    RegDeleteKeyW(HKEY_CURRENT_USER, UNINSTALL_KEY);
    std::wstring data = KnownFolder(FOLDERID_LocalAppData) + L"\\CMLeagueAC";
    std::wstring dir = InstallDir();
    std::wstring cmd = L"cmd.exe /c ping -n 3 127.0.0.1 >nul & rmdir /s /q \"" + data + L"\" & rmdir /s /q \"" + dir + L"\"";
    STARTUPINFOW si{};
    si.cb = sizeof(si);
    PROCESS_INFORMATION pi{};
    if (CreateProcessW(nullptr, cmd.data(), nullptr, nullptr, FALSE, CREATE_NO_WINDOW, nullptr, L"C:\\", &si, &pi)) {
        CloseHandle(pi.hThread);
        CloseHandle(pi.hProcess);
    }
}
