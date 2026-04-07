.PHONY: up down logs migrate build prod-up prod-down

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

# Build the all-in-one CapRover image locally for testing
caprover-build:
	docker build -t runa-caprover .

caprover-run:
	docker run -d --name runa \
		-p 80:80 \
		-v runa_data:/data \
		-e JWT_SECRET=change-me \
		-e ENCRYPTION_KEY=change-me-32-chars-minimum-key00 \
		-e MIMO_API_KEY=$${MIMO_API_KEY} \
		runa-caprover

caprover-stop:
	docker stop runa && docker rm runa
