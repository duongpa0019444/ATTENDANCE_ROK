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
  Lock, Unlock, ShieldAlert, ChevronLeft, ChevronRight
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
}

interface PayrollAllowance {
  id: string;
  work_date: string;
  amount: number;
  note?: string | null;
}

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    backgroundColor: '#020617', // bg-slate-950
    borderColor: state.isFocused ? '#06b6d4' : '#1e293b', // cyan-500 / slate-800
    color: '#e2e8f0', // slate-200
    minHeight: '36px',
    height: '36px',
    borderRadius: '8px',
    fontSize: '12px',
    boxShadow: state.isFocused ? '0 0 0 1px rgba(6, 182, 212, 0.5)' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#06b6d4' : '#334155' }
  }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '0 8px',
    height: '36px',
  }),
  input: (base: any) => ({
    ...base,
    margin: '0px',
    color: '#e2e8f0',
  }),
  indicatorsContainer: (base: any) => ({    ...base,
    height: '36px',
  }),
  singleValue: (base: any) => ({
    ...base,
    color: '#e2e8f0',
  }),
  placeholder: (base: any) => ({
    ...base,
    color: '#94a3b8', // slate-400
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#020617',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    zIndex: 9999
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0891b2' : state.isFocused ? '#1e293b' : 'transparent',
    color: 'white',
    fontSize: '12px',
    cursor: 'pointer',
    '&:active': { backgroundColor: '#0e7490' }
  }),
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
    nightShift22_3Bonus: 10000,
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

  const [shiftDayBonuses, setShiftDayBonuses] = useState<any[]>([]);
  const [selectedShiftId, setSelectedShiftId] = useState<string>('');
  const [selectedDays, setSelectedDays] = useState<string[]>([]);
  const [shiftBonusAmountInput, setShiftBonusAmountInput] = useState<string>('');
  const [isSavingShiftBonus, setIsSavingShiftBonus] = useState<boolean>(false);

  const [serverWeekSalaries, setServerWeekSalaries] = useState<any[]>([]);
  const [selectedServerId, setSelectedServerId] = useState<string>('');
  const [serverSalaryInput, setServerSalaryInput] = useState<string>('');
  const [isSavingServerSalary, setIsSavingServerSalary] = useState<boolean>(false);

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
      const serversRes = await apiFetch(`${API_URL}/servers`);
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

      const shiftBonusesRes = await apiFetch(`${API_URL}/payroll/shift-bonuses?start_date=${startDate}&end_date=${endDate}`);
      if (shiftBonusesRes.ok) {
        const data = await shiftBonusesRes.json();
        setShiftDayBonuses(data);
      }

      const serverSalariesRes = await apiFetch(`${API_URL}/payroll/server-salaries?start_date=${startDate}&end_date=${endDate}`);
      if (serverSalariesRes.ok) {
        const data = await serverSalariesRes.json();
        setServerWeekSalaries(data);
      }
    } catch (err) {
      console.error('Error fetching configuration details:', err);
    }
  }, [API_URL, startDate, endDate]);

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

  const handleSaveShiftBonus = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedShiftId || selectedDays.length === 0 || !shiftBonusAmountInput) return;
    setIsSavingShiftBonus(true);
    setSettingsMessage(null);
    try {
      const amount = parseFloat(shiftBonusAmountInput) || 0;
      
      const promises = selectedDays.map((dayStr) =>
        apiFetch(`${API_URL}/payroll/shift-bonuses`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            shift_id: selectedShiftId,
            work_date: dayStr,
            amount,
          }),
        })
      );

      const responses = await Promise.all(promises);
      const allOk = responses.every((res) => res.ok);

      if (allOk) {
        setShiftBonusAmountInput('');
        setSelectedDays([]);
        setSelectedShiftId('');
        setSettingsMessage({ type: 'success', text: 'Đã lưu cấu hình thưởng ca thành công!' });
        fetchSettingsAndEntities();
        fetchPayroll();
        setTimeout(() => setSettingsMessage(null), 3000);
      } else {
        setSettingsMessage({ type: 'error', text: 'Không thể lưu cấu hình thưởng ca.' });
      }
    } catch (err) {
      console.error('Failed to save shift bonus:', err);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối khi lưu thưởng ca.' });
    } finally {
      setIsSavingShiftBonus(false);
    }
  };

  const handleDeleteShiftBonus = async (id: string) => {
    try {
      const res = await apiFetch(`${API_URL}/payroll/shift-bonuses/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchSettingsAndEntities();
        fetchPayroll();
      } else {
        setSettingsMessage({ type: 'error', text: 'Không thể xóa cấu hình thưởng ca.' });
      }
    } catch (err) {
      console.error('Failed to delete shift bonus:', err);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối khi xóa thưởng ca.' });
    }
  };

  const handleSaveServerSalary = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedServerId || !serverSalaryInput) return;
    setIsSavingServerSalary(true);
    try {
      const res = await apiFetch(`${API_URL}/payroll/server-salaries`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_id: selectedServerId,
          start_date: startDate,
          end_date: endDate,
          base_salary: parseFloat(serverSalaryInput.replace(/\./g, '').replace(/,/g, '')) || 0,
        }),
      });
      if (res.ok) {
        setSelectedServerId('');
        setServerSalaryInput('');
        fetchSettingsAndEntities();
        fetchPayroll();
      } else {
        const errorData = await res.json();
        alert(errorData.message || 'Lỗi khi lưu cấu hình lương server.');
      }
    } catch (err) {
      console.error('Failed to save server week salary:', err);
    } finally {
      setIsSavingServerSalary(false);
    }
  };

  const handleDeleteServerSalary = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa cấu hình lương server tuần này?')) return;
    try {
      const res = await apiFetch(`${API_URL}/payroll/server-salaries/${id}`, {
        method: 'DELETE',
      });
      if (res.ok) {
        fetchSettingsAndEntities();
        fetchPayroll();
      } else {
        const errorData = await res.json();
        alert(errorData.message || 'Không thể xóa cấu hình lương server.');
      }
    } catch (err) {
      console.error('Failed to delete server week salary:', err);
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

  const exportToCSV = () => {
    // UTF-8 BOM to make sure Excel handles Vietnamese characters correctly
    let csvContent = 'data:text/csv;charset=utf-8,\uFEFF';
    csvContent += 'Nhân Viên,Vai Trò,Tổng Ca Làm,Lương Cơ Bản,Phụ Cấp Đêm,Phụ Cấp Cuối Tuần,Phụ Cấp Khác,Thưởng Ca,Thực Nhận (VND)\n';

    payrollData.forEach((row) => {
      csvContent += `"${row.fullName}","${row.role}",${row.completedShifts},${row.totalBaseSalary},${row.totalNightBonus},${row.totalWeekendBonus},${row.totalOtherAllowance},${row.totalShiftReward},${row.totalSalary}\n`;
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
          <Card className="bg-slate-900/40 border-slate-850 backdrop-blur-xl">
            <CardHeader>
              <CardTitle className="text-lg text-slate-200 flex items-center gap-2">
                <Sparkles className="w-5 h-5 text-cyan-400" />
                Danh Sách Lương Nhân Sự
              </CardTitle>
            </CardHeader>
            <CardContent>
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
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">THƯỞNG CA</TableHead>
                        <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">PHỤ CẤP KHÁC</TableHead>
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
                          <TableCell className="text-right font-mono font-bold text-emerald-400">{formatVND(staff.totalSalary)}</TableCell>
                          <TableCell className="text-right">
                            <Button
                              onClick={() => setSelectedStaff(staff)}
                              className="bg-slate-800 hover:bg-slate-750 text-xs text-slate-200 hover:text-white h-7 px-3 rounded"
                            >
                              Chi Tiết
                            </Button>
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

              {/* Left Column: System settings & Server salaries */}
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
                        <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CA ĐÊM (22H - 3H)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={new Intl.NumberFormat('vi-VN').format(systemSettings.nightShift22_3Bonus)}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                            setSystemSettings({ ...systemSettings, nightShift22_3Bonus: isNaN(raw) ? 0 : raw });
                          }}
                          required
                          className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono">PHỤ CẤP CA ĐÊM (SAU 3H - 7H)</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          value={new Intl.NumberFormat('vi-VN').format(systemSettings.nightShift3_7Bonus)}
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

                {/* Server base salaries table */}
                <Card className="bg-slate-900/40 border-slate-855 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                      <Server className="w-4 h-4 text-cyan-400" />
                      Cấu Hinh Lương Theo Server (Tuần)
                    </CardTitle>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Create / Update Form */}
                    <form onSubmit={handleSaveServerSalary} className="grid grid-cols-1 gap-3">
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 font-mono">CHỌN SERVER</label>
                        <Select
                          options={servers
                            .filter((server: any) => !server.name.includes('+'))
                            .map((server: any) => ({
                              value: server.id,
                              label: server.name,
                            }))}
                          value={
                            servers
                              .filter((server: any) => !server.name.includes('+'))
                              .map((server: any) => ({
                                value: server.id,
                                label: server.name,
                              }))
                              .find((opt: any) => opt.value === selectedServerId) || null
                          }
                          onChange={(val: any) => setSelectedServerId(val ? val.value : '')}
                          placeholder="-- Chọn server --"
                          styles={selectStyles}
                          menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
                          isSearchable
                          isClearable
                        />
                      </div>
                      <div className="space-y-1.5">
                        <label className="text-[10px] text-slate-400 font-mono">SỐ TIỀN LƯƠNG / CA</label>
                        <Input
                          type="text"
                          inputMode="numeric"
                          placeholder="VD: 120.000"
                          value={serverSalaryInput ? new Intl.NumberFormat('vi-VN').format(Number(serverSalaryInput)) : ''}
                          onChange={(e) => {
                            const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                            setServerSalaryInput(isNaN(raw) ? '' : String(raw));
                          }}
                          required
                          className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20 h-9"
                        />
                      </div>
                      <Button
                        type="submit"
                        disabled={isSavingServerSalary}
                        className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs h-9 rounded"
                      >
                        {isSavingServerSalary ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : 'Lưu'}
                      </Button>
                    </form>

                    <div className="overflow-x-auto">
                      <Table>
                        <TableHeader className="border-slate-850">
                          <TableRow className="border-slate-850 hover:bg-transparent">
                            <TableHead className="text-slate-400 font-mono text-xs uppercase">SERVER</TableHead>
                            <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">LƯƠNG CƠ BẢN</TableHead>
                            <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">HÀNH ĐỘNG</TableHead>
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {serverWeekSalaries.map((sws) => (
                            <TableRow key={sws.id} className="border-slate-850">
                              <TableCell className="font-semibold text-slate-200">{sws.server?.name || 'N/A'}</TableCell>
                              <TableCell className="text-right font-mono text-slate-200">
                                {formatVND(sws.base_salary)}
                              </TableCell>
                              <TableCell className="text-right">
                                <Button
                                  type="button"
                                  onClick={() => handleDeleteServerSalary(sws.id)}
                                  className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 h-7 px-2.5 rounded text-[11px]"
                                >
                                  Xóa
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                          {serverWeekSalaries.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={3} className="text-center text-slate-500 py-8 text-xs">
                                Chưa có server nào được cấu hình lương tuần này.
                              </TableCell>
                            </TableRow>
                          )}
                        </TableBody>
                      </Table>
                    </div>
                  </CardContent>
                </Card>
              </div>

              {/* Right Column: Shift bonuses & Daily allowances */}
              <div className="lg:col-span-2 space-y-6">

                {/* Shift-specific bonuses configuration */}
                <Card className="bg-slate-900/40 border-slate-855 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                      <Clock className="w-4 h-4 text-cyan-400" />
                      Lương Thưởng Theo Ca Làm
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                      Thiết lập tiền thưởng/phụ cấp thêm cho từng ca trực cụ thể theo các ngày trong tuần.
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Create / Update Form */}
                    <form onSubmit={handleSaveShiftBonus} className="space-y-4">
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        {/* Shift Selection */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-400 font-mono">CHỌN CA LÀM VIỆC</label>
                          <Select
                            options={shifts.map((shift: any) => ({
                              value: String(shift.id),
                              label: `${shift.server?.name || 'N/A'} - ${shift.start_time} ${shift.name ? `(${shift.name})` : ''}`
                            }))}
                            value={
                              shifts
                                .map((shift: any) => ({
                                  value: String(shift.id),
                                  label: `${shift.server?.name || 'N/A'} - ${shift.start_time} ${shift.name ? `(${shift.name})` : ''}`
                                }))
                                .find((opt: any) => opt.value === selectedShiftId) || null
                            }
                            onChange={(val: any) => setSelectedShiftId(val ? val.value : '')}
                            placeholder="-- Chọn ca làm của tuần này --"
                            styles={selectStyles}
                            menuPortalTarget={typeof window !== 'undefined' ? document.body : undefined}
                            isSearchable
                            isClearable
                          />
                        </div>

                        {/* Bonus Amount Input */}
                        <div className="space-y-1.5">
                          <label className="text-[10px] text-slate-400 font-mono">SỐ TIỀN THƯỞNG</label>
                          <Input
                            type="text"
                            inputMode="numeric"
                            placeholder="VD: 50.000"
                            value={shiftBonusAmountInput ? new Intl.NumberFormat('vi-VN').format(Number(shiftBonusAmountInput)) : ''}
                            onChange={(e) => {
                              const raw = parseInt(e.target.value.replace(/\./g, '').replace(/,/g, ''), 10);
                              setShiftBonusAmountInput(isNaN(raw) ? '' : String(raw));
                            }}
                            required
                            className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20"
                          />
                        </div>
                      </div>

                      {/* Days of week selection */}
                      <div className="space-y-2">
                        <div className="flex items-center justify-between">
                          <label className="text-[10px] text-slate-400 font-mono">CHỌN NGÀY ÁP DỤNG TRONG TUẦN</label>
                          <div className="flex gap-2">
                            <Button
                              type="button"
                              onClick={() => {
                                const allDays: string[] = [];
                                const currentMon = new Date(startDate);
                                for (let i = 0; i < 7; i++) {
                                  const d = new Date(currentMon);
                                  d.setDate(currentMon.getDate() + i);
                                  allDays.push(d.toISOString().split('T')[0]);
                                }
                                setSelectedDays(allDays);
                              }}
                              className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] h-6 px-2 rounded"
                            >
                              Chọn Tất Cả
                            </Button>
                            <Button
                              type="button"
                              onClick={() => setSelectedDays([])}
                              className="bg-slate-800 hover:bg-slate-750 text-slate-300 text-[10px] h-6 px-2 rounded"
                            >
                              Bỏ Chọn
                            </Button>
                          </div>
                        </div>
                        <div className="grid grid-cols-2 sm:grid-cols-4 md:grid-cols-7 gap-2">
                          {Array.from({ length: 7 }).map((_, index) => {
                            const currentMon = new Date(startDate);
                            const d = new Date(currentMon);
                            d.setDate(currentMon.getDate() + index);
                            const dayStr = d.toISOString().split('T')[0];
                            const dayName = d.toLocaleDateString('vi-VN', { weekday: 'long' });
                            const isSelected = selectedDays.includes(dayStr);

                            return (
                              <Button
                                key={dayStr}
                                type="button"
                                onClick={() => {
                                  if (isSelected) {
                                    setSelectedDays(selectedDays.filter((x) => x !== dayStr));
                                  } else {
                                    setSelectedDays([...selectedDays, dayStr]);
                                  }
                                }}
                                className={`h-10 text-[11px] rounded-lg border flex flex-col justify-center items-center gap-0.5 ${d.getDay() === 0 ? 'border-red-500/20' : 'border-slate-800'} ${
                                  isSelected
                                    ? 'bg-cyan-500 text-slate-950 font-semibold border-cyan-500 hover:bg-cyan-600'
                                    : 'bg-slate-950/40 text-slate-300 hover:bg-slate-900/60 hover:text-slate-100'
                                }`}
                              >
                                <span>{formatWeekDayLabel(dayName)}</span>
                                <span className="text-[9px] opacity-75 font-mono">{d.getDate()}/{d.getMonth() + 1}</span>
                              </Button>
                            );
                          })}
                        </div>
                      </div>

                      <Button
                        type="submit"
                        disabled={isSavingShiftBonus}
                        className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs h-9 rounded flex items-center justify-center gap-1.5 ml-auto"
                      >
                        {isSavingShiftBonus && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                        Lưu Cấu Hình Thưởng Ca
                      </Button>
                    </form>

                    <div className="border-t border-slate-850 pt-4 space-y-3">
                      <label className="text-[10px] text-slate-400 font-mono block">DANH SÁCH THƯỞNG CA TRONG TUẦN</label>
                      <div className="overflow-x-auto">
                        <Table>
                          <TableHeader className="border-slate-850">
                            <TableRow className="border-slate-850 hover:bg-transparent">
                              <TableHead className="text-slate-400 font-mono text-xs uppercase">CA LÀM VIỆC</TableHead>
                              <TableHead className="text-slate-400 font-mono text-xs uppercase">NGÀY ÁP DỤNG</TableHead>
                              <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">TIỀN THƯỞNG</TableHead>
                              <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">HÀNH ĐỘNG</TableHead>
                            </TableRow>
                          </TableHeader>
                          <TableBody>
                            {shiftDayBonuses.map((sdb) => {
                              const sDate = new Date(sdb.work_date);
                              const dayLabel = sDate.toLocaleDateString('vi-VN', { weekday: 'long' });
                              return (
                                <TableRow key={sdb.id} className="border-slate-850">
                                  <TableCell className="font-semibold text-slate-200">
                                    {sdb.shift?.server?.name || 'N/A'} - {sdb.shift?.start_time} {sdb.shift?.name ? `(${sdb.shift.name})` : ''}
                                  </TableCell>
                                  <TableCell className="font-mono text-xs text-slate-200">
                                    {dayLabel} ({formatDateVi(sdb.work_date)})
                                  </TableCell>
                                  <TableCell className="text-right font-mono text-slate-200">
                                    {formatVND(sdb.amount)}
                                  </TableCell>
                                  <TableCell className="text-right">
                                    <Button
                                      type="button"
                                      onClick={() => handleDeleteShiftBonus(sdb.id)}
                                      className="bg-red-500/10 hover:bg-red-500/20 border border-red-500/25 text-red-400 h-7 px-2.5 rounded text-[11px]"
                                    >
                                      Xóa
                                    </Button>
                                  </TableCell>
                                </TableRow>
                              );
                            })}
                            {shiftDayBonuses.length === 0 && (
                              <TableRow>
                                <TableCell colSpan={4} className="text-center text-slate-500 py-8 text-xs">
                                  Chưa có thưởng theo ca nào được cấu hình cho tuần này.
                                </TableCell>
                              </TableRow>
                            )}
                          </TableBody>
                        </Table>
                      </div>
                    </div>
                  </CardContent>
                </Card>

                {/* Phụ Cấp Theo Ngày Card */}
                <Card className="bg-slate-900/40 border-slate-855 backdrop-blur-xl">
                  <CardHeader>
                    <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                      <Calendar className="w-4 h-4 text-cyan-400" />
                      Phụ Cấp Theo Ngày
                    </CardTitle>
                    <CardDescription className="text-slate-400 text-xs">
                      Đặt tiền phụ cấp/thưởng riêng theo ngày cụ thể (áp dụng cho toàn bộ nhân sự làm việc ngày đó).
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="space-y-6">
                    {/* Create / Update Form */}
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
                          {payrollAllowances.length === 0 && (
                            <TableRow>
                              <TableCell colSpan={4} className="text-center text-slate-500 py-8 text-xs">
                                Chưa có ngày phụ cấp nào.
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
            <div className="grid grid-cols-1 sm:grid-cols-4 gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-xs leading-relaxed">
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Số Ca Hoàn Thành</span>
                <strong className="text-sm sm:text-base text-cyan-400">{selectedStaff?.completedShifts} / {selectedStaff?.totalShifts}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Phụ Cấp Đêm</span>
                <strong className="text-sm sm:text-base text-yellow-400">{selectedStaff ? formatVND(selectedStaff.totalNightBonus) : '0đ'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Phụ Cấp Khác</span>
                <strong className="text-sm sm:text-base text-indigo-400">{selectedStaff ? formatVND(selectedStaff.totalOtherAllowance) : '0đ'}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Tổng Thực Nhận</span>
                <strong className="text-sm sm:text-base text-emerald-400">{selectedStaff ? formatVND(selectedStaff.totalSalary) : '0đ'}</strong>
              </div>
            </div>

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

    </div>
  );
}

function BaseSalaryHead() {
  return (
    <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">LƯƠNG CƠ BẢN</TableHead>
  );
}
