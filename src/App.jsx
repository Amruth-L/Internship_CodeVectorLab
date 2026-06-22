import { useEffect, useMemo, useState } from 'react';
import {
  ArrowDownAZ,
  ArrowUpAZ,
  ChevronDown,
  LoaderCircle,
  Package,
  RefreshCcw,
  Search,
  SlidersHorizontal,
  X
} from 'lucide-react';

const SORT_OPTIONS = [
  { value: 'created_at', label: 'Date added' },
  { value: 'name', label: 'Name' },
  { value: 'price', label: 'Price' },
  { value: 'updated_at', label: 'Last updated' }
];

const DEFAULT_SORT = {
  sortBy: 'created_at',
  sortOrder: 'desc'
};

function useDebouncedValue(value, delay = 350) {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = window.setTimeout(() => setDebouncedValue(value), delay);
    return () => window.clearTimeout(timeout);
  }, [delay, value]);

  return debouncedValue;
}

function buildProductsUrl({ search, category, sortBy, sortOrder, cursor }) {
  const params = new URLSearchParams({
    limit: '20',
    sortBy,
    sortOrder
  });

  if (search.trim()) {
    params.set('search', search.trim());
  }

  if (category) {
    params.set('category', category);
  }

  if (cursor) {
    params.set('cursor', cursor);
  }

  return `/api/products?${params.toString()}`;
}

function App() {
  const [searchText, setSearchText] = useState('');
  const [category, setCategory] = useState('');
  const [sortBy, setSortBy] = useState(DEFAULT_SORT.sortBy);
  const [sortOrder, setSortOrder] = useState(DEFAULT_SORT.sortOrder);
  const [categories, setCategories] = useState([]);
  const [products, setProducts] = useState([]);
  const [nextCursor, setNextCursor] = useState(null);
  const [hasMore, setHasMore] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [isLoadingMore, setIsLoadingMore] = useState(false);
  const [error, setError] = useState('');
  const [reloadKey, setReloadKey] = useState(0);

  const debouncedSearch = useDebouncedValue(searchText);

  const hasActiveControls = Boolean(
    searchText.trim() ||
      category ||
      sortBy !== DEFAULT_SORT.sortBy ||
      sortOrder !== DEFAULT_SORT.sortOrder
  );

  const sortLabel = useMemo(() => {
    const selected = SORT_OPTIONS.find((option) => option.value === sortBy);
    return selected?.label || 'Date added';
  }, [sortBy]);

  useEffect(() => {
    let shouldIgnore = false;

    async function loadCategories() {
      try {
        const response = await fetch('/api/categories');
        if (!response.ok) {
          throw new Error('Unable to load categories.');
        }

        const data = await response.json();
        if (!shouldIgnore) {
          setCategories(data.categories || []);
        }
      } catch {
        if (!shouldIgnore) {
          setCategories([]);
        }
      }
    }

    loadCategories();

    return () => {
      shouldIgnore = true;
    };
  }, []);

  useEffect(() => {
    const controller = new AbortController();

    async function loadProducts() {
      setIsLoading(true);
      setError('');
      setProducts([]);
      setNextCursor(null);
      setHasMore(false);

      try {
        const response = await fetch(
          buildProductsUrl({
            search: debouncedSearch,
            category,
            sortBy,
            sortOrder
          }),
          { signal: controller.signal }
        );

        if (!response.ok) {
          throw new Error('Unable to load products.');
        }

        const json = await response.json();
        setProducts(json.data || []);
        setNextCursor(json.pagination?.next_cursor || null);
        setHasMore(Boolean(json.pagination?.has_more));
      } catch (err) {
        if (err.name !== 'AbortError') {
          setError('Products could not be loaded. Check the API server and try again.');
        }
      } finally {
        if (!controller.signal.aborted) {
          setIsLoading(false);
        }
      }
    }

    loadProducts();

    return () => controller.abort();
  }, [category, debouncedSearch, reloadKey, sortBy, sortOrder]);

  async function loadMoreProducts() {
    if (!nextCursor || isLoadingMore) {
      return;
    }

    setIsLoadingMore(true);
    setError('');

    try {
      const response = await fetch(
        buildProductsUrl({
          search: debouncedSearch,
          category,
          sortBy,
          sortOrder,
          cursor: nextCursor
        })
      );

      if (!response.ok) {
        throw new Error('Unable to load more products.');
      }

      const json = await response.json();
      setProducts((currentProducts) => [...currentProducts, ...(json.data || [])]);
      setNextCursor(json.pagination?.next_cursor || null);
      setHasMore(Boolean(json.pagination?.has_more));
    } catch {
      setError('More products could not be loaded. Please try again.');
    } finally {
      setIsLoadingMore(false);
    }
  }

  function resetControls() {
    setSearchText('');
    setCategory('');
    setSortBy(DEFAULT_SORT.sortBy);
    setSortOrder(DEFAULT_SORT.sortOrder);
  }

  return (
    <main className="app-shell">
      <header className="topbar">
        <div className="brand">
          <span className="brand-mark" aria-hidden="true">
            <Package size={20} />
          </span>
          <div>
            <p className="eyebrow">Catalog</p>
            <h1>ProductVault</h1>
          </div>
        </div>

        <div className="result-count" aria-live="polite">
          {isLoading ? 'Loading' : `${products.length.toLocaleString()} shown`}
        </div>
      </header>

      <section className="toolbar" aria-label="Product controls">
        <div className="search-field">
          <Search size={19} aria-hidden="true" />
          <input
            type="search"
            value={searchText}
            onChange={(event) => setSearchText(event.target.value)}
            placeholder="Search products"
            aria-label="Search products"
          />
          {searchText && (
            <button
              className="icon-button"
              type="button"
              onClick={() => setSearchText('')}
              aria-label="Clear search"
              title="Clear search"
            >
              <X size={16} />
            </button>
          )}
        </div>

        <div className="control-row">
          <SelectControl
            icon={<SlidersHorizontal size={16} />}
            label="Category"
            value={category}
            onChange={setCategory}
          >
            <option value="">All categories</option>
            {categories.map((item) => (
              <option key={item} value={item}>
                {item}
              </option>
            ))}
          </SelectControl>

          <SelectControl
            icon={sortOrder === 'asc' ? <ArrowUpAZ size={16} /> : <ArrowDownAZ size={16} />}
            label="Sort"
            value={sortBy}
            onChange={setSortBy}
          >
            {SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {option.label}
              </option>
            ))}
          </SelectControl>

          <div className="sort-toggle" aria-label="Sort order">
            <button
              type="button"
              className={sortOrder === 'desc' ? 'is-selected' : ''}
              onClick={() => setSortOrder('desc')}
            >
              Desc
            </button>
            <button
              type="button"
              className={sortOrder === 'asc' ? 'is-selected' : ''}
              onClick={() => setSortOrder('asc')}
            >
              Asc
            </button>
          </div>

          {hasActiveControls && (
            <button className="reset-button" type="button" onClick={resetControls}>
              <RefreshCcw size={16} />
              Reset
            </button>
          )}
        </div>
      </section>

      <section className="active-strip" aria-label="Active product view">
        {debouncedSearch && <Chip label={`Search: ${debouncedSearch}`} onRemove={() => setSearchText('')} />}
        {category && <Chip label={category} onRemove={() => setCategory('')} />}
        <span className="quiet-chip">
          {sortLabel}, {sortOrder === 'asc' ? 'ascending' : 'descending'}
        </span>
      </section>

      {error && (
        <section className="notice" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((key) => key + 1)}>
            Retry
          </button>
        </section>
      )}

      <section className="product-area" aria-live="polite">
        {isLoading ? (
          <ProductSkeleton />
        ) : products.length > 0 ? (
          <>
            <div className="product-grid">
              {products.map((product) => (
                <ProductCard key={product.id} product={product} />
              ))}
            </div>

            {hasMore && (
              <div className="load-more">
                <button type="button" onClick={loadMoreProducts} disabled={isLoadingMore}>
                  {isLoadingMore ? <LoaderCircle className="spin" size={18} /> : <Package size={18} />}
                  {isLoadingMore ? 'Loading' : 'Load more'}
                </button>
              </div>
            )}
          </>
        ) : (
          <EmptyState onReset={resetControls} showReset={hasActiveControls} />
        )}
      </section>
    </main>
  );
}

function SelectControl({ icon, label, value, onChange, children }) {
  return (
    <label className="select-control">
      <span>
        {icon}
        {label}
      </span>
      <div className="select-wrap">
        <select value={value} onChange={(event) => onChange(event.target.value)}>
          {children}
        </select>
        <ChevronDown size={16} aria-hidden="true" />
      </div>
    </label>
  );
}

function Chip({ label, onRemove }) {
  return (
    <span className="chip">
      {label}
      <button type="button" onClick={onRemove} aria-label={`Remove ${label}`} title={`Remove ${label}`}>
        <X size={14} />
      </button>
    </span>
  );
}

function ProductCard({ product }) {
  const categoryClass = getCategoryClass(product.category);
  const price = Number(product.price || 0).toLocaleString('en-US', {
    style: 'currency',
    currency: 'USD'
  });
  const createdAt = formatDate(product.created_at);
  const updatedAt = formatDate(product.updated_at);

  return (
    <article className="product-card">
      <div className="card-head">
        <span className={`category-pill ${categoryClass}`}>{product.category}</span>
        <strong>{price}</strong>
      </div>

      <h2>{product.name}</h2>

      <dl>
        <div>
          <dt>Added</dt>
          <dd>{createdAt}</dd>
        </div>
        <div>
          <dt>Updated</dt>
          <dd>{updatedAt}</dd>
        </div>
      </dl>
    </article>
  );
}

function ProductSkeleton() {
  return (
    <div className="product-grid" aria-label="Loading products">
      {Array.from({ length: 8 }).map((_, index) => (
        <article className="product-card skeleton" key={index}>
          <div className="skeleton-line short" />
          <div className="skeleton-line title" />
          <div className="skeleton-line medium" />
          <div className="skeleton-row">
            <div className="skeleton-line tiny" />
            <div className="skeleton-line tiny" />
          </div>
        </article>
      ))}
    </div>
  );
}

function EmptyState({ onReset, showReset }) {
  return (
    <div className="empty-state">
      <Package size={42} aria-hidden="true" />
      <h2>No products found</h2>
      <p>Try a different search, category, or sort order.</p>
      {showReset && (
        <button type="button" onClick={onReset}>
          Clear controls
        </button>
      )}
    </div>
  );
}

function getCategoryClass(category = '') {
  if (category.includes('Electronics')) return 'tone-blue';
  if (category.includes('Furniture')) return 'tone-amber';
  if (category.includes('Stationery')) return 'tone-green';
  if (category.includes('Kitchenware')) return 'tone-rose';
  return 'tone-violet';
}

function formatDate(value) {
  if (!value) {
    return 'Unknown';
  }

  return new Intl.DateTimeFormat('en-US', {
    month: 'short',
    day: 'numeric',
    year: 'numeric'
  }).format(new Date(value));
}

export default App;
