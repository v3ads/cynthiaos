import React from 'react';
import AppLayout from '@/components/AppLayout';
import FinancialsContent from './components/FinancialsContent';
export const metadata = { title: 'Financials — CynthiaOS' };
export default function FinancialsPage() {
  return <AppLayout><FinancialsContent /></AppLayout>;
}
