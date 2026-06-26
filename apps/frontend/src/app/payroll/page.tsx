'use client';
import { useEffect, useState, useCallback } from 'react';
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
  Plus, Trash2, Edit2, Maximize2, Minimize2
} from 'lucide-react';
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
  adjustmentPercent?: number;
  totalAdjustment?: number;
  adjustmentNote?: string;
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
    minHeight: '34px',
    borderRadius: '6px',
    fontSize: '12px',
    boxShadow: state.isFocused ? '0 0 0 1px rgba(34, 211, 238, 0.5)' : 'none',
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
  })
};

export default function PayrollPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const [filterMode, setFilterMode] = useState<'week' | 'custom'>('week');
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
  const [isAdjustmentDialogOpen, setIsAdjustmentDialogOpen] = useState<boolean>(false);
  const [adjustingStaff, setAdjustingStaff] = useState<PayrollRecord | null>(null);
  const [adjustmentPercentInput, setAdjustmentPercentInput] = useState<string>('');
  const [adjustmentNoteInput, setAdjustmentNoteInput] = useState<string>('');
  const [isSavingAdjustment, setIsSavingAdjustment] = useState<boolean>(false);
  const [adjustmentMessage, setAdjustmentMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

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
        setPayrollData(data);
      }
      await checkLockStatus();
    } catch (err) {
      console.error('Error fetching payroll:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, API_URL, checkLockStatus]);

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
        } else {
          alert(data.message || 'Không thể chốt bảng lương. Có lỗi xảy ra.');
        }
      } else {
        alert('Không thể chốt bảng lương. Có lỗi xảy ra.');
      }
    } catch (err) {
      console.error('Failed to lock payroll:', err);
      alert('Lỗi kết nối khi chốt bảng lương.');
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
        } else {
          alert(data.message || 'Không thể mở khóa bảng lương. Có lỗi xảy ra.');
        }
      } else {
        alert('Không thể mở khóa bảng lương. Có lỗi xảy ra.');
      }
    } catch (err) {
      console.error('Failed to unlock payroll:', err);
      alert('Lỗi kết nối khi mở khóa bảng lương.');
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
    setSettingsMessage(null);
    try {
      const res = await apiFetch(`${API_URL}/payroll/settings`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(systemSettings),
      });
      if (res.ok) {
        setSettingsMessage({ type: 'success', text: 'Cấu hình thù lao chung đã được lưu!' });
        fetchPayroll(); // Recalculate values
        setTimeout(() => setSettingsMessage(null), 3000);
      } else {
        setSettingsMessage({ type: 'error', text: 'Có lỗi xảy ra. Hãy thử lại.' });
      }
    } catch (err) {
      console.error('Failed to save settings:', err);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối. Không thể lưu cấu hình.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  const handleSaveAllowance = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingAllowance(true);
    setSettingsMessage(null);
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
        setSettingsMessage({ type: 'success', text: 'Đã lưu phụ cấp theo ngày.' });
        fetchSettingsAndEntities();
        fetchPayroll();
        setTimeout(() => setSettingsMessage(null), 3000);
      } else {
        setSettingsMessage({ type: 'error', text: 'Không thể lưu phụ cấp theo ngày.' });
      }
    } catch (err) {
      console.error('Failed to save allowance:', err);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối. Không thể lưu phụ cấp theo ngày.' });
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
        fetchSettingsAndEntities();
        fetchPayroll();
      } else {
        setSettingsMessage({ type: 'error', text: 'Không thể xóa phụ cấp theo ngày.' });
      }
    } catch (err) {
      console.error('Failed to delete allowance:', err);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối. Không thể xóa phụ cấp theo ngày.' });
    }
  };

  const handleSaveServerSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServerId) return;
    setIsSavingServerSalary(true);
    setSettingsMessage(null);
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
        setSettingsMessage({ type: 'success', text: 'Cấu hình lương ca đã được lưu!' });
        fetchSettingsAndEntities();
        fetchPayroll();
        setTimeout(() => setSettingsMessage(null), 3000);
      } else {
        setSettingsMessage({ type: 'error', text: 'Không thể lưu cấu hình lương ca.' });
      }
    } catch (err) {
      console.error('Failed to update shift salary:', err);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối. Không thể lưu cấu hình.' });
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
        fetchSettingsAndEntities();
        fetchPayroll();
      }
    } catch (err) {
      console.error('Failed to update shift salary:', err);
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
    } else {
      setShiftBonusSalaryInput('');
      setSelectedShiftBonusDays(['2', '3', '4', '5', '6', '7', 'CN']);
    }
  };

  const handleSaveShiftBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftId) return;
    setIsSavingShiftBonus(true);
    setSettingsMessage(null);
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
          bonus_salary: bonusSalary,
          bonus_days: bonusDays,
        }),
      });

      if (res.ok) {
        setSettingsMessage({ type: 'success', text: 'Cấu hình phụ cấp ca đã được lưu!' });
        fetchSettingsAndEntities();
        fetchPayroll();
        setIsShiftBonusDialogOpen(false);
        setTimeout(() => setSettingsMessage(null), 3000);
      } else {
        setSettingsMessage({ type: 'error', text: 'Không thể lưu cấu hình phụ cấp ca.' });
      }
    } catch (err) {
      console.error('Failed to save shift bonus:', err);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối. Không thể lưu cấu hình.' });
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
          note: adjustmentNoteInput.trim() || null,
        }),
      });
      if (res.ok) {
        setIsAdjustmentDialogOpen(false);
        setAdjustingStaff(null);
        setAdjustmentPercentInput('');
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
    csvContent += 'Nhân Viên,Vai Trò,Tổng Ca Làm,Lương Cơ Bản,Phụ Cấp Đêm,Phụ Cấp Cuối Tuần,Phụ Cấp Khác,Thưởng Ca,Điều Chỉnh (%),Tiền Điều Chỉnh,Thực Nhận (VND)\n';

    payrollData.forEach((row) => {
      csvContent += `"${row.fullName}","${row.role}",${row.completedShifts},${row.totalBaseSalary},${row.totalNightBonus},${row.totalWeekendBonus},${row.totalOtherAllowance},${row.totalShiftReward},${row.adjustmentPercent || 0},${row.totalAdjustment || 0},${row.totalSalary}\n`;
    });

    const encodedUri = encodeURI(csvContent);
    const link = document.createElement('a');
    link.setAttribute('href', encodedUri);
    link.setAttribute('download', `bang_luong_${startDate}_den_${endDate}.csv`);
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);
  };

  // Helper formatting numbers to VND currency
  // Output: 100.000đ (dot as thousand separator, đ suffix, no spaces)
  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + 'đ';
  };

  // Aggregated Summary values
  const totalPayrollCost = payrollData.reduce((acc, curr) => acc + curr.totalSalary, 0);
  const totalCompletedShifts = payrollData.reduce((acc, curr) => acc + curr.completedShifts, 0);
  const averageShiftSalary = totalCompletedShifts > 0 ? totalPayrollCost / totalCompletedShifts : 0;

  const adjustmentPercentOptions = [];
  for (let i = -100; i <= 100; i += 5) {
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
                <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                  <Sparkles className="w-5 h-5 text-cyan-400" />
                  Danh Sách Lương Nhân Sự
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
                        <TableHead className="text-slate-400 font-mono text-xs uppercase">NHÂN VIÊN</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase">VAI TRÒ</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-center">SỐ CA LÀM</TableHead>
                        <BaseSalaryHead />
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">PHỤ CẤP ĐÊM</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">PHỤ CẤP CUỐI TUẦN</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">PHỤ CẤP CA</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">PHỤ CẤP KHÁC</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">ĐIỀU CHỈNH (%)</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-right font-bold text-cyan-400">THỰC NHẬN</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">HÀNH ĐỘNG</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payrollData.map((staff) => (
                        <TableRow
                          key={staff.userId}
                          className="border-slate-850 hover:bg-slate-900/20 transition-colors"
                        >
                          <TableCell className="font-semibold text-slate-100 flex items-center gap-2">
                            <div className="w-8 h-8 rounded-full bg-slate-800 border border-slate-700 flex items-center justify-center text-xs font-mono text-cyan-400">
                              {staff.fullName.charAt(0).toUpperCase()}
                            </div>
                            {staff.fullName}
                          </TableCell>
                          <TableCell>
                            <Badge className={
                              staff.role === 'ADMIN'
                                ? 'bg-red-500/10 text-red-400 border border-red-500/20'
                                : 'bg-cyan-500/10 text-cyan-400 border border-cyan-500/20'
                            }>
                              {staff.role}
                            </Badge>
                          </TableCell>
                          <TableCell className="text-center font-mono">
                            <span className="text-emerald-400 font-bold">{staff.completedShifts}</span> / {staff.totalShifts}
                          </TableCell>
                          <TableCell className="text-right font-mono text-slate-200">{formatVND(staff.totalBaseSalary)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-200">{formatVND(staff.totalNightBonus)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-200">{formatVND(staff.totalWeekendBonus)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-200">{formatVND(staff.totalShiftReward)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-200">{formatVND(staff.totalOtherAllowance)}</TableCell>
                          <TableCell className="text-right font-mono text-slate-200">
                            <span className={staff.adjustmentPercent && staff.adjustmentPercent !== 0 ? (staff.adjustmentPercent > 0 ? 'text-emerald-400 font-bold' : 'text-red-400 font-bold') : 'text-slate-400'}>
                              {staff.adjustmentPercent && staff.adjustmentPercent > 0 ? `+${staff.adjustmentPercent}%` : staff.adjustmentPercent && staff.adjustmentPercent < 0 ? `${staff.adjustmentPercent}%` : '0%'}
                            </span>
                            {staff.totalAdjustment && staff.totalAdjustment !== 0 ? (
                              <span className={`text-[10px] block ${staff.totalAdjustment > 0 ? 'text-emerald-400/80' : 'text-red-400/80'}`}>
                                {staff.totalAdjustment > 0 ? '+' : ''}{formatVND(staff.totalAdjustment)}
                              </span>
                            ) : null}
                          </TableCell>
                          <TableCell className="text-right font-mono font-bold text-emerald-400">{formatVND(staff.totalSalary)}</TableCell>
                          <TableCell className="text-right">
                            <div className="flex justify-end gap-1.5">
                              <Button
                                onClick={() => setSelectedStaff(staff)}
                                className="bg-slate-800 hover:bg-slate-750 text-[11px] text-slate-200 hover:text-white h-7 px-2.5 rounded"
                              >
                                Chi Tiết
                              </Button>
                              <Button
                                onClick={() => {
                                  setAdjustingStaff(staff);
                                  setAdjustmentPercentInput(staff.adjustmentPercent ? String(staff.adjustmentPercent) : '0');
                                  setAdjustmentNoteInput(staff.adjustmentNote || '');
                                  setAdjustmentMessage(null);
                                  setIsAdjustmentDialogOpen(true);
                                }}
                                disabled={isLocked}
                                className="bg-cyan-500/10 hover:bg-cyan-500/20 border border-cyan-500/20 text-cyan-400 disabled:opacity-50 disabled:pointer-events-none text-[11px] h-7 px-2.5 rounded"
                              >
                                Điều Chỉnh
                              </Button>
                            </div>
                          </TableCell>
                        </TableRow>
                      ))}
                      {payrollData.length === 0 && (
                        <TableRow>
                          <TableCell colSpan={10} className="text-center text-slate-500 py-16">
                            Không có dữ liệu ca làm việc hoàn thành trong khoảng thời gian đã chọn.
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
              <Card className="bg-slate-900/40 border-slate-850 backdrop-blur-xl h-fit">
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
                    {settingsMessage && (
                      <div className={`p-2 rounded text-xs border ${settingsMessage.type === 'success'
                        ? 'bg-green-500/10 border-green-500/20 text-green-400'
                        : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}>
                        {settingsMessage.text}
                      </div>
                    )}

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
            </div>

            {/* Server and Shift settings lists */}
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-slate-900/40 border-slate-855 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                    <Calendar className="w-4 h-4 text-cyan-400" />
                    Phụ Cấp Theo Ngày
                  </CardTitle>
                  <CardDescription className="text-slate-400 text-xs">
                    Chỉ nhân sự được phân ca vào đúng ngày này mới được cộng phụ cấp.
                  </CardDescription>
                </CardHeader>
                <CardContent className="space-y-4">
                  <form onSubmit={handleSaveAllowance} className="grid grid-cols-1 md:grid-cols-[150px_160px_1fr_auto] gap-3 items-end">
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-mono">NGÀY</label>
                      <Input
                        type="date"
                        value={allowanceDateInput}
                        onChange={(e) => setAllowanceDateInput(e.target.value)}
                        required
                        className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-mono">SỐ TIỀN</label>
                      <Input
                        type="text"
                        inputMode="numeric"
                        value={allowanceAmountInput ? new Intl.NumberFormat('vi-VN').format(Number(allowanceAmountInput)) : ''}
                        onChange={(e) => {
                          const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                          setAllowanceAmountInput(isNaN(raw) ? '' : String(raw));
                        }}
                        required
                        className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
                      />
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-mono">GHI CHÚ</label>
                      <Input
                        value={allowanceNoteInput}
                        onChange={(e) => setAllowanceNoteInput(e.target.value)}
                        placeholder="VD: Tết, lễ 30/4..."
                        className="bg-slate-950/40 border-slate-800 text-slate-100 text-xs focus-visible:ring-cyan-500/20"
                      />
                    </div>
                    <Button
                      type="submit"
                      disabled={isSavingAllowance}
                      className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs h-9 rounded"
                    >
                      {isSavingAllowance ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Lưu'}
                    </Button>
                  </form>

                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="border-slate-850">
                        <TableRow className="border-slate-850 hover:bg-transparent">
                          <TableHead className="text-slate-400 font-mono text-xs uppercase">NGÀY</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase">GHI CHÚ</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">PHỤ CẤP</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">HÀNH ĐỘNG</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollAllowances.map((allowance) => (
                          <TableRow key={allowance.id} className="border-slate-850">
                            <TableCell className="font-mono text-xs text-slate-200">
                              {formatDateVi(allowance.work_date)}
                            </TableCell>
                            <TableCell className="text-xs text-slate-300">
                              {allowance.note || '-'}
                            </TableCell>
                            <TableCell className="text-right font-mono text-slate-200">
                              {formatVND(allowance.amount)}
                            </TableCell>
                            <TableCell className="text-right">
                              <Button
                                type="button"
                                onClick={() => handleDeleteAllowance(allowance.id)}
                                className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 h-7 px-2.5 rounded text-[11px]"
                              >
                                Xóa
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>

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
                      setSettingsMessage(null);
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
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">HÀNH ĐỘNG</TableHead>
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
                                      setSettingsMessage(null);
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
                                            fetchSettingsAndEntities();
                                            fetchPayroll();
                                          }
                                        } catch (err) {
                                          console.error('Failed to remove shift salary:', err);
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
                      setSettingsMessage(null);
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
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">MỨC PHỤ CẤP</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-center">NGÀY ÁP DỤNG</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">HÀNH ĐỘNG</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shifts
                          .filter((shift: any) => shift.bonus_salary > 0)
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
                                {formatVND(shift.bonus_salary)}
                              </TableCell>
                              <TableCell className="text-center text-xs text-slate-300">
                                {shift.bonus_days ? (
                                  <div className="flex flex-wrap gap-1 justify-center">
                                    {shift.bonus_days.split(',').map((day: string) => (
                                      <Badge key={day} className="bg-cyan-500/10 text-cyan-400 border border-cyan-500/20 text-[9px] py-0 px-1">
                                        {day === 'CN' ? 'CN' : `T${day}`}
                                      </Badge>
                                    ))}
                                  </div>
                                ) : (
                                  <span className="text-[10px] text-slate-500">Cả tuần</span>
                                )}
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
                                      setSettingsMessage(null);
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
                                            }),
                                          });
                                          if (res.ok) {
                                            fetchSettingsAndEntities();
                                            fetchPayroll();
                                          }
                                        } catch (err) {
                                          console.error('Failed to remove shift reward:', err);
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
                        {shifts.filter((shift: any) => shift.bonus_salary > 0).length === 0 && (
                          <TableRow>
                            <TableCell colSpan={5} className="text-center text-slate-500 py-8 text-xs">
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

      {/* Adjustment Dialog */}
      <Dialog open={isAdjustmentDialogOpen} onOpenChange={(open) => setIsAdjustmentDialogOpen(open)}>
        <DialogContent className="bg-slate-900 border-slate-800 text-slate-50 max-w-md p-6">
          <DialogHeader>
            <DialogTitle className="text-lg font-bold flex items-center gap-2 text-cyan-400">
              <Sparkles className="w-5 h-5 text-cyan-400" />
              Điều Chỉnh Lương - {adjustingStaff?.fullName}
            </DialogTitle>
            <DialogDescription className="text-slate-400 text-xs mt-2 text-sans">
              Áp dụng phần trăm thưởng hoặc phạt cho tuần lương từ {formatDateVi(startDate)} đến {formatDateVi(endDate)}.
            </DialogDescription>
          </DialogHeader>
          <form onSubmit={handleSaveAdjustment} className="space-y-4 text-sm pt-2">
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">TỶ LỆ ĐIỀU CHỈNH (%)</label>
              <Select
                options={adjustmentPercentOptions}
                value={adjustmentPercentOptions.find(o => o.value === parseFloat(adjustmentPercentInput)) || null}
                onChange={(val: any) => setAdjustmentPercentInput(val ? String(val.value) : '0')}
                placeholder="-- Chọn tỷ lệ --"
                isSearchable
                styles={reactSelectStyles}
              />
              <p className="text-[10px] text-slate-500 mt-1">
                * Chọn tỷ lệ dương (ví dụ: +10%) để thưởng thêm. Chọn tỷ lệ âm (ví dụ: -5%) để phạt giảm.
              </p>
            </div>
            
            <div className="space-y-1">
              <label className="text-[10px] text-slate-400 font-mono">GHI CHÚ ĐIỀU CHỈNH</label>
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
            <div className="grid grid-cols-2 sm:grid-cols-7 gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-xs leading-relaxed">
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
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Phụ Cấp Ca</span>
                <strong className="text-sm sm:text-base text-pink-400">{selectedStaff ? formatVND(selectedStaff.totalShiftReward) : '0đ'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Phụ Cấp Khác</span>
                <strong className="text-sm sm:text-base text-indigo-400">{selectedStaff ? formatVND(selectedStaff.totalOtherAllowance) : '0đ'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Điều chỉnh %</span>
                <strong className={`text-sm sm:text-base ${selectedStaff?.totalAdjustment && selectedStaff.totalAdjustment > 0 ? 'text-emerald-400' : selectedStaff?.totalAdjustment && selectedStaff.totalAdjustment < 0 ? 'text-red-400' : 'text-slate-400'}`}>
                  {selectedStaff?.adjustmentPercent ? `${selectedStaff.adjustmentPercent > 0 ? '+' : ''}${selectedStaff.adjustmentPercent}%` : '0%'}
                  {selectedStaff?.totalAdjustment ? ` (${selectedStaff.totalAdjustment > 0 ? '+' : ''}${formatVND(selectedStaff.totalAdjustment)})` : ''}
                </strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Tổng Thực Nhận</span>
                <strong className="text-sm sm:text-base text-emerald-400">{selectedStaff ? formatVND(selectedStaff.totalSalary) : '0đ'}</strong>
              </div>
            </div>

            {selectedStaff?.adjustmentNote && (
              <div className="text-xs bg-slate-950/20 border border-slate-800/50 p-2.5 rounded-lg text-slate-300">
                <span className="text-slate-400 font-semibold">Ghi chú điều chỉnh: </span>
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
                      <TableHead className="text-slate-900 font-bold text-[11px] uppercase text-right">PHỤ CẤP KHÁC</TableHead>
                      <TableHead className="text-slate-900 font-bold text-[11px] uppercase text-right">P.CẤP CA</TableHead>
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
                          {detail.isCompleted && detail.otherAllowance > 0 ? formatVND(detail.otherAllowance) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] text-slate-300 whitespace-nowrap">
                          {detail.isCompleted && detail.shiftReward > 0 ? formatVND(detail.shiftReward) : '-'}
                        </TableCell>
                        <TableCell className="text-right font-mono text-[11px] font-semibold text-emerald-400 whitespace-nowrap">
                          {detail.isCompleted ? formatVND(detail.totalSalary) : '-'}
                        </TableCell>
                      </TableRow>
                    ))}
                    {selectedStaff?.details.length === 0 && (
                      <TableRow>
                        <TableCell colSpan={8} className="text-center text-slate-500 py-10">
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
              <label className="text-[10px] text-slate-400 font-mono">MỨC TIỀN PHỤ CẤP (VND)</label>
              <Input
                type="text"
                inputMode="numeric"
                value={shiftBonusSalaryInput ? new Intl.NumberFormat('vi-VN').format(Number(shiftBonusSalaryInput)) : ''}
                onChange={(e) => {
                  const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                  setShiftBonusSalaryInput(isNaN(raw) ? '' : String(raw));
                }}
                required
                placeholder="VD: 50.000"
                className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
              />
            </div>

            <div className="space-y-2">
              <div className="flex justify-between items-center">
                <label className="text-[10px] text-slate-400 font-mono uppercase">Ngày áp dụng</label>
                <button
                  type="button"
                  onClick={() => {
                    const allDays = ['2', '3', '4', '5', '6', '7', 'CN'];
                    if (selectedShiftBonusDays.length === allDays.length) {
                      setSelectedShiftBonusDays([]);
                    } else {
                      setSelectedShiftBonusDays(allDays);
                    }
                  }}
                  className="text-[10px] text-cyan-400 hover:text-cyan-300 transition-colors font-mono"
                >
                  {selectedShiftBonusDays.length === 7 ? 'Bỏ chọn tất cả' : 'Chọn tất cả'}
                </button>
              </div>

              <div className="grid grid-cols-4 gap-2 bg-slate-950/20 border border-slate-800/60 p-2.5 rounded-lg">
                {['2', '3', '4', '5', '6', '7', 'CN'].map((day) => {
                  const isChecked = selectedShiftBonusDays.includes(day);
                  return (
                    <label key={day} className="flex items-center gap-1.5 cursor-pointer text-xs text-slate-300 hover:text-slate-100 font-sans">
                      <input
                        type="checkbox"
                        checked={isChecked}
                        onChange={() => {
                          if (isChecked) {
                            setSelectedShiftBonusDays(selectedShiftBonusDays.filter(d => d !== day));
                          } else {
                            setSelectedShiftBonusDays([...selectedShiftBonusDays, day]);
                          }
                        }}
                        className="w-3.5 h-3.5 rounded border-slate-800 bg-slate-950 text-cyan-500 focus:ring-cyan-500/20"
                      />
                      {day === 'CN' ? 'CN' : `T${day}`}
                    </label>
                  );
                })}
              </div>
            </div>

            {settingsMessage && (
              <div className={`p-2 rounded text-xs border ${settingsMessage.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                {settingsMessage.text}
              </div>
            )}

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

            {settingsMessage && (
              <div className={`p-2 rounded text-xs border ${settingsMessage.type === 'success'
                ? 'bg-green-500/10 border-green-500/20 text-green-400'
                : 'bg-red-500/10 border-red-500/20 text-red-400'
                }`}>
                {settingsMessage.text}
              </div>
            )}

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

    </div>
  );
}

function BaseSalaryHead() {
  return (
    <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">LƯƠNG CƠ BẢN</TableHead>
  );
}
