import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE, authHeaders, useToast, Spinner } from '../utils';

const TIME_SLOTS = [5, 10, 15, 20, 30, 45, 60];

const INTERVIEW_TYPES = [
    { id: 'technical', icon: '⚙️', name: 'Technical', desc: 'DSA, System Design, Coding' },
    { id: 'hr', icon: '🤝', name: 'HR Round', desc: 'Behavioral, Soft Skills' },
    { id: 'mixed', icon: '🎯', name: 'Mixed', desc: 'Technical + HR combined' },
];

const SKILLS_LIST = [
    'Python', 'JavaScript', 'React', 'Node.js', 'Java', 'C++', 'SQL',
    'Machine Learning', 'Data Science', 'System Design', 'AWS', 'Docker',
    'Kubernetes', 'REST APIs', 'TypeScript', 'MongoDB', 'PostgreSQL', 'Git',
    'Django', 'Spring Boot', 'Flutter', 'Android', 'iOS', 'DevOps',
];

export default function SetupPage({ user, onBack, onStarted }) {
    const [duration, setDuration] = useState(10);
    const [type, setType] = useState('mixed');
    const [skills, setSkills] = useState([]);
    const [customSkill, setCustomSkill] = useState('');
    const [resumeFile, setResumeFile] = useState(null);
    const [loading, setLoading] = useState(false);
    const [step, setStep] = useState(1); // 1 = config, 2 = uploading
    const { showToast, ToastNode } = useToast();

    const toggleSkill = (skill) => {
        setSkills(prev =>
            prev.includes(skill) ? prev.filter(s => s !== skill) : [...prev, skill]
        );
    };

    const addCustomSkill = () => {
        const s = customSkill.trim();
        if (s && !skills.includes(s)) {
            setSkills(prev => [...prev, s]);
            setCustomSkill('');
        }
    };

    const handleStart = async () => {
        if (!resumeFile) return showToast('Please upload your resume (PDF)', 'error');
        if (skills.length === 0) return showToast('Please select at least one skill', 'error');

        setLoading(true);
        setStep(2);

        try {
            // Create interview
            const setupRes = await axios.post(
                `${API_BASE}/api/interview/setup`,
                { duration_minutes: duration, interview_type: type, skills: skills.join(', ') },
                { headers: { ...authHeaders(), 'Content-Type': 'application/json' } }
            );
            const interviewId = setupRes.data.interview_id;

            // Upload resume + start
            const formData = new FormData();
            formData.append('file', resumeFile);
            const startRes = await axios.post(
                `${API_BASE}/api/interview/start/${interviewId}`,
                formData,
                { headers: { ...authHeaders() } }
            );

            showToast('Interview started!', 'success');
            onStarted({
                interviewId,
                firstQuestion: startRes.data.question,
                audioUrl: startRes.data.audio_url,
                duration,
                type,
                skills,
            });
        } catch (err) {
            console.error(err);
            showToast(err.response?.data?.detail || 'Failed to start. Is the backend running?', 'error');
            setLoading(false);
            setStep(1);
        }
    };

    return (
        <div className="app-wrapper">
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
                    <button className="btn btn-ghost btn-sm" onClick={onBack}>← Dashboard</button>
                </div>
            </header>

            <div className="setup-page">
                <div className="setup-card">
                    {step === 2 ? (
                        <div style={{ textAlign: 'center', padding: '40px 0' }}>
                            <Spinner large />
                            <div style={{ marginTop: 20, fontSize: '1rem', color: 'var(--text-secondary)' }}>
                                Analyzing your resume and preparing interview...
                            </div>
                            <div style={{ marginTop: 8, fontSize: '0.82rem', color: 'var(--text-muted)' }}>
                                This may take a moment
                            </div>
                        </div>
                    ) : (
                        <>
                            <div className="setup-title">🎯 Set Up Your Interview</div>
                            <div className="setup-subtitle">
                                Configure your mock interview parameters to get a personalized experience.
                            </div>

                            {/* Duration */}
                            <div className="setup-section">
                                <div className="setup-section-label">⏱ Interview Duration</div>
                                <div className="time-grid">
                                    {TIME_SLOTS.map(t => (
                                        <button
                                            key={t}
                                            className={`time-btn ${duration === t ? 'selected' : ''}`}
                                            onClick={() => setDuration(t)}
                                            id={`time-${t}`}
                                        >
                                            {t} min
                                        </button>
                                    ))}
                                </div>
                            </div>

                            {/* Interview Type */}
                            <div className="setup-section">
                                <div className="setup-section-label">📋 Interview Type</div>
                                <div className="type-grid">
                                    {INTERVIEW_TYPES.map(it => (
                                        <div
                                            key={it.id}
                                            className={`type-card ${type === it.id ? 'selected' : ''}`}
                                            onClick={() => setType(it.id)}
                                            id={`type-${it.id}`}
                                        >
                                            <div className="type-icon">{it.icon}</div>
                                            <div className="type-name">{it.name}</div>
                                            <div className="type-desc">{it.desc}</div>
                                        </div>
                                    ))}
                                </div>
                            </div>

                            {/* Skills */}
                            <div className="setup-section">
                                <div className="setup-section-label">🛠 Skills to be Assessed ({skills.length} selected)</div>
                                <div className="skills-grid" style={{ marginBottom: 10 }}>
                                    {SKILLS_LIST.map(s => (
                                        <button
                                            key={s}
                                            className={`skill-chip ${skills.includes(s) ? 'selected' : ''}`}
                                            onClick={() => toggleSkill(s)}
                                            id={`skill-${s.replace(/\s+/g, '-').toLowerCase()}`}
                                        >
                                            {s}
                                        </button>
                                    ))}
                                </div>
                                <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                                    <input
                                        className="form-input"
                                        type="text"
                                        placeholder="Add custom skill..."
                                        value={customSkill}
                                        onChange={e => setCustomSkill(e.target.value)}
                                        onKeyDown={e => e.key === 'Enter' && addCustomSkill()}
                                        style={{ flex: 1 }}
                                    />
                                    <button className="btn btn-outline btn-sm" style={{ width: 'auto' }} onClick={addCustomSkill}>
                                        ＋ Add
                                    </button>
                                </div>
                                {skills.length > 0 && (
                                    <div style={{ marginTop: 8, color: 'var(--accent-light)', fontSize: '0.78rem' }}>
                                        Selected: {skills.join(', ')}
                                    </div>
                                )}
                            </div>

                            {/* Resume Upload */}
                            <div className="setup-section">
                                <div className="setup-section-label">📄 Resume Upload</div>
                                <div className={`upload-zone ${resumeFile ? 'has-file' : ''}`}>
                                    <div className="upload-icon">{resumeFile ? '✅' : '📄'}</div>
                                    <div className="upload-text">
                                        {resumeFile
                                            ? <><strong>{resumeFile.name}</strong> — Ready to upload</>
                                            : <>Drop or click to upload your <strong>Resume (PDF)</strong></>
                                        }
                                    </div>
                                    <div className="upload-hint">Supported: PDF • Max 10MB</div>
                                    <input
                                        id="resume-upload"
                                        type="file"
                                        accept=".pdf"
                                        onChange={e => {
                                            const f = e.target.files[0];
                                            if (f && f.type === 'application/pdf') setResumeFile(f);
                                            else if (f) showToast('Please upload a PDF file', 'error');
                                        }}
                                        aria-label="Upload resume PDF"
                                    />
                                </div>
                            </div>

                            <button
                                id="begin-interview-btn"
                                className="btn btn-primary"
                                onClick={handleStart}
                                disabled={loading}
                            >
                                {loading ? <><Spinner /> Starting...</> : '🚀 Begin Interview'}
                            </button>
                        </>
                    )}
                </div>
            </div>
            {ToastNode}
        </div>
    );
}
