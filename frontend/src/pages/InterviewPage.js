import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import { API_BASE, authHeaders, useToast, AudioWaves, Spinner } from '../utils';

const MAX_WARNINGS = 3;

export default function InterviewPage({ user, config, onFinished }) {
    const {
        interviewId,
        firstQuestion,
        audioUrl,
        duration,      // minutes
        type,
        skills,
    } = config;

    // ── State ───────────────────────────────────────────────────────────────
    const [question, setQuestion] = useState(firstQuestion || '');
    const [transcript, setTranscript] = useState([{ role: 'ai', text: firstQuestion || '' }]);
    const [phase, setPhase] = useState('interviewing'); // interviewing | loading | finished | terminated
    const [isListening, setIsListening] = useState(false);
    const [isLoading, setIsLoading] = useState(false);
    const [round, setRound] = useState(1);
    const [alertStatus, setAlertStatus] = useState('OK');
    const [warnings, setWarnings] = useState(0);
    const [camActive, setCamActive] = useState(false);
    const [timeLeft, setTimeLeft] = useState(duration * 60); // seconds
    const [timeWarning, setTimeWarning] = useState(false);
    const [terminated, setTerminated] = useState(false);
    const [tabSwitchOverlay, setTabSwitchOverlay] = useState(false);
    const { showToast, ToastNode } = useToast();
    const lastTabSwitchRef = useRef(0); // debounce timestamp

    // ── Refs ─────────────────────────────────────────────────────────────────
    const videoRef = useRef(null);
    const canvasRef = useRef(null);
    const socketRef = useRef(null);
    const streamRef = useRef(null);
    const transcriptEnd = useRef(null);
    const elapsedRef = useRef(0);   // seconds elapsed
    const warningRef = useRef(0);
    const timerRef = useRef(null);

    // ── Play first audio ─────────────────────────────────────────────────────
    useEffect(() => {
        if (audioUrl) {
            const audio = new Audio(audioUrl);
            audio.play().catch(() => { });
        }
    }, []);

    // ── Timer ────────────────────────────────────────────────────────────────
    useEffect(() => {
        if (phase === 'finished' || phase === 'terminated') return;
        timerRef.current = setInterval(() => {
            elapsedRef.current += 1;
            const remaining = duration * 60 - elapsedRef.current;
            setTimeLeft(remaining);

            if (remaining <= 60 && remaining > 0) {
                setTimeWarning(true);
            }
            if (remaining <= 0) {
                clearInterval(timerRef.current);
                handleTimeUp();
            }
        }, 1000);
        return () => clearInterval(timerRef.current);
    }, [phase, duration]);

    // ── Auto-scroll transcript ───────────────────────────────────────────────
    useEffect(() => {
        transcriptEnd.current?.scrollIntoView({ behavior: 'smooth' });
    }, [transcript]);

    // ── Tab Switch / Window Blur Detection ───────────────────────────────────
    useEffect(() => {
        const handleVisibilityChange = () => {
            if (document.hidden && phase !== 'finished' && phase !== 'terminated') {
                const now = Date.now();
                // Debounce: ignore if less than 3s since last switch
                if (now - lastTabSwitchRef.current < 3000) return;
                lastTabSwitchRef.current = now;
                setTabSwitchOverlay(true);
                triggerWarning('tab_switch');
            }
        };
        const handleWindowBlur = () => {
            if (phase !== 'finished' && phase !== 'terminated') {
                const now = Date.now();
                if (now - lastTabSwitchRef.current < 3000) return;
                lastTabSwitchRef.current = now;
                setTabSwitchOverlay(true);
                triggerWarning('window_blur');
            }
        };
        document.addEventListener('visibilitychange', handleVisibilityChange);
        window.addEventListener('blur', handleWindowBlur);
        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
            window.removeEventListener('blur', handleWindowBlur);
        };
    }, [phase, triggerWarning]);

    // ── WebSocket Proctoring ─────────────────────────────────────────────────
    useEffect(() => {
        const ws = new WebSocket(`ws://localhost:8000/ws/proctor/${interviewId}`);
        ws.onmessage = (e) => {
            const data = JSON.parse(e.data);
            setAlertStatus(data.alert);
            if (data.terminate) {
                handleTerminate('proctoring_violation');
                return;
            }
            // Count warnings for non-OK, non-ERROR
            if (data.alert !== 'OK' && data.alert !== 'ERROR' && data.alert !== 'INVALID') {
                triggerWarning();
            }
        };
        ws.onerror = () => { };
        socketRef.current = ws;

        const interval = setInterval(() => {
            if (videoRef.current?.readyState === 4 && socketRef.current?.readyState === 1) {
                const ctx = canvasRef.current?.getContext('2d');
                if (ctx) {
                    ctx.drawImage(videoRef.current, 0, 0, 320, 240);
                    socketRef.current.send(
                        JSON.stringify({ image: canvasRef.current.toDataURL('image/jpeg') })
                    );
                }
            }
        }, 1500);

        return () => {
            clearInterval(interval);
            socketRef.current?.close();
        };
    }, [interviewId]);

    // ── Camera ───────────────────────────────────────────────────────────────
    const activateCamera = async () => {
        try {
            const stream = await navigator.mediaDevices.getUserMedia({
                video: { width: { ideal: 640 }, height: { ideal: 480 }, facingMode: 'user' },
                audio: false,
            });
            if (videoRef.current) {
                videoRef.current.srcObject = stream;
                streamRef.current = stream;
                setCamActive(true);
                showToast('Camera activated', 'success');
            }
        } catch (err) {
            const msgs = {
                NotAllowedError: 'Camera permission denied.',
                NotFoundError: 'No camera found.',
                NotReadableError: 'Camera is in use.',
            };
            showToast(msgs[err.name] || `Camera error: ${err.message}`, 'error');
        }
    };

    // ── Warning Logic ─────────────────────────────────────────────────────────
    const triggerWarning = useCallback(async (reason = 'proctoring') => {
        const newCount = warningRef.current + 1;
        warningRef.current = newCount;
        setWarnings(newCount);

        try {
            const res = await axios.post(
                `${API_BASE}/api/interview/warning/${interviewId}`,
                {},
                { headers: authHeaders() }
            );
            if (res.data.terminate) {
                handleTerminate('proctoring_violation');
                return;
            }
        } catch (e) { }

        if (reason === 'tab_switch' || reason === 'window_blur') {
            if (newCount === 1) showToast('⚠️ Warning 1/3: Tab switching is not allowed!', 'warning');
            else if (newCount === 2) showToast('⚠️ Warning 2/3: One more violation = termination!', 'warning');
            else showToast('🚫 Interview terminated — tab switching violations!', 'error');
        } else {
            if (newCount === 1) showToast('⚠️ Warning 1/3: Sit straight, face the camera!', 'warning');
            else if (newCount === 2) showToast('⚠️ Warning 2/3: Last warning before termination!', 'warning');
        }

        if (newCount >= 3) {
            handleTerminate('proctoring_violation');
        }
    }, [interviewId]);

    // ── Terminate ─────────────────────────────────────────────────────────────
    const handleTerminate = (reason = 'manual') => {
        clearInterval(timerRef.current);
        setPhase('terminated');
        setTerminated(true);
        streamRef.current?.getTracks().forEach(t => t.stop());
    };

    // ── Time Up ───────────────────────────────────────────────────────────────
    const handleTimeUp = async () => {
        if (phase === 'finished' || phase === 'terminated') return;
        try {
            const formData = new FormData();
            formData.append('interview_id', interviewId);
            formData.append('user_answer', '[Time expired]');
            formData.append('elapsed_seconds', duration * 60);
            const res = await axios.post(`${API_BASE}/api/interview/chat`, formData, { headers: authHeaders() });
            setQuestion(res.data.question);
            setTranscript(prev => [...prev, { role: 'ai', text: res.data.question }]);
        } catch (e) { }
        setPhase('finished');
        setTimeout(() => {
            streamRef.current?.getTracks().forEach(t => t.stop());
            onFinished(interviewId);
        }, 4000);
    };

    // ── Voice Answer ──────────────────────────────────────────────────────────
    const submitVoiceAnswer = () => {
        const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
        if (!SR) return showToast('Speech recognition not supported. Try Chrome.', 'error');

        const recognition = new SR();
        recognition.lang = 'en-US';
        recognition.interimResults = false;

        recognition.onstart = () => setIsListening(true);
        recognition.onerror = (e) => { setIsListening(false); showToast(`Speech error: ${e.error}`, 'error'); };

        recognition.onresult = async (event) => {
            const userText = event.results[0][0].transcript;
            setIsListening(false);
            setTranscript(prev => [...prev, { role: 'user', text: userText }]);
            setPhase('loading');
            setIsLoading(true);

            const formData = new FormData();
            formData.append('interview_id', interviewId);
            formData.append('user_answer', userText);
            formData.append('elapsed_seconds', elapsedRef.current);

            try {
                const res = await axios.post(`${API_BASE}/api/interview/chat`, formData, { headers: authHeaders() });
                const aiText = res.data.question;
                setQuestion(aiText);
                setRound(res.data.round);
                setTranscript(prev => [...prev, { role: 'ai', text: aiText }]);
                const audio = new Audio(res.data.audio_url);
                audio.play().catch(() => { });

                if (res.data.is_finished) {
                    setPhase('finished');
                    clearInterval(timerRef.current);
                    streamRef.current?.getTracks().forEach(t => t.stop());
                    setTimeout(() => onFinished(interviewId), 3500);
                } else {
                    setPhase('interviewing');
                }
                if (res.data.time_warning) setTimeWarning(true);
            } catch (err) {
                setPhase('interviewing');
                showToast('Failed to send answer. Backend running?', 'error');
            } finally {
                setIsLoading(false);
            }
        };

        recognition.start();
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const formatTime = (secs) => {
        const m = Math.floor(Math.max(0, secs) / 60);
        const s = Math.max(0, secs) % 60;
        return `${String(m).padStart(2, '0')}:${String(s).padStart(2, '0')}`;
    };

    const alertLabel = {
        OK: 'Proctoring: Clear',
        NO_FACE: 'No face detected!',
        MULTIPLE_PEOPLE: 'Multiple faces!',
        LOOKING_LEFT: 'Looking away!',
        LOOKING_RIGHT: 'Looking away!',
        INVALID: 'Invalid frame',
        ERROR: 'Proctoring error',
    }[alertStatus] || alertStatus;

    const isAlert = alertStatus !== 'OK';
    const timerClass = timeLeft <= 0
        ? 'danger'
        : timeLeft <= 60 ? 'warning' : '';

    if (terminated) {
        return (
            <div className="app-wrapper">
                <div className="termination-overlay">
                    <div className="termination-card">
                        <span className="termination-icon">🚫</span>
                        <div className="termination-title">Interview Terminated</div>
                        <div className="termination-msg">
                            Your interview was automatically terminated due to <strong>3 proctoring violations</strong>.
                            <br /><br />
                            Violations include: tab switching, window switching, no face detected, multiple people visible, or looking away from camera.
                        </div>
                        <button className="btn btn-primary" onClick={() => onFinished(interviewId)}>
                            📄 View Report
                        </button>
                    </div>
                </div>
                {ToastNode}
            </div>
        );
    }

    return (
        <div className="app-wrapper">
            {/* Tab Switch Warning Overlay */}
            {tabSwitchOverlay && !terminated && (
                <div style={{
                    position: 'fixed', inset: 0, zIndex: 9999,
                    background: 'rgba(239,68,68,0.97)',
                    display: 'flex', flexDirection: 'column',
                    alignItems: 'center', justifyContent: 'center',
                    gap: 16, textAlign: 'center', padding: 32,
                    animation: 'fadeIn 0.2s ease'
                }}>
                    <div style={{ fontSize: '4rem' }}>🚨</div>
                    <div style={{ fontSize: '1.8rem', fontWeight: 900, color: '#fff' }}>
                        Tab Switching Detected!
                    </div>
                    <div style={{ fontSize: '1rem', color: 'rgba(255,255,255,0.9)', maxWidth: 480 }}>
                        You switched away from the interview window.<br />
                        This counts as a <strong>proctoring violation</strong>.<br />
                        You have <strong style={{ fontSize: '1.3em' }}>{3 - warnings} warning(s) left</strong> before termination.
                    </div>
                    <button
                        className="btn"
                        style={{ background: '#fff', color: '#ef4444', fontWeight: 700, marginTop: 8 }}
                        onClick={() => setTabSwitchOverlay(false)}
                    >
                        ✅ Return to Interview
                    </button>
                </div>
            )}
            {/* Interview Header */}
            <header className="interview-header">
                <div className="logo">
                    <div className="logo-icon">🤖</div>
                    <span className="logo-text">Live Interview</span>
                </div>

                <div className="interview-meta">
                    {/* Timer */}
                    <div className={`timer-display ${timerClass}`} aria-label="Time remaining">
                        ⏱ {formatTime(timeLeft)}
                    </div>

                    {/* Proctor */}
                    <div className={`status-badge ${isAlert ? 'status-alert' : 'status-ok'}`} role="status" aria-live="polite">
                        <div className="dot" />
                        {alertLabel}
                    </div>

                    {/* Warnings */}
                    <div className="warnings-display">
                        {[0, 1, 2].map(i => (
                            <div key={i} className={`warning-dot ${i < warnings ? 'active' : 'inactive'}`} />
                        ))}
                        <span style={{ fontSize: '0.75rem', color: warnings > 0 ? 'var(--danger)' : 'var(--text-muted)', fontWeight: 600 }}>
                            {warnings}/3 warnings
                        </span>
                    </div>

                    {/* Round badge */}
                    <span className="badge badge-accent">Round {round}</span>
                </div>
            </header>

            {/* Main */}
            <main className="interview-main">
                {/* Camera Panel */}
                <section className="panel" aria-label="Camera feed">
                    <div className="panel-header">
                        <div className="panel-title">📹 Live Feed</div>
                        {camActive && (
                            <span style={{ fontSize: '0.72rem', color: 'var(--danger)', fontWeight: 700 }}>● LIVE</span>
                        )}
                    </div>

                    <div className="video-container">
                        {!camActive && (
                            <div className="camera-placeholder">
                                <div className="icon">📷</div>
                                <p>Camera is not active.<br />Click below to enable your webcam.</p>
                            </div>
                        )}
                        <video id="webcam-video" ref={videoRef} autoPlay muted playsInline
                            style={{ display: camActive ? 'block' : 'none' }}
                            onLoadedMetadata={() => setCamActive(true)} />
                    </div>

                    <div className={`alert-banner ${isAlert ? 'alert' : 'ok'}`} role="alert" aria-live="assertive">
                        <span>{isAlert ? '⚠️' : '✅'}</span>
                        {alertLabel}
                    </div>

                    <div className="camera-footer">
                        <button id="activate-camera-btn" className="btn btn-outline" onClick={activateCamera}
                            disabled={camActive} aria-label="Activate camera">
                            {camActive ? '✅ Camera Active' : '📷 Activate Camera'}
                        </button>
                    </div>
                </section>

                {/* Interview Panel */}
                <section className="panel interview-panel" aria-label="Interview">
                    <div className="panel-header">
                        <div className="panel-title">💬 Interview Session</div>
                        {isLoading && <Spinner />}
                    </div>

                    {/* Time warning banner */}
                    {timeWarning && phase === 'interviewing' && (
                        <div className="time-warning-banner">
                            ⏰ Less than 1 minute remaining — answer quickly!
                        </div>
                    )}

                    {/* Question */}
                    <div className="question-area">
                        <div className="question-label" aria-hidden="true">
                            {phase === 'finished' ? 'Interview Complete' : `Question ${round}`}
                        </div>
                        <p id="interview-question"
                            className={`question-text ${isLoading ? 'loading' : 'fade-in'}`}
                            aria-live="polite">
                            {!isLoading && question}
                        </p>
                    </div>

                    {/* Progress */}
                    <div className="progress-section" aria-label={`${Math.round((elapsedRef.current / (duration * 60)) * 100)}% time elapsed`}>
                        <div className="progress-label">
                            <span>Time Elapsed</span>
                            <span>{formatTime(elapsedRef.current)} / {duration} min</span>
                        </div>
                        <div className="progress-track">
                            <div className="progress-fill"
                                style={{ width: `${Math.min(100, (elapsedRef.current / (duration * 60)) * 100)}%` }} />
                        </div>
                    </div>

                    {/* Transcript */}
                    {transcript.length > 0 && (
                        <div className="transcript-panel" role="log" aria-label="Conversation history">
                            {transcript.slice(-6).map((msg, i) => (
                                <div key={i} className={`transcript-msg ${msg.role}`}>
                                    <div className="msg-label">{msg.role === 'ai' ? '🤖 AI' : '🧑 You'}</div>
                                    {msg.text}
                                </div>
                            ))}
                            <div ref={transcriptEnd} />
                        </div>
                    )}

                    {/* Actions */}
                    <div className="action-area">
                        {phase === 'interviewing' && (
                            <button id="voice-answer-btn"
                                className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
                                onClick={submitVoiceAnswer}
                                disabled={isListening}
                                aria-label={isListening ? 'Listening…' : 'Answer via voice'}>
                                {isListening
                                    ? <><AudioWaves /> Listening… Speak now</>
                                    : <>🎤 Answer via Voice</>
                                }
                            </button>
                        )}
                        {phase === 'loading' && (
                            <button className="btn btn-outline" disabled aria-busy="true">
                                <Spinner /> AI is thinking…
                            </button>
                        )}
                        {phase === 'finished' && (
                            <button className="btn btn-primary" onClick={() => onFinished(interviewId)}>
                                📄 View My Report
                            </button>
                        )}
                    </div>
                </section>
            </main>

            {/* Hidden canvas for proctoring */}
            <canvas ref={canvasRef} style={{ display: 'none' }} width="320" height="240" aria-hidden="true" />
            {ToastNode}
        </div>
    );
}
