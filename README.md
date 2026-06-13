# Dynamic ATS Resume Builder

A local web application that lets you load a master resume from a JSON file, toggle individual bullet points and projects on/off, tailor the content to a specific job description using live keyword matching, and export a clean, text-selectable PDF — all in the browser, with no backend or account required.

---

## Features

- **Two-pane layout** — Control Center on the left, live A4 document preview on the right
- **Toggle controls** — Accordion-style sections let you enable/disable individual bullet points and projects per job application
- **Target Job Title override** — Change the title line on the resume without editing the JSON
- **JD Keyword Matching** — Paste a job description and matching keywords are highlighted in yellow across your bullet points in real time
- **Keyword counter** — Tracks matched keywords against the 25–35 ATS sweet spot to avoid keyword stuffing penalties
- **Page-length warning** — A red banner appears when the rendered resume exceeds one page (1056 px / ~11 in), prompting you to uncheck bullets
- **PDF export** — Exports the document canvas as a text-selectable PDF via the browser print dialog (no images, no canvas — pure vector text)
- **ATS-safe document canvas** — Single-column layout, system fonts only (Arial/Helvetica), no web fonts, no Tailwind classes inside the printable area

---

## Tech Stack

| Layer | Library / Tool |
|---|---|
| Framework | Next.js 16 (App Router) |
| Language | TypeScript 5 |
| Styling | Tailwind CSS v4 |
| PDF export | react-to-print v3 |
| Icons | lucide-react |
| Runtime | Node.js ≥ 18 |

---

## Project Structure

```
ats-resume/
├── app/
│   ├── globals.css        # Base styles (system fonts, Tailwind import)
│   ├── layout.tsx         # Root layout — sets page title and full-height body
│   └── page.tsx           # Main app — all state, controls, and document canvas
├── data/
│   └── resume.json        # Master resume data (edit this file with your info)
├── public/                # Static assets
├── next.config.ts
├── tailwind.config        # (implicit via postcss)
├── tsconfig.json
└── package.json
```

---

## Prerequisites

- **Node.js** 18 or later — [nodejs.org](https://nodejs.org)
- **npm** 9 or later (bundled with Node.js)

Verify your versions:

```bash
node -v
npm -v
```

---

## Getting Started

### 1. Clone or download the repository

```bash
git clone https://github.com/your-username/ats-resume.git
cd ats-resume
```

### 2. Install dependencies

```bash
npm install
```

### 3. Start the development server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

---

## Customising Your Resume

All resume content lives in **`data/resume.json`**. Edit it directly — the dev server hot-reloads on save.

### Schema

```jsonc
{
  "basics": {
    "name": "Your Name",
    "title": "Default Job Title",
    "location": "City, State",
    "phone": "(555) 000-0000",
    "email": "you@example.com",
    "github": "github.com/yourhandle",
    "linkedin": "linkedin.com/in/yourhandle"
  },
  "summary": "One paragraph professional summary.",
  "experience": [
    {
      "id": "exp-1",              // unique string ID
      "company": "Acme Corp",
      "role": "Software Engineer",
      "date": "Jan 2022 – Present",
      "isActive": true,           // shows/hides entire company block
      "bullets": [
        {
          "id": "exp-1-b1",       // unique string ID
          "text": "Bullet point text here.",
          "isActive": true,       // shows/hides this bullet
          "tags": ["tag1", "tag2"]
        }
      ]
    }
  ],
  "projects": [
    {
      "id": "proj-1",
      "name": "Project Name",
      "tech": "React, Node.js",
      "description": "One sentence description.",
      "isActive": true
    }
  ],
  "skills": {
    "Languages": ["TypeScript", "Python"],
    "Frameworks": ["React", "Next.js"],
    "Cloud": ["AWS", "Docker"],
    "Databases": ["PostgreSQL", "Redis"]
  }
}
```

> **Tip:** Keep all `isActive` flags set to `true` in the JSON — they are your master copy. The app manages toggle state in memory; nothing is written back to the file.

---

## How to Use

### Tailoring to a Job

1. **Paste the job description** into the *Paste Job Description Here* textarea at the top of the left pane.
2. Keywords matching your active bullets are **highlighted in yellow** — this shows which bullets are most relevant.
3. Watch the **Matched Keywords X/35** counter:
   - **Amber (< 25):** too few matches — enable more relevant bullets
   - **Green (25–35):** in the ATS sweet spot
   - **Red (> 35):** risk of keyword stuffing — trim bullets or disable less relevant ones
4. Use the **Target Job Title** field to override the title line without changing the JSON.
5. Uncheck bullets and whole company blocks using the checkboxes in the accordion. The document preview updates instantly.
6. Watch for the red **"WARNING: Resume exceeds 1 page"** banner — uncheck bullets until it disappears.

### Exporting to PDF

1. Confirm the one-page warning is gone.
2. Click **Export PDF** at the bottom of the left pane.
3. In the browser print dialog, set **Destination → Save as PDF** and set margins to **None** or **Default**.
4. Save. The output is a fully text-selectable PDF that ATS parsers can read.

---

## Available Scripts

```bash
npm run dev      # Start local dev server at http://localhost:3000 (hot reload)
npm run build    # Build optimised production bundle
npm run start    # Serve the production build locally
npm run lint     # Run ESLint
```

---

## ATS Safety Notes

The document canvas is intentionally constrained:

- **System fonts only** — `Arial, Helvetica, sans-serif`. No Google Fonts or web fonts that could fail to load in a headless ATS parser.
- **Single column** — No multi-column CSS grid or flex layouts inside the printable area.
- **No icons** — No SVG icons or decorative elements inside the resume.
- **Inline styles only** — The canvas uses zero Tailwind classes; all layout is controlled by inline `style` props, so there is no risk of a missing stylesheet breaking the printed output.
- **Plain `<ul>/<li>` bullets** — Standard semantic HTML that every parser understands.
