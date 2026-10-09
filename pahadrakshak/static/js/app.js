const $ = (selector) => document.querySelector(selector);
const state = { hazards: [], map: null, markers: [], toastTimer: null };

function escapeHtml(value) {
  return String(value ?? "").replace(/[&<>"']/g, (char) => ({
    "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;"
  })[char]);
}
function severityClass(value) {
  return String(value || "").toLowerCase().replace(/[^a-z]/g, "");
}
function formatDate(value) {
  if (!value) return "Time unavailable";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Time unavailable";
  return date.toLocaleString([], { month: "short", day: "numeric", hour: "2-digit", minute: "2-digit" });
}
function showToast(message) {
  const toast = $("#toast");
  toast.textContent = message;
  toast.classList.add("show");
  clearTimeout(state.toastTimer);
  state.toastTimer = setTimeout(() => toast.classList.remove("show"), 3000);
}
async function api(url, options = {}) {
  const response = await fetch(url, {
    ...options,
    headers: { ...(options.body ? { "Content-Type": "application/json" } : {}), ...(options.headers || {}) }
  });
  const data = await response.json().catch(() => ({}));
  if (!response.ok) throw new Error(data.error || "Request failed. Please try again.");
  return data;
}

function initMap() {
  if (!window.L) {
    $("#map").innerHTML = '<div class="empty-state">Map library could not load. Check your internet connection.</div>';
    return;
  }
  state.map = L.map("map", { scrollWheelZoom: false }).setView([30.99, 78.85], 10);
  L.tileLayer("https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png", {
    maxZoom: 18, attribution: '&copy; <a href="https://www.openstreetmap.org/copyright" target="_blank" rel="noopener">OpenStreetMap</a>'
  }).addTo(state.map);
  state.map.on("focus", () => state.map.scrollWheelZoom.enable());
  state.map.on("blur", () => state.map.scrollWheelZoom.disable());
}
function updateMap(items) {
  if (!state.map) return;
  state.markers.forEach(marker => marker.remove());
  state.markers = [];
  items.forEach(item => {
    if (typeof item.lat !== "number" || typeof item.lng !== "number") return;
    const color = item.severity === "Severe" ? "#b83332" : item.severity === "High" ? "#e37d32" : item.severity === "Moderate" ? "#d5a32b" : "#38845b";
    const marker = L.circleMarker([item.lat, item.lng], {
      radius: 8, color: "#fff", weight: 2, fillColor: color, fillOpacity: .95
    }).addTo(state.map);
    marker.bindPopup(`<div class="popup-title">${escapeHtml(item.title)}</div><div class="popup-sub">${escapeHtml(item.location)}<br>${escapeHtml(item.severity)} · ${escapeHtml(item.status)}<br>${escapeHtml(formatDate(item.reported_at))}</div>`);
    state.markers.push(marker);
  });
}
function renderReports(items) {
  const list = $("#report-list");
  if (!items.length) {
    list.innerHTML = '<div class="empty-state">No reports match this filter.</div>';
    return;
  }
  list.innerHTML = items.slice(0, 12).map(item => `
    <article class="report-card">
      <div class="report-card-top">
        <div><h3>${escapeHtml(item.title)}</h3><div class="report-location">⌖ ${escapeHtml(item.location)}</div></div>
        <span class="pill ${severityClass(item.severity)}">${escapeHtml(item.severity)}</span>
      </div>
      <p class="report-description">${escapeHtml(item.description)}</p>
      <div class="report-meta"><span class="pill neutral">${escapeHtml(item.type)}</span><span class="report-status">${escapeHtml(item.status)}</span></div>
      <div class="report-meta" style="margin-top:8px"><span class="report-status">${escapeHtml(item.source)} · ${escapeHtml(formatDate(item.reported_at))}</span></div>
    </article>`).join("");
}
function updateStats(items) {
  $("#stat-total").textContent = items.length;
  $("#stat-pending").textContent = items.filter(h => /pending|unverified/i.test(h.status)).length;
  $("#stat-high").textContent = items.filter(h => ["High", "Severe"].includes(h.severity)).length;
  $("#alert-count").textContent = items.filter(h => ["High", "Severe"].includes(h.severity)).length;
}
async function loadReports() {
  const filter = $("#type-filter").value;
  $("#report-list").innerHTML = '<div class="loading-state">Loading reports…</div>';
  try {
    const result = await api(`/api/hazards?type=${encodeURIComponent(filter)}`);
    state.hazards = result.items || [];
    renderReports(state.hazards);
    updateMap(state.hazards);
    const all = await api("/api/hazards");
    updateStats(all.items || []);
  } catch (error) {
    $("#report-list").innerHTML = `<div class="empty-state">${escapeHtml(error.message)}</div>`;
  }
}
function openDialog() {
  $("#form-message").textContent = "";
  $("#report-dialog").showModal();
}
function closeDialog() {
  $("#report-dialog").close();
}
async function submitHazard(event) {
  event.preventDefault();
  const form = event.currentTarget;
  const formData = new FormData(form);
  const payload = Object.fromEntries(formData.entries());
  $("#form-message").textContent = "";
  const button = form.querySelector('[type="submit"]');
  button.disabled = true;
  button.textContent = "Submitting…";
  try {
    await api("/api/hazards", { method: "POST", body: JSON.stringify(payload) });
    form.reset();
    closeDialog();
    await loadReports();
    showToast("Report submitted and marked pending verification.");
  } catch (error) {
    $("#form-message").textContent = error.message;
  } finally {
    button.disabled = false;
    button.textContent = "Submit for review ↗";
  }
}
async function checkRoute(event) {
  event.preventDefault();
  const form = new FormData(event.currentTarget);
  const resultBox = $("#route-result");
  resultBox.innerHTML = '<span class="result-icon">…</span><p>Reviewing available reports…</p>';
  try {
    const query = new URLSearchParams({
      origin: form.get("origin"), destination: form.get("destination")
    });
    const data = await api(`/api/route-check?${query}`);
    resultBox.innerHTML = `<span class="result-icon">!</span><p><strong>${escapeHtml(data.origin)} → ${escapeHtml(data.destination)}: ${escapeHtml(data.status)}</strong><br>${escapeHtml(data.message)}<br><br><strong>${data.related_reports.length} report(s)</strong> are available in the prototype. These reports are not proof of a closure or confirmation that a route is safe.</p>`;
  } catch (error) {
    resultBox.innerHTML = `<span class="result-icon">!</span><p>${escapeHtml(error.message)}</p>`;
  }
}

document.addEventListener("DOMContentLoaded", () => {
  initMap();
  loadReports();
  $("#type-filter").addEventListener("change", loadReports);
  $("#refresh-reports").addEventListener("click", loadReports);
  $("#open-report").addEventListener("click", openDialog);
  $("#open-report-secondary").addEventListener("click", openDialog);
  $("#close-dialog").addEventListener("click", closeDialog);
  $("#cancel-dialog").addEventListener("click", closeDialog);
  $("#hazard-form").addEventListener("submit", submitHazard);
  $("#route-form").addEventListener("submit", checkRoute);
  $("#report-dialog").addEventListener("click", event => {
    if (event.target === $("#report-dialog")) closeDialog();
  });
});
