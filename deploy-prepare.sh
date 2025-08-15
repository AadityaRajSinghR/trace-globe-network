#!/bin/bash

# Deployment preparation script for Render

echo "🚀 Preparing deployment for Render..."

# Build server
echo "📦 Building server..."
npm run build:server

# Build frontend
echo "🎨 Building frontend..."
npm run build

echo "✅ Build complete! Ready for Render deployment."

echo ""
echo "🔧 Next steps for Render deployment:"
echo "1. Push your code to GitHub"
echo "2. Create a new Web Service on Render for the backend"
echo "3. Create a new Static Site on Render for the frontend"
echo "4. Use the configurations from render.yaml or README.md"
echo ""
echo "📝 Don't forget to set environment variables:"
echo "   Backend: FRONTEND_URL, NODE_ENV"
echo "   Frontend: VITE_SERVER_URL"
