'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';
import {
  format,
  startOfMonth,
  endOfMonth,
  eachDayOfInterval,
  isSameDay,
  addMonths,
  subMonths,
  parseISO,
  startOfWeek,
  endOfWeek,
  addDays
} from 'date-fns';
import { vi } from 'date-fns/locale';
import DatePicker, { registerLocale, setDefaultLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import {
  Calendar as CalendarIcon,
  DollarSign,
  Clock,
  Server,
  CheckCircle2,
  XCircle,
  X,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Download,
  Loader2,
  TrendingUp,
  Sparkles,
  Filter,
  SlidersHorizontal,
  Maximize2,
  Minimize2
} from 'lucide-react';

registerLocale('vi', vi);
setDefaultLocale('vi');

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    backgroundColor: '#0f172a',
    borderColor: state.isFocused ? '#22d3ee' : '#1e293b',
    color: 'white',
    minHeight: '40px',
    borderRadius: '8px',
    fontSize: '14px',
    boxShadow: state.isFocused ? '0 0 0 1px rgba(34, 211, 238, 0.5)' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#22d3ee' : '#334155' }
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#0f172a',
    border: '1px solid #1e293b',
    borderRadius: '8px',
    zIndex: 9999
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0891b2' : state.isFocused ? '#1e293b' : 'transparent',
    color: 'white',
    fontSize: '14px',
    cursor: 'pointer',
    '&:active': { backgroundColor: '#0e7490' }
  }),
  multiValue: (base: any) => ({
    ...base,
    backgroundColor: '#1e293b',
    borderRadius: '6px',
  }),
  multiValueLabel: (base: any) => ({
    ...base,
    color: '#22d3ee',
  }),
  multiValueRemove: (base: any) => ({
    ...base,
    color: '#ef4444',
    '&:hover': {
      backgroundColor: '#f87171',
      color: 'white',
    },
  }),
  singleValue: (base: any) => ({ ...base, color: 'white' }),
  placeholder: (base: any) => ({ ...base, color: '#64748b' })
};

const formatWeekDayLabel = (nameOfDay: string) => {
  const cleanName = nameOfDay.toLowerCase().trim();
  if (cleanName.includes('chủ nhật') || cleanName.includes('cn') || cleanName.includes('sun')) return 'CN';
  if (cleanName.includes('bảy') || cleanName.includes('bay') || cleanName.includes('sat') || cleanName.includes('t7') || cleanName.includes('7')) return 'T7';
  if (cleanName.includes('hai') || cleanName.includes('mon') || cleanName.includes('t2') || cleanName.includes('2')) return 'T2';
  if (cleanName.includes('ba') || cleanName.includes('tue') || cleanName.includes('t3') || cleanName.includes('3')) return 'T3';
  if (cleanName.includes('tư') || cleanName.includes('tu') || cleanName.includes('wed') || cleanName.includes('t4') || cleanName.includes('4')) return 'T4';
  if (cleanName.includes('năm') || cleanName.includes('nam') || cleanName.includes('thu') || cleanName.includes('t5') || cleanName.includes('5')) return 'T5';
  if (cleanName.includes('sáu') || cleanName.includes('sau') || cleanName.includes('fri') || cleanName.includes('t6') || cleanName.includes('6')) return 'T6';
  return nameOfDay;
};

interface ShiftAssignment {
  id: string;
  user_id: string;
  shift_id: string;
  work_date: string;
  status: string;
  shift: {
    name: string;
    start_time: string;
    end_time: string;
    server: {
      name: string;
    };
  };
  attendance_logs?: Array<{
    status: string;
    confirm_at?: string;
  }>;
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
  details: Array<{
    assignmentId: string;
    workDate: string;
    shiftName: string;
    serverName: string;
    startTime: string;
    endTime: string;
    status: string;
    baseSalary: number;
    nightBonus: number;
    weekendBonus: number;
    otherAllowance: number;
    shiftReward: number;
    totalSalary: number;
    isCompleted: boolean;
  }>;
}

export default function StaffPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  // Navigation states
  const [activeTab, setActiveTab] = useState<'schedule' | 'matrix'>('matrix');

  // Matrix View states
  const [servers, setServers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [matrixAssignments, setMatrixAssignments] = useState<any[]>([]);
  const [selectedServerFilter, setSelectedServerFilter] = useState<string>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);
  const [matrixDate, setMatrixDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [isMatrixLoading, setIsMatrixLoading] = useState(false);
  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLElement | null>(null);

  const [selectedMatrixCell, setSelectedMatrixCell] = useState<{ shift: any; dateStr: string; cellAssigns: any[] } | null>(null);
  const [isDetailDialogOpen, setIsDetailDialogOpen] = useState(false);
  const [isMobileFilterOpen, setIsMobileFilterOpen] = useState(false);

  const handleCellClick = (shift: any, day: Date, cellAssigns: any[]) => {
    const targetDate = getDatabaseWorkDate(shift, day);
    const dateStr = format(targetDate, 'yyyy-MM-dd');
    setSelectedMatrixCell({
      shift,
      dateStr,
      cellAssigns
    });
    setIsDetailDialogOpen(true);
  };

  useEffect(() => {
    setMenuPortalTarget(document.body);
  }, []);

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isFullscreen) {
        setIsFullscreen(false);
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isFullscreen]);

  // Schedule states
  const [currentDate, setCurrentDate] = useState<Date>(new Date());
  const [assignments, setAssignments] = useState<ShiftAssignment[]>([]);
  const [selectedDay, setSelectedDay] = useState<Date>(new Date());
  const [isScheduleLoading, setIsScheduleLoading] = useState(false);

  // Payroll states
  const [payrollStartDate, setPayrollStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [payrollEndDate, setPayrollEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));
  const [payrollData, setPayrollData] = useState<PayrollRecord | null>(null);
  const [isPayrollLoading, setIsPayrollLoading] = useState(false);
  const [settings, setSettings] = useState<{ reminderMinutes: number; preparationMinutes: number } | null>(null);

  // Fetch settings on mount
  useEffect(() => {
    const fetchSettings = async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          setSettings(data);
        }
      } catch (err) {
        console.error('Lỗi khi tải cấu hình:', err);
      }
    };
    fetchSettings();
  }, [API_URL]);

  // Fetch personal shifts
  const fetchMyShifts = useCallback(async () => {
    setIsScheduleLoading(true);
    const start = format(startOfMonth(currentDate), 'yyyy-MM-dd');
    const end = format(endOfMonth(currentDate), 'yyyy-MM-dd');
    console.log('Fetching shifts from:', start, 'to:', end);

    try {
      const res = await apiFetch(`${API_URL}/shifts/my-assignments?start_date=${start}&end_date=${end}`);
      console.log('Shifts response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Shifts response data:', data);
        setAssignments(data);
      } else {
        const text = await res.text();
        console.error('Shifts error response:', text);
      }
    } catch (err) {
      console.error('Lỗi khi tải lịch làm việc:', err);
    } finally {
      setIsScheduleLoading(false);
    }
  }, [currentDate, API_URL]);

  // Fetch personal payroll
  const fetchMyPayroll = useCallback(async () => {
    setIsPayrollLoading(true);
    console.log('Fetching payroll from:', payrollStartDate, 'to:', payrollEndDate);
    try {
      const res = await apiFetch(`${API_URL}/payroll/my-payroll?start_date=${payrollStartDate}&end_date=${payrollEndDate}`);
      console.log('Payroll response status:', res.status);
      if (res.ok) {
        const data = await res.json();
        console.log('Payroll response data:', data);
        setPayrollData(data);
      } else {
        const text = await res.text();
        console.error('Payroll error response:', text);
      }
    } catch (err) {
      console.error('Lỗi khi tải bảng lương:', err);
    } finally {
      setIsPayrollLoading(false);
    }
  }, [payrollStartDate, payrollEndDate, API_URL]);

  // Fetch matrix scheduling data for staff overview
  const fetchMatrixData = useCallback(async () => {
    setIsMatrixLoading(true);
    try {
      const startStr = format(matrixDate, 'yyyy-MM-dd');
      const endStr = format(addDays(matrixDate, 7), 'yyyy-MM-dd');

      const [serversRes, shiftsRes, usersRes, assignRes] = await Promise.all([
        apiFetch(`${API_URL}/servers`),
        apiFetch(`${API_URL}/shifts?week_start_date=${startStr}`),
        apiFetch(`${API_URL}/users`),
        apiFetch(`${API_URL}/shifts/assignments?start_date=${startStr}&end_date=${endStr}`)
      ]);

      if (serversRes.ok) setServers(await serversRes.json());
      if (shiftsRes.ok) setShifts(await shiftsRes.json());
      if (usersRes.ok) setUsers(await usersRes.json());
      if (assignRes.ok) setMatrixAssignments(await assignRes.json());
    } catch (e) {
      console.error('Failed to fetch matrix scheduling data:', e);
    } finally {
      setIsMatrixLoading(false);
    }
  }, [API_URL, matrixDate]);

  useEffect(() => {
    if (activeTab === 'schedule') {
      fetchMyShifts();
    } else if (activeTab === 'matrix') {
      fetchMatrixData();
    } else {
      fetchMyPayroll();
    }
  }, [activeTab, fetchMyShifts, fetchMatrixData, fetchMyPayroll]);

  useEffect(() => {
    if (activeTab === 'matrix') {
      fetchMatrixData();
    }
  }, [matrixDate, fetchMatrixData, activeTab]);

  // Compute 8 days: from Monday of selected week to Monday of next week
  const weekDays = Array.from({ length: 8 }).map((_, i) => addDays(matrixDate, i));

  // Helper: check if a shift+date combo belongs to the current week
  const isShiftInCurrentWeek = useCallback((shift: any, day: Date): boolean => {
    const weekStartMon = matrixDate;
    const nextWeekMon = addDays(weekStartMon, 7);
    const [sh, sm] = (shift.start_time || '00:00').split(':').map(Number);
    const cellDate = new Date(day);
    cellDate.setHours(sh, sm, 0, 0);
    const weekStart = new Date(weekStartMon);
    weekStart.setHours(7, 0, 0, 0);
    const weekEnd = new Date(nextWeekMon);
    weekEnd.setHours(7, 0, 0, 0);
    return cellDate >= weekStart && cellDate < weekEnd;
  }, [matrixDate]);

  const getDatabaseWorkDate = useCallback((shift: any, day: Date): Date => {
    return day;
  }, []);

  const filteredShifts = shifts.filter((shift: any) => {
    // 1. Filter by Server
    if (selectedServerFilter !== 'all' && String(shift.server_id) !== selectedServerFilter) {
      return false;
    }
    
    // 2. Filter by User/Staff
    if (selectedUserFilter !== 'all') {
      const hasAssignmentForUser = matrixAssignments.some((a: any) => {
        const isSameShift = a.shift_id === shift.id;
        const isSameUser = String(a.user_id) === selectedUserFilter;
        const dateStr = format(new Date(a.work_date), 'yyyy-MM-dd');
        const isInWeek = weekDays.some(day => format(getDatabaseWorkDate(shift, day), 'yyyy-MM-dd') === dateStr);
        return isSameShift && isSameUser && isInWeek;
      });
      if (!hasAssignmentForUser) {
        return false;
      }
    }
    
    return true;
  });

  // Calendar calculations
  const monthStart = startOfMonth(currentDate);
  const monthEnd = endOfMonth(monthStart);
  const startDate = startOfWeek(monthStart, { weekStartsOn: 1 });
  const endDate = endOfWeek(monthEnd, { weekStartsOn: 1 });

  const days = eachDayOfInterval({ start: startDate, end: endDate });

  const handlePrevMonth = () => setCurrentDate(subMonths(currentDate, 1));
  const handleNextMonth = () => setCurrentDate(addMonths(currentDate, 1));

  // Get assignments for a specific day
  const getAssignmentsForDay = (day: Date) => {
    return assignments.filter((assign) => {
      const assignDate = parseISO(assign.work_date);
      return isSameDay(assignDate, day);
    });
  };

  // Helper formatting numbers to VND currency
  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + 'đ';
  };

  const getShiftStatus = (status: string, attendanceStatus?: string, workDateStr?: string, startTimeStr?: string) => {
    if (attendanceStatus === 'ABSENT' || status === 'ABSENT') {
      return 'ABSENT';
    }
    if (attendanceStatus === 'READY' || attendanceStatus === 'PRESENT') {
      if (workDateStr) {
        const today = new Date();
        today.setHours(0, 0, 0, 0);
        const workDate = parseISO(workDateStr);
        if (workDate < today) {
          return 'COMPLETED';
        }
      }
      return 'CONFIRMED';
    }

    if (workDateStr && startTimeStr) {
      const now = new Date();
      const workDate = parseISO(workDateStr);
      const [hours, minutes] = startTimeStr.split(':').map(Number);
      const shiftStart = new Date(
        workDate.getUTCFullYear(),
        workDate.getUTCMonth(),
        workDate.getUTCDate(),
        hours,
        minutes,
        0
      );

      const diffMins = Math.round((shiftStart.getTime() - now.getTime()) / 60000);
      const reminderMinutes = settings?.reminderMinutes ?? 10;
      const preparationMinutes = settings?.preparationMinutes ?? 0;
      const totalReminderStart = reminderMinutes + preparationMinutes;

      if (now > shiftStart) {
        return 'UNCONFIRMED';
      } else if (diffMins <= totalReminderStart) {
        return 'PENDING_CONFIRM';
      }
    }

    return 'SCHEDULED';
  };

  const getStatusBadge = (status: string, attendanceStatus?: string, workDateStr?: string, startTimeStr?: string) => {
    const computedStatus = getShiftStatus(status, attendanceStatus, workDateStr, startTimeStr);
    switch (computedStatus) {
      case 'ABSENT':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Vắng mặt</Badge>;
      case 'COMPLETED':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Hoàn thành</Badge>;
      case 'CONFIRMED':
        return <Badge className="bg-emerald-500/10 text-emerald-400 border-emerald-500/20">Đã xác nhận</Badge>;
      case 'UNCONFIRMED':
        return <Badge className="bg-red-500/10 text-red-400 border-red-500/20">Chưa xác nhận</Badge>;
      case 'PENDING_CONFIRM':
        return <Badge className="bg-yellow-500/10 text-yellow-400 border-yellow-500/20">Chờ xác nhận</Badge>;
      case 'SCHEDULED':
      default:
        return <Badge className="bg-cyan-500/10 text-cyan-400 border-cyan-500/20">Lên lịch</Badge>;
    }
  };

  const selectedDayAssignments = getAssignmentsForDay(selectedDay);
  const payablePayrollDetails = payrollData?.details.filter((detail) => detail.isCompleted) ?? [];
  const pendingPayrollDetailCount = payrollData ? payrollData.details.length - payablePayrollDetails.length : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-3 sm:p-6 font-sans selection:bg-cyan-500/30">
      <div className={`${activeTab === 'matrix' ? 'max-w-7xl' : 'max-w-4xl'} mx-auto space-y-6`}>

        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tighter flex items-center gap-2">
              <span className="text-cyan-400">STAFF</span>_DASHBOARD
            </h1>
            <p className="text-slate-400 mt-1 text-xs sm:text-sm">Xem lịch phân ca và thù lao cá nhân ROK</p>
          </div>
        </div>

        {/* Tab Selection */}
        <div className="flex border-b border-slate-850 gap-2">
          <button
            onClick={() => setActiveTab('matrix')}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wider transition-all border-b-2 px-4 flex items-center gap-1.5 ${activeTab === 'matrix'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <CalendarIcon className="w-4 h-4" /> BẢNG CHUNG
          </button>
          <button
            onClick={() => setActiveTab('schedule')}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wider transition-all border-b-2 px-4 flex items-center gap-1.5 ${activeTab === 'schedule'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <CalendarIcon className="w-4 h-4" /> LỊCH CỦA TÔI
          </button>
        </div>

        {/* TAB 1: SCHEDULE */}
        {activeTab === 'schedule' && (
          <div className="space-y-4">
            {/* Calendar Controls */}
            <div className="flex items-center justify-between bg-slate-900/50 border border-slate-800 p-3 rounded-xl backdrop-blur-xl">
              <div className="text-sm sm:text-base font-bold text-slate-200">
                {format(currentDate, "'Tháng' MM / yyyy", { locale: vi })}
              </div>
              <div className="flex items-center gap-1.5">
                <Button
                  onClick={handlePrevMonth}
                  variant="outline"
                  size="icon"
                  className="w-8 h-8 bg-slate-950 border-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-900"
                >
                  <ChevronLeft className="w-4 h-4" />
                </Button>
                <Button
                  onClick={() => setCurrentDate(new Date())}
                  variant="outline"
                  className="h-8 text-xs px-2.5 bg-slate-950 border-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-900"
                >
                  Hôm nay
                </Button>
                <Button
                  onClick={handleNextMonth}
                  variant="outline"
                  size="icon"
                  className="w-8 h-8 bg-slate-950 border-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-900"
                >
                  <ChevronRight className="w-4 h-4" />
                </Button>
              </div>
            </div>

            {/* Desktop & Mobile Calendar Grid */}
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
              {/* Left Column: Calendar Grid (2 cols span on larger screens) */}
              <Card className="md:col-span-2 bg-slate-900/40 border-slate-800 backdrop-blur-xl">
                <CardContent className="p-3 sm:p-4">
                  {isScheduleLoading ? (
                    <div className="h-64 flex items-center justify-center text-cyan-400">
                      <Loader2 className="w-6 h-6 animate-spin mr-2" />
                      <span className="text-xs font-mono">LOADING_SHIFTS...</span>
                    </div>
                  ) : (
                    <div>
                      {/* Weekday headers */}
                      <div className="grid grid-cols-7 text-center mb-2">
                        {['T2', 'T3', 'T4', 'T5', 'T6', 'T7', 'CN'].map((dayName, idx) => (
                          <span key={idx} className="text-[10px] sm:text-xs font-semibold font-mono text-slate-500 py-1 uppercase">
                            {dayName}
                          </span>
                        ))}
                      </div>

                      {/* Day cells */}
                      <div className="grid grid-cols-7 gap-1">
                        {days.map((day, idx) => {
                          const isCurrentMonth = day.getMonth() === currentDate.getMonth();
                          const dayShifts = getAssignmentsForDay(day);
                          const hasShifts = dayShifts.length > 0;
                          const isSelected = isSameDay(day, selectedDay);
                          const isToday = isSameDay(day, new Date());

                          return (
                            <button
                              key={idx}
                              onClick={() => setSelectedDay(day)}
                              className={`aspect-square sm:h-12 rounded-lg flex flex-col items-center justify-between p-1 transition-all border cursor-pointer relative ${isCurrentMonth ? 'text-slate-200' : 'text-slate-600 opacity-30'
                                } ${isSelected
                                  ? 'border-cyan-400 bg-cyan-950/20 shadow-[0_0_8px_rgba(34,211,238,0.2)]'
                                  : isToday
                                    ? 'border-slate-700 bg-slate-800/40'
                                    : 'border-slate-850 hover:border-slate-700 bg-slate-950/40'
                                }`}
                            >
                              <span className={`text-[10px] sm:text-xs font-mono font-semibold ${isToday ? 'text-cyan-400' : ''}`}>
                                {format(day, 'd')}
                              </span>

                              {/* Shift indicator dot */}
                              {hasShifts && (
                                <div className="flex gap-0.5 justify-center">
                                  {dayShifts.map((s, sIdx) => {
                                    const log = s.attendance_logs?.[0];
                                    const computedStatus = getShiftStatus(s.status, log?.status, s.work_date, s.shift.start_time);
                                    let dotColor = 'bg-cyan-400 shadow-[0_0_4px_rgba(6,182,212,0.6)]';
                                    if (computedStatus === 'ABSENT' || computedStatus === 'UNCONFIRMED') {
                                      dotColor = 'bg-red-400 shadow-[0_0_4px_rgba(239,68,68,0.6)]';
                                    } else if (computedStatus === 'COMPLETED' || computedStatus === 'CONFIRMED') {
                                      dotColor = 'bg-emerald-400 shadow-[0_0_4px_rgba(16,185,129,0.6)]';
                                    } else if (computedStatus === 'PENDING_CONFIRM') {
                                      dotColor = 'bg-yellow-400 shadow-[0_0_4px_rgba(250,204,21,0.6)]';
                                    }
                                    return (
                                      <span key={sIdx} className={`w-1.5 h-1.5 rounded-full ${dotColor}`} />
                                    );
                                  })}
                                </div>
                              )}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>

              {/* Right Column: Shift Details for Selected Day */}
              <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl">
                <CardHeader className="p-4 border-b border-slate-850 flex flex-row items-center justify-between">
                  <div>
                    <CardTitle className="text-sm font-bold text-slate-200 uppercase font-mono">
                      {format(selectedDay, 'dd/MM/yyyy')}
                    </CardTitle>
                    <CardDescription className="text-[10px] text-slate-400 mt-0.5">
                      Chi tiết lịch phân ca trong ngày
                    </CardDescription>
                  </div>
                  {isSameDay(selectedDay, new Date()) && (
                    <Badge variant="outline" className="text-[9px] border-cyan-500/20 text-cyan-400 uppercase tracking-widest font-mono">Hôm nay</Badge>
                  )}
                </CardHeader>
                <CardContent className="p-4">
                  {selectedDayAssignments.length === 0 ? (
                    <div className="h-36 flex flex-col items-center justify-center text-slate-500 text-center gap-1.5">
                      <CalendarIcon className="w-6 h-6 text-slate-600" />
                      <span className="text-[11px] font-mono">Không có lịch phân ca</span>
                    </div>
                  ) : (
                    <div className="space-y-3.5">
                      {selectedDayAssignments.map((assign, idx) => (
                        <div key={idx} className="p-3 bg-slate-900/50 border border-slate-850 rounded-xl space-y-2.5 transition-all hover:border-slate-700">
                          <div className="flex justify-between items-start">
                            <span className="text-xs font-bold text-cyan-400 uppercase font-mono flex items-center gap-1">
                              <Server className="w-3 h-3 text-cyan-400" />
                              {assign.shift.server?.name || 'N/A'}
                            </span>
                            {getStatusBadge(assign.status, assign.attendance_logs?.[0]?.status, assign.work_date, assign.shift.start_time)}
                          </div>

                          <div className="space-y-1 text-slate-400">
                            <div className="text-[11px] font-semibold flex items-center gap-1">
                              <Clock className="w-3 h-3 text-cyan-400" />
                              Ca: {assign.shift.start_time}
                            </div>
                            <div className="text-[11px] flex items-center gap-1">
                              <CalendarIcon className="w-3 h-3 text-slate-500" />
                              Ngày: {format(parseISO(assign.work_date), 'dd/MM/yyyy')}
                            </div>
                          </div>

                          {assign.attendance_logs?.[0]?.confirm_at && (
                            <div className="text-[10px] text-slate-500 font-mono pt-1.5 border-t border-slate-900">
                              Xác nhận lúc: {format(new Date(assign.attendance_logs[0].confirm_at), 'HH:mm dd/MM')}
                            </div>
                          )}
                        </div>
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </div>

          </div>
        )}

        {/* TAB 3: MATRIX VIEW (READ-ONLY) */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">
            {/* Week Selector Toolbar */}
            <div className="relative z-40 flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-400">Tuần phân ca:</span>
                <DatePicker
                  selected={matrixDate}
                  startDate={matrixDate}
                  endDate={addDays(matrixDate, 7)}
                  onChange={(date: Date | null) => {
                    if (date) setMatrixDate(startOfWeek(date, { weekStartsOn: 1 }));
                  }}
                  showWeekPicker
                  value={`Tuần: ${format(matrixDate, 'dd/MM')} - ${format(addDays(matrixDate, 7), 'dd/MM')}`}
                  formatWeekDay={formatWeekDayLabel}
                  portalId="shift-week-datepicker-portal"
                  popperClassName="shift-week-datepicker-popper"
                  popperPlacement="bottom-start"
                  className="flex h-10 w-52 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-cyan-400 font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                />
              </div>

              <div className="text-xs text-slate-500 font-mono">
                Thứ 2 ({format(weekDays[0], 'dd/MM')}) - Thứ 2 sau ({format(weekDays[7], 'dd/MM')}) (7h sáng → 6h59 sáng hôm sau)
              </div>
            </div>

            {/* Matrix Table */}
            <Card className={`transition-all duration-200 overflow-hidden shadow-2xl relative ${
              isFullscreen
                ? 'fixed inset-0 z-50 w-screen h-screen bg-slate-950 border-none p-0 flex flex-col rounded-none'
                : 'bg-slate-900/40 border border-slate-800 rounded-xl'
            }`}>
              {isFullscreen && (
                <Button
                  variant="ghost"
                  size="icon"
                  onClick={() => setIsFullscreen(false)}
                  className="absolute top-4 right-4 h-8 w-8 z-50 bg-slate-900 dark:bg-slate-100 text-white dark:text-slate-900 border border-slate-800 dark:border-slate-200 hover:bg-slate-800 dark:hover:bg-slate-200 shadow-lg rounded-full flex items-center justify-center transition-all"
                  title="Thoát toàn màn hình (Esc)"
                >
                  <X className="w-5 h-5" />
                </Button>
              )}

              {!isFullscreen && (
                <CardHeader className="pb-3 border-b border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                  <div>
                    <CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2">
                      <CalendarIcon className="w-5 h-5 text-cyan-400" /> Bảng Phân Phối Ca Tuần
                    </CardTitle>
                    <CardDescription>Tổng quan phân phối lịch làm các server game trong tuần (Chế độ xem).</CardDescription>
                  </div>
                  
                  {/* Filters */}
                  <div className="flex items-center gap-2 z-45">
                    {/* Desktop Filters (md and up) */}
                    <div className="hidden md:flex items-center gap-3">
                      {/* Server Select Filter */}
                      <div className="w-48 text-slate-900">
                        <Select
                          instanceId="matrix-server-filter"
                          placeholder="Lọc theo Server"
                          options={[
                            { value: 'all', label: '⚡ Tất cả Server' },
                            ...servers.map((s: any) => ({ value: String(s.id), label: `Server ${s.name}` }))
                          ]}
                          styles={selectStyles}
                          value={[
                            { value: 'all', label: '⚡ Tất cả Server' },
                            ...servers.map((s: any) => ({ value: String(s.id), label: `Server ${s.name}` }))
                          ].find(o => o.value === selectedServerFilter)}
                          onChange={(opt: any) => setSelectedServerFilter(opt ? opt.value : 'all')}
                          menuPortalTarget={menuPortalTarget}
                        />
                      </div>

                      {/* Staff Select Filter */}
                      <div className="w-52 text-slate-900">
                        <Select
                          instanceId="matrix-user-filter"
                          placeholder="Lọc theo Nhân viên"
                          options={[
                            { value: 'all', label: '👤 Tất cả Nhân viên' },
                            ...users.filter((u: any) => u.role === 'STAFF').map((u: any) => ({ value: String(u.id), label: u.full_name }))
                          ]}
                          styles={selectStyles}
                          value={[
                            { value: 'all', label: '👤 Tất cả Nhân viên' },
                            ...users.filter((u: any) => u.role === 'STAFF').map((u: any) => ({ value: String(u.id), label: u.full_name }))
                          ].find(o => o.value === selectedUserFilter)}
                          onChange={(opt: any) => setSelectedUserFilter(opt ? opt.value : 'all')}
                          menuPortalTarget={menuPortalTarget}
                        />
                      </div>

                      {/* Clear Filters Button (Desktop) */}
                      {(selectedServerFilter !== 'all' || selectedUserFilter !== 'all') && (
                        <Button
                          variant="ghost"
                          onClick={() => {
                            setSelectedServerFilter('all');
                            setSelectedUserFilter('all');
                          }}
                          className="h-10 px-3 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-1.5 transition-all text-xs font-semibold shrink-0"
                        >
                          <XCircle className="w-4 h-4" />
                          Xóa lọc
                        </Button>
                      )}
                    </div>

                    {/* Mobile Filter Button (below md) */}
                    <div className="flex md:hidden items-center gap-2">
                      <Button
                        variant="outline"
                        onClick={() => setIsMobileFilterOpen(true)}
                        className={`h-10 px-3.5 rounded-lg flex items-center gap-2 border text-xs font-semibold transition-all relative ${
                          selectedServerFilter !== 'all' || selectedUserFilter !== 'all'
                            ? 'bg-cyan-50 dark:bg-cyan-950/20 border-cyan-300 dark:border-cyan-800 text-cyan-600 dark:text-cyan-400'
                            : 'bg-slate-950 border-slate-800 text-slate-300 hover:text-cyan-400 hover:bg-slate-900'
                        }`}
                      >
                        <Filter className="w-4 h-4" />
                        Lọc lịch
                        {(selectedServerFilter !== 'all' || selectedUserFilter !== 'all') && (
                          <span className="absolute -top-1.5 -right-1.5 w-4 h-4 bg-cyan-500 text-white dark:text-slate-950 text-[9px] font-bold rounded-full flex items-center justify-center shadow-lg border border-white dark:border-slate-950 animate-pulse">
                            !
                          </span>
                        )}
                      </Button>

                      {/* Clear Filters Button (Mobile quick action) */}
                      {(selectedServerFilter !== 'all' || selectedUserFilter !== 'all') && (
                        <Button
                          variant="ghost"
                          size="icon"
                          onClick={() => {
                            setSelectedServerFilter('all');
                            setSelectedUserFilter('all');
                          }}
                          className="h-10 w-10 text-red-500 hover:text-red-450 hover:bg-red-500/10 rounded-lg flex items-center justify-center shrink-0"
                          title="Xóa lọc nhanh"
                        >
                          <XCircle className="w-4.5 h-4.5" />
                        </Button>
                      )}
                    </div>

                    {/* Fullscreen Toggle Button (Visible everywhere) */}
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => setIsFullscreen(!isFullscreen)}
                      className="h-10 w-10 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg flex items-center justify-center transition-all shrink-0"
                      title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
                    >
                      {isFullscreen ? <Minimize2 className="w-4 h-4" /> : <Maximize2 className="w-4 h-4" />}
                    </Button>
                  </div>
                </CardHeader>
              )}
              <CardContent className="p-0 flex-1 min-h-0 flex flex-col">
                {isMatrixLoading ? (
                  <div className="text-center py-12 text-cyan-400 space-y-3">
                    <Loader2 className="w-8 h-8 mx-auto animate-spin" />
                    <p className="text-sm font-mono">LOADING_MATRIX_DATA...</p>
                  </div>
                ) : shifts.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-3">
                    <AlertCircle className="w-10 h-10 mx-auto text-slate-700" />
                    <p className="text-sm">Chưa có khung giờ/ca làm nào được tạo cho tuần này.</p>
                  </div>
                ) : (
                  <div className={isFullscreen
                    ? "flex-1 min-h-0 flex flex-col [&_[data-slot=table-container]]:flex-1 [&_[data-slot=table-container]]:min-h-0 [&_[data-slot=table-container]]:overflow-auto [&_[data-slot=table-container]]:max-h-full"
                    : "[&_[data-slot=table-container]]:max-h-[70vh] [&_[data-slot=table-container]]:overflow-auto"
                  }>
                    {filteredShifts.length === 0 ? (
                      <div className="text-center py-16 text-slate-500 space-y-3 bg-white dark:bg-slate-950">
                        <AlertCircle className="w-10 h-10 mx-auto text-slate-700" />
                        <p className="text-sm font-mono">Không có ca làm nào khớp với bộ lọc hiện tại.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-slate-100 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800">
                          <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                            <TableHead className="sticky top-0 z-30 w-56 text-slate-700 dark:text-slate-300 font-bold border-r border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-slate-950 transform-gpu">SERVER / CA LÀM</TableHead>
                            {weekDays.map((day, index) => {
                              const isToday = format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                              return (
                                <TableHead key={index} className={`sticky top-0 z-20 text-center font-bold min-w-[120px] transition-colors ${isToday ? 'bg-cyan-50 dark:bg-cyan-950/20 text-cyan-600 dark:text-cyan-300' : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300'} transform-gpu`}>
                                  <div>{format(day, 'EEEE', { locale: vi }).replace('Thứ', 'T')}</div>
                                  <div className="text-xs font-mono mt-0.5 opacity-80">{format(day, 'dd/MM')}</div>
                                </TableHead>
                              );
                            })}
                          </TableRow>
                        </TableHeader>
                        <TableBody>
                          {filteredShifts.map((shift: any) => (
                            <TableRow key={shift.id} className="group border-slate-800/60 hover:bg-slate-900/30 transition-colors">
                              <TableCell
                                className="font-medium border-r border-slate-200 dark:border-slate-800/80 py-3 pr-4 bg-white dark:bg-slate-950 group-hover:bg-white dark:group-hover:bg-[#0f172a] transition-colors group/cell-header"
                              >
                                <div className="flex items-center justify-between gap-2 w-full">
                                  <div className="flex items-center gap-1.5 min-w-0">
                                    <span className="text-sm font-semibold text-cyan-600 dark:text-cyan-400 tracking-tight truncate">
                                      {shift.server?.name || 'N/A'}
                                    </span>
                                    {shift.name && (
                                      <span className="text-xs font-normal text-slate-500 dark:text-slate-400 truncate">
                                        ({shift.name})
                                      </span>
                                    )}
                                  </div>
                                  
                                  <div className="relative flex items-center shrink-0">
                                    <span className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded font-mono flex items-center gap-1">
                                      <Clock className="w-3 h-3 text-cyan-500" />
                                      {shift.start_time}
                                    </span>
                                  </div>
                                </div>
                              </TableCell>

                              {weekDays.map((day, idx) => {
                                const targetDate = getDatabaseWorkDate(shift, day);
                                const dateStr = format(targetDate, 'yyyy-MM-dd');
                                const isCellInCurrentWeek = isShiftInCurrentWeek(shift, day);
                                
                                const cellAssigns = matrixAssignments.filter(
                                  (a: any) => a.shift_id === shift.id && format(new Date(a.work_date), 'yyyy-MM-dd') === dateStr
                                );

                                return (
                                  <TableCell
                                    key={idx}
                                    onClick={() => {
                                      if (isCellInCurrentWeek) {
                                        handleCellClick(shift, day, cellAssigns);
                                      }
                                    }}
                                    className={`text-center p-2 border-r border-slate-800/30 relative group/cell min-h-[60px] transition-all ${
                                      !isCellInCurrentWeek
                                        ? 'bg-slate-900/30 dark:bg-slate-950/30 opacity-50 cursor-not-allowed'
                                        : 'cursor-pointer hover:bg-cyan-500/5'
                                    }`}
                                  >
                                    {!isCellInCurrentWeek ? (
                                      <span className="text-xs text-slate-505 font-semibold select-none">—</span>
                                    ) : cellAssigns.length === 0 ? (
                                      <span className="text-xs text-red-500/40 font-semibold select-none">x</span>
                                    ) : (
                                      <div className="flex flex-col gap-1 items-center justify-center">
                                        {cellAssigns.map((a: any) => (
                                          <Badge
                                            key={a.id}
                                            variant="outline"
                                            className="bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/60 text-cyan-800 dark:text-cyan-300 text-[11px] px-2 py-0.5 max-w-[140px] truncate"
                                          >
                                            {a.user?.full_name}
                                          </Badge>
                                        ))}
                                      </div>
                                    )}
                                  </TableCell>
                                );
                              })}
                            </TableRow>
                          ))}
                        </TableBody>
                      </Table>
                    )}
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* DIALOG: VIEW CELL DETAILS MODAL FOR STAFF */}
        <Dialog open={isDetailDialogOpen} onOpenChange={setIsDetailDialogOpen}>
          <DialogContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 rounded-xl sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <CalendarIcon className="w-5.5 h-5.5 text-cyan-600 dark:text-cyan-400" /> Chi Tiết Ca làm
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Thông tin phân lịch làm việc chi tiết.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-sm">
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Server:</span>
                <span className="font-semibold text-cyan-600 dark:text-cyan-400">{selectedMatrixCell?.shift?.server?.name || 'N/A'}</span>
              </div>
              {selectedMatrixCell?.shift?.name && (
                <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2">
                  <span className="text-slate-500 dark:text-slate-400">Mô tả ca:</span>
                  <span className="font-semibold text-slate-800 dark:text-slate-200">{selectedMatrixCell.shift.name}</span>
                </div>
              )}
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Ngày làm:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {selectedMatrixCell ? format(parseISO(selectedMatrixCell.dateStr), 'dd/MM/yyyy') : ''}
                </span>
              </div>
              <div className="flex justify-between border-b border-slate-100 dark:border-slate-800/60 pb-2">
                <span className="text-slate-500 dark:text-slate-400">Giờ bắt đầu:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200 flex items-center gap-1">
                  <Clock className="w-3.5 h-3.5 text-cyan-600 dark:text-cyan-500" />
                  {selectedMatrixCell?.shift?.start_time}
                </span>
              </div>
              <div className="space-y-2">
                <span className="text-slate-500 dark:text-slate-400 block">Nhân sự tham gia làm:</span>
                {selectedMatrixCell?.cellAssigns && selectedMatrixCell.cellAssigns.length > 0 ? (
                  <div className="flex flex-wrap gap-1.5 p-3 bg-slate-50 dark:bg-slate-950/60 border border-slate-150 dark:border-slate-850 rounded-lg">
                    {selectedMatrixCell.cellAssigns.map((a: any) => (
                      <Badge
                        key={a.id}
                        variant="outline"
                        className="bg-cyan-50 dark:bg-cyan-950/30 border-cyan-200 dark:border-cyan-800/60 text-cyan-700 dark:text-cyan-300 text-xs px-2.5 py-1 font-medium"
                      >
                        {a.user?.full_name}
                      </Badge>
                    ))}
                  </div>
                ) : (
                  <div className="text-xs text-red-650 dark:text-red-400 italic bg-red-50 dark:bg-red-500/5 p-3 rounded-lg border border-red-200 dark:border-red-500/10">
                    Chưa có nhân sự nào được phân công.
                  </div>
                )}
              </div>
            </div>

            <DialogFooter>
              <Button
                onClick={() => setIsDetailDialogOpen(false)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white dark:text-slate-950 font-bold rounded-lg h-10 px-4 w-full"
              >
                Đóng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

        {/* DIALOG: MOBILE FILTERS MODAL */}
        <Dialog open={isMobileFilterOpen} onOpenChange={setIsMobileFilterOpen}>
          <DialogContent className="bg-white dark:bg-slate-900 text-slate-900 dark:text-white border-slate-200 dark:border-slate-800 rounded-xl sm:max-w-[400px]">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2 text-slate-900 dark:text-white">
                <SlidersHorizontal className="w-5 h-5 text-cyan-600 dark:text-cyan-400" /> Bộ Lọc Lịch Làm
              </DialogTitle>
              <DialogDescription className="text-slate-500 dark:text-slate-400 text-sm mt-1">
                Chọn server hoặc nhân viên để lọc danh sách.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-3 text-sm">
              <div className="space-y-1.5">
                <label className="text-slate-500 dark:text-slate-400 font-medium block">Lọc theo Server:</label>
                <div className="text-slate-900">
                  <Select
                    instanceId="matrix-server-filter-mobile"
                    placeholder="Lọc theo Server"
                    options={[
                      { value: 'all', label: '⚡ Tất cả Server' },
                      ...servers.map((s: any) => ({ value: String(s.id), label: `Server ${s.name}` }))
                    ]}
                    styles={selectStyles}
                    value={[
                      { value: 'all', label: '⚡ Tất cả Server' },
                      ...servers.map((s: any) => ({ value: String(s.id), label: `Server ${s.name}` }))
                    ].find(o => o.value === selectedServerFilter)}
                    onChange={(opt: any) => setSelectedServerFilter(opt ? opt.value : 'all')}
                    menuPortalTarget={menuPortalTarget}
                  />
                </div>
              </div>

              <div className="space-y-1.5">
                <label className="text-slate-500 dark:text-slate-400 font-medium block">Lọc theo Nhân viên:</label>
                <div className="text-slate-900">
                  <Select
                    instanceId="matrix-user-filter-mobile"
                    placeholder="Lọc theo Nhân viên"
                    options={[
                      { value: 'all', label: '👤 Tất cả Nhân viên' },
                      ...users.filter((u: any) => u.role === 'STAFF').map((u: any) => ({ value: String(u.id), label: u.full_name }))
                    ]}
                    styles={selectStyles}
                    value={[
                      { value: 'all', label: '👤 Tất cả Nhân viên' },
                      ...users.filter((u: any) => u.role === 'STAFF').map((u: any) => ({ value: String(u.id), label: u.full_name }))
                    ].find(o => o.value === selectedUserFilter)}
                    onChange={(opt: any) => setSelectedUserFilter(opt ? opt.value : 'all')}
                    menuPortalTarget={menuPortalTarget}
                  />
                </div>
              </div>
            </div>

            <DialogFooter className="flex flex-col gap-2 mt-2">
              {(selectedServerFilter !== 'all' || selectedUserFilter !== 'all') && (
                <Button
                  variant="outline"
                  onClick={() => {
                    setSelectedServerFilter('all');
                    setSelectedUserFilter('all');
                  }}
                  className="border-red-200 dark:border-red-900/30 text-red-500 hover:bg-red-50 dark:hover:bg-red-950/20 font-semibold rounded-lg h-10 px-4 w-full"
                >
                  Xóa bộ lọc
                </Button>
              )}
              <Button
                onClick={() => setIsMobileFilterOpen(false)}
                className="bg-cyan-500 hover:bg-cyan-600 text-white dark:text-slate-950 font-bold rounded-lg h-10 px-4 w-full"
              >
                Áp dụng
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      </div>
    </div>
  );
}
