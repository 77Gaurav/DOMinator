// ElevenLabs Speech-to-Text edge function
// Accepts JSON { audio: base64, mimeType?: string } and returns { text }
import { corsHeaders } from "https://esm.sh/@supabase/supabase-js@2.95.0/cors";

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
    const audioB64: string = (body?.audio ?? "").toString();
    const mimeType: string = (body?.mimeType ?? "audio/webm").toString();

    if (!audioB64) {
      return new Response(JSON.stringify({ error: "Missing 'audio' (base64)" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Decode base64 → bytes
    const binary = atob(audioB64);
    const bytes = new Uint8Array(binary.length);
    for (let i = 0; i < binary.length; i++) bytes[i] = binary.charCodeAt(i);

    const ext = mimeType.includes("mp4") ? "mp4"
      : mimeType.includes("ogg") ? "ogg"
      : mimeType.includes("wav") ? "wav"
      : "webm";

    const fd = new FormData();
    fd.append("file", new Blob([bytes], { type: mimeType }), `recording.${ext}`);
    fd.append("model_id", "scribe_v1");
    fd.append("tag_audio_events", "false");
    fd.append("diarize", "false");

    const sttResp = await fetch("https://api.elevenlabs.io/v1/speech-to-text", {
      method: "POST",
      headers: { "xi-api-key": apiKey },
      body: fd,
    });

    if (!sttResp.ok) {
      const errText = await sttResp.text();
      return new Response(
        JSON.stringify({ error: `ElevenLabs STT failed: ${sttResp.status}`, details: errText }),
        { status: 502, headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    const data = await sttResp.json();
    const text: string = (data?.text ?? "").toString().trim();

    return new Response(JSON.stringify({ text }), {
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
