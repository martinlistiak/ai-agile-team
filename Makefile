.PHONY: up down logs migrate build

up:
	docker compose up -d

down:
	docker compose down

logs:
	docker compose logs -f

build:
	docker compose build

migrate:
	docker compose exec backend npm run migration:run

migrate-generate:
	docker compose exec backend npm run migration:generate -- -n $(name)

prod-up:
	docker compose -f docker-compose.prod.yml up -d

prod-down:
	docker compose -f docker-compose.prod.yml down
