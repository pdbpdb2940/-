import React, { useState, useEffect } from 'react';
import { CalendarDay, ShiftRecord, StaffMember, TaskSchedule, AbsenceType } from '../types';
import { DEFAULT_SHIFT_START, DEFAULT_SHIFT_END } from '../utils/constants';
import { getShiftStreakInfo } from '../utils/shiftContinuity';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Clock,
  Trash2,
  Edit3,
  Plus,
  AlertCircle,
  Link2,
  Calendar as CalendarIcon,
  Briefcase,
  UserCheck,
  Lock,
} from 'lucide-react';

interface ShiftModalProps {
  day: CalendarDay | null;
  staffList: StaffMember[];
  shifts: ShiftRecord[];
  tasks?: TaskSchedule[];
  initialTab?: 'shift' | 'task';
  editingTaskItem?: TaskSchedule | null;
  isOpen: boolean;
  isAdminMode?: boolean;
  onClose: () => void;
  onSaveShift: (shift: ShiftRecord) => void;
  onDeleteShift: (shiftId: string) => void;
  onDeleteMultipleShifts?: (shiftIds: string[]) => void;
  onSaveTask?: (task: TaskSchedule) => void;
  onDeleteTask?: (taskId: string) => void;
}

export const ShiftModal: React.FC<ShiftModalProps> = ({
  day,
  staffList,
  shifts,
  tasks = [],
  initialTab = 'shift',
  editingTaskItem = null,
  isOpen,
  isAdminMode = false,
  onClose,
  onSaveShift,
  onDeleteShift,
  onDeleteMultipleShifts,
  onSaveTask,
  onDeleteTask,
}) => {
  const { user, surname, loginWithGoogle, isAuthReady } = useAuth();
  const canEdit = !!user || isAdminMode;
  const currentDisplayName = surname || (isAdminMode ? '管理者' : '利用者');

  // 現在のタブ ('shift': 早出シフト, 'task': 業務予定)
  const [activeTab, setActiveTab] = useState<'shift' | 'task'>('shift');

  // 早出シフト編集状態
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [confirmDeleteShiftId, setConfirmDeleteShiftId] = useState<string | null>(null);
  const [selectedStaff, setSelectedStaff] = useState<string>('');
  const [startTime, setStartTime] = useState<string>(DEFAULT_SHIFT_START);
  const [endTime, setEndTime] = useState<string>(DEFAULT_SHIFT_END);
  const [note, setNote] = useState<string>('');
  const [shiftErrorMessage, setShiftErrorMessage] = useState<string>('');

  // 不在設定（休み・出張・研修等）
  const [isAbsence, setIsAbsence] = useState<boolean>(false);
  const [absenceType, setAbsenceType] = useState<AbsenceType>('休み');
  const [isAllDayAbsence, setIsAllDayAbsence] = useState<boolean>(true);

  // 業務予定編集状態
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [confirmDeleteTaskId, setConfirmDeleteTaskId] = useState<string | null>(null);
  const [taskTitle, setTaskTitle] = useState<string>('');
  const [taskTime, setTaskTime] = useState<string>('');
  const [taskStaff, setTaskStaff] = useState<string>('');
  const [taskNote, setTaskNote] = useState<string>('');
  const [taskErrorMessage, setTaskErrorMessage] = useState<string>('');

  // 初期化
  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      resetShiftForm();
      resetTaskForm();

      if (editingTaskItem) {
        setActiveTab('task');
        handleStartEditTask(editingTaskItem);
      }
    }
  }, [isOpen, day?.dateString, initialTab, editingTaskItem]);

  if (!isOpen || !day) return null;

  // 早出フォームリセット
  const resetShiftForm = () => {
    setEditingShiftId(null);
    setConfirmDeleteShiftId(null);
    setSelectedStaff(staffList[0]?.name || '神谷');
    setStartTime(DEFAULT_SHIFT_START);
    setEndTime(DEFAULT_SHIFT_END);
    setNote('');
    setIsAbsence(false);
    setAbsenceType('休み');
    setIsAllDayAbsence(true);
    setShiftErrorMessage('');
  };

  // 業務予定フォームリセット
  const resetTaskForm = () => {
    setEditingTaskId(null);
    setConfirmDeleteTaskId(null);
    setTaskTitle('');
    setTaskTime('');
    setTaskStaff('');
    setTaskNote('');
    setTaskErrorMessage('');
  };

  // 既存早出・不在シフトの編集開始
  const handleStartEditShift = (shift: ShiftRecord) => {
    setEditingShiftId(shift.id);
    setConfirmDeleteShiftId(null);
    setSelectedStaff(shift.staffName);
    const hasAbsence = Boolean(shift.isAbsence);
    setIsAbsence(hasAbsence);
    setAbsenceType(shift.absenceType || '休み');

    if (hasAbsence) {
      const isAllDay = shift.startTime === '終日' || (!shift.startTime && !shift.endTime) || !shift.endTime;
      setIsAllDayAbsence(isAllDay);
      setStartTime(isAllDay ? '終日' : shift.startTime);
      setEndTime(isAllDay ? '' : shift.endTime);
    } else {
      setIsAllDayAbsence(false);
      setStartTime(shift.startTime || DEFAULT_SHIFT_START);
      setEndTime(shift.endTime || DEFAULT_SHIFT_END);
    }

    setNote(shift.note || '');
    setShiftErrorMessage('');
  };

  // 既存業務予定の編集開始
  const handleStartEditTask = (task: TaskSchedule) => {
    setEditingTaskId(task.id);
    setConfirmDeleteTaskId(null);
    setTaskTitle(task.title);
    setTaskTime(task.time || '');
    setTaskStaff(task.staffName || '');
    setTaskNote(task.note || '');
    setTaskErrorMessage('');
  };

  // 早出・不在シフト保存
  const handleSaveShift = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      alert('登録するにはGoogleアカウントでログインするか、管理者としてログインしてください。');
      return;
    }
    if (!selectedStaff) {
      setShiftErrorMessage('担当職員を選択してください。');
      return;
    }

    // 通常シフトまたは時間指定不在の場合の時間バリデーション
    if (!isAbsence && (!startTime || !endTime)) {
      setShiftErrorMessage('出勤時間と退勤時間を入力してください。');
      return;
    }
    if (isAbsence && !isAllDayAbsence && (!startTime || !endTime)) {
      setShiftErrorMessage('不在の時間帯（開始・終了）を入力してください。');
      return;
    }

    const existingShift = day.shifts.find((s) => s.id === editingShiftId);
    const authorUid = user?.uid || (isAdminMode ? 'admin' : 'local-user');
    const authorName = surname || (isAdminMode ? '管理者' : selectedStaff);

    const finalStartTime = isAbsence ? (isAllDayAbsence ? '終日' : startTime) : startTime;
    const finalEndTime = isAbsence ? (isAllDayAbsence ? '' : endTime) : endTime;

    const shiftData: ShiftRecord = {
      id: editingShiftId || `shift-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: day.dateString,
      staffName: selectedStaff,
      startTime: finalStartTime,
      endTime: finalEndTime,
      note: note.trim(),
      isAbsence: isAbsence,
      absenceType: isAbsence ? absenceType : undefined,
      createdByUid: existingShift?.createdByUid || authorUid,
      createdByName: existingShift?.createdByName || authorName,
      updatedByUid: existingShift ? authorUid : undefined,
      updatedByName: existingShift ? authorName : undefined,
      createdAt: existingShift?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    onSaveShift(shiftData);
    resetShiftForm();
  };

  // 業務予定保存（予定時刻・担当職員は任意設定可能）
  const handleSaveTask = (e: React.FormEvent) => {
    e.preventDefault();
    if (!canEdit) {
      alert('登録するにはGoogleアカウントでログインするか、管理者としてログインしてください。');
      return;
    }
    if (!taskTitle.trim()) {
      setTaskErrorMessage('業務名を入力してください（例: 芝刈り、オープンキャンパス、施設点検など）。');
      return;
    }

    const currentDayTasks = day.tasks || [];
    const existingTask = currentDayTasks.find((t) => t.id === editingTaskId);
    const authorUid = user?.uid || (isAdminMode ? 'admin' : 'local-user');
    const authorName = surname || (isAdminMode ? '管理者' : (taskStaff.trim() || '登録者'));

    const taskData: TaskSchedule = {
      id: editingTaskId || `task-${Date.now()}-${Math.random().toString(36).substring(2, 7)}`,
      date: day.dateString,
      title: taskTitle.trim(),
      time: taskTime.trim(),
      staffName: taskStaff.trim(),
      note: taskNote.trim(),
      createdByUid: existingTask?.createdByUid || authorUid,
      createdByName: existingTask?.createdByName || authorName,
      updatedByUid: existingTask ? authorUid : undefined,
      updatedByName: existingTask ? authorName : undefined,
      createdAt: existingTask?.createdAt || Date.now(),
      updatedAt: Date.now(),
    };

    if (onSaveTask) {
      onSaveTask(taskData);
    }
    resetTaskForm();
  };

  // 日付表示
  const dateObj = new Date(day.dateString + 'T00:00:00');
  const monthStr = dateObj.getMonth() + 1;
  const dayStr = dateObj.getDate();
  const dayOfWeekJa = ['日', '月', '火', '水', '木', '金', '土'][dateObj.getDay()];

  const dayTasks = day.tasks || [];

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden flex flex-col max-h-[90vh] animate-in fade-in zoom-in-95 duration-150">
        {/* モーダルヘッダー */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div>
            <h2 className="text-lg font-bold flex items-center gap-2">
              <span>
                {monthStr}月{dayStr}日 ({dayOfWeekJa})
              </span>
              {day.holidayName && (
                <span className="text-xs bg-rose-500/80 text-white px-2 py-0.5 rounded-full font-normal">
                  {day.holidayName}
                </span>
              )}
            </h2>
            <p className="text-xs text-slate-300">早出シフト・業務予定の管理</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-md hover:bg-slate-800 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* タブナビゲーション */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('shift')}
            className={`flex-1 py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'shift'
                ? 'bg-white text-blue-600 border-blue-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Clock className="w-4 h-4" />
            <span>早出シフト ({day.shifts.length})</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('task')}
            className={`flex-1 py-2.5 px-4 text-xs font-bold flex items-center justify-center gap-1.5 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'task'
                ? 'bg-white text-emerald-700 border-emerald-600'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Briefcase className="w-4 h-4" />
            <span>業務予定 ({dayTasks.length})</span>
          </button>
        </div>

        {/* コンテンツエリア */}
        <div className="p-5 overflow-y-auto space-y-5 flex-1">
          {/* ===================== TAB 1: 早出シフト ===================== */}
          {activeTab === 'shift' && (
            <>
              {/* 登録済み早出一覧 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-800">
                    登録済みの早出担当（{day.shifts.length}件）
                  </h3>
                  {editingShiftId && (
                    <button
                      type="button"
                      onClick={resetShiftForm}
                      className="text-xs text-blue-600 hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 新規追加に戻る
                    </button>
                  )}
                </div>

                {day.shifts.length === 0 ? (
                  <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500">
                    この日の早出担当者はまだ登録されていません。
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {day.shifts.map((shift) => {
                      const isBeingEdited = editingShiftId === shift.id;
                      const streak = getShiftStreakInfo(shift, shifts);

                      return (
                        <div
                          key={shift.id}
                          className={`p-3 rounded-lg border transition-all ${
                            isBeingEdited
                              ? 'bg-blue-50 border-blue-400 ring-2 ring-blue-300 ring-offset-1'
                              : shift.isAbsence
                              ? shift.absenceType === '出張'
                                ? 'bg-amber-50/70 border-amber-300 hover:border-amber-400'
                                : shift.absenceType === '研修'
                                ? 'bg-indigo-50/70 border-indigo-300 hover:border-indigo-400'
                                : shift.absenceType === '休み'
                                ? 'bg-rose-50/70 border-rose-300 hover:border-rose-400'
                                : 'bg-slate-50 border-slate-300 hover:border-slate-400'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                {shift.isAbsence ? (
                                  <>
                                    <span
                                      className={`text-xs px-2 py-0.5 rounded font-bold border ${
                                        shift.absenceType === '出張'
                                          ? 'bg-amber-100 text-amber-900 border-amber-300'
                                          : shift.absenceType === '研修'
                                          ? 'bg-indigo-100 text-indigo-900 border-indigo-300'
                                          : shift.absenceType === '休み'
                                          ? 'bg-rose-100 text-rose-900 border-rose-300'
                                          : 'bg-slate-200 text-slate-800 border-slate-300'
                                      }`}
                                    >
                                      {shift.absenceType === '出張'
                                        ? '💼 出張'
                                        : shift.absenceType === '研修'
                                        ? '🎓 研修'
                                        : shift.absenceType === '休み'
                                        ? '🏖️ 休み'
                                        : '📌 不在'}
                                    </span>
                                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                                      {shift.staffName}
                                    </span>
                                    <span className="text-xs bg-white/90 text-slate-700 px-2 py-0.5 rounded font-mono font-bold border border-slate-300">
                                      {shift.startTime === '終日' || !shift.endTime
                                        ? '終日不在'
                                        : `${shift.startTime}～${shift.endTime}`}
                                    </span>
                                  </>
                                ) : (
                                  <>
                                    <span className="font-bold text-slate-900 text-sm sm:text-base">
                                      早出担当者: {shift.staffName}
                                    </span>
                                    <span className="text-xs bg-slate-200 text-slate-700 px-2 py-0.5 rounded font-mono font-bold">
                                      {shift.startTime}～{shift.endTime}
                                    </span>
                                  </>
                                )}
                              </div>

                              {/* 連続シフト・連続不在情報バッジ */}
                              {streak.isStreak && (
                                <div
                                  className={`text-[11px] px-2 py-0.5 rounded mt-1.5 inline-flex items-center gap-1 font-medium border ${
                                    shift.isAbsence
                                      ? 'bg-amber-100/90 text-amber-900 border-amber-300'
                                      : 'bg-blue-100/80 text-blue-800 border-blue-200'
                                  }`}
                                >
                                  <Link2 className="w-3 h-3 text-current" />
                                  <span>
                                    {streak.totalDays}日間連続{shift.isAbsence ? (shift.absenceType || '不在') : '勤務'}（
                                    {streak.startDate.substring(5)} ～ {streak.endDate.substring(5)}）
                                  </span>
                                  <span className="font-bold ml-1">
                                    [{streak.dayIndex}日目]
                                  </span>
                                </div>
                              )}

                              {shift.note && (
                                <div className="text-xs text-slate-600 mt-1">
                                  備考: {shift.note}
                                </div>
                              )}

                              {/* 登録者情報の表示（早出担当者とは別であることを明示） */}
                              <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-200/80 text-[11px] text-slate-500">
                                <span>
                                  登録者：
                                  <span className="font-semibold text-slate-700">
                                    {shift.createdByName || '自動記録'}
                                  </span>
                                </span>
                                {shift.updatedByName && (
                                  <span>
                                    （最終更新：
                                    <span className="font-semibold text-slate-700">
                                      {shift.updatedByName}
                                    </span>
                                    ）
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 編集・削除ボタン（ログイン時または管理者モード時利用可能） */}
                            {canEdit && confirmDeleteShiftId !== shift.id && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditShift(shift)}
                                  className="p-1.5 text-slate-600 hover:text-blue-600 hover:bg-white rounded-md border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                                  title="修正・編集"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteShiftId(shift.id)}
                                  className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-white rounded-md border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                                  title="削除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 削除確認パネル */}
                          {confirmDeleteShiftId === shift.id && (
                            <div className="mt-2 pt-2 border-t border-rose-200 bg-rose-50/70 p-2.5 rounded text-xs text-rose-900 space-y-2">
                              <div className="font-bold flex items-center gap-1">
                                <AlertCircle className="w-4 h-4 text-rose-600" />
                                <span>このシフトを削除しますか？</span>
                              </div>
                              <div className="flex items-center justify-end gap-1.5 flex-wrap pt-1">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteShiftId(null)}
                                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    onDeleteShift(shift.id);
                                    if (editingShiftId === shift.id) {
                                      resetShiftForm();
                                    }
                                    setConfirmDeleteShiftId(null);
                                  }}
                                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded transition-colors shadow-2xs cursor-pointer"
                                >
                                  {streak.isStreak ? 'この日のみ削除' : '削除する'}
                                </button>
                                {streak.isStreak && onDeleteMultipleShifts && (
                                  <button
                                    type="button"
                                    onClick={() => {
                                      onDeleteMultipleShifts(streak.streakShiftIds);
                                      if (editingShiftId === shift.id) {
                                        resetShiftForm();
                                      }
                                      setConfirmDeleteShiftId(null);
                                    }}
                                    className="bg-rose-800 hover:bg-rose-900 text-white font-bold px-2.5 py-1 rounded transition-colors shadow-2xs cursor-pointer"
                                  >
                                    連続{streak.totalDays}日を一括削除
                                  </button>
                                )}
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 未ログイン案内 または 入力フォーム */}
              {!isAuthReady ? (
                <div className="border-t border-slate-200 pt-4 bg-slate-50 p-6 rounded-lg text-center space-y-2">
                  <div className="text-xs font-semibold text-slate-500 animate-pulse">
                    ログイン認証状態を確認中...
                  </div>
                </div>
              ) : !canEdit ? (
                <div className="border-t border-slate-200 pt-4 bg-slate-50 p-4 rounded-lg text-center space-y-2.5">
                  <div className="w-8 h-8 rounded-full bg-blue-100 text-blue-600 flex items-center justify-center mx-auto">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    シフトの登録・編集にはログインが必要です
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    カレンダーの閲覧は可能ですが、登録・変更・削除を行うにはGoogleアカウントでログインするか、右上の管理者からログインしてください。
                  </p>
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-blue-600 hover:bg-blue-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Googleアカウントでログイン</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveShift} className="border-t border-slate-200 pt-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      {editingShiftId
                        ? isAbsence
                          ? '不在設定の修正'
                          : '早出担当者の修正'
                        : isAbsence
                        ? `職員の不在（${absenceType}）の登録`
                        : '新しい早出の登録'}
                    </span>
                    <span className="text-xs text-blue-600 font-medium">
                      登録者: <span className="font-bold">{currentDisplayName}</span>（自動記録）
                    </span>
                  </div>

                  {shiftErrorMessage && (
                    <div className="flex items-center gap-1.5 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{shiftErrorMessage}</span>
                    </div>
                  )}

                  {/* 担当職員選択 */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      対象職員 <span className="text-rose-500">*</span>
                    </label>
                    <div className="flex items-center gap-1.5 flex-wrap mb-2">
                      {staffList.map((staff) => {
                        const isSelected = selectedStaff === staff.name;
                        return (
                          <button
                            key={staff.id}
                            type="button"
                            onClick={() => setSelectedStaff(staff.name)}
                            className={`px-3 py-1.5 rounded-md text-xs font-bold transition-all border cursor-pointer ${
                              isSelected
                                ? `${staff.colorBg} ${staff.colorText} ${staff.colorBorder} ring-2 ring-blue-400 shadow-2xs`
                                : 'bg-white text-slate-700 border-slate-300 hover:bg-slate-50'
                            }`}
                          >
                            {staff.name}
                          </button>
                        );
                      })}
                    </div>
                  </div>

                  {/* 休み・出張などの不在設定チェックボックス */}
                  <div
                    className={`p-3 rounded-lg border transition-all ${
                      isAbsence
                        ? 'bg-amber-50/90 border-amber-300 ring-2 ring-amber-300/60 shadow-2xs'
                        : 'bg-slate-50 border-slate-200 hover:bg-slate-100/70'
                    }`}
                  >
                    <label className="flex items-center gap-2.5 cursor-pointer select-none">
                      <input
                        type="checkbox"
                        checked={isAbsence}
                        onChange={(e) => {
                          const checked = e.target.checked;
                          setIsAbsence(checked);
                          if (checked) {
                            if (!absenceType) setAbsenceType('休み');
                            if (isAllDayAbsence) {
                              setStartTime('終日');
                              setEndTime('');
                            }
                          } else {
                            setStartTime(DEFAULT_SHIFT_START);
                            setEndTime(DEFAULT_SHIFT_END);
                          }
                        }}
                        className="w-4.5 h-4.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer accent-amber-600"
                      />
                      <div className="flex-1 flex items-center justify-between">
                        <span className="text-xs font-bold text-slate-900 flex items-center gap-1.5">
                          <span className="text-base leading-none">
                            {isAbsence
                              ? absenceType === '出張'
                                ? '💼'
                                : absenceType === '研修'
                                ? '🎓'
                                : '🏖️'
                              : '📋'}
                          </span>
                          <span>職員の不在（休み・出張・研修など）として登録</span>
                        </span>
                        <span
                          className={`text-[10.5px] px-2 py-0.5 rounded-full font-bold transition-colors ${
                            isAbsence
                              ? 'bg-amber-500 text-white shadow-2xs'
                              : 'bg-slate-200 text-slate-600'
                          }`}
                        >
                          {isAbsence ? '不在モード ON' : '通常早出'}
                        </span>
                      </div>
                    </label>

                    {/* 不在モードON時の設定詳細 */}
                    {isAbsence && (
                      <div className="mt-3 pt-2.5 border-t border-amber-200/80 space-y-2.5 animate-in fade-in duration-150">
                        <div>
                          <label className="block text-[11px] font-bold text-amber-950 mb-1.5">
                            不在の種別を選択してください <span className="text-rose-500">*</span>
                          </label>
                          <div className="grid grid-cols-4 gap-1.5">
                            {[
                              {
                                type: '休み',
                                label: '休み・有休',
                                icon: '🏖️',
                                color: 'border-rose-400 bg-rose-50 text-rose-900',
                              },
                              {
                                type: '出張',
                                label: '出張',
                                icon: '💼',
                                color: 'border-amber-400 bg-amber-50 text-amber-900',
                              },
                              {
                                type: '研修',
                                label: '研修',
                                icon: '🎓',
                                color: 'border-indigo-400 bg-indigo-50 text-indigo-900',
                              },
                              {
                                type: 'その他',
                                label: 'その他不在',
                                icon: '📌',
                                color: 'border-slate-400 bg-slate-100 text-slate-900',
                              },
                            ].map((item) => {
                              const isSelected = absenceType === item.type;
                              return (
                                <button
                                  key={item.type}
                                  type="button"
                                  onClick={() => setAbsenceType(item.type as AbsenceType)}
                                  className={`py-1.5 px-1.5 rounded-md text-xs font-bold transition-all border flex flex-col items-center gap-0.5 cursor-pointer ${
                                    isSelected
                                      ? `${item.color} ring-2 ring-amber-400 shadow-2xs font-black`
                                      : 'bg-white text-slate-700 border-slate-200 hover:bg-slate-50'
                                  }`}
                                >
                                  <span className="text-base leading-none">{item.icon}</span>
                                  <span className="text-[10.5px] whitespace-nowrap">{item.label}</span>
                                </button>
                              );
                            })}
                          </div>
                        </div>

                        {/* 終日不在フラグ */}
                        <div className="flex items-center justify-between pt-1">
                          <label className="flex items-center gap-1.5 cursor-pointer text-xs font-semibold text-slate-800 select-none">
                            <input
                              type="checkbox"
                              checked={isAllDayAbsence}
                              onChange={(e) => {
                                const checked = e.target.checked;
                                setIsAllDayAbsence(checked);
                                if (checked) {
                                  setStartTime('終日');
                                  setEndTime('');
                                } else {
                                  setStartTime('09:00');
                                  setEndTime('17:00');
                                }
                              }}
                              className="w-3.5 h-3.5 text-amber-600 rounded border-slate-300 focus:ring-amber-500 cursor-pointer accent-amber-600"
                            />
                            <span>終日不在（時間帯の入力不要）</span>
                          </label>
                          <span className="text-[10px] text-amber-900 bg-amber-100/90 px-2 py-0.5 rounded font-medium">
                            {isAllDayAbsence ? 'カレンダーに「終日」として表示' : '時間指定モード'}
                          </span>
                        </div>
                      </div>
                    )}
                  </div>

                  {/* 時間設定 */}
                  {isAbsence && isAllDayAbsence ? (
                    <div className="p-3 bg-amber-50/80 border border-amber-200 rounded-md text-xs text-amber-900 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-amber-600 shrink-0" />
                      <span>
                        <strong className="font-bold">終日不在</strong>として登録されます（出勤・退勤時刻の入力は不要です）。
                      </span>
                    </div>
                  ) : (
                    <div className="space-y-1">
                      <div className="flex items-center justify-between">
                        <span className="text-xs font-semibold text-slate-700">
                          {isAbsence ? '不在の時間帯' : '勤務時間'}
                        </span>
                        {!isAbsence && (
                          <button
                            type="button"
                            onClick={() => {
                              setStartTime(DEFAULT_SHIFT_START);
                              setEndTime(DEFAULT_SHIFT_END);
                            }}
                            className="text-[11px] text-blue-600 hover:text-blue-800 font-semibold cursor-pointer"
                          >
                            定時 (7:30～16:15) に設定
                          </button>
                        )}
                      </div>
                      <div className="grid grid-cols-2 gap-3">
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-0.5">
                            {isAbsence ? '開始時間' : '出勤時間'}
                          </label>
                          <input
                            type="time"
                            value={startTime}
                            onChange={(e) => setStartTime(e.target.value)}
                            className="w-full text-sm font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 text-center"
                            required
                          />
                        </div>
                        <div>
                          <label className="block text-[11px] text-slate-500 mb-0.5">
                            {isAbsence ? '終了時間' : '退勤時間'}
                          </label>
                          <input
                            type="time"
                            value={endTime}
                            onChange={(e) => setEndTime(e.target.value)}
                            className="w-full text-sm font-semibold px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500 text-center"
                            required
                          />
                        </div>
                      </div>
                    </div>
                  )}

                  {/* 備考入力 */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">備考（任意）</label>
                    <input
                      type="text"
                      value={note}
                      onChange={(e) => setNote(e.target.value)}
                      placeholder={isAbsence ? "例: ○○出張、年次有給休暇など" : "例: 開館点検、施設巡回など"}
                      className="w-full text-sm px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-blue-500"
                    />
                  </div>

                  {/* アクションボタン */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      閉じる
                    </button>
                    <button
                      type="submit"
                      className={`px-5 py-2 text-xs sm:text-sm font-bold text-white rounded-md shadow-xs transition-colors cursor-pointer ${
                        isAbsence
                          ? 'bg-amber-600 hover:bg-amber-700'
                          : 'bg-blue-600 hover:bg-blue-700'
                      }`}
                    >
                      {editingShiftId
                        ? '変更を保存する'
                        : isAbsence
                        ? `${absenceType}を登録する`
                        : '早出を登録する'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}

          {/* ===================== TAB 2: 業務予定 ===================== */}
          {activeTab === 'task' && (
            <>
              {/* 登録済み業務予定一覧 */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <h3 className="text-sm font-bold text-slate-800">
                    登録済みの業務予定（{dayTasks.length}件）
                  </h3>
                  {editingTaskId && (
                    <button
                      type="button"
                      onClick={resetTaskForm}
                      className="text-xs text-emerald-600 hover:underline flex items-center gap-0.5 font-medium cursor-pointer"
                    >
                      <Plus className="w-3.5 h-3.5" /> 新規追加に戻る
                    </button>
                  )}
                </div>

                {dayTasks.length === 0 ? (
                  <div className="text-center py-4 bg-slate-50 border border-dashed border-slate-300 rounded-lg text-xs text-slate-500">
                    この日の業務予定はまだ登録されていません。
                  </div>
                ) : (
                  <div className="space-y-2.5">
                    {dayTasks.map((task) => {
                      const isBeingEdited = editingTaskId === task.id;

                      return (
                        <div
                          key={task.id}
                          className={`p-3 rounded-lg border transition-all ${
                            isBeingEdited
                              ? 'bg-emerald-50 border-emerald-400 ring-2 ring-emerald-300 ring-offset-1'
                              : 'bg-slate-50 border-slate-200 hover:border-slate-300'
                          }`}
                        >
                          <div className="flex items-start justify-between gap-2">
                            <div className="flex-1">
                              <div className="flex items-center gap-2 flex-wrap">
                                <span className="font-bold text-slate-900 text-sm sm:text-base flex items-center gap-1">
                                  <span className="text-emerald-700">■</span>
                                  <span>{task.title}</span>
                                </span>
                                {task.time ? (
                                  <span className="text-xs bg-emerald-100 text-emerald-800 px-2 py-0.5 rounded font-mono font-bold">
                                    {task.time}
                                  </span>
                                ) : (
                                  <span className="text-[11px] bg-slate-100 text-slate-500 px-1.5 py-0.5 rounded font-medium">
                                    時間指定なし
                                  </span>
                                )}
                              </div>

                              <div className="text-xs font-medium text-slate-700 mt-1">
                                {task.staffName ? (
                                  <span>
                                    担当：<strong className="text-slate-900">{task.staffName}</strong> さん
                                  </span>
                                ) : (
                                  <span className="text-slate-500">担当：指定なし（全体予定）</span>
                                )}
                              </div>

                              {task.note && (
                                <div className="text-xs text-slate-600 mt-0.5">
                                  備考: {task.note}
                                </div>
                              )}

                              {/* 登録者情報の表示（担当者と登録者は分離） */}
                              <div className="flex items-center gap-2 mt-2 pt-1.5 border-t border-slate-200/80 text-[11px] text-slate-500">
                                <span>
                                  登録者：
                                  <span className="font-semibold text-slate-700">
                                    {task.createdByName || '自動記録'}
                                  </span>
                                </span>
                                {task.updatedByName && (
                                  <span>
                                    （最終更新：
                                    <span className="font-semibold text-slate-700">
                                      {task.updatedByName}
                                    </span>
                                    ）
                                  </span>
                                )}
                              </div>
                            </div>

                            {/* 編集・削除ボタン（ログイン時または管理者モード時利用可能） */}
                            {canEdit && confirmDeleteTaskId !== task.id && (
                              <div className="flex items-center gap-1.5 shrink-0">
                                <button
                                  type="button"
                                  onClick={() => handleStartEditTask(task)}
                                  className="p-1.5 text-slate-600 hover:text-emerald-700 hover:bg-white rounded-md border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                                  title="修正・編集"
                                >
                                  <Edit3 className="w-4 h-4" />
                                </button>
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTaskId(task.id)}
                                  className="p-1.5 text-slate-600 hover:text-rose-600 hover:bg-white rounded-md border border-transparent hover:border-slate-200 transition-colors cursor-pointer"
                                  title="削除"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            )}
                          </div>

                          {/* 削除確認パネル */}
                          {confirmDeleteTaskId === task.id && (
                            <div className="mt-2 pt-2 border-t border-rose-200 bg-rose-50/70 p-2.5 rounded text-xs text-rose-900 space-y-2">
                              <div className="font-bold flex items-center gap-1">
                                <AlertCircle className="w-4 h-4 text-rose-600" />
                                <span>この業務予定を削除しますか？</span>
                              </div>
                              <div className="flex items-center justify-end gap-1.5 pt-1">
                                <button
                                  type="button"
                                  onClick={() => setConfirmDeleteTaskId(null)}
                                  className="px-2.5 py-1 bg-white border border-slate-300 text-slate-700 rounded hover:bg-slate-100 cursor-pointer"
                                >
                                  取消
                                </button>
                                <button
                                  type="button"
                                  onClick={() => {
                                    if (onDeleteTask) onDeleteTask(task.id);
                                    if (editingTaskId === task.id) resetTaskForm();
                                    setConfirmDeleteTaskId(null);
                                  }}
                                  className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-2.5 py-1 rounded transition-colors shadow-2xs cursor-pointer"
                                >
                                  削除する
                                </button>
                              </div>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>

              {/* 未ログイン案内 または 業務予定入力フォーム */}
              {!isAuthReady ? (
                <div className="border-t border-slate-200 pt-4 bg-slate-50 p-6 rounded-lg text-center space-y-2">
                  <div className="text-xs font-semibold text-slate-500 animate-pulse">
                    ログイン認証状態を確認中...
                  </div>
                </div>
              ) : !canEdit ? (
                <div className="border-t border-slate-200 pt-4 bg-slate-50 p-4 rounded-lg text-center space-y-2.5">
                  <div className="w-8 h-8 rounded-full bg-emerald-100 text-emerald-600 flex items-center justify-center mx-auto">
                    <Lock className="w-4 h-4" />
                  </div>
                  <div className="text-xs font-bold text-slate-800">
                    業務予定の登録・編集にはログインが必要です
                  </div>
                  <p className="text-[11px] text-slate-500 max-w-xs mx-auto">
                    カレンダーの閲覧は可能ですが、登録・変更・削除を行うにはGoogleアカウントでログインするか、右上の管理者からログインしてください。
                  </p>
                  <button
                    type="button"
                    onClick={loginWithGoogle}
                    className="inline-flex items-center gap-1.5 px-4 py-2 bg-emerald-600 hover:bg-emerald-700 text-white text-xs font-bold rounded-lg shadow-xs transition-colors cursor-pointer"
                  >
                    <span>Googleアカウントでログイン</span>
                  </button>
                </div>
              ) : (
                <form onSubmit={handleSaveTask} className="border-t border-slate-200 pt-4 space-y-3.5">
                  <div className="flex items-center justify-between">
                    <span className="text-sm font-bold text-slate-900">
                      {editingTaskId ? '業務予定の修正' : '新しい業務予定の登録'}
                    </span>
                    <span className="text-xs text-emerald-700 font-medium">
                      登録者: <span className="font-bold">{currentDisplayName}</span>（自動記録）
                    </span>
                  </div>

                  {taskErrorMessage && (
                    <div className="flex items-center gap-1.5 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
                      <AlertCircle className="w-4 h-4 shrink-0" />
                      <span>{taskErrorMessage}</span>
                    </div>
                  )}

                  {/* 業務名 */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      業務名 <span className="text-rose-500">*</span>
                    </label>
                    <input
                      type="text"
                      required
                      value={taskTitle}
                      onChange={(e) => setTaskTitle(e.target.value)}
                      placeholder="例: 芝刈り、施設点検、受水槽清掃など"
                      className="w-full text-sm font-bold px-3 py-2 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* 時間 & 担当職員（任意） */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          予定時間 <span className="text-slate-400 font-normal">（任意）</span>
                        </label>
                        {taskTime && (
                          <button
                            type="button"
                            onClick={() => setTaskTime('')}
                            className="text-[10px] text-slate-500 hover:text-slate-700 underline cursor-pointer"
                          >
                            クリア
                          </button>
                        )}
                      </div>
                      <input
                        type="text"
                        value={taskTime}
                        onChange={(e) => setTaskTime(e.target.value)}
                        placeholder="例: 09:00～11:30（未入力可）"
                        className="w-full text-sm px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 font-mono"
                      />
                      {/* クイック入力候補 */}
                      <div className="flex items-center gap-1 mt-1 flex-wrap">
                        {['09:00～11:30', '午前', '午後', '終日'].map((preset) => (
                          <button
                            key={preset}
                            type="button"
                            onClick={() => setTaskTime(preset)}
                            className="text-[10px] px-1.5 py-0.5 bg-slate-100 hover:bg-emerald-100 hover:text-emerald-800 text-slate-600 rounded border border-slate-200 transition-colors cursor-pointer"
                          >
                            {preset}
                          </button>
                        ))}
                      </div>
                    </div>
                    <div>
                      <div className="flex items-center justify-between mb-1">
                        <label className="block text-xs font-semibold text-slate-700">
                          担当職員 <span className="text-slate-400 font-normal">（任意）</span>
                        </label>
                        {taskStaff && (
                          <button
                            type="button"
                            onClick={() => setTaskStaff('')}
                            className="text-[10px] text-slate-500 hover:text-slate-700 underline cursor-pointer"
                          >
                            指定なしにする
                          </button>
                        )}
                      </div>
                      <select
                        value={taskStaff}
                        onChange={(e) => setTaskStaff(e.target.value)}
                        className="w-full text-sm font-medium px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500 cursor-pointer"
                      >
                        <option value="">指定なし（未定・全体など）</option>
                        {staffList.map((staff) => (
                          <option key={staff.id} value={staff.name}>
                            {staff.name} さん
                          </option>
                        ))}
                      </select>
                      <div className="text-[10px] text-slate-400 mt-1">
                        ※担当者を指定せず全体の予定としても登録できます
                      </div>
                    </div>
                  </div>

                  {/* 備考 */}
                  <div>
                    <label className="block text-xs font-semibold text-slate-700 mb-1">
                      備考・場所など（任意）
                    </label>
                    <input
                      type="text"
                      value={taskNote}
                      onChange={(e) => setTaskNote(e.target.value)}
                      placeholder="例: 中庭芝生、北館屋上など"
                      className="w-full text-sm px-3 py-1.5 bg-white border border-slate-300 rounded-md focus:ring-2 focus:ring-emerald-500"
                    />
                  </div>

                  {/* アクションボタン */}
                  <div className="flex items-center justify-end gap-2 pt-2">
                    <button
                      type="button"
                      onClick={onClose}
                      className="px-4 py-2 text-xs sm:text-sm font-medium text-slate-600 hover:text-slate-800 bg-slate-100 hover:bg-slate-200 rounded-md transition-colors cursor-pointer"
                    >
                      閉じる
                    </button>
                    <button
                      type="submit"
                      className="px-5 py-2 text-xs sm:text-sm font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition-colors cursor-pointer"
                    >
                      {editingTaskId ? '業務の変更を保存' : '業務予定を登録する'}
                    </button>
                  </div>
                </form>
              )}
            </>
          )}
        </div>
      </div>
    </div>
  );
};
