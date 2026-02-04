/* Mobinode - split bundle (part 1/4)
 * v4.4.5
 * Conteúdo: core + utils + rendering base + tools
 * (Refatoração: arquivo original app_v4.4.4.js dividido em 4 partes para manutenção)
 */

"use strict";

    // =========================
    // DOM helpers
    // =========================
    const $ = (id) => document.getElementById(id);
    const svgNS = "http://www.w3.org/2000/svg";
    const el = (tag) => document.createElementNS(svgNS, tag);

    // =========================
    // Config
    // =========================
    const CFG = {
        GRID: 16,
        STATION_R: 10,
        LINE_BADGE_R: 10,
        LINE_BADGE_GAP: 8,
        LINE_BADGE_FONT: 11,
        GRID_EXTENT: 7000,
        MIN_Z: 0.25,
        MAX_Z: 3,
        EDGE_HIT: 18,
        EDGE_SELECTED_PAD: 4,
        CONNECT_SNAP_RADIUS: 18,

        TEXT_DEFAULT_SIZE: 32,
        SIGNAGE_DEFAULT_SIZE: 16,

 // labels de estação
        LABEL_X_OFF: 14,
        LABEL_Y_OFF: 14,          // baseline do nome principal = (n.y - LABEL_Y_OFF)
        LABEL_MAIN_LINE_H: 13,    // espaçamento do nome principal -> primeira linha do sufixo
        LABEL_SUB_LINE_H: 12,     // espaçamento entre linhas do prefixo/sufixo
    };


    function ensureConnectorLine() {
        // tenta reaproveitar uma existente
        let existing = state.lines.find(l => l.role === "connector" || l.name === "__connector__");
        if (existing) return existing.id;

        // cria a linha exclusiva
        const id = uid();
        state.lines.push({
            id,
            name: "__connector__",   // nome técnico (tu vai esconder na UI)
        role: "connector",
        color: "#ffffff",        // traçado branco padrão
        width: 10,               // espessura padrão (ajustável no painel)
        // ganchos futuros do painel (nós/pontos de conexão)
        connectorStyle: {
            nodeFill: "#cfcfcf",
            nodeStroke: "rgba(0,0,0,0.18)",
                         nodeStrokeWidth: 2,
                         nodeShape: "circle",
                         nodeSize: 8
        }

        });

        return id;
    }

// Ctrl+F: isConnectorLine
function isConnectorLine(line) {
    if (!line) return false;
    return line.role === "connector" || line.name === "__connector__";
}


// =========================
// Station style helpers (v4.4.5)
// =========================
function stationRadiusForNode(n) {
    // UI trabalha com “diâmetro”. Aqui sempre devolvemos o raio em px.
    const dia = n?.stationStyle?.size;
    if (typeof dia === "number" && Number.isFinite(dia) && dia > 0) return Math.max(2, dia / 2);
    return CFG.STATION_R;
}

function stationStrokeWidthForNode(n) {
    const sw = n?.stationStyle?.strokeWidth;
    if (typeof sw === "number" && Number.isFinite(sw) && sw >= 0) return sw;
    return 3; // mantém o default do CSS
}

function stationShapeForNode(n) {
    const s = (n?.stationStyle?.shape || "circle").toString();
    return (s === "square" || s === "diamond" || s === "circle" || s === "pill") ? s : "circle";
}

function stationWidthMulForNode(n) {
    const v = n?.stationStyle?.wMul;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    return 1;
}

function stationHeightMulForNode(n) {
    const v = n?.stationStyle?.hMul;
    if (typeof v === "number" && Number.isFinite(v) && v > 0) return v;
    return 1;
}

function stationResolvedFillForNode(n, fallbackFill) {
    // Se o usuário escolheu uma cor, usa ela. Senão mantém o comportamento antigo.
    const c = n?.stationStyle?.fill;
    return (typeof c === "string" && c.trim()) ? c.trim() : fallbackFill;
}

function stationResolvedStrokeForNode(n, fallbackStroke) {
    const c = n?.stationStyle?.stroke;
    return (typeof c === "string" && c.trim()) ? c.trim() : fallbackStroke;
}

function makeStationShapeEl(shape, cx, cy, r, wMul = 1, hMul = 1) {
    if (shape === "square") {
        const rr = el("rect");
        const w = (r * 2) * (Number.isFinite(wMul) ? wMul : 1);
        const h = (r * 2) * (Number.isFinite(hMul) ? hMul : 1);
        rr.setAttribute("x", String(cx - w / 2));
        rr.setAttribute("y", String(cy - h / 2));
        rr.setAttribute("width", String(w));
        rr.setAttribute("height", String(h));
        // sem cantos arredondados por padrão (metro-style)
        return rr;
    }
    if (shape === "diamond") {
        const p = el("polygon");
        const pts = [
            `${cx},${cy - r}`,
            `${cx + r},${cy}`,
            `${cx},${cy + r}`,
            `${cx - r},${cy}`,
        ].join(" ");
        p.setAttribute("points", pts);
        return p;
    }

    if (shape === "pill") {
        const rr = el("rect");
        // v4.7.3: evita "sabonete em crise" (oval/ovo) quando altura > largura.
        // A pílula deve ser sempre uma cápsula: o maior eixo vira o "comprimento" e o menor vira a "espessura".
        const baseW = r * 4.0;      // comprimento base (horizontal)
        const baseH = r * 2.0;      // espessura base
        const wRaw = baseW * (Number.isFinite(wMul) ? wMul : 1);
        const hRaw = baseH * (Number.isFinite(hMul) ? hMul : 1);

        const length = Math.max(wRaw, hRaw);
        const thick  = Math.min(wRaw, hRaw);

        // Se o usuário deixou a "altura" maior que a "largura", desenhamos vertical.
        const drawVertical = hRaw > wRaw;
        const w = drawVertical ? thick  : length;
        const h = drawVertical ? length : thick;

        rr.setAttribute("x", String(cx - w / 2));
        rr.setAttribute("y", String(cy - h / 2));
        rr.setAttribute("width", String(w));
        rr.setAttribute("height", String(h));
        rr.setAttribute("rx", String(thick / 2));
        rr.setAttribute("ry", String(thick / 2));
        return rr;
    }

    const c = el("circle");
    c.setAttribute("cx", String(cx));
    c.setAttribute("cy", String(cy));
    c.setAttribute("r", String(r));
    return c;
}
    // =========================
    // State
    // =========================
    const state = {
        nodes: [],
 edges: [],
 lines: [],
 texts: [],
 // Nome automático de estações (v4.8.4)
 stationAutoNameIndex: 1,
 stationAutoNameIndexByLine: {}, // { [lineId]: number }




 // Stack paralelo: distância mínima entre linhas (em unidades do mundo)
 nodePortSlots: {}, // { [nodeId]: { [lineId]: slotIndex } }
 stackParallelGap: 10, // começa com 2 (bem juntinho)


 activeLineId: null,
 selectedLineId: null,

 tool: "network", // neutral | network | line | connections | pan | select | text | curves
 view: { x: 0, y: 0, z: 1 },

 themeMode: "system",

 // UI
 propsMode: "metapanel", // metapanel (v4.6.0)
 dockPos: "bottom", // bottom | side (v4.6.0)

 // Curvas (v4.7.3)
 curveRoundness: 0.35,

 // Integrações (stack): espaçamento entre as “portas”
 interchangeStackGap: 0,        // px extras além do tangente
 interchangeStackScale: 1.0,    // multiplicador do espaçamento base



 // Integração entre linhas (v4.8.0)
 // "unified" = estações unificadas (sem stack), linhas se sobrepõem no mesmo centro
 // "stack" = modo legado (portas empilhadas por linha)
 interchangeMode: "unified",


 // Sinalização (v4.4.x)
 // - signagePreset: quando preenchido, o próximo clique no mapa cria sinalização (badge / nome / badge+nome)
 // - quando null: o próximo clique cria texto livre
 signagePreset: null, // {kind:"badge"|"name"|"badgeName", lineId} | null
 signageNameWithBadge: false,
	 textDraft: "",
	 // Próximo tamanho:
	 // - texto livre: 32 (padrão)
	 // - sinalização (badge/nome): 16 (padrão)
	 textNextSize: CFG.TEXT_DEFAULT_SIZE,
	 signageNextSize: CFG.SIGNAGE_DEFAULT_SIZE,
 signageNextBold: true,
 signageNextItalic: false,

 selectedNodeIds: new Set(),
 selectedEdgeId: null,
 selectedTextId: null,

 // ALT chain (apenas durante o arraste de encadeamento)
 isAltChaining: false,
};

    // Cache de “portas” de integração (recalculado a cada render)
    let interchangePortCache = { byNodeLine: new Map(), byNode: new Map(), byNodeAxis: new Map() };

    const parallelPortCache = new Map(); // key: `${nodeId}:${lineId}` -> {x,y}


    // Foco sob demanda
    let pendingStationFocusId = null;
    let pendingTextFocusId = null;

    // Sidebar update guard
    let sidebarIsUpdating = false;

    // Pan
    let isPanning = false;
    let panPointerId = null;
    let panStart = null;

    // Drag node/selection
    let isDraggingNodes = false;
    let dragPointerId = null;
    let dragStartWorld = null;
    let dragStartPositions = null; // Map nodeId -> {x,y}

    // Drag text
    let isDraggingText = false;
    let textPointerId = null;
    let textDragStartWorld = null;
    let textDragStartPos = null; // {x,y}
    let draggingTextId = null;

    // Chain / connect drag
    let isDraggingLink = false;
    let linkPointerId = null;
    let linkMode = "chain"; // chain | connect
    let linkFromNodeId = null;
    let linkGhostTo = null; // {x,y}

    // ╮ Curvas: arraste do ponto de dobra do traçado (v4.7.3)
    let isDraggingEdgeBend = false;
    let edgeBendPointerId = null;
    let draggingEdgeId = null;

    // Nova linha (ALT+arrastar no vazio no modo Linhas)
    let isDraggingNewLine = false;
    let newLinePointerId = null;
    let newLineStartWorld = null;
    let newLineGhostTo = null;

    // Selection marquee
    let isSelecting = false;
    let selectPointerId = null;
    let selectStartWorld = null;
    let selectCurrentWorld = null;

    // History
    const history = {
        undo: [],
 redo: [],
 max: 200,
    };

    // =========================
    // DOM elements (optional-friendly)
    // =========================
    const dom = {
        // svg/world
        viewport: $("viewport"),
 world: $("world"),
 gridG: $("grid"),
 edgesG: $("edges"),
 textsG: $("texts"),
 nodesG: $("nodes"),
 ghost: $("ghost"),
 selectRect: $("selectRect"),

 // toolbar
 dockTools: $("dockTools"),
 toolPointer: null, // botão 🖱️ (modo neutro)
 toolPan: $("toolPan"),
 toolStation: $("toolStation"),
 toolStationBadgeCircle: document.querySelector("#toolStation .tool-linebadge-circle"),
 toolStationBadgeText: document.querySelector("#toolStation .tool-linebadge-text"),
 toolText: $("toolText"),
 toolPalette: $("toolPalette"),
 toolLine: $("toolLine"),
 toolConnections: $("toolConnections"),
 toolCurves: $("toolCurves"),
 toolSelect: $("toolSelect"),

 btnUndo: $("btnUndo"),
 btnRedo: $("btnRedo"),

 btnShowSidebar: $("btnShowSidebar"),
 btnShowHelpPanel: $("btnShowHelpPanel"),

 // arquivo + JSON modal
 fileDropdown: $("fileDropdown"),
 btnFile: $("btnFile"),
 menuNewProject: $("menuNewProject"),
 menuImport: $("menuImport"),
 menuExport: $("menuExport"),
 menuClear: $("menuClear"),

 menuExportPNG: $("menuExportPNG"),
 menuExportPDF: $("menuExportPDF"),


 modal: $("modal"),
 modalTitle: $("modalTitle"),
 modalTextarea: $("modalTextarea"),
 btnModalPrimary: $("btnModalPrimary"),
 btnModalSecondary: $("btnModalSecondary"),
 btnModalTertiary: $("btnModalTertiary"),
 btnModalClose: $("btnModalClose"),

 btnConfig: $("btnConfig"),
 btnAbout: $("btnAbout"),
 btnHelp: $("btnHelp"),

 // help panel (optional)
 helpPanel: $("helpPanel"),
 btnHelpClose: $("btnHelpClose"),
 helpContent: $("helpContent"),

 // sliders de ajuste fino do painel de estações
 stationLabelOffsetXRange: $("stationLabelOffsetXRange"),
 stationLabelOffsetX: $("stationLabelOffsetX"),
 stationLabelOffsetYRange: $("stationLabelOffsetYRange"),
 stationLabelOffsetY: $("stationLabelOffsetY"),
 btnStationLabelOffsetReset: $("btnStationLabelOffsetReset"),


 // settings / about modals
 settingsModal: $("settingsModal"),
 btnSettingsClose: $("btnSettingsClose"),
 themeDark: $("themeDark"),
 themeLight: $("themeLight"),
 themeSystem: $("themeSystem"),

 // app settings (v4.6.0)
 dockPosSide: $("dockPosSide"),
 dockPosBottom: $("dockPosBottom"),

 aboutModal: $("aboutModal"),
 btnAboutClose: $("btnAboutClose"),
 aboutTitle: $("aboutTitle"),

 // sidebar containers
 sidebar: $("sidebar"),
 sidebarTitle: $("sidebarTitle"),
 sidebarMeta: $("sidebarMeta"),
 btnCloseSidebar: $("btnCloseSidebar"),

 // panels
 stationPanel: $("stationPanel"),
 multiPanel: $("multiPanel"),

 // curvas (painel)
 curveRoundnessRange: $("curveRoundnessRange"),
 curveRoundness: $("curveRoundness"),
 btnCurveReset: $("btnCurveReset"),
 linePanel: $("linePanel"),

 // station fields
 useStationPrefix: $("useStationPrefix"),
 useStationSuffix: $("useStationSuffix"),
 stationPrefixField: $("stationPrefixField"),
 stationSuffixField: $("stationSuffixField"),

 stationPrefix: $("stationPrefix"),
 stationName: $("stationName"),
 stationQuickPick: $("stationQuickPick"),
 stationSuffix: $("stationSuffix"),
 stationOrientation: $("stationOrientation"),
 applyStationOrientationActiveLine: $("applyStationOrientationActiveLine"),
 stationPos: $("stationPos"),
 btnAddStationAfter: $("btnAddStationAfter"),

 btnDeleteStation: $("btnDeleteStation"),

	 // station style (v4.4.5)
	 stationStyleShape: $("stationStyleShape"),
	 stationStyleSizeRange: $("stationStyleSizeRange"),
	 stationStyleSize: $("stationStyleSize"),
	 stationStyleDims: $("stationStyleDims"),
	 stationStyleWidthRange: $("stationStyleWidthRange"),
	 stationStyleWidth: $("stationStyleWidth"),
	 stationStyleHeightRange: $("stationStyleHeightRange"),
	 stationStyleHeight: $("stationStyleHeight"),
	 stationStyleFill: $("stationStyleFill"),
	 btnStationFillDefault: $("btnStationFillDefault"),
	 stationStyleStroke: $("stationStyleStroke"),
	 btnStationStrokeLine: $("btnStationStrokeLine"),
	 stationStyleStrokeWidthRange: $("stationStyleStrokeWidthRange"),
	 stationStyleStrokeWidth: $("stationStyleStrokeWidth"),
	 applyStationStyleActiveLine: $("applyStationStyleActiveLine"),
	 applyStationStyleSelection: $("applyStationStyleSelection"),

 // multi fields
 multiInfo: $("multiInfo"),
 multiOrientation: $("multiOrientation"),

 // multi station style (v4.6.1)
 multiStationStyleShape: $("multiStationStyleShape"),
 multiStationStyleSizeRange: $("multiStationStyleSizeRange"),
 multiStationStyleSize: $("multiStationStyleSize"),
 multiStationStyleDims: $("multiStationStyleDims"),
 multiStationStyleWidthRange: $("multiStationStyleWidthRange"),
 multiStationStyleWidth: $("multiStationStyleWidth"),
 multiStationStyleHeightRange: $("multiStationStyleHeightRange"),
 multiStationStyleHeight: $("multiStationStyleHeight"),
 multiStationStyleFill: $("multiStationStyleFill"),
 multiStationStyleStroke: $("multiStationStyleStroke"),
 multiStationStyleStrokeWidthRange: $("multiStationStyleStrokeWidthRange"),
 multiStationStyleStrokeWidth: $("multiStationStyleStrokeWidth"),
 multiStationStyleNote: $("multiStationStyleNote"),

 multiStationLabelOffsetXRange: $("multiStationLabelOffsetXRange"),
 multiStationLabelOffsetX: $("multiStationLabelOffsetX"),
 multiStationLabelOffsetYRange: $("multiStationLabelOffsetYRange"),
 multiStationLabelOffsetY: $("multiStationLabelOffsetY"),
 btnMultiStationLabelOffsetReset: $("btnMultiStationLabelOffsetReset"),


 btnDeleteSelection: $("btnDeleteSelection"),
 btnClearSelection: $("btnClearSelection"),

 // line fields
 btnAddLine: $("btnAddLine"),
  lineList: $("lineList"),

 lineName: $("lineName"),
 lineApplyDefaultOrientation: $("lineApplyDefaultOrientation"),
 lineDefaultOrientationField: $("lineDefaultOrientationField"),
 lineDefaultOrientation: $("lineDefaultOrientation"),

 // linha: identificação
 lineBadgeEnabled: $("lineBadgeEnabled"),
 lineBadgeText: $("lineBadgeText"),
 lineBadgePosStart: $("lineBadgePosStart"),
 lineBadgePosEnd: $("lineBadgePosEnd"),

 lineColor: $("lineColor"),
 lineColorHex: $("lineColorHex"),

 // v4.7.6: traço secundário (estilo Recife)
 lineSecondaryEnabled: $("lineSecondaryEnabled"),
 lineSecondaryControls: $("lineSecondaryControls"),
 lineSecondaryMode: $("lineSecondaryMode"),
 lineSecondaryCustom: $("lineSecondaryCustom"),
 lineSecondaryFromLine: $("lineSecondaryFromLine"),
 lineSecondaryColor: $("lineSecondaryColor"),
 lineSecondaryColorHex: $("lineSecondaryColorHex"),
 lineSecondaryLineId: $("lineSecondaryLineId"),
	 lineWidthRange: $("lineWidthRange"),
 lineWidth: $("lineWidth"),
 applyLineWidthAll: $("applyLineWidthAll"),
 lineStyle: $("lineStyle"),
 // curvas (v4.7.3)
 curveRoundnessRange: $("curveRoundnessRange"),
 curveRoundness: $("curveRoundness"),
 btnCurveReset: $("btnCurveReset"),
 btnDeleteLine: $("btnDeleteLine"),
 lineStations: $("lineStations"),

 // edge actions (inside line panel usually)
 edgeActions: $("edgeActions"),
 edgeInfo: $("edgeInfo"),
 btnDeleteEdge: $("btnDeleteEdge"),
 btnClearEdge: $("btnClearEdge"),
 edgeInterchangeMode: $("edgeInterchangeMode"),

 // Ctrl+F: connLineColor (painel Conexões)
 connLineColor: $("connLineColor"),
 connLineColorHex: $("connLineColorHex"),
 connLineWidthRange: $("connLineWidthRange"),
 connLineWidth: $("connLineWidth"),

 // Ctrl+F: connNodeSize
 connNodeShape: $("connNodeShape"),
 connNodeSizeRange: $("connNodeSizeRange"),
 connNodeSize: $("connNodeSize"),
 connNodeFill: $("connNodeFill"),
 connNodeFillHex: $("connNodeFillHex"),
 connNodeStroke: $("connNodeStroke"),
 connNodeStrokeHex: $("connNodeStrokeHex"),
 connNodeStrokeWidthRange: $("connNodeStrokeWidthRange"),
 connNodeStrokeWidth: $("connNodeStrokeWidth"),



 // accordions / empties
 accLine: $("accLine"),
 accConnections: $("accConnections"),
 accStation: $("accStation"),
 accPersonalizacao: $("accPersonalizacao"),
 accMulti: $("accMulti"),
 accEdge: $("accEdge"),

 stationEmpty: $("stationEmpty"),
 multiEmpty: $("multiEmpty"),
 edgeEmpty: $("edgeEmpty"),

 // ✅ texto
 accText: $("accText"),
 textEmpty: $("textEmpty"),
 textPanel: $("textPanel"),
        signageBadges: $("signageBadges"),
        signageNames: $("signageNames"),
        signageNameWithBadge: $("signageNameWithBadge"),
        signageSelected: $("signageSelected"),
 textContent: $("textContent"),
	 textSizeRange: $("textSizeRange"),
 textSize: $("textSize"),
 btnTextBold: $("btnTextBold"),
 btnTextItalic: $("btnTextItalic"),
 btnDeleteText: $("btnDeleteText"),
    };

    // =========================
    // Tema (v4.4.1)
    // =========================
    const THEME_KEY = "mobinode.theme";
    const themeMQ = window.matchMedia ? window.matchMedia("(prefers-color-scheme: dark)") : null;

    function effectiveTheme(mode) {
        if (mode === "dark" || mode === "light") return mode;
        const prefersDark = themeMQ ? !!themeMQ.matches : false;
        return prefersDark ? "dark" : "light";
    }

    function syncThemeRadios() {
        if (!dom.themeDark || !dom.themeLight || !dom.themeSystem) return;
        dom.themeDark.checked = state.themeMode === "dark";
        dom.themeLight.checked = state.themeMode === "light";
        dom.themeSystem.checked = state.themeMode === "system";
    }

    function setThemeMode(mode, persist = true) {
        const m = (mode === "dark" || mode === "light" || mode === "system") ? mode : "system";
        state.themeMode = m;
        const eff = effectiveTheme(m);
        document.documentElement.dataset.theme = eff;
        if (document.body) document.body.dataset.theme = eff;

        if (persist) {
            try { localStorage.setItem(THEME_KEY, m); } catch {}
        }
        syncThemeRadios();
    }

    function initTheme() {
        let saved = "system";
        try { saved = localStorage.getItem(THEME_KEY) || "system"; } catch {}
        setThemeMode(saved, false);
    }

    if (themeMQ) {
        const onChange = () => {
            if (state.themeMode === "system") setThemeMode("system", false);
        };
        if (themeMQ.addEventListener) themeMQ.addEventListener("change", onChange);
        else if (themeMQ.addListener) themeMQ.addListener(onChange);
    }


// =========================
// Propriedades (v4.6.0): modo Metapainel
// =========================
function applyPropsMode() {
    try {
        document.body.classList.toggle("metapanel", state.propsMode === "metapanel");
    } catch {}
}

// =========================
// Dock de ferramentas (v4.6.0)
// =========================
const DOCKPOS_KEY = "mobinode.dockPos";

function normalizeDockPos(pos) {
    return (pos === "side" || pos === "lateral") ? "side" : "bottom";
}

function applyDockPosition() {
    if (!dom.dockTools) return;
    const pos = normalizeDockPos(state.dockPos);
    dom.dockTools.classList.toggle("dock-side", pos === "side");
    dom.dockTools.classList.toggle("dock-bottom", pos === "bottom");
}

function syncDockPositionRadios() {
    if (!dom.dockPosSide || !dom.dockPosBottom) return;
    const pos = normalizeDockPos(state.dockPos);
    dom.dockPosSide.checked = pos === "side";
    dom.dockPosBottom.checked = pos === "bottom";
}

function setDockPosition(pos, persist = true) {
    state.dockPos = normalizeDockPos(pos);
    applyDockPosition();
    syncDockPositionRadios();
    if (persist) {
        try { localStorage.setItem(DOCKPOS_KEY, state.dockPos); } catch {}
    }
    // re-render/UX
    try { updateCursor(); } catch {}
}

function initDockPosition() {
    let saved = null;
    try { saved = localStorage.getItem(DOCKPOS_KEY); } catch {}
    if (saved) state.dockPos = normalizeDockPos(saved);
    applyDockPosition();
    syncDockPositionRadios();
}

    // UI helper: mostra/oculta o dropdown de "orientação padrão" da linha
    function setLineDefaultOrientationUI() {
        if (!dom.lineApplyDefaultOrientation || !dom.lineDefaultOrientationField) return;
        dom.lineDefaultOrientationField.style.display = dom.lineApplyDefaultOrientation.checked ? "block" : "none";
    }

function setSectionState(sectionEl, emptyEl, contentEl, enabled) {
        if (!sectionEl || !emptyEl || !contentEl) return;

        emptyEl.style.display = enabled ? "none" : "block";
        contentEl.classList.toggle("section-disabled", !enabled);

        const fields = contentEl.querySelectorAll("input, select, textarea, button");
        fields.forEach((f) => (f.disabled = !enabled));
    }

    // =========================
    // Utilities
    // =========================
    const uid = () => Math.random().toString(36).slice(2, 9);
    const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
    const snap = (v) => Math.round(v / CFG.GRID) * CFG.GRID;

    // Converte coordenadas do mundo para coordenadas alinhadas à grade
    const worldToGrid = (p) => ({ x: snap(p.x), y: snap(p.y) });


    // Geometria
    const dist2 = (a, b) => {
        const dx = a.x - b.x;
        const dy = a.y - b.y;
        return dx * dx + dy * dy;
    };

    function projectPointToSegment(p, a, b) {
        const abx = b.x - a.x;
        const aby = b.y - a.y;
        const apx = p.x - a.x;
        const apy = p.y - a.y;
        const ab2 = abx * abx + aby * aby;
        let t = ab2 > 1e-9 ? (apx * abx + apy * aby) / ab2 : 0;
        t = clamp(t, 0, 1);
        return { x: a.x + abx * t, y: a.y + aby * t, t };
    }

    function distPointToSegment(p, a, b) {
        const q = projectPointToSegment(p, a, b);
        return Math.hypot(p.x - q.x, p.y - q.y);
    }

    function edgePolylinePoints(a, b) {
        const x1 = a.x, y1 = a.y;
        const x2 = b.x, y2 = b.y;
        const dx = x2 - x1;
        const dy = y2 - y1;

        const DIAG_EPS = 1e-6;

        if (dx === 0 || dy === 0 || Math.abs(Math.abs(dx) - Math.abs(dy)) < DIAG_EPS) {
            return [a, b];
        }

        let kx, ky;
        if (Math.abs(dx) > Math.abs(dy)) {
            kx = x1 + Math.sign(dx) * Math.abs(dy);
            ky = y2;
        } else {
            kx = x2;
            ky = y1 + Math.sign(dy) * Math.abs(dx);
        }
        kx = snap(kx);
        ky = snap(ky);
        return [a, { x: kx, y: ky }, b];
    }

    function snapPointOntoSegmentGrid(p, a, b) {
        const dx = b.x - a.x;
        const dy = b.y - a.y;

        if (dx === 0 && dy === 0) return { x: a.x, y: a.y };

        // horizontal
        if (dy === 0) {
            const minx = Math.min(a.x, b.x);
            const maxx = Math.max(a.x, b.x);
            const x = clamp(snap(p.x), minx, maxx);
            return { x, y: a.y };
        }

        // vertical
        if (dx === 0) {
            const miny = Math.min(a.y, b.y);
            const maxy = Math.max(a.y, b.y);
            const y = clamp(snap(p.y), miny, maxy);
            return { x: a.x, y };
        }

        // diagonal 45°
        const DIAG_EPS = 1e-6;
        if (Math.abs(Math.abs(dx) - Math.abs(dy)) < DIAG_EPS) {
            const sign = dy > 0 ? 1 : -1;

            const minx = Math.min(a.x, b.x);
            const maxx = Math.max(a.x, b.x);
            const miny = Math.min(a.y, b.y);
            const maxy = Math.max(a.y, b.y);

            let x1 = clamp(snap(p.x), minx, maxx);
            let y1 = a.y + sign * (x1 - a.x);
            y1 = clamp(y1, miny, maxy);
            x1 = a.x + sign * (y1 - a.y);

            let y2 = clamp(snap(p.y), miny, maxy);
            let x2 = a.x + sign * (y2 - a.y);
            x2 = clamp(x2, minx, maxx);
            y2 = a.y + sign * (x2 - a.x);

            const d1 = (p.x - x1) * (p.x - x1) + (p.y - y1) * (p.y - y1);
            const d2 = (p.x - x2) * (p.x - x2) + (p.y - y2) * (p.y - y2);
            return d1 <= d2 ? { x: x1, y: y1 } : { x: x2, y: y2 };
        }

        // fallback
        return { x: snap(p.x), y: snap(p.y) };
    }

    const deepClone = (x) => JSON.parse(JSON.stringify(x));

    function normalizeHex(hex) {
        if (!hex) return null;
        let h = String(hex).trim();
        if (!h) return null;
        if (h[0] !== "#") h = "#" + h;
        return /^#[0-9a-fA-F]{6}$/.test(h) ? h : null;
    }

    function dashForStyle(style) {
        if (style === "dashed") return "14 10";
        if (style === "dotted") return "2 10";
        return null;
    }

    function snapAngle45(dx, dy) {
        const len = Math.hypot(dx, dy);
        if (len < 1e-6) return { dx: 0, dy: 0 };
        const ang = Math.atan2(dy, dx);
        const step = Math.PI / 4;
        const snapped = Math.round(ang / step) * step;
        return { dx: Math.cos(snapped) * len, dy: Math.sin(snapped) * len };
    }

    function screenToWorld(clientX, clientY) {
        const r = dom.viewport.getBoundingClientRect();
        return {
            x: (clientX - r.left - state.view.x) / state.view.z,
 y: (clientY - r.top - state.view.y) / state.view.z,
        };
    }

    function applyView() {
        if (!dom.world) return;
        const { x, y, z } = state.view;
        dom.world.setAttribute("transform", `translate(${x} ${y}) scale(${z})`);
    }

    function setGhost(on, d = "") {
        if (!dom.ghost) return;
        dom.ghost.style.display = on ? "block" : "none";
        dom.ghost.setAttribute("d", on ? d : "");
    }

    function updateCursor() {
        if (!dom.viewport) return;
        if (isPanning || state.tool === "pan") {
            dom.viewport.style.cursor = isPanning ? "grabbing" : "grab";
            return;
        }
        if (state.tool === "select") {
            dom.viewport.style.cursor = "crosshair";
            return;
        }
        if (state.tool === "line") {
            dom.viewport.style.cursor = "crosshair";
            return;
        }
        if (state.tool === "curves") {
            dom.viewport.style.cursor = "crosshair";
            return;
        }
        if (state.tool === "text") {
        dom.viewport.style.cursor = "crosshair";
        return;
    }

        dom.viewport.style.cursor = "default";
    }

    function splitLabelLines(s) {
        if (!s) return [];
        const raw = String(s);
        return raw
        .split(/\r?\n|\/+/g)
        .map((x) => x.trim())
        .filter(Boolean);
    }

    function setFieldVisible(fieldEl, visible) {
        if (!fieldEl) return;
        fieldEl.style.display = visible ? "block" : "none";
    }

// =========================
// Conexões (integrações) -> pílulas
// =========================
function connectedLineIdsForNode(nodeId) {
    const ids = new Set();
    for (const e of state.edges) {
        if (e.a === nodeId || e.b === nodeId) {
            if (e.lineId) ids.add(e.lineId);
        }
    }
    return ids;
}


// =========================
// Integrações (visual v4): “portas” por linha (mini-estações juntinhas)
// =========================
function rebuildInterchangePortCache() {
    interchangePortCache.byNodeLine = new Map();
    interchangePortCache.byNode = new Map();
    interchangePortCache.byNodeAxis = new Map();

    // v4.8.0: modo padrão = estações unificadas (sem empilhamento)
    if ((state.interchangeMode || "unified") === "unified") {
        return;
    }

    // v4.0.8: Empilhamento SEM GAP.
    // Queremos os círculos encostando (tangentes), sem “quadradinho” de distância.
    // OuterRadius = r + stroke/2  =>  passo = 2*OuterRadius = 2r + stroke.
	// OBS: stroke padrão da estação é 3 no CSS. Se o usuário mudar a strokeWidth,
	// o empilhamento acompanha o tamanho real da estação.
	const spacingForNode = (node) => {
        const r = stationRadiusForNode(node);
        const sw = stationStrokeWidthForNode(node);

        const base = (r * 2) + sw; // tangente
        const scale = Number(state.interchangeStackScale ?? 1.0);
        const extra = Number(state.interchangeStackGap ?? 0);

        return (base * scale) + extra;
    };


    for (const n of state.nodes) {
        const lineIds = [...connectedLineIdsForNode(n.id)].filter(Boolean);
        if (lineIds.length < 2) continue;

        // Ordena de forma estável (por nome da linha, depois id) pra não ficar “trocando” visualmente
        lineIds.sort((a, b) => {
            const la = findLine(a);
            const lb = findLine(b);
            const na = (la?.name ?? "").toString();
            const nb = (lb?.name ?? "").toString();
            return na.localeCompare(nb) || String(a).localeCompare(String(b));
        });
        // Escolhe eixo "metro" dominante a partir das arestas incidentes (evita cancelamento up/down)
        // Agrupa por ângulo snapped (módulo 180°) e pega o mais frequente.
        const step = Math.PI / 4;
        const bins = new Map(); // key (radian) -> count

        for (const e of state.edges) {
            if (e.a !== n.id && e.b !== n.id) continue;
            const otherId = (e.a === n.id) ? e.b : e.a;
            const other = findNode(otherId);
            if (!other) continue;

            const vx = other.x - n.x;
            const vy = other.y - n.y;
            const len = Math.hypot(vx, vy);
            if (len < 1e-6) continue;

            let ang = Math.atan2(vy, vx);
            ang = Math.round(ang / step) * step;
            // trata 180° como o mesmo eixo
            let axisAng = ang % Math.PI;
            if (axisAng < 0) axisAng += Math.PI;
            const key = axisAng.toFixed(6);
            bins.set(key, (bins.get(key) || 0) + 1);
        }

        let sx = 1, sy = 0;
        if (bins.size) {
            let bestKey = null;
            let bestCount = -1;
            for (const [k, c] of bins.entries()) {
                if (c > bestCount) {
                    bestCount = c;
                    bestKey = k;
                }
            }
            const a = parseFloat(bestKey);
            sx = Math.cos(a);
            sy = Math.sin(a);
        }

        // perpendicular unit (útil para cálculos auxiliares)
        const px = -sy;
        const py = sx;

		// v4.0.8: NÃO quantiza no grid, senão o passo vira 32 e cria gap.
		const spacing = spacingForNode(n);

        // guarda o eixo principal (e seu perpendicular) para renderização/heurísticas
        interchangePortCache.byNodeAxis.set(n.id, { sx, sy, px, py, spacing });

        const k = lineIds.length;
        const ports = [];
        for (let i = 0; i < k; i++) {
            const lineId = lineIds[i];
            // v4.0.7: “empilha” as conexões AO LONGO do eixo dominante (0/45/90/135...)
            // Assim, uma linha horizontal empilha horizontalmente; vertical empilha verticalmente; diagonal empilha diagonal.
            const off = (i - (k - 1) / 2) * spacing;
            // v4.0.8: não usa snap aqui pra não introduzir “respiro” artificial
            const x = (n.x + sx * off);
            const y = (n.y + sy * off);
            const pos = { x, y };
            interchangePortCache.byNodeLine.set(`${n.id}|${lineId}`, pos);
            ports.push({ lineId, x, y });
        }
        interchangePortCache.byNode.set(n.id, ports);
    }
}

function rebuildParallelPortCache() {
    parallelPortCache.clear();

    const gap = (typeof state.stackParallelGap === "number") ? state.stackParallelGap : 2;

    for (const n of state.nodes) {
        // 1) descobrir quais linhas passam nesse nó
        const linesHere = [];
        for (const e of state.edges) {
            if (e.a === n.id && e.lineId) linesHere.push(e.lineId);
            if (e.b === n.id && e.lineId) linesHere.push(e.lineId);
        }
        const uniq = [...new Set(linesHere)];
        if (uniq.length <= 1) continue;

        // 2) direção de referência (pode ser um edge qualquer conectado)
        const e0 = state.edges.find(e => e.a === n.id || e.b === n.id);
        if (!e0) continue;

        const otherId = (e0.a === n.id) ? e0.b : e0.a;
        const other = state.nodes.find(nn => nn.id === otherId);
        if (!other) continue;

        const vx = other.x - n.x;
        const vy = other.y - n.y;
        const len = Math.hypot(vx, vy) || 1;

        // perpendicular normalizada
        const nx = -vy / len;
        const ny =  vx / len;

        // 3) aplica slots fixos por linha (NÃO RECENTRA)
        for (const lineId of uniq) {
            const slot = ensurePortSlot(n.id, lineId);
            parallelPortCache.set(`${n.id}:${lineId}`, {
                x: n.x + nx * slot * gap,
                y: n.y + ny * slot * gap
            });
        }
    }
}



function getNodeSlotMap(nodeId) {
    if (!state.nodePortSlots[nodeId]) state.nodePortSlots[nodeId] = {};
    return state.nodePortSlots[nodeId];
}

function pickNextSlot(usedSet) {
    // ordem: 0, +1, -1, +2, -2, +3, -3...
    if (!usedSet.has(0)) return 0;
    for (let k = 1; k < 50; k++) { // 50 é overkill, só pra garantir
        if (!usedSet.has(k)) return k;
        if (!usedSet.has(-k)) return -k;
    }
    return 0;
}

function ensurePortSlot(nodeId, lineId) {
    const m = getNodeSlotMap(nodeId);
    if (typeof m[lineId] === "number") return m[lineId];

    const used = new Set(Object.values(m).filter(v => typeof v === "number"));
    const slot = pickNextSlot(used);
    m[lineId] = slot;
    return slot;
}


function getParallelPortPos(nodeId, lineId) {
    return parallelPortCache.get(`${nodeId}:${lineId}`) || null;
}



function getPortPos(nodeId, lineId) {
    if (!nodeId || !lineId) return null;
    return interchangePortCache.byNodeLine.get(`${nodeId}|${lineId}`) || null;
}


function pillSizeForLineCount(k) {
    const r = CFG.STATION_R;
    const baseW = r * 2;
    const baseH = r * 2;
    const extraPer = r * 1.6;
    const maxLines = 8; // limite visual (evita pílula gigante)
    const kk = Math.max(1, Math.min(k, maxLines));
    const w = baseW + Math.max(0, kk - 1) * extraPer;
    const h = baseH;
    return { w, h, r };
}

function pointToRectDistance(px, py, cx, cy, w, h) {
    // distância do ponto até um retângulo centrado em (cx,cy) com tamanho (w,h)
    const dx = Math.abs(px - cx) - w / 2;
    const dy = Math.abs(py - cy) - h / 2;
    const ax = Math.max(dx, 0);
    const ay = Math.max(dy, 0);
    return Math.hypot(ax, ay);
}

// =========================
// Marcadores de ponta de linha (bolinha com id)
// =========================
function hexToRgb(hex) {
    if (!hex) return null;
    const h = String(hex).trim().replace("#", "");
    if (h.length === 3) {
        const r = parseInt(h[0] + h[0], 16);
        const g = parseInt(h[1] + h[1], 16);
        const b = parseInt(h[2] + h[2], 16);
        return { r, g, b };
    }
    if (h.length !== 6) return null;
    const r = parseInt(h.slice(0, 2), 16);
    const g = parseInt(h.slice(2, 4), 16);
    const b = parseInt(h.slice(4, 6), 16);
    return { r, g, b };
}

function contrastTextColor(bgHex) {
    const rgb = hexToRgb(bgHex);
    if (!rgb) return "#fff";
    // luminância simples (perceptual-ish)
    const yiq = (rgb.r * 299 + rgb.g * 587 + rgb.b * 114) / 1000;
    return yiq >= 165 ? "#0b0d12" : "#ffffff";
}

function lineBadgeLabel(line) {
    const name = (line?.name ?? "").toString().trim();
    const m = name.match(/(\d+)/);
    if (m) return m[1].slice(0, 2);
    const words = name.split(/\s+/).filter(Boolean);
    if (words.length >= 2) {
        const abbr = words.map((w) => w[0]).join("").toUpperCase();
        return abbr.slice(0, 2);
    }
    return (name.slice(0, 2) || "L").toUpperCase();
}

function sliceGraphemes(str, max) {
    const s = (str ?? "").toString();
    const m = Math.max(0, max | 0);
    if (m === 0) return "";
    // Prefer grapheme clusters (emoji-friendly)
    try {
        if (typeof Intl !== "undefined" && Intl.Segmenter) {
            const seg = new Intl.Segmenter(undefined, { granularity: "grapheme" });
            let out = "";
            let c = 0;
            for (const part of seg.segment(s)) {
                out += part.segment;
                c++;
                if (c >= m) break;
            }
            return out;
        }
    } catch {}
    // Fallback: code points
    return Array.from(s).slice(0, m).join("");
}

function sanitizeLineBadgeText(str) {
    // mantém o que o usuário "vê" como caractere (inclui emoji), max 2
    const s = (str ?? "").toString();
    return sliceGraphemes(s, 2);
}


function stationSupportRadiusAlongDir(nodeId, dirx, diry) {
    // distância aproximada do centro até a borda da estação na direção (dirx,diry)
    const n = findNode(nodeId);
	if (!n) return CFG.STATION_R;
	const baseR = stationRadiusForNode(n);

    const len = Math.hypot(dirx, diry);
	if (len < 1e-6) return baseR;
    const ux = dirx / len;
    const uy = diry / len;

    const ports = interchangePortCache.byNode.get(nodeId);
    if (ports && ports.length) {
        // pega a porta mais “pra frente” nessa direção e soma o raio
        let maxProj = 0;
        for (const p of ports) {
            const ox = p.x - n.x;
            const oy = p.y - n.y;
            const proj = ox * ux + oy * uy;
            if (proj > maxProj) maxProj = proj;
        }
		return Math.max(baseR, maxProj + baseR + 2);
    }

	return baseR;
}

function getLineEndpoints(lineId) {
    const deg = new Map(); // nodeId -> degree
    const neighbors = new Map(); // nodeId -> one neighbor (enough pro endpoint)
    for (const e of state.edges) {
        if (e.lineId !== lineId) continue;
        deg.set(e.a, (deg.get(e.a) || 0) + 1);
        deg.set(e.b, (deg.get(e.b) || 0) + 1);
        // guarda um vizinho por nó (serve pra direction no endpoint)
        neighbors.set(e.a, e.b);
        neighbors.set(e.b, e.a);
    }

    const out = [];
    for (const [nodeId, d] of deg.entries()) {
        if (d === 1) {
            const nb = neighbors.get(nodeId);
            if (nb) out.push({ nodeId, neighborId: nb });
        }
    }
    return out;
}


function chooseLineBadgeEndpoint(line, endpoints) {
    // escolhe um endpoint determinístico: "start" = mais à esquerda (menor X, depois Y), "end" = mais à direita
    const enriched = [];
    for (const ep of endpoints) {
        const n = findNode(ep.nodeId);
        if (!n) continue;
        enriched.push({ ...ep, x: n.x, y: n.y });
    }
    if (!enriched.length) return null;
    enriched.sort((a, b) => (a.x - b.x) || (a.y - b.y));
    const pos = (line && line.badgePosition === "end") ? "end" : "start";
    return pos === "end" ? enriched[enriched.length - 1] : enriched[0];
}

function resolveLineBadgeLabel(line) {
    const raw = (typeof line?.badgeText === "string") ? line.badgeText : "";
    const clean = sanitizeLineBadgeText(raw).trim();
    if (clean) return clean;
    return lineBadgeLabel(line);
}

// =========================
// UI: Botão Estação (mostra a linha ativa)
// =========================
function updateStationToolBadge() {
    if (!dom.toolStation || !dom.toolStationBadgeCircle || !dom.toolStationBadgeText) return;

    const line = findLine(state.activeLineId) || state.lines[0] || null;
    if (!line) {
        dom.toolStationBadgeCircle.style.background = "#78aaff";
        dom.toolStationBadgeText.textContent = "";
        dom.toolStation.title = "Estação";
        return;
    }

    ensureLineBadgeProps(line);

    const fill = line.color || "#78aaff";
    const label = resolveLineBadgeLabel(line);
    const textFill = contrastTextColor(fill);

    dom.toolStationBadgeCircle.style.background = fill;
    dom.toolStationBadgeText.style.color = textFill;
    dom.toolStationBadgeText.textContent = label;
    dom.toolStation.title = `Estação (Linha ativa: ${line.name || "(sem nome)"})`;
}

function renderLineEndpointBadges() {
    if (!dom.nodesG) return;

    for (const line of (state.lines || []).filter(l => !isConnectorLine(l))) {
        // compat/defaults
        const enabled = (typeof line.badgeEnabled === "boolean") ? line.badgeEnabled : true;
        if (!enabled) continue;

        const endpoints = getLineEndpoints(line.id);
        if (!endpoints.length) continue;

        const chosen = chooseLineBadgeEndpoint(line, endpoints);
        if (!chosen) continue;

        const fill = line.color || "#78aaff";
        const textFill = contrastTextColor(fill);
        const label = resolveLineBadgeLabel(line);

        const a = findNode(chosen.nodeId);
        const b = findNode(chosen.neighborId);
        if (!a || !b) continue;

        let vx = a.x - b.x;
        let vy = a.y - b.y;
        const len = Math.hypot(vx, vy);
        if (!len) continue;
        vx /= len; vy /= len;

        const stationR = stationSupportRadiusAlongDir(chosen.nodeId, vx, vy);
        const badgeR = CFG.LINE_BADGE_R;
        const gap = CFG.LINE_BADGE_GAP;

        const px = a.x + vx * (stationR + gap + badgeR + (line.width || 8) / 2);
        const py = a.y + vy * (stationR + gap + badgeR + (line.width || 8) / 2);

        const g = el("g");
        g.setAttribute("class", "line-badge");
        g.setAttribute("pointer-events", "none");

        const c = el("circle");
        c.setAttribute("cx", px);
        c.setAttribute("cy", py);
        c.setAttribute("r", String(badgeR));
        c.setAttribute("class", "line-badge-circle");
        c.setAttribute("fill", fill);
        g.appendChild(c);

        const t = el("text");
        t.setAttribute("class", "line-badge-text");
        t.setAttribute("x", px);
        t.setAttribute("y", py);
        t.setAttribute("text-anchor", "middle");
        t.setAttribute("dominant-baseline", "central");
        t.setAttribute("font-weight", "900");
        t.setAttribute("font-size", String(CFG.LINE_BADGE_FONT));
        t.setAttribute("fill", textFill);
        t.textContent = label;
        g.appendChild(t);

        dom.nodesG.appendChild(g);
    }
}


    // =========================
    // Finders
    // =========================
    const findNode = (id) => state.nodes.find((n) => n.id === id) || null;
    const findEdge = (id) => state.edges.find((e) => e.id === id) || null;
    const findLine = (id) => state.lines.find((l) => l.id === id) || null;
    const findText = (id) => state.texts.find((t) => t.id === id) || null;

    // =========================

    function ensureLineBadgeProps(l) {
        if (!l) return;
        if (typeof l.badgeEnabled !== "boolean") l.badgeEnabled = true; // legado: sempre aparecia
        if (typeof l.badgeText !== "string") l.badgeText = "";
        l.badgeText = sanitizeLineBadgeText(l.badgeText);
        if (l.badgePosition !== "start" && l.badgePosition !== "end") l.badgePosition = "start";

		// v4.5.2: estilo padrão de estação por linha (usado em novas estações)
		if (!l.stationStyleDefault || typeof l.stationStyleDefault !== "object") {
			l.stationStyleDefault = {
				shape: "circle",
				size: CFG.STATION_R * 2,
				fill: "#ffffff",
				stroke: "",
				strokeWidth: 3,
			};
		} else {
			// normaliza campos
			const s = l.stationStyleDefault;
			const sh = (s.shape || "circle").toString();
			s.shape = (sh === "square" || sh === "diamond" || sh === "circle") ? sh : "circle";
			const sz = (typeof s.size === "number") ? s.size : parseFloat(s.size);
			s.size = Number.isFinite(sz) ? clamp(sz, 4, 80) : (CFG.STATION_R * 2);
			const sw = (typeof s.strokeWidth === "number") ? s.strokeWidth : parseFloat(s.strokeWidth);
			s.strokeWidth = Number.isFinite(sw) ? clamp(sw, 0, 20) : 3;
			s.fill = (typeof s.fill === "string" && s.fill.trim()) ? s.fill.trim() : "#ffffff";
			s.stroke = (typeof s.stroke === "string") ? s.stroke : "";
		}

		// v4.7.6: traço secundário (estilo Recife-like)
		if (typeof l.secondaryEnabled !== "boolean") l.secondaryEnabled = false;
		if (typeof l.secondaryMode !== "string") l.secondaryMode = "custom"; // custom | line
		if (l.secondaryMode !== "custom" && l.secondaryMode !== "line") l.secondaryMode = "custom";
		if (typeof l.secondaryColor !== "string" || !String(l.secondaryColor).trim()) l.secondaryColor = "#f97316";
		if (typeof l.secondaryLineId !== "string") l.secondaryLineId = "";
		// proporção do traço interno (0..1) — mantemos simples, sem UI por enquanto
		const rr = (typeof l.secondaryRatio === "number") ? l.secondaryRatio : parseFloat(l.secondaryRatio);
		l.secondaryRatio = Number.isFinite(rr) ? clamp(rr, 0.2, 0.95) : 0.55;
    }

    // =========================
    // Sinalização / Textos (v4.4.1)
    // =========================
    function ensureTextProps(t) {
        if (!t) return;
        if (typeof t.kind !== "string") t.kind = "text";
        if (typeof t.size !== "number") {
            const v = parseFloat(t.size);
	        const isSignage = (t.kind === "badge" || t.kind === "name" || t.kind === "badgeName");
	        const def = isSignage ? CFG.SIGNAGE_DEFAULT_SIZE : CFG.TEXT_DEFAULT_SIZE;
	        t.size = Number.isFinite(v) ? v : def;
        }
        if (typeof t.bold !== "boolean") t.bold = true;
        if (typeof t.italic !== "boolean") t.italic = false;

        if (t.kind === "badge" || t.kind === "name" || t.kind === "badgeName") {
            if (typeof t.lineId !== "string") t.lineId = state.activeLineId;
            // fallbacks (para caso a linha seja deletada)
            if (typeof t.fallbackName !== "string") t.fallbackName = "";
            if (typeof t.fallbackLabel !== "string") t.fallbackLabel = "";
            if (typeof t.fallbackColor !== "string") t.fallbackColor = "";
        } else {
            if (typeof t.text !== "string") t.text = "Texto";
        }
    }

    function ensureAllTexts() {
        state.texts.forEach(ensureTextProps);
    }

    function normalizeSignagePreset() {
        const p = state.signagePreset;
        if (!p) return;
        const okKind = (p.kind === "badge" || p.kind === "name" || p.kind === "badgeName");
        const okLine = okKind && !!findLine(p.lineId);
        if (!okLine) state.signagePreset = null;
    }

    function setSignagePreset(kind, lineId) {
        // Ao escolher badge/nome, o padrão de tamanho deve ser mais compacto.
        // (Evita "herdar" o tamanho do texto livre.)
        if (state.signageNextSize === CFG.TEXT_DEFAULT_SIZE) {
            state.signageNextSize = CFG.SIGNAGE_DEFAULT_SIZE;
        }

        state.signagePreset = { kind, lineId };
        normalizeSignagePreset();
        setTool("text");
        showSidebar(true);
        openAccordion(dom.accText);
        renderSignagePickers();
        refreshSidebar();
    }

    function applySignageChoice(kind, lineId) {
        // Se houver um elemento selecionado, transforma ele.
        if (state.selectedTextId) {
            const t = findText(state.selectedTextId);
            if (!t) {
                state.selectedTextId = null;
            } else {
                pushHistory();
				const prevKind = t.kind || "text";
                t.kind = kind;
                t.lineId = lineId;
                const line = findLine(lineId);
                if (line) {
                    try { ensureLineBadgeProps(line); } catch {}
                    t.fallbackName = line.name || t.fallbackName || "";
                    t.fallbackLabel = resolveLineBadgeLabel(line);
                    t.fallbackColor = line.color || t.fallbackColor || "";
                }
                if (kind === "badge") {
                    t.bold = true;
                    t.italic = false;
                }
				// Se veio de texto livre -> vira sinalização: aplica o tamanho padrão de sinalização
				if (prevKind === "text" && (kind === "badge" || kind === "name" || kind === "badgeName")) {
					t.size = state.signageNextSize ?? CFG.SIGNAGE_DEFAULT_SIZE;
				}
                ensureTextProps(t);
                state.signagePreset = { kind, lineId };
                normalizeSignagePreset();
                setTool("text");
                showSidebar(true);
                openAccordion(dom.accText);
                renderAll();
                refreshSidebar();
                return;
            }
        }
        // Caso contrário, apenas prepara o próximo clique.
        setSignagePreset(kind, lineId);
    }

    function renderSignagePickers() {
        if (!dom.signageBadges || !dom.signageNames) return;
        normalizeSignagePreset();

        dom.signageBadges.innerHTML = "";
        dom.signageNames.innerHTML = "";

        // Não mostrar a linha técnica de conexões nos pickers de sinalização.
        for (const line of (state.lines || []).filter(l => !isConnectorLine(l))) {
            ensureLineBadgeProps(line);
            const label = resolveLineBadgeLabel(line);
            const fill = line.color || "#78aaff";
            const textFill = contrastTextColor(fill);

            // Identificação (badge)
            const b = document.createElement("button");
            b.type = "button";
            b.className = "signage-pick";
            b.title = `Identificação: ${line.name || "Linha"}`;
            if (state.signagePreset?.kind === "badge" && state.signagePreset?.lineId === line.id) b.classList.add("selected");

            const circ = document.createElement("span");
            circ.className = "tool-linebadge-circle";
            circ.style.background = fill;
            const txt = document.createElement("span");
            txt.className = "tool-linebadge-text";
            txt.style.color = textFill;
            txt.textContent = label;
            circ.appendChild(txt);
            b.appendChild(circ);

            b.addEventListener("click", () => applySignageChoice("badge", line.id));
            dom.signageBadges.appendChild(b);

            // Nome da linha
            const n = document.createElement("button");
            n.type = "button";
            n.className = "signage-pick signage-name-item";
            n.title = `Nome da linha: ${line.name || "(sem nome)"}`;
            if ((state.signagePreset?.kind === "name" || state.signagePreset?.kind === "badgeName") && state.signagePreset?.lineId === line.id) n.classList.add("selected");

            const left = document.createElement("span");
            left.className = "signage-name-left";
            const dot = document.createElement("span");
            dot.className = "signage-dot";
            dot.style.background = fill;
            const nameSpan = document.createElement("span");
            nameSpan.textContent = line.name || "(sem nome)";
            left.appendChild(dot);
            left.appendChild(nameSpan);
            n.appendChild(left);

            const nameKind = state.signageNameWithBadge ? "badgeName" : "name";
            n.addEventListener("click", () => applySignageChoice(nameKind, line.id));
            dom.signageNames.appendChild(n);
        }

        // Atualiza label de seleção
        if (dom.signageSelected) {
            if (!state.selectedTextId) {
                const p = state.signagePreset;
                if (!p) {
                    dom.signageSelected.textContent = "Pronto pra posicionar: Texto livre";
                } else {
                    const line = findLine(p.lineId);
                    const txt = (p.kind === "badge")
                        ? `Pronto pra posicionar: Identificação • ${line ? line.name : "Linha"}`
                        : (p.kind === "badgeName")
                            ? `Pronto pra posicionar: Badge + nome • ${line ? line.name : "Linha"}`
                            : `Pronto pra posicionar: Nome da linha • ${line ? line.name : "Linha"}`;
                    dom.signageSelected.textContent = txt;
                }
            }
        }
    }



    // Lines init
    // =========================
    function ensureAtLeastOneLine() {
        if (state.lines.length === 0) {
            const l = { id: uid(), name: "Linha 1", color: "#78aaff", width: 8, style: "solid", badgeEnabled: true, badgeText: "", badgePosition: "start" };
            ensureLineBadgeProps(l);
    state.lines.push(l);
            state.activeLineId = l.id;
            state.selectedLineId = l.id;
            return;
        }
        state.lines.forEach(ensureLineBadgeProps);
        if (!state.activeLineId) state.activeLineId = state.lines[0].id;
        if (!state.selectedLineId) state.selectedLineId = state.activeLineId;

        normalizeSignagePreset();
    }

    // =========================
    // History
    // =========================
    function captureSnapshot() {
        return {
            nodes: deepClone(state.nodes),
 edges: deepClone(state.edges),
 lines: deepClone(state.lines),
 texts: deepClone(state.texts),
 activeLineId: state.activeLineId,
 selectedLineId: state.selectedLineId,
 tool: state.tool,
 selectedNodeIds: [...state.selectedNodeIds],
 selectedEdgeId: state.selectedEdgeId,
 selectedTextId: state.selectedTextId,
        };
    }

    function restoreSnapshot(s) {
        state.nodes = deepClone(s.nodes || []);
        state.edges = deepClone(s.edges || []);
        state.lines = deepClone(s.lines || []);
        state.texts = deepClone(s.texts || []);
        state.activeLineId = s.activeLineId ?? null;
        state.selectedLineId = s.selectedLineId ?? null;
        state.tool = s.tool || "network";
        // Importante: histórico NÃO deve desfazer/refazer pan/zoom.
        // Mantemos a view atual do usuário.
        state.selectedNodeIds = new Set(s.selectedNodeIds || []);
        state.selectedEdgeId = s.selectedEdgeId ?? null;
        state.selectedTextId = s.selectedTextId ?? null;

        ensureAtLeastOneLine();
        ensureAllTexts();
        normalizeSignagePreset();
        applyView();
        renderAll();
        refreshSidebar();
        updateCursor();
        updateUndoRedoButtons();
    }

    function pushHistory() {
        history.undo.push(captureSnapshot());
        if (history.undo.length > history.max) history.undo.shift();
        history.redo.length = 0;
        updateUndoRedoButtons();
    }

    function undo() {
        if (history.undo.length === 0) return;
        history.redo.push(captureSnapshot());
        const prev = history.undo.pop();
        restoreSnapshot(prev);
    }

    function redo() {
        if (history.redo.length === 0) return;
        history.undo.push(captureSnapshot());
        const next = history.redo.pop();
        restoreSnapshot(next);
    }

    function updateUndoRedoButtons() {
        if (dom.btnUndo) dom.btnUndo.disabled = history.undo.length === 0;
        if (dom.btnRedo) dom.btnRedo.disabled = history.redo.length === 0;
    }

    // =========================
    // Rendering
    // =========================
    function computeAutoKinkPoint(a, b) {
        const x1 = a.x, y1 = a.y;
        const x2 = b.x, y2 = b.y;
        const dx = x2 - x1;
        const dy = y2 - y1;

        // reto (horizontal/vertical/diagonal perfeita)
        if (dx === 0 || dy === 0 || Math.abs(dx) === Math.abs(dy)) return null;

        let kx, ky;
        if (Math.abs(dx) > Math.abs(dy)) {
            kx = x1 + Math.sign(dx) * Math.abs(dy);
            ky = y2;
        } else {
            kx = x2;
            ky = y1 + Math.sign(dy) * Math.abs(dx);
        }
        return { x: snap(kx), y: snap(ky) };
    }

    function roundedCornerPath(a, k, b, roundness01) {
        // roundness01: 0..1 (0 = quina seca)
        const t = Math.max(0, Math.min(1, Number(roundness01) || 0));
        if (t <= 0) return `M ${a.x} ${a.y} L ${k.x} ${k.y} L ${b.x} ${b.y}`;

        const ax = k.x - a.x;
        const ay = k.y - a.y;
        const bx = b.x - k.x;
        const by = b.y - k.y;
        const la = Math.hypot(ax, ay);
        const lb = Math.hypot(bx, by);
        if (la < 1e-6 || lb < 1e-6) return `M ${a.x} ${a.y} L ${k.x} ${k.y} L ${b.x} ${b.y}`;

        // raio “bonito”: proporcional ao menor segmento e ao grid
        const maxR = Math.min(la, lb) * 0.45;
        const base = Math.max(2, CFG.GRID * 0.35);
        const r = Math.max(2, Math.min(maxR, base + t * (CFG.GRID * 0.9)));

        const ua = { x: ax / la, y: ay / la };
        const ub = { x: bx / lb, y: by / lb };
        const p1 = { x: k.x - ua.x * r, y: k.y - ua.y * r };
        const p2 = { x: k.x + ub.x * r, y: k.y + ub.y * r };

        // sweep: escolhe o lado “interno” baseado no produto vetorial
        const cross = ua.x * ub.y - ua.y * ub.x;
        const sweep = cross < 0 ? 0 : 1;

        return `M ${a.x} ${a.y} L ${p1.x} ${p1.y} A ${r} ${r} 0 0 ${sweep} ${p2.x} ${p2.y} L ${b.x} ${b.y}`;
    }

    function getEdgeManualKinkPoint(a, b, e) {
        if (!e) return null;
        const mid = { x: snap((a.x + b.x) / 2), y: snap((a.y + b.y) / 2) };
        // Novo formato (v4.7.4): bendOffset mantém a dobra “presa” ao segmento ao mover as estações
        if (e.bendOffset && Number.isFinite(e.bendOffset.dx) && Number.isFinite(e.bendOffset.dy)) {
            return { x: snap(mid.x + e.bendOffset.dx), y: snap(mid.y + e.bendOffset.dy) };
        }
        // Legado: bend absoluto
        if (e.bend && Number.isFinite(e.bend.x) && Number.isFinite(e.bend.y)) {
            return { x: snap(e.bend.x), y: snap(e.bend.y) };
        }
        return null;
    }


    function edgePath(a, b, edge = null) {
        const x1 = a.x, y1 = a.y;
        const x2 = b.x, y2 = b.y;
        const dx = x2 - x1;
        const dy = y2 - y1;
        let kink = getEdgeManualKinkPoint(a, b, edge);
        if (!kink) kink = computeAutoKinkPoint(a, b);
        if (!kink) return `M ${x1} ${y1} L ${x2} ${y2}`;

        // Se o kink cair “em cima” de um dos endpoints, volta pro simples
        if ((kink.x === x1 && kink.y === y1) || (kink.x === x2 && kink.y === y2)) {
            return `M ${x1} ${y1} L ${x2} ${y2}`;
        }

        // Suaviza só quando for “L” (horizontal/vertical). Se virar diagonal louca, mantém seco.
        const isL = (kink.x === x1 || kink.y === y1) && (kink.x === x2 || kink.y === y2);
        if (!isL) return `M ${x1} ${y1} L ${kink.x} ${kink.y} L ${x2} ${y2}`;

        return roundedCornerPath(a, kink, b, state.curveRoundness);
    }

    function renderGrid() {
        if (!dom.gridG) return;
        dom.gridG.innerHTML = "";
        const h = CFG.GRID_EXTENT / 2;

        for (let x = -h; x <= h; x += CFG.GRID) {
            const l = el("line");
            l.setAttribute("x1", x);
            l.setAttribute("y1", -h);
            l.setAttribute("x2", x);
            l.setAttribute("y2", h);
            l.setAttribute("class", "grid-line");
            dom.gridG.appendChild(l);
        }

        for (let y = -h; y <= h; y += CFG.GRID) {
            const l = el("line");
            l.setAttribute("x1", -h);
            l.setAttribute("y1", y);
            l.setAttribute("x2", h);
            l.setAttribute("y2", y);
            l.setAttribute("class", "grid-line");
            dom.gridG.appendChild(l);
        }
    }

    function renderTexts() {
        if (!dom.textsG) return;
        dom.textsG.innerHTML = "";

        for (const tdata of state.texts) {
            ensureTextProps(tdata);
            const kind = tdata.kind || "text";
            const selected = tdata.id === state.selectedTextId;

            if (kind === "badge") {
                const line = findLine(tdata.lineId);
                const fill = (line && line.color) ? line.color : (tdata.fallbackColor || "#78aaff");
                const label = line ? resolveLineBadgeLabel(line) : (tdata.fallbackLabel || "L");
                const textFill = contrastTextColor(fill);

                const g = el("g");
                g.setAttribute("class", `map-text map-signage-badge${selected ? " selected" : ""}`);
                g.setAttribute("data-id", tdata.id);
                g.setAttribute("transform", `translate(${tdata.x},${tdata.y})`);
                g.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); onTextDown(ev, tdata.id); });

                const r = Math.max(10, (tdata.size || CFG.TEXT_DEFAULT_SIZE) * 0.55);
                const c = el("circle");
                c.setAttribute("class", "line-badge-circle");
                c.setAttribute("cx", "0");
                c.setAttribute("cy", "0");
                c.setAttribute("r", String(r));
                c.setAttribute("fill", fill);
                g.appendChild(c);

                const t = el("text");
                t.setAttribute("class", "line-badge-text");
                t.setAttribute("x", "0");
                t.setAttribute("y", "0");
                t.setAttribute("text-anchor", "middle");
                t.setAttribute("dominant-baseline", "central");
                t.setAttribute("font-weight", "900");
                t.setAttribute("font-size", String(Math.max(10, (tdata.size || CFG.TEXT_DEFAULT_SIZE) * 0.60)));
                t.setAttribute("fill", textFill);
                t.textContent = label;
                g.appendChild(t);

                dom.textsG.appendChild(g);
                continue;
            }

            if (kind === "badgeName") {
                const line = findLine(tdata.lineId);
                const fill = (line && line.color) ? line.color : (tdata.fallbackColor || "#78aaff");
                const label = line ? resolveLineBadgeLabel(line) : (tdata.fallbackLabel || "L");
                const name = line ? (line.name || "(sem nome)") : (tdata.fallbackName || "Linha");
                const textFill = contrastTextColor(fill);

                const g = el("g");
                g.setAttribute("class", `map-text map-signage-badgename${selected ? " selected" : ""}`);
                g.setAttribute("data-id", tdata.id);
                g.setAttribute("transform", `translate(${tdata.x},${tdata.y})`);
                g.addEventListener("pointerdown", (ev) => { ev.stopPropagation(); onTextDown(ev, tdata.id); });

                const r = Math.max(10, (tdata.size || CFG.TEXT_DEFAULT_SIZE) * 0.55);
                const c = el("circle");
                c.setAttribute("class", "line-badge-circle");
                c.setAttribute("cx", "0");
                c.setAttribute("cy", "0");
                c.setAttribute("r", String(r));
                c.setAttribute("fill", fill);
                g.appendChild(c);

                const bt = el("text");
                bt.setAttribute("class", "line-badge-text");
                bt.setAttribute("x", "0");
                bt.setAttribute("y", "0");
                bt.setAttribute("text-anchor", "middle");
                bt.setAttribute("dominant-baseline", "central");
                bt.setAttribute("font-weight", "900");
                bt.setAttribute("font-size", String(Math.max(10, (tdata.size || CFG.TEXT_DEFAULT_SIZE) * 0.60)));
                bt.setAttribute("fill", textFill);
                bt.textContent = label;
                g.appendChild(bt);

                const nt = el("text");
                nt.setAttribute("class", `map-text${selected ? " selected" : ""}`);
                nt.setAttribute("x", String(r + 8));
                nt.setAttribute("y", "0");
                nt.setAttribute("text-anchor", "start");
                nt.setAttribute("dominant-baseline", "central");
                nt.setAttribute("font-size", String(tdata.size || CFG.TEXT_DEFAULT_SIZE));
                nt.setAttribute("font-weight", (tdata.bold ? "700" : "400"));
                nt.setAttribute("font-style", (tdata.italic ? "italic" : "normal"));
                nt.setAttribute("fill", fill);
                nt.textContent = name;
                g.appendChild(nt);

                dom.textsG.appendChild(g);
                continue;
            }

            // Nome de linha (sinalização) ou texto livre legado
            const line = (kind === "name") ? findLine(tdata.lineId) : null;
            const content = (kind === "name")
            ? (line ? (line.name || "(sem nome)") : (tdata.fallbackName || "Linha"))
            : (tdata.text ?? "Texto");

            const t = el("text");
            t.setAttribute("class", `map-text${selected ? " selected" : ""}`);
            t.setAttribute("data-id", tdata.id);
            t.setAttribute("x", tdata.x);
            t.setAttribute("y", tdata.y);
            t.setAttribute("font-size", String(tdata.size || CFG.TEXT_DEFAULT_SIZE));
            t.setAttribute("font-weight", (tdata.bold ? "700" : "400"));
            t.setAttribute("font-style", (tdata.italic ? "italic" : "normal"));
            if (kind === "name") {
                const fill = line?.color || tdata.fallbackColor || "rgba(255,255,255,.92)";
                t.setAttribute("fill", fill);
            }
            t.textContent = content;
            t.addEventListener("pointerdown", (ev) => onTextDown(ev, tdata.id));
            dom.textsG.appendChild(t);
        }
    }

    function renderEdges() {
        if (!dom.edgesG) return;
        dom.edgesG.innerHTML = "";

        // =========================
        // Linha técnica de conexões: desenha "pontos" (nós) customizáveis
        // =========================
        const connectorDrawn = new Set(); // evita duplicar o mesmo ponto em vários edges

        function getConnectorStyle(line) {
            const s = (line && line.connectorStyle) ? line.connectorStyle : null;
            return {
                nodeFill: (s && typeof s.nodeFill === "string" && s.nodeFill.trim()) ? s.nodeFill.trim() : "#cfcfcf",
                nodeStroke: (s && typeof s.nodeStroke === "string" && s.nodeStroke.trim()) ? s.nodeStroke.trim() : "rgba(0,0,0,0.18)",
                nodeStrokeWidth: (s && Number.isFinite(+s.nodeStrokeWidth)) ? Math.max(0, +s.nodeStrokeWidth) : 2,
                nodeShape: (s && typeof s.nodeShape === "string") ? s.nodeShape : "circle",
                nodeSize: (s && Number.isFinite(+s.nodeSize)) ? Math.max(2, +s.nodeSize) : 8,
            };
        }

        function drawConnectorNode(nodeId, x, y, line) {
            const key = `${nodeId}|${line.id}`;
            if (connectorDrawn.has(key)) return;
            connectorDrawn.add(key);

            const st = getConnectorStyle(line);
            const r = st.nodeSize / 2;
            const shape = (st.nodeShape === "square" || st.nodeShape === "diamond" || st.nodeShape === "pill" || st.nodeShape === "circle")
            ? st.nodeShape : "circle";

            const nodeEl = makeStationShapeEl(shape, x, y, r, 1, 1);
            nodeEl.setAttribute("class", "conn-node");
            nodeEl.setAttribute("pointer-events", "none");
            nodeEl.setAttribute("fill", st.nodeFill);
            nodeEl.setAttribute("stroke", st.nodeStroke);
            nodeEl.style.fill = st.nodeFill;
            nodeEl.style.stroke = st.nodeStroke;
            nodeEl.style.strokeWidth = String(st.nodeStrokeWidth);

            dom.edgesG.appendChild(nodeEl);
        }


        // Agrupa edges por endpoints (A↔B independente da direção)
        const bundleMap = new Map();
        for (const e of state.edges) {
            const a = String(e.a), b = String(e.b);
            const key = (a < b) ? `${a}|${b}` : `${b}|${a}`;
            if (!bundleMap.has(key)) bundleMap.set(key, []);
            bundleMap.get(key).push(e);
        }

        // Offsets paralelos por (nó, linha) derivados dos trechos compartilhados.
        // Isso mantém continuidade nas junções (evita “quebrinha”) e evita alternar lado.
        const nodeLineOffset = new Map(); // key: `${nodeId}:${lineId}` -> {dx,dy}
        const setOffset = (nodeId, lineId, dx, dy) => {
            const k = `${nodeId}:${lineId}`;
            if (!nodeLineOffset.has(k)) nodeLineOffset.set(k, { dx, dy });
        };

        const gap = (typeof state.stackParallelGap === "number") ? state.stackParallelGap : 2;

        for (const [key, bundle] of bundleMap.entries()) {
            if (!bundle || bundle.length < 2) continue;

            // Ordena as linhas do bundle de forma estável (pela ordem em state.lines)
            const orderIndex = (edge) => {
                const idx = state.lines.findIndex(L => L.id === edge.lineId);
                return idx >= 0 ? idx : 9999;
            };
            const ordered = [...bundle].sort((x, y) => orderIndex(x) - orderIndex(y));
            const n = ordered.length;

            // Direção do segmento (pega qualquer edge do bundle)
            const e0 = ordered[0];
            const aN = findNode(e0.a);
            const bN = findNode(e0.b);
            if (!aN || !bN) continue;

            const vx = (bN.x - aN.x);
            const vy = (bN.y - aN.y);
            const len = Math.hypot(vx, vy) || 1;

            // perpendicular normalizada
            let nx = -vy / len;
            let ny =  vx / len;

            // Normaliza o sinal para não “pular de lado” entre segmentos:
            // preferimos apontar para cima (ny <= 0); se ny == 0, preferimos direita (nx >= 0).
            if (ny > 0 || (ny === 0 && nx < 0)) { nx = -nx; ny = -ny; }

            for (let i = 0; i < n; i++) {
                const ed = ordered[i];
                const offsetIndex = i - (n - 1) / 2;
                const off = offsetIndex * gap;

                const dx = nx * off;
                const dy = ny * off;

                // aplica o mesmo offset nos dois endpoints da aresta
                setOffset(ed.a, ed.lineId, dx, dy);
                setOffset(ed.b, ed.lineId, dx, dy);
            }
        }

        for (const e of state.edges) {
            const aN = findNode(e.a);
            const bN = findNode(e.b);
            if (!aN || !bN) continue;

            // Posição base (centro do nó)
            let aP = { x: aN.x, y: aN.y };
            let bP = { x: bN.x, y: bN.y };

            // Se esse nó/linha participa de um trecho compartilhado, usamos o offset paralelo (continuidade).
            // Caso contrário, usamos as portas padrão (se existirem) ou o centro.
            const offA = nodeLineOffset.get(`${e.a}:${e.lineId}`);
            if (offA) {
                aP = { x: aN.x + offA.dx, y: aN.y + offA.dy };
            } else {
                aP = getPortPos(e.a, e.lineId) || aP;
            }

            const offB = nodeLineOffset.get(`${e.b}:${e.lineId}`);
            if (offB) {
                bP = { x: bN.x + offB.dx, y: bN.y + offB.dy };
            } else {
                bP = getPortPos(e.b, e.lineId) || bP;
            }

            const d = edgePath(aP, bP, e);
            const line = findLine(e.lineId) || findLine(state.activeLineId);
            const stroke = line?.color || "#78aaff";
            const w = line?.width || 8;
            const dash = dashForStyle(line?.style);

            // v4.7.6: traço secundário (duas cores no mesmo traçado, estilo Recife-like)
            let secondaryStroke = null;
            let secondaryW = 0;
            if (line) {
                try { ensureLineBadgeProps(line); } catch(e) {}
                if (line.secondaryEnabled) {
                    if (line.secondaryMode === "line" && line.secondaryLineId) {
                        const other = findLine(line.secondaryLineId);
                        if (other && other.color) secondaryStroke = other.color;
                    }
                    if (!secondaryStroke) {
                        const sc = (typeof line.secondaryColor === "string") ? line.secondaryColor.trim() : "";
                        if (sc) secondaryStroke = sc;
                    }
                    const r = (typeof line.secondaryRatio === "number" && Number.isFinite(line.secondaryRatio)) ? line.secondaryRatio : 0.55;
                    secondaryW = Math.max(2, Math.round(w * r));
                    if (secondaryW >= w) secondaryW = Math.max(2, w - 2);
                }
            }

            const path = el("path");
            path.setAttribute("d", d);
            path.setAttribute("fill", "none");
            path.setAttribute("class", "edge");
            path.setAttribute("stroke", stroke);
            path.setAttribute("stroke-width", String(w));
            path.setAttribute("stroke-linecap", "round");
            path.setAttribute("stroke-linejoin", "round");
            if (dash) path.setAttribute("stroke-dasharray", dash);
            path.setAttribute("pointer-events", "none");

            // traço secundário por dentro
            let path2 = null;
            if (secondaryStroke) {
                path2 = el("path");
                path2.setAttribute("d", d);
                path2.setAttribute("fill", "none");
                path2.setAttribute("class", "edge edge-secondary");
                path2.setAttribute("stroke", secondaryStroke);
                path2.setAttribute("stroke-width", String(secondaryW));
                path2.setAttribute("stroke-linecap", "round");
                path2.setAttribute("stroke-linejoin", "round");
                if (dash) path2.setAttribute("stroke-dasharray", dash);
                path2.setAttribute("pointer-events", "none");
            }

            const hit = el("path");
            hit.setAttribute("d", d);
            hit.setAttribute("class", "edge-hit");
            hit.setAttribute("stroke-width", String(Math.max(CFG.EDGE_HIT, w + 10)));

            // ✅ IMPORTANTÍSSIMO: o hit NÃO pode depender de CSS no export
            hit.setAttribute("stroke", "#000");              // qualquer cor (vai ficar invisível por stroke-opacity)
            hit.setAttribute("stroke-opacity", "0");         // invisível, mas mantém pointer-events funcionando
            hit.setAttribute("fill", "none");
            hit.setAttribute("stroke-linecap", "round");
            hit.setAttribute("stroke-linejoin", "round");
            hit.setAttribute("stroke-miterlimit", "1");


            hit.addEventListener("pointerdown", (ev) => {
                // ╮ Curvas: arrastar o ponto da dobra do traçado
                if (state.tool === "curves") {
                    ev.preventDefault();
                    ev.stopPropagation();
                    selectEdge(e.id);
                    startEdgeBendDrag(ev, e.id);
                    return;
                }

                // Ctrl/Cmd + clique no traçado (modo Estação): insere uma estação no trecho clicado
                if (state.tool === "network" && (ev.ctrlKey || ev.metaKey)) {
                    ev.preventDefault();
                    ev.stopPropagation();
                    const w = screenToWorld(ev.clientX, ev.clientY);
                    if (insertStationOnEdgeAtPoint(e, w)) return;
                    // se não inseriu (muito perto do endpoint), cai pro comportamento normal
                }

                ev.stopPropagation();
                selectEdge(e.id);
            });

            dom.edgesG.appendChild(path);
            if (path2) dom.edgesG.appendChild(path2);
            dom.edgesG.appendChild(hit);

            // Se for a linha técnica, desenha os pontos nos endpoints
            if (line && isConnectorLine(line)) {
                drawConnectorNode(e.a, aP.x, aP.y, line);
                drawConnectorNode(e.b, bP.x, bP.y, line);
            }


            if (state.selectedEdgeId === e.id) {
                const overlay = el("path");
                overlay.setAttribute("d", d);
                overlay.setAttribute("class", "edge-selected-overlay");
                overlay.setAttribute("fill", "none");
                overlay.setAttribute("stroke-width", String(w + CFG.EDGE_SELECTED_PAD));
                dom.edgesG.appendChild(overlay);
            }
        }
    }

    function renderStationLabel(n, gxOverride) {
        const main = (n.name ?? "").toString().trim();

        const prefixLines = n.prefixEnabled ? splitLabelLines(n.prefix) : [];
        const suffixLines = n.suffixEnabled ? splitLabelLines(n.suffix) : [];

        if (!main && prefixLines.length === 0 && suffixLines.length === 0) return null;

        // 🔁 Orientação do label (gira o grupo), mas evita texto de cabeça pra baixo.
        // O posicionamento do texto agora é LOCAL ao nó (não em coordenadas globais),
        // então o label sempre “sai” do centro da estação e não fica flutuando sobre a linha.
        const ang = (typeof n.labelAngle === "number") ? n.labelAngle : (parseFloat(n.labelAngle) || 0);
        const ang360 = ((ang % 360) + 360) % 360;
        const flipText = ang360 > 90 && ang360 < 270;

        // Quando flipa, a direção “natural” do texto se inverte — então:
        // - ancoramos no fim (última letra) pra manter o label “saindo” no mesmo sentido
        // - e também trocamos visualmente Prefixo/Sufixo
        const anchor = flipText ? "end" : "start";
        const aboveLines = flipText ? suffixLines : prefixLines;
        const belowLines = flipText ? prefixLines : suffixLines;

        // ✅ Offset X do label baseado no tamanho real do nó (fica coladinho no círculo)
        const rN = stationRadiusForNode(n);
        const swN = stationStrokeWidthForNode(n);
        const pad = 6;
        const gx = (typeof gxOverride === "number") ? gxOverride : (rN + (swN / 2) + pad);

        // ✅ Empurra o label pra fora do “corredor” da linha conectada.
        // A gente estima a maior espessura de linha que encosta aqui e desloca o grupo nessa normal,
        // escolhendo o lado que combina com a direção do próprio label.
        let maxLineW = 0;
        let vx = 0, vy = 0;
        for (const e of state.edges) {
            if (e.a !== n.id && e.b !== n.id) continue;
            const ln = findLine(e.lineId);
            if (ln && typeof ln.width === "number") maxLineW = Math.max(maxLineW, ln.width);

            // vetor médio da(s) linha(s) no ponto (pra achar a normal)
            const otherId = (e.a === n.id) ? e.b : e.a;
            const other = state.nodesById?.get?.(otherId) || state.nodes.find(nn => nn.id === otherId);
            if (other) {
                const dx = other.x - n.x;
                const dy = other.y - n.y;
                const d = Math.hypot(dx, dy) || 1;
                vx += dx / d;
                vy += dy / d;
            }
        }
        if (!maxLineW) {
            const active = findLine(state.activeLineId);
            maxLineW = active?.width ?? 8;
        }

        // ângulo médio da direção da linha (se não tiver, assume horizontal)
        let lineAng = 0;
        if (Math.abs(vx) + Math.abs(vy) > 0.0001) lineAng = Math.atan2(vy, vx);

        // normal “pra fora” (padrão: pra cima quando horizontal)
        let nx = Math.sin(lineAng);
        let ny = -Math.cos(lineAng);

        // escolhe o lado da normal que mais combina com a direção do label
        const rad = (ang * Math.PI) / 180;
        const lx = Math.cos(rad);
        const ly = Math.sin(rad);
        if ((lx * nx + ly * ny) < 0) { nx = -nx; ny = -ny; }

        const shift = (maxLineW / 2) + pad;
        const ox = n.x + nx * shift;
        const oy = n.y + ny * shift;

        const ldx = (n.labelOffset && Number.isFinite(+n.labelOffset.dx)) ? +n.labelOffset.dx : 0;
        const ldy = (n.labelOffset && Number.isFinite(+n.labelOffset.dy)) ? +n.labelOffset.dy : 0;

        // Base do texto em coordenadas locais do grupo
        const yMain = -CFG.LABEL_Y_OFF;

        const g = el("g");

        // Linhas acima (Prefixo normal / Sufixo quando invertido)
        if (aboveLines.length) {
            for (let i = 0; i < aboveLines.length; i++) {
                const lineText = aboveLines[i];
                const y = yMain - CFG.LABEL_SUB_LINE_H * (aboveLines.length - i);

                const t = el("text");
                t.setAttribute("x", gx);
                t.setAttribute("y", String(y));
                t.setAttribute("class", "station-label station-label-sub");
                t.setAttribute("text-anchor", anchor);
                if (flipText) t.setAttribute("transform", `rotate(180 ${gx} ${y})`);
                t.textContent = lineText;

                g.appendChild(t);
            }
        }

        // Nome principal
        if (main) {
            const tMain = el("text");
            tMain.setAttribute("x", gx);
            tMain.setAttribute("y", String(yMain));
            tMain.setAttribute("class", "station-label station-label-main");
            tMain.setAttribute("text-anchor", anchor);
            if (flipText) tMain.setAttribute("transform", `rotate(180 ${gx} ${yMain})`);
            tMain.textContent = main;

            g.appendChild(tMain);
        }

        // Linhas abaixo (Sufixo normal / Prefixo quando invertido) — protegido contra a linha
        if (belowLines.length) {
            const start = yMain + CFG.LABEL_MAIN_LINE_H;
            for (let i = 0; i < belowLines.length; i++) {
                const lineText = belowLines[i];
                const y = start + CFG.LABEL_SUB_LINE_H * i;

                const t = el("text");
                t.setAttribute("x", gx);
                t.setAttribute("y", String(y));
                t.setAttribute("class", "station-label station-label-sub");
                t.setAttribute("text-anchor", anchor);
                if (flipText) t.setAttribute("transform", `rotate(180 ${gx} ${y})`);
                t.textContent = lineText;

                g.appendChild(t);
            }
        }

        const tx = ox + ldx;
        const ty = oy + ldy;

        if (ang) g.setAttribute("transform", `translate(${tx} ${ty}) rotate(${ang})`);
        else g.setAttribute("transform", `translate(${tx} ${ty})`);

        return g;
    }

function renderNodes() {
    if (!dom.nodesG) return;
    dom.nodesG.innerHTML = "";

    // 🔵 bolinhas nas pontas das linhas (identificação)
    renderLineEndpointBadges();

    for (const n of state.nodes) {
        const ports = interchangePortCache.byNode.get(n.id) || null;
        const isSelected = state.selectedNodeIds.has(n.id);

		const rN = stationRadiusForNode(n);
		const swN = stationStrokeWidthForNode(n);
		const shapeN = stationShapeForNode(n);

        // v4.0.7: estação integrada = múltiplos CÍRCULOS preenchidos (um por linha) “empilhados”
        // AO LONGO do eixo dominante (0/45/90/135...), usando as portas calculadas no cache.
		if ((state.interchangeMode === "stack") && ports && ports.length >= 2) {
            const g = el("g");
            g.setAttribute("class", "station-ports" + (isSelected ? " selected" : ""));
            g.dataset.id = n.id;

			for (const p of ports) {
                const pLine = findLine(p.lineId);
				const fallbackStroke = (pLine?.color) || "#78aaff";
				const fill = stationResolvedFillForNode(n, "#ffffff");
				const stroke = stationResolvedStrokeForNode(n, fallbackStroke);
                const cls = ["station", "station-port"];
                if (isSelected) cls.push("selected");

				const nodeEl = makeStationShapeEl(shapeN, p.x, p.y, rN, stationWidthMulForNode(n), stationHeightMulForNode(n));
				nodeEl.setAttribute("class", cls.join(" "));
				// ⚠️ Em SVG, regras CSS podem sobrescrever atributos de apresentação.
				// Por isso, aplicamos fill/stroke também via inline-style.
				nodeEl.setAttribute("fill", fill);
				nodeEl.setAttribute("stroke", stroke);
				nodeEl.style.fill = fill;
				nodeEl.style.stroke = stroke;
				nodeEl.style.strokeWidth = String(swN);
				nodeEl.dataset.id = n.id;
				nodeEl.addEventListener("pointerdown", (ev) => {
                    ev.stopPropagation();
                    onNodeDown(ev, n.id);
                });
				g.appendChild(nodeEl);
            }

            dom.nodesG.appendChild(g);
            const labelGroup = renderStationLabel(n);
            if (labelGroup) dom.nodesG.appendChild(labelGroup);
            continue;
        }

        // Estação normal (0 ou 1 linha)
        const cls = ["station"];
        if (isSelected) cls.push("selected");

        // v4.5.1: padrão metro-map — estação branca com contorno na cor da linha.
		let strokeAuto = (findLine(state.activeLineId)?.color) || "#78aaff";
        const linked = [...connectedLineIdsForNode(n.id)];
        if (linked.length === 1) {
			strokeAuto = (findLine(linked[0])?.color) || strokeAuto;
        }

		// aplica override de estilo (se houver)
		const resolvedFill = stationResolvedFillForNode(n, "#ffffff");
		const resolvedStroke = stationResolvedStrokeForNode(n, strokeAuto);

		const nodeEl = makeStationShapeEl(shapeN, n.x, n.y, rN, stationWidthMulForNode(n), stationHeightMulForNode(n));
		nodeEl.setAttribute("class", cls.join(" "));
		nodeEl.setAttribute("fill", resolvedFill);
		nodeEl.setAttribute("stroke", resolvedStroke);
		nodeEl.style.fill = resolvedFill;
		nodeEl.style.stroke = resolvedStroke;
		nodeEl.style.strokeWidth = String(swN);
		nodeEl.dataset.id = n.id;

		nodeEl.addEventListener("pointerdown", (ev) => {
            ev.stopPropagation();
            onNodeDown(ev, n.id);
        });

		dom.nodesG.appendChild(nodeEl);

        const labelGroup = renderStationLabel(n);
        if (labelGroup) dom.nodesG.appendChild(labelGroup);
    }
}


function renderSelectionRect() {
        if (!dom.selectRect) return;
        if (!isSelecting || !selectStartWorld || !selectCurrentWorld) {
            dom.selectRect.style.display = "none";
            return;
        }

        const x1 = Math.min(selectStartWorld.x, selectCurrentWorld.x);
        const y1 = Math.min(selectStartWorld.y, selectCurrentWorld.y);
        const x2 = Math.max(selectStartWorld.x, selectCurrentWorld.x);
        const y2 = Math.max(selectStartWorld.y, selectCurrentWorld.y);

        dom.selectRect.style.display = "block";
        dom.selectRect.setAttribute("x", x1);
        dom.selectRect.setAttribute("y", y1);
        dom.selectRect.setAttribute("width", x2 - x1);
        dom.selectRect.setAttribute("height", y2 - y1);
    }

    function renderAll() {
        // v4: recalcula portas de integração a cada render (depende de nodes/edges)
        rebuildInterchangePortCache();
        rebuildParallelPortCache();
        applyView();
        renderGrid();
        renderEdges();
        renderTexts();
        renderNodes();
        renderSelectionRect();
    }

    // =========================
    // Selection
    // =========================
    function clearSelection() {
        state.selectedNodeIds.clear();
        state.selectedEdgeId = null;
        state.selectedTextId = null;
    }

    function selectEdge(edgeId) {
        state.selectedTextId = null;
        state.selectedEdgeId = edgeId;

        // v4: clicar numa conexão também ativa a linha dela no painel
        const edge = edgeId ? findEdge(edgeId) : null;
        if (edge && edge.lineId && findLine(edge.lineId)) {
            state.selectedLineId = edge.lineId;
            state.activeLineId = edge.lineId;
        }

        refreshSidebar();
        renderAll();
    }

    function selectText(textId) {
        state.selectedTextId = textId;
        state.selectedEdgeId = null;
        state.selectedNodeIds.clear();
        refreshSidebar();
        renderAll();
    }

    function setSingleSelectionNode(nodeId) {
        state.selectedTextId = null;
        state.selectedEdgeId = null;
        state.selectedNodeIds.clear();
        state.selectedNodeIds.add(nodeId);
        // Se eu tô na ferramenta Conexões, NÃO muda activeLineId/selectedLineId ao clicar na estação.
        // A linha ativa deve continuar sendo a "linha-conector" escolhida pelo usuário no painel.
        if (state.tool === "connections") return;


        // v4.6.3: ao selecionar uma estação, ativar a linha relacionada
        // (mesmo comportamento de quando o usuário clica numa conexão).
        const connectedLineIds = new Set(
            state.edges
                .filter((e) => (e.a === nodeId || e.b === nodeId) && e.lineId && findLine(e.lineId))
                .map((e) => e.lineId)
        );

        if (connectedLineIds.size) {
            const preferred =
                (connectedLineIds.has(state.activeLineId) && state.activeLineId) ||
                (connectedLineIds.has(state.selectedLineId) && state.selectedLineId) ||
                Array.from(connectedLineIds)[0];
            state.selectedLineId = preferred;
            state.activeLineId = preferred;
        }
    }

    function toggleSelectionNode(nodeId) {
        state.selectedTextId = null;
        state.selectedEdgeId = null;
        if (state.selectedNodeIds.has(nodeId)) state.selectedNodeIds.delete(nodeId);
        else state.selectedNodeIds.add(nodeId);
    }

    function isTypingContext() {
        const ae = document.activeElement;
        if (!ae) return false;
        if (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA") return true;
        if (ae.isContentEditable) return true;
        return false;
    }


// Agrupa edições de campos (digitação/slider) em UMA única ação de Ctrl+Z.
// - A primeira mudança após focar o campo faz pushHistory()
// - As mudanças seguintes não empilham histórico
let _editKey = null;
let _editStarted = false;

function beginGroupedEdit(key) {
    _editKey = key || null;
    _editStarted = false;
}

function ensureGroupedHistory(key) {
    const k = key || null;
    if (!k) return false;
    if (_editKey !== k) {
        _editKey = k;
        _editStarted = false;
    }
    if (!_editStarted) {
        pushHistory();
        _editStarted = true;
    }
    return true;
}

function endGroupedEdit(key) {
    const k = key || null;
    if (!k || _editKey === k) {
        _editKey = null;
        _editStarted = false;
    }
}

    // =========================
    // CRUD operations
    // =========================
    function addNode(x, y) {
		// v4.5.2: novas estações herdam o "Estilo padrão" da linha ativa,
		// quando existir (definido ao aplicar estilo em lote na linha).
		const activeLine = findLine(state.activeLineId);
		const lineDefault = activeLine?.stationStyleDefault;
		const baseStyle = (lineDefault && typeof lineDefault === "object")
			? {
				shape: (lineDefault.shape || "circle"),
				size: (typeof lineDefault.size === "number" ? lineDefault.size : (CFG.STATION_R * 2)),
				fill: (typeof lineDefault.fill === "string" && lineDefault.fill.trim()) ? lineDefault.fill.trim() : "#ffffff",
				stroke: (typeof lineDefault.stroke === "string") ? lineDefault.stroke : "",
				strokeWidth: (typeof lineDefault.strokeWidth === "number" ? lineDefault.strokeWidth : 3),
			}
			: {
				shape: "circle",
				size: CFG.STATION_R * 2,
				fill: "#ffffff",
				stroke: "",
				strokeWidth: 3,
			};

            const lineId = state.activeLineId || null;

            // pega o contador da linha (ou assume 1)
            let idx = 1;
            if (lineId) {
                const m = state.stationAutoNameIndexByLine || (state.stationAutoNameIndexByLine = {});
                idx = (typeof m[lineId] === "number" ? m[lineId] : 1);
                m[lineId] = idx + 1; // já deixa pronto pro próximo
            }


        const n = {
            id: uid(),
 x: snap(x),
 y: snap(y),

 name: `Estação ${state.stationAutoNameIndex}`,


 prefix: "",
 suffix: "",

 // ✅ por padrão, oculto/desligado
 prefixEnabled: false,
 suffixEnabled: false,

 // orientação do rótulo (graus). 0 = padrão
 labelAngle: 0,

 labelOffset: { dx: 0, dy: 0 },


	 // estilo visual da estação (v4.4.5)
	 stationStyle: baseStyle,

 type: "normal",
        };
        state.nodes.push(n);
        state.stationAutoNameIndex = (state.stationAutoNameIndex || 1) + 1;
        return n;

    }

    function addEdge(aId, bId, lineId) {
        if (aId === bId) return null;

        const lid = lineId || state.activeLineId;

        // Permite múltiplas linhas entre o mesmo par de estações.
        // Só bloqueia se já existir uma conexão igual *na mesma linha*.
        const exists = state.edges.some((e) =>
            ((e.a === aId && e.b === bId) || (e.a === bId && e.b === aId)) && e.lineId === lid
        );
        if (exists) return null;

        const e = { id: uid(), a: aId, b: bId, lineId: lid };
        state.edges.push(e);
        return e;
    }



    function nodeAt(x, y) {
        const sx = snap(x);
        const sy = snap(y);
        return state.nodes.find((n) => n.x === sx && n.y === sy) || null;
    }

    // Encontra uma edge “próxima” de um ponto (para inserir estação no traçado)
    function findNearestEdgeForInsert(pWorld) {
        let best = null;

        for (const e of state.edges) {
            const aN = findNode(e.a);
            const bN = findNode(e.b);
            if (!aN || !bN) continue;

            const aP = getPortPos(e.a, e.lineId) || { x: aN.x, y: aN.y };
            const bP = getPortPos(e.b, e.lineId) || { x: bN.x, y: bN.y };

            const pts = edgePolylinePoints(aP, bP);

            const line = findLine(e.lineId);
            const w = line?.width || 8;
            const hitW = Math.max(CFG.EDGE_HIT, w + 10);
            const maxDist = hitW / 2 + 2;

            let minD = Infinity;
            let bestSeg = null;
            let bestProj = null;

            for (let i = 0; i < pts.length - 1; i++) {
                const a = pts[i];
                const b = pts[i + 1];
                const proj = projectPointToSegment(pWorld, a, b);
                const d = Math.hypot(pWorld.x - proj.x, pWorld.y - proj.y);
                if (d < minD) {
                    minD = d;
                    bestSeg = { a, b };
                    bestProj = proj;
                }
            }

            if (minD <= maxDist) {
                if (!best || minD < best.dist) {
                    best = { edge: e, dist: minD, seg: bestSeg, proj: bestProj, aP, bP };
                }
            }
        }

        return best;
    }

    function insertStationOnEdgeAtPoint(edge, pWorld) {
        const aN = findNode(edge.a);
        const bN = findNode(edge.b);
        if (!aN || !bN) return false;

        const aP = getPortPos(edge.a, edge.lineId) || { x: aN.x, y: aN.y };
        const bP = getPortPos(edge.b, edge.lineId) || { x: bN.x, y: bN.y };

        const pts = edgePolylinePoints(aP, bP);
        if (!pts || pts.length < 2) return false;

        let best = null;
        for (let i = 0; i < pts.length - 1; i++) {
            const a = pts[i];
            const b = pts[i + 1];
            const proj = projectPointToSegment(pWorld, a, b);
            const dx = proj.x - pWorld.x;
            const dy = proj.y - pWorld.y;
            const d2 = dx * dx + dy * dy;
            if (!best || d2 < best.d2) best = { a, b, proj, d2 };
        }
        if (!best) return false;

        const snapped = snapPointOntoSegmentGrid(best.proj, best.a, best.b);

        // Evita “inserir” uma estação em cima de um endpoint (ou onde não existe ponto de grade útil).
        // Usamos o snap final (igual ao addNode) pra decidir.
        const finalX = snap(snapped.x);
        const finalY = snap(snapped.y);
        const ax = snap(aN.x), ay = snap(aN.y);
        const bx = snap(bN.x), by = snap(bN.y);
        if ((finalX === ax && finalY === ay) || (finalX === bx && finalY === by)) return false;

        pushHistory();

        // ativa a linha do trecho clicado
        if (edge.lineId && findLine(edge.lineId)) {
            state.activeLineId = edge.lineId;
            state.selectedLineId = edge.lineId;
            updateStationToolBadge();
        }

        const n = addNode(finalX, finalY);

        // divide a conexão original em duas
        deleteEdge(edge.id);
        addEdge(edge.a, n.id, edge.lineId);
        addEdge(n.id, edge.b, edge.lineId);

        clearSelection();
        state.selectedNodeIds.add(n.id);
        state.selectedEdgeId = null;
        state.selectedTextId = null;
        pendingStationFocusId = n.id;

        renderAll();
        refreshSidebar();
        return true;
    }


    function neighborsOnLine(nodeId, lineId) {
        const lid = lineId || state.activeLineId;
        if (!lid) return [];
        const out = [];
        for (const e of state.edges) {
            if (e.lineId !== lid) continue;
            if (e.a === nodeId) out.push(e.b);
            else if (e.b === nodeId) out.push(e.a);
        }
        return out;
    }

    function addStationAfter(nodeId, lineId) {
        ensureAtLeastOneLine();
        ensureAllTexts();
        normalizeSignagePreset();
        const from = findNode(nodeId);
        if (!from) return null;
        const lid = lineId || state.activeLineId;
        if (!lid) return null;

        const neigh = neighborsOnLine(nodeId, lid).map(findNode).filter(Boolean);

        let vx = 1, vy = 0;

        if (neigh.length === 1) {
            vx = from.x - neigh[0].x;
            vy = from.y - neigh[0].y;
        } else if (neigh.length >= 2) {
            // empurra "pra fora" na média do vetor (from - vizinhos)
            let sx = 0, sy = 0;
            for (const n of neigh) {
                sx += (from.x - n.x);
                sy += (from.y - n.y);
            }
            vx = sx / neigh.length;
            vy = sy / neigh.length;
        }

        const STEP = 4 * CFG.GRID;

        const pickStep = (dx, dy) => {
            // escolhe o eixo dominante, mantém no grid
            if (Math.abs(dx) >= Math.abs(dy)) return { dx: Math.sign(dx || 1) * STEP, dy: 0 };
            return { dx: 0, dy: Math.sign(dy || 1) * STEP };
        };

        const primary = pickStep(vx, vy);

        const candidates = [
            primary,
            { dx: STEP, dy: 0 },
            { dx: 0, dy: STEP },
            { dx: -STEP, dy: 0 },
            { dx: 0, dy: -STEP },
            { dx: STEP, dy: STEP },
            { dx: -STEP, dy: STEP },
            { dx: STEP, dy: -STEP },
            { dx: -STEP, dy: -STEP },
        ];

        let target = null;
        for (const c of candidates) {
            const tx = from.x + c.dx;
            const ty = from.y + c.dy;
            if (!nodeAt(tx, ty)) {
                target = { x: tx, y: ty };
                break;
            }
        }
        if (!target) target = { x: from.x + STEP, y: from.y };

        const newNode = addNode(target.x, target.y);
        addEdge(from.id, newNode.id, lid);

        return newNode;
    }

function deleteEdge(edgeId) {
        state.edges = state.edges.filter((e) => e.id !== edgeId);
        if (state.selectedEdgeId === edgeId) state.selectedEdgeId = null;
    }

    function deleteNodes(nodeIds) {
        const ids = new Set(nodeIds);
        state.nodes = state.nodes.filter((n) => !ids.has(n.id));
        state.edges = state.edges.filter((e) => !ids.has(e.a) && !ids.has(e.b));
        for (const id of ids) state.selectedNodeIds.delete(id);
        if (state.selectedNodeIds.size === 0) state.selectedEdgeId = null;
    }

    function addText(x, y, opts = null) {
        const p = worldToGrid({ x, y });
        const id = uid();

        // Sinalização (badge / nome de linha)
        if (opts && (opts.kind === "badge" || opts.kind === "name" || opts.kind === "badgeName")) {
            const line = findLine(opts.lineId);
            const t = {
                id,
                x: p.x,
                y: p.y,
                kind: opts.kind,
                lineId: opts.lineId,
                size: Number.isFinite(opts.size) ? opts.size : state.signageNextSize,
                bold: (opts.kind === "badge") ? true : !!(opts.bold ?? state.signageNextBold),
                italic: (opts.kind === "badge") ? false : !!(opts.italic ?? state.signageNextItalic),
                fallbackName: line?.name || "",
                fallbackLabel: line ? resolveLineBadgeLabel(line) : "",
                fallbackColor: line?.color || "",
            };
            ensureTextProps(t);
            state.texts.push(t);
            return t;
        }

        // Texto livre (legado)
        const t = { id, x: p.x, y: p.y, kind: "text", text: "Texto", size: CFG.TEXT_DEFAULT_SIZE, bold: true, italic: false };
        ensureTextProps(t);
        state.texts.push(t);
        return t;
    }

    function deleteText(textId) {
        state.texts = state.texts.filter((t) => t.id !== textId);
        if (state.selectedTextId === textId) state.selectedTextId = null;
    }


function nearestNode(worldPt, radius = CFG.CONNECT_SNAP_RADIUS) {
    let best = null;
    let bestD = Infinity;

    const mode = (state.interchangeMode || "unified");

    for (const n of state.nodes) {
        // v4.8.0: no modo "unified" a estação integrada continua sendo um círculo no centro
        // (sem pílula/stack), então o hit-test volta a ser radial.
        if (mode === "stack") {
            const k = connectedLineIdsForNode(n.id).size;
            if (k >= 2) {
                const { w, h } = pillSizeForLineCount(k);
                const d = pointToRectDistance(worldPt.x, worldPt.y, n.x, n.y, w, h);
                if (d < bestD) { bestD = d; best = n; }
                continue;
            }
        }

        const d = Math.hypot(n.x - worldPt.x, n.y - worldPt.y);
        if (d < bestD) { bestD = d; best = n; }
    }

    if (best && bestD <= radius) return best;
    return null;
}

    // =========================
    // Tools
    // =========================
    function setTool(tool) {
        state.tool = tool;

        stopPan();
        stopNodeDrag();
        stopTextDrag();
        stopLinkDragHard();
        stopNewLineDragHard();
        try { if (typeof stopEdgeBendDrag === "function") stopEdgeBendDrag(); } catch {}
        stopSelectHard();

        updateToolbarUI();
        refreshSidebar();
        updateCursor();

        // auto-abrir a ajuda ao trocar de ferramenta
        try {
            if (dom.helpPanel && dom.helpPanel.style.display === "none") showHelpPanel(true);
        } catch {}

        // ajuda rápida dinâmica (painel)
        try {
            if (typeof renderQuickHelpForTool === "function") renderQuickHelpForTool(tool);
        } catch {}
    }


    function updateToolbarUI() {
        const setActive = (btn, on) => {
            if (!btn) return;
            btn.classList.toggle("active", !!on);
            btn.setAttribute("aria-pressed", on ? "true" : "false");
        };

        setActive(dom.toolPointer, state.tool === "neutral");
        setActive(dom.toolPan, state.tool === "pan");
        setActive(dom.toolStation, state.tool === "network");
        setActive(dom.toolLine, state.tool === "line");
        setActive(dom.toolConnections, state.tool === "connections");
        setActive(dom.toolCurves, state.tool === "curves");
        setActive(dom.toolText, state.tool === "text");
        setActive(dom.toolSelect, state.tool === "select");
    }

