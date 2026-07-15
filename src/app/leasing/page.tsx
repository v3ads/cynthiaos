import React from 'react';
import AppLayout from '@/components/AppLayout';
import LeasingContent from './components/LeasingContent';

export const metadata = { title: 'Leasing — CynthiaOS' };

export default function LeasingPage() {
  return (
    <AppLayout>
      <LeasingContent />
    </AppLayout>
  );
}
