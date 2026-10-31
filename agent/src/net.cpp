// HTTP con WinHTTP y lectura mínima del JSON de nuestra API (objetos con strings y null).
#include "core.h"
#include <winhttp.h>
#include <vector>

std::wstring Widen(const std::string& s) {
    if (s.empty()) return {};
    int n = MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0);
    std::wstring w(n, L'\0');
    MultiByteToWideChar(CP_UTF8, 0, s.data(), (int)s.size(), w.data(), n);
    return w;
}

static std::string Narrow(const std::wstring& s) {
    if (s.empty()) return {};
    int n = WideCharToMultiByte(CP_UTF8, 0, s.data(), (int)s.size(), nullptr, 0, nullptr, nullptr);
    std::string u(n, '\0');
    WideCharToMultiByte(CP_UTF8, 0, s.data(), (int)s.size(), u.data(), n, nullptr, nullptr);
    return u;
}

std::string JsonEscape(const std::wstring& s) {
    std::string in = Narrow(s), out;
    for (unsigned char c : in) {
        if (c == '"' || c == '\\') { out += '\\'; out += (char)c; }
        else if (c >= 0x20) out += (char)c;
    }
    return out;
}

// Posición del valor de "key", o npos.
static size_t ValueAt(const std::string& body, const char* key) {
    std::string k = std::string("\"") + key + "\"";
    size_t p = body.find(k);
    if (p == std::string::npos) return p;
    p = body.find(':', p + k.size());
    if (p == std::string::npos) return p;
    p++;
    while (p < body.size() && (body[p] == ' ' || body[p] == '\n' || body[p] == '\r' || body[p] == '\t')) p++;
    return p < body.size() ? p : std::string::npos;
}

std::string JsonStr(const std::string& body, const char* key) {
    size_t p = ValueAt(body, key);
    if (p == std::string::npos || body[p] != '"') return {};
    std::string v;
    for (size_t i = p + 1; i < body.size() && body[i] != '"'; i++) {
        if (body[i] == '\\' && i + 1 < body.size()) i++;
        v += body[i];
    }
    return v;
}

bool JsonIsNull(const std::string& body, const char* key) {
    size_t p = ValueAt(body, key);
    return p == std::string::npos || body.compare(p, 4, "null") == 0;
}

HttpResult HttpPost(const std::wstring& base, const wchar_t* path, const std::string& json, const std::wstring& agentToken) {
    HttpResult res;
    URL_COMPONENTS u{};
    u.dwStructSize = sizeof(u);
    wchar_t host[256];
    u.lpszHostName = host;
    u.dwHostNameLength = 256;
    if (!WinHttpCrackUrl(base.c_str(), 0, 0, &u)) return res;
    bool tls = u.nScheme == INTERNET_SCHEME_HTTPS;

    HINTERNET ses = WinHttpOpen((std::wstring(L"CMLeagueAC/") + AC_VERSION).c_str(), WINHTTP_ACCESS_TYPE_AUTOMATIC_PROXY, nullptr, nullptr, 0);
    if (!ses) return res;
    WinHttpSetTimeouts(ses, 5000, 5000, 10000, 10000);
    HINTERNET con = WinHttpConnect(ses, host, u.nPort, 0);
    HINTERNET req = con ? WinHttpOpenRequest(con, L"POST", path, nullptr, nullptr, nullptr, tls ? WINHTTP_FLAG_SECURE : 0) : nullptr;
    if (req) {
        std::wstring headers = L"Content-Type: application/json\r\n";
        if (!agentToken.empty()) headers += L"X-Agent-Token: " + agentToken + L"\r\n";
        if (WinHttpSendRequest(req, headers.c_str(), (DWORD)-1, (LPVOID)json.data(), (DWORD)json.size(), (DWORD)json.size(), 0) &&
            WinHttpReceiveResponse(req, nullptr)) {
            DWORD status = 0, len = sizeof(status);
            WinHttpQueryHeaders(req, WINHTTP_QUERY_STATUS_CODE | WINHTTP_QUERY_FLAG_NUMBER, nullptr, &status, &len, nullptr);
            res.status = (int)status;
            for (;;) {
                DWORD avail = 0;
                if (!WinHttpQueryDataAvailable(req, &avail) || avail == 0 || res.body.size() > 256 * 1024) break;
                std::vector<char> buf(avail);
                DWORD read = 0;
                if (!WinHttpReadData(req, buf.data(), avail, &read) || read == 0) break;
                res.body.append(buf.data(), read);
            }
        }
        WinHttpCloseHandle(req);
    }
    if (con) WinHttpCloseHandle(con);
    WinHttpCloseHandle(ses);
    return res;
}
