FROM node:20

# Set working directory
WORKDIR /app

# Clone frontend repo (will re-run when CACHE_BUSTER changes)
RUN echo "Cache busting arg: $CACHE_BUSTER" && git clone https://github.com/yield-sync/frontend.git frontend

# Go to frontend repo
WORKDIR /app/frontend

# Install npm packages and build the frontend
RUN npm install && npm run build

# Go back to server root
WORKDIR /app

# Copy server files
COPY . .

# Install server dependencies
RUN npm install

# Start the server
CMD ["npm", "start"]