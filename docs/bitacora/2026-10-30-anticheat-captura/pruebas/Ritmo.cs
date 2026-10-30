// Mide el tiempo entre cuadros del escritorio con Desktop Duplication mientras otro proceso captura.
// Descartable. No toca el juego. Fases de 30 s: sin capturas, BitBlt_pantalla y DesktopDuplication cada 5 s.
// Compilar: csc /nologo /platform:x64 /out:Ritmo.exe Ritmo.cs
// Usar:     Ritmo.exe <CapturaPrueba.exe> <titulo-ventana> <carpeta-salida>
using System;
using System.Collections.Generic;
using System.Diagnostics;
using System.Runtime.InteropServices;

static class R
{
    [DllImport("d3d11.dll")] static extern int D3D11CreateDevice(IntPtr a, int type, IntPtr sw, uint flags, IntPtr lv, uint n, uint sdk, out IntPtr dev, out int got, out IntPtr ctx);
    [DllImport("kernel32.dll")] static extern bool QueryPerformanceFrequency(out long f);
    [DllImport("kernel32.dll")] static extern bool QueryPerformanceCounter(out long c);
    delegate int QI(IntPtr s, ref Guid g, out IntPtr o);
    delegate uint Rel(IntPtr s);
    delegate int GetObj(IntPtr s, out IntPtr o);
    delegate int EnumO(IntPtr s, uint i, out IntPtr o);
    delegate int Dup(IntPtr s, IntPtr dev, out IntPtr o);
    delegate int Acq(IntPtr s, uint ms, IntPtr info, out IntPtr res);
    delegate int Rls(IntPtr s);
    static T V<T>(IntPtr o, int i) where T : class
    {
        IntPtr vt = Marshal.ReadIntPtr(o);
        return Marshal.GetDelegateForFunctionPointer(Marshal.ReadIntPtr(vt, i * IntPtr.Size), typeof(T)) as T;
    }
    static IntPtr Q(IntPtr o, string g)
    {
        Guid id = new Guid(g); IntPtr r;
        Marshal.ThrowExceptionForHR(V<QI>(o, 0)(o, ref id, out r));
        return r;
    }

    static int Main(string[] a)
    {
        long f; QueryPerformanceFrequency(out f);
        IntPtr dev, ctx, ad, o, dup, res; int got;
        Marshal.ThrowExceptionForHR(D3D11CreateDevice(IntPtr.Zero, 1, IntPtr.Zero, 0, IntPtr.Zero, 0, 7, out dev, out got, out ctx));
        IntPtr dx = Q(dev, "54ec77fa-1377-44e6-8c32-88fd5f44c84c");
        Marshal.ThrowExceptionForHR(V<GetObj>(dx, 7)(dx, out ad));
        Marshal.ThrowExceptionForHR(V<EnumO>(ad, 7)(ad, 0, out o));
        IntPtr o1 = Q(o, "00cddea8-939b-4b83-a340-a685226666cc");
        Marshal.ThrowExceptionForHR(V<Dup>(o1, 22)(o1, dev, out dup));
        IntPtr info = Marshal.AllocHGlobal(64);

        string[] fases = { "sin_capturas", "BitBlt_pantalla", "DesktopDuplication" };
        List<double>[] gaps = { new List<double>(), new List<double>(), new List<double>() };
        long[] cuadros = new long[3];
        double[] maxTrasCaptura = new double[3];
        long ini; QueryPerformanceCounter(out ini);
        long prev = 0, ultimaCaptura = 0; int n = 0; double proxima = 30;
        while (true)
        {
            long now; QueryPerformanceCounter(out now);
            double t = (now - ini) / (double)f;
            if (t >= 90) break;
            int fase = (int)(t / 30);
            if (fase > 0 && t >= proxima)
            {
                proxima += 5;
                QueryPerformanceCounter(out ultimaCaptura);
                Process.Start(new ProcessStartInfo(a[0], "\"" + a[1] + "\" \"" + a[2] + "\" r" + (n++) + " " + fases[fase]) { UseShellExecute = false, CreateNoWindow = true, RedirectStandardOutput = false });
            }
            int hr = V<Acq>(dup, 8)(dup, 50, info, out res);
            if (hr == unchecked((int)0x887A0027)) continue;
            if (hr < 0) { Console.WriteLine("ACQUIRE 0x" + hr.ToString("X8") + " en t=" + t.ToString("F1")); return 1; }
            long pres = Marshal.ReadInt64(info, 0);
            uint acc = (uint)Marshal.ReadInt32(info, 16);
            if (pres != 0)
            {
                cuadros[fase] += acc;
                if (prev != 0)
                {
                    double g = (pres - prev) * 1000.0 / f;
                    gaps[fase].Add(g);
                    if (ultimaCaptura != 0 && (pres - ultimaCaptura) / (double)f < 1.0 && g > maxTrasCaptura[fase]) maxTrasCaptura[fase] = g;
                }
                prev = pres;
            }
            Marshal.Release(res);
            V<Rls>(dup, 14)(dup);
        }
        for (int i = 0; i < 3; i++)
        {
            List<double> g = gaps[i]; g.Sort();
            if (g.Count == 0) { Console.WriteLine(fases[i] + ": sin cuadros"); continue; }
            Console.WriteLine(fases[i] + ": cuadros_vistos=" + g.Count + " acumulados_por_s=" + (cuadros[i] / 30.0).ToString("F0")
                + " p50=" + g[g.Count / 2].ToString("F1") + "ms p99=" + g[(int)(g.Count * 0.99)].ToString("F1") + "ms max=" + g[g.Count - 1].ToString("F1")
                + "ms max_1s_tras_captura=" + maxTrasCaptura[i].ToString("F1") + "ms");
        }
        return 0;
    }
}
