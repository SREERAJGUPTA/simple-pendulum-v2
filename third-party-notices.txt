# Third-party notices — Time in Motion

This file records the runtime libraries included in the production bundle and the direct development dependencies used to build and test it. Runtime versions are carried forward from the original Time in Motion source package and its pinned lockfile. For this Sakura edition, local ESM runtime snapshots were recovered from that licensed production bundle; packages were not re-downloaded. The original application has no open-source license selected by this package; the licenses below apply to their respective third-party components.

## Bundled runtime components

`vendor/react-runtime.js` contains the original React/React DOM runtime; `vendor/three-core.js` contains its original Three.js chunk. Thin wrappers expose the APIs used by the editable source. No font files are redistributed.

| Component | Version | License | Inspected notice |
| --- | --- | --- | --- |
| React | 19.1.1 | MIT | `node_modules/react/LICENSE` |
| React DOM | 19.1.1 | MIT | `node_modules/react-dom/LICENSE` |
| React Scheduler | 0.26.0 | MIT | `node_modules/scheduler/LICENSE` |
| Three.js | 0.180.0 | MIT | `node_modules/three/LICENSE` |

### React, React DOM, React Scheduler

MIT License

Copyright (c) Meta Platforms, Inc. and affiliates.

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

### Three.js

The MIT License

Copyright © 2010-2025 three.js authors

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in
all copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN
THE SOFTWARE.

## Development dependencies

These packages are build/test tools or TypeScript declarations. Their executable packages are not shipped as browser runtime files. `npm ci` installs their upstream license files alongside the packages; preserve those files if redistributing the tools themselves.

| Direct dependency | Version | Package license | Upstream license file |
| --- | --- | --- | --- |
| TypeScript | 5.9.2 | Apache-2.0 | `node_modules/typescript/LICENSE.txt` |
| Vite | 7.1.7 | MIT; bundled components have additional notices | `node_modules/vite/LICENSE.md` |
| Vitest | 3.2.4 | MIT; bundled components have additional notices | `node_modules/vitest/LICENSE.md` |
| @types/node | 24.5.2 | MIT | `node_modules/@types/node/LICENSE` |
| @types/react | 19.1.16 | MIT | `node_modules/@types/react/LICENSE` |
| @types/react-dom | 19.1.9 | MIT | `node_modules/@types/react-dom/LICENSE` |
| @types/three | 0.180.0 | MIT | `node_modules/@types/three/LICENSE` |

Vite's installed notice lists bundled BSD-2-Clause, CC0-1.0, ISC, and MIT components; Vitest's installed notice lists bundled BSD-3-Clause, ISC, and MIT components. The full upstream files remain the authoritative notices for those tool distributions. `package-lock.json` fixes the complete transitive dependency graph.

## Application assets and educational references

The pendulum geometry, interface diagrams, graph paths, icon, and material/lighting configuration are created for this application. No downloaded stock model, photographic texture, font file, or image-generation asset is included. System font fallbacks are used. Three.js provides the rendering implementation and retains the license above.

The explanatory text is newly written. Links to OpenStax and MIT identify scientific references; their articles, illustrations, and PDFs are not redistributed in this package. No rights in those linked publications are claimed. Their respective site licenses and terms apply when visiting or reusing their material.
