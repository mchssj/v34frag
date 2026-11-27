// Detecciones sin driver ni inyección: solo APIs de consulta de Windows (docs/bitacora/2026-11-27-anticheat-deteccion).
// Nada de esto se le muestra al jugador. Las firmas de trampas conocidas no están acá: las compara la base.
#ifndef NOMINMAX
#define NOMINMAX
#endif
#include <winsock2.h>  // Antes de windows.h (core.h), para GetAdaptersAddresses
#include <ws2tcpip.h>
#include <iphlpapi.h>
#include "core.h"
#include "obf.h"
#include <winternl.h>
#include <psapi.h>
#include <tlhelp32.h>
#include <winioctl.h>
#include <intrin.h>
#include <algorithm>
#include <cwctype>
#include <map>
#include <set>

#pragma comment(lib, "iphlpapi")
#pragma comment(lib, "psapi")
#pragma comment(lib, "ws2_32")

namespace {
std::string Hex32(ULONG v) {
    char b[16];
    sprintf_s(b, "0x%08lx", v);
    return b;
}

std::wstring Lower(std::wstring s) {
    std::transform(s.begin(), s.end(), s.begin(), [](wchar_t c) { return (wchar_t)std::towlower(c); });
    return s;
}

std::wstring BaseName(const std::wstring& p) {
    size_t i = p.find_last_of(L"\\/");
    return i == std::wstring::npos ? p : p.substr(i + 1);
}

std::wstring SystemDir() {
    wchar_t d[MAX_PATH];
    UINT n = GetWindowsDirectoryW(d, MAX_PATH);
    return n ? Lower(std::wstring(d, n)) : L"c:\\windows";
}

DWORD ParentOf(DWORD pid) {
    DWORD parent = 0;
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return 0;
    PROCESSENTRY32W e{};
    e.dwSize = sizeof(e);
    for (BOOL ok = Process32FirstW(snap, &e); ok; ok = Process32NextW(snap, &e))
        if (e.th32ProcessID == pid) { parent = e.th32ParentProcessID; break; }
    CloseHandle(snap);
    return parent;
}

bool IsWindowsService(const std::wstring& name) {
    static const std::set<std::wstring> kNames = {OBF(L"csrss.exe"), OBF(L"lsass.exe"), OBF(L"services.exe"), OBF(L"svchost.exe"),
                                                  OBF(L"wininit.exe"), OBF(L"smss.exe"), OBF(L"audiodg.exe"), OBF(L"wermgr.exe"),
                                                  OBF(L"werfault.exe"), OBF(L"taskmgr.exe"), OBF(L"conhost.exe")};
    return kNames.count(name) > 0;
}

// ---------- handles ----------
struct HandleEntry {
    PVOID Object;
    ULONG_PTR UniqueProcessId;
    ULONG_PTR HandleValue;
    ULONG GrantedAccess;
    USHORT CreatorBackTraceIndex;
    USHORT ObjectTypeIndex;
    ULONG HandleAttributes;
    ULONG Reserved;
};
struct HandleInfo {
    ULONG_PTR NumberOfHandles;
    ULONG_PTR Reserved;
    HandleEntry Handles[1];
};
using NtQSI = LONG(NTAPI*)(ULONG, PVOID, ULONG, PULONG);

std::vector<BYTE> QueryHandles() {
    static NtQSI fn = (NtQSI)GetProcAddress(GetModuleHandleW(OBF(L"ntdll.dll").c_str()), "NtQuerySystemInformation");
    std::vector<BYTE> buf;
    if (!fn) return buf;
    ULONG size = 1 << 20;
    for (int i = 0; i < 8; i++) {
        buf.resize(size);
        ULONG need = 0;
        LONG st = fn(64 /* SystemExtendedHandleInformation */, buf.data(), size, &need);
        if (st == 0) return buf;
        if (st != (LONG)0xC0000004 /* STATUS_INFO_LENGTH_MISMATCH */) break;
        size = std::max<ULONG>(need + (1 << 16), size * 2);
    }
    buf.clear();
    return buf;
}
}  // namespace

std::wstring ProcessPath(DWORD pid) {
    std::wstring out;
    if (HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, pid)) {
        wchar_t path[1024];
        DWORD n = 1024;
        if (QueryFullProcessImageNameW(h, 0, path, &n)) out.assign(path, n);
        CloseHandle(h);
    }
    return out;
}

std::vector<DetectItem> DetectHandles(DWORD gamePid) {
    std::vector<DetectItem> out;
    if (!gamePid) return out;
    const DWORD self = GetCurrentProcessId();
    HANDLE mine = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, gamePid);
    if (!mine) return out;
    std::vector<BYTE> buf = QueryHandles();
    if (buf.empty()) { CloseHandle(mine); return out; }
    auto* info = (HandleInfo*)buf.data();
    const ULONG_PTR count = std::min<ULONG_PTR>(info->NumberOfHandles, (buf.size() - offsetof(HandleInfo, Handles)) / sizeof(HandleEntry));

    // Nuestra propia entrada dice qué objeto es el juego y de qué tipo son los handles de proceso.
    PVOID gameObject = nullptr;
    USHORT processType = 0;
    bool found = false;
    for (ULONG_PTR i = 0; i < count; i++) {
        const HandleEntry& e = info->Handles[i];
        if (e.UniqueProcessId == self && e.HandleValue == (ULONG_PTR)mine) { gameObject = e.Object; processType = e.ObjectTypeIndex; found = true; break; }
    }
    if (!found) { CloseHandle(mine); Log(L"handles: no se encontró la entrada propia (" + std::to_wstring(count) + L")"); return out; }
#ifdef AC_TEST
    Log(L"handles: " + std::to_wstring(count) + L" entradas, direcciones " + (gameObject ? L"visibles" : L"ocultas") + L", tipo " + std::to_wstring(processType));
#endif

    const ULONG kMemory = PROCESS_VM_READ | PROCESS_VM_WRITE | PROCESS_VM_OPERATION;
    std::map<DWORD, ULONG> owners;  // proceso → permisos sumados
    std::map<DWORD, HANDLE> dupFrom;
    for (ULONG_PTR i = 0; i < count; i++) {
        const HandleEntry& e = info->Handles[i];
        DWORD pid = (DWORD)e.UniqueProcessId;
        if (e.ObjectTypeIndex != processType || pid == self || pid == gamePid || pid <= 4 || !(e.GrantedAccess & kMemory)) continue;
        bool match = false;
        if (gameObject) {
            match = e.Object == gameObject;
        } else {
            // Windows esconde las direcciones sin privilegios: se duplica el handle y se pregunta a qué proceso apunta.
            auto it = dupFrom.find(pid);
            if (it == dupFrom.end()) it = dupFrom.emplace(pid, OpenProcess(PROCESS_DUP_HANDLE, FALSE, pid)).first;
            HANDLE dup = nullptr;
            if (it->second && DuplicateHandle(it->second, (HANDLE)e.HandleValue, GetCurrentProcess(), &dup, PROCESS_QUERY_LIMITED_INFORMATION, FALSE, 0)) {
                match = GetProcessId(dup) == gamePid;
                CloseHandle(dup);
            }
        }
        if (match) owners[pid] |= e.GrantedAccess;
    }
#ifdef AC_TEST
    {
        size_t ofType = 0, withMem = 0, opened = 0;
        for (ULONG_PTR i = 0; i < count; i++) {
            if (info->Handles[i].ObjectTypeIndex != processType) continue;
            ofType++;
            if (info->Handles[i].GrantedAccess & kMemory) withMem++;
        }
        for (auto& [pid, h] : dupFrom) if (h) opened++;
        Log(L"handles: " + std::to_wstring(ofType) + L" de proceso, " + std::to_wstring(withMem) + L" con memoria, " + std::to_wstring(dupFrom.size()) +
            L" dueños, " + std::to_wstring(opened) + L" abiertos, " + std::to_wstring(owners.size()) + L" al juego");
    }
#endif
    for (auto& [pid, h] : dupFrom) if (h) CloseHandle(h);
    CloseHandle(mine);

    const std::wstring win = SystemDir();
    for (auto& [pid, access] : owners) {
        DetectItem d;
        d.pid = pid;
        d.path = ProcessPath(pid);
        d.name = d.path.empty() ? L"?" : BaseName(d.path);
        if (d.path.empty()) d.note = L"access_denied";
        // Los servicios de Windows que tienen handles a todo (csrss, lsass…), solo desde System32: no son indicio.
        else if (Lower(d.path).rfind(win + L"\\system32\\", 0) == 0 && IsWindowsService(Lower(BaseName(d.path)))) continue;
        d.key = std::to_wstring(pid) + L"-" + std::to_wstring(access);
        // Quien abrió el juego (el launcher) se queda con un handle con todos los permisos: es normal, la base lo pesa menos.
        bool parent = pid == ParentOf(gamePid);
        d.detail = "{\"access\":\"" + Hex32(access) + "\",\"addresses_hidden\":" + (gameObject ? "false" : "true") + ",\"parent\":" + (parent ? "true" : "false") + "}";
        out.push_back(std::move(d));
    }
    return out;
}

// ---------- overlays ----------
std::vector<DetectItem> DetectOverlays(DWORD gamePid) {
    std::vector<DetectItem> out;
    if (!gamePid) return out;
    struct Ctx { DWORD game, self; RECT gameRc; LONG gameArea; std::vector<DetectItem>* out; } ctx{gamePid, GetCurrentProcessId(), {}, 0, &out};
    // La ventana más grande del juego.
    EnumWindows([](HWND h, LPARAM l) -> BOOL {
        auto* c = (Ctx*)l;
        DWORD pid = 0;
        GetWindowThreadProcessId(h, &pid);
        RECT r{};
        if (pid == c->game && IsWindowVisible(h) && GetWindowRect(h, &r)) {
            LONG a = (r.right - r.left) * (r.bottom - r.top);
            if (a > c->gameArea) { c->gameArea = a; c->gameRc = r; }
        }
        return TRUE;
    }, (LPARAM)&ctx);
    if (ctx.gameArea <= 0) return out;
    EnumWindows([](HWND h, LPARAM l) -> BOOL {
        auto* c = (Ctx*)l;
        DWORD pid = 0;
        GetWindowThreadProcessId(h, &pid);
        if (pid == c->game || pid == c->self || !IsWindowVisible(h)) return TRUE;
        LONG_PTR ex = GetWindowLongPtrW(h, GWL_EXSTYLE);
        if (!(ex & WS_EX_TOPMOST) || !(ex & (WS_EX_LAYERED | WS_EX_TRANSPARENT))) return TRUE;
        RECT r{}, i{};
        if (!GetWindowRect(h, &r) || !IntersectRect(&i, &r, &c->gameRc)) return TRUE;
        double cover = (double)(i.right - i.left) * (i.bottom - i.top) / c->gameArea;
        if (cover < 0.5) return TRUE;
        wchar_t cls[128] = L"";
        GetClassNameW(h, cls, 128);
        DetectItem d;
        d.pid = pid;
        d.path = ProcessPath(pid);
        d.name = d.path.empty() ? L"?" : BaseName(d.path);
        if (d.path.empty()) d.note = L"access_denied";
        d.key = std::to_wstring(pid) + L"-" + cls;
        char cv[16];
        sprintf_s(cv, "%.2f", cover);
        d.detail = "{\"class\":\"" + JsonEscape(cls) + "\",\"exstyle\":\"" + Hex32((ULONG)ex) + "\",\"cover\":" + cv + "}";
        c->out->push_back(std::move(d));
        return TRUE;
    }, (LPARAM)&ctx);
    return out;
}

// ---------- drivers ----------
// Los servicios de tipo driver que están corriendo. EnumDeviceDrivers no sirve sin permisos: Windows 11 esconde las direcciones.
std::vector<DetectItem> DetectDrivers() {
    std::vector<DetectItem> out;
    SC_HANDLE scm = OpenSCManagerW(nullptr, nullptr, SC_MANAGER_ENUMERATE_SERVICE);
    if (!scm) return out;
    DWORD need = 0, count = 0, resume = 0;
    EnumServicesStatusExW(scm, SC_ENUM_PROCESS_INFO, SERVICE_DRIVER, SERVICE_ACTIVE, nullptr, 0, &need, &count, &resume, nullptr);
    std::vector<BYTE> buf(need + 4096);
    resume = 0;
    if (!EnumServicesStatusExW(scm, SC_ENUM_PROCESS_INFO, SERVICE_DRIVER, SERVICE_ACTIVE, buf.data(), (DWORD)buf.size(), &need, &count, &resume, nullptr)) {
        CloseServiceHandle(scm);
        return out;
    }
    wchar_t windir[MAX_PATH];
    GetWindowsDirectoryW(windir, MAX_PATH);
    auto* svc = (ENUM_SERVICE_STATUS_PROCESSW*)buf.data();
    std::set<std::wstring> seen;
    std::vector<BYTE> cfgBuf(8192);
    for (DWORD i = 0; i < count; i++) {
        SC_HANDLE s = OpenServiceW(scm, svc[i].lpServiceName, SERVICE_QUERY_CONFIG);
        if (!s) continue;
        DWORD n = 0;
        auto* cfg = (QUERY_SERVICE_CONFIGW*)cfgBuf.data();
        std::wstring p;
        if (QueryServiceConfigW(s, cfg, (DWORD)cfgBuf.size(), &n) && cfg->lpBinaryPathName) p = cfg->lpBinaryPathName;
        CloseServiceHandle(s);
        if (p.empty()) p = std::wstring(windir) + L"\\System32\\drivers\\" + svc[i].lpServiceName + L".sys";
        // \SystemRoot\…, System32\…, \??\C:\… o \Windows\… a una ruta normal.
        if (_wcsnicmp(p.c_str(), L"\\SystemRoot\\", 12) == 0) p = std::wstring(windir) + p.substr(11);
        else if (_wcsnicmp(p.c_str(), L"System32\\", 9) == 0) p = std::wstring(windir) + L"\\" + p;
        else if (p.rfind(L"\\??\\", 0) == 0) p = p.substr(4);
        else if (_wcsnicmp(p.c_str(), L"\\Windows\\", 9) == 0) p = std::wstring(windir) + p.substr(8);
        if (!seen.insert(Lower(p)).second) continue;
        DetectItem d;
        d.path = p;
        d.name = BaseName(p);
        d.key = Lower(p);
        d.detail = "{\"service\":\"" + JsonEscape(svc[i].lpServiceName) + "\"}";
        out.push_back(std::move(d));
    }
    CloseServiceHandle(scm);
    return out;
}
// ---------- archivos del juego ----------
std::vector<DetectItem> DetectGameFiles(DWORD gamePid, const std::vector<std::wstring>& files) {
    std::vector<DetectItem> out;
    std::wstring exe = ProcessPath(gamePid);
    size_t cut = exe.find_last_of(L'\\');
    if (cut == std::wstring::npos) return out;
    std::wstring dir = exe.substr(0, cut);
    for (const auto& rel : files) {
        if (rel.find(L"..") != std::wstring::npos) continue;  // Solo dentro de la carpeta del juego
        std::wstring full = dir + L"\\" + rel;
        if (GetFileAttributesW(full.c_str()) == INVALID_FILE_ATTRIBUTES) continue;
        DetectItem d;
        d.pid = gamePid;
        d.name = rel;
        d.path = full;
        d.key = Lower(rel);
        out.push_back(std::move(d));
    }
    return out;
}

// ---------- puertos ----------
std::vector<int> GamePorts(DWORD gamePid) {
    std::vector<int> out;
    if (!gamePid) return out;
    DWORD size = 0;
    GetExtendedUdpTable(nullptr, &size, FALSE, AF_INET, UDP_TABLE_OWNER_PID, 0);
    std::vector<BYTE> buf(size + 1024);
    size = (DWORD)buf.size();
    if (GetExtendedUdpTable(buf.data(), &size, FALSE, AF_INET, UDP_TABLE_OWNER_PID, 0) != NO_ERROR) return out;
    auto* t = (MIB_UDPTABLE_OWNER_PID*)buf.data();
    for (DWORD i = 0; i < t->dwNumEntries && out.size() < 16; i++)
        if (t->table[i].dwOwningPid == gamePid) out.push_back((int)ntohs((u_short)t->table[i].dwLocalPort));
    std::sort(out.begin(), out.end());
    out.erase(std::unique(out.begin(), out.end()), out.end());
    return out;
}

// ---------- identificadores de la máquina ----------
namespace {
std::string Narrow8(const std::wstring& s) {
    std::string out;
    for (wchar_t c : s) out += c < 0x80 ? (char)c : '?';
    return out;
}

std::string Trim(std::string s) {
    while (!s.empty() && (unsigned char)s.back() <= ' ') s.pop_back();
    size_t i = 0;
    while (i < s.size() && (unsigned char)s[i] <= ' ') i++;
    return s.substr(i);
}

std::string JsonOf(const std::string& s) {
    std::string o;
    for (char c : s) if (c >= 0x20 && c != '"' && c != '\\') o += c;
    return "\"" + o + "\"";
}

// SMBIOS: UUID del sistema (tipo 1) y serial de la placa (tipo 2).
void Smbios(std::string& uuid, std::string& board) {
    UINT size = GetSystemFirmwareTable('RSMB', 0, nullptr, 0);
    if (!size) return;
    std::vector<BYTE> buf(size);
    if (GetSystemFirmwareTable('RSMB', 0, buf.data(), size) != size || size < 8) return;
    DWORD len = *(DWORD*)(buf.data() + 4);
    const BYTE* p = buf.data() + 8;
    const BYTE* end = p + std::min<size_t>(len, size - 8);
    while (p + 4 <= end) {
        BYTE type = p[0], flen = p[1];
        if (flen < 4 || p + flen > end) break;
        const BYTE* strings = p + flen;
        auto str = [&](BYTE idx) -> std::string {
            if (!idx) return {};
            const char* s = (const char*)strings;
            for (BYTE k = 1; k < idx && (const BYTE*)s < end && *s; k++) s += strlen(s) + 1;
            return (const BYTE*)s < end ? Trim(s) : std::string();
        };
        if (type == 1 && flen >= 0x19) {
            char b[40];
            const BYTE* u = p + 8;
            for (int i = 0; i < 16; i++) sprintf_s(b + i * 2, 3, "%02x", u[i]);
            uuid = b;
        } else if (type == 2 && flen >= 8) {
            board = str(p[7]);
        }
        // Siguiente estructura: después de las cadenas, que terminan con dos ceros.
        const BYTE* q = strings;
        while (q + 1 < end && !(q[0] == 0 && q[1] == 0)) q++;
        p = q + 2;
        if (type == 127) break;
    }
}

std::vector<std::string> DiskSerials() {
    std::vector<std::string> out;
    for (int i = 0; i < 8; i++) {
        wchar_t name[32];
        swprintf_s(name, L"\\\\.\\PhysicalDrive%d", i);
        HANDLE h = CreateFileW(name, 0, FILE_SHARE_READ | FILE_SHARE_WRITE, nullptr, OPEN_EXISTING, 0, nullptr);
        if (h == INVALID_HANDLE_VALUE) continue;
        STORAGE_PROPERTY_QUERY q{};
        q.PropertyId = StorageDeviceProperty;
        q.QueryType = PropertyStandardQuery;
        std::vector<BYTE> buf(4096);
        DWORD got = 0;
        if (DeviceIoControl(h, IOCTL_STORAGE_QUERY_PROPERTY, &q, sizeof(q), buf.data(), (DWORD)buf.size(), &got, nullptr) && got >= sizeof(STORAGE_DEVICE_DESCRIPTOR)) {
            auto* d = (STORAGE_DEVICE_DESCRIPTOR*)buf.data();
            // Los USB entran y salen: no identifican la máquina.
            if (d->BusType != BusTypeUsb && d->SerialNumberOffset && d->SerialNumberOffset < got) {
                std::string s = Trim((const char*)buf.data() + d->SerialNumberOffset);
                if (!s.empty()) out.push_back(s);
            }
        }
        CloseHandle(h);
    }
    return out;
}

std::vector<std::string> Macs() {
    std::vector<std::string> out;
    ULONG size = 16 * 1024;
    std::vector<BYTE> buf(size);
    if (GetAdaptersAddresses(AF_UNSPEC, GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER, nullptr, (PIP_ADAPTER_ADDRESSES)buf.data(), &size) == ERROR_BUFFER_OVERFLOW) {
        buf.resize(size);
        if (GetAdaptersAddresses(AF_UNSPEC, GAA_FLAG_SKIP_ANYCAST | GAA_FLAG_SKIP_MULTICAST | GAA_FLAG_SKIP_DNS_SERVER, nullptr, (PIP_ADAPTER_ADDRESSES)buf.data(), &size) != NO_ERROR) return out;
    }
    static const wchar_t* kVirtual[] = {L"virtual", L"vpn", L"hyper-v", L"vmware", L"virtualbox", L"tap-", L"loopback", L"bluetooth", L"wan miniport", L"npcap"};
    for (auto* a = (PIP_ADAPTER_ADDRESSES)buf.data(); a; a = a->Next) {
        if ((a->IfType != IF_TYPE_ETHERNET_CSMACD && a->IfType != IF_TYPE_IEEE80211) || a->PhysicalAddressLength != 6) continue;
        if (a->PhysicalAddress[0] & 0x02) continue;  // MAC aleatoria o administrada localmente
        std::wstring desc = Lower(a->Description ? a->Description : L"");
        bool virt = false;
        for (auto* v : kVirtual) if (desc.find(v) != std::wstring::npos) virt = true;
        if (virt) continue;
        char b[20];
        sprintf_s(b, "%02x%02x%02x%02x%02x%02x", a->PhysicalAddress[0], a->PhysicalAddress[1], a->PhysicalAddress[2], a->PhysicalAddress[3], a->PhysicalAddress[4], a->PhysicalAddress[5]);
        out.push_back(b);
    }
    std::sort(out.begin(), out.end());
    out.erase(std::unique(out.begin(), out.end()), out.end());
    return out;
}

std::string Cpu() {
    int r[4];
    char brand[49] = {};
    __cpuid(r, 0x80000000);
    if ((unsigned)r[0] < 0x80000004) return {};
    for (int i = 0; i < 3; i++) {
        __cpuid(r, 0x80000002 + i);
        memcpy(brand + i * 16, r, 16);
    }
    return Trim(brand);
}

std::string Gpu() {
    DISPLAY_DEVICEW dd{sizeof(dd)};
    for (DWORD i = 0; EnumDisplayDevicesW(nullptr, i, &dd, 0); i++, dd = DISPLAY_DEVICEW{sizeof(dd)})
        if (dd.StateFlags & DISPLAY_DEVICE_PRIMARY_DEVICE) return Trim(Narrow8(dd.DeviceString));
    return {};
}

std::string MachineGuid() {
    wchar_t v[64] = L"";
    DWORD n = sizeof(v);
    if (RegGetValueW(HKEY_LOCAL_MACHINE, OBF(L"SOFTWARE\\Microsoft\\Cryptography").c_str(), L"MachineGuid", RRF_RT_REG_SZ, nullptr, v, &n) != ERROR_SUCCESS) return {};
    return Narrow8(v);
}

std::string JsonArr(const std::vector<std::string>& v) {
    std::string o = "[";
    for (size_t i = 0; i < v.size() && i < 8; i++) o += (i ? "," : "") + JsonOf(v[i]);
    return o + "]";
}
}  // namespace

std::string MachineIds() {
    static std::string cached;  // No cambian mientras corre
    if (!cached.empty()) return cached;
    std::string uuid, board;
    Smbios(uuid, board);
    cached = "{\"smbios\":" + JsonOf(uuid) + ",\"board\":" + JsonOf(board) + ",\"machine_guid\":" + JsonOf(MachineGuid()) +
             ",\"disks\":" + JsonArr(DiskSerials()) + ",\"macs\":" + JsonArr(Macs()) + ",\"cpu\":" + JsonOf(Cpu()) + ",\"gpu\":" + JsonOf(Gpu()) + "}";
    return cached;
}
