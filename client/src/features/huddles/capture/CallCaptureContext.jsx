import React, { createContext, useCallback, useContext, useEffect, useMemo, useRef, useState } from 'react';
import { HuddleContext, meetingIdFromHuddleId } from '../HuddleContext';
import { useOptionalSocket } from '../../../contexts/SocketContext';
import { useAuth } from '../../../contexts/AuthContext';
import api from '../../../services/api';
import logger from '../../../utils/logger';
import { captureApi, captureTarget, errorText } from './captureApi';
import {
    CAPTURE_MARKERS, SegmentQueue, captureBannerText, captureStateFromSegments, makeSegment, mergeSegments, pendingConsent,
} from './captions';
import { getSpeechRecognition, speechErrorInfo, speechSupport } from './speechSupport';
import { MAX_RECORDING_BYTES, baseMime, canRecord, pickRecorderMime, recordingFileName } from './recorderMime';
import { retainMeetingRoom, releaseAndLeave } from './meetingRoom';

/**
 * Recording, live captions and the consent notices of the app-wide call.
 *
 * - Captions: each person transcribes only their own microphone with the
 *   browser's speech recognition and sends final lines to the transcript API;
 *   the server relays them to everyone in the call (huddle:/meeting:transcript_segments).
 * - Recording: the person who started the call (or the meeting organiser) can
 *   record the mixed call audio, plus a shared screen or their camera, with
 *   MediaRecorder; the file is uploaded when recording stops.
 * - Consent: turning either on adds a line to the transcript, so every
 *   participant, including people who join later, sees who is recording or
 *   transcribing and is asked to acknowledge it (or leave).
 */
export const CallCaptureContext = createContext(null);
export const useCallCapture = () => useContext(CallCaptureContext);

const idOf = (v) => (v && typeof v === 'object' ? (v._id || v.id) : v) || null;

export function CallCaptureProvider({ children }) {
    const huddle = useContext(HuddleContext);
    const socket = useOptionalSocket()?.socket || null;
    const { user } = useAuth() || {};
    const me = useMemo(() => ({
        id: String(user?._id || user?.id || user?.sub || ''),
        name: user?.username || user?.firstName || 'You',
    }), [user]);

    const live = !!huddle?.active && !!huddle?.huddleId;
    const huddleId = live ? huddle.huddleId : null;
    const target = useMemo(() => (huddleId ? captureTarget(huddleId) : null), [huddleId]);
    const meetingId = meetingIdFromHuddleId(huddleId);

    /* ── Transcript of the running call ─────────────────────────────────── */
    const [segments, setSegments] = useState([]);
    const [transcriptError, setTranscriptError] = useState(null);
    const addSegments = useCallback((list) => setSegments((prev) => mergeSegments(prev, list || [])), []);

    useEffect(() => {
        setSegments([]);
        setTranscriptError(null);
        if (!target) return undefined;
        let cancelled = false;
        // Lines already said (and who is recording) when I join.
        const t = setTimeout(() => {
            captureApi.transcript(target)
                .then((d) => { if (!cancelled) addSegments(d?.segments || []); })
                .catch((err) => { if (!cancelled) setTranscriptError(errorText(err, 'Could not load the transcript')); });
        }, 600);
        return () => { cancelled = true; clearTimeout(t); };
    }, [target, addSegments]);

    useEffect(() => {
        if (!socket || !target) return undefined;
        const onHuddle = (p = {}) => { if (target.kind === 'huddle' && p.huddleId === target.id) addSegments(p.segments); };
        const onMeeting = (p = {}) => { if (target.kind === 'meeting' && String(p.meetingId) === String(target.id)) addSegments(p.segments); };
        socket.on('huddle:transcript_segments', onHuddle);
        socket.on('meeting:transcript_segments', onMeeting);
        return () => {
            socket.off('huddle:transcript_segments', onHuddle);
            socket.off('meeting:transcript_segments', onMeeting);
        };
    }, [socket, target, addSegments]);

    // A call that holds a meeting hears its transcript in the meeting's room.
    useEffect(() => {
        if (!socket || !meetingId) return undefined;
        const join = () => socket.emit('meeting:join', { meetingId }, () => {});
        retainMeetingRoom(meetingId);
        if (socket.connected) join();
        socket.on('connect', join);
        return () => {
            socket.off('connect', join);
            releaseAndLeave(socket, meetingId);
        };
    }, [socket, meetingId]);

    // Who may record: whoever started the call, or the meeting's organiser.
    const [organizerId, setOrganizerId] = useState(null);
    useEffect(() => {
        setOrganizerId(null);
        if (!meetingId) return undefined;
        let cancelled = false;
        api.get(`/api/v2/meetings/${encodeURIComponent(meetingId)}`)
            .then(({ data }) => { if (!cancelled) setOrganizerId(String(idOf((data?.meeting || data)?.createdBy) || '')); })
            .catch(() => {});
        return () => { cancelled = true; };
    }, [meetingId]);
    const startedById = String(idOf(huddle?.session?.startedBy) || '');
    const isHost = !!me.id && (startedById === me.id || organizerId === me.id);

    /* ── Sending segments ────────────────────────────────────────────────── */
    const targetRef = useRef(target);
    targetRef.current = target;
    const queueRef = useRef(null);
    const [sendError, setSendError] = useState(null);
    useEffect(() => {
        if (!target) return undefined;
        const q = new SegmentQueue(async (batch) => {
            try {
                // The API only takes Mongo ids as speakerId; anything else would reject the batch.
                await captureApi.postSegments(target, batch.map((s) => (
                    s.speakerId && !/^[a-f0-9]{24}$/i.test(String(s.speakerId)) ? { ...s, speakerId: undefined } : s)));
                setSendError(null);
            } catch (err) {
                setSendError(errorText(err, 'Captions could not be saved'));
                throw err;
            }
        });
        queueRef.current = q;
        return () => { q.flush().catch(() => {}); q.dispose(); if (queueRef.current === q) queueRef.current = null; };
    }, [target]);

    const say = useCallback((text, extra = {}) => {
        const seg = makeSegment({ speakerId: me.id, speakerName: me.name, text, ...extra });
        if (!seg) return;
        addSegments([seg]);
        queueRef.current?.push(seg);
    }, [me, addSegments]);
    const announce = useCallback((key) => {
        say(CAPTURE_MARKERS[key]);
        queueRef.current?.flush().catch(() => {});
    }, [say]);

    /* ── Live captions (my microphone) ───────────────────────────────────── */
    const support = useMemo(() => speechSupport(), []);
    const [captionsOn, setCaptionsOn] = useState(false);
    const [interim, setInterim] = useState('');
    const [captionError, setCaptionError] = useState(null);
    const recognitionRef = useRef(null);
    const wantCaptionsRef = useRef(false);
    const utteranceStartRef = useRef(null);
    const mutedRef = useRef(false);
    mutedRef.current = !!huddle?.muted;

    const runRecognition = useCallback(() => {
        if (!wantCaptionsRef.current || mutedRef.current || recognitionRef.current) return;
        const Recognition = getSpeechRecognition();
        if (!Recognition) return;
        const rec = new Recognition();
        rec.continuous = true;
        rec.interimResults = true;
        rec.lang = (typeof navigator !== 'undefined' && navigator.language) || 'en-US';
        rec.onresult = (e) => {
            let partial = '';
            for (let i = e.resultIndex; i < e.results.length; i += 1) {
                const r = e.results[i];
                const text = r[0]?.transcript || '';
                if (!utteranceStartRef.current) utteranceStartRef.current = new Date();
                if (r.isFinal) {
                    say(text, { startedAt: utteranceStartRef.current, endedAt: new Date() });
                    utteranceStartRef.current = null;
                } else {
                    partial += text;
                }
            }
            setInterim(partial.trim());
        };
        rec.onerror = (e) => {
            const info = speechErrorInfo(e?.error);
            if (info.fatal) {
                wantCaptionsRef.current = false;
                setCaptionsOn(false);
                setCaptionError(info.message);
                announce('captions:off');
            }
        };
        rec.onend = () => {
            recognitionRef.current = null;
            setInterim('');
            utteranceStartRef.current = null;
            // Browsers stop listening after a pause; keep going while captions are on.
            if (wantCaptionsRef.current && !mutedRef.current) setTimeout(runRecognition, 250);
        };
        try {
            rec.start();
            recognitionRef.current = rec;
        } catch (err) {
            logger.warn('[captions] could not start speech recognition:', err?.message);
        }
    }, [say, announce]);

    const stopRecognition = useCallback(() => {
        const rec = recognitionRef.current;
        recognitionRef.current = null;
        if (rec) { rec.onend = null; try { rec.stop(); } catch { /* already stopped */ } }
        setInterim('');
        utteranceStartRef.current = null;
    }, []);

    const startCaptions = useCallback(() => {
        if (!support.supported) { setCaptionError(support.reason); return; }
        if (!target || wantCaptionsRef.current) return;
        setCaptionError(null);
        wantCaptionsRef.current = true;
        setCaptionsOn(true);
        announce('captions:on');
        runRecognition();
    }, [support, target, announce, runRecognition]);

    const stopCaptions = useCallback(() => {
        if (!wantCaptionsRef.current) return;
        wantCaptionsRef.current = false;
        setCaptionsOn(false);
        stopRecognition();
        announce('captions:off');
    }, [stopRecognition, announce]);

    // Muted means not transcribed: pause listening while muted.
    useEffect(() => {
        if (!captionsOn) return;
        if (huddle?.muted) stopRecognition();
        else runRecognition();
    }, [huddle?.muted, captionsOn, stopRecognition, runRecognition]);

    /* ── Recording ───────────────────────────────────────────────────────── */
    const [recState, setRecState] = useState('idle'); // idle | recording | uploading | error
    const [recError, setRecError] = useState(null);
    const [recStartedAt, setRecStartedAt] = useState(null);
    const [recBytes, setRecBytes] = useState(0);
    const [uploadProgress, setUploadProgress] = useState(0);
    const [failedUpload, setFailedUpload] = useState(null); // { blob, fileName, durationSec, target, url }
    const [lastRecording, setLastRecording] = useState(null);
    const recRef = useRef(null); // { recorder, audioCtx, dest, sources: Map, chunks }

    const connectAudio = useCallback((stream, key) => {
        const r = recRef.current;
        if (!r || !stream || r.sources.has(key)) return;
        const tracks = stream.getAudioTracks?.() || [];
        if (!tracks.length) return;
        try {
            const src = r.audioCtx.createMediaStreamSource(new MediaStream(tracks));
            src.connect(r.dest);
            r.sources.set(key, src);
        } catch (err) {
            logger.warn('[recording] could not mix a stream:', err?.message);
        }
    }, []);

    // People who join while recording are mixed in too.
    useEffect(() => {
        if (recState !== 'recording') return;
        Object.entries(huddle?.remoteStreams || {}).forEach(([uid, s]) => connectAudio(s, `remote:${uid}`));
    }, [huddle?.remoteStreams, recState, connectAudio]);

    const upload = useCallback(async ({ blob, fileName, durationSec, target: t }) => {
        setRecState('uploading');
        setUploadProgress(0);
        try {
            const res = await captureApi.uploadRecording(t, blob, { fileName, durationSec, onProgress: setUploadProgress });
            setLastRecording(res?.recording || null);
            setFailedUpload((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
            setRecState('idle');
        } catch (err) {
            setRecError(errorText(err, 'The recording could not be uploaded'));
            setFailedUpload({ blob, fileName, durationSec, target: t, url: URL.createObjectURL(blob) });
            setRecState('error');
        }
    }, []);

    const stopRecording = useCallback(() => {
        const r = recRef.current;
        if (!r || r.recorder.state === 'inactive') return;
        try { r.recorder.stop(); } catch { /* already stopped */ }
        announce('recording:off');
    }, [announce]);

    const startRecording = useCallback(async () => {
        if (!target || recRef.current || !isHost) return;
        if (!canRecord()) { setRecError('This browser cannot record calls.'); setRecState('error'); return; }
        const AudioCtx = window.AudioContext || window.webkitAudioContext;
        if (!AudioCtx) { setRecError('This browser cannot mix call audio for a recording.'); setRecState('error'); return; }
        setRecError(null);
        try {
            const audioCtx = new AudioCtx();
            if (audioCtx.state === 'suspended') await audioCtx.resume().catch(() => {});
            const dest = audioCtx.createMediaStreamDestination();
            const screenTrack = huddle?.screenStream?.getVideoTracks?.()[0];
            const cameraTrack = huddle?.cameraOn ? huddle?.localStream?.getVideoTracks?.()[0] : null;
            const videoTrack = (screenTrack && screenTrack.readyState !== 'ended') ? screenTrack : (cameraTrack || null);
            const mime = pickRecorderMime(window.MediaRecorder, { video: !!videoTrack });
            const stream = new MediaStream([...dest.stream.getAudioTracks(), ...(videoTrack ? [videoTrack] : [])]);
            const recorder = new MediaRecorder(stream, mime ? { mimeType: mime } : undefined);
            const r = { recorder, audioCtx, dest, sources: new Map(), chunks: [], bytes: 0, video: !!videoTrack, startedAt: Date.now(), target };
            recRef.current = r;
            connectAudio(huddle?.localStream, 'local');
            Object.entries(huddle?.remoteStreams || {}).forEach(([uid, s]) => connectAudio(s, `remote:${uid}`));

            recorder.ondataavailable = (e) => {
                if (!e.data || !e.data.size) return;
                r.chunks.push(e.data);
                r.bytes += e.data.size;
                setRecBytes(r.bytes);
                // Stay under the server's upload limit.
                if (r.bytes > MAX_RECORDING_BYTES - 5 * 1024 * 1024 && recorder.state === 'recording') {
                    setRecError('The recording reached the 500 MB limit and was stopped.');
                    stopRecording();
                }
            };
            recorder.onstop = () => {
                const type = baseMime(recorder.mimeType || mime, { video: r.video });
                const blob = new Blob(r.chunks, { type });
                const durationSec = (Date.now() - r.startedAt) / 1000;
                r.sources.forEach((s) => { try { s.disconnect(); } catch { /* gone */ } });
                r.audioCtx.close().catch(() => {});
                recRef.current = null;
                setRecStartedAt(null);
                if (!blob.size) { setRecState('idle'); return; }
                upload({ blob, fileName: recordingFileName(type), durationSec, target: r.target });
            };
            recorder.start(1000);
            setRecBytes(0);
            setRecStartedAt(r.startedAt);
            setRecState('recording');
            announce('recording:on');
        } catch (err) {
            recRef.current = null;
            setRecError(errorText(err, 'Recording could not start'));
            setRecState('error');
        }
    }, [target, isHost, huddle?.screenStream, huddle?.cameraOn, huddle?.localStream, huddle?.remoteStreams, connectAudio, upload, announce, stopRecording]);

    const retryUpload = useCallback(() => { if (failedUpload) upload(failedUpload); }, [failedUpload, upload]);
    const discardFailed = useCallback(() => {
        setFailedUpload((prev) => { if (prev?.url) URL.revokeObjectURL(prev.url); return null; });
        setRecError(null);
        setRecState('idle');
    }, []);

    // Leaving the call stops my captions and recording (the recording still uploads).
    useEffect(() => {
        if (live) return;
        if (wantCaptionsRef.current) {
            wantCaptionsRef.current = false;
            setCaptionsOn(false);
            stopRecognition();
        }
        const r = recRef.current;
        if (r && r.recorder.state !== 'inactive') { try { r.recorder.stop(); } catch { /* stopped */ } }
    }, [live, stopRecognition]);
    useEffect(() => () => {
        wantCaptionsRef.current = false;
        const rec = recognitionRef.current;
        if (rec) { rec.onend = null; try { rec.stop(); } catch { /* stopped */ } }
    }, []);

    /* ── Consent ─────────────────────────────────────────────────────────── */
    const presentIds = useMemo(() => new Set((huddle?.participants || []).map((p) => String(p.userId))), [huddle?.participants]);
    const captureState = useMemo(() => captureStateFromSegments(segments, live ? presentIds : null), [segments, presentIds, live]);
    const [acknowledged, setAcknowledged] = useState(() => new Set());
    useEffect(() => { setAcknowledged(new Set()); }, [huddleId]);
    const pending = useMemo(() => (live ? pendingConsent(captureState, me.id, acknowledged) : []), [live, captureState, me.id, acknowledged]);
    const acknowledge = useCallback((items) => {
        setAcknowledged((prev) => {
            const next = new Set(prev);
            (Array.isArray(items) ? items : [items]).forEach((i) => next.add(`${i.userId}:${i.kind}`));
            return next;
        });
    }, []);

    const recordingLocal = recState === 'recording';
    const bannerText = live ? captureBannerText(captureState, { myId: me.id, recordingLocal, captionsLocal: captionsOn }) : '';
    const anyoneTranscribing = captionsOn || [...captureState.values()].some((v) => v.transcribing);

    const value = {
        live,
        huddleId,
        target,
        me,
        segments,
        interim,
        transcriptError,
        sendError,
        captureState,
        bannerText,
        anyoneTranscribing,
        pending,
        acknowledge,
        leaveCall: huddle?.leaveHuddle,
        captions: { on: captionsOn, supported: support.supported, reason: support.reason, error: captionError, start: startCaptions, stop: stopCaptions, clearError: () => setCaptionError(null) },
        recording: {
            state: recState,
            isHost,
            supported: canRecord(),
            startedAt: recStartedAt,
            bytes: recBytes,
            progress: uploadProgress,
            error: recError,
            failedUpload,
            lastRecording,
            start: startRecording,
            stop: stopRecording,
            retryUpload,
            discardFailed,
        },
    };

    return <CallCaptureContext.Provider value={value}>{children}</CallCaptureContext.Provider>;
}

export default CallCaptureProvider;
