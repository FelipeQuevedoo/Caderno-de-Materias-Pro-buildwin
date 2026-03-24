# Plano de saneamento final

## Bloco 1 — Correções imediatas de usabilidade e comandos
Status: parcialmente aplicado nesta entrega.

Inclui:
- botão rotulado **Cor da Matéria** na criação da matéria;
- reforço do editor para preservar foco/seleção ao clicar na toolbar;
- ajuste dos botões de lista ordenada e não ordenada;
- presets de marca-texto: amarelo limão (padrão), verde limão e azul claro;
- painel funcional de caracteres especiais;
- menu de contexto com copiar, recortar, colar, selecionar tudo, desfazer e refazer;
- ações de tabela no menu de contexto quando o cursor estiver em tabela.

## Bloco 2 — Reorganização da lateral esquerda e novo fluxo de assuntos
Objetivo:
- mover a toolbar para a lateral esquerda;
- renomear o cabeçalho para **Opções e Ferramentas**;
- integrar busca e assunto na barra lateral;
- adicionar **Novo Assunto** de forma formal na modelagem.

Risco de regressão: médio/alto, pois mexe no layout e no fluxo de navegação.

## Bloco 3 — Imagens e papel
Objetivo:
- permitir posicionamento/alinhamento útil de imagens;
- melhorar papel pautado/liso;
- revisar cabeçalhos de página e comportamento do assunto.

Risco de regressão: médio.

## Bloco 4 — Réguas e zoom
Objetivo:
- fazer as réguas aparecerem e responderem corretamente;
- alinhar zoom da folha e da interface conforme o uso desejado.

Risco de regressão: alto, pois mistura layout, escala e cálculo visual.

## Bloco 5 — Dados, portabilidade e acabamento
Objetivo:
- reduzir uso de Base64 no JSON para imagens;
- migrar imagens para pasta própria de assets quando necessário;
- validar build, empacotamento e checklist fixo de regressão.

Risco de regressão: médio.
