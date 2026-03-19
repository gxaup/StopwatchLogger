// Main Application Logic
const state = {
  currentUser: null,
  activeSession: {
    inspector: '',
    supervisor: '',
    stopNum: '',
    startTime: null,
    endTime: null,
    violations: []
  },
  editingViolationIndex: null,
  editingSavedReportIndex: null,
  timePickerCallback: null,
  savedReports: []
};

const elements = {
  // Navigation & Forms
  usernameInput: document.getElementById('username'),
  supervisorInput: document.getElementById('supervisor-name'),
  stopNumInput: document.getElementById('stop-num'),
  startTimeInput: document.getElementById('time-started'),
  sessionSupervisor: document.getElementById('session-supervisor-display'),
  sessionStop: document.getElementById('session-stop-display'),
  sessionStart: document.getElementById('session-start-time-display'),
  violationList: document.getElementById('violation-log-list'),
  resumeBtn: document.getElementById('btn-resume'),
  savedReportsList: document.getElementById('saved-stopwatches-list'),
  welcomeMessage: document.getElementById('welcome-message'),
  
  // Modals
  customModal: document.getElementById('custom-violation-modal'),
  customInput: document.getElementById('custom-violation-input'),
  detailModal: document.getElementById('violation-detail-modal'),
  detailTime: document.getElementById('detail-time-input'),
  detailNotes: document.getElementById('detail-notes-input'),
  detailNotesLabel: document.getElementById('detail-notes-label'),
  detailTitle: document.getElementById('detail-modal-title'),
  detailBusOptions: document.getElementById('bus-dispatch-options'),
  checkLate: document.getElementById('check-late'),
  checkNoInput: document.getElementById('check-no-input'),
  
  editSessionModal: document.getElementById('edit-session-modal'),
  editSupervisor: document.getElementById('edit-supervisor-input'),
  editStopNum: document.getElementById('edit-stop-num-input'),
  editStartTime: document.getElementById('edit-start-time-input'),

  // Time Picker
  timePicker: document.getElementById('time-picker-modal'),
  hourCol: document.getElementById('picker-hour-col'),
  minCol: document.getElementById('picker-minute-col'),
  ampmCol: document.getElementById('picker-ampm-col')
};

const views = {
  login: document.getElementById('login-view'),
  dashboard: document.getElementById('dashboard-view'),
  new: document.getElementById('new-stopwatch-view'),
  details: document.getElementById('stopwatch-session-details-view'),
  history: document.getElementById('stopwatches-view')
};

// Formatting helpers
const formatTimeHM = (date = new Date()) => {
  return date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit', hour12: true });
};

const parseTimeToMinutes = (timeStr) => {
  if (!timeStr) return 0;
  const parts = timeStr.trim().split(' ');
  if (parts.length < 2) return 0;
  const [time, period] = parts;
  let [h, m] = time.split(':').map(Number);
  if (period === 'PM' && h < 12) h += 12;
  if (period === 'AM' && h === 12) h = 0;
  return h * 60 + m;
};

// Persistence Logic
const STORAGE_KEY = 'supervisor_stopwatch_session';
const USER_KEY = 'supervisor_stopwatch_user';
const REPORTS_LIST_KEY = 'supervisor_stopwatch_reports_list';
const API_BASE = `http://${window.location.hostname}:3001/api`;

function saveLocalSession() {
  localStorage.setItem(STORAGE_KEY, JSON.stringify(state.activeSession));
}

function loadLocalSession() {
  const savedSession = localStorage.getItem(STORAGE_KEY);
  const savedReports = localStorage.getItem(REPORTS_LIST_KEY);
  
  if (savedReports) {
    state.savedReports = JSON.parse(savedReports);
  }

  if (savedSession) {
    const session = JSON.parse(savedSession);
    if (session.inspector === state.currentUser && (session.supervisor || session.violations.length > 0)) {
      state.activeSession = session;
      elements.resumeBtn.classList.remove('hidden');
    } else {
      elements.resumeBtn.classList.add('hidden');
    }
  } else {
    elements.resumeBtn.classList.add('hidden');
  }
  
  renderSavedReportsList();
}

function clearLocalSession() {
  localStorage.removeItem(STORAGE_KEY);
}

// Backend Sync
async function syncReportToBackend(report) {
  try {
    const res = await fetch(`${API_BASE}/reports`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(report)
    });
    return res.ok;
  } catch (err) {
    return false;
  }
}

async function saveReportToList(session) {
  const reportObj = {
    ...session,
    inspector: state.currentUser,
    id: session.id || Date.now(),
    date: session.date || new Date().toLocaleDateString(),
    synced: false
  };
  
  reportObj.synced = await syncReportToBackend(reportObj);
  
  if (state.editingSavedReportIndex !== null) {
    state.savedReports[state.editingSavedReportIndex] = reportObj;
    state.editingSavedReportIndex = null;
  } else {
    state.savedReports.unshift(reportObj);
  }
  
  localStorage.setItem(REPORTS_LIST_KEY, JSON.stringify(state.savedReports));
  renderSavedReportsList();
}

function renderSavedReportsList() {
  elements.savedReportsList.innerHTML = '';
  const userReports = state.savedReports.filter(r => r.inspector === state.currentUser);
  
  if (userReports.length === 0) {
    elements.savedReportsList.innerHTML = '<li class="subtitle" style="text-align:center; padding: 2rem;">No reports found for this account.</li>';
    return;
  }

  userReports.forEach((report) => {
    const actualIndex = state.savedReports.findIndex(r => r.id === report.id);
    const li = document.createElement('li');
    li.className = 'log-item';
    li.innerHTML = `
      <div class="log-content">
        <span class="type">${report.supervisor} ${report.synced ? '<span class="sync-status">✓</span>' : ''}</span>
        <span class="log-notes">Stop #${report.stopNum} • ${report.date}</span>
      </div>
      <div class="log-meta">
        <button class="icon-btn-sm btn-download-report" title="Download">
          <svg class="icon-sm"><use href="#icon-download" /></svg>
        </button>
        <button class="icon-btn-sm btn-edit-report" title="Edit">
          <svg class="icon-sm"><use href="#icon-pencil" /></svg>
        </button>
      </div>
    `;
    
    li.querySelector('.btn-download-report').onclick = () => {
      const reportText = generateReportTextFromSession(report);
      downloadReport(reportText, report);
    };
    
    li.querySelector('.btn-edit-report').onclick = () => {
      state.activeSession = JSON.parse(JSON.stringify(report));
      state.editingSavedReportIndex = actualIndex;
      updateSessionDisplay();
      renderViolationList();
      showView('details');
    };
    
    elements.savedReportsList.appendChild(li);
  });
}

// Initialize
function init() {
  setupTimePicker();
  setupEventListeners();
  setupKeyboardShortcuts();
}

// Time Picker Component
function setupTimePicker() {
  for (let i = 1; i <= 12; i++) {
    const div = document.createElement('div');
    div.className = 'time-option';
    div.dataset.val = i;
    div.textContent = i;
    elements.hourCol.appendChild(div);
  }
  for (let i = 0; i < 60; i++) {
    const div = document.createElement('div');
    div.className = 'time-option';
    const val = i.toString().padStart(2, '0');
    div.dataset.val = val;
    div.textContent = val;
    elements.minCol.appendChild(div);
  }

  [elements.hourCol, elements.minCol, elements.ampmCol].forEach(col => {
    col.addEventListener('scroll', () => {
      const center = col.scrollTop + col.clientHeight / 2;
      const options = col.querySelectorAll('.time-option');
      let best = null;
      let minDiff = 1000;
      
      options.forEach(opt => {
        const offset = opt.offsetTop + opt.clientHeight / 2;
        const diff = Math.abs(center - offset);
        if (diff < minDiff) {
          minDiff = diff;
          best = opt;
        }
      });
      if (best && !best.classList.contains('selected')) {
        options.forEach(o => o.classList.remove('selected'));
        best.classList.add('selected');
      }
    });
  });
}

function openTimePicker(initialTime, callback) {
  state.timePickerCallback = callback;
  elements.timePicker.classList.add('active');
  const parts = initialTime?.match(/(\d+):(\d+)\s(AM|PM)/);
  if (parts) {
    scrollColToValue(elements.hourCol, parseInt(parts[1]));
    scrollColToValue(elements.minCol, parts[2]);
    scrollColToValue(elements.ampmCol, parts[3]);
  } else {
    const nowParts = formatTimeHM().match(/(\d+):(\d+)\s(AM|PM)/);
    scrollColToValue(elements.hourCol, parseInt(nowParts[1]));
    scrollColToValue(elements.minCol, nowParts[2]);
    scrollColToValue(elements.ampmCol, nowParts[3]);
  }
}

function scrollColToValue(col, val) {
  const opt = Array.from(col.querySelectorAll('.time-option')).find(o => o.dataset.val == val);
  if (opt) {
    setTimeout(() => {
      col.scrollTop = opt.offsetTop - col.clientHeight / 2 + opt.clientHeight / 2;
    }, 50);
  }
}

function saveTimePicker() {
  const h = elements.hourCol.querySelector('.selected')?.dataset.val || '12';
  const m = elements.minCol.querySelector('.selected')?.dataset.val || '00';
  const ampm = elements.ampmCol.querySelector('.selected')?.dataset.val || 'AM';
  const formatted = `${h.padStart(2, '0')}:${m} ${ampm}`;
  if (state.timePickerCallback) state.timePickerCallback(formatted);
  elements.timePicker.classList.remove('active');
}

function setupEventListeners() {
  document.getElementById('btn-login-confirm').addEventListener('click', handleLogin);
  document.getElementById('btn-start-new').addEventListener('click', () => {
    clearLocalSession();
    elements.resumeBtn.classList.add('hidden');
    elements.supervisorInput.value = '';
    elements.stopNumInput.value = '';
    elements.startTimeInput.value = formatTimeHM();
    showView('new');
  });
  
  document.getElementById('btn-view-all').addEventListener('click', () => showView('history'));
  
  elements.resumeBtn.addEventListener('click', () => {
    updateSessionDisplay();
    renderViolationList();
    showView('details');
  });

  document.getElementById('btn-logout').addEventListener('click', () => {
    state.currentUser = null;
    elements.usernameInput.value = '';
    showView('login');
  });

  document.querySelectorAll('.btn-back').forEach(btn => {
    btn.addEventListener('click', () => showView(btn.dataset.target));
  });

  document.getElementById('btn-confirm-start').addEventListener('click', startSession);

  elements.startTimeInput.addEventListener('click', () => {
    openTimePicker(elements.startTimeInput.value, (val) => elements.startTimeInput.value = val);
  });
  elements.detailTime.addEventListener('click', () => {
    openTimePicker(elements.detailTime.value, (val) => elements.detailTime.value = val);
  });
  elements.editStartTime.addEventListener('click', () => {
    openTimePicker(elements.editStartTime.value, (val) => elements.editStartTime.value = val);
  });
  
  document.getElementById('btn-cancel-picker').addEventListener('click', () => elements.timePicker.classList.remove('active'));
  document.getElementById('btn-save-picker').addEventListener('click', saveTimePicker);

  document.querySelectorAll('.violation-btn, .violation-btn-sm').forEach(btn => {
    if (!btn.classList.contains('custom-btn')) {
      btn.addEventListener('click', () => openViolationDetail(btn.dataset.type));
    }
  });

  document.getElementById('btn-custom-violation').addEventListener('click', () => {
    elements.customModal.classList.add('active');
    setTimeout(() => elements.customInput.focus(), 100);
  });

  document.getElementById('btn-save-custom').addEventListener('click', () => {
    const val = elements.customInput.value.trim();
    if (val) {
      elements.customInput.value = '';
      elements.customModal.classList.remove('active');
      openViolationDetail(val);
    }
  });

  document.getElementById('btn-cancel-custom').addEventListener('click', () => elements.customModal.classList.remove('active'));
  document.getElementById('btn-save-detail').addEventListener('click', saveViolationDetail);
  document.getElementById('btn-cancel-detail').addEventListener('click', () => {
    elements.detailModal.classList.remove('active');
    elements.checkLate.checked = false;
    elements.checkNoInput.checked = false;
  });

  document.getElementById('btn-edit-session').addEventListener('click', openEditSession);
  document.getElementById('btn-save-edit-session').addEventListener('click', saveEditSession);
  document.getElementById('btn-cancel-edit-session').addEventListener('click', () => elements.editSessionModal.classList.remove('active'));

  document.getElementById('btn-finish-session').addEventListener('click', () => {
    openTimePicker(formatTimeHM(), (val) => finishSession(val));
  });
}

function handleLogin() {
  const user = elements.usernameInput.value.trim();
  if (user) {
    state.currentUser = user;
    elements.welcomeMessage.textContent = `Hello, ${user}`;
    loadLocalSession();
    showView('dashboard');
  } else {
    elements.usernameInput.style.borderColor = 'red';
    setTimeout(() => elements.usernameInput.style.borderColor = '', 1000);
  }
}

function setupKeyboardShortcuts() {
  window.addEventListener('keydown', (e) => {
    const activeModal = document.querySelector('.modal-overlay.active');
    if (e.key === 'Escape') {
      if (activeModal) activeModal.classList.remove('active');
      else if (views.new.classList.contains('active')) showView('dashboard');
      else if (views.history.classList.contains('active')) showView('dashboard');
      return;
    }
    if (e.key === 'Enter') {
      if (activeModal) {
        const saveBtn = activeModal.querySelector('.btn-primary');
        if (saveBtn) saveBtn.click();
        return;
      }
      if (views.login.classList.contains('active')) { handleLogin(); return; }
      if (views.new.classList.contains('active')) { startSession(); return; }
    }
  });
}

function showView(viewName) {
  Object.values(views).forEach(view => view.classList.remove('active'));
  views[viewName].classList.add('active');
}

function startSession() {
  const supervisor = elements.supervisorInput.value.trim();
  const stopNum = elements.stopNumInput.value.trim();
  const startTime = elements.startTimeInput.value.trim();
  if (supervisor && stopNum) {
    state.editingSavedReportIndex = null;
    state.activeSession = {
      inspector: state.currentUser,
      supervisor,
      stopNum,
      startTime,
      endTime: null,
      violations: []
    };
    updateSessionDisplay();
    renderViolationList();
    saveLocalSession();
    showView('details');
  } else {
    alert('Please fill in all fields');
  }
}

function updateSessionDisplay() {
  elements.sessionSupervisor.textContent = state.activeSession.supervisor;
  elements.sessionStop.textContent = state.activeSession.stopNum;
  elements.sessionStart.textContent = state.activeSession.startTime;
}

function openEditSession() {
  elements.editSupervisor.value = state.activeSession.supervisor;
  elements.editStopNum.value = state.activeSession.stopNum;
  elements.editStartTime.value = state.activeSession.startTime;
  elements.editSessionModal.classList.add('active');
}

function saveEditSession() {
  state.activeSession.supervisor = elements.editSupervisor.value.trim();
  state.activeSession.stopNum = elements.editStopNum.value.trim();
  state.activeSession.startTime = elements.editStartTime.value.trim();
  updateSessionDisplay();
  saveLocalSession();
  elements.editSessionModal.classList.remove('active');
}

function openViolationDetail(type, index = null) {
  state.editingViolationIndex = index;
  const isEditing = index !== null;
  const v = isEditing ? state.activeSession.violations[index] : null;

  elements.detailTitle.textContent = isEditing ? 'Edit Violation' : type;
  elements.detailTime.value = isEditing ? v.timestamp : formatTimeHM();
  elements.detailNotes.value = isEditing ? (v.notes || '') : '';
  
  // Custom Logic for Bus Dispatch
  if (type === 'Bus Dispatch') {
    elements.detailBusOptions.style.display = 'flex';
    elements.detailNotesLabel.textContent = 'Bus #';
    elements.checkLate.checked = isEditing ? (v.isLate || false) : false;
    elements.checkNoInput.checked = isEditing ? (v.noInput || false) : false;
  } else {
    elements.detailBusOptions.style.display = 'none';
    elements.detailNotesLabel.textContent = 'Notes (Optional)';
  }

  elements.detailModal.classList.add('active');
  setTimeout(() => elements.detailNotes.focus(), 100);
  if (!isEditing) elements.detailModal.dataset.currentType = type;
}

function saveViolationDetail() {
  const index = state.editingViolationIndex;
  const time = elements.detailTime.value.trim();
  const notes = elements.detailNotes.value.trim();
  const type = (index !== null) ? state.activeSession.violations[index].type : elements.detailModal.dataset.currentType;

  const violationData = {
    type,
    timestamp: time,
    notes: notes,
    sortMinutes: parseTimeToMinutes(time),
    isLate: elements.checkLate.checked,
    noInput: elements.checkNoInput.checked
  };

  if (index !== null) {
    state.activeSession.violations[index] = violationData;
  } else {
    state.activeSession.violations.push(violationData);
  }
  
  // Reset for next
  elements.checkLate.checked = false;
  elements.checkNoInput.checked = false;
  
  renderViolationList();
  saveLocalSession();
  elements.detailModal.classList.remove('active');
  state.editingViolationIndex = null;
}

function renderViolationList() {
  const count = state.activeSession.violations.length;
  const badge = document.getElementById('violation-count-badge');
  if (badge) badge.textContent = `${count} logged`;

  elements.violationList.innerHTML = '';
  
  if (count === 0) {
    elements.violationList.innerHTML = `
      <div class="empty-log-placeholder" style="text-align:center; padding: 3rem 1rem; opacity: 0.3;">
        <svg class="icon" style="width: 32px; height: 32px; margin-bottom: 0.5rem;"><use href="#icon-folder" /></svg>
        <p style="font-size: 0.75rem;">No violations logged yet</p>
      </div>
    `;
    return;
  }

  const sorted = [...state.activeSession.violations].sort((a,b) => b.sortMinutes - a.sortMinutes);
  sorted.forEach((v) => {
    const originalIndex = state.activeSession.violations.findIndex(orig => orig === v);
    const li = document.createElement('li');
    li.className = 'log-item';
    
    let typeLabel = v.type;
    if (v.type === 'Bus Dispatch') {
      if (v.isLate) typeLabel += ' (Late)';
      else if (v.noInput) typeLabel += ' (No Input)';
      else typeLabel += ' (On Time)';
    } else {
      if (v.isLate) typeLabel += ' (Late)';
      if (v.noInput) typeLabel += ' (No Input)';
    }

    li.innerHTML = `
      <div class="log-content">
        <span class="type">${typeLabel}</span>
        ${v.notes ? `<span class="log-notes">${v.type === 'Bus Dispatch' ? 'Bus #' : ''}${v.notes}</span>` : ''}
      </div>
      <div class="log-meta">
        <span class="time">${v.timestamp}</span>
        <button class="icon-btn-sm btn-edit-log">
          <svg class="icon-sm"><use href="#icon-pencil" /></svg>
        </button>
      </div>
    `;
    li.querySelector('.btn-edit-log').onclick = () => openViolationDetail(v.type, originalIndex);
    elements.violationList.appendChild(li);
  });
}

function finishSession(timeEnded) {
  state.activeSession.endTime = timeEnded;
  const reportText = generateReportTextFromSession(state.activeSession);
  downloadReport(reportText, state.activeSession);
  saveReportToList(state.activeSession);
  clearLocalSession();
  
  // Wait for download to trigger before reloading
  setTimeout(() => {
    alert('Session saved and downloaded.');
    location.reload();
  }, 300);
}

function generateReportTextFromSession(s) {
  const stripAMPM = (t) => t ? t.replace(/\s*(AM|PM)/gi, '') : t;
  
  let text = `SESSION DETAILS:\n`;
  text += `----------------\n`;
  text += `Date: ${s.date || new Date().toLocaleDateString()}\n`;
  text += `Supervisor: ${s.supervisor}\n`;
  text += `Stop #: ${s.stopNum}\n`;
  text += `Time Started: ${stripAMPM(s.startTime)}\n`;
  text += `Time Ended: ${stripAMPM(s.endTime)}\n\n\n`;
  text += `VIOLATIONS LOG:\n`;
  text += `---------------\n`;
  
  if (s.violations.length === 0) {
    text += `No violations recorded.\n`;
  } else {
    const sortedViolations = [...s.violations].sort((a,b) => a.sortMinutes - b.sortMinutes);
    const grouped = {};
    sortedViolations.forEach(v => {
      if (!grouped[v.type]) grouped[v.type] = [];
      grouped[v.type].push(v);
    });

    Object.keys(grouped).forEach(type => {
      if (type === 'Bus Dispatch') {
        const accurate = grouped[type].filter(v => !v.isLate && !v.noInput);
        const inaccurate = grouped[type].filter(v => v.isLate || v.noInput);
        
        if (accurate.length > 0) {
          const accStr = accurate.map(v => `${v.notes}(${stripAMPM(v.timestamp)})`).join(', ');
          text += `Accurate updates to dispatch: ${accStr}\n`;
        }
        if (inaccurate.length > 0) {
          const inaccStr = inaccurate.map(v => {
            const reasons = [];
            if (v.isLate) reasons.push('Late');
            if (v.noInput) reasons.push('Didnt Input');
            return `${v.notes}(${stripAMPM(v.timestamp)},${reasons.join('/')})`;
          }).join(', ');
          text += `Inaccurate updates to dispatch: ${inaccStr}\n`;
        }
      } else if (type === 'Uniform') {
        const notes = grouped[type].map(v => v.notes).filter(n => n.length > 0).join(', ');
        if (notes) text += `${notes}\n`;
      } else {
        const entries = `[` + grouped[type].map(v => {
          const noteStr = v.notes ? ` (${v.notes})` : ``;
          return `${stripAMPM(v.timestamp)}${noteStr}`;
        }).join(', ') + `]`;
        text += `${entries} || ${type}\n`;
      }
    });
  }
  return text;
}

function downloadReport(content, session) {
  const filename = `Report_${session.supervisor}_Stop${session.stopNum}.txt`;
  const blob = new Blob([content], { type: 'text/plain;charset=utf-8' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.style.display = 'none';
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  setTimeout(() => {
    a.click();
    setTimeout(() => {
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    }, 100);
  }, 50);
}

init();
