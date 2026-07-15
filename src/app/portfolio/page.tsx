import React from 'react';
import AppLayout from '@/components/AppLayout';
import PortfolioContent from './components/PortfolioContent';

export const metadata = { title: 'Portfolio — CynthiaOS' };

export default function PortfolioPage() {
  return (
    <AppLayout>
      <PortfolioContent />
    </AppLayout>
  );
}
