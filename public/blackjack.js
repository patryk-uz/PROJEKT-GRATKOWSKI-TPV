(() => {
  'use strict';

  window.initBlackjack = function initBlackjack(panel) {
    const dealerCards = panel.querySelector('#blackjack-dealer');
    const playerCards = panel.querySelector('#blackjack-player');
    const dealerScore = panel.querySelector('#blackjack-dealer-score');
    const playerScore = panel.querySelector('#blackjack-player-score');
    const result = panel.querySelector('#blackjack-result');
    const dealButton = panel.querySelector('#blackjack-deal');
    const hitButton = panel.querySelector('#blackjack-hit');
    const standButton = panel.querySelector('#blackjack-stand');
    let round = null;

    function shuffledDeck() {
      const ranks = ['A', '2', '3', '4', '5', '6', '7', '8', '9', '10', 'J', 'Q', 'K'];
      const deck = ['♠', '♥', '♦', '♣'].flatMap(suit =>
        ranks.map((rank, index) => ({
          label: rank + suit,
          value: rank === 'A' ? 11 : Math.min(index + 1, 10)
        }))
      );

      for (let index = deck.length - 1; index > 0; index--) {
        const other = Math.floor(Math.random() * (index + 1));
        [deck[index], deck[other]] = [deck[other], deck[index]];
      }

      return deck;
    }

    function score(hand) {
      let total = 0;
      let aces = 0;

      for (const card of hand) {
        total += card.value;
        if (card.value === 11) aces++;
      }

      while (total > 21 && aces > 0) {
        total -= 10;
        aces--;
      }

      return total;
    }

    function renderHand(container, cards, hideSecondCard, openingDeal) {
      cards.forEach((card, index) => {
        const hidden = hideSecondCard && index === 1;
        const label = hidden ? 'Zakryta karta' : card.label;
        const previous = container.children[index];

        if (previous?.dataset.card === label) return;

        const element = document.createElement('span');
        element.className = 'blackjack-card';
        element.dataset.card = label;
        element.textContent = hidden ? '◆' : label;

        if (hidden) {
          element.classList.add('is-hidden');
          element.setAttribute('aria-label', label);
        } else if (label.endsWith('♥') || label.endsWith('♦')) {
          element.classList.add('is-red');
        }

        if (openingDeal) {
          const position = index * 2 + Number(container === dealerCards);
          element.style.animationDelay = `${position * 85}ms`;
        }

        if (previous?.dataset.card === 'Zakryta karta') {
          element.classList.add('is-revealed');
        }

        if (previous) previous.replaceWith(element);
        else container.append(element);
      });
    }

    function render(openingDeal = false) {
      const active = Boolean(round && !round.outcome);

      dealButton.disabled = active;
      dealButton.textContent = round?.outcome ? 'Nowa runda' : 'Rozdaj karty';
      hitButton.disabled = !active;
      standButton.disabled = !active;
      dealerScore.textContent = round && !active ? `${score(round.dealer)} pkt` : '';
      playerScore.textContent = round ? `${score(round.player)} pkt` : '';

      if (round) {
        renderHand(dealerCards, round.dealer, active, openingDeal);
        renderHand(playerCards, round.player, false, openingDeal);
      }

      result.textContent = round?.outcome || (active ? 'Dobierz kartę albo spasuj.' : '');
    }

    function stand() {
      if (!round || round.outcome) return;

      while (score(round.dealer) < 17) {
        round.dealer.push(round.deck.pop());
      }

      const player = score(round.player);
      const dealer = score(round.dealer);

      if (dealer > 21 || player > dealer) round.outcome = 'Wygrywasz!';
      else if (player === dealer) round.outcome = 'Remis.';
      else round.outcome = 'Krupier wygrywa.';

      render();
    }

    dealButton.addEventListener('click', () => {
      if (round && !round.outcome) return;

      dealerCards.replaceChildren();
      playerCards.replaceChildren();

      const deck = shuffledDeck();
      const firstPlayerCard = deck.pop();
      const firstDealerCard = deck.pop();

      round = {
        deck,
        player: [firstPlayerCard, deck.pop()],
        dealer: [firstDealerCard, deck.pop()],
        outcome: ''
      };

      const playerBlackjack = score(round.player) === 21;
      const dealerBlackjack = score(round.dealer) === 21;

      if (playerBlackjack && dealerBlackjack) round.outcome = 'Remis. Oboje macie blackjacka.';
      else if (playerBlackjack) round.outcome = 'Blackjack! Wygrywasz.';
      else if (dealerBlackjack) round.outcome = 'Krupier wygrywa blackjackiem.';

      render(true);
      (hitButton.disabled ? dealButton : hitButton).focus();
    });

    hitButton.addEventListener('click', () => {
      if (!round || round.outcome) return;

      round.player.push(round.deck.pop());
      const total = score(round.player);

      if (total === 21) {
        stand();
        return;
      }

      if (total > 21) round.outcome = 'Przegrywasz. Masz więcej niż 21 punktów.';
      render();
    });

    standButton.addEventListener('click', stand);

    render();

    return {
      reset() {
        round = null;
        dealerCards.replaceChildren();
        playerCards.replaceChildren();
        render();
      },
      focus() {
        (hitButton.disabled ? dealButton : hitButton).focus();
      }
    };
  };
})();