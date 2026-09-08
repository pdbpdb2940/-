import React, { useState } from 'react';
import { ShieldCheck, X, KeyRound, AlertCircle, Eye, EyeOff } from 'lucide-react';
import { loadAdminPinFromStorage, normalizePin } from '../utils/storage';

interface AdminLoginModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSuccess: () => void;
}

export const AdminLoginModal: React.FC<AdminLoginModalProps> = ({
  isOpen,
  onClose,
  onSuccess,
}) => {
  const [pin, setPin] = useState('');
  const [error, setError] = useState('');
  const [showPin, setShowPin] = useState(false);

  if (!isOpen) return null;

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const currentPin = loadAdminPinFromStorage();
    const inputNormalized = normalizePin(pin);

    if (inputNormalized === currentPin) {
      setError('');
      setPin('');
      onSuccess();
    } else {
      setError('暗証番号が正しくありません。');
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-xl w-full max-w-sm overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">管理者認証</h3>
              <p className="text-xs text-slate-300">管理者モードへ切り替えます</p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* フォーム */}
        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <p className="text-xs text-slate-600 leading-relaxed">
            職員マスタの変更、一括自動生成、データ管理を行うには管理者の暗証番号を入力してください。
          </p>

          <div className="space-y-1.5">
            <label className="block text-xs font-bold text-slate-700">
              管理者暗証番号 (PIN)
            </label>
            <div className="relative">
              <div className="absolute inset-y-0 left-0 pl-3 flex items-center pointer-events-none text-slate-400">
                <KeyRound className="w-4 h-4" />
              </div>
              <input
                type={showPin ? 'text' : 'password'}
                autoFocus
                value={pin}
                onChange={(e) => {
                  setPin(e.target.value);
                  setError('');
                }}
                placeholder="暗証番号を入力"
                className="w-full pl-9 pr-10 py-2.5 text-sm font-mono tracking-widest rounded-lg border border-slate-300 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
              />
              <button
                type="button"
                onClick={() => setShowPin(!showPin)}
                className="absolute inset-y-0 right-0 pr-3 flex items-center text-slate-400 hover:text-slate-600"
              >
                {showPin ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
              </button>
            </div>

            {error && (
              <div className="flex items-center gap-1.5 text-xs text-rose-600 font-medium pt-1">
                <AlertCircle className="w-4 h-4 shrink-0" />
                <span>{error}</span>
              </div>
            )}
            <p className="text-[11px] text-slate-400 pt-0.5">
              ※ 全角・半角数字のどちらでも入力できます
            </p>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2 border-t border-slate-100">
            <button
              type="button"
              onClick={onClose}
              className="px-3.5 py-2 text-xs font-medium text-slate-600 hover:bg-slate-100 rounded-lg transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              className="px-4 py-2 text-xs font-bold bg-blue-600 hover:bg-blue-700 active:bg-blue-800 text-white rounded-lg transition-colors shadow-xs cursor-pointer flex items-center gap-1.5"
            >
              <ShieldCheck className="w-4 h-4" />
              <span>認証してログイン</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
