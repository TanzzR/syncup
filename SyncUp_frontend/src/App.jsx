import React, { useState, useEffect, useCallback } from 'react';
import { Calendar, Users, Share2, Plus, ArrowRight, User, Moon, Sun, LogIn, LogOut, Copy, Loader2 } from 'lucide-react';
import { GoogleOAuthProvider, useGoogleLogin } from '@react-oauth/google';
import axios from 'axios';
import { createCalendarEvent, deleteCalendarEvent, syncScheduleToCalendar } from './googleCalendar';

// ========================
// CONFIGURATION
// ========================
const API_BASE = 'http://localhost:5000/api';
const GOOGLE_CLIENT_ID = '865205653141-21qk4a04jhl58p61evqdfkvd2kq6dj6o.apps.googleusercontent.com';

// ========================
// CONSTANTS
// ========================
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

const STATUS_LABELS = {
  null: 'Unset',
  free: 'Free',
  busy: 'Busy',
  skip: 'Can Skip',
};

// ========================
// MAIN APP (wrapped in GoogleOAuthProvider)
// ========================
export default function AppWrapper() {
  return (
    <GoogleOAuthProvider clientId={GOOGLE_CLIENT_ID}>
      <App />
    </GoogleOAuthProvider>
  );
}

function App() {
  // --- Theme ---
  const [darkMode, setDarkMode] = useState(() => {
    return localStorage.getItem('syncup-dark') === 'true';
  });

  // --- Auth / Landing ---
  const [screen, setScreen] = useState('google-auth'); // 'google-auth' | 'landing' | 'schedule'
  const [username, setUsername] = useState('');
  const [groupName, setGroupName] = useState('');
  const [joinGroupId, setJoinGroupId] = useState('');
  const [loading, setLoading] = useState(false);

  // --- Group Data ---
  const [groupId, setGroupId] = useState(null);
  const [groupData, setGroupData] = useState(null);
  const [members, setMembers] = useState([]);

  // --- Schedule ---
  const [view, setView] = useState('personal'); // 'personal' or 'group'
  const [mySchedule, setMySchedule] = useState({});
  const [toast, setToast] = useState(null);

  // --- Google Calendar ---
  const [googleToken, setGoogleToken] = useState(null);
  const [googleUser, setGoogleUser] = useState(null);
  const [calendarEventIds, setCalendarEventIds] = useState({});
  const [syncing, setSyncing] = useState(false);
  const [showMembersDropdown, setShowMembersDropdown] = useState(false);
  const [copiedId, setCopiedId] = useState(false);
  const [refreshedData, setRefreshedData] = useState(false);
  const [hasAutoSynced, setHasAutoSynced] = useState(false);

  // Auto-sync after Google Login
  useEffect(() => {
    if (googleToken && Object.keys(mySchedule).length > 0 && !hasAutoSynced) {
      setSyncing(true);
      syncScheduleToCalendar(googleToken, mySchedule)
        .then((ids) => {
          setCalendarEventIds((prev) => ({ ...prev, ...ids }));
          const count = Object.keys(ids).length;
          if (count > 0) {
            showToast(`✅ ${count} slot(s) synced to Google Calendar!`);
          } else {
            showToast('⚠️ No slots were synced — check Calendar API permissions');
          }
          setSyncing(false);
          setHasAutoSynced(true);
        })
        .catch((err) => {
          console.error('Auto-sync error:', err);
          showToast(`❌ Calendar sync failed: ${err.message || 'Unknown error'}`);
          setSyncing(false);
          setHasAutoSynced(true);
        });
    }
  }, [googleToken, mySchedule, hasAutoSynced]);

  // Persist dark mode
  useEffect(() => {
    localStorage.setItem('syncup-dark', darkMode);
  }, [darkMode]);

  // --- Google Login ---
  const googleLogin = useGoogleLogin({
    onSuccess: async (tokenResponse) => {
      const token = tokenResponse.access_token;
      console.log('Google token received, scopes:', tokenResponse.scope);
      setGoogleToken(token);
      // Fetch user info
      try {
        const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
          headers: { Authorization: `Bearer ${token}` },
        });
        const data = await res.json();
        setGoogleUser(data);
        showToast(`Signed in as ${data.name || data.email}`);
      } catch {
        showToast('Google sign-in succeeded');
      }
      // Verify calendar access by testing the API
      try {
        const calTest = await fetch('https://www.googleapis.com/calendar/v3/calendars/primary', {
          headers: { Authorization: `Bearer ${token}` },
        });
        if (!calTest.ok) {
          const errData = await calTest.json();
          console.error('Calendar API test failed:', errData);
          showToast(`⚠️ Calendar access issue: ${errData.error?.message || 'Enable Calendar API in Google Cloud Console'}`);
        } else {
          console.log('Calendar API access verified ✅');
        }
      } catch (err) {
        console.error('Calendar test error:', err);
      }
      // Mandatory auth: transition to landing after sign-in
      setScreen('landing');
    },
    onError: (err) => {
      console.error('Google login error:', err);
      showToast('Google sign-in failed: ' + (err?.error_description || 'Unknown error'));
    },
    scope: 'https://www.googleapis.com/auth/calendar.events https://www.googleapis.com/auth/calendar https://www.googleapis.com/auth/userinfo.profile https://www.googleapis.com/auth/userinfo.email',
    flow: 'implicit',
    prompt: 'consent',
  });

  // --- Toast ---
  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  // --- API: Create Group ---
  const handleCreateGroup = async () => {
    if (!username.trim() || !groupName.trim()) {
      showToast('Please enter your name and group name');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.post(`${API_BASE}/group`, { name: groupName.trim() });
      const group = res.data;
      localStorage.setItem(`syncup-user-${group._id}`, username.trim());
      setGroupId(group._id);
      setGroupData(group);
      setMembers(group.members || []);
      setScreen('schedule');
      showToast(`Group "${group.name}" created!`);
    } catch (err) {
      showToast('Failed to create group: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  // --- API: Join Group ---
  const handleJoinGroup = async () => {
    if (!username.trim() || !joinGroupId.trim()) {
      showToast('Please enter your name and a group ID');
      return;
    }
    setLoading(true);
    try {
      const res = await axios.get(`${API_BASE}/group/${joinGroupId.trim()}`);
      const group = res.data;

      const isTaken = group.members.some((m) => m.user === username.trim());
      const prevJoinedName = localStorage.getItem(`syncup-user-${group._id}`);

      if (isTaken && prevJoinedName !== username.trim()) {
        showToast('Username already taken in this group! Please choose another.');
        setLoading(false);
        return;
      }

      localStorage.setItem(`syncup-user-${group._id}`, username.trim());
      setGroupId(group._id);
      setGroupData(group);
      setMembers(group.members || []);
      // Load my existing schedule if I'm already a member
      const me = group.members.find((m) => m.user === username.trim());
      if (me && me.schedule) {
        setMySchedule(me.schedule);
      }
      setScreen('schedule');
      showToast(`Joined "${group.name}"!`);
    } catch (err) {
      showToast('Group not found or error: ' + (err.response?.data?.error || err.message));
    }
    setLoading(false);
  };

  // --- API: Save Schedule ---
  const saveScheduleToBackend = useCallback(
    async (schedule) => {
      if (!groupId || !username.trim()) return;
      try {
        const res = await axios.post(`${API_BASE}/group/${groupId}/schedule`, {
          user: username.trim(),
          schedule,
        });
        setGroupData(res.data);
        setMembers(res.data.members || []);
      } catch (err) {
        console.error('Failed to save schedule:', err);
      }
    },
    [groupId, username]
  );

  // --- API: Refresh Group ---
  const refreshGroup = async () => {
    if (!groupId) return;
    try {
      const res = await axios.get(`${API_BASE}/group/${groupId}`);
      setGroupData(res.data);
      setMembers(res.data.members || []);
    } catch (err) {
      console.error('Refresh failed:', err);
    }
  };

  // --- Slot Handler ---
  const setSlotStatus = async (day, hour, status, event) => {
    if (event) event.stopPropagation();
    if (view === 'group') return;

    const key = `${day}-${hour}`;

    setMySchedule((prev) => {
      const currentStatus = prev[key];
      const newSchedule = { ...prev };

      if (currentStatus === status) {
        delete newSchedule[key];
        // Delete calendar event if exists
        if (googleToken && calendarEventIds[key]) {
          deleteCalendarEvent(googleToken, calendarEventIds[key]).catch(() => { });
          setCalendarEventIds((ids) => {
            const copy = { ...ids };
            delete copy[key];
            return copy;
          });
        }
      } else {
        newSchedule[key] = status;
        // Create calendar event
        if (googleToken) {
          if (calendarEventIds[key]) {
            deleteCalendarEvent(googleToken, calendarEventIds[key]).catch(() => { });
          }
          createCalendarEvent(googleToken, day, hour, status)
            .then((ev) => {
              setCalendarEventIds((ids) => ({ ...ids, [key]: ev.id }));
              console.log(`✅ Calendar event created for ${key}:`, ev.id);
            })
            .catch((err) => {
              console.error('Calendar create error for', key, ':', err);
              showToast(`❌ Calendar sync failed for ${day} ${hour}:00 — ${err.message}`);
            });
        }
      }

      // Debounced save to backend
      setTimeout(() => saveScheduleToBackend(newSchedule), 300);
      return newSchedule;
    });
  };

  // --- Google Calendar Full Sync ---
  const handleSyncToCalendar = async () => {
    if (!googleToken) {
      showToast('Please sign in with Google first');
      return;
    }
    setSyncing(true);
    try {
      const ids = await syncScheduleToCalendar(googleToken, mySchedule);
      setCalendarEventIds((prev) => ({ ...prev, ...ids }));
      const count = Object.keys(ids).length;
      const total = Object.keys(mySchedule).length;
      if (count > 0) {
        showToast(`✅ ${count}/${total} slots synced to Google Calendar!`);
      } else if (total === 0) {
        showToast('No slots to sync — set your availability first');
      } else {
        showToast('⚠️ Sync completed but no events were created — check console for errors');
      }
    } catch (err) {
      console.error('Full sync error:', err);
      showToast(`❌ Sync failed: ${err.message || 'Check Calendar API access'}`);
    }
    setSyncing(false);
  };

  // --- Share ---
  const handleShare = () => {
    if (groupId) {
      navigator.clipboard.writeText(groupId).catch(() => { });
      setCopiedId(true);
      setTimeout(() => setCopiedId(false), 2000);
      showToast(`Group ID copied: ${groupId}`);
    } else {
      showToast('Create or join a group first');
    }
  };

  // --- Group Overlap Logic ---
  const getGroupSlotStatus = (day, hour) => {
    const key = `${day}-${hour}`;
    const allSchedules = [
      { id: 'me', schedule: mySchedule },
      ...members.filter((m) => m.user !== username.trim()).map((m) => ({ id: m.user, schedule: m.schedule || {} })),
    ];

    let hasBusy = false;
    let hasSkip = false;
    let freeCount = 0;

    allSchedules.forEach((user) => {
      const status = user.schedule[key];
      if (status === 'busy') hasBusy = true;
      else if (status === 'skip') hasSkip = true;
      else if (status === 'free') freeCount++;
    });

    if (hasBusy) return 'busy';
    if (freeCount === allSchedules.length) return 'free';
    if (!hasBusy && hasSkip) return 'skip';
    return null;
  };

  // --- Status colors (theme-aware) ---
  const getStatusColor = (status) => {
    if (darkMode) {
      const map = {
        null: 'bg-white/5 hover:bg-white/10 border-white/10 text-slate-400',
        free: 'bg-emerald-500/30 hover:bg-emerald-500/40 border-emerald-400/40 text-emerald-300',
        busy: 'bg-rose-500/30 hover:bg-rose-500/40 border-rose-400/40 text-rose-300',
        skip: 'bg-amber-500/25 hover:bg-amber-500/35 border-amber-400/35 text-amber-300',
      };
      return map[status] || map.null;
    } else {
      const map = {
        null: 'bg-gray-100 hover:bg-gray-200 border-gray-200',
        free: 'bg-emerald-400 hover:bg-emerald-500 border-emerald-500 text-white',
        busy: 'bg-rose-400 hover:bg-rose-500 border-rose-500 text-white',
        skip: 'bg-amber-300 hover:bg-amber-400 border-amber-400 text-amber-900',
      };
      return map[status] || map.null;
    }
  };

  // --- Render Cell ---
  const renderCell = (day, hour) => {
    const key = `${day}-${hour}`;
    let status = null;
    let content = '';

    if (view === 'personal') {
      status = mySchedule[key];
      if (status === 'free') content = 'Free';
      else if (status === 'skip') content = 'Skip';
      else if (status === 'busy') content = 'Busy';
    } else {
      status = getGroupSlotStatus(day, hour);
      if (status === 'free') content = 'Perfect';
      if (status === 'skip') content = 'Possible';
      if (status === 'busy') content = 'Not Possible';
    }

    const colorClass = getStatusColor(status);
    const baseCellClass = view === 'personal' ? 'group/cell' : '';
    const borderClass = darkMode ? 'border-white/5' : 'border-slate-200';

    return (
      <div
        key={key}
        className={`relative h-12 border-b border-r ${borderClass} transition-colors duration-200 flex items-center justify-center text-xs font-medium ${colorClass} ${baseCellClass}`}
      >
        {content}

        {/* Hover Selector Popover */}
        {view === 'personal' && (
          <div
            className={`absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden group-hover/cell:flex items-center gap-1.5 p-1.5 rounded-full shadow-lg z-10 transition-transform scale-95 group-hover/cell:scale-100 ${darkMode ? 'bg-slate-800 border border-white/20' : 'bg-white border border-slate-200'
              }`}
          >
            <button
              onClick={(e) => setSlotStatus(day, hour, 'free', e)}
              className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ${status === 'free' ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-emerald-400 hover:bg-emerald-500'
                }`}
              title="Free"
            />
            <button
              onClick={(e) => setSlotStatus(day, hour, 'skip', e)}
              className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ${status === 'skip' ? 'bg-amber-400 ring-2 ring-amber-200' : 'bg-amber-300 hover:bg-amber-400'
                }`}
              title="Can Skip"
            />
            <button
              onClick={(e) => setSlotStatus(day, hour, 'busy', e)}
              className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ${status === 'busy' ? 'bg-rose-500 ring-2 ring-rose-200' : 'bg-rose-400 hover:bg-rose-500'
                }`}
              title="Busy"
            />
          </div>
        )}
      </div>
    );
  };

  // ===================================================
  // GOOGLE AUTH SCREEN (Mandatory first step)
  // ===================================================
  if (screen === 'google-auth') {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div
          className={`min-h-screen flex flex-col items-center justify-center p-8 relative overflow-hidden dark-transition ${darkMode
            ? 'bg-[#0a0a1a] text-white'
            : 'bg-gradient-to-br from-blue-100 via-indigo-50 to-purple-100 text-slate-800'
            }`}
        >
          {/* Decorative background shapes */}
          <div className="absolute inset-0 overflow-hidden pointer-events-none">
            <div className={`absolute -top-32 -right-32 w-96 h-96 rounded-full blur-3xl ${darkMode ? 'bg-indigo-600/8' : 'bg-indigo-300/30'}`} />
            <div className={`absolute -bottom-40 -left-40 w-[500px] h-[500px] rounded-full blur-3xl ${darkMode ? 'bg-purple-600/8' : 'bg-purple-200/40'}`} />
            <div className={`absolute top-1/3 right-1/4 w-64 h-64 rounded-full blur-3xl ${darkMode ? 'bg-cyan-600/5' : 'bg-cyan-200/25'}`} />
          </div>

          {/* Dark mode toggle — top right */}
          <button
            onClick={() => setDarkMode(!darkMode)}
            className={`absolute top-6 right-6 p-3 rounded-2xl transition-all z-10 ${darkMode ? 'bg-white/5 hover:bg-white/10 text-yellow-300 border border-white/10' : 'bg-white/60 hover:bg-white/80 text-slate-500 shadow-sm backdrop-blur-sm border border-white/40'
              }`}
            title="Toggle theme"
          >
            {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
          </button>

          {/* Main Card */}
          <div
            className={`relative w-full max-w-[420px] rounded-[2rem] overflow-hidden dark-transition ${darkMode
              ? 'glass-strong shadow-2xl shadow-indigo-500/10'
              : 'bg-white/80 backdrop-blur-xl shadow-2xl shadow-indigo-200/30 border border-white/50'
              }`}
          >
            {/* Gradient accent bar at top */}
            <div className="h-1.5 w-full bg-gradient-to-r from-indigo-500 via-purple-500 to-cyan-400" />

            <div className="p-10 md:p-12 pb-14 md:pb-16 flex flex-col items-center text-center space-y-7">
              {/* Logo */}
              <div className="space-y-2">
                <h1
                  className={`text-4xl font-extrabold tracking-tight ${darkMode ? 'gradient-text' : 'bg-gradient-to-r from-indigo-600 via-purple-600 to-indigo-600 bg-clip-text text-transparent'
                    }`}
                >
                  SyncUp
                </h1>
                <p className={`text-[13px] font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Find the perfect time to hang out
                </p>
              </div>

              {/* Calendar Icon with glow */}
              <div className="relative">
                <div className={`absolute inset-0 rounded-full blur-xl ${darkMode ? 'bg-indigo-500/20' : 'bg-indigo-300/30'}`} />
                <div className={`relative w-[88px] h-[88px] rounded-full flex items-center justify-center ${darkMode ? 'bg-indigo-500/15 border border-indigo-400/20' : 'bg-gradient-to-br from-indigo-50 to-purple-50 border-2 border-indigo-100/60 shadow-inner'}`}>
                  <Calendar className={`w-10 h-10 ${darkMode ? 'text-indigo-400' : 'text-indigo-600'}`} />
                </div>
              </div>

              {/* Description */}
              <p className={`text-[13px] leading-relaxed max-w-[260px] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Sign in with Google to sync your schedule with Google Calendar automatically.
              </p>

              <div className="h-4" /> {/* Spacer */}

              {/* Google Sign-In Button */}
              <button
                onClick={() => googleLogin()}
                className={`w-full px-6 py-4 rounded-2xl text-[15px] font-semibold transition-all flex items-center justify-center gap-3 hover:scale-[1.02] active:scale-[0.98] ${darkMode
                  ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/30'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 hover:from-indigo-500 hover:to-purple-500 text-white shadow-lg shadow-indigo-400/25'
                  }`}
              >
                {/* Google "G" SVG */}
                <svg className="w-5 h-5" viewBox="0 0 24 24" fill="none">
                  <path d="M22.56 12.25c0-.78-.07-1.53-.2-2.25H12v4.26h5.92a5.06 5.06 0 0 1-2.2 3.32v2.77h3.57c2.08-1.92 3.28-4.74 3.28-8.1z" fill="#fff" fillOpacity="0.9"/>
                  <path d="M12 23c2.97 0 5.46-.98 7.28-2.66l-3.57-2.77c-.98.66-2.23 1.06-3.71 1.06-2.86 0-5.29-1.93-6.16-4.53H2.18v2.84C3.99 20.53 7.7 23 12 23z" fill="#fff" fillOpacity="0.8"/>
                  <path d="M5.84 14.09c-.22-.66-.35-1.36-.35-2.09s.13-1.43.35-2.09V7.07H2.18C1.43 8.55 1 10.22 1 12s.43 3.45 1.18 4.93l2.85-2.22.81-.62z" fill="#fff" fillOpacity="0.7"/>
                  <path d="M12 5.38c1.62 0 3.06.56 4.21 1.64l3.15-3.15C17.45 2.09 14.97 1 12 1 7.7 1 3.99 3.47 2.18 7.07l3.66 2.84c.87-2.6 3.3-4.53 6.16-4.53z" fill="#fff" fillOpacity="0.9"/>
                </svg>
                Sign in with Google
              </button>

              {/* Footer note */}
              <p className={`text-[11px] ${darkMode ? 'text-slate-600' : 'text-slate-400'}`}>
                We only access your calendar to add availability events
              </p>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div
              className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in text-sm font-medium ${darkMode ? 'bg-slate-800 text-white border border-white/10' : 'bg-slate-900 text-white shadow-xl'
                }`}
            >
              {toast}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===================================================
  // LANDING SCREEN (after Google auth)
  // ===================================================
  if (screen === 'landing') {
    return (
      <div className={darkMode ? 'dark' : ''}>
        <div
          className={`min-h-screen flex items-center justify-center p-8 dark-transition ${darkMode
            ? 'bg-[#0a0a1a] text-white'
            : 'bg-gradient-to-br from-blue-200 via-indigo-100 to-purple-200 text-slate-800'
            }`}
        >
          <div
            className={`w-full max-w-lg md:max-w-2xl rounded-[2rem] p-8 sm:p-10 md:p-14 space-y-6 dark-transition ${darkMode
              ? 'glass-strong shadow-2xl shadow-indigo-500/10'
              : 'bg-white/95 backdrop-blur-sm shadow-2xl shadow-indigo-200/40 border border-white/60'
              }`}
          >
            {/* Logo & Dark Toggle */}
            <div className="flex items-center justify-between mb-2">
              <div>
                <h1
                  className={`text-3xl font-extrabold tracking-tight ${darkMode ? 'gradient-text' : 'bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'
                    }`}
                >
                  SyncUp
                </h1>
                <p className={`text-sm mt-1.5 ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                  Pick the best time to hang out
                </p>
              </div>
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-white/10 hover:bg-white/20 text-yellow-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                title="Toggle theme"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>
            </div>

            {/* Signed-in Google user info */}
            {googleUser && (
              <div className={`flex items-center gap-4 px-5 py-4 rounded-2xl ${darkMode ? 'bg-white/5 border border-white/10' : 'bg-gradient-to-r from-indigo-50 to-purple-50 border border-indigo-100/60'}`}>
                {googleUser.picture && (
                  <img src={googleUser.picture} alt="" className="w-11 h-11 rounded-full ring-2 ring-indigo-200/50 shadow-sm" referrerPolicy="no-referrer" />
                )}
                <div className="flex-1 min-w-0">
                  <p className={`text-sm font-semibold truncate ${darkMode ? 'text-white' : 'text-slate-800'}`}>{googleUser.name}</p>
                  <p className={`text-xs mt-0.5 truncate ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>{googleUser.email}</p>
                </div>
                <button
                  onClick={() => { setGoogleToken(null); setGoogleUser(null); setScreen('google-auth'); showToast('Signed out'); }}
                  className={`flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-medium transition-all ${darkMode ? 'bg-white/10 hover:bg-white/20 text-slate-400' : 'bg-white/80 hover:bg-white text-slate-500 shadow-sm border border-slate-200/50'}`}
                >
                  <LogOut className="w-3.5 h-3.5" />
                  Sign out
                </button>
              </div>
            )}

            {/* Username */}
            <div className="space-y-2.5">
              <label className={`text-[11px] font-bold uppercase tracking-[0.12em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Your Name
              </label>
              <input
                type="text"
                placeholder="Enter your name"
                value={username}
                onChange={(e) => setUsername(e.target.value)}
                className={`w-full px-5 py-3.5 rounded-xl text-[15px] font-medium outline-none transition-all ${darkMode
                  ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-400/50 focus:ring-2 focus:ring-indigo-400/20'
                  : 'bg-slate-50/80 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400 focus:ring-2 focus:ring-indigo-100'
                  }`}
              />
            </div>

            {/* Divider */}
            <div className="py-1">
              <div className={`border-t ${darkMode ? 'border-white/8' : 'border-slate-200/80'}`} />
            </div>

            {/* Create Group */}
            <div className="space-y-2.5">
              <label className={`text-[11px] font-bold uppercase tracking-[0.12em] ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                Create New Group
              </label>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Group name"
                  value={groupName}
                  onChange={(e) => setGroupName(e.target.value)}
                  className={`flex-1 px-5 py-3.5 rounded-xl text-[15px] font-medium outline-none transition-all ${darkMode
                    ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-indigo-400/50'
                    : 'bg-slate-50/80 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400'
                    }`}
                />
                <button
                  onClick={handleCreateGroup}
                  disabled={loading}
                  className={`px-6 py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shrink-0 ${darkMode
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/25'
                    : 'bg-gradient-to-r from-indigo-600 to-indigo-700 hover:from-indigo-500 hover:to-indigo-600 text-white shadow-md shadow-indigo-300/30'
                    }`}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <Plus className="w-4 h-4" />}
                  Create
                </button>
              </div>
            </div>

            {/* Or Join */}
            <div className="flex items-center gap-4 py-1">
              <div className={`flex-1 border-t ${darkMode ? 'border-white/8' : 'border-slate-200/80'}`} />
              <span className={`text-[11px] font-semibold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>or join existing</span>
              <div className={`flex-1 border-t ${darkMode ? 'border-white/8' : 'border-slate-200/80'}`} />
            </div>

            <div>
              <div className="flex gap-3">
                <input
                  type="text"
                  placeholder="Paste Group ID"
                  value={joinGroupId}
                  onChange={(e) => setJoinGroupId(e.target.value)}
                  className={`flex-1 px-5 py-3.5 rounded-xl text-[15px] font-medium outline-none transition-all ${darkMode
                    ? 'bg-white/5 border border-white/10 text-white placeholder-slate-500 focus:border-cyan-400/50'
                    : 'bg-slate-50/80 border border-slate-200 text-slate-800 placeholder-slate-400 focus:border-indigo-400'
                    }`}
                />
                <button
                  onClick={handleJoinGroup}
                  disabled={loading}
                  className={`px-6 py-3.5 rounded-xl text-sm font-semibold transition-all flex items-center justify-center gap-2 shrink-0 ${darkMode
                    ? 'bg-white/10 hover:bg-white/15 text-white border border-white/10'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-700 border border-slate-200/50'
                    }`}
                >
                  {loading ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                  Join
                </button>
              </div>
            </div>
          </div>

          {/* Toast */}
          {toast && (
            <div
              className={`fixed top-4 right-4 px-6 py-3 rounded-xl shadow-lg z-50 animate-fade-in text-sm font-medium ${darkMode ? 'bg-slate-800 text-white border border-white/10' : 'bg-slate-900 text-white shadow-xl'
                }`}
            >
              {toast}
            </div>
          )}
        </div>
      </div>
    );
  }

  // ===================================================
  // SCHEDULE SCREEN
  // ===================================================
  const uniqueMemberNames = [...new Set(members.map((m) => m.user))].filter((name) => name !== username.trim());
  let displayNamesText = uniqueMemberNames.join(', ');
  if (uniqueMemberNames.length > 3) {
    displayNamesText = `${uniqueMemberNames.slice(0, 3).join(', ')} ... and ${uniqueMemberNames.length - 3} others`;
  }

  return (
    <div className={darkMode ? 'dark' : ''}>
      <div
        className={`min-h-screen flex flex-col font-sans p-4 md:p-6 dark-transition ${darkMode ? 'bg-[#0a0a1a] text-slate-100' : 'bg-slate-50 text-slate-800'
          } ${darkMode ? 'dark-scrollbar' : ''}`}
      >
        {/* Toast */}
        {toast && (
          <div
            className={`fixed top-4 right-4 px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in text-sm font-medium ${darkMode ? 'bg-slate-800 text-white border border-white/10' : 'bg-slate-800 text-white'
              }`}
          >
            {toast}
          </div>
        )}

        <div className="flex-1 w-full flex flex-col space-y-6">
          {/* Header - Full Width */}
          <header
            className={`flex-none w-full flex flex-col md:flex-row md:items-center justify-between gap-5 px-6 md:px-8 py-5 md:py-6 relative z-50 rounded-2xl dark-transition ${darkMode
              ? 'glass-strong shadow-2xl shadow-indigo-500/5'
              : 'bg-white shadow-sm border border-slate-200'
              }`}
          >
            <div>
              <h1
                className={`text-3xl font-extrabold tracking-tight ${darkMode
                  ? 'gradient-text'
                  : 'bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent'
                  }`}
              >
                SyncUp
              </h1>
              <p className={`text-sm mt-1.5 font-medium ${darkMode ? 'text-slate-400' : 'text-slate-500'}`}>
                {groupData ? groupData.name : 'Pick the best time to hang out with ease'}
                {groupData && (
                  <span
                    className={`relative inline-flex items-center ml-3 text-xs py-1 px-2.5 rounded-full cursor-pointer transition-colors ${darkMode ? 'bg-white/10 text-slate-300 hover:bg-white/20' : 'bg-slate-100 text-slate-600 hover:bg-slate-200'}`}
                    onClick={() => setShowMembersDropdown(!showMembersDropdown)}
                  >
                    • {uniqueMemberNames.length + 1} member{uniqueMemberNames.length + 1 !== 1 ? 's' : ''}
                    {showMembersDropdown && (
                      <div className={`absolute top-full left-0 mt-2 p-3.5 w-52 rounded-xl shadow-xl border z-50 flex flex-col gap-2 text-left font-normal ${darkMode ? 'bg-slate-800 border-white/10 text-slate-200' : 'bg-white border-slate-200 text-slate-700'}`}>
                        <div className="font-semibold text-[10px] uppercase tracking-wider opacity-60 mb-1">Group Members</div>
                        <div className="truncate font-semibold text-sm">{username.trim()} (You)</div>
                        {uniqueMemberNames.map((name, i) => (
                          <div key={i} className="truncate font-medium text-sm">{name}</div>
                        ))}
                      </div>
                    )}
                  </span>
                )}
              </p>
            </div>

            <div className="flex flex-wrap items-center gap-3">
              {/* Google Calendar Sync */}
              <button
                onClick={handleSyncToCalendar}
                disabled={syncing}
                className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold whitespace-nowrap rounded-xl transition-all ${darkMode
                  ? 'bg-white/5 hover:bg-white/10 text-indigo-300 border border-white/10'
                  : 'text-indigo-600 bg-indigo-50 hover:bg-indigo-100'
                  }`}
              >
                {syncing ? <Loader2 className="w-5 h-5 animate-spin" /> : <Calendar className="w-5 h-5" />}
                Sync to Calendar
              </button>

              {/* Share */}
              <div className="relative">
                <button
                  onClick={handleShare}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-xl transition-all ${darkMode
                    ? 'bg-gradient-to-r from-indigo-500 to-purple-600 hover:from-indigo-400 hover:to-purple-500 text-white shadow-lg shadow-indigo-500/20'
                    : 'text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm'
                    }`}
                >
                  <Share2 className="w-5 h-5" />
                  Share ID
                </button>
                {copiedId && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-emerald-500/90 backdrop-blur-sm text-white text-xs font-bold rounded-lg shadow-xl animate-fade-in pointer-events-none whitespace-nowrap">
                    ID is copied
                  </div>
                )}
              </div>

              {/* Refresh */}
              <div className="relative">
                <button
                  onClick={() => {
                    refreshGroup();
                    if (groupData) showToast(`Group: ${groupData.name}`);
                    setRefreshedData(true);
                    setTimeout(() => setRefreshedData(false), 2000);
                  }}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold whitespace-nowrap rounded-xl transition-all ${darkMode
                    ? 'bg-white/5 hover:bg-white/10 text-slate-300 border border-white/10'
                    : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                    }`}
                  title="Refresh group data"
                >
                  <Users className="w-5 h-5" />
                  Refresh Group Data
                </button>
                {refreshedData && (
                  <div className="absolute top-full left-1/2 -translate-x-1/2 mt-2 px-3 py-1 bg-slate-500/90 backdrop-blur-sm text-white text-xs font-bold rounded-lg shadow-xl animate-fade-in pointer-events-none whitespace-nowrap">
                    Refreshed Group Data
                  </div>
                )}
              </div>

              {/* Dark Mode Toggle */}
              <button
                onClick={() => setDarkMode(!darkMode)}
                className={`p-2.5 rounded-xl transition-all ${darkMode ? 'bg-white/10 hover:bg-white/20 text-yellow-300' : 'bg-slate-100 hover:bg-slate-200 text-slate-600'
                  }`}
                title="Toggle theme"
              >
                {darkMode ? <Sun className="w-5 h-5" /> : <Moon className="w-5 h-5" />}
              </button>

              {/* Google User info */}
              {googleUser && (
                <div className={`flex items-center gap-2 px-3 py-2 rounded-xl ${darkMode ? 'bg-white/5 border border-white/10' : 'bg-slate-50 border border-slate-100'}`}>
                  {googleUser.picture && (
                    <img src={googleUser.picture} alt="" className="w-6 h-6 rounded-full" referrerPolicy="no-referrer" />
                  )}
                  <span className={`text-sm font-medium ${darkMode ? 'text-slate-300' : 'text-slate-600'}`}>
                    {googleUser.name?.split(' ')[0] || 'Google'}
                  </span>
                </div>
              )}

              {/* Back to Landing (keep Google session) */}
              <button
                onClick={() => { setScreen('landing'); setGroupId(null); setGroupData(null); setMembers([]); setMySchedule({}); setHasAutoSynced(false); }}
                className={`px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${darkMode ? 'bg-rose-500/10 hover:bg-rose-500/20 text-rose-400 border border-rose-500/20' : 'bg-rose-50 hover:bg-rose-100 text-rose-600'
                  }`}
              >
                ← Leave
              </button>

              {/* Sign out of Google (goes to auth screen) */}
              <button
                onClick={() => { setGoogleToken(null); setGoogleUser(null); setScreen('google-auth'); setGroupId(null); setGroupData(null); setMembers([]); setMySchedule({}); showToast('Signed out'); }}
                className={`flex items-center gap-2 px-4 py-2.5 text-sm font-medium rounded-xl transition-all ${darkMode ? 'bg-white/5 hover:bg-white/10 text-slate-400 border border-white/10' : 'bg-slate-50 hover:bg-slate-100 text-slate-500'
                  }`}
                title="Sign out of Google"
              >
                <LogOut className="w-4 h-4" />
                Sign out
              </button>
            </div>
          </header>

          {/* Main Content - Full Width */}
          <div
            className={`flex-1 flex flex-col rounded-2xl overflow-hidden dark-transition ${darkMode ? 'glass shadow-2xl shadow-indigo-500/5' : 'bg-white shadow-sm border border-slate-200'
              }`}
          >
            {/* Tabs & Legend */}
            <div
              className={`flex-none px-6 md:px-8 py-4 md:py-5 border-b flex flex-col md:flex-row justify-between items-center gap-4 ${darkMode ? 'border-white/5 bg-white/3' : 'border-slate-100 bg-slate-50/50'
                }`}
            >
              <div className={`flex p-1.5 rounded-xl ${darkMode ? 'bg-white/5' : 'bg-slate-200/50'}`}>
                <button
                  onClick={() => setView('personal')}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${view === 'personal'
                    ? darkMode
                      ? 'bg-white/10 shadow-sm text-indigo-300'
                      : 'bg-white shadow-sm text-indigo-600'
                    : darkMode
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <User className="w-4 h-4" />
                  My Availability
                </button>
                <button
                  onClick={() => { setView('group'); refreshGroup(); }}
                  className={`flex items-center gap-2 px-5 py-2.5 text-sm font-semibold rounded-lg transition-all ${view === 'group'
                    ? darkMode
                      ? 'bg-white/10 shadow-sm text-indigo-300'
                      : 'bg-white shadow-sm text-indigo-600'
                    : darkMode
                      ? 'text-slate-400 hover:text-slate-200'
                      : 'text-slate-600 hover:text-slate-900'
                    }`}
                >
                  <Users className="w-4 h-4" />
                  Group Overlap
                </button>
              </div>

              <div className={`flex items-center gap-6 text-sm font-semibold ${darkMode ? 'text-slate-400' : 'text-slate-600'}`}>
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-emerald-400"></div> Free
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-amber-300"></div> Can Skip
                </span>
                <span className="flex items-center gap-2">
                  <div className="w-3.5 h-3.5 rounded-full bg-rose-400"></div> Busy
                </span>
              </div>
            </div>

            {/* Instructions */}
            {view === 'personal' && (
              <div
                className={`flex-none px-6 md:px-8 py-3.5 md:py-4 text-sm font-medium border-b flex flex-wrap items-center gap-x-2 gap-y-1 ${darkMode
                  ? 'bg-indigo-500/10 text-indigo-300 border-indigo-400/10'
                  : 'bg-indigo-50/80 text-indigo-700 border-indigo-100'
                  }`}
              >
                <span><strong>Tip:</strong> Hover over a slot and select your availability. Click an active color again to clear it.</span>
                {googleToken && <span className="opacity-70 border-l border-current pl-2">• Changes auto-sync to Google Calendar</span>}
              </div>
            )}
            {view === 'group' && (
              <div
                className={`flex-none px-6 md:px-8 py-3.5 md:py-4 text-sm font-medium border-b ${darkMode
                  ? 'bg-emerald-500/10 text-emerald-300 border-emerald-400/10'
                  : 'bg-emerald-50/80 text-emerald-800 border-emerald-200'
                  }`}
              >
                Showing combined availability for <strong>You{uniqueMemberNames.length > 0 ? `, ${displayNamesText}` : ''}</strong>.
                Look for the green slots!
              </div>
            )}

            {/* Calendar Grid Container - Flexible height, centered constrained width */}
            <div className={`flex-1 overflow-y-auto ${darkMode ? 'dark-scrollbar' : ''} flex justify-center`}>
              <div className="w-full max-w-5xl self-start overflow-x-auto min-w-[600px] border-x border-b border-t-0 border-white/5 border-l-transparent border-r-transparent pb-12 pt-6 px-4 md:px-6">
                <div className={`border rounded-xl overflow-hidden shadow-sm ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
                  {/* Header Row (Days) */}
                  <div
                    className={`grid font-semibold text-sm tracking-wide ${darkMode ? 'bg-white/5 text-slate-300 border-b border-white/10' : 'border-b border-slate-200 bg-slate-50 text-slate-700'
                      }`}
                    style={{ gridTemplateColumns: `84px repeat(${DAYS.length}, minmax(0, 1fr))` }}
                  >
                    <div className={`px-3 py-4 border-r flex items-center justify-center ${darkMode ? 'border-white/10' : 'border-slate-200'}`}>
                      Time
                    </div>
                    {DAYS.map((day) => {
                      const isToday = day === new Date().toLocaleDateString('en-US', { weekday: 'short' });
                      return (
                        <div
                          key={day}
                          className={`px-2 py-4 text-center border-r relative ${isToday
                            ? darkMode
                              ? 'bg-indigo-500/20 text-indigo-400 border-b-2 border-b-indigo-400 border-r-white/10'
                              : 'bg-indigo-100 text-indigo-700 border-b-2 border-b-indigo-500 border-r-slate-200'
                            : darkMode
                              ? 'border-white/10'
                              : 'border-slate-200'
                            }`}
                        >
                          {day}
                          {isToday && (
                            <span className="ml-1.5 text-[10px] uppercase font-bold tracking-wider opacity-70">
                              (Today)
                            </span>
                          )}
                        </div>
                      );
                    })}
                  </div>

                  {/* Grid Body */}
                  <div className="relative">
                    {HOURS.map((hour, idx) => {
                      const displayHour = hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;
                      const isLast = idx === HOURS.length - 1;
                      return (
                        <div
                          key={hour}
                          className="grid group"
                          style={{ gridTemplateColumns: `84px repeat(${DAYS.length}, minmax(0, 1fr))` }}
                        >
                          <div
                            className={`border-r px-2 py-3 text-xs font-semibold text-center flex items-center justify-center ${!isLast ? (darkMode ? 'border-b border-white/5' : 'border-b border-slate-200') : ''} ${darkMode ? 'border-white/10 text-slate-500 bg-white/3' : 'border-slate-200 text-slate-500 bg-slate-50/50'
                              }`}
                          >
                            {displayHour}
                          </div>
                          {DAYS.map((day) => renderCell(day, hour))}
                        </div>
                      );
                    })}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* Members Bar - Full Width */}
          {members.length > 0 && (
            <div
              className={`flex-none px-6 md:px-8 py-4 md:py-5 rounded-2xl flex flex-wrap items-center gap-3 md:gap-4 dark-transition ${darkMode ? 'glass' : 'bg-white shadow-sm border border-slate-200'
                }`}
            >
              <span className={`text-sm font-bold uppercase tracking-wider ${darkMode ? 'text-slate-500' : 'text-slate-400'}`}>
                Members:
              </span>
              {[username.trim(), ...uniqueMemberNames].map((user, i) => (
                <span
                  key={i}
                  className={`px-4 py-2 rounded-full text-sm font-semibold ${user === username.trim()
                    ? darkMode
                      ? 'bg-indigo-500/20 text-indigo-300 border border-indigo-400/30'
                      : 'bg-indigo-100 text-indigo-700'
                    : darkMode
                      ? 'bg-white/5 text-slate-300 border border-white/10'
                      : 'bg-slate-100 text-slate-600'
                    }`}
                >
                  {user === username.trim() ? `${user} (You)` : user}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
