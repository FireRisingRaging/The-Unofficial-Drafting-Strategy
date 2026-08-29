/* =========================================================================
   THE BOOK — engine
   You should not need to edit this file to add pages or content.
   Add pages in index.html inside <div id="content-source">.
   ========================================================================= */

(function () {
  "use strict";

  const pagesRoot   = document.getElementById("pages");
  const sourceRoot  = document.getElementById("content-source");
  const bookEl      = document.getElementById("book");
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
  // so every leaf has a front and a back, like a real printed book.
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

  // ---- 2. Auto-number every page and tag TOC entries -------------------
  // (Skips numbering + skips TOC listing for pages marked data-no-toc.)
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

  // ---- 5. Build leaves: leaf[i] = { front: page[2i], back: page[2i+1] } -
  const leaves = [];
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

  // ---- 6. Flip state & rendering ----------------------------------------
  // currentLeaf = index of the next UN-flipped leaf (0 = book closed at start)
  let currentLeaf = 0;
  let animating = false;

  function layout() {
    leaves.forEach((leaf, i) => {
      const flipped = i < currentLeaf;
      leaf.classList.toggle("is-flipped", flipped);
      leaf.style.zIndex = flipped ? (i + 1) : (totalLeaves - i + totalLeaves);
    });
    updateIndicator();
    updateArrows();
  }

  function updateIndicator() {
    const rightPage = currentLeaf * 2 + 1;      // page about to be read, right side
    const leftPage  = currentLeaf * 2;           // page just read, left side
    if (currentLeaf === 0) {
      indicatorEl.textContent = `Page ${rightPage} of ${totalPages}`;
    } else if (currentLeaf >= totalLeaves) {
      indicatorEl.textContent = `Page ${totalPages} of ${totalPages}`;
    } else {
      indicatorEl.textContent = `Pages ${leftPage}\u2013${rightPage} of ${totalPages}`;
    }
  }

  function updateArrows() {
    prevBtn.disabled = currentLeaf <= 0;
    nextBtn.disabled = currentLeaf >= totalLeaves;
  }

  // ---- 7. Turning pages ---------------------------------------------------
  function next() {
    if (animating || currentLeaf >= totalLeaves) return;
    animating = true;
    const leaf = leaves[currentLeaf];
    leaf.style.zIndex = 999;
    leaf.classList.add("is-flipping");
    requestAnimationFrame(() => leaf.classList.add("is-flipped"));
    currentLeaf++;
    afterFlip(leaf);
  }

  function prev() {
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
      layout();
    };
    leaf.addEventListener("transitionend", done);
    // safety fallback in case transitionend doesn't fire (reduced motion etc.)
    setTimeout(() => { if (animating) done(); }, 1000);
  }

  // Fast sequential flip used when jumping from the TOC / menu, so it reads
  // like riffling through the pages rather than teleporting.
  function jumpToPage(id) {
    const target = sourcePages.findIndex((p) => p.id === id);
    if (target === -1) return;
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
      layout();
      setTimeout(step, 90);
    }
    // don't fight an in-flight normal flip
    animating = false;
    step();
  }

  // ---- 8. Input: click-to-turn, arrows, wheel, keyboard -------------------
  // A single listener on the book decides left vs. right from click
  // position, so page content (links, the TOC list, scrollable text)
  // keeps working normally instead of being covered by an overlay.
  bookEl.addEventListener("click", (e) => {
    if (e.target.closest("a, button, li, .toc-list")) return;
    if (window.getSelection().toString().length > 0) return; // don't hijack text selection
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
  document.querySelector(".stage").addEventListener("wheel", (e) => {
    if (wheelLock) return;
    if (Math.abs(e.deltaY) < 12) return;
    wheelLock = true;
    if (e.deltaY > 0) next(); else prev();
    setTimeout(() => { wheelLock = false; }, 550);
  }, { passive: true });

  // ---- 9. Hamburger drawer ------------------------------------------------
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

  // ---- go! -----------------------------------------------------------------
  layout();
})();
