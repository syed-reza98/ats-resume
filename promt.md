Here is a step-by-step sequence of prompts you can copy and paste directly into an AI Coding Agent (like Cursor, Windsurf, Devin, or GitHub Copilot Workspace) to build the Dynamic Resume Builder.
These prompts are engineered to give the AI strict constraints, preventing it from over-engineering the design (which ruins ATS parsing) while focusing heavily on the Next.js state management and PDF export logic.
### Prompt 1: Project Initialization & Data Layer
**Instructions for you:** Open your AI agent in an empty directory and feed it this prompt to set up the foundation.
```text
You are an expert Next.js and React developer. We are building a local "Dynamic ATS Resume Builder" web application. The goal is to load a master JSON file of career history and provide a UI to toggle specific bullet points/projects on and off, tailoring it to a specific Job Description, and exporting the result as a text-selectable PDF.

Step 1: Initialize a Next.js project (App Router) with Tailwind CSS.
Step 2: Install `react-to-print` for PDF exporting and `lucide-react` for basic UI icons.
Step 3: Create a file at `src/data/resume.json` that represents my "Master Resume". It should have the following schema:
- basics: name, title, location, phone, email, github, linkedin.
- summary: string.
- experience: array of objects (id, company, role, date, isActive (boolean), bullets (array of objects with id, text, isActive, tags)).
- projects: array of objects (id, name, tech, description, isActive).
- skills: object with categories (Languages, Frameworks, Cloud, Databases) containing arrays of strings.

Populate this JSON with dummy data for a Software Engineer. Ensure all `isActive` flags default to true.

```
### Prompt 2: Core Architecture & Two-Pane Layout
**Instructions for you:** Once the project is initialized, use this prompt to build the core UI shell.
```text
Now, let's build the main UI in `src/app/page.tsx`. 

Create a responsive, full-height two-pane layout:
1. Left Pane (Control Center): Width 1/3, background gray-50, scrollable Y. This will house our controls.
2. Right Pane (Preview Pane): Width 2/3, background gray-200, flex center, scrollable Y. 

Inside the Right Pane, create a "Document Canvas" div. This div MUST have the following strict inline styles to ensure it behaves exactly like an A4 page for ATS parsing:
- width: 210mm (or max-w-[800px] equivalent)
- min-height: 297mm
- background: white
- padding: 40px
- font-family: Arial, Helvetica, sans-serif (CRITICAL: Do not use web fonts, only system fonts).
- text color: black

Import the `resume.json` data and map it out inside the Document Canvas. Render the Basics (header), Summary, Experience, Projects, and Skills. Only render items where `isActive` is true. Ensure the design is strictly single-column, using standard typography (h1, h2, h3) and standard bullet points. Do not use any hidden tables, flexbox grids that mimic columns, or icons in the resume document itself.

```
### Prompt 3: State Management & Toggling Logic
**Instructions for you:** This prompt wires up the left pane so you can actually interact with the data.
```text
Let's implement the state management to make the resume dynamic.

1. Load `resume.json` into a React `useState` object in `page.tsx`.
2. In the Left Pane (Control Center), create the following controls:
   - A text input linked to state to dynamically edit the "Target Job Title" (overriding the basics.title).
   - Accordion-style or list sections mapping over the `experience` and `projects` arrays from our state.
3. For every company, map its `bullets`. Next to each bullet, render a checkbox. 
4. Write a toggle function that updates the nested state: when a checkbox is clicked, it flips the `isActive` boolean for that specific bullet point or project in the state.
5. As I click the checkboxes in the Left Pane, the Right Pane (Document Canvas) should instantly re-render, showing or hiding those specific bullet points.

```
### Prompt 4: The PDF Exporter & Page Length Warning (ATS Rules)
**Instructions for you:** This ensures you can export the tailored resume and visually validates that it fits on one page.
```text
Let's add export functionality and ATS safety rails.

1. Import `useReactToPrint` from `react-to-print`. 
2. Attach a `ref` to the "Document Canvas" div in the Right Pane.
3. Add a sticky "Export PDF" button at the bottom of the Left Pane that triggers the print dialog, allowing me to save the document as a text-selectable PDF.
4. Add a "Length Warning" feature:
   - Create a `useEffect` that monitors the height of the Document Canvas ref.
   - If the rendered height exceeds 1056px (roughly one standard 8.5x11 / A4 page), display a bold red warning banner at the top of the Left Pane saying: "WARNING: Resume exceeds 1 page. ATS parsers prefer 1-page resumes for your experience level. Uncheck some bullets."

```
### Prompt 5: Phase 2 Feature - Job Description (JD) Keyword Matching
**Instructions for you:** This final prompt adds the AI-assisted keyword tracking to help you avoid keyword stuffing while remaining highly relevant.
```text
Finally, let's add the Job Description Context matching feature.

1. At the very top of the Left Pane, add a `<textarea>` labeled "Paste Job Description Here".
2. Create a basic JavaScript utility function that extracts words from this textarea. (Ignore common stop words like "and", "the", "with", etc., and convert everything to lowercase).
3. Create a state array called `jdKeywords` to store these extracted words.
4. Now, dynamically highlight keywords: update the rendering logic in the Left Pane's bullet-point checklist. If a word in one of my resume bullets matches a word in the `jdKeywords` array, highlight that word in yellow or bold it in the Left Pane UI so I know which bullets are most relevant to the JD.
5. Add a simple counter above the textarea showing "Matched Keywords: X/35" to help me stay in the 25-35 keyword sweet spot to avoid ATS keyword stuffing penalties.

```
### How to use this workflow:
 1. Initialize a new folder on your machine.
 2. Open it in an AI agent like **Cursor**.
 3. Hit Cmd+I (or Ctrl+I on Windows) to open the Composer/Agent terminal.
 4. Paste the prompts one by one, waiting for the agent to finish writing and testing the code before feeding it the next phase.
