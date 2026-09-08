import { CalendarDay, ShiftRecord, StaffMember, AbsenceType } from '../types';

export interface StreakInfo {
  isStreak: boolean; // 2日以上連続しているか
  totalDays: number; // 連続日数（例: 5）
  dayIndex: number; // 当該日が連続の何日目か（1-based、例: 2）
  startDate: string; // 連続の開始日 (YYYY-MM-DD)
  endDate: string; // 連続の終了日 (YYYY-MM-DD)
  streakShiftIds: string[]; // 連続シフトのIDリスト
}

export interface WeekShiftBar {
  id: string;
  staffName: string;
  startCol: number; // 0 (月曜) ～ 6 (日曜)
  endCol: number;   // 0 (月曜) ～ 6 (日曜)
  span: number;     // カラム幅 (endCol - startCol + 1)
  startTime: string;
  endTime: string;
  note?: string;
  isAbsence?: boolean;
  absenceType?: string;
  shifts: ShiftRecord[];
  targetDay: CalendarDay;
  continuesFromPrevWeek: boolean;
  continuesToNextWeek: boolean;
  isStreak: boolean;
  totalStreakDays: number;
}

export interface WeekTrack {
  bars: WeekShiftBar[];
}

/**
 * シフトが不在（休み・出張・研修等）であるかを判定する共通ヘルパー
 * isAbsenceフラグ、または「終日」/終了時刻未設定/absenceTypeから判定
 */
export function isShiftAbsence(shift: ShiftRecord): boolean {
  return Boolean(shift.isAbsence) || shift.startTime === '終日' || !shift.endTime || Boolean(shift.absenceType);
}

/**
 * 不在種別（休み/出張/研修/その他）を判定・正規化する共通ヘルパー
 */
export function getShiftAbsenceType(shift: ShiftRecord): AbsenceType | undefined {
  if (shift.absenceType) return shift.absenceType;
  if (isShiftAbsence(shift)) {
    if (shift.note?.includes('出張')) return '出張';
    if (shift.note?.includes('研修')) return '研修';
    return '休み';
  }
  return undefined;
}

/**
 * ある日付のシフトが、同じ職員で何日連続しているかを算出
 * options.matchWorkTime が true の場合、同一職員かつ「出勤時間・退勤時間」が完全一致するシフトのみを連続対象とする
 */
export function getShiftStreakInfo(
  currentShift: ShiftRecord,
  allShifts: ShiftRecord[],
  options?: { matchWorkTime?: boolean }
): StreakInfo {
  const matchWorkTime = options?.matchWorkTime ?? false;
  const currentIsAbs = isShiftAbsence(currentShift);
  const currentAbsType = getShiftAbsenceType(currentShift);

  const staffShifts = allShifts.filter((s) => {
    if (s.staffName !== currentShift.staffName) return false;
    if (isShiftAbsence(s) !== currentIsAbs) return false;
    if (getShiftAbsenceType(s) !== currentAbsType) return false;
    if (matchWorkTime) {
      return s.startTime === currentShift.startTime && s.endTime === currentShift.endTime;
    }
    return true;
  });
  const shiftDateMap = new Map<string, ShiftRecord>();
  staffShifts.forEach((s) => shiftDateMap.set(s.date, s));

  // 日付オブジェクトから YYYY-MM-DD 文字列を取得する補助関数
  const toDateStr = (d: Date): string => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${y}-${m}-${day}`;
  };

  const currentDate = new Date(`${currentShift.date}T00:00:00`);

  // 1. 過去方向に遡る
  const backwardDates: string[] = [];
  const currBack = new Date(currentDate);
  while (true) {
    currBack.setDate(currBack.getDate() - 1);
    const prevKey = toDateStr(currBack);
    if (shiftDateMap.has(prevKey)) {
      backwardDates.unshift(prevKey);
    } else {
      break;
    }
  }

  // 2. 未来方向に進む
  const forwardDates: string[] = [];
  const currFwd = new Date(currentDate);
  while (true) {
    currFwd.setDate(currFwd.getDate() + 1);
    const nextKey = toDateStr(currFwd);
    if (shiftDateMap.has(nextKey)) {
      forwardDates.push(nextKey);
    } else {
      break;
    }
  }

  // 全連続日付リスト
  const allStreakDates = [...backwardDates, currentShift.date, ...forwardDates];
  const totalDays = allStreakDates.length;
  const dayIndex = backwardDates.length + 1;
  const streakShiftIds = allStreakDates
    .map((d) => shiftDateMap.get(d)?.id)
    .filter((id): id is string => Boolean(id));

  return {
    isStreak: totalDays >= 2,
    totalDays,
    dayIndex,
    startDate: allStreakDates[0],
    endDate: allStreakDates[allStreakDates.length - 1],
    streakShiftIds,
  };
}

/**
  * 週ごとの早出シフトから、連続するシフトを連結した帯状バー（WeekShiftBar）を算出
  */
export function computeWeekShiftBars(
  weekDays: CalendarDay[],
  weekIndex: number,
  allDays: CalendarDay[],
  allShifts: ShiftRecord[],
  mergeConsecutive: boolean,
  staffList?: StaffMember[]
): WeekShiftBar[] {
  if (!mergeConsecutive) {
    // 結合OFFの場合は各日単独バーを生成
    const singleBars: WeekShiftBar[] = [];
    weekDays.forEach((day, colIdx) => {
      day.shifts.forEach((shift) => {
        const isAbs = isShiftAbsence(shift);
        const absType = getShiftAbsenceType(shift);
        singleBars.push({
          id: `bar-${shift.id}`,
          staffName: shift.staffName,
          startCol: colIdx,
          endCol: colIdx,
          span: 1,
          startTime: shift.startTime,
          endTime: shift.endTime,
          note: shift.note,
          isAbsence: isAbs,
          absenceType: absType,
          shifts: [shift],
          targetDay: day,
          continuesFromPrevWeek: false,
          continuesToNextWeek: false,
          isStreak: false,
          totalStreakDays: 1,
        });
      });
    });
    return singleBars;
  }

  // 結合ONの場合：週の中で同一職員の連続する早出シフトを1本の連結バーにまとめる
  const bars: WeekShiftBar[] = [];

  // この週に登場する職員一覧を取得（staffListの順序を尊重）
  const staffNameSet = new Set<string>();
  weekDays.forEach((d) => d.shifts.forEach((s) => staffNameSet.add(s.staffName)));
  const distinctStaff = Array.from(staffNameSet).sort((a, b) => {
    if (staffList) {
      const idxA = staffList.findIndex((s) => s.name === a);
      const idxB = staffList.findIndex((s) => s.name === b);
      if (idxA !== -1 && idxB !== -1) return idxA - idxB;
    }
    return a.localeCompare(b);
  });

  for (const staffName of distinctStaff) {
    // 各列（0..6）にある該当職員のシフトを収集
    const dayShifts: (ShiftRecord | undefined)[] = weekDays.map((d) =>
      d.shifts.find((s) => s.staffName === staffName)
    );

    // 連続区間を見つける補助関数
    const pushBar = (sCol: number, eCol: number) => {
      const barShifts: ShiftRecord[] = [];
      for (let c = sCol; c <= eCol; c++) {
        const s = dayShifts[c];
        if (s) barShifts.push(s);
      }
      if (barShifts.length === 0) return;

      const firstShift = barShifts[0];
      const isFirstAbs = isShiftAbsence(firstShift);
      const firstAbsType = getShiftAbsenceType(firstShift);

      // 同一職員かつ「出勤時間・退勤時間」が一致する連続勤務のみを算出
      const streakInfo = getShiftStreakInfo(firstShift, allShifts, { matchWorkTime: true });

      // 前週からの継続判定（startCol === 0 の場合、前週の最終日（日曜）に同一職員かつ同一勤務時間のシフトがあるか）
      let continuesFromPrevWeek = false;
      if (sCol === 0 && weekIndex > 0) {
        const prevDayIndex = weekIndex * 7 - 1;
        const prevDay = allDays[prevDayIndex];
        if (
          prevDay &&
          prevDay.shifts.some(
            (s) =>
              s.staffName === staffName &&
              isShiftAbsence(s) === isFirstAbs &&
              getShiftAbsenceType(s) === firstAbsType &&
              s.startTime === firstShift.startTime &&
              s.endTime === firstShift.endTime
          )
        ) {
          continuesFromPrevWeek = true;
        }
      }

      // 次週への継続判定（endCol === 6 の場合、次週の開始日（月曜）に同一職員かつ同一勤務時間のシフトがあるか）
      let continuesToNextWeek = false;
      if (eCol === 6 && (weekIndex + 1) * 7 < allDays.length) {
        const nextDayIndex = (weekIndex + 1) * 7;
        const nextDay = allDays[nextDayIndex];
        if (
          nextDay &&
          nextDay.shifts.some(
            (s) =>
              s.staffName === staffName &&
              isShiftAbsence(s) === isFirstAbs &&
              getShiftAbsenceType(s) === firstAbsType &&
              s.startTime === firstShift.startTime &&
              s.endTime === firstShift.endTime
          )
        ) {
          continuesToNextWeek = true;
        }
      }

      bars.push({
        id: `bar-${staffName}-${weekDays[sCol].dateString}-${weekDays[eCol].dateString}-${isFirstAbs ? 'abs' : 'shift'}-${firstAbsType || ''}-${firstShift.startTime}-${firstShift.endTime}`,
        staffName,
        startCol: sCol,
        endCol: eCol,
        span: eCol - sCol + 1,
        startTime: firstShift.startTime,
        endTime: firstShift.endTime,
        note: barShifts.map((s) => s.note).filter(Boolean).join(', ') || undefined,
        isAbsence: isFirstAbs,
        absenceType: firstAbsType,
        shifts: barShifts,
        targetDay: weekDays[sCol],
        continuesFromPrevWeek,
        continuesToNextWeek,
        isStreak: streakInfo.isStreak || eCol > sCol || continuesFromPrevWeek || continuesToNextWeek,
        totalStreakDays: streakInfo.totalDays,
      });
    };

    let startCol = -1;
    let prevShift: ShiftRecord | null = null;
    for (let col = 0; col < 7; col++) {
      const currentShift = dayShifts[col];
      if (currentShift) {
        if (startCol === -1) {
          startCol = col;
          prevShift = currentShift;
        } else if (
          prevShift &&
          (isShiftAbsence(prevShift) !== isShiftAbsence(currentShift) ||
            getShiftAbsenceType(prevShift) !== getShiftAbsenceType(currentShift) ||
            prevShift.startTime !== currentShift.startTime ||
            prevShift.endTime !== currentShift.endTime)
        ) {
          // 不在種別や勤務時間が異なる場合は、直前のバーを区切って確定し、当日を新バーの開始とする
          pushBar(startCol, col - 1);
          startCol = col;
          prevShift = currentShift;
        } else {
          // 同一条件の場合は連続として継続
          prevShift = currentShift;
        }
      } else {
        if (startCol !== -1) {
          pushBar(startCol, col - 1);
          startCol = -1;
          prevShift = null;
        }
      }
    }
    if (startCol !== -1) {
      pushBar(startCol, 6);
    }
  }

  return bars;
}

/**
 * 複数のシフトバーを重なり（コリジョン）なく水平トラックに配置
 */
export function computeWeekTracks(bars: WeekShiftBar[]): WeekTrack[] {
  // startCol 昇順、同一なら span 降順（長い連結バーを優先して上位トラックに配置）
  const sorted = [...bars].sort((a, b) => {
    if (a.startCol !== b.startCol) return a.startCol - b.startCol;
    return b.span - a.span;
  });

  const tracks: WeekTrack[] = [];
  const trackEndCols: number[] = [];

  for (const bar of sorted) {
    let placed = false;
    for (let t = 0; t < tracks.length; t++) {
      if (trackEndCols[t] < bar.startCol) {
        tracks[t].bars.push(bar);
        trackEndCols[t] = bar.endCol;
        placed = true;
        break;
      }
    }
    if (!placed) {
      tracks.push({ bars: [bar] });
      trackEndCols.push(bar.endCol);
    }
  }

  return tracks;
}
