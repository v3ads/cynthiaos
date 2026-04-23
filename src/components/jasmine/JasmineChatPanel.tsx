'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import Link from 'next/link';
import ReactMarkdown from 'react-markdown';

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
      className={`w-5 h-5 transition-colors ${active ? 'text-red-400' : 'text-text-muted'}`}>
      <rect x="9" y="2" width="6" height="11" rx="3" />
      <path d="M5 10a7 7 0 0 0 14 0" />
      <line x1="12" y1="19" x2="12" y2="22" />
      <line x1="8"  y1="22" x2="16" y2="22" />
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

// ── CSV ───────────────────────────────────────────────────────────────────────

function downloadCSV(csvData: string, label: string) {
  const blob = new Blob([csvData], { type: 'text/csv;charset=utf-8;' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `${label}-${new Date().toISOString().slice(0, 10)}.csv`;
  a.click();
  URL.revokeObjectURL(url);
}

// ── Typing indicator ──────────────────────────────────────────────────────────

function TypingIndicator() {
  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-accent text-sm font-bold">J</span>
      </div>
      <div className="bg-surface-elevated border border-border/50 rounded-2xl rounded-tl-sm px-5 py-4">
        <div className="flex gap-1.5 items-center h-5">
          {[0, 1, 2].map((i) => (
            <span key={i} className="w-2 h-2 rounded-full bg-accent animate-bounce"
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
      <div className="flex justify-end mb-5">
        <div className="flex flex-col items-end gap-1 max-w-[82%]">
          <div className="bg-accent text-background text-base px-5 py-3.5 rounded-2xl rounded-br-sm leading-relaxed font-medium">
            {message.content}
          </div>
          <span className="text-[11px] text-text-muted pr-1">{timeStr}</span>
        </div>
      </div>
    );
  }

  return (
    <div className="flex items-start gap-3 mb-5">
      <div className="w-9 h-9 rounded-full bg-accent/20 border border-accent/30 flex items-center justify-center flex-shrink-0 mt-0.5">
        <span className="text-accent text-sm font-bold">J</span>
      </div>
      <div className="flex flex-col gap-2 max-w-[88%]">
        <div className="bg-surface-elevated border-l-4 border-l-accent border border-border/40 text-text-primary text-base px-5 py-4 rounded-2xl rounded-tl-sm leading-relaxed">
          <ReactMarkdown
            components={{
              ul: ({ children }) => <ul className="list-disc pl-4 my-2 space-y-1.5">{children}</ul>,
              ol: ({ children }) => <ol className="list-decimal pl-4 my-2 space-y-1.5">{children}</ol>,
              li: ({ children }) => <li className="text-text-primary leading-snug">{children}</li>,
              p:  ({ children }) => <p className="mb-2 last:mb-0">{children}</p>,
              strong: ({ children }) => <strong className="text-accent font-semibold">{children}</strong>,
              code: ({ children }) => <code className="bg-surface text-accent px-1.5 rounded text-sm">{children}</code>,
              h2: ({ children }) => <h2 className="text-text-primary font-bold text-base mt-4 mb-2 first:mt-0">{children}</h2>,
              h3: ({ children }) => <h3 className="text-accent font-semibold text-sm uppercase tracking-wide mt-4 mb-1.5 first:mt-0">{children}</h3>,
              table: ({ children }) => <div className="overflow-x-auto my-3"><table className="w-full text-sm border-collapse">{children}</table></div>,
              thead: ({ children }) => <thead className="border-b-2 border-accent/30">{children}</thead>,
              th: ({ children }) => <th className="text-left text-accent font-semibold py-2 pr-5 whitespace-nowrap">{children}</th>,
              td: ({ children }) => <td className="text-text-primary py-2 pr-5 border-b border-border/40">{children}</td>,
            }}
          >
            {message.content}
          </ReactMarkdown>
        </div>

        {message.csv_data && (
          <button
            onClick={() => downloadCSV(message.csv_data!, message.csv_label ?? 'jasmine-export')}
            className="self-start flex items-center gap-2 px-4 py-2 rounded-xl text-sm font-medium
              bg-accent/10 hover:bg-accent/20 border border-accent/30 hover:border-accent/50
              text-accent transition-all duration-150"
          >
            <DownloadIcon />
            Download CSV
          </button>
        )}

        <span className="text-[11px] text-text-muted pl-1">{timeStr}</span>
      </div>
    </div>
  );
}

// ── Empty state ───────────────────────────────────────────────────────────────

function EmptyState({ onQuery }: { onQuery: (q: string) => void }) {
  return (
    <div className="flex flex-col items-start px-6 py-6 gap-5">
      <p className="text-text-secondary text-base leading-relaxed">
        Ask me anything about Cynthia Gardens — vacancies, leases, tenants, delinquency, financials, or portfolio health.
        I pull live data every time.
      </p>
      <div className="flex flex-wrap gap-2.5">
        {EXAMPLE_QUERIES.map(({ label, query }) => (
          <button key={label} onClick={() => onQuery(query)}
            className="px-4 py-2 text-sm font-medium rounded-full
              bg-surface-elevated hover:bg-accent/10 border border-border/60 hover:border-accent/40
              text-text-secondary hover:text-accent transition-all duration-150">
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
    <div className="flex flex-col h-full bg-background overflow-hidden">

      {/* ── Hero header — matches Jasmine 1.0 gradient style ── */}
      <div className="flex-shrink-0 relative overflow-hidden"
        style={{ background: 'linear-gradient(135deg, hsl(228 32% 12%) 0%, hsl(200 60% 15%) 50%, hsl(165 50% 12%) 100%)' }}>
        {/* Gradient accent bar at top */}
        <div className="h-1 w-full" style={{ background: 'linear-gradient(90deg, #a78bfa, #ec4899, #2dd4bf)' }} />
        <div className="px-6 py-6 flex items-center justify-between">
          <div>
            <div className="flex items-center gap-2 mb-1">
              <span className="text-2xl">👋</span>
              <h1 className="text-2xl font-bold text-text-primary">
                Hi, I&apos;m{' '}
                <span className="text-accent">Jasmine</span>
              </h1>
            </div>
            <p className="text-text-secondary text-sm">Your Cynthia Gardens Rental Expert</p>
          </div>
          <div className="flex items-center gap-3">
            {messages.length > 0 && (
              <button onClick={handleClear}
                className="text-xs text-text-muted hover:text-text-secondary transition-colors px-3 py-1.5 rounded-lg border border-border/40 hover:border-border">
                Clear
              </button>
            )}
            <Link href="/dashboard"
              className="text-xs text-text-muted hover:text-text-secondary transition-colors px-3 py-1.5 rounded-lg border border-border/40 hover:border-border">
              ← Back
            </Link>
          </div>
        </div>
      </div>

      {/* ── Messages ── */}
      <div className="flex-1 overflow-y-auto px-4 py-5 scroll-smooth">
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

      {/* ── Error banner ── */}
      {error && (
        <div className="mx-4 mb-3 px-4 py-3 bg-danger/10 border border-danger/30 rounded-xl">
          <p className="text-sm text-danger">{error}</p>
        </div>
      )}

      {/* ── Input area — matches Jasmine 1.0 large pill style ── */}
      <div className="flex-shrink-0 px-4 pb-5 pt-3 bg-surface border-t border-border/50">
        {/* Input row */}
        <div className="flex items-center gap-3 mb-3">
          <input
            ref={inputRef}
            value={input}
            onChange={(e) => setInput(e.target.value)}
            onKeyDown={handleKeyDown}
            placeholder={listening ? 'Listening…' : 'Ask me about units, availability, leases…'}
            disabled={loading}
            autoComplete="off"
            className="flex-1 min-w-0 bg-surface-elevated border border-border/60 hover:border-border
              focus:border-accent focus:ring-2 focus:ring-accent/20
              text-text-primary placeholder:text-text-muted text-base
              px-5 py-3.5 rounded-full outline-none
              disabled:opacity-50 disabled:cursor-not-allowed
              transition-all duration-150"
          />
          {speechAvail && (
            <button onClick={toggleListening} disabled={loading}
              title={listening ? 'Stop listening' : 'Speak your question'}
              className={`w-12 h-12 rounded-full border flex items-center justify-center flex-shrink-0 transition-all duration-150
                ${listening
                  ? 'bg-red-900/40 border-red-700/60 hover:bg-red-900/60'
                  : 'bg-surface-elevated border-border/60 hover:border-border hover:bg-surface'
                } disabled:opacity-40 disabled:cursor-not-allowed`}>
              <MicIcon active={listening} />
            </button>
          )}
        </div>

        {/* Full-width Ask button */}
        <button
          onClick={() => sendQuery(input)}
          disabled={loading || !input.trim()}
          className="w-full py-4 rounded-full text-base font-bold
            disabled:opacity-40 disabled:cursor-not-allowed
            text-background transition-all duration-150 active:scale-[0.98]"
          style={{
            background: loading || !input.trim()
              ? 'hsl(165 85% 42% / 0.4)'
              : 'linear-gradient(135deg, hsl(165 85% 42%) 0%, hsl(145 75% 48%) 100%)',
          }}
        >
          {loading ? (
            <span className="flex items-center justify-center gap-2">
              <span className="w-4 h-4 border-2 border-background/40 border-t-background rounded-full animate-spin" />
              Thinking…
            </span>
          ) : 'Ask'}
        </button>

        {/* Footer */}
        <div className="flex items-center justify-center gap-1.5 mt-3">
          <span className="w-2 h-2 rounded-full bg-accent animate-pulse" />
          <p className="text-xs text-text-muted">
            Live data · Data refreshes daily at 6 AM EST
          </p>
        </div>
      </div>
    </div>
  );
}
