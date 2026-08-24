// Получение остатков. Сейчас API работает с тестовой 1С-базой через локальный
// адаптер. Позже его адрес можно заменить без изменений в разметке сайта.
const INVENTORY_API_URL = window.PROGAZ_INVENTORY_API_URL || 'http://localhost:8787/api/inventory';

function inventoryBadge(article) {
  return `<span class="stock-badge stock-badge--loading" data-stock-article="${article}"><span class="dot"></span>Уточняем наличие</span>`;
}

function setInventoryBadge(element, item) {
  if (!item) {
    element.className = 'stock-badge stock-badge--unknown';
    element.innerHTML = '<span class="dot"></span>Наличие уточняется';
    return;
  }

  const available = Number(item.available) || 0;
  element.className = `stock-badge ${available > 0 ? '' : 'stock-badge--out'}`.trim();
  element.innerHTML = available > 0
    ? `<span class="dot"></span>В наличии: ${available} шт.`
    : '<span class="dot"></span>Нет в наличии';
}

async function loadInventory() {
  try {
    const response = await fetch(INVENTORY_API_URL, { headers: { Accept: 'application/json' } });
    if (!response.ok) throw new Error(`Inventory API returned ${response.status}`);
    const payload = await response.json();
    const items = Array.isArray(payload.items) ? payload.items : [];
    const byArticle = new Map(items.map(item => [item.article, item]));

    document.querySelectorAll('[data-stock-article]').forEach(element => {
      setInventoryBadge(element, byArticle.get(element.dataset.stockArticle));
    });
  } catch (error) {
    // Страница остаётся доступной, даже когда API ещё не размещён.
    document.querySelectorAll('[data-stock-article]').forEach(element => setInventoryBadge(element, null));
    console.warn('Не удалось загрузить остатки:', error.message);
  }
}

document.addEventListener('DOMContentLoaded', loadInventory);
