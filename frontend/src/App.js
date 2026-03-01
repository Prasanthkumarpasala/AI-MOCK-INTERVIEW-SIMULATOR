import React, { useState, useEffect } from 'react';
import './App.css';
import { getUser, clearAuth } from './utils';
import AuthPage from './pages/AuthPage';
import DashboardPage from './pages/DashboardPage';
import SetupPage from './pages/SetupPage';
import InterviewPage from './pages/InterviewPage';
import ReportPage from './pages/ReportPage';

/**
 * App — Simple in-memory router.
 * Pages: auth | dashboard | setup | interview | report
 */
export default function App() {
  const [page, setPage] = useState('auth');
  const [user, setUser] = useState(null);
  const [interviewConfig, setConfig] = useState(null);   // from SetupPage
  const [activeInterview, setActive] = useState(null);   // interview_id
  const [reportInterview, setReport] = useState(null);   // interview_id for report

  // Restore session
  useEffect(() => {
    const u = getUser();
    if (u) {
      setUser(u);
      setPage('dashboard');
    }
  }, []);

  // ── Auth ──────────────────────────────────────────────────────────────────
  const handleAuth = (u) => {
    setUser(u);
    setPage('dashboard');
  };

  const handleLogout = () => {
    clearAuth();
    setUser(null);
    setPage('auth');
  };

  // ── Navigation ────────────────────────────────────────────────────────────
  const goSetup = () => setPage('setup');
  const goBack = () => setPage('dashboard');

  const handleSetupDone = (config) => {
    setConfig(config);
    setActive(config.interviewId);
    setPage('interview');
  };

  const handleInterviewFinished = (interviewId) => {
    setActive(null);
    setReport(interviewId);
    setPage('report');
  };

  const handleViewReport = (interviewId) => {
    setReport(interviewId);
    setPage('report');
  };

  const handleNewInterview = () => {
    setConfig(null);
    setActive(null);
    setReport(null);
    setPage('setup');
  };

  // ── Render ────────────────────────────────────────────────────────────────
  if (page === 'auth')
    return <AuthPage onAuth={handleAuth} />;

  if (page === 'dashboard')
    return (
      <DashboardPage
        user={user}
        onStartInterview={goSetup}
        onViewReport={handleViewReport}
        onLogout={handleLogout}
      />
    );

  if (page === 'setup')
    return (
      <SetupPage
        user={user}
        onBack={goBack}
        onStarted={handleSetupDone}
      />
    );

  if (page === 'interview' && interviewConfig)
    return (
      <InterviewPage
        user={user}
        config={interviewConfig}
        onFinished={handleInterviewFinished}
      />
    );

  if (page === 'report' && reportInterview)
    return (
      <ReportPage
        user={user}
        interviewId={reportInterview}
        onBack={goBack}
        onNewInterview={handleNewInterview}
      />
    );

  // Fallback
  return <AuthPage onAuth={handleAuth} />;
}