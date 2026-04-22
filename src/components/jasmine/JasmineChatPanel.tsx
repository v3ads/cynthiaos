'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';

type Role = 'user' | 'assistant';

interface Message {
  role: Role;
  content: string;
  timestamp: Date;
  csv_data?:  string | null;
  csv_label?: string;
}

declare global {
  interface Window {
    SpeechRecognition: new () => SpeechRecognition;
    webkitSpeechRecognition: new () => SpeechRecognition;
  }
}

const EXAMPLE_QUERIES = [
  { label: 'Vacancy summary',   query: 'How many vacant units do we have?' },
  { label: 'Expiring leases',   query: 'Leases expiring in the next 30 days' },
  { label: 'On notice',         query: 'Who is on notice to vacate?' },
  { label: 'Delinquency',       query: 'Show high risk delinquency' },
  { label: 'Below market',      query: 'Units renting below market rate' },
  { label: 'Long vacancies',    query: 'Units vacant more than 90 days' },
  { label: 'Move schedule',     query: 'Upcoming move-ins and move-outs' },
  { label: 'Open tasks',        query: 'What tasks are open right now?' },
  { label: 'Portfolio summary', query: 'Give me a full property summary' },
];

// ── Icons ─────────────────────────────────────────────────────────────────────

function MicIcon({ active }: { active: boolean }) {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className={`w-4 h-4 transition-colors ${active ? 'text-red-400' : 'text-slate-400'}`}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8"  y1="22" x2="16" y2="22" />
    </svg>
  );
}

function BackIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-4 h-4">
      <path d="M19 12H5" />
      <path d="M12 19l-7-7 7-7" />
    </svg>
  );
}

function DownloadIcon() {
  return (
    <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 24 24" fill="none"
      stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"
      className="w-3.5 h-3.5">
      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
      <polyline points="7 10 12 15 17 10" />
      <line x1="12" y1="15" x2="12" y2="3" />
    </svg>
  );
}

// ── CSV download helper ───────────────────────────────────────────────────────

function downloadCSV(csvData: string, label: string) {
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  const date = new Date().toISOString().slice(0, 10);
  a.href     = url;
  a.download = `${label}-${date}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-end gap-3 mb-4">
      <div className="w-7 h-7 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center flex-shrink-0">
        <span className="text-indigo-300 text-xs font-bold tracking-tight">J</span>
      </div>
      <div className="bg-slate-900 border border-slate-700/60 rounded-2xl rounded-bl-sm px-4 py-3">
        <div className="flex gap-1.5 items-center h-4">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-1.5 h-1.5 rounded-full bg-indigo-400 animate-bounce"
              style={{ animationDelay: `${i * 0.18}s`, animationDuration: '0.9s' }} />
          ))}
        </div>
      </div>
    </div>
  );
}

// ── Message bubble ────────────────────────────────────────────────────────────

function MessageBubble({ message }: { message: Message }) {
  const isUser  = message.role === 'user';
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
      <div className="flex flex-col gap-1.5 max-w-[84%]">
        <div className="bg-slate-900 border border-slate-700/60 text-slate-200 text-sm px-4 py-3 rounded-2xl rounded-bl-sm leading-relaxed whitespace-pre-wrap">
          {message.content}
        </div>

        {/* CSV download button — only when list data is available */}
        {message.csv_data && (
          <button
            onClick={() => downloadCSV(message.csv_data!, message.csv_label ?? 'jasmine-export')}
            className="self-start flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium
              bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-emerald-700/60
              text-slate-400 hover:text-emerald-400 transition-all duration-150"
          >
            <DownloadIcon />
            Download CSV
          </button>
        )}

        <span className="text-[10px] text-slate-600 pl-1">{timeStr}</span>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

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
          <button key={label} onClick={() => onQuery(query)}
            className="px-3 py-1.5 text-xs font-medium rounded-lg bg-slate-800 hover:bg-slate-700 border border-slate-700 hover:border-slate-500 text-slate-400 hover:text-slate-200 transition-all duration-150">
            {label}
          </button>
        ))}
      </div>
    </div>
  );
}

// ── Main component ────────────────────────────────────────────────────────────

export default function JasmineChatPanel() {
  const [messages,    setMessages]    = useState<Message[]>([]);
  const [history,     setHistory]     = useState<unknown[]>([]);
  const [input,       setInput]       = useState('');
  const [loading,     setLoading]     = useState(false);
  const [error,       setError]       = useState<string | null>(null);
  const [listening,   setListening]   = useState(false);
  const [speechAvail, setSpeechAvail] = useState(false);

  const bottomRef      = useRef<HTMLDivElement>(null);
  const inputRef       = useRef<HTMLInputElement>(null);
  const recognitionRef = useRef<SpeechRecognition | null>(null);

  useEffect(() => {
    setSpeechAvail(
      typeof window !== 'undefined' &&
      ('SpeechRecognition' in window || 'webkitSpeechRecognition' in window)
    );
  }, []);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages, loading]);

  // ── Voice ─────────────────────────────────────────────────────────────────
  const startListening = useCallback(() => {
    if (!speechAvail) return;
    const SR = window.SpeechRecognition ?? window.webkitSpeechRecognition;
    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.continuous = true;
    recognition.interimResults = true;
    recognition.maxAlternatives = 1;

    recognition.onstart = () => setListening(true);

    recognition.onresult = (event: SpeechRecognitionEvent) => {
      let transcript = '';
      for (let i = 0; i < event.results.length; i++) {
        transcript += event.results[i][0].transcript;
      }
      setInput(transcript);
    };

    recognition.onerror = (event: SpeechRecognitionErrorEvent) => {
      if (event.error !== 'no-speech') {
        setListening(false);
        recognitionRef.current = null;
      }
    };

    recognition.onend = () => {
      if (recognitionRef.current) {
        try { recognitionRef.current.start(); } catch { /* ignore */ }
      }
    };

    recognitionRef.current = recognition;
    recognition.start();
  }, [speechAvail]);

  const stopListening = useCallback(() => {
    if (recognitionRef.current) {
      recognitionRef.current.onend = null;
      recognitionRef.current.stop();
      recognitionRef.current = null;
    }
    setListening(false);
  }, []);

  const toggleListening = useCallback(() => {
    if (listening) { stopListening(); } else { startListening(); }
  }, [listening, startListening, stopListening]);

  // ── Send ──────────────────────────────────────────────────────────────────
  const sendQuery = useCallback(
    async (query: string) => {
      const trimmed = query.trim();
      if (!trimmed || loading) return;
      if (listening) stopListening();

      setInput('');
      setError(null);
      setMessages((prev) => [...prev, { role: 'user', content: trimmed, timestamp: new Date() }]);
      setLoading(true);

      try {
        const res = await fetch('/api/jasmine/query', {
          method:  'POST',
          headers: { 'Content-Type': 'application/json' },
          body:    JSON.stringify({ query: trimmed, history }),
        });
        if (!res.ok) throw new Error(`Server error ${res.status}`);
        const data = await res.json();
        if (data.error) throw new Error(data.error);

        setMessages((prev) => [
          ...prev,
          {
            role:      'assistant',
            content:   data.answer,
            timestamp: new Date(),
            csv_data:  data.csv_data  ?? null,
            csv_label: data.csv_label ?? 'jasmine-export',
          },
        ]);
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
    [loading, history, listening, stopListening]
  );

  const handleKeyDown = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && !e.shiftKey) { e.preventDefault(); sendQuery(input); }
  };

  const handleClear = () => {
    stopListening();
    setMessages([]); setHistory([]); setError(null);
    inputRef.current?.focus();
  };

  // ── Render ────────────────────────────────────────────────────────────────
  return (
    <div className="flex flex-col h-full bg-slate-950 rounded-xl border border-slate-800 overflow-hidden">

      {/* Header */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-slate-800 bg-slate-950 flex-shrink-0">
        <Link href="/dashboard"
          className="p-1.5 rounded-lg text-slate-500 hover:text-slate-300 hover:bg-slate-800 transition-colors flex-shrink-0"
          aria-label="Back to dashboard">
          <BackIcon />
        </Link>
        <div className="w-7 h-7 rounded-full bg-indigo-900 border border-indigo-700 flex items-center justify-center flex-shrink-0">
          <span className="text-indigo-300 text-xs font-bold tracking-tight">J</span>
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-slate-100 text-sm font-semibold tracking-wide leading-none mb-0.5">Jasmine</p>
          <div className="flex items-center gap-1.5">
            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse flex-shrink-0" />
            <span className="text-[11px] text-slate-500 truncate">Live · CynthiaOS Gold layer</span>
          </div>
        </div>
        {messages.length > 0 && (
          <button onClick={handleClear}
            className="text-[11px] text-slate-600 hover:text-slate-400 transition-colors px-2 py-1 rounded flex-shrink-0">
            Clear
          </button>
        )}
      </div>

      {/* Messages */}
      <div className="flex-1 overflow-y-auto px-4 py-4 scroll-smooth">
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

      {/* Error banner */}
      {error && (
        <div className="mx-4 mb-3 px-3 py-2 bg-red-950/60 border border-red-800/50 rounded-lg">
          <p className="text-xs text-red-400">{error}</p>
        </div>
      )}

      {/* Input */}
      <div className="px-3 pb-4 pt-2 flex-shrink-0 border-t border-slate-800/60">
        <div className="flex gap-1.5 items-center">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? 'Listening…' : 'Ask anything…'}
            disabled={loading}
            autoComplete="off"
            className="flex-1 min-w-0 bg-slate-900 border border-slate-700 hover:border-slate-600 focus:border-indigo-500 focus:ring-1 focus:ring-indigo-500/30 text-slate-200 placeholder-slate-600 text-sm px-3 py-2.5 rounded-xl outline-none disabled:opacity-50 disabled:cursor-not-allowed transition-all duration-150"
          />
          {speechAvail && (
            <button onClick={toggleListening} disabled={loading}
              title={listening ? 'Stop listening' : 'Speak your question'}
              className={`p-2.5 rounded-xl border transition-all duration-150 flex-shrink-0
                ${listening
                  ? 'bg-red-950/60 border-red-800/60 hover:bg-red-900/60'
                  : 'bg-slate-900 border-slate-700 hover:border-slate-500 hover:bg-slate-800'
                } disabled:opacity-40 disabled:cursor-not-allowed`}>
              <MicIcon active={listening} />
            </button>
          )}
          <button
            onClick={() => sendQuery(input)}
            disabled={loading || !input.trim()}
            className="flex-shrink-0 w-14 flex items-center justify-center py-2.5 rounded-xl text-sm font-medium bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed text-white transition-all duration-150">
            {loading
              ? <span className="w-3.5 h-3.5 border-2 border-white/30 border-t-white rounded-full animate-spin" />
              : 'Ask'}
          </button>
        </div>
        <p className="text-[10px] text-slate-700 mt-2 pl-1">
          Data refreshes daily at 8 AM EST · Family & employee units excluded
        </p>
      </div>
    </div>
  );
}
