import { StaffMember } from '../types';

/**
 * ==========================================
 * 基本設定・定数
 * ==========================================
 * 勤務時間や職員の初期設定はここで定義されています。
 */

// デフォルトの早出勤務時間
export const DEFAULT_SHIFT_START = '07:30';
export const DEFAULT_SHIFT_END = '16:15';

// 初期登録職員リスト
export const DEFAULT_STAFF_LIST: StaffMember[] = [
  {
    id: 'staff-1',
    name: '神谷',
    colorBg: 'bg-emerald-50',
    colorText: 'text-emerald-900',
    colorBorder: 'border-emerald-300',
  },
  {
    id: 'staff-2',
    name: '紙谷',
    colorBg: 'bg-indigo-50',
    colorText: 'text-indigo-900',
    colorBorder: 'border-indigo-300',
  },
  {
    id: 'staff-3',
    name: '中野',
    colorBg: 'bg-amber-50',
    colorText: 'text-amber-900',
    colorBorder: 'border-amber-300',
  },
];

// 職員別の視覚カラーパレット（職員追加時用のローテーション色）
export const STAFF_COLOR_PALETTES = [
  { colorBg: 'bg-emerald-50', colorText: 'text-emerald-900', colorBorder: 'border-emerald-300' },
  { colorBg: 'bg-indigo-50', colorText: 'text-indigo-900', colorBorder: 'border-indigo-300' },
  { colorBg: 'bg-amber-50', colorText: 'text-amber-900', colorBorder: 'border-amber-300' },
  { colorBg: 'bg-rose-50', colorText: 'text-rose-900', colorBorder: 'border-rose-300' },
  { colorBg: 'bg-sky-50', colorText: 'text-sky-900', colorBorder: 'border-sky-300' },
  { colorBg: 'bg-purple-50', colorText: 'text-purple-900', colorBorder: 'border-purple-300' },
  { colorBg: 'bg-teal-50', colorText: 'text-teal-900', colorBorder: 'border-teal-300' },
  { colorBg: 'bg-orange-50', colorText: 'text-orange-900', colorBorder: 'border-orange-300' },
];

// LocalStorage 保存キー名
export const STORAGE_KEY_SHIFTS = 'shifttable_records_v1';
export const STORAGE_KEY_STAFF = 'shifttable_staff_v1';

// 曜日表示用（日曜始まり: 0=日 〜 6=土）日本の一般的なカレンダー標準
export const WEEK_DAYS_JA_SUN = ['日', '月', '火', '水', '木', '金', '土'] as const;

// 曜日表示用（月曜日始まり: 0=月 〜 6=日）
export const WEEK_DAYS_JA_MON = ['月', '火', '水', '木', '金', '土', '日'] as const;

// 曜日表示用（既存参照との互換性）
export const WEEK_DAYS_JA = WEEK_DAYS_JA_SUN;

// 標準曜日配列（Date.getDay() 準拠: 0=日, 1=月, 2=火, 3=水, 4=木, 5=金, 6=土）
export const DAY_OF_WEEK_JA = ['日', '月', '火', '水', '木', '金', '土'] as const;

/**
 * 開始曜日（日曜または月曜）に応じたカレンダーヘッダー配列を取得
 */
export function getWeekDaysHeader(startOfWeek: 'sun' | 'mon' = 'sun'): readonly string[] {
  return startOfWeek === 'sun' ? WEEK_DAYS_JA_SUN : WEEK_DAYS_JA_MON;
}

/**
 * Date.getDay() (0=日 〜 6=土) から正しい曜日名を取得
 */
export function getDayOfWeekLabel(dayOfWeek: number): string {
  return DAY_OF_WEEK_JA[dayOfWeek % 7] || '';
}
