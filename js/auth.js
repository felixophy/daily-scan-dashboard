(function () {
  const STORAGE_KEY = "qc_scanner_unlocked";

  function isUnlocked() {
    return localStorage.getItem(STORAGE_KEY) === "true";
  }

  function markUnlocked() {
    localStorage.setItem(STORAGE_KEY, "true");
  }

  async function fetchStoredPassword() {
    const { MASTERLIST_ID } = window.QC_CONFIG;
    const range = `${SheetsAPI.quoteSheetTitle("PW")}!A1`;
    const rows = await SheetsAPI.getValues(MASTERLIST_ID, range);
    const value = rows && rows[0] && rows[0][0];
    return value ? String(value).trim() : null;
  }

  function buildLockScreen() {
    const overlay = document.createElement("div");
    overlay.id = "auth-overlay";
    overlay.className = "auth-overlay";
    overlay.innerHTML = `
      <div class="auth-box">
        <p class="auth-title">Admin access</p>
        <form id="auth-form" class="auth-form">
          <input type="password" id="auth-input" placeholder="Password" autocomplete="off" required />
          <button type="submit">Unlock</button>
        </form>
        <p id="auth-error" class="auth-error" hidden></p>
      </div>
    `;
    document.body.appendChild(overlay);
    return overlay;
  }

  async function gate() {
    if (isUnlocked()) return;

    document.documentElement.classList.add("auth-locked");

    const overlay = buildLockScreen();
    const form = overlay.querySelector("#auth-form");
    const input = overlay.querySelector("#auth-input");
    const errorMsg = overlay.querySelector("#auth-error");
    const submitBtn = overlay.querySelector("button[type=submit]");

    let storedPassword = null;
    let fetchFailed = false;

    try {
      storedPassword = await fetchStoredPassword();
    } catch (err) {
      fetchFailed = true;
      errorMsg.textContent = "Could not verify password right now. Please refresh and try again.";
      errorMsg.hidden = false;
    }

    form.addEventListener("submit", (e) => {
      e.preventDefault();

      if (fetchFailed) {
        errorMsg.textContent = "Could not verify password right now. Please refresh and try again.";
        errorMsg.hidden = false;
        return;
      }

      if (storedPassword !== null && input.value === storedPassword) {
        markUnlocked();
        document.documentElement.classList.remove("auth-locked");
        overlay.remove();
      } else {
        errorMsg.textContent = "Incorrect password";
        errorMsg.hidden = false;
        input.value = "";
        input.focus();
      }
    });
  }

  gate();
})();
