import { serve } from "https://deno.land/std@0.168.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type, x-supabase-client-platform, x-supabase-client-platform-version, x-supabase-client-runtime, x-supabase-client-runtime-version",
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });

  try {
    const { documentId, maxExchanges } = await req.json();
    const exchangeLimit = maxExchanges || 20; // Default to full podcast
    const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
    if (!OPENAI_API_KEY) throw new Error("OPENAI_API_KEY not configured");

    const supabase = createClient(
      Deno.env.get("SUPABASE_URL")!,
      Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!
    );

    // Get document and notes
    const { data: doc } = await supabase.from("documents").select("*").eq("id", documentId).single();
    if (!doc) throw new Error("Document not found");

    const { data: notes } = await supabase.from("notes").select("content").eq("document_id", documentId);
    const noteContent = notes?.map((n) => n.content).join("\n\n") || doc.original_content || "";

    if (!noteContent.trim()) throw new Error("No content available to generate podcast. Generate notes first.");

    // Step 1: Generate a two-person podcast script using GPT-4o-mini
    const scriptResponse = await fetch("https://api.openai.com/v1/chat/completions", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${OPENAI_API_KEY}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        model: "gpt-4o-mini",
        messages: [
          {
            role: "system",
            content: `You are a podcast script writer. Create an engaging, educational podcast conversation between two hosts:
- Host A (Alex): The knowledgeable expert who explains concepts clearly
- Host B (Sam): The curious learner who asks great questions and makes connections

Rules:
- Write a natural, flowing conversation (NOT a lecture)
- Each speaker turn should be 1-3 sentences max
- Include about 15-20 exchanges total
- Make it educational but fun and conversational
- Start with a brief intro and end with a quick summary
- Output ONLY valid JSON array of objects with "speaker" (either "Alex" or "Sam") and "text" fields
- No markdown, no code blocks, just the raw JSON array`,
          },
          {
            role: "user",
            content: `Create a podcast script about the following study material:\n\n${noteContent.substring(0, 12000)}`,
          },
        ],
        temperature: 0.8,
      }),
    });

    if (!scriptResponse.ok) throw new Error("Failed to generate podcast script");

    const scriptData = await scriptResponse.json();
    let scriptText = scriptData.choices?.[0]?.message?.content || "";
    
    // Clean up the script text - remove markdown code blocks if present
    scriptText = scriptText.replace(/```json\s*/g, "").replace(/```\s*/g, "").trim();

    let script: Array<{ speaker: string; text: string }>;
    try {
      script = JSON.parse(scriptText);
    } catch {
      throw new Error("Failed to parse podcast script");
    }

    // Step 2: Generate audio for each segment using OpenAI TTS
    // Alex = "onyx" voice (deep, authoritative), Sam = "nova" voice (warm, curious)
    const audioChunks: Uint8Array[] = [];

    for (const segment of script) {
      const voice = segment.speaker === "Alex" ? "onyx" : "nova";

      const ttsResponse = await fetch("https://api.openai.com/v1/audio/speech", {
        method: "POST",
        headers: {
          Authorization: `Bearer ${OPENAI_API_KEY}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "tts-1",
          input: segment.text,
          voice: voice,
          response_format: "mp3",
        }),
      });

      if (!ttsResponse.ok) {
        console.error(`TTS failed for segment: ${ttsResponse.status}`);
        continue;
      }

      const audioBuffer = await ttsResponse.arrayBuffer();
      audioChunks.push(new Uint8Array(audioBuffer));
    }

    // Combine all audio chunks into one buffer
    const totalLength = audioChunks.reduce((sum, chunk) => sum + chunk.length, 0);
    const combinedAudio = new Uint8Array(totalLength);
    let offset = 0;
    for (const chunk of audioChunks) {
      combinedAudio.set(chunk, offset);
      offset += chunk.length;
    }

    // Upload to Supabase storage
    const fileName = `${doc.user_id}/podcast_${documentId}_${Date.now()}.mp3`;
    const { error: uploadError } = await supabase.storage
      .from("documents")
      .upload(fileName, combinedAudio.buffer, {
        contentType: "audio/mpeg",
        upsert: true,
      });

    if (uploadError) throw new Error(`Upload failed: ${uploadError.message}`);

    const { data: urlData } = supabase.storage.from("documents").getPublicUrl(fileName);

    // Create a signed URL since bucket is private
    const { data: signedUrlData } = await supabase.storage
      .from("documents")
      .createSignedUrl(fileName, 60 * 60 * 24 * 7); // 7 days

    const audioUrl = signedUrlData?.signedUrl || urlData?.publicUrl || "";

    // Save podcast record
    const { error: insertError } = await supabase.from("podcasts").insert({
      document_id: documentId,
      user_id: doc.user_id,
      title: `Podcast: ${doc.title}`,
      script: JSON.stringify(script),
      audio_url: audioUrl,
      status: "completed",
    });

    if (insertError) throw new Error(`Save failed: ${insertError.message}`);

    return new Response(
      JSON.stringify({ success: true, audioUrl, script }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  } catch (e) {
    console.error("Podcast error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "Unknown error" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } }
    );
  }
});
