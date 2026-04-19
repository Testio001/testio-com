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
    // maxExchanges is the CAP per plan (not a target). We compute the actual
    // target based on document length so small docs get short podcasts.
    const exchangeCap = Math.min(Math.max(maxExchanges || 24, 4), 30);
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);

    // Use notes only if not corrupted
    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map((n: any) => n.content).filter((c: string) => !isCorruptedNotes(c)).join("\n\n");
    const sourceContent = (noteContent && noteContent.length > 0) ? noteContent : content;

    if (!sourceContent.trim()) throw new Error("No content available to generate podcast. Generate notes first.");

    // Length-based target: ~600 chars of source per exchange, min 4, capped by plan
    const naturalTarget = Math.max(4, Math.floor(sourceContent.length / 600));
    const exchangeLimit = Math.min(exchangeCap, naturalTarget);
    console.log(`Podcast: source=${sourceContent.length} chars, naturalTarget=${naturalTarget}, cap=${exchangeCap}, using=${exchangeLimit}`);

    const needsUpgradeCTA = exchangeCap < 24; // Free + Basic only
    const conversation: Array<{ speaker: string; text: string }> = [];
    const audioChunks: Uint8Array[] = [];
    const materialContext = sourceContent.substring(0, 8000);

    // We always reserve the LAST exchange for a proper sign-off ("pleasantries" close).
    // Total = (exchangeLimit - 1) substantive exchanges + 1 outro.
    const substantiveCount = Math.max(2, exchangeLimit - 1);
    const totalExchanges = substantiveCount + 1; // +1 for outro

    for (let i = 0; i < totalExchanges; i++) {
      const isOutro = i === totalExchanges - 1;
      // Outro is always spoken by Alex (host) for a clean, consistent close.
      const speaker = isOutro ? "Alex" : (i % 2 === 0 ? "Alex" : "Sam");
      const voice = speaker === "Alex" ? "onyx" : "nova";
      const isFirst = i === 0;

      // Include FULL conversation so far so the next speaker waits for the previous to finish
      // and explicitly references what was just said. Prevents "talking over" / overlap.
      const fullConvo = conversation.map(c => `${c.speaker}: ${c.text}`).join("\n");
      const lastLine = conversation.length > 0 ? conversation[conversation.length - 1] : null;

      let instruction: string;
      if (isFirst) {
        instruction = `You are Alex, the host of a friendly study podcast. Open warmly: greet the listener, introduce yourself AND your co-host Sam by name, then introduce the topic from the study material. Preview what you'll cover. Speak in 3-5 detailed sentences. End with a natural handoff like "Sam, what's your take?" so Sam knows it's their turn.`;
      } else if (isOutro) {
        // Last 5+ seconds = pleasantries / proper sign-off (NOT new content).
        if (needsUpgradeCTA) {
          instruction = `You are Alex, wrapping up the podcast. This is the OUTRO — do NOT introduce new ideas. Briefly thank Sam and the listener for joining, give a one-sentence recap, then say exactly: "Want the full deep dive? Upgrade to Testio Premium for complete, uncut podcasts!" End with: "Thanks for listening — until next time, keep studying smart!" Speak in 4-5 sentences total.`;
        } else {
          instruction = `You are Alex, wrapping up the podcast. This is the OUTRO — do NOT introduce new ideas or new topics. Briefly thank Sam for the great discussion, thank the listener for joining, give a one-sentence recap of the single biggest takeaway, then sign off warmly with something like: "That's it for today — thanks for listening, keep studying smart, and we'll catch you in the next one!" Speak in 4-5 sentences. Make the ending feel like a real podcast close (pleasantries, not new content).`;
        }
      } else if (speaker === "Sam") {
        instruction = `You are Sam, Alex's co-host and a curious learner. WAIT for Alex to finish — Alex JUST said: "${lastLine?.text || ''}". Start by briefly acknowledging or reacting to Alex's exact point (e.g. "That's a great point about X..." or "So if I'm understanding correctly..."), then ask a thoughtful follow-up question that digs deeper into the study material. Speak in 3-5 detailed sentences. Do NOT repeat what Alex just said verbatim. End with a clear question so Alex knows it's their turn.`;
      } else {
        instruction = `You are Alex, the host and expert. WAIT for Sam to finish — Sam JUST asked: "${lastLine?.text || ''}". Directly answer Sam's question using the study material. Provide examples or analogies. Speak in 3-5 detailed sentences. End naturally — either by inviting Sam's reaction ("Does that make sense, Sam?") or pivoting to the next sub-topic.`;
      }

      const systemContent = `${instruction}\n\nCRITICAL RULES:\n- You MUST speak in at least 3 full sentences with real substance.\n- You MUST NOT start mid-sentence or talk over the previous speaker — they have completely finished.\n- Do NOT use stage directions like [pause] or *laughs*.\n- Speak ONLY your own lines — do not voice the other person.\n\nStudy material:\n${materialContext}${fullConvo ? `\n\nFull conversation so far (the other speaker has FINISHED their last line):\n${fullConvo}` : ""}`;

      const { transcript, audioData } = await callAudioAPI(OPENAI_API_KEY, systemContent, voice);

      // Only commit BOTH transcript and audio together — keeps script perfectly in sync with audio
      // and prevents "speaker cut off mid-sentence" skipping when one part is missing.
      // Require minimum audio size (~5KB) to skip near-empty MP3 chunks that cause glitches.
      if (transcript && transcript.trim().length >= 10 && audioData && audioData.length > 5000) {
        conversation.push({ speaker, text: transcript.trim() });
        audioChunks.push(audioData);
      } else {
        console.warn(`Skipping exchange ${i} (speaker=${speaker}, isOutro=${isOutro}): transcript=${transcript?.length || 0} chars, audio=${audioData?.length || 0} bytes`);
        // If outro failed, retry once with a simpler prompt so the podcast always has a proper close.
        if (isOutro) {
          const fallbackOutro = `You are Alex. Say exactly this as a warm podcast sign-off, in your own natural voice: "Thanks so much for studying with us today, Sam — and thank you for listening. Keep up the great work, and we'll catch you on the next one. Bye for now!"`;
          const retry = await callAudioAPI(OPENAI_API_KEY, fallbackOutro, "onyx");
          if (retry.audioData && retry.audioData.length > 5000) {
            conversation.push({ speaker: "Alex", text: retry.transcript.trim() });
            audioChunks.push(retry.audioData);
          }
        }
      }
    }

    if (audioChunks.length === 0) throw new Error("Failed to generate podcast audio. Please try again.");

    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) { combinedAudio.set(chunk, offset); offset += chunk.length; }

    // Upload to PUBLIC podcasts bucket so the audio URL is stable and supports byte-range
    // requests (required for native browser seeking without restart).
    const fileName = `${doc.user_id}/podcast_${documentId}_${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage.from("podcasts").upload(fileName, combinedAudio.buffer, {
      contentType: "audio/mpeg",
      upsert: true,
      cacheControl: "3600",
    });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from("podcasts").getPublicUrl(fileName);
    const audioUrl = urlData?.publicUrl || "";
    if (!audioUrl) throw new Error("Failed to get public URL for podcast");

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
