.PHONY: up down logs seed reset migrate codegen e2e build dev-rtsp test

up:
	docker compose up -d --build

down:
	docker compose down

logs:
	docker compose logs -f

seed:
	tsx scripts/seed.ts

reset:
	docker compose down -v

migrate:
	docker compose exec -T postgres psql -U overwatch -d overwatch -v ON_ERROR_STOP=1 < infra/postgres/init.sql

codegen:
	tsx packages/schemas/build.ts

e2e:
	bash scripts/e2e.sh

build:
	docker compose build

dev-rtsp:
	docker compose -f docker-compose.yml -f docker-compose.dev.yml --profile dev-rtsp up -d

test:
	pnpm -r --filter "@overwatch/*" test
