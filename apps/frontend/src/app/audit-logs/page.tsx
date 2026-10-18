'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { 
  History, 
  Search, 
  Filter, 
  FileSpreadsheet, 
  PlusCircle, 
  Edit3, 
  Trash2, 
  Lock, 
  Unlock, 
  RefreshCw, 
  Copy, 
  Clock, 
  User, 
  Database, 
  ChevronLeft, 
  ChevronRight, 
  ChevronDown,
  Download,
  Calendar
} from 'lucide-react';
import { apiFetch } from '@/lib/api';
import { format } from 'date-fns';
import * as XLSX from 'xlsx';
import LogMetadataDiff from '@/components/LogMetadataDiff';

interface AuditLog {
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

export default function AuditLogsPage() {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [expandedLogId, setExpandedLogId] = useState<string | null>(null);

  // Filters
  const [pageFilter, setPageFilter] = useState('ALL');
  const [actionFilter, setActionFilter] = useState('ALL');
  const [search, setSearch] = useState('');
  const [startDate, setStartDate] = useState('');
  const [endDate, setEndDate] = useState('');

  // Pagination
  const [currentPage, setCurrentPage] = useState(1);
  const limit = 20;

  const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:3002';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    try {
      const params = new URLSearchParams();
      if (pageFilter !== 'ALL') params.append('page', pageFilter);
      if (actionFilter !== 'ALL') params.append('action', actionFilter);
      if (search.trim()) params.append('search', search.trim());
      if (startDate) params.append('startDate', startDate);
      if (endDate) params.append('endDate', endDate);

      params.append('limit', String(limit));
      params.append('offset', String((currentPage - 1) * limit));

      const res = await apiFetch(`${API_URL}/audit-logs?${params.toString()}`);
      if (res.ok) {
        const data = await res.json();
        setLogs(data.data || []);
        setTotal(data.total || 0);
      }
    } catch (err) {
      console.error('Failed to fetch audit logs:', err);
    } finally {
      setLoading(false);
    }
  }, [API_URL, pageFilter, actionFilter, search, startDate, endDate, currentPage]);

  useEffect(() => {
    fetchLogs();
  }, [fetchLogs]);

  // Reset page on filter change
  const handleFilterChange = (setter: (val: string) => void, val: string) => {
    setter(val);
    setCurrentPage(1);
  };

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

  const getPageLabel = (page: string) => {
    switch (page) {
      case 'SHIFTS': return 'Phân Ca';
      case 'USERS': return 'Nhân Sự';
      case 'PAYROLL': return 'Bảng Lương';
      case 'SETTINGS': return 'Cài Đặt';
      default: return page;
    }
  };

  const exportExcel = () => {
    if (logs.length === 0) return;
    const exportData = logs.map((item, idx) => ({
      STT: idx + 1,
      'Thời gian': format(new Date(item.created_at), 'dd/MM/yyyy HH:mm:ss'),
      'Trang': getPageLabel(item.page),
      'Hành động': item.action,
      'Người thực hiện': item.actor?.full_name || item.actor?.username || 'Hệ thống',
      'Vai trò': item.actor?.role || 'N/A',
      'Nội dung tóm tắt': item.summary,
      'Chi tiết': item.metadata ? JSON.stringify(item.metadata) : '',
    }));

    const ws = XLSX.utils.json_to_sheet(exportData);
    const wb = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(wb, ws, 'Nhat_Ky_He_Thong');
    XLSX.writeFile(wb, `nhat_ky_he_thong_${format(new Date(), 'yyyyMMdd_HHmm')}.xlsx`);
  };

  const totalPages = Math.ceil(total / limit) || 1;

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-4 sm:p-6 lg:p-8 space-y-6">
      
      {/* Top Header */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 border-b border-slate-800/80 pb-5">
        <div>
          <h1 className="text-xl sm:text-2xl font-bold tracking-wider text-transparent bg-clip-text bg-gradient-to-r from-cyan-400 to-indigo-400 flex items-center gap-2.5">
            <History className="w-7 h-7 text-cyan-400" />
            NHẬT KÝ HỆ THỐNG // AUDIT_LOGS
          </h1>
          <p className="text-xs text-slate-400 mt-1">
            Ghi lại toàn bộ lịch sử chỉnh sửa, thao tác phân ca, upload Excel và chốt bảng lương
          </p>
        </div>

        <div className="flex items-center gap-3">
          <button
            onClick={exportExcel}
            disabled={logs.length === 0}
            className="flex items-center gap-2 px-3 py-2 bg-emerald-600/20 hover:bg-emerald-600/30 text-emerald-400 border border-emerald-500/30 rounded-lg text-xs font-semibold transition-all shadow-[0_0_15px_rgba(16,185,129,0.1)] cursor-pointer disabled:opacity-50"
          >
            <Download className="w-4 h-4" />
            XUẤT EXCEL
          </button>
          <button
            onClick={fetchLogs}
            disabled={loading}
            className="flex items-center gap-1.5 px-3 py-2 bg-slate-900 hover:bg-slate-800 border border-slate-800 rounded-lg text-xs font-medium text-slate-300 hover:text-white transition-colors cursor-pointer"
          >
            <RefreshCw className={`w-3.5 h-3.5 ${loading ? 'animate-spin text-cyan-400' : ''}`} />
            LÀM MỚI
          </button>
        </div>
      </div>

      {/* Filter Bar */}
      <div className="bg-slate-900/60 border border-slate-800/80 rounded-xl p-4 backdrop-blur-md grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3.5">
        {/* Search Input */}
        <div className="relative">
          <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-slate-500" />
          <input
            type="text"
            placeholder="Tìm theo nội dung, người dùng..."
            value={search}
            onChange={(e) => handleFilterChange(setSearch, e.target.value)}
            className="w-full pl-9 pr-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-100 placeholder:text-slate-600 focus:outline-none focus:border-cyan-500/50"
          />
        </div>

        {/* Page Filter */}
        <div>
          <select
            value={pageFilter}
            onChange={(e) => handleFilterChange(setPageFilter, e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
          >
            <option value="ALL">-- Tất cả trang --</option>
            <option value="SHIFTS">Trang Phân Ca (Shifts)</option>
            <option value="USERS">Trang Nhân Sự (Users)</option>
            <option value="PAYROLL">Trang Bảng Lương (Payroll)</option>
            <option value="SETTINGS">Cài Đặt Hệ Thống</option>
          </select>
        </div>

        {/* Action Filter */}
        <div>
          <select
            value={actionFilter}
            onChange={(e) => handleFilterChange(setActionFilter, e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
          >
            <option value="ALL">-- Tất cả hành động --</option>
            <option value="EXCEL_IMPORT">Nhập Excel (EXCEL_IMPORT)</option>
            <option value="CREATE">Tạo mới (CREATE)</option>
            <option value="UPDATE">Cập nhật (UPDATE)</option>
            <option value="DELETE">Xóa (DELETE)</option>
            <option value="LOCK">Chốt bảng lương (LOCK)</option>
            <option value="UNLOCK">Mở khóa bảng lương (UNLOCK)</option>
            <option value="SYNC">Đồng bộ phân ca (SYNC)</option>
            <option value="CLONE">Sao chép tuần (CLONE)</option>
          </select>
        </div>

        {/* Start Date */}
        <div>
          <input
            type="date"
            value={startDate}
            onChange={(e) => handleFilterChange(setStartDate, e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            title="Từ ngày"
          />
        </div>

        {/* End Date */}
        <div>
          <input
            type="date"
            value={endDate}
            onChange={(e) => handleFilterChange(setEndDate, e.target.value)}
            className="w-full px-3 py-2 bg-slate-950/80 border border-slate-800 rounded-lg text-xs text-slate-200 focus:outline-none focus:border-cyan-500/50 cursor-pointer"
            title="Đến ngày"
          />
        </div>
      </div>

      {/* Main Table */}
      <div className="bg-slate-900/40 border border-slate-800 rounded-xl overflow-hidden shadow-xl">
        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-900/80 text-slate-400 font-mono uppercase tracking-wider border-b border-slate-800">
              <tr>
                <th className="py-3 px-4 w-44">Thời gian</th>
                <th className="py-3 px-4 w-32">Trang</th>
                <th className="py-3 px-4 w-36">Hành động</th>
                <th className="py-3 px-4 w-44">Người thực hiện</th>
                <th className="py-3 px-4">Nội dung tóm tắt</th>
                <th className="py-3 px-4 w-32">Chi tiết</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60">
              {loading ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <div className="flex flex-col items-center justify-center space-y-2">
                      <div className="w-6 h-6 border-2 border-cyan-400 border-t-transparent rounded-full animate-spin" />
                      <span>ĐANG_TẢI_NHẬT_KÝ...</span>
                    </div>
                  </td>
                </tr>
              ) : logs.length === 0 ? (
                <tr>
                  <td colSpan={6} className="py-16 text-center text-slate-500">
                    <History className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                    <p className="text-sm font-semibold text-slate-400">Không tìm thấy bản ghi nhật ký nào</p>
                    <p className="text-xs text-slate-600 mt-1">Thử thay đổi bộ lọc hoặc từ khóa tìm kiếm</p>
                  </td>
                </tr>
              ) : (
                logs.map((log) => {
                  const badge = getActionBadge(log.action);
                  const formattedTime = format(new Date(log.created_at), 'dd/MM/yyyy HH:mm:ss');

                  return (
                    <React.Fragment key={log.id}>
                      <tr className="hover:bg-slate-900/50 transition-colors">
                      {/* Time */}
                      <td className="py-3.5 px-4 font-mono text-slate-400 whitespace-nowrap">
                        <div className="flex items-center gap-1.5">
                          <Clock className="w-3.5 h-3.5 text-slate-500" />
                          <span>{formattedTime}</span>
                        </div>
                      </td>

                      {/* Page */}
                      <td className="py-3.5 px-4">
                        <span className="px-2 py-0.5 rounded bg-slate-800 border border-slate-700/60 font-mono text-[11px] text-cyan-300">
                          {getPageLabel(log.page)}
                        </span>
                      </td>

                      {/* Action */}
                      <td className="py-3.5 px-4 whitespace-nowrap">
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded border text-[10px] font-mono font-semibold ${badge.color}`}>
                          {badge.icon}
                          {badge.label}
                        </span>
                      </td>

                      {/* Actor */}
                      <td className="py-3.5 px-4">
                        <div className="flex items-center gap-1.5">
                          <User className="w-3.5 h-3.5 text-cyan-400/80" />
                          <span className="font-medium text-slate-200">
                            {log.actor?.full_name || log.actor?.username || 'Hệ thống'}
                          </span>
                          {log.actor?.role && (
                            <span className="text-[9px] px-1 rounded bg-slate-800 text-slate-400 font-mono">
                              {log.actor.role}
                            </span>
                          )}
                        </div>
                      </td>

                      {/* Summary */}
                      <td className="py-3.5 px-4 font-medium text-slate-200 max-w-md">
                        {log.summary || `${log.action} trên ${log.entity_type}`}
                      </td>

                      {/* Detail action */}
                      <td className="py-3.5 px-4 text-slate-400 font-mono text-[11px] text-right">
                        {Boolean(
                          log.metadata &&
                          typeof log.metadata === 'object' &&
                          log.action !== 'READY' &&
                          (
                            (Array.isArray(log.metadata.changes) && log.metadata.changes.length > 0) ||
                            log.action === 'EXCEL_IMPORT' ||
                            log.metadata.fileName ||
                            Object.keys(log.metadata).some((k) => k !== 'source')
                          )
                        ) ? (
                          <button
                            onClick={() => setExpandedLogId(expandedLogId === log.id ? null : log.id)}
                            className="px-2.5 py-1 rounded bg-slate-800 hover:bg-slate-700 text-cyan-400 hover:text-cyan-300 font-sans text-xs inline-flex items-center gap-1 transition-all border border-slate-700/80 cursor-pointer"
                          >
                            <span>{expandedLogId === log.id ? 'Thu gọn' : 'Chi tiết'}</span>
                            {expandedLogId === log.id ? <ChevronDown className="w-3 h-3" /> : <ChevronRight className="w-3 h-3" />}
                          </button>
                        ) : (
                          <span className="text-slate-600">--</span>
                        )}
                      </td>
                    </tr>
                    {expandedLogId === log.id && log.metadata && log.action !== 'READY' && (
                      <tr className="bg-slate-900/50 border-b border-slate-800/80">
                        <td colSpan={6} className="py-3 px-6 bg-slate-950/60">
                          <LogMetadataDiff metadata={log.metadata} action={log.action} />
                        </td>
                      </tr>
                    )}
                  </React.Fragment>
                );
              })
              )}
            </tbody>
          </table>
        </div>

        {/* Pagination Footer */}
        <div className="py-3 px-4 border-t border-slate-800/80 bg-slate-900/60 flex flex-col sm:flex-row items-center justify-between gap-3 text-xs text-slate-400">
          <div>
            Hiển thị <span className="font-semibold text-slate-200">{logs.length}</span> / <span className="font-semibold text-slate-200">{total}</span> hoạt động
          </div>

          <div className="flex items-center gap-2">
            <button
              onClick={() => setCurrentPage((p) => Math.max(1, p - 1))}
              disabled={currentPage <= 1 || loading}
              className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
            >
              <ChevronLeft className="w-3.5 h-3.5" />
              Trước
            </button>
            <span className="font-mono text-xs px-2 text-slate-300">
              Trang {currentPage} / {totalPages}
            </span>
            <button
              onClick={() => setCurrentPage((p) => Math.min(totalPages, p + 1))}
              disabled={currentPage >= totalPages || loading}
              className="px-2.5 py-1.5 rounded-lg border border-slate-800 bg-slate-950 text-slate-300 hover:text-white hover:bg-slate-800 transition-colors disabled:opacity-40 disabled:pointer-events-none flex items-center gap-1 cursor-pointer"
            >
              Sau
              <ChevronRight className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}
