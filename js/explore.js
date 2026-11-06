// ============================================================================
// js/explore.js — Category Filtering & Multi-Stream Engine
// ============================================================================
import { db, auth } from "./firebase.js";
import { collection, getDocs, query, orderBy } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// DOM Node Containers
const exploreGrid = document.getElementById("exploreGrid");
const categoryBar = document.getElementById("categoryBar");
const searchInput = document.getElementById("heroSearchInput");
const searchDropdown = document.getElementById("searchDropdown");

const authElements = {
  trigger: document.getElementById("authNavTrigger"),
  signOut: document.getElementById("signOutBtn"),
  messages: document.getElementById("messagesNavLink"),
  uploadBtn: document.getElementById("navUploadBtn"),
  avatar: document.getElementById("navProfileAvatar"),
  modal: document.getElementById("authModal"),
  closeModal: document.getElementById("closeAuthBtn")
};

// Global Execution Variables
const urlParams = new URLSearchParams(window.location.search);
let searchQuery = urlParams.get("q")?.toLowerCase().trim() || "";
let activeCategory = "All";
let cachedPapers = [];
let currentUser = null;

// Global Toast Fallback Access Utility
function triggerToastNotification(message, type = "info") {
  if (typeof window.showPremiumToast === "function") {
    window.showPremiumToast(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

// Global Toggle Utility for Expandable Grid Descriptions
window.toggleExploreDescription = function(btn, paperId) {
  const fullTextTextarea = document.getElementById(`full-desc-${paperId}`);
  const textDisplayNode = document.getElementById(`text-display-${paperId}`);
  
  if (!fullTextTextarea || !textDisplayNode) return;
  
  const isExpanded = btn.getAttribute("data-expanded") === "true";
  const fullText = fullTextTextarea.value;
  
  if (isExpanded) {
    textDisplayNode.textContent = fullText.substring(0, 120) + "... ";
    btn.textContent = "See More";
    btn.setAttribute("data-expanded", "false");
  } else {
    textDisplayNode.textContent = fullText + " ";
    btn.textContent = "See Less";
    btn.setAttribute("data-expanded", "true");
  }
};

// ------------------------------------------
// 1. DATA SYNCHRONIZATION PIPELINES
// ------------------------------------------
async function loadRepositoryPayload() {
  try {
    const q = query(collection(db, "papers"), orderBy("createdAt", "desc"));
    const querySnapshot = await getDocs(q);
    cachedPapers = [];
    querySnapshot.forEach((doc) => {
      cachedPapers.push({ id: doc.id, ...doc.data() });
    });
    renderFilteredGrid();
  } catch (err) {
    console.error("Database sync runtime issue:", err);
    if (exploreGrid) {
      exploreGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; color:#ef4444; font-weight:600; padding: 40px;">Database Sync Error. Failed to synchronize core ledger clusters.</div>`;
    }
  }
}

function renderFilteredGrid() {
  if (!exploreGrid) return;

  const displayList = cachedPapers.filter(p => {
    const matchesCat = (activeCategory === "All" || p.category === activeCategory);
    const matchesSearch = !searchQuery || [p.title, p.author, p.description].some(field => (field || "").toLowerCase().includes(searchQuery));
    return matchesCat && matchesSearch;
  });

  if (displayList.length === 0) {
    exploreGrid.innerHTML = `<div style="grid-column:1/-1; text-align:center; padding:50px; color:var(--text-muted); font-weight:600; border: 1px dashed rgba(185,28,28,0.15); border-radius:16px;">No dynamic verification logs match your tracking parameters.</div>`;
    return;
  }

  exploreGrid.innerHTML = displayList.map(paper => {
    const cleanCategory = paper.category ? paper.category.replace(/[&<>"']/g, "") : "General";
    const cleanTitle = paper.title ? paper.title.replace(/[&<>"']/g, "") : "Untitled Abstract";
    const cleanAuthor = paper.author ? paper.author.replace(/[&<>"']/g, "") : "Anonymous";
    const cleanDesc = paper.description ? paper.description.replace(/[&<>"']/g, "") : 'No abstract summary matrix log provided.';
    
    const authorIdKey = paper.userId || paper.authorId || paper.uid || paper.ownerId;
    const isOwner = currentUser && authorIdKey && currentUser.uid === authorIdKey;

    // Premium Crimson vs Emergent Node styling rules
    const cardBorderColor = isOwner ? "border-color: #22c55e; background: #f0fdf4;" : "border-color: rgba(15,23,42,0.08); background: #ffffff;";
    const badgeStyle = isOwner ? "background: rgba(34,197,94,0.1); color: #22c55e;" : "background: rgba(185,28,28,0.08); color: var(--brand-crimson);";

    const authorLayoutString = isOwner
      ? `By <a href="profile.html?id=${currentUser.uid}" style="color:#22c55e; font-weight:800; text-decoration:none;">You (Operator)</a>`
      : `By <a href="profile.html?id=${authorIdKey || ''}" style="color:var(--brand-crimson); font-weight:700; text-decoration:none;">${cleanAuthor}</a>`;

    // Process inline string length checks for safe description splitting
    const needsTruncation = cleanDesc.length > 120;
    const initialDescLayout = needsTruncation ? cleanDesc.substring(0, 120) + "..." : cleanDesc;

    return `
      <div class="research-card" style="border:1px solid; border-radius:16px; padding:24px; position:relative; display:flex; flex-direction:column; justify-content:space-between; box-shadow:0 4px 20px rgba(0,0,0,0.02); transition: transform 0.2s ease; ${cardBorderColor}">
        <div style="flex:1; display:flex; flex-direction:column;">
          <div style="display: flex; justify-content: space-between; align-items: center; margin-bottom: 12px;">
            <span class="badge" style="${badgeStyle} font-size:0.75rem; padding:4px 12px; border-radius:50px; font-weight:800; text-transform:uppercase; letter-spacing:0.03em;">${cleanCategory}</span>
            <div style="display: flex; gap: 10px; font-size: 0.8rem; color: #64748b;">
              <span>👁️ ${(Number(paper.views) || 0).toLocaleString()}</span>
            </div>
          </div>
          
          <h3 onclick="window.location.href='research.html?id=${paper.id}'" style="cursor:pointer; font-size:1.2rem; font-weight:900; margin:0 0 8px; color:var(--onyx-deep); text-align:left; line-height:1.35; letter-spacing:-0.01em; display:-webkit-box; -webkit-line-clamp:2; -webkit-box-orient:vertical; overflow:hidden;" title="${cleanTitle}">
            ${cleanTitle}
          </h3>
          
          <p style="font-size:0.88rem; color:#475569; text-align:left; line-height:1.5; margin-bottom:16px; flex-grow:1;">
            <span id="text-display-${paper.id}">${initialDescLayout}</span>
            ${needsTruncation ? `
              <button data-expanded="false" onclick="window.toggleExploreDescription(this, '${paper.id}')" style="background:none; border:none; color:var(--brand-crimson); font-weight:700; font-size:0.78rem; padding:0; cursor:pointer; margin-left:4px; text-decoration:underline; display:inline;">See More</button>
              <textarea id="full-desc-${paper.id}" style="display:none;">${cleanDesc}</textarea>
            ` : ''}
          </p>
        </div>
        
        <div style="margin-top:auto; padding-top:14px; border-top:1px dashed #e2e8f0;">
          <p style="font-size:0.85rem; color:var(--text-muted); margin-bottom:12px; text-align:left; font-weight: 500;">
            ${authorLayoutString}
          </p>
          <div class="card-footer-metrics" style="display: flex; gap: 16px; color: #64748b; font-size: 0.82rem; font-weight: 600;">
            <span class="metric-btn" style="display: flex; align-items: center; gap: 4px;">❤️ ${(paper.likes || 0).toLocaleString()} Likes</span>
            <span class="metric-btn" onclick="window.location.href='research.html?id=${paper.id}#comments'" style="cursor:pointer; display: flex; align-items: center; gap: 4px;">💬 View Comments</span>
          </div>
        </div>
      </div>
    `;
  }).join("");
}

// ------------------------------------------
// 2. PREDICTIVE INPUT CONTROLLER
// ------------------------------------------
searchInput?.addEventListener("input", (e) => {
  searchQuery = e.target.value.toLowerCase().trim();
  if (!searchQuery) { 
    searchDropdown.style.display = "none"; 
    renderFilteredGrid(); 
    return; 
  }

  const matches = cachedPapers.filter(p => (p.title || "").toLowerCase().includes(searchQuery) || (p.author || "").toLowerCase().includes(searchQuery));
  if (matches.length === 0) {
    searchDropdown.innerHTML = `<div style="padding: 12px 16px; font-size: 0.85rem; color: #64748b; font-weight:600;">No matching verification logs located</div>`;
  } else {
    searchDropdown.innerHTML = matches.slice(0, 5).map(paper => `
      <a href="research.html?id=${paper.id}" class="dropdown-item" style="text-decoration:none;">
        <span style="font-weight:800; display:block; color:var(--onyx-deep); text-align:left; margin-bottom:2px;">${paper.title}</span>
        <span style="font-size:0.75rem; color:#64748b; display:block; text-align:left; font-weight:600;">${paper.author || 'Anonymous'} • <span style="color:var(--brand-crimson); font-weight:700;">${paper.category || 'General'}</span></span>
      </a>`).join('');
  }
  searchDropdown.style.display = "block";
  renderFilteredGrid();
});

document.addEventListener("click", (e) => {
  if (!searchInput?.contains(e.target) && !searchDropdown?.contains(e.target)) {
    if (searchDropdown) searchDropdown.style.display = "none";
  }
});

categoryBar?.addEventListener("click", (e) => {
  const targetPill = e.target.closest(".cat-pill");
  if (!targetPill) return;
  document.querySelectorAll(".cat-pill").forEach(p => p.classList.remove("active"));
  targetPill.classList.add("active");
  activeCategory = targetPill.dataset.cat;
  renderFilteredGrid();
});

// ------------------------------------------
// 3. CORE GLOBAL AUTH CONTROL HANDLERS
// ------------------------------------------
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  renderFilteredGrid();

  if (user) {
    if (authElements.trigger) authElements.trigger.style.display = "none";
    if (authElements.signOut) authElements.signOut.style.display = "block";
    if (authElements.messages) authElements.messages.style.display = "block";
    if (authElements.avatar) {
      authElements.avatar.style.display = "flex";
      const userInitials = user.displayName || user.email.split("@")[0];
      authElements.avatar.textContent = userInitials.substring(0, 2).toUpperCase();
    }
  } else {
    if (authElements.trigger) authElements.trigger.style.display = "block";
    if (authElements.signOut) authElements.signOut.style.display = "none";
    if (authElements.messages) authElements.messages.style.display = "none";
    if (authElements.avatar) authElements.avatar.style.display = "none";
  }
});

// ------------------------------------------
// 4. CROSS-WINDOW INTEGRATION BUS (ASYNCHRONOUS ENGINE)
// ------------------------------------------
window.addEventListener("firebaseSignInRequest", async (e) => {
  const { email, password } = e.detail;
  try {
    const userCredential = await signInWithEmailAndPassword(auth, email, password);
    window.dispatchEvent(new CustomEvent("firebaseSignInRequestSuccess", { detail: userCredential.user }));
  } catch (error) {
    window.dispatchEvent(new CustomEvent("firebaseSignInRequestFailure", { detail: error }));
  }
});

window.addEventListener("firebaseSignUpRequest", async (e) => {
  const { email, password, username } = e.detail;
  try {
    const userCredential = await createUserWithEmailAndPassword(auth, email, password);
    if (username) {
      await updateProfile(userCredential.user, { displayName: username });
    }
    window.dispatchEvent(new CustomEvent("firebaseSignUpRequestSuccess", { detail: userCredential.user }));
  } catch (error) {
    window.dispatchEvent(new CustomEvent("firebaseSignUpRequestFailure", { detail: error }));
  }
});

// Global Triggers Configuration
authElements.trigger?.addEventListener("click", () => {
  if (authElements.modal) authElements.modal.style.display = "flex";
});

authElements.closeModal?.addEventListener("click", () => {
  if (authElements.modal) authElements.modal.style.display = "none";
});

authElements.signOut?.addEventListener("click", (e) => {
  e.preventDefault();
  signOut(auth).then(() => {
    triggerToastNotification("Operator Cluster Handshake Terminated.", "info");
    window.location.reload();
  });
});

authElements.uploadBtn?.addEventListener("click", (e) => {
  if (!currentUser) {
    e.preventDefault();
    triggerToastNotification("Identity verification required to push changes to verified nodes.", "error");
    if (authElements.modal) authElements.modal.style.display = "flex";
  }
});

// Runtime Initialization
loadRepositoryPayload();