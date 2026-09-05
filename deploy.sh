#!/bin/bash
set -e

cd "$(dirname "$0")"

if [ ! -f deploy.local.env ]; then
  echo "Не найден deploy.local.env — создай его и впиши FTP_USER/FTP_PASS."
  exit 1
fi

source deploy.local.env

if [ -z "$FTP_USER" ] || [ -z "$FTP_PASS" ]; then
  echo "FTP_USER или FTP_PASS пустые в deploy.local.env — заполни и запусти снова."
  exit 1
fi

# Хостинг кэширует .js/.css на год независимо от заголовков в .htaccess.
# Чтобы после каждого деплоя браузеры сразу подтягивали новую версию
# shop.js/cart.js/products.js/styles.css, дописываем в HTML-страницах
# ?v=<хэш коммита> к ссылкам на эти файлы — сам файл при этом не трогаем.
VERSION=$(git rev-parse --short HEAD 2>/dev/null || date +%s)

count=0
while IFS= read -r -d '' file; do
  rel="${file#./}"
  if [[ "$rel" == *.html ]]; then
    tmp=$(mktemp)
    sed -E "s#(shop\.js|cart\.js|products\.js|styles\.css)\"#\1?v=$VERSION\"#g" "$file" > "$tmp"
    curl -s --ftp-create-dirs -T "$tmp" "ftp://$FTP_HOST/$FTP_REMOTE_DIR/$rel" --user "$FTP_USER:$FTP_PASS"
    rm -f "$tmp"
  else
    curl -s --ftp-create-dirs -T "$file" "ftp://$FTP_HOST/$FTP_REMOTE_DIR/$rel" --user "$FTP_USER:$FTP_PASS"
  fi
  echo "  ✓ $rel"
  count=$((count+1))
done < <(find . -type f \
  -not -path "./.git/*" \
  -not -path "./.github/*" \
  -not -path "./images/*" \
  -not -name "deploy.local.env" \
  -not -name "deploy.sh" \
  -not -name ".gitignore" \
  -print0)

echo "Готово: залито файлов — $count (папка images/ пропущена)."
