
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "demo_workers": {
                  Row: {
                    "active": boolean,"created_at": string,"id": string,"last_seen_at": string | null,"name": string,"token_hash": string
                  }
                  Insert: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"name": string,"token_hash": string
                  }
                  Update: {
                    "active"?: boolean,"created_at"?: string,"id"?: string,"last_seen_at"?: string | null,"name"?: string,"token_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"elo_config": {
                  Row: {
                    "base": number,"bonus_factor": number,"bonus_max": number,"elo_floor": number,"full_pct": number,"id": number,"min_pct": number,"start_elo": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "base"?: number,"bonus_factor"?: number,"bonus_max"?: number,"elo_floor"?: number,"full_pct"?: number,"id"?: number,"min_pct"?: number,"start_elo"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "base"?: number,"bonus_factor"?: number,"bonus_max"?: number,"elo_floor"?: number,"full_pct"?: number,"id"?: number,"min_pct"?: number,"start_elo"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"events": {
                  Row: {
                    "advance": number,"best_of": number,"champion": string | null,"double_rr": boolean,"ends_on": string | null,"final_bo": number,"format": string | null,"generated": boolean,"group_count": number,"id": string,"max_teams": number | null,"min_teams": number | null,"name": string,"prize": string | null,"rules": string | null,"seeds": (string)[],"stage": string | null,"starts_on": string | null
                  }
                  Insert: {
                    "advance"?: number,"best_of"?: number,"champion"?: string | null,"double_rr"?: boolean,"ends_on"?: string | null,"final_bo"?: number,"format"?: string | null,"generated"?: boolean,"group_count"?: number,"id"?: string,"max_teams"?: number | null,"min_teams"?: number | null,"name": string,"prize"?: string | null,"rules"?: string | null,"seeds"?: (string)[],"stage"?: string | null,"starts_on"?: string | null
                  }
                  Update: {
                    "advance"?: number,"best_of"?: number,"champion"?: string | null,"double_rr"?: boolean,"ends_on"?: string | null,"final_bo"?: number,"format"?: string | null,"generated"?: boolean,"group_count"?: number,"id"?: string,"max_teams"?: number | null,"min_teams"?: number | null,"name"?: string,"prize"?: string | null,"rules"?: string | null,"seeds"?: (string)[],"stage"?: string | null,"starts_on"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_champion_fkey"
      columns: ["champion"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"game_servers": {
                  Row: {
                    "active": boolean,"allowed_ip": string | null,"connect_address": string | null,"created_at": string,"id": string,"last_ip": string | null,"last_seen_at": string | null,"license_expires_at": string | null,"name": string,"panel_server_id": string | null,"plugin_version": string | null,"token_hash": string
                  }
                  Insert: {
                    "active"?: boolean,"allowed_ip"?: string | null,"connect_address"?: string | null,"created_at"?: string,"id"?: string,"last_ip"?: string | null,"last_seen_at"?: string | null,"license_expires_at"?: string | null,"name": string,"panel_server_id"?: string | null,"plugin_version"?: string | null,"token_hash": string
                  }
                  Update: {
                    "active"?: boolean,"allowed_ip"?: string | null,"connect_address"?: string | null,"created_at"?: string,"id"?: string,"last_ip"?: string | null,"last_seen_at"?: string | null,"license_expires_at"?: string | null,"name"?: string,"panel_server_id"?: string | null,"plugin_version"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ingest_chunks": {
                  Row: {
                    "created_at": string,"data": string,"part": number,"server_id": string,"total": number,"uid": string
                  }
                  Insert: {
                    "created_at"?: string,"data": string,"part": number,"server_id": string,"total": number,"uid": string
                  }
                  Update: {
                    "created_at"?: string,"data"?: string,"part"?: number,"server_id"?: string,"total"?: number,"uid"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ingest_chunks_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    }
                  ]
                },"match_chat": {
                  Row: {
                    "created_at": string,"id": number,"match_id": string | null,"message": string,"tag": string | null,"user_email": string | null,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: number,"match_id"?: string | null,"message": string,"tag"?: string | null,"user_email"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: number,"match_id"?: string | null,"message"?: string,"tag"?: string | null,"user_email"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    }
                  ]
                },"match_player_stats": {
                  Row: {
                    "assists": number | null,"created_at": string,"damage": number | null,"deaths": number | null,"defuses": number,"elo_after": number | null,"elo_before": number | null,"elo_delta": number | null,"first_deaths": number,"first_kills": number,"headshots": number | null,"id": number,"k1": number,"k2": number,"k3": number,"k4": number,"k5": number,"kills": number | null,"match_id": string | null,"nick": string | null,"plants": number,"player_id": string | null,"rating": number | null,"rounds": number,"steam_id": string,"suicides": number,"team": number,"teamkills": number,"win_prob": number | null
                  }
                  Insert: {
                    "assists"?: number | null,"created_at"?: string,"damage"?: number | null,"deaths"?: number | null,"defuses"?: number,"elo_after"?: number | null,"elo_before"?: number | null,"elo_delta"?: number | null,"first_deaths"?: number,"first_kills"?: number,"headshots"?: number | null,"id"?: number,"k1"?: number,"k2"?: number,"k3"?: number,"k4"?: number,"k5"?: number,"kills"?: number | null,"match_id"?: string | null,"nick"?: string | null,"plants"?: number,"player_id"?: string | null,"rating"?: number | null,"rounds"?: number,"steam_id": string,"suicides"?: number,"team": number,"teamkills"?: number,"win_prob"?: number | null
                  }
                  Update: {
                    "assists"?: number | null,"created_at"?: string,"damage"?: number | null,"deaths"?: number | null,"defuses"?: number,"elo_after"?: number | null,"elo_before"?: number | null,"elo_delta"?: number | null,"first_deaths"?: number,"first_kills"?: number,"headshots"?: number | null,"id"?: number,"k1"?: number,"k2"?: number,"k3"?: number,"k4"?: number,"k5"?: number,"kills"?: number | null,"match_id"?: string | null,"nick"?: string | null,"plants"?: number,"player_id"?: string | null,"rating"?: number | null,"rounds"?: number,"steam_id"?: string,"suicides"?: number,"team"?: number,"teamkills"?: number,"win_prob"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_player_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"match_vetos": {
                  Row: {
                    "action": string,"by_user": string,"created_at": string,"id": string,"map": string,"match_id": string,"seq": number,"team_id": string
                  }
                  Insert: {
                    "action": string,"by_user": string,"created_at"?: string,"id"?: string,"map": string,"match_id": string,"seq": number,"team_id": string
                  }
                  Update: {
                    "action"?: string,"by_user"?: string,"created_at"?: string,"id"?: string,"map"?: string,"match_id"?: string,"seq"?: number,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_vetos_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_vetos_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "best_of": number,"bye": boolean,"cancel_reason": string | null,"cancelled_by": string | null,"dead1": boolean,"dead2": boolean,"demo_attempts": number,"demo_key": string | null,"demo_size": number | null,"demo_status": string,"demo_uploaded_at": string | null,"end_reason": string | null,"event_id": string | null,"external_id": string | null,"grp": number | null,"id": string,"kind": string,"lineup1": (string)[],"lineup2": (string)[],"map": string | null,"maps": Json | null,"next_lose": string | null,"next_lose_slot": number | null,"next_win": string | null,"next_win_slot": number | null,"played_at": string | null,"pos": number | null,"round": number | null,"score1": number | null,"score2": number | null,"server_id": string | null,"server_ip": string | null,"side1_guests": (string)[],"side1_name": string | null,"side2_guests": (string)[],"side2_name": string | null,"stage": string | null,"starts_at": string | null,"status": string,"team1": string | null,"team2": string | null,"winner": string | null,"winner_side": number | null
                  }
                  Insert: {
                    "best_of"?: number,"bye"?: boolean,"cancel_reason"?: string | null,"cancelled_by"?: string | null,"dead1"?: boolean,"dead2"?: boolean,"demo_attempts"?: number,"demo_key"?: string | null,"demo_size"?: number | null,"demo_status"?: string,"demo_uploaded_at"?: string | null,"end_reason"?: string | null,"event_id"?: string | null,"external_id"?: string | null,"grp"?: number | null,"id"?: string,"kind"?: string,"lineup1"?: (string)[],"lineup2"?: (string)[],"map"?: string | null,"maps"?: Json | null,"next_lose"?: string | null,"next_lose_slot"?: number | null,"next_win"?: string | null,"next_win_slot"?: number | null,"played_at"?: string | null,"pos"?: number | null,"round"?: number | null,"score1"?: number | null,"score2"?: number | null,"server_id"?: string | null,"server_ip"?: string | null,"side1_guests"?: (string)[],"side1_name"?: string | null,"side2_guests"?: (string)[],"side2_name"?: string | null,"stage"?: string | null,"starts_at"?: string | null,"status"?: string,"team1"?: string | null,"team2"?: string | null,"winner"?: string | null,"winner_side"?: number | null
                  }
                  Update: {
                    "best_of"?: number,"bye"?: boolean,"cancel_reason"?: string | null,"cancelled_by"?: string | null,"dead1"?: boolean,"dead2"?: boolean,"demo_attempts"?: number,"demo_key"?: string | null,"demo_size"?: number | null,"demo_status"?: string,"demo_uploaded_at"?: string | null,"end_reason"?: string | null,"event_id"?: string | null,"external_id"?: string | null,"grp"?: number | null,"id"?: string,"kind"?: string,"lineup1"?: (string)[],"lineup2"?: (string)[],"map"?: string | null,"maps"?: Json | null,"next_lose"?: string | null,"next_lose_slot"?: number | null,"next_win"?: string | null,"next_win_slot"?: number | null,"played_at"?: string | null,"pos"?: number | null,"round"?: number | null,"score1"?: number | null,"score2"?: number | null,"server_id"?: string | null,"server_ip"?: string | null,"side1_guests"?: (string)[],"side1_name"?: string | null,"side2_guests"?: (string)[],"side2_name"?: string | null,"stage"?: string | null,"starts_at"?: string | null,"status"?: string,"team1"?: string | null,"team2"?: string | null,"winner"?: string | null,"winner_side"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team1_fkey"
      columns: ["team1"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"pcw_posts": {
                  Row: {
                    "best_of": number,"by_user": string,"created_at": string,"id": string,"maps": string | null,"match_id": string | null,"note": string | null,"starts_at": string | null,"status": string,"team_id": string
                  }
                  Insert: {
                    "best_of"?: number,"by_user": string,"created_at"?: string,"id"?: string,"maps"?: string | null,"match_id"?: string | null,"note"?: string | null,"starts_at"?: string | null,"status"?: string,"team_id": string
                  }
                  Update: {
                    "best_of"?: number,"by_user"?: string,"created_at"?: string,"id"?: string,"maps"?: string | null,"match_id"?: string | null,"note"?: string | null,"starts_at"?: string | null,"status"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"player_elo": {
                  Row: {
                    "elo": number,"matches": number,"mu": number,"peak_elo": number,"sigma": number,"steam_id": string,"updated_at": string
                  }
                  Insert: {
                    "elo"?: number,"matches"?: number,"mu"?: number,"peak_elo"?: number,"sigma"?: number,"steam_id": string,"updated_at"?: string
                  }
                  Update: {
                    "elo"?: number,"matches"?: number,"mu"?: number,"peak_elo"?: number,"sigma"?: number,"steam_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"player_map_stats": {
                  Row: {
                    "id": number,"kd": number | null,"map_name": string,"maps": number | null,"player_id": string | null,"rating": number | null
                  }
                  Insert: {
                    "id"?: number,"kd"?: number | null,"map_name": string,"maps"?: number | null,"player_id"?: string | null,"rating"?: number | null
                  }
                  Update: {
                    "id"?: number,"kd"?: number | null,"map_name"?: string,"maps"?: number | null,"player_id"?: string | null,"rating"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_map_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"player_medals": {
                  Row: {
                    "created_at": string,"icon": string | null,"id": string,"player_id": string | null,"title": string
                  }
                  Insert: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"player_id"?: string | null,"title": string
                  }
                  Update: {
                    "created_at"?: string,"icon"?: string | null,"id"?: string,"player_id"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "achievements": string | null,"adr": number | null,"bio": string | null,"hs": number | null,"id": string,"kd": number | null,"losses": number | null,"maps": number | null,"nick": string,"photo_url": string | null,"privacy": string,"rating": number | null,"stats_auto": boolean,"steam_id": string | null,"team_history": string | null,"user_id": string | null,"wins": number | null
                  }
                  Insert: {
                    "achievements"?: string | null,"adr"?: number | null,"bio"?: string | null,"hs"?: number | null,"id"?: string,"kd"?: number | null,"losses"?: number | null,"maps"?: number | null,"nick": string,"photo_url"?: string | null,"privacy"?: string,"rating"?: number | null,"stats_auto"?: boolean,"steam_id"?: string | null,"team_history"?: string | null,"user_id"?: string | null,"wins"?: number | null
                  }
                  Update: {
                    "achievements"?: string | null,"adr"?: number | null,"bio"?: string | null,"hs"?: number | null,"id"?: string,"kd"?: number | null,"losses"?: number | null,"maps"?: number | null,"nick"?: string,"photo_url"?: string | null,"privacy"?: string,"rating"?: number | null,"stats_auto"?: boolean,"steam_id"?: string | null,"team_history"?: string | null,"user_id"?: string | null,"wins"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"profile_details": {
                  Row: {
                    "avatar_url": string | null,"country": string | null,"discord": string | null,"faceit": string | null,"game_role": string | null,"joined_at": string | null,"last_seen": string | null,"real_name": string | null,"steam": string | null,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "avatar_url"?: string | null,"country"?: string | null,"discord"?: string | null,"faceit"?: string | null,"game_role"?: string | null,"joined_at"?: string | null,"last_seen"?: string | null,"real_name"?: string | null,"steam"?: string | null,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "avatar_url"?: string | null,"country"?: string | null,"discord"?: string | null,"faceit"?: string | null,"game_role"?: string | null,"joined_at"?: string | null,"last_seen"?: string | null,"real_name"?: string | null,"steam"?: string | null,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"profile_requests": {
                  Row: {
                    "created_at": string,"id": string,"player_id": string,"status": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"player_id": string,"status"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"player_id"?: string,"status"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "profile_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "id": string,"role": string,"tag": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "id": string,"role"?: string,"tag"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "id"?: string,"role"?: string,"tag"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"result_reports": {
                  Row: {
                    "by_user": string,"created_at": string,"id": string,"lineup": (string)[],"maps": NonNullable<Json>,"match_id": string,"note": string | null,"proof": (string)[],"team_id": string,"updated_at": string
                  }
                  Insert: {
                    "by_user": string,"created_at"?: string,"id"?: string,"lineup"?: (string)[],"maps": NonNullable<Json>,"match_id": string,"note"?: string | null,"proof"?: (string)[],"team_id": string,"updated_at"?: string
                  }
                  Update: {
                    "by_user"?: string,"created_at"?: string,"id"?: string,"lineup"?: (string)[],"maps"?: NonNullable<Json>,"match_id"?: string,"note"?: string | null,"proof"?: (string)[],"team_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "result_reports_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "result_reports_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_requests": {
                  Row: {
                    "name": string,"status": string,"tag": string | null,"user_id": string
                  }
                  Insert: {
                    "name": string,"status"?: string,"tag"?: string | null,"user_id": string
                  }
                  Update: {
                    "name"?: string,"status"?: string,"tag"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"teams": {
                  Row: {
                    "captain_id": string | null,"guests": (string)[],"id": string,"kind": string,"members": (string)[],"name": string,"owner_id": string | null,"tag": string | null
                  }
                  Insert: {
                    "captain_id"?: string | null,"guests"?: (string)[],"id"?: string,"kind"?: string,"members"?: (string)[],"name": string,"owner_id"?: string | null,"tag"?: string | null
                  }
                  Update: {
                    "captain_id"?: string | null,"guests"?: (string)[],"id"?: string,"kind"?: string,"members"?: (string)[],"name"?: string,"owner_id"?: string | null,"tag"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"tournament_registrations": {
                  Row: {
                    "created_at": string,"event_id": string | null,"id": string,"team_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"event_id"?: string | null,"id"?: string,"team_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string | null,"id"?: string,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "public_profiles": {
                  Row: {
                    "id": string | null,"tag": string | null
                  }
                  Insert: {
                           "id"?: string | null,"tag"?: string | null
                         }
                        Update: {
                           "id"?: string | null,"tag"?: string | null
                         }
                        Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_pcw":
{ Args: { "p_guests": (string)[],"p_name": string,"p_players": (string)[],"p_post": string }; Returns: string
                           },
"cancel_pcw_match":
{ Args: { "p_match": string }; Returns: undefined
                           },
"cancel_pcw_post":
{ Args: { "p_post": string }; Returns: undefined
                           },
"create_demo_worker_token":
{ Args: { "p_name": string }; Returns: string
                           },
"create_pcw_post":
{ Args: { "p_best_of": number,"p_guests": (string)[],"p_maps": string,"p_name": string,"p_note": string,"p_players": (string)[],"p_starts_at": string }; Returns: string
                           },
"create_server_token":
{ Args: { "p_name": string }; Returns: string
                           },
"csstv_auth":
{ Args: { "p_token": string }; Returns: string
                           },
"csstv_check_token":
{ Args: { "p_token": string }; Returns: Record<string, unknown>
                           },
"csstv_ingest":
{ Args: { "p": Json,"p_server": string }; Returns: string
                           },
"csstv_jint":
{ Args: { "j": Json,"k": string,"p_max"?: number }; Returns: number
                           },
"csstv_license":
{ Args: { "p_token": string,"p_version"?: string }; Returns: Json
                           },
"csstv_ncdf":
{ Args: { "x": number }; Returns: number
                           },
"csstv_npdf":
{ Args: { "x": number }; Returns: number
                           },
"csstv_rating":
{ Args: { "deaths": number,"k1": number,"k2": number,"k3": number,"k4": number,"k5": number,"kills": number,"rounds": number }; Returns: number
                           },
"csstv_request_ip":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"csstv_steam64":
{ Args: { "p": string }; Returns: string
                           },
"demo_auth":
{ Args: { "p_token": string }; Returns: string
                           },
"demo_expire":
{ Args: { "p_days"?: number,"p_token": string }; Returns: number
                           },
"demo_mark":
{ Args: { "p_key"?: string,"p_result": string,"p_size"?: number,"p_token": string,"p_uid": string }; Returns: string
                           },
"demo_pending":
{ Args: { "p_limit"?: number,"p_token": string }; Returns: {
              "attempts": number,"external_id": string,"map": string,"panel_server_id": string,"played_at": string,"score1": number,"score2": number,"server_name": string,"status": string
            }[]
                           },
"elo_apply_match":
{ Args: { "p_match": string }; Returns: undefined
                           },
"elo_recompute_all":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"elo_set_config":
{ Args: { "p_base": number,"p_bonus_factor": number,"p_bonus_max": number,"p_floor": number,"p_full_pct"?: number,"p_min_pct"?: number,"p_recompute"?: boolean,"p_start_elo": number }; Returns: number
                           },
"elo_weight":
{ Args: { "p_full_pct": number,"p_min_pct": number,"p_rounds": number,"p_total": number }; Returns: number
                           },
"ingest_server_chunk":
{ Args: { "p_data": string,"p_part": number,"p_token": string,"p_total": number,"p_uid": string }; Returns: string
                           },
"ingest_server_match":
{ Args: { "p_payload": Json,"p_token": string }; Returns: string
                           },
"is_admin":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_match_captain":
{ Args: { "p_match": string }; Returns: boolean
                           },
"is_team_captain":
{ Args: { "p_team": string }; Returns: boolean
                           },
"link_steam_id":
{ Args: { "p_player": string,"p_steam": string }; Returns: undefined
                           },
"norm_maps":
{ Args: { "j": Json }; Returns: Json
                           },
"pcw_cleanup":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"pcw_make_side":
{ Args: { "p_guests": (string)[],"p_name": string,"p_players": (string)[] }; Returns: string
                           },
"recompute_player_stats":
{ Args: { "p_player": string }; Returns: undefined
                           },
"rotate_server_token":
{ Args: { "p_server": string }; Returns: string
                           },
"set_my_tag":
{ Args: { "p_tag": string }; Returns: undefined
                           },
"set_team_captain":
{ Args: { "p_team": string,"p_user": string }; Returns: undefined
                           }
          }
          Enums: {
            [_ in never]: never
          }
          CompositeTypes: {
            [_ in never]: never
          }
        }
}

type DatabaseWithoutInternals = Omit<Database, '__InternalSupabase'>

type DefaultSchema = DatabaseWithoutInternals[Extract<keyof Database, "public">]

export type Tables<
  DefaultSchemaTableNameOrOptions extends
    | keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
        DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? (DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"] &
      DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Views"])[TableName] extends {
      Row: infer R
    }
    ? R
    : never
  : DefaultSchemaTableNameOrOptions extends keyof (DefaultSchema["Tables"] & DefaultSchema["Views"])
  ? (DefaultSchema["Tables"] & DefaultSchema["Views"])[DefaultSchemaTableNameOrOptions] extends {
      Row: infer R
    }
    ? R
    : never
  : never

export type TablesInsert<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Insert: infer I
    }
    ? I
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Insert: infer I
    }
    ? I
    : never
  : never

export type TablesUpdate<
  DefaultSchemaTableNameOrOptions extends
    | keyof DefaultSchema["Tables"]
    | { schema: keyof DatabaseWithoutInternals },
  TableName extends DefaultSchemaTableNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"]
    : never = never
> = DefaultSchemaTableNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaTableNameOrOptions["schema"]]["Tables"][TableName] extends {
      Update: infer U
    }
    ? U
    : never
  : DefaultSchemaTableNameOrOptions extends keyof DefaultSchema["Tables"]
  ? DefaultSchema["Tables"][DefaultSchemaTableNameOrOptions] extends {
      Update: infer U
    }
    ? U
    : never
  : never

export type Enums<
  DefaultSchemaEnumNameOrOptions extends
    | keyof DefaultSchema["Enums"]
    | { schema: keyof DatabaseWithoutInternals },
  EnumName extends DefaultSchemaEnumNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"]
    : never = never
> = DefaultSchemaEnumNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[DefaultSchemaEnumNameOrOptions["schema"]]["Enums"][EnumName]
  : DefaultSchemaEnumNameOrOptions extends keyof DefaultSchema["Enums"]
  ? DefaultSchema["Enums"][DefaultSchemaEnumNameOrOptions]
  : never

export type CompositeTypes<
  PublicCompositeTypeNameOrOptions extends
    | keyof DefaultSchema["CompositeTypes"]
    | { schema: keyof DatabaseWithoutInternals },
  CompositeTypeName extends PublicCompositeTypeNameOrOptions extends {
    schema: keyof DatabaseWithoutInternals
  }
    ? keyof DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"]
    : never = never
> = PublicCompositeTypeNameOrOptions extends { schema: keyof DatabaseWithoutInternals }
  ? DatabaseWithoutInternals[PublicCompositeTypeNameOrOptions["schema"]]["CompositeTypes"][CompositeTypeName]
  : PublicCompositeTypeNameOrOptions extends keyof DefaultSchema["CompositeTypes"]
  ? DefaultSchema["CompositeTypes"][PublicCompositeTypeNameOrOptions]
  : never

export const Constants = {
  "public": {
          Enums: {
            
          }
        }
} as const

