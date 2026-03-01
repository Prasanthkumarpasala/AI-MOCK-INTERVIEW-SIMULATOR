import React, { useState, useEffect } from 'react';
import axios from 'axios';
import { API_BASE, authHeaders, useToast, clearAuth, Spinner } from '../utils';

export default function DashboardPage({ user, onStartInterview, onViewReport, onLogout }) {
    const [interviews, setInterviews] = useState([]);
    const [loading, setLoading] = useState(true);
    const { showToast, ToastNode } = useToast();

    useEffect(() => {
        fetchHistory();
    }, []);

    const fetchHistory = async () => {
        try {
            const res = await axios.get(`${API_BASE}/api/interview/history`, { headers: authHeaders() });
            setInterviews(res.data.interviews || []);
        } catch (err) {
            showToast('Failed to load history', 'error');
        } finally {
            setLoading(false);
        }
    };

    const deleteInterview = async (id) => {
        if (!window.confirm(`Delete interview #${id}? This cannot be undone.`)) return;
        try {
            await axios.delete(`${API_BASE}/api/interview/${id}`, { headers: authHeaders() });
            showToast(`Interview #${id} deleted`, 'success');
            fetchHistory();
        } catch (err) {
            showToast(err.response?.data?.detail || 'Delete failed', 'error');
        }
    };

    const handleLogout = () => {
        clearAuth();
        onLogout();
    };

    // Stats
    const completed = interviews.filter(i => i.status === 'completed');
    const avgScore = completed.length
        ? Math.round(completed.reduce((a, b) => a + (b.overall_score || 0), 0) / completed.length)
        : 0;
    const lastScore = completed.length ? (completed[0]?.overall_score || 0) : 0;
    const prevScore = completed.length > 1 ? (completed[1]?.overall_score || 0) : 0;
    const improvement = completed.length > 1 ? Math.round(lastScore - prevScore) : 0;

    const statusBadge = (status) => {
        const map = {
            completed: { cls: 'badge-success', label: '✅ Completed' },
            active: { cls: 'badge-accent', label: '🔴 In Progress' },
            terminated: { cls: 'badge-danger', label: '🚫 Terminated' },
            setup: { cls: 'badge-muted', label: '⚙️ Setup' },
        };
        const b = map[status] || { cls: 'badge-muted', label: status };
        return <span className={`badge ${b.cls}`}>{b.label}</span>;
    };

    const scorePill = (score) => {
        if (score == null) return <span className="badge badge-muted">N/A</span>;
        const cls = score >= 75 ? 'high' : score >= 50 ? 'medium' : 'low';
        return <span className={`score-pill ${cls}`}>{Math.round(score)}/100</span>;
    };

    const formatDate = (ts) => {
        if (!ts) return '—';
        return new Date(ts).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
    };

    return (
        <div className="app-wrapper">
            {/* Header */}
            <header className="header" role="banner">
                <a href="#" className="logo">
                    <div className="logo-icon" aria-hidden="true">🤖</div>
                    <span className="logo-text">AI Interview Simulator</span>
                </a>
                <div className="header-right">
                    <div className="user-chip">
                        <div className="user-avatar">{user?.name?.[0]?.toUpperCase() || 'U'}</div>
                        {user?.name}
                    </div>
                    <button className="btn btn-ghost btn-sm" onClick={handleLogout}>Sign Out</button>
                </div>
            </header>

            <main className="dashboard-page">
                {/* Hero */}
                <div className="dashboard-hero">
                    <div>
                        <div className="dashboard-welcome">Welcome back, {user?.name?.split(' ')[0]} 👋</div>
                        <div className="dashboard-sub">
                            {completed.length === 0
                                ? "You haven't taken any interviews yet. Start your first one!"
                                : `You've completed ${completed.length} interview${completed.length !== 1 ? 's' : ''}. Keep improving!`}
                        </div>
                    </div>
                    <button id="start-interview-btn" className="btn btn-primary btn-sm"
                        style={{ width: 'auto', padding: '12px 24px' }}
                        onClick={onStartInterview}>
                        ＋ New Interview
                    </button>
                </div>

                {/* Stats */}
                <div className="stats-grid">
                    <div className="stat-card">
                        <div className="stat-icon">📋</div>
                        <div className="stat-value">{interviews.length}</div>
                        <div className="stat-label">Total Interviews</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">✅</div>
                        <div className="stat-value">{completed.length}</div>
                        <div className="stat-label">Completed</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📊</div>
                        <div className="stat-value">{avgScore || '—'}</div>
                        <div className="stat-label">Avg Score</div>
                    </div>
                    <div className="stat-card">
                        <div className="stat-icon">📈</div>
                        <div className="stat-value" style={{ color: improvement > 0 ? 'var(--success)' : improvement < 0 ? 'var(--danger)' : undefined }}>
                            {improvement > 0 ? `+${improvement}` : improvement === 0 ? '—' : improvement}
                        </div>
                        <div className="stat-label">Score Change</div>
                        {improvement !== 0 && (
                            <div className={`stat-change ${improvement > 0 ? 'up' : 'down'}`}>
                                {improvement > 0 ? '↑ Improving!' : '↓ Needs work'}
                            </div>
                        )}
                    </div>
                </div>

                {/* Interview History */}
                <div className="card">
                    <div className="card-header">
                        <div className="card-title">📋 Interview History</div>
                        <button className="btn btn-ghost btn-sm" onClick={fetchHistory}>↻ Refresh</button>
                    </div>
                    {loading ? (
                        <div className="empty-state"><Spinner large /></div>
                    ) : interviews.length === 0 ? (
                        <div className="empty-state">
                            <div className="empty-icon">📭</div>
                            <div className="empty-title">No interviews yet</div>
                            <div className="empty-desc">Click "New Interview" to get started</div>
                        </div>
                    ) : (
                        <div style={{ overflowX: 'auto' }}>
                            <table className="history-table">
                                <thead>
                                    <tr>
                                        <th>#</th>
                                        <th>Type</th>
                                        <th>Skills</th>
                                        <th>Duration</th>
                                        <th>Score</th>
                                        <th>Status</th>
                                        <th>Date</th>
                                        <th>Action</th>
                                    </tr>
                                </thead>
                                <tbody>
                                    {interviews.map((iv, idx) => (
                                        <tr key={iv.id}>
                                            <td style={{ color: 'var(--text-muted)', fontWeight: 500 }}>#{iv.id}</td>
                                            <td>
                                                <span className="badge badge-accent" style={{ textTransform: 'capitalize' }}>
                                                    {iv.interview_type}
                                                </span>
                                            </td>
                                            <td style={{ maxWidth: 140, overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
                                                {iv.skills || '—'}
                                            </td>
                                            <td>{iv.duration_minutes} min</td>
                                            <td>{scorePill(iv.overall_score)}</td>
                                            <td>{statusBadge(iv.status)}</td>
                                            <td>{formatDate(iv.created_at)}</td>
                                            <td>
                                                <div style={{ display: 'flex', gap: 6, alignItems: 'center' }}>
                                                    {(iv.status === 'completed' || iv.status === 'terminated') && iv.report_id ? (
                                                        <button className="btn btn-ghost btn-sm"
                                                            onClick={() => onViewReport(iv.id)}>
                                                            📄 Report
                                                        </button>
                                                    ) : iv.status === 'active' ? (
                                                        <span style={{ color: 'var(--text-muted)', fontSize: '0.78rem' }}>In progress</span>
                                                    ) : null}
                                                    {(iv.status === 'setup' || iv.status === 'active') && (
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ color: 'var(--danger)', padding: '4px 10px' }}
                                                            onClick={() => deleteInterview(iv.id)}
                                                            title="Delete this interview"
                                                        >
                                                            🗑
                                                        </button>
                                                    )}
                                                    {iv.status !== 'setup' && iv.status !== 'active' && !iv.report_id && (
                                                        <button
                                                            className="btn btn-ghost btn-sm"
                                                            style={{ color: 'var(--danger)', padding: '4px 10px' }}
                                                            onClick={() => deleteInterview(iv.id)}
                                                            title="Delete this interview"
                                                        >
                                                            🗑
                                                        </button>
                                                    )}
                                                </div>
                                            </td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    )}
                </div>
            </main>
            {ToastNode}
        </div>
    );
}
