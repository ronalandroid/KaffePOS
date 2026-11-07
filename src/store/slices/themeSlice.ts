// src/store/slices/themeSlice.ts — app + custom theme state and persistence.
import { applyThemeToDocument } from '@/lib/theme';
import type { AppSlice, ThemeSlice } from '../types';
import { initialState } from '../defaults';

export const createThemeSlice: AppSlice<ThemeSlice> = (set, get) => ({
  appTheme:    initialState.appTheme,
  customTheme: initialState.customTheme,

  setAppTheme: (theme) => {
    const { customTheme } = get();
    if (typeof window !== 'undefined') localStorage.setItem('kpos_app_theme', theme);
    applyThemeToDocument(theme, customTheme);
    set({ appTheme: theme });
  },

  setCustomTheme: (theme) => {
    const nextTheme = { ...get().customTheme, ...theme };
    if (typeof window !== 'undefined') {
      localStorage.setItem('kpos_app_theme_custom', JSON.stringify(nextTheme));
    }
    if (get().appTheme === 'custom') {
      applyThemeToDocument('custom', nextTheme);
    }
    set({ customTheme: nextTheme });
  },
});
