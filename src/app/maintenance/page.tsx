import React from 'react';
import AppLayout from '@/components/AppLayout';
import MaintenanceContent from './components/MaintenanceContent';

export const dynamic = 'force-dynamic';

export default function MaintenancePage() {
  return (
    <AppLayout>
      <MaintenanceContent />
    </AppLayout>
  );
}
