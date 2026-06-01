import React from 'react';
import AppLayout from '@/components/AppLayout';
import DashboardContent from './components/DashboardContent';

export const dynamic = 'force-dynamic';

export default function DashboardPage() {
  return (
    <AppLayout>
      <DashboardContent />
    </AppLayout>
  );
}
