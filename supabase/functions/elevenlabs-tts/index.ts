// ElevenLabs Text-to-Speech edge function
// Returns base64 mp3 audio for a given text + voiceId
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";
import { encode as base64Encode } from "https://deno.land/std@0.168.0/encoding/base64.ts";

const DEFAULT_VOICE_ID = "JBFqnCBsd6RMkjVDRZzb"; // George — calm, clear interviewer tone

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") {
    return new Response("ok", { headers: corsHeaders });
  }

  try {
    const apiKey = Deno.env.get("ELEVENLABS_API_KEY");
    if (!apiKey) {
      return new Response(JSON.stringify({ error: "ELEVENLABS_API_KEY is not configured" }), {
        status: 500,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json().catch(() => ({}));
    const text: string = (body?.text ?? "").toString().trim();
    const voiceId: string = (body?.voiceId ?? DEFAULT_VOICE_ID).toString();

    if (!text) {
      return new Response(JSON.stringify({ error: "Missing 'text'" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }
    if (text.length > 5000) {
      return new Response(JSON.stringify({ error: "Text too long (max 5000 chars)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Strip markdown to avoid the model reading "*", "#", code fences, etc.
    const clean = text
      .replace(/```[\s\S]*?```/g, " (code block omitted) ")
      .replace(/`([^`]+)`/g, "$1")
      .replace(/[*_#>~`]/g, "")
      .replace(/\[([^\]]+)\]\([^)]+\)/g, "$1")
      .replace(/\s+/g, " ")
      .trim();

    const ttsResp = await fetch(
      `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}?output_format=mp3_44100_128`,
      {
        method: "POST",
        headers: {
          "xi-api-key": apiKey,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          text: clean,
          model_id: "eleven_turbo_v2_5",
          voice_settings: {
            stability: 0.5,
            similarity_boost: 0.75,
            style: 0.3,
            use_speaker_boost: true,
            speed: 1.0,
          },
        }),
      },
    );

    if (!ttsResp.ok) {
      const errText = await ttsResp.text();
      return new Response(
        JSON.stringify({ error: `ElevenLabs TTS failed: ${ttsResp.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const audioBuffer = await ttsResp.arrayBuffer();
    const audioContent = base64Encode(new Uint8Array(audioBuffer));

    return new Response(JSON.stringify({ audioContent, mimeType: "audio/mpeg" }), {
      status: 200,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  } catch (e) {
    const msg = e instanceof Error ? e.message : "Unknown error";
    return new Response(JSON.stringify({ error: msg }), {
      status: 500,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
});
