'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Clock, AlertTriangle, CheckCircle2, Terminal, MapPin, Save, Loader2, Settings } from 'lucide-react';
import { Input } from '@/components/ui/input';
import { Button } from '@/components/ui/button';
import { useAttendanceStore, AttendanceStatus } from '@/store/useAttendanceStore';
import { socket } from '@/lib/socket';
import { apiFetch } from '@/lib/api';

interface RealtimeAlert {
  id: string;
  type: string;
  message: string;
  timestamp: string;
}

export default function AdminDashboard() {
  const { staffList, updateStaffStatus, setStaffList } = useAttendanceStore();
  const [time, setTime] = useState('');
  const [alerts, setAlerts] = useState<RealtimeAlert[]>([]);

  // Geolocation & operations configuration states
  const [latitude, setLatitude] = useState<number>(21.028511);
  const [longitude, setLongitude] = useState<number>(105.804817);
  const [radiusMeters, setRadiusMeters] = useState<number>(100);
  const [reminderMinutes, setReminderMinutes] = useState<number>(10);
  const [preparationMinutes, setPreparationMinutes] = useState<number>(0);
  const [unconfirmedWarningMinutes, setUnconfirmedWarningMinutes] = useState<number>(5);
  const [checkinGraceMinutes, setCheckinGraceMinutes] = useState<number>(5);
  const [isSavingSettings, setIsSavingSettings] = useState(false);
  const [settingsMessage, setSettingsMessage] = useState<{ type: 'success' | 'error'; text: string } | null>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const addAlert = (type: string, message: string) => {
    const newAlert: RealtimeAlert = {
      id: Math.random().toString(),
      type,
      message,
      timestamp: new Date().toLocaleTimeString(),
    };
    setAlerts((prev) => [newAlert, ...prev].slice(0, 10)); // keep last 10 alerts
  };

  useEffect(() => {
    // Clock setup
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);

    // Initial Data Fetch
    const fetchAssignments = async () => {
      try {
        const res = await apiFetch(`${API_URL}/shifts/assignments`);
        if (!res.ok) throw new Error('Failed to fetch assignments');
        const data = await res.json();

        // Map assignments to Staff interface
        const mapped = data.map((a: any) => {
          const log = a.attendance_logs?.[0];
          const serverName = a.shift?.server?.name || a.shift?.name || 'Ca làm';
          return {
            id: a.id,
            userId: a.user_id,
            name: a.user.full_name,
            shift: `${serverName} (${a.shift.start_time})`,
            status: (log?.status || 'PENDING') as AttendanceStatus,
            lateMinutes: log?.late_minutes || 0,
          };
        });
        setStaffList(mapped);
      } catch (err) {
        console.error('Error fetching shift assignments:', err);
      }
    };

    const fetchSettings = async () => {
      try {
        const res = await apiFetch(`${API_URL}/api/settings`);
        if (res.ok) {
          const data = await res.json();
          setLatitude(data.latitude);
          setLongitude(data.longitude);
          setRadiusMeters(data.radiusMeters);
          setReminderMinutes(data.reminderMinutes ?? 10);
          setPreparationMinutes(data.preparationMinutes ?? 0);
          setUnconfirmedWarningMinutes(data.unconfirmedWarningMinutes ?? 5);
          setCheckinGraceMinutes(data.checkinGraceMinutes ?? 5);
        }
      } catch (err) {
        console.error('Error fetching settings:', err);
      }
    };

    fetchAssignments();
    fetchSettings();

    // Socket setup
    socket.connect();

    socket.on('attendance-updated', (data) => {
      updateStaffStatus(data.assignmentId || data.userId, data.status);
      addAlert(
        data.status,
        `Nhân sự [${data.name}] cập nhật trạng thái thành: ${data.status}`
      );
    });

    socket.on('attendance-late', (data) => {
      updateStaffStatus(data.assignmentId || data.userId, 'LATE');
      addAlert(
        'LATE',
        `Nhân sự [${data.name}] trễ ca từ ${data.startTime || '...'} ngày ${data.dateStr || '...'} tại server [${data.serverName || data.shift || 'N/A'}]`
      );
    });

    socket.on('attendance-warning', (data) => {
      addAlert(
        'WARNING',
        `Nhân sự [${data.name}] chưa xác nhận ca từ ${data.startTime || '...'} ngày ${data.dateStr || '...'} tại server [${data.serverName || data.shift || 'N/A'}]`
      );
    });

    socket.on('manager-alert', (data) => {
      if (data.type === 'LATE_REQUESTED') {
        addAlert(
          'LATE_REQUESTED',
          `⏰ Đăng ký trễ: [${data.staffName}] xin đi trễ ${data.minutes} phút cho ca [${data.shiftName}]`
        );
      } else if (data.type === 'ABSENT_REQUESTED') {
        addAlert(
          'ABSENT_REQUESTED',
          `❌ Đăng ký nghỉ: [${data.staffName}] báo nghỉ vì: ${data.reason}`
        );
      }
    });

    return () => {
      clearInterval(timer);
      socket.disconnect();
      socket.off('attendance-updated');
      socket.off('attendance-late');
      socket.off('attendance-warning');
      socket.off('manager-alert');
    };
  }, [setStaffList, updateStaffStatus, API_URL]);

  const getStatusBadge = (status: AttendanceStatus, lateMinutes?: number) => {
    switch (status) {
      case 'PENDING':
        return (
          <Badge variant="outline" className="text-yellow-500 border-yellow-500 bg-yellow-500/10">
            <Clock className="w-3 h-3 mr-1" /> Chờ xác nhận
          </Badge>
        );
      case 'READY':
        return (
          <Badge variant="outline" className="text-cyan-400 border-cyan-400 bg-cyan-400/10">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Sẵn sàng
          </Badge>
        );
      case 'LATE_REQUESTED':
        return (
          <Badge variant="outline" className="text-orange-400 border-orange-400 bg-orange-400/10">
            <Clock className="w-3 h-3 mr-1" /> Xin đi trễ ({lateMinutes || 0}m)
          </Badge>
        );
      case 'ABSENT_REQUESTED':
        return (
          <Badge variant="outline" className="text-pink-500 border-pink-500 bg-pink-500/10">
            <AlertTriangle className="w-3 h-3 mr-1" /> Xin nghỉ phép
          </Badge>
        );
      case 'CHECKED_IN':
        return (
          <Badge variant="outline" className="text-green-500 border-green-500 bg-green-500/10">
            <CheckCircle2 className="w-3 h-3 mr-1" /> Đã check-in
          </Badge>
        );
      case 'LATE':
        return (
          <Badge variant="outline" className="text-red-500 border-red-500 bg-red-500/10 animate-pulse">
            <AlertTriangle className="w-3 h-3 mr-1" /> Đi trễ
          </Badge>
        );
      case 'ABSENT':
        return (
          <Badge variant="outline" className="text-red-700 border-red-700 bg-red-700/10">
            <AlertTriangle className="w-3 h-3 mr-1" /> Vắng mặt
          </Badge>
        );
      default:
        return <Badge variant="outline">{status}</Badge>;
    }
  };

  const getAlertIcon = (type: string) => {
    if (type.includes('LATE') || type.includes('ABSENT') || type === 'WARNING') {
      return <AlertTriangle className="w-4 h-4 text-red-500 mr-2 flex-shrink-0" />;
    }
    return <Clock className="w-4 h-4 text-cyan-400 mr-2 flex-shrink-0" />;
  };

  const handleSaveSettings = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSavingSettings(true);
    setSettingsMessage(null);
    try {
      const res = await apiFetch(`${API_URL}/api/settings`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          latitude: Number(latitude),
          longitude: Number(longitude),
          radiusMeters: Number(radiusMeters),
          reminderMinutes: Number(reminderMinutes),
          preparationMinutes: Number(preparationMinutes),
          unconfirmedWarningMinutes: Number(unconfirmedWarningMinutes),
          checkinGraceMinutes: Number(checkinGraceMinutes),
        }),
      });
      if (res.ok) {
        setSettingsMessage({ type: 'success', text: 'Cập nhật cấu hình hệ thống thành công!' });
        setTimeout(() => setSettingsMessage(null), 3000);
      } else {
        setSettingsMessage({ type: 'error', text: 'Cập nhật thất bại. Vui lòng thử lại.' });
      }
    } catch (err) {
      console.error('Error saving settings:', err);
      setSettingsMessage({ type: 'error', text: 'Lỗi kết nối. Không thể lưu cài đặt.' });
    } finally {
      setIsSavingSettings(false);
    }
  };

  return (
    <div className="min-h-screen bg-slate-950 text-slate-50 p-6 font-mono selection:bg-cyan-500/30">
      <div className="max-w-7xl mx-auto space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-800 pb-4">
          <div>
            <h1 className="text-3xl font-bold tracking-tighter flex items-center gap-2">
              <span className="text-cyan-400">CYBER</span>_ATTENDANCE
            </h1>
            <p className="text-slate-400 mt-1">Realtime Operation Center</p>
          </div>
          <div className="flex items-center gap-3">
            <div className="flex items-center gap-2 px-3 py-1 bg-green-500/10 border border-green-500/20 rounded-full">
              <div className="w-2 h-2 rounded-full bg-green-500 animate-pulse" />
              <span className="text-green-500 text-sm font-medium tracking-wider">SYSTEM ONLINE</span>
            </div>
            <div className="px-3 py-1 bg-slate-900 border border-slate-800 rounded-full text-slate-300 text-sm min-w-[100px] text-center">
              {time || '00:00:00'}
            </div>
          </div>
        </div>

        {/* Overview Cards */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Card className="bg-slate-900 border-slate-800 text-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Tổng ca hiện tại</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold">{staffList.length}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Đã Sẵn Sàng</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">
                {staffList.filter((s) => s.status === 'READY').length}
              </div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Chờ xác nhận</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400">
                {staffList.filter((s) => s.status === 'PENDING').length}
              </div>
            </CardContent>
          </Card>
        </div>

        {/* Dashboard Layout */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Realtime Table */}
          <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl lg:col-span-2">
            <CardHeader>
              <CardTitle className="flex items-center gap-2 text-slate-200">
                <Activity className="w-5 h-5 text-cyan-400" />
                Realtime Active Shifts
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Table>
                <TableHeader className="border-slate-800">
                  <TableRow className="hover:bg-transparent border-slate-800">
                    <TableHead className="text-slate-400">STAFF ID</TableHead>
                    <TableHead className="text-slate-400">NAME</TableHead>
                    <TableHead className="text-slate-400">SHIFT</TableHead>
                    <TableHead className="text-right text-slate-400">STATUS</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {staffList.map((staff) => (
                    <TableRow
                      key={staff.id}
                      className="border-slate-800/50 hover:bg-slate-800/30 transition-colors"
                    >
                      <TableCell className="font-medium text-slate-300">
                        #{staff.id.substring(0, 5)}
                      </TableCell>
                      <TableCell className="text-slate-100">{staff.name}</TableCell>
                      <TableCell className="text-slate-400">{staff.shift}</TableCell>
                      <TableCell className="text-right">
                        {getStatusBadge(staff.status, staff.lateMinutes)}
                      </TableCell>
                    </TableRow>
                  ))}
                  {staffList.length === 0 && (
                    <TableRow>
                      <TableCell colSpan={4} className="text-center text-slate-500 py-8">
                        Chưa có lịch phân ca nào được tạo.
                      </TableCell>
                    </TableRow>
                  )}
                </TableBody>
              </Table>
            </CardContent>
          </Card>

          {/* Right Column (Settings & Logs) */}
          <div className="space-y-6">
            {/* Office Settings Card */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl">
              <CardHeader className="border-b border-slate-800/60 pb-3">
                <CardTitle className="flex items-center gap-2 text-slate-200 text-base">
                  <Settings className="w-5 h-5 text-cyan-400" />
                  Cấu hình Hệ thống & Vận hành
                </CardTitle>
              </CardHeader>
              <CardContent className="pt-4">
                <form onSubmit={handleSaveSettings} className="space-y-4 text-sm">


                  {/* Cấu hình nhắc lịch */}
                  <div className="space-y-3">
                    <h3 className="text-xs font-semibold text-cyan-400 font-mono tracking-wider uppercase">🔔 Thời gian & Nhắc lịch Tele</h3>
                    <div className="grid grid-cols-2 gap-3">
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono">NHẮC NV TRƯỚC CA (PHÚT)</label>
                        <Input
                          type="number"
                          value={reminderMinutes}
                          onChange={(e) => setReminderMinutes(Number(e.target.value))}
                          required
                          min={1}
                          className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500"
                        />
                      </div>
                      <div className="space-y-1">
                        <label className="text-[10px] text-slate-400 font-mono">TG CHUẨN BỊ THÊM (PHÚT)</label>
                        <Input
                          type="number"
                          value={preparationMinutes}
                          onChange={(e) => setPreparationMinutes(Number(e.target.value))}
                          required
                          min={0}
                          className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500"
                        />
                      </div>
                    </div>
                    <div className="space-y-1">
                      <label className="text-[10px] text-slate-400 font-mono">CẢNH BÁO ADMIN (PHÚT)</label>
                      <Input
                        type="number"
                        value={unconfirmedWarningMinutes}
                        onChange={(e) => setUnconfirmedWarningMinutes(Number(e.target.value))}
                        required
                        min={1}
                        className="bg-slate-950/40 border-slate-800 text-slate-100 font-mono text-xs focus-visible:ring-cyan-500/20 focus-visible:border-cyan-500"
                      />
                    </div>

                    {/* Dynamic explanation summary block */}
                    <div className="p-2.5 bg-slate-950/40 border border-slate-850 rounded text-[11px] text-slate-400 font-sans space-y-1 leading-relaxed">
                      <div>
                        • NV nhận tin nhắc chuẩn bị ca từ: <strong className="text-cyan-400">{reminderMinutes + preparationMinutes} phút</strong> trước ca.
                      </div>
                      <div>
                        • Admin nhận thông báo chờ xác nhận từ: <strong className="text-cyan-400">{unconfirmedWarningMinutes + preparationMinutes} phút</strong> trước ca.
                      </div>
                    </div>
                  </div>

                  {settingsMessage && (
                    <div
                      className={`p-2 rounded text-xs border ${settingsMessage.type === 'success'
                          ? 'bg-green-500/10 border-green-500/20 text-green-400'
                          : 'bg-red-500/10 border-red-500/20 text-red-400'
                        }`}
                    >
                      {settingsMessage.text}
                    </div>
                  )}

                  <Button
                    type="submit"
                    disabled={isSavingSettings}
                    className="w-full h-10 bg-cyan-500 hover:bg-cyan-600 text-slate-950 font-semibold text-xs flex items-center justify-center gap-1.5 rounded transition-all active:scale-[0.98]"
                  >
                    {isSavingSettings ? (
                      <>
                        <Loader2 className="w-3.5 h-3.5 animate-spin" />
                        Đang lưu cấu hình...
                      </>
                    ) : (
                      <>
                        <Save className="w-3.5 h-3.5" />
                        Lưu cấu hình hệ thống
                      </>
                    )}
                  </Button>
                </form>
              </CardContent>
            </Card>

            {/* Realtime Alert logs */}
            <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl">
              <CardHeader className="border-b border-slate-800">
                <CardTitle className="flex items-center gap-2 text-slate-200">
                  <Terminal className="w-5 h-5 text-cyan-400" />
                  Operation Logs
                </CardTitle>
              </CardHeader>
              <CardContent className="p-4 space-y-3 max-h-[480px] overflow-y-auto">
                {alerts.map((alert) => (
                  <div
                    key={alert.id}
                    className="flex items-start p-2 rounded bg-slate-950/40 border border-slate-850 hover:border-slate-800 transition-colors text-xs"
                  >
                    {getAlertIcon(alert.type)}
                    <div className="space-y-1">
                      <p className="text-slate-300 leading-relaxed">{alert.message}</p>
                      <span className="text-[10px] text-slate-550">{alert.timestamp}</span>
                    </div>
                  </div>
                ))}
                {alerts.length === 0 && (
                  <div className="text-center text-slate-550 py-16 text-xs">
                    <Terminal className="w-8 h-8 mx-auto text-slate-700 mb-2" />
                    Waiting for realtime telemetry...
                  </div>
                )}
              </CardContent>
            </Card>
          </div>
        </div>
      </div>
    </div>
  );
}
