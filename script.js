// --- CẤU HÌNH PHIÊN BẢN & HỆ THỐNG ---
const APP_VERSION = "OT Pro V3.5(Auto-Sync.1)";
const SB_URL = 'https://dtdknettwfgilklaqeae.supabase.co', SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZGtuZXR0d2ZnaWxrbGFxZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NzEzMTgsImV4cCI6MjA5MDI0NzMxOH0.qDvvZHNyNPh4QxpD6fDkR4Jr1xUnLSzCm79bsKI6ILk';
const supabaseClient = supabase.createClient(SB_URL, SB_KEY);

let currentUser = localStorage.getItem('ot_user') || null;
let workData = [], currentViewDate = new Date(), salaryViewDate = new Date();
let isTableView = false, selectedEditDate = null;

// Tự động cập nhật phiên bản lên giao diện ngay khi tải trang
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

// --- HÀM THÔNG BÁO THÔNG MINH ---
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

function calculateOT(inT, outT, isL, dateStr) {
    if (!inT || !outT) return 0;
    const d = "2024-01-01";
    const actS = new Date(`${d}T${inT}:00`), actE = new Date(`${d}T${outT}:00`);
    let diff = (actE - actS) / 60000;
    if (diff < 0) diff += 1440;
    if (!isSunday(dateStr)) {
        const limitS = new Date(`${d}T07:45:00`), limitE = new Date(`${d}T17:00:00`);
        let mins = 0;
        if (actS < limitS) mins += (limitS - actS) / 60000;
        if (actE > limitE) mins += (actE - limitE) / 60000;
        return parseFloat((mins / 60 + (isL ? 1 : 0)).toFixed(2));
    } else {
        let netMins = diff - (isL ? 60 : 0); 
        return parseFloat((Math.max(0, netMins) / 60).toFixed(2));
    }
}

async function loadData() {
    if (!currentUser) return;
    document.getElementById('boxMonthlyOT').classList.add('loading-skeleton');
    document.getElementById('boxTodayOT').classList.add('loading-skeleton');
    
    const { data, error } = await supabaseClient.from('work_logs').select('*').eq('username', currentUser).order('work_date', { ascending: false });
    if (error) {
        showToast("Lỗi tải dữ liệu: " + error.message, true);
    } else {
        workData = data || [];
        updateSummary();
    }
    
    document.getElementById('boxMonthlyOT').classList.remove('loading-skeleton');
    document.getElementById('boxTodayOT').classList.remove('loading-skeleton');
}

function updateSummary() {
    const now = new Date(), todayStr = now.toLocaleDateString('en-CA'), thisMonthStr = now.getFullYear() + '-' + (now.getMonth() + 1).toString().padStart(2, '0');
    const monthlyOT = workData.filter(r => r.work_date.startsWith(thisMonthStr)).reduce((sum, r) => sum + (parseFloat(r.overtime) || 0), 0);
    document.getElementById('monthlyOT').innerText = monthlyOT.toFixed(1) + 'h';
    const todayRec = workData.find(r => r.work_date === todayStr);
    document.getElementById('todayOTDisp').innerText = (todayRec?.overtime || 0) + 'h';
    document.getElementById('startBtn').disabled = !!todayRec;
    document.getElementById('workStatus').innerText = todayRec ? (todayRec.end_time ? "Đã tan ca ✅" : "Đang làm việc... ⏱️") : "Chưa vào ca";
    const label = document.getElementById('lunchLabelMain');
    if (now.getDay() === 0) label.innerHTML = '<i class="fas fa-coffee"></i> Có nghỉ trưa 1h (Trừ vào OT)';
    else label.innerHTML = '<i class="fas fa-utensils"></i> Tăng ca trưa (+1h)';
}

document.getElementById('startBtn').onclick = async () => {
    const t = new Date().toLocaleTimeString('vi-VN', {hour12:false}).slice(0,5);
    const todayStr = new Date().toLocaleDateString('en-CA');
    
    const { error } = await supabaseClient.from('work_logs').upsert({ work_date: todayStr, username: currentUser, start_time: t });
    if (error) return showToast("Lỗi Database: " + error.message, true);
    
    loadData(); showToast("Vào ca lúc " + t);
};

document.getElementById('endBtn').onclick = async () => {
    const t = new Date().toLocaleTimeString('vi-VN', {hour12:false}).slice(0,5);
    const todayStr = new Date().toLocaleDateString('en-CA');
    let rec = workData.find(r => r.work_date === todayStr);
    
    let startTime = rec?.start_time;
    if (!startTime) {
        if (isSunday(todayStr)) return showToast("Chủ nhật: Vui lòng ấn 'Vào ca' trước!");
        startTime = "07:45"; 
    }

    const ot = calculateOT(startTime, t, document.getElementById('lunchCheckMain').checked, todayStr);
    const { error } = await supabaseClient.from('work_logs').upsert({ 
        work_date: todayStr, username: currentUser, start_time: startTime, end_time: t, overtime: ot 
    });
    if (error) return showToast("Lỗi Database: " + error.message, true);
    
    loadData(); 
    showToast(`Tan ca lúc ${t}. (Vào: ${startTime})`);
};

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
        const dStr = `${y}-${(m+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`;
        const rec = workData.find(r => r.work_date === dStr);
        if (rec) {
            hasData = true;
            const tr = document.createElement('tr');
            if (dStr === selectedEditDate) tr.className = 'selected';
            tr.innerHTML = `<td class="${isSunday(dStr) ? 't-sunday' : ''}">${dStr.slice(-2)}/${dStr.slice(5,7)}</td>
                            <td>${rec.start_time || '-'}</td>
                            <td>${rec.end_time || '-'}</td>
                            <td style="color:var(--ios-red); font-weight:700;">${rec.overtime}h</td>`;
            tr.onclick = () => showEdit(dStr, rec);
            tbody.appendChild(tr);
        }
    }
    if(!hasData) tbody.innerHTML = `<tr><td colspan="4" style="color:#8E8E93; padding: 20px;">Chưa có dữ liệu OT tháng này</td></tr>`;
}

function showEdit(date, rec) {
    selectedEditDate = date; 
    if(isTableView) renderTableView(); else renderCalendar();

    document.getElementById('editPanel').style.display = 'block';
    document.getElementById('editPanel').scrollIntoView({ behavior: 'smooth' });
    document.getElementById('editDateLabel').innerText = "Ngày: " + date;
    const inI = document.getElementById('editIn'), outI = document.getElementById('editOut'), lI = document.getElementById('lunchCheckEdit'), otI = document.getElementById('editOT'), noteI = document.getElementById('editNote');
    document.getElementById('lunchLabelEdit').innerText = isSunday(date) ? "Có nghỉ trưa 1h (Trừ OT)" : "Tăng ca trưa (+1h)";
    inI.value = rec?.start_time || "07:45"; outI.value = rec?.end_time || "17:00"; otI.value = rec?.overtime || 0; 
    noteI.value = rec?.note || ""; 
    
    const autoCalcEdit = () => { otI.value = calculateOT(inI.value, outI.value, lI.checked, date); };
    inI.oninput = autoCalcEdit; outI.oninput = autoCalcEdit; lI.onchange = autoCalcEdit;
    
    document.getElementById('saveBtn').onclick = async () => {
        const { error } = await supabaseClient.from('work_logs').upsert({ 
            work_date: date, username: currentUser, start_time: inI.value, end_time: outI.value, overtime: parseFloat(otI.value), note: noteI.value 
        });
        
        if (error) {
            alert("Lỗi lưu dữ liệu: Bạn CHƯA tạo cột 'note' trong bảng work_logs trên Supabase!\n\nChi tiết lỗi: " + error.message);
            return;
        }

        showToast("Đã lưu!"); 
        await loadData(); 
        if(isTableView) renderTableView(); else renderCalendar();
        document.getElementById('editPanel').style.display = 'none'; 
    };
    
    document.getElementById('deleteBtn').onclick = async () => {
        if(confirm("Xóa ngày " + date + "?")) { 
            const { error } = await supabaseClient.from('work_logs').delete().eq('work_date', date).eq('username', currentUser); 
            if (error) return showToast("Lỗi xóa: " + error.message, true);

            selectedEditDate = null; 
            await loadData(); 
            if(isTableView) renderTableView(); else renderCalendar();
            document.getElementById('editPanel').style.display = 'none'; 
        }
    };
}

function updateSalaryDisplay() {
    const y = salaryViewDate.getFullYear(), m = salaryViewDate.getMonth();
    document.getElementById('salaryMonthYear').innerText = `Tháng ${m + 1}/${y}`;

    const monthStr = `${y}-${(m+1).toString().padStart(2,'0')}`;
    const totalOT = workData.filter(r => r.work_date.startsWith(monthStr)).reduce((sum, r) => sum + (parseFloat(r.overtime) || 0), 0);
    const base = parseFloat(document.getElementById('baseSalaryInput').value) || parseFloat(localStorage.getItem('salary_' + currentUser)) || 0;
    localStorage.setItem('salary_' + currentUser, base);
    const money = ((base / 26) / 8) * 2 * totalOT; 
    document.getElementById('salaryOTHours').innerText = totalOT.toFixed(1) + 'h';
    document.getElementById('otMoneyDetail').innerText = new Intl.NumberFormat('vi-VN').format(Math.round(money)) + "đ";
}

function changeMonth(dir) { 
    currentViewDate.setMonth(currentViewDate.getMonth() + dir); 
    selectedEditDate = null; 
    document.getElementById('editPanel').style.display = 'none'; 
    if(isTableView) renderTableView(); else renderCalendar(); 
}
function changeSalaryMonth(dir) { salaryViewDate.setMonth(salaryViewDate.getMonth() + dir); updateSalaryDisplay(); }

function openCalendar() { 
    if(isTableView) renderTableView(); else renderCalendar(); 
    document.getElementById('calendarModal').style.display = 'flex'; 
}

function openSalaryModal() { 
    salaryViewDate = new Date(); 
    document.getElementById('baseSalaryInput').value = localStorage.getItem('salary_' + currentUser) || "";
    updateSalaryDisplay(); document.getElementById('salaryModal').style.display = 'flex'; 
}

function closeModal(id) { 
    document.getElementById(id).style.display = 'none'; 
    selectedEditDate = null; 
    document.getElementById('editPanel').style.display = 'none'; 
    document.getElementById('editNote').value = "";
}

setInterval(() => {
    document.getElementById('currentTime').innerText = new Date().toLocaleTimeString('vi-VN', {hour12:false});
    document.getElementById('currentDate').innerText = new Date().toLocaleDateString('vi-VN', {weekday:'long', day:'numeric', month:'numeric'});
}, 1000);
