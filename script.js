const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const sortSelect = document.getElementById('sort-select');
const topicsBar = document.getElementById('topics-bar');
const feed = document.getElementById('feed');
const loadingSentinel = document.getElementById('loading-sentinel');

let currentQuery = '';
let currentSort = 'relevance';
let afterToken = null;
let isLoading = false;
let hasMore = true;

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    clearActiveChips();
    initiateSearch(query, sortSelect.value);
  }
});

topicsBar.addEventListener('click', (e) => {
  if (e.target.classList.contains('chip')) {
    clearActiveChips();
    e.target.classList.add('active');
    const query = e.target.getAttribute('data-query');
    searchInput.value = query;
    initiateSearch(query, sortSelect.value);
  }
});

sortSelect.addEventListener('change', () => {
  if (currentQuery) {
    initiateSearch(currentQuery, sortSelect.value);
  }
});

function clearActiveChips() {
  document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
}

function initiateSearch(query, sort) {
  currentQuery = query;
  currentSort = sort;
  afterToken = null;
  hasMore = true;
  feed.innerHTML = '';
  fetchRedditPosts();
}

async function fetchRedditPosts() {
  if (isLoading || !hasMore) return;
  isLoading = true;

  if (!afterToken) {
    feed.innerHTML = '<div class="state-message">Loading results...</div>';
  }

  try {
    let redditUrl = '';
    
    // Support direct r/subreddit searching vs general search
    if (currentQuery.startsWith('r/')) {
      const sub = currentQuery.replace('r/', '');
      redditUrl = `https://www.reddit.com/r/${encodeURIComponent(sub)}/${currentSort}.json?limit=15`;
    } else {
      redditUrl = `https://www.reddit.com/search.json?q=${encodeURIComponent(currentQuery)}&sort=${currentSort}&limit=15`;
    }

    if (afterToken) {
      redditUrl += `&after=${afterToken}`;
    }

    // Bypass CORS and rate limiting using corsproxy.io
    const proxyUrl = `https://corsproxy.io/?${encodeURIComponent(redditUrl)}`;

    const response = await fetch(proxyUrl);
    if (!response.ok) throw new Error(`HTTP error: ${response.status}`);

    const data = await response.json();
    const posts = data.data?.children || [];

    if (!afterToken) feed.innerHTML = ''; // Clear loading message

    if (posts.length === 0 && !afterToken) {
      feed.innerHTML = '<div class="state-message">No results found. Try another term.</div>';
      hasMore = false;
      isLoading = false;
      return;
    }

    afterToken = data.data?.after || null;
    if (!afterToken) hasMore = false;

    renderPosts(posts);
  } catch (error) {
    if (!afterToken) {
      feed.innerHTML = `<div class="state-message">Unable to fetch posts. Please check your connection or try another topic.</div>`;
    }
    console.error('Fetch error:', error);
  } finally {
    isLoading = false;
  }
}

function renderPosts(posts) {
  posts.forEach(({ data }) => {
    const postEl = document.createElement('a');
    postEl.className = 'post-card';
    postEl.href = `https://reddit.com${data.permalink}`;
    postEl.target = '_blank';
    postEl.rel = 'noopener noreferrer';

    const mediaHtml = getMediaHtml(data);
    const textPreviewHtml = getTextPreviewHtml(data);

    postEl.innerHTML = `
      <div class="meta">
        <span class="subreddit">r/${data.subreddit}</span>
        <span>•</span>
        <span>u/${data.author}</span>
      </div>
      <h2 class="title">${escapeHtml(data.title)}</h2>
      ${textPreviewHtml}
      ${mediaHtml}
      <div class="footer">
        <span>▲ ${formatNumber(data.score)} points</span>
        <span>💬 ${formatNumber(data.num_comments)} comments</span>
      </div>
    `;

    feed.appendChild(postEl);
  });
}

function getTextPreviewHtml(data) {
  if (data.selftext && data.selftext.trim().length > 0) {
    const truncated = data.selftext.length > 200 ? data.selftext.substring(0, 200) + '...' : data.selftext;
    return `<div class="selftext">${escapeHtml(truncated)}</div>`;
  }
  return '';
}

function getMediaHtml(data) {
  const isDirectImage = /\.(jpg|jpeg|png|gif)$/i.test(data.url);
  if (isDirectImage) {
    return `
      <div class="media-container">
        <img src="${data.url}" alt="" loading="lazy" onError="this.parentNode.remove()">
      </div>
    `;
  }
  return '';
}

function formatNumber(num) {
  return num >= 1000 ? (num / 1000).toFixed(1) + 'k' : num;
}

function escapeHtml(str) {
  if (!str) return '';
  return str.replace(/[&<>"']/g, (m) => ({
    '&': '&amp;',
    '<': '&lt;',
    '>': '&gt;',
    '"': '&quot;',
    "'": '&#039;'
  }[m]));
}

// Infinite scroll observer
const observer = new IntersectionObserver((entries) => {
  if (entries[0].isIntersecting && currentQuery && !isLoading && hasMore) {
    fetchRedditPosts();
  }
}, { rootMargin: '200px' });

observer.observe(loadingSentinel);
