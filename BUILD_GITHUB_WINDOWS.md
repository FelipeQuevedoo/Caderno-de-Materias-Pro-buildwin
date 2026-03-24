# Build correto do .exe portátil no GitHub

O `.exe` portátil deve ser gerado em **runner Windows** do GitHub Actions.

## Motivo
Build de Windows feito em Linux com Wine pode até gerar artefato, mas é mais sujeito a falhas de empacotamento. Para este projeto, o fluxo recomendado é:

- Ubuntu: apenas validar `npm ci` e `npm run build`
- Windows: gerar `portable` e `nsis`

## Como usar
1. Envie este projeto ao GitHub.
2. Vá em **Actions**.
3. Execute o workflow **Build Windows Portable**.
4. Ao final, baixe o artifact `caderno-portatil-windows`.

## Saída esperada
Na pasta `release/` do job Windows:

- `Caderno-Portatil-1.0.0.exe` (portátil, arquivo único)
- `Caderno-Portatil-Setup-1.0.0.exe` (instalador NSIS)

## Observação
Se o objetivo for testar apenas se o app compila, use `npm run build`.
Se o objetivo for distribuição ao usuário final, use o workflow Windows.
