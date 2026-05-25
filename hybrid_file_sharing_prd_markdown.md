# Hybrid File Sharing Platform PRD

## Project Overview

A hybrid file-sharing platform inspired by Quick Share, SHAREit, AirDrop, and Nearby Share.

The platform will support:

- Website-to-website file transfer
- Electron-to-electron file transfer
- Electron-to-website transfer
- Nearby device discovery
- LAN/Wi-Fi direct transfer
- Internet-based transfer
- Hotspot transfer without internet
- Temporary session-based sharing
- Code and QR pairing

---

# Phase 0 — Vision & Architecture

## Product Goal

Build a modern file-sharing system that works both locally and globally.

The application should support:

| Scenario | Supported |
|---|---|
| Same Wi-Fi transfer | Yes |
| Hotspot transfer | Yes |
| Browser transfer | Yes |
| Desktop transfer | Yes |
| Internet transfer | Yes |
| Offline LAN transfer | Yes |

---

## Core Platforms

### Website

Users can:

- Open website
- Choose Send or Receive
- Upload files
- Generate transfer code
- Receive files
- Use browser-based transfer

---

### Electron Desktop App

Users can:

- Discover nearby devices
- Send files directly over LAN
- Use hotspot transfer
- Receive native notifications
- Run transfers in background
- Transfer huge files faster

---

# Technology Stack

## Backend

| Technology | Purpose |
|---|---|
| Node.js | Runtime |
| Express.js | API Server |
| Socket.IO | Real-time communication |
| Redis | Session storage |
| coturn | TURN relay |
| Cloudflare R2 / AWS S3 | Temporary file storage |

---

## Frontend (Website)

| Technology | Purpose |
|---|---|
| EJS | Frontend rendering |
| Vanilla JavaScript | Client logic |
| Tailwind CSS | UI Styling |
| Socket.IO Client | Real-time events |
| WebRTC | Peer-to-peer transfer |

---

## Desktop App

| Technology | Purpose |
|---|---|
| Electron | Desktop app |
| Node.js | Local networking |
| UDP/mDNS | Nearby discovery |
| WebRTC | P2P communication |

---

# Overall Architecture

```txt
               SIGNALLING SERVER
            (Node.js + Socket.IO)

                    │
       ┌────────────┼────────────┐
       │                         │

   WEBSITE                  ELECTRON APP
       │                         │

       ├── Internet Mode ───────┤
       │                         │
       └── LAN/Hotspot Mode ────┘
```

---

# PHASE 1 — Website MVP

## Goal

Build a simple browser-based file transfer system.

---

## Features

### Homepage

Options:

```txt
[ Send File ]
[ Receive File ]
```

---

## Send Flow

User can:

- Select file
- Upload file
- Generate transfer code

Example:

```txt
4821
```

---

## Receive Flow

User:

- Opens website
- Enters code
- Connects to sender
- Downloads file

---

## Backend Requirements

### Express Routes

```txt
/
/send
/receive
/upload
/session
```

---

## Socket.IO Events

```txt
create-session
join-session
transfer-request
transfer-accepted
transfer-rejected
```

---

## Storage

Temporary file upload storage.

Auto delete after:

```txt
10 minutes
```

---

## Deliverables

- Working website
- File upload/download
- Code pairing system
- Temporary storage

---

# PHASE 2 — WebRTC P2P Transfer

## Goal

Replace upload/download flow with direct browser transfer.

---

## Features

### WebRTC DataChannels

Direct connection:

```txt
Browser <--> Browser
```

---

## Additions

### Socket.IO Signaling

Exchange:

- SDP
- ICE candidates

---

## STUN/TURN

Use:

```txt
coturn
```

---

## Chunk Transfer System

Use:

```txt
64KB chunks
```

---

## Features

- Live progress
- Reconnect handling
- Chunk-based transfer
- Faster transfer speed

---

## Deliverables

- Direct P2P transfer
- Reduced bandwidth usage
- Improved performance

---

# PHASE 3 — Website Advanced Features

## Goal

Improve user experience and reliability.

---

## Features

### QR Pairing

Generate QR codes for sessions.

---

### Multi-file Support

Support:

- Multiple files
- Folder transfer

---

### Transfer Controls

- Pause
- Resume
- Cancel

---

### User Features

- Transfer history
- Device naming
- Dark mode

---

## Security

- Session expiry
- Metadata encryption
- Spam protection

---

## Deliverables

Production-ready website.

---

# PHASE 4 — Electron Desktop App MVP

## Goal

Create Electron desktop application connected to backend.

---

## Features

### Electron Desktop App

Using:

```txt
Electron + EJS
```

---

## Features

- Drag & drop support
- Native file picker
- Background transfer
- Tray icon
- Desktop notifications

---

## Device Registration

Electron app registers device with backend.

Store:

- Device ID
- Device name
- Online status

---

## Desktop Pages

- Nearby devices
- Send files
- Receive files
- Transfer history

---

## Deliverables

- Windows desktop app
- Backend integration
- Persistent device identity

---

# PHASE 5 — Nearby Wi-Fi & Hotspot Transfer

## Goal

Implement nearby device discovery and local transfer.

---

## Nearby Discovery

Show:

```txt
Nearby Devices
- Suraj-PC
- Galaxy S24
- Office-Laptop
```

---

## Discovery Technologies

| Technology | Purpose |
|---|---|
| UDP Broadcast | Device discovery |
| mDNS / Bonjour | Device names |
| TCP/WebRTC | Local transfer |

---

## Connection Flow

### Sender

Selects nearby device.

---

### Receiver

Gets popup:

```txt
Suraj-PC wants to send files
[ Accept ]
[ Reject ]
```

---

## Transfer

Uses:

```txt
Direct LAN transfer
```

No internet required.

---

## Deliverables

- Nearby device discovery
- Hotspot transfer
- Offline LAN support

---

# PHASE 6 — Smart Hybrid Transfer System

## Goal

Automatically select the best transfer method.

---

# Smart Transfer Logic

## Same Network

Use:

```txt
Direct LAN Transfer
```

---

## Different Networks

Use:

```txt
WebRTC P2P
```

---

## P2P Failed

Use:

```txt
TURN Relay
```

---

## Complete Failure

Use:

```txt
Temporary Cloud Upload
```

---

# Advanced Features

## Smart Device Discovery

- Local discovery
- Global discovery
- Persistent device identity

---

## Sync Features

- Clipboard sharing
- Text sharing
- Image preview

---

## Performance Improvements

- Resumable transfers
- Adaptive chunk size
- Compression

---

## Security

- End-to-end encryption
- Secure pairing
- Signed sessions

---

# Recommended Folder Structure

```txt
/apps
   /web
   /desktop

/services
   /api
   /socket
   /turn

/packages
   /shared
   /network
   /webrtc
```

---

# Recommended Development Order

| Priority | Phase |
|---|---|
| 1 | Website MVP |
| 2 | WebRTC Transfer |
| 3 | Website Advanced Features |
| 4 | Electron Desktop App |
| 5 | LAN Discovery |
| 6 | Smart Hybrid Routing |

---

# Final Architecture

```txt
          ┌─────────────────────┐
          │ Node.js Backend     │
          │ Express + SocketIO  │
          └──────────┬──────────┘
                     │

        ┌────────────┼────────────┐
        │                         │

   Website Users            Electron Users

        │                         │

        ├──── Internet P2P ──────┤
        │                         │
        └──── LAN / Hotspot ─────┘
```

