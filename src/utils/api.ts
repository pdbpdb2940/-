import { ShiftRecord, StaffMember, TaskSchedule, AuditLog } from '../types';

export interface ServerAppData {
  shifts: ShiftRecord[];
  staffList: StaffMember[];
  tasks?: TaskSchedule[];
  notes: Record<string, string>;
  adminPin: string;
  auditLogs?: AuditLog[];
  updatedAt?: number;
}

/**
 * サーバーから最新の全データを取得
 */
export async function fetchAppData(): Promise<ServerAppData | null> {
  try {
    const res = await fetch('/api/data');
    if (!res.ok) {
      throw new Error(`Failed to fetch data: ${res.status}`);
    }
    const data: ServerAppData = await res.json();
    return data;
  } catch (err) {
    console.warn('サーバーからのデータ取得に失敗しました (LocalStorage使用):', err);
    return null;
  }
}

/**
 * 初回ロード時の同期
 * ローカルデータとサーバーデータをマージ
 */
export async function syncAppDataWithServer(localData: {
  shifts?: ShiftRecord[];
  staffList?: StaffMember[];
  tasks?: TaskSchedule[];
  notes?: Record<string, string>;
  adminPin?: string;
  auditLogs?: AuditLog[];
}): Promise<ServerAppData | null> {
  try {
    const res = await fetch('/api/sync', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(localData),
    });
    if (!res.ok) {
      throw new Error(`Failed to sync data: ${res.status}`);
    }
    const data: ServerAppData = await res.json();
    return data;
  } catch (err) {
    console.warn('サーバーとの同期に失敗しました:', err);
    return null;
  }
}

/**
 * シフトデータをサーバーに保存
 */
export async function apiSaveShifts(shifts: ShiftRecord[]): Promise<boolean> {
  try {
    const res = await fetch('/api/shifts', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ shifts }),
    });
    return res.ok;
  } catch (err) {
    console.warn('シフトのサーバー保存に失敗しました:', err);
    return false;
  }
}

/**
 * 業務予定をサーバーに保存
 */
export async function apiSaveTasks(tasks: TaskSchedule[]): Promise<boolean> {
  try {
    const res = await fetch('/api/tasks', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ tasks }),
    });
    return res.ok;
  } catch (err) {
    console.warn('業務予定のサーバー保存に失敗しました:', err);
    return false;
  }
}

/**
 * 監査ログをサーバーに保存
 */
export async function apiSaveAuditLog(log: AuditLog): Promise<boolean> {
  try {
    const res = await fetch('/api/audit-logs', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ log }),
    });
    return res.ok;
  } catch (err) {
    console.warn('監査ログのサーバー保存に失敗しました:', err);
    return false;
  }
}

/**
 * 職員名簿をサーバーに保存
 */
export async function apiSaveStaff(staffList: StaffMember[]): Promise<boolean> {
  try {
    const res = await fetch('/api/staff', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ staffList }),
    });
    return res.ok;
  } catch (err) {
    console.warn('職員名簿のサーバー保存に失敗しました:', err);
    return false;
  }
}

/**
 * 月別連絡メモをサーバーに保存
 */
export async function apiSaveNote(key: string, note: string): Promise<boolean> {
  try {
    const res = await fetch('/api/notes', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ key, note }),
    });
    return res.ok;
  } catch (err) {
    console.warn('メモのサーバー保存に失敗しました:', err);
    return false;
  }
}

/**
 * 管理者暗証番号をサーバーに保存
 */
export async function apiSaveAdminPin(pin: string): Promise<boolean> {
  try {
    const res = await fetch('/api/admin-pin', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ pin }),
    });
    return res.ok;
  } catch (err) {
    console.warn('暗証番号のサーバー保存に失敗しました:', err);
    return false;
  }
}
