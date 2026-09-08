import React, { useState } from 'react';
import {
  ShieldCheck,
  X,
  KeyRound,
  Users,
  RotateCcw,
  Check,
  AlertTriangle,
  Lock,
  Share2,
  LogOut,
} from 'lucide-react';
import { StaffMember } from '../types';
import {
  loadAdminPinFromStorage,
  saveAdminPinToStorage,
  resetStaffToDefault,
  normalizePin,
} from '../utils/storage';

interface AdminSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLogoutAdmin: () => void;
  onOpenShareModal: () => void;
  onStaffListUpdated: (staffList: StaffMember[]) => void;
}

export const AdminSettingsModal: React.FC<AdminSettingsModalProps> = ({
  isOpen,
  onClose,
  onLogoutAdmin,
  onOpenShareModal,
  onStaffListUpdated,
}) => {
  const [currentPin, setCurrentPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [pinMessage, setPinMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(
    null
  );
  const [resetMessage, setResetMessage] = useState<string | null>(null);

  if (!isOpen) return null;

  const handleUpdatePin = (e: React.FormEvent) => {
    e.preventDefault();
    const storedPin = loadAdminPinFromStorage();
    const normCurrentPin = normalizePin(currentPin);
    const normNewPin = normalizePin(newPin);
    const normConfirmPin = normalizePin(confirmPin);

    if (normCurrentPin !== storedPin) {
      setPinMessage({ type: 'error', text: '現在の暗証番号が一致しません。' });
      return;
    }
    if (normNewPin.length < 4) {
      setPinMessage({ type: 'error', text: '新しい暗証番号は4文字以上で設定してください。' });
      return;
    }
    if (normNewPin !== normConfirmPin) {
      setPinMessage({ type: 'error', text: '新しい暗証番号の確認用が一致しません。' });
      return;
    }

    saveAdminPinToStorage(normNewPin);
    setPinMessage({ type: 'success', text: '管理者暗証番号を正常に変更しました。' });
    setCurrentPin('');
    setNewPin('');
    setConfirmPin('');
  };

  const handleResetStaff = () => {
    if (
      window.confirm(
        '職員マスタを初期担当者（神谷・紙谷・中野の3名）にリセットしますか？\n既存のシフトデータは保持されます。'
      )
    ) {
      const defaultStaff = resetStaffToDefault();
      onStaffListUpdated(defaultStaff);
      setResetMessage('職員マスタを神谷・紙谷・中野の3名にリセットしました。');
      setTimeout(() => setResetMessage(null), 3000);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg overflow-hidden border border-slate-200 animate-in fade-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="bg-slate-900 text-white px-5 py-4 flex items-center justify-between">
          <div className="flex items-center gap-2.5">
            <div className="p-1.5 bg-blue-600 rounded-lg text-white">
              <ShieldCheck className="w-5 h-5" />
            </div>
            <div>
              <h3 className="font-bold text-base leading-tight">管理者メニュー・環境設定</h3>
              <p className="text-xs text-slate-300">権限管理・暗証番号・システム保守</p>
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

        {/* 本文 */}
        <div className="p-5 space-y-5 max-h-[80vh] overflow-y-auto">
          {/* セクション1: 利用者向け共有URL */}
          <div className="p-3.5 bg-blue-50 border border-blue-200 rounded-lg flex items-center justify-between gap-3">
            <div>
              <h4 className="text-xs sm:text-sm font-bold text-blue-900 flex items-center gap-1.5">
                <Share2 className="w-4 h-4 text-blue-700" />
                <span>一般利用者向け完成版URLの配布</span>
              </h4>
              <p className="text-[11px] text-blue-800/80 mt-0.5">
                チャット画面やAI StudioのUIを出さずにアプリ単体として配布できます。
              </p>
            </div>
            <button
              type="button"
              onClick={() => {
                onClose();
                onOpenShareModal();
              }}
              className="px-3 py-1.5 bg-blue-600 hover:bg-blue-700 text-white rounded-lg text-xs font-bold shrink-0 transition-colors shadow-xs cursor-pointer"
            >
              共有URL確認
            </button>
          </div>

          {/* セクション2: 担当者マスタの初期化（神谷・紙谷・中野） */}
          <div className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
                <Users className="w-4 h-4 text-slate-600" />
                <span>担当者マスタのリセット</span>
              </h4>
              <button
                type="button"
                onClick={handleResetStaff}
                className="px-2.5 py-1 text-xs font-bold text-slate-700 bg-white border border-slate-300 hover:bg-slate-100 rounded-md transition-colors flex items-center gap-1 cursor-pointer"
              >
                <RotateCcw className="w-3.5 h-3.5" />
                <span>神谷・紙谷・中野に初期化</span>
              </button>
            </div>
            <p className="text-[11px] text-slate-500">
              担当者リストを初期設定（神谷、紙谷、中野の3名・勤務時間7:30～16:15）に再設定します。
            </p>
            {resetMessage && (
              <div className="p-2 bg-emerald-50 text-emerald-700 text-xs rounded border border-emerald-200 font-medium">
                {resetMessage}
              </div>
            )}
          </div>

          {/* セクション3: 管理者暗証番号の変更 */}
          <form onSubmit={handleUpdatePin} className="p-3.5 bg-slate-50 border border-slate-200 rounded-lg space-y-3">
            <h4 className="text-xs sm:text-sm font-bold text-slate-800 flex items-center gap-1.5">
              <KeyRound className="w-4 h-4 text-slate-600" />
              <span>管理者暗証番号 (PIN) の変更</span>
            </h4>

            {pinMessage && (
              <div
                className={`p-2 text-xs rounded border font-medium ${
                  pinMessage.type === 'success'
                    ? 'bg-emerald-50 text-emerald-700 border-emerald-200'
                    : 'bg-rose-50 text-rose-700 border-rose-200'
                }`}
              >
                {pinMessage.text}
              </div>
            )}

            <div className="space-y-2">
              <div>
                <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                  現在の暗証番号
                </label>
                <input
                  type="password"
                  value={currentPin}
                  onChange={(e) => setCurrentPin(e.target.value)}
                  placeholder="現在の暗証番号を入力"
                  className="w-full text-xs p-2 rounded border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                />
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                    新しい暗証番号 (4桁以上)
                  </label>
                  <input
                    type="password"
                    value={newPin}
                    onChange={(e) => setNewPin(e.target.value)}
                    placeholder="新しい暗証番号"
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-bold text-slate-600 mb-0.5">
                    新しい暗証番号 (確認用)
                  </label>
                  <input
                    type="password"
                    value={confirmPin}
                    onChange={(e) => setConfirmPin(e.target.value)}
                    placeholder="もう一度入力"
                    className="w-full text-xs p-2 rounded border border-slate-300 font-mono focus:outline-none focus:ring-1 focus:ring-blue-500"
                  />
                </div>
              </div>
            </div>

            <div className="flex justify-end pt-1">
              <button
                type="submit"
                className="px-3.5 py-1.5 text-xs font-bold bg-slate-800 hover:bg-slate-900 text-white rounded-md transition-colors cursor-pointer"
              >
                暗証番号を更新
              </button>
            </div>
          </form>

          {/* セクション4: 管理者モード終了 */}
          <div className="pt-2 border-t border-slate-200 flex items-center justify-between">
            <span className="text-xs text-slate-500">
              一般利用者に渡す前に管理者モードを終了してください。
            </span>
            <button
              type="button"
              onClick={() => {
                onLogoutAdmin();
                onClose();
              }}
              className="px-3 py-2 bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200 rounded-lg text-xs font-bold transition-colors flex items-center gap-1.5 cursor-pointer"
            >
              <LogOut className="w-3.5 h-3.5" />
              <span>管理者モードを終了して利用者画面へ</span>
            </button>
          </div>
        </div>

        {/* フッター */}
        <div className="bg-slate-50 px-5 py-3 border-t border-slate-200 flex justify-end">
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-200 rounded-lg transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
