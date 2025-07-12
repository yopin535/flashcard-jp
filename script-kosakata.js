const API_KEY = "AIzaSyAHX99hr1pn46Iar5oW3hzsK_2I7pKgUMA";
const MASTER_LIST_ID = "1TdRFPDT_j_9i7h2IptHqkvlsD-r5DwOh3xh--0mAlDA";

const fileSelector = document.getElementById("fileSelector");
const sheetSelector = document.getElementById("sheetSelector");

let kosakataData = [], displayData = [], currentIndex = 0, pageIndex = 0;
let hafalStatusMap = {}, filteredIndexes = [], filterMode = "all";
let currentFileKey = "", currentSheet = "", currentFileId = "";

let savedSettings = JSON.parse(localStorage.getItem("kosakataSettings")) || {
  kosakata: {
    kanji: false,
    arti: false
  }
};

const limitInput = document.getElementById("limitInput");
const totalCount = document.getElementById("totalCount");
const loadButton = document.getElementById("loadButton");
const kanjiGrid = document.getElementById("kanjiGrid");
const flashcardSection = document.getElementById("flashcard-section");
const uploadSection = document.getElementById("upload-section");
const cardFront = document.getElementById("cardFront");
const cardBack = document.getElementById("cardBack");
const card = document.getElementById("card");
const counter = document.getElementById("counter");
const pageInfo = document.getElementById("pageInfo");
const filterSelect = document.getElementById("filterSelect");
const hafalStatusText = document.getElementById("hafalStatus");

const settingToggle = document.getElementById("settingToggle");
const overlay = document.getElementById("overlay");
const popupSettings = document.getElementById("popupSettings");

let autoMode = false;
let autoTime = 5;
let autoTimer = null;

// 🔁 Ambil daftar file dari spreadsheet
fetch(`https://sheets.googleapis.com/v4/spreadsheets/${MASTER_LIST_ID}/values/daftar_file?key=${API_KEY}`)
  .then(res => res.json())
  .then(data => {
    const rows = data.values;
    if (!rows || rows.length < 2) return;
    const headers = rows[0];
    const fileIdIndex = headers.indexOf("file_id");
    const labelIndex = headers.indexOf("label");
    const jenisIndex = headers.indexOf("jenis");

    fileSelector.innerHTML = `<option value="">-- Pilih File --</option>`;
    rows.slice(1).forEach(row => {
      if (row[jenisIndex] !== "kosakata") return; // ⛔ skip jika bukan kosakata

      const fileId = row[fileIdIndex];
      const label = row[labelIndex];
      const opt = document.createElement("option");
      opt.value = fileId;
      opt.textContent = label;
      fileSelector.appendChild(opt);
    });

  });

// 🔁 Saat file dipilih → ambil sheet-nya
fileSelector.addEventListener("change", () => {
  const fileId = fileSelector.value;
  currentFileId = fileId;
  if (!fileId) return;

  fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties&key=${API_KEY}`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data.sheets)) {
        sheetSelector.innerHTML = `<option value="">-- Pilih Data --</option>`;
        data.sheets.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s.properties.title;
          opt.textContent = s.properties.title;
          sheetSelector.appendChild(opt);
        });
      }
    });
});

// 🔁 Saat sheet dipilih → ambil data
sheetSelector.addEventListener("change", () => {
  const sheetName = sheetSelector.value;
  if (!currentFileId || !sheetName) return;

  currentSheet = sheetName;
  currentFileKey = `hafalStatus_${currentFileId}_${sheetName}`;
  const url = `https://sheets.googleapis.com/v4/spreadsheets/${currentFileId}/values/${sheetName}?key=${API_KEY}`;

  fetch(url)
    .then(res => res.json())
    .then(data => {
      const values = data.values;
      if (!values || values.length < 2) {
        alert("Sheet kosong atau tidak memiliki data yang cukup.");
        return;
      }

      const headers = values[0];
      kosakataData = values.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h.trim()] = row[i] || "");
        return obj;
      });

      const saved = localStorage.getItem(currentFileKey);
      hafalStatusMap = saved ? JSON.parse(saved) : {};
      pageIndex = 0;
      totalCount.textContent = kosakataData.length;
      renderGrid();
    });
});

limitInput.addEventListener("input", () => { pageIndex = 0; renderGrid(); });
document.getElementById("prevPageBtn").onclick = () => { if (pageIndex > 0) { pageIndex--; renderGrid(); } };
document.getElementById("nextPageBtn").onclick = () => {
  const limit = parseInt(limitInput.value) || 10;
  if ((pageIndex + 1) * limit < kosakataData.length) { pageIndex++; renderGrid(); }
};

loadButton.onclick = () => {
  uploadSection.style.display = "none";
  flashcardSection.style.display = "flex";
  currentIndex = 0;
  applyFilter();
  showCard();
};

document.getElementById("backBtn").onclick = () => {
  flashcardSection.style.display = "none";
  uploadSection.style.display = "block";
  renderGrid();
};
document.getElementById("prevBtn").onclick = () => { if (currentIndex > 0) { currentIndex--; showCard(); } };
document.getElementById("nextBtn").onclick = () => { if (currentIndex < filteredIndexes.length - 1) { currentIndex++; showCard(); } };
document.getElementById("shuffleBtn").onclick = () => {
  filteredIndexes.sort(() => Math.random() - 0.5);
  currentIndex = 0;
  showCard();
};
document.getElementById("markKnown").onclick = () => {
  const i = filteredIndexes[currentIndex];
  hafalStatusMap[i] = "known"; saveHafalan(); showCard();
};
document.getElementById("markUnknown").onclick = () => {
  const i = filteredIndexes[currentIndex];
  hafalStatusMap[i] = "unknown"; saveHafalan(); showCard();
};
filterSelect.addEventListener("change", () => {
  filterMode = filterSelect.value;
  applyFilter(); currentIndex = 0; showCard();
});
card.onclick = () => card.classList.toggle("flip");

document.getElementById("autoToggleBtn").onclick = () => {
  autoMode = !autoMode;
  document.getElementById("autoToggleBtn").textContent = autoMode ? "Nonaktifkan Auto Mode" : "Aktifkan Auto Mode";
  if (autoMode) startAutoFlip(); else stopAutoFlip();
};
document.getElementById("autoTimeInput").addEventListener("input", e => {
  autoTime = parseInt(e.target.value) || 5;
  if (autoMode) { stopAutoFlip(); startAutoFlip(); }
});

settingToggle.onclick = toggleSettings;
overlay.onclick = toggleSettings;

function renderGrid() {
  kanjiGrid.innerHTML = "";
  const limit = parseInt(limitInput.value) || 10;
  const start = pageIndex * limit;
  const end = Math.min(start + limit, kosakataData.length);
  displayData = kosakataData.slice(start, end);

  for (let data of displayData) {
    const div = document.createElement("div");
    div.className = "kanji";
    div.textContent = data.kosakata || data.Kosakata || "-";
    kanjiGrid.appendChild(div);
  }

  const totalPages = Math.ceil(kosakataData.length / limit);
  pageInfo.textContent = `Halaman ${pageIndex + 1} / ${totalPages}`;
}

function applyFilter() {
  const limit = parseInt(limitInput.value) || 10;
  const start = pageIndex * limit;
  const end = Math.min(start + limit, kosakataData.length);
  const subset = kosakataData.slice(start, end);
  filteredIndexes = [];

  subset.forEach((_, i) => {
    const globalIndex = start + i;
    const status = hafalStatusMap[globalIndex];
    if (
      filterMode === "all" ||
      (filterMode === "known" && status === "known") ||
      (filterMode === "unknown" && status !== "known")
    ) {
      filteredIndexes.push(globalIndex);
    }
  });
}

function showCard() {
  if (filteredIndexes.length === 0) {
    cardFront.textContent = "-";
    cardBack.innerHTML = "<p>Data kosong</p>";
    counter.textContent = `0 / 0`;
    hafalStatusText.textContent = "";
    return;
  }

  const i = filteredIndexes[currentIndex];
  const data = kosakataData[i];

  const kosa = data.kosakata || data.Kosakata || "-";
  const hira = data.kanji || data.Kanji || "-";
  const arti = data.arti || data.Arti || "-";
  const kalimat = data["contoh kalimat"] || data.Kalimat || "-";

  const setting = savedSettings.kosakata;
  let frontHTML = `<div style="font-size: 1.8rem;">${kosa}</div>`;
  if (setting.kanji && hira !== "-") {
    frontHTML += `<div style="margin-top: 0.5rem; font-size: 1.3rem;">${hira}</div>`;
  }
  if (setting.arti && arti !== "-") {
    frontHTML += `<div style="margin-top: 0.3rem; font-size: 1.3rem;">${arti}</div>`;
  }
  cardFront.innerHTML = frontHTML;

  cardBack.innerHTML = `
    <div class="center-info" style="font-size: 1.8rem;">${kosa}</div>
    <div class="center-info" style="font-size: 1.3rem;">${hira}</div>
    <div class="center-info" style="font-size: 1rem;">${arti}</div>
    <div style="margin-top: 1rem;"><strong>Contoh Kalimat:</strong><br><pre>${kalimat}</pre></div>
  `;

  counter.textContent = `${currentIndex + 1} / ${filteredIndexes.length}`;
  const status = hafalStatusMap[i];
  hafalStatusText.textContent = status === "known" ? "✓ Sudah Hafal" : (status === "unknown" ? "✗ Belum Hafal" : "");
  card.classList.remove("flip");
}

function saveHafalan() {
  if (currentFileKey) localStorage.setItem(currentFileKey, JSON.stringify(hafalStatusMap));
}
function resetHafalan() {
  if (currentFileKey && confirm("Yakin ingin reset semua hafalan?")) {
    localStorage.removeItem(currentFileKey);
    hafalStatusMap = {};
    applyFilter();
    showCard();
  }
}

function saveSettings() {
  localStorage.setItem("kosakataSettings", JSON.stringify(savedSettings));
}

function toggleSettings() {
  const isVisible = popupSettings.style.display === "block";
  if (!isVisible) renderSettingsOptions();
  popupSettings.style.display = overlay.style.display = isVisible ? "none" : "block";
}

function renderSettingsOptions() {
  const current = savedSettings.kosakata;
  const html = `
    <label><input type="checkbox" class="setting-front" value="kanji" ${current.kanji ? "checked" : ""}> Tampilkan Kanji (Depan)</label>
    <label><input type="checkbox" class="setting-front" value="arti" ${current.arti ? "checked" : ""}> Tampilkan Arti (Depan)</label>
    <button id="closeSettings">Tutup</button>
  `;
  popupSettings.innerHTML = html;

  popupSettings.querySelectorAll("input[type=checkbox]").forEach(input => {
    input.addEventListener("change", () => {
      savedSettings.kosakata[input.value] = input.checked;
      saveSettings();
      showCard();
    });
  });

  document.getElementById("closeSettings").onclick = toggleSettings;
}

function startAutoFlip() {
  const halfTime = (autoTime / 2) * 1000;
  if (autoTimer) clearInterval(autoTimer);
  autoTimer = setInterval(() => {
    card.classList.add("flip");
    setTimeout(() => {
      if (currentIndex < filteredIndexes.length - 1) {
        currentIndex++;
      } else {
        currentIndex = 0;
      }
      showCard();
      card.classList.remove("flip");
    }, halfTime);
  }, autoTime * 1000);
}

function stopAutoFlip() {
  if (autoTimer) clearInterval(autoTimer);
}
