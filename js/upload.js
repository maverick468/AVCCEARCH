// ============================================================================
// js/upload.js — Real-time Firestore & Cloudinary Publishing Controller
// ============================================================================
import { auth, db, onAuthStateChanged, collection, addDoc, CLOUDINARY_CLOUD_NAME, CLOUDINARY_PRESET_NAME } from "./firebase.js";

let verifiedUser = null;

// Track active authentication state
onAuthStateChanged(auth, (user) => {
  if (!user) {
    if (typeof showPremiumToast === "function") {
      showPremiumToast("Access Denied. Node unverified. Redirecting...", "error");
    } else {
      alert("Access Denied. Please sign in first.");
    }
    setTimeout(() => {
      window.location.href = "index.html";
    }, 1500);
  } else {
    verifiedUser = user;
    // Reveal user avatar thumbnail if configured
    const avatar = document.getElementById("navProfileAvatar");
    if (avatar) {
      avatar.style.display = "flex";
      avatar.textContent = user.email.charAt(0).toUpperCase();
    }
  }
});

const form = document.getElementById("uploadForm");
const overlay = document.getElementById("uploadOverlay");
const percentText = document.getElementById("upcPercent");
const upcStatusText = document.getElementById("upcStatusText");
const uploadContainerCard = document.getElementById("uploadContainerCard");
const systemFeedback = document.getElementById("systemFeedback");
const uploadSubmitBtn = document.getElementById("uploadSubmitBtn");
const btnText = document.getElementById("btnText");

form?.addEventListener("submit", async (e) => {
  e.preventDefault();
  clearFeedback();

  if (!verifiedUser) {
    triggerErrorState("Transmission Aborted: Operator identity signature missing.");
    return;
  }

  const fileInput = document.getElementById("researchFileInput");
  const file = fileInput?.files[0];
  
  if (!file) {
    triggerErrorState("Transmission Aborted: No target data package selected.");
    return;
  }

  const title = document.getElementById("titleInput").value.trim();
  const author = document.getElementById("authorInput").value.trim();
  const cat = document.getElementById("categorySelect").value;
  const desc = document.getElementById("descInput").value.trim();

  // Show processing overlay and lock submission action
  if (overlay) overlay.style.display = "flex";
  if (percentText) percentText.textContent = "0%";
  if (upcStatusText) upcStatusText.textContent = "Initializing Uplink Path...";
  if (uploadSubmitBtn) uploadSubmitBtn.disabled = true;

  const localPayload = {
    title,
    author,
    category: cat,
    abstract: desc || "No overview abstract context provided.",
    fileName: file.name,
    fileType: file.type
  };

  // Begin live Cloudinary asset array stream
  performUpload(file, localPayload);
});

async function performUpload(file, localPayload) {
  const formData = new FormData();
  formData.append("file", file);
  formData.append("upload_preset", CLOUDINARY_PRESET_NAME);
  formData.append("folder", "research_hub_papers");

  const xhr = new XMLHttpRequest();
  xhr.open("POST", `https://api.cloudinary.com/v1_1/${CLOUDINARY_CLOUD_NAME}/auto/upload`, true);

  // Monitor live network stream chunks and write telemetry strings
  xhr.upload.addEventListener("progress", (event) => {
    if (event.lengthComputable && percentText) {
      const progressPercent = Math.round((event.loaded / event.total) * 100);
      percentText.textContent = `${progressPercent}%`;
      
      if (progressPercent < 30) {
        if (upcStatusText) upcStatusText.textContent = "Allocating cluster buffer nodes...";
      } else if (progressPercent < 70) {
        if (upcStatusText) upcStatusText.textContent = "Streaming encrypted data payload channels...";
      } else if (progressPercent < 100) {
        if (upcStatusText) upcStatusText.textContent = "Finalizing block registry distribution matrix...";
      }
    }
  });

  xhr.onload = async () => {
    if (xhr.status >= 200 && xhr.status < 300) {
      try {
        if (upcStatusText) upcStatusText.textContent = "Committing ledger indexing transaction...";
        
        const responseData = JSON.parse(xhr.responseText);
        const secureFileURL = responseData.secure_url;

        // Commit configuration document schema to Firestore
        const docRef = await addDoc(collection(db, "papers"), {
          title: localPayload.title,
          author: localPayload.author,
          userId: verifiedUser.uid,
          authorId: verifiedUser.uid,
          category: localPayload.category,
          description: localPayload.abstract,
          fileURL: secureFileURL,
          pdfUrl: secureFileURL,
          views: 0,
          likes: 0,
          likedBy: [],
          createdAt: new Date().toISOString()
        });

        // Sync metadata reference index profile onto client local storage cache
        const storedPapers = JSON.parse(localStorage.getItem('publishedPapers')) || [];
        localPayload.id = docRef.id;
        localPayload.fileData = secureFileURL; // Stores pointer address token instead of massive binary strings
        storedPapers.push(localPayload);
        localStorage.setItem('publishedPapers', JSON.stringify(storedPapers));

        if (typeof showPremiumToast === "function") {
          showPremiumToast("Node Published! Core tracking sequence synchronized.", "success");
        }

        setTimeout(() => {
          window.location.href = `view.html?id=${docRef.id}`;
        }, 1000);

      } catch (err) {
        console.error("Database failure:", err);
        terminateUploadWithFault("Database Refusal: Cloud allocation indexed, but node tracking table failed to map.");
      }
    } else {
      console.error("Cloudinary Error:", xhr.responseText);
      terminateUploadWithFault("Storage Service Refusal: File extension profile mismatch or unassigned preset handshake error.");
    }
  };

  xhr.onerror = () => {
    terminateUploadWithFault("Network Error: Asset streaming channels completely disconnected.");
  };

  xhr.send(formData);
}

// Helper utility to break out of processing state on errors
function terminateUploadWithFault(errorMessage) {
  if (overlay) overlay.style.display = "none";
  if (uploadSubmitBtn) uploadSubmitBtn.disabled = false;
  triggerErrorState(errorMessage);
}

// Inject premium feedback visual shifts
function triggerErrorState(msg) {
  if (typeof showPremiumToast === "function") {
    showPremiumToast(msg, "error");
  }

  if (uploadContainerCard && systemFeedback) {
    uploadContainerCard.classList.add("upload-card-error-active");
    systemFeedback.className = "system-feedback-banner error show";
    systemFeedback.innerHTML = `
      <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
        <circle cx="12" cy="12" r="10"></circle>
        <line x1="12" y1="8" x2="12" y2="12"></line>
        <line x1="12" y1="16" x2="12.01" y2="16"></line>
      </svg>
      <div><strong>Core Infrastructure Refusal:</strong> ${msg}</div>
    `;
  }
}

function clearFeedback() {
  if (uploadContainerCard) uploadContainerCard.classList.remove("upload-card-error-active");
  if (systemFeedback) {
    systemFeedback.className = "system-feedback-banner";
    systemFeedback.innerHTML = "";
  }
}