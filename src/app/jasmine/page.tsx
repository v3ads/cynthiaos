import JasmineChatPanel from '@/components/jasmine/JasmineChatPanel';

export const metadata = {
  title: 'Ask Jasmine — CynthiaOS',
  description: 'AI property assistant for Cynthia Gardens',
};

export default function JasminePage() {
  return (
    <div className="h-[calc(100vh-64px)] p-4 md:p-6">
      <JasmineChatPanel />
    </div>
  );
}
