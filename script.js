"use strict";

// =====================================================
// OT PRO V8.7 SETTINGS TABS
// Giữ nguyên users, work_logs và extra_shifts.
// Cài đặt lương, ngày nghỉ và bảng lương đồng bộ với Supabase,
// đồng thời giữ localStorage làm bộ nhớ dự phòng.
// =====================================================


const APP_VERSION = "OT Pro V8.7 Settings Tabs";

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

const INCOME_POLICY_NUMERIC_FIELDS = Object.freeze([
  "baseSalary",
  "standardWorkDays",
  "standardHours",
  "otMultiplier",
  "mainAllowance",
  "otherAllowance",
  "attendanceAllowance",
  "responsibilityAllowance",
  "fuelRate",
  "insuranceBase",
  "insuranceRate",
  "insuranceFixedAmount"
]);

const INCOME_POLICY_MODE_FIELDS = Object.freeze([
  "mainAllowanceMode",
  "otherAllowanceMode",
  "attendanceAllowanceMode",
  "responsibilityAllowanceMode",
  "insuranceMode"
]);

const INCOME_POLICY_FIELDS = Object.freeze([
  ...INCOME_POLICY_NUMERIC_FIELDS,
  ...INCOME_POLICY_MODE_FIELDS
]);

const INCOME_POLICY_META = Object.freeze({
  baseSalary: { label: "Lương cơ bản", unit: "đ", kind: "money" },
  standardWorkDays: { label: "Ngày công tiêu chuẩn", unit: "công", kind: "number" },
  standardHours: { label: "Giờ tiêu chuẩn/ngày", unit: "giờ", kind: "number" },
  otMultiplier: { label: "Hệ số OT", unit: "lần", kind: "number" },
  mainAllowance: { label: "Phụ cấp", unit: "đ", kind: "money" },
  otherAllowance: { label: "Phụ cấp khác", unit: "đ", kind: "money" },
  attendanceAllowance: { label: "Phụ cấp chuyên cần", unit: "đ", kind: "money" },
  responsibilityAllowance: { label: "Phụ cấp trách nhiệm", unit: "đ", kind: "money" },
  fuelRate: { label: "Đơn giá giao hàng", unit: "đ/km", kind: "money-rate" },
  insuranceBase: { label: "Mức lương đóng bảo hiểm", unit: "đ", kind: "money" },
  insuranceRate: { label: "Tỷ lệ bảo hiểm", unit: "%", kind: "number" },
  insuranceFixedAmount: { label: "Bảo hiểm cố định", unit: "đ", kind: "money" },
  mainAllowanceMode: { label: "Cách tính phụ cấp", unit: "", kind: "mode" },
  otherAllowanceMode: { label: "Cách tính phụ cấp khác", unit: "", kind: "mode" },
  attendanceAllowanceMode: { label: "Cách tính chuyên cần", unit: "", kind: "mode" },
  responsibilityAllowanceMode: { label: "Cách tính trách nhiệm", unit: "", kind: "mode" },
  insuranceMode: { label: "Cách tính bảo hiểm", unit: "", kind: "mode" }
});

const SETTINGS_TABS =
  Object.freeze([
    "general",
    "income",
    "benefits",
    "account"
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
  settingsDirty: false,
  settingsClosing: false,
  settingsOpenSnapshot: null,
  activePayrollInlineEditor: null,

  salaryRevealed: false,
  salaryRevealToken: 0,
  salaryComparison: null,
  salaryChartYear: new Date().getFullYear(),
  salaryChartMetric: "ot-hours",
  salaryChartData: null,
  salaryChartSelectedIndex: null,

  mealReportRowsByMonth: {},
  mealReportLoadedMonths: new Set(),
  mealReportRequestTokens: {},
  mealReceipts: {},
  mealReceiptSupabaseAvailable: null,
  selectedMealReceiptWeek: null,

  pendingSalaryRevisions: [],

  endShiftNoteContext: null,

  hrOtDate: new Date(new Date().getFullYear(), new Date().getMonth(), 1),
  advancedUnlockTapCount: 0,
  advancedUnlockTimer: null
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
    () => requestCloseSettings({ afterClose: logout })
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
    "#hrOtButton",
    "click",
    openHrOt
  );

  on(
    "#hrOtPrevMonth",
    "click",
    () => changeHrOtMonth(-1)
  );

  on(
    "#hrOtNextMonth",
    "click",
    () => changeHrOtMonth(1)
  );

  on(
    "#hrOtTableBody",
    "input",
    handleHrOtCellInput
  );

  on(
    "#hrOtTableBody",
    "focusin",
    event => {
      if (event.target.matches(".hr-ot-input")) {
        window.requestAnimationFrame(() => event.target.select());
      }
    }
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
    () => {
      calculateDetailMainOT();

      suggestMealCount(
        $("#detailEndTime")
          ?.value || ""
      );
    }
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

  on(
    "#saveEndShiftNoteButton",
    "click",
    () => runLockedAction(
      "saveEndShiftNote",
      ["#saveEndShiftNoteButton", "#cancelEndShiftNoteButton"],
      saveEndShiftNote
    )
  );

  on(
    "#cancelEndShiftNoteButton",
    "click",
    () => closeModal("endShiftNoteModal")
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
  const tabButtons =
    $$('[data-settings-tab]');

  tabButtons.forEach((button, index) => {
    button.addEventListener("click", () => {
      setSettingsTab(
        button.dataset.settingsTab || "general",
        { focus: false }
      );
    });

    button.addEventListener("keydown", event => {
      handleSettingsTabKeydown(
        event,
        index,
        tabButtons
      );
    });
  });

  on("#settingsSyncButton", "click", () =>
    runLockedAction(
      "settingsSupabaseSync",
      ["#settingsSyncButton"],
      syncSettingsManually
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

  on("#promptNoteAfterShiftEndToggle", "change", event => {
    appState.settings.promptNoteAfterShiftEnd = event.target.checked;
    saveSettings();
  });

  on("#settingsVersionRow", "click", handleSettingsVersionTap);

  on("#hrOtFeatureToggle", "change", event => {
    setHrOtFeatureEnabled(event.target.checked);
    refreshAdvancedFeatureUI();

    showToast(
      event.target.checked
        ? "Đã bật Bảng OT HR."
        : "Đã ẩn Bảng OT HR khỏi Menu."
    );
  });

  on("#hideAdvancedFeaturesButton", "click", () => {
    setAdvancedFeaturesUnlocked(false);
    refreshAdvancedFeatureUI();
    showToast("Đã ẩn tính năng nâng cao.");
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
      const previousValue = appState.settings[key];

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

      if (
        key === "baseSalary" &&
        !sanitizeSalaryHistory(appState.settings.salaryHistory).length &&
        !hasGeneralIncomeHistory(appState.settings)
      ) {
        appState.settings.salaryHistoryBaseAmount =
          appState.settings.baseSalary;
      }

      trackCurrentIncomePolicySettingChange(key, appState.settings[key], previousValue);
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

      renderDashboard();
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
      const previousValue = appState.settings[key];
      appState.settings[key] = event.target.value;
      trackCurrentIncomePolicySettingChange(key, appState.settings[key], previousValue);
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
  on("#addIncomeHistoryButton", "click", addIncomeHistoryEntry);
  on("#incomeHistoryField", "change", updateIncomeHistoryEditor);
  on("#salaryHistoryResolveButton", "click", openSalaryRevisionModalIfNeeded);

  on("#salaryHistoryList", "click", event => {
    const button = event.target.closest("[data-delete-income-history]");

    if (!button) {
      return;
    }

    deleteIncomeHistoryEntry(button.dataset.deleteIncomeHistory || "");
  });

  on("#salaryRevisionLaterButton", "click", () => {
    closeModal("salaryRevisionModal");
  });

  on("#salaryRevisionUpdatePastButton", "click", () =>
    runLockedAction(
      "salaryRevisionUpdatePast",
      ["#salaryRevisionUpdatePastButton", "#salaryRevisionCarryForwardButton"],
      applySalaryRevisionToSavedMonths
    )
  );

  on("#salaryRevisionCarryForwardButton", "click", () =>
    runLockedAction(
      "salaryRevisionCarryForward",
      ["#salaryRevisionUpdatePastButton", "#salaryRevisionCarryForwardButton"],
      carrySalaryRevisionToCurrentMonth
    )
  );

  on("#openSalaryCompareButton", "click", openSalaryCompare);
  on("#openSalaryChartButton", "click", openSalaryChart);
  on("#salaryChartCloseButton", "click", () => closeModal("salaryChartModal"));
  on("#salaryChartPrevYear", "click", () => changeSalaryChartYear(-1));
  on("#salaryChartNextYear", "click", () => changeSalaryChartYear(1));

  $$('[data-salary-chart-metric]').forEach(button => {
    button.addEventListener("click", () => {
      setSalaryChartMetric(button.dataset.salaryChartMetric || "ot-hours");
    });
  });

  on("#salaryChartCanvas", "click", event => {
    const point = event.target.closest("[data-salary-chart-index]");
    if (point) {
      selectSalaryChartPoint(Number(point.dataset.salaryChartIndex));
    }
  });

  on("#salaryChartCanvas", "keydown", event => {
    const point = event.target.closest("[data-salary-chart-index]");
    if (!point || !["Enter", " "].includes(event.key)) {
      return;
    }
    event.preventDefault();
    selectSalaryChartPoint(Number(point.dataset.salaryChartIndex));
  });

  on("#salaryCompareCloseButton", "click", () => closeModal("salaryCompareModal"));
  on("#salaryCompareRunButton", "click", () =>
    runLockedAction(
      "salaryCompare",
      ["#salaryCompareRunButton"],
      runSalaryComparison
    )
  );
  on("#salaryCompareChangedOnly", "change", renderLastSalaryComparison);
  on("#salaryCompareMonth", "change", () => {
    appState.salaryComparison = null;
  });

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


function sanitizeSalaryHistory(value) {
  const unique = new Map();

  (Array.isArray(value) ? value : []).forEach(item => {
    const effectiveMonth = String(
      item?.effectiveMonth || item?.effectiveDate || ""
    ).slice(0, 7);
    const amount = sanitizeNonNegativeNumber(item?.amount, -1);

    if (
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveMonth) ||
      amount < 0
    ) {
      return;
    }

    unique.set(effectiveMonth, {
      effectiveMonth,
      amount,
      createdAt: item?.createdAt || null
    });
  });

  return Array.from(unique.values())
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
}




function sanitizeIncomePolicyValue(key, value, fallback = 0) {
  if (INCOME_POLICY_MODE_FIELDS.includes(key)) {
    if (key === "insuranceMode") {
      return INSURANCE_MODES.includes(value) ? value : "percentage";
    }
    return ALLOWANCE_MODES.includes(value) ? value : "fixed";
  }

  if (["standardWorkDays", "standardHours", "otMultiplier"].includes(key)) {
    return sanitizePositiveNumber(value, sanitizePositiveNumber(fallback, 1));
  }

  return sanitizeNonNegativeNumber(value, sanitizeNonNegativeNumber(fallback));
}


function getRawIncomePolicyFromSettings(settings = {}) {
  const defaults = getDefaultSettings();
  const result = {};

  INCOME_POLICY_FIELDS.forEach(key => {
    result[key] = sanitizeIncomePolicyValue(
      key,
      settings?.[key],
      defaults[key]
    );
  });

  return result;
}


function sanitizeIncomeHistoryBase(value, fallbackSettings = {}) {
  const fallback = getRawIncomePolicyFromSettings(fallbackSettings);
  const source = value && typeof value === "object" && !Array.isArray(value)
    ? value
    : {};
  const result = {};

  INCOME_POLICY_FIELDS.forEach(key => {
    result[key] = sanitizeIncomePolicyValue(
      key,
      source[key],
      fallback[key]
    );
  });

  return result;
}


function sanitizeIncomeHistory(value) {
  const unique = new Map();

  (Array.isArray(value) ? value : []).forEach(item => {
    const effectiveMonth = String(
      item?.effectiveMonth || item?.effectiveDate || ""
    ).slice(0, 7);

    if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveMonth)) {
      return;
    }

    const rawChanges = item?.changes && typeof item.changes === "object"
      ? item.changes
      : {};
    const changes = {};

    INCOME_POLICY_FIELDS.forEach(key => {
      if (!Object.prototype.hasOwnProperty.call(rawChanges, key)) {
        return;
      }

      changes[key] = sanitizeIncomePolicyValue(key, rawChanges[key]);
    });

    if (!Object.keys(changes).length) {
      return;
    }

    const previous = unique.get(effectiveMonth);
    unique.set(effectiveMonth, {
      effectiveMonth,
      changes: {
        ...(previous?.changes || {}),
        ...changes
      },
      createdAt: item?.createdAt || previous?.createdAt || null
    });
  });

  return Array.from(unique.values())
    .sort((a, b) => a.effectiveMonth.localeCompare(b.effectiveMonth));
}


function normalizeIncomeHistoryAgainstBase(value, baseSettings = appState.settings?.incomeHistoryBase) {
  const history = sanitizeIncomeHistory(value);
  const fallback = getRawIncomePolicyFromSettings(appState.settings || {});
  const policy = sanitizeIncomeHistoryBase(baseSettings, fallback);
  const normalized = [];

  history.forEach(item => {
    const changes = {};

    Object.entries(item.changes || {}).forEach(([key, rawValue]) => {
      if (!INCOME_POLICY_FIELDS.includes(key)) {
        return;
      }

      const value = sanitizeIncomePolicyValue(key, rawValue, policy[key]);
      const isSame = INCOME_POLICY_MODE_FIELDS.includes(key)
        ? String(value) === String(policy[key])
        : Math.abs(Number(value || 0) - Number(policy[key] || 0)) <= 0.0001;

      if (!isSame) {
        changes[key] = value;
      }

      policy[key] = value;
    });

    if (Object.keys(changes).length) {
      normalized.push({
        effectiveMonth: item.effectiveMonth,
        changes,
        createdAt: item.createdAt || null
      });
    }
  });

  return normalized;
}


function hasGeneralIncomeHistory(settings = appState.settings) {
  return sanitizeIncomeHistory(settings?.incomeHistory).length > 0;
}


function getIncomePolicyForMonth(monthKey, settings = appState.settings) {
  const raw = getRawIncomePolicyFromSettings(settings || {});
  const history = sanitizeIncomeHistory(settings?.incomeHistory);

  if (history.length) {
    const policy = sanitizeIncomeHistoryBase(settings?.incomeHistoryBase, raw);

    history.forEach(item => {
      if (item.effectiveMonth <= monthKey) {
        Object.entries(item.changes).forEach(([key, value]) => {
          policy[key] = sanitizeIncomePolicyValue(key, value, policy[key]);
        });
      }
    });

    return policy;
  }

  // Tương thích dữ liệu cũ: lịch sử mức lương chỉ tác động lương cơ bản.
  const legacySalaryHistory = sanitizeSalaryHistory(settings?.salaryHistory);

  if (legacySalaryHistory.length) {
    raw.baseSalary = resolveSalaryForMonth(
      monthKey,
      legacySalaryHistory,
      sanitizeNonNegativeNumber(
        settings?.salaryHistoryBaseAmount,
        raw.baseSalary
      )
    );
  }

  return raw;
}


function getPolicyBeforeIncomeHistoryMonth(effectiveMonth, settings = appState.settings) {
  const raw = getRawIncomePolicyFromSettings(settings || {});
  const history = sanitizeIncomeHistory(settings?.incomeHistory);

  if (!history.length) {
    if (
      settings?.incomeHistoryBase &&
      typeof settings.incomeHistoryBase === "object" &&
      !Array.isArray(settings.incomeHistoryBase)
    ) {
      return sanitizeIncomeHistoryBase(settings.incomeHistoryBase, raw);
    }

    const legacy = sanitizeSalaryHistory(settings?.salaryHistory);
    const previousMonthDate = new Date(`${effectiveMonth}-01T00:00:00`);
    previousMonthDate.setMonth(previousMonthDate.getMonth() - 1);
    return getIncomePolicyForMonth(getMonthKey(previousMonthDate), settings);
  }

  const policy = sanitizeIncomeHistoryBase(settings?.incomeHistoryBase, raw);

  history.forEach(item => {
    if (item.effectiveMonth < effectiveMonth) {
      Object.entries(item.changes).forEach(([key, value]) => {
        policy[key] = sanitizeIncomePolicyValue(key, value, policy[key]);
      });
    }
  });

  return policy;
}


function ensureIncomeHistoryInitialized() {
  if (hasGeneralIncomeHistory(appState.settings)) {
    return;
  }

  const raw = getRawIncomePolicyFromSettings(appState.settings || {});
  const legacy = sanitizeSalaryHistory(appState.settings?.salaryHistory);
  const existingBase =
    appState.settings?.incomeHistoryBase &&
    typeof appState.settings.incomeHistoryBase === "object" &&
    !Array.isArray(appState.settings.incomeHistoryBase)
      ? sanitizeIncomeHistoryBase(appState.settings.incomeHistoryBase, raw)
      : null;
  const base = existingBase || { ...raw };
  const history = [];

  if (legacy.length) {
    base.baseSalary = sanitizeNonNegativeNumber(
      appState.settings?.salaryHistoryBaseAmount,
      raw.baseSalary
    );

    legacy.forEach(item => {
      history.push({
        effectiveMonth: item.effectiveMonth,
        changes: { baseSalary: item.amount },
        createdAt: item.createdAt || new Date().toISOString()
      });
    });
  }

  appState.settings.incomeHistoryBase = base;
  appState.settings.incomeHistory = sanitizeIncomeHistory(history);

  // Sau khi đã chuyển dữ liệu lương cũ sang cấu trúc mới, không dùng lại
  // salaryHistory để tránh các mốc cũ xuất hiện lần hai khi xóa/sửa lịch sử mới.
  if (legacy.length) {
    appState.settings.salaryHistory = [];
  }
}


function applyCurrentIncomePolicyToSettings(settings = appState.settings) {
  if (!settings || !sanitizeIncomeHistory(settings.incomeHistory).length) {
    return settings;
  }

  const policy = getIncomePolicyForMonth(getMonthKey(new Date()), settings);

  INCOME_POLICY_FIELDS.forEach(key => {
    settings[key] = policy[key];
  });

  return settings;
}


function upsertIncomeHistoryChange(effectiveMonth, key, value) {
  if (!INCOME_POLICY_FIELDS.includes(key)) {
    return false;
  }

  ensureIncomeHistoryInitialized();

  // Nếu chỉ vừa khởi tạo từ cấu hình hiện tại mà chưa có event nào,
  // base là trạng thái trước thay đổi đầu tiên.
  if (!appState.settings.incomeHistoryBase) {
    appState.settings.incomeHistoryBase = getRawIncomePolicyFromSettings(appState.settings);
  }

  const history = sanitizeIncomeHistory(appState.settings.incomeHistory);
  const previousPolicy = getPolicyBeforeIncomeHistoryMonth(effectiveMonth, {
    ...appState.settings,
    incomeHistory: history
  });
  const normalizedValue = sanitizeIncomePolicyValue(key, value, previousPolicy[key]);
  const index = history.findIndex(item => item.effectiveMonth === effectiveMonth);
  const entry = index >= 0
    ? { ...history[index], changes: { ...history[index].changes } }
    : { effectiveMonth, changes: {}, createdAt: new Date().toISOString() };

  if (String(normalizedValue) === String(previousPolicy[key])) {
    delete entry.changes[key];
  } else {
    entry.changes[key] = normalizedValue;
  }

  if (index >= 0) {
    history.splice(index, 1);
  }

  if (Object.keys(entry.changes).length) {
    history.push(entry);
  }

  appState.settings.incomeHistory = normalizeIncomeHistoryAgainstBase(
    history,
    appState.settings.incomeHistoryBase
  );
  applyCurrentIncomePolicyToSettings(appState.settings);
  return true;
}


function trackCurrentIncomePolicySettingChange(key, value, previousValue = value) {
  if (!INCOME_POLICY_FIELDS.includes(key)) {
    return false;
  }

  const hasHistory = hasGeneralIncomeHistory(appState.settings);
  const hasLegacyHistory =
    sanitizeSalaryHistory(appState.settings?.salaryHistory).length > 0;

  // Nếu người dùng sửa mức hiện tại trước rồi mới khai báo tháng hiệu lực,
  // giữ lại cấu hình TRƯỚC lần sửa đầu tiên làm mốc gốc. Nhờ đó các tháng
  // cũ không bị hiểu nhầm là đã dùng mức mới.
  if (!hasHistory && !hasLegacyHistory) {
    if (
      !appState.settings?.incomeHistoryBase ||
      typeof appState.settings.incomeHistoryBase !== "object" ||
      Array.isArray(appState.settings.incomeHistoryBase)
    ) {
      const base = getRawIncomePolicyFromSettings(appState.settings || {});
      base[key] = sanitizeIncomePolicyValue(key, previousValue, base[key]);
      appState.settings.incomeHistoryBase = sanitizeIncomeHistoryBase(base, base);
    }

    return false;
  }

  // Khi lần đầu nâng từ lịch sử lương cũ sang lịch sử thu nhập,
  // phải chụp giá trị TRƯỚC khi người dùng vừa sửa khoản hiện tại.
  if (!hasHistory) {
    const latestValue = appState.settings[key];
    appState.settings[key] = previousValue;
    ensureIncomeHistoryInitialized();
    appState.settings[key] = latestValue;
  }

  return upsertIncomeHistoryChange(getMonthKey(new Date()), key, value);
}


function getTrackedIncomePolicyFieldsForMonth(monthKey, settings = appState.settings) {
  const history = sanitizeIncomeHistory(settings?.incomeHistory);

  if (history.length) {
    return Array.from(new Set(
      history
        .filter(item => item.effectiveMonth <= monthKey)
        .flatMap(item => Object.keys(item.changes || {}))
    ));
  }

  const legacy = sanitizeSalaryHistory(settings?.salaryHistory);
  return legacy.some(item => item.effectiveMonth <= monthKey)
    ? ["baseSalary"]
    : [];
}


function getIncomePolicySignatureForMonth(monthKey, settings = appState.settings) {
  const policy = getIncomePolicyForMonth(monthKey, settings);
  return INCOME_POLICY_FIELDS
    .map(key => `${key}:${policy[key]}`)
    .join("|");
}


function formatIncomePolicyValue(key, value) {
  const meta = INCOME_POLICY_META[key] || { unit: "", kind: "number" };

  if (meta.kind === "money") {
    return formatPayrollMoney(value);
  }

  if (meta.kind === "money-rate") {
    return `${formatPayrollMoney(value)}/km`;
  }

  if (meta.kind === "mode") {
    const labels = {
      fixed: "Cố định",
      proportional: "Theo công",
      monthly: "Theo tháng",
      disabled: "Không áp dụng",
      percentage: "Theo tỷ lệ"
    };
    return labels[value] || String(value || "");
  }

  return `${formatNumber(value)}${meta.unit ? ` ${meta.unit}` : ""}`;
}


function getIncomeHistoryDisplayEntries(settings = appState.settings) {
  const general = sanitizeIncomeHistory(settings?.incomeHistory);

  if (general.length) {
    return general;
  }

  return sanitizeSalaryHistory(settings?.salaryHistory).map(item => ({
    effectiveMonth: item.effectiveMonth,
    changes: { baseSalary: item.amount },
    createdAt: item.createdAt || null
  }));
}


function sanitizeSalaryCarryForwards(value) {
  const unique = new Map();

  (Array.isArray(value) ? value : []).forEach(item => {
    const id = String(item?.id || "").trim();
    const targetMonth = String(item?.targetMonth || "").slice(0, 7);
    const amount = Number(item?.amount);

    if (
      !id ||
      !/^\d{4}-(0[1-9]|1[0-2])$/.test(targetMonth) ||
      !Number.isFinite(amount) ||
      Math.abs(amount) < 0.01
    ) {
      return;
    }

    unique.set(id, {
      id,
      targetMonth,
      amount,
      note: String(item?.note || ""),
      sourceMonths: Array.isArray(item?.sourceMonths)
        ? item.sourceMonths
            .map(month => String(month || "").slice(0, 7))
            .filter(month => /^\d{4}-(0[1-9]|1[0-2])$/.test(month))
        : [],
      createdAt: item?.createdAt || null
    });
  });

  return Array.from(unique.values())
    .sort((a, b) => String(a.createdAt || "").localeCompare(String(b.createdAt || "")));
}


function getSalaryCarryForwardsForMonth(monthKey, settings = appState.settings) {
  return sanitizeSalaryCarryForwards(settings?.salaryCarryForwards)
    .filter(item => item.targetMonth === monthKey);
}


function applySalaryCarryForwardsToDraft(
  draft,
  monthKey,
  { markDirty = false } = {}
) {
  const entries = getSalaryCarryForwardsForMonth(monthKey);
  const appliedIds = new Set(
    Array.isArray(draft.appliedSalaryCarryForwardIds)
      ? draft.appliedSalaryCarryForwardIds
      : []
  );
  let changed = false;

  entries.forEach(entry => {
    if (appliedIds.has(entry.id)) {
      return;
    }

    if (entry.amount > 0) {
      draft.otherIncome =
        sanitizeNonNegativeNumber(draft.otherIncome) + entry.amount;
      draft.otherIncomeNote = [draft.otherIncomeNote, entry.note]
        .filter(Boolean)
        .join(" • ");
    } else {
      draft.otherDeduction =
        sanitizeNonNegativeNumber(draft.otherDeduction) + Math.abs(entry.amount);
      draft.otherDeductionNote = [draft.otherDeductionNote, entry.note]
        .filter(Boolean)
        .join(" • ");
    }

    appliedIds.add(entry.id);
    changed = true;
  });

  draft.appliedSalaryCarryForwardIds = Array.from(appliedIds);

  if (changed && markDirty) {
    draft.dirty = true;
  }

  return changed;
}


function resolveSalaryForMonth(monthKey, history, baseAmount) {
  let amount = sanitizeNonNegativeNumber(baseAmount);

  sanitizeSalaryHistory(history).forEach(item => {
    if (item.effectiveMonth <= monthKey) {
      amount = item.amount;
    }
  });

  return amount;
}


function getEffectiveSalaryForMonth(monthKey, settings = appState.settings) {
  return sanitizeNonNegativeNumber(
    getIncomePolicyForMonth(monthKey, settings).baseSalary
  );
}


function getSalaryHistorySignature(settings = appState.settings) {
  const history = sanitizeSalaryHistory(settings?.salaryHistory);
  const base = sanitizeNonNegativeNumber(
    settings?.salaryHistoryBaseAmount,
    settings?.baseSalary || 0
  );

  return `${base}|${history
    .map(item => `${item.effectiveMonth}:${item.amount}`)
    .join("|")}`;
}


function getDefaultSettings() {
  const now = new Date();

  return {
    themeMode: "light",
    fontSize: "medium",
    showSeconds: true,
    promptNoteAfterShiftEnd: true,
    defaultShiftStart: "07:45",
    defaultShiftEnd: "17:00",

    baseSalary: 0,
    salaryHistoryBaseAmount: 0,
    salaryHistory: [],
    incomeHistoryBase: null,
    incomeHistory: [],
    salaryCarryForwards: [],
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

  applyCurrentIncomePolicyToSettings(appState.settings);

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

  const salaryHistory =
    sanitizeSalaryHistory(value.salaryHistory);

  const incomeHistory =
    sanitizeIncomeHistory(value.incomeHistory);

  const hasIncomeHistoryBase =
    value.incomeHistoryBase &&
    typeof value.incomeHistoryBase === "object" &&
    !Array.isArray(value.incomeHistoryBase);

  const incomeHistoryBase =
    (incomeHistory.length || hasIncomeHistoryBase)
      ? sanitizeIncomeHistoryBase(value.incomeHistoryBase, value)
      : null;

  const salaryCarryForwards =
    sanitizeSalaryCarryForwards(value.salaryCarryForwards);

  const rawBaseSalary =
    sanitizeNonNegativeNumber(value.baseSalary);

  const salaryHistoryBaseAmount =
    salaryHistory.length
      ? sanitizeNonNegativeNumber(
          value.salaryHistoryBaseAmount,
          rawBaseSalary
        )
      : rawBaseSalary;

  const currentSalary =
    incomeHistory.length
      ? rawBaseSalary
      : salaryHistory.length
        ? resolveSalaryForMonth(
            getMonthKey(new Date()),
            salaryHistory,
            salaryHistoryBaseAmount
          )
        : rawBaseSalary;

  return {
    themeMode,
    fontSize,

    showSeconds:
      value.showSeconds !== false,

    promptNoteAfterShiftEnd:
      value.promptNoteAfterShiftEnd !== false,

    defaultShiftStart:
      isValidTime(value.defaultShiftStart)
        ? value.defaultShiftStart
        : defaults.defaultShiftStart,

    defaultShiftEnd:
      isValidTime(value.defaultShiftEnd)
        ? value.defaultShiftEnd
        : defaults.defaultShiftEnd,

    baseSalary: currentSalary,
    salaryHistoryBaseAmount,
    salaryHistory,
    incomeHistoryBase,
    incomeHistory,
    salaryCarryForwards,

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

  applyCurrentIncomePolicyToSettings(appState.settings);

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
      if (isSettingsModalOpen()) {
        markSettingsDirty();
      } else {
        scheduleSettingsSupabaseSave();
      }
    }
  }

  updateSettingsCategorySummaries();
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
  setChecked("#promptNoteAfterShiftEndToggle", settings.promptNoteAfterShiftEnd);
  setValue("#defaultShiftStart", settings.defaultShiftStart);
  setValue("#defaultShiftEnd", settings.defaultShiftEnd);

  setValue("#settingsBaseSalary", settings.baseSalary || "");
  renderSalaryHistorySettings();
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

  refreshAdvancedFeatureUI();
  renderMealThresholdSettings();
  syncSalaryInputs("settings");
  syncMealPriceInputs("settings");
  updateInsuranceSettingsVisibility();
  updateSettingsCategorySummaries();
}



function formatSalaryHistoryMonth(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ""));

  return match
    ? `Tháng ${Number(match[2])}/${match[1]}`
    : String(monthKey || "");
}


function updateIncomeHistoryEditor() {
  const field = $("#incomeHistoryField")?.value || "baseSalary";
  const meta = INCOME_POLICY_META[field] || INCOME_POLICY_META.baseSalary;
  const unit = $("#incomeHistoryValueUnit");
  const input = $("#incomeHistoryValue");
  const monthKey = $("#salaryHistoryEffectiveMonth")?.value || getMonthKey(new Date());
  const currentValue = getIncomePolicyForMonth(monthKey)[field];

  if (unit) {
    unit.textContent = meta.unit || "";
  }

  if (input) {
    input.step = ["standardWorkDays", "standardHours", "otMultiplier", "insuranceRate"].includes(field)
      ? "0.1"
      : "1000";
    input.placeholder = `Hiện tại: ${formatIncomePolicyValue(field, currentValue)}`;
  }
}


function renderSalaryHistorySettings() {
  const settings = appState.settings || getDefaultSettings();
  const history = getIncomeHistoryDisplayEntries(settings);
  const list = $("#salaryHistoryList");
  const currentMonth = getMonthKey(new Date());
  const currentPolicy = getIncomePolicyForMonth(currentMonth, settings);
  const effectiveMonthInput = $("#salaryHistoryEffectiveMonth");

  if (effectiveMonthInput && !effectiveMonthInput.value) {
    effectiveMonthInput.value = currentMonth;
  }

  const trackedFieldCount = new Set(
    history.flatMap(item => Object.keys(item.changes || {}))
  ).size;

  setText(
    "#salaryHistoryCurrentValue",
    history.length
      ? `${trackedFieldCount} khoản • ${history.length} mốc`
      : "Chưa thiết lập"
  );

  setText(
    "#salaryHistoryBaseHint",
    history.length
      ? `Hiện tại: lương cơ bản ${formatPayrollMoney(currentPolicy.baseSalary)}, hệ số OT ${formatNumber(currentPolicy.otMultiplier)}, đơn giá giao hàng ${formatPayrollMoney(currentPolicy.fuelRate)}/km.`
      : "Chưa có lịch sử. Khi có thay đổi, chọn khoản, tháng hiệu lực và giá trị mới; dữ liệu cũ vẫn được giữ nguyên."
  );

  if (list) {
    if (!history.length) {
      list.innerHTML = `
        <div class="salary-history-empty">
          <i data-lucide="history"></i>
          <span>
            <strong>Chưa có mốc thay đổi thu nhập</strong>
            <small>Bạn có thể ghi lương, phụ cấp, hệ số OT, đơn giá giao hàng hoặc bảo hiểm theo tháng hiệu lực.</small>
          </span>
        </div>
      `;
    } else {
      list.innerHTML = history
        .slice()
        .reverse()
        .map(item => {
          const previousPolicy = getPolicyBeforeIncomeHistoryMonth(
            item.effectiveMonth,
            settings
          );
          const lines = Object.entries(item.changes || {})
            .map(([key, value]) => {
              const meta = INCOME_POLICY_META[key] || { label: key };
              const before = previousPolicy[key];
              const numeric = Number(value) - Number(before);
              const diff = Number.isFinite(numeric) && meta.kind !== "mode"
                ? `<em class="${numeric >= 0 ? "positive" : "negative"}">${numeric >= 0 ? "+" : "−"}${formatIncomePolicyValue(key, Math.abs(numeric))}</em>`
                : "";

              return `
                <div class="income-history-change-line">
                  <span>
                    <strong>${escapeHTML(meta.label)}</strong>
                    <small>${escapeHTML(formatIncomePolicyValue(key, before))} → ${escapeHTML(formatIncomePolicyValue(key, value))}</small>
                  </span>
                  ${diff}
                </div>
              `;
            })
            .join("");

          return `
            <div class="salary-history-row income-history-row">
              <div class="income-history-row-head">
                <span class="salary-history-date">
                  <small>HIỆU LỰC</small>
                  <strong>${formatSalaryHistoryMonth(item.effectiveMonth)}</strong>
                </span>
                <span class="income-history-count">${Object.keys(item.changes || {}).length} khoản thay đổi</span>
                <button
                  class="salary-history-delete"
                  type="button"
                  data-delete-income-history="${item.effectiveMonth}"
                  aria-label="Xóa thay đổi thu nhập ${item.effectiveMonth}"
                >
                  <i data-lucide="trash-2"></i>
                </button>
              </div>
              <div class="income-history-change-list">${lines}</div>
            </div>
          `;
        })
        .join("");
    }
  }

  const pending = getPendingSalaryRevisions();
  const impact = $("#salaryHistoryImpactStatus");

  if (impact) {
    impact.classList.toggle("hidden", !pending.length);
    setText(
      "#salaryHistoryImpactText",
      pending.length
        ? `${pending.length} bảng lương đã lưu đang dùng cấu hình thu nhập cũ và cần xử lý chênh lệch.`
        : ""
    );
  }

  updateIncomeHistoryEditor();
  refreshIcons();
}


function applyIncomePolicyToDraft(draft, monthKey, { markDirty = false } = {}) {
  if (!draft) {
    return false;
  }

  const expected = getIncomePolicyForMonth(monthKey);
  const oldSettings = sanitizeSettings(draft.settingsSnapshot || appState.settings);
  const oldPolicy = getRawIncomePolicyFromSettings(oldSettings);
  const baseWasPolicy = Math.abs(Number(draft.baseSalary || 0) - Number(oldPolicy.baseSalary || 0)) <= 0.5;
  const fuelWasPolicy = Math.abs(Number(draft.fuelRate || 0) - Number(oldPolicy.fuelRate || 0)) <= 0.5;
  let changed = false;

  INCOME_POLICY_FIELDS.forEach(key => {
    if (String(oldPolicy[key]) !== String(expected[key])) {
      changed = true;
    }
    oldSettings[key] = expected[key];
  });

  if (baseWasPolicy && Math.abs(Number(draft.baseSalary || 0) - Number(expected.baseSalary || 0)) > 0.5) {
    draft.baseSalary = expected.baseSalary;
    changed = true;
  }

  if (fuelWasPolicy && Math.abs(Number(draft.fuelRate || 0) - Number(expected.fuelRate || 0)) > 0.5) {
    draft.fuelRate = expected.fuelRate;
    changed = true;
  }

  draft.settingsSnapshot = oldSettings;

  if (changed && markDirty) {
    draft.dirty = true;
  }

  return changed;
}


function refreshPayrollDraftsAfterSalaryHistoryChange() {
  const currentMonth = getMonthKey(new Date());

  Object.keys(appState.payrollDrafts).forEach(monthKey => {
    const draft = appState.payrollDrafts[monthKey];
    const saved = appState.payrollMonths[monthKey];

    if (!saved && !draft?.dirty) {
      delete appState.payrollDrafts[monthKey];
      return;
    }

    if (monthKey === currentMonth && draft) {
      applyIncomePolicyToDraft(draft, monthKey, { markDirty: Boolean(saved) });
    }
  });
}


function updateCurrentBaseSalaryFromHistory() {
  applyCurrentIncomePolicyToSettings(appState.settings);
}


function addIncomeHistoryEntry() {
  const monthInput = $("#salaryHistoryEffectiveMonth");
  const fieldInput = $("#incomeHistoryField");
  const valueInput = $("#incomeHistoryValue");
  const effectiveMonth = String(monthInput?.value || "");
  const key = String(fieldInput?.value || "baseSalary");
  const rawValue = valueInput?.value;

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(effectiveMonth)) {
    showToast("Hãy chọn tháng bắt đầu áp dụng thay đổi.", true);
    monthInput?.focus();
    return;
  }

  if (!INCOME_POLICY_NUMERIC_FIELDS.includes(key)) {
    showToast("Khoản thay đổi chưa hợp lệ.", true);
    return;
  }

  if (rawValue === "" || rawValue == null || !Number.isFinite(Number(rawValue))) {
    showToast("Hãy nhập giá trị mới.", true);
    valueInput?.focus();
    return;
  }

  const value = sanitizeIncomePolicyValue(key, Number(rawValue));

  if (["baseSalary", "standardWorkDays", "standardHours", "otMultiplier"].includes(key) && !(value > 0)) {
    showToast("Giá trị này phải lớn hơn 0.", true);
    valueInput?.focus();
    return;
  }

  const previousPolicy = getPolicyBeforeIncomeHistoryMonth(effectiveMonth);
  upsertIncomeHistoryChange(effectiveMonth, key, value);
  saveSettings();
  refreshPayrollDraftsAfterSalaryHistoryChange();
  syncSettingsUI();
  renderDashboard();
  renderSalary();

  if (valueInput) {
    valueInput.value = "";
  }

  const meta = INCOME_POLICY_META[key] || { label: key };
  showToast(
    `${meta.label}: ${formatIncomePolicyValue(key, previousPolicy[key])} → ${formatIncomePolicyValue(key, value)} từ ${formatSalaryHistoryMonth(effectiveMonth)}.`
  );

  openSalaryRevisionModalIfNeeded();
}


function deleteIncomeHistoryEntry(effectiveMonth) {
  const history = sanitizeIncomeHistory(appState.settings?.incomeHistory);
  const legacyOnly = !history.length && sanitizeSalaryHistory(appState.settings?.salaryHistory).length;

  if (legacyOnly) {
    ensureIncomeHistoryInitialized();
  }

  const currentHistory = sanitizeIncomeHistory(appState.settings?.incomeHistory);
  const entry = currentHistory.find(item => item.effectiveMonth === effectiveMonth);

  if (!entry) {
    return;
  }

  if (!confirm(`Xóa toàn bộ ${Object.keys(entry.changes).length} thay đổi có hiệu lực từ ${formatSalaryHistoryMonth(effectiveMonth)}?`)) {
    return;
  }

  appState.settings.incomeHistory = normalizeIncomeHistoryAgainstBase(
    currentHistory.filter(
      item => item.effectiveMonth !== effectiveMonth
    ),
    appState.settings.incomeHistoryBase
  );

  if (appState.settings.incomeHistory.length) {
    applyCurrentIncomePolicyToSettings(appState.settings);
  } else if (appState.settings.incomeHistoryBase) {
    const restoredBase = sanitizeIncomeHistoryBase(
      appState.settings.incomeHistoryBase,
      appState.settings
    );

    INCOME_POLICY_FIELDS.forEach(key => {
      appState.settings[key] = restoredBase[key];
    });
  }

  saveSettings();
  refreshPayrollDraftsAfterSalaryHistoryChange();
  syncSettingsUI();
  renderDashboard();
  renderSalary();
  showToast("Đã xóa mốc thay đổi thu nhập.");
  openSalaryRevisionModalIfNeeded();
}


function getSavedIncomePolicy(saved) {
  const sourceSettings = sanitizeSettings(
    saved?.settingsSnapshot || saved?.calculatedSnapshot?.settings || appState.settings
  );
  const policy = getRawIncomePolicyFromSettings(sourceSettings);

  if (saved?.baseSalary != null) {
    policy.baseSalary = sanitizeNonNegativeNumber(saved.baseSalary);
  } else if (saved?.calculatedSnapshot?.baseSalary != null) {
    policy.baseSalary = sanitizeNonNegativeNumber(saved.calculatedSnapshot.baseSalary);
  }

  return policy;
}


function getChangedIncomePolicyFields(savedPolicy, expectedPolicy) {
  return INCOME_POLICY_FIELDS.filter(key => {
    if (INCOME_POLICY_MODE_FIELDS.includes(key)) {
      return String(savedPolicy[key]) !== String(expectedPolicy[key]);
    }

    return Math.abs(Number(savedPolicy[key] || 0) - Number(expectedPolicy[key] || 0)) > 0.0001;
  });
}


function recalculateSavedPayrollWithIncomePolicy(saved, expectedPolicy) {
  const snapshot = saved?.calculatedSnapshot;

  if (!isPayrollSnapshotUsable(snapshot)) {
    return null;
  }

  const oldSettings = sanitizeSettings(saved.settingsSnapshot || snapshot.settings || {});
  const oldPolicy = getRawIncomePolicyFromSettings(oldSettings);
  const nextSettings = sanitizeSettings({
    ...oldSettings,
    ...expectedPolicy
  });

  INCOME_POLICY_FIELDS.forEach(key => {
    nextSettings[key] = expectedPolicy[key];
  });

  const standardDays = sanitizePositiveNumber(expectedPolicy.standardWorkDays, snapshot.standardDays || 26);
  const standardHours = sanitizePositiveNumber(expectedPolicy.standardHours, snapshot.standardHours || 8);
  const otMultiplier = sanitizePositiveNumber(expectedPolicy.otMultiplier, snapshot.otMultiplier || 2);
  const leave = { ...(snapshot.leave || {}) };
  const unpaid = sanitizeNonNegativeNumber(leave.unpaid);
  const paidDays = Math.max(0, standardDays - unpaid);
  const totalOT = sanitizeNonNegativeNumber(snapshot.totalOT);

  const savedBase = sanitizeNonNegativeNumber(saved.baseSalary ?? snapshot.baseSalary);
  const baseWasPolicy = Math.abs(savedBase - sanitizeNonNegativeNumber(oldPolicy.baseSalary)) <= 0.5;
  const baseSalary = baseWasPolicy
    ? sanitizeNonNegativeNumber(expectedPolicy.baseSalary)
    : savedBase;

  const workingSalary = baseSalary / standardDays * paidDays;
  const overtimeMoney =
    baseSalary / standardDays / standardHours * otMultiplier * totalOT;

  const allowances = {
    main: allowanceResult(
      expectedPolicy.mainAllowance,
      expectedPolicy.mainAllowanceMode,
      paidDays,
      standardDays,
      saved.mainAllowanceOverride
    ),
    other: allowanceResult(
      expectedPolicy.otherAllowance,
      expectedPolicy.otherAllowanceMode,
      paidDays,
      standardDays,
      saved.otherAllowanceOverride
    ),
    attendance: allowanceResult(
      expectedPolicy.attendanceAllowance,
      expectedPolicy.attendanceAllowanceMode,
      paidDays,
      standardDays,
      saved.attendanceAllowanceOverride
    ),
    responsibility: allowanceResult(
      expectedPolicy.responsibilityAllowance,
      expectedPolicy.responsibilityAllowanceMode,
      paidDays,
      standardDays,
      saved.responsibilityAllowanceOverride
    )
  };
  const allowanceTotal = Object.values(allowances)
    .reduce((sum, item) => sum + sanitizeNonNegativeNumber(item.value), 0);

  const monthlyKm = sanitizeNonNegativeNumber(saved.monthlyKm ?? snapshot.monthlyKm);
  const savedFuelRate = sanitizeNonNegativeNumber(saved.fuelRate ?? snapshot.fuelRate);
  const fuelWasPolicy = Math.abs(savedFuelRate - sanitizeNonNegativeNumber(oldPolicy.fuelRate)) <= 0.5;
  const fuelRate = fuelWasPolicy
    ? sanitizeNonNegativeNumber(expectedPolicy.fuelRate)
    : savedFuelRate;
  const fuelMoney = monthlyKm * fuelRate;
  const fuelEnabled = expectedPolicy.fuelRate > 0 || fuelRate > 0 || monthlyKm > 0;

  const otherIncome = sanitizeNonNegativeNumber(saved.otherIncome ?? snapshot.otherIncome);
  const advance = sanitizeNonNegativeNumber(saved.advance ?? snapshot.advance);
  const otherDeduction = sanitizeNonNegativeNumber(saved.otherDeduction ?? snapshot.otherDeduction);

  const insuranceMode = INSURANCE_MODES.includes(saved.insuranceModeOverride)
    ? saved.insuranceModeOverride
    : expectedPolicy.insuranceMode;
  const insuranceBase = saved.insuranceBaseOverride == null
    ? sanitizeNonNegativeNumber(expectedPolicy.insuranceBase)
    : sanitizeNonNegativeNumber(saved.insuranceBaseOverride);
  const insuranceRate = saved.insuranceRateOverride == null
    ? sanitizeNonNegativeNumber(expectedPolicy.insuranceRate)
    : sanitizeNonNegativeNumber(saved.insuranceRateOverride);
  const insuranceFixed = saved.insuranceFixedOverride == null
    ? sanitizeNonNegativeNumber(expectedPolicy.insuranceFixedAmount)
    : sanitizeNonNegativeNumber(saved.insuranceFixedOverride);

  let insuranceMoney = 0;
  let insuranceDescription = "Không khấu trừ bảo hiểm";

  if (insuranceMode === "percentage") {
    insuranceMoney = insuranceBase * insuranceRate / 100;
    insuranceDescription = `${formatPayrollMoney(insuranceBase)} × ${formatNumber(insuranceRate)}%`;
  } else if (insuranceMode === "fixed") {
    insuranceMoney = insuranceFixed;
    insuranceDescription = "Số tiền bảo hiểm cố định";
  }

  const totalIncome =
    workingSalary + overtimeMoney + allowanceTotal + fuelMoney + otherIncome;
  const totalDeductions = insuranceMoney + advance + otherDeduction;
  const netSalary = totalIncome - totalDeductions;

  return {
    snapshot: {
      ...snapshot,
      settings: nextSettings,
      standardDays,
      standardHours,
      otMultiplier,
      paidDays,
      baseSalary,
      workingSalary,
      overtimeMoney,
      allowances,
      monthlyKm,
      fuelRate,
      fuelMoney,
      fuelEnabled,
      otherIncome,
      insuranceMode,
      insuranceMoney,
      insuranceDescription,
      advance,
      otherDeduction,
      totalIncome,
      totalDeductions,
      netSalary,
      unpaidLeaveReduction: baseSalary / standardDays * unpaid
    },
    topLevel: {
      baseSalary,
      fuelRate,
      settingsSnapshot: nextSettings
    }
  };
}


function isSalaryRevisionResolved(saved, monthKey) {
  const signature = getIncomePolicySignatureForMonth(monthKey);
  const resolution = saved?.incomeRevisionResolution;

  if (resolution?.policySignature === signature) {
    return true;
  }

  // Tương thích bản trước chỉ theo dõi lương cơ bản.
  const legacy = saved?.salaryRevisionResolution;
  const resolvedPolicy = getIncomePolicyForMonth(monthKey);
  const savedPolicy = getSavedIncomePolicy(saved);
  const expectedPolicy = { ...savedPolicy };
  getTrackedIncomePolicyFieldsForMonth(monthKey).forEach(key => {
    expectedPolicy[key] = resolvedPolicy[key];
  });
  const changed = getChangedIncomePolicyFields(savedPolicy, expectedPolicy);

  return Boolean(
    legacy &&
    changed.length === 1 &&
    changed[0] === "baseSalary" &&
    Math.abs(Number(legacy.expectedSalary || 0) - Number(expectedPolicy.baseSalary || 0)) <= 0.5
  );
}


function getPreviouslyCarriedRevisionDifference(saved) {
  if (saved?.incomeRevisionResolution?.action === "carried-forward") {
    return Number(saved.incomeRevisionResolution.difference || 0);
  }

  if (saved?.salaryRevisionResolution?.action === "carried-forward") {
    return Number(saved.salaryRevisionResolution.difference || 0);
  }

  return 0;
}


function getPendingSalaryRevisions() {
  const currentMonth = getMonthKey(new Date());
  const revisions = [];

  Object.keys(appState.payrollMonths || {})
    .sort()
    .forEach(monthKey => {
      if (monthKey >= currentMonth) {
        return;
      }

      const saved = appState.payrollMonths[monthKey];
      const resolvedPolicy = getIncomePolicyForMonth(monthKey);
      const savedPolicy = getSavedIncomePolicy(saved);
      const trackedFields = getTrackedIncomePolicyFieldsForMonth(monthKey);
      const expectedPolicy = { ...savedPolicy };

      trackedFields.forEach(key => {
        expectedPolicy[key] = resolvedPolicy[key];
      });

      const changedFields = getChangedIncomePolicyFields(savedPolicy, expectedPolicy);
      const previousHandledDifference =
        getPreviouslyCarriedRevisionDifference(saved);

      if (isSalaryRevisionResolved(saved, monthKey)) {
        return;
      }

      // Nếu mốc tăng đã bị xóa/đưa về mức cũ, changedFields có thể rỗng.
      // Tuy nhiên khoản truy lĩnh đã chuyển sang tháng khác vẫn phải được
      // hoàn tác, nếu không thu nhập sẽ còn dư khoản cũ.
      if (
        !changedFields.length &&
        Math.abs(previousHandledDifference) <= 0.5
      ) {
        return;
      }

      const recalculated = recalculateSavedPayrollWithIncomePolicy(
        saved,
        expectedPolicy
      );

      if (!recalculated) {
        return;
      }

      const oldNet = Number(saved.calculatedSnapshot?.netSalary || 0);
      const rawDifference =
        Number(recalculated.snapshot.netSalary || 0) - oldNet;
      const difference = rawDifference - previousHandledDifference;

      if (Math.abs(difference) <= 0.5) {
        return;
      }

      revisions.push({
        monthKey,
        saved,
        savedPolicy,
        expectedPolicy,
        changedFields,
        revisedSnapshot: recalculated.snapshot,
        topLevelUpdates: recalculated.topLevel,
        rawDifference,
        previousHandledDifference,
        difference,
        reversalOnly:
          !changedFields.length &&
          Math.abs(previousHandledDifference) > 0.5,
        policySignature: getIncomePolicySignatureForMonth(monthKey)
      });
    });

  return revisions;
}


function renderSalaryRevisionModal(revisions) {
  const list = $("#salaryRevisionList");
  const totalDifference = revisions.reduce(
    (sum, item) => sum + item.difference,
    0
  );

  appState.pendingSalaryRevisions = revisions;

  setText(
    "#salaryRevisionSummary",
    `${revisions.length} tháng đã chốt có chênh lệch cấu hình hoặc khoản truy lĩnh cũ cần xử lý. App sẽ không tự sửa lịch sử cho đến khi bạn chọn cách xử lý.`
  );

  setText(
    "#salaryRevisionTotal",
    `${totalDifference >= 0 ? "+" : "−"}${formatPayrollMoney(Math.abs(totalDifference))}`
  );

  setText(
    "#salaryRevisionCarryForwardText",
    totalDifference >= 0
      ? `Ghi ${formatPayrollMoney(totalDifference)} vào khoản cộng của ${formatSalaryHistoryMonth(getMonthKey(new Date()))}.`
      : `Ghi ${formatPayrollMoney(Math.abs(totalDifference))} vào khoản trừ của ${formatSalaryHistoryMonth(getMonthKey(new Date()))}.`
  );

  if (list) {
    list.innerHTML = revisions
      .map(item => {
        const labels = item.reversalOnly
          ? ["Hoàn tác khoản truy lĩnh cũ"]
          : item.changedFields
              .slice(0, 3)
              .map(key => INCOME_POLICY_META[key]?.label || key);
        const extra = item.changedFields.length > 3
          ? ` +${item.changedFields.length - 3} khoản`
          : "";

        return `
          <div class="salary-revision-row">
            <span>
              <strong>${formatSalaryHistoryMonth(item.monthKey)}</strong>
              <small>${escapeHTML(labels.join(", "))}${escapeHTML(extra)}</small>
            </span>
            <strong class="${item.difference >= 0 ? "positive" : "negative"}">
              ${item.difference >= 0 ? "+" : "−"}${formatPayrollMoney(Math.abs(item.difference))}
            </strong>
          </div>
        `;
      })
      .join("");
  }

  refreshIcons();
}


function openSalaryRevisionModalIfNeeded() {
  const revisions = getPendingSalaryRevisions();
  renderSalaryHistorySettings();

  if (!revisions.length) {
    appState.pendingSalaryRevisions = [];
    return;
  }

  renderSalaryRevisionModal(revisions);
  openModal("salaryRevisionModal");
}


function hashRevisionText(value) {
  let hash = 2166136261;

  for (const char of String(value || "")) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }

  return (hash >>> 0).toString(36);
}


function getSalaryRevisionBatchId(revisions, targetMonth, purpose) {
  const payload = revisions
    .map(item => [
      item.monthKey,
      item.policySignature,
      Number(item.rawDifference || 0).toFixed(2),
      Number(item.previousHandledDifference || 0).toFixed(2)
    ].join(":"))
    .join("|");

  return `${purpose}-${targetMonth}-${hashRevisionText(payload)}`;
}


function addSalaryRevisionCarryEntry({
  id,
  targetMonth,
  amount,
  note,
  sourceMonths
}) {
  if (Math.abs(Number(amount || 0)) <= 0.5) {
    return null;
  }

  const entry = {
    id,
    targetMonth,
    amount: Number(amount),
    note: String(note || ""),
    sourceMonths: Array.from(new Set(sourceMonths || [])),
    createdAt: new Date().toISOString()
  };

  appState.settings.salaryCarryForwards = sanitizeSalaryCarryForwards([
    ...(appState.settings.salaryCarryForwards || []),
    entry
  ]);

  const draft = ensurePayrollDraft(targetMonth);
  applySalaryCarryForwardsToDraft(draft, targetMonth, { markDirty: true });

  return entry;
}


async function persistSettingsBeforePayrollRevision() {
  saveSettings();

  if (appState.settingsSyncTimer) {
    window.clearTimeout(appState.settingsSyncTimer);
    appState.settingsSyncTimer = null;
  }

  if (!appState.currentUser || appState.payrollSupabaseAvailable === false) {
    return { saved: false, localOnly: true };
  }

  try {
    const result = await saveSettingsToSupabase({ quiet: true });

    if (result?.saved) {
      appState.settingsDirty = false;
      appState.settingsOpenSnapshot = getSettingsSnapshot();
      setSettingsAutosaveStatus(
        "saved",
        "Đã đồng bộ cấu hình thu nhập trước khi cập nhật bảng lương."
      );
    }

    return result;
  } catch (error) {
    // Nếu backend chưa có nhóm bảng payroll thì toàn bộ dữ liệu lương đang
    // chạy local-only; trong trường hợp đó vẫn cho phép thao tác cục bộ.
    if (appState.payrollSupabaseAvailable === false) {
      return { saved: false, localOnly: true };
    }

    const syncError = new Error(
      "Chưa thể đồng bộ lịch sử thu nhập lên Supabase nên app chưa cập nhật bảng lương. Hãy kiểm tra mạng rồi thử lại."
    );
    syncError.cause = error;
    throw syncError;
  }
}


async function syncPayrollMonthsByKeys(monthKeys) {
  const keys = Array.from(new Set(monthKeys)).filter(Boolean);

  if (
    !keys.length ||
    appState.payrollSupabaseAvailable !== true ||
    !appState.currentUser
  ) {
    return;
  }

  const rows = keys
    .map(monthKey => ({
      username: appState.currentUser,
      payroll_month: `${monthKey}-01`,
      payroll_data: appState.payrollMonths[monthKey]
    }))
    .filter(row => row.payroll_data);

  if (!rows.length) {
    return;
  }

  const { error } = await supabaseClient
    .from("payroll_months")
    .upsert(rows, { onConflict: "username,payroll_month" });

  if (error) {
    throw error;
  }
}


async function applySalaryRevisionToSavedMonths() {
  const revisions = getPendingSalaryRevisions();

  if (!revisions.length) {
    closeModal("salaryRevisionModal");
    showToast("Không còn bảng lương cũ cần cập nhật.");
    return;
  }

  const currentMonth = getMonthKey(new Date());
  const previousCarryTotal = revisions.reduce(
    (sum, item) => sum + Number(item.previousHandledDifference || 0),
    0
  );

  // Nếu các tháng này trước đây đã được truy lĩnh sang tháng khác,
  // việc chuyển sang "cập nhật tháng cũ" phải hoàn tác phần đã chuyển.
  if (Math.abs(previousCarryTotal) > 0.5) {
    const sourceMonths = revisions.map(item => item.monthKey);
    const affectedMonths = sourceMonths
      .map(month => formatSalaryHistoryMonth(month).replace("Tháng ", "T"))
      .join(", ");

    addSalaryRevisionCarryEntry({
      id: getSalaryRevisionBatchId(
        revisions,
        currentMonth,
        "income-revision-reversal"
      ),
      targetMonth: currentMonth,
      amount: -previousCarryTotal,
      note: `Hoàn tác truy lĩnh cũ khi cập nhật lại ${affectedMonths}`,
      sourceMonths
    });
  }

  // Luôn đồng bộ lịch sử/cấu hình trước khi ghi payroll_months để tránh
  // Supabase có bảng lương mới nhưng settings vẫn là phiên bản cũ.
  await persistSettingsBeforePayrollRevision();

  const resolvedAt = new Date().toISOString();

  revisions.forEach(item => {
    const saved = item.saved;

    appState.payrollMonths[item.monthKey] = {
      ...saved,
      ...item.topLevelUpdates,
      calculatedSnapshot: item.revisedSnapshot,
      incomeRevisionResolution: {
        action: "updated-past-month",
        policySignature: item.policySignature,
        changedFields: item.changedFields.slice(),
        difference: item.rawDifference,
        resolvedAt
      },
      savedAt: resolvedAt
    };

    delete appState.payrollDrafts[item.monthKey];
  });

  savePayrollMonths();
  await syncPayrollMonthsByKeys(revisions.map(item => item.monthKey));
  appState.pendingSalaryRevisions = [];
  closeModal("salaryRevisionModal");
  renderSalaryHistorySettings();
  renderSalary();
  renderDashboard();
  showToast(`Đã cập nhật ${revisions.length} bảng lương theo cấu hình thu nhập mới.`);
}


async function carrySalaryRevisionToCurrentMonth() {
  const revisions = getPendingSalaryRevisions();

  if (!revisions.length) {
    closeModal("salaryRevisionModal");
    showToast("Không còn khoản chênh lệch cần xử lý.");
    return;
  }

  const currentMonth = getMonthKey(new Date());
  const totalDifference = revisions.reduce(
    (sum, item) => sum + item.difference,
    0
  );
  const affectedMonths = revisions
    .map(item => formatSalaryHistoryMonth(item.monthKey).replace("Tháng ", "T"))
    .join(", ");
  const note = totalDifference >= 0
    ? `Truy lĩnh điều chỉnh thu nhập ${affectedMonths}`
    : `Truy thu/hoàn tác điều chỉnh thu nhập ${affectedMonths}`;

  addSalaryRevisionCarryEntry({
    id: getSalaryRevisionBatchId(
      revisions,
      currentMonth,
      "income-revision-carry"
    ),
    targetMonth: currentMonth,
    amount: totalDifference,
    note,
    sourceMonths: revisions.map(item => item.monthKey)
  });

  // salaryCarryForwards cũng nằm trong payroll_settings, vì vậy phải lưu
  // nó lên Supabase trước khi đánh dấu các tháng nguồn là đã xử lý.
  await persistSettingsBeforePayrollRevision();

  const resolvedAt = new Date().toISOString();

  revisions.forEach(item => {
    appState.payrollMonths[item.monthKey] = {
      ...item.saved,
      incomeRevisionResolution: {
        action: "carried-forward",
        policySignature: item.policySignature,
        changedFields: item.changedFields.slice(),
        difference: item.rawDifference,
        targetMonth: currentMonth,
        resolvedAt
      }
    };
  });

  savePayrollMonths();
  await syncPayrollMonthsByKeys(revisions.map(item => item.monthKey));
  appState.pendingSalaryRevisions = [];
  closeModal("salaryRevisionModal");
  renderSalaryHistorySettings();
  renderSalary();
  renderDashboard();
  showToast(
    totalDifference >= 0
      ? `Đã thêm ${formatPayrollMoney(totalDifference)} chênh lệch vào bảng lương tháng này.`
      : `Đã ghi ${formatPayrollMoney(Math.abs(totalDifference))} khoản điều chỉnh giảm vào bảng lương tháng này.`
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
  endTime,
  startTime = ""
) {
  if (
    !isValidTime(
      endTime
    )
  ) {
    return 0;
  }

  let endMinutes =
    timeToMinutes(
      endTime
    );

  // Nếu giờ kết thúc nhỏ hơn giờ bắt đầu, coi đây là ca qua 0h.
  // Ví dụ 17:00 -> 00:30 sẽ được hiểu là kết thúc ở phút 1470
  // thay vì phút 30, nhờ đó vẫn đi qua các mốc cơm 18:30 / 20:30.
  if (
    isValidTime(
      startTime
    )
  ) {
    const startMinutes =
      timeToMinutes(
        startTime
      );

    if (
      endMinutes <
      startMinutes
    ) {
      endMinutes +=
        24 * 60;
    }
  }

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

  refreshAdvancedFeatureUI();
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


function isSettingsModalOpen() {
  return Boolean(
    $("#settingsModal")
      ?.classList
      .contains("show")
  );
}


function scrollSettingsToTop() {
  const list =
    $("#settingsModal .settings-list");

  list?.scrollTo({
    top: 0,
    behavior: "smooth"
  });
}


function setSettingsTab(
  tabName,
  {
    focus = false,
    scroll = true
  } = {}
) {
  const safeTab =
    SETTINGS_TABS.includes(tabName)
      ? tabName
      : "general";

  appState.activeSettingsTab =
    safeTab;

  $$('[data-settings-tab]').forEach(button => {
    const active =
      button.dataset.settingsTab === safeTab;

    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", String(active));
    button.tabIndex = active ? 0 : -1;

    if (active && focus) {
      button.focus({ preventScroll: true });
    }
  });

  $$('[data-settings-tab-panel]').forEach(panel => {
    const active =
      panel.dataset.settingsTabPanel === safeTab;

    panel.classList.toggle("hidden", !active);
    panel.classList.toggle("active", active);
    panel.setAttribute("aria-hidden", String(!active));
  });

  if (scroll) {
    scrollSettingsToTop();
  }

  refreshIcons();
}


function handleSettingsTabKeydown(
  event,
  currentIndex,
  buttons
) {
  if (!buttons.length) {
    return;
  }

  let nextIndex = null;

  if (
    event.key === "ArrowRight" ||
    event.key === "ArrowDown"
  ) {
    nextIndex =
      (currentIndex + 1) % buttons.length;
  } else if (
    event.key === "ArrowLeft" ||
    event.key === "ArrowUp"
  ) {
    nextIndex =
      (currentIndex - 1 + buttons.length) % buttons.length;
  } else if (event.key === "Home") {
    nextIndex = 0;
  } else if (event.key === "End") {
    nextIndex = buttons.length - 1;
  }

  if (nextIndex === null) {
    return;
  }

  event.preventDefault();

  const nextButton =
    buttons[nextIndex];

  setSettingsTab(
    nextButton?.dataset.settingsTab || "general",
    { focus: true }
  );
}


function setSettingsAutosaveStatus(
  state,
  message
) {
  const box =
    $("#settingsAutosaveStatus");

  if (!box) {
    return;
  }

  const iconByState = {
    dirty: "cloud-upload",
    saving: "loader-circle",
    saved: "cloud-check",
    local: "hard-drive",
    error: "cloud-off"
  };

  const safeState =
    state || "saved";

  box.dataset.state =
    safeState;

  const iconName =
    iconByState[safeState] ||
    "cloud-check";

  if (box.dataset.iconState !== iconName) {
    const icon =
      box.querySelector("svg, i[data-lucide]");

    if (icon) {
      icon.outerHTML =
        `<i data-lucide="${iconName}"></i>`;
    } else {
      box.insertAdjacentHTML(
        "afterbegin",
        `<i data-lucide="${iconName}"></i>`
      );
    }

    box.dataset.iconState =
      iconName;

    refreshIcons();
  }

  setText(
    "#settingsAutosaveText",
    message
  );
}


function getSettingsSnapshot() {
  return JSON.stringify(
    sanitizeSettings(
      appState.settings ||
      {}
    )
  );
}


function markSettingsDirty() {
  if (
    appState.suppressSettingsRemoteSave ||
    !isSettingsModalOpen()
  ) {
    return;
  }

  const currentSnapshot =
    getSettingsSnapshot();

  appState.settingsDirty =
    currentSnapshot !==
    appState.settingsOpenSnapshot;

  if (appState.settingsSyncTimer) {
    window.clearTimeout(
      appState.settingsSyncTimer
    );

    appState.settingsSyncTimer = null;
  }

  if (!appState.settingsDirty) {
    setSettingsAutosaveStatus(
      "saved",
      "Không có thay đổi cần lưu."
    );

    return;
  }

  setSettingsAutosaveStatus(
    "dirty",
    "Có thay đổi chưa đồng bộ. Bấm X hoặc chạm ra ngoài để lưu và thoát."
  );
}


function resetSettingsAutosaveState() {
  appState.settingsDirty = false;
  appState.settingsClosing = false;
  appState.settingsOpenSnapshot =
    getSettingsSnapshot();

  setSettingsAutosaveStatus(
    "saved",
    "Thay đổi sẽ tự động lưu khi bạn đóng Cài đặt."
  );
}


function focusInvalidSetting(
  tabName,
  selector,
  message
) {
  setSettingsTab(
    tabName,
    { focus: false }
  );

  window.requestAnimationFrame(() => {
    const field =
      $(selector);

    field?.focus();
    field?.scrollIntoView({
      behavior: "smooth",
      block: "center"
    });
  });

  showToast(message, true);
}


function validateSettingsBeforeClose() {
  const startTime =
    $("#defaultShiftStart")?.value ||
    appState.settings.defaultShiftStart;

  const endTime =
    $("#defaultShiftEnd")?.value ||
    appState.settings.defaultShiftEnd;

  if (!isValidTime(startTime)) {
    focusInvalidSetting(
      "general",
      "#defaultShiftStart",
      "Giờ bắt đầu ca không hợp lệ."
    );

    return false;
  }

  if (!isValidTime(endTime)) {
    focusInvalidSetting(
      "general",
      "#defaultShiftEnd",
      "Giờ kết thúc ca không hợp lệ."
    );

    return false;
  }

  const leaveStartMonth =
    $("#settingsLeaveStartMonth")?.value ||
    appState.settings.leaveStartMonth;

  if (
    !/^\d{4}-(0[1-9]|1[0-2])$/
      .test(leaveStartMonth)
  ) {
    focusInvalidSetting(
      "benefits",
      "#settingsLeaveStartMonth",
      "Tháng bắt đầu tính phép không hợp lệ."
    );

    return false;
  }

  if (!commitMealThresholdsFromUI()) {
    setSettingsTab(
      "benefits",
      { focus: false }
    );

    return false;
  }

  appState.settings.defaultShiftStart =
    startTime;

  appState.settings.defaultShiftEnd =
    endTime;

  appState.settings.leaveStartMonth =
    leaveStartMonth;

  saveSettings();
  syncSettingsUI();

  return true;
}


async function syncSettingsManually() {
  try {
    await syncAllPayrollDataToSupabase();

    appState.settingsDirty = false;
    appState.settingsOpenSnapshot =
      getSettingsSnapshot();

    setSettingsAutosaveStatus(
      "saved",
      "Đã lưu và đồng bộ Cài đặt lên Supabase."
    );
  } catch (error) {
    setSettingsAutosaveStatus(
      "local",
      "Dữ liệu đã lưu trên thiết bị nhưng chưa thể đồng bộ Supabase."
    );

    throw error;
  }
}


function updateSettingsCategorySummaries() {
  // Bản V8.7 dùng bốn tab ngang nên không còn thẻ tóm tắt danh mục.
}


async function requestCloseSettings({
  afterClose = null
} = {}) {
  const modal =
    $("#settingsModal");

  if (
    !modal?.classList.contains("show")
  ) {
    if (typeof afterClose === "function") {
      afterClose();
    }

    return;
  }

  if (appState.settingsClosing) {
    return;
  }

  if (!validateSettingsBeforeClose()) {
    return;
  }

  if (appState.settingsSyncTimer) {
    window.clearTimeout(
      appState.settingsSyncTimer
    );

    appState.settingsSyncTimer = null;
  }

  if (!appState.settingsDirty) {
    closeModal(
      "settingsModal",
      { skipSettingsSave: true }
    );

    if (typeof afterClose === "function") {
      afterClose();
    }

    return;
  }

  appState.settingsClosing = true;

  const sheet =
    $("#settingsModal .settings-sheet");

  sheet?.classList.add(
    "is-saving-settings"
  );

  setSettingsAutosaveStatus(
    "saving",
    "Đang lưu Cài đặt..."
  );

  let remoteSaved = false;

  try {
    if (
      appState.currentUser &&
      appState.payrollSupabaseAvailable !== false
    ) {
      const result =
        await saveSettingsToSupabase({
          quiet: true
        });

      remoteSaved =
        result?.saved === true;
    }

    appState.settingsDirty = false;
    appState.settingsOpenSnapshot =
      getSettingsSnapshot();

    if (remoteSaved) {
      setSettingsAutosaveStatus(
        "saved",
        "Đã lưu và đồng bộ Cài đặt lên Supabase."
      );

      showToast(
        "Đã lưu và đồng bộ Cài đặt."
      );
    } else {
      setSettingsAutosaveStatus(
        "local",
        "Đã lưu trên thiết bị, chưa đồng bộ Supabase."
      );

      showToast(
        "Đã lưu Cài đặt trên thiết bị."
      );
    }
  } catch (error) {
    console.error(
      "Không thể đồng bộ Cài đặt khi đóng:",
      error
    );

    appState.settingsDirty = false;
    appState.settingsOpenSnapshot =
      getSettingsSnapshot();

    setSettingsAutosaveStatus(
      "local",
      "Đã lưu trên thiết bị, sẽ đồng bộ lại khi có kết nối."
    );

    showToast(
      "Đã lưu trên thiết bị, chưa thể đồng bộ Supabase.",
      true
    );
  } finally {
    sheet?.classList.remove(
      "is-saving-settings"
    );

    appState.settingsClosing = false;
  }

  closeModal(
    "settingsModal",
    { skipSettingsSave: true }
  );

  if (typeof afterClose === "function") {
    afterClose();
  }
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

  updateSettingsCategorySummaries();
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
    appState.suppressSettingsRemoteSave ||
    isSettingsModalOpen()
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
    return { saved: false, reason: "no-user" };
  }

  if (appState.payrollSupabaseAvailable === false) {
    if (!quiet) {
      throw new Error("Chưa có các bảng dữ liệu lương trên Supabase.");
    }

    return { saved: false, reason: "unavailable" };
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

  return { saved: true };
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
    renderSalaryHistorySettings();
    renderSalary();
    renderDashboard();

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

  const currentMonthKey =
    today.slice(
      0,
      7
    );

  const currentMonthOT =
    getMonthTotal(
      currentMonthKey
    );

  setText(
    "#monthlyOT",
    formatHours(
      currentMonthOT
    )
  );

  const currentPayrollDraft =
    ensurePayrollDraft(
      currentMonthKey
    );

  const currentPayrollResult =
    calculatePayroll(
      currentMonthKey,
      currentPayrollDraft
    );

  setText(
    "#monthlyOTMoney",
    currentPayrollResult.baseSalary > 0
      ? `≈ ${formatPayrollMoney(currentPayrollResult.overtimeMoney)}`
      : "Chưa cài lương"
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
      endTime,
      startTime
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

    const refreshedLog = getWorkLog(targetDate);

    openEndShiftNotePrompt({
      type: "main",
      dateKey: targetDate,
      endTime,
      note: getLogVisibleNote(refreshedLog)
    });
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
// GHI CHÚ SAU KHI TAN CA
// =====================================================

function shouldPromptEndShiftNote() {
  return appState.settings?.promptNoteAfterShiftEnd !== false;
}

function openEndShiftNotePrompt({
  type,
  dateKey,
  shiftId = null,
  endTime = "",
  note = ""
}) {
  if (!shouldPromptEndShiftNote()) {
    return;
  }

  appState.endShiftNoteContext = {
    type,
    dateKey,
    shiftId,
    endTime
  };

  const isExtra = type === "extra";

  setText(
    "#endShiftNoteTitle",
    isExtra ? "Ghi chú ca thêm" : "Ghi chú ca chính"
  );

  setText(
    "#endShiftNoteSavedTime",
    endTime
      ? `Giờ tan ca ${endTime} đã được lưu.`
      : "Giờ tan ca đã được lưu."
  );

  setText(
    "#endShiftNoteTypeLabel",
    isExtra ? "CA THÊM" : "CA CHÍNH"
  );

  const input = $("#endShiftNoteInput");

  if (input) {
    input.value = String(note || "");
  }

  openModal("endShiftNoteModal");

  window.setTimeout(() => {
    const textarea = $("#endShiftNoteInput");
    textarea?.focus({ preventScroll: true });

    if (textarea) {
      textarea.setSelectionRange(textarea.value.length, textarea.value.length);
    }
  }, 180);
}

async function saveEndShiftNote() {
  const context = appState.endShiftNoteContext;

  if (!context) {
    closeModal("endShiftNoteModal");
    return;
  }

  const note = String($("#endShiftNoteInput")?.value || "").trim();

  setLoading(true);

  try {
    if (context.type === "main") {
      const log = getWorkLog(context.dateKey);
      const parsed = parseStoredNote(log?.note || "");

      await saveWorkLog(context.dateKey, {
        note: buildStoredNote(note, parsed.meta)
      });
    } else if (context.type === "extra") {
      if (!ensureExtraTable()) {
        return;
      }

      const { error } = await supabaseClient
        .from("extra_shifts")
        .update({ note })
        .eq("id", context.shiftId)
        .eq("username", appState.currentUser);

      if (error) {
        throw error;
      }
    } else {
      throw new Error("Loại ca không hợp lệ.");
    }

    await refreshData(false, parseDateKey(context.dateKey), true);
    closeModal("endShiftNoteModal");
    showToast(note ? "Đã lưu ghi chú tan ca." : "Đã lưu tan ca không kèm ghi chú.");
  } catch (error) {
    showToast(
      `Không thể lưu ghi chú: ${error.message || "Lỗi không xác định"}`,
      true
    );
  } finally {
    setLoading(false);
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

    const refreshedShift = appState.extraShifts.find(
      item => String(item.id) === String(targetShift.id)
    );

    openEndShiftNotePrompt({
      type: "extra",
      dateKey: targetShift.work_date,
      shiftId: targetShift.id,
      endTime: getTimeValue(endDate),
      note: refreshedShift?.note || targetShift.note || ""
    });
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
  const policy = getIncomePolicyForMonth(monthKey, appState.settings);
  const settingsSnapshot = sanitizeSettings({
    ...appState.settings,
    ...policy,
    mealThresholds: Array.isArray(appState.settings?.mealThresholds)
      ? appState.settings.mealThresholds.map(item => ({ ...item }))
      : cloneDefaultMealThresholds()
  });

  INCOME_POLICY_FIELDS.forEach(key => {
    settingsSnapshot[key] = policy[key];
  });

  const effectiveBaseSalary = sanitizeNonNegativeNumber(policy.baseSalary);

  const draft = {
    monthKey,
    baseSalary: effectiveBaseSalary,
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
    appliedSalaryCarryForwardIds: [],
    settingsSnapshot,
    dirty: false
  };

  applySalaryCarryForwardsToDraft(draft, monthKey, { markDirty: false });
  return draft;
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
        appliedSalaryCarryForwardIds: Array.isArray(saved.appliedSalaryCarryForwardIds)
          ? saved.appliedSalaryCarryForwardIds.slice()
          : [],
        settingsSnapshot: sanitizeSettings(saved.settingsSnapshot || appState.settings),
        dirty: false
      }
      : getDefaultPayrollDraft(monthKey);

    const draft = appState.payrollDrafts[monthKey];

    if (saved) {
      applySalaryCarryForwardsToDraft(draft, monthKey, { markDirty: true });

      if (monthKey === getMonthKey(new Date())) {
        applyIncomePolicyToDraft(draft, monthKey, { markDirty: true });
      }
    }
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


function isPayrollSnapshotUsable(snapshot) {
  return Boolean(
    snapshot &&
    typeof snapshot === "object" &&
    snapshot.settings &&
    typeof snapshot.settings === "object" &&
    snapshot.leave &&
    typeof snapshot.leave === "object" &&
    snapshot.allowances &&
    typeof snapshot.allowances === "object" &&
    snapshot.allowances.main &&
    snapshot.allowances.other &&
    snapshot.allowances.attendance &&
    snapshot.allowances.responsibility &&
    Number.isFinite(Number(snapshot.totalOT)) &&
    Number.isFinite(Number(snapshot.paidDays)) &&
    Number.isFinite(Number(snapshot.totalIncome)) &&
    Number.isFinite(Number(snapshot.totalDeductions)) &&
    Number.isFinite(Number(snapshot.netSalary))
  );
}


function getPayrollSourceSignature(result) {
  const leave =
    result?.leave ||
    {};

  const normalize =
    value =>
      Math.round(
        (Number(value) || 0) *
        10000
      ) /
      10000;

  return JSON.stringify({
    totalOT: normalize(result?.totalOT),
    paidDays: normalize(result?.paidDays),
    leave: {
      opening: normalize(leave.opening),
      accrued: normalize(leave.accrued),
      used: normalize(leave.used),
      unpaid: normalize(leave.unpaid),
      requested: normalize(leave.requested),
      closing: normalize(leave.closing)
    }
  });
}


function hasPayrollSourceChanged(saved, liveResult) {
  if (!saved) {
    return false;
  }

  const snapshot =
    saved.calculatedSnapshot;

  if (
    !isPayrollSnapshotUsable(
      snapshot
    )
  ) {
    // Bản lưu cũ không có snapshot đầy đủ: cho phép lưu lại để nâng cấp.
    return true;
  }

  return (
    getPayrollSourceSignature(
      snapshot
    ) !==
    getPayrollSourceSignature(
      liveResult
    )
  );
}


async function savePayrollMonth() {
  const monthKey = getMonthKey(appState.salaryDate);
  const draft = ensurePayrollDraft(monthKey);
  const savedExisting = appState.payrollMonths[monthKey];
  const result = calculatePayroll(monthKey, draft);
  const sourceChanged = hasPayrollSourceChanged(savedExisting, result);

  if (
    savedExisting &&
    !draft.dirty &&
    !sourceChanged
  ) {
    showToast("Bảng lương tháng không có thay đổi mới.");
    return;
  }

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
    appliedSalaryCarryForwardIds: Array.isArray(draft.appliedSalaryCarryForwardIds)
      ? draft.appliedSalaryCarryForwardIds.slice()
      : [],
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

  if (monthKey === getMonthKey(new Date())) {
    renderDashboard();
  }

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
      endTime,
      $("#detailStartTime")
        ?.value || ""
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
      `Xóa toàn bộ dữ liệu OT ngày ${formatShortDate(
        dateKey
      )}? Dữ liệu nghỉ/phép sẽ được giữ nguyên.`
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

  if (monthKey === getMonthKey(new Date())) {
    renderDashboard();
  }
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
  const saved = appState.payrollMonths[monthKey];
  const liveResult = calculatePayroll(monthKey, draft);
  const savedSnapshotUsable = isPayrollSnapshotUsable(
    saved?.calculatedSnapshot
  );
  const sourceChanged = Boolean(
    saved &&
    !draft.dirty &&
    hasPayrollSourceChanged(
      saved,
      liveResult
    )
  );

  // Khi tháng đã lưu và chưa có chỉnh sửa chủ động, luôn hiển thị đúng
  // snapshot đã chốt. Dữ liệu OT/phép thay đổi sau đó chỉ tạo cảnh báo
  // và bật nút Lưu để người dùng chủ động cập nhật bảng lương.
  const result =
    saved &&
    !draft.dirty &&
    savedSnapshotUsable
      ? saved.calculatedSnapshot
      : liveResult;

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
    `${formatNumber(result.monthlyKm)} km giao hàng × ${formatPayrollMoney(result.fuelRate)}/km`
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

  const snapshotText =
    saved &&
    !draft.dirty
      ? sourceChanged
        ? savedSnapshotUsable
          ? "Đã chốt • dữ liệu OT/phép đã thay đổi"
          : "Bản lưu cũ cần cập nhật snapshot"
        : `Đã lưu ${formatSavedTime(saved.savedAt)}`
      : draft.dirty
        ? "Có thay đổi chưa lưu"
        : "Chưa lưu bảng lương tháng";

  const saveStatusText =
    sourceChanged &&
    !draft.dirty
      ? "Dữ liệu OT/phép đã đổi — bấm Lưu bảng lương để cập nhật"
      : snapshotText;

  setText("#payrollSnapshotStatus", snapshotText);
  setText("#payrollSaveStatus", saveStatusText);

  const saveStatus = $("#payrollSaveStatus");
  saveStatus?.classList.toggle(
    "success",
    Boolean(
      saved &&
      !draft.dirty &&
      !sourceChanged
    )
  );
  saveStatus?.classList.toggle(
    "warning",
    Boolean(
      sourceChanged &&
      !draft.dirty
    )
  );
  saveStatus?.classList.remove("error");

  const saveButton = $("#savePayrollMonthButton");
  const resetButton = $("#resetPayrollMonthButton");

  if (saveButton) {
    saveButton.disabled = Boolean(
      saved &&
      !draft.dirty &&
      !sourceChanged
    );
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




const SALARY_CHART_METRICS = Object.freeze({
  "ot-hours": {
    eyebrow: "GIỜ TĂNG CA",
    title: "Xu hướng OT theo tháng",
    value: result => Number(result?.totalOT) || 0,
    format: value => formatHours(value),
    compact: value => `${formatNumber(value)}h`,
    axis: value => `${formatNumber(value)}h`
  },
  "ot-money": {
    eyebrow: "TIỀN TĂNG CA",
    title: "Giá trị OT theo tháng",
    value: result => Number(result?.overtimeMoney) || 0,
    format: value => formatPayrollMoney(value),
    compact: value => formatCompactChartMoney(value),
    axis: value => formatCompactChartMoney(value)
  },
  "net-income": {
    eyebrow: "THỰC NHẬN",
    title: "Xu hướng thực nhận theo tháng",
    value: result => Number(result?.netSalary) || 0,
    format: value => formatPayrollMoney(value),
    compact: value => formatCompactChartMoney(value),
    axis: value => formatCompactChartMoney(value)
  }
});


function formatCompactChartMoney(value) {
  const amount = Math.abs(Number(value) || 0);
  const sign = Number(value) < 0 ? "−" : "";

  if (amount >= 1_000_000_000) {
    return `${sign}${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(amount / 1_000_000_000)}tỷ`;
  }

  if (amount >= 1_000_000) {
    return `${sign}${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 1 }).format(amount / 1_000_000)}tr`;
  }

  if (amount >= 1_000) {
    return `${sign}${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount / 1_000)}k`;
  }

  return `${sign}${new Intl.NumberFormat("vi-VN", { maximumFractionDigits: 0 }).format(amount)}`;
}


function getSalaryChartMetricConfig(metric = appState.salaryChartMetric) {
  return SALARY_CHART_METRICS[metric] || SALARY_CHART_METRICS["ot-hours"];
}


function getSalaryChartMonthKey(year, monthIndex) {
  return `${year}-${String(monthIndex + 1).padStart(2, "0")}`;
}


function isFutureSalaryChartMonth(year, monthIndex) {
  const now = new Date();
  return year > now.getFullYear() ||
    (year === now.getFullYear() && monthIndex > now.getMonth());
}


async function loadSalaryChartSourceData(year) {
  if (!appState.currentUser) {
    return;
  }

  const start = `${year}-01-01`;
  const end = `${year}-12-31`;

  const [workResult, extraResult] = await Promise.all([
    supabaseClient
      .from("work_logs")
      .select("*")
      .eq("username", appState.currentUser)
      .gte("work_date", start)
      .lte("work_date", end)
      .order("work_date", { ascending: false }),
    supabaseClient
      .from("extra_shifts")
      .select("*")
      .eq("username", appState.currentUser)
      .gte("work_date", start)
      .lte("work_date", end)
      .order("start_at", { ascending: false })
  ]);

  if (workResult.error) {
    throw workResult.error;
  }

  let extraRows = [];
  if (extraResult.error) {
    appState.extraTableAvailable = false;
    console.warn("Không tải được extra_shifts cho biểu đồ:", extraResult.error.message);
  } else {
    appState.extraTableAvailable = true;
    extraRows = extraResult.data || [];
  }

  const workRows = workResult.data || [];

  for (let monthIndex = 0; monthIndex < 12; monthIndex += 1) {
    if (isFutureSalaryChartMonth(year, monthIndex)) {
      continue;
    }

    const monthKey = getSalaryChartMonthKey(year, monthIndex);
    mergeWorkLogs(
      monthKey,
      workRows.filter(item => String(item.work_date || "").startsWith(monthKey))
    );
    mergeExtraShifts(
      monthKey,
      extraRows.filter(item => String(item.work_date || "").startsWith(monthKey))
    );
    appState.loadedMonths.add(monthKey);
  }

  renderOpenViewsAfterDataLoad();
}


async function loadSalaryChartYear(year) {
  const safeYear = Math.min(Number(year) || new Date().getFullYear(), new Date().getFullYear());
  appState.salaryChartYear = safeYear;
  appState.salaryChartData = null;
  appState.salaryChartSelectedIndex = null;

  setText("#salaryChartYearLabel", `Năm ${safeYear}`);
  const nextButton = $("#salaryChartNextYear");
  if (nextButton) {
    nextButton.disabled = safeYear >= new Date().getFullYear();
  }

  $("#salaryChartLoading")?.classList.remove("hidden");
  $("#salaryChartContent")?.classList.add("is-loading");

  try {
    try {
      await loadSalaryChartSourceData(safeYear);
    } catch (error) {
      console.warn("Không tải đủ dữ liệu nguồn cho biểu đồ:", error);
      showToast(
        `Không tải đủ dữ liệu biểu đồ: ${error.message || "Lỗi kết nối"}. Các tháng đã chốt vẫn được ưu tiên hiển thị.`,
        true
      );
    }

    const entries = Array.from({ length: 12 }, (_, index) => {
      const monthKey = getSalaryChartMonthKey(safeYear, index);
      const future = isFutureSalaryChartMonth(safeYear, index);

      if (future) {
        return {
          monthKey,
          monthIndex: index,
          future: true,
          available: false,
          savedOfficial: false,
          result: null
        };
      }

      const saved = appState.payrollMonths[monthKey];
      const savedSnapshotUsable = isPayrollSnapshotUsable(saved?.calculatedSnapshot);
      const monthLoaded = appState.loadedMonths.has(monthKey);

      if (!monthLoaded && !savedSnapshotUsable) {
        return {
          monthKey,
          monthIndex: index,
          future: false,
          available: false,
          savedOfficial: false,
          result: null
        };
      }

      const comparison = getPayrollResultForComparison(monthKey);
      const savedOfficial = Boolean(
        comparison.saved &&
        !comparison.draft.dirty &&
        isPayrollSnapshotUsable(comparison.saved.calculatedSnapshot)
      );

      return {
        monthKey,
        monthIndex: index,
        future: false,
        available: true,
        savedOfficial,
        result: comparison.result
      };
    });

    appState.salaryChartData = {
      year: safeYear,
      entries
    };

    const preferredMonth = getMonthKey(appState.salaryDate);
    const preferredIndex = entries.findIndex(item => item.monthKey === preferredMonth && item.available);
    const lastAvailableIndex = entries.reduce(
      (found, item, index) => item.available ? index : found,
      -1
    );
    appState.salaryChartSelectedIndex = preferredIndex >= 0
      ? preferredIndex
      : lastAvailableIndex >= 0
        ? lastAvailableIndex
        : null;

    renderSalaryChart();
  } finally {
    $("#salaryChartLoading")?.classList.add("hidden");
    $("#salaryChartContent")?.classList.remove("is-loading");
  }
}


function getSalaryChartEntriesWithValues() {
  const metric = getSalaryChartMetricConfig();
  return (appState.salaryChartData?.entries || [])
    .filter(item => item.available && item.result)
    .map(item => ({
      ...item,
      value: metric.value(item.result)
    }));
}


function getSalaryChartScale(values) {
  if (!values.length) {
    return { min: 0, max: 1 };
  }

  let min = Math.min(...values, 0);
  let max = Math.max(...values, 0);

  if (Math.abs(max - min) < 0.0001) {
    max = min === 0 ? 1 : min + Math.abs(min) * 0.2;
    if (Math.abs(max - min) < 0.0001) {
      max = min + 1;
    }
  }

  const range = max - min;
  const padding = range * 0.08;
  max += padding;
  if (min < 0) {
    min -= padding;
  } else {
    min = 0;
  }

  return { min, max };
}


function renderSalaryChartSvg(entries) {
  const metric = getSalaryChartMetricConfig();
  const width = 720;
  const height = 330;
  const margin = { top: 24, right: 18, bottom: 50, left: 64 };
  const plotWidth = width - margin.left - margin.right;
  const plotHeight = height - margin.top - margin.bottom;
  const values = entries.map(item => item.value);
  const scale = getSalaryChartScale(values);
  const valueRange = scale.max - scale.min || 1;
  const x = index => margin.left + plotWidth * index / 11;
  const y = value => margin.top + plotHeight * (scale.max - value) / valueRange;
  const ticks = Array.from({ length: 5 }, (_, index) => scale.min + valueRange * index / 4).reverse();
  const entryMap = new Map(entries.map(item => [item.monthIndex, item]));

  const grid = ticks.map(value => {
    const yy = y(value);
    return `
      <line class="salary-chart-grid-line" x1="${margin.left}" y1="${yy}" x2="${width - margin.right}" y2="${yy}"></line>
      <text class="salary-chart-axis-y" x="${margin.left - 10}" y="${yy + 4}" text-anchor="end">${escapeHTML(metric.axis(value))}</text>
    `;
  }).join("");

  const monthLabels = Array.from({ length: 12 }, (_, index) => `
    <text class="salary-chart-axis-x" x="${x(index)}" y="${height - 18}" text-anchor="middle">T${index + 1}</text>
  `).join("");

  const segments = [];
  let currentSegment = [];
  Array.from({ length: 12 }, (_, index) => index).forEach(index => {
    const item = entryMap.get(index);
    if (item) {
      currentSegment.push(`${x(index)},${y(item.value)}`);
    } else if (currentSegment.length) {
      segments.push(currentSegment);
      currentSegment = [];
    }
  });
  if (currentSegment.length) {
    segments.push(currentSegment);
  }

  const lines = segments
    .filter(segment => segment.length > 1)
    .map(segment => `<polyline class="salary-chart-line" points="${segment.join(" ")}"></polyline>`)
    .join("");

  const selectedIndex = appState.salaryChartSelectedIndex;
  const selected = entries.find(item => item.monthIndex === selectedIndex);
  const guide = selected
    ? `<line class="salary-chart-guide" x1="${x(selected.monthIndex)}" y1="${margin.top}" x2="${x(selected.monthIndex)}" y2="${margin.top + plotHeight}"></line>`
    : "";

  const minEntry = entries.length
    ? entries.reduce((a, b) => b.value < a.value ? b : a)
    : null;
  const maxEntry = entries.length
    ? entries.reduce((a, b) => b.value > a.value ? b : a)
    : null;

  const points = entries.map(item => {
    const active = item.monthIndex === selectedIndex;
    const extreme = item === minEntry || item === maxEntry;
    const classes = [
      "salary-chart-point",
      item.savedOfficial ? "saved" : "estimate",
      active ? "selected" : "",
      extreme ? "extreme" : ""
    ].filter(Boolean).join(" ");
    const label = `${formatSalaryHistoryMonth(item.monthKey)}: ${metric.format(item.value)}`;
    return `
      <circle
        class="${classes}"
        cx="${x(item.monthIndex)}"
        cy="${y(item.value)}"
        r="${active ? 8 : 6}"
        tabindex="0"
        role="button"
        aria-label="${escapeHTML(label)}"
        data-salary-chart-index="${item.monthIndex}">
      </circle>
    `;
  }).join("");

  const extremeLabels = [minEntry, maxEntry]
    .filter((item, index, list) => item && list.indexOf(item) === index)
    .map(item => {
      const yy = Math.max(16, y(item.value) - 12);
      return `<text class="salary-chart-point-label" x="${x(item.monthIndex)}" y="${yy}" text-anchor="middle">${escapeHTML(metric.compact(item.value))}</text>`;
    }).join("");

  return `
    <svg id="salaryChartSvg" class="salary-chart-svg" viewBox="0 0 ${width} ${height}" preserveAspectRatio="xMidYMid meet" aria-label="Biểu đồ ${escapeHTML(metric.title)}">
      ${grid}
      ${monthLabels}
      ${guide}
      ${lines}
      ${points}
      ${extremeLabels}
    </svg>
  `;
}


function renderSalaryChartSummary(entries) {
  const metric = getSalaryChartMetricConfig();
  const values = entries.map(item => item.value);
  const total = values.reduce((sum, value) => sum + value, 0);
  const average = values.length ? total / values.length : 0;
  const maxEntry = entries.length
    ? entries.reduce((a, b) => b.value > a.value ? b : a)
    : null;

  setText("#salaryChartTotal", entries.length ? metric.format(total) : "--");
  setText("#salaryChartMax", maxEntry ? metric.format(maxEntry.value) : "--");
  setText(
    "#salaryChartMaxMonth",
    maxEntry ? formatSalaryHistoryMonth(maxEntry.monthKey) : "Chưa có dữ liệu"
  );
  setText("#salaryChartAverage", entries.length ? metric.format(average) : "--");
  setText(
    "#salaryChartAverageHint",
    entries.length ? `Trung bình ${entries.length} tháng có dữ liệu` : "Chưa có dữ liệu"
  );
  setText(
    "#salaryChartTotalHint",
    entries.length ? `${entries.length} tháng có dữ liệu trong năm` : "Theo dữ liệu hiện có"
  );
}


function renderSalaryChartDetail() {
  const metric = getSalaryChartMetricConfig();
  const entry = appState.salaryChartData?.entries?.[appState.salaryChartSelectedIndex];

  if (!entry?.available || !entry.result) {
    setText("#salaryChartSelectedMonth", "Chọn một tháng");
    setText("#salaryChartSelectedValue", "--");
    setText("#salaryChartSelectedStatus", "Chạm vào điểm trên biểu đồ để xem số liệu.");
    return;
  }

  const value = metric.value(entry.result);
  setText("#salaryChartSelectedMonth", formatSalaryHistoryMonth(entry.monthKey));
  setText("#salaryChartSelectedValue", metric.format(value));

  let status;
  if (appState.salaryChartMetric === "ot-hours") {
    status = entry.savedOfficial
      ? "Dữ liệu OT thuộc bảng lương đã chốt."
      : "Dữ liệu OT theo chấm công hiện tại.";
  } else {
    status = entry.savedOfficial
      ? "Bảng lương tháng này đã được chốt."
      : "Tạm tính từ dữ liệu và cấu hình hiện tại; tháng này chưa chốt bảng lương.";
  }
  setText("#salaryChartSelectedStatus", status);
}


function renderSalaryChart() {
  const metric = getSalaryChartMetricConfig();
  const entries = getSalaryChartEntriesWithValues();
  const canvas = $("#salaryChartCanvas");

  setText("#salaryChartMetricEyebrow", metric.eyebrow);
  setText("#salaryChartMetricTitle", metric.title);
  setText("#salaryChartYearLabel", `Năm ${appState.salaryChartYear}`);

  $$('[data-salary-chart-metric]').forEach(button => {
    const active = button.dataset.salaryChartMetric === appState.salaryChartMetric;
    button.classList.toggle("active", active);
    button.setAttribute("aria-selected", active ? "true" : "false");
  });

  renderSalaryChartSummary(entries);

  if (canvas) {
    canvas.dataset.metric = appState.salaryChartMetric;
    canvas.innerHTML = entries.length
      ? renderSalaryChartSvg(entries)
      : renderComparisonEmpty("Chưa có dữ liệu để vẽ biểu đồ cho năm này.");
  }

  renderSalaryChartDetail();
}


function selectSalaryChartPoint(index) {
  const entry = appState.salaryChartData?.entries?.[index];
  if (!entry?.available) {
    return;
  }
  appState.salaryChartSelectedIndex = index;
  renderSalaryChart();
}


function setSalaryChartMetric(metric) {
  if (!SALARY_CHART_METRICS[metric]) {
    return;
  }
  appState.salaryChartMetric = metric;
  renderSalaryChart();
}


async function changeSalaryChartYear(direction) {
  const nextYear = appState.salaryChartYear + direction;
  const currentYear = new Date().getFullYear();
  if (nextYear > currentYear) {
    return;
  }
  await loadSalaryChartYear(nextYear);
}


function openSalaryChart() {
  appState.salaryChartMetric = "ot-hours";
  appState.salaryChartYear = appState.salaryDate.getFullYear();
  openModal("salaryChartModal");
  runLockedAction(
    "salaryChartLoad",
    ["#openSalaryChartButton", "#salaryChartPrevYear", "#salaryChartNextYear"],
    () => loadSalaryChartYear(appState.salaryChartYear)
  );
}


function monthKeyToDate(monthKey) {
  const match = /^(\d{4})-(\d{2})$/.exec(String(monthKey || ""));

  if (!match) {
    return new Date();
  }

  return new Date(Number(match[1]), Number(match[2]) - 1, 1);
}


function getPayrollResultForComparison(monthKey) {
  const draft = ensurePayrollDraft(monthKey);
  const saved = appState.payrollMonths[monthKey];
  const result =
    saved &&
    !draft.dirty &&
    isPayrollSnapshotUsable(saved.calculatedSnapshot)
      ? saved.calculatedSnapshot
      : calculatePayroll(monthKey, draft);

  return {
    monthKey,
    result,
    draft,
    saved,
    policy: getIncomePolicyForMonth(monthKey)
  };
}


function formatSignedMoney(value) {
  const amount = Number(value) || 0;
  const prefix = amount > 0 ? "+" : amount < 0 ? "−" : "";
  return `${prefix}${formatPayrollMoney(Math.abs(amount))}`;
}


function formatSignedNumber(value, unit = "") {
  const amount = Number(value) || 0;
  const prefix = amount > 0 ? "+" : amount < 0 ? "−" : "";
  return `${prefix}${formatNumber(Math.abs(amount))}${unit ? ` ${unit}` : ""}`;
}


function comparisonDiffClass(value, invert = false) {
  const amount = Number(value) || 0;

  if (Math.abs(amount) < 0.0001) {
    return "neutral";
  }

  const positive = invert ? amount < 0 : amount > 0;
  return positive ? "positive" : "negative";
}


function renderComparisonEmpty(message) {
  return `
    <div class="salary-compare-empty">
      <i data-lucide="equal"></i>
      <span>${escapeHTML(message)}</span>
    </div>
  `;
}


function renderSalaryComparePolicyRows(current, baseline, changedOnly) {
  const rows = INCOME_POLICY_FIELDS
    .map(key => {
      const meta = INCOME_POLICY_META[key] || { label: key, kind: "number" };
      const currentValue = current.policy[key];
      const baselineValue = baseline.policy[key];
      const numericDiff = meta.kind === "mode"
        ? null
        : Number(currentValue || 0) - Number(baselineValue || 0);
      const changed = meta.kind === "mode"
        ? String(currentValue) !== String(baselineValue)
        : Math.abs(numericDiff) > 0.0001;

      return {
        key,
        label: meta.label,
        currentValue,
        baselineValue,
        numericDiff,
        changed,
        meta
      };
    })
    .filter(item => !changedOnly || item.changed);

  if (!rows.length) {
    return renderComparisonEmpty("Không có thay đổi cấu hình thu nhập giữa hai tháng.");
  }

  return rows.map(item => {
    const diff = item.meta.kind === "mode"
      ? item.changed
        ? "Đã đổi"
        : "Không đổi"
      : item.meta.kind === "money" || item.meta.kind === "money-rate"
        ? `${item.numericDiff > 0 ? "+" : item.numericDiff < 0 ? "−" : ""}${formatIncomePolicyValue(item.key, Math.abs(item.numericDiff))}`
        : formatSignedNumber(item.numericDiff, item.meta.unit);

    return `
      <div class="salary-compare-row ${item.changed ? "is-changed" : ""}">
        <span class="salary-compare-row-copy">
          <strong>${escapeHTML(item.label)}</strong>
          <small>${escapeHTML(formatIncomePolicyValue(item.key, item.baselineValue))} → ${escapeHTML(formatIncomePolicyValue(item.key, item.currentValue))}</small>
        </span>
        <strong class="salary-compare-diff ${item.meta.kind === "mode" ? "neutral" : comparisonDiffClass(item.numericDiff)}">${escapeHTML(diff)}</strong>
      </div>
    `;
  }).join("");
}


function renderSalaryComparePayrollRows(current, baseline, changedOnly) {
  const a = current.result;
  const b = baseline.result;
  const rows = [
    ["Lương làm việc", "workingSalary", false],
    ["Tiền tăng ca", "overtimeMoney", false],
    ["Phụ cấp", "allowances.main.value", false],
    ["Phụ cấp khác", "allowances.other.value", false],
    ["Phụ cấp chuyên cần", "allowances.attendance.value", false],
    ["Phụ cấp trách nhiệm", "allowances.responsibility.value", false],
    ["Hỗ trợ giao hàng", "fuelMoney", false],
    ["Khoản cộng khác", "otherIncome", false],
    ["Bảo hiểm", "insuranceMoney", true],
    ["Ứng trước", "advance", true],
    ["Khoản trừ khác", "otherDeduction", true]
  ];

  const get = (obj, path) => path.split(".").reduce((value, key) => value?.[key], obj) ?? 0;
  const items = rows
    .map(([label, path, deduction]) => {
      const currentValue = Number(get(a, path)) || 0;
      const baselineValue = Number(get(b, path)) || 0;
      const diff = currentValue - baselineValue;
      return { label, currentValue, baselineValue, diff, deduction };
    })
    .filter(item => !changedOnly || Math.abs(item.diff) > 0.5);

  if (!items.length) {
    return renderComparisonEmpty("Các khoản tiền trong bảng lương không thay đổi.");
  }

  return items.map(item => `
    <div class="salary-compare-row ${Math.abs(item.diff) > 0.5 ? "is-changed" : ""}">
      <span class="salary-compare-row-copy">
        <strong>${escapeHTML(item.label)}</strong>
        <small>${formatPayrollMoney(item.baselineValue)} → ${formatPayrollMoney(item.currentValue)}</small>
      </span>
      <strong class="salary-compare-diff ${comparisonDiffClass(item.diff, item.deduction)}">${formatSignedMoney(item.diff)}</strong>
    </div>
  `).join("");
}


function renderSalaryCompareActivityRows(current, baseline, changedOnly) {
  const rows = [
    {
      label: "Tổng OT",
      current: Number(current.result.totalOT) || 0,
      baseline: Number(baseline.result.totalOT) || 0,
      format: value => formatHours(value),
      diff: value => formatSignedNumber(value, "giờ")
    },
    {
      label: "Công hưởng lương",
      current: Number(current.result.paidDays) || 0,
      baseline: Number(baseline.result.paidDays) || 0,
      format: value => `${formatNumber(value)} công`,
      diff: value => formatSignedNumber(value, "công")
    },
    {
      label: "Kilomet giao hàng",
      current: Number(current.result.monthlyKm) || 0,
      baseline: Number(baseline.result.monthlyKm) || 0,
      format: value => `${formatNumber(value)} km`,
      diff: value => formatSignedNumber(value, "km")
    }
  ];

  const items = rows
    .map(item => ({ ...item, difference: item.current - item.baseline }))
    .filter(item => !changedOnly || Math.abs(item.difference) > 0.0001);

  if (!items.length) {
    return renderComparisonEmpty("OT, ngày công và kilomet giao hàng không thay đổi.");
  }

  return items.map(item => `
    <div class="salary-compare-row ${Math.abs(item.difference) > 0.0001 ? "is-changed" : ""}">
      <span class="salary-compare-row-copy">
        <strong>${escapeHTML(item.label)}</strong>
        <small>${escapeHTML(item.format(item.baseline))} → ${escapeHTML(item.format(item.current))}</small>
      </span>
      <strong class="salary-compare-diff ${comparisonDiffClass(item.difference)}">${escapeHTML(item.diff(item.difference))}</strong>
    </div>
  `).join("");
}


function renderLastSalaryComparison() {
  const comparison = appState.salaryComparison;

  if (!comparison) {
    return;
  }

  const { current, baseline } = comparison;
  const changedOnly = $("#salaryCompareChangedOnly")?.checked !== false;
  const netDiff = Number(current.result.netSalary || 0) - Number(baseline.result.netSalary || 0);
  const incomeDiff = Number(current.result.totalIncome || 0) - Number(baseline.result.totalIncome || 0);
  const deductionDiff = Number(current.result.totalDeductions || 0) - Number(baseline.result.totalDeductions || 0);
  const baselineNet = Number(baseline.result.netSalary || 0);
  const netPercent = Math.abs(baselineNet) > 0.5
    ? netDiff / Math.abs(baselineNet) * 100
    : null;

  setText("#salaryCompareCurrentMonth", formatSalaryHistoryMonth(current.monthKey));
  setText("#salaryCompareNetDiff", formatSignedMoney(netDiff));
  setText(
    "#salaryCompareNetPercent",
    netPercent == null
      ? "Không có cơ sở %"
      : `${netPercent > 0 ? "+" : netPercent < 0 ? "−" : ""}${formatNumber(Math.abs(netPercent))}% so với ${formatSalaryHistoryMonth(baseline.monthKey).replace("Tháng ", "T")}`
  );
  setText("#salaryCompareIncomeDiff", formatSignedMoney(incomeDiff));
  setText("#salaryCompareDeductionDiff", formatSignedMoney(deductionDiff));

  [
    ["#salaryCompareNetDiff", netDiff, false],
    ["#salaryCompareIncomeDiff", incomeDiff, false],
    ["#salaryCompareDeductionDiff", deductionDiff, true]
  ].forEach(([selector, value, invert]) => {
    const element = $(selector);
    element?.classList.remove("positive", "negative", "neutral");
    element?.classList.add(comparisonDiffClass(value, invert));
  });

  const policyList = $("#salaryComparePolicyList");
  const payrollList = $("#salaryComparePayrollList");
  const activityList = $("#salaryCompareActivityList");

  if (policyList) {
    policyList.innerHTML = renderSalaryComparePolicyRows(current, baseline, changedOnly);
  }
  if (payrollList) {
    payrollList.innerHTML = renderSalaryComparePayrollRows(current, baseline, changedOnly);
  }
  if (activityList) {
    activityList.innerHTML = renderSalaryCompareActivityRows(current, baseline, changedOnly);
  }

  refreshIcons();
}


async function runSalaryComparison() {
  const currentMonth = getMonthKey(appState.salaryDate);
  const baselineMonth = String($("#salaryCompareMonth")?.value || "");

  if (!/^\d{4}-(0[1-9]|1[0-2])$/.test(baselineMonth)) {
    showToast("Hãy chọn tháng muốn so sánh.", true);
    return;
  }

  if (baselineMonth === currentMonth) {
    showToast("Hãy chọn một tháng khác tháng đang xem.", true);
    return;
  }

  $("#salaryCompareLoading")?.classList.remove("hidden");
  $("#salaryCompareContent")?.classList.add("is-loading");

  try {
    await Promise.all([
      loadMonthData(monthKeyToDate(currentMonth), { showLoader: false, force: false }),
      loadMonthData(monthKeyToDate(baselineMonth), { showLoader: false, force: false })
    ]);

    appState.salaryComparison = {
      current: getPayrollResultForComparison(currentMonth),
      baseline: getPayrollResultForComparison(baselineMonth)
    };
    renderLastSalaryComparison();
  } finally {
    $("#salaryCompareLoading")?.classList.add("hidden");
    $("#salaryCompareContent")?.classList.remove("is-loading");
  }
}


function openSalaryCompare() {
  const currentMonth = getMonthKey(appState.salaryDate);
  const currentDate = monthKeyToDate(currentMonth);
  currentDate.setMonth(currentDate.getMonth() - 1);
  const defaultBaseline = getMonthKey(currentDate);

  setText("#salaryCompareCurrentMonth", formatSalaryHistoryMonth(currentMonth));
  setValue("#salaryCompareMonth", defaultBaseline);
  setChecked("#salaryCompareChangedOnly", true);
  appState.salaryComparison = null;
  openModal("salaryCompareModal");
  runLockedAction(
    "salaryCompare",
    ["#salaryCompareRunButton"],
    runSalaryComparison
  );
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
      "Chưa có bảng meal_weekly_receipts. Hãy chạy file SQL nhận tiền cơm theo tuần trên Supabase.",
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
        "Chưa có bảng meal_weekly_receipts. Hãy chạy file SQL nhận tiền cơm theo tuần trước."
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
// TÍNH NĂNG ẨN: BẢNG OT HR
// =====================================================

function getPrivateFeatureStorageKey(name) {
  const username = encodeURIComponent(appState.currentUser || "guest");
  return `otpro_${name}_${username}`;
}


function isAdvancedFeaturesUnlocked() {
  if (!appState.currentUser) {
    return false;
  }

  return localStorage.getItem(
    getPrivateFeatureStorageKey("advanced_unlocked")
  ) === "1";
}


function setAdvancedFeaturesUnlocked(enabled) {
  if (!appState.currentUser) {
    return;
  }

  localStorage.setItem(
    getPrivateFeatureStorageKey("advanced_unlocked"),
    enabled ? "1" : "0"
  );
}


function isHrOtFeatureEnabled() {
  if (!appState.currentUser) {
    return false;
  }

  return localStorage.getItem(
    getPrivateFeatureStorageKey("hr_ot_enabled")
  ) === "1";
}


function setHrOtFeatureEnabled(enabled) {
  if (!appState.currentUser) {
    return;
  }

  localStorage.setItem(
    getPrivateFeatureStorageKey("hr_ot_enabled"),
    enabled ? "1" : "0"
  );
}


function refreshAdvancedFeatureUI() {
  const unlocked = isAdvancedFeaturesUnlocked();
  const hrEnabled = isHrOtFeatureEnabled();

  $("#advancedFeaturesSection")
    ?.classList.toggle("hidden", !unlocked);

  setChecked("#hrOtFeatureToggle", hrEnabled);

  $("#hrOtButton")
    ?.classList.toggle("hidden", !hrEnabled);
}


function handleSettingsVersionTap() {
  if (!appState.currentUser || isAdvancedFeaturesUnlocked()) {
    return;
  }

  window.clearTimeout(appState.advancedUnlockTimer);

  appState.advancedUnlockTapCount += 1;

  const remaining = Math.max(0, 7 - appState.advancedUnlockTapCount);

  if (remaining === 0) {
    appState.advancedUnlockTapCount = 0;
    appState.advancedUnlockTimer = null;

    setAdvancedFeaturesUnlocked(true);
    refreshAdvancedFeatureUI();
    refreshIcons();
    showToast("Đã mở tính năng nâng cao.");
    return;
  }

  if (remaining <= 3) {
    showToast(`Còn ${remaining} lần để mở tính năng nâng cao.`);
  }

  appState.advancedUnlockTimer = window.setTimeout(() => {
    appState.advancedUnlockTapCount = 0;
    appState.advancedUnlockTimer = null;
  }, 2500);
}


function getHrOtStorageKey() {
  return getPrivateFeatureStorageKey("hr_ot_minutes");
}


function loadHrOtStorage() {
  try {
    const parsed = JSON.parse(
      localStorage.getItem(getHrOtStorageKey()) || "{}"
    );

    return parsed && typeof parsed === "object" && !Array.isArray(parsed)
      ? parsed
      : {};
  } catch {
    return {};
  }
}


function saveHrOtStorage(data) {
  localStorage.setItem(
    getHrOtStorageKey(),
    JSON.stringify(data || {})
  );
}


function getHrOtMonthKey(date = appState.hrOtDate) {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}`;
}


function openHrOt() {
  if (!isHrOtFeatureEnabled()) {
    showToast("Bảng OT HR đang tắt.", true);
    return;
  }

  closeAppMenu();

  if (!(appState.hrOtDate instanceof Date) || Number.isNaN(appState.hrOtDate.getTime())) {
    const now = new Date();
    appState.hrOtDate = new Date(now.getFullYear(), now.getMonth(), 1);
  }

  renderHrOtTable();
  openModal("hrOtModal");
}


function changeHrOtMonth(delta) {
  const current = appState.hrOtDate instanceof Date
    ? appState.hrOtDate
    : new Date();

  appState.hrOtDate = new Date(
    current.getFullYear(),
    current.getMonth() + delta,
    1
  );

  renderHrOtTable();
}


function getHrOtWeekdayLabel(date) {
  const labels = [
    "Chủ Nhật",
    "Thứ Hai",
    "Thứ Ba",
    "Thứ Tư",
    "Thứ Năm",
    "Thứ Sáu",
    "Thứ Bảy"
  ];

  return labels[date.getDay()];
}


function normalizeHrOtMinutes(value) {
  const digits = String(value ?? "").replace(/\D/g, "").slice(0, 4);

  if (!digits) {
    return "";
  }

  const number = Math.max(0, Math.min(9999, Number(digits)));
  return Number.isFinite(number) ? String(number) : "";
}


function handleHrOtCellInput(event) {
  const input = event.target.closest(".hr-ot-input");

  if (!input) {
    return;
  }

  const normalized = normalizeHrOtMinutes(input.value);

  if (input.value !== normalized) {
    input.value = normalized;
  }

  const row = input.dataset.hrRow;
  const day = input.dataset.hrDay;
  const monthKey = getHrOtMonthKey();

  if (!["normal", "sunday"].includes(row) || !day) {
    return;
  }

  const storage = loadHrOtStorage();
  const month = storage[monthKey] && typeof storage[monthKey] === "object"
    ? storage[monthKey]
    : { normal: {}, sunday: {} };

  month.normal =
    month.normal && typeof month.normal === "object"
      ? month.normal
      : {};

  month.sunday =
    month.sunday && typeof month.sunday === "object"
      ? month.sunday
      : {};

  if (normalized === "") {
    delete month[row][day];
  } else {
    month[row][day] = Number(normalized);
  }

  const hasAnyValue =
    Object.keys(month.normal).length > 0 ||
    Object.keys(month.sunday).length > 0;

  if (hasAnyValue) {
    storage[monthKey] = month;
  } else {
    delete storage[monthKey];
  }

  saveHrOtStorage(storage);
}


function renderHrOtTable() {
  const head = $("#hrOtTableHead");
  const body = $("#hrOtTableBody");

  if (!head || !body) {
    return;
  }

  const date = appState.hrOtDate instanceof Date
    ? appState.hrOtDate
    : new Date();

  const year = date.getFullYear();
  const month = date.getMonth();
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const monthKey = `${year}-${pad(month + 1)}`;
  const storage = loadHrOtStorage();
  const monthData = storage[monthKey] || {};
  const normal = monthData.normal || {};
  const sunday = monthData.sunday || {};

  setText("#hrOtMonthLabel", `${pad(month + 1)}/${year}`);

  const dayCells = [];
  const normalCells = [];
  const sundayCells = [];

  for (let day = 1; day <= daysInMonth; day += 1) {
    const currentDate = new Date(year, month, day);
    const isSunday = currentDate.getDay() === 0;
    const sundayClass = isSunday ? " is-sunday" : "";

    dayCells.push(`
      <th class="hr-ot-day${sundayClass}">
        <strong>${day}</strong>
        <small>${escapeHTML(getHrOtWeekdayLabel(currentDate))}</small>
      </th>
    `);

    normalCells.push(`
      <td class="hr-ot-cell${sundayClass}">
        <input
          class="hr-ot-input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          aria-label="Tca thường ngày ${day}"
          data-hr-row="normal"
          data-hr-day="${day}"
          value="${normal[day] ?? ""}"
        />
      </td>
    `);

    sundayCells.push(`
      <td class="hr-ot-cell${sundayClass}">
        <input
          class="hr-ot-input"
          type="text"
          inputmode="numeric"
          autocomplete="off"
          aria-label="Tca chủ nhật ngày ${day}"
          data-hr-row="sunday"
          data-hr-day="${day}"
          value="${sunday[day] ?? ""}"
        />
      </td>
    `);
  }

  head.innerHTML = `
    <tr>
      <th class="hr-ot-row-label hr-ot-corner"></th>
      ${dayCells.join("")}
    </tr>
  `;

  body.innerHTML = `
    <tr>
      <th class="hr-ot-row-label" scope="row">Tca thường</th>
      ${normalCells.join("")}
    </tr>
    <tr>
      <th class="hr-ot-row-label" scope="row">Tca chủ nhật</th>
      ${sundayCells.join("")}
    </tr>
  `;
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

  refreshAdvancedFeatureUI();

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
  resetSettingsAutosaveState();
  setSettingsTab(
    "general",
    { focus: false, scroll: false }
  );
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
  id,
  {
    skipSettingsSave = false
  } = {}
) {
  if (
    id === "settingsModal" &&
    !skipSettingsSave
  ) {
    requestCloseSettings();
    return;
  }

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

  if (id === "settingsModal") {
    resetSettingsAutosaveState();
    setSettingsTab(
      "general",
      { focus: false, scroll: false }
    );
  }

  if (id === "mealReceiptConfirmModal") {
    appState.selectedMealReceiptWeek = null;
  }

  if (id === "endShiftNoteModal") {
    appState.endShiftNoteContext = null;

    const input = $("#endShiftNoteInput");

    if (input) {
      input.value = "";
    }
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