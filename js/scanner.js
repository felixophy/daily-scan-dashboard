(() => {
  const form = document.getElementById("scan-form");
  const dateInput = document.getElementById("date-input");
  const scanBtn = document.getElementById("scan-btn");
  const track = document.getElementById("scan-track");
  const status = document.getElementById("scan-status");
  const results = document.getElementById("results");

  // Default the picker to today.
  dateInput.value = new Date().toISOString().slice(0, 10);

  form.addEventListener("submit", (e) => {
    e.preventDefault();
    runScan(dateInput.value);
  });

  function toDDMMYY(isoDate) {
    const [y, m, d] = isoDate.split("-");
    return `${d}${m}${y.slice(2)}`;
  }

  function setScanning(on) {
    scanBtn.disabled = on;
    track.classList.toggle("active", on);
  }

  async function runScan(isoDate) {
    results.innerHTML = "";
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

    const ddmmyy = toDDMMYY(isoDate);
    const displayDate = isoDate.split("-").reverse().join("/");
    status.textContent = `Scanning ${products.length} products for ${ddmmyy}…`;

    const checks = await Promise.allSettled(
      products.map(async (p) => {
        const titles = await SheetsAPI.getSheetTitles(p.sheetId);
        return titles
          .filter((t) => t.startsWith(ddmmyy))
          .map((t) => ({
            product: p.name,
            sheetId: p.sheetId,
            tab: t,
            shift: t.slice(ddmmyy.length).replace(/^[\s/-]+/, ""),
          }));
      })
    );

    const matches = checks
      .filter((r) => r.status === "fulfilled")
      .flatMap((r) => r.value);

    const failedCount = checks.filter((r) => r.status === "rejected").length;

    setScanning(false);
    renderResults(matches, displayDate, failedCount);
  }

  function renderResults(matches, displayDate, failedCount) {
    if (matches.length === 0) {
      status.textContent = `No runs found for ${displayDate}.`;
      results.innerHTML = `<div class="empty-state">No product sheets have a tab for ${displayDate}. Double-check the date, or that the tab naming (ddmmyy + shift code) matches what's in the sheets.</div>`;
      return;
    }

    status.textContent = `${matches.length} run${matches.length === 1 ? "" : "s"} found for ${displayDate}.` +
      (failedCount ? ` (${failedCount} product sheet${failedCount === 1 ? "" : "s"} couldn't be read.)` : "");

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
