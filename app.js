const DATA_URL = "./data/federal.json";
const DB_NAME = "FederalIntelligence";
const STORE_NAME = "cache";
const ANALYSIS_WINDOW = 15;
let contests = [];
let updatedAt = null;

const $ = (id) => document.getElementById(id);
const fmtDate = (value) => {
  if (!value) return "—";
  const [y,m,d] = value.split("-");
  return `${d}/${m}/${y}`;
};
const fmtDateTime = (value) => value ? new Date(value).toLocaleString("pt-BR") : "—";

function openDb() {
  return new Promise((resolve, reject) => {
    if (!("indexedDB" in window)) return resolve(null);
    const request = indexedDB.open(DB_NAME, 1);
    request.onupgradeneeded = () => {
      if (!request.result.objectStoreNames.contains(STORE_NAME)) {
        request.result.createObjectStore(STORE_NAME);
      }
    };
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}
async function saveCache(payload) {
  const db = await openDb();
  if (!db) return;
  await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readwrite");
    tx.objectStore(STORE_NAME).put(payload, "latest");
    tx.oncomplete = resolve;
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}
async function readCache() {
  const db = await openDb();
  if (!db) return null;
  const value = await new Promise((resolve, reject) => {
    const tx = db.transaction(STORE_NAME, "readonly");
    const req = tx.objectStore(STORE_NAME).get("latest");
    req.onsuccess = () => resolve(req.result || null);
    req.onerror = () => reject(req.error);
  });
  db.close();
  return value;
}
function setConnection(label, ok=false) {
  $("connectionLabel").textContent = label;
  $("liveDot").style.background = ok ? "var(--green)" : "#d5a64d";
}
function ranked(values) {
  const counts = new Map();
  values.forEach(v => counts.set(v, (counts.get(v) || 0) + 1));
  return [...counts.entries()]
    .map(([value,count]) => ({value,count}))
    .filter(x => x.count > 1)
    .sort((a,b) => b.count - a.count || a.value.localeCompare(b.value))
    .slice(0,8);
}
function renderRank(id, values) {
  const el = $(id);
  const rows = ranked(values);
  if (!rows.length) {
    el.className = "rank-list empty";
    el.textContent = "Nenhuma repetição nesta janela.";
    return;
  }
  const max = Math.max(...rows.map(x => x.count));
  el.className = "rank-list";
  el.innerHTML = rows.map(x =>
    `<div class="rank-row"><span class="rank-value">${x.value}</span><div class="bar"><i style="width:${Math.max(5,x.count/max*100)}%"></i></div><span class="rank-count">${x.count}×</span></div>`
  ).join("");
}
function render() {
  const windowed = contests.slice(0, ANALYSIS_WINDOW);
  const tickets = windowed.flatMap(c => c.premios.map(p => p.bilhete));
  $("windowCount").textContent = `${windowed.length}/${ANALYSIS_WINDOW}`;
  $("ticketCount").textContent = tickets.length;
  const last = windowed[0];
  $("lastContest").textContent = last ? `#${last.numero}` : "—";
  $("lastDate").textContent = last ? fmtDate(last.data_concurso) : "Aguardando dados";
  $("lastSync").textContent = fmtDateTime(updatedAt);
  $("syncStatus").textContent = contests.length ? `${contests.length} concursos no arquivo` : "Sem concursos";
  renderRank("terminacoes", tickets.map(n => n.slice(-2)));
  renderRank("centenas", tickets.map(n => n.slice(-3)));
  renderRank("milhares", tickets.map(n => n.slice(-4)));

  $("resultsBody").innerHTML = windowed.length ? windowed.map(c => {
    const prizes = [...c.premios].sort((a,b) => a.posicao - b.posicao);
    return `<tr><td>#${c.numero}</td><td>${fmtDate(c.data_concurso)}</td>${[0,1,2,3,4].map(i => `<td class="ticket">${prizes[i]?.bilhete || "—"}</td>`).join("")}</tr>`;
  }).join("") : `<tr><td colspan="7" class="empty-cell">Nenhum resultado disponível. Conecte-se à internet e tente atualizar.</td></tr>`;
}
function validatePayload(payload) {
  if (!payload || !Array.isArray(payload.concursos)) throw new Error("Arquivo de resultados inválido.");
  const valid = payload.concursos.filter(c =>
    Number.isInteger(Number(c.numero)) &&
    /^\d{4}-\d{2}-\d{2}$/.test(c.data_concurso || "") &&
    Array.isArray(c.premios) && c.premios.length === 5 &&
    c.premios.every(p => /^\d{5,6}$/.test(String(p.bilhete)))
  );
  if (!valid.length) throw new Error("Nenhum concurso passou pela validação.");
  return valid.sort((a,b) => Number(b.numero) - Number(a.numero));
}
async function loadData() {
  setConnection("Consultando dados publicados...");
  $("refreshBtn").disabled = true;
  try {
    const response = await fetch(`${DATA_URL}?v=${Date.now()}`, {cache:"no-store"});
    if (!response.ok) throw new Error(`Arquivo de dados indisponível (${response.status}).`);
    const payload = await response.json();
    updatedAt = payload.atualizado_em || null;
    contests = validatePayload(payload);
    await saveCache(payload);
    setConnection("Dados atualizados", true);
    render();
  } catch (error) {
    try {
      const cached = await readCache();
      if (cached) {
        updatedAt = cached.atualizado_em || null;
        contests = validatePayload(cached);
        setConnection("Offline · usando cópia local");
        render();
      } else {
        setConnection("Não foi possível carregar os dados");
        $("resultsBody").innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(error.message)}</td></tr>`;
      }
    } catch (cacheError) {
      setConnection("Falha ao ler dados locais");
      $("resultsBody").innerHTML = `<tr><td colspan="7" class="empty-cell">${escapeHtml(cacheError.message)}</td></tr>`;
    }
  } finally {
    $("refreshBtn").disabled = false;
  }
}
function escapeHtml(value) {
  return String(value).replace(/[&<>"']/g, c => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[c]));
}
$("refreshBtn").addEventListener("click", loadData);
loadData();
if ("serviceWorker" in navigator) {
  window.addEventListener("load", () => navigator.serviceWorker.register("./service-worker.js").catch(() => {}));
}