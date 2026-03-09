/* Mobinode - split bundle (part 4/4)
 * v5.2.2
 * Conteúdo: IO (import/export/clear), bindings, linhas, boot
 */

"use strict";
console.log("%c[IO_BOOT] CARREGADO: v5.7.0_RC3", "color:#0f0;font-weight:bold");


// =========================
// Import / Export / Clear
// =========================
function exportJSON() {
    const payload = {
        version: "5.2.0",
        state: {
            nodes: state.nodes,
            edges: state.edges,
            lines: state.lines,
            texts: state.texts,
            activeLineId: state.activeLineId,
            curveRoundness: state.curveRoundness,
        },
        view: state.view,
    };
    const txt = JSON.stringify(payload, null, 2);
    if (dom.jsonBox) dom.jsonBox.value = txt;
    return txt;
}

// =========================
// Cache do navegador (auto-restore)
// Ctrl+F: MOBINODE_CACHE_KEY
// =========================
const MOBINODE_CACHE_KEY = "mobinode.cache.v1";

// Ctrl+F: saveMapToBrowserCache
function saveMapToBrowserCache() {
    const txt = exportJSON();
    const payload = {
        savedAt: Date.now(),
        json: txt,
    };

    try {
        localStorage.setItem(MOBINODE_CACHE_KEY, JSON.stringify(payload));
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}


// Ctrl+F: loadMapFromBrowserCache
function loadMapFromBrowserCache() {
    try {
        const raw = localStorage.getItem(MOBINODE_CACHE_KEY);
        if (!raw) return false;

        const payload = JSON.parse(raw);
        const txt = payload?.json;
        if (!txt || typeof txt !== "string") return false;

        importJSON(txt);

        // Depois de restaurar, deixa o projeto “limpo” de histórico
        history.undo.length = 0;
        history.redo.length = 0;
        updateUndoRedoButtons();

        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

// =========================
// Auto-save (cache do navegador)
// =========================
// Ctrl+F: Auto-save (cache do navegador)

const AUTO_CACHE = {
    enabled: true,

    // salva após X ms sem interação (modo Canva)
    idleMs: 5000,

    // impede salvar em excesso
    minGapMs: 12000,

    // safety net
    safetyIntervalMs: 60000,
};


let _cacheDirty = false;
let _cacheIdleTimer = null;
let _cacheLastSavedAt = 0;

function markCacheDirty(reason = "unknown") {
    _cacheDirty = true;
    scheduleIdleSave(`idle:${reason}`);
}

function scheduleIdleSave(reason = "idle") {
    if (!AUTO_CACHE.enabled) return;

    if (_cacheIdleTimer) clearTimeout(_cacheIdleTimer);

    _cacheIdleTimer = setTimeout(() => {
        flushAutoCacheSave(reason);
    }, AUTO_CACHE.idleMs);
}

function flushAutoCacheSave(reason = "flush") {
    if (!AUTO_CACHE.enabled) return;
    if (!_cacheDirty) return;

    const now = Date.now();
    if (now - _cacheLastSavedAt < AUTO_CACHE.minGapMs) {
        const wait = AUTO_CACHE.minGapMs - (now - _cacheLastSavedAt);
        if (_cacheIdleTimer) clearTimeout(_cacheIdleTimer);
        _cacheIdleTimer = setTimeout(() => flushAutoCacheSave(`throttle:${reason}`), wait);
        return;
    }

    const ok = saveMapToBrowserCache();
    if (ok) {
        _cacheDirty = false;
        _cacheLastSavedAt = now;

        if (typeof showToast === "function") {
            showToast("Mapa atual salvo");
        }

        // console.log("Auto-cache saved ✅", reason);
    }
}


function startAutoCacheSaver() {
    if (!AUTO_CACHE.enabled) return;

    setInterval(() => {
        if (_cacheDirty) flushAutoCacheSave("safety");
    }, AUTO_CACHE.safetyIntervalMs);

        document.addEventListener("visibilitychange", () => {
            if (document.visibilityState === "hidden") flushAutoCacheSave("visibility:hidden");
        });

            window.addEventListener("beforeunload", () => {
                flushAutoCacheSave("beforeunload");
            });

            // “atividade” global: mouse, toque e teclado
            const pokeIdle = () => { if (_cacheDirty) scheduleIdleSave("activity"); };

            ["pointerdown","pointermove","pointerup","keydown","wheel","touchstart","touchmove"].forEach(evt => {
                window.addEventListener(evt, pokeIdle, { passive: true });
            });
}




// =========================
// Cache do navegador (manual)
// =========================
// Ctrl+F: MOBINODE_CACHE_KEY

// Ctrl+F: saveMapToBrowserCache
function saveMapToBrowserCache() {
        const txt = exportJSON();
        const payload = {
               savedAt: Date.now(),
                json: txt,
            };
            try {
                    localStorage.setItem(MOBINODE_CACHE_KEY, JSON.stringify(payload));
                    return true;
                } catch (e) {
                        console.error(e);
                        return false;
                    }
                }

function getMapBBoxFrom(svgEl, pad = 40) {
    const svg = svgEl || document.getElementById("viewport");
    if (!svg) return { x: 0, y: 0, width: 1200, height: 800 };

    const edges = svg.querySelector("#edges");
    const nodes = svg.querySelector("#nodes");
    const texts = svg.querySelector("#texts");

    const parts = [edges, nodes, texts].filter(Boolean);
    if (parts.length === 0) return { x: 0, y: 0, width: 1200, height: 800 };

    let bb = null;
    for (const g of parts) {
        try {
            const b = g.getBBox();
            if (!bb) bb = { x: b.x, y: b.y, x2: b.x + b.width, y2: b.y + b.height };
            else {
                bb.x  = Math.min(bb.x, b.x);
                bb.y  = Math.min(bb.y, b.y);
                bb.x2 = Math.max(bb.x2, b.x + b.width);
                bb.y2 = Math.max(bb.y2, b.y + b.height);
            }
        } catch (_) {}
    }

    if (!bb) return { x: 0, y: 0, width: 1200, height: 800 };

    return {
        x: bb.x - pad,
        y: bb.y - pad,
        width: (bb.x2 - bb.x) + pad * 2,
        height: (bb.y2 - bb.y) + pad * 2,
    };
}


async function getAppCSSForExport() {
    // Em file://, fetch do CSS dá CORS. Então a gente lê do próprio CSS já carregado no documento.
    let out = "";

    for (const ss of [...document.styleSheets]) {
        try {
            const href = ss.href || "";
            // pega só o CSS principal do app (ajuste o includes se mudar nome)
            const isAppCss = href.includes("app_v4.7.6.css") || href.includes("app_") && href.includes(".css");
            if (!isAppCss) continue;

            const rules = ss.cssRules;
            for (const r of rules) out += r.cssText + "\n";
        } catch (e) {
            // Alguns stylesheets podem ser bloqueados (ex: extensões), ignora
        }
    }

    return out;
}


async function buildExportSVGString({ includeGrid = false } = {}) {
    const original = document.getElementById("viewport");
    if (!original) throw new Error("SVG viewport não encontrado");

    const clone = original.cloneNode(true);

    // remove grid do clone pra não “inchar” bbox
    if (!includeGrid) {
        const grid = clone.querySelector("#grid");
        if (grid) grid.remove();
    }

    // zera pan/zoom no clone (export em coordenadas puras)
    const world = clone.querySelector("#world");
    if (world) world.setAttribute("transform", "translate(0 0) scale(1)");


    // remove artefatos de interação do clone (não fazem parte do mapa exportado)
    clone.querySelector("#selectRect")?.remove();
    clone.querySelector("#ghost")?.remove();

    forceStrokePathsToFillNone(clone);


    // mede bbox apenas do conteúdo do mapa (edges/nodes/texts) — evita “quadrado branco” e bbox inflado
    const bbox = measureMergedBBoxInDOM(clone, ["#edges", "#nodes", "#texts"], 64);


    // injeta CSS (opcional) — pode manter tua lógica atual
    const cssText = await getAppCSSForExport();
    if (cssText) {
        const defs = clone.querySelector("defs") || (() => {
            const d = document.createElementNS("http://www.w3.org/2000/svg", "defs");
            clone.insertBefore(d, clone.firstChild);
            return d;
        })();

        const style = document.createElementNS("http://www.w3.org/2000/svg", "style");
        style.setAttribute("type", "text/css");
        style.textContent = cssText;
        defs.appendChild(style);
    }

    // normaliza pro PNG ficar enquadrado
    wrapContentAndNormalize(clone, bbox);
    inlineTextStylesFromComputed(original, clone);

    // ✅ remove hit areas, handles, overlays e qualquer lixo de UI
    stripNonExportables(clone);

    addBackgroundRect(clone, bbox);


    // mantém seu inlineTextStylesFromComputed e background se você já tem
    inlineTextStylesFromComputed(original, clone, { forceAgnosticText: true });

    applyPDFSafeStrokeFix(clone);


    // 2) embute estilos computados pros textos
    inlineTextStylesFromComputed(original, clone);

    // 2.5) evita “espinhos”/triângulos no PDF (miter join)
    fixExportStrokeJoins(clone);
    forceRoundJoinsForPDF(clone);

    // 3) coloca fundo
    addBackgroundRect(clone, bbox);


    addBackgroundRect(clone, bbox);

    return new XMLSerializer().serializeToString(clone);
}

function fixExportStrokeJoins(svg) {
    // Pega tudo que costuma ter stroke e que pode “miterar” em quinas
    const els = svg.querySelectorAll("path, polyline, polygon, line");

    for (const el of els) {
        const stroke = el.getAttribute("stroke");
        const sw = parseFloat(el.getAttribute("stroke-width") || "0");

        // Só mexe no que realmente desenha traço
        if (!stroke || stroke === "none" || !(sw > 0)) continue;

        // Round resolve os triângulos pretos no PDF
        el.setAttribute("stroke-linejoin", "round");
        el.setAttribute("stroke-linecap", "round");

        // Miterlimit baixo evita qualquer “bico” residual
        el.setAttribute("stroke-miterlimit", "2");
    }
}

function forceStrokePathsToFillNone(svg) {
    svg.querySelectorAll("path").forEach(p => {
        // se é um path “de linha” (tem stroke) e não tem fill definido, fixa fill none
        if (p.hasAttribute("stroke") && !p.hasAttribute("fill")) {
            p.setAttribute("fill", "none");
        }
    });
}



function stripNonExportables(svg) {
    // tudo que é “UI”, hitbox, seleção, handles, etc — não deve ir pra PNG/PDF
    const selectors = [
        ".edge-hit",
        ".edge-selected-overlay",
        ".edge-handle",
        ".selection-rect",
        ".node-hit",
        ".debug",
    ];

    for (const sel of selectors) {
        svg.querySelectorAll(sel).forEach(n => n.remove());
    }
}



function inlineTextStylesFromComputed(originalSvg, cloneSvg, opts = {}) {
    const forceAgnostic = opts.forceAgnosticText === true;

    const origTexts = [...originalSvg.querySelectorAll("text")];
    const cloneTexts = [...cloneSvg.querySelectorAll("text")];
    const n = Math.min(origTexts.length, cloneTexts.length);

    for (let i = 0; i < n; i++) {
        const cs = getComputedStyle(origTexts[i]);
        const t = cloneTexts[i];

        // Fonte (mantém o que aparece no app)
        t.setAttribute("font-family", cs.fontFamily || 'system-ui, Arial');
        t.setAttribute("font-size", cs.fontSize || "14px");
        t.setAttribute("font-weight", cs.fontWeight || "400");
        t.setAttribute("font-style", cs.fontStyle || "normal");
        if (cs.letterSpacing) t.setAttribute("letter-spacing", cs.letterSpacing);

        // ===== Export theme-agnostic (universal): texto preto + outline branca =====
        if (forceAgnostic) {
            t.setAttribute("fill", "#000");
            t.setAttribute("stroke", "#fff");
            t.setAttribute("paint-order", "stroke fill");
            t.setAttribute("stroke-linejoin", "round");
            t.setAttribute("stroke-linecap", "round");

            // Mantém um contorno “bom” (usa o do app se existir; senão 2px)
            const sw = (cs.strokeWidth && cs.strokeWidth !== "0px") ? cs.strokeWidth : "2px";
            t.setAttribute("stroke-width", sw);

            continue; // NÃO deixa o bloco normal sobrescrever fill/stroke
        }
        // ========================================================================

        // Cores normais (quando não está no modo universal)
        if (cs.fill && cs.fill !== "none") t.setAttribute("fill", cs.fill);
        if (cs.color && (!cs.fill || cs.fill === "none")) t.setAttribute("fill", cs.color);

        if (cs.stroke && cs.stroke !== "none") t.setAttribute("stroke", cs.stroke);
        if (cs.strokeWidth && cs.strokeWidth !== "0px") t.setAttribute("stroke-width", cs.strokeWidth);
    }
}

function applyPDFSafeStrokeFix(svg) {
    const els = svg.querySelectorAll("path, polyline, polygon, line, rect, circle");

    for (const el of els) {
        // Se não tiver stroke-width, nem mexe
        const swAttr = el.getAttribute("stroke-width");
        const sw = swAttr ? parseFloat(swAttr) : 0;

        // Se stroke-width não está no atributo, pode estar vindo via CSS original
        // Mesmo assim, setar join/cap ajuda (não quebra nada)
        // Então vamos aplicar em todos, mas capar “ponta” com bevel/miterlimit baixo.
        el.setAttribute("stroke-linejoin", "bevel");   // <- o anti-triângulo supremo
        el.setAttribute("stroke-linecap", "round");
        el.setAttribute("stroke-miterlimit", "1");

        // Backup redundante (alguns engines respeitam style antes, outros atributo)
        el.style.strokeLinejoin = "bevel";
        el.style.strokeLinecap = "round";
        el.style.strokeMiterlimit = "1";

        // Se você usa “outline” preto por baixo (stroke grosso), é aqui que o miter buga.
        // Bevel + miterlimit 1 resolve sem alterar o visual geral.
    }

    // E pra evitar micro-glitches de rasterização no print:
    svg.setAttribute("shape-rendering", "geometricPrecision");
}


function forceRoundJoinsForPDF(svg) {
    // 1) Regras CSS com !important (isso vence estilos por classe)
    const style = svg.ownerDocument.createElementNS("http://www.w3.org/2000/svg", "style");
    style.textContent = `
    path, polyline, polygon, line {
        stroke-linejoin: round !important;
        stroke-linecap: round !important;
        stroke-miterlimit: 2 !important;
    }
    `;
    // mete no começo do SVG pra ter prioridade na cascata
    svg.insertBefore(style, svg.firstChild);

    // 2) Backup: também seta inline style direto nos elementos (pra garantir em qualquer engine)
    const els = svg.querySelectorAll("path, polyline, polygon, line");
    for (const el of els) {
        el.style.strokeLinejoin = "round";
        el.style.strokeLinecap = "round";
        el.style.strokeMiterlimit = "2";
    }
}




function getExportBackgroundColor() {
    // tenta pegar o fundo real do canvas/app; body às vezes é transparente
    const pick = (el) => el ? getComputedStyle(el).backgroundColor : "";
    const isTransparent = (c) => !c || c === "transparent" || /^rgba\(\s*\d+\s*,\s*\d+\s*,\s*\d+\s*,\s*0\s*\)$/.test(c);

    const canvasEl = document.getElementById("canvas") || document.querySelector(".canvas") || null;
    let c = pick(canvasEl);
    if (isTransparent(c)) c = pick(document.body);
    if (isTransparent(c)) c = pick(document.documentElement);

    return isTransparent(c) ? "#0b0f16" : c;
}

function addBackgroundRect(clone, bbox) {
    const NS = "http://www.w3.org/2000/svg";
    const bg = document.createElementNS(NS, "rect");
    bg.setAttribute("x", "0");
    bg.setAttribute("y", "0");
    bg.setAttribute("width", `${bbox.width}`);
    bg.setAttribute("height", `${bbox.height}`);
    bg.setAttribute("fill", getExportBackgroundColor());

    // Fundo deve ficar NO ROOT (sem ser afetado por translate do exportRoot)
    const exportRoot = clone.querySelector("#exportRoot");
    if (exportRoot) clone.insertBefore(bg, exportRoot);
    else {
        const defs = clone.querySelector("defs");
        if (defs && defs.nextSibling) clone.insertBefore(bg, defs.nextSibling);
        else clone.insertBefore(bg, clone.firstChild);
    }
}

function wrapContentAndNormalize(clone, bbox) {
    const NS = "http://www.w3.org/2000/svg";

    // 🔑 viewBox NORMALIZADO
    clone.setAttribute(
        "viewBox",
        `0 0 ${bbox.width} ${bbox.height}`
    );
    clone.setAttribute("width", `${bbox.width}`);
    clone.setAttribute("height", `${bbox.height}`);

    // grupo raiz
    const g = document.createElementNS(NS, "g");
    g.setAttribute("id", "exportRoot");

    // 🔑 TODO o deslocamento fica AQUI
    g.setAttribute(
        "transform",
        `translate(${-bbox.x}, ${-bbox.y})`
    );

    // move tudo (exceto defs) pra dentro do grupo
    const children = [...clone.childNodes];
    for (const ch of children) {
        if (ch.nodeType === 1 && ch.tagName.toLowerCase() === "defs") continue;
        g.appendChild(ch);
    }

    clone.textContent = "";
    const defs = clone.querySelector("defs");
    if (defs) clone.appendChild(defs);
    clone.appendChild(g);
}


function measureBBoxInDOM(svgClone, selector = "#world") {
    // coloca o clone numa “gaveta invisível” pra getBBox funcionar 100%
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.left = "-10000px";
    box.style.top = "-10000px";
    box.style.width = "1px";
    box.style.height = "1px";
    box.style.overflow = "hidden";
    box.style.opacity = "0";
    box.style.pointerEvents = "none";
    document.body.appendChild(box);

    box.appendChild(svgClone);

    let bbox = null;
    try {
        const el = svgClone.querySelector(selector) || svgClone;
        bbox = el.getBBox();
    } catch (e) {
        bbox = null;
    }

    box.remove();
    return bbox;
}




function measureMergedBBoxInDOM(svgClone, selectors, pad = 48) {
    // mede bbox combinando vários grupos (edges/nodes/texts) com o clone anexado ao DOM
    const box = document.createElement("div");
    box.style.position = "fixed";
    box.style.left = "-10000px";
    box.style.top = "-10000px";
    box.style.width = "1px";
    box.style.height = "1px";
    box.style.overflow = "hidden";
    box.style.opacity = "0";
    box.style.pointerEvents = "none";
    document.body.appendChild(box);

    box.appendChild(svgClone);

    let bb = null;
    try {
        const els = selectors.flatMap(sel => [...svgClone.querySelectorAll(sel)]);
        for (const el of els) {
            try {
                const b = el.getBBox();
                if (!bb) bb = { x: b.x, y: b.y, x2: b.x + b.width, y2: b.y + b.height };
                else {
                    bb.x = Math.min(bb.x, b.x);
                    bb.y = Math.min(bb.y, b.y);
                    bb.x2 = Math.max(bb.x2, b.x + b.width);
                    bb.y2 = Math.max(bb.y2, b.y + b.height);
                }
            } catch (_) {}
        }
    } catch (e) {
        bb = null;
    }

    box.remove();

    if (!bb) return { x: 0, y: 0, width: 1200, height: 800 };
    return {
        x: bb.x - pad,
        y: bb.y - pad,
        width: (bb.x2 - bb.x) + pad * 2,
        height: (bb.y2 - bb.y) + pad * 2
    };
}

async function exportMapAsPNG({ scale = 2, includeGrid = false, filename = "mobinode.png" } = {}) {
    const svgString = await buildExportSVGString({ includeGrid });

    // SVG -> Image
    const blob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const url = URL.createObjectURL(blob);

    const img = new Image();
    img.decoding = "async";

    await new Promise((resolve, reject) => {
        img.onload = resolve;
        img.onerror = reject;
        img.src = url;
    });

    // Image -> Canvas -> PNG
    const w = Math.max(1, Math.floor(img.width * scale));
    const h = Math.max(1, Math.floor(img.height * scale));

    const canvas = document.createElement("canvas");
    canvas.width = w;
    canvas.height = h;

    const ctx = canvas.getContext("2d");
    ctx.imageSmoothingEnabled = true;
    ctx.setTransform(scale, 0, 0, scale, 0, 0);
    ctx.drawImage(img, 0, 0);

    URL.revokeObjectURL(url);

    const pngBlob = await new Promise(resolve => canvas.toBlob(resolve, "image/png"));
    if (!pngBlob) throw new Error("Falha ao gerar PNG");

    // salva (com fallback)
    if (window.showSaveFilePicker) {
        try {
            const h = await window.showSaveFilePicker({
                suggestedName: filename,
                types: [{ description: "PNG", accept: { "image/png": [".png"] } }]
            });
            const writable = await h.createWritable();
            await writable.write(pngBlob);
            await writable.close();
            return;
        } catch (_) {
            // cancelado -> cai pro fallback
        }
    }

    const a = document.createElement("a");
    a.href = URL.createObjectURL(pngBlob);
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(a.href);
}

async function exportMapAsPDFToWindow(win, { includeGrid = false, title = "Mobinode" } = {}) {
    const svgString = await buildExportSVGString({ includeGrid });

    const svgBlob = new Blob([svgString], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    win.document.open();
    win.document.write(`<!doctype html>
    <html>
    <head>
    <meta charset="utf-8" />
    <title>${title}</title>
    <style>
    html, body { margin: 0; padding: 0; background: transparent; }
    .page { width: 100vw; height: 100vh; display: grid; place-items: center; }
    img { max-width: 100vw; max-height: 100vh; }
    @page { margin: 10mm; }
    </style>
    </head>
    <body>
    <div class="page"><img id="mapImg" alt="Mapa"/></div>
    <script>
    const img = document.getElementById("mapImg");
    img.onload = () => {
        setTimeout(() => {
            window.focus();
            window.print();
        }, 150);
    };
    img.src = ${JSON.stringify(svgUrl)};
    </script>
    </body>
    </html>`);
    win.document.close();

    // não revoga cedo demais
    setTimeout(() => URL.revokeObjectURL(svgUrl), 5000);
}




function importJSON(txt) {
    let data;
    try {
        data = JSON.parse(txt);
    } catch {
        alert("JSON inválido.");
        return;
    }

    const s = data.state || data;
    if (!s) return;

    pushHistory();

    state.nodes = deepClone(s.nodes || []);
    // compat: garante prefix/suffix + flags
    state.nodes.forEach((n) => {
        if (typeof n.prefix !== "string") n.prefix = "";
        if (typeof n.suffix !== "string") n.suffix = "";
        if (typeof n.name !== "string") n.name = "";
        if (!n.type) n.type = "normal";
        // compat: orientação do rótulo
        if (typeof n.labelAngle !== "number") {
            const v = parseFloat(n.labelAngle);
            n.labelAngle = Number.isFinite(v) ? v : 0;
        }

        // compat: ajuste fino do rótulo
        if (!n.labelOffset || typeof n.labelOffset !== "object") {
            n.labelOffset = { dx: 0, dy: 0 };
        } else {
            const dx = Number(n.labelOffset.dx);
            const dy = Number(n.labelOffset.dy);
            n.labelOffset = {
                dx: Number.isFinite(dx) ? dx : 0,
                        dy: Number.isFinite(dy) ? dy : 0
            };
        }


        if (typeof n.prefixEnabled !== "boolean") n.prefixEnabled = !!(n.prefix && n.prefix.trim());
        if (typeof n.suffixEnabled !== "boolean") n.suffixEnabled = !!(n.suffix && n.suffix.trim());
    });
        state.edges = deepClone(s.edges || []);
        // compat v4.7.4: bendOffset (relativo) e bend legado
        for (const e of state.edges) {
            if (!e) continue;
            // sanitize bendOffset
            if (e.bendOffset) {
                const dx = Number(e.bendOffset.dx);
                const dy = Number(e.bendOffset.dy);
                if (Number.isFinite(dx) && Number.isFinite(dy)) e.bendOffset = { dx, dy };
                else delete e.bendOffset;
            }
            // migra bend absoluto -> bendOffset usando midpoint dos endpoints
            if (!e.bendOffset && e.bend) {
                const bx = Number(e.bend.x);
                const by = Number(e.bend.y);
                if (Number.isFinite(bx) && Number.isFinite(by)) {
                    const aN = findNode(e.a);
                    const bN = findNode(e.b);
                    if (aN && bN) {
                        const midx = snap((aN.x + bN.x) / 2);
                        const midy = snap((aN.y + bN.y) / 2);
                        e.bendOffset = { dx: snap(bx - midx), dy: snap(by - midy) };
                    }
                }
                delete e.bend;
            }
        }
        state.lines = deepClone(s.lines || []);
        state.lines.forEach(ensureLineBadgeProps);
        state.texts = deepClone(s.texts || []);
        ensureAllTexts();
        normalizeSignagePreset();
        state.activeLineId = s.activeLineId ?? null;
        state.selectedLineId = state.activeLineId ?? null;

        if (typeof s.curveRoundness === "number" && Number.isFinite(s.curveRoundness)) {
            state.curveRoundness = Math.min(1, Math.max(0, s.curveRoundness));
        } else if (typeof data.curveRoundness === "number" && Number.isFinite(data.curveRoundness)) {
            state.curveRoundness = Math.min(1, Math.max(0, data.curveRoundness));
        }

        if (data.view) state.view = deepClone(data.view);

    ensureAtLeastOneLine();
    ensureAllTexts();
    normalizeSignagePreset();
    clearSelection();
    renderAll();

    // v4.8.4: recalcula o contador de nomes automáticos após importar
    let maxN = 0;
    for (const n of state.nodes) {
        const m = String(n?.name || "").match(/^Estação\s+(\d+)$/i);
        if (m) {
            const v = parseInt(m[1], 10);
            if (Number.isFinite(v)) maxN = Math.max(maxN, v);
        }
    }
    state.stationAutoNameIndex = maxN > 0 ? (maxN + 1) : 1;


    refreshSidebar();
}

function clearAll(push = true) {
    if (push) pushHistory();
    state.nodes = [];
    state.edges = [];
    state.lines = [];
    state.texts = [];
    state.stationAutoNameIndexByLine = {};

    state.activeLineId = null;
    state.selectedLineId = null;
    state.stationAutoNameIndex = 1;

    clearSelection();
    ensureAtLeastOneLine();
    ensureAllTexts();
    normalizeSignagePreset();
    renderAll();
    refreshSidebar();
}



// =========================
// Memória de mapas (5 slots locais)
// Ctrl+F: MOBINODE_GALLERY_SLOTS_KEY
// =========================
const MOBINODE_GALLERY_SLOTS_KEY = "mobinode.gallery.v1";
const MOBINODE_WHATS_NEW_VERSION = "v5.7.0_RC5"; // Ctrl+F: MOBINODE_WHATS_NEW_VERSION
const MOBINODE_MEMORY_SLOTS_KEY = "mobinode.memorySlots.v1"; // legado
const MOBINODE_GALLERY_SLOTS_MAX = 5;
let currentGallerySlot = null; // Ctrl+F: currentGallerySlot

function createEmptyGallerySlots() {
    return Array.from({ length: MOBINODE_GALLERY_SLOTS_MAX }, (_, i) => ({
        slot: i + 1,
        name: `Mapa ${i + 1}`,
        savedAt: null,
        json: "",
        preview: "",
    }));
}

function isProbablyMapJSON(txt) {
    try {
        const data = JSON.parse(txt);
        const s = data?.state || data;
        return !!(s && (Array.isArray(s.nodes) || Array.isArray(s.lines) || Array.isArray(s.edges) || Array.isArray(s.texts)));
    } catch {
        return false;
    }
}

function gallerySlotFromRaw(cur, idx) {
    const fallback = createEmptyGallerySlots()[idx];
    const jsonText = (typeof cur?.json === "string") ? cur.json : "";
    return {
        slot: idx + 1,
        name: (typeof cur?.name === "string" && cur.name.trim()) ? cur.name.trim() : fallback.name,
        savedAt: Number.isFinite(+cur?.savedAt) ? +cur.savedAt : null,
        json: jsonText,
        preview: (typeof cur?.preview === "string") ? cur.preview : (jsonText ? generateGalleryPreviewFromJSON(jsonText) : ""),
    };
}

function readGallerySlots() {
    try {
        const raw = localStorage.getItem(MOBINODE_GALLERY_SLOTS_KEY) || localStorage.getItem(MOBINODE_MEMORY_SLOTS_KEY);
        if (!raw) return createEmptyGallerySlots();

        const parsed = JSON.parse(raw);
        const arr = Array.isArray(parsed) ? parsed : [];
        const base = createEmptyGallerySlots();
        return base.map((_, idx) => gallerySlotFromRaw(arr[idx] || {}, idx));
    } catch (e) {
        console.error(e);
        return createEmptyGallerySlots();
    }
}

function writeGallerySlots(slots) {
    try {
        localStorage.setItem(MOBINODE_GALLERY_SLOTS_KEY, JSON.stringify(slots));
        return true;
    } catch (e) {
        console.error(e);
        return false;
    }
}

function formatGallerySlotDate(ts) {
    if (!ts) return "Vazio";
    try {
        return new Intl.DateTimeFormat("pt-BR", {
            dateStyle: "short",
            timeStyle: "short",
        }).format(new Date(ts));
    } catch {
        return new Date(ts).toLocaleString("pt-BR");
    }
}

function escapeHTML(str) {
    return String(str || "")
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#39;");
}

function galleryMiniPathFromPoints(points) {
    if (!Array.isArray(points) || !points.length) return "";
    return points.map((pt, idx) => `${idx === 0 ? "M" : "L"}${pt.x} ${pt.y}`).join(" ");
}

function galleryEscapeAttr(str) {
    return String(str || "").replaceAll('&', '&amp;').replaceAll('"', '&quot;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function generateGalleryPreview(parsedLike) {
    let data = parsedLike;
    try {
        if (typeof data === "string") data = JSON.parse(data);
    } catch {
        return "";
    }

    const s = data?.state || data;
    const nodes = Array.isArray(s?.nodes) ? s.nodes : [];
    const edges = Array.isArray(s?.edges) ? s.edges : [];
    const lines = Array.isArray(s?.lines) ? s.lines : [];
    const texts = Array.isArray(s?.texts) ? s.texts : [];

    if (!nodes.length && !edges.length && !texts.length) {
        return `<svg viewBox="0 0 160 90" class="galleryThumbSvg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="160" height="90" rx="12" fill="rgba(255,255,255,.04)"/><text x="80" y="48" text-anchor="middle" font-size="11" fill="rgba(255,255,255,.55)" font-family="system-ui, Arial">Sem mapa</text></svg>`;
    }

    const pts = [];
    nodes.forEach(n => {
        if (Number.isFinite(+n?.x) && Number.isFinite(+n?.y)) pts.push({x:+n.x,y:+n.y});
    });
    texts.forEach(t => {
        if (Number.isFinite(+t?.x) && Number.isFinite(+t?.y)) pts.push({x:+t.x,y:+t.y});
    });

    let minX = 0, minY = 0, maxX = 1000, maxY = 600;
    if (pts.length) {
        minX = Math.min(...pts.map(p => p.x));
        minY = Math.min(...pts.map(p => p.y));
        maxX = Math.max(...pts.map(p => p.x));
        maxY = Math.max(...pts.map(p => p.y));
    }
    const pad = 40;
    const width = Math.max(160, maxX - minX + pad * 2);
    const height = Math.max(90, maxY - minY + pad * 2);
    const ox = minX - pad;
    const oy = minY - pad;

    const lineById = new Map(lines.map(l => [l.id, l]));
    const nodeById = new Map(nodes.map(n => [n.id, n]));

    const edgeSvg = edges.map(e => {
        const a = nodeById.get(e.a);
        const b = nodeById.get(e.b);
        if (!a || !b) return "";
        const color = galleryEscapeAttr(lineById.get(e.lineId)?.color || '#78aaff');
        const width = Math.max(2, Number(lineById.get(e.lineId)?.width) || 8);
        const points = [{x:+a.x-ox, y:+a.y-oy}, {x:+b.x-ox, y:+b.y-oy}];
        return `<path d="${galleryMiniPathFromPoints(points)}" fill="none" stroke="${color}" stroke-width="${Math.max(2, width * 0.45)}" stroke-linecap="round" stroke-linejoin="round" opacity=".95"/>`;
    }).join('');

    const nodeSvg = nodes.map(n => {
        const cx = (+n.x) - ox;
        const cy = (+n.y) - oy;
        const fill = galleryEscapeAttr((n.stationStyle && n.stationStyle.fill) ? n.stationStyle.fill : '#ffffff');
        const stroke = galleryEscapeAttr((n.stationStyle && n.stationStyle.stroke) ? n.stationStyle.stroke : 'rgba(255,255,255,.35)');
        const r = Math.max(2.8, ((Number(n.stationStyle?.size) || 20) / 2) * 0.4);
        return `<circle cx="${cx}" cy="${cy}" r="${r}" fill="${fill}" stroke="${stroke}" stroke-width="1.5"/>`;
    }).join('');

    return `<svg viewBox="0 0 ${width} ${height}" class="galleryThumbSvg" xmlns="http://www.w3.org/2000/svg" aria-hidden="true"><rect width="${width}" height="${height}" rx="12" fill="rgba(255,255,255,.04)"/>${edgeSvg}${nodeSvg}</svg>`;
}

function generateGalleryPreviewFromJSON(txt) {
    try {
        return generateGalleryPreview(JSON.parse(txt));
    } catch {
        return "";
    }
}

function getCurrentGallerySlotLabel() {
    if (!Number.isInteger(currentGallerySlot) || currentGallerySlot < 0) return "Salvar no slot atual";
    return `Salvar no slot atual (Slot ${currentGallerySlot + 1})`;
}

function updateCurrentGallerySlotMenuLabel() {
    if (!dom.menuSaveCache) return;
    dom.menuSaveCache.textContent = getCurrentGallerySlotLabel();
    dom.menuSaveCache.disabled = !Number.isInteger(currentGallerySlot) || currentGallerySlot < 0;
}

function openMemoryPanel() {
    if (!dom.memoryPanel) return;
    renderMemorySlotsPanel();
    dom.memoryPanel.style.display = "grid";
    dom.memoryPanel.setAttribute("aria-hidden", "false");
}

function closeMemoryPanel() {
    if (!dom.memoryPanel) return;
    dom.memoryPanel.style.display = "none";
    dom.memoryPanel.setAttribute("aria-hidden", "true");
}

function saveCurrentMapToMemorySlot(slotIndex) {
    const slots = readGallerySlots();
    const slot = slots[slotIndex];
    if (!slot) return;

    slot.json = exportJSON();
    slot.savedAt = Date.now();
    if (!slot.name || /^Mapa\s+\d+$/i.test(slot.name)) {
        slot.name = `Mapa ${slot.slot}`;
    }
    slot.preview = generateGalleryPreviewFromJSON(slot.json);

    const ok = writeGallerySlots(slots);
    if (!ok) {
        alert("Não foi possível salvar nesse slot. O armazenamento local pode estar cheio ou bloqueado.");
        return;
    }

    currentGallerySlot = slotIndex;
    updateCurrentGallerySlotMenuLabel();
    renderMemorySlotsPanel();
    if (typeof showToast === "function") showToast(`Mapa salvo em ${slot.name}`);
}

function loadMemorySlot(slotIndex) {
    const slots = readGallerySlots();
    const slot = slots[slotIndex];
    if (!slot || !slot.json) {
        alert("Esse slot ainda está vazio.");
        return;
    }

    const ok = confirm(`Abrir ${slot.name}?\n\nO mapa atual será substituído.`);
    if (!ok) return;

    try {
        importJSON(slot.json);
        currentGallerySlot = slotIndex;
        updateCurrentGallerySlotMenuLabel();
        history.undo.length = 0;
        history.redo.length = 0;
        updateUndoRedoButtons();
        closeMemoryPanel();
        if (typeof showToast === "function") showToast(`Mapa carregado de ${slot.name}`);
    } catch (e) {
        console.error(e);
        alert("Não foi possível carregar esse slot. O JSON salvo pode estar corrompido.");
    }
}

function renameMemorySlot(slotIndex, nextName) {
    const slots = readGallerySlots();
    const slot = slots[slotIndex];
    if (!slot) return;

    slot.name = String(nextName || "").trim() || `Mapa ${slot.slot}`;
    if (!writeGallerySlots(slots)) {
        alert("Não foi possível atualizar o nome do mapa.");
        return;
    }

    renderMemorySlotsPanel();
}

function importJSONIntoMemorySlot(slotIndex, txt) {
    if (!isProbablyMapJSON(txt)) {
        alert("Esse texto não parece ser um JSON de mapa válido do Mobinode.");
        return false;
    }

    const slots = readGallerySlots();
    const slot = slots[slotIndex];
    if (!slot) return false;

    let pretty = txt;
    try {
        pretty = JSON.stringify(JSON.parse(txt), null, 2);
    } catch {}

    slot.json = pretty;
    slot.savedAt = Date.now();
    if (!slot.name || /^Mapa\s+\d+$/i.test(slot.name)) {
        slot.name = `Mapa ${slot.slot}`;
    }
    slot.preview = generateGalleryPreviewFromJSON(pretty);

    if (!writeGallerySlots(slots)) {
        alert("Não foi possível importar esse JSON para o slot.");
        return false;
    }

    renderMemorySlotsPanel();
    if (typeof showToast === "function") showToast(`JSON importado para ${slot.name}`);
    return true;
}

function openImportJSONIntoMemorySlot(slotIndex) {
    const slots = readGallerySlots();
    const slot = slots[slotIndex];
    if (!slot) return;

    openModal({
        title: `Importar JSON para ${slot.name || `Mapa ${slot.slot}`}`,
        value: slot.json || "",
        readOnly: false,
        primaryText: "Importar JSON",
        secondaryText: "Cancelar",
        tertiaryText: null,
        onPrimary: (val, close) => {
            const ok = importJSONIntoMemorySlot(slotIndex, val || "{}");
            if (ok) close();
        }
    });
}

function openExportJSONFromMemorySlot(slotIndex) {
    const slots = readGallerySlots();
    const slot = slots[slotIndex];
    if (!slot || !slot.json) {
        alert("Esse slot ainda está vazio.");
        return;
    }

    openModal({
        title: `Exportar JSON de ${slot.name}`,
        value: slot.json,
        readOnly: true,
        primaryText: "Copiar",
        tertiaryText: "Baixar",
        secondaryText: "Fechar",
        onPrimary: async (val) => {
            try {
                await navigator.clipboard.writeText(val);
            } catch {
                try {
                    dom.modalTextarea.focus();
                    dom.modalTextarea.select();
                    document.execCommand("copy");
                } catch {}
            }
        },
        onTertiary: (val) => {
            downloadJSONFile(val);
        }
    });
}

function clearMemorySlot(slotIndex) {
    const slots = readGallerySlots();
    const slot = slots[slotIndex];
    if (!slot) return;

    const ok = confirm(`Limpar ${slot.name}?\n\nIsso apaga o mapa salvo nesse espaço da Galeria.`);
    if (!ok) return;

    slots[slotIndex] = {
        slot: slot.slot,
        name: `Mapa ${slot.slot}`,
        savedAt: null,
        json: "",
        preview: "",
    };

    if (!writeGallerySlots(slots)) {
        alert("Não foi possível limpar esse espaço da Galeria.");
        return;
    }

    renderMemorySlotsPanel();

    if (currentGallerySlot === slotIndex) {
        currentGallerySlot = null;
        updateCurrentGallerySlotMenuLabel();
    }
}

function renderMemorySlotsPanel() {
    if (!dom.memorySlotsList) return;

    const slots = readGallerySlots();
    dom.memorySlotsList.innerHTML = slots.map((slot, index) => {
        const filled = !!slot.json;
        const title = escapeHTML(slot.name || `Mapa ${slot.slot}`);
        const when = filled ? `Salvo em ${escapeHTML(formatGallerySlotDate(slot.savedAt))}` : "Slot vazio";
        const preview = filled ? (slot.preview || generateGalleryPreviewFromJSON(slot.json)) : `<div class="galleryThumbPlaceholder">Slot vazio</div>`;

        if (filled) {
            return `
                <section class="memorySlotCard gallerySlotCard" data-slot-index="${index}">
                    <button type="button" class="memorySlotPreview is-clickable" data-action="load" data-slot-index="${index}" title="Abrir ${title}">${preview}</button>
                    <div class="memorySlotBody">
                        <div class="memorySlotTop">
                            <div>
                                <div class="memorySlotTitle galleryName" data-role="name" data-slot-index="${index}" contenteditable="plaintext-only" spellcheck="false">${title}</div>
                                <div class="memorySlotMeta">Slot ${slot.slot} • ${when}</div>
                            </div>
                        </div>
                        <div class="memorySlotActions">
                            <button type="button" data-action="save" data-slot-index="${index}">Sobrescrever mapa atual</button>
                            <button type="button" class="danger" data-action="clear" data-slot-index="${index}">Limpar</button>
                        </div>
                    </div>
                </section>
            `;
        }

        return `
            <section class="memorySlotCard gallerySlotCard is-empty" data-slot-index="${index}">
                <div class="memorySlotPreview">${preview}</div>
                <div class="memorySlotBody">
                    <div class="memorySlotTop">
                        <div>
                            <div class="memorySlotTitle">Mapa ${slot.slot}</div>
                            <div class="memorySlotMeta">Slot ${slot.slot} • ${when}</div>
                        </div>
                    </div>
                    <div class="memorySlotActions">
                        <button type="button" data-action="save" data-slot-index="${index}">Salvar mapa atual aqui</button>
                    </div>
                </div>
            </section>
        `;
    }).join("");
}
function getWhatsNewSeenKey() {
    return `mobinode.whatsnew.seen.${MOBINODE_WHATS_NEW_VERSION}`;
}

function openWhatsNewPanel() {
    const panel = document.getElementById("whatsNewPanel");
    if (!panel) return;
    panel.style.display = "grid";
    panel.setAttribute("aria-hidden", "false");
}

function closeWhatsNewPanel(opts = {}) {
    const panel = document.getElementById("whatsNewPanel");
    if (!panel) return;
    panel.style.display = "none";
    panel.setAttribute("aria-hidden", "true");
    if (!opts.skipPersist) {
        try { localStorage.setItem(getWhatsNewSeenKey(), "1"); } catch (e) {}
    }
}

function maybeShowWhatsNewPanel() {
    try {
        if (localStorage.getItem(getWhatsNewSeenKey()) === "1") return;
    } catch (e) {}

    window.setTimeout(() => {
        openWhatsNewPanel();
    }, 260);
}

// =========================
// UI bindings
// =========================
function bindUI() {
    // tools
    if (!dom.toolPointer) {
        const toolsGroup = document.getElementById("tools");
        if (toolsGroup) {
            dom.toolPointer = toolsGroup.querySelector('button[title="Seta"]') || toolsGroup.querySelector("button");
            if (dom.toolPointer) dom.toolPointer.classList.add("toolbtn");
        }
    }
    if (dom.toolPointer) dom.toolPointer.addEventListener("click", () => {
        // Modo mobile: a cruz de setas é só "voltar ao neutro" (sem abrir painéis).
        // Ctrl+F: dom.toolPointer.addEventListener("click"
        setTool("neutral");

        const mobile = (typeof isMobileLayout === "function" && isMobileLayout());
        if (mobile) {
            refreshSidebar();
            return;
        }

        showSidebar(true);
        openAccordion(dom.accLine);
        refreshSidebar();
    });

    // botão Pan
    if (dom.toolPan) dom.toolPan.addEventListener("click", () => {
        const next = (state.tool === "pan") ? "neutral" : "pan";
        setTool(next);
        try { showSidebar(next !== "pan"); } catch {}
        refreshSidebar();
    });


    // =========================
    // Ferramentas 2-estados (sem botão drag/move)
    // Estação / Linhas / Conexões
    // 1º clique: mover apenas
    // 2º clique: criar/conectar (armed)
    // =========================
    // Ctrl+F: toggleTwoStateTool
    function toggleTwoStateTool(tool, accordionEl, opts = {}) {
        if (!state.toolModes) state.toolModes = { network: "move", line: "move", connections: "move" };

        const already = (state.tool === tool);

        if (!already) {
            // 1º clique: entra na ferramenta (modo padrão: move)
            setTool(tool);
        } else {
            // 2º clique: alterna move <-> drag (criar/conectar)
            const cur = state.toolModes[tool] || "move";
            state.toolModes[tool] = (cur === "drag") ? "move" : "drag";

            // 🔥 pulo do gato: força refresh total da ferramenta
            setTool(tool);
        }

        if (opts.clearSelection) clearSelection();

        showSidebar(true);
        if (accordionEl) openAccordion(accordionEl);
        refreshSidebar();
    }


    // Ctrl+F: dom.toolStation.addEventListener("click"
    if (dom.toolStation) dom.toolStation.addEventListener("click", () => {
        toggleTwoStateTool("network", dom.accStation);
    });

    // Ctrl+F: dom.toolLine.addEventListener("click"
    if (dom.toolLine) dom.toolLine.addEventListener("click", () => {
        toggleTwoStateTool("line", dom.accLine, { clearSelection: true });
    });

    // Ctrl+F: dom.toolConnections.addEventListener("click"
    if (dom.toolConnections) dom.toolConnections.addEventListener("click", () => {
        toggleTwoStateTool("connections", dom.accConnections, { clearSelection: true });
    });

    // Botões da tooldock
    // Ctrl+F: dom.toolLine.addEventListener("click"
    // (v5.1.7) handler de Linhas agora é 2-estados e fica no bloco toggleTwoStateTool.

    // Ctrl+F: dom.toolConnections.addEventListener("click"
    // (v5.1.7) handler de Conexões agora é 2-estados e fica no bloco toggleTwoStateTool.

if (dom.toolText) dom.toolText.addEventListener("click", () => {
        setTool("text");
        // Por padrão, a ferramenta 📐 volta para "texto livre".
        // A sinalização (badge/nome) é escolhida nos pickers do painel.
        state.signagePreset = null;
        showSidebar(true);
        openAccordion(dom.accText);
        renderSignagePickers();
        refreshSidebar();
    });

    //painel shapes
    if (dom.toolShapes) dom.toolShapes.addEventListener("click", () => {
        setTool("shapes");
        showSidebar(true);
        openAccordion(dom.accShapes);
        refreshSidebar();
    });

    // ✅ Rotação (painel universal)
    // Ao clicar no ⟳, abrimos o painel Rotação no sidebar.
    // Ctrl+F: toolRotate
    if (dom.toolRotate) dom.toolRotate.addEventListener("click", () => {
        setTool("rotate");
        showSidebar(true);
        openAccordion(dom.accRotation);
        refreshSidebar();
    });

    // ===== Shapes UI (sliders + caixa numérica editável) =====
    // Ctrl+F: bindRangeNumber
    const bindRangeNumber = (rangeEl, numberEl, opts = {}) => {
        if (!rangeEl || !numberEl) return;

        const decimals = Number.isFinite(+opts.decimals) ? +opts.decimals : null;
        let syncing = false;

        const clamp = (v) => {
            const min = Number.isFinite(+rangeEl.min) ? +rangeEl.min : -Infinity;
            const max = Number.isFinite(+rangeEl.max) ? +rangeEl.max : +Infinity;
            return Math.min(max, Math.max(min, v));
        };

        const fmt = (v) => {
            if (decimals === null) return String(v);
            return Number(v).toFixed(decimals);
        };

        const syncFromRange = () => {
            if (syncing) return;
            syncing = true;
            try {
                numberEl.value = fmt(rangeEl.value);
            } finally {
                syncing = false;
            }
        };

        const syncFromNumber = () => {
            if (syncing) return;
            const raw = parseFloat(String(numberEl.value).replace(",", "."));
            if (!Number.isFinite(raw)) { syncFromRange(); return; }

            const v = clamp(raw);
            syncing = true;
            try {
                rangeEl.value = String(v);
                numberEl.value = fmt(v);
            } finally {
                syncing = false;
            }

            // dispara o mesmo caminho que o slider (live/applyShapesPanelToSelected)
            rangeEl.dispatchEvent(new Event("input", { bubbles: true }));
        };

        rangeEl.addEventListener("input", syncFromRange);
        numberEl.addEventListener("input", syncFromNumber);
        numberEl.addEventListener("change", syncFromNumber);
        syncFromRange();
    };

    // Opacidade
    bindRangeNumber(dom.shapeOpacity, dom.shapeOpacityVal, { decimals: 2 });

    // Dimensões
    bindRangeNumber(dom.shapeW, dom.shapeWVal);
    bindRangeNumber(dom.shapeH, dom.shapeHVal);
    bindRangeNumber(dom.shapeRX, dom.shapeRXVal);
    bindRangeNumber(dom.shapeSides, dom.shapeSidesVal);

    // Arco
    bindRangeNumber(dom.shapeArcR, dom.shapeArcRVal);
    bindRangeNumber(dom.shapeArcT, dom.shapeArcTVal);
    bindRangeNumber(dom.shapeArcA0, dom.shapeArcA0Val);
    bindRangeNumber(dom.shapeArcA1, dom.shapeArcA1Val);



    if (dom.shapeFillMode && dom.shapeFillColor) {
        const syncFillModeUI = () => {
            const custom = (dom.shapeFillMode.value === "custom");
            dom.shapeFillColor.disabled = !custom;
            dom.shapeFillColor.style.opacity = custom ? "1" : "0.5";
        };
        dom.shapeFillMode.addEventListener("change", syncFillModeUI);
        syncFillModeUI();
    }

    if (dom.btnShapeCreate) {
        dom.btnShapeCreate.addEventListener("click", () => {
            // arma/desarma
            state.shapeCreateArmed = !state.shapeCreateArmed;

            // feedback visual simples
            dom.btnShapeCreate.textContent = state.shapeCreateArmed ? "Clique no mapa" : "Criar";
            dom.btnShapeCreate.classList.toggle("active", state.shapeCreateArmed);

            updateCursor();
        });
    }

    // =========================
    // Shapes: edição via painel (aplica direto no shape selecionado)
    // =========================
    // Ctrl+F: applyShapesPanelToSelected
    const getSelectedShape = () => {
        if (!state.selectedTextId) return null;
        const t = findText(state.selectedTextId);
        if (!t) return null;
        if (t.kind === "shapeRect" || t.kind === "shapeCircle" || t.kind === "shapeArc" || t.kind === "shapePoly") return t;
        return null;
    };

    const applyShapesPanelToSelected = (opts = { push: true }) => {
        const t = getSelectedShape();
        if (!t) return;
        if (opts && opts.push) pushHistory();

        // kind
        const kk = (dom.shapeKind && dom.shapeKind.value) ? dom.shapeKind.value : "rect";
        const k = (kk === "arc") ? "shapeArc" : ((kk === "circle") ? "shapeCircle" : ((kk === "polygon") ? "shapePoly" : "shapeRect"));
        t.kind = k;

        // style
        t.fillMode = (dom.shapeFillMode && dom.shapeFillMode.value === "custom") ? "custom" : "line";
        t.lineId = state.activeLineId;
        if (dom.shapeFillColor && typeof dom.shapeFillColor.value === "string") t.fill = dom.shapeFillColor.value;
        if (dom.shapeOpacity && Number.isFinite(+dom.shapeOpacity.value)) t.opacity = +dom.shapeOpacity.value;

        // rotation
        if (dom.shapeRotation && Number.isFinite(+dom.shapeRotation.value)) t.rotation = +dom.shapeRotation.value;


        // geometry
        if (t.kind === "shapeArc") {
            const rO = (dom.shapeArcR && Number.isFinite(+dom.shapeArcR.value)) ? +dom.shapeArcR.value : (Number.isFinite(+t.rOuter) ? +t.rOuter : 80);
            const th = (dom.shapeArcT && Number.isFinite(+dom.shapeArcT.value)) ? +dom.shapeArcT.value : (Number.isFinite(+t.thickness) ? +t.thickness : 30);
            const a0 = (dom.shapeArcA0 && Number.isFinite(+dom.shapeArcA0.value)) ? +dom.shapeArcA0.value : (Number.isFinite(+t.a0) ? +t.a0 : -45);
            const a1 = (dom.shapeArcA1 && Number.isFinite(+dom.shapeArcA1.value)) ? +dom.shapeArcA1.value : (Number.isFinite(+t.a1) ? +t.a1 : 225);

            t.rOuter = Math.max(2, rO);
            t.thickness = Math.max(1, th);
            t.a0 = a0;
            t.a1 = a1;

            // anti-UX: evita arco invisível quando ângulos ficam iguais por default do input
            if (Number.isFinite(t.a0) && Number.isFinite(t.a1) && Math.abs(t.a1 - t.a0) < 1e-6) {
                t.a1 = t.a0 + 90;
            }

            // compat: mantém w/h como bounding box aproximado (ajuda em export futuro)
            t.w = Math.max(10, t.rOuter * 2);
            t.h = Math.max(10, t.rOuter * 2);
            t.rx = 0;
            t.r = Math.max(2, t.rOuter);
        } else {
            // se for círculo, interpreta shapeW como DIÂMETRO
            if (t.kind === "shapeCircle") {
                const d = (dom.shapeW && Number.isFinite(+dom.shapeW.value)) ? +dom.shapeW.value : (Number.isFinite(+t.r) ? +t.r * 2 : 80);
                t.r = Math.max(2, d / 2);
                t.w = d;
                t.h = d;
                t.rx = 0;
            } else if (t.kind === "shapePoly") {
                // polígono: usa w/h e sides
                const wv = (dom.shapeW && Number.isFinite(+dom.shapeW.value)) ? +dom.shapeW.value : t.w;
                const hv = (dom.shapeH && Number.isFinite(+dom.shapeH.value)) ? +dom.shapeH.value : t.h;
                const sv = (dom.shapeSides && Number.isFinite(+dom.shapeSides.value)) ? +dom.shapeSides.value : (Number.isFinite(+t.sides) ? +t.sides : 6);

                t.w = Math.max(10, wv);
                t.h = Math.max(10, hv);
                t.sides = Math.max(3, Math.min(24, Math.round(sv)));
                t.rx = 0;
                t.r = Math.max(2, Math.min(t.w, t.h) / 2);
            } else {
                // retângulo normal
                const wv = (dom.shapeW && Number.isFinite(+dom.shapeW.value)) ? +dom.shapeW.value : t.w;
                const hv = (dom.shapeH && Number.isFinite(+dom.shapeH.value)) ? +dom.shapeH.value : t.h;
                const rxv = (dom.shapeRX && Number.isFinite(+dom.shapeRX.value)) ? +dom.shapeRX.value : t.rx;

                t.w = Math.max(10, wv);
                t.h = Math.max(10, hv);
                t.rx = Math.max(0, rxv);
            }

        }

        ensureTextProps(t);
        renderAll();
        refreshSidebar();
    };

    // Mudanças “ao vivo”
    const live = (fn) => (ev) => {
        if (sidebarIsUpdating) return;
        fn(ev);
    };

    if (dom.shapeKind) dom.shapeKind.addEventListener("change", live(() => {
        if (dom.arcControls) dom.arcControls.style.display = (dom.shapeKind.value === "arc") ? "block" : "none";
        if (dom.rowShapeW) dom.rowShapeW.style.display = (dom.shapeKind.value === "arc") ? "none" : "block";
        if (dom.rowShapeH) dom.rowShapeH.style.display = (dom.shapeKind.value === "rect" || dom.shapeKind.value === "polygon") ? "block" : "none";
        if (dom.rowShapeRX) dom.rowShapeRX.style.display = (dom.shapeKind.value === "rect") ? "block" : "none";
        if (dom.rowShapeSides) dom.rowShapeSides.style.display = (dom.shapeKind.value === "polygon") ? "block" : "none";
        if (dom.shapeWLabel) dom.shapeWLabel.textContent = (dom.shapeKind.value === "circle") ? "Diâmetro" : "Largura";
        applyShapesPanelToSelected({ push: true });
    }));
    if (dom.shapeFillMode) dom.shapeFillMode.addEventListener("change", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeFillColor) dom.shapeFillColor.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeOpacity) dom.shapeOpacity.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeRotation) dom.shapeRotation.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeW) dom.shapeW.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeH) dom.shapeH.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeRX) dom.shapeRX.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeSides) dom.shapeSides.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));

    if (dom.shapeArcR) dom.shapeArcR.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeArcT) dom.shapeArcT.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeArcA0) dom.shapeArcA0.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));
    if (dom.shapeArcA1) dom.shapeArcA1.addEventListener("input", live(() => applyShapesPanelToSelected({ push: true })));

    if (dom.btnShapeDelete) {
        dom.btnShapeDelete.addEventListener("click", () => {
            const t = getSelectedShape();
            if (!t) return;
            pushHistory();
            deleteText(t.id);
            state.selectedTextId = null;
            renderAll();
            refreshSidebar();
        });
    }

    if (dom.btnShapeDuplicate) {
        dom.btnShapeDuplicate.addEventListener("click", () => {
            const t = getSelectedShape();
            if (!t) return;
            pushHistory();
            // duplica com leve offset
            const dup = addShape(t.x + 24, t.y + 24, {
                kind: t.kind,
                fillMode: t.fillMode,
                lineId: t.lineId,
                fill: t.fill,
                opacity: t.opacity,
                rotation: t.rotation,
                w: t.w,
                h: t.h,
                rx: t.rx,
                r: t.r,
            });
            ensureTextProps(dup);
            clearSelection();
            state.selectedTextId = dup.id;
            renderAll();
            refreshSidebar();
        });
    }




    // 🎨 Personalização (atalho de painel, não muda ferramenta)
    if (dom.toolPalette) dom.toolPalette.addEventListener("click", () => {
        showSidebar(true);
        openAccordion(dom.accPersonalizacao);
        // Não chamar refreshSidebar aqui pra não "roubar" o foco e abrir outro accordion.
    });
    if (dom.toolSelect) dom.toolSelect.addEventListener("click", () => {
        setTool("select");
        showSidebar(true);
        openAccordion(dom.accMulti);
        refreshSidebar();
    });
    if (dom.toolCurves) dom.toolCurves.addEventListener("click", () => {
        // Mantém a seleção (faz sentido editar a dobra da conexão selecionada)
        setTool("curves");
        showSidebar(true);
        openAccordion(dom.accLine);
        refreshSidebar();
    });

    // undo/redo
    if (dom.btnUndo) dom.btnUndo.addEventListener("click", undo);
    if (dom.btnRedo) dom.btnRedo.addEventListener("click", redo);

    if (dom.btnResetView) dom.btnResetView.addEventListener("click", () => {
        if (typeof fitViewToContent === "function") fitViewToContent(80);
    });


    // sidebar close
    if (dom.btnCloseSidebar) dom.btnCloseSidebar.addEventListener("click", () => showSidebar(false));
    if (dom.btnShowSidebar) dom.btnShowSidebar.addEventListener("click", () => showSidebar(true));


    // =========================
    // Arquivo / JSON modal
    // =========================
    // Ctrl+F: Arquivo / JSON modal
    function closeAllMenus() {
        document.querySelectorAll("#ui .dropdown.open").forEach((d) => d.classList.remove("open"));
    }

    // mantém compatibilidade: vários handlers antigos chamam closeFileMenu()
    function closeFileMenu() {
        closeAllMenus();
    }

    function toggleMenu(drop) {
        if (!drop) return;
        const wasOpen = drop.classList.contains("open");
        closeAllMenus();
        if (!wasOpen) drop.classList.add("open");
    }

    function toggleFileMenu() {
        toggleMenu(dom.fileDropdown);
    }

    // desktop: redistribui itens do menu Arquivo para outros dropdowns
    function isMobileUI() {
        return window.matchMedia("(max-width: 820px)").matches;
    }

    function moveMenuItem(el, targetMenu) {
        if (!el || !targetMenu) return;
        targetMenu.appendChild(el);
    }

    function redistributeTopMenus() {
        const fileMenu = dom.fileMenu || dom.fileDropdown?.querySelector(".dropdown-menu");
        if (!fileMenu) return;

        const mobile = isMobileUI();

        // itens existentes (um único conjunto — a gente só move entre menus)
        const items = {
            novo: dom.menuNewProject,
            importar: dom.menuImport,
            exportar: dom.menuExport,
            exportPNG: dom.menuExportPNG,
            exportPDF: dom.menuExportPDF,
            saveCache: dom.menuSaveCache,
            memory: dom.menuMemorySlots,
            limpar: dom.menuClear,
            config: dom.btnConfig,
            about: dom.btnAbout,
        };

        if (mobile) {
            // mobile: tudo volta pro hambúrguer
            Object.values(items).forEach((el) => moveMenuItem(el, fileMenu));

            // rótulos "clássicos" no menu Arquivo (mobile)
            if (items.config) { items.config.textContent = "Configurações"; items.config.title = "Configurações"; }
            if (items.about)  { items.about.textContent  = "Sobre";          items.about.title  = "Sobre"; }

            return;
        }

        // desktop: distribui pelos menus de cima
        // Arquivo
        moveMenuItem(items.novo, fileMenu);
        moveMenuItem(items.saveCache, fileMenu);
        moveMenuItem(items.memory, fileMenu);
        moveMenuItem(items.limpar, fileMenu);

        // Importar
        moveMenuItem(items.importar, dom.importMenu);

        // Exportar
        moveMenuItem(items.exportar, dom.exportMenu);
        moveMenuItem(items.exportPNG, dom.exportMenu);
        moveMenuItem(items.exportPDF, dom.exportMenu);

        // Configurações e Sobre (dropdown único)
        moveMenuItem(items.config, dom.settingsMenu);
        moveMenuItem(items.about, dom.settingsMenu);

        // rótulos no desktop (ficam mais "limpos")
        if (items.config) { items.config.textContent = "Ajustes";        items.config.title = "Ajustes"; }
        if (items.about)  { items.about.textContent  = "Ajuda e Sobre";  items.about.title  = "Ajuda e Sobre"; }
    }

    function openModal({ title, value, readOnly = false, primaryText = "OK", secondaryText = "Cancelar", tertiaryText = null, onPrimary = null, onTertiary = null }) {
        if (!dom.modal || !dom.modalTextarea || !dom.modalTitle) return;
        dom.modalTitle.textContent = title || "JSON";
        dom.modalTextarea.value = value ?? "";
        dom.modalTextarea.readOnly = !!readOnly;

        if (dom.btnModalPrimary) dom.btnModalPrimary.textContent = primaryText || "OK";
        if (dom.btnModalSecondary) dom.btnModalSecondary.textContent = secondaryText || "Cancelar";

        if (dom.btnModalTertiary) {
            if (tertiaryText) {
                dom.btnModalTertiary.style.display = "";
                dom.btnModalTertiary.textContent = tertiaryText;
            } else {
                dom.btnModalTertiary.style.display = "none";
                dom.btnModalTertiary.textContent = "";
            }
        }

        const close = () => {
            dom.modal.style.display = "none";
            dom.btnModalPrimary && (dom.btnModalPrimary.onclick = null);
            dom.btnModalSecondary && (dom.btnModalSecondary.onclick = null);
            dom.btnModalTertiary && (dom.btnModalTertiary.onclick = null);
        };

        dom.modal.style.display = "flex";

        const doPrimary = () => { if (onPrimary) onPrimary(dom.modalTextarea.value, close); else close(); };
        const doTertiary = () => { if (onTertiary) onTertiary(dom.modalTextarea.value, close); };

        if (dom.btnModalPrimary) dom.btnModalPrimary.onclick = doPrimary;
        if (dom.btnModalSecondary) dom.btnModalSecondary.onclick = close;
        if (dom.btnModalClose) dom.btnModalClose.onclick = close;

        if (dom.btnModalTertiary) dom.btnModalTertiary.onclick = doTertiary;

        // foca textarea
        setTimeout(() => {
            try {
                dom.modalTextarea.focus();
                if (!readOnly) dom.modalTextarea.select();
            } catch {}
        }, 0);

        // fechar no ESC
        const onKey = (ev) => {
            if (ev.key === "Escape") {
                document.removeEventListener("keydown", onKey);
                close();
            }
        };
        document.addEventListener("keydown", onKey);
    }

    function downloadJSONFile(jsonText) {
        try {
            const blob = new Blob([jsonText], { type: "application/json;charset=utf-8" });
            const url = URL.createObjectURL(blob);
            const a = document.createElement("a");
            a.href = url;
            a.download = "mobinode-mapa.json";
            document.body.appendChild(a);
            a.click();
            a.remove();
            URL.revokeObjectURL(url);
        } catch (e) {
            alert("Não consegui criar o arquivo. Tenta copiar o JSON manualmente.");
            console.error(e);
        }
    }

    // menus do topo (abre 1 por vez; fecha ao clicar fora / ESC)
    document.querySelectorAll("#ui .dropdown > button").forEach((btn) => {
        btn.addEventListener("click", (ev) => {
            ev.stopPropagation();
            toggleMenu(btn.parentElement);
        });
    });
    document.addEventListener("click", () => closeAllMenus());
    document.addEventListener("keydown", (ev) => {
        if (ev.key === "Escape") {
            closeAllMenus();
            closeMemoryPanel();
        }
    });

    // Ctrl+F: redistributeTopMenus
    redistributeTopMenus();
    window.addEventListener("resize", () => {
        redistributeTopMenus();
        closeAllMenus();


        // Ctrl+F: enforceMobileDockRules
        if (window.enforceMobileDockRules) window.enforceMobileDockRules();
    });

        // Configurações / Sobre (v4.4.1)
        if (dom.btnConfig) {
            dom.btnConfig.addEventListener("click", () => showSettingsModal(true));
        }
        if (dom.btnAbout) {
            dom.btnAbout.addEventListener("click", () => showAboutModal(true));
        }

        if (dom.btnSettingsClose) dom.btnSettingsClose.addEventListener("click", () => showSettingsModal(false));
        if (dom.btnAboutClose) dom.btnAboutClose.addEventListener("click", () => showAboutModal(false));

        if (dom.settingsModal) {
            dom.settingsModal.addEventListener("click", (ev) => {
                if (ev.target === dom.settingsModal) showSettingsModal(false);
            });
        }
        if (dom.aboutModal) {
            dom.aboutModal.addEventListener("click", (ev) => {
                if (ev.target === dom.aboutModal) showAboutModal(false);
            });
        }

        [dom.themeDark, dom.themeLight, dom.themeSystem].forEach((el) => {

            // Dock position (v4.6.1)
            [dom.dockPosSide, dom.dockPosBottom].forEach((el) => {
                if (!el) return;
                el.addEventListener("change", () => {
                    if (!el.checked) return;
                    setDockPosition(el.value, true);
                });
            });

            if (!el) return;
            el.addEventListener("change", () => {
                if (!el.checked) return;
                setThemeMode(el.value, true);
            });
        });

        // Snap to grid (Configurações)
        // Ctrl+F: snapToGridToggles (listener)
        if (dom.snapStationsToggle) {
            dom.snapStationsToggle.addEventListener("change", () => {
                setSnapFlags({ stations: dom.snapStationsToggle.checked }, true);
            });
        }
        if (dom.snapTextsToggle) {
            dom.snapTextsToggle.addEventListener("change", () => {
                setSnapFlags({ texts: dom.snapTextsToggle.checked }, true);
            });
        }
        if (dom.snapShapesToggle) {
            dom.snapShapesToggle.addEventListener("change", () => {
                setSnapFlags({ shapes: dom.snapShapesToggle.checked }, true);
            });
        }

        updateCurrentGallerySlotMenuLabel();

        if (dom.menuNewProject) {
            dom.menuNewProject.addEventListener("click", () => {
                closeFileMenu();
                const ok = confirm(`Criar um novo mapa?\n\nIsso vai apagar tudo o que foi feito e NÃO pode ser desfeito.`);
                if (!ok) return;

                // limpa estado e também zera histórico (novo projeto = sem Ctrl+Z pra voltar)
                state.nodes = [];
                state.edges = [];
                state.lines = [];
                state.texts = [];
                state.activeLineId = null;
                state.selectedLineId = null;
                clearSelection();
                ensureAtLeastOneLine();
                ensureAllTexts();
                normalizeSignagePreset();

                history.undo.length = 0;
                history.redo.length = 0;
                updateUndoRedoButtons();

                showHelpPanel(false);
                currentGallerySlot = null;
                updateCurrentGallerySlotMenuLabel();

                renderAll();
                refreshSidebar();
            });
        }

        if (dom.menuClear) {
            dom.menuClear.addEventListener("click", () => {
                closeFileMenu();
                const ok = confirm(`Limpar a tela?

                Essa ação pode ser desfeita com Ctrl+Z.`);
                if (!ok) return;
                clearAll(true); // pushHistory dentro
            });
        }

        if (dom.menuImport) {
            dom.menuImport.addEventListener("click", () => {
                closeFileMenu();
                openModal({
                    title: "Importar JSON",
                    value: "",
                    readOnly: false,
                    primaryText: "Importar",
                    secondaryText: "Cancelar",
                    tertiaryText: null,
                    onPrimary: (val, close) => {
                        importJSON(val || "{}");
                        close();
                    }
                });
            });
        }

        if (dom.menuExport) {
            dom.menuExport.addEventListener("click", () => {
                closeFileMenu();
                const txt = exportJSON();
                openModal({
                    title: "Exportar JSON",
                    value: txt,
                    readOnly: true,
                    primaryText: "Copiar",
                    tertiaryText: "Baixar",
                    secondaryText: "Fechar",
                    onPrimary: async (val, close) => {
                        try {
                            await navigator.clipboard.writeText(val);
                        } catch {
                            // fallback
                            try {
                                dom.modalTextarea.focus();
                                dom.modalTextarea.select();
                                document.execCommand("copy");
                            } catch {}
                        }
                    },
                    onTertiary: (val, close) => {
                        downloadJSONFile(val);
                    }
                });
            });
        }

        if (dom.menuExportPNG) {
            dom.menuExportPNG.addEventListener("click", async () => {
                closeFileMenu();
                await exportMapAsPNG({ scale: 2, includeGrid: false, filename: "mobinode.png" });
            });
        }

        if (dom.menuExportPDF) {
            dom.menuExportPDF.addEventListener("click", async () => {
                closeFileMenu();
                try {
                    await exportMapAsPDF_NoPopup({ includeGrid: false, title: "Mobinode" });
                } catch (err) {
                    console.error(err);
                    alert("Falha ao exportar PDF.");
                }
            });
        }

// Ctrl+F: menuSaveCache
        if (dom.menuSaveCache) {
            dom.menuSaveCache.addEventListener("click", () => {
                closeFileMenu();
                if (!Number.isInteger(currentGallerySlot) || currentGallerySlot < 0) {
                    alert("Abra um mapa da Galeria primeiro para definir o slot atual.");
                    return;
                }
                saveCurrentMapToMemorySlot(currentGallerySlot);
            });
         }

        // Ctrl+F: menuMemorySlots
        if (dom.menuMemorySlots) {
            dom.menuMemorySlots.addEventListener("click", () => {
                closeFileMenu();
                openMemoryPanel();
            });
        }

        // Ctrl+F: btnMemoryPanelClose
        if (dom.btnMemoryPanelClose) {
            dom.btnMemoryPanelClose.addEventListener("click", closeMemoryPanel);
        }

        if (dom.memoryPanel) {
            dom.memoryPanel.addEventListener("click", (ev) => {
                if (ev.target === dom.memoryPanel) closeMemoryPanel();
            });
        }

        const btnWhatsNewClose = document.getElementById("btnWhatsNewClose");
        const btnWhatsNewOk = document.getElementById("btnWhatsNewOk");
        const whatsNewPanel = document.getElementById("whatsNewPanel");

        if (btnWhatsNewClose) btnWhatsNewClose.addEventListener("click", () => closeWhatsNewPanel());
        if (btnWhatsNewOk) btnWhatsNewOk.addEventListener("click", () => closeWhatsNewPanel());
        if (whatsNewPanel) {
            whatsNewPanel.addEventListener("click", (ev) => {
                if (ev.target === whatsNewPanel) closeWhatsNewPanel();
            });
        }

        if (dom.memorySlotsList) {
            dom.memorySlotsList.addEventListener("click", (ev) => {
                const btn = ev.target.closest("button[data-action]");
                if (!btn) return;

                const slotIndex = parseInt(btn.dataset.slotIndex, 10);
                if (!Number.isFinite(slotIndex)) return;

                const action = btn.dataset.action;
                if (action === "save") saveCurrentMapToMemorySlot(slotIndex);
                else if (action === "load") loadMemorySlot(slotIndex);
                else if (action === "clear") clearMemorySlot(slotIndex);
            });

            dom.memorySlotsList.addEventListener("keydown", (ev) => {
                const nameEl = ev.target.closest('[data-role="name"]');
                if (!nameEl) return;
                if (ev.key === "Enter") {
                    ev.preventDefault();
                    nameEl.blur();
                }
            });

            dom.memorySlotsList.addEventListener("focusout", (ev) => {
                const nameEl = ev.target.closest('[data-role="name"]');
                if (!nameEl) return;
                const slotIndex = parseInt(nameEl.dataset.slotIndex, 10);
                if (!Number.isFinite(slotIndex)) return;
                renameMemorySlot(slotIndex, nameEl.textContent);
            });
        }


        async function exportMapAsPDF_NoPopup({ includeGrid = false, title = "Mobinode" } = {}) {
            // 🔤 O nome sugerido pelo "Salvar como PDF" do navegador geralmente vem do document.title.
            // Então a gente troca o title do documento PRINCIPAL temporariamente pra garantir o timestamp.
            const __originalDocTitle = document.title;
            try { document.title = title; } catch (_) {}

            // Reusa o SVG exportável (o MESMO pipeline que já deu certo no PNG)
            // IMPORTANTE: essa função precisa existir no seu arquivo:
            // buildExportSVGString({ includeGrid })
            const svgString = await buildExportSVGString({ includeGrid });

            // Remove width/height fixos do SVG (evita overflow e paginação)
            let svgForPrint = svgString
            .replace(/\swidth="[^"]*"/i, "")
            .replace(/\sheight="[^"]*"/i, "");

            // Garante preserveAspectRatio “contain”
            if (!/preserveAspectRatio=/i.test(svgForPrint)) {
                svgForPrint = svgForPrint.replace(
                    /<svg\b/i,
                    '<svg preserveAspectRatio="xMidYMid meet"'
                );
            }


            // HTML de impressão (A4 paisagem por padrão)
            const html = `<!doctype html>
            <html>
            <head>
            <meta charset="utf-8" />
            <title>${title}</title>
            <style>
            /* 1 página SEMPRE */
            @page { size: A4 landscape; margin: 0; }

            html, body { margin: 0; padding: 0; }

            /* “Folha” física */
            .sheet {
                width: 297mm;
                height: 210mm;
                overflow: hidden;         /* impede quebrar página */
                display: grid;
                place-items: center;
                background: white;
            }

            /* SVG vira “contain” */
            svg {
                width: 100% !important;
                height: 100% !important;
                display: block;
            }
            </style>

            </head>
            <body>
            <div class="sheet">
            ${svgString}
            </div>
            <script>
            // Espera o SVG entrar no layout antes de imprimir
            requestAnimationFrame(() => setTimeout(() => {
                window.focus();
                window.print();
            }, 50));
            </script>
            </body>
            </html>`;

            // Iframe invisível (não é popup)
            const iframe = document.createElement("iframe");
            iframe.style.position = "fixed";
            iframe.style.left = "-99999px";
            iframe.style.top = "0";
            iframe.style.width = "1px";
            iframe.style.height = "1px";
            iframe.style.opacity = "0";
            iframe.style.pointerEvents = "none";
            iframe.setAttribute("aria-hidden", "true");
            document.body.appendChild(iframe);

            const doc = iframe.contentDocument || iframe.contentWindow.document;
            doc.open();
            doc.write(html);
            doc.close();

            // Limpeza (afterprint nem sempre dispara no iframe, então usamos timeout também)
            const cleanup = () => {
                try { iframe.remove(); } catch (_) {}
                try { document.title = __originalDocTitle; } catch (_) {}
            };
            try {
                iframe.contentWindow.addEventListener("afterprint", cleanup, { once: true });
            } catch (_) {}
            setTimeout(cleanup, 4000);
        }



        function showPopupHelpModal() {
            openModal({
                title: "Permitir popups para exportar PDF",
                value:
                `O navegador bloqueou a nova aba usada para gerar o PDF.

                Como liberar (Chrome/Edge):
                1) Na barra de endereços, procure o ícone de popups bloqueados (janela com um X).
                2) Clique e selecione “Permitir popups”.
                3) Volte aqui e clique em “Tentar novamente”.`,
                readOnly: true,
                primaryText: "Tentar novamente",
                secondaryText: "Fechar",
                onPrimary: () => {
                    // re-dispara o clique do menu (ou chama diretamente a função de export)
                    if (dom.menuExportPDF) dom.menuExportPDF.click();
                }
            });
        }

        // =========================
        // Linhas: criar / definir ativa / editar / excluir
        // =========================
        const LINE_COLORS = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#f97316", "#84cc16"];

        function nextLineName() {
            // tenta manter sequência "Linha N"
            let maxN = 0;
            for (const l of state.lines) {
                const m = /^\s*Linha\s+(\d+)\s*$/i.exec(l.name || "");
                if (m) maxN = Math.max(maxN, parseInt(m[1], 10) || 0);
            }
            return `Linha ${maxN + 1}`;
        }

        function createLine() {
            const idx = state.lines.length;
            const l = {
                id: uid(),
                name: nextLineName(),
                color: LINE_COLORS[idx % LINE_COLORS.length],
                width: 8,
                style: "solid",
                badgeEnabled: true,
                badgeText: "",
                badgePosition: "start",
            };
            ensureLineBadgeProps(l);
            state.lines.push(l);

            // v4.8.4: ao criar uma linha nova, o contador de estações dela começa do 1
            state.stationAutoNameIndexByLine = state.stationAutoNameIndexByLine || {};
            state.stationAutoNameIndexByLine[l.id] = 1;

            state.selectedLineId = l.id;
            if (!state.activeLineId) state.activeLineId = l.id;
            renderAll();
            refreshSidebar();
            return l;
        }

        if (dom.btnAddLine) {
            dom.btnAddLine.addEventListener("click", () => {
                pushHistory();
                createLine();
            });
        }


        if (dom.btnDeleteLine) {
            dom.btnDeleteLine.addEventListener("click", () => {
                const lineId = state.selectedLineId || state.activeLineId;
                const line = findLine(lineId);
                if (!line) return;

                const ok = confirm(`Excluir a linha "${line.name}"?\n\nAs conexões dessa linha também serão removidas.`);
                if (!ok) return;

                pushHistory();

                // remove edges dessa linha
                state.edges = state.edges.filter((e) => e.lineId !== lineId);

                // remove linha
                state.lines = state.lines.filter((l) => l.id !== lineId);

                // ajusta active/selected
                if (state.activeLineId === lineId) state.activeLineId = state.lines[0]?.id ?? null;
                if (state.selectedLineId === lineId) state.selectedLineId = state.activeLineId;

                ensureAtLeastOneLine();
                ensureAllTexts();
                normalizeSignagePreset();
                renderAll();
                refreshSidebar();
            });
        }

        function applyLineFieldEdits(mutator) {
            if (sidebarIsUpdating) return;
            const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
            if (!line) return;
            pushHistory();
            mutator(line);
            updateStationToolBadge();
            renderAll();
            refreshSidebar();
        }


        if (dom.lineName) {
            const keyFor = () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                return line ? `line:${line.id}:name` : null;
            };

            dom.lineName.addEventListener("focus", () => beginGroupedEdit(keyFor()));
            dom.lineName.addEventListener("blur", () => endGroupedEdit(keyFor()));

            dom.lineName.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                if (!line) return;
                ensureGroupedHistory(`line:${line.id}:name`);
                line.name = dom.lineName.value;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }


        if (dom.lineBadgeEnabled) {
            dom.lineBadgeEnabled.addEventListener("change", () => {
                applyLineFieldEdits((line) => {
                    line.badgeEnabled = !!dom.lineBadgeEnabled.checked;
                });
            });
        }


        if (dom.lineBadgeText) {
            dom.lineBadgeText.addEventListener("focus", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                beginGroupedEdit(line ? `line:${line.id}:badgeText` : null);
            });
            dom.lineBadgeText.addEventListener("blur", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                endGroupedEdit(line ? `line:${line.id}:badgeText` : null);
            });

            dom.lineBadgeText.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                if (!line) return;
                const clipped = sanitizeLineBadgeText(dom.lineBadgeText.value);
                if (dom.lineBadgeText.value !== clipped) dom.lineBadgeText.value = clipped;
                ensureGroupedHistory(`line:${line.id}:badgeText`);
                line.badgeText = clipped;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        if (dom.lineBadgePosStart) {
            dom.lineBadgePosStart.addEventListener("change", () => {
                if (!dom.lineBadgePosStart.checked) return;
                applyLineFieldEdits((line) => {
                    line.badgePosition = "start";
                });
            });
        }
        if (dom.lineBadgePosEnd) {
            dom.lineBadgePosEnd.addEventListener("change", () => {
                if (!dom.lineBadgePosEnd.checked) return;
                applyLineFieldEdits((line) => {
                    line.badgePosition = "end";
                });
            });
        }


        if (dom.lineColor) {
            dom.lineColor.addEventListener("focus", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                beginGroupedEdit(line ? `line:${line.id}:color` : null);
            });
            dom.lineColor.addEventListener("blur", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                endGroupedEdit(line ? `line:${line.id}:color` : null);
            });

            dom.lineColor.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                if (!line) return;
                ensureGroupedHistory(`line:${line.id}:color`);
                line.color = dom.lineColor.value;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        // =========================
        // v4.8.0: Traço secundário (estilo Recife-like)
        // =========================
        if (dom.lineSecondaryEnabled) {
            dom.lineSecondaryEnabled.addEventListener("change", () => {
                applyLineFieldEdits((line) => {
                    ensureLineBadgeProps(line);
                    line.secondaryEnabled = !!dom.lineSecondaryEnabled.checked;
                });
            });
        }

        if (dom.lineSecondaryMode) {
            dom.lineSecondaryMode.addEventListener("change", () => {
                applyLineFieldEdits((line) => {
                    ensureLineBadgeProps(line);
                    const v = String(dom.lineSecondaryMode.value || "custom");
                    line.secondaryMode = (v === "line") ? "line" : "custom";
                });
            });
        }

        if (dom.lineSecondaryLineId) {
            dom.lineSecondaryLineId.addEventListener("change", () => {
                applyLineFieldEdits((line) => {
                    ensureLineBadgeProps(line);
                    line.secondaryLineId = String(dom.lineSecondaryLineId.value || "");
                });
            });
        }

        if (dom.lineSecondaryColor) {
            dom.lineSecondaryColor.addEventListener("focus", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                beginGroupedEdit(line ? `line:${line.id}:secondaryColor` : null);
            });
            dom.lineSecondaryColor.addEventListener("blur", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                endGroupedEdit(line ? `line:${line.id}:secondaryColor` : null);
            });
            dom.lineSecondaryColor.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                if (!line) return;
                ensureLineBadgeProps(line);
                ensureGroupedHistory(`line:${line.id}:secondaryColor`);
                line.secondaryColor = dom.lineSecondaryColor.value;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        if (dom.lineSecondaryColorHex) {
            dom.lineSecondaryColorHex.addEventListener("focus", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                beginGroupedEdit(line ? `line:${line.id}:secondaryColor` : null);
            });
            dom.lineSecondaryColorHex.addEventListener("blur", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                endGroupedEdit(line ? `line:${line.id}:secondaryColor` : null);
            });
            dom.lineSecondaryColorHex.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                if (!line) return;
                const h = normalizeHex(dom.lineSecondaryColorHex.value);
                if (!h) return;
                ensureLineBadgeProps(line);
                ensureGroupedHistory(`line:${line.id}:secondaryColor`);
                line.secondaryColor = h;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }


        if (dom.lineColorHex) {
            dom.lineColorHex.addEventListener("focus", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                beginGroupedEdit(line ? `line:${line.id}:color` : null);
            });
            dom.lineColorHex.addEventListener("blur", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                endGroupedEdit(line ? `line:${line.id}:color` : null);
            });

            dom.lineColorHex.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                if (!line) return;
                const h = normalizeHex(dom.lineColorHex.value);
                if (!h) return;
                ensureGroupedHistory(`line:${line.id}:color`);
                line.color = h;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }


        if (dom.lineWidth) {
            dom.lineWidth.addEventListener("focus", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                beginGroupedEdit(line ? `line:${line.id}:width` : null);
            });
            dom.lineWidth.addEventListener("blur", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                endGroupedEdit(line ? `line:${line.id}:width` : null);
            });

            dom.lineWidth.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                if (!line) return;
                const w = clamp(parseInt(dom.lineWidth.value, 10) || 8, 2, 30);
                // clamp visual: se digitar além do permitido, volta pro limite
                if (String(w) !== String(dom.lineWidth.value)) dom.lineWidth.value = String(w);
                if (dom.lineWidthRange) dom.lineWidthRange.value = String(w);
                ensureGroupedHistory(`line:${line.id}:width`);
                line.width = w;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        // Slider de espessura da linha (v4.4.7)
        if (dom.lineWidthRange) {
            dom.lineWidthRange.addEventListener("focus", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                beginGroupedEdit(line ? `line:${line.id}:width` : null);
            });
            dom.lineWidthRange.addEventListener("blur", () => {
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                endGroupedEdit(line ? `line:${line.id}:width` : null);
            });

            dom.lineWidthRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
                if (!line) return;
                const w = clamp(parseInt(dom.lineWidthRange.value, 10) || 8, 2, 30);
                if (dom.lineWidth) dom.lineWidth.value = String(w);
                if (String(w) !== String(dom.lineWidthRange.value)) dom.lineWidthRange.value = String(w);
                ensureGroupedHistory(`line:${line.id}:width`);
                line.width = w;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }


        // =========================
        // Painel Conexões: estilo da linha técnica (_connector_)
        // =========================
        // Ctrl+F: connLineColor
        function getConnectorLineObj() {
            const id = (typeof ensureConnectorLine === "function") ? ensureConnectorLine() : null;
            return id ? findLine(id) : null;
        }

        if (dom.connLineColor) {
            dom.connLineColor.addEventListener("focus", () => beginGroupedEdit("connector:color"));
            dom.connLineColor.addEventListener("blur", () => endGroupedEdit("connector:color"));
            dom.connLineColor.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const conn = getConnectorLineObj();
                if (!conn) return;
                ensureGroupedHistory("connector:color");
                conn.color = dom.connLineColor.value;
                if (dom.connLineColorHex) dom.connLineColorHex.value = conn.color;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        if (dom.connLineColorHex) {
            dom.connLineColorHex.addEventListener("focus", () => beginGroupedEdit("connector:color"));
            dom.connLineColorHex.addEventListener("blur", () => endGroupedEdit("connector:color"));
            dom.connLineColorHex.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const conn = getConnectorLineObj();
                if (!conn) return;
                const h = normalizeHex(dom.connLineColorHex.value);
                if (!h) return;
                ensureGroupedHistory("connector:color");
                conn.color = h;
                if (dom.connLineColor) dom.connLineColor.value = conn.color;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        if (dom.connLineWidth) {
            dom.connLineWidth.addEventListener("focus", () => beginGroupedEdit("connector:width"));
            dom.connLineWidth.addEventListener("blur", () => endGroupedEdit("connector:width"));
            dom.connLineWidth.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const conn = getConnectorLineObj();
                if (!conn) return;
                const w = clamp(parseInt(dom.connLineWidth.value, 10) || 10, 1, 30);
                if (String(w) !== String(dom.connLineWidth.value)) dom.connLineWidth.value = String(w);
                if (dom.connLineWidthRange) dom.connLineWidthRange.value = String(w);
                ensureGroupedHistory("connector:width");
                conn.width = w;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        if (dom.connLineWidthRange) {
            dom.connLineWidthRange.addEventListener("focus", () => beginGroupedEdit("connector:width"));
            dom.connLineWidthRange.addEventListener("blur", () => endGroupedEdit("connector:width"));
            dom.connLineWidthRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const conn = getConnectorLineObj();
                if (!conn) return;
                const w = clamp(parseInt(dom.connLineWidthRange.value, 10) || 10, 1, 30);
                if (dom.connLineWidth) dom.connLineWidth.value = String(w);
                if (String(w) !== String(dom.connLineWidthRange.value)) dom.connLineWidthRange.value = String(w);
                ensureGroupedHistory("connector:width");
                conn.width = w;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }


        // =========================
        // Painel Conexões: estilo dos PONTOS (nós) da linha técnica
        // =========================
        // Ctrl+F: connNodeSize
        function ensureConnStyleObj(conn) {
            if (!conn.connectorStyle) conn.connectorStyle = {};
            return conn.connectorStyle;
        }

        if (dom.connNodeShape) {
            dom.connNodeShape.addEventListener("change", () => {
                if (sidebarIsUpdating) return;
                const conn = getConnectorLineObj(); if (!conn) return;
                ensureGroupedHistory("connector:nodes");
                const st = ensureConnStyleObj(conn);
                st.nodeShape = dom.connNodeShape.value || "circle";
                renderAll(); refreshSidebarPreserveInput();
            });
        }

        function applyConnNodeSize(v) {
            const conn = getConnectorLineObj(); if (!conn) return;
            const st = ensureConnStyleObj(conn);
            st.nodeSize = v;
        }

        if (dom.connNodeSize) {
            dom.connNodeSize.addEventListener("focus", () => beginGroupedEdit("connector:nodes"));
            dom.connNodeSize.addEventListener("blur", () => endGroupedEdit("connector:nodes"));
            dom.connNodeSize.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const v = clamp(parseInt(dom.connNodeSize.value, 10) || 8, 2, 30);
                if (String(v) !== String(dom.connNodeSize.value)) dom.connNodeSize.value = String(v);
                if (dom.connNodeSizeRange) dom.connNodeSizeRange.value = String(v);
                ensureGroupedHistory("connector:nodes");
                applyConnNodeSize(v);
                renderAll(); refreshSidebarPreserveInput();
            });
        }

        if (dom.connNodeSizeRange) {
            dom.connNodeSizeRange.addEventListener("focus", () => beginGroupedEdit("connector:nodes"));
            dom.connNodeSizeRange.addEventListener("blur", () => endGroupedEdit("connector:nodes"));
            dom.connNodeSizeRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const v = clamp(parseInt(dom.connNodeSizeRange.value, 10) || 8, 2, 30);
                if (dom.connNodeSize) dom.connNodeSize.value = String(v);
                if (String(v) !== String(dom.connNodeSizeRange.value)) dom.connNodeSizeRange.value = String(v);
                ensureGroupedHistory("connector:nodes");
                applyConnNodeSize(v);
                renderAll(); refreshSidebarPreserveInput();
            });
        }

        function applyConnNodeFill(color) {
            const conn = getConnectorLineObj(); if (!conn) return;
            const st = ensureConnStyleObj(conn);
            st.nodeFill = color;
        }

        if (dom.connNodeFill) {
            dom.connNodeFill.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                ensureGroupedHistory("connector:nodes");
                applyConnNodeFill(dom.connNodeFill.value);
                if (dom.connNodeFillHex) dom.connNodeFillHex.value = dom.connNodeFill.value;
                renderAll(); refreshSidebarPreserveInput();
            });
        }
        if (dom.connNodeFillHex) {
            dom.connNodeFillHex.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const h = normalizeHex(dom.connNodeFillHex.value);
                if (!h) return;
                ensureGroupedHistory("connector:nodes");
                applyConnNodeFill(h);
                if (dom.connNodeFill) dom.connNodeFill.value = h;
                renderAll(); refreshSidebarPreserveInput();
            });
        }

        function applyConnNodeStroke(color) {
            const conn = getConnectorLineObj(); if (!conn) return;
            const st = ensureConnStyleObj(conn);
            st.nodeStroke = color;
        }

        if (dom.connNodeStroke) {
            dom.connNodeStroke.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                ensureGroupedHistory("connector:nodes");
                applyConnNodeStroke(dom.connNodeStroke.value);
                if (dom.connNodeStrokeHex) dom.connNodeStrokeHex.value = dom.connNodeStroke.value;
                renderAll(); refreshSidebarPreserveInput();
            });
        }
        if (dom.connNodeStrokeHex) {
            dom.connNodeStrokeHex.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                // aqui aceitamos hex normalizado; se quiser RGBA livre, tira normalizeHex e aceita string direta
                const h = normalizeHex(dom.connNodeStrokeHex.value);
                if (!h) return;
                ensureGroupedHistory("connector:nodes");
                applyConnNodeStroke(h);
                if (dom.connNodeStroke) dom.connNodeStroke.value = h;
                renderAll(); refreshSidebarPreserveInput();
            });
        }

        function applyConnNodeStrokeW(v) {
            const conn = getConnectorLineObj(); if (!conn) return;
            const st = ensureConnStyleObj(conn);
            st.nodeStrokeWidth = v;
        }

        if (dom.connNodeStrokeWidth) {
            dom.connNodeStrokeWidth.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const v = clamp(parseInt(dom.connNodeStrokeWidth.value, 10) || 2, 0, 10);
                if (String(v) !== String(dom.connNodeStrokeWidth.value)) dom.connNodeStrokeWidth.value = String(v);
                if (dom.connNodeStrokeWidthRange) dom.connNodeStrokeWidthRange.value = String(v);
                ensureGroupedHistory("connector:nodes");
                applyConnNodeStrokeW(v);
                renderAll(); refreshSidebarPreserveInput();
            });
        }

        if (dom.connNodeStrokeWidthRange) {
            dom.connNodeStrokeWidthRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const v = clamp(parseInt(dom.connNodeStrokeWidthRange.value, 10) || 2, 0, 10);
                if (dom.connNodeStrokeWidth) dom.connNodeStrokeWidth.value = String(v);
                if (String(v) !== String(dom.connNodeStrokeWidthRange.value)) dom.connNodeStrokeWidthRange.value = String(v);
                ensureGroupedHistory("connector:nodes");
                applyConnNodeStrokeW(v);
                renderAll(); refreshSidebarPreserveInput();
            });
        }



        // v4.6.1: aplicar espessura em todas as linhas
        if (dom.applyLineWidthAll) {
            dom.applyLineWidthAll.addEventListener("click", () => {
                const wRaw = parseFloat(dom.lineWidth?.value || dom.lineWidthRange?.value || "8");
                const w = clamp(Number.isFinite(wRaw) ? wRaw : 8, 2, 30);
                if (dom.lineWidth && String(w) !== String(dom.lineWidth.value)) dom.lineWidth.value = String(w);
                if (dom.lineWidthRange && String(w) !== String(dom.lineWidthRange.value)) dom.lineWidthRange.value = String(w);

                const n = (state.lines || []).filter(l => !(l && (l.role === "connector" || l.name === "__connector__"))).length;
                if (n < 2) {
                    alert("Não há outras linhas para aplicar em massa.");
                    return;
                }

                pushHistory();
                for (const line of state.lines) {
                    if (line && (line.role === "connector" || line.name === "__connector__")) continue;
                    line.width = w;
                }
                renderAll();
                refreshSidebar();
            });
        }

        if (dom.lineStyle) {
            dom.lineStyle.addEventListener("change", () => {
                applyLineFieldEdits((line) => {
                    line.style = dom.lineStyle.value;
                });
            });
        }

        // =========================
        // Curvas (v4.7.3)
        // =========================
        function clamp01(n) {
            const v = Number(n);
            return Number.isFinite(v) ? Math.min(1, Math.max(0, v)) : 0;
        }

        function syncCurveInputs(v) {
            if (dom.curveRoundnessRange && String(v) !== String(dom.curveRoundnessRange.value)) dom.curveRoundnessRange.value = String(v);
            if (dom.curveRoundness && String(v) !== String(dom.curveRoundness.value)) dom.curveRoundness.value = String(v);
        }

        syncCurveInputs(state.curveRoundness);

        if (dom.curveRoundnessRange) {
            dom.curveRoundnessRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                pushHistory();
                const v = clamp01(dom.curveRoundnessRange.value);
                state.curveRoundness = v;
                syncCurveInputs(v);
                renderAll();
            });
        }

        if (dom.curveRoundness) {
            dom.curveRoundness.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                pushHistory();
                const v = clamp01(dom.curveRoundness.value);
                state.curveRoundness = v;
                syncCurveInputs(v);
                renderAll();
            });
        }

        if (dom.btnCurveReset) {
            dom.btnCurveReset.addEventListener("click", () => {
                pushHistory();
                state.curveRoundness = 0.35;
                syncCurveInputs(state.curveRoundness);
                renderAll();
                refreshSidebar();
            });
        }

        // help
        if (dom.btnHelp) dom.btnHelp.addEventListener("click", () => toggleHelpPanel());
        if (dom.btnHelpClose) dom.btnHelpClose.addEventListener("click", () => showHelpPanel(false));

        // ✅ checkboxes: mostram/ocultam campos e ativam/desativam renderização
        if (dom.useStationPrefix) {
            dom.useStationPrefix.addEventListener("change", () => {
                if (sidebarIsUpdating) return;
                if (state.selectedNodeIds.size !== 1) return;
                const id = [...state.selectedNodeIds][0];
                const n = findNode(id);
                if (!n) return;

                pushHistory();
                n.prefixEnabled = !!dom.useStationPrefix.checked;
                setFieldVisible(dom.stationPrefixField, n.prefixEnabled);
                renderAll();
                refreshSidebar();
            });
        }

        if (dom.useStationSuffix) {
            dom.useStationSuffix.addEventListener("change", () => {
                if (sidebarIsUpdating) return;
                if (state.selectedNodeIds.size !== 1) return;
                const id = [...state.selectedNodeIds][0];
                const n = findNode(id);
                if (!n) return;

                pushHistory();
                n.suffixEnabled = !!dom.useStationSuffix.checked;
                setFieldVisible(dom.stationSuffixField, n.suffixEnabled);
                renderAll();
                refreshSidebar();
            });
        }

        // station fields

        if (dom.stationPrefix) {
            const keyFor = () => (state.selectedNodeIds.size === 1) ? `node:${[...state.selectedNodeIds][0]}:prefix` : null;
            dom.stationPrefix.addEventListener("focus", () => beginGroupedEdit(keyFor()));
            dom.stationPrefix.addEventListener("blur", () => endGroupedEdit(keyFor()));

            dom.stationPrefix.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                if (state.selectedNodeIds.size !== 1) return;
                const id = [...state.selectedNodeIds][0];
                const n = findNode(id);
                if (!n) return;
                ensureGroupedHistory(`node:${id}:prefix`);
                n.prefix = dom.stationPrefix.value;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }


        if (dom.stationName) {
            const keyFor = () => (state.selectedNodeIds.size === 1) ? `node:${[...state.selectedNodeIds][0]}:name` : null;
            dom.stationName.addEventListener("focus", () => beginGroupedEdit(keyFor()));
            dom.stationName.addEventListener("blur", () => endGroupedEdit(keyFor()));

            dom.stationName.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                if (state.selectedNodeIds.size !== 1) return;
                const id = [...state.selectedNodeIds][0];
                const n = findNode(id);
                if (!n) return;
                ensureGroupedHistory(`node:${id}:name`);
                n.name = dom.stationName.value;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }


        if (dom.stationSuffix) {
            const keyFor = () => (state.selectedNodeIds.size === 1) ? `node:${[...state.selectedNodeIds][0]}:suffix` : null;
            dom.stationSuffix.addEventListener("focus", () => beginGroupedEdit(keyFor()));
            dom.stationSuffix.addEventListener("blur", () => endGroupedEdit(keyFor()));

            dom.stationSuffix.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                if (state.selectedNodeIds.size !== 1) return;
                const id = [...state.selectedNodeIds][0];
                const n = findNode(id);
                if (!n) return;
                ensureGroupedHistory(`node:${id}:suffix`);
                n.suffix = dom.stationSuffix.value;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        if (dom.stationOrientation) {
            dom.stationOrientation.addEventListener("change", () => {
                if (sidebarIsUpdating) return;
                if (state.selectedNodeIds.size !== 1) return;
                const id = [...state.selectedNodeIds][0];
                const n = findNode(id);
                if (!n) return;

                const ang = parseFloat(dom.stationOrientation.value);
                pushHistory();
                n.labelAngle = Number.isFinite(ang) ? ang : 0;
                renderAll();
                refreshSidebar();
            });
        }

        function clampLabelOffset(v){
            const n = Number(v);
            if (!Number.isFinite(n)) return 0;
            return Math.max(-120, Math.min(120, n));
        }

        function setLabelOffsetForSelection(dx, dy){
            const ids = [...state.selectedNodeIds];
            if (ids.length < 2) return;

            pushHistory();
            for (const id of ids) {
                const n = findNode(id);
                if (!n) continue;
                if (!n.labelOffset || typeof n.labelOffset !== "object") n.labelOffset = { dx: 0, dy: 0 };
                n.labelOffset.dx = dx;
                n.labelOffset.dy = dy;
            }
            renderAll();
            refreshSidebar?.();
        }

        // X (seleção)
        if (dom.multiStationLabelOffsetXRange && dom.multiStationLabelOffsetX) {
            dom.multiStationLabelOffsetXRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                if (state.selectedNodeIds.size < 2) return;

                const x = clampLabelOffset(dom.multiStationLabelOffsetXRange.value);
                dom.multiStationLabelOffsetX.value = String(x);

                const yRaw = dom.multiStationLabelOffsetY.value;
                const y = (yRaw === "—" || yRaw === "" ) ? 0 : clampLabelOffset(yRaw);

                setLabelOffsetForSelection(x, y);
            });
        }

        // Y (seleção)
        if (dom.multiStationLabelOffsetYRange && dom.multiStationLabelOffsetY) {
            dom.multiStationLabelOffsetYRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                if (state.selectedNodeIds.size < 2) return;

                const y = clampLabelOffset(dom.multiStationLabelOffsetYRange.value);
                dom.multiStationLabelOffsetY.value = String(y);

                const xRaw = dom.multiStationLabelOffsetX.value;
                const x = (xRaw === "—" || xRaw === "" ) ? 0 : clampLabelOffset(xRaw);

                setLabelOffsetForSelection(x, y);
            });
        }

        // Reset (seleção)
        if (dom.btnMultiStationLabelOffsetReset) {
            dom.btnMultiStationLabelOffsetReset.addEventListener("click", () => {
                if (state.selectedNodeIds.size < 2) return;

                pushHistory();
                for (const id of state.selectedNodeIds) {
                    const n = findNode(id);
                    if (!n) continue;
                    n.labelOffset = { dx: 0, dy: 0 };
                }

                if (dom.multiStationLabelOffsetXRange) dom.multiStationLabelOffsetXRange.value = "0";
                if (dom.multiStationLabelOffsetYRange) dom.multiStationLabelOffsetYRange.value = "0";
                if (dom.multiStationLabelOffsetX) dom.multiStationLabelOffsetX.value = "0";
                if (dom.multiStationLabelOffsetY) dom.multiStationLabelOffsetY.value = "0";

                renderAll();
                refreshSidebar?.();
            });
        }


        // v4.6.1: aplicar orientação da estação atual em todas as estações da linha ativa
        if (dom.applyStationOrientationActiveLine) {
            dom.applyStationOrientationActiveLine.addEventListener("click", () => {
                const lineId = state.activeLineId;
                const line = findLine(lineId);
                if (!line) {
                    alert("Nenhuma linha ativa definida.");
                    return;
                }

                const badge = (line.badgeEnabled && (line.badgeText || "").trim()) ? (line.badgeText || "").trim() : "";
                const tag = badge ? badge : ((line.name && line.name.trim()) ? line.name.trim() : "Linha");

                const angRaw = parseFloat(dom.stationOrientation?.value || "0");
                const ang = Number.isFinite(angRaw) ? angRaw : 0;

                const ids = (typeof getStationIdsForLine === "function") ? getStationIdsForLine(lineId) : new Set();
                if (!ids.size) {
                    alert("Essa linha não tem estações conectadas ainda.");
                    return;
                }

                pushHistory();
                for (const id of ids) {
                    const n = findNode(id);
                    if (!n) continue;
                    n.labelAngle = ang;
                }
                renderAll();
                refreshSidebar();
            });
        }

        function clampLabelOffset(v){
            const n = Number(v);
            if (!Number.isFinite(n)) return 0;
            return Math.max(-120, Math.min(120, n));
        }

        function setLabelOffsetForSelected(dx, dy, skipRefresh){
            if (state.selectedNodeIds.size !== 1) return;
            const id = [...state.selectedNodeIds][0];
            const n = findNode(id);
            if (!n) return;

            if (!n.labelOffset || typeof n.labelOffset !== "object") n.labelOffset = { dx: 0, dy: 0 };

            ensureGroupedHistory(`node:${id}:labelOffset`);
            n.labelOffset.dx = dx;
            n.labelOffset.dy = dy;

            renderAll();
            if (!skipRefresh) refreshSidebarPreserveInput?.();
        }

        // X
        if (dom.stationLabelOffsetXRange && dom.stationLabelOffsetX) {
            const applyX = (raw, fromRange=false) => {
                if (sidebarIsUpdating) return;
                const x = clampLabelOffset(raw);

                // sync campos
                if (fromRange) dom.stationLabelOffsetX.value = String(x);
                else dom.stationLabelOffsetXRange.value = String(x);

                // mantém Y atual
                const y = clampLabelOffset(dom.stationLabelOffsetY?.value ?? dom.stationLabelOffsetYRange?.value ?? 0);
                setLabelOffsetForSelected(x, y, true);
            };

            dom.stationLabelOffsetXRange.addEventListener("input", () => applyX(dom.stationLabelOffsetXRange.value, true));
            dom.stationLabelOffsetX.addEventListener("input", () => applyX(dom.stationLabelOffsetX.value, false));
        }

        // Y
        if (dom.stationLabelOffsetYRange && dom.stationLabelOffsetY) {
            const applyY = (raw, fromRange=false) => {
                if (sidebarIsUpdating) return;
                const y = clampLabelOffset(raw);

                // sync campos
                if (fromRange) dom.stationLabelOffsetY.value = String(y);
                else dom.stationLabelOffsetYRange.value = String(y);

                // mantém X atual
                const x = clampLabelOffset(dom.stationLabelOffsetX?.value ?? dom.stationLabelOffsetXRange?.value ?? 0);
                setLabelOffsetForSelected(x, y, true);
            };

            dom.stationLabelOffsetYRange.addEventListener("input", () => applyY(dom.stationLabelOffsetYRange.value, true));
            dom.stationLabelOffsetY.addEventListener("input", () => applyY(dom.stationLabelOffsetY.value, false));
        }

        // Reset
        if (dom.btnStationLabelOffsetReset) {
            dom.btnStationLabelOffsetReset.addEventListener("click", () => {
                if (state.selectedNodeIds.size !== 1) return;
                const id = [...state.selectedNodeIds][0];
                const n = findNode(id);
                if (!n) return;

                pushHistory();
                n.labelOffset = { dx: 0, dy: 0 };

                if (dom.stationLabelOffsetX) dom.stationLabelOffsetX.value = "0";
                if (dom.stationLabelOffsetXRange) dom.stationLabelOffsetXRange.value = "0";
                if (dom.stationLabelOffsetY) dom.stationLabelOffsetY.value = "0";
                if (dom.stationLabelOffsetYRange) dom.stationLabelOffsetYRange.value = "0";

                renderAll();
                refreshSidebar?.();
            });
        }


        // =========================
        // Estilo das estações (v4.4.5)
        // =========================
        function readStationStyleFromInputs() {
            const shape = (dom.stationStyleShape?.value || "circle").toString();
            const sizeRaw = parseFloat(dom.stationStyleSize?.value || dom.stationStyleSizeRange?.value || "20");
            const fill = ((dom.stationStyleFill?.value || "#ffffff").toString() || "#ffffff");
            const stroke = (dom.stationStyleStroke?.value || "").toString();
            const swRaw = parseFloat(dom.stationStyleStrokeWidth?.value || dom.stationStyleStrokeWidthRange?.value || "3");
            const size = clamp(Number.isFinite(sizeRaw) ? sizeRaw : (CFG.STATION_R * 2), 4, 80);
            const strokeWidth = clamp(Number.isFinite(swRaw) ? swRaw : 3, 0, 20);
            // clamp visual: reflete nos campos
            if (dom.stationStyleSize && String(size) !== String(dom.stationStyleSize.value)) dom.stationStyleSize.value = String(size);
            if (dom.stationStyleSizeRange && String(size) !== String(dom.stationStyleSizeRange.value)) dom.stationStyleSizeRange.value = String(size);
            if (dom.stationStyleStrokeWidth && String(strokeWidth) !== String(dom.stationStyleStrokeWidth.value)) dom.stationStyleStrokeWidth.value = String(strokeWidth);
            if (dom.stationStyleStrokeWidthRange && String(strokeWidth) !== String(dom.stationStyleStrokeWidthRange.value)) dom.stationStyleStrokeWidthRange.value = String(strokeWidth);
            // v4.7.0: proporção (Quadrado/Pílula)
            const wRaw = parseFloat(dom.stationStyleWidth?.value || dom.stationStyleWidthRange?.value || '1');
            const hRaw = parseFloat(dom.stationStyleHeight?.value || dom.stationStyleHeightRange?.value || '1');
            const wMul = clamp(Number.isFinite(wRaw) ? wRaw : 1, 0.6, 2.6);
            const hMul = clamp(Number.isFinite(hRaw) ? hRaw : 1, 0.6, 2.6);
            if (dom.stationStyleWidth && String(wMul) !== String(dom.stationStyleWidth.value)) dom.stationStyleWidth.value = String(wMul);
            if (dom.stationStyleWidthRange && String(wMul) !== String(dom.stationStyleWidthRange.value)) dom.stationStyleWidthRange.value = String(wMul);
            if (dom.stationStyleHeight && String(hMul) !== String(dom.stationStyleHeight.value)) dom.stationStyleHeight.value = String(hMul);
            if (dom.stationStyleHeightRange && String(hMul) !== String(dom.stationStyleHeightRange.value)) dom.stationStyleHeightRange.value = String(hMul);
            return {
                shape: (shape === "square" || shape === "diamond" || shape === "circle" || shape === "pill") ? shape : "circle",
                size: size,
                fill: fill,
                stroke: stroke,
                wMul: wMul,
                hMul: hMul,
                strokeWidth: strokeWidth,
            };
        }


        // v4.6.2: estilo em massa (painel Seleção)
        function readMultiStationStyleFromInputs() {
            const shapeRaw = (dom.multiStationStyleShape?.value || "").toString();
            const sizeRaw = parseFloat(dom.multiStationStyleSize?.value || dom.multiStationStyleSizeRange?.value || "20");
            const fill = ((dom.multiStationStyleFill?.value || "#ffffff").toString() || "#ffffff");
            const stroke = (dom.multiStationStyleStroke?.value || "").toString();
            const swRaw = parseFloat(dom.multiStationStyleStrokeWidth?.value || dom.multiStationStyleStrokeWidthRange?.value || "3");
            const size = clamp(Number.isFinite(sizeRaw) ? sizeRaw : (CFG.STATION_R * 2), 4, 80);
            const strokeWidth = clamp(Number.isFinite(swRaw) ? swRaw : 3, 0, 20);
            // clamp visual
            if (dom.multiStationStyleSize && String(size) != String(dom.multiStationStyleSize.value)) dom.multiStationStyleSize.value = String(size);
            if (dom.multiStationStyleSizeRange && String(size) != String(dom.multiStationStyleSizeRange.value)) dom.multiStationStyleSizeRange.value = String(size);
            if (dom.multiStationStyleStrokeWidth && String(strokeWidth) != String(dom.multiStationStyleStrokeWidth.value)) dom.multiStationStyleStrokeWidth.value = String(strokeWidth);
            if (dom.multiStationStyleStrokeWidthRange && String(strokeWidth) != String(dom.multiStationStyleStrokeWidthRange.value)) dom.multiStationStyleStrokeWidthRange.value = String(strokeWidth);
            return {
                shapeRaw,
                size,
                fill,
                stroke,
                wMul: clamp(parseFloat(dom.multiStationStyleWidth?.value || dom.multiStationStyleWidthRange?.value || "1") || 1, 0.6, 2.6),
                hMul: clamp(parseFloat(dom.multiStationStyleHeight?.value || dom.multiStationStyleHeightRange?.value || "1") || 1, 0.6, 2.6),
                strokeWidth,
            };
        }

        function applyStationStyleToNode(n, style) {
            if (!n) return;
            if (!n.stationStyle) n.stationStyle = { shape: "circle", size: CFG.STATION_R * 2, wMul: 1, hMul: 1, fill: "#ffffff", stroke: "", strokeWidth: 3 };
            n.stationStyle.shape = style.shape;
            n.stationStyle.size = style.size;
            n.stationStyle.wMul = (typeof style.wMul === "number" && Number.isFinite(style.wMul)) ? style.wMul : 1;
            n.stationStyle.hMul = (typeof style.hMul === "number" && Number.isFinite(style.hMul)) ? style.hMul : 1;
            n.stationStyle.fill = (style.fill && String(style.fill).trim()) ? String(style.fill).trim() : "#ffffff";
            n.stationStyle.stroke = style.stroke;
            n.stationStyle.strokeWidth = style.strokeWidth;
        }

        function withSingleSelectedStation(cb) {
            if (state.selectedNodeIds.size !== 1) return;
            const id = [...state.selectedNodeIds][0];
            const n = findNode(id);
            if (!n) return;
            cb(n);
        }

        const onStationStyleChange = () => {
            if (sidebarIsUpdating) return;
            withSingleSelectedStation((n) => {
                // Agrupa mudanças contínuas (slider/typing) em um único Ctrl+Z
                ensureGroupedHistory(`node:${n.id}:stationStyle`);
                applyStationStyleToNode(n, readStationStyleFromInputs());
                rebuildInterchangePortCache();
                renderAll();
                refreshSidebarPreserveInput();
            });
        };

        // Focus/blur para iniciar/finalizar agrupamento de histórico do estilo da estação
        const stationStyleKeyFor = () => (state.selectedNodeIds.size === 1) ? `node:${[...state.selectedNodeIds][0]}:stationStyle` : null;
        const stationStyleBegin = () => beginGroupedEdit(stationStyleKeyFor());
        const stationStyleEnd = () => endGroupedEdit(stationStyleKeyFor());

        // Campos que disparam edição contínua
        [dom.stationStyleSize, dom.stationStyleSizeRange,
        dom.stationStyleWidth, dom.stationStyleWidthRange,
        dom.stationStyleHeight, dom.stationStyleHeightRange,
        dom.stationStyleStrokeWidth, dom.stationStyleStrokeWidthRange,
        dom.stationStyleFill, dom.stationStyleStroke,
        dom.stationStyleShape].forEach((el) => {
            if (!el) return;
            el.addEventListener("focus", stationStyleBegin);
            el.addEventListener("blur", stationStyleEnd);
        });

        // eventos: sliders e inputs numéricos (two-way binding)
        // IMPORTANTE: o readStationStyleFromInputs lê primeiro os campos numéricos;
        // então precisamos sincronizar range -> number antes de aplicar.
        if (dom.stationStyleSizeRange) {
            dom.stationStyleSizeRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                if (dom.stationStyleSize) dom.stationStyleSize.value = String(dom.stationStyleSizeRange.value);
                onStationStyleChange();
            });
        }
        if (dom.stationStyleSize) {
            dom.stationStyleSize.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                // clamp e sync number -> range
                const v = clamp(parseFloat(dom.stationStyleSize.value || "0") || (CFG.STATION_R * 2), 4, 80);
                if (String(v) !== String(dom.stationStyleSize.value)) dom.stationStyleSize.value = String(v);
                if (dom.stationStyleSizeRange) dom.stationStyleSizeRange.value = String(v);
                onStationStyleChange();
            });
        }
        // v4.7.0: largura/altura para Quadrado e Pílula (multiplicadores)
        const syncStationWH = () => {
            const wRaw = parseFloat(dom.stationStyleWidth?.value || dom.stationStyleWidthRange?.value || '1');
            const hRaw = parseFloat(dom.stationStyleHeight?.value || dom.stationStyleHeightRange?.value || '1');
            const w = clamp(Number.isFinite(wRaw) ? wRaw : 1, 0.6, 2.6);
            const h = clamp(Number.isFinite(hRaw) ? hRaw : 1, 0.6, 2.6);
            if (dom.stationStyleWidth) dom.stationStyleWidth.value = String(w);
            if (dom.stationStyleWidthRange) dom.stationStyleWidthRange.value = String(w);
            if (dom.stationStyleHeight) dom.stationStyleHeight.value = String(h);
            if (dom.stationStyleHeightRange) dom.stationStyleHeightRange.value = String(h);
            return { w, h };
        };

        const updateStationDimsVisibility = () => {
            if (!dom.stationStyleDims) return;
            const sh = (dom.stationStyleShape?.value || 'circle').toString();
            dom.stationStyleDims.style.display = (sh === 'square' || sh === 'pill') ? 'block' : 'none';
        };

        if (dom.stationStyleWidthRange) {
            dom.stationStyleWidthRange.addEventListener('input', () => {
                if (sidebarIsUpdating) return;
                if (dom.stationStyleWidth) dom.stationStyleWidth.value = String(dom.stationStyleWidthRange.value);
                syncStationWH();
                onStationStyleChange();
            });
        }
        if (dom.stationStyleWidth) {
            dom.stationStyleWidth.addEventListener('input', () => {
                if (sidebarIsUpdating) return;
                syncStationWH();
                onStationStyleChange();
            });
        }
        if (dom.stationStyleHeightRange) {
            dom.stationStyleHeightRange.addEventListener('input', () => {
                if (sidebarIsUpdating) return;
                if (dom.stationStyleHeight) dom.stationStyleHeight.value = String(dom.stationStyleHeightRange.value);
                syncStationWH();
                onStationStyleChange();
            });
        }
        if (dom.stationStyleHeight) {
            dom.stationStyleHeight.addEventListener('input', () => {
                if (sidebarIsUpdating) return;
                syncStationWH();
                onStationStyleChange();
            });
        }

        if (dom.stationStyleStrokeWidthRange) {
            dom.stationStyleStrokeWidthRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                if (dom.stationStyleStrokeWidth) dom.stationStyleStrokeWidth.value = String(dom.stationStyleStrokeWidthRange.value);
                onStationStyleChange();
            });
        }
        if (dom.stationStyleStrokeWidth) {
            dom.stationStyleStrokeWidth.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const v = clamp(parseFloat(dom.stationStyleStrokeWidth.value || "0") || 3, 0, 20);
                if (String(v) !== String(dom.stationStyleStrokeWidth.value)) dom.stationStyleStrokeWidth.value = String(v);
                if (dom.stationStyleStrokeWidthRange) dom.stationStyleStrokeWidthRange.value = String(v);
                onStationStyleChange();
            });
        }
        // select e cores (change/input)
        if (dom.stationStyleShape) dom.stationStyleShape.addEventListener("change", () => {
            if (sidebarIsUpdating) return;
                                                                          try { updateStationDimsVisibility(); } catch(e) {}
                                                                          onStationStyleChange();
        });
        if (dom.stationStyleFill) dom.stationStyleFill.addEventListener("input", onStationStyleChange);
        if (dom.stationStyleStroke) dom.stationStyleStroke.addEventListener("input", onStationStyleChange);

        // v4.6.2: botões de reset (cores)
        if (dom.btnStationFillDefault) {
            dom.btnStationFillDefault.addEventListener("click", () => {
                if (state.selectedNodeIds.size !== 1) return;
                const id = [...state.selectedNodeIds][0];
                const n = findNode(id);
                if (!n) return;
                pushHistory();
                if (!n.stationStyle) n.stationStyle = { shape: "circle", size: CFG.STATION_R * 2, wMul: 1, hMul: 1, fill: "#ffffff", stroke: "", strokeWidth: 3 };
                n.stationStyle.fill = "#ffffff";
                // sincroniza UI
                if (dom.stationStyleFill) dom.stationStyleFill.value = "#ffffff";
                renderAll();
                refreshSidebar();
            });
        }

        if (dom.btnStationStrokeLine) {
            dom.btnStationStrokeLine.addEventListener("click", () => {
                if (state.selectedNodeIds.size !== 1) return;
                const id = [...state.selectedNodeIds][0];
                const n = findNode(id);
                if (!n) return;
                pushHistory();
                if (!n.stationStyle) n.stationStyle = { shape: "circle", size: CFG.STATION_R * 2, wMul: 1, hMul: 1, fill: "#ffffff", stroke: "", strokeWidth: 3 };
                // stroke vazio = "borda com cor da linha" (resolver automático no render)
                n.stationStyle.stroke = "";
                renderAll();
                refreshSidebar();
            });
        }


        // v4.5.1: Aplicar estilo em lote (linha ativa / seleção)
        if (dom.applyStationStyleActiveLine) {
            dom.applyStationStyleActiveLine.addEventListener("click", () => {
                const lineId = state.activeLineId;
                const line = findLine(lineId);
                if (!lineId || !line) return;
                const ids = (typeof getStationIdsForLine === "function") ? getStationIdsForLine(lineId) : new Set();
                const count = ids.size;
                if (!count) {
                    window.alert("Nenhuma estação conectada na linha ativa.");
                    return;
                }
                const lineName = (line.name && line.name.trim()) ? line.name.trim() : "Linha";
                const ok = window.confirm(`Aplicar este estilo em ${count} estação(ões) da linha ativa \"${lineName}\"? (Ctrl+Z desfaz)`);
                if (!ok) return;
                const style = readStationStyleFromInputs();
                pushHistory();
                // v4.5.2: além de aplicar nas estações existentes, gravamos como
                // estilo padrão da linha, para que novas estações herdem automaticamente.
                line.stationStyleDefault = { ...style };
                for (const id of ids) {
                    const n = findNode(id);
                    if (!n) continue;
                    applyStationStyleToNode(n, style);
                }
                rebuildInterchangePortCache();
                renderAll();
                refreshSidebar();
            });
        }

        if (dom.applyStationStyleSelection) {
            dom.applyStationStyleSelection.addEventListener("click", () => {
                if (state.selectedNodeIds.size < 2) return;
                const ok = window.confirm(`Aplicar este estilo em ${state.selectedNodeIds.size} estação(ões) selecionada(s)? (Ctrl+Z desfaz)`);
                if (!ok) return;
                const style = readStationStyleFromInputs();
                pushHistory();
                for (const id of state.selectedNodeIds) {
                    const n = findNode(id);
                    if (!n) continue;
                    applyStationStyleToNode(n, style);
                }
                rebuildInterchangePortCache();
                renderAll();
                refreshSidebar();
            });
        }



        if (dom.multiOrientation) {
            dom.multiOrientation.addEventListener("change", () => {
                if (sidebarIsUpdating) return;
                if (state.selectedNodeIds.size <= 1) return;
                const v = dom.multiOrientation.value;
                if (v === "") return;
                const ang = parseFloat(v);
                pushHistory();
                for (const id of state.selectedNodeIds) {
                    const n = findNode(id);
                    if (!n) continue;
                    n.labelAngle = Number.isFinite(ang) ? ang : 0;
                }
                renderAll();
                refreshSidebar();
            });
        }

        // v4.6.2: estilo em massa (painel Seleção) — aplica na hora (sem confirmação)
        const multiStyleKey = (field) => `multi:stationStyle:${field}`;

        const applyMultiStationStyleField = (field, value) => {
            if (sidebarIsUpdating) return;
            if (state.selectedNodeIds.size <= 1) return;

            ensureGroupedHistory(multiStyleKey(field));

            for (const id of state.selectedNodeIds) {
                const n = findNode(id);
                if (!n) continue;
                if (!n.stationStyle) n.stationStyle = { shape: "circle", size: CFG.STATION_R * 2, wMul: 1, hMul: 1, fill: "#ffffff", stroke: "", strokeWidth: 3 };

                if (field === "shape") {
                    const v = String(value || "");
                    if (v === "circle" || v === "square" || v === "diamond" || v === "pill") n.stationStyle.shape = v;
                } else if (field === "size") {
                    const vRaw = parseFloat(value);
                    const v = clamp(Number.isFinite(vRaw) ? vRaw : (CFG.STATION_R * 2), 4, 80);
                    n.stationStyle.size = v;
                } else if (field === "fill") {
                    const v = (value && String(value).trim()) ? String(value).trim() : "#ffffff";
                    n.stationStyle.fill = v;
                } else if (field === "stroke") {
                    n.stationStyle.stroke = String(value ?? "");
                } else if (field === "strokeWidth") {
                    const vRaw = parseFloat(value);
                    const v = clamp(Number.isFinite(vRaw) ? vRaw : 3, 0, 20);
                    n.stationStyle.strokeWidth = v;
                } else if (field === "wMul") {
                    const vRaw = parseFloat(value);
                    const v = clamp(Number.isFinite(vRaw) ? vRaw : 1, 0.6, 2.6);
                    n.stationStyle.wMul = v;
                } else if (field === "hMul") {
                    const vRaw = parseFloat(value);
                    const v = clamp(Number.isFinite(vRaw) ? vRaw : 1, 0.6, 2.6);
                    n.stationStyle.hMul = v;
                }
            }

            rebuildInterchangePortCache();
            renderAll();
            refreshSidebarPreserveInput();
        };

        const bindGrouped = (el, field) => {
            if (!el) return;
            el.addEventListener("focus", () => beginGroupedEdit(multiStyleKey(field)));
            el.addEventListener("blur", () => endGroupedEdit(multiStyleKey(field)));
        };

        // tamanho
        const syncMultiStationSize = () => {
            if (!dom.multiStationStyleSize && !dom.multiStationStyleSizeRange) return null;
            const vRaw = parseFloat(dom.multiStationStyleSize?.value || dom.multiStationStyleSizeRange?.value || String(CFG.STATION_R * 2));
            const v = clamp(Number.isFinite(vRaw) ? vRaw : (CFG.STATION_R * 2), 4, 80);
            if (dom.multiStationStyleSize) dom.multiStationStyleSize.value = String(v);
            if (dom.multiStationStyleSizeRange) dom.multiStationStyleSizeRange.value = String(v);
            return v;
        };

        if (dom.multiStationStyleSize) {
            bindGrouped(dom.multiStationStyleSize, "size");
            dom.multiStationStyleSize.addEventListener("input", () => {
                const v = syncMultiStationSize();
                if (v == null) return;
                applyMultiStationStyleField("size", v);
            });
        }
        if (dom.multiStationStyleSizeRange) {
            bindGrouped(dom.multiStationStyleSizeRange, "size");
            dom.multiStationStyleSizeRange.addEventListener("input", () => {
                if (dom.multiStationStyleSize) dom.multiStationStyleSize.value = String(dom.multiStationStyleSizeRange.value);
                const v = syncMultiStationSize();
                if (v == null) return;
                applyMultiStationStyleField("size", v);
            });
        }


        // v4.7.0: largura/altura (multiplicadores)
        const syncMultiStationWH = () => {
            if (!dom.multiStationStyleWidth && !dom.multiStationStyleWidthRange && !dom.multiStationStyleHeight && !dom.multiStationStyleHeightRange) return null;
            const wRaw = parseFloat(dom.multiStationStyleWidth?.value || dom.multiStationStyleWidthRange?.value || '1');
            const hRaw = parseFloat(dom.multiStationStyleHeight?.value || dom.multiStationStyleHeightRange?.value || '1');
            const w = clamp(Number.isFinite(wRaw) ? wRaw : 1, 0.6, 2.6);
            const h = clamp(Number.isFinite(hRaw) ? hRaw : 1, 0.6, 2.6);
            if (dom.multiStationStyleWidth) dom.multiStationStyleWidth.value = String(w);
            if (dom.multiStationStyleWidthRange) dom.multiStationStyleWidthRange.value = String(w);
            if (dom.multiStationStyleHeight) dom.multiStationStyleHeight.value = String(h);
            if (dom.multiStationStyleHeightRange) dom.multiStationStyleHeightRange.value = String(h);
            return { w, h };
        };

        const updateMultiStationDimsVisibility = () => {
            if (!dom.multiStationStyleDims) return;
            const sh = (dom.multiStationStyleShape?.value || '').toString();
            dom.multiStationStyleDims.style.display = (sh === 'square' || sh === 'pill') ? 'block' : 'none';
        };

        if (dom.multiStationStyleWidth) {
            bindGrouped(dom.multiStationStyleWidth, 'wMul');
            dom.multiStationStyleWidth.addEventListener('input', () => {
                const r = syncMultiStationWH();
                if (!r) return;
                applyMultiStationStyleField('wMul', r.w);
            });
        }
        if (dom.multiStationStyleWidthRange) {
            bindGrouped(dom.multiStationStyleWidthRange, 'wMul');
            dom.multiStationStyleWidthRange.addEventListener('input', () => {
                if (dom.multiStationStyleWidth) dom.multiStationStyleWidth.value = String(dom.multiStationStyleWidthRange.value);
                const r = syncMultiStationWH();
                if (!r) return;
                applyMultiStationStyleField('wMul', r.w);
            });
        }
        if (dom.multiStationStyleHeight) {
            bindGrouped(dom.multiStationStyleHeight, 'hMul');
            dom.multiStationStyleHeight.addEventListener('input', () => {
                const r = syncMultiStationWH();
                if (!r) return;
                applyMultiStationStyleField('hMul', r.h);
            });
        }
        if (dom.multiStationStyleHeightRange) {
            bindGrouped(dom.multiStationStyleHeightRange, 'hMul');
            dom.multiStationStyleHeightRange.addEventListener('input', () => {
                if (dom.multiStationStyleHeight) dom.multiStationStyleHeight.value = String(dom.multiStationStyleHeightRange.value);
                const r = syncMultiStationWH();
                if (!r) return;
                applyMultiStationStyleField('hMul', r.h);
            });
        }

        // stroke width
        const syncMultiStationSW = () => {
            if (!dom.multiStationStyleStrokeWidth && !dom.multiStationStyleStrokeWidthRange) return null;
            const vRaw = parseFloat(dom.multiStationStyleStrokeWidth?.value || dom.multiStationStyleStrokeWidthRange?.value || "3");
            const v = clamp(Number.isFinite(vRaw) ? vRaw : 3, 0, 20);
            if (dom.multiStationStyleStrokeWidth) dom.multiStationStyleStrokeWidth.value = String(v);
            if (dom.multiStationStyleStrokeWidthRange) dom.multiStationStyleStrokeWidthRange.value = String(v);
            return v;
        };

        if (dom.multiStationStyleStrokeWidth) {
            bindGrouped(dom.multiStationStyleStrokeWidth, "strokeWidth");
            dom.multiStationStyleStrokeWidth.addEventListener("input", () => {
                const v = syncMultiStationSW();
                if (v == null) return;
                applyMultiStationStyleField("strokeWidth", v);
            });
        }
        if (dom.multiStationStyleStrokeWidthRange) {
            bindGrouped(dom.multiStationStyleStrokeWidthRange, "strokeWidth");
            dom.multiStationStyleStrokeWidthRange.addEventListener("input", () => {
                if (dom.multiStationStyleStrokeWidth) dom.multiStationStyleStrokeWidth.value = String(dom.multiStationStyleStrokeWidthRange.value);
                const v = syncMultiStationSW();
                if (v == null) return;
                applyMultiStationStyleField("strokeWidth", v);
            });
        }

        // shape + cores
        if (dom.multiStationStyleShape) {
            bindGrouped(dom.multiStationStyleShape, "shape");
            dom.multiStationStyleShape.addEventListener("change", () => {
                if (sidebarIsUpdating) return;
                const v = (dom.multiStationStyleShape.value || "").toString();
                if (dom.multiStationStyleDims) dom.multiStationStyleDims.style.display = (v === "square" || v === "pill") ? "block" : "none";
                if (!v) return; // mantém "misto" até o usuário escolher
                applyMultiStationStyleField("shape", v);
            });
        }
        if (dom.multiStationStyleFill) {
            bindGrouped(dom.multiStationStyleFill, "fill");
            dom.multiStationStyleFill.addEventListener("input", () => {
                applyMultiStationStyleField("fill", dom.multiStationStyleFill.value);
            });
        }
        if (dom.multiStationStyleStroke) {
            bindGrouped(dom.multiStationStyleStroke, "stroke");
            dom.multiStationStyleStroke.addEventListener("input", () => {
                applyMultiStationStyleField("stroke", dom.multiStationStyleStroke.value);
            });
        }

        // v4.6.2: botões de reset (cores) no painel Seleção
        if (dom.btnMultiFillDefault) {
            dom.btnMultiFillDefault.addEventListener("click", () => {
                if (state.selectedNodeIds.size <= 1) return;
                // evita disparar input handlers
                sidebarIsUpdating = true;
                if (dom.multiStationStyleFill) dom.multiStationStyleFill.value = "#ffffff";
                sidebarIsUpdating = false;
                applyMultiStationStyleField("fill", "#ffffff");
            });
        }

        if (dom.btnMultiStrokeLine) {
            dom.btnMultiStrokeLine.addEventListener("click", () => {
                if (state.selectedNodeIds.size <= 1) return;
                // stroke vazio = "borda com cor da linha" (resolver automático no render)
                const preview = findLine(state.activeLineId)?.color || "#78aaff";
                sidebarIsUpdating = true;
                if (dom.multiStationStyleStroke) dom.multiStationStyleStroke.value = preview;
                sidebarIsUpdating = false;
                applyMultiStationStyleField("stroke", "");
            });
        }



        // ✅ Linha: aplicar orientação padrão (em massa)
        function getSelectedOrActiveLine() {
            return state.selectedLineId || state.activeLineId;
        }

        if (dom.lineApplyDefaultOrientation) {
            dom.lineApplyDefaultOrientation.addEventListener("change", () => {
                if (sidebarIsUpdating) return;
                setLineDefaultOrientationUI();
            });
        }

        if (dom.lineDefaultOrientation) {
            dom.lineDefaultOrientation.addEventListener("change", () => {
                if (sidebarIsUpdating) return;
                const v = dom.lineDefaultOrientation.value;
                if (!v) return;

                const lineId = getSelectedOrActiveLine();
                const line = findLine(lineId);
                const lineName = (line?.name && line.name.trim()) ? line.name.trim() : "Linha";

                const optText = dom.lineDefaultOrientation.options[dom.lineDefaultOrientation.selectedIndex]?.textContent?.trim() || v;
                const ok = window.confirm(`Aplicar ${optText} em todas as estações da linha "${lineName}"? (Ctrl+Z desfaz)`);
                if (!ok) {
                    // volta pro placeholder
                    dom.lineDefaultOrientation.value = "";
                    return;
                }

                const ang = parseFloat(v);
                const ids = getStationIdsForLine(lineId);
                if (!ids.size) {
                    alert("Essa linha não tem estações conectadas ainda.");
                    dom.lineDefaultOrientation.value = "";
                    return;
                }

                pushHistory();
                for (const id of ids) {
                    const n = findNode(id);
                    if (!n) continue;
                    n.labelAngle = Number.isFinite(ang) ? ang : 0;
                }
                renderAll();
                refreshSidebar();

                // volta pro placeholder pra evitar aplicar sem querer de novo
                dom.lineDefaultOrientation.value = "";
            });
        }

        if (dom.btnAddStationAfter) {
            dom.btnAddStationAfter.addEventListener("click", () => {
                if (state.selectedNodeIds.size !== 1) return;
                const fromId = [...state.selectedNodeIds][0];
                const ok = true;
                if (!ok) return;
                pushHistory();
                const nn = addStationAfter(fromId, state.activeLineId);
                if (!nn) return;
                clearSelection();
                state.selectedNodeIds.add(nn.id);
                pendingStationFocusId = nn.id;
                renderAll();
                refreshSidebar();
            });
        }

        if (dom.btnDeleteStation) {
            dom.btnDeleteStation.addEventListener("click", () => {
                if (state.selectedNodeIds.size !== 1) return;
                pushHistory();
                deleteNodes([...state.selectedNodeIds]);
                renderAll();
                refreshSidebar();
            });
        }

        // multi actions
        if (dom.btnDeleteSelection) {
            dom.btnDeleteSelection.addEventListener("click", () => {
                if (state.selectedNodeIds.size === 0) return;
                pushHistory();
                deleteNodes([...state.selectedNodeIds]);
                renderAll();
                refreshSidebar();
            });
        }

        if (dom.btnClearSelection) {
            dom.btnClearSelection.addEventListener("click", () => {
                clearSelection();
                renderAll();
                refreshSidebar();
            });
        }

        // texts

        // Sinalização: toggle de "badge + nome"
        if (dom.signageNameWithBadge) {
            dom.signageNameWithBadge.checked = !!state.signageNameWithBadge;
            dom.signageNameWithBadge.addEventListener("change", () => {
                state.signageNameWithBadge = !!dom.signageNameWithBadge.checked;
                renderSignagePickers();
                refreshSidebar();
            });
        }

        if (dom.textContent) {
            const keyFor = () => state.selectedTextId ? `text:${state.selectedTextId}:text` : null;
            dom.textContent.addEventListener("focus", () => beginGroupedEdit(keyFor()));
            dom.textContent.addEventListener("blur", () => endGroupedEdit(keyFor()));

            dom.textContent.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                // Sem seleção: isso vira o "rascunho" do próximo texto a ser criado
                if (!state.selectedTextId) {
                    state.textDraft = dom.textContent.value;
                    return;
                }

                const t = findText(state.selectedTextId);
                if (!t) return;
                if ((t.kind || "text") !== "text") return; // sinalização não é editável por aqui
                ensureGroupedHistory(`text:${state.selectedTextId}:text`);
                t.text = dom.textContent.value;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }


        if (dom.textSize) {
            const keyFor = () => state.selectedTextId ? `text:${state.selectedTextId}:size` : null;
            dom.textSize.addEventListener("focus", () => beginGroupedEdit(keyFor()));
            dom.textSize.addEventListener("blur", () => endGroupedEdit(keyFor()));

            dom.textSize.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const sz = clamp(parseInt(dom.textSize.value, 10) || CFG.TEXT_DEFAULT_SIZE, 8, 120);
                // clamp visual
                if (String(sz) !== String(dom.textSize.value)) dom.textSize.value = String(sz);
                if (dom.textSizeRange) dom.textSizeRange.value = String(sz);
                if (!state.selectedTextId) {
                    normalizeSignagePreset();
                    const p = state.signagePreset;
                    if (p) state.signageNextSize = sz;
                    else state.textNextSize = sz;
                    refreshSidebarPreserveInput();
                    return;
                }
                const t = findText(state.selectedTextId);
                if (!t) return;
                ensureGroupedHistory(`text:${state.selectedTextId}:size`);
                t.size = sz;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        // Slider de tamanho do texto (v4.4.7)
        if (dom.textSizeRange) {
            const keyFor = () => state.selectedTextId ? `text:${state.selectedTextId}:size` : null;
            dom.textSizeRange.addEventListener("focus", () => beginGroupedEdit(keyFor()));
            dom.textSizeRange.addEventListener("blur", () => endGroupedEdit(keyFor()));

            dom.textSizeRange.addEventListener("input", () => {
                if (sidebarIsUpdating) return;
                const sz = clamp(parseInt(dom.textSizeRange.value, 10) || CFG.TEXT_DEFAULT_SIZE, 8, 120);
                if (dom.textSize) dom.textSize.value = String(sz);
                if (String(sz) !== String(dom.textSizeRange.value)) dom.textSizeRange.value = String(sz);

                if (!state.selectedTextId) {
                    normalizeSignagePreset();
                    const p = state.signagePreset;
                    if (p) state.signageNextSize = sz;
                    else state.textNextSize = sz;
                    refreshSidebarPreserveInput();
                    return;
                }
                const t = findText(state.selectedTextId);
                if (!t) return;
                ensureGroupedHistory(`text:${state.selectedTextId}:size`);
                t.size = sz;
                renderAll();
                refreshSidebarPreserveInput();
            });
        }

        // =========================
        // Rotação (universal) — texto/sinalização + shapes
        // Ctrl+F: Rotação (universal) — texto/sinalização + shapes
        // =========================
        function clampDeg(v){
            const n = parseInt(v, 10);
            if (!Number.isFinite(n)) return 0;
            return Math.max(0, Math.min(360, n));
        }

        if (dom.rotationRange || dom.rotationValue) {
            const keyForRot = () => state.selectedTextId ? `text:${state.selectedTextId}:rotation` : null;

            const applyRotation = (raw) => {
                if (sidebarIsUpdating) return;
                const deg = clampDeg(raw);

                // sem seleção: só guarda como default pro próximo texto/sinalização
                if (!state.selectedTextId) {
                    state.textNextRotation = deg;
                    if (dom.rotationValue) dom.rotationValue.value = String(deg);
                    if (dom.rotationRange) dom.rotationRange.value = String(deg);
                    refreshSidebarPreserveInput();
                    return;
                }

                const t = findText(state.selectedTextId);
                if (!t) return;

                ensureGroupedHistory(`text:${state.selectedTextId}:rotation`);
                t.rotation = deg;

                if (dom.rotationValue) dom.rotationValue.value = String(deg);
                if (dom.rotationRange) dom.rotationRange.value = String(deg);

                renderAll();
                refreshSidebarPreserveInput();
            };

            // agrupamento no histórico (igual ao size)
            if (dom.rotationRange) {
                dom.rotationRange.addEventListener("focus", () => beginGroupedEdit(keyForRot()));
                dom.rotationRange.addEventListener("blur",  () => endGroupedEdit(keyForRot()));
                dom.rotationRange.addEventListener("input", () => applyRotation(dom.rotationRange.value));
            }
            if (dom.rotationValue) {
                dom.rotationValue.addEventListener("focus", () => beginGroupedEdit(keyForRot()));
                dom.rotationValue.addEventListener("blur",  () => endGroupedEdit(keyForRot()));
                dom.rotationValue.addEventListener("input", () => applyRotation(dom.rotationValue.value));
            }

            // Presets
            const bindPreset = (el, deg) => {
                if (!el) return;
                el.addEventListener("click", () => applyRotation(deg));
            };
            bindPreset(dom.rotPreset0, 0);
            bindPreset(dom.rotPreset90, 90);
            bindPreset(dom.rotPreset180, 180);
            bindPreset(dom.rotPreset270, 270);
            bindPreset(dom.rotPreset45, 45);
            bindPreset(dom.rotPreset135, 135);
            bindPreset(dom.rotPreset225, 225);
            bindPreset(dom.rotPreset315, 315);

            // Reset
            if (dom.btnRotationReset) dom.btnRotationReset.addEventListener("click", () => applyRotation(0));
        }



// Cor do texto (picker + hex) + contorno (outline)
// Ctrl+F: dom.textColor
if (dom.textColor) {
    dom.textColor.addEventListener("input", () => {
        if (sidebarIsUpdating) return;
        const v = String(dom.textColor.value || "").trim();
        if (!/^#([0-9a-fA-F]{6})$/.test(v)) return;

        // Sem seleção: muda o padrão do próximo elemento (texto livre ou sinalização)
        if (!state.selectedTextId) {
            normalizeSignagePreset();
            const p = state.signagePreset;
            if (p) state.signageNextColor = v;
            else state.textNextColor = v;
            if (dom.textColorHex) dom.textColorHex.value = v;
            refreshSidebarPreserveInput();
            return;
        }

        const t = findText(state.selectedTextId);
        if (!t) return;
        const kind = t.kind || "text";
        if (kind === "badge") return; // badge usa contraste automático (fixo)
        pushHistory();
        t.color = v;
        if (dom.textColorHex) dom.textColorHex.value = v;
        renderAll();
        refreshSidebarPreserveInput();
    });
}

if (dom.textColorHex) {
    dom.textColorHex.addEventListener("change", () => {
        if (sidebarIsUpdating) return;
        const raw = String(dom.textColorHex.value || "").trim();

        // vazio = auto
        if (!raw) {
            if (!state.selectedTextId) {
                normalizeSignagePreset();
                const p = state.signagePreset;
                if (p) state.signageNextColor = "";
                else state.textNextColor = "";
                refreshSidebarPreserveInput();
                renderAll();
                return;
            }
            const t = findText(state.selectedTextId);
            if (!t) return;
            const kind = t.kind || "text";
            if (kind === "badge") return;
            pushHistory();
            t.color = "";
            renderAll();
            refreshSidebarPreserveInput();
            return;
        }

        const v = raw.startsWith("#") ? raw : ("#" + raw);
        if (!/^#([0-9a-fA-F]{6})$/.test(v)) {
            refreshSidebarPreserveInput();
            return;
        }

        if (!state.selectedTextId) {
            normalizeSignagePreset();
            const p = state.signagePreset;
            if (p) state.signageNextColor = v;
            else state.textNextColor = v;
            if (dom.textColor) dom.textColor.value = v;
            refreshSidebarPreserveInput();
            return;
        }

        const t = findText(state.selectedTextId);
        if (!t) return;
        const kind = t.kind || "text";
        if (kind === "badge") return;
        pushHistory();
        t.color = v;
        if (dom.textColor) dom.textColor.value = v;
        renderAll();
        refreshSidebarPreserveInput();
    });
}

if (dom.textOutline) {
    dom.textOutline.addEventListener("change", () => {
        if (sidebarIsUpdating) return;
        const on = !!dom.textOutline.checked;

        if (!state.selectedTextId) {
            normalizeSignagePreset();
            const p = state.signagePreset;
            if (p) state.signageNextOutline = on;
            else state.textNextOutline = on;
            renderAll();
            refreshSidebarPreserveInput();
            return;
        }

        const t = findText(state.selectedTextId);
        if (!t) return;
        pushHistory();
        t.outline = on;
        renderAll();
        refreshSidebarPreserveInput();
    });
}

        if (dom.btnTextBold) {
            dom.btnTextBold.addEventListener("click", () => {
                // Sem seleção: muda o padrão de próximo elemento
                if (!state.selectedTextId) {
                    state.signageNextBold = !state.signageNextBold;
                    dom.btnTextBold.setAttribute("aria-pressed", state.signageNextBold ? "true" : "false");
                    refreshSidebar();
                    return;
                }
                const t = findText(state.selectedTextId);
                if (!t) return;
                if ((t.kind || "text") === "badge") return;
                pushHistory();
                t.bold = !t.bold;
                dom.btnTextBold.setAttribute("aria-pressed", t.bold ? "true" : "false");
                renderAll();
                refreshSidebar();
            });
        }

        if (dom.btnTextItalic) {
            dom.btnTextItalic.addEventListener("click", () => {
                // Sem seleção: muda o padrão de próximo elemento
                if (!state.selectedTextId) {
                    state.signageNextItalic = !state.signageNextItalic;
                    dom.btnTextItalic.setAttribute("aria-pressed", state.signageNextItalic ? "true" : "false");
                    refreshSidebar();
                    return;
                }
                const t = findText(state.selectedTextId);
                if (!t) return;
                if ((t.kind || "text") === "badge") return;
                pushHistory();
                t.italic = !t.italic;
                dom.btnTextItalic.setAttribute("aria-pressed", t.italic ? "true" : "false");
                renderAll();
                refreshSidebar();
            });
        }

        if (dom.btnDeleteText) {
            dom.btnDeleteText.addEventListener("click", () => {
                if (!state.selectedTextId) return;
                pushHistory();
                deleteText(state.selectedTextId);
                renderAll();
                refreshSidebar();
            });
        }

        // Duplicar texto (v5.1.1)
        // Ctrl+F: btnDuplicateText
        if (dom.btnDuplicateText) {
            dom.btnDuplicateText.addEventListener("click", () => {
                if (!state.selectedTextId) return;
                const t = findText(state.selectedTextId);
                if (!t) return;

                pushHistory();

                // Clona o objeto para preservar todas as props (inclui badge/name/badgeName e também shapes)
                const copy = JSON.parse(JSON.stringify(t));
                copy.id = uid();

                // offset leve pra não ficar em cima do original
                copy.x = (Number.isFinite(+copy.x) ? +copy.x : 0) + 20;
                copy.y = (Number.isFinite(+copy.y) ? +copy.y : 0) + 20;

                ensureTextProps(copy);
                state.texts.push(copy);

                state.selectedTextId = copy.id;
                renderAll();
                refreshSidebar();
            });
        }

        // viewport events
        if (dom.viewport) {
            dom.viewport.addEventListener("pointerdown", onViewportDown);
            dom.viewport.addEventListener("dblclick", onViewportDblClick);
            dom.viewport.addEventListener("pointermove", onViewportMove);
            dom.viewport.addEventListener("pointerup", onViewportUp);
            dom.viewport.addEventListener("pointercancel", onViewportCancel);
            dom.viewport.addEventListener("wheel", onWheel, { passive: false });
        }

        window.addEventListener("blur", onViewportCancel);

        document.addEventListener("keydown", onKeyDown);
        document.addEventListener("keyup", onKeyUp);
}

// =========================
// Boot
// =========================
function boot() {
    if (!dom.viewport || !dom.world) {
        console.error("Mobinode: elementos SVG principais não encontrados (viewport/world).");
        return;
    }

    state.view.x = window.innerWidth / 2;
    state.view.y = window.innerHeight / 2;
    state.view.z = 1;

    initTheme();
    initDockPosition();
    // Ctrl+F: initSnapToGrid
    initSnapToGrid();

    if (window.enforceMobileDockRules) window.enforceMobileDockRules();

    applyPropsMode();

    ensureAtLeastOneLine();
    ensureAllTexts();
    normalizeSignagePreset();
    updateStationToolBadge();
    setTool("neutral");

    history.undo.length = 0;
    history.redo.length = 0;
    updateUndoRedoButtons();

    bindUI();
    placeHelpButtonByLayout();
    window.addEventListener("resize", placeHelpButtonByLayout);


    // v4.6.2: fallback — se algum pointer-capture ficar preso no viewport,
    // isso pode travar sliders/inputs do sidebar (mouse tem pointerId fixo).
    // Ao interagir com o sidebar, garantimos que o canvas solte qualquer captura.
    if (dom.sidebar && dom.viewport) {
        dom.sidebar.addEventListener("pointerdown", (ev) => {
            try {
                if (dom.viewport.hasPointerCapture && dom.viewport.hasPointerCapture(ev.pointerId)) {
                    dom.viewport.releasePointerCapture(ev.pointerId);
                }
            } catch (e) {}

            // garante que não existe interação em andamento
            try { stopPan(); } catch (e) {}
            try { stopTextDrag(); } catch (e) {}
            try { stopNodeDrag(); } catch (e) {}
            try { stopLinkDragHard(); } catch (e) {}
            try { stopNewLineDragHard(); } catch (e) {}
            try { stopSelectHard(); } catch (e) {}
        }, true);
    }

    // Ctrl+F: AUTO_RESTORE_CACHE
    const restored = loadMapFromBrowserCache();
    if (restored) {
        // opcional: garantir ferramenta padrão e UI consistente
        setTool("neutral");
    }


    initAccordionExclusive();
    renderAll();
    refreshSidebar();
    updateCursor();

    // Mobile: começa com todos os flyouts fechados e sidebar recolhida.
    // Ctrl+F: Mobile: começa com todos os flyouts fechados
    if (typeof isMobileLayout === "function" && isMobileLayout()) {
        try { closeAllAccordions(); } catch (e) {}
        try { showHelpPanel(false); } catch (e) {}
        showSidebar(false);
    } else {
        showSidebar(true);
    }

    // Reposiciona o botão de ajuda rápida conforme layout (mobile vs desktop)
    // Ctrl+F: placeHelpButtonByLayout
    try { if (typeof placeHelpButtonByLayout === "function") placeHelpButtonByLayout(); } catch (e) {}

    // Responsivo: se o usuário redimensionar a janela, o botão vai junto.
    // Ctrl+F: __helpBtnResizeBound
    try {
        if (!window.__helpBtnResizeBound) {
            window.__helpBtnResizeBound = true;
            let t = null;
            window.addEventListener("resize", () => {
                if (t) clearTimeout(t);
                t = setTimeout(() => {
                    try { if (typeof placeHelpButtonByLayout === "function") placeHelpButtonByLayout(); } catch (e) {}
                }, 120);
            });
        }
    } catch (e) {}

    maybeShowWhatsNewPanel();

    console.log("Mobinode: app.js carregou ✅ (v5.7.0_RC5)");
}

// Ctrl+F: AUTO_RESTORE_CACHE
const restored = loadMapFromBrowserCache();
if (restored) {
    setTool("neutral");
}

// liga auto-save
startAutoCacheSaver();

// Ctrl+F: placeHelpButtonByLayout
function placeHelpButtonByLayout(){
    const btn = dom.btnHelp;
    if (!btn) return;

    const topbarRight = document.getElementById("topbar-right");
    const helpCorner = document.getElementById("helpCorner");

    const isMobile = window.matchMedia("(max-width: 900px)").matches;

    if (isMobile) {
        if (topbarRight && btn.parentElement !== topbarRight) topbarRight.appendChild(btn);
    } else {
        if (helpCorner && btn.parentElement !== helpCorner) helpCorner.appendChild(btn);
    }
}



boot();
