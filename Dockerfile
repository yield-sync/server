# Start with the Node.js image
FROM node:20

# Set the working directory
WORKDIR /app

# Copy files into the container
COPY . .

# Install dependencies
RUN npm install

# Start the app
CMD ["npm", "start"]
