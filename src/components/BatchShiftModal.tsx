import React, { useState, useMemo, useEffect } from 'react';
import { ShiftRecord, StaffMember } from '../types';
import { DEFAULT_SHIFT_START, DEFAULT_SHIFT_END, WEEK_DAYS_JA } from '../utils/constants';
import { formatDateKey, getHolidayName } from '../utils/holidays';
import {
  CalendarRange,
  X,
  Check,
  Clock,
  User,
  AlertTriangle,
  Trash2,
  CalendarCheck,
  CheckSquare,
  Square,
  Plus,
  RotateCcw,
  Loader2,
} from 'lucide-react';

interface BatchShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentMonth: number;
  staffList: StaffMember[];
  shifts: ShiftRecord[];
  onBatchSave: (
    newShifts: ShiftRecord[],
    mode: 'add' | 'overwrite',
    targetDates: string[]
  ) => Promise<void> | void;
  onBatchDelete: (targetDates: string[], targetStaffName?: string) => Promise<void> | void;
}

export const BatchShiftModal: React.FC<BatchShiftModalProps> = ({
  isOpen,
  onClose,
  currentYear,
  currentMonth,
  staffList,
  shifts,
  onBatchSave,
  onBatchDelete,
}) => {
  // 初期の日付範囲：当月の1日〜末日
  const defaultStartDate = useMemo(() => {
    return formatDateKey(currentYear, currentMonth, 1);
  }, [currentYear, currentMonth]);

  const defaultEndDate = useMemo(() => {
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    return formatDateKey(currentYear, currentMonth, lastDay);
  }, [currentYear, currentMonth]);

  // 期間選択
  const [startDate, setStartDate] = useState<string>(defaultStartDate);
  const [endDate, setEndDate] = useState<string>(defaultEndDate);

  // 祝日除外設定
  const [excludeHolidays, setExcludeHolidays] = useState<boolean>(true);

  // 選択中の日付セット (YYYY-MM-DD)
  const [selectedDates, setSelectedDates] = useState<Set<string>>(new Set());

  // 早出シフト設定
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [startTime, setStartTime] = useState<string>(DEFAULT_SHIFT_START);
  const [endTime, setEndTime] = useState<string>(DEFAULT_SHIFT_END);
  const [note, setNote] = useState<string>('');

  // 登録モード: 'add' (既存に残して追加) または 'overwrite' (対象日のシフトを差し替え)
  const [saveMode, setSaveMode] = useState<'add' | 'overwrite'>('add');

  // 一括削除の確認モード
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);
  const [deleteTargetFilter, setDeleteTargetFilter] = useState<'selectedStaff' | 'all'>('selectedStaff');

  // 完了メッセージ
  const [statusMessage, setStatusMessage] = useState<string | null>(null);

  // 非同期バッチ実行中フラグ
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitProgressText, setSubmitProgressText] = useState<string>('');

  // 既存シフトの日付別マップを事前生成してルックアップを高速化
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, string[]>();
    for (const s of shifts) {
      const existing = map.get(s.date) || [];
      existing.push(s.staffName);
      map.set(s.date, existing);
    }
    return map;
  }, [shifts]);

  // 期間内の全日付を安全に生成（無限ループ防止ガード付き）
  const candidateDates = useMemo(() => {
    if (!startDate || !endDate) return [];

    const [startYear, startMonth, startDay] = startDate.split('-').map(Number);
    const [endYear, endMonth, endDay] = endDate.split('-').map(Number);
    if (!startYear || !startMonth || !startDay || !endYear || !endMonth || !endDay) return [];

    const start = new Date(startYear, startMonth - 1, startDay);
    const end = new Date(endYear, endMonth - 1, endDay);

    if (start.getTime() > end.getTime()) return [];

    const dates: Array<{
      dateString: string;
      dateObj: Date;
      dayOfWeek: number;
      isHoliday: boolean;
      holidayName: string | null;
      hasExistingShift: boolean;
      existingStaffNames: string[];
    }> = [];

    const current = new Date(startYear, startMonth - 1, startDay);
    let loopGuard = 0;
    const MAX_DAYS = 366; // 最大でも1年分までに制限してブラウザハングを防止

    while (current.getTime() <= end.getTime() && loopGuard < MAX_DAYS) {
      loopGuard++;
      const year = current.getFullYear();
      const month = current.getMonth() + 1;
      const day = current.getDate();
      const dateStr = formatDateKey(year, month, day);
      const dayOfWeek = current.getDay();
      const holidayName = getHolidayName(current);
      const isHoliday = !!holidayName;

      const existingStaffNames = shiftsByDate.get(dateStr) || [];

      dates.push({
        dateString: dateStr,
        dateObj: new Date(current),
        dayOfWeek,
        isHoliday,
        holidayName,
        hasExistingShift: existingStaffNames.length > 0,
        existingStaffNames,
      });

      // 翌日へ（ミリ秒ではなく日付メソッドで安全に進める）
      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [startDate, endDate, shiftsByDate]);

  // 選択中の日付一覧（ソート済み配列） - Hookルールに準拠し早期リターン前に呼び出す
  const targetDates = useMemo(() => {
    return Array.from(selectedDates).sort();
  }, [selectedDates]);

  // モーダルが開かれたとき、または期間が切り替わったときにフォーム初期化
  useEffect(() => {
    if (isOpen) {
      setStartDate(defaultStartDate);
      setEndDate(defaultEndDate);
      setExcludeHolidays(true);
      setSelectedStaff(staffList[0]?.name || '神谷');
      setStartTime(DEFAULT_SHIFT_START);
      setEndTime(DEFAULT_SHIFT_END);
      setNote('');
      setSaveMode('add');
      setIsConfirmingDelete(false);
      setStatusMessage(null);
    }
  }, [isOpen, defaultStartDate, defaultEndDate, staffList]);

  // candidateDates が更新されたとき（期間変更など）、初期の平日選択を設定
  useEffect(() => {
    if (candidateDates.length > 0 && isOpen) {
      const initialSelected = new Set<string>();
      candidateDates.forEach((d) => {
        // デフォルトは平日（月〜金）かつ祝日以外
        const isWeekday = d.dayOfWeek >= 1 && d.dayOfWeek <= 5;
        if (isWeekday && (!excludeHolidays || !d.isHoliday)) {
          initialSelected.add(d.dateString);
        }
      });
      setSelectedDates(initialSelected);
    }
  }, [candidateDates.length, startDate, endDate, isOpen, excludeHolidays]);

  // プリセット：当月に設定
  const handleSetCurrentMonth = () => {
    setStartDate(defaultStartDate);
    setEndDate(defaultEndDate);
  };

  // プリセット：翌月に設定
  const handleSetNextMonth = () => {
    const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
    const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
    const sDate = formatDateKey(nextY, nextM, 1);
    const lDay = new Date(nextY, nextM, 0).getDate();
    const eDate = formatDateKey(nextY, nextM, lDay);
    setStartDate(sDate);
    setEndDate(eDate);
  };

  // プリセット選択：平日のみ
  const handleSelectWeekdaysOnly = () => {
    const next = new Set<string>();
    candidateDates.forEach((d) => {
      if (d.dayOfWeek >= 1 && d.dayOfWeek <= 5) {
        if (!excludeHolidays || !d.isHoliday) {
          next.add(d.dateString);
        }
      }
    });
    setSelectedDates(next);
  };

  // プリセット選択：土日のみ
  const handleSelectWeekendsOnly = () => {
    const next = new Set<string>();
    candidateDates.forEach((d) => {
      if (d.dayOfWeek === 6 || d.dayOfWeek === 0) {
        next.add(d.dateString);
      }
    });
    setSelectedDates(next);
  };

  // プリセット選択：全日選択
  const handleSelectAllDays = () => {
    const next = new Set<string>();
    candidateDates.forEach((d) => {
      if (!excludeHolidays || !d.isHoliday) {
        next.add(d.dateString);
      } else {
        next.add(d.dateString);
      }
    });
    setSelectedDates(next);
  };

  // プリセット選択：全解除（0日選択にする）
  const handleClearAllDays = () => {
    setSelectedDates(new Set());
  };

  // 特定曜日のトグル（その曜日の該当する全日付を一括でON / OFF）
  const handleToggleDayOfWeek = (dayIndex: number) => {
    const datesOfThisWeekday = candidateDates.filter((d) => d.dayOfWeek === dayIndex);
    if (datesOfThisWeekday.length === 0) return;

    // 全て選択されているか判定
    const allSelected = datesOfThisWeekday.every((d) => selectedDates.has(d.dateString));

    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (allSelected) {
        // すでに全選択されている場合は解除
        datesOfThisWeekday.forEach((d) => next.delete(d.dateString));
      } else {
        // まだ全選択されていない場合は全て追加（祝日設定を尊重）
        datesOfThisWeekday.forEach((d) => {
          if (!excludeHolidays || !d.isHoliday) {
            next.add(d.dateString);
          }
        });
      }
      return next;
    });
  };

  // 祝日除外設定の切り替え
  const handleToggleExcludeHolidays = (checked: boolean) => {
    setExcludeHolidays(checked);
    if (checked) {
      // 祝日を現在選択中の日付から除外
      setSelectedDates((prev) => {
        const next = new Set(prev);
        candidateDates.forEach((d) => {
          if (d.isHoliday) {
            next.delete(d.dateString);
          }
        });
        return next;
      });
    }
  };

  // 個別日付のトグル（曜日解除状態でも自由にON/OFFできる！）
  const handleToggleIndividualDate = (dateStr: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateStr)) {
        next.delete(dateStr);
      } else {
        next.add(dateStr);
      }
      return next;
    });
  };

  // 一括登録の実行
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (targetDates.length === 0) {
      alert('対象となる日付が選択されていません。日付を選択してください。');
      return;
    }

    if (!selectedStaff) {
      alert('担当職員を選択してください。');
      return;
    }

    setIsSubmitting(true);
    setSubmitProgressText(`早出シフト${targetDates.length}件をバッチ同期中...`);

    try {
      // レンダリングループに制御を戻してスピナーを即座に描画
      await new Promise((resolve) => setTimeout(resolve, 30));

      // 新しいシフトレコード群を生成
      const now = Date.now();
      const newShifts: ShiftRecord[] = targetDates.map((dateStr, idx) => ({
        id: `shift-batch-${now}-${idx}-${Math.random().toString(36).substring(2, 7)}`,
        date: dateStr,
        staffName: selectedStaff,
        startTime,
        endTime,
        note: note.trim() || undefined,
        createdAt: now + idx,
      }));

      await onBatchSave(newShifts, saveMode, targetDates);

      setStatusMessage(`${targetDates.length}日分の早出シフト（${selectedStaff}さん）を一括登録しました！`);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('一括登録エラー:', err);
      alert('一括登録中にエラーが発生しました。もう一度お試しください。');
      setIsSubmitting(false);
    }
  };

  // 一括削除の実行
  const handleExecuteBatchDelete = async () => {
    if (targetDates.length === 0) {
      alert('対象となる日付がありません。');
      return;
    }

    setIsSubmitting(true);
    setSubmitProgressText(`選択した${targetDates.length}日分のシフトを一括削除中...`);

    try {
      await new Promise((resolve) => setTimeout(resolve, 30));

      const staffFilter = deleteTargetFilter === 'selectedStaff' ? selectedStaff : undefined;
      await onBatchDelete(targetDates, staffFilter);

      setStatusMessage(
        staffFilter
          ? `選択した${targetDates.length}日分の「${staffFilter}」さんの早出を削除しました`
          : `選択した${targetDates.length}日分の全早出シフトを削除しました`
      );
      setIsConfirmingDelete(false);
      setTimeout(() => {
        setIsSubmitting(false);
        onClose();
      }, 1000);
    } catch (err) {
      console.error('一括削除エラー:', err);
      alert('一括削除中にエラーが発生しました。');
      setIsSubmitting(false);
    }
  };

  // 曜日ごとの選択状態判定
  const weekDayDefs = [
    { index: 1, label: '月', color: 'text-slate-700' },
    { index: 2, label: '火', color: 'text-slate-700' },
    { index: 3, label: '水', color: 'text-slate-700' },
    { index: 4, label: '木', color: 'text-slate-700' },
    { index: 5, label: '金', color: 'text-slate-700' },
    { index: 6, label: '土', color: 'text-blue-600' },
    { index: 0, label: '日', color: 'text-rose-600' },
  ];

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-xl shadow-2xl border border-slate-200 max-w-2xl w-full overflow-hidden flex flex-col my-auto animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="bg-gradient-to-r from-blue-700 to-indigo-700 text-white px-5 py-4 flex items-center justify-between shadow-xs">
          <div className="flex items-center gap-2.5">
            <div className="bg-white/20 p-2 rounded-lg backdrop-blur-xs">
              <CalendarRange className="w-5 h-5 text-white" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">早出シフト まとめて設定（一括登録）</h2>
              <p className="text-xs text-blue-100">
                期間・曜日・個別の日付を指定して、まとめて担当者を登録・変更できます
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-white/80 hover:text-white p-1.5 hover:bg-white/15 rounded-lg transition-colors cursor-pointer"
            title="閉じる"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 完了トーストメッセージ */}
        {statusMessage && (
          <div className="bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-sm font-bold px-4 py-3 flex items-center gap-2 animate-in fade-in">
            <Check className="w-5 h-5 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* 非同期通信・同期中バナー */}
        {isSubmitting && (
          <div className="bg-blue-50 border-b border-blue-200 text-blue-900 text-sm font-bold px-4 py-3 flex items-center gap-2 animate-pulse">
            <Loader2 className="w-5 h-5 text-blue-600 animate-spin shrink-0" />
            <span>{submitProgressText || 'クラウド（Firestore）と非同期バッチ同期中...'}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="p-4 sm:p-5 space-y-4 sm:space-y-5 text-slate-800 overflow-y-auto max-h-[80vh]">
          {/* STEP 1: 対象期間の指定 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  1
                </span>
                <span>対象期間の指定</span>
              </label>
              <div className="flex items-center gap-1.5">
                <button
                  type="button"
                  onClick={handleSetCurrentMonth}
                  className="px-2.5 py-1 text-xs font-medium text-blue-700 bg-white border border-blue-200 hover:bg-blue-50 rounded transition-colors cursor-pointer"
                >
                  当月 ({currentYear}年{currentMonth}月)
                </button>
                <button
                  type="button"
                  onClick={handleSetNextMonth}
                  className="px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-300 hover:bg-slate-50 rounded transition-colors cursor-pointer"
                >
                  翌月
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
              <div>
                <span className="text-xs text-slate-500 block mb-1">開始日</span>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full text-sm px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
              <div>
                <span className="text-xs text-slate-500 block mb-1">終了日</span>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full text-sm px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
                  required
                />
              </div>
            </div>
          </div>

          {/* STEP 2: 曜日のクイック指定と祝日設定 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                  2
                </span>
                <span>曜日の一括選択（プリセット）</span>
              </label>

              {/* プリセット選択ボタン */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={handleSelectWeekdaysOnly}
                  className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-blue-50 hover:border-blue-300 rounded text-slate-700 font-medium transition-colors cursor-pointer"
                >
                  平日のみ
                </button>
                <button
                  type="button"
                  onClick={handleSelectWeekendsOnly}
                  className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-blue-50 hover:border-blue-300 rounded text-slate-700 font-medium transition-colors cursor-pointer"
                >
                  土日のみ
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllDays}
                  className="px-2.5 py-1 bg-white border border-slate-300 hover:bg-blue-50 hover:border-blue-300 rounded text-slate-700 font-medium transition-colors cursor-pointer"
                >
                  全日選択
                </button>
                <button
                  type="button"
                  onClick={handleClearAllDays}
                  className="px-2.5 py-1 bg-white border border-rose-300 hover:bg-rose-50 text-rose-700 font-medium rounded transition-colors cursor-pointer flex items-center gap-0.5"
                  title="すべての日付選択をクリアして、下で個別に選択できます"
                >
                  <RotateCcw className="w-3 h-3" />
                  <span>解除 (リセット)</span>
                </button>
              </div>
            </div>

            {/* 曜日ボタントグル */}
            <div className="grid grid-cols-7 gap-1.5 pt-1">
              {weekDayDefs.map((day) => {
                const datesOfThisDay = candidateDates.filter((d) => d.dayOfWeek === day.index);
                const selectedCount = datesOfThisDay.filter((d) => selectedDates.has(d.dateString)).length;
                const isFullySelected = datesOfThisDay.length > 0 && selectedCount === datesOfThisDay.length;
                const isPartiallySelected = selectedCount > 0 && selectedCount < datesOfThisDay.length;

                return (
                  <button
                    key={day.index}
                    type="button"
                    onClick={() => handleToggleDayOfWeek(day.index)}
                    className={`py-2 px-1 rounded-md text-xs sm:text-sm font-bold flex flex-col items-center justify-center gap-1 border transition-all cursor-pointer ${
                      isFullySelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-xs'
                        : isPartiallySelected
                        ? 'bg-blue-50 text-blue-800 border-blue-400'
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100'
                    }`}
                    title={`${day.label}曜日: ${selectedCount} / ${datesOfThisDay.length}日 選択中`}
                  >
                    <span className={isFullySelected ? 'text-white' : day.color}>{day.label}</span>
                    {isFullySelected ? (
                      <CheckSquare className="w-3.5 h-3.5 text-blue-200" />
                    ) : isPartiallySelected ? (
                      <span className="text-[10px] font-mono leading-none bg-blue-200 text-blue-900 px-1 rounded">
                        {selectedCount}
                      </span>
                    ) : (
                      <Square className="w-3.5 h-3.5 text-slate-300" />
                    )}
                  </button>
                );
              })}
            </div>

            {/* 祝日除外オプション */}
            <div className="pt-2 border-t border-slate-200 flex items-center justify-between flex-wrap gap-2">
              <label className="inline-flex items-center gap-2 cursor-pointer select-none text-xs sm:text-sm text-slate-700">
                <input
                  type="checkbox"
                  checked={excludeHolidays}
                  onChange={(e) => handleToggleExcludeHolidays(e.target.checked)}
                  className="w-4 h-4 rounded text-blue-600 focus:ring-blue-500 border-slate-300 cursor-pointer"
                />
                <span className="font-medium">日本の祝日・振替休日は自動除外する</span>
              </label>
              <span className="text-[11px] text-slate-400">（祝日は自動でスキップ）</span>
            </div>
          </div>

          {/* STEP 3: 対象日付の個別確認＆自由選択（曜日解除状態でもクリックで自由に設定可能！） */}
          <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 space-y-2.5">
            <div className="flex items-center justify-between flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <CalendarCheck className="w-4 h-4 text-blue-700" />
                <span className="text-xs sm:text-sm font-bold text-blue-950">
                  設定対象日：{' '}
                  <span className="text-blue-700 font-extrabold text-base">
                    {targetDates.length}
                  </span>{' '}
                  日間 / 全 {candidateDates.length} 日
                </span>
              </div>

              {/* 日付個別操作クイックボタン */}
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllDays}
                  className="px-2 py-0.5 bg-white border border-blue-300 text-blue-700 rounded hover:bg-blue-50 transition-colors cursor-pointer font-medium"
                >
                  すべて選択
                </button>
                <button
                  type="button"
                  onClick={handleClearAllDays}
                  className="px-2 py-0.5 bg-white border border-slate-300 text-slate-600 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                >
                  すべて外す
                </button>
              </div>
            </div>

            <p className="text-[11px] text-blue-700 leading-tight">
              💡 <strong>下の日付チップをクリックすると、1日ずつ自由にON / OFFを切り替えられます。</strong>
              <br className="sm:hidden" />
              （曜日を解除した後でも、登録したい日付をクリックして直接選択できます）
            </p>

            {/* 日付チップ一覧（クリックでON/OFF） */}
            <div className="max-h-36 overflow-y-auto p-1.5 bg-white rounded-md border border-blue-200 flex flex-wrap gap-1.5">
              {candidateDates.map((item) => {
                const isSelected = selectedDates.has(item.dateString);
                const dayJa = WEEK_DAYS_JA[(item.dayOfWeek + 6) % 7];
                const isSat = item.dayOfWeek === 6;
                const isSun = item.dayOfWeek === 0;

                return (
                  <button
                    key={item.dateString}
                    type="button"
                    onClick={() => handleToggleIndividualDate(item.dateString)}
                    className={`text-xs px-2.5 py-1.5 rounded-md border transition-all cursor-pointer flex items-center gap-1.5 select-none ${
                      isSelected
                        ? 'bg-blue-600 text-white border-blue-600 shadow-2xs font-bold'
                        : 'bg-white text-slate-700 border-slate-300 hover:border-blue-400 hover:bg-blue-50'
                    }`}
                    title={`${item.dateString} (${dayJa}) ${
                      item.holidayName ? `[祝: ${item.holidayName}]` : ''
                    } ${
                      item.existingStaffNames.length > 0
                        ? `[登録済: ${item.existingStaffNames.join(', ')}]`
                        : ''
                    } - クリックで${isSelected ? '除外' : '選択'}`}
                  >
                    {isSelected ? (
                      <Check className="w-3.5 h-3.5 text-white shrink-0" />
                    ) : (
                      <Plus className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    )}

                    <span className={isSelected ? 'text-white' : isSun ? 'text-rose-600 font-semibold' : isSat ? 'text-blue-600 font-semibold' : ''}>
                      {item.dateString.substring(5)} ({dayJa})
                    </span>

                    {/* 祝日バッジ */}
                    {item.holidayName && (
                      <span
                        className={`text-[10px] px-1 rounded ${
                          isSelected
                            ? 'bg-rose-500 text-white'
                            : 'bg-rose-100 text-rose-700 font-semibold'
                        }`}
                      >
                        祝
                      </span>
                    )}

                    {/* 既存シフトバッジ */}
                    {item.hasExistingShift && (
                      <span
                        className={`text-[10px] px-1 rounded ${
                          isSelected
                            ? 'bg-white/25 text-white'
                            : 'bg-amber-100 text-amber-800 font-medium'
                        }`}
                        title={`既存シフト: ${item.existingStaffNames.join(', ')}`}
                      >
                        済
                      </span>
                    )}
                  </button>
                );
              })}

              {candidateDates.length === 0 && (
                <div className="text-xs text-slate-400 p-2">有効な期間を指定してください</div>
              )}
            </div>

            {targetDates.length === 0 && (
              <div className="text-xs text-amber-800 bg-amber-50 border border-amber-200 p-2 rounded-md flex items-center gap-1.5 font-medium">
                <AlertTriangle className="w-4 h-4 text-amber-600 shrink-0" />
                <span>現在、対象日付が0日です。上記の日付チップをクリックして選択してください。</span>
              </div>
            )}
          </div>

          {/* STEP 4: 登録するシフト内容 */}
          <div className="bg-slate-50 border border-slate-200 rounded-lg p-3.5 space-y-3">
            <label className="text-xs sm:text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <span className="w-5 h-5 rounded-full bg-blue-600 text-white text-xs flex items-center justify-center font-bold">
                4
              </span>
              <span>登録する早出シフトの内容</span>
            </label>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {/* 担当職員選択 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <User className="w-3.5 h-3.5 text-slate-500" />
                  <span>担当職員</span>
                </label>
                <select
                  value={selectedStaff}
                  onChange={(e) => setSelectedStaff(e.target.value)}
                  className="w-full text-sm font-bold px-3 py-2 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 cursor-pointer"
                >
                  {staffList.map((staff) => (
                    <option key={staff.id} value={staff.name}>
                      {staff.name} さん
                    </option>
                  ))}
                </select>
              </div>

              {/* 勤務時間 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-slate-500" />
                  <span>勤務時間（基本: 7:30～16:15）</span>
                </label>
                <div className="flex items-center gap-1.5">
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full text-sm px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-center font-semibold"
                    required
                  />
                  <span className="text-slate-400 font-bold">～</span>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full text-sm px-2.5 py-1.5 bg-white border border-slate-300 rounded-md text-center font-semibold"
                    required
                  />
                </div>
              </div>
            </div>

            {/* 備考（任意） */}
            <div>
              <label className="block text-xs font-semibold text-slate-700 mb-1">
                備考（任意）
              </label>
              <input
                type="text"
                value={note}
                onChange={(e) => setNote(e.target.value)}
                placeholder="例: 開館点検、施設巡回、定例対応など"
                className="w-full text-xs sm:text-sm px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
              />
            </div>

            {/* 登録モード（追加 or 上書き） */}
            <div className="pt-2 border-t border-slate-200">
              <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                同日の既存シフトの扱い
              </label>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-xs">
                <label
                  className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    saveMode === 'add'
                      ? 'bg-blue-50/80 border-blue-300 text-blue-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="saveMode"
                    value="add"
                    checked={saveMode === 'add'}
                    onChange={() => setSaveMode('add')}
                    className="mt-0.5 text-blue-600 focus:ring-blue-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">既存シフトに残して追加（推奨）</span>
                    <span className="text-[11px] text-slate-500">
                      既に他職員の早出がある場合、消さずに追加します
                    </span>
                  </div>
                </label>

                <label
                  className={`flex items-start gap-2 p-2 rounded-md border cursor-pointer transition-colors ${
                    saveMode === 'overwrite'
                      ? 'bg-amber-50/80 border-amber-300 text-amber-900'
                      : 'bg-white border-slate-200 text-slate-600 hover:bg-slate-50'
                  }`}
                >
                  <input
                    type="radio"
                    name="saveMode"
                    value="overwrite"
                    checked={saveMode === 'overwrite'}
                    onChange={() => setSaveMode('overwrite')}
                    className="mt-0.5 text-amber-600 focus:ring-amber-500 cursor-pointer"
                  />
                  <div>
                    <span className="font-bold block">対象日の既存早出を上書き</span>
                    <span className="text-[11px] text-slate-500">
                      対象日に登録済みの早出をクリアしてこの職員に置換
                    </span>
                  </div>
                </label>
              </div>
            </div>
          </div>

          {/* 一括削除エリア（折りたたみ/確認） */}
          <div className="pt-1 border-t border-slate-200">
            {isConfirmingDelete ? (
              <div className="p-3 bg-rose-50 border border-rose-300 rounded-lg text-rose-900 space-y-2">
                <div className="flex items-center gap-2 font-bold text-xs sm:text-sm text-rose-800">
                  <AlertTriangle className="w-4 h-4 text-rose-600 shrink-0" />
                  <span>選択した{targetDates.length}日間の早出シフトを一括削除しますか？</span>
                </div>
                <div className="flex flex-wrap items-center gap-3 text-xs">
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteFilter"
                      checked={deleteTargetFilter === 'selectedStaff'}
                      onChange={() => setDeleteTargetFilter('selectedStaff')}
                    />
                    <span>「{selectedStaff}」さんの早出のみ削除</span>
                  </label>
                  <label className="inline-flex items-center gap-1 cursor-pointer">
                    <input
                      type="radio"
                      name="deleteFilter"
                      checked={deleteTargetFilter === 'all'}
                      onChange={() => setDeleteTargetFilter('all')}
                    />
                    <span>全職員の早出をクリア</span>
                  </label>
                </div>
                <div className="flex items-center justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(false)}
                    className="px-3 py-1 bg-white border border-slate-300 text-slate-700 text-xs rounded hover:bg-slate-100 cursor-pointer"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteBatchDelete}
                    disabled={isSubmitting}
                    className="inline-flex items-center gap-1.5 px-3 py-1 bg-rose-600 hover:bg-rose-700 disabled:bg-rose-300 disabled:cursor-not-allowed text-white font-bold text-xs rounded transition-colors shadow-2xs cursor-pointer"
                  >
                    {isSubmitting ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        <span>削除実行中...</span>
                      </>
                    ) : (
                      <span>一括削除を実行する</span>
                    )}
                  </button>
                </div>
              </div>
            ) : (
              <div className="flex items-center justify-between text-xs text-slate-500">
                <span>※ 選択した条件の早出を取り消したい場合:</span>
                <button
                  type="button"
                  onClick={() => setIsConfirmingDelete(true)}
                  disabled={targetDates.length === 0 || isSubmitting}
                  className="inline-flex items-center gap-1 text-rose-600 hover:text-rose-800 font-medium hover:underline cursor-pointer disabled:opacity-40 disabled:cursor-not-allowed"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  <span>選択した{targetDates.length}日間のシフトを一括クリア</span>
                </button>
              </div>
            )}
          </div>

          {/* フッターアクションボタン */}
          <div className="flex items-center justify-between gap-2 pt-2 border-t border-slate-200">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 disabled:opacity-50 rounded-md transition-colors cursor-pointer"
            >
              閉じる
            </button>
            <button
              type="submit"
              disabled={targetDates.length === 0 || isSubmitting}
              className="inline-flex items-center gap-1.5 px-6 py-2.5 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 disabled:cursor-not-allowed rounded-md shadow-xs transition-colors cursor-pointer"
            >
              {isSubmitting ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  <span>同期中...</span>
                </>
              ) : (
                <>
                  <Check className="w-4 h-4" />
                  <span>
                    {targetDates.length > 0
                      ? `${targetDates.length}日分をまとめて一括登録`
                      : '日付を選択してください'}
                  </span>
                </>
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
