#!/bin/bash
# Copyright (c) 2026 Francisco Javier Campos Diaz. Todos los derechos reservados.
cd "$(dirname "$0")/api"
echo "🥝 Starting Kiwi API..."
node dist/main.js
