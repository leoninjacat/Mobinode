/* Mobinode - split bundle (part 2/4)
 * v4.4.5
 * Conteúdo: UI (sidebar/panels, modais, accordion, lógica do painel de linhas)
 */

"use strict";

// =========================
    // Sidebar / Panels
    // =========================
    function showHelpPanel(on) {
        if (!dom.helpPanel) return;
        dom.helpPanel.style.display = on ? "block" : "none";
        if (dom.btnHelp) dom.btnHelp.style.display = on ? "none" : "block";
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
    };
    const active = map[which] || dom.accLine;
    [dom.accLine, dom.accConnections, dom.accStation, dom.accText, dom.accMulti].forEach((d) => {
        if (!d) return;
        d.open = true;
        d.style.display = (d === active) ? "block" : "none";
    });
}

function refreshSidebar() {
        refreshLinePanel();
        renderStationQuickPick?.();
        renderSignagePickers();
        bindConnectorPanel();

        const selCount = state.selectedNodeIds.size;
        const hasEdge = !!state.selectedEdgeId;
        const hasText = !!state.selectedTextId;

        const lock = state.isAltChaining;


// Metapainel: escolhe qual bloco aparece
if (state.propsMode === "metapanel") {
    let which = "line";
    if (lock) {
        // mantém o que já estava (sem trocar) — mas garante que algo está visível
        which = "line";
    } else if (state.tool === "connections") which = "connections";
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
        setSectionState(dom.accText, dom.textEmpty, dom.textPanel, !lock && (state.tool === "text" || hasText));
        if (state.propsMode !== "metapanel") {

        if (!lock) {
            const sig = `${[...state.selectedNodeIds].sort().join(",")}|e:${state.selectedEdgeId || ""}|t:${state.selectedTextId || ""}|tool:${state.tool}`;
            if (sig !== lastSelectionSig) {
                if (hasText) openAccordion(dom.accText);
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

        if (selCount === 1 && !lock && !hasEdge && !hasText) openSidebarStation([...state.selectedNodeIds][0]);
        if (selCount > 1 && !lock && !hasEdge && !hasText) openSidebarMulti();
        if (hasText && !lock) openSidebarText(state.selectedTextId);
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
            try { renderStationQuickPick(); } catch(e) {}

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

    function renderStationQuickPick() {
        if (!dom.stationQuickPick) return;

        const lineId = state.selectedLineId || state.activeLineId;
        dom.stationQuickPick.innerHTML = "";

        if (!lineId) {
            const o = document.createElement("option");
            o.value = "";
            o.textContent = "Nenhuma linha ativa...";
            dom.stationQuickPick.appendChild(o);
            dom.stationQuickPick.disabled = true;
            return;
        }

        const ids = getStationIdsForLine(lineId);
        if (!ids.size) {
            const o = document.createElement("option");
            o.value = "";
            o.textContent = "Essa linha ainda não tem estações.";
            dom.stationQuickPick.appendChild(o);
            dom.stationQuickPick.disabled = true;
            return;
        }

        dom.stationQuickPick.disabled = false;

        // placeholder
        const o0 = document.createElement("option");
        o0.value = "";
        o0.textContent = "Selecionar estação...";
        dom.stationQuickPick.appendChild(o0);

        // lista ordenada por nome (simples e eficiente)
        const items = [...ids].map((id) => {
            const n = findNode(id);
            const name = n ? (n.name?.trim() ? n.name.trim() : id) : id;
            return { id, name };
        }).sort((a,b) => a.name.localeCompare(b.name, "pt-BR"));

        for (const it of items) {
            const o = document.createElement("option");
            o.value = it.id;
            o.textContent = it.name;
            dom.stationQuickPick.appendChild(o);
        }

        // sincroniza com a seleção atual
        if (state.selectedNodeIds && state.selectedNodeIds.size === 1) {
            const curId = [...state.selectedNodeIds][0];
            dom.stationQuickPick.value = curId;
        } else {
            dom.stationQuickPick.value = "";
        }
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

