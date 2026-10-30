// Prueba de factibilidad de captura (etapa 0b). Descartable: no es el agente.
// No inyecta, no lee memoria de otros procesos y no usa la red.
// Compilar: csc /nologo /platform:x64 /r:System.Drawing.dll /out:CapturaPrueba.exe CapturaPrueba.cs
// Usar:     CapturaPrueba.exe <clase-o-titulo> <carpeta-salida> [etiqueta]
// Las imágenes se guardan solo si la ventana objetivo está en primer plano.
using System;
using System.Drawing;
using System.Drawing.Imaging;
using System.IO;
using System.Runtime.InteropServices;
using System.Text;

static class P
{
    [StructLayout(LayoutKind.Sequential)] struct RECT { public int L, T, R, B; }
    [StructLayout(LayoutKind.Sequential)] struct POINT { public int X, Y; }
    [StructLayout(LayoutKind.Sequential)]
    struct TEXDESC { public uint W, H, Mip, Arr, Fmt, SC, SQ, Usage, Bind, Cpu, Misc; }
    [StructLayout(LayoutKind.Sequential)]
    struct MAPPED { public IntPtr Data; public uint Row, Depth; }

    [DllImport("user32.dll")] static extern bool SetProcessDPIAware();
    [DllImport("user32.dll", CharSet = CharSet.Unicode)] static extern IntPtr FindWindow(string c, string t);
    [DllImport("user32.dll")] static extern IntPtr GetForegroundWindow();
    [DllImport("user32.dll")] static extern bool GetClientRect(IntPtr h, out RECT r);
    [DllImport("user32.dll")] static extern bool ClientToScreen(IntPtr h, ref POINT p);
    [DllImport("user32.dll")] static extern IntPtr GetDC(IntPtr h);
    [DllImport("user32.dll")] static extern int ReleaseDC(IntPtr h, IntPtr dc);
    [DllImport("user32.dll")] static extern bool PrintWindow(IntPtr h, IntPtr dc, uint flags);
    [DllImport("gdi32.dll")] static extern bool BitBlt(IntPtr d, int x, int y, int w, int h, IntPtr s, int sx, int sy, uint op);
    [DllImport("shell32.dll")] static extern int SHQueryUserNotificationState(out int s);
    [DllImport("d3d11.dll")] static extern int D3D11CreateDevice(IntPtr a, int type, IntPtr sw, uint flags, IntPtr lv, uint n, uint sdk, out IntPtr dev, out int got, out IntPtr ctx);

    delegate int QI(IntPtr s, ref Guid g, out IntPtr o);
    delegate uint Rel(IntPtr s);
    delegate int GetObj(IntPtr s, out IntPtr o);
    delegate int EnumO(IntPtr s, uint i, out IntPtr o);
    delegate int Dup(IntPtr s, IntPtr dev, out IntPtr o);
    delegate int Acq(IntPtr s, uint ms, IntPtr info, out IntPtr res);
    delegate int Rls(IntPtr s);
    delegate void GetDesc(IntPtr s, out TEXDESC d);
    delegate int MkTex(IntPtr s, ref TEXDESC d, IntPtr init, out IntPtr o);
    delegate void Copy(IntPtr s, IntPtr dst, IntPtr src);
    delegate int MapF(IntPtr s, IntPtr r, uint sub, int type, uint fl, out MAPPED m);
    delegate void UnmapF(IntPtr s, IntPtr r, uint sub);

    static T V<T>(IntPtr o, int i) where T : class
    {
        IntPtr vt = Marshal.ReadIntPtr(o);
        return Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(vt, i * IntPtr.Size), typeof(T)) as T;
    }
    static void R(IntPtr o) { if (o != IntPtr.Zero) V<Rel>(o, 2)(o); }
    static IntPtr Q(IntPtr o, string g)
    {
        Guid id = new Guid(g); IntPtr r;
        Marshal.ThrowExceptionForHR(V<QI>(o, 0)(o, ref id, out r));
        return r;
    }
    static void H(int hr, string what) { if (hr < 0) throw new Exception(what + " 0x" + hr.ToString("X8")); }

    static string Stats(Bitmap b)
    {
        BitmapData d = b.LockBits(new Rectangle(0, 0, b.Width, b.Height), ImageLockMode.ReadOnly, PixelFormat.Format32bppArgb);
        long sum = 0, n = 0; bool[] seen = new bool[4096]; int distinct = 0;
        int sx = Math.Max(1, b.Width / 200), sy = Math.Max(1, b.Height / 200);
        for (int y = 0; y < b.Height; y += sy)
            for (int x = 0; x < b.Width; x += sx)
            {
                int c = Marshal.ReadInt32(d.Scan0, y * d.Stride + x * 4);
                int r = (c >> 16) & 255, g = (c >> 8) & 255, bl = c & 255;
                sum += (r * 299 + g * 587 + bl * 114) / 1000; n++;
                int k = ((r >> 4) << 8) | ((g >> 4) << 4) | (bl >> 4);
                if (!seen[k]) { seen[k] = true; distinct++; }
            }
        b.UnlockBits(d);
        double lum = n > 0 ? (double)sum / n : 0;
        string v = (lum < 3 || distinct <= 2) ? "NEGRA_O_VACIA" : "CON_CONTENIDO";
        return v + " lum=" + lum.ToString("F1") + " colores=" + distinct + " " + b.Width + "x" + b.Height;
    }

    static Bitmap Dxgi(int cx, int cy, int cw, int ch)
    {
        IntPtr dev = IntPtr.Zero, ctx = IntPtr.Zero, dxgi = IntPtr.Zero, ad = IntPtr.Zero, o = IntPtr.Zero, o1 = IntPtr.Zero, dup = IntPtr.Zero, res = IntPtr.Zero, tex = IntPtr.Zero, st = IntPtr.Zero;
        IntPtr info = Marshal.AllocHGlobal(64);
        try
        {
            int got;
            H(D3D11CreateDevice(IntPtr.Zero, 1, IntPtr.Zero, 0, IntPtr.Zero, 0, 7, out dev, out got, out ctx), "D3D11CreateDevice");
            dxgi = Q(dev, "54ec77fa-1377-44e6-8c32-88fd5f44c84c");
            H(V<GetObj>(dxgi, 7)(dxgi, out ad), "GetAdapter");
            H(V<EnumO>(ad, 7)(ad, 0, out o), "EnumOutputs");
            o1 = Q(o, "00cddea8-939b-4b83-a340-a685226666cc");
            H(V<Dup>(o1, 22)(o1, dev, out dup), "DuplicateOutput");
            int hr = 0; bool ok = false;
            for (int i = 0; i < 12 && !ok; i++)
            {
                hr = V<Acq>(dup, 8)(dup, 500, info, out res);
                if (hr >= 0)
                {
                    // El primer cuadro puede venir vacío: LastPresentTime en 0 significa que no hay imagen nueva.
                    if (Marshal.ReadInt64(info, 0) != 0) ok = true;
                    else { R(res); res = IntPtr.Zero; V<Rls>(dup, 14)(dup); }
                }
                else if ((uint)hr != 0x887A0027) H(hr, "AcquireNextFrame");
            }
            if (!ok) throw new Exception("AcquireNextFrame sin cuadros 0x" + hr.ToString("X8"));
            tex = Q(res, "6f15aaf2-d208-4e89-9ab4-489535d34f9c");
            TEXDESC d; V<GetDesc>(tex, 10)(tex, out d);
            TEXDESC s = d; s.Mip = 1; s.Arr = 1; s.SC = 1; s.SQ = 0; s.Usage = 3; s.Bind = 0; s.Cpu = 0x20000; s.Misc = 0;
            H(V<MkTex>(dev, 5)(dev, ref s, IntPtr.Zero, out st), "CreateTexture2D");
            V<Copy>(ctx, 47)(ctx, st, tex);
            MAPPED m; H(V<MapF>(ctx, 14)(ctx, st, 0, 1, 0, out m), "Map");
            int x0 = Math.Max(0, cx), y0 = Math.Max(0, cy);
            int w = Math.Min(cw, (int)d.W - x0), h = Math.Min(ch, (int)d.H - y0);
            Bitmap b = new Bitmap(w, h, PixelFormat.Format32bppArgb);
            BitmapData bd = b.LockBits(new Rectangle(0, 0, w, h), ImageLockMode.WriteOnly, PixelFormat.Format32bppArgb);
            byte[] line = new byte[w * 4];
            for (int y = 0; y < h; y++)
            {
                Marshal.Copy(new IntPtr(m.Data.ToInt64() + (y + y0) * m.Row + x0 * 4), line, 0, line.Length);
                Marshal.Copy(line, 0, new IntPtr(bd.Scan0.ToInt64() + y * bd.Stride), line.Length);
            }
            b.UnlockBits(bd);
            V<UnmapF>(ctx, 15)(ctx, st, 0);
            V<Rls>(dup, 14)(dup);
            return b;
        }
        finally
        {
            Marshal.FreeHGlobal(info);
            R(st); R(tex); R(res); R(dup); R(o1); R(o); R(ad); R(dxgi); R(ctx); R(dev);
        }
    }

    static int Main(string[] a)
    {
        if (a.Length < 2) { Console.WriteLine("uso: CapturaPrueba <clase-o-titulo> <salida> [etiqueta]"); return 2; }
        SetProcessDPIAware();
        IntPtr w = FindWindow(a[0], null);
        if (w == IntPtr.Zero) w = FindWindow(null, a[0]);
        if (w == IntPtr.Zero) { Console.WriteLine("SIN_VENTANA " + a[0]); return 1; }
        string tag = a.Length > 2 ? a[2] : "prueba";
        if (a.Length > 3) solo = a[3];
        Directory.CreateDirectory(a[1]);
        RECT rc; GetClientRect(w, out rc);
        POINT p = new POINT(); ClientToScreen(w, ref p);
        int cw = rc.R - rc.L, ch = rc.B - rc.T;
        bool fg = GetForegroundWindow() == w;
        int quns; SHQueryUserNotificationState(out quns);
        Console.WriteLine("ventana=" + a[0] + " cliente=" + cw + "x" + ch + " origen=" + p.X + "," + p.Y + " primer_plano=" + fg + " quns=" + quns + " (3=D3D exclusivo)");
        if (cw <= 0 || ch <= 0) { Console.WriteLine("VENTANA_SIN_AREA"); return 1; }

        Run("BitBlt_pantalla", tag, a[1], fg, delegate
        {
            Bitmap b = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(b))
            {
                IntPtr d = g.GetHdc(); IntPtr s = GetDC(IntPtr.Zero);
                BitBlt(d, 0, 0, cw, ch, s, p.X, p.Y, 0x00CC0020);
                ReleaseDC(IntPtr.Zero, s); g.ReleaseHdc(d);
            }
            return b;
        });
        Run("BitBlt_ventana", tag, a[1], fg, delegate
        {
            Bitmap b = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(b))
            {
                IntPtr d = g.GetHdc(); IntPtr s = GetDC(w);
                BitBlt(d, 0, 0, cw, ch, s, 0, 0, 0x00CC0020);
                ReleaseDC(w, s); g.ReleaseHdc(d);
            }
            return b;
        });
        Run("PrintWindow", tag, a[1], fg, delegate
        {
            Bitmap b = new Bitmap(cw, ch, PixelFormat.Format32bppArgb);
            using (Graphics g = Graphics.FromImage(b))
            {
                IntPtr d = g.GetHdc();
                PrintWindow(w, d, 3); // PW_CLIENTONLY | PW_RENDERFULLCONTENT
                g.ReleaseHdc(d);
            }
            return b;
        });
        Run("DesktopDuplication", tag, a[1], fg, delegate { return Dxgi(p.X, p.Y, cw, ch); });
        return 0;
    }

    delegate Bitmap Cap();
    static string solo; // opcional, cuarto argumento: correr un solo método
    static void Run(string name, string tag, string dir, bool save, Cap c)
    {
        if (solo != null && solo != name) return;
        System.Diagnostics.Stopwatch sw = System.Diagnostics.Stopwatch.StartNew();
        try
        {
            using (Bitmap b = c())
            {
                sw.Stop();
                string st = Stats(b);
                if (save) b.Save(Path.Combine(dir, tag + "_" + name + ".jpg"), ImageFormat.Jpeg);
                Console.WriteLine(name + ": " + st + " ms=" + sw.ElapsedMilliseconds + (save ? " guardada" : " sin_guardar"));
            }
        }
        catch (Exception e) { Console.WriteLine(name + ": ERROR " + e.Message); }
    }
}
