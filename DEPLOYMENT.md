# Deployment Guide for Dokploy

This guide will help you deploy the Paper Trader application on Dokploy.

## Prerequisites

- A Dokploy instance running
- GitHub repository connected to Dokploy

## Deployment Steps

### 1. Create Application in Dokploy

1. Log into your Dokploy dashboard
2. Create a new application
3. Select **Docker Compose** as the deployment type
4. Connect to GitHub and select repository: `krichdev/paper-trader`
5. Set branch to `main`
6. Set Compose Path to `./docker-compose.yml`

### 2. Configure Environment Variables

In the Dokploy environment variables section, add the following **required** variables:

#### Database Configuration
```
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<generate-strong-password>
POSTGRES_DB=paper_trader
```

#### Optional Configuration
```
PORT=80
```

**Important Security Notes:**
- Replace `<generate-strong-password>` with a strong, randomly generated password
- Never commit actual passwords to your repository
- Use Dokploy's built-in secret management for sensitive values

### 3. Configure Port Mapping

- The application runs on port 80 by default (configurable via `PORT` env var)
- Map this to your desired public port or use Dokploy's reverse proxy
- The backend (port 8000) and database (port 5432) are internal only

### 4. Deploy

1. Click **Deploy** or **Save** in Dokploy
2. Dokploy will:
   - Pull the latest code from GitHub
   - Build the Docker images
   - Start the containers with your environment variables
   - Set up the PostgreSQL database automatically

### 5. Verify Deployment

1. Check container logs in Dokploy dashboard:
   - `db` - Should show "database system is ready to accept connections"
   - `backend` - Should show "Application startup complete"
   - `frontend` - Should show nginx worker processes started

2. Access your application at your Dokploy domain

## Environment Variables Reference

| Variable | Required | Default | Description |
|----------|----------|---------|-------------|
| `POSTGRES_USER` | No | `postgres` | PostgreSQL username |
| `POSTGRES_PASSWORD` | **Yes (Production)** | `postgres` | PostgreSQL password - **use strong password in production** |
| `POSTGRES_DB` | No | `paper_trader` | PostgreSQL database name |
| `PORT` | No | `80` | External port for frontend |

## Data Persistence

- Database data is stored in a Docker volume named `postgres_data`
- This volume persists across container restarts
- Make sure Dokploy is configured to back up volumes, or set up your own backup strategy

## Updating the Application

1. Push changes to the `main` branch on GitHub
2. Dokploy will automatically trigger a rebuild (if configured for auto-deploy)
3. Or manually trigger a redeploy from the Dokploy dashboard

## Troubleshooting

### Database Connection Issues
- Verify `POSTGRES_USER`, `POSTGRES_PASSWORD`, and `POSTGRES_DB` match in your environment variables
- Check that the `db` container is healthy before backend starts

### Frontend Not Loading
- Check that port mapping is correct
- Verify nginx logs for errors
- Ensure backend is accessible from frontend container

### WebSocket Connection Fails
- Check that your reverse proxy supports WebSocket connections
- Verify the WebSocket URL in the frontend matches your deployment URL

## Architecture

```
┌─────────────┐
│  Frontend   │ (Port 80)
│   (Nginx)   │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│   Backend   │ (Internal: 8000)
│  (FastAPI)  │
└──────┬──────┘
       │
       ▼
┌─────────────┐
│  Database   │ (Internal: 5432)
│ (PostgreSQL)│
└─────────────┘
```

## Support

For issues with:
- **Application bugs**: Open an issue on GitHub
- **Deployment issues**: Check Dokploy documentation or support
