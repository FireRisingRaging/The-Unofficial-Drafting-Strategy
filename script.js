/* =========================================================================
   THE BOOK - engine
   You should not need to edit this file to add pages or content.
   Add pages in index.html inside <div id="content-source">.

   Two rendering modes, switched automatically at the 700px breakpoint:
     - DESKTOP: the original 2-page leaf-flip book (unchanged).
     - MOBILE:  a single-page swipeable carousel. The two "endpaper"
                images become real pages at the very start/end of the
                sequence instead of a static background layer.
   ========================================================================= */

(function () {
  "use strict";

  const MOBILE_QUERY = window.matchMedia("(max-width: 700px)");

  const pagesRoot   = document.getElementById("pages");
  const sourceRoot  = document.getElementById("content-source");
  const bookEl      = document.getElementById("book");
  const stageEl     = document.querySelector(".stage");
  const indicatorEl = document.getElementById("pageIndicator");
  const menuBtn     = document.getElementById("menuBtn");
  const drawer      = document.getElementById("drawer");
  const drawerList  = document.getElementById("drawerList");
  const scrim       = document.getElementById("scrim");
  const prevBtn     = document.getElementById("prevBtn");
  const nextBtn     = document.getElementById("nextBtn");

  // ---- 1. Read every .page from the source, in document order ---------
  const sourcePages = Array.from(sourceRoot.querySelectorAll(":scope > .page"));

  if (sourcePages.length === 0) {
    pagesRoot.innerHTML = "<p style='padding:2em;font-family:sans-serif'>No pages found. Add some inside #content-source in index.html.</p>";
    return;
  }

  // If there's an odd number of pages, add a quiet blank page at the end
  // so every desktop leaf has a front and a back, like a real printed book.
  if (sourcePages.length % 2 !== 0) {
    const blank = document.createElement("section");
    blank.className = "page";
    blank.dataset.title = "";
    blank.innerHTML = '<div class="page-body"></div>';
    sourceRoot.appendChild(blank);
    sourcePages.push(blank);
  }

  const totalPages = sourcePages.length;
  const totalLeaves = totalPages / 2;

  // ---- 2. Auto-number every page and tag TOC entries (shared by both
  //         rendering modes - done once, regardless of which mode runs). --
  const tocEntries = [];
  sourcePages.forEach((el, i) => {
    const pageNumber = i + 1;
    el.dataset.pageNumber = pageNumber;

    const foot = document.createElement("div");
    foot.className = "page-foot";
    const label = document.createElement("span");
    label.textContent = pageNumber;
    foot.appendChild(label);
    const bookLabel = document.createElement("span");
    bookLabel.textContent = el.dataset.section || "";
    foot.appendChild(bookLabel);
    el.appendChild(foot);

    if (el.dataset.title && el.dataset.noToc === undefined) {
      tocEntries.push({ title: el.dataset.title, subtitle: el.dataset.subtitle || "", page: pageNumber, id: el.id });
    }
  });

  // ---- 3. Render the auto-generated Table of Contents -------------------
  const tocList = sourceRoot.querySelector("[data-toc-list]");
  if (tocList) {
    tocEntries.forEach(({ title, subtitle, page, id }) => {
      const li = document.createElement("li");
      li.className = "toc-entry";
      li.innerHTML = `
        <div class="toc-title">${title}</div>
        <div class="toc-row">
          ${subtitle ? `<span class="toc-subtitle">${subtitle}</span>` : ""}
          <span class="toc-fill"></span>
          <span class="toc-num">${page}</span>
        </div>`;
      li.addEventListener("click", () => jumpToPage(id));
      tocList.appendChild(li);
    });
  }

  // ---- 4. Render the hamburger drawer list ------------------------------
  tocEntries.forEach(({ title, page, id }) => {
    const li = document.createElement("li");
    const btn = document.createElement("button");
    btn.innerHTML = `<span>${title}</span><span class="num">${page}</span>`;
    btn.addEventListener("click", () => { jumpToPage(id); closeDrawer(); });
    li.appendChild(btn);
    drawerList.appendChild(li);
  });

  // ---- 5. Build the two "endpaper" cover pages, used only on mobile -----
  // On desktop these still render as the static background plates (see
  // the .endpaper markup in index.html + CSS). On mobile that background
  // layer is hidden entirely and these become real, swipeable pages at
  // the very start and end of the sequence instead.
  function buildCoverPage(id, imgs) {
    const section = document.createElement("section");
    section.className = "page cover-page";
    section.id = id;
    section.dataset.noToc = "";
    const body = document.createElement("div");
    body.className = "page-body cover-page-body";
    imgs.forEach(({ src, alt, width }) => {
      const img = document.createElement("img");
      img.src = src;
      img.alt = alt;
      if (width) img.style.width = width;
      body.appendChild(img);
    });
    section.appendChild(body);
    return section;
  }

  const coverFront = buildCoverPage("cover-front", [
    { src: "assets/Simon.png", alt: "Simon Checkout", width: "60%" },
    { src: "assets/Simon2.png", alt: "Simon Owns" },
  ]);
  const coverBack = buildCoverPage("cover-back", [
    { src: "assets/Ducts.png", alt: "Ducts", width: "60%" },
  ]);

  const mobilePages = [coverFront, ...sourcePages, coverBack];

  // ---- 6. Shared state ----------------------------------------------------
  let mode = null;          // "desktop" | "mobile"
  let currentLeaf = 0;       // desktop: index of the next un-flipped leaf
  let mobileIndex = 0;       // mobile: index into mobilePages currently shown
  let animating = false;     // desktop flip in progress
  let leaves = [];           // desktop leaf elements
  let slideEls = [];         // mobile slide wrapper elements
  let trackEl = null;        // mobile track element

  function isMobile() { return MOBILE_QUERY.matches; }

  function build() {
    const wantMode = isMobile() ? "mobile" : "desktop";
    if (wantMode === mode) return;
    mode = wantMode;
    pagesRoot.innerHTML = "";
    leaves = [];
    slideEls = [];
    trackEl = null;
    if (mode === "mobile") buildMobile(); else buildDesktop();
  }

  // =========================================================================
  // DESKTOP - original 2-page leaf-flip book (unchanged behavior)
  // =========================================================================

  function buildDesktop() {
    for (let i = 0; i < totalPages; i += 2) {
      const leafEl = document.createElement("div");
      leafEl.className = "leaf";

      const front = document.createElement("div");
      front.className = "leaf-face leaf-front";
      front.appendChild(sourcePages[i]);

      const back = document.createElement("div");
      back.className = "leaf-face leaf-back";
      back.appendChild(sourcePages[i + 1]);

      leafEl.appendChild(front);
      leafEl.appendChild(back);
      pagesRoot.appendChild(leafEl);
      leaves.push(leafEl);
    }
    currentLeaf = Math.min(currentLeaf, totalLeaves);
    layoutDesktop();
  }

  function layoutDesktop() {
    leaves.forEach((leaf, i) => {
      const flipped = i < currentLeaf;
      leaf.classList.toggle("is-flipped", flipped);
      leaf.style.zIndex = flipped ? (i + 1) : (totalLeaves - i + totalLeaves);
    });
    updateIndicatorDesktop();
    prevBtn.disabled = currentLeaf <= 0;
    nextBtn.disabled = currentLeaf >= totalLeaves;
  }

  function updateIndicatorDesktop() {
    const rightPage = currentLeaf * 2 + 1;
    const leftPage  = currentLeaf * 2;
    if (currentLeaf === 0) {
      indicatorEl.textContent = `Page ${rightPage} of ${totalPages}`;
    } else if (currentLeaf >= totalLeaves) {
      indicatorEl.textContent = `Page ${totalPages} of ${totalPages}`;
    } else {
      indicatorEl.textContent = `Pages ${leftPage}\u2013${rightPage} of ${totalPages}`;
    }
  }

  function nextDesktop() {
    if (animating || currentLeaf >= totalLeaves) return;
    animating = true;
    const leaf = leaves[currentLeaf];
    leaf.style.zIndex = 999;
    leaf.classList.add("is-flipping");
    requestAnimationFrame(() => leaf.classList.add("is-flipped"));
    currentLeaf++;
    afterFlip(leaf);
  }

  function prevDesktop() {
    if (animating || currentLeaf <= 0) return;
    animating = true;
    currentLeaf--;
    const leaf = leaves[currentLeaf];
    leaf.style.zIndex = 999;
    leaf.classList.add("is-flipping");
    requestAnimationFrame(() => leaf.classList.remove("is-flipped"));
    afterFlip(leaf);
  }

  function afterFlip(leaf) {
    const done = () => {
      leaf.classList.remove("is-flipping");
      leaf.removeEventListener("transitionend", done);
      animating = false;
      layoutDesktop();
    };
    leaf.addEventListener("transitionend", done);
    setTimeout(() => { if (animating) done(); }, 1000);
  }

  function jumpToPageDesktop(target) {
    const targetLeaf = Math.ceil(target / 2);
    if (targetLeaf === currentLeaf) return;
    if (animating) return;
    const dir = targetLeaf > currentLeaf ? 1 : -1;
    leaves.forEach((l) => l.classList.add("is-jumping"));

    function step() {
      if (currentLeaf === targetLeaf) {
        leaves.forEach((l) => l.classList.remove("is-jumping"));
        return;
      }
      const leaf = dir === 1 ? leaves[currentLeaf] : leaves[currentLeaf - 1];
      leaf.style.zIndex = 999;
      if (dir === 1) {
        leaf.classList.add("is-flipped");
        currentLeaf++;
      } else {
        leaf.classList.remove("is-flipped");
        currentLeaf--;
      }
      layoutDesktop();
      setTimeout(step, 90);
    }
    animating = false;
    step();
  }

  // =========================================================================
  // MOBILE - single-page swipeable carousel with a light 3D turn
  // =========================================================================

  function buildMobile() {
    trackEl = document.createElement("div");
    trackEl.className = "mobile-track no-transition";
    mobilePages.forEach((pageEl) => {
      const slide = document.createElement("div");
      slide.className = "mobile-slide";
      slide.appendChild(pageEl);
      trackEl.appendChild(slide);
      slideEls.push(slide);
    });
    pagesRoot.appendChild(trackEl);

    mobileIndex = Math.min(mobileIndex, mobilePages.length - 1);
    layoutMobile(false);
    attachSwipe();
  }

  function layoutMobile(withTransition) {
    trackEl.classList.toggle("no-transition", !withTransition);
    slideEls.forEach((slide, i) => {
      const offset = i - mobileIndex;
      slide.style.transform = `translateX(${offset * 100}%) rotateY(${offset * -14}deg)`;
      slide.style.zIndex = String(100 - Math.abs(offset));
      slide.style.pointerEvents = offset === 0 ? "auto" : "none";
    });
    updateIndicatorMobile();
    prevBtn.disabled = mobileIndex <= 0;
    nextBtn.disabled = mobileIndex >= mobilePages.length - 1;
  }

  function updateIndicatorMobile() {
    indicatorEl.textContent = `Page ${mobileIndex + 1} of ${mobilePages.length}`;
  }

  function nextMobile() {
    if (mobileIndex >= mobilePages.length - 1) return;
    mobileIndex++;
    layoutMobile(true);
  }

  function prevMobile() {
    if (mobileIndex <= 0) return;
    mobileIndex--;
    layoutMobile(true);
  }

  function jumpToPageMobile(mobileIdx) {
    mobileIndex = Math.max(0, Math.min(mobileIdx, mobilePages.length - 1));
    layoutMobile(true);
  }

  // -- swipe handling: live-follows the finger, snaps on release ----------
  let touchStartX = 0, touchStartY = 0, dragDX = 0, dragging = false, decided = null;

  function attachSwipe() {
    trackEl.addEventListener("touchstart", onTouchStart, { passive: true });
    trackEl.addEventListener("touchmove", onTouchMove, { passive: false });
    trackEl.addEventListener("touchend", onTouchEnd);
    trackEl.addEventListener("touchcancel", onTouchEnd);
  }

  function onTouchStart(e) {
    if (e.touches.length !== 1) return;
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
    dragDX = 0;
    dragging = true;
    decided = null;
    trackEl.classList.add("no-transition");
  }

  function onTouchMove(e) {
    if (!dragging) return;
    const dx = e.touches[0].clientX - touchStartX;
    const dy = e.touches[0].clientY - touchStartY;

    if (decided === null) {
      if (Math.abs(dx) < 8 && Math.abs(dy) < 8) return;
      decided = Math.abs(dx) > Math.abs(dy) ? "horizontal" : "vertical";
    }
    if (decided === "vertical") return; // let the page scroll normally

    e.preventDefault();
    dragDX = dx;
    // resist dragging past the first/last page
    if ((mobileIndex === 0 && dx > 0) || (mobileIndex === mobilePages.length - 1 && dx < 0)) {
      dragDX = dx * 0.35;
    }
    const trackWidth = trackEl.clientWidth || 1;
    const dragFraction = dragDX / trackWidth;
    slideEls.forEach((slide, i) => {
      const offset = (i - mobileIndex) + dragFraction;
      slide.style.transform = `translateX(${offset * 100}%) rotateY(${offset * -14}deg)`;
    });
  }

  function onTouchEnd() {
    if (!dragging) return;
    dragging = false;
    trackEl.classList.remove("no-transition");
    if (decided === "horizontal") {
      const trackWidth = trackEl.clientWidth || 1;
      const threshold = trackWidth * 0.18;
      if (dragDX <= -threshold) nextMobile();
      else if (dragDX >= threshold) prevMobile();
      else layoutMobile(true);
    }
    decided = null;
    dragDX = 0;
  }

  // =========================================================================
  // Shared navigation - dispatches to whichever mode is active
  // =========================================================================

  function jumpToPage(id) {
    const target = sourcePages.findIndex((p) => p.id === id);
    if (target === -1) return;
    if (mode === "mobile") jumpToPageMobile(target + 1); // +1: cover page sits at index 0
    else jumpToPageDesktop(target);
  }

  function next() { if (mode === "mobile") nextMobile(); else nextDesktop(); }
  function prev() { if (mode === "mobile") prevMobile(); else prevDesktop(); }

  // ---- 7. Input: click-to-turn (desktop), arrows, wheel, keyboard ---------
  bookEl.addEventListener("click", (e) => {
    if (mode === "mobile") return; // mobile navigates by swipe, not click
    if (e.target.closest("a, button, li, .toc-list")) return;
    if (window.getSelection().toString().length > 0) return;
    const rect = bookEl.getBoundingClientRect();
    const midpoint = rect.left + rect.width / 2;
    if (e.clientX < midpoint) prev(); else next();
  });

  prevBtn.addEventListener("click", prev);
  nextBtn.addEventListener("click", next);

  document.addEventListener("keydown", (e) => {
    if (e.key === "ArrowRight") next();
    if (e.key === "ArrowLeft") prev();
  });

  let wheelLock = false;
  stageEl.addEventListener("wheel", (e) => {
    if (mode === "mobile") return;
    if (wheelLock) return;
    if (Math.abs(e.deltaY) < 12) return;
    wheelLock = true;
    if (e.deltaY > 0) next(); else prev();
    setTimeout(() => { wheelLock = false; }, 550);
  }, { passive: true });

  // ---- 8. Hamburger drawer ------------------------------------------------
  function openDrawer() {
    drawer.classList.add("is-open");
    scrim.classList.add("is-open");
    menuBtn.classList.add("is-open");
  }
  function closeDrawer() {
    drawer.classList.remove("is-open");
    scrim.classList.remove("is-open");
    menuBtn.classList.remove("is-open");
  }
  menuBtn.addEventListener("click", () => {
    drawer.classList.contains("is-open") ? closeDrawer() : openDrawer();
  });
  scrim.addEventListener("click", closeDrawer);

  // ---- 9. Switch rendering mode if the viewport crosses the breakpoint ---
  let resizeTimer = null;
  const onModeChange = () => {
    clearTimeout(resizeTimer);
    resizeTimer = setTimeout(build, 120);
  };
  if (MOBILE_QUERY.addEventListener) {
    MOBILE_QUERY.addEventListener("change", onModeChange);
  } else if (MOBILE_QUERY.addListener) {
    MOBILE_QUERY.addListener(onModeChange); // older Safari
  }

  // ---- go! -----------------------------------------------------------------
  build();
})();