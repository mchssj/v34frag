# pg_stat_statements antes de la 115 (2026-11-13 18:00 UTC, acumulado desde el 2026-11-03 20:47)

```
rol | llamadas | media_ms | max_ms | total_s | consulta
authenticated | 84621 | 811 | 6263 | 68645 | SELECT pgrst_call.pgrst_scalar FROM (SELECT "public"."mm_my_live"() pgrst_scalar) pgrst_call) SELECT $3::bigin
authenticated | 143949 | 60 | 755 | 8691 |  SELECT "public"."match_list"."id" FROM "public"."match_list" WHERE "public"."match_list"."bye" = $1 AND "publ
service_role | 419642 | 12 | 7756 | 5056 | SELECT pgrst_call.pgrst_scalar FROM (SELECT "public"."mm_tick"() pgrst_scalar) pgrst_call) SELECT $3::bigint A
authenticated | 24402 | 154 | 1079 | 3764 | SELECT pgrst_call.pgrst_scalar FROM (SELECT "public"."mm_my_profile"() pgrst_scalar) pgrst_call) SELECT $3::bi
anon | 6349 | 518 | 2989 | 3287 | SELECT pgrst_call.pgrst_scalar FROM (SELECT $1 AS json_data) pgrst_payload, LATERAL (SELECT "p_token", "p_top"
authenticated | 44943 | 59 | 667 | 2649 |  SELECT "public"."match_list"."id", "public"."match_list"."kind", "public"."match_list"."status", "public"."ma
authenticated | 33770 | 65 | 815 | 2189 |  SELECT "public"."player_ranking"."id", "public"."player_ranking"."nick", "public"."player_ranking"."photo_url
authenticated | 15584 | 116 | 1112 | 1811 |  SELECT "public"."player_clutches"."vs", "public"."player_clutches"."won" FROM "public"."player_clutches" WHER
anon | 6236 | 258 | 2977 | 1607 | SELECT pgrst_call.pgrst_scalar FROM (SELECT $1 AS json_data) pgrst_payload, LATERAL (SELECT "p_token" FROM jso
authenticated | 2106 | 706 | 6416 | 1486 |  SELECT "public"."match_clip_list"."id", "public"."match_clip_list"."position", "public"."match_clip_list"."ty
(10 rows)
```
