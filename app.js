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

  // Analytics elements
  const wordStats = document.getElementById("wordStats");
  const emojiStats = document.getElementById("emojiStats");
  const responseStats = document.getElementById("responseStats");
  const chatSummary = document.getElementById("chatSummary");

  let parsedMessages = [];
  let currentUser = "";
  let otherUser = "";

  if (!zipInput || !goBtn || !chatContainer) return;

  /* ---------------- FILE NAME SHOW ---------------- */

  zipInput.addEventListener("change", () => {
    const file = zipInput.files[0];
    fileNameSpan.textContent = file ? file.name : "";
  });

  /* ---------------- SIDEBAR TOGGLE ---------------- */

  toggleSidebarBtn.addEventListener("click", () => {
    sidebar.classList.toggle("open");
  });

  closeSidebarBtn.addEventListener("click", () => {
    sidebar.classList.remove("open");
  });

  /* ---------------- DATE SEARCH ---------------- */

  dateSearch.addEventListener("change", (e) => {
    const selectedDate = e.target.value;
    if (!selectedDate) {
      renderChat(parsedMessages, {});
      return;
    }

    const filteredMessages = parsedMessages.filter(msg => msg.date === selectedDate);
    renderChat(filteredMessages, {});
  });

  /* ---------------- LOAD BUTTON ---------------- */

  goBtn.addEventListener("click", async () => {

    const file = zipInput.files[0];
    if (!file) {
      alert("Please select a ZIP file first.");
      return;
    }

    showLoading(true);

    try {

      const zip = await JSZip.loadAsync(file);

      let chatText = "";
      const mediaMap = {};
      const tasks = [];

      Object.keys(zip.files).forEach(filename => {

        const entry = zip.files[filename];

        if (filename.toLowerCase().endsWith(".txt")) {
          tasks.push(
            entry.async("string").then(data => {
              chatText = data;
            })
          );
        }

        if (/\.(jpg|jpeg|png|gif|mp4|pdf|doc|docx)$/i.test(filename)) {
          tasks.push(
            entry.async("blob").then(blob => {
              const cleanName = filename.split("/").pop();
              mediaMap[cleanName] = URL.createObjectURL(blob);
            })
          );
        }

      });

      await Promise.all(tasks);

      if (!chatText) {
        chatContainer.innerHTML = "Chat text file not found.";
        showLoading(false);
        return;
      }

      const parsed = parseChatText(chatText);
      parsedMessages = parsed;

      // Determine users
      const users = Array.from(new Set(parsed.map(m => m.sender)));
      currentUser = users[0] || "";
      otherUser = users[1] || "";

      uploadSection.classList.add("displayNone");
      chatWrapper.classList.remove("displayNone");

      renderChat(parsedMessages, mediaMap);
      calculateAnalytics(parsedMessages);

    } catch (err) {
      console.error(err);
      chatContainer.innerHTML = "Error reading ZIP file.";
    }

    showLoading(false);
  });

  /* ---------------- LOADING ---------------- */

  function showLoading(state) {
    if (!loadingOverlay) return;
    loadingOverlay.classList.toggle("displayNone", !state);
  }

  /* ---------------- CHAT PARSING ---------------- */

  function parseChatText(text) {
    text = text.replace(/\u202F/g, " ");
    const lines = text.split("\n");

    const regex =
      /^(\d{1,2}\/\d{1,2}\/\d{4}),\s(.+?)\s-\s(.*?):\s([\s\S]*)$/;

    const parsed = [];
    const userSet = new Set();

    for (const line of lines) {
      const match = line.match(regex);
      if (!match) continue;

      const [, date, time, senderRaw, message] = match;
      const sender = senderRaw.trim();

      userSet.add(sender);
      parsed.push({ date, time, sender, message });
    }

    return parsed;
  }

  /* ---------------- CHAT RENDER ---------------- */

  function renderChat(messages, mediaMap) {

    chatContainer.innerHTML = "";
    chatWrapper.scrollTop = 0;

    if (!messages || messages.length === 0) {
      chatContainer.innerHTML = "No messages to display.";
      return;
    }

    const parsed = messages;
    let lastDate = null;

    /* -------- CHUNK SYSTEM -------- */

    const CHUNK_SIZE = 200;
    let index = 0;

    function renderChunk() {

      if (index >= parsed.length) return;

      const fragment = document.createDocumentFragment();
      const end = Math.min(index + CHUNK_SIZE, parsed.length);

      for (let i = index; i < end; i++) {

        const { date, time, sender, message } = parsed[i];

        if (date !== lastDate) {
          const dateDiv = document.createElement("div");
          dateDiv.className = "date-separator";
          dateDiv.textContent = date;
          fragment.appendChild(dateDiv);
          lastDate = date;
        }

        const side = sender === currentUser ? "right" : "left";

        const msgDiv = document.createElement("div");
        msgDiv.className = `message ${side}`;

        let mediaHandled = false;

        for (const filename in mediaMap) {

          if (message.includes(filename)) {

            mediaHandled = true;

            if (/\.(jpg|jpeg|png|gif)$/i.test(filename)) {
              const img = document.createElement("img");
              img.src = mediaMap[filename];
              img.classList.add("chat-media");
              img.onclick = () => openViewer(mediaMap[filename], "image");
              msgDiv.appendChild(img);
            }

            else if (/\.mp4$/i.test(filename)) {
              const video = document.createElement("video");
              video.src = mediaMap[filename];
              video.classList.add("chat-media");
              video.onclick = () => openViewer(mediaMap[filename], "video");
              msgDiv.appendChild(video);
            }

            else if (/\.pdf$/i.test(filename)) {
              const btn = document.createElement("button");
              btn.textContent = "View PDF";
              btn.onclick = () => openViewer(mediaMap[filename], "pdf");
              msgDiv.appendChild(btn);
            }

            break;
          }
        }

        if (!mediaHandled) {
          const textNode = document.createElement("div");
          textNode.innerHTML = message.replace(
            /(https?:\/\/[^\s]+)/g,
            url => `<a href="${url}" target="_blank">${url}</a>`
          );
          msgDiv.appendChild(textNode);
        }

        const timeDiv = document.createElement("div");
        timeDiv.className = "time";
        timeDiv.textContent = time;

        msgDiv.appendChild(timeDiv);
        fragment.appendChild(msgDiv);
      }

      chatContainer.appendChild(fragment);
      index = end;
    }

    renderChunk();

    /* -------- SCROLL LAZY LOAD -------- */

    chatWrapper.addEventListener("scroll", () => {
      if (chatWrapper.scrollTop + chatWrapper.clientHeight >= chatWrapper.scrollHeight - 100) {
        renderChunk();
      }
    });

    /* -------- SCROLL BUTTON -------- */

    if (scrollBtn) {
      scrollBtn.onclick = () => {
        chatWrapper.scrollTo({
          top: chatWrapper.scrollHeight,
          behavior: "smooth"
        });
      };
    }
  }

  /* ---------------- ANALYTICS CALCULATION ---------------- */

  function calculateAnalytics(messages) {
    if (!messages || messages.length === 0) return;

    // Word frequency
    const wordCount = {};
    const emojiCount = {};
    const responseTimes = [];
    let lastMessageTime = null;
    let lastSender = null;

    messages.forEach(msg => {
      const text = msg.message.toLowerCase();

      // Count words
      const words = text.split(/\s+/).filter(word => word.length > 2);
      words.forEach(word => {
        wordCount[word] = (wordCount[word] || 0) + 1;
      });

      // Count emojis
      const emojis = text.match(/[\u{1F600}-\u{1F64F}]|[\u{1F300}-\u{1F5FF}]|[\u{1F680}-\u{1F6FF}]|[\u{1F1E0}-\u{1F1FF}]|[\u{2600}-\u{26FF}]|[\u{2700}-\u{27BF}]/gu) || [];
      emojis.forEach(emoji => {
        emojiCount[emoji] = (emojiCount[emoji] || 0) + 1;
      });

      // Calculate response times
      if (lastMessageTime && lastSender && lastSender !== msg.sender) {
        const currentTime = new Date(`${msg.date} ${msg.time}`);
        const timeDiff = (currentTime - lastMessageTime) / 1000 / 60; // minutes
        if (timeDiff < 60) { // Only count responses within 1 hour
          responseTimes.push(timeDiff);
        }
      }

      lastMessageTime = new Date(`${msg.date} ${msg.time}`);
      lastSender = msg.sender;
    });

    // Display word stats
    const topWords = Object.entries(wordCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    wordStats.innerHTML = topWords.map(([word, count]) => `<div>${word}: ${count}</div>`).join('');

    // Display emoji stats
    const topEmojis = Object.entries(emojiCount)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 10);
    emojiStats.innerHTML = topEmojis.map(([emoji, count]) => `<div>${emoji}: ${count}</div>`).join('');

    // Display response times
    if (responseTimes.length > 0) {
      const avgResponse = responseTimes.reduce((a, b) => a + b, 0) / responseTimes.length;
      const fastestResponse = Math.min(...responseTimes);
      const slowestResponse = Math.max(...responseTimes);
      responseStats.innerHTML = `
        <div>Average: ${avgResponse.toFixed(1)} min</div>
        <div>Fastest: ${fastestResponse.toFixed(1)} min</div>
        <div>Slowest: ${slowestResponse.toFixed(1)} min</div>
      `;
    } else {
      responseStats.innerHTML = '<div>No response data available</div>';
    }

    // Chat summary
    const totalMessages = messages.length;
    const uniqueDates = new Set(messages.map(m => m.date)).size;
    const userMessages = {};
    messages.forEach(msg => {
      userMessages[msg.sender] = (userMessages[msg.sender] || 0) + 1;
    });

    chatSummary.innerHTML = `
      <div>Total Messages: ${totalMessages}</div>
      <div>Chat Duration: ${uniqueDates} days</div>
      <div>${currentUser}: ${userMessages[currentUser] || 0} messages</div>
      <div>${otherUser}: ${userMessages[otherUser] || 0} messages</div>
    `;
  }

  /* ---------------- MEDIA VIEWER ---------------- */

  function openViewer(src, type) {

    let viewer = document.getElementById("mediaViewer");

    if (!viewer) {
      viewer = document.createElement("div");
      viewer.id = "mediaViewer";
      viewer.style.position = "fixed";
      viewer.style.inset = "0";
      viewer.style.background = "rgba(0,0,0,0.9)";
      viewer.style.display = "flex";
      viewer.style.alignItems = "center";
      viewer.style.justifyContent = "center";
      viewer.style.zIndex = "9999";
      viewer.onclick = () => viewer.remove();
      document.body.appendChild(viewer);
    }

    viewer.innerHTML = "";

    if (type === "image") {
      const img = document.createElement("img");
      img.src = src;
      img.style.maxWidth = "90%";
      img.style.maxHeight = "90%";
      viewer.appendChild(img);
    }

    else if (type === "video") {
      const video = document.createElement("video");
      video.src = src;
      video.controls = true;
      video.autoplay = true;
      video.style.maxWidth = "90%";
      video.style.maxHeight = "90%";
      viewer.appendChild(video);
    }

    else if (type === "pdf") {
      const iframe = document.createElement("iframe");
      iframe.src = src;
      iframe.style.width = "80%";
      iframe.style.height = "90%";
      viewer.appendChild(iframe);
    }
  }

});
