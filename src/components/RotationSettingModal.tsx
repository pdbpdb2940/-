import React, { useState, useMemo, useEffect } from 'react';
import {
  ShiftRecord,
  StaffMember,
  BiweeklyRotationConfig,
  RotationPair,
  RotationMemberSetting,
} from '../types';
import { DEFAULT_SHIFT_START, DEFAULT_SHIFT_END } from '../utils/constants';
import { formatDateKey } from '../utils/holidays';
import {
  DEFAULT_ROTATION_CONFIG,
  getPairForDate,
  generateRotationShiftsForRange,
  getMondayOfDate,
} from '../utils/rotation';
import { useAuth } from '../context/AuthContext';
import {
  X,
  Users2,
  Calendar,
  Clock,
  Check,
  AlertCircle,
  Plus,
  Trash2,
  RotateCcw,
  Sparkles,
  ArrowRight,
  ShieldCheck,
  CalendarRange,
  Info,
} from 'lucide-react';

interface RotationSettingModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  currentYear: number;
  currentMonth: number;
  currentConfig: BiweeklyRotationConfig;
  customEditedDates: Set<string>;
  isAdminMode?: boolean;
  onSaveConfig: (newConfig: BiweeklyRotationConfig) => void;
  onApplyRotation: (
    newShifts: ShiftRecord[],
    startDate: string,
    endDate: string,
    overwriteCustomDates: boolean,
    summaryText: string
  ) => Promise<void> | void;
  onClearCustomDates?: () => void;
}

const TIME_PRESETS = [
  { label: '基本 07:30～16:15', start: '07:30', end: '16:15' },
  { label: '早番 06:30～15:15', start: '06:30', end: '15:15' },
  { label: '08:00～16:45', start: '08:00', end: '16:45' },
  { label: '08:30～17:15', start: '08:30', end: '17:15' },
];

export const RotationSettingModal: React.FC<RotationSettingModalProps> = ({
  isOpen,
  onClose,
  staffList,
  currentYear,
  currentMonth,
  currentConfig,
  customEditedDates,
  isAdminMode = false,
  onSaveConfig,
  onApplyRotation,
  onClearCustomDates,
}) => {
  const { surname } = useAuth();

  // タブ: 'pairs' (ペア・勤務時間設定) | 'apply' (基準週・カレンダー反映)
  const [activeTab, setActiveTab] = useState<'pairs' | 'apply'>('pairs');

  // ローカル編集中の設定
  const [baseDate, setBaseDate] = useState<string>(currentConfig.baseDate || '2026-10-05');
  const [excludeWeekends, setExcludeWeekends] = useState<boolean>(currentConfig.excludeWeekends ?? true);
  const [excludeHolidays, setExcludeHolidays] = useState<boolean>(currentConfig.excludeHolidays ?? true);
  const [pairs, setPairs] = useState<RotationPair[]>(() => {
    return currentConfig.pairs && currentConfig.pairs.length > 0
      ? JSON.parse(JSON.stringify(currentConfig.pairs))
      : JSON.parse(JSON.stringify(DEFAULT_ROTATION_CONFIG.pairs));
  });

  // カレンダー反映期間の設定
  const defaultRangeStart = useMemo(() => {
    return formatDateKey(currentYear, currentMonth, 1);
  }, [currentYear, currentMonth]);

  const defaultRangeEnd = useMemo(() => {
    const lastDay = new Date(currentYear, currentMonth, 0).getDate();
    return formatDateKey(currentYear, currentMonth, lastDay);
  }, [currentYear, currentMonth]);

  const [rangeMode, setRangeMode] = useState<'currentMonth' | 'nextMonth' | 'custom'>('currentMonth');
  const [customStartDate, setCustomStartDate] = useState<string>(defaultRangeStart);
  const [customEndDate, setCustomEndDate] = useState<string>(defaultRangeEnd);

  // 個別編集保護オプション（デフォルト: ON）
  const [protectCustomEdited, setProtectCustomEdited] = useState<boolean>(true);

  // 実行状態とフィードバック
  const [isApplying, setIsApplying] = useState<boolean>(false);
  const [statusMessage, setStatusMessage] = useState<string>('');
  const [errorMessage, setErrorMessage] = useState<string>('');

  // 親の設定が更新されたらローカル状態に同期
  useEffect(() => {
    if (isOpen) {
      setBaseDate(currentConfig.baseDate || '2026-10-05');
      setExcludeWeekends(currentConfig.excludeWeekends ?? true);
      setExcludeHolidays(currentConfig.excludeHolidays ?? true);
      setPairs(
        currentConfig.pairs && currentConfig.pairs.length > 0
          ? JSON.parse(JSON.stringify(currentConfig.pairs))
          : JSON.parse(JSON.stringify(DEFAULT_ROTATION_CONFIG.pairs))
      );
      setCustomStartDate(defaultRangeStart);
      setCustomEndDate(defaultRangeEnd);
      setStatusMessage('');
      setErrorMessage('');
    }
  }, [isOpen, currentConfig, defaultRangeStart, defaultRangeEnd]);

  // 反映対象の実質的な期間（開始日・終了日）の算出
  const targetDateRange = useMemo(() => {
    if (rangeMode === 'currentMonth') {
      const lastDay = new Date(currentYear, currentMonth, 0).getDate();
      return {
        start: formatDateKey(currentYear, currentMonth, 1),
        end: formatDateKey(currentYear, currentMonth, lastDay),
        label: `${currentYear}年${currentMonth}月（当月全日）`,
      };
    } else if (rangeMode === 'nextMonth') {
      const nextYear = currentMonth === 12 ? currentYear + 1 : currentYear;
      const nextMonth = currentMonth === 12 ? 1 : currentMonth + 1;
      const lastDay = new Date(nextYear, nextMonth, 0).getDate();
      return {
        start: formatDateKey(nextYear, nextMonth, 1),
        end: formatDateKey(nextYear, nextMonth, lastDay),
        label: `${nextYear}年${nextMonth}月（翌月全日）`,
      };
    } else {
      return {
        start: customStartDate,
        end: customEndDate,
        label: `${customStartDate} ～ ${customEndDate}`,
      };
    }
  }, [rangeMode, currentYear, currentMonth, customStartDate, customEndDate]);

  // プレビュー用：基準週から前後を含む週ごとのペア配置リスト（直近8週間）
  const previewWeeks = useMemo(() => {
    const weeks: Array<{
      weekNumber: number;
      mondayStr: string;
      sundayStr: string;
      pairName: string;
      pair: RotationPair;
      isBaseWeek: boolean;
    }> = [];

    const [by, bm, bd] = baseDate.split('-').map(Number);
    const baseDateObj = new Date(by, bm - 1, bd);
    const baseMon = getMondayOfDate(baseDateObj);

    // 基準週の前1週 〜 基準週以降7週の計8週を表示
    for (let w = 0; w < 8; w++) {
      const mDate = new Date(baseMon);
      mDate.setDate(baseMon.getDate() + w * 7);

      const sDate = new Date(mDate);
      sDate.setDate(mDate.getDate() + 6);

      const mStr = formatDateKey(mDate.getFullYear(), mDate.getMonth() + 1, mDate.getDate());
      const sStr = formatDateKey(sDate.getFullYear(), sDate.getMonth() + 1, sDate.getDate());

      const configForCalc: BiweeklyRotationConfig = {
        baseDate,
        excludeWeekends,
        excludeHolidays,
        pairs,
      };

      const pairInfo = getPairForDate(mStr, configForCalc);
      if (pairInfo) {
        weeks.push({
          weekNumber: w + 1,
          mondayStr: mStr,
          sundayStr: sStr,
          pairName: pairInfo.pair.name,
          pair: pairInfo.pair,
          isBaseWeek: w === 0,
        });
      }
    }

    return weeks;
  }, [baseDate, excludeWeekends, excludeHolidays, pairs]);

  // 選択期間内の保護対象日数の計算
  const customDatesInTargetRangeCount = useMemo(() => {
    let count = 0;
    customEditedDates.forEach((dateStr) => {
      if (dateStr >= targetDateRange.start && dateStr <= targetDateRange.end) {
        count++;
      }
    });
    return count;
  }, [customEditedDates, targetDateRange]);

  // すべてのフック宣言完了後に早期リターン
  if (!isOpen) return null;

  // ペアのメンバー変更ハンドラー
  const handleUpdateMember = (
    pairIndex: number,
    memberIndex: number,
    field: keyof RotationMemberSetting,
    value: string
  ) => {
    setPairs((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy[pairIndex] && copy[pairIndex].members[memberIndex]) {
        copy[pairIndex].members[memberIndex][field] = value;
      }
      return copy;
    });
  };

  // メンバー追加（3名体制や臨時追加対応）
  const handleAddMember = (pairIndex: number) => {
    setPairs((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      const currentNames = new Set(copy[pairIndex].members.map((m: RotationMemberSetting) => m.staffName));
      const available = staffList.find((s) => !currentNames.has(s.name)) || staffList[0];
      copy[pairIndex].members.push({
        staffName: available?.name || '神谷',
        startTime: DEFAULT_SHIFT_START,
        endTime: DEFAULT_SHIFT_END,
      });
      return copy;
    });
  };

  // メンバー削除
  const handleRemoveMember = (pairIndex: number, memberIndex: number) => {
    setPairs((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      if (copy[pairIndex].members.length <= 1) {
        setErrorMessage('ペアには最低1名の職員が必要です。');
        return prev;
      }
      copy[pairIndex].members.splice(memberIndex, 1);
      return copy;
    });
  };

  // ペア名変更
  const handleUpdatePairName = (pairIndex: number, newName: string) => {
    setPairs((prev) => {
      const copy = JSON.parse(JSON.stringify(prev));
      copy[pairIndex].name = newName;
      return copy;
    });
  };

  // 新規ペア追加
  const handleAddPair = () => {
    setPairs((prev) => {
      const nextLetter = String.fromCharCode(65 + prev.length); // A, B, C, D...
      const newPair: RotationPair = {
        id: `pair-${Date.now()}`,
        name: `ペア${nextLetter}`,
        members: [
          { staffName: staffList[0]?.name || '神谷', startTime: DEFAULT_SHIFT_START, endTime: DEFAULT_SHIFT_END },
          { staffName: staffList[1]?.name || '紙谷', startTime: DEFAULT_SHIFT_START, endTime: DEFAULT_SHIFT_END },
        ],
      };
      return [...prev, newPair];
    });
  };

  // ペア削除
  const handleRemovePair = (pairIndex: number) => {
    if (pairs.length <= 1) {
      setErrorMessage('ローテーションには最低1つのペアが必要です。');
      return;
    }
    setPairs((prev) => prev.filter((_, idx) => idx !== pairIndex));
  };

  // 初期ペアにリセット
  const handleResetToDefault = () => {
    setPairs(JSON.parse(JSON.stringify(DEFAULT_ROTATION_CONFIG.pairs)));
    setBaseDate(DEFAULT_ROTATION_CONFIG.baseDate);
    setExcludeWeekends(true);
    setExcludeHolidays(true);
    setStatusMessage('ペア設定と基準日を初期設定に戻しました。');
  };

  // 設定の保存のみ実行
  const handleSaveOnly = () => {
    const configToSave: BiweeklyRotationConfig = {
      baseDate,
      excludeWeekends,
      excludeHolidays,
      pairs,
      updatedAt: Date.now(),
      updatedByName: surname || (isAdminMode ? '管理者' : '担当者'),
    };
    onSaveConfig(configToSave);
    setStatusMessage('✨ 隔週ローテーション設定を保存しました。');
    setTimeout(() => {
      setStatusMessage('');
    }, 2500);
  };

  // カレンダーへの自動反映実行
  const handleApplyToCalendar = async () => {
    setErrorMessage('');
    if (pairs.length === 0) {
      setErrorMessage('1組以上のペアを設定してください。');
      return;
    }
    if (!targetDateRange.start || !targetDateRange.end) {
      setErrorMessage('反映対象の期間を正しく指定してください。');
      return;
    }
    if (targetDateRange.start > targetDateRange.end) {
      setErrorMessage('開始日は終了日以前の日付を指定してください。');
      return;
    }

    setIsApplying(true);
    try {
      const configToApply: BiweeklyRotationConfig = {
        baseDate,
        excludeWeekends,
        excludeHolidays,
        pairs,
        updatedAt: Date.now(),
        updatedByName: surname || (isAdminMode ? '管理者' : '担当者'),
      };

      // 設定を最新として保存
      onSaveConfig(configToApply);

      const authorUid = isAdminMode ? 'admin' : 'local-user';
      const authorName = surname || (isAdminMode ? '管理者' : '神谷');

      // シフト生成
      const result = generateRotationShiftsForRange(
        targetDateRange.start,
        targetDateRange.end,
        configToApply,
        authorUid,
        authorName,
        customEditedDates,
        !protectCustomEdited // 上書き指定
      );

      const summary = `【隔週2名体制シフト反映】期間: ${targetDateRange.label} 計${result.generatedShifts.length}件 (${result.targetDatesCount}勤務日分)${
        protectCustomEdited && result.skippedCustomDatesCount > 0
          ? ` ※個別変更済み${result.skippedCustomDatesCount}日を保護維持`
          : ''
      }`;

      await onApplyRotation(
        result.generatedShifts,
        targetDateRange.start,
        targetDateRange.end,
        !protectCustomEdited,
        summary
      );

      setStatusMessage(
        `✨ ${targetDateRange.label} に計 ${result.generatedShifts.length} 件の早出シフト（${result.targetDatesCount}日分）を自動登録しました！` +
          (protectCustomEdited && result.skippedCustomDatesCount > 0
            ? `（個別変更済み ${result.skippedCustomDatesCount}日はそのまま保護されました）`
            : '')
      );

      setTimeout(() => {
        onClose();
      }, 1600);
    } catch (err) {
      console.error('Error applying rotation:', err);
      setErrorMessage('カレンダーへの反映中にエラーが発生しました。');
    } finally {
      setIsApplying(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-4 bg-slate-900/60 backdrop-blur-xs overflow-y-auto">
      <div
        className="bg-white rounded-xl shadow-2xl w-full max-w-4xl max-h-[92vh] flex flex-col border border-slate-200 overflow-hidden animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* モーダルヘッダー */}
        <div className="flex items-center justify-between px-5 py-3.5 bg-gradient-to-r from-blue-800 via-indigo-700 to-blue-900 text-white shadow-xs shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="p-2 bg-white/15 rounded-lg backdrop-blur-xs">
              <Users2 className="w-5 h-5 text-white" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h2 className="text-base sm:text-lg font-bold">隔週シフト設定（2名体制ローテーション）</h2>
                <span className="text-[11px] bg-white/20 text-white font-medium px-2 py-0.5 rounded-full">
                  隔週2名ペア自動反映
                </span>
              </div>
              <p className="text-xs text-blue-100">
                3名の職員（神谷・紙谷・中野）から2名1組のペアを隔週で自動的にカレンダーへ反映します
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            disabled={isApplying}
            className="p-1.5 text-white/80 hover:text-white hover:bg-white/20 rounded-lg transition-colors cursor-pointer disabled:opacity-50"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 状態・エラーメッセージ */}
        {statusMessage && (
          <div className="px-5 py-2.5 bg-emerald-50 border-b border-emerald-200 text-emerald-800 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
            <Check className="w-4 h-4 text-emerald-600 shrink-0" />
            <span>{statusMessage}</span>
          </div>
        )}
        {errorMessage && (
          <div className="px-5 py-2.5 bg-rose-50 border-b border-rose-200 text-rose-800 text-xs font-bold flex items-center gap-2 animate-in fade-in shrink-0">
            <AlertCircle className="w-4 h-4 text-rose-600 shrink-0" />
            <span>{errorMessage}</span>
          </div>
        )}

        {/* タブナビゲーション */}
        <div className="flex border-b border-slate-200 bg-slate-50 shrink-0">
          <button
            type="button"
            onClick={() => setActiveTab('pairs')}
            className={`flex-1 py-3 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'pairs'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <Users2 className="w-4 h-4" />
            <span>1. ペア構成と勤務時間（ペアA・B・C）</span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('apply')}
            className={`flex-1 py-3 px-4 text-xs sm:text-sm font-bold flex items-center justify-center gap-2 transition-colors cursor-pointer border-b-2 ${
              activeTab === 'apply'
                ? 'bg-white text-blue-600 border-blue-600 shadow-2xs'
                : 'text-slate-600 border-transparent hover:text-slate-900'
            }`}
          >
            <CalendarRange className="w-4 h-4" />
            <span>2. 基準週・サイクルプレビュー・カレンダー反映</span>
          </button>
        </div>

        {/* タブコンテンツ */}
        <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
          {activeTab === 'pairs' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              <div className="bg-blue-50/70 border border-blue-200 rounded-lg p-3.5 text-xs text-blue-900 flex items-start gap-2.5">
                <Info className="w-4 h-4 text-blue-600 shrink-0 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-bold">2名1組のペアを自由に編成・編集できます</p>
                  <p className="leading-relaxed">
                    初期設定では「ペアA（神谷+紙谷）」「ペアB（紙谷+中野）」「ペアC（中野+神谷）」が登録されています。
                    同じ週でも職員ごとに異なる勤務時間（例: 06:30～15:15 や 07:30～16:15）を指定可能です。
                  </p>
                </div>
              </div>

              {/* 各ペアカード一覧 */}
              <div className="space-y-4">
                {pairs.map((pair, pIdx) => (
                  <div
                    key={pair.id}
                    className="border border-slate-200 rounded-xl bg-white shadow-xs overflow-hidden"
                  >
                    <div className="bg-slate-100 px-4 py-2.5 border-b border-slate-200 flex items-center justify-between">
                      <div className="flex items-center gap-2">
                        <span className="w-2.5 h-2.5 rounded-full bg-blue-600" />
                        <input
                          type="text"
                          value={pair.name}
                          onChange={(e) => handleUpdatePairName(pIdx, e.target.value)}
                          className="font-bold text-sm text-slate-800 bg-white border border-slate-300 rounded px-2 py-0.5 focus:outline-hidden focus:ring-2 focus:ring-blue-500 max-w-[130px]"
                        />
                        <span className="text-xs text-slate-500 font-medium">
                          ({pair.members.length}名体制)
                        </span>
                      </div>
                      <div className="flex items-center gap-1.5">
                        <button
                          type="button"
                          onClick={() => handleAddMember(pIdx)}
                          className="inline-flex items-center gap-1 text-xs text-blue-600 hover:text-blue-800 bg-white border border-blue-200 hover:bg-blue-50 px-2 py-1 rounded transition-colors cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>職員追加</span>
                        </button>
                        {pairs.length > 1 && (
                          <button
                            type="button"
                            onClick={() => handleRemovePair(pIdx)}
                            className="p-1 text-slate-400 hover:text-rose-600 rounded transition-colors cursor-pointer"
                            title="このペアを削除"
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        )}
                      </div>
                    </div>

                    {/* ペア内の職員設定行 */}
                    <div className="p-4 space-y-3 divide-y divide-slate-100">
                      {pair.members.map((member, mIdx) => (
                        <div
                          key={`member-${pIdx}-${mIdx}`}
                          className={`pt-3 first:pt-0 flex flex-wrap items-center justify-between gap-3`}
                        >
                          {/* 職員選択 */}
                          <div className="flex items-center gap-2 min-w-[150px]">
                            <span className="text-xs font-bold text-slate-600 shrink-0">
                              担当{mIdx + 1}:
                            </span>
                            <select
                              value={member.staffName}
                              onChange={(e) =>
                                handleUpdateMember(pIdx, mIdx, 'staffName', e.target.value)
                              }
                              className="text-xs font-bold border border-slate-300 rounded-md px-2.5 py-1.5 bg-slate-50 text-slate-800 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                            >
                              {staffList.map((s) => (
                                <option key={s.id} value={s.name}>
                                  {s.name}
                                </option>
                              ))}
                            </select>
                          </div>

                          {/* 勤務時間指定 */}
                          <div className="flex items-center gap-2 flex-wrap">
                            <Clock className="w-3.5 h-3.5 text-slate-400" />
                            <div className="flex items-center gap-1 font-mono text-xs">
                              <input
                                type="time"
                                value={member.startTime}
                                onChange={(e) =>
                                  handleUpdateMember(pIdx, mIdx, 'startTime', e.target.value)
                                }
                                className="border border-slate-300 rounded px-1.5 py-1 text-slate-800 focus:ring-1 focus:ring-blue-500"
                              />
                              <span className="text-slate-400">～</span>
                              <input
                                type="time"
                                value={member.endTime}
                                onChange={(e) =>
                                  handleUpdateMember(pIdx, mIdx, 'endTime', e.target.value)
                                }
                                className="border border-slate-300 rounded px-1.5 py-1 text-slate-800 focus:ring-1 focus:ring-blue-500"
                              />
                            </div>

                            {/* クイックプリセット */}
                            <div className="hidden sm:flex items-center gap-1">
                              {TIME_PRESETS.slice(0, 2).map((tp) => (
                                <button
                                  key={tp.label}
                                  type="button"
                                  onClick={() => {
                                    handleUpdateMember(pIdx, mIdx, 'startTime', tp.start);
                                    handleUpdateMember(pIdx, mIdx, 'endTime', tp.end);
                                  }}
                                  className="text-[10px] px-1.5 py-0.5 rounded border border-slate-200 bg-slate-50 hover:bg-slate-100 text-slate-600 transition-colors cursor-pointer"
                                >
                                  {tp.start}～
                                </button>
                              ))}
                            </div>

                            {/* メンバー削除ボタン（2名以上の時） */}
                            {pair.members.length > 1 && (
                              <button
                                type="button"
                                onClick={() => handleRemoveMember(pIdx, mIdx)}
                                className="p-1 text-slate-300 hover:text-rose-500 rounded transition-colors cursor-pointer ml-1"
                                title="担当者を削除"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </button>
                            )}
                          </div>
                        </div>
                      ))}
                    </div>
                  </div>
                ))}
              </div>

              {/* ペア追加・初期値リセットボタン群 */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleAddPair}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-blue-600 hover:text-blue-800 bg-blue-50 hover:bg-blue-100 border border-blue-200 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                >
                  <Plus className="w-4 h-4" />
                  <span>新しいペアを追加</span>
                </button>

                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="inline-flex items-center gap-1 text-xs text-slate-500 hover:text-slate-800 px-2.5 py-1.5 rounded hover:bg-slate-100 transition-colors cursor-pointer"
                  >
                    <RotateCcw className="w-3.5 h-3.5" />
                    <span>初期設定に戻す</span>
                  </button>
                  <button
                    type="button"
                    onClick={handleSaveOnly}
                    className="inline-flex items-center gap-1.5 text-xs font-bold text-white bg-slate-800 hover:bg-slate-900 px-3 py-1.5 rounded-lg transition-colors cursor-pointer"
                  >
                    <Check className="w-3.5 h-3.5" />
                    <span>ペア設定を保存</span>
                  </button>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'apply' && (
            <div className="space-y-6 animate-in fade-in duration-150">
              {/* 基準週（第1週）の指定 */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-3">
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-blue-600" />
                    <label className="text-xs sm:text-sm font-bold text-slate-900">
                      隔週ローテーションの基準日（第1週）
                    </label>
                  </div>
                  <span className="text-[11px] font-bold text-blue-700 bg-blue-50 px-2 py-0.5 rounded-full border border-blue-200">
                    第1週 ＝ {pairs[0]?.name || 'ペアA'}
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-3">
                  <input
                    type="date"
                    value={baseDate}
                    onChange={(e) => setBaseDate(e.target.value)}
                    className="border border-slate-300 rounded-md px-3 py-1.5 text-xs sm:text-sm font-bold text-slate-800 bg-slate-50 focus:outline-hidden focus:ring-2 focus:ring-blue-500 cursor-pointer"
                  />
                  <p className="text-xs text-slate-500 leading-relaxed">
                    ※この日付の属する週が「第1週（{pairs[0]?.name || 'ペアA'}）」となり、以降の週が
                    {pairs.map((p) => p.name).join(' → ')} の順序で自動反復されます。
                  </p>
                </div>

                {/* 除外オプション */}
                <div className="pt-2 flex flex-wrap items-center gap-4 text-xs font-medium text-slate-700 border-t border-slate-100">
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludeWeekends}
                      onChange={(e) => setExcludeWeekends(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>土曜日・日曜日を除外する（初期値）</span>
                  </label>
                  <label className="inline-flex items-center gap-1.5 cursor-pointer">
                    <input
                      type="checkbox"
                      checked={excludeHolidays}
                      onChange={(e) => setExcludeHolidays(e.target.checked)}
                      className="rounded border-slate-300 text-blue-600 focus:ring-blue-500 cursor-pointer"
                    />
                    <span>日本の祝日・振替休日を除外する（初期値）</span>
                  </label>
                </div>
              </div>

              {/* 隔週サイクル プレビュー */}
              <div className="bg-slate-50 border border-slate-200 rounded-xl p-4 shadow-xs space-y-2.5">
                <div className="flex items-center justify-between">
                  <h3 className="text-xs font-bold text-slate-800 flex items-center gap-1.5">
                    <Sparkles className="w-3.5 h-3.5 text-amber-500" />
                    <span>週別ローテーション プレビュー（基準週からの推移）</span>
                  </h3>
                  <span className="text-[10px] text-slate-500 font-mono">
                    全{pairs.length}ペアの巡回サイクル
                  </span>
                </div>

                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-2 text-xs">
                  {previewWeeks.map((pw) => (
                    <div
                      key={`preview-week-${pw.weekNumber}`}
                      className={`p-2.5 rounded-lg border transition-all ${
                        pw.isBaseWeek
                          ? 'bg-blue-50/90 border-blue-300 shadow-2xs'
                          : 'bg-white border-slate-200'
                      }`}
                    >
                      <div className="flex items-center justify-between mb-1">
                        <span
                          className={`font-bold text-[11px] ${
                            pw.isBaseWeek ? 'text-blue-800' : 'text-slate-700'
                          }`}
                        >
                          第{pw.weekNumber}週 {pw.isBaseWeek && '【基準】'}
                        </span>
                        <span className="text-[10px] font-bold text-white bg-blue-600 px-1.5 py-0.2 rounded">
                          {pw.pairName}
                        </span>
                      </div>
                      <div className="text-[10px] text-slate-500 font-mono mb-1.5">
                        {pw.mondayStr.substring(5)} ～ {pw.sundayStr.substring(5)}
                      </div>
                      <div className="space-y-0.5">
                        {pw.pair.members.map((m, mIdx) => (
                          <div
                            key={mIdx}
                            className="flex items-center justify-between text-[11px] text-slate-800 font-medium"
                          >
                            <span>● {m.staffName}</span>
                            <span className="font-mono text-[10px] text-slate-600">
                              {m.startTime}～{m.endTime}
                            </span>
                          </div>
                        ))}
                      </div>
                    </div>
                  ))}
                </div>
              </div>

              {/* カレンダー反映期間 & 個別編集保護オプション */}
              <div className="bg-white border border-slate-200 rounded-xl p-4 shadow-xs space-y-4">
                <div className="space-y-2">
                  <label className="text-xs sm:text-sm font-bold text-slate-900 block">
                    反映対象期間の選択
                  </label>
                  <div className="flex flex-wrap gap-2">
                    <button
                      type="button"
                      onClick={() => setRangeMode('currentMonth')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        rangeMode === 'currentMonth'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      当月（{currentYear}年{currentMonth}月）
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeMode('nextMonth')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        rangeMode === 'nextMonth'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      翌月（{currentMonth === 12 ? currentYear + 1 : currentYear}年
                      {currentMonth === 12 ? 1 : currentMonth + 1}月）
                    </button>
                    <button
                      type="button"
                      onClick={() => setRangeMode('custom')}
                      className={`px-3 py-1.5 rounded-lg text-xs font-bold transition-all cursor-pointer border ${
                        rangeMode === 'custom'
                          ? 'bg-blue-600 text-white border-blue-600 shadow-2xs'
                          : 'bg-slate-50 text-slate-700 border-slate-200 hover:bg-slate-100'
                      }`}
                    >
                      期間を自由指定
                    </button>
                  </div>

                  {rangeMode === 'custom' && (
                    <div className="flex items-center gap-2 pt-2 animate-in fade-in">
                      <input
                        type="date"
                        value={customStartDate}
                        onChange={(e) => setCustomStartDate(e.target.value)}
                        className="border border-slate-300 rounded px-2.5 py-1 text-xs font-mono text-slate-800"
                      />
                      <span className="text-xs text-slate-500">～</span>
                      <input
                        type="date"
                        value={customEndDate}
                        onChange={(e) => setCustomEndDate(e.target.value)}
                        className="border border-slate-300 rounded px-2.5 py-1 text-xs font-mono text-slate-800"
                      />
                    </div>
                  )}
                </div>

                {/* ★ 最重要要件：個別変更の保護オプション */}
                <div className="p-3.5 bg-amber-50/70 border border-amber-200 rounded-lg space-y-2">
                  <div className="flex items-start gap-2.5">
                    <ShieldCheck className="w-4 h-4 text-amber-600 shrink-0 mt-0.5" />
                    <div className="flex-1 space-y-1">
                      <div className="flex items-center justify-between">
                        <label className="text-xs font-bold text-amber-950 flex items-center gap-1.5 cursor-pointer">
                          <input
                            type="checkbox"
                            checked={protectCustomEdited}
                            onChange={(e) => setProtectCustomEdited(e.target.checked)}
                            className="rounded border-amber-300 text-amber-600 focus:ring-amber-500 cursor-pointer"
                          />
                          <span>個別変更した日を保護する（強く推奨）</span>
                        </label>
                        {customDatesInTargetRangeCount > 0 && (
                          <span className="text-[10px] font-bold text-amber-800 bg-amber-100 border border-amber-300 px-2 py-0.5 rounded-full">
                            対象期間内に {customDatesInTargetRangeCount} 日の個別変更あり
                          </span>
                        )}
                      </div>
                      <p className="text-[11px] text-amber-900 leading-relaxed">
                        有効にすると、ユーザーが手動で担当者・時間・不在設定・削除などを個別変更した日は勝手に上書きせず維持します。未編集の平日勤務日のみが隔週設定で自動更新されます。
                      </p>
                    </div>
                  </div>
                </div>
              </div>

              {/* 反映アクションボタン */}
              <div className="flex items-center justify-between pt-2">
                <button
                  type="button"
                  onClick={handleSaveOnly}
                  className="inline-flex items-center gap-1.5 text-xs font-bold text-slate-700 hover:text-slate-900 bg-slate-100 hover:bg-slate-200 border border-slate-300 px-3.5 py-2 rounded-lg transition-colors cursor-pointer"
                >
                  <Check className="w-4 h-4 text-slate-600" />
                  <span>設定のみ保存</span>
                </button>

                <button
                  type="button"
                  onClick={handleApplyToCalendar}
                  disabled={isApplying}
                  className="inline-flex items-center gap-2 text-xs sm:text-sm font-bold text-white bg-blue-600 hover:bg-blue-700 shadow-md px-5 py-2.5 rounded-lg transition-all cursor-pointer disabled:opacity-50"
                >
                  <CalendarRange className="w-4 h-4" />
                  <span>{isApplying ? 'カレンダーに反映中...' : '隔週シフトをカレンダーに反映する'}</span>
                  <ArrowRight className="w-4 h-4" />
                </button>
              </div>
            </div>
          )}
        </div>

        {/* モーダルフッター */}
        <div className="bg-slate-100 px-5 py-3 border-t border-slate-200 flex items-center justify-between shrink-0 text-xs text-slate-500">
          <div className="flex items-center gap-2">
            <span>● 隔週シフトはカレンダー上でいつでも日付ごとに個別調整・時間変更・追加可能です</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 rounded border border-slate-300 bg-white text-slate-700 font-bold hover:bg-slate-50 transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
