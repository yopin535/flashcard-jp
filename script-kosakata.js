const API_KEY = "AIzaSyAHX99hr1pn46Iar5oW3hzsK_2I7pKgUMA";
const MASTER_LIST_ID = "1TdRFPDT_j_9i7h2IptHqkvlsD-r5DwOh3xh--0mAlDA";

const fileSelector = document.getElementById("fileSelector");
const sheetSelector = document.getElementById("sheetSelector");

let kosakataData = [], displayData = [], currentIndex = 0, pageIndex = 0;
let hafalStatusMap = {}, filteredIndexes = [], filterMode = "all";
let currentFileKey = "", currentSheet = "", currentFileId = "";

let showFrontKosakata = true; // default AKTIF
let showFrontKanji = false;
let showFrontArti = false;

let lastRandomField = null; // untuk menghindari field yang sama berurutan

let currentMode = "default"; // nilai bisa: "default", "flashcard", "quiz"

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

const emptyMessage = document.getElementById("emptyMessage");

let autoMode = false;
let autoTime = 5;
let autoTimer = null;

let quizData = [];
let currentQuizIndex = 0;
let quizScore = 0;
let quizAnswers = [];
let quizMode = "random";

let quizSourceData = [];
let wasInFlashcardMode = false;

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
  currentMode = "flashcard";
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
document.getElementById("quizButton").onclick = () => {
  document.getElementById("quiz-popup").style.display = "flex";
};

document.getElementById("startQuizBtn").onclick = () => {
  currentMode = "quiz";
  const currentPageData = getCurrentPageData();
  quizSourceData = currentPageData;
  quizMode = document.getElementById("quizModeSelector").value;
  if (kosakataData.length < 5) {
    alert("Data terlalu sedikit. Tampilkan setidaknya 5 entri.");
    return;
  }

  // Sembunyikan tampilan lain
  document.getElementById("quiz-popup").style.display = "none";
  document.getElementById("kanjiGrid").style.display = "none";
  document.getElementById("flashcard-section").style.display = "none";
  document.getElementById("upload-section").style.display = "none";
  document.getElementById("quiz-section").classList.add("fullscreen-section");

  const shuffled = [...currentPageData].sort(() => Math.random() - 0.5);

  quizSourceData = currentPageData; // Tambahkan ini global
  quizData = shuffled.map(item => getQuizQuestion(item, quizMode));
  currentQuizIndex = 0;
  quizScore = 0;
  quizAnswers = [];

  showQuizQuestion();
};

function closeQuizPopup() {
  document.getElementById("quiz-popup").style.display = "none";
}

settingToggle.onclick = toggleSettings;
overlay.onclick = toggleSettings;

function getQuizQuestion(data, mode) {
  const get = (item, field) => item[field] || item["kosakata"] || "-";
  const q = {};
  const fields = {
    "kosakata-kanji": ["kosakata", "kanji"],
    "kosakata-arti": ["kosakata", "arti"],
    "kanji-kosakata": ["kanji", "kosakata"],
    "kanji-arti": ["kanji", "arti"],
    "arti-kosakata": ["arti", "kosakata"],
    "arti-kanji": ["arti", "kanji"]
  };

  if (mode === "random") {
    const allModes = Object.keys(fields);
    mode = allModes[Math.floor(Math.random() * allModes.length)];
  }

  const [from, to] = fields[mode] || ["kosakata", "arti"];
  q.question = get(data, from);
  q.answer = get(data, to);
  q.mode = mode;
  return q;
}

function ensureQuizStyles() {
  if (document.getElementById("quiz-style")) return;
  const style = document.createElement("style");
  style.id = "quiz-style";
  style.textContent = `
    .quiz-option { border: 2px solid transparent; transition: border-color .2s ease; }
    .quiz-option.correct { border-color: #16a34a !important; }  /* hijau */
    .quiz-option.incorrect { border-color: #dc2626 !important; }/* merah */
    .quiz-option:disabled { opacity: .85; cursor: not-allowed; }
  `;
  document.head.appendChild(style);
}

function showQuizQuestion() {
  ensureQuizStyles();

  const container = document.getElementById("quiz-container");
  const q = quizData[currentQuizIndex];

  // Buat pilihan jawaban acak
  let options = [q.answer];
  while (options.length < 4) {
    const random = quizSourceData[Math.floor(Math.random() * quizSourceData.length)];
    const alt = getQuizQuestion(random, q.mode).answer;
    if (alt && !options.includes(alt)) options.push(alt);
  }
  options = options.sort(() => Math.random() - 0.5);

  // Render
  container.innerHTML = `
    <h3>Soal ${currentQuizIndex + 1} dari ${quizData.length}</h3>
    <p style="text-align:center;font-size:1.2rem;"><strong>${q.question}</strong></p>
    ${options.map(opt => `
      <button class="quiz-option" onclick="submitQuizAnswer('${opt.replace(/'/g, "\\'")}')">${opt}</button>
    `).join("")}
  `;
}

function submitQuizAnswer(selected) {
  const DELAY_MS = 1000; // jeda sebelum lanjut
  const container = document.getElementById("quiz-container");
  const current = quizData[currentQuizIndex];
  const correct = current.answer;

  const benar = selected === correct;
  if (benar) quizScore++;

  // Kunci semua tombol dan beri highlight
  const buttons = Array.from(container.querySelectorAll(".quiz-option"));
  let btnSelected = null, btnCorrect = null;

  buttons.forEach(btn => {
    btn.disabled = true;
    if (btn.textContent === selected) btnSelected = btn;
    if (btn.textContent === correct) btnCorrect = btn;
  });

  if (btnSelected) btnSelected.classList.add(benar ? "correct" : "incorrect");
  if (!benar && btnCorrect) btnCorrect.classList.add("correct");

  // Simpan jawaban
  quizAnswers.push({ question: current.question, selected, correct, benar });

  // Lanjut setelah jeda
  setTimeout(() => {
    currentQuizIndex++;
    if (currentQuizIndex < quizData.length) {
      showQuizQuestion();
    } else {
      showQuizResult();
    }
  }, DELAY_MS);
}

function exitQuizMode() {
  document.getElementById("quiz-section").classList.remove("fullscreen-section");
  document.getElementById("quiz-section").style.display = "none";
  document.getElementById("upload-section").style.display = "block";

  // Reset tampilan mode
  flashcardSection.style.display = "none";
  kanjiGrid.style.display = "none";

  if (currentMode === "flashcard") {
    flashcardSection.style.display = "block";
    showCard();
  } else {
    kanjiGrid.style.display = "grid";
    currentMode = "default"; // kembali ke mode normal
    applyFilter();
    updatePagination();
    renderGrid();
  }
}

function showQuizResult() {
  const container = document.getElementById("quiz-container");
  container.innerHTML = `
    <h2>Skor Akhir: ${quizScore} / ${quizData.length}</h2>
    <hr>
    ${quizAnswers.map((a, i) => `
      <div>
        <p><strong>Soal ${i + 1}:</strong> ${a.question}</p>
        <p>Jawabanmu: <span style="color:${a.benar ? 'green' : 'red'}">${a.selected}</span></p>
        ${!a.benar ? `<p>Jawaban benar: <strong>${a.correct}</strong></p>` : ""}
        <hr>
      </div>
    `).join("")}
    <button onclick="exitQuizMode()">Kembali</button>
  `;
}

function renderGrid() {
  kanjiGrid.innerHTML = "";

  // const isDataKosong = !kosakataData || kosakataData.length === 0;

  // if (counter.textContent !== "0 / 0") {
  //   kanjiGrid.style.display = "none";
  //   emptyMessage.classList.remove("hidden");
  //   pageInfo.textContent = "Halaman 1 / 1";
  //   return;
  // }

  // Jika ada data
  emptyMessage.classList.add("hidden");
  kanjiGrid.style.display = "grid";

  const limit = parseInt(limitInput.value) || 10;
  const start = pageIndex * limit;
  const end = Math.min(start + limit, kosakataData.length);
  displayData = kosakataData.slice(start, end);

  for (let data of displayData) {
    const div = document.createElement("div");
    div.className = "grid-item";
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

function getCurrentPageData() {
  const limit = parseInt(limitInput.value) || 10;
  const start = pageIndex * limit;
  const end = Math.min(start + limit, kosakataData.length);
  return kosakataData.slice(start, end);
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
  let frontHTML = "";

if (setting.kosakata && kosa !== "-") {
  frontHTML += `<div style="font-size: 1.8rem;">${kosa}</div>`;
}
if (setting.kanji && hira !== "-") {
  frontHTML += `<div style="margin-top: 0.5rem; font-size: 1.8rem;">${hira}</div>`;
}
if (setting.arti && arti !== "-") {
  frontHTML += `<div style="margin-top: 0.3rem; font-size: 1.3rem;">${arti}</div>`;
}
  if (!frontHTML) frontHTML = `<div style="opacity:.6">(tidak ada data untuk ditampilkan)</div>`;

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

let savedSettings = JSON.parse(localStorage.getItem("kosakataSettings")) || {
  kosakata: {
    kosakata: true,   // default aktif
    kanji: false,
    arti: false,
    showRandomizeFrontBtn: true // <- NEW
  }
};

function saveSettings() {
  localStorage.setItem("kosakataSettings", JSON.stringify(savedSettings));
}

// migrasi jika storage lama belum punya flag baru
if (!savedSettings.kosakata) savedSettings.kosakata = { kosakata: true, kanji: false, arti: false };
if (savedSettings.kosakata.showRandomizeFrontBtn === undefined) {
  savedSettings.kosakata.showRandomizeFrontBtn = true;
  saveSettings();
}


function toggleSettings() {
  const isVisible = popupSettings.style.display === "block";
  if (!isVisible) renderSettingsPopup(); // ✅ UBAH INI
  popupSettings.style.display = overlay.style.display = isVisible ? "none" : "block";
}

function acakTampilanDepan() {
  // pastikan ada data tampil
  if (!filteredIndexes || filteredIndexes.length === 0) return;

  // 1) Acak kartu (hindari index yang sama berurutan jika memungkinkan)
  let newPos;
  if (filteredIndexes.length === 1) {
    newPos = 0;
  } else {
    do {
      newPos = Math.floor(Math.random() * filteredIndexes.length);
    } while (newPos === currentIndex);
  }
  currentIndex = newPos;

  const dataIndex = filteredIndexes[currentIndex];
  const data = kosakataData[dataIndex] || {};

  // normalisasi field
  const kosa = (data.kosakata || data.Kosakata || "").trim();
  const kanji = (data.kanji || data.Kanji || "").trim();
  const arti  = (data.arti  || data.Arti  || "").trim();

  // 2) Tentukan kandidat field yang TIDAK kosong
  const candidates = [];
  if (kosa)  candidates.push("kosakata");
  if (kanji) candidates.push("kanji");
  if (arti)  candidates.push("arti");

  // kalau semua kosong, fallback: tampilkan kosakata saja biar gak blank
  if (candidates.length === 0) {
    savedSettings.kosakata.kosakata = true;
    savedSettings.kosakata.kanji = false;
    savedSettings.kosakata.arti = false;
    saveSettings();
    if (typeof syncSettingsPopupCheckboxes === "function") syncSettingsPopupCheckboxes();
    showCard();
    return;
  }

  // 3) Pilih SATU field acak, usahakan tidak sama dengan field sebelumnya
  let choice;
  if (candidates.length === 1) {
    choice = candidates[0];
  } else {
    const pool = lastRandomField ? candidates.filter(c => c !== lastRandomField) : candidates.slice();
    choice = pool[Math.floor(Math.random() * pool.length)];
  }
  lastRandomField = choice;

  // 4) Terapkan setting depan: hanya 1 field yang true
  savedSettings.kosakata.kosakata = (choice === "kosakata");
  savedSettings.kosakata.kanji    = (choice === "kanji");
  savedSettings.kosakata.arti     = (choice === "arti");
  saveSettings();

  // sinkronkan popup bila sedang terbuka
  if (typeof syncSettingsPopupCheckboxes === "function") syncSettingsPopupCheckboxes();

  // render ulang kartu
  showCard();
}

// Sinkronkan checkbox di popup jika popup sedang terbuka
function syncSettingsPopupCheckboxes() {
  const popup = document.getElementById("popupSettings");
  if (!popup || popup.style.display !== "block") return;

  const chkKosa  = document.getElementById("showFrontKosakata");
  const chkKanji = document.getElementById("showFrontKanji");
  const chkArti  = document.getElementById("showFrontArti");
  const chkRnd   = document.getElementById("showRandomizeFrontBtn");

  if (chkKosa) chkKosa.checked = !!savedSettings.kosakata.kosakata;
  if (chkKanji) chkKanji.checked = !!savedSettings.kosakata.kanji;
  if (chkArti) chkArti.checked = !!savedSettings.kosakata.arti;
  if (chkRnd)  chkRnd.checked  = !!savedSettings.kosakata.showRandomizeFrontBtn;
}


function applyRandomizeFrontBtnVisibility() {
  const btn = document.getElementById("randomizeFrontBtn");
  if (!btn) return;
  btn.style.display = savedSettings.kosakata.showRandomizeFrontBtn ? "inline-block" : "none";
}

document.getElementById("randomizeFrontBtn").addEventListener("click", acakTampilanDepan);
applyRandomizeFrontBtnVisibility(); // <- panggil di inisialisasi


function renderSettingsPopup() {
  const popup = document.getElementById("popupSettings");
  popup.innerHTML = `
    <h3>Pengaturan Tampilan (Depan)</h3>
    <label><input type="checkbox" id="showFrontKosakata"> Tampilan kosakata (depan)</label><br>
    <label><input type="checkbox" id="showFrontKanji"> Tampilan kanji (depan)</label><br>
    <label><input type="checkbox" id="showFrontArti"> Tampilan arti (depan)</label><br>
    <hr style="margin:10px 0;">
    <label><input type="checkbox" id="showRandomizeFrontBtn"> Tampilkan tombol "Acak Tampilan"</label><br>
    <br>
    <button id="popupCloseBtn">Tutup</button>
  `;

  // set nilai awal dari savedSettings (DEFAULT: kosakata=true, tombol acak tampilan=true)
  document.getElementById("showFrontKosakata").checked        = !!savedSettings.kosakata.kosakata;
  document.getElementById("showFrontKanji").checked           = !!savedSettings.kosakata.kanji;
  document.getElementById("showFrontArti").checked            = !!savedSettings.kosakata.arti;
  document.getElementById("showRandomizeFrontBtn").checked    = !!savedSettings.kosakata.showRandomizeFrontBtn;

  // listener perubahan
  document.getElementById("showFrontKosakata").addEventListener("change", (e) => {
    savedSettings.kosakata.kosakata = e.target.checked;
    saveSettings();
    showCard();
  });
  document.getElementById("showFrontKanji").addEventListener("change", (e) => {
    savedSettings.kosakata.kanji = e.target.checked;
    saveSettings();
    showCard();
  });
  document.getElementById("showFrontArti").addEventListener("change", (e) => {
    savedSettings.kosakata.arti = e.target.checked;
    saveSettings();
    showCard();
  });
  document.getElementById("showRandomizeFrontBtn").addEventListener("change", (e) => {
    savedSettings.kosakata.showRandomizeFrontBtn = e.target.checked;
    saveSettings();
    applyRandomizeFrontBtnVisibility(); // tampil/sembunyikan tombol
  });

  // tombol tutup popup
  document.getElementById("popupCloseBtn").addEventListener("click", toggleSettings);
}

// tambah listener untuk tombol acak tampilan:
document.getElementById("showRandomizeFrontBtn").addEventListener("change", (e) => {
  savedSettings.kosakata.showRandomizeFrontBtn = e.target.checked;
  saveSettings();
  applyRandomizeFrontBtnVisibility();
});

// tombol tutup popup
document.getElementById("popupCloseBtn").addEventListener("click", toggleSettings);

document.addEventListener("click", function (e) {
  if (e.target && e.target.id === "popupCloseBtn") {
    toggleSettings();
  }
});

function renderCard() {
  if (filteredData.length === 0) return;

  const item = filteredData[currentCardIndex];

  // Depan
  const frontItems = [];
  if (showFrontKosakata) frontItems.push(item.kosakata);
  if (showFrontKanji) frontItems.push(item.kanji);
  if (showFrontArti) frontItems.push(item.arti);
  cardFront.textContent = frontItems.join("\n");

  // Belakang tetap tampil semua
  cardBack.innerHTML = `
    <div><strong>Kosakata:</strong> ${item.kosakata}</div>
    <div><strong>Kanji:</strong> ${item.kanji}</div>
    <div><strong>Arti:</strong> ${item.arti}</div>
  `;

  updateCounter();
  updateHafalanStatus();
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
