"use strict";
const OTPRO_FEATURE_BUILD = "20261126-04";
let otFeatureState = {preferences:null,archives:[],notifications:[],unreadCount:0};
let otFeatureFormDirty = false;
let otFeatureLoading = false;
let otFeatureUser = '';

function isMonthDetailArchived(monthKey) {
  return Boolean(appState.payrollMonths?.[monthKey]?.detailArchive || otFeatureState.archives.some(item=>item.month===monthKey));
}
function getArchivedMonthSummary(monthKey) {
  return appState.payrollMonths?.[monthKey]?.detailArchive || otFeatureState.archives.find(item=>item.month===monthKey)?.summary || null;
}
function openArchivedPayroll(monthKey) {
  const [year,month]=monthKey.split('-').map(Number);
  appState.salaryDate=new Date(year,month-1,1);setSalaryPrivacyState(false);openModal('salaryModal');
}
function archivedDetailMessage(monthKey) {
  return `<div class="archived-month-card"><i data-lucide="archive"></i><strong>Chi tiết tháng ${escapeHTML(monthKey)} đã được dọn</strong><p>Giờ làm và ca thêm đã xóa. Bảng lương đã chốt vẫn được giữ.</p><button class="secondary-primary-button" type="button" data-view-archived-payroll="${escapeHTML(monthKey)}">Xem bảng lương tháng</button></div>`;
}
function renderArchivedHistory(monthKey) {
  if(!isMonthDetailArchived(monthKey))return false;
  const container=appState.historyView==='calendar'?$('#calendarDays'):$('#historyList');
  if(container)container.innerHTML=archivedDetailMessage(monthKey);
  refreshIcons();return true;
}
function currentFeaturePreferences() {
  const legacy=getPushReminderSettings();
  return OTProPaperLogic.preferences(otFeatureState.preferences || {...legacy,timezone:getPushTimezone()});
}
function syncFeatureControls() {
  if(otFeatureFormDirty)return;
  const preferences=currentFeaturePreferences();
  setChecked('#featureReminderToggle',preferences.remindPaper);
  setValue('#reminderStart',preferences.paperReminderTime);
  setValue('#reminderEnd',preferences.paperEndTime);
  setValue('#reminderRepeat',preferences.paperRepeatMinutes);
  setChecked('#retentionToggle',preferences.retentionEnabled);
  $$('#reminderDayChoices input').forEach(input=>{input.checked=preferences.paperDays.includes(Number(input.value));});
  setText('#featureTimeZone',`Lịch theo múi giờ: ${preferences.timezone}`);
  setText('#featureSettingsStatus',otFeatureState.preferences
    ? preferences.retentionEnabled?`Đã lưu lịch. Dọn chi tiết được kiểm tra từ ${otFeatureState.retentionArmedAt?new Date(otFeatureState.retentionArmedAt).toLocaleString('vi-VN'): 'lần chạy server tiếp theo'}.`:'Đã lưu lịch. Tự dọn chi tiết đang tắt.'
    : 'Chưa lưu lịch mới. Thiết bị đã đăng ký tiếp tục dùng lịch cũ.');
}
function acceptFeatureState(data,{syncControls=true}={}) {
  if(data?.protocol!==1||!Array.isArray(data.archives)||!Array.isArray(data.notifications))throw new Error('Máy chủ trả thông tin tính năng không hợp lệ.');
  otFeatureState=data;
  const archived=new Set(data.archives.map(item=>item.month));
  appState.workLogs=appState.workLogs.filter(row=>!archived.has(String(row.work_date||'').slice(0,7)));
  appState.extraShifts=appState.extraShifts.filter(row=>!archived.has(String(row.work_date||'').slice(0,7)));
  renderNotifications();if(syncControls)syncFeatureControls();
  if($('#historyModal')?.classList.contains('show'))renderHistory();
  if($('#salaryModal')?.classList.contains('show'))renderSalary();
  if($('#hrOtModal')?.classList.contains('show'))renderHrOtTable();
  if($('#overtimeSheetModal')?.classList.contains('show'))renderOvertimeSheet();
}
async function loadOTFeatures() {
  if(!appState.currentUser||otFeatureLoading)return;
  const username=appState.currentUser;
  if(otFeatureUser!==username){
    otFeatureUser=username;otFeatureState={preferences:null,archives:[],notifications:[],unreadCount:0};otFeatureFormDirty=false;
    renderNotifications();syncFeatureControls();
  }
  otFeatureLoading=true;
  try{
    const {data,error}=await supabaseClient.rpc('otpro_get_features',{p_username:username});
    if(appState.currentUser!==username)return;
    if(error)throw new Error('Cần chạy SQL 08_FEATURES_COMPAT_V1_1_10.sql để dùng lịch nhắc và lưu trữ.');
    acceptFeatureState(data);
  }catch(error){setText('#featureSettingsStatus',error.message);}
  finally{otFeatureLoading=false;if(appState.currentUser&&appState.currentUser!==username)loadOTFeatures();}
}
function renderNotifications() {
  const unread=Number(otFeatureState.unreadCount)||0;
  setText('#notificationUnreadBadge',unread?String(unread):'');
  $('#notificationUnreadBadge')?.classList.toggle('hidden',!unread);
  setText('#notificationSummary',unread?`${unread} thông báo chưa đọc`:'Đã đọc hết thông báo');
  const container=$('#notificationList');if(!container)return;
  container.innerHTML=otFeatureState.notifications.length?otFeatureState.notifications.map(item=>{
    const month=String(item.payload?.month||'');
    const action=month&&/^\d{4}-(0[1-9]|1[0-2])$/.test(month)?`<button type="button" class="mini-text-button" data-notice-open="${escapeHTML(item.category==='paper_reminder'?'paper':'payroll')}" data-notice-month="${escapeHTML(month)}">${item.category==='paper_reminder'?'Mở Giấy tăng ca':'Xem bảng lương'}</button>`:'';
    return `<article class="notification-item${item.read_at?'':' is-unread'}"><strong>${escapeHTML(item.title)}</strong><p>${escapeHTML(item.body)}</p><small>${escapeHTML(new Date(item.created_at).toLocaleString('vi-VN'))}</small><div class="notification-actions">${action}${item.read_at?'':`<button class="mini-text-button" type="button" data-notice-read="${escapeHTML(item.id)}">Đánh dấu đã đọc</button>`}</div></article>`;
  }).join(''):'<div class="empty-state">Chưa có thông báo. Các lần nhắc và kết quả dọn chi tiết sẽ xuất hiện tại đây.</div>';
}
async function markNotificationRead(id=null) {
  const {data,error}=await supabaseClient.rpc('otpro_read_notification',{p_username:appState.currentUser,p_id:id});
  if(error)throw new Error(error.message||'Chưa đánh dấu đã đọc được.');acceptFeatureState(data,{syncControls:false});
}
async function openNotifications() {openModal('notificationsModal');await loadOTFeatures();}
async function saveOTFeaturePatch(patch) {
  const {data,error}=await supabaseClient.rpc('otpro_save_features',{p_username:appState.currentUser,p_preferences:patch});
  if(error)throw new Error(error.message||'Chưa lưu lịch được.');
  otFeatureFormDirty=false;acceptFeatureState(data);
  return data;
}
async function saveFeatureSettings() {
  const days=$$('#reminderDayChoices input:checked').map(input=>Number(input.value));
  if(!days.length){showToast('Chọn ít nhất một ngày nhắc.',true);return;}
  const fields=$$('#featurePreferencesPanel input, #featurePreferencesPanel select');
  const preferences=OTProPaperLogic.preferences({
    ...currentFeaturePreferences(),remindPaper:$('#featureReminderToggle')?.checked===true,
    paperReminderTime:$('#reminderStart')?.value,paperEndTime:$('#reminderEnd')?.value,
    paperRepeatMinutes:Number($('#reminderRepeat')?.value),paperDays:days,
    retentionEnabled:$('#retentionToggle')?.checked===true
  });
  fields.forEach(field=>field.disabled=true);
  try{
    await saveOTFeaturePatch(preferences);
    savePushReminderSettingsLocally({remindPaper:preferences.remindPaper,paperReminderTime:preferences.paperReminderTime});
    syncPushReminderControls();
    try{await syncPushDeviceRemote({quiet:true});}catch{/* per-account schedule is saved; current device status reports its connection separately */}
    showToast('Đã lưu lịch nhắc và chính sách chi tiết.');
  }finally{fields.forEach(field=>field.disabled=false);}
}
async function checkReminderServer() {
  const controller=new AbortController();const timeout=window.setTimeout(()=>controller.abort(),15000);
  try{
    const response=await fetch(`${SB_URL}/functions/v1/otpro-reminders`,{method:'POST',cache:'no-store',headers:{'Content-Type':'application/json',apikey:SB_KEY},body:JSON.stringify({action:'config'}),signal:controller.signal});
    const data=await response.json();
    if(!response.ok||!data.configured)throw new Error('Bộ nhắc chưa sẵn sàng. Kiểm tra Edge Function, SQL, VAPID và Cron trong hướng dẫn.');
    setText('#reminderServerStatus','Bộ gửi đã sẵn sàng. Cron cần được bật để kiểm tra mỗi phút.');
  }catch(error){setText('#reminderServerStatus',error.message||'Chưa kết nối bộ nhắc.');}
  finally{clearTimeout(timeout);}
}
function bindOTFeatureEvents() {
  on('#notificationsButton','click',()=>{closeAppMenu();openNotifications();});
  on('#refreshNotificationsButton','click',loadOTFeatures);
  on('#readAllNotificationsButton','click',()=>runLockedAction('readNotices',['#readAllNotificationsButton'],()=>markNotificationRead()));
  on('#saveFeatureSettingsButton','click',()=>runLockedAction('saveFeatures',['#saveFeatureSettingsButton'],saveFeatureSettings));
  on('#checkReminderServerButton','click',()=>runLockedAction('checkReminderServer',['#checkReminderServerButton'],checkReminderServer));
  on('#featurePreferencesPanel','input',()=>{otFeatureFormDirty=true;setText('#featureSettingsStatus','Có thay đổi chưa lưu.');});
  on('#featureRegisterDevice','click',()=>runLockedAction('pushRegisterFeature',['#featureRegisterDevice'],async()=>{
    const preferences=currentFeaturePreferences();
    savePushReminderSettingsLocally({remindPaper:preferences.remindPaper,paperReminderTime:preferences.paperReminderTime});
    setPushFeatureEnabled(true);setOvertimeSheetFeatureEnabled(true);refreshAdvancedFeatureUI();await registerPushDevice();
  }));
  on('#featureDisconnectDevice','click',()=>runLockedAction('pushDisconnectFeature',['#featureDisconnectDevice'],disconnectPushDevice));
  on('#featureTestDevice','click',()=>runLockedAction('pushTestFeature',['#featureTestDevice'],testPushDevice));
  document.addEventListener('click',event=>{
    const archive=event.target.closest('[data-view-archived-payroll]');if(archive){openArchivedPayroll(archive.dataset.viewArchivedPayroll);return;}
    const read=event.target.closest('[data-notice-read]');if(read){runLockedAction('readNotice',['[data-notice-read]'],()=>markNotificationRead(read.dataset.noticeRead));return;}
    const open=event.target.closest('[data-notice-open]');if(!open)return;
    const month=open.dataset.noticeMonth;if(!/^\d{4}-(0[1-9]|1[0-2])$/.test(month))return;
    if(open.dataset.noticeOpen==='payroll')openArchivedPayroll(month);
    else {const [year,part]=month.split('-').map(Number);appState.overtimeSheetDate=new Date(year,part-1,1);setOvertimeSheetFeatureEnabled(true);openOvertimeSheet();}
  });
  window.addEventListener('online',loadOTFeatures);
}
