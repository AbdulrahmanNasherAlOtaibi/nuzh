FROM node:22-slim
WORKDIR /app
COPY package.json package-lock.json* ./
RUN npm install
COPY . .
RUN npm run build
ENV PORT=5001
EXPOSE 5001
VOLUME ["/app/data"]
CMD ["npm", "start"]
