// Interfaz dibujada con GDI+: oscura y compacta, con un estado grande y las comprobaciones debajo.
#include "core.h"
#include <objidl.h>
#include <gdiplus.h>
#include <algorithm>
#include <string>
#include <vector>

using namespace Gdiplus;

namespace {
const Color kBg(255, 10, 10, 10), kCard(255, 23, 23, 23), kLine(255, 38, 38, 38), kText(255, 250, 250, 250), kMuted(255, 161, 161, 161),
    kBrand(255, 255, 105, 0), kOk(255, 34, 197, 94), kBad(255, 239, 68, 68), kGrey(255, 115, 115, 115);
ULONG_PTR g_token = 0;

struct Look { Color color; const wchar_t* title; const wchar_t* text; };

Look LookOf(const UiState& s) {
    switch (s.screen) {
        case Screen::Unlinked: return {kGrey, L"Vincula tu cuenta", L"Inicia sesión en cmleague.lat para jugar los mixes."};
        case Screen::Linking: return {kBrand, L"Confirma en la web", L"Revisa que este código sea el mismo que ves en cmleague.lat."};
        case Screen::Ready: return {kBrand, L"Listo para jugar", L"Entra a un servidor de CMLeague y se abrirá tu sesión."};
        case Screen::Session: return {kOk, L"Sesión activa", L"Deja esta aplicación abierta hasta terminar el mix."};
        case Screen::Offline: return {kBad, L"Sin conexión", L"Sin conexión con CMLeague un mix puede expulsarte. Reintentando…"};
        default: return {kBrand, L"Antes de empezar", L""};
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

void Text(Graphics& g, const wchar_t* s, REAL x, REAL y, REAL w, REAL h, REAL size, const Color& c, int style = FontStyleRegular,
          StringAlignment al = StringAlignmentNear, StringAlignment va = StringAlignmentNear) {
    FontFamily fam(L"Segoe UI");
    Font f(&fam, size, style, UnitPixel);
    SolidBrush b(c);
    StringFormat fmt;
    fmt.SetAlignment(al);
    fmt.SetLineAlignment(va);
    g.DrawString(s, -1, &f, RectF(x, y, w, h), &fmt, &b);
}

// El isotipo: cuadrado naranja con las iniciales.
void Logo(Graphics& g, REAL x, REAL y, REAL size) {
    FillRound(g, kBrand, x, y, size, size, size / 4);
    Text(g, L"CM", x, y, size, size, size * 0.46f, kBg, FontStyleBold, StringAlignmentCenter, StringAlignmentCenter);
}

void Shield(Graphics& g, REAL cx, REAL top, REAL size, const Color& c, bool check) {
    REAL w = size * 0.82f, l = cx - w / 2, r = cx + w / 2, h = size;
    GraphicsPath p;
    p.StartFigure();
    p.AddLine(cx, top, r, top + h * 0.16f);
    p.AddBezier(r, top + h * 0.16f, r, top + h * 0.62f, cx + w * 0.3f, top + h * 0.86f, cx, top + h);
    p.AddBezier(cx, top + h, cx - w * 0.3f, top + h * 0.86f, l, top + h * 0.62f, l, top + h * 0.16f);
    p.CloseFigure();
    SolidBrush fill(Color(38, c.GetR(), c.GetG(), c.GetB()));
    g.FillPath(&fill, &p);
    Pen pen(c, 3.5f);
    pen.SetLineJoin(LineJoinRound);
    g.DrawPath(&pen, &p);
    if (check) {
        Pen mark(c, 5.5f);
        mark.SetStartCap(LineCapRound);
        mark.SetEndCap(LineCapRound);
        mark.SetLineJoin(LineJoinRound);
        PointF pts[] = {{cx - w * 0.2f, top + h * 0.5f}, {cx - w * 0.04f, top + h * 0.66f}, {cx + w * 0.24f, top + h * 0.34f}};
        g.DrawLines(&mark, pts, 3);
    } else {
        SolidBrush dot(c);
        g.FillEllipse(&dot, cx - size * 0.05f, top + h * 0.34f, size * 0.1f, size * 0.1f);
        g.FillRectangle(&dot, cx - size * 0.03f, top + h * 0.47f, size * 0.06f, size * 0.2f);
    }
}

RECT Primary() { return {24, 500, kWidth - 24, 546}; }
RECT Secondary() { return {24, 552, kWidth - 24, 586}; }
RECT CloseBtn() { return {kWidth - 40, 12, kWidth - 12, 40}; }
RECT MinBtn() { return {kWidth - 72, 12, kWidth - 44, 40}; }
bool In(const RECT& r, int x, int y) { return x >= r.left && x < r.right && y >= r.top && y < r.bottom; }

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
        case Screen::Linking: return L"Cancelar";
        case Screen::Ready:
        case Screen::Session:
        case Screen::Offline: return L"Desvincular este equipo";
        default: return nullptr;
    }
}

void Button(Graphics& g, const RECT& r, const wchar_t* label, bool primary, bool hover) {
    REAL x = (REAL)r.left, y = (REAL)r.top, w = (REAL)(r.right - r.left), h = (REAL)(r.bottom - r.top);
    if (primary) {
        FillRound(g, hover ? Color(255, 255, 137, 4) : kBrand, x, y, w, h, 10);
        Text(g, label, x, y, w, h, 15, kBg, FontStyleBold, StringAlignmentCenter, StringAlignmentCenter);
    } else {
        Text(g, label, x, y, w, h, 13, hover ? kText : kMuted, FontStyleRegular, StringAlignmentCenter, StringAlignmentCenter);
    }
}

void Row(Graphics& g, REAL y, const wchar_t* name, const wchar_t* value, const Color& c) {
    SolidBrush dot(c);
    g.FillEllipse(&dot, 40.f, y + 12, 8.f, 8.f);
    Text(g, name, 58, y, 130, 32, 14, kMuted, FontStyleRegular, StringAlignmentNear, StringAlignmentCenter);
    Text(g, value, 150, y, kWidth - 150 - 40.f, 32, 14, kText, FontStyleRegular, StringAlignmentFar, StringAlignmentCenter);
}

void DrawConsent(Graphics& g) {
    Text(g, L"Antes de empezar", 24, 76, kWidth - 48.f, 34, 24, kText, FontStyleBold);
    Text(g, L"Esta aplicación vincula tu PC con tu cuenta de CMLeague mientras juegas en nuestros servidores.", 24, 114, kWidth - 48.f, 60, 14, kMuted);
    FillRound(g, kCard, 24, 172, kWidth - 48.f, 112, 12);
    Text(g, L"Qué envía esta versión", 40, 182, kWidth - 80.f, 24, 14, kText, FontStyleBold);
    Text(g, L"• El nombre de tu PC y la versión de la aplicación\n• Tu dirección IP, para confirmar que eres tú\n• Cuándo está abierta, y si tienes sesión activa", 40, 208, kWidth - 80.f, 70, 13.5f, kMuted);
    FillRound(g, kCard, 24, 294, kWidth - 48.f, 136, 12);
    Text(g, L"Qué no hace", 40, 304, kWidth - 80.f, 24, 14, kText, FontStyleBold);
    Text(g, L"• No captura tu pantalla ni lista tus programas\n• No lee la memoria de otros programas\n• No registra lo que escribes\n• No se abre sola con Windows", 40, 330, kWidth - 80.f, 92, 13.5f, kMuted);
    Text(g, L"Si una versión futura recopila más, te lo pedirá antes.", 24, 444, kWidth - 48.f, 40, 13, kMuted);
}

void DrawMain(Graphics& g, const UiState& s) {
    Look l = LookOf(s);
    REAL cx = kWidth / 2.f;
    Shield(g, cx, 76, 96, l.color, s.screen == Screen::Session || s.screen == Screen::Ready);
    Text(g, l.title, 24, 182, kWidth - 48.f, 38, 26, kText, FontStyleBold, StringAlignmentCenter);
    Text(g, l.text, 44, 222, kWidth - 88.f, 44, 14, kMuted, FontStyleRegular, StringAlignmentCenter);

    if (s.screen == Screen::Linking) {
        FillRound(g, kCard, 24, 276, kWidth - 48.f, 92, 12);
        Text(g, L"Tu código", 24, 286, kWidth - 48.f, 22, 13, kMuted, FontStyleRegular, StringAlignmentCenter);
        Text(g, s.userCode.c_str(), 24, 306, kWidth - 48.f, 52, 36, kBrand, FontStyleBold, StringAlignmentCenter, StringAlignmentCenter);
    } else {
        FillRound(g, kCard, 24, 276, kWidth - 48.f, 148, 12);
        Row(g, 284, L"Cuenta", s.linked ? L"Vinculada" : L"Sin vincular", s.linked ? kOk : kGrey);
        Row(g, 318, L"Servicio", s.online ? L"Conectado" : (s.linked ? L"Sin conexión" : L"—"), s.online ? kOk : (s.linked ? kBad : kGrey));
        Row(g, 352, L"ClientMod", s.gameOpen ? L"Abierto" : L"Cerrado", s.gameOpen ? kOk : kGrey);
        Row(g, 386, L"Sesión", s.session ? L"Activa" : L"Sin sesión", s.session ? kOk : kGrey);
    }
    const wchar_t* foot = s.detail.empty() ? L"Esta versión no captura tu pantalla ni lista tus programas." : s.detail.c_str();
    Text(g, foot, 24, 440, kWidth - 48.f, 44, 13, kMuted, FontStyleRegular, StringAlignmentCenter);
}

void Draw(Graphics& g, const UiState& s, int hover) {
    g.SetSmoothingMode(SmoothingModeAntiAlias);
    g.SetTextRenderingHint(TextRenderingHintAntiAliasGridFit);
    g.Clear(kBg);
    Logo(g, 18, 14, 28);
    Text(g, L"CMLeague Anticheat", 54, 8, 240, 22, 14, kText, FontStyleBold);
    Text(g, L"v" AC_VERSION, 54, 28, 200, 18, 12, kGrey);

    RECT c = CloseBtn(), m = MinBtn();
    Pen ic(hover == BtnClose ? kText : kMuted, 1.6f), im(hover == BtnMinimize ? kText : kMuted, 1.6f);
    g.DrawLine(&ic, (INT)c.left + 9, (INT)c.top + 9, (INT)c.right - 9, (INT)c.bottom - 9);
    g.DrawLine(&ic, (INT)c.right - 9, (INT)c.top + 9, (INT)c.left + 9, (INT)c.bottom - 9);
    g.DrawLine(&im, (INT)m.left + 8, (INT)(m.top + m.bottom) / 2, (INT)m.right - 8, (INT)(m.top + m.bottom) / 2);
    Pen line(kLine, 1);
    g.DrawLine(&line, 0, kTitleBar, kWidth, kTitleBar);

    if (s.screen == Screen::Consent) DrawConsent(g);
    else DrawMain(g, s);

    if (const wchar_t* p = PrimaryLabel(s)) Button(g, Primary(), p, true, hover == BtnPrimary);
    if (const wchar_t* b = SecondaryLabel(s)) Button(g, Secondary(), b, false, hover == BtnSecondary);
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
    if (PrimaryLabel(s) && In(Primary(), x, y)) return BtnPrimary;
    if (SecondaryLabel(s) && In(Secondary(), x, y)) return BtnSecondary;
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
