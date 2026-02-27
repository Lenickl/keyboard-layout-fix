chrome.runtime.onInstalled.addListener(async () => {
    // ===== Context Menu =====
    await chrome.contextMenus.create({
      id: "reportInput",
      title: "Report input field",
      type: 'normal',
      contexts: ['editable']
    });

    await chrome.contextMenus.create({
      id: "exclude",
      title: "Autocorrection",
      type: 'normal',
      contexts: ['page']
    });

    await chrome.contextMenus.create({
      id: "exclude-all",
      parentId: "exclude",
      title: "Disable auto correction",
      type: 'checkbox',
      contexts: ['page']
    });

    await chrome.contextMenus.create({
      id: "exclude-this",
      parentId: "exclude",
      title: "Exclude from auto correction",
      type: 'checkbox',
      contexts: ['page']
    });

    // ===== Storage =====
    await chrome.storage.sync.set({
        excluded_urls: {},
        auto_correction: true
    });
});


async function updateCorrectionMenu(tab) {
    if (!tab?.url) return;

    const hostname = new URL(tab.url).hostname;

    const { excluded_urls, auto_correction } =
        await chrome.storage.sync.get(["excluded_urls", "auto_correction"]);

    const excluded = excluded_urls || {};

    await chrome.contextMenus.update("exclude-this", {
        checked: Boolean(excluded[hostname])
    });

    await chrome.contextMenus.update("exclude-all", {
        checked: !auto_correction
    });

    chrome.contextMenus.refresh?.();
}

// ===== Context Menu =====
chrome.contextMenus.onClicked.addListener((item, tab) => {
    let url = new URL(tab.url);

    if (item.menuItemId === "reportInput") {
        console.log(Date.now(), url.hostname);
        return;
    }

    if (item.menuItemId === "exclude-this") {
        chrome.storage.sync.get(["excluded_urls"]).then( async (result) => {
            const map = result.excluded_urls || {};
            
            if (!map[url.hostname]) map[url.hostname] = true;
            else map[url.hostname] = false;
            
            await chrome.storage.sync.set({ excluded_urls: map });

            chrome.tabs.query({url: `*${url.hostname}*`}, async (tabs) => {
                for (const tab of tabs)
                    chrome.tabs.sendMessage(tab.id, {type: "update", value: !map[url.hostname]});                         
            });

        });

        return;
    }

    if (item.menuItemId === "exclude-all") { 
        chrome.storage.sync.get(["auto_correction"]).then( async (result) => {
            const value = result.auto_correction;

            await chrome.storage.sync.set({auto_correction : !value});

            chrome.tabs.query({ }, async (tabs) => {
                for (const tab of tabs) 
                    chrome.tabs.sendMessage(tab.id, {type: "update", value: !value});                         
            });

        });
        return;
    }
    
});

chrome.tabs.onActivated.addListener(async info => {
    const tab = await chrome.tabs.get(info.tabId);
    updateCorrectionMenu(tab);
});

chrome.tabs.onUpdated.addListener((tabId, changeInfo, tab) => {
    if (changeInfo.url || changeInfo.status === "complete") {
        updateCorrectionMenu(tab);
    }
});

// ===== Commands =====
chrome.commands.onCommand.addListener((command) => {
    if (command !== "run-content-script") return;

    chrome.tabs.query({ active: true, currentWindow: true }, async (tabs) => {
        const tab = tabs[0];
        if (!tab?.id) return;

        chrome.tabs.sendMessage(tab.id, {type: "convert"});
        
    });

});