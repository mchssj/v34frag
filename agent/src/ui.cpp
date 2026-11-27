// Interfaz dibujada con GDI+: oscura y compacta.
#include "core.h"
#include <objidl.h>
#include <shlwapi.h>
#include <gdiplus.h>
#include <algorithm>
#include <string>
#include <vector>

using namespace Gdiplus;

#pragma comment(lib, "shlwapi")

namespace {
const Color kBg(255, 10, 10, 10), kCard(255, 23, 23, 23), kLine(255, 38, 38, 38), kText(255, 250, 250, 250), kMuted(255, 161, 161, 161),
    kBrand(255, 255, 105, 0), kOk(255, 34, 197, 94), kBad(255, 239, 68, 68), kGrey(255, 115, 115, 115);
ULONG_PTR g_token = 0;

// Ventana horizontal: perfil arriba, una tarjeta de estado y la línea de conexión abajo
// (docs/bitacora/2026-11-27-anticheat-ventana-nueva). No dice qué detecta.
enum class Tone { Ok, Warn, Bad, Idle };

Color ToneColor(Tone t) {
    switch (t) {
        case Tone::Ok: return kOk;
        case Tone::Warn: return kBrand;
        case Tone::Bad: return kBad;
        default: return kGrey;
    }
}

struct Look { Tone tone; const wchar_t* title; const wchar_t* text; };

Look LookOf(const UiState& s) {
    switch (s.screen) {
        case Screen::Unlinked: return {Tone::Idle, L"Vincula tu cuenta", L"Inicia sesión en cmleague.lat para jugar los mixes."};
        case Screen::Linking: return {Tone::Warn, L"Confirma en la web", L"Aprueba este código en cmleague.lat."};
        case Screen::Ready: return {Tone::Ok, L"Todo listo para jugar", L"Entra a un servidor de CMLeague para jugar."};
        case Screen::Session: return {Tone::Ok, L"Sesión activa", L"Deja esta aplicación abierta hasta terminar el mix."};
        case Screen::Offline: return {Tone::Bad, L"Sin conexión con CMLeague", L"Reintentando. Sin conexión, un mix puede expulsarte."};
        default: return {Tone::Warn, L"Antes de empezar", L""};
    }
}

GraphicsPath* RoundRect(REAL x, REAL y, REAL w, REAL h, REAL r) {
    auto* p = new GraphicsPath();
    p->AddArc(x, y, r * 2, r * 2, 180, 90);
    p->AddArc(x + w - r * 2, y, r * 2, r * 2, 270, 90);
    p->AddArc(x + w - r * 2, y + h - r * 2, r * 2, r * 2, 0, 90);
    p->AddArc(x, y + h - r * 2, r * 2, r * 2, 90, 90);
    p->CloseFigure();
    return p;
}

void FillRound(Graphics& g, const Color& c, REAL x, REAL y, REAL w, REAL h, REAL r) {
    SolidBrush b(c);
    GraphicsPath* p = RoundRect(x, y, w, h, r);
    g.FillPath(&b, p);
    delete p;
}

void StrokeRound(Graphics& g, const Color& c, REAL x, REAL y, REAL w, REAL h, REAL r) {
    Pen pen(c, 1);
    GraphicsPath* p = RoundRect(x, y, w, h, r);
    g.DrawPath(&pen, p);
    delete p;
}

void Text(Graphics& g, const wchar_t* s, REAL x, REAL y, REAL w, REAL h, REAL size, const Color& c, int style = FontStyleRegular,
          StringAlignment al = StringAlignmentNear, StringAlignment va = StringAlignmentNear) {
    FontFamily fam(L"Segoe UI");
    Font f(&fam, size, style, UnitPixel);
    SolidBrush b(c);
    StringFormat fmt;
    fmt.SetAlignment(al);
    fmt.SetLineAlignment(va);
    fmt.SetTrimming(StringTrimmingEllipsisCharacter);
    g.DrawString(s, -1, &f, RectF(x, y, w, h), &fmt, &b);
}

REAL TextWidth(Graphics& g, const wchar_t* s, REAL size, int style = FontStyleRegular) {
    FontFamily fam(L"Segoe UI");
    Font f(&fam, size, style, UnitPixel);
    RectF out;
    g.MeasureString(s, -1, &f, PointF(0, 0), &out);
    return out.Width;
}

// El isotipo: cuadrado naranja con las iniciales.
void Logo(Graphics& g, REAL x, REAL y, REAL size) {
    FillRound(g, kBrand, x, y, size, size, size / 4);
    Text(g, L"CM", x, y, size, size, size * 0.46f, kBg, FontStyleBold, StringAlignmentCenter, StringAlignmentCenter);
}

// Ícono de la tarjeta: un círculo con un tilde, un signo de admiración o una cruz.
void StatusIcon(Graphics& g, REAL x, REAL y, REAL size, Tone t) {
    Color c = ToneColor(t);
    SolidBrush fill(Color(40, c.GetR(), c.GetG(), c.GetB()));
    g.FillEllipse(&fill, x, y, size, size);
    Pen pen(c, 2.6f);
    pen.SetStartCap(LineCapRound);
    pen.SetEndCap(LineCapRound);
    pen.SetLineJoin(LineJoinRound);
    REAL cx = x + size / 2, cy = y + size / 2, k = size * 0.22f;
    if (t == Tone::Ok) {
        PointF pts[] = {{cx - k, cy + k * 0.05f}, {cx - k * 0.25f, cy + k * 0.8f}, {cx + k * 1.1f, cy - k * 0.75f}};
        g.DrawLines(&pen, pts, 3);
    } else if (t == Tone::Bad) {
        g.DrawLine(&pen, cx - k, cy - k, cx + k, cy + k);
        g.DrawLine(&pen, cx + k, cy - k, cx - k, cy + k);
    } else {
        g.DrawLine(&pen, cx, cy - k * 1.1f, cx, cy + k * 0.25f);
        SolidBrush dot(c);
        g.FillEllipse(&dot, cx - 1.7f, cy + k * 0.75f, 3.4f, 3.4f);
    }
}

// La foto del perfil, decodificada una vez por cada imagen nueva.
Bitmap* AvatarBitmap(const std::shared_ptr<const std::vector<BYTE>>& bytes) {
    static std::shared_ptr<const std::vector<BYTE>> cachedBytes;
    static std::unique_ptr<Bitmap> cached;
    if (bytes != cachedBytes) {
        cachedBytes = bytes;
        cached.reset();
        if (bytes && !bytes->empty()) {
            if (IStream* st = SHCreateMemStream(bytes->data(), (UINT)bytes->size())) {
                std::unique_ptr<Bitmap> b(Bitmap::FromStream(st));
                st->Release();
                if (b && b->GetLastStatus() == Ok) cached = std::move(b);
            }
        }
    }
    return cached.get();
}

void Avatar(Graphics& g, const UiState& s, REAL x, REAL y, REAL size) {
    GraphicsPath circle;
    circle.AddEllipse(x, y, size, size);
    if (Bitmap* b = AvatarBitmap(s.avatar)) {
        g.SetClip(&circle);
        // Recorte al centro, para que una foto que no es cuadrada no se deforme.
        REAL w = (REAL)b->GetWidth(), h = (REAL)b->GetHeight(), side = std::min(w, h);
        g.DrawImage(b, RectF(x, y, size, size), (w - side) / 2, (h - side) / 2, side, side, UnitPixel);
        g.ResetClip();
    } else {
        SolidBrush bg(kLine);
        g.FillPath(&bg, &circle);
        wchar_t initial[2] = {s.nick.empty() ? L'?' : (wchar_t)towupper(s.nick[0]), 0};
        Text(g, initial, x, y, size, size, size * 0.42f, kText, FontStyleBold, StringAlignmentCenter, StringAlignmentCenter);
    }
    Pen ring(kLine, 1.5f);
    g.DrawEllipse(&ring, x, y, size, size);
}

bool HasProfile(const UiState& s) { return s.screen == Screen::Ready || s.screen == Screen::Session || s.screen == Screen::Offline; }

RECT CloseBtn() { return {kWidth - 38, 6, kWidth - 8, 34}; }
RECT MinBtn() { return {kWidth - 70, 6, kWidth - 40, 34}; }
RECT HeaderLink() { return {kWidth - 150, 60, kWidth - 20, 86}; }  // CERRAR SESIÓN o CANCELAR, arriba a la derecha
RECT PrivacyLink() { return {42, 186, 260, 208}; }                 // En el consentimiento
bool In(const RECT& r, int x, int y) { return x >= r.left && x < r.right && y >= r.top && y < r.bottom; }

RECT Primary(const UiState& s) {
    if (s.screen == Screen::Consent) return {kWidth - 224, 270, kWidth - 24, 306};
    return {24, 234, kWidth - 24, 272};
}
RECT Secondary(const UiState& s) {
    if (s.screen == Screen::Consent) return {24, 270, 200, 306};
    return HeaderLink();
}

const wchar_t* PrimaryLabel(const UiState& s) {
    switch (s.screen) {
        case Screen::Consent: return L"Acepto";
        case Screen::Unlinked: return L"Vincular con cmleague.lat";
        case Screen::Linking: return L"Abrir la web otra vez";
        default: return nullptr;
    }
}

const wchar_t* SecondaryLabel(const UiState& s) {
    switch (s.screen) {
        case Screen::Consent: return L"No acepto y salir";
        case Screen::Linking: return L"CANCELAR";
        case Screen::Ready:
        case Screen::Session:
        case Screen::Offline: return L"CERRAR SESIÓN";
        default: return nullptr;
    }
}

void Button(Graphics& g, const RECT& r, const wchar_t* label, bool primary, bool hover) {
    REAL x = (REAL)r.left, y = (REAL)r.top, w = (REAL)(r.right - r.left), h = (REAL)(r.bottom - r.top);
    if (primary) {
        FillRound(g, hover ? Color(255, 255, 137, 4) : kBrand, x, y, w, h, 8);
        Text(g, label, x, y, w, h, 14, kBg, FontStyleBold, StringAlignmentCenter, StringAlignmentCenter);
    } else {
        bool caps = label[0] && label[1] && iswupper(label[1]);  // CERRAR SESIÓN y CANCELAR van a la derecha, como un enlace
        Text(g, label, x, y, w, h, caps ? 12.5f : 13, hover ? kText : kMuted, caps ? FontStyleBold : FontStyleRegular,
             caps ? StringAlignmentFar : StringAlignmentCenter, StringAlignmentCenter);
    }
}

// Sin decir qué hace ni qué recopila (Kyan, 2026-11-27): lo que exige la ley está en /privacidad, con el enlace.
void DrawConsent(Graphics& g, int hover) {
    Logo(g, 24, 58, 52);
    Text(g, L"Bienvenido a CMLeague Anticheat", 90, 60, kWidth - 90 - 24.f, 26, 17, kText, FontStyleBold, StringAlignmentNear, StringAlignmentCenter);
    Text(g, L"Para jugar los mixes de CMLeague", 90, 86, kWidth - 90 - 24.f, 20, 12.5f, kMuted, FontStyleRegular, StringAlignmentNear, StringAlignmentCenter);
    FillRound(g, kCard, 24, 128, kWidth - 48.f, 92, 10);
    Text(g, L"Al aceptar, aceptas los términos y la política de privacidad de CMLeague.", 42, 142, kWidth - 84.f, 40, 13, kText);
    RECT l = PrivacyLink();
    Text(g, L"Ver la política de privacidad", (REAL)l.left, (REAL)l.top, (REAL)(l.right - l.left), (REAL)(l.bottom - l.top), 13,
         hover == BtnLink ? Color(255, 255, 137, 4) : kBrand, FontStyleUnderline, StringAlignmentNear, StringAlignmentCenter);
}

void DrawHeader(Graphics& g, const UiState& s) {
    if (HasProfile(s)) {
        Avatar(g, s, 24, 58, 52);
        Text(g, s.nick.empty() ? L"Tu cuenta" : s.nick.c_str(), 90, 60, kWidth - 90 - 160.f, 26, 17, kText, FontStyleBold, StringAlignmentNear, StringAlignmentCenter);
        Text(g, s.memberSince.c_str(), 90, 86, kWidth - 90 - 24.f, 20, 12.5f, kMuted, FontStyleRegular, StringAlignmentNear, StringAlignmentCenter);
    } else {
        Logo(g, 24, 58, 52);
        Text(g, L"CMLeague Anticheat", 90, 60, kWidth - 90 - 160.f, 26, 17, kText, FontStyleBold, StringAlignmentNear, StringAlignmentCenter);
        Text(g, L"Con tu cuenta de cmleague.lat", 90, 86, kWidth - 90 - 24.f, 20, 12.5f, kMuted, FontStyleRegular, StringAlignmentNear, StringAlignmentCenter);
    }
}

void DrawCard(Graphics& g, const UiState& s) {
    Look l = LookOf(s);
    Color c = ToneColor(l.tone);
    REAL x = 24, y = 128, w = kWidth - 48.f, h = 92;
    FillRound(g, Color(24, c.GetR(), c.GetG(), c.GetB()), x, y, w, h, 10);
    StrokeRound(g, Color(90, c.GetR(), c.GetG(), c.GetB()), x, y, w, h, 10);
    StatusIcon(g, x + 18, y + (h - 30) / 2, 30, l.tone);
    REAL tx = x + 62, tw = w - 62 - 18;
    if (s.screen == Screen::Linking) tw -= 170;  // Lugar para el código
    const wchar_t* line = !s.detail.empty() && (s.screen == Screen::Unlinked || s.screen == Screen::Offline) ? s.detail.c_str() : l.text;
    Text(g, l.title, tx, y + 18, tw, 24, 15, kText, FontStyleBold, StringAlignmentNear, StringAlignmentCenter);
    Text(g, line, tx, y + 44, tw, 34, 12.5f, kMuted);
    if (s.screen == Screen::Linking)
        Text(g, s.userCode.c_str(), x + w - 18 - 180, y, 180, h, 24, kBrand, FontStyleBold, StringAlignmentFar, StringAlignmentCenter);
}

void DrawFooter(Graphics& g, const UiState& s) {
    REAL y = 284, h = 24;
    if (!HasProfile(s)) {
        if (s.screen == Screen::Unlinked || s.screen == Screen::Linking)
            return;  // El botón ocupa ese lugar
    }
    Pen divider(kLine, 1);
    g.DrawLine(&divider, 24.f, y - 12, kWidth - 24.f, y - 12);
    bool on = s.online;
    SolidBrush dot(on ? kOk : kBad);
    g.FillEllipse(&dot, 26.f, y + h / 2 - 4, 8.f, 8.f);
    const wchar_t* conn = on ? L"Conectado" : L"Sin conexión";
    Text(g, conn, 42, y, 120, h, 13, kText, FontStyleBold, StringAlignmentNear, StringAlignmentCenter);
    REAL sep = 42 + TextWidth(g, conn, 13, FontStyleBold) + 8;
    Pen line(kLine, 1.5f);
    g.DrawLine(&line, sep, y + 5, sep, y + h - 5);
    std::wstring state;
    if (!on) state = L"Reintentando…";
    else if (s.session) state = s.serverName.empty() ? L"En partida" : L"En partida en " + s.serverName;
    else state = L"Esperando una partida…";  // Sin decir qué mira del juego (Kyan, 2026-11-27)
    Text(g, state.c_str(), sep + 10, y, kWidth - sep - 10 - 24, h, 13, kMuted, FontStyleRegular, StringAlignmentNear, StringAlignmentCenter);
}

void Draw(Graphics& g, const UiState& s, int hover) {
    g.SetSmoothingMode(SmoothingModeAntiAlias);
    g.SetTextRenderingHint(TextRenderingHintAntiAliasGridFit);
    g.SetInterpolationMode(InterpolationModeHighQualityBicubic);
    g.Clear(kBg);
    Pen border(kLine, 1);
    g.DrawRectangle(&border, 0, 0, kWidth - 1, kHeight - 1);

    Logo(g, 14, 10, 20);
    Text(g, L"CMLeague Anticheat", 42, 8, 200, 24, 13, kText, FontStyleBold, StringAlignmentNear, StringAlignmentCenter);
    Text(g, L"v" AC_VERSION, 42 + TextWidth(g, L"CMLeague Anticheat", 13, FontStyleBold) + 2, 8, 80, 24, 11, kGrey, FontStyleRegular, StringAlignmentNear, StringAlignmentCenter);

    RECT c = CloseBtn(), m = MinBtn();
    Pen ic(hover == BtnClose ? kText : kMuted, 1.5f), im(hover == BtnMinimize ? kText : kMuted, 1.5f);
    g.DrawLine(&ic, (INT)c.left + 10, (INT)c.top + 9, (INT)c.right - 10, (INT)c.bottom - 9);
    g.DrawLine(&ic, (INT)c.right - 10, (INT)c.top + 9, (INT)c.left + 10, (INT)c.bottom - 9);
    g.DrawLine(&im, (INT)m.left + 9, (INT)(m.top + m.bottom) / 2, (INT)m.right - 9, (INT)(m.top + m.bottom) / 2);
    Pen line(kLine, 1);
    g.DrawLine(&line, 0, kTitleBar, kWidth, kTitleBar);

    if (s.screen == Screen::Consent) {
        DrawConsent(g, hover);
    } else {
        DrawHeader(g, s);
        DrawCard(g, s);
        DrawFooter(g, s);
    }

    if (const wchar_t* p = PrimaryLabel(s)) Button(g, Primary(s), p, true, hover == BtnPrimary);
    if (const wchar_t* b = SecondaryLabel(s)) Button(g, Secondary(s), b, false, hover == BtnSecondary);
}

bool PngClsid(CLSID* id) {
    UINT n = 0, size = 0;
    GetImageEncodersSize(&n, &size);
    std::vector<BYTE> buf(size);
    auto* e = (ImageCodecInfo*)buf.data();
    GetImageEncoders(n, size, e);
    for (UINT i = 0; i < n; i++)
        if (wcscmp(e[i].MimeType, L"image/png") == 0) { *id = e[i].Clsid; return true; }
    return false;
}
}  // namespace

void UiInit() {
    GdiplusStartupInput in;
    GdiplusStartup(&g_token, &in, nullptr);
}
void UiShutdown() { GdiplusShutdown(g_token); }

void UiPaint(HDC dc, const UiState& s, float scale, int hover) {
    int w = (int)(kWidth * scale), h = (int)(kHeight * scale);
    Bitmap back(w, h, PixelFormat32bppARGB);
    Graphics g(&back);
    g.ScaleTransform(scale, scale);
    Draw(g, s, hover);
    Graphics(dc).DrawImage(&back, 0, 0);
}

int UiHitTest(const UiState& s, int x, int y) {
    if (In(CloseBtn(), x, y)) return BtnClose;
    if (In(MinBtn(), x, y)) return BtnMinimize;
    if (PrimaryLabel(s) && In(Primary(s), x, y)) return BtnPrimary;
    if (SecondaryLabel(s) && In(Secondary(s), x, y)) return BtnSecondary;
    if (s.screen == Screen::Consent && In(PrivacyLink(), x, y)) return BtnLink;
    return BtnNone;
}

bool UiRenderPng(const UiState& s, const wchar_t* path) {
    Bitmap back(kWidth, kHeight, PixelFormat32bppARGB);
    {
        Graphics g(&back);
        Draw(g, s, BtnNone);
    }
    CLSID id;
    return PngClsid(&id) && back.Save(path, &id) == Ok;
}

bool UiEncodeJpeg(const BYTE* bgra, int w, int h, int stride, int quality, std::vector<BYTE>& out, int* outW, int* outH) {
    UINT n = 0, size = 0;
    GetImageEncodersSize(&n, &size);
    std::vector<BYTE> buf(size);
    auto* e = (ImageCodecInfo*)buf.data();
    GetImageEncoders(n, size, e);
    CLSID id{};
    bool found = false;
    for (UINT i = 0; i < n; i++)
        if (wcscmp(e[i].MimeType, L"image/jpeg") == 0) { id = e[i].Clsid; found = true; }
    if (!found) return false;
    Bitmap src(w, h, stride, PixelFormat32bppRGB, const_cast<BYTE*>(bgra));
    // Como mucho 1280 px de ancho (Kyan, 2026-11-27): con una captura cada 30 s y 7 días, entra en el disco del VPS.
    const int maxW = 1280;
    int ow = w > maxW ? maxW : w, oh = w > maxW ? (int)((long long)h * maxW / w) : h;
    Bitmap b(ow, oh, PixelFormat32bppRGB);
    {
        Graphics g(&b);
        g.SetInterpolationMode(InterpolationModeHighQualityBilinear);
        g.DrawImage(&src, 0, 0, ow, oh);
    }
    if (outW) *outW = ow;
    if (outH) *outH = oh;
    EncoderParameters p{};
    ULONG q = (ULONG)quality;
    p.Count = 1;
    p.Parameter[0].Guid = EncoderQuality;
    p.Parameter[0].NumberOfValues = 1;
    p.Parameter[0].Type = EncoderParameterValueTypeLong;
    p.Parameter[0].Value = &q;
    IStream* st = nullptr;
    if (FAILED(CreateStreamOnHGlobal(nullptr, TRUE, &st))) return false;
    bool ok = b.Save(st, &id, &p) == Ok;
    if (ok) {
        STATSTG stat{};
        st->Stat(&stat, STATFLAG_NONAME);
        out.resize((size_t)stat.cbSize.QuadPart);
        LARGE_INTEGER zero{};
        st->Seek(zero, STREAM_SEEK_SET, nullptr);
        ULONG read = 0;
        ok = SUCCEEDED(st->Read(out.data(), (ULONG)out.size(), &read)) && read == out.size() && !out.empty();
    }
    st->Release();
    return ok;
}

HICON UiMakeIcon(int size) {
    Bitmap b(size, size, PixelFormat32bppARGB);
    {
        Graphics g(&b);
        g.SetSmoothingMode(SmoothingModeAntiAlias);
        g.SetTextRenderingHint(TextRenderingHintAntiAliasGridFit);
        g.Clear(Color(0, 0, 0, 0));
        Logo(g, 0, 0, (REAL)size);
    }
    HICON ic = nullptr;
    b.GetHICON(&ic);
    return ic;
}
