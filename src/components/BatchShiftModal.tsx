import React, { useState, useMemo, useEffect } from 'react';
import { ShiftRecord, StaffMember, AbsenceType } from '../types';
import { DEFAULT_SHIFT_START, DEFAULT_SHIFT_END, WEEK_DAYS_JA, getDayOfWeekLabel } from '../utils/constants';
import { formatDateKey, getHolidayName } from '../utils/holidays';
import { useAuth } from '../context/AuthContext';
import {
  CalendarRange,
  X,
  Check,
  Clock,
  Users,
  User,
  AlertTriangle,
  Trash2,
  CalendarCheck,
  CheckSquare,
  Square,
  RotateCcw,
  Loader2,
  Briefcase,
  GraduationCap,
  Coffee,
  HelpCircle,
  Sparkles,
  ArrowRight,
  ShieldCheck,
} from 'lucide-react';

export type BatchOperationTab = 'timeUpdate' | 'createShift' | 'absence' | 'delete';

interface BatchShiftModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentMonth: number;
  staffList: StaffMember[];
  shifts: ShiftRecord[];
  isAdminMode?: boolean;
  startOfWeek?: 'sun' | 'mon';
  onBatchSave: (
    newShifts: ShiftRecord[],
    mode: 'add' | 'overwrite',
    targetDates: string[],
    logSummary?: string
  ) => Promise<void> | void;
  onBatchDelete: (targetDates: string[], targetStaffNames?: string[]) => Promise<void> | void;
}

// 勤務時間のクイックプリセット一覧
const TIME_PRESETS = [
  { label: '基本 (7:30～16:15)', start: '07:30', end: '16:15' },
  { label: '8:00～16:45', start: '08:00', end: '16:45' },
  { label: '8:30～17:15', start: '08:30', end: '17:15' },
  { label: '9:00～17:45', start: '09:00', end: '17:45' },
  { label: '午前半休 (12:30～16:15)', start: '12:30', end: '16:15' },
  { label: '午後半休 (07:30～12:00)', start: '07:30', end: '12:00' },
];

export const BatchShiftModal: React.FC<BatchShiftModalProps> = ({
  isOpen,
  onClose,
  currentYear,
  currentMonth,
  staffList,
  shifts,
  isAdminMode = false,
  startOfWeek = 'sun',
  onBatchSave,
  onBatchDelete,
}) => {
  const { surname } = useAuth();
  const canEdit = true;

  // 操作モードタブ: 'timeUpdate' (既存シフトの時刻一括変更) | 'createShift' (新規一括登録) | 'absence' (不在一括設定) | 'delete' (一括削除)
  const [activeTab, setActiveTab] = useState<BatchOperationTab>('timeUpdate');

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

  // ★ 複数職員のまとめて選択セット
  const [selectedStaffNames, setSelectedStaffNames] = useState<Set<string>>(new Set());

  // 勤務時刻設定
  const [startTime, setStartTime] = useState<string>(DEFAULT_SHIFT_START);
  const [endTime, setEndTime] = useState<string>(DEFAULT_SHIFT_END);
  const [note, setNote] = useState<string>('');

  // 時刻一括変更モード用設定
  const [updateExistingNotes, setUpdateExistingNotes] = useState<boolean>(false);
  const [includeAbsenceInTimeUpdate, setIncludeAbsenceInTimeUpdate] = useState<boolean>(false);

  // 新規登録モード用設定: 'add' (既存に残して追加) または 'overwrite' (対象日のシフトを差し替え)
  const [saveMode, setSaveMode] = useState<'add' | 'overwrite'>('add');

  // 不在設定モード用設定
  const [absenceType, setAbsenceType] = useState<AbsenceType>('休み');
  const [isAllDayAbsence, setIsAllDayAbsence] = useState<boolean>(true);
  const [absenceStartTime, setAbsenceStartTime] = useState<string>('08:30');
  const [absenceEndTime, setAbsenceEndTime] = useState<string>('17:15');
  const [absenceNote, setAbsenceNote] = useState<string>('');

  // 一括削除モード用設定
  const [deleteTargetFilter, setDeleteTargetFilter] = useState<'selectedStaff' | 'all'>('selectedStaff');
  const [isConfirmingDelete, setIsConfirmingDelete] = useState<boolean>(false);

  // 状態表示メッセージ & 送信中フラグ
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
  const [submitProgressText, setSubmitProgressText] = useState<string>('');

  // モーダル表示時に初期職員セット（全職員選択）と日付範囲を準備
  useEffect(() => {
    if (isOpen) {
      if (staffList.length > 0 && selectedStaffNames.size === 0) {
        setSelectedStaffNames(new Set(staffList.map((s) => s.name)));
      }
      if (!startDate) setStartDate(defaultStartDate);
      if (!endDate) setEndDate(defaultEndDate);
      setStatusMessage(null);
      setIsConfirmingDelete(false);
    }
  }, [isOpen, staffList, defaultStartDate, defaultEndDate]);

  // 既存シフトの検索用ルックアップ
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, ShiftRecord[]>();
    for (const s of shifts) {
      const existing = map.get(s.date) || [];
      existing.push(s);
      map.set(s.date, existing);
    }
    return map;
  }, [shifts]);

  // 期間内の全日付オブジェクト候補（祝日判定・既存シフト判定付き）
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
      existingShifts: ShiftRecord[];
    }> = [];

    const current = new Date(startYear, startMonth - 1, startDay);
    let guard = 0;
    while (current <= end && guard < 180) {
      guard++;
      const dateString = formatDateKey(
        current.getFullYear(),
        current.getMonth() + 1,
        current.getDate()
      );
      const dayOfWeek = current.getDay();
      const holidayName = getHolidayName(current);
      const isHoliday = Boolean(holidayName);
      const existingShifts = shiftsByDate.get(dateString) || [];

      dates.push({
        dateString,
        dateObj: new Date(current),
        dayOfWeek,
        isHoliday,
        holidayName,
        hasExistingShift: existingShifts.length > 0,
        existingShifts,
      });

      current.setDate(current.getDate() + 1);
    }

    return dates;
  }, [startDate, endDate, shiftsByDate]);

  // 期間変更時に初期選択状態を設定（平日のみ自動選択）
  useEffect(() => {
    if (candidateDates.length > 0) {
      const initialSet = new Set<string>();
      candidateDates.forEach((d) => {
        const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
        if (!isWeekend && !(excludeHolidays && d.isHoliday)) {
          initialSet.add(d.dateString);
        }
      });
      setSelectedDates(initialSet);
    }
  }, [startDate, endDate, excludeHolidays, candidateDates]);

  // 曜日ごとの選択数集計
  const weekdayStats = useMemo(() => {
    const stats: Record<number, { total: number; selected: number }> = {
      0: { total: 0, selected: 0 },
      1: { total: 0, selected: 0 },
      2: { total: 0, selected: 0 },
      3: { total: 0, selected: 0 },
      4: { total: 0, selected: 0 },
      5: { total: 0, selected: 0 },
      6: { total: 0, selected: 0 },
    };

    candidateDates.forEach((d) => {
      const isValid = !(excludeHolidays && d.isHoliday);
      if (isValid) {
        stats[d.dayOfWeek].total++;
        if (selectedDates.has(d.dateString)) {
          stats[d.dayOfWeek].selected++;
        }
      }
    });

    return stats;
  }, [candidateDates, selectedDates, excludeHolidays]);

  // ★ 職員選択トグル
  const handleToggleStaff = (staffName: string) => {
    setSelectedStaffNames((prev) => {
      const next = new Set(prev);
      if (next.has(staffName)) {
        next.delete(staffName);
      } else {
        next.add(staffName);
      }
      return next;
    });
  };

  const handleSelectAllStaff = () => {
    setSelectedStaffNames(new Set(staffList.map((s) => s.name)));
  };

  const handleClearAllStaff = () => {
    setSelectedStaffNames(new Set());
  };

  // 曜日トグル
  const handleToggleWeekday = (dayOfWeek: number) => {
    const stat = weekdayStats[dayOfWeek];
    const shouldSelect = stat.selected < stat.total;

    setSelectedDates((prev) => {
      const next = new Set(prev);
      candidateDates.forEach((d) => {
        if (d.dayOfWeek === dayOfWeek) {
          const isExcluded = excludeHolidays && d.isHoliday;
          if (!isExcluded) {
            if (shouldSelect) {
              next.add(d.dateString);
            } else {
              next.delete(d.dateString);
            }
          }
        }
      });
      return next;
    });
  };

  // クイック曜日選択プリセット
  const handleSelectWeekdaysOnly = () => {
    const next = new Set<string>();
    candidateDates.forEach((d) => {
      const isWeekday = d.dayOfWeek >= 1 && d.dayOfWeek <= 5;
      const isExcluded = excludeHolidays && d.isHoliday;
      if (isWeekday && !isExcluded) {
        next.add(d.dateString);
      }
    });
    setSelectedDates(next);
  };

  const handleSelectWeekendsOnly = () => {
    const next = new Set<string>();
    candidateDates.forEach((d) => {
      const isWeekend = d.dayOfWeek === 0 || d.dayOfWeek === 6;
      const isExcluded = excludeHolidays && d.isHoliday;
      if (isWeekend && !isExcluded) {
        next.add(d.dateString);
      }
    });
    setSelectedDates(next);
  };

  const handleSelectAllDates = () => {
    const next = new Set<string>();
    candidateDates.forEach((d) => {
      const isExcluded = excludeHolidays && d.isHoliday;
      if (!isExcluded) {
        next.add(d.dateString);
      }
    });
    setSelectedDates(next);
  };

  const handleClearAllDates = () => {
    setSelectedDates(new Set());
  };

  // 日付チップの個別選択
  const handleToggleDate = (dateString: string) => {
    setSelectedDates((prev) => {
      const next = new Set(prev);
      if (next.has(dateString)) {
        next.delete(dateString);
      } else {
        next.add(dateString);
      }
      return next;
    });
  };

  // 期間プリセット切り替え
  const setMonthRange = (year: number, month: number) => {
    const start = formatDateKey(year, month, 1);
    const lastDay = new Date(year, month, 0).getDate();
    const end = formatDateKey(year, month, lastDay);
    setStartDate(start);
    setEndDate(end);
  };

  const setThisWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = day === 0 ? -6 : 1 - day;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setStartDate(formatDateKey(monday.getFullYear(), monday.getMonth() + 1, monday.getDate()));
    setEndDate(formatDateKey(sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()));
  };

  const setNextWeekRange = () => {
    const now = new Date();
    const day = now.getDay();
    const diffToMonday = (day === 0 ? -6 : 1 - day) + 7;
    const monday = new Date(now);
    monday.setDate(now.getDate() + diffToMonday);
    const sunday = new Date(monday);
    sunday.setDate(monday.getDate() + 6);

    setStartDate(formatDateKey(monday.getFullYear(), monday.getMonth() + 1, monday.getDate()));
    setEndDate(formatDateKey(sunday.getFullYear(), sunday.getMonth() + 1, sunday.getDate()));
  };

  // ★ 【時刻一括変更モード】で対象となる既存シフト一覧と件数集計
  const matchingExistingShiftsToUpdate = useMemo(() => {
    if (selectedDates.size === 0 || selectedStaffNames.size === 0) return [];

    return shifts.filter((s) => {
      if (!selectedDates.has(s.date)) return false;
      if (!selectedStaffNames.has(s.staffName)) return false;
      if (s.isAbsence && !includeAbsenceInTimeUpdate) return false;
      return true;
    });
  }, [shifts, selectedDates, selectedStaffNames, includeAbsenceInTimeUpdate]);

  // ★ 【一括削除モード】で対象となる既存シフトの件数集計
  const matchingShiftsToDelete = useMemo(() => {
    if (selectedDates.size === 0) return [];
    return shifts.filter((s) => {
      if (!selectedDates.has(s.date)) return false;
      if (deleteTargetFilter === 'selectedStaff') {
        return selectedStaffNames.has(s.staffName);
      }
      return true;
    });
  }, [shifts, selectedDates, deleteTargetFilter, selectedStaffNames]);

  // 選択職員名リスト（配列）
  const selectedStaffListArray = useMemo(() => {
    return staffList.filter((s) => selectedStaffNames.has(s.name));
  }, [staffList, selectedStaffNames]);

  // ★ 1. 時刻一括変更の実行
  const handleExecuteTimeUpdate = async () => {
    if (matchingExistingShiftsToUpdate.length === 0) {
      alert('変更対象となる登録済みシフトがありません。選択した日付と職員を確認してください。');
      return;
    }
    if (!startTime || !endTime) {
      alert('開始時刻と終了時刻を入力してください。');
      return;
    }

    const currentAuthorUid = isAdminMode ? 'admin' : 'local-user';
    const currentAuthorName = isAdminMode ? '管理者' : (surname || '担当者');

    setIsSubmitting(true);
    setSubmitProgressText(`登録済みシフト ${matchingExistingShiftsToUpdate.length}件の時刻を更新中...`);

    try {
      const updatedShifts: ShiftRecord[] = matchingExistingShiftsToUpdate.map((existing) => ({
        ...existing,
        startTime,
        endTime,
        note: updateExistingNotes ? note.trim() : existing.note || '',
        updatedAt: Date.now(),
        updatedByUid: currentAuthorUid,
        updatedByName: currentAuthorName,
      }));

      const targetDates = Array.from(selectedDates);
      const staffNamesLabel = selectedStaffListArray.map((s) => s.name).join('・');
      const logSummary = `職員 [${staffNamesLabel}] のシフト時刻を一括変更 (${updatedShifts.length}件: ${startTime}～${endTime})`;

      await onBatchSave(updatedShifts, 'add', targetDates, logSummary);

      setStatusMessage(`✨ 職員 [${staffNamesLabel}] のシフト ${updatedShifts.length}件の時刻を「${startTime}～${endTime}」に一括変更しました！`);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Error updating shift times:', err);
      alert('シフト時刻の更新中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
      setSubmitProgressText('');
    }
  };

  // ★ 2. 早出シフト一括新規登録の実行
  const handleExecuteCreateShifts = async () => {
    if (selectedDates.size === 0) {
      alert('対象日付を1日以上選択してください。');
      return;
    }
    if (selectedStaffNames.size === 0) {
      alert('対象職員を1名以上選択してください。');
      return;
    }
    if (!startTime || !endTime) {
      alert('出勤時間と退勤時間を入力してください。');
      return;
    }

    const currentAuthorUid = isAdminMode ? 'admin' : 'local-user';
    const currentAuthorName = isAdminMode ? '管理者' : (surname || '担当者');

    const totalToCreate = selectedDates.size * selectedStaffNames.size;
    setIsSubmitting(true);
    setSubmitProgressText(`早出シフト ${totalToCreate}件を一括生成・保存中...`);

    try {
      const sortedDates = Array.from(selectedDates).sort();
      const newShifts: ShiftRecord[] = [];

      sortedDates.forEach((date) => {
        selectedStaffListArray.forEach((staff) => {
          newShifts.push({
            id: `shift-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            date,
            staffName: staff.name,
            startTime,
            endTime,
            note: note.trim(),
            isAbsence: false,
            createdByUid: currentAuthorUid,
            createdByName: currentAuthorName,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });
      });

      const staffNamesLabel = selectedStaffListArray.map((s) => s.name).join('・');
      const logSummary = `職員 [${staffNamesLabel}] の早出シフトを一括登録 (${newShifts.length}件, ${startTime}～${endTime})`;

      await onBatchSave(newShifts, saveMode, sortedDates, logSummary);

      setStatusMessage(`✨ 職員 [${staffNamesLabel}] に計 ${newShifts.length}件の早出シフトを一括登録しました！`);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Error creating shifts:', err);
      alert('シフトの登録中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
      setSubmitProgressText('');
    }
  };

  // ★ 3. 不在（休み・出張・研修）一括設定の実行
  const handleExecuteCreateAbsence = async () => {
    if (selectedDates.size === 0) {
      alert('対象日付を1日以上選択してください。');
      return;
    }
    if (selectedStaffNames.size === 0) {
      alert('対象職員を1名以上選択してください。');
      return;
    }

    const currentAuthorUid = isAdminMode ? 'admin' : 'local-user';
    const currentAuthorName = isAdminMode ? '管理者' : (surname || '担当者');

    const totalToCreate = selectedDates.size * selectedStaffNames.size;
    setIsSubmitting(true);
    setSubmitProgressText(`不在設定（${absenceType}）${totalToCreate}件を保存中...`);

    try {
      const sortedDates = Array.from(selectedDates).sort();
      const finalStartTime = isAllDayAbsence ? '終日' : absenceStartTime;
      const finalEndTime = isAllDayAbsence ? '' : absenceEndTime;
      const newShifts: ShiftRecord[] = [];

      sortedDates.forEach((date) => {
        selectedStaffListArray.forEach((staff) => {
          newShifts.push({
            id: `shift-${Date.now()}-${Math.random().toString(36).substring(2, 8)}`,
            date,
            staffName: staff.name,
            startTime: finalStartTime,
            endTime: finalEndTime,
            note: absenceNote.trim(),
            isAbsence: true,
            absenceType,
            createdByUid: currentAuthorUid,
            createdByName: currentAuthorName,
            createdAt: Date.now(),
            updatedAt: Date.now(),
          });
        });
      });

      const staffNamesLabel = selectedStaffListArray.map((s) => s.name).join('・');
      const logSummary = `職員 [${staffNamesLabel}] の不在（${absenceType}）を一括設定 (${newShifts.length}件)`;

      await onBatchSave(newShifts, 'add', sortedDates, logSummary);

      setStatusMessage(`✨ 職員 [${staffNamesLabel}] に計 ${newShifts.length}件の不在（${absenceType}）を設定しました！`);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Error saving batch absence:', err);
      alert('不在設定の保存中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
      setSubmitProgressText('');
    }
  };

  // ★ 4. 一括削除の実行
  const handleExecuteBatchDelete = async () => {
    if (selectedDates.size === 0) {
      alert('削除対象の日付を1日以上選択してください。');
      return;
    }
    if (deleteTargetFilter === 'selectedStaff' && selectedStaffNames.size === 0) {
      alert('削除対象の職員を1名以上選択してください。');
      return;
    }

    setIsSubmitting(true);
    setSubmitProgressText('指定シフトを一括削除中...');

    try {
      const sortedDates = Array.from(selectedDates).sort();
      const targetStaffNames =
        deleteTargetFilter === 'selectedStaff' ? Array.from(selectedStaffNames) : undefined;

      await onBatchDelete(sortedDates, targetStaffNames);

      const targetLabel = targetStaffNames ? `職員 [${targetStaffNames.join('・')}]` : '全職員';
      setStatusMessage(`🗑️ ${targetLabel} の対象期間シフトを一括削除しました。`);
      setTimeout(() => {
        onClose();
      }, 1400);
    } catch (err) {
      console.error('Error deleting shifts:', err);
      alert('削除中にエラーが発生しました。');
    } finally {
      setIsSubmitting(false);
      setSubmitProgressText('');
      setIsConfirmingDelete(false);
    }
  };

  if (!isOpen) return null;

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto"
      onClick={(e) => {
        if (e.target === e.currentTarget && !isSubmitting) onClose();
      }}
    >
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-blue-700 via-blue-600 to-indigo-700 text-white shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-lg backdrop-blur-xs">
              <CalendarRange className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">職員をまとめて設定・時刻一括変更</h2>
                <span className="text-[11px] bg-white/20 text-white font-medium px-2 py-0.5 rounded-full">
                  一括管理ツール
                </span>
              </div>
              <p className="text-xs text-blue-100">
                複数職員の早出シフト登録、登録済みシフトの時刻一括変更、休み・出張等の不在設定
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isSubmitting}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 完了・進行状況メッセージ */}
        {statusMessage && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}

        {/* 操作モード切り替えタブ */}
        <div className="flex items-center border-b border-slate-200 bg-slate-50/80 px-4 sm:px-5 gap-1.5 pt-2 overflow-x-auto shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('timeUpdate')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'timeUpdate'
                ? 'border-blue-600 text-blue-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-t-lg'
            }`}
          >
            <Clock className="w-4 h-4 text-blue-600" />
            <span>登録済みシフトの時刻変更</span>
            {matchingExistingShiftsToUpdate.length > 0 && (
              <span className="text-[10px] bg-blue-100 text-blue-800 px-1.5 py-0.2 rounded-full font-mono">
                {matchingExistingShiftsToUpdate.length}件
              </span>
            )}
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('createShift')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'createShift'
                ? 'border-emerald-600 text-emerald-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-t-lg'
            }`}
          >
            <CalendarCheck className="w-4 h-4 text-emerald-600" />
            <span>早出シフト一括新規登録</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('absence')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'absence'
                ? 'border-amber-600 text-amber-800 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-t-lg'
            }`}
          >
            <Coffee className="w-4 h-4 text-amber-600" />
            <span>不在（休み・出張等）一括設定</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('delete')}
            className={`flex items-center gap-1.5 px-3 sm:px-4 py-2 text-xs sm:text-sm font-bold border-b-2 transition-all cursor-pointer whitespace-nowrap ${
              activeTab === 'delete'
                ? 'border-rose-600 text-rose-700 bg-white rounded-t-lg shadow-2xs'
                : 'border-transparent text-slate-600 hover:text-slate-900 hover:bg-slate-100/70 rounded-t-lg'
            }`}
          >
            <Trash2 className="w-4 h-4 text-rose-600" />
            <span>一括削除・クリア</span>
          </button>
        </div>

        {/* スクロール可能なメインコンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {/* STEP 1: 対象職員の複数選択（★「職員をまとめて」★） */}
          <section className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  1
                </span>
                <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                  <Users className="w-4 h-4 text-blue-600" />
                  対象職員の選択（複数選択・一括指定可能）
                </h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs">
                <button
                  type="button"
                  onClick={handleSelectAllStaff}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-400 hover:text-blue-700 rounded-md font-medium transition-colors cursor-pointer"
                >
                  全職員を選択
                </button>
                <button
                  type="button"
                  onClick={handleClearAllStaff}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  選択解除
                </button>
              </div>
            </div>

            {/* 職員ボタン一覧 */}
            <div className="flex items-center gap-2 flex-wrap">
              {staffList.map((staff) => {
                const isSelected = selectedStaffNames.has(staff.name);
                return (
                  <button
                    key={staff.id}
                    type="button"
                    onClick={() => handleToggleStaff(staff.name)}
                    className={`flex items-center gap-2 px-3 py-2 rounded-lg text-xs font-bold border transition-all cursor-pointer select-none ${
                      isSelected
                        ? `${staff.colorBg} ${staff.colorText} ${staff.colorBorder} ring-2 ring-blue-500 shadow-xs scale-102`
                        : 'bg-white text-slate-600 border-slate-200 hover:bg-slate-100/80 opacity-70'
                    }`}
                  >
                    <div
                      className={`w-4 h-4 rounded-sm flex items-center justify-center border ${
                        isSelected ? 'bg-blue-600 border-blue-600 text-white' : 'border-slate-300 bg-white'
                      }`}
                    >
                      {isSelected && <Check className="w-3 h-3 stroke-[3]" />}
                    </div>
                    <span>{staff.name}</span>
                  </button>
                );
              })}
            </div>

            {/* 選択サマリー */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs text-slate-600 flex-wrap gap-2">
              <div>
                選択中: <span className="font-bold text-slate-900">{selectedStaffNames.size}名</span>
                {selectedStaffNames.size > 0 ? (
                  <span className="ml-1 text-slate-700 font-medium">
                    （{selectedStaffListArray.map((s) => s.name).join('、')}）
                  </span>
                ) : (
                  <span className="text-rose-600 font-bold ml-1">
                    ⚠️ 職員が選択されていません。最低1名選択してください。
                  </span>
                )}
              </div>
              <span className="text-[11px] text-slate-500">
                ※ 選択した全員に対して一括で処理が適用されます
              </span>
            </div>
          </section>

          {/* STEP 2: 対象期間の指定 */}
          <section className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  2
                </span>
                <h3 className="text-sm font-bold text-slate-900">対象期間の指定</h3>
              </div>
              {/* プリセットボタン */}
              <div className="flex items-center gap-1.5 flex-wrap text-xs">
                <button
                  type="button"
                  onClick={() => setMonthRange(currentYear, currentMonth)}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  当月 ({currentYear}年{currentMonth}月)
                </button>
                <button
                  type="button"
                  onClick={() => {
                    const nextM = currentMonth === 12 ? 1 : currentMonth + 1;
                    const nextY = currentMonth === 12 ? currentYear + 1 : currentYear;
                    setMonthRange(nextY, nextM);
                  }}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  翌月
                </button>
                <button
                  type="button"
                  onClick={setThisWeekRange}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  今週
                </button>
                <button
                  type="button"
                  onClick={setNextWeekRange}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  来週
                </button>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 items-center">
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">開始日</label>
                <input
                  type="date"
                  value={startDate}
                  onChange={(e) => setStartDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">終了日</label>
                <input
                  type="date"
                  value={endDate}
                  onChange={(e) => setEndDate(e.target.value)}
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500 focus:outline-hidden"
                />
              </div>
            </div>

            {/* 祝日自動除外チェックボックス */}
            <div className="mt-3 pt-2.5 border-t border-slate-200/80 flex items-center justify-between text-xs">
              <label className="flex items-center gap-2 cursor-pointer select-none text-slate-700 font-medium">
                <input
                  type="checkbox"
                  checked={excludeHolidays}
                  onChange={(e) => setExcludeHolidays(e.target.checked)}
                  className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                />
                <span>日本の祝日・振替休日は自動的に除外する</span>
              </label>
              <span className="text-slate-500">
                期間全体: <span className="font-bold text-slate-800">{candidateDates.length}日間</span>
              </span>
            </div>
          </section>

          {/* STEP 3: 曜日と対象日付の選択 */}
          <section className="bg-slate-50/70 p-4 rounded-xl border border-slate-200">
            <div className="flex items-center justify-between mb-2.5 flex-wrap gap-2">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  3
                </span>
                <h3 className="text-sm font-bold text-slate-900">対象曜日・個別日付の確認</h3>
              </div>
              <div className="flex items-center gap-1.5 text-xs flex-wrap">
                <button
                  type="button"
                  onClick={handleSelectWeekdaysOnly}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  平日のみ
                </button>
                <button
                  type="button"
                  onClick={handleSelectWeekendsOnly}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  土日のみ
                </button>
                <button
                  type="button"
                  onClick={handleSelectAllDates}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  全日選択
                </button>
                <button
                  type="button"
                  onClick={handleClearAllDates}
                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-600 hover:bg-slate-100 rounded-md font-medium transition-colors cursor-pointer"
                >
                  全解除
                </button>
              </div>
            </div>

            {/* 曜日トグルボタン */}
            <div className="grid grid-cols-7 gap-1.5 mb-3">
              {(startOfWeek === 'sun' ? [0, 1, 2, 3, 4, 5, 6] : [1, 2, 3, 4, 5, 6, 0]).map((d) => {
                const stat = weekdayStats[d];
                const isAll = stat.total > 0 && stat.selected === stat.total;
                const isPart = stat.selected > 0 && stat.selected < stat.total;
                const dayLabel = getDayOfWeekLabel(d);
                const isSun = d === 0;
                const isSat = d === 6;

                return (
                  <button
                    key={d}
                    type="button"
                    onClick={() => handleToggleWeekday(d)}
                    disabled={stat.total === 0}
                    className={`p-2 rounded-lg text-center border transition-all cursor-pointer ${
                      stat.total === 0
                        ? 'opacity-40 bg-slate-100 border-slate-200 text-slate-400 cursor-not-allowed'
                        : isAll
                        ? 'bg-blue-600 text-white border-blue-700 shadow-xs'
                        : isPart
                        ? 'bg-blue-100 text-blue-900 border-blue-300'
                        : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                    }`}
                  >
                    <div
                      className={`text-xs font-bold ${
                        isAll
                          ? 'text-white'
                          : isSun
                          ? 'text-rose-600'
                          : isSat
                          ? 'text-blue-600'
                          : 'text-slate-800'
                      }`}
                    >
                      {dayLabel}曜
                    </div>
                    <div className="text-[10px] mt-0.5 opacity-90">
                      {stat.selected}/{stat.total}日
                    </div>
                  </button>
                );
              })}
            </div>

            {/* 日付個別チップ一覧（折りたたみ風・スクロール可能） */}
            <div className="mt-2 pt-2 border-t border-slate-200">
              <div className="flex items-center justify-between text-xs text-slate-600 mb-1.5">
                <span>
                  選択中の日数: <span className="font-bold text-blue-700">{selectedDates.size}日</span>
                </span>
                <span className="text-[11px] text-slate-500">※ クリックで個別にON/OFF切り替え可能</span>
              </div>
              <div className="max-h-36 overflow-y-auto p-2 bg-white rounded-lg border border-slate-200 flex flex-wrap gap-1.5">
                {candidateDates.map((item) => {
                  const isSelected = selectedDates.has(item.dateString);
                  const isSun = item.dayOfWeek === 0;
                  const isSat = item.dayOfWeek === 6;

                  return (
                    <button
                      key={item.dateString}
                      type="button"
                      onClick={() => handleToggleDate(item.dateString)}
                      className={`px-2 py-1 rounded text-xs font-medium border transition-all cursor-pointer flex items-center gap-1 ${
                        isSelected
                          ? 'bg-blue-50 border-blue-400 text-blue-900 font-bold shadow-2xs'
                          : 'bg-slate-50 border-slate-200 text-slate-500 hover:bg-slate-100'
                      }`}
                      title={item.holidayName || undefined}
                    >
                      <span>{item.dateString.substring(5)}</span>
                      <span
                        className={`text-[10px] ${
                          isSun || item.isHoliday
                            ? 'text-rose-600'
                            : isSat
                            ? 'text-blue-600'
                            : 'text-slate-500'
                        }`}
                      >
                        ({getDayOfWeekLabel(item.dayOfWeek)})
                      </span>
                      {item.hasExistingShift && (
                        <span className="w-1.5 h-1.5 rounded-full bg-emerald-500" title="既存シフトあり" />
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          </section>

          {/* ======================= TAB 1: 登録済みシフトの時刻一括変更 ======================= */}
          {activeTab === 'timeUpdate' && (
            <section className="bg-blue-50/50 p-4 sm:p-5 rounded-xl border border-blue-200 space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-blue-600 text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Clock className="w-4 h-4 text-blue-600" />
                    変更後の勤務時刻の設定
                  </h3>
                  <p className="text-xs text-slate-600">
                    選択した期間・日付・職員に該当する【既存登録シフト】の時刻を一括で書き換えます。
                  </p>
                </div>
              </div>

              {/* リアルタイム検索マッチングプレビュー */}
              <div className="p-3 bg-white rounded-lg border border-blue-200 text-xs flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-slate-600">変更対象となる登録済みシフト: </span>
                  <span className="font-bold text-blue-800 text-sm">
                    {matchingExistingShiftsToUpdate.length}件
                  </span>
                  <span className="text-slate-500 ml-1.5">
                    （対象職員 {selectedStaffNames.size}名 × 対象日数 {selectedDates.size}日）
                  </span>
                </div>
                {matchingExistingShiftsToUpdate.length === 0 && (
                  <span className="text-amber-700 font-medium">
                    ⚠️ 選択した期間・日付・職員には現在シフトがありません
                  </span>
                )}
              </div>

              {/* 勤務時刻入力 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    新しい開始時刻 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    新しい終了時刻 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                </div>
              </div>

              {/* クイック時刻プリセットボタン */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  クイック時刻設定
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setStartTime(preset.start);
                        setEndTime(preset.end);
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-blue-50 hover:border-blue-300 hover:text-blue-700 rounded-md text-xs font-medium transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 備考更新オプション */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-2">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-800 font-medium">
                  <input
                    type="checkbox"
                    checked={updateExistingNotes}
                    onChange={(e) => setUpdateExistingNotes(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>備考も一括で新しい内容に変更・上書きする（オフの場合は現在の備考を保持）</span>
                </label>
                {updateExistingNotes && (
                  <input
                    type="text"
                    value={note}
                    onChange={(e) => setNote(e.target.value)}
                    placeholder="新しい備考（任意）"
                    className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-800 focus:ring-2 focus:ring-blue-500"
                  />
                )}
              </div>

              {/* 不在シフトも対象に含めるかのトグル */}
              <div className="text-xs text-slate-600">
                <label className="flex items-center gap-2 cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={includeAbsenceInTimeUpdate}
                    onChange={(e) => setIncludeAbsenceInTimeUpdate(e.target.checked)}
                    className="rounded border-slate-300 text-blue-600 focus:ring-blue-500"
                  />
                  <span>時間指定の不在（出張・研修等）のシフトも含めて時刻を変更する</span>
                </label>
              </div>

              {/* 実行ボタン */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleExecuteTimeUpdate}
                  disabled={isSubmitting || matchingExistingShiftsToUpdate.length === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-blue-600 hover:bg-blue-700 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{submitProgressText || '変更中...'}</span>
                    </>
                  ) : (
                    <>
                      <Clock className="w-4 h-4" />
                      <span>
                        該当する {matchingExistingShiftsToUpdate.length}件のシフト時刻を一括変更する
                      </span>
                    </>
                  )}
                </button>
              </div>
            </section>
          )}

          {/* ======================= TAB 2: 早出シフト一括新規登録 ======================= */}
          {activeTab === 'createShift' && (
            <section className="bg-emerald-50/50 p-4 sm:p-5 rounded-xl border border-emerald-200 space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-emerald-600 text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <CalendarCheck className="w-4 h-4 text-emerald-600" />
                    早出シフトの勤務時刻・登録設定
                  </h3>
                  <p className="text-xs text-slate-600">
                    選択した日付 × 選択した全職員に対して、一括で早出シフトを作成・登録します。
                  </p>
                </div>
              </div>

              {/* プレビュー計算 */}
              <div className="p-3 bg-white rounded-lg border border-emerald-200 text-xs flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-slate-600">登録予定シフト合計: </span>
                  <span className="font-bold text-emerald-700 text-sm">
                    {selectedDates.size * selectedStaffNames.size}件
                  </span>
                  <span className="text-slate-500 ml-1.5">
                    （対象日数 {selectedDates.size}日 × 選択職員 {selectedStaffNames.size}名）
                  </span>
                </div>
              </div>

              {/* 勤務時刻入力 */}
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    出勤時刻 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={startTime}
                    onChange={(e) => setStartTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
                <div>
                  <label className="block text-xs font-semibold text-slate-700 mb-1">
                    退勤時刻 <span className="text-rose-500">*</span>
                  </label>
                  <input
                    type="time"
                    value={endTime}
                    onChange={(e) => setEndTime(e.target.value)}
                    className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                  />
                </div>
              </div>

              {/* プリセット */}
              <div>
                <label className="block text-xs font-semibold text-slate-600 mb-1.5">
                  クイック時刻設定
                </label>
                <div className="flex items-center gap-1.5 flex-wrap">
                  {TIME_PRESETS.map((preset) => (
                    <button
                      key={preset.label}
                      type="button"
                      onClick={() => {
                        setStartTime(preset.start);
                        setEndTime(preset.end);
                      }}
                      className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 hover:bg-emerald-50 hover:border-emerald-300 hover:text-emerald-700 rounded-md text-xs font-medium transition-colors cursor-pointer"
                    >
                      {preset.label}
                    </button>
                  ))}
                </div>
              </div>

              {/* 備考 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  備考（全件に共通して登録・任意）
                </label>
                <input
                  type="text"
                  value={note}
                  onChange={(e) => setNote(e.target.value)}
                  placeholder="例: 早出業務、点呼など"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-emerald-500"
                />
              </div>

              {/* 登録モード（追加 vs 上書き） */}
              <div className="p-3 bg-white rounded-lg border border-slate-200">
                <label className="block text-xs font-bold text-slate-800 mb-1.5">
                  既存の早出シフトが存在する場合の動作
                </label>
                <div className="space-y-1.5 text-xs text-slate-700">
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="saveMode"
                      checked={saveMode === 'add'}
                      onChange={() => setSaveMode('add')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      <strong className="text-slate-900">既存シフトに残して追加</strong>
                      （同日に既にシフトがある場合、同職員のシフトのみ更新し他職員のシフトは残します）
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer">
                    <input
                      type="radio"
                      name="saveMode"
                      checked={saveMode === 'overwrite'}
                      onChange={() => setSaveMode('overwrite')}
                      className="text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>
                      <strong className="text-slate-900">対象日の全早出を差し替え</strong>
                      （選択した日付に既に登録されている早出をすべて削除し、今回の設定で置き換えます）
                    </span>
                  </label>
                </div>
              </div>

              {/* 実行ボタン */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleExecuteCreateShifts}
                  disabled={isSubmitting || selectedDates.size === 0 || selectedStaffNames.size === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{submitProgressText || '登録中...'}</span>
                    </>
                  ) : (
                    <>
                      <CalendarCheck className="w-4 h-4" />
                      <span>
                        {selectedDates.size * selectedStaffNames.size}件の早出シフトを一括登録する
                      </span>
                    </>
                  )}
                </button>
              </div>
            </section>
          )}

          {/* ======================= TAB 3: 不在（休み・出張・研修）一括設定 ======================= */}
          {activeTab === 'absence' && (
            <section className="bg-amber-50/50 p-4 sm:p-5 rounded-xl border border-amber-200 space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-amber-600 text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Coffee className="w-4 h-4 text-amber-600" />
                    不在種別・設定内容
                  </h3>
                  <p className="text-xs text-slate-600">
                    選択した複数職員に対して、期間内の選択日を一括で「終日休み」「出張」「研修」等に設定します。
                  </p>
                </div>
              </div>

              {/* プレビュー計算 */}
              <div className="p-3 bg-white rounded-lg border border-amber-200 text-xs flex items-center justify-between flex-wrap gap-2">
                <div>
                  <span className="text-slate-600">設定予定件数: </span>
                  <span className="font-bold text-amber-800 text-sm">
                    {selectedDates.size * selectedStaffNames.size}件
                  </span>
                  <span className="text-slate-500 ml-1.5">
                    （対象日数 {selectedDates.size}日 × 選択職員 {selectedStaffNames.size}名）
                  </span>
                </div>
              </div>

              {/* 不在種別ボタン */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1.5">
                  不在種別の選択 <span className="text-rose-500">*</span>
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                  {(['休み', '出張', '研修', 'その他'] as AbsenceType[]).map((type) => {
                    const isSelected = absenceType === type;
                    return (
                      <button
                        key={type}
                        type="button"
                        onClick={() => setAbsenceType(type)}
                        className={`p-2.5 rounded-lg border text-xs font-bold transition-all cursor-pointer flex items-center justify-center gap-1.5 ${
                          isSelected
                            ? type === '出張'
                              ? 'bg-amber-500 text-white border-amber-600 ring-2 ring-amber-300 shadow-xs'
                              : type === '研修'
                              ? 'bg-indigo-600 text-white border-indigo-700 ring-2 ring-indigo-300 shadow-xs'
                              : type === '休み'
                              ? 'bg-rose-600 text-white border-rose-700 ring-2 ring-rose-300 shadow-xs'
                              : 'bg-slate-700 text-white border-slate-800 ring-2 ring-slate-300 shadow-xs'
                            : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-100'
                        }`}
                      >
                        {type === '出張' && <Briefcase className="w-4 h-4" />}
                        {type === '研修' && <GraduationCap className="w-4 h-4" />}
                        {type === '休み' && <Coffee className="w-4 h-4" />}
                        {type === 'その他' && <HelpCircle className="w-4 h-4" />}
                        <span>{type}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* 終日 vs 時間指定 */}
              <div className="p-3 bg-white rounded-lg border border-slate-200 space-y-3">
                <label className="flex items-center gap-2 cursor-pointer select-none text-xs text-slate-800 font-bold">
                  <input
                    type="checkbox"
                    checked={isAllDayAbsence}
                    onChange={(e) => setIsAllDayAbsence(e.target.checked)}
                    className="rounded border-slate-300 text-amber-600 focus:ring-amber-500"
                  />
                  <span>終日不在にする（チェックを外すと時間帯を指定できます）</span>
                </label>

                {!isAllDayAbsence && (
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-slate-200">
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        不在開始時刻
                      </label>
                      <input
                        type="time"
                        value={absenceStartTime}
                        onChange={(e) => setAbsenceStartTime(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-800 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                    <div>
                      <label className="block text-xs font-semibold text-slate-700 mb-1">
                        不在終了時刻
                      </label>
                      <input
                        type="time"
                        value={absenceEndTime}
                        onChange={(e) => setAbsenceEndTime(e.target.value)}
                        className="w-full px-3 py-1.5 bg-slate-50 border border-slate-300 rounded-md text-xs text-slate-800 focus:ring-2 focus:ring-amber-500"
                      />
                    </div>
                  </div>
                )}
              </div>

              {/* 備考 */}
              <div>
                <label className="block text-xs font-semibold text-slate-700 mb-1">
                  備考（任意・例: 有給休暇、夏季休暇、施設協議会など）
                </label>
                <input
                  type="text"
                  value={absenceNote}
                  onChange={(e) => setAbsenceNote(e.target.value)}
                  placeholder="例: 有給休暇、夏季一斉休暇、出張先など"
                  className="w-full px-3 py-2 bg-white border border-slate-300 rounded-lg text-sm text-slate-800 focus:ring-2 focus:ring-amber-500"
                />
              </div>

              {/* 実行ボタン */}
              <div className="pt-2 flex items-center justify-end">
                <button
                  type="button"
                  onClick={handleExecuteCreateAbsence}
                  disabled={isSubmitting || selectedDates.size === 0 || selectedStaffNames.size === 0}
                  className="flex items-center gap-2 px-6 py-2.5 bg-amber-600 hover:bg-amber-700 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isSubmitting ? (
                    <>
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>{submitProgressText || '設定中...'}</span>
                    </>
                  ) : (
                    <>
                      <Coffee className="w-4 h-4" />
                      <span>
                        {selectedDates.size * selectedStaffNames.size}件の不在（{absenceType}）を一括設定する
                      </span>
                    </>
                  )}
                </button>
              </div>
            </section>
          )}

          {/* ======================= TAB 4: 一括削除・クリア ======================= */}
          {activeTab === 'delete' && (
            <section className="bg-rose-50/60 p-4 sm:p-5 rounded-xl border border-rose-200 space-y-4 animate-in fade-in">
              <div className="flex items-center gap-2">
                <span className="w-6 h-6 rounded-full bg-rose-600 text-white text-xs font-bold flex items-center justify-center">
                  4
                </span>
                <div>
                  <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                    <Trash2 className="w-4 h-4 text-rose-600" />
                    一括削除の範囲指定
                  </h3>
                  <p className="text-xs text-slate-600">
                    指定した日付範囲のシフトを一括で削除します。
                  </p>
                </div>
              </div>

              <div className="p-3 bg-white rounded-lg border border-rose-200 text-xs">
                <label className="block text-xs font-bold text-slate-800 mb-2">
                  削除対象の職員フィルター
                </label>
                <div className="space-y-2">
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                    <input
                      type="radio"
                      name="deleteTarget"
                      checked={deleteTargetFilter === 'selectedStaff'}
                      onChange={() => setDeleteTargetFilter('selectedStaff')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>
                      選択中の職員（
                      <strong className="text-slate-900">
                        {selectedStaffNames.size > 0
                          ? selectedStaffListArray.map((s) => s.name).join('・')
                          : '未選択'}
                      </strong>
                      ）のシフトのみ削除
                    </span>
                  </label>
                  <label className="flex items-center gap-2 cursor-pointer text-slate-700 font-medium">
                    <input
                      type="radio"
                      name="deleteTarget"
                      checked={deleteTargetFilter === 'all'}
                      onChange={() => setDeleteTargetFilter('all')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span>
                      <strong className="text-rose-700">全職員</strong>
                      のシフトをクリア（対象日付にある全早出・不在を削除）
                    </span>
                  </label>
                </div>
              </div>

              {/* 削除プレビュー警告 */}
              <div className="p-3 bg-rose-100/70 border border-rose-300 rounded-lg text-xs text-rose-900 flex items-start gap-2">
                <AlertTriangle className="w-5 h-5 text-rose-600 shrink-0 mt-0.5" />
                <div>
                  <div className="font-bold text-sm">
                    削除対象となる既存シフト: {matchingShiftsToDelete.length}件
                  </div>
                  <p className="text-[11px] text-rose-800 mt-1">
                    この操作は取り消せません。削除されたシフトはカレンダーおよびクラウドから完全に除去されます。
                  </p>
                </div>
              </div>

              {/* 実行・確認ボタン */}
              <div className="pt-2 flex items-center justify-end gap-2">
                {!isConfirmingDelete ? (
                  <button
                    type="button"
                    onClick={() => setIsConfirmingDelete(true)}
                    disabled={isSubmitting || matchingShiftsToDelete.length === 0}
                    className="flex items-center gap-2 px-5 py-2.5 bg-rose-600 hover:bg-rose-700 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
                  >
                    <Trash2 className="w-4 h-4" />
                    <span>{matchingShiftsToDelete.length}件のシフトを一括削除する</span>
                  </button>
                ) : (
                  <div className="flex items-center gap-2">
                    <button
                      type="button"
                      onClick={() => setIsConfirmingDelete(false)}
                      className="px-3 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-100 rounded-lg text-xs font-bold cursor-pointer"
                    >
                      キャンセル
                    </button>
                    <button
                      type="button"
                      onClick={handleExecuteBatchDelete}
                      disabled={isSubmitting}
                      className="flex items-center gap-2 px-5 py-2.5 bg-rose-800 hover:bg-rose-900 text-white font-bold rounded-lg shadow-md transition-all cursor-pointer"
                    >
                      {isSubmitting ? (
                        <>
                          <Loader2 className="w-4 h-4 animate-spin" />
                          <span>削除中...</span>
                        </>
                      ) : (
                        <>
                          <AlertTriangle className="w-4 h-4" />
                          <span>本当に一括削除を実行する</span>
                        </>
                      )}
                    </button>
                  </div>
                )}
              </div>
            </section>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="px-5 py-3 bg-slate-100 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>
            早出担当予定: <span className="font-semibold text-slate-700">神谷・紙谷・中野</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onClose}
              disabled={isSubmitting}
              className="px-4 py-2 bg-white border border-slate-300 text-slate-700 hover:bg-slate-50 font-bold rounded-lg transition-colors cursor-pointer shadow-2xs"
            >
              閉じる
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};
