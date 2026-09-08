import {
  collection,
  doc,
  setDoc,
  getDoc,
  deleteDoc,
  writeBatch,
  onSnapshot,
  getDocs,
  query,
  orderBy,
  limit,
} from 'firebase/firestore';
import { db } from '../lib/firebase';
import { ShiftRecord, StaffMember, TaskSchedule, AuditLog, UserProfile } from '../types';
import { DEFAULT_STAFF_LIST } from '../utils/constants';

const SHIFTS_COLLECTION = 'shifts';
const TASKS_COLLECTION = 'tasks';
const STAFF_COLLECTION = 'staff';
const CONFIG_COLLECTION = 'configs';
const USERS_COLLECTION = 'users';
const AUDIT_LOGS_COLLECTION = 'audit_logs';
const APP_CONFIG_DOC = 'app_config';

/**
 * シフト一覧のリアルタイム購読
 */
export function subscribeShifts(
  onUpdate: (shifts: ShiftRecord[]) => void,
  initialLocalShifts: ShiftRecord[] = []
): () => void {
  const colRef = collection(db, SHIFTS_COLLECTION);
  let isInitial = true;

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (isInitial && snapshot.empty && initialLocalShifts.length > 0) {
        isInitial = false;
        // クラウドがまだ初期状態で空の場合のみ、既存のローカルシフトをクラウドへ一括シード
        seedInitialShifts(initialLocalShifts);
        return;
      }
      isInitial = false;

      if (snapshot.empty) {
        onUpdate([]);
        return;
      }

      const shifts: ShiftRecord[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();

        // 不在フラグの判定（保存済みフラグ、または「終日」/終了時刻未設定/備考等の既存データからの自動復元）
        const rawIsAbsence = data.isAbsence !== undefined ? Boolean(data.isAbsence) : undefined;
        const isAbsence =
          rawIsAbsence !== undefined
            ? rawIsAbsence
            : data.startTime === '終日' ||
              !data.endTime ||
              Boolean(data.absenceType) ||
              data.note?.includes('休') ||
              data.note?.includes('出張') ||
              data.note?.includes('研修');

        let absenceType = data.absenceType;
        if (!absenceType && isAbsence) {
          if (data.note?.includes('出張')) absenceType = '出張';
          else if (data.note?.includes('研修')) absenceType = '研修';
          else absenceType = '休み';
        }

        shifts.push({
          id: docSnap.id,
          date: data.date,
          staffName: data.staffName,
          startTime: data.startTime,
          endTime: data.endTime,
          note: data.note || '',
          isAbsence,
          absenceType,
          createdByUid: data.createdByUid,
          createdByName: data.createdByName,
          updatedByUid: data.updatedByUid,
          updatedByName: data.updatedByName,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt,
        });
      });

      // 日付順・作成順でソート
      shifts.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt - b.createdAt));
      onUpdate(shifts);
    },
    (err) => {
      console.warn('Firestore shifts snapshot error:', err);
    }
  );
}

/**
 * 業務予定一覧のリアルタイム購読
 */
export function subscribeTasks(
  onUpdate: (tasks: TaskSchedule[]) => void
): () => void {
  const colRef = collection(db, TASKS_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        onUpdate([]);
        return;
      }

      const tasks: TaskSchedule[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        tasks.push({
          id: docSnap.id,
          date: data.date,
          title: data.title || '',
          time: data.time || '',
          staffName: data.staffName || '',
          note: data.note || '',
          createdByUid: data.createdByUid,
          createdByName: data.createdByName,
          updatedByUid: data.updatedByUid,
          updatedByName: data.updatedByName,
          createdAt: data.createdAt || Date.now(),
          updatedAt: data.updatedAt,
        });
      });

      // 日付順・作成順でソート
      tasks.sort((a, b) => a.date.localeCompare(b.date) || (a.createdAt - b.createdAt));
      onUpdate(tasks);
    },
    (err) => {
      console.warn('Firestore tasks snapshot error:', err);
    }
  );
}

/**
 * 業務予定の作成・更新
 */
export async function saveTaskToCloud(task: TaskSchedule): Promise<void> {
  try {
    const docRef = doc(db, TASKS_COLLECTION, task.id);
    await setDoc(docRef, {
      date: task.date,
      title: task.title,
      time: task.time,
      staffName: task.staffName,
      note: task.note || '',
      createdByUid: task.createdByUid || '',
      createdByName: task.createdByName || '',
      updatedByUid: task.updatedByUid || '',
      updatedByName: task.updatedByName || '',
      createdAt: task.createdAt || Date.now(),
      updatedAt: task.updatedAt || Date.now(),
    });
  } catch (err) {
    console.error('Error saving task to Firestore:', err);
  }
}

/**
 * 業務予定の削除
 */
export async function deleteTaskFromCloud(taskId: string): Promise<void> {
  try {
    const docRef = doc(db, TASKS_COLLECTION, taskId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting task from Firestore:', err);
  }
}

/**
 * 職員名簿のリアルタイム購読
 */
export function subscribeStaff(
  onUpdate: (staff: StaffMember[]) => void,
  initialLocalStaff: StaffMember[] = DEFAULT_STAFF_LIST
): () => void {
  const colRef = collection(db, STAFF_COLLECTION);

  return onSnapshot(
    colRef,
    (snapshot) => {
      if (snapshot.empty) {
        // クラウドがまだ空の場合、職員マスタを投入
        seedInitialStaff(initialLocalStaff.length > 0 ? initialLocalStaff : DEFAULT_STAFF_LIST);
        return;
      }

      const staffList: StaffMember[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        staffList.push({
          id: docSnap.id,
          name: data.name,
          colorBg: data.colorBg,
          colorText: data.colorText,
          colorBorder: data.colorBorder,
        });
      });

      if (staffList.length > 0) {
        onUpdate(staffList);
      }
    },
    (err) => {
      console.warn('Firestore staff snapshot error:', err);
    }
  );
}

/**
 * アプリ設定・月別メモのリアルタイム購読
 */
export function subscribeConfig(
  onUpdate: (config: { adminPin?: string; notes?: Record<string, string> }) => void
): () => void {
  const docRef = doc(db, CONFIG_COLLECTION, APP_CONFIG_DOC);

  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate({
          adminPin: data.adminPin || '7322',
          notes: data.notes || {},
        });
      }
    },
    (err) => {
      console.warn('Firestore config snapshot error:', err);
    }
  );
}

/**
 * シフトの作成・更新
 */
export async function saveShiftToCloud(shift: ShiftRecord): Promise<void> {
  try {
    const docRef = doc(db, SHIFTS_COLLECTION, shift.id);
    await setDoc(docRef, {
      date: shift.date,
      staffName: shift.staffName,
      startTime: shift.startTime,
      endTime: shift.endTime,
      note: shift.note || '',
      isAbsence: Boolean(shift.isAbsence),
      absenceType: shift.absenceType || (shift.isAbsence ? '休み' : null),
      createdByUid: shift.createdByUid || '',
      createdByName: shift.createdByName || '',
      updatedByUid: shift.updatedByUid || '',
      updatedByName: shift.updatedByName || '',
      createdAt: shift.createdAt || Date.now(),
      updatedAt: shift.updatedAt || Date.now(),
    });
  } catch (err) {
    console.error('Error saving shift to Firestore:', err);
  }
}

/**
 * シフトの削除
 */
export async function deleteShiftFromCloud(shiftId: string): Promise<void> {
  try {
    const docRef = doc(db, SHIFTS_COLLECTION, shiftId);
    await deleteDoc(docRef);
  } catch (err) {
    console.error('Error deleting shift from Firestore:', err);
  }
}

/**
 * 操作・変更履歴監査ログの記録
 */
export async function addAuditLogToCloud(log: Omit<AuditLog, 'id' | 'timestamp'>): Promise<void> {
  try {
    const timestamp = Date.now();
    const id = `log-${timestamp}-${Math.random().toString(36).substring(2, 7)}`;
    const docRef = doc(db, AUDIT_LOGS_COLLECTION, id);
    await setDoc(docRef, {
      ...log,
      timestamp,
    });
  } catch (err) {
    console.warn('Error recording audit log:', err);
  }
}

/**
 * 監査ログ一覧のリアルタイム購読（最新200件）
 */
export function subscribeAuditLogs(
  onUpdate: (logs: AuditLog[]) => void
): () => void {
  const colRef = collection(db, AUDIT_LOGS_COLLECTION);
  const q = query(colRef, orderBy('timestamp', 'desc'), limit(200));

  return onSnapshot(
    q,
    (snapshot) => {
      const logs: AuditLog[] = [];
      snapshot.forEach((docSnap) => {
        const data = docSnap.data();
        logs.push({
          id: docSnap.id,
          action: data.action,
          targetType: data.targetType,
          targetDate: data.targetDate,
          targetSummary: data.targetSummary,
          userUid: data.userUid,
          userName: data.userName,
          userEmail: data.userEmail,
          timestamp: data.timestamp,
        });
      });
      onUpdate(logs);
    },
    (err) => {
      console.warn('Firestore audit logs snapshot error:', err);
    }
  );
}

/**
 * ユーザープロフィール（カスタム姓）の購読
 */
export function subscribeUserProfile(
  uid: string,
  onUpdate: (profile: UserProfile | null) => void
): () => void {
  const docRef = doc(db, USERS_COLLECTION, uid);
  return onSnapshot(
    docRef,
    (docSnap) => {
      if (docSnap.exists()) {
        const data = docSnap.data();
        onUpdate({
          uid,
          surname: data.surname,
          email: data.email,
          updatedAt: data.updatedAt,
        });
      } else {
        onUpdate(null);
      }
    },
    (err) => {
      console.warn('Firestore user profile snapshot error:', err);
    }
  );
}

/**
 * ユーザープロフィール（カスタム姓）の取得
 */
export async function getUserProfileFromCloud(uid: string): Promise<UserProfile | null> {
  try {
    const docRef = doc(db, USERS_COLLECTION, uid);
    const docSnap = await getDoc(docRef);
    if (docSnap.exists()) {
      const data = docSnap.data();
      return {
        uid,
        surname: data.surname,
        email: data.email,
        updatedAt: data.updatedAt,
      };
    }
    return null;
  } catch (err) {
    console.warn('Error fetching user profile from Firestore:', err);
    return null;
  }
}

/**
 * ユーザープロフィール（カスタム姓）の保存
 */
export async function saveUserProfileToCloud(profile: UserProfile): Promise<void> {
  try {
    const docRef = doc(db, USERS_COLLECTION, profile.uid);
    await setDoc(docRef, {
      surname: profile.surname,
      email: profile.email || '',
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving user profile to Firestore:', err);
  }
}


type BatchOperation =
  | { type: 'set'; id: string; data: Record<string, any> }
  | { type: 'delete'; id: string };

const FIRESTORE_BATCH_CHUNK_SIZE = 250; // Firestoreの上限500件に対し、安全マージン250件で分割実行

/**
 * 大量データを安全にチャンク分割し、writeBatchとPromise.allSettledで非同期バッチ処理
 * UIスレッドをフリーズさせないようマイクロディレイを挟みながら並行実行
 */
export async function executeBatchOperationsInChunks(
  collectionName: string,
  operations: BatchOperation[]
): Promise<{ success: boolean; total: number; successfulCount: number; failureCount: number }> {
  if (operations.length === 0) {
    return { success: true, total: 0, successfulCount: 0, failureCount: 0 };
  }

  // チャンクに分割
  const chunks: BatchOperation[][] = [];
  for (let i = 0; i < operations.length; i += FIRESTORE_BATCH_CHUNK_SIZE) {
    chunks.push(operations.slice(i, i + FIRESTORE_BATCH_CHUNK_SIZE));
  }

  // 各チャンクごとに writeBatch を作成しコミットする Promise を作成
  const batchPromises = chunks.map(async (chunk, chunkIndex) => {
    // ブラウザのレンダリングループを阻害しないよう非同期ティックを挟む
    await new Promise((resolve) => setTimeout(resolve, chunkIndex * 15));

    const batch = writeBatch(db);
    for (const op of chunk) {
      const docRef = doc(db, collectionName, op.id);
      if (op.type === 'set') {
        batch.set(docRef, op.data);
      } else if (op.type === 'delete') {
        batch.delete(docRef);
      }
    }
    return batch.commit();
  });

  // Promise.allSettled で全バッチを安全に並列実行
  const results = await Promise.allSettled(batchPromises);

  let failureCount = 0;
  let successfulCount = 0;

  results.forEach((result, idx) => {
    if (result.status === 'fulfilled') {
      successfulCount += chunks[idx].length;
    } else {
      failureCount += chunks[idx].length;
      console.error(`Firestore batch chunk ${idx + 1}/${chunks.length} failed:`, result.reason);
    }
  });

  return {
    success: failureCount === 0,
    total: operations.length,
    successfulCount,
    failureCount,
  };
}

/**
 * シフトの一括同期・更新（一括生成やインポート時など）
 */
export async function batchSaveShiftsToCloud(
  newShifts: ShiftRecord[],
  deletedShiftIds: string[] = []
): Promise<void> {
  const operations: BatchOperation[] = [];

  // 削除対象
  for (const id of deletedShiftIds) {
    operations.push({ type: 'delete', id });
  }

  // 追加・更新対象
  for (const s of newShifts) {
    operations.push({
      type: 'set',
      id: s.id,
      data: {
        date: s.date,
        staffName: s.staffName,
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note || '',
        isAbsence: Boolean(s.isAbsence),
        absenceType: s.absenceType || (s.isAbsence ? '休み' : null),
        createdAt: s.createdAt || Date.now(),
      },
    });
  }

  await executeBatchOperationsInChunks(SHIFTS_COLLECTION, operations);
}

/**
 * 全シフトの一括置き換え（一括自動生成や全件クリア時）
 */
export async function replaceAllShiftsInCloud(allShifts: ShiftRecord[], currentShiftIds?: string[]): Promise<void> {
  try {
    const newIdSet = new Set(allShifts.map((s) => s.id));
    const deleteIds: string[] = [];

    // 引数で古いIDリストが渡されている場合はそれを使用、なければFirestoreの現在一覧から照合
    if (currentShiftIds && currentShiftIds.length > 0) {
      for (const oldId of currentShiftIds) {
        if (!newIdSet.has(oldId)) {
          deleteIds.push(oldId);
        }
      }
    } else {
      const snap = await getDocs(collection(db, SHIFTS_COLLECTION));
      snap.forEach((docSnap) => {
        if (!newIdSet.has(docSnap.id)) {
          deleteIds.push(docSnap.id);
        }
      });
    }

    const operations: BatchOperation[] = [];

    // 削除操作を追加
    for (const delId of deleteIds) {
      operations.push({ type: 'delete', id: delId });
    }

    // 保存操作を追加
    for (const s of allShifts) {
      operations.push({
        type: 'set',
        id: s.id,
        data: {
          date: s.date,
          staffName: s.staffName,
          startTime: s.startTime,
          endTime: s.endTime,
          note: s.note || '',
          isAbsence: Boolean(s.isAbsence),
          absenceType: s.absenceType || (s.isAbsence ? '休み' : null),
          createdAt: s.createdAt || Date.now(),
        },
      });
    }

    // チャンク分割 + writeBatch + Promise.allSettled で最適化実行
    await executeBatchOperationsInChunks(SHIFTS_COLLECTION, operations);
  } catch (err) {
    console.error('Error replacing all shifts in Firestore:', err);
  }
}

/**
 * 職員名簿の一括保存
 */
export async function saveStaffListToCloud(staffList: StaffMember[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const staff of staffList) {
      const docRef = doc(db, STAFF_COLLECTION, staff.id);
      batch.set(docRef, staff);
    }
    await batch.commit();
  } catch (err) {
    console.error('Error saving staff list to Firestore:', err);
  }
}

/**
 * 月別メモの保存
 */
export async function saveNoteToCloud(key: string, note: string): Promise<void> {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, APP_CONFIG_DOC);
    await setDoc(docRef, {
      notes: {
        [key]: note,
      },
    }, { merge: true });
  } catch (err) {
    console.error('Error saving note to Firestore:', err);
  }
}

/**
 * 管理者暗証番号の保存
 */
export async function saveAdminPinToCloud(pin: string): Promise<void> {
  try {
    const docRef = doc(db, CONFIG_COLLECTION, APP_CONFIG_DOC);
    await setDoc(docRef, {
      adminPin: pin,
      updatedAt: Date.now(),
    }, { merge: true });
  } catch (err) {
    console.error('Error saving PIN to Firestore:', err);
  }
}

// 内部ヘルパー: 初期データ投入
async function seedInitialShifts(shifts: ShiftRecord[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const s of shifts) {
      const docRef = doc(db, SHIFTS_COLLECTION, s.id);
      batch.set(docRef, {
        date: s.date,
        staffName: s.staffName,
        startTime: s.startTime,
        endTime: s.endTime,
        note: s.note || '',
        isAbsence: Boolean(s.isAbsence),
        absenceType: s.absenceType || (s.isAbsence ? '休み' : null),
        createdAt: s.createdAt || Date.now(),
      });
    }
    await batch.commit();
  } catch (err) {
    console.error('Error seeding shifts to Firestore:', err);
  }
}

async function seedInitialStaff(staffList: StaffMember[]): Promise<void> {
  try {
    const batch = writeBatch(db);
    for (const staff of staffList) {
      const docRef = doc(db, STAFF_COLLECTION, staff.id);
      batch.set(docRef, staff);
    }
    await batch.commit();
  } catch (err) {
    console.error('Error seeding staff to Firestore:', err);
  }
}
