'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import DatePicker, { registerLocale, setDefaultLocale } from 'react-datepicker';
import { format, addDays, startOfWeek, setHours, setMinutes, parseISO } from 'date-fns';
import { vi } from 'date-fns/locale';
import { Calendar, Server as ServerIcon, Clock, Users, Plus, Trash2, Edit2, CheckCircle2, AlertTriangle, ShieldAlert, X, Maximize2, Minimize2 } from 'lucide-react';

registerLocale('vi', vi);
setDefaultLocale('vi');

const formatWeekDayLabel = (nameOfDay: string) => {
  const cleanName = nameOfDay.toLowerCase().trim();
  if (cleanName.includes('chủ nhật') || cleanName.includes('cn') || cleanName.includes('sun')) return 'CN';
  if (cleanName.includes('hai') || cleanName.includes('mon') || cleanName.includes('t2') || cleanName.includes('2')) return 'T2';
  if (cleanName.includes('ba') || cleanName.includes('tue') || cleanName.includes('t3') || cleanName.includes('3')) return 'T3';
  if (cleanName.includes('tư') || cleanName.includes('tu') || cleanName.includes('wed') || cleanName.includes('t4') || cleanName.includes('4')) return 'T4';
  if (cleanName.includes('năm') || cleanName.includes('nam') || cleanName.includes('thu') || cleanName.includes('t5') || cleanName.includes('5')) return 'T5';
  if (cleanName.includes('sáu') || cleanName.includes('sau') || cleanName.includes('fri') || cleanName.includes('t6') || cleanName.includes('6')) return 'T6';
  if (cleanName.includes('bảy') || cleanName.includes('bay') || cleanName.includes('sat') || cleanName.includes('t7') || cleanName.includes('7')) return 'T7';
  return nameOfDay;
};

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

const getShiftDurationHours = (startTime: string, endTime: string) => {
  const [sh, sm] = startTime.split(':').map(Number);
  const [eh, em] = endTime.split(':').map(Number);
  let diffMins = (eh * 60 + em) - (sh * 60 + sm);
  if (diffMins < 0) {
    // Over midnight (e.g. 23:00 to 02:00)
    diffMins += 24 * 60;
  }
  return diffMins / 60;
};

export default function ShiftsPage() {
  const [activeTab, setActiveTab] = useState<'matrix' | 'shifts' | 'servers'>('matrix');

  // Data States
  const [servers, setServers] = useState<any[]>([]);
  const [shifts, setShifts] = useState<any[]>([]);
  const [users, setUsers] = useState<any[]>([]);
  const [assignments, setAssignments] = useState<any[]>([]);
  const [selectedServerFilter, setSelectedServerFilter] = useState<string>('all');
  const [selectedUserFilter, setSelectedUserFilter] = useState<string>('all');
  const [isFullscreen, setIsFullscreen] = useState(false);

  // Selected Week Start Date (defaults to Monday of current week)
  const [selectedDate, setSelectedDate] = useState<Date>(startOfWeek(new Date(), { weekStartsOn: 1 }));

  // Dialog Open States
  const [isAssignDialogOpen, setIsAssignDialogOpen] = useState(false);
  const [isServerDialogOpen, setIsServerDialogOpen] = useState(false);
  const [isShiftDialogOpen, setIsShiftDialogOpen] = useState(false);

  // Active cell edit details
  const [activeCell, setActiveCell] = useState<{ shift: any; dateStr: string; userIds: string[] } | null>(null);

  // Form Creation States
  const [newServerName, setNewServerName] = useState('');
  const [newShift, setNewShift] = useState({
    server_ids: [] as string[],
    name: '',
    start_time: setHours(setMinutes(new Date(), 0), 8) as Date | null,
  });

  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLElement | null>(null);
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  useEffect(() => {
    setMenuPortalTarget(document.body);
  }, []);

  useEffect(() => {
    if (isFullscreen) {
      document.documentElement.style.overflow = 'hidden';
      document.body.style.overflow = 'hidden';
    } else {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    }
    return () => {
      document.documentElement.style.overflow = '';
      document.body.style.overflow = '';
    };
  }, [isFullscreen]);

  // Compute 7 days of the selected week (Monday to Sunday)
  const weekDays = Array.from({ length: 7 }).map((_, i) => addDays(selectedDate, i));

  const fetchData = useCallback(async () => {
    try {
      const startStr = format(selectedDate, 'yyyy-MM-dd');
      const endStr = format(addDays(selectedDate, 6), 'yyyy-MM-dd');

      const [serversRes, shiftsRes, usersRes, assignRes] = await Promise.all([
        apiFetch(`${API_URL}/servers`),
        apiFetch(`${API_URL}/shifts`),
        apiFetch(`${API_URL}/users`),
        apiFetch(`${API_URL}/shifts/assignments?start_date=${startStr}&end_date=${endStr}`)
      ]);

      setServers(await serversRes.json());
      setShifts(await shiftsRes.json());
      setUsers(await usersRes.json());
      setAssignments(await assignRes.json());
    } catch (e) {
      console.error('Failed to fetch scheduling data:', e);
    }
  }, [API_URL, selectedDate]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  // Handle Server CRUD
  const handleCreateServer = async () => {
    if (!newServerName.trim()) return;
    try {
      const res = await apiFetch(`${API_URL}/servers`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newServerName.trim() })
      });
      if (res.ok) {
        setNewServerName('');
        setIsServerDialogOpen(false);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteServer = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa server này? Tất cả các ca và phân ca thuộc server này sẽ bị xóa!')) return;
    try {
      await apiFetch(`${API_URL}/servers/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Handle Shift CRUD
  const handleCreateShift = async () => {
    if (newShift.server_ids.length === 0 || !newShift.start_time) return;
    try {
      const res = await apiFetch(`${API_URL}/shifts`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          server_ids: newShift.server_ids,
          name: newShift.name || undefined,
          start_time: format(newShift.start_time, 'HH:mm'),
          end_time: '',
        })
      });
      if (res.ok) {
        setNewShift({
          server_ids: [],
          name: '',
          start_time: setHours(setMinutes(new Date(), 0), 8),
        });
        setIsShiftDialogOpen(false);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Bạn có chắc muốn xóa ca làm này? (Lịch sử phân ca và điểm danh liên quan sẽ bị xóa)')) return;
    try {
      await apiFetch(`${API_URL}/shifts/${id}`, { method: 'DELETE' });
      fetchData();
    } catch (e) {
      console.error(e);
    }
  };

  // Cell click handler - Open Assign Dialog
  const handleCellClick = (shift: any, date: Date) => {
    const dateStr = format(date, 'yyyy-MM-dd');
    const cellAssignments = assignments.filter(
      (a: any) => a.shift_id === shift.id && format(new Date(a.work_date), 'yyyy-MM-dd') === dateStr
    );
    const assignedUserIds = cellAssignments.map((a: any) => a.user_id);

    setActiveCell({
      shift,
      dateStr,
      userIds: assignedUserIds,
    });
    setIsAssignDialogOpen(true);
  };

  // Save cell assignments
  const handleSaveCellAssignments = async () => {
    if (!activeCell) return;
    try {
      const res = await apiFetch(`${API_URL}/shifts/sync-assignments`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          shift_id: activeCell.shift.id,
          work_date: activeCell.dateStr,
          user_ids: activeCell.userIds,
        })
      });
      if (res.ok) {
        setIsAssignDialogOpen(false);
        setActiveCell(null);
        fetchData();
      }
    } catch (e) {
      console.error(e);
    }
  };

  // Weekly shifts summary per user
  const getWeeklySummary = () => {
    const summary: Record<string, { name: string; shiftCount: number }> = {};

    // Initialize summary with all STAFF role users
    users
      .filter((u: any) => u.role !== 'ADMIN')
      .forEach((u: any) => {
        summary[u.id] = { name: u.full_name, shiftCount: 0 };
      });

    // Populate summary with assignments
    assignments.forEach((a: any) => {
      if (summary[a.user_id] && a.shift) {
        summary[a.user_id].shiftCount += 1;
      }
    });

    return Object.values(summary).sort((a, b) => b.shiftCount - a.shiftCount);
  };

  const staffOptions = users
    .filter((u: any) => u.role !== 'ADMIN')
    .map((u: any) => ({ value: u.id, label: u.full_name }));

  const serverOptions = servers
    .filter((s: any) => s.status === 'ACTIVE' && !s.name.includes('+'))
    .map((s: any) => ({ value: s.id, label: s.name }));

  const filteredShifts = shifts.filter((shift: any) => {
    // 1. Filter by Server
    if (selectedServerFilter !== 'all' && String(shift.server_id) !== selectedServerFilter) {
      return false;
    }
    
    // 2. Filter by User/Staff
    if (selectedUserFilter !== 'all') {
      const hasAssignmentForUser = assignments.some((a: any) => {
        const isSameShift = a.shift_id === shift.id;
        const isSameUser = String(a.user_id) === selectedUserFilter;
        const dateStr = format(new Date(a.work_date), 'yyyy-MM-dd');
        const isInWeek = weekDays.some(day => format(day, 'yyyy-MM-dd') === dateStr);
        return isSameShift && isSameUser && isInWeek;
      });
      if (!hasAssignmentForUser) {
        return false;
      }
    }
    
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 font-sans selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto space-y-6">

        {/* Header */}
        <div className="flex flex-col md:flex-row md:items-center justify-between border-b border-slate-800 pb-5 gap-4">
          <div>
            <h1 className="text-3xl font-extrabold tracking-tight flex items-center gap-2">
              <span className="text-cyan-400">CYBER</span>_SCHEDULER
            </h1>
            <p className="text-slate-400 text-sm mt-1">Hệ thống phân ca matrix tối ưu theo Server & Khung giờ</p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex bg-slate-900 border border-slate-800 p-1.5 rounded-xl self-start md:self-center">
            <button
              onClick={() => setActiveTab('matrix')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'matrix'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Calendar className="w-4 h-4" />Quản lý Phân ca
            </button>
            <button
              onClick={() => setActiveTab('shifts')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'shifts'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <Clock className="w-4 h-4" /> Quản lý Ca làm
            </button>
            <button
              onClick={() => setActiveTab('servers')}
              className={`px-4 py-2 rounded-lg text-sm font-semibold flex items-center gap-2 transition-all ${activeTab === 'servers'
                ? 'bg-cyan-500 text-slate-950 shadow-md shadow-cyan-500/20'
                : 'text-slate-400 hover:text-slate-200'
                }`}
            >
              <ServerIcon className="w-4 h-4" /> Quản lý Server
            </button>
          </div>
        </div>

        {/* TAB 1: MATRIX VIEW */}
        {activeTab === 'matrix' && (
          <div className="space-y-6">

            {/* Top Toolbar */}
            <div className="relative z-[60] flex flex-col sm:flex-row items-center justify-between gap-4 bg-slate-900/50 border border-slate-800/80 p-4 rounded-xl backdrop-blur-xl">
              <div className="flex items-center gap-3">
                <span className="text-sm font-medium text-slate-400">Tuần phân ca:</span>
                <DatePicker
                  selected={selectedDate}
                  onChange={(date: Date | null) => {
                    if (date) setSelectedDate(startOfWeek(date, { weekStartsOn: 1 }));
                  }}
                  showWeekPicker
                  value={`Tuần: ${format(selectedDate, 'dd/MM')} - ${format(addDays(selectedDate, 6), 'dd/MM')}`}
                  formatWeekDay={formatWeekDayLabel}
                  portalId="shift-week-datepicker-portal"
                  popperClassName="shift-week-datepicker-popper"
                  popperPlacement="bottom-start"
                  className="flex h-10 w-52 rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-cyan-400 font-semibold focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                />
              </div>

              <div className="text-xs text-slate-500 font-mono">
                Thứ 2 ({format(weekDays[0], 'dd/MM')}) - Chủ Nhật ({format(weekDays[6], 'dd/MM')})
              </div>
            </div>

            {/* Matrix Table */}
            <Card className={`transition-all duration-200 overflow-hidden shadow-2xl ${
              isFullscreen
                ? 'fixed inset-0 z-50 w-screen h-screen bg-white dark:bg-slate-950 border-none p-6 flex flex-col rounded-none'
                : 'bg-slate-900/40 border border-slate-800 rounded-xl'
            }`}>
              <CardHeader className="pb-3 border-b border-slate-800/60 flex flex-col md:flex-row md:items-center justify-between gap-4">
                <div>
                  <CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2">
                    <Calendar className="w-5 h-5 text-cyan-400" /> Bảng Phân Phối Ca Tuần
                  </CardTitle>
                  <CardDescription>Click vào từng ô giao nhau giữa Server/Ca và Ngày để phân ca cho nhân viên.</CardDescription>
                </div>
                
                {/* Filters */}
                <div className="flex flex-wrap items-center gap-3 z-40">
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
                        ...users.map((u: any) => ({ value: String(u.id), label: u.full_name }))
                      ]}
                      styles={selectStyles}
                      value={[
                        { value: 'all', label: '👤 Tất cả Nhân viên' },
                        ...users.map((u: any) => ({ value: String(u.id), label: u.full_name }))
                      ].find(o => o.value === selectedUserFilter)}
                      onChange={(opt: any) => setSelectedUserFilter(opt ? opt.value : 'all')}
                      menuPortalTarget={menuPortalTarget}
                    />
                  </div>

                  {/* Clear Filters Button (only shows when filters are active) */}
                  {(selectedServerFilter !== 'all' || selectedUserFilter !== 'all') && (
                    <Button
                      variant="ghost"
                      onClick={() => {
                        setSelectedServerFilter('all');
                        setSelectedUserFilter('all');
                      }}
                      className="h-10 px-3 text-red-500 hover:text-red-400 hover:bg-red-500/10 rounded-lg flex items-center gap-1.5 transition-all text-xs font-semibold shrink-0"
                    >
                      <X className="w-4 h-4" />
                      Xóa lọc
                    </Button>
                  )}

                  {/* Fullscreen Toggle Button */}
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setIsFullscreen(!isFullscreen)}
                    className="h-10 w-10 text-slate-400 hover:text-slate-200 hover:bg-slate-800 rounded-lg flex items-center justify-center transition-all shrink-0"
                    title={isFullscreen ? "Thu nhỏ" : "Toàn màn hình"}
                  >
                    {isFullscreen ? <Minimize2 className="w-5 h-5" /> : <Maximize2 className="w-5 h-5" />}
                  </Button>
                </div>
              </CardHeader>
              <CardContent className="p-0 flex-1 min-h-0">
                {shifts.length === 0 ? (
                  <div className="text-center py-12 text-slate-500 space-y-3">
                    <ShieldAlert className="w-10 h-10 mx-auto text-slate-700" />
                    <p className="text-sm">Chưa có khung giờ/ca làm nào được tạo. Hãy sang tab **Quản lý Ca làm**.</p>
                  </div>
                ) : (
                  <div className={isFullscreen
                    ? "[&_[data-slot=table-container]]:max-h-[calc(100vh-180px)] [&_[data-slot=table-container]]:overflow-auto"
                    : "[&_[data-slot=table-container]]:max-h-[70vh] [&_[data-slot=table-container]]:overflow-auto"
                  }>
                    {filteredShifts.length === 0 ? (
                      <div className="text-center py-16 text-slate-500 space-y-3 bg-white dark:bg-slate-950">
                        <Users className="w-10 h-10 mx-auto text-slate-700" />
                        <p className="text-sm font-mono">Không có ca làm nào khớp với bộ lọc hiện tại.</p>
                      </div>
                    ) : (
                      <Table>
                        <TableHeader className="bg-slate-100 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800">
                          <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                            <TableHead className="sticky left-0 top-0 z-30 w-56 text-slate-700 dark:text-slate-300 font-bold border-r border-slate-200 dark:border-slate-800/80 bg-slate-100 dark:bg-slate-950 transform-gpu">SERVER / CA LÀM</TableHead>
                            {weekDays.map((day, index) => {
                              const isToday = format(new Date(), 'yyyy-MM-dd') === format(day, 'yyyy-MM-dd');
                              return (
                                <TableHead key={index} className={`sticky top-0 z-20 text-center font-bold min-w-[120px] transition-colors ${isToday ? 'bg-cyan-50 dark:bg-cyan-950 text-cyan-600 dark:text-cyan-300' : 'bg-slate-100 dark:bg-slate-950 text-slate-700 dark:text-slate-300'} transform-gpu`}>
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
                              <TableCell className="sticky left-0 z-10 font-medium border-r border-slate-200 dark:border-slate-800/80 py-3 pr-4 bg-white dark:bg-slate-950 group-hover:bg-white dark:group-hover:bg-[#0f172a] transition-colors transform-gpu">
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
                                  <span className="text-xs font-bold text-slate-700 dark:text-slate-200 bg-slate-100 dark:bg-slate-800/60 px-1.5 py-0.5 rounded font-mono flex items-center gap-1 shrink-0">
                                    <Clock className="w-3 h-3 text-cyan-500" />
                                    {shift.start_time}
                                  </span>
                                </div>
                              </TableCell>

                              {/* Cells (7 weekdays) */}
                              {weekDays.map((day, idx) => {
                                const dateStr = format(day, 'yyyy-MM-dd');
                                // Find assignments for this specific shift on this specific date
                                const cellAssigns = assignments.filter(
                                  (a: any) => a.shift_id === shift.id && format(new Date(a.work_date), 'yyyy-MM-dd') === dateStr
                                );

                                return (
                                  <TableCell
                                    key={idx}
                                    onClick={() => handleCellClick(shift, day)}
                                    className="text-center p-2 border-r border-slate-800/30 cursor-pointer hover:bg-cyan-500/5 transition-all relative group/cell min-h-[60px]"
                                  >
                                    {cellAssigns.length === 0 ? (
                                      <span className="text-xs text-red-500/40 font-semibold select-none group-hover/cell:text-cyan-400">x</span>
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
                                    {/* Quick edit overlay indicator */}
                                    <div className="absolute right-1 bottom-1 opacity-0 group-hover/cell:opacity-100 transition-opacity">
                                      <Edit2 className="w-3 h-3 text-cyan-400" />
                                    </div>
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

            {/* Weekly Summary Report */}
            <Card className="bg-slate-900/40 border-slate-800 backdrop-blur-xl">
              <CardHeader className="pb-3 border-b border-slate-800/60">
                <CardTitle className="text-lg font-bold text-slate-200 flex items-center gap-2">
                  <Users className="w-5 h-5 text-cyan-400" /> Thống Kê Giờ Làm Trong Tuần
                </CardTitle>
                <CardDescription>Tổng hợp số ca trực và thời gian làm việc (giờ quy đổi) của từng nhân sự từ Thứ 2 đến Chủ Nhật.</CardDescription>
              </CardHeader>
              <CardContent>
                <div className="overflow-x-auto">
                  <Table>
                    <TableHeader className="bg-slate-100 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800">
                      <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                        <TableHead className="text-slate-700 dark:text-slate-300 font-bold">NHÂN VIÊN</TableHead>
                        <TableHead className="text-right text-slate-700 dark:text-slate-300 font-bold pr-6">TỔNG SỐ CA TRỰC</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {getWeeklySummary().map((row: any, idx) => (
                        <TableRow key={idx} className="border-slate-800 hover:bg-slate-800/20">
                          <TableCell className="font-semibold text-slate-200">{row.name}</TableCell>
                          <TableCell className="text-right font-mono text-cyan-400 font-bold pr-6">{row.shiftCount} ca</TableCell>
                        </TableRow>
                      ))}
                      {getWeeklySummary().length === 0 && (
                        <TableRow>
                          <TableCell colSpan={2} className="text-center py-6 text-slate-500">
                            Chưa có dữ liệu thống kê tuần.
                          </TableCell>
                        </TableRow>
                      )}
                    </TableBody>
                  </Table>
                </div>
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 2: SHIFT MANAGEMENT */}
        {activeTab === 'shifts' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Create Shift Form */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100 lg:col-span-1 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyan-400" /> Thêm Khung Giờ Mới
                </CardTitle>
                <CardDescription>Tạo ca làm gắn liền với một Server cụ thể.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium font-mono">CHỌN SERVER (*)</label>
                  <Select
                    isMulti
                    instanceId="form-server-select"
                    options={serverOptions}
                    styles={selectStyles}
                    placeholder="-- Chọn Server game (Có thể chọn nhiều) --"
                    value={serverOptions.filter((o: any) => newShift.server_ids.includes(o.value))}
                    onChange={(selectedOptions: any) => {
                      const ids = selectedOptions ? selectedOptions.map((o: any) => o.value) : [];
                      setNewShift({ ...newShift, server_ids: ids });
                    }}
                    menuPortalTarget={menuPortalTarget}
                  />
                </div>

                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium font-mono">TÊN MÔ TẢ (TÙY CHỌN)</label>
                  <Input
                    className="bg-slate-950 border-slate-800 text-white rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500 font-mono"
                    placeholder="VD: Đêm chẵn, Ngày lẻ..."
                    value={newShift.name}
                    onChange={e => setNewShift({ ...newShift, name: e.target.value })}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newShift.server_ids.length > 0 && newShift.start_time) {
                        handleCreateShift();
                      }
                    }}
                  />
                </div>

                <div className="space-y-1.5 flex flex-col">
                  <label className="text-xs text-slate-400 font-medium font-mono">GIỜ BẮT ĐẦU CA (*)</label>
                  <DatePicker
                    selected={newShift.start_time}
                    onChange={(date: Date | null) => setNewShift({ ...newShift, start_time: date })}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={15}
                    timeCaption="Giờ"
                    dateFormat="HH:mm"
                    timeFormat="HH:mm"
                    popperClassName="z-50"
                    className="flex h-10 w-full rounded-lg border border-slate-800 bg-slate-950 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500 cursor-pointer"
                  />
                </div>

                <Button
                  onClick={handleCreateShift}
                  disabled={newShift.server_ids.length === 0 || !newShift.start_time}
                  className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold w-full h-10 rounded-lg transition-all active:scale-[0.98]"
                >
                  Thêm Khung Giờ
                </Button>
              </CardContent>
            </Card>

            {/* Shift List Table */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100 lg:col-span-2 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Danh sách Ca Làm (Khung giờ)</CardTitle>
                <CardDescription>Danh sách các khung giờ hoạt động được cấu hình theo từng Server.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {shifts.length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10 font-mono">Chưa có ca làm nào được cấu hình.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800">
                        <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                          <TableHead className="text-slate-700 dark:text-slate-300 font-bold">Server</TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 font-bold">Mô tả ca</TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 font-bold">Thời gian</TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 font-bold text-right pr-6">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {shifts.map((s: any) => (
                          <TableRow key={s.id} className="border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                            <TableCell className="font-semibold text-cyan-600 dark:text-cyan-400">{s.server?.name || 'N/A'}</TableCell>
                            <TableCell className="text-slate-300 font-medium">{s.name || '—'}</TableCell>
                            <TableCell className="font-mono text-xs text-slate-400 flex items-center gap-1 mt-3">
                              <Clock className="w-3.5 h-3.5 text-slate-500" />
                              {s.start_time}
                            </TableCell>
                            <TableCell className="text-right pr-6">
                              <Button
                                variant="destructive"
                                size="sm"
                                onClick={() => handleDeleteShift(s.id)}
                                className="h-8 px-2.5 rounded-lg active:scale-95"
                              >
                                <Trash2 className="w-3.5 h-3.5" />
                              </Button>
                            </TableCell>
                          </TableRow>
                        ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* TAB 3: SERVER MANAGEMENT */}
        {activeTab === 'servers' && (
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">

            {/* Create Server Form */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100 lg:col-span-1 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold flex items-center gap-2">
                  <Plus className="w-5 h-5 text-cyan-400" /> Thêm Server Mới
                </CardTitle>
                <CardDescription>Tạo các server game tương ứng với bảng phân ca.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium font-mono">TÊN SERVER (CHỈ NHẬP SỐ) (*)</label>
                  <Input
                    className="bg-slate-950 border-slate-800 text-white rounded-lg focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500 font-mono"
                    placeholder="VD: 2293, 2334..."
                    value={newServerName}
                    onChange={e => {
                      const val = e.target.value.replace(/\D/g, '');
                      setNewServerName(val);
                    }}
                    onKeyDown={e => {
                      if (e.key === 'Enter' && newServerName.trim()) {
                        handleCreateServer();
                      }
                    }}
                  />
                </div>
                <Button
                  onClick={handleCreateServer}
                  disabled={!newServerName.trim()}
                  className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold w-full h-10 rounded-lg transition-all active:scale-[0.98]"
                >
                  Tạo Server
                </Button>
              </CardContent>
            </Card>

            {/* Server List Table */}
            <Card className="bg-slate-900 border-slate-800 text-slate-100 lg:col-span-2 shadow-xl">
              <CardHeader>
                <CardTitle className="text-lg font-bold">Danh sách Server hoạt động</CardTitle>
                <CardDescription>Quản lý danh sách các server game có thể phân phối ca làm.</CardDescription>
              </CardHeader>
              <CardContent className="p-0">
                {servers.filter((s: any) => !s.name.includes('+')).length === 0 ? (
                  <p className="text-sm text-slate-500 text-center py-10 font-mono">Chưa có server nào được tạo.</p>
                ) : (
                  <div className="overflow-x-auto max-h-[480px] overflow-y-auto">
                    <Table>
                      <TableHeader className="bg-slate-100 dark:bg-slate-950/60 border-slate-200 dark:border-slate-800">
                        <TableRow className="hover:bg-transparent border-slate-200 dark:border-slate-800">
                          <TableHead className="text-slate-700 dark:text-slate-300 font-bold">Tên Server</TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 font-bold">Trạng thái</TableHead>
                          <TableHead className="text-slate-700 dark:text-slate-300 font-bold text-right pr-6">Thao tác</TableHead>
                        </TableRow>
                      </TableHeader>
                      <TableBody>
                        {servers
                          .filter((s: any) => !s.name.includes('+'))
                          .map((s: any) => (
                            <TableRow key={s.id} className="border-slate-800/60 hover:bg-slate-800/30 transition-colors">
                              <TableCell className="font-semibold text-cyan-600 dark:text-cyan-400 font-mono text-sm">{s.name}</TableCell>
                              <TableCell>
                                <Badge
                                  variant="outline"
                                  className={
                                    s.status === 'ACTIVE'
                                      ? 'bg-green-500/10 border-green-500/30 text-green-400 text-xs'
                                      : 'bg-slate-800 border-slate-700 text-slate-500 text-xs'
                                  }
                                >
                                  {s.status === 'ACTIVE' ? 'Đang hoạt động' : 'Tạm dừng'}
                                </Badge>
                              </TableCell>
                              <TableCell className="text-right pr-6">
                                <Button
                                  variant="destructive"
                                  size="sm"
                                  onClick={() => handleDeleteServer(s.id)}
                                  className="h-8 px-2.5 rounded-lg active:scale-95"
                                >
                                  <Trash2 className="w-3.5 h-3.5" />
                                </Button>
                              </TableCell>
                            </TableRow>
                          ))}
                      </TableBody>
                    </Table>
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        )}

        {/* DIALOG: MULTI-USER ASSIGN CELL MODAL */}
        <Dialog open={isAssignDialogOpen} onOpenChange={setIsAssignDialogOpen}>
          <DialogContent className="bg-slate-900 text-white border-slate-800 rounded-xl sm:max-w-[460px]">
            <DialogHeader>
              <DialogTitle className="text-lg font-bold flex items-center gap-2">
                <Users className="w-5.5 h-5.5 text-cyan-400" /> Cập Nhật Phân Ca Làm
              </DialogTitle>
              <DialogDescription className="text-slate-600 dark:text-slate-400 text-sm mt-1">
                Phân bổ nhân viên tham gia ca trực cho Server{" "}
                <strong className="font-bold text-cyan-600 dark:text-cyan-400">
                  {activeCell?.shift?.server?.name}
                </strong>{" "}
                vào ngày{" "}
                <strong className="font-bold text-slate-900 dark:text-slate-200">
                  {activeCell ? format(parseISO(activeCell.dateStr), 'dd/MM/yyyy') : ''}
                </strong>{" "}
                lúc{" "}
                <strong className="font-bold text-slate-900 dark:text-slate-200">
                  {activeCell?.shift?.start_time}
                </strong>.
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-4 py-4">
              <div className="space-y-2">
                <label className="text-xs text-slate-400 font-bold font-mono">CHỌN NHÂN VIÊN TRỰC CA (Mutil-select)</label>
                {activeCell && (
                  <Select
                    isMulti
                    instanceId="matrix-user-select"
                    options={staffOptions}
                    styles={selectStyles}
                    placeholder="-- Chọn một hoặc nhiều nhân sự --"
                    value={staffOptions.filter((o: any) => activeCell.userIds.includes(o.value))}
                    onChange={(selectedOptions: any) => {
                      const ids = selectedOptions ? selectedOptions.map((o: any) => o.value) : [];
                      setActiveCell({ ...activeCell, userIds: ids });
                    }}
                    menuPortalTarget={menuPortalTarget}
                  />
                )}
              </div>
            </div>

            <DialogFooter className="gap-2">
              <Button
                variant="outline"
                onClick={() => {
                  setIsAssignDialogOpen(false);
                  setActiveCell(null);
                }}
                className="border-slate-800 text-slate-300 hover:bg-slate-800 hover:text-white rounded-lg h-10 px-4"
              >
                Hủy bỏ
              </Button>
              <Button
                onClick={handleSaveCellAssignments}
                className="bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-bold rounded-lg h-10 px-4 transition-all active:scale-[0.98]"
              >
                Cập nhật ca trực
              </Button>
            </DialogFooter>
          </DialogContent>
        </Dialog>

      </div>
    </div>
  );
}
