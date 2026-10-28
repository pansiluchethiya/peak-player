'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { TokenManager } from '@/components/TokenManager';

export default function TokensPage() {
  const auth = useAuthCheck();

  if (auth === 'loading') {
    return (
      <AdminShell title="Tokens">
        <p className="admin-page-subtitle">Checking session…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Tokens">
      <TokenManager />
    </AdminShell>
  );
}
