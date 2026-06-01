import React from 'react';
import AppLayout from '@/components/AppLayout';
import PipelineContent from './components/PipelineContent';

export const dynamic = 'force-dynamic';

export default function PipelinePage() {
  return (
    <AppLayout>
      <PipelineContent />
    </AppLayout>
  );
}
