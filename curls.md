# Testes

## Primeiro suba tudo com docker compose up --build -d

### 𖦹 **1. Verificar se todas as requisições passam pelo Kong**
A porta 3000 deve bloquear requisições diretas.  
A porta 8000 (Kong) deve permitir.

```bash
curl http://localhost:3000/products     # deve falhar
curl http://localhost:8000/products     # deve funcionar
```

### 𖦹 **2. Testar o cache das rotas**
É possível acompanhar esse processo em http://localhost:8082.

```bash
curl http://localhost:8000/users/1
curl http://localhost:8000/payments/types
curl http://localhost:8000/products
curl http://localhost:8000/orders/1
```

### 𖦹 **3. Testar o rate limiting**
Vai gerar erro de requisições demais.

```bash
1..11 | ForEach-Object {
    Invoke-WebRequest -Uri "http://localhost:8000/products" -Method GET
}
```

### 𖦹 **4. Testar limite máximo de tamanho por request (200kb)**
O arquivo do comando já está presente no repositório.
Deve resultar em erro "payload too large".

```bash
Invoke-WebRequest `
  -Uri "http://localhost:8000/products" `
  -Method POST `
  -ContentType "application/octet-stream" `
  -InFile ".\big.bin"
```

### 𖦹 **5. Testar acessibilidade do notifications service**
O notifications só é acessível internamente.
```bash
curl http://localhost:8000/notification      # deve falhar
docker exec -it ms_orders curl http://notification:3000   # deve funcionar
```

### 𖦹 **6. Testar fluxo Orders → Kafka → Payments**
Criar um pedido:

```bash
$body = @{
    productId = 1
    quantity  = 1
    userId    = 1
} | ConvertTo-Json

Invoke-WebRequest `
  -Uri "http://localhost:8000/orders" `
  -Method POST `
  -ContentType "application/json" `
  -Body $body
```

Ver logs do payments service:

```bash
docker logs ms_payments --tail 50
```

### 𖦹 **7. Testar fluxo Payments → RabbitMQ → Notifications**
O Payment Service envia o evento para RabbitMQ.
O Notification Service consome e loga a mensagem:

```bash
docker logs ms_notification --tail 50
```

Deve retornar a confirmação do pedido.
