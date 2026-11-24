# Lab de Manufatura Aditiva 3D

Jogo 3D em primeira pessoa no navegador (Vite + Three.js). Recria em low-poly o laboratório de manufatura aditiva do SENAI/WorldSkills. O jogador fatia peças no computador e as imprime em FDM ou em resina, vendo cada camada ser construída.

## Jogar online
https://marcvinic12.github.io/joguinho/

## Rodar localmente
```bash
npm install
npm run dev      # abre em http://localhost:5173
npm run build    # gera a versão estática em dist/ (pode ir para o GitHub Pages)
```

## Controles
| Tecla | Ação |
|---|---|
| W A S D / setas | mover |
| Shift | correr |
| Mouse | olhar (Pointer Lock) |
| E ou clique | interagir com o objeto na mira |
| ESC | sair do fatiador / pausar |

## Fluxo do jogo
1. Vá até a estação com dois monitores e pressione **E** para abrir o fatiador.
2. Escolha a peça e a tecnologia (FDM ou Resina), ajuste os parâmetros e o material e clique em **Fatiar**. O fatiamento leva de 15 a 30 s.
3. Clique em **Enviar para a impressora**. Se marcar "Iniciar automaticamente", a impressão começa sozinha.
4. Vá até a impressora e pressione **E** para iniciar. Acompanhe pelo painel do HUD ou pela tela da máquina.
5. Quando chegar a 100%, pressione **E** para retirar a peça. Ela vai para a mesa "Peças Produzidas".

## Arquitetura
```
src/
├── main.js         renderer, loop, máquina de estados (menu / play / slicer)
├── scene.js        layout do laboratório + colisores AABB + âncoras das impressoras
├── props.js        fábricas low-poly (mesa, cadeira, monitor, CNC, divisória, turbina…)
├── textures.js     texturas procedurais via Canvas (piso, telas, banners, relógio…)
├── models.js       peças procedurais: engrenagem, cubo, vaso torcido, suporte em L
├── player.js       PointerLockControls + WASD + colisão
├── interaction.js  raycast central + handlers { getPrompt, onInteract }
├── hud.js          mira, dicas, toasts, painel das impressoras, inventário
├── slicerUI.js     software de fatiamento (preview 3D próprio, estimativas, slider de camadas)
└── printers.js     FDMPrinter / ResinPrinter (estados, animação, clipping planes)
```

**Como a impressão camada por camada funciona:** cada peça usa `material.clippingPlanes` com `renderer.localClippingEnabled = true`.
- **FDM:** um plano horizontal mostra apenas `y ≤ mesa + altura impressa`. A altura é quantizada pelo número real de camadas.
- **Resina:** a peça é invertida e presa à plataforma. O plano mostra apenas `y ≥ plataforma − progresso × altura`. Assim a peça "emerge" da cuba enquanto a plataforma sobe, com ciclos de exposição UV e de descolamento.
- Nas duas impressoras, um terceiro material recortado por dois planos desenha a faixa brilhante da camada atual: laranja (bico quente) na FDM e roxa (UV) na resina.
- Um material `BackSide` escurecido faz a seção cortada parecer sólida.

Tudo é gerado de forma procedural. O projeto não usa modelos `.glb`, imagens externas nem dependências além do `three`.

Para depurar, abra o console e use `window.lab`. Ele dá acesso a `scene`, `camera`, `fdm`, `resin`, `slicer`, `player` e `interaction`.
