# EC25-EUX Frontend - React/Next.js Web Interface

Enterprise-grade web interface for EC25-EUX Multi-Modem Management System.

## 🚀 Features

### Real-time Management
- ✅ **Live modem status** with WebSocket updates
- ✅ **Interactive modem cards** with control actions
- ✅ **Real-time system statistics** and health monitoring
- ✅ **Command execution** with AT/QMI interfaces

### Professional UI/UX
- ✅ **Responsive design** - works on desktop, tablet, mobile
- ✅ **Modern interface** with Tailwind CSS
- ✅ **TypeScript** for type safety
- ✅ **Component-based architecture** for maintainability

### Advanced Features
- ✅ **WebSocket real-time updates** from backend
- ✅ **Command history** with export functionality  
- ✅ **System logs** with filtering and search
- ✅ **Multi-modem operations** (select multiple modems)
- ✅ **Quick commands** for common AT/QMI operations

## 🛠️ Technology Stack

- **Framework**: Next.js 14 (App Router)
- **Language**: TypeScript
- **Styling**: Tailwind CSS
- **Icons**: Lucide React
- **Real-time**: Socket.IO Client
- **HTTP Client**: Axios
- **State Management**: React Hooks

## 📦 Installation

### 1. Install Dependencies
```bash
cd src/frontend
npm install
```

### 2. Environment Configuration
Create `.env.local` file:
```bash
# API Configuration
NEXT_PUBLIC_API_URL=http://localhost:3002/api
NEXT_PUBLIC_WS_URL=ws://localhost:3002

# Development
NODE_ENV=development
```

### 3. Development Server
```bash
npm run dev
```
The interface will be available at: http://localhost:3001

### 4. Production Build
```bash
npm run build
npm start
```

## 🔧 Configuration

### API Integration
The frontend connects to the EC25-EUX backend API:
- **Backend API**: http://localhost:3002/api
- **WebSocket**: ws://localhost:3002/ws
- **Frontend**: http://localhost:3001

### Port Configuration
- Frontend runs on port **3000**
- Backend API runs on port **3002**
- WebSocket uses the same port as backend (**3002**)

## 📱 Interface Components

### Dashboard Overview
```
┌─────────────────────────────────────────────────────┐
│ Header: Status, Connection, Controls                │
├─────────────────────────────────────────────────────┤
│ Sidebar: Navigation, System Status, Recent Events  │
├─────────────────────────────────────────────────────┤
│ Main Content:                                       │
│ ├── Overview: System health, statistics            │
│ ├── Modems: Interactive modem cards                │
│ ├── Commands: AT/QMI command interface             │
│ └── Logs: System logs with filtering               │
└─────────────────────────────────────────────────────┘
```

### Key Features by Tab

#### 🏠 Overview Tab
- System health score and uptime
- Modem status distribution (Active/Partial/Offline)
- Connection status indicators
- Performance metrics
- Quick action buttons

#### 📡 Modems Tab
- Grid view of all detected modems
- Each modem shows:
  - Status indicator (ready/partial/offline/error)
  - Connection details (AT port, QMI device, proxy port)
  - Network information (IP, operator, signal strength)
  - Action buttons (restart, signal check, proxy link)
- Click to select modems for commands

#### 💻 Commands Tab
- AT/QMI command interface
- Target selection (single modem, multiple modems, all modems)
- Quick command buttons for common operations
- Real-time command execution
- Command history with export functionality

#### 📋 Logs Tab
- Real-time system logs
- Filtering by level, type, modem, time range
- Search functionality
- Export logs to JSON
- Auto-scroll option

## 🔄 Real-time Features

### WebSocket Events
The interface listens for real-time events from the backend:

```typescript
// Modem status changes
{
  type: 'modem_change',
  event: {
    operation: 'UPDATE',
    serial: 'EC25_1_1_5',
    new_status: 'ready',
    proxy_port: 3128
  }
}

// System status updates
{
  type: 'system_status',
  data: {
    status: 'operational',
    statistics: { activeModems: 3, uptime: 123456 }
  }
}

// Command results
{
  type: 'command_result',
  data: {
    serial: 'EC25_1_1_5',
    command: 'AT+CSQ',
    response: '+CSQ: 18,99',
    success: true
  }
}
```

### Auto-updates
- Modem status changes update cards immediately
- System statistics refresh in real-time
- New log entries appear automatically
- Connection status shows in header

## 🎨 UI Components

### ModemCard Component
```typescript
interface ModemCardProps {
  modem: Modem
  isSelected: boolean
  onSelect: () => void
}
```
Features:
- Status indicators with colors
- Signal strength bars
- Action buttons (restart, signal check)
- Selection state for commands
- Hover effects and animations

### CommandPanel Component
```typescript
interface CommandPanelProps {
  modems: Modem[]
  selectedModem: string | null
  onModemSelect: (serial: string | null) => void
}
```
Features:
- AT/QMI command selection
- Multi-target selection
- Quick command shortcuts
- Command history with responses
- Export functionality

## 🔧 Development

### Component Structure
```
components/
├── Dashboard.tsx          # Main dashboard container
├── Header.tsx            # Top navigation and status
├── Sidebar.tsx           # Left navigation and system info
├── ModemCard.tsx         # Individual modem display
├── CommandPanel.tsx      # Command execution interface
├── SystemOverview.tsx    # System health overview
├── LogsPanel.tsx         # System logs interface
└── LoadingScreen.tsx     # Initial loading screen
```

### Type Definitions
```typescript
// Core types
interface Modem {
  serial: string
  status: 'ready' | 'partial' | 'offline' | 'error'
  at_port: string
  qmi_device: string
  proxy_port?: number
  wan_ip?: string
  signal_strength?: number
  operator?: string
  // ... more properties
}

interface SystemStatus {
  status: 'operational' | 'degraded' | 'error'
  statistics: {
    activeModems: number
    uptime: number
    successRate: number
    // ... more stats
  }
}
```

### API Integration
```typescript
// API functions
import { getModems, executeModemCommand, triggerModemScan } from '@/lib/api'

// Usage
const modems = await getModems()
const result = await executeModemCommand(serial, 'AT+CSQ', 'AT')
await triggerModemScan()
```

## 🚀 Production Deployment

### Build for Production
```bash
npm run build
npm start
```

### Docker Deployment
```dockerfile
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
RUN npm run build
EXPOSE 3001
CMD ["npm", "start"]
```

### Environment Variables
```bash
# Production environment
NODE_ENV=production
NEXT_PUBLIC_API_URL=https://your-api-domain.com/api
NEXT_PUBLIC_WS_URL=wss://your-api-domain.com
```

## 🧪 Testing

### Development Testing
```bash
# Type checking
npm run type-check

# Linting
npm run lint

# Build test
npm run build
```

### Integration Testing
1. Start backend API server (port 3002)
2. Start frontend dev server (port 3000)
3. Connect EC25-EUX modems
4. Test real-time updates and commands

## 🔗 Integration with Backend

### Required Backend Endpoints
- `GET /api/modems` - Get all modems
- `POST /api/modems/scan` - Trigger modem scan
- `POST /api/modems/:serial/command` - Execute command
- `GET /api/system/status` - Get system status
- `WS /ws` - WebSocket for real-time updates

### WebSocket Events
Backend should emit these events:
- `modem_change` - When modem status changes
- `system_status` - System status updates
- `command_result` - Command execution results
- `log_entry` - New log entries

## 📝 Usage Examples

### Executing Commands
1. Go to Commands tab
2. Select interface (AT or QMI)
3. Choose target modems
4. Enter command or use quick commands
5. Click Execute
6. View results in command history

### Monitoring System
1. Overview tab shows system health
2. WebSocket connection status in header
3. Real-time modem status updates
4. Logs tab for detailed system events

### Managing Modems
1. Modems tab shows all detected modems
2. Click modem cards to select for commands
3. Use action buttons for quick operations
4. Monitor signal strength and network info

---

## 🎯 **System Ready for Production!**

This React/Next.js frontend provides a complete professional interface for managing EC25-EUX modems with real-time updates, command execution, and comprehensive monitoring capabilities.

**Key Benefits:**
- ✅ **Real-time** WebSocket updates
- ✅ **Professional** modern UI/UX
- ✅ **Type-safe** TypeScript implementation
- ✅ **Responsive** design for all devices
- ✅ **Production-ready** with proper error handling
- ✅ **Scalable** component architecture
