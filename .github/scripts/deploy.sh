#!/usr/bin/env bash
set -Eeuo pipefail

: "${APP_KIND:?Falta APP_KIND}"
: "${SSH_HOST:?Configura el secret SSH_HOST}"
: "${SSH_USER:?Configura el secret SSH_USER}"
: "${SSH_PRIVATE_KEY:?Configura el secret SSH_PRIVATE_KEY}"
: "${SSH_KNOWN_HOSTS:?Configura el secret SSH_KNOWN_HOSTS}"
: "${DEPLOY_PATH:?Configura la variable DEPLOY_PATH}"
: "${RUNNER_TEMP:?Falta RUNNER_TEMP}"
: "${GITHUB_SHA:?Falta GITHUB_SHA}"
: "${GITHUB_RUN_ID:?Falta GITHUB_RUN_ID}"
SSH_PORT=${SSH_PORT:-22}
PHP_BIN=${PHP_BIN:-php}
RUN_MIGRATIONS=${RUN_MIGRATIONS:-false}

[[ "$APP_KIND" == frontend || "$APP_KIND" == backend ]]
[[ "$SSH_HOST" =~ ^[a-zA-Z0-9][a-zA-Z0-9.-]*$ ]]
[[ "$SSH_USER" =~ ^[a-zA-Z0-9_][a-zA-Z0-9_.-]*$ ]]
[[ "$SSH_PORT" =~ ^[0-9]+$ ]]
[[ "$DEPLOY_PATH" =~ ^/home/[a-zA-Z0-9_.-]+/proyecto2/$APP_KIND$ ]] || {
  echo 'DEPLOY_PATH debe ser /home/USUARIO/proyecto2/frontend o backend.' >&2; exit 1;
}
[[ "$PHP_BIN" =~ ^[a-zA-Z0-9_./-]+$ ]]
[[ "$RUN_MIGRATIONS" == true || "$RUN_MIGRATIONS" == false ]]
[[ "$GITHUB_SHA" =~ ^[a-f0-9]{40}$ ]]
[[ "$GITHUB_RUN_ID" =~ ^[0-9]+$ ]]
[[ "${GITHUB_RUN_ATTEMPT:-1}" =~ ^[0-9]+$ ]]
[[ -f "$RUNNER_TEMP/release.tar.gz" ]]

release_id="$GITHUB_SHA-$GITHUB_RUN_ID-${GITHUB_RUN_ATTEMPT:-1}"
ssh_dir=$(mktemp -d)
trap 'rm -rf -- "$ssh_dir"' EXIT
chmod 700 "$ssh_dir"
printf '%s\n' "$SSH_PRIVATE_KEY" | tr -d '\r' > "$ssh_dir/key"
printf '%s\n' "$SSH_KNOWN_HOSTS" > "$ssh_dir/known_hosts"
chmod 600 "$ssh_dir/key" "$ssh_dir/known_hosts"
ssh_options=(-i "$ssh_dir/key" -o IdentitiesOnly=yes -o BatchMode=yes
  -o StrictHostKeyChecking=yes -o "UserKnownHostsFile=$ssh_dir/known_hosts"
  -o ConnectTimeout=20)
target="$SSH_USER@$SSH_HOST"

ssh "${ssh_options[@]}" -p "$SSH_PORT" "$target" "mkdir -p '$DEPLOY_PATH/releases'"
scp "${ssh_options[@]}" -P "$SSH_PORT" "$RUNNER_TEMP/release.tar.gz" \
  "$target:$DEPLOY_PATH/releases/$release_id.tar.gz"
ssh "${ssh_options[@]}" -p "$SSH_PORT" "$target" \
  "bash -s -- '$DEPLOY_PATH' '$release_id' '$APP_KIND' '$PHP_BIN' '$RUN_MIGRATIONS'" <<'REMOTE'
set -Eeuo pipefail
root=$1
release_id=$2
kind=$3
php_bin=$4
run_migrations=$5
release="$root/releases/$release_id"
archive="$root/releases/$release_id.tar.gz"

[[ ! -e "$release" ]] || { echo 'La versión ya existe.' >&2; exit 1; }
mkdir -p "$release"
tar -xzf "$archive" -C "$release"
rm -- "$archive"

if [[ "$kind" == backend ]]; then
  command -v "$php_bin" >/dev/null
  "$php_bin" "$release/vendor/composer/platform_check.php"
  "$php_bin" -r 'foreach (["pdo_pgsql", "mbstring", "fileinfo", "openssl", "dom", "xml", "curl"] as $extension) { if (!extension_loaded($extension)) { fwrite(STDERR, "Falta la extensión PHP: ".$extension.PHP_EOL); exit(1); } }'
  mkdir -p "$root/shared/storage/app/public" "$root/shared/storage/app/private" \
    "$root/shared/storage/framework/cache/data" "$root/shared/storage/framework/sessions" \
    "$root/shared/storage/framework/views" "$root/shared/storage/logs"
  if [[ ! -f "$root/shared/.env" ]]; then
    cp "$release/.env.example" "$root/shared/.env.example"
    echo "Falta $root/shared/.env. Configúralo en el servidor con APP_ENV=production, APP_DEBUG=false, APP_KEY y PostgreSQL; vuelve a ejecutar el workflow." >&2
    exit 1
  fi
  grep -Eq '^APP_ENV="?production"?[[:space:]]*$' "$root/shared/.env" || { echo 'Configura APP_ENV=production.' >&2; exit 1; }
  grep -Eq '^APP_DEBUG="?false"?[[:space:]]*$' "$root/shared/.env" || { echo 'Configura APP_DEBUG=false.' >&2; exit 1; }
  grep -Eq '^APP_KEY="?base64:[^"[:space:]]+' "$root/shared/.env" || { echo 'Configura una APP_KEY válida y permanente.' >&2; exit 1; }
  chmod 600 "$root/shared/.env"
  chmod -R ug+rwX "$root/shared/storage"
  ln -s "$root/shared/.env" "$release/.env"
  ln -s "$root/shared/storage" "$release/storage"
  mkdir -p "$release/bootstrap/cache"
  chmod ug+rwx "$release/bootstrap/cache"
  ln -s "$root/shared/storage/app/public" "$release/public/storage"
  cd "$release"
  "$php_bin" artisan package:discover --no-interaction
  "$php_bin" artisan config:cache --no-interaction
  "$php_bin" artisan route:cache --no-interaction
  "$php_bin" artisan view:cache --no-interaction
  if [[ "$run_migrations" == true ]]; then
    # Esta base es compartida: ejecutar únicamente las migraciones del catálogo.
    "$php_bin" artisan migrate --force --no-interaction \
      --path=database/migrations/2026_11_26_000001_create_catalog_tables.php \
      --path=database/migrations/2026_11_26_123934_create_catalogo_schema_and_move_catalog_tables.php
  fi
else
  [[ -f "$release/index.html" ]]
  [[ -d "$release/assets" ]]

  project_root="${root%/frontend}"
  [[ "$project_root" != "$root" ]] || { echo 'Ruta del frontend incorrecta.' >&2; exit 1; }

  for entry in index.html assets; do
    public_entry="$project_root/$entry"
    if [[ -e "$public_entry" || -L "$public_entry" ]]; then
      [[ -L "$public_entry" && "$(readlink "$public_entry")" == "frontend/current/$entry" ]] || {
        echo "Ya existe $public_entry y no es un enlace de este despliegue. No se reemplazara." >&2
        exit 1
      }
    fi
  done

  for entry in index.html assets; do
    if [[ ! -L "$project_root/$entry" ]]; then
      ln -s "frontend/current/$entry" "$project_root/$entry"
    fi
  done
fi

[[ ! -e "$root/current" || -L "$root/current" ]] || {
  echo 'current debe ser un enlace simbólico, no una carpeta con datos.' >&2; exit 1;
}
ln -s "$release" "$root/.current-$release_id"
mv -Tf "$root/.current-$release_id" "$root/current"
printf 'Desplegado: %s/current -> %s\n' "$root" "$release"
REMOTE
