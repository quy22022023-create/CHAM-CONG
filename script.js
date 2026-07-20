"use strict";

// =====================================================
// OT PRO V8.1 PAYROLL SYNC
// Giữ nguyên users, work_logs và extra_shifts.
// Cài đặt lương, ngày nghỉ và bảng lương đồng bộ với Supabase,
// đồng thời giữ localStorage làm bộ nhớ dự phòng.
// =====================================================


const APP_VERSION = "OT Pro V8.4 Meal & Salary Privacy";

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
    { time: "18:30", count: 1 },
    { time: "20:30", count: 2 }
  ]);

const ALLOWANCE_MODES =
  Object.freeze([
    "fixed",
    "proportional",
    "monthly",
    "disabled"
  ]);

const INSURANCE_MODES =
  Object.freeze([
    "percentage",
    "fixed",
    "disabled"
  ]);

const appState = {
  currentUser:
    localStorage.getItem(
      "ot_user"
    ) || null,

  workLogs: [],
  extraShifts: [],
  extraTableAvailable: true,

  loadedMonths:
    new Set(),

  monthRequestTokens: {},

  actionLocks:
    new Set(),

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
    null,

  leaveRecords: [],
  leaveDraft: null,
  payrollMonths: {},
  payrollDrafts: {},

  payrollSupabaseAvailable: null,
  payrollDataLoaded: false,
  settingsSyncTimer: null,
  settingsSyncing: false,
  suppressSettingsRemoteSave: false,
  activeSettingsTab: "general",
  activePayrollInlineEditor: null,

  salaryRevealed: false,
  salaryRevealToken: 0,

  mealReportRowsByMonth: {},
  mealReportLoadedMonths: new Set(),
  mealReportRequestTokens: {},
  mealReceipts: {},
  mealReceiptSupabaseAvailable: null,
  selectedMealReceiptWeek: null
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

    loadPayrollLocalData();

    loadMealReceiptLocalData();

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

      await Promise.allSettled([
        refreshData(true),
        initializePayrollSupabase()
      ]);
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
    () => runLockedAction(
      "mainStart",
      ["#mainStartBtn"],
      startMainShift
    )
  );

  on(
    "#mainEndBtn",
    "click",
    () => runLockedAction(
      "mainEnd",
      ["#mainEndBtn"],
      endMainShift
    )
  );

  on(
    "#extraStartBtn",
    "click",
    () => runLockedAction(
      "extraStart",
      ["#extraStartBtn"],
      startExtraShift
    )
  );

  on(
    "#extraEndBtn",
    "click",
    () => runLockedAction(
      "extraEnd",
      ["#extraEndBtn"],
      endExtraShift
    )
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
    "#revealSalaryButton",
    "click",
    () => runLockedAction(
      "revealSalary",
      ["#revealSalaryButton"],
      revealSalary
    )
  );

  on(
    "#mealWeekList",
    "click",
    event => {
      const button = event.target.closest("[data-meal-receipt-action]");

      if (!button) {
        return;
      }

      openMealReceiptConfirmation(button.dataset.weekStart || "");
    }
  );

  on(
    "#cancelMealReceiptConfirmButton",
    "click",
    () => closeModal("mealReceiptConfirmModal")
  );

  on(
    "#confirmMealReceiptActionButton",
    "click",
    () => {
      const weekStart = appState.selectedMealReceiptWeek?.weekStart || "unknown";

      runLockedAction(
        `mealReceipt:${weekStart}`,
        ["#confirmMealReceiptActionButton"],
        confirmMealReceiptAction
      );
    }
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
    () => runLockedAction(
      "saveDay",
      ["#saveDayButton"],
      saveDayDetails
    )
  );

  on(
    "#deleteDayButton",
    "click",
    () => runLockedAction(
      "deleteDay",
      ["#deleteDayButton"],
      deleteSelectedDay
    )
  );

  on(
    "#saveExtraEditorButton",
    "click",
    () => runLockedAction(
      "saveExtraEditor",
      ["#saveExtraEditorButton"],
      saveExtraEditor
    )
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

  bindPayrollEvents();

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
  $$('[data-settings-tab]').forEach(button => {
    button.addEventListener("click", () => {
      setSettingsTab(button.dataset.settingsTab || "general");
    });
  });

  on("#settingsSyncButton", "click", () =>
    runLockedAction(
      "settingsSupabaseSync",
      ["#settingsSyncButton"],
      syncAllPayrollDataToSupabase
    )
  );

  on("#themeModeSelect", "change", event => {
    appState.settings.themeMode =
      event.target.value === "dark"
        ? "dark"
        : "light";
    saveSettings();
    applySettings();
  });

  on("#fontSizeSelect", "change", event => {
    appState.settings.fontSize = event.target.value;
    saveSettings();
    applySettings();
  });

  on("#showSecondsToggle", "change", event => {
    appState.settings.showSeconds = event.target.checked;
    saveSettings();
    updateClock();
  });

  ["#defaultShiftStart", "#defaultShiftEnd"].forEach(selector => {
    on(selector, "change", event => {
      if (!isValidTime(event.target.value)) {
        syncSettingsUI();
        return;
      }

      const key =
        selector === "#defaultShiftStart"
          ? "defaultShiftStart"
          : "defaultShiftEnd";

      appState.settings[key] = event.target.value;
      saveSettings();
      applySettings();
      refreshOpenDetailDefaults();
    });
  });

  const numericSettings = {
    "#settingsBaseSalary": "baseSalary",
    "#settingsStandardWorkDays": "standardWorkDays",
    "#settingsStandardHours": "standardHours",
    "#settingsOTMultiplier": "otMultiplier",
    "#settingsMainAllowance": "mainAllowance",
    "#settingsOtherAllowance": "otherAllowance",
    "#settingsAttendanceAllowance": "attendanceAllowance",
    "#settingsResponsibilityAllowance": "responsibilityAllowance",
    "#settingsFuelRate": "fuelRate",
    "#settingsMonthlyLeaveAccrual": "monthlyLeaveAccrual",
    "#settingsInitialLeaveBalance": "initialLeaveBalance",
    "#settingsInsuranceBase": "insuranceBase",
    "#settingsInsuranceRate": "insuranceRate",
    "#settingsInsuranceFixedAmount": "insuranceFixedAmount",
    "#settingsMealPrice": "mealPrice"
  };

  Object.entries(numericSettings).forEach(([selector, key]) => {
    on(selector, "input", event => {
      const raw = event.target.value;

      if (["standardWorkDays", "standardHours", "otMultiplier"].includes(key)) {
        appState.settings[key] =
          sanitizePositiveNumber(
            raw,
            getDefaultSettings()[key]
          );
      } else if (["monthlyLeaveAccrual", "initialLeaveBalance"].includes(key)) {
        appState.settings[key] =
          sanitizeHalfDayNumber(
            raw,
            getDefaultSettings()[key]
          );
      } else {
        appState.settings[key] =
          sanitizeNonNegativeNumber(raw);
      }

      saveSettings();

      if (key === "mealPrice") {
        syncMealPriceInputs("settings");
        renderMeal();
      } else {
        syncSalaryInputs("settings");
        resetUnsavedPayrollDraftDefaults();
        renderSalary();
        renderLeaveDetail();
      }

      if (key.startsWith("insurance")) {
        updateInsuranceSettingsVisibility();
      }
    });
  });

  const selectSettings = {
    "#settingsMainAllowanceMode": "mainAllowanceMode",
    "#settingsOtherAllowanceMode": "otherAllowanceMode",
    "#settingsAttendanceAllowanceMode": "attendanceAllowanceMode",
    "#settingsResponsibilityAllowanceMode": "responsibilityAllowanceMode",
    "#settingsInsuranceMode": "insuranceMode"
  };

  Object.entries(selectSettings).forEach(([selector, key]) => {
    on(selector, "change", event => {
      appState.settings[key] = event.target.value;
      saveSettings();
      resetUnsavedPayrollDraftDefaults();
      updateInsuranceSettingsVisibility();
      renderSalary();
    });
  });

  on("#settingsLeaveStartMonth", "change", event => {
    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(event.target.value)) {
      syncSettingsUI();
      return;
    }

    appState.settings.leaveStartMonth = event.target.value;
    saveSettings();
    renderLeaveDetail();
    renderSalary();
  });

  on("#addMealThresholdButton", "click", addMealThreshold);
  on("#resetMealThresholdsButton", "click", resetMealThresholds);
  on("#checkConnectionButton", "click", checkSupabaseConnection);
  on("#changePasswordButton", "click", changeCurrentPassword);

  on("#mealThresholdList", "click", event => {
    const deleteButton =
      event.target.closest("[data-delete-meal-threshold]");

    if (deleteButton) {
      deleteMealThreshold(
        deleteButton.closest("[data-threshold-row]")
      );
    }
  });

  on("#mealThresholdList", "change", event => {
    if (
      event.target.matches(".meal-threshold-time") ||
      event.target.matches(".meal-threshold-count")
    ) {
      commitMealThresholdsFromUI();
    }
  });
}


function bindPayrollEvents() {
  on("#leaveFullDayButton", "click", () => {
    setLeaveDraftAmount(1);
  });

  on("#leaveHalfDayButton", "click", () => {
    setLeaveDraftAmount(0.5);
  });

  on("#leaveMorningButton", "click", () => {
    setLeaveDraftSession("morning");
  });

  on("#leaveAfternoonButton", "click", () => {
    setLeaveDraftSession("afternoon");
  });

  on("#detailLeaveNote", "input", event => {
    if (!appState.leaveDraft) {
      return;
    }

    appState.leaveDraft.note = event.target.value;
  });

  on("#cancelLeaveButton", "click", () => {
    appState.leaveDraft = null;
    renderLeaveDetail();
  });

  on("#salaryReportBody", "click", event => {
    const toggle = event.target.closest("[data-payroll-editor-toggle]");
    const cancel = event.target.closest("[data-payroll-editor-cancel]");
    const apply = event.target.closest("[data-payroll-editor-apply]");

    if (toggle) {
      togglePayrollInlineEditor(toggle.dataset.payrollEditorToggle);
      return;
    }

    if (cancel) {
      closePayrollInlineEditor(cancel.dataset.payrollEditorCancel, true);
      return;
    }

    if (apply) {
      applyPayrollInlineEditor(apply.dataset.payrollEditorApply);
    }
  });

  $$(".payroll-money-input").forEach(input => {
    input.addEventListener("input", () => {
      formatPayrollMoneyInput(input);
      updateFuelPayrollEditorPreview();
      updateInsurancePayrollEditorPreview();
    });

    input.addEventListener("focus", () => {
      window.requestAnimationFrame(() => input.select());
    });

    input.addEventListener("blur", () => {
      formatPayrollMoneyInput(input);
    });
  });

  on("#payrollMonthlyKmInput", "input", updateFuelPayrollEditorPreview);
  on("#payrollInsuranceModeInput", "change", () => {
    updateInsurancePayrollEditorVisibility();
    updateInsurancePayrollEditorPreview();
  });
  on("#payrollInsuranceRateInput", "input", updateInsurancePayrollEditorPreview);

  on("#openFuelPayrollEditorButton", "click", openFuelPayrollEditor);
  on("#applyFuelPayrollEditorButton", "click", applyFuelPayrollEditor);
  on("#resetFuelPayrollEditorButton", "click", resetFuelPayrollEditor);

  on("#openInsurancePayrollEditorButton", "click", openInsurancePayrollEditor);
  on("#applyInsurancePayrollEditorButton", "click", applyInsurancePayrollEditor);
  on("#resetInsurancePayrollEditorButton", "click", resetInsurancePayrollEditor);

  on("#savePayrollMonthButton", "click", () =>
    runLockedAction(
      "savePayrollMonth",
      ["#savePayrollMonthButton", "#resetPayrollMonthButton"],
      savePayrollMonth
    )
  );

  on("#resetPayrollMonthButton", "click", () =>
    runLockedAction(
      "resetPayrollMonth",
      ["#resetPayrollMonthButton", "#savePayrollMonthButton"],
      resetPayrollMonth
    )
  );

  on("#openMealFromSalaryButton", "click", () => {
    closeModal("salaryModal");
    openMeal();
  });
}


function parsePayrollMoney(value) {
  const digits = String(value ?? "").replace(/[^0-9]/g, "");
  return digits ? sanitizeNonNegativeNumber(Number(digits)) : 0;
}


function formatPayrollMoney(value) {
  return `${new Intl.NumberFormat("vi-VN").format(Math.round(Number(value) || 0))}₫`;
}


function formatPayrollMoneyInputValue(value) {
  const number = Math.round(Number(value) || 0);
  return number > 0 ? new Intl.NumberFormat("vi-VN").format(number) : "";
}


function formatPayrollMoneyInput(input) {
  if (!input) {
    return;
  }

  const value = parsePayrollMoney(input.value);
  input.value = value > 0 ? formatPayrollMoneyInputValue(value) : "";
}


function setPayrollMoneyInput(selector, value) {
  const input = $(selector);

  if (!input || document.activeElement === input) {
    return;
  }

  input.value = formatPayrollMoneyInputValue(value);
}


function parsePayrollDecimal(value) {
  const normalized = String(value ?? "")
    .trim()
    .replace(/\s/g, "")
    .replace(/,/g, ".")
    .replace(/[^0-9.]/g, "");

  const parts = normalized.split(".");
  const safe = parts.length > 1
    ? `${parts.shift()}.${parts.join("")}`
    : normalized;

  return sanitizeNonNegativeNumber(Number(safe));
}


function getPayrollDraftForCurrentMonth() {
  return ensurePayrollDraft(getMonthKey(appState.salaryDate));
}


function getPayrollDraftSettings(draft = getPayrollDraftForCurrentMonth()) {
  return sanitizeSettings(draft.settingsSnapshot || appState.settings);
}


function getPayrollAllowanceValue(draft, key) {
  const settings = getPayrollDraftSettings(draft);
  const map = {
    "main-allowance": ["mainAllowanceOverride", "mainAllowance"],
    "other-allowance": ["otherAllowanceOverride", "otherAllowance"],
    "attendance-allowance": ["attendanceAllowanceOverride", "attendanceAllowance"],
    "responsibility-allowance": ["responsibilityAllowanceOverride", "responsibilityAllowance"]
  };
  const [overrideKey, settingKey] = map[key] || [];

  if (!overrideKey) {
    return 0;
  }

  return draft[overrideKey] == null
    ? sanitizeNonNegativeNumber(settings[settingKey])
    : sanitizeNonNegativeNumber(draft[overrideKey]);
}


function getPayrollInlineEditorConfig(key) {
  const configs = {
    "base-salary": {
      editorId: "baseSalaryInlineEditor",
      fields: [
        { selector: "#baseSalaryInput", draftKey: "baseSalary", type: "money" }
      ]
    },
    "main-allowance": {
      editorId: "mainAllowanceInlineEditor",
      fields: [
        { selector: "#payrollMainAllowanceInput", draftKey: "mainAllowanceOverride", type: "money", allowanceKey: key }
      ]
    },
    "other-allowance": {
      editorId: "otherAllowanceInlineEditor",
      fields: [
        { selector: "#payrollOtherAllowanceInput", draftKey: "otherAllowanceOverride", type: "money", allowanceKey: key }
      ]
    },
    "attendance-allowance": {
      editorId: "attendanceAllowanceInlineEditor",
      fields: [
        { selector: "#payrollAttendanceAllowanceInput", draftKey: "attendanceAllowanceOverride", type: "money", allowanceKey: key }
      ]
    },
    "responsibility-allowance": {
      editorId: "responsibilityAllowanceInlineEditor",
      fields: [
        { selector: "#payrollResponsibilityAllowanceInput", draftKey: "responsibilityAllowanceOverride", type: "money", allowanceKey: key }
      ]
    },
    "other-income": {
      editorId: "otherIncomeInlineEditor",
      fields: [
        { selector: "#payrollOtherIncomeInput", draftKey: "otherIncome", type: "money" },
        { selector: "#payrollOtherIncomeNote", draftKey: "otherIncomeNote", type: "text" }
      ]
    },
    advance: {
      editorId: "advanceInlineEditor",
      fields: [
        { selector: "#payrollAdvanceInput", draftKey: "advance", type: "money" }
      ]
    },
    "other-deduction": {
      editorId: "otherDeductionInlineEditor",
      fields: [
        { selector: "#payrollOtherDeductionInput", draftKey: "otherDeduction", type: "money" },
        { selector: "#payrollOtherDeductionNote", draftKey: "otherDeductionNote", type: "text" }
      ]
    }
  };

  return configs[key] || null;
}


function closeAllPayrollInlineEditors(exceptKey = null) {
  $$('[data-payroll-editor-toggle]').forEach(button => {
    const key = button.dataset.payrollEditorToggle;

    if (key === exceptKey) {
      return;
    }

    button.setAttribute("aria-expanded", "false");
    const editorId = button.getAttribute("aria-controls");
    const editor = editorId ? document.getElementById(editorId) : null;

    if (editor) {
      editor.hidden = true;
    }
  });

  if (!exceptKey) {
    appState.activePayrollInlineEditor = null;
  }
}


function populatePayrollInlineEditor(key) {
  const config = getPayrollInlineEditorConfig(key);
  const draft = getPayrollDraftForCurrentMonth();

  if (!config) {
    return;
  }

  config.fields.forEach(field => {
    const input = $(field.selector);

    if (!input) {
      return;
    }

    let value = field.allowanceKey
      ? getPayrollAllowanceValue(draft, field.allowanceKey)
      : draft[field.draftKey];

    if (field.type === "money") {
      input.value = formatPayrollMoneyInputValue(value);
    } else {
      input.value = String(value || "");
    }
  });
}


function togglePayrollInlineEditor(key) {
  const config = getPayrollInlineEditorConfig(key);

  if (!config) {
    return;
  }

  const button = $(`[data-payroll-editor-toggle="${key}"]`);
  const editor = document.getElementById(config.editorId);

  if (!button || !editor) {
    return;
  }

  const willOpen = editor.hidden;
  closeAllPayrollInlineEditors(willOpen ? key : null);

  if (willOpen) {
    populatePayrollInlineEditor(key);
    editor.hidden = false;
    button.setAttribute("aria-expanded", "true");
    appState.activePayrollInlineEditor = key;

    window.requestAnimationFrame(() => {
      editor.querySelector("input, select, textarea")?.focus();
    });
  } else {
    editor.hidden = true;
    button.setAttribute("aria-expanded", "false");
    appState.activePayrollInlineEditor = null;
  }
}


function closePayrollInlineEditor(key, restore = false) {
  const config = getPayrollInlineEditorConfig(key);

  if (!config) {
    return;
  }

  if (restore) {
    populatePayrollInlineEditor(key);
  }

  const button = $(`[data-payroll-editor-toggle="${key}"]`);
  const editor = document.getElementById(config.editorId);

  if (editor) {
    editor.hidden = true;
  }

  button?.setAttribute("aria-expanded", "false");

  if (appState.activePayrollInlineEditor === key) {
    appState.activePayrollInlineEditor = null;
  }
}


function applyPayrollInlineEditor(key) {
  const config = getPayrollInlineEditorConfig(key);
  const draft = getPayrollDraftForCurrentMonth();

  if (!config) {
    return;
  }

  let changed = false;

  config.fields.forEach(field => {
    const input = $(field.selector);

    if (!input) {
      return;
    }

    const value = field.type === "money"
      ? parsePayrollMoney(input.value)
      : String(input.value || "").trim();

    if (draft[field.draftKey] !== value) {
      draft[field.draftKey] = value;
      changed = true;
    }
  });

  if (changed) {
    draft.dirty = true;
  }

  closePayrollInlineEditor(key);
  renderSalary();
}


function openFuelPayrollEditor() {
  const draft = getPayrollDraftForCurrentMonth();
  closeAllPayrollInlineEditors();
  setValue("#payrollMonthlyKmInput", draft.monthlyKm || "");
  setPayrollMoneyInput("#payrollFuelRateInput", draft.fuelRate);
  updateFuelPayrollEditorPreview();
  openModal("fuelPayrollEditorModal");
}


function updateFuelPayrollEditorPreview() {
  const km = parsePayrollDecimal($("#payrollMonthlyKmInput")?.value);
  const rate = parsePayrollMoney($("#payrollFuelRateInput")?.value);
  setText("#payrollFuelEditorPreview", formatPayrollMoney(km * rate));
}


function applyFuelPayrollEditor() {
  const draft = getPayrollDraftForCurrentMonth();
  const monthlyKm = parsePayrollDecimal($("#payrollMonthlyKmInput")?.value);
  const fuelRate = parsePayrollMoney($("#payrollFuelRateInput")?.value);

  if (draft.monthlyKm !== monthlyKm || draft.fuelRate !== fuelRate) {
    draft.monthlyKm = monthlyKm;
    draft.fuelRate = fuelRate;
    draft.dirty = true;
  }

  closeModal("fuelPayrollEditorModal");
  renderSalary();
}


function resetFuelPayrollEditor() {
  const settings = getPayrollDraftSettings();
  setValue("#payrollMonthlyKmInput", "");
  setPayrollMoneyInput("#payrollFuelRateInput", settings.fuelRate);
  updateFuelPayrollEditorPreview();
}


function getEffectiveInsuranceValues(draft = getPayrollDraftForCurrentMonth()) {
  const settings = getPayrollDraftSettings(draft);

  return {
    mode: draft.insuranceModeOverride || settings.insuranceMode,
    base: draft.insuranceBaseOverride == null
      ? settings.insuranceBase
      : sanitizeNonNegativeNumber(draft.insuranceBaseOverride),
    rate: draft.insuranceRateOverride == null
      ? settings.insuranceRate
      : sanitizeNonNegativeNumber(draft.insuranceRateOverride),
    fixed: draft.insuranceFixedOverride == null
      ? settings.insuranceFixedAmount
      : sanitizeNonNegativeNumber(draft.insuranceFixedOverride)
  };
}


function openInsurancePayrollEditor() {
  const values = getEffectiveInsuranceValues();
  closeAllPayrollInlineEditors();
  setValue("#payrollInsuranceModeInput", values.mode);
  setPayrollMoneyInput("#payrollInsuranceBaseInput", values.base);
  setValue("#payrollInsuranceRateInput", values.rate || "");
  setPayrollMoneyInput("#payrollInsuranceFixedInput", values.fixed);
  updateInsurancePayrollEditorVisibility();
  updateInsurancePayrollEditorPreview();
  openModal("insurancePayrollEditorModal");
}


function updateInsurancePayrollEditorVisibility() {
  const mode = $("#payrollInsuranceModeInput")?.value || "disabled";

  $$('[data-payroll-insurance-field]').forEach(field => {
    field.hidden = field.dataset.payrollInsuranceField !== mode;
  });
}


function updateInsurancePayrollEditorPreview() {
  const mode = $("#payrollInsuranceModeInput")?.value || "disabled";
  const base = parsePayrollMoney($("#payrollInsuranceBaseInput")?.value);
  const rate = sanitizeNonNegativeNumber($("#payrollInsuranceRateInput")?.value);
  const fixed = parsePayrollMoney($("#payrollInsuranceFixedInput")?.value);
  const amount = mode === "percentage"
    ? base * rate / 100
    : mode === "fixed"
      ? fixed
      : 0;

  setText("#payrollInsuranceEditorPreview", formatPayrollMoney(amount));
}


function applyInsurancePayrollEditor() {
  const draft = getPayrollDraftForCurrentMonth();
  const mode = $("#payrollInsuranceModeInput")?.value || "disabled";
  const base = parsePayrollMoney($("#payrollInsuranceBaseInput")?.value);
  const rate = sanitizeNonNegativeNumber($("#payrollInsuranceRateInput")?.value);
  const fixed = parsePayrollMoney($("#payrollInsuranceFixedInput")?.value);

  const changed =
    draft.insuranceModeOverride !== mode ||
    draft.insuranceBaseOverride !== base ||
    draft.insuranceRateOverride !== rate ||
    draft.insuranceFixedOverride !== fixed;

  draft.insuranceModeOverride = mode;
  draft.insuranceBaseOverride = base;
  draft.insuranceRateOverride = rate;
  draft.insuranceFixedOverride = fixed;

  if (changed) {
    draft.dirty = true;
  }

  closeModal("insurancePayrollEditorModal");
  renderSalary();
}


function resetInsurancePayrollEditor() {
  const settings = getPayrollDraftSettings();
  setValue("#payrollInsuranceModeInput", settings.insuranceMode);
  setPayrollMoneyInput("#payrollInsuranceBaseInput", settings.insuranceBase);
  setValue("#payrollInsuranceRateInput", settings.insuranceRate || "");
  setPayrollMoneyInput("#payrollInsuranceFixedInput", settings.insuranceFixedAmount);
  updateInsurancePayrollEditorVisibility();
  updateInsurancePayrollEditorPreview();
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
// CÀI ĐẶT + BỘ NHỚ DỰ PHÒNG
// =====================================================

function getDefaultSettings() {
  const now = new Date();

  return {
    themeMode: "light",
    fontSize: "medium",
    showSeconds: true,
    defaultShiftStart: "07:45",
    defaultShiftEnd: "17:00",

    baseSalary: 0,
    standardWorkDays: 26,
    standardHours: 8,
    otMultiplier: 2,

    mainAllowance: 0,
    mainAllowanceMode: "fixed",
    otherAllowance: 0,
    otherAllowanceMode: "fixed",
    attendanceAllowance: 0,
    attendanceAllowanceMode: "fixed",
    responsibilityAllowance: 0,
    responsibilityAllowanceMode: "fixed",

    fuelRate: 0,

    monthlyLeaveAccrual: 1,
    initialLeaveBalance: 0,
    leaveStartMonth:
      `${now.getFullYear()}-${pad(now.getMonth() + 1)}`,

    insuranceMode: "percentage",
    insuranceBase: 0,
    insuranceRate: 10.5,
    insuranceFixedAmount: 0,

    mealPrice: 30000,
    mealThresholds: cloneDefaultMealThresholds()
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
  const defaults = getDefaultSettings();
  let stored = {};

  try {
    stored = JSON.parse(
      localStorage.getItem(getSettingsKey()) || "{}"
    ) || {};
  } catch {
    stored = {};
  }

  const legacySalary = appState.currentUser
    ? Number(localStorage.getItem(`salary_${appState.currentUser}`))
    : 0;

  const legacyMealPrice = appState.currentUser
    ? Number(localStorage.getItem(`meal_price_${appState.currentUser}`))
    : 0;

  appState.settings = sanitizeSettings({
    ...defaults,
    ...stored,
    baseSalary:
      stored.baseSalary ??
      (Number.isFinite(legacySalary) && legacySalary > 0
        ? legacySalary
        : defaults.baseSalary),
    mealPrice:
      stored.mealPrice ??
      (Number.isFinite(legacyMealPrice) && legacyMealPrice > 0
        ? legacyMealPrice
        : defaults.mealPrice)
  });

  localStorage.setItem(
    getSettingsKey(),
    JSON.stringify(appState.settings)
  );
}


function sanitizeSettings(value) {
  const defaults =
    getDefaultSettings();

  let themeMode =
    ["light", "dark"].includes(
      value.themeMode
    )
      ? value.themeMode
      : defaults.themeMode;

  if (
    value.themeMode ===
    "system"
  ) {
    themeMode =
      window.matchMedia?.(
        "(prefers-color-scheme: dark)"
      ).matches
        ? "dark"
        : "light";
  }

  const fontSize =
    ["small", "medium", "large"].includes(
      value.fontSize
    )
      ? value.fontSize
      : defaults.fontSize;

  const allowanceMode = mode =>
    ALLOWANCE_MODES.includes(mode)
      ? mode
      : "fixed";

  const insuranceMode =
    INSURANCE_MODES.includes(
      value.insuranceMode
    )
      ? value.insuranceMode
      : defaults.insuranceMode;

  const leaveStartMonth =
    /^\d{4}-(0[1-9]|1[0-2])$/.test(
      String(value.leaveStartMonth || "")
    )
      ? value.leaveStartMonth
      : defaults.leaveStartMonth;

  return {
    themeMode,
    fontSize,

    showSeconds:
      value.showSeconds !== false,

    defaultShiftStart:
      isValidTime(value.defaultShiftStart)
        ? value.defaultShiftStart
        : defaults.defaultShiftStart,

    defaultShiftEnd:
      isValidTime(value.defaultShiftEnd)
        ? value.defaultShiftEnd
        : defaults.defaultShiftEnd,

    baseSalary:
      sanitizeNonNegativeNumber(value.baseSalary),

    standardWorkDays:
      sanitizePositiveNumber(
        value.standardWorkDays,
        defaults.standardWorkDays
      ),

    standardHours:
      sanitizePositiveNumber(
        value.standardHours,
        defaults.standardHours
      ),

    otMultiplier:
      sanitizePositiveNumber(
        value.otMultiplier,
        defaults.otMultiplier
      ),

    mainAllowance:
      sanitizeNonNegativeNumber(value.mainAllowance),
    mainAllowanceMode:
      allowanceMode(value.mainAllowanceMode),

    otherAllowance:
      sanitizeNonNegativeNumber(value.otherAllowance),
    otherAllowanceMode:
      allowanceMode(value.otherAllowanceMode),

    attendanceAllowance:
      sanitizeNonNegativeNumber(value.attendanceAllowance),
    attendanceAllowanceMode:
      allowanceMode(value.attendanceAllowanceMode),

    responsibilityAllowance:
      sanitizeNonNegativeNumber(value.responsibilityAllowance),
    responsibilityAllowanceMode:
      allowanceMode(value.responsibilityAllowanceMode),

    fuelRate:
      sanitizeNonNegativeNumber(value.fuelRate),

    monthlyLeaveAccrual:
      sanitizeHalfDayNumber(
        value.monthlyLeaveAccrual,
        defaults.monthlyLeaveAccrual
      ),

    initialLeaveBalance:
      sanitizeHalfDayNumber(
        value.initialLeaveBalance,
        defaults.initialLeaveBalance
      ),

    leaveStartMonth,

    insuranceMode,
    insuranceBase:
      sanitizeNonNegativeNumber(value.insuranceBase),
    insuranceRate:
      sanitizeNonNegativeNumber(
        value.insuranceRate,
        defaults.insuranceRate
      ),
    insuranceFixedAmount:
      sanitizeNonNegativeNumber(value.insuranceFixedAmount),

    mealPrice:
      sanitizeNonNegativeNumber(
        value.mealPrice,
        defaults.mealPrice
      ),

    mealThresholds:
      sanitizeMealThresholds(value.mealThresholds)
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

  localStorage.setItem(
    `${getSettingsKey()}_modified_at`,
    new Date().toISOString()
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

    if (!appState.suppressSettingsRemoteSave) {
      scheduleSettingsSupabaseSave();
    }
  }
}


function applySettings() {
  const settings =
    appState.settings ||
    getDefaultSettings();

  const root =
    document.documentElement;

  root.dataset.theme =
    settings.themeMode === "dark"
      ? "dark"
      : "light";

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


function updateThemeColor(themeMode) {
  const meta =
    $('meta[name="theme-color"]');

  if (!meta) {
    return;
  }

  meta.content =
    themeMode === "dark"
      ? "#0d0f13"
      : "#f4f6f9";
}


function syncSettingsUI() {
  const settings =
    appState.settings ||
    getDefaultSettings();

  setValue("#themeModeSelect", settings.themeMode);
  setValue("#fontSizeSelect", settings.fontSize);
  setChecked("#showSecondsToggle", settings.showSeconds);
  setValue("#defaultShiftStart", settings.defaultShiftStart);
  setValue("#defaultShiftEnd", settings.defaultShiftEnd);

  setValue("#settingsBaseSalary", settings.baseSalary || "");
  setValue("#settingsStandardWorkDays", settings.standardWorkDays);
  setValue("#settingsStandardHours", settings.standardHours);
  setValue("#settingsOTMultiplier", settings.otMultiplier);

  setValue("#settingsMainAllowance", settings.mainAllowance || "");
  setValue("#settingsMainAllowanceMode", settings.mainAllowanceMode);
  setValue("#settingsOtherAllowance", settings.otherAllowance || "");
  setValue("#settingsOtherAllowanceMode", settings.otherAllowanceMode);
  setValue("#settingsAttendanceAllowance", settings.attendanceAllowance || "");
  setValue("#settingsAttendanceAllowanceMode", settings.attendanceAllowanceMode);
  setValue("#settingsResponsibilityAllowance", settings.responsibilityAllowance || "");
  setValue("#settingsResponsibilityAllowanceMode", settings.responsibilityAllowanceMode);

  setValue("#settingsFuelRate", settings.fuelRate || "");
  setValue("#settingsMonthlyLeaveAccrual", settings.monthlyLeaveAccrual);
  setValue("#settingsInitialLeaveBalance", settings.initialLeaveBalance);
  setValue("#settingsLeaveStartMonth", settings.leaveStartMonth);

  setValue("#settingsInsuranceMode", settings.insuranceMode);
  setValue("#settingsInsuranceBase", settings.insuranceBase || "");
  setValue("#settingsInsuranceRate", settings.insuranceRate);
  setValue("#settingsInsuranceFixedAmount", settings.insuranceFixedAmount || "");

  setValue("#settingsMealPrice", settings.mealPrice);

  setText("#settingsUsername", appState.currentUser || "Người dùng");
  setText("#settingsVersion", APP_VERSION);

  renderMealThresholdSettings();
  syncSalaryInputs("settings");
  syncMealPriceInputs("settings");
  updateInsuranceSettingsVisibility();
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

    loadPayrollLocalData();

    loadMealReceiptLocalData();

    applySettings();

    showApplication();

    await Promise.allSettled([
      refreshData(),
      initializePayrollSupabase()
    ]);

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
  const currentPassword = $("#currentPasswordInput")?.value || "";
  const newPassword = $("#newPasswordInput")?.value || "";
  const confirmation = $("#confirmNewPasswordInput")?.value || "";

  if (!currentPassword || !newPassword || !confirmation) {
    showToast("Vui lòng nhập đủ ba ô mật khẩu.", true);
    return;
  }

  if (newPassword !== confirmation) {
    showToast("Mật khẩu mới nhập lại chưa khớp.", true);
    return;
  }

  if (newPassword === currentPassword) {
    showToast("Mật khẩu mới phải khác mật khẩu hiện tại.", true);
    return;
  }

  setLoading(true);

  try {
    const { data, error } =
      await supabaseClient
        .from("users")
        .select("username,password")
        .eq("username", appState.currentUser)
        .eq("password", currentPassword)
        .limit(1)
        .maybeSingle();

    if (error) {
      throw error;
    }

    if (!data) {
      throw new Error("Mật khẩu hiện tại không đúng.");
    }

    const { error: updateError } =
      await supabaseClient
        .from("users")
        .update({ password: newPassword })
        .eq("username", appState.currentUser)
        .eq("password", currentPassword);

    if (updateError) {
      throw updateError;
    }

    [
      "#currentPasswordInput",
      "#newPasswordInput",
      "#confirmNewPasswordInput"
    ].forEach(selector => setValue(selector, ""));

    showToast("Đã cập nhật mật khẩu.");
  } catch (error) {
    showToast(
      error.message || "Không thể đổi mật khẩu.",
      true
    );
  } finally {
    setLoading(false);
  }
}


// =====================================================
// TẢI DATABASE
// =====================================================

function sanitizeHalfDayNumber(value, fallback = 0) {
  const number = Number(value);

  if (!Number.isFinite(number) || number < 0) {
    return fallback;
  }

  return Math.round(number * 2) / 2;
}


function getMonthKey(value = new Date()) {
  if (typeof value === "string") {
    return value.slice(0, 7);
  }

  const date = value instanceof Date
    ? value
    : new Date(value);

  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}


function getMonthBounds(value) {
  const monthKey = getMonthKey(value);
  const [year, month] = monthKey.split("-").map(Number);
  const lastDay = new Date(year, month, 0).getDate();

  return {
    monthKey,
    start: `${monthKey}-01`,
    end: `${monthKey}-${pad(lastDay)}`
  };
}


function mergeWorkLogs(monthKey, monthRows, activeRows = []) {
  const kept = appState.workLogs.filter(
    item => !String(item.work_date || "").startsWith(monthKey)
  );

  const map = new Map();

  [...kept, ...(monthRows || []), ...(activeRows || [])].forEach(item => {
    if (!item?.work_date) {
      return;
    }

    if (map.has(item.work_date)) {
      console.warn(
        `Phát hiện work_logs trùng ngày ${item.work_date}; giao diện chỉ dùng một bản ghi.`
      );
    }

    map.set(item.work_date, item);
  });

  appState.workLogs = Array.from(map.values());
}


function mergeExtraShifts(monthKey, monthRows, activeRows = []) {
  const kept = appState.extraShifts.filter(
    item => !String(item.work_date || "").startsWith(monthKey)
  );

  const map = new Map();

  [...kept, ...(monthRows || []), ...(activeRows || [])].forEach(item => {
    const key = item?.id != null
      ? String(item.id)
      : `${item?.work_date}|${item?.start_at}|${item?.end_at}`;

    map.set(key, item);
  });

  appState.extraShifts = Array.from(map.values());
}


function renderOpenViewsAfterDataLoad() {
  renderDashboard();

  if ($("#historyModal")?.classList.contains("show")) {
    renderHistory();
  }

  if ($("#salaryModal")?.classList.contains("show")) {
    renderSalary();
  }

  if ($("#mealModal")?.classList.contains("show")) {
    renderMeal();
  }

  if (
    $("#dayDetailModal")?.classList.contains("show") &&
    appState.selectedDate
  ) {
    renderDayDetail(false);
  }
}


async function loadMonthData(
  target,
  { showLoader = false, force = false } = {}
) {
  if (!appState.currentUser) {
    return;
  }

  const { monthKey, start, end } = getMonthBounds(target);

  if (appState.loadedMonths.has(monthKey) && !force) {
    renderOpenViewsAfterDataLoad();
    return;
  }

  const token =
    (appState.monthRequestTokens[monthKey] || 0) + 1;

  appState.monthRequestTokens[monthKey] = token;

  if (showLoader) {
    setLoading(true);
  }

  try {
    const workResult =
      await supabaseClient
        .from("work_logs")
        .select("*")
        .eq("username", appState.currentUser)
        .gte("work_date", start)
        .lte("work_date", end)
        .order("work_date", { ascending: false });

    if (workResult.error) {
      throw workResult.error;
    }

    const activeWorkResult =
      await supabaseClient
        .from("work_logs")
        .select("*")
        .eq("username", appState.currentUser)
        .not("start_time", "is", null)
        .is("end_time", null);

    if (activeWorkResult.error) {
      throw activeWorkResult.error;
    }

    const extraResult =
      await supabaseClient
        .from("extra_shifts")
        .select("*")
        .eq("username", appState.currentUser)
        .gte("work_date", start)
        .lte("work_date", end)
        .order("start_at", { ascending: false });

    let extraRows = [];
    let activeExtraRows = [];

    if (extraResult.error) {
      appState.extraTableAvailable = false;
      console.warn(
        "extra_shifts chưa sẵn sàng:",
        extraResult.error.message
      );
    } else {
      appState.extraTableAvailable = true;
      extraRows = extraResult.data || [];

      const activeExtraResult =
        await supabaseClient
          .from("extra_shifts")
          .select("*")
          .eq("username", appState.currentUser)
          .eq("status", "working")
          .is("end_at", null);

      if (activeExtraResult.error) {
        throw activeExtraResult.error;
      }

      activeExtraRows = activeExtraResult.data || [];
    }

    if (appState.monthRequestTokens[monthKey] !== token) {
      return;
    }

    mergeWorkLogs(
      monthKey,
      workResult.data || [],
      activeWorkResult.data || []
    );

    mergeExtraShifts(
      monthKey,
      extraRows,
      activeExtraRows
    );

    appState.loadedMonths.add(monthKey);
    renderOpenViewsAfterDataLoad();
  } catch (error) {
    showToast(
      `Lỗi tải dữ liệu tháng ${monthKey}: ${error.message || "Không xác định"}`,
      true
    );
  } finally {
    if (showLoader) {
      setLoading(false);
    }
  }
}


async function runLockedAction(key, selectors, task) {
  if (appState.actionLocks.has(key)) {
    return;
  }

  appState.actionLocks.add(key);

  const buttons = selectors
    .map(selector => $(selector))
    .filter(Boolean);

  const previous = buttons.map(button => button.disabled);
  buttons.forEach(button => {
    button.disabled = true;
    button.setAttribute("aria-busy", "true");
  });

  try {
    await task();
  } catch (error) {
    showToast(
      error.message || "Không thể hoàn tất thao tác.",
      true
    );
  } finally {
    appState.actionLocks.delete(key);
    buttons.forEach((button, index) => {
      button.disabled = previous[index];
      button.removeAttribute("aria-busy");
    });
    renderDashboard();
  }
}


function getLeaveStorageKey() {
  return `ot_leave_records_${appState.currentUser || "guest"}`;
}


function getPayrollStorageKey() {
  return `ot_payroll_months_${appState.currentUser || "guest"}`;
}


function loadPayrollLocalData() {
  appState.leaveRecords = [];
  appState.payrollMonths = {};
  appState.payrollDrafts = {};
  appState.leaveDraft = null;

  try {
    const leaveData = JSON.parse(
      localStorage.getItem(getLeaveStorageKey()) || "[]"
    );

    if (Array.isArray(leaveData)) {
      const unique = new Map();

      leaveData.forEach(item => {
        const date = String(item?.date || "");
        const amount = sanitizeHalfDayNumber(item?.amount, 0);

        if (/^\d{4}-\d{2}-\d{2}$/.test(date) && [0.5, 1].includes(amount)) {
          unique.set(date, {
            date,
            amount,
            session: amount === 0.5 && item?.session === "afternoon"
              ? "afternoon"
              : amount === 0.5
                ? "morning"
                : "full",
            note: String(item?.note || ""),
            updatedAt: item?.updatedAt || null
          });
        }
      });

      appState.leaveRecords = Array.from(unique.values());
    }
  } catch {
    appState.leaveRecords = [];
  }

  try {
    const payrollData = JSON.parse(
      localStorage.getItem(getPayrollStorageKey()) || "{}"
    );

    if (payrollData && typeof payrollData === "object" && !Array.isArray(payrollData)) {
      appState.payrollMonths = payrollData;
    }
  } catch {
    appState.payrollMonths = {};
  }
}


function saveLeaveRecords() {
  localStorage.setItem(
    getLeaveStorageKey(),
    JSON.stringify(appState.leaveRecords)
  );
}


function savePayrollMonths() {
  localStorage.setItem(
    getPayrollStorageKey(),
    JSON.stringify(appState.payrollMonths)
  );
}


function isMissingPayrollTableError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  const mentionsPayrollTable =
    message.includes("payroll_settings") ||
    message.includes("leave_records") ||
    message.includes("payroll_months");

  return (
    mentionsPayrollTable &&
    (
      code === "42P01" ||
      code === "PGRST205" ||
      message.includes("not found") ||
      message.includes("does not exist")
    )
  );
}


function setSettingsTab(tabName) {
  const allowed = new Set(["general", "payroll", "leave", "meal", "account"]);
  const next = allowed.has(tabName) ? tabName : "general";

  appState.activeSettingsTab = next;

  $$('[data-settings-tab]').forEach(button => {
    const active = button.dataset.settingsTab === next;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
  });

  $$('[data-settings-panel]').forEach(panel => {
    const active = panel.dataset.settingsPanel === next;
    panel.classList.toggle("hidden", !active);
    panel.classList.toggle("active", active);
  });

  refreshIcons();
}


function setSettingsSyncStatus(state, title, detail) {
  const iconBox = $("#settingsSyncIcon");
  const iconByState = {
    online: "cloud-check",
    syncing: "cloud-upload",
    local: "hard-drive",
    warning: "cloud-alert",
    error: "cloud-off"
  };

  if (iconBox) {
    iconBox.className = `settings-sync-icon ${state || "local"}`;
    iconBox.innerHTML = `<i data-lucide="${iconByState[state] || "cloud"}"></i>`;
  }

  setText("#settingsSyncStatus", title);
  setText("#settingsSyncDetail", detail);

  const button = $("#settingsSyncButton");
  if (button) {
    button.disabled = appState.settingsSyncing;
    button.textContent = appState.settingsSyncing ? "Đang đồng bộ" : "Đồng bộ";
  }

  refreshIcons();
}


function refreshSettingsSyncStatus() {
  if (appState.settingsSyncing) {
    setSettingsSyncStatus(
      "syncing",
      "Đang đồng bộ Supabase",
      "Vui lòng giữ ứng dụng mở cho đến khi hoàn tất."
    );
    return;
  }

  if (
    appState.payrollSupabaseAvailable === true &&
    appState.mealReceiptSupabaseAvailable === false
  ) {
    setSettingsSyncStatus(
      "warning",
      "Đã kết nối lương, thiếu bảng tiền cơm",
      "Chạy file supabase_meal_weekly_receipts.sql để lưu trạng thái nhận tiền theo tuần."
    );
    return;
  }

  if (appState.payrollSupabaseAvailable === true) {
    setSettingsSyncStatus(
      "online",
      appState.mealReceiptSupabaseAvailable === true
        ? "Đã kết nối đầy đủ"
        : "Đã kết nối dữ liệu lương",
      appState.mealReceiptSupabaseAvailable === true
        ? "Lương, phép năm và nhận tiền cơm đang được lưu trên Supabase."
        : "Cài đặt, ngày nghỉ và bảng lương đang được lưu trên Supabase."
    );
    return;
  }

  if (appState.payrollSupabaseAvailable === false) {
    setSettingsSyncStatus(
      "warning",
      "Chưa triển khai bảng Supabase",
      "Chạy file supabase_payroll.sql rồi nhấn Đồng bộ. Dữ liệu hiện vẫn được giữ trên thiết bị."
    );
    return;
  }

  setSettingsSyncStatus(
    "local",
    "Đang dùng dữ liệu trên máy",
    "Ứng dụng chưa kiểm tra các bảng lương và phép trên Supabase."
  );
}


function cacheSettingsLocally(modifiedAt = new Date().toISOString()) {
  localStorage.setItem(
    getSettingsKey(),
    JSON.stringify(appState.settings)
  );

  localStorage.setItem(
    `${getSettingsKey()}_modified_at`,
    modifiedAt || new Date().toISOString()
  );

  if (appState.currentUser) {
    localStorage.setItem(
      `salary_${appState.currentUser}`,
      String(appState.settings.baseSalary)
    );
    localStorage.setItem(
      `meal_price_${appState.currentUser}`,
      String(appState.settings.mealPrice)
    );
  }
}


function timestampValue(value) {
  const time = new Date(value || 0).getTime();
  return Number.isFinite(time) ? time : 0;
}


function isLocalRecordNewer(localValue, remoteValue) {
  return timestampValue(localValue) > timestampValue(remoteValue);
}


function scheduleSettingsSupabaseSave() {
  if (
    !appState.currentUser ||
    appState.payrollSupabaseAvailable !== true ||
    appState.suppressSettingsRemoteSave
  ) {
    return;
  }

  if (appState.settingsSyncTimer) {
    window.clearTimeout(appState.settingsSyncTimer);
  }

  setSettingsSyncStatus(
    "syncing",
    "Có thay đổi đang chờ lưu",
    "Cài đặt sẽ tự đồng bộ sau khi bạn ngừng nhập."
  );

  appState.settingsSyncTimer = window.setTimeout(() => {
    appState.settingsSyncTimer = null;

    saveSettingsToSupabase({ quiet: true }).catch(error => {
      console.error("Không thể tự đồng bộ cài đặt:", error);
    });
  }, 700);
}


async function saveSettingsToSupabase({ quiet = false } = {}) {
  if (!appState.currentUser) {
    return;
  }

  if (appState.payrollSupabaseAvailable === false) {
    if (!quiet) {
      throw new Error("Chưa có các bảng dữ liệu lương trên Supabase.");
    }
    return;
  }

  setSettingsSyncStatus(
    "syncing",
    "Đang lưu cài đặt",
    "Đang cập nhật cấu hình lên Supabase..."
  );

  const { data, error } = await supabaseClient
    .from("payroll_settings")
    .upsert(
      {
        username: appState.currentUser,
        settings: appState.settings
      },
      { onConflict: "username" }
    )
    .select("updated_at")
    .single();

  if (error) {
    if (isMissingPayrollTableError(error)) {
      appState.payrollSupabaseAvailable = false;
      refreshSettingsSyncStatus();
    } else {
      setSettingsSyncStatus(
        "error",
        "Không thể lưu lên Supabase",
        error.message || "Không xác định được lỗi đồng bộ."
      );
    }

    throw error;
  }

  appState.payrollSupabaseAvailable = true;
  appState.payrollDataLoaded = true;
  cacheSettingsLocally(data?.updated_at || new Date().toISOString());

  setSettingsSyncStatus(
    "online",
    "Đã đồng bộ Supabase",
    "Cài đặt mới nhất đã được lưu trên đám mây."
  );

  if (!quiet) {
    showToast("Đã đồng bộ cài đặt lên Supabase.");
  }
}


function mapRemoteLeaveRecord(row) {
  const date = String(row?.leave_date || "").slice(0, 10);
  const amount = sanitizeHalfDayNumber(row?.leave_amount, 0);

  if (!/^\d{4}-\d{2}-\d{2}$/.test(date) || ![0.5, 1].includes(amount)) {
    return null;
  }

  return {
    date,
    amount,
    session:
      amount === 0.5 && row?.leave_session === "afternoon"
        ? "afternoon"
        : amount === 0.5
          ? "morning"
          : "full",
    note: String(row?.note || ""),
    updatedAt: row?.updated_at || null
  };
}


function mapRemotePayrollMonth(row) {
  const monthKey = String(row?.payroll_month || "").slice(0, 7);

  if (!/^\d{4}-\d{2}$/.test(monthKey)) {
    return null;
  }

  const data = row?.payroll_data;

  if (!data || typeof data !== "object" || Array.isArray(data)) {
    return null;
  }

  return {
    monthKey,
    data: {
      ...data,
      monthKey,
      savedAt: data.savedAt || row?.updated_at || null
    }
  };
}


async function initializePayrollSupabase({ force = false } = {}) {
  if (!appState.currentUser) {
    return;
  }

  if (appState.settingsSyncing) {
    return;
  }

  if (appState.payrollDataLoaded && !force) {
    refreshSettingsSyncStatus();
    return;
  }

  appState.settingsSyncing = true;
  refreshSettingsSyncStatus();

  try {
    const [settingsResult, leaveResult, payrollResult] = await Promise.all([
      supabaseClient
        .from("payroll_settings")
        .select("settings,updated_at")
        .eq("username", appState.currentUser)
        .maybeSingle(),

      supabaseClient
        .from("leave_records")
        .select("leave_date,leave_amount,leave_session,note,updated_at")
        .eq("username", appState.currentUser)
        .order("leave_date", { ascending: true }),

      supabaseClient
        .from("payroll_months")
        .select("payroll_month,payroll_data,updated_at")
        .eq("username", appState.currentUser)
        .order("payroll_month", { ascending: true })
    ]);

    const firstError =
      settingsResult.error ||
      leaveResult.error ||
      payrollResult.error;

    if (firstError) {
      if (isMissingPayrollTableError(firstError)) {
        appState.payrollSupabaseAvailable = false;
        appState.payrollDataLoaded = false;
        appState.settingsSyncing = false;
        refreshSettingsSyncStatus();
        return;
      }

      throw firstError;
    }

    appState.payrollSupabaseAvailable = true;

    if (
      settingsResult.data?.settings &&
      typeof settingsResult.data.settings === "object"
    ) {
      const localModifiedAt = localStorage.getItem(
        `${getSettingsKey()}_modified_at`
      );
      const remoteModifiedAt = settingsResult.data.updated_at;

      if (isLocalRecordNewer(localModifiedAt, remoteModifiedAt)) {
        await saveSettingsToSupabase({ quiet: true });
      } else {
        appState.suppressSettingsRemoteSave = true;
        appState.settings = sanitizeSettings(settingsResult.data.settings);
        cacheSettingsLocally(remoteModifiedAt);
        applySettings();
        appState.suppressSettingsRemoteSave = false;
      }
    } else {
      await saveSettingsToSupabase({ quiet: true });
    }

    const remoteLeaves = (leaveResult.data || [])
      .map(mapRemoteLeaveRecord)
      .filter(Boolean);

    const mergedLeaves = new Map(
      remoteLeaves.map(item => [item.date, item])
    );
    const leavesToUpload = [];

    appState.leaveRecords.forEach(localItem => {
      const remoteItem = mergedLeaves.get(localItem.date);

      if (
        !remoteItem ||
        isLocalRecordNewer(localItem.updatedAt, remoteItem.updatedAt)
      ) {
        mergedLeaves.set(localItem.date, localItem);
        leavesToUpload.push({
          username: appState.currentUser,
          leave_date: localItem.date,
          leave_amount: localItem.amount,
          leave_session: localItem.session,
          note: localItem.note || ""
        });
      }
    });

    if (leavesToUpload.length) {
      const { error } = await supabaseClient
        .from("leave_records")
        .upsert(leavesToUpload, { onConflict: "username,leave_date" });

      if (error) {
        throw error;
      }
    }

    appState.leaveRecords = Array.from(mergedLeaves.values())
      .sort((a, b) => a.date.localeCompare(b.date));
    saveLeaveRecords();

    const remotePayrollEntries = (payrollResult.data || [])
      .map(mapRemotePayrollMonth)
      .filter(Boolean);

    const mergedPayroll = new Map(
      remotePayrollEntries.map(item => [item.monthKey, item.data])
    );
    const payrollToUpload = [];

    Object.entries(appState.payrollMonths).forEach(([monthKey, localData]) => {
      if (!/^\d{4}-\d{2}$/.test(monthKey)) {
        return;
      }

      const remoteData = mergedPayroll.get(monthKey);

      if (
        !remoteData ||
        isLocalRecordNewer(localData?.savedAt, remoteData?.savedAt)
      ) {
        mergedPayroll.set(monthKey, localData);
        payrollToUpload.push({
          username: appState.currentUser,
          payroll_month: `${monthKey}-01`,
          payroll_data: localData
        });
      }
    });

    if (payrollToUpload.length) {
      const { error } = await supabaseClient
        .from("payroll_months")
        .upsert(payrollToUpload, { onConflict: "username,payroll_month" });

      if (error) {
        throw error;
      }
    }

    appState.payrollMonths = Object.fromEntries(mergedPayroll.entries());
    savePayrollMonths();

    appState.payrollDrafts = {};
    appState.payrollDataLoaded = true;

    renderLeaveDetail();
    renderHistory();
    renderSalary();

    setSettingsSyncStatus(
      "online",
      "Đã kết nối dữ liệu lương",
      "Cài đặt, ngày nghỉ và bảng lương đã được tải từ Supabase."
    );
  } catch (error) {
    appState.payrollDataLoaded = false;

    if (isMissingPayrollTableError(error)) {
      appState.payrollSupabaseAvailable = false;
      appState.settingsSyncing = false;
      refreshSettingsSyncStatus();
      return;
    }

    setSettingsSyncStatus(
      "error",
      "Lỗi đồng bộ Supabase",
      error.message || "Ứng dụng đang tiếp tục dùng dữ liệu trên thiết bị."
    );
  } finally {
    appState.settingsSyncing = false;

    const button = $("#settingsSyncButton");
    if (button) {
      button.disabled = false;
      button.textContent = "Đồng bộ";
    }
  }
}


async function syncAllPayrollDataToSupabase() {
  if (!appState.currentUser) {
    throw new Error("Bạn chưa đăng nhập.");
  }

  appState.payrollDataLoaded = false;

  await initializePayrollSupabase({ force: true });

  if (appState.payrollSupabaseAvailable === false) {
    throw new Error(
      "Chưa có bảng dữ liệu lương. Hãy chạy file supabase_payroll.sql trước."
    );
  }

  if (!appState.payrollDataLoaded) {
    throw new Error(
      "Không thể đồng bộ dữ liệu lương. Hãy kiểm tra kết nối Supabase."
    );
  }

  showToast("Đồng bộ dữ liệu lương thành công.");
}


async function refreshData(
  showLoader = false,
  target = null,
  force = true
) {
  if (!appState.currentUser) {
    return;
  }

  let targetDate = target;

  if (!targetDate) {
    targetDate =
      appState.selectedDate &&
      $("#dayDetailModal")?.classList.contains("show")
        ? parseDateKey(appState.selectedDate)
        : new Date();
  }

  await loadMonthData(
    targetDate,
    { showLoader, force }
  );
}


async function checkSupabaseConnection() {
  setConnectionStatus(
    "checking",
    "Đang kiểm tra",
    "Đang kiểm tra quyền đọc dữ liệu OT, lương và phép...",
    "loader-circle"
  );

  setSettingsSyncStatus(
    "syncing",
    "Đang kiểm tra Supabase",
    "Đang xác nhận payroll_settings, leave_records, payroll_months và meal_weekly_receipts."
  );

  try {
    const checks = await Promise.all([
      supabaseClient.from("users").select("username").limit(1),
      supabaseClient
        .from("work_logs")
        .select("work_date")
        .eq("username", appState.currentUser)
        .limit(1),
      supabaseClient
        .from("extra_shifts")
        .select("id")
        .eq("username", appState.currentUser)
        .limit(1),
      supabaseClient
        .from("payroll_settings")
        .select("username")
        .eq("username", appState.currentUser)
        .limit(1),
      supabaseClient
        .from("leave_records")
        .select("leave_date")
        .eq("username", appState.currentUser)
        .limit(1),
      supabaseClient
        .from("payroll_months")
        .select("payroll_month")
        .eq("username", appState.currentUser)
        .limit(1),
      supabaseClient
        .from("meal_weekly_receipts")
        .select("week_start")
        .eq("username", appState.currentUser)
        .limit(1)
    ]);

    const error = checks.find(result => result.error)?.error;

    if (error) {
      throw error;
    }

    appState.payrollSupabaseAvailable = true;
    appState.mealReceiptSupabaseAvailable = true;

    setConnectionStatus(
      "success",
      "Đã kết nối đầy đủ",
      "Đọc được dữ liệu OT, lương, phép năm và trạng thái nhận tiền cơm theo tuần.",
      "circle-check"
    );

    setSettingsSyncStatus(
      "online",
      "Supabase đã sẵn sàng",
      "Có thể đồng bộ lương, phép năm và nhận tiền cơm theo tuần."
    );
  } catch (error) {
    const message = String(error.message || "").toLowerCase();
    const code = String(error.code || "");

    let title = "Không thể kết nối";
    let detail = error.message || "Không xác định được lỗi kết nối.";

    if (isMissingMealReceiptTableError(error)) {
      appState.mealReceiptSupabaseAvailable = false;
      title = "Thiếu bảng nhận tiền cơm";
      detail = "Hãy chạy file supabase_meal_weekly_receipts.sql trong Supabase SQL Editor.";
      setSettingsSyncStatus(
        "warning",
        "Thiếu bảng nhận tiền cơm",
        detail
      );
    } else if (isMissingPayrollTableError(error)) {
      appState.payrollSupabaseAvailable = false;
      title = "Thiếu bảng dữ liệu lương";
      detail = "Hãy chạy file supabase_payroll.sql trong Supabase SQL Editor.";
      refreshSettingsSyncStatus();
    } else if (
      code === "42501" ||
      message.includes("row-level security") ||
      message.includes("permission")
    ) {
      title = "Không có quyền đọc dữ liệu";
      detail = "Hãy kiểm tra RLS và quyền SELECT/INSERT/UPDATE/DELETE cho vai trò anon.";
      setSettingsSyncStatus(
        "error",
        "Supabase từ chối quyền",
        detail
      );
    } else if (
      code === "42P01" ||
      code === "PGRST205" ||
      message.includes("extra_shifts") && message.includes("not found")
    ) {
      title = "Thiếu bảng dữ liệu OT";
      detail = "Bảng extra_shifts chưa tồn tại hoặc chưa được Data API nhận diện.";
      setSettingsSyncStatus(
        "error",
        "Thiếu bảng dữ liệu",
        detail
      );
    } else {
      setSettingsSyncStatus(
        "error",
        "Không thể kết nối Supabase",
        detail
      );
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

async function saveWorkLog(dateKey, changes = {}) {
  const { data: databaseRows, error: readError } =
    await supabaseClient
      .from("work_logs")
      .select("work_date")
      .eq("username", appState.currentUser)
      .eq("work_date", dateKey)
      .limit(1);

  if (readError) {
    throw readError;
  }

  if ((databaseRows || []).length) {
    const { error } =
      await supabaseClient
        .from("work_logs")
        .update(changes)
        .eq("username", appState.currentUser)
        .eq("work_date", dateKey);

    if (error) {
      throw error;
    }

    return;
  }

  const { error } =
    await supabaseClient
      .from("work_logs")
      .insert({
        username: appState.currentUser,
        work_date: dateKey,
        start_time: null,
        end_time: null,
        overtime: 0,
        meal_count: 0,
        note: "",
        ...changes
      });

  if (error) {
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
  const today = getDateKey();
  const activeMain = getActiveMainShift();

  if (activeMain) {
    showToast("Bạn đang có một ca chính chưa kết thúc.", true);
    return;
  }

  const { data: activeRows, error: activeError } =
    await supabaseClient
      .from("work_logs")
      .select("*")
      .eq("username", appState.currentUser)
      .not("start_time", "is", null)
      .is("end_time", null)
      .limit(1);

  if (activeError) {
    throw activeError;
  }

  if ((activeRows || []).length) {
    const activeDate = activeRows[0].work_date;
    await refreshData(false, parseDateKey(activeDate), true);
    showToast("Bạn đang có một ca chính chưa kết thúc.", true);
    return;
  }

  const { data: todayRows, error: todayError } =
    await supabaseClient
      .from("work_logs")
      .select("*")
      .eq("username", appState.currentUser)
      .eq("work_date", today)
      .limit(1);

  if (todayError) {
    throw todayError;
  }

  const todayLog = (todayRows || [])[0] || getWorkLog(today);

  if (todayLog?.start_time && todayLog?.end_time) {
    showToast(
      "Ca chính đã hoàn tất. Bấm Tan ca để cập nhật giờ kết thúc.",
      true
    );
    return;
  }

  const startTime = getTimeValue();
  const visibleNote = getLogVisibleNote(todayLog);
  const carryOT =
    todayLog && !todayLog.start_time && !todayLog.end_time
      ? getBaseOT(today)
      : 0;

  setLoading(true);

  try {
    await saveWorkLog(today, {
      start_time: startTime,
      end_time: null,
      note: buildStoredNote(visibleNote, {
        lunchChecked: $("#lunchCheckMain")?.checked || false,
        carryOT
      })
    });

    await refreshData(false, new Date(), true);
    showToast(`Đã vào ca chính lúc ${startTime}`);
  } catch (error) {
    showToast(
      `Không thể ghi giờ vào: ${error.message || "Lỗi không xác định"}`,
      true
    );
  } finally {
    setLoading(false);
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

    await refreshData(false, parseDateKey(targetDate), true);

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
  if (!ensureExtraTable()) {
    return;
  }

  if (getActiveExtraShift()) {
    showToast("Bạn đang có một ca thêm chưa kết thúc.", true);
    return;
  }

  const { data: activeRows, error: activeError } =
    await supabaseClient
      .from("extra_shifts")
      .select("id")
      .eq("username", appState.currentUser)
      .eq("status", "working")
      .is("end_at", null)
      .limit(1);

  if (activeError) {
    throw activeError;
  }

  if ((activeRows || []).length) {
    await refreshData(false, new Date(), true);
    showToast("Bạn đang có một ca thêm chưa kết thúc.", true);
    return;
  }

  const now = normalizeDateToMinute(new Date());
  setLoading(true);

  try {
    const { error } =
      await supabaseClient
        .from("extra_shifts")
        .insert({
          username: appState.currentUser,
          work_date: getDateKey(now),
          start_at: now.toISOString(),
          end_at: null,
          duration_hours: 0,
          note: "",
          status: "working"
        });

    if (error) {
      throw error;
    }

    await refreshData(false, now, true);
    showToast(`Đã vào ca thêm lúc ${getTimeValue(now)}`);
  } catch (error) {
    showToast(
      `Không thể bắt đầu ca thêm: ${error.message || "Lỗi không xác định"}`,
      true
    );
  } finally {
    setLoading(false);
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

    await refreshData(false, parseDateKey(targetShift.work_date), true);

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

async function openHistory(view = "calendar") {
  appState.historyDate = new Date();
  openModal("historyModal");
  await loadMonthData(appState.historyDate, { showLoader: true, force: false });
  setHistoryView(view === "list" ? "list" : "calendar");
}


async function changeHistoryMonth(direction) {
  appState.historyDate.setDate(1);

  appState.historyDate.setMonth(
    appState.historyDate.getMonth() + direction
  );

  await loadMonthData(appState.historyDate, { showLoader: true, force: false });
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


function renderHistoryCalendar(year, month) {
  const container = $("#calendarDays");

  if (!container) {
    return;
  }

  container.innerHTML = "";
  const firstDay = new Date(year, month, 1).getDay();
  const blankDays = firstDay === 0 ? 6 : firstDay - 1;
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  for (let index = 0; index < blankDays; index += 1) {
    const empty = document.createElement("div");
    empty.className = "calendar-day empty-day";
    container.appendChild(empty);
  }

  for (let day = 1; day <= daysInMonth; day += 1) {
    const dateKey = `${year}-${pad(month + 1)}-${pad(day)}`;
    const log = getWorkLog(dateKey);
    const extras = getExtraShifts(dateKey);
    const total = getStoredTotalOT(dateKey);
    const leave = getLeaveRecord(dateKey);
    const leaveAllocation = leave
      ? allocateLeaveRecords().get(dateKey)
      : null;

    const hasActive =
      Boolean(log?.start_time && !log?.end_time) ||
      extras.some(item => item.status === "working");

    const button = document.createElement("button");
    button.type = "button";
    button.className = [
      "calendar-day",
      dateKey === getDateKey() ? "today" : "",
      isSunday(dateKey) ? "sunday" : "",
      hasMainShift(log, dateKey) ? "has-main" : "",
      extras.length ? "has-extra" : "",
      hasActive ? "has-active" : "",
      total > 0 ? "has-ot" : "",
      leave ? "has-leave" : "",
      leave && leaveAllocation?.unpaid > 0 ? "leave-unpaid" : leave ? "leave-paid" : ""
    ].filter(Boolean).join(" ");

    button.innerHTML = `
      <span class="calendar-day-number">${day}</span>
      ${total > 0 ? `<small class="calendar-day-ot">${formatHours(total)}</small>` : ""}
    `;

    button.addEventListener("click", () => openDayDetail(dateKey));
    container.appendChild(button);
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


function renderHistoryList(year, month) {
  const container = $("#historyList");

  if (!container) {
    return;
  }

  container.innerHTML = "";
  const monthKey = `${year}-${pad(month + 1)}`;
  const dates = new Set();

  appState.workLogs.forEach(item => {
    if (String(item.work_date || "").startsWith(monthKey)) {
      dates.add(item.work_date);
    }
  });

  appState.extraShifts.forEach(item => {
    if (String(item.work_date || "").startsWith(monthKey)) {
      dates.add(item.work_date);
    }
  });

  appState.leaveRecords.forEach(item => {
    if (item.date.startsWith(monthKey)) {
      dates.add(item.date);
    }
  });

  const sortedDates = Array.from(dates).sort((a, b) => b.localeCompare(a));

  if (!sortedDates.length) {
    container.innerHTML = `
      <div class="empty-state">
        <i data-lucide="calendar-x"></i>
        <strong>Chưa có dữ liệu</strong>
        <p>Tháng này chưa có OT hoặc ngày nghỉ được đánh dấu.</p>
      </div>
    `;
    refreshIcons();
    return;
  }

  const allocations = allocateLeaveRecords();

  sortedDates.forEach(dateKey => {
    const log = getWorkLog(dateKey);
    const extras = getExtraShifts(dateKey);
    const leave = getLeaveRecord(dateKey);
    const allocation = allocations.get(dateKey);
    const date = parseDateKey(dateKey);

    let description = "Không có dữ liệu tăng ca";

    if (log?.start_time || log?.end_time) {
      description = `${log.start_time || "--:--"} → ${log.end_time || "Đang làm"}`;
    }

    if (extras.length) {
      description += ` • ${extras.length} ca thêm`;
    }

    if (leave) {
      description += allocation?.unpaid > 0
        ? ` • Nghỉ ${formatDayAmount(leave.amount)} (có phần không lương)`
        : ` • Nghỉ phép ${formatDayAmount(leave.amount)}`;
    }

    const button = document.createElement("button");
    button.type = "button";
    button.className = `history-item week-${getCalendarWeekRow(dateKey)}`;
    button.innerHTML = `
      <span class="history-date-box">
        <strong>${pad(date.getDate())}</strong>
        <span>THÁNG ${pad(date.getMonth() + 1)}</span>
      </span>
      <span class="history-copy">
        <strong>${date.toLocaleDateString("vi-VN", { weekday: "long" })}</strong>
        <small>${escapeHTML(description)}</small>
      </span>
      ${leave ? `<span class="history-leave-badge ${allocation?.unpaid > 0 ? "unpaid" : ""}">${allocation?.unpaid > 0 ? "KHÔNG LƯƠNG" : "PHÉP NĂM"}</span>` : ""}
      <span class="history-total">
        <strong>${formatHours(getStoredTotalOT(dateKey))}</strong>
        <small>TỔNG OT</small>
      </span>
    `;

    button.addEventListener("click", () => openDayDetail(dateKey));
    container.appendChild(button);
  });

  refreshIcons();
}


// =====================================================
// CHI TIẾT NGÀY
// =====================================================

function getLeaveRecord(dateKey) {
  return appState.leaveRecords.find(item => item.date === dateKey) || null;
}


function prepareLeaveDraft(dateKey) {
  const existing = getLeaveRecord(dateKey);

  appState.leaveDraft = existing
    ? { ...existing }
    : null;
}


function setLeaveDraftAmount(amount) {
  const dateKey = appState.selectedDate;

  if (!dateKey || isSunday(dateKey)) {
    showToast("Chủ nhật không cần đánh dấu nghỉ.", true);
    return;
  }

  const old = appState.leaveDraft || {};

  appState.leaveDraft = {
    date: dateKey,
    amount,
    session:
      amount === 0.5
        ? old.session === "afternoon"
          ? "afternoon"
          : "morning"
        : "full",
    note: old.note || "",
    updatedAt: old.updatedAt || null
  };

  renderLeaveDetail();
}


function setLeaveDraftSession(session) {
  if (!appState.leaveDraft || appState.leaveDraft.amount !== 0.5) {
    return;
  }

  appState.leaveDraft.session =
    session === "afternoon"
      ? "afternoon"
      : "morning";

  renderLeaveDetail();
}


function buildLeaveRecordsWithDraft(dateKey, draft) {
  const records = appState.leaveRecords
    .filter(item => item.date !== dateKey)
    .map(item => ({ ...item }));

  if (draft && [0.5, 1].includes(Number(draft.amount))) {
    records.push({
      date: dateKey,
      amount: Number(draft.amount),
      session: draft.session || (draft.amount === 0.5 ? "morning" : "full"),
      note: draft.note || ""
    });
  }

  return records;
}


function monthSerial(monthKey) {
  const [year, month] = monthKey.split("-").map(Number);
  return year * 12 + month - 1;
}


function accruedThroughMonth(monthKey, settings = appState.settings) {
  const start = settings.leaveStartMonth;

  if (monthSerial(monthKey) < monthSerial(start)) {
    return 0;
  }

  return roundHours(
    (monthSerial(monthKey) - monthSerial(start) + 1) *
    settings.monthlyLeaveAccrual
  );
}


function allocateLeaveRecords(records = appState.leaveRecords, settings = appState.settings) {
  const sorted = records
    .filter(item => !isSunday(item.date))
    .slice()
    .sort((a, b) => a.date.localeCompare(b.date));

  const allocations = new Map();
  let paidUsed = 0;

  sorted.forEach(item => {
    const monthKey = item.date.slice(0, 7);
    const entitlement =
      monthSerial(monthKey) >= monthSerial(settings.leaveStartMonth)
        ? settings.initialLeaveBalance + accruedThroughMonth(monthKey, settings)
        : 0;

    const available = Math.max(0, entitlement - paidUsed);
    const amount = sanitizeHalfDayNumber(item.amount, 0);
    const paid = Math.min(amount, available);
    const unpaid = Math.max(0, amount - paid);

    paidUsed = roundHours(paidUsed + paid);

    allocations.set(item.date, {
      amount,
      paid: roundHours(paid),
      unpaid: roundHours(unpaid),
      availableBefore: roundHours(available),
      availableAfter: roundHours(Math.max(0, available - paid))
    });
  });

  return allocations;
}


function getLeaveMonthSummary(monthKey, records = appState.leaveRecords, settings = appState.settings) {
  const allocations = allocateLeaveRecords(records, settings);
  const previousMonthSerial = monthSerial(monthKey) - 1;
  const previousYear = Math.floor(previousMonthSerial / 12);
  const previousMonth = previousMonthSerial % 12 + 1;
  const previousMonthKey = `${previousYear}-${pad(previousMonth)}`;

  const paidBefore = Array.from(allocations.entries())
    .filter(([date]) => date.slice(0, 7) < monthKey)
    .reduce((sum, [, item]) => sum + item.paid, 0);

  const opening =
    monthSerial(monthKey) >= monthSerial(settings.leaveStartMonth)
      ? Math.max(
        0,
        settings.initialLeaveBalance +
        accruedThroughMonth(previousMonthKey, settings) -
        paidBefore
      )
      : 0;

  const accrued =
    monthSerial(monthKey) >= monthSerial(settings.leaveStartMonth)
      ? settings.monthlyLeaveAccrual
      : 0;

  let used = 0;
  let unpaid = 0;
  let requested = 0;

  Array.from(allocations.entries())
    .filter(([date]) => date.startsWith(monthKey))
    .forEach(([, item]) => {
      used += item.paid;
      unpaid += item.unpaid;
      requested += item.amount;
    });

  return {
    opening: roundHours(opening),
    accrued: roundHours(accrued),
    used: roundHours(used),
    unpaid: roundHours(unpaid),
    requested: roundHours(requested),
    closing: roundHours(Math.max(0, opening + accrued - used))
  };
}


function getLeaveAllocationForDraft(dateKey, draft) {
  if (!draft) {
    return {
      amount: 0,
      paid: 0,
      unpaid: 0,
      availableBefore: getLeaveMonthSummary(dateKey.slice(0, 7)).closing,
      availableAfter: getLeaveMonthSummary(dateKey.slice(0, 7)).closing
    };
  }

  const records = buildLeaveRecordsWithDraft(dateKey, draft);
  return allocateLeaveRecords(records).get(dateKey) || {
    amount: 0,
    paid: 0,
    unpaid: 0,
    availableBefore: 0,
    availableAfter: 0
  };
}


function renderLeaveDetail() {
  const dateKey = appState.selectedDate;

  if (!dateKey || !appState.settings) {
    return;
  }

  const sunday = isSunday(dateKey);
  const draft = sunday ? null : appState.leaveDraft;
  const allocation = getLeaveAllocationForDraft(dateKey, draft);
  const existing = getLeaveRecord(dateKey);

  ["#leaveFullDayButton", "#leaveHalfDayButton"].forEach(selector => {
    const button = $(selector);
    if (button) {
      button.disabled = sunday;
    }
  });

  const fullActive = draft?.amount === 1;
  const halfActive = draft?.amount === 0.5;

  $("#leaveFullDayButton")?.classList.toggle("active", fullActive);
  $("#leaveHalfDayButton")?.classList.toggle("active", halfActive);
  $("#leaveFullDayButton")?.setAttribute("aria-pressed", String(fullActive));
  $("#leaveHalfDayButton")?.setAttribute("aria-pressed", String(halfActive));

  $("#leaveSessionOptions")?.classList.toggle("hidden", !halfActive || sunday);

  const morning = draft?.session !== "afternoon";
  $("#leaveMorningButton")?.classList.toggle("active", morning);
  $("#leaveAfternoonButton")?.classList.toggle("active", !morning);
  $("#leaveMorningButton")?.setAttribute("aria-pressed", String(morning));
  $("#leaveAfternoonButton")?.setAttribute("aria-pressed", String(!morning));

  setValue("#detailLeaveNote", draft?.note || "");
  $("#detailLeaveWarning")?.classList.toggle("hidden", !sunday);
  $("#cancelLeaveButton")?.classList.toggle("hidden", !draft && !existing);

  let title = "Ngày làm việc bình thường";
  let description = "Không có dữ liệu tăng ca vẫn được tính công và không sử dụng phép.";
  let badge = "Mặc định có công";
  let icon = "briefcase-business";

  if (sunday) {
    title = "Chủ nhật";
    description = "Chủ nhật không nằm trong 26 công mặc định.";
    badge = "Không tính công";
    icon = "calendar-x";
  } else if (draft) {
    icon = allocation.unpaid > 0 ? "calendar-minus" : "calendar-check";

    if (allocation.unpaid > 0 && allocation.paid > 0) {
      title = "Nghỉ kết hợp phép và không lương";
      description = `${formatDayAmount(allocation.paid)} dùng phép, ${formatDayAmount(allocation.unpaid)} bị trừ công.`;
      badge = "Vượt số dư phép";
    } else if (allocation.unpaid > 0) {
      title = "Nghỉ không lương";
      description = "Phép năm đã hết nên thời gian nghỉ này sẽ làm giảm lương.";
      badge = "Trừ công";
    } else {
      title = "Nghỉ dùng phép năm";
      description = "Thời gian nghỉ được bù bằng phép và không làm giảm lương.";
      badge = "Được hưởng lương";
    }
  }

  setText("#detailLeaveStatusTitle", title);
  setText("#detailLeaveStatusDescription", description);
  setText("#detailLeaveBadge", badge);
  setText("#detailLeaveBalance", `${formatDayAmount(allocation.availableBefore)} phép`);
  setText("#detailPaidLeaveAmount", formatDayAmount(allocation.paid));
  setText("#detailUnpaidLeaveAmount", formatDayAmount(allocation.unpaid));

  const iconBox = $("#detailLeaveStatusIcon");
  if (iconBox) {
    iconBox.innerHTML = `<i data-lucide="${icon}"></i>`;
  }

  refreshIcons();
}


async function commitLeaveDraft(dateKey) {
  const validDraft =
    appState.leaveDraft &&
    !isSunday(dateKey) &&
    [0.5, 1].includes(Number(appState.leaveDraft.amount));

  if (appState.payrollSupabaseAvailable === true) {
    if (validDraft) {
      const payload = {
        username: appState.currentUser,
        leave_date: dateKey,
        leave_amount: Number(appState.leaveDraft.amount),
        leave_session:
          appState.leaveDraft.amount === 0.5 &&
          appState.leaveDraft.session === "afternoon"
            ? "afternoon"
            : appState.leaveDraft.amount === 0.5
              ? "morning"
              : "full",
        note: String(appState.leaveDraft.note || "").trim()
      };

      const { error } = await supabaseClient
        .from("leave_records")
        .upsert(payload, { onConflict: "username,leave_date" });

      if (error) {
        throw error;
      }
    } else {
      const { error } = await supabaseClient
        .from("leave_records")
        .delete()
        .eq("username", appState.currentUser)
        .eq("leave_date", dateKey);

      if (error) {
        throw error;
      }
    }
  }

  appState.leaveRecords = appState.leaveRecords.filter(
    item => item.date !== dateKey
  );

  if (validDraft) {
    appState.leaveRecords.push({
      date: dateKey,
      amount: Number(appState.leaveDraft.amount),
      session:
        appState.leaveDraft.amount === 0.5 &&
        appState.leaveDraft.session === "afternoon"
          ? "afternoon"
          : appState.leaveDraft.amount === 0.5
            ? "morning"
            : "full",
      note: String(appState.leaveDraft.note || "").trim(),
      updatedAt: new Date().toISOString()
    });
  }

  appState.leaveRecords.sort((a, b) => a.date.localeCompare(b.date));
  saveLeaveRecords();
  appState.payrollDrafts = {};

  if (appState.payrollSupabaseAvailable === true) {
    setSettingsSyncStatus(
      "online",
      "Đã đồng bộ Supabase",
      "Ngày nghỉ và số dư phép đã được cập nhật trên đám mây."
    );
  }
}


function formatDayAmount(value) {
  const amount = Math.round((Number(value) || 0) * 2) / 2;
  return `${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(amount)} ngày`;
}


function formatNumber(value) {
  return new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 2 }).format(Number(value) || 0);
}


function updateInsuranceSettingsVisibility() {
  const mode = appState.settings?.insuranceMode || "disabled";
  const percentage = mode === "percentage";
  const fixed = mode === "fixed";

  ["#settingsInsuranceBase", "#settingsInsuranceRate"].forEach(selector => {
    const element = $(selector);
    if (element) {
      element.disabled = !percentage;
    }
  });

  const fixedInput = $("#settingsInsuranceFixedAmount");
  if (fixedInput) {
    fixedInput.disabled = !fixed;
  }
}


function getDefaultPayrollDraft(monthKey) {
  const settingsSnapshot = sanitizeSettings({
    ...appState.settings,
    mealThresholds: Array.isArray(appState.settings?.mealThresholds)
      ? appState.settings.mealThresholds.map(item => ({ ...item }))
      : cloneDefaultMealThresholds()
  });

  return {
    monthKey,
    baseSalary: settingsSnapshot.baseSalary,
    mainAllowanceOverride: null,
    otherAllowanceOverride: null,
    attendanceAllowanceOverride: null,
    responsibilityAllowanceOverride: null,
    monthlyKm: 0,
    fuelRate: settingsSnapshot.fuelRate,
    insuranceModeOverride: null,
    insuranceBaseOverride: null,
    insuranceRateOverride: null,
    insuranceFixedOverride: null,
    otherIncome: 0,
    otherIncomeNote: "",
    advance: 0,
    otherDeduction: 0,
    otherDeductionNote: "",
    settingsSnapshot,
    dirty: false
  };
}


function ensurePayrollDraft(monthKey, reset = false) {
  if (reset) {
    delete appState.payrollDrafts[monthKey];
  }

  if (!appState.payrollDrafts[monthKey]) {
    const saved = appState.payrollMonths[monthKey];

    appState.payrollDrafts[monthKey] = saved
      ? {
        monthKey,
        baseSalary: sanitizeNonNegativeNumber(saved.baseSalary),
        mainAllowanceOverride: saved.mainAllowanceOverride == null
          ? null
          : sanitizeNonNegativeNumber(saved.mainAllowanceOverride),
        otherAllowanceOverride: saved.otherAllowanceOverride == null
          ? null
          : sanitizeNonNegativeNumber(saved.otherAllowanceOverride),
        attendanceAllowanceOverride: saved.attendanceAllowanceOverride == null
          ? null
          : sanitizeNonNegativeNumber(saved.attendanceAllowanceOverride),
        responsibilityAllowanceOverride: saved.responsibilityAllowanceOverride == null
          ? null
          : sanitizeNonNegativeNumber(saved.responsibilityAllowanceOverride),
        monthlyKm: sanitizeNonNegativeNumber(saved.monthlyKm),
        fuelRate: sanitizeNonNegativeNumber(saved.fuelRate),
        insuranceModeOverride: INSURANCE_MODES.includes(saved.insuranceModeOverride)
          ? saved.insuranceModeOverride
          : null,
        insuranceBaseOverride: saved.insuranceBaseOverride == null
          ? null
          : sanitizeNonNegativeNumber(saved.insuranceBaseOverride),
        insuranceRateOverride: saved.insuranceRateOverride == null
          ? null
          : sanitizeNonNegativeNumber(saved.insuranceRateOverride),
        insuranceFixedOverride: saved.insuranceFixedOverride == null
          ? null
          : sanitizeNonNegativeNumber(saved.insuranceFixedOverride),
        otherIncome: sanitizeNonNegativeNumber(saved.otherIncome),
        otherIncomeNote: String(saved.otherIncomeNote || ""),
        advance: sanitizeNonNegativeNumber(saved.advance),
        otherDeduction: sanitizeNonNegativeNumber(saved.otherDeduction),
        otherDeductionNote: String(saved.otherDeductionNote || ""),
        settingsSnapshot: sanitizeSettings(saved.settingsSnapshot || appState.settings),
        dirty: false
      }
      : getDefaultPayrollDraft(monthKey);
  }

  return appState.payrollDrafts[monthKey];
}


function resetUnsavedPayrollDraftDefaults() {
  Object.keys(appState.payrollDrafts).forEach(monthKey => {
    const draft = appState.payrollDrafts[monthKey];

    if (!appState.payrollMonths[monthKey] && !draft.dirty) {
      appState.payrollDrafts[monthKey] = getDefaultPayrollDraft(monthKey);
    }
  });
}


function allowanceResult(amount, mode, paidDays, standardDays, overrideValue = null) {
  if (mode === "disabled") {
    return { value: 0, label: "Không áp dụng", enabled: false, overridden: false };
  }

  if (overrideValue != null) {
    return {
      value: sanitizeNonNegativeNumber(overrideValue),
      label: "Điều chỉnh riêng tháng",
      enabled: true,
      overridden: true
    };
  }

  if (mode === "proportional") {
    return {
      value: amount * paidDays / standardDays,
      label: `Theo ${formatNumber(paidDays)}/${formatNumber(standardDays)} công`,
      enabled: true,
      overridden: false
    };
  }

  if (mode === "monthly") {
    return {
      value: amount,
      label: "Mức mặc định tháng",
      enabled: true,
      overridden: false
    };
  }

  return {
    value: amount,
    label: "Cố định đủ tháng",
    enabled: true,
    overridden: false
  };
}


function calculatePayroll(monthKey, draft) {
  const settings = sanitizeSettings(draft.settingsSnapshot || appState.settings);
  const standardDays = settings.standardWorkDays;
  const standardHours = settings.standardHours;
  const leave = getLeaveMonthSummary(monthKey, appState.leaveRecords, settings);
  const paidDays = Math.max(0, standardDays - leave.unpaid);
  const totalOT = getMonthTotal(monthKey);
  const baseSalary = sanitizeNonNegativeNumber(draft.baseSalary);

  const workingSalary = baseSalary / standardDays * paidDays;
  const overtimeMoney =
    baseSalary / standardDays / standardHours * settings.otMultiplier * totalOT;

  const allowances = {
    main: allowanceResult(
      settings.mainAllowance,
      settings.mainAllowanceMode,
      paidDays,
      standardDays,
      draft.mainAllowanceOverride
    ),
    other: allowanceResult(
      settings.otherAllowance,
      settings.otherAllowanceMode,
      paidDays,
      standardDays,
      draft.otherAllowanceOverride
    ),
    attendance: allowanceResult(
      settings.attendanceAllowance,
      settings.attendanceAllowanceMode,
      paidDays,
      standardDays,
      draft.attendanceAllowanceOverride
    ),
    responsibility: allowanceResult(
      settings.responsibilityAllowance,
      settings.responsibilityAllowanceMode,
      paidDays,
      standardDays,
      draft.responsibilityAllowanceOverride
    )
  };

  const allowanceTotal = Object.values(allowances)
    .reduce((sum, item) => sum + item.value, 0);

  const monthlyKm = sanitizeNonNegativeNumber(draft.monthlyKm);
  const fuelRate = sanitizeNonNegativeNumber(draft.fuelRate);
  const fuelMoney = monthlyKm * fuelRate;
  const fuelEnabled = settings.fuelRate > 0 || fuelRate > 0 || monthlyKm > 0;
  const otherIncome = sanitizeNonNegativeNumber(draft.otherIncome);

  const insurance = getEffectiveInsuranceValues(draft);
  let insuranceMoney = 0;
  let insuranceDescription = "Không khấu trừ bảo hiểm";

  if (insurance.mode === "percentage") {
    insuranceMoney = insurance.base * insurance.rate / 100;
    insuranceDescription = `${formatPayrollMoney(insurance.base)} × ${formatNumber(insurance.rate)}%`;
  } else if (insurance.mode === "fixed") {
    insuranceMoney = insurance.fixed;
    insuranceDescription = "Số tiền bảo hiểm cố định";
  }

  const advance = sanitizeNonNegativeNumber(draft.advance);
  const otherDeduction = sanitizeNonNegativeNumber(draft.otherDeduction);

  const totalIncome =
    workingSalary + overtimeMoney + allowanceTotal + fuelMoney + otherIncome;
  const totalDeductions = insuranceMoney + advance + otherDeduction;
  const netSalary = totalIncome - totalDeductions;
  const unpaidLeaveReduction = baseSalary / standardDays * leave.unpaid;

  const mealCount = appState.workLogs
    .filter(item => String(item.work_date || "").startsWith(monthKey))
    .reduce((sum, item) => sum + (parseInt(item.meal_count, 10) || 0), 0);

  return {
    settings,
    standardDays,
    standardHours,
    otMultiplier: settings.otMultiplier,
    paidDays,
    leave,
    totalOT,
    baseSalary,
    workingSalary,
    overtimeMoney,
    allowances,
    monthlyKm,
    fuelRate,
    fuelMoney,
    fuelEnabled,
    otherIncome,
    insuranceMode: insurance.mode,
    insuranceMoney,
    insuranceDescription,
    advance,
    otherDeduction,
    totalIncome,
    totalDeductions,
    netSalary,
    unpaidLeaveReduction,
    mealMoney: mealCount * appState.settings.mealPrice
  };
}


async function savePayrollMonth() {
  const monthKey = getMonthKey(appState.salaryDate);
  const draft = ensurePayrollDraft(monthKey);
  const savedExisting = appState.payrollMonths[monthKey];

  if (savedExisting && !draft.dirty) {
    showToast("Bảng lương tháng không có thay đổi mới.");
    return;
  }

  const result = calculatePayroll(monthKey, draft);
  const savedAt = new Date().toISOString();

  const payrollData = {
    monthKey,
    baseSalary: draft.baseSalary,
    mainAllowanceOverride: draft.mainAllowanceOverride,
    otherAllowanceOverride: draft.otherAllowanceOverride,
    attendanceAllowanceOverride: draft.attendanceAllowanceOverride,
    responsibilityAllowanceOverride: draft.responsibilityAllowanceOverride,
    monthlyKm: draft.monthlyKm,
    fuelRate: draft.fuelRate,
    insuranceModeOverride: draft.insuranceModeOverride,
    insuranceBaseOverride: draft.insuranceBaseOverride,
    insuranceRateOverride: draft.insuranceRateOverride,
    insuranceFixedOverride: draft.insuranceFixedOverride,
    otherIncome: draft.otherIncome,
    otherIncomeNote: draft.otherIncomeNote,
    advance: draft.advance,
    otherDeduction: draft.otherDeduction,
    otherDeductionNote: draft.otherDeductionNote,
    settingsSnapshot: draft.settingsSnapshot,
    calculatedSnapshot: result,
    savedAt
  };

  const saveStatus = $("#payrollSaveStatus");
  saveStatus?.classList.add("is-saving");
  setText("#payrollSaveStatus", "Đang lưu và đồng bộ...");

  try {
    if (appState.payrollSupabaseAvailable === true) {
      const { error } = await supabaseClient
        .from("payroll_months")
        .upsert(
          {
            username: appState.currentUser,
            payroll_month: `${monthKey}-01`,
            payroll_data: payrollData
          },
          { onConflict: "username,payroll_month" }
        );

      if (error) {
        throw error;
      }
    }

    appState.payrollMonths[monthKey] = payrollData;
    savePayrollMonths();
    draft.dirty = false;
    renderSalary();

    if (appState.payrollSupabaseAvailable === true) {
      setSettingsSyncStatus(
        "online",
        "Đã đồng bộ Supabase",
        `Bảng lương tháng ${monthKey} đã được lưu trên đám mây.`
      );
    }

    showToast(
      appState.payrollSupabaseAvailable === true
        ? "Đã lưu bảng lương tháng lên Supabase."
        : "Đã lưu bảng lương tháng trên thiết bị."
    );
  } finally {
    saveStatus?.classList.remove("is-saving");
  }
}


async function resetPayrollMonth() {
  const monthKey = getMonthKey(appState.salaryDate);

  if (!confirm(`Khôi phục bảng lương tháng ${monthKey} về cấu hình mặc định?`)) {
    return;
  }

  if (appState.payrollSupabaseAvailable === true) {
    const { error } = await supabaseClient
      .from("payroll_months")
      .delete()
      .eq("username", appState.currentUser)
      .eq("payroll_month", `${monthKey}-01`);

    if (error) {
      throw error;
    }
  }

  delete appState.payrollMonths[monthKey];
  delete appState.payrollDrafts[monthKey];
  savePayrollMonths();
  ensurePayrollDraft(monthKey);
  renderSalary();
  showToast("Đã khôi phục dữ liệu bảng lương tháng.");
}


function formatSavedTime(value) {
  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "";
  }

  return date.toLocaleString("vi-VN", {
    day: "2-digit",
    month: "2-digit",
    year: "numeric",
    hour: "2-digit",
    minute: "2-digit"
  });
}


function openDayDetail(dateKey) {
  appState.selectedDate = dateKey;
  appState.editingExtraId = null;
  prepareLeaveDraft(dateKey);
  renderDayDetail();
  openModal("dayDetailModal");
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

  renderLeaveDetail();

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
          runLockedAction(
            `deleteExtra:${button.dataset.extraId}`,
            [`.delete-extra-button[data-extra-id="${button.dataset.extraId}"]`],
            () => deleteExtraShift(
              button.dataset
                .extraId
            )
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

    await refreshData(false, parseDateKey(dateKey), true);

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

    await refreshData(false, parseDateKey(item.work_date), true);

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
  const dateKey = appState.selectedDate;

  if (!dateKey) {
    return;
  }

  const mainEnabled = $("#detailHasMainShift")?.checked || false;
  const startTime = $("#detailStartTime")?.value || "";
  const endTime = $("#detailEndTime")?.value || "";

  if (mainEnabled && (!startTime || !endTime)) {
    showToast("Ca chính cần có đủ giờ vào và giờ tan ca.", true);
    return;
  }

  const mainOT =
    mainEnabled
      ? parseFloat($("#detailMainOT")?.value) || 0
      : 0;

  const totalOT = roundHours(
    mainOT + getExtraTotal(dateKey)
  );

  const lunchChecked =
    mainEnabled &&
    ($("#detailLunchChecked")?.checked || false);

  const visibleNote = $("#detailNote")?.value.trim() || "";
  const mealCount =
    Math.max(0, parseInt($("#detailMealCount")?.value, 10) || 0);

  const existing = getWorkLog(dateKey);
  const hasWorkData =
    Boolean(existing) ||
    mainEnabled ||
    totalOT > 0 ||
    mealCount > 0 ||
    Boolean(visibleNote);

  setLoading(true);

  try {
    if (hasWorkData) {
      await saveWorkLog(dateKey, {
        start_time: mainEnabled ? startTime : null,
        end_time: mainEnabled ? endTime : null,
        overtime: totalOT,
        meal_count: mealCount,
        note: buildStoredNote(visibleNote, { lunchChecked })
      });
    }

    await commitLeaveDraft(dateKey);

    await refreshData(false, parseDateKey(dateKey), true);
    renderHistory();
    prepareLeaveDraft(dateKey);
    renderDayDetail(false);
    renderSalary();

    showToast("Đã lưu thay đổi.");
  } catch (error) {
    showToast(
      `Không thể lưu dữ liệu ngày: ${error.message || "Lỗi không xác định"}`,
      true
    );
  } finally {
    setLoading(false);
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

    await refreshData(false, parseDateKey(dateKey), true);

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
// THU NHẬP CÁ NHÂN + TIỀN CƠM THEO TUẦN
// =====================================================

function updateSalaryAccessLabels() {
  const year = appState.salaryDate.getFullYear();
  const month = appState.salaryDate.getMonth() + 1;
  const label = `Tháng ${month}/${year}`;

  setText("#salaryMonthLabel", label);
  setText("#salaryAccessMonthLabel", label);
}


function setSalaryPrivacyState(revealed) {
  appState.salaryRevealed = Boolean(revealed);

  if (!appState.salaryRevealed) {
    appState.salaryRevealToken += 1;
  }

  const gate = $("#salaryAccessGate");
  const content = $("#salaryPrivateContent");

  if (gate) {
    gate.hidden = appState.salaryRevealed;
  }

  if (content) {
    content.hidden = !appState.salaryRevealed;
  }

  if (!appState.salaryRevealed) {
    closeAllPayrollInlineEditors();
    closeModal("fuelPayrollEditorModal");
    closeModal("insurancePayrollEditorModal");
  }

  updateSalaryAccessLabels();
  refreshIcons();
}


async function openSalary() {
  appState.salaryDate = new Date();
  setSalaryPrivacyState(false);
  openModal("salaryModal");
}


async function changeSalaryMonth(direction) {
  appState.salaryDate.setDate(1);
  appState.salaryDate.setMonth(appState.salaryDate.getMonth() + direction);
  setSalaryPrivacyState(false);
}


async function revealSalary() {
  updateSalaryAccessLabels();

  const targetDate = new Date(appState.salaryDate);
  const monthKey = getMonthKey(targetDate);
  const token = appState.salaryRevealToken + 1;
  appState.salaryRevealToken = token;

  await loadMonthData(targetDate, { showLoader: true, force: false });

  if (
    appState.salaryRevealToken !== token ||
    getMonthKey(appState.salaryDate) !== monthKey ||
    !$("#salaryModal")?.classList.contains("show")
  ) {
    return;
  }

  ensurePayrollDraft(monthKey, true);
  setSalaryPrivacyState(true);
  renderSalary();
}


function handleReportSalaryInput(event) {
  const monthKey = getMonthKey(appState.salaryDate);
  const draft = ensurePayrollDraft(monthKey);
  draft.baseSalary = parsePayrollMoney(event.target.value);
  draft.dirty = true;
  renderSalary();
}


function syncSalaryInputs(source) {
  const settingsValue = appState.settings?.baseSalary || 0;

  if (source !== "report") {
    const monthKey = getMonthKey(appState.salaryDate);
    const draft = appState.payrollDrafts[monthKey];
    setPayrollMoneyInput(
      "#baseSalaryInput",
      draft ? draft.baseSalary : settingsValue
    );
  }

  if (source !== "settings") {
    setValue("#settingsBaseSalary", settingsValue || "");
  }
}


function updatePayrollConditionalRows(result, draft) {
  const settings = result.settings;
  const effectiveInsuranceMode = result.insuranceMode;

  $$('[data-payroll-setting]').forEach(row => {
    const key = row.dataset.payrollSetting;
    let enabled = true;

    if (key === "fuelEnabled") {
      enabled = result.fuelEnabled;
    } else if (key === "insuranceMode") {
      enabled = effectiveInsuranceMode !== "disabled";
    } else if (key && key.endsWith("Mode")) {
      enabled = settings[key] !== "disabled";
    }

    row.hidden = !enabled;
    row.classList.toggle("is-disabled", !enabled);

    if (!enabled) {
      const editorId = row.getAttribute("aria-controls");
      const editor = editorId ? document.getElementById(editorId) : null;

      if (editor?.classList.contains("payroll-inline-editor")) {
        editor.hidden = true;
      }

      row.setAttribute("aria-expanded", "false");
    }
  });
}


function renderSalary() {
  updateSalaryAccessLabels();

  if (!appState.settings || !appState.salaryRevealed) {
    return;
  }

  const year = appState.salaryDate.getFullYear();
  const month = appState.salaryDate.getMonth();
  const monthKey = `${year}-${pad(month + 1)}`;
  const draft = ensurePayrollDraft(monthKey);
  const result = calculatePayroll(monthKey, draft);
  const saved = appState.payrollMonths[monthKey];

  setText("#salaryMonthLabel", `Tháng ${month + 1}/${year}`);

  setText("#payrollTotalIncome", formatPayrollMoney(result.totalIncome));
  setText("#payrollTotalDeductions", formatPayrollMoney(result.totalDeductions));
  setText("#payrollNetSalary", formatPayrollMoney(result.netSalary));
  setText("#payrollQuickOT", formatHours(result.totalOT));
  setText("#payrollQuickPaidDays", `${formatNumber(result.paidDays)} công`);

  setText("#payrollStandardDays", `${formatNumber(result.standardDays)} công`);
  setText("#payrollPaidDays", `${formatNumber(result.paidDays)} công`);
  setText("#payrollLeaveOpening", formatDayAmount(result.leave.opening));
  setText("#payrollLeaveAccrued", formatDayAmount(result.leave.accrued));
  setText("#payrollLeaveUsed", formatDayAmount(result.leave.used));
  setText("#payrollUnpaidLeave", formatDayAmount(result.leave.unpaid));
  setText("#payrollLeaveClosing", formatDayAmount(result.leave.closing));
  setText("#salaryOTHours", formatHours(result.totalOT));

  setText("#payrollWorkingSalary", formatPayrollMoney(result.workingSalary));
  setText("#overtimeMoney", formatPayrollMoney(result.overtimeMoney));
  setText(
    "#salaryFormulaDescription",
    `Lương / ${formatNumber(result.standardDays)} công / ${formatNumber(result.standardHours)} giờ × ${formatNumber(result.otMultiplier)} × tổng OT.`
  );

  setText("#payrollMainAllowanceMode", result.allowances.main.label);
  setText("#payrollMainAllowance", formatPayrollMoney(result.allowances.main.value));
  setText("#payrollOtherAllowanceMode", result.allowances.other.label);
  setText("#payrollOtherAllowance", formatPayrollMoney(result.allowances.other.value));
  setText("#payrollAttendanceAllowanceMode", result.allowances.attendance.label);
  setText("#payrollAttendanceAllowance", formatPayrollMoney(result.allowances.attendance.value));
  setText("#payrollResponsibilityAllowanceMode", result.allowances.responsibility.label);
  setText("#payrollResponsibilityAllowance", formatPayrollMoney(result.allowances.responsibility.value));

  setText("#payrollIncomeSectionTotal", formatPayrollMoney(result.totalIncome));
  setText("#payrollFuelSectionTotal", formatPayrollMoney(result.fuelMoney));
  setText("#payrollFuelMoney", formatPayrollMoney(result.fuelMoney));
  setText(
    "#payrollFuelFormula",
    `${formatNumber(result.monthlyKm)} km × ${formatPayrollMoney(result.fuelRate)}/km`
  );

  setText(
    "#payrollOtherIncomeDescription",
    draft.otherIncomeNote || (result.otherIncome > 0 ? "Khoản cộng riêng của tháng" : "Chưa có khoản cộng")
  );
  setText("#payrollOtherIncomeMoney", formatPayrollMoney(result.otherIncome));

  setText("#payrollInsuranceDescription", result.insuranceDescription);
  setText("#payrollInsuranceMoney", formatPayrollMoney(result.insuranceMoney));
  setText("#payrollAdvanceMoney", formatPayrollMoney(result.advance));
  setText(
    "#payrollOtherDeductionDescription",
    draft.otherDeductionNote || (result.otherDeduction > 0 ? "Khoản trừ riêng của tháng" : "Chưa có khoản trừ")
  );
  setText("#payrollOtherDeductionMoney", formatPayrollMoney(result.otherDeduction));
  setText("#payrollDeductionSectionTotal", formatPayrollMoney(result.totalDeductions));
  setText("#payrollTotalDeductionsLine", formatPayrollMoney(result.totalDeductions));

  setText("#payrollUnpaidLeaveReduction", formatPayrollMoney(result.unpaidLeaveReduction));
  $("#payrollUnpaidLeaveInformation")?.classList.toggle(
    "hidden",
    result.leave.unpaid <= 0
  );

  const attendanceBadge = $("#payrollAttendanceBadge");
  if (attendanceBadge) {
    attendanceBadge.classList.remove(
      "auto-badge",
      "saved-badge",
      "changed-badge",
      "unpaid-leave-badge"
    );

    if (result.leave.unpaid > 0) {
      attendanceBadge.textContent = "Có nghỉ không lương";
      attendanceBadge.classList.add("unpaid-leave-badge");
    } else if (result.leave.used > 0) {
      attendanceBadge.textContent = "Đã dùng phép";
      attendanceBadge.classList.add("saved-badge");
    } else {
      attendanceBadge.textContent = "Tự động";
      attendanceBadge.classList.add("auto-badge");
    }
  }

  updatePayrollConditionalRows(result, draft);

  const snapshotText = saved && !draft.dirty
    ? `Đã lưu ${formatSavedTime(saved.savedAt)}`
    : draft.dirty
      ? "Có thay đổi chưa lưu"
      : "Chưa lưu bảng lương tháng";

  setText("#payrollSnapshotStatus", snapshotText);
  setText("#payrollSaveStatus", snapshotText);

  const saveStatus = $("#payrollSaveStatus");
  saveStatus?.classList.toggle("success", Boolean(saved && !draft.dirty));
  saveStatus?.classList.remove("error");

  const saveButton = $("#savePayrollMonthButton");
  const resetButton = $("#resetPayrollMonthButton");

  if (saveButton) {
    saveButton.disabled = Boolean(saved && !draft.dirty);
  }

  if (resetButton) {
    resetButton.disabled = !saved && !draft.dirty;
  }

  $("#salaryReportBody")?.classList.toggle("has-unsaved-changes", draft.dirty);

  const alert = $("#payrollAlert");
  if (alert) {
    const showAlert = result.leave.unpaid > 0;
    alert.classList.toggle("hidden", !showAlert);
    setText(
      "#payrollAlertMessage",
      showAlert
        ? `${formatDayAmount(result.leave.unpaid)} nghỉ vượt phép đã làm giảm lương làm việc ${formatPayrollMoney(result.unpaidLeaveReduction)}.`
        : ""
    );
  }

  if (appState.activePayrollInlineEditor) {
    populatePayrollInlineEditor(appState.activePayrollInlineEditor);
  }
}


async function openMeal() {
  appState.mealDate = new Date();
  syncMealPriceInputs("settings");
  openModal("mealModal");
  await loadMealReportData(appState.mealDate, { showLoader: true, force: true });
  renderMeal();
}


async function changeMealMonth(direction) {
  appState.mealDate.setDate(1);
  appState.mealDate.setMonth(appState.mealDate.getMonth() + direction);
  await loadMealReportData(appState.mealDate, { showLoader: true, force: false });
  renderMeal();
}


function handleReportMealPriceInput(event) {
  appState.settings.mealPrice = sanitizeNonNegativeNumber(event.target.value);
  saveSettings();
  syncMealPriceInputs("report");
  renderMeal();
}


function syncMealPriceInputs(source) {
  const value = appState.settings?.mealPrice ?? 30000;

  if (source !== "report") {
    setValue("#mealPriceInput", value);
  }

  if (source !== "settings") {
    setValue("#settingsMealPrice", value);
  }
}


function getMealReceiptStorageKey() {
  return `ot_meal_weekly_receipts_${appState.currentUser || "guest"}`;
}


function loadMealReceiptLocalData() {
  appState.mealReceipts = {};
  appState.mealReportRowsByMonth = {};
  appState.mealReportLoadedMonths = new Set();
  appState.mealReportRequestTokens = {};
  appState.selectedMealReceiptWeek = null;

  try {
    const stored = JSON.parse(
      localStorage.getItem(getMealReceiptStorageKey()) || "{}"
    );

    if (stored && typeof stored === "object" && !Array.isArray(stored)) {
      Object.values(stored).forEach(item => {
        const normalized = normalizeMealReceipt(item);

        if (normalized) {
          appState.mealReceipts[normalized.weekStart] = normalized;
        }
      });
    }
  } catch {
    appState.mealReceipts = {};
  }
}


function saveMealReceiptCache() {
  localStorage.setItem(
    getMealReceiptStorageKey(),
    JSON.stringify(appState.mealReceipts)
  );
}


function normalizeMealReceipt(value) {
  const weekStart = String(value?.weekStart || value?.week_start || "").slice(0, 10);
  const weekEnd = String(value?.weekEnd || value?.week_end || "").slice(0, 10);

  if (
    !/^\d{4}-\d{2}-\d{2}$/.test(weekStart) ||
    !/^\d{4}-\d{2}-\d{2}$/.test(weekEnd)
  ) {
    return null;
  }

  const status = value?.status === "received" ? "received" : "pending";

  return {
    weekStart,
    weekEnd,
    mealCountSnapshot: Math.max(
      0,
      Math.floor(Number(value?.mealCountSnapshot ?? value?.meal_count_snapshot) || 0)
    ),
    mealPriceSnapshot: sanitizeNonNegativeNumber(
      value?.mealPriceSnapshot ?? value?.meal_price_snapshot
    ),
    amountSnapshot: sanitizeNonNegativeNumber(
      value?.amountSnapshot ?? value?.amount_snapshot
    ),
    status,
    receivedAt: value?.receivedAt || value?.received_at || null,
    note: String(value?.note || ""),
    updatedAt: value?.updatedAt || value?.updated_at || null
  };
}


function isMissingMealReceiptTableError(error) {
  const code = String(error?.code || "");
  const message = String(error?.message || "").toLowerCase();
  const mentionsMealReceiptTable = message.includes("meal_weekly_receipts");

  return (
    mentionsMealReceiptTable &&
    (
      code === "42P01" ||
      code === "PGRST205" ||
      message.includes("not found") ||
      message.includes("does not exist")
    )
  );
}


function addCalendarDays(date, amount) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}


function getMonday(date) {
  const result = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  const day = result.getDay();
  const offset = day === 0 ? -6 : 1 - day;
  result.setDate(result.getDate() + offset);
  return result;
}


function getMealMonthRange(value) {
  const monthKey = getMonthKey(value);
  const [year, month] = monthKey.split("-").map(Number);
  const firstDay = new Date(year, month - 1, 1);
  const lastDay = new Date(year, month, 0);
  const rangeStartDate = getMonday(firstDay);
  const lastWeekStartDate = getMonday(lastDay);
  const rangeEndDate = addCalendarDays(lastWeekStartDate, 6);

  return {
    monthKey,
    year,
    monthIndex: month - 1,
    rangeStart: getDateKey(rangeStartDate),
    rangeEnd: getDateKey(rangeEndDate),
    lastWeekStart: getDateKey(lastWeekStartDate)
  };
}


async function loadMealReportData(
  target,
  { showLoader = false, force = false } = {}
) {
  if (!appState.currentUser) {
    return;
  }

  const range = getMealMonthRange(target);

  if (appState.mealReportLoadedMonths.has(range.monthKey) && !force) {
    renderMeal();
    return;
  }

  const token = (appState.mealReportRequestTokens[range.monthKey] || 0) + 1;
  appState.mealReportRequestTokens[range.monthKey] = token;

  if (showLoader) {
    setLoading(true);
  }

  try {
    const workResult = await supabaseClient
      .from("work_logs")
      .select("work_date,meal_count")
      .eq("username", appState.currentUser)
      .gte("work_date", range.rangeStart)
      .lte("work_date", range.rangeEnd)
      .order("work_date", { ascending: true });

    if (workResult.error) {
      throw workResult.error;
    }

    const receiptResult = await supabaseClient
      .from("meal_weekly_receipts")
      .select(
        "week_start,week_end,meal_count_snapshot,meal_price_snapshot,amount_snapshot,status,received_at,note,updated_at"
      )
      .eq("username", appState.currentUser)
      .gte("week_start", range.rangeStart)
      .lte("week_start", range.lastWeekStart)
      .order("week_start", { ascending: true });

    if (
      appState.mealReportRequestTokens[range.monthKey] !== token ||
      getMonthKey(appState.mealDate) !== range.monthKey
    ) {
      return;
    }

    appState.mealReportRowsByMonth[range.monthKey] = workResult.data || [];

    if (receiptResult.error) {
      if (isMissingMealReceiptTableError(receiptResult.error)) {
        appState.mealReceiptSupabaseAvailable = false;
        refreshSettingsSyncStatus();
      } else {
        console.warn(
          "Không thể tải trạng thái nhận tiền cơm, đang dùng bộ nhớ máy:",
          receiptResult.error.message
        );
      }
    } else {
      appState.mealReceiptSupabaseAvailable = true;
      refreshSettingsSyncStatus();

      (receiptResult.data || []).forEach(row => {
        const normalized = normalizeMealReceipt(row);

        if (normalized) {
          appState.mealReceipts[normalized.weekStart] = normalized;
        }
      });

      saveMealReceiptCache();
    }

    appState.mealReportLoadedMonths.add(range.monthKey);
    renderMeal();
  } catch (error) {
    showToast(
      `Không thể tải báo cáo tiền cơm: ${error.message || "Lỗi không xác định"}`,
      true
    );
  } finally {
    if (showLoader) {
      setLoading(false);
    }
  }
}


function buildMealWeeks() {
  const range = getMealMonthRange(appState.mealDate);
  const mealByDate = new Map();

  const currentRows = appState.mealReportRowsByMonth[range.monthKey] || [];

  currentRows.forEach(row => {
    const dateKey = String(row?.work_date || "").slice(0, 10);
    const count = Math.max(0, parseInt(row?.meal_count, 10) || 0);

    if (dateKey) {
      mealByDate.set(dateKey, count);
    }
  });

  const weeks = [];
  let weekStartDate = parseDateKey(range.rangeStart);
  const lastWeekStartDate = parseDateKey(range.lastWeekStart);

  while (weekStartDate <= lastWeekStartDate) {
    const weekEndDate = addCalendarDays(weekStartDate, 6);
    let meals = 0;
    let monthMeals = 0;

    for (let offset = 0; offset < 7; offset += 1) {
      const dateKey = getDateKey(addCalendarDays(weekStartDate, offset));
      const dayMeals = mealByDate.get(dateKey) || 0;
      meals += dayMeals;

      if (dateKey.startsWith(`${range.monthKey}-`)) {
        monthMeals += dayMeals;
      }
    }

    const weekStart = getDateKey(weekStartDate);
    const weekEnd = getDateKey(weekEndDate);
    const price = sanitizeNonNegativeNumber(appState.settings?.mealPrice, 30000);
    const amount = meals * price;
    const monthAmount = monthMeals * price;
    const receipt = appState.mealReceipts[weekStart] || null;
    const received = receipt?.status === "received";
    const snapshotCount = Number(receipt?.mealCountSnapshot || 0);
    const snapshotAmount = Number(receipt?.amountSnapshot || 0);
    const receivedMonthAmount = received && snapshotCount > 0
      ? Math.round(monthMeals * snapshotAmount / snapshotCount)
      : 0;
    const changed = Boolean(
      received &&
      (
        Number(receipt.mealCountSnapshot) !== meals ||
        Number(receipt.mealPriceSnapshot) !== price ||
        Number(receipt.amountSnapshot) !== amount
      )
    );

    weeks.push({
      weekStart,
      weekEnd,
      meals,
      monthMeals,
      price,
      amount,
      monthAmount,
      receipt,
      received,
      receivedMonthAmount,
      changed,
      difference: received ? amount - Number(receipt.amountSnapshot || 0) : amount
    });

    weekStartDate = addCalendarDays(weekStartDate, 7);
  }

  return weeks;
}


function formatMealReceiptTime(value) {
  if (!value) {
    return "Không rõ thời điểm";
  }

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return "Không rõ thời điểm";
  }

  return date.toLocaleString("vi-VN", {
    hour: "2-digit",
    minute: "2-digit",
    day: "2-digit",
    month: "2-digit",
    year: "numeric"
  });
}


function formatSignedPayrollMoney(value) {
  const number = Math.round(Number(value) || 0);

  if (number === 0) {
    return "0₫";
  }

  return `${number > 0 ? "+" : "−"}${formatPayrollMoney(Math.abs(number))}`;
}


function renderMeal() {
  if (!appState.settings) {
    return;
  }

  const year = appState.mealDate.getFullYear();
  const month = appState.mealDate.getMonth();
  const weeks = buildMealWeeks();
  const visibleWeeks = weeks.filter(
    week => week.monthMeals > 0 || (week.received && week.meals > 0)
  );

  setText("#mealMonthLabel", `Tháng ${month + 1}/${year}`);

  const totalMeals = visibleWeeks.reduce((sum, week) => sum + week.monthMeals, 0);
  const totalMoney = visibleWeeks.reduce((sum, week) => sum + week.monthAmount, 0);
  const receivedTotal = visibleWeeks.reduce(
    (sum, week) => sum + (week.received ? week.receivedMonthAmount : 0),
    0
  );
  const pendingTotal = visibleWeeks.reduce(
    (sum, week) => sum + (
      week.received
        ? Math.max(0, week.monthAmount - week.receivedMonthAmount)
        : week.monthAmount
    ),
    0
  );
  const receivedWeeks = visibleWeeks.filter(week => week.received).length;
  const pendingWeeks = visibleWeeks.filter(
    week => !week.received || week.difference > 0
  ).length;

  setText("#totalMealCount", `${totalMeals} phần`);
  setText("#totalMealMoney", formatPayrollMoney(totalMoney));
  setText("#mealReceivedTotal", formatPayrollMoney(receivedTotal));
  setText("#mealPendingTotal", formatPayrollMoney(pendingTotal));
  setText("#mealReceivedWeekCount", `${receivedWeeks} tuần`);
  setText("#mealPendingWeekCount", `${pendingWeeks} tuần`);

  const container = $("#mealWeekList");
  const emptyState = $("#mealEmptyState");

  if (container) {
    container.innerHTML = visibleWeeks.map((week, index) => {
      const statusClass = week.changed
        ? "changed"
        : week.received
          ? "received"
          : "";
      const statusIcon = week.changed
        ? "triangle-alert"
        : week.received
          ? "circle-check"
          : "clock-3";
      const statusText = week.changed
        ? "Dữ liệu thay đổi"
        : week.received
          ? "Đã nhận"
          : "Chưa nhận";
      const buttonDisabled =
        appState.mealReceiptSupabaseAvailable === false ||
        (!week.received && week.meals <= 0);
      const buttonText = appState.mealReceiptSupabaseAvailable === false
        ? "Chưa có bảng Supabase"
        : week.received
          ? "Hủy trạng thái đã nhận"
          : "Đánh dấu đã nhận";
      const buttonIcon = week.received ? "rotate-ccw" : "hand-coins";
      const receivedMeta = week.received
        ? `
          <div class="meal-week-received-meta">
            <i data-lucide="badge-check"></i>
            <span>
              Đã nhận ${formatPayrollMoney(week.receipt.amountSnapshot)} lúc
              ${escapeHTML(formatMealReceiptTime(week.receipt.receivedAt))}.
            </span>
          </div>
        `
        : "";
      const discrepancy = week.changed
        ? `
          <div class="meal-week-discrepancy">
            <span>Theo dữ liệu hiện tại</span>
            <strong>${formatPayrollMoney(week.amount)}</strong>
            <span>Chênh lệch so với lúc nhận</span>
            <strong>${formatSignedPayrollMoney(week.difference)}</strong>
          </div>
        `
        : "";

      return `
        <article class="meal-week-card" data-meal-week="${week.weekStart}">
          <header class="meal-week-card-header">
            <div class="meal-week-title">
              <span>TUẦN ${index + 1}</span>
              <strong>${formatShortDate(week.weekStart)} – ${formatShortDate(week.weekEnd)}</strong>
              <small>${
                week.monthMeals !== week.meals
                  ? `Toàn tuần ${week.meals} phần • Trong tháng ${week.monthMeals} phần`
                  : "Thứ Hai đến Chủ nhật"
              }</small>
            </div>

            <span class="meal-receipt-status ${statusClass}">
              <i data-lucide="${statusIcon}"></i>
              ${statusText}
            </span>
          </header>

          <div class="meal-week-card-body">
            <div class="meal-week-values">
              <div class="meal-week-value">
                <span>SỐ PHẦN</span>
                <strong>${week.meals} phần</strong>
              </div>

              <div class="meal-week-value money-value">
                <span>TIỀN TUẦN</span>
                <strong>${formatPayrollMoney(week.amount)}</strong>
              </div>
            </div>

            ${receivedMeta}
            ${discrepancy}

            <div class="meal-week-actions">
              <button
                type="button"
                class="meal-receipt-button ${week.received ? "received" : ""}"
                data-meal-receipt-action="${week.received ? "unreceive" : "receive"}"
                data-week-start="${week.weekStart}"
                ${buttonDisabled ? "disabled" : ""}
              >
                <i data-lucide="${buttonIcon}"></i>
                ${buttonText}
              </button>
            </div>
          </div>
        </article>
      `;
    }).join("");
  }

  if (emptyState) {
    emptyState.classList.toggle("hidden", visibleWeeks.length > 0);
  }

  refreshIcons();
}


function openMealReceiptConfirmation(weekStart) {
  if (appState.mealReceiptSupabaseAvailable === false) {
    showToast(
      "Chưa có bảng meal_weekly_receipts. Hãy chạy file SQL V8.4 trên Supabase.",
      true
    );
    return;
  }

  const week = buildMealWeeks().find(item => item.weekStart === weekStart);

  if (!week) {
    showToast("Không tìm thấy dữ liệu tuần này.", true);
    return;
  }

  if (!week.received && week.meals <= 0) {
    showToast("Tuần này chưa có phần cơm để đánh dấu nhận.", true);
    return;
  }

  appState.selectedMealReceiptWeek = {
    ...week,
    action: week.received ? "unreceive" : "receive"
  };

  const weekLabel = `Tuần ${formatShortDate(week.weekStart)} – ${formatShortDate(week.weekEnd)}`;
  setText("#mealReceiptConfirmWeek", weekLabel);

  if (week.received) {
    setText("#mealReceiptConfirmTitle", "Hủy trạng thái đã nhận");
    setText(
      "#mealReceiptConfirmDescription",
      `Tuần này đã ghi nhận ${formatPayrollMoney(week.receipt.amountSnapshot)}. Hủy trạng thái sẽ đưa tuần về chưa nhận nhưng không xóa dữ liệu phần cơm.`
    );
    setText("#confirmMealReceiptActionButton", "Hủy đã nhận");
  } else {
    setText("#mealReceiptConfirmTitle", "Xác nhận đã nhận tiền");
    setText(
      "#mealReceiptConfirmDescription",
      `Xác nhận đã nhận ${formatPayrollMoney(week.amount)} cho ${week.meals} phần. Số liệu này sẽ được lưu làm bản chụp trên Supabase.`
    );
    setText("#confirmMealReceiptActionButton", "Đã nhận tiền");
  }

  openModal("mealReceiptConfirmModal");
}


async function confirmMealReceiptAction() {
  const selected = appState.selectedMealReceiptWeek;

  if (!selected || !appState.currentUser) {
    closeModal("mealReceiptConfirmModal");
    return;
  }

  const now = new Date().toISOString();
  const received = selected.action === "receive";
  const payload = {
    username: appState.currentUser,
    week_start: selected.weekStart,
    week_end: selected.weekEnd,
    meal_count_snapshot: selected.meals,
    meal_price_snapshot: selected.price,
    amount_snapshot: selected.amount,
    status: received ? "received" : "pending",
    received_at: received ? now : null,
    note: selected.receipt?.note || ""
  };

  const { data, error } = await supabaseClient
    .from("meal_weekly_receipts")
    .upsert(payload, { onConflict: "username,week_start" })
    .select(
      "week_start,week_end,meal_count_snapshot,meal_price_snapshot,amount_snapshot,status,received_at,note,updated_at"
    )
    .single();

  if (error) {
    if (isMissingMealReceiptTableError(error)) {
      appState.mealReceiptSupabaseAvailable = false;
      renderMeal();
      throw new Error(
        "Chưa có bảng meal_weekly_receipts. Hãy chạy file SQL V8.4 trước."
      );
    }

    throw error;
  }

  appState.mealReceiptSupabaseAvailable = true;
  refreshSettingsSyncStatus();
  const normalized = normalizeMealReceipt(data);

  if (normalized) {
    appState.mealReceipts[normalized.weekStart] = normalized;
    saveMealReceiptCache();
  }

  closeModal("mealReceiptConfirmModal");
  renderMeal();
  showToast(received ? "Đã ghi nhận tuần này đã nhận tiền." : "Đã hủy trạng thái nhận tiền của tuần.");
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
  setSettingsTab(appState.activeSettingsTab || "general");
  refreshSettingsSyncStatus();

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

  if (id === "salaryModal") {
    setSalaryPrivacyState(false);
  }

  if (id === "mealReceiptConfirmModal") {
    appState.selectedMealReceiptWeek = null;
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