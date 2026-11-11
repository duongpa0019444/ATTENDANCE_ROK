'use client';
import { useEffect, useState, useCallback, useMemo } from 'react';
import { createPortal } from 'react-dom';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';
import { format, startOfMonth, parseISO } from 'date-fns';
import {
  Calendar, Download, Settings, Save,
  Server, Clock, Loader2, Sparkles, ArrowRight,
  Lock, Unlock, ShieldAlert, ChevronLeft, ChevronRight,
  Plus, Trash2, Edit2, Maximize2, Minimize2, Eye, Sliders, History, Pencil, Coins, Check,
  ArrowUpDown, ArrowUp, ArrowDown, Filter, RotateCcw, Search, X
} from 'lucide-react';
import PageHistoryDrawer from '@/components/PageHistoryDrawer';
import { toast } from '@/components/ui/toast';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { vi } from 'date-fns/locale';
import Select from 'react-select';

registerLocale('vi', vi);

const formatWeekDayLabel = (nameOfDay: string) => {
  const cleanName = nameOfDay.toLowerCase().trim();
  if (cleanName.includes('chủ nhật') || cleanName.includes('cn') || cleanName.includes('sun')) return 'CN';
  if (cleanName.includes('th 2') || cleanName.includes('t2') || cleanName.includes('2') || cleanName.includes('hai')) return 'T2';
  if (cleanName.includes('th 3') || cleanName.includes('t3') || cleanName.includes('3') || cleanName.includes('ba')) return 'T3';
  if (cleanName.includes('th 4') || cleanName.includes('t4') || cleanName.includes('4') || cleanName.includes('tư') || cleanName.includes('tu')) return 'T4';
  if (cleanName.includes('th 5') || cleanName.includes('t5') || cleanName.includes('5') || cleanName.includes('năm') || cleanName.includes('nam')) return 'T5';
  if (cleanName.includes('th 6') || cleanName.includes('t6') || cleanName.includes('6') || cleanName.includes('sáu') || cleanName.includes('sau')) return 'T6';
  if (cleanName.includes('th 7') || cleanName.includes('t7') || cleanName.includes('7') || cleanName.includes('bảy') || cleanName.includes('bay')) return 'T7';
  return nameOfDay;
};

const getMonday = (d: Date) => {
  const date = new Date(d);
  const day = date.getDay();
  const diff = date.getDate() - day + (day === 0 ? -6 : 1);
  const monday = new Date(date.setDate(diff));
  monday.setHours(0, 0, 0, 0);
  return monday;
};

const getNextMonday = (monday: Date) => {
  const nextMonday = new Date(monday);
  nextMonday.setDate(monday.getDate() + 7);
  nextMonday.setHours(0, 0, 0, 0);
  return nextMonday;
};



interface PayrollDetail {
  assignmentId: string;
  workDate: string;
  shiftName: string;
  serverName: string;
  startTime: string;
  endTime: string;
  baseSalary: number;
  nightBonus: number;
  weekendBonus: number;
  otherAllowance: number;
  shiftReward: number;
  totalSalary: number;
  isCompleted: boolean;
}

interface PayrollRecord {
  userId: string;
  username: string;
  fullName: string;
  role: string;
  totalShifts: number;
  completedShifts: number;
  absentShifts: number;
  totalBaseSalary: number;
  totalNightBonus: number;
  totalWeekendBonus: number;
  totalOtherAllowance: number;
  totalShiftReward: number;
  totalSalary: number;
  details: PayrollDetail[];
  customBaseSalary?: number | null;
  isCustomRate?: boolean;
  effectiveBaseRate?: number;
  adjustmentPercent?: number;
  totalAdjustment?: number;
  adjustmentNote?: string;
  fundPercent?: number;
  totalFundShared?: number;
}

interface PayrollAllowance {
  id: string;
  work_date: string;
  amount: number;
  note?: string | null;
}

const reactSelectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    backgroundColor: 'rgba(15, 23, 42, 0.4)',
    borderColor: state.isFocused ? '#22d3ee' : '#1e293b',
    minHeight: '38px',
    borderRadius: '6px',
    fontSize: '12px',
    boxShadow: state.isFocused ? '0 0 0 1px rgba(34, 211, 238, 0.5)' : 'none',
    overflow: 'visible',
    '&:hover': { borderColor: state.isFocused ? '#22d3ee' : '#334155' }
  }),
  valueContainer: (base: any) => ({
    ...base,
    paddingLeft: '12px',
    paddingRight: '12px',
    overflow: 'visible',
  }),
  input: (base: any) => ({
    ...base,
    color: 'white',
    margin: '0px',
    padding: '0px',
    paddingLeft: '4px',
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '6px',
    zIndex: 9999
  }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0891b2' : state.isFocused ? '#1e293b' : 'transparent',
    color: 'white',
    fontSize: '12px',
    cursor: 'pointer',
    '&:active': { backgroundColor: '#0e7490' }
  }),
  singleValue: (base: any) => ({
    ...base,
    color: 'white',
    overflow: 'visible',
    paddingLeft: '4px',
  }),
  placeholder: (base: any) => ({
    ...base,
    color: '#64748b',
    overflow: 'visible',
    paddingLeft: '4px',
  }),
  menuPortal: (base: any) => ({
    ...base,
    zIndex: 9999
  })
};

export default function PayrollPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const [filterMode, setFilterMode] = useState<'week' | 'custom'>('week');
  const [isHistoryOpen, setIsHistoryOpen] = useState(false);
  const [startDate, setStartDate] = useState<string>(() => {
    const mon = getMonday(new Date());
    return format(mon, 'yyyy-MM-dd');
  });
  const [endDate, setEndDate] = useState<string>(() => {
    const mon = getMonday(new Date());
    const nextMon = getNextMonday(mon);
    return format(nextMon, 'yyyy-MM-dd');
  });

  const handleWeekChange = (offset: number) => {
    const currentMon = parseISO(startDate);
    const newMon = new Date(currentMon);
    newMon.setDate(currentMon.getDate() + offset * 7);
    const newNextMon = getNextMonday(newMon);
    setStartDate(format(newMon, 'yyyy-MM-dd'));
    setEndDate(format(newNextMon, 'yyyy-MM-dd'));
  };

  const handleSelectWeekByDate = (date: Date) => {
    const mon = getMonday(date);
    const nextMon = getNextMonday(mon);
    setStartDate(format(mon, 'yyyy-MM-dd'));
    setEndDate(format(nextMon, 'yyyy-MM-dd'));
  };

  const [activeTab, setActiveTab] = useState<'payroll' | 'settings'>('payroll');
  const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<PayrollRecord | null>(null);
  const [isShiftBonusDialogOpen, setIsShiftBonusDialogOpen] = useState<boolean>(false);
  const [isServerSalaryDialogOpen, setIsServerSalaryDialogOpen] = useState<boolean>(false);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [isSavingServerSalary, setIsSavingServerSalary] = useState<boolean>(false);

  // States for Thong/Phat % adjustment
  // Custom Base Salary Dialog States
  const [isSalaryDialogOpen, setIsSalaryDialogOpen] = useState<boolean>(false);
  const [salaryStaff, setSalaryStaff] = useState<PayrollRecord | null>(null);
  const [useCustomSalary, setUseCustomSalary] = useState<boolean>(false);
  const [customSalaryInput, setCustomSalaryInput] = useState<string>('');
  const [isSavingCustomSalary, setIsSavingCustomSalary] = useState<boolean>(false);

  const openCustomSalaryDialog = (staff: PayrollRecord) => {
    setSalaryStaff(staff);
    if (staff.isCustomRate && staff.customBaseSalary !== null && staff.customBaseSalary !== undefined) {
      setUseCustomSalary(true);
      setCustomSalaryInput(formatNumberWithCommas(String(staff.customBaseSalary)));
    } else {
      setUseCustomSalary(false);
      setCustomSalaryInput(formatNumberWithCommas(String(staff.effectiveBaseRate || systemSettings.defaultServerSalary || 100000)));
    }
    setIsSalaryDialogOpen(true);
  };

  const handleSaveCustomSalary = async () => {
    if (!salaryStaff) return;
    setIsSavingCustomSalary(true);
    try {
      const cleanVal = useCustomSalary
        ? parseFloat(customSalaryInput.replace(/,/g, '')) || 0
        : null;

      const res = await apiFetch(`${API_URL}/payroll/custom-base-salary`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: salaryStaff.userId,
          startDate: startDate,
          customBaseSalary: cleanVal,
        }),
      });

      if (res.ok) {
        toast.success(
          'Đã cập nhật đơn giá lương',
          useCustomSalary
            ? `Đã đặt đơn giá riêng cho [${salaryStaff.fullName}]: ${formatVND(cleanVal || 0)}/ca (áp dụng từ tuần ${formatDateVi(startDate)} trở đi).`
            : `Đã chuyển [${salaryStaff.fullName}] về đơn giá chung theo cấu hình (áp dụng từ tuần ${formatDateVi(startDate)} trở đi).`
        );
        setIsSalaryDialogOpen(false);
        setSalaryStaff(null);
        fetchPayroll();
      } else {
        const err = await res.json().catch(() => ({}));
        toast.error('Lỗi khi lưu đơn giá', err.message || 'Lỗi server');
      }
    } catch (e) {
      toast.error('Lỗi kết nối khi cập nhật đơn giá.');
    } finally {
      setIsSavingCustomSalary(false);
    }
  };

  // --- Table Column Filter & Sort States ---
  const [isMounted, setIsMounted] = useState<boolean>(false);
  useEffect(() => {
    setIsMounted(true);
  }, []);

  interface ColumnFilters {
    sortKey: string | null;
    sortDirection: 'asc' | 'desc' | null;
    staffSearch: string;
    roleFilter: 'ALL' | 'ADMIN' | 'STAFF';
    shiftsFilter: 'ALL' | 'HAS_SHIFTS' | 'NO_SHIFTS';
    baseSalaryFilter: 'ALL' | 'CUSTOM' | 'DEFAULT';
    nightBonusFilter: 'ALL' | 'HAS_BONUS' | 'NO_BONUS';
    weekendBonusFilter: 'ALL' | 'HAS_BONUS' | 'NO_BONUS';
    fundFilter: 'ALL' | 'HAS_FUND' | 'NO_FUND';
    adjFilter: 'ALL' | 'POSITIVE' | 'NEGATIVE' | 'ZERO';
    rewardFilter: 'ALL' | 'HAS_REWARD' | 'NO_REWARD';
    penaltyFilter: 'ALL' | 'HAS_PENALTY' | 'NO_PENALTY';
    totalSalaryFilter: 'ALL' | 'HAS_SALARY' | 'ZERO_SALARY';
  }

  const initialColumnFilters: ColumnFilters = {
    sortKey: null,
    sortDirection: null,
    staffSearch: '',
    roleFilter: 'ALL',
    shiftsFilter: 'ALL',
    baseSalaryFilter: 'ALL',
    nightBonusFilter: 'ALL',
    weekendBonusFilter: 'ALL',
    fundFilter: 'ALL',
    adjFilter: 'ALL',
    rewardFilter: 'ALL',
    penaltyFilter: 'ALL',
    totalSalaryFilter: 'ALL',
  };

  const [colFilters, setColFilters] = useState<ColumnFilters>(initialColumnFilters);
  const [activePopover, setActivePopover] = useState<{
    colKey: string;
    top: number;
    left?: number;
    right?: number;
  } | null>(null);

  const checkIsFiltered = (colKey: string): boolean => {
    switch (colKey) {
      case 'staff':
        return colFilters.staffSearch.trim() !== '' || colFilters.roleFilter !== 'ALL';
      case 'shifts':
        return colFilters.shiftsFilter !== 'ALL';
      case 'baseSalary':
        return colFilters.baseSalaryFilter !== 'ALL';
      case 'nightBonus':
        return colFilters.nightBonusFilter !== 'ALL';
      case 'weekendBonus':
        return colFilters.weekendBonusFilter !== 'ALL';
      case 'fundPercent':
        return colFilters.fundFilter !== 'ALL';
      case 'adjPercent':
        return colFilters.adjFilter !== 'ALL';
      case 'reward':
        return colFilters.rewardFilter !== 'ALL';
      case 'penalty':
        return colFilters.penaltyFilter !== 'ALL';
      case 'totalSalary':
        return colFilters.totalSalaryFilter !== 'ALL';
      default:
        return false;
    }
  };

  const isAnyFilterOrSortActive =
    colFilters.sortKey !== null ||
    [
      'staff',
      'shifts',
      'baseSalary',
      'nightBonus',
      'weekendBonus',
      'fundPercent',
      'adjPercent',
      'reward',
      'penalty',
      'totalSalary',
    ].some(checkIsFiltered);

  const handleResetAllFilters = () => {
    setColFilters(initialColumnFilters);
    setActivePopover(null);
  };

  const handleResetCol = (colKey: string) => {
    setColFilters((prev) => {
      const next = { ...prev };
      if (next.sortKey === colKey) {
        next.sortKey = null;
        next.sortDirection = null;
      }
      switch (colKey) {
        case 'staff':
          next.staffSearch = '';
          next.roleFilter = 'ALL';
          break;
        case 'shifts':
          next.shiftsFilter = 'ALL';
          break;
        case 'baseSalary':
          next.baseSalaryFilter = 'ALL';
          break;
        case 'nightBonus':
          next.nightBonusFilter = 'ALL';
          break;
        case 'weekendBonus':
          next.weekendBonusFilter = 'ALL';
          break;
        case 'fundPercent':
          next.fundFilter = 'ALL';
          break;
        case 'adjPercent':
          next.adjFilter = 'ALL';
          break;
        case 'reward':
          next.rewardFilter = 'ALL';
          break;
        case 'penalty':
          next.penaltyFilter = 'ALL';
          break;
        case 'totalSalary':
          next.totalSalaryFilter = 'ALL';
          break;
      }
      return next;
    });
  };

  const handleSetSort = (colKey: string, dir: 'asc' | 'desc') => {
    setColFilters((prev) => {
      if (prev.sortKey === colKey && prev.sortDirection === dir) {
        return { ...prev, sortKey: null, sortDirection: null };
      }
      return { ...prev, sortKey: colKey, sortDirection: dir };
    });
  };

  const handleOpenFilter = (
    colKey: string,
    e: React.MouseEvent<HTMLElement>,
    align: 'left' | 'center' | 'right' = 'right'
  ) => {
    e.stopPropagation();
    if (activePopover?.colKey === colKey) {
      setActivePopover(null);
      return;
    }
    const rect = e.currentTarget.getBoundingClientRect();
    const menuWidth = 240;
    const top = rect.bottom + window.scrollY + 6;
    let left: number | undefined;
    let right: number | undefined;

    if (align === 'right') {
      const rightDist = window.innerWidth - rect.right - window.scrollX;
      right = Math.max(10, rightDist);
    } else if (align === 'center') {
      left = Math.max(10, rect.left + rect.width / 2 - menuWidth / 2 + window.scrollX);
      if (left + menuWidth > window.innerWidth - 10) {
        left = undefined;
        right = 10;
      }
    } else {
      left = Math.max(10, rect.left + window.scrollX);
      if (left + menuWidth > window.innerWidth - 10) {
        left = undefined;
        right = 10;
      }
    }

    setActivePopover({ colKey, top, left, right });
  };

  useEffect(() => {
    if (!activePopover) return;
    const handleOutsideClick = (e: MouseEvent) => {
      const popoverEl = document.getElementById('table-filter-popover');
      if (popoverEl && !popoverEl.contains(e.target as Node)) {
        setActivePopover(null);
      }
    };
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setActivePopover(null);
    };
    const handleScrollOrResize = (e: Event) => {
      const popoverEl = document.getElementById('table-filter-popover');
      if (popoverEl && popoverEl.contains(e.target as Node)) {
        return;
      }
      setActivePopover(null);
    };

    window.addEventListener('mousedown', handleOutsideClick);
    window.addEventListener('keydown', handleEsc);
    window.addEventListener('scroll', handleScrollOrResize, true);
    window.addEventListener('resize', handleScrollOrResize);
    return () => {
      window.removeEventListener('mousedown', handleOutsideClick);
      window.removeEventListener('keydown', handleEsc);
      window.removeEventListener('scroll', handleScrollOrResize, true);
      window.removeEventListener('resize', handleScrollOrResize);
    };
  }, [activePopover]);

  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState<boolean>(false);
  const [adjustingStaff, setAdjustingStaff] = useState<PayrollRecord | null>(null);
  const [adjustmentPercentInput, setAdjustmentPercentInput] = useState<string>('');
  const [fundPercentInput, setFundPercentInput] = useState<string>('0');
  const [adjustmentAmountInput, setAdjustmentAmountInput] = useState<string>('0');
  const [otherAllowanceInput, setOtherAllowanceInput] = useState<string>('0');
  const [adjustmentNoteInput, setAdjustmentNoteInput] = useState<string>('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState<boolean>(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);
  
  const [weeklyFundAmount, setWeeklyFundAmount] = useState<string>('0');
  const [isSavingWeeklyFund, setIsSavingWeeklyFund] = useState<boolean>(false);

  const [isLocked, setIsLocked] = useState<boolean>(false);
  const [isCheckingLock, setIsCheckingLock] = useState<boolean>(false);
  const [showLockConfirm, setShowLockConfirm] = useState<boolean>(false);
  const [showUnlockConfirm, setShowUnlockConfirm] = useState<boolean>(false);
  const [lockUnlockLoading, setLockUnlockLoading] = useState<boolean>(false);
  const [lockedPeriodRange, setLockedPeriodRange] = useState<{ start: string; end: string } | null>(null);

  // Helper to format date yyyy-MM-dd to dd/MM/yyyy
  const formatDateVi = (dateStr: string) => {
    if (!dateStr) return '';
    const dateOnly = dateStr.split('T')[0];
    const [year, month, day] = dateOnly.split('-');
    if (year && month && day) {
      return `${day}/${month}/${year}`;
    }
    try {
      return format(parseISO(dateStr), 'dd/MM/yyyy');
    } catch {
      return dateStr;
    }
  };

  // Global Salary settings
  const [systemSettings, setSystemSettings] = useState({
    nightShift22_24Bonus: 10000,
    nightShift0_3Bonus: 10000,
    nightShift3_7Bonus: 20000,
    weekendBonus: 20000,
    defaultServerSalary: 100000,
  });
  const [isSavingSettings, setIsSavingSettings] = useState<boolean>(false);

  // Server & Shift settings lists for manual setup
  const [servers, setServers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [editingServerId, setEditingServerId] = useState<string | null>(null);
  const [serverBaseSalaryInput, setServerBaseSalaryInput] = useState<string>('');
  const [editingShiftId, setEditingShiftId] = useState<string | null>(null);
  const [shiftBaseSalaryInput, setShiftBaseSalaryInput] = useState<string>('');
  const [shiftBonusSalaryInput, setShiftBonusSalaryInput] = useState<string>('');
  const [payrollAllowances, setPayrollAllowances] = useState<PayrollAllowance[]>([]);
  const [allowanceDateInput, setAllowanceDateInput] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [allowanceAmountInput, setAllowanceAmountInput] = useState<string>('');
  const [allowanceNoteInput, setAllowanceNoteInput] = useState<string>('');
  const [isSavingAllowance, setIsSavingAllowance] = useState<boolean>(false);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [selectedShiftBonusDays, setSelectedShiftBonusDays] = useState<string[]>(['2', '3', '4', '5', '6', '7', 'CN']);
  const [shiftNight22_24BonusInput, setShiftNight22_24BonusInput] = useState<string>('');
  const [shiftNight0_3BonusInput, setShiftNight0_3BonusInput] = useState<string>('');
  const [shiftNight3_7BonusInput, setShiftNight3_7BonusInput] = useState<string>('');
  const [shiftWeekendBonusInput, setShiftWeekendBonusInput] = useState<string>('');
  const [isSavingShiftBonus, setIsSavingShiftBonus] = useState<boolean>(false);
  const [isListFullscreen, setIsListFullscreen] = useState<boolean>(false);

  const checkLockStatus = useCallback(async () => {
    setIsCheckingLock(true);
    try {
      const res = await apiFetch(`${API_URL}/payroll/lock-status?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setIsLocked(data.locked);
        if (data.locked && data.startDate && data.endDate) {
          setLockedPeriodRange({ start: data.startDate, end: data.endDate });
        } else {
          setLockedPeriodRange(null);
        }
      }
    } catch (err) {
      console.error('Error checking lock status:', err);
    } finally {
      setIsCheckingLock(false);
    }
  }, [startDate, endDate, API_URL]);

  const fetchPayroll = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/payroll?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        const sortedData = Array.isArray(data)
          ? [...data].sort((a, b) => {
              const getNamePart = (fullName: string) => {
                const afterDot = (fullName || '').trim().split('.').pop() || '';
                return afterDot.trim().split(/\s+/).pop() || '';
              };
              const nameA = getNamePart(a.fullName);
              const nameB = getNamePart(b.fullName);
              const cmp = nameA.localeCompare(nameB, 'vi', { sensitivity: 'accent' });
              if (cmp !== 0) return cmp;
              return (a.fullName || '').localeCompare(b.fullName || '', 'vi', { sensitivity: 'accent' });
            })
          : [];
        setPayrollData(sortedData);
      }
      try {
        const fundRes = await apiFetch(`${API_URL}/payroll/weekly-fund?start_date=${startDate}`);
        if (fundRes.ok && fundRes.status !== 204) {
          const text = await fundRes.text();
          if (text && text.trim().length > 0) {
            const fundData = JSON.parse(text);
            setWeeklyFundAmount(fundData ? String(fundData.amount) : '0');
          } else {
            setWeeklyFundAmount('0');
          }
        } else {
          setWeeklyFundAmount('0');
        }
      } catch (err) {
        console.error('Error fetching weekly fund:', err);
      }
      await checkLockStatus();
    } catch (err) {
      console.error('Error fetching payroll:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, API_URL, checkLockStatus]);

  const handleSaveWeeklyFund = async (val: string) => {
    const rawAmount = parseFloat(val.replace(/\./g, '').replace(/,/g, '')) || 0;
    try {
      const res = await apiFetch(`${API_URL}/payroll/weekly-fund`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          start_date: startDate,
          end_date: endDate,
          amount: rawAmount,
        }),
      });
      if (res.ok) {
        fetchPayroll();
        toast.success('Đã lưu quỹ thưởng tuần!');
      } else {
        toast.error('Lỗi khi lưu quỹ thưởng tuần');
      }
    } catch (err) {
      console.error('Error saving weekly fund:', err);
      toast.error('Lỗi kết nối khi lưu quỹ thưởng');
    }
  };

  const handleLockPayroll = async () => {
    setLockUnlockLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/payroll/lock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: startDate, end_date: endDate }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setShowLockConfirm(false);
          await fetchPayroll();
          toast.success('Chốt bảng lương thành công!', `Đã chốt lương chu kỳ ${startDate} - ${endDate}.`);
        } else {
          toast.error('Không thể chốt bảng lương', data.message || 'Có lỗi xảy ra.');
        }
      } else {
        toast.error('Không thể chốt bảng lương', 'Có lỗi xảy ra.');
      }
    } catch (err) {
      console.error('Failed to lock payroll:', err);
      toast.error('Lỗi kết nối khi chốt bảng lương.');
    } finally {
      setLockUnlockLoading(false);
    }
  };

  const handleUnlockPayroll = async () => {
    setLockUnlockLoading(true);
    const unlockStart = lockedPeriodRange ? lockedPeriodRange.start : startDate;
    const unlockEnd = lockedPeriodRange ? lockedPeriodRange.end : endDate;
    try {
      const res = await apiFetch(`${API_URL}/payroll/unlock`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ start_date: unlockStart, end_date: unlockEnd }),
      });
      if (res.ok) {
        const data = await res.json();
        if (data.success) {
          setShowUnlockConfirm(false);
          await fetchPayroll();
          toast.success('Mở khóa bảng lương thành công!', 'Dữ liệu phân ca và lương đã được mở để chỉnh sửa.');
        } else {
          toast.error('Không thể mở khóa bảng lương', data.message || 'Có lỗi xảy ra.');
        }
      } else {
        toast.error('Không thể mở khóa bảng lương', 'Có lỗi xảy ra.');
      }
    } catch (err) {
      console.error('Failed to unlock payroll:', err);
      toast.error('Lỗi kết nối khi mở khóa bảng lương.');
    } finally {
      setLockUnlockLoading(false);
    }
  };

  const fetchSettingsAndEntities = useCallback(async () => {
    try {
      // 1. System Settings
      const settingsRes = await apiFetch(`${API_URL}/payroll/settings`);
      if (settingsRes.ok) {
        const data = await settingsRes.json();
        setSystemSettings(data);
      }

      // 2. Servers
      const serversRes = await apiFetch(`${API_URL}/servers?week_start_date=${startDate}`);
      if (serversRes.ok) {
        const data = await serversRes.json();
        setServers(data);
      }

      // 3. Shifts
      const shiftsRes = await apiFetch(`${API_URL}/shifts?week_start_date=${startDate}`);
      if (shiftsRes.ok) {
        const data = await shiftsRes.json();
        setShifts(data);
      }

      const allowancesRes = await apiFetch(`${API_URL}/payroll/allowances`);
      if (allowancesRes.ok) {
        const data = await allowancesRes.json();
        setPayrollAllowances(data);
      }
    } catch (err) {
      console.error('Error fetching configuration details:', err);
    }
  }, [API_URL, startDate]);

  useEffect(() => {
    fetchPayroll();
  }, [fetchPayroll]);

  useEffect(() => {
    fetchSettingsAndEntities();
  }, [fetchSettingsAndEntities]);

  const handleSaveSystemSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    try {
      const res = await apiFetch(`${API_URL}/payroll/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings),
      });
      if (res.ok) {
        toast.success('Lưu cấu hình thành công!', 'Cấu hình thù lao chung đã được lưu.');
        fetchPayroll(); // Recalculate values
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error('Lỗi khi lưu cấu hình', errData.message || 'Có lỗi xảy ra. Hãy thử lại.');
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      toast.error('Lỗi kết nối', 'Không thể lưu cấu hình thù lao chung.');
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveAllowance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAllowance(true);
    try {
      const res = await apiFetch(`${API_URL}/payroll/allowances`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          work_date: allowanceDateInput,
          amount: parseFloat(allowanceAmountInput) || 0,
          note: allowanceNoteInput.trim() || null,
        }),
      });

      if (res.ok) {
        setAllowanceAmountInput('');
        setAllowanceNoteInput('');
        toast.success('Lưu phụ cấp thành công!', 'Đã lưu phụ cấp theo ngày.');
        fetchSettingsAndEntities();
        fetchPayroll();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error('Lỗi khi lưu phụ cấp', errData.message || 'Không thể lưu phụ cấp theo ngày.');
      }
    } catch (err) {
      console.error('Failed to save allowance:', err);
      toast.error('Lỗi kết nối', 'Không thể lưu phụ cấp theo ngày.');
    } finally {
      setIsSavingAllowance(false);
    }
  };

  const handleDeleteAllowance = async (id: string) => {
    try {
      const res = await apiFetch(`${API_URL}/payroll/allowances/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        toast.success('Đã xóa phụ cấp theo ngày thành công!');
        fetchSettingsAndEntities();
        fetchPayroll();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error('Lỗi khi xóa', errData.message || 'Không thể xóa phụ cấp theo ngày.');
      }
    } catch (err) {
      console.error('Failed to delete allowance:', err);
      toast.error('Lỗi kết nối', 'Không thể xóa phụ cấp theo ngày.');
    }
  };

  const handleSaveServerSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServerId) return;
    setIsSavingServerSalary(true);
    try {
      const res = await apiFetch(`${API_URL}/shifts/${selectedServerId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_salary: parseFloat(serverBaseSalaryInput) || 0,
        }),
      });
      if (res.ok) {
        setIsServerSalaryDialogOpen(false);
        setSelectedServerId('');
        setServerBaseSalaryInput('');
        toast.success('Lưu cấu hình thành công!', 'Cấu hình lương cơ bản ca đã được lưu.');
        fetchSettingsAndEntities();
        fetchPayroll();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error('Lỗi khi lưu cấu hình', errData.message || 'Không thể lưu cấu hình lương ca.');
      }
    } catch (err) {
      console.error('Failed to update shift salary:', err);
      toast.error('Lỗi kết nối', 'Không thể lưu cấu hình lương ca.');
    } finally {
      setIsSavingServerSalary(false);
    }
  };

  const handleUpdateShiftSalary = async (shiftId: string) => {
    try {
      const baseSalary = shiftBaseSalaryInput.trim() === '' ? null : parseFloat(shiftBaseSalaryInput);
      const bonusSalary = parseFloat(shiftBonusSalaryInput) || 0;

      const res = await apiFetch(`${API_URL}/shifts/${shiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_salary: baseSalary,
          bonus_salary: bonusSalary,
        }),
      });
      if (res.ok) {
        setEditingShiftId(null);
        toast.success('Cập nhật lương ca thành công!');
        fetchSettingsAndEntities();
        fetchPayroll();
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error('Lỗi khi cập nhật lương ca', errData.message || 'Có lỗi xảy ra.');
      }
    } catch (err) {
      console.error('Failed to update shift salary:', err);
      toast.error('Lỗi kết nối', 'Không thể cập nhật lương ca.');
    }
  };

  const handleShiftSelect = (shiftId: string) => {
    setSelectedShiftId(shiftId);
    const shift = shifts.find(s => s.id === shiftId);
    if (shift) {
      setShiftBonusSalaryInput(shift.bonus_salary ? String(shift.bonus_salary) : '');
      if (shift.bonus_days) {
        setSelectedShiftBonusDays(shift.bonus_days.split(','));
      } else {
        setSelectedShiftBonusDays(['2', '3', '4', '5', '6', '7', 'CN']);
      }
      setShiftNight22_24BonusInput(shift.night_bonus_22_24 !== null && shift.night_bonus_22_24 !== undefined ? String(shift.night_bonus_22_24) : '');
      setShiftNight0_3BonusInput(shift.night_bonus_0_3 !== null && shift.night_bonus_0_3 !== undefined ? String(shift.night_bonus_0_3) : '');
      setShiftNight3_7BonusInput(shift.night_bonus_3_7 !== null && shift.night_bonus_3_7 !== undefined ? String(shift.night_bonus_3_7) : '');
      setShiftWeekendBonusInput(shift.weekend_bonus !== null && shift.weekend_bonus !== undefined ? String(shift.weekend_bonus) : '');
    } else {
      setShiftBonusSalaryInput('');
      setSelectedShiftBonusDays(['2', '3', '4', '5', '6', '7', 'CN']);
      setShiftNight22_24BonusInput('');
      setShiftNight0_3BonusInput('');
      setShiftNight3_7BonusInput('');
      setShiftWeekendBonusInput('');
    }
  };

  const handleSaveShiftBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftId) return;
    setIsSavingShiftBonus(true);
    try {
      const shift = shifts.find(s => s.id === selectedShiftId);
      const baseSalary = shift ? shift.base_salary : null;
      const bonusSalary = parseFloat(shiftBonusSalaryInput) || 0;
      const bonusDays = selectedShiftBonusDays.join(',');

      const res = await apiFetch(`${API_URL}/shifts/${selectedShiftId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_salary: baseSalary,
          bonus_salary: 0,
          bonus_days: null,
          night_bonus_22_24: shiftNight22_24BonusInput !== '' ? parseFloat(shiftNight22_24BonusInput) : null,
          night_bonus_0_3: shiftNight0_3BonusInput !== '' ? parseFloat(shiftNight0_3BonusInput) : null,
          night_bonus_3_7: shiftNight3_7BonusInput !== '' ? parseFloat(shiftNight3_7BonusInput) : null,
          weekend_bonus: shiftWeekendBonusInput !== '' ? parseFloat(shiftWeekendBonusInput) : null,
        }),
      });

      if (res.ok) {
        toast.success('Lưu cấu hình thành công!', 'Cấu hình phụ cấp ca đã được lưu.');
        fetchSettingsAndEntities();
        fetchPayroll();
        setIsShiftBonusDialogOpen(false);
      } else {
        const errData = await res.json().catch(() => ({}));
        toast.error('Lỗi khi lưu cấu hình', errData.message || 'Không thể lưu cấu hình phụ cấp ca.');
      }
    } catch (err) {
      console.error('Failed to save shift bonus:', err);
      toast.error('Lỗi kết nối', 'Không thể lưu cấu hình phụ cấp ca.');
    } finally {
      setIsSavingShiftBonus(false);
    }
  };

  const handleSaveAdjustment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!adjustingStaff) return;
    setIsSavingAdjustment(true);
    try {
      const res = await apiFetch(`${API_URL}/payroll/adjustments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          userId: adjustingStaff.userId,
          startDate,
          endDate,
          adjustmentPercent: parseFloat(adjustmentPercentInput) || 0,
          fundPercent: parseFloat(fundPercentInput) || 0,
          adjustmentAmount: parseFormattedNumber(adjustmentAmountInput) !== 0 ? -Math.abs(parseFormattedNumber(adjustmentAmountInput)) : 0,
          otherAllowance: parseFormattedNumber(otherAllowanceInput),
          note: adjustmentNoteInput.trim() || null,
        }),
      });
      if (res.ok) {
        toast.success('Điều chỉnh lương thành công!', `Đã lưu chuyên cần cho [${adjustingStaff.fullName}].`);
        setIsAdjustmentDialogOpen(false);
        setAdjustingStaff(null);
        setAdjustmentPercentInput('');
        setFundPercentInput('0');
        setAdjustmentAmountInput('0');
        setOtherAllowanceInput('0');
        setAdjustmentNoteInput('');
        setAdjustmentMessage(null);
        fetchPayroll();
      } else {
        const errData = await res.json().catch(() => ({}));
        setAdjustmentMessage({
          type: 'error',
          text: errData.message || 'Không thể lưu điều chỉnh lương.'
        });
      }
    } catch (err) {
      console.error('Failed to save adjustment:', err);
      setAdjustmentMessage({
        type: 'error',
        text: 'Lỗi kết nối. Không thể lưu cấu hình.'
      });
    } finally {
      setIsSavingAdjustment(false);
    }
  };

  const exportToCSV = () => {
    // UTF-8 BOM to make sure Excel handles Vietnamese characters correctly
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Nhân Viên,Số Ca Làm,Lương Cơ Bản,Phụ Cấp Đêm,Phụ Cấp Cuối Tuần,Quỹ Thưởng (%),Tiền Quỹ Thưởng,Chuyên Cần (%),Tiền Chuyên Cần,Thưởng,Phạt,Thực Nhận\n';
 
    displayedPayrollData.forEach((row) => {
      const pctMoney = Math.round(row.totalBaseSalary * ((row.adjustmentPercent || 0) / 100));
      const flatAmount = (row as any).adjustmentAmount || 0;
      csvContent += `"${row.fullName}","=""${row.completedShifts} / ${row.totalShifts}""",${row.totalBaseSalary},${row.totalNightBonus},${row.totalWeekendBonus},${row.fundPercent || 0},${row.totalFundShared || 0},${row.adjustmentPercent || 0},${pctMoney},${row.totalOtherAllowance},${flatAmount},${row.totalSalary}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bang_luong_${startDate}_den_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + 'đ';
  };

  const formatNumberWithCommas = (value: string) => {
    if (!value) return '';
    const clean = value.replace(/[^0-9-]/g, '');
    if (!clean) return '';
    const isNegative = clean.startsWith('-');
    const digits = clean.replace(/-/g, '');
    const formatted = digits.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
    return isNegative ? `-${formatted}` : formatted;
  };

  const parseFormattedNumber = (value: string) => {
    const clean = value.replace(/,/g, '');
    return parseFloat(clean) || 0;
  };

  // Filtered and Sorted Payroll Data
  const displayedPayrollData = useMemo(() => {
    let list = [...payrollData];

    // 1. Staff search
    if (colFilters.staffSearch.trim()) {
      const q = colFilters.staffSearch.trim().toLowerCase();
      list = list.filter(
        (s) =>
          (s.fullName || '').toLowerCase().includes(q) ||
          (s.username || '').toLowerCase().includes(q)
      );
    }

    // 2. Role filter
    if (colFilters.roleFilter !== 'ALL') {
      list = list.filter((s) => s.role === colFilters.roleFilter);
    }

    // 3. Shifts filter
    if (colFilters.shiftsFilter === 'HAS_SHIFTS') {
      list = list.filter((s) => s.completedShifts > 0);
    } else if (colFilters.shiftsFilter === 'NO_SHIFTS') {
      list = list.filter((s) => s.completedShifts === 0);
    }

    // 4. Base salary filter
    if (colFilters.baseSalaryFilter === 'CUSTOM') {
      list = list.filter((s) => !!s.isCustomRate);
    } else if (colFilters.baseSalaryFilter === 'DEFAULT') {
      list = list.filter((s) => !s.isCustomRate);
    }

    // 5. Night bonus filter
    if (colFilters.nightBonusFilter === 'HAS_BONUS') {
      list = list.filter((s) => s.totalNightBonus > 0);
    } else if (colFilters.nightBonusFilter === 'NO_BONUS') {
      list = list.filter((s) => s.totalNightBonus === 0);
    }

    // 6. Weekend bonus filter
    if (colFilters.weekendBonusFilter === 'HAS_BONUS') {
      list = list.filter((s) => s.totalWeekendBonus > 0);
    } else if (colFilters.weekendBonusFilter === 'NO_BONUS') {
      list = list.filter((s) => s.totalWeekendBonus === 0);
    }

    // 7. Fund filter
    if (colFilters.fundFilter === 'HAS_FUND') {
      list = list.filter((s) => (s.fundPercent || 0) > 0 || (s.totalFundShared || 0) > 0);
    } else if (colFilters.fundFilter === 'NO_FUND') {
      list = list.filter((s) => (s.fundPercent || 0) === 0 && (s.totalFundShared || 0) === 0);
    }

    // 8. Adjustment / Chuyên cần filter
    if (colFilters.adjFilter === 'POSITIVE') {
      list = list.filter((s) => (s.adjustmentPercent || 0) > 0);
    } else if (colFilters.adjFilter === 'NEGATIVE') {
      list = list.filter((s) => (s.adjustmentPercent || 0) < 0);
    } else if (colFilters.adjFilter === 'ZERO') {
      list = list.filter((s) => (s.adjustmentPercent || 0) === 0);
    }

    // 9. Reward filter
    if (colFilters.rewardFilter === 'HAS_REWARD') {
      list = list.filter((s) => (s.totalOtherAllowance || 0) > 0);
    } else if (colFilters.rewardFilter === 'NO_REWARD') {
      list = list.filter((s) => (s.totalOtherAllowance || 0) <= 0);
    }

    // 10. Penalty filter
    if (colFilters.penaltyFilter === 'HAS_PENALTY') {
      list = list.filter((s) => ((s as any).adjustmentAmount || 0) < 0);
    } else if (colFilters.penaltyFilter === 'NO_PENALTY') {
      list = list.filter((s) => ((s as any).adjustmentAmount || 0) >= 0);
    }

    // 11. Total salary filter
    if (colFilters.totalSalaryFilter === 'HAS_SALARY') {
      list = list.filter((s) => s.totalSalary > 0);
    } else if (colFilters.totalSalaryFilter === 'ZERO_SALARY') {
      list = list.filter((s) => s.totalSalary === 0);
    }

    // Sorting
    if (colFilters.sortKey && colFilters.sortDirection) {
      const dir = colFilters.sortDirection === 'asc' ? 1 : -1;
      list.sort((a, b) => {
        switch (colFilters.sortKey) {
          case 'staff': {
            const getNamePart = (fullName: string) => {
              const afterDot = (fullName || '').trim().split('.').pop() || '';
              return afterDot.trim().split(/\s+/).pop() || '';
            };
            const nameA = getNamePart(a.fullName);
            const nameB = getNamePart(b.fullName);
            const cmp = nameA.localeCompare(nameB, 'vi', { sensitivity: 'accent' });
            if (cmp !== 0) return cmp * dir;
            return (a.fullName || '').localeCompare(b.fullName || '', 'vi', { sensitivity: 'accent' }) * dir;
          }
          case 'shifts':
            return (a.completedShifts - b.completedShifts) * dir;
          case 'baseSalary':
            return (a.totalBaseSalary - b.totalBaseSalary) * dir;
          case 'nightBonus':
            return (a.totalNightBonus - b.totalNightBonus) * dir;
          case 'weekendBonus':
            return (a.totalWeekendBonus - b.totalWeekendBonus) * dir;
          case 'fundPercent':
            return ((a.fundPercent || 0) - (b.fundPercent || 0)) * dir;
          case 'adjPercent':
            return ((a.adjustmentPercent || 0) - (b.adjustmentPercent || 0)) * dir;
          case 'reward':
            return ((a.totalOtherAllowance || 0) - (b.totalOtherAllowance || 0)) * dir;
          case 'penalty': {
            const penA = Math.abs(Math.min(0, (a as any).adjustmentAmount || 0));
            const penB = Math.abs(Math.min(0, (b as any).adjustmentAmount || 0));
            return (penA - penB) * dir;
          }
          case 'totalSalary':
            return (a.totalSalary - b.totalSalary) * dir;
          default:
            return 0;
        }
      });
    }

    return list;
  }, [payrollData, colFilters]);

  // Aggregated Summary values
  const totalPayrollCost = payrollData.reduce((acc, curr) => acc + curr.totalSalary, 0);
  const totalCompletedShifts = payrollData.reduce((acc, curr) => acc + curr.completedShifts, 0);
  const averageShiftSalary = totalCompletedShifts > 0 ? totalPayrollCost / totalCompletedShifts : 0;

  const adjustmentPercentOptions = [];
  for (let i = -25; i <= 25; i += 5) {
    adjustmentPercentOptions.push({
      value: i,
      label: i > 0 ? `+${i}%` : `${i}%`,
    });
  }

  const shiftOptions = shifts.map((shift) => ({
    value: shift.id,
    label: `${shift.server?.name || 'N/A'} - ${shift.name || ''} (${shift.start_time})`,
    serverName: shift.server?.name || 'N/A',
    name: shift.name,
    startTime: shift.start_time,
  }));

  const getPopoverTitle = (colKey: string): string => {
    switch (colKey) {
      case 'staff': return 'Nhân Viên';
      case 'shifts': return 'Số Ca Làm';
      case 'baseSalary': return 'Lương Cơ Bản';
      case 'nightBonus': return 'Phụ Cấp Đêm';
      case 'weekendBonus': return 'Phụ Cấp Cuối Tuần';
      case 'fundPercent': return 'Quỹ Thưởng (%)';
      case 'adjPercent': return 'Chuyên Cần (%)';
      case 'reward': return 'Thưởng Khác';
      case 'penalty': return 'Phạt Khác';
      case 'totalSalary': return 'Thực Nhận';
      default: return 'Cột';
    }
  };

  const getSortLabel = (colKey: string, dir: 'asc' | 'desc'): string => {
    if (colKey === 'staff') {
      return dir === 'asc' ? 'Tên A → Z' : 'Tên Z → A';
    }
    if (colKey === 'shifts') {
      return dir === 'asc' ? 'Ít ca → Nhiều ca' : 'Nhiều ca → Ít ca';
    }
    if (colKey === 'penalty') {
      return dir === 'asc' ? 'Phạt ít → Phạt nhiều' : 'Phạt nhiều → Phạt ít';
    }
    return dir === 'asc' ? 'Thấp → Cao' : 'Cao → Thấp';
  };

  const renderFilterBody = (colKey: string) => {
    switch (colKey) {
      case 'staff':
        return (
          <div className="space-y-2">
            <div className="relative">
              <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400" />
              <Input
                value={colFilters.staffSearch}
                onChange={(e) => setColFilters((f) => ({ ...f, staffSearch: e.target.value }))}
                placeholder="Tìm theo tên..."
                className="bg-slate-950 border-slate-700 pl-8 pr-7 py-1 h-8 text-xs text-slate-200"
              />
              {colFilters.staffSearch && (
                <button
                  type="button"
                  onClick={() => setColFilters((f) => ({ ...f, staffSearch: '' }))}
                  className="absolute right-2 top-1/2 -translate-y-1/2 text-slate-400 hover:text-slate-200"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
            <div className="space-y-1 pt-1">
              <div className="text-[10px] text-slate-400 font-mono">Vai trò:</div>
              {[
                { value: 'ALL', label: 'Tất cả vai trò' },
                { value: 'ADMIN', label: 'Quản trị viên (ADMIN)' },
                { value: 'STAFF', label: 'Nhân viên (STAFF)' },
              ].map((opt) => (
                <button
                  key={opt.value}
                  type="button"
                  onClick={() => setColFilters((f) => ({ ...f, roleFilter: opt.value as any }))}
                  className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                    colFilters.roleFilter === opt.value
                      ? 'bg-slate-800 text-cyan-400 font-medium'
                      : 'hover:bg-slate-800/60 text-slate-300'
                  }`}
                >
                  <span>{opt.label}</span>
                  {colFilters.roleFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
                </button>
              ))}
            </div>
          </div>
        );

      case 'shifts':
        return (
          <div className="space-y-1">
            {[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'HAS_SHIFTS', label: 'Có ca làm (> 0 ca)' },
              { value: 'NO_SHIFTS', label: 'Chưa có ca làm (= 0)' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColFilters((f) => ({ ...f, shiftsFilter: opt.value as any }))}
                className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                  colFilters.shiftsFilter === opt.value
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
                {colFilters.shiftsFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
              </button>
            ))}
          </div>
        );

      case 'baseSalary':
        return (
          <div className="space-y-1">
            {[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'CUSTOM', label: 'Đơn giá riêng (Tùy chỉnh)' },
              { value: 'DEFAULT', label: 'Đơn giá mặc định' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColFilters((f) => ({ ...f, baseSalaryFilter: opt.value as any }))}
                className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                  colFilters.baseSalaryFilter === opt.value
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
                {colFilters.baseSalaryFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
              </button>
            ))}
          </div>
        );

      case 'nightBonus':
        return (
          <div className="space-y-1">
            {[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'HAS_BONUS', label: 'Có phụ cấp đêm (> 0đ)' },
              { value: 'NO_BONUS', label: 'Không có phụ cấp đêm (0đ)' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColFilters((f) => ({ ...f, nightBonusFilter: opt.value as any }))}
                className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                  colFilters.nightBonusFilter === opt.value
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
                {colFilters.nightBonusFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
              </button>
            ))}
          </div>
        );

      case 'weekendBonus':
        return (
          <div className="space-y-1">
            {[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'HAS_BONUS', label: 'Có phụ cấp cuối tuần (> 0đ)' },
              { value: 'NO_BONUS', label: 'Không có phụ cấp (0đ)' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColFilters((f) => ({ ...f, weekendBonusFilter: opt.value as any }))}
                className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                  colFilters.weekendBonusFilter === opt.value
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
                {colFilters.weekendBonusFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
              </button>
            ))}
          </div>
        );

      case 'fundPercent':
        return (
          <div className="space-y-1">
            {[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'HAS_FUND', label: 'Có chia quỹ (> 0%)' },
              { value: 'NO_FUND', label: 'Không chia quỹ (0%)' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColFilters((f) => ({ ...f, fundFilter: opt.value as any }))}
                className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                  colFilters.fundFilter === opt.value
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
                {colFilters.fundFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
              </button>
            ))}
          </div>
        );

      case 'adjPercent':
        return (
          <div className="space-y-1">
            {[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'POSITIVE', label: 'Thưởng chuyên cần (+%)' },
              { value: 'NEGATIVE', label: 'Bị phạt chuyên cần (-%)' },
              { value: 'ZERO', label: 'Mức chuẩn (0%)' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColFilters((f) => ({ ...f, adjFilter: opt.value as any }))}
                className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                  colFilters.adjFilter === opt.value
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
                {colFilters.adjFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
              </button>
            ))}
          </div>
        );

      case 'reward':
        return (
          <div className="space-y-1">
            {[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'HAS_REWARD', label: 'Có thưởng (> 0đ)' },
              { value: 'NO_REWARD', label: 'Không có thưởng (0đ)' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColFilters((f) => ({ ...f, rewardFilter: opt.value as any }))}
                className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                  colFilters.rewardFilter === opt.value
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
                {colFilters.rewardFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
              </button>
            ))}
          </div>
        );

      case 'penalty':
        return (
          <div className="space-y-1">
            {[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'HAS_PENALTY', label: 'Bị phạt (< 0đ)' },
              { value: 'NO_PENALTY', label: 'Không bị phạt (0đ)' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColFilters((f) => ({ ...f, penaltyFilter: opt.value as any }))}
                className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                  colFilters.penaltyFilter === opt.value
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
                {colFilters.penaltyFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
              </button>
            ))}
          </div>
        );

      case 'totalSalary':
        return (
          <div className="space-y-1">
            {[
              { value: 'ALL', label: 'Tất cả' },
              { value: 'HAS_SALARY', label: 'Có thực nhận (> 0đ)' },
              { value: 'ZERO_SALARY', label: 'Thực nhận = 0đ' },
            ].map((opt) => (
              <button
                key={opt.value}
                type="button"
                onClick={() => setColFilters((f) => ({ ...f, totalSalaryFilter: opt.value as any }))}
                className={`w-full flex items-center justify-between px-2 py-1 rounded transition-colors text-left ${
                  colFilters.totalSalaryFilter === opt.value
                    ? 'bg-slate-800 text-cyan-400 font-medium'
                    : 'hover:bg-slate-800/60 text-slate-300'
                }`}
              >
                <span>{opt.label}</span>
                {colFilters.totalSalaryFilter === opt.value && <Check className="w-3 h-3 text-cyan-400" />}
              </button>
            ))}
          </div>
        );

      default:
        return null;
    }
  };

  const renderHeaderWithFilter = (
    colKey: string,
    title: string,
    align: 'left' | 'center' | 'right' = 'right',
    extraTitleClass: string = ''
  ) => {
    const isSorted = colFilters.sortKey === colKey;
    const isFiltered = checkIsFiltered(colKey);
    const isActive = isSorted || isFiltered;

    return (
      <TableHead
        className={`text-slate-400 font-mono text-[11px] uppercase py-2 px-1.5 select-none ${
          align === 'left' ? 'text-left' : align === 'center' ? 'text-center' : 'text-right'
        } ${extraTitleClass}`}
      >
        <button
          type="button"
          onClick={(e) => handleOpenFilter(colKey, e, align)}
          className={`inline-flex items-center gap-1 group cursor-pointer font-mono hover:text-slate-200 transition-colors focus:outline-none ${
            align === 'left' ? 'justify-start' : align === 'center' ? 'justify-center mx-auto' : 'justify-end ml-auto'
          } ${isActive ? 'text-cyan-400 font-semibold' : ''}`}
          title={`Lọc & Sắp xếp: ${title}`}
        >
          <span>{title}</span>
          {isSorted ? (
            colFilters.sortDirection === 'asc' ? (
              <ArrowUp className="w-3 h-3 text-cyan-400 shrink-0" />
            ) : (
              <ArrowDown className="w-3 h-3 text-cyan-400 shrink-0" />
            )
          ) : isFiltered ? (
            <Filter className="w-3 h-3 text-cyan-400 shrink-0" />
          ) : (
            <ArrowUpDown className="w-2.5 h-2.5 text-slate-500 opacity-0 group-hover:opacity-100 transition-opacity shrink-0" />
          )}
        </button>
      </TableHead>
    );
  };

  const serverSelectOptions = servers
    .filter((server: any) => !server.name.includes('+'))
    .map((server: any) => ({
      value: server.id,
      label: server.name,
    }));

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-4 sm:p-6 font-sans selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header Block */}
        <div className="flex flex-col lg:flex-row lg:items-center lg:justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter flex items-center gap-2">
              <span className="text-cyan-400">CYBER</span>_PAYROLL
              {isLocked ? (
                <Badge className="bg-emerald-500/10 text-emerald-400 border border-emerald-500/20 font-mono text-[10px] tracking-wider py-0.5 px-2 flex items-center gap-1">
                  <Lock className="w-3 h-3 text-emerald-400" /> ĐÃ CHỐT ({formatDateVi(lockedPeriodRange?.start || startDate)} - {formatDateVi(lockedPeriodRange?.end || endDate)})
                </Badge>
              ) : (
                <Badge className="bg-amber-500/10 text-amber-400 border border-amber-500/20 font-mono text-[10px] tracking-wider py-0.5 px-2 flex items-center gap-1">
                  <Unlock className="w-3.5 h-3.5 text-amber-400" /> CHƯA CHỐT
                </Badge>
              )}
            </h1>
             <p className="text-slate-400 mt-1 text-sm">Hệ thống quản lý thù lao và cấu hình tự động</p>
          </div>
          <div className="flex flex-col lg:items-end gap-2 shrink-0">
            <div className="flex flex-wrap lg:flex-nowrap items-center gap-3">
              <div className="flex flex-wrap items-center gap-2 bg-slate-900 border border-slate-800 p-1.5 rounded-xl backdrop-blur-xl relative z-40">
              <button
                type="button"
                onClick={() => {
                  setFilterMode('week');
                  const mon = getMonday(parseISO(startDate));
                  setStartDate(format(mon, 'yyyy-MM-dd'));
                  setEndDate(format(getNextMonday(mon), 'yyyy-MM-dd'));
                }}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterMode === 'week'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Theo tuần
              </button>
              <button
                type="button"
                onClick={() => setFilterMode('custom')}
                className={`px-2.5 py-1 rounded-lg text-xs font-semibold transition-all ${
                  filterMode === 'custom'
                    ? 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                    : 'text-slate-400 hover:text-slate-200 border border-transparent'
                }`}
              >
                Tùy chỉnh
              </button>

              <div className="w-[1px] h-4 bg-slate-800 mx-1" />

              {filterMode === 'week' ? (
                <div className="flex items-center gap-1">
                  <Button
                    onClick={() => handleWeekChange(-1)}
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg p-0"
                  >
                    <ChevronLeft className="w-4 h-4" />
                  </Button>

                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <DatePicker
                      selected={startDate ? parseISO(startDate) : null}
                      startDate={startDate ? parseISO(startDate) : null}
                      endDate={endDate ? parseISO(endDate) : null}
                      onChange={(date: Date | null) => {
                        if (date) handleSelectWeekByDate(date);
                      }}
                      dateFormat="dd/MM/yyyy"
                      locale="vi"
                      formatWeekDay={formatWeekDayLabel}
                      popperClassName="z-50"
                      className="bg-transparent text-slate-100 text-xs font-semibold border-none outline-none focus:ring-0 w-22 text-center cursor-pointer hover:text-cyan-400 transition-colors"
                    />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <Calendar className="w-3.5 h-3.5 text-slate-500" />
                    <span className="text-slate-100 text-xs font-semibold min-w-22 text-center select-none font-mono">
                      {formatDateVi(endDate)}
                    </span>
                  </div>

                  <Button
                    onClick={() => handleWeekChange(1)}
                    size="icon"
                    variant="ghost"
                    className="w-7 h-7 text-slate-400 hover:text-slate-100 hover:bg-slate-800 rounded-lg p-0"
                  >
                    <ChevronRight className="w-4 h-4" />
                  </Button>
                </div>
              ) : (
                <div className="flex items-center gap-1">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <DatePicker
                      selected={startDate ? parseISO(startDate) : null}
                      onChange={(date: Date | null) => {
                        if (date) setStartDate(format(date, 'yyyy-MM-dd'));
                      }}
                      dateFormat="dd/MM/yyyy"
                      locale="vi"
                      formatWeekDay={formatWeekDayLabel}
                      popperClassName="z-50"
                      className="bg-transparent text-slate-100 text-xs font-semibold border-none outline-none focus:ring-0 w-22 text-center cursor-pointer hover:text-cyan-400 transition-colors"
                    />
                  </div>
                  <ArrowRight className="w-3.5 h-3.5 text-slate-500 flex-shrink-0" />
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <Calendar className="w-3.5 h-3.5 text-cyan-400" />
                    <DatePicker
                      selected={endDate ? parseISO(endDate) : null}
                      onChange={(date: Date | null) => {
                        if (date) setEndDate(format(date, 'yyyy-MM-dd'));
                      }}
                      dateFormat="dd/MM/yyyy"
                      locale="vi"
                      formatWeekDay={formatWeekDayLabel}
                      popperClassName="z-50"
                      className="bg-transparent text-slate-100 text-xs font-semibold border-none outline-none focus:ring-0 w-22 text-center cursor-pointer hover:text-cyan-400 transition-colors"
                    />
                  </div>
                </div>
              )}
            </div>
            {isLocked ? (
              <Button
                onClick={() => setShowUnlockConfirm(true)}
                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/35 text-red-400 font-semibold text-xs flex items-center gap-1.5 h-9 rounded-lg"
              >
                <Unlock className="w-4 h-4" /> Hủy chốt
              </Button>
            ) : (
              <Button
                onClick={() => setShowLockConfirm(true)}
                disabled={payrollData.length === 0}
                className="bg-emerald-500/10 hover:bg-emerald-500/20 border border-emerald-500/35 text-emerald-400 font-semibold text-xs flex items-center gap-1.5 h-9 rounded-lg"
              >
                <Lock className="w-4 h-4" /> Chốt bảng lương
              </Button>
            )}
            <Button
              onClick={exportToCSV}
              disabled={payrollData.length === 0}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 font-medium text-xs flex items-center gap-1.5 h-9 rounded-lg"
            >
              <Download className="w-4 h-4" /> Xuất Báo Cáo
            </Button>
            {false && (
            <Button
              variant="outline"
              onClick={() => setIsHistoryOpen(true)}
              className="border-slate-800 bg-slate-900/60 hover:bg-cyan-500/10 hover:border-cyan-500/50 text-cyan-400 font-medium text-xs flex items-center gap-1.5 h-9 rounded-lg"
              title="Xem lịch sử thao tác bảng lương"
            >
              <History className="w-4 h-4" /> Lịch sử
            </Button>
          )}
          </div>
          {filterMode === 'week' && (
            <p className="text-cyan-500/80 text-xs font-mono lg:text-right w-full">
              💡 Chu kỳ tuần: 07h00 sáng Thứ 2 ({formatDateVi(startDate)}) đến 06h59 sáng Thứ 2 tuần sau ({formatDateVi(endDate)})
            </p>
          )}
        </div>
      </div>

        {/* Dashboard Cards Grid */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900/50 border-slate-850 text-slate-50 backdrop-blur-xl">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-slate-400 text-xs font-mono">TỔNG CHI TRẢ</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl sm:text-2xl font-bold text-emerald-400 tracking-tight">{formatVND(totalPayrollCost)}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-850 text-slate-50 backdrop-blur-xl">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-slate-400 text-xs font-mono">SỐ CA HOÀN THÀNH</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl sm:text-2xl font-bold text-cyan-400 tracking-tight">{totalCompletedShifts} ca làm</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900/50 border-slate-850 text-slate-50 backdrop-blur-xl">
            <CardHeader className="pb-1 pt-4 px-4">
              <CardDescription className="text-slate-400 text-xs font-mono">LƯƠNG TRUNG BÌNH CA</CardDescription>
            </CardHeader>
            <CardContent className="pb-4 px-4">
              <div className="text-xl sm:text-2xl font-bold text-yellow-400 tracking-tight">{formatVND(averageShiftSalary)}</div>
            </CardContent>
          </Card>
        </div>

        {/* Tab Selection */}
        <div className="flex gap-2 border-b border-slate-850">
          <button
            onClick={() => setActiveTab('payroll')}
            className={`pb-3 text-sm font-semibold tracking-wider transition-all border-b-2 px-4 ${activeTab === 'payroll'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            📊 BẢNG LƯƠNG TỔNG HỢP
          </button>
          <button
            onClick={() => setActiveTab('settings')}
            className={`pb-3 text-sm font-semibold tracking-wider transition-all border-b-2 px-4 ${activeTab === 'settings'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            ⚙️ CẤU HÌNH THÙ LAO
          </button>
        </div>

        {/* Main Contents */}
        {activeTab === 'payroll' ? (
          <Card className={`border-slate-850 backdrop-blur-xl transition-all duration-300 ${
            isListFullscreen 
              ? 'fixed inset-0 z-50 w-screen h-screen rounded-none overflow-y-auto p-0 bg-slate-950 flex flex-col border-none' 
              : 'bg-slate-900/40'
          }`}>
            {isListFullscreen ? (
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setIsListFullscreen(false)}
                className="fixed top-3 right-3 z-50 text-slate-400 hover:text-white bg-slate-900/80 hover:bg-slate-800 rounded-full w-8 h-8 flex items-center justify-center border border-slate-800 shadow-lg"
                title="Thu nhỏ"
              >
                <Minimize2 className="w-4 h-4 text-cyan-400" />
              </Button>
            ) : (
              <CardHeader className="flex flex-row items-center justify-between pb-3">
                <CardTitle className="text-lg text-slate-200 flex items-center gap-2 flex-wrap">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  <span>Danh Sách Lương Nhân Sự</span>
                  {isAnyFilterOrSortActive && (
                    <div className="inline-flex items-center gap-2 ml-1 text-xs font-normal text-slate-400 bg-slate-800/80 border border-slate-700/80 px-2.5 py-0.5 rounded-full">
                      <span>Hiển thị <strong className="text-cyan-400">{displayedPayrollData.length}</strong>/{payrollData.length}</span>
                      <button
                        type="button"
                        onClick={handleResetAllFilters}
                        className="inline-flex items-center gap-1 text-[11px] text-slate-300 hover:text-cyan-400 cursor-pointer ml-1"
                        title="Xóa tất cả bộ lọc & sắp xếp"
                      >
                        <RotateCcw className="w-3 h-3" />
                        <span>Đặt lại</span>
                      </button>
                    </div>
                  )}
                </CardTitle>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={() => setIsListFullscreen(true)}
                  className="text-slate-400 hover:text-white flex items-center gap-1.5 h-8 px-3 rounded-lg hover:bg-slate-800"
                >
                  <Maximize2 className="w-4 h-4 text-cyan-400" />
                  <span className="text-xs">Toàn màn hình</span>
                </Button>
              </CardHeader>
            )}
            <CardContent className={isListFullscreen ? 'flex-1 overflow-y-auto p-0' : ''}>
              {isLoading ? (
                <div className="flex flex-col items-center justify-center py-20 text-slate-400 gap-2">
                  <Loader2 className="w-8 h-8 animate-spin text-cyan-400" />
                  <span>Đang tải bảng lương...</span>
                </div>
              ) : (
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="border-slate-850 bg-slate-900/60">
                      <TableRow className="border-slate-850 hover:bg-transparent">
                        {renderHeaderWithFilter('staff', 'NHÂN VIÊN', 'left')}
                        {renderHeaderWithFilter('shifts', 'SỐ CA LÀM', 'center')}
                        {renderHeaderWithFilter('baseSalary', 'LƯƠNG CƠ BẢN', 'right')}
                        {renderHeaderWithFilter('nightBonus', 'PHỤ CẤP ĐÊM', 'right')}
                        {renderHeaderWithFilter('weekendBonus', 'PHỤ CẤP CUỐI TUẦN', 'right')}
                        {renderHeaderWithFilter('fundPercent', 'QUỸ THƯỞNG(%)', 'right')}
                        {renderHeaderWithFilter('adjPercent', 'CHUYÊN CẦN (%)', 'right')}
                        {renderHeaderWithFilter('reward', 'THƯỞNG', 'right')}
                        {renderHeaderWithFilter('penalty', 'PHẠT', 'right')}
                        {renderHeaderWithFilter('totalSalary', 'THỰC NHẬN', 'right', 'font-bold text-cyan-400')}
                        <TableHead className="text-slate-400 font-mono text-[11px] uppercase text-right py-2 px-1.5">HÀNH ĐỘNG</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {displayedPayrollData.map((staff) => (
                        <TableRow
                          key={staff.userId}
                          className="border-slate-850 hover:bg-slate-900/20 transition-colors"
                        >
                          <TableCell className="font-semibold text-slate-100 flex items-center gap-2">
                            <div className={`w-8 h-8 rounded-full flex items-center justify-center text-xs font-mono border ${
                              staff.role === 'ADMIN'
                                ? 'bg-purple-500/10 border-purple-500/30 text-purple-400'
                                : 'bg-cyan-500/10 border-cyan-500/30 text-cyan-400'
                            }`}>
                              {staff.fullName.charAt(0).toUpperCase()}
                            </div>
                            {staff.fullName}
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            <span className="text-emerald-400 font-bold">{staff.completedShifts}</span> / {staff.totalShifts}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-200">
                            <div className="font-semibold">{formatVND(staff.totalBaseSalary)}</div>
                            <button
                              type="button"
                              disabled={isLocked}
                              onClick={() => openCustomSalaryDialog(staff)}
                              className="group inline-flex items-center gap-1 mt-0.5 focus:outline-none disabled:opacity-50 disabled:pointer-events-none"
                            >
                              {staff.isCustomRate ? (
                                <Badge
                                  variant="outline"
                                  className="text-cyan-400 border-cyan-500/30 bg-cyan-500/10 group-hover:bg-cyan-500/20 cursor-pointer flex items-center gap-1 font-mono text-[10px] py-0 px-1.5 transition-colors"
                                  title="Đơn giá riêng. Nhấp để thay đổi"
                                >
                                  <span>{formatVND(staff.customBaseSalary || staff.effectiveBaseRate || 0)}/ca</span>
                                  <Pencil className="w-2.5 h-2.5 opacity-60 group-hover:opacity-100 transition-opacity" />
                                </Badge>
                              ) : (
                                <Badge
                                  variant="outline"
                                  className="text-slate-400 border-slate-700/70 bg-slate-800/40 group-hover:bg-slate-700/60 group-hover:text-slate-200 cursor-pointer flex items-center gap-1 font-mono text-[10px] py-0 px-1.5 transition-colors"
                                  title="Đang dùng đơn giá mặc định. Nhấp để đổi đơn giá"
                                >
                                  <span>{formatVND(staff.effectiveBaseRate || systemSettings.defaultServerSalary || 100000)}/ca</span>
                                  <Pencil className="w-2.5 h-2.5 opacity-0 group-hover:opacity-100 transition-opacity" />
                                </Badge>
                              )}
                            </button>
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-200">{formatVND(staff.totalNightBonus)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-200">{formatVND(staff.totalWeekendBonus)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-200">
                            <span className={staff.fundPercent && staff.fundPercent !== 0 ? 'text-cyan-400 font-bold' : 'text-slate-400'}>
                              {staff.fundPercent ? `${staff.fundPercent}%` : '0%'}
                            </span>
                            {staff.totalFundShared && staff.totalFundShared !== 0 ? (
                              <span className="text-[10px] text-cyan-400/80 block">
                                {formatVND(staff.totalFundShared)}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-200">
                            <span className={staff.adjustmentPercent && staff.adjustmentPercent !== 0 ? (staff.adjustmentPercent > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold') : 'text-slate-400'}>
                              {staff.adjustmentPercent && staff.adjustmentPercent > 0 ? `+${staff.adjustmentPercent}%` : staff.adjustmentPercent && staff.adjustmentPercent < 0 ? `${staff.adjustmentPercent}%` : '0%'}
                            </span>
                            {staff.adjustmentPercent && staff.adjustmentPercent !== 0 ? (
                              <span className={`text-[10px] block ${staff.adjustmentPercent > 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                {staff.adjustmentPercent > 0 ? '+' : ''}{formatVND(Math.round(staff.totalBaseSalary * (staff.adjustmentPercent / 100)))}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right font-mono">
                            {staff.totalOtherAllowance && staff.totalOtherAllowance > 0 ? (
                              <span className="text-emerald-400">
                                {formatVND(staff.totalOtherAllowance)}
                              </span>
                            ) : (
                              <span className="text-slate-400">0đ</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-200">
                            {(staff as any).adjustmentAmount && (staff as any).adjustmentAmount !== 0 ? (
                              <span className={(staff as any).adjustmentAmount > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold'}>
                                {(staff as any).adjustmentAmount > 0 ? '+' : ''}{formatVND((staff as any).adjustmentAmount)}
                              </span>
                            ) : (
                              <span className="text-slate-400">0đ</span>
                            )}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-400">{formatVND(staff.totalSalary)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-2">
                              <div className="relative group">
                                <Button
                                  onClick={() => setSelectedStaff(staff)}
                                  size="icon"
                                  className="w-8 h-8 bg-slate-900 hover:bg-slate-800 text-slate-300 hover:text-cyan-400 border border-slate-800 rounded-lg flex items-center justify-center transition-colors"
                                >
                                  <Eye className="w-4 h-4" />
                                </Button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-200 px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                                  Chi Tiết
                                </span>
                              </div>
                              <div className="relative group">
                                <Button
                                  onClick={() => {
                                    setAdjustingStaff(staff);
                                    setAdjustmentPercentInput(staff.adjustmentPercent ? String(staff.adjustmentPercent) : '0');
                                    setFundPercentInput(staff.fundPercent ? String(staff.fundPercent) : '0');
                                    const fineVal = Math.abs((staff as any).adjustmentAmount || 0);
                                    setAdjustmentAmountInput(fineVal > 0 ? `-${formatNumberWithCommas(String(fineVal))}` : '0');
                                    setOtherAllowanceInput(staff.totalOtherAllowance ? formatNumberWithCommas(String(staff.totalOtherAllowance)) : '0');
                                    setAdjustmentNoteInput(staff.adjustmentNote || '');
                                    setAdjustmentMessage(null);
                                    setIsAdjustmentDialogOpen(true);
                                  }}
                                  disabled={isLocked}
                                  size="icon"
                                  className="w-8 h-8 bg-cyan-500/10 hover:bg-cyan-500/20 text-cyan-400 hover:text-cyan-300 border border-cyan-500/20 disabled:opacity-50 disabled:pointer-events-none rounded-lg flex items-center justify-center transition-colors"
                                >
                                  <Sliders className="w-4 h-4" />
                                </Button>
                                <span className="pointer-events-none absolute bottom-full left-1/2 -translate-x-1/2 mb-1.5 bg-slate-900 border border-slate-800 text-[10px] text-slate-200 px-2 py-1 rounded shadow-xl opacity-0 group-hover:opacity-100 transition-opacity duration-200 whitespace-nowrap z-50">
                                  Chuyên cần
                                </span>
                              </div>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {displayedPayrollData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={11} className="text-center py-10 text-slate-400">
                            {payrollData.length === 0 ? (
                              'Không có dữ liệu ca làm việc hoàn thành trong khoảng thời gian đã chọn.'
                            ) : (
                              <div className="flex flex-col items-center justify-center gap-2">
                                <span>Không tìm thấy nhân viên nào khớp với bộ lọc.</span>
                                <button
                                  type="button"
                                  onClick={handleResetAllFilters}
                                  className="inline-flex items-center gap-1.5 px-3 py-1 text-xs rounded-md bg-slate-800 hover:bg-slate-750 text-cyan-400 border border-slate-700 transition-colors"
                                >
                                  <RotateCcw className="w-3.5 h-3.5" />
                                  <span>Xóa tất cả bộ lọc</span>
                                </button>
                              </div>
                            )}
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              )}
            </CardContent>
          </Card>
        ) : (
          <div className="space-y-6">
            {isLocked && (
              <div className="flex items-start gap-3 bg-amber-500/10 border border-amber-500/20 text-amber-400 p-4 rounded-xl text-sm leading-relaxed font-sans">
                <ShieldAlert className="w-5 h-5 text-amber-400 flex-shrink-0 mt-0.5" />
                <div>
                  <strong className="font-semibold block mb-0.5">⚠️ Chú ý: Giai đoạn này đã được chốt bảng lương!</strong>
                  Mọi thay đổi đối với cấu hình thù lao chung hoặc thù lao của server bên dưới sẽ <strong>không áp dụng</strong> cho bảng lương của giai đoạn đã khóa (từ {formatDateVi(lockedPeriodRange?.start || startDate)} đến {formatDateVi(lockedPeriodRange?.end || endDate)}). Bạn cần mở khóa bảng lương trước nếu muốn tính toán lại.
                </div>
              </div>
            )}
            <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
              {/* Left Column: System settings and Shift settings */}
              <div className="lg:col-span-1 space-y-6">
                {/* System settings form */}
                <Card className="bg-slate-900/40 border-slate-855 backdrop-blur-xl h-fit">
                  <CardHeader className="border-b border-slate-850 pb-3">
                    <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                      <Settings className="w-4 h-4 text-cyan-400" />
                      Cấu Hình Thù Lao Chung
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs">Cài đặt phụ cấp hệ thống và mức thù lao mặc định</CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <form onSubmit={handleSaveSystemSettings} className="space-y-4 text-sm">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CA ĐÊM (22H - 23H59)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={new Intl.NumberFormat('vi-VN').format(systemSettings.nightShift22_24Bonus || 0)}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                            setSystemSettings({ ...systemSettings, nightShift22_24Bonus: isNaN(raw) ? 0 : raw });
                          }}
                          required
                          className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CA ĐÊM (00H - 2H59)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={new Intl.NumberFormat('vi-VN').format(systemSettings.nightShift0_3Bonus || 0)}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                            setSystemSettings({ ...systemSettings, nightShift0_3Bonus: isNaN(raw) ? 0 : raw });
                          }}
                          required
                          className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CA ĐÊM (3H - 6H59)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={new Intl.NumberFormat('vi-VN').format(systemSettings.nightShift3_7Bonus || 0)}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                            setSystemSettings({ ...systemSettings, nightShift3_7Bonus: isNaN(raw) ? 0 : raw });
                          }}
                          required
                          className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CUỐI TUẦN (T7/CN)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={new Intl.NumberFormat('vi-VN').format(systemSettings.weekendBonus)}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                            setSystemSettings({ ...systemSettings, weekendBonus: isNaN(raw) ? 0 : raw });
                          }}
                          required
                          className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono">LƯƠNG CƠ BẢN THEO CA</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={new Intl.NumberFormat('vi-VN').format(systemSettings.defaultServerSalary)}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                            setSystemSettings({ ...systemSettings, defaultServerSalary: isNaN(raw) ? 0 : raw });
                          }}
                          required
                          className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={isSavingSettings}
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs h-9 rounded flex items-center justify-center gap-1.5"
                      >
                        {isSavingSettings ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Lưu Cấu Hình
                      </Button>
                    </form>
                  </CardContent>
                </Card>

                {/* Weekly Fund Card */}
                <Card className="bg-slate-900/40 border-slate-850 backdrop-blur-xl h-fit">
                  <CardHeader className="border-b border-slate-850 pb-3">
                    <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      Cấu Hình Quỹ Tuần
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                      Thiết lập tổng quỹ thưởng tuần ({formatDateVi(startDate)} - {formatDateVi(endDate)})
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pt-4">
                    <form onSubmit={async (e) => {
                      e.preventDefault();
                      setIsSavingWeeklyFund(true);
                      try {
                        await handleSaveWeeklyFund(weeklyFundAmount);
                        toast.success('Lưu quỹ tuần thành công!', `Tổng quỹ tuần (${formatDateVi(startDate)} - ${formatDateVi(endDate)}) đã được lưu.`);
                      } catch (err) {
                        toast.error('Lỗi khi lưu quỹ tuần', 'Không thể lưu Quỹ tuần.');
                      } finally {
                        setIsSavingWeeklyFund(false);
                      }
                    }} className="space-y-4 text-sm">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono">SỐ TIỀN QUỸ TUẦN (VND)</label>
                        <Input
                          type="text"
                          disabled={isLocked}
                          value={weeklyFundAmount ? new Intl.NumberFormat('vi-VN').format(Number(weeklyFundAmount)) : '0'}
                          onFocus={(e) => e.target.select()}
                          onChange={(e) => {
                            const raw = e.target.value.replace(/\D/g, '');
                            setWeeklyFundAmount(!raw || raw === '0' ? '0' : String(parseInt(raw, 10)));
                          }}
                          className="bg-slate-950/40 border-slate-800 text-cyan-400 font-mono text-xs font-bold focus-visible:ring-cyan-500/20"
                        />
                      </div>

                      <Button
                        type="submit"
                        disabled={isLocked || isSavingWeeklyFund}
                        className="w-full bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs h-9 rounded flex items-center justify-center gap-1.5"
                      >
                        {isSavingWeeklyFund ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                        Lưu Quỹ Tuần
                      </Button>
                    </form>
                  </CardContent>
                </Card>
            </div>

            {/* Server and Shift settings lists */}
            <div className="lg:col-span-2 space-y-6">
              {/* Server base salaries table */}
              <Card className="bg-slate-900/40 border-slate-855 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                      <Server className="w-4 h-4 text-cyan-400" />
                      Cấu Hình Lương Cơ Bản Theo Ca
                    </CardTitle>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedServerId('');
                      setServerBaseSalaryInput('');
                      setIsServerSalaryDialogOpen(true);
                    }}
                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs h-7 px-2.5 rounded flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm cấu hình
                  </Button>
                </CardHeader>
                <CardContent className="p-0 sm:px-6 pb-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="border-slate-850">
                        <TableRow className="border-slate-850 hover:bg-transparent">
                          <TableHead className="text-slate-400 font-mono text-xs uppercase">SERVER</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase">CA LÀM VIỆC</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase">GHI CHÚ</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">LƯƠNG CƠ BẢN / CA</TableHead>
                          <TableHead className="text-slate-400 font-mono text-[11px] uppercase text-right py-2 px-1.5">HÀNH ĐỘNG</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shifts
                          .filter((shift: any) => shift.base_salary !== null && shift.base_salary >= 0)
                          .map((shift) => (
                            <TableRow key={shift.id} className="border-slate-850">
                              <TableCell className="font-semibold text-slate-200">{shift.server?.name || 'N/A'}</TableCell>
                              <TableCell className="font-mono text-slate-200 text-xs">{shift.start_time}</TableCell>
                              <TableCell className="text-xs text-slate-350">{shift.name || '-'}</TableCell>
                              <TableCell className="text-right font-mono">
                                <span className="text-slate-200">{formatVND(shift.base_salary)}</span>
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setSelectedServerId(shift.id);
                                      setServerBaseSalaryInput(shift.base_salary.toString());
                                      setIsServerSalaryDialogOpen(true);
                                    }}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 h-7 w-7 p-0 rounded flex items-center justify-center"
                                    title="Sửa"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={async () => {
                                      const displayName = `${shift.server?.name || 'N/A'} ${shift.name ? `(${shift.name})` : ''} [${shift.start_time}]`;
                                      if (confirm(`Bạn có chắc chắn muốn xóa cấu hình lương của ca ${displayName} không?`)) {
                                        try {
                                          const res = await apiFetch(`${API_URL}/shifts/${shift.id}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              base_salary: null,
                                            }),
                                          });
                                          if (res.ok) {
                                            toast.success('Đã xóa cấu hình lương ca!', `Đã đặt lại lương ca ${displayName} về mặc định.`);
                                            fetchSettingsAndEntities();
                                            fetchPayroll();
                                          } else {
                                            toast.error('Lỗi khi xóa', 'Không thể xóa cấu hình lương ca.');
                                          }
                                        } catch (err) {
                                          console.error('Failed to remove shift salary:', err);
                                          toast.error('Lỗi kết nối', 'Không thể xóa cấu hình lương ca.');
                                        }
                                      }
                                    }}
                                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 h-7 w-7 p-0 rounded flex items-center justify-center"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        {shifts.filter((shift: any) => shift.base_salary !== null && shift.base_salary >= 0).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-slate-500 py-8 text-xs">
                              Chưa cấu hình lương cho ca nào.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

              {/* Shift bonus configuration list */}
              <Card className="bg-slate-900/40 border-slate-855 backdrop-blur-xl">
                <CardHeader className="flex flex-row items-center justify-between pb-3">
                  <div>
                    <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                      <Sparkles className="w-4 h-4 text-cyan-400" />
                      Cấu Hình Phụ Cấp Theo Ca
                    </CardTitle>
                  </div>
                  <Button
                    onClick={() => {
                      setSelectedShiftId('');
                      setShiftBonusSalaryInput('');
                      setSelectedShiftBonusDays(['2', '3', '4', '5', '6', '7', 'CN']);
                      setShiftNight22_24BonusInput('');
                      setShiftNight0_3BonusInput('');
                      setShiftNight3_7BonusInput('');
                      setShiftWeekendBonusInput('');
                      setIsShiftBonusDialogOpen(true);
                    }}
                    className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs h-7 px-2.5 rounded flex items-center gap-1"
                  >
                    <Plus className="w-3.5 h-3.5" /> Thêm cấu hình
                  </Button>
                </CardHeader>
                <CardContent className="p-0 sm:px-6 pb-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="border-slate-850">
                        <TableRow className="border-slate-850 hover:bg-transparent">
                          <TableHead className="text-slate-400 font-mono text-xs uppercase">SERVER</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase">CA LÀM VIỆC</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">ĐÊM (22H-23H59)</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">ĐÊM (00H-02H59)</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">ĐÊM (03H-06H59)</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">CUỐI TUẦN (T7/CN)</TableHead>
                          <TableHead className="text-slate-400 font-mono text-[11px] uppercase text-right py-2 px-1.5">HÀNH ĐỘNG</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shifts
                          .filter((shift: any) => shift.night_bonus_22_24 !== null || shift.night_bonus_0_3 !== null || shift.night_bonus_3_7 !== null || shift.weekend_bonus !== null)
                          .map((shift) => (
                            <TableRow key={shift.id} className="border-slate-850">
                              <TableCell className="font-semibold text-slate-200">
                                {shift.server?.name || 'N/A'}
                                {shift.name && <span className="text-slate-400 font-normal ml-1">({shift.name})</span>}
                              </TableCell>
                              <TableCell className="font-mono text-slate-200 text-xs">
                                {shift.start_time}
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-200">
                                {shift.night_bonus_22_24 !== null ? formatVND(shift.night_bonus_22_24) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-200">
                                {shift.night_bonus_0_3 !== null ? formatVND(shift.night_bonus_0_3) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-200">
                                {shift.night_bonus_3_7 !== null ? formatVND(shift.night_bonus_3_7) : '-'}
                              </TableCell>
                              <TableCell className="text-right font-mono text-slate-200">
                                {shift.weekend_bonus !== null ? formatVND(shift.weekend_bonus) : '-'}
                              </TableCell>
                              <TableCell className="text-right">
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    type="button"
                                    onClick={() => {
                                      setSelectedShiftId(shift.id);
                                      setShiftBonusSalaryInput(shift.bonus_salary ? String(shift.bonus_salary) : '');
                                      if (shift.bonus_days) {
                                        setSelectedShiftBonusDays(shift.bonus_days.split(','));
                                      } else {
                                        setSelectedShiftBonusDays(['2', '3', '4', '5', '6', '7', 'CN']);
                                      }
                                      setShiftNight22_24BonusInput(shift.night_bonus_22_24 !== null && shift.night_bonus_22_24 !== undefined ? String(shift.night_bonus_22_24) : '');
                                      setShiftNight0_3BonusInput(shift.night_bonus_0_3 !== null && shift.night_bonus_0_3 !== undefined ? String(shift.night_bonus_0_3) : '');
                                      setShiftNight3_7BonusInput(shift.night_bonus_3_7 !== null && shift.night_bonus_3_7 !== undefined ? String(shift.night_bonus_3_7) : '');
                                      setShiftWeekendBonusInput(shift.weekend_bonus !== null && shift.weekend_bonus !== undefined ? String(shift.weekend_bonus) : '');
                                      setIsShiftBonusDialogOpen(true);
                                    }}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 h-7 w-7 p-0 rounded flex items-center justify-center"
                                    title="Sửa"
                                  >
                                    <Edit2 className="w-3.5 h-3.5" />
                                  </Button>
                                  <Button
                                    type="button"
                                    onClick={async () => {
                                      if (confirm('Bạn có chắc chắn muốn xóa cấu hình phụ cấp của ca này không?')) {
                                        try {
                                          const res = await apiFetch(`${API_URL}/shifts/${shift.id}`, {
                                            method: 'PUT',
                                            headers: { 'Content-Type': 'application/json' },
                                            body: JSON.stringify({
                                              base_salary: shift.base_salary,
                                              bonus_salary: 0,
                                              bonus_days: null,
                                              night_bonus_22_24: null,
                                              night_bonus_0_3: null,
                                              night_bonus_3_7: null,
                                              weekend_bonus: null,
                                            }),
                                          });
                                          if (res.ok) {
                                            toast.success('Đã xóa cấu hình phụ cấp ca!', 'Đã đặt lại phụ cấp ca về mặc định.');
                                            fetchSettingsAndEntities();
                                            fetchPayroll();
                                          } else {
                                            toast.error('Lỗi khi xóa', 'Không thể xóa cấu hình phụ cấp ca.');
                                          }
                                        } catch (err) {
                                          console.error('Failed to remove shift reward:', err);
                                          toast.error('Lỗi kết nối', 'Không thể xóa cấu hình phụ cấp ca.');
                                        }
                                      }
                                    }}
                                    className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 h-7 w-7 p-0 rounded flex items-center justify-center"
                                    title="Xóa"
                                  >
                                    <Trash2 className="w-3.5 h-3.5" />
                                  </Button>
                                </div>
                              </TableCell>
                            </TableRow>
                          ))}
                        {shifts.filter((shift: any) => shift.night_bonus_22_24 !== null || shift.night_bonus_0_3 !== null || shift.night_bonus_3_7 !== null || shift.weekend_bonus !== null).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={7} className="text-center text-slate-500 py-8 text-xs">
                              Chưa cấu hình phụ cấp cho ca nào trong tuần này.
                            </TableCell>
                          </TableRow>
                        )}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

            </div>
          </div>
          </div>
        )}

      </div>

      {/* Custom Base Salary Dialog */}
      <Dialog open={isSalaryDialogOpen} onOpenChange={(open) => {
        if (!isSavingCustomSalary) {
          setIsSalaryDialogOpen(open);
          if (!open) setSalaryStaff(null);
        }
      }}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-base font-semibold text-slate-100 flex items-center gap-2">
              <Coins className="w-4 h-4 text-cyan-400" />
              Đơn giá lương cơ bản - {salaryStaff?.fullName}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-1">
              Áp dụng cho mỗi ca hoàn thành tính từ tuần <span className="text-slate-200 font-medium">{formatDateVi(startDate)}</span> trở đi.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3 my-4">
            {/* Option 1: Default */}
            <label
              className={`flex items-start gap-3 p-3 rounded-lg border cursor-pointer transition-colors ${
                !useCustomSalary
                  ? 'bg-slate-850/80 border-cyan-500/50'
                  : 'bg-slate-950/30 border-slate-800 hover:bg-slate-850/40'
              }`}
            >
              <input
                type="radio"
                name="salaryOption"
                checked={!useCustomSalary}
                onChange={() => setUseCustomSalary(false)}
                className="mt-0.5 text-cyan-500 focus:ring-0 cursor-pointer"
              />
              <div>
                <div className="text-sm font-medium text-slate-200">Đơn giá mặc định theo cấu hình</div>
                <div className="text-xs text-slate-400 font-mono mt-0.5">
                  {formatVND(systemSettings.defaultServerSalary || 100000)} / ca
                </div>
              </div>
            </label>

            {/* Option 2: Custom */}
            <div
              className={`p-3 rounded-lg border transition-colors ${
                useCustomSalary
                  ? 'bg-slate-850/80 border-cyan-500/50'
                  : 'bg-slate-950/30 border-slate-800 hover:bg-slate-850/40'
              }`}
            >
              <label className="flex items-start gap-3 cursor-pointer">
                <input
                  type="radio"
                  name="salaryOption"
                  checked={useCustomSalary}
                  onChange={() => setUseCustomSalary(true)}
                  className="mt-0.5 text-cyan-500 focus:ring-0 cursor-pointer"
                />
                <div className="text-sm font-medium text-slate-200">
                  Đơn giá riêng cho nhân viên này
                </div>
              </label>

              {useCustomSalary && (
                <div className="pl-6 mt-3 space-y-2">
                  <label className="text-xs text-slate-400 block">
                    Đơn giá mỗi ca làm (VNĐ):
                  </label>
                  <div className="relative max-w-xs">
                    <Input
                      type="text"
                      value={customSalaryInput}
                      onChange={(e) => {
                        const raw = e.target.value.replace(/[^0-9]/g, '');
                        setCustomSalaryInput(formatNumberWithCommas(raw));
                      }}
                      placeholder="100,000"
                      className="bg-slate-950 border-slate-700 font-mono text-slate-100 text-sm pr-12 focus-visible:ring-cyan-500/20"
                    />
                    <span className="absolute right-3 top-1/2 -translate-y-1/2 text-xs text-slate-400 font-mono">
                      đ/ca
                    </span>
                  </div>

                  {salaryStaff && (
                    <div className="text-xs text-slate-400 font-mono pt-1">
                      Ước tính: {salaryStaff.completedShifts} ca x {formatVND(parseFloat(customSalaryInput.replace(/,/g, '')) || 0)} = <span className="text-emerald-400 font-semibold">{formatVND(salaryStaff.completedShifts * (parseFloat(customSalaryInput.replace(/,/g, '')) || 0))}</span>
                    </div>
                  )}
                </div>
              )}
            </div>

            <div className="p-2.5 bg-slate-950/30 border border-slate-800/80 rounded text-[11px] text-slate-400 leading-relaxed">
              Lưu ý: Mức giá này sẽ được lưu cố định cho <span className="text-slate-200">{salaryStaff?.fullName}</span> từ tuần này trở đi cho đến khi được thay đổi lại.
            </div>
          </div>

          <DialogFooter className="flex justify-end gap-2 mt-4">
            <Button
              type="button"
              variant="outline"
              onClick={() => {
                setIsSalaryDialogOpen(false);
                setSalaryStaff(null);
              }}
              disabled={isSavingCustomSalary}
              className="border-slate-800 bg-slate-800/60 text-slate-300 hover:bg-slate-800 text-xs"
            >
              Hủy
            </Button>
            <Button
              type="button"
              onClick={handleSaveCustomSalary}
              disabled={isSavingCustomSalary}
              className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
            >
              {isSavingCustomSalary ? (
                <>
                  <Loader2 className="w-3.5 h-3.5 animate-spin" />
                  <span>Đang lưu...</span>
                </>
              ) : (
                'Lưu áp dụng'
              )}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Adjustment Dialog */}
      <Dialog open={isAdjustmentDialogOpen} onOpenChange={(open) => setIsAdjustmentDialogOpen(open)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-cyan-400">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Chuyên Cần - {adjustingStaff?.fullName}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-2 text-sans">
              Áp dụng phần trăm thưởng hoặc phạt cho tuần lương từ {formatDateVi(startDate)} đến {formatDateVi(endDate)}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAdjustment} className="space-y-4 text-sm pt-2">
            <div className="space-y-1 pb-2">
              <label className="text-[10px] text-slate-400 font-mono">TỶ LỆ CHUYÊN CẦN (%)</label>
              <Select
                options={adjustmentPercentOptions}
                value={adjustmentPercentOptions.find(o => o.value === parseFloat(adjustmentPercentInput)) || null}
                onChange={(val: any) => setAdjustmentPercentInput(val ? String(val.value) : '0')}
                placeholder="-- Chọn tỷ lệ --"
                isSearchable
                styles={reactSelectStyles}
                menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                * Chọn tỷ lệ dương (ví dụ: +10%) để thưởng thêm. Chọn tỷ lệ âm (ví dụ: -5%) để phạt giảm.
              </p>
            </div>

            <div className="space-y-1 pb-2">
              <label className="text-[10px] text-slate-400 font-mono">TỶ LỆ CHIA QUỸ THƯỞNG (%)</label>
              <Input
                type="text"
                value={fundPercentInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  let val = e.target.value.replace(/,/g, '.');
                  val = val.replace(/[^0-9.]/g, '');
                  if (/^0[0-9]/.test(val)) {
                    val = val.replace(/^0+/, '');
                  }
                  const parts = val.split('.');
                  if (parts.length > 2) {
                    val = parts[0] + '.' + parts.slice(1).join('');
                  }
                  setFundPercentInput(val === '' ? '0' : val);
                }}
                onBlur={() => {
                  if (!fundPercentInput || fundPercentInput === '.') {
                    setFundPercentInput('0');
                  }
                }}
                placeholder="VD: 5, hoặc 7.5"
                className="bg-slate-950/40 border-slate-800 text-slate-100 text-xs focus-visible:ring-cyan-500/20 font-mono"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                * Tỷ lệ phần trăm được hưởng từ Quỹ tuần. Cho phép nhập số thập phân.
              </p>
            </div>
            <div className="space-y-1 pb-2">
              <label className="text-[10px] text-slate-400 font-mono">SỐ TIỀN PHẠT (VND)</label>
              <Input
                type="text"
                value={adjustmentAmountInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  if (!raw || raw === '0') {
                    setAdjustmentAmountInput('0');
                  } else {
                    const cleanNum = String(parseInt(raw, 10));
                    const formatted = cleanNum.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    setAdjustmentAmountInput(`-${formatted}`);
                  }
                }}
                placeholder="VD: 50,000"
                className="bg-slate-950/40 border-slate-800 text-slate-100 text-xs focus-visible:ring-cyan-500/20 font-mono font-medium text-red-400"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                * Số tiền phạt sẽ tự động mang dấu trừ (-) và giảm trừ trực tiếp vào tổng thực nhận.
              </p>
            </div>

            <div className="space-y-1 pb-2">
              <label className="text-[10px] text-slate-400 font-mono">THƯỞNG (VND)</label>
              <Input
                type="text"
                value={otherAllowanceInput}
                onFocus={(e) => e.target.select()}
                onChange={(e) => {
                  const raw = e.target.value.replace(/\D/g, '');
                  if (!raw || raw === '0') {
                    setOtherAllowanceInput('0');
                  } else {
                    const cleanNum = String(parseInt(raw, 10));
                    const formatted = cleanNum.replace(/\B(?=(\d{3})+(?!\d))/g, ',');
                    setOtherAllowanceInput(formatted);
                  }
                }}
                placeholder="VD: 200,000"
                className="bg-slate-950/40 border-slate-800 text-slate-100 text-xs focus-visible:ring-cyan-500/20 font-mono font-medium text-emerald-400"
              />
              <p className="text-[10px] text-slate-500 mt-1">
                * Nhập số tiền thưởng dành cho nhân sự này trong tuần/kỳ lương.
              </p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">GHI CHÚ CHUYÊN CẦN</label>
              <Input
                value={adjustmentNoteInput}
                onChange={(e) => setAdjustmentNoteInput(e.target.value)}
                placeholder="VD: Thưởng hiệu suất, Phạt đi muộn nhiều..."
                className="bg-slate-950/40 border-slate-800 text-slate-100 text-xs focus-visible:ring-cyan-500/20"
              />
            </div>

            {adjustmentMessage && (
              <div className={`p-2 rounded text-xs border ${adjustmentMessage.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                {adjustmentMessage.text}
              </div>
            )}

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                type="button"
                onClick={() => {
                  setIsAdjustmentDialogOpen(false);
                  setAdjustingStaff(null);
                }}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isSavingAdjustment}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
              >
                {isSavingAdjustment ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Drill-down Detail Modal */}
      <Dialog open={selectedStaff !== null} onOpenChange={() => setSelectedStaff(null)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 sm:max-w-5xl w-[95vw] max-h-[85vh] overflow-y-auto p-4 sm:p-6">
          <DialogHeader>
            <DialogTitle className="text-lg sm:text-xl font-bold flex items-center gap-2 text-cyan-400">
              <Sparkles className="w-5 h-5" />
              Chi Tiết Bảng Lương - {selectedStaff?.fullName}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs">
              Thống kê thù lao chi tiết từng ca làm của {selectedStaff?.fullName} từ ngày {startDate} đến {endDate}
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 pt-2">

            {/* Staff Mini Stat block */}
            <div className="grid grid-cols-2 sm:grid-cols-8 gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-xs leading-relaxed">
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Số Ca Hoàn Thành</span>
                <strong className="text-sm sm:text-base text-cyan-400">{selectedStaff?.completedShifts} / {selectedStaff?.totalShifts}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Phụ Cấp Đêm</span>
                <strong className="text-sm sm:text-base text-yellow-400">{selectedStaff ? formatVND(selectedStaff.totalNightBonus) : '0đ'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Phụ Cấp CT</span>
                <strong className="text-sm sm:text-base text-orange-400">{selectedStaff ? formatVND(selectedStaff.totalWeekendBonus) : '0đ'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Quỹ Thưởng</span>
                <strong className="text-sm sm:text-base text-cyan-400">
                  {selectedStaff?.fundPercent ? `${selectedStaff.fundPercent}%` : '0%'}
                  {selectedStaff?.totalFundShared ? ` (${formatVND(selectedStaff.totalFundShared)})` : ''}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Chuyên cần %</span>
                <strong className={`text-sm sm:text-base ${selectedStaff?.adjustmentPercent && selectedStaff.adjustmentPercent > 0 ? 'text-emerald-400' : selectedStaff?.adjustmentPercent && selectedStaff.adjustmentPercent < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {selectedStaff?.adjustmentPercent ? `${selectedStaff.adjustmentPercent > 0 ? '+' : ''}${selectedStaff.adjustmentPercent}%` : '0%'}
                  {selectedStaff?.adjustmentPercent ? ` (${selectedStaff.adjustmentPercent > 0 ? '+' : ''}${formatVND(Math.round(selectedStaff.totalBaseSalary * (selectedStaff.adjustmentPercent / 100)))})` : ''}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Thưởng</span>
                <strong className={`text-sm sm:text-base ${selectedStaff && selectedStaff.totalOtherAllowance > 0 ? 'text-emerald-400' : 'text-slate-400'}`}>{selectedStaff ? formatVND(selectedStaff.totalOtherAllowance) : '0đ'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Phạt VND</span>
                <strong className={`text-sm sm:text-base ${(selectedStaff as any)?.adjustmentAmount && (selectedStaff as any).adjustmentAmount > 0 ? 'text-emerald-400' : (selectedStaff as any)?.adjustmentAmount && (selectedStaff as any).adjustmentAmount < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {(selectedStaff as any)?.adjustmentAmount ? `${(selectedStaff as any).adjustmentAmount > 0 ? '+' : ''}${formatVND((selectedStaff as any).adjustmentAmount)}` : '0đ'}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Tổng Thực Nhận</span>
                <strong className="text-sm sm:text-base text-emerald-400">{selectedStaff ? formatVND(selectedStaff.totalSalary) : '0đ'}</strong>
              </div>
            </div>

            {selectedStaff?.adjustmentNote && (
              <div className="text-xs bg-slate-950/20 border border-slate-800/50 p-2.5 rounded-lg text-slate-300">
                <span className="text-slate-400 font-semibold">Ghi chú chuyên cần: </span>
                {selectedStaff.adjustmentNote}
              </div>
            )}

            {/* Detailed shift list table */}
            <div className="overflow-x-auto -mx-4 sm:-mx-6">
              <div className="min-w-[700px] px-4 sm:px-6">
                <Table>
                  <TableHeader className="bg-slate-200">
                    <TableRow className="border-slate-300 hover:bg-transparent">
                      <TableHead className="text-slate-900 font-bold text-[11px] uppercase w-[90px]">NGÀY</TableHead>
                      <TableHead className="text-slate-900 font-bold text-[11px] uppercase">SERVER / CA</TableHead>

                      <TableHead className="text-slate-900 font-bold text-[11px] uppercase text-right">LƯƠNG CB</TableHead>
                      <TableHead className="text-slate-900 font-bold text-[11px] uppercase text-right">P.CẤP ĐÊM</TableHead>
                      <TableHead className="text-slate-900 font-bold text-[11px] uppercase text-right">P.CẤP CT</TableHead>
                      <TableHead className="text-slate-900 font-bold text-[11px] uppercase text-right">THƯỞNG</TableHead>
                      <TableHead className="text-slate-900 font-bold text-[11px] uppercase text-right">TỔNG</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {selectedStaff?.details.map((detail) => (
                      <TableRow key={detail.assignmentId} className="border-slate-800 hover:bg-slate-950/20">
                        <TableCell className="font-mono text-[11px] text-slate-200 whitespace-nowrap">
                          {format(new Date(detail.workDate), 'dd/MM/yy')}
                        </TableCell>
                        <TableCell>
                          <div className="flex items-center gap-2">
                            <div className="font-semibold text-slate-200 text-xs">{detail.serverName}</div>
                            <div className="text-xs text-slate-400 font-mono">{detail.startTime}</div>
                          </div>
                        </TableCell>

                        <TableCell className="text-right font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {detail.isCompleted ? formatVND(detail.baseSalary) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {detail.isCompleted && detail.nightBonus > 0 ? formatVND(detail.nightBonus) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {detail.isCompleted && detail.weekendBonus > 0 ? formatVND(detail.weekendBonus) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {detail.isCompleted && detail.otherAllowance > 0 ? <span className="text-emerald-400">{formatVND(detail.otherAllowance)}</span> : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] font-semibold text-emerald-400 whitespace-nowrap">
                          {detail.isCompleted ? formatVND(detail.totalSalary) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {selectedStaff?.details.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={7} className="text-center text-slate-500 py-10">
                          Không có dữ liệu ca làm trong khoảng thời gian này.
                        </TableCell>
                      </TableRow>
                    )}
                  </TableBody>
                </Table>
              </div>
            </div>

          </div>

          <DialogFooter className="border-t border-slate-800 pt-3">
            <Button
              onClick={() => setSelectedStaff(null)}
              className="bg-slate-800 hover:bg-slate-700 text-xs text-slate-300"
            >
              Đóng
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Lock Confirmation Dialog */}
      <Dialog open={showLockConfirm} onOpenChange={(open) => !lockUnlockLoading && setShowLockConfirm(open)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-emerald-400">
              <Lock className="w-5 h-5 text-emerald-400" />
              Chốt Bảng Lương
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-2">
              Bạn có chắc chắn muốn chốt bảng lương từ ngày <strong className="text-slate-200">{formatDateVi(startDate)}</strong> đến <strong className="text-slate-200">{formatDateVi(endDate)}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-300 leading-relaxed space-y-2 font-sans">
            <p>Sau khi chốt:</p>
            <ul className="list-disc pl-5 space-y-1">
              <li>Bảng lương sẽ được đóng băng cố định dựa trên thiết lập thù lao hiện tại.</li>
              <li>Mọi thay đổi cấu hình thù lao hoặc cập nhật phân ca/điểm danh trong khoảng thời gian này sẽ <strong>không thể thực hiện</strong>.</li>
            </ul>
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              onClick={() => setShowLockConfirm(false)}
              disabled={lockUnlockLoading}
              className="bg-slate-850 hover:bg-slate-800 text-slate-300 text-xs"
            >
              Hủy
            </Button>
            <Button
              onClick={handleLockPayroll}
              disabled={lockUnlockLoading}
              className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
            >
              {lockUnlockLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Xác Nhận Chốt
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Unlock Confirmation Dialog */}
      <Dialog open={showUnlockConfirm} onOpenChange={(open) => !lockUnlockLoading && setShowUnlockConfirm(open)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-red-400">
              <Unlock className="w-5 h-5 text-red-400" />
              Mở Khóa Bảng Lương
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-2">
              Bạn có chắc chắn muốn mở khóa bảng lương từ ngày <strong className="text-slate-200">{formatDateVi(lockedPeriodRange?.start || startDate)}</strong> đến <strong className="text-slate-200">{formatDateVi(lockedPeriodRange?.end || endDate)}</strong>?
            </DialogDescription>
          </DialogHeader>
          <div className="py-4 text-sm text-slate-300 leading-relaxed font-sans">
            Khi mở khóa, bảng lương sẽ quay lại trạng thái <strong>tính toán động</strong>. Bạn sẽ có thể điều chỉnh lịch phân ca, điểm danh và các thay đổi cấu hình thù lao sẽ có hiệu lực trực tiếp trên khoảng thời gian này.
          </div>
          <DialogFooter className="flex gap-2">
            <Button
              onClick={() => setShowUnlockConfirm(false)}
              disabled={lockUnlockLoading}
              className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
            >
              Hủy
            </Button>
            <Button
              onClick={handleUnlockPayroll}
              disabled={lockUnlockLoading}
              className="bg-red-500 hover:bg-red-650 text-white font-semibold text-xs flex items-center gap-1.5"
              style={{ backgroundColor: 'rgb(239, 68, 68)' }}
            >
              {lockUnlockLoading && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
              Xác Nhận Mở
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>

      {/* Shift Bonus Configuration Dialog */}
      <Dialog open={isShiftBonusDialogOpen} onOpenChange={(open) => setIsShiftBonusDialogOpen(open)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-cyan-400">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Cấu Hinh Phụ Cấp Theo Ca
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-2 text-sans">
              Chọn ca của tuần và cài đặt mức phụ cấp kèm ngày áp dụng.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveShiftBonus} className="space-y-4 text-sm pt-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">CHỌN CA LÀM VIỆC</label>
              <Select
                options={shiftOptions}
                value={shiftOptions.find(o => o.value === selectedShiftId) || null}
                onChange={(val: any) => handleShiftSelect(val ? val.value : '')}
                placeholder="-- Chọn ca làm --"
                isSearchable
                styles={reactSelectStyles}
                formatOptionLabel={({ serverName, name, startTime }: any) => (
                  <div className="flex justify-between items-center w-full text-xs">
                    <span className="text-slate-200">
                      <strong className="font-bold text-slate-100">{serverName}</strong>
                      <span className="text-slate-400 ml-2 font-mono">({startTime})</span>
                    </span>
                    {name && (
                      <span className="text-[10px] bg-slate-850 border border-slate-800 text-cyan-400 px-1.5 py-0.5 rounded font-medium ml-2">
                        {name}
                      </span>
                    )}
                  </div>
                )}
              />
            </div>
            


            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CA ĐÊM (22H - 23H59) - ĐỂ TRỐNG NẾU THEO MẶC ĐỊNH</label>
              <Input
                type="text"
                inputMode="numeric"
                value={shiftNight22_24BonusInput ? new Intl.NumberFormat('vi-VN').format(Number(shiftNight22_24BonusInput)) : ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\./g, '').replace(/,/g, '');
                  if (val === '') {
                    setShiftNight22_24BonusInput('');
                  } else {
                    const raw = parseInt(val, 10);
                    setShiftNight22_24BonusInput(isNaN(raw) ? '' : String(raw));
                  }
                }}
                placeholder="VD: 10.000"
                className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CA ĐÊM (00H - 2H59) - ĐỂ TRỐNG NẾU THEO MẶC ĐỊNH</label>
              <Input
                type="text"
                inputMode="numeric"
                value={shiftNight0_3BonusInput ? new Intl.NumberFormat('vi-VN').format(Number(shiftNight0_3BonusInput)) : ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\./g, '').replace(/,/g, '');
                  if (val === '') {
                    setShiftNight0_3BonusInput('');
                  } else {
                    const raw = parseInt(val, 10);
                    setShiftNight0_3BonusInput(isNaN(raw) ? '' : String(raw));
                  }
                }}
                placeholder="VD: 20.000"
                className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CA ĐÊM (3H - 6H59) - ĐỂ TRỐNG NẾU THEO MẶC ĐỊNH</label>
              <Input
                type="text"
                inputMode="numeric"
                value={shiftNight3_7BonusInput ? new Intl.NumberFormat('vi-VN').format(Number(shiftNight3_7BonusInput)) : ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\./g, '').replace(/,/g, '');
                  if (val === '') {
                    setShiftNight3_7BonusInput('');
                  } else {
                    const raw = parseInt(val, 10);
                    setShiftNight3_7BonusInput(isNaN(raw) ? '' : String(raw));
                  }
                }}
                placeholder="VD: 30.000"
                className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
              />
            </div>

            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CUỐI TUẦN (VND) - ĐỂ TRỐNG NẾU THEO MẶC ĐỊNH</label>
              <Input
                type="text"
                inputMode="numeric"
                value={shiftWeekendBonusInput ? new Intl.NumberFormat('vi-VN').format(Number(shiftWeekendBonusInput)) : ''}
                onChange={(e) => {
                  const val = e.target.value.replace(/\./g, '').replace(/,/g, '');
                  if (val === '') {
                    setShiftWeekendBonusInput('');
                  } else {
                    const raw = parseInt(val, 10);
                    setShiftWeekendBonusInput(isNaN(raw) ? '' : String(raw));
                  }
                }}
                placeholder="VD: 40.000"
                className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
              />
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setIsShiftBonusDialogOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isSavingShiftBonus || !selectedShiftId}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
              >
                {isSavingShiftBonus ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Server Salary Configuration Dialog */}
      <Dialog open={isServerSalaryDialogOpen} onOpenChange={(open) => setIsServerSalaryDialogOpen(open)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-cyan-400">
              <Server className="w-5 h-5 text-cyan-400" />
              Cấu Hình Lương Cơ Bản Theo Ca
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-2 text-sans">
              Chọn ca làm việc và cài đặt mức lương cơ bản trên mỗi ca làm việc.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveServerSalary} className="space-y-4 text-sm pt-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">CHỌN CA LÀM VIỆC</label>
              <Select
                options={shiftOptions}
                value={shiftOptions.find(o => o.value === selectedServerId) || null}
                onChange={(val: any) => setSelectedServerId(val ? val.value : '')}
                placeholder="-- Chọn ca làm --"
                isSearchable
                styles={reactSelectStyles}
                formatOptionLabel={({ serverName, name, startTime }: any) => (
                  <div className="flex justify-between items-center w-full text-xs">
                    <span className="text-slate-200">
                      <strong className="font-bold text-slate-100">{serverName}</strong>
                      <span className="text-slate-400 ml-2 font-mono">({startTime})</span>
                    </span>
                    {name && (
                      <span className="text-[10px] bg-slate-850 border border-slate-800 text-cyan-400 px-1.5 py-0.5 rounded font-medium ml-2">
                        {name}
                      </span>
                    )}
                  </div>
                )}
              />
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">LƯƠNG CƠ BẢN / CA (VND)</label>
              <Input
                type="text"
                inputMode="numeric"
                value={serverBaseSalaryInput ? new Intl.NumberFormat('vi-VN').format(Number(serverBaseSalaryInput)) : ''}
                onChange={(e) => {
                  const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                  setServerBaseSalaryInput(isNaN(raw) ? '' : String(raw));
                }}
                required
                placeholder="VD: 100.000"
                className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
              />
            </div>

            <DialogFooter className="flex gap-2 pt-2">
              <Button
                type="button"
                onClick={() => setIsServerSalaryDialogOpen(false)}
                className="bg-slate-800 hover:bg-slate-700 text-slate-300 text-xs"
              >
                Hủy
              </Button>
              <Button
                type="submit"
                disabled={isSavingServerSalary || !selectedServerId}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs flex items-center gap-1.5"
              >
                {isSavingServerSalary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : <Save className="w-3.5 h-3.5" />}
                Lưu
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Page History Drawer */}
      <PageHistoryDrawer
        isOpen={false}
        onClose={() => setIsHistoryOpen(false)}
        page="PAYROLL"
        title="Lịch Sử Bảng Lương & Thù Lao"
        defaultTab={activeTab === 'settings' ? 'CONFIG' : 'PAYROLL'}
      />
      {/* Popover Filter & Sort Portal */}
      {activePopover && isMounted && createPortal(
        <div
          id="table-filter-popover"
          style={{
            position: 'absolute',
            top: `${activePopover.top}px`,
            left: activePopover.left !== undefined ? `${activePopover.left}px` : undefined,
            right: activePopover.right !== undefined ? `${activePopover.right}px` : undefined,
          }}
          className="z-50 w-64 bg-slate-900 border border-slate-700/80 rounded-lg shadow-xl shadow-black/60 p-3 text-xs text-slate-200 font-sans animate-in fade-in zoom-in-95 duration-100"
        >
          {/* Header */}
          <div className="flex items-center justify-between pb-2 mb-2 border-b border-slate-800">
            <span className="font-semibold text-slate-100 flex items-center gap-1.5">
              <Filter className="w-3.5 h-3.5 text-cyan-400" />
              {getPopoverTitle(activePopover.colKey)}
            </span>
            {(colFilters.sortKey === activePopover.colKey || checkIsFiltered(activePopover.colKey)) && (
              <button
                type="button"
                onClick={() => handleResetCol(activePopover.colKey)}
                className="text-[11px] text-cyan-400 hover:text-cyan-300 underline cursor-pointer"
              >
                Đặt lại
              </button>
            )}
          </div>

          {/* Sắp xếp */}
          <div className="space-y-1 mb-2.5">
            <div className="text-[10px] font-mono uppercase text-slate-500 mb-1">Sắp xếp</div>
            <button
              type="button"
              onClick={() => handleSetSort(activePopover.colKey, 'asc')}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors text-left cursor-pointer ${
                colFilters.sortKey === activePopover.colKey && colFilters.sortDirection === 'asc'
                  ? 'bg-cyan-500/15 text-cyan-300 font-medium border border-cyan-500/30'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <ArrowUp className="w-3.5 h-3.5" />
                {getSortLabel(activePopover.colKey, 'asc')}
              </span>
              {colFilters.sortKey === activePopover.colKey && colFilters.sortDirection === 'asc' && (
                <Check className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </button>

            <button
              type="button"
              onClick={() => handleSetSort(activePopover.colKey, 'desc')}
              className={`w-full flex items-center justify-between px-2 py-1.5 rounded transition-colors text-left cursor-pointer ${
                colFilters.sortKey === activePopover.colKey && colFilters.sortDirection === 'desc'
                  ? 'bg-cyan-500/15 text-cyan-300 font-medium border border-cyan-500/30'
                  : 'hover:bg-slate-800 text-slate-300'
              }`}
            >
              <span className="flex items-center gap-2">
                <ArrowDown className="w-3.5 h-3.5" />
                {getSortLabel(activePopover.colKey, 'desc')}
              </span>
              {colFilters.sortKey === activePopover.colKey && colFilters.sortDirection === 'desc' && (
                <Check className="w-3.5 h-3.5 text-cyan-400" />
              )}
            </button>
          </div>

          {/* Bộ lọc */}
          <div className="pt-2 border-t border-slate-800 space-y-2">
            <div className="text-[10px] font-mono uppercase text-slate-500">Lọc dữ liệu</div>
            {renderFilterBody(activePopover.colKey)}
          </div>

          {/* Đóng */}
          <div className="pt-2 mt-2 border-t border-slate-800/80 flex justify-end">
            <button
              type="button"
              onClick={() => setActivePopover(null)}
              className="px-2.5 py-1 text-[11px] rounded bg-slate-800 hover:bg-slate-750 text-slate-300 transition-colors cursor-pointer"
            >
              Đóng
            </button>
          </div>
        </div>,
        document.body
      )}

    </div>
  );
}

function BaseSalaryHead() {
  return (
    <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">LƯƠNG CƠ BẢN</TableHead>
  );
}
