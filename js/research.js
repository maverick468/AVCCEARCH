// ============================================================================
// js/research.js — Unified Document Viewer & Real-time Conversation Hub Engine
// ============================================================================
import { 
  db, auth, onAuthStateChanged, doc, getDoc, setDoc, deleteDoc, collection, 
  addDoc, getDocs, query, where, orderBy, onSnapshot, sanitize, timeAgo 
} from "./firebase.js";

const urlParams = new URLSearchParams(window.location.search);
const paperId = urlParams.get("id");

// DOM Core Bindings
const docFrame = document.getElementById("docFrame");
const iframeContainer = document.getElementById("iframeContainer");
const downloadFileBtn = document.getElementById("downloadFileBtn");
const pCategory = document.getElementById("pCategory");
const pTitle = document.getElementById("pTitle");
const pAuthor = document.getElementById("pAuthor");
const pProfileLink = document.getElementById("pProfileLink");
const pAvatarCircle = document.getElementById("pAvatarCircle");
const pDesc = document.getElementById("pDesc");
const likeCount = document.getElementById("likeCount");
const likeBtn = document.getElementById("likeBtn");
const shareBtn = document.getElementById("shareBtn");
const dmBtn = document.getElementById("dmBtn");
const commentsBox = document.getElementById("commentsBox");
const commentForm = document.getElementById("commentForm");
const commentInput = document.getElementById("commentInput");
const commentCount = document.getElementById("commentCount");
const authorWorksContainer = document.getElementById("authorWorksContainer");
const shareSnackbar = document.getElementById("shareSnackbar");

const ownerControlsDeck = document.getElementById("ownerControlsDeck");
const editPaperBtn = document.getElementById("editPaperBtn");
const deletePaperBtn = document.getElementById("deletePaperBtn");

let currentUser = null;
let activePaperSnapshot = null;
let commentsUnsubscribe = null;

// Cache memory footprint allocation to save active user profile lookup operations
const userProfileCache = {};

function getNameInitials(name) {
  if (!name) return "??";
  return name.split(' ').map(w => w[0]).join('').slice(0, 2).toUpperCase();
}

// ── 1. INITIAL SETUP RUNNERS ────────────────────────────────────────────────
if (paperId) {
  loadPaperContextRecord();
  startRealTimeCommentsListener();
} else {
  if (pTitle) {
    pTitle.textContent = "Error: No Document Specified";
  }
}

onAuthStateChanged(auth, (user) => {
  // 1. Expose the user globally so your non-module script can see it instantly
  window.firebaseUserObj = user; 
  
  // 2. Keep your local module variable updated too if other functions here use it
  currentUser = user;

  // 3. Automatically hide the restriction banner if the user just logged in
  const guard = document.getElementById("inlineGuardBanner");
  if (user && guard) {
    guard.style.display = "none";
  }

  // 4. Run your existing structural UI updates
  if (activePaperSnapshot) {
    evaluateOwnershipPermissions();
    refreshLikeButtonUI();
  }
});

// ── 2. PORTAL RENDERING LOGIC (PDF / IMAGES / OFFICE SMART PREVIEW) ──────────
async function loadPaperContextRecord() {
  if (!paperId) return;
  
  try {
    const docRef = doc(db, "papers", paperId);
    const docSnap = await getDoc(docRef);
    
    if (!docSnap.exists()) {
      if (pTitle) {
        pTitle.textContent = "Document Not Found";
      }
      return;
    }

    activePaperSnapshot = { id: docSnap.id, ...docSnap.data() };
    const data = activePaperSnapshot;

    // Increment view count systematically on entry 
    try {
      const currentViews = Number(data.views) || 0;
      await setDoc(docRef, { views: currentViews + 1 }, { merge: true });
    } catch (vErr) {
      console.warn("Could not increment document telemetry matrix:", vErr);
    }

    const finalizedTitle = data.title || data.paperTitle || "Untitled Document";
    const finalizedAuthor = data.author || data.authorName || "Unknown Author";
    const finalizedCategory = data.category || "General";
    const finalizedDescription = data.description || data.abstract || "No description provided.";
    
    // Extract file content payload directly out of local storage allocation maps
    const storedPapers = JSON.parse(localStorage.getItem('publishedPapers')) || [];
    const localMatch = storedPapers.find(p => p.id === paperId);
    
    // Unified Key Fallbacks: Supports upload.js `fileURL` alignment along with storage buffers
    const finalizedUrl = data.fileURL || data.pdfUrl || data.fileUrl || data.url || localMatch?.fileData || "";

    if (downloadFileBtn && finalizedUrl) {
      downloadFileBtn.setAttribute("href", finalizedUrl);
      downloadFileBtn.setAttribute("download", localMatch?.fileName || finalizedTitle);
    }

    // Dynamic Multi-Format Stream Media Rendering Processor
    if (iframeContainer && finalizedUrl) {
      const lowerUrl = finalizedUrl.toLowerCase();
      
      // Target Formats Pattern 1: Graphics Media Images Layout Assets
      const isImage = lowerUrl.includes(".jpg") || lowerUrl.includes(".jpeg") || 
                      lowerUrl.includes(".png") || lowerUrl.includes(".webp") || 
                      lowerUrl.startsWith("data:image/");

      if (isImage) {
        iframeContainer.innerHTML = `
          <div style="width:100%; height:100%; display:flex; align-items:center; justify-content:center; background:#1e293b; overflow:auto; padding:16px; box-sizing:border-box;">
            <img src="${finalizedUrl}" alt="${sanitize(finalizedTitle)}" style="max-width:100%; max-height:100%; object-fit:contain; border-radius:8px; box-shadow:0 10px 25px rgba(0,0,0,0.3);" />
          </div>`;
      } 
      // Target Formats Pattern 2: Enterprise Microsoft Office Workspace Engines
      else if (lowerUrl.includes(".doc") || lowerUrl.includes(".docx") || 
               lowerUrl.includes(".ppt") || lowerUrl.includes(".pptx") || 
               lowerUrl.includes(".xlsx")) {
        
        // Catch raw non-synced base64 variants before parsing to external tools
        if (finalizedUrl.startsWith("data:")) {
          iframeContainer.innerHTML = `
            <div style="position:absolute; top:0; left:0; width:100%; height:100%; display:flex; flex-direction:column; align-items:center; justify-content:center; background:#f8fafc; padding:24px; text-align:center; box-sizing:border-box; border-radius:inherit; z-index:10;">
              <div style="font-size:3.5rem; margin-bottom:12px;">📄</div>
              <h3 style="font-weight:800; margin-bottom:6px; color:var(--text-dark); font-size:1.1rem;">${sanitize(finalizedTitle)}</h3>
              <p style="font-size:0.8rem; color:var(--text-muted); max-width:320px; margin-bottom:20px;">Word/Office formats must be downloaded natively to access their structured layout streams.</p>
              <a href="${finalizedUrl}" class="btn btn-primary" download="${localMatch?.fileName || 'document.docx'}" style="padding:10px 24px; font-size:0.85rem; display:inline-flex; align-items:center; gap:6px;">📥 Open & Download Document</a>
            </div>`;
        } else {
          iframeContainer.innerHTML = `<iframe src="https://docs.google.com/gview?url=${encodeURIComponent(finalizedUrl)}&embedded=true" style="width:100%; height:100%; border:none;"></iframe>`;
        }
      } 
      // Target Formats Pattern 3: Standard Native Frame Engine (PDF Documents and HTML Links)
      else {
        iframeContainer.innerHTML = `<iframe id="docFrame" src="${finalizedUrl}" style="width:100%; height:100%; border:none;"></iframe>`;
      }
    } else if (iframeContainer) {
       iframeContainer.innerHTML = `<div style="text-align:center; padding:40px; color:var(--text-muted);">No frame document source path linked to this database target.</div>`;
    }

    if (pCategory) pCategory.textContent = sanitize(finalizedCategory);
    if (pTitle) pTitle.textContent = sanitize(finalizedTitle);
    if (pAuthor) pAuthor.textContent = sanitize(finalizedAuthor);
    if (pDesc) pDesc.textContent = sanitize(finalizedDescription);
    if (likeCount) likeCount.textContent = data.likes || 0;
    if (pAvatarCircle) pAvatarCircle.textContent = getNameInitials(finalizedAuthor);

    evaluateOwnershipPermissions();
    refreshLikeButtonUI();

    const authorIdKey = data.authorId || data.userId || data.uid || data.ownerId;
    if (pProfileLink && authorIdKey) {
      pProfileLink.href = `profile.html?id=${authorIdKey}`;
      loadAuthorOtherPublications(authorIdKey);
    }
  } catch (err) {
    console.error("Metadata workspace loading error:", err);
  }
}

// ── 3. REAL-TIME COMMENTS & THREADED REPLY ENGINE ───────────────────────────
function startRealTimeCommentsListener() {
  if (!paperId || !commentsBox) return;

  const q = query(
    collection(db, "comments"),
    where("paperId", "==", paperId)
  );

  if (commentsUnsubscribe) {
    commentsUnsubscribe();
  }

  commentsUnsubscribe = onSnapshot(q, (snapshot) => {
    if (commentCount) {
      commentCount.textContent = `(${snapshot.docs.length})`;
    }

    if (snapshot.empty) {
      commentsBox.innerHTML = `<div style="text-align:center; padding:20px; color:var(--text-muted); font-size:0.85rem;">No public observations submitted yet.</div>`;
      return;
    }

    const rawComments = snapshot.docs.map(d => ({ id: d.id, ...d.data() }));
    
    // Consistent timeline sorting calculation safely avoiding async crashes
    rawComments.sort((a, b) => {
      const timeA = new Date(a.postedAt || 0).getTime();
      const timeB = new Date(b.postedAt || 0).getTime();
      return timeA - timeB;
    });

    const parentComments = rawComments.filter(c => !c.parentId);
    const replyComments = rawComments.filter(c => c.parentId);

    let outputHTML = "";

    for (const comment of parentComments) {
      const commentId = comment.id;
      const isCommentOwner = currentUser && comment.userId === currentUser.uid;
      let displayUsername = comment.userName || comment.username || "Anonymous Peer";

      // Non-blocking real-time hydration: updates target tags dynamically inside DOM without UI blockages
      if (comment.userId) {
        if (userProfileCache[comment.userId]) {
          displayUsername = userProfileCache[comment.userId];
        } else {
          getDoc(doc(db, "users", comment.userId)).then((uSnap) => {
            if (uSnap.exists()) {
              const uData = uSnap.data();
              const foundName = uData.username || uData.displayName || uData.name || uData.fullName;
              if (foundName) {
                userProfileCache[comment.userId] = foundName;
                const nameSpan = document.getElementById(`name-tag-${commentId}`);
                if (nameSpan) {
                  nameSpan.textContent = `@${foundName}`;
                }
              }
            }
          }).catch(e => console.warn(e));
        }
      }

      const currentReplies = replyComments.filter(r => r.parentId === commentId);
      let repliesHTML = "";

      for (const reply of currentReplies) {
        const isReplyOwner = currentUser && reply.userId === currentUser.uid;
        let replyUser = reply.userName || reply.username || "Anonymous Peer";
        
        if (reply.userId) {
          if (userProfileCache[reply.userId]) {
            replyUser = userProfileCache[reply.userId];
          } else {
            getDoc(doc(db, "users", reply.userId)).then((uSnap) => {
              if (uSnap.exists()) {
                const uData = uSnap.data();
                const foundName = uData.username || uData.displayName || uData.name || uData.fullName;
                if (foundName) {
                  userProfileCache[reply.userId] = foundName;
                  const replySpan = document.getElementById(`name-tag-${reply.id}`);
                  if (replySpan) {
                    replySpan.textContent = `@${foundName}`;
                  }
                }
              }
            }).catch(e => console.warn(e));
          }
        }

        repliesHTML += `
          <div class="comment-bubble reply-bubble" id="bubble-${reply.id}" style="margin-left: 28px; background: rgba(0,0,0,0.02); border-left: 3px solid var(--sky-primary); padding: 8px 12px; margin-top: 6px; border-radius: 4px 12px 12px 12px;">
            <div style="font-size:0.7rem; font-weight:700; color:var(--text-dark); display:flex; justify-content:space-between; align-items: center;">
              <span id="name-tag-${reply.id}">@${sanitize(replyUser)}</span>
              <span style="font-weight:400; color:var(--text-muted); margin-left:auto;">${timeAgo(reply.postedAt)}</span>
            </div>
            <div class="comment-text-content" style="font-size:0.85rem; margin-top:2px; text-align: left;">${sanitize(reply.text)}</div>
            <div class="comment-actions" style="display:flex; gap:10px; margin-top:4px; font-size:0.7rem;">
              ${isReplyOwner ? `
                <button class="comment-btn" onclick="window.editCommentInline('${reply.id}')">Edit</button>
                <button class="comment-btn delete-btn" onclick="window.deleteCommentInline('${reply.id}')">Delete</button>
              ` : ''}
            </div>
          </div>
        `;
      }

      outputHTML += `
        <div class="comment-bubble" id="bubble-${commentId}" style="border: 1px solid var(--cloud-border); padding: 12px; border-radius: 14px; margin-bottom: 12px; background: #fff;">
          <div style="font-size:0.75rem; font-weight:700; color:var(--sky-primary); margin-bottom:4px; display:flex; justify-content:space-between;">
            <span id="name-tag-${commentId}">@${sanitize(displayUsername)}</span>
            <span style="font-weight:400; color:var(--text-muted); font-size:0.7rem;">${timeAgo(comment.postedAt)}</span>
          </div>
          <div class="comment-text-content" style="color: var(--text-dark); line-height:1.4; text-align: left;">${sanitize(comment.text)}</div>
          
          <div class="comment-actions" style="display:flex; gap:10px; margin-top:6px; font-size:0.75rem;">
            <button class="comment-btn" onclick="window.setupReplyInterface('${commentId}')">💬 Reply</button>
            ${isCommentOwner ? `
              <button class="comment-btn" onclick="window.editCommentInline('${commentId}')">Edit</button>
              <button class="comment-btn delete-btn" onclick="window.deleteCommentInline('${commentId}')">Delete</button>
            ` : ''}
          </div>
          
          <div id="reply-zone-${commentId}" style="width: 100%;"></div>
          <div class="replies-container" style="margin-top: 4px;">${repliesHTML}</div>
        </div>
      `;
    }

    commentsBox.innerHTML = outputHTML;
    commentsBox.scrollTop = commentsBox.scrollHeight;
  }, (err) => {
    console.error("Real-time listener suspended:", err);
  });
}

// ── 4. POST COMMENT CONTROLLER ──────────────────────────────────────────────
commentForm?.addEventListener("submit", async (e) => {
  e.preventDefault();
  
  if (!currentUser) return; 
  
  const textValue = commentInput.value.trim();
  if (!textValue) return;

  try {
    let userProfileName = currentUser.displayName || "Academic Peer";
    if (userProfileCache[currentUser.uid]) {
      userProfileName = userProfileCache[currentUser.uid];
    } else {
      const profileSnap = await getDoc(doc(db, "users", currentUser.uid));
      if (profileSnap.exists()) {
        const uData = profileSnap.data();
        userProfileName = uData.username || uData.displayName || uData.name || uData.fullName || userProfileName;
        userProfileCache[currentUser.uid] = userProfileName;
      }
    }

    await addDoc(collection(db, "comments"), {
      paperId: paperId,
      userId: currentUser.uid,
      userName: userProfileName,
      text: textValue,
      postedAt: new Date().toISOString()
    });

    commentInput.value = "";
  } catch (err) {
    alert("Failed to submit comment: " + err.message);
  }
});

// ── 5. INLINE INTERACTION CONTROLLERS (GLOBAL EXPOSURE) ──────
window.setupReplyInterface = function(commentId) {
  if (!currentUser) { alert("Please log in to leave discussion comments."); return; }

  const replyZone = document.getElementById(`reply-zone-${commentId}`);
  if (!replyZone) return;

  if (replyZone.innerHTML !== "") {
    replyZone.innerHTML = "";
    return;
  }

  replyZone.innerHTML = `
    <div style="display:flex; gap:6px; margin-top:8px; width:100%; padding-left: 14px; box-sizing: border-box;">
      <input type="text" class="form-input" id="reply-input-${commentId}" placeholder="Write a reply..." style="flex:1; padding:6px 10px; font-size:0.8rem; border-radius:8px; border:1px solid var(--cloud-border);" />
      <button class="btn btn-primary" onclick="window.submitReplyInline('${commentId}')" style="padding:4px 12px; font-size:0.75rem; border-radius:8px;">Reply</button>
    </div>
  `;
  document.getElementById(`reply-input-${commentId}`).focus();
};

window.submitReplyInline = async function(commentId) {
  if (!currentUser) return;
  const rInput = document.getElementById(`reply-input-${commentId}`);
  const rText = rInput?.value.trim();
  if (!rText) return;

  try {
    let replyProfileName = currentUser.displayName || "Academic Peer";
    if (userProfileCache[currentUser.uid]) {
      replyProfileName = userProfileCache[currentUser.uid];
    }

    await addDoc(collection(db, "comments"), {
      paperId: paperId,
      parentId: commentId,
      userId: currentUser.uid,
      userName: replyProfileName,
      text: rText,
      postedAt: new Date().toISOString()
    });

    const zone = document.getElementById(`reply-zone-${commentId}`);
    if (zone) zone.innerHTML = "";
  } catch (err) {
    alert("Could not process reply payload: " + err.message);
  }
};

window.editCommentInline = function(commentId) {
  const bubble = document.getElementById(`bubble-${commentId}`);
  const textDiv = bubble.querySelector('.comment-text-content');
  const originalText = textDiv.textContent;
  if (bubble.querySelector('.comment-actions')) {
    bubble.querySelector('.comment-actions').style.display = 'none';
  }

  textDiv.innerHTML = `
    <div style="display:flex; gap:6px; margin-top:6px; width:100%;">
      <input type="text" class="form-input" id="edit-input-${commentId}" value="${sanitize(originalText)}" style="flex:1; padding:4px 8px; font-size:0.85rem; border:1px solid var(--cloud-border); border-radius:6px;" />
      <button class="btn btn-primary" onclick="window.saveInlineComment('${commentId}')" style="padding:4px 12px; font-size:0.8rem;">Save</button>
      <button class="btn btn-secondary" onclick="window.startRealTimeCommentsListener()" style="padding:4px 12px; font-size:0.8rem;">Cancel</button>
    </div>
  `;
};

window.saveInlineComment = async function(commentId) {
  const inputVal = document.getElementById(`edit-input-${commentId}`).value.trim();
  if (!inputVal) return;
  try {
    await setDoc(doc(db, "comments", commentId), { text: inputVal }, { merge: true });
    startRealTimeCommentsListener();
  } catch (err) { alert(err.message); }
};

window.deleteCommentInline = async function(commentId) {
  if (!confirm("Are you sure you want to permanently delete this comment thread?")) return;
  try {
    await deleteDoc(doc(db, "comments", commentId));
    startRealTimeCommentsListener();
  } catch (err) { alert(err.message); }
};

// ── 6. AUXILIARY UTILITIES AND SOCIAL TRIGGER BINDINGS ──────────────────────
async function loadAuthorOtherPublications(authorId) {
  if (!authorWorksContainer) return;
  try {
    // Fixed: Queries via multiple user structural lookup flags to guarantee results
    const qRecord = query(collection(db, "papers"), where("authorId", "==", authorId));
    let snapshot = await getDocs(qRecord);
    
    if (snapshot.empty) {
      const qRecordFallback = query(collection(db, "papers"), where("userId", "==", authorId));
      snapshot = await getDocs(qRecordFallback);
    }
    
    let innerSidebarHTML = "";
    snapshot.forEach((docRecord) => {
      if (docRecord.id === paperId) return;
      const work = docRecord.data();
      
      // Safety handling route generation mappings
      const targetPage = window.location.pathname.includes("view.html") ? "view.html" : "view.html";
      
      innerSidebarHTML += `
        <div class="side-paper-link" onclick="window.location.href='${targetPage}?id=${docRecord.id}'">
          <div style="font-size: 0.8rem; font-weight: 700; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height:1.3;">
            ${sanitize(work.title || work.paperTitle || "Untitled")}
          </div>
          <div style="font-size: 0.7rem; opacity: 0.8; margin-top: 4px;">📂 ${sanitize(work.category || "General")}</div>
        </div>
      `;
    });

    const activeItemHTML = `
      <div class="side-paper-link active">
        <div style="font-size: 0.8rem; font-weight: 700; display: -webkit-box; -webkit-line-clamp: 2; -webkit-box-orient: vertical; overflow: hidden; line-height:1.3;">
          ${pTitle ? pTitle.textContent : 'Active Document'}
        </div>
        <div style="font-size: 0.7rem; opacity: 0.9; margin-top: 4px;">📌 Now Viewing</div>
      </div>
    `;
    authorWorksContainer.innerHTML = activeItemHTML + innerSidebarHTML;
  } catch (err) { console.error(err); }
}

function evaluateOwnershipPermissions() {
  if (!activePaperSnapshot) return;
  const authorIdKey = activePaperSnapshot.authorId || activePaperSnapshot.userId || activePaperSnapshot.uid || activePaperSnapshot.ownerId;
  if (currentUser && authorIdKey === currentUser.uid) {
    if (ownerControlsDeck) ownerControlsDeck.style.display = "flex";
  } else {
    if (ownerControlsDeck) ownerControlsDeck.style.display = "none";
  }
}

function refreshLikeButtonUI() {
  if (!activePaperSnapshot || !likeBtn) return;
  const currentLikes = activePaperSnapshot.likedBy || [];
  if (currentUser && currentLikes.includes(currentUser.uid)) {
    likeBtn.style.background = "#ef4444";
    likeBtn.style.color = "#ffffff";
  } else {
    likeBtn.style.background = "";
    likeBtn.style.color = "";
  }
}

// ── 7. RE-ENGINEERED INLINE FORM LISTENER ENGINE (REPLACES PROMPT) ──────────
window.addEventListener("inlinePaperUpdateRequest", async (e) => {
  if (!paperId || !activePaperSnapshot) return;
  
  const { title, description } = e.detail;

  try {
    const docRef = doc(db, "papers", paperId);
    
    // Commit inline values directly to firestore instances
    await setDoc(docRef, { 
      title: title.trim(), 
      description: description.trim() 
    }, { merge: true });

    // Synchronize local active snapshot object variables
    activePaperSnapshot.title = title.trim();
    activePaperSnapshot.description = description.trim();

    // Fire success acknowledgement event token back to UI window instance thread
    window.dispatchEvent(new CustomEvent("inlinePaperUpdateSuccess", {
      detail: { title: title.trim(), description: description.trim() }
    }));

    // Update alternative dynamic sidebar links without needing full refresh
    const authorIdKey = activePaperSnapshot.authorId || activePaperSnapshot.userId || activePaperSnapshot.uid || activePaperSnapshot.ownerId;
    if (authorIdKey) {
      loadAuthorOtherPublications(authorIdKey);
    }

  } catch (err) {
    console.error("Inline save processing database rejection error:", err);
    alert("Database update rejected: " + err.message);
  }
});

// Structural fallback connector for old DOM action layouts
editPaperBtn?.addEventListener("click", () => {
  // Static wrapper event intentionally bypassed; interface state handoffs are now 
  // fully handled natively via form interactions contained inside the view document.
});

deletePaperBtn?.addEventListener("click", async () => {
  if (!confirm("Are you sure you want to permanently delete this paper?")) return;
  try {
    await deleteDoc(doc(db, "papers", paperId));
    window.location.href = "explore.html";
  } catch (e) { alert(e.message); }
});

likeBtn?.addEventListener("click", async () => {
  if (!currentUser || !activePaperSnapshot) return;
  
  const docRef = doc(db, "papers", paperId);
  let likedByArray = activePaperSnapshot.likedBy || [];
  let currentLikesCount = activePaperSnapshot.likes || 0;

  if (likedByArray.includes(currentUser.uid)) {
    likedByArray = likedByArray.filter(uid => uid !== currentUser.uid);
    currentLikesCount = Math.max(0, currentLikesCount - 1);
  } else {
    likedByArray.push(currentUser.uid);
    currentLikesCount += 1;
  }
  await setDoc(docRef, { likedBy: likedByArray, likes: currentLikesCount }, { merge: true });
  activePaperSnapshot.likedBy = likedByArray;
  activePaperSnapshot.likes = currentLikesCount;
  if (likeCount) likeCount.textContent = currentLikesCount;
  refreshLikeButtonUI();
});

shareBtn?.addEventListener("click", () => {
  navigator.clipboard.writeText(window.location.href).then(() => {
    if (shareSnackbar) {
      shareSnackbar.classList.add("visible");
      setTimeout(() => shareSnackbar.classList.remove("visible"), 3000);
    }
  });
});

dmBtn?.addEventListener("click", () => {
  if (!currentUser || !activePaperSnapshot) return;
  
  const recipientUid = activePaperSnapshot.authorId || activePaperSnapshot.userId;
  window.location.href = `messages.html?to=${recipientUid}&ref=${encodeURIComponent(activePaperSnapshot.title || "Research Paper")}`;
});

window.addEventListener("beforeunload", () => { if (commentsUnsubscribe) commentsUnsubscribe(); });

// Expose functions to window to satisfy inline HTML event calls
window.startRealTimeCommentsListener = startRealTimeCommentsListener;
// Add this to the very bottom of research.js
window.addEventListener('load', () => {
    const layoutRoot = document.getElementById("layoutRoot");
    // Ensure the layout matches the 'Focus' (State 2) design
    if (layoutRoot && !layoutRoot.classList.contains('fullscreen-mode')) {
        layoutRoot.classList.add('fullscreen-mode');
        layoutRoot.classList.remove('wide-mode');
    }
});