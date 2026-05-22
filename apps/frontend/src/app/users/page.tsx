'use client';
import { useEffect, useState, useCallback } from 'react';
import Select from 'react-select';
import { QRCodeSVG } from 'qrcode.react';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Dialog, DialogContent, DialogHeader, DialogTitle } from '@/components/ui/dialog';
import { Badge } from '@/components/ui/badge';
import { apiFetch } from '@/lib/api';

const selectStyles = {
  control: (base: any, state: any) => ({
    ...base,
    backgroundColor: '#1e293b',
    borderColor: '#334155',
    color: 'white',
    boxShadow: state.isFocused ? '0 0 0 1px #06b6d4' : 'none',
    '&:hover': { borderColor: '#475569' }
  }),
  menu: (base: any) => ({ ...base, backgroundColor: '#1e293b', border: '1px solid #334155', zIndex: 50 }),
  option: (base: any, state: any) => ({
    ...base,
    backgroundColor: state.isSelected ? '#0891b2' : state.isFocused ? '#334155' : 'transparent',
    color: 'white',
    '&:active': { backgroundColor: '#0e7490' }
  }),
  singleValue: (base: any) => ({ ...base, color: 'white' }),
  input: (base: any) => ({ ...base, color: 'white' })
};

export default function UsersPage() {
  const [users, setUsers] = useState([]);
  const [newUser, setNewUser] = useState({ username: '', full_name: '', password: '' });

  // Edit State
  const [editingUser, setEditingUser] = useState<any>(null);
  const [isEditDialogOpen, setIsEditDialogOpen] = useState(false);

  // Telegram Link State
  const [isTelegramDialogOpen, setIsTelegramDialogOpen] = useState(false);
  const [telegramLink, setTelegramLink] = useState<any>(null);
  const [linkStatus, setLinkStatus] = useState<string>('IDLE'); // IDLE | LOADING | PENDING | LINKED | EXPIRED | ERROR
  const [linkingUser, setLinkingUser] = useState<any>(null);

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const fetchUsers = useCallback(async () => {
    try {
      const res = await apiFetch(`${API_URL}/users`);
      const data = await res.json();
      setUsers(data);
    } catch (e) {
      console.error(e);
    }
  }, [API_URL]);

  useEffect(() => {
    fetchUsers();
  }, [fetchUsers]);

  const handleCreate = async () => {
    await apiFetch(`${API_URL}/users`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(newUser)
    });
    setNewUser({ username: '', full_name: '', password: '' });
    fetchUsers();
  };

  const handleDelete = async (id: string) => {
    if (!confirm('Bạn có chắc chắn muốn xóa nhân sự này? (Hành động này sẽ xóa các ca làm liên quan)')) return;
    try {
      await apiFetch(`${API_URL}/users/${id}`, { method: 'DELETE' });
      fetchUsers();
    } catch (error) {
      alert("Không thể xóa. Nhân sự này có thể đang gắn với ca làm.");
    }
  };

  const openEditDialog = (user: any) => {
    setEditingUser({ ...user, password: '' });
    setIsEditDialogOpen(true);
  };

  const handleUpdate = async () => {
    await apiFetch(`${API_URL}/users/${editingUser.id}`, {
      method: 'PUT',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(editingUser)
    });

    if (editingUser.telegram_id !== undefined) {
      await apiFetch(`${API_URL}/users/${editingUser.id}/telegram`, {
        method: 'PUT',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ telegram_id: editingUser.telegram_id })
      });
    }

    setIsEditDialogOpen(false);
    fetchUsers();
  };

  // --- Telegram Link Flow ---
  const handleCreateTelegramLink = async (user: any) => {
    setLinkingUser(user);
    setLinkStatus('LOADING');
    setTelegramLink(null);
    setIsTelegramDialogOpen(true);

    try {
      const res = await apiFetch(`${API_URL}/telegram/create-link`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ username: user.username }),
      });

      if (!res.ok) {
        throw new Error('Failed to create link');
      }

      const data = await res.json();
      setTelegramLink(data);
      setLinkStatus('PENDING');
    } catch (e) {
      console.error(e);
      setLinkStatus('ERROR');
    }
  };

  // Poll for link completion status
  useEffect(() => {
    if (linkStatus !== 'PENDING' || !telegramLink?.token) return;

    const interval = setInterval(async () => {
      try {
        const res = await apiFetch(`${API_URL}/telegram/link-status/${telegramLink.token}`);
        const data = await res.json();

        if (data.status === 'LINKED') {
          setLinkStatus('LINKED');
          fetchUsers(); // Refresh user list
          clearInterval(interval);
        } else if (data.status === 'EXPIRED') {
          setLinkStatus('EXPIRED');
          clearInterval(interval);
        }
      } catch (e) {
        console.error(e);
      }
    }, 3000); // Poll every 3 seconds

    return () => clearInterval(interval);
  }, [linkStatus, telegramLink, API_URL, fetchUsers]);

  const closeTelegramDialog = () => {
    setIsTelegramDialogOpen(false);
    setTelegramLink(null);
    setLinkStatus('IDLE');
    setLinkingUser(null);
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
                <TableHead className="text-slate-400">Telegram</TableHead>
                <TableHead className="text-slate-400">Vai trò</TableHead>
                <TableHead className="text-slate-400 text-right">Thao tác</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {users.map((u: any) => (
                <TableRow key={u.id} className="border-slate-800 hover:bg-slate-800/50">
                  <TableCell className="font-mono text-sm">{u.username}</TableCell>
                  <TableCell>{u.full_name}</TableCell>
                  <TableCell>
                    {u.telegram_id ? (
                      <Badge variant="outline" className="text-green-400 border-green-500/30 bg-green-500/10">
                        ✓ {u.telegram_id}
                      </Badge>
                    ) : (
                      <Badge variant="outline" className="text-yellow-400 border-yellow-500/30 bg-yellow-500/10 cursor-pointer hover:bg-yellow-500/20 transition-colors" onClick={() => handleCreateTelegramLink(u)}>
                        ⚡ Liên kết Telegram
                      </Badge>
                    )}
                  </TableCell>
                  <TableCell>
                    <Badge variant="outline" className={u.role === 'ADMIN' ? 'text-purple-400 border-purple-500/30' : 'text-slate-400 border-slate-600'}>
                      {u.role}
                    </Badge>
                  </TableCell>
                  <TableCell className="text-right space-x-2">
                    {!u.telegram_id && (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => handleCreateTelegramLink(u)}
                        className="border-blue-500/30 text-blue-400 bg-blue-500/10 hover:bg-blue-500/20"
                      >
                        📱 Link TG
                      </Button>
                    )}
                    <Button variant="outline" size="sm" onClick={() => openEditDialog(u)} className="border-yellow-500/30 text-yellow-400 bg-yellow-500/10 hover:bg-yellow-500/20">Sửa</Button>
                    <Button variant="destructive" size="sm" onClick={() => handleDelete(u.id)}>Xóa</Button>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </CardContent>
      </Card>

      {/* Edit Dialog */}
      <Dialog open={isEditDialogOpen} onOpenChange={setIsEditDialogOpen}>
        <DialogContent className="bg-slate-900 text-white border-slate-700">
          <DialogHeader>
            <DialogTitle>Sửa thông tin nhân sự</DialogTitle>
          </DialogHeader>
          <div className="space-y-4 py-4">
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Username</label>
              <Input className="bg-slate-800 border-slate-700" value={editingUser?.username || ''} onChange={e => setEditingUser({...editingUser, username: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Họ tên</label>
              <Input className="bg-slate-800 border-slate-700" value={editingUser?.full_name || ''} onChange={e => setEditingUser({...editingUser, full_name: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Mật khẩu mới (Để trống nếu không muốn đổi)</label>
              <Input className="bg-slate-800 border-slate-700" type="password" placeholder="***" value={editingUser?.password || ''} onChange={e => setEditingUser({...editingUser, password: e.target.value})} />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Vai trò</label>
              <Select
                instanceId="role-select"
                options={[
                  { value: 'STAFF', label: 'Nhân viên (STAFF)' },
                  { value: 'ADMIN', label: 'Quản lý (ADMIN)' }
                ]}
                styles={selectStyles}
                value={{
                  value: editingUser?.role || 'STAFF',
                  label: (editingUser?.role || 'STAFF') === 'ADMIN' ? 'Quản lý (ADMIN)' : 'Nhân viên (STAFF)'
                }}
                onChange={(selected: any) => setEditingUser({...editingUser, role: selected.value})}
              />
            </div>
            <div className="space-y-2">
              <label className="text-sm text-slate-400">Telegram ID</label>
              <Input className="bg-slate-800 border-slate-700 font-mono text-cyan-400" placeholder="Để trống nếu chưa liên kết" value={editingUser?.telegram_id || ''} onChange={e => setEditingUser({...editingUser, telegram_id: e.target.value})} />
              <p className="text-xs text-slate-500">Mẹo: Sử dụng nút &quot;Liên kết Telegram&quot; để hệ thống tự lấy mã ID chuẩn xác nhất.</p>
            </div>
            <Button onClick={handleUpdate} className="w-full bg-cyan-600 hover:bg-cyan-500 text-white">Lưu thay đổi</Button>
          </div>
        </DialogContent>
      </Dialog>

      {/* Telegram Link Dialog */}
      <Dialog open={isTelegramDialogOpen} onOpenChange={(open) => { if (!open) closeTelegramDialog(); }}>
        <DialogContent className="bg-slate-900 text-white border-slate-700 max-w-md">
          <DialogHeader>
            <DialogTitle className="flex items-center gap-2">
              📱 Liên kết Telegram
            </DialogTitle>
          </DialogHeader>

          <div className="space-y-5 py-4">
            {/* User info */}
            {linkingUser && (
              <div className="bg-slate-800/50 rounded-lg p-3 border border-slate-700">
                <p className="text-sm text-slate-400">Đang liên kết cho</p>
                <p className="text-lg font-semibold">{linkingUser.full_name}</p>
                <p className="text-sm text-slate-400 font-mono">@{linkingUser.username}</p>
              </div>
            )}

            {/* Loading */}
            {linkStatus === 'LOADING' && (
              <div className="flex flex-col items-center gap-3 py-6">
                <div className="w-8 h-8 border-2 border-cyan-500 border-t-transparent rounded-full animate-spin" />
                <p className="text-sm text-slate-400">Đang tạo link liên kết...</p>
              </div>
            )}

            {/* Pending — Show QR + Link */}
            {linkStatus === 'PENDING' && telegramLink && (
              <>
                {/* QR Code */}
                <div className="flex flex-col items-center gap-4">
                  <div className="bg-white p-4 rounded-xl">
                    <QRCodeSVG
                      value={telegramLink.deepLink}
                      size={200}
                      level="M"
                      includeMargin={false}
                    />
                  </div>
                  <p className="text-sm text-slate-400 text-center">
                    Quét mã QR hoặc bấm nút bên dưới để mở Telegram
                  </p>
                </div>

                {/* Open Telegram Button */}
                <a
                  href={telegramLink.deepLink}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="flex items-center justify-center gap-2 w-full py-3 px-4 rounded-lg bg-[#2AABEE] hover:bg-[#229ED9] text-white font-semibold transition-colors"
                >
                  <svg className="w-5 h-5" viewBox="0 0 24 24" fill="currentColor">
                    <path d="M11.944 0A12 12 0 0 0 0 12a12 12 0 0 0 12 12 12 12 0 0 0 12-12A12 12 0 0 0 12 0a12 12 0 0 0-.056 0zm4.962 7.224c.1-.002.321.023.465.14a.506.506 0 0 1 .171.325c.016.093.036.306.02.472-.18 1.898-.962 6.502-1.36 8.627-.168.9-.499 1.201-.82 1.23-.696.065-1.225-.46-1.9-.902-1.056-.693-1.653-1.124-2.678-1.8-1.185-.78-.417-1.21.258-1.91.177-.184 3.247-2.977 3.307-3.23.007-.032.014-.15-.056-.212s-.174-.041-.249-.024c-.106.024-1.793 1.14-5.061 3.345-.48.33-.913.49-1.302.48-.428-.008-1.252-.241-1.865-.44-.752-.245-1.349-.374-1.297-.789.027-.216.325-.437.893-.663 3.498-1.524 5.83-2.529 6.998-3.014 3.332-1.386 4.025-1.627 4.476-1.635z"/>
                  </svg>
                  Mở Telegram
                </a>

                {/* Waiting indicator */}
                <div className="flex items-center justify-center gap-2 py-2">
                  <div className="w-2 h-2 rounded-full bg-yellow-400 animate-pulse" />
                  <span className="text-sm text-yellow-400">Đang chờ xác nhận từ Telegram...</span>
                </div>

                {/* Token info */}
                <p className="text-xs text-slate-500 text-center">
                  Link hết hạn sau 10 phút • Token: <code className="text-slate-400">{telegramLink.token.slice(0, 8)}...</code>
                </p>
              </>
            )}

            {/* Linked — Success */}
            {linkStatus === 'LINKED' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-green-500/20 border-2 border-green-500 flex items-center justify-center">
                  <span className="text-3xl">✅</span>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-green-400">Liên kết thành công!</p>
                  <p className="text-sm text-slate-400 mt-1">Tài khoản đã được liên kết với Telegram.</p>
                  <p className="text-sm text-slate-400">Nhân viên sẽ nhận thông báo ca làm qua Telegram.</p>
                </div>
                <Button onClick={closeTelegramDialog} className="bg-green-600 hover:bg-green-500 text-white">
                  Hoàn tất
                </Button>
              </div>
            )}

            {/* Expired */}
            {linkStatus === 'EXPIRED' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-yellow-500/20 border-2 border-yellow-500 flex items-center justify-center">
                  <span className="text-3xl">⏰</span>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-yellow-400">Link đã hết hạn</p>
                  <p className="text-sm text-slate-400 mt-1">Vui lòng tạo lại link liên kết mới.</p>
                </div>
                <Button onClick={() => linkingUser && handleCreateTelegramLink(linkingUser)} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                  Tạo lại link
                </Button>
              </div>
            )}

            {/* Error */}
            {linkStatus === 'ERROR' && (
              <div className="flex flex-col items-center gap-4 py-6">
                <div className="w-16 h-16 rounded-full bg-red-500/20 border-2 border-red-500 flex items-center justify-center">
                  <span className="text-3xl">❌</span>
                </div>
                <div className="text-center">
                  <p className="text-lg font-semibold text-red-400">Có lỗi xảy ra</p>
                  <p className="text-sm text-slate-400 mt-1">Không thể tạo link liên kết. Vui lòng thử lại.</p>
                </div>
                <Button onClick={() => linkingUser && handleCreateTelegramLink(linkingUser)} className="bg-cyan-600 hover:bg-cyan-500 text-white">
                  Thử lại
                </Button>
              </div>
            )}
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}
