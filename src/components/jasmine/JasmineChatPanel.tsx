'use client';

import { useState, useRef, useEffect, useCallback } from 'react';

type Role = 'user' | 'assistant';

interface Message {
  role: Role;
  content: string;
  timestamp: Date;
}

const EXAMPLE_QUERIES = [
  { label: 'Vacancy summary', query: 'How many vacant units do we have?' },
  { label: 'Expiring leases', query: 'Leases expiring in the next 30 days' },
  { label: 'On notice', query: 'Who is on notice to vacate?' },
  { label: 'Delinquency', query: 'Show high risk delinquency' },
  { label: 'Below market', query: 'Units renting below market rate' },
  { label: 'Long vacancies', query: 'Units vacant more than 90 days' },
  { label: 'Move schedule', query: 'Upcoming move-ins and move-outs' },
  { label: 'Open tasks', query: 'What tasks are open right now?' },
  { label: 'Portfolio summary', query: 'Give me a full property summary' },
];

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-7 h-7 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center flex-shrink-0">
        <span className="text-indigo-300 text-xs font-bold tracking-tight">J</span>
      </div>
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span
              key={i}
              className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
              style={{ animationDelay: `${i * 0.18}s`, animationDuration: '0.9s' }}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

function MessageBubble({ message }: { message: Message }) {
  const isUser = message.role === 'user';
  const timeStr = message.timestamp.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  if (isUser) {
    return (
      <div className="flex justify-end mb-4 gap-2 items-end">
        <div className="flex flex-col items-end gap-1 max-w-[78%]">
          <div className="bg-indigo-600 text-white text-sm px-4 py-2.5 rounded-2xl rounded-br-sm leading-relaxed">
            {message.content}
          </div>
          <span className="text-[10px] text-slate-600 pr-1">{timeStr}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-7 h-7 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center flex-shrink-0">
        <span className="text-indigo-300 text-xs font-bold tracking-tight">J</span>
      </div>
      <div className="flex flex-col gap-1 max-w-[84%]">
        <div className="bg-slate-900 border border-slate-700/60 text-slate-200 text-sm px-4 py-3 rounded-2xl rounded-bl-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>
        <span className="text-[10px] text-slate-600 pl-1">{timeStr}</span>
      </div>
    </div>
  );
}

function EmptyState({ onQuery }: { onQuery: (q: string) => void }) {
  return (
    <div className="flex flex-col items-start justify-center h-full px-6 py-8 gap-6">
      <div className="flex items-center gap-3">
        <div className="w-10 h-10 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center">
          <span className="text-indigo-300 text-base font-bold tracking-tight">J</span>
        </div>
        <div>
          <p className="text-slate-100 text-sm font-semibold tracking-wide">Jasmine</p>
          <p className="text-slate-500 text-xs">Cynthia Gardens · 182 units · Live data</p>
        </div>
      </div>
      <p className="text-slate-400 text-sm leading-relaxed max-w-sm">
        Ask me anything about vacancies, leases, tenants, delinquency, or portfolio health.
        I pull live data from CynthiaOS every time.
      </p>
      <div className="flex flex-wrap gap-2">
        {EXAMPLE_QUERIES.map(({ label, query }) => (
          <button
            key={label}
            onClick={() => onQuery(query)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 transition-all duration-150"
          >
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

export default function JasmineChatPanel() {
  const [messages, setMessages] = useState<Message[]>([]);
  const [history, setHistory] = useState<unknown[]>([]);
  const [input, setInput] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  const sendQuery = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || loading) return;
      setInput('');
      setError(null);
      setMessages((prev) => [...prev, { role: 'user', content: trimmed, timestamp: new Date() }]);
      setLoading(true);
      try {
        const res = await fetch('/api/jasmine/query', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ query: trimmed, history }),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);
        setMessages((prev) => [...prev, { role: 'assistant', content: data.answer, timestamp: new Date() }]);
        setHistory(data.history ?? []);
      } catch (err) {
        setError(err instanceof Error ? err.message : 'Something went wrong.');
        setMessages((prev) => [
          ...prev,
          { role: 'assistant', content: 'Sorry, I ran into an issue. Please try again.', timestamp: new Date() },
        ]);
      } finally {
        setLoading(false);
        setTimeout(() => inputRef.current?.focus(), 50);
      }
    },
    [loading, history]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(input); }
  };

  const handleClear = () => {
    setMessages([]); setHistory([]); setError(null); inputRef.current?.focus();
  };

  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">
      <div className="flex items-center justify-between px-5 py-3.5 border-b border-slate-800 bg-slate-950 flex-shrink-0">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center">
            <span className="text-indigo-300 text-sm font-bold tracking-tight">J</span>
          </div>
          <div>
            <p className="text-slate-100 text-sm font-semibold tracking-wide leading-none mb-0.5">Jasmine</p>
            <div className="flex items-center gap-1.5">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
              <span className="text-[11px] text-slate-500">Live · CynthiaOS Gold layer</span>
            </div>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={handleClear} className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors px-2 py-1 rounded">
            Clear
          </button>
        )}
      </div>

      <div className="flex-1 overflow-y-auto px-5 py-4 scroll-smooth">
        {messages.length === 0 ? (
          <EmptyState onQuery={sendQuery} />
        ) : (
          <>
            {messages.map((m, i) => <MessageBubble key={i} message={m} />)}
            {loading && <TypingIndicator />}
          </>
        )}
        <div ref={bottomRef} />
      </div>

      {error && (
        <div className="mx-5 mb-3 px-3 py-2 bg-red-950/60 border border-red-800/50 rounded-lg">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      <div className="px-4 pb-4 pt-2 flex-shrink-0 border-t border-slate-800/60">
        <div className="flex gap-2 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder="Ask about units, leases, tenants, revenue…"
            disabled={loading}
            autoComplete="off"
            className="flex-1 bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-200 placeholder-slate-600 text-sm px-4 py-2.5 rounded-xl outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
          />
          <button
            onClick={() => sendQuery(input)}
            disabled={loading || !input.trim()}
            className="px-4 py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all duration-150 flex-shrink-0"
          >
            {loading ? (
              <span className="flex items-center gap-1.5">
                <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
                <span>Asking</span>
              </span>
            ) : 'Ask'}
          </button>
        </div>
        <p className="text-[10px] text-slate-700 mt-2 pl-1">
          Data refreshes daily at 8 AM EST · Family & employee units excluded from calculations
        </p>
      </div>
    </div>
  );
}
