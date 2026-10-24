# Handwriting Text Editor

Handwriting Text Editor is a browser-based editor for laying out typed text and freehand marks on paper-style pages. It turns the document into a handwriting-style preview with adjustable fonts, ink, page layout, and scan effects, and can export the preview as an A4 PDF.

The app uses plain HTML, CSS, and JavaScript. There is no build step or package installation.

## Run the app

Open `index.html` in a modern desktop or mobile browser. To serve it locally instead, run any static file server from the project folder and open the address it provides. The app can also be published as a static site, such as with GitHub Pages.

Some features use internet services: Google Fonts supplies the built-in typefaces, PDF export loads html2canvas and jsPDF from CDNs on demand, and handwriting recognition uses the Google Input Tools endpoint. Editing and drawing do not require a server. The browser stores the current document and settings in local storage for that browser and origin.

## Editing

The editor is arranged like a word processor. Select a ribbon tab to show its controls, and use **Edit**, **Preview**, or **PDF** in the header to switch views or export.

- **Home:** format text as bold, italic, underline, or strike-through; set font, size, text and highlight colors; align paragraphs; create lists; apply headings; undo and redo.
- **Insert:** draw lines, arrows, rectangles, ovals, and triangles; insert an image, horizontal rule, or page break.
- **Draw:** use a pen, pencil, highlighter, eraser, rectangle or lasso selection, or the text cursor. Configure pen size, pressure, roughness, and ink matching. The **Type (inkâ†’text)** tool sends drawn handwriting to the online recognition service and inserts the recognized text. It can convert automatically after a pause or with **Convert now**; **Undo convert** restores the strokes.
- **Layout:** choose cream, white, blue, or yellow ruled paper, grid, or plain paper; adjust rule color and spacing, margins, line alignment, indentation, and line-start drift.
- **Handwriting:** select one of the built-in handwriting fonts, set default ink and size, adjust character and word spacing, and tune wobble, character variation, typos, and slant.
- **Effects:** add scan tint and vignette, page curl, grain, flash glare, and fold creases.
- **File:** start a new document, add or remove pages, refresh the preview, or export a PDF.

The preview can be zoomed with the slider, plus/minus buttons, or Ctrl/Cmd + mouse wheel. Use the ribbon grip to resize the ribbon, or hide it with its toggle.

## Fonts

The built-in handwriting choices are loaded from Google Fonts: Kalam, Caveat, Shadows Into Light, Patrick Hand, Indie Flower, Dancing Script, Nothing You Could Do, Rock Salt, and Architects Daughter. They need an internet connection. The bundled **My Handwriting** font is loaded from `fonts/Personal-Font.ttf`.

To replace the bundled personal font, put your licensed `.ttf` file at `fonts/Personal-Font.ttf` and reload the app. Keep that filename so the CSS path continues to work. You can also use **Handwriting â†’ Custom font** to load a `.ttf`, `.otf`, `.woff`, or `.woff2` file for the current browser session.

## Export PDF

Switch to **Preview** to review the generated pages, then use **PDF** in the header or **File â†’ Export PDF**. The app renders each page and places it on an A4 portrait PDF page. PDF export requires access to the html2canvas and jsPDF CDN URLs; it may take a moment for the libraries and fonts to load.

## Files

```text
.
â”œâ”€â”€ index.html           # App structure and external font stylesheet
â”œâ”€â”€ css/
â”‚   â””â”€â”€ style.css        # Interface and page styles; bundled font declaration
â”œâ”€â”€ js/
â”‚   â””â”€â”€ app.js           # Editor, drawing, preview, effects, and export logic
â”œâ”€â”€ fonts/
â”‚   â””â”€â”€ Personal-Font.ttf
â”œâ”€â”€ favicon.ico
â””â”€â”€ .nojekyll            # Allows GitHub Pages to serve files as-is
```

## Notes

- Documents and settings are saved in the browser's local storage. They are not synced between browsers or devices; clearing site data removes the saved document.
- The handwriting recognition tool and external fonts require internet access. Recognition sends the drawn strokes to the Google Input Tools handwriting endpoint.
- Only redistribute font files that you have permission to share.

