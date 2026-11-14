# DTF Gang Sheet Builder & Print Preparation Studio Pro

An industrial-grade, automated **Direct-to-Film (DTF) Gang Sheet Builder and Print Preparation Application** built according to the specification blueprint and inspired by [DTF Layout](https://dtflayout.com/).

---

## 🌟 Key Features

1. **Multi-Format Upload & Inspection**:
   - Accepts PNG, JPG, and JPEG artwork.
   - Genuine alpha channel inspection: preserves pre-existing transparent PNGs without destructive re-processing.
   - Automatic background removal for JPG/JPEG and opaque PNGs using perimeter flood-fill & chroma edge detection.
   - Prevents erasure of internal white lettering, logos, and motifs.

2. **Smart Alpha Margin Auto-Trim**:
   - Alpha channel scan (`alpha > 8`) to detect non-transparent artwork boundaries `[minX, minY, maxX, maxY]`.
   - Automated empty space calculation: detects when artwork canvas contains excessive margins (e.g., `53% of this is empty space`).
   - 1-Click **Trim it** action with configurable safety padding (default 2px) to minimize wasted film.

3. **Per-Design Sizing & DPI Preflight**:
   - Target physical width and height inputs with real-time unit conversions (`inch`, `mm`, `cm`, `meter`).
   - **Lock Aspect Ratio** toggle to preserve artwork proportions.
   - 90° rotation switch for flexible orientation.
   - Dynamic **Effective DPI calculation** (`source_px ÷ target_inches`):
     - 🟢 **Green (≥ 300 DPI):** Print-ready high resolution.
     - 🟡 **Amber (150–299 DPI):** Acceptable print resolution.
     - 🔴 **Red (< 150 DPI):** Low resolution warning with preflight alert.

4. **Automated Box Nesting Engine (MaxRects & Skyline)**:
   - Deterministic geometry packing that treats each copy as a distinct virtual placement instance.
   - Evaluates 90° rotations to minimize roll height.
   - Configurable film roll width presets (11.5", 13", 22", 24", 48", 60", or Custom).
   - Configurable inter-item spacing (default 0.3") and outer film margins.
   - **Auto Length mode** (automatically sets roll length to lowest edge + margin) or **Fixed Length mode** (with overflow detection).
   - Real-time **Film Waste Percentage** and linear meter usage calculation.

5. **Interactive Live Sheet Preview**:
   - Transparent checkerboard roll canvas with film boundaries and dashed margin guides.
   - Interactive Zoom In / Zoom Out / Reset controls.
   - Click to inspect artwork details on film.
   - Support for True-shape simulated nesting comparison.

6. **Print-Ready 300 DPI Transparent PNG Export**:
   - Renders exact high-resolution output matching RIP pixel dimensions:
     `output_width_px = round(FilmWidth_in × 300)`
     `output_height_px = round(SheetLength_in × 300)`
   - High-quality bicubic down/up-sampling.
   - Downloadable Production Job Ticket (JSON) with placement coordinates for contour cutting and print shop records.

7. **Studio AI & Prep Tools**:
   - **Fix & Quality**: Image Upscaler, Color & Tone, Pixel Doctor (despeckle stray pixels), Print Check audit.
   - **Cut & Adjust**: Remove/Replace Color, Crop & Clean, Eraser, Border Knockout.
   - **Style & Effects**: Special Effects, Texture Effects, Halftone (dot screen rasterization), Stroke / Outline (white underbase generator).
   - **Create & Convert**: Text & Number, Image Vectoriser, Recreate with AI, Guide.

---

## 🚀 Quick Start

### 1. Run the Frontend (Vite + React + TypeScript)

```bash
# Install dependencies (already installed)
npm install

# Start Vite development server
npm run dev
```

Open your browser at `http://localhost:5173`.

### 2. Run the Backend API (FastAPI + OpenCV + Pillow)

```bash
# Start FastAPI server
python -m uvicorn server.main:app --host 127.0.0.1 --port 8000 --reload
```

Interactive API documentation available at `http://127.0.0.1:8000/docs`.

---

## 🧪 Testing

Run automated tests verifying unit conversion, DPI calculations, and MaxRects nesting:

```bash
python tests/test_dtf_pipeline.py
```

