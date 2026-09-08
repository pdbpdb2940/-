import { CalendarDay, ShiftRecord, StaffMember } from '../types';
import { WEEK_DAYS_JA } from './constants';
import { computeWeekShiftBars, computeWeekTracks } from './shiftContinuity';

export interface PrintOptions {
  year: number;
  month: number;
  calendarDays: CalendarDay[];
  staffList: StaffMember[];
  mergeConsecutive: boolean;
  timeDisplayMode?: 'startTimeOnly' | 'fullRange'; // '出勤 7:30' または '7:30～16:15'
  monthNote?: string; // カレンダー下部の連絡事項・申し送りメモ
}

/**
 * 印刷用の自己完結型HTML文字列を生成
 * A4横向き1枚にぴったり収まり、カレンダーの状態、出勤時刻、連続シフト結合を完全に維持
 */
export function generatePrintHtml(options: PrintOptions): string {
  const {
    year,
    month,
    calendarDays,
    staffList,
    mergeConsecutive,
    timeDisplayMode = 'fullRange',
    monthNote = '',
  } = options;

  const allShifts = calendarDays.flatMap((d) => d.shifts);

  // 7日単位（週ごと）に分割
  const weeks: CalendarDay[][] = [];
  for (let i = 0; i < calendarDays.length; i += 7) {
    weeks.push(calendarDays.slice(i, i + 7));
  }

  // 職員名ごとのカラーマップ
  const staffColorMap: Record<string, { bg: string; text: string; border: string }> = {};
  staffList.forEach((s) => {
    // 印刷用の実効カラー（明るめの背景、濃い文字、境界線）
    staffColorMap[s.name] = {
      bg: s.colorBg.includes('blue') ? '#dbeafe' :
          s.colorBg.includes('emerald') ? '#d1fae5' :
          s.colorBg.includes('amber') ? '#fef3c7' :
          s.colorBg.includes('purple') ? '#ede9fe' :
          s.colorBg.includes('rose') ? '#ffe4e6' :
          s.colorBg.includes('teal') ? '#ccfbf1' :
          s.colorBg.includes('indigo') ? '#e0e7ff' : '#f1f5f9',
      text: '#0f172a',
      border: '#334155',
    };
  });

  // 各週のHTMLを生成
  const weeksHtml = weeks.map((weekDays, weekIdx) => {
    const bars = computeWeekShiftBars(
      weekDays,
      weekIdx,
      calendarDays,
      allShifts,
      mergeConsecutive,
      staffList
    );
    const tracks = computeWeekTracks(bars);

    // 日付ヘッダーセル
    const dateHeaders = weekDays.map((day, colIdx) => {
      const isSun = colIdx === 6;
      const isSat = colIdx === 5;
      const isSunOrHoliday = isSun || Boolean(day.holidayName);

      let dateColor = '#0f172a';
      if (!day.isCurrentMonth) {
        dateColor = '#94a3b8';
      } else if (isSunOrHoliday) {
        dateColor = '#dc2626';
      } else if (isSat) {
        dateColor = '#2563eb';
      }

      return `
        <div style="flex: 1; padding: 2px 4px; border-right: 1px solid #cbd5e1; display: flex; justify-content: space-between; align-items: center; background: ${
          !day.isCurrentMonth ? '#f8fafc' : isSunOrHoliday ? '#fff1f2' : isSat ? '#eff6ff' : '#ffffff'
        };">
          <span style="font-weight: 800; font-size: 13px; color: ${dateColor};">${day.dayNumber}</span>
          ${day.holidayName ? `<span style="font-size: 9px; font-weight: 700; color: #b91c1c; background: #fee2e2; padding: 1px 3px; border-radius: 3px; border: 0.5px solid #fca5a5;">${day.holidayName}</span>` : ''}
        </div>
      `;
    }).join('');

    // シフトバー（トラック）
    const tracksHtml = tracks.map((track) => {
      // 7カラムのグリッドで表現
      const itemsHtml = track.bars.map((bar) => {
        const leftPercent = (bar.startCol / 7) * 100;
        const widthPercent = (bar.span / 7) * 100;
        const isAbs = Boolean(bar.isAbsence) || bar.startTime === '終日' || !bar.endTime || Boolean(bar.absenceType);
        const rawAbsType = bar.absenceType || (isAbs ? (bar.note?.includes('出張') ? '出張' : bar.note?.includes('研修') ? '研修' : '休み') : undefined);
        const absType = rawAbsType || (isAbs ? '休み' : undefined);

        let colStyle = staffColorMap[bar.staffName] || { bg: '#f1f5f9', text: '#000', border: '#475569' };
        let absenceBadgeText = '';

        if (isAbs) {
          if (absType === '出張') {
            colStyle = { bg: '#fef3c7', text: '#78350f', border: '#f59e0b' };
            absenceBadgeText = '💼出張';
          } else if (absType === '研修') {
            colStyle = { bg: '#e0e7ff', text: '#312e81', border: '#6366f1' };
            absenceBadgeText = '🎓研修';
          } else if (absType === '休み') {
            colStyle = { bg: '#ffe4e6', text: '#881337', border: '#f43f5e' };
            absenceBadgeText = '🏖️休み';
          } else {
            colStyle = { bg: '#f1f5f9', text: '#0f172a', border: '#64748b' };
            absenceBadgeText = `📌${absType || '不在'}`;
          }
        }

        const isAllDay = bar.startTime === '終日' || !bar.endTime;
        const timeText = isAbs
          ? (isAllDay ? `終日${absType}` : `${bar.startTime}～${bar.endTime}`)
          : isAllDay
          ? '終日'
          : timeDisplayMode === 'startTimeOnly'
          ? `出勤 ${bar.startTime}`
          : `${bar.startTime}～${bar.endTime}`;

        const streakBadge = bar.isStreak && bar.span >= 2
          ? `<span style="background: rgba(255,255,255,0.9); border: 1px solid #475569; font-size: 9px; font-weight: 700; padding: 1px 4px; border-radius: 3px; margin-left: auto;">${bar.totalStreakDays}日連続${isAbs ? absType || '' : ''}</span>`
          : '';

        const prevMark = bar.continuesFromPrevWeek
          ? `<span style="font-size: 9px; font-weight: 800; color: ${isAbs ? '#d97706' : '#1d4ed8'}; margin-right: 2px;">◀前週</span>`
          : '';

        const nextMark = bar.continuesToNextWeek
          ? `<span style="font-size: 9px; font-weight: 800; color: ${isAbs ? '#d97706' : '#1d4ed8'}; margin-left: 2px;">次週▶</span>`
          : '';

        const borderStyle = isAbs && bar.absenceType === '休み' ? 'dashed' : 'solid';

        return `
          <div style="
            position: absolute;
            left: calc(${leftPercent}% + 2px);
            width: calc(${widthPercent}% - 4px);
            top: 2px;
            bottom: 2px;
            background: ${colStyle.bg};
            border: 1.5px ${borderStyle} ${colStyle.border};
            border-radius: ${bar.continuesFromPrevWeek ? '0' : '4px'} ${bar.continuesToNextWeek ? '0' : '4px'} ${bar.continuesToNextWeek ? '0' : '4px'} ${bar.continuesFromPrevWeek ? '0' : '4px'};
            display: flex;
            align-items: center;
            padding: 0 6px;
            font-size: 11px;
            font-weight: 800;
            color: ${colStyle.text};
            box-sizing: border-box;
            overflow: hidden;
            white-space: nowrap;
          ">
            ${prevMark}
            ${absenceBadgeText ? `<span style="font-size: 9.5px; font-weight: 900; background: rgba(255,255,255,0.9); padding: 1px 3px; border-radius: 3px; border: 0.5px solid ${colStyle.border}; margin-right: 3px;">${absenceBadgeText}</span>` : ''}
            <span style="font-size: 11.5px; margin-right: 4px; font-weight: 900;">${bar.staffName}</span>
            <span style="font-size: 10px; font-weight: 800; color: #1e293b; background: rgba(255,255,255,0.85); padding: 1px 4px; border-radius: 3px; border: 0.5px solid #64748b; font-family: monospace;">${timeText}</span>
            ${bar.note ? `<span style="font-size: 9.5px; font-weight: normal; color: #334155; margin-left: 4px;">(${bar.note})</span>` : ''}
            ${streakBadge}
            ${nextMark}
          </div>
        `;
      }).join('');

      return `
        <div style="position: relative; height: 26px; margin-bottom: 2px;">
          ${itemsHtml}
        </div>
      `;
    }).join('');

    return `
      <div style="display: flex; flex-direction: column; min-height: 95px; border-bottom: 1.5px solid #475569; position: relative;">
        <!-- 日付ヘッダー -->
        <div style="display: flex; height: 22px; border-bottom: 1px solid #cbd5e1;">
          ${dateHeaders}
        </div>

        <!-- 7カラム縦境界線用背景 -->
        <div style="position: absolute; top: 22px; bottom: 0; left: 0; right: 0; display: flex; pointer-events: none;">
          ${weekDays.map((d, cIdx) => `
            <div style="flex: 1; border-right: 1px solid #cbd5e1; background: ${
              !d.isCurrentMonth ? '#fafafa' : cIdx === 6 ? '#fff1f2' : cIdx === 5 ? '#eff6ff' : '#ffffff'
            };"></div>
          `).join('')}
        </div>

        <!-- シフトバースペース -->
        <div style="position: relative; z-index: 2; padding: 2px 0; flex: 1;">
          ${tracksHtml}
        </div>
      </div>
    `;
  }).join('');

  // 曜日ヘッダー
  const weekDayHeaderHtml = WEEK_DAYS_JA.map((w, idx) => {
    const isSat = idx === 5;
    const isSun = idx === 6;
    const color = isSun ? '#dc2626' : isSat ? '#2563eb' : '#0f172a';
    const bg = isSun ? '#fee2e2' : isSat ? '#dbeafe' : '#f1f5f9';
    return `
      <div style="flex: 1; text-align: center; padding: 6px 0; font-weight: 800; font-size: 13px; color: ${color}; background: ${bg}; border-right: 1px solid #475569;">
        ${w}曜日
      </div>
    `;
  }).join('');

  return `
<!DOCTYPE html>
<html lang="ja">
<head>
  <meta charset="UTF-8">
  <title>施設管理 早出シフト表 - ${year}年${month}月</title>
  <style>
    @page {
      size: A4 landscape;
      margin: 8mm 6mm;
    }
    * {
      box-sizing: border-box;
      -webkit-print-color-adjust: exact !important;
      print-color-adjust: exact !important;
    }
    body {
      font-family: -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", "Hiragino Sans", "Meiryo", sans-serif;
      margin: 0;
      padding: 0;
      background: #ffffff;
      color: #0f172a;
    }
    .print-wrapper {
      width: 100%;
      height: 100%;
      display: flex;
      flex-direction: column;
    }
    .print-header {
      display: flex;
      justify-content: space-between;
      align-items: flex-end;
      border-bottom: 2.5px solid #0f172a;
      padding-bottom: 4px;
      margin-bottom: 4px;
    }
    .print-title {
      font-size: 20px;
      font-weight: 900;
      letter-spacing: -0.5px;
    }
    .print-info {
      font-size: 11px;
      font-weight: 700;
      color: #334155;
    }
    .calendar-container {
      border: 2px solid #0f172a;
      display: flex;
      flex-direction: column;
      flex: 1;
    }
    .weekday-bar {
      display: flex;
      border-bottom: 2px solid #0f172a;
    }
    .weekday-bar > div:last-child {
      border-right: none;
    }
  </style>
</head>
<body>
  <div class="print-wrapper">
    <!-- タイトル部 -->
    <div class="print-header">
      <div>
        <span class="print-title">施設管理 早出シフト表（${year}年 ${month}月）</span>
      </div>
      <div class="print-info">
        出勤時間: <strong>07:30 ～ 16:15</strong> ｜ 作成日: ${new Date().toLocaleDateString('ja-JP')}
      </div>
    </div>

    <!-- カレンダー本体 -->
    <div class="calendar-container">
      <div class="weekday-bar">
        ${weekDayHeaderHtml}
      </div>
      <div>
        ${weeksHtml}
      </div>
    </div>

    <!-- カレンダー下部：連絡事項・申し送りメモ記入欄 -->
    <div style="margin-top: 6px; border: 1.5px solid #0f172a; border-radius: 4px; overflow: hidden; background: #ffffff;">
      <div style="background: #f1f5f9; padding: 2px 8px; font-weight: 800; font-size: 11px; border-bottom: 1px solid #0f172a; display: flex; justify-content: space-between; align-items: center; color: #0f172a;">
        <span>【${year}年${month}月 連絡事項・申し送りメモ】</span>
        <span style="font-size: 9.5px; font-weight: 700; color: #475569;">施設管理課 ｜ 早出開館・設備巡回指示</span>
      </div>
      <div style="padding: 5px 8px; font-size: 10.5px; line-height: 1.5; color: #0f172a; min-height: 44px; white-space: pre-wrap; font-family: inherit;">
        ${
          monthNote.trim()
            ? monthNote.replace(/</g, '&lt;').replace(/>/g, '&gt;')
            : '<span style="color: #94a3b8; font-style: italic;">（連絡事項・申し送り事項記入欄）</span>'
        }
      </div>
    </div>

    <!-- 印刷フッター（凡例・備考） -->
    <div style="display: flex; justify-content: space-between; align-items: center; margin-top: 4px; font-size: 10px; color: #475569;">
      <span>※ 早出勤務者は 07:30 までに出勤し、開館準備および巡回点検を行ってください。【凡例】🏖️ 休み ｜ 💼 出張 ｜ 🎓 研修</span>
      <span>連続シフト結合表示: ${mergeConsecutive ? 'ON' : 'OFF'}</span>
    </div>
  </div>
</body>
</html>
  `;
}

/**
 * 印刷実行ヘルパー関数
 * iframe環境でもブロックされないよう、複数方式（印刷専用ウィンドウ/隠しiframe/直接print）をサポート
 */
export function executePrint(options: PrintOptions, openInNewTab = false): boolean {
  const html = generatePrintHtml(options);

  if (openInNewTab) {
    // 別タブで開いて即座に印刷ダイアログを起動
    const win = window.open('', '_blank');
    if (win) {
      win.document.open();
      win.document.write(html);
      win.document.close();
      win.focus();
      setTimeout(() => {
        try {
          win.print();
        } catch (e) {
          console.error('Print window error', e);
        }
      }, 300);
      return true;
    }
  }

  // 隠しiframeによるインライン印刷
  try {
    let printIframe = document.getElementById('print-service-iframe') as HTMLIFrameElement;
    if (!printIframe) {
      printIframe = document.createElement('iframe');
      printIframe.id = 'print-service-iframe';
      printIframe.style.position = 'fixed';
      printIframe.style.right = '0';
      printIframe.style.bottom = '0';
      printIframe.style.width = '0';
      printIframe.style.height = '0';
      printIframe.style.border = '0';
      document.body.appendChild(printIframe);
    }

    const doc = printIframe.contentWindow?.document || printIframe.contentDocument;
    if (doc) {
      doc.open();
      doc.write(html);
      doc.close();

      setTimeout(() => {
        printIframe.contentWindow?.focus();
        printIframe.contentWindow?.print();
      }, 250);
      return true;
    }
  } catch (err) {
    console.warn('Hidden iframe print failed, falling back to window.print()', err);
  }

  // 最後のフォールバック：標準 window.print()
  try {
    window.focus();
    window.print();
    return true;
  } catch (e) {
    console.error('All print methods failed', e);
    return false;
  }
}
