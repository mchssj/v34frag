#include <windows.h>
/* Prueba del agente: con argumento "hijo" duerme 10 s; si no, lanza CMLauncher.exe hijo de su misma carpeta y espera. */
int wmain(int argc, wchar_t** argv) {
    if (argc > 1) { Sleep(10000); return 0; }
    STARTUPINFOW si = {sizeof(si)}; PROCESS_INFORMATION pi;
    wchar_t cmd[] = L"CMLauncher.exe hijo";
    if (!CreateProcessW(NULL, cmd, NULL, NULL, FALSE, 0, NULL, NULL, &si, &pi)) return 1;
    WaitForSingleObject(pi.hProcess, INFINITE);
    return 0;
}
