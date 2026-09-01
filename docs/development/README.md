# Desenvolvimento local

[← Índice da documentação](../README.md)

## Pré-requisitos

Obrigatórios para o frontend e o build:

- Git;
- Node.js 22;
- npm.

Para infraestrutura e diagnóstico AWS:

- Terraform 1.6 ou superior;
- AWS CLI v2;
- credenciais com acesso ao backend de state e às operações necessárias;
- uma URL WebSocket já implantada.

O repositório não possui emulador de API Gateway/DynamoDB nem um servidor backend local. Durante o desenvolvimento, o frontend local conversa com o runtime AWS.

## Clonar

```bash
git clone git@github.com:kaiotcp1/Websocket.git
cd Websocket
```

## Frontend

```bash
cd apps/frontend
npm ci
npm run dev
```

O Vite está configurado com:

- HTTPS local por `@vitejs/plugin-basic-ssl`;
- bind em `0.0.0.0`, permitindo acesso pela LAN;
- Tailwind CSS compilado durante o build;
- porta inicial padrão 5173; se estiver ocupada, o Vite escolhe outra e mostra a URL correta.

Abra a URL exibida no terminal, por exemplo:

```text
https://localhost:5173
```

Aceite o certificado de desenvolvimento. O campo “URL do WebSocket” aceita apenas `wss://` e guarda o último valor no `localStorage`.

### Build de produção

```bash
cd apps/frontend
npm run build
```

Arquivos são gerados em `apps/frontend/dist` e não são versionados.

```bash
npm run preview
```

`preview` é útil para validar o bundle. Para webcam em outro dispositivo, prefira o dev server HTTPS ou uma hospedagem com certificado válido.

## Backend

```bash
cd apps/backend
npm ci
npm run typecheck
npm run build
```

O build usa esbuild para gerar CommonJS compatível com Lambda Node.js 22:

```text
apps/backend/dist/handlers/connect.js
apps/backend/dist/handlers/default.js
apps/backend/dist/handlers/disconnect.js
```

O `GameRepository` exige `GAME_TABLE_NAME`, mas isso não impede type-check/build. Terraform injeta a variável nas Lambdas `default` e `disconnect`; não existe um processo local que deva receber esse valor no fluxo normal.

## Testar uma partida no navegador

Use dois navegadores, perfis ou dispositivos. Cada aba precisa criar sua própria conexão WebSocket.

- conecte os dois clientes ao mesmo endpoint `wss://`;
- no primeiro cliente, selecione “Criar sala”;
- copie o código de seis caracteres;
- no segundo, informe o código e entre;
- ative a webcam em cada dispositivo;
- mantenha pedra, papel ou tesoura por aproximadamente 850 ms;
- depois das duas escolhas, os clientes recebem o resultado e as choices reveladas.

Uma sala aceita apenas duas conexões e representa uma rodada. Para jogar novamente, crie outra sala.

## Testar em outro dispositivo da rede

Descubra o IPv4 do computador que executa o Vite.

Windows:

```powershell
ipconfig
```

Linux:

```bash
ip addr
```

No outro dispositivo, abra a URL exata e a porta exibida pelo Vite:

```text
https://192.168.0.21:5173
```

Verifique:

- ambos estão na mesma rede e não há isolamento de clientes no roteador;
- o Vite mostra `Network` porque está em `0.0.0.0`;
- a porta usada é a realmente impressa no terminal;
- o firewall permitiu conexões de rede ao Node.js;
- o outro dispositivo aceitou o certificado HTTPS;
- a permissão de câmera foi concedida naquele navegador.

`http://<IPv4>` não é suficiente para webcam. Fora de `localhost`, `getUserMedia` exige um contexto seguro, normalmente HTTPS.

## MediaPipe e webcam

Ao ativar a câmera, o frontend:

1. solicita `navigator.mediaDevices.getUserMedia`;
2. baixa o runtime WASM de `cdn.jsdelivr.net`;
3. baixa o modelo Hand Landmarker do Google Storage;
4. processa a imagem no próprio navegador;
5. mantém o vídeo no dispositivo;
6. envia somente 21 landmarks e metadados ao oponente.

Sem internet, o restante da interface pode abrir, mas o Hand Landmarker não é inicializado.

O vídeo mostrado está espelhado apenas por CSS para oferecer uma experiência de selfie. Os pontos do detector são convertidos para o espaço dos modelos WebXR durante a renderização 3D.

## Teste WebSocket via terminal

Obtenha o endpoint pelo Terraform:

```bash
terraform -chdir=apps/infra output -raw websocket_url
```

Conecte com `wscat`:

```bash
npx --yes wscat -c wss://<api-id>.execute-api.us-east-1.amazonaws.com/dev
```

Criar sala:

```json
{"action":"createRoom"}
```

Entrar, em outro terminal:

```json
{"action":"joinRoom","roomCode":"ABC123"}
```

Jogar:

```json
{"action":"play","choice":"rock"}
```

O servidor não implementa `ping` como action. Enviar `{"action":"ping"}` testa a validação e deve produzir um evento `error`, não uma resposta pong.

## Terraform local

Build do artefato:

```bash
cd apps/backend
npm ci
npm run typecheck
npm run build
```

Preparação e validação:

```bash
cd ../infra
cp terraform.tfvars.example terraform.tfvars
terraform fmt -check -recursive
terraform init
terraform validate
terraform plan
```

O bucket remoto precisa existir e suas credenciais devem poder ler o state e criar o lock S3. Não use `-backend=false` para um plan/apply real, pois isso separaria a operação do state compartilhado pela pipeline.

Antes de qualquer apply ou push para `main`, revise `apps/infra/locals.tf` e o plano. Consulte [Infraestrutura AWS](../infrastructure/README.md) para a matriz de provisionamento/destroy.

## Logs

### Lambda default

PowerShell, CMD, Linux ou macOS:

```bash
aws logs tail "/aws/lambda/rock-paper-scissors-dev-default" --since 10m --follow --region us-east-1
```

Git Bash no Windows converte caminhos iniciados por `/`. Desative a conversão:

```bash
MSYS_NO_PATHCONV=1 aws logs tail /aws/lambda/rock-paper-scissors-dev-default --since 10m --follow --region us-east-1
```

Outros grupos:

```text
/aws/lambda/rock-paper-scissors-dev-connect
/aws/lambda/rock-paper-scissors-dev-disconnect
/aws/apigateway/rock-paper-scissors-dev
API-Gateway-Execution-Logs_<api-id>/dev
```

## Verificações antes de enviar código

```bash
cd apps/backend
npm ci
npm run typecheck
npm run build

cd ../frontend
npm ci
npm run build

cd ../infra
terraform fmt -check -recursive
terraform init -backend=false
terraform validate
```

Esses comandos reproduzem as verificações principais da CI sem tocar na AWS.

## Problemas comuns

### `Cannot read properties of undefined (reading 'getUserMedia')`

A página provavelmente foi aberta por HTTP em um IP da rede. Use a URL `https://`, aceite o certificado no próprio dispositivo e confira permissões da câmera.

### Outro dispositivo não abre o Vite

Confira IP, porta, mesma rede, firewall, isolamento do roteador e se o Vite continua em execução. Não presuma que a porta é 5173 se o terminal mostrou 5174 ou outra.

### O WebSocket não conecta

- confirme que a URL começa com `wss://`;
- verifique se o runtime não foi destruído;
- confira o output `websocket_url` do state atual;
- consulte access logs e a Lambda `$connect`;
- confirme região e stage.

### A sala não é criada

Observe a Lambda `default`, a tabela e as permissões IAM. `$connect` apenas aceita o socket; criar sala é um comando posterior processado por `$default`.

### Oponente não acompanha a mão com a mesma fidelidade

O frontend possui fallback para deployments antigos que retornam apenas landmarks de tela. Faça o deploy das mudanças do backend para transmitir `worldLandmarks` e `handedness`.

### Mudança de backend não apareceu no navegador

Salvar o frontend atualiza a interface pelo HMR. Alterar Lambda/Terraform exige novo build e deploy AWS; apenas atualizar a página não troca o código implantado.

### AWS CLI rejeita o nome do log group no Git Bash

Use `MSYS_NO_PATHCONV=1` antes do comando. O erro é conversão de caminho do shell, não um nome inválido no CloudWatch.

## Assets 3D

Os modelos de mão estão em `apps/frontend/public/models`. Consulte `ATTRIBUTION.md` antes de substituir ou redistribuir assets. Os modelos genéricos atuais vêm do projeto WebXR Input Profiles e mantêm sua atribuição própria.
