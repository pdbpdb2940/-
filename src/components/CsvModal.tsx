import React, { useState, useRef } from 'react';
import { CalendarDay, ShiftRecord } from '../types';
import { exportShiftsToCsv, exportCalendarCsv, parseShiftsFromCsv } from '../utils/csv';
import {
  X,
  Download,
  Upload,
  FileSpreadsheet,
  AlertCircle,
  CheckCircle2,
  FileText,
  Calendar,
  Sparkles,
} from 'lucide-react';

interface CsvModalProps {
  isOpen: boolean;
  onClose: () => void;
  currentYear: number;
  currentMonth: number;
  shifts: ShiftRecord[];
  calendarDays: CalendarDay[];
  monthNote?: string;
  onImportShifts: (newShifts: ShiftRecord[], mode: 'merge' | 'overwrite') => void;
}

export const CsvModal: React.FC<CsvModalProps> = ({
  isOpen,
  onClose,
  currentYear,
  currentMonth,
  shifts,
  calendarDays,
  monthNote = '',
  onImportShifts,
}) => {
  const [importMode, setImportMode] = useState<'merge' | 'overwrite'>('merge');
  const [previewData, setPreviewData] = useState<ShiftRecord[] | null>(null);
  const [importCount, setImportCount] = useState<number>(0);
  const [errorMessage, setErrorMessage] = useState<string>('');
  const [successMessage, setSuccessMessage] = useState<string>('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  if (!isOpen) return null;

  // 当月のシフトのみ抽出
  const monthPrefix = `${currentYear}-${String(currentMonth).padStart(2, '0')}`;
  const currentMonthShifts = shifts.filter((s) => s.date.startsWith(monthPrefix));

  // カレンダー配置を維持したCSV出力（出勤時刻・早出担当者を週×曜日グリッドで出力）
  const handleExportCalendarLayout = () => {
    exportCalendarCsv(calendarDays, currentYear, currentMonth, true, monthNote);
  };

  // 当月のCSV出力（一覧リスト形式）
  const handleExportMonth = () => {
    exportShiftsToCsv(currentMonthShifts, `早出シフト表_一覧_${currentYear}年${currentMonth}月`);
  };

  // 全期間のCSV出力（一覧リスト形式）
  const handleExportAll = () => {
    exportShiftsToCsv(shifts, `早出シフト表_全件バックアップ`);
  };

  // ファイル読み込みハンドラー
  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    processCsvFile(file);
  };

  // ドラッグ＆ドロップ対応
  const handleDrop = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    const file = e.dataTransfer.files?.[0];
    if (file) {
      processCsvFile(file);
    }
  };

  const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
    e.preventDefault();
  };

  const processCsvFile = (file: File) => {
    setErrorMessage('');
    setSuccessMessage('');

    if (!file.name.endsWith('.csv') && file.type !== 'text/csv') {
      setErrorMessage('CSVファイル（.csv）を選択してください。');
      return;
    }

    const reader = new FileReader();
    reader.onload = (evt) => {
      const content = evt.target?.result as string;
      const result = parseShiftsFromCsv(content);

      if (!result.success) {
        setErrorMessage(result.error || 'CSVの解析に失敗しました。');
        setPreviewData(null);
      } else {
        setPreviewData(result.data);
        setImportCount(result.count);
      }
    };
    reader.onerror = () => {
      setErrorMessage('ファイルの読み込み中にエラーが発生しました。');
    };
    reader.readAsText(file, 'utf-8');
  };

  // インポート実行
  const handleExecuteImport = () => {
    if (!previewData || previewData.length === 0) return;

    onImportShifts(previewData, importMode);
    setSuccessMessage(
      importMode === 'overwrite'
        ? `${importCount}件のシフトでデータを上書きしました。`
        : `${importCount}件のシフトを追加・マージしました。`
    );
    setPreviewData(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-lg overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <FileSpreadsheet className="w-5 h-5 text-emerald-400" />
            <div>
              <h2 className="text-base font-bold">CSVバックアップ & 読み込み</h2>
              <p className="text-xs text-slate-300">データの保存・復元・Excel連携</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-md hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-6 max-h-[80vh] overflow-y-auto">
          {errorMessage && (
            <div className="flex items-center gap-2 p-3 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {successMessage && (
            <div className="flex items-center gap-2 p-3 bg-emerald-50 border border-emerald-200 text-emerald-700 text-xs rounded-md">
              <CheckCircle2 className="w-4 h-4 shrink-0" />
              <span>{successMessage}</span>
            </div>
          )}

          {/* セクション1：エクスポート（ダウンロード） */}
          <div className="space-y-3">
            <div className="flex items-center justify-between">
              <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
                <Download className="w-4 h-4 text-blue-600" />
                <span>CSV形式で出力・保存</span>
              </h3>
              <span className="text-[11px] text-slate-500 font-mono">Excel対応 (UTF-8 BOM付)</span>
            </div>

            {/* メイン：カレンダー形式（カレンダー状態・出勤時刻を維持） */}
            <div className="p-3.5 bg-gradient-to-r from-blue-50 to-indigo-50/60 border-2 border-blue-300/80 rounded-xl space-y-2 shadow-xs">
              <div className="flex items-start justify-between gap-2">
                <div className="space-y-0.5">
                  <div className="flex items-center gap-1.5">
                    <span className="inline-flex items-center gap-1 text-[10px] font-bold bg-blue-600 text-white px-1.5 py-0.5 rounded">
                      <Sparkles className="w-3 h-3" />
                      おすすめ
                    </span>
                    <h4 className="text-xs sm:text-sm font-bold text-blue-950">
                      カレンダー状態を維持したままCSV出力
                    </h4>
                  </div>
                  <p className="text-[11px] text-blue-900/80 leading-relaxed">
                    月間カレンダー（月～日の週マトリクス）の配置をそのままCSV化。
                    各日の早出担当者と出勤時刻（07:30～16:15）が記録され、Excelでそのまま月間スケジュール表として開けます。
                  </p>
                </div>
              </div>

              <button
                type="button"
                onClick={handleExportCalendarLayout}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg text-xs sm:text-sm font-bold transition-colors shadow-xs cursor-pointer"
              >
                <Calendar className="w-4 h-4" />
                <span>カレンダー形式でCSV出力（{currentYear}年{currentMonth}月）</span>
              </button>
            </div>

            {/* サブ：一覧リスト形式（システム連携・バックアップ用） */}
            <div className="pt-1">
              <div className="text-[11px] font-semibold text-slate-500 mb-1.5">
                データベース・一覧リスト形式（再取り込み・バックアップ用）
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={handleExportMonth}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                  title="当月のシフトを1行1件のリスト形式で出力"
                >
                  <Download className="w-3.5 h-3.5 text-slate-500" />
                  <span>
                    当月一覧リスト ({currentMonthShifts.length}件)
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExportAll}
                  className="flex items-center justify-center gap-2 px-3 py-2 bg-white border border-slate-300 hover:bg-slate-50 text-slate-700 rounded-lg text-xs font-semibold transition-colors shadow-2xs cursor-pointer"
                  title="全登録データを1行1件のリスト形式で出力"
                >
                  <FileText className="w-3.5 h-3.5 text-slate-500" />
                  <span>全件一覧リスト ({shifts.length}件)</span>
                </button>
              </div>
            </div>
          </div>

          <div className="border-t border-slate-200 pt-5 space-y-3">
            {/* セクション2：インポート（読み込み） */}
            <h3 className="text-sm font-bold text-slate-900 flex items-center gap-1.5">
              <Upload className="w-4 h-4 text-emerald-600" />
              <span>CSVからデータを読み込む</span>
            </h3>
            <p className="text-xs text-slate-500">
              過去に出力したCSVファイルや他PCで保存したバックアップファイルを読み込めます。
            </p>

            {/* ドロップゾーン */}
            <div
              onDrop={handleDrop}
              onDragOver={handleDragOver}
              onClick={() => fileInputRef.current?.click()}
              className="border-2 border-dashed border-slate-300 hover:border-blue-400 bg-slate-50/70 hover:bg-blue-50/20 p-5 rounded-lg text-center cursor-pointer transition-colors"
            >
              <Upload className="w-6 h-6 text-slate-400 mx-auto mb-1.5" />
              <div className="text-xs sm:text-sm font-medium text-slate-700">
                クリックしてCSVを選択、またはここにドラッグ＆ドロップ
              </div>
              <div className="text-[11px] text-slate-400 mt-1">.csv ファイル対応</div>
              <input
                ref={fileInputRef}
                type="file"
                accept=".csv,text/csv"
                onChange={handleFileChange}
                className="hidden"
              />
            </div>

            {/* プレビューおよび取り込みモード選択 */}
            {previewData && (
              <div className="bg-emerald-50 border border-emerald-200 rounded-lg p-3 space-y-3 animate-in fade-in">
                <div className="flex items-center justify-between text-xs text-emerald-900 font-bold">
                  <span>読み込み確認: {importCount} 件の有効なシフトを検出</span>
                </div>

                {/* インポート方式の選択 */}
                <div className="space-y-1.5">
                  <div className="text-xs font-semibold text-slate-700">反映方法:</div>
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="merge"
                      checked={importMode === 'merge'}
                      onChange={() => setImportMode('merge')}
                      className="text-blue-600 focus:ring-blue-500"
                    />
                    <span>既存のデータに追加（同じ日のデータは統合）</span>
                  </label>
                  <label className="flex items-center gap-2 text-xs text-slate-800 cursor-pointer">
                    <input
                      type="radio"
                      name="importMode"
                      value="overwrite"
                      checked={importMode === 'overwrite'}
                      onChange={() => setImportMode('overwrite')}
                      className="text-rose-600 focus:ring-rose-500"
                    />
                    <span className="text-rose-700 font-medium">
                      現在の全データを消去して上書き（完全復元）
                    </span>
                  </label>
                </div>

                <div className="flex justify-end gap-2 pt-1">
                  <button
                    type="button"
                    onClick={() => setPreviewData(null)}
                    className="px-3 py-1.5 text-xs text-slate-600 hover:text-slate-800 bg-white border border-slate-300 rounded-md"
                  >
                    キャンセル
                  </button>
                  <button
                    type="button"
                    onClick={handleExecuteImport}
                    className="px-4 py-1.5 text-xs font-bold text-white bg-emerald-600 hover:bg-emerald-700 rounded-md shadow-xs transition-colors"
                  >
                    この内容で取り込む
                  </button>
                </div>
              </div>
            )}
          </div>
        </div>

        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs sm:text-sm font-semibold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
