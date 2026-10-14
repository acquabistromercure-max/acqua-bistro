#!/usr/bin/env bash
# Depois de um push: espera a publicação do site e confere se a última migration chegou na produção.
set -uo pipefail
cd "$(dirname "$0")/.."
SHA=$(git rev-parse HEAD)
API="https://api.github.com/repos/acquabistromercure-max/acqua-bistro/actions/runs?head_sha=$SHA"
echo "Aguardando publicação do site ($SHA)..."
for _ in $(seq 1 90); do
  ESTADO=$(curl -s "$API" | python3 -I -c 'import json,sys
r=json.load(sys.stdin).get("workflow_runs",[])
print("pendente" if not r or any(x["status"]!="completed" for x in r) else ",".join(x["conclusion"] for x in r))')
  [ "$ESTADO" != "pendente" ] && break
  sleep 10
done
echo "Site: $ESTADO"
ULTIMA=$(ls supabase/migrations/*.sql | sort | tail -1 | xargs basename | cut -d_ -f1)
echo "Aguardando migration $ULTIMA na produção..."
for _ in $(seq 1 60); do
  if bash scripts/consultar-producao.sh "select version from supabase_migrations.schema_migrations where version = '$ULTIMA'" | grep -q "$ULTIMA"; then
    echo "Migration: aplicada"; exit 0
  fi
  sleep 10
done
echo "Migration: NÃO apareceu na produção (ver Supabase → Integrations → GitHub)"; exit 1
