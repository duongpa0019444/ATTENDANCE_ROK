import { create } from 'zustand';

interface Staff {
  id: string;
  name: string;
  shift: string;
  status: 'PENDING' | 'CONFIRMED' | 'CHECKED_IN' | 'LATE';
}

interface AttendanceState {
  staffList: Staff[];
  updateStaffStatus: (id: string, status: Staff['status']) => void;
  setStaffList: (list: Staff[]) => void;
}

export const useAttendanceStore = create<AttendanceState>((set) => ({
  staffList: [
    { id: '1', name: 'Nguyen Van A (Faker)', shift: '08:00 - 17:00', status: 'PENDING' },
    { id: '2', name: 'Tran B (Chovy)', shift: '08:00 - 17:00', status: 'CONFIRMED' },
    { id: '3', name: 'Le C (Showmaker)', shift: '08:00 - 17:00', status: 'LATE' },
    { id: '4', name: 'Pham D (Canyon)', shift: '08:00 - 17:00', status: 'CHECKED_IN' },
  ],
  updateStaffStatus: (id, status) => set((state) => ({
    staffList: state.staffList.map(s => s.id === id ? { ...s, status } : s)
  })),
  setStaffList: (list) => set({ staffList: list }),
}));
