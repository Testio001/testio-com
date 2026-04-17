import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidatedContent, isCorruptedNotes } from "../_shared/extract-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

async function callAudioAPI(apiKey: string, systemContent: string, voice: string, retries = 2): Promise<{ transcript: string; audioData: Uint8Array | null }> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const response = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: { Authorization: `Bearer ${apiKey}`, "Content-Type": "application/json" },
        body: JSON.stringify({
          model: "gpt-4o-mini-audio-preview",
          modalities: ["text", "audio"],
          audio: { voice, format: "mp3" },
          messages: [
            { role: "system", content: systemContent },
            { role: "user", content: "Generate your next line in the podcast conversation. Speak naturally, with depth and detail. Do NOT be brief." },
          ],
          max_tokens: 600,
        }),
      });

      if (!response.ok) {
        console.error(`Audio API attempt ${attempt} failed: ${response.status}`);
        if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
        throw new Error(`Audio API failed after ${retries + 1} attempts: ${response.status}`);
      }

      const data = await response.json();
      const audioObj = data.choices?.[0]?.message?.audio;
      const transcript = audioObj?.transcript || data.choices?.[0]?.message?.content || "";
      const audioBase64 = audioObj?.data;

      let audioData: Uint8Array | null = null;
      if (audioBase64) {
        const binaryString = atob(audioBase64);
        const bytes = new Uint8Array(binaryString.length);
        for (let j = 0; j < binaryString.length; j++) bytes[j] = binaryString.charCodeAt(j);
        audioData = bytes;
      }

      if (!audioData || transcript.length < 10) {
        if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
      }

      return { transcript, audioData };
    } catch (e) {
      if (attempt < retries) { await new Promise(r => setTimeout(r, 2000)); continue; }
      throw e;
    }
  }
  return { transcript: "", audioData: null };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId, maxExchanges } = await req.json();
    // Cap at 30 exchanges (~15 min) for Scholar plan
    const exchangeLimit = Math.min(Math.max(maxExchanges || 24, 4), 30);
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);

    // Use notes only if not corrupted
    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map((n: any) => n.content).filter((c: string) => !isCorruptedNotes(c)).join("\n\n");
    const sourceContent = (noteContent && noteContent.length > 0) ? noteContent : content;

    if (!sourceContent.trim()) throw new Error("No content available to generate podcast. Generate notes first.");

    const needsUpgradeCTA = exchangeLimit < 24; // Free + Basic only
    const conversation: Array<{ speaker: string; text: string }> = [];
    const audioChunks: Uint8Array[] = [];
    const materialContext = sourceContent.substring(0, 8000);

    for (let i = 0; i < exchangeLimit; i++) {
      const speaker = i % 2 === 0 ? "Alex" : "Sam";
      const voice = speaker === "Alex" ? "onyx" : "nova";
      const isFirst = i === 0;
      const isLast = i === exchangeLimit - 1;

      // Only include last 4 exchanges as context to save tokens
      const recentConvo = conversation.slice(-4).map(c => `${c.speaker}: ${c.text}`).join("\n");

      let instruction: string;
      if (isFirst) {
        instruction = `You are Alex, a knowledgeable and enthusiastic podcast host. Start the podcast by warmly introducing the topic from the study material below. Set the scene, explain why this topic matters, and give a preview of what you'll cover. Speak in 3-5 detailed sentences. Be engaging, natural, and conversational.`;
      } else if (isLast) {
        if (needsUpgradeCTA) {
          instruction = `You are ${speaker}. Give a brief but meaningful summary of what was discussed, then end by saying exactly: "Want the full deep dive? Upgrade to Testio Premium for complete, uncut podcasts!" Speak in 3-4 sentences.`;
        } else {
          instruction = `You are ${speaker}. Give a thoughtful, comprehensive conclusion summarizing the key takeaways from this entire conversation. Mention the most important insights and leave the listener with something actionable. Speak in 3-5 sentences.`;
        }
      } else if (speaker === "Sam") {
        instruction = `You are Sam, a curious and deeply engaged learner. React substantively to what Alex just said — show that you understood it, then ask a thoughtful follow-up question that digs deeper into the study material. Add your own perspective or relate it to a real-world example. Speak in 3-5 detailed sentences. Be natural and conversational.`;
      } else {
        instruction = `You are Alex, a knowledgeable expert and engaging teacher. Answer Sam's question thoroughly and clearly using the study material. Provide examples, analogies, or interesting details to make the explanation memorable. Speak in 3-5 detailed sentences. Be natural and conversational.`;
      }

      const systemContent = `${instruction}\n\nIMPORTANT: You MUST speak in at least 3 full sentences with real substance. Never give one-liners.\n\nStudy material:\n${materialContext}${recentConvo ? `\n\nRecent conversation:\n${recentConvo}` : ""}`;

      const { transcript, audioData } = await callAudioAPI(OPENAI_API_KEY, systemContent, voice);

      if (transcript) {
        conversation.push({ speaker, text: transcript });
      }
      if (audioData) {
        audioChunks.push(audioData);
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
