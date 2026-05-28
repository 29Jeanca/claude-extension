console.log("Claude Academic Controller activo");

const CONFIG = Object.freeze({
  // Contraseña para desbloquear el sistema
  password: "a",

  // Duración de la sesión en minutos
  sessionMinutes: 2,

  // Los tokens máximos
  maxEstimatedTokens: 3000,

  groups: [
    "Grupo 1",
    "Grupo 2",
    "Grupo 3",
    "Grupo 4",
    "Grupo 5",
    "Grupo 6",
    "Grupo 7"
  ]

});

const STORAGE_KEY =
  "fwd_claude_session";

const INTERNAL_STATE = {

  isUnlocked: false,

  isPaused: false,

  remainingSeconds: 0,

  usedEstimatedTokens: 0,

  selectedGroup: ""

};

Object.seal(INTERNAL_STATE);

let countdownInterval = null;

const host =
  document.createElement("div");

host.id =
  "claude-academic-host";

document.body.appendChild(host);

const shadow =
  host.attachShadow({
    mode: "open"
  });

const chatTimer =
  document.createElement("div");

chatTimer.id =
  "fwd-floating-timer";

chatTimer.style.position =
  "fixed";

chatTimer.style.top =
  "12px";

chatTimer.style.right =
  "12px";

chatTimer.style.zIndex =
  "999999999";

chatTimer.style.width =
  "220px";

chatTimer.style.background =
  "rgba(20,20,20,0.88)";

chatTimer.style.color =
  "white";

chatTimer.style.borderRadius =
  "14px";

chatTimer.style.padding =
  "12px";

chatTimer.style.fontFamily =
  "Inter, Arial, sans-serif";

chatTimer.style.cursor =
  "pointer";

chatTimer.style.userSelect =
  "none";

chatTimer.style.fontSize =
  "12px";

chatTimer.style.fontWeight =
  "700";

chatTimer.style.display =
  "none";

chatTimer.style.boxShadow =
  "0 10px 30px rgba(0,0,0,0.35)";

document.body.appendChild(chatTimer);

let timerOpen = false;

const timerHeader =
  document.createElement("div");

timerHeader.textContent =
  "⏱ 02:00";

const timerDetails =
  document.createElement("div");

timerDetails.style.display =
  "none";

timerDetails.style.marginTop =
  "10px";

const tokenInfo =
  document.createElement("div");

tokenInfo.style.marginTop =
  "8px";

const pauseBtn =
  document.createElement("button");

const endSessionBtn =
  document.createElement("button");

endSessionBtn.textContent =
  "Finalizar sesión";

endSessionBtn.style.width =
  "100%";

endSessionBtn.style.marginTop =
  "10px";

endSessionBtn.style.padding =
  "8px";

endSessionBtn.style.borderRadius =
  "8px";

endSessionBtn.style.border =
  "none";

endSessionBtn.style.cursor =
  "pointer";

endSessionBtn.style.fontWeight =
  "700";

endSessionBtn.style.background =
  "#ff3b30";

endSessionBtn.style.color =
  "white";

pauseBtn.textContent =
  "Pausar";

pauseBtn.style.width =
  "100%";

pauseBtn.style.marginTop =
  "10px";

pauseBtn.style.padding =
  "8px";

pauseBtn.style.borderRadius =
  "8px";

pauseBtn.style.border =
  "none";

pauseBtn.style.cursor =
  "pointer";

pauseBtn.style.fontWeight =
  "700";

pauseBtn.style.background =
  "#ff0080";

pauseBtn.style.color =
  "white";

timerDetails.appendChild(tokenInfo);


timerDetails.appendChild(pauseBtn);

timerDetails.appendChild(
  endSessionBtn
);
chatTimer.appendChild(timerHeader);

chatTimer.appendChild(timerDetails);

chatTimer.addEventListener(
  "click",
  (e) => {

    if (e.target === pauseBtn)
      return;

    timerOpen = !timerOpen;

    timerDetails.style.display =
      timerOpen
        ? "block"
        : "none";

  }
);

const wrapper =
  document.createElement("div");

wrapper.innerHTML = `
<style>

#overlay {
  position: fixed;
  inset: 0;

  background:
    rgba(15,15,20,0.78);

  display: flex;
  justify-content: center;
  align-items: center;

  z-index: 999999999;

  backdrop-filter: blur(6px);

  font-family:
    Inter,
    Arial,
    sans-serif;
}

.card {
  width: 340px;

  background: white;

  border-radius: 22px;

  padding: 28px;

  box-shadow:
    0 20px 60px rgba(0,0,0,0.35);

  display: flex;
  flex-direction: column;

  gap: 16px;
}

.logo {
  width: 64px;
  height: 64px;

  border-radius: 16px;

  background:
    linear-gradient(
      135deg,
      #1787d9,
      #4db5ff
    );

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

  font-size: 28px;

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

  background:
    linear-gradient(
      90deg,
      #ff1493,
      #ff0080
    );

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

    <div class="logo">
      FWD
    </div>

    <h1 class="title">
      Bienvenido al<br>
      <span>Sistema Académico de Tokens FWD</span>
    </h1>

    <div class="field">

      <label>
        Selecciona tu grupo
      </label>

      <select id="group-select">

        <option value="">
          Elegir grupo académico...
        </option>

      </select>

    </div>

    <div class="field">

      <label>
        Contraseña profesor
      </label>

      <input
        id="password-input"
        type="password"
      />

    </div>

    <button id="unlock-btn">
      Desbloquear Sistema →
    </button>

    <div id="session-timer">
      Tiempo restante: 02:00
    </div>

    <div class="error" id="error-msg"></div>

  </div>

</div>
`;

shadow.appendChild(wrapper);



const overlay =
  shadow.querySelector("#overlay");

const groupSelect =
  shadow.querySelector("#group-select");

const passwordInput =
  shadow.querySelector("#password-input");

const unlockBtn =
  shadow.querySelector("#unlock-btn");

const errorMsg =
  shadow.querySelector("#error-msg");

const sessionTimer =
  shadow.querySelector("#session-timer");



CONFIG.groups.forEach(group => {

  const opt =
    document.createElement("option");

  opt.value = group;

  opt.textContent = group;

  groupSelect.appendChild(opt);

});



function stopClaudeShortcutLeak(e) {

  e.stopPropagation();

  e.stopImmediatePropagation();

}

[
  passwordInput,
  groupSelect
].forEach(el => {

  [
    "keydown",
    "keypress",
    "keyup"
  ].forEach(type => {

    el.addEventListener(
      type,
      stopClaudeShortcutLeak,
      true
    );

  });

});



function detectClaudeElements() {

  const chatInput =
    document.querySelector(
      '[data-testid="chat-input"]'
    );

  const sendButton =
    document.querySelector(
      'button[aria-label="Enviar mensaje"]'
    );

  return {
    chatInput,
    sendButton
  };

}



function estimateTokens(text) {

  if (!text) return 0;

  return Math.ceil(
    text.length / 4
  );

}



function updateTokenUI() {

  tokenInfo.innerHTML = `

    <div style="
      margin-bottom:8px;
      font-size:13px;
      color:#4db5ff;
      font-weight:800;
    ">
      Grupo:
      ${INTERNAL_STATE.selectedGroup || "N/A"}
    </div>

    <div>
      Tokens:
      ${INTERNAL_STATE.usedEstimatedTokens}
      /
      ${CONFIG.maxEstimatedTokens}
    </div>

  `;

}



function hardBlockInputEvents() {

  const {
    chatInput,
    sendButton
  } = detectClaudeElements();

  if (!chatInput) return;

  const blocker = (e) => {

    if (
      !INTERNAL_STATE.isUnlocked ||
      INTERNAL_STATE.isPaused
    ) {

      e.preventDefault();

      e.stopPropagation();

      e.stopImmediatePropagation();

      return false;

    }

  };

  [
    "keydown",
    "keypress",
    "keyup",
    "beforeinput",
    "input",
    "paste",
    "click"
  ].forEach(type => {

    chatInput.addEventListener(
      type,
      blocker,
      true
    );

  });

  if (sendButton) {

    sendButton.addEventListener(
      "click",
      blocker,
      true
    );

  }

}



function processMessageTokens() {

  if (
    !INTERNAL_STATE.isUnlocked
  ) return;

  if (
    INTERNAL_STATE.isPaused
  ) return;

  const {
    chatInput
  } = detectClaudeElements();

  if (!chatInput) return;

  const text =
    chatInput.innerText.trim();

  if (!text) return;

  const estimated =
    estimateTokens(text);

  const futureTotal =
    INTERNAL_STATE.usedEstimatedTokens +
    estimated;

  console.log("TOKENS:", {
    text,
    estimated,
    futureTotal
  });

  if (
    futureTotal >
    CONFIG.maxEstimatedTokens
  ) {

    expireSession();

    return;

  }

  INTERNAL_STATE.usedEstimatedTokens =
    futureTotal;

  updateTokenUI();

  saveSession();

}



function setupMessageInterception() {

  document.addEventListener(
    "click",
    (e) => {

      const sendButton =
        e.target.closest(
          'button[aria-label="Enviar mensaje"]'
        );

      if (!sendButton) return;

      processMessageTokens();

    },
    true
  );

  document.addEventListener(
    "keydown",
    (e) => {

      if (e.key !== "Enter")
        return;

      if (e.shiftKey)
        return;

      processMessageTokens();

    },
    true
  );

}



function blockClaude() {

  const {
    chatInput,
    sendButton
  } = detectClaudeElements();

  if (chatInput) {

    chatInput.contentEditable =
      "false";

    chatInput.style.pointerEvents =
      "none";

    chatInput.style.opacity =
      "0.4";

    chatInput.blur();

  }

  if (sendButton) {

    sendButton.disabled = true;

    sendButton.style.pointerEvents =
      "none";

    sendButton.style.opacity =
      "0.4";

  }

}



function unblockClaude() {

  const {
    chatInput,
    sendButton
  } = detectClaudeElements();

  if (chatInput) {

    chatInput.contentEditable =
      "true";

    chatInput.style.pointerEvents =
      "auto";

    chatInput.style.opacity =
      "1";

  }

  if (sendButton) {

    sendButton.disabled = false;

    sendButton.style.pointerEvents =
      "auto";

    sendButton.style.opacity =
      "1";

  }

}



function saveSession() {

  const data = {

    ...INTERNAL_STATE,

    selectedGroup:
      groupSelect.value,

    expiresAt:
      Date.now() +
      (
        INTERNAL_STATE.remainingSeconds
        * 1000
      )

  };

  localStorage.setItem(
    STORAGE_KEY,
    JSON.stringify(data)
  );

}



function expireSession() {

  INTERNAL_STATE.isUnlocked =
    false;

  INTERNAL_STATE.isPaused =
    false;

  INTERNAL_STATE.remainingSeconds =
    0;

  INTERNAL_STATE.usedEstimatedTokens =
    0;

  overlay.style.display =
    "flex";

  chatTimer.style.display =
    "none";

  localStorage.removeItem(
    STORAGE_KEY
  );

}



function formatTime(seconds) {

  const mins =
    Math.floor(seconds / 60);

  const secs =
    seconds % 60;

  return `${String(mins).padStart(2,"0")}:${String(secs).padStart(2,"0")}`;

}

function startSessionTimer() {

  clearInterval(
    countdownInterval
  );

  if (
    !INTERNAL_STATE.remainingSeconds
  ) {

    INTERNAL_STATE.remainingSeconds =
      CONFIG.sessionMinutes * 60;

  }

  const update = () => {

    const t =
      formatTime(
        INTERNAL_STATE.remainingSeconds
      );

    timerHeader.textContent =
      `⏱ ${t}`;

    sessionTimer.textContent =
      `Tiempo restante: ${t}`;

    updateTokenUI();

    saveSession();

  };

  update();

  countdownInterval =
    setInterval(() => {

      INTERNAL_STATE.remainingSeconds--;

      update();

      if (
        INTERNAL_STATE.remainingSeconds <= 0
      ) {

        clearInterval(
          countdownInterval
        );

        expireSession();

      }

    }, 1000);

}



unlockBtn.addEventListener(
  "click",
  () => {

    const selectedGroup =
      groupSelect.value;

    const enteredPassword =
      passwordInput.value;

    if (!selectedGroup) {

      errorMsg.style.display =
        "block";

      errorMsg.textContent =
        "Selecciona grupo";

      return;

    }

    if (
      enteredPassword !==
      CONFIG.password
    ) {

      errorMsg.style.display =
        "block";

      errorMsg.textContent =
        "Contraseña incorrecta";

      return;

    }

    errorMsg.style.display =
      "none";

    INTERNAL_STATE.isUnlocked =
      true;

    INTERNAL_STATE.remainingSeconds =
      CONFIG.sessionMinutes * 60;

      INTERNAL_STATE.selectedGroup =
  selectedGroup;

    overlay.style.display =
      "none";

    chatTimer.style.display =
      "block";

    startSessionTimer();

  }
);



pauseBtn.addEventListener(
  "click",
  (e) => {

    e.stopPropagation();

    INTERNAL_STATE.isPaused =
      !INTERNAL_STATE.isPaused;

    if (
      INTERNAL_STATE.isPaused
    ) {

      clearInterval(
        countdownInterval
      );

      blockClaude();

      pauseBtn.textContent =
        "Reanudar";

    } else {

      unblockClaude();

      startSessionTimer();

      pauseBtn.textContent =
        "Pausar";

    }

    saveSession();

  }
);

endSessionBtn.addEventListener(
  "click",
  (e) => {

    e.stopPropagation();

    const confirmed =
      confirm(
        "¿Seguro que deseas finalizar la sesión?\n\nEsta acción cerrará el acceso del estudiante."
      );

    if (!confirmed)
      return;

    clearInterval(
      countdownInterval
    );

    expireSession();

  }
);

const observer =
  new MutationObserver(() => {

    if (
      !document.body.contains(host)
    ) {

      document.body.appendChild(
        host
      );

    }

    if (
      !document.body.contains(chatTimer)
    ) {

      document.body.appendChild(
        chatTimer
      );

    }

  });

observer.observe(
  document.body,
  {
    childList: true,
    subtree: true
  }
);



setInterval(() => {

  if (
    !document.body.contains(host)
  ) {

    document.body.appendChild(
      host
    );

  }

  if (
    !document.body.contains(chatTimer)
  ) {

    document.body.appendChild(
      chatTimer
    );

  }

}, 1000);



setInterval(() => {

  hardBlockInputEvents();

}, 1500);



setupMessageInterception();


function restoreSession() {

  try {

    const raw =
      localStorage.getItem(
        STORAGE_KEY
      );

    if (!raw) return;

    const session =
      JSON.parse(raw);

    if (!session) return;

    if (
      !session.expiresAt
    ) return;

    const remaining =
      Math.floor(
        (
          session.expiresAt -
          Date.now()
        ) / 1000
      );

    if (remaining <= 0) {

      localStorage.removeItem(
        STORAGE_KEY
      );

      return;

    }

    INTERNAL_STATE.isUnlocked =
      session.isUnlocked;

    INTERNAL_STATE.isPaused =
      session.isPaused;

    INTERNAL_STATE.remainingSeconds =
      remaining;

    INTERNAL_STATE.usedEstimatedTokens =
      session.usedEstimatedTokens || 0;

    INTERNAL_STATE.selectedGroup =
      session.selectedGroup || "";

    groupSelect.value =
      session.selectedGroup || "";

    overlay.style.display =
      "none";

    chatTimer.style.display =
      "block";

    updateTokenUI();

    if (
      INTERNAL_STATE.isPaused
    ) {

      blockClaude();

      pauseBtn.textContent =
        "Reanudar";

      timerHeader.textContent =
        `⏸ ${formatTime(remaining)}`;

    } else {

      unblockClaude();

      startSessionTimer();

    }

  } catch (err) {

    console.error(
      "RESTORE SESSION ERROR",
      err
    );

  }

}

restoreSession();





const SECURITY_CONFIG = {

  devtoolsThreshold: 160,

  integrityCheckInterval: 1000,

  lockOnDevtools: true

};



let devtoolsDetected = false;

let securityLock = false;



const securityOverlay =
  document.createElement("div");

securityOverlay.id =
  "fwd-security-overlay";

securityOverlay.style.position =
  "fixed";

securityOverlay.style.inset =
  "0";

securityOverlay.style.background =
  "rgba(10,10,10,0.95)";

securityOverlay.style.zIndex =
  "999999999999";

securityOverlay.style.display =
  "none";

securityOverlay.style.justifyContent =
  "center";

securityOverlay.style.alignItems =
  "center";

securityOverlay.style.flexDirection =
  "column";

securityOverlay.style.color =
  "white";

securityOverlay.style.fontFamily =
  "Inter, Arial, sans-serif";

securityOverlay.style.backdropFilter =
  "blur(10px)";

securityOverlay.innerHTML = `
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
      width: 74px;
      height: 74px;
      border-radius: 18px;
      margin: 0 auto 20px auto;
      background: linear-gradient(135deg,#ff0040,#ff4d6d);
      display:flex;
      align-items:center;
      justify-content:center;
      font-size:30px;
      font-weight:900;
    ">
      !
    </div>

    <h1 style="
      margin:0;
      font-size:28px;
      font-weight:800;
    ">
      Seguridad Activada
    </h1>

    <p style="
      opacity:0.8;
      margin-top:12px;
      line-height:1.6;
      font-size:14px;
    ">
      Se detectó una manipulación
      del sistema académico.
    </p>

    <div style="
      margin-top:24px;
      padding:14px;
      border-radius:12px;
      background:rgba(255,255,255,0.05);
      font-size:13px;
      opacity:0.8;
    ">
      DevTools / modificación DOM detectada
    </div>

  </div>
`;

document.body.appendChild(
  securityOverlay
);



function activateSecurityLock(reason = "") {

  console.warn(
    "SECURITY LOCK:",
    reason
  );

  securityLock = true;

  securityOverlay.style.display =
    "flex";

  blockClaude();

  INTERNAL_STATE.isPaused = true;

}



function deactivateSecurityLock() {

  

  return;

}



function detectDevTools() {

  const widthThreshold =
    window.outerWidth -
    window.innerWidth >
    SECURITY_CONFIG.devtoolsThreshold;

  const heightThreshold =
    window.outerHeight -
    window.innerHeight >
    SECURITY_CONFIG.devtoolsThreshold;

  return (
    widthThreshold ||
    heightThreshold
  );

}





setInterval(() => {

  const detected =
    detectDevTools();

  

  if (
    detected &&
    !devtoolsDetected
  ) {

    devtoolsDetected = true;

    console.warn(
      "DEVTOOLS DETECTED"
    );

    if (
      SECURITY_CONFIG.lockOnDevtools
    ) {

      activateSecurityLock(
        "DevTools abierto"
      );

    }

  }

  

  if (
    !detected &&
    devtoolsDetected
  ) {

    console.warn(
      "DEVTOOLS CLOSED"
    );

    

  }

}, 1000);



window.addEventListener(
  "keydown",
  (e) => {

    const key =
      e.key.toLowerCase();

    

    if (e.key === "F12") {

      e.preventDefault();

      e.stopPropagation();

      activateSecurityLock(
        "F12"
      );

    }

    

    if (
      e.ctrlKey &&
      e.shiftKey &&
      key === "i"
    ) {

      e.preventDefault();

      e.stopPropagation();

      activateSecurityLock(
        "CTRL+SHIFT+I"
      );

    }

    

    if (
      e.ctrlKey &&
      e.shiftKey &&
      key === "j"
    ) {

      e.preventDefault();

      e.stopPropagation();

      activateSecurityLock(
        "CTRL+SHIFT+J"
      );

    }

    

    if (
      e.ctrlKey &&
      key === "u"
    ) {

      e.preventDefault();

      e.stopPropagation();

      activateSecurityLock(
        "CTRL+U"
      );

    }

  },
  true
);



function verifyDOMIntegrity() {

  

  if (
    !document.body.contains(host)
  ) {

    console.warn(
      "HOST REMOVED"
    );

    document.body.appendChild(
      host
    );

  }

  

  if (
    !document.body.contains(chatTimer)
  ) {

    console.warn(
      "TIMER REMOVED"
    );

    document.body.appendChild(
      chatTimer
    );

  }

  

  if (
    !document.body.contains(
      securityOverlay
    )
  ) {

    console.warn(
      "SECURITY OVERLAY REMOVED"
    );

    document.body.appendChild(
      securityOverlay
    );

  }

  

  if (
    overlay.style.display ===
    "none" &&
    !INTERNAL_STATE.isUnlocked
  ) {

    console.warn(
      "OVERLAY FORCE HIDDEN"
    );

    overlay.style.display =
      "flex";

  }

  

  if (
    !INTERNAL_STATE.isUnlocked ||
    INTERNAL_STATE.isPaused ||
    securityLock
  ) {

    const {
      chatInput,
      sendButton
    } = detectClaudeElements();

    if (chatInput) {

      if (
        chatInput.style.pointerEvents !==
        "none"
      ) {

        console.warn(
          "CHAT INPUT RE-ENABLED"
        );

        blockClaude();

      }

    }

    if (sendButton) {

      if (
        sendButton.disabled !==
        true
      ) {

        console.warn(
          "SEND BUTTON RE-ENABLED"
        );

        blockClaude();

      }

    }

  }

}



setInterval(() => {

  verifyDOMIntegrity();

}, SECURITY_CONFIG.integrityCheckInterval);



const integrityObserver =
  new MutationObserver(
    (mutations) => {

      mutations.forEach(
        (mutation) => {

          

          mutation.removedNodes.forEach(
            (node) => {

              if (
                node === host
              ) {

                console.warn(
                  "HOST REMOVAL DETECTED"
                );

                document.body.appendChild(
                  host
                );

              }

              if (
                node === chatTimer
              ) {

                console.warn(
                  "TIMER REMOVAL DETECTED"
                );

                document.body.appendChild(
                  chatTimer
                );

              }

              if (
                node === securityOverlay
              ) {

                console.warn(
                  "SECURITY OVERLAY REMOVED"
                );

                document.body.appendChild(
                  securityOverlay
                );

              }

            }
          );

        }
      );

    }
  );

integrityObserver.observe(
  document.body,
  {
    childList: true,
    subtree: true
  }
);



setInterval(() => {

  if (
    !INTERNAL_STATE.isUnlocked
  ) {

    overlay.style.position =
      "fixed";

    overlay.style.inset =
      "0";

    overlay.style.zIndex =
      "999999999";

    overlay.style.display =
      "flex";

  }

}, 500);



console.warn(`
========================================
 FWD SECURITY SYSTEM ACTIVE
 DOM Integrity: ENABLED
 DevTools Detection: ENABLED
 Hard Lock: ENABLED
========================================
`);
setInterval(() => {

  if (
    !INTERNAL_STATE.isUnlocked
  ) {

    blockClaude();

    return;

  }

  if (
    INTERNAL_STATE.isPaused
  ) {

    blockClaude();

    return;

  }

  unblockClaude();

}, 1000)

