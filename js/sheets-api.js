/* ============================================================
   Thin wrapper around the Google Sheets API v4 (read-only).
   ============================================================ */

const SheetsAPI = (() => {
  const BASE = "https://sheets.googleapis.com/v4/spreadsheets";

  function key() {
    const k = window.QC_CONFIG.API_KEY;
    if (!k || k === "AlzaSyB-2xBtеJDwieAzEQTМMkZKSf9dWХtВS3M") {
      throw new Error(
        "No Google Sheets API key set. Add one in js/config.js."
      );
    }
    return k;
  }

  async function request(url, attempt = 0) {
    const res = await fetch(url);
    if (res.ok) return res.json();

    const body = await res.json().catch(() => ({}));
    const isQuota = res.status === 429 || body?.error?.status === "RESOURCE_EXHAUSTED";

    if (isQuota && attempt < 4) {
      // Exponential backoff with a little jitter: ~1s, 2s, 4s, 8s.
      const delay = Math.min(1000 * 2 ** attempt, 8000) + Math.random() * 300;
      await new Promise((r) => setTimeout(r, delay));
      return request(url, attempt + 1);
    }

    const msg = body?.error?.message || `${res.status} ${res.statusText}`;
    throw new Error(msg);
  }

  /** Extracts a spreadsheet ID from a full Google Sheets URL. */
  function extractSheetId(url) {
    const match = String(url).match(/\/d\/([a-zA-Z0-9-_]+)/);
    return match ? match[1] : null;
  }

  /** Reads a single range as raw values (array of rows). */
  async function getValues(spreadsheetId, range) {
    const url =
      `${BASE}/${spreadsheetId}/values/${encodeURIComponent(range)}` +
      `?valueRenderOption=FORMATTED_VALUE&key=${key()}`;
    const data = await request(url);
    return data.values || [];
  }

  /** Reads several ranges from one spreadsheet in one call. */
  async function batchGetValues(spreadsheetId, ranges) {
    const params = ranges
      .map((r) => `ranges=${encodeURIComponent(r)}`)
      .join("&");
    const url =
      `${BASE}/${spreadsheetId}/values:batchGet?${params}` +
      `&valueRenderOption=FORMATTED_VALUE&key=${key()}`;
    const data = await request(url);
    return data.valueRanges || [];
  }

  /** Lists the sheet (tab) titles inside a spreadsheet. */
  async function getSheetTitles(spreadsheetId) {
    const url =
      `${BASE}/${spreadsheetId}?fields=sheets.properties.title&key=${key()}`;
    const data = await request(url);
    return (data.sheets || []).map((s) => s.properties.title);
  }

  /** Wraps a sheet title for use in an A1 range (handles spaces, quotes). */
  function quoteSheetTitle(title) {
    return `'${String(title).replace(/'/g, "''")}'`;
  }

  return {
    extractSheetId,
    getValues,
    batchGetValues,
    getSheetTitles,
    quoteSheetTitle,
  };
})();
