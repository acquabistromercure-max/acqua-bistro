#!/usr/bin/env bash
# Testa as migrations e as regras de acesso (RLS) num Postgres temporário dentro do Codespace.
# Uso: bash scripts/testar-banco.sh    (precisa do pacote postgresql instalado)
set -euo pipefail
cd "$(dirname "$0")/.."
PGBIN=$(ls -d /usr/lib/postgresql/*/bin | sort -V | tail -1)
DIR=$(mktemp -d)
PORTA=54329
trap '"$PGBIN/pg_ctl" -D "$DIR" stop -m immediate >/dev/null 2>&1 || true; rm -rf "$DIR"' EXIT
"$PGBIN/initdb" -D "$DIR" -U postgres --auth=trust -E UTF8 --locale=C.UTF-8 >/dev/null
"$PGBIN/pg_ctl" -D "$DIR" -o "-p $PORTA -k $DIR -c listen_addresses=''" -l "$DIR/log" start >/dev/null
PSQL=("$PGBIN/psql" -h "$DIR" -p "$PORTA" -U postgres -d postgres -v ON_ERROR_STOP=1 -q -X -o /dev/null)

"${PSQL[@]}" -f supabase/tests/00_simulacao_supabase.sql
for f in supabase/migrations/*.sql; do
  echo "migration: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
for f in supabase/tests/[0-9]*.sql; do
  [ "$(basename "$f")" = 00_simulacao_supabase.sql ] && continue
  echo "teste: $(basename "$f")"
  "${PSQL[@]}" -f "$f"
done
echo "Banco OK: migrations aplicadas e testes passaram."
