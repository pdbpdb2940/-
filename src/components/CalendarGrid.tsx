import React, { useState, useMemo } from 'react';
import { CalendarDay, StaffMember, TaskSchedule } from '../types';
import { WEEK_DAYS_JA } from '../utils/constants';
import {
  computeWeekShiftBars,
  computeWeekTracks,
  WeekShiftBar,
} from '../utils/shiftContinuity';
import { Plus, Link2 } from 'lucide-react';

interface CalendarGridProps {
  days: CalendarDay[];
  currentYear: number;
  currentMonth: number;
  staffList: StaffMember[];
  mergeConsecutive?: boolean;
  onToggleMergeConsecutive?: () => void;
  onSelectDay: (day: CalendarDay) => void;
  onAddShiftToDay: (day: CalendarDay, e: React.MouseEvent) => void;
  onSelectTask?: (task: TaskSchedule, day: CalendarDay) => void;
}

export const CalendarGrid: React.FC<CalendarGridProps> = ({
  days,
  currentYear,
  currentMonth,
  staffList,
  mergeConsecutive: controlledMergeConsecutive,
  onToggleMergeConsecutive,
  onSelectDay,
  onAddShiftToDay,
  onSelectTask,
}) => {
  // 連続シフトを結合して帯状に表示するかどうかのトグル（親からの制御または内部state）
  const [internalMergeConsecutive, setInternalMergeConsecutive] = useState<boolean>(true);
  const mergeConsecutive =
    controlledMergeConsecutive !== undefined ? controlledMergeConsecutive : internalMergeConsecutive;

  const handleToggleMerge = () => {
    if (onToggleMergeConsecutive) {
      onToggleMergeConsecutive();
    } else {
      setInternalMergeConsecutive((prev) => !prev);
    }
  };

  // 全シフト一覧を収集
  const allShifts = useMemo(() => {
    return days.flatMap((d) => d.shifts);
  }, [days]);

  // カレンダーの日付（35日または42日）を週（7日）単位に分割
  const weeks = useMemo(() => {
    const result: CalendarDay[][] = [];
    for (let i = 0; i < days.length; i += 7) {
      result.push(days.slice(i, i + 7));
    }
    return result;
  }, [days]);

  // 職員名から色設定を取得するヘルパー
  const getStaffStyle = (name: string) => {
    const staff = staffList.find((s) => s.name === name);
    if (staff) {
      return {
        bg: staff.colorBg,
        text: staff.colorText,
        border: staff.colorBorder,
      };
    }
    return {
      bg: 'bg-slate-100',
      text: 'text-slate-800',
      border: 'border-slate-300',
    };
  };

  // 連結インジケーター（バー）をクリックした際、クリック位置に応じた日付を特定して選択
  const handleBarClick = (
    bar: WeekShiftBar,
    weekDays: CalendarDay[],
    e: React.MouseEvent<HTMLDivElement>
  ) => {
    e.stopPropagation();
    const rect = e.currentTarget.getBoundingClientRect();
    const ratio = Math.max(0, Math.min(0.999, (e.clientX - rect.left) / rect.width));
    const offset = Math.floor(ratio * bar.span);
    const clickedDay = weekDays[bar.startCol + offset] || bar.targetDay;
    onSelectDay(clickedDay);
  };

  return (
    <div className="w-full flex-1 flex flex-col">
      {/* 印刷用ヘッダー（通常画面では非表示、印刷時のみ大きく上部に表示） */}
      <div className="hidden print:block mb-3 border-b-2 border-black pb-2">
        <div className="flex justify-between items-baseline">
          <h1 className="text-2xl font-black text-black">
            施設管理 早出シフト表（{currentYear}年 {currentMonth}月）
          </h1>
          <div className="text-xs text-slate-700">
            勤務時間: 7:30～16:15 ｜ 作成日: {new Date().toLocaleDateString('ja-JP')}
          </div>
        </div>
      </div>

      {/* カレンダー上部ツールバー（通常画面のみ） */}
      <div className="flex items-center justify-between pb-2 px-1 print:hidden flex-wrap gap-2">
        <div className="flex items-center gap-3 flex-wrap">
          <div className="text-xs text-slate-600 font-medium flex items-center gap-1.5">
            <span className="inline-block w-2 h-2 rounded-full bg-blue-600"></span>
            <span>日付マスをクリックして登録・編集できます</span>
          </div>

          {/* 視覚的凡例 */}
          <div className="hidden sm:flex items-center gap-1.5 text-[11px] text-slate-600">
            <span className="font-semibold text-slate-400">凡例:</span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-blue-50 text-blue-700 border border-blue-200 font-bold">
              <span className="w-1.5 h-1.5 rounded-full bg-blue-500" />
              早出
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-rose-50 text-rose-700 border border-rose-200 border-dashed font-bold">
              <span>🏖️</span>
              休み
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-amber-50 text-amber-800 border border-amber-300 font-bold">
              <span>💼</span>
              出張
            </span>
            <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded bg-indigo-50 text-indigo-800 border border-indigo-200 font-bold">
              <span>🎓</span>
              研修
            </span>
          </div>
        </div>

        {/* 連続シフト結合トグルボタン */}
        <button
          type="button"
          onClick={handleToggleMerge}
          className={`inline-flex items-center gap-1.5 text-xs px-3 py-1 rounded-md border font-semibold transition-all cursor-pointer ${
            mergeConsecutive
              ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
              : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
          }`}
          title="同一職員の連続した早出勤務を帯状に連結・結合して表示します"
        >
          <Link2 className="w-3.5 h-3.5" />
          <span>連続シフト結合: {mergeConsecutive ? 'ON' : 'OFF'}</span>
        </button>
      </div>

      {/* カレンダーテーブル全体コンテナ */}
      <div className="bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden print:border-black print:rounded-none print:shadow-none flex-1 flex flex-col">
        {/* 曜日ヘッダー（月～日） */}
        <div className="grid grid-cols-7 border-b border-slate-300 print:border-black bg-slate-100 print:bg-white text-center font-bold text-sm sm:text-base select-none">
          {WEEK_DAYS_JA.map((dayName, idx) => {
            const isSat = idx === 5;
            const isSun = idx === 6;
            return (
              <div
                key={dayName}
                className={`py-2 sm:py-2.5 border-r last:border-r-0 border-slate-300 print:border-black ${
                  isSat
                    ? 'bg-blue-100/70 text-blue-800 print:text-blue-900 print:bg-blue-50'
                    : isSun
                    ? 'bg-rose-100/70 text-rose-800 print:text-rose-900 print:bg-rose-50'
                    : 'text-slate-800'
                }`}
              >
                {dayName}
              </div>
            );
          })}
        </div>

        {/* 週ごとの行コンテナ */}
        <div className="flex-1 flex flex-col divide-y divide-slate-200 print:divide-black">
          {weeks.map((weekDays, weekIdx) => {
            // この週のシフトバー一覧およびトラック（行）を算出
            const bars = computeWeekShiftBars(
              weekDays,
              weekIdx,
              days,
              allShifts,
              mergeConsecutive,
              staffList
            );
            const tracks = computeWeekTracks(bars);

            return (
              <div
                key={`week-${weekIdx}`}
                className="relative flex-1 min-h-[105px] sm:min-h-[120px] flex flex-col"
              >
                {/* 1. 背景グリッド（7日分の縦枠線と背景色） */}
                <div className="absolute inset-0 grid grid-cols-7 pointer-events-none">
                  {weekDays.map((day) => {
                    const isSat = day.isSaturday;
                    const isSunOrHoliday = day.isSunday || Boolean(day.holidayName);

                    let cellBg = 'bg-white';
                    if (!day.isCurrentMonth) {
                      cellBg = 'bg-slate-50/70 print:bg-white';
                    } else if (isSunOrHoliday) {
                      cellBg = 'bg-rose-50/25';
                    } else if (isSat) {
                      cellBg = 'bg-blue-50/25';
                    }

                    return (
                      <div
                        key={`bg-${day.dateString}`}
                        className={`h-full border-r last:border-r-0 border-slate-200 print:border-slate-300 ${cellBg} ${
                          day.isToday ? 'bg-blue-50/40' : ''
                        }`}
                      />
                    );
                  })}
                </div>

                {/* 2. 日付ヘッダー（日付数字・祝日ラベル・クイック追加ボタン） */}
                <div className="grid grid-cols-7 relative z-10">
                  {weekDays.map((day) => {
                    const isSat = day.isSaturday;
                    const isSunOrHoliday = day.isSunday || Boolean(day.holidayName);

                    return (
                      <div
                        key={`header-${day.dateString}`}
                        onClick={() => onSelectDay(day)}
                        className="p-1 sm:p-1.5 flex items-center justify-between cursor-pointer hover:bg-slate-200/30 transition-colors group/header select-none"
                        title={`${day.dateString}（クリックでシフト登録・編集）`}
                      >
                        <div className="flex items-center gap-1 min-w-0">
                          {/* 日付数字 */}
                          <span
                            className={`text-xs sm:text-sm font-bold leading-none ${
                              !day.isCurrentMonth
                                ? 'text-slate-400 print:text-slate-400'
                                : isSunOrHoliday
                                ? 'text-rose-600'
                                : isSat
                                ? 'text-blue-600'
                                : 'text-slate-900'
                            } ${
                              day.isToday
                                ? 'bg-blue-600 text-white rounded-full w-5 h-5 sm:w-6 sm:h-6 flex items-center justify-center -ml-0.5 shadow-2xs'
                                : ''
                            }`}
                          >
                            {day.dayNumber}
                          </span>

                          {/* 今日バッジ */}
                          {day.isToday && !day.holidayName && (
                            <span className="hidden sm:inline-block text-[9px] font-bold text-blue-700 bg-blue-100 px-1 py-0.2 rounded">
                              今日
                            </span>
                          )}

                          {/* 祝日名バッジ */}
                          {day.holidayName && day.isCurrentMonth && (
                            <span
                              className="text-[9px] sm:text-[10px] font-semibold text-rose-700 bg-rose-100/90 border border-rose-200 px-1 py-0.2 rounded truncate max-w-[65px] sm:max-w-[110px]"
                              title={day.holidayName}
                            >
                              {day.holidayName}
                            </span>
                          )}
                        </div>

                        {/* ホバー時に現れる「早出追加」クイックボタン */}
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            onAddShiftToDay(day, e);
                          }}
                          className="opacity-0 group-hover/header:opacity-100 transition-opacity p-0.5 text-slate-400 hover:text-blue-600 hover:bg-white rounded print:hidden"
                          title={`${day.dateString} に早出を追加`}
                        >
                          <Plus className="w-3.5 h-3.5" />
                        </button>
                      </div>
                    );
                  })}
                </div>

                {/* 3. 連結インジケーター（シフトバー）トラック領域 */}
                <div className="relative z-10 flex flex-col gap-1 sm:gap-1.5 p-1 sm:p-1.5">
                  {tracks.map((track, trackIdx) => (
                    <div
                      key={`track-${trackIdx}`}
                      className="grid grid-cols-7 gap-x-1 sm:gap-x-1.5 h-7 sm:h-8 items-center"
                    >
                      {track.bars.map((bar) => {
                        // isAbsence判定: 明示的フラグ または「終日」または 終了時刻未設定 または absenceType設定済み
                        const isAbs = Boolean(bar.isAbsence) || bar.startTime === '終日' || !bar.endTime || Boolean(bar.absenceType);
                        const defaultStyle = getStaffStyle(bar.staffName);
                        const rawAbsType = bar.absenceType || (isAbs ? (bar.note?.includes('出張') ? '出張' : bar.note?.includes('研修') ? '研修' : '休み') : undefined);
                        const absType = rawAbsType || (isAbs ? '休み' : undefined);

                        // 不在種別に応じた専用スタイル（視覚的に一目で区別）
                        let barStyle = `${defaultStyle.bg} ${defaultStyle.text} ${defaultStyle.border}`;
                        let absenceBadge: { icon: string; text: string; pillColor: string } | null = null;

                        if (isAbs) {
                          if (absType === '出張') {
                            barStyle = 'bg-amber-100/90 text-amber-950 border-amber-400 border-2 font-bold shadow-xs';
                            absenceBadge = { icon: '💼', text: '出張', pillColor: 'bg-amber-600 text-white' };
                          } else if (absType === '研修') {
                            barStyle = 'bg-indigo-100/90 text-indigo-950 border-indigo-400 border-2 font-bold shadow-xs';
                            absenceBadge = { icon: '🎓', text: '研修', pillColor: 'bg-indigo-600 text-white' };
                          } else if (absType === '休み') {
                            barStyle = 'bg-rose-100/95 text-rose-950 border-rose-400 border-dashed border-2 font-bold shadow-xs';
                            absenceBadge = { icon: '🏖️', text: '休み', pillColor: 'bg-rose-600 text-white' };
                          } else {
                            barStyle = 'bg-slate-200 text-slate-900 border-slate-400 border-2 font-bold shadow-xs';
                            absenceBadge = { icon: '📌', text: absType || '不在', pillColor: 'bg-slate-700 text-white' };
                          }
                        }

                        // 連続シフトの左右角丸および週またぎ境界スタイルの計算
                        const leftRounding = bar.continuesFromPrevWeek
                          ? `rounded-l-none border-l-2 ${isAbs ? 'border-l-amber-600' : 'border-l-blue-600'}`
                          : 'rounded-l-md';
                        const rightRounding = bar.continuesToNextWeek
                          ? `rounded-r-none border-r-2 ${isAbs ? 'border-r-amber-600' : 'border-r-blue-600'}`
                          : 'rounded-r-md';

                        const isAllDay = bar.startTime === '終日' || !bar.endTime;
                        const timeDisplay = isAbs
                          ? (isAllDay ? `終日${absType}` : `${bar.startTime}～${bar.endTime}`)
                          : (isAllDay ? '終日' : `${bar.startTime}～${bar.endTime}`);

                        return (
                          <div
                            key={bar.id}
                            style={{
                              gridColumnStart: bar.startCol + 1,
                              gridColumnEnd: bar.endCol + 2,
                            }}
                            onClick={(e) => handleBarClick(bar, weekDays, e)}
                            className={`h-full flex items-center justify-between px-2 sm:px-2.5 text-xs font-semibold cursor-pointer transition-all hover:brightness-95 hover:shadow-xs select-none border shadow-2xs ${barStyle} ${leftRounding} ${rightRounding} print:border-black print:shadow-none min-w-0`}
                            title={`${bar.staffName}さん: ${isAbs ? `【${absType}】` : ''}${timeDisplay}${
                              bar.isStreak ? ` (${bar.totalStreakDays}日間連続${isAbs ? absType : ''})` : ''
                            }${bar.note ? ` [備考: ${bar.note}]` : ''} - クリックで詳細・編集`}
                          >
                            {/* 左側：前週継続マーク / アイコン + 不在バッジ + 職員名 + 時間 */}
                            <div className="flex items-center gap-1 sm:gap-1.5 min-w-0 overflow-hidden whitespace-nowrap">
                              {bar.continuesFromPrevWeek ? (
                                <span
                                  className={`text-[9px] sm:text-[10px] text-white font-bold px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5 ${
                                    isAbs ? 'bg-amber-600' : 'bg-blue-600'
                                  }`}
                                >
                                  ◀ 前週より
                                </span>
                              ) : isAbs && absenceBadge ? (
                                <span className="text-xs shrink-0 leading-none" title={absenceBadge.text}>
                                  {absenceBadge.icon}
                                </span>
                              ) : (
                                <span className="w-1.5 h-1.5 sm:w-2 sm:h-2 rounded-full bg-current opacity-80 shrink-0" />
                              )}

                              {/* 不在種別ラベル（不在時のみ表示） */}
                              {isAbs && absenceBadge && (
                                <span className={`text-[10px] font-bold px-1.5 py-0.2 rounded shrink-0 shadow-2xs ${absenceBadge.pillColor}`}>
                                  {absenceBadge.text}
                                </span>
                              )}

                              {/* 氏名（絶対に省略・非表示にせず必ず表示） */}
                              <span className="font-bold text-xs sm:text-sm shrink-0 whitespace-nowrap">
                                {bar.staffName}
                              </span>

                              {/* 時間または「終日休み」バッジ */}
                              {isAbs ? (
                                <span
                                  className={`text-[10px] sm:text-xs font-bold shrink-0 px-1.5 py-0.2 rounded border whitespace-nowrap ${
                                    isAllDay
                                      ? 'bg-white/95 text-rose-800 border-rose-300 font-extrabold shadow-2xs'
                                      : 'bg-white/90 text-slate-900 border-slate-300 font-mono'
                                  }`}
                                >
                                  {timeDisplay}
                                </span>
                              ) : (
                                <span className="text-[10.5px] sm:text-xs font-mono shrink-0 font-bold bg-white/90 border border-slate-300 px-1 sm:px-1.5 py-0.2 rounded text-slate-900 print:text-black print:border-black whitespace-nowrap">
                                  {timeDisplay}
                                </span>
                              )}

                              {bar.note && bar.span >= 2 && (
                                <span className="text-[10px] opacity-70 truncate max-w-[120px] hidden md:inline">
                                  ({bar.note})
                                </span>
                              )}
                            </div>

                            {/* 右側：連続日数バッジ + 次週継続マーク */}
                            <div className="flex items-center gap-1 shrink-0 ml-1">
                              {bar.isStreak && bar.span >= 2 && (
                                <span className="text-[9px] sm:text-[10px] bg-white/90 border border-current/25 px-1.5 py-0.2 rounded font-bold shadow-2xs whitespace-nowrap">
                                  {bar.totalStreakDays}日連続{isAbs ? absType || '' : ''}
                                </span>
                              )}

                              {bar.continuesToNextWeek && (
                                <span
                                  className={`text-[9px] sm:text-[10px] text-white font-bold px-1 py-0.2 rounded shrink-0 flex items-center gap-0.5 ${
                                    isAbs ? 'bg-amber-600' : 'bg-blue-600'
                                  }`}
                                >
                                  次週へ ▶
                                </span>
                              )}
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  ))}
                </div>

                {/* 4. 各日の業務予定および追加空き領域 */}
                <div className="flex-1 grid grid-cols-7 min-h-[32px] sm:min-h-[40px] relative z-10 px-1 pb-1 gap-1">
                  {weekDays.map((day) => (
                    <div
                      key={`bottom-${day.dateString}`}
                      onClick={() => onSelectDay(day)}
                      className="h-full flex flex-col justify-start gap-1 cursor-pointer hover:bg-blue-50/40 transition-colors group/bottom rounded p-0.5"
                      title={`${day.dateString}（クリックで早出・業務予定を追加）`}
                    >
                      {/* 業務予定一覧 */}
                      {day.tasks && day.tasks.length > 0 && (
                        <div className="flex flex-col gap-1 w-full">
                          {day.tasks.map((task) => (
                            <div
                              key={task.id}
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onSelectTask) {
                                  onSelectTask(task, day);
                                } else {
                                  onSelectDay(day);
                                }
                              }}
                              className="bg-emerald-50 hover:bg-emerald-100 border border-emerald-300 rounded p-1 text-[10.5px] leading-tight shadow-2xs transition-colors select-none text-left"
                              title={`業務: ${task.title}${task.time ? ` (${task.time})` : ''}${task.staffName ? ` 担当: ${task.staffName}` : ''}${task.note ? ` [${task.note}]` : ''}`}
                            >
                              <div className="font-bold text-slate-900 flex items-center gap-0.5 truncate">
                                <span className="text-emerald-700 text-xs leading-none shrink-0">■</span>
                                <span className="truncate">{task.title}</span>
                              </div>
                              {task.time ? (
                                <div className="text-[10px] font-mono font-bold text-slate-700">
                                  {task.time}
                                </div>
                              ) : null}
                              {task.staffName ? (
                                <div className="text-[10px] text-slate-600 font-medium truncate">
                                  担当：{task.staffName}
                                </div>
                              ) : null}
                            </div>
                          ))}
                        </div>
                      )}

                      {/* 予定がない時のホバー追加インジケーター */}
                      {(!day.tasks || day.tasks.length === 0) && (
                        <div className="flex-1 flex items-center justify-center min-h-[22px]">
                          <span className="text-[10px] text-slate-300 group-hover/bottom:text-blue-600 font-medium opacity-0 group-hover/bottom:opacity-100 transition-opacity print:hidden flex items-center gap-0.5">
                            <Plus className="w-3 h-3" /> 追加
                          </span>
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
};
