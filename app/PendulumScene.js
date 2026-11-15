import { jsx as _jsx, jsxs as _jsxs, Fragment as _Fragment } from '../vendor/react-runtime.js';
import { useEffect, useId, useRef, useState } from '../vendor/react-runtime.js';
import * as THREE from '../vendor/three.js';
import { linearReference } from './advanced.js';
const PIVOT_Y = 2.9;
const BOB_RADIUS = 0.135;
const DEG = Math.PI / 180;
/** Exact renderer datum: x² + (pivotY − y)² = L², independent of camera. */
export function pendulumBobPosition(length, theta) {
    return { x: length * Math.sin(theta), y: PIVOT_Y - length * Math.cos(theta), z: 0 };
}
function environment(renderer) {
    // These photographic softboxes are generated locally, not fetched from a CDN.
    const room = new THREE.Scene();
    room.background = new THREE.Color('#e9e0d3');
    const meshes = [];
    const card = (w, h, x, y, z, color, strength) => {
        const material = new THREE.MeshBasicMaterial({ color, side: THREE.DoubleSide });
        material.color.multiplyScalar(strength);
        const mesh = new THREE.Mesh(new THREE.PlaneGeometry(w, h), material);
        mesh.position.set(x, y, z);
        mesh.lookAt(0, 0, 0);
        room.add(mesh);
        meshes.push(mesh);
    };
    card(3, 6, -3, 3, 4, 0xfff1d6, 4.2);
    card(1.1, 5, 4, 1.5, 2, 0xffe5d7, 2.3);
    card(5, 1.8, 0, 5, 0, 0xffffff, 2.2);
    card(4, 1, 0, -2, 4, 0x715e43, 0.6);
    const generator = new THREE.PMREMGenerator(renderer);
    const target = generator.fromScene(room, 0.04);
    meshes.forEach(mesh => { mesh.geometry.dispose(); mesh.material.dispose(); });
    generator.dispose();
    return target;
}
function softShadowTexture() {
    const canvas = document.createElement('canvas');
    canvas.width = canvas.height = 128;
    const ctx = canvas.getContext('2d');
    const gradient = ctx.createRadialGradient(64, 64, 2, 64, 64, 63);
    gradient.addColorStop(0, 'rgba(0,0,0,.48)');
    gradient.addColorStop(0.35, 'rgba(0,0,0,.20)');
    gradient.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, 128, 128);
    const texture = new THREE.CanvasTexture(canvas);
    texture.colorSpace = THREE.SRGBColorSpace;
    return texture;
}
function disposeScene(scene) {
    const geometries = new Set();
    const materials = new Set();
    scene.traverse(object => {
        const renderable = object;
        if (renderable.geometry)
            geometries.add(renderable.geometry);
        if (renderable.material) {
            (Array.isArray(renderable.material) ? renderable.material : [renderable.material]).forEach(m => materials.add(m));
        }
    });
    geometries.forEach(geometry => geometry.dispose());
    materials.forEach(material => material.dispose());
}
/** A fixed world scale in the lab makes a change in length visibly meaningful. */
function frame(width, height, variant, length = 1.2, amplitude = 30) {
    const aspect = Math.max(0.2, width / Math.max(height, 1));
    const swingWidth = 2 * (Math.max(1.2, length) * Math.sin(Math.max(30, Math.abs(amplitude)) * DEG) + BOB_RADIUS + 0.25);
    const span = Math.max(variant === 'hero' ? Math.max(2.2, length + 0.65) : 3.5, swingWidth / aspect);
    const centerY = variant === 'hero' ? PIVOT_Y - Math.max(1.2, length) * 0.5 - 0.1 : 1.6;
    return { width: span * aspect, height: span, centerY };
}
export default function PendulumScene(props) {
    const { variant = 'lab', quality = 'standard' } = props;
    const hostRef = useRef(null);
    const canvasHostRef = useRef(null);
    const bobHandleRef = useRef(null);
    const lengthLabelRef = useRef(null);
    const angleLabelRef = useRef(null);
    const forceLabelRef = useRef(null);
    const fallbackGhostRef = useRef(null);
    const fallbackRodRef = useRef(null);
    const fallbackBobRef = useRef(null);
    const fallbackArcRef = useRef(null);
    const fallbackEquilibriumRef = useRef(null);
    const fallbackGravityRef = useRef(null);
    const fallbackTensionRef = useRef(null);
    const fallbackViewRef = useRef(null);
    const live = useRef(props);
    live.current = props;
    const interaction = useRef({ pointerId: -1, offset: 0, keyboardHeld: false });
    const pointToAngle = useRef(() => 0);
    const refreshRef = useRef(() => { });
    const [fallback, setFallback] = useState(false);
    const [held, setHeld] = useState(false);
    const gradientId = `bob-${useId().replace(/:/g, '')}`;
    // Parameters can change while this view is outside the viewport. Keep its
    // annotations current without spending GPU frames on the hidden scene.
    useEffect(() => { refreshRef.current(); }, [props.parameters, props.showForces, props.showTrail, props.view, props.showComparison]);
    const release = () => {
        if (interaction.current.pointerId === -1 && !interaction.current.keyboardHeld)
            return;
        const pointerId = interaction.current.pointerId;
        interaction.current.pointerId = -1;
        interaction.current.keyboardHeld = false;
        const button = bobHandleRef.current;
        if (pointerId !== -1 && button?.hasPointerCapture(pointerId))
            button.releasePointerCapture(pointerId);
        setHeld(false);
        live.current.onRelease?.();
    };
    useEffect(() => {
        const host = hostRef.current;
        const holder = canvasHostRef.current;
        if (!host || !holder)
            return;
        let raf = 0;
        let visible = true;
        let destroyed = false;
        let width = Math.max(1, host.clientWidth);
        let height = Math.max(1, host.clientHeight);
        const framing = () => frame(width, height, variant, live.current.parameters.length, live.current.parameters.releaseAngle);
        const f = framing();
        const updateLabels = (project, theta, length) => {
            const { x, y } = pendulumBobPosition(length, theta);
            const [bx, by] = project(x, y);
            const [rx] = project(x + BOB_RADIUS, y);
            const button = bobHandleRef.current;
            if (button) {
                const diameter = Math.max(44, Math.abs(rx - bx) * 2 + 14);
                button.style.width = `${diameter}px`;
                button.style.height = `${diameter}px`;
                button.style.transform = `translate(${bx - diameter / 2}px, ${by - diameter / 2}px)`;
            }
            const [lx, ly] = project(x * 0.52 - 0.13 * Math.cos(theta), PIVOT_Y - Math.cos(theta) * length * 0.52 - 0.13 * Math.sin(theta));
            if (lengthLabelRef.current) {
                lengthLabelRef.current.style.transform = `translate(${lx}px, ${ly}px) translate(-100%, -50%)`;
                lengthLabelRef.current.textContent = `${length.toFixed(2)} m`;
            }
            const [ax, ay] = project(0.23, PIVOT_Y - 0.25);
            if (angleLabelRef.current) {
                angleLabelRef.current.style.transform = `translate(${ax}px, ${ay}px)`;
                angleLabelRef.current.textContent = `${(theta / DEG).toFixed(1)}°`;
            }
            if (forceLabelRef.current)
                forceLabelRef.current.style.opacity = live.current.showForces ? '1' : '0';
        };
        if (fallback) {
            const project = (x, y) => {
                const v = framing();
                return [(x / v.width + 0.5) * width, (0.5 - (y - v.centerY) / v.height) * height];
            };
            const resize = () => {
                width = Math.max(1, host.clientWidth);
                height = Math.max(1, host.clientHeight);
                const v = framing();
                fallbackViewRef.current?.setAttribute('viewBox', `${-v.width / 2} ${-v.centerY - v.height / 2} ${v.width} ${v.height}`);
            };
            pointToAngle.current = (clientX, clientY) => {
                const rect = host.getBoundingClientRect();
                const v = framing();
                const x = ((clientX - rect.left) / width - 0.5) * v.width;
                const y = v.centerY + (0.5 - (clientY - rect.top) / height) * v.height;
                return Math.atan2(x, PIVOT_Y - y);
            };
            const syncFallback = () => {
                const v = framing();
                fallbackViewRef.current?.setAttribute('viewBox', `${-v.width / 2} ${-v.centerY - v.height / 2} ${v.width} ${v.height}`);
                const { theta, omega } = live.current.stateRef.current;
                if (fallbackGhostRef.current) {
                    const q = linearReference(live.current.parameters, live.current.stateRef.current.time);
                    fallbackGhostRef.current.setAttribute('transform', `translate(0,${-PIVOT_Y}) rotate(${-q.theta / DEG})`);
                    fallbackGhostRef.current.style.opacity = live.current.showComparison ? '.42' : '0';
                }
                const { length, gravity, mass, releaseAngle } = live.current.parameters;
                const { x, y } = pendulumBobPosition(length, theta);
                fallbackRodRef.current?.setAttribute('x2', String(x));
                fallbackRodRef.current?.setAttribute('y2', String(-y));
                fallbackBobRef.current?.setAttribute('transform', `translate(${x},${-y})`);
                fallbackEquilibriumRef.current?.setAttribute('y2', String(-(PIVOT_Y - length - 0.12)));
                const extent = variant === 'hero' ? Math.min(80, Math.max(20, Math.abs(releaseAngle) + 7)) : 80;
                const left = [-length * Math.sin(extent * DEG), -(PIVOT_Y - length * Math.cos(extent * DEG))];
                const right = [length * Math.sin(extent * DEG), left[1]];
                fallbackArcRef.current?.setAttribute('d', `M ${left[0]} ${left[1]} A ${length} ${length} 0 0 0 ${right[0]} ${right[1]}`);
                if (fallbackArcRef.current)
                    fallbackArcRef.current.style.opacity = live.current.showTrail === false ? '0' : variant === 'hero' ? '0.25' : '0.4';
                const weight = mass * gravity;
                const tension = Math.max(0, mass * (gravity * Math.cos(theta) + length * omega * omega));
                const forceScale = 0.65 / Math.max(weight, tension, 0.01);
                if (fallbackGravityRef.current && fallbackTensionRef.current) {
                    fallbackGravityRef.current.setAttribute('d', `M ${x} ${-y} l 0 ${weight * forceScale}`);
                    fallbackTensionRef.current.setAttribute('d', `M ${x} ${-y} l ${-Math.sin(theta) * tension * forceScale} ${-Math.cos(theta) * tension * forceScale}`);
                    fallbackGravityRef.current.style.opacity = fallbackTensionRef.current.style.opacity = live.current.showForces ? '1' : '0';
                }
                updateLabels(project, theta, length);
            };
            refreshRef.current = syncFallback;
            const draw = () => {
                if (destroyed)
                    return;
                if (visible && !document.hidden)
                    syncFallback();
                raf = requestAnimationFrame(draw);
            };
            resize();
            syncFallback();
            const resizeObserver = new ResizeObserver(resize);
            resizeObserver.observe(host);
            const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible)
                syncFallback(); }, { rootMargin: '80px' });
            observer.observe(host);
            window.addEventListener('blur', release);
            raf = requestAnimationFrame(draw);
            live.current.onReady?.('fallback');
            return () => {
                destroyed = true;
                refreshRef.current = () => { };
                cancelAnimationFrame(raf);
                resizeObserver.disconnect();
                observer.disconnect();
                window.removeEventListener('blur', release);
            };
        }
        let renderer;
        try {
            renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true, powerPreference: 'high-performance' });
        }
        catch {
            setFallback(true);
            return;
        }
        renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, quality === 'high' ? 1.7 : 1.4));
        renderer.setSize(width, height);
        renderer.setClearColor(0x000000, 0);
        renderer.outputColorSpace = THREE.SRGBColorSpace;
        renderer.toneMapping = THREE.ACESFilmicToneMapping;
        renderer.toneMappingExposure = 1.13;
        renderer.shadowMap.enabled = quality === 'high';
        renderer.shadowMap.type = THREE.PCFSoftShadowMap;
        const canvas = renderer.domElement;
        canvas.style.cssText = 'display:block;width:100%;height:100%;pointer-events:none;';
        canvas.setAttribute('aria-hidden', 'true');
        holder.appendChild(canvas);
        const scene = new THREE.Scene();
        const camera = variant === 'hero'
            ? new THREE.PerspectiveCamera(28, width / height, 0.1, 40)
            : new THREE.OrthographicCamera(-f.width / 2, f.width / 2, f.height / 2, -f.height / 2, 0.1, 40);
        camera.position.set(0, f.centerY, 10);
        camera.lookAt(0, f.centerY, 0);
        const projected = new THREE.Vector3();
        const project = (x, y, z = 0) => {
            projected.set(x, y, z).project(camera);
            return [(projected.x * 0.5 + 0.5) * width, (-projected.y * 0.5 + 0.5) * height];
        };
        const raycaster = new THREE.Raycaster();
        const plane = new THREE.Plane(new THREE.Vector3(0, 0, 1), 0);
        const point = new THREE.Vector3();
        const ndc = new THREE.Vector2();
        pointToAngle.current = (clientX, clientY) => {
            const rect = host.getBoundingClientRect();
            ndc.set((clientX - rect.left) / width * 2 - 1, -(clientY - rect.top) / height * 2 + 1);
            raycaster.setFromCamera(ndc, camera);
            if (!raycaster.ray.intersectPlane(plane, point))
                return live.current.stateRef.current.theta;
            return Math.atan2(point.x, PIVOT_Y - point.y);
        };
        let env;
        try {
            env = environment(renderer);
            scene.environment = env.texture;
        }
        catch { /* Direct lights remain functional. */ }
        scene.add(new THREE.HemisphereLight(0xfff4e0, 0xb9a48b, 2.2));
        const key = new THREE.DirectionalLight(0xffeed6, 4.5);
        key.position.set(-3, 5, 5);
        key.castShadow = true;
        key.shadow.mapSize.set(1024, 1024);
        key.shadow.camera.left = key.shadow.camera.bottom = -4;
        key.shadow.camera.right = key.shadow.camera.top = 4;
        key.shadow.normalBias = 0.02;
        key.shadow.bias = -0.0003;
        key.shadow.radius = 4;
        scene.add(key);
        const rim = new THREE.DirectionalLight(0xffd8dc, 1.5);
        rim.position.set(4, 2, 1);
        scene.add(rim);
        const brass = new THREE.MeshPhysicalMaterial({ color: '#b69251', metalness: 0.9, roughness: 0.24, clearcoat: 0.22, clearcoatRoughness: 0.28, envMapIntensity: 1.3 });
        const steel = new THREE.MeshStandardMaterial({ color: '#9ca9ae', metalness: 0.86, roughness: 0.36, envMapIntensity: 0.8 });
        const frameMetal = new THREE.MeshStandardMaterial({ color: '#a78a61', metalness: 0.68, roughness: 0.37, envMapIntensity: 0.6 });
        const darkMetal = new THREE.MeshStandardMaterial({ color: '#8b6d4b', metalness: 0.45, roughness: 0.43 });
        const groove = new THREE.MeshStandardMaterial({ color: '#7a5a2e', metalness: 0.7, roughness: 0.42 });
        const add = (geometry, material, x, y, z) => {
            const mesh = new THREE.Mesh(geometry, material);
            mesh.position.set(x, y, z);
            mesh.castShadow = true;
            mesh.receiveShadow = true;
            scene.add(mesh);
            return mesh;
        };
        // The gantry sits BEHIND the swing plane; it never intersects the bob's path.
        const beam = add(new THREE.CylinderGeometry(0.042, 0.042, 4.9, 24), frameMetal, 0, 3.035, -0.43);
        beam.rotation.z = Math.PI / 2;
        for (const x of [-2.32, 2.32]) {
            add(new THREE.CylinderGeometry(0.038, 0.048, 2.96, 20), frameMetal, x, 1.54, -0.43);
            add(new THREE.CylinderGeometry(0.24, 0.26, 0.055, 40), darkMetal, x, 0.085, -0.43);
            add(new THREE.CylinderGeometry(0.055, 0.055, 0.06, 24), brass, x, 2.98, -0.43);
        }
        const axle = add(new THREE.CylinderGeometry(0.044, 0.044, 0.64, 32), steel, 0, PIVOT_Y, -0.22);
        axle.rotation.x = Math.PI / 2;
        const bearing = add(new THREE.CylinderGeometry(0.105, 0.105, 0.11, 48), frameMetal, 0, PIVOT_Y, 0.015);
        bearing.rotation.x = Math.PI / 2;
        const washer = add(new THREE.CylinderGeometry(0.075, 0.075, 0.025, 48), brass, 0, PIVOT_Y, 0.08);
        washer.rotation.x = Math.PI / 2;
        const bolt = add(new THREE.CylinderGeometry(0.027, 0.027, 0.025, 6), steel, 0, PIVOT_Y, 0.104);
        bolt.rotation.x = Math.PI / 2;
        const swinging = new THREE.Group();
        swinging.position.set(0, PIVOT_Y, 0);
        scene.add(swinging);
        const filament = new THREE.Mesh(new THREE.CylinderGeometry(0.006, 0.006, 1, 12), steel);
        swinging.add(filament);
        const bobGroup = new THREE.Group();
        swinging.add(bobGroup);
        const bob = new THREE.Mesh(new THREE.SphereGeometry(BOB_RADIUS, 56, 40), brass);
        bob.castShadow = true;
        bobGroup.add(bob);
        const seam = new THREE.Mesh(new THREE.TorusGeometry(BOB_RADIUS * 0.997, 0.0011, 6, 96), groove);
        seam.rotation.x = Math.PI / 2;
        bobGroup.add(seam);
        const collar = new THREE.Mesh(new THREE.CylinderGeometry(0.024, 0.034, 0.039, 28), brass);
        collar.position.y = BOB_RADIUS - 0.008;
        bobGroup.add(collar);
        const eyelet = new THREE.Mesh(new THREE.TorusGeometry(0.016, 0.0045, 10, 28), steel);
        eyelet.position.y = BOB_RADIUS + 0.02;
        bobGroup.add(eyelet);
        // A subtle stage and a soft contact shadow ground the apparatus.
        const floor = add(new THREE.CircleGeometry(5.3, 96), new THREE.MeshStandardMaterial({ color: '#ede4d7', roughness: 0.94, metalness: 0.06, transparent: true, opacity: 1 }), 0, 0.045, -0.25);
        floor.rotation.x = -Math.PI / 2;
        floor.castShadow = false;
        // Sculpted limestone plinth and fine brass inlay. All authored geometry is local.
        const limestone = new THREE.MeshStandardMaterial({ color: '#e9ddc9', roughness: .88 });
        const plinth = add(new THREE.CylinderGeometry(3.15, 3.22, .13, 96), limestone, 0, -.04, -.35);
        const inset = add(new THREE.TorusGeometry(3.09, .007, 6, 128), brass, 0, .03, -.35);
        inset.rotation.x = -Math.PI / 2;
        const ghostGroup = new THREE.Group();
        ghostGroup.position.y = PIVOT_Y;
        scene.add(ghostGroup);
        const ghostMat = new THREE.MeshBasicMaterial({ color: '#ab5770', transparent: true, opacity: .30, depthWrite: false });
        const ghostWire = new THREE.Mesh(new THREE.CylinderGeometry(.0035, .0035, 1, 8), ghostMat);
        ghostGroup.add(ghostWire);
        const ghostBob = new THREE.Mesh(new THREE.SphereGeometry(BOB_RADIUS * .96, 24, 16), ghostMat);
        ghostGroup.add(ghostBob);
        const shadowTexture = softShadowTexture();
        const shadow = add(new THREE.PlaneGeometry(1.15, 0.7), new THREE.MeshBasicMaterial({ map: shadowTexture, transparent: true, opacity: 0.6, depthWrite: false }), 0, 0.05, 0);
        shadow.rotation.x = -Math.PI / 2;
        shadow.castShadow = false;
        for (const radius of [1.5, 2.3, 3.2]) {
            const ring = add(new THREE.TorusGeometry(radius, 0.002, 4, 128), new THREE.MeshBasicMaterial({ color: '#aa9784', transparent: true, opacity: 0.13 }), 0, 0.057, -0.2);
            ring.rotation.x = Math.PI / 2;
            ring.castShadow = false;
        }
        const guidePositions = new Float32Array(161 * 3);
        const guideGeometry = new THREE.BufferGeometry();
        guideGeometry.setAttribute('position', new THREE.BufferAttribute(guidePositions, 3));
        const guide = new THREE.Line(guideGeometry, new THREE.LineBasicMaterial({ color: '#a28b6a', transparent: true, opacity: 0.23, depthWrite: false }));
        scene.add(guide);
        const equilibriumGeometry = new THREE.BufferGeometry().setFromPoints([new THREE.Vector3(0, PIVOT_Y, -0.04), new THREE.Vector3(0, 0.4, -0.04)]);
        const equilibrium = new THREE.Line(equilibriumGeometry, new THREE.LineDashedMaterial({ color: '#756b5f', transparent: true, opacity: 0.23, dashSize: 0.035, gapSize: 0.045 }));
        equilibrium.computeLineDistances();
        scene.add(equilibrium);
        const anglePositions = new Float32Array(41 * 3);
        const angleGeometry = new THREE.BufferGeometry();
        angleGeometry.setAttribute('position', new THREE.BufferAttribute(anglePositions, 3));
        const angleArc = new THREE.Line(angleGeometry, new THREE.LineBasicMaterial({ color: '#8c6840', transparent: true, opacity: 0.6 }));
        scene.add(angleArc);
        const trailPositions = new Float32Array(100 * 3);
        const trailColors = new Float32Array(100 * 3);
        const trailGeometry = new THREE.BufferGeometry();
        trailGeometry.setAttribute('position', new THREE.BufferAttribute(trailPositions, 3));
        trailGeometry.setAttribute('color', new THREE.BufferAttribute(trailColors, 3));
        const trail = new THREE.Line(trailGeometry, new THREE.LineBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.48, depthWrite: false }));
        scene.add(trail);
        let history = [];
        let lastTime = -1, lastLength = -1;
        const gravityArrow = new THREE.ArrowHelper(new THREE.Vector3(0, -1, 0), new THREE.Vector3(), 0.55, 0xa54f69, 0.09, 0.055);
        const tensionArrow = new THREE.ArrowHelper(new THREE.Vector3(0, 1, 0), new THREE.Vector3(), 0.55, 0x447f77, 0.09, 0.055);
        scene.add(gravityArrow, tensionArrow);
        let lastFrame = '';
        const cameraStart = performance.now();
        const updateCamera = () => {
            const v = framing();
            const progress = live.current.reducedMotion ? 1 : Math.min(1, (performance.now() - cameraStart) / 1800);
            const ease = 1 - Math.pow(1 - progress, 3);
            const journey = live.current.reducedMotion ? 0 : (live.current.journeyRef?.current ?? 0);
            const signature = `${v.width}/${v.height}/${v.centerY}/${variant === 'hero' ? ease : 1}/${live.current.view}/${journey}`;
            if (signature === lastFrame)
                return;
            lastFrame = signature;
            if (camera instanceof THREE.PerspectiveCamera) {
                camera.aspect = width / height;
                const distance = v.height / (2 * Math.tan(camera.fov * DEG / 2)) * (1 - .07 * journey);
                camera.position.set(distance * (0.13 - 0.075 * ease - .03 * journey), v.centerY + distance * (0.09 - 0.055 * ease), distance);
            }
            else {
                camera.left = -v.width / 2;
                camera.right = v.width / 2;
                camera.top = v.height / 2;
                camera.bottom = -v.height / 2;
                camera.position.set(live.current.view === 'perspective' ? 2.5 : 0, v.centerY + (live.current.view === 'perspective' ? 1.0 : 0), 10);
            }
            camera.lookAt(0, v.centerY, 0);
            camera.updateProjectionMatrix();
            camera.updateMatrixWorld(true);
        };
        refreshRef.current = () => {
            updateCamera();
            updateLabels(project, live.current.stateRef.current.theta, live.current.parameters.length);
        };
        const resize = () => {
            width = Math.max(1, host.clientWidth);
            height = Math.max(1, host.clientHeight);
            updateCamera();
            renderer.setSize(width, height);
            release();
        };
        const draw = () => {
            if (destroyed)
                return;
            if (visible && !document.hidden) {
                const options = live.current;
                const { theta, omega, time } = options.stateRef.current;
                const { length, mass, gravity } = options.parameters;
                updateCamera();
                const { x, y } = pendulumBobPosition(length, theta);
                swinging.rotation.z = theta;
                ghostGroup.visible = !!options.showComparison;
                if (ghostGroup.visible) {
                    ghostGroup.rotation.z = linearReference(options.parameters, time).theta;
                    ghostWire.scale.y = length;
                    ghostWire.position.y = -length / 2;
                    ghostBob.position.y = -length;
                }
                filament.scale.y = length;
                filament.position.y = -length / 2;
                bobGroup.position.y = -length;
                shadow.position.x = x;
                shadow.scale.setScalar(0.8 + y * 0.3);
                if (length !== lastLength) {
                    for (let i = 0; i <= 160; i++) {
                        const a = (-80 + i) * DEG;
                        guidePositions[i * 3] = length * Math.sin(a);
                        guidePositions[i * 3 + 1] = PIVOT_Y - length * Math.cos(a);
                        guidePositions[i * 3 + 2] = -0.025;
                    }
                    guideGeometry.attributes.position.needsUpdate = true;
                    guideGeometry.computeBoundingSphere();
                    const p = equilibriumGeometry.attributes.position;
                    p.setXYZ(1, 0, PIVOT_Y - length - 0.12, -0.04);
                    p.needsUpdate = true;
                    equilibrium.computeLineDistances();
                    history = [];
                    lastLength = length;
                }
                const arcRadius = Math.min(0.31, length * 0.45);
                for (let i = 0; i <= 40; i++) {
                    const a = theta * i / 40;
                    anglePositions[i * 3] = arcRadius * Math.sin(a);
                    anglePositions[i * 3 + 1] = PIVOT_Y - arcRadius * Math.cos(a);
                    anglePositions[i * 3 + 2] = 0.02;
                }
                angleGeometry.attributes.position.needsUpdate = true;
                angleGeometry.computeBoundingSphere();
                if (time < lastTime)
                    history = [];
                if (Math.abs(time - lastTime) >= 1 / 60) {
                    history.push({ x, y, time });
                    if (history.length > 100)
                        history.shift();
                    history.forEach((p, i) => {
                        trailPositions[i * 3] = p.x;
                        trailPositions[i * 3 + 1] = p.y;
                        trailPositions[i * 3 + 2] = -0.02;
                        const fade = 0.18 + 0.82 * i / Math.max(1, history.length - 1);
                        trailColors[i * 3] = 0.78 * fade;
                        trailColors[i * 3 + 1] = 0.67 * fade;
                        trailColors[i * 3 + 2] = 0.45 * fade;
                    });
                    trailGeometry.attributes.position.needsUpdate = true;
                    trailGeometry.attributes.color.needsUpdate = true;
                    trailGeometry.setDrawRange(0, history.length);
                    trailGeometry.computeBoundingSphere();
                    lastTime = time;
                }
                guide.visible = options.showTrail !== false;
                trail.visible = options.showTrail !== false && !options.reducedMotion;
                gravityArrow.visible = tensionArrow.visible = Boolean(options.showForces);
                if (options.showForces) {
                    const weight = mass * gravity;
                    const tension = Math.max(0, mass * (gravity * Math.cos(theta) + length * omega * omega));
                    const scale = 0.65 / Math.max(weight, tension, 0.01);
                    gravityArrow.position.set(x, y, 0.17);
                    gravityArrow.setLength(Math.max(0.001, weight * scale), Math.min(0.08, weight * scale * 0.3), 0.045);
                    tensionArrow.position.set(x, y, 0.17);
                    tensionArrow.setDirection(new THREE.Vector3(-Math.sin(theta), Math.cos(theta), 0));
                    tensionArrow.setLength(Math.max(0.001, tension * scale), Math.min(0.08, tension * scale * 0.3), 0.045);
                }
                updateLabels(project, theta, length);
                try {
                    renderer.render(scene, camera);
                }
                catch {
                    setFallback(true);
                    return;
                }
            }
            raf = requestAnimationFrame(draw);
        };
        const lost = (event) => {
            event.preventDefault();
            release();
            setFallback(true);
        };
        canvas.addEventListener('webglcontextlost', lost);
        const resizeObserver = new ResizeObserver(resize);
        resizeObserver.observe(host);
        const observer = new IntersectionObserver(entries => { visible = entries[0].isIntersecting; if (visible)
            refreshRef.current(); }, { rootMargin: '80px' });
        observer.observe(host);
        window.addEventListener('blur', release);
        raf = requestAnimationFrame(draw);
        live.current.onReady?.('webgl');
        return () => {
            destroyed = true;
            refreshRef.current = () => { };
            cancelAnimationFrame(raf);
            resizeObserver.disconnect();
            observer.disconnect();
            window.removeEventListener('blur', release);
            canvas.removeEventListener('webglcontextlost', lost);
            disposeScene(scene);
            env?.dispose();
            shadowTexture.dispose();
            renderer.dispose();
            canvas.remove();
        };
        // Live state and callbacks are read through the ref; UI updates never recreate the scene.
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [fallback, variant, quality]);
    const labelStyle = { position: 'absolute', left: 0, top: 0, color: '#796b58', font: '11px ui-monospace, SFMono-Regular, Consolas, monospace', letterSpacing: '.03em', pointerEvents: 'none', whiteSpace: 'nowrap' };
    return (_jsxs("div", { ref: hostRef, className: `pendulum-scene pendulum-scene--${variant}`, "data-renderer": fallback ? 'svg' : 'webgl', style: { position: 'relative', width: '100%', height: '100%', minHeight: 240, overflow: 'hidden' }, children: [_jsx("div", { ref: canvasHostRef, style: { position: 'absolute', inset: 0 } }), fallback && (_jsxs(_Fragment, { children: [_jsxs("svg", { ref: fallbackViewRef, width: "100%", height: "100%", "aria-hidden": "true", style: { position: 'absolute', inset: 0, overflow: 'visible' }, children: [_jsxs("defs", { children: [_jsxs("radialGradient", { id: gradientId, cx: "30%", cy: "25%", r: "78%", children: [_jsx("stop", { offset: "0", stopColor: "#fff8df" }), _jsx("stop", { offset: ".17", stopColor: "#e5ca89" }), _jsx("stop", { offset: ".42", stopColor: "#b58d47" }), _jsx("stop", { offset: ".68", stopColor: "#8c642e" }), _jsx("stop", { offset: ".88", stopColor: "#4a351e" }), _jsx("stop", { offset: "1", stopColor: "#b48e4d" })] }), _jsxs("linearGradient", { id: `${gradientId}-steel`, x1: "0", y1: "0", x2: "0", y2: "1", children: [_jsx("stop", { offset: "0", stopColor: "#a68d69" }), _jsx("stop", { offset: ".16", stopColor: "#e7d2ae" }), _jsx("stop", { offset: ".26", stopColor: "#8b7049" }), _jsx("stop", { offset: ".65", stopColor: "#6c5639" }), _jsx("stop", { offset: ".92", stopColor: "#9b8059" }), _jsx("stop", { offset: "1", stopColor: "#c3ac85" })] }), _jsxs("linearGradient", { id: `${gradientId}-filament`, x1: "0", y1: "0", x2: "1", y2: "0", children: [_jsx("stop", { offset: "0", stopColor: "#647780" }), _jsx("stop", { offset: ".45", stopColor: "#d7dfdc" }), _jsx("stop", { offset: ".7", stopColor: "#8b9b9e" }), _jsx("stop", { offset: "1", stopColor: "#4b606b" })] }), _jsxs("linearGradient", { id: `${gradientId}-gold`, x1: "0", y1: "0", x2: "1", y2: "1", children: [_jsx("stop", { offset: "0", stopColor: "#67512e" }), _jsx("stop", { offset: ".28", stopColor: "#ead5a1" }), _jsx("stop", { offset: ".39", stopColor: "#ae8747" }), _jsx("stop", { offset: ".65", stopColor: "#d4b371" }), _jsx("stop", { offset: "1", stopColor: "#513c22" })] }), _jsxs("radialGradient", { id: `${gradientId}-bearing`, cx: "35%", cy: "22%", r: "85%", children: [_jsx("stop", { offset: "0", stopColor: "#d8c39c" }), _jsx("stop", { offset: ".4", stopColor: "#a38a60" }), _jsx("stop", { offset: ".8", stopColor: "#5f4b32" }), _jsx("stop", { offset: "1", stopColor: "#b09a76" })] }), _jsx("clipPath", { id: `${gradientId}-sphere`, children: _jsx("circle", { r: BOB_RADIUS }) }), _jsx("marker", { id: `${gradientId}-weight`, markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto", children: _jsx("path", { d: "M0,0 L6,3 L0,6 Z", fill: "#a54f69" }) }), _jsx("marker", { id: `${gradientId}-tension`, markerWidth: "6", markerHeight: "6", refX: "5", refY: "3", orient: "auto", children: _jsx("path", { d: "M0,0 L6,3 L0,6 Z", fill: "#447f77" }) })] }), variant === 'hero' ? (_jsxs("g", { children: [_jsx("path", { d: "M-1.25,-.55 V-3.07 H1.25 V-.55", stroke: "#b19a72", strokeWidth: ".034", fill: "none", opacity: ".55" }), _jsx("rect", { x: "-1.34", y: "-3.11", width: "2.68", height: ".08", rx: ".028", fill: `url(#${gradientId}-steel)` }), _jsx("path", { d: "M-1.3,-3.09 H1.3", stroke: "#e8d3ae", strokeWidth: ".003", opacity: ".6" }), _jsx("rect", { x: "-.12", y: "-3.105", width: ".24", height: ".105", rx: ".018", fill: `url(#${gradientId}-bearing)` }), _jsx("path", { d: "M-.07,-3.02 L-.053,-2.9 M.07,-3.02 L.053,-2.9", stroke: `url(#${gradientId}-steel)`, strokeWidth: ".025" }), [-1.22, 1.22].map(x => _jsxs("g", { children: [_jsx("rect", { x: x - .025, y: "-3.14", width: ".05", height: ".12", rx: ".009", fill: `url(#${gradientId}-gold)` }), _jsx("path", { d: `M${x - .012},-3.12 h.024`, stroke: "#f0d6a0", strokeWidth: ".003" })] }, x))] })) : (_jsx("path", { d: "M-2.32,-0.1 V-3.035 H2.32 V-0.1", stroke: "#a38c66", strokeWidth: ".028", fill: "none", opacity: ".65" })), _jsx("line", { ref: fallbackEquilibriumRef, x1: "0", y1: -PIVOT_Y, x2: "0", y2: "-1.58", stroke: "#657783", strokeWidth: ".005", strokeDasharray: ".025 .045", opacity: variant === 'hero' ? .25 : .5 }), _jsx("path", { ref: fallbackArcRef, fill: "none", stroke: "#b49b68", strokeWidth: variant === 'hero' ? .005 : .007, opacity: ".35" }), _jsx("line", { ref: fallbackRodRef, x1: "0", y1: -PIVOT_Y, x2: "0", y2: "-1.9", stroke: "#9b8c76", strokeWidth: ".009" }), _jsxs("g", { transform: `translate(0,${-PIVOT_Y})`, children: [_jsx("circle", { cx: ".012", cy: ".01", r: ".09", fill: "#665035", opacity: ".7" }), _jsx("circle", { r: ".087", fill: `url(#${gradientId}-bearing)`, stroke: "#b9a17b", strokeWidth: ".004" }), _jsx("circle", { r: ".062", fill: `url(#${gradientId}-gold)`, stroke: "#e8d19e", strokeWidth: ".002" }), _jsx("circle", { r: ".037", fill: `url(#${gradientId}-bearing)` }), _jsx("path", { d: "M-.018,-.004 L.017,.005", stroke: "#e9dcc3", strokeWidth: ".005", strokeLinecap: "round" })] }), _jsxs("g", { ref: fallbackGhostRef, opacity: "0", children: [_jsx("line", { x1: "0", y1: "0", x2: "0", y2: props.parameters.length, stroke: "#ab5770", strokeWidth: ".008", strokeDasharray: ".03 .03" }), _jsx("circle", { cx: "0", cy: props.parameters.length, r: BOB_RADIUS, fill: "#ab5770" })] }), _jsxs("g", { ref: fallbackBobRef, children: [_jsx("rect", { x: "-.019", y: "-.132", width: ".038", height: ".046", fill: `url(#${gradientId}-gold)`, rx: ".007" }), _jsx("path", { d: "M-.021,-.109 H.021", stroke: "#edd3a0", strokeWidth: ".003" }), _jsx("circle", { r: BOB_RADIUS, fill: `url(#${gradientId})`, stroke: "#dfc18b", strokeWidth: ".003" }), _jsxs("g", { clipPath: `url(#${gradientId}-sphere)`, children: [_jsx("ellipse", { cx: "-.043", cy: "-.025", rx: ".015", ry: ".065", transform: "rotate(20)", fill: "#fff8dd", opacity: ".22" }), _jsx("path", { d: "M-.079,-.052 Q-.054,-.097 .001,-.091", stroke: "#fff8dc", strokeWidth: ".006", fill: "none", strokeLinecap: "round", opacity: ".75" }), _jsx("ellipse", { cy: ".024", rx: BOB_RADIUS * .98, ry: ".012", fill: "none", stroke: "#634720", strokeWidth: ".0016", opacity: ".6" }), _jsx("path", { d: "M.046,.091 Q.091,.063 .1,.014", stroke: "#d8b776", strokeWidth: ".004", fill: "none", opacity: ".6" })] })] }), _jsx("path", { ref: fallbackGravityRef, fill: "none", stroke: "#a54f69", strokeWidth: ".014", markerEnd: `url(#${gradientId}-weight)` }), _jsx("path", { ref: fallbackTensionRef, fill: "none", stroke: "#447f77", strokeWidth: ".014", markerEnd: `url(#${gradientId}-tension)` })] }), _jsxs("div", { style: { position: 'absolute', left: 18, bottom: 16, color: '#5e564d', display: 'flex', alignItems: 'center', gap: 10, fontSize: 11 }, children: [_jsx("span", { children: "Diagram view \u00B7 same physics" }), _jsx("button", { type: "button", onClick: () => setFallback(false), style: { color: '#705734', background: 'transparent', border: '1px solid #63717a', borderRadius: 5, padding: '5px 8px', cursor: 'pointer' }, children: "Retry 3D" })] })] })), _jsx("div", { ref: lengthLabelRef, style: { ...labelStyle, opacity: variant === 'hero' ? 0.7 : 1 } }), _jsx("div", { ref: angleLabelRef, style: { ...labelStyle, color: '#896b42', opacity: variant === 'hero' ? 0.7 : 1 } }), _jsxs("div", { ref: forceLabelRef, "aria-hidden": !props.showForces, style: { position: 'absolute', left: 18, top: 18, fontSize: 11, lineHeight: 1.8, color: '#625b51', opacity: 0, pointerEvents: 'none' }, children: [_jsx("span", { style: { color: '#a54f69' }, children: "\u2193 Weight" }), _jsx("span", { style: { marginLeft: 16, color: '#447f77' }, children: "\u2197 Tension" }), _jsx("br", {}), "Weight and tension only \u00B7 common scale"] }), variant === 'lab' && (_jsx("button", { ref: bobHandleRef, type: "button", className: "pendulum-bob-handle", "aria-label": "Pendulum bob. Drag to set the release angle, or use the arrow keys.", "aria-pressed": held, title: "Drag the bob and release. Arrow keys adjust by 1\u00B0.", style: { position: 'absolute', top: 0, left: 0, width: 44, height: 44, border: 'none', padding: 0, borderRadius: '50%', background: 'transparent', cursor: held ? 'grabbing' : 'grab', touchAction: 'none', zIndex: 3 }, onPointerDown: event => {
                    if (interaction.current.pointerId !== -1 || event.button !== 0)
                        return;
                    event.preventDefault();
                    interaction.current.pointerId = event.pointerId;
                    interaction.current.offset = live.current.stateRef.current.theta - pointToAngle.current(event.clientX, event.clientY);
                    event.currentTarget.setPointerCapture(event.pointerId);
                    setHeld(true);
                    live.current.onGrab?.();
                }, onPointerMove: event => {
                    if (interaction.current.pointerId !== event.pointerId)
                        return;
                    event.preventDefault();
                    const degrees = (pointToAngle.current(event.clientX, event.clientY) + interaction.current.offset) / DEG;
                    live.current.onDrag?.(Math.max(-80, Math.min(80, degrees)));
                }, onPointerUp: event => { if (interaction.current.pointerId === event.pointerId)
                    release(); }, onPointerCancel: event => { if (interaction.current.pointerId === event.pointerId)
                    release(); }, onLostPointerCapture: release, onBlur: release, onKeyDown: event => {
                    const directions = { ArrowLeft: -1, ArrowRight: 1, ArrowDown: -1, ArrowUp: 1 };
                    if (event.key in directions) {
                        event.preventDefault();
                        if (!interaction.current.keyboardHeld)
                            live.current.onGrab?.();
                        live.current.onDrag?.(Math.max(-80, Math.min(80, live.current.stateRef.current.theta / DEG + directions[event.key] * (event.shiftKey ? 5 : 1))));
                        if (!interaction.current.keyboardHeld)
                            live.current.onRelease?.();
                    }
                    else if (event.key === ' ' || event.key === 'Enter') {
                        event.preventDefault();
                        if (event.repeat)
                            return;
                        if (interaction.current.keyboardHeld)
                            release();
                        else {
                            interaction.current.keyboardHeld = true;
                            setHeld(true);
                            live.current.onGrab?.();
                        }
                    }
                    else if (event.key === 'Escape')
                        release();
                }, onFocus: event => { event.currentTarget.style.boxShadow = '0 0 0 2px #f3d28c, 0 0 0 5px #faf5ed'; }, onBlurCapture: event => { event.currentTarget.style.boxShadow = 'none'; } }))] }));
}
