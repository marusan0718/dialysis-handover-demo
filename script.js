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

function formatDate(date) {
  const d = new Date(date);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
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
    schemaVersion: 3,
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
    schemaVersion: Math.max(Number(data.schemaVersion) || 1, 3),
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
    .sort((a, b) => new Date(b.recordedAt) - new Date(a.recordedAt));
}

function yesterdayString() {
  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  return formatDate(yesterday);
}

function morningTargetDates() {
  return new Set([yesterdayString(), formatDate(new Date())]);
}

function morningPatients() {
  const targetDates = morningTargetDates();
  const patientIds = new Set(
    appData.records
      .filter((record) => targetDates.has(formatDate(record.recordedAt)))
      .map((record) => record.patientId)
  );
  return appData.patients.filter((patient) => patientIds.has(patient.id));
}

function latestMorningRecord(patientId) {
  const targetDates = morningTargetDates();
  return recordsForPatient(patientId)
    .find((record) => targetDates.has(formatDate(record.recordedAt)));
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
  return `
    <article class="record-item ${escapeHtml(extraClass)}">
      <div class="record-meta">
        <span>${escapeHtml(formatDateTime(record.recordedAt))}</span>
        <span>${escapeHtml(record.dialysisType)}</span>
        ${showCategory ? `<span class="badge ${categoryClass(record.category)}">${escapeHtml(record.category)}</span>` : ""}
        <span class="badge ${IMPORTANT_LEVELS.includes(record.importance) ? "important" : ""}">重要度：${escapeHtml(record.importance)}</span>
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
  const previousRecords = allRecords.filter((record) => new Date(record.recordedAt) < new Date(latest.recordedAt));
  const previous = previousRecords[0];
  const olderRecords = previousRecords.slice(1);

  return `
    <article class="patient-card">
      <header class="patient-card-header ${categoryClass(latest.category)}">
        <h3>${escapeHtml(patientDisplayName(patient))}</h3>
        <div class="badge-row">
          <span class="badge">${escapeHtml(latest.dialysisType)}</span>
          <span class="badge ${categoryClass(latest.category)}">区分：${escapeHtml(latest.category)}</span>
          <span class="badge ${IMPORTANT_LEVELS.includes(latest.importance) ? "important" : ""}">重要度：${escapeHtml(latest.importance)}</span>
        </div>
      </header>
      <div class="patient-card-body">
        <section class="info-block latest-panel">
          <h4>前回の申し送り</h4>
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

function renderMorning() {
  const patients = filteredMorningPatients();
  morningIndex = Math.max(0, Math.min(morningIndex, patients.length - 1));
  document.querySelector("#target-count").textContent = String(morningPatients().length);
  document.querySelector("#current-position").textContent = patients.length
    ? `${morningIndex + 1} / ${patients.length}`
    : "0 / 0";

  const container = document.querySelector("#morning-card-container");
  if (!patients.length) {
    container.innerHTML = emptyState();
  } else if (morningListMode) {
    container.innerHTML = patients.map((patient) => renderPatientCard(patient)).join("");
  } else {
    container.innerHTML = renderPatientCard(patients[morningIndex]);
  }

  document.querySelector("#prev-patient").disabled = !patients.length || morningListMode;
  document.querySelector("#next-patient").disabled = !patients.length || morningListMode;
  document.querySelector("#toggle-list").textContent = morningListMode ? "1人表示に切り替え" : "一覧表示に切り替え";
  document.querySelector("#toggle-list").setAttribute("aria-pressed", String(morningListMode));
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

function findPatient(familyName, givenName) {
  return appData.patients.find((patient) => patient.familyName === familyName && patient.givenName === givenName);
}

function updatePatientHint() {
  const familyName = document.querySelector("#patient-family-name").value.trim();
  const givenName = document.querySelector("#patient-given-name").value.trim();
  const patient = findPatient(familyName, givenName);
  const hint = document.querySelector("#patient-name-hint");
  if (patient) {
    hint.textContent = `登録済み患者です。透析種別：${patient.dialysisType}`;
    const isPreset = appData.settings.dialysisTypes.includes(patient.dialysisType);
    document.querySelector("#dialysis-type").value = isPreset ? patient.dialysisType : "その他";
    document.querySelector("#dialysis-type-other").value = isPreset ? "" : patient.dialysisType;
    updateDialysisOtherVisibility();
  } else {
    hint.textContent = "未登録の患者名です。保存時に新規患者として登録されます。";
  }
}

function renderAll() {
  renderMorning();
  renderEntryOptions();
  renderHistory();
  renderSettings();
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
    document.querySelectorAll(".nav-button").forEach((item) => item.classList.remove("active"));
    document.querySelectorAll(".view").forEach((view) => view.classList.remove("active"));
    button.classList.add("active");
    document.querySelector(`#${button.dataset.view}-view`).classList.add("active");
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
  morningListMode = !morningListMode;
  renderMorning();
});

["#patient-family-name", "#patient-given-name"].forEach((selector) => {
  document.querySelector(selector).addEventListener("input", updatePatientHint);
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
  const familyName = String(form.get("patientFamilyName")).trim();
  const givenName = String(form.get("patientGivenName")).trim();
  const name = [familyName, givenName].filter(Boolean).join(" ");
  const dialysisType = selectedDialysisType(form);
  const content = contentFromEditor();
  const text = content.map((run) => run.text).join("");
  if (!familyName || !givenName || !dialysisType || !text) {
    setMessage("#save-message", "姓、名、透析種別、申し送り本文を入力してください。", true);
    return;
  }

  let patient = findPatient(familyName, givenName);
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

  appData.records.push({
    id: createId("r"),
    patientId: patient.id,
    recordedAt: new Date().toISOString(),
    dialysisType,
    category: String(form.get("category")),
    importance: String(form.get("importance")),
    tags: form.getAll("tags").map(String),
    text,
    content,
    textColor: "black",
    nextCheck: String(form.get("nextCheck")).trim(),
    addToOngoing: form.get("addOngoing") === "on"
  });

  saveData();
  event.currentTarget.reset();
  updateDialysisOtherVisibility();
  draftContent = [];
  renderDraftPreview();
  setMessage("#save-message", `${name} さんの申し送りを保存しました。`);
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
    schemaVersion: 3, exportedAt: null, updatedAt: new Date().toISOString(),
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

renderAll();
