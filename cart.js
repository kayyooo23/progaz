// ПРОГАЗ — общая логика корзины. Работает через localStorage,
// так что корзина сохраняется между переходами по страницам сайта.

const CART_KEY = 'progaz_cart_v1';

function cartGet(){
  try{ return JSON.parse(localStorage.getItem(CART_KEY)) || []; }
  catch(e){ return []; }
}
function cartSave(items){
  localStorage.setItem(CART_KEY, JSON.stringify(items));
  cartUpdateBadge();
}
function cartAdd(slug, name, price, brand, qty){
  qty = qty || 1;
  const items = cartGet();
  const existing = items.find(i => i.slug === slug);
  if(existing){ existing.qty += qty; }
  else{ items.push({slug, name, price, brand, qty}); }
  cartSave(items);
  showToast(`Добавлено: ${name}`);
  if(typeof renderCartPage === 'function') renderCartPage();
  if(typeof refreshCardFoot === 'function') refreshCardFoot(slug);
}
function cartRemove(slug){
  const items = cartGet();
  const item = items.find(i => i.slug === slug);
  if(item && !confirm(`Убрать «${item.name}» из корзины?`)) return;
  cartSave(items.filter(i => i.slug !== slug));
  if(typeof renderCartPage === 'function') renderCartPage();
  if(typeof refreshCardFoot === 'function') refreshCardFoot(slug);
}
function cartSetQty(slug, qty){
  qty = Math.max(1, parseInt(qty, 10) || 1);
  const items = cartGet();
  const item = items.find(i => i.slug === slug);
  if(item){ item.qty = qty; cartSave(items); }
  if(typeof renderCartPage === 'function') renderCartPage();
  if(typeof refreshCardFoot === 'function') refreshCardFoot(slug);
}
function cartQtyFor(slug){
  const item = cartGet().find(i => i.slug === slug);
  return item ? item.qty : 0;
}
/* Плюс/минус на карточке товара и в корзине: если убавляют с 1 до 0,
   товар не пропадает молча — сперва спрашиваем подтверждение. */
function cartInc(slug){
  const item = cartGet().find(i => i.slug === slug);
  if(item) cartSetQty(slug, item.qty + 1);
}
function cartDec(slug){
  const item = cartGet().find(i => i.slug === slug);
  if(!item) return;
  if(item.qty <= 1){ cartRemove(slug); }
  else{ cartSetQty(slug, item.qty - 1); }
}
function cartCount(){
  return cartGet().reduce((sum, i) => sum + i.qty, 0);
}
function cartTotal(){
  return cartGet().reduce((sum, i) => sum + i.qty * i.price, 0);
}
function cartClear(){
  localStorage.removeItem(CART_KEY);
  cartUpdateBadge();
}
function cartUpdateBadge(){
  // .compare-count тоже навешен на span с классом cart-count (общий вид
  // значка), поэтому явно его исключаем — иначе после cartSave() туда
  // на секунду попадает число товаров в корзине вместо сравнения.
  const badges = document.querySelectorAll('.cart-count:not(.compare-count)');
  const n = cartCount();
  badges.forEach(b => {
    b.textContent = n;
    b.style.display = n > 0 ? 'flex' : 'none';
  });
}
function formatPrice(n){
  return n.toLocaleString('ru-RU') + ' ₽';
}
let toastTimeout;
function showToast(text){
  let toast = document.getElementById('progazToast');
  if(!toast){
    toast = document.createElement('div');
    toast.id = 'progazToast';
    toast.className = 'toast';
    toast.innerHTML = `<svg viewBox="0 0 24 24" stroke-width="2.4" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"></polyline></svg><span></span>`;
    document.body.appendChild(toast);
  }
  toast.querySelector('span').textContent = text;
  toast.classList.add('show');
  clearTimeout(toastTimeout);
  toastTimeout = setTimeout(() => toast.classList.remove('show'), 2200);
}

document.addEventListener('DOMContentLoaded', cartUpdateBadge);

// ---- Сравнение товаров: тоже через localStorage, до 4 позиций ----
const COMPARE_KEY = 'progaz_compare_v1';
const COMPARE_MAX = 4;

function compareGet(){
  let list;
  try{ list = JSON.parse(localStorage.getItem(COMPARE_KEY)) || []; }
  catch(e){ return []; }
  // На случай, если товар переименовали/сняли с продажи — не показываем
  // в счётчике то, чего больше нет, и сразу чистим сохранённый список.
  if(typeof PRODUCTS !== 'undefined'){
    const clean = list.filter(slug => PRODUCTS.some(p => p.slug === slug));
    if(clean.length !== list.length){
      localStorage.setItem(COMPARE_KEY, JSON.stringify(clean));
    }
    return clean;
  }
  return list;
}
function compareSave(list){
  localStorage.setItem(COMPARE_KEY, JSON.stringify(list));
  compareUpdateBadge();
}
function compareHas(slug){
  return compareGet().includes(slug);
}
function compareCount(){
  return compareGet().length;
}
function compareToggle(slug, name){
  let list = compareGet();
  const wasIn = list.includes(slug);
  if(wasIn){
    list = list.filter(s => s !== slug);
  } else {
    if(list.length >= COMPARE_MAX){
      showToast(`Можно сравнить не более ${COMPARE_MAX} товаров`);
      return;
    }
    // Сравнивать имеет смысл только товары одного типа — иначе у них
    // просто нет общих характеристик и таблица получается пустой.
    if(list.length > 0 && typeof PRODUCTS !== 'undefined'){
      const newP = PRODUCTS.find(p => p.slug === slug);
      const firstP = PRODUCTS.find(p => p.slug === list[0]);
      if(newP && firstP && newP.category !== firstP.category){
        const catName = (typeof CAT_NAME !== 'undefined' && CAT_NAME[firstP.category]) || firstP.category;
        showToast(`Можно сравнивать только товары одного типа: «${catName}»`);
        return;
      }
    }
    list.push(slug);
  }
  compareSave(list);
  document.querySelectorAll(`.compare-btn[data-slug="${slug}"], .compare-toggle-btn[data-slug="${slug}"]`).forEach(b => b.classList.toggle('active', !wasIn));
  if(!wasIn) showToast(`Добавлено к сравнению: ${name}`);
  if(typeof renderComparePage === 'function') renderComparePage();
}
function compareRemove(slug){
  compareSave(compareGet().filter(s => s !== slug));
  document.querySelectorAll(`.compare-btn[data-slug="${slug}"], .compare-toggle-btn[data-slug="${slug}"]`).forEach(b => b.classList.remove('active'));
  if(typeof renderComparePage === 'function') renderComparePage();
}
function compareUpdateBadge(){
  const badges = document.querySelectorAll('.compare-count');
  const n = compareCount();
  badges.forEach(b => {
    b.textContent = n;
    b.style.display = n > 0 ? 'flex' : 'none';
  });
}
document.addEventListener('DOMContentLoaded', compareUpdateBadge);

// ---- Mobile nav toggle (shared header behaviour) ----
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if(toggle && nav){
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }
});
