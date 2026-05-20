'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Activity, Clock, AlertTriangle, CheckCircle2 } from 'lucide-react';
import { useAttendanceStore } from '@/store/useAttendanceStore';
import { socket } from '@/lib/socket';

export default function AdminDashboard() {
  const { staffList, updateStaffStatus } = useAttendanceStore();
  const [time, setTime] = useState('');

  useEffect(() => {
    // Clock setup
    const timer = setInterval(() => setTime(new Date().toLocaleTimeString()), 1000);
    
    // Socket setup
    socket.connect();
    socket.on('attendance_update', (data) => {
      updateStaffStatus(data.userId, data.status);
    });

    return () => {
      clearInterval(timer);
      socket.disconnect();
      socket.off('attendance_update');
    };
  }, [updateStaffStatus]);

  const getStatusBadge = (status: string) => {
    switch(status) {
      case 'PENDING': return <Badge variant="outline" className="text-yellow-500 border-yellow-500 bg-yellow-500/10"><Clock className="w-3 h-3 mr-1"/> Chờ xác nhận</Badge>;
      case 'CONFIRMED': return <Badge variant="outline" className="text-blue-500 border-blue-500 bg-blue-500/10"><Activity className="w-3 h-3 mr-1"/> Đã xác nhận</Badge>;
      case 'CHECKED_IN': return <Badge variant="outline" className="text-green-500 border-green-500 bg-green-500/10"><CheckCircle2 className="w-3 h-3 mr-1"/> Đã Check-in</Badge>;
      case 'LATE': return <Badge variant="outline" className="text-red-500 border-red-500 bg-red-500/10 animate-pulse"><AlertTriangle className="w-3 h-3 mr-1"/> Trễ / Vắng</Badge>;
      default: return <Badge variant="outline">{status}</Badge>;
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
        <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
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
              <CardTitle className="text-sm font-medium text-slate-400">Đã Check-in</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-green-400">{staffList.filter(s => s.status === 'CHECKED_IN').length}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-slate-800 text-slate-50">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-slate-400">Chờ xác nhận</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-yellow-400">{staffList.filter(s => s.status === 'PENDING').length}</div>
            </CardContent>
          </Card>
          <Card className="bg-slate-900 border-red-900/50 text-slate-50 shadow-[0_0_15px_rgba(239,68,68,0.1)]">
            <CardHeader className="pb-2">
              <CardTitle className="text-sm font-medium text-red-400">Cảnh báo / Trễ</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="text-3xl font-bold text-red-500">{staffList.filter(s => s.status === 'LATE').length}</div>
            </CardContent>
          </Card>
        </div>

        {/* Realtime Table */}
        <Card className="bg-slate-900/50 border-slate-800 backdrop-blur-xl">
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
                  <TableRow key={staff.id} className="border-slate-800/50 hover:bg-slate-800/30 transition-colors">
                    <TableCell className="font-medium text-slate-300">#{staff.id.padStart(4, '0')}</TableCell>
                    <TableCell className="text-slate-100">{staff.name}</TableCell>
                    <TableCell className="text-slate-400">{staff.shift}</TableCell>
                    <TableCell className="text-right">{getStatusBadge(staff.status)}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
