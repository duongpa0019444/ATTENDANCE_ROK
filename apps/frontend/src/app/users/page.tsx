'use client';
import { useEffect, useState } from 'react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', full_name: '', password: '' });
  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const fetchUsers = async () => {
    try {
      const res = await fetch(`${API_URL}/users`);
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  };

  useEffect(() => {
    fetchUsers();
  }, []);

  const handleCreate = async () => {
    await fetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    setNewUser({ username: '', full_name: '', password: '' });
    fetchUsers();
  };

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      <h1 className="text-3xl font-bold text-slate-100">Quản lý Nhân sự</h1>
      
      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader><CardTitle>Thêm Nhân sự</CardTitle></CardHeader>
        <CardContent className="flex gap-4 flex-col md:flex-row">
          <Input className="bg-slate-800 border-slate-700" placeholder="Tên đăng nhập" value={newUser.username} onChange={e => setNewUser({...newUser, username: e.target.value})} />
          <Input className="bg-slate-800 border-slate-700" placeholder="Họ và tên" value={newUser.full_name} onChange={e => setNewUser({...newUser, full_name: e.target.value})} />
          <Input className="bg-slate-800 border-slate-700" placeholder="Mật khẩu" type="password" value={newUser.password} onChange={e => setNewUser({...newUser, password: e.target.value})} />
          <Button onClick={handleCreate} className="bg-cyan-600 hover:bg-cyan-500 text-white">Thêm</Button>
        </CardContent>
      </Card>

      <Card className="bg-slate-900 border-slate-800 text-slate-100">
        <CardHeader><CardTitle>Danh sách nhân sự</CardTitle></CardHeader>
        <CardContent>
          <Table>
            <TableHeader className="border-slate-800">
              <TableRow className="hover:bg-slate-800/50">
                <TableHead className="text-slate-400">Username</TableHead>
                <TableHead className="text-slate-400">Họ tên</TableHead>
                <TableHead className="text-slate-400">Telegram ID</TableHead>
                <TableHead className="text-slate-400">Vai trò</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell>{u.username}</TableCell>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell className="text-cyan-400 font-mono">{u.telegram_id || 'Chưa liên kết'}</TableCell>
                  <TableCell>{u.role}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>
    </div>
  );
}
