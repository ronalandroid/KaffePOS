// src/components/settings/CashierPanel.tsx — Cashier management section (gated by plan)
import UpgradePrompt from '@/components/UpgradePrompt';
import CashierManagementSection from './CashierManagementSection';
import { dispatchUpgradePrompt } from '@/lib/upgradePrompts';
import type { ToastType } from '@/types';

interface CashierPanelProps {
  canManageCashiers: boolean;
  toast: { showToast: (message: string, type?: ToastType) => void };
}

export default function CashierPanel({ canManageCashiers, toast }: CashierPanelProps) {
  return (
    <>
      {!canManageCashiers ? (
        <UpgradePrompt
          recommendedPlan="signature"
          billingCycle="monthly"
          title="Multi kasir ada di paket Signature"
          description="Buat akun kasir terpisah dan kelola akses outlet saat tim mulai berkembang."
          actionLabel="Lihat Paket Signature"
          onAction={() => dispatchUpgradePrompt({
            trigger: 'multi_cashier',
            promptKey: 'feature:multi_cashier',
            recommendedPlan: 'signature',
            title: 'Multi kasir ada di paket Signature',
            description: 'Upgrade untuk membuat akun kasir, mengatur akses outlet, dan memisahkan aktivitas tim dengan lebih rapi.',
          })}
        />
      ) : (
        <CashierManagementSection toast={toast} />
      )}
    </>
  );
}
