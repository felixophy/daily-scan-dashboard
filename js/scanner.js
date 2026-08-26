(() => {
  const form = document.getElementById("scan-form");
  const dateInput = document.getElementById("date-input");
  const scanBtn = document.getElementById("scan-btn");
  const track = document.getElementById("scan-track");
  const status = document.getElementById("scan-status");
  const results = document.getElementById("results");

  // How many product sheets to check at once. Keeps us comfortably
  // under Google's default 60-reads-per-minute-per-user quota.
  const CONCURRENCY = 8;

  // Default the picker to today.
  dateInput.value = new Date().toISOString().slice(0, 10);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runScan(dateInput.value);
  });

  function toDDMMYY(isoDate) {
    const date = new Date(isoDate + "T00:00:00");
    const dd = String(date.getDate()).padStart(2, "0");
    const mm = String(date.getMonth() + 1).padStart(2, "0");
    const yy = String(date.getFullYear()).slice(-2);
    return `${dd}${mm}${yy}`;
  }

  function setScanning(on) {
    scanBtn.disabled = on;
    track.classList.toggle("active", on);
  }

  /** Runs fn over items with at most `limit` in flight at once. */
  async function mapWithLimit(items, limit, fn) {
    const out = new Array(items.length);
    let next = 0;
    async function worker() {
      while (next < items.length) {
        const i = next++;
        try {
          out[i] = { status: "fulfilled", value: await fn(items[i]) };
        } catch (err) {
          out[i] = { status: "rejected", reason: err };
        }
      }
    }
    await Promise.all(
      new Array(Math.min(limit, items.length)).fill(0).map(worker)
    );
    return out;
  }

  function cacheKey(ddmmyy) {
    return `qc-scan:${ddmmyy}`;
  }

  async function runScan(isoDate) {
    results.innerHTML = "";
    const ddmmyy = toDDMMYY(isoDate);
    const displayDate = isoDate.split("-").reverse().join("/");

    // Serve from this session's cache if we've already scanned this date —
    // saves quota on repeat testing/navigation.
    const cached = sessionStorage.getItem(cacheKey(ddmmyy));
    if (cached) {
      const { matches, failedCount } = JSON.parse(cached);
      renderResults(matches, displayDate, failedCount);
      return;
    }

    setScanning(true);
    status.textContent = "Reading masterlist…";

    let products;
    try {
      const rows = await SheetsAPI.getValues(
        window.QC_CONFIG.MASTERLIST_ID,
        window.QC_CONFIG.MASTERLIST_RANGE
      );
      products = rows
        .map(([name, link]) => ({
          name: (name || "").trim(),
          sheetId: link ? SheetsAPI.extractSheetId(link) : null,
        }))
        .filter((p) => p.name && p.sheetId);
    } catch (err) {
      setScanning(false);
      showError(`Couldn't read the masterlist: ${err.message}`);
      return;
    }

    status.textContent = `Scanning ${products.length} products for ${ddmmyy}…`;

    const checks = await mapWithLimit(products, CONCURRENCY, async (p) => {
      const titles = await SheetsAPI.getSheetTitles(p.sheetId);
      return titles
        .map((t) => String(t).trim())
        .filter((t) => t.substring(0, 6) === ddmmyy)
        .map((t) => ({
          product: p.name,
          sheetId: p.sheetId,
          tab: t,
          shift: t.substring(ddmmyy.length).replace(/^[\s()/-]+|[\s()/-]+$/g, ""),
        }));
    });

    const matches = checks
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const failedCount = checks.filter((r) => r.status === "rejected").length;

    setScanning(false);

    // Only cache clean results — don't let a quota-hit scan poison
    // later lookups for the same date this session.
    if (failedCount === 0) {
      sessionStorage.setItem(
        cacheKey(ddmmyy),
        JSON.stringify({ matches, failedCount })
      );
    }

    renderResults(matches, displayDate, failedCount, products.length);
  }

  function renderResults(matches, displayDate, failedCount, totalChecked) {
    // A large chunk of failures usually means a quota hit, not missing data —
    // say so plainly rather than reporting a flat "not found".
    if (failedCount > 0 && matches.length === 0) {
      status.textContent = "";
      results.innerHTML = `<div class="error-state">Couldn't check ${failedCount}${totalChecked ? ` of ${totalChecked}` : ""} product sheets (likely a Sheets API quota limit). Wait about a minute and search again — see the README for raising your quota so this stops happening.</div>`;
      return;
    }

    if (matches.length === 0) {
      status.textContent = `No runs found for ${displayDate}.`;
      results.innerHTML = `<div class="empty-state">No product sheets have a tab for ${displayDate}. Double-check the date, or that the tab naming (ddmmyy + shift code) matches what's in the sheets.</div>`;
      return;
    }

    status.textContent = `${matches.length} run${matches.length === 1 ? "" : "s"} found for ${displayDate}.` +
      (failedCount ? ` (${failedCount} product sheet${failedCount === 1 ? "" : "s"} couldn't be read — try again shortly if you're expecting more.)` : "");

    results.innerHTML = matches
      .map((m) => {
        const params = new URLSearchParams({
          sheetId: m.sheetId,
          tab: m.tab,
        });
        return `
          <a class="result-card" href="chart.html?${params.toString()}">
            <div class="result-main">
              <span class="result-product">${escapeHtml(m.product)}</span>
              <span class="result-tab">${escapeHtml(m.tab)}</span>
            </div>
            <span class="result-arrow">&rarr;</span>
          </a>`;
      })
      .join("");
  }

  function showError(message) {
    status.textContent = "";
    results.innerHTML = `<div class="error-state">${escapeHtml(message)}</div>`;
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str;
    return div.innerHTML;
  }
})();
