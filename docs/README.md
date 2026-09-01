# Documentação técnica

Este diretório complementa o [README principal](../README.md) com decisões, contratos e procedimentos verificáveis no código. A documentação descreve o estado atual do repositório; quando houver divergência, os arquivos de implementação indicados em cada guia são a fonte de verdade.

## Guias

| Guia | Para que serve | Fontes principais |
| --- | --- | --- |
| [Arquitetura](architecture/README.md) | entender componentes, responsabilidades, camadas e fluxo ponta a ponta | `apps/backend/src`, `apps/frontend/src`, `apps/infra` |
| [Protocolo WebSocket](websocket/README.md) | consultar comandos, eventos, validações, estados e sequências | controller, service e messenger |
| [Infraestrutura AWS](infrastructure/README.md) | operar Terraform, state, IAM, DynamoDB, logs e custos | `apps/infra/*.tf` |
| [Desenvolvimento local](development/README.md) | instalar, executar, testar em dois dispositivos e investigar erros | packages npm e Vite |
| [CI/CD e releases](ci-cd/README.md) | compreender workflows, OIDC, deploy, destroy e SemVer | `.github/workflows`, `.releaserc.json` |

## Trilhas de leitura

### Visão de produto e portfólio

Leia o [README principal](../README.md) e depois a [Arquitetura](architecture/README.md). Eles apresentam o problema resolvido, o desenho serverless e as decisões de escopo sem exigir conhecimento prévio do código.

### WebSocket e backend

Comece pelo [Protocolo WebSocket](websocket/README.md). O guia explica uma diferença importante desta arquitetura: a resposta HTTP da Lambda confirma o processamento para o API Gateway, enquanto a mensagem de aplicação retorna ao navegador por `PostToConnection` no endpoint `@connections`.

### AWS e entrega

Combine [Infraestrutura AWS](infrastructure/README.md) e [CI/CD e releases](ci-cd/README.md). O primeiro descreve o runtime; o segundo mostra como o código é validado, empacotado, implantado e versionado sem credenciais AWS permanentes no GitHub.

### Execução e diagnóstico

Use [Desenvolvimento local](development/README.md) para preparar Node.js 22, HTTPS local, acesso pela rede doméstica, webcam, `wscat` e CloudWatch.

## Mapa das fontes de verdade

| Assunto | Arquivo ou diretório autoritativo |
| --- | --- |
| Mensagens aceitas | `apps/backend/src/controllers/websocket-controller.ts` |
| Regras da partida | `apps/backend/src/models/game.ts` |
| Casos de uso | `apps/backend/src/services/game-service.ts` |
| Persistência | `apps/backend/src/repositories/game-repository.ts` |
| Mensagens de saída | `apps/backend/src/services/websocket-messenger.ts` |
| Rastreamento da mão | `apps/frontend/src/hooks/useHandTracking.js` |
| Renderização 3D | `apps/frontend/src/components/ChoiceScene.jsx` |
| Recursos AWS | `apps/infra/*.tf` |
| Validação e entrega | `.github/workflows/*.yml` |
| Versionamento | `.releaserc.json` e `CONTRIBUTING.md` |

## Convenções de manutenção

- Atualize o guia WebSocket quando um `action`, evento, campo ou validação mudar.
- Atualize a arquitetura e a infraestrutura quando um recurso AWS for incluído ou removido.
- Não documente SQS, VPC, NAT, cache ou hospedagem do frontend enquanto esses componentes não existirem no código.
- Não trate badges de build como cobertura de testes; o repositório ainda não possui suíte automatizada.
- Não declare versionamento do bucket de state: este repositório configura o backend S3, mas não cria nem audita o bucket global.
- Preserve a transparência sobre autenticação, custos e limitações do escopo atual.
