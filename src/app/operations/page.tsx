import React from 'react';
import AppLayout from '@/components/AppLayout';
import OperationsContent from './components/OperationsContent';

export const metadata = { title: 'Operations — CynthiaOS' };

export default function OperationsPage() {
  return (
    <AppLayout>
      <OperationsContent />
    </AppLayout>
  );
}
