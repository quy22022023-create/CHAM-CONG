// Cấu hình ứng dụng
const APP_CONFIG = {
    STANDARD_HOURS: { start: '07:45', end: '17:00' },
    ADMIN_ACCOUNT: { username: 'admin001', password: 'Caijingui@1234' },
    LUNCH_OVERTIME_DEFAULT: true,
    AUTO_CHECKIN_DAYS: [1, 2, 3, 4, 5, 6], // T2-T7
    SUNDAY_LOGIC: 'subtract_1_hour+lunch_overtime',
    APP_NAME: 'Chấm Công Pro',
    VERSION: '1.0.0'
};

// Biến toàn cục
let currentUser = null;
let currentRecord = null;
let isAdmin = false;
let autoCheckinTimer = null;
let realTimeClockTimer = null;
let deviceId = generateDeviceId();

// Khởi tạo ứng dụng khi DOM sẵn sàng
document.addEventListener('DOMContentLoaded', () => {
    initializeApp();
    setupEventListeners();
    checkRememberedLogin();
});

function initializeApp() {
    // Tạo device ID nếu chưa có
    if (!localStorage.getItem('device_id')) {
        localStorage.setItem('device_id', deviceId);
    } else {
        deviceId = localStorage.getItem('device_id');
    }
    
    // Khởi tạo thời gian thực
    updateRealTimeClock();
    realTimeClockTimer = setInterval(updateRealTimeClock, 1000);
    
    // Khởi tạo ngày tháng
    updateTodayDate();
    initializeMonthYearSelectors();
    
    // Tải dữ liệu từ localStorage
    loadLocalData();
    
    // Ẩn màn hình loading
    setTimeout(() => {
        document.getElementById('loading').style.opacity = '0';
        setTimeout(() => {
            document.getElementById('loading').style.display = 'none';
        }, 300);
    }, 1000);
}

function setupEventListeners() {
    // Đăng nhập
    document.getElementById('login-btn').addEventListener('click', handleLogin);
    document.getElementById('show-password-btn').addEventListener('click', togglePasswordVisibility);
    document.getElementById('password').addEventListener('keypress', (e) => {
        if (e.key === 'Enter') handleLogin();
    });
    
    // Menu
    document.getElementById('menu-btn').addEventListener('click', toggleSideMenu);
    document.getElementById('menu-overlay').addEventListener('click', toggleSideMenu);
    document.querySelectorAll('.menu-item').forEach(item => {
        item.addEventListener('click', (e) => {
            e.preventDefault();
            const section = item.dataset.section;
            switchSection(section);
            toggleSideMenu();
        });
    });
    
    // Chấm công
    document.getElementById('checkin-btn').addEventListener('click', () => checkInOut('checkin'));
    document.getElementById('checkout-btn').addEventListener('click', () => checkInOut('checkout'));
    
    // Đặt giờ
    document.getElementById('set-start-time').addEventListener('click', () => openTimePicker('start'));
    document.getElementById('set-end-time').addEventListener('click', () => openTimePicker('end'));
    document.getElementById('save-time').addEventListener('click', saveTime);
    
    // Toggle
    document.getElementById('lunch-overtime-toggle').addEventListener('change', updateOvertime);
    document.getElementById('auto-checkin-toggle').addEventListener('change', toggleAutoCheckin);
    document.getElementById('auto-checkout-toggle').addEventListener('change', toggleAutoCheckout);
    
    // Calendar
    document.getElementById('prev-month').addEventListener('click', () => navigateMonth(-1));
    document.getElementById('next-month').addEventListener('click', () => navigateMonth(1));
    
    // Tính tăng ca
    document.getElementById('calculate-overtime').addEventListener('click', calculateOvertime);
    
    // Báo cáo
    document.getElementById('generate-report').addEventListener('click', generateReport);
    document.getElementById('export-csv').addEventListener('click', () => exportData('csv'));
    document.getElementById('export-pdf').addEventListener('click', () => exportData('pdf'));
    document.getElementById('export-excel').addEventListener('click', () => exportData('excel'));
    
    // Admin
    document.getElementById('add-user-btn').addEventListener('click', openAddUserModal);
    document.getElementById('save-new-user').addEventListener('click', saveNewUser);
    document.getElementById('refresh-users-btn').addEventListener('click', loadUsers);
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.addEventListener('click', () => switchAdminTab(tab.dataset.tab));
    });
    
    // Cài đặt
    document.getElementById('dark-mode-toggle').addEventListener('change', toggleDarkMode);
    document.getElementById('notifications-toggle').addEventListener('change', toggleNotifications);
    document.getElementById('auto-sync-toggle').addEventListener('change', toggleAutoSync);
    document.getElementById('clear-data').addEventListener('click', clearLocalData);
    document.getElementById('export-all-data').addEventListener('click', exportAllData);
    
    // Modal
    document.querySelectorAll('.modal-close, .modal-cancel').forEach(btn => {
        btn.addEventListener('click', closeAllModals);
    });
    document.getElementById('modal-overlay').addEventListener('click', closeAllModals);
    
    // Đồng bộ
    document.getElementById('sync-btn').addEventListener('click', manualSync);
    
    // Đăng xuất
    document.getElementById('logout-btn').addEventListener('click', handleLogout);
}

// ==================== XỬ LÝ ĐĂNG NHẬP ====================
function handleLogin() {
    const username = document.getElementById('username').value.trim();
    const password = document.getElementById('password').value;
    const remember = document.getElementById('remember-me').checked;
    
    if (!username || !password) {
        showNotification('Vui lòng nhập tên đăng nhập và mật khẩu', 'warning');
        return;
    }
    
    // Kiểm tra tài khoản admin
    if (username === APP_CONFIG.ADMIN_ACCOUNT.username && 
        password === APP_CONFIG.ADMIN_ACCOUNT.password) {
        currentUser = { username, role: 'admin' };
        isAdmin = true;
        loginSuccess();
        return;
    }
    
    // Kiểm tra tài khoản user từ localStorage
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const user = users.find(u => u.username === username && u.password === password);
    
    if (user) {
        currentUser = user;
        isAdmin = user.role === 'admin';
        loginSuccess();
    } else {
        showNotification('Tên đăng nhập hoặc mật khẩu không đúng', 'error');
    }
    
    function loginSuccess() {
        if (remember) {
            localStorage.setItem('remembered_user', JSON.stringify({
                username: currentUser.username,
                password: currentUser.password
            }));
        } else {
            localStorage.removeItem('remembered_user');
        }
        
        localStorage.setItem('current_user', JSON.stringify(currentUser));
        
        showNotification(`Đăng nhập thành công! Chào mừng ${currentUser.username}`, 'success');
        
        // Cập nhật UI
        document.getElementById('current-user').textContent = currentUser.username;
        document.getElementById('user-role').textContent = currentUser.role;
        document.getElementById('menu-username').textContent = currentUser.username;
        document.getElementById('menu-userrole').textContent = currentUser.role === 'admin' ? 'Quản trị viên' : 'Người dùng';
        
        // Ẩn/menu admin
        if (isAdmin) {
            document.getElementById('admin-menu-item').style.display = 'flex';
        } else {
            document.getElementById('admin-menu-item').style.display = 'none';
        }
        
        // Chuyển màn hình
        document.getElementById('login-screen').classList.remove('active');
        document.getElementById('app-screen').classList.add('active');
        
        // Tải dữ liệu người dùng
        loadUserData();
        
        // Bắt đầu kiểm tra tự động chấm công
        startAutoCheckinCheck();
    }
}

function checkRememberedLogin() {
    const remembered = localStorage.getItem('remembered_user');
    if (remembered) {
        try {
            const user = JSON.parse(remembered);
            document.getElementById('username').value = user.username;
            document.getElementById('password').value = user.password;
            document.getElementById('remember-me').checked = true;
        } catch (e) {
            console.error('Lỗi khi đọc thông tin đăng nhập đã lưu:', e);
        }
    }
}

// ==================== QUẢN LÝ THỜI GIAN ====================
function updateRealTimeClock() {
    const now = new Date();
    const timeString = now.toLocaleTimeString('vi-VN', { hour12: false });
    document.getElementById('real-time-clock').textContent = timeString;
    
    // Kiểm tra tự động chấm công
    if (currentUser) {
        checkAutoCheckin(now);
    }
}

function updateTodayDate() {
    const now = new Date();
    const dateString = now.toLocaleDateString('vi-VN');
    document.getElementById('today-date').textContent = dateString;
}

// ==================== XỬ LÝ CHẤM CÔNG ====================
function checkInOut(type) {
    if (!currentUser) return;
    
    const now = new Date();
    const timeString = now.toTimeString().split(' ')[0].substring(0, 5);
    const dateString = formatDate(now);
    
    if (!currentRecord) {
        currentRecord = {
            userId: currentUser.id || currentUser.username,
            date: dateString,
            startTime: timeString,
            endTime: null,
            totalHours: 0,
            overtime: 0,
            lunchOvertime: document.getElementById('lunch-overtime-toggle').checked,
            isAutoStarted: false,
            isAutoEnded: false,
            deviceId: deviceId
        };
        
        updateDisplay('start-time-display', timeString);
        updateDisplay('checkin-time', timeString);
        showNotification(`Đã chấm vào lúc ${timeString}`, 'success');
        
        // Lưu vào localStorage
        saveRecord();
        
    } else if (currentRecord && !currentRecord.endTime && type === 'checkout') {
        currentRecord.endTime = timeString;
        currentRecord.totalHours = calculateTotalHours(currentRecord.startTime, timeString);
        currentRecord.overtime = calculateOvertimeHours(currentRecord);
        
        updateDisplay('end-time-display', timeString);
        updateDisplay('checkout-time', timeString);
        updateDisplay('total-hours', `${currentRecord.totalHours.toFixed(2)} giờ`);
        updateDisplay('summary-total-hours', `${currentRecord.totalHours.toFixed(2)} giờ`);
        updateDisplay('summary-overtime', `${currentRecord.overtime.toFixed(2)} giờ`);
        
        showNotification(`Đã chấm ra lúc ${timeString}`, 'success');
        
        // Lưu vào localStorage
        saveRecord();
        
        // Đồng bộ lên cloud
        syncToCloud();
    }
}

function calculateTotalHours(startTime, endTime) {
    const [startHour, startMinute] = startTime.split(':').map(Number);
    const [endHour, endMinute] = endTime.split(':').map(Number);
    
    const startDecimal = startHour + startMinute / 60;
    const endDecimal = endHour + endMinute / 60;
    
    let total = endDecimal - startDecimal;
    if (total < 0) total += 24; // Qua ngày
    
    return total;
}

function calculateOvertimeHours(record) {
    const [standardStartHour, standardStartMinute] = APP_CONFIG.STANDARD_HOURS.start.split(':').map(Number);
    const [standardEndHour, standardEndMinute] = APP_CONFIG.STANDARD_HOURS.end.split(':').map(Number);
    
    const standardStart = standardStartHour + standardStartMinute / 60;
    const standardEnd = standardEndHour + standardEndMinute / 60;
    const [startHour, startMinute] = record.startTime.split(':').map(Number);
    const [endHour, endMinute] = record.endTime.split(':').map(Number);
    
    const start = startHour + startMinute / 60;
    const end = endHour + endMinute / 60;
    
    let overtime = 0;
    
    // Tính giờ trước giờ làm chuẩn
    if (start < standardStart) {
        overtime += standardStart - start;
    }
    
    // Tính giờ sau giờ làm chuẩn
    if (end > standardEnd) {
        overtime += end - standardEnd;
    }
    
    // Tính tăng ca trưa
    if (record.lunchOvertime) {
        overtime += 1;
    }
    
    // Xử lý logic chủ nhật
    const date = new Date(record.date.split('/').reverse().join('-'));
    if (date.getDay() === 0) { // Chủ nhật
        if (APP_CONFIG.SUNDAY_LOGIC === 'subtract_1_hour+lunch_overtime') {
            // Đã tính lunch overtime ở trên, chỉ cần trừ 1 giờ
            overtime -= 1;
        }
    }
    
    return Math.max(overtime, 0);
}

// ==================== TỰ ĐỘNG CHẤM CÔNG ====================
function startAutoCheckinCheck() {
    // Kiểm tra mỗi phút
    autoCheckinTimer = setInterval(() => {
        checkAutoCheckin(new Date());
    }, 60000);
    
    // Kiểm tra ngay lập tức
    checkAutoCheckin(new Date());
}

function checkAutoCheckin(now) {
    if (!currentUser) return;
    
    const dayOfWeek = now.getDay(); // 0 = CN, 1 = T2, ..., 6 = T7
    const timeString = now.toTimeString().split(' ')[0].substring(0, 5);
    
    // Kiểm tra tự động chấm vào
    if (APP_CONFIG.AUTO_CHECKIN_DAYS.includes(dayOfWeek) && 
        document.getElementById('auto-checkin-toggle')?.checked &&
        timeString === APP_CONFIG.STANDARD_HOURS.start &&
        (!currentRecord || !currentRecord.startTime)) {
        checkInOut('checkin');
        if (currentRecord) {
            currentRecord.isAutoStarted = true;
        }
    }
    
    // Kiểm tra tự động chấm ra
    if (APP_CONFIG.AUTO_CHECKIN_DAYS.includes(dayOfWeek) && 
        document.getElementById('auto-checkout-toggle')?.checked &&
        timeString === APP_CONFIG.STANDARD_HOURS.end &&
        currentRecord && currentRecord.startTime && !currentRecord.endTime) {
        checkInOut('checkout');
        if (currentRecord) {
            currentRecord.isAutoEnded = true;
        }
    }
}

// ==================== QUẢN LÝ DỮ LIỆU ====================
function saveRecord() {
    if (!currentRecord || !currentUser) return;
    
    // Lưu vào localStorage
    const records = JSON.parse(localStorage.getItem('work_records') || '[]');
    const existingIndex = records.findIndex(r => 
        r.userId === currentRecord.userId && r.date === currentRecord.date);
    
    if (existingIndex >= 0) {
        records[existingIndex] = currentRecord;
    } else {
        records.push(currentRecord);
    }
    
    localStorage.setItem('work_records', JSON.stringify(records));
    
    // Thêm vào hàng đợi đồng bộ
    addToSyncQueue(currentRecord);
    
    // Cập nhật UI
    updateDashboard();
}

function loadUserData() {
    if (!currentUser) return;
    
    const today = formatDate(new Date());
    const records = JSON.parse(localStorage.getItem('work_records') || '[]');
    const todayRecord = records.find(r => 
        r.userId === (currentUser.id || currentUser.username) && r.date === today);
    
    if (todayRecord) {
        currentRecord = todayRecord;
        
        updateDisplay('start-time-display', todayRecord.startTime || '--:--');
        updateDisplay('end-time-display', todayRecord.endTime || '--:--');
        updateDisplay('checkin-time', todayRecord.startTime || '--:--');
        updateDisplay('checkout-time', todayRecord.endTime || '--:--');
        
        if (todayRecord.totalHours > 0) {
            updateDisplay('total-hours', `${todayRecord.totalHours.toFixed(2)} giờ`);
            updateDisplay('summary-total-hours', `${todayRecord.totalHours.toFixed(2)} giờ`);
            updateDisplay('summary-overtime', `${todayRecord.overtime.toFixed(2)} giờ`);
        }
        
        if (todayRecord.lunchOvertime !== undefined) {
            document.getElementById('lunch-overtime-toggle').checked = todayRecord.lunchOvertime;
        }
        
        updateDisplay('auto-status', 
            todayRecord.isAutoStarted || todayRecord.isAutoEnded ? 'Đã kích hoạt' : 'Không kích hoạt');
    }
    
    // Tạo lịch
    generateCalendar(new Date().getFullYear(), new Date().getMonth());
}

// ==================== GIAO DIỆN ====================
function switchSection(sectionId) {
    // Ẩn tất cả sections
    document.querySelectorAll('.section').forEach(section => {
        section.classList.remove('active');
    });
    
    // Ẩn tất cả menu items
    document.querySelectorAll('.menu-item').forEach(item => {
        item.classList.remove('active');
    });
    
    // Hiển thị section được chọn
    const targetSection = document.getElementById(`${sectionId}-section`);
    if (targetSection) {
        targetSection.classList.add('active');
        
        // Kích hoạt menu item tương ứng
        const menuItem = document.querySelector(`.menu-item[data-section="${sectionId}"]`);
        if (menuItem) {
            menuItem.classList.add('active');
        }
    }
}

function toggleSideMenu() {
    const menu = document.getElementById('side-menu');
    const overlay = document.getElementById('menu-overlay');
    
    menu.classList.toggle('active');
    overlay.classList.toggle('active');
}

function updateDisplay(elementId, value) {
    const element = document.getElementById(elementId);
    if (element) {
        element.textContent = value;
    }
}

// ==================== THÔNG BÁO ====================
function showNotification(message, type = 'info') {
    const notification = document.getElementById('notification');
    const icon = notification.querySelector('.notification-icon');
    const messageEl = notification.querySelector('.notification-message');
    
    // Đặt màu dựa trên loại thông báo
    switch(type) {
        case 'success':
            notification.style.backgroundColor = 'var(--success-color)';
            icon.className = 'fas fa-check-circle notification-icon';
            break;
        case 'warning':
            notification.style.backgroundColor = 'var(--warning-color)';
            icon.className = 'fas fa-exclamation-triangle notification-icon';
            break;
        case 'error':
            notification.style.backgroundColor = 'var(--danger-color)';
            icon.className = 'fas fa-times-circle notification-icon';
            break;
        default:
            notification.style.backgroundColor = 'var(--primary-color)';
            icon.className = 'fas fa-info-circle notification-icon';
    }
    
    messageEl.textContent = message;
    notification.classList.add('active');
    
    // Tự động ẩn sau 3 giây
    setTimeout(() => {
        notification.classList.remove('active');
    }, 3000);
}

// ==================== TIỆN ÍCH ====================
function formatDate(date) {
    const d = new Date(date);
    const day = d.getDate().toString().padStart(2, '0');
    const month = (d.getMonth() + 1).toString().padStart(2, '0');
    const year = d.getFullYear();
    return `${day}/${month}/${year}`;
}

function generateDeviceId() {
    return 'device_' + Math.random().toString(36).substr(2, 9) + 
           '_' + Date.now().toString(36);
}

function togglePasswordVisibility() {
    const passwordInput = document.getElementById('password');
    const button = document.getElementById('show-password-btn');
    const icon = button.querySelector('i');
    
    if (passwordInput.type === 'password') {
        passwordInput.type = 'text';
        icon.className = 'fas fa-eye-slash';
    } else {
        passwordInput.type = 'password';
        icon.className = 'fas fa-eye';
    }
}

// ==================== XỬ LÝ MODAL ====================
function openTimePicker(type) {
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('time-picker-modal').classList.add('active');
    
    // Lưu loại time picker (start/end)
    document.getElementById('time-picker-modal').dataset.pickerType = type;
    
    // Đặt giờ hiện tại
    const now = new Date();
    document.getElementById('selected-hour').textContent = 
        now.getHours().toString().padStart(2, '0');
    document.getElementById('selected-minute').textContent = 
        now.getMinutes().toString().padStart(2, '0');
    
    // Thêm event listeners cho các nút điều khiển
    document.querySelectorAll('.time-btn').forEach(btn => {
        btn.addEventListener('click', function() {
            const type = this.dataset.type;
            const action = this.dataset.action;
            const element = document.getElementById(`selected-${type}`);
            let value = parseInt(element.textContent);
            
            if (action === 'up') {
                value = (value + 1) % (type === 'hour' ? 24 : 60);
            } else {
                value = (value - 1 + (type === 'hour' ? 24 : 60)) % (type === 'hour' ? 24 : 60);
            }
            
            element.textContent = value.toString().padStart(2, '0');
        });
    });
    
    // Thêm event listeners cho preset
    document.querySelectorAll('.time-preset').forEach(preset => {
        preset.addEventListener('click', function() {
            const [hours, minutes] = this.dataset.time.split(':');
            document.getElementById('selected-hour').textContent = hours;
            document.getElementById('selected-minute').textContent = minutes;
        });
    });
}

function saveTime() {
    const type = document.getElementById('time-picker-modal').dataset.pickerType;
    const hours = document.getElementById('selected-hour').textContent;
    const minutes = document.getElementById('selected-minute').textContent;
    const timeString = `${hours}:${minutes}`;
    
    if (!currentRecord) {
        currentRecord = {
            userId: currentUser.id || currentUser.username,
            date: formatDate(new Date()),
            startTime: null,
            endTime: null,
            totalHours: 0,
            overtime: 0,
            lunchOvertime: document.getElementById('lunch-overtime-toggle').checked,
            isAutoStarted: false,
            isAutoEnded: false,
            deviceId: deviceId
        };
    }
    
    if (type === 'start') {
        currentRecord.startTime = timeString;
        updateDisplay('start-time-display', timeString);
        updateDisplay('checkin-time', timeString);
    } else if (type === 'end') {
        currentRecord.endTime = timeString;
        currentRecord.totalHours = calculateTotalHours(currentRecord.startTime, timeString);
        currentRecord.overtime = calculateOvertimeHours(currentRecord);
        
        updateDisplay('end-time-display', timeString);
        updateDisplay('checkout-time', timeString);
        updateDisplay('total-hours', `${currentRecord.totalHours.toFixed(2)} giờ`);
        updateDisplay('summary-total-hours', `${currentRecord.totalHours.toFixed(2)} giờ`);
        updateDisplay('summary-overtime', `${currentRecord.overtime.toFixed(2)} giờ`);
    }
    
    saveRecord();
    closeAllModals();
    showNotification(`Đã đặt giờ ${type === 'start' ? 'vào' : 'ra'} thành công: ${timeString}`, 'success');
}

function closeAllModals() {
    document.querySelectorAll('.modal').forEach(modal => {
        modal.classList.remove('active');
    });
    document.getElementById('modal-overlay').classList.remove('active');
}

// ==================== QUẢN LÝ NGƯỜI DÙNG (ADMIN) ====================
function openAddUserModal() {
    document.getElementById('modal-overlay').classList.add('active');
    document.getElementById('add-user-modal').classList.add('active');
}

function saveNewUser() {
    const username = document.getElementById('new-username').value.trim();
    const password = document.getElementById('new-password').value;
    const confirmPassword = document.getElementById('new-password-confirm').value;
    const role = document.getElementById('new-user-role').value;
    
    // Validation
    if (!username || !password) {
        showNotification('Vui lòng nhập đầy đủ thông tin', 'warning');
        return;
    }
    
    if (password !== confirmPassword) {
        showNotification('Mật khẩu xác nhận không khớp', 'error');
        return;
    }
    
    if (password.length < 6) {
        showNotification('Mật khẩu phải có ít nhất 6 ký tự', 'warning');
        return;
    }
    
    // Lưu người dùng
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    
    // Kiểm tra trùng tên đăng nhập
    if (users.some(u => u.username === username)) {
        showNotification('Tên đăng nhập đã tồn tại', 'error');
        return;
    }
    
    const newUser = {
        id: 'user_' + Date.now(),
        username,
        password,
        role,
        created_at: new Date().toISOString(),
        device_ids: []
    };
    
    users.push(newUser);
    localStorage.setItem('users', JSON.stringify(users));
    
    // Reset form
    document.getElementById('new-username').value = '';
    document.getElementById('new-password').value = '';
    document.getElementById('new-password-confirm').value = '';
    document.getElementById('new-user-role').value = 'user';
    
    closeAllModals();
    showNotification('Đã thêm người dùng mới thành công', 'success');
    loadUsers();
}

function loadUsers() {
    if (!isAdmin) return;
    
    const users = JSON.parse(localStorage.getItem('users') || '[]');
    const tbody = document.getElementById('users-table-body');
    
    tbody.innerHTML = '';
    
    users.forEach(user => {
        const row = document.createElement('tr');
        row.innerHTML = `
            <td>${user.id.substring(0, 8)}...</td>
            <td>${user.username}</td>
            <td><span class="user-badge">${user.role}</span></td>
            <td>${new Date(user.created_at).toLocaleDateString('vi-VN')}</td>
            <td>${user.device_ids ? user.device_ids.length : 0}</td>
            <td>
                <button class="btn btn-sm btn-secondary" onclick="editUser('${user.id}')">
                    <i class="fas fa-edit"></i>
                </button>
                <button class="btn btn-sm btn-danger" onclick="deleteUser('${user.id}')">
                    <i class="fas fa-trash"></i>
                </button>
            </td>
        `;
        tbody.appendChild(row);
    });
}

function switchAdminTab(tabId) {
    // Ẩn tất cả tabs
    document.querySelectorAll('.admin-tab').forEach(tab => {
        tab.classList.remove('active');
    });
    document.querySelectorAll('.admin-tab-content').forEach(content => {
        content.classList.remove('active');
    });
    
    // Hiển thị tab được chọn
    const tab = document.querySelector(`.admin-tab[data-tab="${tabId}"]`);
    const content = document.getElementById(`${tabId}-tab`);
    
    if (tab && content) {
        tab.classList.add('active');
        content.classList.add('active');
    }
}

// ==================== CALENDAR ====================
function generateCalendar(year, month) {
    const calendarGrid = document.getElementById('calendar-grid');
    const currentMonth = document.getElementById('current-month');
    
    // Đặt tên tháng
    const monthNames = [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ];
    currentMonth.textContent = `${monthNames[month]}, ${year}`;
    
    // Ngày đầu tiên của tháng
    const firstDay = new Date(year, month, 1);
    // Ngày cuối cùng của tháng
    const lastDay = new Date(year, month + 1, 0);
    // Ngày trong tuần của ngày đầu tiên (0 = CN, 1 = T2, ...)
    const startDay = firstDay.getDay();
    // Tổng số ngày trong tháng
    const daysInMonth = lastDay.getDate();
    
    calendarGrid.innerHTML = '';
    
    // Ô trống trước ngày đầu tiên
    for (let i = 0; i < (startDay === 0 ? 6 : startDay - 1); i++) {
        const emptyDay = document.createElement('div');
        emptyDay.className = 'calendar-day empty';
        calendarGrid.appendChild(emptyDay);
    }
    
    // Các ngày trong tháng
    for (let day = 1; day <= daysInMonth; day++) {
        const dayElement = document.createElement('div');
        const currentDate = new Date(year, month, day);
        const dayOfWeek = currentDate.getDay();
        
        dayElement.className = 'calendar-day';
        dayElement.innerHTML = `
            <div class="day-number">${day}</div>
            <div class="day-hours">0h</div>
        `;
        
        // Đánh dấu chủ nhật
        if (dayOfWeek === 0) {
            dayElement.classList.add('sunday');
        }
        
        // Kiểm tra xem có dữ liệu chấm công không
        const dateString = formatDate(currentDate);
        const records = JSON.parse(localStorage.getItem('work_records') || '[]');
        const userRecords = records.filter(r => 
            r.userId === (currentUser?.id || currentUser?.username) && r.date === dateString);
        
        if (userRecords.length > 0) {
            dayElement.classList.add('checked-in');
            const totalHours = userRecords.reduce((sum, r) => sum + (r.totalHours || 0), 0);
            dayElement.querySelector('.day-hours').textContent = `${totalHours.toFixed(1)}h`;
            
            // Kiểm tra có tăng ca không
            const hasOvertime = userRecords.some(r => r.overtime > 0);
            if (hasOvertime) {
                dayElement.classList.add('overtime');
            }
        }
        
        calendarGrid.appendChild(dayElement);
    }
}

function navigateMonth(direction) {
    const currentMonthText = document.getElementById('current-month').textContent;
    const [monthStr, yearStr] = currentMonthText.split(', ');
    const monthIndex = [
        'Tháng 1', 'Tháng 2', 'Tháng 3', 'Tháng 4', 'Tháng 5', 'Tháng 6',
        'Tháng 7', 'Tháng 8', 'Tháng 9', 'Tháng 10', 'Tháng 11', 'Tháng 12'
    ].indexOf(monthStr);
    const year = parseInt(yearStr);
    
    let newMonth = monthIndex + direction;
    let newYear = year;
    
    if (newMonth < 0) {
        newMonth = 11;
        newYear--;
    } else if (newMonth > 11) {
        newMonth = 0;
        newYear++;
    }
    
    generateCalendar(newYear, newMonth);
}

// ==================== XUẤT DỮ LIỆU ====================
function exportData(format) {
    const records = JSON.parse(localStorage.getItem('work_records') || '[]');
    const userRecords = records.filter(r => 
        r.userId === (currentUser?.id || currentUser?.username));
    
    if (userRecords.length === 0) {
        showNotification('Không có dữ liệu để xuất', 'warning');
        return;
    }
    
    let content, filename, mimeType;
    
    switch(format) {
        case 'csv':
            content = convertToCSV(userRecords);
            filename = `cham-cong-${formatDate(new Date())}.csv`;
            mimeType = 'text/csv';
            break;
        case 'excel':
            content = convertToExcel(userRecords);
            filename = `cham-cong-${formatDate(new Date())}.xlsx`;
            mimeType = 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';
            break;
        case 'pdf':
            // Trong thực tế cần dùng thư viện như jsPDF
            showNotification('Tính năng xuất PDF đang phát triển', 'info');
            return;
    }
    
    downloadFile(content, filename, mimeType);
    showNotification(`Đã xuất dữ liệu ${format.toUpperCase()} thành công`, 'success');
}

function convertToCSV(records) {
    const headers = ['Ngày', 'Giờ vào', 'Giờ ra', 'Tổng giờ', 'Tăng ca', 'Tăng ca trưa', 'Tự động'];
    const rows = records.map(record => [
        record.date,
        record.startTime || '',
        record.endTime || '',
        record.totalHours?.toFixed(2) || '0',
        record.overtime?.toFixed(2) || '0',
        record.lunchOvertime ? 'Có' : 'Không',
        record.isAutoStarted || record.isAutoEnded ? 'Có' : 'Không'
    ]);
    
    return [headers, ...rows].map(row => 
        row.map(cell => `"${cell}"`).join(',')
    ).join('\n');
}

function downloadFile(content, filename, mimeType) {
    const blob = new Blob([content], { type: mimeType });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
}

// ==================== CÀI ĐẶT ====================
function toggleDarkMode() {
    const isDark = document.getElementById('dark-mode-toggle').checked;
    if (isDark) {
        document.body.classList.add('dark-mode');
        localStorage.setItem('dark_mode', 'true');
    } else {
        document.body.classList.remove('dark-mode');
        localStorage.setItem('dark_mode', 'false');
    }
}

function loadLocalData() {
    // Tải chế độ tối
    const darkMode = localStorage.getItem('dark_mode') === 'true';
    document.getElementById('dark-mode-toggle').checked = darkMode;
    if (darkMode) {
        document.body.classList.add('dark-mode');
    }
    
    // Tải người dùng hiện tại
    const savedUser = localStorage.getItem('current_user');
    if (savedUser) {
        try {
            currentUser = JSON.parse(savedUser);
            isAdmin = currentUser.role === 'admin';
        } catch (e) {
            console.error('Lỗi khi đọc thông tin người dùng:', e);
        }
    }
}

function clearLocalData() {
    if (confirm('Bạn có chắc chắn muốn xóa tất cả dữ liệu cục bộ? Hành động này không thể hoàn tác.')) {
        localStorage.clear();
        sessionStorage.clear();
        
        // Giữ lại device_id và cài đặt dark mode
        localStorage.setItem('device_id', deviceId);
        localStorage.setItem('dark_mode', document.getElementById('dark-mode-toggle').checked.toString());
        
        showNotification('Đã xóa tất cả dữ liệu cục bộ', 'success');
        setTimeout(() => {
            location.reload();
        }, 1500);
    }
}

// ==================== ĐỒNG BỘ ====================
function addToSyncQueue(record) {
    const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
    queue.push({
        id: 'sync_' + Date.now(),
        userId: record.userId,
        recordData: record,
        deviceId: deviceId,
        syncStatus: 'pending',
        created_at: new Date().toISOString()
    });
    localStorage.setItem('sync_queue', JSON.stringify(queue));
}

function manualSync() {
    const syncBtn = document.getElementById('sync-btn');
    syncBtn.classList.add('active');
    
    // Giả lập đồng bộ
    setTimeout(() => {
        syncBtn.classList.remove('active');
        showNotification('Đã đồng bộ dữ liệu thành công', 'success');
    }, 2000);
}

// ==================== ĐĂNG XUẤT ====================
function handleLogout() {
    currentUser = null;
    currentRecord = null;
    isAdmin = false;
    
    // Dừng các timer
    if (autoCheckinTimer) {
        clearInterval(autoCheckinTimer);
        autoCheckinTimer = null;
    }
    
    // Xóa thông tin đăng nhập hiện tại
    localStorage.removeItem('current_user');
    
    // Reset form
    document.getElementById('username').value = '';
    document.getElementById('password').value = '';
    
    // Chuyển về màn hình đăng nhập
    document.getElementById('app-screen').classList.remove('active');
    document.getElementById('login-screen').classList.add('active');
    
    showNotification('Đã đăng xuất thành công', 'info');
}

// ==================== PWA SUPPORT ====================
// Đăng ký Service Worker
if ('serviceWorker' in navigator) {
    window.addEventListener('load', () => {
        navigator.serviceWorker.register('service-worker.js')
            .then(registration => {
                console.log('ServiceWorker registered:', registration);
            })
            .catch(error => {
                console.log('ServiceWorker registration failed:', error);
            });
    });
}

// Yêu cầu quyền thông báo
if ('Notification' in window && Notification.permission === 'default') {
    Notification.requestPermission();
}

// ==================== CÁC HÀM CHƯA TRIỂN KHAI ĐẦY ĐỦ ====================
function updateDashboard() {
    // Cập nhật dashboard với dữ liệu mới nhất
    // Triển khai khi cần
}

function updateOvertime() {
    // Cập nhật tính toán tăng ca khi toggle thay đổi
    if (currentRecord && currentRecord.endTime) {
        currentRecord.lunchOvertime = document.getElementById('lunch-overtime-toggle').checked;
        currentRecord.overtime = calculateOvertimeHours(currentRecord);
        saveRecord();
    }
}

function toggleAutoCheckin() {
    const isEnabled = document.getElementById('auto-checkin-toggle').checked;
    localStorage.setItem('auto_checkin_enabled', isEnabled.toString());
    showNotification(`Tự động chấm vào ${isEnabled ? 'đã bật' : 'đã tắt'}`, 'info');
}

function toggleAutoCheckout() {
    const isEnabled = document.getElementById('auto-checkout-toggle').checked;
    localStorage.setItem('auto_checkout_enabled', isEnabled.toString());
    showNotification(`Tự động chấm ra ${isEnabled ? 'đã bật' : 'đã tắt'}`, 'info');
}

function calculateOvertime() {
    // Tính toán tăng ca từ form calculator
    // Triển khai khi cần
}

function generateReport() {
    // Tạo báo cáo tháng
    // Triển khai khi cần
}

function exportAllData() {
    // Xuất toàn bộ dữ liệu
    // Triển khai khi cần
}

function toggleNotifications() {
    // Bật/tắt thông báo
    // Triển khai khi cần
}

function toggleAutoSync() {
    // Bật/tắt đồng bộ tự động
    // Triển khai khi cần
}

function initializeMonthYearSelectors() {
    // Khởi tạo dropdown tháng/năm cho báo cáo
    // Triển khai khi cần
}