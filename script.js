const STORAGE_KEY = "dialysis-handover-demo-v1";
const DEFAULT_SETTINGS = {
  dialysisTypes: ["HD", "OHDF", "HDF", "その他"],
  categories: ["通常", "新規", "ラスト", "スキップ"],
  importanceLevels: ["通常", "注意", "重要", "覚えておく"],
  tags: ["DW変更", "除水", "BP低下", "BP高値", "穿刺", "返血", "脱血不良", "薬剤", "検査値", "入院", "退院", "次回確認"]
};
const IMPORTANT_LEVELS = ["重要", "覚えておく"];
const TEXT_COLORS = {
  black: "#202123",
  red: "#b22525",
  orange: "#ac5b00",
  blue: "#17649a",
  green: "#24723a"
};

let appData = loadData();
let morningFilter = "all";
let morningIndex = 0;
let morningListMode = false;
let selectedHistoryPatientId = "";
let draftContent = [];
let activeSettingsTab = "dialysisTypes";
let editingRecordId = "";
let entryRecordFilter = "today";
let entryRecordDate = formatDate(new Date());
let morningDate = formatDate(new Date());
let morningSchedule = defaultScheduleForDate(morningDate);
let selectedPatientId = "";
let forceNewPatient = false;

const SCHEDULE_DAYS = {
  mwf: new Set([1, 3, 5]),
  tts: new Set([2, 4, 6])
};

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function defaultScheduleForDate(dateString) {
  const day = new Date(`${dateString}T00:00:00`).getDay();
  return [2, 4, 6].includes(day) ? "tts" : "mwf";
}

function previousScheduleDate(dateString, schedule) {
  const date = new Date(`${dateString}T00:00:00`);
  do {
    date.setDate(date.getDate() - 1);
  } while (!SCHEDULE_DAYS[schedule].has(date.getDay()));
  return formatDate(date);
}

function recordDate(record) {
  return record.recordDate || formatDate(record.recordedAt);
}

function isoAtOffset(dayOffset, time = "08:30") {
  const date = new Date();
  date.setDate(date.getDate() + dayOffset);
  return `${formatDate(date)}T${time}:00`;
}

function formatDateTime(value) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("ja-JP", {
    year: "numeric", month: "2-digit", day: "2-digit",
    hour: "2-digit", minute: "2-digit"
  }).format(new Date(value));
}

function createSampleData() {
  return {
    schemaVersion: 4,
    exportedAt: null,
    updatedAt: new Date().toISOString(),
    settings: structuredClone(DEFAULT_SETTINGS),
    patients: [
      { id: "p-001", familyName: "佐藤", givenName: "一郎", dialysisType: "HD", createdAt: isoAtOffset(-34, "09:00") },
      { id: "p-002", familyName: "鈴木", givenName: "花子", dialysisType: "OHDF", createdAt: isoAtOffset(-22, "10:00") },
      { id: "p-003", familyName: "高橋", givenName: "健", dialysisType: "HDF", createdAt: isoAtOffset(-15, "08:00") },
      { id: "p-004", familyName: "田中", givenName: "美咲", dialysisType: "HD", createdAt: isoAtOffset(-8, "11:00") },
      { id: "p-005", familyName: "伊藤", givenName: "次郎", dialysisType: "その他", createdAt: isoAtOffset(-4, "12:00") }
    ],
    records: [
      {
        id: "r-001", patientId: "p-001", recordedAt: isoAtOffset(-31, "12:10"),
        dialysisType: "HD", category: "通常", importance: "注意", tags: ["BP低下", "次回確認"],
        text: "後半に血圧が低下しました。休憩と補液で回復しています。次回も後半の血圧推移を確認してください。",
        textColor: "blue", nextCheck: "後半の血圧を15分ごとに確認", addToOngoing: true
      },
      {
        id: "r-002", patientId: "p-001", recordedAt: isoAtOffset(-1, "12:25"),
        dialysisType: "HD", category: "通常", importance: "重要", tags: ["DW変更", "除水", "次回確認"],
        text: "DWを0.3kg調整しました。終了時の状態は安定しています。次回、透析前体重と浮腫の有無を確認してください。",
        textColor: "black",
        content: [
          { text: "DWを0.3kg調整しました。", color: "red" },
          { text: "終了時の状態は安定しています。次回、透析前体重と浮腫の有無を確認してください。", color: "black" }
        ],
        nextCheck: "新しいDWでの透析前体重と浮腫を確認", addToOngoing: true
      },
      {
        id: "r-003", patientId: "p-002", recordedAt: isoAtOffset(-9, "13:40"),
        dialysisType: "OHDF", category: "通常", importance: "通常", tags: ["穿刺"],
        text: "穿刺は通常どおり問題なく実施できました。治療中も大きな変化はありません。",
        textColor: "black", nextCheck: "", addToOngoing: false
      },
      {
        id: "r-004", patientId: "p-002", recordedAt: isoAtOffset(-1, "13:15"),
        dialysisType: "OHDF", category: "ラスト", importance: "覚えておく", tags: ["退院", "次回確認"],
        text: "今回で当室での治療はラストです。転院先への情報提供書を確認済みです。忘れ物がないことを確認してください。",
        textColor: "green", nextCheck: "転院先への連絡事項があれば追記", addToOngoing: false
      },
      {
        id: "r-005", patientId: "p-003", recordedAt: isoAtOffset(-1, "11:40"),
        dialysisType: "HDF", category: "新規", importance: "注意", tags: ["穿刺", "薬剤", "次回確認"],
        text: "当室での初回治療です。持参薬を確認しました。穿刺部位は左右とも状態良好です。次回も不安の有無を声かけしてください。",
        textColor: "orange", nextCheck: "持参薬の変更有無と穿刺部位を確認", addToOngoing: true
      },
      {
        id: "r-006", patientId: "p-004", recordedAt: isoAtOffset(-1, "10:50"),
        dialysisType: "HD", category: "スキップ", importance: "通常", tags: ["入院"],
        text: "入院中のため本日の外来透析はスキップです。病棟での治療予定を確認済みです。",
        textColor: "blue", nextCheck: "退院予定が決まり次第、次回来院日を確認", addToOngoing: false
      },
      {
        id: "r-007", patientId: "p-005", recordedAt: isoAtOffset(-3, "13:05"),
        dialysisType: "その他", category: "通常", importance: "注意", tags: ["脱血不良"],
        text: "開始直後に脱血不良があり、体位調整で改善しました。治療終了まで再発はありませんでした。",
        textColor: "orange", nextCheck: "開始直後の脱血状態を確認", addToOngoing: true
      },
      {
        id: "r-008", patientId: "p-005", recordedAt: isoAtOffset(-1, "13:20"),
        dialysisType: "その他", category: "通常", importance: "重要", tags: ["検査値", "薬剤", "次回確認"],
        text: "検査値について医師確認済みです。処方変更の指示があります。次回来院時に変更後の内服状況を確認してください。",
        textColor: "red", nextCheck: "変更後の内服状況を本人に確認", addToOngoing: true
      }
    ]
  };
}

function loadData() {
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (!stored) {
      const sample = createSampleData();
      localStorage.setItem(STORAGE_KEY, JSON.stringify(sample));
      return sample;
    }
    return normalizeData(JSON.parse(stored));
  } catch (error) {
    console.error("保存データの読み込みに失敗しました。", error);
    return createSampleData();
  }
}

function normalizeData(data) {
  if (!data || !Array.isArray(data.patients) || !Array.isArray(data.records)) {
    throw new Error("patients と records が必要です。");
  }
  return {
    schemaVersion: Math.max(Number(data.schemaVersion) || 1, 4),
    exportedAt: data.exportedAt || null,
    updatedAt: data.updatedAt || new Date().toISOString(),
    settings: normalizeSettings(data.settings),
    patients: data.patients.map((patient) => normalizePatient(patient)),
    records: data.records.map((record) => normalizeRecord(record))
  };
}

function normalizeSettings(settings = {}) {
  return Object.fromEntries(Object.entries(DEFAULT_SETTINGS).map(([key, defaults]) => {
    const values = Array.isArray(settings[key]) ? settings[key] : defaults;
    const unique = [...new Set(values.map((value) => String(value).trim()).filter(Boolean))];
    return [key, unique.length ? unique : [...defaults]];
  }));
}

function normalizePatient(patient) {
  if (patient.familyName || patient.givenName) {
    return { ...patient, familyName: String(patient.familyName || "").trim(), givenName: String(patient.givenName || "").trim() };
  }
  const parts = String(patient.name || "").trim().split(/\s+/).filter(Boolean);
  return {
    ...patient,
    familyName: parts[0] || "",
    givenName: parts.slice(1).join(" ")
  };
}

function patientDisplayName(patient) {
  return [patient.familyName, patient.givenName].filter(Boolean).join(" ");
}

function normalizeRecord(record) {
  const normalized = { tags: [], textColor: "black", nextCheck: "", addToOngoing: false, ...record };
  normalized.recordDate = record.recordDate || formatDate(record.recordedAt || new Date());
  normalized.updatedAt = record.updatedAt || record.recordedAt || new Date().toISOString();
  normalized.content = Array.isArray(record.content) && record.content.length
    ? record.content.map((run) => ({
      text: String(run.text || ""),
      color: TEXT_COLORS[run.color] ? run.color : "black"
    }))
    : [{ text: String(normalized.text || ""), color: TEXT_COLORS[normalized.textColor] ? normalized.textColor : "black" }];
  normalized.text = normalized.content.map((run) => run.text).join("");
  return normalized;
}

function saveData() {
  appData.updatedAt = new Date().toISOString();
  localStorage.setItem(STORAGE_KEY, JSON.stringify(appData));
  renderAll();
}

function escapeHtml(value = "") {
  return String(value).replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;"
  }[char]));
}

function patientById(patientId) {
  return appData.patients.find((patient) => patient.id === patientId);
}

function optionHtml(values, selected = "") {
  return values.map((value) => `
    <option value="${escapeHtml(value)}"${value === selected ? " selected" : ""}>
      ${escapeHtml(value === "その他" ? "その他（手動入力）" : value)}
    </option>`).join("");
}

function recordsForPatient(patientId) {
  return appData.records
    .filter((record) => record.patientId === patientId)
    .sort((a, b) => {
      const dateDiff = new Date(`${recordDate(b)}T00:00:00`) - new Date(`${recordDate(a)}T00:00:00`);
      return dateDiff || new Date(b.recordedAt) - new Date(a.recordedAt);
    });
}

function morningTargetDate() {
  return previousScheduleDate(morningDate, morningSchedule);
}

function morningPatients() {
  const targetDate = morningTargetDate();
  const patientIds = new Set(
    appData.records
      .filter((record) => recordDate(record) === targetDate)
      .map((record) => record.patientId)
  );
  return appData.patients.filter((patient) => patientIds.has(patient.id));
}

function latestMorningRecord(patientId) {
  const targetDate = morningTargetDate();
  return recordsForPatient(patientId)
    .find((record) => recordDate(record) === targetDate);
}

function filteredMorningPatients() {
  return morningPatients().filter((patient) => {
    const record = latestMorningRecord(patient.id);
    if (!record) return false;
    if (morningFilter === "all") return true;
    if (morningFilter === "important") return IMPORTANT_LEVELS.includes(record.importance);
    return record.category === morningFilter;
  });
}

function categoryClass(category) {
  return { "新規": "status-new", "ラスト": "status-last", "スキップ": "status-skip" }[category] || "";
}

function renderTags(tags) {
  if (!tags.length) return "";
  return `<div class="tag-row">${tags.map((tag) => `<span class="tag">${escapeHtml(tag)}</span>`).join("")}</div>`;
}

function renderContent(record, className = "") {
  const content = normalizeRecord(record).content
    .map((run) => `<span class="text-${escapeHtml(run.color)}">${escapeHtml(run.text)}</span>`)
    .join("");
  return `<p class="${className}">${content}</p>`;
}

function renderRecord(record, options = {}) {
  const showCategory = options.showCategory !== false;
  const extraClass = options.extraClass || "";
  const showEdit = options.showEdit === true;
  return `
    <article class="record-item ${escapeHtml(extraClass)}">
      <div class="record-heading">
        <div class="record-meta">
          <span>対象日：${escapeHtml(recordDate(record))}</span>
          <span>初回入力：${escapeHtml(formatDateTime(record.recordedAt))}</span>
          <span>${escapeHtml(record.dialysisType)}</span>
          ${showCategory ? `<span class="badge ${categoryClass(record.category)}">${escapeHtml(record.category)}</span>` : ""}
          <span class="badge ${IMPORTANT_LEVELS.includes(record.importance) ? "important" : ""}">重要度：${escapeHtml(record.importance)}</span>
        </div>
        ${showEdit ? `<button class="edit-button secondary-button" type="button" data-edit-record="${escapeHtml(record.id)}">編集</button>` : ""}
      </div>
      ${renderTags(record.tags)}
      ${renderContent(record)}
      ${record.nextCheck ? `<p class="next-check"><strong>次回確認：</strong>${escapeHtml(record.nextCheck)}</p>` : ""}
    </article>`;
}

function renderPatientCard(patient) {
  const latest = latestMorningRecord(patient.id) || recordsForPatient(patient.id)[0];
  const allRecords = recordsForPatient(patient.id);
  const ongoing = allRecords.filter((record) => record.addToOngoing);
  if (!latest) return "";
  const previousRecords = allRecords.filter((record) => (
    new Date(`${recordDate(record)}T00:00:00`) < new Date(`${recordDate(latest)}T00:00:00`)
    || (recordDate(record) === recordDate(latest) && new Date(record.recordedAt) < new Date(latest.recordedAt))
  ));
  const previous = previousRecords[0];
  const olderRecords = previousRecords.slice(1);

  return `
    <article class="patient-card">
      <header class="patient-card-header ${categoryClass(latest.category)}">
        <h3>${escapeHtml(patientDisplayName(patient))}</h3>
        <div class="patient-card-header-side">
          <div class="badge-row">
            <span class="badge">${escapeHtml(latest.dialysisType)}</span>
            <span class="badge ${categoryClass(latest.category)}">区分：${escapeHtml(latest.category)}</span>
            <span class="badge ${IMPORTANT_LEVELS.includes(latest.importance) ? "important" : ""}">重要度：${escapeHtml(latest.importance)}</span>
          </div>
          <button class="morning-edit-button secondary-button" type="button" data-edit-record="${escapeHtml(latest.id)}">編集</button>
        </div>
      </header>
      <div class="patient-card-body">
        <section class="info-block latest-panel">
          <h4>前回の申し送り（${escapeHtml(recordDate(latest))}）</h4>
          ${renderTags(latest.tags)}
          ${renderContent(latest, "latest-text")}
          ${latest.nextCheck ? `<p class="next-check"><strong>次回確認：</strong>${escapeHtml(latest.nextCheck)}</p>` : ""}
        </section>
        <section class="info-block">
          <h4>過去の記録</h4>
          <div class="record-list">${previous ? renderRecord(previous, { extraClass: "previous-record" }) : "<p>過去の記録はありません。</p>"}</div>
        </section>
        <details class="full-history" open>
          <summary>それ以前の記録（${olderRecords.length}件）</summary>
          <div class="record-list">${olderRecords.length ? olderRecords.map((record) => renderRecord(record)).join("") : "<p>それ以前の記録はありません。</p>"}</div>
        </details>
        <details class="full-history">
          <summary>継続注意（${ongoing.length}件）</summary>
          <div class="ongoing-list">
            ${ongoing.length ? ongoing.map((record) => `
              <div class="ongoing-item">
                <div class="record-meta"><span>${escapeHtml(formatDateTime(record.recordedAt))}</span></div>
                ${renderContent(record)}
              </div>`).join("") : "<p>継続注意はありません。</p>"}
          </div>
        </details>
      </div>
    </article>`;
}

function renderMorningPatientList(patients) {
  if (!patients.length) return emptyState();
  return patients.map((patient, index) => {
    const record = latestMorningRecord(patient.id);
    const number = String(index + 1).padStart(2, "0");
    return `
      <button class="morning-patient-row ${index === morningIndex ? "active" : ""}" type="button" data-morning-patient-index="${index}">
        <span class="patient-number">${escapeHtml(number)}</span>
        <span class="morning-patient-name">${escapeHtml(patientDisplayName(patient))}</span>
        ${record ? `<span class="mini-pill ${categoryClass(record.category)}">${escapeHtml(record.category)}</span>` : ""}
      </button>`;
  }).join("");
}

function renderMorning() {
  const patients = filteredMorningPatients();
  const targetDate = morningTargetDate();
  const morningView = document.querySelector("#morning-view");
  morningIndex = Math.max(0, Math.min(morningIndex, patients.length - 1));
  morningView.classList.toggle("list-layout", morningListMode);
  morningView.classList.toggle("block-layout", !morningListMode);
  document.querySelector("#target-count").textContent = String(morningPatients().length);
  document.querySelector("#current-position").textContent = patients.length
    ? `${morningIndex + 1} / ${patients.length}`
    : "0 / 0";

  const container = document.querySelector("#morning-card-container");
  const patientList = document.querySelector("#morning-patient-list");
  const detailPanel = document.querySelector("#morning-detail-panel");
  patientList.innerHTML = renderMorningPatientList(patients);
  if (!patients.length) {
    container.innerHTML = emptyState();
    detailPanel.innerHTML = emptyState();
  } else if (morningListMode) {
    container.innerHTML = patients.map((patient) => renderPatientCard(patient)).join("");
    detailPanel.innerHTML = renderPatientCard(patients[morningIndex]);
  } else {
    container.innerHTML = renderPatientCard(patients[morningIndex]);
    detailPanel.innerHTML = renderPatientCard(patients[morningIndex]);
  }

  document.querySelector("#prev-patient").disabled = !patients.length || morningListMode;
  document.querySelector("#next-patient").disabled = !patients.length || morningListMode;
  document.querySelector("#toggle-list").classList.toggle("active", !morningListMode);
  document.querySelector("#toggle-list").setAttribute("aria-pressed", String(!morningListMode));
  document.querySelector("#morning-list-view").classList.toggle("active", morningListMode);
  document.querySelector("#morning-list-view").setAttribute("aria-pressed", String(morningListMode));
  document.querySelector("#morning-date").value = morningDate;
  document.querySelector("#morning-date-summary").textContent =
    `朝会日 ${morningDate} / ${morningSchedule === "mwf" ? "月・水・金" : "火・木・土"}クールの前回透析日：${targetDate}`;
  document.querySelectorAll("[data-morning-schedule]").forEach((button) => {
    button.classList.toggle("active", button.dataset.morningSchedule === morningSchedule);
  });
}

function renderEntryOptions() {
  const sortedPatients = appData.patients.slice()
    .sort((a, b) => patientDisplayName(a).localeCompare(patientDisplayName(b), "ja"));
  document.querySelector("#patient-family-candidates").innerHTML = sortedPatients
    .map((patient) => `<option value="${escapeHtml(patient.familyName)}">${escapeHtml(patientDisplayName(patient))}</option>`)
    .join("");
  document.querySelector("#patient-given-candidates").innerHTML = sortedPatients
    .map((patient) => `<option value="${escapeHtml(patient.givenName)}">${escapeHtml(patientDisplayName(patient))}</option>`)
    .join("");
  const dialysisTypes = appData.settings.dialysisTypes.includes("その他")
    ? appData.settings.dialysisTypes
    : [...appData.settings.dialysisTypes, "その他"];
  document.querySelector("#dialysis-type").innerHTML = optionHtml(dialysisTypes);
  document.querySelector("#category").innerHTML = optionHtml(appData.settings.categories);
  document.querySelector("#importance").innerHTML = optionHtml(appData.settings.importanceLevels);
  document.querySelector("#tag-options").innerHTML = appData.settings.tags.map((tag) => `
    <label class="tag-option">
      <input type="checkbox" name="tags" value="${escapeHtml(tag)}">
      <span>${escapeHtml(tag)}</span>
    </label>`).join("");
  updateDialysisOtherVisibility();
}

function renderEntryRecords() {
  const records = appData.records.filter((record) => {
    if (entryRecordFilter === "all") return true;
    if (SCHEDULE_DAYS[entryRecordFilter]) {
      return SCHEDULE_DAYS[entryRecordFilter].has(new Date(`${recordDate(record)}T00:00:00`).getDay());
    }
    return recordDate(record) === entryRecordDate;
  })
    .sort((a, b) => {
      const dateDiff = new Date(`${recordDate(b)}T00:00:00`) - new Date(`${recordDate(a)}T00:00:00`);
      return dateDiff || new Date(b.recordedAt) - new Date(a.recordedAt);
    });
  const summaries = {
    today: `${entryRecordDate} の申し送り`,
    date: `${entryRecordDate} の申し送り`,
    mwf: "月・水・金クールの申し送り",
    tts: "火・木・土クールの申し送り",
    all: "全履歴"
  };
  document.querySelector("#entry-record-date").value = entryRecordDate;
  document.querySelector("#entry-record-summary").textContent = `${summaries[entryRecordFilter]}：${records.length}件`;
  document.querySelectorAll("[data-entry-record-filter]").forEach((button) => {
    button.classList.toggle("active", button.dataset.entryRecordFilter === entryRecordFilter);
  });
  document.querySelector("#entry-record-list").innerHTML = records.length
    ? records.map((record) => {
      const patient = patientById(record.patientId);
      return `
        <article class="record-item">
          <div class="record-heading">
            <div>
              <h4>${escapeHtml(patient ? patientDisplayName(patient) : "患者不明")}</h4>
              <div class="record-meta">
                <span>対象日：${escapeHtml(recordDate(record))}</span>
                <span>初回入力：${escapeHtml(formatDateTime(record.recordedAt))}</span>
                <span>${escapeHtml(record.dialysisType)}</span>
                <span class="badge ${categoryClass(record.category)}">${escapeHtml(record.category)}</span>
                <span class="badge ${IMPORTANT_LEVELS.includes(record.importance) ? "important" : ""}">重要度：${escapeHtml(record.importance)}</span>
              </div>
            </div>
            <button class="edit-button secondary-button" type="button" data-edit-record="${escapeHtml(record.id)}">編集</button>
          </div>
          ${renderTags(record.tags)}
          ${renderContent(record)}
          ${record.nextCheck ? `<p class="next-check"><strong>次回確認：</strong>${escapeHtml(record.nextCheck)}</p>` : ""}
        </article>`;
    }).join("")
    : emptyState();
}

function historyFilteredPatients() {
  const name = document.querySelector("#history-name-search").value.trim().toLowerCase();
  const tag = document.querySelector("#history-tag-search").value;
  const importance = document.querySelector("#history-importance-search").value;
  return appData.patients.filter((patient) => {
    if (name && !patientDisplayName(patient).toLowerCase().includes(name)) return false;
    const records = recordsForPatient(patient.id);
    if (tag && !records.some((record) => record.tags.includes(tag))) return false;
    if (importance && !records.some((record) => record.importance === importance)) return false;
    return true;
  }).sort((a, b) => patientDisplayName(a).localeCompare(patientDisplayName(b), "ja"));
}

function renderHistory() {
  const patients = historyFilteredPatients();
  if (!patients.some((patient) => patient.id === selectedHistoryPatientId)) {
    selectedHistoryPatientId = patients[0]?.id || "";
  }

  document.querySelector("#history-patient-list").innerHTML = patients.length
    ? patients.map((patient) => `
      <button class="patient-list-button ${patient.id === selectedHistoryPatientId ? "active" : ""}" type="button" data-history-patient="${escapeHtml(patient.id)}">
        ${escapeHtml(patientDisplayName(patient))}
      </button>`).join("")
    : emptyState();

  const detail = document.querySelector("#history-detail");
  const patient = patientById(selectedHistoryPatientId);
  if (!patient) {
    detail.innerHTML = emptyState();
    return;
  }
  const records = recordsForPatient(patient.id);
  detail.innerHTML = `
    <h3>${escapeHtml(patientDisplayName(patient))}</h3>
    <p>登録済み治療歴：${records.length}件</p>
    <div class="record-list">${records.length ? records.map((record) => renderRecord(record)).join("") : emptyState()}</div>`;
}

function renderSettings() {
  document.querySelector("#patient-count").textContent = String(appData.patients.length);
  document.querySelector("#record-count").textContent = String(appData.records.length);
  document.querySelector("#last-updated").textContent = formatDateTime(appData.updatedAt);
  renderSettingsEditor();
  document.querySelector("#history-tag-search").innerHTML = `<option value="">すべてのタグ</option>${optionHtml(appData.settings.tags)}`;
  document.querySelector("#history-importance-search").innerHTML = `<option value="">すべての重要度</option>${optionHtml(appData.settings.importanceLevels)}`;
}

function renderSettingsEditor() {
  const labels = {
    dialysisTypes: "透析種別",
    categories: "区分",
    importanceLevels: "重要度",
    tags: "タグ"
  };
  document.querySelector("#settings-list-label").textContent = labels[activeSettingsTab];
  document.querySelector("#settings-list-editor").value = appData.settings[activeSettingsTab].join("\n");
  document.querySelector("#settings-list-help").textContent = activeSettingsTab === "dialysisTypes"
    ? "「その他」を残すと、入力モードで自由入力欄を利用できます。"
    : "空行と重複項目は保存時に除外されます。";
}

function updateDialysisOtherVisibility() {
  const isOther = document.querySelector("#dialysis-type").value === "その他";
  const field = document.querySelector("#dialysis-other-field");
  field.classList.toggle("hidden", !isOther);
  document.querySelector("#dialysis-type-other").required = isOther;
}

function selectedDialysisType(form) {
  const selected = String(form.get("dialysisType"));
  return selected === "その他" ? String(form.get("dialysisTypeOther")).trim() : selected;
}

function matchingPatients(familyName, givenName) {
  if (!familyName) return [];
  return appData.patients.filter((patient) => patient.familyName === familyName && patient.givenName === givenName);
}

function patientSummary(patient) {
  const records = recordsForPatient(patient.id);
  const latest = records[0];
  return [
    `識別ID：${patient.id}`,
    `透析種別：${patient.dialysisType || "-"}`,
    `記録：${records.length}件`,
    latest ? `最終対象日：${recordDate(latest)}` : "記録なし"
  ].join(" / ");
}

function selectedOrSuggestedPatient() {
  if (forceNewPatient) return null;
  const selected = patientById(selectedPatientId);
  if (selected) return selected;
  const familyName = document.querySelector("#patient-family-name").value.trim();
  const givenName = document.querySelector("#patient-given-name").value.trim();
  const matches = matchingPatients(familyName, givenName);
  return matches.length === 1 ? matches[0] : null;
}

function renderPatientMatchPanel(matches) {
  const panel = document.querySelector("#patient-match-panel");
  if (!matches.length) {
    panel.classList.add("hidden");
    panel.innerHTML = "";
    return;
  }

  const needsChoice = matches.length > 1;
  panel.classList.remove("hidden");
  panel.innerHTML = `
    <h4>${needsChoice ? "同姓同名の患者候補があります" : "登録済み患者候補"}</h4>
    <p>${needsChoice ? "取り違え防止のため、前回の患者か新規患者かを必ず選択してください。" : "通常はこの患者に追記します。別患者として登録することもできます。"}</p>
    <div class="patient-choice-list">
      ${matches.map((patient) => `
        <label class="patient-choice">
          <input type="radio" name="patientChoice" value="${escapeHtml(patient.id)}"${selectedPatientId === patient.id ? " checked" : ""}>
          <span>
            <strong>${escapeHtml(patientDisplayName(patient) || "氏名未設定")}</strong>
            <small>${escapeHtml(patientSummary(patient))}</small>
          </span>
        </label>`).join("")}
      <label class="patient-choice">
        <input type="radio" name="patientChoice" value="__new__"${forceNewPatient ? " checked" : ""}>
        <span>
          <strong>別の新規患者として登録</strong>
          <small>同姓同名、または名なしの別患者の場合はこちらを選びます。</small>
        </span>
      </label>
    </div>`;
}

function renderEntryPatientHistory() {
  const patient = selectedOrSuggestedPatient();
  const container = document.querySelector("#entry-patient-history");
  if (!patient) {
    container.innerHTML = `
      <div class="empty-state">
        <h3>患者を選択すると過去記録を表示します</h3>
        <p>同姓同名の候補がある場合は、上の候補から患者を選んでください。</p>
      </div>`;
    return;
  }
  const records = recordsForPatient(patient.id);
  container.innerHTML = records.length
    ? records.map((record) => renderRecord(record)).join("")
    : `<div class="empty-state"><h3>過去記録はありません</h3><p>${escapeHtml(patientDisplayName(patient))} さんの初回記録として保存できます。</p></div>`;
}

function updatePatientHint() {
  const familyName = document.querySelector("#patient-family-name").value.trim();
  const givenName = document.querySelector("#patient-given-name").value.trim();
  const matches = matchingPatients(familyName, givenName);
  if (!forceNewPatient && !matches.some((patient) => patient.id === selectedPatientId)) {
    selectedPatientId = matches.length === 1 ? matches[0].id : "";
  }
  const patient = selectedOrSuggestedPatient();
  const hint = document.querySelector("#patient-name-hint");
  if (patient) {
    hint.textContent = `登録済み患者です。透析種別：${patient.dialysisType}`;
    const isPreset = appData.settings.dialysisTypes.includes(patient.dialysisType);
    document.querySelector("#dialysis-type").value = isPreset ? patient.dialysisType : "その他";
    document.querySelector("#dialysis-type-other").value = isPreset ? "" : patient.dialysisType;
    updateDialysisOtherVisibility();
  } else if (matches.length > 1) {
    hint.textContent = "同姓同名の候補があります。下の候補から選択してください。";
  } else {
    hint.textContent = "未登録の患者名です。保存時に新規患者として登録されます。";
  }
  renderPatientMatchPanel(matches);
  renderEntryPatientHistory();
}

function renderAll() {
  renderMorning();
  renderEntryOptions();
  renderEntryRecords();
  renderEntryPatientHistory();
  renderHistory();
  renderSettings();
}

function switchView(viewName) {
  document.querySelectorAll(".nav-button").forEach((button) => {
    button.classList.toggle("active", button.dataset.view === viewName);
  });
  document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
  document.querySelector(`#${viewName}-view`).classList.add("active");
}

function setFormMode(record = null) {
  editingRecordId = record?.id || "";
  document.querySelector("#form-mode-label").textContent = record
    ? "登録済みの申し送りを編集中"
    : "新しい申し送りを入力";
  document.querySelector("#save-record").textContent = record
    ? "変更内容を保存"
    : "新しい申し送りを保存";
  document.querySelector("#cancel-edit").classList.toggle("hidden", !record);
}

function startRecordEdit(recordId) {
  const record = appData.records.find((item) => item.id === recordId);
  if (!record) return;
  const patient = patientById(record.patientId);
  if (!patient) return;
  switchView("entry");
  setFormMode(record);
  selectedPatientId = patient.id;
  forceNewPatient = false;
  document.querySelector("#record-date").value = recordDate(record);
  document.querySelector("#patient-family-name").value = patient.familyName;
  document.querySelector("#patient-given-name").value = patient.givenName;
  const isPreset = appData.settings.dialysisTypes.includes(record.dialysisType);
  document.querySelector("#dialysis-type").value = isPreset ? record.dialysisType : "その他";
  document.querySelector("#dialysis-type-other").value = isPreset ? "" : record.dialysisType;
  updateDialysisOtherVisibility();
  document.querySelector("#category").value = record.category;
  document.querySelector("#importance").value = record.importance;
  document.querySelectorAll('input[name="tags"]').forEach((input) => {
    input.checked = record.tags.includes(input.value);
  });
  document.querySelector("#handover-text").value = record.text;
  draftContent = normalizeRecord(record).content.map((run) => ({ ...run }));
  renderDraftPreview();
  document.querySelector("#next-check").value = record.nextCheck;
  document.querySelector("#add-ongoing").checked = record.addToOngoing;
  document.querySelector("#patient-name-hint").textContent = `登録済み患者です。透析種別：${patient.dialysisType}`;
  renderPatientMatchPanel(matchingPatients(patient.familyName, patient.givenName));
  renderEntryPatientHistory();
  setMessage("#save-message", "内容を修正して「変更内容を保存」を押してください。");
  document.querySelector("#record-form").scrollIntoView({ behavior: "smooth", block: "start" });
}

function resetRecordForm() {
  document.querySelector("#record-form").reset();
  document.querySelector("#record-date").value = formatDate(new Date());
  updateDialysisOtherVisibility();
  draftContent = [];
  selectedPatientId = "";
  forceNewPatient = false;
  document.querySelector("#patient-name-hint").textContent = "登録済み患者を入力すると候補が表示されます。";
  renderPatientMatchPanel([]);
  renderEntryPatientHistory();
  renderDraftPreview();
  setFormMode();
}

function emptyState() {
  return document.querySelector("#empty-state-template").innerHTML;
}

function createId(prefix) {
  return `${prefix}-${Date.now()}-${Math.random().toString(36).slice(2, 7)}`;
}

function setMessage(target, text, isError = false) {
  const element = document.querySelector(target);
  element.textContent = text;
  element.style.color = isError ? "#a83535" : "";
}

function contentFromEditor() {
  const text = document.querySelector("#handover-text").value.trim();
  if (!text) return [];
  return draftContent.map((run) => ({ ...run })).filter((run) => run.text);
}

function mergeRuns(runs) {
  return runs.reduce((result, run) => {
    if (!run.text) return result;
    const last = result[result.length - 1];
    if (last?.color === run.color) last.text += run.text;
    else result.push({ text: run.text, color: run.color });
    return result;
  }, []);
}

function sliceRuns(runs, start, end) {
  const sliced = [];
  let offset = 0;
  runs.forEach((run) => {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    if (runEnd > start && runStart < end) {
      sliced.push({
        text: run.text.slice(Math.max(0, start - runStart), Math.min(run.text.length, end - runStart)),
        color: run.color
      });
    }
    offset = runEnd;
  });
  return sliced;
}

function updateDraftText(nextText) {
  const previousText = draftContent.map((run) => run.text).join("");
  let prefixLength = 0;
  while (prefixLength < previousText.length && prefixLength < nextText.length
    && previousText[prefixLength] === nextText[prefixLength]) prefixLength += 1;
  let suffixLength = 0;
  while (suffixLength < previousText.length - prefixLength && suffixLength < nextText.length - prefixLength
    && previousText[previousText.length - 1 - suffixLength] === nextText[nextText.length - 1 - suffixLength]) {
    suffixLength += 1;
  }
  draftContent = mergeRuns([
    ...sliceRuns(draftContent, 0, prefixLength),
    { text: nextText.slice(prefixLength, nextText.length - suffixLength), color: "black" },
    ...sliceRuns(draftContent, previousText.length - suffixLength, previousText.length)
  ]);
}

function renderDraftPreview() {
  const preview = document.querySelector("#handover-preview");
  preview.innerHTML = draftContent.length
    ? draftContent.map((run) => `<span class="text-${escapeHtml(run.color)}">${escapeHtml(run.text)}</span>`).join("")
    : "本文を入力すると、ここにプレビューが表示されます。";
}

function applyDraftColor(color) {
  const input = document.querySelector("#handover-text");
  const start = input.selectionStart;
  const end = input.selectionEnd;
  if (start === end) return;
  const runs = [];
  let offset = 0;
  draftContent.forEach((run) => {
    const runStart = offset;
    const runEnd = offset + run.text.length;
    if (runEnd <= start || runStart >= end) {
      runs.push(run);
    } else {
      if (start > runStart) runs.push({ text: run.text.slice(0, start - runStart), color: run.color });
      runs.push({
        text: run.text.slice(Math.max(0, start - runStart), Math.min(run.text.length, end - runStart)),
        color
      });
      if (end < runEnd) runs.push({ text: run.text.slice(end - runStart), color: run.color });
    }
    offset = runEnd;
  });
  draftContent = mergeRuns(runs);
  renderDraftPreview();
}

document.querySelectorAll(".nav-button").forEach((button) => {
  button.addEventListener("click", () => {
    switchView(button.dataset.view);
  });
});

document.querySelectorAll("[data-morning-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    morningFilter = button.dataset.morningFilter;
    morningIndex = 0;
    document.querySelectorAll("[data-morning-filter]").forEach((item) => item.classList.remove("active"));
    button.classList.add("active");
    renderMorning();
  });
});

document.querySelector("#prev-patient").addEventListener("click", () => {
  const count = filteredMorningPatients().length;
  if (count) morningIndex = (morningIndex - 1 + count) % count;
  renderMorning();
});

document.querySelector("#next-patient").addEventListener("click", () => {
  const count = filteredMorningPatients().length;
  if (count) morningIndex = (morningIndex + 1) % count;
  renderMorning();
});

document.querySelector("#toggle-list").addEventListener("click", () => {
  morningListMode = false;
  renderMorning();
});

document.querySelector("#morning-list-view").addEventListener("click", () => {
  morningListMode = true;
  renderMorning();
});

document.querySelector("#morning-patient-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-morning-patient-index]");
  if (!button) return;
  morningIndex = Number(button.dataset.morningPatientIndex);
  renderMorning();
});

document.querySelector("#morning-date").addEventListener("change", (event) => {
  if (!event.target.value) return;
  morningDate = event.target.value;
  morningSchedule = defaultScheduleForDate(morningDate);
  morningIndex = 0;
  renderMorning();
});

document.querySelectorAll("[data-morning-schedule]").forEach((button) => {
  button.addEventListener("click", () => {
    morningSchedule = button.dataset.morningSchedule;
    morningIndex = 0;
    renderMorning();
  });
});

document.querySelectorAll("[data-entry-record-filter]").forEach((button) => {
  button.addEventListener("click", () => {
    entryRecordFilter = button.dataset.entryRecordFilter;
    if (entryRecordFilter === "today") entryRecordDate = formatDate(new Date());
    renderEntryRecords();
  });
});

document.querySelector("#entry-record-date").addEventListener("change", (event) => {
  if (!event.target.value) return;
  entryRecordDate = event.target.value;
  entryRecordFilter = entryRecordDate === formatDate(new Date()) ? "today" : "date";
  renderEntryRecords();
});

["#entry-date-prev", "#entry-date-next"].forEach((selector, index) => {
  document.querySelector(selector).addEventListener("click", () => {
    const date = new Date(`${entryRecordDate}T00:00:00`);
    date.setDate(date.getDate() + (index === 0 ? -1 : 1));
    entryRecordDate = formatDate(date);
    entryRecordFilter = entryRecordDate === formatDate(new Date()) ? "today" : "date";
    renderEntryRecords();
  });
});

document.addEventListener("click", (event) => {
  const button = event.target.closest("[data-edit-record]");
  if (!button) return;
  startRecordEdit(button.dataset.editRecord);
});

document.querySelector("#patient-match-panel").addEventListener("change", (event) => {
  if (event.target.name !== "patientChoice") return;
  forceNewPatient = event.target.value === "__new__";
  selectedPatientId = forceNewPatient ? "" : event.target.value;
  updatePatientHint();
});

document.querySelector("#cancel-edit").addEventListener("click", () => {
  resetRecordForm();
  setMessage("#save-message", "編集を終了しました。新しい申し送りを入力できます。");
});

["#patient-family-name", "#patient-given-name"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", () => {
    selectedPatientId = "";
    forceNewPatient = false;
    updatePatientHint();
  });
});

document.querySelector("#dialysis-type").addEventListener("change", updateDialysisOtherVisibility);

document.querySelector("#handover-text").addEventListener("input", (event) => {
  updateDraftText(event.target.value);
  renderDraftPreview();
});

document.querySelectorAll("[data-editor-color]").forEach((button) => {
  button.addEventListener("mousedown", (event) => event.preventDefault());
  button.addEventListener("click", () => applyDraftColor(button.dataset.editorColor));
});

document.querySelector("#record-form").addEventListener("submit", (event) => {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const targetDate = String(form.get("recordDate")).trim();
  const familyName = String(form.get("patientFamilyName")).trim();
  const givenName = String(form.get("patientGivenName")).trim();
  const name = [familyName, givenName].filter(Boolean).join(" ") || familyName;
  const dialysisType = selectedDialysisType(form);
  const content = contentFromEditor();
  const text = content.map((run) => run.text).join("");
  if (!targetDate || !familyName || !dialysisType || !text) {
    setMessage("#save-message", "対象日、姓、透析種別、申し送り本文を入力してください。", true);
    return;
  }

  const matches = matchingPatients(familyName, givenName);
  let patient = forceNewPatient ? null : patientById(selectedPatientId);
  if (!patient && !forceNewPatient && matches.length === 1) patient = matches[0];
  if (!patient && !forceNewPatient && matches.length > 1) {
    setMessage("#save-message", "同姓同名の候補があります。前回の患者か新規患者かを選択してください。", true);
    renderPatientMatchPanel(matches);
    return;
  }
  if (!patient) {
    patient = {
      id: createId("p"),
      familyName,
      givenName,
      dialysisType,
      createdAt: new Date().toISOString()
    };
    appData.patients.push(patient);
  } else {
    patient.dialysisType = dialysisType;
  }

  const recordData = {
    id: createId("r"),
    patientId: patient.id,
    recordedAt: new Date().toISOString(),
    recordDate: targetDate,
    updatedAt: new Date().toISOString(),
    dialysisType,
    category: String(form.get("category")),
    importance: String(form.get("importance")),
    tags: form.getAll("tags").map(String),
    text,
    content,
    textColor: "black",
    nextCheck: String(form.get("nextCheck")).trim(),
    addToOngoing: form.get("addOngoing") === "on"
  };

  if (editingRecordId) {
    const recordIndex = appData.records.findIndex((record) => record.id === editingRecordId);
    if (recordIndex >= 0) {
      recordData.id = editingRecordId;
      recordData.recordedAt = appData.records[recordIndex].recordedAt;
      recordData.updatedAt = new Date().toISOString();
      appData.records[recordIndex] = recordData;
    }
  } else {
    appData.records.push(recordData);
  }

  const wasEditing = Boolean(editingRecordId);
  saveData();
  resetRecordForm();
  setMessage("#save-message", `${name} さんの申し送りを${wasEditing ? "更新" : "保存"}しました。`);
});

["#history-name-search", "#history-tag-search", "#history-importance-search"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", renderHistory);
});

document.querySelector("#history-patient-list").addEventListener("click", (event) => {
  const button = event.target.closest("[data-history-patient]");
  if (!button) return;
  selectedHistoryPatientId = button.dataset.historyPatient;
  renderHistory();
});

document.querySelector("#reset-sample").addEventListener("click", () => {
  if (!window.confirm("現在のデータをサンプルデータで置き換えますか？")) return;
  appData = createSampleData();
  saveData();
  setMessage("#management-message", "サンプルデータを初期化しました。");
});

document.querySelector("#export-json").addEventListener("click", () => {
  const exportData = { ...appData, exportedAt: new Date().toISOString() };
  const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json" });
  const link = document.createElement("a");
  link.href = URL.createObjectURL(blob);
  link.download = `dialysis-handover-demo-${formatDate(new Date())}.json`;
  link.click();
  URL.revokeObjectURL(link.href);
  setMessage("#management-message", "JSONファイルをエクスポートしました。");
});

document.querySelector("#import-json").addEventListener("change", async (event) => {
  const [file] = event.target.files;
  if (!file) return;
  try {
    appData = normalizeData(JSON.parse(await file.text()));
    saveData();
    setMessage("#management-message", "JSONファイルをインポートしました。");
  } catch (error) {
    setMessage("#management-message", `インポートできませんでした：${error.message}`, true);
  } finally {
    event.target.value = "";
  }
});

document.querySelector("#delete-all").addEventListener("click", () => {
  if (!window.confirm("全データを削除します。この操作は取り消せません。よろしいですか？")) return;
  appData = {
    schemaVersion: 4, exportedAt: null, updatedAt: new Date().toISOString(),
    settings: structuredClone(DEFAULT_SETTINGS), patients: [], records: []
  };
  saveData();
  setMessage("#management-message", "全データを削除しました。");
});

document.querySelectorAll("[data-settings-tab]").forEach((button) => {
  button.addEventListener("click", () => {
    activeSettingsTab = button.dataset.settingsTab;
    document.querySelectorAll("[data-settings-tab]").forEach((item) => {
      const active = item === button;
      item.classList.toggle("active", active);
      item.setAttribute("aria-selected", String(active));
    });
    renderSettingsEditor();
  });
});

document.querySelector("#save-master-settings").addEventListener("click", () => {
  const values = [...new Set(document.querySelector("#settings-list-editor").value
    .split("\n").map((value) => value.trim()).filter(Boolean))];
  if (!values.length) {
    setMessage("#settings-message", "1件以上入力してください。", true);
    return;
  }
  appData.settings[activeSettingsTab] = values;
  saveData();
  setMessage("#settings-message", "入力項目の設定を保存しました。");
});

document.querySelector("#record-date").value = formatDate(new Date());
renderAll();
