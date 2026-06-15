# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Commands

```bash
npm run dev      # Start dev server (accessible from LAN via --host)
npm run build    # Production build to ./dist/
npm run preview  # Preview built site locally
```

No test or lint scripts are configured.

## Architecture Overview

Single-page Astro portfolio with a WebGL background powered by Three.js. The page is essentially one long scroll with sections rendered as Astro components, while a full-viewport canvas sits fixed behind all content.

**Entry point:** `src/pages/index.astro` composes all sections in order.

**Layout:** `src/layouts/Layout.astro` handles the HTML head (fonts via astro-font, OGP meta), loads the CSS reset, and injects the `<canvas id="webgl">` element plus the Three.js initialization script.

**Sections (in render order):**
- `Welcome.astro` — Hero with sticky title, scroll-linked opacity via GSAP
- `Profile.astro` — Services grid (hardcoded `SERVICE_LIST` array inside the component)
- `Contact.astro` — Form that POSTs to external service (ssgform.com)

## Three.js / WebGL Layer

`src/scripts/initThree.ts` is the core of the visual experience. It runs once on page load and manages:

- **4 scenes:** sphere, palette1, result, background — rendered via render targets and composed in sequence
- **Metaball animation:** Uses Three.js `MarchingCubes` for animated blob shapes with wobble/breathing effects
- **Shaders:** Custom GLSL files in `src/scripts/shaders/` (vertex, fragment, planefragment, bgfragment, ribbonVertex, ribbonFragment). Loaded at runtime via `loadGLSLFile()` in `src/scripts/utils.ts`
- **Scroll animations:** GSAP ScrollTrigger links canvas effects and title opacity to scroll position
- **Mouse tracking:** Interactive visual feedback on desktop; disabled on mobile via `isAndroid()` / `isSmartPhone()` checks in `utils.ts`
- **Rendering config:** ACESFilmic tone mapping, PCFSoftShadowMap, RoomEnvironment, PBR materials with transmission/metalness/roughness
- **Canvas setup:** Fixed position, `z-index: -1`, behind all content via `src/styles/reset.css`

## Styling

- No Tailwind — pure CSS with `<style>` blocks scoped to each `.astro` component
- Global reset: `src/styles/reset.css`
- Responsive breakpoints: 1200px, 900px, 768px, 540px
- Font: Noto Sans JP (Google Fonts, loaded via astro-font integration)

## Technology Stack

- **Astro** ^5 — static site generator, file-based routing
- **Three.js** ^0.178 — 3D rendering
- **three-bvh-csg** — CSG operations for 3D geometry
- **GSAP** ^3.15 with ScrollTrigger — scroll-linked and timeline animations
- **astro-font** — font loading optimization

## Content

All content is hardcoded in components (no CMS, no Astro content collections). Site is in Japanese; primary author is 大川英俊 (Okawa Hidetoshi).

Public assets used in shaders: `public/pic4.png` (texture). OGP image: `public/ogp.png`.
