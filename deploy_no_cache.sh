#!/bin/bash

WEB_PORT=8001 docker compose up -d --build --no-deps --force-recreate --remove-orphans --pull always --no-log-prefix
