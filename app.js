document.addEventListener("DOMContentLoaded", () => {

  const zipInput = document.getElementById("zipInput");
  const goBtn = document.getElementById("goBtn");
  const uploadSection = document.querySelector(".upload-section");
  const chatContainer = document.getElementById("chatContainer");
  const chatWrapper = document.querySelector(".chat-wrapper");
  const scrollBtn = document.getElementById("scrollToBottomBtn");
  const fileNameSpan = document.getElementById("fileName");
  const loadingOverlay = document.getElementById("loadingOverlay");
  const leftUserEl = document.getElementById("leftUser");
  const rightUserEl = document.getElementById("rightUser");
  const toggleSidebarBtn = document.getElementById("toggleSidebar");
  const closeSidebarBtn = document.getElementById("closeSidebar");
  const sidebar = document.getElementById("sidebar");
  const dateSearch = document.getElementById("dateSearch");
  const textSearch = document.getElementById("textSearch");
  const searchCount = document.getElementById("searchCount");
  const searchPrev = document.getElementById("searchPrev");
  const searchNext = document.getElementById("searchNext");

  const wordStats = document.getElementById("wordStats");
  const emojiStats = document.getElementById("emojiStats");
  const responseStats = document.getElementById("responseStats");
  const chatSummary = document.getElementById("chatSummary");

  let parsedMessages = [];
  let currentUser = "";
  let otherUser = "";
  let mediaMap = {};
  let scrollListener = null;
  let searchResults = [];
  let currentSearchIndex = 0;
  let currentSearchQuery = "";

  if (!zipInput || !goBtn || !chatContainer) return;

  zipInput.addEventListener("change", () => {
    const file = zipInput.files[0];
    fileNameSpan.textContent = file ? file.name : "";
    goBtn.disabled = !file;
  });

  toggleSidebarBtn.onclick = () => sidebar.classList.toggle("open");
  closeSidebarBtn.onclick = () => sidebar.classList.remove("open");

  dateSearch.addEventListener("change", (e) => {
    const val = e.target.value;
    const data = val ? parsedMessages.filter(m => m.date === val) : parsedMessages;
    renderChat(data, mediaMap);
    calculateAnalytics(data);
  });

  textSearch.addEventListener("input", (e) => {
    const query = e.target.value.toLowerCase().trim();
    currentSearchQuery = query;
    currentSearchIndex = 0;

    if (!query) {
      renderChat(parsedMessages, mediaMap);
      searchCount.style.display = "none";
      searchPrev.style.display = "none";
      searchNext.style.display = "none";
      searchResults = [];
      calculateAnalytics(parsedMessages);
      return;
    }

    searchResults = parsedMessages.filter(msg =>
      msg.message.toLowerCase().includes(query) ||
      msg.sender.toLowerCase().includes(query)
    );

    searchCount.textContent = `${searchResults.length} result${searchResults.length !== 1 ? 's' : ''}`;
    searchCount.style.display = "inline-block";
    
    if (searchResults.length > 0) {
      searchPrev.style.display = "flex";
      searchNext.style.display = "flex";
      renderChatWithSearch(parsedMessages, mediaMap, searchResults, 0);
      calculateAnalytics(searchResults);
    } else {
      searchPrev.style.display = "none";
      searchNext.style.display = "none";
      renderChat(parsedMessages, mediaMap);
      calculateAnalytics(parsedMessages);
    }
  });

  textSearch.addEventListener("keydown", (e) => {
    if (e.key === "Enter" && searchResults.length > 0) {
      currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
      renderChatWithSearch(parsedMessages, mediaMap, searchResults, currentSearchIndex);
      scrollToSearchResult();
    }
  });

  searchNext.onclick = () => {
    if (searchResults.length > 0) {
      currentSearchIndex = (currentSearchIndex + 1) % searchResults.length;
      renderChatWithSearch(parsedMessages, mediaMap, searchResults, currentSearchIndex);
      scrollToSearchResult();
    }
  };

  searchPrev.onclick = () => {
    if (searchResults.length > 0) {
      currentSearchIndex = (currentSearchIndex - 1 + searchResults.length) % searchResults.length;
      renderChatWithSearch(parsedMessages, mediaMap, searchResults, currentSearchIndex);
      scrollToSearchResult();
    }
  };

  function openMediaViewer(src, type, filename) {
    // Create backdrop overlay
    const overlay = document.createElement("div");
    overlay.style.cssText = `
      position: fixed;
      inset: 0;
      background: rgba(0, 0, 0, 0.95);
      z-index: 10000;
      display: flex;
      justify-content: center;
      align-items: center;
      backdrop-filter: blur(4px);
      cursor: pointer;
    `;

    // Create container for media
    const container = document.createElement("div");
    container.style.cssText = `
      position: relative;
      max-width: 90vw;
      max-height: 90vh;
      display: flex;
      align-items: center;
      justify-content: center;
    `;

    // Create media element based on type
    let mediaElement;
    if (type === "image") {
      mediaElement = document.createElement("img");
      mediaElement.src = src;
      mediaElement.style.cssText = `
        max-width: 100%;
        max-height: 90vh;
        object-fit: contain;
        border-radius: 8px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      `;
    } else if (type === "video") {
      mediaElement = document.createElement("video");
      mediaElement.src = src;
      mediaElement.controls = true;
      mediaElement.autoplay = true;
      mediaElement.style.cssText = `
        max-width: 100%;
        max-height: 90vh;
        border-radius: 8px;
        box-shadow: 0 20px 60px rgba(0, 0, 0, 0.5);
      `;
    }

    // Add filename label
    const label = document.createElement("div");
    label.textContent = filename;
    label.style.cssText = `
      position: absolute;
      bottom: -40px;
      color: white;
      font-size: 14px;
      font-weight: 500;
      text-align: center;
      max-width: 100%;
      white-space: nowrap;
      overflow: hidden;
      text-overflow: ellipsis;
      padding: 0 10px;
    `;

    // Add close button
    const closeBtn = document.createElement("button");
    closeBtn.innerHTML = "✕";
    closeBtn.style.cssText = `
      position: absolute;
      top: 20px;
      right: 20px;
      background: rgba(255, 255, 255, 0.2);
      color: white;
      border: none;
      width: 40px;
      height: 40px;
      border-radius: 50%;
      font-size: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      justify-content: center;
      transition: all 0.3s ease;
      z-index: 10001;
    `;

    closeBtn.onmouseover = () => {
      closeBtn.style.background = "rgba(255, 255, 255, 0.4)";
      closeBtn.style.transform = "scale(1.1)";
    };

    closeBtn.onmouseout = () => {
      closeBtn.style.background = "rgba(255, 255, 255, 0.2)";
      closeBtn.style.transform = "scale(1)";
    };

    // Close on button click
    closeBtn.onclick = (e) => {
      e.stopPropagation();
      overlay.remove();
    };

    // Close on background click
    overlay.onclick = () => overlay.remove();

    // Prevent closing when clicking on media
    if (mediaElement) {
      mediaElement.onclick = (e) => e.stopPropagation();
    }

    // Assemble viewer
    container.appendChild(mediaElement);
    container.appendChild(label);
    overlay.appendChild(closeBtn);
    overlay.appendChild(container);

    // Add to DOM
    document.body.appendChild(overlay);

    // Close on Escape key
    const handleEscape = (e) => {
      if (e.key === "Escape") {
        overlay.remove();
        document.removeEventListener("keydown", handleEscape);
      }
    };
    document.addEventListener("keydown", handleEscape);
  }

  function scrollToSearchResult() {
    setTimeout(() => {
      const elements = chatContainer.querySelectorAll(".search-current");
      if (elements.length > 0) {
        elements[0].scrollIntoView({ behavior: "smooth", block: "center" });
      }
    }, 100);
  }

  goBtn.addEventListener("click", async () => {
    const file = zipInput.files[0];
    if (!file) return alert("Select file");

    showLoading(true);

    try {
      let chatText = "";
      mediaMap = {};

      const ext = file.name.split('.').pop().toLowerCase();

      if (ext === "txt") {
        chatText = await file.text();
      } else if (ext === "zip") {
        const zip = await JSZip.loadAsync(file);
        const tasks = [];
        let txtLoaded = false;

        Object.entries(zip.files).forEach(([name, entry]) => {
          if (name.endsWith(".txt")) {
            tasks.push(entry.async("string").then(d => {
              if (!txtLoaded) {
                chatText = d;
                txtLoaded = true;
              }
            }));
          }
          if (/\.(jpg|png|jpeg|gif|mp4|pdf|doc|docx)$/i.test(name)) {
            tasks.push(entry.async("blob").then(b => {
              mediaMap[name.split("/").pop()] = URL.createObjectURL(b);
            }));
          }
        });

        await Promise.all(tasks);
      }

      const parsed = parseChatText(chatText);
      parsedMessages = parsed;

      const users = [...new Set(parsed.map(m => m.sender))];
      currentUser = users[0];
      otherUser = users[1] || "Unknown";

      leftUserEl.textContent = otherUser;
      rightUserEl.textContent = currentUser;

      uploadSection.classList.add("displayNone");
      chatWrapper.classList.remove("displayNone");

      renderChat(parsed, mediaMap);
      calculateAnalytics(parsed);

    } catch (e) {
      console.error(e);
      chatContainer.innerHTML = "Error reading file";
    }

    showLoading(false);
  });

  function showLoading(state) {
    loadingOverlay?.classList.toggle("displayNone", !state);
  }

  // 🔥 Robust parser (multiline + flexible format)
  function parseChatText(text) {
    const lines = text.split("\n");
    const regex = /^(\d{1,2}\/\d{1,2}\/\d{2,4}),\s(.+?)\s-\s([^:]+?):\s(.*)$/;

    const messages = [];
    let current = null;

    for (let line of lines) {
      line = line.trim();
      if (!line) continue;

      const match = line.match(regex);

      if (match) {
        if (current) messages.push(current);

        const [, date, time, sender, msg] = match;
        current = { date, time, sender: sender.trim(), message: msg.trim() };
      } else if (current) {
        current.message += "\n" + line;
      }
    }

    if (current) messages.push(current);
    return messages;
  }

  function renderChat(messages, mediaMap) {
    chatContainer.innerHTML = "";

    if (scrollListener) chatWrapper.removeEventListener("scroll", scrollListener);

    let index = 0;
    let lastDate = null;

    function chunk() {
      const frag = document.createDocumentFragment();
      const end = Math.min(index + 200, messages.length);

      for (let i = index; i < end; i++) {
        const m = messages[i];

        if (m.date !== lastDate) {
          const d = document.createElement("div");
          d.className = "date-separator";
          d.textContent = m.date;
          frag.appendChild(d);
          lastDate = m.date;
        }

        const div = document.createElement("div");
        div.className = `message ${m.sender === currentUser ? "right" : "left"}`;

        let mediaHandled = false;

        for (const filename in mediaMap) {
          if (m.message.includes(filename)) {
            mediaHandled = true;

            if (/\.(jpg|png|jpeg|gif)$/i.test(filename)) {
              const img = document.createElement("img");
              img.src = mediaMap[filename];
              img.classList.add("chat-media");
              img.style.cursor = "pointer";
              img.onclick = () => openMediaViewer(mediaMap[filename], "image", filename);
              div.appendChild(img);
            }

            else if (/\.mp4$/i.test(filename)) {
              const video = document.createElement("video");
              video.src = mediaMap[filename];
              video.controls = true;
              video.classList.add("chat-media");
              video.style.cursor = "pointer";
              video.onclick = () => openMediaViewer(mediaMap[filename], "video", filename);
              div.appendChild(video);
            }

            else if (/\.pdf$/i.test(filename)) {
              const pdfBtn = document.createElement("a");
              pdfBtn.href = mediaMap[filename];
              pdfBtn.target = "_blank";
              pdfBtn.textContent = "📄 " + filename;
              pdfBtn.style.cursor = "pointer";
              pdfBtn.style.background = "#25d366";
              pdfBtn.style.color = "white";
              pdfBtn.style.padding = "8px 12px";
              pdfBtn.style.borderRadius = "4px";
              pdfBtn.style.textDecoration = "none";
              pdfBtn.style.display = "inline-block";
              pdfBtn.style.fontWeight = "600";
              pdfBtn.style.fontSize = "13px";
              div.appendChild(pdfBtn);
            }

            break;
          }
        }

        if (!mediaHandled) {
          const span = document.createElement("span");
          
          // Handle URLs
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const hasUrl = urlRegex.test(m.message);
          
          if (hasUrl) {
            span.innerHTML = m.message.replace(
              /(https?:\/\/[^\s]+)/g,
              '<a href="$1" target="_blank" class="chat-link">$1</a>'
            );
          } else {
            span.textContent = m.message;
          }
          
          div.appendChild(span);
        }

        const time = document.createElement("div");
        time.className = "time";
        time.textContent = m.time;

        div.appendChild(time);
        frag.appendChild(div);
      }

      chatContainer.appendChild(frag);
      index = end;
    }

    chunk();

    scrollListener = () => {
      if (chatWrapper.scrollTop + chatWrapper.clientHeight >= chatWrapper.scrollHeight - 100) {
        chunk();
      }
    };

    chatWrapper.addEventListener("scroll", scrollListener);

    scrollBtn.onclick = () => chatWrapper.scrollTo({ top: chatWrapper.scrollHeight, behavior: "smooth" });
  }

  function renderChatWithSearch(allMessages, mediaMap, matchedMessages, highlightIndex) {
    chatContainer.innerHTML = "";

    if (scrollListener) chatWrapper.removeEventListener("scroll", scrollListener);

    let index = 0;
    let lastDate = null;

    function chunk() {
      const frag = document.createDocumentFragment();
      const end = Math.min(index + 200, allMessages.length);

      for (let i = index; i < end; i++) {
        const m = allMessages[i];

        if (m.date !== lastDate) {
          const d = document.createElement("div");
          d.className = "date-separator";
          d.textContent = m.date;
          frag.appendChild(d);
          lastDate = m.date;
        }

        const div = document.createElement("div");
        div.className = `message ${m.sender === currentUser ? "right" : "left"}`;

        // Check if this message is in search results
        const isMatch = matchedMessages.some(match => 
          match.date === m.date && match.time === m.time && match.message === m.message
        );
        
        if (isMatch) {
          div.classList.add("search-match");
          
          // Check if this is the current highlighted result
          if (matchedMessages[highlightIndex].date === m.date && 
              matchedMessages[highlightIndex].time === m.time && 
              matchedMessages[highlightIndex].message === m.message) {
            div.classList.add("search-current");
          }
        }

        let mediaHandled = false;

        for (const filename in mediaMap) {
          if (m.message.includes(filename)) {
            mediaHandled = true;

            if (/\.(jpg|png|jpeg|gif)$/i.test(filename)) {
              const img = document.createElement("img");
              img.src = mediaMap[filename];
              img.classList.add("chat-media");
              img.style.cursor = "pointer";
              img.onclick = () => openMediaViewer(mediaMap[filename], "image", filename);
              div.appendChild(img);
            }

            else if (/\.mp4$/i.test(filename)) {
              const video = document.createElement("video");
              video.src = mediaMap[filename];
              video.controls = true;
              video.classList.add("chat-media");
              video.style.cursor = "pointer";
              video.onclick = () => openMediaViewer(mediaMap[filename], "video", filename);
              div.appendChild(video);
            }

            else if (/\.pdf$/i.test(filename)) {
              const pdfBtn = document.createElement("a");
              pdfBtn.href = mediaMap[filename];
              pdfBtn.target = "_blank";
              pdfBtn.textContent = "📄 " + filename;
              pdfBtn.style.cursor = "pointer";
              pdfBtn.style.background = "#25d366";
              pdfBtn.style.color = "white";
              pdfBtn.style.padding = "8px 12px";
              pdfBtn.style.borderRadius = "4px";
              pdfBtn.style.textDecoration = "none";
              pdfBtn.style.display = "inline-block";
              pdfBtn.style.fontWeight = "600";
              pdfBtn.style.fontSize = "13px";
              div.appendChild(pdfBtn);
            }

            break;
          }
        }

        if (!mediaHandled) {
          const span = document.createElement("span");
          
          // Handle URLs
          const urlRegex = /(https?:\/\/[^\s]+)/g;
          const hasUrl = urlRegex.test(m.message);
          
          if (hasUrl) {
            span.innerHTML = m.message.replace(
              /(https?:\/\/[^\s]+)/g,
              '<a href="$1" target="_blank" class="chat-link">$1</a>'
            );
          } else {
            span.textContent = m.message;
          }
          
          div.appendChild(span);
        }

        const time = document.createElement("div");
        time.className = "time";
        time.textContent = m.time;

        div.appendChild(time);
        frag.appendChild(div);
      }

      chatContainer.appendChild(frag);
      index = end;
    }

    chunk();

    scrollListener = () => {
      if (chatWrapper.scrollTop + chatWrapper.clientHeight >= chatWrapper.scrollHeight - 100) {
        chunk();
      }
    };

    chatWrapper.addEventListener("scroll", scrollListener);

    scrollBtn.onclick = () => chatWrapper.scrollTo({ top: chatWrapper.scrollHeight, behavior: "smooth" });
  }

  function calculateAnalytics(messages) {
    const words = {};
    const emojis = {};
    const responses = [];

    let lastTime = null;
    let lastSender = null;

    messages.forEach(m => {
      const text = m.message.toLowerCase();

      text.split(/\s+/).forEach(w => {
        if (w.length > 2) words[w] = (words[w] || 0) + 1;
      });

      const em = text.match(/[\u{1F600}-\u{1F9FF}]/gu) || [];
      em.forEach(e => emojis[e] = (emojis[e] || 0) + 1);

      const time = parseDate(m.date, m.time);

      if (lastTime && lastSender !== m.sender) {
        const diff = Math.abs(time - lastTime) / 60000;
        if (diff > 0 && diff < 43200) responses.push(diff);
      }

      lastTime = time;
      lastSender = m.sender;
    });

    const topWords = Object.entries(words).sort((a,b)=>b[1]-a[1]).slice(0,10);
    wordStats.innerHTML = topWords.map(w=>`<div>${w[0]}: ${w[1]}</div>`).join("");

    const topEmoji = Object.entries(emojis).sort((a,b)=>b[1]-a[1]).slice(0,10);
    emojiStats.innerHTML = topEmoji.map(e=>`<div>${e[0]} ${e[1]}</div>`).join("");

    if (responses.length) {
      const avg = responses.reduce((a,b)=>a+b,0)/responses.length;
      responseStats.innerHTML = `<div>Avg: ${avg.toFixed(2)} min</div>`;
    }

    chatSummary.innerHTML = `<div>Total: ${messages.length}</div>`;
  }

  function parseDate(d,t) {
    const [day,month,year] = d.split("/").map(Number);
    const match = t.match(/(\d+):(\d+)/);
    return new Date(year,month-1,day,match[1],match[2]);
  }

});