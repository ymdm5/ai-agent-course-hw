#!/bin/sh
# Runs once on first container init (docker-entrypoint-initdb.d), as $POSTGRES_USER.
# Creates the genuinely read-only Postgres role used by the agent's runSql and
# listTaskCategories tools. Prisma migrations/seed keep using $POSTGRES_USER.
set -e

psql -v ON_ERROR_STOP=1 --username "$POSTGRES_USER" --dbname "$POSTGRES_DB" <<-EOSQL
	create role "${LEDGERBASE_RO_USER}" with login password '${LEDGERBASE_RO_PASSWORD}';
	grant connect on database "${POSTGRES_DB}" to "${LEDGERBASE_RO_USER}";
	grant usage on schema public to "${LEDGERBASE_RO_USER}";
	grant select on all tables in schema public to "${LEDGERBASE_RO_USER}";
	alter default privileges in schema public grant select on tables to "${LEDGERBASE_RO_USER}";
EOSQL
