
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "blocked_words": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"word": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"word": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"word"?: string
                  }
                  Relationships: [
                    
                  ]
                },"demo_workers": {
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
                },"elo_adjustments": {
                  Row: {
                    "applied_at": string,"created_at": string,"created_by": string | null,"delta": number,"id": number,"reason": string,"steam_id": string
                  }
                  Insert: {
                    "applied_at"?: string,"created_at"?: string,"created_by"?: string | null,"delta": number,"id"?: never,"reason": string,"steam_id": string
                  }
                  Update: {
                    "applied_at"?: string,"created_at"?: string,"created_by"?: string | null,"delta"?: number,"id"?: never,"reason"?: string,"steam_id"?: string
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
                },"event_stage_teams": {
                  Row: {
                    "event_id": string,"grp": number,"manual_rank": number | null,"phase": number,"seed": number,"stage": string,"team_id": string
                  }
                  Insert: {
                    "event_id": string,"grp"?: number,"manual_rank"?: number | null,"phase": number,"seed": number,"stage": string,"team_id": string
                  }
                  Update: {
                    "event_id"?: string,"grp"?: number,"manual_rank"?: number | null,"phase"?: number,"seed"?: number,"stage"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_stage_teams_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_stage_teams_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "champion": string | null,"config": NonNullable<Json>,"ends_on": string | null,"id": string,"max_teams": number | null,"min_teams": number | null,"name": string,"organizer_id": string | null,"players_max": number,"players_min": number,"prize": string | null,"rules": string | null,"seeds": (string)[],"starts_on": string | null,"status": string,"template": string,"tie_pending": Json | null
                  }
                  Insert: {
                    "champion"?: string | null,"config"?: NonNullable<Json>,"ends_on"?: string | null,"id"?: string,"max_teams"?: number | null,"min_teams"?: number | null,"name": string,"organizer_id"?: string | null,"players_max"?: number,"players_min"?: number,"prize"?: string | null,"rules"?: string | null,"seeds"?: (string)[],"starts_on"?: string | null,"status"?: string,"template"?: string,"tie_pending"?: Json | null
                  }
                  Update: {
                    "champion"?: string | null,"config"?: NonNullable<Json>,"ends_on"?: string | null,"id"?: string,"max_teams"?: number | null,"min_teams"?: number | null,"name"?: string,"organizer_id"?: string | null,"players_max"?: number,"players_min"?: number,"prize"?: string | null,"rules"?: string | null,"seeds"?: (string)[],"starts_on"?: string | null,"status"?: string,"template"?: string,"tie_pending"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_champion_fkey"
      columns: ["champion"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_champion_fkey"
      columns: ["champion"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "events_champion_fkey"
      columns: ["champion"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
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
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingest_chunks_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ingest_chunks_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"map_pool": {
                  Row: {
                    "active": boolean,"name": string,"position": number,"versions": (string)[]
                  }
                  Insert: {
                    "active"?: boolean,"name": string,"position"?: number,"versions": (string)[]
                  }
                  Update: {
                    "active"?: boolean,"name"?: string,"position"?: number,"versions"?: (string)[]
                  }
                  Relationships: [
                    
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
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
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
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
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
                    "action": string,"by_user": string,"created_at": string,"id": string,"map": string,"match_id": string,"seq": number,"team_id": string,"version": string | null
                  }
                  Insert: {
                    "action": string,"by_user": string,"created_at"?: string,"id"?: string,"map": string,"match_id": string,"seq": number,"team_id": string,"version"?: string | null
                  }
                  Update: {
                    "action"?: string,"by_user"?: string,"created_at"?: string,"id"?: string,"map"?: string,"match_id"?: string,"seq"?: number,"team_id"?: string,"version"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_vetos_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_vetos_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_vetos_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_vetos_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_vetos_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_vetos_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "match_vetos_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
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
                    "advantage_side": number | null,"best_of": number,"bye": boolean,"cancel_reason": string | null,"cancelled_by": string | null,"dead1": boolean,"dead2": boolean,"demo_attempts": number,"demo_key": string | null,"demo_size": number | null,"demo_status": string,"demo_uploaded_at": string | null,"end_reason": string | null,"event_id": string | null,"external_id": string | null,"grp": number | null,"id": string,"kind": string,"lineup1": (string)[],"lineup2": (string)[],"link_code": string | null,"map": string | null,"maps": Json | null,"next_lose": string | null,"next_lose_slot": number | null,"next_win": string | null,"next_win_slot": number | null,"parent_match_id": string | null,"parent_side1": number | null,"phase": number | null,"played_at": string | null,"pos": number | null,"round": number | null,"score1": number | null,"score2": number | null,"server_id": string | null,"server_ip": string | null,"side1_guests": (string)[],"side1_name": string | null,"side2_guests": (string)[],"side2_name": string | null,"stage": string | null,"starts_at": string | null,"status": string,"team1": string | null,"team2": string | null,"winner": string | null,"winner_side": number | null
                  }
                  Insert: {
                    "advantage_side"?: number | null,"best_of"?: number,"bye"?: boolean,"cancel_reason"?: string | null,"cancelled_by"?: string | null,"dead1"?: boolean,"dead2"?: boolean,"demo_attempts"?: number,"demo_key"?: string | null,"demo_size"?: number | null,"demo_status"?: string,"demo_uploaded_at"?: string | null,"end_reason"?: string | null,"event_id"?: string | null,"external_id"?: string | null,"grp"?: number | null,"id"?: string,"kind"?: string,"lineup1"?: (string)[],"lineup2"?: (string)[],"link_code"?: string | null,"map"?: string | null,"maps"?: Json | null,"next_lose"?: string | null,"next_lose_slot"?: number | null,"next_win"?: string | null,"next_win_slot"?: number | null,"parent_match_id"?: string | null,"parent_side1"?: number | null,"phase"?: number | null,"played_at"?: string | null,"pos"?: number | null,"round"?: number | null,"score1"?: number | null,"score2"?: number | null,"server_id"?: string | null,"server_ip"?: string | null,"side1_guests"?: (string)[],"side1_name"?: string | null,"side2_guests"?: (string)[],"side2_name"?: string | null,"stage"?: string | null,"starts_at"?: string | null,"status"?: string,"team1"?: string | null,"team2"?: string | null,"winner"?: string | null,"winner_side"?: number | null
                  }
                  Update: {
                    "advantage_side"?: number | null,"best_of"?: number,"bye"?: boolean,"cancel_reason"?: string | null,"cancelled_by"?: string | null,"dead1"?: boolean,"dead2"?: boolean,"demo_attempts"?: number,"demo_key"?: string | null,"demo_size"?: number | null,"demo_status"?: string,"demo_uploaded_at"?: string | null,"end_reason"?: string | null,"event_id"?: string | null,"external_id"?: string | null,"grp"?: number | null,"id"?: string,"kind"?: string,"lineup1"?: (string)[],"lineup2"?: (string)[],"link_code"?: string | null,"map"?: string | null,"maps"?: Json | null,"next_lose"?: string | null,"next_lose_slot"?: number | null,"next_win"?: string | null,"next_win_slot"?: number | null,"parent_match_id"?: string | null,"parent_side1"?: number | null,"phase"?: number | null,"played_at"?: string | null,"pos"?: number | null,"round"?: number | null,"score1"?: number | null,"score2"?: number | null,"server_id"?: string | null,"server_ip"?: string | null,"side1_guests"?: (string)[],"side1_name"?: string | null,"side2_guests"?: (string)[],"side2_name"?: string | null,"stage"?: string | null,"starts_at"?: string | null,"status"?: string,"team1"?: string | null,"team2"?: string | null,"winner"?: string | null,"winner_side"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team1_fkey"
      columns: ["team1"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team1_fkey"
      columns: ["team1"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_team1_fkey"
      columns: ["team1"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
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
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"pcw_config": {
                  Row: {
                    "best_of": (number)[],"id": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "best_of"?: (number)[],"id"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "best_of"?: (number)[],"id"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
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
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
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
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "achievements": string | null,"bio": string | null,"id": string,"nick": string,"photo_url": string | null,"privacy": string,"steam_id": string | null,"team_history": string | null,"user_id": string | null
                  }
                  Insert: {
                    "achievements"?: string | null,"bio"?: string | null,"id"?: string,"nick": string,"photo_url"?: string | null,"privacy"?: string,"steam_id"?: string | null,"team_history"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "achievements"?: string | null,"bio"?: string | null,"id"?: string,"nick"?: string,"photo_url"?: string | null,"privacy"?: string,"steam_id"?: string | null,"team_history"?: string | null,"user_id"?: string | null
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
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "profile_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "profile_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"profiles": {
                  Row: {
                    "id": string,"role": string,"tag": string | null,"tag_changed_at": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "id": string,"role"?: string,"tag"?: string | null,"tag_changed_at"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "id"?: string,"role"?: string,"tag"?: string | null,"tag_changed_at"?: string | null,"updated_at"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"ranking_config": {
                  Row: {
                    "id": number,"updated_at": string,"updated_by": string | null,"win_official": number,"win_pcw": number
                  }
                  Insert: {
                    "id"?: number,"updated_at"?: string,"updated_by"?: string | null,"win_official"?: number,"win_pcw"?: number
                  }
                  Update: {
                    "id"?: number,"updated_at"?: string,"updated_by"?: string | null,"win_official"?: number,"win_pcw"?: number
                  }
                  Relationships: [
                    
                  ]
                },"team_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"id": string,"kind": string,"player_id": string,"resolved_at": string | null,"resolved_by": string | null,"status": string,"team_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"kind": string,"player_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"team_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"kind"?: string,"player_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_members": {
                  Row: {
                    "created_at": string,"id": string,"joined_at": string | null,"left_at": string | null,"player_id": string,"role": string,"team_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"joined_at"?: string | null,"left_at"?: string | null,"player_id": string,"role"?: string,"team_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"joined_at"?: string | null,"left_at"?: string | null,"player_id"?: string,"role"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
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
                    "captain_id": string | null,"guests": (string)[],"id": string,"kind": string,"name": string,"owner_id": string | null,"parent_team_id": string | null,"tag": string | null
                  }
                  Insert: {
                    "captain_id"?: string | null,"guests"?: (string)[],"id"?: string,"kind"?: string,"name": string,"owner_id"?: string | null,"parent_team_id"?: string | null,"tag"?: string | null
                  }
                  Update: {
                    "captain_id"?: string | null,"guests"?: (string)[],"id"?: string,"kind"?: string,"name"?: string,"owner_id"?: string | null,"parent_team_id"?: string | null,"tag"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_registration_players": {
                  Row: {
                    "event_id": string,"player_id": string,"team_id": string
                  }
                  Insert: {
                    "event_id": string,"player_id": string,"team_id": string
                  }
                  Update: {
                    "event_id"?: string,"player_id"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_registration_players_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registration_players_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registration_players_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registration_players_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "tournament_registration_players_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "tournament_registration_players_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_registrations": {
                  Row: {
                    "created_at": string,"event_id": string | null,"id": string,"start_stage": number,"team_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"event_id"?: string | null,"id"?: string,"start_stage"?: number,"team_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"event_id"?: string | null,"id"?: string,"start_stage"?: number,"team_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "tournament_registrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
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
            "admin_demo_list": {
                  Row: {
                    "demo_attempts": number | null,"demo_size": number | null,"demo_status": string | null,"demo_uploaded_at": string | null,"expires_at": string | null,"external_id": string | null,"id": string | null,"kind": string | null,"map": string | null,"parent_match_id": string | null,"played_at": string | null,"score1": number | null,"score2": number | null,"search": string | null,"server_has_panel": boolean | null,"server_id": string | null,"server_name": string | null,"side1_name": string | null,"side2_name": string | null,"status": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_demo_summary": {
                  Row: {
                    "expired": number | null,"missing": number | null,"oldest_pending_at": string | null,"pending": number | null,"uploaded": number | null,"uploaded_bytes": number | null,"worker_last_seen_at": string | null,"worker_online": boolean | null
                  }
                  Relationships: [
                    
                  ]
                },"admin_demo_worker_list": {
                  Row: {
                    "active": boolean | null,"created_at": string | null,"id": string | null,"last_seen_at": string | null,"name": string | null,"online": boolean | null,"search": string | null
                  }
                  Insert: {
                           "active"?: boolean | null,"created_at"?: string | null,"id"?: string | null,"last_seen_at"?: string | null,"name"?: string | null,"online"?: never,"search"?: never
                         }
                        Update: {
                           "active"?: boolean | null,"created_at"?: string | null,"id"?: string | null,"last_seen_at"?: string | null,"name"?: string | null,"online"?: never,"search"?: never
                         }
                        Relationships: [
                    
                  ]
                },"admin_server_list": {
                  Row: {
                    "active": boolean | null,"allowed_ip": string | null,"connect_address": string | null,"created_at": string | null,"has_panel": boolean | null,"id": string | null,"last_ip": string | null,"last_match_at": string | null,"last_seen_at": string | null,"license_expires_at": string | null,"license_state": string | null,"matches": number | null,"name": string | null,"online": boolean | null,"panel_server_id": string | null,"plugin_version": string | null,"search": string | null
                  }
                  Insert: {
                           "active"?: boolean | null,"allowed_ip"?: string | null,"connect_address"?: string | null,"created_at"?: string | null,"has_panel"?: never,"id"?: string | null,"last_ip"?: string | null,"last_match_at"?: never,"last_seen_at"?: string | null,"license_expires_at"?: string | null,"license_state"?: never,"matches"?: never,"name"?: string | null,"online"?: never,"panel_server_id"?: string | null,"plugin_version"?: string | null,"search"?: never
                         }
                        Update: {
                           "active"?: boolean | null,"allowed_ip"?: string | null,"connect_address"?: string | null,"created_at"?: string | null,"has_panel"?: never,"id"?: string | null,"last_ip"?: string | null,"last_match_at"?: never,"last_seen_at"?: string | null,"license_expires_at"?: string | null,"license_state"?: never,"matches"?: never,"name"?: string | null,"online"?: never,"panel_server_id"?: string | null,"plugin_version"?: string | null,"search"?: never
                         }
                        Relationships: [
                    
                  ]
                },"admin_team_requests": {
                  Row: {
                    "alias": string | null,"has_steam": boolean | null,"name": string | null,"search": string | null,"status": string | null,"status_order": number | null,"tag": string | null,"user_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"admin_user_list": {
                  Row: {
                    "alias": string | null,"alias_changed_at": string | null,"has_player": boolean | null,"has_steam": boolean | null,"id": string | null,"player_id": string | null,"role": string | null,"search": string | null,"steam_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"event_group_standings": {
                  Row: {
                    "event_id": string | null,"grp": number | null,"lost": number | null,"manual_rank": number | null,"played": number | null,"points": number | null,"rounds_against": number | null,"rounds_diff": number | null,"rounds_for": number | null,"seed": number | null,"team_id": string | null,"won": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_stage_teams_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_stage_teams_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"event_list": {
                  Row: {
                    "champion_id": string | null,"champion_name": string | null,"champion_tag": string | null,"ends_on": string | null,"id": string | null,"max_teams": number | null,"name": string | null,"organizer_alias": string | null,"organizer_id": string | null,"prize": string | null,"search": string | null,"starts_on": string | null,"status": string | null,"teams": number | null,"template": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_champion_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_champion_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "events_champion_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "events_champion_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"event_registrations_view": {
                  Row: {
                    "created_at": string | null,"event_id": string | null,"name": string | null,"players": number | null,"search": string | null,"seed": number | null,"start_stage": number | null,"tag": string | null,"team_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registrations_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "tournament_registrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "tournament_registrations_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"event_standings": {
                  Row: {
                    "buchholz": number | null,"event_id": string | null,"grp": number | null,"losses": number | null,"lost": number | null,"name": string | null,"phase": number | null,"place": number | null,"played": number | null,"points": number | null,"rounds_against": number | null,"rounds_diff": number | null,"rounds_for": number | null,"stage": string | null,"state": string | null,"tag": string | null,"team_id": string | null,"tied": boolean | null,"wins": number | null,"won": number | null
                  }
                  Relationships: [
                    
                  ]
                },"event_swiss_standings": {
                  Row: {
                    "buchholz": number | null,"event_id": string | null,"losses": number | null,"phase": number | null,"rounds_diff": number | null,"seed": number | null,"state": string | null,"team_id": string | null,"wins": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "event_stage_teams_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_stage_teams_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "event_stage_teams_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"game_servers_public": {
                  Row: {
                    "connect_address": string | null,"id": string | null,"name": string | null
                  }
                  Insert: {
                           "connect_address"?: string | null,"id"?: string | null,"name"?: string | null
                         }
                        Update: {
                           "connect_address"?: string | null,"id"?: string | null,"name"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"match_chat_public": {
                  Row: {
                    "alias": string | null,"created_at": string | null,"id": number | null,"match_id": string | null,"message": string | null,"user_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_list": {
                  Row: {
                    "at": string | null,"best_of": number | null,"bye": boolean | null,"demo_status": string | null,"end_reason": string | null,"event_id": string | null,"event_name": string | null,"grp": number | null,"id": string | null,"kind": string | null,"last_round": number | null,"map": string | null,"parent_match_id": string | null,"phase": number | null,"played_at": string | null,"player_ids": (string)[] | null,"pos": number | null,"round": number | null,"score1": number | null,"score2": number | null,"search": string | null,"side1_name": string | null,"side2_name": string | null,"stage": string | null,"stage_order": number | null,"starts_at": string | null,"status": string | null,"team1_id": string | null,"team1_name": string | null,"team1_tag": string | null,"team2_id": string | null,"team2_name": string | null,"team2_tag": string | null,"winner_side": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "matches_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "event_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_event_id_fkey"
      columns: ["event_id"]
isOneToOne: false
      referencedRelation: "events"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "matches_team1_fkey"
      columns: ["team1_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team1_fkey"
      columns: ["team1_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_team1_fkey"
      columns: ["team1_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_team1_fkey"
      columns: ["team1_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"pcw_post_list": {
                  Row: {
                    "best_of": number | null,"by_alias": string | null,"by_user": string | null,"created_at": string | null,"id": string | null,"maps": string | null,"match_id": string | null,"note": string | null,"parent_name": string | null,"parent_tag": string | null,"parent_team_id": string | null,"search": string | null,"side_name": string | null,"starts_at": string | null,"status": string | null,"team_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"player_map_stats": {
                  Row: {
                    "adr": number | null,"kd": number | null,"losses": number | null,"map_name": string | null,"maps": number | null,"player_id": string | null,"rating": number | null,"wins": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"player_matches": {
                  Row: {
                    "assists": number | null,"damage": number | null,"deaths": number | null,"demo_status": string | null,"elo_after": number | null,"elo_before": number | null,"elo_delta": number | null,"game_nick": string | null,"headshots": number | null,"kills": number | null,"kind": string | null,"map": string | null,"match_id": string | null,"parent_match_id": string | null,"played_at": string | null,"player_id": string | null,"rating": number | null,"rounds": number | null,"score1": number | null,"score2": number | null,"side": number | null,"side1_name": string | null,"side2_name": string | null,"status": string | null,"team1_name": string | null,"team2_name": string | null,"winner_side": number | null,"won": boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"player_overview": {
                  Row: {
                    "elo": number | null,"elo_matches": number | null,"has_account": boolean | null,"has_steam": boolean | null,"id": string | null,"kd": number | null,"losses": number | null,"maps": number | null,"nick": string | null,"peak_elo": number | null,"photo_url": string | null,"privacy": string | null,"rating": number | null,"search": string | null,"teams": Json | null,"wins": number | null
                  }
                  Relationships: [
                    
                  ]
                },"player_stats": {
                  Row: {
                    "adr": number | null,"assists": number | null,"damage": number | null,"deaths": number | null,"hs": number | null,"kd": number | null,"kills": number | null,"losses": number | null,"maps": number | null,"player_id": string | null,"rating": number | null,"rounds": number | null,"wins": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    }
                  ]
                },"public_profiles": {
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
                },"steam_unlinked": {
                  Row: {
                    "last_nick": string | null,"last_played": string | null,"matches": number | null,"steam_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"team_members_view": {
                  Row: {
                    "active": boolean | null,"alias": string | null,"elo": number | null,"has_steam": boolean | null,"is_captain": boolean | null,"joined_at": string | null,"left_at": string | null,"photo_url": string | null,"player_id": string | null,"role": string | null,"team_id": string | null,"team_kind": string | null,"team_name": string | null,"team_tag": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_overview": {
                  Row: {
                    "captain_id": string | null,"captain_nick": string | null,"captain_player_id": string | null,"id": string | null,"kind": string | null,"members": number | null,"name": string | null,"owner_id": string | null,"parent_team_id": string | null,"search": string | null,"tag": string | null
                  }
                  Insert: {
                           "captain_id"?: string | null,"captain_nick"?: never,"captain_player_id"?: never,"id"?: string | null,"kind"?: string | null,"members"?: never,"name"?: string | null,"owner_id"?: string | null,"parent_team_id"?: string | null,"search"?: never,"tag"?: string | null
                         }
                        Update: {
                           "captain_id"?: string | null,"captain_nick"?: never,"captain_player_id"?: never,"id"?: string | null,"kind"?: string | null,"members"?: never,"name"?: string | null,"owner_id"?: string | null,"parent_team_id"?: string | null,"search"?: never,"tag"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "team_ranking"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "team_standings"
      referencedColumns: ["team_id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_ranking": {
                  Row: {
                    "name": string | null,"official_lost": number | null,"official_played": number | null,"official_points": number | null,"official_position": number | null,"official_won": number | null,"search": string | null,"tag": string | null,"team_id": string | null,"total_lost": number | null,"total_played": number | null,"total_points": number | null,"total_position": number | null,"total_won": number | null
                  }
                  Relationships: [
                    
                  ]
                },"team_standings": {
                  Row: {
                    "name": string | null,"official_lost": number | null,"official_played": number | null,"official_points": number | null,"official_won": number | null,"pcw_lost": number | null,"pcw_played": number | null,"pcw_points": number | null,"pcw_won": number | null,"tag": string | null,"team_id": string | null
                  }
                  Relationships: [
                    
                  ]
                }
          }
          Functions: {
            "accept_pcw":
{ Args: { "p_guests": (string)[],"p_name": string,"p_players": (string)[],"p_post": string,"p_team"?: string }; Returns: string
                           },
"admin_create_demo_worker":
{ Args: { "p_name": string }; Returns: {
              "id": string,"token": string
            }[]
                           },
"admin_create_server":
{ Args: { "p_allowed_ip"?: string,"p_connect_address"?: string,"p_license_expires_at"?: string,"p_name": string,"p_panel_server_id"?: string }; Returns: {
              "id": string,"token": string
            }[]
                           },
"admin_demo_retry":
{ Args: { "p_match": string }; Returns: undefined
                           },
"admin_name_blocked":
{ Args: { "p": string }; Returns: string
                           },
"admin_users":
{ Args: { "p_q"?: string }; Returns: {
              "id": string,"player_id": string,"player_steam_id": string,"role": string,"tag": string,"tag_changed_at": string
            }[]
                           },
"alias_check":
{ Args: { "p_tag": string }; Returns: string
                           },
"approve_team_request":
{ Args: { "p_user": string }; Returns: string
                           },
"blocked_names_hits":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"kind": string,"name": string,"word": string
            }[]
                           },
"can_manage_event":
{ Args: { "p_event": string }; Returns: boolean
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
{ Args: { "p_best_of": number,"p_guests": (string)[],"p_maps": string,"p_name": string,"p_note": string,"p_players": (string)[],"p_starts_at": string,"p_team"?: string }; Returns: string
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
"csstv_link_game":
{ Args: { "p_code": string,"p_game": string,"p_side_a": number }; Returns: boolean
                           },
"csstv_match_lookup":
{ Args: { "p_code": string,"p_token": string }; Returns: string
                           },
"csstv_ncdf":
{ Args: { "x": number }; Returns: number
                           },
"csstv_new_link_code":
{ Args: Record<PropertyKey, never>; Returns: string
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
"csstv_steam2":
{ Args: { "p": string }; Returns: string
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
"elo_add_adjustment":
{ Args: { "p_at"?: string,"p_delta": number,"p_reason": string,"p_steam_ids": (string)[] }; Returns: number
                           },
"elo_apply_adjustment":
{ Args: { "p_delta": number,"p_steam_id": string }; Returns: undefined
                           },
"elo_apply_match":
{ Args: { "p_match": string }; Returns: undefined
                           },
"elo_recompute_all":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"elo_remove_adjustment":
{ Args: { "p_id": number }; Returns: undefined
                           },
"elo_set_config":
{ Args: { "p_base": number,"p_bonus_factor": number,"p_bonus_max": number,"p_floor": number,"p_full_pct"?: number,"p_min_pct"?: number,"p_recompute"?: boolean,"p_start_elo": number }; Returns: number
                           },
"elo_simulate":
{ Args: { "p_base": number,"p_bonus_factor": number,"p_bonus_max": number,"p_floor": number,"p_full_pct": number,"p_min_pct": number,"p_start_elo": number }; Returns: {
              "abs_delta": number,"changed": boolean,"delta": number,"elo_after": number,"elo_before": number,"matches_after": number,"matches_before": number,"name": string,"player_id": string,"search": string,"steam_id": string
            }[]
                           },
"elo_weight":
{ Args: { "p_full_pct": number,"p_min_pct": number,"p_rounds": number,"p_total": number }; Returns: number
                           },
"event_build_double":
{ Args: { "p_cfg": Json,"p_event": string,"p_teams": (string)[] }; Returns: undefined
                           },
"event_build_groups":
{ Args: { "p_cfg": Json,"p_event": string,"p_teams": (string)[] }; Returns: undefined
                           },
"event_build_ko":
{ Args: { "p_cfg": Json,"p_event": string,"p_phase": number,"p_teams": (string)[] }; Returns: undefined
                           },
"event_config":
{ Args: { "p_config": Json,"p_template": string }; Returns: Json
                           },
"event_config_pick":
{ Args: { "p_defaults": Json,"p_given": Json }; Returns: Json
                           },
"event_engine_on":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"event_generate":
{ Args: { "p_event": string }; Returns: undefined
                           },
"event_group_clashes":
{ Args: { "p_event": string,"p_seeds": (string)[] }; Returns: number
                           },
"event_group_order":
{ Args: { "p_event": string,"p_grp": number }; Returns: {
              "place": number,"team_id": string,"tied": boolean
            }[]
                           },
"event_group_qualifiers":
{ Args: { "p_event": string }; Returns: (string)[]
                           },
"event_progress":
{ Args: { "p_event": string }; Returns: undefined
                           },
"event_propagate_dead":
{ Args: { "p_event": string }; Returns: undefined
                           },
"event_register":
{ Args: { "p_event": string,"p_players": (string)[],"p_start_stage"?: number,"p_team": string }; Returns: undefined
                           },
"event_reset":
{ Args: { "p_event": string }; Returns: undefined
                           },
"event_resolve_tie":
{ Args: { "p_event": string,"p_grp": number,"p_order": (string)[] }; Returns: undefined
                           },
"event_seed_order":
{ Args: { "s": number }; Returns: (number)[]
                           },
"event_set_result":
{ Args: { "p_clear"?: boolean,"p_maps"?: Json,"p_match": string,"p_walkover_winner"?: string }; Returns: undefined
                           },
"event_swiss_phase":
{ Args: { "p_event": string,"p_phase": number }; Returns: undefined
                           },
"event_swiss_round":
{ Args: { "p_event": string,"p_phase": number }; Returns: undefined
                           },
"event_unregister":
{ Args: { "p_event": string,"p_team": string }; Returns: undefined
                           },
"event_unroute":
{ Args: { "p_match": string }; Returns: undefined
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
"is_ip":
{ Args: { "p": string }; Returns: boolean
                           },
"is_match_captain":
{ Args: { "p_match": string }; Returns: boolean
                           },
"is_match_participant":
{ Args: { "p_match": string }; Returns: boolean
                           },
"is_organizer":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_team_captain":
{ Args: { "p_team": string }; Returns: boolean
                           },
"link_steam_id":
{ Args: { "p_player": string,"p_steam": string }; Returns: undefined
                           },
"match_chat_can_write":
{ Args: { "p_match": string }; Returns: boolean
                           },
"match_link_code":
{ Args: { "p_match": string }; Returns: string
                           },
"match_roster":
{ Args: { "p_match": string,"p_team": string }; Returns: string[]
                           },
"match_rounds":
{ Args: { "p_maps": Json }; Returns: (number)[]
                           },
"match_schedule":
{ Args: { "p_match": string,"p_server": string,"p_starts_at": string }; Returns: undefined
                           },
"name_blocked":
{ Args: { "p": string }; Returns: string
                           },
"name_norm":
{ Args: { "p": string }; Returns: string
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
"pcw_set_result":
{ Args: { "p_maps": Json,"p_match": string }; Returns: undefined
                           },
"pcw_side_team":
{ Args: { "p_side": string,"p_team": string }; Returns: undefined
                           },
"reject_team_request":
{ Args: { "p_user": string }; Returns: undefined
                           },
"rotate_demo_worker_token":
{ Args: { "p_worker": string }; Returns: string
                           },
"rotate_server_token":
{ Args: { "p_server": string }; Returns: string
                           },
"search_norm":
{ Args: { "p": string }; Returns: string
                           },
"set_my_tag":
{ Args: { "p_tag": string }; Returns: undefined
                           },
"set_pcw_formats":
{ Args: { "p_best_of": (number)[] }; Returns: (number)[]
                           },
"set_ranking_config":
{ Args: { "p_official": number,"p_pcw": number }; Returns: undefined
                           },
"set_team_captain":
{ Args: { "p_team": string,"p_user": string }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_role": string,"p_user": string }; Returns: undefined
                           },
"set_user_tag":
{ Args: { "p_force"?: boolean,"p_tag": string,"p_user": string }; Returns: undefined
                           },
"team_can_join":
{ Args: { "p_player": string,"p_team": string }; Returns: undefined
                           },
"team_invite":
{ Args: { "p_alias"?: string,"p_player"?: string,"p_team": string }; Returns: string
                           },
"team_invite_answer":
{ Args: { "p_accept": boolean,"p_id": string }; Returns: undefined
                           },
"team_invite_cancel":
{ Args: { "p_id": string }; Returns: undefined
                           },
"team_invites_expire":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"team_kick":
{ Args: { "p_player": string,"p_team": string }; Returns: undefined
                           },
"team_leave":
{ Args: { "p_team": string }; Returns: undefined
                           },
"team_request_join":
{ Args: { "p_team": string }; Returns: string
                           },
"veto_act":
{ Args: { "p_map": string,"p_match": string,"p_version"?: string }; Returns: undefined
                           },
"veto_reset":
{ Args: { "p_match": string }; Returns: undefined
                           },
"veto_sequence":
{ Args: { "p_bo": number,"p_maps": number }; Returns: (string)[]
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

