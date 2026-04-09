import React, { useState, useEffect } from 'react';
import { Calendar, Users, Share2, Plus, ArrowRight, User } from 'lucide-react';

// --- Constants & Helper Data ---
const DAYS = ['Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat', 'Sun'];
const HOURS = Array.from({ length: 13 }, (_, i) => i + 8); // 8 AM to 8 PM

const STATUS_COLORS = {
  null: 'bg-gray-100 hover:bg-gray-200 border-gray-200',
  free: 'bg-emerald-400 hover:bg-emerald-500 border-emerald-500 text-white',
  busy: 'bg-rose-400 hover:bg-rose-500 border-rose-500 text-white',
  skip: 'bg-amber-300 hover:bg-amber-400 border-amber-400 text-amber-900',
};

const STATUS_LABELS = {
  null: 'Unset',
  free: 'Free',
  busy: 'Busy',
  skip: 'Can Skip',
};

// Dummy data for other users in the group
const DUMMY_GROUP_DATA = [
  { id: 'u2', name: 'Alice', schedule: { 'Mon-09': 'free', 'Mon-10': 'busy', 'Tue-14': 'free', 'Wed-11': 'skip' } },
  { id: 'u3', name: 'Bob', schedule: { 'Mon-09': 'free', 'Mon-10': 'free', 'Tue-14': 'skip', 'Wed-11': 'free' } },
];

export default function App() {
  const [view, setView] = useState('personal'); // 'personal' or 'group'
  const [mySchedule, setMySchedule] = useState({});
  const [toast, setToast] = useState(null);

  // --- Handlers ---
  const setSlotStatus = (day, hour, status, event) => {
    if (event) event.stopPropagation(); // Prevents click from bubbling up
    if (view === 'group') return;

    const key = `${day}-${hour}`;
    setMySchedule((prev) => {
      const currentStatus = prev[key];
      const newSchedule = { ...prev };
      
      // Toggle off if clicking the same status
      if (currentStatus === status) {
        delete newSchedule[key];
      } else {
        newSchedule[key] = status;
      }
      return newSchedule;
    });
  };

  const showToast = (message) => {
    setToast(message);
    setTimeout(() => setToast(null), 3000);
  };

  const handleSyncCalendar = () => {
    showToast("Google Calendar Sync simulated! Added busy times.");
    // Simulate adding random busy blocks
    setMySchedule(prev => ({
      ...prev,
      'Mon-11': 'busy',
      'Wed-14': 'busy',
      'Thu-09': 'busy',
      'Fri-15': 'busy'
    }));
  };

  const handleShare = () => {
    showToast("Invite link copied to clipboard!");
    // In a real app: navigator.clipboard.writeText("https://myapp.com/invite/123");
  };

  // --- Group Overlap Logic ---
  const getGroupSlotStatus = (day, hour) => {
    const key = `${day}-${hour}`;
    const allSchedules = [
      { id: 'me', schedule: mySchedule },
      ...DUMMY_GROUP_DATA
    ];

    let hasBusy = false;
    let hasSkip = false;
    let hasUnset = false;
    let freeCount = 0;

    allSchedules.forEach(user => {
      const status = user.schedule[key];
      if (status === 'busy') hasBusy = true;
      else if (status === 'skip') hasSkip = true;
      else if (status === 'free') freeCount++;
      else hasUnset = true;
    });

    if (hasBusy) return 'busy';
    if (freeCount === allSchedules.length) return 'free';
    if (!hasBusy && hasSkip) return 'skip'; // Mix of free and skip
    return null; // Someone hasn't filled it out, or all unset
  };

  // --- Render Helpers ---
  const renderCell = (day, hour) => {
    const key = `${day}-${hour}`;
    let status = null;
    let content = "";

    if (view === 'personal') {
      status = mySchedule[key];
      if (status === 'free'){
        content = 'Free';
      } else if (status === 'skip'){
        content = 'Skip';
      } else if (status === 'busy'){
        content = 'Busy';
      }
    } else {
      status = getGroupSlotStatus(day, hour);
      if (status === 'free') content = 'Perfect';
      if (status === 'skip') content = 'Possible';
      if (status === 'busy') content = 'Not Possible';
    }

    const colorClass = STATUS_COLORS[status] || STATUS_COLORS.null;
    // We use a named group "group/cell" so it doesn't conflict with any outer groups
    const baseCellClass = view === 'personal' ? 'group/cell' : '';

    return (
      <div
        key={key}
        className={`relative h-12 border-b border-r transition-colors duration-200 flex items-center justify-center text-xs font-medium ${colorClass} ${baseCellClass}`}
      >
        {content}
        
        {/* Hover Selector Popover */}
        {view === 'personal' && (
          <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 hidden group-hover/cell:flex items-center gap-1.5 p-1.5 rounded-full bg-white shadow-lg border border-slate-200 z-10 transition-transform scale-95 group-hover/cell:scale-100">
            <button
              onClick={(e) => setSlotStatus(day, hour, 'free', e)}
              className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ${status === 'free' ? 'bg-emerald-500 ring-2 ring-emerald-200' : 'bg-emerald-400 hover:bg-emerald-500'}`}
              title="Free"
            />
            <button
              onClick={(e) => setSlotStatus(day, hour, 'skip', e)}
              className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ${status === 'skip' ? 'bg-amber-400 ring-2 ring-amber-200' : 'bg-amber-300 hover:bg-amber-400'}`}
              title="Can Skip"
            />
            <button
              onClick={(e) => setSlotStatus(day, hour, 'busy', e)}
              className={`w-5 h-5 rounded-full hover:scale-110 transition-transform shadow-sm ${status === 'busy' ? 'bg-rose-500 ring-2 ring-rose-200' : 'bg-rose-400 hover:bg-rose-500'}`}
              title="Busy"
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <div className="min-h-screen bg-blue-300 text-slate-800 font-sans p-4 md:p-8">
      
      {/* Toast Notification */}
      {toast && (
        <div className="fixed top-4 right-4 bg-slate-800 text-white px-6 py-3 rounded-lg shadow-lg z-50 animate-fade-in">
          {toast}
        </div>
      )}

      <div className="max-w-5xl mx-auto space-y-6">
        
        {/* Header */}
        <header className="flex flex-col md:flex-row md:items-center justify-between gap-4 bg-white p-6 rounded-2xl shadow-sm border border-slate-100">
          <div>
            <h1 className="text-2xl font-bold bg-gradient-to-r from-indigo-600 to-purple-600 bg-clip-text text-transparent">
              SyncUp
            </h1>
            <p className="text-sm text-slate-500">Pick the best time to hang out with ease</p>
          </div>
          
          <div className="flex flex-wrap items-center gap-3">
            <button 
              onClick={handleSyncCalendar}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-indigo-600 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors"
            >
              <Calendar className="w-4 h-4" />
              Import Google Cal
            </button>
            <button 
              onClick={handleShare}
              className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 rounded-lg hover:bg-indigo-700 transition-colors shadow-sm"
            >
              <Share2 className="w-4 h-4" />
              Share Invite
            </button>
          </div>
        </header>

        {/* Main Content */}
        <div className="bg-white rounded-2xl shadow-sm border border-slate-100 overflow-hidden">
          
          {/* Tabs & Legend */}
          <div className="p-4 border-b border-slate-100 flex flex-col md:flex-row justify-between items-center gap-4 bg-slate-50/50">
            <div className="flex bg-slate-200/50 p-1 rounded-lg">
              <button
                onClick={() => setView('personal')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  view === 'personal' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <User className="w-4 h-4" />
                My Availability
              </button>
              <button
                onClick={() => setView('group')}
                className={`flex items-center gap-2 px-4 py-2 text-sm font-medium rounded-md transition-all ${
                  view === 'group' ? 'bg-white shadow-sm text-indigo-600' : 'text-slate-600 hover:text-slate-900'
                }`}
              >
                <Users className="w-4 h-4" />
                Group Overlap
              </button>
            </div>

            <div className="flex items-center gap-4 text-xs font-medium text-slate-600">
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-emerald-400"></div> Free
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-amber-300"></div> Can Skip
              </span>
              <span className="flex items-center gap-1.5">
                <div className="w-3 h-3 rounded-full bg-rose-400"></div> Busy
              </span>
            </div>
          </div>

          {/* Instructions */}
          {view === 'personal' && (
            <div className="px-6 py-3 bg-indigo-50/50 text-indigo-700 text-sm border-b border-indigo-100">
              <strong>Tip:</strong> Hover over a slot and select your availability. Click an active color again to clear it.
            </div>
          )}
          {view === 'group' && (
            <div className="px-6 py-3 bg-emerald-50/50 text-emerald-700 text-sm border-b border-emerald-100">
              Showing combined availability for <strong>You, Alice, and Bob</strong>. Look for the green slots!
            </div>
          )}

          {/* Calendar Grid */}
          <div className="overflow-x-auto">
            <div className="min-w-[600px]">
              {/* Header Row (Days) */}
              <div 
                className="grid border-b border-slate-200 bg-slate-500 text-slate-100 font-medium text-sm"
                style={{ gridTemplateColumns: `80px repeat(${DAYS.length}, minmax(0, 1fr))` }}
              >
                <div className="p-3 border-r border-slate-200 flex items-center justify-center">Time</div>
                {DAYS.map(day => (
                  <div key={day} className="p-3 text-center border-r border-slate-200">{day}</div>
                ))}
              </div>

              {/* Grid Body */}
              <div className="relative">
                {HOURS.map(hour => {
                  const displayHour = hour > 12 ? `${hour - 12} PM` : hour === 12 ? '12 PM' : `${hour} AM`;
                  return (
                    <div 
                      key={hour} 
                      className="grid group"
                      style={{ gridTemplateColumns: `80px repeat(${DAYS.length}, minmax(0, 1fr))` }}
                    >
                      {/* Time Label */}
                      <div className="border-r border-b border-slate-200 p-2 text-xs text-slate-400 text-right pr-4 bg-white flex items-center justify-end">
                        {displayHour}
                      </div>
                      
                      {/* Day Cells */}
                      {DAYS.map(day => renderCell(day, hour))}
                    </div>
                  );
                })}
              </div>
            </div>
          </div>
          
        </div>
      </div>
    </div>
  );
}