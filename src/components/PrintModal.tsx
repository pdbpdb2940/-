import React, { useState, useMemo } from 'react';
import { CalendarDay, StaffMember } from '../types';
import { executePrint, generatePrintHtml, PrintOptions } from '../utils/printHelper';
import {
  Printer,
  X,
  ExternalLink,
  CheckCircle2,
  Clock,
  Link2,
  FileCheck,
} from 'lucide-react';

interface PrintModalProps {
  isOpen: boolean;
  onClose: () => void;
  year: number;
  month: number;
  calendarDays: CalendarDay[];
  staffList: StaffMember[];
  mergeConsecutive: boolean;
  monthNote?: string;
  onToggleMergeConsecutive?: () => void;
}

export const PrintModal: React.FC<PrintModalProps> = ({
  isOpen,
  onClose,
  year,
  month,
  calendarDays,
  staffList,
  mergeConsecutive: initialMergeConsecutive,
  monthNote = '',
}) => {
  const [mergeConsecutive, setMergeConsecutive] = useState<boolean>(initialMergeConsecutive);
  const [includeNote, setIncludeNote] = useState<boolean>(true);
  const [timeDisplayMode, setTimeDisplayMode] = useState<'fullRange' | 'startTimeOnly'>('fullRange');
  const [isPrinting, setIsPrinting] = useState<boolean>(false);

  // 初回表示時に親の初期値を反映
  React.useEffect(() => {
    setMergeConsecutive(initialMergeConsecutive);
  }, [initialMergeConsecutive, isOpen]);

  const printOptions: PrintOptions = useMemo(
    () => ({
      year,
      month,
      calendarDays,
      staffList,
      mergeConsecutive,
      timeDisplayMode,
      monthNote: includeNote ? monthNote : '',
    }),
    [year, month, calendarDays, staffList, mergeConsecutive, timeDisplayMode, includeNote, monthNote]
  );

  // プレビュー用のHTML文字列
  const previewHtml = useMemo(() => {
    if (!isOpen) return '';
    return generatePrintHtml(printOptions);
  }, [printOptions, isOpen]);

  if (!isOpen) return null;

  // 通常の印刷実行
  const handleDirectPrint = () => {
    setIsPrinting(true);
    executePrint(printOptions, false);
    setTimeout(() => setIsPrinting(false), 800);
  };

  // 別タブで開いて印刷（iframe環境でも100%確実に印刷）
  const handleNewTabPrint = () => {
    executePrint(printOptions, true);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-2 sm:p-4 bg-slate-900/70 backdrop-blur-xs animate-in fade-in duration-150">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-5xl h-[90vh] flex flex-col overflow-hidden">
        {/* モーダルヘッダー */}
        <div className="bg-slate-800 text-white px-5 py-3 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2.5">
            <div className="bg-blue-600 p-1.5 rounded-lg text-white">
              <Printer className="w-5 h-5" />
            </div>
            <div>
              <h2 className="text-base sm:text-lg font-bold">
                印刷プレビュー（{year}年 {month}月 A4横向き）
              </h2>
              <p className="text-xs text-slate-300">
                出勤時刻・カレンダー配置・連続シフト結合を完全に維持して印刷します
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md hover:bg-slate-700 transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* コントロールバー（印刷設定＆実行ボタン） */}
        <div className="bg-slate-100 border-b border-slate-200 p-3 sm:px-5 flex flex-wrap items-center justify-between gap-3 shrink-0">
          {/* 設定項目 */}
          <div className="flex items-center flex-wrap gap-4 text-xs">
            {/* 出勤時刻の表示形式 */}
            <div className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-md border border-slate-300">
              <Clock className="w-4 h-4 text-slate-600" />
              <span className="font-bold text-slate-700">出勤時刻:</span>
              <label className="flex items-center gap-1 cursor-pointer font-medium">
                <input
                  type="radio"
                  name="timeDisplayMode"
                  value="fullRange"
                  checked={timeDisplayMode === 'fullRange'}
                  onChange={() => setTimeDisplayMode('fullRange')}
                  className="accent-blue-600 cursor-pointer"
                />
                <span>07:30～16:15</span>
              </label>
              <label className="flex items-center gap-1 cursor-pointer font-medium ml-1">
                <input
                  type="radio"
                  name="timeDisplayMode"
                  value="startTimeOnly"
                  checked={timeDisplayMode === 'startTimeOnly'}
                  onChange={() => setTimeDisplayMode('startTimeOnly')}
                  className="accent-blue-600 cursor-pointer"
                />
                <span>出勤 07:30</span>
              </label>
            </div>

            {/* 連続シフト結合 */}
            <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-md border border-slate-300 cursor-pointer font-medium hover:bg-slate-50">
              <input
                type="checkbox"
                checked={mergeConsecutive}
                onChange={(e) => setMergeConsecutive(e.target.checked)}
                className="accent-blue-600 rounded cursor-pointer w-4 h-4"
              />
              <Link2 className="w-3.5 h-3.5 text-blue-600" />
              <span className="font-bold text-slate-800">連続シフトを結合</span>
            </label>

            {/* 下部メモの印刷 */}
            <label className="flex items-center gap-1.5 bg-white px-2.5 py-1.5 rounded-md border border-slate-300 cursor-pointer font-medium hover:bg-slate-50">
              <input
                type="checkbox"
                checked={includeNote}
                onChange={(e) => setIncludeNote(e.target.checked)}
                className="accent-blue-600 rounded cursor-pointer w-4 h-4"
              />
              <FileCheck className="w-3.5 h-3.5 text-emerald-600" />
              <span className="font-bold text-slate-800">連絡・申し送りメモを含む</span>
            </label>
          </div>

          {/* 印刷アクションボタン群 */}
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={handleNewTabPrint}
              className="inline-flex items-center gap-1.5 px-3 py-2 rounded-md text-xs sm:text-sm font-semibold bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 transition-colors shadow-2xs cursor-pointer"
              title="iframeの制限を受けずに別タブから確実に印刷します"
            >
              <ExternalLink className="w-4 h-4 text-blue-600" />
              <span>別タブで開いて印刷</span>
            </button>

            <button
              type="button"
              onClick={handleDirectPrint}
              disabled={isPrinting}
              className="inline-flex items-center gap-1.5 px-4 py-2 rounded-md text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
            >
              <Printer className="w-4 h-4" />
              <span>{isPrinting ? '印刷準備中...' : '今すぐ印刷する'}</span>
            </button>
          </div>
        </div>

        {/* プレビュー本体（A4横向きフレーム） */}
        <div className="flex-1 bg-slate-200/80 p-3 sm:p-5 overflow-auto flex justify-center items-start">
          <div className="w-full max-w-4xl bg-white shadow-lg border border-slate-300 rounded-sm overflow-hidden min-h-[500px]">
            <iframe
              srcDoc={previewHtml}
              title="A4印刷プレビュー"
              className="w-full h-[620px] border-0"
              sandbox="allow-same-origin allow-scripts"
            />
          </div>
        </div>

        {/* フッター */}
        <div className="bg-white border-t border-slate-200 px-5 py-2.5 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div className="flex items-center gap-2">
            <CheckCircle2 className="w-4 h-4 text-emerald-600" />
            <span>ブラウザの印刷画面で「横向き（Landscape）」、「背景のグラフィックを印刷」にチェックを入れると綺麗に出力されます。</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-md font-medium cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
