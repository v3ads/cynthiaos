import React from 'react';
import AppLayout from '@/components/AppLayout';
import ARAgingContent from './components/ARAgingContent';
export const metadata = { title: 'AR Aging — CynthiaOS' };
export default function ARAgingPage() {
  return <AppLayout><ARAgingContent /></AppLayout>;
}
