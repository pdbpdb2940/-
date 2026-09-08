import { CalendarDay, ShiftRecord } from '../types';
import { WEEK_DAYS_JA } from './constants';

/**
 * 曜日を取得 (0=日, 1=月... 6=土) を日本語曜日に変換
 */
function getDayOfWeekJa(dateStr: string): string {
  const [y, m, d] = dateStr.split('-').map(Number);
  const date = new Date(y, m - 1, d);
  const dayIndex = date.getDay(); // 0 is Sun
  const map = ['日', '月', '火', '水', '木', '金', '土'];
  return map[dayIndex] || '';
}

/**
 * シフト一覧をCSV文字列（UTF-8 BOM付き）に変換
 */
export function exportShiftsToCsv(shifts: ShiftRecord[], filenamePrefix = '早出シフト表'): void {
  // ソート：日付順、開始時間順
  const sorted = [...shifts].sort((a, b) => {
    if (a.date !== b.date) return a.date.localeCompare(b.date);
    return a.startTime.localeCompare(b.startTime);
  });

  const headers = ['日付', '曜日', '担当者', '開始時間', '終了時間', '備考'];
  const rows = sorted.map((s) => [
    s.date,
    getDayOfWeekJa(s.date),
    `"${(s.staffName || '').replace(/"/g, '""')}"`,
    s.startTime,
    s.endTime,
    `"${(s.note || '').replace(/"/g, '""')}"`,
  ]);

  const csvContent = [headers.join(','), ...rows.map((r) => r.join(','))].join('\r\n');

  // Excel等で文字化けしないよう UTF-8 BOM (0xEF, 0xBB, 0xBF) を付与
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `${filenamePrefix}_${new Date().toISOString().slice(0, 10)}.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * カレンダーの配置状態（月〜日の7列マトリクス）をそのまま維持したCSVを出力
 */
export function exportCalendarCsv(
  calendarDays: CalendarDay[],
  year: number,
  month: number,
  includeTime = true,
  monthNote?: string
): void {
  const lines: string[] = [];

  // タイトル行
  lines.push(`"${year}年${month}月 施設管理 早出シフト表 (カレンダー配置)","出勤時間: 7:30～16:15","出力日: ${new Date().toLocaleDateString('ja-JP')}"`);
  lines.push(''); // 空行

  // 曜日ヘッダー
  lines.push(WEEK_DAYS_JA.map((w) => `"${w}曜日"`).join(','));

  // 7日単位（週ごと）に分割して出力
  for (let i = 0; i < calendarDays.length; i += 7) {
    const week = calendarDays.slice(i, i + 7);

    // 1. 日付行 (例: "9/1", "9/15 (敬老の日)")
    const dateRow = week.map((d) => {
      const [_, m, dayNum] = d.dateString.split('-').map(Number);
      let label = `${m}/${dayNum}`;
      if (d.holidayName) {
        label += ` (${d.holidayName})`;
      }
      if (!d.isCurrentMonth) {
        label = `[前月/翌月] ${label}`;
      }
      return `"${label}"`;
    });
    lines.push(dateRow.join(','));

    // 2. 担当者・出勤時刻行 (例: "早出: 神谷 [出勤 07:30～16:15]")
    const shiftRow = week.map((d) => {
      if (d.shifts.length === 0) {
        return `"-"`;
      }
      const textList = d.shifts.map((s) => {
        if (includeTime) {
          return `早出: ${s.staffName} (出勤 ${s.startTime}～${s.endTime})`;
        }
        return `早出: ${s.staffName}`;
      });
      return `"${textList.join(' / ')}"`;
    });
    lines.push(shiftRow.join(','));

    // 3. 備考行 (もし備考があれば出力)
    const hasAnyNote = week.some((d) => d.shifts.some((s) => Boolean(s.note)));
    if (hasAnyNote) {
      const noteRow = week.map((d) => {
        const notes = d.shifts.map((s) => s.note).filter(Boolean);
        return notes.length > 0 ? `"備考: ${notes.join(', ')}"` : `""`;
      });
      lines.push(noteRow.join(','));
    }

    lines.push(''); // 週ごとの区切り空行
  }

  // 月間集計サマリー（誰が何回早出に入っているか）
  const staffCounts: Record<string, number> = {};
  calendarDays.forEach((d) => {
    if (d.isCurrentMonth) {
      d.shifts.forEach((s) => {
        staffCounts[s.staffName] = (staffCounts[s.staffName] || 0) + 1;
      });
    }
  });

  lines.push('"【当月 早出担当回数集計】"');
  Object.entries(staffCounts).forEach(([name, count]) => {
    lines.push(`"${name} さん","${count} 回"`);
  });

  // 連絡事項・申し送りメモがある場合はCSV末尾に追記
  if (monthNote && monthNote.trim()) {
    lines.push('');
    lines.push(`"【当月 連絡事項・申し送りメモ】"`);
    const noteLines = monthNote.trim().split('\n');
    noteLines.forEach((nl) => {
      lines.push(`"${nl.replace(/"/g, '""')}"`);
    });
  }

  const csvContent = lines.join('\r\n');

  // Excel等で文字化けしないよう UTF-8 BOM (0xEF, 0xBB, 0xBF) を付与
  const bom = '\uFEFF';
  const blob = new Blob([bom + csvContent], { type: 'text/csv;charset=utf-8;' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = `早出シフト表_カレンダー形式_${year}年${month}月.csv`;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

/**
 * CSVテキストをパースしてShiftRecordの配列に変換
 */
export function parseShiftsFromCsv(csvText: string): { success: boolean; data: ShiftRecord[]; count: number; error?: string } {
  try {
    // BOMの除去
    let cleanText = csvText;
    if (cleanText.charCodeAt(0) === 0xfeff) {
      cleanText = cleanText.slice(1);
    }

    const lines = cleanText.split(/\r?\n/).filter((l) => l.trim().length > 0);
    if (lines.length <= 1) {
      return { success: false, data: [], count: 0, error: 'CSVにデータ行が含まれていません。' };
    }

    // ヘッダー行をスキップ
    const dataLines = lines.slice(1);
    const parsedRecords: ShiftRecord[] = [];

    for (let i = 0; i < dataLines.length; i++) {
      const line = dataLines[i];
      // 簡易CSVパース（引用符内のカンマに対応）
      const cols = parseCsvLine(line);

      // 期待カラム: [0]日付, [1]曜日(任意), [2]担当者, [3]開始時間, [4]終了時間, [5]備考
      if (cols.length < 3) continue;

      let date = cols[0]?.trim();
      // 日付の正規化 (YYYY/MM/DD -> YYYY-MM-DD)
      date = date.replace(/\//g, '-');

      // 日付形式チェック
      if (!/^\d{4}-\d{1,2}-\d{1,2}$/.test(date)) {
        continue;
      }
      // 0埋め整形
      const [y, m, d] = date.split('-').map(Number);
      date = `${y}-${String(m).padStart(2, '0')}-${String(d).padStart(2, '0')}`;

      // カラム位置判定（曜日列がある場合とない場合の柔軟な対応）
      let staffName = '';
      let startTime = '07:30';
      let endTime = '16:15';
      let note = '';

      if (cols.length >= 6) {
        // [日付, 曜日, 担当者, 開始, 終了, 備考]
        staffName = cols[2]?.trim() || '';
        startTime = cols[3]?.trim() || '07:30';
        endTime = cols[4]?.trim() || '16:15';
        note = cols[5]?.trim() || '';
      } else if (cols.length === 5) {
        // [日付, 担当者, 開始, 終了, 備考] または [日付, 曜日, 担当者, 開始, 終了]
        if (WEEK_DAYS_JA.includes(cols[1]?.trim() as any)) {
          staffName = cols[2]?.trim() || '';
          startTime = cols[3]?.trim() || '07:30';
          endTime = cols[4]?.trim() || '16:15';
        } else {
          staffName = cols[1]?.trim() || '';
          startTime = cols[2]?.trim() || '07:30';
          endTime = cols[3]?.trim() || '16:15';
          note = cols[4]?.trim() || '';
        }
      } else if (cols.length >= 2) {
        staffName = cols[1]?.trim() || '';
      }

      if (!staffName) continue;

      parsedRecords.push({
        id: `csv-${Date.now()}-${i}-${Math.random().toString(36).substr(2, 5)}`,
        date,
        staffName,
        startTime: startTime || '07:30',
        endTime: endTime || '16:15',
        note,
        createdAt: Date.now(),
      });
    }

    if (parsedRecords.length === 0) {
      return { success: false, data: [], count: 0, error: '有効なシフトデータを読み取れませんでした。' };
    }

    return { success: true, data: parsedRecords, count: parsedRecords.length };
  } catch (err: any) {
    return { success: false, data: [], count: 0, error: `パースエラー: ${err.message || '不明なエラー'}` };
  }
}

/**
 * クォートに対応した1行パース
 */
function parseCsvLine(line: string): string[] {
  const result: string[] = [];
  let current = '';
  let inQuotes = false;

  for (let i = 0; i < line.length; i++) {
    const char = line[i];
    if (char === '"') {
      if (inQuotes && line[i + 1] === '"') {
        current += '"';
        i++;
      } else {
        inQuotes = !inQuotes;
      }
    } else if (char === ',' && !inQuotes) {
      result.push(current);
      current = '';
    } else {
      current += char;
    }
  }
  result.push(current);
  return result;
}
