import React, { useState, useEffect, useCallback } from 'react';

// ── Toast ──────────────────────────────────────────────────────────────────
export function Toast({ message, type, onClose }) {
    useEffect(() => {
        const t = setTimeout(onClose, 4000);
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

// ── Helper to generate and consume toasts ─────────────────────────────────
export function useToast() {
    const [toast, setToast] = useState(null);
    const showToast = useCallback((message, type = 'info') => {
        setToast({ message, type });
    }, []);
    const ToastNode = toast ? (
        <Toast message={toast.message} type={toast.type} onClose={() => setToast(null)} />
    ) : null;
    return { showToast, ToastNode };
}

// ── Score Ring ────────────────────────────────────────────────────────────
export function ScoreRing({ score, color = '#6366f1', label }) {
    const r = 38, cx = 45, cy = 45;
    const circ = 2 * Math.PI * r;
    const dash = (score / 100) * circ;
    return (
        <div className="score-card">
            <div className="score-ring">
                <svg width="90" height="90" viewBox="0 0 90 90">
                    <circle cx={cx} cy={cy} r={r} fill="none" stroke="rgba(255,255,255,0.06)" strokeWidth="7" />
                    <circle
                        cx={cx} cy={cy} r={r} fill="none"
                        stroke={color} strokeWidth="7"
                        strokeDasharray={`${dash} ${circ}`}
                        strokeLinecap="round"
                        style={{ transition: 'stroke-dasharray 1s ease' }}
                    />
                </svg>
                <div className="score-ring-text">{Math.round(score)}</div>
            </div>
            <div className="score-name">{label}</div>
        </div>
    );
}

// ── Spinner ───────────────────────────────────────────────────────────────
export function Spinner({ large }) {
    return <div className={`spinner${large ? ' spinner-lg' : ''}`} />;
}

// ── Audio Waves ───────────────────────────────────────────────────────────
export function AudioWaves() {
    return (
        <div className="audio-waves" aria-hidden="true">
            {[1, 2, 3, 4, 5].map(i => (
                <div key={i} className="bar" style={{ height: `${8 + i * 2}px` }} />
            ))}
        </div>
    );
}

// ── API base ─────────────────────────────────────────────────────────────
export const API_BASE = 'http://localhost:8000';

// ── Auth helpers ──────────────────────────────────────────────────────────
export function getToken() { return localStorage.getItem('token'); }
export function getUser() { try { return JSON.parse(localStorage.getItem('user')); } catch { return null; } }
export function setAuth(token, user) {
    localStorage.setItem('token', token);
    localStorage.setItem('user', JSON.stringify(user));
}
export function clearAuth() {
    localStorage.removeItem('token');
    localStorage.removeItem('user');
}

export function authHeaders() {
    const token = getToken();
    return token ? { Authorization: `Bearer ${token}` } : {};
}
