// ==============================================================================
// PingLead Copilot Content Script (Upwork, Mostaql & Nafezly)
// Extracts DOM data, communicates with PingLead API, evaluates clients,
// and autofills proposals directly into the page textarea with simulated events.
// ==============================================================================

(function () {
  const DEFAULT_SERVER_URL = "https://ping-lead.vercel.app";

  // Prevent duplicate injections
  if (document.getElementById("pinglead-copilot-root")) return;

  const currentHost = window.location.hostname;
  const isUpwork = currentHost.includes("upwork.com");
  const isMostaql = currentHost.includes("mostaql.com");
  const isNafezly = currentHost.includes("nafezly.com");

  if (!isUpwork && !isMostaql && !isNafezly) return;

  // ----------------------------------------------------------------------------
  // 1. DOM Extraction Helpers
  // ----------------------------------------------------------------------------
  function extractUpworkData() {
    const titleEl = document.querySelector('h1, h4[data-test="job-title"], .job-title');
    const title = titleEl ? titleEl.innerText.trim() : document.title;

    const descEl = document.querySelector('[data-test="job-description-text"], .job-description, .break');
    const description = descEl ? descEl.innerText.trim() : "";

    const budgetEl = document.querySelector('[data-test="budget"], [data-test="job-type-label"], [data-qa="client-budget"]');
    const budget = budgetEl ? budgetEl.innerText.trim() : null;

    // About the client extraction
    const clientSection = document.querySelector('[data-qa="client-info"], .client-activity, aside');
    const clientText = clientSection ? clientSection.innerText : document.body.innerText;

    const paymentVerified = /payment\s+(?:method\s+)?verified/i.test(clientText);

    // Total spent: e.g. "$10K+ total spent" or "$500 total spent"
    const spentMatch = clientText.match(/\$([0-9kK\.\,]+)\s*(?:total\s+spent|spent)/i);
    const totalSpent = spentMatch ? `$${spentMatch[1]} spent` : null;

    // Hire rate: e.g. "75% hire rate, 12 jobs posted"
    const hireMatch = clientText.match(/(\d+)%\s*hire\s*rate/i);
    const hireRate = hireMatch ? parseInt(hireMatch[1], 10) : null;

    // Rating: e.g. "4.9 of 5 stars" or "4.95 of 5"
    const ratingMatch = clientText.match(/([\d\.]+)\s*of\s*5\s*stars/i);
    const rating = ratingMatch ? parseFloat(ratingMatch[1]) : null;

    // Country
    // Category & Skills extraction
    const specialtyEl = document.querySelector('[data-qa="client-job-specialty"], [data-test="JobTileSpecialty"], .job-details a[href*="/freelance-jobs/"]');
    const rawCategory = specialtyEl ? specialtyEl.innerText.trim() : null;

    const skillEls = document.querySelectorAll('[data-qa="skill__name"], .air3-token, a[href*="/nx/search/jobs/?skills="]');
    const skills = Array.from(skillEls).map(el => el.innerText.trim()).filter(Boolean);

    return {
      platform: "upwork",
      title,
      description,
      budget,
      url: window.location.href,
      rawCategory,
      skills,
      clientData: {
        paymentVerified,
        totalSpent,
        hireRate,
        rating,
        country,
      },
    };
  }

  function extractMostaqlData() {
    const titleEl = document.querySelector("h1, .project-title");
    const title = titleEl ? titleEl.innerText.trim() : document.title;

    const descEl = document.querySelector(".project-post__text, .project__brief, #projectDetailsTab");
    const description = descEl ? descEl.innerText.trim() : "";

    const budgetEl = document.querySelector(".project-budget_range, [data-type='project-budget_range']");
    const budget = budgetEl ? budgetEl.innerText.trim() : null;

    // Breadcrumb category & skills
    const breadcrumbEl = document.querySelector('.breadcrumb-item:last-child a, .breadcrumb-item:last-child');
    const rawCategory = breadcrumbEl ? breadcrumbEl.innerText.trim() : null;

    const skillEls = document.querySelectorAll('.skills__item, a[href*="/skills/"]');
    const skills = Array.from(skillEls).map(el => el.innerText.trim()).filter(Boolean);

    const bodyText = document.body.innerText;

    // Hire rate: "معدل التوظيف 85.71%"
    const hireMatch = bodyText.match(/معدل التوظيف[\s\S]*?(\d+(?:\.\d+)?)\s*%/);
    const hireRate = hireMatch ? parseFloat(hireMatch[1]) : null;

    // Open projects & completed
    const openMatch = bodyText.match(/المشاريع المفتوحة[\s\S]*?(\d+)/);
    const openProjects = openMatch ? parseInt(openMatch[1], 10) : null;

    const progressMatch = bodyText.match(/مشاريع قيد التنفيذ[\s\S]*?(\d+)/);
    const inProgressProjects = progressMatch ? parseInt(progressMatch[1], 10) : null;

    const paymentVerified =
      bodyText.includes("هوية موثقة") ||
      bodyText.includes("بريد مؤكد") ||
      bodyText.includes("جوال مؤكد") ||
      Boolean(hireRate && hireRate > 0);

    return {
      platform: "mostaql",
      title,
      description,
      budget,
      url: window.location.href,
      rawCategory,
      skills,
      clientData: {
        paymentVerified,
        hireRate,
        openProjects,
        inProgressProjects,
      },
    };
  }

  function extractCurrentJobData() {
    if (isUpwork) return extractUpworkData();
    if (isMostaql) return extractMostaqlData();
    return {
      platform: "nafezly",
      title: document.title,
      description: document.body.innerText.slice(0, 1000),
      url: window.location.href,
      clientData: {},
    };
  }

  // ----------------------------------------------------------------------------
  // 2. Proposal Autofill Helper (Simulates real keyboard/input events)
  // ----------------------------------------------------------------------------
  function autofillCoverLetter(proposalText) {
    let textarea = null;

    if (isUpwork) {
      textarea = document.querySelector(
        'textarea[aria-labelledby*="cover-letter"], textarea[name="coverLetter"], textarea#cover_letter, textarea.up-textarea'
      );
    } else if (isMostaql) {
      textarea = document.querySelector(
        'textarea#project-proposal-details, textarea[name="message"], textarea#proposal_details, textarea'
      );
    } else {
      textarea = document.querySelector("textarea");
    }

    if (!textarea) {
      alert("⚠️ لم يتم العثور على حقل العرض في الصفحة الحالية. انسخ العرض يدوياً.");
      return false;
    }

    // Scroll into view & focus
    textarea.scrollIntoView({ behavior: "smooth", block: "center" });
    textarea.focus();

    // Set value and dispatch input & change events for React/Vue reactive state
    textarea.value = proposalText;
    textarea.dispatchEvent(new Event("input", { bubbles: true }));
    textarea.dispatchEvent(new Event("change", { bubbles: true }));

    // Native setter workaround for React 16+ input tracker
    const nativeSetter = Object.getOwnPropertyDescriptor(window.HTMLTextAreaElement.prototype, "value")?.set;
    if (nativeSetter) {
      nativeSetter.call(textarea, proposalText);
      textarea.dispatchEvent(new Event("input", { bubbles: true }));
    }

    return true;
  }

  // ----------------------------------------------------------------------------
  // 3. Floating Widget UI Builder
  // ----------------------------------------------------------------------------
  const root = document.createElement("div");
  root.id = "pinglead-copilot-root";
  document.body.appendChild(root);

  let isCardOpen = false;
  let currentProposal = "";

  function renderFloatingButton() {
    root.innerHTML = `
      <button class="pl-widget-btn-floating" id="pl-open-btn">
        <span>⚡</span>
        <span>تحليل العميل وتوليد عرض</span>
      </button>
    `;

    document.getElementById("pl-open-btn").addEventListener("click", () => {
      isCardOpen = true;
      renderCardLoading();
      analyzeAndGenerate();
    });
  }

  function renderCardLoading() {
    root.innerHTML = `
      <div class="pl-widget-card">
        <div class="pl-card-header">
          <div class="pl-brand-title">
            <span>⚡</span>
            <span>PingLead Copilot</span>
          </div>
          <button class="pl-close-btn" id="pl-close-btn">✕</button>
        </div>
        <div class="pl-card-body" style="align-items: center; justify-content: center; min-height: 180px;">
          <div class="pl-spinner" style="width: 32px; height: 32px; border-width: 3px; border-top-color: #10b981;"></div>
          <p style="font-size: 13px; font-weight: 700; color: #475569; margin-top: 14px;">
            جاري قراءة بيانات العميل وتوليد العرض الذكي...
          </p>
        </div>
      </div>
    `;
    document.getElementById("pl-close-btn").addEventListener("click", () => {
      isCardOpen = false;
      renderFloatingButton();
    });
  }

  function renderCardResult(result) {
    const evalData = result.clientEvaluation || {};
    const score = typeof evalData.score === "number" ? evalData.score.toFixed(1) : "7.0";
    currentProposal = result.proposal || "";

    const scoreClass =
      evalData.score >= 7.5 ? "pl-score-green" : evalData.score >= 5 ? "pl-score-yellow" : "pl-score-red";

    const greenFlagsHtml = (evalData.greenFlags || [])
      .map((f) => `<div class="pl-flag-badge pl-flag-green"><span>✅</span><span>${f}</span></div>`)
      .join("");

    const redFlagsHtml = (evalData.redFlags || [])
      .map((f) => `<div class="pl-flag-badge pl-flag-red"><span>⚠️</span><span>${f}</span></div>`)
      .join("");

    root.innerHTML = `
      <div class="pl-widget-card">
        <div class="pl-card-header">
          <div class="pl-brand-title">
            <span>⚡</span>
            <span>PingLead Copilot</span>
          </div>
          <button class="pl-close-btn" id="pl-close-btn">✕</button>
        </div>
        <div class="pl-card-body">
          <!-- Client Score -->
          <div class="pl-client-score-box">
            <div class="pl-client-meta">
              <span class="pl-client-title">${evalData.labelAr || "تقييم العميل"}</span>
              <span class="pl-client-sub">${evalData.negotiationTipAr || "نصيحة: حافظ على وضوح نطاق العمل."}</span>
            </div>
            <div class="pl-score-circle ${scoreClass}">${score}</div>
          </div>

          <!-- Flags -->
          <div class="pl-flags-container">
            ${greenFlagsHtml}
            ${redFlagsHtml}
          </div>

          <!-- Proposal Section -->
          <div class="pl-proposal-container">
            <label style="font-size: 12px; font-weight: 700; color: #334155;">
              📝 العرض المقترح المخصص:
            </label>
            <textarea class="pl-proposal-box" id="pl-proposal-text">${currentProposal}</textarea>
            
            <div class="pl-btn-group">
              <button class="pl-action-btn pl-btn-primary" id="pl-autofill-btn">
                <span>✍️</span>
                <span>تعبئة تلقائياً</span>
              </button>
              <button class="pl-action-btn pl-btn-secondary" id="pl-copy-btn">
                <span>📋</span>
                <span>نسخ</span>
              </button>
            </div>
          </div>
        </div>
      </div>
    `;

    document.getElementById("pl-close-btn").addEventListener("click", () => {
      isCardOpen = false;
      renderFloatingButton();
    });

    document.getElementById("pl-copy-btn").addEventListener("click", () => {
      const text = document.getElementById("pl-proposal-text").value;
      navigator.clipboard.writeText(text);
      const copyBtn = document.getElementById("pl-copy-btn");
      copyBtn.innerHTML = "<span>✓</span><span>تم النسخ!</span>";
      setTimeout(() => {
        copyBtn.innerHTML = "<span>📋</span><span>نسخ</span>";
      }, 2000);
    });

    document.getElementById("pl-autofill-btn").addEventListener("click", () => {
      const text = document.getElementById("pl-proposal-text").value;
      const success = autofillCoverLetter(text);
      if (success) {
        const fillBtn = document.getElementById("pl-autofill-btn");
        fillBtn.innerHTML = "<span>✓</span><span>تمت التعبئة!</span>";
        setTimeout(() => {
          fillBtn.innerHTML = "<span>✍️</span><span>تعبئة تلقائياً</span>";
        }, 2500);
      }
    });
  }

  function renderCardError(errorMessage) {
    root.innerHTML = `
      <div class="pl-widget-card">
        <div class="pl-card-header">
          <div class="pl-brand-title">
            <span>⚡</span>
            <span>PingLead Copilot</span>
          </div>
          <button class="pl-close-btn" id="pl-close-btn">✕</button>
        </div>
        <div class="pl-card-body">
          <div class="pl-flag-badge pl-flag-red" style="padding: 12px;">
            <span>❌</span>
            <span>${errorMessage}</span>
          </div>
          <button class="pl-action-btn pl-btn-secondary" id="pl-retry-btn" style="margin-top: 10px;">
            <span>🔄</span>
            <span>إعادة المحاولة</span>
          </button>
        </div>
      </div>
    `;
    document.getElementById("pl-close-btn").addEventListener("click", () => {
      isCardOpen = false;
      renderFloatingButton();
    });
    document.getElementById("pl-retry-btn").addEventListener("click", () => {
      renderCardLoading();
      analyzeAndGenerate();
    });
  }

  // ----------------------------------------------------------------------------
  // 4. API Communication
  // ----------------------------------------------------------------------------
  function analyzeAndGenerate() {
    const jobData = extractCurrentJobData();

    // Get settings from chrome storage if available
    if (typeof chrome !== "undefined" && chrome.storage && chrome.storage.sync) {
      chrome.storage.sync.get(["apiKey", "serverUrl"], (settings) => {
        const serverUrl = settings.serverUrl || DEFAULT_SERVER_URL;
        sendAnalyzeRequest(serverUrl, settings.apiKey, jobData);
      });
    } else {
      sendAnalyzeRequest(DEFAULT_SERVER_URL, null, jobData);
    }
  }

  function sendAnalyzeRequest(serverUrl, apiKey, jobData) {
    const endpoint = `${serverUrl.replace(/\/$/, "")}/api/extension/analyze`;

    if (!apiKey) {
      renderCardError("حط مفتاح الإضافة الأول: من PingLead ← الإعدادات ← الملف الشخصي، وبعدها في إعدادات الإضافة.");
      return;
    }

    fetch(endpoint, {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify(jobData),
    })
      .then(async (res) => {
        const data = await res.json().catch(() => ({}));
        // 401 (bad key) and 402 (out of credits) carry a message for the user
        if (!res.ok) throw new Error(data.error || `HTTP ${res.status}`);
        return data;
      })
      .then((data) => {
        if (!data.success && data.error) throw new Error(data.error);
        renderCardResult(data);
      })
      .catch((err) => {
        renderCardError(err.message || "تعذر الاتصال بخادم PingLead.");
      });
  }

  // Initialize
  renderFloatingButton();
})();
