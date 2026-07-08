"use client";

import { useState, useRef, useEffect } from "react";
import { Bot, X, Send, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";

interface Message {
  role: "user" | "assistant";
  content: string;
}

export default function AIChatWidget() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    { role: "assistant", content: "Hi! I'm the CPE Portal AI. Ask me about schedules, assignments, lecturers, or anything about the department." },
  ]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const sendMessage = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!input.trim() || loading) return;

    const userMsg: Message = { role: "user", content: input.trim() };
    setMessages((prev) => [...prev, userMsg]);
    setInput("");
    setLoading(true);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      const token = session?.access_token;
      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL;

      const res = await fetch(`${backendUrl}/api/ai/chat`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${token}`,
        },
        body: JSON.stringify({ question: userMsg.content }),
      });

      if (!res.ok) {
        const errBody = await res.json().catch(() => ({}));
        throw new Error(errBody.error || `Server error ${res.status}`);
      }
      const body = await res.json();
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: body.reply || "Sorry, I couldn't get a response right now.",
      }]);
    } catch {
      setMessages((prev) => [...prev, {
        role: "assistant",
        content: "Network error. Please check your connection.",
      }]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen(true)}
        className={`fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-[#0a0a0a] text-white shadow-xl flex items-center justify-center hover:scale-105 transition-transform ${open ? "hidden" : "flex"}`}
        aria-label="Open AI assistant"
      >
        <Bot size={22} />
        <span className="absolute -top-0.5 -right-0.5 h-3.5 w-3.5 rounded-full bg-green-400 border-2 border-white" />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-6 right-6 z-50 w-[360px] max-w-[calc(100vw-2rem)] bg-white rounded-3xl shadow-2xl border border-gray-100 flex flex-col overflow-hidden"
          style={{ height: "520px" }}>
          {/* Header */}
          <div className="flex items-center gap-3 px-5 py-4 bg-[#0a0a0a] text-white">
            <div className="h-9 w-9 rounded-xl bg-green-400/20 flex items-center justify-center">
              <Bot size={18} className="text-green-400" />
            </div>
            <div className="flex-1">
              <p className="text-sm font-medium">CPE AI Assistant</p>
              <p className="text-xs text-white/40">Powered by Groq · Context-aware</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="text-white/40 hover:text-white transition"
            >
              <X size={18} />
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-3">
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[85%] rounded-2xl px-4 py-2.5 text-sm leading-relaxed whitespace-pre-wrap
                    ${msg.role === "user"
                      ? "bg-[#0a0a0a] text-white rounded-br-sm"
                      : "bg-gray-100 text-gray-800 rounded-bl-sm"
                    }`}
                >
                  {msg.content}
                </div>
              </div>
            ))}
            {loading && (
              <div className="flex justify-start">
                <div className="bg-gray-100 rounded-2xl rounded-bl-sm px-4 py-2.5">
                  <Loader2 size={16} className="animate-spin text-gray-400" />
                </div>
              </div>
            )}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <form onSubmit={sendMessage} className="px-4 py-3 border-t border-gray-100 flex items-center gap-2">
            <input
              type="text"
              value={input}
              onChange={(e) => setInput(e.target.value)}
              placeholder="Ask about schedules, assignments..."
              className="flex-1 text-sm px-4 py-2.5 rounded-xl border border-gray-200 focus:outline-none focus:ring-2 focus:ring-green-400/30 focus:border-green-400"
            />
            <button
              type="submit"
              disabled={loading || !input.trim()}
              className="h-9 w-9 rounded-xl bg-[#0a0a0a] text-white flex items-center justify-center hover:bg-gray-800 transition disabled:opacity-40"
            >
              <Send size={15} />
            </button>
          </form>
        </div>
      )}
    </>
  );
}
