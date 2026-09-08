/**
 * 早出シフト管理システムの型定義
 */

export type AbsenceType = '休み' | '出張' | '研修' | 'その他' | string;

// 早出シフト・不在レコード型
export interface ShiftRecord {
  id: string;          // 一意のID (UUIDまたはタイムスタンプ)
  date: string;        // 日付形式: 'YYYY-MM-DD'
  staffName: string;   // 担当職員名 (例: '神谷', '紙谷', '中野')
  startTime: string;   // 開始時間 (例: '07:30' または '終日')
  endTime: string;     // 終了時間 (例: '16:15' または '')
  note?: string;       // 備考（出張先や用件など）
  isAbsence?: boolean; // 不在フラグ（休み・出張・研修など）
  absenceType?: AbsenceType; // 不在種別（'休み', '出張', '研修', 'その他' など）
  createdByUid?: string;   // 登録者GoogleアカウントUID
  createdByName?: string;  // 登録者の苗字 (例: '神谷')
  updatedByUid?: string;   // 最終更新者GoogleアカウントUID
  updatedByName?: string;  // 最終更新者の苗字
  createdAt: number;   // 作成タイムスタンプ
  updatedAt?: number;  // 更新タイムスタンプ
}

// 業務予定型 (例: 芝刈り 9:00～11:30 担当: 紙谷 登録者: 神谷)
export interface TaskSchedule {
  id: string;          // 一意のID
  date: string;        // 日付形式: 'YYYY-MM-DD'
  title: string;       // 業務名 (例: '芝刈り')
  time: string;        // 業務時間 (例: '9:00～11:30')
  staffName: string;   // 担当者 (例: '紙谷')
  note?: string;       // 備考・詳細
  createdByUid?: string;   // 登録者GoogleアカウントUID
  createdByName?: string;  // 登録者の苗字 (例: '神谷')
  updatedByUid?: string;   // 最終更新者GoogleアカウントUID
  updatedByName?: string;  // 最終更新者の苗字
  createdAt: number;   // 作成タイムスタンプ
  updatedAt?: number;  // 更新タイムスタンプ
}

// 操作・変更履歴監査ログ型（管理人のみ閲覧可能）
export interface AuditLog {
  id: string;
  action: 'create' | 'update' | 'delete';
  targetType: 'shift' | 'task';
  targetDate: string;
  targetSummary: string; // 例: '早出: 紙谷 (06:30～15:15)' または '業務: 芝刈り (9:00～11:30 担当:紙谷)'
  userUid: string;
  userName: string;      // 苗字
  userEmail?: string;    // アカウントメール
  timestamp: number;
}

// ユーザーカスタム姓プロフィール型
export interface UserProfile {
  uid: string;
  surname: string;       // カレンダー上に表示・記録する苗字
  email?: string;
  updatedAt?: number;
}

// 職員情報型
export interface StaffMember {
  id: string;
  name: string;
  colorBg: string;     // 背景色クラス (Tailwind)
  colorText: string;   // 文字色クラス (Tailwind)
  colorBorder: string; // 枠線色クラス (Tailwind)
}

// カレンダーの日付セル用データ型
export interface CalendarDay {
  date: Date;
  dateString: string;     // 'YYYY-MM-DD'
  dayNumber: number;      // 日 (1-31)
  isCurrentMonth: boolean;// 表示対象の月かどうか
  isToday: boolean;       // 今日かどうか
  isSaturday: boolean;    // 土曜日
  isSunday: boolean;      // 日曜日
  holidayName?: string;   // 祝日名 (祝日の場合)
  shifts: ShiftRecord[];  // その日の早出シフト一覧
  tasks?: TaskSchedule[]; // その日の業務予定一覧
}

// 職員別集計結果
export interface StaffCount {
  staffName: string;
  count: number;
}
