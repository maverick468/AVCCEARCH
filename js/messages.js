// ============================================================================
// js/messages.js — Profile Integrated Real-time Thread Engine
// ============================================================================
import { 
  db, auth, collection, addDoc, query, where, orderBy, onSnapshot, doc, getDocs, getDoc, sanitize 
} from "./firebase.js";

let loggedUser = null;
let activeRoomId = null;
let targetedRecipientId = null;
let allRegisteredUsers = []; 
let profileCache = {}; // Global cache holding { uid: { name, avatar } } to avoid flickering

const urlParams = new URLSearchParams(window.location.search);
// Unified fallback keys: reads 'to' (from view.html) or 'target' (from layout variations)
const routingTargetId = urlParams.get("to") || urlParams.get("target");
const routingTargetName = urlParams.get("name") || urlParams.get("ref");

auth.onAuthStateChanged(async (user) => {
  if (!user) { 
    window.location.href = "index.html"; 
    return; 
  }
  loggedUser = user;
  
  // Cache logged-in user profile attributes
  await cacheUserProfile(loggedUser.uid);
  
  loadUserDirectory();
  syncActiveChatSidebar();

  if (routingTargetId) { 
    // Wait briefly for directory snapshot compilation to extract name context safely
    setTimeout(() => {
      const match = allRegisteredUsers.find(u => u.uid === routingTargetId);
      const fallbackName = routingTargetName ? decodeURIComponent(routingTargetName) : "Academic Peer";
      initializeDirectTargetThread(routingTargetId, match ? match.name : fallbackName);
    }, 800);
  }
});

function getRoomToken(uid1, uid2) {
  return [uid1, uid2].sort().join("_");
}

// Helper to pull profile photo and details from Firestore user document fields
async function cacheUserProfile(uid) {
  if (profileCache[uid]) return profileCache[uid];
  try {
    const snap = await getDoc(doc(db, "users", uid));
    if (snap.exists()) {
      const data = snap.data();
      profileCache[uid] = {
        name: data.username || data.displayName || data.name || data.fullName || "Anonymous Scholar",
        avatar: data.photoURL || data.profileImage || data.avatar || ""
      };
    } else {
      profileCache[uid] = { name: "Anonymous Scholar", avatar: "" };
    }
  } catch(e) {
    profileCache[uid] = { name: "Academic Peer", avatar: "" };
  }
  return profileCache[uid];
}

// Inject clean fallback initial avatars or style with background images
function buildAvatarHTML(profile, styles = "") {
  if (profile && profile.avatar) {
    return `<div class="avatar-placeholder" style="background-image: url('${profile.avatar}'); ${styles}"></div>`;
  }
  const initials = profile ? profile.name.substring(0,2).toUpperCase() : "??";
  return `<div class="avatar-placeholder" style="${styles}">${initials}</div>`;
}

// ── 1. Fetch Users Directory & Handle Search Filter ───────────
function loadUserDirectory() {
  onSnapshot(collection(db, "users"), (snapshot) => {
    allRegisteredUsers = [];
    snapshot.forEach((d) => {
      if (d.id !== loggedUser.uid) {
        const data = d.data();
        const profile = {
          uid: d.id,
          name: data.username || data.displayName || data.name || data.fullName || "Anonymous Scholar",
          avatar: data.photoURL || data.profileImage || data.avatar || ""
        };
        // Keep memory mirror sync updated instantly
        profileCache[d.id] = profile;
        allRegisteredUsers.push(profile);
      }
    });
    renderUserDirectory(allRegisteredUsers);
  });
}

function renderUserDirectory(users) {
  const container = document.getElementById("usersDiscoveryContainer");
  if (!container) return;
  
  if (users.length === 0) {
    container.innerHTML = `<div style="padding:12px; font-size:0.8rem; color:var(--text-muted); text-align:center;">No peers found</div>`;
    return;
  }
  
  container.innerHTML = users.map(u => `
    <div class="chat-item" data-uid="${u.uid}" id="user-peer-${u.uid}">
      ${buildAvatarHTML(u)}
      <div style="font-weight: 600;">@${sanitize(u.name)}</div>
    </div>
  `).join("");

  users.forEach(u => {
    document.getElementById(`user-peer-${u.uid}`)?.addEventListener("click", () => {
      initializeDirectTargetThread(u.uid, u.name);
    });
  });
}

document.getElementById("userSearchInput")?.addEventListener("input", (e) => {
  const queryText = e.target.value.toLowerCase().trim();
  const filtered = allRegisteredUsers.filter(u => u.name.toLowerCase().includes(queryText));
  renderUserDirectory(filtered);
});

// ── 2. Initialize Direct Threads ───────────────────────────────
async function initializeDirectTargetThread(targetUid, targetName) {
  activeRoomId = getRoomToken(loggedUser.uid, targetUid);
  targetedRecipientId = targetUid;
  
  const targetProfile = await cacheUserProfile(targetUid);
  
  // Render headers with avatars attached
  const headerAvatar = document.getElementById("activeChatAvatar");
  if (headerAvatar) {
    headerAvatar.style.display = "flex";
    if (targetProfile.avatar) {
      headerAvatar.style.backgroundImage = `url('${targetProfile.avatar}')`;
      headerAvatar.textContent = "";
    } else {
      headerAvatar.style.backgroundImage = "none";
      headerAvatar.textContent = targetProfile.name.substring(0,2).toUpperCase();
    }
  }
  
  document.getElementById("activeChatHeaderText").textContent = `@${targetProfile.name}`;
  document.getElementById("chatInput").disabled = false;
  document.querySelector("#chatForm button").disabled = false;
  
  const checkQuery = query(collection(db, "messages"), where("roomId", "==", activeRoomId));
  const checkSnap = await getDocs(checkQuery);
  
  if (checkSnap.empty) {
    await addDoc(collection(db, "messages"), {
      roomId: activeRoomId,
      senderId: loggedUser.uid,
      senderName: profileCache[loggedUser.uid]?.name || "Anonymous",
      text: `Hello! I'm interested in discussing your research.`,
      participants: [loggedUser.uid, targetUid],
      createdAt: new Date().toISOString()
    });
  }
  
  loadActiveChatThread();
  highlightActiveElement(targetUid);
}

// ── 3. Sync and Stream Chat History Sidebar ────────────────────
function syncActiveChatSidebar() {
  const q = query(collection(db, "messages"), where("participants", "array-contains", loggedUser.uid));
  
  onSnapshot(q, async (snapshot) => {
    const container = document.getElementById("roomsContainer");
    if (!container) return;
    
    let uniqueRooms = new Set();
    container.innerHTML = "";
    
    // Sort items so the latest exchanges display on top
    const sortedDocs = snapshot.docs.sort((a,b) => new Date(b.data().createdAt) - new Date(a.data().createdAt));
    
    for (const d of sortedDocs) {
      const m = d.data();
      if (!uniqueRooms.has(m.roomId)) {
        uniqueRooms.add(m.roomId);
        
        const peerUid = m.participants.find(id => id !== loggedUser.uid);
        if (!peerUid) continue;

        const peerProfile = await cacheUserProfile(peerUid);

        const item = document.createElement("div");
        item.className = `chat-item ${m.roomId === activeRoomId ? 'active' : ''}`;
        item.id = `room-sidebar-${m.roomId}`;
        item.innerHTML = `
          ${buildAvatarHTML(peerProfile)}
          <div style="overflow:hidden; flex:1; text-align: left;">
            <div style="font-weight:700;">${sanitize(peerProfile.name)}</div>
            <div style="font-size:0.75rem; color:var(--text-muted); text-overflow:ellipsis; white-space:nowrap; overflow:hidden; max-width:100%;">${sanitize(m.text)}</div>
          </div>
        `;
        
        item.onclick = () => {
          initializeDirectTargetThread(peerUid, peerProfile.name);
        };
        container.appendChild(item);
      }
    }
  });
}

function highlightActiveElement(activeUid) {
  document.querySelectorAll('.chat-item').forEach(el => el.classList.remove('active'));
  document.getElementById(`user-peer-${activeUid}`)?.classList.add('active');
  document.getElementById(`room-sidebar-${getRoomToken(loggedUser.uid, activeUid)}`)?.classList.add('active');
}

// ── 4. Load & Render Active Message Thread with bubble avatars ──
function loadActiveChatThread() {
  const q = query(collection(db, "messages"), where("roomId", "==", activeRoomId), orderBy("createdAt", "asc"));
  
  onSnapshot(q, (snapshot) => {
    const stream = document.getElementById("messagesStream");
    if (!stream) return;
    
    let rowsHTML = "";
    snapshot.forEach((d) => {
      const m = d.data();
      const isSent = m.senderId === loggedUser.uid;
      const type = isSent ? "sent" : "received";
      
      // Pull instant profile metrics from cache context
      const senderProfile = profileCache[m.senderId] || { name: m.senderName || "User", avatar: "" };
      const avatarMarkup = buildAvatarHTML(senderProfile, "width: 28px; height: 28px; font-size:0.7rem;");

      rowsHTML += `
        <div class="msg-row ${type}">
          ${!isSent ? avatarMarkup : ""}
          <div class="msg-bubble ${type}">${sanitize(m.text)}</div>
          ${isSent ? avatarMarkup : ""}
        </div>
      `;
    });
    
    stream.innerHTML = rowsHTML;
    stream.scrollTop = stream.scrollHeight;
  });
}

// ── 5. Post Form Submission Handler ─────────────────────────────
document.getElementById("chatForm")?.addEventListener("submit", async (e) => {
  e.preventDefault();
  const input = document.getElementById("chatInput");
  if (!activeRoomId || !targetedRecipientId || !input.value.trim()) return;

  await addDoc(collection(db, "messages"), {
    roomId: activeRoomId,
    senderId: loggedUser.uid,
    senderName: profileCache[loggedUser.uid]?.name || "Anonymous",
    text: input.value.trim(),
    participants: [loggedUser.uid, targetedRecipientId],
    createdAt: new Date().toISOString()
  });
  input.value = "";
});