# Build Scripts Documentation

This directory contains comprehensive build and execution scripts for the Consulting Toolkit application. These scripts provide different deployment scenarios and development workflows.

## Available Scripts

### Development Scripts

#### `dev-electron.sh`
**Purpose**: Full development environment with Electron desktop app
**Usage**: `./tools/scripts/dev-electron.sh` or `npm run dev:electron`

**What it does**:
- Checks all dependencies (Node.js, npm, Python 3)
- Sets up Python virtual environment if needed
- Installs all dependencies
- Starts backend and frontend services
- Launches Electron desktop app
- Provides coordinated cleanup on exit

**Best for**: Desktop app development and testing

#### `run-backend.sh`
**Purpose**: Standalone FastAPI backend server
**Usage**: `./tools/scripts/run-backend.sh` or `npm run run:backend`

**What it does**:
- Sets up Python virtual environment
- Installs backend dependencies
- Starts FastAPI server with hot reload
- Runs on port 8000 by default (configurable with BACKEND_PORT)

**Best for**: Backend API development, testing API endpoints

**Configuration**:
```bash
BACKEND_PORT=8080 ./tools/scripts/run-backend.sh  # Custom port
BACKEND_HOST=127.0.0.1 ./tools/scripts/run-backend.sh  # Custom host
```

#### `run-frontend.sh`
**Purpose**: Standalone Next.js frontend server
**Usage**: `./tools/scripts/run-frontend.sh` or `npm run run:frontend`

**What it does**:
- Installs frontend dependencies
- Starts Next.js development server with hot reload
- Tests backend connectivity
- Runs on port 3000 by default (configurable with FRONTEND_PORT)

**Best for**: Frontend development, UI testing

**Configuration**:
```bash
FRONTEND_PORT=3001 ./tools/scripts/run-frontend.sh  # Custom port
BACKEND_URL=http://localhost:8080 ./tools/scripts/run-frontend.sh  # Custom backend
```

#### `run-fullstack.sh`
**Purpose**: Both backend and frontend for web-based development
**Usage**: `./tools/scripts/run-fullstack.sh` or `npm run run:fullstack`

**What it does**:
- Sets up both backend and frontend environments
- Starts both services concurrently
- Provides coordinated cleanup
- Uses existing npm scripts for orchestration

**Best for**: Full-stack web development without Electron

### Production Scripts

#### `build-electron.sh`
**Purpose**: Production build of Electron desktop application
**Usage**: `./tools/scripts/build-electron.sh` or `npm run build:electron`

**What it does**:
- Cleans previous builds
- Installs all dependencies
- Builds frontend for production
- Verifies backend functionality
- Packages Electron app for current platform
- Detects architecture (Apple Silicon, Intel, Linux, Windows)
- Generates distribution files in `dist/` directory

**Output**: Platform-specific installers (.dmg for macOS, .exe for Windows, .AppImage for Linux)

**Build targets**:
- **macOS**: .dmg installer (automatically detects Intel vs Apple Silicon)
- **Linux**: .AppImage executable
- **Windows**: .exe installer

## Quick Reference

| Task | Command | Use Case |
|------|---------|----------|
| Desktop Development | `npm run dev:electron` | Full Electron app development |
| Backend Only | `npm run run:backend` | API development/testing |
| Frontend Only | `npm run run:frontend` | UI development |
| Web Development | `npm run run:fullstack` | Full-stack without Electron |
| Production Build | `npm run build:electron` | Release packaging |

## Environment Variables

### Backend Configuration
- `BACKEND_PORT`: Server port (default: 8000)
- `BACKEND_HOST`: Server host (default: 0.0.0.0)
- `ENVIRONMENT`: Runtime environment (default: development)

### Frontend Configuration
- `FRONTEND_PORT`: Development server port (default: 3000)
- `FRONTEND_HOST`: Development server host (default: localhost)
- `BACKEND_URL`: Backend API URL (default: http://localhost:8000)
- `NODE_ENV`: Node.js environment

### Development Flags
- `SKIP_BACKEND_START`: Skip backend startup in Electron (used internally)
- `NEXT_TELEMETRY_DISABLED`: Disable Next.js telemetry (set to 1)

## Script Features

### Colored Output
All scripts use colored console output for better visibility:
- 🔴 Red: Errors and failures
- 🟢 Green: Success and completion
- 🟡 Yellow: Warnings and info
- 🔵 Blue: Process information

### Dependency Checking
All scripts verify required tools are installed:
- Node.js and npm for frontend
- Python 3 for backend
- Platform-specific build tools

### Automatic Setup
Scripts automatically handle:
- Python virtual environment creation
- Dependency installation
- Environment variable configuration
- Port conflict detection

### Graceful Cleanup
All development scripts include:
- Signal handling (Ctrl+C)
- Process cleanup
- Port cleanup
- Resource cleanup

## Troubleshooting

### Common Issues

**Port Already in Use**:
```bash
# Use different ports
BACKEND_PORT=8001 npm run run:backend
FRONTEND_PORT=3001 npm run run:frontend
```

**Python Not Found**:
Ensure Python 3 is installed and accessible as `python3` command.

**Permission Denied**:
```bash
chmod +x tools/scripts/*.sh  # Make scripts executable
```

**Build Failures**:
- Check `dist/` directory permissions
- Verify all dependencies are installed
- Check available disk space

### Support
- Backend runs on http://localhost:8000
- Frontend runs on http://localhost:3000  
- API documentation at http://localhost:8000/docs
- Health check at http://localhost:8000/health
