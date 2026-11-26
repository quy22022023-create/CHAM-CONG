"use strict";
const OTPRO_SYNC_BUILD = "20261126-04";

// Versioned synchronization for the existing custom-login app.
// Business data remains in its existing tables. This module owns only local
// pending changes, immutable base revisions, recovery copies and RPC transport.
(function (global) {
  const clone = value => JSON.parse(JSON.stringify(value));
  const recordId = (entity, key) => `${entity}:${key}`;
  const stable = value => JSON.stringify(value, function (_key, item) {
    if (item && typeof item === "object" && !Array.isArray(item)) {
      return Object.keys(item).sort().reduce((out, key) => { out[key] = item[key]; return out; }, {});
    }
    return item;
  });
  const uuid = () => {
    if (global.crypto?.randomUUID) return global.crypto.randomUUID();
    const bytes = global.crypto.getRandomValues(new Uint8Array(16));
    bytes[6] = (bytes[6] & 15) | 64; bytes[8] = (bytes[8] & 63) | 128;
    const hex = Array.from(bytes, b => b.toString(16).padStart(2, "0")).join("");
    return `${hex.slice(0,8)}-${hex.slice(8,12)}-${hex.slice(12,16)}-${hex.slice(16,20)}-${hex.slice(20)}`;
  };
  function snapshotRecords(snapshot) {
    const records = new Map();
    if (snapshot.settings) records.set(recordId("payroll_settings", "settings"), snapshot.settings.settings);
    for (const row of snapshot.leaves || []) records.set(recordId("leave_records", String(row.leave_date).slice(0,10)), {
      leave_amount: Number(row.leave_amount), leave_session: row.leave_session, note: row.note || ""
    });
    for (const row of snapshot.payrolls || []) records.set(recordId("payroll_months", String(row.payroll_month).slice(0,7)), row.payroll_data);
    return records;
  }
  global.createOTProSync = function ({ client, storage = global.localStorage, online = () => global.navigator?.onLine !== false }) {
    let username = null, state = null, lastSnapshot = null, tail = Promise.resolve();
    let knownJobIds = new Set();
    const jobPrefix = () => `otpro_sync_job_v1_${encodeURIComponent(username)}:`;
    function readJobs(saved) {
      const jobs = new Map((saved?.jobStorage ? [] : saved?.jobs || []).map(job => [job.id,job]));
      for (let index = 0; index < storage.length; index += 1) {
        const key = storage.key(index);
        if (!key?.startsWith(jobPrefix())) continue;
        try { const job = JSON.parse(storage.getItem(key)); if (job?.id && Array.isArray(job.changes)) jobs.set(job.id,job); }
        catch { /* do not remove unreadable storage entries */ }
      }
      return [...jobs.values()];
    }
    const serial = task => {
      const execute = async () => {
        const saved = storage.getItem(storageKey());
        if (saved) state = JSON.parse(saved);
        state.jobs = readJobs(state);
        knownJobIds = new Set(state.jobs.map(job => job.id));
        return task();
      };
      const job = tail.then(() => global.navigator?.locks
        ? global.navigator.locks.request(`otpro-sync-${username}`, execute)
        : execute());
      tail = job.catch(() => {}); return job;
    };
    const storageKey = () => `otpro_sync_v1_${encodeURIComponent(username)}`;
    const backupKey = () => `otpro_sync_backup_v1_${encodeURIComponent(username)}`;
    function persist() {
      const active = new Set(state.jobs.map(job => job.id));
      // Separate durable keys prevent a stale tab from overwriting another
      // tab's newly queued edits while localStorage events are still in flight.
      for (const job of state.jobs) storage.setItem(jobPrefix() + job.id, JSON.stringify(job));
      for (const id of knownJobIds) if (!active.has(id)) storage.removeItem(jobPrefix() + id);
      state.jobStorage = true;
      storage.setItem(storageKey(), JSON.stringify({ ...state, jobs: [] }));
      knownJobIds = active;
    }
    function useUser(next) {
      if (username === next) return;
      username = next; lastSnapshot = null;
      let saved = null;
      try { saved = JSON.parse(storage.getItem(storageKey()) || "null"); } catch { /* keep original business cache intact */ }
      if (saved && saved.version !== 1) throw new Error("Phiên bản dữ liệu đồng bộ trên máy chưa được hỗ trợ.");
      state = saved || { version: 1, ready: false, revisions: {}, jobs: [], recovery: [], legacyCaptured: false };
      state.jobs = readJobs(state);
      knownJobIds = new Set(state.jobs.map(job => job.id));
    }
    function captureLegacy(rawBackup, records) {
      if (!username || state.legacyCaptured) return;
      // Write the recovery copy before a server refresh replaces the old cache.
      storage.setItem(backupKey(), JSON.stringify({ capturedAt: new Date().toISOString(), username, data: rawBackup }));
      state.recovery = clone(records || []).map(item => ({ ...item, id: `legacy:${recordId(item.entity,item.key)}` }));
      state.legacyCaptured = true; persist();
    }
    async function request(name, args) {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      let response;
      try { response = await client.rpc(name, args).abortSignal(controller.signal); }
      finally { clearTimeout(timeout); }
      const { data, error } = response;
      if (error) {
        const missing = ["PGRST202", "42883"].includes(String(error.code)) || /could not find the function|function .* does not exist/i.test(error.message || "");
        const failure = new Error(missing
          ? "Cần chạy SQL 08_FEATURES_COMPAT_V1_1_10.sql trước khi đồng bộ bản mới."
          : error.message || "Không thể kết nối Supabase.");
        failure.migrationRequired = missing;
        failure.network = !online() || !error.code || /fetch|network|timeout|connection|failed to send/i.test(`${error.message} ${error.details}`);
        throw failure;
      }
      return data;
    }
    async function pull() {
      const snapshot = await request("otpro_sync_snapshot", { p_username: username });
      if (snapshot?.protocol !== 1 || !Array.isArray(snapshot.states) || !Array.isArray(snapshot.leaves) || !Array.isArray(snapshot.payrolls)) {
        throw new Error("Server trả về dữ liệu đồng bộ không hợp lệ; cache hiện tại được giữ nguyên.");
      }
      const revisions = {};
      for (const entry of snapshot.states) revisions[recordId(entry.entity,entry.key)] = String(entry.revision);
      state.revisions = revisions; state.ready = true;
      const records = snapshotRecords(snapshot);
      state.recovery = state.recovery.filter(item => stable(records.get(recordId(item.entity,item.key))) !== stable(item.data));
      persist(); lastSnapshot = clone(snapshot);
      return snapshot;
    }
    function sameKeys(a, b) {
      return a.length === b.length && a.every(x => b.some(y => x.entity === y.entity && x.key === y.key));
    }
    function stage(changes) {
      if (!state.ready) {
        for (const change of changes) {
          const id = `unbased:${recordId(change.entity,change.key)}`;
          state.recovery = state.recovery.filter(item => item.id !== id).concat({ ...clone(change), id });
        }
        persist();
        throw new Error("Cần tải dữ liệu từ server một lần trước khi lưu. Bản trên máy vẫn được giữ để kiểm tra.");
      }
      const overlap = state.jobs.filter(job => job.changes.some(a => changes.some(b => a.entity === b.entity && a.key === b.key)));
      if (overlap.length && (overlap.length !== 1 || overlap[0].status !== "pending" || !sameKeys(overlap[0].changes,changes))) {
        throw new Error("Bản ghi này đang có thay đổi cần xem lại. Mở Cài đặt → Tài khoản để chọn bản cần giữ.");
      }
      const existing = overlap[0];
      const job = { id: existing?.id || uuid(), status: "pending", changes: changes.map(change => {
        const prior = existing?.changes.find(x => x.entity === change.entity && x.key === change.key);
        return { entity: change.entity, key: change.key, operation: change.operation || "put", data: clone(change.data || {}),
          revision: prior?.revision ?? change.revision ?? state.revisions[recordId(change.entity,change.key)] ?? "0",
          mutation_id: prior && prior.operation === (change.operation || "put") && stable(prior.data) === stable(change.data || {}) ? prior.mutation_id : uuid() };
      }) };
      const nextJobs = state.jobs.filter(x => x.id !== job.id).concat(job);
      const next = { ...state, jobs: nextJobs };
      const previous = state;
      state = next;
      try { persist(); } catch (error) { state = previous; throw error; }
      return job.id;
    }
    async function flush() {
      if (!online()) return;
      for (const job of [...state.jobs]) {
        if (job.status !== "pending") continue;
        try {
          const result = await request("otpro_sync_apply_batch", { p_username: username, p_changes: job.changes });
          if (result?.conflict) {
            job.status = "conflict"; job.message = "Server đã thay đổi hoặc đã xóa bản ghi này."; job.conflict = result;
          } else if (result?.ok && Array.isArray(result.results)) {
            for (const entry of result.results) state.revisions[recordId(entry.entity,entry.key)] = String(entry.revision);
            state.jobs = state.jobs.filter(x => x.id !== job.id);
            // An explicit successful edit supersedes a previous recovery candidate.
            state.recovery = state.recovery.filter(item => !job.changes.some(x => x.entity === item.entity && x.key === item.key));
          } else {
            throw new Error("Server chưa xác nhận lưu đủ dữ liệu.");
          }
          persist();
        } catch (error) {
          if (error.network || error.migrationRequired) {
            job.message = error.message; persist();
            if (error.migrationRequired) throw error;
            return;
          }
          job.status = "error"; job.message = error.message; persist();
        }
      }
    }
    function view(snapshot) {
      const result = clone(snapshot);
      for (const job of state.jobs) {
        // A conflict never reappears as an official leave/payroll record.
        if (job.status !== "pending") continue;
        for (const change of job.changes) {
          if (change.entity === "payroll_settings") {
            result.settings = change.operation === "delete" ? null : { username, settings: change.data, updated_at: null };
          } else if (change.entity === "leave_records") {
            result.leaves = result.leaves.filter(row => String(row.leave_date).slice(0,10) !== change.key);
            if (change.operation !== "delete") result.leaves.push({ username, leave_date: change.key, ...change.data, updated_at: null });
          } else {
            result.payrolls = result.payrolls.filter(row => String(row.payroll_month).slice(0,7) !== change.key);
            if (change.operation !== "delete") result.payrolls.push({ username, payroll_month: `${change.key}-01`, payroll_data: change.data, updated_at: null });
          }
        }
      }
      return result;
    }
    async function refresh() { return serial(async () => { await flush(); return view(await pull()); }); }
    async function saveMany(changes) {
      const captured = clone(changes);
      return serial(async () => {
        const id = stage(captured);
        await flush();
        const remaining = state.jobs.find(x => x.id === id);
        const acknowledged = {};
        if (!remaining) for (const change of captured) acknowledged[recordId(change.entity,change.key)] = state.revisions[recordId(change.entity,change.key)];
        let snapshot = null;
        if (online()) {
          try { snapshot = view(await pull()); } catch (error) { if (error.migrationRequired) throw error; }
        }
        return { saved: !remaining, queued: remaining?.status === "pending", conflict: remaining && remaining.status !== "pending", snapshot, acknowledged };
      });
    }
    function inspect() {
      let latest = state;
      try { latest = JSON.parse(storage.getItem(storageKey()) || "null") || state; } catch { /* preserve the in-memory state */ }
      return clone({ ready: latest?.ready || false, jobs: readJobs(latest), recovery: latest?.recovery || [], hasBackup: Boolean(username && storage.getItem(backupKey())) });
    }
    async function resolve(id, choice) {
      return serial(async () => {
        const snapshot = await pull();
        const job = state.jobs.find(x => x.id === id);
        const recovery = state.recovery.find(x => x.id === id);
        if (!job && !recovery) return view(snapshot);
        if (choice === "server") {
          state.jobs = state.jobs.filter(x => x.id !== id);
          state.recovery = state.recovery.filter(x => x.id !== id); persist();
          return view(snapshot);
        }
        if (choice !== "local") throw new Error("Lựa chọn xử lý không hợp lệ.");
        const changes = job ? job.changes : [{ entity: recovery.entity, key: recovery.key, operation: recovery.operation || "put", data: recovery.data }];
        state.jobs = state.jobs.filter(x => x.id !== id);
        const replacement = { id: uuid(), status: "pending", changes: changes.map(change => ({ ...clone(change), revision: state.revisions[recordId(change.entity,change.key)] || "0", mutation_id: uuid() })) };
        if (state.jobs.some(other => other.changes.some(a => replacement.changes.some(b => a.entity === b.entity && a.key === b.key)))) {
          if (job) state.jobs.push(job);
          throw new Error("Còn thay đổi đang chờ của bản ghi này; hãy xử lý trước.");
        }
        state.jobs.push(replacement); persist(); await flush();
        const current = state.jobs.find(x => x.id === replacement.id);
        if (!current) state.recovery = state.recovery.filter(x => x.id !== id);
        persist(); return view(await pull());
      });
    }
    function exportBackup() {
      const sync = clone(state); sync.jobs = readJobs(state);
      return { version: 1, username, exportedAt: new Date().toISOString(),
        legacy: JSON.parse(storage.getItem(backupKey()) || "null"), sync };
    }
    const getRevision = (entity, key) => state?.revisions[recordId(entity,key)] || "0";
    return { useUser, captureLegacy, refresh, saveMany, inspect, resolve, exportBackup, view, getRevision };
  };
})(globalThis);
