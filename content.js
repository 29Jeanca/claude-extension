const CONFIG = {
    // Contraseña de acceso para profesores
  password: "a",

sessionMinutes: 2,

    // Lista de grupos, son dinámicos, si se agregan, se muestran en el selct
  groups: [
    "Grupo 1",
    "Grupo 2",
    "Grupo 3",
    "Grupo 4",
    "Grupo 5"
  ]
};
let isUnlocked = false;

let countdownInterval = null;

let remainingSeconds = 0;

const host = document.createElement("div");

host.id = "claude-academic-host";

document.body.appendChild(host);


const shadow = host.attachShadow({
  mode: "open"
});


const wrapper = document.createElement("div");

/* =========================
   TEMPLATE
========================= */

wrapper.innerHTML = `
<style>

  #overlay {
    position: fixed;
    inset: 0;

    background:
      rgba(15, 15, 20, 0.78);

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

    animation: fadeIn 0.25s ease;
  }

  @keyframes fadeIn {
    from {
      opacity: 0;
      transform: translateY(8px);
    }

    to {
      opacity: 1;
      transform: translateY(0);
    }
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

    box-shadow:
      0 8px 20px rgba(23,135,217,0.25);
  }

  .title {
    margin: 0;

    text-align: center;

    font-size: 28px;

    line-height: 1.2;

    color: #222;

    font-weight: 800;
  }

  .title span {
    color: #1787d9;
  }

  .description {
    margin: 0;

    text-align: center;

    color: #666;

    font-size: 14px;

    line-height: 1.5;
  }

  .field {
    display: flex;
    flex-direction: column;

    gap: 7px;
  }

  .field label {
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

    color: #222;

    font-size: 14px;

    box-sizing: border-box;

    outline: none;

    transition: 0.2s;
  }

  select::placeholder,
  input::placeholder {
    color: #999;
  }

  select:focus,
  input:focus {
    border-color: #ff1493;

    box-shadow:
      0 0 0 4px rgba(255,20,147,0.12);

    background: white;
  }

  button {
    width: 100%;

    border: none;

    padding: 15px;

    border-radius: 12px;

    background:
      linear-gradient(
        90deg,
        #ff1493,
        #ff0080
      );

    color: white;

    font-size: 15px;

    font-weight: 700;

    cursor: pointer;

    transition: 0.2s;

    margin-top: 2px;

    box-shadow:
      0 8px 20px rgba(255,0,128,0.22);
  }

  button:hover {
    transform: translateY(-1px);

    opacity: 0.96;
  }

  .error {
    display: none;

    text-align: center;

    color: #d1004b;

    font-size: 13px;

    font-weight: 600;
  }

  .footer-link {
    text-align: center;

    color: #1787d9;

    text-decoration: none;

    font-size: 13px;

    font-weight: 600;

    margin-top: 2px;
  }

</style>

<div id="overlay">

  <div class="card">

    <div class="logo">
      FWD
    </div>

    <h1 class="title">
      Bienvenido al <br>
      <span>Sistema Académico de Tokens FWD</span>
    </h1>

    <p class="description">
      Acceso protegido para la gestión de tokens
      de Claude Code. Por favor, selecciona tu
      grupo y solicite al profesor el acceso
      para continuar.
    </p>

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
        Contraseña de profesor
      </label>

      <input
        id="password-input"
        type="password"
        placeholder="Ingresa contraseña"
      />

    </div>

    <button id="unlock-btn">
      Desbloquear Sistema →
    </button>

    <div class="error" id="error-msg">
      Contraseña incorrecta
    </div>
  </div>

</div>
`;



shadow.appendChild(wrapper);


const overlay =
  shadow.getElementById("overlay");

const groupSelect =
  shadow.getElementById("group-select");

const passwordInput =
  shadow.getElementById("password-input");

const unlockBtn =
  shadow.getElementById("unlock-btn");

const errorMsg =
  shadow.getElementById("error-msg");


[
  passwordInput,
  groupSelect
].forEach(element => {

  element.addEventListener("keydown", e => {
    e.stopPropagation();
  });

  element.addEventListener("keypress", e => {
    e.stopPropagation();
  });

  element.addEventListener("keyup", e => {
    e.stopPropagation();
  });

});



CONFIG.groups.forEach(group => {

  const option =
    document.createElement("option");

  option.value = group;

  option.textContent = group;

  groupSelect.appendChild(option);

});



unlockBtn.addEventListener("click", () => {

  const selectedGroup =
    groupSelect.value;

  const enteredPassword =
    passwordInput.value;

  if (!selectedGroup) {

    errorMsg.style.display = "block";

    errorMsg.textContent =
      "Debes seleccionar un grupo";

    return;
  }

  if (enteredPassword !== CONFIG.password) {

    errorMsg.style.display = "block";

    errorMsg.textContent =
      "Contraseña incorrecta";

    return;
  }

  errorMsg.style.display = "none";

  console.log(
    "Acceso concedido:",
    selectedGroup
  );
isUnlocked = true;
  overlay.style.display = "none";

});


/* =========================
   DETECTAR ELEMENTOS CLAUDE
========================= */

function detectClaudeElements() {

  const chatInput = document.querySelector(
    '[data-testid="chat-input"]'
  );

  const sendButton = document.querySelector(
    'button[aria-label="Enviar mensaje"]'
  );

  console.log("CHAT INPUT:");
  console.log(chatInput);

  console.log("SEND BUTTON:");
  console.log(sendButton);

  return {
    chatInput,
    sendButton
  };

}
/* =========================
   BLOQUEAR CLAUDE
========================= */

function blockClaude() {

  const {
    chatInput,
    sendButton
  } = detectClaudeElements();

  /* =========================
     INPUT
  ========================= */

  if (chatInput) {

    chatInput.setAttribute(
      "contenteditable",
      "false"
    );

    chatInput.style.pointerEvents =
      "none";

    chatInput.style.opacity =
      "0.6";
  }

  /* =========================
     BOTÓN
  ========================= */

  if (sendButton) {

    sendButton.disabled = true;

    sendButton.style.pointerEvents =
      "none";

    sendButton.style.opacity =
      "0.5";
  }

}

/* =========================
   DESBLOQUEAR CLAUDE
========================= */

function unblockClaude() {

  const {
    chatInput,
    sendButton
  } = detectClaudeElements();

  /* =========================
     INPUT
  ========================= */

  if (chatInput) {

    chatInput.setAttribute(
      "contenteditable",
      "true"
    );

    chatInput.style.pointerEvents =
      "auto";

    chatInput.style.opacity =
      "1";
  }

  /* =========================
     BOTÓN
  ========================= */

  if (sendButton) {

    sendButton.disabled = false;

    sendButton.style.pointerEvents =
      "auto";

    sendButton.style.opacity =
      "1";
  }

}

/* =========================
   FORMATEAR TIEMPO
========================= */

function formatTime(seconds) {

  const mins =
    Math.floor(seconds / 60);

  const secs =
    seconds % 60;

  return `${String(mins).padStart(2, "0")}:\${String(secs).padStart(2, "0")}`;

}

/* =========================
   INICIAR SESIÓN
========================= */

function startSessionTimer() {

  remainingSeconds =
    CONFIG.sessionMinutes * 60;

  sessionTimer.textContent =
    `Tiempo restante: ${formatTime(remainingSeconds)}`;

  countdownInterval =
    setInterval(() => {

      remainingSeconds--;

      sessionTimer.textContent =
        `Tiempo restante: ${formatTime(remainingSeconds)}`;

      if (remainingSeconds <= 0) {

        clearInterval(countdownInterval);

        expireSession();

      }

    }, 1000);

}



setInterval(() => {

  detectClaudeElements();

}, 2000);
setInterval(() => {

  if (!isUnlocked) {

    blockClaude();

  } else {

    unblockClaude();

  }

}, 1000);
