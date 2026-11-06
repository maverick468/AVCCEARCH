// ============================================================================
// js/index.js — Standalone Dashboard & Session Manager
// ============================================================================
import { db, auth } from './firebase.js'; 
import { collection, getDocs } from "https://www.gstatic.com/firebasejs/10.12.2/firebase-firestore.js";
import { 
  onAuthStateChanged, 
  signOut, 
  signInWithEmailAndPassword, 
  createUserWithEmailAndPassword, 
  updateProfile 
} from "https://www.gstatic.com/firebasejs/10.12.2/firebase-auth.js";

// Global Toast Fallback Access Utility
function triggerToastNotification(message, type = "info") {
  if (typeof window.showPremiumToast === "function") {
    window.showPremiumToast(message, type);
  } else {
    console.log(`[${type.toUpperCase()}] ${message}`);
  }
}

// Global Toggle Utility for Expandable Descriptions
window.toggleDescription = function(btn, paperId) {
  const fullTextTextarea = document.getElementById(`full-desc-${paperId}`);
  const textDisplayNode = document.getElementById(`text-display-${paperId}`);
  
  if (!fullTextTextarea || !textDisplayNode) return;
  
  const isExpanded = btn.getAttribute("data-expanded") === "true";
  const fullText = fullTextTextarea.value;
  
  if (isExpanded) {
    // Truncate back to 120 characters
    textDisplayNode.textContent = fullText.substring(0, 120) + "... ";
    btn.textContent = "See More";
    btn.setAttribute("data-expanded", "false");
  } else {
    // Reveal entire string
    textDisplayNode.textContent = fullText + " ";
    btn.textContent = "See Less";
    btn.setAttribute("data-expanded", "true");
  }
};

document.addEventListener("DOMContentLoaded", () => {
  // Memory cache for search routines
  let cachedPapers = [];
  let currentUser = null;

  // DOM Elements Registry
  const searchInput = document.getElementById("heroSearchInput");
  const searchDropdown = document.getElementById("searchDropdown");

  const authElements = {
    trigger: document.getElementById("authNavTrigger"),
    signOut: document.getElementById("signOutBtn"),
    messages: document.getElementById("messagesNavLink"),
    uploadBtn: document.getElementById("navUploadBtn"),
    heroUploadBtn: document.getElementById("heroUploadBtn"),
    avatar: document.getElementById("navProfileAvatar"),
    modal: document.getElementById("authModal"),
    closeModal: document.getElementById("closeAuthBtn"),
    form: document.getElementById("authForm"),
    usernameInput: document.getElementById("authUsername"),
    usernameContainer: document.getElementById("usernameFieldContainer")
  };

  // ------------------------------------------
  // 1. FIREBASE DATA PIPELINES
  // ------------------------------------------
  async function fetchPlatformPapers() {
    try {
      const querySnapshot = await getDocs(collection(db, "papers"));
      const papers = [];
      querySnapshot.forEach((doc) => {
        papers.push({ id: doc.id, ...doc.data() });
      });
      cachedPapers = papers; 
      return papers;
    } catch (error) {
      console.error("Error reading from Firebase database: ", error);
      return [];
    }
  }

  async function calculateAndRenderMetrics() {
    const papers = await fetchPlatformPapers();
    
    // Binding live database lengths to updated platform metric headers
    const resCountNode = document.getElementById("statResearches");
    const viewCountNode = document.getElementById("statViews");
    const likeCountNode = document.getElementById("statLikes");

    if (resCountNode) resCountNode.textContent = papers.length;
    if (viewCountNode) viewCountNode.textContent = papers.reduce((sum, p) => sum + (Number(p.views) || 0), 0).toLocaleString();
    if (likeCountNode) likeCountNode.textContent = papers.reduce((sum, p) => sum + (Number(p.likes) || 0), 0).toLocaleString();

    // Sort layouts based on live view increments
    const trending = [...papers].sort((a, b) => (Number(b.views) || 0) - (Number(a.views) || 0)).slice(0, 4);
    
    // Fixed Type Agnostic Date Comparator (Handles both Firestore ISO Strings and Native Timestamps)
    const recent = [...papers].sort((a, b) => {
      const timeA = a.createdAt?.seconds ? a.createdAt.seconds * 1000 : new Date(a.createdAt || 0).getTime();
      const timeB = b.createdAt?.seconds ? b.createdAt.seconds * 1000 : new Date(b.createdAt || 0).getTime();
      return timeB - timeA;
    }).slice(0, 4);

    renderGridCards("trendingGrid", trending);
    renderGridCards("recentGrid", recent);
  }

  function renderGridCards(targetId, filterArray) {
    const container = document.getElementById(targetId);
    if (!container) return;
    container.innerHTML = "";

    if (filterArray.length === 0) {
      container.innerHTML = `<div style="grid-column: 1 / -1; text-align: center; color: #64748b; padding: 40px; border: 1px dashed #e2e8f0; border-radius: 20px; font-weight: 500;">No validated research records currently live in the ledger.</div>`;
      return;
    }

    filterArray.forEach(paper => {
      const initials = paper.author ? paper.author.substring(0, 2).toUpperCase() : "AA";
      const card = document.createElement("div");
      
      card.style.cssText = `
        background: #ffffff; 
        border: 1px solid #e2e8f0; 
        border-radius: 20px; 
        padding: 24px; 
        display: flex; 
        flex-direction: column; 
        transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
        box-shadow: 0 10px 20px -5px rgba(15, 23, 42, 0.05);
      `;
      
      card.onmouseover = () => card.style.boxShadow = "0 20px 40px -10px rgba(185, 28, 28, 0.15)";
      card.onmouseout = () => card.style.boxShadow = "0 10px 20px -5px rgba(15, 23, 42, 0.05)";

      // Setup clean text fallbacks
      const cleanDesc = paper.description || paper.abstract || 'No abstract summary provided for this entry.';
      
      // Determine if text string exceeds standard thresholds
      const needsTruncation = cleanDesc.length > 120;
      const displayDesc = needsTruncation ? cleanDesc.substring(0, 120) + "..." : cleanDesc;

      card.innerHTML = `
        <div style="display: flex; justify-content: space-between; align-items: start; margin-bottom: 16px;">
          <span style="background: rgba(185, 28, 28, 0.08); color: #b91c1c; font-size: 0.7rem; padding: 4px 12px; border-radius: 99px; font-weight: 800; text-transform: uppercase; letter-spacing: 0.05em;">${paper.category || 'Research'}</span>
          <div style="display: flex; gap: 12px; font-size: 0.8rem; color: #64748b; font-weight: 600;">
            <span>👁️ ${(Number(paper.views) || 0).toLocaleString()}</span>
            <span>❤️ ${(Number(paper.likes) || 0).toLocaleString()}</span>
          </div>
        </div>
        
        <h3 style="font-size: 1.25rem; font-weight: 900; line-height: 1.3; margin-bottom: 12px; color: #0f172a; letter-spacing: -0.02em; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden;" title="${paper.title}">
          ${paper.title}
        </h3>

        <p style="font-size: 0.9rem; color: #475569; line-height: 1.6; margin-bottom: 24px; flex-grow: 1;">
          <span id="text-display-${paper.id}">${displayDesc}</span>
          ${needsTruncation ? `
            <button data-expanded="false" onclick="window.toggleDescription(this, '${paper.id}')" style="background:none; border:none; color:#b91c1c; font-weight:700; font-size:0.8rem; padding:0; cursor:pointer; margin-left:4px; text-decoration:underline; display:inline;">See More</button>
            <textarea id="full-desc-${paper.id}" style="display:none;">${cleanDesc}</textarea>
          ` : ''}
        </p>
        
        <div style="display: flex; align-items: center; gap: 12px; padding-top: 16px; border-top: 1px solid #f1f5f9;">
          <div style="width: 36px; height: 36px; background: #0f172a; border-radius: 50%; display: flex; align-items: center; justify-content: center; font-size: 0.8rem; font-weight: 700; color: #ffffff;">${initials}</div>
          <div style="flex-grow: 1;">
            <div style="font-size: 0.85rem; font-weight: 800; color: #0f172a; white-space: nowrap; overflow: hidden; text-overflow: ellipsis; max-width: 140px;">${paper.author || 'Anonymous'}</div>
            <div style="font-size: 0.75rem; color: #64748b; font-weight: 500;">@${paper.ownerUsername || 'avcearch'}</div>
          </div>
        </div>
        
        <a href="view.html?id=${paper.id}" style="margin-top: 20px; display: block; text-align: center; background: #0f172a; color: #ffffff; text-decoration: none; padding: 12px; border-radius: 12px; font-size: 0.9rem; font-weight: 700; transition: all 0.2s;">View Full Document</a>
      `;
      
      const btn = card.querySelector('a');
      btn.onmouseover = () => { btn.style.background = '#b91c1c'; btn.style.boxShadow = '0 5px 15px rgba(185, 28, 28, 0.3)'; };
      btn.onmouseout = () => { btn.style.background = '#0f172a'; btn.style.boxShadow = 'none'; };
      
      container.appendChild(card);
    });
  }

  // ------------------------------------------
  // 2. PREDICTIVE SEARCH HANDLER
  // ------------------------------------------
  searchInput?.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    if (!query) { searchDropdown.style.display = "none"; return; }

    const matches = cachedPapers.filter(p => (p.title || "").toLowerCase().includes(query) || (p.author || "").toLowerCase().includes(query));
    if (matches.length === 0) {
      searchDropdown.innerHTML = `<div style="padding: 12px 16px; font-size: 0.85rem; color: #64748b;">No matching database records found</div>`;
    } else {
      searchDropdown.innerHTML = matches.map(paper => `
        <a href="view.html?id=${paper.id}" class="dropdown-item" style="display:block; padding: 10px 14px; text-decoration:none; border-bottom: 1px solid #f1f5f9;">
          <span style="font-weight: 700; display:block; color: #1e293b;">${paper.title}</span>
          <span class="author-meta" style="font-size:0.75rem; color:#64748b;">${paper.author || 'Anonymous'} • <span style="color: #3b82f6; font-weight: 600;">${paper.category || 'General'}</span></span>
        </a>`).join('');
    }
    searchDropdown.style.display = "block";
  });

  document.addEventListener("click", (e) => {
    if (!searchInput?.contains(e.target) && !searchDropdown?.contains(e.target)) {
      searchDropdown.style.display = "none";
    }
  });

  // ------------------------------------------
  // 3. SECURE AUTHENTICATION STATE OBSERVER
  // ------------------------------------------
  onAuthStateChanged(auth, (user) => {
    currentUser = user;
    setupAuthUI(auth, user);
    calculateAndRenderMetrics();
  });

  // ------------------------------------------
  // 4. INTERCEPTIVE REALTIME BACKEND INTERNALS
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

  authElements.trigger?.addEventListener("click", () => {
    if (authElements.modal) authElements.modal.style.display = "flex";
  });
  
  authElements.closeModal?.addEventListener("click", () => {
    if (authElements.modal) authElements.modal.style.display = "none";
  });

  authElements.signOut?.addEventListener("click", (e) => {
    e.preventDefault();
    signOut(auth).then(() => {
      triggerToastNotification("Node Session Terminated.", "info");
      window.location.reload();
    });
  });

  const handleUploadGuard = (e) => {
    if (!currentUser) {
      e.preventDefault();
      triggerToastNotification("Please sign in first to access the publication upload system.", "error");
      if (authElements.modal) authElements.modal.style.display = "flex";
    }
  };

  authElements.uploadBtn?.addEventListener("click", handleUploadGuard);
  authElements.heroUploadBtn?.addEventListener("click", handleUploadGuard);
});

export function setupAuthUI(authInstance, user) {
  const navProfileAvatar = document.getElementById("navProfileAvatar");
  const signOutBtn = document.getElementById("signOutBtn");
  const messagesLink = document.getElementById("messagesNavLink");
  const authNavTrigger = document.getElementById("authNavTrigger");

  if (user) {
    if (authNavTrigger) authNavTrigger.style.display = "none";
    if (signOutBtn) signOutBtn.style.display = "block";
    if (messagesLink) messagesLink.style.display = "block";
    if (navProfileAvatar) {
      navProfileAvatar.style.display = "flex";
      const displayLabel = user.displayName || user.email.split("@")[0];
      navProfileAvatar.textContent = displayLabel.substring(0, 2).toUpperCase();
    }
  } else {
    if (authNavTrigger) authNavTrigger.style.display = "block";
    if (signOutBtn) signOutBtn.style.display = "none";
    if (messagesLink) messagesLink.style.display = "none";
    if (navProfileAvatar) navProfileAvatar.style.display = "none";
  }
}