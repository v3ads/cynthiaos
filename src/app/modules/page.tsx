import React from 'react';
import AppLayout from '@/components/AppLayout';
import ModulesContent from './components/ModulesContent';

export const dynamic = 'force-dynamic';

export default function ModulesPage() {
  return (
    <AppLayout>
      <ModulesContent />
    </AppLayout>
  );
}
