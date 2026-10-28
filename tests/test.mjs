import {PGlite} from '@electric-sql/pglite';
import {pgcrypto} from '@electric-sql/pglite/contrib/pgcrypto';
import {readFileSync} from 'node:fs';
import assert from 'node:assert/strict';
import {transformSync} from '@babel/core';
const db=new PGlite({extensions:{pgcrypto}});
const sql=readFileSync('../supabase/001_game.sql','utf8');
await db.exec(`create role anon; create role authenticated; create schema auth;
create table auth.users(id uuid primary key,email_confirmed_at timestamptz);
create function auth.uid() returns uuid language sql stable as $$ select nullif(current_setting('request.jwt.claim.sub',true),'')::uuid $$;
grant usage on schema auth to anon,authenticated; grant execute on function auth.uid() to anon,authenticated;
insert into auth.users values ('11111111-1111-4111-8111-111111111111',now()),('22222222-2222-4222-8222-222222222222',now()),('33333333-3333-4333-8333-333333333333',null);`);
await db.exec(sql);
const u='11111111-1111-4111-8111-111111111111',v='22222222-2222-4222-8222-222222222222';
async function asUser(id){await db.exec(`reset role;set role authenticated;select set_config('request.jwt.claim.sub','${id}',false);`);}
async function rejects(sql){await assert.rejects(()=>db.query(sql));}
const open=()=>db.query('select public.casino_open_wallet() as b');
await asUser(u);assert.equal((await open()).rows[0].b,1000);assert.equal((await open()).rows[0].b,1000);
await rejects('update public.casino_wallets set balance=999999');
await rejects("insert into public.casino_wallets(user_id) values(gen_random_uuid())");
await rejects('delete from public.casino_rounds');
await rejects("select public.casino_spin(gen_random_uuid(),-1,'red',null)");
await rejects("select public.casino_spin(gen_random_uuid(),1001,'red',null)");
await rejects("select public.casino_spin(gen_random_uuid(),1,'number',37)");
await rejects("select public.casino_spin(gen_random_uuid(),1,'red',0)");
await rejects("select public.casino_spin(gen_random_uuid(),1,null,null)");
const id='aaaaaaaa-aaaa-4aaa-8aaa-aaaaaaaaaaaa';
const spin=`select public.casino_spin('${id}',10,'red',null) as r`;
const r=(await db.query(spin)).rows[0].r;
assert.ok(r.result>=0&&r.result<=36);assert.equal(r.balance_after,1000-10+r.payout);
assert.deepEqual((await db.query(spin)).rows[0].r,r);
await rejects(`select public.casino_spin('${id}',11,'red',null)`);
await rejects("select public.casino_spin(gen_random_uuid(),10,'red',null)");
await asUser(v);await open();
assert.equal((await db.query('select * from public.casino_wallets')).rows.length,1);
assert.equal((await db.query('select * from public.casino_rounds')).rows.length,0);
await asUser('33333333-3333-4333-8333-333333333333');await assert.rejects(open);
await db.exec('reset role;set role anon');await assert.rejects(open);await rejects(spin);await rejects('select * from public.casino_wallets');
await db.exec('reset role');
// Deterministic test-only crypto replacement verifies all wheel outcomes.
await db.exec(`create table public.test_rng(n integer); insert into public.test_rng values(0);
create or replace function extensions.gen_random_bytes(integer) returns bytea language sql as $$select decode(lpad(to_hex(n),4,'0'),'hex') from public.test_rng$$;`);
const reds=[1,3,5,7,9,12,14,16,18,19,21,23,25,27,30,32,34,36];
for(let n=0;n<37;n++)for(const type of ['red','black','even','odd','number']) {
 await db.exec(`reset role;update public.test_rng set n=${n};update public.casino_wallets set last_play_at=null,balance=1000 where user_id='${u}'`);
 await asUser(u);
 const row=(await db.query(`select public.casino_spin(gen_random_uuid(),10,'${type}',${type==='number'?n:'null'}) as r`)).rows[0].r;
 let mult=type==='number'?36:type==='red'?reds.includes(n)*2:type==='black'?(n!==0&&!reds.includes(n))*2:type==='even'?(n!==0&&n%2===0)*2:(n%2===1)*2;
 assert.equal(row.result,n);assert.equal(row.payout,10*mult);assert.equal(row.balance_after,990+10*mult);
}
await db.exec(`reset role;update public.casino_wallets set last_play_at=null,balance=0 where user_id='${u}'`);
await asUser(u);await rejects("select public.casino_spin(gen_random_uuid(),1,'red',null)");
assert.equal((await open()).rows[0].b,0);
transformSync(readFileSync('../src/app.jsx','utf8'),{presets:['@babel/preset-react']});
console.log('PASS: migration; permissions; RLS isolation; confirmed identity; initial bonus once; invalid bets; insufficient balance; cooldown; retry idempotency; 185 payout cases; JSX compilation.');
await db.close();
