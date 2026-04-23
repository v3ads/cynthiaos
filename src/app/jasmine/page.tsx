import React from 'react';
import AppLayout from '@/components/AppLayout';
import JasmineChatPanel from '@/components/jasmine/JasmineChatPanel';

export const metadata = {
  title: 'Ask Jasmine — CynthiaOS',
  description: 'AI property assistant for Cynthia Gardens',
};

export default function JasminePage() {
  return (
    <AppLayout>
      <div className="h-[calc(100vh-0px)] flex flex-col">
        <JasmineChatPanel />
      </div>
    </AppLayout>
  );
}
