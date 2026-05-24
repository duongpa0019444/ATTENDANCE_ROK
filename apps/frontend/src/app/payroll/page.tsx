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
  Server, Clock, Loader2, Sparkles, ArrowRight
} from 'lucide-react';
import DatePicker, { registerLocale } from 'react-datepicker';
import 'react-datepicker/dist/react-datepicker.css';
import { vi } from 'date-fns/locale';

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
  totalShiftReward: number;
  totalSalary: number;
  details: PayrollDetail[];
}

export default function PayrollPage() {
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  // Date selectors defaults to 1st of current month to today
  const [startDate, setStartDate] = useState<string>(format(startOfMonth(new Date()), 'yyyy-MM-dd'));
  const [endDate, setEndDate] = useState<string>(format(new Date(), 'yyyy-MM-dd'));

  const [activeTab, setActiveTab] = useState<'payroll' | 'settings'>('payroll');
  const [payrollData, setPayrollData] = useState<PayrollRecord[]>([]);
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [selectedStaff, setSelectedStaff] = useState<PayrollRecord | null>(null);

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

  const fetchPayroll = useCallback(async () => {
    setIsLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/payroll?start_date=${startDate}&end_date=${endDate}`);
      if (res.ok) {
        const data = await res.json();
        setPayrollData(data);
      }
    } catch (err) {
      console.error('Error fetching payroll:', err);
    } finally {
      setIsLoading(false);
    }
  }, [startDate, endDate, API_URL]);

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
      const shiftsRes = await apiFetch(`${API_URL}/shifts`);
      if (shiftsRes.ok) {
        const data = await shiftsRes.json();
        setShifts(data);
      }
    } catch (err) {
      console.error('Error fetching configuration details:', err);
    }
  }, [API_URL]);

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

  const handleUpdateServerSalary = async (serverId: string) => {
    try {
      const res = await apiFetch(`${API_URL}/servers/${serverId}`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          base_salary: parseFloat(serverBaseSalaryInput) || 0,
        }),
      });
      if (res.ok) {
        setEditingServerId(null);
        fetchSettingsAndEntities();
        fetchPayroll();
      }
    } catch (err) {
      console.error('Failed to update server salary:', err);
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
    csvContent += 'Nhân Viên,Vai Trò,Tổng Ca Làm,Lương Cơ Bản,Phụ Cấp Đêm,Phụ Cấp Cuối Tuần,Thưởng Ca,Thực Nhận (VND)\n';

    payrollData.forEach((row) => {
      csvContent += `"${row.fullName}","${row.role}",${row.completedShifts},${row.totalBaseSalary},${row.totalNightBonus},${row.totalWeekendBonus},${row.totalShiftReward},${row.totalSalary}\n`;
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
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between border-b border-slate-800 pb-4 gap-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter flex items-center gap-2">
              <span className="text-cyan-400">CYBER</span>_PAYROLL
            </h1>
            <p className="text-slate-400 mt-1 text-sm">Hệ thống quản lý thù lao và cấu hình tự động</p>
          </div>
          <div className="flex flex-wrap items-center gap-3">
            <div className="flex items-center gap-1.5 bg-slate-900 border border-slate-800 p-1.5 rounded-xl backdrop-blur-xl relative z-40">
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
            <Button
              onClick={exportToCSV}
              disabled={payrollData.length === 0}
              className="bg-slate-900 hover:bg-slate-800 border border-slate-800 text-cyan-400 font-medium text-xs flex items-center gap-1.5 h-9 rounded-lg"
            >
              <Download className="w-4 h-4" /> Xuất Báo Cáo
            </Button>
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
                          <TableCell colSpan={9} className="text-center text-slate-500 py-16">
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
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* System settings form */}
            <Card className="bg-slate-900/40 border-slate-850 backdrop-blur-xl lg:col-span-1 h-fit">
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

            {/* Server and Shift settings lists */}
            <div className="lg:col-span-2 space-y-6">

              {/* Server base salaries table */}
              <Card className="bg-slate-900/40 border-slate-855 backdrop-blur-xl">
                <CardHeader>
                  <CardTitle className="text-base text-slate-200 flex items-center gap-2">
                    <Server className="w-4 h-4 text-cyan-400" />
                    Cấu Hình Lương Theo Server
                  </CardTitle>
                </CardHeader>
                <CardContent className="p-0 sm:px-6 pb-6">
                  <div className="overflow-x-auto">
                    <Table>
                      <TableHeader className="border-slate-850">
                        <TableRow className="border-slate-850 hover:bg-transparent">
                          <TableHead className="text-slate-400 font-mono text-xs uppercase">SERVER</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">LƯƠNG CƠ BẢN / CA</TableHead>
                          <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">HÀNH ĐỘNG</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {servers.map((server) => (
                          <TableRow key={server.id} className="border-slate-850">
                            <TableCell className="font-semibold text-slate-200">{server.name}</TableCell>
                            <TableCell className="text-right font-mono">
                              {editingServerId === server.id ? (
                                <Input
                                  type="number"
                                  value={serverBaseSalaryInput}
                                  onChange={(e) => setServerBaseSalaryInput(e.target.value)}
                                  className="w-32 bg-slate-950/60 border-slate-800 text-right text-xs font-mono h-8 ml-auto"
                                />
                              ) : (
                                <span className="text-slate-200">{formatVND(server.base_salary)}</span>
                              )}
                            </TableCell>
                            <TableCell className="text-right">
                              {editingServerId === server.id ? (
                                <div className="flex justify-end gap-1.5">
                                  <Button
                                    onClick={() => handleUpdateServerSalary(server.id)}
                                    className="bg-emerald-500 hover:bg-emerald-600 text-slate-950 font-semibold h-7 px-2.5 rounded text-[11px]"
                                  >
                                    Lưu
                                  </Button>
                                  <Button
                                    onClick={() => setEditingServerId(null)}
                                    className="bg-slate-800 hover:bg-slate-700 text-slate-300 h-7 px-2.5 rounded text-[11px]"
                                  >
                                    Hủy
                                  </Button>
                                </div>
                              ) : (
                                <Button
                                  onClick={() => {
                                    setEditingServerId(server.id);
                                    setServerBaseSalaryInput(server.base_salary.toString());
                                  }}
                                  className="bg-slate-800 hover:bg-slate-750 text-[11px] h-7 px-3 text-slate-300"
                                >
                                  Sửa
                                </Button>
                              )}
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                </CardContent>
              </Card>



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
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3 bg-slate-950/40 border border-slate-800 rounded-lg text-xs leading-relaxed">
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Số Ca Hoàn Thành</span>
                <strong className="text-sm sm:text-base text-cyan-400">{selectedStaff?.completedShifts} / {selectedStaff?.totalShifts}</strong>
              </div>
              <div>
                <span className="text-slate-400 block font-mono uppercase text-[9px] tracking-wider mb-0.5">Phụ Cấp Đêm</span>
                <strong className="text-sm sm:text-base text-yellow-400">{selectedStaff ? formatVND(selectedStaff.totalNightBonus) : '0đ'}</strong>
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
                          {detail.isCompleted && detail.shiftReward > 0 ? formatVND(detail.shiftReward) : '-'}
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

    </div>
  );
}

function BaseSalaryHead() {
  return (
    <TableHead className="text-slate-400 font-mono text-xs uppercase text-right">LƯƠNG CƠ BẢN</TableHead>
  );
}

