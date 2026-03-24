# Caderno Portatil - Build Windows

## Desenvolvimento

1. Instale dependencias:
   - `npm install`
2. Rode interface web:
   - `npm run dev`
3. Rode desktop local com hot reload (Vite + Electron):
   - `npm run dev:desktop`
4. Rode desktop apontando para build local (sem dev server):
   - `npm run build`
   - `npm run start`

## Build da interface

1. Gere `dist`:
   - `npm run build`

## Empacotar para Windows

1. Gere executaveis portable e setup:
   - `npm run pack:win`
2. Apenas executavel portatil:
   - `npm run pack:portable`
3. Saida esperada:
   - `release/Caderno-Portatil-<versao>.exe`
   - `release/Caderno-Portatil-Setup-<versao>.exe`

## Persistencia portatil

- Desktop Electron salva no arquivo:
  - `portable-data/notebook.json`
- O diretorio base e:
  - `PORTABLE_EXECUTABLE_DIR` quando disponivel (build portable)
  - ou pasta do executavel quando `PORTABLE_EXECUTABLE_DIR` nao existir
