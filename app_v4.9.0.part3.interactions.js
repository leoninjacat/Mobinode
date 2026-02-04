/* Mobinode - split bundle (part 3/4)
 * v4.4.5
 * Conteúdo: Interações (pan/zoom, drags, seleção, eventos de viewport/teclado)
 */

"use strict";

let connectionDraft = []; // guarda a ordem dos cliques (até 3)


// =========================
    // Pan / Zoom
    // =========================
    function startPan(ev) {
        isPanning = true;
        panPointerId = ev.pointerId;
        panStart = { x: ev.clientX, y: ev.clientY, vx: state.view.x, vy: state.view.y };
        dom.viewport.setPointerCapture(ev.pointerId);
        updateCursor();
    }

    function movePan(ev) {
        if (!isPanning || ev.pointerId !== panPointerId) return;
        const dx = ev.clientX - panStart.x;
        const dy = ev.clientY - panStart.y;
        state.view.x = panStart.vx + dx;
        state.view.y = panStart.vy + dy;
        applyView();
    }

    function stopPan() {
        if (!isPanning) return;
        isPanning = false;
        panPointerId = null;
        panStart = null;
        updateCursor();
    }

    function onWheel(ev) {
        ev.preventDefault();
        const oldZ = state.view.z;

        const delta = -ev.deltaY;
        const zoomFactor = delta > 0 ? 1.08 : 1 / 1.08;
        const newZ = clamp(oldZ * zoomFactor, CFG.MIN_Z, CFG.MAX_Z);
        if (newZ === oldZ) return;

        const p = screenToWorld(ev.clientX, ev.clientY);
        const r = dom.viewport.getBoundingClientRect();
        const screenX = ev.clientX - r.left;
        const screenY = ev.clientY - r.top;

        state.view.z = newZ;
        state.view.x = screenX - p.x * newZ;
        state.view.y = screenY - p.y * newZ;

        applyView();
        renderAll();
        refreshSidebar();
    }

    // =========================
    // Node drag / move
    // =========================
    function startNodeDrag(ev, nodeId) {
        isDraggingNodes = true;
        dragPointerId = ev.pointerId;
        dragStartWorld = screenToWorld(ev.clientX, ev.clientY);
        dragStartPositions = new Map();

        const idsToDrag = state.selectedNodeIds.has(nodeId) ? [...state.selectedNodeIds] : [nodeId];

        for (const id of idsToDrag) {
            const n = findNode(id);
            if (n) dragStartPositions.set(id, { x: n.x, y: n.y });
        }

        dom.viewport.setPointerCapture(ev.pointerId);
    }

    function moveNodeDrag(ev) {
        if (!isDraggingNodes || ev.pointerId !== dragPointerId) return;
        const cur = screenToWorld(ev.clientX, ev.clientY);
        const dx = cur.x - dragStartWorld.x;
        const dy = cur.y - dragStartWorld.y;

        for (const [id, p0] of dragStartPositions.entries()) {
            const n = findNode(id);
            if (!n) continue;
            n.x = snap(p0.x + dx);
            n.y = snap(p0.y + dy);
        }
        renderAll();
        refreshSidebar();
    }

    function stopNodeDrag() {
        if (!isDraggingNodes) return;
        isDraggingNodes = false;
        dragPointerId = null;
        dragStartWorld = null;
        dragStartPositions = null;
    }

    // =========================
    // Text drag
    // =========================
    function startTextDrag(ev, textId) {
        const t = findText(textId);
        if (!t) return;

        isDraggingText = true;
        textPointerId = ev.pointerId;
        draggingTextId = textId;

        textDragStartWorld = screenToWorld(ev.clientX, ev.clientY);
        textDragStartPos = { x: t.x, y: t.y };

        dom.viewport.setPointerCapture(ev.pointerId);
    }

    function moveTextDrag(ev) {
        if (!isDraggingText || ev.pointerId !== textPointerId) return;
        const t = findText(draggingTextId);
        if (!t) return;

        const cur = screenToWorld(ev.clientX, ev.clientY);
        const dx = cur.x - textDragStartWorld.x;
        const dy = cur.y - textDragStartWorld.y;

        t.x = snap(textDragStartPos.x + dx);
        t.y = snap(textDragStartPos.y + dy);

        renderAll();
        refreshSidebar();
    }

    function stopTextDrag() {
        if (!isDraggingText) return;
        isDraggingText = false;
        textPointerId = null;
        draggingTextId = null;
        textDragStartWorld = null;
        textDragStartPos = null;
    }

    // =========================
    // Link drag (chain / connect)
    // =========================
    function startLinkDrag(ev, fromNodeId, mode) {
        isDraggingLink = true;
        linkPointerId = ev.pointerId;
        linkFromNodeId = fromNodeId;
        linkMode = mode;
        state.isAltChaining = mode === "chain";
        linkGhostTo = null;

        dom.viewport.setPointerCapture(ev.pointerId);
        setGhost(true, "");
    }

    function moveLinkDrag(ev) {
        if (!isDraggingLink || ev.pointerId !== linkPointerId) return;

        const from = findNode(linkFromNodeId);
        if (!from) return;

        const cur = screenToWorld(ev.clientX, ev.clientY);

        let target = { x: snap(cur.x), y: snap(cur.y) };

        const v = snapAngle45(target.x - from.x, target.y - from.y);
        target = { x: snap(from.x + v.dx), y: snap(from.y + v.dy) };

        if (linkMode === "connect") {
            const near = nearestNode(target, CFG.CONNECT_SNAP_RADIUS);
            if (near && near.id !== from.id) target = { x: near.x, y: near.y };
        }

        linkGhostTo = target;
        const d = edgePath(from, target);
        setGhost(true, d);
    }

    function stopLinkDrag(ev) {
        if (!isDraggingLink || ev.pointerId !== linkPointerId) return;

        const wasChaining = state.isAltChaining;
        const from = findNode(linkFromNodeId);
        const target = linkGhostTo;

        setGhost(false);

        const lineId = (state.tool === "connections")
        ? ensureConnectorLine()
        : state.activeLineId;


        if (from && target) {
            const near = nearestNode(target, CFG.CONNECT_SNAP_RADIUS);
            const isConnectingToExisting = !!near && near.id !== from.id;

            pushHistory();

            if (linkMode === "connect") {
                if (isConnectingToExisting) {
                    addEdge(from.id, near.id, lineId);

                    state.selectedEdgeId = null;
                }
            } else {
                if (isConnectingToExisting) {
                    addEdge(from.id, near.id, state.activeLineId);
                } else {
                    const newNode = addNode(target.x, target.y);
                    addEdge(from.id, newNode.id, state.activeLineId);

                    state.selectedEdgeId = null;
                    state.selectedNodeIds.clear();
                    state.selectedNodeIds.add(newNode.id);

                    if (!wasChaining) pendingStationFocusId = newNode.id;
                }
            }

            state.isAltChaining = false;

            renderAll();
            refreshSidebar();
            updateUndoRedoButtons();
        }

        state.isAltChaining = false;
        isDraggingLink = false;
        linkPointerId = null;
        linkFromNodeId = null;
        linkGhostTo = null;
    }

    function stopLinkDragHard() {
        if (!isDraggingLink) return;
        setGhost(false);
        state.isAltChaining = false;
        isDraggingLink = false;
        linkPointerId = null;
        linkFromNodeId = null;
        linkGhostTo = null;
    }

    // =========================
    // Selection marquee
    // =========================
    function startSelect(ev) {
        isSelecting = true;
        selectPointerId = ev.pointerId;
        selectStartWorld = screenToWorld(ev.clientX, ev.clientY);
        selectCurrentWorld = { ...selectStartWorld };
        dom.viewport.setPointerCapture(ev.pointerId);
        renderSelectionRect();
    }

    function moveSelect(ev) {
        if (!isSelecting || ev.pointerId !== selectPointerId) return;
        selectCurrentWorld = screenToWorld(ev.clientX, ev.clientY);
        renderSelectionRect();
    }

    function stopSelect(ev) {
        if (!isSelecting || ev.pointerId !== selectPointerId) return;

        const x1 = Math.min(selectStartWorld.x, selectCurrentWorld.x);
        const y1 = Math.min(selectStartWorld.y, selectCurrentWorld.y);
        const x2 = Math.max(selectStartWorld.x, selectCurrentWorld.x);
        const y2 = Math.max(selectStartWorld.y, selectCurrentWorld.y);

        const selected = [];
        for (const n of state.nodes) {
            if (n.x >= x1 && n.x <= x2 && n.y >= y1 && n.y <= y2) selected.push(n.id);
        }

        if (!ev.shiftKey) state.selectedNodeIds.clear();
        selected.forEach((id) => state.selectedNodeIds.add(id));
        state.selectedEdgeId = null;
        state.selectedTextId = null;

        isSelecting = false;
        selectPointerId = null;
        selectStartWorld = null;
        selectCurrentWorld = null;
        renderSelectionRect();
        renderAll();
        refreshSidebar();
    }

    function stopSelectHard() {
        if (!isSelecting) return;
        isSelecting = false;
        selectPointerId = null;
        selectStartWorld = null;
        selectCurrentWorld = null;
        renderSelectionRect();
    }

    // =========================
    // Text pointerdown
    // =========================
    function onTextDown(ev, textId) {
        // Evita que o clique “vaze” pro viewport (no modo 📐) e crie sinalização por baixo.
        try { ev.stopPropagation(); } catch {}
        try { ev.preventDefault(); } catch {}

        if (state.selectedTextId !== textId) selectText(textId);
        pushHistory();
        startTextDrag(ev, textId);
    }

    // =========================
    // Node pointerdown
    // =========================
    function onNodeDown(ev, nodeId) {
        if (state.tool === "neutral") {
            if (ev.shiftKey) toggleSelectionNode(nodeId);
            else if (!state.selectedNodeIds.has(nodeId) || state.selectedNodeIds.size !== 1) setSingleSelectionNode(nodeId);

            pendingStationFocusId = nodeId;
            renderAll();
            refreshSidebar();

            pushHistory();
            startNodeDrag(ev, nodeId);
            return;
        }

        // v4.7.4: no modo Curvas, clique em estação/canvas apenas des-seleciona a conexão (evita "grudar")
        if (state.tool === "curves") {
            if (state.selectedNodeIds.size || state.selectedEdgeId || state.selectedTextId) {
                clearSelection();
                renderAll();
                refreshSidebar();
            }
            return;
        }

        if (state.tool === "select") {
            if (ev.shiftKey) toggleSelectionNode(nodeId);
            else if (!state.selectedNodeIds.has(nodeId)) setSingleSelectionNode(nodeId);

            pushHistory();
            startNodeDrag(ev, nodeId);
            renderAll();
            refreshSidebar();
            return;
        }

        if (state.tool === "connections") {
            // Garante que existe a "linha-conector" exclusiva
            // (não precisa mexer na linha ativa do mapa)
            const connectorLineId = ensureConnectorLine();

            // Gesto oficial do modo Conexões: SHIFT + arrastar de uma estação pra outra
            // (usa a linha ativa como "linha-conector"; não mexe nas linhas do mapa)
            if (ev.shiftKey) {
                // garante seleção visual (pra UI ficar viva)
                if (!state.selectedNodeIds.has(nodeId) || state.selectedNodeIds.size !== 1) {
                    setSingleSelectionNode(nodeId);
                }
                renderAll();
                refreshSidebar();

                startLinkDrag(ev, nodeId, "connect");
                return;
            }

            // No modo Conexões, clique simples NÃO cria ligação.
            // Só seleciona a estação (pra UI/propriedades) e limpa qualquer rascunho legado.
            try { ev.preventDefault(); } catch {}
            connectionDraft = [];

            if (!state.selectedNodeIds.has(nodeId) || state.selectedNodeIds.size !== 1) {
                setSingleSelectionNode(nodeId);
            }

            renderAll();
            refreshSidebar();
            return;
        }




        if (state.tool === "network" || state.tool === "line") {
            if (ev.shiftKey && !ev.altKey) {
                toggleSelectionNode(nodeId);
                renderAll();
                refreshSidebar();
            } else {
                if (!state.selectedNodeIds.has(nodeId)) {
                    setSingleSelectionNode(nodeId);
                    if (!state.isAltChaining) pendingStationFocusId = nodeId;
                    renderAll();
                    refreshSidebar();
                }
            }

            if (ev.altKey) {
                startLinkDrag(ev, nodeId, "chain");
                return;
            }
            if (ev.shiftKey) {
                startLinkDrag(ev, nodeId, "connect");
                return;
            }

            pushHistory();
            startNodeDrag(ev, nodeId);
            return;
        }

        if (state.tool === "text") {
            setSingleSelectionNode(nodeId);
            renderAll();
            refreshSidebar();
            pushHistory();
            startNodeDrag(ev, nodeId);
            return;
        }
    }


    // =========================
    // Nova linha: ALT + arrastar no vazio (modo Linhas)
    // =========================
    function startNewLineDrag(ev) {
        // Só no modo Linhas e com ALT
        if (state.tool !== "line" || !ev.altKey) return;

        isDraggingNewLine = true;
        newLinePointerId = ev.pointerId;

        const w = screenToWorld(ev.clientX, ev.clientY);
        newLineStartWorld = { x: snap(w.x), y: snap(w.y) };
        newLineGhostTo = { ...newLineStartWorld };

        try { dom.viewport.setPointerCapture(ev.pointerId); } catch {}

        // ghost inicial (zero-length)
        setGhost(true, edgePath(newLineStartWorld, newLineGhostTo));
        updateCursor();
    }

    function moveNewLineDrag(ev) {
        if (!isDraggingNewLine || ev.pointerId !== newLinePointerId) return;

        const w = screenToWorld(ev.clientX, ev.clientY);
        newLineGhostTo = { x: snap(w.x), y: snap(w.y) };

        setGhost(true, edgePath(newLineStartWorld, newLineGhostTo));
    }

    function stopNewLineDrag(ev) {
        if (!isDraggingNewLine || ev.pointerId !== newLinePointerId) return;

	    // Sempre finalizar o modo de criação, mesmo se der erro no meio.
	    try {
	        setGhost(false);

	        const start = newLineStartWorld;
	        let end = newLineGhostTo;

	        // Se o arrasto foi muito pequeno, cria um trecho padrão (4 quadradinhos)
	        const minDist = CFG.GRID * 0.75;
	        const dist = Math.hypot(end.x - start.x, end.y - start.y);
	        if (dist < minDist) {
	            end = { x: snap(start.x + CFG.GRID * 4), y: start.y };
	        }

	        pushHistory();

	        // Cria linha nova e torna ativa
	        let l = null;
	        try {
	            if (typeof createLine === "function") l = createLine();
	        } catch (e) {
	            console.error("Falha ao criar linha via createLine(); usando fallback.", e);
	            l = null;
	        }
	        if (!l) l = createLineFallbackForDrag();

	        state.activeLineId = l.id;
	        state.selectedLineId = l.id;

	        // Cria duas estações e conecta
	        const a = addNode(start.x, start.y);
	        const b = addNode(end.x, end.y);
	        addEdge(a.id, b.id, l.id);

	        clearSelection();
	        state.selectedNodeIds.add(b.id);
	        state.selectedEdgeId = null;
	        state.selectedTextId = null;
	        pendingStationFocusId = b.id;

	        renderAll();
	        refreshSidebar();
	        updateUndoRedoButtons();
	    } finally {
	        // reset
	        isDraggingNewLine = false;
	        newLinePointerId = null;
	        newLineStartWorld = null;
	        newLineGhostTo = null;
	        updateCursor();
	    }
    }

	// Fallback local (não depende de outras seções do arquivo)
	function createLineFallbackForDrag() {
	    const palette = ["#3b82f6", "#ef4444", "#22c55e", "#f59e0b", "#a855f7", "#06b6d4", "#f97316", "#84cc16"]; 
	    const idx = state.lines.length;
	    const l = {
	        id: uid(),
	        name: `Linha ${idx + 1}`,
	        color: palette[idx % palette.length],
	        width: 8,
	        style: "solid",
	        badgeEnabled: true,
	        badgeText: "",
	        badgePosition: "start",
	    };
	    try {
	        if (typeof ensureLineBadgeProps === "function") ensureLineBadgeProps(l);
	    } catch {}
	    state.lines.push(l);
        // v4.8.4: fallback também precisa resetar o contador por linha

	    return l;

        state.stationAutoNameIndexByLine = state.stationAutoNameIndexByLine || {};
        state.stationAutoNameIndexByLine[l.id] = 1;
	}

    function stopNewLineDragHard() {
        if (!isDraggingNewLine) return;
        setGhost(false);
        isDraggingNewLine = false;
        newLinePointerId = null;
        newLineStartWorld = null;
        newLineGhostTo = null;
        updateCursor();
    }

    // =========================
    // ╮ Curvas: editar dobras (v4.7.3)
    // =========================
    function startEdgeBendDrag(ev, edgeId) {
        const e = state.edges.find(x => x.id === edgeId);
        if (!e) return;

        pushHistory();
        isDraggingEdgeBend = true;
        edgeBendPointerId = ev.pointerId;
        draggingEdgeId = edgeId;

        // garante um ponto inicial de dobra (v4.7.4: bendOffset relativo ao segmento)
        try {
            const aN = findNode(e.a);
            const bN = findNode(e.b);
            const aP = getPortPos(e.a, e.lineId) || { x: aN?.x ?? 0, y: aN?.y ?? 0 };
            const bP = getPortPos(e.b, e.lineId) || { x: bN?.x ?? 0, y: bN?.y ?? 0 };

            const mid = { x: snap((aP.x + bP.x) / 2), y: snap((aP.y + bP.y) / 2) };

            // migra legado: bend absoluto -> bendOffset
            if (!e.bendOffset && e.bend && Number.isFinite(e.bend.x) && Number.isFinite(e.bend.y)) {
                e.bendOffset = { dx: snap(e.bend.x - mid.x), dy: snap(e.bend.y - mid.y) };
                delete e.bend;
            }

            const auto = computeAutoKinkPoint(aP, bP);
            if (!e.bendOffset) {
                const k = auto ? { x: auto.x, y: auto.y } : { x: snap((aP.x + bP.x) / 2), y: snap((aP.y + bP.y) / 2) };
                e.bendOffset = { dx: snap(k.x - mid.x), dy: snap(k.y - mid.y) };
            }
        } catch {}

        try { dom.viewport.setPointerCapture(ev.pointerId); } catch {}
        renderAll();
    }

    function moveEdgeBendDrag(ev) {
        if (!isDraggingEdgeBend || ev.pointerId !== edgeBendPointerId) return;
        const e = state.edges.find(x => x.id === draggingEdgeId);
        if (!e) return;
        const w = screenToWorld(ev.clientX, ev.clientY);

        // v4.7.4: atualiza bendOffset relativo ao segmento (para acompanhar o traçado ao mover estações)
        try {
            const aN = findNode(e.a);
            const bN = findNode(e.b);
            const aP = getPortPos(e.a, e.lineId) || { x: aN?.x ?? 0, y: aN?.y ?? 0 };
            const bP = getPortPos(e.b, e.lineId) || { x: bN?.x ?? 0, y: bN?.y ?? 0 };
            const mid = { x: snap((aP.x + bP.x) / 2), y: snap((aP.y + bP.y) / 2) };
            const sp = { x: snap(w.x), y: snap(w.y) };
            e.bendOffset = { dx: snap(sp.x - mid.x), dy: snap(sp.y - mid.y) };
            delete e.bend;
        } catch {
            e.bendOffset = { dx: 0, dy: 0 };
        }

        renderAll();
    }

    function stopEdgeBendDrag() {
        isDraggingEdgeBend = false;
        edgeBendPointerId = null;
        draggingEdgeId = null;
        renderAll();
        refreshSidebar();
    }

    // =========================
    // Viewport events
    // =========================
    function onViewportDown(ev) {
        const middle = ev.button === 1;
        if (middle || state.tool === "pan") {
            startPan(ev);
            return;
        }

        const target = ev.target;
        const w = screenToWorld(ev.clientX, ev.clientY);

        if (state.tool === "neutral") {
            if (ev.shiftKey) {
                pushHistory();
                startSelect(ev);
                return;
            }

            if (state.selectedNodeIds.size || state.selectedEdgeId || state.selectedTextId) {
                clearSelection();
                renderAll();
                refreshSidebar();
            }
            return;
        }

        // v4.7.4: no modo Curvas, clicar no vazio des-seleciona a conexão/handle
        if (state.tool === "curves") {
            if (state.selectedNodeIds.size || state.selectedEdgeId || state.selectedTextId) {
                clearSelection();
                renderAll();
                refreshSidebar();
            }
            return;
        }

        if (state.tool === "select") {
            pushHistory();
            startSelect(ev);
            return;
        }

        if (state.tool === "text") {
            // Criação de sinalização (📐) ao clicar no vazio
            if (target && target.closest && (target.closest('.map-text') || target.closest('.station') || target.closest('.station-ports') || target.closest('.edge-hit') || target.closest('.edge'))) {
                // Elementos existentes já tratam seleção/drag
                return;
            }

            // Se houver preset, cria sinalização. Senão, cria texto livre.
            normalizeSignagePreset();
            const preset = state.signagePreset;

            pushHistory();
            clearSelection();

            let t;
            if (preset) {
                t = addText(w.x, w.y, {
                    kind: preset.kind,
                    lineId: preset.lineId,
					size: state.signageNextSize,
                    bold: state.signageNextBold,
                    italic: state.signageNextItalic,
                });
            } else {
                t = addText(w.x, w.y, null);
				t.size = state.textNextSize;
                t.bold = state.signageNextBold;
                t.italic = state.signageNextItalic;
                const txt = (state.textDraft && String(state.textDraft).trim()) ? String(state.textDraft) : "Texto";
                t.text = txt;
                ensureTextProps(t);
            }
            state.selectedTextId = t.id;
            renderAll();
            refreshSidebar();
            return;
        }

        if (state.tool === "network" || state.tool === "line") {
            // No modo Linhas: ALT + arrastar no vazio cria uma nova linha.
            if (state.tool === "line" && ev.altKey) {
                startNewLineDrag(ev);
                return;
            }

            // Clique simples no vazio: só deseleciona (criação de estação é no duplo clique).
            if (state.selectedNodeIds.size || state.selectedEdgeId || state.selectedTextId) {
                clearSelection();
                renderAll();
                refreshSidebar();
            }
            return;
        }
    }



    function onViewportDblClick(ev) {
        // só botão esquerdo
        if (ev.button !== 0) return;
        ev.preventDefault();

        const w = screenToWorld(ev.clientX, ev.clientY);

        if (state.tool === "network") {
            // Não criar estação se o duplo clique foi em cima de uma estação ou texto
            const t = ev.target;
            if (t && (
                (t.closest && (t.closest(".map-text") || t.closest(".station") || t.closest(".station-ports")))
                || (t.classList && (t.classList.contains("map-text") || t.classList.contains("station")))
            )) {
                return;
            }

            // Se o duplo clique foi “no traçado”, insere estação no trecho e divide a conexão.
            const hit = findNearestEdgeForInsert(w);
            if (hit && hit.edge) {
                const e = hit.edge;

                // Posição de inserção (projetada no segmento mais próximo + snap alinhado)
                const snapped = snapPointOntoSegmentGrid(hit.proj, hit.seg.a, hit.seg.b);

                // Evita criar “colado” no endpoint
                if (dist2(snapped, hit.aP) < (CFG.STATION_R * 2) ** 2 || dist2(snapped, hit.bP) < (CFG.STATION_R * 2) ** 2) {
                    // cai para criação normal
                } else {
                    pushHistory();

                    // ativa a linha clicada (mas não deixa a linha técnica de conexões virar "linha ativa")
                    if (e.lineId) {
                        const ln = findLine(e.lineId);
                        if (ln && !(ln.role === "connector" || ln.name === "__connector__")) {
                            state.activeLineId = e.lineId;
                            state.selectedLineId = e.lineId;
                            updateStationToolBadge();
                        }
                    }

                    const n = addNode(snapped.x, snapped.y);
                    // divide a edge original em duas
                    deleteEdge(e.id);
                    addEdge(e.a, n.id, e.lineId);
                    addEdge(n.id, e.b, e.lineId);

                    clearSelection();
                    state.selectedNodeIds.add(n.id);
                    state.selectedEdgeId = null;
                    state.selectedTextId = null;
                    pendingStationFocusId = n.id;

                    renderAll();
                    refreshSidebar();
                    return;
                }
            }

            // fallback: cria estação livre
            pushHistory();
            const n = addNode(w.x, w.y);
            clearSelection();
            state.selectedNodeIds.add(n.id);
            state.selectedEdgeId = null;
            state.selectedTextId = null;
            pendingStationFocusId = n.id;

            renderAll();
            refreshSidebar();
            return;
        }

        if (state.tool === "line") {
            // No modo Linhas, a criação principal é ALT + arrastar no vazio.
            return;
        }
    }

    function onViewportMove(ev) {
        if (isPanning) return movePan(ev);
        if (isDraggingText) return moveTextDrag(ev);
        if (isDraggingNodes) return moveNodeDrag(ev);
        if (isDraggingEdgeBend) return moveEdgeBendDrag(ev);
        if (isDraggingLink) return moveLinkDrag(ev);
        if (isDraggingNewLine) return moveNewLineDrag(ev);
        if (isSelecting) return moveSelect(ev);
    }

    function onViewportUp(ev) {
        if (isPanning && ev.pointerId === panPointerId) {
            try { dom.viewport.releasePointerCapture(ev.pointerId); } catch {}
            stopPan();
            return;
        }
        if (isDraggingText && ev.pointerId === textPointerId) {
            try { dom.viewport.releasePointerCapture(ev.pointerId); } catch {}
            stopTextDrag();
            renderAll();
            refreshSidebar();
            return;
        }
        if (isDraggingNodes && ev.pointerId === dragPointerId) {
            try { dom.viewport.releasePointerCapture(ev.pointerId); } catch {}
            stopNodeDrag();
            renderAll();
            refreshSidebar();
            return;
        }
        if (isDraggingEdgeBend && ev.pointerId === edgeBendPointerId) {
            try { dom.viewport.releasePointerCapture(ev.pointerId); } catch {}
            stopEdgeBendDrag();
            return;
        }
        if (isDraggingLink && ev.pointerId === linkPointerId) {
            try { dom.viewport.releasePointerCapture(ev.pointerId); } catch {}
            stopLinkDrag(ev);
            return;
        }
        if (isDraggingNewLine && ev.pointerId === newLinePointerId) {
            try { dom.viewport.releasePointerCapture(ev.pointerId); } catch {}
            stopNewLineDrag(ev);
            return;
        }
        if (isSelecting && ev.pointerId === selectPointerId) {
            try { dom.viewport.releasePointerCapture(ev.pointerId); } catch {}
            stopSelect(ev);
            return;
        }
    }

    function onViewportCancel() {
        stopPan();
        stopTextDrag();
        stopNodeDrag();
        stopEdgeBendDrag();
        stopLinkDragHard();
        stopNewLineDragHard();
        stopSelectHard();
    }

    // =========================
    // Keyboard
    // =========================

function onKeyDown(ev) {
    const ctrlOrCmd = ev.ctrlKey || ev.metaKey;
    if (ctrlOrCmd) {
        const k = (ev.key || "").toLowerCase();

        // Padrão de editores: Ctrl/Cmd+Z = desfazer ações do app.
        // Mantém o undo "de texto" do navegador APENAS quando não há nada pra desfazer no app.
        if (k === "z" && ev.shiftKey) {
            if (history.redo.length > 0) { ev.preventDefault(); redo(); return; }
        } else if (k === "z") {
            if (history.undo.length > 0) { ev.preventDefault(); undo(); return; }
        } else if (k === "y") {
            if (history.redo.length > 0) { ev.preventDefault(); redo(); return; }
        }
    }

        if (ev.key === "Delete" && !isTypingContext()) {
            if (state.selectedTextId) {
                pushHistory();
                deleteText(state.selectedTextId);
                renderAll();
                refreshSidebar();
                return;
            }
            if (state.selectedEdgeId) {
                pushHistory();
                deleteEdge(state.selectedEdgeId);
                renderAll();
                refreshSidebar();
                return;
            }
            if (state.selectedNodeIds.size > 0) {
                pushHistory();
                deleteNodes([...state.selectedNodeIds]);
                renderAll();
                refreshSidebar();
                return;
            }
        }

        if (ev.key === "Escape") {
            // Se algum modal estiver aberto, ele tem prioridade
            if (isSettingsOpen()) { showSettingsModal(false); ev.preventDefault(); return; }
            if (isAboutOpen()) { showAboutModal(false); ev.preventDefault(); return; }
            if (dom.modal && dom.modal.style.display !== "none") return; // modal JSON

            onViewportCancel();
            renderAll();
            refreshSidebar();
        }
    }

    function onKeyUp() {}

