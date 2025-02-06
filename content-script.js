(function() {
  if (window.__timeWarnerContentScriptInjected) return;
  window.__timeWarnerContentScriptInjected = true;

  console.log("[TimeWarner] Content script loaded on Twitter.");

  const overlay = document.createElement("div");
  overlay.id = "timeWarnerOverlay";
  Object.assign(overlay.style, {
    position: "fixed",
    top: "0",
    left: "0",
    width: "100%",
    height: "100%",
    backgroundColor: "rgba(255,0,0,0.8)",
    color: "#fff",
    display: "none",
    justifyContent: "center",
    alignItems: "center",
    fontSize: "24px",
    zIndex: 99999999,
    textAlign: "center",
    padding: "50px"
  });
  overlay.innerHTML = `<div>
    <h1>警告</h1>
    <p>連続閲覧時間が閾値を超えました。休憩しましょう！</p>
    <button id="timeWarnerCloseBtn" style="
      margin-top: 20px; 
      font-size: 18px; 
      padding: 8px 16px;
      cursor: pointer;
    ">閉じる</button>
  </div>`;

  document.body.appendChild(overlay);

  const closeBtn = document.getElementById("timeWarnerCloseBtn");
  closeBtn.addEventListener("click", () => {
    overlay.style.display = "none";
  });

  chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    if (message.type === "TIME_EXCEEDED") {
      console.log("[TimeWarner] TIME_EXCEEDED message received");
      overlay.style.display = "flex";
    }
  });
})(); 