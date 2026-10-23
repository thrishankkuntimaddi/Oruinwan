import React, { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { ChevronLeft, ChevronRight, LayoutGrid, SquareUserRound, PinOff } from 'lucide-react';
import { ParticipantTile, streamFor, videoOn } from './callParts';
import {
    GAP, deviceClassFor, filmstripWindow, findSharer, gridLayout, nearestCorner, pickFeatured, pipLayout,
    resolveView, stageLayout, swipeDirection,
} from './callLayout';

const nextFrame = (fn) => (typeof window !== 'undefined' && window.requestAnimationFrame
    ? window.requestAnimationFrame(fn) : setTimeout(fn, 16));

/** Size used before the stage has been measured (and in tests, where nothing is laid out). */
export const FALLBACK_SIZE = { width: 960, height: 540 };

/**
 * The width × height of an element, kept up to date on resize, fullscreen and rotation.
 * Falls back to FALLBACK_SIZE while the element has no size.
 */
export function useElementSize(ref) {
    const [size, setSize] = useState(FALLBACK_SIZE);
    useLayoutEffect(() => {
        const el = ref.current;
        if (!el) return undefined;
        const measure = () => {
            const width = Math.floor(el.clientWidth);
            const height = Math.floor(el.clientHeight);
            if (!(width > 0) || !(height > 0)) return;
            setSize(prev => (prev.width === width && prev.height === height ? prev : { width, height }));
        };
        measure();
        const win = el.ownerDocument?.defaultView || window;
        let ro = null;
        if (win.ResizeObserver) {
            ro = new win.ResizeObserver(measure);
            ro.observe(el);
        }
        const events = ['resize', 'orientationchange'];
        events.forEach(e => win.addEventListener(e, measure));
        win.document.addEventListener('fullscreenchange', measure);
        return () => {
            ro?.disconnect();
            events.forEach(e => win.removeEventListener(e, measure));
            win.document.removeEventListener('fullscreenchange', measure);
        };
    }, [ref]);
    return size;
}

/** 'desktop' | 'tablet' | 'narrow' for this window, updated on resize / rotation. */
function useDeviceClass() {
    const read = () => {
        if (typeof window === 'undefined') return 'desktop';
        const coarse = !!window.matchMedia?.('(pointer: coarse)')?.matches;
        return deviceClassFor({ width: window.innerWidth, coarse });
    };
    const [device, setDevice] = useState(read);
    useEffect(() => {
        const onResize = () => setDevice(read());
        window.addEventListener('resize', onResize);
        window.addEventListener('orientationchange', onResize);
        return () => {
            window.removeEventListener('resize', onResize);
            window.removeEventListener('orientationchange', onResize);
        };
    }, []);
    return device;
}

/**
 * Everyone in the call, laid out to fit: an auto grid (paged when it gets crowded), a speaker
 * view, a pinned person or screen on the main stage with a filmstrip, or, in a 1:1 call, the
 * other person full size with me in a corner I can drag. Only tiles on screen play video;
 * audio is independent of tiles.
 */
export default function CallStage({
    participants, localStream, screenStream, remoteStreams, cameraOn, speaking, peerStates = {}, device: deviceProp,
}) {
    const canvasRef = useRef(null);
    const { width, height } = useElementSize(canvasRef);
    const autoDevice = useDeviceClass();
    const device = deviceProp || autoDevice;

    const [view, setView] = useState('auto');      // 'auto' | 'grid' | 'speaker'
    const [pinnedId, setPinnedId] = useState(null);
    const [page, setPage] = useState(0);
    const [corner, setCorner] = useState('br');
    const [stripScroll, setStripScroll] = useState(0);

    const sharer = findSharer(participants);
    const sharerId = sharer?.userId || null;

    // Whoever talks; the last speaker stays until someone else talks.
    const lastSpeakerRef = useRef(null);
    const speaker = pickFeatured(participants, speaking, lastSpeakerRef.current);
    if (speaker && speaking.has(speaker.userId)) lastSpeakerRef.current = speaker.userId;

    // A new screen share takes the stage, even after "Grid" was chosen.
    const prevSharerRef = useRef(sharerId);
    useEffect(() => {
        if (sharerId && sharerId !== prevSharerRef.current) setView(v => (v === 'grid' ? 'auto' : v));
        prevSharerRef.current = sharerId;
    }, [sharerId]);

    // A pinned person who leaves is unpinned.
    useEffect(() => {
        if (pinnedId && !participants.some(p => p.userId === pinnedId)) setPinnedId(null);
    }, [participants, pinnedId]);

    const resolved = resolveView({ view, pinnedId, participants, sharerId, speakerId: speaker?.userId });
    const count = participants.length;

    const media = { localStream, screenStream, remoteStreams };
    const togglePin = useCallback(id => setPinnedId(cur => (cur === id ? null : id)), []);
    const chooseView = (v) => { setPinnedId(null); setView(v); };

    const tile = (p, extra = {}) => (
        <ParticipantTile
            key={p.userId}
            participant={p}
            stream={streamFor(p, media)}
            showVideo={videoOn(p, { cameraOn, screenStream })}
            mirror={p.isLocal && !screenStream}
            connection={peerStates[p.userId]}
            speaking={speaking.has(p.userId) && p.audioEnabled !== false}
            screen={p.userId === sharerId || (p.isLocal && !!screenStream)}
            pinned={pinnedId === p.userId}
            onPin={count > 1 ? togglePin : null}
            {...extra}
        />
    );

    // ── Grid ────────────────────────────────────────────────────────────────
    const grid = resolved.kind === 'grid' ? gridLayout({ width, height, count, device, page }) : null;
    const pages = grid?.pages || 1;
    const shownPage = grid?.page || 0;
    const clampedPage = grid?.page;
    useEffect(() => {
        if (clampedPage !== undefined && page !== clampedPage) setPage(clampedPage);
    }, [clampedPage, page]);
    const goPage = useCallback(delta => setPage(p => Math.min(Math.max(0, p + delta), pages - 1)), [pages]);

    const touch = useRef(null);
    const onTouchStart = (e) => {
        const t = e.touches?.[0];
        touch.current = t ? { x: t.clientX, y: t.clientY } : null;
    };
    const onTouchEnd = (e) => {
        const t = e.changedTouches?.[0];
        if (!touch.current || !t || pages <= 1) return;
        const dir = swipeDirection(t.clientX - touch.current.x, t.clientY - touch.current.y);
        touch.current = null;
        if (dir) goPage(-dir);
    };

    // ── Stage + filmstrip ───────────────────────────────────────────────────
    const main = resolved.kind !== 'grid' ? participants.find(p => p.userId === resolved.mainId) : null;
    const strip = resolved.kind === 'stage' ? participants.filter(p => p.userId !== resolved.mainId) : [];
    const stage = resolved.kind === 'stage' ? stageLayout({ width, height, stripCount: strip.length, device }) : null;
    const win = stage?.strip
        ? filmstripWindow({
            count: strip.length,
            size: stage.strip === 'right' ? stage.thumbH : stage.thumbW,
            scroll: stripScroll,
            viewport: stage.stripLength,
        })
        : null;
    const stripRaf = useRef(0);
    const onStripScroll = (e) => {
        const el = e.currentTarget;
        const pos = stage?.strip === 'right' ? el.scrollTop : el.scrollLeft;
        if (stripRaf.current) return;
        stripRaf.current = nextFrame(() => { stripRaf.current = 0; setStripScroll(pos); });
    };

    // ── 1:1 self-view ───────────────────────────────────────────────────────
    const self = participants.find(p => p.isLocal);
    const pip = resolved.kind === 'duo' ? pipLayout({ width, height }) : null;
    const [dragPos, setDragPosState] = useState(null);
    const dragPosRef = useRef(null);
    const setDragPos = (pos) => { dragPosRef.current = pos; setDragPosState(pos); };
    const drag = useRef(null);
    const onPipDown = (e) => {
        if (e.button > 0 || e.target.closest('button')) return;
        const box = e.currentTarget.getBoundingClientRect();
        const host = canvasRef.current?.getBoundingClientRect();
        if (!host) return;
        drag.current = { dx: e.clientX - box.left, dy: e.clientY - box.top, host };
        e.currentTarget.setPointerCapture?.(e.pointerId);
    };
    const onPipMove = (e) => {
        const d = drag.current;
        if (!d) return;
        const x = Math.min(Math.max(0, e.clientX - d.host.left - d.dx), width - pip.pipW);
        const y = Math.min(Math.max(0, e.clientY - d.host.top - d.dy), height - pip.pipH);
        setDragPos({ x, y });
    };
    const onPipUp = () => {
        if (!drag.current) return;
        drag.current = null;
        const pos = dragPosRef.current;
        if (pos) setCorner(nearestCorner(pos.x + pip.pipW / 2, pos.y + pip.pipH / 2, width, height));
        setDragPos(null);
    };

    // ── Toolbar ─────────────────────────────────────────────────────────────
    const nameOf = p => (p?.isLocal ? 'You' : p?.username || 'Guest');
    const chip = resolved.reason === 'pinned'
        ? `Pinned: ${main?.userId === sharerId ? `${nameOf(main)}’s screen` : nameOf(main)}`
        : resolved.reason === 'screen' ? `${nameOf(main)} ${main?.isLocal ? 'are' : 'is'} sharing a screen` : null;

    return (
        <div className="cs-stagebox" data-testid="call-stage" data-layout={resolved.kind} data-reason={resolved.reason}>
            {count > 1 && (
                <div className="cs-stagebar">
                    <div className="gl-tabs cs-viewtabs" role="tablist" aria-label="Layout">
                        <button type="button" role="tab" className="gl-tab" data-testid="view-grid"
                            aria-selected={resolved.kind === 'grid'} onClick={() => chooseView('grid')} title="Grid: everyone the same size">
                            <LayoutGrid size={13} /><span>Grid</span>
                        </button>
                        <button type="button" role="tab" className="gl-tab" data-testid="view-speaker"
                            aria-selected={resolved.reason === 'speaker'} onClick={() => chooseView('speaker')} title="Speaker: whoever talks is shown large">
                            <SquareUserRound size={13} /><span>Speaker</span>
                        </button>
                    </div>
                    {chip && <span className="cs-chip is-accent cs-stagechip" data-testid="stage-chip">{chip}</span>}
                    {resolved.reason === 'pinned' && (
                        <button type="button" className="gl-btn cs-unpin" data-testid="stage-unpin" onClick={() => setPinnedId(null)}>
                            <PinOff size={13} /> Unpin
                        </button>
                    )}
                    <span className="cs-head-spacer" />
                    {grid && pages > 1 && (
                        <div className="cs-pager" data-testid="call-pager">
                            <button type="button" className="gl-icon-btn" data-testid="page-prev" aria-label="Previous page"
                                title="Previous page" disabled={shownPage === 0} onClick={() => goPage(-1)}>
                                <ChevronLeft size={16} />
                            </button>
                            <span className="cs-pager-text" aria-live="polite">Page {shownPage + 1} of {pages}</span>
                            <button type="button" className="gl-icon-btn" data-testid="page-next" aria-label="Next page"
                                title="Next page" disabled={shownPage >= pages - 1} onClick={() => goPage(1)}>
                                <ChevronRight size={16} />
                            </button>
                        </div>
                    )}
                </div>
            )}

            <div className="cs-canvas" ref={canvasRef} onTouchStart={onTouchStart} onTouchEnd={onTouchEnd}>
                {grid && (
                    <div className="cs-grid" style={{ width: grid.width, gap: GAP }} data-cols={grid.cols} data-rows={grid.rows}>
                        {participants.slice(grid.start, grid.end).map(p => tile(p, { size: { w: grid.tileW, h: grid.tileH } }))}
                    </div>
                )}

                {stage && main && (
                    <div className={`cs-stagewrap is-${stage.strip || 'solo'}`} style={{ gap: GAP }}>
                        <div className="cs-main">
                            {tile(main, {
                                size: { w: stage.mainW, h: stage.mainH },
                                fit: main.userId === sharerId || (main.isLocal && screenStream) ? 'contain' : 'cover',
                            })}
                        </div>
                        {stage.strip && (
                            <div className="cs-strip" data-testid="call-filmstrip" onScroll={onStripScroll}
                                style={stage.strip === 'right' ? { width: stage.thumbW, height: stage.mainH } : { width: stage.mainW, height: stage.thumbH }}>
                                {strip.map((p, i) => tile(p, {
                                    size: { w: stage.thumbW, h: stage.thumbH },
                                    visible: i >= win.first && i <= win.last,
                                }))}
                            </div>
                        )}
                    </div>
                )}

                {resolved.kind === 'duo' && main && (
                    <>
                        {tile(main, { size: { w: width, h: height }, fit: width / height < 0.9 ? 'contain' : 'cover' })}
                        {self && (
                            <div
                                className={`cs-pip${dragPos ? ' is-dragging' : ` at-${corner}`}`}
                                data-testid="call-pip"
                                style={{ width: pip.pipW, height: pip.pipH, ...(dragPos ? { left: dragPos.x, top: dragPos.y } : {}) }}
                                onPointerDown={onPipDown} onPointerMove={onPipMove} onPointerUp={onPipUp} onPointerCancel={onPipUp}
                                title="Drag to move your video"
                            >
                                {tile(self, { size: { w: pip.pipW, h: pip.pipH }, compact: true, onPin: null })}
                            </div>
                        )}
                    </>
                )}
                {count <= 1 && <p className="cs-waiting">Waiting for others to join…</p>}
            </div>
        </div>
    );
}
