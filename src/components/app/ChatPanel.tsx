import { useState, useEffect, useRef } from "react";
import { supabase } from "@/integrations/supabase/client";
import { useAuth } from "@/hooks/useAuth";
import { Send, Loader2 } from "lucide-react";
import type { Tables } from "@/integrations/supabase/types";
import ReactMarkdown from "react-markdown";

type ChatMessage = Tables<"chat_messages">;

const ChatPanel = ({ documentId }: { documentId: string }) => {
  const { user } = useAuth();
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const scrollRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    fetchMessages();
  }, [documentId]);

  useEffect(() => {
    scrollRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages]);

  const fetchMessages = async () => {
    const { data } = await supabase
      .from("chat_messages")
      .select("*")
      .eq("document_id", documentId)
      .order("created_at");
    if (data) setMessages(data);
  };

  const sendMessage = async () => {
    if (!input.trim() || !user || loading) return;
    const content = input.trim();
    setInput("");
    setLoading(true);

    // Insert user message
    const { data: userMsg } = await supabase.from("chat_messages").insert({
      user_id: user.id,
      document_id: documentId,
      role: "user",
      content,
    }).select().single();

    if (userMsg) setMessages((prev) => [...prev, userMsg]);

    try {
      const { data, error } = await supabase.functions.invoke("chat-with-notes", {
        body: {
          documentId,
          message: content,
          history: messages.slice(-10).map((m) => ({ role: m.role, content: m.content })),
        },
      });

      if (error) throw error;

      // Insert assistant message
      const { data: aiMsg } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        document_id: documentId,
        role: "assistant",
        content: data.reply || "I couldn't generate a response.",
      }).select().single();

      if (aiMsg) setMessages((prev) => [...prev, aiMsg]);
    } catch {
      const { data: errMsg } = await supabase.from("chat_messages").insert({
        user_id: user.id,
        document_id: documentId,
        role: "assistant",
        content: "Sorry, I encountered an error. Please try again.",
      }).select().single();
      if (errMsg) setMessages((prev) => [...prev, errMsg]);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex flex-col h-[600px] bg-turbo-card rounded-xl overflow-hidden">
      {/* Messages */}
      <div className="flex-1 overflow-y-auto p-4 space-y-4">
        {messages.length === 0 && (
          <div className="text-center py-16">
            <p className="text-muted-foreground text-sm">Ask anything about this document. The AI has full context of your notes.</p>
          </div>
        )}
        {messages.map((msg) => (
          <div key={msg.id} className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}>
            <div className={`max-w-[80%] rounded-2xl px-4 py-3 ${
              msg.role === "user"
                ? "bg-primary text-primary-foreground"
                : "bg-secondary text-foreground"
            }`}>
              <div className="prose prose-sm prose-invert max-w-none">
                <ReactMarkdown>{msg.content}</ReactMarkdown>
              </div>
            </div>
          </div>
        ))}
        {loading && (
          <div className="flex justify-start">
            <div className="bg-secondary rounded-2xl px-4 py-3">
              <Loader2 className="w-4 h-4 text-muted-foreground animate-spin" />
            </div>
          </div>
        )}
        <div ref={scrollRef} />
      </div>

      {/* Input */}
      <div className="border-t border-border p-4">
        <form onSubmit={(e) => { e.preventDefault(); sendMessage(); }} className="flex gap-2">
          <input
            type="text"
            value={input}
            onChange={(e) => setInput(e.target.value)}
            placeholder="Ask about this document..."
            className="flex-1 bg-background border border-border rounded-lg px-4 py-2.5 text-foreground placeholder:text-muted-foreground text-sm focus:outline-none focus:ring-2 focus:ring-primary/50"
          />
          <button
            type="submit"
            disabled={!input.trim() || loading}
            className="p-2.5 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 disabled:opacity-50 transition-colors"
          >
            <Send className="w-4 h-4" />
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChatPanel;
