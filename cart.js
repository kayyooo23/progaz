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
}
function cartRemove(slug){
  const items = cartGet().filter(i => i.slug !== slug);
  cartSave(items);
  if(typeof renderCartPage === 'function') renderCartPage();
}
function cartSetQty(slug, qty){
  qty = Math.max(1, parseInt(qty, 10) || 1);
  const items = cartGet();
  const item = items.find(i => i.slug === slug);
  if(item){ item.qty = qty; cartSave(items); }
  if(typeof renderCartPage === 'function') renderCartPage();
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
  const badges = document.querySelectorAll('.cart-count');
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

// ---- Mobile nav toggle (shared header behaviour) ----
document.addEventListener('DOMContentLoaded', () => {
  const toggle = document.querySelector('.nav-toggle');
  const nav = document.querySelector('.nav');
  if(toggle && nav){
    toggle.addEventListener('click', () => nav.classList.toggle('open'));
  }
});
