import React, { useState, useRef, useEffect, useCallback } from 'react';
import axios from 'axios';
import './App.css';

const API_BASE = 'http://localhost:8000';

// ─── Toast Notification ───────────────────────────────────────────────
function Toast({ message, type, onClose }) {
  useEffect(() => {
    const t = setTimeout(onClose, 3500);
    return () => clearTimeout(t);
  }, [onClose]);

  const icons = { success: '✅', error: '❌', info: 'ℹ️', warning: '⚠️' };
  return (
    <div className={`toast ${type}`} role="alert">
      <span>{icons[type] || 'ℹ️'}</span>
      <span>{message}</span>
    </div>
  );
}

// ─── Progress Dots ────────────────────────────────────────────────────
function RoundDots({ current, total = 5 }) {
  return (
    <div className="round-dots" aria-label={`Round ${current} of ${total}`}>
      {Array.from({ length: total }, (_, i) => (
        <div
          key={i}
          className={`round-dot ${i + 1 < current ? 'done' : i + 1 === current ? 'current' : ''}`}
        />
      ))}
    </div>
  );
}

// ─── Audio Wave Animation ─────────────────────────────────────────────
function AudioWaves() {
  return (
    <div className="audio-waves" aria-hidden="true">
      {[1, 2, 3, 4, 5].map(i => (
        <div key={i} className="bar" style={{ height: `${8 + i * 3}px` }} />
      ))}
    </div>
  );
}

// ─── Main App ─────────────────────────────────────────────────────────
function App() {
  const [phase, setPhase] = useState('idle'); // idle | uploading | interviewing | loading | finished
  const [question, setQuestion] = useState('Upload your resume to begin your AI-powered mock interview.');
  const [alertStatus, setAlertStatus] = useState('OK');
  const [isListening, setIsListening] = useState(false);
  const [round, setRound] = useState(0);
  const [transcript, setTranscript] = useState([]);
  const [finalFeedback, setFinalFeedback] = useState('');
  const [camActive, setCamActive] = useState(false);
  const [toast, setToast] = useState(null);
  const [isLoading, setIsLoading] = useState(false);

  const videoRef = useRef(null);
  const canvasRef = useRef(null);
  const socketRef = useRef(null);
  const roundTracker = useRef(0);
  const transcriptEndRef = useRef(null);
  const streamRef = useRef(null);

  // Auto-scroll transcript
  useEffect(() => {
    transcriptEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [transcript]);

  // WebSocket proctoring
  useEffect(() => {
    const connectWS = () => {
      const ws = new WebSocket(`ws://localhost:8000/ws/proctor`);
      ws.onmessage = (e) => {
        const status = JSON.parse(e.data).alert;
        setAlertStatus(status);
        if (status !== 'OK' && status !== 'ERROR') {
          new Audio('https://cdn.pixabay.com/audio/2022/03/24/audio_7314781442.mp3')
            .play()
            .catch(() => {});
        }
      };
      ws.onerror = () => {};
      socketRef.current = ws;
    };
    connectWS();

    const interval = setInterval(() => {
      if (
        videoRef.current?.readyState === 4 &&
        socketRef.current?.readyState === 1
      ) {
        const ctx = canvasRef.current.getContext('2d');
        ctx.drawImage(videoRef.current, 0, 0, 320, 240);
        socketRef.current.send(
          JSON.stringify({ image: canvasRef.current.toDataURL('image/jpeg') })
        );
      }
    }, 1200);

    return () => {
      clearInterval(interval);
      socketRef.current?.close();
    };
  }, []);

  const showToast = useCallback((message, type = 'info') => {
    setToast({ message, type });
  }, []);

  const processResponse = useCallback((data) => {
    const aiText = data.question;
    setQuestion(aiText);
    setRound(data.round);
    roundTracker.current = data.round;
    setIsLoading(false);

    setTranscript(prev => [...prev, { role: 'ai', text: aiText }]);

    const audio = new Audio(data.audio_url);
    audio.play().catch(() => {});

    if (data.is_finished) {
      setFinalFeedback(aiText);
      setTimeout(() => setPhase('finished'), 1800);
    } else {
      setPhase('interviewing');
    }
  }, []);

  // ─── Activate Camera ───────────────────────────────────────────────
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
        showToast('Camera activated successfully', 'success');
      }
    } catch (err) {
      const msgs = {
        NotAllowedError: 'Camera permission denied. Please allow camera access.',
        NotFoundError: 'No camera found on this device.',
        NotReadableError: 'Camera is in use by another application.',
      };
      showToast(msgs[err.name] || `Camera error: ${err.message}`, 'error');
    }
  };

  // ─── Upload Resume ─────────────────────────────────────────────────
  const handleResumeUpload = async (e) => {
    const file = e.target.files[0];
    if (!file) return;
    if (file.type !== 'application/pdf') {
      showToast('Please upload a PDF file', 'error');
      return;
    }

    setPhase('uploading');
    setIsLoading(true);
    setQuestion('Analyzing your resume...');
    showToast('Uploading resume...', 'info');

    const formData = new FormData();
    formData.append('file', file);

    try {
      const res = await axios.post(`${API_BASE}/api/start`, formData);
      showToast('Interview started!', 'success');
      processResponse(res.data);
    } catch (err) {
      setPhase('idle');
      setIsLoading(false);
      setQuestion('Upload your resume to begin your AI-powered mock interview.');
      showToast('Failed to start interview. Is the backend running?', 'error');
    }
  };

  // ─── Voice Answer ──────────────────────────────────────────────────
  const submitVoiceAnswer = () => {
    const SR = window.SpeechRecognition || window.webkitSpeechRecognition;
    if (!SR) {
      showToast('Speech recognition not supported. Try Chrome.', 'error');
      return;
    }

    const recognition = new SR();
    recognition.lang = 'en-US';
    recognition.interimResults = false;

    recognition.onstart = () => setIsListening(true);

    recognition.onresult = async (event) => {
      const userText = event.results[0][0].transcript;
      setIsListening(false);
      setTranscript(prev => [...prev, { role: 'user', text: userText }]);
      setPhase('loading');
      setIsLoading(true);
      setQuestion('');

      const formData = new FormData();
      formData.append('user_answer', userText);
      formData.append('round', roundTracker.current);

      try {
        const res = await axios.post(`${API_BASE}/api/chat`, formData);
        processResponse(res.data);
      } catch (err) {
        setPhase('interviewing');
        setIsLoading(false);
        setQuestion(transcript[transcript.length - 1]?.text || 'Error. Please try again.');
        showToast('Failed to send answer. Is the backend running?', 'error');
      }
    };

    recognition.onerror = (event) => {
      setIsListening(false);
      showToast(`Speech error: ${event.error}`, 'error');
    };

    recognition.start();
  };

  // ─── Proctor Status ────────────────────────────────────────────────
  const alertLabel = {
    OK: 'Proctoring: Clear',
    NO_FACE: 'No face detected!',
    MULTIPLE_PEOPLE: 'Multiple faces detected!',
    LOOKING_LEFT: 'Looking away!',
    LOOKING_RIGHT: 'Looking away!',
    INVALID: 'Invalid frame',
    ERROR: 'Proctoring error',
  }[alertStatus] || alertStatus;

  const isAlert = alertStatus !== 'OK';
  const progressPct = round > 0 ? (round / 5) * 100 : 0;

  return (
    <div className="app-wrapper">
      {/* ── Header ── */}
      <header className="header" role="banner">
        <div className="logo">
          <div className="logo-icon" aria-hidden="true">🤖</div>
          <span className="logo-text">AI Interview Simulator</span>
        </div>
        <div className="header-badges">
          <div className={`status-badge ${isAlert ? 'status-alert' : 'status-ok'}`} role="status" aria-live="polite">
            <div className="dot" />
            {alertLabel}
          </div>
          {round > 0 && (
            <div className="round-badge">Round {round} / 5</div>
          )}
        </div>
      </header>

      {/* ── Main Content ── */}
      <main className="main-content" role="main">
        {/* Left Panel: Camera */}
        <section className="panel camera-panel" aria-label="Camera feed">
          <div className="panel-header">
            <div className="panel-title">
              <span>📹</span> Live Feed
            </div>
            {camActive && (
              <span style={{ fontSize: '0.75rem', color: 'var(--success)', fontWeight: 600 }}>
                🔴 LIVE
              </span>
            )}
          </div>

          <div className="video-container">
            {!camActive && (
              <div className="camera-placeholder">
                <div className="icon">📷</div>
                <p>Camera is not active.<br/>Click below to enable your webcam.</p>
              </div>
            )}
            <video
              id="webcam-video"
              ref={videoRef}
              autoPlay
              muted
              playsInline
              style={{ display: camActive ? 'block' : 'none' }}
              onLoadedMetadata={() => setCamActive(true)}
            />
          </div>

          <div className={`alert-banner ${isAlert ? 'alert' : 'ok'}`} role="alert" aria-live="assertive">
            <span>{isAlert ? '⚠️' : '✅'}</span>
            {alertLabel}
          </div>

          <div className="camera-footer">
            <button
              id="activate-camera-btn"
              className="btn btn-outline"
              onClick={activateCamera}
              disabled={camActive}
              aria-label="Activate camera"
            >
              {camActive ? '✅ Camera Active' : '📷 Activate Camera'}
            </button>
          </div>
        </section>

        {/* Right Panel: Interview */}
        <section className="panel interview-panel" aria-label="Interview panel">
          <div className="panel-header">
            <div className="panel-title">
              <span>💬</span> Interview Session
            </div>
            {phase === 'loading' && (
              <div className="spinner" aria-label="Loading" />
            )}
          </div>

          {/* Question */}
          <div className="question-area">
            <div className="question-label" aria-hidden="true">
              {round === 0 ? 'Get Started' : `Question ${round}`}
            </div>
            <p
              id="interview-question"
              className={`question-text ${isLoading ? 'loading' : 'fade-in'}`}
              aria-live="polite"
            >
              {!isLoading && question}
            </p>
          </div>

          {/* Progress */}
          {round > 0 && (
            <>
              <div className="progress-section" aria-label={`Progress: ${round} of 5 rounds`}>
                <div className="progress-label">
                  <span>Progress</span>
                  <span>{round} / 5 Rounds</span>
                </div>
                <div className="progress-track">
                  <div className="progress-fill" style={{ width: `${progressPct}%` }} />
                </div>
              </div>
              <RoundDots current={round} total={5} />
            </>
          )}

          {/* Transcript */}
          {transcript.length > 0 && (
            <div className="transcript-panel" aria-label="Conversation history" role="log">
              {transcript.slice(-6).map((msg, i) => (
                <div key={i} className={`transcript-msg ${msg.role}`}>
                  <div className="msg-label">{msg.role === 'ai' ? '🤖 AI' : '🧑 You'}</div>
                  {msg.text}
                </div>
              ))}
              <div ref={transcriptEndRef} />
            </div>
          )}

          {/* Action Area */}
          <div className="action-area">
            {phase === 'idle' && (
              <div className="upload-zone" role="button" aria-label="Upload resume PDF">
                <div className="upload-icon">📄</div>
                <div className="upload-text">Drop or click to upload your <strong>Resume (PDF)</strong></div>
                <div className="upload-hint">Supported: PDF • Max 10MB</div>
                <input
                  id="resume-upload"
                  type="file"
                  accept=".pdf"
                  onChange={handleResumeUpload}
                  aria-label="Upload resume PDF file"
                />
              </div>
            )}

            {phase === 'uploading' && (
              <button className="btn btn-outline" disabled aria-busy="true">
                <div className="spinner" /> Analyzing Resume...
              </button>
            )}

            {(phase === 'interviewing') && (
              <button
                id="voice-answer-btn"
                className={`btn ${isListening ? 'btn-danger' : 'btn-primary'}`}
                onClick={submitVoiceAnswer}
                disabled={isListening}
                aria-label={isListening ? 'Listening for your answer' : 'Click to answer via voice'}
              >
                {isListening ? (
                  <>
                    <AudioWaves />
                    Listening... Speak now
                  </>
                ) : (
                  <>🎤 Answer via Voice</>
                )}
              </button>
            )}

            {phase === 'loading' && (
              <button className="btn btn-outline" disabled aria-busy="true">
                <div className="spinner" /> AI is thinking...
              </button>
            )}

            {phase === 'finished' && (
              <button
                id="restart-btn"
                className="btn btn-primary"
                onClick={() => {
                  setPhase('idle');
                  setRound(0);
                  setQuestion('Upload your resume to begin your AI-powered mock interview.');
                  setTranscript([]);
                  setFinalFeedback('');
                  roundTracker.current = 0;
                }}
              >
                🔄 Start New Interview
              </button>
            )}
          </div>
        </section>
      </main>

      {/* Hidden canvas for proctoring */}
      <canvas ref={canvasRef} style={{ display: 'none' }} width="320" height="240" aria-hidden="true" />

      {/* ── Result Overlay ── */}
      {phase === 'finished' && (
        <div className="result-overlay" role="dialog" aria-modal="true" aria-label="Interview complete">
          <div className="result-card">
            <span className="result-icon" aria-hidden="true">🎉</span>
            <h2 className="result-title">Interview Complete!</h2>
            <p className="result-subtitle">
              You've completed all 5 rounds of your AI mock interview.<br />
              Here's your final feedback:
            </p>
            <div className="result-feedback" aria-label="Interview feedback">
              {finalFeedback || 'Great job completing the interview! Review your responses and keep practicing.'}
            </div>
            <button
              id="result-restart-btn"
              className="btn btn-primary"
              onClick={() => {
                setPhase('idle');
                setRound(0);
                setQuestion('Upload your resume to begin your AI-powered mock interview.');
                setTranscript([]);
                setFinalFeedback('');
                roundTracker.current = 0;
              }}
            >
              🔄 Start New Interview
            </button>
          </div>
        </div>
      )}

      {/* ── Toast ── */}
      {toast && (
        <Toast
          message={toast.message}
          type={toast.type}
          onClose={() => setToast(null)}
        />
      )}
    </div>
  );
}

export default App;