import React from 'react';
import AppLayout from '@/components/AppLayout';
import UnitIntelligenceContent from './components/UnitIntelligenceContent';

export const dynamic = 'force-dynamic';

export default function UnitIntelligencePage() {
  return (
    <AppLayout>
      <UnitIntelligenceContent />
    </AppLayout>
  );
}
