export const BRAND_NAME = 'Hotdog Prensado';

export function productMedia(product = {}) {
  if (product.image_url) return product.image_url;
  return '/images/catalog-products-premium.png';
}

export function productMediaPosition(product = {}) {
  const name = String(product.name || '').toLowerCase();
  if (name.includes('simples')) return 'media-simple';
  if (name.includes('tradicional')) return 'media-traditional';
  if (name.includes('especial')) return 'media-special';
  if (name.includes('completo')) return 'media-complete';
  if (name.includes('jarra')) return 'media-pitcher';
  if (product.product_type === 'suco') return 'media-juice';
  if (product.product_type === 'bebida') return name.includes('lata') ? 'media-drink' : 'media-bottles';
  if (product.product_type === 'adicional') {
    if (name.includes('catupiry') || name.includes('cheddar')) return 'media-creams';
    if (name.includes('queijo')) return 'media-cheese';
    if (name.includes('carne') || name.includes('frango')) return 'media-meats';
    return 'media-extra';
  }
  return 'media-default';
}
