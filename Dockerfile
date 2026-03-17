# 1. Base Image: Ne app ki Node.js version 18 kavali ani chepthunnam
FROM node:18

# 2. Work Directory: Docker lopala app ekkada undalo chepthunnam
WORKDIR /usr/src/app

# 3. Dependencies: Mundu package files copy chesi, 'npm install' chestunnam
COPY package*.json ./
RUN npm install

# 4. Copy Code: Ippudu ne local computer lo unna code antha Docker ki copy chestunnam
COPY . .

# 5. Port: Docker container ae port meeda run avthundo chepthunnam
EXPOSE 3000

# 6. Start Command: App ni start cheyadaniki command
CMD [ "npm", "start" ]