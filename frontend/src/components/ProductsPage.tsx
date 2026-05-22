import { useMemo, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import { getCategoryLabel, getProductName } from '../content/siteCopy';
import { useLanguage } from '../context/LanguageContext';
import { useStore } from '../context/StoreContext';
import ProductCard from './ProductCard';

const ALL_PRODUCTS_VALUE = '__all__';

type SortOption = 'popularity' | 'price-low' | 'price-high' | 'rating' | 'newest';

interface SortOptionConfig {
  id: SortOption;
  label: string;
}

export default function ProductsPage() {
  const { language, copy } = useLanguage();
  const { products, categories, loading, error } = useStore();
  const [searchParams, setSearchParams] = useSearchParams();
  const [searchText, setSearchText] = useState('');
  const [sortBy, setSortBy] = useState<SortOption>('popularity');

  const activeCategory = searchParams.get('category') || ALL_PRODUCTS_VALUE;

  const sortOptions: SortOptionConfig[] = [
    { id: 'popularity', label: 'Popularity' },
    { id: 'price-low', label: 'Price -- Low to High' },
    { id: 'price-high', label: 'Price -- High to Low' },
    { id: 'rating', label: 'Highest Rated' },
    { id: 'newest', label: 'Newest' },
  ];

  const visibleProducts = useMemo(() => {
    const query = searchText.trim().toLowerCase();

    let filtered = products.filter((product) => {
      const matchesCategory =
        activeCategory === ALL_PRODUCTS_VALUE || product.category === activeCategory;

      const matchesSearch =
        !query ||
        [
          product.name,
          getProductName(product.id, product.name, language),
          product.category,
          getCategoryLabel(product.category, language),
          product.badge,
          product.description,
          product.useCase,
          ...product.tags,
        ]
          .join(' ')
          .toLowerCase()
          .includes(query);

      return matchesCategory && matchesSearch;
    });

    // Apply sorting
    const sorted = [...filtered];
    switch (sortBy) {
      case 'price-low':
        sorted.sort((a, b) => a.price - b.price);
        break;
      case 'price-high':
        sorted.sort((a, b) => b.price - a.price);
        break;
      case 'rating':
        sorted.sort((a, b) => b.rating - a.rating);
        break;
      case 'newest':
        sorted.sort((a, b) => b.sortOrder - a.sortOrder);
        break;
      case 'popularity':
      default:
        sorted.sort((a, b) => (b.reviewCount || 0) - (a.reviewCount || 0));
    }

    return sorted;
  }, [activeCategory, language, products, searchText, sortBy]);

  const categoryButtons = [
    {
      value: ALL_PRODUCTS_VALUE,
      label: copy.products.allProducts,
    },
    ...categories.map((category) => ({
      value: category.label,
      label: getCategoryLabel(category.label, language),
    })),
  ];

  return (
    <section className="page-shell products-page-shell">
      <div className="catalog-intro">
        <p className="eyebrow">{copy.products.eyebrow}</p>
        <h1>{copy.products.title}</h1>
        <p className="lead">{copy.products.lead}</p>
      </div>

      <div className="catalog-layout">
        <aside className="catalog-sidebar">
          <div className="sidebar-panel">
            <h2 className="sidebar-title">Categories</h2>
            <div className="category-list">
              {categoryButtons.map((category) => (
                <button
                  key={category.value}
                  type="button"
                  className={`category-button ${
                    activeCategory === category.value ? 'category-button-active' : ''
                  }`}
                  onClick={() =>
                    setSearchParams(
                      category.value === ALL_PRODUCTS_VALUE
                        ? {}
                        : { category: category.value }
                    )
                  }
                >
                  {category.label}
                </button>
              ))}
            </div>
          </div>
        </aside>

        <div className="catalog-main">
          <div className="catalog-toolbar">
            <label className="catalog-search">
              <span>{copy.products.searchLabel}</span>
              <input
                type="search"
                placeholder={copy.products.searchPlaceholder}
                value={searchText}
                onChange={(event) => setSearchText(event.target.value)}
              />
            </label>

            <p className="results-copy">{copy.products.results(visibleProducts.length)}</p>
          </div>

          {/* Sort Bar */}
          <div className="catalog-sort-bar">
            <span className="sort-label">Sort By:</span>
            <div className="sort-options">
              {sortOptions.map((option) => (
                <button
                  key={option.id}
                  type="button"
                  className={`sort-option ${sortBy === option.id ? 'sort-option-active' : ''}`}
                  onClick={() => setSortBy(option.id)}
                >
                  {option.label}
                </button>
              ))}
            </div>
          </div>

          {error ? (
            <div className="status-panel status-panel-error">
              {copy.common.error}: {error}
            </div>
          ) : null}
          {loading && !products.length ? (
            <div className="status-panel">{copy.common.loadingProducts}</div>
          ) : null}
          {!loading && !visibleProducts.length ? (
            <div className="status-panel">{copy.products.noResults}</div>
          ) : null}

          <div className="product-grid">
            {visibleProducts.map((product) => (
              <ProductCard key={product.id} product={product} />
            ))}
          </div>
        </div>
      </div>
    </section>
  );
}
