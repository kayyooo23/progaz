/* ПРОГАЗ — общая логика витрины: карточки, фильтры каталога,
   страница товара, корзина и оформление. Данные берутся из products.js */

const CAT_ICONS = {
  kolonki: '<rect x="7" y="2" width="10" height="20" rx="2"></rect><line x1="9.5" y1="6" x2="14.5" y2="6"></line><line x1="9.5" y1="10" x2="14.5" y2="10"></line><circle cx="12" cy="16" r="2"></circle>',
  kotly: '<rect x="4" y="4" width="16" height="17" rx="2"></rect><rect x="7" y="8" width="10" height="6" rx="1"></rect><line x1="8" y1="18" x2="8" y2="18.01"></line><line x1="12" y1="18" x2="12" y2="18.01"></line><line x1="16" y1="18" x2="16" y2="18.01"></line>',
  plity: '<rect x="3" y="4" width="18" height="17" rx="2"></rect><circle cx="8" cy="10" r="2"></circle><circle cx="16" cy="10" r="2"></circle><line x1="6" y1="17" x2="18" y2="17"></line>',
  schetchiki: '<circle cx="12" cy="13" r="8"></circle><line x1="12" y1="13" x2="15" y2="9"></line><line x1="9" y1="2" x2="15" y2="2"></line>'
};
const CAT_NAME = Object.fromEntries(CATEGORIES.map(c => [c.code, c.name]));

function esc(s){ return String(s).replace(/'/g, "\\'"); }
function escAttr(s){ return String(s).replace(/"/g, '&quot;'); }

/* Артикул: пока берём из данных, иначе — из slug. Когда подключим 1С,
   поле article придёт оттуда и станет ключом связи. */
function articleOf(p){
  return p.article || p.slug.toUpperCase().replace(/-/g, '');
}

/* Порядок поиска картинки: настоящее фото, затем временная заглушка. */
function productImages(p){
  if(p.images && p.images.length) return p.images;
  return ['images/' + p.slug + '.jpg', 'images/' + p.slug + '.png', 'images/' + p.slug + '.svg'];
}
function iconSvg(cat, sw){
  return `<svg viewBox="0 0 24 24" fill="none" stroke-width="${sw}" stroke-linecap="round" stroke-linejoin="round">${CAT_ICONS[cat]}</svg>`;
}
function mediaImg(p, sw){
  const list = productImages(p);
  const icon = iconSvg(p.category, sw).replace(/"/g, '&quot;').replace(/'/g, "\\'");
  const chain = `var n=this.dataset.n?parseInt(this.dataset.n):0;var l=${JSON.stringify(list)};n++;if(n<l.length){this.dataset.n=n;this.src=l[n];}else{this.outerHTML='${icon}';}`;
  return `<img src="${list[0]}" alt="${escAttr(p.name)}" loading="lazy" onerror="${escAttr(chain)}">`;
}

function productCard(p){
  return `<article class="card" data-cat="${p.category}">
    <a href="/product?slug=${p.slug}" class="card-media" aria-label="${escAttr(p.name)}">
      <span class="card-art mono">${articleOf(p)}</span>
      ${mediaImg(p, 1.2)}
    </a>
    <div class="card-body">
      <div class="card-brand">${p.brand}</div>
      <h3 class="card-title"><a href="/product?slug=${p.slug}">${p.name}</a></h3>
      <div class="card-spec">${p.specs[0][0]}: ${p.specs[0][1]}</div>
      <div class="card-foot">
        <span class="card-price">${formatPrice(p.price)}</span>
        <button class="add-btn" onclick="cartAdd('${esc(p.slug)}','${esc(p.name)}',${p.price},'${esc(p.brand)}',1)" aria-label="Добавить в корзину">
          <svg viewBox="0 0 24 24" fill="none" stroke-linecap="round"><line x1="12" y1="5" x2="12" y2="19"></line><line x1="5" y1="12" x2="19" y2="12"></line></svg>
        </button>
      </div>
    </div>
  </article>`;
}

/* ---------------- Главная ---------------- */
function renderFeatured(){
  const el = document.getElementById('featuredGrid');
  if(el) el.innerHTML = PRODUCTS.slice(0, 8).map(productCard).join('');
}

/* ---------------- Каталог ---------------- */

/* Производители показываются только для выбранных типов оборудования.
   Пока тип не выбран, список брендов не нужен: человеку, которому нужен
   котёл, незачем видеть производителей плит. */
function brandsFor(cats){
  const map = new Map();
  PRODUCTS
    .filter(p => cats.length === 0 || cats.includes(p.category))
    .forEach(p => map.set(p.brand, (map.get(p.brand) || 0) + 1));
  return [...map.entries()].sort((a, b) => a[0].localeCompare(b[0], 'ru'));
}
function categoryList(){
  const map = new Map();
  PRODUCTS.forEach(p => map.set(p.category, (map.get(p.category) || 0) + 1));
  return CATEGORIES.filter(c => map.has(c.code)).map(c => [c.code, c.name, map.get(c.code)]);
}

function initCatalog(){
  const catBox = document.getElementById('fCategories');
  if(!catBox) return;

  catBox.innerHTML = categoryList().map(([code, name, n]) =>
    `<label class="fopt"><input type="checkbox" name="cat" value="${code}" onchange="onCategoryChange()">${name}<span class="cnt">${n}</span></label>`
  ).join('');

  // Ссылки вида catalog.html?cat=kotly из подвала
  const initial = new URLSearchParams(location.search).get('cat');
  if(initial){
    const box = catBox.querySelector(`input[value="${initial}"]`);
    if(box) box.checked = true;
  }
  renderBrandFilter();
  applyFilters();
}

/* При смене типа перерисовываем список брендов и сбрасываем те,
   которых в новом наборе типов уже нет. */
function onCategoryChange(){
  renderBrandFilter();
  applyFilters();
}

function renderBrandFilter(){
  const box = document.getElementById('fBrands');
  if(!box) return;
  const cats = checkedValues('cat');
  const previously = new Set(checkedValues('brand'));

  if(cats.length === 0){
    box.innerHTML = `<p class="fhint">Сначала выберите тип оборудования — покажем подходящих производителей.</p>`;
    return;
  }

  box.innerHTML = brandsFor(cats).map(([brand, n]) => {
    const checked = previously.has(brand) ? ' checked' : '';
    return `<label class="fopt"><input type="checkbox" name="brand" value="${escAttr(brand)}"${checked} onchange="applyFilters()">${brand}<span class="cnt">${n}</span></label>`;
  }).join('');
}

function checkedValues(name){
  return [...document.querySelectorAll(`input[name="${name}"]:checked`)].map(i => i.value);
}

function applyFilters(){
  const cats = checkedValues('cat');
  const brands = checkedValues('brand');
  const min = parseInt(document.getElementById('priceMin').value) || 0;
  const max = parseInt(document.getElementById('priceMax').value) || Infinity;
  const sort = document.getElementById('sortSelect').value;

  let list = PRODUCTS.filter(p =>
    (cats.length === 0 || cats.includes(p.category)) &&
    (brands.length === 0 || brands.includes(p.brand)) &&
    p.price >= min && p.price <= max
  );

  if(sort === 'price-asc') list = [...list].sort((a, b) => a.price - b.price);
  if(sort === 'price-desc') list = [...list].sort((a, b) => b.price - a.price);
  if(sort === 'name') list = [...list].sort((a, b) => a.name.localeCompare(b.name, 'ru'));

  const grid = document.getElementById('catalogGrid');
  grid.innerHTML = list.length
    ? list.map(productCard).join('')
    : `<div class="empty-state"><p>По этим условиям ничего не нашлось.</p><button class="btn btn-ghost" onclick="resetFilters()">Сбросить фильтры</button></div>`;

  document.getElementById('resultsCount').innerHTML =
    list.length ? `Показано <b>${list.length}</b> из ${PRODUCTS.length}` : 'Ничего не найдено';

  renderChips(cats, brands, min, max);
  updateCatalogMeta(cats, list.length);
}

/* Когда выбрана одна категория, страница становится по сути отдельной:
   «Газовые котлы в Перми». Меняем заголовок и h1, иначе в поиске все
   варианты фильтра выглядят одинаково. */
function updateCatalogMeta(cats, found){
  const h1 = document.querySelector('.page-head h1');
  const sub = document.querySelector('.page-head .sub');

  if(cats.length === 1){
    const name = CAT_NAME[cats[0]];
    if(h1) h1.textContent = name + ' в Перми';
    if(sub) sub.textContent = `${found} ${plural(found, 'позиция', 'позиции', 'позиций')} в наличии. Доставка по Перми в день покупки.`;
    setMeta({
      title: `${name} — купить в Перми | ПРОГАЗ`,
      desc: `${name} в Перми: ${found} ${plural(found, 'модель', 'модели', 'моделей')} в наличии. Отбор по производителю и цене, доставка в день покупки.`,
      url: location.origin + location.pathname + '?cat=' + cats[0]
    });
  } else {
    if(h1) h1.textContent = 'Каталог оборудования';
    if(sub) sub.textContent = 'Отберите по типу, производителю и цене — или позвоните, подскажем.';
    setMeta({
      title: 'Каталог газового оборудования — купить в Перми | ПРОГАЗ',
      desc: 'Газовые котлы, колонки, плиты и счётчики в Перми: 32 позиции в наличии. Отбор по типу, производителю и цене.',
      url: location.origin + location.pathname
    });
  }
}

function plural(n, one, few, many){
  const n10 = n % 10, n100 = n % 100;
  if(n10 === 1 && n100 !== 11) return one;
  if(n10 >= 2 && n10 <= 4 && (n100 < 10 || n100 >= 20)) return few;
  return many;
}

function renderChips(cats, brands, min, max){
  const box = document.getElementById('activeChips');
  const chips = [];
  cats.forEach(c => chips.push(`<span class="chip">${CAT_NAME[c]}<button onclick="uncheck('cat','${c}')" aria-label="Убрать">×</button></span>`));
  brands.forEach(b => chips.push(`<span class="chip">${b}<button onclick="uncheck('brand','${esc(b)}')" aria-label="Убрать">×</button></span>`));
  if(min > 0 || max !== Infinity){
    const label = `${min > 0 ? 'от ' + min.toLocaleString('ru-RU') : ''}${max !== Infinity ? ' до ' + max.toLocaleString('ru-RU') : ''} ₽`.trim();
    chips.push(`<span class="chip">${label}<button onclick="clearPrice()" aria-label="Убрать">×</button></span>`);
  }
  box.innerHTML = chips.join('');
}

function uncheck(name, value){
  const el = document.querySelector(`input[name="${name}"][value="${value}"]`);
  if(!el) return;
  el.checked = false;
  if(name === 'cat') renderBrandFilter();
  applyFilters();
}
function clearPrice(){
  document.getElementById('priceMin').value = '';
  document.getElementById('priceMax').value = '';
  applyFilters();
}
function resetFilters(){
  document.querySelectorAll('.filters input[type="checkbox"]').forEach(i => i.checked = false);
  renderBrandFilter();
  clearPrice();
}

/* Обновляет заголовок и разметку страницы на лету — для карточек товара
   и для каталога с выбранной категорией. Без этого все 32 товара выглядели бы
   в поиске одинаково. */
function setMeta({title, desc, url, image}){
  if(title){
    document.title = title;
    setTag('meta[property="og:title"]', 'content', title);
  }
  if(desc){
    setTag('meta[name="description"]', 'content', desc);
    setTag('meta[property="og:description"]', 'content', desc);
  }
  if(url){
    setTag('link[rel="canonical"]', 'href', url);
    setTag('meta[property="og:url"]', 'content', url);
  }
  if(image){
    const abs = image.startsWith('http') ? image : location.origin + location.pathname.replace(/[^/]+$/, '') + image;
    setTag('meta[property="og:image"]', 'content', abs);
  }
}
function setTag(selector, attr, value){
  const el = document.querySelector(selector);
  if(el) el.setAttribute(attr, value);
}

/* ---------------- Страница товара ---------------- */
function galleryArrows(p){
  if(!p.images || p.images.length < 2) return '';
  return `<button class="gallery-arrow gallery-arrow-prev" onclick="stepImage(-1)" aria-label="Предыдущее фото">&#8249;</button>
    <button class="gallery-arrow gallery-arrow-next" onclick="stepImage(1)" aria-label="Следующее фото">&#8250;</button>`;
}
function galleryThumbs(p){
  if(!p.images || p.images.length < 2) return '';
  return `<div class="product-thumbs">${p.images.map((src, i) =>
    `<button class="product-thumb${i === 0 ? ' active' : ''}" onclick="switchImage('${src}', this)">
       <img src="${src}" alt="Фото ${i + 1}" loading="lazy"></button>`
  ).join('')}</div>`;
}
function switchImage(src, btn){
  document.getElementById('mainMedia').innerHTML = `<img src="${src}" alt="Фото товара">`;
  const thumbs = document.querySelectorAll('.product-thumb');
  thumbs.forEach(t => t.classList.remove('active'));
  btn.classList.add('active');
}
function stepImage(delta){
  const thumbs = Array.from(document.querySelectorAll('.product-thumb'));
  if(!thumbs.length) return;
  let idx = thumbs.findIndex(t => t.classList.contains('active'));
  idx = (idx + delta + thumbs.length) % thumbs.length;
  const btn = thumbs[idx];
  const src = btn.querySelector('img').getAttribute('src');
  switchImage(src, btn);
}
function toggleSpecs(btn, total){
  const table = btn.previousElementSibling;
  const extra = table.querySelector('.spec-extra');
  const caption = table.querySelector('caption');
  const isHidden = extra.hasAttribute('hidden');
  if(isHidden){
    extra.removeAttribute('hidden');
    caption.textContent = 'Характеристики';
    btn.textContent = 'Скрыть характеристики';
  } else {
    extra.setAttribute('hidden', '');
    caption.textContent = 'Краткие характеристики';
    btn.textContent = `Показать все характеристики (${total})`;
  }
}
function stepQty(delta){
  const input = document.getElementById('qty');
  input.value = Math.max(1, (parseInt(input.value) || 1) + delta);
}

function renderProduct(){
  const root = document.getElementById('productRoot');
  if(!root) return;
  const slug = new URLSearchParams(location.search).get('slug');
  const p = PRODUCTS.find(x => x.slug === slug);

  if(!p){
    root.innerHTML = `<div class="container" style="padding:60px 0; text-align:center;">
      <h1 style="margin-bottom:10px;">Товар не найден</h1>
      <p style="color:var(--steel-500); margin-bottom:20px;">Возможно, ссылка устарела или позиция снята с продажи.</p>
      <a href="/catalog" class="btn btn-gas">Перейти в каталог</a></div>`;
    return;
  }

  // Заголовок под конкретный товар: люди ищут «купить ... в Перми»,
  // поэтому город и слово «купить» должны быть в заголовке.
  setMeta({
    title: `${p.name} — купить в Перми, ${formatPrice(p.price)} | ПРОГАЗ`,
    desc: `${p.name} — ${formatPrice(p.price)}. ${p.desc.slice(0, 100)} Доставка по Перми в день покупки.`,
    url: location.href,
    image: productImages(p)[0]
  });

  const SHORT_SPECS_COUNT = 5;
  const row = s => `<tr><td>${s[0]}</td><td>${s[1]}</td></tr>`;
  const shortRows = p.specs.slice(0, SHORT_SPECS_COUNT).map(row).join('');
  const extraRows = p.specs.slice(SHORT_SPECS_COUNT).map(row).join('');
  const hasMoreSpecs = p.specs.length > SHORT_SPECS_COUNT;
  const related = PRODUCTS.filter(x => x.category === p.category && x.slug !== p.slug).slice(0, 4);
  const relatedBlock = related.length ? `<section class="section">
    <div class="container">
      <div class="section-head"><h2>Похожее оборудование</h2></div>
      <div class="grid grid-4">${related.map(productCard).join('')}</div>
    </div></section>` : '';

  root.innerHTML = `
  <div class="container crumbs">
    <a href="/">Главная</a><span>/</span>
    <a href="/catalog">Каталог</a><span>/</span>
    <a href="/catalog?cat=${p.category}">${CAT_NAME[p.category]}</a>
  </div>
  <div class="container product-detail">
    <div class="product-gallery">
      <div class="product-media-wrap">
        <div class="product-media" id="mainMedia">${mediaImg(p, 1)}</div>
        ${galleryArrows(p)}
      </div>
      ${galleryThumbs(p)}
    </div>
    <div class="product-info">
      <div class="card-brand">${p.brand}</div>
      <h1>${p.name}</h1>
      <span class="product-art">Артикул ${articleOf(p)}</span>
      <div class="product-price-row" style="margin-top:16px;">
        <span class="product-price">${formatPrice(p.price)}</span>
        <span class="stock-badge"><span class="dot"></span>В наличии</span>
      </div>
      <p class="product-desc">${p.desc}</p>
      <table class="spec-table">
        <caption>${hasMoreSpecs ? 'Краткие характеристики' : 'Характеристики'}</caption>
        <tbody>${shortRows}</tbody>
        ${hasMoreSpecs ? `<tbody class="spec-extra" hidden>${extraRows}</tbody>` : ''}
      </table>
      ${hasMoreSpecs ? `<button type="button" class="spec-toggle" onclick="toggleSpecs(this,${p.specs.length})">Показать все характеристики (${p.specs.length})</button>` : ''}
      <div class="qty-row">
        <div class="qty-control">
          <button onclick="stepQty(-1)" aria-label="Меньше">−</button>
          <input type="number" id="qty" value="1" min="1" aria-label="Количество">
          <button onclick="stepQty(1)" aria-label="Больше">+</button>
        </div>
        <button class="btn btn-gas" onclick="cartAdd('${esc(p.slug)}','${esc(p.name)}',${p.price},'${esc(p.brand)}', parseInt(document.getElementById('qty').value)||1)">
          Добавить в корзину
        </button>
        <a href="tel:+79082640158" class="btn btn-ghost">Спросить по телефону</a>
      </div>
    </div>
  </div>
  ${relatedBlock}`;
}

/* ---------------- Корзина ---------------- */
function thumbFor(slug){
  const p = PRODUCTS.find(x => x.slug === slug);
  return p ? mediaImg(p, 1.4) : '';
}

function renderCartPage(){
  const root = document.getElementById('cartRoot');
  if(!root) return;
  const items = cartGet();

  if(items.length === 0){
    root.innerHTML = `<div class="cart-empty"><p>Пока пусто. Загляните в каталог — подберём оборудование.</p>
      <a href="/catalog" class="btn btn-gas">Открыть каталог</a></div>`;
    return;
  }

  const rows = items.map(i => `
    <div class="cart-row">
      <div class="thumb">${thumbFor(i.slug)}</div>
      <div class="name"><span class="brand">${i.brand}</span><a href="/product?slug=${i.slug}">${i.name}</a></div>
      <div class="qty-control">
        <button onclick="cartSetQty('${esc(i.slug)}', ${i.qty - 1})" aria-label="Меньше">−</button>
        <input type="number" value="${i.qty}" min="1" onchange="cartSetQty('${esc(i.slug)}', this.value)" aria-label="Количество">
        <button onclick="cartSetQty('${esc(i.slug)}', ${i.qty + 1})" aria-label="Больше">+</button>
      </div>
      <div class="mono" style="font-weight:700;">${formatPrice(i.price * i.qty)}</div>
      <button class="remove" onclick="cartRemove('${esc(i.slug)}')" aria-label="Убрать из корзины">×</button>
    </div>`).join('');

  root.innerHTML = `<div class="cart-layout">
    <div>${rows}</div>
    <div class="cart-summary">
      <div class="summary-row"><span>Товаров</span><span class="mono">${cartCount()}</span></div>
      <div class="summary-row"><span>Доставка</span><span class="mono">по Перми — бесплатно</span></div>
      <div class="summary-row total"><span>Итого</span><span class="mono">${formatPrice(cartTotal())}</span></div>
      <a href="/checkout" class="btn btn-gas btn-block" style="margin-top:14px;">Оформить заказ</a>
    </div>
  </div>`;
}

/* ---------------- Оформление ---------------- */
function initCheckout(){
  const sel = document.getElementById('deliveryMethod');
  if(!sel) return;

  sel.addEventListener('change', toggleAddress);
  toggleAddress();

  // Дату раньше сегодняшней выбрать нельзя, по умолчанию — завтра
  const date = document.getElementById('coDate');
  if(date){
    const today = new Date();
    const tomorrow = new Date(today.getTime() + 86400000);
    date.min = today.toISOString().slice(0, 10);
    date.value = tomorrow.toISOString().slice(0, 10);
  }

  // Ошибка гаснет, как только человек начал исправлять поле
  ['coFio','coPhone','coAddress','coDate','coConsent'].forEach(id => {
    const el = document.getElementById(id);
    if(el) el.addEventListener('input', () => clearError(id));
    if(el && el.type === 'checkbox') el.addEventListener('change', () => clearError(id));
  });

  renderCheckout();
}

function toggleAddress(){
  const isDelivery = document.getElementById('deliveryMethod').value === 'delivery';
  document.getElementById('addressGroup').style.display = isDelivery ? '' : 'none';
  if(!isDelivery) clearError('coAddress');
}

function renderCheckout(){
  const box = document.getElementById('checkoutItems');
  if(!box) return;
  const items = cartGet();
  box.innerHTML = items.length
    ? items.map(i => `<div class="summary-row"><span>${i.name} × ${i.qty}</span><span class="mono">${formatPrice(i.price * i.qty)}</span></div>`).join('')
    : '<div class="summary-row"><span>Корзина пуста</span></div>';
  document.getElementById('checkoutTotal').textContent = formatPrice(cartTotal());
}

/* ---------- Проверка полей ---------- */

function showError(id, message){
  const field = document.getElementById(id);
  const box = document.getElementById('err-' + id);
  if(field) field.classList.add('is-invalid');
  if(box) box.textContent = message;
}
function clearError(id){
  const field = document.getElementById(id);
  const box = document.getElementById('err-' + id);
  if(field) field.classList.remove('is-invalid');
  if(box) box.textContent = '';
}

/* В телефоне считаем только цифры: человек может ввести со скобками,
   пробелами или через 8 — всё это допустимо. */
function digitsOf(value){
  return (value || '').replace(/\D/g, '');
}

function validateOrder(){
  let firstBad = null;
  const fail = (id, msg) => { showError(id, msg); if(!firstBad) firstBad = id; };

  const fio = document.getElementById('coFio').value.trim();
  if(fio.length < 5 || fio.split(/\s+/).length < 2){
    fail('coFio', 'Укажите фамилию и имя полностью');
  }

  const phone = digitsOf(document.getElementById('coPhone').value);
  if(phone.length < 10){
    fail('coPhone', 'Телефон нужен, чтобы подтвердить заказ');
  } else if(phone.length > 11){
    fail('coPhone', 'Проверьте номер — кажется, лишние цифры');
  }

  if(document.getElementById('deliveryMethod').value === 'delivery'){
    const addr = document.getElementById('coAddress').value.trim();
    if(addr.length < 8) fail('coAddress', 'Укажите улицу, дом и квартиру');
  }

  const dateEl = document.getElementById('coDate');
  if(!dateEl.value){
    fail('coDate', 'Выберите дату');
  } else {
    const chosen = new Date(dateEl.value);
    const today = new Date(); today.setHours(0,0,0,0);
    if(chosen < today) fail('coDate', 'Дата уже прошла');
  }

  if(!document.getElementById('coConsent').checked){
    fail('coConsent', 'Без согласия мы не можем принять заявку');
  }

  if(firstBad){
    const el = document.getElementById(firstBad);
    el.scrollIntoView({behavior:'smooth', block:'center'});
    if(el.focus) el.focus({preventScroll:true});
    return false;
  }
  return true;
}

/* ---------- Отправка ---------- */

function collectOrder(){
  const method = document.getElementById('deliveryMethod').value;
  const timeLabels = {any:'любое', morning:'первая половина дня', evening:'вторая половина дня'};
  return {
    создана: new Date().toISOString(),
    покупатель: {
      фио: document.getElementById('coFio').value.trim(),
      телефон: document.getElementById('coPhone').value.trim()
    },
    доставка: {
      способ: method === 'delivery' ? 'доставка по Перми' : 'самовывоз',
      адрес: method === 'delivery' ? document.getElementById('coAddress').value.trim() : 'ул. Волховская, 38',
      дата: document.getElementById('coDate').value,
      время: timeLabels[document.getElementById('coTime').value]
    },
    комментарий: document.getElementById('coNote').value.trim(),
    товары: cartGet().map(i => ({
      артикул: (PRODUCTS.find(p => p.slug === i.slug) || {}).article || i.slug,
      название: i.name, количество: i.qty, цена: i.price, сумма: i.price * i.qty
    })),
    итого: cartTotal(),
    согласие_на_обработку: true,
    согласие_редакция_политики: '02.09.2026'
  };
}

/* ЕДИНСТВЕННОЕ МЕСТО, куда подключается доставка заявки.
   Пока заявка никуда не уходит — функция возвращает ошибку намеренно,
   чтобы форма не делала вид, что заказ принят.
   Когда решим, куда слать (почта, Telegram, сервис форм), меняем только
   эту функцию: остальной код трогать не придётся.
   Важно: поля согласие_на_обработку и согласие_редакция_политики нужно
   сохранять вместе с заявкой — это и есть запись согласия по 152-ФЗ. */
async function sendOrder(order){
  // Здесь появится отправка. Например:
  // const r = await fetch(ORDER_ENDPOINT, {method:'POST', headers:{'Content-Type':'application/json'}, body: JSON.stringify(order)});
  // return r.ok;
  console.log('Заявка сформирована, но отправка не подключена:', order);
  return false;
}

async function submitOrder(){
  if(cartCount() === 0){ showToast('Сначала добавьте товар в корзину'); return; }
  if(!validateOrder()) return;

  const btn = document.querySelector('.cart-summary .btn-gas');
  const order = collectOrder();

  btn.disabled = true;
  btn.textContent = 'Отправляем…';

  let ok = false;
  try { ok = await sendOrder(order); }
  catch(e){ ok = false; }

  btn.disabled = false;
  btn.textContent = 'Отправить заявку';

  if(ok){
    cartClear();
    showOrderSuccess(order);
  } else {
    showToast('Не удалось отправить. Позвоните: +7 (908) 264-01-58');
  }
}

function showOrderSuccess(order){
  const root = document.querySelector('.cart-layout');
  if(!root) return;
  root.outerHTML = `
    <div class="container order-done">
      <div class="order-done-mark">✓</div>
      <h2>Заявка принята</h2>
      <p>Спасибо, ${order.покупатель.фио.split(' ')[1] || order.покупатель.фио}. Мы перезвоним на
      <b>${order.покупатель.телефон}</b>, чтобы подтвердить наличие и время доставки.</p>
      <p class="order-done-sum">Сумма заявки: <span class="mono">${formatPrice(order.итого)}</span></p>
      <a href="/catalog" class="btn btn-ghost">Вернуться в каталог</a>
    </div>`;
}

/* ---------- Уведомление о cookie ---------- */
function initCookieBanner(){
  if(localStorage.getItem('cookieConsent')) return;
  const el = document.createElement('div');
  el.className = 'cookie-banner';
  el.innerHTML = `
    <svg viewBox="0 0 24 24"><circle cx="12" cy="12" r="10"></circle><circle cx="9" cy="9" r="1"></circle><circle cx="14" cy="8" r="1"></circle><circle cx="15" cy="13" r="1"></circle><circle cx="9" cy="15" r="1"></circle></svg>
    <div class="cookie-banner-body">
      <p>На сайте применяются <a href="/cookies">cookie</a>
      и <a href="/cookies#recommend">рекомендательные технологии</a></p>
      <button class="cookie-banner-ok" type="button">Хорошо</button>
    </div>`;
  document.body.appendChild(el);
  requestAnimationFrame(() => el.classList.add('show'));
  el.querySelector('.cookie-banner-ok').addEventListener('click', () => {
    localStorage.setItem('cookieConsent', '1');
    el.classList.remove('show');
    setTimeout(() => el.remove(), 250);
  });
}
document.addEventListener('DOMContentLoaded', initCookieBanner);
