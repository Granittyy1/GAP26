/* ================================================================
   GAP26 - Trip Checklist App
   Firebase Realtime Database + vanilla JS
   ================================================================ */

// -- Firebase Config ---------------------------------------------
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

// -- Init --------------------------------------------------------
let db = null;

if (IS_CONFIGURED) {
  firebase.initializeApp(firebaseConfig);
  db = firebase.database();
}

const LISTS = ["road", "croatia", "kosova"];
const EMPTY_ICONS = { road: "\uD83D\uDEE3\uFE0F", croatia: "\uD83C\uDF0A", kosova: "\u26F0\uFE0F" };
const EMPTY_MSGS  = {
  road:    "No road prep items yet - add one above!",
  croatia: "Nothing for Croatia yet - start planning!",
  kosova:  "Nothing for Kosova yet - start planning!"
};

// -- Show config prompt if not set up ----------------------------
if (!IS_CONFIGURED) {
  document.querySelector("main").innerHTML =
    '<div class="config-prompt">' +
      '<h2>Almost there!</h2>' +
      '<p>Open <strong>app.js</strong> and replace the Firebase config ' +
         'placeholder with your project\'s config from the ' +
         '<a href="https://console.firebase.google.com/" target="_blank" ' +
            'style="color:var(--accent)">Firebase Console</a>.</p>' +
      '<code>const firebaseConfig = {\n' +
      '  apiKey: "AIza...",\n' +
      '  authDomain: "my-project.firebaseapp.com",\n' +
      '  databaseURL: "https://my-project-default-rtdb...",\n' +
      '  ...\n' +
      '};</code>' +
    '</div>';
}

// -- Tab Switching -----------------------------------------------
var tabs   = document.querySelectorAll(".tab");
var panels = document.querySelectorAll(".checklist-panel");

tabs.forEach(function(tab) {
  tab.addEventListener("click", function() {
    var target = tab.dataset.list;
    tabs.forEach(function(t) { t.classList.remove("active"); t.setAttribute("aria-selected", "false"); });
    panels.forEach(function(p) { p.classList.remove("active"); });
    tab.classList.add("active");
    tab.setAttribute("aria-selected", "true");
    document.querySelector('[data-panel="' + target + '"]').classList.add("active");
  });
});

// -- Toast Notification ------------------------------------------
var toastEl = document.getElementById("toast");
var toastTimer = null;

function showToast(msg) {
  clearTimeout(toastTimer);
  toastEl.textContent = msg;
  toastEl.hidden = false;
  requestAnimationFrame(function() { toastEl.classList.add("show"); });
  toastTimer = setTimeout(function() {
    toastEl.classList.remove("show");
    setTimeout(function() { toastEl.hidden = true; }, 300);
  }, 2000);
}

// -- Render Helpers ----------------------------------------------
function createItemEl(listName, id, item) {
  var li = document.createElement("li");
  li.dataset.id = id;

  var check = document.createElement("div");
  check.className = "item-check";

  var text = document.createElement("span");
  text.className = "item-text";
  text.textContent = item.text;

  var del = document.createElement("button");
  del.className = "item-delete";
  del.innerHTML = "&#x2715;";
  del.setAttribute("aria-label", "Delete item");
  del.addEventListener("click", function(e) {
    e.stopPropagation();
    deleteItem(listName, id, item.text);
  });

  li.addEventListener("click", function() { toggleItem(listName, id, item.checked); });

  li.append(check, text, del);
  return li;
}

function renderList(listName, items) {
  var uncheckedUl  = document.querySelector('[data-items="' + listName + '"]');
  var checkedUl    = document.querySelector('[data-checked="' + listName + '"]');
  var divider      = document.querySelector('[data-divider="' + listName + '"]');

  uncheckedUl.innerHTML = "";
  checkedUl.innerHTML   = "";

  var entries = Object.entries(items || {});
  var unchecked = entries.filter(function(e) { return !e[1].checked; }).sort(function(a, b) { return a[1].createdAt - b[1].createdAt; });
  var checked   = entries.filter(function(e) { return  e[1].checked; }).sort(function(a, b) { return a[1].createdAt - b[1].createdAt; });

  if (unchecked.length === 0 && checked.length === 0) {
    uncheckedUl.innerHTML =
      '<div class="empty-state">' +
        '<span class="empty-icon">' + EMPTY_ICONS[listName] + '</span>' +
        EMPTY_MSGS[listName] +
      '</div>';
  }

  unchecked.forEach(function(entry) {
    uncheckedUl.appendChild(createItemEl(listName, entry[0], entry[1]));
  });

  divider.hidden = checked.length === 0;

  checked.forEach(function(entry) {
    checkedUl.appendChild(createItemEl(listName, entry[0], entry[1]));
  });
}

// -- Firebase Operations -----------------------------------------
function addItem(listName, text) {
  if (!db) return;
  var ref = db.ref("checklists/" + listName);
  ref.push({
    text:      text.trim(),
    checked:   false,
    createdAt: firebase.database.ServerValue.TIMESTAMP
  });
}

function toggleItem(listName, id, currentState) {
  if (!db) return;
  db.ref("checklists/" + listName + "/" + id + "/checked").set(!currentState);
}

function deleteItem(listName, id, text) {
  if (!db) return;
  db.ref("checklists/" + listName + "/" + id).remove();
  showToast('"' + text + '" removed');
}

// -- Real-time Listeners -----------------------------------------
if (IS_CONFIGURED) {
  LISTS.forEach(function(listName) {
    var ref = db.ref("checklists/" + listName);

    var uncheckedUl = document.querySelector('[data-items="' + listName + '"]');
    uncheckedUl.innerHTML = '<div class="loading-indicator"></div>';

    ref.on("value", function(snapshot) {
      renderList(listName, snapshot.val());
    });
  });
}

// -- Form Submissions --------------------------------------------
document.querySelectorAll(".add-form").forEach(function(form) {
  form.addEventListener("submit", function(e) {
    e.preventDefault();
    var input = form.querySelector("input");
    var text  = input.value.trim();
    if (!text) return;
    addItem(form.dataset.list, text);
    input.value = "";
    input.focus();
  });
});

// -- Offline Detection -------------------------------------------
function updateOnlineStatus() {
  var existing = document.querySelector(".offline-banner");
  if (!navigator.onLine) {
    if (!existing) {
      var banner = document.createElement("div");
      banner.className = "offline-banner";
      banner.textContent = "You're offline - changes will sync when you reconnect";
      document.body.prepend(banner);
    }
  } else if (existing) {
    existing.remove();
  }
}

window.addEventListener("online", updateOnlineStatus);
window.addEventListener("offline", updateOnlineStatus);
updateOnlineStatus();
