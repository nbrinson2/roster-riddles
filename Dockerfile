# Stage 1: Build the Angular application
FROM node:20-alpine as builder

WORKDIR /app

# Copy package files
COPY package*.json ./

# Install dependencies
RUN npm install

# Copy the rest of the application
COPY . .

# Build the application
RUN npm run build:prod

# Stage 2: Serve the application
FROM node:20-alpine

WORKDIR /app

# Copy package files for production dependencies
COPY package*.json ./

# Install only production dependencies
RUN npm ci --omit=dev

# Copy the built application from builder stage
COPY --from=builder /app/dist ./dist
COPY index.js .

# Expose the port the app runs on
EXPOSE 3000

# Start the application
CMD ["node", "index.js"] 