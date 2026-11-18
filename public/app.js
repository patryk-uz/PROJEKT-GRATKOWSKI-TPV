/* Zwykły JavaScript. Wynik i saldo rozlicza istniejąca funkcja w Supabase. */
(() => {
  'use strict';
  const $ = id => document.getElementById(id);
  const status = message => { $('status').textContent = message || ''; };
  if (!window.supabase || typeof window.supabase.createClient !== 'function') {
    status('Nie udało się wczytać biblioteki Supabase. Wgraj folder public/vendor z paczki i odśwież stronę.');
    return;
  }
  const client = window.supabase.createClient(
    'https://tnpvcbdoocdxsepauzdm.supabase.co',
    'sb_publishable_hcSnixt194jfNd00iaFHEA_0N4IHhzF'
  );
  const reds = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
  const europeanOrder = [0,32,15,19,4,21,2,25,17,34,6,27,13,36,11,30,8,23,10,5,24,16,33,1,20,14,31,9,22,18,29,7,28,12,35,3,26];
  const labels = {red:'Czerwone',black:'Czarne',even:'Parzyste',odd:'Nieparzyste',number:'Numer'};
  let user = null, balance = null, pending = null, busy = false, authBusy = false, generation = 0;
  let wheelRotation = 0;
  let audioContext = null, rouletteTickTimer = null;
  let soundEnabled = localStorage.getItem('casino-sound') !== 'off';

  function ensureAudio() {
    if (!soundEnabled) return null;
    if (!audioContext) {
      const AudioContextClass = window.AudioContext || window.webkitAudioContext;
      if (!AudioContextClass) return null;
      audioContext = new AudioContextClass();
    }
    if (audioContext.state === 'suspended') audioContext.resume().catch(() => {});
    return audioContext;
  }

  function playTone(frequency, duration, volume = 0.05, type = 'triangle', delay = 0) {
    const context = ensureAudio();
    if (!context) return;
    const start = context.currentTime + delay;
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, start);
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    oscillator.connect(gain);
    gain.connect(context.destination);
    oscillator.start(start);
    oscillator.stop(start + duration);
  }

  function stopRouletteSound() {
    if (rouletteTickTimer) clearTimeout(rouletteTickTimer);
    rouletteTickTimer = null;
  }

  function startRouletteSound(duration) {
    stopRouletteSound();
    if (!soundEnabled) return;
    ensureAudio();
    playTone(110, 0.12, 0.025, 'sawtooth');
    const startedAt = performance.now();

    function tick() {
      if (!soundEnabled) return;
      const elapsed = performance.now() - startedAt;
      const progress = Math.min(elapsed / duration, 1);
      if (progress >= 1) return;
      playTone(620 - progress * 240, 0.035, 0.018 + progress * 0.012, 'triangle');
      const nextDelay = 65 + progress * progress * 170;
      rouletteTickTimer = setTimeout(tick, nextDelay);
    }
    tick();
  }

  function playResultSound(won) {
    stopRouletteSound();
    if (!soundEnabled) return;
    if (won) {
      [523.25, 659.25, 783.99, 1046.5, 783.99, 1046.5].forEach((frequency, index) => {
        playTone(frequency, index >= 3 ? 0.42 : 0.28, 0.075, index % 2 ? 'triangle' : 'square', index * 0.11);
      });
      playTone(1046.5, 0.9, 0.035, 'sine', 0.62);
    } else {
      playTone(220, 0.32, 0.06, 'sawtooth');
      playTone(174.61, 0.38, 0.055, 'triangle', 0.22);
      playTone(130.81, 0.55, 0.065, 'sine', 0.48);
    }
  }

  function showRouletteResult(row) {
    const won = Number(row.payout) > 0;
    const overlay = $('roulette-overlay');
    const card = $('roulette-overlay-card');
    const payout = Number(row.payout);
    const bet = Number(row.bet);
    const profit = payout - bet;
    card.classList.remove('win', 'loss');
    card.classList.add(won ? 'win' : 'loss');
    $('roulette-overlay-icon').textContent = won ? '🏆' : '💔';
    $('roulette-overlay-kicker').textContent = won ? 'Zwycięstwo!' : 'Przegrana';
    $('roulette-overlay-title').textContent = won ? 'WYGRAŁEŚ' : 'SPRÓBUJ PONOWNIE';
    $('roulette-overlay-detail').textContent =
      `Wynik: ${row.result} · ${won ? `Wygrana: ${profit} żetonów` : `Strata: ${bet} żetonów`} · Saldo: ${row.balance_after}`;
    card.querySelectorAll('.roulette-confetti').forEach(element => element.remove());
    if (won) {
      const colors = ['#facc15','#22c55e','#38bdf8','#f472b6','#fb7185'];
      for (let index = 0; index < 28; index++) {
        const confetti = document.createElement('i');
        confetti.className = 'roulette-confetti';
        confetti.style.setProperty('--x', `${Math.random() * 100}%`);
        confetti.style.setProperty('--duration', `${1.4 + Math.random() * 1.1}s`);
        confetti.style.setProperty('--delay', `${Math.random() * 0.45}s`);
        confetti.style.background = colors[index % colors.length];
        card.append(confetti);
      }
    }
    overlay.hidden = false;
  }

  function updateSoundButton() {
    const button = $('sound-toggle');
    if (!button) return;
    button.textContent = soundEnabled ? 'Dźwięk: wł.' : 'Dźwięk: wył.';
    button.setAttribute('aria-pressed', String(soundEnabled));
  }

  function buildRouletteWheel() {
    const wheel = $('roulette-wheel');
    const numbers = $('roulette-numbers');
    const segment = 360 / europeanOrder.length;
    const gradient = europeanOrder.map((number, index) => {
      const color = number === 0 ? '#16a34a' : reds.includes(number) ? '#dc2626' : '#111827';
      const start = (index * segment).toFixed(4);
      const end = ((index + 1) * segment).toFixed(4);
      return `${color} ${start}deg ${end}deg`;
    }).join(',');
    wheel.style.background = `conic-gradient(from -${(segment / 2).toFixed(4)}deg,${gradient})`;
    europeanOrder.forEach((number, index) => {
      const element = document.createElement('span');
      element.className = 'roulette-number ' + (number === 0 ? 'green' : reds.includes(number) ? 'red' : 'black');
      element.textContent = String(number);
      const angle = (index * segment - 90) * Math.PI / 180;
      element.style.left = `${50 + Math.cos(angle) * 42}%`;
      element.style.top = `${50 + Math.sin(angle) * 42}%`;
      numbers.append(element);
    });
  }

  async function animateRoulette(result) {
    const stage = document.querySelector('.roulette-stage');
    const wheel = $('roulette-wheel');
    const ball = $('roulette-ball');
    const reducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const index = europeanOrder.indexOf(Number(result));
    if (index < 0) return;
    const segment = 360 / europeanOrder.length;
    const normalized = ((wheelRotation % 360) + 360) % 360;
    const targetNormalized = (((-index * segment) % 360) + 360) % 360;
    const align = (targetNormalized - normalized + 360) % 360;
    const target = wheelRotation + (reducedMotion ? align : 5 * 360 + align);
    stage.classList.remove('result-winner');
    [...document.querySelectorAll('.roulette-number')].forEach(element => element.classList.remove('is-winner'));
    stage.classList.add('is-spinning');
    const duration = reducedMotion ? 350 : 2800;
    startRouletteSound(duration);
    const ballFrames = [];
    if (reducedMotion) {
      ballFrames.push({ transform: 'rotate(0deg) translateY(-104px)' });
    } else {
      for (let step = 0; step <= 36; step++) {
        const progress = step / 36;
        const eased = 1 - Math.pow(1 - progress, 3);
        const angle = -eased * 7 * 360;
        const radius = 104 - progress * 40;
        ballFrames.push({ transform: `rotate(${angle}deg) translateY(${-radius}px)` });
      }
    }
    ball.style.opacity = '1';
    const ballAnimation = ball.animate(
      ballFrames,
      { duration, easing: 'cubic-bezier(.16,.72,.18,1)', fill: 'forwards' }
    );
    const animation = wheel.animate(
      [{ transform: `rotate(${wheelRotation}deg)` }, { transform: `rotate(${target}deg)` }],
      { duration, easing: 'cubic-bezier(.12,.68,.08,1)', fill: 'forwards' }
    );
    await Promise.all([animation.finished.catch(() => {}), ballAnimation.finished.catch(() => {})]);
    wheelRotation = target;
    wheel.style.transform = `rotate(${wheelRotation}deg)`;
    animation.cancel();
    ballAnimation.cancel();
    ball.style.opacity = '0';
    stage.classList.remove('is-spinning');
    stage.classList.add('result-winner');
    const winner = [...document.querySelectorAll('.roulette-number')]
      .find(element => element.textContent === String(result));
    if (winner) winner.classList.add('is-winner');
    setTimeout(() => stage.classList.remove('result-winner'), 1000);
  }
  buildRouletteWheel();
  updateSoundButton();
  const key = () => 'casino-pending-' + user.id;
  const message = error => {
    const text = error?.message || 'Nie udało się połączyć. Spróbuj ponownie.';
    if (text.includes('Invalid login credentials')) return 'Niepoprawny e-mail lub hasło.';
    if (text.includes('Email not confirmed')) return 'Najpierw potwierdź adres e-mail.';
    if (text.includes('Email address not authorized')) return 'Supabase nie może wysłać wiadomości na ten adres. Administrator musi skonfigurować SMTP lub utworzyć konto testowe w panelu.';
    if (text.includes('Failed to fetch')) return 'Brak połączenia z Supabase. Sprawdź internet i spróbuj ponownie.';
    return text;
  };
  async function limited(promise) {
    let timer;
    try { return await Promise.race([promise,new Promise((_,reject)=>{ timer=setTimeout(()=>reject(new Error('Przekroczono czas oczekiwania na Supabase. Spróbuj ponownie.')),15000); })]); }
    finally { clearTimeout(timer); }
  }
  function controls() {
    $('bet-fields').disabled = busy || !!pending || balance === null;
    $('spin').disabled = busy || (balance === null && !pending);
    $('spin').textContent = busy ? 'Sprawdzam…' : pending ? 'Sprawdź poprzedni zakład' : 'Zakręć';
    $('refresh').disabled = busy;
    $('logout').disabled = busy;
    $('back').disabled = busy;
    $('login').disabled = authBusy;
    $('signup').disabled = authBusy;
  }
  function showGame(show) { $('menu').hidden = show; $('roulette').hidden = !show; }
  function renderHistory(rows) {
    $('history').replaceChildren(); $('empty-history').hidden = rows.length > 0;
    rows.forEach(row => {
      const tr = document.createElement('tr');
      [new Date(row.played_at).toLocaleString('pl-PL'),labels[row.bet_type] || row.bet_type,row.bet,row.result,row.payout,row.balance_after].forEach(value=>{
        const td=document.createElement('td');td.textContent=String(value);tr.append(td);
      });
      $('history').append(tr);
    });
  }
  async function refresh(expected = generation) {
    const result = await limited(client.rpc('casino_open_wallet'));
    if (expected !== generation || !user) return;
    if (result.error) throw result.error;
    balance = Number(result.data); $('balance').textContent = String(balance); controls();
    const history = await limited(client.from('casino_rounds').select('request_id,played_at,bet,bet_type,result,payout,balance_after').order('played_at',{ascending:false}).limit(20));
    if (expected !== generation || !user) return;
    if (history.error) throw history.error;
    renderHistory(history.data || []);
  }
  async function changeSession(session) {
    const next = session?.user || null;
    if (user && next?.id === user.id) return;
    user=next;generation++;balance=null;pending=null;busy=false;
    $('balance').textContent='—';$('account').textContent=user?.email || '';
    $('auth-panel').hidden=!!user;$('game-panel').hidden=!user;$('result').textContent='';
    renderHistory([]);showGame(false);status('');controls();
    if (!user) return;
    const expected=generation;
    try {
      const saved=JSON.parse(localStorage.getItem(key()) || 'null');
      if(saved && typeof saved.p_request_id==='string') {pending=saved;showGame(true);status('Poprzedni zakład wymaga sprawdzenia. Kliknij „Sprawdź poprzedni zakład”.');}
    } catch (_) {status('Nie można odczytać pamięci poprzednich prób. Upewnij się, że przeglądarka pozwala zapisywać dane strony.');}
    controls();
    try {await refresh(expected);} catch(e) {if(expected===generation)status(message(e));}
  }
  async function authenticate(register) {
    if(authBusy || !$('auth-form').reportValidity()) return;
    authBusy=true;controls();status('Łączenie…');
    try {
      const credentials={email:$('email').value.trim(),password:$('password').value};
      const result=await limited(register
        ? client.auth.signUp({...credentials,options:{emailRedirectTo:location.origin+'/'}})
        : client.auth.signInWithPassword(credentials));
      if(result.error) throw result.error;
      $('password').value='';
      if(result.data?.session) await changeSession(result.data.session);
      else status(register ? 'Sprawdź pocztę i potwierdź adres e-mail. Potem zaloguj się.' : 'Sprawdź dane logowania.');
    } catch(e) {status(message(e));}
    finally {authBusy=false;controls();}
  }
  async function spin(event) {
    event.preventDefault(); if(busy || !user) return;
    ensureAudio();
    const bet=Number($('bet').value), type=$('bet-type').value, number=Number($('number').value);
    if(!pending && (!Number.isSafeInteger(bet)||bet<1||bet>1000||balance===null||bet>balance)) {status('Stawka musi wynosić 1–1000 całych żetonów i nie przekraczać salda.');return;}
    if(!pending && type==='number' && (!Number.isInteger(number)||number<0||number>36)) {status('Wybierz numer od 0 do 36.');return;}
    const expected=generation, storageKey=key();busy=true;controls();status('Rozliczanie zakładu…');
    try {
      if(!pending) {
        const request={p_request_id:crypto.randomUUID(),p_bet:bet,p_type:type,p_number:type==='number'?number:null};
        // Zachowaj identyfikator PRZED wysłaniem. W razie utraty odpowiedzi ponawiamy tę samą rundę.
        localStorage.setItem(storageKey,JSON.stringify(request)); pending=request;
      }
      const result=await limited(client.rpc('casino_spin',pending));
      if(expected!==generation) return;
      if(result.error) {
        // Błąd PostgreSQL oznacza wycofanie transakcji. Przy błędzie sieci zachowaj próbę.
        if(result.error.code && (/^[0-9A-Z]{5}$/.test(result.error.code)||result.error.code.startsWith('PGRST'))) {
          localStorage.removeItem(storageKey);pending=null;
        }
        throw result.error;
      }
      const row=result.data;
      localStorage.removeItem(storageKey);pending=null;
      balance=Number(row.balance_after);$('balance').textContent=String(balance);
      await animateRoulette(row.result);
      const won = Number(row.payout) > 0;
      playResultSound(won);
      showRouletteResult(row);
      const color=row.result===0?'zielony':reds.includes(row.result)?'czerwony':'czarny';
      $('result').textContent=`Wynik: ${row.result} (${color}). Wypłata: ${row.payout} żetonów. Zmiana salda: ${row.payout-row.bet}.`;
      status('');
      try {await refresh(expected);} catch(_) {status('Runda została rozliczona, ale nie udało się odświeżyć historii. Kliknij „Odśwież”.');}
    } catch(e) {if(expected===generation)status(message(e)+(pending?' Kliknij „Sprawdź poprzedni zakład”, aby sprawdzić tę samą rundę bez ponownego obciążenia.':''));}
    finally {if(expected===generation){busy=false;controls();}}
  }
  $('auth-form').addEventListener('submit',event=>{event.preventDefault();authenticate(false);});
  $('signup').addEventListener('click',()=>authenticate(true));
  $('open-roulette').addEventListener('click',()=>showGame(true));
  $('back').addEventListener('click',()=>showGame(false));
  $('bet-type').addEventListener('change',()=>{$('number-label').hidden=$('bet-type').value!=='number';});
  $('bet-form').addEventListener('submit',spin);
  $('sound-toggle').addEventListener('click',()=>{
    soundEnabled=!soundEnabled;
    localStorage.setItem('casino-sound',soundEnabled?'on':'off');
    updateSoundButton();
    if(soundEnabled){ensureAudio();playTone(523.25,0.08,0.04,'triangle');}
    else stopRouletteSound();
  });
  $('roulette-overlay-close').addEventListener('click',()=>{
    $('roulette-overlay').hidden=true;
  });
  $('roulette-overlay').addEventListener('click',event=>{
    if(event.target === $('roulette-overlay')) $('roulette-overlay').hidden=true;
  });
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape' && !$('roulette-overlay').hidden) $('roulette-overlay').hidden=true;
  });
  $('refresh').addEventListener('click',async()=>{try {status('');await refresh();}catch(e){status(message(e));}});
  $('logout').addEventListener('click',async()=>{try {const {error}=await limited(client.auth.signOut());if(error)throw error;await changeSession(null);}catch(e){status(message(e));}});
  // Nie wykonuj zapytań Supabase wewnątrz callbacku Auth (blokada sesji).
  let authEventSeen=false;
  client.auth.onAuthStateChange((event,session)=>{authEventSeen=true;setTimeout(()=>changeSession(session).catch(e=>status(message(e))),0);});
  limited(client.auth.getSession()).then(({data,error})=>{
    if(error)throw error;
    if(!authEventSeen)return changeSession(data.session);
  }).catch(e=>{$('auth-panel').hidden=false;status(message(e));});
})();
