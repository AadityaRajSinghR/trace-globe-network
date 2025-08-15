# Trace Globe Network - Real-time Traceroute Visualizer

A real-time network traceroute application with 3D globe visualization using Socket.IO for live data streaming.

## Features

- Real-time traceroute execution with live hop discovery
- 3D globe visualization using Three.js
- Socket.IO for real-time data streaming
- Geographical location mapping of network hops
- Interactive 3D globe with route visualization

## Deployment on Render

### Method 1: Using Render Blueprint (Recommended)

1. Fork this repository to your GitHub account
2. Connect your GitHub account to Render
3. Create a new Blueprint on Render
4. Select this repository
5. The `render.yaml` file will automatically configure both services:
   - Backend API (Node.js Web Service)
   - Frontend (Static Site)

### Method 2: Manual Service Creation

#### Backend Deployment:
1. Create a new Web Service on Render
2. Connect your GitHub repository
3. Configure:
   - **Name**: `traceroute-backend`
   - **Environment**: `Node`
   - **Build Command**: `npm install && npm run build:server`
   - **Start Command**: `npm start`
   - **Environment Variables**:
     - `NODE_ENV`: `production`
     - `FRONTEND_URL`: `https://your-frontend-url.onrender.com`

#### Frontend Deployment:
1. Create a new Static Site on Render
2. Connect your GitHub repository
3. Configure:
   - **Name**: `traceroute-frontend`
   - **Build Command**: `npm install && npm run build`
   - **Publish Directory**: `dist`
   - **Environment Variables**:
     - `VITE_SERVER_URL`: `https://your-backend-url.onrender.com`

### Environment Variables Setup

After deployment, update the environment variables with actual URLs:

**Backend Service**:
- `FRONTEND_URL`: Set to your frontend URL (e.g., `https://traceroute-frontend.onrender.com`)

**Frontend Service**:
- `VITE_SERVER_URL`: Set to your backend URL (e.g., `https://traceroute-backend.onrender.com`)

## Local Development

1. Install dependencies:
   ```bash
   npm install
   ```

2. Start both frontend and backend:
   ```bash
   npm run dev:all
   ```

3. Or start separately:
   ```bash
   # Backend
   npm run server
   
   # Frontend
   npm run dev
   ```

## Technology Stack

- **Frontend**: React, TypeScript, Vite, Three.js, Tailwind CSS
- **Backend**: Node.js, Express, Socket.IO
- **Real-time Communication**: Socket.IO WebSockets
- **Deployment**: Render Platform

## Security Notes

- The application uses public IP geolocation APIs
- Traceroute commands are executed server-side
- CORS is configured for production deployment
- Private IP addresses are filtered out for security

## License

MIT License

The only requirement is having Node.js & npm installed - [install with nvm](https://github.com/nvm-sh/nvm#installing-and-updating)

Follow these steps:

```sh
# Step 1: Clone the repository using the project's Git URL.
git clone <YOUR_GIT_URL>

# Step 2: Navigate to the project directory.
cd <YOUR_PROJECT_NAME>

# Step 3: Install the necessary dependencies.
npm i

# Step 4: Start the development server with auto-reloading and an instant preview.
npm run dev
```

**Edit a file directly in GitHub**

- Navigate to the desired file(s).
- Click the "Edit" button (pencil icon) at the top right of the file view.
- Make your changes and commit the changes.

**Use GitHub Codespaces**

- Navigate to the main page of your repository.
- Click on the "Code" button (green button) near the top right.
- Select the "Codespaces" tab.
- Click on "New codespace" to launch a new Codespace environment.
- Edit files directly within the Codespace and commit and push your changes once you're done.

## What technologies are used for this project?

This project is built with:

- Vite
- TypeScript
- React
- shadcn-ui
- Tailwind CSS

## How can I deploy this project?

Simply open [Lovable](https://lovable.dev/projects/21c02e04-47b3-4f93-8500-df521c6e1274) and click on Share -> Publish.

## Can I connect a custom domain to my Lovable project?

Yes, you can!

To connect a domain, navigate to Project > Settings > Domains and click Connect Domain.

Read more here: [Setting up a custom domain](https://docs.lovable.dev/tips-tricks/custom-domain#step-by-step-guide)
