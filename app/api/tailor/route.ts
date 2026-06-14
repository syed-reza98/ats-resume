import { NextResponse } from 'next/server';
import https from 'node:https';
import http from 'node:http';

const OLLAMA_BASE_URL = process.env.OLLAMA_BASE_URL ?? "https://aim-repose-gradually.ngrok-free.dev/v1";
const OLLAMA_MODEL   = process.env.OLLAMA_MODEL    ?? "llama3.1";

// ── Raw HTTP helper ────────────────────────────────────────────────────────
// We avoid fetch/undici here because Node.js treats `Origin` as a forbidden
// header and silently drops it, causing Ollama's CORS guard to return 403.
// node:https has no such restriction.
function rawPost(
  url: string,
  body: string,
  headers: Record<string, string>,
  timeoutMs = 120_000,
): Promise<{ status: number; text: string }> {
  return new Promise((resolve, reject) => {
    const parsed   = new URL(url);
    const isHttps  = parsed.protocol === "https:";
    const lib      = isHttps ? https : http;
    const port     = parsed.port ? Number(parsed.port) : (isHttps ? 443 : 80);

    const req = lib.request(
      {
        hostname: parsed.hostname,
        port,
        path: parsed.pathname + parsed.search,
        method: "POST",
        headers: { ...headers, "Content-Length": Buffer.byteLength(body) },
        timeout: timeoutMs,
      },
      (res) => {
        let text = "";
        res.on("data", (chunk: Buffer) => { text += chunk.toString(); });
        res.on("end", () => resolve({ status: res.statusCode ?? 0, text }));
      },
    );

    req.on("timeout", () => { req.destroy(new Error("Request timed out after " + timeoutMs + "ms")); });
    req.on("error", reject);
    req.write(body);
    req.end();
  });
}

// ── Route handler ──────────────────────────────────────────────────────────
export async function POST(request: Request) {
  try {
    const { jobDescription, masterResume } = await request.json();

    if (!jobDescription || !masterResume) {
      return NextResponse.json(
        { error: "Missing jobDescription or masterResume in request body" },
        { status: 400 },
      );
    }

    const systemPrompt = `
      You are an expert ATS (Applicant Tracking System) optimizer and executive recruiter.
      I will provide a Job Description and a candidate's Master Resume in JSON format.

      Your goal is to:
      1. Determine the exact Job Title from the description.
      2. Rewrite the candidate's 'summary' (max 4 sentences) to heavily align with the core needs of the job without hallucinating skills they don't have.
      3. Select the most relevant experience bullet points and projects by their exact 'id'.
      Aim for about 3-5 bullets per recent job, and 2-3 highly relevant projects.

      CRITICAL: Return ONLY valid JSON with this exact schema — no markdown, no prose, no code fences:
      {
        "targetTitle": "string",
        "tailoredSummary": "string",
        "activeExperienceBulletIds": ["string"],
        "activeProjectIds": ["string"]
      }
    `;

    const payload = JSON.stringify({
      model: OLLAMA_MODEL,
      messages: [
        { role: "system", content: systemPrompt },
        {
          role: "user",
          content: `Job Description:\n${jobDescription}\n\nMaster Resume JSON:\n${JSON.stringify(masterResume)}`,
        },
      ],
      response_format: { type: "json_object" },
      stream: false,
    });

    const { status, text } = await rawPost(
      `${OLLAMA_BASE_URL}/chat/completions`,
      payload,
      {
        "Content-Type":              "application/json",
        "Authorization":             "Bearer ollama",
        // Tell Ollama this request comes from a trusted local origin.
        "Origin":                    "http://localhost",
        // Skip ngrok's browser-interstitial page for programmatic clients.
        "ngrok-skip-browser-warning": "true",
      },
    );

    if (status === 403) {
      throw new Error("403: Ollama rejected the request. Set OLLAMA_ORIGINS=* in your Kaggle notebook and restart Ollama, then try again.");
    }
    if (status >= 400) {
      throw new Error(`Upstream error ${status}: ${text.slice(0, 200)}`);
    }

    const ollamaResponse = JSON.parse(text);
    const raw            = ollamaResponse?.choices?.[0]?.message?.content ?? "{}";
    const aiSuggestion   = JSON.parse(raw);

    return NextResponse.json(aiSuggestion);

  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI Tailoring Error:", message);

    const is403     = message.includes("403");
    const isConn    = message.includes("ECONNREFUSED") || message.includes("ENOTFOUND") || message.includes("fetch failed");
    const isTimeout = message.includes("timed out") || message.includes("timeout");

    const hint = is403
      ? "Ollama rejected the request with 403. In your Kaggle notebook, restart Ollama with: OLLAMA_ORIGINS='*' ollama serve &"
      : isConn
      ? "Cannot reach the Ollama server. Is your Kaggle notebook running and is the ngrok URL current?"
      : isTimeout
      ? "The model took too long. Try a smaller model or shorten the prompt."
      : message;

    return NextResponse.json(
      { error: "Failed to generate resume", detail: message, hint },
      { status: 500 },
    );
  }
}
