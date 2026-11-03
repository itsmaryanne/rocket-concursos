(() => {
  const subjects = [
    "Português",
    "Matemática",
    "Raciocínio Lógico",
    "Direito Constitucional",
    "Direito Administrativo",
    "Administração Pública",
    "Informática",
    "Ética e Políticas Públicas",
    "Conhecimentos específicos",
    "Outros",
  ];

  const KEY = "trilha_aprovacao_v3";
  const OLD_KEY_V2 = "trilha_aprovacao_v2";
  const OLD_KEY_V1 = "trilha_aprovacao_v1";
  const MAX_NAME = 30;
  const MIN_PASSWORD = 7;
  const PROFILE_ID_SIZE = 5;

  const $ = (id) => document.getElementById(id);
  const arr = (x) => (Array.isArray(x) ? x : []);
  const pad = (n) => String(n).padStart(2, "0");
  const digits = (s) => String(s || "").replace(/\D/g, "");

  // Data local evita inconsistência de UTC em toISOString.
  const iso = (d) =>
    `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  const today = () => iso(new Date());
  const uid = () => crypto.randomUUID();

  function esc(s) {
    return String(s ?? "").replace(
      /[&<>"']/g,
      (c) =>
        ({
          "&": "&amp;",
          "<": "&lt;",
          ">": "&gt;",
          '"': "&quot;",
          "'": "&#39;",
        })[c],
    );
  }

  function randomDigits(size = PROFILE_ID_SIZE) {
    let out = "";
    for (let i = 0; i < size; i++) out += Math.floor(Math.random() * 10);
    return out;
  }

  function randomPassword(length = 8) {
    const chars = "ABCDEFGHJKLMNPQRSTUVWXYZabcdefghijkmnopqrstuvwxyz23456789";
    let out = "";
    for (let i = 0; i < length; i++) {
      out += chars[Math.floor(Math.random() * chars.length)];
    }
    return out;
  }

  function isValidProfileId(id) {
    return /^\d{5}$/.test(String(id || ""));
  }

  function createUniqueProfileId(accounts) {
    const used = new Set(arr(accounts).map((a) => String(a.id)));
    for (let i = 0; i < 120000; i++) {
      const id = randomDigits();
      if (!used.has(id)) return id;
    }
    throw new Error("Não foi possível gerar um ID único.");
  }

  function blankAccount(name, password, id) {
    return {
      id: String(id),
      name: String(name || "").trim().slice(0, MAX_NAME) || "Usuário",
      password: String(password || ""),
      friends: [],
      records: [],
      reviews: [],
      mocks: [],
      goals: { questions: 150, sessions: 15 },
    };
  }

  function sanitizeAccount(account, index, all) {
    const raw = account && typeof account === "object" ? account : {};
    let id = String(raw.id || "");
    if (!isValidProfileId(id)) {
      id = createUniqueProfileId(all);
    }

    const name =
      String(raw.name || `Usuário ${index + 1}`).trim().slice(0, MAX_NAME) ||
      `Usuário ${index + 1}`;

    const password = String(raw.password || "");

    return {
      id,
      name,
      password,
      friends: arr(raw.friends).map((f) => String(f)),
      records: arr(raw.records),
      reviews: arr(raw.reviews),
      mocks: arr(raw.mocks),
      goals: {
        questions: Math.max(1, +raw.goals?.questions || 150),
        sessions: Math.max(1, +raw.goals?.sessions || 15),
      },
    };
  }

  function sanitizeRequest(req, byId) {
    const raw = req && typeof req === "object" ? req : {};
    const fromId = String(raw.fromId || "");
    const toId = String(raw.toId || "");
    if (!byId.has(fromId) || !byId.has(toId) || fromId === toId) return null;
    if (String(raw.status || "pending") !== "pending") return null;
    return {
      id: typeof raw.id === "string" && raw.id ? raw.id : uid(),
      fromId,
      toId,
      status: "pending",
      createdAt: String(raw.createdAt || today()),
    };
  }

  function normalizeV3(raw) {
    const source = raw && typeof raw === "object" ? raw : {};
    const accounts = [];
    const usedIds = new Set();

    arr(source.accounts).forEach((acc, i) => {
      const sanitized = sanitizeAccount(acc, i, accounts);
      if (usedIds.has(sanitized.id)) {
        sanitized.id = createUniqueProfileId(accounts);
      }
      usedIds.add(sanitized.id);
      accounts.push(sanitized);
    });

    const byId = new Map(accounts.map((a) => [a.id, a]));

    accounts.forEach((a) => {
      const unique = [];
      const seen = new Set();
      a.friends.forEach((friendId) => {
        if (friendId === a.id) return;
        if (!byId.has(friendId)) return;
        if (seen.has(friendId)) return;
        seen.add(friendId);
        unique.push(friendId);
      });
      a.friends = unique;
    });

    // Garante amizade bidirecional para evitar estado inconsistente.
    accounts.forEach((a) => {
      a.friends.forEach((friendId) => {
        const friend = byId.get(friendId);
        if (friend && !friend.friends.includes(a.id)) {
          friend.friends.push(a.id);
        }
      });
    });

    const requestMap = new Map();
    arr(source.requests).forEach((req) => {
      const s = sanitizeRequest(req, byId);
      if (!s) return;
      const key = [s.fromId, s.toId].sort().join("|");
      if (requestMap.has(key)) return;
      const from = byId.get(s.fromId);
      if (from && from.friends.includes(s.toId)) return;
      requestMap.set(key, s);
    });
    const requests = [...requestMap.values()];

    const loggedInId = accounts.some((a) => a.id === source.session?.loggedInId)
      ? source.session.loggedInId
      : null;

    let activeId = accounts.some((a) => a.id === source.activeId)
      ? source.activeId
      : loggedInId;

    if (loggedInId && activeId && !canViewProfile(loggedInId, activeId, accounts)) {
      activeId = loggedInId;
    }

    if (!loggedInId) activeId = null;

    return {
      version: 3,
      activeId,
      session: { loggedInId },
      accounts,
      requests,
    };
  }

  function canViewProfile(loggedInId, targetId, accounts) {
    if (!loggedInId || !targetId) return false;
    if (loggedInId === targetId) return true;
    const owner = arr(accounts).find((a) => a.id === loggedInId);
    if (!owner) return false;
    return owner.friends.includes(targetId);
  }

  function sanitizeLegacyStudent(s, fallbackName) {
    const raw = s && typeof s === "object" ? s : {};
    const name =
      String(raw.name || fallbackName || "").trim().slice(0, MAX_NAME) ||
      "Usuário";
    return {
      name,
      records: arr(raw.records),
      reviews: arr(raw.reviews),
      mocks: arr(raw.mocks),
      goals: {
        questions: Math.max(1, +raw.goals?.questions || 150),
        sessions: Math.max(1, +raw.goals?.sessions || 15),
      },
    };
  }

  function migrateFromV2(raw) {
    const students = arr(raw?.students).map((s) => sanitizeLegacyStudent(s, s?.name));
    if (!students.length) return { state: normalizeV3({}), credentials: [] };

    const accounts = [];
    const credentials = [];

    students.forEach((st) => {
      const id = createUniqueProfileId(accounts);
      const password = randomPassword(8);
      accounts.push({
        ...blankAccount(st.name, password, id),
        records: st.records,
        reviews: st.reviews,
        mocks: st.mocks,
        goals: st.goals,
      });
      credentials.push({ name: st.name, id, password });
    });

    return {
      state: normalizeV3({
        version: 3,
        accounts,
        session: { loggedInId: accounts[0].id },
        activeId: accounts[0].id,
      }),
      credentials,
    };
  }

  function migrateFromV1(raw) {
    const students = Object.entries(raw && typeof raw === "object" ? raw : {})
      .filter(([, v]) => v && typeof v === "object")
      .map(([name, v]) => sanitizeLegacyStudent(v, name));

    if (!students.length) return { state: normalizeV3({}), credentials: [] };

    const accounts = [];
    const credentials = [];

    students.forEach((st) => {
      const id = createUniqueProfileId(accounts);
      const password = randomPassword(8);
      accounts.push({
        ...blankAccount(st.name, password, id),
        records: st.records,
        reviews: st.reviews,
        mocks: st.mocks,
        goals: st.goals,
      });
      credentials.push({ name: st.name, id, password });
    });

    return {
      state: normalizeV3({
        version: 3,
        accounts,
        session: { loggedInId: accounts[0].id },
        activeId: accounts[0].id,
      }),
      credentials,
    };
  }

  function load() {
    try {
      const v3 = localStorage.getItem(KEY);
      if (v3) return { state: normalizeV3(JSON.parse(v3)), credentials: [] };

      const v2 = localStorage.getItem(OLD_KEY_V2);
      if (v2) return migrateFromV2(JSON.parse(v2));

      const v1 = localStorage.getItem(OLD_KEY_V1);
      if (v1) return migrateFromV1(JSON.parse(v1));
    } catch (e) {
      // Fallback para estado vazio se houver parse inválido.
    }

    return { state: normalizeV3({}), credentials: [] };
  }

  let migrationCredentials = [];
  let lastUserSearch = "";
  let searchResults = [];
  let state = (() => {
    const loaded = load();
    migrationCredentials = loaded.credentials;
    return loaded.state;
  })();

  function save() {
    try {
      localStorage.setItem(KEY, JSON.stringify(state));
    } catch (e) {
      alert("Não foi possível salvar no navegador (armazenamento cheio ou bloqueado). Exporte um backup.");
    }
    render();
  }

  function accountById(id) {
    return state.accounts.find((a) => a.id === id) || null;
  }

  function areFriends(idA, idB) {
    const a = accountById(idA);
    return !!a && a.friends.includes(idB);
  }

  function findPendingRequest(fromId, toId) {
    return (
      state.requests.find((r) => r.fromId === fromId && r.toId === toId) || null
    );
  }

  function removeRequest(id) {
    state.requests = state.requests.filter((r) => r.id !== id);
  }

  function loggedUser() {
    return accountById(state.session.loggedInId);
  }

  function viewedUser() {
    return accountById(state.activeId);
  }

  function ensureAccess() {
    const owner = loggedUser();
    if (!owner) {
      state.activeId = null;
      return;
    }

    if (!state.activeId) {
      state.activeId = owner.id;
      return;
    }

    if (!canViewProfile(owner.id, state.activeId, state.accounts)) {
      state.activeId = owner.id;
    }
  }

  function isViewingOwnProfile() {
    const owner = loggedUser();
    const target = viewedUser();
    return !!owner && !!target && owner.id === target.id;
  }

  function fillSelect(id) {
    const el = $(id);
    if (!el) return;
    el.innerHTML = subjects.map((s) => `<option>${esc(s)}</option>`).join("");
  }

  ["rSubject", "vSubject"].forEach(fillSelect);
  $("rDate").value = today();
  $("vDate").value = today();
  $("sDate").value = today();

  function renderAuthState() {
    const logged = !!loggedUser();
    $("authPanel").classList.toggle("hidden", logged);
    $("appContent").classList.toggle("hidden", !logged);
  }

  function renderSessionInfo() {
    const me = loggedUser();
    if (!me) return;
    $("sessionInfo").innerHTML = `<strong>${esc(me.name)}</strong> · ID ${esc(me.id)}`;
  }

  function renderFriendList() {
    const me = loggedUser();
    if (!me) return;

    const list = me.friends
      .map((friendId) => accountById(friendId))
      .filter(Boolean)
      .sort((a, b) => a.name.localeCompare(b.name));

    $("friendList").innerHTML = list.length
      ? list
        .map(
          (friend) =>
            `<div class="friend-pill"><button class="small" type="button" onclick="window.viewProfile('${esc(friend.id)}')">Ver ${esc(friend.name)} (${esc(friend.id)})</button><button class="small danger" type="button" onclick="window.removeFriend('${esc(friend.id)}')">Remover</button></div>`,
        )
        .join("")
      : '<div class="muted">Nenhuma amizade adicionada ainda.</div>';
  }

  function findUsers(query) {
    const q = String(query || "").trim();
    if (!q) return [];
    const me = loggedUser();
    if (!me) return [];

    const asId = digits(q);
    if (isValidProfileId(asId)) {
      const byId = accountById(asId);
      return byId && byId.id !== me.id ? [byId] : [];
    }

    const qLower = q.toLowerCase();
    return state.accounts
      .filter((u) => u.id !== me.id)
      .filter((u) => u.name.toLowerCase().includes(qLower))
      .sort((a, b) => a.name.localeCompare(b.name))
      .slice(0, 8);
  }

  function requestStateFor(meId, targetId) {
    if (areFriends(meId, targetId)) return "friend";
    if (findPendingRequest(meId, targetId)) return "outgoing";
    if (findPendingRequest(targetId, meId)) return "incoming";
    return "none";
  }

  function renderSearchResults() {
    const me = loggedUser();
    if (!me) return;

    const box = $("friendSearchResults");
    if (!lastUserSearch) {
      box.innerHTML = "";
      return;
    }

    if (!searchResults.length) {
      box.innerHTML = '<div class="empty">Nenhum usuário encontrado para essa busca.</div>';
      return;
    }

    box.innerHTML = searchResults
      .map((u) => {
        const rel = requestStateFor(me.id, u.id);
        let action = `<button class="small primary" type="button" onclick="window.sendFriendRequest('${esc(u.id)}')">Enviar pedido</button>`;
        if (rel === "friend") action = '<span class="muted">Já é seu amigo</span>';
        if (rel === "outgoing") action = '<span class="muted">Pedido enviado</span>';
        if (rel === "incoming") action = '<span class="muted">Esse usuário já te enviou pedido</span>';
        return `<div class="request-item"><div class="request-head"><strong>${esc(u.name)}</strong><span class="muted">ID ${esc(u.id)}</span></div><div class="request-actions">${action}</div></div>`;
      })
      .join("");
  }

  function renderFriendRequests() {
    const me = loggedUser();
    if (!me) return;

    const incoming = state.requests
      .filter((r) => r.toId === me.id)
      .map((r) => ({ req: r, user: accountById(r.fromId) }))
      .filter((x) => x.user);

    const outgoing = state.requests
      .filter((r) => r.fromId === me.id)
      .map((r) => ({ req: r, user: accountById(r.toId) }))
      .filter((x) => x.user);

    $("incomingRequests").innerHTML = incoming.length
      ? incoming
        .map(
          ({ req, user }) =>
            `<div class="request-item"><div class="request-head"><strong>${esc(user.name)}</strong><span class="muted">ID ${esc(user.id)}</span></div><div class="request-actions"><button class="small primary" type="button" onclick="window.acceptFriendRequest('${esc(req.id)}')">Aceitar</button><button class="small danger" type="button" onclick="window.rejectFriendRequest('${esc(req.id)}')">Recusar</button></div></div>`,
        )
        .join("")
      : '<div class="muted">Sem pedidos recebidos.</div>';

    $("outgoingRequests").innerHTML = outgoing.length
      ? outgoing
        .map(
          ({ req, user }) =>
            `<div class="request-item"><div class="request-head"><strong>${esc(user.name)}</strong><span class="muted">ID ${esc(user.id)}</span></div><div class="request-actions"><button class="small danger" type="button" onclick="window.cancelFriendRequest('${esc(req.id)}')">Cancelar pedido</button></div></div>`,
        )
        .join("")
      : '<div class="muted">Sem pedidos enviados.</div>';
  }

  function renderPeople() {
    const me = loggedUser();
    if (!me) return;

    const ids = [me.id, ...me.friends.filter((id) => accountById(id))];
    const uniqueIds = [...new Set(ids)];

    const box = $("personSwitch");
    box.innerHTML = "";

    uniqueIds.forEach((id) => {
      const p = accountById(id);
      if (!p) return;
      const b = document.createElement("button");
      b.textContent = `${p.name} (${p.id})`;
      b.classList.toggle("active", state.activeId === id);
      b.addEventListener("click", () => {
        state.activeId = id;
        save();
      });
      box.appendChild(b);
    });
  }

  function setEditMode() {
    const target = viewedUser();
    const canEdit = isViewingOwnProfile();
    const notice = $("viewModeNotice");

    notice.classList.toggle("hidden", canEdit || !target);
    if (!canEdit && target) {
      notice.innerHTML = `Você está vendo o perfil de <strong>${esc(target.name)}</strong> (ID ${esc(target.id)}). Neste modo, os formulários ficam em leitura.`;
    }

    ["recordForm", "reviewForm", "mockForm", "goalForm"].forEach((formId) => {
      const form = $(formId);
      if (!form) return;
      form
        .querySelectorAll("input, select, textarea, button")
        .forEach((el) => {
          el.disabled = !canEdit;
        });
    });

    $("clearBtn").disabled = !canEdit;
  }

  function loginByCredentials(id, password) {
    const account = state.accounts.find(
      (a) => a.id === id && a.password === password,
    );
    if (!account) return false;

    state.session.loggedInId = account.id;
    state.activeId = account.id;
    save();
    return true;
  }

  $("registerForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const name = $("regName").value.trim().slice(0, MAX_NAME);
    const password = String($("regPassword").value || "");

    if (!name) return alert("Informe um nome de exibição.");
    if (password.length < MIN_PASSWORD) {
      return alert("A senha deve ter pelo menos 7 caracteres.");
    }

    const id = createUniqueProfileId(state.accounts);
    state.accounts.push(blankAccount(name, password, id));
    state.session.loggedInId = id;
    state.activeId = id;

    e.target.reset();
    save();

    alert(`Perfil criado com sucesso. Sua ID de acesso é: ${id}`);
  });

  $("loginForm").addEventListener("submit", (e) => {
    e.preventDefault();

    const id = digits($("loginId").value).slice(0, PROFILE_ID_SIZE);
    const password = $("loginPassword").value;

    if (!isValidProfileId(id)) return alert("A ID deve ter 5 números.");
    if (!loginByCredentials(id, password)) {
      return alert("ID ou senha inválidos.");
    }

    e.target.reset();
  });

  $("logoutBtn").addEventListener("click", () => {
    state.session.loggedInId = null;
    state.activeId = null;
    lastUserSearch = "";
    searchResults = [];
    save();
  });

  function sendFriendRequestTo(friendId) {
    const me = loggedUser();
    if (!me) return;

    const id = digits(friendId).slice(0, PROFILE_ID_SIZE);

    if (!isValidProfileId(id)) return alert("Informe um ID válido com 5 números.");
    if (id === me.id) return alert("Você não pode enviar pedido para si mesmo.");

    const target = accountById(id);
    if (!target) return alert("Nenhum perfil encontrado com esse ID.");

    if (areFriends(me.id, target.id)) return alert("Esse usuário já é seu amigo.");
    if (findPendingRequest(me.id, target.id)) return alert("Você já enviou um pedido para este usuário.");
    if (findPendingRequest(target.id, me.id)) return alert("Este usuário já te enviou um pedido. Aceite na caixa de pedidos recebidos.");

    state.requests.push({
      id: uid(),
      fromId: me.id,
      toId: target.id,
      status: "pending",
      createdAt: today(),
    });
    save();
    alert("Pedido de amizade enviado.");
  }

  window.removeFriend = (friendId) => {
    const me = loggedUser();
    if (!me) return;

    const friend = accountById(friendId);
    me.friends = me.friends.filter((id) => id !== friendId);

    if (friend) {
      friend.friends = friend.friends.filter((id) => id !== me.id);
    }

    if (state.activeId === friendId) state.activeId = me.id;
    save();
  };

  window.viewProfile = (profileId) => {
    const me = loggedUser();
    if (!me) return;
    if (!canViewProfile(me.id, profileId, state.accounts)) return;

    state.activeId = profileId;
    save();
  };

  window.sendFriendRequest = (profileId) => {
    sendFriendRequestTo(profileId);
  };

  window.acceptFriendRequest = (requestId) => {
    const me = loggedUser();
    if (!me) return;
    const req = state.requests.find((r) => r.id === requestId && r.toId === me.id);
    if (!req) return;

    const from = accountById(req.fromId);
    const to = accountById(req.toId);
    if (!from || !to) {
      removeRequest(req.id);
      save();
      return;
    }

    if (!from.friends.includes(to.id)) from.friends.push(to.id);
    if (!to.friends.includes(from.id)) to.friends.push(from.id);

    state.requests = state.requests.filter(
      (r) =>
        !(
          (r.fromId === from.id && r.toId === to.id) ||
          (r.fromId === to.id && r.toId === from.id)
        ),
    );
    save();
  };

  window.rejectFriendRequest = (requestId) => {
    const me = loggedUser();
    if (!me) return;
    const req = state.requests.find((r) => r.id === requestId && r.toId === me.id);
    if (!req) return;
    removeRequest(req.id);
    save();
  };

  window.cancelFriendRequest = (requestId) => {
    const me = loggedUser();
    if (!me) return;
    const req = state.requests.find((r) => r.id === requestId && r.fromId === me.id);
    if (!req) return;
    removeRequest(req.id);
    save();
  };

  $("friendSearchForm").addEventListener("submit", (e) => {
    e.preventDefault();
    const query = $("friendQuery").value.trim();
    lastUserSearch = query;
    searchResults = findUsers(query);
    renderSearchResults();
  });

  document.querySelectorAll("[data-tab]").forEach((b) =>
    b.addEventListener("click", () => {
      document
        .querySelectorAll("[data-tab]")
        .forEach((x) => x.classList.toggle("active", x === b));
      document
        .querySelectorAll(".panel")
        .forEach((x) => x.classList.toggle("hidden", x.id !== b.dataset.tab));
      render();
    }),
  );

  $("recordForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isViewingOwnProfile()) return;

    const total = +$("rTotal").value;
    const correct = +$("rCorrect").value;

    if (total < 1 || correct < 0 || correct > total) {
      return alert("Confira a quantidade de questões e acertos.");
    }

    loggedUser().records.push({
      id: uid(),
      date: $("rDate").value,
      subject: $("rSubject").value,
      topic: $("rTopic").value.trim(),
      source: $("rSource").value.trim(),
      total,
      correct,
      difficulty: $("rDifficulty").value,
      error: $("rError").value,
      notes: $("rNotes").value.trim(),
    });

    e.target.reset();
    $("rDate").value = today();
    $("rTotal").value = 20;
    $("rCorrect").value = 14;
    save();
    alert("Registro salvo!");
  });

  $("reviewForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isViewingOwnProfile()) return;

    loggedUser().reviews.push({
      id: uid(),
      subject: $("vSubject").value,
      topic: $("vTopic").value.trim(),
      date: $("vDate").value,
      type: $("vType").value,
      done: false,
    });

    e.target.reset();
    $("vDate").value = today();
    save();
  });

  $("mockForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isViewingOwnProfile()) return;

    const total = +$("sTotal").value;
    const correct = +$("sCorrect").value;

    if (total < 1 || correct < 0 || correct > total) {
      return alert("Confira a quantidade de questões e acertos.");
    }

    loggedUser().mocks.push({
      id: uid(),
      date: $("sDate").value,
      name: $("sName").value.trim(),
      total,
      correct,
      minutes: +$("sMinutes").value || 0,
      notes: $("sNotes").value.trim(),
    });

    e.target.reset();
    $("sDate").value = today();
    $("sTotal").value = 60;
    $("sCorrect").value = 35;
    save();
    alert("Simulado salvo!");
  });

  $("goalForm").addEventListener("submit", (e) => {
    e.preventDefault();
    if (!isViewingOwnProfile()) return;

    loggedUser().goals = {
      questions: Math.max(1, +$("gQuestions").value),
      sessions: Math.max(1, +$("gSessions").value),
    };

    save();
    alert("Metas atualizadas!");
  });

  function weekStart(d) {
    const x = new Date(d + "T12:00:00");
    x.setDate(x.getDate() - ((x.getDay() + 6) % 7));
    return iso(x);
  }

  function pct(a, b) {
    return b ? Math.round((a / b) * 100) : 0;
  }

  function render() {
    ensureAccess();
    renderAuthState();

    const owner = loggedUser();
    if (!owner) return;

    const profile = viewedUser() || owner;

    renderSessionInfo();
    renderFriendList();
    renderFriendRequests();
    renderSearchResults();
    renderPeople();
    setEditMode();

    const rs = profile.records;
    const questions = rs.reduce((a, r) => a + r.total, 0);
    const correct = rs.reduce((a, r) => a + r.correct, 0);
    const pending = profile.reviews.filter((r) => !r.done).length;

    $("mQuestions").textContent = questions.toLocaleString("pt-BR");
    $("mAccuracy").textContent = questions ? pct(correct, questions) + "%" : "—";
    $("mSessions").textContent = rs.length;
    $("mReviews").textContent = pending;

    $("gQuestions").value = profile.goals.questions;
    $("gSessions").value = profile.goals.sessions;

    renderTrend(rs);
    renderSubjects(rs);
    renderRecent(rs);
    renderReviews(profile, isViewingOwnProfile());
    renderErrors(rs);
    renderWeak(rs);
    renderMocks(profile, isViewingOwnProfile());
    renderGoals(profile);
  }

  function renderTrend(rs) {
    const c = $("trend");
    const ctx = c.getContext("2d");
    const w = c.clientWidth || 500;
    const h = 210;
    const dpr = window.devicePixelRatio || 1;

    c.width = w * dpr;
    c.height = h * dpr;
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, w, h);

    const days = [];
    for (let i = 6; i >= 0; i--) {
      const d = new Date();
      d.setDate(d.getDate() - i);
      days.push(iso(d));
    }

    const vals = days.map((d) =>
      rs.filter((r) => r.date === d).reduce((a, r) => a + r.correct, 0),
    );

    const max = Math.max(5, ...vals);
    const left = 30;
    const bottom = 175;
    const top = 15;
    const usable = w - left - 12;

    ctx.font = "11px system-ui";
    ctx.fillStyle = getComputedStyle(document.body).color;
    ctx.strokeStyle = "rgba(130,145,135,.25)";

    for (let i = 0; i < 4; i++) {
      const y = top + ((bottom - top) * i) / 3;
      ctx.beginPath();
      ctx.moveTo(left, y);
      ctx.lineTo(w - 8, y);
      ctx.stroke();
    }

    days.forEach((d, i) => {
      const x = left + (usable * (i + 0.5)) / 7;
      const y = bottom - (vals[i] / max) * (bottom - top);

      ctx.fillStyle = getComputedStyle(document.body).color;
      ctx.fillText(d.slice(8, 10) + "/" + d.slice(5, 7), x - 15, 198);

      ctx.fillStyle =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--chart")
          .trim() || "#7e81bd";
      ctx.beginPath();
      ctx.arc(x, y, 4, 0, Math.PI * 2);
      ctx.fill();

      ctx.fillStyle = getComputedStyle(document.body).color;
      if (vals[i]) ctx.fillText(vals[i], x - 4, y - 10);
    });
  }

  function renderSubjects(rs) {
    const box = $("subjectBars");
    if (!rs.length) {
      box.innerHTML =
        '<div class="empty">Registre questões para visualizar seu desempenho por matéria.</div>';
      return;
    }

    const groups = {};
    rs.forEach((r) => {
      groups[r.subject] ??= { c: 0, t: 0 };
      groups[r.subject].c += r.correct;
      groups[r.subject].t += r.total;
    });

    box.innerHTML = Object.entries(groups)
      .sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t)
      .map(
        ([s, v]) =>
          `<div style="margin:0 0 13px"><div style="display:flex;justify-content:space-between;font-size:12px;margin-bottom:5px"><strong>${esc(s)}</strong><span>${pct(v.c, v.t)}% · ${v.t} questões</span></div><div class="progress"><i style="width:${pct(v.c, v.t)}%"></i></div></div>`,
      )
      .join("");
  }

  function renderRecent(rs) {
    const list = [...rs]
      .sort((a, b) => b.date.localeCompare(a.date))
      .slice(0, 6);

    $("recent").innerHTML = list.length
      ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Disciplina / assunto</th><th>Resultado</th><th>Dificuldade</th></tr></thead><tbody>${list
        .map(
          (r) =>
            `<tr><td>${esc(r.date)}</td><td><b>${esc(r.subject)}</b><br>${esc(r.topic)}</td><td>${r.correct}/${r.total} (${pct(r.correct, r.total)}%)</td><td>${esc(r.error || "—")}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
      : '<div class="empty">Ainda não há registros. Comece pela aba “Registrar questões”.</div>';
  }

  function renderReviews(profile, canEdit) {
    const list = [...profile.reviews].sort((a, b) => a.date.localeCompare(b.date));

    $("reviewList").innerHTML = list.length
      ? list
        .map(
          (r) =>
            `<div style="display:flex;gap:10px;align-items:flex-start;padding:10px 0;border-bottom:1px solid var(--line);opacity:${r.done ? 0.55 : 1}"><input type="checkbox" style="width:auto;margin-top:4px" ${r.done ? "checked" : ""} ${canEdit ? `onchange=\"window.toggleReview('${esc(r.id)}',this.checked)\"` : "disabled"}><div style="flex:1"><b>${esc(r.topic)}</b><div class="muted">${esc(r.subject)} · ${esc(r.type)} · ${esc(r.date)}</div></div>${canEdit ? `<button class=\"small danger\" onclick=\"window.removeReview('${esc(r.id)}')\">Excluir</button>` : ""}</div>`,
        )
        .join("")
      : '<div class="empty">Nenhuma revisão agendada.</div>';
  }

  window.toggleReview = (id, v) => {
    if (!isViewingOwnProfile()) return;
    const r = loggedUser().reviews.find((x) => x.id === id);
    if (r) r.done = v;
    save();
  };

  window.removeReview = (id) => {
    if (!isViewingOwnProfile()) return;
    loggedUser().reviews = loggedUser().reviews.filter((x) => x.id !== id);
    save();
  };

  function renderErrors(rs) {
    const g = {};
    rs.forEach((r) => {
      if (r.error) g[r.error] = (g[r.error] || 0) + 1;
    });

    const list = Object.entries(g).sort((a, b) => b[1] - a[1]);

    $("errorList").innerHTML = list.length
      ? list
        .map(
          ([k, v]) =>
            `<div style="display:flex;justify-content:space-between;padding:10px 0;border-bottom:1px solid var(--line);font-size:13px"><span>${esc(k)}</span><b>${v} ocorrência(s)</b></div>`,
        )
        .join("")
      : '<div class="empty">As dificuldades registradas aparecerão aqui.</div>';
  }

  function renderWeak(rs) {
    const g = {};
    rs.forEach((r) => {
      const key = `${r.subject} — ${r.topic}`;
      g[key] ??= { c: 0, t: 0, n: 0 };
      g[key].c += r.correct;
      g[key].t += r.total;
      g[key].n++;
    });

    const list = Object.entries(g)
      .filter((x) => x[1].t >= 5)
      .sort((a, b) => a[1].c / a[1].t - b[1].c / b[1].t)
      .slice(0, 8);

    $("weakList").innerHTML = list.length
      ? list
        .map(
          ([k, v]) =>
            `<div style="padding:10px 0;border-bottom:1px solid var(--line)"><div style="display:flex;justify-content:space-between;gap:8px;font-size:13px"><b>${esc(k)}</b><span>${pct(v.c, v.t)}%</span></div><div class="progress" style="margin-top:7px"><i style="width:${pct(v.c, v.t)}%"></i></div><div class="muted">${v.t} questões em ${v.n} registro(s)</div></div>`,
        )
        .join("")
      : '<div class="empty">Registre pelo menos 5 questões por assunto para encontrar pontos de atenção.</div>';
  }

  function renderMocks(profile, canEdit) {
    const list = [...profile.mocks].sort((x, y) => y.date.localeCompare(x.date));

    $("mockList").innerHTML = list.length
      ? `<div class="table-wrap"><table><thead><tr><th>Data</th><th>Simulado</th><th>Resultado</th><th>Tempo</th><th></th></tr></thead><tbody>${list
        .map(
          (m) =>
            `<tr><td>${esc(m.date)}</td><td><b>${esc(m.name)}</b><br><span class="muted">${esc(m.notes)}</span></td><td><b>${pct(m.correct, m.total)}%</b><br>${m.correct}/${m.total}</td><td>${m.minutes ? m.minutes + " min" : "—"}</td><td>${canEdit ? `<button class=\"small danger\" onclick=\"window.removeMock('${esc(m.id)}')\">Excluir</button>` : ""}</td></tr>`,
        )
        .join("")}</tbody></table></div>`
      : '<div class="empty">Seus simulados aparecerão aqui.</div>';
  }

  window.removeMock = (id) => {
    if (!isViewingOwnProfile()) return;
    loggedUser().mocks = loggedUser().mocks.filter((x) => x.id !== id);
    save();
  };

  function renderGoals(profile) {
    const start = weekStart(today());
    const week = profile.records.filter((r) => r.date >= start && r.date <= today());
    const q = week.reduce((a, r) => a + r.total, 0);
    const s = week.length;
    const g = profile.goals;

    $("goalProgress").innerHTML =
      `<div style="margin-bottom:20px"><div style="display:flex;justify-content:space-between;margin-bottom:7px"><b>Questões</b><span>${q} / ${g.questions}</span></div><div class="progress"><i style="width:${Math.min(100, pct(q, g.questions))}%"></i></div><div class="muted" style="margin-top:5px">${Math.max(0, g.questions - q)} questões para atingir a meta</div></div><div><div style="display:flex;justify-content:space-between;margin-bottom:7px"><b>Sessões</b><span>${s} / ${g.sessions}</span></div><div class="progress"><i style="width:${Math.min(100, pct(s, g.sessions))}%"></i></div><div class="muted" style="margin-top:5px">${Math.max(0, g.sessions - s)} sessões para atingir a meta</div></div>`;
  }

  $("exportBtn").addEventListener("click", () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], {
      type: "application/json",
    });
    const a = document.createElement("a");
    a.href = URL.createObjectURL(blob);
    a.download = `backup-trilha-aprovacao-${today()}.json`;
    a.click();
    URL.revokeObjectURL(a.href);
  });

  $("importBtn").addEventListener("click", () => $("importFile").click());

  $("importFile").addEventListener("change", async (e) => {
    const f = e.target.files[0];
    if (!f) return;

    try {
      const data = JSON.parse(await f.text());
      let next = null;
      let importedCredentials = [];

      if (data && Array.isArray(data.accounts)) {
        next = normalizeV3(data);
      } else if (data && Array.isArray(data.students)) {
        const migrated = migrateFromV2(data);
        next = migrated.state;
        importedCredentials = migrated.credentials;
      } else if (
        data &&
        typeof data === "object" &&
        Object.values(data).some((v) => v && Array.isArray(v.records))
      ) {
        const migrated = migrateFromV1(data);
        next = migrated.state;
        importedCredentials = migrated.credentials;
      } else {
        throw new Error("Formato inválido");
      }

      if (
        !confirm(
          "Importar este backup substitui TODOS os dados atuais deste navegador. Continuar?",
        )
      ) {
        e.target.value = "";
        return;
      }

      state = next;
      save();

      if (importedCredentials.length) {
        const lines = importedCredentials
          .map((x) => `• ${x.name}: ID ${x.id} | senha ${x.password}`)
          .join("\n");
        alert(`Backup antigo convertido para perfis com login. Guarde as credenciais:\n\n${lines}`);
      } else {
        alert("Backup importado!");
      }
    } catch (err) {
      alert("Arquivo inválido ou incompatível.");
    }

    e.target.value = "";
  });

  $("clearBtn").addEventListener("click", () => {
    if (!isViewingOwnProfile()) return;
    const me = loggedUser();
    if (!me) return;

    if (
      confirm(
        `Apagar todos os seus registros (${me.name}) deste navegador? Esta ação não pode ser desfeita. Exporte um backup antes, se necessário.`,
      )
    ) {
      Object.assign(me, blankAccount(me.name, me.password, me.id), {
        id: me.id,
        name: me.name,
        password: me.password,
        friends: me.friends,
      });
      save();
    }
  });

  const themeBtn = $("themeBtn");

  function currentTheme() {
    return document.documentElement.dataset.theme || "dark";
  }

  function paintThemeBtn() {
    themeBtn.textContent =
      currentTheme() === "dark" ? "☀ Modo dia" : "☾ Modo noite";
  }

  themeBtn.addEventListener("click", () => {
    const next = currentTheme() === "dark" ? "light" : "dark";
    document.documentElement.dataset.theme = next;
    try {
      localStorage.setItem("trilha_tema", next);
    } catch (e) {
      // Ignora bloqueios de armazenamento.
    }
    paintThemeBtn();
    const profile = viewedUser();
    renderTrend(profile ? profile.records : []);
  });

  paintThemeBtn();

  window.addEventListener("resize", () => {
    const profile = viewedUser();
    renderTrend(profile ? profile.records : []);
  });

  if (migrationCredentials.length) {
    const lines = migrationCredentials
      .map((x) => `• ${x.name}: ID ${x.id} | senha ${x.password}`)
      .join("\n");
    alert(`Dados antigos convertidos para o novo sistema de login. Guarde as credenciais:\n\n${lines}`);
  }

  render();
})();
