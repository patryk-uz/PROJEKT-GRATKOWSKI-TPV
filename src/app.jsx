
    const {useState, useEffect, useRef} = React;
    const red = [1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
    function Login() {
      const [email,setEmail]=useState(''), [password,setPassword]=useState('');
      const [busy,setBusy]=useState(false), [message,setMessage]=useState('');
      async function submit(e, register=false) {
        e.preventDefault(); if(busy) return;
        setBusy(true); setMessage('');
        try {
          const {error}=register
            ? await baza.auth.signUp({email,password,options:{emailRedirectTo:location.origin+'/'}})
            : await baza.auth.signInWithPassword({email,password});
          if(error) throw error;
          if(register) setMessage('Sprawdz e-mail i potwierdz konto. Potem zaloguj sie.');
          setPassword('');
        } catch(e) {setMessage(e.message || 'Blad polaczenia.');}
        finally {setBusy(false);}
      }
      return <section style={{maxWidth:400,margin:'auto'}}>
        <h1>Kasyno Pro</h1><p>Gra na wirtualne zetony. Bez wplat i wyplat pieniedzy.</p>
        <form onSubmit={submit} style={{display:'grid',gap:12}}>
          <label>E-mail <input type="email" required autoComplete="email" value={email} onChange={e=>setEmail(e.target.value)}/></label>
          <label>Haslo <input type="password" required minLength={12} autoComplete="current-password" value={password} onChange={e=>setPassword(e.target.value)}/></label>
          <button disabled={busy}>Zaloguj sie</button>
          <button type="button" disabled={busy} onClick={e=>{if(e.currentTarget.form.reportValidity()) submit(e,true);}}>Zaloz konto</button>
        </form><p role="status">{message}</p>
      </section>;
    }
    function Game({session}) {
      const [balance,setBalance]=useState(null), [history,setHistory]=useState([]);
      const [bet,setBet]=useState('10'), [type,setType]=useState('red'), [number,setNumber]=useState('0');
      const [message,setMessage]=useState(''), [busy,setBusy]=useState(false), [page,setPage]=useState('menu');
      const [pending,setPending]=useState(null); const locked=useRef(false);
      const storageKey='casino-pending-'+session.user.id;
      async function refresh() {
        const {data,error}=await baza.rpc('casino_open_wallet');
        if(error) throw error;
        setBalance(Number(data));
        const h=await baza.from('casino_rounds').select('request_id,played_at,bet,bet_type,result,payout,balance_after').order('played_at',{ascending:false}).limit(20);
        if(h.error) throw h.error;
        setHistory(h.data);
      }
      useEffect(()=>{
        try { const saved=JSON.parse(localStorage.getItem(storageKey));
          if(saved && typeof saved.p_request_id==='string') {setPending(saved);setPage('Ruletka');setMessage('Poprzednia proba wymaga sprawdzenia. Kliknij Sprawdz poprzedni zaklad.');}
        } catch(e) {setMessage('Nie mozna odczytac poprzedniej proby.');}
        refresh().catch(e=>setMessage(e.message));
      },[]);
      async function spin() {
        if(locked.current) return;
        const amount=Number(bet), chosen=Number(number);
        if(!pending && (!Number.isSafeInteger(amount)||amount<1||amount>1000||amount>balance)) {setMessage('Podaj stawke 1-1000 zetonow, nie wieksza niz saldo.');return;}
        if(!pending && type==='number' && (!Number.isInteger(chosen)||chosen<0||chosen>36)) {setMessage('Wybierz numer 0-36.');return;}
        locked.current=true;setBusy(true);
        let req=pending;
        try {
          if(!req) {
            req={p_request_id:crypto.randomUUID(),p_bet:amount,p_type:type,p_number:type==='number'?chosen:null};
            // Zapis przed wyslaniem: odswiezenie strony nie powoduje ponownego obciazenia.
            localStorage.setItem(storageKey,JSON.stringify(req));setPending(req);
          }
          const {data,error}=await baza.rpc('casino_spin',req);
          if(error) {
            // Odpowiedz PostgreSQL oznacza odrzucenie transakcji. Blad transportu jest niejednoznaczny.
            if(error.code && (/^[0-9A-Z]{5}$/.test(error.code)||error.code.startsWith('PGRST'))) {
              localStorage.removeItem(storageKey);setPending(null);
            }
            throw error;
          }
          localStorage.removeItem(storageKey);setPending(null);
          const color=data.result===0?'zielony':red.includes(data.result)?'czerwony':'czarny';
          setBalance(Number(data.balance_after));
          setMessage(`Wynik: ${data.result} (${color}). Wyplata: ${data.payout} zetonow. Zmiana salda: ${data.payout-data.bet}.`);
          try {await refresh();} catch(e) {setMessage(m=>m+' Nie udalo sie odswiezyc historii. Kliknij Odswiez.');}
        } catch(e) {setMessage((e.message || 'Blad sieci.')+' Jesli proba jest oczekujaca, sprawdz ja ponownie tym samym przyciskiem.');}
        finally {locked.current=false;setBusy(false);}
      }
      return <main style={{width:'min(850px,94vw)',padding:'24px 0'}}>
        <header><h1>Kasyno Pro</h1><p>Wirtualne zetony — bez wartosci pienieznej.</p>
          <p>Zalogowany: {session.user.email}</p>
          <button disabled={busy} onClick={async()=>{const {error}=await baza.auth.signOut();if(error)setMessage(error.message);}}>Wyloguj</button>
          <h2>Saldo: {balance===null?'Ladowanie…':balance+' zetonow'}</h2>
          <button disabled={busy} onClick={()=>refresh().catch(e=>setMessage(e.message))}>Odswiez saldo i historie</button>
        </header>
        {page==='menu' ? <div className="grid">
          <button className="card" onClick={()=>setPage('Ruletka')}>Ruletka</button>
          <div className="card">Slots — wkrotce</div>
        </div> : <section><h2>Ruletka</h2>
          <fieldset disabled={busy||!!pending||balance===null} style={{display:'grid',gap:12}}>
            <label>Stawka <input type="number" min="1" max="1000" step="1" value={bet} onChange={e=>setBet(e.target.value)}/></label>
            <label>Zaklad <select value={type} onChange={e=>setType(e.target.value)}>
              <option value="red">Czerwone (2x)</option><option value="black">Czarne (2x)</option>
              <option value="even">Parzyste (2x)</option><option value="odd">Nieparzyste (2x)</option>
              <option value="number">Numer (36x)</option>
            </select></label>
            {type==='number'&&<label>Numer <input type="number" min="0" max="36" step="1" value={number} onChange={e=>setNumber(e.target.value)}/></label>}
          </fieldset>
          <p>Wyplata zawiera stawke. Zero przegrywa zaklady na kolor i parzystosc.</p>
          <button disabled={busy||balance===null} onClick={spin}>{busy?'Sprawdzam…':pending?'Sprawdz poprzedni zaklad':'Zakrec'}</button>{' '}
          <button disabled={busy} onClick={()=>setPage('menu')}>Wroc do menu</button>
        </section>}
        <p role="status" style={{color:'#facc15'}}>{message}</p>
        <h2>Twoje ostatnie 20 rund</h2>
        <div style={{overflowX:'auto'}}><table style={{width:'100%',textAlign:'left'}}>
          <thead><tr><th>Czas</th><th>Stawka</th><th>Wynik</th><th>Wyplata</th><th>Saldo po rundzie</th></tr></thead>
          <tbody>{history.map(r=><tr key={r.request_id}><td>{new Date(r.played_at).toLocaleString('pl-PL')}</td><td>{r.bet}</td><td>{r.result}</td><td>{r.payout}</td><td>{r.balance_after}</td></tr>)}</tbody>
        </table>{history.length===0&&<p>Nie masz jeszcze zapisanych rund.</p>}</div>
      </main>;
    }
    function App() {
      const [session,setSession]=useState(undefined), [error,setError]=useState('');
      useEffect(()=>{
        let active=true;
        const {data:{subscription}}=baza.auth.onAuthStateChange((event,s)=>{if(active)setSession(s);});
        baza.auth.getSession().then(({data,error})=>{if(active){if(error)setError(error.message);setSession(data.session);}});
        return ()=>{active=false;subscription.unsubscribe();};
      },[]);
      if(session===undefined) return <p>Ladowanie…</p>;
      return <>{error&&<p role="alert">{error}</p>}{session?<Game key={session.user.id} session={session}/>:<Login/>}</>;
    }
    ReactDOM.createRoot(document.getElementById('root')).render(<App/>);
  