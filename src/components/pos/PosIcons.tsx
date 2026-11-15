// src/components/pos/PosIcons.tsx — shared presentational atoms for the POS
// surface: the brand coffee-cup glyph used in empty states and the catalog
// loading skeleton. Extracted from POSTab.tsx for reuse across pos/ components.
import { memo } from 'react';
import { SKELETON_KEYS } from './posHelpers';

/**
 * Cangkir kopi untuk empty state kasir. Digambar di grid 24 dengan stroke 2 dan
 * ujung bulat supaya segaris dengan ikon lucide. Tanpa uap dan tanpa isi: bentuk
 * cangkirnya sudah cukup dikenali di 24 px.
 */
export const CoffeeCupIcon = ({ className }: { className?: string }) => (
  <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" xmlns="http://www.w3.org/2000/svg" className={className} aria-hidden="true">
    <path d="M4 8h13l-1.2 9.2A2 2 0 0 1 13.8 19H7.2a2 2 0 0 1-2-1.8L4 8Z" />
    <path d="M17 10h1.5a2.5 2.5 0 0 1 0 5H16.4" />
    <path d="M3 22h15" />
  </svg>
);

export const POSSkeleton = memo(function POSSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {SKELETON_KEYS.map((key) => (
        <div key={key} className="h-44 rounded-[20px] bg-stone-100 animate-pulse" />
      ))}
    </div>
  );
});
