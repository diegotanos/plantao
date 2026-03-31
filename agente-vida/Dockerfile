FROM node:20-alpine

WORKDIR /app

# Instala dependências do sistema necessárias
RUN apk add --no-cache curl

# Copia manifesto e instala dependências de produção
COPY package*.json ./
RUN npm ci --only=production

# Copia o código da aplicação
COPY . .

# Usuário não-root por segurança
RUN addgroup -S agente && adduser -S agente -G agente
USER agente

EXPOSE 3000

CMD ["node", "api/server.js"]
