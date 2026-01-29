# Shree Rudra Jewels - 9R NFC Invoice Management System

## Overview
A GST billing software with invoice management capabilities, built with React, Vite, and Firebase. This is a Progressive Web App (PWA) for managing invoices and inventory.

## Project Architecture
- **Frontend**: React 18 with TypeScript
- **Build Tool**: Vite 5
- **Styling**: Tailwind CSS with Shadcn/UI components
- **State Management**: TanStack React Query
- **Routing**: React Router DOM v6
- **Backend**: Firebase (Firestore, Auth, Storage)
- **PDF Generation**: @react-pdf/renderer, jspdf
- **QR Codes**: qrcode.react

## Project Structure
```
src/
  ├── App.tsx          # Main application component with routing
  ├── main.tsx         # Application entry point
  ├── components/      # Reusable UI components
  ├── pages/           # Page components
  ├── contexts/        # React contexts
  ├── hooks/           # Custom React hooks
  ├── lib/             # Utility functions
  ├── types/           # TypeScript type definitions
  └── assets/          # Static assets
```

## Running the Project
The application runs on port 5000 via the "Start application" workflow using `npm run dev`.

## Demo Credentials
- Username: admin
- Password: 123

## Recent Changes
- 2026-01-29: Migrated from Lovable to Replit environment
  - Updated Vite config to use port 5000 with allowedHosts: true
  - Installed npm dependencies
  - Configured deployment settings
