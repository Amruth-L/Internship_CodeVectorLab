/* ========================================
   ProductVault — Frontend Application
   ======================================== */

const API_BASE = '';

// State
let currentCursor = null;
let isLoading = false;
let allProducts = [];
let searchDebounceTimer = null;

// DOM Elements
const searchInput = document.getElementById('searchInput');
const clearSearchBtn = document.getElementById('clearSearch');
const categoryFilter = document.getElementById('categoryFilter');
const sortBy = document.getElementById('sortBy');
const sortOrder = document.getElementById('sortOrder');
const productsGrid = document.getElementById('productsGrid');
const skeletonGrid = document.getElementById('skeletonGrid');
const emptyState = document.getElementById('emptyState');
const loadMoreContainer = document.getElementById('loadMoreContainer');
const loadMoreBtn = document.getElementById('loadMoreBtn');
const headerStats = document.getElementById('headerStats');
const activeFilters = document.getElementById('activeFilters');
const resetFiltersBtn = document.getElementById('resetFilters');

// ========================================
// Initialize
// ========================================

async function init() {
  await loadCategories();
  await fetchProducts(true);
  bindEvents();
}

// ========================================
// Load Categories into Dropdown
// ========================================

async function loadCategories() {
  try {
    const res = await fetch(`${API_BASE}/api/categories`);
    const { categories } = await res.json();

    categories.forEach(cat => {
      const option = document.createElement('option');
      option.value = cat;
      option.textContent = cat;
      categoryFilter.appendChild(option);
    });
  } catch (err) {
    console.error('Failed to load categories:', err);
  }
}

// ========================================
// Fetch Products from API
// ========================================

async function fetchProducts(reset = false) {
  if (isLoading) return;
  isLoading = true;

  if (reset) {
    currentCursor = null;
    allProducts = [];
    productsGrid.innerHTML = '';
    skeletonGrid.classList.remove('hidden');
    emptyState.classList.add('hidden');
    loadMoreContainer.classList.add('hidden');
  } else {
    showLoadingButton(true);
  }

  const params = new URLSearchParams({
    limit: '20'
  });

  const search = searchInput.value.trim();
  if (search) params.append('search', search);

  const category = categoryFilter.value;
  if (category) params.append('category', category);

  params.append('sortBy', sortBy.value);
  params.append('sortOrder', sortOrder.value);

  if (currentCursor) params.append('cursor', currentCursor);

  try {
    const res = await fetch(`${API_BASE}/api/products?${params.toString()}`);
    const json = await res.json();

    const { data, pagination } = json;

    // Append products
    allProducts = allProducts.concat(data);
    renderProducts(data, !reset);
    currentCursor = pagination.next_cursor;

    // Update stats
    updateStats();

    // Toggle load more button
    if (pagination.has_more) {
      loadMoreContainer.classList.remove('hidden');
    } else {
      loadMoreContainer.classList.add('hidden');
    }

    // Handle empty state
    if (allProducts.length === 0) {
      emptyState.classList.remove('hidden');
    } else {
      emptyState.classList.add('hidden');
    }

  } catch (err) {
    console.error('Error fetching products:', err);
  } finally {
    isLoading = false;
    skeletonGrid.classList.add('hidden');
    showLoadingButton(false);
  }
}

// ========================================
// Render Products
// ========================================

function renderProducts(products, append = false) {
  const fragment = document.createDocumentFragment();

  products.forEach((product, i) => {
    const card = document.createElement('article');
    card.className = 'product-card';
    card.style.animationDelay = `${i * 30}ms`;

    const categoryClass = getCategoryClass(product.category);
    const formattedPrice = formatPrice(product.price);
    const shortId = product.id.split('-')[0];
    const dateAdded = formatDate(product.created_at);

    card.innerHTML = `
      <div class="product-card-header">
        <span class="product-category ${categoryClass}">${escapeHtml(product.category)}</span>
        <span class="product-price">$${formattedPrice}</span>
      </div>
      <h3 class="product-name">${escapeHtml(product.name)}</h3>
      <div class="product-meta">
        <span class="product-meta-item">
          <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><rect x="3" y="4" width="18" height="18" rx="2" ry="2"/><line x1="16" y1="2" x2="16" y2="6"/><line x1="8" y1="2" x2="8" y2="6"/><line x1="3" y1="10" x2="21" y2="10"/></svg>
          ${dateAdded}
        </span>
      </div>
      <span class="product-id">#${shortId}</span>
    `;

    fragment.appendChild(card);
  });

  if (append) {
    productsGrid.appendChild(fragment);
  } else {
    productsGrid.innerHTML = '';
    productsGrid.appendChild(fragment);
  }
}

// ========================================
// Category Styling
// ========================================

function getCategoryClass(category) {
  if (category.includes('Furniture')) return 'category-furniture';
  if (category.includes('Electronics')) return 'category-electronics';
  if (category.includes('Desk')) return 'category-desk';
  if (category.includes('Stationery')) return 'category-stationery';
  if (category.includes('Kitchenware')) return 'category-kitchenware';
  return 'category-desk';
}

// ========================================
// UI Helpers
// ========================================

function formatPrice(price) {
  return parseFloat(price).toFixed(2);
}

function formatDate(isoString) {
  const date = new Date(isoString);
  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  });
}

function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}

function showLoadingButton(loading) {
  const text = loadMoreBtn.querySelector('.load-more-text');
  const spinner = loadMoreBtn.querySelector('.load-more-spinner');
  if (loading) {
    text.textContent = 'Loading...';
    spinner.classList.remove('hidden');
    loadMoreBtn.disabled = true;
  } else {
    text.textContent = 'Load More Products';
    spinner.classList.add('hidden');
    loadMoreBtn.disabled = false;
  }
}

function updateStats() {
  headerStats.innerHTML = `<span class="stats-pill">${allProducts.length.toLocaleString()} products loaded</span>`;
}

function updateActiveFilters() {
  activeFilters.innerHTML = '';
  const search = searchInput.value.trim();
  const category = categoryFilter.value;

  if (search) {
    activeFilters.appendChild(createFilterTag(`Search: "${search}"`, () => {
      searchInput.value = '';
      clearSearchBtn.classList.add('hidden');
      onFilterChange();
    }));
  }

  if (category) {
    activeFilters.appendChild(createFilterTag(`Category: ${category}`, () => {
      categoryFilter.value = '';
      onFilterChange();
    }));
  }
}

function createFilterTag(label, onRemove) {
  const tag = document.createElement('span');
  tag.className = 'filter-tag';
  tag.innerHTML = `
    ${escapeHtml(label)}
    <button class="filter-tag-remove" aria-label="Remove filter">&times;</button>
  `;
  tag.querySelector('.filter-tag-remove').addEventListener('click', onRemove);
  return tag;
}

// ========================================
// Event Bindings
// ========================================

function bindEvents() {
  // Search with debounce
  searchInput.addEventListener('input', () => {
    clearTimeout(searchDebounceTimer);
    clearSearchBtn.classList.toggle('hidden', !searchInput.value.trim());
    searchDebounceTimer = setTimeout(() => {
      onFilterChange();
    }, 350);
  });

  // Clear search
  clearSearchBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    onFilterChange();
    searchInput.focus();
  });

  // Category filter
  categoryFilter.addEventListener('change', onFilterChange);

  // Sort
  sortBy.addEventListener('change', onFilterChange);
  sortOrder.addEventListener('change', onFilterChange);

  // Load more
  loadMoreBtn.addEventListener('click', () => {
    fetchProducts(false);
  });

  // Reset all filters
  resetFiltersBtn.addEventListener('click', () => {
    searchInput.value = '';
    clearSearchBtn.classList.add('hidden');
    categoryFilter.value = '';
    sortBy.value = 'created_at';
    sortOrder.value = 'desc';
    onFilterChange();
  });
}

function onFilterChange() {
  updateActiveFilters();
  fetchProducts(true);
}

// ========================================
// Boot
// ========================================

document.addEventListener('DOMContentLoaded', init);
