// ヘルパー関数
function getRandomElement(arr) {
  return arr[Math.floor(Math.random() * arr.length)];
}

function shuffleArray(array) {
  for (let i = array.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1));
    [array[i], array[j]] = [array[j], array[i]];
  }
  return array;
}

function randomScroll(tabId) {
  console.log(`Scrolling tab: ${tabId}`);
  return new Promise((resolve, reject) => {
    chrome.scripting.executeScript(
      {
        target: { tabId: tabId },
        func: () => {
          console.log("Executing scroll script");
          window.scrollTo(0, Math.random() * document.body.scrollHeight);
        },
      },
      (results) => {
        if (chrome.runtime.lastError) {
          console.error(
            `Error scrolling tab ${tabId}: ${chrome.runtime.lastError.message}`
          );
          reject(chrome.runtime.lastError.message);
        } else {
          console.log(`Scrolled tab: ${tabId}`);
          resolve();
        }
      }
    );
  });
}

// タブをランダムに閉じる
function closeRandomTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      if (tabs.length === 0 || tabs.length <= tabLimitMin) return resolve();

      const randomRemoveTab = getRandomElement(tabs);
      if (Math.random() < 0.5) {
        chrome.tabs.remove(randomRemoveTab.id, resolve);
      } else {
        resolve();
      }
    });
  });
}

// 履歴から新しいタブを開くが、すでに開いているタブはスキップ
function openNewTabFromHistory() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      if (tabs.length >= tabLimitMax) return resolve();

      chrome.history.search({ text: "", maxResults: 20 }, (historyItems) => {
        if (historyItems.length > 0) {
          let lst = shuffleArray([...historyItems]);
          let newTabUrl = null;

          for (let item of lst) {
            let isAlreadyOpen = tabs.some((tab) => tab.url === item.url);
            if (!isAlreadyOpen) {
              newTabUrl = item.url;
              break;
            }
          }

          if (newTabUrl) {
            chrome.tabs.create({ url: newTabUrl }, resolve);
          } else {
            resolve();
          }
        } else {
          resolve();
        }
      });
    });
  });
}

// ランダムにアクティブタブを変更
function changeActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({}, (tabs) => {
      if (tabs.length === 0) return resolve();

      const randomActiveTab = getRandomElement(tabs);
      chrome.tabs.update(randomActiveTab.id, { active: true }, resolve);
    });
  });
}

// アクティブタブをスクロール
function scrollActiveTab() {
  return new Promise((resolve, reject) => {
    chrome.tabs.query({ active: true, currentWindow: true }, (tabs) => {
      if (tabs.length === 0) return resolve();

      const activeTab = tabs[0];
      randomScroll(activeTab.id).then(resolve).catch(reject);
    });
  });
}

// タイマーID
let openTabIntervalId,
  closeTabIntervalId,
  changeTabIntervalId,
  scrollActiveTabIntervalId;

// インターバル時間（ミリ秒）
const openTabInterval = 1000 * 60;
const closeTabInterval = 1000 * 60;
const changeTabInterval = 1000 * 30;
const scrollActiveTabInterval = 1000 * 5;

// タブの上限と下限
const tabLimitMin = 5;
const tabLimitMax = 10;

// シリアルに処理を行う関数
async function handleTabOperations() {
  try {
    await openNewTabFromHistory();
    await closeRandomTab();
    await changeActiveTab();
    await scrollActiveTab();
  } catch (error) {
    console.error("Error handling tab operations: ", error);
  }
}

chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.command === "start") {
    if (!openTabIntervalId) {
      openTabIntervalId = setInterval(openNewTabFromHistory, openTabInterval);
    }
    if (!closeTabIntervalId) {
      closeTabIntervalId = setInterval(closeRandomTab, closeTabInterval);
    }
    if (!changeTabIntervalId) {
      changeTabIntervalId = setInterval(changeActiveTab, changeTabInterval);
    }
    if (!scrollActiveTabIntervalId) {
      scrollActiveTabIntervalId = setInterval(
        scrollActiveTab,
        scrollActiveTabInterval
      );
    }
    if (!operationIntervalId) {
      operationIntervalId = setInterval(handleTabOperations, 1000); // 1秒ごとにタブ操作をシリアルに実行
    }
  } else if (message.command === "stop") {
    clearInterval(openTabIntervalId);
    openTabIntervalId = null;
    clearInterval(closeTabIntervalId);
    closeTabIntervalId = null;
    clearInterval(changeTabIntervalId);
    changeTabIntervalId = null;
    clearInterval(scrollActiveTabIntervalId);
    scrollActiveTabIntervalId = null;
    clearInterval(operationIntervalId);
    operationIntervalId = null;
  }
});
