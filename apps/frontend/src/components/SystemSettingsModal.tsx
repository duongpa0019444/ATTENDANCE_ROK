'use client';

import React, { useState, useEffect, useCallback, useMemo } from 'react';
import { X, Calendar, Clock, Bell, Plus, Trash2, CheckCircle2, AlertTriangle, Loader2, Save, ArrowRight, RotateCcw, Sparkles, ShieldAlert } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { apiFetch } from '@/lib/api';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { vi } from 'date-fns/locale';
import { format, parseISO, differenceInCalendarDays, addDays, getDay, isBefore, isSameDay } from 'date-fns';

registerLocale('vi', vi);

interface WeekCycleRule {
  id: string;
  start_day_of_week: number;
  start_time: string;
  end_time: string;
  effective_date: string;
  created_at: string;
  can_delete?: boolean;
  delete_block_reason?: string | null;
}

interface CustomWeekPeriod {
  id: string;
  name?: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  total_days: number;
  can_delete?: boolean;
  delete_block_reason?: string | null;
}

interface CurrentCycleInfo {
  is_custom: boolean;
  name?: string | null;
  start_date: string;
  start_time: string;
  end_date: string;
  end_time: string;
  total_days: number;
  start_day_of_week?: number;
  label: string;
}

interface SystemSettingsModalProps {
  isOpen: boolean;
  onClose: () => void;
  initialTab?: 'week-cycle' | 'telegram';
  onWeekCycleUpdated?: () => void;
}

const DAY_NAMES = ['Chủ Nhật', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export default function SystemSettingsModal({
  isOpen,
  onClose,
  initialTab = 'week-cycle',
  onWeekCycleUpdated,
}: SystemSettingsModalProps) {
  const [visible, setVisible] = useState(false);
  const [mounted, setMounted] = useState(false);
  const [activeTab, setActiveTab] = useState<'week-cycle' | 'telegram'>(initialTab);

  // Week Cycle Data from Backend
  const [rules, setRules] = useState<WeekCycleRule[]>([]);
  const [customPeriods, setCustomPeriods] = useState<CustomWeekPeriod[]>([]);
  const [currentCycle, setCurrentCycle] = useState<CurrentCycleInfo | null>(null);
  const [fullyBookedDates, setFullyBookedDates] = useState<string[]>([]);
  const [minStartTimeByDate, setMinStartTimeByDate] = useState<Record<string, string>>({});
  const [loadingCycle, setLoadingCycle] = useState(false);

  // Unified Form State: "Thiết lập kỳ tuần / Đổi lịch nối tuần"
  const [startDate, setStartDate] = useState<Date>(new Date());
  const [startTime, setStartTime] = useState<string>('07:00');
  const [endDate, setEndDate] = useState<Date>(() => addDays(new Date(), 4));
  const [endTime, setEndTime] = useState<string>('06:59');

  // Option: From the end of this period, repeat 7-day cycles starting from this new day
  const [repeatNewCycleAfter, setRepeatNewCycleAfter] = useState<boolean>(true);

  const [savingSchedule, setSavingSchedule] = useState(false);
  const [scheduleMessage, setScheduleMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  // Tab 2: Telegram & Alert Settings State (synced with /api/settings)
  const [reminderMinutes, setReminderMinutes] = useState<number>(10);
  const [preparationMinutes, setPreparationMinutes] = useState<number>(0);
  const [unconfirmedWarningMinutes, setUnconfirmedWarningMinutes] = useState<number>(5);
  const [fullSettingsSnapshot, setFullSettingsSnapshot] = useState<any>({});
  const [savingTelegram, setSavingTelegram] = useState(false);
  const [telegramMessage, setTelegramMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  // Smooth slide-in / slide-out animation control
  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const timer = setTimeout(() => setVisible(true), 20);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => setMounted(false), 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = () => {
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 280);
  };

  // Load Settings
  const loadWeekCycleData = useCallback(async () => {
    try {
      setLoadingCycle(true);
      const res = await apiFetch(`${API_URL}/week-cycle/config`);
      if (res.ok) {
        const data = await res.json();
        const activeCycle: CurrentCycleInfo | null = data.current || data.current_cycle || null;
        const periods: CustomWeekPeriod[] = data.custom_periods || [];
        const bookedDates: string[] = data.fully_booked_dates || [];
        const minTimes: Record<string, string> = data.min_start_time_by_date || {};
        setRules(data.rules || []);
        setCustomPeriods(periods);
        setCurrentCycle(activeCycle);
        setFullyBookedDates(bookedDates);
        setMinStartTimeByDate(minTimes);

        if (activeCycle) {
          if (activeCycle.start_time) setStartTime(activeCycle.start_time);
          if (activeCycle.end_time) setEndTime(activeCycle.end_time);

          // Find earliest available date starting from activeCycle.start_date,
          // skipping over fully booked dates AND already-configured CustomWeekPeriods
          const [sy, sm, sd] = activeCycle.start_date.split('-').map(Number);
          let candidate = new Date(sy, sm - 1, sd);
          for (let guard = 0; guard < 90; guard++) {
            const candStr = format(candidate, 'yyyy-MM-dd');
            const isBooked = bookedDates.includes(candStr);
            const matchedPeriod = periods.find((p) => {
              const pStart = p.start_date.split('T')[0];
              const pEnd = p.end_date.split('T')[0];
              return candStr >= pStart && candStr < pEnd;
            });
            if (matchedPeriod) {
              const [py, pm, pd] = matchedPeriod.end_date.split('T')[0].split('-').map(Number);
              candidate = new Date(py, pm - 1, pd);
              continue;
            }
            if (isBooked) {
              candidate = addDays(candidate, 1);
              continue;
            }
            break;
          }
          setStartDate(candidate);
          setEndDate(addDays(candidate, 4));
          const candStr = format(candidate, 'yyyy-MM-dd');
          if (minTimes[candStr]) {
            setStartTime(minTimes[candStr]);
          }
        }
      }
    } catch (err) {
      console.error('Error loading week cycle:', err);
    } finally {
      setLoadingCycle(false);
    }
  }, [API_URL]);

  const loadTelegramSettings = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_URL}/api/settings`);
      if (res.ok) {
        const data = await res.json();
        setFullSettingsSnapshot(data || {});
        if (data.reminderMinutes !== undefined) setReminderMinutes(data.reminderMinutes);
        if (data.preparationMinutes !== undefined) setPreparationMinutes(data.preparationMinutes);
        if (data.unconfirmedWarningMinutes !== undefined) setUnconfirmedWarningMinutes(data.unconfirmedWarningMinutes);
      }
    } catch (err) {
      console.error('Error loading operations settings:', err);
    }
  }, [API_URL]);

  useEffect(() => {
    if (isOpen) {
      setActiveTab(initialTab);
      loadWeekCycleData();
      loadTelegramSettings();
      setScheduleMessage(null);
      setTelegramMessage(null);
    }
  }, [isOpen, initialTab, loadWeekCycleData, loadTelegramSettings]);

  // Minimum allowed start date calculation:
  // Past weeks before the current active week are locked.
  // The current active week's start_date (e.g. Monday 23/11) IS selectable so Admin can cut the current week short (e.g. 23/11 -> 27/11).
  const minAllowedStartDate = useMemo(() => {
    if (!currentCycle) {
      const d = new Date();
      d.setHours(0, 0, 0, 0);
      return d;
    }
    const [y, m, d] = currentCycle.start_date.split('-').map(Number);
    return new Date(y, m - 1, d);
  }, [currentCycle]);

  // Excluded date intervals for existing CustomWeekPeriods (cannot overlap with another custom week)
  // Note: an existing period runs from start_date to end_date.
  // The end_date is the hand-off date (until 06:59), meaning a next period can START on that end_date at 07:00.
  // Therefore, inner days strictly between start_date and end_date - 1 day are completely blocked.
  const excludedDateIntervals = useMemo(() => {
    return customPeriods.map((p) => {
      const [sy, sm, sd] = p.start_date.split('T')[0].split('-').map(Number);
      const [ey, em, ed] = p.end_date.split('T')[0].split('-').map(Number);
      const start = new Date(sy, sm - 1, sd);
      const end = new Date(ey, em - 1, ed);
      // Exclude days [start, end - 1 day] so that 'end' date can still be picked as a new start_date to seamlessly connect!
      const excludeEnd = addDays(end, -1);
      return {
        start,
        end: excludeEnd >= start ? excludeEnd : start,
      };
    });
  }, [customPeriods]);

  // Check if a date falls strictly inside an existing custom period OR is already fully booked with shifts
  // Always allow currentCycle.start_date so Admin can cut the currently running week short (e.g. 23/11 -> 27/11)
  const isDateInExistingCustomPeriod = useCallback((date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    if (currentCycle && dateStr === currentCycle.start_date) {
      return excludedDateIntervals.some(
        (interval) => date >= interval.start && date <= interval.end
      );
    }
    if (fullyBookedDates.includes(dateStr)) {
      return true;
    }
    return excludedDateIntervals.some(
      (interval) => date >= interval.start && date <= interval.end
    );
  }, [excludedDateIntervals, fullyBookedDates, currentCycle]);

  // Check if selected startDate has a minimum allowed start time (due to scheduled shifts, custom period handoff, or cycle boundary)
  const boundaryEndTime = useMemo(() => {
    const startStr = format(startDate, 'yyyy-MM-dd');
    const candidates: string[] = [];

    if (currentCycle && startStr === currentCycle.start_date) {
      candidates.push(currentCycle.start_time || '07:00');
    } else {
      if (minStartTimeByDate[startStr]) {
        candidates.push(minStartTimeByDate[startStr]);
      }
      const matchedCustom = customPeriods.find((p) => p.end_date.split('T')[0] === startStr);
      if (matchedCustom) {
        candidates.push(matchedCustom.end_time === '06:59' ? '07:00' : matchedCustom.end_time);
      }
      if (currentCycle && startStr === currentCycle.end_date) {
        candidates.push(currentCycle.start_time || '07:00');
      }
    }

    if (candidates.length === 0) return undefined;
    return candidates.sort().pop();
  }, [startDate, currentCycle, customPeriods, minStartTimeByDate]);

  const minAllowedStartTime = boundaryEndTime;

  // Whenever startDate changes, enforce that endDate is at least 1 day after
  const handleStartDateChange = (date: Date | null) => {
    if (!date) return;
    setStartDate(date);
    if (date >= endDate) {
      setEndDate(addDays(date, 4));
    }
    const startStr = format(date, 'yyyy-MM-dd');
    const candidates: string[] = [];
    if (currentCycle && startStr === currentCycle.start_date) {
      candidates.push(currentCycle.start_time || '07:00');
    } else {
      if (minStartTimeByDate[startStr]) candidates.push(minStartTimeByDate[startStr]);
      const matchedCustom = customPeriods.find((p) => p.end_date.split('T')[0] === startStr);
      if (matchedCustom) candidates.push(matchedCustom.end_time === '06:59' ? '07:00' : matchedCustom.end_time);
      if (currentCycle && startStr === currentCycle.end_date) {
        candidates.push(currentCycle.start_time || '07:00');
      }
    }
    const minT = candidates.sort().pop();
    if (minT && startTime < minT) {
      setStartTime(minT);
    }
  };

  const handleStartTimeChange = (newTime: string) => {
    setStartTime(newTime);
    setScheduleMessage(null);
  };

  const handleStartTimeBlur = () => {
    if (minAllowedStartTime && startTime && startTime < minAllowedStartTime) {
      setScheduleMessage({
        type: 'error',
        text: `Ngày ${format(startDate, 'dd/MM/yyyy')} đã có ca trước đó, giờ bắt đầu phải từ ${minAllowedStartTime} trở đi.`,
      });
      setStartTime(minAllowedStartTime);
    }
  };

  // Live Calculation: Number of days in the chosen period
  const totalDays = differenceInCalendarDays(endDate, startDate);

  // Day of week of the end date (which becomes the start of the next cycle)
  const nextCycleDayOfWeek = getDay(endDate); // 0 = Chủ Nhật, 1 = T2, 5 = T6, etc.
  const nextCycleDayName = DAY_NAMES[nextCycleDayOfWeek];

  // Quick Preset Helper: Set 4-day, 7-day or custom
  const applyPresetDays = (days: number) => {
    setEndDate(addDays(startDate, days));
  };

  // Submit Unified Setup: Creates custom period AND (optionally) sets repeating standard rule seamlessly
  const handleSaveSchedule = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingSchedule(true);
    setScheduleMessage(null);

    const startStr = format(startDate, 'yyyy-MM-dd');
    const endStr = format(endDate, 'yyyy-MM-dd');

    if (startDate >= endDate) {
      setScheduleMessage({ type: 'error', text: 'Ngày kết thúc phải lớn hơn ngày bắt đầu.' });
      setSavingSchedule(false);
      return;
    }

    if (minAllowedStartTime && startTime < minAllowedStartTime) {
      setScheduleMessage({
        type: 'error',
        text: `Giờ bắt đầu không được nhỏ hơn ${minAllowedStartTime} trên ngày bắt đầu chu kỳ.`,
      });
      setSavingSchedule(false);
      return;
    }

    try {
      // 1. Create Custom Week Period for this transition
      const periodPayload = {
        name: `Tuần ${totalDays} ngày (${format(startDate, 'dd/MM')} - ${format(endDate, 'dd/MM')})`,
        start_date: startStr,
        start_time: startTime,
        end_date: endStr,
        end_time: endTime,
      };

      const resPeriod = await apiFetch(`${API_URL}/week-cycle/custom-period`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(periodPayload),
      });

      const dataPeriod = await resPeriod.json();
      if (!resPeriod.ok) {
        throw new Error(dataPeriod.message || 'Lỗi khi lưu chu kỳ tuần.');
      }

      // 2. If user checked "Repeat 7-day cycle starting from end date", register the rule starting on endDate!
      if (repeatNewCycleAfter) {
        const rulePayload = {
          start_day_of_week: nextCycleDayOfWeek,
          start_time: startTime,
          end_time: endTime,
          effective_date: endStr,
        };

        const resRule = await apiFetch(`${API_URL}/week-cycle/rule`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify(rulePayload),
        });

        if (!resRule.ok) {
          const dataRule = await resRule.json();
          throw new Error(dataRule.message || 'Lỗi khi nối chu kỳ lặp lại tuần tiếp theo.');
        }
      }

      setScheduleMessage({
        type: 'success',
        text: repeatNewCycleAfter
          ? `Đã thiết lập tuần [${totalDays} ngày] và tự động nối chu kỳ 7 ngày tiếp theo bắt đầu từ ${nextCycleDayName} (${endStr})!`
          : `Đã thiết lập tuần tùy chỉnh [${totalDays} ngày] (${startStr} → ${endStr}) thành công!`,
      });

      await loadWeekCycleData();
      onWeekCycleUpdated?.();
    } catch (err: any) {
      setScheduleMessage({ type: 'error', text: err.message || 'Lỗi khi lưu cấu hình.' });
    } finally {
      setSavingSchedule(false);
    }
  };

  // Delete Custom Period
  const handleDeleteCustomPeriod = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa chu kỳ này? Lịch sẽ trở về theo quy tắc mặc định.')) {
      return;
    }
    try {
      const res = await apiFetch(`${API_URL}/week-cycle/custom-period/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Lỗi khi xóa.');
      }
      await loadWeekCycleData();
      onWeekCycleUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Lỗi xóa chu kỳ tuần');
    }
  };

  // Delete Week Cycle Rule
  const handleDeleteRule = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa quy tắc chu kỳ lặp lại này?')) {
      return;
    }
    try {
      const res = await apiFetch(`${API_URL}/week-cycle/rule/${id}`, {
        method: 'DELETE',
      });
      if (!res.ok) {
        const data = await res.json();
        throw new Error(data.message || 'Lỗi khi xóa quy tắc.');
      }
      await loadWeekCycleData();
      onWeekCycleUpdated?.();
    } catch (err: any) {
      alert(err.message || 'Lỗi xóa quy tắc chu kỳ');
    }
  };

  // Save Telegram Settings
  const handleSaveTelegram = async (e: React.FormEvent) => {
    e.preventDefault();
    setSavingTelegram(true);
    setTelegramMessage(null);
    try {
      const payload = {
        ...fullSettingsSnapshot,
        reminderMinutes: Number(reminderMinutes),
        preparationMinutes: Number(preparationMinutes),
        unconfirmedWarningMinutes: Number(unconfirmedWarningMinutes),
      };
      const res = await apiFetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(payload),
      });
      const data = await res.json();
      if (!res.ok) {
        throw new Error(data.message || 'Lỗi khi lưu cấu hình thông báo');
      }
      setFullSettingsSnapshot(payload);
      window.dispatchEvent(new CustomEvent('operations-settings-updated'));
      setTelegramMessage({ type: 'success', text: 'Cập nhật cấu hình thông báo Telegram thành công!' });
    } catch (err: any) {
      setTelegramMessage({ type: 'error', text: err.message || 'Lỗi khi lưu' });
    } finally {
      setSavingTelegram(false);
    }
  };

  if (!mounted && !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden font-sans">
      {/* Backdrop with smooth fade transition */}
      <div
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />

      {/* Drawer Panel - Smooth Slide-in from right */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10 pointer-events-none">
        <div
          className={`pointer-events-auto w-screen max-w-xl sm:max-w-2xl bg-slate-950 border-l border-slate-800 text-slate-100 flex flex-col shadow-2xl relative transform transition-transform duration-300 ease-out will-change-transform ${
            visible ? 'translate-x-0' : 'translate-x-full'
          }`}
        >
          {/* Top Decorative Gradient Accent Line */}
          <div className="h-[2px] bg-gradient-to-r from-cyan-500 via-sky-500 to-indigo-500 w-full" />

          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-3">
              <div className="p-2 rounded-xl bg-cyan-500/10 border border-cyan-500/20 text-cyan-400">
                <Calendar className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 tracking-wide uppercase flex items-center gap-2">
                  CẤU HÌNH HỆ THỐNG
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    SETTINGS
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Thiết lập lộ trình chu kỳ tuần linh hoạt & thông báo ca làm việc
                </p>
              </div>
            </div>

            <button
              onClick={handleClose}
              className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
              title="Đóng (Esc)"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Tab Switcher */}
          <div className="flex border-b border-slate-800 bg-slate-900/70 px-4 sm:px-5 pt-1.5">
            <button
              onClick={() => setActiveTab('week-cycle')}
              className={`py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'week-cycle'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Calendar className="w-3.5 h-3.5" />
              <span>Lộ Trình Chu Kỳ Tuần</span>
            </button>
            <button
              onClick={() => setActiveTab('telegram')}
              className={`py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                activeTab === 'telegram'
                  ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                  : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
              }`}
            >
              <Bell className="w-3.5 h-3.5" />
              <span>Nhắc Ca & Telegram</span>
            </button>
          </div>

          {/* Drawer Body Area */}
          <div className="flex-1 overflow-y-auto p-4 sm:p-6 space-y-6">
            {activeTab === 'week-cycle' && (
              <div className="space-y-5">
                {/* Current Active Week Banner */}
                {currentCycle && (
                  <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 flex items-start justify-between gap-3">
                    <div className="space-y-1.5">
                      <div className="flex items-center gap-2">
                        <span className="text-[10px] font-mono uppercase tracking-wider px-2 py-0.5 rounded bg-cyan-100 dark:bg-cyan-500/20 text-cyan-700 dark:text-cyan-300 border border-cyan-300 dark:border-cyan-500/30 font-bold">
                          Chu kỳ tuần hiện tại
                        </span>
                        {currentCycle.name && (
                          <span className="text-xs font-bold text-slate-800 dark:text-slate-200">[{currentCycle.name}]</span>
                        )}
                      </div>
                      <div className="text-xs text-slate-700 dark:text-slate-300">
                        Thời gian: <span className="text-cyan-700 dark:text-cyan-400 font-mono font-bold">{currentCycle.start_date} ({currentCycle.start_time})</span> → <span className="text-cyan-700 dark:text-cyan-400 font-mono font-bold">{currentCycle.end_date} ({currentCycle.end_time})</span>
                      </div>
                      <div className="text-[11px] text-slate-600 dark:text-slate-400">
                        Thời lượng: <strong className="text-slate-900 dark:text-slate-200">{currentCycle.total_days} ngày</strong> ({currentCycle.label})
                      </div>
                    </div>
                  </div>
                )}

                {/* Unified Schedule Form */}
                <form onSubmit={handleSaveSchedule} className="space-y-4 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-800/80">
                  <div className="flex items-center justify-between pb-2 border-b border-slate-800/80">
                    <div className="text-xs font-bold text-slate-200 uppercase tracking-wide flex items-center gap-1.5">
                      <Clock className="w-3.5 h-3.5 text-cyan-400" />
                      Thiết Lập Chu Kỳ / Đổi Lịch Nối Tuần
                    </div>
                    {/* Preset Buttons */}
                    <div className="flex items-center gap-1.5">
                      <span className="text-[10px] text-slate-500">Mẫu:</span>
                      <button
                        type="button"
                        onClick={() => applyPresetDays(4)}
                        className="px-2 py-0.5 text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                      >
                        4 ngày
                      </button>
                      <button
                        type="button"
                        onClick={() => applyPresetDays(7)}
                        className="px-2 py-0.5 text-[10px] rounded bg-slate-800 hover:bg-slate-700 text-slate-300 border border-slate-700 transition-colors cursor-pointer"
                      >
                        7 ngày
                      </button>
                    </div>
                  </div>

                  {/* Date Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between min-h-[18px]">
                        <span>Bắt đầu từ ngày ({DAY_NAMES[getDay(startDate)]})</span>
                        <span className="text-[10px] text-slate-500 font-mono">
                          Tối thiểu: {format(minAllowedStartDate, 'dd/MM')}
                        </span>
                      </label>
                      <DatePicker
                        selected={startDate}
                        onChange={handleStartDateChange}
                        minDate={minAllowedStartDate}
                        excludeDateIntervals={excludedDateIntervals}
                        filterDate={(date) => !isDateInExistingCustomPeriod(date)}
                        dateFormat="dd/MM/yyyy"
                        locale="vi"
                        wrapperClassName="w-full"
                        className="w-full h-9 px-3 bg-slate-950/60 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono cursor-pointer"
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between min-h-[18px]">
                        <span>Đến hết ngày ({DAY_NAMES[getDay(endDate)]})</span>
                        <span className="text-[10px] text-cyan-500 dark:text-cyan-400 font-mono">
                          Sau ngày bắt đầu
                        </span>
                      </label>
                      <DatePicker
                        selected={endDate}
                        onChange={(date: Date | null) => date && setEndDate(date)}
                        minDate={addDays(startDate, 1)}
                        excludeDateIntervals={excludedDateIntervals}
                        dateFormat="dd/MM/yyyy"
                        locale="vi"
                        wrapperClassName="w-full"
                        className="w-full h-9 px-3 bg-slate-950/60 border border-slate-800 rounded-md text-xs text-slate-200 focus:outline-none focus:border-cyan-500 font-mono cursor-pointer"
                      />
                    </div>
                  </div>

                  {/* Time Selection */}
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between min-h-[18px]">
                        <span>Giờ bắt đầu ca đầu</span>
                        {minAllowedStartTime && (
                          <span className="text-[10px] text-amber-600 dark:text-amber-400 font-mono font-semibold">
                            ≥ {minAllowedStartTime}
                          </span>
                        )}
                      </label>
                      <Input
                        type="time"
                        value={startTime}
                        onChange={(e) => handleStartTimeChange(e.target.value)}
                        onBlur={handleStartTimeBlur}
                        required
                        className={`w-full h-9 px-3 rounded-md border-slate-800 text-xs font-mono transition-colors ${
                          minAllowedStartTime && startTime < minAllowedStartTime
                            ? 'bg-red-50 dark:bg-red-950/30 text-red-700 dark:text-red-300 border-red-400'
                            : 'bg-slate-950/60 text-slate-200'
                        }`}
                      />
                    </div>
                    <div className="space-y-1.5">
                      <label className="text-[11px] text-slate-300 font-medium flex items-center justify-between min-h-[18px]">
                        <span>Giờ kết thúc ca cuối</span>
                      </label>
                      <Input
                        type="time"
                        value={endTime}
                        onChange={(e) => setEndTime(e.target.value)}
                        required
                        className="w-full h-9 px-3 rounded-md bg-slate-950/60 border-slate-800 text-xs font-mono text-slate-200"
                      />
                    </div>
                  </div>

                  {/* Smart Timeline Helper & Seamless Connection Box */}
                  <div className="p-3 rounded-lg bg-slate-950/80 border border-slate-800/80 text-xs space-y-2.5 font-sans">
                    <div className="flex items-center justify-between text-slate-300">
                      <span>Thời lượng chu kỳ này:</span>
                      <strong className={`font-mono text-sm ${totalDays > 0 ? 'text-cyan-400 font-bold' : 'text-red-400'}`}>
                        {totalDays > 0 ? `${totalDays} ngày` : 'Ngày kết thúc phải sau ngày bắt đầu'}
                      </strong>
                    </div>

                    {totalDays > 0 && (
                      <div className="space-y-2 border-t border-slate-800/80 pt-2 text-[11px] leading-relaxed">
                        {/* Checkbox to seamlessly connect subsequent weeks */}
                        <label className="flex items-start gap-2 text-slate-200 cursor-pointer select-none">
                          <input
                            type="checkbox"
                            checked={repeatNewCycleAfter}
                            onChange={(e) => setRepeatNewCycleAfter(e.target.checked)}
                            className="mt-0.5 rounded border-slate-700 bg-slate-950 text-cyan-500 focus:ring-0 cursor-pointer"
                          />
                          <div>
                            <strong className="text-cyan-300">Tự động nối chu kỳ 7 ngày cho các tuần tiếp theo</strong>
                            <p className="text-slate-400 text-[10.5px]">
                              Từ ngày <strong className="text-slate-200">{format(endDate, 'dd/MM/yyyy')} ({nextCycleDayName})</strong> lúc <strong className="text-slate-200">{endTime === '06:59' ? '07:00' : endTime}</strong> trở đi, tất cả các tuần tiếp theo sẽ tự động lặp lại 7 ngày bắt đầu từ {nextCycleDayName}.
                            </p>
                          </div>
                        </label>
                      </div>
                    )}
                  </div>

                  {scheduleMessage && (
                    <div className={`p-3 rounded-lg text-xs font-medium border ${
                      scheduleMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}>
                      {scheduleMessage.text}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={savingSchedule || totalDays <= 0}
                      className="h-9 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 px-4 rounded-lg cursor-pointer transition-all active:scale-[0.98]"
                    >
                      {savingSchedule ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Lưu Lộ Trình Chu Kỳ Tuần
                    </Button>
                  </div>
                </form>

                {/* Timeline Roadmap of Configured Periods */}
                <div className="space-y-2.5 pt-1">
                  <div className="flex items-center justify-between">
                    <h4 className="text-[11px] font-bold text-slate-300 uppercase tracking-wider flex items-center gap-1.5">
                      <Sparkles className="w-3.5 h-3.5 text-cyan-400" />
                      Lộ Trình Các Chu Kỳ Đã Thiết Lập
                    </h4>
                    <span className="text-[10px] text-slate-500">Sắp xếp theo thứ tự áp dụng</span>
                  </div>

                  {/* Deletion condition notice for users */}
                  <div className="p-2.5 rounded-lg bg-amber-50 dark:bg-amber-950/30 border border-amber-200 dark:border-amber-800/40 text-[11px] text-amber-800 dark:text-amber-300 flex items-start gap-2 leading-relaxed">
                    <ShieldAlert className="w-4 h-4 shrink-0 mt-0.5 text-amber-600 dark:text-amber-400" />
                    <div>
                      <strong>Điều kiện để xóa một chu kỳ đã thiết lập:</strong>
                      <ul className="list-disc list-inside mt-0.5 space-y-0.5 text-[10.5px]">
                        <li>Chưa chốt sổ bảng lương (<code>LockedPeriod</code>).</li>
                        <li>Chưa có ca làm việc / phân công nhân sự nào phát sinh trong chu kỳ đó (ví dụ vừa setup nháp hoặc lỡ bấm nhầm mà chưa xếp ca).</li>
                      </ul>
                    </div>
                  </div>

                  <div className="space-y-2">
                    {/* List of Custom Periods */}
                    {customPeriods.map((p) => {
                      const canDelete = p.can_delete !== false;
                      return (
                        <div key={p.id} className="p-3 rounded-lg bg-slate-900/40 border border-slate-800 flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <div className="font-bold text-slate-200 flex items-center gap-2 flex-wrap">
                              <span>{p.name || 'Tuần chuyển tiếp'}</span>
                              <span className="text-[10px] px-1.5 py-0.5 rounded bg-cyan-100 dark:bg-cyan-950 text-cyan-800 dark:text-cyan-400 border border-cyan-300 dark:border-cyan-800/60 font-mono font-semibold">
                                {p.total_days} ngày
                              </span>
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              {p.start_date.split('T')[0]} ({p.start_time}) → {p.end_date.split('T')[0]} ({p.end_time})
                            </div>
                            {!canDelete && p.delete_block_reason && (
                              <div className="text-[10.5px] text-amber-600 dark:text-amber-400 mt-0.5">
                                🔒 {p.delete_block_reason}
                              </div>
                            )}
                          </div>
                          <button
                            onClick={() => {
                              if (!canDelete) {
                                alert(
                                  `${p.delete_block_reason || 'Không thể xóa chu kỳ này.'}\n\nĐể xóa được chu kỳ, cần đáp ứng đủ 2 điều kiện:\n1. Chưa chốt sổ bảng lương (LockedPeriod).\n2. Chưa có ca làm việc / phân công nhân sự nào phát sinh trong chu kỳ đó.`
                                );
                                return;
                              }
                              handleDeleteCustomPeriod(p.id);
                            }}
                            className={`p-1.5 rounded transition-colors shrink-0 ${
                              canDelete
                                ? 'text-red-500 hover:text-red-400 hover:bg-red-950/40 cursor-pointer'
                                : 'text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed'
                            }`}
                            title={canDelete ? 'Xóa chu kỳ này' : (p.delete_block_reason || 'Không thể xóa chu kỳ đã có dữ liệu')}
                          >
                            <Trash2 className="w-4 h-4" />
                          </button>
                        </div>
                      );
                    })}

                    {/* Standard Rules Timeline */}
                    {rules.map((r, idx) => {
                      const isBaseRule = idx === rules.length - 1;
                      const canDelete = !isBaseRule && r.can_delete !== false;
                      return (
                        <div key={r.id} className="p-3 rounded-lg bg-slate-900/20 border border-slate-800/60 flex items-center justify-between gap-3 text-xs">
                          <div className="space-y-0.5">
                            <div className="font-semibold text-slate-300 flex items-center gap-2 flex-wrap">
                              <span>Chu kỳ chuẩn định kỳ 7 ngày:</span>
                              <span className="text-cyan-400 font-bold">{DAY_NAMES[r.start_day_of_week]} hàng tuần</span>
                              {isBaseRule && (
                                <span className="text-[10px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 border border-slate-700 font-mono">
                                  Mặc định gốc
                                </span>
                              )}
                            </div>
                            <div className="text-[11px] text-slate-400 font-mono">
                              Giờ ca: {r.start_time} → {r.end_time} | Có hiệu lực từ: {r.effective_date.split('T')[0]}
                            </div>
                            {!isBaseRule && !canDelete && r.delete_block_reason && (
                              <div className="text-[10.5px] text-amber-600 dark:text-amber-400 mt-0.5">
                                🔒 {r.delete_block_reason}
                              </div>
                            )}
                          </div>
                          {!isBaseRule && (
                            <button
                              onClick={() => {
                                if (!canDelete) {
                                  alert(
                                    `${r.delete_block_reason || 'Không thể xóa quy tắc này.'}\n\nĐể xóa được chu kỳ, cần đáp ứng đủ 2 điều kiện:\n1. Chưa chốt sổ bảng lương (LockedPeriod).\n2. Chưa có ca làm việc / phân công nhân sự nào phát sinh trong chu kỳ đó.`
                                  );
                                  return;
                                }
                                handleDeleteRule(r.id);
                              }}
                              className={`p-1.5 rounded transition-colors shrink-0 ${
                                canDelete
                                  ? 'text-red-500 hover:text-red-400 hover:bg-red-950/40 cursor-pointer'
                                  : 'text-slate-400 dark:text-slate-600 opacity-50 cursor-not-allowed'
                              }`}
                              title={canDelete ? 'Xóa quy tắc chu kỳ này' : (r.delete_block_reason || 'Không thể xóa quy tắc đã có dữ liệu')}
                            >
                              <Trash2 className="w-4 h-4" />
                            </button>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'telegram' && (
              <div className="space-y-4">
                <form onSubmit={handleSaveTelegram} className="space-y-4">
                  <div className="p-3.5 rounded-xl bg-cyan-50 dark:bg-cyan-950/30 border border-cyan-200 dark:border-cyan-800/40 text-xs text-slate-700 dark:text-slate-300 space-y-1">
                    <div className="font-bold text-cyan-700 dark:text-cyan-400 flex items-center gap-1.5">
                      <Bell className="w-4 h-4" />
                      Cấu hình thời gian gửi nhắc ca & cảnh báo Admin
                    </div>
                    <p className="text-[11px] text-slate-600 dark:text-slate-400">
                      Hệ thống sẽ tự động quét ca làm việc và gửi thông báo nhắc nhở qua Telegram theo các mốc thời gian thiết lập dưới đây.
                    </p>
                  </div>

                  <div className="space-y-3 bg-slate-900/40 p-4 sm:p-5 rounded-xl border border-slate-800">
                    <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-300 font-medium">Nhắc ca trước (phút)</label>
                        <Input
                          type="number"
                          value={reminderMinutes === 0 ? '' : reminderMinutes}
                          onChange={(e) => setReminderMinutes(Number(e.target.value) || 0)}
                          required
                          min={1}
                          className="h-8 bg-slate-950/60 border-slate-800 text-xs font-mono text-slate-200"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[11px] text-slate-300 font-medium">Thời gian chuẩn bị trước (phút)</label>
                        <Input
                          type="number"
                          value={preparationMinutes === 0 ? '' : preparationMinutes}
                          onChange={(e) => setPreparationMinutes(Number(e.target.value) || 0)}
                          required
                          min={0}
                          className="h-8 bg-slate-950/60 border-slate-800 text-xs font-mono text-slate-200"
                        />
                      </div>
                    </div>

                    <div className="space-y-1">
                      <label className="text-[11px] text-slate-300 font-medium">Cảnh báo Admin khi chưa xác nhận (phút)</label>
                      <Input
                        type="number"
                        value={unconfirmedWarningMinutes === 0 ? '' : unconfirmedWarningMinutes}
                        onChange={(e) => setUnconfirmedWarningMinutes(Number(e.target.value) || 0)}
                        required
                        min={1}
                        className="h-8 bg-slate-950/60 border-slate-800 text-xs font-mono text-slate-200"
                      />
                    </div>

                    {/* Summary note */}
                    <div className="p-2.5 bg-slate-950/80 border border-slate-800 rounded text-[11px] text-slate-400 font-sans space-y-1 leading-relaxed">
                      <div>
                        • Nhân viên nhận tin nhắc chuẩn bị ca từ: <strong className="text-cyan-400">{reminderMinutes + preparationMinutes} phút</strong> trước ca.
                      </div>
                      <div>
                        • Admin nhận thông báo chờ xác nhận từ: <strong className="text-cyan-400">{unconfirmedWarningMinutes + preparationMinutes} phút</strong> trước ca.
                      </div>
                    </div>
                  </div>

                  {telegramMessage && (
                    <div className={`p-3 rounded-lg text-xs font-medium border ${
                      telegramMessage.type === 'success'
                        ? 'bg-emerald-50 dark:bg-emerald-950/40 border-emerald-300 dark:border-emerald-800 text-emerald-800 dark:text-emerald-300'
                        : 'bg-red-50 dark:bg-red-950/40 border-red-300 dark:border-red-800 text-red-700 dark:text-red-300'
                    }`}>
                      {telegramMessage.text}
                    </div>
                  )}

                  <div className="flex justify-end">
                    <Button
                      type="submit"
                      disabled={savingTelegram}
                      className="h-9 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold text-xs flex items-center gap-1.5 px-4 rounded-lg cursor-pointer transition-all active:scale-[0.98]"
                    >
                      {savingTelegram ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                      Lưu Cấu Hình Telegram
                    </Button>
                  </div>
                </form>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
