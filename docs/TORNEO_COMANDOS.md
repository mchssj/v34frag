# Sistema de Comandos para Torneos en CSSTV

## Descripción
Implementación de un comando especial `!torneo` que, al ser escrito en el chat de partidas, abre un dialog interactivo para gestionar torneos en lugar de enviarse como mensaje regular. Este enfoque mantiene la separación clara entre funcionalidad de torneo y chat general, siguiendo los patrones existentes de dialogs en CSSTV (como los usados para resultados y prácticas).

## ¿Cómo funciona?

En lugar de enviar `!torneo` como un mensaje de chat más (que se mezclaría con mixes y otros mensajes), el sistema:
1. **Intercepta** el comando `!torneo` en el input de chat
2. **Abre un dialog** especializado con opciones de torneo
3. **Permite al usuario** seleccionar acciones mediante botones claros
4. **Ejecuta las acciones** de torneo seleccionadas
5. **Mantiene intacta** toda la funcionalidad existente de chat y mixes

## Comandos Disponibles en el Dialog

### Control Principal de Torneo
- **▶️ Iniciar (Mix)** - Inicia un nuevo torneo en formato mix (equipos aleatorios)
- **⏹️ Detener** - Detiene el torneo actual y limpia recursos

### Gestión en Tiempo Real
- **⏸️ Pausar** - Pausa el torneo activo
- **▶️ Reanudar** - Reanuda el torneo pausado

### Configuración
- **⚙️ Configuración** - Accede al panel de configuración del torneo

## Implementación Paso a Paso

Este enfoque sigue exactamente el mismo patrón que los dialogs existentes `#rdl` (resultado) y `#pcwdlg` (práctica) en tu `index.html`.

### Paso 1: Añadir el HTML del Dialog de Torneo
Agregar este código antes del cierre de `</main>` en tu `index.html` (junto a los otros dialogs existentes):

```html
<dialog id="torneodlg">
  <div class="fm">
    <b>⚡ Torneo CSSTV</b>
    <div class="msg" style="padding:12px 0;color:var(--mute);font-size:12px;">
      Selecciona una acción de torneo:
    </div>
    
    <div class="fm" style="margin:12px 0;">
      <button id="tn-iniciar" class="pri" type="button">▶️ Iniciar (Mix)</button>
      <button id="tn-stop" class="pri" type="button">⏹️ Detener</button>
    </div>
    
    <div class="fm" style="margin:12px 0;">
      <button id="tn-pause" class="pri" type="button">⏸️ Pausar</button>
      <button id="tn-unpause" class="pri" type="button">▶️ Reanudar</button>
    </div>
    
    <div class="fm" style="margin:12px 0;">
      <button id="tn-config" class="pri" type="button">⚙️ Configuración</button>
    </div>
    
    <div class="dlg-foot" style="margin-top:16px;">
      <span id="torneo-msg" class="msg"></span>
      <button id="tn-close" type="button">Cerrar</button>
    </div>
  </div>
</dialog>
```

### Paso 2: Modificar el Manejo del Envío de Chat
Reemplazar el manejador existente de `$('chat-send').onclick` por esta versión mejorada:

```javascript
// Manejar envío de mensajes de chat
$('chat-send').onclick = async function() {
  var text = $('chat-input').value.trim();
  if (!text || !me) return;
  
  // === INTERCEPTAR COMANDO ESPECIAL !TORNEO ===
  // En lugar de enviarlo como mensaje regular, abre el dialog de torneo
  if (text === '!torneo') {
    $('chat-input').value = '';
    abrirDialogoTorneo();
    return;
  }
  // === FIN INTERCEPTACIÓN ===
  
  // Envío normal de mensajes (mantiene 100% funcionalidad existente)
  try {
    await ok(sb.from('match_chat').insert({
      match_id: selMatchId,
      user_id: me,
      user_email: me,
      message: text
    }));
    $('chat-input').value = '';
    await fetchChat();
  } catch (e) {
    showToast('Error: ' + e.message, 'error');
  }
};

// Función para abrir el dialog de torneo (similar a openRes() para resultados)
function abrirDialogoTorneo() {
  $('torneo-msg').textContent = '';
  $('torneodlg').showModal();
}

// Manejar cerrar dialog de torneo (similar a rcl y pcwd-cl)
$('tn-close').onclick = function() {
  $('torneodlg').close();
};

// Manejar las opciones del dialog de torneo
$('tn-iniciar').onclick = async function() {
  $('torneo-msg').textContent = 'Iniciando torneo mix...';
  try {
    // TODO: Reemplazar con tu lógica real de inicio de torneo
    // Ejemplo: await iniciarTorneoMix();
    showToast('Torneo mix iniciado (simulado)', 'success');
    $('torneodlg').close();
  } catch (e) {
    $('torneo-msg').textContent = 'Error: ' + e.message;
  }
};

$('tn-stop').onclick = async function() {
  $('torneo-msg').textContent = 'Deteniendo torneo...';
  try {
    // TODO: Reemplazar con tu lógica real de detención de torneo
    // Ejemplo: await detenerTorneo();
    showToast('Torneo detenido (simulado)', 'success');
    $('torneodlg').close();
  } catch (e) {
    $('torneo-msg').textContent = 'Error: ' + e.message;
  }
};

$('tn-pause').onclick = async function() {
  $('torneo-msg').textContent = 'Pausando torneo...';
  try {
    // TODO: Reemplazar con tu lógica real de pausa de torneo
    // Ejemplo: await pausarTorneo();
    showToast('Torneo pausado (simulado)', 'success');
    $('torneodlg').close();
  } catch (e) {
    $('torneo-msg').textContent = 'Error: ' + e.message;
  }
};

$('tn-unpause').onclick = async function() {
  $('torneo-msg').textContent = 'Reanudando torneo...';
  try {
    // TODO: Reemplazar con tu lógica real de reanudación de torneo
    // Ejemplo: await reanudarTorneo();
    showToast('Torneo reanudado (simulado)', 'success');
    $('torneodlg').close();
  } catch (e) {
    $('torneo-msg').textContent = 'Error: ' + e.message;
  }
};

$('tn-config').onclick = async function() {
  $('torneo-msg').textContent = 'Abriendo configuración...';
  try {
    // TODO: Reemplazar con tu lógica real de configuración de torneo
    # Si tienes una sección de torneos, podrías navegar allí o abrir otro dialog
    showToast('Abriendo configuración de torneo (simulado)', 'info');
    $('torneodlg').close();
  } catch (e) {
    $('torneo-msg').textContent = 'Error: ' + e.message;
  }
};
```

## ¿Dónde colocar el código?

### Ubicación del HTML del Dialog:
Busca en tu `index.html` los dialogs existentes (al final, cerca de las líneas 524-533 donde están `#rdl` y `#pcwdlg`) y añade el dialog `#torneodlg` justo después de ellos.

### Ubicación del JavaScript:
Busca el manejador existente de `$('chat-send').onclick` (alrededor de la línea 980) y reemplázalo completamente por el código proporcionado arriba.

## Ventajas de esta Implementación

✅ **Totalmente no intrusivo**: No afecta mixes, chat normal ni ninguna funcionalidad existente  
✅ **Patrón consistente**: Usa exactamente el mismo enfoque que `#rdl` y `#pcwdlg`  
✅ **Interfaz nativa**: Aprovecha los dialogs HTML nativos (accesibles, responsive)  
✅ **Separa responsabilidades**: Los comandos de torneo no ensucian el historial de chat  
✅ **Fácil de usar**: Botones grandes y claros en lugar de recordar sintaxis de comandos  
✅ **Extensible**: Simple añadir más opciones al dialog siguiendo el mismo patrón  
✅ **Compatible con móviles**: Los dialogs nativos se adaptan bien a pantallas táctiles  
✅ **Estado limpio**: Al cerrar el dialog, el input de chat queda listo para mensajes normales  

## Integración con tu Lógica Real de Torneos

Donde dice `// TODO: Reemplazar con tu lógica real...`, deberías conectar con las funciones reales que ya tienes en tu sistema para:
- Iniciar torneos (similar a cómo se generan fixtures)
- Detener torneos (limpiar estado, cancelar partidas programadas)
- Pausar/reanudar torneos (mantener estado pero bloquear acciones)
- Configurar torneos (ajustar parámetros, formatos, reglas, etc.)

Ejemplo de cómo podría verse la integración real:
```javascript
$('tn-iniciar').onclick = async function() {
  $('torneo-msg').textContent = 'Iniciando torneo mix...';
  try {
    // Llamar a tu función real de inicio de torneo
    await iniciarNuevoTorneoMix();
    showToast('Torneo mix iniciado correctamente', 'success');
    $('torneodlg').close();
    # Opcional: recargar datos o notificar a usuarios
    await load();
  } catch (e) {
    $('torneo-msg').textContent = 'Error: ' + e.message;
  }
};
```

## Pruebas Recomendadas

1. **Funcionalidad básica**:
   - Escribir `!torneo` y ver que abre el dialog (no envía mensaje)
   - Probar que cada botón hace su acción correspondiente
   - Verificar que el dialog se cierra correctamente

2. **No regresión**:
   - Enviar mensajes normales y verificar que aparecen en el chat
   - Confirmar que mixes y otros comandos de chat funcionan igual
   - Comprobar que el historial de chat no se ve afectado

3. **Experiencia de usuario**:
   - Probar en diferentes tamaños de pantalla (desktop/mobile)
   - Verificar que el dialog se centra y se adapta bien
   - Confirmar que ESC y clic fuera del dialog lo cierran (comportamiento nativo)

4. **Integración real** (una vez que conectes tu lógica):
   - Probar que los torneos se crean, detienen, pausan correctamente
   - Verificar que el estado se mantiene apropiadamente
   - Comprobar que los usuarios ven los cambios en tiempo real si aplica

---
*Implementación diseñada para CSSTV que aprovecha el sistema de dialogs existente, mantiene la coherencia arquitectónica y proporciona una experiencia de usuario intuitiva para la gestión de torneos.*