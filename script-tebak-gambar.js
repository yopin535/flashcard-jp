// ===== KONFIGURASI =====
const apiKey = "AIzaSyAHX99hr1pn46Iar5oW3hzsK_2I7pKgUMA";
const daftarFileSheetId = "1TdRFPDT_j_9i7h2IptHqkvlsD-r5DwOh3xh--0mAlDA";

// ===== STATE =====
let allData = [];
let imageData = [];
let lastIndex = -1;

let quizData = [];
let currentIndex = 0;
let score = 0;
let answered = false;

// ===== ELEMENT =====
const fileSelector = document.getElementById("fileSelector");
const sheetSelector = document.getElementById("sheetSelector");
const limitInput = document.getElementById("limitInput");
const loadButton = document.getElementById("loadButton");

const contentArea = document.getElementById("contentArea");
const quizImage = document.getElementById("quizImage");
const infoKosakata = document.getElementById("infoKosakata");
const infoKanji = document.getElementById("infoKanji");
const infoArti = document.getElementById("infoArti");
const nextBtn = document.getElementById("nextBtn");
const statusText = document.getElementById("statusText");

const startQuizBtn = document.getElementById("startQuizBtn");

const progressText = document.getElementById("progressText");

const totalDataInfo = document.getElementById("totalDataInfo");

// ===== LOAD DAFTAR FILE =====
fetch(`https://sheets.googleapis.com/v4/spreadsheets/${daftarFileSheetId}/values/daftar_file?key=${apiKey}`)
  .then(res => res.json())
  .then(data => {
    const rows = data.values.slice(1); // lewati header

    rows.forEach(row => {
      const fileId = row[0]; // kolom A
      const label = row[1]; // kolom B
      const jenis = row[2]; // kolom C

      if (jenis !== "kosakata") return;

      const opt = document.createElement("option");
      opt.value = fileId;
      opt.textContent = label;
      fileSelector.appendChild(opt);
    });
  })
  .catch(err => {
    console.error(err);
    alert("Gagal memuat daftar file");
  });

// ===== LOAD SHEET LIST =====
fileSelector.addEventListener("change", () => {
  const fileId = fileSelector.value;
  sheetSelector.innerHTML = "";

  if (!fileId) return;

  fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}?key=${apiKey}`)
    .then(res => res.json())
    .then(data => {
      if (!data.sheets) {
        alert("Gagal mengambil daftar sheet");
        return;
      }

      data.sheets.forEach(sheet => {
        const opt = document.createElement("option");
        opt.value = sheet.properties.title;
        opt.textContent = sheet.properties.title;
        sheetSelector.appendChild(opt);
        totalDataInfo.textContent = "";
      });
    })
    .catch(err => {
      console.error(err);
      alert("Error saat mengambil sheet");
    });
});

console.log("FILE ID:", fileSelector.value);

// ===== LOAD DATA =====
loadButton.addEventListener("click", () => {
  const fileId = fileSelector.value;
  const sheetName = sheetSelector.value;
  const limit = parseInt(limitInput.value) || 50;

  if (!fileId || !sheetName) {
    alert("Pilih file dan sheet terlebih dahulu");
    return;
  }

  statusText.textContent = "";   // ⬅️ kosongkan

  startQuizBtn.style.display = "none";

  fetch(`https://sheets.googleapis.com/v4/spreadsheets/${fileId}/values/${sheetName}?key=${apiKey}`)
    .then(res => res.json())
    .then(result => {
      const values = result.values;

      const totalData = values.length - 1; // minus header
      totalDataInfo.textContent = `Total data: ${totalData}`;

      if (!values || values.length < 2) {
        alert("Data tidak ditemukan");
        return;
      }

      const headers = values[0].map(h => h.toLowerCase().trim());
      const rows = values.slice(1);

      const parsedData = rows.map(row => {
        const obj = {};
        headers.forEach((h, i) => {
          obj[h] = row[i] || "";
        });

        return {
          kosakata: obj["kosakata"] || "",
          kanji: obj["kanji"] || "",
          arti: obj["arti"] || "",
          gambar: obj["gambar"] || ""
        };
      }).filter(d => d.gambar); // hanya yang ada gambar

      // 🔀 ACAK URUTAN DI SINI
      const shuffled = shuffleArray([...parsedData]);

      // 🎯 BARU BATASI LIMIT
      quizData = shuffled.slice(0, limit);

      if (quizData.length === 0) {
        alert("Tidak ada data bergambar");
        return;
      }

      currentIndex = 0;
      score = 0;

      statusText.textContent = `Memuat ${quizData.length} data bergambar`;
      startQuizBtn.style.display = "inline-block";
      quizSection.style.display = "none";
    })
    .catch(err => {
      console.error(err);
      alert("Gagal memuat data");
    });
});

// ===== RANDOM TANPA BERUNTUN =====
function getRandomIndex(max) {
  let idx;
  do {
    idx = Math.floor(Math.random() * max);
  } while (idx === lastIndex && max > 1);
  lastIndex = idx;
  return idx;
}

startQuizBtn.addEventListener("click", () => {
  if (quizData.length === 0) {
    alert("Data belum dimuat");
    return;
  }

  currentIndex = 0;
  score = 0;

  statusText.textContent = ""

  progressText.textContent = `Soal 1 / ${quizData.length}`;

  startQuizBtn.style.display = "none";
  quizSection.style.display = "block";

  generateQuestion();
});

function getQuizType() {
  return document.querySelector('input[name="quizType"]:checked')?.value || "arti";
}

function generateQuestion() {
  if (currentIndex >= quizData.length) {
    showResult();
    return;
  }

  progressText.textContent = `Soal ${currentIndex + 1} / ${quizData.length}`;

  answered = false;
  document.getElementById("nextQuestionBtn").disabled = true;

  const q = quizData[currentIndex];
  const quizType = getQuizType();

  const skeleton = document.getElementById("imageSkeleton");

  quizImage.style.display = "none";
  skeleton.style.display = "block";

  quizImage.onload = () => {
    skeleton.style.display = "none";
    quizImage.style.display = "block";
  };

  quizImage.src = q.gambar;

  let questionLabel = "";
  let correctAnswer = "";
  let answerKey = "";

  if (quizType === "kosakata") {
    questionLabel = "Apa kosakata dari gambar ini?";
    correctAnswer = q.kosakata;
    answerKey = "kosakata";
  } 
  else if (quizType === "kanji") {
    questionLabel = "Apa kanji dari gambar ini?";
    correctAnswer = q.kanji;
    answerKey = "kanji";
  } 
  else {
    questionLabel = "Apa arti dari gambar ini?";
    correctAnswer = q.arti;
    answerKey = "arti";
  }

  questionText.textContent = questionLabel;

  const wrongAnswers = quizData
    .filter(d => d[answerKey] && d[answerKey] !== correctAnswer)
    .sort(() => Math.random() - 0.5)
    .slice(0, 3)
    .map(d => d[answerKey]);

  const options = [correctAnswer, ...wrongAnswers]
    .sort(() => Math.random() - 0.5);

  const choicesEl = document.getElementById("choices");
  choicesEl.innerHTML = "";

  options.forEach(opt => {
    const btn = document.createElement("button");
    btn.className = "quiz-option";
    btn.textContent = opt;
    btn.onclick = () => checkAnswer(btn, opt, correctAnswer);
    choicesEl.appendChild(btn);
  });
}

function shuffleArray(arr) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [arr[i], arr[j]] = [arr[j], arr[i]];
  }
  return arr;
}

function checkAnswer(button, selected, correct) {
  if (answered) return;
  answered = true;

  const buttons = document.querySelectorAll("#choices button");

  buttons.forEach(btn => {
    btn.disabled = true;

    if (btn.textContent === correct) {
      btn.classList.add("correct");
    }
  });

  if (selected === correct) {
    button.classList.add("correct");
    score++;
  } else {
    button.classList.add("wrong");
  }

  document.getElementById("nextQuestionBtn").disabled = false;
}

document.getElementById("nextQuestionBtn").addEventListener("click", () => {
  currentIndex++;
  generateQuestion();
});

function showResult() {
  progressText.textContent = "Quiz Selesai";

  quizSection.innerHTML = `
    <h3>Quiz Selesai 🎉</h3>
    <p>Skor kamu: <b>${score}</b> / ${quizData.length}</p>
    <button onclick="location.reload()">Ulangi</button>
  `;
}

const fullscreenBtn = document.getElementById("fullscreenBtn");

fullscreenBtn.addEventListener("click", () => {
  const el = document.documentElement;

  if (!document.fullscreenElement) {
    el.requestFullscreen();
    fullscreenBtn.textContent = "Keluar Layar Penuh";
  } else {
    document.exitFullscreen();
    fullscreenBtn.textContent = "Layar Penuh";
  }
});

