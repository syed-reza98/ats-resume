"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { useReactToPrint } from "react-to-print";
import { ChevronDown, ChevronRight, FileDown, AlertTriangle, X, Printer } from "lucide-react";
import resumeData from "@/data/resume.json";

// ── Types ──────────────────────────────────────────────────────────────────
type Bullet = {
  id: string;
  text: string;
  isActive: boolean;
  tags: string[];
};

type Job = {
  id: string;
  company: string;
  role: string;
  date: string;
  isActive: boolean;
  bullets: Bullet[];
};

type Project = {
  id: string;
  name: string;
  tech: string;
  description: string;
  isActive: boolean;
};

type ResumeState = {
  basics: {
    name: string;
    title: string;
    location: string;
    phone: string;
    email: string;
    github: string;
    linkedin: string;
  };
  summary: string;
  experience: Job[];
  projects: Project[];
  skills: Record<string, string[]>;
};

// ── Constants ──────────────────────────────────────────────────────────────
const ONE_PAGE_PX = 1056;
const KEYWORD_TARGET = 35;

const STOP_WORDS = new Set([
  "a", "an", "the", "and", "or", "but", "in", "on", "at", "to", "for",
  "of", "with", "by", "from", "as", "is", "was", "are", "were", "be",
  "been", "being", "have", "has", "had", "do", "does", "did", "will",
  "would", "could", "should", "may", "might", "shall", "can", "need",
  "this", "that", "these", "those", "it", "its", "i", "you", "he", "she",
  "we", "they", "them", "their", "our", "your", "my", "his", "her",
  "what", "which", "who", "when", "where", "why", "how", "all", "each",
  "both", "few", "more", "most", "other", "some", "such", "no", "not",
  "only", "same", "so", "than", "too", "very", "just", "about", "above",
  "across", "after", "also", "between", "into", "through", "during",
  "before", "while", "although", "because", "if", "then", "any", "per",
  "use", "using", "used", "new", "work", "working", "role", "team",
]);

// ── Utilities (defined outside component to avoid re-creation) ─────────────

/**
 * Tokenise raw JD text into a Set of meaningful lowercase keywords,
 * filtering out stop-words and tokens shorter than 2 characters.
 */
function extractKeywords(text: string): Set<string> {
  return new Set(
    text
      .toLowerCase()
      .split(/[\s\W]+/)           // split on whitespace and non-word chars
      .map((w) => w.replace(/[^a-z0-9]/g, ""))
      .filter((w) => w.length >= 2 && !STOP_WORDS.has(w))
  );
}

/**
 * Split `text` into React nodes, wrapping matched keyword tokens with a yellow
 * <mark>. Tokenises on whitespace so compound tech terms like "Node.js",
 * "C++", "CI/CD" stay as a single visual unit and don't create extra gaps
 * around punctuation between highlighted spans.
 */
function highlightText(
  text: string,
  keywords: Set<string>
): React.ReactNode {
  if (keywords.size === 0) return text;

  // Tokenise by splitting on whitespace only; each token may contain punctuation.
  // Alternate array: [ws, word, ws, word, …]
  const parts = text.split(/(\S+)/);

  return parts.map((part, i) => {
    if (i % 2 === 1) {
      // Strip leading/trailing punctuation to get the raw word for matching,
      // but render the original part so punctuation stays in place.
      const stripped = part.replace(/^[^a-z0-9]+|[^a-z0-9]+$/gi, "").toLowerCase();
      if (stripped && keywords.has(stripped)) {
        return (
          <mark
            key={i}
            className="bg-yellow-200 text-yellow-900 rounded-sm"
            style={{ padding: "1px 0" }}
          >
            {part}
          </mark>
        );
      }
    }
    return part;
  });
}

// ── Document canvas styles (zero Tailwind inside) ──────────────────────────
const docSection: React.CSSProperties = { marginBottom: "13px" };

const docH2: React.CSSProperties = {
  fontSize: "10.5pt",
  fontWeight: "bold",
  textTransform: "uppercase",
  letterSpacing: "0.08em",
  margin: "0 0 5px 0",
  paddingBottom: "3px",
  borderBottom: "1.5px solid #000",
};

// ── Component ──────────────────────────────────────────────────────────────
export default function Home() {
  const [resume, setResume] = useState<ResumeState>(resumeData as ResumeState);
  const [jobTitle, setJobTitle] = useState<string>(resumeData.basics.title);
  const [openJobs, setOpenJobs] = useState<Set<string>>(
    () => new Set(resumeData.experience.map((j) => j.id))
  );
  const [exceedsOnePage, setExceedsOnePage] = useState(false);
  const [warningDismissed, setWarningDismissed] = useState(false);
  const [jdText, setJdText] = useState("");
  const [isPrinting, setIsPrinting] = useState(false);
  const [isAiLoading, setIsAiLoading] = useState(false);
  const [aiError, setAiError] = useState<string | null>(null);

  const canvasRef = useRef<HTMLDivElement>(null);

  // ── Derived: keyword set from JD textarea ─────────────────────────────
  const jdKeywords = useMemo(() => extractKeywords(jdText), [jdText]);

  // ── Derived: how many unique JD keywords appear in active bullet text ──
  const matchedCount = useMemo(() => {
    if (jdKeywords.size === 0) return 0;
    // Collect every unique word token from active bullets
    const activeWords = new Set<string>();
    for (const job of resume.experience) {
      if (!job.isActive) continue;
      for (const bullet of job.bullets) {
        if (!bullet.isActive) continue;
        for (const part of bullet.text.split(/(\w+)/)) {
          activeWords.add(part.toLowerCase());
        }
      }
    }
    let count = 0;
    for (const kw of jdKeywords) {
      if (activeWords.has(kw)) count++;
    }
    return count;
  }, [jdKeywords, resume.experience]);

  // ── PDF export ─────────────────────────────────────────────────────────
  const handlePrint = useReactToPrint({
    contentRef: canvasRef,
    documentTitle: jobTitle || "Resume",
    onBeforePrint: async () => setIsPrinting(true),
    onAfterPrint: () => setIsPrinting(false),
    pageStyle: `
      @page { margin: 12mm 10mm; }
      @media print {
        body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
        * { box-shadow: none !important; }
      }
    `,
  });

  // ── Page-length monitor ────────────────────────────────────────────────
  useEffect(() => {
    const el = canvasRef.current;
    if (!el) return;
    const observer = new ResizeObserver(() => {
      setExceedsOnePage(el.offsetHeight > ONE_PAGE_PX);
    });
    observer.observe(el);
    return () => observer.disconnect();
  }, []);

  // Re-show warning whenever content crosses back over 1-page threshold
  useEffect(() => {
    if (exceedsOnePage) setWarningDismissed(false);
  }, [exceedsOnePage]);

  // ── Toggle helpers ─────────────────────────────────────────────────────
  function toggleAccordion(jobId: string) {
    setOpenJobs((prev) => {
      const next = new Set(prev);
      next.has(jobId) ? next.delete(jobId) : next.add(jobId);
      return next;
    });
  }

  function toggleJob(jobId: string) {
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.map((job) =>
        job.id !== jobId ? job : { ...job, isActive: !job.isActive }
      ),
    }));
  }

  function toggleBullet(jobId: string, bulletId: string) {
    setResume((prev) => ({
      ...prev,
      experience: prev.experience.map((job) =>
        job.id !== jobId
          ? job
          : {
              ...job,
              bullets: job.bullets.map((b) =>
                b.id !== bulletId ? b : { ...b, isActive: !b.isActive }
              ),
            }
      ),
    }));
  }

  function toggleProject(projectId: string) {
    setResume((prev) => ({
      ...prev,
      projects: prev.projects.map((p) =>
        p.id !== projectId ? p : { ...p, isActive: !p.isActive }
      ),
    }));
  }

  // ── AI Auto-Tailor ─────────────────────────────────────────────────────
  async function handleAITailor() {
    if (!jdText.trim()) {
      setAiError("Please paste a Job Description first.");
      return;
    }
    setAiError(null);
    setIsAiLoading(true);
    try {
      const response = await fetch("/api/tailor", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          jobDescription: jdText,
          masterResume: resumeData,
        }),
      });

      const aiData = await response.json();

      if (!response.ok) {
        const reason = aiData.hint ?? aiData.detail ?? aiData.error ?? `API error ${response.status}`;
        throw new Error(reason);
      }

      // Apply title override from AI
      if (aiData.targetTitle) setJobTitle(aiData.targetTitle);

      // Apply all other AI decisions to resume state
      setResume((prev) => ({
        ...prev,
        summary: aiData.tailoredSummary || prev.summary,
        experience: prev.experience.map((job) => ({
          ...job,
          bullets: job.bullets.map((b) => ({
            ...b,
            isActive: Array.isArray(aiData.activeExperienceBulletIds)
              ? aiData.activeExperienceBulletIds.includes(b.id)
              : b.isActive,
          })),
        })),
        projects: prev.projects.map((proj) => ({
          ...proj,
          isActive: Array.isArray(aiData.activeProjectIds)
            ? aiData.activeProjectIds.includes(proj.id)
            : proj.isActive,
        })),
      }));
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("AI Tailoring Error:", err);
      setAiError(msg);
    } finally {
      setIsAiLoading(false);
    }
  }

  // ── Counter colour: green in sweet-spot, amber below, red above ─────────
  const counterColour =
    jdKeywords.size === 0
      ? "text-gray-400"
      : matchedCount >= 25 && matchedCount <= KEYWORD_TARGET
      ? "text-emerald-600"
      : matchedCount > KEYWORD_TARGET
      ? "text-red-600"
      : "text-amber-600";

  const counterBg =
    jdKeywords.size === 0
      ? "bg-gray-100"
      : matchedCount >= 25 && matchedCount <= KEYWORD_TARGET
      ? "bg-emerald-50 border-emerald-200"
      : matchedCount > KEYWORD_TARGET
      ? "bg-red-50 border-red-200"
      : "bg-amber-50 border-amber-200";

  const { basics, summary, experience, projects, skills } = resume;

  return (
    <div className="flex h-full">
      {/* ════════════════════════════════════════
          LEFT PANE — Control Center
      ════════════════════════════════════════ */}
      <aside className="w-1/3 bg-gray-50 border-r border-gray-200 flex flex-col h-full">

        {/* ── Scrollable body ── */}
        <div className="flex-1 overflow-y-auto min-h-0">

          {/* Page-length warning banner */}
          {exceedsOnePage && !warningDismissed && (
            <div className="flex items-start gap-2.5 bg-red-50 border-b-2 border-red-500 px-4 py-3">
              <AlertTriangle size={16} className="text-red-600 mt-0.5 shrink-0" aria-hidden="true" />
              <p className="flex-1 text-xs font-bold text-red-700 leading-snug">
                Resume exceeds 1 page. ATS parsers prefer 1-page resumes for your
                experience level — uncheck some bullets before exporting.
              </p>
              <button
                onClick={() => setWarningDismissed(true)}
                aria-label="Dismiss warning"
                className="shrink-0 text-red-400 hover:text-red-600 transition-colors ml-1 mt-0.5"
              >
                <X size={14} />
              </button>
            </div>
          )}

          {/* App header */}
          <div className="px-5 pt-5 pb-4 border-b border-gray-200">
            <h1 className="text-base font-bold text-gray-900 tracking-tight">
              ATS Resume Builder
            </h1>
            <p className="text-xs text-gray-500 mt-0.5">
              Toggle bullets to tailor your resume for each job.
            </p>
          </div>

          {/* ── JD Keyword Matching ── */}
          <div className="px-5 py-4 border-b border-gray-200">

            {/* Matched keyword counter */}
            <div className={`flex items-center justify-between rounded-md border px-3 py-2 mb-3 ${counterBg}`}>
              <span className={`text-xs font-semibold ${counterColour}`}>
                Matched Keywords
              </span>
              <span className={`text-sm font-bold tabular-nums ${counterColour}`}>
                {matchedCount}
                <span className="font-normal text-xs">/{KEYWORD_TARGET}</span>
              </span>
            </div>

            {/* Sweet-spot guidance */}
            {jdKeywords.size > 0 && (
              <p className={`text-xs mb-2 ${counterColour}`}>
                {matchedCount > KEYWORD_TARGET
                  ? "Too many keywords — risk of ATS stuffing penalty."
                  : matchedCount >= 25
                  ? "Great match — in the 25–35 keyword sweet spot."
                  : "Add more relevant bullets to increase keyword coverage."}
              </p>
            )}

            <label
              htmlFor="jdText"
              className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5"
            >
              Paste Job Description Here
            </label>
            <textarea
              id="jdText"
              value={jdText}
              onChange={(e) => setJdText(e.target.value)}
              rows={6}
              placeholder="Paste the full job description here. Keywords that match your active bullets will be highlighted in yellow below."
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-xs text-gray-700 shadow-sm resize-y focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400 leading-relaxed"
            />
            {jdKeywords.size > 0 && (
              <p className="text-xs text-gray-500 mt-1">
                {jdKeywords.size} unique keywords extracted from JD.
              </p>
            )}

            {/* AI Auto-Tailor */}
            <button
              onClick={handleAITailor}
              disabled={isAiLoading || !jdText.trim()}
              className="mt-3 w-full flex items-center justify-center gap-2 rounded-md bg-gray-900 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-gray-700 active:bg-gray-800 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 transition-all disabled:opacity-50 disabled:cursor-not-allowed"
              aria-label="Auto-tailor resume with AI"
            >
              {isAiLoading ? (
                <>
                  <span className="inline-block h-3.5 w-3.5 animate-spin rounded-full border-2 border-white border-t-transparent" aria-hidden="true" />
                  Analyzing ATS Fit…
                </>
              ) : (
                <>
                  ✨ Auto-Tailor with AI
                </>
              )}
            </button>

            {/* Inline AI error message */}
            {aiError && (
              <div className="mt-2 flex items-start gap-2 rounded-md bg-red-50 border border-red-200 px-3 py-2.5">
                <AlertTriangle size={14} className="text-red-500 mt-0.5 shrink-0" aria-hidden="true" />
                <div className="min-w-0">
                  <p className="text-xs font-semibold text-red-700 leading-snug">AI Tailoring Failed</p>
                  <p className="text-xs text-red-600 mt-0.5 leading-relaxed break-words">{aiError}</p>
                </div>
                <button
                  onClick={() => setAiError(null)}
                  aria-label="Dismiss error"
                  className="shrink-0 text-red-400 hover:text-red-600 transition-colors ml-auto"
                >
                  <X size={13} />
                </button>
              </div>
            )}
          </div>

          {/* Target Job Title override */}
          <div className="px-5 py-4 border-b border-gray-200">
            <label
              htmlFor="jobTitle"
              className="block text-xs font-semibold text-gray-600 uppercase tracking-wider mb-1.5"
            >
              Target Job Title
            </label>
            <input
              id="jobTitle"
              type="text"
              value={jobTitle}
              onChange={(e) => setJobTitle(e.target.value)}
              className="w-full rounded-md border border-gray-300 bg-white px-3 py-2 text-sm text-gray-800 shadow-sm focus:border-blue-500 focus:outline-none focus:ring-1 focus:ring-blue-500 placeholder:text-gray-400"
              placeholder="e.g. Staff Engineer"
            />
            <p className="text-xs text-gray-500 mt-1">
              Overrides the title shown on the resume preview.
            </p>
          </div>

          {/* ── Experience accordion ── */}
          <div className="px-5 py-4 border-b border-gray-200">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Experience
            </h2>

            <div className="space-y-4">
              {experience.map((job) => {
                const isOpen = openJobs.has(job.id);
                const activeBullets = job.bullets.filter((b) => b.isActive).length;

                return (
                  <div
                    key={job.id}
                    className="rounded-md border border-gray-200 bg-white overflow-hidden"
                  >
                    {/* Company header row */}
                    <div className="flex items-center gap-2 px-3 py-2.5 bg-gray-100 border-b border-gray-200 hover:bg-gray-200 transition-colors">
                      <input
                        type="checkbox"
                        id={`job-${job.id}`}
                        checked={job.isActive}
                        onChange={() => toggleJob(job.id)}
                        className="h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                      />
                      <button
                        onClick={() => toggleAccordion(job.id)}
                        className="flex flex-1 items-center justify-between text-left min-w-0 cursor-pointer rounded focus:outline-none focus-visible:ring-2 focus-visible:ring-blue-500"
                      >
                        <div className="min-w-0">
                          <span
                            className={`block text-sm font-semibold truncate ${
                              job.isActive ? "text-gray-800" : "text-gray-400"
                            }`}
                          >
                            {job.company}
                          </span>
                          <span className="block text-xs text-gray-400 truncate">
                            {job.role}&nbsp;&middot;&nbsp;{job.date}
                          </span>
                        </div>
                        <div className="flex items-center gap-1.5 ml-2 shrink-0">
                          <span className="text-xs text-gray-400 tabular-nums">
                            {activeBullets}/{job.bullets.length}
                          </span>
                          {isOpen ? (
                            <ChevronDown size={14} className="text-gray-400" />
                          ) : (
                            <ChevronRight size={14} className="text-gray-400" />
                          )}
                        </div>
                      </button>
                    </div>

                    {/* Bullet list — keywords highlighted in yellow */}
                    {isOpen && (
                      <ul className="divide-y divide-gray-100">
                        {job.bullets.map((bullet) => {
                          const active = bullet.isActive && job.isActive;
                          return (
                            <li
                              key={bullet.id}
                              className={`flex items-start gap-2.5 px-3 py-2 transition-colors ${
                                active ? "bg-white" : "bg-gray-50 opacity-60"
                              }`}
                            >
                              <input
                                type="checkbox"
                                id={bullet.id}
                                checked={bullet.isActive}
                                onChange={() => toggleBullet(job.id, bullet.id)}
                                disabled={!job.isActive}
                                className="mt-0.5 h-3.5 w-3.5 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0 disabled:cursor-not-allowed disabled:opacity-50"
                              />
                              <label
                                htmlFor={bullet.id}
                                className={`text-xs leading-relaxed cursor-pointer select-none ${
                                  active
                                    ? "text-gray-700"
                                    : "text-gray-400 line-through decoration-gray-400"
                                }`}
                              >
                                {highlightText(bullet.text, jdKeywords)}
                              </label>
                            </li>
                          );
                        })}
                      </ul>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* ── Projects ── */}
          <div className="px-5 py-4">
            <h2 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Projects
            </h2>

            <div className="space-y-2">
              {projects.map((proj) => (
                <div
                  key={proj.id}
                  className={`flex items-start gap-2.5 rounded-md border px-3 py-2.5 transition-colors ${
                    proj.isActive
                      ? "border-gray-200 bg-white"
                      : "border-gray-100 bg-gray-50"
                  }`}
                >
                  <input
                    type="checkbox"
                    id={proj.id}
                    checked={proj.isActive}
                    onChange={() => toggleProject(proj.id)}
                    className="mt-0.5 h-4 w-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 cursor-pointer shrink-0"
                  />
                  <label htmlFor={proj.id} className="cursor-pointer select-none min-w-0">
                    <span
                      className={`block text-sm font-medium truncate ${
                        proj.isActive ? "text-gray-800" : "text-gray-400 line-through"
                      }`}
                    >
                      {proj.name}
                    </span>
                    <span className="block text-xs text-gray-400 mt-0.5">{proj.tech}</span>
                  </label>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* ── Sticky Export Footer ── */}
        <div className="shrink-0 border-t border-gray-200 bg-white px-5 py-4">
          <button
            onClick={() => handlePrint()}
            disabled={isPrinting}
            className="w-full flex items-center justify-center gap-2 rounded-md bg-blue-600 px-4 py-2.5 text-sm font-semibold text-white shadow-sm hover:bg-blue-700 active:bg-blue-800 focus:outline-none focus:ring-2 focus:ring-blue-500 focus:ring-offset-2 transition-all disabled:opacity-70 disabled:cursor-not-allowed"
            aria-label="Export resume as PDF"
          >
            {isPrinting ? (
              <>
                <Printer size={16} className="animate-pulse" aria-hidden="true" />
                Preparing…
              </>
            ) : (
              <>
                <FileDown size={16} aria-hidden="true" />
                Export PDF
              </>
            )}
          </button>
          <p className="text-xs text-gray-500 text-center mt-1.5">
            Opens print dialog — save as PDF for ATS compatibility.
          </p>
        </div>
      </aside>

      {/* ════════════════════════════════════════
          RIGHT PANE — Document Preview
      ════════════════════════════════════════ */}
      <main className="w-2/3 bg-gray-200 overflow-auto flex justify-center py-10 px-6">

        {/* Wrapper keeps label and canvas the same width and centred together */}
        <div style={{ width: "210mm" }}>

          {/* Live preview label */}
          <div className="mb-3 flex items-center gap-2">
            <span className="text-xs font-semibold text-gray-500 uppercase tracking-wider">
              Live Preview
            </span>
            {exceedsOnePage && (
              <span className="flex items-center gap-1 text-xs font-semibold text-red-500">
                <AlertTriangle size={11} aria-hidden="true" />
                Exceeds 1 page
              </span>
            )}
          </div>

        <div
          ref={canvasRef}
          style={{
            width: "210mm",
            minHeight: "297mm",
            backgroundColor: "#ffffff",
            padding: "40px",
            fontFamily: "Arial, Helvetica, sans-serif",
            color: "#000000",
            fontSize: "10.5pt",
            lineHeight: "1.45",
            boxShadow: "0 2px 16px rgba(0,0,0,0.12)",
          }}
        >
          {/* ── Header ── */}
          <header style={{ textAlign: "center", marginBottom: "12px" }}>
            <h1
              style={{
                fontSize: "20pt",
                fontWeight: "bold",
                margin: "0 0 3px 0",
                letterSpacing: "0.03em",
              }}
            >
              {basics.name}
            </h1>
            <p style={{ fontSize: "11pt", margin: "0 0 5px 0" }}>{jobTitle}</p>
            <p style={{ fontSize: "9pt", margin: 0, color: "#333" }}>
              {basics.location}&nbsp;&nbsp;|&nbsp;&nbsp;
              {basics.phone}&nbsp;&nbsp;|&nbsp;&nbsp;
              {basics.email}&nbsp;&nbsp;|&nbsp;&nbsp;
              {basics.linkedin}&nbsp;&nbsp;|&nbsp;&nbsp;
              {basics.github}
            </p>
          </header>

          <hr style={{ border: "none", borderTop: "1.5px solid #000", margin: "8px 0 12px" }} />

          {/* ── Summary ── */}
          <section style={docSection}>
            <h2 style={docH2}>Professional Summary</h2>
            <p style={{ margin: 0, fontSize: "10.5pt" }}>{summary}</p>
          </section>

          {/* ── Experience ── */}
          <section style={docSection}>
            <h2 style={docH2}>Experience</h2>
            {experience
              .filter((job) => job.isActive)
              .map((job) => (
                <div key={job.id} style={{ marginBottom: "10px" }}>
                  <p style={{ margin: "0 0 1px 0", fontSize: "10.5pt" }}>
                    <strong>{job.company}</strong>
                    <span
                      style={{
                        float: "right",
                        fontWeight: "normal",
                        fontSize: "10pt",
                        color: "#222",
                      }}
                    >
                      {job.date}
                    </span>
                  </p>
                  <p
                    style={{
                      margin: "0 0 4px 0",
                      fontSize: "10pt",
                      fontStyle: "italic",
                      clear: "both",
                    }}
                  >
                    {job.role}
                  </p>
                  <ul style={{ margin: 0, paddingLeft: "20px" }}>
                    {job.bullets
                      .filter((b) => b.isActive)
                      .map((bullet) => (
                        <li
                          key={bullet.id}
                          style={{ fontSize: "10.5pt", marginBottom: "3px" }}
                        >
                          {bullet.text}
                        </li>
                      ))}
                  </ul>
                </div>
              ))}
          </section>

          {/* ── Projects ── */}
          {projects.some((p) => p.isActive) && (
            <section style={docSection}>
              <h2 style={docH2}>Projects</h2>
              {projects
                .filter((p) => p.isActive)
                .map((proj) => (
                  <div key={proj.id} style={{ marginBottom: "8px" }}>
                    <p style={{ margin: "0 0 2px 0", fontSize: "10.5pt" }}>
                      <strong>{proj.name}</strong>
                      <span style={{ fontWeight: "normal", color: "#333" }}>
                        {" "}&mdash; <em>{proj.tech}</em>
                      </span>
                    </p>
                    <p style={{ margin: 0, fontSize: "10.5pt" }}>{proj.description}</p>
                  </div>
                ))}
            </section>
          )}

          {/* ── Skills ── */}
          <section style={docSection}>
            <h2 style={docH2}>Skills</h2>
            {(Object.entries(skills) as [string, string[]][]).map(([category, items]) => (
              <p key={category} style={{ margin: "0 0 4px 0", fontSize: "10.5pt" }}>
                <strong>{category}:</strong>&nbsp;{items.join(", ")}
              </p>
            ))}
          </section>
        </div>
        </div>{/* end 210mm wrapper */}
      </main>
    </div>
  );
}
