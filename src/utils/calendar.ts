import { CalendarDay, ShiftRecord, TaskSchedule } from '../types';
import { formatDateKey, getHolidayName } from './holidays';

/**
 * 指定された年月の月間カレンダーグリッド用日付リストを生成（月曜始まり）
 */
export function buildCalendarDays(
  year: number,
  month: number, // 1-12
  shifts: ShiftRecord[],
  tasks: TaskSchedule[] = []
): CalendarDay[] {
  const result: CalendarDay[] = [];

  const today = new Date();
  const todayStr = formatDateKey(
    today.getFullYear(),
    today.getMonth() + 1,
    today.getDate()
  );

  // 当月の1日
  const firstDate = new Date(year, month - 1, 1);
  // 当月の末日
  const lastDate = new Date(year, month, 0);
  const daysInMonth = lastDate.getDate();

  // 1日の曜日 (0: 日, 1: 月, ... 6: 土)
  const firstDayOfWeek = firstDate.getDay();
  // 月曜日始まりの場合の前月オフセット (月:0, 火:1, 水:2, 木:3, 金:4, 土:5, 日:6)
  const prevMonthPadding = (firstDayOfWeek + 6) % 7;

  // 1. 前月の末尾日を埋める
  if (prevMonthPadding > 0) {
    const prevMonthLastDate = new Date(year, month - 1, 0);
    const prevMonthDays = prevMonthLastDate.getDate();
    const prevMonthYear = prevMonthLastDate.getFullYear();
    const prevMonth = prevMonthLastDate.getMonth() + 1;

    for (let i = prevMonthPadding - 1; i >= 0; i--) {
      const dayNumber = prevMonthDays - i;
      const dateObj = new Date(prevMonthYear, prevMonth - 1, dayNumber);
      const dateString = formatDateKey(prevMonthYear, prevMonth, dayNumber);

      result.push({
        date: dateObj,
        dateString,
        dayNumber,
        isCurrentMonth: false,
        isToday: dateString === todayStr,
        isSaturday: dateObj.getDay() === 6,
        isSunday: dateObj.getDay() === 0,
        holidayName: getHolidayName(dateObj) || undefined,
        shifts: shifts.filter((s) => s.date === dateString),
        tasks: tasks.filter((t) => t.date === dateString),
      });
    }
  }

  // 2. 当月の日付
  for (let day = 1; day <= daysInMonth; day++) {
    const dateObj = new Date(year, month - 1, day);
    const dateString = formatDateKey(year, month, day);

    result.push({
      date: dateObj,
      dateString,
      dayNumber: day,
      isCurrentMonth: true,
      isToday: dateString === todayStr,
      isSaturday: dateObj.getDay() === 6,
      isSunday: dateObj.getDay() === 0,
      holidayName: getHolidayName(dateObj) || undefined,
      shifts: shifts.filter((s) => s.date === dateString),
      tasks: tasks.filter((t) => t.date === dateString),
    });
  }

  // 3. 次月の初頭日を埋めて7列の倍数（35日または42日）に揃える
  const remainingDays = (7 - (result.length % 7)) % 7;
  // カレンダーの見た目を揃えるため、最低35枠（5行）または42枠（6行）を確保
  let totalNeeded = result.length + remainingDays;
  if (totalNeeded < 35) {
    totalNeeded = 35;
  }

  const nextMonthFirstDate = new Date(year, month, 1);
  const nextMonthYear = nextMonthFirstDate.getFullYear();
  const nextMonth = nextMonthFirstDate.getMonth() + 1;

  let nextDayNum = 1;
  while (result.length < totalNeeded) {
    const dateObj = new Date(nextMonthYear, nextMonth - 1, nextDayNum);
    const dateString = formatDateKey(nextMonthYear, nextMonth, nextDayNum);

    result.push({
      date: dateObj,
      dateString,
      dayNumber: nextDayNum,
      isCurrentMonth: false,
      isToday: dateString === todayStr,
      isSaturday: dateObj.getDay() === 6,
      isSunday: dateObj.getDay() === 0,
      holidayName: getHolidayName(dateObj) || undefined,
      shifts: shifts.filter((s) => s.date === dateString),
      tasks: tasks.filter((t) => t.date === dateString),
    });
    nextDayNum++;
  }

  return result;
}

