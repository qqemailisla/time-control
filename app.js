
const STORAGE_PREFIX = "study_time_manager_v2";
const CLOUD_CONFIG = window.CLOUD_CONFIG || {};

const state = {
  projects: [],
  activeProjectId: null,
  cloud: {
    enabled: false,
    client: null,
    user: null,
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
  tasksPane: document.getElementById("tasks-pane"),
  calendarPane: document.getElementById("calendar-pane"),
  taskForm: document.getElementById("task-form"),
  taskTitle: document.getElementById("task-title"),
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
  authUserRow: document.getElementById("auth-user-row"),
  authUserEmail: document.getElementById("auth-user-email"),
  syncNow: document.getElementById("sync-now"),
  pushLocal: document.getElementById("push-local"),
  signOut: document.getElementById("sign-out"),
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
          createdAt: task.createdAt || new Date().toISOString(),
          completedAt: task.completedAt || null,
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
  return Number.isNaN(date.getTime()) ? null : date.toISOString();
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

function calcProgress(project) {
  const now = Date.now();
  const start = project.startAt ? new Date(project.startAt).getTime() : NaN;
  const end = project.endAt ? new Date(project.endAt).getTime() : NaN;

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

function setCloudStatus(type, text) {
  state.cloud.statusType = type;
  state.cloud.statusText = text;
  renderCloudBlock();
}

function renderCloudBlock() {
  refs.cloudStatus.textContent = state.cloud.statusText;
  refs.cloudModeBadge.classList.remove("cloud-pill-local", "cloud-pill-online", "cloud-pill-error");

  if (!state.cloud.enabled) {
    refs.cloudModeBadge.textContent = "本地模式";
    refs.cloudModeBadge.classList.add("cloud-pill-local");
    refs.authForm.classList.add("hidden");
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
    refs.authUserRow.classList.remove("hidden");
    refs.authUserEmail.textContent = `当前账号：${state.cloud.user.email || state.cloud.user.id}`;
  } else {
    refs.authForm.classList.remove("hidden");
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
  const delBtn = fragment.querySelector("button");

  li.dataset.id = task.id;
  checkbox.checked = completed;
  checkbox.dataset.action = "toggle";
  title.textContent = task.title;
  meta.textContent = completed ? `完成于 ${formatDateTime(task.completedAt)}` : `创建于 ${formatDateTime(task.createdAt)}`;
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

function renderViewTabs(project) {
  const isTask = project.view === "tasks";
  refs.tabTasks.classList.toggle("active", isTask);
  refs.tabCalendar.classList.toggle("active", !isTask);
  refs.tasksPane.classList.toggle("active", isTask);
  refs.calendarPane.classList.toggle("active", !isTask);
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
    created_at: task.createdAt || new Date().toISOString(),
    completed_at: task.completedAt,
  };
}

function projectsFromCloudRows(projectRows, taskRows) {
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
      createdAt: row.created_at,
      completedAt: row.completed_at,
    });
  });

  return [...map.values()]
    .map((project) => ({
      ...project,
      tasks: project.tasks.sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime()),
    }))
    .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
}

async function fetchCloudProjectsAndTasks() {
  if (!canUseCloud()) {
    return [];
  }

  const [projectRes, taskRes] = await Promise.all([
    state.cloud.client.from("projects").select("*").order("created_at", { ascending: false }),
    state.cloud.client.from("tasks").select("*").order("created_at", { ascending: false }),
  ]);

  if (projectRes.error) {
    throw projectRes.error;
  }
  if (taskRes.error) {
    throw taskRes.error;
  }

  return projectsFromCloudRows(projectRes.data || [], taskRes.data || []);
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

    if (replaceRemote) {
      const [remoteProjectsRes, remoteTasksRes] = await Promise.all([
        state.cloud.client.from("projects").select("id"),
        state.cloud.client.from("tasks").select("id"),
      ]);

      if (remoteProjectsRes.error) {
        throw remoteProjectsRes.error;
      }
      if (remoteTasksRes.error) {
        throw remoteTasksRes.error;
      }

      const localProjectIds = new Set(projectRows.map((row) => row.id));
      const localTaskIds = new Set(taskRows.map((row) => row.id));

      const staleTaskIds = (remoteTasksRes.data || []).map((row) => row.id).filter((id) => !localTaskIds.has(id));
      const staleProjectIds = (remoteProjectsRes.data || []).map((row) => row.id).filter((id) => !localProjectIds.has(id));

      await deleteManyByIds("tasks", staleTaskIds);
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
      renderCloudBlock();
      void bootstrapCloudForCurrentUser();
    } else {
      state.cloud.bootstrapUserId = null;
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
  };

  state.projects.unshift(project);
  state.activeProjectId = project.id;
  saveState();
  render();
  await upsertProjectCloud(project);
}

async function addTask(project, title) {
  const task = {
    id: uid(),
    title,
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
    if (!title) {
      return;
    }

    await addTask(project, title);
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
      setCloudStatus("online", "正在发送登录链接，请检查邮箱...");
      const redirectTo = `${window.location.origin}${window.location.pathname}`;
      const { error } = await state.cloud.client.auth.signInWithOtp({
        email,
        options: { emailRedirectTo: redirectTo },
      });
      if (error) {
        throw error;
      }
      refs.authForm.reset();
      setCloudStatus("online", "登录链接已发送，请点击邮箱里的链接完成登录。");
    } catch (error) {
      setCloudStatus("error", `发送失败：${error.message || "未知错误"}`);
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
