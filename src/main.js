// EduGATE Tracker Main Application Script
import { createClient } from '@supabase/supabase-js';

// --- SUPABASE CONFIGURATION ---
const SUPABASE_URL = "https://buvwejjdunmylsolqqsc.supabase.co";
const SUPABASE_ANON_KEY = "sb_publishable_Loi6ZlMPh7kD4DTGT4-qsw_XW3R2pU0";
const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY);

// --- CONSTANTS & CONFIGURATION ---
const SUBJECTS_CONFIG = {
  "General Aptitude": { target: 300, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "Engineering Mathematics": { target: 400, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "Dircrete Maths": { target: 650, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "Data Structures & Prog": { target: 450, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "Algorithms": { target: 400, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "COA": { target: 350, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "Operationg Systems": { target: 600, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "ToC": { target: 500, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "DBMS": { target: 450, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "Computer Networks": { target: 550, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "Digital Logic": { target: 300, baseDone: 0, baseRevised: 0, baseDoubts: 0 },
  "Compiler Design": { target: 200, baseDone: 0, baseRevised: 0, baseDoubts: 0 }
};

const DEFAULT_LOGS = [];
const DEFAULT_EXAMS = [];

// Calculate dynamic days left until GATE (Jan 5, 2027)
function calculateDaysLeft() {
  const gateDate = new Date("2027-01-05");
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const diffTime = gateDate - today;
  return Math.max(Math.ceil(diffTime / (1000 * 60 * 60 * 24)), 0);
}

const initialDaysLeft = calculateDaysLeft();

// --- APP STATE ---
let state = {
  logs: JSON.parse(localStorage.getItem("edugate_logs_v3")) || DEFAULT_LOGS,
  exams: JSON.parse(localStorage.getItem("edugate_exams_v3")) || DEFAULT_EXAMS,
  currentView: "dashboard",
  targetQuestions: initialDaysLeft * 35,
  daysLeft: initialDaysLeft
};

// --- CORE UTILITIES ---
function saveToStorage() {
  localStorage.setItem("edugate_logs_v3", JSON.stringify(state.logs));
  localStorage.setItem("edugate_exams_v3", JSON.stringify(state.exams));
}

// --- SUPABASE SYNCING CORE ---
function updateSyncStatus(status) {
  const dot = document.getElementById("sync-dot");
  const text = document.getElementById("sync-text");
  if (!dot || !text) return;
  
  if (status === "SYNCED") {
    dot.className = "w-1.5 h-1.5 rounded-full bg-green-500 animate-none";
    text.innerText = "SYNCED";
  } else if (status === "CONNECTING") {
    dot.className = "w-1.5 h-1.5 rounded-full bg-yellow-500 animate-pulse";
    text.innerText = "CONNECTING";
  } else if (status === "ERROR" || status === "OFFLINE") {
    dot.className = "w-1.5 h-1.5 rounded-full bg-red-500 animate-pulse";
    text.innerText = "ERROR / OFFLINE";
  }
}

async function syncLogs() {
  try {
    updateSyncStatus("CONNECTING");
    const { data, error } = await supabase.from('logs').select('*');
    if (error) throw error;
    
    if (data && data.length > 0) {
      const merged = [...state.logs];
      data.forEach(remoteItem => {
        const idx = merged.findIndex(l => l.id === remoteItem.id);
        if (idx !== -1) {
          merged[idx] = remoteItem;
        } else {
          merged.push(remoteItem);
        }
      });
      state.logs = merged;
      saveToStorage();
    }
    
    if (state.logs.length > 0) {
      const cleanLogs = state.logs.map(log => ({
        id: log.id,
        date: log.date,
        subject: log.subject,
        topics: log.topics,
        solved: parseInt(log.solved) || 0,
        revised: parseInt(log.revised) || 0,
        doubts: parseInt(log.doubts) || 0,
        status: log.status || 'NONE',
        source: log.source || ''
      }));
      const { error: upsertError } = await supabase.from('logs').upsert(cleanLogs);
      if (upsertError) throw upsertError;
    }
    
    updateSyncStatus("SYNCED");
  } catch (err) {
    console.error("Logs sync failed: ", err);
    updateSyncStatus("ERROR");
  }
}

async function syncExams() {
  try {
    updateSyncStatus("CONNECTING");
    const { data, error } = await supabase.from('exams').select('*');
    if (error) throw error;
    
    if (data && data.length > 0) {
      const merged = [...state.exams];
      data.forEach(remoteItem => {
        const idx = merged.findIndex(e => e.id === remoteItem.id);
        if (idx !== -1) {
          merged[idx] = remoteItem;
        } else {
          merged.push(remoteItem);
        }
      });
      state.exams = merged;
      saveToStorage();
    }
    
    if (state.exams.length > 0) {
      const cleanExams = state.exams.map(exam => ({
        id: exam.id,
        name: exam.name,
        date: exam.date,
        total: parseFloat(exam.total) || 100,
        attempted: parseFloat(exam.attempted) || 0,
        correct: parseFloat(exam.correct) || 0,
        wrong: parseInt(exam.wrong) || 0,
        negative: parseFloat(exam.negative) || 0,
        duration: parseInt(exam.duration) || 180
      }));
      const { error: upsertError } = await supabase.from('exams').upsert(cleanExams);
      if (upsertError) throw upsertError;
    }
    
    updateSyncStatus("SYNCED");
  } catch (err) {
    console.error("Exams sync failed: ", err);
    updateSyncStatus("ERROR");
  }
}

// Calculate streak based on daily logs
function getStreak() {
  if (state.logs.length === 0) return 0;
  
  // Sort logs by date descending
  const sortedLogs = [...state.logs].sort((a, b) => new Date(b.date) - new Date(a.date));
  
  let currentDate = new Date();
  currentDate.setHours(0, 0, 0, 0);
  
  const latestLogDate = new Date(sortedLogs[0].date);
  latestLogDate.setHours(0, 0, 0, 0);
  
  const diffTime = Math.abs(currentDate - latestLogDate);
  const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
  
  // If the last log is older than yesterday, active streak is 0
  if (diffDays > 1) {
    return 0; 
  }
  
  let streak = 1;
  let prevDate = latestLogDate;
  
  for (let i = 1; i < sortedLogs.length; i++) {
    const logDate = new Date(sortedLogs[i].date);
    logDate.setHours(0, 0, 0, 0);
    
    const diff = (prevDate - logDate) / (1000 * 60 * 60 * 24);
    if (diff === 1) {
      streak++;
      prevDate = logDate;
    } else if (diff > 1) {
      break;
    }
  }
  
  return streak;
}

// Calculate subject analytics dynamically combining configuration bases with user logs
function getSubjectAnalytics() {
  const analytics = {};
  
  // Initialize from base config
  for (const [subjectName, conf] of Object.entries(SUBJECTS_CONFIG)) {
    analytics[subjectName] = {
      target: conf.target,
      done: conf.baseDone,
      revised: conf.baseRevised,
      doubts: conf.baseDoubts
    };
  }
  
  // Accumulate from custom logs
  state.logs.forEach(log => {
    if (analytics[log.subject]) {
      analytics[log.subject].done += parseInt(log.solved || 0);
      analytics[log.subject].revised += parseInt(log.revised || 0);
      if (log.status === "PENDING") {
        analytics[log.subject].doubts += parseInt(log.doubts || 0);
      }
    }
  });
  
  return analytics;
}

// --- RENDERING ENGINES ---

// View Swapping
function switchView(viewId) {
  state.currentView = viewId;
  
  // Toggle sections
  document.querySelectorAll("main > div > section").forEach(section => {
    if (section.id === `view-${viewId}`) {
      section.classList.remove("hidden");
    } else {
      section.classList.add("hidden");
    }
  });

  // Toggle active styling on navigation items
  const navIds = ["dashboard", "daily-log", "master-progress", "exam-records"];
  navIds.forEach(id => {
    const navBtn = document.getElementById(`nav-${id}`);
    if (id === viewId) {
      navBtn.className = "w-full flex items-center gap-3 bg-surface-container-highest text-primary border-l-2 border-primary px-4 py-3 font-body-md text-body-md font-label-caps tab-link cursor-pointer";
    } else {
      navBtn.className = "w-full flex items-center gap-3 text-on-surface-variant px-4 py-3 hover:bg-surface-container-high transition-all font-body-md text-body-md font-label-caps tab-link cursor-pointer";
    }
  });

  // Update header title
  const titles = {
    "dashboard": "Overview Dashboard",
    "daily-log": "Daily Progress Log",
    "master-progress": "Master Progress Dashboard",
    "exam-records": "Exam Records"
  };
  document.getElementById("header-title").innerText = titles[viewId];
  
  // Trigger specific view renders
  renderApp();
}

// Render Heatmap (138 Days)
function renderHeatmap() {
  const container = document.getElementById("heatmap-container");
  if (!container) return;
  container.innerHTML = "";
  
  // Map of date strings to solved counts
  const dateMap = {};
  state.logs.forEach(log => {
    dateMap[log.date] = (dateMap[log.date] || 0) + parseInt(log.solved || 0);
  });
  
  // Create 138 squares ending today
  const today = new Date();
  for (let i = 137; i >= 0; i--) {
    const date = new Date(today);
    date.setDate(today.getDate() - i);
    const dateStr = date.toISOString().split("T")[0];
    const solvedCount = dateMap[dateStr] || 0;
    
    const square = document.createElement("div");
    square.className = "heatmap-square";
    square.title = `${dateStr}: ${solvedCount} questions solved`;
    
    // Assign color intensity class
    if (solvedCount === 0) {
      square.classList.add("bg-surface-container-highest");
    } else if (solvedCount < 15) {
      square.classList.add("bg-[#E6394633]");
    } else if (solvedCount < 30) {
      square.classList.add("bg-[#E6394688]");
    } else {
      square.classList.add("bg-[#E63946]");
    }
    
    container.appendChild(square);
  }
}

// Render Dashboard View
function renderDashboard() {
  const analytics = getSubjectAnalytics();
  
  // 1. Total questions solved
  let totalSolved = 0;
  for (const subject of Object.values(analytics)) {
    totalSolved += subject.done;
  }
  document.getElementById("dash-questions-done").innerText = totalSolved.toLocaleString();
  
  // 2. Overall progress
  const progressPercent = Math.min(((totalSolved / state.targetQuestions) * 100), 100).toFixed(1);
  document.getElementById("dash-overall-progress-text").innerText = `${progressPercent}%`;
  document.getElementById("dash-overall-progress-bar").style.width = `${progressPercent}%`;
  
  // 3. Streak
  const streak = getStreak();
  document.getElementById("dash-streak").innerText = `${streak} DAYS`;
  
  // 4. Required Qns/Day
  const remainingQns = Math.max(state.targetQuestions - totalSolved, 0);
  const reqPerDay = Math.ceil(remainingQns / state.daysLeft);
  document.getElementById("dash-req-qns-day").innerText = reqPerDay;
  
  // 5. Subject proficiency list
  const profContainer = document.getElementById("subject-proficiency-container");
  if (profContainer) {
    profContainer.innerHTML = "";
    
    // Sort subjects by proficiency descending
    const sortedSubjects = Object.entries(analytics).map(([name, data]) => {
      const pct = Math.min(((data.done / data.target) * 100), 100);
      return { name, pct, ...data };
    }).sort((a, b) => b.pct - a.pct);
    
    sortedSubjects.forEach(sub => {
      const row = document.createElement("div");
      row.className = "subject-row p-2 rounded transition-colors";
      row.innerHTML = `
        <div class="flex justify-between mb-1">
          <span class="text-body-md font-body-md">${sub.name}</span>
          <span class="font-data-mono text-data-mono text-primary">${Math.round(sub.pct)}%</span>
        </div>
        <div class="w-full bg-outline-variant h-1.5 rounded-full overflow-hidden">
          <div class="bg-primary-container h-full" style="width: ${sub.pct}%"></div>
        </div>
      `;
      profContainer.appendChild(row);
    });
  }
  
  // 6. Oldest pending doubts list
  const doubtsList = document.getElementById("dash-doubts-list");
  if (doubtsList) {
    doubtsList.innerHTML = "";
    
    // Get doubts from logs
    const pendingDoubts = state.logs
      .filter(log => log.status === "PENDING" && log.doubts > 0)
      .sort((a, b) => new Date(a.date) - new Date(b.date)); // oldest first
      
    if (pendingDoubts.length === 0) {
      doubtsList.innerHTML = `
        <div class="p-6 bg-surface-container-low border border-dashed border-outline-variant text-center text-on-surface-variant font-body-sm">
          No pending doubts. Great job!
        </div>
      `;
    } else {
      pendingDoubts.slice(0, 3).forEach(doubt => {
        // Calculate days pending
        const diffTime = Math.abs(new Date() - new Date(doubt.date));
        const diffDays = Math.ceil(diffTime / (1000 * 60 * 60 * 24));
        
        const card = document.createElement("div");
        card.className = "p-3 bg-surface-container-low border-l-2 border-primary-container flex justify-between items-start";
        card.innerHTML = `
          <div>
            <div class="text-label-caps font-label-caps text-primary-container uppercase">${doubt.subject}</div>
            <div class="text-body-md font-body-md mt-0.5">${doubt.topics}</div>
            <div class="text-label-caps font-label-caps text-on-surface-variant mt-2">${diffDays} DAYS PENDING</div>
          </div>
          <button onclick="resolveDoubt('${doubt.id}')" class="bg-on-primary-container text-primary-fixed text-[10px] px-2 py-1 font-bold uppercase tracking-wider hover:brightness-125 transition-all">
            RESOLVE
          </button>
        `;
        doubtsList.appendChild(card);
      });
    }
  }
  
  renderHeatmap();
}

// Render Daily Log View
function renderDailyLog() {
  document.getElementById("log-streak").innerText = `${getStreak()} DAYS`;
  
  // Total Solved Count
  const analytics = getSubjectAnalytics();
  let totalSolved = 0;
  for (const subject of Object.values(analytics)) {
    totalSolved += subject.done;
  }
  document.getElementById("log-total-solved").innerText = totalSolved.toLocaleString();
  
  // Render logs table
  const tbody = document.getElementById("logs-table-body");
  if (tbody) {
    tbody.innerHTML = "";
    
    if (state.logs.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="8" class="px-6 py-8 text-center text-on-surface-variant">
            No study sessions logged yet. Use the form above to add an entry!
          </td>
        </tr>
      `;
    } else {
      // Sort logs by date descending
      const sortedLogs = [...state.logs].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      sortedLogs.forEach(log => {
        const tr = document.createElement("tr");
        tr.className = "hover:bg-surface-bright transition-colors group";
        
        // Status Badge Style
        let statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-secondary-container text-on-secondary-container">NONE</span>`;
        if (log.status === "PENDING") {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-error-container text-on-error-container">PENDING</span>`;
        } else if (log.status === "CLARIFIED") {
          statusBadge = `<span class="px-2 py-0.5 rounded text-[10px] font-bold bg-surface-container-highest text-primary">CLARIFIED</span>`;
        }
        
        tr.innerHTML = `
          <td class="px-6 py-3 text-data-mono font-data-mono text-secondary">${formatDate(log.date)}</td>
          <td class="px-6 py-3 text-body-md font-medium text-on-surface">${log.subject}</td>
          <td class="px-6 py-3 text-body-sm text-on-surface-variant">${log.topics}</td>
          <td class="px-6 py-3 text-center text-data-mono font-data-mono text-primary">${log.solved}</td>
          <td class="px-6 py-3 text-center text-data-mono font-data-mono text-tertiary">${log.revised}</td>
          <td class="px-6 py-3 text-center text-data-mono font-data-mono text-error">${log.doubts}</td>
          <td class="px-6 py-3">${statusBadge}</td>
          <td class="px-6 py-3 text-right">
            <button onclick="deleteLog('${log.id}')" class="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </td>
        `;
        tbody.appendChild(tr);
      });
      
      document.getElementById("logs-count-footer").innerText = `Showing 1-${sortedLogs.length} of ${sortedLogs.length} entries`;
    }
  }
  
  // Weekly chart rendering
  renderWeeklyChart();
  
  // Effort by subject breakdown
  renderEffortBreakdown();
}

// Render Weekly Activity Intensity Chart
function renderWeeklyChart() {
  const container = document.getElementById("weekly-chart-container");
  if (!container) return;
  container.innerHTML = "";
  
  const weekdays = ["SUN", "MON", "TUE", "WED", "THU", "FRI", "SAT"];
  const counts = Array(7).fill(0);
  
  // Get logs in current week
  const today = new Date();
  const currentDay = today.getDay();
  const startOfWeek = new Date(today);
  startOfWeek.setDate(today.getDate() - currentDay);
  startOfWeek.setHours(0, 0, 0, 0);
  
  state.logs.forEach(log => {
    const logDate = new Date(log.date);
    if (logDate >= startOfWeek) {
      const dayIndex = logDate.getDay();
      counts[dayIndex] += parseInt(log.solved || 0);
    }
  });
  
  // Render bars
  const maxCount = Math.max(...counts, 10);
  weekdays.forEach((day, idx) => {
    const count = counts[idx];
    const pct = Math.min((count / maxCount) * 100, 100);
    
    // Choose styling based on intensity
    let colorClass = "bg-surface-container-high";
    if (count > 0 && count < 15) colorClass = "bg-[#e4bebc44]";
    else if (count >= 15 && count < 30) colorClass = "bg-[#e4bebc88]";
    else if (count >= 30) colorClass = "bg-primary";
    
    const dayCol = document.createElement("div");
    dayCol.className = "flex-1 space-y-2 flex flex-col items-center justify-end";
    dayCol.innerHTML = `
      <div class="w-full bg-surface-container-low h-20 rounded border border-outline-variant/30 relative flex items-end overflow-hidden">
        <div class="${colorClass} w-full transition-all duration-500" style="height: ${pct}%" title="${count} solved"></div>
      </div>
      <span class="text-[10px] font-label-caps text-on-surface-variant">${day}</span>
    `;
    container.appendChild(dayCol);
  });
}

// Render Effort by Subject Breakdown
function renderEffortBreakdown() {
  const container = document.getElementById("effort-breakdown-container");
  if (!container) return;
  container.innerHTML = "";
  
  const analytics = getSubjectAnalytics();
  const subjectSums = {};
  let totalEffort = 0;
  
  state.logs.forEach(log => {
    subjectSums[log.subject] = (subjectSums[log.subject] || 0) + parseInt(log.solved || 0);
    totalEffort += parseInt(log.solved || 0);
  });
  
  if (totalEffort === 0) {
    container.innerHTML = `
      <div class="text-center text-on-surface-variant font-body-sm py-4">
        Log entries to see subject distribution.
      </div>
    `;
    return;
  }
  
  // Sort subjects by effort descending
  const sortedEffort = Object.entries(subjectSums)
    .map(([name, sum]) => ({ name, sum, pct: (sum / totalEffort) * 100 }))
    .sort((a, b) => b.sum - a.sum)
    .slice(0, 3); // show top 3
    
  sortedEffort.forEach((item, idx) => {
    const colorClasses = ["bg-primary", "bg-primary-container", "bg-tertiary-container"];
    const color = colorClasses[idx] || "bg-[#2a3547]";
    
    const card = document.createElement("div");
    card.innerHTML = `
      <div class="flex justify-between text-body-sm mb-1">
        <span class="truncate pr-2">${item.name}</span>
        <span class="text-data-mono font-data-mono">${Math.round(item.pct)}%</span>
      </div>
      <div class="w-full bg-outline-variant h-1.5 rounded-full overflow-hidden">
        <div class="${color} h-full" style="width: ${item.pct}%"></div>
      </div>
    `;
    container.appendChild(card);
  });
}

// Render Master Progress View
function renderMasterProgress() {
  const analytics = getSubjectAnalytics();
  
  // Top summary metrics
  let totalSolved = 0;
  let totalTarget = 0;
  let totalRevised = 0;
  let totalDoubts = 0;
  
  for (const subject of Object.values(analytics)) {
    totalSolved += subject.done;
    totalTarget += subject.target;
    totalRevised += subject.revised;
    totalDoubts += subject.doubts;
  }
  
  const completionPct = ((totalSolved / totalTarget) * 100).toFixed(1);
  document.getElementById("master-completion").innerText = `${completionPct}%`;
  document.getElementById("master-target").innerText = totalTarget.toLocaleString();
  document.getElementById("master-revised").innerText = `${totalRevised} Topics`;
  document.getElementById("master-doubts").innerText = totalDoubts.toLocaleString();
  
  if (totalDoubts > 10) {
    document.getElementById("master-doubts").className = "font-data-lg text-data-lg text-error";
  } else {
    document.getElementById("master-doubts").className = "font-data-lg text-data-lg text-secondary";
  }
  
  // Render Table
  const tbody = document.getElementById("master-progress-table-body");
  if (tbody) {
    tbody.innerHTML = "";
    
    Object.entries(analytics).forEach(([name, data]) => {
      const pct = Math.min(((data.done / data.target) * 100), 100).toFixed(1);
      
      // Determine bar color based on progress thresholds
      let barColor = "bg-error-container";
      let textClass = "text-error";
      if (pct >= 80) {
        barColor = "bg-primary";
        textClass = "text-primary";
      } else if (pct >= 30) {
        barColor = "bg-primary-container";
        textClass = "text-primary-container";
      }
      
      const tr = document.createElement("tr");
      tr.className = "hover:bg-surface-container-highest transition-colors cursor-pointer";
      tr.innerHTML = `
        <td class="p-table-cell-padding font-headline-sm text-body-md text-on-surface">${name}</td>
        <td class="p-table-cell-padding font-data-mono text-data-mono">${data.target}</td>
        <td class="p-table-cell-padding font-data-mono text-data-mono">${data.done}</td>
        <td class="p-table-cell-padding">
          <div class="flex items-center gap-3">
            <div class="flex-1 h-2 bg-surface-container-highest rounded-full overflow-hidden">
              <div class="h-full ${barColor}" style="width: ${pct}%"></div>
            </div>
            <span class="font-data-mono text-data-mono ${textClass}">${pct}%</span>
          </div>
        </td>
        <td class="p-table-cell-padding font-data-mono text-data-mono text-secondary">${data.revised} Topics</td>
        <td class="p-table-cell-padding font-data-mono text-data-mono ${data.doubts > 0 ? 'text-error font-bold' : 'text-on-surface-variant'}">${data.doubts.toString().padStart(2, '0')}</td>
      `;
      
      tr.addEventListener("click", () => {
        tr.classList.toggle("bg-surface-container-highest");
      });
      
      tbody.appendChild(tr);
    });
  }
  
  // Custom Dynamic Strategy Note
  const strategyText = document.getElementById("strategy-note-text");
  if (strategyText) {
    const subjects = Object.entries(analytics);
    const lowProgress = subjects
      .map(([name, d]) => ({ name, pct: (d.done / d.target) * 100 }))
      .filter(item => item.pct < 40)
      .map(item => item.name);
      
    if (lowProgress.length > 0) {
      strategyText.innerHTML = `
        Progress is updated in real-time. Action recommended: Focus on <span class="text-error font-bold italic">${lowProgress.slice(0, 2).join(" and ")}</span> where completion is below 40% to balance your GATE preparation and score well in mock tests.
      `;
    } else {
      strategyText.innerHTML = `
        Your preparation is well-balanced across all subjects! Continue logging daily study sessions and solving mock tests to maintain your edge.
      `;
    }
  }
}

// Render Exam Records View
function renderExamRecords() {
  const totalAttempts = state.exams.length;
  document.getElementById("exam-attempts-header").innerText = totalAttempts;
  
  // Calculate average percentile
  let avgPercentile = 0;
  if (totalAttempts > 0) {
    const sum = state.exams.reduce((acc, exam) => {
      const net = exam.correct - exam.negative;
      const pct = (net / exam.total) * 100;
      return acc + pct;
    }, 0);
    avgPercentile = (sum / totalAttempts).toFixed(1);
  }
  document.getElementById("exam-percentile-header").innerText = `${avgPercentile}%`;
  
  // Render attempts table
  const tbody = document.getElementById("exam-table-body");
  if (tbody) {
    tbody.innerHTML = "";
    
    if (state.exams.length === 0) {
      tbody.innerHTML = `
        <tr>
          <td colspan="7" class="p-6 text-center text-on-surface-variant">
            No mock tests recorded yet. Record your first attempt above!
          </td>
        </tr>
      `;
    } else {
      // Sort exams by date descending
      const sortedExams = [...state.exams].sort((a, b) => new Date(b.date) - new Date(a.date));
      
      sortedExams.forEach(exam => {
        const net = (exam.correct - exam.negative).toFixed(2);
        const pct = Math.min(((net / exam.total) * 100), 100).toFixed(1);
        
        let barColor = "bg-gate-red";
        if (pct >= 85) barColor = "bg-[#38bdf8]";
        
        const tr = document.createElement("tr");
        tr.className = "hover:bg-[#1E2A38] transition-colors group cursor-pointer";
        tr.innerHTML = `
          <td class="p-4 font-body-md text-body-md">${exam.name}</td>
          <td class="p-4 font-data-mono text-data-mono text-on-surface-variant">${exam.date}</td>
          <td class="p-4 font-data-mono text-data-mono">${exam.attempted} / ${exam.total}</td>
          <td class="p-4 font-data-mono text-data-mono text-primary font-bold">${net}</td>
          <td class="p-4 font-data-mono text-data-mono">${exam.duration}m</td>
          <td class="p-4">
            <div class="flex items-center gap-3">
              <div class="flex-1 bg-[#2A3947] h-1.5 w-24">
                <div class="${barColor} h-full" style="width: ${pct}%"></div>
              </div>
              <span class="font-data-mono text-data-mono">${pct}%</span>
            </div>
          </td>
          <td class="p-4 text-right">
            <button onclick="deleteExam('${exam.id}')" class="opacity-0 group-hover:opacity-100 text-on-surface-variant hover:text-error transition-all">
              <span class="material-symbols-outlined text-[18px]">delete</span>
            </button>
          </td>
        `;
        
        tbody.appendChild(tr);
      });
      
      document.getElementById("exams-count-footer").innerText = `Showing 1-${sortedExams.length} of ${sortedExams.length} records`;
    }
  }
  
  // Render score trends chart
  renderScoreTrends();
  
  // Render Time Management metrics
  renderTimeManagement();
}

// Render score trend bars
function renderScoreTrends() {
  const container = document.getElementById("score-trends-container");
  if (!container) return;
  container.innerHTML = "";
  
  if (state.exams.length === 0) {
    container.innerHTML = `
      <div class="w-full h-full flex items-center justify-center text-on-surface-variant text-body-sm">
        Log test attempts to view trends.
      </div>
    `;
    return;
  }
  
  // Get last 8 exams chronologically (oldest first)
  const chronologicalExams = [...state.exams]
    .sort((a, b) => new Date(a.date) - new Date(b.date))
    .slice(-8);
    
  chronologicalExams.forEach(exam => {
    const net = exam.correct - exam.negative;
    const pct = Math.max(Math.min((net / exam.total) * 100, 100), 0);
    
    const barCol = document.createElement("div");
    barCol.className = "flex-1 flex flex-col items-center justify-end h-full group/bar relative";
    
    let colorClass = "bg-gate-red opacity-60";
    if (pct >= 85) colorClass = "bg-[#38bdf8] opacity-80";
    else if (pct >= 70) colorClass = "bg-primary opacity-80";
    
    barCol.innerHTML = `
      <div class="absolute bottom-full mb-1 bg-surface-container-highest text-white text-[9px] px-1 py-0.5 rounded opacity-0 group-hover/bar:opacity-100 transition-opacity z-20 pointer-events-none truncate max-w-[80px]">
        ${pct.toFixed(0)}% (${exam.name})
      </div>
      <div class="${colorClass} w-full transition-all duration-500 rounded-t-sm" style="height: ${pct}%" title="${exam.name}: ${pct.toFixed(1)}%"></div>
    `;
    container.appendChild(barCol);
  });
}

// Render Time Management metrics
function renderTimeManagement() {
  if (state.exams.length === 0) {
    document.getElementById("stat-avg-speed").innerText = "0.0 min/qn";
    document.getElementById("bar-avg-speed").style.width = "0%";
    document.getElementById("stat-accuracy").innerText = "0%";
    document.getElementById("bar-accuracy").style.width = "0%";
    document.getElementById("stat-negative").innerText = "0 avg";
    document.getElementById("bar-negative").style.width = "0%";
    return;
  }
  
  let totalSpeed = 0;
  let totalCorrect = 0;
  let totalAttempted = 0;
  let totalNegative = 0;
  
  state.exams.forEach(exam => {
    if (exam.attempted > 0) {
      totalSpeed += exam.duration / exam.attempted;
      totalCorrect += exam.correct; // mapping correct count/score
      totalAttempted += exam.attempted;
    }
    totalNegative += exam.negative;
  });
  
  const avgSpeed = (totalSpeed / state.exams.length).toFixed(1);
  const accuracy = Math.round((totalCorrect / totalAttempted) * 100);
  const avgNegative = (totalNegative / state.exams.length).toFixed(2);
  
  // Update speeds
  document.getElementById("stat-avg-speed").innerText = `${avgSpeed} min/qn`;
  const speedPct = Math.min((avgSpeed / 4) * 100, 100); // map relative to a 4min max
  document.getElementById("bar-avg-speed").style.width = `${speedPct}%`;
  
  // Update Accuracy
  document.getElementById("stat-accuracy").innerText = `${accuracy}%`;
  document.getElementById("bar-accuracy").style.width = `${accuracy}%`;
  
  // Update Negatives
  document.getElementById("stat-negative").innerText = `-${avgNegative} avg`;
  const negativePct = Math.min((avgNegative / 10) * 100, 100); // map relative to a 10 marks max
  document.getElementById("bar-negative").style.width = `${negativePct}%`;
}

// Global App Update
function renderApp() {
  if (state.currentView === "dashboard") {
    renderDashboard();
  } else if (state.currentView === "daily-log") {
    renderDailyLog();
  } else if (state.currentView === "master-progress") {
    renderMasterProgress();
  } else if (state.currentView === "exam-records") {
    renderExamRecords();
  }
}

// Helper date formatter
function formatDate(dateString) {
  const date = new Date(dateString);
  const options = { day: 'numeric', month: 'short', year: 'numeric' };
  return date.toLocaleDateString('en-GB', options).toUpperCase();
}

// --- ACTIONS & HANDLERS ---

// Delete log entry
window.deleteLog = async function(id) {
  state.logs = state.logs.filter(log => log.id !== id);
  saveToStorage();
  renderApp();
  try {
    const { error } = await supabase.from('logs').delete().eq('id', id);
    if (error) throw error;
    updateSyncStatus("SYNCED");
  } catch (err) {
    console.error("Failed to delete log in Supabase: ", err);
    updateSyncStatus("ERROR");
  }
};

// Delete exam record
window.deleteExam = async function(id) {
  state.exams = state.exams.filter(exam => exam.id !== id);
  saveToStorage();
  renderApp();
  try {
    const { error } = await supabase.from('exams').delete().eq('id', id);
    if (error) throw error;
    updateSyncStatus("SYNCED");
  } catch (err) {
    console.error("Failed to delete exam in Supabase: ", err);
    updateSyncStatus("ERROR");
  }
};

// Clear All Logs
document.getElementById("btn-clear-logs").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all log entries? This will reset your dashboard statistics.")) {
    state.logs = [];
    saveToStorage();
    renderApp();
  }
});

// Clear All Exams
document.getElementById("btn-clear-exams").addEventListener("click", () => {
  if (confirm("Are you sure you want to clear all mock exam records?")) {
    state.exams = [];
    saveToStorage();
    renderApp();
  }
});

// Resolve doubt from dashboard quick list
window.resolveDoubt = function(id) {
  const logIndex = state.logs.findIndex(log => log.id === id);
  if (logIndex !== -1) {
    state.logs[logIndex].status = "CLARIFIED";
    saveToStorage();
    renderApp();
    try {
      const cleanLog = {
        id: state.logs[logIndex].id,
        date: state.logs[logIndex].date,
        subject: state.logs[logIndex].subject,
        topics: state.logs[logIndex].topics,
        solved: parseInt(state.logs[logIndex].solved) || 0,
        revised: parseInt(state.logs[logIndex].revised) || 0,
        doubts: parseInt(state.logs[logIndex].doubts) || 0,
        status: state.logs[logIndex].status || 'NONE',
        source: state.logs[logIndex].source || ''
      };
      supabase.from('logs').upsert([cleanLog]).then(({error}) => {
        if (error) throw error;
        updateSyncStatus("SYNCED");
      }).catch(err => {
        console.error("Failed to sync clarified doubt: ", err);
        updateSyncStatus("ERROR");
      });
    } catch (err) {
      console.error(err);
    }
  }
};

// Handle Main Log Entry Form Submission
document.getElementById("form-log-entry").addEventListener("submit", (e) => {
  e.preventDefault();
  
  const btn = document.getElementById("btn-submit-log");
  const originalText = btn.innerText;
  btn.innerText = 'ADDING...';
  btn.classList.add('opacity-80');
  
  const newLog = {
    id: `log-${Date.now()}`,
    date: document.getElementById("log-date").value,
    subject: document.getElementById("log-subject").value,
    topics: document.getElementById("log-topics").value,
    solved: parseInt(document.getElementById("log-solved").value) || 0,
    revised: parseInt(document.getElementById("log-revised").value) || 0,
    doubts: parseInt(document.getElementById("log-doubts").value) || 0,
    status: document.getElementById("log-doubt-status").value,
    source: document.getElementById("log-source").value || "N/A"
  };
  
  state.logs.push(newLog);
  saveToStorage();
  
  // Async push to Supabase
  supabase.from('logs').upsert([newLog]).then(({error}) => {
    if (error) {
      console.error("Failed to push log: ", error);
      updateSyncStatus("ERROR");
    } else {
      updateSyncStatus("SYNCED");
    }
  });

  setTimeout(() => {
    btn.innerText = 'SUCCESS';
    btn.classList.replace('bg-primary-container', 'bg-tertiary');
    btn.classList.replace('text-on-primary-container', 'text-on-tertiary');
    
    setTimeout(() => {
      btn.innerText = originalText;
      btn.classList.replace('bg-tertiary', 'bg-primary-container');
      btn.classList.replace('text-on-tertiary', 'text-on-primary-container');
      btn.classList.remove('opacity-80');
      
      e.target.reset();
      // Reset default date to today
      document.getElementById("log-date").value = new Date().toISOString().split("T")[0];
      
      renderApp();
    }, 1500);
  }, 600);
});

// Handle Exam Entry Form Submission
document.getElementById("form-exam-entry").addEventListener("submit", (e) => {
  e.preventDefault();
  
  const newExam = {
    id: `exam-${Date.now()}`,
    name: document.getElementById("exam-name").value,
    date: document.getElementById("exam-date").value,
    total: parseFloat(document.getElementById("exam-total").value) || 100,
    attempted: parseFloat(document.getElementById("exam-attempted").value) || 0,
    correct: parseFloat(document.getElementById("exam-correct").value) || 0,
    wrong: parseFloat(document.getElementById("exam-wrong").value) || 0,
    negative: parseFloat(document.getElementById("exam-negative").value) || 0,
    duration: parseInt(document.getElementById("exam-duration").value) || 180
  };
  
  state.exams.push(newExam);
  saveToStorage();
  
  // Async push to Supabase
  supabase.from('exams').upsert([newExam]).then(({error}) => {
    if (error) {
      console.error("Failed to push exam: ", error);
      updateSyncStatus("ERROR");
    } else {
      updateSyncStatus("SYNCED");
    }
  });

  e.target.reset();
  // Set date back to today
  document.getElementById("exam-date").value = new Date().toISOString().split("T")[0];
  
  renderApp();
});

// Quick Add Modal Form Submission
document.getElementById("form-quick-log").addEventListener("submit", (e) => {
  e.preventDefault();
  
  const newLog = {
    id: `log-${Date.now()}`,
    date: document.getElementById("quick-log-date").value,
    subject: document.getElementById("quick-log-subject").value,
    topics: document.getElementById("quick-log-topics").value,
    solved: parseInt(document.getElementById("quick-log-solved").value) || 0,
    revised: parseInt(document.getElementById("quick-log-revised").value) || 0,
    doubts: parseInt(document.getElementById("quick-log-doubts").value) || 0,
    status: document.getElementById("quick-log-doubt-status").value,
    source: document.getElementById("quick-log-source").value || "N/A"
  };
  
  state.logs.push(newLog);
  saveToStorage();
  
  // Async push to Supabase
  supabase.from('logs').upsert([newLog]).then(({error}) => {
    if (error) {
      console.error("Failed to push log: ", error);
      updateSyncStatus("ERROR");
    } else {
      updateSyncStatus("SYNCED");
    }
  });

  // Reset and Close modal
  e.target.reset();
  document.getElementById("modal-quick-log").classList.add("hidden");
  
  renderApp();
});

// --- NAVIGATION & WINDOW LISTENERS ---

// Bind sidebar tab switching
document.getElementById("nav-dashboard").addEventListener("click", () => switchView("dashboard"));
document.getElementById("nav-daily-log").addEventListener("click", () => switchView("daily-log"));
document.getElementById("nav-master-progress").addEventListener("click", () => switchView("master-progress"));
document.getElementById("nav-exam-records").addEventListener("click", () => switchView("exam-records"));

// Quick Add Modal Toggles
document.getElementById("btn-quick-add").addEventListener("click", () => {
  document.getElementById("quick-log-date").value = new Date().toISOString().split("T")[0];
  document.getElementById("modal-quick-log").classList.remove("hidden");
});
document.getElementById("btn-close-modal").addEventListener("click", () => {
  document.getElementById("modal-quick-log").classList.add("hidden");
});

// Close modal on background click
document.getElementById("modal-quick-log").addEventListener("click", (e) => {
  if (e.target.id === "modal-quick-log") {
    document.getElementById("modal-quick-log").classList.add("hidden");
  }
});

// Initialize Date fields to today
window.addEventListener("DOMContentLoaded", () => {
  const todayStr = new Date().toISOString().split("T")[0];
  
  if (document.getElementById("log-date")) document.getElementById("log-date").value = todayStr;
  if (document.getElementById("exam-date")) document.getElementById("exam-date").value = todayStr;
  if (document.getElementById("quick-log-date")) document.getElementById("quick-log-date").value = todayStr;
  
  // Set current date in top bar
  const dateOptions = { weekday: 'short', day: 'numeric', month: 'short', year: 'numeric' };
  document.getElementById("header-date").innerText = new Date().toLocaleDateString('en-US', dateOptions).toUpperCase();
  
  // Set dynamic countdown
  if (document.getElementById("gate-countdown")) {
    document.getElementById("gate-countdown").innerText = state.daysLeft;
  }
  
  // Initial App Render
  switchView("dashboard");
  
  // Supabase Initial Sync
  syncLogs().then(() => renderApp());
  syncExams().then(() => renderApp());
});

// Sidebar Toggle Feature
document.getElementById("btn-toggle-sidebar").addEventListener("click", () => {
  const sidebar = document.querySelector("aside");
  const mainContent = document.querySelector("main");
  sidebar.classList.toggle("-translate-x-full");
  mainContent.classList.toggle("ml-64");
  mainContent.classList.toggle("ml-0");
});


