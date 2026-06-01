import React from 'react';
import AppLayout from '@/components/AppLayout';
import LeasingFunnelContent from './components/LeasingFunnelContent';

export const dynamic = 'force-dynamic';

export default function LeasingFunnelPage() {
  return (
    <AppLayout>
      <LeasingFunnelContent />
    </AppLayout>
  );
}
