const API_KEY = "AIzaSyAHX99hr1pn46Iar5oW3hzsK_2I7pKgUMA";
const MASTER_LIST_ID = "1TdRFPDT_j_9i7h2IptHqkvlsD-r5DwOh3xh--0mAlDA";

const fileSelector = document.getElementById("fileSelector");
const sheetSelector = document.getElementById("sheetSelector");

let currentSheet = "", currentFileId = "";

let autoMode = false;
let autoTime = 5;
let autoTimer = null;

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

let kanjiQuizData = [];
let currentKanjiQuizIndex = 0;
let kanjiQuizScore = 0;
let kanjiQuizAnswers = [];
let kanjiQuizMode = "type1";

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

// Ambil daftar file dari daftar_file, filter jenis=kanji
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
      if (row[jenisIndex] !== "kanji") return;
      const fileId = row[fileIdIndex];
      const label = row[labelIndex];
      const opt = document.createElement("option");
      opt.value = fileId;
      opt.textContent = label;
      fileSelector.appendChild(opt);
    });
  });

fileSelector.addEventListener("change", () => {
  const fileId = fileSelector.value;
  currentFileId = fileId;
  if (!fileId) return;

  fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}?fields=sheets.properties&key=${API_KEY}`)
    .then(res => res.json())
    .then(data => {
      if (Array.isArray(data.sheets)) {
        sheetSelector.innerHTML = `<option value="">-- Pilih Sheet --</option>`;
        data.sheets.forEach(s => {
          const opt = document.createElement("option");
          opt.value = s.properties.title;
          opt.textContent = s.properties.title;
          sheetSelector.appendChild(opt);
        });
      }
    });
});

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
        kanjiData = [];
        renderGrid();
        return;
      }

      const headers = values[0];
      kanjiData = values.slice(1).map(row => {
        const obj = {};
        headers.forEach((h, i) => obj[h.trim()] = row[i] || "");
        return obj;
      });

      const saved = localStorage.getItem(currentFileKey);
      hafalStatusMap = saved ? JSON.parse(saved) : {};
      pageIndex = 0;
      totalCount.textContent = kanjiData.length;
      renderGrid();
    });
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
  const onyomi = data["onyomi"] || data.on || "-";
  const kunyomi = data["kunyomi"] || data.kun || "-";
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
  if (setting.onyomi) backHTML += `<div class="center-info">on: ${onyomi}</div>`;
  if (setting.kunyomi) backHTML += `<div class="center-info">kun: ${kunyomi}</div>`;
  if (setting.makna) backHTML += `<div class="center-info"> ${makna}</div>`;
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
    <label><input type="checkbox" class="setting-check" value="onyomi" ${current.onyomi ? "checked" : ""}> Tampilkan onyomi</label>
    <label><input type="checkbox" class="setting-check" value="kunyomi" ${current.kunyomi ? "checked" : ""}> Tampilkan kunyomi</label>
    <label><input type="checkbox" class="setting-check" value="makna" ${current.makna ? "checked" : ""}> Tampilkan Makna</label>
    <label><input type="checkbox" class="setting-check" value="catatan" ${current.catatan ? "checked" : ""}> Tampilkan Catatan</label>
    <label><input type="checkbox" class="setting-check" value="kosakata" ${current.kosakata ? "checked" : ""}> Tampilkan Contoh Kosakata</label>

    <hr style="margin: 1rem 0;">
    <div><strong>Tampilan Depan:</strong></div>
    <label><input type="checkbox" class="setting-front" value="onyomi" ${currentFront.onyomi ? "checked" : ""}> onyomi</label>
    <label><input type="checkbox" class="setting-front" value="kunyomi" ${currentFront.kunyomi ? "checked" : ""}> kunyomi</label>
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

document.getElementById("autoToggleBtn").onclick = () => {
  autoMode = !autoMode;
  document.getElementById("autoToggleBtn").textContent = autoMode ? "Nonaktifkan Auto Mode" : "Aktifkan Auto Mode";
  if (autoMode) startAutoFlip(); else stopAutoFlip();
};

document.getElementById("autoTimeInput").addEventListener("input", e => {
  autoTime = parseInt(e.target.value) || 5;
  if (autoMode) {
    stopAutoFlip();
    startAutoFlip();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  document.getElementById("kanjiQuizBtn").onclick = () => {
    const limit = parseInt(limitInput.value) || 10;
    const start = pageIndex * limit;
    const end = Math.min(start + limit, kanjiData.length);
    const visibleData = kanjiData.slice(start, end);

    if (visibleData.length < 5) {
      alert("Minimal 5 data untuk memulai kuis.");
      return;
    }

    document.getElementById("kanji-quiz-popup").style.display = "flex";
  };
});

function closeKanjiQuizPopup() {
  document.getElementById("kanji-quiz-popup").style.display = "none";
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

function startKanjiQuiz(mode) {
  console.log("⏯ Mulai kuis mode:", mode);
  closeKanjiQuizPopup();

  const validData = displayData.filter(d => {
    if (mode === "type1") return d.kanji && d.makna;
    if (mode === "type2") return d.kanji && d.makna;
    return true;
  });

  if (validData.length < 5) {
    alert("Minimal 5 data untuk kuis.");
    return;
  }

  const shuffled = [...validData].sort(() => Math.random() - 0.5);
  kanjiQuizData = shuffled.map(d => generateKanjiQuestion(d, mode)).filter(Boolean);
  kanjiQuizAnswers = [];
  currentKanjiQuizIndex = 0;
  kanjiQuizScore = 0;

  console.log("📊 Jumlah soal:", kanjiQuizData.length);
  console.log("🧪 Soal pertama:", kanjiQuizData[0]);

  document.getElementById("kanjiQuizSection").style.display = "block";
  document.getElementById("upload-section").style.display = "none";
  document.getElementById("flashcard-section").style.display = "none";

  showKanjiQuestion();
}

function generateKanjiQuestion(data, mode) {
  if (mode === "type1") {
    return {
      question: `${data.kanji || "-"}<br><small>【${data.onyomi || "-"} / ${data.kunyomi || "-"}</small>】`,
      correct: data.makna || "-",
      options: generateKanjiOptions("makna", data.makna),
    };
  } else if (mode === "type2") {
    return {
      question: data.makna || "-",
      correct: data.kanji || "-",
      options: generateKanjiOptions("kanji", data.kanji),
    };
  } else if (mode === "random") {
    return Math.random() > 0.5
      ? generateKanjiQuestion(data, "type1")
      : generateKanjiQuestion(data, "type2");
  }
  return null;
}

function generateKanjiOptions(field, correctAnswer) {
  const values = displayData
    .map(d => d[field])
    .filter(v => v && v.trim() !== "" && v !== correctAnswer);

  const randomOptions = [...new Set(values)].sort(() => Math.random() - 0.5).slice(0, 3);
  const allOptions = [...randomOptions, correctAnswer].sort(() => Math.random() - 0.5);
  return allOptions;
}

function selectKanjiAnswer(selected) {
  const soal = kanjiQuizData[currentKanjiQuizIndex];
  const benar = selected === soal.correct;

  if (benar) kanjiQuizScore++;

  kanjiQuizAnswers.push({
    soal: soal.question,
    selected,
    correct: soal.correct,
    benar
  });

  currentKanjiQuizIndex++;
  if (currentKanjiQuizIndex < kanjiQuizData.length) {
    showKanjiQuestion();
  } else {
    showKanjiResult();
  }
}


function showKanjiQuestion() {
  const soal = kanjiQuizData[currentKanjiQuizIndex];
  if (!soal) {
    console.warn("❗ Tidak ada soal untuk ditampilkan.");
    return;
  }

  console.log("📝 Tampilkan soal:", soal);

  document.getElementById("kanjiQuizResult").style.display = "none";
  document.getElementById("kanjiQuizQuestion").style.display = "block";
  document.getElementById("kanjiQuizOptions").style.display = "block";

  document.getElementById("kanjiQuizQuestion").innerHTML = soal.question;

  const optionBox = document.getElementById("kanjiQuizOptions");
  optionBox.innerHTML = "";

  soal.options.forEach(option => {
    const btn = document.createElement("button");
    btn.textContent = option;
    btn.className = "quiz-option";
    btn.onclick = () => selectKanjiAnswer(option);
    optionBox.appendChild(btn);
  });
}

function submitKanjiAnswer(selected) {
  const soal = kanjiQuizData[currentKanjiQuizIndex];
  const benar = selected === soal.answer;

  if (benar) kanjiQuizScore++;

  kanjiQuizAnswers.push({
    soal: soal.question,
    selected,
    correct: soal.answer,
    benar
  });

  currentKanjiQuizIndex++;
  if (currentKanjiQuizIndex < kanjiQuizData.length) {
    showKanjiQuestion();
  } else {
    showKanjiResult();
  }
}
function showKanjiResult() {
  const questionEl = document.getElementById("kanjiQuizQuestion");
  const optionsEl = document.getElementById("kanjiQuizOptions");
  const resultEl = document.getElementById("kanjiQuizResult");

  questionEl.style.display = "none";
  optionsEl.style.display = "none";
  resultEl.style.display = "block";

  const score = kanjiQuizScore;
  const total = kanjiQuizData.length;

  let html = `<h3>Skor Akhir: ${score} / ${total}</h3><br>`;

  kanjiQuizAnswers.forEach((entry, i) => {
    const { soal, selected, correct, benar } = entry;

    html += `<div><strong>Soal ${i + 1}:</strong><br>`;
    html += `${soal}<br>`;
    if (benar) {
      html += `<span style="color:green;">Jawabanmu: ${selected}</span>`;
    } else {
      html += `<span style="color:red;">Jawabanmu: ${selected || '(kosong)'}</span><br>`;
      html += `<span style="color:green;">Jawaban Benar: ${correct}</span>`;
    }
    html += `<hr></div>`;
  });

  resultEl.innerHTML = html;
}


function endKanjiQuiz() {
  showKanjiResult();
}

function exitKanjiQuiz() {
  document.getElementById("kanjiQuizSection").style.display = "none";
  document.getElementById("upload-section").style.display = "block";
  renderGrid();
}

document.getElementById("settingToggle").onclick = toggleSettings;
document.getElementById("overlay").onclick = toggleSettings;
