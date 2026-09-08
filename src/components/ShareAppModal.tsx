import React, { useState } from 'react';
import {
  Share2,
  X,
  Copy,
  Check,
  ExternalLink,
  Shield,
  MonitorCheck,
  Info,
} from 'lucide-react';

interface ShareAppModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const ShareAppModal: React.FC<ShareAppModalProps> = ({ isOpen, onClose }) => {
  const [copied, setCopied] = useState(false);

  if (!isOpen) return null;

  // 現在のWebアプリURL（iframe内でもトップウィンドウのURLまたは現在の直接URL）
  const appUrl = window.location.href;

  const handleCopy = async () => {
    try {
      await navigator.clipboard.writeText(appUrl);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    } catch {
      // フォールバック
      const textarea = document.createElement('textarea');
      textarea.value = appUrl;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      document.body.removeChild(textarea);
      setCopied(true);
      setTimeout(() => setCopied(false), 2500);
    }
  };

  const handleOpenDirect = () => {
    window.open(appUrl, '_blank');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="bg-gradient-to-r from-blue-900 to-indigo-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg text-white">
              <Share2 className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">一般利用者向け Webアプリ共有</h3>
              <p className="text-xs text-blue-200">AI StudioのUIを出さずにアプリ単体として配布</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-blue-300 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* 本文 */}
        <div className="p-5 space-y-4 text-slate-700 text-xs sm:text-sm">
          {/* メリット解説 */}
          <div className="p-3.5 bg-emerald-50 border border-emerald-200 rounded-lg space-y-1 text-emerald-900">
            <div className="flex items-center gap-2 font-bold text-xs sm:text-sm">
              <MonitorCheck className="w-4 h-4 text-emerald-600" />
              <span>一般利用者にはアプリ本体のみが表示されます</span>
            </div>
            <p className="text-xs text-emerald-800/90 leading-relaxed">
              下記のURLを共有・配布すると、Google AI Studioのチャット画面、プロンプト入力欄、コード編集画面は一切表示されず、完成版Webアプリとして直接利用できます。
            </p>
          </div>

          {/* URL コピーエリア */}
          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-800">
              一般利用者配布用 URL
            </label>
            <div className="flex items-center gap-2">
              <div className="flex-1 bg-slate-50 border border-slate-300 rounded-lg px-3 py-2 text-xs font-mono text-slate-800 truncate select-all">
                {appUrl}
              </div>
              <button
                type="button"
                onClick={handleCopy}
                className={`px-3 py-2 rounded-lg font-bold text-xs flex items-center gap-1.5 transition-all cursor-pointer shrink-0 ${
                  copied
                    ? 'bg-emerald-600 text-white shadow-xs'
                    : 'bg-blue-600 hover:bg-blue-700 text-white shadow-xs'
                }`}
              >
                {copied ? (
                  <>
                    <Check className="w-4 h-4" />
                    <span>コピー完了!</span>
                  </>
                ) : (
                  <>
                    <Copy className="w-4 h-4" />
                    <span>URLをコピー</span>
                  </>
                )}
              </button>
            </div>
          </div>

          {/* 別タブで開くテストボタン */}
          <div>
            <button
              type="button"
              onClick={handleOpenDirect}
              className="inline-flex items-center gap-1.5 text-xs text-blue-700 hover:text-blue-900 font-semibold underline cursor-pointer"
            >
              <ExternalLink className="w-3.5 h-3.5" />
              <span>別タブで利用者表示（全画面表示）を確認する</span>
            </button>
          </div>

          {/* セキュリティ・仕様についての案内 */}
          <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg space-y-1.5 text-xs text-slate-600">
            <div className="flex items-center gap-1.5 font-bold text-slate-800">
              <Shield className="w-3.5 h-3.5 text-blue-600" />
              <span>一般利用者画面の権限制限</span>
            </div>
            <ul className="list-disc pl-4 space-y-1 text-slate-600">
              <li>一般利用者は「早出シフトの閲覧、登録、変更、削除」および印刷のみ操作可能です。</li>
              <li>職員マスタの変更、一括自動生成、設定変更は管理者暗証番号で保護されています。</li>
              <li>利用者がアプリの仕様やソースコードを変更することはできません。</li>
            </ul>
          </div>
        </div>

        {/* フッター */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-2 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-lg transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
