import React from 'react';
import {
  ChevronLeft,
  ChevronRight,
  ChevronsLeft,
  ChevronsRight,
  Calendar as CalendarIcon,
  Printer,
  CalendarRange,
  Users,
  FileSpreadsheet,
  Lock,
  ShieldCheck,
  LogOut,
  Settings,
  Share2,
  Download,
  ShieldAlert,
  UserCheck,
} from 'lucide-react';
import { useAuth } from '../context/AuthContext';

interface HeaderProps {
  currentYear: number;
  currentMonth: number; // 1-12
  isAdminMode: boolean;
  isCloudSynced?: boolean;
  totalShiftsCount?: number;
  monthShiftsCount?: number;
  onPrevMonth: () => void;
  onNextMonth: () => void;
  onPrevYear: () => void;
  onNextYear: () => void;
  onToday: () => void;
  onOpenBatchModal: () => void;
  onOpenStaffManage: () => void;
  onOpenCsvModal: () => void;
  onOpenPrintModal: () => void;
  onOpenAdminLogin: () => void;
  onLogoutAdmin: () => void;
  onOpenAdminSettings: () => void;
  onOpenShareModal: () => void;
  onOpenAuditLogs: () => void;
  onOpenSurnameEdit: () => void;
}

export const Header: React.FC<HeaderProps> = ({
  currentYear,
  currentMonth,
  isAdminMode,
  isCloudSynced = true,
  totalShiftsCount = 0,
  monthShiftsCount = 0,
  onPrevMonth,
  onNextMonth,
  onPrevYear,
  onNextYear,
  onToday,
  onOpenBatchModal,
  onOpenStaffManage,
  onOpenCsvModal,
  onOpenPrintModal,
  onOpenAdminLogin,
  onLogoutAdmin,
  onOpenAdminSettings,
  onOpenShareModal,
  onOpenAuditLogs,
  onOpenSurnameEdit,
}) => {
  const { user, surname, loginWithGoogle, logout, isAuthReady } = useAuth();
  return (
    <header className="bg-white border-b border-slate-200 sticky top-0 z-20 shadow-xs print:hidden">
      {/* 管理者モード時のみ表示される最上部ステータスバー */}
      {isAdminMode && (
        <div className="bg-amber-500 text-slate-950 px-3 sm:px-6 py-1.5 text-xs font-bold flex items-center justify-between shadow-inner">
          <div className="flex items-center gap-2">
            <ShieldCheck className="w-4 h-4 text-slate-950 shrink-0" />
            <span>【管理者モード作動中】 職員マスタ・一括生成・システム設定が開放されています</span>
          </div>
          <div className="flex items-center gap-2">
            <button
              type="button"
              onClick={onOpenAuditLogs}
              className="inline-flex items-center gap-1 bg-white/90 hover:bg-white text-slate-900 px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer"
              title="シフトや業務予定の登録・編集・削除監査ログを確認"
            >
              <ShieldAlert className="w-3 h-3 text-amber-800" />
              <span>操作履歴ログ</span>
            </button>
            <button
              type="button"
              onClick={onOpenShareModal}
              className="inline-flex items-center gap-1 bg-white/90 hover:bg-white text-slate-900 px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Share2 className="w-3 h-3" />
              <span>利用者用URL共有</span>
            </button>
            <button
              type="button"
              onClick={onOpenAdminSettings}
              className="inline-flex items-center gap-1 bg-white/90 hover:bg-white text-slate-900 px-2 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer"
            >
              <Settings className="w-3 h-3" />
              <span>環境設定</span>
            </button>
            <button
              type="button"
              onClick={onLogoutAdmin}
              className="inline-flex items-center gap-1 bg-slate-900 hover:bg-slate-800 text-white px-2.5 py-0.5 rounded text-[11px] font-bold transition-colors cursor-pointer"
            >
              <LogOut className="w-3 h-3" />
              <span>利用者画面へ戻る</span>
            </button>
          </div>
        </div>
      )}

      <div className="max-w-7xl mx-auto px-3 sm:px-6 py-2.5 sm:py-3">
        {/* 上段：タイトルとツールボタン */}
        <div className="flex flex-wrap items-center justify-between gap-2 mb-2 sm:mb-2.5">
          <div className="flex items-center gap-2">
            <div className="bg-blue-600 text-white p-1.5 rounded-md shadow-xs">
              <CalendarIcon className="w-5 h-5" />
            </div>
            <div>
              <div className="flex items-center gap-2">
                <h1 className="text-lg sm:text-xl font-bold text-slate-900 tracking-tight leading-tight">
                  施設管理 早出シフト表
                </h1>
                {isAdminMode ? (
                  <span className="text-[11px] bg-amber-100 text-amber-900 border border-amber-300 font-bold px-1.5 py-0.5 rounded">
                    管理者画面
                  </span>
                ) : (
                  <span className="text-[11px] bg-slate-100 text-slate-600 border border-slate-200 font-medium px-1.5 py-0.5 rounded hidden xs:inline">
                    一般利用者画面
                  </span>
                )}
                {isCloudSynced && (
                  <span
                    className="inline-flex items-center gap-1.5 text-[10px] sm:text-xs text-emerald-800 bg-emerald-50 border border-emerald-300 font-semibold px-2 py-0.5 rounded shadow-xs"
                    title={`Google Cloud Firestoreとリアルタイム同期中（全登録: ${totalShiftsCount}件、当月: ${monthShiftsCount}件）`}
                  >
                    <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
                    <span>クラウド同期中 ({totalShiftsCount}件)</span>
                  </span>
                )}
              </div>
              <p className="text-xs text-slate-500 hidden sm:block">
                担当: 神谷・紙谷・中野 ｜ 勤務時間: 7:30～16:15 ｜ 日付をクリックして早出・業務予定を登録
              </p>
            </div>
          </div>

          {/* アクションボタン群 */}
          <div className="flex items-center flex-wrap gap-1.5 sm:gap-2">
            {/* Googleアカウントログインステータス */}
            {!isAuthReady ? (
              <div className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs font-medium text-slate-500 bg-slate-50 border border-slate-200">
                <span className="w-2 h-2 rounded-full bg-blue-500 animate-pulse" />
                <span>認証確認中...</span>
              </div>
            ) : !user ? (
              <button
                type="button"
                onClick={loginWithGoogle}
                className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold bg-white hover:bg-slate-50 text-slate-700 border border-slate-300 shadow-2xs transition-colors cursor-pointer"
                title="Googleアカウントでログインするとシフトや業務予定の登録・編集ができます"
              >
                <svg className="w-4 h-4 shrink-0" viewBox="0 0 24 24">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.7-.06-1.4-.19-2.07H12v4.51h6.6c-.29 1.52-1.14 2.82-2.4 3.68v3.05h3.88c2.27-2.09 3.665-5.17 3.665-9.17z"
                  />
                  <path
                    fill="#34A853"
                    d="M12 24c3.24 0 5.95-1.08 7.93-2.91l-3.88-3.05c-1.08.72-2.45 1.16-4.05 1.16-3.12 0-5.77-2.1-6.72-4.93H1.25v3.15C3.26 21.36 7.33 24 12 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.28 14.27c-.25-.72-.38-1.49-.38-2.27s.13-1.55.38-2.27V6.58H1.25C.45 8.18 0 10.02 0 12s.45 3.82 1.25 5.42l4.03-3.15z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C17.95 1.19 15.24 0 12 0 7.33 0 3.26 2.64 1.25 6.58l4.03 3.15c.95-2.83 3.6-4.98 6.72-4.98z"
                  />
                </svg>
                <span>Googleでログイン</span>
              </button>
            ) : (
              <div className="inline-flex items-center gap-1.5 bg-blue-50 border border-blue-200 px-2.5 py-1.5 rounded-md text-xs font-semibold text-blue-950">
                <span className="w-2 h-2 rounded-full bg-blue-600 shrink-0" />
                <span className="font-bold">{surname}でログイン中</span>
                <button
                  type="button"
                  onClick={onOpenSurnameEdit}
                  className="text-blue-700 hover:text-blue-900 p-0.5 rounded hover:bg-blue-100 transition-colors cursor-pointer"
                  title="表示する苗字を変更する"
                >
                  <UserCheck className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={logout}
                  className="text-slate-500 hover:text-rose-600 p-0.5 rounded hover:bg-rose-50 transition-colors cursor-pointer ml-0.5"
                  title="ログアウト"
                >
                  <LogOut className="w-3.5 h-3.5" />
                </button>
              </div>
            )}

            {/* 管理者モードのみ表示される管理ボタン */}
            {isAdminMode && (
              <>
                <button
                  type="button"
                  onClick={onOpenBatchModal}
                  className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs sm:text-sm font-bold bg-blue-600 hover:bg-blue-700 text-white shadow-xs transition-colors cursor-pointer"
                  title="曜日や期間を指定して早出シフトをまとめて登録"
                >
                  <CalendarRange className="w-4 h-4" />
                  <span>まとめて設定</span>
                </button>

                <button
                  type="button"
                  onClick={onOpenStaffManage}
                  className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
                  title="職員名簿の確認・追加・カラー設定"
                >
                  <Users className="w-4 h-4 text-slate-600" />
                  <span>職員設定</span>
                </button>
              </>
            )}

            {/* CSVボタン（管理者モードはインポート/エクスポート両用、利用者モードはカレンダーCSV保存） */}
            <button
              type="button"
              onClick={onOpenCsvModal}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium bg-white text-slate-700 border border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              title={isAdminMode ? 'CSVバックアップ・読み込み' : 'Excel/CSVカレンダーをダウンロード'}
            >
              {isAdminMode ? (
                <>
                  <FileSpreadsheet className="w-4 h-4 text-emerald-600" />
                  <span>CSV保存/読込</span>
                </>
              ) : (
                <>
                  <Download className="w-4 h-4 text-emerald-600" />
                  <span>カレンダーCSV</span>
                </>
              )}
            </button>

            {/* 印刷プレビューボタン（利用者・管理者共通） */}
            <button
              type="button"
              onClick={onOpenPrintModal}
              className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium bg-slate-800 hover:bg-slate-900 text-white shadow-xs transition-colors cursor-pointer"
              title="A4横向きで印刷プレビューを開きます"
            >
              <Printer className="w-4 h-4" />
              <span>印刷 (A4横)</span>
            </button>

            {/* 利用者画面の場合：管理者ログインボタン */}
            {!isAdminMode ? (
              <button
                type="button"
                onClick={onOpenAdminLogin}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 rounded-md text-xs sm:text-sm font-medium bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200 transition-colors cursor-pointer ml-1"
                title="管理者用モードにログイン（暗証番号必要）"
              >
                <Lock className="w-3.5 h-3.5 text-slate-500" />
                <span>管理者</span>
              </button>
            ) : (
              <button
                type="button"
                onClick={onOpenAdminSettings}
                className="p-1.5 rounded-md text-slate-600 hover:text-slate-900 hover:bg-slate-100 border border-slate-300 transition-colors cursor-pointer"
                title="管理者設定・暗証番号変更"
              >
                <Settings className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>


        {/* 下段：年月ナビゲーションコントロール */}
        <div className="flex flex-wrap items-center justify-between gap-3 pt-1 border-t border-slate-100">
          {/* 年月表示（大きく視認性高く） */}
          <div className="flex items-center gap-2">
            <span className="text-2xl sm:text-3xl font-extrabold text-slate-900 tracking-tight font-sans">
              {currentYear}年 {currentMonth}月
            </span>
          </div>

          {/* 切り替えボタン群 */}
          <div className="flex items-center gap-1 sm:gap-2">
            <div className="inline-flex rounded-md shadow-xs" role="group">
              <button
                type="button"
                onClick={onPrevYear}
                className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-300 rounded-l-md hover:bg-slate-50 transition-colors cursor-pointer"
                title="前年へ"
              >
                <ChevronsLeft className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onPrevMonth}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-white border-t border-b border-r border-slate-300 hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <ChevronLeft className="w-4 h-4" />
                <span>前月</span>
              </button>
            </div>

            <button
              type="button"
              onClick={onToday}
              className="px-3 py-1.5 text-xs sm:text-sm font-semibold text-blue-700 bg-blue-50 border border-blue-200 rounded-md hover:bg-blue-100 transition-colors cursor-pointer"
            >
              今月
            </button>

            <div className="inline-flex rounded-md shadow-xs" role="group">
              <button
                type="button"
                onClick={onNextMonth}
                className="inline-flex items-center gap-1 px-2.5 py-1.5 text-xs sm:text-sm font-medium text-slate-700 bg-white border border-slate-300 rounded-l-md hover:bg-slate-50 transition-colors cursor-pointer"
              >
                <span>次月</span>
                <ChevronRight className="w-4 h-4" />
              </button>
              <button
                type="button"
                onClick={onNextYear}
                className="px-2 py-1.5 text-xs font-medium text-slate-700 bg-white border-t border-b border-r border-slate-300 rounded-r-md hover:bg-slate-50 transition-colors cursor-pointer"
                title="次年へ"
              >
                <ChevronsRight className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </header>
  );
};

