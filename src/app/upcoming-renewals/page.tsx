import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import UpcomingRenewalsContent from './components/UpcomingRenewalsContent';

export const dynamic = 'force-dynamic';

export default function UpcomingRenewalsPage() {
  return (
    <AppLayout>
      <Suspense>
        <UpcomingRenewalsContent />
      </Suspense>
    </AppLayout>
  );
}
