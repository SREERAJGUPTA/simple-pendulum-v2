# Sakura Atelier v2 - verification record

Build date: 14 November 2026. This record applies to the delivered Sakura rebuild, not the original midnight-blue release.

## Delivered and checked

The exact compiled standalone HTML was rendered in headless Chromium with the network disabled. The managed browser prevents direct localhost and local-file navigation, so Playwright `set_content` was used on the artifact's actual bytes. This is an offline-content test, not a hosted-route, service-worker or local-file-policy test. WebGL context creation failed in this browser and the working SVG fallback was therefore exercised.

- **52/52 numerical, advanced-model, storage-contract and CSV checks passed.** The runner is the included synchronous offline assertion harness, not an execution of Vitest. It runs the original 31 cases and 21 new cases. Storage cases use an explicit MemoryStorage test double. Full dependency-based TypeScript typechecking was unavailable; TypeScript transpilation and runtime checks succeeded.
- **23/23 measurement-session checks passed** (`browser-measurement.json`). At 5 degrees, zero damping and g=9.81 m/s^2, measured periods at 0.50, 1.00 and 1.50 m were 1.419, 2.007 and 2.458 s. The free-intercept fit reported g=9.80 m/s^2. Recording, duplicate prevention, three plot views, CSV, clear/undo, uncertainty and quarter-speed timing were exercised.
- **33/33 interface-session checks passed** (`browser-interface.json`). Six setup checks overlap the measurement session; these are not claimed as 56 distinct checks. Keyboard and pointer release, numeric validation, the six graphs, ghost overlay, guided presets, feedback/retry, tab-arrow navigation, electric-field and resonance calculators, desktop reflow and 340/390 CSS-pixel reflow passed. No uncaught JavaScript errors or essential external HTTP(S) requests were observed.
- **20 complete cycles were timed in a separate fresh session**, at L=0.25 m, g=25 m/s^2, 5 degrees and zero damping. The UI returned 20/20 cycles and a mean period of 0.629 s. Both 0.25x and 1x playback buttons were exercised before the run. The exact console log is `long-run.log`; reproduce with `check-long-run.py`.
- Static production preflight returned no errors at the representative `/pendulum-sakura/` base, including offline inventory hashes and `.nojekyll`. Compiled modules live under `app/`, not the TypeScript `src/` tree. This does not execute JavaScript or certify deployment.
- The dependency-free Node preview server returned HTTP 200 and appropriate content for eight essential paths. This was an HTTP-client test, not browser navigation.
- Screenshots were visually inspected for title/instrument composition, laboratory, notebook, Grade 12 section and mobile reflow. `sakura-preview.png` is a real screenshot with ambient petals, not concept art. All screenshots show the **diagram fallback**, not the unverified GPU renderer.

## Numerical evidence

The test suite includes an independent Simpson-integral oracle for finite-angle periods, known small-angle reference cases, length/gravity scaling, mass independence at fixed angular damping, 120 s undamped energy drift, damping/heat balance, step-halving convergence, frame batching, interpolated same-direction crossings, free-intercept regression, corrupt/unsupported storage, quota errors and safe numeric CSV export. Added checks cover the analytic damped ghost in all three regimes, force/torque/tension, uncertainty endpoints, charged-bob effective gravity and the linear displacement-resonance maximum.

The uncertainty calculation uses assumed real-lab bounds; it is not a confidence interval and no random error is injected into simulated observations. Twenty-cycle timing measures simulated seconds. Actual stopwatch displays do not imply real-world millisecond accuracy.

## Remaining release gates

1. **3D/GPU appearance, ray picking, rendered geometry and device performance remain unverified.** The source implements a Three.js PBR scene and graceful fallback. It uses real-time rasterization, not a ray-tracing engine. No measured 60 fps claim is made.
2. **The prior ChatGPT-hosted URL was not updated.** No newly deployed site or repository-subpath browser test is claimed. The archive includes ready-to-host `docs/` and `dist/`.
3. **Native persistent-storage reload, service-worker install/update, browser restart with networking disabled and direct double-click local-file navigation were not verified.** The inline application works in the offline-content test. Browser policy can restrict local files; `node scripts/serve.mjs` is the alternative launch path.
4. **Physical touch devices, assistive-technology audits and cross-browser/GPU coverage remain untested.** Mobile checks are Chromium viewport/touch-capability emulation, not actual phones.

These limitations remain explicit in the project contract. Its release-certification check is expected to fail for the outstanding deployment/GPU/native persistence gates; its structural/evidence-integrity check must pass.

## Reproduce

Build: `npm ci` then `npm run build`. A global TypeScript installation is accepted by the custom compiler. Previewing prebuilt `docs/` does not require npm installation: `node scripts/serve.mjs`.

Model checks: `npm test`. Conventional Vitest path: `npm run test:vitest` after dependency installation. Full typecheck: `npm run check`.

Browser tests require Python Playwright and Chromium at `/usr/bin/chromium`. Set `QA_SECTION=measurement` or `QA_SECTION=interface` when running `verification/run-browser-checks.py`; omitting it runs both. The split accommodates short runner timeouts. The separate 20-cycle script is `verification/check-long-run.py`. The reports describe exactly which surface each test exercises.
