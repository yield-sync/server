FROM node:20

# Set working directory
WORKDIR /app

# Clone frontend during container startup
CMD bash -c "git clone https://github.com/yield-sync/frontend.git frontend && cd frontend && npm install && npm run build && cd .. && npm start"
