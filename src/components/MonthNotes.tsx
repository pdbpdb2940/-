import React, { useState, useEffect } from 'react';
import {
  FileText,
  Save,
  CheckCircle2,
  Sparkles,
  ChevronDown,
  ChevronUp,
  Info,
} from 'lucide-react';

interface MonthNotesProps {
  year: number;
  month: number;
  note: string;
  onChangeNote: (newNote: string) => void;
}

export const MonthNotes: React.FC<MonthNotesProps> = ({
  year,
  month,
  note,
  onChangeNote,
}) => {
  const [isSaved, setIsSaved] = useState<boolean>(true);
  const [isCollapsed, setIsCollapsed] = useState<boolean>(false);

  useEffect(() => {
    setIsSaved(true);
  }, [note]);

  const handleChange = (e: React.ChangeEvent<HTMLTextAreaElement>) => {
    setIsSaved(false);
    onChangeNote(e.target.value);
  };

  // 定型句の追加
  const handleInsertTemplate = (text: string) => {
    if (note.includes(text)) return;
    const separator = note.trim().length > 0 ? '\n' : '';
    onChangeNote(`${note.trim()}${separator}${text}`);
  };

  return (
    <div className="mt-4 bg-white rounded-lg border border-slate-300 shadow-xs overflow-hidden print:border-2 print:border-black print:rounded-none print:shadow-none print:mt-3 print:break-inside-avoid">
      {/* ヘッダー部 */}
      <div className="bg-slate-100/90 px-4 py-2.5 border-b border-slate-200 print:border-b-2 print:border-black print:bg-slate-100 print:py-1 print:px-2 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="p-1 rounded bg-blue-100 text-blue-700 print:hidden">
            <FileText className="w-4 h-4" />
          </div>
          <div>
            <h2 className="text-xs sm:text-sm font-bold text-slate-800 print:text-black print:text-xs">
              【{year}年{month}月 連絡事項・申し送りメモ】
            </h2>
            <span className="text-[11px] text-slate-500 print:hidden">
              印刷時にカレンダー下部へ一緒に印字されます
            </span>
          </div>
        </div>

        <div className="flex items-center gap-2 print:hidden">
          {isSaved ? (
            <span className="inline-flex items-center gap-1 text-[11px] text-emerald-600 font-medium">
              <CheckCircle2 className="w-3.5 h-3.5" />
              自動保存済
            </span>
          ) : (
            <span className="inline-flex items-center gap-1 text-[11px] text-amber-600 font-medium animate-pulse">
              <Save className="w-3.5 h-3.5" />
              保存中...
            </span>
          )}

          <button
            type="button"
            onClick={() => setIsCollapsed((prev) => !prev)}
            className="p-1 text-slate-500 hover:text-slate-700 hover:bg-slate-200/50 rounded transition-colors cursor-pointer"
            title={isCollapsed ? '展開する' : '折りたたむ'}
          >
            {isCollapsed ? <ChevronDown className="w-4 h-4" /> : <ChevronUp className="w-4 h-4" />}
          </button>
        </div>
      </div>

      {/* 画面用コンテンツ（折りたたみ対応） */}
      <div className={`p-3 sm:p-4 space-y-2.5 ${isCollapsed ? 'hidden print:block' : 'block'}`}>
        {/* クイック定型文チップ（画面のみ） */}
        <div className="flex items-center gap-1.5 flex-wrap text-xs print:hidden">
          <span className="text-[11px] font-bold text-slate-500 flex items-center gap-1">
            <Sparkles className="w-3 h-3 text-blue-600" /> 定型文挿入:
          </span>
          <button
            type="button"
            onClick={() => handleInsertTemplate('・出勤時刻: 07:30 厳守（正面玄関・通用口の解錠確認）')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-300 text-slate-600 text-[11px] transition-colors cursor-pointer"
          >
            + 玄関解錠確認
          </button>
          <button
            type="button"
            onClick={() => handleInsertTemplate('・空調・照明・給湯設備の稼働点検')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-300 text-slate-600 text-[11px] transition-colors cursor-pointer"
          >
            + 設備稼働点検
          </button>
          <button
            type="button"
            onClick={() => handleInsertTemplate('・鍵の貸出返却記録の確認・日報記入')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-300 text-slate-600 text-[11px] transition-colors cursor-pointer"
          >
            + 鍵管理・日報
          </button>
          <button
            type="button"
            onClick={() => handleInsertTemplate('・緊急連絡先: 施設管理課（内線: 2100）')}
            className="px-2 py-0.5 rounded bg-slate-100 hover:bg-blue-50 hover:text-blue-700 border border-slate-300 text-slate-600 text-[11px] transition-colors cursor-pointer"
          >
            + 緊急連絡先
          </button>
        </div>

        {/* 画面用入力テキストエリア */}
        <div className="print:hidden">
          <textarea
            value={note}
            onChange={handleChange}
            placeholder="当月の早出に関する注意事項、申し送り事項、連絡先などを自由に入力してください。（印刷時にもそのまま反映されます）"
            rows={4}
            className="w-full text-xs sm:text-sm font-sans p-2.5 rounded-md border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500 transition-all leading-relaxed placeholder:text-slate-400"
          />
          <div className="flex justify-between items-center text-[11px] text-slate-400 mt-1">
            <span>※ このメモは月ごとに自動保存され、印刷時やカレンダーCSVにも反映されます。</span>
            <span>{note.length} 文字</span>
          </div>
        </div>

        {/* 印刷専用出力枠（用紙に綺麗に枠線付きで印刷される） */}
        <div className="hidden print:block text-xs leading-relaxed text-black whitespace-pre-wrap font-sans p-2 min-h-[44px]">
          {note.trim() ? (
            note
          ) : (
            <span className="text-slate-400 italic">（連絡事項・申し送り事項記入欄）</span>
          )}
        </div>
      </div>
    </div>
  );
};
