let mode = "kanji";
let kanjiData = [], displayData = [], currentIndex = 0, pageIndex = 0;
let hafalStatusMap = {}, filteredIndexes = [], filterMode = "all";
let currentFileKey = "hafalStatus_kanji";
let savedSettings = JSON.parse(localStorage.getItem("kanjiSettings")) || {
  kanji: {
    onyomi: true,
    kunyomi: true,
    makna: true,
    catatan: true,
    kosakata: true
  },
  kanjiFront: {
    onyomi: false,
    kunyomi: false,
    makna: false
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

const sheetURL = `https://gsx2json.com/api?id=1_RpNeKghf2p5JycNnY1LhcKSraAayg5sq7Mp2Ip39Tw&sheet=kanji`;

fetch(sheetURL)
  .then(res => res.json())
  .then(result => {
    kanjiData = result.rows || [];
    pageIndex = 0;
    const saved = localStorage.getItem(currentFileKey);
    hafalStatusMap = saved ? JSON.parse(saved) : {};
    totalCount.textContent = kanjiData.length;
    renderGrid();
  });

limitInput.addEventListener("input", () => { pageIndex = 0; renderGrid(); });
document.getElementById("prevPageBtn").onclick = () => { if (pageIndex > 0) { pageIndex--; renderGrid(); } };
document.getElementById("nextPageBtn").onclick = () => {
  const limit = parseInt(limitInput.value) || 10;
  if ((pageIndex + 1) * limit < kanjiData.length) { pageIndex++; renderGrid(); }
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

function renderGrid() {
  kanjiGrid.innerHTML = "";
  const limit = parseInt(limitInput.value) || 10;
  const start = pageIndex * limit;
  const end = Math.min(start + limit, kanjiData.length);
  displayData = kanjiData.slice(start, end);

  for (let data of displayData) {
    const div = document.createElement("div");
    div.className = "kanji";
    div.textContent = data.kanji || data["Huruf"] || "-";
    kanjiGrid.appendChild(div);
  }

  const totalPages = Math.ceil(kanjiData.length / limit);
  pageInfo.textContent = `Halaman ${pageIndex + 1} / ${totalPages}`;
}

function applyFilter() {
  const limit = parseInt(limitInput.value) || 10;
  const start = pageIndex * limit;
  const end = Math.min(start + limit, kanjiData.length);
  const subset = kanjiData.slice(start, end);
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
  const data = kanjiData[i];
  const setting = savedSettings.kanji;

  const hurufKanji = data.kanji || data["Huruf"] || "-";
  const onyomi = data["Onyomi"] || data.on || "-";
  const kunyomi = data["Kunyomi"] || data.kun || "-";
  const makna = data.makna || "-";
  const catatan = data.catatan || "-";
  const kosakata = data["Contoh kata"] || data.kosakata || "-";

  const settingFront = savedSettings.kanjiFront;
  let frontHTML = `<div style="font-size: 2.5rem;">${hurufKanji}</div>`;
  if (settingFront.onyomi && onyomi) {
    frontHTML += `<div style="margin-top: 0.3rem; font-size: 1.5rem">${onyomi}</div>`;
  }
  if (settingFront.kunyomi && kunyomi) {
    frontHTML += `<div style="margin-top: 0.3rem; font-size: 1.5rem">${kunyomi}</div>`;
  }
  if (settingFront.makna && makna) {
    frontHTML += `<div style="margin-top: 0.3rem; font-size: 1rem; color: #555;">${makna}</div>`;
  }
  cardFront.innerHTML = frontHTML;

  let backHTML = `<div class="center-info" style='font-size: 3rem;'>${hurufKanji}</div>`;
  if (setting.onyomi) backHTML += `<div class="center-info">Onyomi: ${onyomi}</div>`;
  if (setting.kunyomi) backHTML += `<div class="center-info">Kunyomi: ${kunyomi}</div>`;
  if (setting.makna) backHTML += `<div class="center-info">Makna: ${makna}</div>`;
  if (setting.catatan) backHTML += `<div><strong>Catatan:</strong><br>${catatan}</div>`;
  if (setting.kosakata) backHTML += `<div><strong>Contoh Kosakata:</strong><br>${kosakata}</div>`;


  cardBack.innerHTML = backHTML;
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

function renderSettingsOptions() {
  const container = document.getElementById("popupSettings");
  const current = savedSettings.kanji;
  const currentFront = savedSettings.kanjiFront;
  const html = `
    <div><strong>Tampilan Belakang:</strong></div>
    <label><input type="checkbox" class="setting-check" value="onyomi" ${current.onyomi ? "checked" : ""}> Tampilkan Onyomi</label>
    <label><input type="checkbox" class="setting-check" value="kunyomi" ${current.kunyomi ? "checked" : ""}> Tampilkan Kunyomi</label>
    <label><input type="checkbox" class="setting-check" value="makna" ${current.makna ? "checked" : ""}> Tampilkan Makna</label>
    <label><input type="checkbox" class="setting-check" value="catatan" ${current.catatan ? "checked" : ""}> Tampilkan Catatan</label>
    <label><input type="checkbox" class="setting-check" value="kosakata" ${current.kosakata ? "checked" : ""}> Tampilkan Contoh Kosakata</label>

    <hr style="margin: 1rem 0;">
    <div><strong>Tampilan Depan:</strong></div>
    <label><input type="checkbox" class="setting-front" value="onyomi" ${currentFront.onyomi ? "checked" : ""}> Onyomi</label>
    <label><input type="checkbox" class="setting-front" value="kunyomi" ${currentFront.kunyomi ? "checked" : ""}> Kunyomi</label>
    <label><input type="checkbox" class="setting-front" value="makna" ${currentFront.makna ? "checked" : ""}> Makna</label>

    <button id="closeSettings">Tutup</button>
  `;
  container.innerHTML = html;

  container.querySelectorAll(".setting-check").forEach(input => {
    input.addEventListener("change", () => {
      savedSettings.kanji[input.value] = input.checked;
      saveSettings();
      showCard();
    });
  });

  container.querySelectorAll(".setting-front").forEach(input => {
    input.addEventListener("change", () => {
      savedSettings.kanjiFront[input.value] = input.checked;
      saveSettings();
      showCard();
    });
  });

  document.getElementById("closeSettings").onclick = toggleSettings;
}

function toggleSettings() {
  const popup = document.getElementById("popupSettings");
  const overlay = document.getElementById("overlay");
  const isVisible = popup.style.display === "block";

  if (!isVisible) renderSettingsOptions();

  popup.style.display = overlay.style.display = isVisible ? "none" : "block";
}

function saveSettings() {
  localStorage.setItem("kanjiSettings", JSON.stringify(savedSettings));
}

document.getElementById("settingToggle").onclick = toggleSettings;
document.getElementById("overlay").onclick = toggleSettings;
