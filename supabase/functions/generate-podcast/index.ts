import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidatedContent, isCorruptedNotes } from "../_shared/extract-content.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

// ~200ms of silent MP3 (mono, 24kHz, 32kbps) used as a natural pause between
// speaker turns so the next voice doesn't start before the previous one ends.
const SILENCE_MP3_BASE64 = "SUQzBAAAAAAAIlRTU0UAAAAOAAADTGF2ZjYyLjMuMTAwAAAAAAAAAAAAAAD/84TAAAAAAAAAAAAASW5mbwAAAA8AAAALAAAE4AA7Ozs7Ozs7OztOTk5OTk5OTk5iYmJiYmJiYmJ2dnZ2dnZ2dnaJiYmJiYmJiYmdnZ2dnZ2dnZ2xsbGxsbGxsbHExMTExMTExMTY2NjY2NjY2Njs7Ozs7Ozs7Oz///////////8AAAAATGF2YzYyLjExAAAAAAAAAAAAAAAAJAPAAAAAAAAABOAnh21GAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAD/80TEAAAAA0gAAAAATEFNRTMuMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEUwAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TEpgAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVMQU1FMy7/80TErAAAA0gAAAAAMTAwVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVX/80TErAAAA0gAAAAAVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVVU=";
const SILENCE_MP3: Uint8Array = (() => {
  const bin = atob(SILENCE_MP3_BASE64);
  const out = new Uint8Array(bin.length);
  for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
  return out;
})();

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

    // Rate limit check (per-user, per-function)
    const { data: rl } = await supabase.rpc("check_ai_rate_limit", {
      _user_id: doc.user_id, _function_name: "generate-podcast",
    });
    if (rl && rl.allowed === false) {
      return new Response(JSON.stringify({
        error: rl.reason === "hourly_limit"
          ? `Hourly limit reached (${rl.limit}/hr on ${rl.plan} plan). Try again in an hour.`
          : `Daily limit reached (${rl.limit}/day on ${rl.plan} plan). Try again tomorrow or upgrade.`,
        rateLimited: true, ...rl,
      }), { status: 429, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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
    // +1 outro (Alex recap), +1 final closing line (CTA on Free/Basic, pleasantry on Pro/Scholar)
    const totalExchanges = substantiveCount + 2;

    for (let i = 0; i < totalExchanges; i++) {
      const isFinalClose = i === totalExchanges - 1;
      const isOutro = i === totalExchanges - 2;
      // Outro is always spoken by Alex (host). Final closing line:
      //   - Free/Basic: Alex delivers the upgrade CTA.
      //   - Pro/Scholar: Sam delivers a warm "thanks for having me" pleasantry.
      const finalSpeaker = needsUpgradeCTA ? "Alex" : "Sam";
      const speaker = isFinalClose ? finalSpeaker : (isOutro ? "Alex" : (i % 2 === 0 ? "Alex" : "Sam"));
      const voice = speaker === "Alex" ? "onyx" : "nova";
      const isFirst = i === 0;

      // Include FULL conversation so far so the next speaker waits for the previous to finish
      // and explicitly references what was just said. Prevents "talking over" / overlap.
      const fullConvo = conversation.map(c => `${c.speaker}: ${c.text}`).join("\n");
      const lastLine = conversation.length > 0 ? conversation[conversation.length - 1] : null;

      let instruction: string;
      if (isFirst) {
        instruction = `You are Alex, the host of a friendly study podcast. Open warmly: greet the listener, introduce yourself AND your co-host Sam by name, then introduce the topic from the study material. Speak in 2-3 sentences MAX. End with a natural handoff like "Sam, what's your take?" so Sam knows it's their turn.`;
      } else if (isFinalClose) {
        if (needsUpgradeCTA) {
          instruction = `You are Alex. This is the VERY LAST line of the podcast. Say exactly, in your own warm voice: "That is all for now. Upgrade to Testio Premium to generate more podcast minutes." Do NOT add anything else, do NOT introduce new content. Keep it to those two sentences only.`;
        } else {
          instruction = `You are Sam, the co-host. This is the VERY LAST line of the podcast — a warm pleasantry close. Say something natural like: "Thank you so much for having me here, Alex — it was a great conversation. Thanks to everyone listening, and we'll see you next time!" Keep it to 2-3 short sentences. Do NOT introduce any new ideas or topics.`;
        }
      } else if (isOutro) {
        // Last 5+ seconds = pleasantries / proper sign-off (NOT new content).
        if (needsUpgradeCTA) {
          instruction = `You are Alex, wrapping up the podcast. This is the OUTRO — do NOT introduce new ideas. Briefly thank the listener, then say exactly: "Want the full deep dive? Upgrade to Testio Premium for complete, uncut podcasts!" Speak in 3 sentences MAX.`;
        } else {
          instruction = `You are Alex, wrapping up the podcast. This is the OUTRO — do NOT introduce new ideas or new topics. Briefly thank Sam and the listener, then sign off warmly with something like: "That's it for today — keep studying smart!" Speak in 3 sentences MAX.`;
        }
      } else if (speaker === "Sam") {
        instruction = `You are Sam, Alex's co-host and a curious learner. WAIT for Alex to finish — Alex JUST said: "${lastLine?.text || ''}". Briefly acknowledge Alex's point, then ask ONE thoughtful follow-up question. Speak in 2-3 sentences MAX. Do NOT repeat what Alex just said verbatim. End with a clear question so Alex knows it's their turn.`;
      } else {
        instruction = `You are Alex, the host and expert. WAIT for Sam to finish — Sam JUST asked: "${lastLine?.text || ''}". Directly answer Sam's question using the study material with one quick example. Speak in 2-3 sentences MAX. End naturally — either by inviting Sam's reaction ("Does that make sense, Sam?") or pivoting to the next sub-topic.`;
      }

      const systemContent = `${instruction}\n\nCRITICAL RULES:\n- HARD LIMIT: Speak in a MAXIMUM of 3 sentences. NEVER exceed 3 sentences. Prefer 2-3 short, complete sentences.\n- Every sentence must end with proper punctuation (. ! or ?). Stop completely after your 3rd sentence — hand off to the other speaker.\n- You MUST start with a fresh, complete sentence. NEVER start mid-sentence, NEVER trail off, NEVER end mid-word.\n- The previous speaker has COMPLETELY FINISHED. Do not interrupt, do not overlap, do not echo their last words.\n- Speak at a natural, calm pace. Finish your final sentence completely before stopping.\n- Do NOT use stage directions like [pause] or *laughs*.\n- Speak ONLY your own lines — do not voice the other person.\n\nStudy material:\n${materialContext}${fullConvo ? `\n\nFull conversation so far (the other speaker has FINISHED their last line):\n${fullConvo}` : ""}`;

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

    // Stitch audio with a ~200ms silent MP3 between each turn so speakers don't
    // overlap and the conversation feels naturally paced.
    const pieces: Uint8Array[] = [];
    for (let k = 0; k < audioChunks.length; k++) {
      pieces.push(audioChunks[k]);
      if (k < audioChunks.length - 1) pieces.push(SILENCE_MP3);
    }
    const totalLength = pieces.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of pieces) { combinedAudio.set(chunk, offset); offset += chunk.length; }

    // Upload to PRIVATE podcasts bucket. We store only the storage path in the DB
    // and generate short-lived signed URLs at playback/download time.
    const fileName = `${doc.user_id}/podcast_${documentId}_${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage.from("podcasts").upload(fileName, combinedAudio.buffer, {
      contentType: "audio/mpeg",
      upsert: true,
      cacheControl: "3600",
    });
    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    // Store the storage path (not a URL) so we can re-sign on demand.
    const audioUrl = fileName;

    await supabase.from("podcasts").insert({
      document_id: documentId, user_id: doc.user_id, title: `Podcast: ${doc.title}`,
      script: JSON.stringify(conversation), audio_url: audioUrl, status: "completed",
    });

    await supabase.from("ai_usage_log").insert({ user_id: doc.user_id, function_name: "generate-podcast" });

    return new Response(JSON.stringify({ success: true, audioUrl, script: conversation }), { headers: { ...corsHeaders, "Content-Type": "application/json" } });
  } catch (e) {
    console.error("Podcast error:", e);
    return new Response(JSON.stringify({ error: e instanceof Error ? e.message : "Podcast generation failed. Please try again." }), { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } });
  }
});
