// src/hooks/useStore.ts — compatibility re-export.
// The store now lives in src/store/, split into focused domain slices. This file
// preserves the legacy import path (`@/hooks/useStore`) used across the app.
export { useStore, initStoreListeners } from '@/store';
export type { AppStore } from '@/store';
