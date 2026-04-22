import React from 'react';
import AppLayout from '@/components/AppLayout';
import LeasingPipelineContent from './components/LeasingPipelineContent';
export const metadata = { title: 'Leasing Pipeline — CynthiaOS' };
export default function LeasingPipelinePage() {
  return <AppLayout><LeasingPipelineContent /></AppLayout>;
}
