-- Equipos y jugadores ficticios para probar torneos en la base local. Ids con prefijo eeeeeeee.
begin;
with t(n, name, tag) as (values
  (1,'Furia Sur','FUR'),(2,'Andes Gaming','AND'),(3,'Los Pibes','LPB'),(4,'Kraken eSports','KRK'),
  (5,'Vértigo','VRT'),(6,'Nómades','NMD'),(7,'Brava','BRV'),(8,'Cóndor Five','CND'),
  (9,'Halcones','HLC'),(10,'Tormenta Roja','TRJ'))
insert into teams (id, name, tag, kind)
select ('eeeeeeee-0000-4000-8000-' || lpad(n::text, 12, '0'))::uuid, name, tag, 'official' from t;

insert into players (id, nick, steam_id)
select ('eeeeeeee-1111-4000-8000-' || lpad((t*100+p)::text, 12, '0'))::uuid,
       'prueba' || t || '_' || p,
       '765611900000' || lpad((t*100+p)::text, 5, '0')
from generate_series(1,10) t, generate_series(1,6) p;

insert into team_members (team_id, player_id, role, joined_at)
select ('eeeeeeee-0000-4000-8000-' || lpad(t::text, 12, '0'))::uuid,
       ('eeeeeeee-1111-4000-8000-' || lpad((t*100+p)::text, 12, '0'))::uuid,
       case when p = 6 then 'sub' else 'player' end, now()
from generate_series(1,10) t, generate_series(1,6) p;

update teams set captain_id = ('eeeeeeee-1111-4000-8000-' || lpad((substr(id::text, 25)::int*100+1)::text, 12, '0'))::uuid
where id::text like 'eeeeeeee-0000-%';
commit;
