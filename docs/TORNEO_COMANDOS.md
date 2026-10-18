# Sistema de Comandos para Torneos en CSSTV

## Descripción
Implementación de comandos de torneo para la plataforma CSSTV que permiten crear y gestionar torneos directamente desde el chat en vivo de las partidas. Los comandos se integran sin romper la funcionalidad existente y se identifican visualmente como torneos para mejor experiencia de usuario.

## Comandos Disponibles

### Control Principal de Torneo
- `!torneo: !iniciar(mix)` - Inicia un nuevo torneo en formato mix (equipos aleatorios)
- `!torneo: !stop` - Detiene el torneo actual y limpia recursos

### Gestión en Tiempo Real
- `!pause` - Pausa el torneo activo
- `!unpause` - Reanuda el torneo pausado

### Configuración y Administración
- `!configuracion` - Accede al panel de configuración del torneo

## Implementación Recomendada

### Enfoque No Intrusivo
Para usar lo que ya está en el repo sin romper nada:

1. **Los comandos se envían normalmente al chat** (se guardan en Supabase como mensajes regulares)
2. **Se agregan identificadores visuales al renderizar** los mensajes de torneo
3. **Se mantiene compatibilidad total** con funcionalidad existente de mixes y chat

### Código de Implementación

#### 1. Modificar el renderizado de mensajes (en `drawChat()`)
Reemplazar la función `drawChat()` actual por esta versión mejorada:

```javascript
function drawChat(){
    var cBox=$('md-chat');
    cBox.textContent='';
    var f=chatMsgs.filter(function(msg){return msg.match_id===selMatchId});
    if(!f.length)cBox.appendChild(none('Sin mensajes.'));
    f.forEach(function(msg){
        var d=el('div','chat-msg');
        var userTag=userProfiles[msg.user_id]||msg.user_email||'Anónimo';
        var messageText = msg.message;
        var isTournamentCommand = false;
        
        // Detectar comandos de torneo
        if (messageText.startsWith('!torneo:') || 
            messageText === '!pause' || 
            messageText === '!unpause' || 
            messageText === '!configuracion') {
            isTournamentCommand = true;
            d.className = 'chat-msg torneo-msg'; // Clase especial para torneos
        } else if (messageText.startsWith('!')) {
            // Otros comandos (como mixes) pueden tener su propio estilo
            d.className = 'chat-msg comando-msg';
        } else {
            d.className = 'chat-msg';
        }
        
        d.appendChild(el('b',0,userTag));
        if (isTournamentCommand) {
            // Añadir indicador visual de torneo
            var torneoBadge = el('span','torneo-badge');
            torneoBadge.textContent = '[TORNEO]';
            d.appendChild(torneoBadge);
            d.appendChild(document.createTextNode(' '));
        }
        d.appendChild(document.createTextNode(messageText));
        cBox.appendChild(d);
    });
    cBox.scrollTop=cBox.scrollHeight;
}
```

#### 2. Añadir estilos CSS (en la sección `<style>` de index.html)
```css
.torneo-msg {
    border-left: 3px solid var(--live);
    background-color: rgba(248, 81, 73, 0.05);
    padding-left: 10px !important;
    margin-left: -10px !important;
}

.torneo-badge {
    background-color: var(--live);
    color: white;
    font-size: 10px;
    font-weight: bold;
    padding: 1px 4px;
    border-radius: 3px;
    text-transform: uppercase;
    letter-spacing: 0.5px;
    margin-right: 6px;
}

.comando-msg {
    border-left: 2px solid var(--accent);
    background-color: rgba(56, 139, 253, 0.03);
    padding-left: 8px !important;
    margin-left: -8px !important;
}
```

## Flujo de Funcionamiento

1. **Usuario escribe**: `!torneo: !iniciar(mix)`
2. **Se envía a Supabase**: El mensaje se guarda exactamente como se escribió en la tabla `match_chat`
3. **Al renderizarse**: El sistema detecta que es un comando de torneo
4. **Se muestra visualmente**: 
   - Con borde izquierdo rojo vivo (`--live`)
   - Fondo ligeramente rojo semitransparente
   - Badge "[TORNEO]" antes del mensaje
   - Texto normal del comando

## Ventajas de este Enfoque

✅ **No rompe nada**: Los mensajes se guardan igual que antes  
✅ **Fácil de identificar**: Visual distinction clara en el chat  
✅ **Compatible**: Funciona con mixes existentes y otros comandos  
✅ **Escalable**: Fácil de añadir nuevos tipos de mensajes especiales  
✅ **Persistente**: Los comandos permanecen en la base de datos para historial  
✅ **Intuitivo**: Los usuarios reconocen inmediatamente los comandos de torneo  

## Personalización Avanzada (Opcional)

Para diferenciar subcomandos específicos:
```javascript
// Dentro de la detección de torneo:
if (messageText.startsWith('!torneo: !iniciar')) {
    d.className = 'chat-msg torneo-iniciar-msg';
    // ... estilos específicos para iniciar
} else if (messageText.startsWith('!torneo: !stop')) {
    d.className = 'chat-msg torneo-stop-msg';
    // ... estilos específicos para detener
}
```

## Pruebas Recomendadas

1. Verificar que los mensajes normales siguen apareciendo igual
2. Confirmar que los comandos de torneo muestran el badge y estilos especiales
3. Probar que los mixes y otros comandos no se ven afectados
4. Comprobar que el historial de chat mantiene todos los mensajes originales
5. Validar que funciona en diferentes tamaños de pantalla (responsive)

---
*Implementación diseñada para CSSTV - Minimal Esports que aprovecha la arquitectura existente sin modificacionesestructurales.*