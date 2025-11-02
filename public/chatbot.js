// === CONFIG ===

const API_URL = "https://wf-ai-chat.vercel.app/api/chat";

const CHAT_KEY    = `wf_ai_chat_${location.pathname}`;

const SESSION_KEY = "wf_ai_session_id";

const PROFILE_KEY = "wf_ai_profile";



// === SESSION ID ===

function uuid(){

  return ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>

    (c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16)

  );

}

let session_id = localStorage.getItem(SESSION_KEY) || uuid();

localStorage.setItem(SESSION_KEY, session_id);



// === PROFILE (from your long form) ===

let profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");

function saveProfile(next){

  profile = { ...(profile||{}), ...(next||{}) };

  localStorage.setItem(PROFILE_KEY, JSON.stringify(profile));

}



// ---- Capture form inputs (declare ONCE) ----

const nameInput   = document.querySelector('input[name="Name"], #name, [data-ai="name"]');

const emailInput  = document.querySelector('input[type="email"], [data-ai="email"]');

// NOTE: Finsweet sometimes re-renders; don't rely ONLY on this const for guests:

const guestsInput = document.getElementById("number-of-guests"); // initial handle only



function attach(el, key){

  if(!el) return;

  el.addEventListener("input", () => saveProfile({ [key]: el.value.trim() }));

  if(profile[key] && !el.value) el.value = profile[key];

}

attach(nameInput,  "name");

attach(emailInput, "email");



// === Finsweet guests helpers (robust) ===

const getGuestsInput  = () =>

  document.getElementById("number-of-guests") ||

  document.querySelector('[fs-rangeslider-element="input"], .fs-rangeslider_input');



const getGuestsDisplay = () =>

  document.querySelector('[fs-rangeslider-element="display-value"]');



function updateGuests(val) {

  const n = parseInt(val, 10);

  if (!Number.isFinite(n)) return;



  const input = getGuestsInput();

  if (!input) {

    // Finsweet not ready yet — retry shortly

    setTimeout(() => updateGuests(n), 300);

    return;

  }



  // write to the real (hidden/text) input

  input.value = String(n);

  input.setAttribute("value", String(n));

  input.dispatchEvent(new Event("input",  { bubbles: true }));

  input.dispatchEvent(new Event("change", { bubbles: true }));



  // best-effort: update the visible value label

  const disp = getGuestsDisplay();

  if (disp && disp.textContent !== String(n)) disp.textContent = String(n);

}



// Simplified guest number — always read from the robust selector

function getGuests() {

  const el = getGuestsInput();

  const val = el ? parseInt(el.value, 10) : NaN;

  return Number.isNaN(val) ? null : val;

}



// === HISTORY (save chat locally) ===

function loadHistory(){

  try { return JSON.parse(localStorage.getItem(CHAT_KEY) || "[]"); }

  catch { return []; }

}

function saveHistory(h){

  const trimmed = h.slice(-40);

  localStorage.setItem(CHAT_KEY, JSON.stringify(trimmed));

  return trimmed;

}



// === DOM ELEMENTS ===

const thread = document.getElementById("wf-ai-thread");

const form   = document.getElementById("wf-ai-form");

const input  = document.getElementById("wf-ai-input");



// === RENDER MESSAGES ===

function add(role, text){

  const el = document.createElement("div");

  el.style.margin = "8px 0";

  el.style.whiteSpace = "pre-wrap";

  el.innerHTML = `<b>${role === "user" ? "You" : "Leon"}</b>: ${text}`;

  thread.appendChild(el);

  thread.scrollTop = thread.scrollHeight;

}



// === INITIALIZE CHAT ===

let history = loadHistory();

history.forEach(m => add(m.role, m.content));



// === Autofill from user message (simple extract) ===

function setInput(el, value) {

  if (!el || !value) return;

  if (el.value !== String(value)) {

    el.value = String(value);

    el.dispatchEvent(new Event("input",  { bubbles: true }));

    el.dispatchEvent(new Event("change", { bubbles: true }));

  }

}



function extractProfileFromText(txt) {

  const out = {};

  const text = (txt || "").trim();

  // email

  const emailMatch = text.match(/[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}/i);

  if (emailMatch) out.email = emailMatch[0];

  // guests (supports EN/DE terms)

  const guestsMatch = text.match(/(\d{1,3})\s*(gäste|guest|guests|people|personen)/i);

  if (guestsMatch) out.guests = parseInt(guestsMatch[1], 10);

  // name: capture 1–2 tokens; stop before connectors/verbs

  const stop = "(?:\\b(?:and|und|и|i'?m|i am|ich bin|getting|wir|we|with|mit|,|\\.|\\d)\\b|$)";

  const nameToken = "([A-Za-zÀ-ÖØ-öø-ÿ'-]{2,25})";

  const twoTokens = `${nameToken}(?:\\s+${nameToken})?`;

  const lookaheadStop = `(?=\\s*${stop})`;

  const patterns = [

    new RegExp(`mein name ist\\s+${twoTokens}${lookaheadStop}`,"i"),

    new RegExp(`ich bin\\s+${twoTokens}${lookaheadStop}`,"i"),

    new RegExp(`ich heiße\\s+${twoTokens}${lookaheadStop}`,"i"),

    new RegExp(`i am\\s+${twoTokens}${lookaheadStop}`,"i"),

    new RegExp(`i'?m\\s+${twoTokens}${lookaheadStop}`,"i"),

    new RegExp(`меня зовут\\s+${twoTokens}${lookaheadStop}`,"i"),

  ];

  for (const re of patterns) {

    const m = text.match(re);

    if (m) {

      // m[1] is first token, m[2] optional second

      out.name = m[2] ? `${m[1]} ${m[2]}` : m[1];

      break;

    }

  }

  return out;

}



async function maybeAutofillFromMessage(userMsg) {

  const found = extractProfileFromText(userMsg);

  if (found.name)  { setInput(nameInput,  found.name);  saveProfile({ name: found.name }); }

  if (found.email) { setInput(emailInput, found.email); saveProfile({ email: found.email }); }



  if (Number.isFinite(found.guests)) {

    // wait a tick so Finsweet is ready, then update

    setTimeout(() => updateGuests(found.guests), 300);

    saveProfile({ guests: found.guests });

  }



  if (found.name || found.email || Number.isFinite(found.guests)) {

    console.log("Autofilled from chat:", found);

  }

}



// === SEND TO BACKEND ===

async function sendChat(msg, historyArr){

  // always read the latest guests value right before sending

  const guests = getGuests();

  if (guests != null) profile.guests = guests;



  const res = await fetch(API_URL, {

    method: "POST",

    headers: { "Content-Type": "application/json" },

    body: JSON.stringify({ message: msg, history: historyArr, profile, session_id })

  });

  return res.json();

}



// === HANDLE USER MESSAGE ===

form.addEventListener("submit", async (e) => {

  e.preventDefault();

  const msg = input.value.trim();

  if(!msg) return;

  input.value = "";



  add("user", msg);

  history.push({ role: "user", content: msg });

  saveHistory(history);



  try{

    // IMPORTANT: extract & autofill BEFORE sending

    await maybeAutofillFromMessage(msg);



    const data = await sendChat(msg, history);

    const reply = data.reply || "…";

    add("assistant", reply);

    history.push({ role: "assistant", content: reply });

    saveHistory(history);

  }catch{

    const err = "Entschuldigung, es gab ein Problem.";

    add("assistant", err);

    history.push({ role: "assistant", content: err });

    saveHistory(history);

  }

});



// === GREET EXISTING USER ===

if(profile.name && history.length === 0){

  add("assistant", `Hallo ${profile.name}! Wie kann ich helfen?`);

}



// === BUTTON CONTROLS ===

// Helper: new uuid() (for hard reset)

const uuidHelper = () => ([1e7]+-1e3+-4e3+-8e3+-1e11).replace(/[018]/g,c=>(c^crypto.getRandomValues(new Uint8Array(1))[0]&15>>c/4).toString(16));



// --- Soft clear (keep profile & session) ---

const softBtn = document.createElement("button");

softBtn.type = "button";

softBtn.textContent = "Neues Gespräch";

softBtn.style.cssText = "margin-top:8px;background:none;border:0;color:#6b7280;cursor:pointer";

softBtn.addEventListener("click", () => {

  localStorage.removeItem(CHAT_KEY);

  thread.innerHTML = "";

  history = [];

  // optional: greet again if you still have a name

  const profile = JSON.parse(localStorage.getItem(PROFILE_KEY) || "{}");

  const greet = profile.name ? `Hallo ${profile.name}! Wie kann ich helfen?` : "Neues Gespräch gestartet. Wie kann ich helfen?";

  add("assistant", greet);

});



// --- Hard reset (wipe EVERYTHING, new session) ---

const hardBtn = document.createElement("button");

hardBtn.type = "button";

hardBtn.textContent = "Alles zurücksetzen";

hardBtn.style.cssText = "margin-top:8px;margin-left:8px;background:none;border:0;color:#ef4444;cursor:pointer";

hardBtn.addEventListener("click", () => {

  const ok = confirm("Soll der Chat wirklich komplett zurückgesetzt werden? (Verlauf, Profil & Sitzung werden gelöscht)");

  if (!ok) return;



  // Remove chat history & profile

  localStorage.removeItem(CHAT_KEY);

  localStorage.removeItem(PROFILE_KEY);



  // New session id

  localStorage.setItem(SESSION_KEY, uuidHelper());

  session_id = localStorage.getItem(SESSION_KEY);



  // Optional: also clear any hidden transcript field if you added one

  const hidden = document.getElementById("chat_transcript");

  if (hidden) hidden.value = "";



  // Reset UI

  thread.innerHTML = "";

  history = [];

  add("assistant", "Neues Gespräch gestartet. Wie kann ich helfen?");

});



// Place buttons below the form

form.parentElement.appendChild(softBtn);

form.parentElement.appendChild(hardBtn);
