# FWD Academic Session Controller

Extensión de navegador (Chrome / Manifest V3) que gestiona sesiones de laboratorio en [claude.ai](https://claude.ai) para contextos de aula: temporiza el acceso, estima el consumo de tokens por sesión y aplica una capa de fricción de UI cuando la sesión no está activa.

Construida como parte de mis clases de **Programación Front End con IA Aplicada** en FWD Costa Rica, para controlar el uso de Claude durante ejercicios prácticos cronometrados.

## ¿Qué hace?

- **Puerta de entrada con grupo + PIN**: el estudiante selecciona su grupo de clase e ingresa un PIN provisto por el profesor para habilitar el chat.
- **Temporizador de sesión persistente**: la sesión se mide contra un timestamp de expiración guardado en `localStorage`, no contra un contador en memoria — así sobrevive a recargas de página y no se puede "congelar" cerrando la pestaña.
- **Presupuesto de tokens estimado**: cada mensaje enviado se mide con una heurística simple (`caracteres / 4`) y se acumula contra un máximo configurable. Al superarlo, la sesión finaliza automáticamente.
- **Widget flotante**: muestra tiempo restante y tokens usados, con opciones para pausar o finalizar la sesión manualmente.
- **Resiliencia de UI**: un `MutationObserver` reinserta los elementos de la extensión si el DOM de la SPA de Claude los remueve durante una navegación interna.
- **Focus lock de aula**: pausa la sesión si detecta atajos de DevTools (`F12`, `Ctrl+Shift+I/J`, `Ctrl+U`) o un cambio de tamaño de ventana compatible con DevTools abierto.

## Por qué existe

En sesiones de laboratorio con grupos grandes, es fácil perder el control de cuánto tiempo o cuántos mensajes está usando cada estudiante durante un ejercicio cronometrado. Esta extensión resuelve un problema logístico de aula, no un problema de seguridad de la información.

## Nota honesta sobre el "focus lock"

Esto **no es un mecanismo de seguridad real** y no pretende serlo. El PIN vive en texto plano dentro del código fuente de la extensión, visible para cualquiera que inspeccione los archivos vía `chrome://extensions`. La detección de DevTools se basa en comparar dimensiones de ventana, una técnica conocida y trivialmente evadible (deshabilitando la extensión, usando otro perfil de navegador, o editando el script directamente).

El propósito es generar **fricción suficiente para un contexto de aula controlado** — desincentivar el uso casual fuera de tiempo — no resistir a alguien con intención de evadirlo. Si necesitás control de acceso real, esto debería reemplazarse por autenticación en un backend con tokens de sesión firmados server-side.

## Estructura del proyecto

```
claude-academic-controller/
├── manifest.json     # Configuración de la extensión (Manifest V3)
├── content.js        # Lógica completa: UI, estado, sesión, focus lock
└── README.md
```

## Arquitectura del content script

El script está organizado en secciones numeradas dentro de un único IIFE para evitar contaminar el scope global de la página:

1. **Configuración** — parámetros ajustables (duración de sesión, presupuesto de tokens, grupos, PIN).
2. **Estado** — objeto sellado (`Object.seal`) que centraliza el estado runtime.
3. **Utilidades** — estimación de tokens, formateo de tiempo, helpers de DOM.
4. **Persistencia** (`sessionStore`) — guardar/restaurar/limpiar sesión en `localStorage`.
5–7. **Interfaz** — overlay de desbloqueo (Shadow DOM), widget flotante, overlay de focus lock.
8. **Montaje** — inserción inicial y reinserción de los tres elementos de UI.
9. **Control de acceso al chat** — bloqueo/desbloqueo del input y botón de envío de Claude.
10. **Conteo de tokens** — interceptación de envíos y acumulación del estimado.
11. **Ciclo de vida de sesión** — desbloqueo, pausa, expiración, restauración.
12. **Focus lock** — detección de DevTools y atajos restringidos.
13. **Watchdog** — un único intervalo que consolida la resiliencia de DOM y la aplicación del estado de bloqueo (en la versión original esto estaba repartido en ~5 `setInterval` solapados).
14. **Eventos de UI** — listeners de los botones.
15. **Inicialización**.

### Decisión de diseño: consolidación de intervalos

La primera versión de este script tenía múltiples `setInterval` independientes reimplementando la misma lógica de "reinsertar nodos removidos" y "sincronizar estado bloqueado/desbloqueado" en distintos puntos del archivo. Se consolidó todo en `runWatchdogTick()`, ejecutado una sola vez por segundo, reduciendo la superficie de mantenimiento y eliminando condiciones de carrera entre timers redundantes.

## Instalación (modo desarrollador)

1. Cloná este repositorio.
2. Abrí `chrome://extensions` en Chrome (o el equivalente en un navegador basado en Chromium).
3. Activá "Modo de desarrollador".
4. Hacé clic en "Cargar descomprimida" y seleccioná la carpeta del proyecto.
5. Entrá a [claude.ai](https://claude.ai) — el overlay de desbloqueo debería aparecer automáticamente.

## Configuración

Todos los parámetros de aula viven en el objeto `CONFIG` al inicio de `content.js`:

```javascript
const CONFIG = Object.freeze({
  password: "a",              // PIN del profesor
  sessionMinutes: 2,          // duración de la sesión
  maxEstimatedTokens: 3000,   // presupuesto de tokens por sesión
  groups: ["Grupo 1", "Grupo 2", /* ... */],
});
```

## Limitaciones conocidas

- El conteo de tokens es una **aproximación** (`longitud / 4`), no una medición exacta vía tokenizer real — es suficiente para fines de presupuesto de aula, no para facturación o análisis preciso.
- Depende de selectores de DOM específicos de la interfaz actual de claude.ai (`data-testid="chat-input"`, etc.); si Anthropic cambia la estructura de su UI, los selectores en `CLAUDE_SELECTORS` necesitarán actualizarse.
- El focus lock es fricción, no seguridad (ver sección dedicada arriba).

## Stack técnico

- JavaScript vainilla (sin dependencias ni build step).
- Chrome Extensions Manifest V3 (`content_scripts`).
- Shadow DOM para aislar estilos del overlay de desbloqueo.
- `MutationObserver` para resiliencia frente a una SPA que remonta su propio DOM.
- `localStorage` para persistencia de sesión entre recargas.

## Licencia

Uso educativo — FWD Costa Rica.
