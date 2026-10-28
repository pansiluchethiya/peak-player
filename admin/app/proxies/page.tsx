'use client';
import { AdminShell, useAuthCheck } from '@/components/AdminShell';
import { ProxyManager } from '@/components/ProxyManager';

export default function ProxiesPage() {
  const auth = useAuthCheck();

  if (auth === 'loading') {
    return (
      <AdminShell title="Proxies">
        <p className="admin-page-subtitle">Checking session…</p>
      </AdminShell>
    );
  }

  return (
    <AdminShell title="Proxies">
      <ProxyManager />
    </AdminShell>
  );
}
