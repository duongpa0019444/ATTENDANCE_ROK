import { apiFetch } from './api';
import { format, parseISO, addDays } from 'date-fns';

export interface WeekBoundary {
  is_custom: boolean;
  name?: string | null;
  rule_id?: string;
  custom_period_id?: string;
  start_date: string; // YYYY-MM-DD
  start_time: string; // HH:mm
  end_date: string;   // YYYY-MM-DD
  end_time: string;   // HH:mm
  total_days: number;
  start_day_of_week?: number; // 0-6
  label: string;
}

const DAY_SHORT_NAMES = ['CN', 'Thứ 2', 'Thứ 3', 'Thứ 4', 'Thứ 5', 'Thứ 6', 'Thứ 7'];

export function getDayShortName(date: Date): string {
  return DAY_SHORT_NAMES[date.getDay()] || '';
}

export async function fetchWeekBoundary(dateInput?: Date | string): Promise<WeekBoundary | null> {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';
  try {
    let query = '';
    if (dateInput) {
      const dateStr = typeof dateInput === 'string' ? dateInput.split('T')[0] : format(dateInput, 'yyyy-MM-dd');
      query = `?date=${encodeURIComponent(dateStr)}`;
    }
    const res = await apiFetch(`${API_URL}/week-cycle/current${query}`);
    if (!res.ok) return null;
    return await res.json();
  } catch (err) {
    console.error('Failed to fetch week boundary:', err);
    return null;
  }
}

export async function fetchAdjacentWeekBoundary(
  currentBoundary: { start_date: string; end_date: string },
  offset: -1 | 1,
): Promise<WeekBoundary | null> {
  const targetDate =
    offset < 0
      ? addDays(parseISO(currentBoundary.start_date), -1)
      : addDays(parseISO(currentBoundary.end_date), 1);
  return fetchWeekBoundary(targetDate);
}
