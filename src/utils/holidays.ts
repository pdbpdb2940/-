/**
 * 日本の祝日（国民の祝日・振替休日・国民の休日）自動判定ユーティリティ
 */

// 春分の日を計算（1980年〜2099年対応の標準計算式）
function getVernalEquinoxDay(year: number): number {
  return Math.floor(20.8431 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

// 秋分の日を計算（1980年〜2099年対応の標準計算式）
function getAutumnalEquinoxDay(year: number): number {
  return Math.floor(23.2488 + 0.242194 * (year - 1980) - Math.floor((year - 1980) / 4));
}

// 指定年月の第n月曜日の日付を取得
function getNthMonday(year: number, month: number, n: number): number {
  const firstDay = new Date(year, month - 1, 1).getDay(); // 0: 日, 1: 月, ...
  const firstMonday = firstDay <= 1 ? 1 + (1 - firstDay) : 1 + (8 - firstDay);
  return firstMonday + (n - 1) * 7;
}

// 日付文字列 'YYYY-MM-DD' を生成
export function formatDateKey(year: number, month: number, day: number): string {
  const m = String(month).padStart(2, '0');
  const d = String(day).padStart(2, '0');
  return `${year}-${m}-${d}`;
}

/**
 * 指定年の祝日マップを取得 ({ 'YYYY-MM-DD': '祝日名' })
 */
export function getHolidaysForYear(year: number): Map<string, string> {
  const holidayMap = new Map<string, string>();

  const add = (month: number, day: number, name: string) => {
    holidayMap.set(formatDateKey(year, month, day), name);
  };

  // 1月
  add(1, 1, '元日');
  add(1, getNthMonday(year, 1, 2), '成人の日');

  // 2月
  add(2, 11, '建国記念の日');
  if (year >= 2020) {
    add(2, 23, '天皇誕生日');
  }

  // 3月
  const vernalDay = getVernalEquinoxDay(year);
  add(3, vernalDay, '春分の日');

  // 4月
  add(4, 29, '昭和の日');

  // 5月
  add(5, 3, '憲法記念日');
  add(5, 4, 'みどりの日');
  add(5, 5, 'こどもの日');

  // 7月
  add(7, getNthMonday(year, 7, 3), '海の日');

  // 8月
  if (year >= 2016) {
    add(8, 11, '山の日');
  }

  // 9月
  const respectDay = getNthMonday(year, 9, 3);
  add(9, respectDay, '敬老の日');
  const autumnalDay = getAutumnalEquinoxDay(year);
  add(9, autumnalDay, '秋分の日');

  // 国民の休日判定（敬老の日と秋分の日に挟まれた火曜日：シルバーウィーク）
  if (autumnalDay - respectDay === 2) {
    add(9, respectDay + 1, '国民の休日');
  }

  // 10月
  add(10, getNthMonday(year, 10, 2), 'スポーツの日');

  // 11月
  add(11, 3, '文化の日');
  add(11, 23, '勤労感謝の日');

  // 振替休日の判定
  // 祝日が日曜日に当たる場合、その日後において最も近い「国民の祝日でない日」を振替休日とする
  const entries = Array.from(holidayMap.entries());
  for (const [dateStr, _name] of entries) {
    const [y, m, d] = dateStr.split('-').map(Number);
    const dateObj = new Date(y, m - 1, d);
    if (dateObj.getDay() === 0) { // 日曜日
      let substituteDate = new Date(y, m - 1, d + 1);
      let subKey = formatDateKey(
        substituteDate.getFullYear(),
        substituteDate.getMonth() + 1,
        substituteDate.getDate()
      );
      // 連続する祝日がある場合は次の平日を探す
      while (holidayMap.has(subKey)) {
        substituteDate.setDate(substituteDate.getDate() + 1);
        subKey = formatDateKey(
          substituteDate.getFullYear(),
          substituteDate.getMonth() + 1,
          substituteDate.getDate()
        );
      }
      holidayMap.set(subKey, '振替休日');
    }
  }

  return holidayMap;
}

/**
 * 特定の日付の祝日名を取得（祝日でない場合は null）
 */
export function getHolidayName(date: Date): string | null {
  const year = date.getFullYear();
  const holidays = getHolidaysForYear(year);
  const key = formatDateKey(year, date.getMonth() + 1, date.getDate());
  return holidays.get(key) || null;
}
