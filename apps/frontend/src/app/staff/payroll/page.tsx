'use client';

import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { apiFetch } from '@/lib/api';
import {
  format,
  startOfMonth,
  parseISO,
  startOfWeek,
  addDays
} from 'date-fns';
import { vi } from 'date-fns/locale';
import DatePicker, { registerLocale, setDefaultLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import {
  Calendar as CalendarIcon,
  DollarSign,
  ArrowRight,
  Loader2,
  TrendingUp,
  AlertCircle
} from 'lucide-react';

registerLocale('vi', vi);
setDefaultLocale('vi');

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
  adjustmentPercent?: number;
  totalAdjustment?: number;
  adjustmentNote?: string;
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

export default function StaffPayrollPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  // Payroll states
  const [selectedWeekDate, setSelectedWeekDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));
  const [payrollData, setPayrollData] = useState<PayrollRecord | null>(null);
  const [isPayrollLoading, setIsPayrollLoading] = useState(false);

  // Fetch personal payroll
  const fetchMyPayroll = useCallback(async () => {
    setIsPayrollLoading(true);
    const startStr = format(selectedWeekDate, 'yyyy-MM-dd');
    const endStr = format(addDays(selectedWeekDate, 7), 'yyyy-MM-dd');
    try {
      const res = await apiFetch(`${API_URL}/payroll/my-payroll?start_date=${startStr}&end_date=${endStr}`);
      if (res.ok) {
        const text = await res.text();
        const data = text ? JSON.parse(text) : null;
        setPayrollData(data);
      }
    } catch (err) {
      console.error('Lỗi khi tải bảng lương:', err);
    } finally {
      setIsPayrollLoading(false);
    }
  }, [selectedWeekDate, API_URL]);

  useEffect(() => {
    fetchMyPayroll();
  }, [fetchMyPayroll]);

  // Helper formatting numbers to VND currency
  const formatVND = (value: number) => {
    return new Intl.NumberFormat('vi-VN').format(Math.round(value)) + 'đ';
  };

  const payablePayrollDetails = payrollData?.details.filter((detail) => detail.isCompleted) ?? [];
  const pendingPayrollDetailCount = payrollData ? payrollData.details.length - payablePayrollDetails.length : 0;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-3 sm:p-6 font-sans selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header Block */}
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <h1 className="text-2xl sm:text-3xl font-bold tracking-tighter flex items-center gap-2">
              <span className="text-cyan-400">STAFF</span>_PAYROLL
            </h1>
            <p className="text-slate-400 mt-1 text-xs sm:text-sm">Xem thù lao cá nhân ROK</p>
          </div>
        </div>

        <div className="space-y-4">
          {/* Date Selectors Block */}
          <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between bg-slate-900/50 border border-slate-800 p-4 rounded-xl gap-4 backdrop-blur-xl">
            <div className="flex items-center gap-3">
              <DatePicker
                selected={selectedWeekDate}
                startDate={selectedWeekDate}
                endDate={addDays(selectedWeekDate, 7)}
                onChange={(date: Date | null) => {
                  if (date) setSelectedWeekDate(startOfWeek(date, { weekStartsOn: 1 }));
                }}
                showWeekPicker
                value={`Tuần: ${format(selectedWeekDate, 'dd/MM')} - ${format(addDays(selectedWeekDate, 7), 'dd/MM')}`}
                formatWeekDay={formatWeekDayLabel}
                portalId="payroll-week-datepicker-portal"
                popperClassName="payroll-week-datepicker-popper"
                popperPlacement="bottom-start"
                className="flex h-10 w-56 rounded-lg border border-slate-850 bg-slate-950 px-3 py-2 text-sm text-cyan-400 font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
              />
            </div>

            <div className="flex items-center gap-2 text-xs text-slate-500 dark:text-slate-400 font-mono bg-slate-950/40 dark:bg-slate-900/20 border border-slate-200 dark:border-slate-800/50 px-3.5 py-2 rounded-lg">
              <AlertCircle className="w-4 h-4 text-cyan-600 dark:text-cyan-450 shrink-0" />
              <span>Ghi chú: Kết quả tính toán tự động của hệ thống.</span>
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
                </CardContent>
              </Card>

              {/* Salary breakdown cards grid */}
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
                <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                  <div className="text-slate-400 text-[10px] font-mono leading-none">LƯƠNG CƠ BẢN</div>
                  <div className="text-sm sm:text-base font-bold text-slate-200">{formatVND(payrollData.totalBaseSalary)}</div>
                </Card>
                <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                  <div className="text-slate-400 text-[10px] font-mono leading-none">PHỤ CẤP ĐÊM</div>
                  <div className="text-sm sm:text-base font-bold text-cyan-400">{formatVND(payrollData.totalNightBonus)}</div>
                </Card>
                <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                  <div className="text-slate-400 text-[10px] font-mono leading-none">PHỤ CẤP CUỐI TUẦN</div>
                  <div className="text-sm sm:text-base font-bold text-indigo-400">{formatVND(payrollData.totalWeekendBonus)}</div>
                </Card>
                <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                  <div className="text-slate-400 text-[10px] font-mono leading-none">THƯỞNG CA</div>
                  <div className="text-sm sm:text-base font-bold text-amber-400">{formatVND(payrollData.totalShiftReward || 0)}</div>
                </Card>
                <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                  <div className="text-slate-400 text-[10px] font-mono leading-none">PHỤ CẤP KHÁC</div>
                  <div className="text-sm sm:text-base font-bold text-violet-400">{formatVND(payrollData.totalOtherAllowance)}</div>
                </Card>
                <Card className="bg-slate-900/50 border-slate-850 p-3 py-2.5 flex flex-col gap-0.5 justify-center">
                  <div className="text-slate-400 text-[10px] font-mono leading-none">
                    ĐIỀU CHỈNH {payrollData.adjustmentPercent ? `(${payrollData.adjustmentPercent > 0 ? '+' : ''}${payrollData.adjustmentPercent}%)` : '(0%)'}
                  </div>
                  <div className={`text-sm sm:text-base font-bold ${
                    (payrollData.totalAdjustment || 0) > 0
                      ? 'text-emerald-400'
                      : (payrollData.totalAdjustment || 0) < 0
                      ? 'text-red-400'
                      : 'text-slate-400'
                  }`}>
                    {payrollData.totalAdjustment && payrollData.totalAdjustment > 0 ? '+' : ''}
                    {formatVND(payrollData.totalAdjustment || 0)}
                  </div>
                  {payrollData.adjustmentNote && (
                    <div className="text-[9px] text-slate-500 truncate" title={payrollData.adjustmentNote}>
                      {payrollData.adjustmentNote}
                    </div>
                  )}
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
                        <TableHead className="text-[10px] font-mono uppercase text-slate-400 text-right">Phụ cấp khác</TableHead>
                        <TableHead className="text-[10px] font-mono uppercase text-slate-400 text-right">Tổng nhận</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {payablePayrollDetails.map((detail, idx) => (
                        <TableRow key={idx} className="border-slate-850 hover:bg-slate-800/10">
                          <TableCell className="text-xs font-mono text-slate-300">
                            {format(parseISO(detail.workDate), 'dd/MM/yyyy')}
                          </TableCell>
                          <TableCell>
                            <div className="flex items-center gap-2">
                              <span className="text-xs font-bold text-slate-200">{detail.serverName}</span>
                              <span className="text-[10px] text-slate-500">Ca: {detail.shiftName} ({detail.startTime})</span>
                            </div>
                          </TableCell>
                          <TableCell className="text-xs font-mono text-slate-300 text-right">{formatVND(detail.baseSalary)}</TableCell>
                          <TableCell className="text-xs font-mono text-cyan-400 text-right">{formatVND(detail.nightBonus)}</TableCell>
                          <TableCell className="text-xs font-mono text-indigo-400 text-right">{formatVND(detail.weekendBonus)}</TableCell>
                          <TableCell className="text-xs font-mono text-amber-400 text-right">{formatVND(detail.shiftReward)}</TableCell>
                          <TableCell className="text-xs font-mono text-violet-400 text-right">{formatVND(detail.otherAllowance)}</TableCell>
                          <TableCell className="text-xs font-bold font-mono text-emerald-400 text-right">{formatVND(detail.totalSalary)}</TableCell>
                        </TableRow>
                      ))}
                      {payablePayrollDetails.length === 0 && (
                        <TableRow className="border-slate-850">
                          <TableCell colSpan={8} className="h-20 text-center text-xs text-slate-500 font-mono">
                            Chưa có ca nào đủ điều kiện tính lương trong khoảng ngày này.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </CardContent>
              </Card>

              {/* Mobile Shifts Breakdown List */}
              <div className="block sm:hidden space-y-3">
                <h3 className="text-xs uppercase font-mono tracking-wider text-slate-400 px-1">Chi tiết lương từng ca</h3>
                {payablePayrollDetails.map((detail, idx) => (
                  <Card key={idx} className="bg-slate-900/40 border-slate-855">
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
                          <span className="font-bold text-slate-300">{detail.serverName} - {detail.shiftName} ({detail.startTime})</span>
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
                          <span className="text-amber-400">{formatVND(detail.shiftReward)}</span>
                        </div>
                        <div>
                          <span className="text-slate-500 block uppercase">PHỤ CẤP KHÁC</span>
                          <span className="text-violet-400">{formatVND(detail.otherAllowance)}</span>
                        </div>
                      </div>
                    </CardContent>
                  </Card>
                ))}
                {payablePayrollDetails.length === 0 && (
                  <Card className="bg-slate-900/40 border-slate-850">
                    <CardContent className="p-4 text-center text-xs text-slate-500 font-mono">
                      Chưa có ca nào đủ điều kiện tính lương trong khoảng ngày này.
                    </CardContent>
                  </Card>
                )}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
