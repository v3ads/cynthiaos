import React from 'react';
import AppLayout from '@/components/AppLayout';
import CollectionsContent from './components/CollectionsContent';

export const metadata = { title: 'Collections — CynthiaOS' };

export default function CollectionsPage() {
  return (
    <AppLayout>
      <CollectionsContent />
    </AppLayout>
  );
}
