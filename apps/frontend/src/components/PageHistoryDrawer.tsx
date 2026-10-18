'use client';

import React, { useEffect, useState, useCallback, useMemo } from 'react';
import { 
  History, 
  X, 
  RefreshCw, 
  FileSpreadsheet, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  Lock, 
  Unlock, 
  Copy, 
  User, 
  Clock, 
  ChevronDown, 
  ChevronRight,
  Database,
  Search,
  Calendar,
  Coins,
  Sliders
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import LogMetadataDiff from './LogMetadataDiff';

interface AuditLogItem {
  id: string;
  actor_id?: string;
  page: string;
  action: string;
  entity_type: string;
  entity_id?: string;
  summary: string;
  metadata?: any;
  created_at: string;
  actor?: {
    id: string;
    username: string;
    full_name: string;
    role: string;
  };
}

interface PageHistoryDrawerProps {
  page: 'SHIFTS' | 'SHIFT_MANAGEMENT' | 'SERVERS' | 'USERS' | 'PAYROLL' | 'SETTINGS';
  title?: string;
  isOpen: boolean;
  onClose: () => void;
  defaultTab?: 'CHANGES' | 'EXCEL' | 'PAYROLL' | 'CONFIG';
}

export default function PageHistoryDrawer({
  page,
  title = 'Lịch Sử Chỉnh Sửa',
  isOpen,
  onClose,
  defaultTab = 'CHANGES',
}: PageHistoryDrawerProps) {
  const [logs, setLogs] = useState<AuditLogItem[]>([]);
  const [loading, setLoading] = useState(false);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Tab state for dividing Excel Upload vs Manual CRUD (SHIFTS page)
  const [activeTab, setActiveTab] = useState<'CHANGES' | 'EXCEL'>(
    defaultTab === 'EXCEL' ? 'EXCEL' : 'CHANGES'
  );

  // Tab state for dividing Payroll vs Compensation Configuration (PAYROLL page)
  const [activePayrollTab, setActivePayrollTab] = useState<'PAYROLL' | 'CONFIG'>(
    defaultTab === 'CONFIG' ? 'CONFIG' : 'PAYROLL'
  );

  // Filter states
  const [search, setSearch] = useState('');
  const [dateFilter, setDateFilter] = useState('');

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const res = await apiFetch(`${API_URL}/audit-logs/page/${page}?limit=100`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data);
      }
    } catch (err) {
      console.error('Failed to fetch page audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [API_URL, page]);

  // Helper to distinguish Payroll adjustments vs Compensation settings
  const isPayrollLog = (log: AuditLogItem) => {
    return (
      ['LockedPeriod', 'PayrollAdjustment'].includes(log.entity_type) ||
      ['LOCK', 'UNLOCK'].includes(log.action)
    );
  };

  // Compute counts for the tabs
  const tabCounts = useMemo(() => {
    let excel = 0;
    let changes = 0;
    let payroll = 0;
    let config = 0;

    logs.forEach((log) => {
      if (log.action === 'EXCEL_IMPORT') {
        excel++;
      } else {
        changes++;
      }

      if (isPayrollLog(log)) {
        payroll++;
      } else {
        config++;
      }
    });
    return { excel, changes, payroll, config, total: logs.length };
  }, [logs]);

  // Client-side quick filter
  const filteredLogs = useMemo(() => {
    return logs.filter((log) => {
      // 1. Tab filter for SHIFTS (or pages with excel imports)
      if (page === 'SHIFTS') {
        if (activeTab === 'EXCEL' && log.action !== 'EXCEL_IMPORT') {
          return false;
        }
        if (activeTab === 'CHANGES' && log.action === 'EXCEL_IMPORT') {
          return false;
        }
      }

      // 1b. Tab filter for PAYROLL (Payroll vs Compensation Config)
      if (page === 'PAYROLL') {
        const isPayroll = isPayrollLog(log);
        if (activePayrollTab === 'PAYROLL' && !isPayroll) {
          return false;
        }
        if (activePayrollTab === 'CONFIG' && isPayroll) {
          return false;
        }
      }

      // 2. Date filter
      if (dateFilter) {
        const logDate = format(new Date(log.created_at), 'yyyy-MM-dd');
        if (logDate !== dateFilter) return false;
      }

      // 3. Keyword search
      if (search.trim()) {
        const q = search.toLowerCase().trim();
        const summaryMatch = log.summary?.toLowerCase().includes(q);
        const actorMatch = log.actor?.full_name?.toLowerCase().includes(q) || log.actor?.username?.toLowerCase().includes(q);
        const actionMatch = log.action?.toLowerCase().includes(q);
        const entityMatch = log.entity_type?.toLowerCase().includes(q);
        const fileMatch = log.metadata?.fileName?.toLowerCase().includes(q);
        const changesMatch = Array.isArray(log.metadata?.changes) && log.metadata.changes.some(
          (c: any) => String(c.old).toLowerCase().includes(q) || String(c.new).toLowerCase().includes(q) || String(c.label).toLowerCase().includes(q)
        );

        if (!summaryMatch && !actorMatch && !actionMatch && !entityMatch && !fileMatch && !changesMatch) {
          return false;
        }
      }

      return true;
    });
  }, [logs, page, activeTab, activePayrollTab, search, dateFilter]);

  // Smooth slide-in/out animation states
  const [mounted, setMounted] = useState(false);
  const [visible, setVisible] = useState(false);

  useEffect(() => {
    if (isOpen) {
      setMounted(true);
      const timer = setTimeout(() => {
        setVisible(true);
      }, 25);
      return () => clearTimeout(timer);
    } else {
      setVisible(false);
      const timer = setTimeout(() => {
        setMounted(false);
      }, 300);
      return () => clearTimeout(timer);
    }
  }, [isOpen]);

  const handleClose = useCallback(() => {
    setVisible(false);
    setTimeout(() => {
      onClose();
    }, 300);
  }, [onClose]);

  useEffect(() => {
    if (isOpen) {
      fetchLogs();
      if (defaultTab === 'CONFIG' || defaultTab === 'PAYROLL') {
        setActivePayrollTab(defaultTab);
      } else if (defaultTab === 'CHANGES' || defaultTab === 'EXCEL') {
        setActiveTab(defaultTab);
      }
    }
  }, [isOpen, fetchLogs, defaultTab]);

  // Close on Escape key with slide-out animation
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape' && isOpen) {
        handleClose();
      }
    };
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isOpen, handleClose]);

  const getActionBadge = (action: string) => {
    switch (action) {
      case 'EXCEL_IMPORT':
        return {
          icon: <FileSpreadsheet className="w-3.5 h-3.5" />,
          label: 'NHẬP EXCEL',
          color: 'bg-emerald-500/10 text-emerald-400 border-emerald-500/30',
        };
      case 'CREATE':
        return {
          icon: <PlusCircle className="w-3.5 h-3.5" />,
          label: 'TẠO MỚI',
          color: 'bg-cyan-500/10 text-cyan-400 border-cyan-500/30',
        };
      case 'UPDATE':
        return {
          icon: <Edit3 className="w-3.5 h-3.5" />,
          label: 'CẬP NHẬT',
          color: 'bg-amber-500/10 text-amber-400 border-amber-500/30',
        };
      case 'DELETE':
        return {
          icon: <Trash2 className="w-3.5 h-3.5" />,
          label: 'XÓA',
          color: 'bg-red-500/10 text-red-400 border-red-500/30',
        };
      case 'LOCK':
        return {
          icon: <Lock className="w-3.5 h-3.5" />,
          label: 'CHỐT LƯƠNG',
          color: 'bg-purple-500/10 text-purple-400 border-purple-500/30',
        };
      case 'UNLOCK':
        return {
          icon: <Unlock className="w-3.5 h-3.5" />,
          label: 'MỞ KHÓA',
          color: 'bg-pink-500/10 text-pink-400 border-pink-500/30',
        };
      case 'SYNC':
        return {
          icon: <RefreshCw className="w-3.5 h-3.5" />,
          label: 'ĐỒNG BỘ',
          color: 'bg-indigo-500/10 text-indigo-400 border-indigo-500/30',
        };
      case 'CLONE':
        return {
          icon: <Copy className="w-3.5 h-3.5" />,
          label: 'SAO CHÉP',
          color: 'bg-teal-500/10 text-teal-400 border-teal-500/30',
        };
      default:
        return {
          icon: <Database className="w-3.5 h-3.5" />,
          label: action,
          color: 'bg-slate-800 text-slate-300 border-slate-700',
        };
    }
  };

  if (!mounted && !isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 overflow-hidden">
      {/* Backdrop with smooth fade transition */}
      <div 
        className={`fixed inset-0 bg-black/60 backdrop-blur-sm transition-opacity duration-300 ease-out ${
          visible ? 'opacity-100' : 'opacity-0 pointer-events-none'
        }`}
        onClick={handleClose}
      />

      {/* Drawer Panel - Smooth Slide-in from right */}
      <div className="fixed inset-y-0 right-0 max-w-full flex pl-4 sm:pl-10 pointer-events-none">
        <div className={`pointer-events-auto w-screen max-w-2xl sm:max-w-3xl lg:max-w-4xl bg-slate-950 border-l border-slate-800 text-slate-100 flex flex-col shadow-2xl relative transform transition-transform duration-300 ease-out will-change-transform ${
          visible ? 'translate-x-0' : 'translate-x-full'
        }`}>
          
          {/* Accent Line */}
          <div className="h-[2px] bg-gradient-to-r from-cyan-500 via-indigo-500 to-purple-500 w-full" />

          {/* Header */}
          <div className="p-4 sm:p-5 border-b border-slate-800/80 flex items-center justify-between bg-slate-900/50">
            <div className="flex items-center gap-2.5">
              <div className="p-2 bg-cyan-500/10 rounded-lg border border-cyan-500/20 text-cyan-400">
                <History className="w-5 h-5" />
              </div>
              <div>
                <h2 className="text-base font-bold text-slate-100 tracking-wide flex items-center gap-2">
                  {title}
                  <span className="text-[10px] px-2 py-0.5 rounded bg-slate-800 text-slate-400 font-mono">
                    {page}
                  </span>
                </h2>
                <p className="text-xs text-slate-400 mt-0.5">
                  Nhật ký thao tác & upload dữ liệu gần nhất
                </p>
              </div>
            </div>

            <div className="flex items-center gap-2">
              <button
                onClick={fetchLogs}
                disabled={loading}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors disabled:opacity-50 cursor-pointer"
                title="Làm mới"
              >
                <RefreshCw className={`w-4 h-4 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
              </button>
              <button
                onClick={handleClose}
                className="p-1.5 rounded-lg border border-slate-800 text-slate-400 hover:text-white hover:bg-slate-800/60 transition-colors cursor-pointer"
                title="Đóng"
              >
                <X className="w-4 h-4" />
              </button>
            </div>
          </div>

          {/* 2 Tabs: Upload Excel vs Tạo / Sửa / Xóa (For SHIFTS page) */}
          {page === 'SHIFTS' && (
            <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-900/70 px-4 sm:px-5 pt-1.5">
              <button
                onClick={() => setActiveTab('CHANGES')}
                className={`py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'CHANGES'
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Edit3 className="w-3.5 h-3.5" />
                <span>Tạo / Sửa / Xóa</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors ${
                  activeTab === 'CHANGES' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tabCounts.changes}
                </span>
              </button>

              <button
                onClick={() => setActiveTab('EXCEL')}
                className={`py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activeTab === 'EXCEL'
                    ? 'border-emerald-400 text-emerald-400 bg-emerald-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <FileSpreadsheet className="w-3.5 h-3.5" />
                <span>Upload Excel</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors ${
                  activeTab === 'EXCEL' ? 'bg-emerald-500/20 text-emerald-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tabCounts.excel}
                </span>
              </button>
            </div>
          )}

          {/* 2 Tabs for PAYROLL: Lịch Sử Bảng Lương vs Lịch Sử Cấu Hình Thù Lao */}
          {page === 'PAYROLL' && (
            <div className="flex items-center gap-1 border-b border-slate-800 bg-slate-900/70 px-4 sm:px-5 pt-1.5">
              <button
                onClick={() => setActivePayrollTab('PAYROLL')}
                className={`py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activePayrollTab === 'PAYROLL'
                    ? 'border-cyan-400 text-cyan-400 bg-cyan-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Coins className="w-3.5 h-3.5" />
                <span>Lịch Sử Bảng Lương</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors ${
                  activePayrollTab === 'PAYROLL' ? 'bg-cyan-500/20 text-cyan-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tabCounts.payroll}
                </span>
              </button>

              <button
                onClick={() => setActivePayrollTab('CONFIG')}
                className={`py-2.5 px-4 text-xs font-semibold flex items-center gap-2 border-b-2 transition-all cursor-pointer ${
                  activePayrollTab === 'CONFIG'
                    ? 'border-amber-400 text-amber-400 bg-amber-500/5'
                    : 'border-transparent text-slate-400 hover:text-slate-200 hover:border-slate-700'
                }`}
              >
                <Sliders className="w-3.5 h-3.5" />
                <span>Lịch Sử Cấu Hình Thù Lao</span>
                <span className={`px-2 py-0.5 rounded-full text-[10px] font-mono font-bold transition-colors ${
                  activePayrollTab === 'CONFIG' ? 'bg-amber-500/20 text-amber-300' : 'bg-slate-800 text-slate-400'
                }`}>
                  {tabCounts.config}
                </span>
              </button>
            </div>
          )}

          {/* Quick Search & Date Filter Bar */}
          <div className="px-4 py-3 sm:px-5 border-b border-slate-800/80 bg-slate-900/30 flex flex-col sm:flex-row items-stretch sm:items-center gap-2.5">
            {/* Search Box */}
            <div className="relative flex-1">
              <Search className="w-3.5 h-3.5 text-slate-500 absolute left-3 top-1/2 -translate-y-1/2" />
              <input
                type="text"
                placeholder={
                  page === 'SHIFTS'
                    ? activeTab === 'EXCEL'
                      ? 'Tìm theo tên file Excel, người tải lên, tuần áp dụng...'
                      : 'Tìm theo tên nhân viên, tên ca, server, ngày trực...'
                    : page === 'PAYROLL'
                    ? activePayrollTab === 'PAYROLL'
                      ? 'Tìm theo tên nhân viên, người chốt sổ, giai đoạn lương...'
                      : 'Tìm theo cấu hình, loại phụ cấp, ngày áp dụng, người sửa...'
                    : page === 'SHIFT_MANAGEMENT'
                    ? 'Tìm theo tên ca, server, khung giờ, người thực hiện...'
                    : page === 'SERVERS'
                    ? 'Tìm theo tên server, người thực hiện...'
                    : 'Tìm kiếm theo từ khóa, người thực hiện, nội dung...'
                }
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="w-full pl-9 pr-8 py-1.5 bg-slate-950 border border-slate-800 focus:border-cyan-500/70 rounded-lg text-xs text-slate-200 placeholder:text-slate-500 outline-none transition-colors"
              />
              {search && (
                <button
                  onClick={() => setSearch('')}
                  className="absolute right-2.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 cursor-pointer"
                  title="Xóa tìm kiếm"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            {/* Date Filter & Quick Actions */}
            <div className="flex items-center gap-2 shrink-0">
              <div className="relative flex items-center">
                <Calendar className="w-3.5 h-3.5 text-slate-500 absolute left-2.5 pointer-events-none" />
                <input
                  type="date"
                  value={dateFilter}
                  onChange={(e) => setDateFilter(e.target.value)}
                  className="pl-8 pr-2.5 py-1.5 bg-slate-950 border border-slate-800 focus:border-cyan-500/70 rounded-lg text-xs text-slate-200 outline-none transition-colors cursor-pointer"
                  title="Lọc theo ngày cụ thể"
                />
              </div>

              {/* Quick 'Hôm nay' button */}
              <button
                onClick={() => {
                  const today = format(new Date(), 'yyyy-MM-dd');
                  setDateFilter(dateFilter === today ? '' : today);
                }}
                className={`px-2.5 py-1.5 rounded-lg text-xs font-medium transition-colors border cursor-pointer ${
                  dateFilter === format(new Date(), 'yyyy-MM-dd')
                    ? 'bg-cyan-500/20 text-cyan-400 border-cyan-500/40 font-semibold'
                    : 'bg-slate-900 text-slate-400 hover:text-slate-200 border-slate-800 hover:bg-slate-800'
                }`}
              >
                Hôm nay
              </button>

              {(search || dateFilter) && (
                <button
                  onClick={() => {
                    setSearch('');
                    setDateFilter('');
                  }}
                  className="px-2 py-1 rounded text-xs text-red-400 hover:bg-red-500/10 transition-colors font-medium cursor-pointer"
                >
                  Xóa lọc
                </button>
              )}
            </div>
          </div>

          {/* Content Area */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3.5 custom-scrollbar">
            {loading && logs.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 space-y-3">
                <div className="w-7 h-7 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                <span className="text-xs font-mono">ĐANG_TẢI_LỊCH_SỬ...</span>
              </div>
            ) : logs.length === 0 ? (
              <div className="py-20 flex flex-col items-center justify-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                <History className="w-10 h-10 stroke-[1.2] text-slate-600 mb-1" />
                <p className="text-sm font-semibold text-slate-400">Chưa có lịch sử hoạt động</p>
                <p className="text-xs text-slate-600">
                  {page === 'SHIFT_MANAGEMENT'
                    ? 'Các thao tác cấu hình ca làm sẽ xuất hiện tại đây.'
                    : page === 'SERVERS'
                    ? 'Các thao tác tạo hoặc xóa server sẽ xuất hiện tại đây.'
                    : page === 'PAYROLL'
                    ? 'Các thao tác chốt lương, thưởng/phạt hoặc cấu hình thù lao sẽ xuất hiện tại đây.'
                    : 'Các thao tác chỉnh sửa hoặc upload sẽ xuất hiện tại đây.'}
                </p>
              </div>
            ) : filteredLogs.length === 0 ? (
              <div className="py-16 flex flex-col items-center justify-center text-slate-500 space-y-2 border border-dashed border-slate-800 rounded-xl bg-slate-900/20">
                {page === 'SHIFTS' && activeTab === 'EXCEL' ? (
                  <FileSpreadsheet className="w-8 h-8 stroke-[1.2] text-slate-600 mb-1" />
                ) : (
                  <Search className="w-8 h-8 stroke-[1.2] text-slate-600 mb-1" />
                )}
                <p className="text-sm font-semibold text-slate-400">
                  {search || dateFilter
                    ? 'Không tìm thấy hoạt động phù hợp'
                    : page === 'SHIFTS' && activeTab === 'EXCEL'
                    ? 'Chưa có lượt upload file Excel nào'
                    : page === 'SHIFTS'
                    ? 'Chưa có thao tác phân ca nào'
                    : page === 'PAYROLL' && activePayrollTab === 'PAYROLL'
                    ? 'Chưa có nhật ký bảng lương & chốt số nào'
                    : page === 'PAYROLL'
                    ? 'Chưa có nhật ký cấu hình thù lao nào'
                    : page === 'SHIFT_MANAGEMENT'
                    ? 'Chưa có lịch sử thay đổi ca làm nào'
                    : page === 'SERVERS'
                    ? 'Chưa có lịch sử thay đổi server nào'
                    : 'Chưa có thao tác nào'}
                </p>
                <p className="text-xs text-slate-600">
                  {search || dateFilter
                    ? 'Thử thay đổi từ khóa tìm kiếm hoặc ngày cần xem.'
                    : page === 'SHIFTS' && activeTab === 'EXCEL'
                    ? 'Khi bạn tải lên file Excel phân ca, lịch sử nhập sẽ hiển thị tại đây.'
                    : page === 'SHIFTS'
                    ? 'Các thao tác xếp ca, đổi ca hoặc xóa nhân viên sẽ xuất hiện tại đây.'
                    : page === 'PAYROLL' && activePayrollTab === 'PAYROLL'
                    ? 'Các thao tác chốt bảng lương, mở khóa hoặc điều chỉnh thưởng/phạt nhân sự sẽ xuất hiện tại đây.'
                    : page === 'PAYROLL'
                    ? 'Các thay đổi về phụ cấp ca đêm, cuối tuần, phụ cấp theo ngày hoặc lương cơ bản theo ca sẽ xuất hiện tại đây.'
                    : page === 'SHIFT_MANAGEMENT'
                    ? 'Các thao tác thêm khung giờ, sửa giờ làm hoặc xóa ca sẽ xuất hiện tại đây.'
                    : page === 'SERVERS'
                    ? 'Các thao tác tạo server, cập nhật hoặc xóa server sẽ xuất hiện tại đây.'
                    : 'Các thao tác chỉnh sửa sẽ xuất hiện tại đây.'}
                </p>
                {(search || dateFilter) && (
                  <button
                    onClick={() => {
                      setSearch('');
                      setDateFilter('');
                    }}
                    className="mt-2 px-3 py-1.5 rounded-lg bg-slate-800 hover:bg-slate-700 text-xs text-cyan-400 font-medium transition-colors cursor-pointer"
                  >
                    Đặt lại bộ lọc
                  </button>
                )}
              </div>
            ) : (
              filteredLogs.map((log) => {
                const badge = getActionBadge(log.action);
                const isExpanded = expandedLogId === log.id;
                const formattedTime = format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss');

                return (
                  <div
                    key={log.id}
                    className="border border-slate-800/80 hover:border-slate-700/80 bg-slate-900/40 hover:bg-slate-900/60 rounded-xl p-3.5 transition-all text-xs"
                  >
                    {/* Top Row: Badge + Time */}
                    <div className="flex items-center justify-between gap-2 mb-2">
                      <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-md border text-[10px] font-mono font-semibold ${badge.color}`}>
                        {badge.icon}
                        {badge.label}
                      </span>
                      <span className="text-[11px] text-slate-500 font-mono flex items-center gap-1">
                        <Clock className="w-3 h-3 text-slate-600" />
                        {formattedTime}
                      </span>
                    </div>

                    {/* Summary text */}
                    <p className="text-slate-200 font-medium leading-relaxed mb-2">
                      {log.summary || `Thực hiện ${log.action} trên ${log.entity_type}`}
                    </p>

                    {/* Actor Row */}
                    <div className="flex items-center justify-between pt-2 border-t border-slate-800/50 text-[11px] text-slate-400">
                      <span className="flex items-center gap-1.5">
                        <User className="w-3.5 h-3.5 text-cyan-500/70" />
                        <span className="text-slate-300 font-medium">
                          {log.actor?.full_name || log.actor?.username || 'Hệ thống'}
                        </span>
                        {log.actor?.role && (
                          <span className="text-[9px] px-1.5 py-0.2 rounded bg-slate-800 text-slate-400 font-mono">
                            {log.actor.role}
                          </span>
                        )}
                      </span>

                      {/* Expand metadata if available */}
                      {log.metadata && (
                        <button
                          onClick={() => setExpandedLogId(isExpanded ? null : log.id)}
                          className="flex items-center gap-1 text-[11px] text-cyan-400 hover:text-cyan-300 transition-colors cursor-pointer"
                        >
                          <span>{isExpanded ? 'Ẩn chi tiết' : 'Chi tiết'}</span>
                          {isExpanded ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                        </button>
                      )}
                    </div>

                    {/* Collapsible Metadata */}
                    {isExpanded && log.metadata && (
                      <div className="mt-2.5 pt-2.5 border-t border-slate-800 text-[11px] overflow-hidden">
                        <LogMetadataDiff metadata={log.metadata} action={log.action} />
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>

          {/* Footer */}
          <div className="p-3 sm:px-5 border-t border-slate-800/80 bg-slate-900/30 flex items-center justify-between text-[11px] text-slate-500">
            <span>
              Đang xem:{' '}
              <span className="font-semibold text-slate-300">
                {page === 'SHIFTS'
                  ? activeTab === 'EXCEL'
                    ? 'Upload Excel'
                    : 'Tạo / Sửa / Xóa'
                  : page === 'PAYROLL'
                  ? activePayrollTab === 'PAYROLL'
                    ? 'Lịch sử Bảng lương'
                    : 'Lịch sử Cấu hình Thù lao'
                  : page === 'SHIFT_MANAGEMENT'
                  ? 'Quản lý Ca làm'
                  : page === 'SERVERS'
                  ? 'Quản lý Server'
                  : 'Hoạt động'}
              </span>{' '}
              (Hiển thị <span className="font-semibold text-cyan-400">{filteredLogs.length}</span> /{' '}
              <span className="font-semibold text-slate-300">
                {page === 'SHIFTS'
                  ? activeTab === 'EXCEL'
                    ? tabCounts.excel
                    : tabCounts.changes
                  : page === 'PAYROLL'
                  ? activePayrollTab === 'PAYROLL'
                    ? tabCounts.payroll
                    : tabCounts.config
                  : logs.length}
              </span>{' '}
              mục)
            </span>
            <a
              href="/audit-logs"
              className="text-cyan-400 hover:text-cyan-300 transition-colors font-medium hover:underline flex items-center gap-1"
            >
              Xem toàn bộ nhật ký &rarr;
            </a>
          </div>

        </div>
      </div>
    </div>
  );
}
