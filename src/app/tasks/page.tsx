'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import TasksContent from './components/TasksContent';
import { LeaseExpiration, getActiveLeasePopulation } from '@/lib/api';

export default function TasksPage() {
  const [leases, setLeases] = useState<LeaseExpiration[]>([]);

  useEffect(() => {
    // One canonical lease universe shared with Home and Leases — the task
    // engine must run on the same population everywhere or task counts
    // diverge across pages (July 2026 audit finding).
    getActiveLeasePopulation()
      .then(setLeases)
      .catch((e) => {
        console.error('Tasks lease population load failed:', e);
        setLeases([]);
      });
  }, []);

  return (
    <AppLayout>
      <TasksContent leases={leases} />
    </AppLayout>
  );
}
