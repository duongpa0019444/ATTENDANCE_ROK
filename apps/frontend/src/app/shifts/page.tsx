'use client';
import { useEffect, useState, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { apiFetch } from '@/lib/api';

import 'react-datepicker/dist/react-datepicker.css';
import Select from 'react-select';
import DatePicker, { registerLocale, setDefaultLocale } from 'react-datepicker';
import { format, addDays, startOfWeek, setHours, setMinutes } from 'date-fns';
import { vi } from 'date-fns/locale';

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
    backgroundColor: '#1e293b',
    borderColor: state.isFocused ? '#06b6d4' : '#334155',
    color: 'white',
    minHeight: '40px',
    height: '40px',
    borderRadius: '10px',
    fontSize: '14px',
    boxShadow: state.isFocused ? '0 0 0 2px rgba(6, 182, 212, 0.5)' : 'none',
    '&:hover': { borderColor: state.isFocused ? '#06b6d4' : '#475569' }
  }),
  valueContainer: (base: any) => ({
    ...base,
    padding: '0 12px',
    height: '38px',
    display: 'flex',
    alignItems: 'center'
  }),
  input: (base: any) => ({
    ...base,
    margin: '0',
    padding: '0',
    color: 'white'
  }),
  indicatorsContainer: (base: any) => ({
    ...base,
    height: '38px'
  }),
  dropdownIndicator: (base: any) => ({
    ...base,
    padding: '6px'
  }),
  clearIndicator: (base: any) => ({
    ...base,
    padding: '6px'
  }),
  menu: (base: any) => ({
    ...base,
    backgroundColor: '#1e293b',
    border: '1px solid #334155',
    borderRadius: '10px',
    zIndex: 9999
  }),
  menuPortal: (base: any) => ({ ...base, zIndex: 9999 }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0891b2' : state.isFocused ? '#334155' : 'transparent',
    color: 'white',
    fontSize: '14px',
    '&:active': { backgroundColor: '#0e7490' }
  }),
  singleValue: (base: any) => ({
    ...base,
    color: 'white',
    lineHeight: '38px'
  }),
  placeholder: (base: any) => ({
    ...base,
    color: '#64748b',
    fontSize: '14px',
    lineHeight: '38px'
  })
};

const WEEKDAYS = [
  { value: 1, label: 'T2' },
  { value: 2, label: 'T3' },
  { value: 3, label: 'T4' },
  { value: 4, label: 'T5' },
  { value: 5, label: 'T6' },
  { value: 6, label: 'T7' },
  { value: 0, label: 'CN' },
];

// Given selected weekday indices (0=Sun,1=Mon,...6=Sat),
// return the next occurrence dates starting from today.
function getDatesForWeekdaysInRange(startDate: Date, endDate: Date, selectedDays: number[]): Date[] {
  const dates: Date[] = [];
  const curr = new Date(startDate);
  curr.setHours(0, 0, 0, 0);

  const limit = new Date(endDate);
  limit.setHours(23, 59, 59, 999);

  while (curr <= limit) {
    const day = curr.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
    if (selectedDays.includes(day)) {
      dates.push(new Date(curr));
    }
    curr.setDate(curr.getDate() + 1);
  }
  return dates;
}

export default function ShiftsPage() {
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);

  const [menuPortalTarget, setMenuPortalTarget] = useState<HTMLElement | null>(null);

  useEffect(() => {
    setMenuPortalTarget(document.body);
  }, []);

  const [newShift, setNewShift] = useState({
    name: '',
    start_time: setHours(setMinutes(new Date(), 0), 8) as Date | null,
    end_time: setHours(setMinutes(new Date(), 0), 17) as Date | null,
  });
  const [newAssignment, setNewAssignment] = useState({
    user_id: '',
    shift_id: '',
    selectedDays: [] as number[],
    startDate: new Date() as Date | null,
    endDate: addDays(new Date(), 6) as Date | null,
  });

  // Edit state for Shifts
  const [editingShift, setEditingShift] = useState<any>(null);
  const [isEditShiftDialogOpen, setIsEditShiftDialogOpen] = useState(false);

  // Edit state for Assignments
  const [editingAssignment, setEditingAssignment] = useState<any>(null);
  const [isEditAssignmentDialogOpen, setIsEditAssignmentDialogOpen] = useState(false);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const fetchData = useCallback(async () => {
    try {
      const [shiftsRes, usersRes, assignRes] = await Promise.all([
        apiFetch(`${API_URL}/shifts`),
        apiFetch(`${API_URL}/users`),
        apiFetch(`${API_URL}/shifts/assignments`)
      ]);
      setShifts(await shiftsRes.json());
      setUsers(await usersRes.json());
      setAssignments(await assignRes.json());
    } catch (e) {
      console.error(e);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchData();
  }, [fetchData]);

  const parseTimeStringToDate = (timeStr: string) => {
    const [hours, minutes] = timeStr.split(':').map(Number);
    const d = new Date();
    return setHours(setMinutes(d, minutes), hours);
  };

  const handleCreateShift = async () => {
    if (!newShift.start_time || !newShift.end_time || !newShift.name) return;
    await apiFetch(`${API_URL}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: newShift.name,
        start_time: format(newShift.start_time, 'HH:mm'),
        end_time: format(newShift.end_time, 'HH:mm'),
      })
    });
    setNewShift({
      name: '',
      start_time: setHours(setMinutes(new Date(), 0), 8),
      end_time: setHours(setMinutes(new Date(), 0), 17),
    });
    fetchData();
  };

  const openEditShiftDialog = (shift: any) => {
    setEditingShift({
      ...shift,
      start_time: parseTimeStringToDate(shift.start_time),
      end_time: parseTimeStringToDate(shift.end_time),
    });
    setIsEditShiftDialogOpen(true);
  };

  const handleUpdateShift = async () => {
    if (!editingShift || !editingShift.name || !editingShift.start_time || !editingShift.end_time) return;
    await apiFetch(`${API_URL}/shifts/${editingShift.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        name: editingShift.name,
        start_time: format(editingShift.start_time, 'HH:mm'),
        end_time: format(editingShift.end_time, 'HH:mm'),
      })
    });
    setIsEditShiftDialogOpen(false);
    setEditingShift(null);
    fetchData();
  };

  const handleDeleteShift = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa ca làm này? (Hành động này sẽ xóa tất cả các phân ca và dữ liệu điểm danh liên quan)')) return;
    await apiFetch(`${API_URL}/shifts/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const toggleDay = (day: number) => {
    setNewAssignment(prev => ({
      ...prev,
      selectedDays: prev.selectedDays.includes(day)
        ? prev.selectedDays.filter(d => d !== day)
        : [...prev.selectedDays, day]
    }));
  };

  const handleAssignShift = async () => {
    if (
      !newAssignment.user_id ||
      !newAssignment.shift_id ||
      !newAssignment.startDate ||
      !newAssignment.endDate ||
      newAssignment.selectedDays.length === 0
    ) return;

    const dates = getDatesForWeekdaysInRange(
      newAssignment.startDate,
      newAssignment.endDate,
      newAssignment.selectedDays
    );

    if (dates.length === 0) {
      alert('Không tìm thấy ngày nào phù hợp trong khoảng thời gian đã chọn.');
      return;
    }

    const work_dates = dates.map(d => format(d, 'yyyy-MM-dd'));

    await apiFetch(`${API_URL}/shifts/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: newAssignment.user_id,
        shift_id: newAssignment.shift_id,
        work_dates,
      })
    });
    setNewAssignment({
      user_id: '',
      shift_id: '',
      selectedDays: [],
      startDate: new Date(),
      endDate: addDays(new Date(), 6),
    });
    fetchData();
  };

  const openEditAssignmentDialog = (assign: any) => {
    setEditingAssignment({
      id: assign.id,
      user_id: assign.user_id,
      shift_id: assign.shift_id,
      work_date: new Date(assign.work_date),
      status: assign.status,
    });
    setIsEditAssignmentDialogOpen(true);
  };

  const handleUpdateAssignment = async () => {
    if (!editingAssignment || !editingAssignment.user_id || !editingAssignment.shift_id || !editingAssignment.work_date) return;
    await apiFetch(`${API_URL}/shifts/assignments/${editingAssignment.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        user_id: editingAssignment.user_id,
        shift_id: editingAssignment.shift_id,
        work_date: format(editingAssignment.work_date, 'yyyy-MM-dd'),
        status: editingAssignment.status,
      })
    });
    setIsEditAssignmentDialogOpen(false);
    setEditingAssignment(null);
    fetchData();
  };

  const handleDeleteAssignment = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa lượt phân ca này? (Hành động này sẽ xóa dữ liệu điểm danh liên quan)')) return;
    await apiFetch(`${API_URL}/shifts/assignments/${id}`, { method: 'DELETE' });
    fetchData();
  };

  const selectedDates =
    newAssignment.startDate && newAssignment.endDate
      ? getDatesForWeekdaysInRange(
        newAssignment.startDate,
        newAssignment.endDate,
        newAssignment.selectedDays
      )
      : [];

  const userOptions = users
    .filter((u: any) => u.role !== 'ADMIN')
    .map((u: any) => ({ value: u.id, label: u.full_name }));
  const shiftOptions = shifts.map((s: any) => ({ value: s.id, label: `${s.name} (${s.start_time} - ${s.end_time})` }));

  const getDayName = (dateStr: string) => {
    const d = new Date(dateStr + 'T00:00:00');
    return format(d, 'EEEE', { locale: vi });
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-100">Quản lý Ca làm</h1>

      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <div className="space-y-6">
          {/* Create Shift */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader><CardTitle>Thêm Ca Mới (Khung giờ)</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <Input className="bg-slate-800 border-slate-700" placeholder="Tên ca (VD: Ca Sáng)" value={newShift.name} onChange={e => setNewShift({ ...newShift, name: e.target.value })} />
              <div className="grid grid-cols-2 gap-4">
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Giờ bắt đầu</label>
                  <DatePicker
                    selected={newShift.start_time}
                    onChange={(date: Date | null) => setNewShift({ ...newShift, start_time: date })}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={15}
                    timeCaption="Giờ"
                    dateFormat="HH:mm"
                    timeFormat="HH:mm"
                    className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
                <div className="space-y-1.5">
                  <label className="text-xs text-slate-400 font-medium">Giờ kết thúc</label>
                  <DatePicker
                    selected={newShift.end_time}
                    onChange={(date: Date | null) => setNewShift({ ...newShift, end_time: date })}
                    showTimeSelect
                    showTimeSelectOnly
                    timeIntervals={15}
                    timeCaption="Giờ"
                    dateFormat="HH:mm"
                    timeFormat="HH:mm"
                    className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                  />
                </div>
              </div>
              <Button onClick={handleCreateShift} className="bg-cyan-600 hover:bg-cyan-500 w-full h-10">Thêm Ca</Button>
            </CardContent>
          </Card>

          {/* Danh sách ca làm */}
          <Card className="bg-slate-900 border-slate-800 text-slate-100">
            <CardHeader><CardTitle>Danh sách Ca Làm (Khung giờ)</CardTitle></CardHeader>
            <CardContent>
              {shifts.length === 0 ? (
                <p className="text-sm text-slate-400 text-center py-4">Chưa có ca làm nào.</p>
              ) : (
                <div className="overflow-x-auto max-h-[300px] overflow-y-auto">
                  <Table>
                    <TableHeader className="border-slate-800">
                      <TableRow className="hover:bg-slate-800/50">
                        <TableHead className="text-slate-400">Tên ca</TableHead>
                        <TableHead className="text-slate-400">Giờ làm</TableHead>
                        <TableHead className="text-slate-400 text-right">Thao tác</TableHead>
                      </TableRow>
                    </TableHeader>
                    <TableBody>
                      {shifts.map((s: any) => (
                        <TableRow key={s.id} className="border-slate-800 hover:bg-slate-800/50">
                          <TableCell className="font-semibold text-slate-200">{s.name}</TableCell>
                          <TableCell className="font-mono text-sm text-cyan-400">{s.start_time} - {s.end_time}</TableCell>
                          <TableCell className="text-right space-x-1.5">
                            <Button variant="outline" size="sm" onClick={() => openEditShiftDialog(s)} className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 h-8 px-2.5">Sửa</Button>
                            <Button variant="destructive" size="sm" onClick={() => handleDeleteShift(s.id)} className="h-8 px-2.5">Xóa</Button>
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

        {/* Assign Shift */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader><CardTitle>Gán Ca Cho Nhân Viên</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Select
              instanceId="user-select"
              options={userOptions}
              styles={selectStyles}
              placeholder="-- Chọn nhân viên --"
              value={userOptions.find((o: any) => o.value === newAssignment.user_id) || null}
              onChange={(val: any) => setNewAssignment({ ...newAssignment, user_id: val?.value })}
              menuPortalTarget={menuPortalTarget}
            />

            <Select
              instanceId="shift-select"
              options={shiftOptions}
              styles={selectStyles}
              placeholder="-- Chọn ca làm --"
              value={shiftOptions.find((o: any) => o.value === newAssignment.shift_id) || null}
              onChange={(val: any) => setNewAssignment({ ...newAssignment, shift_id: val?.value })}
              menuPortalTarget={menuPortalTarget}
            />

            {/* Date Range Selector */}
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs text-slate-400 font-medium">Từ ngày</label>
                <DatePicker
                  selected={newAssignment.startDate}
                  onChange={(date: Date | null) => setNewAssignment({ ...newAssignment, startDate: date })}
                  dateFormat="dd/MM/yyyy"
                  formatWeekDay={formatWeekDayLabel}
                  className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div className="space-y-1.5 flex flex-col">
                <label className="text-xs text-slate-400 font-medium">Đến ngày</label>
                <DatePicker
                  selected={newAssignment.endDate}
                  onChange={(date: Date | null) => setNewAssignment({ ...newAssignment, endDate: date })}
                  dateFormat="dd/MM/yyyy"
                  minDate={newAssignment.startDate || undefined}
                  formatWeekDay={formatWeekDayLabel}
                  className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>

            {/* Weekday selector */}
            <div className="space-y-2">
              <label className="text-xs text-slate-400 font-medium">Chọn ngày trong tuần</label>
              <div className="flex gap-2">
                {WEEKDAYS.map(day => {
                  const isSelected = newAssignment.selectedDays.includes(day.value);
                  return (
                    <button
                      key={day.value}
                      type="button"
                      onClick={() => toggleDay(day.value)}
                      className={`
                        flex-1 py-2.5 rounded-lg text-sm font-semibold transition-all duration-200 border
                        ${isSelected
                          ? 'bg-cyan-600 border-cyan-500 text-white shadow-lg shadow-cyan-500/20'
                          : 'bg-slate-800 border-slate-700 text-slate-400 hover:border-slate-500 hover:text-slate-200'
                        }
                      `}
                    >
                      {day.label}
                    </button>
                  );
                })}
              </div>
              {selectedDates.length > 0 && (
                <div className="flex flex-wrap gap-1.5 mt-2">
                  {selectedDates.map(d => (
                    <span key={d.toISOString()} className="text-xs bg-cyan-900/40 text-cyan-300 px-2 py-1 rounded-md border border-cyan-800/50">
                      {format(d, 'dd/MM (EEEE)', { locale: vi })}
                    </span>
                  ))}
                </div>
              )}
            </div>

            <Button onClick={handleAssignShift} className="bg-green-600 hover:bg-green-500 w-full h-10">
              Phân Ca {selectedDates.length > 0 && `(${selectedDates.length} ngày)`}
            </Button>
          </CardContent>
        </Card>
      </div>

      {/* Lịch sử phân ca */}
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader><CardTitle>Lịch sử phân ca</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="border-slate-800">
              <TableRow className="hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Ngày làm</TableHead>
                <TableHead className="text-slate-400">Thứ</TableHead>
                <TableHead className="text-slate-400">Nhân viên</TableHead>
                <TableHead className="text-slate-400">Ca làm</TableHead>
                <TableHead className="text-slate-400 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a: any) => (
                <TableRow key={a.id} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell>{format(new Date(a.work_date), 'dd/MM/yyyy')}</TableCell>
                  <TableCell className="text-slate-400 capitalize">{getDayName(a.work_date.split('T')[0])}</TableCell>
                  <TableCell>{a.user?.full_name}</TableCell>
                  <TableCell>{a.shift?.name} ({a.shift?.start_time} - {a.shift?.end_time})</TableCell>
                  <TableCell className="text-right space-x-1.5">
                    <Button variant="outline" size="sm" onClick={() => openEditAssignmentDialog(a)} className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20 h-8 px-2.5">Sửa</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDeleteAssignment(a.id)} className="h-8 px-2.5">Xóa</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Shift Dialog */}
      <Dialog open={isEditShiftDialogOpen} onOpenChange={setIsEditShiftDialogOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle>Sửa thông tin ca làm</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Tên ca</label>
              <Input className="bg-slate-800 border-slate-700" value={editingShift?.name || ''} onChange={e => setEditingShift({ ...editingShift, name: e.target.value })} />
            </div>
            <div className="grid grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Giờ bắt đầu</label>
                <DatePicker
                  selected={editingShift?.start_time || null}
                  onChange={(date: Date | null) => setEditingShift({ ...editingShift, start_time: date })}
                  showTimeSelect
                  showTimeSelectOnly
                  timeIntervals={15}
                  timeCaption="Giờ"
                  dateFormat="HH:mm"
                  timeFormat="HH:mm"
                  className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
              <div className="space-y-1.5">
                <label className="text-xs text-slate-400 font-medium">Giờ kết thúc</label>
                <DatePicker
                  selected={editingShift?.end_time || null}
                  onChange={(date: Date | null) => setEditingShift({ ...editingShift, end_time: date })}
                  showTimeSelect
                  showTimeSelectOnly
                  timeIntervals={15}
                  timeCaption="Giờ"
                  dateFormat="HH:mm"
                  timeFormat="HH:mm"
                  className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
                />
              </div>
            </div>
            <Button onClick={handleUpdateShift} className="w-full h-10 bg-cyan-600 hover:bg-cyan-500 text-white">Lưu thay đổi</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Edit Assignment Dialog */}
      <Dialog open={isEditAssignmentDialogOpen} onOpenChange={setIsEditAssignmentDialogOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle>Sửa phân ca làm</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Nhân viên</label>
              <Select
                instanceId="edit-user-select"
                options={userOptions}
                styles={selectStyles}
                value={userOptions.find((o: any) => o.value === editingAssignment?.user_id) || null}
                onChange={(selected: any) => setEditingAssignment({ ...editingAssignment, user_id: selected?.value })}
                menuPortalTarget={menuPortalTarget}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Ca làm</label>
              <Select
                instanceId="edit-shift-select"
                options={shiftOptions}
                styles={selectStyles}
                value={shiftOptions.find((o: any) => o.value === editingAssignment?.shift_id) || null}
                onChange={(selected: any) => setEditingAssignment({ ...editingAssignment, shift_id: selected?.value })}
                menuPortalTarget={menuPortalTarget}
              />
            </div>
            <div className="space-y-2 flex flex-col">
              <label className="text-sm text-slate-400 mb-1.5">Ngày làm</label>
              <DatePicker
                selected={editingAssignment?.work_date || null}
                onChange={(date: Date | null) => setEditingAssignment({ ...editingAssignment, work_date: date })}
                dateFormat="dd/MM/yyyy"
                formatWeekDay={formatWeekDayLabel}
                className="flex h-10 w-full rounded-lg border border-slate-700 bg-slate-800 px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-cyan-500"
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Trạng thái</label>
              <Select
                instanceId="edit-status-select"
                options={[
                  { value: 'SCHEDULED', label: 'Đã lên lịch (SCHEDULED)' },
                  { value: 'COMPLETED', label: 'Hoàn thành (COMPLETED)' },
                ]}
                styles={selectStyles}
                value={{
                  value: editingAssignment?.status || 'SCHEDULED',
                  label: (editingAssignment?.status || 'SCHEDULED') === 'COMPLETED' ? 'Hoàn thành (COMPLETED)' : 'Đã lên lịch (SCHEDULED)'
                }}
                onChange={(selected: any) => setEditingAssignment({ ...editingAssignment, status: selected.value })}
                menuPortalTarget={menuPortalTarget}
              />
            </div>
            <Button onClick={handleUpdateAssignment} className="w-full h-10 bg-cyan-600 hover:bg-cyan-500 text-white">Lưu thay đổi</Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
