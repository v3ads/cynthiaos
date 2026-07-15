import React from 'react';
import AppLayout from '@/components/AppLayout';
import TodayContent from './components/TodayContent';

export const metadata = { title: 'Today — CynthiaOS' };

export default function TodayPage() {
  return (
    <AppLayout>
      <TodayContent />
    </AppLayout>
  );
}
