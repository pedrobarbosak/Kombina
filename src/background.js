// Opens the KCompare page from the toolbar icon, and handles list changes requested
// by the product-page button (content scripts can't import the storage module).
import { api } from './lib/api.js';
import { addItem, addAlternative, getList } from './lib/storage.js';

// Migrates a v0.1 `basket` to the `list` format so the content script can read it.
getList();

const PAGE_URL = api.runtime.getURL('src/app/app.html');

// Focuses the existing KCompare tab if there is one, otherwise opens a new one.
async function openPage() {
  const { pageTabId } = await api.storage.session.get('pageTabId');
  if (pageTabId != null) {
    try {
      const tab = await api.tabs.get(pageTabId);
      // Without the "tabs" permission Chrome may hide tab.url; trust the stored id then.
      if (!tab.url || tab.url.startsWith(PAGE_URL)) {
        await api.tabs.update(tab.id, { active: true });
        await api.windows.update(tab.windowId, { focused: true });
        return;
      }
    } catch {
      // Tab was closed.
    }
  }
  const tab = await api.tabs.create({ url: PAGE_URL });
  await api.storage.session.set({ pageTabId: tab.id });
}

api.action.onClicked.addListener(() => openPage());

const handlers = {
  'add-item': (m) => addItem(m.product),
  'add-alternative': (m) => addAlternative(m.gid, m.product),
  'open-page': () => openPage(),
};

// sendResponse + `return true` works in both Chrome and Firefox (returning a promise doesn't in older Chrome).
api.runtime.onMessage.addListener((message, _sender, sendResponse) => {
  const handler = handlers[message?.type];
  if (!handler) return false;
  handler(message).then(
    () => sendResponse({ ok: true }),
    (error) => sendResponse({ ok: false, error: String(error) }),
  );
  return true;
});
