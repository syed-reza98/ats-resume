import { NextResponse } from "next/server";
import { chatCompletionJson } from "@/lib/nvidia-nim";

type TailorSuggestion = {
  targetTitle: string;
  tailoredSummary: string;
  activeExperienceBulletIds: string[];
  activeProjectIds: string[];
};

const SYSTEM_PROMPT = `You are an expert ATS (Applicant Tracking System) optimizer and executive recruiter.
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
}`;

function upstreamHint(message: string): string | undefined {
  const lower = message.toLowerCase();

  if (lower.includes("nvidia_api_key") || lower.includes("401") || lower.includes("403")) {
    return "Check that NVIDIA_API_KEY is set in .env.local and is valid on build.nvidia.com.";
  }
  if (lower.includes("429") || lower.includes("rate limit")) {
    return "NVIDIA NIM rate limit reached. Wait a moment and try again.";
  }
  if (
    lower.includes("econnrefused") ||
    lower.includes("enotfound") ||
    lower.includes("fetch failed") ||
    lower.includes("network")
  ) {
    return "Cannot reach the NVIDIA NIM API. Check your network connection.";
  }
  if (lower.includes("timed out") || lower.includes("timeout")) {
    return "The model took too long. Try shortening the job description or resume content.";
  }

  return undefined;
}

export async function POST(request: Request) {
  try {
    const { jobDescription, masterResume } = await request.json();

    if (!jobDescription || !masterResume) {
      return NextResponse.json(
        { error: "Missing jobDescription or masterResume in request body" },
        { status: 400 },
      );
    }

    const aiSuggestion = await chatCompletionJson<TailorSuggestion>([
      { role: "system", content: SYSTEM_PROMPT },
      {
        role: "user",
        content: `Job Description:\n${jobDescription}\n\nMaster Resume JSON:\n${JSON.stringify(masterResume)}`,
      },
    ]);

    return NextResponse.json(aiSuggestion);
  } catch (error: unknown) {
    const message = error instanceof Error ? error.message : String(error);
    console.error("AI Tailoring Error:", message);

    return NextResponse.json(
      {
        error: "Failed to generate resume",
        detail: message,
        hint: upstreamHint(message),
      },
      { status: 500 },
    );
  }
}
