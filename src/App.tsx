import React, { useState, useMemo, useEffect } from 'react';
import { ShiftRecord, StaffMember, CalendarDay, TaskSchedule, BiweeklyRotationConfig } from './types';
import { Header } from './components/Header';
import { CalendarGrid } from './components/CalendarGrid';
import { ShiftModal } from './components/ShiftModal';
import { BatchShiftModal } from './components/BatchShiftModal';
import { RotationSettingModal } from './components/RotationSettingModal';
import { StaffManageModal } from './components/StaffManageModal';
import { CsvModal } from './components/CsvModal';
import { PrintModal } from './components/PrintModal';
import { MonthNotes } from './components/MonthNotes';
import { AdminLoginModal } from './components/AdminLoginModal';
import { AdminSettingsModal } from './components/AdminSettingsModal';
import { ShareAppModal } from './components/ShareAppModal';
import { AdminAuditLogModal } from './components/AdminAuditLogModal';
import { SurnameEditModal } from './components/SurnameEditModal';
import { buildCalendarDays } from './utils/calendar';
import { useAuth } from './context/AuthContext';
import {
  loadRotationConfigFromStorage,
  saveRotationConfigToStorage,
  loadCustomEditedDatesFromStorage,
  saveCustomEditedDatesToStorage,
} from './utils/rotation';
import {
  loadShiftsFromStorage,
  saveShiftsToStorage,
  saveShiftsToStorageAsync,
  loadStaffFromStorage,
  saveStaffToStorage,
  loadMonthNoteFromStorage,
  saveMonthNoteToStorage,
  loadAdminPinFromStorage,
  saveAdminPinToStorage,
  loadStartOfWeekFromStorage,
  saveStartOfWeekToStorage,
} from './utils/storage';
import {
  saveShiftToCloud,
  saveShiftsBatchToCloud,
  deleteShiftFromCloud,
  deleteShiftsBatchFromCloud,
  saveNoteToCloud,
  saveTaskToCloud,
  deleteTaskFromCloud,
  addAuditLogToCloud,
  saveStaffListToCloud,
  saveRotationConfigToCloud,
  saveCustomEditedDatesToCloud,
  subscribeShifts,
  subscribeTasks,
  subscribeStaff,
  subscribeConfig,
} from './services/firestoreService';
import {
  fetchAppData,
  syncAppDataWithServer,
  apiSaveShifts,
  apiSaveStaff,
  apiSaveTasks,
  apiSaveAuditLog,
  apiSaveNote,
} from './utils/api';
import { STAFF_COLOR_PALETTES } from './utils/constants';

export default function App() {
  const { user, surname } = useAuth();
  const today = new Date();
  const [currentYear, setCurrentYear] = useState<number>(today.getFullYear());
  const [currentMonth, setCurrentMonth] = useState<number>(today.getMonth() + 1); // 1-12

  // 利用者モードと管理者モードの分離（初期値: false = 一般利用者モード）
  const [isAdminMode, setIsAdminMode] = useState<boolean>(false);

  // 早出シフトデータと職員名簿の状態（LocalStorage & Firestoreクラウドリアルタイム同期）
  const [shifts, setShifts] = useState<ShiftRecord[]>(() => loadShiftsFromStorage());
  const [staffList, setStaffList] = useState<StaffMember[]>(() => loadStaffFromStorage());
  const [tasks, setTasks] = useState<TaskSchedule[]>([]);
  const [cloudNotes, setCloudNotes] = useState<Record<string, string>>({});

  // 当月の連絡事項・申し送りメモ（年月ごとにLocalStorage連携）
  const [monthNote, setMonthNote] = useState<string>(() =>
    loadMonthNoteFromStorage(today.getFullYear(), today.getMonth() + 1)
  );

  // 初回起動時: サーバー（/api/data）から保存済みデータを取得してローカル状態と統合、およびFirestoreリアルタイムリスナー起動
  useEffect(() => {
    let isMounted = true;

    // サーバーデータ取得
    fetchAppData().then((serverData) => {
      if (!isMounted || !serverData) return;
      if (Array.isArray(serverData.shifts) && serverData.shifts.length > 0) {
        setShifts((prev) => (prev.length === 0 ? serverData.shifts : prev));
      }
      if (Array.isArray(serverData.staffList) && serverData.staffList.length > 0) {
        setStaffList((prev) => (prev.length === 0 ? serverData.staffList : prev));
      }
      if (Array.isArray(serverData.tasks) && serverData.tasks.length > 0) {
        setTasks((prev) => (prev.length === 0 ? serverData.tasks : prev));
      }
      if (serverData.notes) {
        setCloudNotes((prev) => ({ ...serverData.notes, ...prev }));
      }
    });

    // クラウドFirestoreのバックグラウンド・リアルタイム同期リスナー（他端末・他画面での更新を即時反映）
    const unsubShifts = subscribeShifts((cloudShifts) => {
      if (!isMounted) return;
      if (cloudShifts.length > 0) {
        setShifts(cloudShifts);
        try {
          localStorage.setItem('shifttable_records_v1', JSON.stringify(cloudShifts));
        } catch {}
      }
    }, shifts);

    const unsubTasks = subscribeTasks((cloudTasks) => {
      if (!isMounted) return;
      setTasks(cloudTasks);
    });

    const unsubStaff = subscribeStaff((cloudStaff) => {
      if (!isMounted) return;
      if (cloudStaff.length > 0) {
        setStaffList(cloudStaff);
        try {
          localStorage.setItem('shifttable_staff_v1', JSON.stringify(cloudStaff));
        } catch {}
      }
    }, staffList);

    const unsubConfig = subscribeConfig((config) => {
      if (!isMounted) return;
      if (config.notes) {
        setCloudNotes((prev) => ({ ...prev, ...config.notes }));
      }
      if (config.rotationConfig) {
        setRotationConfig(config.rotationConfig);
        saveRotationConfigToStorage(config.rotationConfig);
      }
      if (config.customEditedDates && Array.isArray(config.customEditedDates)) {
        const dateSet = new Set(config.customEditedDates);
        setCustomEditedDates(dateSet);
        saveCustomEditedDatesToStorage(dateSet);
      }
    });

    return () => {
      isMounted = false;
      unsubShifts();
      unsubTasks();
      unsubStaff();
      unsubConfig();
    };
  }, []);

  // 年月が切り替わったときに該当月のメモを反映
  useEffect(() => {
    const currentKey = `facility_shift_note_${currentYear}_${String(currentMonth).padStart(2, '0')}`;
    if (cloudNotes[currentKey] !== undefined) {
      setMonthNote(cloudNotes[currentKey]);
    } else {
      setMonthNote(loadMonthNoteFromStorage(currentYear, currentMonth));
    }
  }, [currentYear, currentMonth, cloudNotes]);

  const handleChangeNote = (newNote: string) => {
    setMonthNote(newNote);
    saveMonthNoteToStorage(currentYear, currentMonth, newNote);
    const currentKey = `facility_shift_note_${currentYear}_${String(currentMonth).padStart(2, '0')}`;
    setCloudNotes((prev) => ({ ...prev, [currentKey]: newNote }));
    apiSaveNote(currentKey, newNote);
    saveNoteToCloud(currentKey, newNote);
  };

  // モーダル・パネルの開閉状態
  const [selectedDay, setSelectedDay] = useState<CalendarDay | null>(null);
  const [isShiftModalOpen, setIsShiftModalOpen] = useState<boolean>(false);
  const [modalInitialTab, setModalInitialTab] = useState<'shift' | 'task'>('shift');
  const [editingShiftItem, setEditingShiftItem] = useState<ShiftRecord | null>(null);
  const [editingTaskItem, setEditingTaskItem] = useState<TaskSchedule | null>(null);

  // 週の開始曜日（'sun' | 'mon'、初期値: 'sun'）
  const [startOfWeek, setStartOfWeek] = useState<'sun' | 'mon'>(() => loadStartOfWeekFromStorage());

  const handleToggleStartOfWeek = () => {
    setStartOfWeek((prev) => {
      const next = prev === 'sun' ? 'mon' : 'sun';
      saveStartOfWeekToStorage(next);
      return next;
    });
  };

  // 隔週2名体制シフト設定・手動個別変更日セット
  const [rotationConfig, setRotationConfig] = useState<BiweeklyRotationConfig>(() =>
    loadRotationConfigFromStorage()
  );
  const [customEditedDates, setCustomEditedDates] = useState<Set<string>>(() =>
    loadCustomEditedDatesFromStorage()
  );
  const [isRotationModalOpen, setIsRotationModalOpen] = useState<boolean>(false);

  const [isBatchModalOpen, setIsBatchModalOpen] = useState<boolean>(false);
  const [isStaffModalOpen, setIsStaffModalOpen] = useState<boolean>(false);
  const [isCsvModalOpen, setIsCsvModalOpen] = useState<boolean>(false);
  const [isPrintModalOpen, setIsPrintModalOpen] = useState<boolean>(false);
  const [isAdminLoginModalOpen, setIsAdminLoginModalOpen] = useState<boolean>(false);
  const [isAdminSettingsModalOpen, setIsAdminSettingsModalOpen] = useState<boolean>(false);
  const [isShareModalOpen, setIsShareModalOpen] = useState<boolean>(false);
  const [isAuditLogOpen, setIsAuditLogOpen] = useState<boolean>(false);
  const [isSurnameModalOpen, setIsSurnameModalOpen] = useState<boolean>(false);

  // 連続シフト結合（帯状表示）のステート（デフォルトON）
  const [mergeConsecutive, setMergeConsecutive] = useState<boolean>(true);

  // 月間カレンダーグリッドの生成（メモ化）
  const calendarDays = useMemo(() => {
    return buildCalendarDays(currentYear, currentMonth, shifts, tasks, startOfWeek);
  }, [currentYear, currentMonth, shifts, tasks, startOfWeek]);

  // 選択中の日付データが更新された場合（シフト追加・削除時）に同期
  useEffect(() => {
    if (selectedDay) {
      const updatedDay = calendarDays.find((d) => d.dateString === selectedDay.dateString);
      if (updatedDay) {
        setSelectedDay(updatedDay);
      }
    }
  }, [calendarDays]);

  // ナビゲーションハンドラー
  const handlePrevMonth = () => {
    if (currentMonth === 1) {
      setCurrentYear((y) => y - 1);
      setCurrentMonth(12);
    } else {
      setCurrentMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (currentMonth === 12) {
      setCurrentYear((y) => y + 1);
      setCurrentMonth(1);
    } else {
      setCurrentMonth((m) => m + 1);
    }
  };

  const handlePrevYear = () => {
    setCurrentYear((y) => y - 1);
  };

  const handleNextYear = () => {
    setCurrentYear((y) => y + 1);
  };

  const handleToday = () => {
    const now = new Date();
    setCurrentYear(now.getFullYear());
    setCurrentMonth(now.getMonth() + 1);
  };

  // 日付セルクリック
  const handleSelectDay = (day: CalendarDay) => {
    setSelectedDay(day);
    setModalInitialTab('shift');
    setEditingShiftItem(null);
    setEditingTaskItem(null);
    setIsShiftModalOpen(true);
  };

  // シフトバークリック（職員の早出・不在シフトを直接編集）
  const handleSelectShift = (shift: ShiftRecord, day: CalendarDay) => {
    setSelectedDay(day);
    setModalInitialTab('shift');
    setEditingShiftItem(shift);
    setEditingTaskItem(null);
    setIsShiftModalOpen(true);
  };

  // 業務予定クリック
  const handleSelectTask = (task: TaskSchedule, day: CalendarDay) => {
    setSelectedDay(day);
    setModalInitialTab('task');
    setEditingShiftItem(null);
    setEditingTaskItem(task);
    setIsShiftModalOpen(true);
  };

  // クイック追加ボタンクリック
  const handleAddShiftToDay = (day: CalendarDay, e: React.MouseEvent) => {
    e.stopPropagation();
    setSelectedDay(day);
    setModalInitialTab('shift');
    setEditingShiftItem(null);
    setEditingTaskItem(null);
    setIsShiftModalOpen(true);
  };

  // シフト保存（新規登録または更新）
  const handleSaveShift = (shiftToSave: ShiftRecord) => {
    const exists = shifts.some((s) => s.id === shiftToSave.id);
    let updated: ShiftRecord[];

    if (exists) {
      updated = shifts.map((s) => (s.id === shiftToSave.id ? shiftToSave : s));
    } else {
      updated = [...shifts, shiftToSave];
    }

    setShifts(updated);
    saveShiftsToStorage(updated);
    // クラウドFirestoreへ即座に送信
    saveShiftToCloud(shiftToSave).catch((err) => console.warn('Cloud save error:', err));

    // 個別手動変更日として記録・保護
    setCustomEditedDates((prev) => {
      const next = new Set(prev);
      next.add(shiftToSave.date);
      saveCustomEditedDatesToStorage(next);
      saveCustomEditedDatesToCloud(Array.from(next)).catch(console.warn);
      return next;
    });

    // 管理者監査ログを記録
    const shiftPrefix = shiftToSave.isAbsence
      ? `不在[${shiftToSave.absenceType || '休み'}]`
      : '早出';
    const shiftTimeStr =
      shiftToSave.startTime === '終日' || !shiftToSave.endTime
        ? '終日'
        : `${shiftToSave.startTime}～${shiftToSave.endTime}`;

    const authorUid = shiftToSave.updatedByUid || shiftToSave.createdByUid || user?.uid || (isAdminMode ? 'admin' : 'local-user');
    const authorName = shiftToSave.updatedByName || shiftToSave.createdByName || surname || (isAdminMode ? '管理者' : '担当者');

    const logEntry = {
      action: exists ? ('update' as const) : ('create' as const),
      targetType: 'shift' as const,
      targetDate: shiftToSave.date,
      targetSummary: `${shiftPrefix}: ${shiftToSave.staffName} (${shiftTimeStr})`,
      userUid: authorUid,
      userName: authorName,
      userEmail: user?.email || '',
    };
    addAuditLogToCloud(logEntry).catch((err) => console.warn('Audit log save error:', err));
    apiSaveAuditLog({ id: `log-${Date.now()}`, ...logEntry, timestamp: Date.now() }).catch(console.warn);

    if (selectedDay && selectedDay.dateString === shiftToSave.date) {
      const updatedDayShifts = exists
        ? selectedDay.shifts.map((s) => (s.id === shiftToSave.id ? shiftToSave : s))
        : [...selectedDay.shifts, shiftToSave];
      setSelectedDay({
        ...selectedDay,
        shifts: updatedDayShifts,
      });
    }
  };

  // シフト削除
  const handleDeleteShift = (shiftId: string) => {
    const targetShift = shifts.find((s) => s.id === shiftId);
    const updated = shifts.filter((s) => s.id !== shiftId);
    setShifts(updated);
    saveShiftsToStorage(updated);
    // クラウドFirestoreからも即座に削除
    deleteShiftFromCloud(shiftId).catch((err) => console.warn('Cloud delete error:', err));

    // 監査ログ
    if (targetShift) {
      // 個別変更日として保護
      setCustomEditedDates((prev) => {
        const next = new Set(prev);
        next.add(targetShift.date);
        saveCustomEditedDatesToStorage(next);
        saveCustomEditedDatesToCloud(Array.from(next)).catch(console.warn);
        return next;
      });

      const delPrefix = targetShift.isAbsence
        ? `不在[${targetShift.absenceType || '休み'}]削除`
        : '早出削除';
      const delTimeStr =
        targetShift.startTime === '終日' || !targetShift.endTime
          ? '終日'
          : `${targetShift.startTime}～${targetShift.endTime}`;

      const authorUid = user?.uid || (isAdminMode ? 'admin' : 'local-user');
      const authorName = surname || (isAdminMode ? '管理者' : '担当者');

      const logEntry = {
        action: 'delete' as const,
        targetType: 'shift' as const,
        targetDate: targetShift.date,
        targetSummary: `${delPrefix}: ${targetShift.staffName} (${delTimeStr})`,
        userUid: authorUid,
        userName: authorName,
        userEmail: user?.email || '',
      };
      addAuditLogToCloud(logEntry).catch((err) => console.warn('Audit log save error:', err));
      apiSaveAuditLog({ id: `log-${Date.now()}`, ...logEntry, timestamp: Date.now() }).catch(console.warn);
    }

    if (selectedDay) {
      setSelectedDay({
        ...selectedDay,
        shifts: selectedDay.shifts.filter((s) => s.id !== shiftId),
      });
    }
  };

  // 複数シフトの一括削除（連続シフト全体削除など）
  const handleDeleteMultipleShifts = (shiftIds: string[]) => {
    const idSet = new Set(shiftIds);
    const targetShifts = shifts.filter((s) => idSet.has(s.id));
    const updated = shifts.filter((s) => !idSet.has(s.id));
    setShifts(updated);
    saveShiftsToStorage(updated);
    // クラウドFirestoreからも各件削除
    shiftIds.forEach((id) => {
      deleteShiftFromCloud(id).catch((err) => console.warn('Cloud delete error:', err));
    });

    if (targetShifts.length > 0) {
      // 個別変更日として保護
      setCustomEditedDates((prev) => {
        const next = new Set(prev);
        targetShifts.forEach((s) => next.add(s.date));
        saveCustomEditedDatesToStorage(next);
        saveCustomEditedDatesToCloud(Array.from(next)).catch(console.warn);
        return next;
      });

      const authorUid = user?.uid || (isAdminMode ? 'admin' : 'local-user');
      const authorName = surname || (isAdminMode ? '管理者' : '担当者');

      const logEntry = {
        action: 'delete' as const,
        targetType: 'shift' as const,
        targetDate: targetShifts[0]?.date || '',
        targetSummary: `連続早出一括削除: ${targetShifts[0]?.staffName} (${targetShifts.length}日間分)`,
        userUid: authorUid,
        userName: authorName,
        userEmail: user?.email || '',
      };
      addAuditLogToCloud(logEntry).catch((err) => console.warn('Audit log save error:', err));
      apiSaveAuditLog({ id: `log-${Date.now()}`, ...logEntry, timestamp: Date.now() }).catch(console.warn);
    }

    if (selectedDay) {
      setSelectedDay({
        ...selectedDay,
        shifts: selectedDay.shifts.filter((s) => !idSet.has(s.id)),
      });
    }
  };

  // 隔週ローテーション設定の保存
  const handleSaveRotationConfig = (newConfig: BiweeklyRotationConfig) => {
    setRotationConfig(newConfig);
    saveRotationConfigToStorage(newConfig);
    saveRotationConfigToCloud(newConfig).catch((err) => console.warn('Cloud rotation config save error:', err));
  };

  // 隔週ローテーションシフトのカレンダー一括自動反映
  const handleApplyRotation = async (
    newRotationShifts: ShiftRecord[],
    startDate: string,
    endDate: string,
    overwriteCustomDates: boolean,
    summaryText: string
  ) => {
    // 期間内の既存シフトのうち、保護対象以外を置き換える
    const filteredExisting = shifts.filter((s) => {
      if (s.date >= startDate && s.date <= endDate) {
        if (!overwriteCustomDates && customEditedDates.has(s.date)) {
          // 個別手動変更日を保護・維持
          return true;
        }
        // 未編集の勤務日は新規生成シフトに置き換えるため既存を削除
        return false;
      }
      return true;
    });

    const combinedShifts = [...filteredExisting, ...newRotationShifts];
    combinedShifts.sort((a, b) => a.date.localeCompare(b.date) || a.createdAt - b.createdAt);

    setShifts(combinedShifts);
    saveShiftsToStorage(combinedShifts);
    await saveShiftsBatchToCloud(combinedShifts);
    await syncAppDataWithServer({ shifts: combinedShifts });

    if (overwriteCustomDates) {
      // 上書き指定の場合は対象期間内の手動変更保護フラグを初期化
      setCustomEditedDates((prev) => {
        const next = new Set(prev);
        const [yS, mS, dS] = startDate.split('-').map(Number);
        const [yE, mE, dE] = endDate.split('-').map(Number);
        const cD = new Date(yS, mS - 1, dS);
        const eD = new Date(yE, mE - 1, dE);
        while (cD <= eD) {
          const m = String(cD.getMonth() + 1).padStart(2, '0');
          const d = String(cD.getDate()).padStart(2, '0');
          next.delete(`${cD.getFullYear()}-${m}-${d}`);
          cD.setDate(cD.getDate() + 1);
        }
        saveCustomEditedDatesToStorage(next);
        saveCustomEditedDatesToCloud(Array.from(next)).catch(console.warn);
        return next;
      });
    }

    // 監査ログ記録
    const authorUid = user?.uid || (isAdminMode ? 'admin' : 'local-user');
    const authorName = surname || (isAdminMode ? '管理者' : '担当者');
    const logEntry = {
      action: 'create' as const,
      targetType: 'shift' as const,
      targetDate: startDate,
      targetSummary: summaryText,
      userUid: authorUid,
      userName: authorName,
      userEmail: user?.email || '',
    };
    addAuditLogToCloud(logEntry).catch((err) => console.warn('Audit log save error:', err));
    apiSaveAuditLog({ id: `log-${Date.now()}`, ...logEntry, timestamp: Date.now() }).catch(console.warn);
  };

  // 個別編集保護のクリア
  const handleClearCustomDates = () => {
    const emptySet = new Set<string>();
    setCustomEditedDates(emptySet);
    saveCustomEditedDatesToStorage(emptySet);
    saveCustomEditedDatesToCloud([]).catch(console.warn);
  };

  // 業務予定保存
  const handleSaveTask = async (taskToSave: TaskSchedule) => {
    const exists = tasks.some((t) => t.id === taskToSave.id);
    let updatedTasks: TaskSchedule[];
    if (exists) {
      updatedTasks = tasks.map((t) => (t.id === taskToSave.id ? taskToSave : t));
    } else {
      updatedTasks = [...tasks, taskToSave];
    }
    setTasks(updatedTasks);
    await saveTaskToCloud(taskToSave);
    await apiSaveTasks(updatedTasks);

    // 監査ログ
    const timeInfo = taskToSave.time ? ` (${taskToSave.time})` : '';
    const staffInfo = taskToSave.staffName ? ` 担当:${taskToSave.staffName}` : ' (担当指定なし)';
    addAuditLogToCloud({
      action: exists ? 'update' : 'create',
      targetType: 'task',
      targetDate: taskToSave.date,
      targetSummary: `業務: ${taskToSave.title}${timeInfo}${staffInfo}`,
      userUid: taskToSave.updatedByUid || taskToSave.createdByUid || user?.uid || (isAdminMode ? 'admin' : 'unknown'),
      userName: taskToSave.updatedByName || taskToSave.createdByName || surname || (isAdminMode ? '管理者' : '未記録'),
      userEmail: user?.email || '',
    }).catch((err) => console.warn('Audit log save error:', err));
  };

  // 業務予定削除
  const handleDeleteTask = async (taskId: string) => {
    const targetTask = tasks.find((t) => t.id === taskId);
    const updatedTasks = tasks.filter((t) => t.id !== taskId);
    setTasks(updatedTasks);
    await deleteTaskFromCloud(taskId);
    await apiSaveTasks(updatedTasks);

    if (targetTask) {
      const delTimeInfo = targetTask.time ? ` (${targetTask.time})` : '';
      const delStaffInfo = targetTask.staffName ? ` 担当:${targetTask.staffName}` : '';
      addAuditLogToCloud({
        action: 'delete',
        targetType: 'task',
        targetDate: targetTask.date,
        targetSummary: `業務削除: ${targetTask.title}${delTimeInfo}${delStaffInfo}`,
        userUid: user?.uid || (isAdminMode ? 'admin' : 'unknown'),
        userName: surname || (isAdminMode ? '管理者' : '未記録'),
        userEmail: user?.email || '',
      }).catch((err) => console.warn('Audit log save error:', err));
    }
  };

  // 職員リストの更新
  const handleUpdateStaffList = (newStaffList: StaffMember[]) => {
    setStaffList(newStaffList);
    saveStaffToStorage(newStaffList);
    saveStaffListToCloud(newStaffList).catch((err) => console.warn('Staff cloud save error:', err));
  };

  // CSVインポート
  const handleImportShifts = (importedShifts: ShiftRecord[], mode: 'merge' | 'overwrite') => {
    let updated: ShiftRecord[];

    if (mode === 'overwrite') {
      updated = importedShifts;
    } else {
      // マージ（既存の同一IDまたは完全一致を除外して追加）
      const existingIds = new Set(shifts.map((s) => s.id));
      const filteredNew = importedShifts.filter((s) => !existingIds.has(s.id));
      updated = [...shifts, ...filteredNew];
    }

    setShifts(updated);
    saveShiftsToStorage(updated);
    // クラウドFirestoreへ高速バッチ保存
    saveShiftsBatchToCloud(importedShifts).catch(console.warn);
    syncAppDataWithServer({ shifts: updated });

    // インポートされたデータの中に未登録の職員名があれば自動追加
    const existingNames = new Set(staffList.map((s) => s.name));
    const newStaffNames = Array.from(new Set(importedShifts.map((s) => s.staffName))).filter(
      (name) => name && !existingNames.has(name)
    );

    if (newStaffNames.length > 0) {
      const additionalStaff: StaffMember[] = newStaffNames.map((name, idx) => {
        const palette =
          STAFF_COLOR_PALETTES[(staffList.length + idx) % STAFF_COLOR_PALETTES.length];
        return {
          id: `staff-imported-${Date.now()}-${idx}`,
          name,
          colorBg: palette.colorBg,
          colorText: palette.colorText,
          colorBorder: palette.colorBorder,
        };
      });
      const updatedStaffList = [...staffList, ...additionalStaff];
      setStaffList(updatedStaffList);
      saveStaffToStorage(updatedStaffList);
      saveStaffListToCloud(updatedStaffList).catch(console.warn);
      apiSaveStaff(updatedStaffList);
    }
  };

  // 複数シフトの一括保存（ShiftModalからの連続シフト一括更新・複数職員同時登録用）
  const handleSaveMultipleShifts = async (newShifts: ShiftRecord[]) => {
    let currentShifts = [...shifts];
    newShifts.forEach((newShift) => {
      const existingIndex = currentShifts.findIndex(
        (s) => s.id === newShift.id || (s.date === newShift.date && s.staffName === newShift.staffName)
      );
      if (existingIndex >= 0) {
        currentShifts[existingIndex] = newShift;
      } else {
        currentShifts.push(newShift);
      }
    });

    setShifts(currentShifts);
    await saveShiftsToStorageAsync(currentShifts);
    await saveShiftsBatchToCloud(newShifts);
    await syncAppDataWithServer({ shifts: currentShifts });
  };

  // 一括シフト保存（まとめて設定・時刻変更・不在設定）
  const handleBatchSaveShifts = async (
    newShifts: ShiftRecord[],
    mode: 'add' | 'overwrite',
    targetDates: string[],
    logSummary?: string
  ) => {
    let updated: ShiftRecord[];
    const targetDateSet = new Set(targetDates);

    if (mode === 'overwrite') {
      const retained = shifts.filter((s) => !targetDateSet.has(s.date));
      updated = [...retained, ...newShifts];
    } else {
      let currentShifts = [...shifts];
      newShifts.forEach((newShift) => {
        const existingIndex = currentShifts.findIndex(
          (s) => s.date === newShift.date && s.staffName === newShift.staffName
        );
        if (existingIndex >= 0) {
          currentShifts[existingIndex] = newShift;
        } else {
          currentShifts.push(newShift);
        }
      });
      updated = currentShifts;
    }

    setShifts(updated);
    await saveShiftsToStorageAsync(updated);
    // クラウドFirestoreへ高速バッチ保存
    await saveShiftsBatchToCloud(newShifts);
    // サーバーAPIとも非同期同期
    await syncAppDataWithServer({ shifts: updated });

    // 監査ログ
    if (logSummary || newShifts.length > 0) {
      addAuditLogToCloud({
        action: mode === 'overwrite' ? 'update' : 'create',
        targetType: 'shift',
        targetDate: targetDates[0] || '',
        targetSummary: logSummary || `一括シフト設定: ${newShifts.length}件`,
        userUid: user?.uid || (isAdminMode ? 'admin' : 'unknown'),
        userName: surname || (isAdminMode ? '管理者' : '未記録'),
        userEmail: user?.email || '',
      }).catch(console.warn);
    }
  };

  // 一括シフト削除（まとめて削除）
  const handleBatchDeleteShifts = async (
    targetDates: string[],
    targetStaffNames?: string | string[]
  ) => {
    const targetDateSet = new Set(targetDates);
    const staffNamesSet = targetStaffNames
      ? new Set(Array.isArray(targetStaffNames) ? targetStaffNames : [targetStaffNames])
      : null;

    const toDelete = shifts.filter((s) => {
      if (!targetDateSet.has(s.date)) return false;
      if (staffNamesSet && !staffNamesSet.has(s.staffName)) {
        return false;
      }
      return true;
    });

    const deleteIdSet = new Set(toDelete.map((s) => s.id));
    const updated = shifts.filter((s) => !deleteIdSet.has(s.id));

    setShifts(updated);
    await saveShiftsToStorageAsync(updated);
    await deleteShiftsBatchFromCloud(Array.from(deleteIdSet));
    await syncAppDataWithServer({ shifts: updated });

    addAuditLogToCloud({
      action: 'delete',
      targetType: 'shift',
      targetDate: targetDates[0] || '',
      targetSummary: `一括削除: ${staffNamesSet ? Array.from(staffNamesSet).join(', ') : '全職員'} (${toDelete.length}件)`,
      userUid: user?.uid || (isAdminMode ? 'admin' : 'unknown'),
      userName: surname || (isAdminMode ? '管理者' : '未記録'),
      userEmail: user?.email || '',
    }).catch(console.warn);
  };

  // 当月のシフト件数計算
  const currentMonthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const currentMonthShiftsCount = shifts.filter((s) => s.date.startsWith(currentMonthPrefix)).length;

  return (
    <div className="min-h-screen bg-slate-100 flex flex-col print:bg-white print:min-h-0 print-page-container">
      {/* 画面上部ヘッダー（年月ナビゲーション・各種操作ボタン） */}
      <Header
        currentYear={currentYear}
        currentMonth={currentMonth}
        isAdminMode={isAdminMode}
        onPrevMonth={handlePrevMonth}
        onNextMonth={handleNextMonth}
        onPrevYear={handlePrevYear}
        onNextYear={handleNextYear}
        onToday={handleToday}
        onOpenRotationModal={() => setIsRotationModalOpen(true)}
        onOpenBatchModal={() => setIsBatchModalOpen(true)}
        onOpenStaffManage={() => setIsStaffModalOpen(true)}
        onOpenCsvModal={() => setIsCsvModalOpen(true)}
        onOpenPrintModal={() => setIsPrintModalOpen(true)}
        onOpenAdminLogin={() => setIsAdminLoginModalOpen(true)}
        onLogoutAdmin={() => setIsAdminMode(false)}
        onOpenAdminSettings={() => setIsAdminSettingsModalOpen(true)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onOpenAuditLogs={() => setIsAuditLogOpen(true)}
        onOpenSurnameEdit={() => setIsSurnameModalOpen(true)}
      />

      {/* メインコンテンツエリア */}
      <main className="flex-1 max-w-7xl w-full mx-auto p-2.5 sm:p-4 md:p-6 flex flex-col print:p-0 print:m-0 print:max-w-none">
        {/* 月間カレンダー表示 */}
        <CalendarGrid
          days={calendarDays}
          currentYear={currentYear}
          currentMonth={currentMonth}
          staffList={staffList}
          startOfWeek={startOfWeek}
          onToggleStartOfWeek={handleToggleStartOfWeek}
          mergeConsecutive={mergeConsecutive}
          onToggleMergeConsecutive={() => setMergeConsecutive((prev) => !prev)}
          onSelectDay={handleSelectDay}
          onSelectShift={handleSelectShift}
          onSelectTask={handleSelectTask}
          onAddShiftToDay={handleAddShiftToDay}
          onOpenStaffManage={() => setIsStaffModalOpen(true)}
        />

        {/* 画面下部：連絡事項・申し送りメモ記入欄（印刷時にも自動印字） */}
        <MonthNotes
          year={currentYear}
          month={currentMonth}
          note={monthNote}
          onChangeNote={handleChangeNote}
        />

        {/* 画面下部：操作ガイド（通常画面のみ） */}
        <footer className="mt-4 pt-3 border-t border-slate-200 text-xs text-slate-500 flex flex-wrap items-center justify-between gap-2 print:hidden">
          <div className="flex items-center gap-3">
            <span>
              💡 担当者（神谷・紙谷・中野 / 7:30～16:15）：日付または職員シフトをクリックして早出・業務予定の登録・変更・削除ができます。
            </span>
            {isAdminMode ? (
              <span className="text-amber-700 font-bold">
                ※ 管理者モード中：「操作履歴ログ」から誰が登録・編集・削除したかの監査ログが確認できます。
              </span>
            ) : (
              <span className="hidden sm:inline text-slate-400">
                （管理者権限機能は右上の「管理者」からログイン）
              </span>
            )}
          </div>
        </footer>
      </main>

      {/* シフト・業務予定 個別登録・編集モーダル（一般利用者・管理者共通） */}
      <ShiftModal
        isOpen={isShiftModalOpen}
        isAdminMode={isAdminMode}
        day={selectedDay}
        staffList={staffList}
        shifts={shifts}
        tasks={tasks}
        initialTab={modalInitialTab}
        editingShiftItem={editingShiftItem}
        editingTaskItem={editingTaskItem}
        onClose={() => {
          setIsShiftModalOpen(false);
          setSelectedDay(null);
          setEditingShiftItem(null);
          setEditingTaskItem(null);
        }}
        onSaveShift={handleSaveShift}
        onSaveMultipleShifts={handleSaveMultipleShifts}
        onDeleteShift={handleDeleteShift}
        onDeleteMultipleShifts={handleDeleteMultipleShifts}
        onSaveTask={handleSaveTask}
        onDeleteTask={handleDeleteTask}
        onOpenStaffManage={() => setIsStaffModalOpen(true)}
      />

      {/* まとめて設定（一括登録）モーダル（管理者専用） */}
      {isBatchModalOpen && (
        <BatchShiftModal
          isOpen={isBatchModalOpen}
          onClose={() => setIsBatchModalOpen(false)}
          currentYear={currentYear}
          currentMonth={currentMonth}
          staffList={staffList}
          shifts={shifts}
          isAdminMode={isAdminMode}
          startOfWeek={startOfWeek}
          onBatchSave={handleBatchSaveShifts}
          onBatchDelete={handleBatchDeleteShifts}
        />
      )}

      {/* 隔週2名体制シフト設定・自動反映モーダル */}
      <RotationSettingModal
        isOpen={isRotationModalOpen}
        onClose={() => setIsRotationModalOpen(false)}
        staffList={staffList}
        currentYear={currentYear}
        currentMonth={currentMonth}
        currentConfig={rotationConfig}
        customEditedDates={customEditedDates}
        isAdminMode={isAdminMode}
        onSaveConfig={handleSaveRotationConfig}
        onApplyRotation={handleApplyRotation}
        onClearCustomDates={handleClearCustomDates}
      />

      {/* 職員管理モーダル（全利用者・管理者共通） */}
      <StaffManageModal
        isOpen={isStaffModalOpen}
        onClose={() => setIsStaffModalOpen(false)}
        staffList={staffList}
        onUpdateStaffList={handleUpdateStaffList}
      />

      {/* CSV入出力（バックアップ・復元）モーダル */}
      <CsvModal
        isOpen={isCsvModalOpen}
        onClose={() => setIsCsvModalOpen(false)}
        currentYear={currentYear}
        currentMonth={currentMonth}
        shifts={shifts}
        calendarDays={calendarDays}
        monthNote={monthNote}
        startOfWeek={startOfWeek}
        onImportShifts={handleImportShifts}
      />

      {/* 印刷プレビュー・印刷実行モーダル */}
      <PrintModal
        isOpen={isPrintModalOpen}
        onClose={() => setIsPrintModalOpen(false)}
        year={currentYear}
        month={currentMonth}
        calendarDays={calendarDays}
        staffList={staffList}
        mergeConsecutive={mergeConsecutive}
        monthNote={monthNote}
        startOfWeek={startOfWeek}
      />

      {/* 管理者認証ログインモーダル */}
      <AdminLoginModal
        isOpen={isAdminLoginModalOpen}
        onClose={() => setIsAdminLoginModalOpen(false)}
        onSuccess={() => {
          setIsAdminLoginModalOpen(false);
          setIsAdminMode(true);
        }}
      />

      {/* 管理者メニュー・環境設定モーダル */}
      <AdminSettingsModal
        isOpen={isAdminSettingsModalOpen}
        onClose={() => setIsAdminSettingsModalOpen(false)}
        onLogoutAdmin={() => setIsAdminMode(false)}
        onOpenShareModal={() => setIsShareModalOpen(true)}
        onStaffListUpdated={handleUpdateStaffList}
      />

      {/* 一般利用者向けWebアプリ共有案内モーダル */}
      <ShareAppModal
        isOpen={isShareModalOpen}
        onClose={() => setIsShareModalOpen(false)}
      />

      {/* 管理者用 操作・編集監査ログモーダル */}
      <AdminAuditLogModal
        isOpen={isAuditLogOpen}
        onClose={() => setIsAuditLogOpen(false)}
      />

      {/* 苗字設定モーダル */}
      <SurnameEditModal
        isOpen={isSurnameModalOpen}
        onClose={() => setIsSurnameModalOpen(false)}
      />
    </div>
  );
}

