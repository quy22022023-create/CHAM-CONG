"use strict";

// =====================================================
// OT PRO V7.4
// Giữ nguyên các bảng/cột Supabase hiện tại.
// Cài đặt mới được lưu riêng theo tài khoản trong localStorage.
// =====================================================

const APP_VERSION = "OT Pro V7.4 Settings";

const SB_URL =
  "https://dtdknettwfgilklaqeae.supabase.co";

const SB_KEY =
  "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZGtuZXR0d2ZnaWxrbGFxZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NzEzMTgsImV4cCI6MjA5MDI0NzMxOH0.qDvvZHNyNPh4QxpD6fDkR4Jr1xUnLSzCm79bsKI6ILk";

const supabaseClient =
  supabase.createClient(
    SB_URL,
    SB_KEY
  );

const NOTE_META_MARKER =
  "[[OTPRO_META]]";

const LEGACY_NOTE_META_MARKER =
  "[[OT_PRO_META]]";

const DEFAULT_MEAL_THRESHOLDS =
  Object.freeze([
    {
      time: "18:30",
      count: 1
    },
    {
      time: "20:30",
      count: 2
    }
  ]);

const appState = {
  currentUser:
    localStorage.getItem(
      "ot_user"
    ) || null,

  workLogs: [],

  extraShifts: [],

  extraTableAvailable: true,

  historyDate:
    new Date(),

  salaryDate:
    new Date(),

  mealDate:
    new Date(),

  historyView:
    "calendar",

  selectedDate:
    null,

  editingExtraId:
    null,

  loadingCount:
    0,

  settings:
    null
};

const $ =
  selector =>
    document.querySelector(
      selector
    );

const $$ =
  selector =>
    Array.from(
      document.querySelectorAll(
        selector
      )
    );


// =====================================================
// KHỞI TẠO
// =====================================================

document.addEventListener(
  "DOMContentLoaded",
  async () => {
    document.title =
      `⏱️ ${APP_VERSION}`;

    setText(
      "#authTitle",
      "OT Pro"
    );

    setText(
      "#appVersionDisplay",
      `Phiên bản: ${APP_VERSION}`
    );

    setText(
      "#menuVersionDisplay",
      `Phiên bản: ${APP_VERSION}`
    );

    setText(
      "#settingsVersion",
      APP_VERSION
    );

    loadSettings();

    applySettings();

    bindEvents();

    updateClock();

    window.setInterval(
      updateClock,
      1000
    );

    refreshIcons();

    registerServiceWorker();

    if (
      appState.currentUser
    ) {
      showApplication();

      await refreshData(
        true
      );
    } else {
      showAuthentication();
    }
  }
);


function bindEvents() {
  on(
    "#loginButton",
    "click",
    () =>
      handleAuth(
        "login"
      )
  );

  on(
    "#registerButton",
    "click",
    () =>
      handleAuth(
        "register"
      )
  );

  on(
    "#passwordToggle",
    "click",
    togglePassword
  );

  on(
    "#username",
    "keydown",
    event => {
      if (
        event.key ===
        "Enter"
      ) {
        $("#password")
          ?.focus();
      }
    }
  );

  on(
    "#password",
    "keydown",
    event => {
      if (
        event.key ===
        "Enter"
      ) {
        handleAuth(
          "login"
        );
      }
    }
  );

  on(
    "#logoutButton",
    "click",
    logout
  );

  on(
    "#settingsLogoutButton",
    "click",
    logout
  );

  on(
    "#menuButton",
    "click",
    openAppMenu
  );

  on(
    "#menuCloseButton",
    "click",
    closeAppMenu
  );

  on(
    "#menuBackdrop",
    "click",
    closeAppMenu
  );

  on(
    "#mainStartBtn",
    "click",
    startMainShift
  );

  on(
    "#mainEndBtn",
    "click",
    endMainShift
  );

  on(
    "#extraStartBtn",
    "click",
    startExtraShift
  );

  on(
    "#extraEndBtn",
    "click",
    endExtraShift
  );

  on(
    "#historyButton",
    "click",
    () => {
      closeAppMenu();

      openHistory(
        "calendar"
      );
    }
  );

  on(
    "#salaryButton",
    "click",
    () => {
      closeAppMenu();

      openSalary();
    }
  );

  on(
    "#mealButton",
    "click",
    () => {
      closeModal(
        "salaryModal"
      );

      openMeal();
    }
  );

  on(
    "#settingsButton",
    "click",
    openSettings
  );

  on(
    "#historyPrevMonth",
    "click",
    () =>
      changeHistoryMonth(
        -1
      )
  );

  on(
    "#historyNextMonth",
    "click",
    () =>
      changeHistoryMonth(
        1
      )
  );

  $$(
    "[data-history-view]"
  ).forEach(
    button => {
      button.addEventListener(
        "click",
        () => {
          setHistoryView(
            button.dataset
              .historyView
          );
        }
      );
    }
  );

  on(
    "#salaryPrevMonth",
    "click",
    () =>
      changeSalaryMonth(
        -1
      )
  );

  on(
    "#salaryNextMonth",
    "click",
    () =>
      changeSalaryMonth(
        1
      )
  );

  on(
    "#baseSalaryInput",
    "input",
    handleReportSalaryInput
  );

  on(
    "#mealPrevMonth",
    "click",
    () =>
      changeMealMonth(
        -1
      )
  );

  on(
    "#mealNextMonth",
    "click",
    () =>
      changeMealMonth(
        1
      )
  );

  on(
    "#mealPriceInput",
    "input",
    handleReportMealPriceInput
  );

  on(
    "#detailHasMainShift",
    "change",
    handleMainShiftToggle
  );

  on(
    "#detailStartTime",
    "input",
    calculateDetailMainOT
  );

  on(
    "#detailEndTime",
    "input",
    () => {
      calculateDetailMainOT();

      suggestMealCount(
        $("#detailEndTime")
          ?.value || ""
      );
    }
  );

  on(
    "#detailLunchChecked",
    "change",
    calculateDetailMainOT
  );

  on(
    "#detailMainOT",
    "input",
    renderDetailSummary
  );

  on(
    "#saveDayButton",
    "click",
    saveDayDetails
  );

  on(
    "#deleteDayButton",
    "click",
    deleteSelectedDay
  );

  on(
    "#saveExtraEditorButton",
    "click",
    saveExtraEditor
  );

  on(
    "#cancelExtraEditButton",
    "click",
    resetExtraEditor
  );

  $$(
    "[data-close-modal]"
  ).forEach(
    element => {
      element.addEventListener(
        "click",
        () => {
          closeModal(
            element.dataset
              .closeModal
          );
        }
      );
    }
  );

  bindSettingsEvents();

  document.addEventListener(
    "keydown",
    event => {
      if (
        event.key !==
        "Escape"
      ) {
        return;
      }

      if (
        $("#appMenu")
          ?.classList
          .contains(
            "show"
          )
      ) {
        closeAppMenu();

        return;
      }

      const openModals =
        $$(".modal.show");

      const topModal =
        openModals.at(
          -1
        );

      if (
        topModal?.id
      ) {
        closeModal(
          topModal.id
        );
      }
    }
  );
}


function bindSettingsEvents() {
  on(
    "#themeModeSelect",
    "change",
    event => {
      appState.settings
        .themeMode =
        event.target.value;

      saveSettings();

      applySettings();
    }
  );

  on(
    "#fontSizeSelect",
    "change",
    event => {
      appState.settings
        .fontSize =
        event.target.value;

      saveSettings();

      applySettings();
    }
  );

  on(
    "#showSecondsToggle",
    "change",
    event => {
      appState.settings
        .showSeconds =
        event.target.checked;

      saveSettings();

      updateClock();
    }
  );

  on(
    "#defaultShiftStart",
    "change",
    event => {
      if (
        !isValidTime(
          event.target.value
        )
      ) {
        syncSettingsUI();

        return;
      }

      appState.settings
        .defaultShiftStart =
        event.target.value;

      saveSettings();

      applySettings();

      refreshOpenDetailDefaults();
    }
  );

  on(
    "#defaultShiftEnd",
    "change",
    event => {
      if (
        !isValidTime(
          event.target.value
        )
      ) {
        syncSettingsUI();

        return;
      }

      appState.settings
        .defaultShiftEnd =
        event.target.value;

      saveSettings();

      applySettings();

      refreshOpenDetailDefaults();
    }
  );

  on(
    "#settingsBaseSalary",
    "input",
    event => {
      appState.settings
        .baseSalary =
        sanitizeNonNegativeNumber(
          event.target.value
        );

      saveSettings();

      syncSalaryInputs(
        "settings"
      );

      renderSalary();
    }
  );

  on(
    "#settingsOTMultiplier",
    "input",
    event => {
      appState.settings
        .otMultiplier =
        sanitizePositiveNumber(
          event.target.value,
          2
        );

      saveSettings();

      renderSalary();
    }
  );

  on(
    "#settingsMealPrice",
    "input",
    event => {
      appState.settings
        .mealPrice =
        sanitizeNonNegativeNumber(
          event.target.value
        );

      saveSettings();

      syncMealPriceInputs(
        "settings"
      );

      renderMeal();
    }
  );

  on(
    "#addMealThresholdButton",
    "click",
    addMealThreshold
  );

  on(
    "#resetMealThresholdsButton",
    "click",
    resetMealThresholds
  );

  on(
    "#checkConnectionButton",
    "click",
    checkSupabaseConnection
  );

  on(
    "#changePasswordButton",
    "click",
    changeCurrentPassword
  );

  on(
    "#mealThresholdList",
    "click",
    event => {
      const deleteButton =
        event.target.closest(
          "[data-delete-meal-threshold]"
        );

      if (
        !deleteButton
      ) {
        return;
      }

      deleteMealThreshold(
        deleteButton.closest(
          "[data-threshold-row]"
        )
      );
    }
  );

  on(
    "#mealThresholdList",
    "change",
    event => {
      if (
        event.target.matches(
          ".meal-threshold-time"
        ) ||
        event.target.matches(
          ".meal-threshold-count"
        )
      ) {
        commitMealThresholdsFromUI();
      }
    }
  );
}


function on(
  selector,
  eventName,
  handler
) {
  $(selector)
    ?.addEventListener(
      eventName,
      handler
    );
}


function setText(
  selector,
  value
) {
  const element =
    $(selector);

  if (
    element
  ) {
    element.textContent =
      value;
  }
}


function setValue(
  selector,
  value
) {
  const element =
    $(selector);

  if (
    element &&
    document.activeElement !==
      element
  ) {
    element.value =
      value;
  }
}


function setChecked(
  selector,
  checked
) {
  const element =
    $(selector);

  if (
    element
  ) {
    element.checked =
      Boolean(
        checked
      );
  }
}


function registerServiceWorker() {
  if (
    !(
      "serviceWorker" in
      navigator
    )
  ) {
    return;
  }

  window.addEventListener(
    "load",
    () => {
      navigator
        .serviceWorker
        .register(
          "./service-worker.js"
        )
        .catch(
          () => {
            // Ứng dụng vẫn hoạt động khi service worker chưa sẵn sàng.
          }
        );
    }
  );
}


function refreshIcons() {
  if (
    window.lucide
      ?.createIcons
  ) {
    window.lucide
      .createIcons();
  }
}


// =====================================================
// CÀI ĐẶT LOCALSTORAGE
// =====================================================

function getDefaultSettings() {
  return {
    themeMode:
      "system",

    fontSize:
      "medium",

    showSeconds:
      true,

    defaultShiftStart:
      "07:45",

    defaultShiftEnd:
      "17:00",

    baseSalary:
      0,

    otMultiplier:
      2,

    mealPrice:
      30000,

    mealThresholds:
      cloneDefaultMealThresholds()
  };
}


function cloneDefaultMealThresholds() {
  return DEFAULT_MEAL_THRESHOLDS
    .map(
      item => ({
        ...item
      })
    );
}


function getSettingsKey() {
  return (
    `ot_settings_${
      appState.currentUser ||
      "guest"
    }`
  );
}


function loadSettings() {
  const defaults =
    getDefaultSettings();

  let stored =
    {};

  try {
    stored =
      JSON.parse(
        localStorage.getItem(
          getSettingsKey()
        ) || "{}"
      ) || {};
  } catch {
    stored = {};
  }

  const legacySalary =
    appState.currentUser
      ? Number(
        localStorage.getItem(
          `salary_${appState.currentUser}`
        )
      )
      : 0;

  const legacyMealPrice =
    appState.currentUser
      ? Number(
        localStorage.getItem(
          `meal_price_${appState.currentUser}`
        )
      )
      : 0;

  appState.settings =
    sanitizeSettings({
      ...defaults,

      ...stored,

      baseSalary:
        stored.baseSalary ??
        (
          Number.isFinite(
            legacySalary
          ) &&
          legacySalary > 0
            ? legacySalary
            : defaults.baseSalary
        ),

      mealPrice:
        stored.mealPrice ??
        (
          Number.isFinite(
            legacyMealPrice
          ) &&
          legacyMealPrice > 0
            ? legacyMealPrice
            : defaults.mealPrice
        )
    });
}


function sanitizeSettings(
  value
) {
  const defaults =
    getDefaultSettings();

  const themeMode =
    [
      "system",
      "light",
      "dark"
    ].includes(
      value.themeMode
    )
      ? value.themeMode
      : defaults.themeMode;

  const fontSize =
    [
      "small",
      "medium",
      "large"
    ].includes(
      value.fontSize
    )
      ? value.fontSize
      : defaults.fontSize;

  return {
    themeMode,

    fontSize,

    showSeconds:
      value.showSeconds !==
      false,

    defaultShiftStart:
      isValidTime(
        value.defaultShiftStart
      )
        ? value.defaultShiftStart
        : defaults.defaultShiftStart,

    defaultShiftEnd:
      isValidTime(
        value.defaultShiftEnd
      )
        ? value.defaultShiftEnd
        : defaults.defaultShiftEnd,

    baseSalary:
      sanitizeNonNegativeNumber(
        value.baseSalary
      ),

    otMultiplier:
      sanitizePositiveNumber(
        value.otMultiplier,
        defaults.otMultiplier
      ),

    mealPrice:
      sanitizeNonNegativeNumber(
        value.mealPrice,
        defaults.mealPrice
      ),

    mealThresholds:
      sanitizeMealThresholds(
        value.mealThresholds
      )
  };
}


function saveSettings() {
  appState.settings =
    sanitizeSettings(
      appState.settings ||
      {}
    );

  localStorage.setItem(
    getSettingsKey(),
    JSON.stringify(
      appState.settings
    )
  );

  if (
    appState.currentUser
  ) {
    localStorage.setItem(
      `salary_${appState.currentUser}`,
      String(
        appState.settings
          .baseSalary
      )
    );

    localStorage.setItem(
      `meal_price_${appState.currentUser}`,
      String(
        appState.settings
          .mealPrice
      )
    );
  }
}


function applySettings() {
  const settings =
    appState.settings ||
    getDefaultSettings();

  const root =
    document.documentElement;

  if (
    settings.themeMode ===
    "system"
  ) {
    root.removeAttribute(
      "data-theme"
    );
  } else {
    root.dataset.theme =
      settings.themeMode;
  }

  root.dataset.fontSize =
    settings.fontSize;

  updateThemeColor(
    settings.themeMode
  );

  setText(
    "#mainShiftSchedule",
    `${settings.defaultShiftStart} – ${settings.defaultShiftEnd}`
  );

  syncSettingsUI();
}


function updateThemeColor(
  themeMode
) {
  const meta =
    $(
      'meta[name="theme-color"]'
    );

  if (
    !meta
  ) {
    return;
  }

  let dark =
    themeMode ===
    "dark";

  if (
    themeMode ===
    "system"
  ) {
    dark =
      window.matchMedia
        ?.(
          "(prefers-color-scheme: dark)"
        )
        .matches ||
      false;
  }

  meta.content =
    dark
      ? "#0d0f13"
      : "#f4f6f9";
}


function syncSettingsUI() {
  const settings =
    appState.settings ||
    getDefaultSettings();

  setValue(
    "#themeModeSelect",
    settings.themeMode
  );

  setValue(
    "#fontSizeSelect",
    settings.fontSize
  );

  setChecked(
    "#showSecondsToggle",
    settings.showSeconds
  );

  setValue(
    "#defaultShiftStart",
    settings.defaultShiftStart
  );

  setValue(
    "#defaultShiftEnd",
    settings.defaultShiftEnd
  );

  setValue(
    "#settingsBaseSalary",
    settings.baseSalary ||
    ""
  );

  setValue(
    "#settingsOTMultiplier",
    settings.otMultiplier
  );

  setValue(
    "#settingsMealPrice",
    settings.mealPrice
  );

  setText(
    "#settingsUsername",
    appState.currentUser ||
    "Người dùng"
  );

  setText(
    "#settingsVersion",
    APP_VERSION
  );

  renderMealThresholdSettings();

  syncSalaryInputs(
    "settings"
  );

  syncMealPriceInputs(
    "settings"
  );
}


function sanitizeNonNegativeNumber(
  value,
  fallback = 0
) {
  const number =
    Number(
      value
    );

  return (
    Number.isFinite(
      number
    ) &&
    number >= 0
      ? number
      : fallback
  );
}


function sanitizePositiveNumber(
  value,
  fallback = 1
) {
  const number =
    Number(
      value
    );

  return (
    Number.isFinite(
      number
    ) &&
    number > 0
      ? number
      : fallback
  );
}


function isValidTime(
  value
) {
  return (
    /^([01]\d|2[0-3]):[0-5]\d$/
      .test(
        String(
          value ||
          ""
        )
      )
  );
}


function sanitizeMealThresholds(
  thresholds
) {
  const source =
    Array.isArray(
      thresholds
    )
      ? thresholds
      : [];

  const unique =
    new Map();

  source.forEach(
    item => {
      const time =
        String(
          item?.time ||
          ""
        );

      const count =
        Math.floor(
          sanitizeNonNegativeNumber(
            item?.count
          )
        );

      if (
        isValidTime(
          time
        )
      ) {
        unique.set(
          time,
          {
            time,
            count
          }
        );
      }
    }
  );

  const result =
    Array.from(
      unique.values()
    ).sort(
      (
        a,
        b
      ) =>
        a.time.localeCompare(
          b.time
        )
    );

  return result.length
    ? result
    : cloneDefaultMealThresholds();
}


function renderMealThresholdSettings() {
  const container =
    $("#mealThresholdList");

  if (
    !container
  ) {
    return;
  }

  container.innerHTML =
    appState.settings
      .mealThresholds
      .map(
        item => `
          <div
            class="meal-threshold-row"
            data-threshold-row
          >
            <div class="input-shell threshold-time-input">
              <i data-lucide="clock-3"></i>

              <input
                type="time"
                class="meal-threshold-time"
                value="${escapeHTML(
                  item.time
                )}"
              >
            </div>

            <div class="input-shell threshold-count-input">
              <i data-lucide="utensils"></i>

              <input
                type="number"
                class="meal-threshold-count"
                min="0"
                step="1"
                inputmode="numeric"
                value="${item.count}"
              >

              <small>phần</small>
            </div>

            <button
              type="button"
              class="meal-threshold-delete"
              data-delete-meal-threshold
              aria-label="Xóa mốc phần cơm"
            >
              <i data-lucide="trash-2"></i>
            </button>
          </div>
        `
      )
      .join(
        ""
      );

  refreshIcons();
}


function readMealThresholdsFromUI() {
  return $$(
    "#mealThresholdList [data-threshold-row]"
  ).map(
    row => ({
      time:
        row.querySelector(
          ".meal-threshold-time"
        )?.value ||
        "",

      count:
        Math.floor(
          sanitizeNonNegativeNumber(
            row.querySelector(
              ".meal-threshold-count"
            )?.value
          )
        )
    })
  );
}


function commitMealThresholdsFromUI() {
  const rows =
    readMealThresholdsFromUI();

  const times =
    rows
      .map(
        item =>
          item.time
      )
      .filter(
        Boolean
      );

  if (
    rows.some(
      item =>
        !isValidTime(
          item.time
        )
    )
  ) {
    showToast(
      "Mốc phần cơm có giờ không hợp lệ.",
      true
    );

    renderMealThresholdSettings();

    return false;
  }

  if (
    new Set(
      times
    ).size !==
    times.length
  ) {
    showToast(
      "Không thể tạo hai mốc phần cơm trùng giờ.",
      true
    );

    renderMealThresholdSettings();

    return false;
  }

  appState.settings
    .mealThresholds =
    sanitizeMealThresholds(
      rows
    );

  saveSettings();

  renderMealThresholdSettings();

  return true;
}


function addMealThreshold() {
  if (
    !commitMealThresholdsFromUI()
  ) {
    return;
  }

  const thresholds =
    appState.settings
      .mealThresholds;

  const last =
    thresholds.at(
      -1
    ) || {
      time: "18:30",
      count: 0
    };

  let totalMinutes =
    timeToMinutes(
      last.time
    ) + 120;

  totalMinutes =
    Math.min(
      totalMinutes,
      23 * 60 + 59
    );

  let time =
    minutesToTime(
      totalMinutes
    );

  while (
    thresholds.some(
      item =>
        item.time ===
        time
    ) &&
    totalMinutes <
      23 * 60 + 59
  ) {
    totalMinutes +=
      1;

    time =
      minutesToTime(
        totalMinutes
      );
  }

  if (
    thresholds.some(
      item =>
        item.time ===
        time
    )
  ) {
    showToast(
      "Không thể thêm mốc mới vì đã hết khoảng giờ phù hợp.",
      true
    );

    return;
  }

  appState.settings
    .mealThresholds
    .push({
      time,

      count:
        last.count + 1
    });

  appState.settings
    .mealThresholds =
    sanitizeMealThresholds(
      appState.settings
        .mealThresholds
    );

  saveSettings();

  renderMealThresholdSettings();

  const lastInput =
    $$(
      "#mealThresholdList .meal-threshold-time"
    ).at(
      -1
    );

  lastInput
    ?.focus();

  lastInput
    ?.scrollIntoView({
      behavior:
        "smooth",

      block:
        "center"
    });
}


function deleteMealThreshold(
  row
) {
  const rows =
    $$(
      "#mealThresholdList [data-threshold-row]"
    );

  if (
    rows.length <=
    1
  ) {
    showToast(
      "Cần giữ lại ít nhất một mốc phần cơm.",
      true
    );

    return;
  }

  row?.remove();

  commitMealThresholdsFromUI();
}


function resetMealThresholds() {
  appState.settings
    .mealThresholds =
    cloneDefaultMealThresholds();

  saveSettings();

  renderMealThresholdSettings();

  showToast(
    "Đã khôi phục mốc phần cơm mặc định."
  );
}


function timeToMinutes(
  time
) {
  const [
    hour,
    minute
  ] =
    String(
      time
    )
      .split(
        ":"
      )
      .map(
        Number
      );

  return (
    hour * 60 +
    minute
  );
}


function minutesToTime(
  totalMinutes
) {
  const safe =
    Math.max(
      0,
      Math.min(
        23 * 60 + 59,
        totalMinutes
      )
    );

  return (
    `${pad(
      Math.floor(
        safe / 60
      )
    )}:` +
    `${pad(
      safe % 60
    )}`
  );
}


function getMealCountForEndTime(
  endTime
) {
  if (
    !isValidTime(
      endTime
    )
  ) {
    return 0;
  }

  const endMinutes =
    timeToMinutes(
      endTime
    );

  let count =
    0;

  appState.settings
    .mealThresholds
    .forEach(
      item => {
        if (
          endMinutes >=
          timeToMinutes(
            item.time
          )
        ) {
          count =
            item.count;
        }
      }
    );

  return count;
}


function refreshOpenDetailDefaults() {
  if (
    !appState.selectedDate
  ) {
    return;
  }

  const log =
    getWorkLog(
      appState.selectedDate
    );

  if (
    log?.start_time ||
    log?.end_time
  ) {
    return;
  }

  setValue(
    "#detailStartTime",
    appState.settings
      .defaultShiftStart
  );

  setValue(
    "#detailEndTime",
    appState.settings
      .defaultShiftEnd
  );

  calculateDetailMainOT();
}


// =====================================================
// ĐĂNG NHẬP
// =====================================================

function showAuthentication() {
  $("#authScreen")
    ?.classList
    .remove(
      "hidden"
    );

  $("#appShell")
    ?.classList
    .add(
      "hidden"
    );

  refreshIcons();
}


function showApplication() {
  $("#authScreen")
    ?.classList
    .add(
      "hidden"
    );

  $("#appShell")
    ?.classList
    .remove(
      "hidden"
    );

  setText(
    "#greetingName",
    appState.currentUser
  );

  setText(
    "#displayUser",
    `User: ${appState.currentUser}`
  );

  setText(
    "#menuUserName",
    appState.currentUser
  );

  setText(
    "#settingsUsername",
    appState.currentUser
  );

  setText(
    "#appVersionDisplay",
    `Phiên bản: ${APP_VERSION}`
  );

  setText(
    "#menuVersionDisplay",
    `Phiên bản: ${APP_VERSION}`
  );

  setText(
    "#settingsVersion",
    APP_VERSION
  );

  refreshIcons();
}


async function handleAuth(
  type
) {
  const username =
    $("#username")
      ?.value
      .trim() ||
    "";

  const password =
    $("#password")
      ?.value
      .trim() ||
    "";

  if (
    !username ||
    !password
  ) {
    showToast(
      "Vui lòng nhập đủ tài khoản và mật khẩu.",
      true
    );

    return;
  }

  setLoading(
    true
  );

  try {
    if (
      type ===
      "register"
    ) {
      const {
        error
      } =
        await supabaseClient
          .from(
            "users"
          )
          .insert({
            username,
            password
          });

      if (
        error
      ) {
        throw error;
      }

      showToast(
        "Đăng ký thành công. Bạn có thể đăng nhập."
      );

      return;
    }

    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "users"
        )
        .select(
          "*"
        )
        .eq(
          "username",
          username
        )
        .eq(
          "password",
          password
        )
        .limit(
          1
        )
        .maybeSingle();

    if (
      error ||
      !data
    ) {
      throw new Error(
        "Sai tài khoản hoặc mật khẩu."
      );
    }

    appState.currentUser =
      username;

    localStorage.setItem(
      "ot_user",
      username
    );

    loadSettings();

    applySettings();

    showApplication();

    await refreshData();

    showToast(
      "Đăng nhập thành công."
    );
  } catch (
    error
  ) {
    showToast(
      type ===
        "register"
        ? "Tên đăng nhập đã tồn tại hoặc không thể đăng ký."
        : (
          error.message ||
          "Không thể đăng nhập."
        ),
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


function togglePassword() {
  const input =
    $("#password");

  const button =
    $("#passwordToggle");

  if (
    !input ||
    !button
  ) {
    return;
  }

  const visible =
    input.type ===
    "text";

  input.type =
    visible
      ? "password"
      : "text";

  button.innerHTML =
    `<i data-lucide="${
      visible
        ? "eye"
        : "eye-off"
    }"></i>`;

  button.setAttribute(
    "aria-label",
    visible
      ? "Hiện mật khẩu"
      : "Ẩn mật khẩu"
  );

  refreshIcons();
}


function logout() {
  localStorage.removeItem(
    "ot_user"
  );

  location.reload();
}


async function changeCurrentPassword() {
  const currentPassword =
    $("#currentPasswordInput")
      ?.value ||
    "";

  const newPassword =
    $("#newPasswordInput")
      ?.value ||
    "";

  const confirmation =
    $("#confirmNewPasswordInput")
      ?.value ||
    "";

  if (
    !currentPassword ||
    !newPassword ||
    !confirmation
  ) {
    showToast(
      "Vui lòng nhập đủ ba ô mật khẩu.",
      true
    );

    return;
  }

  if (
    newPassword.length <
    4
  ) {
    showToast(
      "Mật khẩu mới cần ít nhất 4 ký tự.",
      true
    );

    return;
  }

  if (
    newPassword !==
    confirmation
  ) {
    showToast(
      "Mật khẩu mới nhập lại chưa khớp.",
      true
    );

    return;
  }

  if (
    newPassword ===
    currentPassword
  ) {
    showToast(
      "Mật khẩu mới phải khác mật khẩu hiện tại.",
      true
    );

    return;
  }

  setLoading(
    true
  );

  try {
    const {
      data,
      error
    } =
      await supabaseClient
        .from(
          "users"
        )
        .select(
          "username,password"
        )
        .eq(
          "username",
          appState.currentUser
        )
        .eq(
          "password",
          currentPassword
        )
        .limit(
          1
        )
        .maybeSingle();

    if (
      error
    ) {
      throw error;
    }

    if (
      !data
    ) {
      throw new Error(
        "Mật khẩu hiện tại không đúng."
      );
    }

    let query =
      supabaseClient
        .from(
          "users"
        )
        .update({
          password:
            newPassword
        });

    query =
      data.id != null
        ? query.eq(
          "id",
          data.id
        )
        : query
          .eq(
            "username",
            appState.currentUser
          )
          .eq(
            "password",
            currentPassword
          );

    const {
      error:
        updateError
    } =
      await query;

    if (
      updateError
    ) {
      throw updateError;
    }

    [
      "#currentPasswordInput",
      "#newPasswordInput",
      "#confirmNewPasswordInput"
    ].forEach(
      selector =>
        setValue(
          selector,
          ""
        )
    );

    showToast(
      "Đã cập nhật mật khẩu."
    );
  } catch (
    error
  ) {
    showToast(
      error.message ||
      "Không thể đổi mật khẩu.",
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


// =====================================================
// TẢI DATABASE
// =====================================================

async function refreshData(
  showLoader = false
) {
  if (
    !appState.currentUser
  ) {
    return;
  }

  if (
    showLoader
  ) {
    setLoading(
      true
    );
  }

  try {
    const workResult =
      await supabaseClient
        .from(
          "work_logs"
        )
        .select(
          "*"
        )
        .eq(
          "username",
          appState.currentUser
        )
        .order(
          "work_date",
          {
            ascending:
              false
          }
        );

    if (
      workResult.error
    ) {
      throw workResult.error;
    }

    appState.workLogs =
      workResult.data ||
      [];

    const extraResult =
      await supabaseClient
        .from(
          "extra_shifts"
        )
        .select(
          "*"
        )
        .eq(
          "username",
          appState.currentUser
        )
        .order(
          "start_at",
          {
            ascending:
              false
          }
        );

    if (
      extraResult.error
    ) {
      appState.extraTableAvailable =
        false;

      appState.extraShifts =
        [];

      console.warn(
        "extra_shifts chưa sẵn sàng:",
        extraResult.error
          .message
      );
    } else {
      appState.extraTableAvailable =
        true;

      appState.extraShifts =
        extraResult.data ||
        [];
    }

    renderDashboard();

    if (
      $("#historyModal")
        ?.classList
        .contains(
          "show"
        )
    ) {
      renderHistory();
    }

    if (
      $("#salaryModal")
        ?.classList
        .contains(
          "show"
        )
    ) {
      renderSalary();
    }

    if (
      $("#mealModal")
        ?.classList
        .contains(
          "show"
        )
    ) {
      renderMeal();
    }

    if (
      $("#dayDetailModal")
        ?.classList
        .contains(
          "show"
        ) &&
      appState.selectedDate
    ) {
      renderDayDetail(
        false
      );
    }
  } catch (
    error
  ) {
    showToast(
      `Lỗi tải dữ liệu: ${
        error.message ||
        "Không xác định"
      }`,
      true
    );
  } finally {
    if (
      showLoader
    ) {
      setLoading(
        false
      );
    }
  }
}


async function checkSupabaseConnection() {
  setConnectionStatus(
    "checking",
    "Đang kiểm tra",
    "Đang kiểm tra quyền đọc dữ liệu...",
    "loader-circle"
  );

  try {
    const usersResult =
      await supabaseClient
        .from(
          "users"
        )
        .select(
          "username"
        )
        .limit(
          1
        );

    if (
      usersResult.error
    ) {
      throw usersResult.error;
    }

    const workResult =
      await supabaseClient
        .from(
          "work_logs"
        )
        .select(
          "work_date"
        )
        .eq(
          "username",
          appState.currentUser
        )
        .limit(
          1
        );

    if (
      workResult.error
    ) {
      throw workResult.error;
    }

    const extraResult =
      await supabaseClient
        .from(
          "extra_shifts"
        )
        .select(
          "id"
        )
        .eq(
          "username",
          appState.currentUser
        )
        .limit(
          1
        );

    if (
      extraResult.error
    ) {
      throw extraResult.error;
    }

    setConnectionStatus(
      "success",
      "Đã kết nối",
      "Đọc được users, work_logs và extra_shifts.",
      "circle-check"
    );
  } catch (
    error
  ) {
    const message =
      String(
        error.message ||
        ""
      ).toLowerCase();

    const code =
      String(
        error.code ||
        ""
      );

    let title =
      "Không thể kết nối";

    let detail =
      error.message ||
      "Không xác định được lỗi kết nối.";

    if (
      code ===
      "42501" ||
      message.includes(
        "row-level security"
      ) ||
      message.includes(
        "permission"
      )
    ) {
      title =
        "Không có quyền đọc dữ liệu";

      detail =
        "Hãy kiểm tra RLS và quyền SELECT cho vai trò anon.";
    } else if (
      code ===
      "42P01" ||
      code ===
      "PGRST205" ||
      (
        message.includes(
          "extra_shifts"
        ) &&
        message.includes(
          "not found"
        )
      )
    ) {
      title =
        "Không có bảng extra_shifts";

      detail =
        "Bảng ca thêm chưa tồn tại hoặc chưa được Data API nhận diện.";
    }

    setConnectionStatus(
      "error",
      title,
      detail,
      "circle-alert"
    );
  }
}


function setConnectionStatus(
  state,
  title,
  detail,
  icon
) {
  const iconBox =
    $("#connectionStatusIcon");

  if (
    iconBox
  ) {
    iconBox.className =
      `connection-status-icon ${state}`;

    iconBox.innerHTML =
      `<i data-lucide="${icon}"></i>`;
  }

  setText(
    "#connectionStatus",
    title
  );

  setText(
    "#connectionStatusDetail",
    detail
  );

  refreshIcons();
}


// =====================================================
// METADATA TRONG NOTE
// =====================================================

function parseStoredNote(
  rawNote = ""
) {
  let visibleNote =
    String(
      rawNote ||
      ""
    );

  let meta =
    {};

  let selectedMarker =
    null;

  let markerIndex =
    -1;

  [
    NOTE_META_MARKER,
    LEGACY_NOTE_META_MARKER
  ].forEach(
    marker => {
      const index =
        visibleNote
          .lastIndexOf(
            marker
          );

      if (
        index >
        markerIndex
      ) {
        markerIndex =
          index;

        selectedMarker =
          marker;
      }
    }
  );

  if (
    selectedMarker &&
    markerIndex >=
    0
  ) {
    const jsonText =
      visibleNote
        .slice(
          markerIndex +
          selectedMarker.length
        )
        .trim();

    visibleNote =
      visibleNote
        .slice(
          0,
          markerIndex
        )
        .trim();

    try {
      meta =
        JSON.parse(
          jsonText
        ) || {};
    } catch {
      meta = {};
    }
  }

  return {
    visibleNote,

    meta: {
      ...meta,

      lunchChecked:
        Boolean(
          meta.lunchChecked
        ),

      carryOT:
        Number.isFinite(
          Number(
            meta.carryOT
          )
        )
          ? Math.max(
            0,
            Number(
              meta.carryOT
            )
          )
          : 0
    }
  };
}


function buildStoredNote(
  visibleNote,
  meta = {}
) {
  const cleanNote =
    String(
      visibleNote ||
      ""
    ).trim();

  const payload = {
    version: 1,

    lunchChecked:
      Boolean(
        meta.lunchChecked
      )
  };

  if (
    Number.isFinite(
      Number(
        meta.carryOT
      )
    ) &&
    Number(
      meta.carryOT
    ) > 0
  ) {
    payload.carryOT =
      roundHours(
        meta.carryOT
      );
  }

  const metadata =
    NOTE_META_MARKER +
    JSON.stringify(
      payload
    );

  return cleanNote
    ? `${cleanNote}\n\n${metadata}`
    : metadata;
}


function getLogVisibleNote(
  log
) {
  return parseStoredNote(
    log?.note ||
    ""
  ).visibleNote;
}


function getLogLunchChecked(
  log
) {
  return parseStoredNote(
    log?.note ||
    ""
  ).meta.lunchChecked;
}


// =====================================================
// NGÀY GIỜ + FORMAT
// =====================================================

function pad(
  value
) {
  return String(
    value
  ).padStart(
    2,
    "0"
  );
}


function getDateKey(
  date = new Date()
) {
  return (
    `${date.getFullYear()}-` +
    `${pad(
      date.getMonth() + 1
    )}-` +
    `${pad(
      date.getDate()
    )}`
  );
}


function parseDateKey(
  dateKey
) {
  const [
    year,
    month,
    day
  ] =
    String(
      dateKey
    )
      .split(
        "-"
      )
      .map(
        Number
      );

  return new Date(
    year,
    month - 1,
    day
  );
}


function getTimeValue(
  date = new Date()
) {
  return (
    `${pad(
      date.getHours()
    )}:` +
    `${pad(
      date.getMinutes()
    )}`
  );
}


function normalizeDateToMinute(
  date = new Date()
) {
  const normalized =
    new Date(
      date
    );

  normalized.setSeconds(
    0,
    0
  );

  return normalized;
}


function getLocalDateTime(
  dateKey,
  timeValue
) {
  const date =
    parseDateKey(
      dateKey
    );

  const [
    hour,
    minute
  ] =
    String(
      timeValue
    )
      .split(
        ":"
      )
      .map(
        Number
      );

  date.setHours(
    hour,
    minute,
    0,
    0
  );

  return date;
}


function combineExtraDateTime(
  dateKey,
  startTime,
  endTime
) {
  const start =
    getLocalDateTime(
      dateKey,
      startTime
    );

  const end =
    getLocalDateTime(
      dateKey,
      endTime
    );

  if (
    end <=
    start
  ) {
    end.setDate(
      end.getDate() +
      1
    );
  }

  return {
    start,
    end
  };
}


function isSunday(
  dateKey
) {
  return (
    parseDateKey(
      dateKey
    ).getDay() ===
    0
  );
}


function formatDisplayDate(
  dateKey
) {
  return parseDateKey(
    dateKey
  ).toLocaleDateString(
    "vi-VN",
    {
      weekday:
        "long",

      day:
        "2-digit",

      month:
        "2-digit",

      year:
        "numeric"
    }
  );
}


function formatShortDate(
  dateKey
) {
  return parseDateKey(
    dateKey
  ).toLocaleDateString(
    "vi-VN",
    {
      day:
        "2-digit",

      month:
        "2-digit"
    }
  );
}


function formatTimeFromISO(
  isoValue
) {
  return isoValue
    ? getTimeValue(
      new Date(
        isoValue
      )
    )
    : "";
}


function roundHours(
  value
) {
  const number =
    Number(
      value
    );

  if (
    !Number.isFinite(
      number
    )
  ) {
    return 0;
  }

  return (
    Math.round(
      (
        number +
        Number.EPSILON
      ) *
      100
    ) /
    100
  );
}


function formatHours(
  value
) {
  return (
    roundHours(
      value
    ).toLocaleString(
      "vi-VN",
      {
        minimumFractionDigits:
          0,

        maximumFractionDigits:
          2
      }
    ) +
    "h"
  );
}


function formatMoney(
  value
) {
  return (
    new Intl.NumberFormat(
      "vi-VN"
    ).format(
      Math.round(
        Number(
          value
        ) ||
        0
      )
    ) +
    "đ"
  );
}


function formatElapsed(
  milliseconds
) {
  const totalSeconds =
    Math.floor(
      Math.max(
        0,
        milliseconds
      ) /
      1000
    );

  const hours =
    Math.floor(
      totalSeconds /
      3600
    );

  const minutes =
    Math.floor(
      (
        totalSeconds %
        3600
      ) /
      60
    );

  const seconds =
    totalSeconds %
    60;

  return (
    `${pad(
      hours
    )}:` +
    `${pad(
      minutes
    )}:` +
    `${pad(
      seconds
    )}`
  );
}


// =====================================================
// CÔNG THỨC
// =====================================================

function calculateDurationHours(
  startDate,
  endDate
) {
  return roundHours(
    (
      endDate.getTime() -
      startDate.getTime()
    ) /
    3600000
  );
}


function calculateMainOT(
  startTime,
  endTime,
  lunchChecked,
  dateKey
) {
  if (
    !startTime ||
    !endTime
  ) {
    return 0;
  }

  const baseDate =
    "2024-01-01";

  const actualStart =
    new Date(
      `${baseDate}T${startTime}:00`
    );

  const actualEnd =
    new Date(
      `${baseDate}T${endTime}:00`
    );

  if (
    Number.isNaN(
      actualStart.getTime()
    ) ||
    Number.isNaN(
      actualEnd.getTime()
    )
  ) {
    return 0;
  }

  if (
    actualEnd <
    actualStart
  ) {
    actualEnd.setDate(
      actualEnd.getDate() +
      1
    );
  }

  if (
    !isSunday(
      dateKey
    )
  ) {
    const normalStart =
      new Date(
        `${baseDate}T${appState.settings.defaultShiftStart}:00`
      );

    const normalEnd =
      new Date(
        `${baseDate}T${appState.settings.defaultShiftEnd}:00`
      );

    if (
      normalEnd <=
      normalStart
    ) {
      normalEnd.setDate(
        normalEnd.getDate() +
        1
      );
    }

    let overtimeMinutes =
      0;

    if (
      actualStart <
      normalStart
    ) {
      const morningEnd =
        actualEnd <
        normalStart
          ? actualEnd
          : normalStart;

      overtimeMinutes +=
        Math.max(
          0,
          morningEnd.getTime() -
          actualStart.getTime()
        ) /
        60000;
    }

    const eveningStart =
      actualStart >
      normalEnd
        ? actualStart
        : normalEnd;

    if (
      actualEnd >
      eveningStart
    ) {
      overtimeMinutes +=
        (
          actualEnd.getTime() -
          eveningStart.getTime()
        ) /
        60000;
    }

    return roundHours(
      overtimeMinutes /
      60 +
      (
        lunchChecked
          ? 1
          : 0
      )
    );
  }

  const totalMinutes =
    (
      actualEnd.getTime() -
      actualStart.getTime()
    ) /
    60000;

  const netMinutes =
    totalMinutes -
    (
      lunchChecked
        ? 60
        : 0
    );

  return roundHours(
    Math.max(
      0,
      netMinutes
    ) /
    60
  );
}


// =====================================================
// ĐỌC DỮ LIỆU TRONG BỘ NHỚ
// =====================================================

function getWorkLog(
  dateKey
) {
  return (
    appState.workLogs
      .find(
        item =>
          item.work_date ===
          dateKey
      ) ||
    null
  );
}


function getExtraShifts(
  dateKey
) {
  if (
    !appState.extraTableAvailable
  ) {
    return [];
  }

  return appState.extraShifts
    .filter(
      item =>
        item.work_date ===
        dateKey
    );
}


function getCompletedExtraShifts(
  dateKey
) {
  return getExtraShifts(
    dateKey
  ).filter(
    item =>
      item.status ===
      "completed" &&
      item.end_at
  );
}


function getExtraTotal(
  dateKey
) {
  return roundHours(
    getCompletedExtraShifts(
      dateKey
    ).reduce(
      (
        total,
        item
      ) =>
        total +
        (
          Number(
            item.duration_hours
          ) ||
          0
        ),
      0
    )
  );
}


function getStoredTotalOT(
  dateKey
) {
  const log =
    getWorkLog(
      dateKey
    );

  return log
    ? roundHours(
      Number(
        log.overtime
      ) ||
      0
    )
    : getExtraTotal(
      dateKey
    );
}


function getBaseOT(
  dateKey
) {
  return roundHours(
    Math.max(
      0,
      getStoredTotalOT(
        dateKey
      ) -
      getExtraTotal(
        dateKey
      )
    )
  );
}


function getActiveExtraShift() {
  if (
    !appState.extraTableAvailable
  ) {
    return null;
  }

  return (
    appState.extraShifts
      .find(
        item =>
          item.status ===
          "working" &&
          !item.end_at
      ) ||
    null
  );
}


function getLatestCompletedExtraShift(
  dateKey
) {
  return (
    getCompletedExtraShifts(
      dateKey
    )
      .slice()
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            b.end_at ||
            b.start_at
          ).getTime() -
          new Date(
            a.end_at ||
            a.start_at
          ).getTime()
      )[0] ||
    null
  );
}


function getExtraShiftForEnd(
  now = new Date()
) {
  const active =
    getActiveExtraShift();

  if (
    active
  ) {
    return active;
  }

  const today =
    getDateKey(
      now
    );

  return (
    appState.extraShifts
      .filter(
        item =>
          item.status ===
          "completed" &&
          item.end_at
      )
      .sort(
        (
          a,
          b
        ) =>
          new Date(
            b.end_at
          ) -
          new Date(
            a.end_at
          )
      )
      .find(
        item =>
          item.work_date ===
          today ||
          getDateKey(
            new Date(
              item.end_at
            )
          ) ===
          today
      ) ||
    null
  );
}


function getActiveMainShift() {
  return (
    appState.workLogs
      .find(
        item =>
          item.start_time &&
          !item.end_time
      ) ||
    null
  );
}


function hasMainShift(
  log,
  dateKey =
    log?.work_date
) {
  return Boolean(
    log &&
    (
      log.start_time ||
      log.end_time ||
      getBaseOT(
        dateKey
      ) > 0
    )
  );
}


function getMonthTotal(
  monthKey
) {
  const dates =
    new Set();

  appState.workLogs
    .forEach(
      item => {
        if (
          item.work_date
            .startsWith(
              monthKey
            )
        ) {
          dates.add(
            item.work_date
          );
        }
      }
    );

  if (
    appState.extraTableAvailable
  ) {
    appState.extraShifts
      .forEach(
        item => {
          if (
            item.work_date
              .startsWith(
                monthKey
              )
          ) {
            dates.add(
              item.work_date
            );
          }
        }
      );
  }

  return roundHours(
    Array.from(
      dates
    ).reduce(
      (
        total,
        dateKey
      ) =>
        total +
        getStoredTotalOT(
          dateKey
        ),
      0
    )
  );
}


// =====================================================
// GHI WORK_LOGS + ĐỒNG BỘ EXTRA
// =====================================================

async function saveWorkLog(
  dateKey,
  changes = {}
) {
  const existing =
    getWorkLog(
      dateKey
    );

  if (
    existing
  ) {
    const {
      error
    } =
      await supabaseClient
        .from(
          "work_logs"
        )
        .update(
          changes
        )
        .eq(
          "username",
          appState.currentUser
        )
        .eq(
          "work_date",
          dateKey
        );

    if (
      error
    ) {
      throw error;
    }

    return;
  }

  const {
    error
  } =
    await supabaseClient
      .from(
        "work_logs"
      )
      .insert({
        username:
          appState.currentUser,

        work_date:
          dateKey,

        start_time:
          null,

        end_time:
          null,

        overtime:
          0,

        meal_count:
          0,

        note:
          "",

        ...changes
      });

  if (
    error
  ) {
    throw error;
  }
}


async function queryExtraTotalFromDatabase(
  dateKey
) {
  if (
    !appState.extraTableAvailable
  ) {
    return 0;
  }

  const {
    data,
    error
  } =
    await supabaseClient
      .from(
        "extra_shifts"
      )
      .select(
        "duration_hours,status,end_at"
      )
      .eq(
        "username",
        appState.currentUser
      )
      .eq(
        "work_date",
        dateKey
      );

  if (
    error
  ) {
    throw error;
  }

  return roundHours(
    (
      data ||
      []
    )
      .filter(
        item =>
          item.status ===
          "completed" &&
          item.end_at
      )
      .reduce(
        (
          total,
          item
        ) =>
          total +
          (
            Number(
              item.duration_hours
            ) ||
            0
          ),
        0
      )
  );
}


async function syncDayAfterExtraChange(
  dateKey,
  preservedBaseOT
) {
  const extraTotal =
    await queryExtraTotalFromDatabase(
      dateKey
    );

  await saveWorkLog(
    dateKey,
    {
      overtime:
        roundHours(
          Math.max(
            0,
            preservedBaseOT
          ) +
          extraTotal
        )
    }
  );
}


// =====================================================
// ĐỒNG HỒ + DASHBOARD
// =====================================================

function updateClock() {
  const now =
    new Date();

  const options =
    appState.settings
      ?.showSeconds
      ? {
        hour12:
          false
      }
      : {
        hour:
          "2-digit",

        minute:
          "2-digit",

        hour12:
          false
      };

  setText(
    "#currentTime",
    now.toLocaleTimeString(
      "vi-VN",
      options
    )
  );

  setText(
    "#currentDate",
    now.toLocaleDateString(
      "vi-VN",
      {
        weekday:
          "long",

        day:
          "numeric",

        month:
          "long",

        year:
          "numeric"
      }
    )
  );

  updateLiveTimers(
    now
  );
}


function updateLiveTimers(
  now
) {
  const activeMain =
    getActiveMainShift();

  const activeExtra =
    getActiveExtraShift();

  if (
    activeMain &&
    $("#mainElapsed")
  ) {
    const start =
      getLocalDateTime(
        activeMain.work_date,
        activeMain.start_time
      );

    $("#mainElapsed")
      .textContent =
      formatElapsed(
        now.getTime() -
        start.getTime()
      );
  }

  if (
    activeExtra &&
    $("#extraElapsed")
  ) {
    const start =
      new Date(
        activeExtra.start_at
      );

    $("#extraElapsed")
      .textContent =
      formatElapsed(
        now.getTime() -
        start.getTime()
      );
  }
}


function renderDashboard() {
  const today =
    getDateKey();

  const todayLog =
    getWorkLog(
      today
    );

  const activeMain =
    getActiveMainShift();

  const activeExtra =
    getActiveExtraShift();

  const todayExtras =
    getCompletedExtraShifts(
      today
    );

  setText(
    "#todayOT",
    formatHours(
      getStoredTotalOT(
        today
      )
    )
  );

  setText(
    "#monthlyOT",
    formatHours(
      getMonthTotal(
        today.slice(
          0,
          7
        )
      )
    )
  );

  setText(
    "#todayMainOT",
    formatHours(
      getBaseOT(
        today
      )
    )
  );

  setText(
    "#todayExtraOT",
    formatHours(
      getExtraTotal(
        today
      )
    )
  );

  setText(
    "#todayExtraCount",
    appState.extraTableAvailable
      ? `${todayExtras.length} ca đã hoàn tất`
      : "Chưa cấu hình bảng ca thêm"
  );

  renderMainShiftCard(
    todayLog,
    activeMain
  );

  renderExtraShiftCard(
    todayExtras,
    activeExtra
  );

  const statuses =
    [];

  if (
    activeMain
  ) {
    statuses.push(
      "Ca chính đang chạy"
    );
  }

  if (
    activeExtra
  ) {
    statuses.push(
      "Ca thêm đang chạy"
    );
  }

  setText(
    "#overallStatus",
    statuses.length
      ? statuses.join(
        " • "
      )
      : "Chưa có ca đang chạy"
  );

  setText(
    "#lunchLabelMain",
    isSunday(
      today
    )
      ? "Nghỉ trưa 1 giờ"
      : "Tăng ca trưa +1 giờ"
  );

  setChecked(
    "#lunchCheckMain",
    getLogLunchChecked(
      todayLog
    )
  );

  setText(
    "#mainShiftSchedule",
    `${appState.settings.defaultShiftStart} – ${appState.settings.defaultShiftEnd}`
  );

  refreshIcons();
}


function renderMainShiftCard(
  todayLog,
  activeMain
) {
  const badge =
    $("#mainShiftBadge");

  const info =
    $("#mainShiftInfo");

  const timer =
    $("#mainElapsed");

  const startButton =
    $("#mainStartBtn");

  const endButton =
    $("#mainEndBtn");

  if (
    !badge ||
    !info ||
    !timer ||
    !startButton ||
    !endButton
  ) {
    return;
  }

  badge.className =
    "status-badge neutral";

  timer.textContent =
    "00:00:00";

  endButton.disabled =
    false;

  if (
    activeMain
  ) {
    badge.textContent =
      "Đang làm";

    badge.className =
      "status-badge working";

    info.textContent =
      `Bắt đầu lúc ${activeMain.start_time}`;

    startButton.disabled =
      true;

    return;
  }

  if (
    todayLog?.start_time &&
    todayLog?.end_time
  ) {
    badge.textContent =
      "Đã hoàn tất";

    badge.className =
      "status-badge completed";

    info.textContent =
      `${todayLog.start_time} → ${todayLog.end_time} • Có thể cập nhật`;

    timer.textContent =
      formatHours(
        getBaseOT(
          todayLog.work_date
        )
      );

    startButton.disabled =
      true;

    return;
  }

  badge.textContent =
    "Chưa bắt đầu";

  info.textContent =
    "Bấm Tan ca nếu quên Vào ca";

  startButton.disabled =
    false;
}


function renderExtraShiftCard(
  todayExtras,
  activeExtra
) {
  const badge =
    $("#extraShiftBadge");

  const info =
    $("#extraShiftInfo");

  const timer =
    $("#extraElapsed");

  const startButton =
    $("#extraStartBtn");

  const endButton =
    $("#extraEndBtn");

  if (
    !badge ||
    !info ||
    !timer ||
    !startButton ||
    !endButton
  ) {
    return;
  }

  timer.textContent =
    "00:00:00";

  if (
    !appState.extraTableAvailable
  ) {
    badge.textContent =
      "Chưa kết nối";

    badge.className =
      "status-badge neutral";

    info.textContent =
      "Cần kiểm tra bảng extra_shifts";

    startButton.disabled =
      true;

    endButton.disabled =
      true;

    return;
  }

  endButton.disabled =
    false;

  if (
    activeExtra
  ) {
    badge.textContent =
      "Đang làm";

    badge.className =
      "status-badge working";

    info.textContent =
      `${formatTimeFromISO(
        activeExtra.start_at
      )} → Đang làm`;

    startButton.disabled =
      true;

    return;
  }

  const latest =
    getLatestCompletedExtraShift(
      getDateKey()
    );

  badge.textContent =
    todayExtras.length
      ? `${todayExtras.length} ca hôm nay`
      : "Sẵn sàng";

  badge.className =
    todayExtras.length
      ? "status-badge extra"
      : "status-badge neutral";

  startButton.disabled =
    false;

  if (
    latest
  ) {
    info.textContent =
      `${formatTimeFromISO(
        latest.start_at
      )} → ${formatTimeFromISO(
        latest.end_at
      )} • Có thể cập nhật`;

    timer.textContent =
      formatHours(
        getExtraTotal(
          getDateKey()
        )
      );
  } else {
    info.textContent =
      "Bấm Vào ca để bắt đầu ca thêm";
  }
}


// =====================================================
// CA CHÍNH
// =====================================================

async function startMainShift() {
  const activeMain =
    getActiveMainShift();

  const today =
    getDateKey();

  const todayLog =
    getWorkLog(
      today
    );

  if (
    activeMain
  ) {
    showToast(
      "Bạn đang có một ca chính chưa kết thúc.",
      true
    );

    return;
  }

  if (
    todayLog?.start_time &&
    todayLog?.end_time
  ) {
    showToast(
      "Ca chính đã hoàn tất. Bấm Tan ca để cập nhật giờ kết thúc.",
      true
    );

    return;
  }

  const startTime =
    getTimeValue();

  const visibleNote =
    getLogVisibleNote(
      todayLog
    );

  const carryOT =
    todayLog &&
    !todayLog.start_time &&
    !todayLog.end_time
      ? getBaseOT(
        today
      )
      : 0;

  setLoading(
    true
  );

  try {
    await saveWorkLog(
      today,
      {
        start_time:
          startTime,

        end_time:
          null,

        note:
          buildStoredNote(
            visibleNote,
            {
              lunchChecked:
                $("#lunchCheckMain")
                  ?.checked ||
                false,

              carryOT
            }
          )
      }
    );

    await refreshData();

    showToast(
      `Đã vào ca chính lúc ${startTime}`
    );
  } catch (
    error
  ) {
    showToast(
      `Không thể ghi giờ vào: ${
        error.message ||
        "Lỗi không xác định"
      }`,
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


async function endMainShift() {
  const now =
    normalizeDateToMinute(
      new Date()
    );

  const today =
    getDateKey(
      now
    );

  const activeMain =
    getActiveMainShift();

  const todayLog =
    getWorkLog(
      today
    );

  const targetDate =
    activeMain
      ? activeMain.work_date
      : today;

  const targetLog =
    activeMain ||
    todayLog;

  const wasCompleted =
    Boolean(
      !activeMain &&
      todayLog?.start_time &&
      todayLog?.end_time
    );

  const startTime =
    activeMain?.start_time ||
    todayLog?.start_time ||
    appState.settings
      .defaultShiftStart;

  const endTime =
    getTimeValue(
      now
    );

  const targetMeta =
    parseStoredNote(
      targetLog?.note ||
      ""
    ).meta;

  const hasStoredMainShift =
    Boolean(
      targetLog?.start_time ||
      targetLog?.end_time
    );

  const lunchChecked =
    activeMain ||
    hasStoredMainShift
      ? targetMeta
        .lunchChecked
      : (
        $("#lunchCheckMain")
          ?.checked ||
        false
      );

  const carryOT =
    activeMain
      ? targetMeta
        .carryOT
      : (
        targetLog &&
        !targetLog.start_time &&
        !targetLog.end_time
          ? getBaseOT(
            targetDate
          )
          : 0
      );

  const mainOT =
    calculateMainOT(
      startTime,
      endTime,
      lunchChecked,
      targetDate
    );

  const totalOT =
    roundHours(
      carryOT +
      mainOT +
      getExtraTotal(
        targetDate
      )
    );

  const mealCount =
    getMealCountForEndTime(
      endTime
    );

  const storedNote =
    buildStoredNote(
      getLogVisibleNote(
        targetLog
      ),
      {
        lunchChecked
      }
    );

  setLoading(
    true
  );

  try {
    await saveWorkLog(
      targetDate,
      {
        start_time:
          startTime,

        end_time:
          endTime,

        overtime:
          totalOT,

        meal_count:
          mealCount,

        note:
          storedNote
      }
    );

    await refreshData();

    if (
      activeMain
    ) {
      showToast(
        `Đã tan ca chính lúc ${endTime}`
      );
    } else if (
      wasCompleted
    ) {
      showToast(
        `Đã cập nhật giờ tan ca chính thành ${endTime}.`
      );
    } else {
      showToast(
        `Đã tạo ca mặc định ${startTime}–${endTime}`
      );
    }
  } catch (
    error
  ) {
    showToast(
      `Không thể cập nhật giờ tan ca: ${
        error.message ||
        "Lỗi không xác định"
      }`,
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


// =====================================================
// CA THÊM
// =====================================================

function ensureExtraTable() {
  if (
    appState.extraTableAvailable
  ) {
    return true;
  }

  showToast(
    "Chưa có quyền truy cập bảng extra_shifts.",
    true
  );

  return false;
}


async function startExtraShift() {
  if (
    !ensureExtraTable()
  ) {
    return;
  }

  if (
    getActiveExtraShift()
  ) {
    showToast(
      "Bạn đang có một ca thêm chưa kết thúc.",
      true
    );

    return;
  }

  const now =
    normalizeDateToMinute(
      new Date()
    );

  setLoading(
    true
  );

  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "extra_shifts"
        )
        .insert({
          username:
            appState.currentUser,

          work_date:
            getDateKey(
              now
            ),

          start_at:
            now.toISOString(),

          end_at:
            null,

          duration_hours:
            0,

          note:
            "",

          status:
            "working"
        });

    if (
      error
    ) {
      throw error;
    }

    await refreshData();

    showToast(
      `Đã vào ca thêm lúc ${getTimeValue(
        now
      )}`
    );
  } catch (
    error
  ) {
    showToast(
      `Không thể bắt đầu ca thêm: ${
        error.message ||
        "Lỗi không xác định"
      }`,
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


async function endExtraShift() {
  if (
    !ensureExtraTable()
  ) {
    return;
  }

  const now =
    normalizeDateToMinute(
      new Date()
    );

  const targetShift =
    getExtraShiftForEnd(
      now
    );

  if (
    !targetShift
  ) {
    showToast(
      "Chưa có ca thêm hôm nay để cập nhật giờ tan ca.",
      true
    );

    return;
  }

  const wasCompleted =
    targetShift.status ===
    "completed" &&
    Boolean(
      targetShift.end_at
    );

  const oldBaseOT =
    getBaseOT(
      targetShift.work_date
    );

  const startDate =
    normalizeDateToMinute(
      new Date(
        targetShift.start_at
      )
    );

  const endDate =
    normalizeDateToMinute(
      now
    );

  if (
    Number.isNaN(
      startDate.getTime()
    )
  ) {
    showToast(
      "Giờ bắt đầu ca thêm không hợp lệ.",
      true
    );

    return;
  }

  if (
    endDate <
    startDate
  ) {
    showToast(
      "Giờ tan ca không thể sớm hơn giờ vào ca.",
      true
    );

    return;
  }

  const duration =
    calculateDurationHours(
      startDate,
      endDate
    );

  setLoading(
    true
  );

  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "extra_shifts"
        )
        .update({
          start_at:
            startDate.toISOString(),

          end_at:
            endDate.toISOString(),

          duration_hours:
            duration,

          status:
            "completed"
        })
        .eq(
          "id",
          targetShift.id
        )
        .eq(
          "username",
          appState.currentUser
        );

    if (
      error
    ) {
      throw error;
    }

    await syncDayAfterExtraChange(
      targetShift.work_date,
      oldBaseOT
    );

    await refreshData();

    showToast(
      wasCompleted
        ? `Đã cập nhật giờ tan ca thêm thành ${getTimeValue(
          endDate
        )}. Tổng ${formatHours(
          duration
        )}`
        : `Đã tan ca thêm lúc ${getTimeValue(
          endDate
        )}. Tổng ${formatHours(
          duration
        )}`
    );
  } catch (
    error
  ) {
    showToast(
      `Không thể cập nhật ca thêm: ${
        error.message ||
        "Lỗi không xác định"
      }`,
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


// =====================================================
// LỊCH SỬ
// =====================================================

function openHistory(
  view = "calendar"
) {
  appState.historyDate =
    new Date();

  openModal(
    "historyModal"
  );

  setHistoryView(
    view ===
    "list"
      ? "list"
      : "calendar"
  );
}


function changeHistoryMonth(
  direction
) {
  appState.historyDate
    .setMonth(
      appState.historyDate
        .getMonth() +
      direction
    );

  renderHistory();
}


function setHistoryView(
  view
) {
  appState.historyView =
    view;

  $$(
    "[data-history-view]"
  ).forEach(
    button => {
      button.classList
        .toggle(
          "active",
          button.dataset
            .historyView ===
          view
        );
    }
  );

  $("#calendarHistoryPane")
    ?.classList
    .toggle(
      "hidden",
      view !==
      "calendar"
    );

  $("#listHistoryPane")
    ?.classList
    .toggle(
      "hidden",
      view !==
      "list"
    );

  renderHistory();

  refreshIcons();
}


function renderHistory() {
  const year =
    appState.historyDate
      .getFullYear();

  const month =
    appState.historyDate
      .getMonth();

  setText(
    "#historyMonthLabel",
    `Tháng ${month + 1}/${year}`
  );

  if (
    appState.historyView ===
    "calendar"
  ) {
    renderHistoryCalendar(
      year,
      month
    );
  } else {
    renderHistoryList(
      year,
      month
    );
  }

  refreshIcons();
}


function renderHistoryCalendar(
  year,
  month
) {
  const container =
    $("#calendarDays");

  if (
    !container
  ) {
    return;
  }

  container.innerHTML =
    "";

  const firstDay =
    new Date(
      year,
      month,
      1
    ).getDay();

  const blankDays =
    firstDay ===
    0
      ? 6
      : firstDay - 1;

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  for (
    let index = 0;
    index < blankDays;
    index += 1
  ) {
    const empty =
      document.createElement(
        "div"
      );

    empty.className =
      "calendar-day empty-day";

    container.appendChild(
      empty
    );
  }

  for (
    let day = 1;
    day <= daysInMonth;
    day += 1
  ) {
    const dateKey =
      `${year}-${pad(
        month + 1
      )}-${pad(
        day
      )}`;

    const log =
      getWorkLog(
        dateKey
      );

    const extras =
      getExtraShifts(
        dateKey
      );

    const total =
      getStoredTotalOT(
        dateKey
      );

    const hasActive =
      Boolean(
        log?.start_time &&
        !log?.end_time
      ) ||
      extras.some(
        item =>
          item.status ===
          "working"
      );

    const button =
      document.createElement(
        "button"
      );

    button.type =
      "button";

    button.className = [
      "calendar-day",

      dateKey ===
      getDateKey()
        ? "today"
        : "",

      isSunday(
        dateKey
      )
        ? "sunday"
        : "",

      hasMainShift(
        log,
        dateKey
      )
        ? "has-main"
        : "",

      extras.length
        ? "has-extra"
        : "",

      hasActive
        ? "has-active"
        : "",

      total > 0
        ? "has-ot"
        : ""
    ]
      .filter(
        Boolean
      )
      .join(
        " "
      );

    button.innerHTML = `
      <span class="calendar-day-number">
        ${day}
      </span>

      ${
        total > 0
          ? `
            <small class="calendar-day-ot">
              ${formatHours(
                total
              )}
            </small>
          `
          : ""
      }
    `;

    button.addEventListener(
      "click",
      () =>
        openDayDetail(
          dateKey
        )
    );

    container.appendChild(
      button
    );
  }
}


function getCalendarWeekRow(
  dateKey
) {
  const date =
    parseDateKey(
      dateKey
    );

  const firstDay =
    new Date(
      date.getFullYear(),
      date.getMonth(),
      1
    ).getDay();

  const mondayOffset =
    firstDay ===
    0
      ? 6
      : firstDay - 1;

  return Math.min(
    6,
    Math.max(
      1,
      Math.floor(
        (
          mondayOffset +
          date.getDate() -
          1
        ) /
        7
      ) +
      1
    )
  );
}


function renderHistoryList(
  year,
  month
) {
  const container =
    $("#historyList");

  if (
    !container
  ) {
    return;
  }

  container.innerHTML =
    "";

  const monthKey =
    `${year}-${pad(
      month + 1
    )}`;

  const dates =
    new Set();

  appState.workLogs
    .forEach(
      item => {
        if (
          item.work_date
            .startsWith(
              monthKey
            )
        ) {
          dates.add(
            item.work_date
          );
        }
      }
    );

  if (
    appState.extraTableAvailable
  ) {
    appState.extraShifts
      .forEach(
        item => {
          if (
            item.work_date
              .startsWith(
                monthKey
              )
          ) {
            dates.add(
              item.work_date
            );
          }
        }
      );
  }

  const sortedDates =
    Array.from(
      dates
    ).sort(
      (
        a,
        b
      ) =>
        b.localeCompare(
          a
        )
    );

  if (
    !sortedDates.length
  ) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="calendar-x"></i>

        <strong>
          Chưa có dữ liệu
        </strong>

        <p>
          Tháng này chưa ghi nhận ca làm nào.
        </p>
      </div>
    `;

    refreshIcons();

    return;
  }

  sortedDates
    .forEach(
      dateKey => {
        const log =
          getWorkLog(
            dateKey
          );

        const extras =
          getExtraShifts(
            dateKey
          );

        const date =
          parseDateKey(
            dateKey
          );

        let description =
          "Không có ca chính";

        if (
          log?.start_time ||
          log?.end_time
        ) {
          description =
            `${log.start_time || "--:--"} → ` +
            `${log.end_time || "Đang làm"}`;
        }

        if (
          extras.length
        ) {
          description +=
            ` • ${extras.length} ca thêm`;
        }

        const button =
          document.createElement(
            "button"
          );

        button.type =
          "button";

        button.className =
          `history-item week-${getCalendarWeekRow(
            dateKey
          )}`;

        button.innerHTML = `
          <span class="history-date-box">
            <strong>
              ${pad(
                date.getDate()
              )}
            </strong>

            <span>
              THÁNG ${pad(
                date.getMonth() + 1
              )}
            </span>
          </span>

          <span class="history-copy">
            <strong>
              ${date.toLocaleDateString(
                "vi-VN",
                {
                  weekday:
                    "long"
                }
              )}
            </strong>

            <small>
              ${escapeHTML(
                description
              )}
            </small>
          </span>

          <span class="history-total">
            <strong>
              ${formatHours(
                getStoredTotalOT(
                  dateKey
                )
              )}
            </strong>

            <small>
              TỔNG OT
            </small>
          </span>
        `;

        button.addEventListener(
          "click",
          () =>
            openDayDetail(
              dateKey
            )
        );

        container.appendChild(
          button
        );
      }
    );
}


// =====================================================
// CHI TIẾT NGÀY
// =====================================================

function openDayDetail(
  dateKey
) {
  appState.selectedDate =
    dateKey;

  appState.editingExtraId =
    null;

  renderDayDetail();

  openModal(
    "dayDetailModal"
  );
}


function renderDayDetail(
  resetEditor = true
) {
  const dateKey =
    appState.selectedDate;

  if (
    !dateKey
  ) {
    return;
  }

  const log =
    getWorkLog(
      dateKey
    );

  const baseOT =
    getBaseOT(
      dateKey
    );

  const mainExists =
    Boolean(
      log?.start_time ||
      log?.end_time ||
      baseOT > 0
    );

  setText(
    "#detailDateTitle",
    formatDisplayDate(
      dateKey
    )
  );

  setChecked(
    "#detailHasMainShift",
    mainExists
  );

  setValue(
    "#detailStartTime",
    log?.start_time ||
    appState.settings
      .defaultShiftStart
  );

  setValue(
    "#detailEndTime",
    log?.end_time ||
    appState.settings
      .defaultShiftEnd
  );

  setChecked(
    "#detailLunchChecked",
    getLogLunchChecked(
      log
    )
  );

  setValue(
    "#detailMainOT",
    baseOT
  );

  setValue(
    "#detailMealCount",
    parseInt(
      log?.meal_count,
      10
    ) ||
    0
  );

  setValue(
    "#detailNote",
    getLogVisibleNote(
      log
    )
  );

  setText(
    "#detailLunchLabel",
    isSunday(
      dateKey
    )
      ? "Nghỉ trưa 1 giờ"
      : "Tăng ca trưa +1 giờ"
  );

  updateDetailMainFields();

  renderDetailExtraList();

  renderDetailSummary();

  setExtraEditorAvailability();

  if (
    resetEditor
  ) {
    resetExtraEditor();
  }

  refreshIcons();
}


function handleMainShiftToggle() {
  updateDetailMainFields();

  if (
    $("#detailHasMainShift")
      ?.checked
  ) {
    calculateDetailMainOT();
  } else {
    setValue(
      "#detailMainOT",
      0
    );

    renderDetailSummary();
  }
}


function updateDetailMainFields() {
  $("#detailMainFields")
    ?.classList
    .toggle(
      "detail-main-disabled",
      !$("#detailHasMainShift")
        ?.checked
    );
}


function calculateDetailMainOT() {
  if (
    !$("#detailHasMainShift")
      ?.checked
  ) {
    setValue(
      "#detailMainOT",
      0
    );

    renderDetailSummary();

    return;
  }

  setValue(
    "#detailMainOT",
    calculateMainOT(
      $("#detailStartTime")
        ?.value ||
      "",

      $("#detailEndTime")
        ?.value ||
      "",

      $("#detailLunchChecked")
        ?.checked ||
      false,

      appState.selectedDate
    )
  );

  renderDetailSummary();
}


function suggestMealCount(
  endTime
) {
  setValue(
    "#detailMealCount",
    getMealCountForEndTime(
      endTime
    )
  );
}


function renderDetailSummary() {
  const mainOT =
    $("#detailHasMainShift")
      ?.checked
      ? (
        parseFloat(
          $("#detailMainOT")
            ?.value
        ) ||
        0
      )
      : 0;

  const extraOT =
    getExtraTotal(
      appState.selectedDate
    );

  setText(
    "#detailExtraTotal",
    formatHours(
      extraOT
    )
  );

  setText(
    "#detailTotalOT",
    formatHours(
      roundHours(
        mainOT +
        extraOT
      )
    )
  );
}


function setExtraEditorAvailability() {
  const disabled =
    !appState.extraTableAvailable;

  [
    "#extraEditorStart",
    "#extraEditorEnd",
    "#extraEditorNote",
    "#saveExtraEditorButton"
  ].forEach(
    selector => {
      const element =
        $(selector);

      if (
        element
      ) {
        element.disabled =
          disabled;
      }
    }
  );
}


function renderDetailExtraList() {
  const container =
    $("#detailExtraList");

  if (
    !container
  ) {
    return;
  }

  container.innerHTML =
    "";

  if (
    !appState.extraTableAvailable
  ) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="database-zap"></i>

        <strong>
          Chưa đọc được bảng ca thêm
        </strong>

        <p>
          Kiểm tra quyền Supabase trong phần Cài đặt.
        </p>
      </div>
    `;

    refreshIcons();

    return;
  }

  const extras =
    getExtraShifts(
      appState.selectedDate
    ).sort(
      (
        a,
        b
      ) =>
        new Date(
          a.start_at
        ) -
        new Date(
          b.start_at
        )
    );

  if (
    !extras.length
  ) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="clock-plus"></i>

        <strong>
          Chưa có ca thêm
        </strong>

        <p>
          Có thể chấm ở màn hình chính hoặc nhập thủ công bên dưới.
        </p>
      </div>
    `;

    refreshIcons();

    return;
  }

  extras.forEach(
    item => {
      const active =
        item.status ===
        "working" &&
        !item.end_at;

      const record =
        document.createElement(
          "div"
        );

      record.className =
        active
          ? "extra-record active-record"
          : "extra-record";

      record.innerHTML = `
        <span class="extra-record-icon">
          <i data-lucide="${
            active
              ? "activity"
              : "clock-check"
          }"></i>
        </span>

        <span class="extra-record-copy">
          <strong>
            ${formatTimeFromISO(
              item.start_at
            )}
            →
            ${
              item.end_at
                ? formatTimeFromISO(
                  item.end_at
                )
                : "Đang chạy"
            }
          </strong>

          <small>
            ${escapeHTML(
              item.note ||
              (
                active
                  ? "Ca thêm đang chạy"
                  : "Không có ghi chú"
              )
            )}
          </small>
        </span>

        <span class="extra-record-duration">
          ${
            active
              ? "LIVE"
              : formatHours(
                item.duration_hours
              )
          }
        </span>

        <span class="extra-record-actions">
          <button
            type="button"
            class="edit-extra-button"
            data-extra-id="${item.id}"
          >
            <i data-lucide="pencil"></i>
          </button>

          <button
            type="button"
            class="delete-extra-button"
            data-extra-id="${item.id}"
          >
            <i data-lucide="trash-2"></i>
          </button>
        </span>
      `;

      container.appendChild(
        record
      );
    }
  );

  $$(
    ".edit-extra-button"
  ).forEach(
    button => {
      button.addEventListener(
        "click",
        () =>
          editExtraShift(
            button.dataset
              .extraId
          )
      );
    }
  );

  $$(
    ".delete-extra-button"
  ).forEach(
    button => {
      button.addEventListener(
        "click",
        () =>
          deleteExtraShift(
            button.dataset
              .extraId
          )
      );
    }
  );

  refreshIcons();
}


function editExtraShift(
  extraId
) {
  const item =
    appState.extraShifts
      .find(
        shift =>
          String(
            shift.id
          ) ===
          String(
            extraId
          )
      );

  if (
    !item
  ) {
    return;
  }

  appState.editingExtraId =
    extraId;

  setText(
    "#extraEditorEyebrow",
    "CHỈNH SỬA"
  );

  setText(
    "#extraEditorTitle",
    "Sửa ca thêm"
  );

  setValue(
    "#extraEditorStart",
    formatTimeFromISO(
      item.start_at
    )
  );

  setValue(
    "#extraEditorEnd",
    item.end_at
      ? formatTimeFromISO(
        item.end_at
      )
      : ""
  );

  setValue(
    "#extraEditorNote",
    item.note ||
    ""
  );

  $("#cancelExtraEditButton")
    ?.classList
    .remove(
      "hidden"
    );

  setText(
    "#saveExtraEditorButton span",
    "Lưu ca thêm"
  );

  $("#extraEditorStart")
    ?.scrollIntoView({
      behavior:
        "smooth",

      block:
        "center"
    });
}


function resetExtraEditor() {
  appState.editingExtraId =
    null;

  setText(
    "#extraEditorEyebrow",
    "THÊM THỦ CÔNG"
  );

  setText(
    "#extraEditorTitle",
    "Ghi ca thêm"
  );

  setValue(
    "#extraEditorStart",
    ""
  );

  setValue(
    "#extraEditorEnd",
    ""
  );

  setValue(
    "#extraEditorNote",
    ""
  );

  $("#cancelExtraEditButton")
    ?.classList
    .add(
      "hidden"
    );

  setText(
    "#saveExtraEditorButton span",
    "Lưu ca thêm"
  );
}


async function saveExtraEditor() {
  if (
    !ensureExtraTable()
  ) {
    return;
  }

  const dateKey =
    appState.selectedDate;

  const startTime =
    $("#extraEditorStart")
      ?.value ||
    "";

  const endTime =
    $("#extraEditorEnd")
      ?.value ||
    "";

  const note =
    $("#extraEditorNote")
      ?.value
      .trim() ||
    "";

  if (
    !startTime
  ) {
    showToast(
      "Vui lòng nhập giờ bắt đầu.",
      true
    );

    return;
  }

  const editingItem =
    appState.editingExtraId
      ? appState.extraShifts
        .find(
          item =>
            String(
              item.id
            ) ===
            String(
              appState.editingExtraId
            )
        )
      : null;

  if (
    !editingItem &&
    !endTime
  ) {
    showToast(
      "Ca thêm thủ công cần có giờ kết thúc.",
      true
    );

    return;
  }

  const oldBaseOT =
    getBaseOT(
      dateKey
    );

  setLoading(
    true
  );

  try {
    if (
      editingItem
    ) {
      const startDate =
        getLocalDateTime(
          dateKey,
          startTime
        );

      const payload =
        endTime
          ? (() => {
            const {
              start,
              end
            } =
              combineExtraDateTime(
                dateKey,
                startTime,
                endTime
              );

            return {
              work_date:
                dateKey,

              start_at:
                start.toISOString(),

              end_at:
                end.toISOString(),

              duration_hours:
                calculateDurationHours(
                  start,
                  end
                ),

              status:
                "completed",

              note
            };
          })()
          : {
            work_date:
              dateKey,

            start_at:
              startDate.toISOString(),

            end_at:
              null,

            duration_hours:
              0,

            status:
              "working",

            note
          };

      const {
        error
      } =
        await supabaseClient
          .from(
            "extra_shifts"
          )
          .update(
            payload
          )
          .eq(
            "id",
            editingItem.id
          )
          .eq(
            "username",
            appState.currentUser
          );

      if (
        error
      ) {
        throw error;
      }
    } else {
      const {
        start,
        end
      } =
        combineExtraDateTime(
          dateKey,
          startTime,
          endTime
        );

      const {
        error
      } =
        await supabaseClient
          .from(
            "extra_shifts"
          )
          .insert({
            username:
              appState.currentUser,

            work_date:
              dateKey,

            start_at:
              start.toISOString(),

            end_at:
              end.toISOString(),

            duration_hours:
              calculateDurationHours(
                start,
                end
              ),

            status:
              "completed",

            note
          });

      if (
        error
      ) {
        throw error;
      }
    }

    await syncDayAfterExtraChange(
      dateKey,
      oldBaseOT
    );

    await refreshData();

    resetExtraEditor();

    renderDetailExtraList();

    renderDetailSummary();

    renderHistory();

    showToast(
      editingItem
        ? "Đã cập nhật ca thêm."
        : "Đã thêm ca mới."
    );
  } catch (
    error
  ) {
    showToast(
      `Không thể lưu ca thêm: ${
        error.message ||
        "Lỗi không xác định"
      }`,
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


async function deleteExtraShift(
  extraId
) {
  if (
    !ensureExtraTable()
  ) {
    return;
  }

  const item =
    appState.extraShifts
      .find(
        shift =>
          String(
            shift.id
          ) ===
          String(
            extraId
          )
      );

  if (
    !item ||
    !confirm(
      "Xóa ca thêm này?"
    )
  ) {
    return;
  }

  const oldBaseOT =
    getBaseOT(
      item.work_date
    );

  setLoading(
    true
  );

  try {
    const {
      error
    } =
      await supabaseClient
        .from(
          "extra_shifts"
        )
        .delete()
        .eq(
          "id",
          item.id
        )
        .eq(
          "username",
          appState.currentUser
        );

    if (
      error
    ) {
      throw error;
    }

    await syncDayAfterExtraChange(
      item.work_date,
      oldBaseOT
    );

    await refreshData();

    renderDetailExtraList();

    renderDetailSummary();

    renderHistory();

    showToast(
      "Đã xóa ca thêm."
    );
  } catch (
    error
  ) {
    showToast(
      `Không thể xóa ca thêm: ${
        error.message ||
        "Lỗi không xác định"
      }`,
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


async function saveDayDetails() {
  const dateKey =
    appState.selectedDate;

  if (
    !dateKey
  ) {
    return;
  }

  const mainEnabled =
    $("#detailHasMainShift")
      ?.checked ||
    false;

  const startTime =
    $("#detailStartTime")
      ?.value ||
    "";

  const endTime =
    $("#detailEndTime")
      ?.value ||
    "";

  if (
    mainEnabled &&
    (
      !startTime ||
      !endTime
    )
  ) {
    showToast(
      "Ca chính cần có đủ giờ vào và giờ tan ca.",
      true
    );

    return;
  }

  const mainOT =
    mainEnabled
      ? (
        parseFloat(
          $("#detailMainOT")
            ?.value
        ) ||
        0
      )
      : 0;

  const totalOT =
    roundHours(
      mainOT +
      getExtraTotal(
        dateKey
      )
    );

  const lunchChecked =
    mainEnabled &&
    (
      $("#detailLunchChecked")
        ?.checked ||
      false
    );

  const visibleNote =
    $("#detailNote")
      ?.value
      .trim() ||
    "";

  setLoading(
    true
  );

  try {
    await saveWorkLog(
      dateKey,
      {
        start_time:
          mainEnabled
            ? startTime
            : null,

        end_time:
          mainEnabled
            ? endTime
            : null,

        overtime:
          totalOT,

        meal_count:
          parseInt(
            $("#detailMealCount")
              ?.value,
            10
          ) ||
          0,

        note:
          buildStoredNote(
            visibleNote,
            {
              lunchChecked
            }
          )
      }
    );

    await refreshData();

    renderHistory();

    renderDayDetail(
      false
    );

    showToast(
      "Đã lưu thay đổi."
    );
  } catch (
    error
  ) {
    showToast(
      `Không thể lưu dữ liệu ngày: ${
        error.message ||
        "Lỗi không xác định"
      }`,
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


async function deleteSelectedDay() {
  const dateKey =
    appState.selectedDate;

  if (
    !dateKey ||
    !confirm(
      `Xóa toàn bộ dữ liệu ngày ${formatShortDate(
        dateKey
      )}?`
    )
  ) {
    return;
  }

  setLoading(
    true
  );

  try {
    const workDelete =
      await supabaseClient
        .from(
          "work_logs"
        )
        .delete()
        .eq(
          "username",
          appState.currentUser
        )
        .eq(
          "work_date",
          dateKey
        );

    if (
      workDelete.error
    ) {
      throw workDelete.error;
    }

    if (
      appState.extraTableAvailable
    ) {
      const extraDelete =
        await supabaseClient
          .from(
            "extra_shifts"
          )
          .delete()
          .eq(
            "username",
            appState.currentUser
          )
          .eq(
            "work_date",
            dateKey
          );

      if (
        extraDelete.error
      ) {
        throw extraDelete.error;
      }
    }

    await refreshData();

    closeModal(
      "dayDetailModal"
    );

    renderHistory();

    showToast(
      "Đã xóa toàn bộ dữ liệu ngày."
    );
  } catch (
    error
  ) {
    showToast(
      `Không thể xóa dữ liệu: ${
        error.message ||
        "Lỗi không xác định"
      }`,
      true
    );
  } finally {
    setLoading(
      false
    );
  }
}


// =====================================================
// BÁO CÁO LƯƠNG + TIỀN ĂN
// =====================================================

function openSalary() {
  appState.salaryDate =
    new Date();

  syncSalaryInputs(
    "settings"
  );

  renderSalary();

  openModal(
    "salaryModal"
  );
}


function changeSalaryMonth(
  direction
) {
  appState.salaryDate
    .setMonth(
      appState.salaryDate
        .getMonth() +
      direction
    );

  renderSalary();
}


function handleReportSalaryInput(
  event
) {
  appState.settings
    .baseSalary =
    sanitizeNonNegativeNumber(
      event.target.value
    );

  saveSettings();

  syncSalaryInputs(
    "report"
  );

  renderSalary();
}


function syncSalaryInputs(
  source
) {
  const value =
    appState.settings
      ?.baseSalary ||
    "";

  if (
    source !==
    "report"
  ) {
    setValue(
      "#baseSalaryInput",
      value
    );
  }

  if (
    source !==
    "settings"
  ) {
    setValue(
      "#settingsBaseSalary",
      value
    );
  }
}


function renderSalary() {
  if (
    !appState.settings
  ) {
    return;
  }

  const year =
    appState.salaryDate
      .getFullYear();

  const month =
    appState.salaryDate
      .getMonth();

  const monthKey =
    `${year}-${pad(
      month + 1
    )}`;

  const totalOT =
    getMonthTotal(
      monthKey
    );

  const salary =
    appState.settings
      .baseSalary;

  const multiplier =
    appState.settings
      .otMultiplier;

  const overtimeMoney =
    (
      salary /
      26 /
      8
    ) *
    multiplier *
    totalOT;

  setText(
    "#salaryMonthLabel",
    `Tháng ${month + 1}/${year}`
  );

  setText(
    "#salaryOTHours",
    formatHours(
      totalOT
    )
  );

  setText(
    "#overtimeMoney",
    formatMoney(
      overtimeMoney
    )
  );

  setText(
    "#salaryFormulaDescription",
    `Công thức: Lương / 26 ngày / 8 giờ × ${multiplier} × tổng OT.`
  );
}


function openMeal() {
  appState.mealDate =
    new Date();

  syncMealPriceInputs(
    "settings"
  );

  renderMeal();

  openModal(
    "mealModal"
  );
}


function changeMealMonth(
  direction
) {
  appState.mealDate
    .setMonth(
      appState.mealDate
        .getMonth() +
      direction
    );

  renderMeal();
}


function handleReportMealPriceInput(
  event
) {
  appState.settings
    .mealPrice =
    sanitizeNonNegativeNumber(
      event.target.value
    );

  saveSettings();

  syncMealPriceInputs(
    "report"
  );

  renderMeal();
}


function syncMealPriceInputs(
  source
) {
  const value =
    appState.settings
      ?.mealPrice ??
    30000;

  if (
    source !==
    "report"
  ) {
    setValue(
      "#mealPriceInput",
      value
    );
  }

  if (
    source !==
    "settings"
  ) {
    setValue(
      "#settingsMealPrice",
      value
    );
  }
}


function renderMeal() {
  if (
    !appState.settings
  ) {
    return;
  }

  const year =
    appState.mealDate
      .getFullYear();

  const month =
    appState.mealDate
      .getMonth();

  const price =
    appState.settings
      .mealPrice;

  const daysInMonth =
    new Date(
      year,
      month + 1,
      0
    ).getDate();

  const weeks =
    [];

  let currentWeek = {
    start:
      1,

    end:
      1,

    meals:
      0
  };

  let totalMeals =
    0;

  setText(
    "#mealMonthLabel",
    `Tháng ${month + 1}/${year}`
  );

  for (
    let day = 1;
    day <= daysInMonth;
    day += 1
  ) {
    const dateKey =
      `${year}-${pad(
        month + 1
      )}-${pad(
        day
      )}`;

    const meals =
      parseInt(
        getWorkLog(
          dateKey
        )?.meal_count,
        10
      ) ||
      0;

    currentWeek.meals +=
      meals;

    currentWeek.end =
      day;

    totalMeals +=
      meals;

    const dayOfWeek =
      new Date(
        year,
        month,
        day
      ).getDay();

    if (
      dayOfWeek ===
      0 ||
      day ===
      daysInMonth
    ) {
      weeks.push({
        ...currentWeek
      });

      currentWeek = {
        start:
          day + 1,

        end:
          day + 1,

        meals:
          0
      };
    }
  }

  const container =
    $("#mealWeekList");

  if (
    container
  ) {
    container.innerHTML =
      weeks
        .map(
          (
            week,
            index
          ) => `
            <div class="meal-week-item">
              <div>
                <strong>
                  Tuần ${index + 1}
                </strong>

                <small>
                  ${pad(
                    week.start
                  )}/${pad(
                    month + 1
                  )}
                  –
                  ${pad(
                    week.end
                  )}/${pad(
                    month + 1
                  )}
                </small>
              </div>

              <div class="meal-week-money">
                <strong>
                  ${formatMoney(
                    week.meals *
                    price
                  )}
                </strong>

                <small>
                  ${week.meals} phần
                </small>
              </div>
            </div>
          `
        )
        .join(
          ""
        );
  }

  setText(
    "#totalMealCount",
    `${totalMeals} phần`
  );

  setText(
    "#totalMealMoney",
    formatMoney(
      totalMeals *
      price
    )
  );
}


// =====================================================
// MENU + CÀI ĐẶT + MODAL
// =====================================================

function openAppMenu() {
  const menu =
    $("#appMenu");

  if (
    !menu
  ) {
    return;
  }

  setText(
    "#menuUserName",
    appState.currentUser ||
    "Người dùng"
  );

  setText(
    "#menuVersionDisplay",
    `Phiên bản: ${APP_VERSION}`
  );

  menu.classList
    .add(
      "show"
    );

  menu.setAttribute(
    "aria-hidden",
    "false"
  );

  $("#menuButton")
    ?.setAttribute(
      "aria-expanded",
      "true"
    );

  document.body
    .classList
    .add(
      "modal-open"
    );

  refreshIcons();
}


function closeAppMenu() {
  const menu =
    $("#appMenu");

  if (
    !menu
  ) {
    return;
  }

  menu.classList
    .remove(
      "show"
    );

  menu.setAttribute(
    "aria-hidden",
    "true"
  );

  $("#menuButton")
    ?.setAttribute(
      "aria-expanded",
      "false"
    );

  if (
    !$(".modal.show")
  ) {
    document.body
      .classList
      .remove(
        "modal-open"
      );
  }
}


function openSettings() {
  closeAppMenu();

  syncSettingsUI();

  setConnectionStatus(
    "",
    "Chưa kiểm tra",
    "Nhấn kiểm tra để xác nhận quyền đọc dữ liệu.",
    "circle-help"
  );

  openModal(
    "settingsModal"
  );
}


function openModal(
  id
) {
  closeAppMenu();

  const modal =
    document.getElementById(
      id
    );

  if (
    !modal
  ) {
    return;
  }

  modal.classList
    .add(
      "show"
    );

  document.body
    .classList
    .add(
      "modal-open"
    );

  refreshIcons();
}


function closeModal(
  id
) {
  const modal =
    document.getElementById(
      id
    );

  if (
    !modal
  ) {
    return;
  }

  modal.classList
    .remove(
      "show"
    );

  if (
    id ===
    "dayDetailModal"
  ) {
    appState.selectedDate =
      null;

    resetExtraEditor();
  }

  const anyOpen =
    Boolean(
      $(".modal.show")
    ) ||
    $("#appMenu")
      ?.classList
      .contains(
        "show"
      );

  if (
    !anyOpen
  ) {
    document.body
      .classList
      .remove(
        "modal-open"
      );
  }
}


// =====================================================
// LOADING + TOAST
// =====================================================

function setLoading(
  show
) {
  appState.loadingCount =
    show
      ? appState.loadingCount +
        1
      : Math.max(
        0,
        appState.loadingCount -
        1
      );

  $("#loadingOverlay")
    ?.classList
    .toggle(
      "show",
      appState.loadingCount >
      0
    );
}


function showToast(
  message,
  isError = false
) {
  const toast =
    $("#toast");

  if (
    !toast
  ) {
    return;
  }

  toast.classList
    .toggle(
      "error",
      isError
    );

  toast.innerHTML = `
    <i data-lucide="${
      isError
        ? "circle-alert"
        : "circle-check"
    }"></i>

    <span>
      ${escapeHTML(
        message
      )}
    </span>
  `;

  toast.classList
    .add(
      "show"
    );

  refreshIcons();

  clearTimeout(
    showToast.timeoutId
  );

  showToast.timeoutId =
    window.setTimeout(
      () =>
        toast.classList
          .remove(
            "show"
          ),
      isError
        ? 4500
        : 2800
    );
}


function escapeHTML(
  value
) {
  return String(
    value
  )
    .replaceAll(
      "&",
      "&amp;"
    )
    .replaceAll(
      "<",
      "&lt;"
    )
    .replaceAll(
      ">",
      "&gt;"
    )
    .replaceAll(
      '"',
      "&quot;"
    )
    .replaceAll(
      "'",
      "&#039;"
    );
}