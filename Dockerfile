# At the top of Dockerfile
ARG CACHE_BUSTER=default
FROM node:20

ARG CACHE_BUSTER
RUN echo "Cache busting arg: $CACHE_BUSTER"

WORKDIR /app

# This layer will be invalidated if CACHE_BUSTER changes
RUN git clone https://github.com/yield-sync/frontend.git frontend

WORKDIR /app/frontend
RUN npm install && npm run build

WORKDIR /app
COPY . .
RUN npm install

CMD ["npm", "start"]