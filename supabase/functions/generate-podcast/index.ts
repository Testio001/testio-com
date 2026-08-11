import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { getValidatedContent, isCorruptedNotes } from "../_shared/extract-content.ts";
import { getAuthedUserId } from "../_shared/auth.ts";

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
            { role: "user", content: "Generate your next line in the podcast conversation. Speak naturally and expressively, grounded in the study material. Bring real emotion — curiosity, excitement, surprise, warmth, the occasional light laugh — like two real friends learning together. Vary sentence length. Do NOT be robotic or overly brief." },
          ],
          max_tokens: 1200,
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
    const callerId = await getAuthedUserId(req);
    if (!callerId) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }
    const { documentId, maxExchanges } = await req.json();
    // maxExchanges is the CAP per plan (not a target). We compute the actual
    // target based on document length so small docs get short podcasts.
    const exchangeCap = Math.min(Math.max(maxExchanges || 24, 4), 30);
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(Deno.env.get("SUPABASE_URL")!, Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!);

    const { doc, content } = await getValidatedContent(supabase, documentId, OPENAI_API_KEY);
    if (doc.user_id !== callerId) {
      return new Response(JSON.stringify({ error: "Forbidden" }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

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

    // Plan gate: Starter plan does NOT include podcasts
    const { data: prof } = await supabase
      .from("profiles")
      .select("subscription_plan, subscription_expires_at")
      .eq("user_id", doc.user_id)
      .maybeSingle();
    const planActive = prof?.subscription_expires_at && new Date(prof.subscription_expires_at) > new Date();
    const activePlan = planActive ? prof?.subscription_plan : "free";
    // Free tier: hard-capped 1-minute preview podcast (2 exchanges + spoken upgrade CTA).
    const isFreePlan = !activePlan || activePlan === "free";
    if (activePlan === "starter") {
      return new Response(JSON.stringify({
        error: "Podcasts are not included on the Starter plan. Upgrade to Basic, Pro, or Scholar to generate podcasts.",
        planBlocked: true,
      }), { status: 403, headers: { ...corsHeaders, "Content-Type": "application/json" } });
    }

    // Use notes only if not corrupted
    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map((n: any) => n.content).filter((c: string) => !isCorruptedNotes(c)).join("\n\n");
    const sourceContent = (noteContent && noteContent.length > 0) ? noteContent : content;

    if (!sourceContent.trim()) throw new Error("No content available to generate podcast. Generate notes first.");

    // Length-based target: ~600 chars of source per exchange, min 4, capped by plan
    const naturalTarget = Math.max(4, Math.floor(sourceContent.length / 600));
    const planCap = isFreePlan ? 2 : exchangeCap; // free = ~1 minute preview
    const exchangeLimit = isFreePlan ? planCap : Math.min(planCap, naturalTarget);
    console.log(`Podcast: source=${sourceContent.length} chars, naturalTarget=${naturalTarget}, cap=${planCap}, free=${isFreePlan}, using=${exchangeLimit}`);

    const needsUpgradeCTA = exchangeCap < 24; // Free + Basic only
    const conversation: Array<{ speaker: string; text: string }> = [];
    const audioChunks: Uint8Array[] = [];
    const materialContext = sourceContent.substring(0, 16000);

    // We always reserve the LAST exchange for a proper sign-off ("pleasantries" close).
    // Total = (exchangeLimit - 1) substantive exchanges + 1 outro.
    // Free: 2 short substantive lines + 1 spoken upgrade CTA (no long recap outro).
    const substantiveCount = isFreePlan ? 2 : Math.max(2, exchangeLimit - 1);
    // +1 outro (Alex recap), +1 final closing line (CTA on Free/Basic, pleasantry on Pro/Scholar)
    const totalExchanges = isFreePlan ? substantiveCount + 1 : substantiveCount + 2;

    for (let i = 0; i < totalExchanges; i++) {
      const isFinalClose = i === totalExchanges - 1;
      const isOutro = !isFreePlan && i === totalExchanges - 2;
      // Outro is always spoken by Alex (host). Final closing line is always Alex
      // delivering the Testio.online CTA.
      const speaker = isFinalClose ? "Alex" : (isOutro ? "Alex" : (i % 2 === 0 ? "Alex" : "Sam"));
      const voice = speaker === "Alex" ? "onyx" : "nova";
      const isFirst = i === 0;

      // Include FULL conversation so far so the next speaker waits for the previous to finish
      // and explicitly references what was just said. Prevents "talking over" / overlap.
      const fullConvo = conversation.map(c => `${c.speaker}: ${c.text}`).join("\n");
      const lastLine = conversation.length > 0 ? conversation[conversation.length - 1] : null;

      let instruction: string;
      if (isFirst) {
        instruction = isFreePlan
          ? `You are Alex, the warm and energetic host of a friendly study podcast. This is the VERY FIRST line of a short preview episode. Start with EXACTLY: "Welcome to Testio.online." Then, in just 1–2 more sentences, greet your co-host Sam and tease the single most important idea from the study material, ending with a quick handoff to Sam. Keep it under 25 seconds of speech.`
          : `You are Alex, the warm and energetic host of a friendly study podcast. This is the VERY FIRST line. Start with EXACTLY: "Welcome to Testio.online." Then, in 2–4 more sentences, greet your co-host Sam with genuine warmth, tease the topic from the study material, and invite Sam in with a natural handoff (e.g., "Sam, what jumped out at you?"). Sound excited and human.`;
      } else if (isFinalClose && isFreePlan) {
        instruction = `You are Alex closing a short preview episode. Say warmly and clearly, in exactly these words: "That's a preview — upgrade to a paid plan to unlock your full podcast. Head over to Testio.online to hear the whole thing." Say nothing else.`;
      } else if (isFinalClose) {
        instruction = `You are Alex. This is the VERY LAST line of the podcast. Say warmly: "If you want to create a podcast like this with your own notes, head over to Testio.online. Thanks so much for studying with us — we'll catch you next time!" Keep it to those two sentences, delivered with real warmth.`;
      } else if (isOutro) {
        instruction = `You are Alex, wrapping up the podcast. Do NOT introduce new ideas. In 3–5 sentences, warmly thank Sam, recap 2–3 of the most important takeaways from the study material that you actually discussed, and leave the listener feeling motivated. Do NOT mention Testio.online here — that's the next line.`;
      } else if (speaker === "Sam") {
        instruction = isFreePlan
          ? `You are Sam, Alex's curious, expressive co-host, in a short preview episode. Alex JUST said: "${lastLine?.text || ''}". React with real emotion and explain ONE specific concept from the study material in 2–3 sentences. Keep it under 25 seconds of speech. Stay 100% grounded in the study material below.`
          : `You are Sam, Alex's curious, expressive co-host. Alex JUST said: "${lastLine?.text || ''}". React naturally with real emotion (curiosity, an "oh wow", a soft laugh, a "wait, really?"), then dig into the study material — paraphrase a specific concept Alex raised, share a quick thought or analogy, and end by asking Alex ONE genuine follow-up question. Aim for 3–6 sentences. Stay 100% grounded in the study material below — do not invent facts.`;
      } else {
        instruction = isFreePlan
          ? `You are Alex, the host and friendly expert, in a short preview episode. Sam JUST said: "${lastLine?.text || ''}". Answer Sam in 2–3 sentences using SPECIFIC facts from the study material below. Keep it under 25 seconds of speech.`
          : `You are Alex, the host and friendly expert. Sam JUST said: "${lastLine?.text || ''}". Directly answer Sam using SPECIFIC facts, terms, or examples from the study material below. Be expressive and warm — show enthusiasm for the topic. Aim for 3–6 sentences. End naturally, either by checking in with Sam ("Does that click, Sam?") or smoothly pivoting to the next idea from the material.`;
      }

      const systemContent = `${instruction}\n\nCRITICAL RULES:\n- Ground EVERY response in the Study Material below. Use real terms, names, and concepts from it. Do NOT make up facts that aren't in the material.\n- Speak naturally with real emotion — warmth, curiosity, excitement, occasional light laughter — like two real friends teaching each other. Vary sentence length.\n- Always speak in complete sentences with proper punctuation. Never start mid-sentence, never trail off, never end mid-word. Finish your final sentence before stopping.\n- The previous speaker has COMPLETELY FINISHED. Do not interrupt, overlap, or echo their last words verbatim.\n- Hand off cleanly when you're done — ask a question or invite a reaction so the other speaker knows it's their turn.\n- Do NOT use stage directions like [pause] or *laughs* — express emotion through your actual delivery and word choice.\n- Speak ONLY your own lines — never voice the other person.\n\nStudy material (this is the ONLY source of truth for facts):\n${materialContext}${fullConvo ? `\n\nFull conversation so far (the other speaker has FINISHED their last line):\n${fullConvo}` : ""}`;

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
