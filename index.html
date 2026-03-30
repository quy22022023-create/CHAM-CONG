<!DOCTYPE html>
<html lang="vi">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0, maximum-scale=1.0, user-scalable=no, viewport-fit=cover">
    <meta name="apple-mobile-web-app-capable" content="yes">
    <title>⏱️ OT Pro - Ultimate V3.2</title>
    
    <link rel="stylesheet" href="https://cdnjs.cloudflare.com/ajax/libs/font-awesome/6.4.0/css/all.min.css">
    <link href="https://fonts.googleapis.com/css2?family=Inter:wght@400;600;700;800&display=swap" rel="stylesheet">
    <script src="https://cdn.jsdelivr.net/npm/@supabase/supabase-js@2"></script>
    
    <style>
        :root { --ios-red: #FF3B30; --ios-green: #34C759; --ios-blue: #007AFF; --ios-orange: #FF9500; --ios-bg: #F2F2F7; }
        * { margin: 0; padding: 0; box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
        body { font-family: 'Inter', -apple-system, sans-serif; background: var(--ios-bg); color: #1C1C1E; padding-bottom: calc(80px + env(safe-area-inset-bottom)); min-height: 100vh; position: relative; }
        
        #authScreen { position: fixed; inset: 0; background: var(--ios-bg); z-index: 9999; display: flex; align-items: center; justify-content: center; padding: 20px; }
        .auth-card { background: white; width: 100%; max-width: 400px; padding: 30px; border-radius: 32px; box-shadow: 0 10px 30px rgba(0,0,0,0.1); text-align: center; }
        .auth-input { width: 100%; padding: 16px; margin-bottom: 12px; border-radius: 14px; border: 1px solid #E5E5EA; background: #F2F2F7; font-size: 16px; outline: none; }
        
        .header { background: linear-gradient(135deg, var(--ios-red), #AF52DE); color: white; padding: calc(40px + env(safe-area-inset-top)) 20px 40px; text-align: center; border-radius: 0 0 32px 32px; position: relative; }
        .logout-btn { position: absolute; top: calc(10px + env(safe-area-inset-top)); right: 20px; color: white; font-size: 18px; padding: 10px; }
        
        .time-card { background: white; margin: -30px 20px 20px; padding: 24px; border-radius: 24px; box-shadow: 0 8px 24px rgba(0,0,0,0.08); text-align: center; position: relative; z-index: 10; }
        .clock { font-size: 46px; font-weight: 800; color: var(--ios-red); margin: 5px 0; font-variant-numeric: tabular-nums; }
        
        .card { background: white; margin: 0 20px 20px; padding: 20px; border-radius: 24px; box-shadow: 0 2px 10px rgba(0,0,0,0.04); }
        .btn { flex: 1; border: none; border-radius: 14px; padding: 16px; font-size: 16px; font-weight: 600; display: flex; align-items: center; justify-content: center; gap: 8px; transition: 0.2s; cursor: pointer; }
        .btn:active { transform: scale(0.95); opacity: 0.8; }
        .btn:disabled { background: #E5E5EA; color: #8E8E93; cursor: not-allowed; }
        .btn-start { background: var(--ios-green); color: white; }
        .btn-end { background: var(--ios-orange); color: white; }
        .btn-salary { background: #5856D6; color: white; width: 100%; margin-top: 15px; }
        .btn-secondary { background: #F2F2F7; color: var(--ios-blue); width: 100%; margin-top: 12px; }

        .lunch-box { display: flex; justify-content: space-between; align-items: center; background: #FFF9F2; padding: 14px 16px; border-radius: 16px; margin-bottom: 15px; border: 1px dashed var(--ios-orange); }
        .switch { position: relative; width: 51px; height: 31px; }
        .switch input { opacity: 0; width: 0; height: 0; }
        .slider { position: absolute; cursor: pointer; inset: 0; background-color: #CCC; transition: .3s; border-radius: 34px; }
        .slider:before { position: absolute; content: ""; height: 27px; width: 27px; left: 2px; bottom: 2px; background-color: white; transition: .3s; border-radius: 50%; }
        input:checked + .slider { background-color: var(--ios-green); }
        input:checked + .slider:before { transform: translateX(20px); }

        .cal-nav { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
        .cal-grid { display: grid; grid-template-columns: repeat(7, 1fr); gap: 5px; text-align: center; }
        .cal-head { font-size: 10px; font-weight: 700; color: #8E8E93; }
        .cal-day { aspect-ratio: 1/1; display: flex; flex-direction: column; align-items: center; justify-content: center; border-radius: 10px; font-size: 13px; background: #F9F9F9; position: relative; }
        .cal-day.has-data { background: #E8F5E9; color: var(--ios-green); font-weight: 700; }
        .cal-day.today { border: 2px solid var(--ios-blue); }
        .cal-day.sunday { color: var(--ios-red); }

        .modal { display: none; position: fixed; inset: 0; background: rgba(0,0,0,0.5); z-index: 100; align-items: center; justify-content: center; backdrop-filter: blur(8px); }
        .modal-content { background: white; width: 92%; border-radius: 28px; padding: 20px; max-height: 85vh; overflow-y: auto; }
        
        .footer-info { position: fixed; bottom: 0; left: 0; width: 100%; text-align: center; padding: 15px; color: #8E8E93; font-size: 11px; background: rgba(242, 242, 247, 0.9); backdrop-filter: blur(5px); }

        #loading { position: fixed; inset: 0; background: rgba(255,255,255,0.7); display: none; align-items: center; justify-content: center; z-index: 10000; }
        .toast { position: fixed; bottom: 80px; left: 50%; transform: translateX(-50%) translateY(150px); background: rgba(0,0,0,0.85); color: white; padding: 12px 24px; border-radius: 25px; transition: 0.3s; z-index: 20000; text-align: center; font-size: 14px; min-width: 200px; }
        .toast.show { transform: translateX(-50%) translateY(0); }
    </style>
</head>
<body>

<div id="loading"><i class="fas fa-circle-notch fa-spin fa-2x" style="color: var(--ios-red)"></i></div>

<div id="authScreen">
    <div class="auth-card">
        <i class="fas fa-user-clock fa-3x" style="color: var(--ios-red); margin-bottom: 15px;"></i>
        <h2 style="margin-bottom: 20px;">OT Pro Login</h2>
        <input type="text" id="username" class="auth-input" placeholder="Tên đăng nhập">
        <input type="password" id="password" class="auth-input" placeholder="Mật khẩu">
        <div style="display: flex; gap: 10px; margin-top: 10px;">
            <button class="btn btn-start" onclick="handleAuth('login')">Đăng nhập</button>
            <button class="btn btn-secondary" style="margin-top:0" onclick="handleAuth('register')">Đăng ký</button>
        </div>
    </div>
</div>

<div class="header">
    <h1>QUẢN LÝ TĂNG CA</h1>
    <i class="fas fa-sign-out-alt logout-btn" onclick="logout()"></i>
</div>

<div class="time-card">
    <div id="currentDate" style="color: #8E8E93; font-size: 14px;">--/--/----</div>
    <div class="clock" id="currentTime">00:00:00</div>
    <div id="workStatus" style="font-size: 14px; font-weight: 600; color: #8E8E93;">Đang tải...</div>
</div>

<div class="card">
    <div class="lunch-box">
        <div id="lunchLabelMain" style="font-weight: 700; color: var(--ios-orange); font-size: 14px;"><i class="fas fa-utensils"></i> Tăng ca trưa (+1h)</div>
        <label class="switch"><input type="checkbox" id="lunchCheckMain"><span class="slider"></span></label>
    </div>

    <div style="display:flex; gap:12px;">
        <button class="btn btn-start" id="startBtn">Vào ca</button>
        <button class="btn btn-end" id="endBtn">Tan ca</button>
    </div>
    
    <div style="display:grid; grid-template-columns: 1fr 1fr; gap:12px; margin-top: 15px;">
        <div style="background:#F2F2F7; padding:15px; border-radius:20px; text-align:center;">
            <p style="font-size:10px; color:#888;">OT THÁNG NÀY</p>
            <b id="monthlyOT" style="font-size:22px;">0h</b>
        </div>
        <div style="background:#F2F2F7; padding:15px; border-radius:20px; text-align:center;">
            <p style="font-size:10px; color:#888;">OT HÔM NAY</p>
            <b id="todayOTDisp" style="font-size:22px; color:var(--ios-red);">0h</b>
        </div>
    </div>

    <button class="btn btn-salary" onclick="openSalaryModal()"><i class="fas fa-wallet"></i> Tính lương theo tháng</button>
    <button class="btn btn-secondary" onclick="openCalendar()"><i class="fas fa-calendar-alt"></i> Lịch sử & Chỉnh sửa</button>
</div>

<div class="footer-info">
    <span id="displayUser">User: ...</span> | <span>Phiên bản: OT Pro V3.2</span>
</div>

<div class="modal" id="calendarModal">
    <div class="modal-content">
        <div class="cal-nav">
            <i class="fas fa-chevron-left" onclick="changeMonth(-1)" style="padding:10px;"></i>
            <h3 id="calMonthYear" style="font-weight:800;">Tháng --/----</h3>
            <i class="fas fa-chevron-right" onclick="changeMonth(1)" style="padding:10px;"></i>
        </div>
        <div class="cal-grid"><div class="cal-head">T2</div><div class="cal-head">T3</div><div class="cal-head">T4</div><div class="cal-head">T5</div><div class="cal-head">T6</div><div class="cal-head">T7</div><div class="cal-head" style="color:var(--ios-red)">CN</div></div>
        <div class="cal-grid" id="calendarDays" style="margin-top:10px;"></div>
        
        <div id="editPanel" style="display:none; border-top:1px solid #EEE; margin-top:20px; padding-top:15px;">
            <p id="editDateLabel" style="text-align:center; font-weight:800; color:var(--ios-blue); margin-bottom:10px;"></p>
            <div style="display:grid; grid-template-columns:1fr 1fr; gap:10px; margin-bottom:15px;">
                <input type="time" id="editIn" style="width:100%; padding:12px; border-radius:12px; border:1px solid #E5E5EA; background:#F2F2F7;"> 
                <input type="time" id="editOut" style="width:100%; padding:12px; border-radius:12px; border:1px solid #E5E5EA; background:#F2F2F7;">
            </div>
            <div class="lunch-box" style="border-style: solid;">
                <div id="lunchLabelEdit" style="font-size:14px; font-weight:700;">Tăng ca trưa (+1h)</div>
                <label class="switch"><input type="checkbox" id="lunchCheckEdit"><span class="slider"></span></label>
            </div>
            <div style="text-align:center; margin-bottom:5px;"><small style="color:#888; font-size:10px;">TỔNG GIỜ OT CỦA NGÀY</small></div>
            <input type="number" id="editOT" step="0.1" style="width:100%; padding:12px; border-radius:12px; border:1px solid #E5E5EA; background:#F2F2F7; color:var(--ios-red); font-size:24px; font-weight:800; text-align:center;">
            
            <button class="btn btn-start" style="width:100%; margin-top:15px;" id="saveBtn">Lưu thay đổi</button>
            <button class="btn btn-secondary" style="background:#FFE5E5; color:var(--ios-red);" id="deleteBtn">Xóa dữ liệu ngày</button>
        </div>
        <button class="btn btn-secondary" onclick="closeModal('calendarModal')" style="margin-top:10px;">Đóng</button>
    </div>
</div>

<div class="modal" id="salaryModal">
    <div class="modal-content">
        <div class="cal-nav">
            <i class="fas fa-chevron-left" onclick="changeSalaryMonth(-1)" style="padding:10px;"></i>
            <h3 id="salaryMonthYear" style="font-weight:800;">Tháng --/----</h3>
            <i class="fas fa-chevron-right" onclick="changeSalaryMonth(1)" style="padding:10px;"></i>
        </div>
        <label style="font-size:10px; font-weight:700; color:#888;">LƯƠNG CƠ BẢN</label>
        <input type="number" id="baseSalaryInput" oninput="updateSalaryDisplay()" style="width:100%; padding:12px; border-radius:12px; border:1px solid #E5E5EA; background:#F2F2F7; font-weight:800; text-align:center;">
        <div style="background:#F2F2F7; padding:20px; border-radius:24px; margin-top:20px; text-align:center;">
            <p style="color:#888; font-size:13px;">Tổng OT tháng này: <b id="salaryOTHours" style="color:var(--ios-blue);">0h</b></p>
            <p style="color:#888; font-size:13px; margin-bottom:10px;">Tiền OT (x2.0):</p>
            <b id="otMoneyDetail" style="font-size:32px; color:var(--ios-red);">0đ</b>
        </div>
        <button class="btn btn-salary" onclick="closeModal('salaryModal')" style="margin-top:20px;">Hoàn tất</button>
    </div>
</div>

<div id="toast" class="toast"></div>

<script>
    const SB_URL = 'https://dtdknettwfgilklaqeae.supabase.co', SB_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImR0ZGtuZXR0d2ZnaWxrbGFxZWFlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzQ2NzEzMTgsImV4cCI6MjA5MDI0NzMxOH0.qDvvZHNyNPh4QxpD6fDkR4Jr1xUnLSzCm79bsKI6ILk';
    const supabaseClient = supabase.createClient(SB_URL, SB_KEY);
    
    let currentUser = localStorage.getItem('ot_user') || null;
    let workData = [], currentViewDate = new Date(), salaryViewDate = new Date();

    if (currentUser) {
        document.getElementById('authScreen').style.display = 'none';
        document.getElementById('displayUser').innerText = "User: " + currentUser;
        loadData();
    }

    async function handleAuth(type) {
        const user = document.getElementById('username').value.trim();
        const pass = document.getElementById('password').value.trim();
        if (!user || !pass) return showToast("Vui lòng nhập đủ!");
        document.getElementById('loading').style.display = 'flex';
        if (type === 'register') {
            const { error } = await supabaseClient.from('users').insert({ username: user, password: pass });
            if (error) showToast("Tên này đã tồn tại!"); else showToast("Đăng ký thành công!");
        } else {
            const { data } = await supabaseClient.from('users').select('*').eq('username', user).eq('password', pass).single();
            if (data) {
                currentUser = user; localStorage.setItem('ot_user', user);
                document.getElementById('authScreen').style.display = 'none';
                document.getElementById('displayUser').innerText = "User: " + user;
                loadData();
            } else showToast("Sai tài khoản hoặc mật khẩu!");
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
        const { data } = await supabaseClient.from('work_logs').select('*').eq('username', currentUser).order('work_date', { ascending: false });
        workData = data || [];
        updateSummary();
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
        await supabaseClient.from('work_logs').upsert({ work_date: todayStr, username: currentUser, start_time: t });
        loadData(); showToast("Vào ca lúc " + t);
    };

    document.getElementById('endBtn').onclick = async () => {
        const t = new Date().toLocaleTimeString('vi-VN', {hour12:false}).slice(0,5);
        const todayStr = new Date().toLocaleDateString('en-CA');
        let rec = workData.find(r => r.work_date === todayStr);
        
        let startTime = rec?.start_time;
        // Nếu chưa ấn vào ca
        if (!startTime) {
            if (isSunday(todayStr)) return showToast("Chủ nhật: Vui lòng ấn 'Vào ca' trước!");
            startTime = "07:45"; // Tự động lấy giờ chuẩn ngày thường
        }

        const ot = calculateOT(startTime, t, document.getElementById('lunchCheckMain').checked, todayStr);
        await supabaseClient.from('work_logs').upsert({ 
            work_date: todayStr, 
            username: currentUser, 
            start_time: startTime,
            end_time: t, 
            overtime: ot 
        });
        
        loadData(); 
        showToast(`Tan ca lúc ${t}. (Vào: ${startTime})`);
    };

    function renderCalendar() {
        const grid = document.getElementById('calendarDays'); grid.innerHTML = '';
        const y = currentViewDate.getFullYear(), m = currentViewDate.getMonth();
        document.getElementById('calMonthYear').innerText = `Tháng ${m + 1}/${y}`;
        const firstDay = new Date(y, m, 1).getDay(), emptySlots = firstDay === 0 ? 6 : firstDay - 1, daysInMonth = new Date(y, m + 1, 0).getDate();
        for (let i = 0; i < emptySlots; i++) grid.appendChild(document.createElement('div'));
        for (let d = 1; d <= daysInMonth; d++) {
            const dStr = `${y}-${(m+1).toString().padStart(2,'0')}-${d.toString().padStart(2,'0')}`, rec = workData.find(r => r.work_date === dStr);
            const el = document.createElement('div');
            el.className = `cal-day ${rec ? 'has-data' : ''} ${dStr === new Date().toLocaleDateString('en-CA') ? 'today' : ''} ${isSunday(dStr) ? 'sunday' : ''}`;
            el.innerHTML = `<span>${d}</span>${rec ? `<small style="font-size:8px;position:absolute;bottom:2px;">+${rec.overtime}</small>` : ''}`;
            el.onclick = () => showEdit(dStr, rec);
            grid.appendChild(el);
        }
    }

    function showEdit(date, rec) {
        document.getElementById('editPanel').style.display = 'block';
        document.getElementById('editDateLabel').innerText = "Ngày: " + date;
        const inI = document.getElementById('editIn'), outI = document.getElementById('editOut'), lI = document.getElementById('lunchCheckEdit'), otI = document.getElementById('editOT');
        document.getElementById('lunchLabelEdit').innerText = isSunday(date) ? "Có nghỉ trưa 1h (Trừ OT)" : "Tăng ca trưa (+1h)";
        inI.value = rec?.start_time || "07:45"; outI.value = rec?.end_time || "17:00"; otI.value = rec?.overtime || 0; 
        const autoCalcEdit = () => { otI.value = calculateOT(inI.value, outI.value, lI.checked, date); };
        inI.oninput = autoCalcEdit; outI.oninput = autoCalcEdit; lI.onchange = autoCalcEdit;
        document.getElementById('saveBtn').onclick = async () => {
            await supabaseClient.from('work_logs').upsert({ work_date: date, username: currentUser, start_time: inI.value, end_time: outI.value, overtime: parseFloat(otI.value) });
            showToast("Đã lưu!"); loadData(); renderCalendar();
        };
        document.getElementById('deleteBtn').onclick = async () => {
            if(confirm("Xóa ngày " + date + "?")) { 
                await supabaseClient.from('work_logs').delete().eq('work_date', date).eq('username', currentUser); 
                loadData(); renderCalendar(); document.getElementById('editPanel').style.display = 'none'; 
            }
        };
    }

    function updateSalaryDisplay() {
        const y = salaryViewDate.getFullYear(), m = salaryViewDate.getMonth();
        const monthStr = `${y}-${(m+1).toString().padStart(2,'0')}`;
        document.getElementById('salaryMonthYear').innerText = `Tháng ${m + 1}/${y}`;
        const totalOT = workData.filter(r => r.work_date.startsWith(monthStr)).reduce((sum, r) => sum + (parseFloat(r.overtime) || 0), 0);
        const base = parseFloat(document.getElementById('baseSalaryInput').value) || parseFloat(localStorage.getItem('salary_' + currentUser)) || 0;
        localStorage.setItem('salary_' + currentUser, base);
        const money = ((base / 26) / 8) * 2 * totalOT; 
        document.getElementById('salaryOTHours').innerText = totalOT.toFixed(1) + 'h';
        document.getElementById('otMoneyDetail').innerText = new Intl.NumberFormat('vi-VN').format(Math.round(money)) + "đ";
    }

    function changeMonth(dir) { currentViewDate.setMonth(currentViewDate.getMonth() + dir); renderCalendar(); }
    function changeSalaryMonth(dir) { salaryViewDate.setMonth(salaryViewDate.getMonth() + dir); updateSalaryDisplay(); }
    function openCalendar() { renderCalendar(); document.getElementById('calendarModal').style.display = 'flex'; }
    function openSalaryModal() { 
        salaryViewDate = new Date(); 
        document.getElementById('baseSalaryInput').value = localStorage.getItem('salary_' + currentUser) || "";
        updateSalaryDisplay(); document.getElementById('salaryModal').style.display = 'flex'; 
    }
    function closeModal(id) { document.getElementById(id).style.display = 'none'; }
    function showToast(m) { const t = document.getElementById('toast'); t.innerText = m; t.classList.add('show'); setTimeout(() => t.classList.remove('show'), 3000); }

    setInterval(() => {
        document.getElementById('currentTime').innerText = new Date().toLocaleTimeString('vi-VN', {hour12:false});
        document.getElementById('currentDate').innerText = new Date().toLocaleDateString('vi-VN', {weekday:'long', day:'numeric', month:'numeric'});
    }, 1000);
</script>
</body>
</html>
