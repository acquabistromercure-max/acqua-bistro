#!/usr/bin/env bash
# Lista os alertas de segurança e desempenho que o Supabase aponta no projeto (somente leitura).
set -euo pipefail
REF=wiocgyawzwuaqcunubrw
for tipo in security performance; do
  echo "== $tipo"
  curl -sS "https://api.supabase.com/v1/projects/$REF/advisors/$tipo" -H "Authorization: Bearer $SUPABASE_ACCESS_TOKEN" |
    python3 -I -c 'import json,sys
d=json.load(sys.stdin)
for l in d.get("lints", []):
    print("- [%s] %s: %s" % (l.get("level"), l.get("name"), l.get("detail")))
if not d.get("lints"): print("  nenhum")'
done
