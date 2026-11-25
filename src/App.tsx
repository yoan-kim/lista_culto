/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  Copy,
  Check,
  Plus,
  Trash2,
  RotateCcw,
  Calendar,
  Sparkles,
  FileText,
  Search,
  ChevronDown,
  ChevronUp,
  ChevronLeft,
  ChevronRight,
  ArrowUpDown,
  Minimize2,
  Maximize2,
} from 'lucide-react';

export type WorshipType = '주일' | '삼일';

export type LocationPreset = '키토본부' | '빌록시' | '푸힐리' | '오따발로' | '기타';

export type PreacherPreset =
  | '김요안'
  | '지파장님영상'
  | '총회장님영상'
  | '특별영상'
  | '기타';

export interface WorshipEntry {
  id: string;
  year: number;
  month: number;
  day: number;
  worshipType: WorshipType;
  locationPreset: LocationPreset;
  locationCustom: string;
  topic: string;
  preacherPreset: PreacherPreset;
  preacherCustom: string;
  scripture: string;
  note: string;
  collapsed?: boolean;
}

const LOCATION_OPTIONS: LocationPreset[] = [
  '키토본부',
  '빌록시',
  '푸힐리',
  '오따발로',
  '기타',
];

const PREACHER_OPTIONS: PreacherPreset[] = [
  '김요안',
  '지파장님영상',
  '총회장님영상',
  '특별영상',
  '기타',
];

const WORSHIP_TYPE_OPTIONS: WorshipType[] = ['주일', '삼일'];

const STORAGE_KEY = 'worship_telegram_records_v2';

/**
 * Given any date (year, month, day), returns the next upcoming Sunday (주일) or Wednesday (삼일),
 * automatically rolling over across month and year boundaries.
 */
function getNextWorshipDate(
  year: number,
  month: number,
  day: number
): { year: number; month: number; day: number; worshipType: WorshipType } {
  for (let offset = 1; offset <= 7; offset++) {
    const candidate = new Date(year, month - 1, day + offset);
    const dow = candidate.getDay(); // 0 = Sunday, 3 = Wednesday
    if (dow === 0 || dow === 3) {
      return {
        year: candidate.getFullYear(),
        month: candidate.getMonth() + 1,
        day: candidate.getDate(),
        worshipType: dow === 0 ? '주일' : '삼일',
      };
    }
  }
  const fallback = new Date(year, month - 1, day + 3);
  return {
    year: fallback.getFullYear(),
    month: fallback.getMonth() + 1,
    day: fallback.getDate(),
    worshipType: '삼일',
  };
}

/**
 * Generates all Sundays (주일) and Wednesdays (삼일) for a given year and month.
 * Default locationPreset is always '키토본부' and locationCustom is always ''.
 */
function generateMonthlySchedule(
  year: number,
  month: number,
  withSampleData = false
): WorshipEntry[] {
  const daysInMonth = new Date(year, month, 0).getDate();
  const entries: WorshipEntry[] = [];

  for (let d = 1; d <= daysInMonth; d++) {
    const dateObj = new Date(year, month - 1, d);
    const dayOfWeek = dateObj.getDay(); // 0 = Sunday, 3 = Wednesday

    if (dayOfWeek === 0 || dayOfWeek === 3) {
      const worshipType: WorshipType = dayOfWeek === 0 ? '주일' : '삼일';
      entries.push({
        id: `${year}-${String(month).padStart(2, '0')}-${String(d).padStart(2, '0')}-${Math.random().toString(36).slice(2, 7)}`,
        year,
        month,
        day: d,
        worshipType,
        locationPreset: '키토본부',
        locationCustom: '',
        topic: '',
        preacherPreset: '김요안',
        preacherCustom: '',
        scripture: '',
        note: '',
        collapsed: false,
      });
    }
  }

  if (withSampleData && month === 11) {
    const sampleMap: Record<
      number,
      {
        worshipType: WorshipType;
        locationPreset: LocationPreset;
        locationCustom: string;
        topic: string;
        preacherPreset: PreacherPreset;
        preacherCustom: string;
        scripture: string;
        note: string;
      }
    > = {
      1: {
        worshipType: '주일',
        locationPreset: '키토본부',
        locationCustom: '',
        topic: '연합예배',
        preacherPreset: '김요안',
        preacherCustom: '',
        scripture: '마13:24-27',
        note: '',
      },
      4: {
        worshipType: '삼일',
        locationPreset: '키토본부',
        locationCustom: '',
        topic: '중등 제2과 아브라함과의 언약과 출애굽',
        preacherPreset: '총회장님영상',
        preacherCustom: '',
        scripture: '요13:24',
        note: '',
      },
      8: {
        worshipType: '주일',
        locationPreset: '키토본부',
        locationCustom: '',
        topic: '하나님의 뜻과 새 일 창조의 시작과 완성',
        preacherPreset: '지파장님영상',
        preacherCustom: '',
        scripture: '눅4:12-15',
        note: '',
      },
      11: {
        worshipType: '삼일',
        locationPreset: '키토본부',
        locationCustom: '',
        topic: '성지순례 1편',
        preacherPreset: '특별영상',
        preacherCustom: '',
        scripture: '계13:16',
        note: '',
      },
    };

    return entries.map((entry) => {
      const sample = sampleMap[entry.day];
      if (sample) {
        return { ...entry, ...sample };
      }
      return entry;
    });
  }

  return entries;
}

/**
 * Formats a single WorshipEntry into the exact Telegram line requested:
 * [장소] MM월DD일(삼일 또는 주일) 설교주제 {설교자}/묵도:성경구절 [특이사항 : ㅇㅇㅇ]
 * If note (특이사항) is empty, nothing extra is appended.
 */
function formatTelegramLine(entry: WorshipEntry): string {
  const locationText =
    entry.locationPreset === '기타'
      ? entry.locationCustom.trim() || '기타'
      : entry.locationPreset;

  const preacherText =
    entry.preacherPreset === '기타'
      ? entry.preacherCustom.trim() || '기타'
      : entry.preacherPreset;

  const mm = String(entry.month).padStart(2, '0');
  const dd = String(entry.day).padStart(2, '0');
  const topicText = entry.topic.trim();
  const scriptureText = entry.scripture.trim();
  const noteText = (entry.note || '').trim();

  const topicPart = topicText.length > 0 ? `${topicText} ` : '';
  const baseLine = `[${locationText}] ${mm}월${dd}일(${entry.worshipType}) ${topicPart}{${preacherText}}/묵도:${scriptureText}`;

  if (noteText.length > 0) {
    return `${baseLine} [특이사항 : ${noteText}]`;
  }

  return baseLine;
}

function isEntryFilled(entry: WorshipEntry): boolean {
  return Boolean(
    entry.topic.trim() ||
      entry.scripture.trim() ||
      (entry.note && entry.note.trim())
  );
}

const WEEKDAYS_KO = ['일', '월', '화', '수', '목', '금', '토'];

interface DateCalendarPopoverProps {
  year: number;
  month: number;
  day: number;
  onSelectDate: (year: number, month: number, day: number) => void;
  onClose: () => void;
  align?: 'left' | 'right';
  vertical?: 'bottom' | 'top';
}

function DateCalendarPopover({
  year,
  month,
  day,
  onSelectDate,
  onClose,
  align = 'left',
  vertical = 'bottom',
}: DateCalendarPopoverProps) {
  const [viewYear, setViewYear] = useState<number>(year);
  const [viewMonth, setViewMonth] = useState<number>(month);
  const popoverRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleMouseDown = (event: MouseEvent) => {
      if (
        popoverRef.current &&
        !popoverRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };
    document.addEventListener('mousedown', handleMouseDown);
    return () => document.removeEventListener('mousedown', handleMouseDown);
  }, [onClose]);

  const firstDayOfWeek = new Date(viewYear, viewMonth - 1, 1).getDay();
  const daysInMonth = new Date(viewYear, viewMonth, 0).getDate();

  const handlePrevMonth = () => {
    if (viewMonth === 1) {
      setViewYear((y) => y - 1);
      setViewMonth(12);
    } else {
      setViewMonth((m) => m - 1);
    }
  };

  const handleNextMonth = () => {
    if (viewMonth === 12) {
      setViewYear((y) => y + 1);
      setViewMonth(1);
    } else {
      setViewMonth((m) => m + 1);
    }
  };

  return (
    <div
      ref={popoverRef}
      role="dialog"
      aria-label="날짜 선택 달력"
      className={`absolute ${
        align === 'right' ? 'right-0' : 'left-0'
      } ${
        vertical === 'top' ? 'bottom-full mb-1.5' : 'top-full mt-1.5'
      } z-50 w-72 bg-white border border-slate-200 rounded-xl shadow-xl p-3.5 select-none`}
    >
      {/* Year & Month Header */}
      <div className="flex items-center justify-between mb-2.5 pb-2 border-b border-slate-100">
        <button
          type="button"
          onClick={handlePrevMonth}
          aria-label="이전 달"
          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
        >
          <ChevronLeft className="w-4 h-4" />
        </button>

        <div className="flex items-center gap-1 font-display text-xs font-bold text-slate-900">
          <span>{viewYear}년</span>
          <span>{viewMonth}월</span>
        </div>

        <button
          type="button"
          onClick={handleNextMonth}
          aria-label="다음 달"
          className="p-1 text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
        >
          <ChevronRight className="w-4 h-4" />
        </button>
      </div>

      {/* Quick 1~12 Month Selector Grid for This Year */}
      <div className="grid grid-cols-6 gap-1 mb-3">
        {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
          <button
            key={m}
            type="button"
            onClick={() => setViewMonth(m)}
            className={`py-1 text-[11px] font-medium rounded-md transition-colors cursor-pointer ${
              viewMonth === m
                ? 'bg-slate-900 text-white font-semibold'
                : 'bg-slate-50 text-slate-600 hover:bg-slate-100 hover:text-slate-900'
            }`}
          >
            {m}월
          </button>
        ))}
      </div>

      {/* Weekday Headers */}
      <div className="grid grid-cols-7 gap-1 text-center mb-1">
        {WEEKDAYS_KO.map((w, idx) => (
          <div
            key={w}
            className={`text-[11px] font-semibold py-0.5 ${
              idx === 0
                ? 'text-rose-600'
                : idx === 3
                  ? 'text-blue-600'
                  : 'text-slate-400'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* Calendar Days Grid */}
      <div className="grid grid-cols-7 gap-1 font-mono-tabular">
        {Array.from({ length: firstDayOfWeek }).map((_, idx) => (
          <div key={`empty-${idx}`} className="h-8" />
        ))}

        {Array.from({ length: daysInMonth }, (_, i) => i + 1).map((d) => {
          const dow = new Date(viewYear, viewMonth - 1, d).getDay();
          const isSelected =
            viewYear === year && viewMonth === month && d === day;
          const isSunday = dow === 0;
          const isWednesday = dow === 3;

          return (
            <button
              key={d}
              type="button"
              onClick={() => {
                onSelectDate(viewYear, viewMonth, d);
                onClose();
              }}
              className={`h-8 rounded-lg text-xs flex flex-col items-center justify-center transition-colors cursor-pointer ${
                isSelected
                  ? 'bg-slate-900 text-white font-bold shadow-xs'
                  : isSunday
                    ? 'bg-rose-50/70 text-rose-700 font-semibold hover:bg-rose-100'
                    : isWednesday
                      ? 'bg-blue-50/70 text-blue-700 font-semibold hover:bg-blue-100'
                      : 'text-slate-700 hover:bg-slate-100'
              }`}
            >
              <span>{d}</span>
            </button>
          );
        })}
      </div>

      {/* Legend & Close Footer */}
      <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between text-[11px] text-slate-500">
        <div className="flex items-center gap-2">
          <span className="text-rose-600 font-medium">일(주일)</span>
          <span>·</span>
          <span className="text-blue-600 font-medium">수(삼일)</span>
        </div>
        <button
          type="button"
          onClick={onClose}
          className="text-slate-500 hover:text-slate-900 font-medium cursor-pointer"
        >
          닫기
        </button>
      </div>
    </div>
  );
}

export default function App() {
  const [selectedYear, setSelectedYear] = useState<number>(2026);
  const [selectedMonth, setSelectedMonth] = useState<number>(11);
  const [openCalendarRowId, setOpenCalendarRowId] = useState<string | null>(
    null
  );

  const [entries, setEntries] = useState<WorshipEntry[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      if (saved) {
        const parsed = JSON.parse(saved);
        if (Array.isArray(parsed) && parsed.length > 0) {
          return parsed.map((item: WorshipEntry) => ({
            ...item,
            note: item.note ?? '',
            collapsed: item.collapsed ?? false,
          }));
        }
      }
    } catch {
      // ignore storage errors
    }
    return generateMonthlySchedule(2026, 11, false);
  });

  // Output formatting & date range extraction options
  const [extractStartDate, setExtractStartDate] = useState<{
    year: number;
    month: number;
    day: number;
  }>(() => {
    if (entries.length > 0) {
      const first = entries[0];
      return { year: first.year, month: first.month, day: first.day };
    }
    return { year: 2026, month: 11, day: 1 };
  });

  const [extractEndDate, setExtractEndDate] = useState<{
    year: number;
    month: number;
    day: number;
  }>(() => {
    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      const lastDayOfMonth = new Date(last.year, last.month, 0).getDate();
      return {
        year: last.year,
        month: last.month,
        day: Math.max(last.day, lastDayOfMonth),
      };
    }
    return { year: 2026, month: 11, day: 30 };
  });

  // Bottom sequential worship date adder target state
  const [nextBottomDate, setNextBottomDate] = useState<{
    year: number;
    month: number;
    day: number;
    worshipType: WorshipType;
  }>(() => {
    if (entries.length > 0) {
      const last = entries[entries.length - 1];
      return getNextWorshipDate(last.year, last.month, last.day);
    }
    return { year: 2026, month: 11, day: 1, worshipType: '주일' };
  });

  // Collapsible main section toggle
  const [isMainListSectionCollapsed, setIsMainListSectionCollapsed] =
    useState<boolean>(false);

  const [onlyFilledRows, setOnlyFilledRows] = useState<boolean>(false);
  const [doubleLineBreak, setDoubleLineBreak] = useState<boolean>(true);
  const [worshipFilter, setWorshipFilter] = useState<'전체' | WorshipType>('전체');
  const [searchQuery, setSearchQuery] = useState<string>('');

  // Batch default location helper
  const [batchLocationPreset, setBatchLocationPreset] =
    useState<LocationPreset>('키토본부');
  const [batchLocationCustom, setBatchLocationCustom] = useState<string>('');

  // Copy feedback states
  const [copiedAll, setCopiedAll] = useState<boolean>(false);
  const [copiedRowId, setCopiedRowId] = useState<string | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);

  useEffect(() => {
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(entries));
    } catch {
      // ignore storage errors
    }
  }, [entries]);

  // Close calendar popover on Escape key
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        setOpenCalendarRowId(null);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, []);

  const showToast = (msg: string) => {
    setToastMessage(msg);
    window.setTimeout(() => {
      setToastMessage((prev) => (prev === msg ? null : prev));
    }, 2400);
  };

  // Update a single entry field
  const updateEntry = <K extends keyof WorshipEntry>(
    id: string,
    field: K,
    value: WorshipEntry[K]
  ) => {
    setEntries((prev) =>
      prev.map((item) => (item.id === id ? { ...item, [field]: value } : item))
    );
  };

  // Toggle collapse state of a single row
  const toggleRowCollapse = (id: string) => {
    setEntries((prev) =>
      prev.map((item) =>
        item.id === id ? { ...item, collapsed: !item.collapsed } : item
      )
    );
  };

  // Bulk collapse rows before the extraction start date (or toggle all)
  const collapseRowsBeforeStartDate = () => {
    const startNum =
      extractStartDate.year * 10000 +
      extractStartDate.month * 100 +
      extractStartDate.day;
    let collapsedCount = 0;

    setEntries((prev) =>
      prev.map((item) => {
        const entryNum = item.year * 10000 + item.month * 100 + item.day;
        if (entryNum < startNum) {
          collapsedCount++;
          return { ...item, collapsed: true };
        }
        return item;
      })
    );

    if (collapsedCount > 0) {
      showToast(
        `추출 시작날짜(${extractStartDate.month}월 ${extractStartDate.day}일) 이전 ${collapsedCount}개 주차를 접었습니다.`
      );
    } else {
      showToast(
        '추출 시작날짜 이전에 해당하는 주차가 없습니다. 개별 행의 [접기] 버튼을 눌러 접을 수 있습니다.'
      );
    }
  };

  const setAllRowsCollapsed = (collapsed: boolean) => {
    setEntries((prev) => prev.map((item) => ({ ...item, collapsed })));
    showToast(
      collapsed
        ? '모든 예배 주차 행을 한 줄로 접었습니다.'
        : '접혀 있던 모든 예배 주차 행을 펼쳤습니다.'
    );
  };

  // Select date from the calendar popover in a single click
  const handleSelectDateFromCalendar = (
    id: string,
    newYear: number,
    newMonth: number,
    newDay: number
  ) => {
    const dow = new Date(newYear, newMonth - 1, newDay).getDay();
    setEntries((prev) =>
      prev.map((item) => {
        if (item.id !== id) return item;
        const autoWorshipType: WorshipType =
          dow === 0 ? '주일' : dow === 3 ? '삼일' : item.worshipType;
        return {
          ...item,
          year: newYear,
          month: newMonth,
          day: newDay,
          worshipType: autoWorshipType,
        };
      })
    );
  };

  // Add another location entry on the same date right below the target entry
  const duplicateDateRow = (index: number) => {
    const source = entries[index];
    if (!source) return;
    const newEntry: WorshipEntry = {
      id: `${source.year}-${String(source.month).padStart(2, '0')}-${String(source.day).padStart(2, '0')}-${Math.random().toString(36).slice(2, 7)}`,
      year: source.year,
      month: source.month,
      day: source.day,
      worshipType: source.worshipType,
      locationPreset: '키토본부',
      locationCustom: '',
      topic: '',
      preacherPreset: '김요안',
      preacherCustom: '',
      scripture: '',
      note: '',
      collapsed: false,
    };
    const updated = [...entries];
    updated.splice(index + 1, 0, newEntry);
    setEntries(updated);
    showToast(
      `${String(source.month).padStart(2, '0')}월 ${String(source.day).padStart(2, '0')}일(${source.worshipType})에 새 장소 기록 행을 추가했습니다.`
    );
  };

  // Add a new custom row at the bottom using nextBottomDate and automatically advance nextBottomDate to the next worship day
  const addCustomRowAtBottom = () => {
    const target = nextBottomDate;

    const newEntry: WorshipEntry = {
      id: `${target.year}-${String(target.month).padStart(2, '0')}-${String(target.day).padStart(2, '0')}-${Math.random().toString(36).slice(2, 7)}`,
      year: target.year,
      month: target.month,
      day: target.day,
      worshipType: target.worshipType,
      locationPreset: '키토본부',
      locationCustom: '',
      topic: '',
      preacherPreset: '김요안',
      preacherCustom: '',
      scripture: '',
      note: '',
      collapsed: false,
    };

    setEntries((prev) => [...prev, newEntry]);

    // If the added date is beyond current extractEndDate, expand extractEndDate automatically so it appears in Telegram preview
    const addedNum = target.year * 10000 + target.month * 100 + target.day;
    const endNum =
      extractEndDate.year * 10000 +
      extractEndDate.month * 100 +
      extractEndDate.day;
    if (addedNum > endNum) {
      setExtractEndDate({
        year: target.year,
        month: target.month,
        day: target.day,
      });
    }

    // Automatically advance nextBottomDate to the next upcoming Wednesday (삼일) or Sunday (주일)
    const upcoming = getNextWorshipDate(target.year, target.month, target.day);
    setNextBottomDate(upcoming);

    showToast(
      `${String(target.month).padStart(2, '0')}월 ${String(target.day).padStart(2, '0')}일(${target.worshipType}) 행 추가 완료 (다음 추가일: ${String(upcoming.month).padStart(2, '0')}월 ${String(upcoming.day).padStart(2, '0')}일 ${upcoming.worshipType})`
    );
  };

  // Delete a row
  const removeRow = (id: string) => {
    if (entries.length <= 1) {
      setEntries((prev) =>
        prev.map((item) =>
          item.id === id
            ? {
                ...item,
                locationPreset: '키토본부',
                locationCustom: '',
                topic: '',
                scripture: '',
                note: '',
              }
            : item
        )
      );
      showToast('행의 입력 내용을 비웠습니다.');
      return;
    }
    setEntries((prev) => prev.filter((item) => item.id !== id));
    showToast('선택한 행을 삭제했습니다.');
  };

  // Sort entries chronologically by year, month, and day
  const sortEntriesByDate = () => {
    setEntries((prev) =>
      [...prev].sort((a, b) => {
        if (a.year !== b.year) return a.year - b.year;
        if (a.month !== b.month) return a.month - b.month;
        return a.day - b.day;
      })
    );
    showToast('날짜순(오름차순)으로 행을 정렬했습니다.');
  };

  // Change year or month and generate that month's Sundays & Wednesdays
  const handleMonthChange = (newYear: number, newMonth: number) => {
    setSelectedYear(newYear);
    setSelectedMonth(newMonth);
    const lastDay = new Date(newYear, newMonth, 0).getDate();
    setExtractStartDate({ year: newYear, month: newMonth, day: 1 });
    setExtractEndDate({ year: newYear, month: newMonth, day: lastDay });
    const freshSchedule = generateMonthlySchedule(newYear, newMonth, false);
    setEntries(freshSchedule);
    if (freshSchedule.length > 0) {
      const last = freshSchedule[freshSchedule.length - 1];
      setNextBottomDate(getNextWorshipDate(last.year, last.month, last.day));
    }
    showToast(
      `${newYear}년 ${newMonth}월 주일·삼일예배 일정을 자동 생성했습니다.`
    );
  };

  // Reset to clean empty schedule with '키토본부' default
  const handleClearAllInputs = () => {
    const lastDay = new Date(selectedYear, selectedMonth, 0).getDate();
    setExtractStartDate({ year: selectedYear, month: selectedMonth, day: 1 });
    setExtractEndDate({
      year: selectedYear,
      month: selectedMonth,
      day: lastDay,
    });
    const cleanSchedule = generateMonthlySchedule(
      selectedYear,
      selectedMonth,
      false
    );
    setEntries(cleanSchedule);
    if (cleanSchedule.length > 0) {
      const last = cleanSchedule[cleanSchedule.length - 1];
      setNextBottomDate(getNextWorshipDate(last.year, last.month, last.day));
    }
    showToast('모든 입력 칸을 빈 양식(기본 장소: 키토본부)으로 초기화했습니다.');
  };

  // Load the 4 sample records
  const handleLoadSampleData = () => {
    setSelectedYear(2026);
    setSelectedMonth(11);
    setExtractStartDate({ year: 2026, month: 11, day: 1 });
    setExtractEndDate({ year: 2026, month: 11, day: 30 });
    const sampleSchedule = generateMonthlySchedule(2026, 11, true);
    setEntries(sampleSchedule);
    if (sampleSchedule.length > 0) {
      const last = sampleSchedule[sampleSchedule.length - 1];
      setNextBottomDate(getNextWorshipDate(last.year, last.month, last.day));
    }
    showToast('11월 예시 데이터를 불러왔습니다.');
  };

  // Apply location to all existing rows at once
  const applyBatchLocationToAll = () => {
    setEntries((prev) =>
      prev.map((item) => ({
        ...item,
        locationPreset: batchLocationPreset,
        locationCustom:
          batchLocationPreset === '기타' ? batchLocationCustom : '',
      }))
    );
    const label =
      batchLocationPreset === '기타'
        ? batchLocationCustom.trim() || '기타'
        : batchLocationPreset;
    showToast(`모든 행의 설교장소를 [${label}](으)로 일괄 변경했습니다.`);
  };

  // Filtered entries for editor display
  const displayedEntries = useMemo(() => {
    return entries.filter((entry) => {
      if (worshipFilter !== '전체' && entry.worshipType !== worshipFilter) {
        return false;
      }
      if (searchQuery.trim()) {
        const q = searchQuery.trim().toLowerCase();
        const loc =
          entry.locationPreset === '기타'
            ? entry.locationCustom
            : entry.locationPreset;
        const preacher =
          entry.preacherPreset === '기타'
            ? entry.preacherCustom
            : entry.preacherPreset;
        const dateStr = `${String(entry.month).padStart(2, '0')}월${String(entry.day).padStart(2, '0')}일`;
        return (
          entry.topic.toLowerCase().includes(q) ||
          entry.scripture.toLowerCase().includes(q) ||
          (entry.note || '').toLowerCase().includes(q) ||
          loc.toLowerCase().includes(q) ||
          preacher.toLowerCase().includes(q) ||
          dateStr.includes(q)
        );
      }
      return true;
    });
  }, [entries, worshipFilter, searchQuery]);

  // Extracted Telegram lines filtered by [extractStartDate, extractEndDate] in chronological / entry order
  const extractedEntries = useMemo(() => {
    const startNum =
      extractStartDate.year * 10000 +
      extractStartDate.month * 100 +
      extractStartDate.day;
    const endNum =
      extractEndDate.year * 10000 +
      extractEndDate.month * 100 +
      extractEndDate.day;

    return entries.filter((e) => {
      const entryNum = e.year * 10000 + e.month * 100 + e.day;
      if (entryNum < startNum || entryNum > endNum) {
        return false;
      }
      if (onlyFilledRows && !isEntryFilled(e)) {
        return false;
      }
      return true;
    });
  }, [entries, extractStartDate, extractEndDate, onlyFilledRows]);

  const telegramOutputText = useMemo(() => {
    if (extractedEntries.length === 0) return '';
    const numberedLines = extractedEntries.map(
      (entry, idx) => `${idx + 1}. ${formatTelegramLine(entry)}`
    );
    const sep = doubleLineBreak ? '\n\n' : '\n';
    return ['✅예배 일정', ...numberedLines].join(sep);
  }, [extractedEntries, doubleLineBreak]);

  const filledCount = useMemo(
    () => entries.filter((e) => isEntryFilled(e)).length,
    [entries]
  );

  const collapsedCount = useMemo(
    () => entries.filter((e) => e.collapsed).length,
    [entries]
  );

  // Copy full Telegram output
  const handleCopyAll = async () => {
    if (!telegramOutputText.trim()) {
      showToast('선택한 추출 기간 내에 복사할 예배 기록이 없습니다.');
      return;
    }
    try {
      await navigator.clipboard.writeText(telegramOutputText);
      setCopiedAll(true);
      showToast('텔레그램 양식 텍스트가 클립보드에 복사되었습니다.');
      window.setTimeout(() => setCopiedAll(false), 2000);
    } catch {
      showToast('클립보드 복사에 실패했습니다. 텍스트 영역을 직접 선택해 복사해 주세요.');
    }
  };

  // Copy a single row's formatted string
  const handleCopySingleRow = async (entry: WorshipEntry, rowIndex: number) => {
    const line = `${rowIndex + 1}. ${formatTelegramLine(entry)}`;
    try {
      await navigator.clipboard.writeText(line);
      setCopiedRowId(entry.id);
      showToast(`복사 완료: ${line}`);
      window.setTimeout(() => {
        setCopiedRowId((prev) => (prev === entry.id ? null : prev));
      }, 1800);
    } catch {
      showToast('복사에 실패했습니다.');
    }
  };

  return (
    <div className="min-h-screen flex flex-col bg-slate-50 text-slate-900">
      {/* Top Bar Contract: 3 zones separated by gap-8 */}
      <header className="sticky top-0 z-30 flex items-center justify-between gap-8 px-6 py-3.5 bg-white border-b border-slate-200">
        {/* Zone 1: Single text element wordmark */}
        <a
          href="#top"
          className="font-display text-lg font-bold tracking-tight text-slate-900 whitespace-nowrap shrink-0"
        >
          예배계획
        </a>

        {/* Zone 2: Concise single-line navigation links */}
        <nav className="hidden md:flex items-center gap-6 text-sm font-medium text-slate-600">
          <a
            href="#schedule-editor"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            예배 기록표
          </a>
          <a
            href="#batch-tools"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            장소 일괄 설정
          </a>
          <a
            href="#telegram-preview"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            텔레그램 텍스트 추출
          </a>
          <a
            href="#format-guide"
            className="hover:text-slate-900 hover:underline underline-offset-4 transition-colors whitespace-nowrap shrink-0"
          >
            양식 안내
          </a>
        </nav>

        {/* Zone 3: 1 primary action */}
        <div className="flex items-center shrink-0">
          <button
            type="button"
            onClick={handleCopyAll}
            className="inline-flex items-center gap-2 px-4 py-2 text-xs font-semibold text-white bg-slate-900 rounded-lg hover:bg-slate-800 focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-slate-900 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
          >
            {copiedAll ? (
              <>
                <Check className="w-3.5 h-3.5 text-emerald-400" />
                <span>전체 복사 완료</span>
              </>
            ) : (
              <>
                <Copy className="w-3.5 h-3.5" />
                <span>텔레그램 텍스트 복사</span>
              </>
            )}
          </button>
        </div>
      </header>

      {/* Main Content Container (1440px max-width desktop workspace) */}
      <main
        id="top"
        className="flex-1 w-full max-w-[1440px] mx-auto px-4 sm:px-6 py-6"
      >
        {/* Workspace Header & Summary Bar */}
        <section className="mb-6 flex flex-col lg:flex-row lg:items-end justify-between gap-4 pb-5 border-b border-slate-200">
          <div>
            <div className="flex items-center gap-2 text-xs text-slate-500 mb-1.5 font-mono-tabular">
              <span>
                {selectedYear}년 {selectedMonth}월 예배 일정
              </span>
              <span aria-hidden="true">·</span>
              <span>전체 {entries.length}개 행</span>
              <span aria-hidden="true">·</span>
              <span>작성 완료 {filledCount}건</span>
              {collapsedCount > 0 && (
                <>
                  <span aria-hidden="true">·</span>
                  <span>접힌 주차 {collapsedCount}개</span>
                </>
              )}
            </div>
            <h1 className="font-display text-2xl sm:text-3xl font-bold text-slate-900 tracking-tight">
              주일·삼일예배 설교 기록 및 텔레그램 추출
            </h1>
            <p className="mt-1 text-sm text-slate-600 max-w-2xl">
              지나간 주차는 삭제하지 않고 한 줄로 접어둘 수 있으며, 우측 추출 기간(시작날짜~끝날짜)을 선택해 원하는 날짜 구간만 텔레그램 텍스트로 복사할 수 있습니다.
            </p>
          </div>

          {/* Action Toolbar */}
          <div className="flex flex-wrap items-center gap-2">
            {/* Month / Year Selector */}
            <div className="inline-flex items-center gap-1.5 bg-white border border-slate-200 rounded-lg px-3 py-1.5 text-xs font-medium text-slate-700">
              <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
              <select
                aria-label="연도 선택"
                value={selectedYear}
                onChange={(e) =>
                  handleMonthChange(Number(e.target.value), selectedMonth)
                }
                className="bg-transparent font-mono-tabular font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                <option value={2025}>2025년</option>
                <option value={2026}>2026년</option>
                <option value={2027}>2027년</option>
              </select>
              <span className="text-slate-300">/</span>
              <select
                aria-label="월 선택"
                value={selectedMonth}
                onChange={(e) =>
                  handleMonthChange(selectedYear, Number(e.target.value))
                }
                className="bg-transparent font-mono-tabular font-semibold text-slate-900 focus:outline-none cursor-pointer"
              >
                {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => (
                  <option key={m} value={m}>
                    {m}월
                  </option>
                ))}
              </select>
            </div>

            <button
              type="button"
              onClick={handleLoadSampleData}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <Sparkles className="w-3.5 h-3.5 text-slate-500" />
              <span>예시 데이터 채우기</span>
            </button>

            <button
              type="button"
              onClick={handleClearAllInputs}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-xs font-medium text-slate-700 bg-white border border-slate-200 rounded-lg hover:bg-slate-100 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
            >
              <RotateCcw className="w-3.5 h-3.5 text-slate-500" />
              <span>빈 양식으로 초기화</span>
            </button>
          </div>
        </section>

        {/* Two-Column Split Layout: Left 65% Schedule Editor, Right 35% Sticky Telegram Output */}
        <div className="grid grid-cols-1 xl:grid-cols-12 gap-6 items-start">
          {/* LEFT COLUMN: Schedule Table Editor (8 cols on xl) */}
          <div id="schedule-editor" className="xl:col-span-8 space-y-4">
            {/* Filter & Batch Location Bar */}
            <div
              id="batch-tools"
              className="bg-white border border-slate-200 rounded-xl p-4 flex flex-col md:flex-row md:items-center justify-between gap-4"
            >
              {/* Left: Segmented Worship Type Filter + Search */}
              <div className="flex flex-wrap items-center gap-2.5">
                <div
                  role="group"
                  aria-label="예배 구분 필터"
                  className="inline-flex items-center gap-1 p-1 bg-slate-100 rounded-lg"
                >
                  {(['전체', '주일', '삼일'] as const).map((tab) => (
                    <button
                      key={tab}
                      type="button"
                      onClick={() => setWorshipFilter(tab)}
                      className={`px-3 py-1 text-xs font-medium rounded-md transition-colors whitespace-nowrap shrink-0 cursor-pointer ${
                        worshipFilter === tab
                          ? 'bg-white text-slate-900 shadow-xs'
                          : 'text-slate-600 hover:text-slate-900'
                      }`}
                    >
                      {tab === '전체' ? '전체 예배' : `${tab}예배`}
                    </button>
                  ))}
                </div>

                <div className="relative">
                  <Search className="w-3.5 h-3.5 text-slate-400 absolute left-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                  <input
                    type="text"
                    value={searchQuery}
                    onChange={(e) => setSearchQuery(e.target.value)}
                    placeholder="주제, 장소, 성구, 특이사항 검색..."
                    className="pl-8 pr-3 py-1.5 text-xs bg-slate-50 border border-slate-200 rounded-lg text-slate-900 placeholder:text-slate-400 focus:bg-white focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 w-48 sm:w-56"
                  />
                </div>
              </div>

              {/* Right: Quick Batch Location Setter */}
              <div className="flex flex-wrap items-center gap-2 pt-3 md:pt-0 border-t md:border-t-0 border-slate-100">
                <span className="text-xs font-medium text-slate-500 whitespace-nowrap">
                  전체 장소 일괄 적용:
                </span>
                <select
                  aria-label="일괄 적용할 설교장소 선택"
                  value={batchLocationPreset}
                  onChange={(e) => {
                    const nextPreset = e.target.value as LocationPreset;
                    setBatchLocationPreset(nextPreset);
                    if (nextPreset === '기타') {
                      setBatchLocationCustom('');
                    }
                  }}
                  className="px-2.5 py-1.5 text-xs font-medium bg-slate-50 border border-slate-200 rounded-lg text-slate-900 focus:bg-white focus:outline-none focus:border-slate-400 cursor-pointer"
                >
                  {LOCATION_OPTIONS.map((loc) => (
                    <option key={loc} value={loc}>
                      [{loc}]
                    </option>
                  ))}
                </select>

                {batchLocationPreset === '기타' && (
                  <input
                    type="text"
                    value={batchLocationCustom}
                    onChange={(e) => setBatchLocationCustom(e.target.value)}
                    placeholder="입력해주세요 (예: 빠스따사)"
                    className="px-2.5 py-1.5 text-xs bg-white border border-slate-300 rounded-lg text-slate-900 placeholder:text-slate-400 focus:outline-none focus:ring-2 focus:ring-slate-900/15 w-44"
                  />
                )}

                <button
                  type="button"
                  onClick={applyBatchLocationToAll}
                  className="px-2.5 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                >
                  일괄 변경
                </button>
              </div>
            </div>

            {/* Schedule Entry List Card */}
            <div className="bg-white border border-slate-200 rounded-xl">
              <div
                className={`px-4 py-3 bg-slate-50/80 flex flex-wrap items-center justify-between gap-3 ${
                  isMainListSectionCollapsed
                    ? 'rounded-xl'
                    : 'border-b border-slate-200 rounded-t-xl'
                }`}
              >
                <div className="flex items-center gap-2 text-xs font-medium text-slate-700">
                  <button
                    type="button"
                    onClick={() =>
                      setIsMainListSectionCollapsed((prev) => !prev)
                    }
                    className="inline-flex items-center gap-1.5 font-semibold text-slate-900 hover:text-slate-700 cursor-pointer"
                  >
                    {isMainListSectionCollapsed ? (
                      <ChevronDown className="w-4 h-4 text-slate-500" />
                    ) : (
                      <ChevronUp className="w-4 h-4 text-slate-500" />
                    )}
                    <span>예배 일정별 상세 기록</span>
                  </button>
                  <span aria-hidden="true" className="text-slate-300">
                    ·
                  </span>
                  <span className="text-slate-500 hidden sm:inline">
                    지나간 주차는 [접기]를 눌러 한 줄로 접어둘 수 있습니다
                  </span>
                </div>

                <div className="flex flex-wrap items-center gap-1.5">
                  <button
                    type="button"
                    onClick={collapseRowsBeforeStartDate}
                    title="우측 추출 시작날짜보다 이전 주차들을 모두 한 줄로 접습니다"
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <Minimize2 className="w-3 h-3" />
                    <span>시작일 이전 주차 접기</span>
                  </button>

                  {collapsedCount < entries.length ? (
                    <button
                      type="button"
                      onClick={() => setAllRowsCollapsed(true)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <ChevronUp className="w-3 h-3" />
                      <span>전체 주차 접기</span>
                    </button>
                  ) : null}

                  {collapsedCount > 0 ? (
                    <button
                      type="button"
                      onClick={() => setAllRowsCollapsed(false)}
                      className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 hover:text-slate-900 bg-white border border-slate-300 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                    >
                      <Maximize2 className="w-3 h-3" />
                      <span>전체 펼치기 ({collapsedCount})</span>
                    </button>
                  ) : null}

                  <button
                    type="button"
                    onClick={sortEntriesByDate}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-600 hover:text-slate-900 bg-white border border-slate-200 rounded-md hover:bg-slate-50 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                  >
                    <ArrowUpDown className="w-3 h-3" />
                    <span>날짜순 정렬</span>
                  </button>
                </div>
              </div>

              {!isMainListSectionCollapsed && (
                <>
                  {displayedEntries.length === 0 ? (
                    <div className="p-12 text-center">
                      <p className="text-sm font-medium text-slate-700">
                        표시할 예배 기록 행이 없습니다.
                      </p>
                      <p className="mt-1 text-xs text-slate-500">
                        검색어나 필터를 초기화하거나 새 예배 일정을 추가해 주세요.
                      </p>
                      <button
                        type="button"
                        onClick={() => {
                          setWorshipFilter('전체');
                          setSearchQuery('');
                        }}
                        className="mt-4 px-4 py-2 text-xs font-medium text-white bg-slate-900 rounded-lg hover:bg-slate-800 transition-colors cursor-pointer"
                      >
                        필터 초기화
                      </button>
                    </div>
                  ) : (
                    <div className="divide-y divide-slate-200">
                      {displayedEntries.map((entry) => {
                        const originalIndex = entries.findIndex(
                          (e) => e.id === entry.id
                        );
                        const formattedLine = formatTelegramLine(entry);
                        const filled = isEntryFilled(entry);
                        const isCalendarOpen = openCalendarRowId === entry.id;

                        const entryNum =
                          entry.year * 10000 + entry.month * 100 + entry.day;
                        const startNum =
                          extractStartDate.year * 10000 +
                          extractStartDate.month * 100 +
                          extractStartDate.day;
                        const endNum =
                          extractEndDate.year * 10000 +
                          extractEndDate.month * 100 +
                          extractEndDate.day;
                        const inExtractRange =
                          entryNum >= startNum && entryNum <= endNum;

                        // COLLAPSED VIEW (Compact 1-Line Summary Bar for Past Weeks)
                        if (entry.collapsed) {
                          return (
                            <div
                              key={entry.id}
                              className="px-4 py-2.5 bg-slate-100/70 hover:bg-slate-100 transition-colors flex items-center justify-between gap-3"
                            >
                              <div
                                onClick={() => toggleRowCollapse(entry.id)}
                                className="flex items-center gap-2.5 min-w-0 flex-1 cursor-pointer"
                              >
                                <span className="font-mono-tabular text-xs font-bold text-slate-500 shrink-0">
                                  {originalIndex + 1}.
                                </span>
                                <span
                                  className={`px-2 py-0.5 text-[11px] font-semibold rounded-md shrink-0 font-mono-tabular ${
                                    entry.worshipType === '주일'
                                      ? 'bg-slate-900 text-white'
                                      : 'bg-slate-200 text-slate-700'
                                  }`}
                                >
                                  {String(entry.month).padStart(2, '0')}월{' '}
                                  {String(entry.day).padStart(2, '0')}일 (
                                  {entry.worshipType})
                                </span>
                                <span
                                  className="text-xs text-slate-600 font-mono-tabular truncate"
                                  title={formattedLine}
                                >
                                  {formattedLine}
                                </span>
                              </div>

                              <div className="flex items-center gap-2 shrink-0">
                                <span className="text-[11px] text-slate-400">
                                  {inExtractRange ? '추출포함' : '기간외'} ·{' '}
                                  {filled ? '작성됨' : '미작성'}
                                </span>
                                <button
                                  type="button"
                                  onClick={() => toggleRowCollapse(entry.id)}
                                  className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 rounded-md transition-colors cursor-pointer whitespace-nowrap"
                                >
                                  <ChevronDown className="w-3.5 h-3.5" />
                                  <span>펼치기</span>
                                </button>
                              </div>
                            </div>
                          );
                        }

                        // EXPANDED VIEW
                        return (
                          <div
                            key={entry.id}
                            className={`p-4 transition-colors ${
                              filled
                                ? 'bg-white hover:bg-slate-50/60'
                                : 'bg-slate-50/30 hover:bg-slate-50/80'
                            }`}
                          >
                            {/* Top Mini Header of Row: Row Number, Extraction Range Status, and Collapse Button */}
                            <div className="mb-2.5 flex items-center justify-between gap-2">
                              <div className="flex items-center gap-2 text-xs font-mono-tabular">
                                <span className="font-bold text-slate-800">
                                  #{originalIndex + 1}주차 기록
                                </span>
                                <span aria-hidden="true" className="text-slate-300">
                                  ·
                                </span>
                                <span
                                  className={
                                    inExtractRange
                                      ? 'text-slate-600 font-medium'
                                      : 'text-slate-400'
                                  }
                                >
                                  {inExtractRange
                                    ? '현재 추출 기간에 포함됨'
                                    : '추출 기간 외'}
                                </span>
                              </div>

                              <button
                                type="button"
                                onClick={() => toggleRowCollapse(entry.id)}
                                title="이 주차를 삭제하지 않고 한 줄로 접어둡니다"
                                className="inline-flex items-center gap-1 px-2 py-1 text-xs font-medium text-slate-500 hover:text-slate-900 hover:bg-slate-100 rounded-md transition-colors cursor-pointer"
                              >
                                <ChevronUp className="w-3.5 h-3.5" />
                                <span>이 주차 접기</span>
                              </button>
                            </div>

                            {/* Row 1: 날짜 및 예배 구분 (3 cols) -> 1. 설교장소 (3 cols) -> 2. 설교주제 (6 cols) */}
                            <div className="grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                              {/* 날짜 및 예배 구분 */}
                              <div className="md:col-span-3 relative">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  날짜 및 예배 구분
                                </label>
                                <div className="flex items-center gap-1.5">
                                  {/* One-Click Calendar Trigger Button */}
                                  <button
                                    type="button"
                                    onClick={() =>
                                      setOpenCalendarRowId((prev) =>
                                        prev === entry.id ? null : entry.id
                                      )
                                    }
                                    aria-expanded={isCalendarOpen}
                                    aria-label="달력에서 날짜 선택"
                                    className={`inline-flex items-center gap-1.5 bg-white border rounded-lg px-2.5 py-1.5 font-mono-tabular text-xs font-semibold text-slate-900 hover:bg-slate-50 transition-colors cursor-pointer whitespace-nowrap shrink-0 ${
                                      isCalendarOpen
                                        ? 'border-slate-900 ring-2 ring-slate-900/15'
                                        : 'border-slate-200'
                                    }`}
                                  >
                                    <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                                    <span>
                                      {String(entry.month).padStart(2, '0')}월{' '}
                                      {String(entry.day).padStart(2, '0')}일
                                    </span>
                                  </button>

                                  {/* Calendar Popover for One-Click Date Selection */}
                                  {isCalendarOpen && (
                                    <DateCalendarPopover
                                      year={entry.year}
                                      month={entry.month}
                                      day={entry.day}
                                      onSelectDate={(y, m, d) =>
                                        handleSelectDateFromCalendar(
                                          entry.id,
                                          y,
                                          m,
                                          d
                                        )
                                      }
                                      onClose={() => setOpenCalendarRowId(null)}
                                    />
                                  )}

                                  {/* Worship Type Dropdown: (주일) or (삼일) */}
                                  <div className="relative flex-1 min-w-[78px]">
                                    <select
                                      aria-label="예배 종류 선택 (주일 또는 삼일)"
                                      value={entry.worshipType}
                                      onChange={(e) =>
                                        updateEntry(
                                          entry.id,
                                          'worshipType',
                                          e.target.value as WorshipType
                                        )
                                      }
                                      className={`w-full appearance-none pl-2.5 pr-7 py-1.5 text-xs font-semibold border rounded-lg focus:outline-none focus:ring-2 focus:ring-slate-900/15 cursor-pointer ${
                                        entry.worshipType === '주일'
                                          ? 'bg-slate-900 text-white border-slate-900'
                                          : 'bg-slate-200 text-slate-700 border-slate-300'
                                      }`}
                                    >
                                      {WORSHIP_TYPE_OPTIONS.map((type) => (
                                        <option
                                          key={type}
                                          value={type}
                                          className={
                                            type === '삼일'
                                              ? 'bg-slate-100 text-slate-700'
                                              : 'bg-white text-slate-900'
                                          }
                                        >
                                          ({type})
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown
                                      className={`w-3.5 h-3.5 absolute right-2 top-1/2 -translate-y-1/2 pointer-events-none ${
                                        entry.worshipType === '주일'
                                          ? 'text-slate-300'
                                          : 'text-slate-600'
                                      }`}
                                    />
                                  </div>
                                </div>
                              </div>

                              {/* 1. 설교장소 Dropdown + Custom Input */}
                              <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  1. 설교장소{' '}
                                  <span className="text-slate-400">[장소]</span>
                                </label>
                                <div className="space-y-1.5">
                                  <div className="relative">
                                    <select
                                      aria-label="설교장소 선택"
                                      value={entry.locationPreset}
                                      onChange={(e) => {
                                        const nextLoc = e.target
                                          .value as LocationPreset;
                                        updateEntry(
                                          entry.id,
                                          'locationPreset',
                                          nextLoc
                                        );
                                        if (nextLoc === '기타') {
                                          updateEntry(
                                            entry.id,
                                            'locationCustom',
                                            ''
                                          );
                                        }
                                      }}
                                      className="w-full appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 cursor-pointer"
                                    >
                                      {LOCATION_OPTIONS.map((loc) => (
                                        <option key={loc} value={loc}>
                                          [{loc}]
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  </div>

                                  {entry.locationPreset === '기타' && (
                                    <input
                                      type="text"
                                      value={entry.locationCustom}
                                      onChange={(e) =>
                                        updateEntry(
                                          entry.id,
                                          'locationCustom',
                                          e.target.value
                                        )
                                      }
                                      placeholder="입력해주세요 (예: 빠스따사)"
                                      className={`w-full px-2.5 py-1.5 text-xs border rounded-lg text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
                                        entry.locationCustom.trim()
                                          ? 'bg-white border-slate-200 placeholder:text-slate-400 focus:ring-slate-900/15 focus:border-slate-400'
                                          : 'bg-rose-50 border-rose-300 placeholder:text-rose-400 focus:bg-white focus:ring-rose-500/20 focus:border-rose-400'
                                      }`}
                                    />
                                  )}
                                </div>
                              </div>

                              {/* 2. 설교주제 Input */}
                              <div className="md:col-span-6">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  2. 설교주제
                                </label>
                                <input
                                  type="text"
                                  value={entry.topic}
                                  onChange={(e) =>
                                    updateEntry(
                                      entry.id,
                                      'topic',
                                      e.target.value
                                    )
                                  }
                                  placeholder="입력해주세요 (예: 중등 25과 신천지 예수교 증거장막성전)"
                                  className={`w-full px-3 py-1.5 text-xs border rounded-lg text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
                                    entry.topic.trim()
                                      ? 'bg-white border-slate-200 placeholder:text-slate-400 focus:ring-slate-900/15 focus:border-slate-400'
                                      : 'bg-rose-50 border-rose-300 placeholder:text-rose-400 focus:bg-white focus:ring-rose-500/20 focus:border-rose-400'
                                  }`}
                                />
                              </div>
                            </div>

                            {/* Row 2: 3. 설교자 (3 cols) -> 4. 묵도성구 (3 cols) -> 5. 특이사항 (4 cols) -> 행 액션 (2 cols) */}
                            <div className="mt-3 grid grid-cols-1 md:grid-cols-12 gap-3 items-start">
                              {/* 3. 설교자 Dropdown + Custom Input */}
                              <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  3. 설교자{' '}
                                  <span className="text-slate-400">
                                    &#123;설교자&#125;
                                  </span>
                                </label>
                                <div className="space-y-1.5">
                                  <div className="relative">
                                    <select
                                      aria-label="설교자 선택"
                                      value={entry.preacherPreset}
                                      onChange={(e) => {
                                        const nextPreacher = e.target
                                          .value as PreacherPreset;
                                        updateEntry(
                                          entry.id,
                                          'preacherPreset',
                                          nextPreacher
                                        );
                                        if (nextPreacher === '기타') {
                                          updateEntry(
                                            entry.id,
                                            'preacherCustom',
                                            ''
                                          );
                                        }
                                      }}
                                      className="w-full appearance-none pl-3 pr-8 py-1.5 text-xs font-medium bg-white border border-slate-200 rounded-lg text-slate-900 focus:outline-none focus:ring-2 focus:ring-slate-900/15 focus:border-slate-400 cursor-pointer"
                                    >
                                      {PREACHER_OPTIONS.map((preacher) => (
                                        <option key={preacher} value={preacher}>
                                          &#123;{preacher}&#125;
                                        </option>
                                      ))}
                                    </select>
                                    <ChevronDown className="w-3.5 h-3.5 text-slate-400 absolute right-2.5 top-1/2 -translate-y-1/2 pointer-events-none" />
                                  </div>

                                  {entry.preacherPreset === '기타' && (
                                    <input
                                      type="text"
                                      value={entry.preacherCustom}
                                      onChange={(e) =>
                                        updateEntry(
                                          entry.id,
                                          'preacherCustom',
                                          e.target.value
                                        )
                                      }
                                      placeholder="입력해주세요"
                                      className={`w-full px-2.5 py-1.5 text-xs border rounded-lg text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
                                        entry.preacherCustom.trim()
                                          ? 'bg-white border-slate-200 placeholder:text-slate-400 focus:ring-slate-900/15 focus:border-slate-400'
                                          : 'bg-rose-50 border-rose-300 placeholder:text-rose-400 focus:bg-white focus:ring-rose-500/20 focus:border-rose-400'
                                      }`}
                                    />
                                  )}
                                </div>
                              </div>

                              {/* 4. 묵도성구 Input */}
                              <div className="md:col-span-3">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  4. 묵도성구{' '}
                                  <span className="text-slate-400">
                                    /묵도:성구
                                  </span>
                                </label>
                                <input
                                  type="text"
                                  value={entry.scripture}
                                  onChange={(e) =>
                                    updateEntry(
                                      entry.id,
                                      'scripture',
                                      e.target.value
                                    )
                                  }
                                  placeholder="입력해주세요 (예: 마13:24-27)"
                                  className={`w-full px-3 py-1.5 text-xs border rounded-lg text-slate-900 transition-colors focus:outline-none focus:ring-2 ${
                                    entry.scripture.trim()
                                      ? 'bg-white border-slate-200 placeholder:text-slate-400 focus:ring-slate-900/15 focus:border-slate-400'
                                      : 'bg-rose-50 border-rose-300 placeholder:text-rose-400 focus:bg-white focus:ring-rose-500/20 focus:border-rose-400'
                                  }`}
                                />
                              </div>

                              {/* 5. 특이사항 Input (Optional - Soft Yellow Tint) */}
                              <div className="md:col-span-4">
                                <label className="block text-xs font-medium text-slate-500 mb-1">
                                  5. 특이사항{' '}
                                  <span className="text-slate-400">
                                    [특이사항 : 내용] (미입력 시 생략)
                                  </span>
                                </label>
                                <input
                                  type="text"
                                  value={entry.note || ''}
                                  onChange={(e) =>
                                    updateEntry(
                                      entry.id,
                                      'note',
                                      e.target.value
                                    )
                                  }
                                  placeholder="입력해주세요 (선택사항)"
                                  className="w-full px-3 py-1.5 text-xs bg-amber-50 border border-amber-200 rounded-lg text-slate-900 placeholder:text-amber-700/50 focus:bg-amber-50/70 focus:outline-none focus:ring-2 focus:ring-amber-500/20 focus:border-amber-400 transition-colors"
                                />
                              </div>

                              {/* Row Action Buttons */}
                              <div className="md:col-span-2 flex items-center justify-end gap-1.5 md:pt-5">
                                <button
                                  type="button"
                                  onClick={() =>
                                    duplicateDateRow(originalIndex)
                                  }
                                  title="같은 날짜에 다른 장소 예배 추가"
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 bg-slate-100 hover:bg-slate-200 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  <Plus className="w-3.5 h-3.5" />
                                  <span>추가</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() =>
                                    handleCopySingleRow(entry, originalIndex)
                                  }
                                  title="이 줄만 복사"
                                  className="inline-flex items-center gap-1 px-2 py-1.5 text-xs font-medium text-slate-700 bg-white border border-slate-200 hover:bg-slate-100 rounded-lg transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                                >
                                  {copiedRowId === entry.id ? (
                                    <Check className="w-3.5 h-3.5 text-emerald-600" />
                                  ) : (
                                    <Copy className="w-3.5 h-3.5 text-slate-500" />
                                  )}
                                  <span>복사</span>
                                </button>

                                <button
                                  type="button"
                                  onClick={() => removeRow(entry.id)}
                                  title="이 행 삭제"
                                  aria-label="행 삭제"
                                  className="p-1.5 text-slate-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors shrink-0 cursor-pointer"
                                >
                                  <Trash2 className="w-4 h-4" />
                                </button>
                              </div>
                            </div>

                            {/* Live Inline Formatted Preview Line */}
                            <div className="mt-2.5 pt-2 border-t border-slate-100 flex items-center justify-between gap-2 text-xs text-slate-500 font-mono-tabular">
                              <span
                                className="truncate"
                                title={`${originalIndex + 1}. ${formattedLine}`}
                              >
                                {originalIndex + 1}. {formattedLine}
                              </span>
                              <span className="shrink-0 text-[11px] text-slate-400">
                                {filled ? '작성됨' : '미작성'}
                              </span>
                            </div>
                          </div>
                        );
                      })}
                    </div>
                  )}

                  {/* Bottom Add Row Footer with Starting Date Calendar Picker & Auto-Next Worship Day */}
                  <div className="p-3.5 bg-slate-50 border-t border-slate-200 rounded-b-xl flex flex-col sm:flex-row sm:items-center justify-between gap-3">
                    <div className="text-xs text-slate-500">
                      <span>
                        달력에서 시작 날짜를 한 번 선택하면, 이후{' '}
                        <strong className="font-semibold text-slate-700">
                          + 하단에 예배 행 추가
                        </strong>
                        를 누를 때마다 다음 예배일(삼일·주일)로 자동 넘어갑니다.
                      </span>
                    </div>

                    <div className="flex items-center gap-2 shrink-0 self-end sm:self-auto">
                      {/* Bottom Date Picker Trigger */}
                      <div className="relative">
                        <button
                          type="button"
                          onClick={() =>
                            setOpenCalendarRowId((prev) =>
                              prev === 'bottom-next-date'
                                ? null
                                : 'bottom-next-date'
                            )
                          }
                          aria-expanded={
                            openCalendarRowId === 'bottom-next-date'
                          }
                          title="추가할 시작 날짜(삼일 또는 주일)를 달력에서 선택하세요"
                          className={`inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold font-mono-tabular bg-white border rounded-lg hover:bg-slate-100 transition-colors cursor-pointer whitespace-nowrap ${
                            openCalendarRowId === 'bottom-next-date'
                              ? 'border-slate-900 ring-2 ring-slate-900/15'
                              : 'border-slate-300 text-slate-800'
                          }`}
                        >
                          <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                          <span>
                            추가할 날짜:{' '}
                            {String(nextBottomDate.month).padStart(2, '0')}월{' '}
                            {String(nextBottomDate.day).padStart(2, '0')}일 (
                            {nextBottomDate.worshipType})
                          </span>
                          <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                        </button>

                        {openCalendarRowId === 'bottom-next-date' && (
                          <DateCalendarPopover
                            year={nextBottomDate.year}
                            month={nextBottomDate.month}
                            day={nextBottomDate.day}
                            align="right"
                            vertical="top"
                            onSelectDate={(y, m, d) => {
                              const dow = new Date(y, m - 1, d).getDay();
                              const wType: WorshipType =
                                dow === 0
                                  ? '주일'
                                  : dow === 3
                                    ? '삼일'
                                    : nextBottomDate.worshipType;
                              setNextBottomDate({
                                year: y,
                                month: m,
                                day: d,
                                worshipType: wType,
                              });
                              showToast(
                                `하단 추가 시작 날짜가 ${String(m).padStart(2, '0')}월 ${String(d).padStart(2, '0')}일(${wType})로 설정되었습니다.`
                              );
                            }}
                            onClose={() => setOpenCalendarRowId(null)}
                          />
                        )}
                      </div>

                      {/* Add Row Button */}
                      <button
                        type="button"
                        onClick={addCustomRowAtBottom}
                        className="inline-flex items-center gap-1.5 px-3.5 py-1.5 text-xs font-semibold text-white bg-slate-900 border border-slate-900 rounded-lg hover:bg-slate-800 transition-colors whitespace-nowrap shrink-0 cursor-pointer"
                      >
                        <Plus className="w-3.5 h-3.5" />
                        <span>하단에 예배 행 추가</span>
                      </button>
                    </div>
                  </div>
                </>
              )}
            </div>
          </div>

          {/* RIGHT COLUMN: Sticky Telegram Extraction Panel (4 cols on xl) */}
          <aside
            id="telegram-preview"
            className="xl:col-span-4 xl:sticky xl:top-20 space-y-4"
          >
            <div className="bg-white border border-slate-200 rounded-xl p-5">
              <div className="flex items-center justify-between gap-2 pb-3.5 border-b border-slate-200">
                <div>
                  <h2 className="font-display text-base font-bold text-slate-900">
                    텔레그램 추출 텍스트
                  </h2>
                  <p className="text-xs text-slate-500 mt-0.5">
                    선택한 시작날짜~끝날짜 사이의 예배만 추출됩니다.
                  </p>
                </div>
                <span className="font-mono-tabular text-xs font-semibold text-slate-600">
                  {extractedEntries.length}줄 추출됨
                </span>
              </div>

              {/* Date Range Selector for Telegram Extraction */}
              <div className="py-3.5 border-b border-slate-100 space-y-2">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-800">
                    추출 기간 선택 (시작날짜 ~ 끝날짜)
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      if (entries.length > 0) {
                        const sorted = [...entries].sort((a, b) => {
                          if (a.year !== b.year) return a.year - b.year;
                          if (a.month !== b.month) return a.month - b.month;
                          return a.day - b.day;
                        });
                        const first = sorted[0];
                        const last = sorted[sorted.length - 1];
                        setExtractStartDate({
                          year: first.year,
                          month: first.month,
                          day: first.day,
                        });
                        setExtractEndDate({
                          year: last.year,
                          month: last.month,
                          day: last.day,
                        });
                        showToast('전체 예배 일정 기간으로 설정했습니다.');
                      } else {
                        const lastDay = new Date(
                          selectedYear,
                          selectedMonth,
                          0
                        ).getDate();
                        setExtractStartDate({
                          year: selectedYear,
                          month: selectedMonth,
                          day: 1,
                        });
                        setExtractEndDate({
                          year: selectedYear,
                          month: selectedMonth,
                          day: lastDay,
                        });
                        showToast(
                          `${selectedMonth}월 전체 기간(01일~${lastDay}일)으로 설정했습니다.`
                        );
                      }
                    }}
                    className="text-[11px] font-medium text-slate-500 hover:text-slate-900 underline underline-offset-2 cursor-pointer"
                  >
                    전체 일정 선택
                  </button>
                </div>

                <div className="grid grid-cols-2 gap-2 items-center">
                  {/* Start Date Picker Dropdown */}
                  <div className="relative">
                    <span className="block text-[11px] text-slate-500 mb-1">
                      시작날짜
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCalendarRowId((prev) =>
                          prev === 'extract-start' ? null : 'extract-start'
                        )
                      }
                      aria-expanded={openCalendarRowId === 'extract-start'}
                      className={`w-full flex items-center justify-between gap-1.5 bg-slate-50 border rounded-lg px-2.5 py-1.5 font-mono-tabular text-xs font-semibold text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer ${
                        openCalendarRowId === 'extract-start'
                          ? 'border-slate-900 ring-2 ring-slate-900/15 bg-white'
                          : 'border-slate-200'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>
                          {String(extractStartDate.month).padStart(2, '0')}월{' '}
                          {String(extractStartDate.day).padStart(2, '0')}일
                        </span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>

                    {openCalendarRowId === 'extract-start' && (
                      <DateCalendarPopover
                        year={extractStartDate.year}
                        month={extractStartDate.month}
                        day={extractStartDate.day}
                        align="left"
                        onSelectDate={(y, m, d) => {
                          setExtractStartDate({ year: y, month: m, day: d });
                          const newStartNum = y * 10000 + m * 100 + d;
                          const currEndNum =
                            extractEndDate.year * 10000 +
                            extractEndDate.month * 100 +
                            extractEndDate.day;
                          if (newStartNum > currEndNum) {
                            setExtractEndDate({ year: y, month: m, day: d });
                          }
                          showToast(
                            `추출 시작날짜가 ${String(m).padStart(2, '0')}월 ${String(d).padStart(2, '0')}일로 변경되었습니다.`
                          );
                        }}
                        onClose={() => setOpenCalendarRowId(null)}
                      />
                    )}
                  </div>

                  {/* End Date Picker Dropdown */}
                  <div className="relative">
                    <span className="block text-[11px] text-slate-500 mb-1">
                      끝날짜
                    </span>
                    <button
                      type="button"
                      onClick={() =>
                        setOpenCalendarRowId((prev) =>
                          prev === 'extract-end' ? null : 'extract-end'
                        )
                      }
                      aria-expanded={openCalendarRowId === 'extract-end'}
                      className={`w-full flex items-center justify-between gap-1.5 bg-slate-50 border rounded-lg px-2.5 py-1.5 font-mono-tabular text-xs font-semibold text-slate-900 hover:bg-slate-100 transition-colors cursor-pointer ${
                        openCalendarRowId === 'extract-end'
                          ? 'border-slate-900 ring-2 ring-slate-900/15 bg-white'
                          : 'border-slate-200'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Calendar className="w-3.5 h-3.5 text-slate-500 shrink-0" />
                        <span>
                          {String(extractEndDate.month).padStart(2, '0')}월{' '}
                          {String(extractEndDate.day).padStart(2, '0')}일
                        </span>
                      </span>
                      <ChevronDown className="w-3.5 h-3.5 text-slate-400 shrink-0" />
                    </button>

                    {openCalendarRowId === 'extract-end' && (
                      <DateCalendarPopover
                        year={extractEndDate.year}
                        month={extractEndDate.month}
                        day={extractEndDate.day}
                        align="right"
                        onSelectDate={(y, m, d) => {
                          setExtractEndDate({ year: y, month: m, day: d });
                          const newEndNum = y * 10000 + m * 100 + d;
                          const currStartNum =
                            extractStartDate.year * 10000 +
                            extractStartDate.month * 100 +
                            extractStartDate.day;
                          if (newEndNum < currStartNum) {
                            setExtractStartDate({ year: y, month: m, day: d });
                          }
                          showToast(
                            `추출 끝날짜가 ${String(m).padStart(2, '0')}월 ${String(d).padStart(2, '0')}일로 변경되었습니다.`
                          );
                        }}
                        onClose={() => setOpenCalendarRowId(null)}
                      />
                    )}
                  </div>
                </div>
              </div>

              {/* Extraction Controls */}
              <div className="py-3 border-b border-slate-100 space-y-2.5">
                <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <span>작성된 예배 행만 추출 (빈 행 제외)</span>
                  <input
                    type="checkbox"
                    checked={onlyFilledRows}
                    onChange={(e) => setOnlyFilledRows(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                </label>

                <label className="flex items-center justify-between gap-2 text-xs text-slate-700 cursor-pointer select-none">
                  <span>항목 사이 한 줄 띄우기 (예시 양식)</span>
                  <input
                    type="checkbox"
                    checked={doubleLineBreak}
                    onChange={(e) => setDoubleLineBreak(e.target.checked)}
                    className="rounded border-slate-300 text-slate-900 focus:ring-slate-900 cursor-pointer"
                  />
                </label>
              </div>

              {/* Extracted Textarea Box */}
              <div className="mt-3.5">
                <div className="flex items-center justify-between text-xs text-slate-500 mb-1.5">
                  <span>
                    {String(extractStartDate.month).padStart(2, '0')}월{' '}
                    {String(extractStartDate.day).padStart(2, '0')}일 ~{' '}
                    {String(extractEndDate.month).padStart(2, '0')}월{' '}
                    {String(extractEndDate.day).padStart(2, '0')}일 추출 결과
                  </span>
                </div>
                <textarea
                  readOnly
                  aria-label="텔레그램 추출 결과 텍스트"
                  value={
                    telegramOutputText ||
                    '선택하신 기간(시작날짜 ~ 끝날짜) 내에 해당하는 예배 기록이 없습니다.\n추출 기간을 조정하거나 좌측에서 예배 기록을 입력해 주세요.'
                  }
                  rows={12}
                  onClick={(e) => e.currentTarget.select()}
                  className="w-full p-3.5 text-xs leading-relaxed font-mono-tabular bg-slate-900 text-slate-100 rounded-lg border border-slate-800 focus:outline-none focus:ring-2 focus:ring-slate-700 resize-y"
                />
              </div>

              {/* Primary Copy CTA Button */}
              <div className="mt-4">
                <button
                  type="button"
                  onClick={handleCopyAll}
                  className="w-full flex items-center justify-center gap-2 py-2.5 px-4 text-sm font-semibold text-white bg-slate-900 hover:bg-slate-800 rounded-lg transition-colors cursor-pointer"
                >
                  {copiedAll ? (
                    <>
                      <Check className="w-4 h-4 text-emerald-400" />
                      <span>클립보드에 복사되었습니다! (텔레그램에 붙여넣기)</span>
                    </>
                  ) : (
                    <>
                      <Copy className="w-4 h-4" />
                      <span>텔레그램 텍스트 전체 복사하기</span>
                    </>
                  )}
                </button>
              </div>
            </div>

            {/* Format Specification Reference Card */}
            <div
              id="format-guide"
              className="bg-white border border-slate-200 rounded-xl p-5 space-y-3"
            >
              <div className="flex items-center gap-2 text-xs font-semibold text-slate-900">
                <FileText className="w-4 h-4 text-slate-500" />
                <span>텔레그램 추출 양식 규칙</span>
              </div>

              <div className="p-3 bg-slate-50 border border-slate-200 rounded-lg font-mono-tabular text-xs text-slate-800 break-all">
                ✅예배 일정
                <br />
                1. [장소] 날짜(삼일/주일) 설교주제 &#123;설교자&#125;/묵도:성구 [특이사항 : 내용]
              </div>

              <dl className="space-y-2 text-xs text-slate-600">
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-700 shrink-0">1. 설교장소</dt>
                  <dd className="text-right">
                    키토본부(기본) · 빌록시 · 푸힐리 · 오따발로 · 기타(직접입력)
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-700 shrink-0">2. 설교주제</dt>
                  <dd className="text-right">직접 입력 (미입력 시 분홍색 표시)</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-700 shrink-0">3. 설교자</dt>
                  <dd className="text-right">
                    김요안 · 지파장님영상 · 총회장님영상 · 특별영상 · 기타(직접입력)
                  </dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-700 shrink-0">4. 묵도성구</dt>
                  <dd className="text-right">기록한 성경구절 그대로 반영</dd>
                </div>
                <div className="flex justify-between gap-2">
                  <dt className="font-medium text-slate-700 shrink-0">5. 특이사항</dt>
                  <dd className="text-right">
                    연한 노란색 칸 · 입력 시에만 [특이사항 : 내용] 추가
                  </dd>
                </div>
              </dl>
            </div>
          </aside>
        </div>
      </main>

      {/* Quiet Footer */}
      <footer className="mt-12 border-t border-slate-200 bg-white py-4 px-6">
        <div className="max-w-[1440px] mx-auto flex flex-col sm:flex-row items-center justify-between gap-2 text-xs text-slate-500">
          <span>예배계획 매니저</span>
          <span>작성 내용은 현재 브라우저에 자동 저장됩니다</span>
        </div>
      </footer>

      {/* Toast Notification */}
      {toastMessage && (
        <div
          role="status"
          aria-live="polite"
          className="fixed bottom-5 right-5 z-50 flex items-center gap-2 px-4 py-2.5 text-xs font-medium text-white bg-slate-900 rounded-lg shadow-lg"
        >
          <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
          <span>{toastMessage}</span>
        </div>
      )}
    </div>
  );
}
