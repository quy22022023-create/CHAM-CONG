// --- CẤU HÌNH HỆ THỐNG ---
const APP_VERSION = "OT Pro V4.3(Delta-Tracking)";
const SB_URL = 'https://dtdknettwfgilklaqeae.supabase.co';
const SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZGtuZXR0d2ZnaWxrbGFxZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NzEzMTgsImV4cCI6MjA5MDI0NzMxOH0.qDvvZHNyNPh4QxpD6fDkR4Jr1xUnLSzCm79bsKI6ILk';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentUser = localStorage.getItem('ot_user') || null;
let workData = [], currentViewDate = new Date(), salaryViewDate = new Date();
let isTableView = false, selectedEditDate = null;

document.addEventListener('DOMContentLoaded', () => {
    document.title = "⏱️ " + APP_VERSION;
    document.getElementById('appVersionDisplay').innerText = "Phiên bản: " + APP_VERSION;
    document.getElementById('authTitle').innerText = APP_VERSION + " Login";
});

if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => { navigator.serviceWorker.register('service-worker.js').catch(() => {}); });
}

if (currentUser) {
    document.getElementById('authScreen').style.display = 'none';
    document.getElementById('displayUser').innerText = "User: " + currentUser;
    loadData();
}

// --- THÔNG BÁO ---
function showToast(msg, isError = false) { 
    const t = document.getElementById('toast'); 
    t.innerText = msg; 
    if(isError) t.classList.add('error'); else t.classList.remove('error');
    t.classList.add('show'); 
    setTimeout(() => t.classList.remove('show'), isError ? 5000 : 3000); 
}

async function handleAuth(type) {
    const user = document.getElementById('username').value.trim();
    const pass = document.getElementById('password').value.trim();
    if (!user || !pass) return showToast("Vui lòng nhập đủ!");
    document.getElementById('loading').style.display = 'flex';
    if (type === 'register') {
        const { error } = await supabaseClient.from('users').insert({ username: user, password: pass });
        if (error) showToast("Tên này đã tồn tại!", true); else showToast("Đăng ký thành công!");
    } else {
        const { data } = await supabaseClient.from('users').select('*').eq('username', user).eq('password', pass).single();
        if (data) {
            currentUser = user; localStorage.setItem('ot_user', user);
            document.getElementById('authScreen').style.display = 'none';
            document.getElementById('displayUser').innerText = "User: " + user;
            loadData();
        } else showToast("Sai tài khoản hoặc mật khẩu!", true);
    }
    document.getElementById('loading').style.display = 'none';
}

function logout() { localStorage.removeItem('ot_user'); location.reload(); }
function isSunday(dateStr) { return new Date(dateStr).getDay() === 0; }

// --- THUẬT TOÁN TÍNH TOÁN ---
function calculateOT(inT, outT, isL, dateStr) {
    if (!inT || !outT) return 0;
    const d = "2024-01-01";
    const actS = new Date(`${d}T${inT}:00`);
    let actE = new Date(`${d}T${outT}:00`);
    
    // Xử lý ca qua đêm
    if (actE < actS) actE.setDate(actE.getDate() + 1);

    if (!isSunday(dateStr)) {
        const limitS = new Date(`${d}T07:45:00`);
        const limitE = new Date(`${d}T17:00:00`);
        let mins = 0;

        // OT Sáng (Nếu vào sớm hơn 7:45)
        if (actS < limitS) {
            let endOfMorningOT = actE < limitS ? actE : limitS;
            mins += (endOfMorningOT - actS) / 60000;
        }

        // OT Chiều/Tối (Nếu ra sau 17:00)
        let startOfEveningOT = actS > limitE ? actS : limitE;
        if (actE > startOfEveningOT) {
            mins += (actE - startOfEveningOT) / 60000;
        }

        return parseFloat((mins / 60 + (isL ? 1 : 0)).toFixed(2));
    } else {
        // Chủ nhật
        let diffMins = (actE - actS) / 60000;
        let netMins = diffMins - (isL ? 60 : 0); 
        return parseFloat((Math.max(0, netMins) / 60).toFixed(2));
    }
}

async function loadData() {
    if (!currentUser) return;
    document.getElementById('boxMonthlyOT').classList.add('loading-skeleton');
    document.getElementById('boxTodayOT').classList.add('loading-skeleton');
    const { data, error } = await supabaseClient.from('work_logs').select('*').eq('username', currentUser).order('work_date', { ascending: false });
    if (error) showToast("Lỗi tải: " + error.message, true);
    else { workData = data || []; updateSummary(); }
    document.getElementById('boxMonthlyOT').classList.remove('loading-skeleton');
    document.getElementById('boxTodayOT').classList.remove('loading-skeleton');
}

function updateSummary() {
    const now = new Date(), todayStr = now.toLocaleDateString('en-CA'), thisMonthStr = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0');
    const monthlyOT = workData.filter(r => r.work_date.startsWith(thisMonthStr)).reduce((sum, r) => sum + (parseFloat(r.overtime) || 0), 0);
    document.getElementById('monthlyOT').innerText = monthlyOT.toFixed(1) + 'h';
    const todayRec = workData.find(r => r.work_date === todayStr);

    // Check ca đêm hôm qua
    let isWorkingOvernight = false;
    const yest = new Date(); yest.setDate(yest.getDate() - 1);
    const yestStr = yest.toLocaleDateString('en-CA');
    const yestRec = workData.find(r => r.work_date === yestStr);
    if (!todayRec && yestRec && yestRec.start_time && !yestRec.end_time) isWorkingOvernight = true;

    document.getElementById('todayOTDisp').innerText = (todayRec?.overtime || 0) + 'h';
    document.getElementById('startBtn').disabled = !!todayRec;
    
    if (isWorkingOvernight) document.getElementById('workStatus').innerText = "Đang làm ca đêm từ hôm qua... 🌙";
    else document.getElementById('workStatus').innerText = todayRec ? (todayRec.end_time ? "Đã tan ca ✅" : "Đang làm việc... ⏱️") : "Chưa vào ca";

    const label = document.getElementById('lunchLabelMain');
    if (now.getDay() === 0) label.innerHTML = '<i class="fas fa-coffee"></i> Nghỉ trưa 1h (Trừ OT)';
    else label.innerHTML = '<i class="fas fa-utensils"></i> Tăng ca trưa (+1h)';
}

document.getElementById('startBtn').onclick = async () => {
    const t = new Date().toLocaleTimeString('vi-VN', {hour12:false}).slice(0,5);
    const todayStr = new Date().toLocaleDateString('en-CA');
    const { error } = await supabaseClient.from('work_logs').upsert({ work_date: todayStr, username: currentUser, start_time: t });
    if (error) return showToast("Lỗi: " + error.message, true);
    loadData(); showToast("Vào ca lúc " + t);
};

document.getElementById('endBtn').onclick = async () => {
    const t = new Date().toLocaleTimeString('vi-VN', {hour12:false}).slice(0,5);
    const todayStr = new Date().toLocaleDateString('en-CA');
    let targetDate = todayStr, rec = workData.find(r => r.work_date === todayStr);
    
    if (!rec || !rec.start_time) {
        const yest = new Date(); yest.setDate(yest.getDate() - 1);
        const yestStr = yest.toLocaleDateString('en-CA'), yestRec = workData.find(r => r.work_date === yestStr);
        if (yestRec && yestRec.start_time && !yestRec.end_time) {
            targetDate = yestStr; rec = yestRec;
            showToast("🌙 Đã nhận diện tan ca đêm!");
        }
    }
    
    let startTime = rec?.start_time;
    if (!startTime) { if (isSunday(targetDate)) return showToast("Hãy ấn 'Vào ca' trước!"); startTime = "07:45"; }

    const ot = calculateOT(startTime, t, document.getElementById('lunchCheckMain').checked, targetDate);
    const { error } = await supabaseClient.from('work_logs').upsert({ work_date: targetDate, username: currentUser, start_time: startTime, end_time: t, overtime: ot });
    if (error) return showToast("Lỗi: " + error.message, true);
    loadData(); showToast(`Tan ca: ${t}. (Vào: ${startTime})`);
};

// --- QUẢN LÝ LỊCH VÀ CHỈNH SỬA ---
function switchView(view) {
    isTableView = (view === 'table');
    document.getElementById('btnCalView').classList.toggle('active', !isTableView);
    document.getElementById('btnTableView').classList.toggle('active', isTableView);
    document.getElementById('calendarContainer').style.display = isTableView ? 'none' : 'block';
    document.getElementById('tableContainer').style.display = isTableView ? 'block' : 'none';
    if(isTableView) renderTableView(); else renderCalendar();
}

function renderCalendar() {
    const grid = document.getElementById('calendarDays'); grid.innerHTML = '';
    const y = currentViewDate.getFullYear(), m = currentViewDate.getMonth();
    document.getElementById('calMonthYear').innerText = `Tháng ${m + 1}/${y}`;
    const firstDay = new Date(y, m, 1).getDay(), emptySlots = firstDay === 0 ? 6 : firstDay - 1, daysInMonth = new Date(y, m + 1, 0).getDate();
    for (let i = 0; i < emptySlots; i++) grid.appendChild(document.createElement('div'));
    for (let d = 1; d <= daysInMonth; d++) {
        const dStr = `${y}-${(m+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`, rec = workData.find(r => r.work_date === dStr);
        const el = document.createElement('div');
        el.className = `cal-day ${rec ? 'has-data' : ''} ${dStr === new Date().toLocaleDateString('en-CA') ? 'today' : ''} ${isSunday(dStr) ? 'sunday' : ''} ${dStr === selectedEditDate ? 'selected' : ''}`;
        el.innerHTML = `<span>${d}</span>${rec ? `<small style="font-size:8px;position:absolute;bottom:2px;">+${rec.overtime}</small>` : ''}`;
        el.onclick = () => showEdit(dStr, rec);
        grid.appendChild(el);
    }
}

function renderTableView() {
    const tbody = document.getElementById('tableBody'); tbody.innerHTML = '';
    const y = currentViewDate.getFullYear(), m = currentViewDate.getMonth();
    document.getElementById('calMonthYear').innerText = `Tháng ${m + 1}/${y}`;
    const daysInMonth = new Date(y, m + 1, 0).getDate();
    let hasData = false;
    for (let d = daysInMonth; d >= 1; d--) {
        const dStr = `${y}-${(m+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`, rec = workData.find(r => r.work_date === dStr);
        if (rec) {
            hasData = true; const tr = document.createElement('tr'); if (dStr === selectedEditDate) tr.className = 'selected';
            tr.innerHTML = `<td class="${isSunday(dStr) ? 't-sunday' : ''}">${dStr.slice(-2)}/${dStr.slice(5,7)}</td><td>${rec.start_time || '-'}</td><td>${rec.end_time || '-'}</td><td style="color:var(--ios-red); font-weight:700;">${rec.overtime}h</td>`;
            tr.onclick = () => showEdit(dStr, rec); tbody.appendChild(tr);
        }
    }
    if(!hasData) tbody.innerHTML = `<tr><td colspan="4" style="color:#8E8E93; padding: 20px;">Trống</td></tr>`;
}

function showEdit(date, rec) {
    selectedEditDate = date; if(isTableView) renderTableView(); else renderCalendar();
    const panel = document.getElementById('editPanel');
    panel.style.display = 'block'; panel.scrollIntoView({ behavior: 'smooth' });
    document.getElementById('editDateLabel').innerText = "Ngày: " + date;
    
    const inI = document.getElementById('editIn'), outI = document.getElementById('editOut'), lI = document.getElementById('lunchCheckEdit'), otI = document.getElementById('editOT'), noteI = document.getElementById('editNote');
    document.getElementById('lunchLabelEdit').innerText = isSunday(date) ? "Nghỉ trưa 1h (Trừ OT)" : "Tăng ca trưa (+1h)";
    
    inI.value = rec?.start_time || "07:45"; outI.value = rec?.end_time || "17:00"; otI.value = rec?.overtime || 0; noteI.value = rec?.note || ""; 
    
    // --- BẢN VÁ: THUẬT TOÁN DELTA TRACKING ---
    // Lưu lại mốc tính toán cơ bản ban đầu khi vừa mở modal
    let lastBaseOT = calculateOT(inI.value, outI.value, lI.checked, date);

    const autoCalc = () => {
        // Tính ra mức OT cơ bản mới sau khi có tương tác (gạt nút, đổi giờ gốc)
        let newBaseOT = calculateOT(inI.value, outI.value, lI.checked, date);
        // Tìm ra độ chênh lệch (delta) so với mốc cũ
        let delta = newBaseOT - lastBaseOT;
        // Cộng dồn độ chênh lệch vào tổng giờ OT hiện tại (bảo toàn được giờ nhập tay/ca lẻ)
        let currentTotalOT = parseFloat(otI.value) || 0;
        otI.value = (currentTotalOT + delta).toFixed(2);
        
        // Cập nhật lại mốc để chuẩn bị cho lần tương tác tiếp theo
        lastBaseOT = newBaseOT;
    };
    
    inI.oninput = autoCalc; outI.oninput = autoCalc; lI.onchange = autoCalc;
    
    // LOGIC CA LẺ
    const btnAddExtra = document.getElementById('btnAddExtra');
    const newBtn = btnAddExtra.cloneNode(true); btnAddExtra.parentNode.replaceChild(newBtn, btnAddExtra);
    newBtn.onclick = () => {
        const exIn = document.getElementById('extraIn').value, exOut = document.getElementById('extraOut').value;
        if(!exIn || !exOut) return showToast("Vui lòng nhập đủ giờ!");
        
        let dStart = new Date(`2024-01-01T${exIn}:00`), dEnd = new Date(`2024-01-01T${exOut}:00`);
        if(dEnd < dStart) dEnd.setDate(dEnd.getDate() + 1);
        
        let extraHrs = parseFloat(((dEnd - dStart) / 3600000).toFixed(2));
        otI.value = (parseFloat(otI.value || 0) + extraHrs).toFixed(2);
        
        let log = `[Ca thêm: ${exIn}-${exOut}]`;
        noteI.value = noteI.value ? `${noteI.value}\n${log}` : log;
        document.getElementById('extraIn').value = ''; document.getElementById('extraOut').value = '';
        showToast(`Đã cộng thêm ${extraHrs}h`);
    };

    document.getElementById('saveBtn').onclick = async () => {
        const { error } = await supabaseClient.from('work_logs').upsert({ work_date: date, username: currentUser, start_time: inI.value, end_time: outI.value, overtime: parseFloat(otI.value), note: noteI.value });
        if (error) return alert("Lỗi: " + error.message);
        showToast("Đã lưu!"); await loadData(); if(isTableView) renderTableView(); else renderCalendar();
        panel.style.display = 'none'; 
    };
    
    document.getElementById('deleteBtn').onclick = async () => {
        if(confirm("Xóa ngày " + date + "?")) { 
            const { error } = await supabaseClient.from('work_logs').delete().eq('work_date', date).eq('username', currentUser); 
            if (error) return showToast("Lỗi xóa", true);
            selectedEditDate = null; await loadData(); if(isTableView) renderTableView(); else renderCalendar();
            panel.style.display = 'none'; 
        }
    };
}

// --- LƯƠNG ---
function updateSalaryDisplay() {
    const y = salaryViewDate.getFullYear(), m = salaryViewDate.getMonth(), monthStr = `${y}-${(m+1).toString().padStart(2,'0')}`;
    document.getElementById('salaryMonthYear').innerText = `Tháng ${m + 1}/${y}`;
    const totalOT = workData.filter(r => r.work_date.startsWith(monthStr)).reduce((sum, r) => sum + (parseFloat(r.overtime) || 0), 0);
    const base = parseFloat(document.getElementById('baseSalaryInput').value) || parseFloat(localStorage.getItem('salary_' + currentUser)) || 0;
    localStorage.setItem('salary_' + currentUser, base);
    const money = ((base / 26) / 8) * 2 * totalOT; 
    document.getElementById('salaryOTHours').innerText = totalOT.toFixed(1) + 'h';
    document.getElementById('otMoneyDetail').innerText = new Intl.NumberFormat('vi-VN').format(Math.round(money)) + "đ";
}

function changeMonth(dir) { currentViewDate.setMonth(currentViewDate.getMonth() + dir); selectedEditDate = null; document.getElementById('editPanel').style.display = 'none'; if(isTableView) renderTableView(); else renderCalendar(); }
function changeSalaryMonth(dir) { salaryViewDate.setMonth(salaryViewDate.getMonth() + dir); updateSalaryDisplay(); }
function openCalendar() { if(isTableView) renderTableView(); else renderCalendar(); document.getElementById('calendarModal').style.display = 'flex'; }
function openSalaryModal() { salaryViewDate = new Date(); document.getElementById('baseSalaryInput').value = localStorage.getItem('salary_' + currentUser) || ""; updateSalaryDisplay(); document.getElementById('salaryModal').style.display = 'flex'; }
function closeModal(id) { document.getElementById(id).style.display = 'none'; selectedEditDate = null; document.getElementById('editPanel').style.display = 'none'; }

setInterval(() => {
    document.getElementById('currentTime').innerText = new Date().toLocaleTimeString('vi-VN', {hour12:false});
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('vi-VN', {weekday:'long', day:'numeric', month:'numeric'});
}, 1000);
