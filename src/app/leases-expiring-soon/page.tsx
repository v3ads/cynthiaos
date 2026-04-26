import React, { Suspense } from 'react';
import AppLayout from '@/components/AppLayout';
import LeasesExpiringSoonContent from './components/LeasesExpiringSoonContent';

export default function LeasesExpiringSoonPage() {
  return (
    <AppLayout>
      <Suspense>
        <LeasesExpiringSoonContent />
      </Suspense>
    </AppLayout>
  );
}