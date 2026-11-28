// Cadenas cifradas con XOR en el .exe (docs/bitacora/2026-11-27-anticheat-deteccion). Se descifran al usarlas.
// Sube el costo de leer qué busca el agente con un editor; no reemplaza a un empaquetador.
#pragma once
#include <string>
#include <utility>

namespace obf {
constexpr wchar_t kKey = 0x5A3C;

template <size_t N>
struct Str {
    wchar_t data[N];
    constexpr Str(const wchar_t (&s)[N]) : data{} {
        for (size_t i = 0; i < N; i++) data[i] = (wchar_t)(s[i] ^ (wchar_t)(kKey + i * 7));
    }
    std::wstring get() const {
        std::wstring out(N - 1, L'\0');
        for (size_t i = 0; i + 1 < N; i++) out[i] = (wchar_t)(data[i] ^ (wchar_t)(kKey + i * 7));
        return out;
    }
};
}  // namespace obf

// OBF(L"texto") da un std::wstring; el literal en claro no queda en el binario.
#define OBF(s) ([]() { static constexpr obf::Str<sizeof(s) / sizeof(wchar_t)> o(s); return o.get(); }())
