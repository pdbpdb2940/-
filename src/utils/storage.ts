import { ShiftRecord, StaffMember } from '../types';
import {
  DEFAULT_STAFF_LIST,
  DEFAULT_SHIFT_START,
  DEFAULT_SHIFT_END,
  STORAGE_KEY_SHIFTS,
  STORAGE_KEY_STAFF,
} from './constants';
import { formatDateKey } from './holidays';
import { apiSaveShifts, apiSaveStaff, apiSaveNote, apiSaveAdminPin } from './api';
import {
  replaceAllShiftsInCloud,
  saveStaffListToCloud,
  saveNoteToCloud,
  saveAdminPinToCloud,
} from '../services/firestoreService';

/**
 * LocalStorage から早出シフトデータを読み込む
 */
export function loadShiftsFromStorage(): ShiftRecord[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_SHIFTS);
    if (!raw) {
      // 初回起動時のサンプルデータ（プロンプト例：9月3日 早出：神谷 7:30～16:15 等）
      const initialShifts = createSampleShifts();
      try {
        localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(initialShifts));
      } catch (e) {
        // ignore
      }
      return initialShifts;
    }
    const parsed: ShiftRecord[] = JSON.parse(raw);
    return parsed.map((s) => {
      const isAbs = Boolean(s.isAbsence) || s.startTime === '終日' || !s.endTime || Boolean(s.absenceType);
      const absenceType = s.absenceType || (isAbs ? (s.note?.includes('出張') ? '出張' : s.note?.includes('研修') ? '研修' : '休み') : undefined);
      return {
        ...s,
        isAbsence: isAbs,
        absenceType,
      };
    });
  } catch (err) {
    console.error('シフトデータの読み込みに失敗しました:', err);
    return [];
  }
}

/**
 * LocalStorageおよびサーバーAPIに早出シフトデータを非同期で保存する
 */
export async function saveShiftsToStorageAsync(shifts: ShiftRecord[]): Promise<void> {
  try {
    localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(shifts));
  } catch (err) {
    console.error('シフトデータの保存に失敗しました:', err);
  }
  // サーバーへ自動永続化
  await apiSaveShifts(shifts);
}

/**
 * LocalStorageおよびサーバーAPIに早出シフトデータを保存する
 */
export function saveShiftsToStorage(shifts: ShiftRecord[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_SHIFTS, JSON.stringify(shifts));
  } catch (err) {
    console.error('シフトデータの保存に失敗しました:', err);
  }
  // サーバーへ自動永続化
  apiSaveShifts(shifts);
}

/**
 * LocalStorage から職員リストを読み込む
 */
export function loadStaffFromStorage(): StaffMember[] {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_STAFF);
    if (!raw) {
      return DEFAULT_STAFF_LIST;
    }
    const parsed = JSON.parse(raw);
    if (!Array.isArray(parsed) || parsed.length === 0) {
      return DEFAULT_STAFF_LIST;
    }
    return parsed;
  } catch (err) {
    console.error('職員データの読み込みに失敗しました:', err);
    return DEFAULT_STAFF_LIST;
  }
}

/**
 * 職員リストを初期担当者（神谷・紙谷・中野）にリセット
 */
export function resetStaffToDefault(): StaffMember[] {
  saveStaffToStorage(DEFAULT_STAFF_LIST);
  return DEFAULT_STAFF_LIST;
}

/**
 * LocalStorage およびサーバーに職員リストを保存する
 */
export function saveStaffToStorage(staffList: StaffMember[]): void {
  try {
    localStorage.setItem(STORAGE_KEY_STAFF, JSON.stringify(staffList));
  } catch (err) {
    console.error('職員データの保存に失敗しました:', err);
  }
  // サーバーへ自動永続化
  apiSaveStaff(staffList);
}

/**
 * 初回表示用のサンプルデータ生成
 */
function createSampleShifts(): ShiftRecord[] {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth() + 1;

  return [
    {
      id: 'sample-1',
      date: formatDateKey(year, month, 3),
      staffName: '神谷',
      startTime: DEFAULT_SHIFT_START,
      endTime: DEFAULT_SHIFT_END,
      note: '定期点検対応',
      createdAt: Date.now() - 300000,
    },
    {
      id: 'sample-2',
      date: formatDateKey(year, month, 7),
      staffName: '紙谷',
      startTime: DEFAULT_SHIFT_START,
      endTime: DEFAULT_SHIFT_END,
      note: '開館準備',
      createdAt: Date.now() - 200000,
    },
    {
      id: 'sample-3',
      date: formatDateKey(year, month, 10),
      staffName: '中野',
      startTime: DEFAULT_SHIFT_START,
      endTime: DEFAULT_SHIFT_END,
      note: '設備巡回',
      createdAt: Date.now() - 100000,
    },
    {
      id: 'sample-4',
      date: formatDateKey(year, month, 16),
      staffName: '神谷',
      startTime: DEFAULT_SHIFT_START,
      endTime: DEFAULT_SHIFT_END,
      note: '',
      createdAt: Date.now() - 50000,
    },
  ];
}

const STORAGE_KEY_NOTE_PREFIX = 'facility_shift_note_';
const STORAGE_KEY_ADMIN_PIN = 'facility_shift_admin_pin_v2';
const DEFAULT_ADMIN_PIN = '7322';

/**
 * 全角数字を半角数字に正規化
 */
export function normalizePin(pin: string): string {
  return pin.trim().replace(/[０-９]/g, (s) => String.fromCharCode(s.charCodeAt(0) - 0xfee0));
}

/**
 * 管理者PINコードを取得
 */
export function loadAdminPinFromStorage(): string {
  try {
    const pin = localStorage.getItem(STORAGE_KEY_ADMIN_PIN);
    return pin ? normalizePin(pin) : DEFAULT_ADMIN_PIN;
  } catch {
    return DEFAULT_ADMIN_PIN;
  }
}

/**
 * 管理者PINコードを保存
 */
export function saveAdminPinToStorage(newPin: string): boolean {
  try {
    const normalized = normalizePin(newPin);
    localStorage.setItem(STORAGE_KEY_ADMIN_PIN, normalized);
    // サーバーへ自動永続化
    apiSaveAdminPin(normalized);
    // クラウドFirestoreへ永続化
    saveAdminPinToCloud(normalized).catch(err => console.warn('Firestore PIN save error:', err));
    return true;
  } catch (err) {
    console.error('管理者PINの保存に失敗しました:', err);
    return false;
  }
}

/**
 * 年月ごとの連絡・申し送りメモをLocalStorageから取得
 */
export function loadMonthNoteFromStorage(year: number, month: number): string {
  try {
    const key = `${STORAGE_KEY_NOTE_PREFIX}${year}_${String(month).padStart(2, '0')}`;
    const saved = localStorage.getItem(key);
    if (saved !== null) {
      return saved;
    }
    // 初回初期テンプレート
    return '【早出業務連絡・注意事項】\n・出勤時刻: 07:30 厳守（正面玄関解錠、空調・照明・給湯器の稼働点検）\n・異常発見時は管理責任者へ直ちに報告のこと\n・緊急連絡先: 施設管理課（内線: 2100）';
  } catch (err) {
    console.error('メモの読み込みに失敗しました:', err);
    return '';
  }
}

/**
 * 年月ごとの連絡・申し送りメモをLocalStorage、サーバー、およびFirestoreに保存
 */
export function saveMonthNoteToStorage(year: number, month: number, note: string): void {
  const key = `${STORAGE_KEY_NOTE_PREFIX}${year}_${String(month).padStart(2, '0')}`;
  try {
    localStorage.setItem(key, note);
  } catch (err) {
    console.error('メモの保存に失敗しました:', err);
  }
  // サーバーへ自動永続化
  apiSaveNote(key, note);
  // クラウドFirestoreへ永続化
  saveNoteToCloud(key, note).catch(err => console.warn('Firestore note save error:', err));
}
