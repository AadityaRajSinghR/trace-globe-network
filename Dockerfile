# Use official Node.js runtime as base image
FROM node:18-alpine

# Set working directory
WORKDIR /app

# Copy package files
COPY package*.json ./
COPY bun.lockb ./

# Install dependencies
RUN npm install

# Copy source code
COPY . .

# Build server
RUN npm run build:server

# Expose port
EXPOSE 10000

# Set environment variable for port
ENV PORT=10000

# Start the server
CMD ["npm", "start"]
