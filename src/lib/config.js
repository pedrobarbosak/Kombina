// Public repository that holds data/stores.json. Leave empty until the repo exists:
// with it set, the page refreshes the shipping rules from GitHub once a day and
// offers a "suggest a correction" link that opens a prefilled issue.
export const GITHUB_REPO = ''; // e.g. 'owner/kombina'
export const GITHUB_BRANCH = 'main';
export const STORES_PATH = 'data/stores.json';

export const remoteStoresUrl = () =>
  GITHUB_REPO ? `https://raw.githubusercontent.com/${GITHUB_REPO}/${GITHUB_BRANCH}/${STORES_PATH}` : null;

export const storesFileUrl = () => (GITHUB_REPO ? `https://github.com/${GITHUB_REPO}/blob/${GITHUB_BRANCH}/${STORES_PATH}` : null);

export const issueUrl = (title, body) =>
  GITHUB_REPO
    ? `https://github.com/${GITHUB_REPO}/issues/new?title=${encodeURIComponent(title)}&body=${encodeURIComponent(body)}`
    : null;
