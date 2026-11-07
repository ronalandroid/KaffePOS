// src/components/pos/PosIcons.tsx — shared presentational atoms for the POS
// surface: the brand coffee-cup glyph used in empty states and the catalog
// loading skeleton. Extracted from POSTab.tsx for reuse across pos/ components.
import { memo } from 'react';
import { SKELETON_KEYS } from './posHelpers';

export const CoffeeCupIcon = ({ className }: { className?: string }) => <svg viewBox="0 0 40 40" fill="none" xmlns="http://www.w3.org/2000/svg" className={className}><path d="M9 18L31 18L28 35Q27.5 37 25.5 37L14.5 37Q12.5 37 12 35Z" stroke="currentColor" strokeWidth="1.5" fill="currentColor" fillOpacity="0.2" strokeLinejoin="round"/><path d="M31 22Q38 22 38 27Q38 32 31 32" stroke="currentColor" strokeWidth="1.5" fill="none" strokeLinecap="round"/><path d="M6 18L34 18" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M15 14Q18 9 15 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M20 13Q17 8 20 4" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/><path d="M25 14Q28 9 25 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round"/></svg>;

export const POSSkeleton = memo(function POSSkeleton() {
  return (
    <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
      {SKELETON_KEYS.map((key) => (
        <div key={key} className="h-44 rounded-[20px] bg-stone-100 animate-pulse" />
      ))}
    </div>
  );
});
