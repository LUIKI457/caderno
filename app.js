/* ===== CONFIGURAÇÃO — edite apenas aqui ===== */
const CONFIG = {
    owner: "LUIKI457",
    repo: "caderno",
    branch: "main",
    contentFolder: "materias"
};

/* ============================================= */

const TTL = 10 * 60 * 1000; // validade do cache (10 min)
const CACHE_KEY = `caderno:${CONFIG.owner}/${CONFIG.repo}@${CONFIG.branch}`;
const API = `https://api.github.com/repos/${CONFIG.owner}/${CONFIG.repo}`;
const LIST = /^\s*([-*•–]|\d+[.)])\s+/;
const NAMES = { historia: "História", geografia: "Geografia", matematica: "Matemática", portugues: "Português", ingles: "Inglês", fisica: "Física", quimica: "Química", biologia: "Biologia", ciencias: "Ciências", filosofia: "Filosofia", sociologia: "Sociologia", redacao: "Redação", literatura: "Literatura", geral: "Geral", artes: "Artes", espanhol: "Espanhol", informatica: "Informática", programacao: "Programação" };
const K = {
    title: ["titulo", "título", "title", "nome", "name"],
    subject: ["materia", "matéria", "subject", "disciplina"],
    desc: ["descricao", "descrição", "description", "resumo", "summary"],
    body: ["conteudo", "conteúdo", "content", "texto", "text"],
    subs: ["topicos", "tópicos", "topics", "secoes", "seções", "sections", "itens", "items"]
};

const state = { files: [], loadedAt: 0, sort: "name", query: "", error: null, busy: false, font: +localStorage.getItem("caderno:font") || 18 };
const $ = s => document.querySelector(s);

/* ---------- utilidades (DOM seguro: só textContent/append) ---------- */
function h(tag, props, ...kids) {
    const e = document.createElement(tag);
    for (const [k, v] of Object.entries(props || {})) {
        if (k === "class") e.className = v;
        else if (k.startsWith("on")) e.addEventListener(k.slice(2), v);
        else if (v !== false && v != null) e.setAttribute(k, v);
    }
    for (const c of kids.flat()) if (c != null && c !== false) e.append(c.nodeType ? c : String(c));
    return e;
}
const norm = s => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLowerCase();
const slug = s => norm(s).replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "");
const pretty = s => NAMES[slug(s)] || s.replace(/[-_]+/g, " ").replace(/(^|\s)\p{L}/gu, c => c.toUpperCase());
const pick = (o, keys) => { for (const k of keys) if (o[k] != null && o[k] !== "") return o[k]; };
const href = id => "#" + id.split("/").map(encodeURIComponent).join("/");
const toText = v => typeof v === "string" ? v
    : typeof v === "number" || typeof v === "boolean" ? String(v)
    : Array.isArray(v) && v.every(x => x === null || typeof x !== "object") ? v.map(x => "- " + x).join("\n") : null;

/* ---------- descoberta no GitHub ---------- */
async function gh(url) {
    const r = await fetch(url, { headers: { Accept: "application/vnd.github+json" } });
    if (!r.ok) throw new Error(
        r.status === 403 || r.status === 429 ? "Limite de requisições da API do GitHub atingido. Tente de novo mais tarde."
        : r.status === 404 ? "Repositório ou pasta não encontrado. Confira o CONFIG no app.js (o repositório precisa ser público)."
        : `A API do GitHub respondeu com erro ${r.status}.`);
    return r.json();
}
async function walk(path) {
    const items = await gh(`${API}/contents/${encodeURI(path)}?ref=${encodeURIComponent(CONFIG.branch)}`);
    const out = [];
    if (!Array.isArray(items)) return out;
    await Promise.all(items.map(async it => {
        if (it.type === "dir") out.push(...await walk(it.path));
        else if (it.type === "file" && /\.(json|txt)$/i.test(it.name)) out.push(it);
    }));
    return out;
}

/* ---------- cache ---------- */
function readCache() { try { return JSON.parse(localStorage.getItem(CACHE_KEY)); } catch { return null; } }
function writeCache() {
    try {
        localStorage.setItem(CACHE_KEY, JSON.stringify({
            time: state.loadedAt,
            files: state.files.map(({ name, path, sha, url, date, rawContent, loadError }) => ({ name, path, sha, url, date, rawContent, loadError }))
        }));
    } catch { /* cache cheio: ignora */ }
}
function setFiles(files, time) { state.files = files.map(hydrate); state.loadedAt = time; }

async function load(force) {
    const c = readCache();
    if (!force && c && Date.now() - c.time < TTL) return setFiles(c.files, c.time);
    try {
        const items = await walk(CONFIG.contentFolder);
        const old = new Map((c?.files || []).map(f => [f.path, f]));
        const files = await Promise.all(items.map(async it => {
            const p = old.get(it.path), same = p && p.sha === it.sha && !p.loadError;
            const f = { name: it.name, path: it.path, sha: it.sha, url: it.html_url, date: p && p.sha === it.sha ? p.date : null };
            if (same) f.rawContent = p.rawContent;
            else try {
                const r = await fetch(it.download_url);
                if (!r.ok) throw new Error("HTTP " + r.status);
                f.rawContent = await r.text();
            } catch (e) { f.rawContent = ""; f.loadError = `Não foi possível carregar o arquivo (${e.message}).`; }
            return f;
        }));
        setFiles(files, Date.now());
        writeCache();
    } catch (e) {
        if (c) setFiles(c.files, c.time);
        throw e;
    }
}

// Datas vêm da Commits API; só são buscadas quando o usuário ordena por data.
async function ensureDates() {
    const todo = state.files.filter(f => !f.date);
    if (!todo.length) return;
    await Promise.all(todo.map(async f => {
        try {
            const r = await gh(`${API}/commits?path=${encodeURIComponent(f.path)}&sha=${encodeURIComponent(CONFIG.branch)}&per_page=1`);
            f.date = r[0]?.commit?.committer?.date || null;
        } catch { /* sem data */ }
    }));
    writeCache();
}

/* ---------- interpretação ---------- */
function hydrate(f) {
    const root = CONFIG.contentFolder.replace(/^\/|\/$/g, "");
    const rel = f.path.startsWith(root + "/") ? f.path.slice(root.length + 1) : f.path;
    const parts = rel.split("/");
    Object.assign(f, { rel, id: rel.replace(/\.[^.]+$/, ""), type: f.name.split(".").pop().toLowerCase(), subject: parts.length > 1 ? parts[0] : "geral", folders: parts.slice(1, -1) });
    const fb = pretty(f.name.replace(/\.[^.]+$/, ""));
    let p = { title: fb, subject: "", description: "", sections: [], tree: null };
    f.parseError = f.loadError || null;
    if (!f.loadError) try { p = f.type === "json" ? parseJSON(f.rawContent, fb) : parseTXT(f.rawContent, fb); }
    catch (e) { f.parseError = "Erro ao interpretar o JSON: " + e.message; }
    f.parsedContent = p;
    f.title = p.title;
    f.plain = toPlain(f);
    f.index = norm([f.name, p.title, f.plain].join("\n"));
    return f;
}

function parseTXT(text, fb) {
    const blocks = []; let b = [];
    for (const l of text.replace(/\r\n?/g, "\n").split("\n")) { if (l.trim()) b.push(l); else if (b.length) { blocks.push(b); b = []; } }
    if (b.length) blocks.push(b);
    const head = l => /^#{1,6}\s/.test(l) || (l.length <= 80 && !/[.;,!?]$/.test(l) && !LIST.test(l));
    const clean = l => l.replace(/^#{1,6}\s+/, "").replace(/:$/, "").trim();
    const sections = []; let title = null, cur = { title: "", body: [] };
    const push = () => { if (cur.title || cur.body.length) sections.push({ title: cur.title, body: cur.body.join("\n\n") }); };
    blocks.forEach((bl, i) => {
        const single = bl.length === 1 && head(bl[0]);
        const withList = bl.length > 1 && head(bl[0]) && LIST.test(bl[1]);
        if (i === 0 && single) { title = clean(bl[0]); return; }
        if (single || withList) { push(); cur = { title: clean(bl[0]), body: [] }; if (withList) cur.body.push(bl.slice(1).join("\n")); }
        else cur.body.push(bl.join("\n"));
    });
    push();
    return { title: title || fb, subject: "", description: "", sections, tree: null };
}

function addSubs(v, list, lvl) {
    const arr = Array.isArray(v) ? v : v && typeof v === "object"
        ? Object.entries(v).map(([k, x]) => x && typeof x === "object" && !Array.isArray(x) ? { titulo: k, ...x } : { titulo: k, conteudo: x })
        : [v];
    arr.forEach(it => {
        if (it === null || typeof it !== "object" || Array.isArray(it)) { list.push({ title: "", body: toText(it) ?? String(it), level: lvl }); return; }
        const t = pick(it, K.title), body = toText(pick(it, K.body)), subs = pick(it, K.subs);
        if (t || body || subs) list.push({ title: t ? String(t) : "", body: body || "", level: lvl });
        else list.push({ title: "", body: "", tree: it, level: lvl });
        if (subs) addSubs(subs, list, Math.min(lvl + 1, 4));
    });
}

function parseJSON(raw, fb) {
    const data = JSON.parse(raw);
    const out = { title: fb, subject: "", description: "", sections: [], tree: null };
    if (data === null || typeof data !== "object") { out.tree = data; return out; }
    const obj = Array.isArray(data) ? { topicos: data } : data;
    const t = pick(obj, K.title), s = pick(obj, K.subject), d = pick(obj, K.desc);
    if (typeof t === "string") out.title = t;
    if (typeof s === "string") out.subject = s;
    if (typeof d === "string") out.description = d;
    const body = toText(pick(obj, K.body));
    if (body) out.sections.push({ title: "", body, level: 2 });
    const subs = pick(obj, K.subs);
    if (subs) addSubs(subs, out.sections, 2);
    const known = Object.values(K).flat();
    const rest = Object.fromEntries(Object.entries(obj).filter(([k]) => !known.includes(k)));
    if (!out.sections.length && !out.description) out.tree = data;           // estrutura desconhecida
    else if (Object.keys(rest).length) out.tree = rest;                       // campos extras
    return out;
}

function toPlain(f) {
    const p = f.parsedContent;
    if (f.parseError && !p.sections.length && !p.tree) return f.rawContent;
    const parts = [p.title, p.description, ...p.sections.map(s => [s.title && "## " + s.title, s.body].filter(Boolean).join("\n"))];
    if (p.tree != null) parts.push(typeof p.tree === "object" ? JSON.stringify(p.tree, null, 2) : String(p.tree));
    return parts.filter(Boolean).join("\n\n");
}

/* ---------- renderização de conteúdo ---------- */
function renderText(t) {
    const box = h("div", { class: "txt" });
    for (const b of String(t).replace(/\r\n?/g, "\n").split(/\n\s*\n/)) {
        let para = [], list = null;
        const flushP = () => { if (para.length) { box.append(h("p", {}, para.join("\n"))); para = []; } };
        const flushL = () => { if (list) { box.append(list); list = null; } };
        for (const l of b.split("\n")) {
            const m = l.match(LIST);
            if (m) {
                const tag = /\d/.test(m[1]) ? "ol" : "ul";
                flushP();
                if (list && list.localName !== tag) flushL();
                list = list || h(tag);
                list.append(h("li", {}, l.slice(m[0].length)));
            } else if (l.trim()) { flushL(); para.push(l.trim()); }
        }
        flushP(); flushL();
    }
    return box;
}
function renderTree(v) {
    if (v === null || typeof v !== "object") return h("span", {}, String(v));
    const arr = Array.isArray(v), dl = h("dl", { class: "tree" });
    for (const [k, x] of Object.entries(v)) dl.append(h("dt", {}, arr ? "#" + (+k + 1) : pretty(k)), h("dd", {}, renderTree(x)));
    return dl;
}
function renderDoc(f) {
    const p = f.parsedContent, box = document.createDocumentFragment();
    if (p.description) box.append(h("p", { class: "lead" }, p.description));
    for (const s of p.sections) {
        if (s.title) box.append(h("h" + (s.level || 2), {}, s.title));
        if (s.body) box.append(renderText(s.body));
        if (s.tree) box.append(renderTree(s.tree));
    }
    if (p.tree != null) { box.append(h("h2", {}, p.sections.length ? "Outros dados" : "Conteúdo")); box.append(renderTree(p.tree)); }
    return box;
}

/* ---------- agrupamentos e ordenação ---------- */
function subjects() {
    const m = new Map();
    for (const f of state.files) {
        if (!m.has(f.subject)) m.set(f.subject, { key: f.subject, name: pretty(f.subject), files: [] });
        const s = m.get(f.subject); s.files.push(f);
        const js = f.parsedContent.subject;
        if (js && slug(js) === slug(f.subject)) s.name = js;   // "historia" + "materia":"História" => acento correto
    }
    return new Map([...m].sort((a, b) => a[1].name.localeCompare(b[1].name, "pt")));
}
const subjName = f => subjects().get(f.subject).name;
function sorted(list) {
    const cmp = (a, b) => a.title.localeCompare(b.title, "pt", { numeric: true });
    const by = { name: cmp, date: (a, b) => (b.date || "").localeCompare(a.date || "") || cmp(a, b), subject: (a, b) => subjName(a).localeCompare(subjName(b), "pt") || cmp(a, b) };
    return [...list].sort(by[state.sort]);
}

/* ---------- views ---------- */
function card(f, q) {
    const desc = f.parsedContent.description || f.plain.split("\n").slice(1).join(" ").trim();
    return h("a", { class: "card", href: href(f.id), onclick: () => { state.query = ""; $("#search").value = ""; } },
        h("b", {}, f.title),
        q ? snippet(f, q) : (desc && h("p", {}, desc)),
        h("div", { class: "meta" }, h("span", { class: "tag ok" }, f.type.toUpperCase()), q || state.sort === "subject" ? h("span", {}, subjName(f)) : null,
            f.parseError && h("span", { class: "tag bad" }, "erro"), h("span", {}, f.rel)));
}
function snippet(f, q) {
    const t = f.plain.replace(/\s+/g, " "), i = norm(t).indexOf(norm(q.split(/\s+/)[0]));
    if (i < 0) return h("p", {}, t.slice(0, 140));
    const a = Math.max(0, i - 50), n = q.split(/\s+/)[0].length;
    return h("p", { class: "snip" }, (a ? "…" : "") + t.slice(a, i), h("mark", {}, t.slice(i, i + n)), t.slice(i + n, i + 120) + "…");
}
function sortBar(count) {
    const sel = h("select", { "aria-label": "Ordenar", onchange: async e => { state.sort = e.target.value; if (state.sort === "date") { await ensureDates(); } render(); } },
        ...[["name", "Nome"], ["date", "Data (mais recentes)"], ["subject", "Matéria"]].map(([v, l]) => h("option", { value: v, selected: v === state.sort }, l)));
    return h("div", { class: "bar" }, h("span", { class: "sub", style: "margin:0" }, `${count} conteúdo${count === 1 ? "" : "s"}`), h("label", {}, "Ordenar por", sel));
}
function emptyBox() { return h("div", { class: "empty" }, `Nenhum conteúdo encontrado.\nAdicione arquivos .json ou .txt à pasta /${CONFIG.contentFolder} do repositório.`); }

function home() {
    const box = h("div");
    box.append(h("h1", {}, "Caderno de estudos"), h("p", { class: "sub" }, "Tudo o que está na pasta do repositório aparece aqui."));
    if (!state.files.length) return (box.append(emptyBox()), box);
    box.append(h("h2", { class: "sec" }, "Matérias"));
    box.append(h("div", { class: "grid" }, [...subjects().values()].map(s =>
        h("a", { class: "card", href: href(s.key) }, h("b", {}, s.name), h("div", { class: "meta" }, `${s.files.length} conteúdo${s.files.length === 1 ? "" : "s"}`)))));
    box.append(h("h2", { class: "sec" }, "Estrutura de pastas"), treeView());
    return box;
}
function treeView() {
    const root = {};
    for (const f of state.files) { let n = root; for (const p of f.rel.split("/").slice(0, -1)) n = n[p] ??= {}; (n["\0files"] ??= []).push(f); }
    const draw = (n, open) => h("div", {},
        Object.entries(n).filter(([k]) => k !== "\0files").sort(([a], [b]) => a.localeCompare(b)).map(([k, v]) =>
            h("details", { class: "dir", open: open || null }, h("summary", {}, (open ? pretty(k) : k) + "/"), draw(v, false))),
        sorted(n["\0files"] || []).map(f => h("a", { class: "leaf", href: href(f.id) }, f.name)));
    return draw(root, true);
}

function subjectView(key) {
    const s = subjects().get(key), box = h("div");
    box.append(h("div", { class: "crumbs" }, h("a", { href: "#" }, "Início"), h("span", { class: "sep" }, "/"), s.name),
        h("h1", {}, s.name), sortBar(s.files.length));
    const groups = new Map();
    for (const f of sorted(s.files)) { const g = f.folders.join(" / "); (groups.get(g) || groups.set(g, []).get(g)).push(f); }
    for (const [g, fs] of groups) {
        if (g || groups.size > 1) box.append(h("div", { class: "group" }, g ? pretty(g) + "/" : "Raiz da matéria"));
        box.append(h("div", { class: "grid" }, fs.map(f => card(f))));
    }
    return box;
}

function searchView() {
    const q = state.query.trim(), terms = norm(q).split(/\s+/);
    const res = sorted(state.files.filter(f => terms.every(t => f.index.includes(t))));
    const box = h("div", {}, h("h1", {}, "Busca"), h("p", { class: "sub" }, `${res.length} resultado${res.length === 1 ? "" : "s"} para “${q}”`));
    box.append(res.length ? h("div", { class: "grid" }, res.map(f => card(f, q))) : h("div", { class: "empty" }, "Nada encontrado. Tente outro termo."));
    return box;
}

function reader(f) {
    const sub = subjects().get(f.subject), list = sorted(sub.files), i = list.indexOf(f);
    const prev = list[i - 1], next = list[i + 1];
    const setFont = d => { state.font = Math.min(30, Math.max(14, state.font + d)); localStorage.setItem("caderno:font", state.font); applyFont(); };
    const copy = h("button", { class: "btn", onclick: async () => {
        try { await navigator.clipboard.writeText(f.plain); copy.textContent = "Copiado ✓"; } catch { copy.textContent = "Não foi possível copiar"; }
        setTimeout(() => copy.textContent = "Copiar conteúdo", 1800);
    } }, "Copiar conteúdo");
    const body = h("div", { class: "body" });
    if (f.parseError) {
        body.append(h("div", { class: "warn" }, f.parseError + " O arquivo está sendo mostrado como texto bruto."), h("pre", { class: "raw" }, f.rawContent));
        if (f.parsedContent.sections.length || f.parsedContent.tree) body.append(renderDoc(f));
    } else body.append(renderDoc(f));
    const nav = (x, label) => x ? h("a", { href: href(x.id) }, h("small", {}, label), x.title) : h("span");
    return h("article", { class: "reader" },
        h("div", { class: "crumbs" }, h("a", { href: "#" }, "Início"), h("span", { class: "sep" }, "/"), h("a", { href: href(sub.key) }, sub.name),
            f.folders.map(x => [h("span", { class: "sep" }, "/"), pretty(x)]), h("span", { class: "sep" }, "/"), f.title),
        h("h1", {}, f.title),
        h("div", { class: "meta" }, h("span", { class: "tag ok" }, f.type.toUpperCase()), h("span", {}, sub.name), f.parseError && h("span", { class: "tag bad" }, "erro ao interpretar")),
        h("div", { class: "tools" },
            h("button", { class: "btn", onclick: () => { location.hash = href(sub.key); } }, "← Voltar"),
            h("button", { class: "btn", "aria-label": "Diminuir fonte", onclick: () => setFont(-1) }, "A−"),
            h("button", { class: "btn", "aria-label": "Aumentar fonte", onclick: () => setFont(1) }, "A+"), copy),
        body,
        h("div", { class: "pager" }, nav(prev, "Anterior"), nav(next, "Próximo")));
}

/* ---------- shell ---------- */
function renderSidebar() {
    const cur = currentId(), f = state.files.find(x => x.id === cur), active = f ? f.subject : cur;
    $("#homeBtn").classList.toggle("on", !cur && !state.query);
    $("#subjects").replaceChildren(...[...subjects().values()].map(s =>
        h("button", { class: "nav" + (s.key === active ? " on" : ""), onclick: () => { state.query = ""; $("#search").value = ""; location.hash = href(s.key); closeMenu(); } },
            s.name, h("span", { class: "count" }, s.files.length))));
}
function renderStatus() {
    const box = $("#status"); box.replaceChildren();
    if (state.loadedAt) {
        const m = Math.round((Date.now() - state.loadedAt) / 60000);
        box.append(`Atualizado ${m < 1 ? "agora há pouco" : m < 60 ? `há ${m} min` : `há ${Math.round(m / 60)} h`} (${new Date(state.loadedAt).toLocaleString("pt-BR", { dateStyle: "short", timeStyle: "short" })})`);
    }
    if (state.error) box.append(h("div", { class: "err" }, state.error + (state.files.length ? " Mostrando a última versão salva." : "")));
}
const currentId = () => { try { return decodeURIComponent(location.hash.slice(1)); } catch { return ""; } };
function render() {
    renderSidebar(); renderStatus();
    const v = $("#view"), id = currentId();
    let node;
    if (!state.files.length && state.error) node = h("div", { class: "empty" }, "Não foi possível ler o repositório.\n" + state.error);
    else if (!state.files.length && !state.loadedAt) node = h("p", { class: "sub" }, "Carregando conteúdos…");
    else if (state.query.trim()) node = searchView();
    else if (state.files.find(x => x.id === id)) node = reader(state.files.find(x => x.id === id));
    else if (subjects().has(id)) node = subjectView(id);
    else node = home();
    v.replaceChildren(node);
}
function applyFont() { document.documentElement.style.setProperty("--fs", state.font + "px"); }
function closeMenu() { document.body.classList.remove("open"); }
async function refresh(force) {
    state.busy = true; document.body.classList.add("busy"); $("#refreshBtn").disabled = true;
    try { await load(force); state.error = null; } catch (e) { state.error = e.message || "Falha ao acessar o GitHub."; }
    state.busy = false; document.body.classList.remove("busy"); $("#refreshBtn").disabled = false;
    render();
}

applyFont();
$("#menuBtn").onclick = () => document.body.classList.toggle("open");
$("#scrim").onclick = closeMenu;
$("#homeBtn").onclick = () => { state.query = ""; $("#search").value = ""; location.hash = ""; closeMenu(); render(); };
$("#refreshBtn").onclick = () => refresh(true);
$("#search").addEventListener("input", e => { state.query = e.target.value; render(); });
window.addEventListener("hashchange", () => { closeMenu(); render(); window.scrollTo(0, 0); });
setInterval(renderStatus, 30000);
render();
refresh(false);
