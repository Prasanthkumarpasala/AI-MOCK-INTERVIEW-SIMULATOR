import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE, authHeaders, useToast, ScoreRing, Spinner } from '../utils';

const categoryIcons = {
    Technical: '⚙️',
    Communication: '💬',
    Behavioral: '🧠',
};

const priorityColors = {
    High: 'badge-danger',
    Medium: 'badge-warning',
    Low: 'badge-accent',
};

const scoreColors = ['#6366f1', '#10b981', '#f59e0b', '#ec4899'];

export default function ReportPage({ user, interviewId, onBack, onNewInterview }) {
    const [data, setData] = useState(null);
    const [loading, setLoading] = useState(true);
    const [activeTab, setActiveTab] = useState('overview');
    const { showToast, ToastNode } = useToast();

    useEffect(() => {
        fetchReport();
    }, [interviewId]);

    const fetchReport = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/report/${interviewId}`, { headers: authHeaders() });
            setData(res.data);
        } catch (err) {
            if (err.response?.status === 404) {
                // Report not ready yet — retry after 3s
                setTimeout(fetchReport, 3000);
                return;
            }
            showToast('Failed to load report', 'error');
        } finally {
            setLoading(false);
        }
    };

    const downloadPDF = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/report/${interviewId}/download`, {
                headers: authHeaders(),
                responseType: 'blob',
            });
            const url = window.URL.createObjectURL(new Blob([res.data]));
            const a = document.createElement('a');
            a.href = url;
            a.download = `interview_report_${interviewId}.pdf`;
            a.click();
            window.URL.revokeObjectURL(url);
        } catch {
            showToast('PDF not available yet', 'error');
        }
    };

    const getScoreGrade = (s) => {
        if (s >= 90) return { grade: 'A+', color: '#10b981' };
        if (s >= 80) return { grade: 'A', color: '#10b981' };
        if (s >= 70) return { grade: 'B', color: '#6366f1' };
        if (s >= 60) return { grade: 'C', color: '#f59e0b' };
        return { grade: 'D', color: '#ef4444' };
    };

    if (loading) {
        return (
            <div className="app-wrapper">
                <div style={{ flex: 1, display: 'flex', flexDirection: 'column', alignItems: 'center', justifyContent: 'center', gap: 20 }}>
                    <Spinner large />
                    <div style={{ color: 'var(--text-secondary)', fontSize: '1rem' }}>Generating your personalized report…</div>
                    <div style={{ color: 'var(--text-muted)', fontSize: '0.82rem' }}>Analyzing answers and creating learning path</div>
                </div>
            </div>
        );
    }

    if (!data) {
        return (
            <div className="app-wrapper">
                <div className="empty-state">
                    <div className="empty-icon">😕</div>
                    <div className="empty-title">Report not available</div>
                    <button className="btn btn-primary btn-sm" style={{ width: 'auto', marginTop: 12 }} onClick={onBack}>
                        ← Go Back
                    </button>
                </div>
            </div>
        );
    }

    const { report, interview, transcript, user: reportUser } = data;
    const scores = [
        { label: 'Overall', value: report.overall_score, color: scoreColors[0] },
        { label: 'Technical', value: report.technical_score, color: scoreColors[1] },
        { label: 'Communication', value: report.communication_score, color: scoreColors[2] },
        { label: 'HR & Behavior', value: report.hr_score, color: scoreColors[3] },
    ];

    const { grade, color: gradeColor } = getScoreGrade(report.overall_score);

    return (
        <div className="app-wrapper">
            {/* Header */}
            <header className="header" role="banner">
                <a href="#" className="logo">
                    <div className="logo-icon">🤖</div>
                    <span className="logo-text">AI Interview Simulator</span>
                </a>
                <div className="header-right">
                    <button className="btn btn-ghost btn-sm" onClick={onBack}>← Dashboard</button>
                    <button className="btn btn-outline btn-sm" style={{ width: 'auto' }} onClick={downloadPDF}>
                        ⬇ Download PDF
                    </button>
                    <button className="btn btn-primary btn-sm" style={{ width: 'auto' }} onClick={onNewInterview}>
                        ＋ New Interview
                    </button>
                </div>
            </header>

            <main className="report-page">
                {/* Hero */}
                <div className="report-hero">
                    <div className="report-title">🎉 Interview Complete!</div>
                    <div className="report-meta">
                        {reportUser?.name} •{' '}
                        {interview?.interview_type?.toUpperCase()} Interview •{' '}
                        {interview?.duration_minutes} min •{' '}
                        {interview?.skills}
                    </div>
                    <div style={{ marginTop: 14, display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 12 }}>
                        <span style={{
                            fontSize: '3rem', fontWeight: 900, color: gradeColor, lineHeight: 1
                        }}>{grade}</span>
                        <div>
                            <div style={{ fontSize: '0.8rem', color: 'var(--text-muted)' }}>Overall Grade</div>
                            <div style={{ fontSize: '1.5rem', fontWeight: 800, color: gradeColor }}>
                                {Math.round(report.overall_score)}/100
                            </div>
                        </div>
                    </div>
                </div>

                {/* Tabs */}
                <div style={{ display: 'flex', gap: 4, borderBottom: '1px solid var(--border)', marginBottom: 24 }}>
                    {['overview', 'feedback', 'learning-path', 'transcript'].map(t => (
                        <button key={t}
                            style={{
                                padding: '10px 16px', border: 'none', cursor: 'pointer', fontFamily: 'inherit',
                                fontSize: '0.85rem', fontWeight: 600,
                                color: activeTab === t ? 'var(--accent-light)' : 'var(--text-muted)',
                                background: 'transparent',
                                borderBottom: activeTab === t ? '2px solid var(--accent)' : '2px solid transparent',
                                transition: 'all 0.2s',
                            }}
                            onClick={() => setActiveTab(t)}>
                            {t === 'overview' ? '📊 Overview' :
                                t === 'feedback' ? '💬 Feedback' :
                                    t === 'learning-path' ? '🎯 Learning Path' : '📝 Transcript'}
                        </button>
                    ))}
                </div>

                {/* Overview Tab */}
                {activeTab === 'overview' && (
                    <>
                        <div className="scores-grid" style={{ marginBottom: 24 }}>
                            {scores.map(s => (
                                <ScoreRing key={s.label} score={s.value} color={s.color} label={s.label} />
                            ))}
                        </div>

                        <div className="card" style={{ marginBottom: 20 }}>
                            <div className="card-header">
                                <div className="card-title">📋 Overall Assessment</div>
                            </div>
                            <div className="card-body">
                                <div className="summary-box">{report.summary}</div>
                            </div>
                        </div>

                        <div className="feedback-grid">
                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">✅ Strengths</div>
                                </div>
                                <div className="card-body">
                                    <ul className="feedback-list strengths">
                                        {(report.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            </div>
                            <div className="card">
                                <div className="card-header">
                                    <div className="card-title">📈 Areas to Improve</div>
                                </div>
                                <div className="card-body">
                                    <ul className="feedback-list improvements">
                                        {(report.improvements || []).map((s, i) => <li key={i}>{s}</li>)}
                                    </ul>
                                </div>
                            </div>
                        </div>
                    </>
                )}

                {/* Feedback Tab */}
                {activeTab === 'feedback' && (
                    <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
                        <div className="card">
                            <div className="card-header"><div className="card-title">💬 Detailed Feedback</div></div>
                            <div className="card-body">
                                <div className="summary-box" style={{ marginBottom: 16 }}>{report.summary}</div>
                                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10, color: 'var(--success)' }}>✅ Strengths</div>
                                        <ul className="feedback-list strengths">
                                            {(report.strengths || []).map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                    <div>
                                        <div style={{ fontWeight: 700, fontSize: '0.85rem', marginBottom: 10, color: 'var(--warning)' }}>📈 Improvements</div>
                                        <ul className="feedback-list improvements">
                                            {(report.improvements || []).map((s, i) => <li key={i}>{s}</li>)}
                                        </ul>
                                    </div>
                                </div>
                            </div>
                        </div>

                        {interview?.warning_count > 0 && (
                            <div className="card" style={{ borderColor: 'rgba(239,68,68,0.3)' }}>
                                <div className="card-header"><div className="card-title">⚠️ Proctoring Violations</div></div>
                                <div className="card-body">
                                    <p style={{ color: 'var(--text-secondary)', fontSize: '0.88rem' }}>
                                        You received <strong style={{ color: 'var(--danger)' }}>{interview.warning_count} proctoring warning(s)</strong> during this session.
                                        {interview.status === 'terminated' && ' The interview was automatically terminated.'}
                                    </p>
                                    <p style={{ color: 'var(--text-muted)', fontSize: '0.8rem', marginTop: 10 }}>
                                        Tip: Sit straight, face the camera directly, ensure only you are visible, and maintain a quiet environment.
                                    </p>
                                </div>
                            </div>
                        )}
                    </div>
                )}

                {/* Learning Path Tab */}
                {activeTab === 'learning-path' && (
                    <div>
                        <div style={{ marginBottom: 20, padding: '14px 18px', background: 'rgba(99,102,241,0.06)', border: '1px solid rgba(99,102,241,0.15)', borderRadius: 10 }}>
                            <div style={{ fontWeight: 700, marginBottom: 4, color: 'var(--accent-light)' }}>🎯 Your Personalized Learning Path</div>
                            <div style={{ fontSize: '0.85rem', color: 'var(--text-secondary)' }}>
                                Based on your interview performance, skills, and areas for improvement, here's what to focus on next.
                            </div>
                        </div>
                        <div className="lp-grid">
                            {(report.learning_path || []).map((item, i) => (
                                <div key={i} className="lp-item">
                                    <div className="lp-category-icon">{categoryIcons[item.category] || '📚'}</div>
                                    <div className="lp-content">
                                        <div className="lp-header">
                                            <div className="lp-topic">{item.topic}</div>
                                            <span className={`badge ${priorityColors[item.priority] || 'badge-muted'}`}>
                                                {item.priority}
                                            </span>
                                            <span className="badge badge-muted">~{item.estimated_hours}h</span>
                                            <span className="badge badge-accent">{item.category}</span>
                                        </div>
                                        <div className="lp-desc">{item.description}</div>
                                        {item.resources?.length > 0 && (
                                            <div className="lp-resources">📚 {item.resources.join(' • ')}</div>
                                        )}
                                    </div>
                                </div>
                            ))}
                        </div>
                        <div style={{ marginTop: 24, textAlign: 'center' }}>
                            <button className="btn btn-primary" style={{ width: 'auto', padding: '12px 28px' }} onClick={onNewInterview}>
                                🔄 Retake Interview to Track Improvement
                            </button>
                        </div>
                    </div>
                )}

                {/* Transcript Tab */}
                {activeTab === 'transcript' && (
                    <div className="card">
                        <div className="card-header">
                            <div className="card-title">📝 Full Transcript</div>
                            <span className="badge badge-muted">{transcript?.length} messages</span>
                        </div>
                        <div className="transcript-full">
                            {(transcript || []).map((msg, i) => (
                                <div key={i} className={`transcript-msg ${msg.role}`}>
                                    <div className="msg-label">{msg.role === 'ai' ? '🤖 AI Interviewer' : '🧑 You'}</div>
                                    {msg.content}
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
            {ToastNode}
        </div>
    );
}
