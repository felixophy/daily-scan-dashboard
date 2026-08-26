(() => {
  const els = {
    back: document.getElementById("back-link"),
    body: document.getElementById("chart-body"),
  };

  const params = new URLSearchParams(window.location.search);
  const sheetId = params.get("sheetId");
  const tab = params.get("tab");

  if (!sheetId || !tab) {
    renderError("Missing sheet or tab in the link. Go back and pick a run again.");
  } else {
    loadChart(sheetId, tab);
  }

  async function loadChart(sheetId, tab) {
    const { CELLS } = window.QC_CONFIG;
    const q = SheetsAPI.quoteSheetTitle(tab);

    let ranges;
    try {
      ranges = await SheetsAPI.batchGetValues(sheetId, [
        `${q}!${CELLS.DATE}`,
        `${q}!${CELLS.PRODUCT}`,
        `${q}!${CELLS.SHIFT}`,
        `${q}!${CELLS.DATA_RANGE}`,
      ]);
    } catch (err) {
      renderError(`Couldn't load this run: ${err.message}`);
      return;
    }

    const cellValue = (vr) => vr?.values?.[0]?.[0] ?? "";
    const date = cellValue(ranges[0]);
    const product = cellValue(ranges[1]);
    const shift = cellValue(ranges[2]);
    const grid = ranges[3]?.values || [];

    // Rows, in order, matching CELLS.DATA_RANGE (B47:AQ54):
    const [time, salt, gradeCLow, gradeCHigh, gradeBLow, gradeBHigh, gradeALow, gradeAHigh] =
      grid;

    if (!time || !salt) {
      renderError("This run's data range looks empty or in an unexpected layout.");
      return;
    }

    // Trim to however many time points actually have data.
    let n = 0;
    while (n < time.length && time[n] !== "" && time[n] != null) n++;

    renderChart({
      product,
      shift,
      date,
      time: time.slice(0, n),
      salt: salt.slice(0, n).map(Number),
      gradeALow: padConst(gradeALow, n),
      gradeAHigh: padConst(gradeAHigh, n),
      gradeBLow: padConst(gradeBLow, n),
      gradeBHigh: padConst(gradeBHigh, n),
      gradeCLow: padConst(gradeCLow, n),
      gradeCHigh: padConst(gradeCHigh, n),
    });
  }

  function padConst(row, n) {
    const v = Number(row?.[0]);
    return new Array(n).fill(v);
  }

  function renderError(message) {
    els.body.innerHTML = `<div class="error-state">${message}</div>`;
  }

  function renderChart(d) {
    els.body.innerHTML = `
      <div class="chart-header">
        <h1 class="chart-title">Salt content control chart</h1>
        <p class="chart-sub">${escapeHtml(d.product)} &middot; ${escapeHtml(d.shift)}</p>
        <p class="chart-subtitle">Salt Content = %Salt &minus; Blank Salt</p>
        <p class="chart-date">${escapeHtml(d.date)}</p>
      </div>

      <div class="legend">
        <span><span class="swatch solid"></span>% salt &minus; blank</span>
        <span><span class="swatch dash-a"></span>Grade A (high)</span>
        <span><span class="swatch dash-a"></span>Grade A (low)</span>
        <span><span class="swatch dash-b"></span>Grade B (high)</span>
        <span><span class="swatch dash-b"></span>Grade B (low)</span>
        <span><span class="swatch dash-c"></span>Grade C (high)</span>
        <span><span class="swatch dash-c"></span>Grade C (low)</span>
      </div>

      <div class="chart-card">
        <div class="chart-canvas-wrap">
          <canvas id="saltChart" role="img" aria-label="Line chart of salt content control data for ${escapeHtml(d.product)} ${escapeHtml(d.shift)}, ${escapeHtml(d.date)}."></canvas>
        </div>
      </div>
    `;

    Chart.register(ChartDataLabels);

    new Chart(document.getElementById("saltChart"), {
      type: "line",
      data: {
        labels: d.time,
        datasets: [
          line("Grade C (high)", d.gradeCHigh, "#EF4444", true),
          line("Grade C (low)", d.gradeCLow, "#EF4444", true),
          line("Grade B (high)", d.gradeBHigh, "#EAB308", true),
          line("Grade B (low)", d.gradeBLow, "#EAB308", true),
          line("Grade A (high)", d.gradeAHigh, "#16A34A", true),
          line("Grade A (low)", d.gradeALow, "#16A34A", true),
          {
            label: "% salt - blank",
            data: d.salt,
            borderColor: "#7C3AED",
            backgroundColor: "#7C3AED",
            borderWidth: 2,
            pointRadius: 3,
            pointBackgroundColor: "#7C3AED",
            tension: 0.4,
            datalabels: {
              display: true,
              align: "top",
              anchor: "end",
              offset: 4,
              color: "#5B21B6",
              font: { size: 10, weight: "bold" },
              formatter: (v) => (Number.isFinite(v) ? v.toFixed(2) : ""),
            },
          },
        ],
      },
      options: {
        responsive: true,
        maintainAspectRatio: false,
        layout: { padding: { top: 15 } },
        plugins: { legend: { display: false }, datalabels: { display: false } },
        scales: {
          x: {
            title: { display: true, text: "Time", color: "#898781", font: { size: 12, weight: "bold" } },
            ticks: { autoSkip: false, maxRotation: 45, minRotation: 45, color: "#898781", font: { size: 10, weight: "bold" } },
            grid: { display: false },
          },
          y: {
            title: { display: true, text: "Salt Content", color: "#898781", font: { size: 12, weight: "bold" } },
            ticks: { color: "#898781", font: { size: 10, weight: "bold" } },
            grid: { color: "rgba(137,135,129,0.15)" },
          },
        },
      },
    });
  }

  function line(label, data, color, dashed) {
    return {
      label,
      data,
      borderColor: color,
      borderDash: dashed ? [6, 4] : [],
      borderWidth: 1.5,
      pointRadius: 0,
      tension: 0,
      datalabels: { display: false },
    };
  }

  function escapeHtml(str) {
    const div = document.createElement("div");
    div.textContent = str ?? "";
    return div.innerHTML;
  }
})();
