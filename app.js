/* ??????????????????????????????????????????????????????????????
   GAP26 ? Trip Checklist App
   Firebase Realtime Database + vanilla JS
   ?????????????????????????????????????????????????????????????? */

// ?? Firebase Config ??????????????????????????????????????????
// Replace this with YOUR Firebase project config.
// Firebase Console ? Project Settings ? General ? Your apps ? Config
const firebaseConfig = {
  apiKey:            "AIzaSyB14KwEhbBDWgn3yu6Jj0ghHclklN2Qrtw",
  authDomain:        "gap26-764c8.firebaseapp.com",
  databaseURL:       "https://gap26-764c8-default-rtdb.firebaseio.com",
  projectId:         "gap26-764c8",
  storageBucket:     "gap26-764c8.firebasestorage.app",
  messagingSenderId: "8466652555",
  appId:             "1:8466652555:web:897f855cdb747b4736638e"
};

const IS_CONFIGURED = !firebaseConfig.apiKey.startsWith("YOUR_");

// ?? Init ?????????????????????????????????????????????????????
let db = null;

if (IS_CONFIGURED) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
}

const LISTS = ["road", "croatia", "kosova"];
const EMPTY_ICONS = { road: "???", croatia: "??", kosova: "??" };
const EMPTY_MSGS  = {
  road:    "No road prep items yet ? add one above!",
  croatia: "Nothing for Croatia yet ? start planning!",
  kosova:  "Nothing for Kosova yet ? start planning!"
};

// ?? Show config prompt if not set up ?????????????????????????
if (!IS_CONFIGURED) {
  document.querySelector("main").innerHTML = `
    <div class="config-prompt">
      <h2>Almost there!</h2>
      <p>Open <strong>app.js</strong> and replace the Firebase config
         placeholder with your project's config from the
         <a href="https://console.firebase.google.com/" target="_blank"
            style="color:var(--accent)">Firebase Console</a>.</p>
      <code>const firebaseConfig = {
  apiKey: "AIza...",
  authDomain: "my-project.firebaseapp.com",
  databaseURL: "https://my-project-default-rtdb...",
  ...
};</code>
    </div>`;
}

// ?? Tab Switching ????????????????????????????????????????????
const tabs   = document.querySelectorAll(".tab");
const panels = document.querySelectorAll(".checklist-panel");

tabs.forEach(tab => {
  tab.addEventListener("click", () => {
    const target = tab.dataset.list;
    tabs.forEach(t => { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    panels.forEach(p => p.classList.remove("active"));
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    document.querySelector(`[data-panel="${target}"]`).classList.add("active");
  });
});

// ?? Toast Notification ???????????????????????????????????????
const toastEl = document.getElementById("toast");
let toastTimer = null;

function showToast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.hidden = false;
  requestAnimationFrame(() => toastEl.classList.add("show"));
  toastTimer = setTimeout(() => {
    toastEl.classList.remove("show");
    setTimeout(() => { toastEl.hidden = true; }, 300);
  }, 2000);
}

// ?? Render Helpers ???????????????????????????????????????????
function createItemEl(listName, id, item) {
  const li = document.createElement("li");
  li.dataset.id = id;

  const check = document.createElement("div");
  check.className = "item-check";

  const text = document.createElement("span");
  text.className = "item-text";
  text.textContent = item.text;

  const del = document.createElement("button");
  del.className = "item-delete";
  del.innerHTML = "&#x2715;";
  del.setAttribute("aria-label", "Delete item");
  del.addEventListener("click", (e) => {
    e.stopPropagation();
    deleteItem(listName, id, item.text);
  });

  li.addEventListener("click", () => toggleItem(listName, id, item.checked));

  li.append(check, text, del);
  return li;
}

function renderList(listName, items) {
  const uncheckedUl  = document.querySelector(`[data-items="${listName}"]`);
  const checkedUl    = document.querySelector(`[data-checked="${listName}"]`);
  const divider      = document.querySelector(`[data-divider="${listName}"]`);

  uncheckedUl.innerHTML = "";
  checkedUl.innerHTML   = "";

  const entries = Object.entries(items || {});
  const unchecked = entries.filter(([, v]) => !v.checked).sort((a, b) => a[1].createdAt - b[1].createdAt);
  const checked   = entries.filter(([, v]) =>  v.checked).sort((a, b) => a[1].createdAt - b[1].createdAt);

  if (unchecked.length === 0 && checked.length === 0) {
    uncheckedUl.innerHTML = `
      <div class="empty-state">
        <span class="empty-icon">${EMPTY_ICONS[listName]}</span>
        ${EMPTY_MSGS[listName]}
      </div>`;
  }

  unchecked.forEach(([id, item]) => {
    uncheckedUl.appendChild(createItemEl(listName, id, item));
  });

  divider.hidden = checked.length === 0;

  checked.forEach(([id, item]) => {
    checkedUl.appendChild(createItemEl(listName, id, item));
  });
}

// ?? Firebase Operations ??????????????????????????????????????
function addItem(listName, text) {
  if (!db) return;
  const ref = db.ref(`checklists/${listName}`);
  ref.push({
    text:      text.trim(),
    checked:   false,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
}

function toggleItem(listName, id, currentState) {
  if (!db) return;
  db.ref(`checklists/${listName}/${id}/checked`).set(!currentState);
}

function deleteItem(listName, id, text) {
  if (!db) return;
  db.ref(`checklists/${listName}/${id}`).remove();
  showToast(`"${text}" removed`);
}

// ?? Real-time Listeners ??????????????????????????????????????
if (IS_CONFIGURED) {
  LISTS.forEach(listName => {
    const ref = db.ref(`checklists/${listName}`);

    // Show loading state initially
    const uncheckedUl = document.querySelector(`[data-items="${listName}"]`);
    uncheckedUl.innerHTML = '<div class="loading-indicator"></div>';

    ref.on("value", (snapshot) => {
      renderList(listName, snapshot.val());
    });
  });
}

// ?? Form Submissions ?????????????????????????????????????????
document.querySelectorAll(".add-form").forEach(form => {
  form.addEventListener("submit", (e) => {
    e.preventDefault();
    const input = form.querySelector("input");
    const text  = input.value.trim();
    if (!text) return;
    addItem(form.dataset.list, text);
    input.value = "";
    input.focus();
  });
});

// ?? Offline Detection ????????????????????????????????????????
function updateOnlineStatus() {
  const existing = document.querySelector(".offline-banner");
  if (!navigator.onLine) {
    if (!existing) {
      const banner = document.createElement("div");
      banner.className = "offline-banner";
      banner.textContent = "You're offline ? changes will sync when you reconnect";
      document.body.prepend(banner);
    }
  } else if (existing) {
    existing.remove();
  }
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();
