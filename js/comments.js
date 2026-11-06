// ============================================================
// js/comments.js — Real-time comments system (Subcollection Edition)
// ============================================================
import {
  db, auth, onAuthStateChanged,
  collection, addDoc, doc, getDoc, query, orderBy, onSnapshot, serverTimestamp,
  sanitize, timeAgo
} from "./firebase.js";

// Cache memory footprint allocation to save active user profile lookup operations
const userProfileCache = {};

// ── Toast Notifications ───────────────────────────────────────
function toast(msg, type = "info") {
  let c = document.getElementById("toast-container");
  if (!c) {
    c = document.createElement("div");
    c.id = "toast-container";
    c.style.cssText = "position:fixed; bottom:20px; right:20px; display:flex; flex-direction:column; gap:8px; z-index:9999;";
    document.body.appendChild(c);
  }
  const el = document.createElement("div");
  el.style.cssText = `padding: 12px 20px; border-radius: 8px; color: #fff; font-size: 0.85rem; font-weight: 600; min-width: 200px; box-shadow: 0 4px 12px rgba(0,0,0,0.15); animation: fadeIn 0.3s ease; background: ${type === 'error' ? '#ef4444' : type === 'success' ? '#22c55e' : '#3b82f6'}`;
  el.textContent = msg;
  c.appendChild(el);
  setTimeout(() => { el.style.opacity = '0'; setTimeout(() => el.remove(), 300); }, 3500);
}

// ── Get research ID from URL ──────────────────────────────────
const researchId = new URLSearchParams(window.location.search).get("id");
if (!researchId) {
  console.warn("Comments System: Missing 'id' parameter in URL. Listener suspended.");
}

// ── DOM Bindings ──
const commentsBox    = document.getElementById("commentsBox") || document.getElementById("commentsList");
const commentForm    = document.getElementById("commentForm");
const commentInput   = document.getElementById("commentInput") || document.getElementById("commentText");
const commentCount   = document.getElementById("commentCount");

let currentUser = null;
let unsubscribe = null;

// Track authenticated session parameters
onAuthStateChanged(auth, (user) => {
  currentUser = user;
  if (researchId && commentsBox) {
    startListening();
  }
});

// ── Real-time comments listener ───────────────────────────────
function startListening() {
  if (!researchId || !commentsBox) return;

  commentsBox.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">Loading discussion feed...</div>`;

  // Explicit Subcollection Ref: /papers/{researchId}/comments
  const subcollectionRef = collection(db, "papers", researchId, "comments");
  const q = query(subcollectionRef, orderBy("createdAt", "asc"));

  if (unsubscribe) unsubscribe();

  // Process documents dynamically using a clean snapshot resolution loop
  unsubscribe = onSnapshot(q, async (snap) => {
    try {
      // 1. Gather all unique comment records immediately
      const rawComments = snap.docs.map(d => ({ id: d.id, ...d.data() }));
      const processedComments = [];

      // 2. Resolve references concurrently with Promise.all utilizing the cache layer
      await Promise.all(rawComments.map(async (data) => {
        let finalizedName = data.username || "Anonymous Peer";

        if (data.userId) {
          if (userProfileCache[data.userId]) {
            finalizedName = userProfileCache[data.userId];
          } else {
            try {
              const userDocRef = doc(db, "users", data.userId);
              const userDocSnap = await getDoc(userDocRef);
              if (userDocSnap.exists()) {
                const uData = userDocSnap.data();
                finalizedName = uData.username || uData.displayName || uData.name || finalizedName;
                // Save verified configuration data to memory
                userProfileCache[data.userId] = finalizedName;
              }
            } catch (e) {
              console.error("Profile resolution error:", e);
            }
          }
        }

        processedComments.push({
          id: data.id,
          name: finalizedName,
          text: data.text || "",
          postedAt: data.createdAt 
        });
      }));

      // 3. Keep comments accurately sorted by creation timeline parameters
      processedComments.sort((a, b) => {
        const timeA = a.postedAt?.seconds || 0;
        const timeB = b.postedAt?.seconds || 0;
        return timeA - timeB;
      });

      renderComments(processedComments);
    } catch (processError) {
      console.error("Rendering process crash sequence:", processError);
    }
  }, (err) => {
    console.error("Comments listener permissions or index error:", err);
    commentsBox.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted);">Failed to load comments. Verify your console logs for index setups.</div>`;
  });
}

// ── Render comments list ──────────────────────────────────────
function renderComments(comments) {
  if (!commentsBox) return;

  if (commentCount) {
    commentCount.textContent = `(${comments.length})`;
  }

  if (comments.length === 0) {
    commentsBox.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No public observations submitted yet.</div>`;
    return;
  }

  commentsBox.innerHTML = comments.map(c => {
    return `
      <div class="comment-bubble" style="background: rgba(255,255,255,0.6); border: 1px solid var(--cloud-border); padding: 12px; border-radius: 14px; margin-bottom: 10px; font-size: 0.9rem; position: relative;">
        <div style="font-size:0.75rem; font-weight:700; color:var(--sky-primary); margin-bottom:4px; display:flex; justify-content:space-between;">
          <span>@${sanitize(c.name)}</span>
          <span style="font-weight:400; color:var(--text-muted); font-size:0.7rem;">${timeAgo(c.postedAt)}</span>
        </div>
        <div class="comment-text-content" style="word-break: break-word; line-height: 1.4; text-align: left;">${sanitize(c.text)}</div>
      </div>
    `;
  }).join("");

  commentsBox.scrollTop = commentsBox.scrollHeight;
}

// ── Post a comment ────────────────────────────────────────────
async function handleCommentSubmission(e) {
  if (e) e.preventDefault();

  // Prevent execution seamlessly if no active verification state exists
  if (!currentUser) return;

  if (!researchId) {
    toast("Cannot post comment: Missing document references.", "error");
    return;
  }

  const textValue = commentInput?.value.trim();
  if (!textValue) return;

  let realDisplayName = currentUser.displayName || "Academic Peer";
  
  // Attempt memory cache pull before tracking asynchronous requests to cloud
  if (userProfileCache[currentUser.uid]) {
    realDisplayName = userProfileCache[currentUser.uid];
  } else {
    try {
      const ownProfileSnap = await getDoc(doc(db, "users", currentUser.uid));
      if (ownProfileSnap.exists()) {
        const uData = ownProfileSnap.data();
        realDisplayName = uData.username || uData.displayName || uData.name || realDisplayName;
        userProfileCache[currentUser.uid] = realDisplayName;
      }
    } catch(errProfile) {
      console.log("Profile resolution bypass status:", errProfile);
    }
  }

  try {
    const subcollectionRef = collection(db, "papers", researchId, "comments");
    
    await addDoc(subcollectionRef, {
      userId: currentUser.uid,
      username: realDisplayName,
      text: textValue,
      createdAt: serverTimestamp() 
    });

    if (commentInput) commentInput.value = "";
    toast("Comment posted!", "success");
  } catch (err) {
    console.error("Submission failed:", err);
    toast("Permission denied. Verify Firebase Auth state.", "error");
  }
}

// ── Event listeners ───────────────────────────────────────────
if (commentForm) {
  commentForm.addEventListener("submit", handleCommentSubmission);
} else {
  const alternatePostBtn = document.getElementById("postCommentBtn");
  alternatePostBtn?.addEventListener("click", handleCommentSubmission);
}

commentInput?.addEventListener("keydown", (e) => {
  if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
    e.preventDefault();
    handleCommentSubmission();
  }
});

window.addEventListener("beforeunload", () => {
  if (unsubscribe) unsubscribe();
});