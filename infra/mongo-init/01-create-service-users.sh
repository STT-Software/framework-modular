#!/bin/sh
# Creates one database user per service, limited to that service's database.
# Docker runs this only the first time the data volume is created. To re-run it,
# delete the volume: docker compose -f infra/docker-compose.yml down -v
#
# To add a service: add a block like the one below, pass its password through
# docker-compose.yml, and document it in infra/.env.example.
set -eu

mongosh --quiet \
  -u "$MONGO_INITDB_ROOT_USERNAME" -p "$MONGO_INITDB_ROOT_PASSWORD" \
  --authenticationDatabase admin <<EOF
db = db.getSiblingDB('super_admin_auth');
db.createUser({
  user: 'super_admin_auth',
  pwd: '${SUPER_ADMIN_AUTH_DB_PASSWORD}',
  roles: [{ role: 'readWrite', db: 'super_admin_auth' }]
});

db = db.getSiblingDB('onboarding');
db.createUser({
  user: 'onboarding',
  pwd: '${ONBOARDING_DB_PASSWORD}',
  roles: [{ role: 'readWrite', db: 'onboarding' }]
});
EOF
