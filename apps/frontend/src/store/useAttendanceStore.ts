import { create } from 'zustand';

export type AttendanceStatus =
  | 'PENDING'
  | 'READY'
  | 'LATE_REQUESTED'
  | 'ABSENT_REQUESTED'
  | 'CHECKED_IN'
  | 'LATE'
  | 'ABSENT';

export interface Staff {
  id: string; // shift assignment ID
  userId: string;
  name: string;
  shift: string;
  status: AttendanceStatus;
  lateMinutes?: number;
}

interface AttendanceState {
  staffList: Staff[];
  updateStaffStatus: (userId: string, status: AttendanceStatus, extra?: Partial<Staff>) => void;
  setStaffList: (list: Staff[]) => void;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  staffList: [],
  updateStaffStatus: (userId, status, extra = {}) => set((state) => ({
    staffList: state.staffList.map(s => s.userId === userId ? { ...s, status, ...extra } : s)
  })),
  setStaffList: (list) => set({ staffList: list }),
}));
