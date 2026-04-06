#!/bin/sh
export PATH="/usr/local/bin:/usr/bin:/bin"
set -a
. /Users/jprietoleighton/code/Jorgeprieto30/proyecto_medico/.env
set +a
# Añadir localhost al CORS para preview local
export FRONTEND_URLS="${FRONTEND_URLS},http://localhost:3000"
exec /usr/local/bin/node /Users/jprietoleighton/code/Jorgeprieto30/proyecto_medico/node_modules/.bin/nest start --watch
