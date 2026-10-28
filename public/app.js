const baza = window.supabase.createClient(
      "https://tnpvcbdoocdxsepauzdm.supabase.co",
      "sb_publishable_hcSnixt194jfNd00iaFHEA_0N4IHhzF"
    );
  
import { jsxDEV as _jsxDEV, Fragment as _Fragment } from "react/jsx-dev-runtime";
const {
  useState,
  useEffect,
  useRef
} = React;
const red = [1, 3, 5, 7, 9, 12, 14, 16, 18, 19, 21, 23, 25, 27, 30, 32, 34, 36];
function Login() {
  const [email, setEmail] = useState(''),
    [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false),
    [message, setMessage] = useState('');
  async function submit(e, register = false) {
    e.preventDefault();
    if (busy) return;
    setBusy(true);
    setMessage('');
    try {
      const {
        error
      } = register ? await baza.auth.signUp({
        email,
        password,
        options: {
          emailRedirectTo: location.origin + '/'
        }
      }) : await baza.auth.signInWithPassword({
        email,
        password
      });
      if (error) throw error;
      if (register) setMessage('Sprawdz e-mail i potwierdz konto. Potem zaloguj sie.');
      setPassword('');
    } catch (e) {
      setMessage(e.message || 'Blad polaczenia.');
    } finally {
      setBusy(false);
    }
  }
  return /*#__PURE__*/_jsxDEV("section", {
    style: {
      maxWidth: 400,
      margin: 'auto'
    },
    children: [/*#__PURE__*/_jsxDEV("h1", {
      children: "Kasyno Pro"
    }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
      children: "Gra na wirtualne zetony. Bez wplat i wyplat pieniedzy."
    }, void 0, false), /*#__PURE__*/_jsxDEV("form", {
      onSubmit: submit,
      style: {
        display: 'grid',
        gap: 12
      },
      children: [/*#__PURE__*/_jsxDEV("label", {
        children: ["E-mail ", /*#__PURE__*/_jsxDEV("input", {
          type: "email",
          required: true,
          autoComplete: "email",
          value: email,
          onChange: e => setEmail(e.target.value)
        }, void 0, false)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("label", {
        children: ["Haslo ", /*#__PURE__*/_jsxDEV("input", {
          type: "password",
          required: true,
          minLength: 12,
          autoComplete: "current-password",
          value: password,
          onChange: e => setPassword(e.target.value)
        }, void 0, false)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
        disabled: busy,
        children: "Zaloguj sie"
      }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
        type: "button",
        disabled: busy,
        onClick: e => {
          if (e.currentTarget.form.reportValidity()) submit(e, true);
        },
        children: "Zaloz konto"
      }, void 0, false)]
    }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
      role: "status",
      children: message
    }, void 0, false)]
  }, void 0, true);
}
function Game({
  session
}) {
  const [balance, setBalance] = useState(null),
    [history, setHistory] = useState([]);
  const [bet, setBet] = useState('10'),
    [type, setType] = useState('red'),
    [number, setNumber] = useState('0');
  const [message, setMessage] = useState(''),
    [busy, setBusy] = useState(false),
    [page, setPage] = useState('menu');
  const [pending, setPending] = useState(null);
  const locked = useRef(false);
  const storageKey = 'casino-pending-' + session.user.id;
  async function refresh() {
    const {
      data,
      error
    } = await baza.rpc('casino_open_wallet');
    if (error) throw error;
    setBalance(Number(data));
    const h = await baza.from('casino_rounds').select('request_id,played_at,bet,bet_type,result,payout,balance_after').order('played_at', {
      ascending: false
    }).limit(20);
    if (h.error) throw h.error;
    setHistory(h.data);
  }
  useEffect(() => {
    try {
      const saved = JSON.parse(localStorage.getItem(storageKey));
      if (saved && typeof saved.p_request_id === 'string') {
        setPending(saved);
        setPage('Ruletka');
        setMessage('Poprzednia proba wymaga sprawdzenia. Kliknij Sprawdz poprzedni zaklad.');
      }
    } catch (e) {
      setMessage('Nie mozna odczytac poprzedniej proby.');
    }
    refresh().catch(e => setMessage(e.message));
  }, []);
  async function spin() {
    if (locked.current) return;
    const amount = Number(bet),
      chosen = Number(number);
    if (!pending && (!Number.isSafeInteger(amount) || amount < 1 || amount > 1000 || amount > balance)) {
      setMessage('Podaj stawke 1-1000 zetonow, nie wieksza niz saldo.');
      return;
    }
    if (!pending && type === 'number' && (!Number.isInteger(chosen) || chosen < 0 || chosen > 36)) {
      setMessage('Wybierz numer 0-36.');
      return;
    }
    locked.current = true;
    setBusy(true);
    let req = pending;
    try {
      if (!req) {
        req = {
          p_request_id: crypto.randomUUID(),
          p_bet: amount,
          p_type: type,
          p_number: type === 'number' ? chosen : null
        };
        // Zapis przed wyslaniem: odswiezenie strony nie powoduje ponownego obciazenia.
        localStorage.setItem(storageKey, JSON.stringify(req));
        setPending(req);
      }
      const {
        data,
        error
      } = await baza.rpc('casino_spin', req);
      if (error) {
        // Odpowiedz PostgreSQL oznacza odrzucenie transakcji. Blad transportu jest niejednoznaczny.
        if (error.code && (/^[0-9A-Z]{5}$/.test(error.code) || error.code.startsWith('PGRST'))) {
          localStorage.removeItem(storageKey);
          setPending(null);
        }
        throw error;
      }
      localStorage.removeItem(storageKey);
      setPending(null);
      const color = data.result === 0 ? 'zielony' : red.includes(data.result) ? 'czerwony' : 'czarny';
      setBalance(Number(data.balance_after));
      setMessage(`Wynik: ${data.result} (${color}). Wyplata: ${data.payout} zetonow. Zmiana salda: ${data.payout - data.bet}.`);
      try {
        await refresh();
      } catch (e) {
        setMessage(m => m + ' Nie udalo sie odswiezyc historii. Kliknij Odswiez.');
      }
    } catch (e) {
      setMessage((e.message || 'Blad sieci.') + ' Jesli proba jest oczekujaca, sprawdz ja ponownie tym samym przyciskiem.');
    } finally {
      locked.current = false;
      setBusy(false);
    }
  }
  return /*#__PURE__*/_jsxDEV("main", {
    style: {
      width: 'min(850px,94vw)',
      padding: '24px 0'
    },
    children: [/*#__PURE__*/_jsxDEV("header", {
      children: [/*#__PURE__*/_jsxDEV("h1", {
        children: "Kasyno Pro"
      }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
        children: "Wirtualne zetony — bez wartosci pienieznej."
      }, void 0, false), /*#__PURE__*/_jsxDEV("p", {
        children: ["Zalogowany: ", session.user.email]
      }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
        disabled: busy,
        onClick: async () => {
          const {
            error
          } = await baza.auth.signOut();
          if (error) setMessage(error.message);
        },
        children: "Wyloguj"
      }, void 0, false), /*#__PURE__*/_jsxDEV("h2", {
        children: ["Saldo: ", balance === null ? 'Ladowanie…' : balance + ' zetonow']
      }, void 0, true), /*#__PURE__*/_jsxDEV("button", {
        disabled: busy,
        onClick: () => refresh().catch(e => setMessage(e.message)),
        children: "Odswiez saldo i historie"
      }, void 0, false)]
    }, void 0, true), page === 'menu' ? /*#__PURE__*/_jsxDEV("div", {
      className: "grid",
      children: [/*#__PURE__*/_jsxDEV("button", {
        className: "card",
        onClick: () => setPage('Ruletka'),
        children: "Ruletka"
      }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
        className: "card",
        children: "Slots — wkrotce"
      }, void 0, false)]
    }, void 0, true) : /*#__PURE__*/_jsxDEV("section", {
      children: [/*#__PURE__*/_jsxDEV("h2", {
        children: "Ruletka"
      }, void 0, false), /*#__PURE__*/_jsxDEV("fieldset", {
        disabled: busy || !!pending || balance === null,
        style: {
          display: 'grid',
          gap: 12
        },
        children: [/*#__PURE__*/_jsxDEV("label", {
          children: ["Stawka ", /*#__PURE__*/_jsxDEV("input", {
            type: "number",
            min: "1",
            max: "1000",
            step: "1",
            value: bet,
            onChange: e => setBet(e.target.value)
          }, void 0, false)]
        }, void 0, true), /*#__PURE__*/_jsxDEV("label", {
          children: ["Zaklad ", /*#__PURE__*/_jsxDEV("select", {
            value: type,
            onChange: e => setType(e.target.value),
            children: [/*#__PURE__*/_jsxDEV("option", {
              value: "red",
              children: "Czerwone (2x)"
            }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
              value: "black",
              children: "Czarne (2x)"
            }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
              value: "even",
              children: "Parzyste (2x)"
            }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
              value: "odd",
              children: "Nieparzyste (2x)"
            }, void 0, false), /*#__PURE__*/_jsxDEV("option", {
              value: "number",
              children: "Numer (36x)"
            }, void 0, false)]
          }, void 0, true)]
        }, void 0, true), type === 'number' && /*#__PURE__*/_jsxDEV("label", {
          children: ["Numer ", /*#__PURE__*/_jsxDEV("input", {
            type: "number",
            min: "0",
            max: "36",
            step: "1",
            value: number,
            onChange: e => setNumber(e.target.value)
          }, void 0, false)]
        }, void 0, true)]
      }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
        children: "Wyplata zawiera stawke. Zero przegrywa zaklady na kolor i parzystosc."
      }, void 0, false), /*#__PURE__*/_jsxDEV("button", {
        disabled: busy || balance === null,
        onClick: spin,
        children: busy ? 'Sprawdzam…' : pending ? 'Sprawdz poprzedni zaklad' : 'Zakrec'
      }, void 0, false), ' ', /*#__PURE__*/_jsxDEV("button", {
        disabled: busy,
        onClick: () => setPage('menu'),
        children: "Wroc do menu"
      }, void 0, false)]
    }, void 0, true), /*#__PURE__*/_jsxDEV("p", {
      role: "status",
      style: {
        color: '#facc15'
      },
      children: message
    }, void 0, false), /*#__PURE__*/_jsxDEV("h2", {
      children: "Twoje ostatnie 20 rund"
    }, void 0, false), /*#__PURE__*/_jsxDEV("div", {
      style: {
        overflowX: 'auto'
      },
      children: [/*#__PURE__*/_jsxDEV("table", {
        style: {
          width: '100%',
          textAlign: 'left'
        },
        children: [/*#__PURE__*/_jsxDEV("thead", {
          children: /*#__PURE__*/_jsxDEV("tr", {
            children: [/*#__PURE__*/_jsxDEV("th", {
              children: "Czas"
            }, void 0, false), /*#__PURE__*/_jsxDEV("th", {
              children: "Stawka"
            }, void 0, false), /*#__PURE__*/_jsxDEV("th", {
              children: "Wynik"
            }, void 0, false), /*#__PURE__*/_jsxDEV("th", {
              children: "Wyplata"
            }, void 0, false), /*#__PURE__*/_jsxDEV("th", {
              children: "Saldo po rundzie"
            }, void 0, false)]
          }, void 0, true)
        }, void 0, false), /*#__PURE__*/_jsxDEV("tbody", {
          children: history.map(r => /*#__PURE__*/_jsxDEV("tr", {
            children: [/*#__PURE__*/_jsxDEV("td", {
              children: new Date(r.played_at).toLocaleString('pl-PL')
            }, void 0, false), /*#__PURE__*/_jsxDEV("td", {
              children: r.bet
            }, void 0, false), /*#__PURE__*/_jsxDEV("td", {
              children: r.result
            }, void 0, false), /*#__PURE__*/_jsxDEV("td", {
              children: r.payout
            }, void 0, false), /*#__PURE__*/_jsxDEV("td", {
              children: r.balance_after
            }, void 0, false)]
          }, r.request_id, true))
        }, void 0, false)]
      }, void 0, true), history.length === 0 && /*#__PURE__*/_jsxDEV("p", {
        children: "Nie masz jeszcze zapisanych rund."
      }, void 0, false)]
    }, void 0, true)]
  }, void 0, true);
}
function App() {
  const [session, setSession] = useState(undefined),
    [error, setError] = useState('');
  useEffect(() => {
    let active = true;
    const {
      data: {
        subscription
      }
    } = baza.auth.onAuthStateChange((event, s) => {
      if (active) setSession(s);
    });
    baza.auth.getSession().then(({
      data,
      error
    }) => {
      if (active) {
        if (error) setError(error.message);
        setSession(data.session);
      }
    });
    return () => {
      active = false;
      subscription.unsubscribe();
    };
  }, []);
  if (session === undefined) return /*#__PURE__*/_jsxDEV("p", {
    children: "Ladowanie…"
  }, void 0, false);
  return /*#__PURE__*/_jsxDEV(_Fragment, {
    children: [error && /*#__PURE__*/_jsxDEV("p", {
      role: "alert",
      children: error
    }, void 0, false), session ? /*#__PURE__*/_jsxDEV(Game, {
      session: session
    }, session.user.id, false) : /*#__PURE__*/_jsxDEV(Login, {}, void 0, false)]
  }, void 0, true);
}
ReactDOM.createRoot(document.getElementById('root')).render(/*#__PURE__*/_jsxDEV(App, {}, void 0, false));