/* ============================================================
   Fill this in before deploying:

   1. In Google Cloud Console, enable the "Google Sheets API" on
      your project and create an API key.
   2. Restrict that key: Application restriction -> Websites,
      add your GitHub Pages URL (e.g. https://yourname.github.io/*).
      API restriction -> limit it to "Google Sheets API" only.
   3. Make sure the masterlist sheet and every product sheet are
      shared as "Anyone with the link — Viewer".
   4. Paste your key below.
   ============================================================ */

window.QC_CONFIG = {
  API_KEY: "AlzaSyB-2xBtеJDwieAzEQTМMkZKSf9dWХtВS3M",

  // The masterlist spreadsheet that lists every product and a
  // link to that product's own QC spreadsheet.
  MASTERLIST_ID: "1zCGsDN04qFYxrhbTCLLgRDTJyc8LvBD20K-NKYsbHnE",

  // Range in the masterlist holding [product name, sheet link].
  // Column A = product name, column B = link to that product's sheet.
  // Adjust if your masterlist's columns ever move.
  MASTERLIST_RANGE: "A2:B",

  // Cell layout inside each product sheet's dated tab.
  CELLS: {
    DATE: "B5",
    PRODUCT: "B8",
    SHIFT: "D7",
    DATA_RANGE: "B47:AQ54", // time / %salt-blank / gradeC lo,hi / gradeB lo,hi / gradeA lo,hi
  },
};
