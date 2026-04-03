'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import TasksContent from './components/TasksContent';
import { LeaseExpiration, getLeasesExpiringSoon } from '@/lib/api';

export default function TasksPage() {
  const [leases, setLeases] = useState<LeaseExpiration[]>([]);

  useEffect(() => {
    getLeasesExpiringSoon(1, 200)
      .then(res => setLeases(res.data))
      .catch(() => setLeases([]));
  }, []);

  return (
    <AppLayout>
      <TasksContent leases={leases} />
    </AppLayout>
  );
}
