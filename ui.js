/* Mobinode - split bundle (part 2/4)
 * v4.4.5
 * Conteúdo: UI (sidebar/panels, modais, accordion, lógica do painel de linhas)
 */

"use strict";

// =========================
// Toast (Android-style)
// =========================
// Ctrl+F: function showToast(

let __toastTimer = null;

function ensureToastHost() {
    // Ctrl+F: toastHost
    let host = document.getElementById("toastHost");
    if (!host) {
        host = document.createElement("div");
        host.id = "toastHost";
        document.body.appendChild(host);
    }
    return host;
}

function showToast(message, opts = {}) {
    const duration = Number.isFinite(opts.duration) ? opts.duration : 2200;

    const host = ensureToastHost();
    host.innerHTML = "";

    const el = document.createElement("div");
    el.className = "toast";
    el.textContent = String(message || "");
    host.appendChild(el);

    // animate in
    requestAnimationFrame(() => el.classList.add("show"));

    if (__toastTimer) clearTimeout(__toastTimer);
    __toastTimer = setTimeout(() => {
        el.classList.remove("show");
        setTimeout(() => {
            if (el && el.parentNode) el.parentNode.removeChild(el);
        }, 260);
    }, duration);
}

// =========================
    // Sidebar / Panels
    // =========================
    // Ctrl+F: isMobileLayout
    function isMobileLayout() {
        try {
            return !!(window.matchMedia && window.matchMedia("(max-width: 820px)").matches);
        } catch {
            return false;
        }
    }

    function showHelpPanel(on) {
        if (!dom.helpPanel) return;
        dom.helpPanel.style.display = on ? "block" : "none";

        // v4.9.3: o botão de ajuda NÃO deve sumir ao abrir o painel.
        // No mobile, o painel só aparece quando o usuário clica no botão.
        if (dom.btnHelp) {
            dom.btnHelp.classList.toggle("active", !!on);
            dom.btnHelp.setAttribute("aria-pressed", on ? "true" : "false");
        }
    }

    function toggleHelpPanel() {
        if (!dom.helpPanel) return;
        const isOpen = dom.helpPanel.style.display !== "none";
        showHelpPanel(!isOpen);
    }

    // Ctrl+F: QUICK_HELP_BY_TOOL
    const QUICK_HELP_BY_TOOL = {
        neutral: {
            title: "Modo neutro (🖱️)",
            bullets: [
                "Clique: seleciona estação/linha/texto",
                "Delete: apaga a seleção",
                "Scroll: zoom • botão do meio: pan",
            ],
        },

        pan: {
            title: "Pan (🖐️)",
            bullets: [
                "Clique + arrastar: mover o mapa",
                "Scroll: zoom",
            ],
        },

        network: {
            title: "Estação (⚪)",
            bullets: [
                "Duplo clique: cria uma estação",
                "ALT + clique + arrastar: cria nova estação ligada à anterior",
                "Ctrl + clique em múltiplas estações: seleção múltipla",
            ],
        },

        line: {
            title: "Linhas (🛤️)",
            bullets: [
                "Arraste de uma estação pra outra: cria conexão",
                "ALT: encadear conexões (quando aplicável)",
                "Clique na linha: seleciona a linha",
            ],
        },

        connections: {
            title: "Conexões (🔗)",
            bullets: [
                "Segure Shift e arraste de uma estação a outra para conectá-las (traçado branco, pontos cinza).",
                "Você pode personalizar como a linha de conexão se apresenta no painel de propriedades.",
            ],
        },


        curves: {
            title: "Curvas (╮)",
            bullets: [
                "Clique na conexão/aresta: selecionar dobra",
                "Arraste o manipulador (se existir): ajusta a curva",
                "Ctrl+Z / Ctrl+Y: desfazer / refazer",
            ],
        },

        text: {
            title: "Sinalização / Texto (📐)",
            bullets: [
                "Clique: cria um texto",
                "No painel: altere conteúdo, tamanho e estilo",
                "Delete: remove o texto selecionado",
            ],
        },

        select: {
            title: "Seleção (▭)",
            bullets: [
                "Clique + arrastar: seleção retangular",
                "Arraste a seleção: move o grupo",
                "Ctrl: seleção múltipla por clique",
                "Delete: apaga o que estiver selecionado",
            ],
        },
    };

    function renderQuickHelpForTool(tool) {
        if (!dom.helpPanel || !dom.helpContent) return;

        const data = QUICK_HELP_BY_TOOL[tool] || QUICK_HELP_BY_TOOL.neutral;

        // Atualiza título (no seu HTML é class="helpTitle")
        const titleEl = dom.helpPanel.querySelector(".helpTitle");
        if (titleEl) titleEl.textContent = data.title || "Ajuda";

        // Render em bullet list
        const lis = (data.bullets || []).map((t) => `<li>${escapeHtml(String(t))}</li>`).join("");
        dom.helpContent.innerHTML = `<ul>${lis}</ul>`;
    }

    function escapeHtml(s) {
        return s
        .replaceAll("&", "&amp;")
        .replaceAll("<", "&lt;")
        .replaceAll(">", "&gt;")
        .replaceAll('"', "&quot;")
        .replaceAll("'", "&#039;");
    }


    // =========================
    // Modais: Configurações / Sobre (v4.4.1)
    // =========================
    function isSettingsOpen() {
        return !!(dom.settingsModal && dom.settingsModal.style.display !== "none");
    }

    function isAboutOpen() {
        return !!(dom.aboutModal && dom.aboutModal.style.display !== "none");
    }

    function showSettingsModal(on) {
        if (!dom.settingsModal) return;
        const open = !!on;
        dom.fileDropdown && dom.fileDropdown.classList.remove("open");
        dom.settingsModal.style.display = open ? "flex" : "none";
        if (open) {
            syncThemeRadios();
            try { syncDockPositionRadios(); } catch {}
        }
    }

    let aboutTabsBound = false;

    function bindAboutTabsOnce() {
        if (aboutTabsBound) return;
        if (!dom.aboutModal) return;

        const navItems = [...dom.aboutModal.querySelectorAll(".about-nav-item[data-about-tab]")];
        const panes = [...dom.aboutModal.querySelectorAll(".about-pane[data-about-pane]")];

        const activate = (key) => {
            navItems.forEach(b => b.classList.toggle("active", b.dataset.aboutTab === key));
            panes.forEach(p => p.classList.toggle("active", p.dataset.aboutPane === key));
        };

        navItems.forEach(btn => {
            btn.addEventListener("click", () => activate(btn.dataset.aboutTab));
        });

        // garante um default consistente
        activate(navItems[0]?.dataset.aboutTab || "app");
        aboutTabsBound = true;
    }


    function showAboutModal(on) {
        if (!dom.aboutModal) return;
        const open = !!on;
        dom.fileDropdown && dom.fileDropdown.classList.remove("open");
        dom.aboutModal.style.display = open ? "flex" : "none";

        if (open) bindAboutTabsOnce();
    }


    let sidebarOpen = true;

    function showSidebar(on) {
        sidebarOpen = !!on;
        if (dom.sidebar) dom.sidebar.style.display = sidebarOpen ? "block" : "none";
        if (dom.btnShowSidebar) dom.btnShowSidebar.style.display = sidebarOpen ? "none" : "block";
    }

    function refreshLinePanel() {
        if (!dom.linePanel) return;

        dom.linePanel.style.display = "block";

        const active = findLine(state.activeLineId);
        if (dom.sidebarTitle) dom.sidebarTitle.textContent = "Propriedades";
        if (dom.sidebarMeta) dom.sidebarMeta.textContent = active ? `Linha ativa: ${active.name}` : "";

        renderLineList();
        bindLineFieldsFromSelectedOrActive();
        renderLineStations();
        renderStationQuickPick();
        renderEdgeActionsInLinePanel();
    }

    function openSidebarMulti() {
        if (!dom.multiPanel) return;
        dom.multiPanel.style.display = "block";

        const count = state.selectedNodeIds.size;
        if (dom.sidebarTitle) dom.sidebarTitle.textContent = "Propriedades";
        if (dom.sidebarMeta) dom.sidebarMeta.textContent = `${count} estações selecionadas`;

        if (dom.multiInfo) dom.multiInfo.textContent = `Selecionadas: ${count}`;

        // v4.6.2: estilo em massa para estações selecionadas (aplica na hora)
        try {
            const nodes = [...state.selectedNodeIds].map(findNode).filter(Boolean);
            if (nodes.length) {
                const normFill = (n) => (n.stationStyle?.fill && String(n.stationStyle.fill).trim()) ? String(n.stationStyle.fill).trim() : "#ffffff";
                const normStroke = (n) => (n.stationStyle?.stroke && String(n.stationStyle.stroke).trim()) ? String(n.stationStyle.stroke).trim() : "";
                const normSW = (n) => (typeof n.stationStyle?.strokeWidth === "number" && Number.isFinite(n.stationStyle.strokeWidth)) ? n.stationStyle.strokeWidth : 3;
                const normSize = (n) => (typeof n.stationStyle?.size === "number" && Number.isFinite(n.stationStyle.size)) ? n.stationStyle.size : (CFG.STATION_R * 2);
                const normShape = (n) => (n.stationStyle?.shape || "circle");
                const normW = (n) => (typeof n.stationStyle?.wMul === "number" && Number.isFinite(n.stationStyle.wMul)) ? n.stationStyle.wMul : 1;
                const normH = (n) => (typeof n.stationStyle?.hMul === "number" && Number.isFinite(n.stationStyle.hMul)) ? n.stationStyle.hMul : 1;

                const setSame = (getter) => {
                    const s = new Set(nodes.map(getter));
                    if (s.size === 1) return [...s][0];
                    return null;
                };

                const shapeSame = setSame(normShape);
                const sizeSame = setSame(normSize);
                const fillSame = setSame(normFill);
                const strokeSame = setSame(normStroke);
                const swSame = setSame(normSW);

                // v4.8.1: ajuste fino do nome (seleção)
                const normDX = (n) => (n.labelOffset && Number.isFinite(+n.labelOffset.dx)) ? +n.labelOffset.dx : 0;
                const normDY = (n) => (n.labelOffset && Number.isFinite(+n.labelOffset.dy)) ? +n.labelOffset.dy : 0;

                const dxSame = setSame(normDX);
                const dySame = setSame(normDY);


                sidebarIsUpdating = true;
                if (dom.multiStationStyleShape) dom.multiStationStyleShape.value = shapeSame ? String(shapeSame) : "";

                const sizeVal = (sizeSame != null) ? sizeSame : normSize(nodes[0]);

                const fillVal = (fillSame != null) ? fillSame : normFill(nodes[0]);
                const strokeVal = (strokeSame != null) ? strokeSame : normStroke(nodes[0]);
                const swVal = (swSame != null) ? swSame : normSW(nodes[0]);

                if (dom.multiStationStyleSize) dom.multiStationStyleSize.value = String(sizeVal);
                if (dom.multiStationStyleSizeRange) dom.multiStationStyleSizeRange.value = String(sizeVal);
                if (dom.multiStationStyleFill) dom.multiStationStyleFill.value = fillVal || "#ffffff";
                if (dom.multiStationStyleStroke) {
                    // Se a borda estiver em modo padrão (stroke vazio), mostramos a cor da linha (preview)
                    let strokePreview = strokeVal;
                    if (!strokePreview) {
                        // tenta usar a linha conectada (quando for único), senão cai na linha ativa
                        let auto = findLine(state.activeLineId)?.color || "#78aaff";
                        try {
                            const linked = [...connectedLineIdsForNode(nodes[0].id)];
                            if (linked.length === 1) auto = findLine(linked[0])?.color || auto;
                        } catch(e) {}
                        strokePreview = auto;
                    }
                    dom.multiStationStyleStroke.value = strokePreview;
                }
                if (dom.multiStationStyleStrokeWidth) dom.multiStationStyleStrokeWidth.value = String(swVal);
                if (dom.multiStationStyleStrokeWidthRange) dom.multiStationStyleStrokeWidthRange.value = String(swVal);

                const wSame = setSame(normW);
                const hSame = setSame(normH);
                const wVal = (wSame != null) ? wSame : normW(nodes[0]);
                const hVal = (hSame != null) ? hSame : normH(nodes[0]);
                if (dom.multiStationStyleWidth) dom.multiStationStyleWidth.value = String(wVal);
                if (dom.multiStationStyleWidthRange) dom.multiStationStyleWidthRange.value = String(wVal);
                if (dom.multiStationStyleHeight) dom.multiStationStyleHeight.value = String(hVal);
                if (dom.multiStationStyleHeightRange) dom.multiStationStyleHeightRange.value = String(hVal);
                if (dom.multiStationStyleDims) {
                    const sh = shapeSame ? String(shapeSame) : (dom.multiStationStyleShape?.value || "");
                    dom.multiStationStyleDims.style.display = (sh === "square" || sh === "pill") ? "block" : "none";
                }

                if (dom.multiStationStyleNote) {
                    const mixed = [];
                    if (shapeSame == null) mixed.push("forma");
                    if (sizeSame == null) mixed.push("tamanho");
                    if (fillSame == null) mixed.push("preenchimento");
                    if (strokeSame == null) mixed.push("borda");
                    if (swSame == null) mixed.push("tamanho da borda");
                    dom.multiStationStyleNote.textContent = mixed.length
                        ? `Valores mistos detectados (${mixed.join(", ")}). Qualquer ajuste aqui padroniza esse campo em todas as selecionadas.`
                        : `Tudo já está igual nas selecionadas — qualquer ajuste vai aplicar em massa na hora.`;
                }

                // v4.8.1: preencher UI do ajuste fino (seleção)
                // se misto => "—" e range vai pra 0 só como neutro
                if (dom.multiStationLabelOffsetX) dom.multiStationLabelOffsetX.value = (dxSame != null) ? String(dxSame) : "—";
                if (dom.multiStationLabelOffsetY) dom.multiStationLabelOffsetY.value = (dySame != null) ? String(dySame) : "—";
                if (dom.multiStationLabelOffsetXRange) dom.multiStationLabelOffsetXRange.value = String((dxSame != null) ? dxSame : 0);
                if (dom.multiStationLabelOffsetYRange) dom.multiStationLabelOffsetYRange.value = String((dySame != null) ? dySame : 0);


                sidebarIsUpdating = false;
            }
        } catch(e) {}
    }

    function openSidebarStation(nodeId) {
        const n = findNode(nodeId);
        if (!n || !dom.stationPanel) return;

		// v4.4.5: garante estrutura de estilo para JSONs antigos
		if (!n.stationStyle) {
			n.stationStyle = { shape: "circle", size: CFG.STATION_R * 2, wMul: 1, hMul: 1, fill: "#ffffff", stroke: "", strokeWidth: 3 };
		}

        dom.stationPanel.style.display = "block";

        if (dom.sidebarTitle) dom.sidebarTitle.textContent = "Propriedades";
        if (dom.sidebarMeta) dom.sidebarMeta.textContent = `ID: ${n.id}`;
        if (dom.stationPos) dom.stationPos.textContent = `x: ${n.x} • y: ${n.y}`;

        sidebarIsUpdating = true;

        // ✅ checkboxes controlam visibilidade dos inputs
        if (dom.useStationPrefix) dom.useStationPrefix.checked = !!n.prefixEnabled;
        if (dom.useStationSuffix) dom.useStationSuffix.checked = !!n.suffixEnabled;

        setFieldVisible(dom.stationPrefixField, !!n.prefixEnabled);
        setFieldVisible(dom.stationSuffixField, !!n.suffixEnabled);

        if (dom.stationPrefix) dom.stationPrefix.value = n.prefix || "";
        if (dom.stationName) dom.stationName.value = n.name || "";
        if (dom.stationSuffix) dom.stationSuffix.value = n.suffix || "";
		if (dom.stationOrientation) dom.stationOrientation.value = String((typeof n.labelAngle === "number") ? n.labelAngle : (parseFloat(n.labelAngle) || 0));

        // garante estrutura pra JSON antigo
        if (!n.labelOffset || typeof n.labelOffset !== "object") n.labelOffset = { dx: 0, dy: 0 };
        const dx = Number.isFinite(+n.labelOffset.dx) ? +n.labelOffset.dx : 0;
        const dy = Number.isFinite(+n.labelOffset.dy) ? +n.labelOffset.dy : 0;

        if (dom.stationLabelOffsetX) dom.stationLabelOffsetX.value = String(dx);
        if (dom.stationLabelOffsetXRange) dom.stationLabelOffsetXRange.value = String(dx);

        if (dom.stationLabelOffsetY) dom.stationLabelOffsetY.value = String(dy);
        if (dom.stationLabelOffsetYRange) dom.stationLabelOffsetYRange.value = String(dy);


		// v4.6.1: botão de aplicar orientação em massa na linha ativa
		try {
			if (dom.applyStationOrientationActiveLine) {
				const line = findLine(state.activeLineId);
				let tag = "Linha ativa";
                if (line) {
                    const badge = (line.badgeText || "").trim();
                    if (badge) {
                        tag = badge; // sempre prioriza a identificação
                    } else {
                        // fallback: número da linha (posição dela na lista)
                        const idx = state.lines.findIndex(l => l.id === line.id);
                        tag = (idx >= 0) ? String(idx + 1) : "Linha";
                    }
                }
				dom.applyStationOrientationActiveLine.textContent = `Aplicar orientação em toda a linha ${tag}`;
				dom.applyStationOrientationActiveLine.disabled = !line;
			}
		} catch(e) {}

		// v4.5.1: Estilo das estações (padrão fill branco + stroke auto = cor da linha)
		const linked = [...connectedLineIdsForNode(n.id)];
		let strokeAuto = (findLine(state.activeLineId)?.color) || "#78aaff";
		if (linked.length === 1) strokeAuto = (findLine(linked[0])?.color) || strokeAuto;

		if (dom.stationStyleShape) dom.stationStyleShape.value = (n.stationStyle.shape || "circle");
		const size = (typeof n.stationStyle.size === "number" && Number.isFinite(n.stationStyle.size)) ? n.stationStyle.size : (CFG.STATION_R * 2);
		if (dom.stationStyleSize) dom.stationStyleSize.value = String(size);
		if (dom.stationStyleSizeRange) dom.stationStyleSizeRange.value = String(size);
		if (dom.stationStyleFill) {
			const f = (n.stationStyle.fill && n.stationStyle.fill.trim()) ? n.stationStyle.fill.trim() : "#ffffff";
			dom.stationStyleFill.value = f;
		}
		if (dom.stationStyleStroke) {
			const s = (n.stationStyle.stroke && n.stationStyle.stroke.trim()) ? n.stationStyle.stroke.trim() : strokeAuto;
			dom.stationStyleStroke.value = s;
		}
		const sw = (typeof n.stationStyle.strokeWidth === "number" && Number.isFinite(n.stationStyle.strokeWidth)) ? n.stationStyle.strokeWidth : 3;
		if (dom.stationStyleStrokeWidth) dom.stationStyleStrokeWidth.value = String(sw);
		if (dom.stationStyleStrokeWidthRange) dom.stationStyleStrokeWidthRange.value = String(sw);
		// v4.7.0: proporção (Quadrado/Pílula)
		const wMul = (typeof n.stationStyle.wMul === "number" && Number.isFinite(n.stationStyle.wMul)) ? n.stationStyle.wMul : 1;
		const hMul = (typeof n.stationStyle.hMul === "number" && Number.isFinite(n.stationStyle.hMul)) ? n.stationStyle.hMul : 1;
		if (dom.stationStyleWidth) dom.stationStyleWidth.value = String(wMul);
		if (dom.stationStyleWidthRange) dom.stationStyleWidthRange.value = String(wMul);
		if (dom.stationStyleHeight) dom.stationStyleHeight.value = String(hMul);
		if (dom.stationStyleHeightRange) dom.stationStyleHeightRange.value = String(hMul);
		if (dom.stationStyleDims) {
			const sh = (n.stationStyle.shape || "circle");
			dom.stationStyleDims.style.display = (sh === "square" || sh === "pill") ? "block" : "none";
		}

        sidebarIsUpdating = false;

        if (!sidebarOpen) return;

        if (!state.isAltChaining && pendingStationFocusId === n.id && dom.stationName) {
            const ae = document.activeElement;
            const userIsTyping = ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA" || ae.isContentEditable);
            if (!userIsTyping) {
                dom.stationName.focus();
                dom.stationName.select();
            }
            pendingStationFocusId = null;
        }
    }

    function openSidebarText(textId) {
        const t = findText(textId);
        if (!t || !dom.textPanel) return;

        dom.textPanel.style.display = "block";
        ensureTextProps(t);

        const kind = t.kind || "text";
        const line = (kind === "badge" || kind === "name" || kind === "badgeName") ? findLine(t.lineId) : null;

        if (dom.sidebarTitle) dom.sidebarTitle.textContent = "Propriedades";

        let meta = "Sinalização";
        if (kind === "badge") meta = `Sinalização • Identificação • ${line ? line.name : (t.fallbackName || "Linha")}`;
        else if (kind === "badgeName") meta = `Sinalização • Badge + nome • ${line ? line.name : (t.fallbackName || "Linha")}`;
        else if (kind === "name") meta = `Sinalização • Nome da linha • ${line ? line.name : (t.fallbackName || "Linha")}`;
        else meta = `Texto`;

        if (dom.sidebarMeta) dom.sidebarMeta.textContent = meta + ` • ID: ${t.id}`;
        if (dom.signageSelected) dom.signageSelected.textContent = meta;

        sidebarIsUpdating = true;
        if (dom.signageNameWithBadge) dom.signageNameWithBadge.checked = !!state.signageNameWithBadge;
        if (dom.textContent) {
            if (kind === "text") {
                dom.textContent.disabled = false;
                dom.textContent.value = String(t.text ?? "");
            } else {
                dom.textContent.disabled = true;
                const name = line ? (line.name || "(sem nome)") : (t.fallbackName || "Linha");
                const label = line ? resolveLineBadgeLabel(line) : (t.fallbackLabel || "L");
                dom.textContent.value = (kind === "badge") ? label : (kind === "badgeName") ? `${label} ${name}` : name;
            }
        }
		if (dom.textSize) {
			const def = (kind === "text") ? CFG.TEXT_DEFAULT_SIZE : CFG.SIGNAGE_DEFAULT_SIZE;
			dom.textSize.value = String(t.size ?? def);
		}
		if (dom.textSizeRange) {
			const def = (kind === "text") ? CFG.TEXT_DEFAULT_SIZE : CFG.SIGNAGE_DEFAULT_SIZE;
			dom.textSizeRange.value = String(t.size ?? def);
		}

// Cor do texto / contorno
if (dom.textColor) {
    const hasCustom = !!(t.color && String(t.color).trim());
    // cor efetiva mostrada no picker: custom > cor da linha (nome) > padrão do tema
    let eff = "#ffffff";
    if (hasCustom) eff = String(t.color).trim();
    else if ((kind === "name" || kind === "badgeName") && (line?.color || t.fallbackColor)) eff = (line?.color || t.fallbackColor || "#ffffff");
    // tenta manter picker sempre com um hex válido
    dom.textColor.value = /^#([0-9a-fA-F]{6})$/.test(eff) ? eff : "#ffffff";
}
if (dom.textColorHex) {
    const hasCustom = !!(t.color && String(t.color).trim());
    dom.textColorHex.value = hasCustom ? String(t.color).trim() : "";
    dom.textColorHex.placeholder = "auto";
}
if (dom.textOutline) {
    dom.textOutline.checked = (typeof t.outline === "boolean") ? t.outline : true;
}
        if (dom.btnTextBold) {
            dom.btnTextBold.disabled = (kind === "badge");
            dom.btnTextBold.setAttribute("aria-pressed", t.bold ? "true" : "false");
        }
        if (dom.btnTextItalic) {
            dom.btnTextItalic.disabled = (kind === "badge");
            dom.btnTextItalic.setAttribute("aria-pressed", t.italic ? "true" : "false");
        }
        sidebarIsUpdating = false;
    }

    // =========================
    // Shapes sidebar (Formas e placas)
    // =========================
    // Ctrl+F: openSidebarShapes
    function openSidebarShapes(textId) {
        const t = findText(textId);
        if (!t || !dom.shapesPanel) return;

        ensureTextProps(t);
        dom.shapesPanel.style.display = "block";

        const kind = (t.kind === "shapeArc") ? "arc" : ((t.kind === "shapeCircle") ? "circle" : ((t.kind === "shapePoly") ? "polygon" : "rect"));
        const metaKind = (kind === "arc") ? "Arco" : ((kind === "circle") ? "Círculo" : ((kind === "polygon") ? "Polígono" : "Retângulo"));

        if (dom.sidebarTitle) dom.sidebarTitle.textContent = "Propriedades";
        if (dom.sidebarMeta) dom.sidebarMeta.textContent = `Formas e placas • ${metaKind} • ID: ${t.id}`;

        sidebarIsUpdating = true;
        try {
            if (dom.shapeKind) dom.shapeKind.value = kind;

            if (dom.shapeFillMode) dom.shapeFillMode.value = (t.fillMode === "custom") ? "custom" : "line";
            if (dom.shapeFillColor) dom.shapeFillColor.value = (t.fill && String(t.fill).trim()) ? String(t.fill) : "#a020f0";

            if (dom.shapeOpacity) dom.shapeOpacity.value = String(Number.isFinite(+t.opacity) ? +t.opacity : 1);
            if (dom.shapeOpacityVal) dom.shapeOpacityVal.value = Number(dom.shapeOpacity.value).toFixed(2);

            // Rotação
            if (dom.shapeRotation) dom.shapeRotation.value = String(Number.isFinite(+t.rotation) ? +t.rotation : 0);
            if (dom.shapeRotationVal) dom.shapeRotationVal.value = String(dom.shapeRotation.value);


            // Dimensões
            if (dom.shapeW) dom.shapeW.value = String(Number.isFinite(+t.w) ? +t.w : 640);
            if (dom.shapeH) dom.shapeH.value = String(Number.isFinite(+t.h) ? +t.h : 140);
            if (dom.shapeRX) dom.shapeRX.value = String(Number.isFinite(+t.rx) ? +t.rx : 18);
            if (dom.shapeSides) dom.shapeSides.value = String(Number.isFinite(+t.sides) ? +t.sides : 6);

            if (dom.shapeWVal) dom.shapeWVal.value = String(dom.shapeW.value);
            if (dom.shapeHVal) dom.shapeHVal.value = String(dom.shapeH.value);
            if (dom.shapeRXVal) dom.shapeRXVal.value = String(dom.shapeRX.value);
            if (dom.shapeSidesVal && dom.shapeSides) dom.shapeSidesVal.value = String(dom.shapeSides.value);

            // Se for círculo, a UI trabalha com DIÂMETRO (r*2)
            if (kind === "circle") {
                const d = Math.max(10, (Number.isFinite(+t.r) ? (+t.r * 2) : 80));
                if (dom.shapeW) dom.shapeW.value = String(d);
                if (dom.shapeWVal) dom.shapeWVal.value = String(d);

                // opcional: manter H igual só pra consistência interna
                if (dom.shapeH) dom.shapeH.value = String(d);
                if (dom.shapeHVal) dom.shapeHVal.value = String(d);
            }


            
            // Controles de arco
            if (dom.arcControls) dom.arcControls.style.display = (kind === "arc") ? "block" : "none";

            // UI dinâmica por tipo
            if (dom.rowShapeW) dom.rowShapeW.style.display = (kind === "arc") ? "none" : "block";
            if (dom.rowShapeH) dom.rowShapeH.style.display = (kind === "rect" || kind === "polygon") ? "block" : "none";
            if (dom.rowShapeRX) dom.rowShapeRX.style.display = (kind === "rect") ? "block" : "none";
            if (dom.rowShapeSides) dom.rowShapeSides.style.display = (kind === "polygon") ? "block" : "none";
            if (dom.shapeWLabel) dom.shapeWLabel.textContent = (kind === "circle") ? "Diâmetro" : "Largura";
            if (kind === "arc") {
                if (dom.shapeArcR) dom.shapeArcR.value = String(Number.isFinite(+t.rOuter) ? +t.rOuter : 80);
                if (dom.shapeArcT) dom.shapeArcT.value = String(Number.isFinite(+t.thickness) ? +t.thickness : 30);
                if (dom.shapeArcA0) dom.shapeArcA0.value = String(Number.isFinite(+t.a0) ? +t.a0 : -45);
                if (dom.shapeArcA1) dom.shapeArcA1.value = String(Number.isFinite(+t.a1) ? +t.a1 : 225);

                if (dom.shapeArcRVal) dom.shapeArcRVal.value = String(dom.shapeArcR.value);
                if (dom.shapeArcTVal) dom.shapeArcTVal.value = String(dom.shapeArcT.value);
                if (dom.shapeArcA0Val) dom.shapeArcA0Val.value = String(dom.shapeArcA0.value);
                if (dom.shapeArcA1Val) dom.shapeArcA1Val.value = String(dom.shapeArcA1.value);
            }
// Cantos só faz sentido no retângulo
            if (dom.shapeRX) {
                dom.shapeRX.disabled = (kind === "circle" || kind === "arc" || kind === "polygon");
                dom.shapeRX.style.opacity = (kind === "circle" || kind === "arc" || kind === "polygon") ? "0.5" : "1";
            }

            // Botões
            if (dom.btnShapeDuplicate) dom.btnShapeDuplicate.disabled = false;
            if (dom.btnShapeApply) dom.btnShapeApply.disabled = false;
            if (dom.btnShapeDelete) dom.btnShapeDelete.disabled = false;

            // Sincroniza UI do fillMode (habilita/desabilita color picker)
            try {
                if (dom.shapeFillMode && dom.shapeFillColor) {
                    const custom = (dom.shapeFillMode.value === "custom");
                    dom.shapeFillColor.disabled = !custom;
                    dom.shapeFillColor.style.opacity = custom ? "1" : "0.5";
                }
            } catch {}
        } finally {
            sidebarIsUpdating = false;
        }
    }

    // =========================
    // Accordion behavior (apenas 1 aberto)
    // =========================
    let accordionDetails = null;
    let lastSelectionSig = null;

    function initAccordionExclusive() {
        const acc = document.querySelector(".accordion");
        if (!acc) return;
        accordionDetails = Array.from(acc.querySelectorAll("details"));
        accordionDetails.forEach((d) => {
            d.addEventListener("toggle", () => {
                if (!d.open) return;
                accordionDetails.forEach((other) => {
                    if (other !== d) other.open = false;
                });
            });
        });
    }

    function openAccordion(detailsEl) {
        if (!detailsEl) return;
        if (!accordionDetails) initAccordionExclusive();
        if (!accordionDetails) return;
        accordionDetails.forEach((d) => {
            if (d !== detailsEl) d.open = false;
        });
            detailsEl.open = true;
    }



function setMetaPanelActive(which){
    // which: "line" | "station" | "connections" | "text" | "multi"
    if (state.propsMode !== "metapanel") return;
    const map = {
        line: dom.accLine,
        connections: dom.accConnections,
        station: dom.accStation,
        text: dom.accText,
        multi: dom.accMulti,
        shapes: dom.accShapes,
        rotation: dom.accRotation,
    };
    const active = map[which] || dom.accLine;
    // rotaciona texto/sinalização e shapes (que vivem em texts)
    // e também pode ser aberto manualmente pelo botão ⟳ na dock.
    // Ctrl+F: shouldShowRotation
    const shouldShowRotation = !!state.selectedTextId || state.tool === "rotate";

    [dom.accLine, dom.accConnections, dom.accStation, dom.accText, dom.accMulti, dom.accShapes, dom.accRotation].forEach((d) => {
        if (!d) return;
        d.open = true;
        // Em modo metapainel, a Rotação fica como um painel extra quando fizer sentido
        // ou quando o usuário clicar no botão ⟳.
        if (d === dom.accRotation) {
            d.style.display = shouldShowRotation ? "block" : "none";
            return;
        }
        d.style.display = (d === active) ? "block" : "none";
    });
}

function refreshSidebar() {
        refreshLinePanel();
        renderSignagePickers();
        bindConnectorPanel();

        const selCount = state.selectedNodeIds.size;
        const hasEdge = !!state.selectedEdgeId;
        const hasText = !!state.selectedTextId;
        const selTextObj = hasText ? findText(state.selectedTextId) : null;

        const hasShape = !!(selTextObj && (
            selTextObj.kind === "shapeRect" ||
            selTextObj.kind === "shapeCircle" ||
            selTextObj.kind === "shapeArc" ||
            selTextObj.kind === "shapePoly"
        ));

        const lock = state.isAltChaining;


// Metapainel: escolhe qual bloco aparece
if (state.propsMode === "metapanel") {
    let which = "line";
    if (lock) {
        // mantém o que já estava (sem trocar) — mas garante que algo está visível
        which = "line";
    } else if (state.tool === "rotate") which = "rotation";
    else if (state.tool === "connections") which = "connections";
    else if (state.tool === "shapes" || hasShape) which = "shapes";
    else if (hasText || state.tool === "text") which = "text";
    else if (hasEdge) which = "line";
    else if (selCount === 1) which = "station";
    else if (selCount > 1) which = "multi";
    else {
        if (state.tool === "connections") which = "connections";
        else if (state.tool === "network") which = "station";
        else if (state.tool === "select") which = "multi";
        else if (state.tool === "text") which = "text";
        else which = "line";
    }
    setMetaPanelActive(which);
}

    // =========================
    // Connections panel logic
    // =========================
    // Ctrl+F: bindConnectorPanel
    function bindConnectorPanel() {
        // Só faz sentido se os campos existirem (HTML pode variar entre versões)
        if (!dom.connLineColor && !dom.connLineWidth) return;

        const connId = (typeof ensureConnectorLine === "function") ? ensureConnectorLine() : null;
        const conn = connId ? findLine(connId) : null;
        if (!conn) return;

        sidebarIsUpdating = true;
        try {
            const c = conn.color || "#ffffff";
            if (dom.connLineColor) dom.connLineColor.value = c;
            if (dom.connLineColorHex) dom.connLineColorHex.value = c;

            const w = Number.isFinite(conn.width) ? conn.width : 10;
            if (dom.connLineWidthRange) dom.connLineWidthRange.value = String(w);
            if (dom.connLineWidth) dom.connLineWidth.value = String(w);

            const st = conn.connectorStyle || {};
            const nodeShape = (st.nodeShape || "circle");
            const nodeSize = Number.isFinite(+st.nodeSize) ? +st.nodeSize : 8;
            const nodeFill = (typeof st.nodeFill === "string" && st.nodeFill.trim()) ? st.nodeFill.trim() : "#cfcfcf";
            const nodeStroke = (typeof st.nodeStroke === "string" && st.nodeStroke.trim()) ? st.nodeStroke.trim() : "rgba(0,0,0,0.18)";
            const nodeStrokeW = Number.isFinite(+st.nodeStrokeWidth) ? +st.nodeStrokeWidth : 2;

            if (dom.connNodeShape) dom.connNodeShape.value = nodeShape;
            if (dom.connNodeSizeRange) dom.connNodeSizeRange.value = String(nodeSize);
            if (dom.connNodeSize) dom.connNodeSize.value = String(nodeSize);

            if (dom.connNodeFill) dom.connNodeFill.value = nodeFill.startsWith('#') ? nodeFill : '#cfcfcf';
            if (dom.connNodeFillHex) dom.connNodeFillHex.value = nodeFill;

            if (dom.connNodeStroke) dom.connNodeStroke.value = nodeStroke.startsWith('#') ? nodeStroke : '#000000';
            if (dom.connNodeStrokeHex) dom.connNodeStrokeHex.value = nodeStroke;

            if (dom.connNodeStrokeWidthRange) dom.connNodeStrokeWidthRange.value = String(nodeStrokeW);
            if (dom.connNodeStrokeWidth) dom.connNodeStrokeWidth.value = String(nodeStrokeW);


        } finally {
            sidebarIsUpdating = false;
        }
    }

        if (dom.stationPanel) dom.stationPanel.style.display = "block";
        if (dom.multiPanel) dom.multiPanel.style.display = "block";
        if (dom.textPanel) dom.textPanel.style.display = "block";

        setSectionState(dom.accStation, dom.stationEmpty, dom.stationPanel, selCount === 1 && !lock && !hasEdge && !hasText);
        setSectionState(dom.accMulti, dom.multiEmpty, dom.multiPanel, selCount > 1 && !lock && !hasEdge && !hasText);
        // ✅ Sinalização deve ficar usável quando a ferramenta 📐 estiver ativa
        setSectionState(dom.accText, dom.textEmpty, dom.textPanel, !lock && (state.tool === "text" || (hasText && !hasShape)));

        // =========================
        // Rotação (universal)
        // Ctrl+F: Rotação (universal)
        // =========================
        const canRotate = !lock && !!selTextObj; // texto/sinalização ou shape (que mora em texts)
        setSectionState(dom.accRotation, dom.rotationEmpty, dom.rotationPanel, canRotate);
        if (canRotate && dom.rotationPanel) {
            sidebarIsUpdating = true;
            try {
                // popula "Item selecionado" (por enquanto é um item só — já preparado pra multi no futuro)
                if (dom.rotationSelected) {
                    const id = String(selTextObj.id || "");
                    const kind = String(selTextObj.kind || "text");
                    const labelMap = {
                        shapeRect: "Retângulo",
                        shapeCircle: "Círculo",
                        shapeArc: "Arco",
                        shapePoly: "Polígono",
                        badge: "Identificação",
                        name: "Nome de linha",
                        badgeName: "Identificação + nome",
                        text: "Texto",
                    };
                    const label = (labelMap[kind] || "Elemento") + ` (ID ${id.slice(0, 4)}…)`;

                    dom.rotationSelected.innerHTML = "";
                    const opt = document.createElement("option");
                    opt.value = id;
                    opt.textContent = label;
                    dom.rotationSelected.appendChild(opt);
                    dom.rotationSelected.value = id;
                }

                const rot = Number.isFinite(+selTextObj.rotation) ? clamp(parseInt(selTextObj.rotation, 10) || 0, 0, 360) : 0;
                if (dom.rotationRange) dom.rotationRange.value = String(rot);
                if (dom.rotationValue) dom.rotationValue.value = String(rot);
            } finally {
                sidebarIsUpdating = false;
            }
        }
        if (state.propsMode !== "metapanel") {

        if (!lock) {
            const sig = `${[...state.selectedNodeIds].sort().join(",")}|e:${state.selectedEdgeId || ""}|t:${state.selectedTextId || ""}|tool:${state.tool}`;
            if (sig !== lastSelectionSig) {
                if (hasShape) openAccordion(dom.accShapes);
                else if (hasText) openAccordion(dom.accText);
                else if (hasEdge) openAccordion(dom.accLine);
                else if (selCount === 1) openAccordion(dom.accStation);
                else if (selCount > 1) openAccordion(dom.accMulti);
                else {
                    if (state.tool === "connections") openAccordion(dom.accConnections);
                    else if (state.tool === "text") openAccordion(dom.accText);
                    else if (state.tool === "select") openAccordion(dom.accMulti);
                    else if (state.tool === "network") openAccordion(dom.accStation);
                    else openAccordion(dom.accLine);
                }
                lastSelectionSig = sig;
            }
        }
        }

        // Shapes panel visibility
        if (dom.shapesEmpty && dom.shapesPanel) {
            const onShapes = (state.tool === "shapes") || hasShape;
            dom.shapesEmpty.style.display = onShapes ? "none" : "";
            dom.shapesPanel.style.display = onShapes ? "" : "none";

            // Sem shape selecionada: botões de ação ficam desabilitados
            if (!hasShape) {
                if (dom.btnShapeDuplicate) dom.btnShapeDuplicate.disabled = true;
                if (dom.btnShapeApply) dom.btnShapeApply.disabled = true;
                if (dom.btnShapeDelete) dom.btnShapeDelete.disabled = true;
            }
        }


        if (selCount === 1 && !lock && !hasEdge && !hasText) openSidebarStation([...state.selectedNodeIds][0]);
        if (selCount > 1 && !lock && !hasEdge && !hasText) openSidebarMulti();
		if (hasShape && !lock) openSidebarShapes(state.selectedTextId);
        if (hasText && !hasShape && !lock) openSidebarText(state.selectedTextId);
        if (!hasText && !lock && state.tool === "text") {
            // estado “idle” do painel de sinalização
            normalizeSignagePreset();
            const p = state.signagePreset;
            const line = p ? findLine(p.lineId) : null;
            if (dom.sidebarTitle) dom.sidebarTitle.textContent = "Propriedades";
            if (dom.sidebarMeta) dom.sidebarMeta.textContent = "Sinalização";
            if (dom.signageSelected) {
                if (!p) dom.signageSelected.textContent = "Pronto pra posicionar: Texto livre";
                else dom.signageSelected.textContent = (p.kind === "badge")
                    ? `Pronto pra posicionar: Identificação • ${line ? line.name : "Linha"}`
                    : (p.kind === "badgeName")
                        ? `Pronto pra posicionar: Badge + nome • ${line ? line.name : "Linha"}`
                        : `Pronto pra posicionar: Nome da linha • ${line ? line.name : "Linha"}`;
            }
            sidebarIsUpdating = true;
            if (dom.signageNameWithBadge) dom.signageNameWithBadge.checked = !!state.signageNameWithBadge;
            if (dom.textContent) {
                dom.textContent.disabled = false;
                const ae = document.activeElement;
                const typing = ae === dom.textContent;
                if (!typing) dom.textContent.value = String(state.textDraft ?? "");
            }
			if (dom.textSize) {
				const next = p ? (state.signageNextSize ?? CFG.SIGNAGE_DEFAULT_SIZE) : (state.textNextSize ?? CFG.TEXT_DEFAULT_SIZE);
				dom.textSize.value = String(next);
			}
			if (dom.textSizeRange) {
				const next = p ? (state.signageNextSize ?? CFG.SIGNAGE_DEFAULT_SIZE) : (state.textNextSize ?? CFG.TEXT_DEFAULT_SIZE);
				dom.textSizeRange.value = String(next);
			}

// Cor do próximo elemento / contorno
if (dom.textColor) {
    const nextColor = p ? (state.signageNextColor || "") : (state.textNextColor || "");
    dom.textColor.value = (/^#([0-9a-fA-F]{6})$/.test(nextColor) ? nextColor : "#ffffff");
}
if (dom.textColorHex) {
    const nextColor = p ? (state.signageNextColor || "") : (state.textNextColor || "");
    dom.textColorHex.value = nextColor || "";
    dom.textColorHex.placeholder = "auto";
}
if (dom.textOutline) {
    const nextOut = p ? state.signageNextOutline : state.textNextOutline;
    dom.textOutline.checked = (typeof nextOut === "boolean") ? nextOut : true;
}
            if (dom.btnTextBold) {
                dom.btnTextBold.disabled = (p?.kind === "badge");
                dom.btnTextBold.setAttribute("aria-pressed", state.signageNextBold ? "true" : "false");
            }
            if (dom.btnTextItalic) {
                dom.btnTextItalic.disabled = (p?.kind === "badge");
                dom.btnTextItalic.setAttribute("aria-pressed", state.signageNextItalic ? "true" : "false");
            }
            sidebarIsUpdating = false;
        }
        if (hasEdge && !lock) renderEdgeActionsInLinePanel();

        // v4.5.1: botões de "Aplicar estilo" (aparecem/ativam conforme contexto)
        try {
            if (dom.applyStationStyleSelection) {
                dom.applyStationStyleSelection.style.display = (selCount > 1 && !lock) ? "block" : "none";
            }
            if (dom.applyStationStyleActiveLine) {
                const hasActive = !!state.activeLineId && !!findLine(state.activeLineId);
                dom.applyStationStyleActiveLine.disabled = !hasActive;
            }
            // v4.6.1: botões adicionais
            if (dom.applyStationOrientationActiveLine) {
                const hasActive = !!state.activeLineId && !!findLine(state.activeLineId);
                dom.applyStationOrientationActiveLine.disabled = !hasActive;
            }
            if (dom.applyLineWidthAll) {
                const realCount = (state.lines || []).filter(x => !(x && (x.role === "connector" || x.name === "__connector__"))).length;
                dom.applyLineWidthAll.disabled = realCount < 2;
            }
            if (dom.applyMultiStationStyleSelection) {
                dom.applyMultiStationStyleSelection.disabled = !(selCount > 1 && !lock);
            }
        } catch(e) {}
    }

function refreshSidebarPreserveInput() {
    // Preserva caret/seleção do input ativo durante atualizações frequentes (digitação).
    const ae = document.activeElement;
    let activeId = null;
    let selStart = null;
    let selEnd = null;
    if (ae && (ae.tagName === "INPUT" || ae.tagName === "TEXTAREA")) {
        activeId = ae.id || null;
        try {
            selStart = ae.selectionStart;
            selEnd = ae.selectionEnd;
        } catch {}
    }
    refreshSidebar();
    if (activeId) {
        const elBack = document.getElementById(activeId);
        if (elBack) {
            try {
                elBack.focus();
                if (selStart != null && selEnd != null && elBack.setSelectionRange) {
                    elBack.setSelectionRange(selStart, selEnd);
                }
            } catch {}
        }
    }
}


    // =========================
    // Line panel logic
    // =========================
    function renderLineList() {
        if (!dom.lineList) return;
        dom.lineList.innerHTML = "";

        // Ctrl+F: renderLineList (não listar a linha técnica de conexões)
        for (const l of (state.lines || []).filter(x => !(x && (x.role === "connector" || x.name === "__connector__")))) {
            const item = document.createElement("div");
            item.className = "line-item" + (l.id === state.selectedLineId ? " selected" : "");

            const swatch = document.createElement("span");
            swatch.className = "line-swatch";
            swatch.style.background = l.color || "#78aaff";
            if (l.id === state.activeLineId) swatch.classList.add("active");

            const label = document.createElement("span");
            label.className = "line-label";
            label.textContent = l.name;

            item.appendChild(swatch);
            item.appendChild(label);

            item.addEventListener("click", () => {
                state.selectedLineId = l.id;
                state.activeLineId = l.id;
                updateStationToolBadge();
                renderAll();
                refreshSidebar();
            });

            dom.lineList.appendChild(item);
        }

        // mantém o botão Estação sempre refletindo a linha ativa
        updateStationToolBadge();
    }

    function bindLineFieldsFromSelectedOrActive() {
        const line = findLine(state.selectedLineId) || findLine(state.activeLineId);
        // Se por algum motivo a linha técnica de conexões estiver selecionada, não permita editar no painel de Linhas.
        if (line && (line.role === "connector" || line.name === "__connector__")) return;
        if (!line) return;

        sidebarIsUpdating = true;

        if (dom.lineName) dom.lineName.value = line.name || "";

        // identificação (badge)
        ensureLineBadgeProps(line);
        const enabled = !!line.badgeEnabled;
        if (dom.lineBadgeEnabled) dom.lineBadgeEnabled.checked = enabled;
        if (dom.lineBadgeText) dom.lineBadgeText.value = line.badgeText || "";
        const pos = (line.badgePosition === "end") ? "end" : "start";
        if (dom.lineBadgePosStart) dom.lineBadgePosStart.checked = pos === "start";
        if (dom.lineBadgePosEnd) dom.lineBadgePosEnd.checked = pos === "end";

        if (dom.lineBadgeText) dom.lineBadgeText.disabled = !enabled;
        if (dom.lineBadgePosStart) dom.lineBadgePosStart.disabled = !enabled;
        if (dom.lineBadgePosEnd) dom.lineBadgePosEnd.disabled = !enabled;

        if (dom.lineColor) dom.lineColor.value = line.color || "#78aaff";
        if (dom.lineColorHex) dom.lineColorHex.value = line.color || "#78aaff";

        // v4.7.6: traço secundário (Recife-like)
        try {
            ensureLineBadgeProps(line);
            if (dom.lineSecondaryEnabled) dom.lineSecondaryEnabled.checked = !!line.secondaryEnabled;
            if (dom.lineSecondaryMode) dom.lineSecondaryMode.value = (line.secondaryMode === "line") ? "line" : "custom";
            if (dom.lineSecondaryColor) dom.lineSecondaryColor.value = line.secondaryColor || "#f97316";
            if (dom.lineSecondaryColorHex) dom.lineSecondaryColorHex.value = line.secondaryColor || "#f97316";

            // popula select de linhas
            if (dom.lineSecondaryLineId) {
                const cur = String(line.secondaryLineId || "");
                dom.lineSecondaryLineId.innerHTML = "";
                const opt0 = document.createElement("option");
                opt0.value = "";
                opt0.textContent = "Selecionar linha...";
                dom.lineSecondaryLineId.appendChild(opt0);
                for (const l2 of (state.lines || []).filter(x => !(x && (x.role === "connector" || x.name === "__connector__")))) {
                    if (!l2 || l2.id === line.id) continue;
                    const o = document.createElement("option");
                    o.value = l2.id;
                    const label = (resolveLineBadgeLabel(l2) || "").trim();
                    const nm = (l2.name || "Linha").trim();
                    o.textContent = label ? `${label} • ${nm}` : nm;
                    dom.lineSecondaryLineId.appendChild(o);
                }
                dom.lineSecondaryLineId.value = cur;
            }

            const enabled2 = !!line.secondaryEnabled;
            if (dom.lineSecondaryControls) dom.lineSecondaryControls.style.display = enabled2 ? "block" : "none";
            const mode = (line.secondaryMode === "line") ? "line" : "custom";
            if (dom.lineSecondaryCustom) dom.lineSecondaryCustom.style.display = (enabled2 && mode === "custom") ? "flex" : "none";
            if (dom.lineSecondaryFromLine) dom.lineSecondaryFromLine.style.display = (enabled2 && mode === "line") ? "block" : "none";
        } catch(e) {}
        if (dom.lineWidth) dom.lineWidth.value = String(line.width ?? 8);
        if (dom.lineWidthRange) dom.lineWidthRange.value = String(line.width ?? 8);
        if (dom.lineStyle) dom.lineStyle.value = line.style || "solid";

        // curvas (global)
        if (dom.curveRoundnessRange) dom.curveRoundnessRange.value = String(state.curveRoundness ?? 0);
        if (dom.curveRoundness) dom.curveRoundness.value = String(state.curveRoundness ?? 0);

        sidebarIsUpdating = false;
        // mantém UI de orientação padrão em sincronia
        try { setLineDefaultOrientationUI(); } catch(e) {}
    }


    function getStationIdsForLine(lineId) {
        const ids = new Set();
        for (const e of state.edges) {
            if (e.lineId !== lineId) continue;
            ids.add(e.a);
            ids.add(e.b);
        }
        return ids;
    }

    function renderLineStations() {
        if (!dom.lineStations) return;

        const lineId = state.selectedLineId || state.activeLineId;
        const ids = getStationIdsForLine(lineId);

        const names = [...ids].map((id) => {
            const n = findNode(id);
            return n ? (n.name?.trim() ? n.name.trim() : id) : id;
        });

        dom.lineStations.textContent = names.length ? names.join(" • ") : "Nenhuma estação conectada nessa linha.";
    }


   // Dropdown "Ir para estação (linha ativa)"
    // Ctrl+F: renderStationQuickPick
    function renderStationQuickPick() {
        if (!dom.stationQuickPick) return;

        const sel = dom.stationQuickPick;
        const lineId = state.activeLineId || state.selectedLineId || null;

        sel.innerHTML = "";

        const opt0 = document.createElement("option");
        opt0.value = "";
        opt0.textContent = lineId ? "Selecionar estação..." : "Nenhuma linha ativa";
        sel.appendChild(opt0);

        if (!lineId) return;

        const ids = [...getStationIdsForLine(lineId)];
        ids.sort((a, b) => {
            const an = (findNode(a)?.name || "").toString().trim();
            const bn = (findNode(b)?.name || "").toString().trim();
            if (an && bn) return an.localeCompare(bn, undefined, { sensitivity: "base" });
            if (an) return -1;
            if (bn) return 1;
            return String(a).localeCompare(String(b));
        });

        for (const id of ids) {
            const n = findNode(id);
            const o = document.createElement("option");
            o.value = id;
            o.textContent = n ? (n.name?.trim() ? n.name.trim() : id) : id;
            sel.appendChild(o);
        }

        const currentId = (state.selectedNodeIds && state.selectedNodeIds.size === 1) ? [...state.selectedNodeIds][0] : "";
        if (currentId && ids.includes(currentId)) sel.value = currentId;
        else sel.value = "";

        sel.onchange = () => {
            if (sidebarIsUpdating) return;
            const id = sel.value;
            if (!id) return;
            const n = findNode(id);
            if (!n) return;

            clearSelection();
            state.selectedNodeIds.add(id);
            state.selectedEdgeId = null;
            state.selectedTextId = null;

            pendingStationFocusId = id;

            renderAll();
            refreshSidebar();
        };
    }


    function renderEdgeActionsInLinePanel() {
        if (!dom.edgeActions) return;

        const edge = state.selectedEdgeId ? findEdge(state.selectedEdgeId) : null;
        if (!edge) {
            dom.edgeActions.style.display = "none";
            return;
        }

        dom.edgeActions.style.display = "block";
        const a = findNode(edge.a);
        const b = findNode(edge.b);

        if (dom.edgeInfo) {
            const an = a?.name?.trim() ? a.name.trim() : edge.a;
            const bn = b?.name?.trim() ? b.name.trim() : edge.b;
            dom.edgeInfo.textContent = `Conexão: ${an} ↔ ${bn}`;

            // Dropdown: tipo de conexão (unificado vs empilhado)
            if (dom.edgeInterchangeMode) {
                // define o valor atual
                dom.edgeInterchangeMode.value = (state.interchangeMode || "unified");

                // aplica ao mudar
                dom.edgeInterchangeMode.onchange = () => {
                    const v = (dom.edgeInterchangeMode.value === "stack") ? "stack" : "unified";
                    if ((state.interchangeMode || "unified") === v) return;

                    // opcional: permitir Ctrl+Z desfazer essa mudança
                    // pushHistory();

                    state.interchangeMode = v;
                    renderAll();
                    refreshSidebar();
                };
            }


        }

        if (dom.btnDeleteEdge) {
            dom.btnDeleteEdge.onclick = () => {
                pushHistory();
                deleteEdge(edge.id);
                renderAll();
                refreshSidebar();
            };
        }

        if (dom.btnClearEdge) {
            dom.btnClearEdge.onclick = () => {
                state.selectedEdgeId = null;
                renderAll();
                refreshSidebar();
            };
        }
    }

