# Pedra, Papel e Tesoura com WebSocket

Jogo para duas pessoas usando API Gateway WebSocket, AWS Lambda e DynamoDB. A infraestrutura fica em `us-east-1` e não utiliza VPC, NAT, cache ou servidores persistentes.

## Executar o cliente

Após um deploy, sirva os arquivos estáticos e abra duas abas do navegador:

```bash
cd apps/frontend
npm install
npm run dev
```

A URL WebSocket implantada já vem preenchida na interface. Ela também pode ser alterada no campo superior.

## Mensagens do cliente

```json
{ "action": "createRoom" }
{ "action": "joinRoom", "roomCode": "ABC123" }
{ "action": "play", "choice": "rock" }
```

O backend responde pelo mesmo WebSocket. O estado da sala é gravado no DynamoDB sob demanda, e as respostas são enviadas com a API `@connections` do API Gateway.
