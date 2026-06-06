import React from 'react';
import AppLayout from '@/components/AppLayout';
import InsightsContent from './components/InsightsContent';

export const dynamic = 'force-dynamic';

export default function InsightsPage() {
  return (
    <AppLayout>
      <InsightsContent />
    </AppLayout>
  );
}
