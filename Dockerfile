# At the top of Dockerfile
FROM node:20

# Go to app dir
WORKDIR /app

# Remove any existing frontend directory to ensure we get the latest version
RUN rm -rf frontend

# This layer will be invalidated if CACHE_BUSTER changes
RUN git clone https://github.com/yield-sync/frontend.git frontend

WORKDIR /app/frontend

# Pull latest changes (if any)
RUN git pull origin main

# Install npm packages and rebuild if something was pulled
RUN npm install && npm run build

WORKDIR /app

# Copy server files
COPY . .
RUN npm install

CMD ["npm", "start"]
