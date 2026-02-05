// Supabase Client Configuration
const SUPABASE_CONFIG = {
    url: "https://bajdfvvcjehbwtljdrfe.supabase.co",
    key: "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImJhamRmdnZjamVoYnd0bGpkcmZlIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzAyNjA4MDMsImV4cCI6MjA4NTgzNjgwM30.7uvuyByOgOwkEqSGyV2ovEGkkFntsYefkpNIX9i6l70"
};

// Initialize Supabase client
const { createClient } = window.supabase;
const supabase = createClient(SUPABASE_CONFIG.url, SUPABASE_CONFIG.key);

// Sync functions
class SupabaseSync {
    constructor() {
        this.isOnline = navigator.onLine;
        this.setupNetworkListener();
    }

    setupNetworkListener() {
        window.addEventListener('online', () => {
            this.isOnline = true;
            this.syncPendingRecords();
        });

        window.addEventListener('offline', () => {
            this.isOnline = false;
        });
    }

    async syncPendingRecords() {
        if (!this.isOnline) return;

        const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        const pendingRecords = queue.filter(record => record.syncStatus === 'pending');

        for (const record of pendingRecords) {
            await this.syncRecord(record);
        }
    }

    async syncRecord(record) {
        try {
            // Kiểm tra xem bản ghi đã tồn tại chưa
            const { data: existing } = await supabase
                .from('work_records')
                .select('id')
                .eq('user_id', record.userId)
                .eq('date', record.recordData.date)
                .single();

            if (existing) {
                // Cập nhật bản ghi đã tồn tại
                await supabase
                    .from('work_records')
                    .update({
                        start_time: record.recordData.startTime,
                        end_time: record.recordData.endTime,
                        total_hours: record.recordData.totalHours,
                        overtime: record.recordData.overtime,
                        lunch_overtime: record.recordData.lunchOvertime,
                        is_auto_started: record.recordData.isAutoStarted,
                        is_auto_ended: record.recordData.isAutoEnded,
                        device_id: record.recordData.deviceId,
                        updated_at: new Date().toISOString()
                    })
                    .eq('id', existing.id);
            } else {
                // Thêm bản ghi mới
                await supabase
                    .from('work_records')
                    .insert({
                        user_id: record.userId,
                        date: record.recordData.date,
                        start_time: record.recordData.startTime,
                        end_time: record.recordData.endTime,
                        total_hours: record.recordData.totalHours,
                        overtime: record.recordData.overtime,
                        lunch_overtime: record.recordData.lunchOvertime,
                        is_auto_started: record.recordData.isAutoStarted,
                        is_auto_ended: record.recordData.isAutoEnded,
                        device_id: record.recordData.deviceId,
                        created_at: new Date().toISOString(),
                        updated_at: new Date().toISOString()
                    });
            }

            // Cập nhật trạng thái sync
            this.updateSyncStatus(record.id, 'completed');

        } catch (error) {
            console.error('Sync error:', error);
            this.updateSyncStatus(record.id, 'failed');
        }
    }

    updateSyncStatus(recordId, status) {
        const queue = JSON.parse(localStorage.getItem('sync_queue') || '[]');
        const recordIndex = queue.findIndex(r => r.id === recordId);
        
        if (recordIndex !== -1) {
            queue[recordIndex].syncStatus = status;
            queue[recordIndex].sync_at = new Date().toISOString();
            localStorage.setItem('sync_queue', JSON.stringify(queue));
        }
    }

    async getUsers() {
        try {
            const { data, error } = await supabase
                .from('users')
                .select('*')
                .order('created_at', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching users:', error);
            return [];
        }
    }

    async getUserRecords(userId, startDate, endDate) {
        try {
            let query = supabase
                .from('work_records')
                .select('*')
                .eq('user_id', userId);

            if (startDate) {
                query = query.gte('date', startDate);
            }

            if (endDate) {
                query = query.lte('date', endDate);
            }

            const { data, error } = await query.order('date', { ascending: false });

            if (error) throw error;
            return data || [];
        } catch (error) {
            console.error('Error fetching records:', error);
            return [];
        }
    }

    async createUser(userData) {
        try {
            const { data, error } = await supabase
                .from('users')
                .insert([{
                    username: userData.username,
                    password: userData.password, // Trong thực tế cần mã hóa
                    role: userData.role || 'user',
                    created_at: new Date().toISOString(),
                    device_ids: []
                }])
                .select()
                .single();

            if (error) throw error;
            return data;
        } catch (error) {
            console.error('Error creating user:', error);
            throw error;
        }
    }

    async updateDeviceIds(userId, deviceId) {
        try {
            // Lấy device_ids hiện tại
            const { data: user } = await supabase
                .from('users')
                .select('device_ids')
                .eq('id', userId)
                .single();

            if (user) {
                const deviceIds = user.device_ids || [];
                if (!deviceIds.includes(deviceId)) {
                    deviceIds.push(deviceId);
                    
                    await supabase
                        .from('users')
                        .update({ device_ids: deviceIds })
                        .eq('id', userId);
                }
            }
        } catch (error) {
            console.error('Error updating device IDs:', error);
        }
    }
}

// Initialize sync service
const syncService = new SupabaseSync();

// Export functions for use in app.js
window.supabaseSync = {
    init: () => syncService,
    sync: () => syncService.syncPendingRecords(),
    getUsers: () => syncService.getUsers(),
    getUserRecords: (userId, startDate, endDate) => 
        syncService.getUserRecords(userId, startDate, endDate),
    createUser: (userData) => syncService.createUser(userData),
    updateDeviceIds: (userId, deviceId) => syncService.updateDeviceIds(userId, deviceId)
};

// Auto-sync when coming online
window.addEventListener('load', () => {
    if (navigator.onLine) {
        setTimeout(() => {
            syncService.syncPendingRecords();
        }, 3000);
    }
});