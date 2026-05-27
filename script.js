const STEMS = ["甲", "乙", "丙", "丁", "戊", "己", "庚", "辛", "壬", "癸"];
const BRANCHES = ["子", "丑", "寅", "卯", "辰", "巳", "午", "未", "申", "酉", "戌", "亥"];
const STEM_ELEMENTS = ["wood", "wood", "fire", "fire", "earth", "earth", "metal", "metal", "water", "water"];
const BRANCH_ELEMENTS = ["water", "earth", "wood", "wood", "earth", "fire", "fire", "earth", "metal", "metal", "earth", "water"];
const ELEMENT_LABELS = {
  wood: "木",
  fire: "火",
  earth: "土",
  metal: "金",
  water: "水",
};
const TERM_NAMES = [
  "小寒",
  "大寒",
  "立春",
  "雨水",
  "惊蛰",
  "春分",
  "清明",
  "谷雨",
  "立夏",
  "小满",
  "芒种",
  "夏至",
  "小暑",
  "大暑",
  "立秋",
  "处暑",
  "白露",
  "秋分",
  "寒露",
  "霜降",
  "立冬",
  "小雪",
  "大雪",
  "冬至",
];
const TERM_INFO = [
  0, 21208, 42467, 63836, 85337, 107014, 128867, 150921, 173149, 195551,
  218072, 240693, 263343, 285989, 308563, 331033, 353350, 375494, 397447,
  419210, 440795, 462224, 483532, 504758,
];
const DAY_MS = 24 * 60 * 60 * 1000;
const DEG_TO_RAD = Math.PI / 180;
const MONTH_BRANCH_BY_TERM = new Map([
  [2, 2],
  [4, 3],
  [6, 4],
  [8, 5],
  [10, 6],
  [12, 7],
  [14, 8],
  [16, 9],
  [18, 10],
  [20, 11],
  [22, 0],
  [0, 1],
]);
const elements = {
  sentence: document.querySelector("#sentence"),
  solarTerm: document.querySelector("#solar-term"),
  nextTerm: document.querySelector("#next-term"),
  timezone: document.querySelector("#timezone"),
  themeToggle: document.querySelector("#theme-toggle"),
  picker: document.querySelector("#gregorian-picker"),
  dateControls: document.querySelector(".date-controls"),
  nowButton: document.querySelector("#now-button"),
};

let selectedDate = null;
let isPickerEditing = false;
let pickerValueBeforeEdit = "";
let hasPickerChanged = false;

function ganzhiFragment(stemIndex, branchIndex, suffix = "") {
  const fragment = document.createDocumentFragment();
  const stem = document.createElement("span");
  const branch = document.createElement("span");
  const normalizedStem = wrap(stemIndex, 10);
  const normalizedBranch = wrap(branchIndex, 12);

  stem.textContent = STEMS[normalizedStem];
  stem.className = `ganzhi-char element-${STEM_ELEMENTS[normalizedStem]}`;
  stem.title = `${STEMS[normalizedStem]}属${ELEMENT_LABELS[STEM_ELEMENTS[normalizedStem]]}`;

  branch.textContent = BRANCHES[normalizedBranch];
  branch.className = `ganzhi-char element-${BRANCH_ELEMENTS[normalizedBranch]}`;
  branch.title = `${BRANCHES[normalizedBranch]}属${ELEMENT_LABELS[BRANCH_ELEMENTS[normalizedBranch]]}`;

  fragment.append(stem, branch);
  if (suffix) {
    fragment.append(document.createTextNode(suffix));
  }
  return fragment;
}

function renderSentence(pillars) {
  elements.sentence.replaceChildren(
    sentenceUnit(pillars.year.stemIndex, pillars.year.branchIndex, "年"),
    sentenceUnit(pillars.month.stemIndex, pillars.month.branchIndex, "月"),
    sentenceUnit(pillars.day.stemIndex, pillars.day.branchIndex, "日"),
    sentenceUnit(pillars.hour.stemIndex, pillars.hour.branchIndex, "时"),
  );
}

function fitSentence() {
  const readout = elements.sentence.closest(".readout");
  const stage = elements.sentence.closest(".word-stage");
  const compact = window.innerWidth < 680 || window.innerHeight < 560;
  const verySmall = window.innerWidth < 390 || window.innerHeight < 470;
  const baseSize = compact ? (verySmall ? 26 : 32) : 56;
  const sidePadding = compact ? 10 : 16;
  const availableWidth = Math.max(120, readout.clientWidth - sidePadding * 2);
  const controlsHeight = elements.dateControls?.offsetHeight || 0;
  const availableHeight = Math.max(
    compact ? 118 : 42,
    stage.clientHeight - elements.solarTerm.offsetHeight - controlsHeight - (compact ? 24 : 80),
  );

  elements.sentence.style.setProperty("--sentence-size", `${baseSize}px`);
  const widthScale = availableWidth / elements.sentence.scrollWidth;
  const heightScale = availableHeight / elements.sentence.offsetHeight;
  const scale = Math.min(1, widthScale, heightScale);
  const fittedSize = Math.max(22, Math.floor(baseSize * scale));

  elements.sentence.style.setProperty("--sentence-size", `${fittedSize}px`);
  syncDateControlsWidth();
}

function syncDateControlsWidth() {
  if (!elements.dateControls) {
    return;
  }

  const units = [...elements.sentence.querySelectorAll(".sentence-unit")];
  const unitRects = units.map((unit) => unit.getBoundingClientRect());
  const sentenceWidth =
    unitRects.length > 0
      ? Math.ceil(Math.max(...unitRects.map((rect) => rect.right)) - Math.min(...unitRects.map((rect) => rect.left)))
      : Math.ceil(elements.sentence.getBoundingClientRect().width);
  elements.dateControls.style.setProperty("--controls-width", `${sentenceWidth}px`);
}

function sentenceUnit(stemIndex, branchIndex, suffix) {
  const unit = document.createElement("span");
  const suffixElement = document.createElement("span");

  unit.className = "sentence-unit";
  suffixElement.className = "sentence-suffix";
  suffixElement.textContent = suffix;
  unit.append(suffixElement, ganzhiFragment(stemIndex, branchIndex));
  return unit;
}

function wrap(value, size) {
  return ((value % size) + size) % size;
}

function normalizeDegrees(value) {
  return ((value % 360) + 360) % 360;
}

function angleDifference(value, target) {
  return ((normalizeDegrees(value) - normalizeDegrees(target) + 540) % 360) - 180;
}

function deltaTSeconds(date) {
  const year = date.getUTCFullYear() + (date.getUTCMonth() + 0.5) / 12;
  let offset;

  if (year >= 2005 && year < 2050) {
    offset = year - 2000;
    return 62.92 + 0.32217 * offset + 0.005589 * offset * offset;
  }

  if (year >= 1986 && year < 2005) {
    offset = year - 2000;
    return (
      63.86 +
      0.3345 * offset -
      0.060374 * offset * offset +
      0.0017275 * offset * offset * offset +
      0.000651814 * offset * offset * offset * offset +
      0.00002373599 * offset * offset * offset * offset * offset
    );
  }

  if (year >= 1961 && year < 1986) {
    offset = year - 1975;
    return 45.45 + 1.067 * offset - (offset * offset) / 260 - (offset * offset * offset) / 718;
  }

  if (year >= 1941 && year < 1961) {
    offset = year - 1950;
    return 29.07 + 0.407 * offset - (offset * offset) / 233 + (offset * offset * offset) / 2547;
  }

  if (year >= 1920 && year < 1941) {
    offset = year - 1920;
    return 21.2 + 0.84493 * offset - 0.0761 * offset * offset + 0.0020936 * offset * offset * offset;
  }

  if (year >= 1900 && year < 1920) {
    offset = year - 1900;
    return (
      -2.79 +
      1.494119 * offset -
      0.0598939 * offset * offset +
      0.0061966 * offset * offset * offset -
      0.000197 * offset * offset * offset * offset
    );
  }

  if (year >= 2050 && year < 2150) {
    offset = (year - 1820) / 100;
    return -20 + 32 * offset * offset - 0.5628 * (2150 - year);
  }

  return 62.92;
}

function solarLongitude(date) {
  const julianDayUtc = date.getTime() / DAY_MS + 2440587.5;
  const julianDayTt = julianDayUtc + deltaTSeconds(date) / 86400;
  const centuries = (julianDayTt - 2451545) / 36525;
  const meanLongitude = normalizeDegrees(
    280.46646 + 36000.76983 * centuries + 0.0003032 * centuries * centuries,
  );
  const meanAnomaly = normalizeDegrees(
    357.52911 +
      35999.05029 * centuries -
      0.0001537 * centuries * centuries +
      0.00000048 * centuries * centuries * centuries,
  );
  const anomalyRadians = meanAnomaly * DEG_TO_RAD;
  const equationOfCenter =
    (1.914602 - 0.004817 * centuries - 0.000014 * centuries * centuries) * Math.sin(anomalyRadians) +
    (0.019993 - 0.000101 * centuries) * Math.sin(2 * anomalyRadians) +
    0.000289 * Math.sin(3 * anomalyRadians);
  const trueLongitude = meanLongitude + equationOfCenter;
  const omega = (125.04 - 1934.136 * centuries) * DEG_TO_RAD;

  return normalizeDegrees(trueLongitude - 0.00569 - 0.00478 * Math.sin(omega));
}

function termTargetLongitude(termIndex) {
  return normalizeDegrees(285 + termIndex * 15);
}

function roughTermDate(year, termIndex) {
  const base = Date.UTC(1900, 0, 6, 2, 5);
  const ms = base + 31556925974.7 * (year - 1900) + TERM_INFO[termIndex] * 60000;
  return new Date(ms);
}

function termDate(year, termIndex) {
  const center = roughTermDate(year, termIndex).getTime();
  const targetLongitude = termTargetLongitude(termIndex);
  let start = center - 3 * DAY_MS;
  let end = center + 3 * DAY_MS;
  let startDiff = angleDifference(solarLongitude(new Date(start)), targetLongitude);
  let endDiff = angleDifference(solarLongitude(new Date(end)), targetLongitude);
  let attempts = 0;

  while (startDiff > 0 && attempts < 10) {
    end = start;
    start -= DAY_MS;
    startDiff = angleDifference(solarLongitude(new Date(start)), targetLongitude);
    attempts += 1;
  }

  attempts = 0;
  while (endDiff < 0 && attempts < 10) {
    start = end;
    end += DAY_MS;
    endDiff = angleDifference(solarLongitude(new Date(end)), targetLongitude);
    attempts += 1;
  }

  if (startDiff > 0 || endDiff < 0) {
    return new Date(center);
  }

  for (let index = 0; index < 48; index += 1) {
    const midpoint = (start + end) / 2;
    const diff = angleDifference(solarLongitude(new Date(midpoint)), targetLongitude);

    if (diff < 0) {
      start = midpoint;
    } else {
      end = midpoint;
    }
  }

  return new Date((start + end) / 2);
}

function significantTermsAround(year) {
  const terms = [];
  for (const candidateYear of [year - 1, year, year + 1]) {
    for (const termIndex of MONTH_BRANCH_BY_TERM.keys()) {
      terms.push({
        date: termDate(candidateYear, termIndex),
        index: termIndex,
        name: TERM_NAMES[termIndex],
        branchIndex: MONTH_BRANCH_BY_TERM.get(termIndex),
      });
    }
  }
  return terms.sort((a, b) => a.date - b.date);
}

function allTermsAround(year) {
  const terms = [];
  for (const candidateYear of [year - 1, year, year + 1]) {
    for (let index = 0; index < TERM_NAMES.length; index += 1) {
      terms.push({
        date: termDate(candidateYear, index),
        index,
        name: TERM_NAMES[index],
      });
    }
  }
  return terms.sort((a, b) => a.date - b.date);
}

function yearPillar(now) {
  const year = now.getFullYear();
  const liChun = termDate(year, 2);
  const ganzhiYear = now >= liChun ? year : year - 1;
  return {
    year: ganzhiYear,
    stemIndex: wrap(ganzhiYear - 4, 10),
    branchIndex: wrap(ganzhiYear - 4, 12),
  };
}

function monthPillar(now, yearStemIndex) {
  const activeTerm = significantTermsAround(now.getFullYear())
    .filter((term) => term.date <= now)
    .at(-1);
  const branchIndex = activeTerm.branchIndex;
  const firstMonthStem = wrap((yearStemIndex % 5) * 2 + 2, 10);
  const offsetFromYin = wrap(branchIndex - 2, 12);
  return {
    term: activeTerm,
    stemIndex: wrap(firstMonthStem + offsetFromYin, 10),
    branchIndex,
  };
}

function gregorianJdn(year, month, day) {
  const a = Math.floor((14 - month) / 12);
  const y = year + 4800 - a;
  const m = month + 12 * a - 3;
  return (
    day +
    Math.floor((153 * m + 2) / 5) +
    365 * y +
    Math.floor(y / 4) -
    Math.floor(y / 100) +
    Math.floor(y / 400) -
    32045
  );
}

function dayPillar(now) {
  const jdn = gregorianJdn(now.getFullYear(), now.getMonth() + 1, now.getDate());
  const index = wrap(jdn + 49, 60);
  return {
    stemIndex: index % 10,
    branchIndex: index % 12,
  };
}

function hourPillar(now, dayStemIndex) {
  const branchIndex = Math.floor((now.getHours() + 1) / 2) % 12;
  return {
    stemIndex: wrap((dayStemIndex % 5) * 2 + branchIndex, 10),
    branchIndex,
  };
}

function nextSolarTerm(now) {
  return allTermsAround(now.getFullYear()).find((term) => term.date > now);
}

function formatTermDate(date) {
  return new Intl.DateTimeFormat("zh-CN", {
    month: "numeric",
    day: "numeric",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatPickerValue(date) {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  const hour = String(date.getHours()).padStart(2, "0");
  const minute = String(date.getMinutes()).padStart(2, "0");
  return `${year}-${month}-${day}T${hour}:${minute}`;
}

function syncPicker(date) {
  if (!isPickerEditing && document.activeElement !== elements.picker) {
    elements.picker.value = formatPickerValue(date);
  }
}

function updateSelectedDateFromPicker() {
  if (!elements.picker.value) {
    selectedDate = null;
    return;
  }

  const nextDate = new Date(elements.picker.value);
  if (!Number.isNaN(nextDate.getTime())) {
    selectedDate = nextDate;
  }
}

function beginPickerEdit() {
  if (!isPickerEditing) {
    pickerValueBeforeEdit = elements.picker.value;
    hasPickerChanged = false;
  }
  isPickerEditing = true;
}

function finishPickerEdit() {
  if (hasPickerChanged || selectedDate) {
    updateSelectedDateFromPicker();
  }
  isPickerEditing = false;
}

function render() {
  const now = selectedDate || new Date();
  const year = yearPillar(now);
  const month = monthPillar(now, year.stemIndex);
  const day = dayPillar(now);
  const hour = hourPillar(now, day.stemIndex);
  const pillars = {
    year,
    month,
    day,
    hour,
  };
  const nextTerm = nextSolarTerm(now);

  renderSentence(pillars);
  elements.solarTerm.textContent = `节令 ${month.term.name} ${formatTermDate(month.term.date)} · ${BRANCHES[month.branchIndex]}月`;
  elements.nextTerm.textContent = `下一节气 ${nextTerm.name} ${formatTermDate(nextTerm.date)}`;
  elements.timezone.textContent = Intl.DateTimeFormat().resolvedOptions().timeZone || "本机时区";
  syncPicker(now);
  requestAnimationFrame(fitSentence);
}

function initTheme() {
  const savedTheme = localStorage.getItem("ganzhi-theme");
  if (savedTheme) {
    document.documentElement.dataset.theme = savedTheme;
  }
  elements.themeToggle.addEventListener("click", () => {
    const nextTheme = document.documentElement.dataset.theme === "light" ? "dark" : "light";
    document.documentElement.dataset.theme = nextTheme;
    localStorage.setItem("ganzhi-theme", nextTheme);
  });
}

function initPicker() {
  syncPicker(new Date());

  elements.picker.addEventListener("focus", () => {
    beginPickerEdit();
  });
  elements.picker.addEventListener("pointerdown", () => {
    beginPickerEdit();
  });
  elements.picker.addEventListener("input", () => {
    hasPickerChanged = elements.picker.value !== pickerValueBeforeEdit;
    updateSelectedDateFromPicker();
    render();
  });
  elements.picker.addEventListener("change", () => {
    hasPickerChanged = true;
    finishPickerEdit();
    render();
  });
  elements.picker.addEventListener("blur", () => {
    finishPickerEdit();
    render();
  });
  elements.nowButton.addEventListener("click", () => {
    selectedDate = null;
    isPickerEditing = false;
    hasPickerChanged = false;
    render();
  });
}

initTheme();
initPicker();
render();
setInterval(render, 1000);
window.addEventListener("resize", fitSentence);
document.fonts?.ready.then(fitSentence);
