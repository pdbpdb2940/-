import React, { useState, useEffect } from 'react';
import { X, Check, UserCheck } from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface SurnameEditModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const SurnameEditModal: React.FC<SurnameEditModalProps> = ({ isOpen, onClose }) => {
  const { user, surname, updateSurname } = useAuth();
  const [inputSurname, setInputSurname] = useState(surname);
  const [isSaving, setIsSaving] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setInputSurname(surname);
    }
  }, [isOpen, surname]);

  if (!isOpen || !user) return null;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!inputSurname.trim()) return;

    setIsSaving(true);
    try {
      await updateSurname(inputSurname.trim());
      onClose();
    } catch (err) {
      console.error(err);
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-sm overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        <div className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between">
          <div className="flex items-center gap-2">
            <UserCheck className="w-5 h-5 text-blue-400" />
            <h3 className="text-base font-bold">表示姓（苗字）の設定</h3>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-400 hover:text-white p-1 rounded-md transition-colors cursor-pointer"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-5 space-y-4">
          <div>
            <p className="text-xs text-slate-600 mb-2 leading-relaxed">
              カレンダー上に記録・表示される「登録者」の苗字です。Googleアカウント名から自動取得されていますが、必要に応じて修正できます。
            </p>
            <label className="block text-xs font-bold text-slate-700 mb-1">
              あなたの苗字（姓）
            </label>
            <input
              type="text"
              required
              value={inputSurname}
              onChange={(e) => setInputSurname(e.target.value)}
              placeholder="例: 神谷、紙谷、中野"
              maxLength={10}
              className="w-full px-3 py-2 border border-slate-300 rounded-lg text-slate-900 font-bold focus:ring-2 focus:ring-blue-500 focus:outline-none"
            />
          </div>

          <div className="bg-slate-50 p-2.5 rounded-lg border border-slate-200 text-[11px] text-slate-500 space-y-1">
            <div>
              ・Google名: <span className="font-semibold text-slate-700">{user.displayName || '未設定'}</span>
            </div>
            <div>
              ※ カレンダーにはフルネームやメールアドレスは公開されず、この苗字のみが記録・使用されます。
            </div>
          </div>

          <div className="flex items-center justify-end gap-2 pt-2">
            <button
              type="button"
              onClick={onClose}
              className="px-3 py-1.5 text-xs text-slate-600 hover:bg-slate-100 rounded-lg font-medium transition-colors cursor-pointer"
            >
              キャンセル
            </button>
            <button
              type="submit"
              disabled={isSaving || !inputSurname.trim()}
              className="inline-flex items-center gap-1.5 px-4 py-1.5 bg-blue-600 hover:bg-blue-700 disabled:bg-slate-300 text-white rounded-lg text-xs font-bold shadow-xs transition-colors cursor-pointer"
            >
              <Check className="w-4 h-4" />
              <span>保存する</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};
