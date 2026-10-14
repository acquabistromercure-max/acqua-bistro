#!/usr/bin/env bash
# Executa uma consulta SQL SOMENTE DE LEITURA no banco de produção pela API do Supabase.
# Uso: bash scripts/consultar-producao.sh "select ..."   (precisa de SUPABASE_ACCESS_TOKEN no ambiente)
# Mudanças no banco devem ir por migration (supabase/migrations), nunca por aqui.
set -euo pipefail
REF=wiocgyawzwuaqcunubrw
SQL="$1"
python3 -I -c 'import json,sys; print(json.dumps({"query": sys.argv[1], "read_only": True}))' "$SQL" |
  curl -sS -X POST "https://api.supabase.com/v1/projects/$REF/database/query" \
    -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" -H "Content-Type: application/json" --data-binary @-
echo
