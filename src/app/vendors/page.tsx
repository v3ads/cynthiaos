import React from 'react';
import AppLayout from '@/components/AppLayout';
import VendorsContent from './components/VendorsContent';
export const metadata = { title: 'Vendors — CynthiaOS' };
export default function VendorsPage() {
  return <AppLayout><VendorsContent /></AppLayout>;
}
