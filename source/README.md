# Time in Motion - Sakura Atelier

A rebuilt, interactive simple-pendulum laboratory for Sreeraj. The Sakura edition replaces the midnight observatory with ivory, rose and brass, restrained drifting petals, architectural light and editorial typography. The underlying nonlinear experiment remains the authority for the instrument, readouts, measurements and graphs.

## Start here

**Portable preview:** open `Time-in-Motion-Sakura.html` in a current browser. This file embeds the runtime, lesson content, CSS, SVGs and Three.js; it makes no network request for essential assets. A network connection is only needed to visit optional reference links. Browser security policies can restrict local HTML. The exact HTML contents were exercised in an offline Chromium context; direct file navigation was blocked by the managed test environment, so double-click behavior was not verified here.

**Prebuilt site:** with Node 22 or newer, run `node scripts/serve.mjs` from this directory. Open the loopback address printed in the terminal. This serves `docs/`, requires no package installation, and supports the normal module and service-worker route. Stop with Ctrl+C. Alternatively, serve `docs/` with any standard static HTTP server. Do not double-click `docs/index.html`: unlike the portable file, it loads separate JavaScript modules.

**Online status:** this package does not update the earlier ChatGPT-hosted website. The existing public/private URL remains the previous edition. No new live URL is claimed.

## What is included

- Brass pendulum with a real-time physically based Three.js renderer and an automatic interactive SVG fallback. Both share the same model. The hero has a camera entrance and scroll-linked approach; the laboratory offers front and oblique views when WebGL is available. The hero and lab are synchronized renderers, not one canvas that literally morphs between sections.
- Ivory architecture, soft procedural reflections and shadows, gently falling Sakura petals, a motion preference, reduced-motion handling and responsive layouts. This is real-time PBR rasterization, **not actual ray tracing**. Background softening is not a physical depth-of-field renderer.
- Drag/release, keyboard hold/release, numeric controls, length, gravity, initial angle, mass, angular damping, play/pause/reset, 0.05 s step, playback at 0.1x, 0.25x, 0.5x and 1x.
- Nonlinear versus linearized ghost comparison; angle, signed tangential velocity, tangential acceleration, phase-space, energy and measured turning-amplitude-squared graphs.
- Automatic timing of 1, 5, 10 or 20 complete cycles, a separate manual stopwatch, measured frequency and 2*pi/T readouts, nonlinear and small-angle predictions.
- A local observation notebook, full-condition replay, numeric CSV export, clear/undo, free-intercept fits in T^2 versus L and T versus sqrt(L), a curved L versus T view, inferred g and a seconds-pendulum estimate. Observations are never generated from theoretical periods.
- Assumed real-lab uncertainty bounds, six guided investigations, eight original feedback questions, derivation, phase/circular projection, energy and physical-pendulum notes, a practical/teacher bridge and printable selected notes.
- Grade 12 connections: a separate charged-bob/electric-field calculator, an LC/LCR analogy, and a separate linear steady-state resonance explorer. These do not apply an external drive or electric force to the main bob.

## Scientific contract

The main equation is

    theta'' + gamma * theta' + (g/L) * sin(theta) = 0

Internal units are metres, seconds, kilograms and radians. L is measured from pivot to the bob centre. The bob is a point mass, the support is fixed, the suspension is massless and inextensible, and gravity is uniform. Release is from rest. Theta is measured from the downward vertical; a positive angle is rightward.

    K = 0.5 * m * L^2 * theta'^2
    U = m * g * L * (1 - cos(theta))
    Q' = gamma * m * L^2 * theta'^2

The potential zero is the bottom. Q is independently integrated dissipated energy, not an unexplained residual. K+U is constant without damping; K+U+Q is conserved to numerical accuracy. At fixed gamma, changing mass changes energy and force, not motion. A fixed real-world drag law need not preserve gamma when mass changes.

Fourth-order Runge-Kutta uses a fixed simulated step of 1/240 s. Graphs sample this same state. Periods use interpolated consecutive rightward centre crossings; the first crossing arms the interval, so half-cycles are not counted as periods. Timing always uses simulation seconds. A parameter edit starts a new experiment and keeps saved observations. Timing becomes unavailable at rest and in the allowed overdamped regime.

The undamped finite-amplitude prediction is calculated by an arithmetic-geometric mean. Its numerical tests use an independent Simpson quadrature as an oracle. The ghost uses the analytic *linearized* damped solution from the same initial conditions. It is intentionally an approximation, not a competing nonlinear integrator.

Domain: L=0.25-2.50 m, g=0.50-25.00 m/s^2, mass=0.10-2.00 kg, gamma=0-1 s^-1, release=-80 to +80 degrees. This released-from-rest range avoids the slack-string/complete-rotation regime; those cases are not implemented. At a turning point, speed is zero but tangential acceleration generally is not. At the bottom, radial acceleration is v^2/L, even when the gravitational tangential component is zero. With damping, the speed maximum occurs slightly before the bottom.

## Learning scope

The Grade 11 layer covers the pendulum and small-angle SHM, torque derivation, frequency versus instantaneous angular velocity, the phase relationships among displacement/velocity/acceleration, energy, damping and practical measurements. The seconds-pendulum and amplitude-squared activities complement the CBSE practical work. The advanced electric-field, nonlinear, resonance and LC material is explicitly marked as a connection/enrichment; this is not an assertion that every extension is required by a board syllabus.

The horizontal-field calculator uses g_eff = sqrt(g^2+(qE/m)^2) and the new equilibrium direction. The resonance graph is the linear steady-state **displacement** response, whose maximum can lie below the natural frequency when damping is finite. That is distinguished from the current-amplitude resonance of a series LCR circuit.

Uncertainty is a first-order worst-case bound, not a statistical confidence interval. It applies a user-chosen length error and an error bound on the *whole* N-cycle timed interval. No random error is added to the ideal observation. Small-angle/damping bias is outside that error bound. More cycles do not remove a systematic length error.

## Build and test

The package includes prebuilt `docs/` and `dist/`; no build is needed to use them. Editable React/TypeScript is in `src/`.

    npm ci
    npm run build
    npm test

The custom build uses TypeScript and the local licensed ESM runtime snapshots in `vendor/`. It creates `dist/`, a matching GitHub-ready `docs/`, and the portable HTML. A globally installed TypeScript compiler is also accepted. All runtime assets are local, with no API keys, CDN, analytics or login requirement.

`npm run develop` uses the optional conventional Vite development server. `npm run check` is the full dependency-based TypeScript check; `npm run test:vitest` is the conventional Vitest path. Those dependency-based commands were not run in this environment because npm package retrieval was unavailable. The delivered production files were compiled with the available TypeScript compiler and checked by the included synchronous offline assertion runner. Do not confuse that runner with Vitest.

The offline runner executes the original 31 numerical/storage/export cases and 21 new advanced-model cases. The current browser script is `verification/run-browser-checks.py`, requiring Python Playwright and a Chromium installation. Read its environment limitations before interpreting its results.

## GitHub Pages

The exact release is already in `docs/`, including `.nojekyll`. Keep the source and runtime files alongside it for future editing. With a repository containing this package's contents, select the intended branch and `/docs` under the Pages publishing-source settings. These are relative-path static assets with hash section links, so the build does not assume a particular repository name.

The root `index.html` is a development entry pointing to TypeScript. It is **not** the static Pages entry. For root-based static hosting, upload the *contents* of `dist/`, including its own `index.html`, instead. Do not merge stale built assets into the new directory. Keep unrelated repository files intact. A real deployment and repository-subpath browser check remain to be performed on the chosen host.

Official publishing-source reference, checked 14 November 2026:
https://docs.github.com/en/pages/getting-started-with-github-pages/configuring-a-publishing-source-for-your-github-pages-site

## Offline and storage

The portable HTML has no essential external files. The hosted build has a release-hashed, scope-namespaced service worker. It only reports offline readiness after all required assets are cached, and offers activation explicitly rather than interrupting an experiment. On first use it needs a secure origin (HTTPS or localhost). The worker's runtime cache/update behavior was **not** reverified in the managed browser for this release.

Observations retain the original v1 schema/key per origin and folder path, with support extended to 20 cycles. Updating the same origin/path preserves valid old data; moving to another origin/path does not transfer browser storage. Browser privacy policies, eviction and local-file storage rules vary. CSV is the portable record. Corrupt or unavailable storage generates a visible warning; the live session remains usable. Native persistent storage reload was not verified here; the storage contract was tested with an explicit in-memory test double.

## Verification boundary

See `verification/REPORT.md` and the machine-readable results. Current checks establish the numerical model, offline-loaded fallback UI, learner workflows, responsive reflow, and selected keyboard/pointer interactions. They do **not** certify real GPU rendering, performance, real-device touch, every browser/assistive technology, full dependency-based type checking, or deployed service-worker lifecycle. The production renderer includes a functional diagram fallback so learning does not disappear when WebGL is unavailable.

## Sources and rights

Scientific links also appear inside the application:

- CBSE Physics XI-XII 2026-27: https://cbseacademic.nic.in/web_material/CurriculumMain27/SecPart2/Physics_SecP2_2026-27.pdf
- OpenStax, Pendulums: https://openstax.org/books/university-physics-volume-1/pages/15-4-pendulums
- OpenStax, Damped Oscillations: https://openstax.org/books/university-physics-volume-1/pages/15-5-damped-oscillations
- OpenStax, Forced Oscillations: https://openstax.org/books/university-physics-volume-1/pages/15-6-forced-oscillations
- OpenStax, LC Oscillations: https://openstax.org/books/university-physics-volume-2/pages/14-5-oscillations-in-an-lc-circuit
- MIT, The Simple Pendulum: https://underactuated.mit.edu/pend.html
- Three.js material documentation: https://threejs.org/docs/pages/MeshStandardMaterial.html
- MDN import maps: https://developer.mozilla.org/en-US/docs/Web/HTML/Reference/Elements/script/type/importmap

No source textbook pages, stock photographs, downloaded models, font files or generated image assets are redistributed. Geometry, SVG drawings and lesson text are authored for the experience. Runtime licenses are in `THIRD_PARTY_NOTICES.md` and embedded in the portable file. The user's application is not assigned an open-source license by this package.
