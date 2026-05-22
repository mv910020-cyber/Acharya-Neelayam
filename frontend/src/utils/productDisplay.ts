import type { SiteLanguage } from '../content/siteCopy';

export function formatProductPrice(price: number, language: SiteLanguage) {
  return new Intl.NumberFormat(language === 'te' ? 'te-IN' : 'en-IN', {
    style: 'currency',
    currency: 'INR',
    maximumFractionDigits: 0,
  }).format(price);
}

export function formatProductReviews(reviewCount: number, language: SiteLanguage) {
  return language === 'te' ? `${reviewCount} రేటింగ్స్` : `${reviewCount} ratings`;
}
