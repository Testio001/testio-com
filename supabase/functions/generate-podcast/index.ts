import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidatedContent, isCorruptedNotes } from "../_shared/extract-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId, maxExchanges } = await req.json();
    const exchangeLimit = maxExchanges || 17;
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);

    // Use notes only if not corrupted
    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map((n: any) => n.content).filter((c: string) => !isCorruptedNotes(c)).join("\n\n");
    const sourceContent = (noteContent && noteContent.length > 0) ? noteContent : content;

    if (!sourceContent.trim()) throw new Error("No content available to generate podcast. Generate notes first.");

    const needsUpgradeCTA = exchangeLimit < 17;
    const conversation: Array<{ speaker: string; text: string }> = [];
    const audioChunks: Uint8Array[] = [];

    for (let i = 0; i < exchangeLimit; i++) {
      const speaker = i % 2 === 0 ? "Alex" : "Sam";
      const voice = speaker === "Alex" ? "onyx" : "nova";
      const isFirst = i === 0;
      const isLast = i === exchangeLimit - 1;

      const prevConvo = conversation.map(c => `${c.speaker}: ${c.text}`).join("\n");

      let instruction: string;
      if (isFirst) {
        instruction = `You are Alex, a knowledgeable and enthusiastic podcast host. Start the podcast by introducing the topic from the study material below. Be engaging and natural, 1-3 sentences max.`;
      } else if (isLast) {
        if (needsUpgradeCTA) {
          instruction = `You are ${speaker}. Wrap up briefly and end by saying exactly: "Want to dive deeper? Upgrade to Testio Premium for full-length podcasts!"`;
        } else {
          instruction = `You are ${speaker}. Give a brief, thoughtful conclusion summarizing the key takeaways from this conversation. 1-3 sentences.`;
        }
      } else if (speaker === "Sam") {
        instruction = `You are Sam, a curious and engaged learner. React to what Alex just said and ask a great follow-up question about the study material. Be natural, 1-3 sentences max.`;
      } else {
        instruction = `You are Alex, a knowledgeable expert. Answer Sam's question clearly and engagingly based on the study material. Be natural, 1-3 sentences max.`;
      }

      const systemContent = `${instruction}\n\nStudy material:\n${sourceContent.substring(0, 6000)}${prevConvo ? `\n\nConversation so far:\n${prevConvo}` : ""}`;

      const ttsResponse = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${OPENAI_API_KEY}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini-audio-preview",
          modalities: ["text", "audio"],
          audio: { voice, format: "mp3" },
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: "Generate your next line in the podcast conversation. Speak naturally as if you're on a real podcast." },
          ],
        }),
      });

      if (!ttsResponse.ok) {
        console.error(`Audio generation failed for turn ${i}: ${ttsResponse.status}`);
        continue;
      }

      const ttsData = await ttsResponse.json();
      const audioObj = ttsData.choices?.[0]?.message?.audio;
      const transcript = audioObj?.transcript || ttsData.choices?.[0]?.message?.content || "";
      const audioBase64 = audioObj?.data;

      conversation.push({ speaker, text: transcript });

      if (audioBase64) {
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
        audioChunks.push(bytes);
      }
    }

    if (audioChunks.length === 0) throw new Error("Failed to generate podcast audio. Please try again.");

    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) { combinedAudio.set(chunk, offset); offset += chunk.length; }

    const fileName = `${doc.user_id}/podcast_${documentId}_${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage.from("documents").upload(fileName, combinedAudio.buffer, { contentType: "audio/mpeg", upsert: true });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: signedUrlData } = await supabase.storage.from("documents").createSignedUrl(fileName, 60 * 60 * 24 * 7);
    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName);
    const audioUrl = signedUrlData?.signedUrl || urlData?.publicUrl || "";

    await supabase.from("podcasts").insert({
      document_id: documentId, user_id: doc.user_id, title: `Podcast: ${doc.title}`,
      script: JSON.stringify(conversation), audio_url: audioUrl, status: "completed",
    });

    return new Response(JSON.stringify({ success: true, audioUrl, script: conversation }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Podcast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Podcast generation failed. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
