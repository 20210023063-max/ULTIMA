const TOKEN_KEY = "car_rental_token";
const BRANCH_STORAGE = "car_rental_branch";
/** `'site'` = user chose “Browse customer site” while staying signed in */
const PORTAL_VIEW_KEY = "car_rental_portal_view";
/** Mirrors an active portal session for this tab (cleared on logout / invalid token). */
const STAFF_PORTAL_SESSION_KEY = "car_rental_staff_portal_session";

const TREND_BG = [
  "https://images.unsplash.com/photo-1533473359331-0135ef1b58bf?auto=format&fit=crop&w=900&q=75",
  "https://images.unsplash.com/photo-1552519507-da3b142c6e3d?auto=format&fit=crop&w=900&q=75",
  "https://images.unsplash.com/photo-1617531653332-bd46c24f2068?auto=format&fit=crop&w=900&q=75",
  "https://images.unsplash.com/photo-1606664515524-ed2f786a0bd6?auto=format&fit=crop&w=900&q=75",
];

const TESTIMONIALS = [
  {
    quote: "Flawless handover and transparent pricing. The Carmen team had our SUV ready in under an hour.",
    name: "Marina L.",
    meta: "Toyota RAV4 · Apr 2026",
    avatar:
      "https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=200&q=75",
    car: "https://images.unsplash.com/photo-1519641471654-76ce0107ad1b?auto=format&fit=crop&w=400&q=75",
  },
  {
    quote: "ULTIMA CARS keeps their executive sedans immaculate. Receipts were ready for reimbursement the same day.",
    name: "James R.",
    meta: "BMW 5 Series · Mar 2026",
    avatar:
      "https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?auto=format&fit=crop&w=200&q=75",
    car: "https://images.unsplash.com/photo-1555215695-3004980ad54e?auto=format&fit=crop&w=400&q=75",
  },
  {
    quote: "Loved comparing availability across Bugo versus Iponan on the spot. Stress-free airport pickup.",
    name: "Aira K.",
    meta: "Honda Accord · Feb 2026",
    avatar:
      "https://images.unsplash.com/photo-1438761681033-6461ffad8d80?auto=format&fit=crop&w=200&q=75",
    car: "https://images.unsplash.com/photo-1553440569-bcc63803a83d?auto=format&fit=crop&w=400&q=75",
  },
];

/** @type {string | null} */
let authToken = localStorage.getItem(TOKEN_KEY);
/** @type {'guest'|'branch_staff'|'branch_admin'} */
let portalRole = "guest";
let selectedRentalId = "";
let testimonialIndex = 0;

const $ = (id) => document.getElementById(id);

function qs(path, params = {}) {
  const search = new URLSearchParams(params);
  const suffix = search.toString();
  return suffix ? `${path}?${suffix}` : path;
}

async function fetchJson(url, opts = {}) {
  const headers = { ...(opts.headers || {}) };
  if (opts.body && !headers["Content-Type"]) headers["Content-Type"] = "application/json";
  if (authToken) headers.Authorization = `Bearer ${authToken}`;
  const res = await fetch(url, { ...opts, headers });
  let data = null;
  const ct = res.headers.get("content-type") || "";
  if (ct.includes("application/json")) data = await res.json();
  else data = { _raw: await res.text() };
  if (!res.ok) throw new Error(data.error || data._raw || `HTTP ${res.status}`);
  return data;
}

async function api(path, opts = {}) {
  return fetchJson(`/api${path}`, opts);
}

function escapeHtml(str) {
  return String(str).replace(/[&<>"']/g, (c) =>
    ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#039;" })[c]);
}

function sliceDate(d) {
  return String(d || "").slice(0, 10);
}

function fillSelect(selectEl, branches) {
  if (!selectEl) return;
  selectEl.innerHTML = "";
  for (const b of branches) {
    const opt = document.createElement("option");
    opt.value = b.slug;
    opt.textContent = b.name;
    selectEl.appendChild(opt);
  }
}

function setBranchOptions(branches) {
  const saved = localStorage.getItem(BRANCH_STORAGE);
  const selects = [$("branch"), $("inquiryBranch"), $("formBranch")];
  for (const sel of selects) {
    if (!sel) continue;
    fillSelect(sel, branches);
    if (saved && [...sel.options].some((o) => o.value === saved)) sel.value = saved;
  }
}

function branch() {
  return $("branch").value;
}

function publicBranch() {
  const el = $("inquiryBranch");
  return el ? el.value : branch();
}

function isPortalAdmin() {
  return portalRole === "branch_admin";
}

/** Portal users from staff login (`branch_staff` viewer or `branch_admin`). Not guests. */
function isPortalStaffRole() {
  return portalRole === "branch_staff" || portalRole === "branch_admin";
}

function clearStaffPortalSessionMarker() {
  try {
    sessionStorage.removeItem(STAFF_PORTAL_SESSION_KEY);
  } catch {
    /* ignore quota / private mode */
  }
}

function syncStaffPortalSessionMarker() {
  try {
    if (isPortalStaffRole()) sessionStorage.setItem(STAFF_PORTAL_SESSION_KEY, portalRole);
    else clearStaffPortalSessionMarker();
  } catch {
    /* ignore */
  }
}

function applyBranchOperationsVisibility() {
  const el = $("staff-portal");
  if (!el) return;
  const show = isPortalStaffRole();
  el.hidden = !show;
  el.setAttribute("aria-hidden", show ? "false" : "true");
}

/** True while signed in on the operations dashboard (marketing site hidden). */
function isOperationsView() {
  if (!authToken) return false;
  return sessionStorage.getItem(PORTAL_VIEW_KEY) !== "site";
}

function applyPortalLayout() {
  const loggedIn = Boolean(authToken);
  const opsDashboard = loggedIn && isOperationsView();

  document.body.classList.toggle("portal-logged-in", opsDashboard);

  const wrap = $("marketingWrap");
  if (wrap) wrap.setAttribute("aria-hidden", opsDashboard ? "true" : "false");

  document.querySelectorAll(".js-open-login").forEach((el) => {
    el.hidden = loggedIn;
  });

  const browse = $("browsePublicBtn");
  if (browse) browse.hidden = !(loggedIn && opsDashboard);

  const back = $("backToDashboardBtn");
  if (back) back.hidden = !(loggedIn && !opsDashboard);

  const bar = $("dashboardBar");
  const guestHelp = $("staffPortalGuestHelp");
  if (guestHelp) guestHelp.hidden = loggedIn;

  if (bar) {
    bar.hidden = !(loggedIn && opsDashboard);
    if (loggedIn && opsDashboard) {
      const badge = $("dashRoleBadge");
      const hint = $("dashNavHint");
      if (badge) badge.textContent = isPortalAdmin() ? "Administrator" : "Viewer";
      if (hint) {
        hint.textContent = isPortalAdmin()
          ? " Tabs: Fleet and Desk — customers, rent, add data, receipt."
          : " Tabs: Fleet & Rentals only (read-only). Desk tools need an administrator account.";
      }
    }
  }
}

function ensurePortalTabState() {
  const active = document.querySelector("#portalTabs .tab.active");
  if (!active || active.hidden) {
    activateTab("vehicles", { force: true });
  }
}

function updateAuthUi() {
  const loggedIn = Boolean(authToken);
  const admin = loggedIn && isPortalAdmin();

  applyBranchOperationsVisibility();

  const branchOpsNav = $("navBranchOpsBtn");
  if (branchOpsNav) {
    branchOpsNav.hidden = !(isPortalStaffRole() && !isOperationsView());
  }

  const loginHeader = $("loginBtn");
  if (loginHeader) loginHeader.hidden = loggedIn;
  $("logoutBtn").hidden = !loggedIn;

  document.querySelectorAll("#portalTabs .tab[data-require-admin]").forEach((btn) => {
    btn.hidden = !admin;
  });

  $("portalAccessNote").hidden = !loggedIn;
  $("statsHint").hidden = loggedIn;

  if (loggedIn) {
    const label = isPortalAdmin() ? "Administrator access" : "Viewer (read-only)";
    $("portalAccessNote").textContent = `Signed in · ${label}. Contact a branch admin if you need receipts, payments, or new rentals.`;
  }

  $("customersLocked").hidden = loggedIn;
  $("customersTable").hidden = !admin;

  $("rentLocked").hidden = loggedIn;
  $("rentForm").hidden = !admin;
  $("rentActions").hidden = !admin;

  $("rentalsLocked").hidden = loggedIn;
  $("rentalsTable").hidden = !loggedIn;
  $("rentalsViewerHint").hidden = !(loggedIn && !admin);

  $("refreshRentals").hidden = !loggedIn;
  if ($("rentalAdminActions")) $("rentalAdminActions").hidden = !admin;

  $("addLocked").hidden = loggedIn;
  $("addForms").hidden = !admin;

  $("invoiceLocked").hidden = !admin;

  $("submitRent").disabled = !admin;
  const portalBranch = $("branch");
  if (portalBranch) portalBranch.disabled = loggedIn;

  applyPortalLayout();
  ensurePortalTabState();
}

async function hydrateUser() {
  if (!authToken) {
    $("userLabel").textContent = "";
    portalRole = "guest";
    clearStaffPortalSessionMarker();
    return;
  }
  try {
    const me = await api("/auth/me");
    portalRole = me.role === "branch_staff" ? "branch_staff" : "branch_admin";
    syncStaffPortalSessionMarker();
    $("userLabel").textContent = `${me.branchName || me.branch} · ${me.roleLabel || "Portal user"}`;
    localStorage.setItem(BRANCH_STORAGE, me.branch);
    const slug = me.branch;
    $("branch").value = slug;
    if ($("inquiryBranch")) $("inquiryBranch").value = slug;
    if ($("formBranch")) $("formBranch").value = slug;
    await refreshPublicFleet();
  } catch {
    authToken = null;
    portalRole = "guest";
    localStorage.removeItem(TOKEN_KEY);
    clearStaffPortalSessionMarker();
    $("userLabel").textContent = "";
  }
}

async function loadStats() {
  const slug = branch();

  const fleetLbl = $("fleetBranchLabel");
  if (fleetLbl) fleetLbl.textContent = $("branch").selectedOptions[0]?.text || slug;

  let s = null;
  try {
    s = await fetchJson(`/api${qs("/stats", { branch: slug })}`);
  } catch (e) {
    const box = $("stats");
    if (box) box.innerHTML = `<span class="hint">${escapeHtml(e.message)}</span>`;
    return;
  }

  const box = $("stats");
  if (!box) return;
  box.innerHTML = "";
  [
    [`${s.vehicles.available}`, "Available vehicles"],
    [`${s.vehicles.rented}`, "Currently rented"],
    [`${s.vehicles.maintenance}`, "Maintenance"],
    [`${s.rentalRecords}`, "Rental records"],
  ].forEach(([strong, lbl]) => {
    const wrap = document.createElement("div");
    wrap.className = "stat";
    wrap.innerHTML = `<strong>${strong}</strong><span>${escapeHtml(lbl)}</span>`;
    box.appendChild(wrap);
  });

  try {
    await renderVehicles();
    if (authToken) {
      if (isPortalAdmin()) await renderCustomers();
      await renderRentals();
    }
  } catch (_) {
    /* optional */
  }
}

async function renderVehicles() {
  const slug = branch();
  const list = await fetch(`/api${qs("/vehicles", { branch: slug })}`).then((r) =>
    r.ok ? r.json() : []
  );
  const tb = $("vehicleBody");
  if (!tb) return;
  tb.innerHTML = "";
  const admin = isPortalAdmin();
  list.forEach((v) => {
    const tr = document.createElement("tr");
    const updateCell = admin
      ? `<input class="rate-input" type="number" min="1" step="0.01" aria-label="New rental rate" value="${Number(v.rentalRate).toFixed(2)}" />
         <button type="button" class="btn btn-ghost btn-sm js-update-rate">Save</button>`
      : '<span class="hint">Admin only</span>';
    tr.innerHTML = `<td>${escapeHtml(v.vehicleId)}</td><td>${escapeHtml(v.model)}</td>
      <td class="num">${Number(v.rentalRate).toFixed(2)}</td><td>${escapeHtml(v.status)}</td><td>${updateCell}</td>`;
    tr.dataset.vehicleId = v.vehicleId;
    tb.appendChild(tr);
  });
}

async function renderCustomers() {
  const slug = branch();
  const list = await api(qs("/customers", { branch: slug }));
  const tb = $("customerBody");
  if (!tb) return;
  tb.innerHTML = "";
  list.forEach((c) => {
    const tr = document.createElement("tr");
    tr.innerHTML = `<td>${escapeHtml(c.customerId)}</td><td>${escapeHtml(c.name)}</td><td>${escapeHtml(c.email)}</td>`;
    tr.dataset.customerId = c.customerId;
    tb.appendChild(tr);
  });
}

function bindRentalRowSelect() {
  const tb = $("rentalBody");
  if (!tb) return;
  tb.onclick = (e) => {
    const tr = e.target.closest("tr");
    if (!tr || !tr.dataset.rentalId) return;
    [...tb.children].forEach((row) => row.classList.remove("selected"));
    tr.classList.add("selected");
    selectedRentalId = tr.dataset.rentalId;
  };
}

async function renderRentals() {
  const slug = branch();
  const list = await api(qs("/rentals", { branch: slug }));
  const tb = $("rentalBody");
  if (!tb) return;
  tb.innerHTML = "";
  selectedRentalId = "";
  bindRentalRowSelect();

  list.forEach((r) => {
    const tr = document.createElement("tr");
    const badgeClass = r.paymentStatus === "paid" ? "paid" : "pending";
    const pay = `<span class="badge ${badgeClass}">${escapeHtml(r.paymentStatus)}</span>`;
    tr.innerHTML = `<td>${escapeHtml(r.rentalId)}</td>
      <td>${escapeHtml(r.customerName)}</td>
      <td>${escapeHtml(r.vehicleModel)} (${escapeHtml(r.vehicleId)})</td>
      <td>${sliceDate(r.rentalDate)} → ${sliceDate(r.returnDate)}</td>
      <td class="num">${Number(r.totalCost).toFixed(2)}</td>
      <td>${pay}</td>`;
    tr.dataset.rentalId = r.rentalId;
    tb.appendChild(tr);
  });
}

async function refreshPublicFleet() {
  const slug = publicBranch();
  const heroAvail = $("heroAvailability");
  const spotModel = $("heroSpotModel");
  const spotTrim = $("heroSpotTrim");
  const spotPrice = $("heroSpotPrice");
  const track = $("trendTrack");
  const hint = $("trendHint");

  if (!slug) return;

  let stats = null;
  let vehicles = [];
  try {
    stats = await fetchJson(`/api${qs("/stats", { branch: slug })}`);
    const res = await fetch(`/api${qs("/vehicles", { branch: slug })}`);
    vehicles = res.ok ? await res.json() : [];
  } catch (e) {
    if (heroAvail) heroAvail.textContent = e.message || "Could not load branch data.";
    if (track) track.innerHTML = "";
    return;
  }

  if (heroAvail && stats) {
    const label = stats.branchName || slug;
    heroAvail.textContent = `${label}: ${stats.vehicles.available} available · ${stats.vehicles.rented} rented · ${stats.rentalRecords} rentals on file`;
  }
  if (hint) {
    hint.textContent = `Showing live rates for ${stats?.branchName || slug}.`;
  }

  const available = vehicles.find((v) => v.status === "Available") || vehicles[0];
  if (available) {
    if (spotModel) spotModel.textContent = available.model;
    if (spotTrim) spotTrim.textContent = `${available.status} · ID ${available.vehicleId}`;
    if (spotPrice) spotPrice.textContent = `₱${Number(available.rentalRate).toFixed(0)}`;
  } else {
    if (spotModel) spotModel.textContent = "Toyota Camry";
    if (spotTrim) spotTrim.textContent = "XSE · incoming fleet";
    if (spotPrice) spotPrice.textContent = "₱—";
  }

  if (!track) return;
  track.innerHTML = "";

  vehicles.slice(0, 10).forEach((v, i) => {
    const card = document.createElement("article");
    card.className = "trend-card";
    const bg = TREND_BG[i % TREND_BG.length];

    const head = document.createElement("div");
    head.className = "trend-card__head";
    const titleEl = document.createElement("p");
    titleEl.className = "trend-card__title";
    titleEl.textContent = v.model;
    const specs = document.createElement("p");
    specs.className = "trend-card__specs";
    specs.textContent = `${v.model} fleet · ${v.status === "Available" ? "Ready now" : v.status} · Auto · Seats 5`;
    head.append(titleEl, specs);

    const img = document.createElement("div");
    img.className = "trend-card__img";
    img.style.backgroundImage = `url('${bg}')`;

    const foot = document.createElement("div");
    foot.className = "trend-card__foot";
    const btn = document.createElement("button");
    btn.type = "button";
    btn.className = "btn btn-light";
    btn.textContent = `Book now · ₱${Number(v.rentalRate).toFixed(0)}/day`;
    btn.addEventListener("click", () => {
      if ($("formBranch")) $("formBranch").value = publicBranch();
      const carField = document.querySelector('input[name="carModel"]');
      if (carField) carField.value = `${v.model} @ ₱${Number(v.rentalRate).toFixed(0)}/day`;
      document.getElementById("book")?.scrollIntoView({ behavior: "smooth" });
    });
    foot.appendChild(btn);
    card.append(head, img, foot);
    track.appendChild(card);
  });

  paintTestimonial();
}

function paintTestimonial() {
  const item = TESTIMONIALS[testimonialIndex];
  const av = $("tAvatar");
  const car = $("tCar");
  if (av) av.style.backgroundImage = `url('${item.avatar}')`;
  if (car) car.style.backgroundImage = `url('${item.car}')`;
  const q = $("tQuote");
  const n = $("tName");
  const m = $("tMeta");
  if (q) q.textContent = `“${item.quote}”`;
  if (n) n.textContent = item.name;
  if (m) m.textContent = item.meta;
}

function setupTestimonials() {
  const dots = $("tDots");
  if (!dots) return;
  dots.innerHTML = "";
  TESTIMONIALS.forEach((_, idx) => {
    const dot = document.createElement("button");
    dot.type = "button";
    dot.className = "dot" + (idx === 0 ? " is-on" : "");
    dot.setAttribute("aria-label", `Testimonial ${idx + 1}`);
    dot.addEventListener("click", () => {
      testimonialIndex = idx;
      [...dots.children].forEach((d, i) => d.classList.toggle("is-on", i === idx));
      paintTestimonial();
    });
    dots.appendChild(dot);
  });
}

function setupNav() {
  const header = document.querySelector(".site-header");
  const toggle = $("navToggle");
  const nav = $("siteNav");

  window.addEventListener("scroll", () => {
    if (header) header.classList.toggle("scrolled", window.scrollY > 28);
  });

  if (toggle && nav) {
    toggle.addEventListener("click", () => {
      nav.classList.toggle("is-open");
    });
    nav.querySelectorAll("a, button.link-btn").forEach((node) =>
      node.addEventListener("click", () => nav.classList.remove("is-open"))
    );
  }

  $("navBranchOpsBtn")?.addEventListener("click", () => {
    document.getElementById("staff-portal")?.scrollIntoView({ behavior: "smooth" });
  });

  document.querySelectorAll(".js-open-login").forEach((btn) => {
    btn.addEventListener("click", () => {
      openLogin();
      nav?.classList.remove("is-open");
    });
  });
}

function setDefaultRentDates() {
  const f = $("rentForm");
  if (!f) return;
  const today = new Date();
  const end = new Date(today);
  end.setDate(end.getDate() + 5);
  f.rentalDate.value = sliceDate(today.toISOString());
  f.returnDate.value = sliceDate(end.toISOString());
}

function setupInquiryForm() {
  const form = $("inquiryForm");
  if (!form) return;
  form.addEventListener("submit", async (ev) => {
    ev.preventDefault();
    const status = $("inquiryStatus");
    if (status) status.textContent = "";
    const fd = new FormData(form);
    const payload = {
      branch: String(fd.get("branch") || "").toLowerCase(),
      name: String(fd.get("name") || "").trim(),
      phone: String(fd.get("phone") || "").trim(),
      carModel: String(fd.get("carModel") || "").trim(),
      startDate: fd.get("startDate") || undefined,
      endDate: fd.get("endDate") || undefined,
    };
    try {
      await fetchJson("/api/inquiries", { method: "POST", body: JSON.stringify(payload) });
      if (status) status.textContent = "Thanks — we received your request. A branch coordinator will call you shortly.";
      form.reset();
      if ($("formBranch")) $("formBranch").value = publicBranch();
    } catch (e) {
      if (status) status.textContent = e.message;
    }
  });
}

async function bootstrap() {
  const { branches } = await api("/branches");
  setBranchOptions(branches);

  authToken = localStorage.getItem(TOKEN_KEY);
  if (!authToken) clearStaffPortalSessionMarker();
  tabSetup();
  setupNav();
  setupTestimonials();
  setupInquiryForm();

  $("inquiryBranch")?.addEventListener("change", () => {
    const slug = publicBranch();
    localStorage.setItem(BRANCH_STORAGE, slug);
    if ($("formBranch")) $("formBranch").value = slug;
    if (!authToken && $("branch")) $("branch").value = slug;
    refreshPublicFleet().catch(console.error);
  });

  $("logoutBtn").onclick = () => {
    authToken = null;
    portalRole = "guest";
    sessionStorage.removeItem(PORTAL_VIEW_KEY);
    clearStaffPortalSessionMarker();
    localStorage.removeItem(TOKEN_KEY);
    $("userLabel").textContent = "";
    if ($("branch")) $("branch").disabled = false;
    updateAuthUi();
    loadStats().catch(console.error);
  };

  $("branch").onchange = () => {
    localStorage.setItem(BRANCH_STORAGE, branch());
    $("invoiceArea").hidden = true;
    $("invoiceArea").textContent = "";
    $("printReceipt").hidden = true;
    loadStats().catch(console.error);
  };

  $("loginBtn")?.addEventListener("click", openLogin);

  $("browsePublicBtn")?.addEventListener("click", () => {
    sessionStorage.setItem(PORTAL_VIEW_KEY, "site");
    updateAuthUi();
    window.scrollTo({ top: 0, behavior: "smooth" });
  });

  $("backToDashboardBtn")?.addEventListener("click", () => {
    sessionStorage.removeItem(PORTAL_VIEW_KEY);
    updateAuthUi();
    document.getElementById("staff-portal")?.scrollIntoView({ behavior: "smooth" });
  });

  $("closeLogin").onclick = closeLogin;
  $("loginForm").onsubmit = onLoginSubmit;

  $("vehicleBody")?.addEventListener("click", (e) => {
    const saveBtn = e.target.closest(".js-update-rate");
    if (saveBtn) {
      const tr = saveBtn.closest("tr");
      if (!tr?.dataset?.vehicleId || !isPortalAdmin()) return;
      const input = tr.querySelector(".rate-input");
      const nextRate = Number(input?.value);
      if (!Number.isFinite(nextRate) || nextRate <= 0) {
        alert("Please enter a valid positive rental rate.");
        return;
      }
      api(`/vehicles/${encodeURIComponent(tr.dataset.vehicleId)}/rate`, {
        method: "PATCH",
        body: JSON.stringify({ rentalRate: nextRate }),
      })
        .then(async () => {
          await loadStats();
          await refreshPublicFleet();
          await renderVehicles();
          alert(`Rate updated for ${tr.dataset.vehicleId}.`);
        })
        .catch((err) => alert(err.message));
      return;
    }
    const tr = e.target.closest("tr");
    if (!tr?.dataset?.vehicleId) return;
    if (!$("rentForm").hidden) $("rentForm").vehicleId.value = tr.dataset.vehicleId;
  });

  $("customerBody")?.addEventListener("click", (e) => {
    const tr = e.target.closest("tr");
    if (!tr?.dataset?.customerId) return;
    if (!$("rentForm").hidden) $("rentForm").customerId.value = tr.dataset.customerId;
  });

  $("submitRent").onclick = submitRent;
  $("clearRent").onclick = clearRent;
  $("refreshRentals").onclick = () => renderRentals();

  $("returnVehicle").onclick = async () => {
    if (!selectedRentalId) return alert("Select a rental row first.");
    try {
      await api(`/rentals/${encodeURIComponent(selectedRentalId)}/return`, {
        method: "PATCH",
        body: "{}",
      });
      await loadStats();
      await renderRentals();
      await refreshPublicFleet();
      alert("Vehicle marked returned (available again).");
    } catch (e) {
      alert(e.message);
    }
  };

  $("markPaid").onclick = async () => {
    if (!selectedRentalId) return alert("Select a rental row first.");
    try {
      await api(`/rentals/${encodeURIComponent(selectedRentalId)}/payment`, {
        method: "PATCH",
        body: JSON.stringify({ paymentStatus: "paid" }),
      });
      await renderRentals();
    } catch (e) {
      alert(e.message);
    }
  };

  $("loadInvoice").onclick = async () => {
    if (!selectedRentalId) return alert("Select a rental row first.");
    try {
      const inv = await api(`/rentals/${encodeURIComponent(selectedRentalId)}/invoice`);
      $("invoiceArea").textContent = inv.plainText;
      $("invoiceArea").hidden = false;
      $("printReceipt").hidden = false;
      activateTab("invoice");
      document.getElementById("staff-portal")?.scrollIntoView({ behavior: "smooth" });
    } catch (e) {
      alert(e.message);
    }
  };

  $("addCustomerBtn").onclick = async () => {
    try {
      await api("/customers", {
        method: "POST",
        body: JSON.stringify({
          branch: branch(),
          customerId: $("newCustId").value.trim(),
          name: $("newCustName").value.trim(),
          email: $("newCustEmail").value.trim(),
        }),
      });
      $("newCustId").value = "";
      $("newCustName").value = "";
      $("newCustEmail").value = "";
      await renderCustomers();
      alert("Customer added.");
    } catch (e) {
      alert(e.message);
    }
  };

  $("addVehicleBtn").onclick = async () => {
    const rate = Number($("newVehRate").value);
    try {
      await api("/vehicles", {
        method: "POST",
        body: JSON.stringify({
          branch: branch(),
          vehicleId: $("newVehId").value.trim(),
          model: $("newVehModel").value.trim(),
          rentalRate: rate,
        }),
      });
      $("newVehId").value = "";
      $("newVehModel").value = "";
      $("newVehRate").value = "";
      await loadStats();
      await refreshPublicFleet();
      alert("Vehicle added.");
    } catch (e) {
      alert(e.message);
    }
  };

  $("printReceipt").onclick = () => window.print();

  await hydrateUser();
  updateAuthUi();
  setDefaultRentDates();
  await loadStats();
  await refreshPublicFleet();
  paintTestimonial();
}

async function onLoginSubmit(ev) {
  ev.preventDefault();
  $("loginError").textContent = "";
  const fd = new FormData(ev.target);
  const payload = JSON.stringify({
    username: String(fd.get("username") || "").trim(),
    password: String(fd.get("password") || ""),
  });
  try {
    const row = await fetchJson("/api/auth/login", { method: "POST", body: payload });
    authToken = row.token;
    localStorage.setItem(TOKEN_KEY, authToken);
    sessionStorage.removeItem(PORTAL_VIEW_KEY);
    closeLogin();
    await hydrateUser();
    updateAuthUi();
    await loadStats();
    document.getElementById("staff-portal")?.scrollIntoView({ behavior: "smooth" });
  } catch (e) {
    $("loginError").textContent = e.message;
  }
}

async function submitRent() {
  $("rentMessage").hidden = false;
  const f = $("rentForm");
  try {
    const r = await api("/rentals", {
      method: "POST",
      body: JSON.stringify({
        branch: branch(),
        customerId: f.customerId.value.trim(),
        vehicleId: f.vehicleId.value.trim(),
        rentalDate: f.rentalDate.value,
        returnDate: f.returnDate.value,
      }),
    });
    $("rentMessage").textContent = `Rental processed.\n\nRental ID: ${r.rentalId}\nTotal: ₱${Number(r.totalCost).toFixed(2)}\n`;
    clearRentQuiet();
    await loadStats();
    await refreshPublicFleet();
  } catch (e) {
    $("rentMessage").textContent = e.message;
  }
}

function clearRent() {
  clearRentQuiet();
  $("rentMessage").textContent = "";
}

function clearRentQuiet() {
  setDefaultRentDates();
  $("rentForm").customerId.value = "";
  $("rentForm").vehicleId.value = "";
}

function tabSetup() {
  document.querySelectorAll("#portalTabs .tab").forEach((btn) => {
    btn.addEventListener("click", () => {
      if (btn.hidden) return;
      activateTab(btn.dataset.tab);
    });
  });
}

/** @param {{ force?: boolean }|undefined} opts */
function activateTab(name, opts) {
  const force = opts && opts.force;
  const btn = document.querySelector(`#portalTabs .tab[data-tab="${name}"]`);
  if (!force && btn && btn.hidden) {
    activateTab("vehicles", { force: true });
    return;
  }
  document.querySelectorAll("#portalTabs .tab").forEach((b) =>
    b.classList.toggle("active", b.dataset.tab === name)
  );
  document.querySelectorAll(".tab-panel").forEach((p) => {
    const id = p.id.replace("tab-", "");
    p.hidden = id !== name;
  });
}

function openLogin() {
  $("loginModal").classList.add("open");
}

function closeLogin() {
  $("loginModal").classList.remove("open");
}

bootstrap().catch(console.error);
