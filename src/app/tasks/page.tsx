import React from 'react';
import AppLayout from '@/components/AppLayout';
import TasksContent from './components/TasksContent';

export const metadata = { title: 'Tasks — CynthiaOS' };

export default function TasksPage() {
  return (
    <AppLayout>
      <TasksContent />
    </AppLayout>
  );
}
