import React, { useState, useEffect } from 'react';
import {
  ShieldAlert,
  ShieldCheck,
  Ban,
  Lock,
  Unlock,
  AlertTriangle,
  UserX,
  CheckCircle2,
  Users,
  Activity,
  BarChart3,
  RefreshCw,
  Sparkles,
  Search,
} from 'lucide-react';
import type { ModerationReport, AdminAnalytics, UserProfile, AccountStatus } from '../types';
import { api } from '../services/api';

interface AdminPortalProps {
  currentUser: UserProfile;
  onUserUpdate: (updated: UserProfile) => void;
}

export const AdminPortal: React.FC<AdminPortalProps> = ({ currentUser, onUserUpdate }) => {
  const [reports, setReports] = useState<ModerationReport[]>([]);
  const [analytics, setAnalytics] = useState<AdminAnalytics | null>(null);
  const [suggestions, setSuggestions] = useState<any[]>([]);
  const [selectedReport, setSelectedReport] = useState<ModerationReport | null>(null);
  const [actionReason, setActionReason] = useState<string>('');
  const [isLoading, setIsLoading] = useState<boolean>(false);
  const [filterSeverity, setFilterSeverity] = useState<string>('ALL');
  const [statusMessage, setStatusMessage] = useState<string | null>(null);
  const [activeAdminTab, setActiveAdminTab] = useState<'incidents' | 'suggestions'>('incidents');

  useEffect(() => {
    loadAdminData();
  }, []);

  const loadAdminData = async () => {
    setIsLoading(true);
    try {
      const [reportsData, analyticsData, suggestionsData] = await Promise.all([
        api.getAdminReports(),
        api.getAdminAnalytics(),
        api.getCommunitySuggestions(),
      ]);
      setReports(reportsData);
      setAnalytics(analyticsData);
      setSuggestions(suggestionsData);
      if (reportsData.length > 0 && !selectedReport) {
        setSelectedReport(reportsData[0]);
      }
    } catch (err) {
      console.error('Failed to load admin data:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const handleReviewSuggestion = async (id: string, action: 'APPROVE' | 'DECLINE') => {
    try {
      const res = await api.reviewCommunitySuggestion(id, action);
      if (res.suggestion) {
        setSuggestions((prev) =>
          prev.map((s) => (s.id === id ? res.suggestion : s))
        );
        setStatusMessage(
          action === 'APPROVE'
            ? `Proposal approved! Live Community Circle has been launched.`
            : `Proposal declined.`
        );
        setTimeout(() => setStatusMessage(null), 4000);
      }
    } catch (err: any) {
      alert(err.message || 'Failed to review suggestion');
    }
  };

  const handleAdminAction = async (
    reportId: string,
    action: 'WARN' | 'SUSPEND' | 'BAN' | 'RESOLVE' | 'REINSTATE'
  ) => {
    try {
      const res = await api.takeAdminAction(reportId, action, actionReason);
      if (res.success) {
        setReports((prev) => prev.map((r) => (r.id === reportId ? res.report : r)));
        setSelectedReport(res.report);
        setActionReason('');
        setStatusMessage(`Action "${action}" applied successfully.`);
        setTimeout(() => setStatusMessage(null), 3000);

        // If target was current user, update state
        if (res.targetUser && res.targetUser.id === currentUser.id) {
          onUserUpdate(res.targetUser);
        }

        // Refresh analytics
        const updatedAnalytics = await api.getAdminAnalytics();
        setAnalytics(updatedAnalytics);
      }
    } catch (err) {
      console.error('Admin action failed:', err);
    }
  };

  const handleSimulateAlert = async (type: 'CRISIS' | 'ABUSE') => {
    try {
      const newReport = await api.simulateAdminAlert(type);
      setReports([newReport, ...reports]);
      setSelectedReport(newReport);
      setStatusMessage(`Simulated live AI ${type} incident flagged in queue.`);
      setTimeout(() => setStatusMessage(null), 3000);

      const updatedAnalytics = await api.getAdminAnalytics();
      setAnalytics(updatedAnalytics);
    } catch (err) {
      console.error('Simulation error:', err);
    }
  };

  const filteredReports = reports.filter((r) => {
    if (filterSeverity === 'ALL') return true;
    if (filterSeverity === 'UNRESOLVED') return !r.resolved;
    return r.severity === filterSeverity;
  });

  return (
    <div className="max-w-7xl mx-auto px-4 sm:px-6 py-6 space-y-8">
      {/* Admin Safety Console Header */}
      <div className="bg-stone-900 text-stone-100 rounded-2xl p-6 shadow-sm flex flex-col md:flex-row md:items-center justify-between gap-6">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <ShieldAlert className="w-5 h-5 text-rose-500" />
            <h2 className="text-xl font-bold font-serif text-white">
              AI Safety Monitoring & Abuse Administration
            </h2>
          </div>
          <p className="text-xs text-stone-400 max-w-2xl leading-relaxed">
            Real-time oversight of intercepted boundary breaches, abusive behavior, and critical self-harm flags. Admins receive sanitized metadata and incident snippets while maintaining zero-knowledge user diary privacy.
          </p>
        </div>

        {/* Live Simulation Controls */}
        <div className="flex flex-wrap items-center gap-2 shrink-0">
          <button
            onClick={() => handleSimulateAlert('CRISIS')}
            className="px-3 py-1.5 bg-rose-950/80 hover:bg-rose-900 text-rose-200 border border-rose-800 rounded-lg text-xs font-medium transition-colors"
          >
            + Test Crisis Alert (988)
          </button>
          <button
            onClick={() => handleSimulateAlert('ABUSE')}
            className="px-3 py-1.5 bg-amber-950/80 hover:bg-amber-900 text-amber-200 border border-amber-800 rounded-lg text-xs font-medium transition-colors"
          >
            + Test Abusive Harassment Alert
          </button>
          <button
            onClick={loadAdminData}
            title="Refresh Data"
            className="p-1.5 text-stone-400 hover:text-white rounded-lg hover:bg-stone-800 transition-colors"
          >
            <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
          </button>
        </div>
      </div>

      {statusMessage && (
        <div className="p-3 bg-teal-50 border border-teal-200 text-teal-900 rounded-xl text-xs font-medium">
          {statusMessage}
        </div>
      )}

      {/* Safety & Health Analytics Overview */}
      {analytics && (
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Total Users
            </span>
            <div className="text-2xl font-bold font-serif text-stone-900 tabular-nums">
              {analytics.totalUsers}
            </div>
            <div className="text-[11px] text-stone-500">Active Sanctuary Members</div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Open Safety Reports
            </span>
            <div className="text-2xl font-bold font-serif text-rose-700 tabular-nums">
              {analytics.openReports}
            </div>
            <div className="text-[11px] text-stone-500">Requiring Action / Review</div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Platform Mood Score
            </span>
            <div className="text-2xl font-bold font-serif text-teal-800 tabular-nums">
              {analytics.averageMoodScore} / 10
            </div>
            <div className="text-[11px] text-stone-500">App-Wide Average</div>
          </div>

          <div className="bg-white border border-stone-200 rounded-2xl p-4 shadow-xs space-y-1">
            <span className="text-[11px] font-semibold uppercase tracking-wider text-stone-400">
              Check-In Adherence
            </span>
            <div className="text-2xl font-bold font-serif text-stone-900 tabular-nums">
              {analytics.checkInCompletionRate}%
            </div>
            <div className="text-[11px] text-stone-500">7-Day Engagement Rate</div>
          </div>
        </div>
      )}

      {/* Sub-tab Switcher: AI Incidents vs Community Suggestions */}
      <div className="flex items-center gap-2 border-b border-stone-200 pb-3">
        <button
          onClick={() => setActiveAdminTab('incidents')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors ${
            activeAdminTab === 'incidents'
              ? 'bg-stone-900 text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          AI Incident Queue & Safety Flags ({reports.filter((r) => !r.resolved).length} Pending)
        </button>
        <button
          onClick={() => setActiveAdminTab('suggestions')}
          className={`px-4 py-2 rounded-xl text-xs font-semibold transition-colors flex items-center gap-1.5 ${
            activeAdminTab === 'suggestions'
              ? 'bg-[#C86D51] text-white shadow-xs'
              : 'bg-stone-100 text-stone-600 hover:bg-stone-200'
          }`}
        >
          <span>Community Circle Proposals</span>
          <span className="font-mono text-[10px] bg-white/30 px-1.5 py-0.5 rounded-full font-bold">
            {suggestions.filter((s) => s.status === 'PENDING').length}
          </span>
        </button>
      </div>

      {/* 1. COMMUNITY SUGGESTIONS VIEW */}
      {activeAdminTab === 'suggestions' && (
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <div>
              <h3 className="text-sm font-bold text-stone-900 font-serif">
                User-Submitted Community Circle Proposals ({suggestions.length})
              </h3>
              <p className="text-xs text-stone-500">
                Review ideas submitted by users. Approving a proposal automatically creates and launches the live circle!
              </p>
            </div>
            <button
              onClick={loadAdminData}
              className="p-1.5 text-stone-500 hover:text-stone-900 rounded-lg hover:bg-stone-100 transition-colors"
            >
              <RefreshCw className={`w-4 h-4 ${isLoading ? 'animate-spin' : ''}`} />
            </button>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            {suggestions.length === 0 ? (
              <div className="col-span-2 p-10 bg-white border border-stone-200 rounded-2xl text-center text-xs text-stone-500">
                No community proposals submitted yet.
              </div>
            ) : (
              suggestions.map((sug) => {
                const isPending = sug.status === 'PENDING';
                const isApproved = sug.status === 'APPROVED';

                return (
                  <div
                    key={sug.id}
                    className="bg-white border border-stone-200 rounded-2xl p-5 shadow-xs space-y-3 flex flex-col justify-between"
                  >
                    <div className="space-y-2">
                      <div className="flex items-center justify-between text-xs">
                        <span className="font-mono text-[10px] uppercase tracking-wider text-[#C86D51] font-bold">
                          {sug.category}
                        </span>
                        <span
                          className={`px-2 py-0.5 rounded-full text-[10px] font-bold ${
                            isApproved
                              ? 'bg-emerald-50 text-emerald-800 border border-emerald-200'
                              : isPending
                              ? 'bg-amber-50 text-amber-800 border border-amber-200'
                              : 'bg-stone-100 text-stone-600'
                          }`}
                        >
                          {sug.status}
                        </span>
                      </div>

                      <h4 className="text-sm font-bold text-stone-900 font-serif">
                        {sug.name}
                      </h4>

                      <p className="text-xs text-stone-600 leading-relaxed">
                        {sug.description}
                      </p>

                      {sug.proposedFirstDiscussion && (
                        <div className="p-2.5 bg-stone-50 border border-stone-200 rounded-xl text-xs space-y-0.5 text-stone-700">
                          <span className="text-[10px] font-bold uppercase tracking-wider text-stone-400">
                            Proposed Kickoff Question:
                          </span>
                          <p className="italic">"{sug.proposedFirstDiscussion}"</p>
                        </div>
                      )}

                      <div className="text-[11px] text-stone-400 pt-1">
                        Proposed by: <strong className="text-stone-700">{sug.userName}</strong> ·{' '}
                        {new Date(sug.createdAt).toLocaleDateString(undefined, {
                          month: 'short',
                          day: 'numeric',
                        })}
                      </div>
                    </div>

                    {/* Action buttons */}
                    {isPending && (
                      <div className="flex items-center justify-end gap-2 pt-2 border-t border-stone-100">
                        <button
                          onClick={() => handleReviewSuggestion(sug.id, 'DECLINE')}
                          className="px-3 py-1.5 bg-stone-100 hover:bg-stone-200 text-stone-700 rounded-lg text-xs font-medium transition-colors"
                        >
                          Decline
                        </button>
                        <button
                          onClick={() => handleReviewSuggestion(sug.id, 'APPROVE')}
                          className="px-4 py-1.5 bg-emerald-700 hover:bg-emerald-800 text-white rounded-lg text-xs font-semibold shadow-xs flex items-center gap-1 transition-colors"
                        >
                          <CheckCircle2 className="w-3.5 h-3.5" />
                          <span>Approve & Launch Circle</span>
                        </button>
                      </div>
                    )}
                  </div>
                );
              })
            )}
          </div>
        </div>
      )}

      {/* 2. INCIDENTS VIEW */}
      {activeAdminTab === 'incidents' && (
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6 items-start">
        {/* Left Column: Flagged Incidents Queue */}
        <div className="space-y-4">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-semibold uppercase tracking-wider text-stone-500">
              AI Incident Queue ({filteredReports.length})
            </h3>

            {/* Filter buttons */}
            <div className="flex items-center gap-1 text-[11px]">
              <button
                onClick={() => setFilterSeverity('ALL')}
                className={`px-2 py-0.5 rounded-sm transition-colors ${
                  filterSeverity === 'ALL' ? 'bg-stone-900 text-white' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                All
              </button>
              <button
                onClick={() => setFilterSeverity('UNRESOLVED')}
                className={`px-2 py-0.5 rounded-sm transition-colors ${
                  filterSeverity === 'UNRESOLVED' ? 'bg-rose-700 text-white' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Pending
              </button>
              <button
                onClick={() => setFilterSeverity('CRITICAL')}
                className={`px-2 py-0.5 rounded-sm transition-colors ${
                  filterSeverity === 'CRITICAL' ? 'bg-rose-700 text-white' : 'text-stone-500 hover:text-stone-900'
                }`}
              >
                Crisis
              </button>
            </div>
          </div>

          <div className="space-y-2 max-h-[600px] overflow-y-auto">
            {filteredReports.map((report) => {
              const isSelected = selectedReport?.id === report.id;
              const isCritical = report.severity === 'CRITICAL';

              return (
                <button
                  key={report.id}
                  onClick={() => setSelectedReport(report)}
                  className={`w-full text-left p-3.5 rounded-2xl transition-all border ${
                    isSelected
                      ? 'bg-white border-stone-800 shadow-sm'
                      : 'bg-stone-50 border-stone-200 hover:bg-white text-stone-700'
                  }`}
                >
                  <div className="flex items-center justify-between text-xs">
                    <span
                      className={`font-semibold font-mono text-[10px] uppercase tracking-wider ${
                        isCritical ? 'text-rose-700 font-bold' : 'text-amber-700'
                      }`}
                    >
                      {report.severity} SEVERITY
                    </span>
                    <span className="text-[11px] text-stone-400">
                      {report.resolved ? 'Resolved' : 'Pending Action'}
                    </span>
                  </div>

                  <div className="font-semibold text-stone-900 text-xs mt-1 truncate">
                    {report.userName}
                  </div>

                  <p className="text-[11px] text-stone-600 mt-1 line-clamp-2">
                    {report.reason}
                  </p>

                  <div className="mt-2 text-[10px] text-stone-400">
                    {new Date(report.createdAt).toLocaleDateString(undefined, {
                      month: 'short',
                      day: 'numeric',
                      hour: '2-digit',
                      minute: '2-digit',
                    })}
                  </div>
                </button>
              );
            })}
          </div>
        </div>

        {/* Right 2 Columns: Detailed Incident Inspector & Account Ban / Lock Controls */}
        <div className="lg:col-span-2 space-y-6">
          {selectedReport ? (
            <div className="bg-white border border-stone-200 rounded-2xl p-6 shadow-xs space-y-6">
              {/* Header */}
              <div className="flex items-start justify-between border-b border-stone-100 pb-4">
                <div className="space-y-1">
                  <div className="flex items-center gap-2">
                    <span
                      className={`text-xs font-bold uppercase tracking-wider px-2 py-0.5 rounded-md ${
                        selectedReport.severity === 'CRITICAL'
                          ? 'bg-rose-100 text-rose-800'
                          : 'bg-amber-100 text-amber-800'
                      }`}
                    >
                      {selectedReport.severity} Incident
                    </span>
                    {selectedReport.resolved && (
                      <span className="text-xs text-teal-800 font-medium flex items-center gap-1">
                        <CheckCircle2 className="w-3.5 h-3.5" /> Resolved
                      </span>
                    )}
                  </div>
                  <h3 className="text-lg font-bold text-stone-900 font-serif">
                    {selectedReport.reason}
                  </h3>
                </div>

                <div className="text-right text-xs text-stone-400 font-mono">
                  {new Date(selectedReport.createdAt).toLocaleString()}
                </div>
              </div>

              {/* User Identity Snapshot */}
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 p-3.5 bg-stone-50 border border-stone-200 rounded-xl text-xs">
                <div>
                  <span className="text-stone-400 block text-[11px]">User Name</span>
                  <span className="font-semibold text-stone-900">{selectedReport.userName}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Email / Contact</span>
                  <span className="font-mono text-stone-700">{selectedReport.userEmail}</span>
                </div>
                <div>
                  <span className="text-stone-400 block text-[11px]">Current Status</span>
                  <span
                    className={`font-bold uppercase text-[11px] ${
                      selectedReport.userStatus === 'BANNED'
                        ? 'text-rose-700'
                        : selectedReport.userStatus === 'SUSPENDED'
                        ? 'text-amber-700'
                        : 'text-teal-800'
                    }`}
                  >
                    {selectedReport.userStatus}
                  </span>
                </div>
              </div>

              {/* Redacted Context Snippet */}
              <div className="space-y-2">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-500">
                  Sanitized Evidence Snippet (AI Safety Intercept)
                </label>
                <div className="p-4 bg-stone-50 rounded-xl border border-stone-200 font-mono text-xs text-stone-800 whitespace-pre-wrap leading-relaxed">
                  {selectedReport.contextSnippet}
                </div>
              </div>

              {/* Audit trail / Action taken */}
              {selectedReport.actionTaken && (
                <div className="p-3 bg-stone-100 border border-stone-200 rounded-xl text-xs text-stone-700 space-y-1">
                  <span className="font-semibold text-stone-900">Recorded Resolution:</span>
                  <p>{selectedReport.actionTaken}</p>
                </div>
              )}

              {/* Admin Moderation Actions Form */}
              <div className="space-y-3 pt-2 border-t border-stone-100">
                <label className="text-xs font-semibold uppercase tracking-wider text-stone-700">
                  Executive Admin Decision
                </label>

                <input
                  type="text"
                  value={actionReason}
                  onChange={(e) => setActionReason(e.target.value)}
                  placeholder="Optional note / reason for account status update..."
                  className="w-full px-3 py-2 bg-stone-50 border border-stone-200 rounded-lg text-xs text-stone-900 placeholder:text-stone-400"
                />

                <div className="flex flex-wrap gap-2 pt-2">
                  {/* Freeze / Suspend */}
                  <button
                    onClick={() => handleAdminAction(selectedReport.id, 'SUSPEND')}
                    className="px-4 py-2 bg-amber-700 text-white rounded-lg text-xs font-semibold hover:bg-amber-800 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Lock className="w-3.5 h-3.5" />
                    <span>Freeze / Lock Account</span>
                  </button>

                  {/* Permanent Ban */}
                  <button
                    onClick={() => handleAdminAction(selectedReport.id, 'BAN')}
                    className="px-4 py-2 bg-rose-700 text-white rounded-lg text-xs font-semibold hover:bg-rose-800 transition-colors flex items-center gap-1.5 shadow-xs"
                  >
                    <Ban className="w-3.5 h-3.5" />
                    <span>Ban Account Permanently</span>
                  </button>

                  {/* Issue Warning */}
                  <button
                    onClick={() => handleAdminAction(selectedReport.id, 'WARN')}
                    className="px-4 py-2 bg-stone-800 text-white rounded-lg text-xs font-semibold hover:bg-stone-900 transition-colors flex items-center gap-1.5"
                  >
                    <AlertTriangle className="w-3.5 h-3.5 text-amber-400" />
                    <span>Issue Warning</span>
                  </button>

                  {/* Reinstate to Active */}
                  <button
                    onClick={() => handleAdminAction(selectedReport.id, 'REINSTATE')}
                    className="px-4 py-2 bg-stone-100 text-stone-700 border border-stone-200 rounded-lg text-xs font-semibold hover:bg-stone-200 transition-colors flex items-center gap-1.5"
                  >
                    <Unlock className="w-3.5 h-3.5 text-teal-700" />
                    <span>Reinstate to Active</span>
                  </button>

                  {/* Dismiss / Mark Resolved */}
                  <button
                    onClick={() => handleAdminAction(selectedReport.id, 'RESOLVE')}
                    className="px-4 py-2 bg-teal-50 text-teal-800 border border-teal-200 rounded-lg text-xs font-semibold hover:bg-teal-100 transition-colors flex items-center gap-1.5 ml-auto"
                  >
                    <CheckCircle2 className="w-3.5 h-3.5 text-teal-700" />
                    <span>Mark Resolved</span>
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <div className="bg-white border border-stone-200 rounded-2xl p-12 text-center text-xs text-stone-500">
              Select an incident from the queue on the left to review details and take moderation action.
            </div>
          )}
        </div>
      </div>
      )}
    </div>
  );
};
