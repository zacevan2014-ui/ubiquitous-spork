const searchForm = document.getElementById('search-form');
const searchInput = document.getElementById('search-input');
const topicsBar = document.getElementById('topics-bar');
const feed = document.getElementById('feed');

searchForm.addEventListener('submit', (e) => {
  e.preventDefault();
  const query = searchInput.value.trim();
  if (query) {
    clearActiveChips();
    performSearch(query);
  }
});

// Event delegation for header chips & recommended grid cards
document.addEventListener('click', (e) => {
  const targetCard = e.target.closest('.topic-card');
  const targetChip = e.target.closest('.chip');

  if (targetCard) {
    const query = targetCard.getAttribute('data-query');
    searchInput.value = query;
    performSearch(query);
  } else if (targetChip) {
    clearActiveChips();
    targetChip.classList.add('active');
    const query = targetChip.getAttribute('data-query');
    searchInput.value = query;
    performSearch(query);
  }
});

function clearActiveChips() {
  document.querySelectorAll('.chip').forEach(chip => chip.classList.remove('active'));
}

async function performSearch(query) {
  feed.innerHTML = '<div class="state-message">Searching...</div>';

  try {
    let results = await fetchDuckDuckGo(query);

    if (results.length === 0) {
      results = await fetchWikipedia(query);
    }

    renderResults(results);
  } catch (error) {
    console.error('Search error:', error);
    feed.innerHTML = '<div class="state-message">An error occurred while fetching results. Please try again.</div>';
  }
}

// Fetch via DuckDuckGo JSONP (bypasses CORS completely)
function fetchDuckDuckGo(query) {
  return new Promise((resolve) => {
    const callbackName = 'ddg_cb_' + Math.round(100000 * Math.random());
    const script = document.createElement('script');

    window[callbackName] = (data) => {
      delete window[callbackName];
      document.body.removeChild(script);

      const items = [];

      if (data.AbstractText && data.AbstractURL) {
        items.push({
          title: data.Heading || query,
          url: data.AbstractURL,
          snippet: data.AbstractText
        });
      }

      if (data.RelatedTopics && data.RelatedTopics.length > 0) {
        data.RelatedTopics.forEach(topic => {
          if (topic.Text && topic.FirstURL) {
            items.push({
              title: topic.Text.split(' - ')[0] || topic.Text,
              url: topic.FirstURL,
              snippet: topic.Text
            });
          }
        });
      }

      resolve(items);
    };

    script.onerror = () => {
      delete window[callbackName];
      if (script.parentNode) document.body.removeChild(script);
      resolve([]);
    };

    script.src = `https://api.duckduckgo.com/?q=${encodeURIComponent(query)}&format=json&callback=${callbackName}`;
    document.body.appendChild(script);
  });
}

// Wikipedia API Fallback
async function fetchWikipedia(query) {
  const url = `https://en.wikipedia.org/w/api.php?action=query&list=search&srsearch=${encodeURIComponent(query)}&utf8=&format=json&origin=*`;
  const response = await fetch(url);
  const data = await response.json();

  if (!data.query || !data.query.search) return [];

  return data.query.search.map(item => ({
    title: item.title,
    url: `https://en.wikipedia.org/?curid=${item.pageid}`,
    snippet: stripHtml(item.snippet) + '...'
  }));
}

function renderResults(results) {
  feed.innerHTML = '';

  if (results.length === 0) {
    feed.innerHTML = '<div class="state-message">No results found. Try another term.</div>';
    return;
  }

  results.forEach(item => {
    const card = document.createElement('a');
    card.className = 'result-card';
    card.href = item.url;
    card.target = '_blank';
    card.rel = 'noopener noreferrer';

    card.innerHTML = `
      <div class="result-url">${escapeHtml(item.url)}</div>
      <h2 class="result-title">${escapeHtml(item.title)}</h2>
      <div class="result-snippet">${escapeHtml(item.snippet)}</div>
    `;

    feed.appendChild(card);
  });
}

function stripHtml(html) {
  const tmp = document.createElement('DIV');
  tmp.innerHTML = html;
  return tmp.textContent || tmp.innerText || '';
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
