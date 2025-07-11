# Use Node.js base image
FROM node:20

# Set working directory
WORKDIR /app

# Clean any existing frontend folder
RUN rm -rf frontend

# Clone the frontend repo
RUN git clone https://github.com/yield-sync/frontend.git frontend

# Set working directory to frontend
WORKDIR /app/frontend

# Pull latest changes (just to be sure)
RUN git pull origin main

# Install dependencies and build the frontend
RUN npm install && npm run build

# Go back to app dir
WORKDIR /app

# Copy backend files
COPY . .

# Install backend dependencies
RUN npm install

# Run the server
CMD ["npm", "start"]
