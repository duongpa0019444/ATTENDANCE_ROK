'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function ShiftsPage() {
  const [shifts, setShifts] = useState([]);
  const [users, setUsers] = useState([]);
  const [assignments, setAssignments] = useState([]);
  
  const [newShift, setNewShift] = useState({ name: '', start_time: '', end_time: '' });
  const [newAssignment, setNewAssignment] = useState({ user_id: '', shift_id: '', work_date: '' });
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const fetchData = async () => {
    try {
      const [shiftsRes, usersRes, assignRes] = await Promise.all([
        fetch(`${API_URL}/shifts`),
        fetch(`${API_URL}/users`),
        fetch(`${API_URL}/shifts/assignments`)
      ]);
      setShifts(await shiftsRes.json());
      setUsers(await usersRes.json());
      setAssignments(await assignRes.json());
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchData();
  }, []);

  const handleCreateShift = async () => {
    await fetch(`${API_URL}/shifts`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newShift)
    });
    setNewShift({ name: '', start_time: '', end_time: '' });
    fetchData();
  };

  const handleAssignShift = async () => {
    await fetch(`${API_URL}/shifts/assign`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newAssignment)
    });
    setNewAssignment({ user_id: '', shift_id: '', work_date: '' });
    fetchData();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-100">Quản lý Ca làm</h1>
      
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        {/* Create Shift */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader><CardTitle>Thêm Ca Mới (Khung giờ)</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <Input className="bg-slate-800 border-slate-700" placeholder="Tên ca (VD: Ca Sáng)" value={newShift.name} onChange={e => setNewShift({...newShift, name: e.target.value})} />
            <div className="flex gap-4">
              <Input className="bg-slate-800 border-slate-700" type="time" placeholder="Giờ bắt đầu" value={newShift.start_time} onChange={e => setNewShift({...newShift, start_time: e.target.value})} />
              <Input className="bg-slate-800 border-slate-700" type="time" placeholder="Giờ kết thúc" value={newShift.end_time} onChange={e => setNewShift({...newShift, end_time: e.target.value})} />
            </div>
            <Button onClick={handleCreateShift} className="bg-cyan-600 hover:bg-cyan-500 w-full">Thêm Ca</Button>
          </CardContent>
        </Card>

        {/* Assign Shift */}
        <Card className="bg-slate-900 border-slate-800 text-slate-100">
          <CardHeader><CardTitle>Gán Ca Cho Nhân Viên</CardTitle></CardHeader>
          <CardContent className="space-y-4">
            <select 
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={newAssignment.user_id} onChange={e => setNewAssignment({...newAssignment, user_id: e.target.value})}
            >
              <option value="">-- Chọn nhân viên --</option>
              {users.map((u: any) => <option key={u.id} value={u.id}>{u.full_name}</option>)}
            </select>

            <select 
              className="flex h-10 w-full rounded-md border border-slate-700 bg-slate-800 px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              value={newAssignment.shift_id} onChange={e => setNewAssignment({...newAssignment, shift_id: e.target.value})}
            >
              <option value="">-- Chọn ca làm --</option>
              {shifts.map((s: any) => <option key={s.id} value={s.id}>{s.name} ({s.start_time} - {s.end_time})</option>)}
            </select>

            <Input className="bg-slate-800 border-slate-700" type="date" value={newAssignment.work_date} onChange={e => setNewAssignment({...newAssignment, work_date: e.target.value})} />
            
            <Button onClick={handleAssignShift} className="bg-green-600 hover:bg-green-500 w-full">Phân Ca</Button>
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
                <TableHead className="text-slate-400">Nhân viên</TableHead>
                <TableHead className="text-slate-400">Ca làm</TableHead>
                <TableHead className="text-slate-400">Trạng thái</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {assignments.map((a: any) => (
                <TableRow key={a.id} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell>{new Date(a.work_date).toLocaleDateString()}</TableCell>
                  <TableCell>{a.user?.full_name}</TableCell>
                  <TableCell>{a.shift?.name} ({a.shift?.start_time})</TableCell>
                  <TableCell>{a.status}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
