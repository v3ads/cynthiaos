'use client';

import React, { useEffect, useState } from 'react';
import AppLayout from '@/components/AppLayout';
import TasksContent from './components/TasksContent';
import { LeaseExpiration, getLeasesExpiringSoon } from '@/lib/api';

export default function TasksPage() {
  const [leases, setLeases] = useState<LeaseExpiration[]>([]);

  useEffect(() => {
    getLeasesExpiringSoon(1, 500)
      .then(res => {
        // Deduplicate: one record per unit, keeping the soonest expiration
        // Note: mapLeaseExpiration maps unit_id → r.unit (not r.unit_id)
        const seenUnits = new Map<string, typeof res.data[0]>();
        (res.data || []).forEach(r => {
          const existing = seenUnits.get(r.unit);
          if (!existing || (r.days_until_expiration ?? 9999) < (existing.days_until_expiration ?? 9999)) {
            seenUnits.set(r.unit, r);
          }
        });
        setLeases(Array.from(seenUnits.values()));
      })
      .catch(() => setLeases([]));
  }, []);

  return (
    <AppLayout>
      <TasksContent leases={leases} />
    </AppLayout>
  );
}
