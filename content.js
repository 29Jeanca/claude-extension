/**
 * FWD Academic Session Controller
 * ---------------------------------------------------------------------------
 * Extensión de navegador para gestionar sesiones de laboratorio en claude.ai:
 *   - Requiere selección de grupo + PIN para habilitar el chat.
 *   - Corre un temporizador de sesión con persistencia entre recargas.
 *   - Estima el consumo de tokens por mensaje enviado y corta la sesión
 *     al superar el presupuesto configurado.
 *   - Aplica un "focus lock" de aula: bloquea el input mientras la sesión
 *     está pausada/expirada y desalienta atajos comunes (F12, Ctrl+Shift+I).
 *
 * NOTA HONESTA SOBRE EL "FOCUS LOCK":
 * Esto es fricción para un contexto de aula controlado, NO es un mecanismo
 * de seguridad. La contraseña vive en el código fuente de la extensión y
 * cualquier estudiante con conocimientos de DevTools puede inspeccionarla
 * o deshabilitar la extensión. Está diseñado para desincentivar el uso
 * casual fuera de tiempo, no para resistir a alguien decidido a evadirlo.
 * ---------------------------------------------------------------------------
 */

(function () {
  "use strict";

  // ===========================================================================
  // 1. CONFIGURACIÓN
  // ===========================================================================

  const CONFIG = Object.freeze({
    password: "a", // PIN del profesor. Ver nota de seguridad arriba.
    sessionMinutes: 2,
    maxEstimatedTokens: 3000,
    charsPerToken: 4, // heurística simple para estimar tokens (no exacta)
    groups: [
      "Grupo 1",
      "Grupo 2",
      "Grupo 3",
      "Grupo 4",
      "Grupo 5",
      "Grupo 6",
      "Grupo 7",
    ],
    devtoolsThreshold: 160, // px de diferencia ventana externa/interna
    watchdogIntervalMs: 1000,
    listenerReattachIntervalMs: 1500,
  });

  const STORAGE_KEY = "fwd_claude_session";
  const CLAUDE_SELECTORS = {
    chatInput: '[data-testid="chat-input"]',
    sendButton: 'button[aria-label="Enviar mensaje"]',
  };

  // ===========================================================================
  // 2. ESTADO
  // ===========================================================================

  const state = Object.seal({
    isUnlocked: false,
    isPaused: false,
    isFocusLocked: false, // reemplaza al antiguo "securityLock"
    remainingSeconds: 0,
    usedEstimatedTokens: 0,
    selectedGroup: "",
  });

  let countdownIntervalId = null;
  let devtoolsWasOpen = false;

  // ===========================================================================
  // 3. UTILIDADES
  // ===========================================================================

  function estimateTokens(text) {
    if (!text) return 0;
    return Math.ceil(text.length / CONFIG.charsPerToken);
  }

  function formatTime(totalSeconds) {
    const mins = Math.floor(totalSeconds / 60);
    const secs = totalSeconds % 60;
    return `${String(mins).padStart(2, "0")}:${String(secs).padStart(2, "0")}`;
  }

  function getClaudeElements() {
    return {
      chatInput: document.querySelector(CLAUDE_SELECTORS.chatInput),
      sendButton: document.querySelector(CLAUDE_SELECTORS.sendButton),
    };
  }

  function stopEventPropagation(e) {
    e.stopPropagation();
    e.stopImmediatePropagation();
  }

  // ===========================================================================
  // 4. PERSISTENCIA DE SESIÓN
  // ===========================================================================

  const sessionStore = {
    save() {
      const payload = {
        isUnlocked: state.isUnlocked,
        isPaused: state.isPaused,
        usedEstimatedTokens: state.usedEstimatedTokens,
        selectedGroup: state.selectedGroup,
        expiresAt: Date.now() + state.remainingSeconds * 1000,
      };
      localStorage.setItem(STORAGE_KEY, JSON.stringify(payload));
    },

    clear() {
      localStorage.removeItem(STORAGE_KEY);
    },

    restore() {
      let session;
      try {
        const raw = localStorage.getItem(STORAGE_KEY);
        if (!raw) return null;
        session = JSON.parse(raw);
      } catch (err) {
        console.error("[FWD] No se pudo leer la sesión guardada:", err);
        return null;
      }

      if (!session || !session.expiresAt) return null;

      const remaining = Math.floor((session.expiresAt - Date.now()) / 1000);
      if (remaining <= 0) {
        this.clear();
        return null;
      }

      return { ...session, remainingSeconds: remaining };
    },
  };

  // ===========================================================================
  // 5. INTERFAZ: overlay de desbloqueo (Shadow DOM)
  // ===========================================================================

  const host = document.createElement("div");
  host.id = "fwd-academic-host";
  const shadow = host.attachShadow({ mode: "open" });

  shadow.innerHTML = `
    <style>
      #overlay {
        position: fixed;
        inset: 0;
        background: rgba(15, 15, 20, 0.78);
        display: flex;
        justify-content: center;
        align-items: center;
        z-index: 2147483000;
        backdrop-filter: blur(6px);
        font-family: Inter, Arial, sans-serif;
      }
      .card {
        width: 340px;
        background: white;
        border-radius: 22px;
        padding: 28px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.35);
        display: flex;
        flex-direction: column;
        gap: 16px;
      }
      .logo {
        width: 64px;
        height: 64px;
        border-radius: 16px;
        background: linear-gradient(135deg, #1787d9, #4db5ff);
        color: white;
        display: flex;
        justify-content: center;
        align-items: center;
        font-size: 20px;
        font-weight: 800;
        margin: 0 auto;
      }
      .title {
        margin: 0;
        text-align: center;
        font-size: 26px;
        font-weight: 800;
        color: #222;
      }
      .title span {
        color: #1787d9;
      }
      .field {
        display: flex;
        flex-direction: column;
        gap: 7px;
      }
      label {
        font-size: 13px;
        font-weight: 700;
        color: #555;
      }
      select,
      input {
        width: 100%;
        padding: 14px;
        border-radius: 12px;
        border: 1px solid #d9d9d9;
        background: #f8f8f8;
        font-size: 14px;
        color: #222;
        box-sizing: border-box;
      }
      button {
        width: 100%;
        padding: 15px;
        border-radius: 12px;
        border: none;
        background: linear-gradient(90deg, #ff1493, #ff0080);
        color: white;
        font-weight: 700;
        cursor: pointer;
      }
      .error {
        display: none;
        text-align: center;
        color: #d1004b;
        font-size: 13px;
        font-weight: 600;
      }
      #session-timer {
        text-align: center;
        font-size: 14px;
        font-weight: 700;
        color: #444;
      }
    </style>

    <div id="overlay">
      <div class="card">
        <div class="logo">FWD</div>
        <h1 class="title">
          Bienvenido al<br />
          <span>Sistema Académico de Tokens FWD</span>
        </h1>

        <div class="field">
          <label>Selecciona tu grupo</label>
          <select id="group-select">
            <option value="">Elegir grupo académico...</option>
          </select>
        </div>

        <div class="field">
          <label>Contraseña profesor</label>
          <input id="password-input" type="password" />
        </div>

        <button id="unlock-btn">Desbloquear Sistema →</button>

        <div id="session-timer">Tiempo restante: ${formatTime(
          CONFIG.sessionMinutes * 60
        )}</div>

        <div class="error" id="error-msg"></div>
      </div>
    </div>
  `;

  const dom = {
    overlay: shadow.querySelector("#overlay"),
    groupSelect: shadow.querySelector("#group-select"),
    passwordInput: shadow.querySelector("#password-input"),
    unlockBtn: shadow.querySelector("#unlock-btn"),
    errorMsg: shadow.querySelector("#error-msg"),
    sessionTimerLabel: shadow.querySelector("#session-timer"),
  };

  CONFIG.groups.forEach((group) => {
    const opt = document.createElement("option");
    opt.value = group;
    opt.textContent = group;
    dom.groupSelect.appendChild(opt);
  });

  // Evita que las teclas presionadas dentro del overlay "se filtren" hacia
  // los atajos de teclado de claude.ai (ej. Enter enviando un mensaje).
  [dom.passwordInput, dom.groupSelect].forEach((el) => {
    ["keydown", "keypress", "keyup"].forEach((type) => {
      el.addEventListener(type, stopEventPropagation, true);
    });
  });

  // ===========================================================================
  // 6. INTERFAZ: widget flotante (temporizador + tokens)
  // ===========================================================================

  const floatingWidget = document.createElement("div");
  floatingWidget.id = "fwd-floating-widget";
  Object.assign(floatingWidget.style, {
    position: "fixed",
    top: "12px",
    right: "12px",
    zIndex: "2147483000",
    width: "220px",
    background: "rgba(20,20,20,0.88)",
    color: "white",
    borderRadius: "14px",
    padding: "12px",
    fontFamily: "Inter, Arial, sans-serif",
    cursor: "pointer",
    userSelect: "none",
    fontSize: "12px",
    fontWeight: "700",
    display: "none",
    boxShadow: "0 10px 30px rgba(0,0,0,0.35)",
  });

  const widgetHeader = document.createElement("div");
  widgetHeader.textContent = `⏱ ${formatTime(CONFIG.sessionMinutes * 60)}`;

  const widgetDetails = document.createElement("div");
  widgetDetails.style.display = "none";
  widgetDetails.style.marginTop = "10px";

  const tokenInfo = document.createElement("div");
  tokenInfo.style.marginTop = "8px";

  const pauseBtn = document.createElement("button");
  pauseBtn.textContent = "Pausar";
  Object.assign(pauseBtn.style, {
    width: "100%",
    marginTop: "10px",
    padding: "8px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "700",
    background: "#ff0080",
    color: "white",
  });

  const endSessionBtn = document.createElement("button");
  endSessionBtn.textContent = "Finalizar sesión";
  Object.assign(endSessionBtn.style, {
    width: "100%",
    marginTop: "10px",
    padding: "8px",
    borderRadius: "8px",
    border: "none",
    cursor: "pointer",
    fontWeight: "700",
    background: "#ff3b30",
    color: "white",
  });

  widgetDetails.append(tokenInfo, pauseBtn, endSessionBtn);
  floatingWidget.append(widgetHeader, widgetDetails);

  let widgetOpen = false;
  floatingWidget.addEventListener("click", (e) => {
    if (e.target === pauseBtn || e.target === endSessionBtn) return;
    widgetOpen = !widgetOpen;
    widgetDetails.style.display = widgetOpen ? "block" : "none";
  });

  // ===========================================================================
  // 7. INTERFAZ: overlay de focus-lock (DevTools / atajos)
  // ===========================================================================

  const focusLockOverlay = document.createElement("div");
  focusLockOverlay.id = "fwd-focus-lock-overlay";
  Object.assign(focusLockOverlay.style, {
    position: "fixed",
    inset: "0",
    background: "rgba(10,10,10,0.95)",
    zIndex: "2147483647",
    display: "none",
    justifyContent: "center",
    alignItems: "center",
    flexDirection: "column",
    color: "white",
    fontFamily: "Inter, Arial, sans-serif",
    backdropFilter: "blur(10px)",
  });

  focusLockOverlay.innerHTML = `
    <div style="
      background: rgba(255,255,255,0.04);
      border: 1px solid rgba(255,255,255,0.08);
      padding: 40px;
      border-radius: 24px;
      text-align: center;
      width: 380px;
      box-shadow: 0 20px 60px rgba(0,0,0,0.45);
    ">
      <div style="
        width: 74px; height: 74px; border-radius: 18px;
        margin: 0 auto 20px auto;
        background: linear-gradient(135deg,#ff0040,#ff4d6d);
        display:flex; align-items:center; justify-content:center;
        font-size:30px; font-weight:900;
      ">!</div>

      <h1 style="margin:0; font-size:26px; font-weight:800;">
        Sesión pausada
      </h1>

      <p style="opacity:0.8; margin-top:12px; line-height:1.6; font-size:14px;">
        Se detectó un intento de abrir las herramientas de desarrollador
        o un atajo restringido. La sesión se pausó automáticamente.
      </p>

      <div style="
        margin-top:24px; padding:14px; border-radius:12px;
        background:rgba(255,255,255,0.05); font-size:13px; opacity:0.8;
      ">
        Reanudá desde el panel del profesor para continuar.
      </div>
    </div>
  `;

  // ===========================================================================
  // 8. MONTAJE INICIAL EN EL DOM
  // ===========================================================================

  function mountUI() {
    document.body.append(host, floatingWidget, focusLockOverlay);
  }

  function ensureUIIsMounted() {
    if (!document.body.contains(host)) document.body.appendChild(host);
    if (!document.body.contains(floatingWidget))
      document.body.appendChild(floatingWidget);
    if (!document.body.contains(focusLockOverlay))
      document.body.appendChild(focusLockOverlay);
  }

  // ===========================================================================
  // 9. CONTROL DE ACCESO AL CHAT DE CLAUDE
  // ===========================================================================

  function isChatAllowed() {
    return state.isUnlocked && !state.isPaused && !state.isFocusLocked;
  }

  function lockChatUI() {
    const { chatInput, sendButton } = getClaudeElements();

    if (chatInput) {
      chatInput.contentEditable = "false";
      chatInput.style.pointerEvents = "none";
      chatInput.style.opacity = "0.4";
      chatInput.blur();
    }

    if (sendButton) {
      sendButton.disabled = true;
      sendButton.style.pointerEvents = "none";
      sendButton.style.opacity = "0.4";
    }
  }

  function unlockChatUI() {
    const { chatInput, sendButton } = getClaudeElements();

    if (chatInput) {
      chatInput.contentEditable = "true";
      chatInput.style.pointerEvents = "auto";
      chatInput.style.opacity = "1";
    }

    if (sendButton) {
      sendButton.disabled = false;
      sendButton.style.pointerEvents = "auto";
      sendButton.style.opacity = "1";
    }
  }

  // Bloquea eventos de teclado/click en el input mientras el chat no está
  // permitido. Se reengancha periódicamente porque la UI de Claude es una
  // SPA que puede recrear el nodo del input.
  function attachHardBlockListeners() {
    const { chatInput, sendButton } = getClaudeElements();
    if (!chatInput) return;

    const blocker = (e) => {
      if (!isChatAllowed()) {
        e.preventDefault();
        stopEventPropagation(e);
        return false;
      }
    };

    ["keydown", "keypress", "keyup", "beforeinput", "input", "paste", "click"].forEach(
      (type) => chatInput.addEventListener(type, blocker, true)
    );

    if (sendButton) {
      sendButton.addEventListener("click", blocker, true);
    }
  }

  // ===========================================================================
  // 10. CONTEO DE TOKENS
  // ===========================================================================

  function refreshTokenWidget() {
    tokenInfo.innerHTML = `
      <div style="margin-bottom:8px; font-size:13px; color:#4db5ff; font-weight:800;">
        Grupo: ${state.selectedGroup || "N/A"}
      </div>
      <div>Tokens: ${state.usedEstimatedTokens} / ${CONFIG.maxEstimatedTokens}</div>
    `;
  }

  function processOutgoingMessage() {
    if (!isChatAllowed()) return;

    const { chatInput } = getClaudeElements();
    if (!chatInput) return;

    const text = chatInput.innerText.trim();
    if (!text) return;

    const estimated = estimateTokens(text);
    const futureTotal = state.usedEstimatedTokens + estimated;

    if (futureTotal > CONFIG.maxEstimatedTokens) {
      expireSession("Presupuesto de tokens agotado");
      return;
    }

    state.usedEstimatedTokens = futureTotal;
    refreshTokenWidget();
    sessionStore.save();
  }

  function setupMessageInterception() {
    document.addEventListener(
      "click",
      (e) => {
        if (e.target.closest(CLAUDE_SELECTORS.sendButton)) {
          processOutgoingMessage();
        }
      },
      true
    );

    document.addEventListener(
      "keydown",
      (e) => {
        if (e.key === "Enter" && !e.shiftKey) {
          processOutgoingMessage();
        }
      },
      true
    );
  }

  // ===========================================================================
  // 11. CICLO DE VIDA DE LA SESIÓN
  // ===========================================================================

  function tickCountdown() {
    const label = formatTime(state.remainingSeconds);
    widgetHeader.textContent = `⏱ ${label}`;
    dom.sessionTimerLabel.textContent = `Tiempo restante: ${label}`;
    refreshTokenWidget();
    sessionStore.save();
  }

  function startCountdown() {
    clearInterval(countdownIntervalId);

    if (!state.remainingSeconds) {
      state.remainingSeconds = CONFIG.sessionMinutes * 60;
    }

    tickCountdown();

    countdownIntervalId = setInterval(() => {
      state.remainingSeconds--;
      tickCountdown();

      if (state.remainingSeconds <= 0) {
        clearInterval(countdownIntervalId);
        expireSession("Tiempo agotado");
      }
    }, 1000);
  }

  function unlockSession(group) {
    state.isUnlocked = true;
    state.isPaused = false;
    state.selectedGroup = group;
    state.remainingSeconds = CONFIG.sessionMinutes * 60;

    dom.overlay.style.display = "none";
    floatingWidget.style.display = "block";

    startCountdown();
  }

  function togglePause() {
    state.isPaused = !state.isPaused;

    if (state.isPaused) {
      clearInterval(countdownIntervalId);
      lockChatUI();
      pauseBtn.textContent = "Reanudar";
    } else {
      unlockChatUI();
      startCountdown();
      pauseBtn.textContent = "Pausar";
    }

    sessionStore.save();
  }

  function expireSession(reason = "") {
    if (reason) console.info("[FWD] Sesión finalizada:", reason);

    state.isUnlocked = false;
    state.isPaused = false;
    state.remainingSeconds = 0;
    state.usedEstimatedTokens = 0;

    dom.overlay.style.display = "flex";
    floatingWidget.style.display = "none";

    sessionStore.clear();
  }

  function restoreSessionFromStorage() {
    const saved = sessionStore.restore();
    if (!saved) return;

    state.isUnlocked = saved.isUnlocked;
    state.isPaused = saved.isPaused;
    state.remainingSeconds = saved.remainingSeconds;
    state.usedEstimatedTokens = saved.usedEstimatedTokens || 0;
    state.selectedGroup = saved.selectedGroup || "";

    dom.groupSelect.value = state.selectedGroup;
    dom.overlay.style.display = "none";
    floatingWidget.style.display = "block";
    refreshTokenWidget();

    if (state.isPaused) {
      lockChatUI();
      pauseBtn.textContent = "Reanudar";
      widgetHeader.textContent = `⏸ ${formatTime(state.remainingSeconds)}`;
    } else {
      unlockChatUI();
      startCountdown();
    }
  }

  // ===========================================================================
  // 12. FOCUS LOCK (fricción de aula, ver nota al inicio del archivo)
  // ===========================================================================

  function activateFocusLock(reason) {
    if (state.isFocusLocked) return;
    console.warn("[FWD] Focus lock activado:", reason);

    state.isFocusLocked = true;
    state.isPaused = true;
    focusLockOverlay.style.display = "flex";
    lockChatUI();
    sessionStore.save();
  }

  function detectDevToolsOpen() {
    const widthDelta = window.outerWidth - window.innerWidth;
    const heightDelta = window.outerHeight - window.innerHeight;
    return (
      widthDelta > CONFIG.devtoolsThreshold ||
      heightDelta > CONFIG.devtoolsThreshold
    );
  }

  function setupFocusLockShortcutGuards() {
    window.addEventListener(
      "keydown",
      (e) => {
        const key = e.key.toLowerCase();
        const isDevtoolsShortcut =
          e.key === "F12" ||
          (e.ctrlKey && e.shiftKey && (key === "i" || key === "j")) ||
          (e.ctrlKey && key === "u");

        if (isDevtoolsShortcut) {
          e.preventDefault();
          stopEventPropagation(e);
          activateFocusLock(`Atajo restringido: ${e.key}`);
        }
      },
      true
    );
  }

  // ===========================================================================
  // 13. WATCHDOG (resiliencia del DOM + aplicación del estado de bloqueo)
  // ===========================================================================
  // Consolida en un único intervalo lo que antes eran ~5 setInterval
  // solapados: reinserción de nodos, forzado del overlay, y sincronización
  // del estado bloqueado/desbloqueado del chat.

  function runWatchdogTick() {
    ensureUIIsMounted();

    if (!state.isUnlocked && dom.overlay.style.display === "none") {
      dom.overlay.style.display = "flex";
    }

    if (detectDevToolsOpen() && !devtoolsWasOpen) {
      devtoolsWasOpen = true;
      activateFocusLock("DevTools abierto");
    } else if (!detectDevToolsOpen()) {
      devtoolsWasOpen = false;
    }

    if (isChatAllowed()) {
      unlockChatUI();
    } else {
      lockChatUI();
    }
  }

  function setupDOMResilienceObserver() {
    const observer = new MutationObserver((mutations) => {
      for (const mutation of mutations) {
        for (const node of mutation.removedNodes) {
          if (node === host || node === floatingWidget || node === focusLockOverlay) {
            ensureUIIsMounted();
            return;
          }
        }
      }
    });

    observer.observe(document.body, { childList: true, subtree: true });
  }

  // ===========================================================================
  // 14. EVENTOS DE UI
  // ===========================================================================

  dom.unlockBtn.addEventListener("click", () => {
    const group = dom.groupSelect.value;
    const password = dom.passwordInput.value;

    if (!group) {
      dom.errorMsg.style.display = "block";
      dom.errorMsg.textContent = "Selecciona grupo";
      return;
    }

    if (password !== CONFIG.password) {
      dom.errorMsg.style.display = "block";
      dom.errorMsg.textContent = "Contraseña incorrecta";
      return;
    }

    dom.errorMsg.style.display = "none";
    unlockSession(group);
  });

  pauseBtn.addEventListener("click", (e) => {
    stopEventPropagation(e);
    togglePause();
  });

  endSessionBtn.addEventListener("click", (e) => {
    stopEventPropagation(e);
    const confirmed = confirm(
      "¿Seguro que deseas finalizar la sesión?\n\nEsta acción cerrará el acceso del estudiante."
    );
    if (!confirmed) return;

    clearInterval(countdownIntervalId);
    expireSession("Finalizada manualmente");
  });

  // ===========================================================================
  // 15. INICIALIZACIÓN
  // ===========================================================================

  function init() {
    mountUI();
    setupMessageInterception();
    setupFocusLockShortcutGuards();
    setupDOMResilienceObserver();
    restoreSessionFromStorage();

    setInterval(runWatchdogTick, CONFIG.watchdogIntervalMs);
    setInterval(attachHardBlockListeners, CONFIG.listenerReattachIntervalMs);

    console.info("[FWD] Academic Session Controller activo");
  }

  init();
})();