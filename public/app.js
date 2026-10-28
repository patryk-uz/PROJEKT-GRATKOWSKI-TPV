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
  const labels = {red:'Czerwone',black:'Czarne',even:'Parzyste',odd:'Nieparzyste',number:'Numer'};
  let user = null, balance = null, pending = null, busy = false, authBusy = false, generation = 0;
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
