'use client';
import React from 'react';

interface ChangeItem {
  field: string;
  label: string;
  old: any;
  new: any;
}

interface LogMetadataDiffProps {
  metadata: any;
  action?: string;
  className?: string;
}

// Strictly blacklist internal technical database fields
const isTechnicalKey = (key: string): boolean => {
  const k = key.toLowerCase();
  return (
    k === 'id' ||
    k === 'actorid' ||
    k === 'actor_id' ||
    k === 'entityid' ||
    k === 'entity_id' ||
    k === 'shiftid' ||
    k === 'shift_id' ||
    k === 'userid' ||
    k === 'user_id' ||
    k === 'userids' ||
    k === 'user_ids' ||
    k === 'serverid' ||
    k === 'server_id' ||
    k === 'server_ids' ||
    k === 'createdat' ||
    k === 'created_at' ||
    k === 'updatedat' ||
    k === 'updated_at' ||
    k === 'weekstartdate' ||
    k === 'week_start_date' ||
    k === 'graceminutes' ||
    k === 'grace_minutes' ||
    k.endsWith('_id')
  );
};

export default function LogMetadataDiff({ metadata, action, className = '' }: LogMetadataDiffProps) {
  if (!metadata || typeof metadata !== 'object') {
    return null;
  }

  // 1. Changes array (Before vs After Diff)
  const validChanges = (Array.isArray(metadata.changes) ? metadata.changes : []).filter(
    (change: ChangeItem) =>
      change &&
      change.field &&
      !isTechnicalKey(change.field) &&
      String(change.old ?? '').trim() !== String(change.new ?? '').trim()
  );

  if (validChanges.length > 0) {
    return (
      <div className={`space-y-2.5 ${className}`}>
        {/* Context badges for shifts or dates */}
        {(metadata.shiftName || metadata.workDate || metadata.serverName) && (
          <div className="flex flex-wrap items-center gap-3 text-[11px] text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-900/60 px-3 py-1.5 rounded-lg border border-slate-200 dark:border-slate-800">
            {metadata.serverName && (
              <div>
                <span className="text-slate-500">Server:</span>{' '}
                <span className="font-semibold text-cyan-600 dark:text-cyan-400">SV {metadata.serverName}</span>
              </div>
            )}
            {metadata.shiftName && (
              <div>
                <span className="text-slate-500">Ca làm:</span>{' '}
                <span className="font-semibold text-slate-800 dark:text-slate-200">
                  {metadata.shiftName}
                  {metadata.startTime ? ` (${metadata.startTime})` : ''}
                </span>
              </div>
            )}
            {metadata.workDate && (
              <div>
                <span className="text-slate-500">Ngày trực:</span>{' '}
                <span className="font-mono font-semibold text-amber-600 dark:text-amber-400">{metadata.workDate}</span>
              </div>
            )}
          </div>
        )}

        <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider flex items-center gap-1.5">
          <span>🔄</span> Chi tiết các trường thay đổi:
        </div>
        <div className="border border-slate-200 dark:border-slate-800/90 rounded-lg overflow-hidden bg-white dark:bg-slate-950/70 divide-y divide-slate-200 dark:divide-slate-800/60 shadow-sm">
          {validChanges.map((change: ChangeItem, idx: number) => (
            <div
              key={idx}
              className="p-2 sm:px-3 flex flex-col sm:flex-row sm:items-center justify-between gap-1.5 sm:gap-4 text-xs hover:bg-slate-50 dark:hover:bg-slate-900/40 transition-colors"
            >
              <span className="font-medium text-slate-700 dark:text-slate-300 min-w-[120px] shrink-0">
                {change.label || change.field}
              </span>
              <div className="flex items-center gap-2 flex-wrap min-w-0">
                <span
                  className="px-2 py-0.5 rounded bg-red-500/10 border border-red-500/25 text-red-600 dark:text-red-400 font-mono text-[11px] line-through truncate max-w-[200px]"
                  title={String(change.old ?? 'Trống')}
                >
                  {String(change.old ?? 'Trống')}
                </span>
                <span className="text-slate-400 font-bold text-xs">➔</span>
                <span
                  className="px-2 py-0.5 rounded bg-emerald-500/10 border border-emerald-500/25 text-emerald-700 dark:text-emerald-400 font-mono text-[11px] font-semibold truncate max-w-[200px]"
                  title={String(change.new ?? 'Trống')}
                >
                  {String(change.new ?? 'Trống')}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  }

  // 2. Excel Import details
  if (action === 'EXCEL_IMPORT' || metadata.fileName) {
    return (
      <div className={`space-y-1.5 bg-white dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800/90 text-xs shadow-sm ${className}`}>
        <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-2 flex items-center gap-1.5">
          <span>📊</span> Chi tiết nhập dữ liệu Excel:
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2 text-slate-700 dark:text-slate-300">
          <div className="flex items-center gap-1.5">
            <span className="text-slate-500">📄 File:</span>
            <span className="font-semibold text-emerald-600 dark:text-emerald-400 truncate">{metadata.fileName || 'N/A'}</span>
          </div>
          {metadata.weekStartDate && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">📅 Tuần áp dụng:</span>
              <span className="font-mono font-semibold text-cyan-600 dark:text-cyan-400">{metadata.weekStartDate}</span>
            </div>
          )}
          {metadata.importedCount !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">✅ Số ca đã nhập:</span>
              <span className="font-bold text-amber-600 dark:text-amber-400">{metadata.importedCount} lượt</span>
            </div>
          )}
          {metadata.totalRows !== undefined && (
            <div className="flex items-center gap-1.5">
              <span className="text-slate-500">📑 Tổng dòng file:</span>
              <span className="text-slate-600 dark:text-slate-400">{metadata.totalRows}</span>
            </div>
          )}
        </div>
      </div>
    );
  }

  // 3. Created entity info
  if (metadata.created && typeof metadata.created === 'object') {
    const entries = Object.entries(metadata.created).filter(([k, v]) => !isTechnicalKey(k) && v !== null && v !== undefined && String(v).trim() !== '');
    if (entries.length > 0) {
      return (
        <div className={`space-y-1.5 bg-white dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800/90 text-xs shadow-sm ${className}`}>
          <div className="text-[10px] font-bold text-emerald-600 dark:text-emerald-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span>✨</span> Thông tin khởi tạo mới:
          </div>
          <div className="space-y-1">
            {entries.map(([key, val]) => (
              <div key={key} className="flex items-center justify-between gap-4 py-1 border-b border-slate-100 dark:border-slate-800/40 last:border-none">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{key}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // 4. Deleted entity info
  if (metadata.deletedUser || metadata.deleted || metadata.deletedShift) {
    const deletedInfo = metadata.deletedUser || metadata.deleted || metadata.deletedShift;
    const entries = typeof deletedInfo === 'object'
      ? Object.entries(deletedInfo).filter(([k, v]) => !isTechnicalKey(k) && v !== null && v !== undefined && String(v).trim() !== '')
      : [];
    if (entries.length > 0) {
      return (
        <div className={`space-y-1.5 bg-white dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800/90 text-xs shadow-sm ${className}`}>
          <div className="text-[10px] font-bold text-red-600 dark:text-red-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
            <span>🗑️</span> Thông tin đối tượng đã xóa:
          </div>
          <div className="space-y-1">
            {entries.map(([key, val]) => (
              <div key={key} className="flex items-center justify-between gap-4 py-1 border-b border-slate-100 dark:border-slate-800/40 last:border-none">
                <span className="text-slate-600 dark:text-slate-400 font-medium">{key}:</span>
                <span className="font-semibold text-slate-800 dark:text-slate-200">{String(val)}</span>
              </div>
            ))}
          </div>
        </div>
      );
    }
  }

  // 5. Clean Key-Value parser for any other objects (filter out internal IDs & technical fields)
  const cleanEntries: Array<{ label: string; value: string }> = [];
  const labelMap: Record<string, string> = {
    telegramId: 'Telegram ID',
    full_name: 'Họ và tên',
    username: 'Tên đăng nhập',
    role: 'Vai trò',
    startDate: 'Từ ngày',
    endDate: 'Đến ngày',
    server_name: 'Server',
    serverName: 'Server',
    shift_name: 'Tên ca',
    shiftName: 'Tên ca',
    start_time: 'Giờ bắt đầu',
    startTime: 'Giờ bắt đầu',
    end_time: 'Giờ kết thúc',
    endTime: 'Giờ kết thúc',
    base_salary: 'Lương cơ bản',
    baseSalary: 'Lương cơ bản',
  };

  const processObject = (obj: any, prefix = '') => {
    for (const [key, val] of Object.entries(obj)) {
      if (isTechnicalKey(key)) continue;

      // Special case for shift object in legacy logs: only extract human fields
      if (key === 'shift' && val && typeof val === 'object') {
        const s = val as any;
        if (s.name) cleanEntries.push({ label: 'Tên ca', value: s.name });
        if (s.start_time) cleanEntries.push({ label: 'Giờ bắt đầu', value: s.start_time });
        if (s.end_time) cleanEntries.push({ label: 'Giờ kết thúc', value: s.end_time });
        if (s.base_salary) cleanEntries.push({ label: 'Lương cơ bản', value: `${Number(s.base_salary).toLocaleString('vi-VN')}đ` });
        continue;
      }

      if (val && typeof val === 'object' && !Array.isArray(val)) {
        processObject(val, prefix ? `${prefix} > ${key}` : key);
      } else if (val !== null && val !== undefined && String(val).trim() !== '') {
        cleanEntries.push({
          label: labelMap[key] || (prefix ? `${prefix} (${key})` : key),
          value: String(val),
        });
      }
    }
  };

  processObject(metadata);

  if (cleanEntries.length === 0) {
    return null;
  }

  return (
    <div className={`space-y-1 bg-white dark:bg-slate-950/70 p-3 rounded-lg border border-slate-200 dark:border-slate-800/90 text-xs shadow-sm ${className}`}>
      <div className="text-[10px] font-bold text-slate-600 dark:text-slate-400 uppercase tracking-wider mb-1.5 flex items-center gap-1.5">
        <span>📋</span> Chi tiết thông số:
      </div>
      <div className="space-y-1">
        {cleanEntries.map((item, idx) => (
          <div key={idx} className="flex items-center justify-between gap-4 py-1 border-b border-slate-100 dark:border-slate-800/40 last:border-none">
            <span className="text-slate-600 dark:text-slate-400 font-medium">{item.label}:</span>
            <span className="font-mono text-cyan-700 dark:text-cyan-300 font-semibold">{item.value}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
