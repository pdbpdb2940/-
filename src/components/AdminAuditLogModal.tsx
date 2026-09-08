import React, { useState, useEffect, useMemo } from 'react';
import { X, ShieldAlert, Search, Filter, Calendar, Clock, RefreshCw } from 'lucide-react';
import { AuditLog } from '../types';
import { subscribeAuditLogs } from '../services/firestoreService';

interface AdminAuditLogModalProps {
  isOpen: boolean;
  onClose: () => void;
}

export const AdminAuditLogModal: React.FC<AdminAuditLogModalProps> = ({ isOpen, onClose }) => {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filterType, setFilterType] = useState<'all' | 'shift' | 'task'>('all');
  const [filterAction, setFilterAction] = useState<'all' | 'create' | 'update' | 'delete'>('all');
  const [searchTerm, setSearchTerm] = useState<string>('');

  useEffect(() => {
    if (!isOpen) return;

    const unsubscribe = subscribeAuditLogs((fetchedLogs) => {
      setLogs(fetchedLogs);
    });

    return () => unsubscribe();
  }, [isOpen]);

  // フィルタリング処理
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      if (filterType !== 'all' && log.targetType !== filterType) return false;
      if (filterAction !== 'all' && log.action !== filterAction) return false;
      if (searchTerm.trim()) {
        const term = searchTerm.toLowerCase();
        const matchUser = log.userName.toLowerCase().includes(term);
        const matchEmail = (log.userEmail || '').toLowerCase().includes(term);
        const matchSummary = log.targetSummary.toLowerCase().includes(term);
        const matchDate = log.targetDate.includes(term);
        if (!matchUser && !matchEmail && !matchSummary && !matchDate) return false;
      }
      return true;
    });
  }, [logs, filterType, filterAction, searchTerm]);

  if (!isOpen) return null;

  const formatDate = (timestamp: number) => {
    const d = new Date(timestamp);
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    const h = String(d.getHours()).padStart(2, '0');
    const min = String(d.getMinutes()).padStart(2, '0');
    const sec = String(d.getSeconds()).padStart(2, '0');
    return `${y}/${m}/${day} ${h}:${min}:${sec}`;
  };

  const getActionBadge = (action: 'create' | 'update' | 'delete') => {
    switch (action) {
      case 'create':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-emerald-100 text-emerald-800 border border-emerald-300">
            新規登録
          </span>
        );
      case 'update':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-blue-100 text-blue-800 border border-blue-300">
            編集・更新
          </span>
        );
      case 'delete':
        return (
          <span className="inline-flex items-center px-2 py-0.5 rounded text-[11px] font-bold bg-rose-100 text-rose-800 border border-rose-300">
            削除
          </span>
        );
    }
  };

  const getTargetBadge = (targetType: 'shift' | 'task') => {
    return targetType === 'shift' ? (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-indigo-50 text-indigo-700 border border-indigo-200">
        早出シフト
      </span>
    ) : (
      <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[11px] font-medium bg-amber-50 text-amber-800 border border-amber-200">
        業務予定
      </span>
    );
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-3 sm:p-6 bg-slate-900/60 backdrop-blur-xs">
      <div className="bg-white rounded-xl shadow-2xl border border-slate-200 w-full max-w-4xl max-h-[85vh] flex flex-col overflow-hidden animate-in fade-in zoom-in-95 duration-150">
        {/* ヘッダー */}
        <div className="bg-slate-900 text-white px-5 py-3.5 flex items-center justify-between shrink-0">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-amber-400" />
            <div>
              <h2 className="text-base font-bold">管理者用 操作・編集履歴ログ</h2>
              <p className="text-[11px] text-slate-400">
                誰がどのシフト・業務予定を登録・編集・削除したかの全監査ログ（最新200件）
              </p>
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

        {/* フィルター＆検索ツールバー */}
        <div className="p-3 bg-slate-50 border-b border-slate-200 flex flex-wrap items-center justify-between gap-2 shrink-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* 種別フィルター */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 font-medium">対象:</span>
              <select
                value={filterType}
                onChange={(e) => setFilterType(e.target.value as any)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">すべて</option>
                <option value="shift">早出シフト</option>
                <option value="task">業務予定</option>
              </select>
            </div>

            {/* 操作種別フィルター */}
            <div className="flex items-center gap-1 text-xs">
              <span className="text-slate-500 font-medium">操作:</span>
              <select
                value={filterAction}
                onChange={(e) => setFilterAction(e.target.value as any)}
                className="bg-white border border-slate-300 rounded px-2 py-1 text-xs font-medium focus:ring-1 focus:ring-blue-500"
              >
                <option value="all">すべて</option>
                <option value="create">新規登録</option>
                <option value="update">編集・変更</option>
                <option value="delete">削除</option>
              </select>
            </div>
          </div>

          {/* 検索入力 */}
          <div className="relative flex-1 sm:max-w-xs min-w-[180px]">
            <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
            <input
              type="text"
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              placeholder="操作者・日付・内容で検索..."
              className="w-full pl-8 pr-3 py-1 bg-white border border-slate-300 rounded text-xs focus:ring-1 focus:ring-blue-500 focus:outline-none"
            />
          </div>
        </div>

        {/* ログ一覧テーブル */}
        <div className="flex-1 overflow-y-auto p-4">
          {filteredLogs.length === 0 ? (
            <div className="text-center py-12 text-slate-400 text-xs">
              該当する操作ログはありません
            </div>
          ) : (
            <div className="border border-slate-200 rounded-lg overflow-hidden shadow-2xs">
              <table className="w-full text-left text-xs border-collapse">
                <thead className="bg-slate-100 text-slate-700 font-bold border-b border-slate-200 select-none">
                  <tr>
                    <th className="py-2 px-3 whitespace-nowrap">日時</th>
                    <th className="py-2 px-2 whitespace-nowrap">区分</th>
                    <th className="py-2 px-2 whitespace-nowrap">操作</th>
                    <th className="py-2 px-2 whitespace-nowrap">対象日</th>
                    <th className="py-2 px-3">内容要約</th>
                    <th className="py-2 px-3 whitespace-nowrap">操作者 (Google)</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 bg-white">
                  {filteredLogs.map((log) => (
                    <tr key={log.id} className="hover:bg-slate-50 transition-colors">
                      <td className="py-2.5 px-3 text-slate-500 font-mono whitespace-nowrap text-[11px]">
                        {formatDate(log.timestamp)}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        {getTargetBadge(log.targetType)}
                      </td>
                      <td className="py-2.5 px-2 whitespace-nowrap">
                        {getActionBadge(log.action)}
                      </td>
                      <td className="py-2.5 px-2 font-mono font-medium text-slate-800 whitespace-nowrap">
                        {log.targetDate}
                      </td>
                      <td className="py-2.5 px-3 font-medium text-slate-800">
                        {log.targetSummary}
                      </td>
                      <td className="py-2.5 px-3 whitespace-nowrap">
                        <div className="flex flex-col">
                          <span className="font-bold text-slate-900">{log.userName}</span>
                          {log.userEmail && (
                            <span className="text-[10px] text-slate-400 font-mono">
                              {log.userEmail}
                            </span>
                          )}
                        </div>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* フッター */}
        <div className="p-3 bg-slate-50 border-t border-slate-200 flex items-center justify-between text-xs text-slate-500 shrink-0">
          <div>表示件数: {filteredLogs.length}件 / 総計: {logs.length}件</div>
          <button
            type="button"
            onClick={onClose}
            className="px-4 py-1.5 bg-slate-800 hover:bg-slate-900 text-white rounded text-xs font-bold transition-colors cursor-pointer"
          >
            閉じる
          </button>
        </div>
      </div>
    </div>
  );
};
