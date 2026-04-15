
const STORAGE_PREFIX = "study_time_manager_v2";
const CLOUD_CONFIG = window.CLOUD_CONFIG || {};

const state = {
  projects: [],
  activeProjectId: null,
  pomodoro: {
    runningProjectId: null,
    startedAt: null,
    tickHandle: null,
  },
  cloud: {
    enabled: false,
    client: null,
    user: null,
    pendingEmail: null,
    otpLength: 6,
    bootstrapUserId: null,
    statusType: "local",
    statusText: "未连接 Supabase，当前仅保存在本机浏览器。",
  },
};

const refs = {
  projectForm: document.getElementById("project-form"),
  projectName: document.getElementById("project-name"),
  projectStart: document.getElementById("project-start"),
  projectEnd: document.getElementById("project-end"),
  projectList: document.getElementById("project-list"),
  emptyState: document.getElementById("empty-state"),
  projectView: document.getElementById("project-view"),
  activeProjectTitle: document.getElementById("active-project-title"),
  projectWindow: document.getElementById("project-window"),
  tabTasks: document.getElementById("tab-tasks"),
  tabCalendar: document.getElementById("tab-calendar"),
  tabPomodoro: document.getElementById("tab-pomodoro"),
  tasksPane: document.getElementById("tasks-pane"),
  calendarPane: document.getElementById("calendar-pane"),
  pomodoroPane: document.getElementById("pomodoro-pane"),
  taskForm: document.getElementById("task-form"),
  taskTitle: document.getElementById("task-title"),
  taskStart: document.getElementById("task-start"),
  taskEnd: document.getElementById("task-end"),
  taskList: document.getElementById("task-list"),
  activeCount: document.getElementById("active-count"),
  completedList: document.getElementById("completed-list"),
  toggleCompleted: document.getElementById("toggle-completed"),
  timelineForm: document.getElementById("timeline-form"),
  timelineStart: document.getElementById("timeline-start"),
  timelineEnd: document.getElementById("timeline-end"),
  progressLabel: document.getElementById("progress-label"),
  progressStatus: document.getElementById("progress-status"),
  progressFill: document.getElementById("progress-fill"),
  timeSummary: document.getElementById("time-summary"),
  calendarGrid: document.getElementById("calendar-grid"),
  taskItemTemplate: document.getElementById("task-item-template"),
  cloudModeBadge: document.getElementById("cloud-mode-badge"),
  cloudStatus: document.getElementById("cloud-status"),
  authForm: document.getElementById("auth-form"),
  authEmail: document.getElementById("auth-email"),
  otpForm: document.getElementById("otp-form"),
  otpCode: document.getElementById("otp-code"),
  otpHint: document.getElementById("otp-hint"),
  authUserRow: document.getElementById("auth-user-row"),
  authUserEmail: document.getElementById("auth-user-email"),
  syncNow: document.getElementById("sync-now"),
  pushLocal: document.getElementById("push-local"),
  signOut: document.getElementById("sign-out"),
  pomodoroTime: document.getElementById("pomodoro-time"),
  pomodoroStart: document.getElementById("pomodoro-start"),
  pomodoroStop: document.getElementById("pomodoro-stop"),
  pomodoroForm: document.getElementById("pomodoro-form"),
  pomodoroWork: document.getElementById("pomodoro-work"),
  pomodoroEfficiency: document.getElementById("pomodoro-efficiency"),
  pomodoroLogList: document.getElementById("pomodoro-log-list"),
};

function uid() {
  if (window.crypto?.randomUUID) {
    return window.crypto.randomUUID();
  }
  return `id-${Date.now()}-${Math.floor(Math.random() * 100000)}`;
}

function storageKeyFor(userId) {
  return userId ? `${STORAGE_PREFIX}_${userId}` : `${STORAGE_PREFIX}_local`;
}

function readSnapshot(key) {
  try {
    const raw = localStorage.getItem(key);
    if (!raw) {
      return null;
    }
    const parsed = JSON.parse(raw);
    return {
      projects: Array.isArray(parsed.projects) ? parsed.projects : [],
      activeProjectId: parsed.activeProjectId || null,
    };
  } catch {
    return null;
  }
}

function normalizeProjects(projects) {
  return (Array.isArray(projects) ? projects : []).map((project) => ({
    id: project.id || uid(),
    name: String(project.name || "未命名项目"),
    startAt: project.startAt || null,
    endAt: project.endAt || null,
    createdAt: project.createdAt || new Date().toISOString(),
    view: project.view || "tasks",
    showCompleted: Boolean(project.showCompleted),
    tasks: Array.isArray(project.tasks)
      ? project.tasks.map((task) => ({
          id: task.id || uid(),
          title: String(task.title || "未命名子任务"),
          startAt: task.startAt || null,
          endAt: task.endAt || null,
          createdAt: task.createdAt || new Date().toISOString(),
          completedAt: task.completedAt || null,
        }))
      : [],
    pomodoroLogs: Array.isArray(project.pomodoroLogs)
      ? project.pomodoroLogs.map((log) => ({
          id: log.id || uid(),
          work: String(log.work || "未命名工作"),
          efficiency: log.efficiency || "normal",
          startedAt: log.startedAt || new Date().toISOString(),
          endedAt: log.endedAt || new Date().toISOString(),
          durationSec: Number(log.durationSec || 0),
          createdAt: log.createdAt || new Date().toISOString(),
        }))
      : [],
  }));
}

function loadState(userId) {
  const snapshot = readSnapshot(storageKeyFor(userId));
  state.projects = normalizeProjects(snapshot?.projects || []);
  state.activeProjectId = snapshot?.activeProjectId || state.projects[0]?.id || null;
  if (!state.projects.some((project) => project.id === state.activeProjectId)) {
    state.activeProjectId = state.projects[0]?.id || null;
  }
}

function saveState() {
  localStorage.setItem(
    storageKeyFor(state.cloud.user?.id),
    JSON.stringify({
      projects: state.projects,
      activeProjectId: state.activeProjectId,
    }),
  );
}

function getActiveProject() {
  return state.projects.find((project) => project.id === state.activeProjectId) || null;
}

function parseLocalDateInput(value) {
  if (!value) {
    return null;
  }
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  date.setSeconds(0, 0);
  return date.toISOString();
}

function toDateInputValue(iso) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  const offset = date.getTimezoneOffset();
  const local = new Date(date.getTime() - offset * 60000);
  return local.toISOString().slice(0, 16);
}

function formatDateTime(iso) {
  if (!iso) {
    return "未设置";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "无效时间";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  }).format(date);
}

function formatDateOnly(iso) {
  if (!iso) {
    return "";
  }
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return "";
  }
  return new Intl.DateTimeFormat("zh-CN", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(date);
}

function formatDuration(ms) {
  const abs = Math.abs(ms);
  const day = 24 * 60 * 60 * 1000;
  const hour = 60 * 60 * 1000;
  const days = Math.floor(abs / day);
  const hours = Math.floor((abs % day) / hour);
  return `${days}天${hours}小时`;
}

function formatDurationShort(ms) {
  const abs = Math.max(0, Math.floor(Math.abs(ms) / 1000));
  const hours = Math.floor(abs / 3600);
  const minutes = Math.floor((abs % 3600) / 60);
  if (hours > 0) {
    return `${hours}小时${minutes}分钟`;
  }
  return `${minutes}分钟`;
}

function formatClock(seconds) {
  const safe = Math.max(0, Math.floor(seconds));
  const h = String(Math.floor(safe / 3600)).padStart(2, "0");
  const m = String(Math.floor((safe % 3600) / 60)).padStart(2, "0");
  const s = String(safe % 60).padStart(2, "0");
  return `${h}:${m}:${s}`;
}

function localDateKey(iso) {
  const date = new Date(iso);
  if (Number.isNaN(date.getTime())) {
    return null;
  }
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function calcRangeProgress(startAt, endAt) {
  const now = Date.now();
  const start = startAt ? new Date(startAt).getTime() : NaN;
  const end = endAt ? new Date(endAt).getTime() : NaN;

  if (Number.isNaN(start) || Number.isNaN(end) || end <= start) {
    return {
      percent: 0,
      status: "请设置有效时间区间",
      summary: "开始时间需早于结束时间。",
    };
  }

  const total = end - start;
  const elapsed = now - start;
  const remain = end - now;
  const ratio = Math.min(Math.max(elapsed / total, 0), 1);

  let status = "进行中";
  if (now < start) {
    status = "未开始";
  } else if (now >= end) {
    status = "已到期";
  }

  return {
    percent: Math.round(ratio * 100),
    status,
    summary: `总时长 ${formatDuration(total)} · 已过去 ${formatDuration(Math.max(elapsed, 0))} · 剩余 ${formatDuration(Math.max(remain, 0))}`,
  };
}

function calcProgress(project) {
  return calcRangeProgress(project.startAt, project.endAt);
}

function calcTaskProgress(task) {
  const progress = calcRangeProgress(task.startAt, task.endAt);
  if (progress.status === "请设置有效时间区间") {
    return {
      ...progress,
      summary: "请设置子任务预计开始和结束时间。",
    };
  }
  return {
    ...progress,
    summary: `预计区间 ${formatDateTime(task.startAt)} - ${formatDateTime(task.endAt)}`,
  };
}

function setCloudStatus(type, text) {
  state.cloud.statusType = type;
  state.cloud.statusText = text;
  renderCloudBlock();
}

function renderCloudBlock() {
  refs.cloudStatus.textContent = state.cloud.statusText;
  refs.cloudModeBadge.classList.remove("cloud-pill-local", "cloud-pill-online", "cloud-pill-error");
  refs.otpHint.textContent = `Supabase 邮箱 OTP 默认 ${state.cloud.otpLength} 位。`;
  refs.otpCode.maxLength = state.cloud.otpLength;
  refs.otpCode.placeholder = `${state.cloud.otpLength}位验证码`;

  if (!state.cloud.enabled) {
    refs.cloudModeBadge.textContent = "本地模式";
    refs.cloudModeBadge.classList.add("cloud-pill-local");
    refs.authForm.classList.add("hidden");
    refs.otpForm.classList.add("hidden");
    refs.otpHint.classList.add("hidden");
    refs.authUserRow.classList.add("hidden");
    return;
  }

  if (state.cloud.statusType === "error") {
    refs.cloudModeBadge.textContent = "同步异常";
    refs.cloudModeBadge.classList.add("cloud-pill-error");
  } else if (state.cloud.user) {
    refs.cloudModeBadge.textContent = "云端在线";
    refs.cloudModeBadge.classList.add("cloud-pill-online");
  } else {
    refs.cloudModeBadge.textContent = "待登录";
    refs.cloudModeBadge.classList.add("cloud-pill-local");
  }

  if (state.cloud.user) {
    refs.authForm.classList.add("hidden");
    refs.otpForm.classList.add("hidden");
    refs.otpHint.classList.add("hidden");
    refs.authUserRow.classList.remove("hidden");
    refs.authUserEmail.textContent = `当前账号：${state.cloud.user.email || state.cloud.user.id}`;
  } else {
    refs.authForm.classList.remove("hidden");
    refs.otpForm.classList.toggle("hidden", !state.cloud.pendingEmail);
    refs.otpHint.classList.toggle("hidden", !state.cloud.pendingEmail);
    refs.authUserRow.classList.add("hidden");
  }
}

function renderProjectList() {
  refs.projectList.innerHTML = "";

  state.projects.forEach((project) => {
    const li = document.createElement("li");
    li.className = `project-item${project.id === state.activeProjectId ? " active" : ""}`;
    li.dataset.id = project.id;

    const progress = calcProgress(project);
    li.innerHTML = `
      <p>${escapeHtml(project.name)}</p>
      <p class="meta">${formatDateOnly(project.startAt)} - ${formatDateOnly(project.endAt)}</p>
      <p class="meta">时间进度 ${progress.percent}%</p>
    `;

    refs.projectList.appendChild(li);
  });
}

function renderProjectHeader(project) {
  refs.activeProjectTitle.textContent = project.name;
  refs.projectWindow.textContent = `${formatDateTime(project.startAt)} 至 ${formatDateTime(project.endAt)}`;
}

function buildTaskItem(task, completed) {
  const fragment = refs.taskItemTemplate.content.cloneNode(true);
  const li = fragment.querySelector("li");
  const checkbox = fragment.querySelector("input[type='checkbox']");
  const title = fragment.querySelector(".task-title");
  const meta = fragment.querySelector(".task-meta");
  const progressWrap = fragment.querySelector(".task-progress-wrap");
  const progressLabel = fragment.querySelector(".task-progress-label");
  const progressStatus = fragment.querySelector(".task-progress-status");
  const progressFill = fragment.querySelector(".task-progress-fill");
  const delBtn = fragment.querySelector("button");

  li.dataset.id = task.id;
  checkbox.checked = completed;
  checkbox.dataset.action = "toggle";
  title.textContent = task.title;
  const taskProgress = calcTaskProgress(task);
  meta.textContent = completed
    ? `完成于 ${formatDateTime(task.completedAt)} · 预计 ${formatDateTime(task.startAt)} - ${formatDateTime(task.endAt)}`
    : `预计 ${formatDateTime(task.startAt)} - ${formatDateTime(task.endAt)}`;

  progressLabel.textContent = `${completed ? 100 : taskProgress.percent}%`;
  progressStatus.textContent = completed ? "已完成" : taskProgress.status;
  progressFill.style.width = `${completed ? 100 : taskProgress.percent}%`;
  if (completed) {
    progressFill.style.background = "linear-gradient(90deg, #7f9f90, #6a8f7f)";
  }
  if (!task.startAt || !task.endAt) {
    progressWrap.classList.add("hidden");
  }

  delBtn.dataset.action = "delete";

  return fragment;
}

function renderTasks(project) {
  const activeTasks = project.tasks.filter((task) => !task.completedAt);
  const completedTasks = project.tasks
    .filter((task) => !!task.completedAt)
    .sort((a, b) => new Date(b.completedAt).getTime() - new Date(a.completedAt).getTime());

  refs.taskList.innerHTML = "";
  refs.completedList.innerHTML = "";

  if (activeTasks.length === 0) {
    const empty = document.createElement("li");
    empty.className = "caption";
    empty.textContent = "当前没有进行中的子任务。";
    refs.taskList.appendChild(empty);
  } else {
    activeTasks.forEach((task) => refs.taskList.appendChild(buildTaskItem(task, false)));
  }

  if (completedTasks.length > 0) {
    completedTasks.forEach((task) => refs.completedList.appendChild(buildTaskItem(task, true)));
  } else {
    const empty = document.createElement("li");
    empty.className = "caption";
    empty.textContent = "还没有已完成子任务。";
    refs.completedList.appendChild(empty);
  }

  refs.activeCount.textContent = `${activeTasks.length} 项`;
  refs.toggleCompleted.textContent = project.showCompleted ? "隐藏" : "显示";
  refs.completedList.classList.toggle("hidden", !project.showCompleted);
}

function renderTimeline(project) {
  refs.timelineStart.value = toDateInputValue(project.startAt);
  refs.timelineEnd.value = toDateInputValue(project.endAt);

  const progress = calcProgress(project);
  refs.progressLabel.textContent = `${progress.percent}%`;
  refs.progressStatus.textContent = progress.status;
  refs.timeSummary.textContent = progress.summary;
  refs.progressFill.style.width = `${progress.percent}%`;

  if (progress.status === "已到期") {
    refs.progressFill.style.background = "linear-gradient(90deg, #b49382, #9e7263)";
  } else if (progress.status === "未开始") {
    refs.progressFill.style.background = "linear-gradient(90deg, #91a8b8, #7c97a9)";
  } else {
    refs.progressFill.style.background = "linear-gradient(90deg, #8aacbb, #6e92a5)";
  }
}

function getCompletionMap(project) {
  return project.tasks.filter((task) => task.completedAt).reduce((acc, task) => {
    const key = localDateKey(task.completedAt);
    if (!key) {
      return acc;
    }
    if (!acc[key]) {
      acc[key] = [];
    }
    acc[key].push(task.title);
    return acc;
  }, {});
}

function getMonthRange(project, completionMap) {
  const keys = Object.keys(completionMap);
  const points = [];

  if (project.startAt) {
    points.push(new Date(project.startAt));
  }
  if (project.endAt) {
    points.push(new Date(project.endAt));
  }
  keys.forEach((key) => points.push(new Date(`${key}T00:00:00`)));

  const validPoints = points.filter((date) => !Number.isNaN(date.getTime()));
  if (validPoints.length === 0) {
    const now = new Date();
    return [{ year: now.getFullYear(), month: now.getMonth() }];
  }

  validPoints.sort((a, b) => a.getTime() - b.getTime());
  const start = new Date(validPoints[0].getFullYear(), validPoints[0].getMonth(), 1);
  const end = new Date(validPoints[validPoints.length - 1].getFullYear(), validPoints[validPoints.length - 1].getMonth(), 1);

  const months = [];
  const cursor = new Date(start);
  let guard = 0;

  while (cursor <= end && guard < 24) {
    months.push({ year: cursor.getFullYear(), month: cursor.getMonth() });
    cursor.setMonth(cursor.getMonth() + 1);
    guard += 1;
  }

  return months;
}
function renderCalendar(project) {
  refs.calendarGrid.innerHTML = "";
  const completionMap = getCompletionMap(project);
  const months = getMonthRange(project, completionMap);
  const weekdays = ["日", "一", "二", "三", "四", "五", "六"];

  months.forEach(({ year, month }) => {
    const card = document.createElement("article");
    card.className = "month-card reveal";

    const head = document.createElement("div");
    head.className = "month-head";
    const monthLabel = document.createElement("h4");
    monthLabel.textContent = `${year}年${month + 1}月`;

    const doneCount = Object.keys(completionMap)
      .filter((key) => {
        const date = new Date(`${key}T00:00:00`);
        return date.getFullYear() === year && date.getMonth() === month;
      })
      .reduce((count, key) => count + completionMap[key].length, 0);

    const monthMeta = document.createElement("p");
    monthMeta.textContent = `完成 ${doneCount} 项`;
    head.appendChild(monthLabel);
    head.appendChild(monthMeta);

    const mini = document.createElement("div");
    mini.className = "calendar-mini";

    weekdays.forEach((day) => {
      const weekday = document.createElement("div");
      weekday.className = "weekday";
      weekday.textContent = day;
      mini.appendChild(weekday);
    });

    const firstDay = new Date(year, month, 1).getDay();
    const daysInMonth = new Date(year, month + 1, 0).getDate();

    for (let i = 0; i < firstDay; i += 1) {
      const empty = document.createElement("div");
      empty.className = "day empty";
      mini.appendChild(empty);
    }

    for (let dayNum = 1; dayNum <= daysInMonth; dayNum += 1) {
      const dayNode = document.createElement("div");
      const key = `${year}-${String(month + 1).padStart(2, "0")}-${String(dayNum).padStart(2, "0")}`;
      const done = completionMap[key] || [];
      dayNode.className = `day${done.length ? " has-done" : ""}`;
      dayNode.textContent = String(dayNum);
      mini.appendChild(dayNode);
    }

    const log = document.createElement("div");
    log.className = "day-list";

    const days = Object.keys(completionMap)
      .filter((key) => {
        const date = new Date(`${key}T00:00:00`);
        return date.getFullYear() === year && date.getMonth() === month;
      })
      .sort((a, b) => new Date(a).getTime() - new Date(b).getTime());

    if (days.length === 0) {
      const none = document.createElement("p");
      none.className = "caption";
      none.textContent = "该月暂无完成记录。";
      log.appendChild(none);
    } else {
      days.forEach((day) => {
        const item = document.createElement("div");
        item.className = "day-log";
        item.textContent = `${day.slice(5)}：${completionMap[day].join("、")}`;
        log.appendChild(item);
      });
    }

    card.appendChild(head);
    card.appendChild(mini);
    card.appendChild(log);
    refs.calendarGrid.appendChild(card);
  });
}

function getEfficiencyLabel(efficiency) {
  if (efficiency === "high") {
    return "高效";
  }
  if (efficiency === "low") {
    return "低效";
  }
  return "一般";
}

function getPomodoroElapsedSec(projectId) {
  if (!state.pomodoro.startedAt || state.pomodoro.runningProjectId !== projectId) {
    return 0;
  }
  const started = new Date(state.pomodoro.startedAt).getTime();
  if (Number.isNaN(started)) {
    return 0;
  }
  return Math.floor((Date.now() - started) / 1000);
}

function updatePomodoroClock() {
  const active = getActiveProject();
  if (!active) {
    return;
  }
  const elapsedSec = getPomodoroElapsedSec(active.id);
  refs.pomodoroTime.textContent = formatClock(elapsedSec);
}

function startPomodoroTicker() {
  if (state.pomodoro.tickHandle) {
    clearInterval(state.pomodoro.tickHandle);
  }
  state.pomodoro.tickHandle = setInterval(updatePomodoroClock, 1000);
}

function stopPomodoroTicker() {
  if (state.pomodoro.tickHandle) {
    clearInterval(state.pomodoro.tickHandle);
    state.pomodoro.tickHandle = null;
  }
}

function renderPomodoro(project) {
  const runningHere = state.pomodoro.runningProjectId === project.id && !!state.pomodoro.startedAt;
  const runningElsewhere = !!state.pomodoro.startedAt && !runningHere;

  refs.pomodoroTime.textContent = formatClock(getPomodoroElapsedSec(project.id));
  refs.pomodoroStart.disabled = !!state.pomodoro.startedAt;
  refs.pomodoroStop.disabled = !runningHere;

  if (runningElsewhere) {
    refs.pomodoroTime.textContent = "00:00:00";
    refs.pomodoroStart.title = "另一个项目正在计时，请先切回对应项目结束计时。";
  } else {
    refs.pomodoroStart.title = "";
  }

  const logs = (Array.isArray(project.pomodoroLogs) ? project.pomodoroLogs : [])
    .slice()
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());

  refs.pomodoroLogList.innerHTML = "";
  if (!logs.length) {
    const empty = document.createElement("li");
    empty.className = "caption";
    empty.textContent = "还没有番茄记录。";
    refs.pomodoroLogList.appendChild(empty);
    return;
  }

  logs.forEach((log) => {
    const li = document.createElement("li");
    li.className = "task-item pomodoro-log-item";
    li.innerHTML = `
      <div class="task-copy">
        <p class="task-title">${escapeHtml(log.work)}</p>
        <p class="task-meta">${formatDateTime(log.startedAt)} - ${formatDateTime(log.endedAt)} · 时长 ${formatDurationShort(log.durationSec * 1000)} · 效率 ${getEfficiencyLabel(log.efficiency)}</p>
      </div>
    `;
    refs.pomodoroLogList.appendChild(li);
  });
}

function renderViewTabs(project) {
  const isTask = project.view === "tasks";
  const isCalendar = project.view === "calendar";
  const isPomodoro = project.view === "pomodoro";
  refs.tabTasks.classList.toggle("active", isTask);
  refs.tabCalendar.classList.toggle("active", isCalendar);
  refs.tabPomodoro.classList.toggle("active", isPomodoro);
  refs.tasksPane.classList.toggle("active", isTask);
  refs.calendarPane.classList.toggle("active", isCalendar);
  refs.pomodoroPane.classList.toggle("active", isPomodoro);
}

function render() {
  renderProjectList();
  const active = getActiveProject();

  if (!active) {
    refs.emptyState.classList.remove("hidden");
    refs.projectView.classList.add("hidden");
    return;
  }

  refs.emptyState.classList.add("hidden");
  refs.projectView.classList.remove("hidden");
  renderProjectHeader(active);
  renderTasks(active);
  renderTimeline(active);
  renderCalendar(active);
  renderPomodoro(active);
  renderViewTabs(active);
}

function applyProjects(projects) {
  state.projects = normalizeProjects(projects);
  if (!state.projects.some((project) => project.id === state.activeProjectId)) {
    state.activeProjectId = state.projects[0]?.id || null;
  }
  saveState();
  render();
}

function canUseCloud() {
  return Boolean(state.cloud.enabled && state.cloud.client && state.cloud.user);
}

function projectToCloudRow(project, userId) {
  return {
    id: project.id,
    user_id: userId,
    name: project.name,
    start_at: project.startAt,
    end_at: project.endAt,
    view: project.view || "tasks",
    show_completed: Boolean(project.showCompleted),
    created_at: project.createdAt || new Date().toISOString(),
    updated_at: new Date().toISOString(),
  };
}

function taskToCloudRow(projectId, task, userId) {
  return {
    id: task.id,
    project_id: projectId,
    user_id: userId,
    title: task.title,
    start_at: task.startAt,
    end_at: task.endAt,
    created_at: task.createdAt || new Date().toISOString(),
    completed_at: task.completedAt,
  };
}

function pomodoroLogToCloudRow(projectId, log, userId) {
  return {
    id: log.id,
    project_id: projectId,
    user_id: userId,
    work: log.work,
    efficiency: log.efficiency || "normal",
    start_at: log.startedAt,
    end_at: log.endedAt,
    duration_sec: log.durationSec,
    created_at: log.createdAt || new Date().toISOString(),
  };
}

function projectsFromCloudRows(projectRows, taskRows, pomodoroRows) {
  const map = new Map();

  projectRows.forEach((row) => {
    map.set(row.id, {
      id: row.id,
      name: row.name,
      startAt: row.start_at,
      endAt: row.end_at,
      createdAt: row.created_at,
      view: row.view || "tasks",
      showCompleted: Boolean(row.show_completed),
      tasks: [],
      pomodoroLogs: [],
    });
  });

  taskRows.forEach((row) => {
    const project = map.get(row.project_id);
    if (!project) {
      return;
    }
    project.tasks.push({
      id: row.id,
      title: row.title,
      startAt: row.start_at,
      endAt: row.end_at,
      createdAt: row.created_at,
      completedAt: row.completed_at,
    });
  });

  pomodoroRows.forEach((row) => {
    const project = map.get(row.project_id);
    if (!project) {
      return;
    }
    project.pomodoroLogs.push({
      id: row.id,
      work: row.work,
      efficiency: row.efficiency || "normal",
      startedAt: row.start_at,
      endedAt: row.end_at,
      durationSec: Number(row.duration_sec || 0),
      createdAt: row.created_at,
    });
  });

  return [...map.values()]
    .map((project) => ({
      ...project,
      tasks: project.tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
      pomodoroLogs: project.pomodoroLogs.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function fetchCloudProjectsAndTasks() {
  if (!canUseCloud()) {
    return [];
  }

  const [projectRes, taskRes, pomodoroRes] = await Promise.all([
    state.cloud.client.from("projects").select("*").order("created_at", { ascending: false }),
    state.cloud.client.from("tasks").select("*").order("created_at", { ascending: false }),
    state.cloud.client.from("pomodoro_logs").select("*").order("created_at", { ascending: false }),
  ]);

  if (projectRes.error) {
    throw projectRes.error;
  }
  if (taskRes.error) {
    throw taskRes.error;
  }
  if (pomodoroRes.error) {
    throw pomodoroRes.error;
  }

  return projectsFromCloudRows(projectRes.data || [], taskRes.data || [], pomodoroRes.data || []);
}

async function withCloudWrite(successText, operation) {
  if (!canUseCloud()) {
    return;
  }

  try {
    setCloudStatus("online", "云端在线，自动同步中...");
    await operation();
    setCloudStatus("online", successText);
  } catch (error) {
    setCloudStatus("error", `云端同步失败：${error.message || "未知错误"}`);
  }
}

async function upsertProjectCloud(project) {
  if (!canUseCloud()) {
    return;
  }

  const row = projectToCloudRow(project, state.cloud.user.id);
  await withCloudWrite("项目已同步到云端。", async () => {
    const { error } = await state.cloud.client.from("projects").upsert([row], { onConflict: "id" });
    if (error) {
      throw error;
    }
  });
}

async function upsertTaskCloud(projectId, task) {
  if (!canUseCloud()) {
    return;
  }

  const row = taskToCloudRow(projectId, task, state.cloud.user.id);
  await withCloudWrite("子任务已同步到云端。", async () => {
    const { error } = await state.cloud.client.from("tasks").upsert([row], { onConflict: "id" });
    if (error) {
      throw error;
    }
  });
}

async function upsertPomodoroLogCloud(projectId, log) {
  if (!canUseCloud()) {
    return;
  }

  const row = pomodoroLogToCloudRow(projectId, log, state.cloud.user.id);
  await withCloudWrite("番茄记录已同步到云端。", async () => {
    const { error } = await state.cloud.client.from("pomodoro_logs").upsert([row], { onConflict: "id" });
    if (error) {
      throw error;
    }
  });
}

async function deleteTaskCloud(taskId) {
  if (!canUseCloud()) {
    return;
  }

  await withCloudWrite("子任务删除已同步。", async () => {
    const { error } = await state.cloud.client.from("tasks").delete().eq("id", taskId);
    if (error) {
      throw error;
    }
  });
}

async function deleteManyByIds(table, ids) {
  if (!ids.length) {
    return;
  }
  const { error } = await state.cloud.client.from(table).delete().in("id", ids);
  if (error) {
    throw error;
  }
}

async function pushSnapshotToCloud(projects, replaceRemote) {
  if (!canUseCloud()) {
    return;
  }

  const userId = state.cloud.user.id;
  const projectRows = projects.map((project) => projectToCloudRow(project, userId));
  const taskRows = projects.flatMap((project) => project.tasks.map((task) => taskToCloudRow(project.id, task, userId)));
  const pomodoroRows = projects.flatMap((project) =>
    (Array.isArray(project.pomodoroLogs) ? project.pomodoroLogs : []).map((log) => pomodoroLogToCloudRow(project.id, log, userId)),
  );

  await withCloudWrite("本地数据已上传到云端。", async () => {
    if (projectRows.length) {
      const { error } = await state.cloud.client.from("projects").upsert(projectRows, { onConflict: "id" });
      if (error) {
        throw error;
      }
    }

    if (taskRows.length) {
      const { error } = await state.cloud.client.from("tasks").upsert(taskRows, { onConflict: "id" });
      if (error) {
        throw error;
      }
    }

    if (pomodoroRows.length) {
      const { error } = await state.cloud.client.from("pomodoro_logs").upsert(pomodoroRows, { onConflict: "id" });
      if (error) {
        throw error;
      }
    }

    if (replaceRemote) {
      const [remoteProjectsRes, remoteTasksRes, remotePomodoroRes] = await Promise.all([
        state.cloud.client.from("projects").select("id"),
        state.cloud.client.from("tasks").select("id"),
        state.cloud.client.from("pomodoro_logs").select("id"),
      ]);

      if (remoteProjectsRes.error) {
        throw remoteProjectsRes.error;
      }
      if (remoteTasksRes.error) {
        throw remoteTasksRes.error;
      }
      if (remotePomodoroRes.error) {
        throw remotePomodoroRes.error;
      }

      const localProjectIds = new Set(projectRows.map((row) => row.id));
      const localTaskIds = new Set(taskRows.map((row) => row.id));
      const localPomodoroIds = new Set(pomodoroRows.map((row) => row.id));

      const staleTaskIds = (remoteTasksRes.data || []).map((row) => row.id).filter((id) => !localTaskIds.has(id));
      const stalePomodoroIds = (remotePomodoroRes.data || []).map((row) => row.id).filter((id) => !localPomodoroIds.has(id));
      const staleProjectIds = (remoteProjectsRes.data || []).map((row) => row.id).filter((id) => !localProjectIds.has(id));

      await deleteManyByIds("tasks", staleTaskIds);
      await deleteManyByIds("pomodoro_logs", stalePomodoroIds);
      await deleteManyByIds("projects", staleProjectIds);
    }
  });
}

async function pullFromCloud(showSuccess) {
  if (!canUseCloud()) {
    return;
  }

  try {
    setCloudStatus("online", "正在从云端拉取数据...");
    const projects = await fetchCloudProjectsAndTasks();
    applyProjects(projects);
    if (showSuccess) {
      setCloudStatus("online", `云端同步完成：${projects.length} 个项目。`);
    }
  } catch (error) {
    setCloudStatus("error", `拉取失败：${error.message || "未知错误"}`);
  }
}

async function bootstrapCloudForCurrentUser() {
  if (!canUseCloud()) {
    return;
  }

  const userId = state.cloud.user.id;
  if (state.cloud.bootstrapUserId === userId) {
    return;
  }
  state.cloud.bootstrapUserId = userId;

  try {
    setCloudStatus("online", "云端已连接，正在初始化数据...");
    const cloudProjects = await fetchCloudProjectsAndTasks();

    if (cloudProjects.length > 0) {
      applyProjects(cloudProjects);
      setCloudStatus("online", `云端已加载：${cloudProjects.length} 个项目。`);
      return;
    }

    const userSnapshot = readSnapshot(storageKeyFor(userId));
    const seedProjects = normalizeProjects(userSnapshot?.projects?.length ? userSnapshot.projects : state.projects);

    if (seedProjects.length > 0) {
      await pushSnapshotToCloud(seedProjects, false);
      await pullFromCloud(false);
      setCloudStatus("online", "云端初始化完成，已上传本地项目。");
    } else {
      setCloudStatus("online", "云端已连接，当前没有项目。");
    }
  } catch (error) {
    state.cloud.bootstrapUserId = null;
    setCloudStatus("error", `云端初始化失败：${error.message || "未知错误"}`);
  }
}
function restoreAnonymousLocalState() {
  loadState(null);
  if (!state.projects.some((project) => project.id === state.activeProjectId)) {
    state.activeProjectId = state.projects[0]?.id || null;
  }
  render();
}

async function initCloud() {
  const supabaseUrl = String(CLOUD_CONFIG.supabaseUrl || "").trim();
  const supabaseAnonKey = String(CLOUD_CONFIG.supabaseAnonKey || "").trim();
  const cloudOtpLength = Number(CLOUD_CONFIG.otpLength || 6);
  state.cloud.otpLength = Number.isFinite(cloudOtpLength) && cloudOtpLength >= 4 && cloudOtpLength <= 12 ? cloudOtpLength : 6;

  if (!supabaseUrl || !supabaseAnonKey) {
    state.cloud.enabled = false;
    setCloudStatus("local", "未配置 Supabase。请在 cloud-config.js 填写 URL 和 anon key。");
    return;
  }

  if (!window.supabase?.createClient) {
    state.cloud.enabled = false;
    setCloudStatus("error", "Supabase SDK 加载失败，请检查网络或 CDN。");
    return;
  }

  try {
    state.cloud.client = window.supabase.createClient(supabaseUrl, supabaseAnonKey, {
      auth: {
        persistSession: true,
        autoRefreshToken: true,
      },
    });
    state.cloud.enabled = true;
  } catch {
    state.cloud.enabled = false;
    setCloudStatus("error", "Supabase 客户端创建失败，请检查配置。");
    return;
  }

  setCloudStatus("local", "Supabase 已连接，请使用邮箱登录启用云同步。");

  const { data } = await state.cloud.client.auth.getSession();
  state.cloud.user = data.session?.user || null;

  state.cloud.client.auth.onAuthStateChange((_event, session) => {
    state.cloud.user = session?.user || null;

    if (state.cloud.user) {
      state.cloud.pendingEmail = null;
      renderCloudBlock();
      void bootstrapCloudForCurrentUser();
    } else {
      state.cloud.bootstrapUserId = null;
      state.cloud.pendingEmail = null;
      setCloudStatus("local", "已退出登录，当前为本地模式。");
      restoreAnonymousLocalState();
    }
  });

  if (state.cloud.user) {
    renderCloudBlock();
    await bootstrapCloudForCurrentUser();
  }
}

function escapeHtml(value) {
  return String(value)
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

async function createProject(name, startAt, endAt) {
  const project = {
    id: uid(),
    name,
    startAt,
    endAt,
    createdAt: new Date().toISOString(),
    view: "tasks",
    showCompleted: false,
    tasks: [],
    pomodoroLogs: [],
  };

  state.projects.unshift(project);
  state.activeProjectId = project.id;
  saveState();
  render();
  await upsertProjectCloud(project);
}

async function addTask(project, title, startAt, endAt) {
  const task = {
    id: uid(),
    title,
    startAt,
    endAt,
    createdAt: new Date().toISOString(),
    completedAt: null,
  };

  project.tasks.unshift(task);
  saveState();
  render();
  await upsertTaskCloud(project.id, task);
}

async function updateTask(project, taskId, action) {
  const task = project.tasks.find((item) => item.id === taskId);
  if (!task) {
    return;
  }

  if (action === "toggle") {
    task.completedAt = task.completedAt ? null : new Date().toISOString();
    saveState();
    render();
    await upsertTaskCloud(project.id, task);
    return;
  }

  if (action === "delete") {
    project.tasks = project.tasks.filter((item) => item.id !== taskId);
    saveState();
    render();
    await deleteTaskCloud(taskId);
  }
}

async function updateTimeline(project, startAt, endAt) {
  project.startAt = startAt;
  project.endAt = endAt;
  saveState();
  render();
  await upsertProjectCloud(project);
}

function selectProject(projectId) {
  if (!state.projects.some((project) => project.id === projectId)) {
    return;
  }
  state.activeProjectId = projectId;
  saveState();
  render();
}

async function switchView(view) {
  const project = getActiveProject();
  if (!project) {
    return;
  }
  project.view = view;
  saveState();
  render();
  await upsertProjectCloud(project);
}

async function toggleCompletedArea() {
  const project = getActiveProject();
  if (!project) {
    return;
  }
  project.showCompleted = !project.showCompleted;
  saveState();
  render();
  await upsertProjectCloud(project);
}

async function startPomodoro(project) {
  if (state.pomodoro.startedAt) {
    window.alert("已有一个项目在计时，请先结束当前计时。");
    return;
  }

  state.pomodoro.runningProjectId = project.id;
  state.pomodoro.startedAt = new Date().toISOString();
  startPomodoroTicker();
  render();
}

async function stopPomodoro(project) {
  if (!state.pomodoro.startedAt || state.pomodoro.runningProjectId !== project.id) {
    window.alert("当前项目没有正在进行的计时。");
    return;
  }

  const work = refs.pomodoroWork.value.trim();
  const efficiency = refs.pomodoroEfficiency.value;
  if (!work) {
    window.alert("请先填写本次完成了什么工作，再结束计时。");
    return;
  }

  const startedAt = state.pomodoro.startedAt;
  const endDate = new Date();
  endDate.setMilliseconds(0);
  const startedMs = new Date(startedAt).getTime();
  const endedMs = endDate.getTime();
  const durationSec = Math.max(1, Math.floor((endedMs - startedMs) / 1000));

  const log = {
    id: uid(),
    work,
    efficiency,
    startedAt,
    endedAt: endDate.toISOString(),
    durationSec,
    createdAt: new Date().toISOString(),
  };

  project.pomodoroLogs = Array.isArray(project.pomodoroLogs) ? project.pomodoroLogs : [];
  project.pomodoroLogs.unshift(log);

  state.pomodoro.runningProjectId = null;
  state.pomodoro.startedAt = null;
  stopPomodoroTicker();
  refs.pomodoroForm.reset();

  saveState();
  render();
  await upsertPomodoroLogCloud(project.id, log);
}

function bindEvents() {
  refs.projectForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    const name = refs.projectName.value.trim();
    const startAt = parseLocalDateInput(refs.projectStart.value);
    const endAt = parseLocalDateInput(refs.projectEnd.value);

    if (!name || !startAt || !endAt) {
      window.alert("请填写完整的项目信息。");
      return;
    }
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      window.alert("结束时间必须晚于开始时间。");
      return;
    }

    await createProject(name, startAt, endAt);
    refs.projectForm.reset();
  });

  refs.projectList.addEventListener("click", (event) => {
    const node = event.target.closest(".project-item");
    if (!node?.dataset.id) {
      return;
    }
    selectProject(node.dataset.id);
  });

  refs.taskForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const project = getActiveProject();
    if (!project) {
      return;
    }

    const title = refs.taskTitle.value.trim();
    const startAt = parseLocalDateInput(refs.taskStart.value);
    const endAt = parseLocalDateInput(refs.taskEnd.value);
    if (!title || !startAt || !endAt) {
      window.alert("请填写子任务名称与预计开始/结束时间。");
      return;
    }
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      window.alert("子任务结束时间必须晚于开始时间。");
      return;
    }

    await addTask(project, title, startAt, endAt);
    refs.taskForm.reset();
  });

  const handleTaskListClick = async (event) => {
    const row = event.target.closest(".task-item");
    const project = getActiveProject();
    const actionNode = event.target.closest("[data-action]");
    if (!row || !project || !actionNode?.dataset.action) {
      return;
    }
    if (actionNode.dataset.action === "toggle") {
      return;
    }
    await updateTask(project, row.dataset.id, actionNode.dataset.action);
  };

  const handleTaskListChange = async (event) => {
    const input = event.target;
    if (!(input instanceof HTMLInputElement) || input.dataset.action !== "toggle") {
      return;
    }
    const row = input.closest(".task-item");
    const project = getActiveProject();
    if (!row || !project) {
      return;
    }
    await updateTask(project, row.dataset.id, "toggle");
  };

  refs.taskList.addEventListener("click", (event) => void handleTaskListClick(event));
  refs.completedList.addEventListener("click", (event) => void handleTaskListClick(event));
  refs.taskList.addEventListener("change", (event) => void handleTaskListChange(event));
  refs.completedList.addEventListener("change", (event) => void handleTaskListChange(event));

  refs.toggleCompleted.addEventListener("click", () => void toggleCompletedArea());
  refs.tabTasks.addEventListener("click", () => void switchView("tasks"));
  refs.tabCalendar.addEventListener("click", () => void switchView("calendar"));
  refs.tabPomodoro.addEventListener("click", () => void switchView("pomodoro"));

  refs.timelineForm.addEventListener("submit", async (event) => {
    event.preventDefault();
    const project = getActiveProject();
    if (!project) {
      return;
    }

    const startAt = parseLocalDateInput(refs.timelineStart.value);
    const endAt = parseLocalDateInput(refs.timelineEnd.value);

    if (!startAt || !endAt) {
      window.alert("请填写完整时间。");
      return;
    }
    if (new Date(startAt).getTime() >= new Date(endAt).getTime()) {
      window.alert("结束时间必须晚于开始时间。");
      return;
    }

    await updateTimeline(project, startAt, endAt);
  });

  refs.authForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.cloud.enabled || !state.cloud.client) {
      window.alert("请先在 cloud-config.js 中配置 Supabase。");
      return;
    }

    const email = refs.authEmail.value.trim();
    if (!email) {
      window.alert("请填写邮箱地址。");
      return;
    }

    try {
      setCloudStatus("online", "正在发送验证码，请检查邮箱...");
      const { error } = await state.cloud.client.auth.signInWithOtp({
        email,
      });
      if (error) {
        throw error;
      }
      state.cloud.pendingEmail = email;
      refs.otpCode.value = "";
      renderCloudBlock();
      setCloudStatus("online", `验证码已发送到 ${email}，请输入 ${state.cloud.otpLength} 位验证码。`);
    } catch (error) {
      setCloudStatus("error", `发送失败：${error.message || "未知错误"}`);
    }
  });

  refs.otpForm.addEventListener("submit", async (event) => {
    event.preventDefault();

    if (!state.cloud.enabled || !state.cloud.client) {
      window.alert("请先在 cloud-config.js 中配置 Supabase。");
      return;
    }
    if (!state.cloud.pendingEmail) {
      window.alert("请先发送验证码。");
      return;
    }

    const code = refs.otpCode.value.trim().replace(/\s+/g, "");
    if (!code) {
      window.alert("请输入验证码。");
      return;
    }
    if (code.length !== state.cloud.otpLength) {
      window.alert(`请输入 ${state.cloud.otpLength} 位验证码。`);
      return;
    }

    try {
      setCloudStatus("online", "正在验证验证码...");
      const { error } = await state.cloud.client.auth.verifyOtp({
        email: state.cloud.pendingEmail,
        token: code,
        type: "email",
      });
      if (error) {
        throw error;
      }
      refs.otpForm.reset();
      setCloudStatus("online", "验证码验证成功，正在登录...");
    } catch (error) {
      setCloudStatus("error", `验证码错误或已过期：${error.message || "未知错误"}`);
    }
  });

  refs.syncNow.addEventListener("click", () => void pullFromCloud(true));

  refs.pushLocal.addEventListener("click", async () => {
    await pushSnapshotToCloud(state.projects, true);
    await pullFromCloud(false);
  });

  refs.signOut.addEventListener("click", async () => {
    if (state.cloud.client) {
      await state.cloud.client.auth.signOut();
    }
  });

  refs.pomodoroStart.addEventListener("click", async () => {
    const project = getActiveProject();
    if (!project) {
      return;
    }
    await startPomodoro(project);
  });

  refs.pomodoroStop.addEventListener("click", async () => {
    const project = getActiveProject();
    if (!project) {
      return;
    }
    await stopPomodoro(project);
  });
}

async function boot() {
  loadState(null);

  if (!state.activeProjectId && state.projects[0]) {
    state.activeProjectId = state.projects[0].id;
  }

  bindEvents();
  renderCloudBlock();
  render();

  await initCloud();
  renderCloudBlock();

  setInterval(() => {
    const project = getActiveProject();
    if (!project) {
      return;
    }
    renderTimeline(project);
    renderProjectList();
  }, 60000);
}

boot();
