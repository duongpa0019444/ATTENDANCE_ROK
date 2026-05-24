'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
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
  endOfWeek
} from 'date-fns';
import { vi } from 'date-fns/locale';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  Calendar as CalendarIcon,
  DollarSign,
  Clock,
  Server,
  CheckCircle2,
  XCircle,
  AlertCircle,
  ChevronLeft,
  ChevronRight,
  ArrowRight,
  Download,
  Loader2,
  TrendingUp,
  Sparkles
} from 'lucide-react';

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
    shiftReward: number;
    totalSalary: number;
    isCompleted: boolean;
  }>;
}

export default function StaffPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  // Navigation states
  const [activeTab, setActiveTab] = useState<'schedule' | 'payroll'>('schedule');

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

  useEffect(() => {
    if (activeTab === 'schedule') {
      fetchMyShifts();
    } else {
      fetchMyPayroll();
    }
  }, [activeTab, fetchMyShifts, fetchMyPayroll]);

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

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-3 sm:p-6 font-sans selection:bg-cyan-500/30">
      <div className="max-w-4xl mx-auto space-y-6">

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
            onClick={() => setActiveTab('schedule')}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wider transition-all border-b-2 px-4 flex items-center gap-1.5 ${activeTab === 'schedule'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <CalendarIcon className="w-4 h-4" /> LỊCH LÀM VIỆC
          </button>
          <button
            onClick={() => setActiveTab('payroll')}
            className={`pb-3 text-xs sm:text-sm font-semibold tracking-wider transition-all border-b-2 px-4 flex items-center gap-1.5 ${activeTab === 'payroll'
              ? 'border-cyan-400 text-cyan-400'
              : 'border-transparent text-slate-400 hover:text-slate-200'
              }`}
          >
            <DollarSign className="w-4 h-4" /> BẢNG LƯƠNG
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

        {/* TAB 2: PAYROLL */}
        {activeTab === 'payroll' && (
          <div className="space-y-4">
            {/* Date Selectors Block */}
            <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-900/50 border border-slate-800 p-4 rounded-xl gap-4 backdrop-blur-xl">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-1.5 bg-slate-950 border border-slate-800 p-1.5 rounded-xl relative z-40">
                  <div className="flex items-center gap-1.5 px-2 py-0.5 rounded-lg hover:bg-slate-800/50 transition-colors">
                    <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <DatePicker
                      selected={payrollStartDate ? parseISO(payrollStartDate) : null}
                      onChange={(date: Date | null) => {
                        if (date) setPayrollStartDate(format(date, 'yyyy-MM-dd'));
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
                    <CalendarIcon className="w-3.5 h-3.5 text-cyan-400" />
                    <DatePicker
                      selected={payrollEndDate ? parseISO(payrollEndDate) : null}
                      onChange={(date: Date | null) => {
                        if (date) setPayrollEndDate(format(date, 'yyyy-MM-dd'));
                      }}
                      dateFormat="dd/MM/yyyy"
                      locale="vi"
                      formatWeekDay={formatWeekDayLabel}
                      popperClassName="z-50"
                      className="bg-transparent text-slate-100 text-xs font-semibold border-none outline-none focus:ring-0 w-22 text-center cursor-pointer hover:text-cyan-400 transition-colors"
                    />
                  </div>
                </div>
              </div>

              <div className="text-xs text-slate-400 font-mono uppercase bg-slate-950/40 border border-slate-800/50 px-3 py-2 rounded-lg text-center">
                📊 Kết quả tính toán tự động
              </div>
            </div>

            {/* Payroll Summary Cards */}
            {isPayrollLoading ? (
              <div className="h-48 flex items-center justify-center text-cyan-400">
                <Loader2 className="w-6 h-6 animate-spin mr-2" />
                <span className="text-xs font-mono">CALCULATING_PAYROLL...</span>
              </div>
            ) : !payrollData ? (
              <div className="h-32 flex items-center justify-center text-slate-500 text-xs font-mono">
                Không có dữ liệu bảng lương trong khoảng thời gian này.
              </div>
            ) : (
              <div className="space-y-4">
                {/* Total Salary Card */}
                <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl relative overflow-hidden">
                  <div className="absolute top-0 right-0 w-48 h-48 bg-cyan-500/5 rounded-full blur-3xl pointer-events-none"></div>
                  <CardHeader className="pb-1.5">
                    <CardDescription className="text-slate-400 text-xs font-mono uppercase tracking-widest flex items-center gap-1.5">
                      <TrendingUp className="w-3.5 h-3.5 text-cyan-400" />
                      TỔNG THỰC NHẬN CÁ NHÂN
                    </CardDescription>
                  </CardHeader>
                  <CardContent className="pb-4">
                    <div className="text-3xl sm:text-4xl font-extrabold text-emerald-400 tracking-tight">
                      {formatVND(payrollData.totalSalary)}
                    </div>
                    <div className="text-[10px] sm:text-xs text-slate-500 mt-1.5 font-mono">
                      Ca hoàn thành: {payrollData.completedShifts} / {payrollData.totalShifts} | Ca vắng: {payrollData.absentShifts}
                    </div>
                  </CardContent>
                </Card>

                {/* Salary breakdown cards grid */}
                <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
                  <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                    <div className="text-slate-400 text-[10px] font-mono leading-none">LƯƠNG CƠ BẢN</div>
                    <div className="text-sm sm:text-base font-bold text-slate-200">{formatVND(payrollData.totalBaseSalary)}</div>
                  </Card>
                  <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                    <div className="text-slate-400 text-[10px] font-mono leading-none">PHỤ CẤP ĐÊM</div>
                    <div className="text-sm sm:text-base font-bold text-cyan-400">{formatVND(payrollData.totalNightBonus)}</div>
                  </Card>
                  <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                    <div className="text-slate-400 text-[10px] font-mono leading-none">PHỤ CẤP CT</div>
                    <div className="text-sm sm:text-base font-bold text-indigo-400">{formatVND(payrollData.totalWeekendBonus)}</div>
                  </Card>
                  <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                    <div className="text-slate-400 text-[10px] font-mono leading-none">THƯỞNG CA</div>
                    <div className="text-sm sm:text-base font-bold text-yellow-400">{formatVND(payrollData.totalShiftReward)}</div>
                  </Card>
                </div>

                {/* Desktop Shifts Breakdown Table */}
                <Card className="hidden sm:block bg-slate-900/40 border-slate-800 overflow-hidden">
                  <CardHeader className="p-4 border-b border-slate-850">
                    <CardTitle className="text-sm font-bold text-slate-300 font-mono">CHI TIẾT LƯƠNG TỪNG CA</CardTitle>
                  </CardHeader>
                  <CardContent className="p-0">
                    <Table>
                      <TableHeader className="bg-slate-950/40">
                        <TableRow className="border-slate-850">
                          <TableHead className="text-[10px] font-mono uppercase text-slate-400 w-24">Ngày làm</TableHead>
                          <TableHead className="text-[10px] font-mono uppercase text-slate-400">Server / Ca</TableHead>
                          <TableHead className="text-[10px] font-mono uppercase text-slate-400 text-right">Lương ca</TableHead>
                          <TableHead className="text-[10px] font-mono uppercase text-slate-400 text-right">Phụ cấp đêm</TableHead>
                          <TableHead className="text-[10px] font-mono uppercase text-slate-400 text-right">Phụ cấp CT</TableHead>
                          <TableHead className="text-[10px] font-mono uppercase text-slate-400 text-right">Thưởng ca</TableHead>
                          <TableHead className="text-[10px] font-mono uppercase text-slate-400 text-right">Tổng nhận</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {payrollData.details.map((detail, idx) => (
                          <TableRow key={idx} className="border-slate-850 hover:bg-slate-800/10">
                            <TableCell className="text-xs font-mono text-slate-300">
                              {format(parseISO(detail.workDate), 'dd/MM/yyyy')}
                            </TableCell>
                            <TableCell>
                              <div className="text-xs font-bold text-slate-200">{detail.serverName}</div>
                              <div className="text-[10px] text-slate-500">Ca: {detail.shiftName} ({detail.startTime})</div>
                            </TableCell>
                            <TableCell className="text-xs font-mono text-slate-300 text-right">{formatVND(detail.baseSalary)}</TableCell>
                            <TableCell className="text-xs font-mono text-cyan-400 text-right">{formatVND(detail.nightBonus)}</TableCell>
                            <TableCell className="text-xs font-mono text-indigo-400 text-right">{formatVND(detail.weekendBonus)}</TableCell>
                            <TableCell className="text-xs font-mono text-yellow-400 text-right">{formatVND(detail.shiftReward)}</TableCell>
                            <TableCell className="text-xs font-bold font-mono text-emerald-400 text-right">{formatVND(detail.totalSalary)}</TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </CardContent>
                </Card>

                {/* Mobile Shifts Breakdown List */}
                <div className="block sm:hidden space-y-3">
                  <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400 px-1">Chi tiết lương từng ca</h3>
                  {payrollData.details.map((detail, idx) => (
                    <Card key={idx} className="bg-slate-900/40 border-slate-850">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex justify-between items-center pb-2 border-b border-slate-850">
                          <span className="text-xs font-mono font-semibold text-slate-300">
                            {format(parseISO(detail.workDate), 'dd/MM/yyyy')}
                          </span>
                          <span className="text-xs font-bold font-mono text-emerald-400">
                            + {formatVND(detail.totalSalary)}
                          </span>
                        </div>
                        <div className="grid grid-cols-2 gap-2 text-[10px] text-slate-400 font-mono">
                          <div>
                            <span className="text-slate-500 block uppercase">SERVER / CA</span>
                            <span className="font-bold text-slate-300">{detail.serverName} - {detail.shiftName}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block uppercase">LƯƠNG CƠ BẢN</span>
                            <span className="text-slate-300">{formatVND(detail.baseSalary)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block uppercase">PHỤ CẤP ĐÊM</span>
                            <span className="text-cyan-400">{formatVND(detail.nightBonus)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block uppercase">PHỤ CẤP CUỐI TUẦN</span>
                            <span className="text-indigo-400">{formatVND(detail.weekendBonus)}</span>
                          </div>
                          <div>
                            <span className="text-slate-500 block uppercase">THƯỞNG CA</span>
                            <span className="text-yellow-400">{formatVND(detail.shiftReward)}</span>
                          </div>
                        </div>
                      </CardContent>
                    </Card>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </div>
  );
}
