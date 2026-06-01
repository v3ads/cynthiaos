import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import LeasesExpiringSoonContent from './components/LeasesExpiringSoonContent';

export const dynamic = 'force-dynamic';

export default function LeasesExpiringSoonPage() {
  return (
    <AppLayout>
      <Suspense>
        <LeasesExpiringSoonContent />
      </Suspense>
    </AppLayout>
  );
}
