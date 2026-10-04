# Oruniwan Microservices Architecture

Docker configuration for a microservices architecture with three independent service layers:
1. **Server** - Node.js Express API
2. **Databases** - PostgreSQL + MongoDB
3. **Cache** - Redis

External services (AI, Messaging Brokers) are managed separately via third-party providers.

## Architecture Overview

```
┌─────────────────────────────────────────────┐
│         Oruniwan Microservices              │
├─────────────────────────────────────────────┤
│                                             │
│  ┌────────────────┐                        │
│  │  API Server    │                        │
│  │  (Port 8080)   │                        │
│  └────────┬───────┘                        │
│           │                                │
│  ┌────────┴──────────────────────┐         │
│  │      oruniwan-network         │         │
│  └────┬────────────────┬────────┬┘         │
│       │                │        │          │
│  ┌────▼──────┐  ┌─────▼──┐  ┌─▼────────┐ │
│  │ PostgreSQL│  │ MongoDB│  │  Redis  │ │
│  │(Port 5432)│  │(Port  │  │(Port   │ │
│  │           │  │27017) │  │6379)   │ │
│  └───────────┘  └───────┘  └────────┘ │
│                                        │
└────────────────────────────────────────┘
           │
           │ Third-party Services
           ├─ Gemini AI API
           ├─ RabbitMQ / Kafka
           └─ Other External Services
```

## Files

- **docker-compose.yml** - Main orchestrator that brings all services together
- **docker-compose.server.yml** - API Server microservice
- **docker-compose.databases.yml** - PostgreSQL and MongoDB microservices
- **docker-compose.cache.yml** - Redis microservice
- **.dockerignore** - Excludes unnecessary files from Docker build
- **Dockerfile** - Development image
- **Dockerfile.prod** - Production-optimized image

## Quick Start

### 1. Create `.env` file

```env
# Server
PORT=8080
NODE_ENV=development

# PostgreSQL
DB_USER=postgres
DB_PASSWORD=postgres
DB_NAME=oruniwan
DB_PORT=5432

# MongoDB
MONGO_USER=admin
MONGO_PASSWORD=password
MONGO_DB=oruniwan
MONGO_PORT=27017

# Redis
REDIS_PORT=6379
REDIS_PASSWORD=

# Third-party Services
GEMINI_API_KEY=your_gemini_key
RABBITMQ_URL=amqp://user:pass@rabbitmq-host:5672
```

### 2. Start Services (Choose Option)

#### Option A: Start Services Individually

```bash
# Terminal 1: Start databases
docker-compose -f docker-compose.databases.yml up

# Terminal 2: Start cache
docker-compose -f docker-compose.cache.yml up

# Terminal 3: Start server
docker-compose -f docker-compose.server.yml up
```

#### Option B: Start All Services in One Command

```bash
docker-compose -f docker-compose.databases.yml -f docker-compose.cache.yml -f docker-compose.server.yml up
```

#### Option C: Start Specific Services

```bash
# Start only databases
docker-compose -f docker-compose.databases.yml up

# Start only cache
docker-compose -f docker-compose.cache.yml up

# Start only server
docker-compose -f docker-compose.server.yml up
```

### 3. View Logs

```bash
# View logs from specific service
docker-compose -f docker-compose.server.yml logs -f

# View all logs (when running multiple files)
docker-compose -f docker-compose.databases.yml -f docker-compose.cache.yml -f docker-compose.server.yml logs -f
```

### 4. Stop Services

```bash
# Stop services (same files you used to start)
docker-compose -f docker-compose.databases.yml -f docker-compose.cache.yml -f docker-compose.server.yml down

# Stop and remove volumes (WARNING: deletes data)
docker-compose -f docker-compose.databases.yml -f docker-compose.cache.yml down -v
```

## Running Individual Services

Each microservice is completely independent and can be run separately:

### Start Databases Only

```bash
docker-compose -f docker-compose.databases.yml up
```

### Start Cache Only

```bash
docker-compose -f docker-compose.cache.yml up
```

### Start Server Only

```bash
docker-compose -f docker-compose.server.yml up
```

**Note:** When running independently, services will only connect to their configured endpoints. The server will fail if databases/cache are not accessible.

## Service Connectivity

All services communicate over the **oruniwan-network** bridge network:

### Server → Databases
- PostgreSQL: `postgres://postgres:password@postgres:5432/oruniwan`
- MongoDB: `mongodb://admin:password@mongo:27017/oruniwan?authSource=admin`

### Server → Cache
- Redis: `redis://redis:6379`

### Hostnames (internal DNS)
- Server: `server`
- PostgreSQL: `postgres`
- MongoDB: `mongo`
- Redis: `redis`

## Environment Variables

### Database Configuration
```env
DB_HOST=postgres          # PostgreSQL hostname
DB_PORT=5432              # PostgreSQL port
DB_USER=postgres          # PostgreSQL user
DB_PASSWORD=postgres      # PostgreSQL password
DB_NAME=oruniwan          # PostgreSQL database name

MONGO_USER=admin          # MongoDB user
MONGO_PASSWORD=password   # MongoDB password
MONGO_DB=oruniwan         # MongoDB database name
MONGO_PORT=27017          # MongoDB port
```

### Cache Configuration
```env
REDIS_URL=redis://redis:6379
REDIS_PASSWORD=           # Optional Redis password
REDIS_PORT=6379           # Redis port
```

### Server Configuration
```env
PORT=8080                 # API Server port
NODE_ENV=development      # Environment (development/production)
```

### Third-party Services
```env
GEMINI_API_KEY=your_key
RABBITMQ_URL=amqp://user:pass@broker:5672
# Add other external service URLs as needed
```

## Production Builds

### Build Server Image

```bash
docker build -f Dockerfile -t oruniwan-server:dev .
```

### Build Production Image

```bash
docker build -f Dockerfile.prod -t oruniwan-server:latest .
```

### Push to Registry

```bash
# Docker Hub
docker tag oruniwan-server:latest your-registry/oruniwan-server:latest
docker push your-registry/oruniwan-server:latest

# AWS ECR
docker tag oruniwan-server:latest ACCOUNT.dkr.ecr.REGION.amazonaws.com/oruniwan-server:latest
docker push ACCOUNT.dkr.ecr.REGION.amazonaws.com/oruniwan-server:latest
```

## Networking

### Bridge Network: oruniwan-network
All services are connected via a custom bridge network, enabling internal DNS resolution:
- Services can reach each other using hostnames
- Ports are only exposed to host machine as defined
- Services are isolated from other Docker networks

### Port Mapping
| Service | Container Port | Host Port | Access |
|---------|---|---|---|
| Server | 8080 | 8080 | http://localhost:8080 |
| PostgreSQL | 5432 | 5432 | localhost:5432 |
| MongoDB | 27017 | 27017 | localhost:27017 |
| Redis | 6379 | 6379 | localhost:6379 |

## Health Checks

All services include health checks:
- **Server**: HTTP GET `/api/health` (30s interval)
- **PostgreSQL**: pg_isready command (10s interval)
- **MongoDB**: mongosh ping command (10s interval)
- **Redis**: redis-cli ping (10s interval)

View health status:
```bash
docker-compose ps
```

## Data Persistence

Data is persisted in Docker volumes:
- `postgres_data` - PostgreSQL database files
- `mongo_data` - MongoDB database files
- `mongo_config` - MongoDB config database
- `redis_data` - Redis AOF (append-only file)

Volumes are created automatically and survive container restarts.

## Troubleshooting

### Service Won't Start
```bash
# Check logs
docker-compose logs service-name

# Rebuild image
docker-compose build server

# Force recreate containers
docker-compose up --force-recreate
```

### Connection Refused
1. Verify all services are running: `docker-compose ps`
2. Check service logs for errors: `docker-compose logs postgres`
3. Verify environment variables: `cat .env`
4. Ensure services are healthy: Look for "healthy" status in `docker-compose ps`

### Port Already in Use
```bash
# Find process using port
lsof -i :8080

# Or change port in .env and docker-compose files
# Edit PORT=8081 in .env
```

### Reset Everything
```bash
# Stop and remove all containers, volumes
docker-compose down -v

# Remove images
docker rmi oruniwan-server:dev oruniwan-server:latest

# Rebuild from scratch
docker-compose up --build
```

## Cloud Deployment

### Railway
1. Add services separately or push entire docker-compose config
2. Configure PostgreSQL, MongoDB, Redis as managed services
3. Deploy Server pointing to managed database services
4. Set environment variables in Railway dashboard

### Google Cloud Run
1. Build and push server image to GCR
2. Use Cloud SQL, Firestore/Cloud Datastore for databases
3. Use Memorystore for Redis
4. Configure service-to-service authentication

### AWS
1. Use ECS for container orchestration
2. RDS for PostgreSQL
3. DocumentDB for MongoDB
4. ElastiCache for Redis
5. Push image to ECR

### Docker Swarm
```bash
# Initialize swarm
docker swarm init

# Deploy stack
docker stack deploy -c docker-compose.yml oruniwan
```

### Kubernetes
```bash
# Convert docker-compose to Kubernetes manifests
kompose convert -f docker-compose.yml -o k8s/

# Deploy to cluster
kubectl apply -f k8s/
```

## Best Practices

### Development
- Use `docker-compose up` to start all services
- Keep `.env` file in `.gitignore`
- Use volume mounts for hot-reload during development
- Run tests against real database containers

### Production
- Use `Dockerfile.prod` for optimized production image
- Set `NODE_ENV=production`
- Use strong passwords for databases
- Store secrets in environment variables or secrets manager
- Use managed database services in cloud
- Enable SSL/TLS for database connections
- Set up monitoring and logging
- Use read-only file systems where possible

## Performance Tuning

### PostgreSQL
- `max_connections=200` (adjust based on workload)
- `shared_buffers=256MB` (increase for large datasets)
- Enable connection pooling in application

### MongoDB
- Enable replication set for production
- Use appropriate indexes on collections
- Monitor memory usage

### Redis
- `--appendonly yes` enables AOF persistence
- Monitor memory usage and eviction policy
- Use keyspace notifications for events

## Monitoring

### View Metrics
```bash
# Check resource usage
docker stats

# View container details
docker-compose ps

# Inspect container
docker inspect oruniwan-server
```

### Logs
```bash
# All services
docker-compose logs

# Follow logs
docker-compose logs -f

# Specific service
docker-compose logs -f server

# Last 100 lines
docker-compose logs --tail=100 server
```
