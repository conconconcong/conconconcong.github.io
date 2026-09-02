(() => {
  "use strict";

  const STAGE_WIDTH = 1600;
  const STAGE_HEIGHT = 900;
  const pdfExportMode = new URLSearchParams(window.location.search).has("pdf");
  if (pdfExportMode) document.body.classList.add("pdf-export");
  const reducedMotion = window.matchMedia("(prefers-reduced-motion: reduce)").matches;
  const finePointer = window.matchMedia("(pointer: fine)").matches;
  const stage = document.querySelector("#stage");
  const slides = [...document.querySelectorAll(".slide")];
  const prevButton = document.querySelector("#prev");
  const nextButton = document.querySelector("#next");
  const counter = document.querySelector("#counter");
  const progress = document.querySelector("#progress");
  const speakerToggle = document.querySelector("#speaker-toggle");
  const speakerCurrent = document.querySelector("#speaker-current");
  const speakerNext = document.querySelector("#speaker-next");
  const speakerStepLabel = document.querySelector("#speaker-step");
  const cover = document.querySelector(".cover-materials");
  const transitionCurtain = document.querySelector("#transition-curtain");
  const mobileFullscreen = document.querySelector("#mobile-fullscreen");
  let currentSlide = Math.max(0, slides.findIndex((slide) => slide.classList.contains("active")));
  let slideLocked = false;
  let wheelLocked = false;
  let speakerMode = !pdfExportMode;
  let speakerStep = 0;
  if (!pdfExportMode) {
    try { speakerMode = window.localStorage.getItem("ai-visual-speaker-mode") !== "off"; } catch {}
  }

  function populateDots(container, count, prefix) {
    if (!container) return;
    const fragment = document.createDocumentFragment();
    for (let index = 0; index < count; index += 1) {
      const dot = document.createElement("i");
      dot.style.setProperty(`--${prefix}-delay`, `${-(index % 23) * 0.13}s`);
      dot.style.setProperty(`--${prefix}-scale`, String(0.58 + ((index * 7) % 9) * 0.07));
      fragment.appendChild(dot);
    }
    container.appendChild(fragment);
  }

  populateDots(document.querySelector(".visual-dot-art"), 240, "visual-dot");
  document.querySelectorAll(".workflow-dot-field").forEach((field) => populateDots(field, 240, "flow-dot"));
  populateDots(document.querySelector(".creative-dot-field"), 220, "flow-dot");
  populateDots(document.querySelector(".video-dot-field"), 240, "flow-dot");
  populateDots(document.querySelector(".video-section-art"), 240, "flow-dot");
  document.querySelectorAll(".cover-dot-grid").forEach((grid) => {
    const count = Number.parseInt(grid.dataset.matrixCount || "80", 10);
    populateDots(grid, count, "cover-dot");
  });

  function initCoverShaders() {
    const canvases = [...document.querySelectorAll(".cover-shader")];
    if (!canvases.length) return;

    const vertexSource = `
      attribute vec2 a_position;
      varying vec2 v_uv;
      void main() {
        v_uv = a_position * 0.5 + 0.5;
        gl_Position = vec4(a_position, 0.0, 1.0);
      }
    `;
    const fragmentSource = `
      precision mediump float;
      varying vec2 v_uv;
      uniform vec2 u_resolution;
      uniform float u_time;
      uniform float u_variant;

      float hash(vec2 point) {
        return fract(sin(dot(point, vec2(127.1, 311.7))) * 43758.5453123);
      }
      float segmentMask(vec2 point, vec2 start, vec2 end, float width) {
        vec2 line = end - start;
        float amount = clamp(dot(point - start, line) / max(dot(line, line), 0.0001), 0.0, 1.0);
        float distanceToLine = length(point - (start + line * amount));
        return 1.0 - smoothstep(width * 0.28, width, distanceToLine);
      }
      void main() {
        vec2 uv = v_uv;
        float aspect = u_resolution.x / max(u_resolution.y, 1.0);
        vec2 point = (uv - 0.5) * vec2(aspect, 1.0);
        float time = u_time * 0.16;
        vec2 flow = point;
        flow.x += 0.13 * sin(point.y * 3.1 - time * 1.15) + 0.05 * sin(point.y * 8.3 + time * 0.6);
        flow.y += 0.11 * cos(point.x * 2.7 + time * 0.85) + 0.04 * cos(point.x * 7.4 - time * 0.5);

        float ribbonA = sin((flow.x * 0.9 + flow.y * 1.15) * 6.4 + 1.35 * sin(flow.y * 3.4 - time * 0.8) + time);
        float ribbonB = sin((flow.x * 1.35 - flow.y * 0.7) * 10.2 - time * 0.65 + 0.8 * cos(flow.x * 4.5 + time * 0.4));
        float field = ribbonA * 0.72 + ribbonB * 0.28;
        float body = 0.5 + 0.5 * field;
        float fold = pow(max(0.0, 1.0 - abs(field)), 10.0);
        float fineFold = pow(max(0.0, 1.0 - abs(ribbonB)), 12.0);
        float vignette = smoothstep(1.02, 0.14, length(point * vec2(0.86, 1.08)));
        vec3 color;

        if (u_variant < 0.5) {
          vec3 black = vec3(0.004, 0.005, 0.008);
          vec3 graphite = vec3(0.075, 0.078, 0.086);
          vec3 chrome = vec3(0.66, 0.68, 0.72);
          vec3 coldBlue = vec3(0.07, 0.08, 0.13);
          color = mix(black, graphite, smoothstep(0.06, 0.94, body) * 0.78);
          color += chrome * fold * 0.42;
          color += coldBlue * (fineFold * 0.16 + pow(body, 4.0) * 0.12);
        } else if (u_variant < 1.5) {
          vec2 treePoint = point;
          treePoint.y += 0.03 * sin(treePoint.x * 4.0 - time * 0.7);
          float sway = 0.055 * sin(time * 0.72);
          vec2 p0 = vec2(-0.92, -0.06);
          vec2 p1 = vec2(-0.43, -0.02);
          vec2 p2 = vec2(0.12, 0.04 + sway * 0.25);
          vec2 p3 = vec2(0.78, 0.12 + sway);
          float core = 0.0;
          float glow = 0.0;

          core = max(core, segmentMask(treePoint, p0, p1, 0.058));
          core = max(core, segmentMask(treePoint, p1, p2, 0.047));
          core = max(core, segmentMask(treePoint, p2, p3, 0.035));
          core = max(core, segmentMask(treePoint, p1, vec2(-0.18, 0.36 + sway), 0.027));
          core = max(core, segmentMask(treePoint, vec2(-0.18, 0.36 + sway), vec2(-0.38, 0.66 + sway), 0.016));
          core = max(core, segmentMask(treePoint, vec2(-0.18, 0.36 + sway), vec2(0.06, 0.67 + sway * 0.7), 0.015));
          core = max(core, segmentMask(treePoint, vec2(-0.12, 0.01), vec2(0.08, -0.36 - sway), 0.025));
          core = max(core, segmentMask(treePoint, vec2(0.08, -0.36 - sway), vec2(-0.1, -0.67 - sway), 0.014));
          core = max(core, segmentMask(treePoint, vec2(0.08, -0.36 - sway), vec2(0.36, -0.64 - sway * 0.7), 0.014));
          core = max(core, segmentMask(treePoint, p2, vec2(0.4, 0.4 + sway), 0.024));
          core = max(core, segmentMask(treePoint, vec2(0.4, 0.4 + sway), vec2(0.24, 0.7 + sway), 0.013));
          core = max(core, segmentMask(treePoint, vec2(0.4, 0.4 + sway), vec2(0.68, 0.64 + sway * 0.8), 0.013));
          core = max(core, segmentMask(treePoint, vec2(0.38, 0.08), vec2(0.64, -0.28 - sway), 0.021));
          core = max(core, segmentMask(treePoint, vec2(0.64, -0.28 - sway), vec2(0.84, -0.5 - sway), 0.012));
          core = max(core, segmentMask(treePoint, vec2(0.64, -0.28 - sway), vec2(0.48, -0.64 - sway * 0.8), 0.012));
          core = max(core, segmentMask(treePoint, p3, vec2(0.9, 0.36 + sway), 0.014));

          glow = max(glow, segmentMask(treePoint, p0, p1, 0.14));
          glow = max(glow, segmentMask(treePoint, p1, p2, 0.12));
          glow = max(glow, segmentMask(treePoint, p2, p3, 0.095));
          glow = max(glow, segmentMask(treePoint, p1, vec2(-0.18, 0.36 + sway), 0.08));
          glow = max(glow, segmentMask(treePoint, vec2(-0.18, 0.36 + sway), vec2(-0.38, 0.66 + sway), 0.055));
          glow = max(glow, segmentMask(treePoint, vec2(-0.18, 0.36 + sway), vec2(0.06, 0.67 + sway * 0.7), 0.05));
          glow = max(glow, segmentMask(treePoint, vec2(-0.12, 0.01), vec2(0.08, -0.36 - sway), 0.075));
          glow = max(glow, segmentMask(treePoint, vec2(0.08, -0.36 - sway), vec2(-0.1, -0.67 - sway), 0.05));
          glow = max(glow, segmentMask(treePoint, vec2(0.08, -0.36 - sway), vec2(0.36, -0.64 - sway * 0.7), 0.05));
          glow = max(glow, segmentMask(treePoint, p2, vec2(0.4, 0.4 + sway), 0.07));
          glow = max(glow, segmentMask(treePoint, vec2(0.4, 0.4 + sway), vec2(0.24, 0.7 + sway), 0.046));
          glow = max(glow, segmentMask(treePoint, vec2(0.4, 0.4 + sway), vec2(0.68, 0.64 + sway * 0.8), 0.046));
          glow = max(glow, segmentMask(treePoint, vec2(0.38, 0.08), vec2(0.64, -0.28 - sway), 0.065));
          glow = max(glow, segmentMask(treePoint, vec2(0.64, -0.28 - sway), vec2(0.84, -0.5 - sway), 0.044));
          glow = max(glow, segmentMask(treePoint, vec2(0.64, -0.28 - sway), vec2(0.48, -0.64 - sway * 0.8), 0.044));
          glow = max(glow, segmentMask(treePoint, p3, vec2(0.9, 0.36 + sway), 0.048));

          vec3 branchBlack = vec3(0.003, 0.004, 0.007);
          vec3 branchGlow = vec3(0.12, 0.16, 0.44);
          vec3 branchLight = vec3(0.72, 0.78, 1.0);
          float pulse = 0.82 + 0.18 * sin(time * 1.4 + treePoint.y * 7.0);
          color = branchBlack + branchGlow * glow * 0.5;
          color += branchLight * core * pulse;
        } else {
          vec3 pearlShadow = vec3(0.52, 0.59, 0.82);
          vec3 pearl = vec3(0.92, 0.94, 1.0);
          vec3 ice = vec3(1.0, 1.0, 1.0);
          vec3 lilac = vec3(0.69, 0.67, 1.0);
          float radius = length(point * vec2(0.9, 1.12));
          float angle = atan(point.y, point.x);
          float orbitA = sin(radius * 18.0 - time * 1.5 + sin(angle * 3.0 + time) * 1.6);
          float orbitB = sin(radius * 10.0 + angle * 4.0 - time * 0.7);
          float orbitBody = 0.5 + 0.5 * (orbitA * 0.68 + orbitB * 0.32);
          float caustic = pow(max(0.0, 1.0 - abs(orbitA)), 9.0);
          float orbitLine = pow(max(0.0, 1.0 - abs(orbitB)), 13.0);
          color = mix(pearlShadow, pearl, smoothstep(0.02, 0.98, orbitBody));
          color = mix(color, lilac, orbitLine * 0.2);
          color += ice * caustic * 0.28;
        }

        float grain = hash(gl_FragCoord.xy + vec2(u_time * 37.0, -u_time * 19.0)) - 0.5;
        color *= 0.76 + vignette * 0.28;
        color += grain * (u_variant < 0.5 ? 0.018 : 0.014);
        gl_FragColor = vec4(color, 1.0);
      }
    `;

    const compileShader = (gl, type, source) => {
      const shader = gl.createShader(type);
      gl.shaderSource(shader, source);
      gl.compileShader(shader);
      if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
        gl.deleteShader(shader);
        return null;
      }
      return shader;
    };

    const instances = canvases.map((canvas) => {
      const gl = canvas.getContext("webgl", {
        alpha: false,
        antialias: false,
        depth: false,
        powerPreference: "high-performance",
        preserveDrawingBuffer: false,
      });
      if (!gl) {
        canvas.classList.add("is-fallback");
        return null;
      }

      const vertexShader = compileShader(gl, gl.VERTEX_SHADER, vertexSource);
      const fragmentShader = compileShader(gl, gl.FRAGMENT_SHADER, fragmentSource);
      if (!vertexShader || !fragmentShader) {
        canvas.classList.add("is-fallback");
        return null;
      }

      const program = gl.createProgram();
      gl.attachShader(program, vertexShader);
      gl.attachShader(program, fragmentShader);
      gl.linkProgram(program);
      gl.deleteShader(vertexShader);
      gl.deleteShader(fragmentShader);
      if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
        gl.deleteProgram(program);
        canvas.classList.add("is-fallback");
        return null;
      }

      gl.useProgram(program);
      const buffer = gl.createBuffer();
      gl.bindBuffer(gl.ARRAY_BUFFER, buffer);
      gl.bufferData(gl.ARRAY_BUFFER, new Float32Array([-1, -1, 1, -1, -1, 1, 1, 1]), gl.STATIC_DRAW);
      const position = gl.getAttribLocation(program, "a_position");
      gl.enableVertexAttribArray(position);
      gl.vertexAttribPointer(position, 2, gl.FLOAT, false, 0, 0);

      return {
        canvas,
        gl,
        program,
        time: gl.getUniformLocation(program, "u_time"),
        resolution: gl.getUniformLocation(program, "u_resolution"),
        variant: gl.getUniformLocation(program, "u_variant"),
        variantValue: Number.parseFloat(canvas.dataset.shaderVariant || "0"),
      };
    }).filter(Boolean);

    const resize = (instance) => {
      const { canvas, gl, program } = instance;
      const pixelRatio = Math.min(1, window.devicePixelRatio || 1);
      const width = Math.max(2, Math.round(canvas.clientWidth * pixelRatio));
      const height = Math.max(2, Math.round(canvas.clientHeight * pixelRatio));
      if (canvas.width !== width || canvas.height !== height) {
        canvas.width = width;
        canvas.height = height;
      }
      gl.viewport(0, 0, width, height);
      gl.useProgram(program);
      gl.uniform2f(instance.resolution, width, height);
      gl.uniform1f(instance.variant, instance.variantValue);
    };

    const draw = (instance, seconds) => {
      const { gl } = instance;
      gl.uniform1f(instance.time, seconds);
      gl.drawArrays(gl.TRIANGLE_STRIP, 0, 4);
    };

    instances.forEach(resize);
    let resizeFrame = 0;
    window.addEventListener("resize", () => {
      if (resizeFrame) return;
      resizeFrame = window.requestAnimationFrame(() => {
        resizeFrame = 0;
        instances.forEach(resize);
      });
    }, { passive: true });

    if (reducedMotion) {
      instances.forEach((instance) => draw(instance, 8.0));
      return;
    }

    const frameInterval = 1000 / 20;
    const idleInterval = 180;
    const render = (now) => {
      let hasActiveCanvas = false;
      if (!document.hidden) {
        instances.forEach((instance) => {
          const isActive = instance.canvas.closest(".slide")?.classList.contains("active");
          if (isActive) {
            hasActiveCanvas = true;
            if (!instance.wasActive) resize(instance);
            draw(instance, now * 0.001);
          }
          instance.wasActive = isActive;
        });
      }
      window.setTimeout(
        () => window.requestAnimationFrame(render),
        hasActiveCanvas ? frameInterval : idleInterval
      );
    };
    window.requestAnimationFrame(render);
  }

  initCoverShaders();

  if (reducedMotion) {
    document.querySelectorAll(".prompt-triangles animate").forEach((animation) => animation.remove());
  }

  function appendShapeDot(container, x, y, index, size = 7) {
    if (!container) return;
    const dot = document.createElement("i");
    dot.style.setProperty("--dot-x", `${x.toFixed(2)}%`);
    dot.style.setProperty("--dot-y", `${y.toFixed(2)}%`);
    dot.style.setProperty("--dot-size", `${size}px`);
    dot.style.setProperty("--dot-delay", `${-(index % 29) * 0.11}s`);
    container.appendChild(dot);
  }

  const infinityDots = document.querySelector(".infinity-dot-art");
  let shapeDotIndex = 0;
  for (let band = -4; band <= 4; band += 1) {
    for (let step = 0; step < 72; step += 1) {
      const t = (step / 72) * Math.PI * 2;
      const x = 50 + 39 * Math.sin(t) + band * 1.45 * Math.cos(t);
      const y = 50 + 26 * Math.sin(t * 2) + band * 1.45 * Math.cos(t * 2);
      appendShapeDot(infinityDots, x, y, shapeDotIndex, 5 + (shapeDotIndex % 3));
      shapeDotIndex += 1;
    }
  }

  const arrowDots = document.querySelector(".arrow-dot-art");
  shapeDotIndex = 0;
  for (let y = 7; y <= 68; y += 4) {
    for (let x = 46; x <= 54; x += 4) {
      appendShapeDot(arrowDots, x, y, shapeDotIndex, 5 + (shapeDotIndex % 3));
      shapeDotIndex += 1;
    }
  }
  for (let y = 53; y <= 93; y += 4) {
    const halfWidth = (93 - y) * 0.92;
    for (let x = 50 - halfWidth; x <= 50 + halfWidth; x += 5) {
      appendShapeDot(arrowDots, x, y, shapeDotIndex, 5 + (shapeDotIndex % 3));
      shapeDotIndex += 1;
    }
  }

  const playDots = document.querySelector(".play-dot-art");
  shapeDotIndex = 0;
  for (let column = 0; column < 35; column += 1) {
    const x = 10 + column * 2.25;
    const progress = column / 34;
    const halfHeight = 6 + (1 - progress) * 37 - Math.pow(Math.abs(progress - 0.08), .75) * 3;
    for (let y = 50 - halfHeight; y <= 50 + halfHeight; y += 3.1) {
      appendShapeDot(playDots, x, y, shapeDotIndex, 5 + (shapeDotIndex % 3));
      shapeDotIndex += 1;
    }
  }

  document.querySelectorAll(".tool-brand img").forEach((icon) => {
    icon.addEventListener("error", () => { icon.hidden = true; });
  });

  const videoBackground = document.querySelector("#video-background");
  const videoUploadInput = document.querySelector("#video-upload-input");
  let uploadedVideoUrl = "";
  videoUploadInput?.addEventListener("change", () => {
    const file = videoUploadInput.files?.[0];
    if (!file || !videoBackground) return;
    if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
    uploadedVideoUrl = URL.createObjectURL(file);
    videoBackground.src = uploadedVideoUrl;
    videoBackground.load();
    videoBackground.play().catch(() => {});
    videoBackground.closest(".slide")?.classList.add("has-video-background");
  });
  window.addEventListener("beforeunload", () => {
    if (uploadedVideoUrl) URL.revokeObjectURL(uploadedVideoUrl);
  });

  const managedVideos = [...document.querySelectorAll("video")];
  function syncSlideMedia() {
    managedVideos.forEach((video) => {
      const shouldPlay = !document.hidden && video.closest(".slide")?.classList.contains("active");
      if (shouldPlay) video.play().catch(() => {});
      else video.pause();
    });
  }

  const EDIT_STORAGE_KEY = "ai-visual-sharing-refined-v3";
  const editToggle = document.querySelector("#edit-toggle");
  const editSave = document.querySelector("#edit-save");
  const editExport = document.querySelector("#edit-export");
  const editReset = document.querySelector("#edit-reset");
  const editStatus = document.querySelector("#edit-status");
  const editableElements = [...document.querySelectorAll([
    ".slide h1", ".slide h2", ".slide h3", ".slide p", ".slide li", ".slide small", ".slide figcaption",
    ".slide .big-label", ".slide .section-no", ".slide .section-kicker",
    ".index-item b", ".index-item span", ".tool-node b", ".tool-node > span:not(.tool-brand)", ".system-hub",
    ".prompt-center-label", ".prompt-node b", ".prompt-node span", ".skill-strip b", ".skill-strip span",
    ".workflow-bubble", ".workflow-track b", ".workflow-track span",
    ".boundary-col > span", ".boundary-core", ".boundary-solution-grid b", ".boundary-decision span", ".boundary-decision strong",
    ".application-metrics b", ".application-metrics span", ".reuse-list span",
    ".video-track b", ".video-track span", ".fragment-cloud span", ".fragment-hub",
    ".video-prompt b", ".video-prompt span", ".effect-banner b", ".effect-banner span", ".effect-methods strong", ".sprite-tool-flow span",
    ".delivery-panel > span", ".motion-node", ".motion-hub", ".web-skill-flow b", ".web-skill-flow span",
    ".final-values span", ".final-path span", ".final-row em", ".final-row strong", ".final-statement", ".browse-link", ".orchestrator-notes strong",
    ".transcript-key blockquote", ".transcript-key > span", ".transcript-key > strong",
    ".era-track b", ".shift-statement span", ".shift-statement strong",
    ".abstract-cloud span", ".conversion-core strong", ".reference-result span", ".reference-result strong",
    ".skill-input b", ".skill-engine span", ".skill-engine strong",
    ".brand-core strong", ".brand-items span", ".fact-line b", ".fact-line span",
    ".template-grid b", ".material-season-layout figcaption b", ".material-season-layout figcaption span", ".material-copy strong",
    ".vertical-process b", ".vertical-process span", ".debug-note strong",
    ".problem-field span", ".unstable-output span", ".unstable-output strong", ".stable-output b",
    ".demo-layout blockquote", ".demo-steps span", ".candidate-side b",
    ".video-full-flow span", ".case-facts b", ".storyboard-wall span", ".check-list b",
    ".prompt-context span", ".prompt-focus b", ".motion-before-after small", ".motion-quote",
    ".delivery-visual strong", ".delivery-process span", ".delivery-process strong", ".sprite-tool span", ".sprite-tool strong",
    ".knowledge-sources span", ".knowledge-core strong", ".web-motion-preview strong", ".web-motion-usecases span",
    ".web-motion-statement span", ".web-motion-statement strong", ".efficiency-field span", ".summary-center del", ".summary-center strong",
    ".value-row span", ".team-sharing span", ".cover-credit"
    , ".v3-title-line span", ".v3-title-line em", ".v3-title-line b", ".v3-section-sub",
    ".v3-shift-center span", ".v3-shift-center strong", ".v3-reference-result",
    ".v3-skill-shot span", ".v3-skill-shot strong", ".v3-skill-shot em", ".v3-brand-note", ".v3-brand-chip",
    ".v3-workflow-track b", ".v3-workflow-track span", ".v3-skill-octagon strong", ".v3-skill-octagon li",
    ".v3-problem-cluster span", ".v3-problem-bar", ".v3-inside-modules span", ".v3-inside-modules strong",
    ".v3-decision-line", ".v3-demo-slide blockquote span", ".v3-demo-steps span", ".v3-skill-links span", ".v3-seven-flow b",
    ".v3-case-bar span", ".v3-case-bar strong", ".v3-video-core strong", ".browser-canvas b", ".browser-canvas strong", ".v3-marquee-row span",
    ".v3-summary-bar strong", ".v3-summary-bar del"
  ].join(","))].filter((element) => !element.closest("[data-static-copy]"));

  editableElements.forEach((element, index) => {
    element.dataset.editId = `copy-${String(index + 1).padStart(3, "0")}`;
  });

  try {
    const defaultCopy = window.__DEFAULT_EDIT_COPY__ && typeof window.__DEFAULT_EDIT_COPY__ === "object"
      ? window.__DEFAULT_EDIT_COPY__
      : {};
    const browserCopy = JSON.parse(window.localStorage.getItem(EDIT_STORAGE_KEY) || "{}");
    let migratedBrowserCopy = false;
    const migrateCopy = (id, shouldMigrate) => {
      const value = browserCopy[id];
      if (typeof value === "string" && shouldMigrate(value) && typeof defaultCopy[id] === "string") {
        browserCopy[id] = defaultCopy[id];
        migratedBrowserCopy = true;
      }
    };
    migrateCopy("copy-080", (value) => value.trim() === "SKILL SCREENSHOT");
    migrateCopy("copy-081", (value) => /后续替换|参考图\s*\+\s*要求/.test(value));
    migrateCopy("copy-083", (value) => /输入一张参考图|反推生图\s*Prompt/.test(value));
    migrateCopy("copy-161", (value) => /处暑|现场演示/.test(value));
    migrateCopy("copy-162", (value) => /夏天乘凉/.test(value));
    migrateCopy("copy-163", (value) => /秋天的气息/.test(value));
    migrateCopy("copy-003", (value) => ["视觉生产", "视觉设计"].includes(value.trim()));
    migrateCopy("copy-006", (value) => value.trim() === "AI 视觉生产规范化");
    migrateCopy("copy-018", (value) => /视觉生产/.test(value));
    migrateCopy("copy-002", (value) => ["如何改变", "如何重塑"].includes(value.trim()));
    migrateCopy("copy-004", (value) => value.trim() === "产品表达");
    migrateCopy("copy-006", (value) => value.trim() === "AI 视觉设计规范化");
    migrateCopy("copy-007", (value) => /统筹者.*Prompt.*参考图/.test(value));
    migrateCopy("copy-009", (value) => value.trim() === "TO SKILL");
    migrateCopy("copy-010", (value) => /工作流.*案例.*Skill/i.test(value));
    migrateCopy("copy-012", (value) => value.trim() === "AI 视频");
    migrateCopy("copy-013", (value) => /脚本.*分镜.*设定.*生成/.test(value));
    migrateCopy("copy-015", (value) => value.trim() === "落地变革");
    migrateCopy("copy-016", (value) => /动效创变.*Lottie.*Sprite/i.test(value));
    migrateCopy("copy-018", (value) => /AI\s*<span[^>]*>视觉设计<\/span>规范化/.test(value));
    migrateCopy("copy-019", (value) => /统筹者.*Prompt.*参考图/.test(value));
    migrateCopy("copy-085", (value) => /工作流<\/span>\s*TO SKILL/.test(value));
    migrateCopy("copy-086", (value) => /宠物险节气海报.*Prompt 模板.*Skill/.test(value));
    migrateCopy("copy-175", (value) => /AI 视频<\/span>创作/.test(value));
    migrateCopy("copy-176", (value) => /大纲.*脚本.*分镜.*设定.*生成/.test(value));
    migrateCopy("copy-238", (value) => /AI 动效<\/span>创作与交付/.test(value));
    migrateCopy("copy-239", (value) => /效果创变.*Lottie.*Sprite/.test(value));
    migrateCopy("copy-305", (value) => /AI 之前|更多时间用于完成视觉/.test(value));
    migrateCopy("copy-306", (value) => value.trim() === "AI 之前");
    migrateCopy("copy-307", (value) => /更多时间用于完成视觉/.test(value));
    migrateCopy("copy-308", (value) => value.trim() === "AI 之后");
    migrateCopy("copy-309", (value) => /更多时间用于思考体验/.test(value));
    migrateCopy("copy-310", (value) => value.trim() === "视觉设计");
    migrateCopy("copy-311", (value) => value.trim() === "体验设计");
    migrateCopy("copy-312", (value) => value.trim() === "团队协作");
    migrateCopy("copy-313", (value) => value.trim() === "业务价值");
    if (migratedBrowserCopy) {
      window.localStorage.setItem(EDIT_STORAGE_KEY, JSON.stringify(browserCopy));
    }
    const savedCopy = { ...defaultCopy, ...browserCopy };
    editableElements.forEach((element) => {
      if (typeof savedCopy[element.dataset.editId] === "string") {
        element.innerHTML = savedCopy[element.dataset.editId];
      }
    });
  } catch {
    window.localStorage.removeItem(EDIT_STORAGE_KEY);
  }

  const codeCopyButton = document.querySelector("#v3-code-copy");
  codeCopyButton?.addEventListener("click", async () => {
    const codeText = document.querySelector(".v3-skill-copy")?.textContent?.trim() || "";
    let copied = false;
    try {
      await navigator.clipboard.writeText(codeText);
      copied = true;
    } catch {}
    if (!copied) {
      const textarea = document.createElement("textarea");
      textarea.value = codeText;
      textarea.setAttribute("readonly", "");
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      try { copied = document.execCommand("copy"); } catch {}
      textarea.remove();
    }
    codeCopyButton.textContent = copied ? "已复制" : "请手动复制";
    window.setTimeout(() => { codeCopyButton.textContent = "复制代码"; }, 1600);
  });

  function fitStage() {
    const scale = Math.min(window.innerWidth / STAGE_WIDTH, window.innerHeight / STAGE_HEIGHT);
    stage.style.transform = `translate(-50%, -50%) scale(${scale})`;
  }

  function getSpeakerParagraphs() {
    return [...(slides[currentSlide]?.querySelectorAll(".transcript-copy > p") || [])];
  }

  function updateSpeakerFocus(reset = false) {
    const paragraphs = getSpeakerParagraphs();
    if (reset) speakerStep = 0;
    speakerStep = Math.max(0, Math.min(speakerStep, Math.max(0, paragraphs.length - 1)));
    document.querySelectorAll(".transcript-copy > p.is-speaking, .transcript-copy > p.is-spoken").forEach((paragraph) => {
      paragraph.classList.remove("is-speaking", "is-spoken");
    });
    if (speakerMode && paragraphs.length) {
      paragraphs.forEach((paragraph, index) => {
        paragraph.classList.toggle("is-speaking", index === speakerStep);
        paragraph.classList.toggle("is-spoken", index < speakerStep);
      });
      if (speakerStepLabel) speakerStepLabel.textContent = `段落 ${String(speakerStep + 1).padStart(2,"0")} / ${String(paragraphs.length).padStart(2,"0")}`;
    } else if (speakerStepLabel) {
      speakerStepLabel.textContent = paragraphs.length ? "完整讲稿" : "视觉页";
    }
  }

  function setSpeakerMode(enabled, persist = true) {
    speakerMode = enabled;
    document.body.classList.toggle("speaker-mode", enabled);
    speakerToggle?.setAttribute("aria-pressed", String(enabled));
    if (speakerToggle) speakerToggle.textContent = enabled ? "退出讲述" : "讲述模式";
    if (persist) {
      try { window.localStorage.setItem("ai-visual-speaker-mode", enabled ? "on" : "off"); } catch {}
    }
    updateSpeakerFocus(true);
  }

  speakerToggle?.addEventListener("click", () => setSpeakerMode(!speakerMode));
  document.querySelectorAll(".transcript-copy > p").forEach((paragraph) => {
    paragraph.addEventListener("click", () => {
      if (!speakerMode || !paragraph.closest(".slide")?.classList.contains("active")) return;
      speakerStep = getSpeakerParagraphs().indexOf(paragraph);
      updateSpeakerFocus();
    });
  });

  function updateReadout() {
    const now = String(currentSlide + 1).padStart(2, "0");
    const total = String(slides.length).padStart(2, "0");
    counter.textContent = `${now} / ${total}`;
    progress.style.transform = `scaleX(${(currentSlide + 1) / slides.length})`;
    const title = slides[currentSlide]?.dataset.title || "分享";
    document.title = `${title}｜AI 如何变革视觉表达与产品体验`;
    if (speakerCurrent) speakerCurrent.textContent = title;
    if (speakerNext) speakerNext.textContent = slides[(currentSlide + 1) % slides.length]?.dataset.title || "结束";
  }

  function splitTitleText(element) {
    const label = element.textContent.replace(/\s+/g, " ").trim();
    if (element.querySelector(".title-char")) {
      element.setAttribute("aria-label", label);
      return;
    }
    let charIndex = 0;

    function wrapTextNodes(parent) {
      [...parent.childNodes].forEach((node) => {
        if (node.nodeType === Node.TEXT_NODE) {
          const fragment = document.createDocumentFragment();
          [...node.textContent].forEach((character) => {
            const span = document.createElement("span");
            span.className = character.trim() ? "title-char" : "title-char title-space";
            span.textContent = character.trim() ? character : "\u00a0";
            span.style.setProperty("--char-index", charIndex++);
            span.style.setProperty("--char-delay", `${120 + (charIndex - 1) * 24}ms`);
            span.setAttribute("aria-hidden", "true");
            fragment.appendChild(span);
          });
          node.replaceWith(fragment);
        } else if (node.nodeType === Node.ELEMENT_NODE && node.tagName !== "BR") {
          wrapTextNodes(node);
        }
      });
    }

    element.setAttribute("aria-label", label);
    wrapTextNodes(element);
  }

  document.querySelectorAll(".big-label, .section-word, .final-title").forEach(splitTitleText);

  function serializeEditable(element) {
    const clone = element.cloneNode(true);
    clone.querySelectorAll(".title-char").forEach((character) => {
      character.replaceWith(document.createTextNode(character.textContent.replace(/\u00a0/g, " ")));
    });
    return clone.innerHTML;
  }

  function setEditing(enabled) {
    document.body.classList.toggle("edit-mode", enabled);
    editToggle?.setAttribute("aria-pressed", String(enabled));
    if (editToggle) editToggle.textContent = enabled ? "退出编辑" : "编辑文字";
    editableElements.forEach((element) => {
      if (enabled) {
        element.contentEditable = "true";
        element.spellcheck = false;
      } else {
        element.removeAttribute("contenteditable");
        element.removeAttribute("spellcheck");
      }
    });
    if (editStatus) editStatus.textContent = enabled ? "点击页面文字即可修改" : "";
  }

  editToggle?.addEventListener("click", () => {
    setEditing(editToggle.getAttribute("aria-pressed") !== "true");
  });

  editSave?.addEventListener("click", () => {
    const savedCopy = {};
    editableElements.forEach((element) => {
      savedCopy[element.dataset.editId] = serializeEditable(element);
    });
    try {
      window.localStorage.setItem(EDIT_STORAGE_KEY, JSON.stringify(savedCopy));
      document.querySelectorAll(".big-label, .section-word, .final-title").forEach((title) => {
        title.innerHTML = savedCopy[title.dataset.editId];
        splitTitleText(title);
      });
      setEditing(false);
      if (editStatus) editStatus.textContent = "已保存在当前浏览器";
      window.setTimeout(() => { if (editStatus) editStatus.textContent = ""; }, 2400);
    } catch {
      if (editStatus) editStatus.textContent = "浏览器未允许本地保存";
    }
  });

  editExport?.addEventListener("click", () => {
    const savedCopy = {};
    editableElements.forEach((element) => {
      savedCopy[element.dataset.editId] = serializeEditable(element);
    });
    const exportData = {
      version: 1,
      source: "AI 如何变革视觉表达与产品体验",
      exportedAt: new Date().toISOString(),
      copy: savedCopy,
    };
    const blob = new Blob([JSON.stringify(exportData, null, 2)], { type: "application/json;charset=utf-8" });
    const url = URL.createObjectURL(blob);
    const link = document.createElement("a");
    link.href = url;
    link.download = "网页修改文案.json";
    document.body.appendChild(link);
    link.click();
    link.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    if (editStatus) editStatus.textContent = "文案已导出";
    window.setTimeout(() => { if (editStatus) editStatus.textContent = ""; }, 2400);
  });

  editReset?.addEventListener("click", () => {
    if (!window.confirm("恢复网页的默认文字？已保存的修改会被清除。")) return;
    window.localStorage.removeItem(EDIT_STORAGE_KEY);
    window.location.reload();
  });

  slides.forEach((slide) => {
    if (slide.classList.contains("cover-slide")) return;
    const copy = [...slide.querySelectorAll("h3, p, li, small, .tool-node b, .tool-node > span:not(.tool-brand), .prompt-node b, .prompt-node span")];
    copy
      .filter((element) => !element.closest(".big-label, .section-word, .final-title, .poster-grid"))
      .forEach((element, index) => {
        element.classList.add("reveal-copy");
        element.style.setProperty("--reveal-index", index);
        element.style.setProperty("--reveal-delay", `${260 + index * 42}ms`);
      });
  });

  const floatingModules = [...document.querySelectorAll([
    ".index-item",
    ".role-side",
    ".role-arrow",
    ".tool-node",
    ".prompt-node",
    ".skill-strip",
    ".workflow-track div",
    ".workflow-bubble",
    ".boundary-col",
    ".boundary-core",
    ".boundary-formula",
    ".application-metrics div",
    ".notification-flow div",
    ".reuse-list span",
    ".video-track div",
    ".connected-sequence span",
    ".video-prompt",
    ".delivery-panel",
    ".rules-bank",
    ".web-motion-bank",
    ".final-values span",
    ".motion-node",
    ".motion-hub",
    ".web-skill-flow",
    ".transcript-key"
  ].join(","))];

  const driftPatterns = [
    { x: -13, y: -18, r: -2.3, d: 9.2 },
    { x: 15, y: 12, r: 2.0, d: 10.8 },
    { x: 9, y: -15, r: -1.45, d: 8.7 },
    { x: -11, y: 16, r: 2.55, d: 11.4 }
  ];

  floatingModules.forEach((module, index) => {
    const pattern = driftPatterns[index % driftPatterns.length];
    module.classList.add("float-module");
    module.style.setProperty("--drift-x", `${pattern.x}px`);
    module.style.setProperty("--drift-y", `${pattern.y}px`);
    module.style.setProperty("--drift-x-2", `${pattern.x * -0.7}px`);
    module.style.setProperty("--drift-y-2", `${pattern.y * -0.45}px`);
    module.style.setProperty("--drift-x-3", `${pattern.x * 0.35}px`);
    module.style.setProperty("--drift-y-3", `${pattern.y * 0.7}px`);
    module.style.setProperty("--module-tilt", `${pattern.r}deg`);
    module.style.setProperty("--module-tilt-2", `${pattern.r * -0.58}deg`);
    module.style.setProperty("--module-tilt-3", `${pattern.r * 0.34}deg`);
    module.style.setProperty("--drift-duration", `${pattern.d}s`);
    module.style.setProperty("--drift-delay", `${-(index % 7) * 0.73}s`);
    module.style.setProperty("--module-order", index % 8);
    module.style.setProperty("--module-entry-delay", `${170 + (index % 8) * 48}ms`);
  });

  const microMotionModules = [...document.querySelectorAll([
    ".v3-era-track article",
    ".v3-shift-center",
    ".orchestrator-notes",
    ".v3-skill-shot",
    ".v3-template-list article",
    ".v3-skill-octagon li",
    ".v3-text-compare > div",
    ".v3-skill-links > a",
    ".v3-prompt-focus article",
    ".v3-motion-compare article",
    ".v3-lottie-copy",
    ".v3-sprite-copy",
    ".v3-sprite-link",
    ".v3-rules-copy article",
    ".v3-web-skill-card",
    ".v3-summary-copy p"
  ].join(","))];

  microMotionModules.forEach((module, index) => {
    const microX = [-5, 7, 4, -6][index % 4];
    const microY = [-7, -5, 6, 5][index % 4];
    const microR = [-0.25, 0.3, -0.18, 0.22][index % 4];
    module.classList.add("v3-micro-float");
    module.style.setProperty("--micro-x", `${microX}px`);
    module.style.setProperty("--micro-y", `${microY}px`);
    module.style.setProperty("--micro-r", `${microR}deg`);
    module.style.setProperty("--micro-x-2", `${microX * -0.55}px`);
    module.style.setProperty("--micro-y-2", `${microY * -0.45}px`);
    module.style.setProperty("--micro-r-2", `${microR * -0.6}deg`);
    module.style.setProperty("--micro-duration", `${9 + (index % 5) * 0.9}s`);
    module.style.setProperty("--micro-delay", `${-(index % 7) * 0.8}s`);
  });

  const promptMapV3 = document.querySelector(".v3-prompt-map");
  const promptLineSvg = promptMapV3?.querySelector(".v3-prompt-lines");
  const promptPolygons = promptLineSvg ? [...promptLineSvg.querySelectorAll("polygon")] : [];
  const promptCenterV3 = promptMapV3?.querySelector(".prompt-center");
  const promptNodesV3 = promptMapV3 ? [...promptMapV3.querySelectorAll(".prompt-node")] : [];

  function updatePromptTriangles() {
    if (promptMapV3?.closest(".slide")?.classList.contains("active") && promptLineSvg && promptCenterV3) {
      const mapRect = promptMapV3.getBoundingClientRect();
      const centerRect = promptCenterV3.getBoundingClientRect();
      const viewBox = promptLineSvg.viewBox.baseVal;
      if (mapRect.width > 0 && mapRect.height > 0) {
        const scaleX = viewBox.width / mapRect.width;
        const scaleY = viewBox.height / mapRect.height;
        const centerX = (centerRect.left + centerRect.width / 2 - mapRect.left) * scaleX;
        const centerY = (centerRect.top + centerRect.height / 2 - mapRect.top) * scaleY;
        promptNodesV3.forEach((node, index) => {
          const polygon = promptPolygons[index];
          if (!polygon) return;
          const nodeRect = node.getBoundingClientRect();
          const nodeX = (nodeRect.left + nodeRect.width / 2 - mapRect.left) * scaleX;
          const nodeY = (nodeRect.top + nodeRect.height / 2 - mapRect.top) * scaleY;
          const dx = nodeX - centerX;
          const dy = nodeY - centerY;
          const length = Math.max(1, Math.hypot(dx, dy));
          const px = -dy / length;
          const py = dx / length;
          const base = 8;
          polygon.setAttribute("points", `${(centerX + px * base).toFixed(1)},${(centerY + py * base).toFixed(1)} ${(centerX - px * base).toFixed(1)},${(centerY - py * base).toFixed(1)} ${nodeX.toFixed(1)},${nodeY.toFixed(1)}`);
        });
      }
    }
  }

  /* Keep the fragment connections attached to their moving modules. */
  const fragmentLayout = document.querySelector(".fragment-layout");
  const fragmentSvg = fragmentLayout?.querySelector(".fragment-lines");
  const fragmentPaths = fragmentSvg ? [...fragmentSvg.querySelectorAll("path")] : [];
  const fragmentNodes = fragmentLayout ? [...fragmentLayout.querySelectorAll(".fragment-cloud span")] : [];
  const fragmentHub = fragmentLayout?.querySelector(".fragment-hub");

  function updateFragmentConnections() {
    if (fragmentLayout?.closest(".slide")?.classList.contains("active") && fragmentSvg && fragmentHub) {
      const svgRect = fragmentSvg.getBoundingClientRect();
      const hubRect = fragmentHub.getBoundingClientRect();
      const viewBox = fragmentSvg.viewBox.baseVal;
      if (svgRect.width > 0 && svgRect.height > 0) {
        const scaleX = viewBox.width / svgRect.width;
        const scaleY = viewBox.height / svgRect.height;
        const hubX = (hubRect.left + hubRect.width / 2 - svgRect.left) * scaleX;
        const hubY = (hubRect.top + hubRect.height / 2 - svgRect.top) * scaleY;
        fragmentNodes.forEach((node, index) => {
          const path = fragmentPaths[index];
          if (!path) return;
          const nodeRect = node.getBoundingClientRect();
          const startX = (nodeRect.left + nodeRect.width / 2 - svgRect.left) * scaleX;
          const startY = (nodeRect.top + nodeRect.height / 2 - svgRect.top) * scaleY;
          const controlX = (startX + hubX) / 2;
          const controlY = startY + (hubY - startY) * 0.38;
          path.setAttribute("d", `M${startX.toFixed(1)} ${startY.toFixed(1)} Q${controlX.toFixed(1)} ${controlY.toFixed(1)} ${hubX.toFixed(1)} ${hubY.toFixed(1)}`);
        });
      }
    }
  }

  let connectionFrame = 0;
  function hasActiveConnections() {
    return Boolean(
      promptMapV3?.closest(".slide")?.classList.contains("active") ||
      fragmentLayout?.closest(".slide")?.classList.contains("active")
    );
  }

  function updateDynamicConnections() {
    connectionFrame = 0;
    if (document.hidden || !hasActiveConnections()) return;
    updatePromptTriangles();
    updateFragmentConnections();
    connectionFrame = window.requestAnimationFrame(updateDynamicConnections);
  }

  function syncDynamicConnections() {
    if (document.hidden || !hasActiveConnections()) {
      if (connectionFrame) window.cancelAnimationFrame(connectionFrame);
      connectionFrame = 0;
      return;
    }
    if (!connectionFrame) connectionFrame = window.requestAnimationFrame(updateDynamicConnections);
  }

  function syncRuntimeActivity() {
    document.body.classList.toggle("page-hidden", document.hidden);
    syncSlideMedia();
    syncDynamicConnections();
  }

  document.addEventListener("visibilitychange", syncRuntimeActivity);

  function playTransitionCurtain() {
    if (!transitionCurtain || reducedMotion) return;
    transitionCurtain.classList.remove("run");
    void transitionCurtain.offsetWidth;
    transitionCurtain.classList.add("run");
    window.setTimeout(() => transitionCurtain.classList.remove("run"), 760);
  }

  function playAgendaHandoff(sourceSlide, targetSlide) {
    const source = sourceSlide.querySelector(".i1 > span");
    if (!source || reducedMotion) return;
    const stageRect = stage.getBoundingClientRect();
    const sourceRect = source.getBoundingClientRect();
    const stageScale = stageRect.width / STAGE_WIDTH || 1;
    const sourceLeft = (sourceRect.left - stageRect.left) / stageScale;
    const sourceTop = (sourceRect.top - stageRect.top) / stageScale;
    const sourceFontSize = Number.parseFloat(window.getComputedStyle(source).fontSize) || 56;
    const targetFontSize = 132;
    const targetLeft = 76;
    const targetTop = 68;

    const clone = document.createElement("div");
    clone.className = "agenda-handoff-title";
    clone.textContent = source.textContent;
    clone.style.left = `${sourceLeft}px`;
    clone.style.top = `${sourceTop}px`;
    clone.style.fontSize = `${sourceFontSize}px`;
    clone.style.setProperty("--handoff-x", `${targetLeft - sourceLeft}px`);
    clone.style.setProperty("--handoff-y", `${targetTop - sourceTop}px`);
    clone.style.setProperty("--handoff-scale", String(targetFontSize / sourceFontSize));
    stage.appendChild(clone);
    targetSlide.classList.remove("agenda-settled");
    targetSlide.classList.add("agenda-receiving");
    window.setTimeout(() => {
      clone.remove();
      targetSlide.classList.remove("agenda-receiving");
      targetSlide.classList.add("agenda-settled");
    }, 980);
  }

  function stageBox(element) {
    const stageRect = stage.getBoundingClientRect();
    const rect = element.getBoundingClientRect();
    const scale = stageRect.width / STAGE_WIDTH || 1;
    return {
      left: (rect.left - stageRect.left) / scale,
      top: (rect.top - stageRect.top) / scale,
      width: rect.width / scale,
      height: rect.height / scale
    };
  }

  function measureTargets(slide, selector) {
    slide.classList.add("v3-measure");
    const targets = [...slide.querySelectorAll(selector)].map(stageBox);
    slide.classList.remove("v3-measure");
    return targets;
  }

  function animateHandoffClone(source, target, className, options = {}) {
    const sourceBox = stageBox(source);
    const clone = document.createElement("div");
    clone.className = className;
    clone.textContent = options.text ?? source.textContent.trim();
    Object.assign(clone.style, {
      left: `${sourceBox.left}px`, top: `${sourceBox.top}px`, width: `${sourceBox.width}px`, height: `${sourceBox.height}px`
    });
    stage.appendChild(clone);
    const targetWidth = options.targetWidth ?? target.width;
    const targetHeight = options.targetHeight ?? target.height;
    const animation = clone.animate([
      { left: `${sourceBox.left}px`, top: `${sourceBox.top}px`, width: `${sourceBox.width}px`, height: `${sourceBox.height}px`, opacity: 1, transform: "rotate(0deg) scale(1)" },
      { left: `${target.left}px`, top: `${target.top}px`, width: `${targetWidth}px`, height: `${targetHeight}px`, opacity: options.endOpacity ?? 0.92, transform: options.endTransform ?? "rotate(0deg) scale(1)" }
    ], { duration: options.duration ?? 880, easing: "cubic-bezier(.22,1,.36,1)", fill: "forwards" });
    animation.finished.finally(() => clone.remove());
    if (options.swapText) window.setTimeout(() => { clone.textContent = options.swapText; }, 360);
  }

  function playPromptToReference(sourceSlide, targetSlide) {
    if (reducedMotion) return false;
    const sources = [...sourceSlide.querySelectorAll(".prompt-node")];
    const targetElements = [...targetSlide.querySelectorAll(".v3-reference-questions p")];
    const targets = measureTargets(targetSlide, ".v3-reference-questions p");
    targetSlide.classList.add("reference-receiving");
    sources.forEach((source, index) => {
      animateHandoffClone(source, targets[index], "v3-module-handoff", { swapText: targetElements[index]?.textContent.trim(), duration: 940 });
    });
    window.setTimeout(() => targetSlide.classList.remove("reference-receiving"), 920);
    return true;
  }

  function playWorkflowToSkill(sourceSlide, targetSlide) {
    if (reducedMotion) return false;
    const sources = [...sourceSlide.querySelectorAll(".v3-workflow-track div")];
    const target = measureTargets(targetSlide, ".v3-skill-octagon")[0];
    sources.forEach((source, index) => {
      const size = 74 - index * 3;
      animateHandoffClone(source, {
        left: target.left + target.width / 2 - size / 2 + (index - 2.5) * 8,
        top: target.top + target.height / 2 - size / 2 + ((index % 2) ? 10 : -10), width: size, height: size
      }, "v3-circle-handoff", { text: "", targetWidth: size, targetHeight: size, endOpacity: 0.12, duration: 920 });
    });
    return true;
  }

  function playSkillFlip(sourceSlide, targetSlide) {
    if (reducedMotion) return false;
    const source = sourceSlide.querySelector(".v3-skill-octagon");
    const target = measureTargets(targetSlide, ".v3-problem-octagon")[0];
    animateHandoffClone(source, target, "v3-octagon-handoff", { text: "", endTransform: "perspective(900px) rotateY(90deg) scale(.78)", endOpacity: 0.2, duration: 760 });
    return true;
  }

  function playStoryboardToPrompt(sourceSlide, targetSlide) {
    if (reducedMotion) return false;
    const sources = [...sourceSlide.querySelectorAll(".storyboard-wall span")];
    const target = measureTargets(targetSlide, ".v3-video-core")[0];
    sources.forEach((source, index) => {
      const angle = (index / sources.length) * Math.PI * 2;
      const size = 22;
      animateHandoffClone(source, {
        left: target.left + target.width / 2 + Math.cos(angle) * 22 - size / 2,
        top: target.top + target.height / 2 + Math.sin(angle) * 22 - size / 2, width: size, height: size
      }, "storyboard-handoff", { text: "", targetWidth: size, targetHeight: size, endOpacity: 0.05, duration: 880 + index * 18 });
    });
    return true;
  }

  function showSlide(index, direction = 1) {
    if (slideLocked || index === currentSlide) return;
    const nextIndex = (index + slides.length) % slides.length;
    const oldSlide = slides[currentSlide];
    const newSlide = slides[nextIndex];
    slideLocked = true;
    let hasCustomHandoff = false;
    if (oldSlide.dataset.title === "画面拆解" && newSlide.dataset.title === "参考图怎么用") hasCustomHandoff = playPromptToReference(oldSlide, newSlide);
    else if (oldSlide.dataset.title === "海报工作流" && newSlide.dataset.title === "从工作流到 Skill") hasCustomHandoff = playWorkflowToSkill(oldSlide, newSlide);
    else if (oldSlide.dataset.title === "从工作流到 Skill" && newSlide.dataset.title === "创意不可控") hasCustomHandoff = playSkillFlip(oldSlide, newSlide);
    else if (oldSlide.dataset.title === "分镜检查" && newSlide.dataset.title === "视频 Prompt") hasCustomHandoff = playStoryboardToPrompt(oldSlide, newSlide);
    if (!hasCustomHandoff) playTransitionCurtain();

    oldSlide.classList.remove("active", "leaving-next", "leaving-prev", "is-idle");
    oldSlide.classList.add(direction > 0 ? "leaving-next" : "leaving-prev");
    oldSlide.setAttribute("aria-hidden", "true");

    newSlide.classList.remove("leaving-next", "leaving-prev", "is-idle");
    newSlide.classList.add("active");
    newSlide.removeAttribute("aria-hidden");
    currentSlide = nextIndex;
    syncRuntimeActivity();
    speakerStep = 0;
    updateReadout();
    updateSpeakerFocus(true);

    window.setTimeout(() => {
      oldSlide.classList.remove("leaving-next", "leaving-prev");
      oldSlide.classList.add("is-idle");
      slideLocked = false;
    }, reducedMotion ? 20 : 950);
  }

  function nextSlide() { showSlide(currentSlide + 1, 1); }
  function previousSlide() { showSlide(currentSlide - 1, -1); }

  prevButton.addEventListener("click", previousSlide);
  nextButton.addEventListener("click", nextSlide);
  window.addEventListener("resize", fitStage, { passive: true });
  fitStage();

  slides.forEach((slide, index) => {
    if (index !== currentSlide) {
      slide.setAttribute("aria-hidden", "true");
      slide.classList.add("is-idle");
    }
  });
  updateReadout();
  setSpeakerMode(speakerMode, false);
  syncRuntimeActivity();

  /* Cover: five focusable material cards with subtle perspective tilt. */
  const coverCards = cover ? [...cover.querySelectorAll(".material, .material-center")] : [];

  function clearCoverFocus() {
    coverCards.forEach((card) => card.classList.remove("focus"));
    cover?.classList.remove("has-focus");
  }

  coverCards.forEach((card) => {
    card.addEventListener("pointermove", (event) => {
      if (!finePointer) return;
      const rect = card.getBoundingClientRect();
      const px = (event.clientX - rect.left) / rect.width - 0.5;
      const py = (event.clientY - rect.top) / rect.height - 0.5;
      card.style.setProperty("--ry", `${(px * 11).toFixed(2)}deg`);
      card.style.setProperty("--rx", `${(-py * 11).toFixed(2)}deg`);
    });

    card.addEventListener("pointerleave", () => {
      card.style.setProperty("--ry", "0deg");
      card.style.setProperty("--rx", "0deg");
    });

    card.addEventListener("click", () => {
      const shouldFocus = !card.classList.contains("focus");
      clearCoverFocus();
      if (shouldFocus) {
        card.classList.add("focus");
        cover.classList.add("has-focus");
      }
    });
  });

  /* Poster archive: 3D coverflow, faithful to the reference page. */
  const posterGrid = document.querySelector(".poster-grid.coverflow");
  const posterCards = posterGrid ? [...posterGrid.querySelectorAll("figure")] : [];
  const posterDots = document.querySelector(".coverflow-dots");
  let currentPoster = Math.min(3, Math.max(0, posterCards.length - 1));
  let posterDragging = false;
  let posterStartX = 0;
  let posterPointerId = null;
  let posterWheelLocked = false;
  let posterPaused = false;
  let posterPauseTimer = 0;

  const coverflowDepth = {
    x: [0, 240, 420, 580, 700],
    z: [250, 100, -80, -235, -380],
    r: [0, 24, 37, 47, 55],
    s: [1.045, 0.94, 0.81, 0.70, 0.60],
    o: [1, 0.90, 0.70, 0.49, 0.27],
    b: [1, 0.84, 0.70, 0.57, 0.46],
    sat: [1.04, 0.92, 0.80, 0.68, 0.58]
  };

  function circularDifference(index, center, length) {
    let difference = index - center;
    if (difference > length / 2) difference -= length;
    if (difference < -length / 2) difference += length;
    return difference;
  }

  function renderPosters() {
    if (!posterCards.length) return;
    posterCards.forEach((card, index) => {
      const difference = circularDifference(index, currentPoster, posterCards.length);
      const distance = Math.min(4, Math.abs(difference));
      const sign = Math.sign(difference);
      card.style.setProperty("--cf-x", `${coverflowDepth.x[distance] * sign}px`);
      card.style.setProperty("--cf-z", `${coverflowDepth.z[distance]}px`);
      card.style.setProperty("--cf-r", `${coverflowDepth.r[distance] * -sign}deg`);
      card.style.setProperty("--cf-s", coverflowDepth.s[distance]);
      card.style.setProperty("--cf-o", coverflowDepth.o[distance]);
      card.style.setProperty("--cf-b", coverflowDepth.b[distance]);
      card.style.setProperty("--cf-sat", coverflowDepth.sat[distance]);
      card.style.setProperty("--cf-zindex", String(20 - distance));
      card.classList.toggle("is-active", difference === 0);
      card.setAttribute("aria-current", difference === 0 ? "true" : "false");
    });

    [...posterDots.children].forEach((dot, index) => {
      const active = index === currentPoster;
      dot.classList.toggle("active", active);
      dot.setAttribute("aria-pressed", String(active));
    });
  }

  function pausePostersTemporarily() {
    posterPaused = true;
    window.clearTimeout(posterPauseTimer);
    posterPauseTimer = window.setTimeout(() => { posterPaused = false; }, 5200);
  }

  function setPoster(index, userInitiated = true) {
    if (!posterCards.length) return;
    currentPoster = (index + posterCards.length) % posterCards.length;
    renderPosters();
    if (userInitiated) pausePostersTemporarily();
  }

  if (posterGrid && posterDots) {
    posterCards.forEach((card, index) => {
      card.tabIndex = 0;
      card.setAttribute("role", "button");
      card.style.setProperty("--poster-seq", index);
      card.style.setProperty("--poster-delay", `${index * -0.58}s`);
      card.style.setProperty("--poster-enter-delay", `${180 + index * 46}ms`);
      card.setAttribute("aria-label", `查看${card.querySelector("figcaption")?.textContent || `第 ${index + 1} 张`}海报`);
      card.addEventListener("click", () => {
        if (!posterDragging) setPoster(index);
      });
      card.addEventListener("keydown", (event) => {
        if (event.key === "Enter" || event.key === " ") {
          event.preventDefault();
          setPoster(index);
        }
      });

      const dot = document.createElement("button");
      dot.type = "button";
      dot.setAttribute("aria-label", `切换到第 ${index + 1} 张海报`);
      dot.addEventListener("click", () => setPoster(index));
      posterDots.appendChild(dot);
    });

    posterGrid.addEventListener("pointerdown", (event) => {
      if (event.button !== 0) return;
      posterDragging = false;
      posterStartX = event.clientX;
      posterPointerId = event.pointerId;
      posterGrid.setPointerCapture?.(event.pointerId);
    });

    posterGrid.addEventListener("pointermove", (event) => {
      if (posterPointerId !== event.pointerId) return;
      if (Math.abs(event.clientX - posterStartX) > 8) posterDragging = true;
    });

    function finishPosterDrag(event) {
      if (posterPointerId !== event.pointerId) return;
      const delta = event.clientX - posterStartX;
      if (Math.abs(delta) > 42) setPoster(currentPoster + (delta < 0 ? 1 : -1));
      posterGrid.releasePointerCapture?.(event.pointerId);
      posterPointerId = null;
      window.setTimeout(() => { posterDragging = false; }, 0);
    }

    posterGrid.addEventListener("pointerup", finishPosterDrag);
    posterGrid.addEventListener("pointercancel", finishPosterDrag);
    posterGrid.addEventListener("wheel", (event) => {
      event.preventDefault();
      event.stopPropagation();
      if (posterWheelLocked || Math.abs(event.deltaY) < 4) return;
      posterWheelLocked = true;
      setPoster(currentPoster + (event.deltaY > 0 ? 1 : -1));
      window.setTimeout(() => { posterWheelLocked = false; }, 380);
    }, { passive: false });

    posterGrid.addEventListener("pointerenter", () => { posterPaused = true; });
    posterGrid.addEventListener("pointerleave", () => {
      if (!posterPauseTimer) posterPaused = false;
    });

    renderPosters();
    if (!reducedMotion) {
      window.setInterval(() => {
        if (!document.hidden && slides[currentSlide]?.classList.contains("poster-slide") && !posterPaused) {
          setPoster(currentPoster + 1, false);
        }
      }, 3300);
    }
  }

  /* Keyboard, wheel and touch navigation. */
  document.addEventListener("keydown", (event) => {
    const interactive = event.target.closest?.("button, a, input, textarea, select, [contenteditable='true']");

    if (event.key === "Escape") {
      clearCoverFocus();
      return;
    }

    if (speakerMode && slides[currentSlide]?.classList.contains("transcript-slide")) {
      const paragraphs = getSpeakerParagraphs();
      if (event.key === "ArrowDown" && paragraphs.length) {
        event.preventDefault();
        speakerStep = Math.min(paragraphs.length - 1, speakerStep + 1);
        updateSpeakerFocus();
        return;
      }
      if (event.key === "ArrowUp" && paragraphs.length) {
        event.preventDefault();
        speakerStep = Math.max(0, speakerStep - 1);
        updateSpeakerFocus();
        return;
      }
    }

    if (slides[currentSlide]?.classList.contains("poster-slide")) {
      if (event.key === "ArrowDown") {
        event.preventDefault();
        setPoster(currentPoster + 1);
        return;
      }
      if (event.key === "ArrowUp") {
        event.preventDefault();
        setPoster(currentPoster - 1);
        return;
      }
    }

    if (interactive) return;
    if (["ArrowRight", "PageDown", " "].includes(event.key)) {
      event.preventDefault();
      nextSlide();
    } else if (["ArrowLeft", "PageUp"].includes(event.key)) {
      event.preventDefault();
      previousSlide();
    } else if (event.key === "Home") {
      event.preventDefault();
      showSlide(0, -1);
    } else if (event.key === "End") {
      event.preventDefault();
      showSlide(slides.length - 1, 1);
    }
  });

  window.addEventListener("wheel", (event) => {
    if (event.target.closest?.(".poster-grid")) return;
    const amount = Math.abs(event.deltaY) >= Math.abs(event.deltaX) ? event.deltaY : event.deltaX;
    if (Math.abs(amount) < 14 || wheelLocked) return;
    event.preventDefault();
    wheelLocked = true;
    if (amount > 0) nextSlide(); else previousSlide();
    window.setTimeout(() => { wheelLocked = false; }, 760);
  }, { passive: false });

  let touchStartX = 0;
  let touchStartY = 0;
  let touchBlocked = false;
  const swipeSurface = finePointer ? stage : document;
  swipeSurface.addEventListener("touchstart", (event) => {
    const touch = event.changedTouches[0];
    touchStartX = touch.clientX;
    touchStartY = touch.clientY;
    touchBlocked = Boolean(event.target.closest?.(".poster-grid, .cover-materials, #controls"));
  }, { passive: true });

  swipeSurface.addEventListener("touchend", (event) => {
    if (touchBlocked) return;
    const touch = event.changedTouches[0];
    const dx = touch.clientX - touchStartX;
    const dy = touch.clientY - touchStartY;
    if (Math.abs(dx) > 55 && Math.abs(dx) > Math.abs(dy) * 1.25) {
      if (dx < 0) nextSlide(); else previousSlide();
    }
  }, { passive: true });

  if (mobileFullscreen) {
    if (!document.fullscreenEnabled) mobileFullscreen.hidden = true;
    mobileFullscreen.addEventListener("click", async () => {
      try {
        if (!document.fullscreenElement) {
          await document.documentElement.requestFullscreen();
          await screen.orientation?.lock?.("landscape");
        } else {
          await document.exitFullscreen();
        }
      } catch {
        mobileFullscreen.textContent = "请使用浏览器全屏";
      }
    });
    document.addEventListener("fullscreenchange", () => {
      mobileFullscreen.textContent = document.fullscreenElement ? "退出全屏" : "全屏查看";
      window.setTimeout(fitStage, 80);
    });
  }

  /* Focus mode for connected system nodes. */
  [...document.querySelectorAll(".tool-node, .prompt-node, .motion-node")].forEach((node) => {
    node.tabIndex = 0;
    const group = node.parentElement;
    const on = () => {
      group.classList.add("focus-mode");
      node.classList.add("is-focus");
    };
    const off = () => {
      group.classList.remove("focus-mode");
      node.classList.remove("is-focus");
    };
    node.addEventListener("pointerenter", on);
    node.addEventListener("pointerleave", off);
    node.addEventListener("focus", on);
    node.addEventListener("blur", off);
  });

  /* Cursor and local light field. */
  if (finePointer && !reducedMotion) {
    const dot = document.querySelector("#cursor-dot");
    const ring = document.querySelector("#cursor-ring");
    let pointerX = window.innerWidth / 2;
    let pointerY = window.innerHeight / 2;
    let ringX = pointerX;
    let ringY = pointerY;
    let ringFrame = 0;

    window.addEventListener("pointermove", (event) => {
      pointerX = event.clientX;
      pointerY = event.clientY;
      dot.style.transform = `translate3d(${pointerX}px, ${pointerY}px, 0)`;
      document.body.classList.add("pointer-ready");

      const rect = stage.getBoundingClientRect();
      const x = Math.max(0, Math.min(100, ((pointerX - rect.left) / rect.width) * 100));
      const y = Math.max(0, Math.min(100, ((pointerY - rect.top) / rect.height) * 100));
      slides[currentSlide]?.style.setProperty("--mx", `${x}%`);
      slides[currentSlide]?.style.setProperty("--my", `${y}%`);
      if (!ringFrame) ringFrame = window.requestAnimationFrame(animateRing);
    }, { passive: true });

    document.addEventListener("pointerover", (event) => {
      document.body.classList.toggle("pointer-active", Boolean(event.target.closest?.("button, [role='button'], .tool-node, .prompt-node, .motion-node")));
    });

    const animateRing = () => {
      ringFrame = 0;
      ringX += (pointerX - ringX) * 0.16;
      ringY += (pointerY - ringY) * 0.16;
      ring.style.transform = `translate3d(${ringX}px, ${ringY}px, 0)`;
      if (Math.hypot(pointerX - ringX, pointerY - ringY) > 0.15) {
        ringFrame = window.requestAnimationFrame(animateRing);
      }
    };
  }
})();
