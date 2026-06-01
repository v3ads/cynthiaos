import React from 'react';
import AppLayout from '@/components/AppLayout';
import LeaseExpirationsContent from './components/LeaseExpirationsContent';

export const dynamic = 'force-dynamic';

export default function LeaseExpirationsPage() {
  return (
    <AppLayout>
      <LeaseExpirationsContent />
    </AppLayout>
  );
}
