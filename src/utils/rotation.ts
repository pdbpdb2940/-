import { BiweeklyRotationConfig, RotationPair, ShiftRecord } from '../types';
import { DEFAULT_SHIFT_START, DEFAULT_SHIFT_END } from './constants';
import { formatDateKey, getHolidayName } from './holidays';

export const STORAGE_KEY_ROTATION_CONFIG = 'shifttable_rotation_config_v1';
export const STORAGE_KEY_CUSTOM_DATES = 'shifttable_custom_edited_dates_v1';

/**
 * 隔週2名体制シフトの初期標準設定（神谷・紙谷・中野の3名ローテーション）
 * ペアA: 神谷 + 紙谷
 * ペアB: 紙谷 + 中野
 * ペアC: 中野 + 神谷
 * 基準日: 2026-10-05 (第1週)
 */
export const DEFAULT_ROTATION_CONFIG: BiweeklyRotationConfig = {
  baseDate: '2026-10-05',
  excludeWeekends: true,
  excludeHolidays: true,
  pairs: [
    {
      id: 'pair-a',
      name: 'ペアA',
      members: [
        { staffName: '神谷', startTime: DEFAULT_SHIFT_START, endTime: DEFAULT_SHIFT_END },
        { staffName: '紙谷', startTime: DEFAULT_SHIFT_START, endTime: DEFAULT_SHIFT_END },
      ],
    },
    {
      id: 'pair-b',
      name: 'ペアB',
      members: [
        { staffName: '紙谷', startTime: DEFAULT_SHIFT_START, endTime: DEFAULT_SHIFT_END },
        { staffName: '中野', startTime: DEFAULT_SHIFT_START, endTime: DEFAULT_SHIFT_END },
      ],
    },
    {
      id: 'pair-c',
      name: 'ペアC',
      members: [
        { staffName: '中野', startTime: DEFAULT_SHIFT_START, endTime: DEFAULT_SHIFT_END },
        { staffName: '神谷', startTime: DEFAULT_SHIFT_START, endTime: DEFAULT_SHIFT_END },
      ],
    },
  ],
};

/**
 * 指定日の属する週の月曜日（00:00:00）を算出
 */
export function getMondayOfDate(d: Date): Date {
  const copy = new Date(d.getFullYear(), d.getMonth(), d.getDate());
  const day = copy.getDay(); // 0: Sun, 1: Mon, ..., 6: Sat
  const diff = (day === 0 ? -6 : 1) - day;
  copy.setDate(copy.getDate() + diff);
  return copy;
}

/**
 * 基準日に対する相対週差分（baseDateの週を 0 とした週差分）
 */
export function getWeekDiff(dateStr: string, baseDateStr: string): number {
  const [y1, m1, d1] = dateStr.split('-').map(Number);
  const [y2, m2, d2] = baseDateStr.split('-').map(Number);
  const date1 = new Date(y1, m1 - 1, d1);
  const date2 = new Date(y2, m2 - 1, d2);
  const mon1 = getMondayOfDate(date1);
  const mon2 = getMondayOfDate(date2);
  const diffTime = mon1.getTime() - mon2.getTime();
  return Math.round(diffTime / (1000 * 60 * 60 * 24 * 7));
}

/**
 * 指定日に対応するローテーションペア情報・相対週番号を取得
 */
export function getPairForDate(
  dateStr: string,
  config: BiweeklyRotationConfig
): { pair: RotationPair; pairIndex: number; weekNumber: number } | null {
  if (!config.pairs || config.pairs.length === 0) return null;
  const diffWeeks = getWeekDiff(dateStr, config.baseDate);
  const count = config.pairs.length;
  const pairIndex = ((diffWeeks % count) + count) % count;
  return {
    pair: config.pairs[pairIndex],
    pairIndex,
    weekNumber: diffWeeks + 1, // 基準週＝第1週
  };
}

export interface RotationGenerationResult {
  generatedShifts: ShiftRecord[];
  targetDatesCount: number;
  skippedCustomDatesCount: number;
  skippedWeekendCount: number;
  skippedHolidayCount: number;
}

/**
 * 指定期間（startDate ～ endDate）に対して隔週ペアローテーションシフトを生成
 * 個別編集日（customEditedDates）の保護機能に対応
 */
export function generateRotationShiftsForRange(
  startDateStr: string,
  endDateStr: string,
  config: BiweeklyRotationConfig,
  authorUid: string,
  authorName: string,
  customEditedDates: Set<string> = new Set(),
  overwriteCustomDates: boolean = false
): RotationGenerationResult {
  const generatedShifts: ShiftRecord[] = [];
  let targetDatesCount = 0;
  let skippedCustomDatesCount = 0;
  let skippedWeekendCount = 0;
  let skippedHolidayCount = 0;

  const [yStart, mStart, dStart] = startDateStr.split('-').map(Number);
  const [yEnd, mEnd, dEnd] = endDateStr.split('-').map(Number);

  const curr = new Date(yStart, mStart - 1, dStart);
  const end = new Date(yEnd, mEnd - 1, dEnd);

  while (curr <= end) {
    const y = curr.getFullYear();
    const m = curr.getMonth() + 1;
    const d = curr.getDate();
    const dateStr = formatDateKey(y, m, d);
    const dayOfWeek = curr.getDay(); // 0: Sun, 6: Sat
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const holidayName = getHolidayName(curr);

    // 土日除外
    if (config.excludeWeekends && isWeekend) {
      skippedWeekendCount++;
      curr.setDate(curr.getDate() + 1);
      continue;
    }

    // 祝日除外
    if (config.excludeHolidays && Boolean(holidayName)) {
      skippedHolidayCount++;
      curr.setDate(curr.getDate() + 1);
      continue;
    }

    // 個別手動変更された日の保護（上書き指定がない場合はスキップ）
    if (!overwriteCustomDates && customEditedDates.has(dateStr)) {
      skippedCustomDatesCount++;
      curr.setDate(curr.getDate() + 1);
      continue;
    }

    targetDatesCount++;
    const pairInfo = getPairForDate(dateStr, config);
    if (pairInfo && pairInfo.pair && pairInfo.pair.members) {
      pairInfo.pair.members.forEach((member) => {
        if (!member.staffName) return;
        generatedShifts.push({
          id: `shift-${dateStr}-${member.staffName}-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
          date: dateStr,
          staffName: member.staffName,
          startTime: member.startTime || DEFAULT_SHIFT_START,
          endTime: member.endTime || DEFAULT_SHIFT_END,
          note: '',
          isAbsence: false,
          isAutoGenerated: true,
          rotationPairId: pairInfo.pair.id,
          isCustomEdited: false,
          createdByUid: authorUid,
          createdByName: authorName,
          createdAt: Date.now(),
          updatedAt: Date.now(),
        });
      });
    }

    curr.setDate(curr.getDate() + 1);
  }

  return {
    generatedShifts,
    targetDatesCount,
    skippedCustomDatesCount,
    skippedWeekendCount,
    skippedHolidayCount,
  };
}

/**
 * LocalStorageから隔週設定を読み込み
 */
export function loadRotationConfigFromStorage(): BiweeklyRotationConfig {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_ROTATION_CONFIG);
    if (!raw) return DEFAULT_ROTATION_CONFIG;
    const parsed = JSON.parse(raw);
    if (!parsed || !Array.isArray(parsed.pairs) || parsed.pairs.length === 0) {
      return DEFAULT_ROTATION_CONFIG;
    }
    return {
      baseDate: parsed.baseDate || DEFAULT_ROTATION_CONFIG.baseDate,
      excludeWeekends: parsed.excludeWeekends ?? true,
      excludeHolidays: parsed.excludeHolidays ?? true,
      pairs: parsed.pairs,
      updatedAt: parsed.updatedAt,
      updatedByName: parsed.updatedByName,
    };
  } catch (e) {
    console.error('Failed to load rotation config:', e);
    return DEFAULT_ROTATION_CONFIG;
  }
}

/**
 * LocalStorageへ隔週設定を保存
 */
export function saveRotationConfigToStorage(config: BiweeklyRotationConfig): void {
  try {
    localStorage.setItem(STORAGE_KEY_ROTATION_CONFIG, JSON.stringify(config));
  } catch (e) {
    console.error('Failed to save rotation config:', e);
  }
}

/**
 * 個別手動変更された日付セットをLocalStorageから読み込み
 */
export function loadCustomEditedDatesFromStorage(): Set<string> {
  try {
    const raw = localStorage.getItem(STORAGE_KEY_CUSTOM_DATES);
    if (!raw) return new Set();
    const arr = JSON.parse(raw);
    return new Set(Array.isArray(arr) ? arr : []);
  } catch {
    return new Set();
  }
}

/**
 * 個別手動変更された日付セットをLocalStorageへ保存
 */
export function saveCustomEditedDatesToStorage(dates: Set<string>): void {
  try {
    localStorage.setItem(STORAGE_KEY_CUSTOM_DATES, JSON.stringify(Array.from(dates)));
  } catch (e) {
    console.error('Failed to save custom edited dates:', e);
  }
}
