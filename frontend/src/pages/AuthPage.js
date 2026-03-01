import React, { useState } from 'react';
import axios from 'axios';
import { API_BASE, setAuth, useToast, Spinner } from '../utils';

export default function AuthPage({ onAuth }) {
    const [tab, setTab] = useState('login');
    const [loading, setLoading] = useState(false);
    const { showToast, ToastNode } = useToast();

    // Login state
    const [loginEmail, setLoginEmail] = useState('');
    const [loginPass, setLoginPass] = useState('');

    // Register state
    const [regName, setRegName] = useState('');
    const [regEmail, setRegEmail] = useState('');
    const [regPass, setRegPass] = useState('');
    const [regEdu, setRegEdu] = useState('');

    const handleLogin = async (e) => {
        e.preventDefault();
        if (!loginEmail || !loginPass) return showToast('Please fill in all fields', 'error');
        setLoading(true);
        try {
            const res = await axios.post(`${API_BASE}/api/auth/login-json`, {
                email: loginEmail, password: loginPass
            });
            setAuth(res.data.access_token, res.data.user);
            showToast('Welcome back! 🎉', 'success');
            setTimeout(() => onAuth(res.data.user), 700);
        } catch (err) {
            showToast(err.response?.data?.detail || 'Login failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    const handleRegister = async (e) => {
        e.preventDefault();
        if (!regName || !regEmail || !regPass) return showToast('Please fill in required fields', 'error');
        if (regPass.length < 6) return showToast('Password must be at least 6 characters', 'error');
        setLoading(true);
        try {
            await axios.post(`${API_BASE}/api/auth/register`, {
                name: regName, email: regEmail, password: regPass, education: regEdu
            });
            showToast('Account created! Please sign in.', 'success');
            setTab('login');
            setLoginEmail(regEmail);
        } catch (err) {
            showToast(err.response?.data?.detail || 'Registration failed', 'error');
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="app-wrapper">
            <div className="auth-page">
                <div className="auth-card">
                    <div className="auth-logo">
                        <div className="auth-logo-icon">🤖</div>
                        <div className="auth-title">AI Interview Simulator</div>
                        <div className="auth-subtitle">Practice smarter. Improve faster.</div>
                    </div>

                    <div className="auth-tabs">
                        <button className={`auth-tab ${tab === 'login' ? 'active' : ''}`}
                            onClick={() => setTab('login')}>Sign In</button>
                        <button className={`auth-tab ${tab === 'register' ? 'active' : ''}`}
                            onClick={() => setTab('register')}>Create Account</button>
                    </div>

                    {tab === 'login' ? (
                        <form className="auth-form" onSubmit={handleLogin}>
                            <div className="form-group">
                                <label className="form-label">Email Address</label>
                                <input className="form-input" type="email" placeholder="you@example.com"
                                    value={loginEmail} onChange={e => setLoginEmail(e.target.value)}
                                    required autoComplete="email" id="login-email" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password</label>
                                <input className="form-input" type="password" placeholder="Your password"
                                    value={loginPass} onChange={e => setLoginPass(e.target.value)}
                                    required autoComplete="current-password" id="login-password" />
                            </div>
                            <button id="login-btn" className="btn btn-primary" type="submit" disabled={loading}>
                                {loading ? <><Spinner /> Signing in...</> : '🚀 Sign In'}
                            </button>
                        </form>
                    ) : (
                        <form className="auth-form" onSubmit={handleRegister}>
                            <div className="form-group">
                                <label className="form-label">Full Name *</label>
                                <input className="form-input" type="text" placeholder="John Doe"
                                    value={regName} onChange={e => setRegName(e.target.value)}
                                    required id="reg-name" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Email Address *</label>
                                <input className="form-input" type="email" placeholder="you@example.com"
                                    value={regEmail} onChange={e => setRegEmail(e.target.value)}
                                    required id="reg-email" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Password * (min 6 chars)</label>
                                <input className="form-input" type="password" placeholder="Create a password"
                                    value={regPass} onChange={e => setRegPass(e.target.value)}
                                    required id="reg-password" />
                            </div>
                            <div className="form-group">
                                <label className="form-label">Education (optional)</label>
                                <input className="form-input" type="text"
                                    placeholder="e.g. B.Tech Computer Science"
                                    value={regEdu} onChange={e => setRegEdu(e.target.value)}
                                    id="reg-education" />
                            </div>
                            <button id="register-btn" className="btn btn-primary" type="submit" disabled={loading}>
                                {loading ? <><Spinner /> Creating account...</> : '✨ Create Account'}
                            </button>
                        </form>
                    )}
                </div>
            </div>
            {ToastNode}
        </div>
    );
}
