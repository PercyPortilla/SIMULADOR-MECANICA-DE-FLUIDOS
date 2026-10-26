## Tools first (token budget)
- Before any task with many similar steps (convert, rename, load, extract, bulk-edit), check whether an existing command-line tool does it in one command: markitdown for PDF and Office files, jq for JSON, ImageMagick for images, ffmpeg for audio and video, pandas for CSV and Excel, ripgrep for text search, spaCy for language analysis. Prefer the tool. If it isn't installed, install it: system tools with the package manager, Python packages with pip inside .venv. Tell me what it is and why before installing; if it needs admin rights, give me the command to run myself.
- If no tool fits, write a script in scripts/, in the project's language when it fits and otherwise Python. Reuse existing scripts first. Run the script; don't do the steps one by one.
- When you only need the text of a PDF, Word, Excel or PowerPoint file, convert it with markitdown and read the relevant parts. Read the original only when layout or images matter.
- Never do arithmetic yourself. Compute in a script, or build a spreadsheet with formulas (openpyxl, or LibreOffice) when I may want to change the inputs later.
- Scripts print a short summary, never whole files or logs. Everything printed enters the context.
- Delegate running scripts and bulk file operations to the runner subagent. You plan, decide and check the result.
