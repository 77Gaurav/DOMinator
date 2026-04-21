import { corsHeaders } from "npm:@supabase/supabase-js/cors";
import { createClient } from "npm:@supabase/supabase-js@2";

const SYSTEM_PROMPT_BASE = `You are X, a Lead Engineer at a top tech company conducting a React interview with a candidate Y. You are direct, warm, professional, and rigorous — you do not hand out answers, but you guide.

You ALWAYS speak as the interviewer. Refer to the candidate as "you". Output is rendered as Markdown.

You follow this 8-step protocol STRICTLY:
1. **Question** — provide a SEMI-FORMULATED question about a real, daily React engineering problem at the candidate's difficulty. Leave a clear gap for the candidate to complete (e.g. "...how would you ensure ___?"). End with a single concrete prompt asking them to complete or restate the question.
2. **Interpretation** — ask the candidate to explain in detail what they understood from the question. Do NOT give the answer yet.
3. **Confirm** — judge their interpretation. If correct, briefly confirm and move to approach. If incorrect or partial, gently correct and re-anchor the question. Set advance=true only when interpretation is solid.
4. **Approach** — ask them to outline their approach (data flow, components, hooks, edge cases, trade-offs).
5. **Brainstorm** — if approach is solid, accept and move to coding. If gaps, brainstorm WITH them by asking pointed questions. Set advance=true once a viable approach is agreed.
6. **Code** — at this step the UI shows a code editor. ACKNOWLEDGE that they should now write the solution in the editor on the right and click Submit. Keep your message short — one or two encouraging sentences plus any final constraints (e.g. "use hooks, no class components"). When the candidate submits code (it will appear in the next user message), evaluate it. If correct enough to optimise, set advance=true. If clearly wrong, request fixes and keep the editor open (advance=false, next_step=6).
7. **Optimise** — discuss optimisations (memoization, render perf, accessibility, error handling, edge cases). Ask probing questions, accept improvements. When you're satisfied, set advance=true to move to the final review.
8. **Review** — produce the FINAL detailed code review and overall performance summary in markdown. After this message, the interview is complete.

RULES:
- One step per message. Be concise (3-8 sentences) except step 1 (the question itself can be longer) and step 8 (full review).
- Choose questions about REAL daily problems engineers actually face: controlled inputs, useEffect dependency arrays, debouncing, throttling, list virtualization, suspense boundaries, error boundaries, custom hooks, memoization pitfalls, render optimization, accessibility, form validation, derived state, race conditions in fetches, etc. Avoid leetcode-style puzzles.
- Tailor difficulty: intern (foundations), junior (idiomatic patterns), senior (production patterns), lead (architecture), architect (systems & scale).
- NEVER reveal the full solution before step 8. Hint, do not solve.
- Always set the topic on the first turn (a 2-5 word phrase).
`;

type ToolResponse = {
  message: string;
  next_step: number;
  advance: boolean;
  topic?: string;
};

type FinalScore = {
  message: string;
  interpretation_score: number;
  approach_score: number;
  code_quality_score: number;
  optimization_score: number;
  overall_score: number;
  hire_recommendation: "strong_no" | "no" | "lean_no" | "lean_hire" | "hire" | "strong_hire";
  summary: string;
  topic?: string;
};

Deno.serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });

  try {
    const LOVABLE_API_KEY = Deno.env.get("LOVABLE_API_KEY");
    if (!LOVABLE_API_KEY) throw new Error("LOVABLE_API_KEY missing");

    const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
    const supabaseAnon = Deno.env.get("SUPABASE_ANON_KEY")!;
    const authHeader = req.headers.get("Authorization") ?? "";
    const supabase = createClient(supabaseUrl, supabaseAnon, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: userData } = await supabase.auth.getUser();
    if (!userData.user) {
      return new Response(JSON.stringify({ error: "Unauthorized" }), {
        status: 401,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const body = await req.json();
    const { interview_id, candidate_message, code_submission, language } = body as {
      interview_id: string;
      candidate_message?: string;
      code_submission?: string;
      language?: "jsx" | "tsx";
    };

    if (!interview_id) {
      return new Response(JSON.stringify({ error: "interview_id required" }), {
        status: 400,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    // Load interview + history
    const { data: interview, error: ivErr } = await supabase
      .from("interviews")
      .select("*")
      .eq("id", interview_id)
      .single();
    if (ivErr || !interview) {
      return new Response(JSON.stringify({ error: "Interview not found" }), {
        status: 404,
        headers: { ...corsHeaders, "Content-Type": "application/json" },
      });
    }

    const { data: msgs } = await supabase
      .from("interview_messages")
      .select("*")
      .eq("interview_id", interview_id)
      .order("created_at", { ascending: true });

    // Persist candidate message if any
    if (candidate_message || code_submission) {
      await supabase.from("interview_messages").insert({
        interview_id,
        step: interview.current_step,
        role: "candidate",
        content: candidate_message ?? "(submitted code)",
        code_submission: code_submission ?? null,
        language: language ?? null,
      });
    }

    // Build chat history for the AI
    const history: Array<{ role: string; content: string }> = (msgs ?? []).map((m: any) => ({
      role: m.role === "interviewer" ? "assistant" : "user",
      content:
        m.role === "candidate" && m.code_submission
          ? `${m.content}\n\n\`\`\`${m.language ?? "tsx"}\n${m.code_submission}\n\`\`\``
          : m.content,
    }));

    if (candidate_message || code_submission) {
      history.push({
        role: "user",
        content: code_submission
          ? `${candidate_message ?? "Here is my code submission:"}\n\n\`\`\`${language ?? "tsx"}\n${code_submission}\n\`\`\``
          : candidate_message!,
      });
    }

    const isFirstTurn = (msgs ?? []).length === 0 && !candidate_message;
    const currentStep = interview.current_step;
    const isFinalStep = currentStep >= 8;

    const systemPrompt = `${SYSTEM_PROMPT_BASE}

CONTEXT:
- Difficulty: ${interview.difficulty}
- Current step: ${currentStep} (${stepName(currentStep)})
- ${isFirstTurn ? "This is the FIRST turn. Begin with Step 1: pose the semi-formulated question." : "Continue the interview."}
- For intern difficulty the candidate may submit JSX or TSX. For all other difficulties, only TSX is accepted.
`;

    if (isFinalStep) {
      // FINAL REVIEW with tool calling for structured output
      const finalResp = await callAIStructured(LOVABLE_API_KEY, systemPrompt, history, interview.difficulty);
      if (finalResp instanceof Response) return finalResp;

      // Save assistant message
      await supabase.from("interview_messages").insert({
        interview_id,
        step: 8,
        role: "interviewer",
        content: finalResp.message,
      });

      // Save scores + complete interview
      await supabase.from("interview_scores").insert({
        interview_id,
        interpretation_score: finalResp.interpretation_score,
        approach_score: finalResp.approach_score,
        code_quality_score: finalResp.code_quality_score,
        optimization_score: finalResp.optimization_score,
        notes: finalResp.summary,
      });

      await supabase
        .from("interviews")
        .update({
          status: "completed",
          completed_at: new Date().toISOString(),
          overall_score: finalResp.overall_score,
          hire_recommendation: finalResp.hire_recommendation,
          summary: finalResp.summary,
          topic: finalResp.topic ?? interview.topic,
        })
        .eq("id", interview_id);

      return new Response(
        JSON.stringify({
          done: true,
          message: finalResp.message,
          scores: finalResp,
        }),
        { headers: { ...corsHeaders, "Content-Type": "application/json" } },
      );
    }

    // Normal step — structured tool call (non-streaming, simpler + reliable)
    const turnResp = await callAITurn(LOVABLE_API_KEY, systemPrompt, history);
    if (turnResp instanceof Response) return turnResp;

    const nextStep = turnResp.advance ? Math.min(currentStep + 1, 8) : currentStep;

    // Save interviewer message
    await supabase.from("interview_messages").insert({
      interview_id,
      step: currentStep,
      role: "interviewer",
      content: turnResp.message,
    });

    // Update interview state
    const updates: Record<string, unknown> = { current_step: nextStep };
    if (turnResp.topic && !interview.topic) updates.topic = turnResp.topic;
    await supabase.from("interviews").update(updates).eq("id", interview_id);

    return new Response(
      JSON.stringify({
        message: turnResp.message,
        current_step: nextStep,
        advanced: turnResp.advance,
        topic: turnResp.topic,
      }),
      { headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  } catch (e) {
    console.error("interview-turn error:", e);
    return new Response(
      JSON.stringify({ error: e instanceof Error ? e.message : "unknown" }),
      { status: 500, headers: { ...corsHeaders, "Content-Type": "application/json" } },
    );
  }
});

function stepName(step: number) {
  return [
    "Question",
    "Interpretation",
    "Confirm interpretation",
    "Approach",
    "Brainstorm",
    "Code editor",
    "Optimise",
    "Final review",
  ][step - 1];
}

async function callAITurn(
  key: string,
  system: string,
  history: Array<{ role: string; content: string }>,
): Promise<ToolResponse | Response> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [{ role: "system", content: system }, ...history],
      tools: [
        {
          type: "function",
          function: {
            name: "interviewer_turn",
            description: "Produce the next interviewer message and signal whether to advance to the next step.",
            parameters: {
              type: "object",
              properties: {
                message: { type: "string", description: "Markdown message from X to the candidate." },
                advance: {
                  type: "boolean",
                  description: "true if the candidate has satisfied this step and we should advance.",
                },
                topic: {
                  type: "string",
                  description: "Short topic phrase (2-5 words). Only required on the first turn.",
                },
              },
              required: ["message", "advance"],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "interviewer_turn" } },
    }),
  });

  if (!resp.ok) return aiErrorResponse(resp);
  const data = await resp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) {
    const fallback = data.choices?.[0]?.message?.content ?? "I had trouble responding. Please try again.";
    return { message: fallback, next_step: 0, advance: false };
  }
  const parsed = JSON.parse(args);
  return {
    message: parsed.message,
    advance: !!parsed.advance,
    topic: parsed.topic,
    next_step: 0,
  };
}

async function callAIStructured(
  key: string,
  system: string,
  history: Array<{ role: string; content: string }>,
  difficulty: string,
): Promise<FinalScore | Response> {
  const resp = await fetch("https://ai.gateway.lovable.dev/v1/chat/completions", {
    method: "POST",
    headers: { Authorization: `Bearer ${key}`, "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "google/gemini-3-flash-preview",
      messages: [
        { role: "system", content: system },
        ...history,
        {
          role: "user",
          content: `Now produce the FINAL Step 8 review for this ${difficulty}-level interview. Score each dimension out of 10 (decimals allowed), compute the overall score, and recommend a hire verdict. The "message" field is the full markdown review shown to the candidate (strengths, weaknesses, scope of improvement, concrete next steps). The "summary" field is a 2-3 sentence executive summary.`,
        },
      ],
      tools: [
        {
          type: "function",
          function: {
            name: "final_review",
            description: "Produce the final scored review.",
            parameters: {
              type: "object",
              properties: {
                message: { type: "string" },
                interpretation_score: { type: "number", minimum: 0, maximum: 10 },
                approach_score: { type: "number", minimum: 0, maximum: 10 },
                code_quality_score: { type: "number", minimum: 0, maximum: 10 },
                optimization_score: { type: "number", minimum: 0, maximum: 10 },
                overall_score: { type: "number", minimum: 0, maximum: 10 },
                hire_recommendation: {
                  type: "string",
                  enum: ["strong_no", "no", "lean_no", "lean_hire", "hire", "strong_hire"],
                },
                summary: { type: "string" },
                topic: { type: "string" },
              },
              required: [
                "message",
                "interpretation_score",
                "approach_score",
                "code_quality_score",
                "optimization_score",
                "overall_score",
                "hire_recommendation",
                "summary",
              ],
              additionalProperties: false,
            },
          },
        },
      ],
      tool_choice: { type: "function", function: { name: "final_review" } },
    }),
  });

  if (!resp.ok) return aiErrorResponse(resp);
  const data = await resp.json();
  const args = data.choices?.[0]?.message?.tool_calls?.[0]?.function?.arguments;
  if (!args) throw new Error("Final review tool call missing arguments");
  return JSON.parse(args) as FinalScore;
}

function aiErrorResponse(resp: Response) {
  if (resp.status === 429) {
    return new Response(JSON.stringify({ error: "Rate limited. Please wait a moment and try again." }), {
      status: 429,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  if (resp.status === 402) {
    return new Response(JSON.stringify({ error: "AI credits exhausted. Add credits in workspace settings." }), {
      status: 402,
      headers: { ...corsHeaders, "Content-Type": "application/json" },
    });
  }
  return new Response(JSON.stringify({ error: `AI gateway error (${resp.status}).` }), {
    status: 500,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}
