import { create } from 'zustand'

// timeFilter controls the date window for dashboard data fetching
// Values: 7 | 14 | 30 | 90 (days)
export const useUiStore = create((set) => ({
  timeFilter: 30,
  setTimeFilter: (days) => set({ timeFilter: days }),
}))
