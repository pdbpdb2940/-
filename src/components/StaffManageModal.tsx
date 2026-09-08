import React, { useState } from 'react';
import { StaffMember } from '../types';
import { STAFF_COLOR_PALETTES, DEFAULT_STAFF_LIST } from '../utils/constants';
import { X, UserPlus, Trash2, Edit2, Check, RefreshCw, AlertCircle } from 'lucide-react';

interface StaffManageModalProps {
  isOpen: boolean;
  onClose: () => void;
  staffList: StaffMember[];
  onUpdateStaffList: (newStaffList: StaffMember[]) => void;
}

export const StaffManageModal: React.FC<StaffManageModalProps> = ({
  isOpen,
  onClose,
  staffList,
  onUpdateStaffList,
}) => {
  const [newStaffName, setNewStaffName] = useState('');
  const [editingStaffId, setEditingStaffId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [errorMessage, setErrorMessage] = useState('');
  const [confirmDeleteStaffId, setConfirmDeleteStaffId] = useState<string | null>(null);
  const [isConfirmingReset, setIsConfirmingReset] = useState(false);

  if (!isOpen) return null;

  // 職員追加
  const handleAddStaff = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = newStaffName.trim();
    if (!trimmed) {
      setErrorMessage('職員名を入力してください。');
      return;
    }
    if (staffList.some((s) => s.name === trimmed)) {
      setErrorMessage('その名前の職員は既に登録されています。');
      return;
    }

    // パレットから色を選択
    const colorIndex = staffList.length % STAFF_COLOR_PALETTES.length;
    const palette = STAFF_COLOR_PALETTES[colorIndex];

    const newStaff: StaffMember = {
      id: `staff-${Date.now()}`,
      name: trimmed,
      colorBg: palette.colorBg,
      colorText: palette.colorText,
      colorBorder: palette.colorBorder,
    };

    onUpdateStaffList([...staffList, newStaff]);
    setNewStaffName('');
    setErrorMessage('');
  };

  // 職員名変更保存
  const handleSaveEdit = (staffId: string) => {
    const trimmed = editingName.trim();
    if (!trimmed) {
      setErrorMessage('職員名を入力してください。');
      return;
    }
    if (staffList.some((s) => s.id !== staffId && s.name === trimmed)) {
      setErrorMessage('同名の職員が既に存在します。');
      return;
    }

    const updated = staffList.map((s) => (s.id === staffId ? { ...s, name: trimmed } : s));
    onUpdateStaffList(updated);
    setEditingStaffId(null);
    setEditingName('');
    setErrorMessage('');
  };

  // 職員削除
  const handleDelete = (staff: StaffMember) => {
    if (staffList.length <= 1) {
      setErrorMessage('職員は最低1名必要です。');
      return;
    }
    onUpdateStaffList(staffList.filter((s) => s.id !== staff.id));
    setConfirmDeleteStaffId(null);
    setErrorMessage('');
  };

  // 初期値（神谷・紙谷・中野）にリセット
  const handleResetToDefault = () => {
    onUpdateStaffList(DEFAULT_STAFF_LIST);
    setEditingStaffId(null);
    setIsConfirmingReset(false);
    setErrorMessage('');
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-md overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="bg-slate-800 text-white px-5 py-3.5 flex items-center justify-between">
          <div>
            <h2 className="text-base font-bold">職員名簿の管理</h2>
            <p className="text-xs text-slate-300">早出担当者の追加・変更</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="text-slate-300 hover:text-white p-1 rounded-md hover:bg-slate-700"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="p-5 space-y-4 max-h-[75vh] overflow-y-auto">
          {errorMessage && (
            <div className="flex items-center gap-1.5 p-2 bg-rose-50 border border-rose-200 text-rose-700 text-xs rounded-md">
              <AlertCircle className="w-4 h-4 shrink-0" />
              <span>{errorMessage}</span>
            </div>
          )}

          {/* 新規職員追加フォーム */}
          <form onSubmit={handleAddStaff} className="flex gap-2">
            <input
              type="text"
              placeholder="新しい職員名 (例: 佐藤)"
              value={newStaffName}
              onChange={(e) => setNewStaffName(e.target.value)}
              className="flex-1 px-3 py-2 text-sm border border-slate-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
            <button
              type="submit"
              className="inline-flex items-center gap-1 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-md shadow-xs transition-colors shrink-0"
            >
              <UserPlus className="w-4 h-4" />
              <span>追加</span>
            </button>
          </form>

          {/* 登録職員一覧 */}
          <div>
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider mb-2">
              登録中の職員一覧（{staffList.length}名）
            </h3>

            <div className="space-y-2">
              {staffList.map((staff) => {
                const isEditing = editingStaffId === staff.id;
                return (
                  <div
                    key={staff.id}
                    className={`flex items-center justify-between p-2.5 rounded-lg border ${staff.colorBorder} ${staff.colorBg}`}
                  >
                    {isEditing ? (
                      <div className="flex items-center gap-2 flex-1 mr-2">
                        <input
                          type="text"
                          value={editingName}
                          onChange={(e) => setEditingName(e.target.value)}
                          className="px-2 py-1 text-sm bg-white border border-slate-300 rounded-md flex-1"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveEdit(staff.id)}
                          className="p-1 text-emerald-700 hover:bg-emerald-100 rounded"
                          title="確定"
                        >
                          <Check className="w-4 h-4" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingStaffId(null)}
                          className="p-1 text-slate-500 hover:bg-slate-200 rounded"
                          title="キャンセル"
                        >
                          <X className="w-4 h-4" />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2">
                        <span className="w-3 h-3 rounded-full bg-slate-400" />
                        <span className="font-bold text-slate-900 text-sm">{staff.name}</span>
                      </div>
                    )}

                    {!isEditing && (
                      <div className="flex items-center gap-1.5 shrink-0">
                        {confirmDeleteStaffId === staff.id ? (
                          <div className="flex items-center gap-1 bg-white/90 border border-rose-300 text-rose-800 text-xs px-2 py-0.5 rounded shadow-xs">
                            <span className="font-semibold whitespace-nowrap">削除？</span>
                            <button
                              type="button"
                              onClick={() => handleDelete(staff)}
                              className="bg-rose-600 hover:bg-rose-700 text-white font-bold px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer"
                            >
                              削除
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteStaffId(null)}
                              className="bg-slate-200 hover:bg-slate-300 text-slate-700 px-1.5 py-0.5 rounded text-[11px] transition-colors cursor-pointer"
                            >
                              取消
                            </button>
                          </div>
                        ) : (
                          <>
                            <button
                              type="button"
                              onClick={() => {
                                setEditingStaffId(staff.id);
                                setEditingName(staff.name);
                                setConfirmDeleteStaffId(null);
                              }}
                              className="p-1 text-slate-600 hover:text-blue-600 hover:bg-white/60 rounded"
                              title="名前を変更"
                            >
                              <Edit2 className="w-4 h-4" />
                            </button>
                            <button
                              type="button"
                              onClick={() => setConfirmDeleteStaffId(staff.id)}
                              className="p-1 text-slate-600 hover:text-rose-600 hover:bg-white/60 rounded cursor-pointer"
                              title="削除"
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          </>
                        )}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* 初期化オプション */}
          <div className="pt-2 border-t border-slate-200 text-xs text-slate-500">
            {isConfirmingReset ? (
              <div className="flex items-center justify-between gap-2 p-2 bg-amber-50 border border-amber-200 rounded-md text-amber-900">
                <span>初期設定（神谷・紙谷・中野）に戻しますか？</span>
                <div className="flex items-center gap-1.5 shrink-0">
                  <button
                    type="button"
                    onClick={handleResetToDefault}
                    className="bg-amber-600 hover:bg-amber-700 text-white font-bold px-2 py-1 rounded text-xs transition-colors cursor-pointer"
                  >
                    リセット実行
                  </button>
                  <button
                    type="button"
                    onClick={() => setIsConfirmingReset(false)}
                    className="bg-slate-200 hover:bg-slate-300 text-slate-700 font-medium px-2 py-1 rounded text-xs transition-colors cursor-pointer"
                  >
                    取消
                  </button>
                </div>
              </div>
            ) : (
              <button
                type="button"
                onClick={() => setIsConfirmingReset(true)}
                className="inline-flex items-center gap-1 text-slate-500 hover:text-slate-800 transition-colors cursor-pointer"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>初期設定（神谷・紙谷・中野）に戻す</span>
              </button>
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
