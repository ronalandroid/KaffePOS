// src/store/slices/syncSlice.ts — connectivity + offline-sync indicator state.
// The heavy lifting lives in ../sync (flushPending/updateSyncIndicators); this
// slice only exposes the state fields and the public `flushPending` action.
import type { AppSlice, SyncSlice } from '../types';
import { initialState, getLiveConnectivity } from '../defaults';
import { flushPending } from '../sync';

export const createSyncSlice: AppSlice<SyncSlice> = () => ({
  syncing:          initialState.syncing,
  pendingSyncCount: initialState.pendingSyncCount,
  failedSyncCount:  initialState.failedSyncCount,
  // isOnline + syncStatus come from the live connectivity snapshot, mirroring
  // the legacy create() override of initialState.syncStatus.
  ...getLiveConnectivity(),
  flushPending: () => flushPending(),
});
