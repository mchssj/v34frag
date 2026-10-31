// Procesos y capturas, solo mientras hay una sesión abierta. Lo pendiente queda en una cola local y se sube aunque la sesión ya haya
// cerrado, pero no se recopila nada nuevo. Sin leer memoria, sin inyectar y sin hooks: solo APIs de consulta.
// Captura: Desktop Duplication y, si falla, BitBlt de la pantalla. BitBlt de la ventana queda prohibido: devuelve imágenes congeladas
// (docs/bitacora/2026-10-30-anticheat-captura).
#include "core.h"
#include <bcrypt.h>
#include <d3d11.h>
#include <dxgi1_2.h>
#include <mscat.h>
#include <softpub.h>
#include <tlhelp32.h>
#include <wincrypt.h>
#include <wintrust.h>
#include <algorithm>
#include <cstdio>
#include <fstream>
#include <map>
#include <mutex>
#include <random>
#include <vector>

#pragma comment(lib, "bcrypt")
#pragma comment(lib, "d3d11")
#pragma comment(lib, "dxgi")
#pragma comment(lib, "wintrust")

namespace {
struct Proc { DWORD pid; std::wstring name, path, sha, sig, pub, note; std::string started; };
struct FileInfo { std::wstring sha, sig, pub, note; };

std::mutex g_mu;
std::wstring g_session, g_api;
std::vector<std::wstring> g_requests;
int g_min = 180, g_max = 300;
EvidenceOptions g_opt;
HANDLE g_quit = nullptr;
std::mt19937 g_rng{std::random_device{}()};
int g_seq = 0;
bool g_keySent = false;

std::wstring Iso(const FILETIME& f) {
    SYSTEMTIME t;
    FileTimeToSystemTime(&f, &t);
    wchar_t b[32];
    swprintf_s(b, L"%04d-%02d-%02dT%02d:%02d:%02dZ", t.wYear, t.wMonth, t.wDay, t.wHour, t.wMinute, t.wSecond);
    return b;
}
std::wstring NowIso() {
    FILETIME f;
    GetSystemTimeAsFileTime(&f);
    return Iso(f);
}

std::wstring Hex(const BYTE* b, size_t n) {
    std::wstring s;
    wchar_t x[3];
    for (size_t i = 0; i < n; i++) { swprintf_s(x, L"%02x", b[i]); s += x; }
    return s;
}

// Hash incremental. Recibe un lector que llena el buffer; devuelve vacío si falla.
template <class Read>
std::wstring Sha256(Read read) {
    BCRYPT_ALG_HANDLE alg = nullptr;
    BCRYPT_HASH_HANDLE h = nullptr;
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_SHA256_ALGORITHM, nullptr, 0) != 0) return {};
    BYTE out[32];
    std::vector<BYTE> buf(1 << 16);
    std::wstring res;
    if (BCryptCreateHash(alg, &h, nullptr, 0, nullptr, 0, 0) == 0) {
        bool ok = true;
        for (;;) {
            DWORD n = read(buf.data(), (DWORD)buf.size());
            if (n == 0) break;
            if (BCryptHashData(h, buf.data(), n, 0) != 0) { ok = false; break; }
        }
        if (ok && BCryptFinishHash(h, out, 32, 0) == 0) res = Hex(out, 32);
        BCryptDestroyHash(h);
    }
    BCryptCloseAlgorithmProvider(alg, 0);
    return res;
}

// Firma incrustada, editor y pertenencia a un catálogo de Windows. Sin red: solo lo que ya esté en caché.
void CheckSignature(const std::wstring& path, FileInfo& out) {
    WINTRUST_FILE_INFO fi{sizeof(fi)};
    fi.pcwszFilePath = path.c_str();
    WINTRUST_DATA wd{sizeof(wd)};
    wd.dwUIChoice = WTD_UI_NONE;
    wd.fdwRevocationChecks = WTD_REVOKE_NONE;
    wd.dwUnionChoice = WTD_CHOICE_FILE;
    wd.pFile = &fi;
    wd.dwStateAction = WTD_STATEACTION_VERIFY;
    wd.dwProvFlags = WTD_CACHE_ONLY_URL_RETRIEVAL;
    GUID action = WINTRUST_ACTION_GENERIC_VERIFY_V2;
    LONG r = WinVerifyTrust((HWND)INVALID_HANDLE_VALUE, &action, &wd);
    if (r == ERROR_SUCCESS) out.sig = L"valid";
    else if (r == TRUST_E_NOSIGNATURE || r == TRUST_E_SUBJECT_FORM_UNKNOWN || r == TRUST_E_PROVIDER_UNKNOWN) out.sig = L"unsigned";
    else if (r == TRUST_E_BAD_DIGEST || r == CERT_E_REVOKED || r == TRUST_E_EXPLICIT_DISTRUST) out.sig = L"invalid";
    else out.sig = L"unknown";
    if (wd.hWVTStateData) {
        if (auto* prov = WTHelperProvDataFromStateData(wd.hWVTStateData))
            if (auto* signer = WTHelperGetProvSignerFromChain(prov, 0, FALSE, 0))
                if (signer->pasCertChain && signer->csCertChain > 0) {
                    wchar_t name[200] = L"";
                    CertGetNameStringW(signer->pasCertChain[0].pCert, CERT_NAME_SIMPLE_DISPLAY_TYPE, 0, nullptr, name, 200);
                    out.pub = name;
                }
    }
    wd.dwStateAction = WTD_STATEACTION_CLOSE;
    WinVerifyTrust((HWND)INVALID_HANDLE_VALUE, &action, &wd);

    // Muchos archivos de Windows no se firman por dentro sino en un catálogo. Eso no es "sin firma".
    if (out.sig == L"unsigned") {
        HANDLE f = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, 0, nullptr);
        HCATADMIN cat = nullptr;
        if (f != INVALID_HANDLE_VALUE && CryptCATAdminAcquireContext(&cat, nullptr, 0)) {
            BYTE hash[64];
            DWORD n = sizeof(hash);
            if (CryptCATAdminCalcHashFromFileHandle(f, &n, hash, 0)) {
                if (HCATINFO info = CryptCATAdminEnumCatalogFromHash(cat, hash, n, 0, nullptr)) {
                    out.sig = L"unknown";
                    out.note = L"catalog_member";
                    CryptCATAdminReleaseCatalogContext(cat, info, 0);
                }
            }
            CryptCATAdminReleaseContext(cat, 0);
        }
        if (f != INVALID_HANDLE_VALUE) CloseHandle(f);
    }
}

std::map<std::wstring, FileInfo> g_files;

FileInfo InspectFile(const std::wstring& path) {
    auto it = g_files.find(path);
    if (it != g_files.end()) return it->second;
    FileInfo fi;
    HANDLE f = CreateFileW(path.c_str(), GENERIC_READ, FILE_SHARE_READ | FILE_SHARE_WRITE | FILE_SHARE_DELETE, nullptr, OPEN_EXISTING, FILE_FLAG_SEQUENTIAL_SCAN, nullptr);
    if (f == INVALID_HANDLE_VALUE) {
        fi.note = L"file_unreadable";
    } else {
        LARGE_INTEGER size{};
        GetFileSizeEx(f, &size);
        if (size.QuadPart > 128LL * 1024 * 1024) {
            fi.note = L"file_too_large";
        } else {
            fi.sha = Sha256([&](BYTE* b, DWORD n) { DWORD r = 0; return ReadFile(f, b, n, &r, nullptr) ? r : 0; });
        }
        CloseHandle(f);
        CheckSignature(path, fi);
    }
    g_files[path] = fi;
    return fi;
}

// La carpeta del usuario puede llevar su nombre real: se reemplaza.
std::wstring MaskPath(const std::wstring& path) {
    wchar_t home[MAX_PATH];
    DWORD n = GetEnvironmentVariableW(L"USERPROFILE", home, MAX_PATH);
    if (n > 0 && n < MAX_PATH && _wcsnicmp(path.c_str(), home, n) == 0) return L"%USERPROFILE%" + path.substr(n);
    return path;
}

std::map<std::wstring, Proc> Snapshot() {
    std::map<std::wstring, Proc> out;
    HANDLE snap = CreateToolhelp32Snapshot(TH32CS_SNAPPROCESS, 0);
    if (snap == INVALID_HANDLE_VALUE) return out;
    PROCESSENTRY32W e{};
    e.dwSize = sizeof(e);
    for (BOOL ok = Process32FirstW(snap, &e); ok; ok = Process32NextW(snap, &e)) {
        Proc p;
        p.pid = e.th32ProcessID;
        p.name = e.szExeFile;
        std::wstring key = std::to_wstring(p.pid) + L"-";
        if (HANDLE h = OpenProcess(PROCESS_QUERY_LIMITED_INFORMATION, FALSE, p.pid)) {
            wchar_t path[1024];
            DWORD n = 1024;
            if (QueryFullProcessImageNameW(h, 0, path, &n)) p.path = path;
            FILETIME c, x, k, u;
            if (GetProcessTimes(h, &c, &x, &k, &u)) {
                std::wstring iso = Iso(c);
                for (wchar_t ch : iso) p.started += (char)ch;  // Solo dígitos y signos ASCII
                ULARGE_INTEGER t{c.dwLowDateTime, c.dwHighDateTime};
                key += std::to_wstring(t.QuadPart);
            }
            CloseHandle(h);
        }
        if (p.path.empty()) p.note = L"access_denied";  // Un dato que falta no es indicio de nada
        if (p.started.empty()) key += p.name;
        out.emplace(key, std::move(p));
    }
    CloseHandle(snap);
    return out;
}

std::wstring Spool() {
    std::wstring d = DataDir() + L"\\spool";
    CreateDirectoryW(d.c_str(), nullptr);
    return d;
}

std::wstring NewId() {
    GUID g;
    (void)CoCreateGuid(&g);
    wchar_t b[40];
    swprintf_s(b, L"%08lx%04x%04x%02x%02x%02x%02x%02x%02x%02x%02x", g.Data1, g.Data2, g.Data3, g.Data4[0], g.Data4[1], g.Data4[2], g.Data4[3], g.Data4[4], g.Data4[5], g.Data4[6], g.Data4[7]);
    return b;
}

void WriteFileAll(const std::wstring& path, const void* data, size_t n) {
    std::wstring tmp = path + L".tmp";
    {
        std::ofstream f(tmp, std::ios::binary | std::ios::trunc);
        f.write((const char*)data, (std::streamsize)n);
    }
    MoveFileExW(tmp.c_str(), path.c_str(), MOVEFILE_REPLACE_EXISTING);  // Sin archivos a medias tras un corte
}

std::string ReadAll(const std::wstring& path) {
    std::ifstream f(path, std::ios::binary);
    return std::string((std::istreambuf_iterator<char>(f)), {});
}

void Field(std::string& j, const char* k, const std::wstring& v) {
    if (v.empty()) return;
    j += ",\"";
    j += k;
    j += "\":\"" + JsonEscape(v) + "\"";
}

// ---------- firma y cadena ----------
// Clave P-256 propia del equipo, cifrada con DPAPI. Prueba qué equipo firmó y que nada cambió después, no que sea verdad:
// el equipo es del jugador.
std::string B64(const BYTE* b, DWORD n) {
    DWORD len = 0;
    CryptBinaryToStringA(b, n, CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, nullptr, &len);
    std::string s(len, '\0');
    CryptBinaryToStringA(b, n, CRYPT_STRING_BASE64 | CRYPT_STRING_NOCRLF, s.data(), &len);
    s.resize(len);
    return s;
}

std::string LoadOrCreateKey() {
    std::string blob = LoadSecret(L"devicekey");
    if (!blob.empty()) return blob;
    BCRYPT_ALG_HANDLE alg = nullptr;
    BCRYPT_KEY_HANDLE key = nullptr;
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_ECDSA_P256_ALGORITHM, nullptr, 0) != 0) return {};
    if (BCryptGenerateKeyPair(alg, &key, 256, 0) == 0 && BCryptFinalizeKeyPair(key, 0) == 0) {
        ULONG n = 0;
        BCryptExportKey(key, nullptr, BCRYPT_ECCPRIVATE_BLOB, nullptr, 0, &n, 0);
        blob.resize(n);
        if (BCryptExportKey(key, nullptr, BCRYPT_ECCPRIVATE_BLOB, (PUCHAR)blob.data(), n, &n, 0) == 0) SaveSecret(L"devicekey", blob);
        else blob.clear();
    }
    if (key) BCryptDestroyKey(key);
    BCryptCloseAlgorithmProvider(alg, 0);
    return blob;
}

// Formato "raw": 04 + X + Y.
std::string PublicKeyB64() {
    std::string blob = LoadOrCreateKey();
    if (blob.size() < sizeof(BCRYPT_ECCKEY_BLOB) + 64) return {};
    std::string raw(1, '\x04');
    raw.append(blob, sizeof(BCRYPT_ECCKEY_BLOB), 64);
    return B64((const BYTE*)raw.data(), (DWORD)raw.size());
}

std::string Sign(const std::string& text) {
    std::string blob = LoadOrCreateKey();
    if (blob.empty()) return {};
    std::wstring wide = Sha256([&, off = (size_t)0](BYTE* b, DWORD n) mutable {
        DWORD c = (DWORD)std::min<size_t>(n, text.size() - off);
        memcpy(b, text.data() + off, c);
        off += c;
        return c;
    });
    BYTE hash[32];
    for (int i = 0; i < 32; i++) hash[i] = (BYTE)wcstoul(wide.substr((size_t)i * 2, 2).c_str(), nullptr, 16);
    BCRYPT_ALG_HANDLE alg = nullptr;
    BCRYPT_KEY_HANDLE key = nullptr;
    std::string out;
    if (BCryptOpenAlgorithmProvider(&alg, BCRYPT_ECDSA_P256_ALGORITHM, nullptr, 0) != 0) return {};
    if (BCryptImportKeyPair(alg, nullptr, BCRYPT_ECCPRIVATE_BLOB, &key, (PUCHAR)blob.data(), (ULONG)blob.size(), 0) == 0) {
        BYTE sig[64];
        ULONG n = 0;
        if (BCryptSignHash(key, nullptr, hash, 32, sig, 64, &n, 0) == 0) out = B64(sig, n);  // r + s, como lo verifica WebCrypto
        BCryptDestroyKey(key);
    }
    BCryptCloseAlgorithmProvider(alg, 0);
    return out;
}

std::wstring ShaOf(const void* data, size_t size) {
    const BYTE* p = (const BYTE*)data;
    return Sha256([=, off = (size_t)0](BYTE* b, DWORD n) mutable {
        DWORD c = (DWORD)std::min<size_t>(n, size - off);
        memcpy(b, p + off, c);
        off += c;
        return c;
    });
}

// Agrega una entrada a la cadena de la sesión y deja al lado del archivo lo que hay que enviar. El estado va a disco: sobrevive un reinicio.
void ChainItem(const std::wstring& session, const wchar_t* kind, const std::wstring& itemSha, const std::wstring& id) {
    std::wstring state = Spool() + L"\\" + session + L".chain";
    std::string saved = ReadAll(state);
    int seq = 0;
    std::string prev(64, '0');
    if (saved.size() > 65) {
        size_t sp = saved.find(' ');
        seq = atoi(saved.c_str());
        prev = saved.substr(sp + 1, 64);
    }
    seq++;
    std::string entry = "v1|" + JsonEscape(session) + "|" + std::to_string(seq) + "|" + JsonEscape(kind) + "|" + JsonEscape(itemSha) + "|" + prev + "|" + JsonEscape(NowIso());
    std::string sig = Sign(entry);
    if (sig.empty()) { Log(L"no se pudo firmar la evidencia"); return; }
    std::wstring entryHash = ShaOf(entry.data(), entry.size());
    std::string next = std::to_string(seq) + " " + JsonEscape(entryHash);
    WriteFileAll(state, next.data(), next.size());
    std::string hdr = entry + "\n" + sig;
    WriteFileAll(Spool() + L"\\" + id + L".hdr", hdr.data(), hdr.size());
}

void QueueProcesses(const std::wstring& session, const std::vector<std::pair<const wchar_t*, Proc>>& evs) {
    const std::wstring now = NowIso();
    for (size_t i = 0; i < evs.size(); i += 400) {
        std::string body = "{\"session_id\":\"" + JsonEscape(session) + "\",\"events\":[";
        for (size_t k = i; k < std::min(evs.size(), i + 400); k++) {
            const Proc& p = evs[k].second;
            if (k > i) body += ",";
            std::wstring id = std::wstring(evs[k].first) + L"-" + std::to_wstring(p.pid) + L"-" + std::to_wstring(++g_seq) + L"-" + NewId().substr(0, 12);
            body += "{\"client_id\":\"" + JsonEscape(id) + "\",\"kind\":\"" + JsonEscape(evs[k].first) + "\",\"pid\":" + std::to_string(p.pid);
            Field(body, "name", p.name.substr(0, 260));
            Field(body, "path", MaskPath(p.path).substr(0, 1024));
            Field(body, "sha256", p.sha);
            Field(body, "signature", p.sig);
            Field(body, "publisher", p.pub);
            Field(body, "note", p.note);
            if (!p.started.empty()) body += ",\"started_at\":\"" + p.started + "\"";
            Field(body, "observed_at", now);
            body += "}";
        }
        body += "]}";
        std::wstring file = NewId();
        ChainItem(session, L"processes", ShaOf(body.data(), body.size()), file);
        WriteFileAll(Spool() + L"\\" + file + L".proc", body.data(), body.size());
    }
}

void Enrich(Proc& p) {
    if (p.path.empty()) return;
    FileInfo fi = InspectFile(p.path);
    p.sha = fi.sha;
    p.sig = fi.sig;
    p.pub = fi.pub;
    if (!fi.note.empty()) p.note = fi.note;
    if (WaitForSingleObject(g_quit, 5) == WAIT_OBJECT_0) return;  // No acaparar el disco ni la CPU
}

// ---------- captura ----------
struct Shot { std::vector<BYTE> jpeg; int w = 0, h = 0; const wchar_t* method = L""; };

bool LooksBlack(const BYTE* px, int w, int h, int stride) {
    long long sum = 0, n = 0;
    for (int y = 0; y < h; y += std::max(1, h / 100))
        for (int x = 0; x < w; x += std::max(1, w / 100)) {
            const BYTE* p = px + (long long)y * stride + (long long)x * 4;
            sum += (p[0] + p[1] + p[2]) / 3;
            n++;
        }
    return n == 0 || sum / n < 3;
}

template <class T> void Rel(T*& p) { if (p) { p->Release(); p = nullptr; } }

bool GrabDuplication(RECT rc, Shot& out) {
    ID3D11Device* dev = nullptr; ID3D11DeviceContext* ctx = nullptr; IDXGIDevice* dx = nullptr; IDXGIAdapter* ad = nullptr; IDXGIOutput* o = nullptr;
    IDXGIOutput1* o1 = nullptr; IDXGIOutputDuplication* dup = nullptr; IDXGIResource* res = nullptr; ID3D11Texture2D* tex = nullptr; ID3D11Texture2D* st = nullptr;
    bool ok = false, acquired = false;
    if (SUCCEEDED(D3D11CreateDevice(nullptr, D3D_DRIVER_TYPE_HARDWARE, nullptr, 0, nullptr, 0, D3D11_SDK_VERSION, &dev, nullptr, &ctx)) &&
        SUCCEEDED(dev->QueryInterface(IID_PPV_ARGS(&dx))) && SUCCEEDED(dx->GetAdapter(&ad)) && SUCCEEDED(ad->EnumOutputs(0, &o)) &&
        SUCCEEDED(o->QueryInterface(IID_PPV_ARGS(&o1))) && SUCCEEDED(o1->DuplicateOutput(dev, &dup))) {
        // El primer cuadro puede venir vacío: LastPresentTime en 0 significa que no hay imagen nueva.
        for (int i = 0; i < 8 && !acquired; i++) {
            DXGI_OUTDUPL_FRAME_INFO info{};
            HRESULT hr = dup->AcquireNextFrame(250, &info, &res);
            if (hr == DXGI_ERROR_WAIT_TIMEOUT) continue;
            if (FAILED(hr)) break;
            if (info.LastPresentTime.QuadPart != 0) { acquired = true; break; }
            Rel(res);
            dup->ReleaseFrame();
        }
        if (acquired && SUCCEEDED(res->QueryInterface(IID_PPV_ARGS(&tex)))) {
            D3D11_TEXTURE2D_DESC d{};
            tex->GetDesc(&d);
            D3D11_TEXTURE2D_DESC s = d;
            s.MipLevels = s.ArraySize = 1;
            s.SampleDesc = {1, 0};
            s.Usage = D3D11_USAGE_STAGING;
            s.BindFlags = 0;
            s.CPUAccessFlags = D3D11_CPU_ACCESS_READ;
            s.MiscFlags = 0;
            D3D11_MAPPED_SUBRESOURCE m{};
            if (SUCCEEDED(dev->CreateTexture2D(&s, nullptr, &st))) {
                ctx->CopyResource(st, tex);
                if (SUCCEEDED(ctx->Map(st, 0, D3D11_MAP_READ, 0, &m))) {
                    int x0 = std::clamp<int>(rc.left, 0, (int)d.Width), y0 = std::clamp<int>(rc.top, 0, (int)d.Height);
                    int w = std::min<int>(rc.right, (int)d.Width) - x0, h = std::min<int>(rc.bottom, (int)d.Height) - y0;
                    const BYTE* px = (const BYTE*)m.pData + (long long)y0 * m.RowPitch + (long long)x0 * 4;
                    if (w > 0 && h > 0 && !LooksBlack(px, w, h, (int)m.RowPitch) && UiEncodeJpeg(px, w, h, (int)m.RowPitch, 70, out.jpeg)) {
                        out.w = w; out.h = h; out.method = L"desktop_duplication"; ok = true;
                    }
                    ctx->Unmap(st, 0);
                }
            }
        }
    }
    if (acquired) dup->ReleaseFrame();
    Rel(st); Rel(tex); Rel(res); Rel(dup); Rel(o1); Rel(o); Rel(ad); Rel(dx); Rel(ctx); Rel(dev);
    return ok;
}

bool GrabScreen(RECT rc, Shot& out) {
    int w = rc.right - rc.left, h = rc.bottom - rc.top;
    if (w <= 0 || h <= 0) return false;
    HDC screen = GetDC(nullptr);
    HDC mem = CreateCompatibleDC(screen);
    BITMAPINFO bi{};
    bi.bmiHeader = {sizeof(BITMAPINFOHEADER), w, -h, 1, 32, BI_RGB};
    void* bits = nullptr;
    HBITMAP bmp = CreateDIBSection(mem, &bi, DIB_RGB_COLORS, &bits, nullptr, 0);
    bool ok = false;
    if (bmp) {
        HGDIOBJ old = SelectObject(mem, bmp);
        if (BitBlt(mem, 0, 0, w, h, screen, rc.left, rc.top, SRCCOPY) && !LooksBlack((BYTE*)bits, w, h, w * 4) && UiEncodeJpeg((BYTE*)bits, w, h, w * 4, 70, out.jpeg)) {
            out.w = w; out.h = h; out.method = L"bitblt_screen"; ok = true;
        }
        SelectObject(mem, old);
        DeleteObject(bmp);
    }
    DeleteDC(mem);
    ReleaseDC(nullptr, screen);
    return ok;
}

enum class CapResult { Ok, NotForeground, Failed };

// La ventana del juego, y solo con ella al frente: así no se captura nada privado por un Alt+Tab o una notificación.
CapResult Capture(Shot& out) {
    HWND w = FindWindowW(nullptr, g_opt.gameTitle.c_str());
    RECT c{};
    if (!w || !GetClientRect(w, &c) || c.right < g_opt.minWidth) return CapResult::NotForeground;
    if (!g_opt.ignoreForeground && GetForegroundWindow() != w) return CapResult::NotForeground;
    POINT p{0, 0};
    ClientToScreen(w, &p);
    RECT rc{p.x, p.y, p.x + c.right, p.y + c.bottom};
    if (GrabDuplication(rc, out) || GrabScreen(rc, out)) return CapResult::Ok;
    return CapResult::Failed;
}

void QueueShot(const std::wstring& session, const std::wstring& request, const Shot& s) {
    std::wstring id = NewId();
    std::wstring sha = Sha256([&, off = (size_t)0](BYTE* b, DWORD n) mutable {
        DWORD c = (DWORD)std::min<size_t>(n, s.jpeg.size() - off);
        memcpy(b, s.jpeg.data() + off, c);
        off += c;
        return c;
    });
    std::wstring q = L"/api/v1/anticheat/screenshots?session_id=" + session + L"&client_id=" + id + L"&sha256=" + sha + L"&width=" + std::to_wstring(s.w) +
                     L"&height=" + std::to_wstring(s.h) + L"&method=" + s.method + L"&kind=" + (request.empty() ? L"auto" : L"manual") + L"&taken_at=" + NowIso();
    if (!request.empty()) q += L"&request_id=" + request;
    ChainItem(session, L"screenshot", sha, id);
    WriteFileAll(Spool() + L"\\" + id + L".jpg", s.jpeg.data(), s.jpeg.size());
    WriteFileAll(Spool() + L"\\" + id + L".meta", q.data(), q.size() * sizeof(wchar_t));
}

// Sube la cola. Sin red o con un error del servidor se conserva; lo que el servidor rechaza se descarta.
void Flush() {
    std::wstring dir = Spool();
    std::vector<std::wstring> names;
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW((dir + L"\\*").c_str(), &fd);
    if (h != INVALID_HANDLE_VALUE) {
        do { if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) names.push_back(fd.cFileName); } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    // Límite de disco: se descarta lo más viejo, y queda registrado.
    if (names.size() > 400) {
        Log(L"cola llena: se descartan archivos viejos");
        for (size_t i = 0; i < names.size() - 400; i++) DeleteFileW((dir + L"\\" + names[i]).c_str());
    }
    std::wstring token = Widen(LoadSecret(L"access"));
    if (token.empty()) return;
    // La clave se registra una vez por vinculación, antes de enviar lo primero que firma.
    if (!g_keySent) {
        auto k = HttpSend(g_api, L"/api/v1/anticheat/key", "{\"public_key\":\"" + PublicKeyB64() + "\"}", L"application/json", token);
        if (k.status == 204) g_keySent = true;
        else { if (k.status != 401 && k.status != 403) Log(L"clave del equipo: la API respondió " + std::to_wstring(k.status)); return; }
    }
    int sentProc = 0;
    for (const auto& n : names) {
        if (WaitForSingleObject(g_quit, 0) == WAIT_OBJECT_0) return;
        std::wstring full = dir + L"\\" + n;
        bool proc = n.size() > 5 && n.ends_with(L".proc");
        bool meta = n.size() > 5 && n.ends_with(L".meta");
        if (!proc && !meta) continue;
        HttpResult r;
        std::wstring jpg;
        std::wstring base = full.substr(0, full.size() - 5);
        std::string hdr = ReadAll(base + L".hdr");
        std::wstring extra;
        size_t nl = hdr.find('\n');
        if (nl != std::string::npos) extra = L"X-AC-Entry: " + Widen(hdr.substr(0, nl)) + L"\r\nX-AC-Sig: " + Widen(hdr.substr(nl + 1)) + L"\r\n";
        if (proc) {
            r = HttpSend(g_api, L"/api/v1/anticheat/processes", ReadAll(full), L"application/json", token, extra);
        } else {
            std::string raw = ReadAll(full);
            std::wstring q((const wchar_t*)raw.data(), raw.size() / sizeof(wchar_t));
            jpg = full.substr(0, full.size() - 5) + L".jpg";
            r = HttpSend(g_api, q.c_str(), ReadAll(jpg), L"image/jpeg", token, extra);
        }
        // 401 y 403: el token venció y el latido lo renueva. No se pierde lo pendiente.
        if (r.status == 0 || r.status == 401 || r.status == 403 || r.status == 429 || r.status >= 500) {
            if (r.status != 401 && r.status != 403) Log(L"cola: la subida respondió " + std::to_wstring(r.status));
            return;  // Se reintenta más tarde
        }
        if (r.status >= 300) Log(L"cola: el servidor rechazó un envío, " + std::to_wstring(r.status));
        else if (proc) sentProc++;
        else Log(L"captura subida");
        DeleteFileW(full.c_str());
        DeleteFileW((base + L".hdr").c_str());
        if (!jpg.empty()) DeleteFileW(jpg.c_str());
    }
    if (sentProc) Log(L"procesos enviados");
}

void Loop() {
    CoInitializeEx(nullptr, COINIT_MULTITHREADED);
    SetThreadPriority(GetCurrentThread(), THREAD_PRIORITY_BELOW_NORMAL);
    std::wstring current;
    std::map<std::wstring, Proc> known;
    ULONGLONG nextScan = 0, nextShot = 0, nextFlush = 0;
    auto schedule = [&](int mn, int mx) { return GetTickCount64() + std::uniform_int_distribution<int>(mn, std::max(mn, mx))(g_rng) * 1000ULL; };

    while (WaitForSingleObject(g_quit, 500) != WAIT_OBJECT_0) {
        std::wstring session;
        std::vector<std::wstring> requests;
        int mn, mx;
        {
            std::lock_guard<std::mutex> l(g_mu);
            session = g_session;
            requests.swap(g_requests);
            mn = g_min;
            mx = g_max;
        }
        if (session != current) {
            current = session;
            known.clear();
            g_files.clear();
            if (!session.empty()) {
                // Inventario inicial
                known = Snapshot();
                std::vector<std::pair<const wchar_t*, Proc>> evs;
                for (auto& [k, p] : known) { Enrich(p); evs.push_back({L"inventory", p}); }
                QueueProcesses(session, evs);
                Log(L"inventario inicial: " + std::to_wstring(evs.size()) + L" procesos");
                nextScan = GetTickCount64() + 10000;
                nextShot = schedule(mn, mx);
            } else {
                Log(L"monitoreo detenido");
            }
        }
        ULONGLONG now = GetTickCount64();
        if (!session.empty()) {
            // Reconciliación: al comparar el estado completo no se pierden eventos.
            if (now >= nextScan) {
                nextScan = now + 10000;
                auto cur = Snapshot();
                std::vector<std::pair<const wchar_t*, Proc>> evs;
                for (auto& [k, p] : cur) {
                    auto it = known.find(k);
                    if (it == known.end()) { Enrich(p); evs.push_back({L"start", p}); }
                    else p = it->second;
                }
                for (auto& [k, p] : known) if (!cur.count(k)) evs.push_back({L"end", p});
                known = std::move(cur);
                if (!evs.empty()) QueueProcesses(session, evs);
            }
            for (const auto& req : requests) {
                AcNotice(L"El staff pidió una captura del juego.");
                Shot s;
                CapResult r = Capture(s);
                Log(std::wstring(L"captura solicitada: ") + (r == CapResult::Ok ? L"tomada" : r == CapResult::NotForeground ? L"juego no al frente" : L"falló"));
                if (r == CapResult::Ok) QueueShot(session, req, s);
                else HttpSend(g_api, (L"/api/v1/anticheat/requests/" + req + L"/result").c_str(), std::string("{\"result\":\"") + (r == CapResult::NotForeground ? "not_foreground" : "failed") + "\"}", L"application/json", Widen(LoadSecret(L"access")));
            }
            if (now >= nextShot) {
                Shot s;
                CapResult r = Capture(s);
                if (r == CapResult::Ok) { QueueShot(session, L"", s); nextShot = g_opt.everySeconds ? now + g_opt.everySeconds * 1000ULL : schedule(mn, mx); }
                else { Log(r == CapResult::NotForeground ? L"captura omitida: juego no al frente" : L"captura fallida"); nextShot = now + (g_opt.everySeconds ? g_opt.everySeconds * 1000ULL : 30000); }
            }
        }
        if (now >= nextFlush) {
            nextFlush = now + 3000;
            Flush();
        }
    }
    CoUninitialize();
}
}  // namespace

static std::thread* g_thread = nullptr;

void EvidenceStart(const std::wstring& api, const EvidenceOptions& opt) {
    g_api = api;
    g_opt = opt;
    g_quit = CreateEventW(nullptr, TRUE, FALSE, nullptr);
    g_thread = new std::thread(Loop);
}

void EvidenceUpdate(const std::wstring& session, int minS, int maxS, const std::vector<std::wstring>& requests) {
    std::lock_guard<std::mutex> l(g_mu);
    g_session = session;
    if (minS > 0) g_min = g_opt.everySeconds ? g_opt.everySeconds : minS;
    if (maxS > 0) g_max = g_opt.everySeconds ? g_opt.everySeconds : maxS;
    g_requests.insert(g_requests.end(), requests.begin(), requests.end());
}

void EvidenceForget() {
    std::wstring dir = DataDir() + L"\\spool";
    WIN32_FIND_DATAW fd;
    HANDLE h = FindFirstFileW((dir + L"\\*").c_str(), &fd);
    if (h != INVALID_HANDLE_VALUE) {
        do { if (!(fd.dwFileAttributes & FILE_ATTRIBUTE_DIRECTORY)) DeleteFileW((dir + L"\\" + fd.cFileName).c_str()); } while (FindNextFileW(h, &fd));
        FindClose(h);
    }
    DeleteSecret(L"devicekey");
    g_keySent = false;
}

void EvidenceStop() {
    if (!g_thread) return;
    SetEvent(g_quit);
    g_thread->join();
    delete g_thread;
    g_thread = nullptr;
}
