import React from 'react';
import AppLayout from '@/components/AppLayout';
import PlatformsContent from './components/PlatformsContent';

export const dynamic = 'force-dynamic';
export const metadata = { title: 'Platforms — CynthiaOS' };

export default function PlatformsPage() {
  return (
    <AppLayout>
      <PlatformsContent />
    </AppLayout>
  );
}
