
export type Json = string | number | boolean | null | { [key: string]: Json | undefined } | Json[]

export type Database = {
  
  "public": {
          Tables: {
            "ac_admin_actions": {
                  Row: {
                    "action": string,"actor": string | null,"created_at": string,"detail": NonNullable<Json>,"id": number
                  }
                  Insert: {
                    "action": string,"actor"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never
                  }
                  Update: {
                    "action"?: string,"actor"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never
                  }
                  Relationships: [
                    
                  ]
                },"ac_capture_requests": {
                  Row: {
                    "created_at": string,"id": string,"reason": string,"requested_by": string | null,"resolved_at": string | null,"session_id": string,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"reason": string,"requested_by"?: string | null,"resolved_at"?: string | null,"session_id": string,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"reason"?: string,"requested_by"?: string | null,"resolved_at"?: string | null,"session_id"?: string,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ac_capture_requests_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "ac_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"ac_config": {
                  Row: {
                    "api_secret_hash": string | null,"capture_max_s": number,"capture_min_s": number,"id": number,"open_until": string | null,"retention_days": number,"updated_at": string
                  }
                  Insert: {
                    "api_secret_hash"?: string | null,"capture_max_s"?: number,"capture_min_s"?: number,"id"?: number,"open_until"?: string | null,"retention_days"?: number,"updated_at"?: string
                  }
                  Update: {
                    "api_secret_hash"?: string | null,"capture_max_s"?: number,"capture_min_s"?: number,"id"?: number,"open_until"?: string | null,"retention_days"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ac_devices": {
                  Row: {
                    "access_expires_at": string,"access_hash": string,"agent_version": string | null,"created_at": string,"id": string,"last_ip": string | null,"last_seen_at": string | null,"name": string,"public_key": string | null,"refresh_hash": string,"revoked_at": string | null,"user_id": string
                  }
                  Insert: {
                    "access_expires_at": string,"access_hash": string,"agent_version"?: string | null,"created_at"?: string,"id"?: string,"last_ip"?: string | null,"last_seen_at"?: string | null,"name": string,"public_key"?: string | null,"refresh_hash": string,"revoked_at"?: string | null,"user_id": string
                  }
                  Update: {
                    "access_expires_at"?: string,"access_hash"?: string,"agent_version"?: string | null,"created_at"?: string,"id"?: string,"last_ip"?: string | null,"last_seen_at"?: string | null,"name"?: string,"public_key"?: string | null,"refresh_hash"?: string,"revoked_at"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ac_evidence": {
                  Row: {
                    "entry": string,"entry_hash": string,"id": number,"item_sha": string,"kind": string,"prev_hash": string,"raw": string | null,"received_at": string,"ref_id": string | null,"seq": number,"session_id": string,"signature": string
                  }
                  Insert: {
                    "entry": string,"entry_hash": string,"id"?: never,"item_sha": string,"kind": string,"prev_hash": string,"raw"?: string | null,"received_at"?: string,"ref_id"?: string | null,"seq": number,"session_id": string,"signature": string
                  }
                  Update: {
                    "entry"?: string,"entry_hash"?: string,"id"?: never,"item_sha"?: string,"kind"?: string,"prev_hash"?: string,"raw"?: string | null,"received_at"?: string,"ref_id"?: string | null,"seq"?: number,"session_id"?: string,"signature"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ac_evidence_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "ac_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"ac_integrity_logs": {
                  Row: {
                    "checked_by": string | null,"created_at": string,"detail": NonNullable<Json>,"id": number,"result": string,"session_id": string
                  }
                  Insert: {
                    "checked_by"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"result": string,"session_id": string
                  }
                  Update: {
                    "checked_by"?: string | null,"created_at"?: string,"detail"?: NonNullable<Json>,"id"?: never,"result"?: string,"session_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ac_integrity_logs_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "ac_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"ac_link_requests": {
                  Row: {
                    "agent_version": string | null,"approved_at": string | null,"approved_by": string | null,"claimed_at": string | null,"created_at": string,"device_code_hash": string,"device_name": string,"expires_at": string,"id": string,"user_code": string
                  }
                  Insert: {
                    "agent_version"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"claimed_at"?: string | null,"created_at"?: string,"device_code_hash": string,"device_name": string,"expires_at": string,"id"?: string,"user_code": string
                  }
                  Update: {
                    "agent_version"?: string | null,"approved_at"?: string | null,"approved_by"?: string | null,"claimed_at"?: string | null,"created_at"?: string,"device_code_hash"?: string,"device_name"?: string,"expires_at"?: string,"id"?: string,"user_code"?: string
                  }
                  Relationships: [
                    
                  ]
                },"ac_process_events": {
                  Row: {
                    "client_id": string,"id": number,"kind": string,"name": string,"note": string | null,"observed_at": string,"path": string | null,"pid": number,"publisher": string | null,"received_at": string,"session_id": string,"sha256": string | null,"signature": string | null,"started_at": string | null
                  }
                  Insert: {
                    "client_id": string,"id"?: never,"kind": string,"name": string,"note"?: string | null,"observed_at": string,"path"?: string | null,"pid": number,"publisher"?: string | null,"received_at"?: string,"session_id": string,"sha256"?: string | null,"signature"?: string | null,"started_at"?: string | null
                  }
                  Update: {
                    "client_id"?: string,"id"?: never,"kind"?: string,"name"?: string,"note"?: string | null,"observed_at"?: string,"path"?: string | null,"pid"?: number,"publisher"?: string | null,"received_at"?: string,"session_id"?: string,"sha256"?: string | null,"signature"?: string | null,"started_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "ac_process_events_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "ac_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"ac_screenshots": {
                  Row: {
                    "client_id": string,"created_at": string,"height": number,"id": string,"kind": string,"method": string,"request_id": string | null,"session_id": string,"sha256": string,"size_bytes": number,"storage_path": string,"stored_at": string | null,"taken_at": string,"width": number
                  }
                  Insert: {
                    "client_id": string,"created_at"?: string,"height": number,"id"?: string,"kind": string,"method": string,"request_id"?: string | null,"session_id": string,"sha256": string,"size_bytes": number,"storage_path": string,"stored_at"?: string | null,"taken_at": string,"width": number
                  }
                  Update: {
                    "client_id"?: string,"created_at"?: string,"height"?: number,"id"?: string,"kind"?: string,"method"?: string,"request_id"?: string | null,"session_id"?: string,"sha256"?: string,"size_bytes"?: number,"storage_path"?: string,"stored_at"?: string | null,"taken_at"?: string,"width"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "ac_screenshots_request_id_fkey"
      columns: ["request_id"]
isOneToOne: false
      referencedRelation: "ac_capture_requests"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ac_screenshots_session_id_fkey"
      columns: ["session_id"]
isOneToOne: false
      referencedRelation: "ac_sessions"
      referencedColumns: ["id"]
    }
                  ]
                },"ac_server_policy": {
                  Row: {
                    "enforce_mixes": boolean,"protected": boolean,"server_id": string,"updated_at": string
                  }
                  Insert: {
                    "enforce_mixes"?: boolean,"protected"?: boolean,"server_id": string,"updated_at"?: string
                  }
                  Update: {
                    "enforce_mixes"?: boolean,"protected"?: boolean,"server_id"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ac_server_policy_server_id_fkey"
      columns: ["server_id"]
isOneToOne: true
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ac_server_policy_server_id_fkey"
      columns: ["server_id"]
isOneToOne: true
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ac_server_policy_server_id_fkey"
      columns: ["server_id"]
isOneToOne: true
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"ac_sessions": {
                  Row: {
                    "device_id": string,"end_reason": string | null,"ended_at": string | null,"held": boolean,"id": string,"last_contact_at": string,"match_uid": string | null,"player_id": string,"server_id": string,"started_at": string,"status": string,"steam_id": string,"user_id": string
                  }
                  Insert: {
                    "device_id": string,"end_reason"?: string | null,"ended_at"?: string | null,"held"?: boolean,"id"?: string,"last_contact_at"?: string,"match_uid"?: string | null,"player_id": string,"server_id": string,"started_at"?: string,"status"?: string,"steam_id": string,"user_id": string
                  }
                  Update: {
                    "device_id"?: string,"end_reason"?: string | null,"ended_at"?: string | null,"held"?: boolean,"id"?: string,"last_contact_at"?: string,"match_uid"?: string | null,"player_id"?: string,"server_id"?: string,"started_at"?: string,"status"?: string,"steam_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "ac_sessions_device_id_fkey"
      columns: ["device_id"]
isOneToOne: false
      referencedRelation: "ac_devices"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ac_sessions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "ac_sessions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "ac_sessions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "ac_sessions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "ac_sessions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ac_sessions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ac_sessions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ac_sessions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "ac_sessions_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "ac_sessions_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ac_sessions_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "ac_sessions_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"account_admin_actions": {
                  Row: {
                    "action": string,"admin_id": string | null,"created_at": string,"id": number,"user_id": string | null
                  }
                  Insert: {
                    "action": string,"admin_id"?: string | null,"created_at"?: string,"id"?: never,"user_id"?: string | null
                  }
                  Update: {
                    "action"?: string,"admin_id"?: string | null,"created_at"?: string,"id"?: never,"user_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"bans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"created_by_name": string | null,"created_by_steam": string | null,"expires_at": string | null,"id": string,"lift_reason": string | null,"lifted_at": string | null,"lifted_by": string | null,"lifted_by_name": string | null,"lifted_by_steam": string | null,"nick": string | null,"player_id": string | null,"reason": string,"replaced_by": string | null,"server_id": string | null,"source": string,"steam_id": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"created_by_steam"?: string | null,"expires_at"?: string | null,"id"?: string,"lift_reason"?: string | null,"lifted_at"?: string | null,"lifted_by"?: string | null,"lifted_by_name"?: string | null,"lifted_by_steam"?: string | null,"nick"?: string | null,"player_id"?: string | null,"reason": string,"replaced_by"?: string | null,"server_id"?: string | null,"source": string,"steam_id": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"created_by_name"?: string | null,"created_by_steam"?: string | null,"expires_at"?: string | null,"id"?: string,"lift_reason"?: string | null,"lifted_at"?: string | null,"lifted_by"?: string | null,"lifted_by_name"?: string | null,"lifted_by_steam"?: string | null,"nick"?: string | null,"player_id"?: string | null,"reason"?: string,"replaced_by"?: string | null,"server_id"?: string | null,"source"?: string,"steam_id"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "bans_replaced_by_fkey"
      columns: ["replaced_by"]
isOneToOne: false
      referencedRelation: "ban_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_replaced_by_fkey"
      columns: ["replaced_by"]
isOneToOne: false
      referencedRelation: "bans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_updated_by_fkey"
      columns: ["updated_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"blocked_words": {
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
                },"claim_codes": {
                  Row: {
                    "code": string,"created_at": string,"expires_at": string,"result": string | null,"used_at": string | null,"used_steam_id": string | null,"user_id": string
                  }
                  Insert: {
                    "code": string,"created_at"?: string,"expires_at": string,"result"?: string | null,"used_at"?: string | null,"used_steam_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "code"?: string,"created_at"?: string,"expires_at"?: string,"result"?: string | null,"used_at"?: string | null,"used_steam_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"claim_config": {
                  Row: {
                    "id": number,"max_steam_ids": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "id"?: number,"max_steam_ids"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "id"?: number,"max_steam_ids"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"claim_log": {
                  Row: {
                    "code": string | null,"created_at": string,"id": number,"nick": string | null,"ok": boolean,"player_id": string | null,"result": string,"server_id": string | null,"steam_id": string | null,"user_id": string | null
                  }
                  Insert: {
                    "code"?: string | null,"created_at"?: string,"id"?: never,"nick"?: string | null,"ok": boolean,"player_id"?: string | null,"result": string,"server_id"?: string | null,"steam_id"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "code"?: string | null,"created_at"?: string,"id"?: never,"nick"?: string | null,"ok"?: boolean,"player_id"?: string | null,"result"?: string,"server_id"?: string | null,"steam_id"?: string | null,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"clip_config": {
                  Row: {
                    "featured_max": number,"featured_max_vip": number,"id": number,"per_match": number,"per_player": number,"post_seconds": number,"pre_seconds": number,"priorities": NonNullable<Json>,"split_gap_seconds": number,"updated_at": string,"updated_by": string | null,"vip_per_match": number
                  }
                  Insert: {
                    "featured_max"?: number,"featured_max_vip"?: number,"id"?: number,"per_match"?: number,"per_player"?: number,"post_seconds"?: number,"pre_seconds"?: number,"priorities"?: NonNullable<Json>,"split_gap_seconds"?: number,"updated_at"?: string,"updated_by"?: string | null,"vip_per_match"?: number
                  }
                  Update: {
                    "featured_max"?: number,"featured_max_vip"?: number,"id"?: number,"per_match"?: number,"per_player"?: number,"post_seconds"?: number,"pre_seconds"?: number,"priorities"?: NonNullable<Json>,"split_gap_seconds"?: number,"updated_at"?: string,"updated_by"?: string | null,"vip_per_match"?: number
                  }
                  Relationships: [
                    
                  ]
                },"clip_video_trash": {
                  Row: {
                    "created_at": string,"id": number,"video_drive_id": string | null,"video_key": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"video_drive_id"?: string | null,"video_key"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"video_drive_id"?: string | null,"video_key"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"connect_attempts": {
                  Row: {
                    "count": number,"hour": string,"ip": unknown,"server_id": string
                  }
                  Insert: {
                    "count": number,"hour": string,"ip": unknown,"server_id": string
                  }
                  Update: {
                    "count"?: number,"hour"?: string,"ip"?: unknown,"server_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "connect_attempts_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connect_attempts_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "connect_attempts_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
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
                    "applied_at": string,"created_at": string,"created_by": string | null,"delta": number,"id": number,"reason": string,"set_elo": number | null,"source": string,"steam_id": string
                  }
                  Insert: {
                    "applied_at"?: string,"created_at"?: string,"created_by"?: string | null,"delta": number,"id"?: never,"reason": string,"set_elo"?: number | null,"source"?: string,"steam_id": string
                  }
                  Update: {
                    "applied_at"?: string,"created_at"?: string,"created_by"?: string | null,"delta"?: number,"id"?: never,"reason"?: string,"set_elo"?: number | null,"source"?: string,"steam_id"?: string
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
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"events": {
                  Row: {
                    "admin_review": boolean,"approval": string,"approval_note": string | null,"banner_url": string | null,"champion": string | null,"config": NonNullable<Json>,"drawn_at": string | null,"drawn_by": string | null,"ends_on": string | null,"game_mode": string,"historic": boolean,"id": string,"map_pool": (string)[] | null,"max_teams": number | null,"min_teams": number | null,"name": string,"organizer_id": string | null,"prize": string | null,"prize_amount": number | null,"prize_currency": string | null,"prize_currency_other": string | null,"registration_closes_at": string | null,"reviewed_at": string | null,"reviewed_by": string | null,"rules": string | null,"seeds": (string)[],"starts_on": string | null,"status": string,"subs_max": number,"template": string,"testing": boolean,"tie_pending": Json | null,"veto_turn_seconds": number
                  }
                  Insert: {
                    "admin_review"?: boolean,"approval"?: string,"approval_note"?: string | null,"banner_url"?: string | null,"champion"?: string | null,"config"?: NonNullable<Json>,"drawn_at"?: string | null,"drawn_by"?: string | null,"ends_on"?: string | null,"game_mode"?: string,"historic"?: boolean,"id"?: string,"map_pool"?: (string)[] | null,"max_teams"?: number | null,"min_teams"?: number | null,"name": string,"organizer_id"?: string | null,"prize"?: string | null,"prize_amount"?: number | null,"prize_currency"?: string | null,"prize_currency_other"?: string | null,"registration_closes_at"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"rules"?: string | null,"seeds"?: (string)[],"starts_on"?: string | null,"status"?: string,"subs_max"?: number,"template"?: string,"testing"?: boolean,"tie_pending"?: Json | null,"veto_turn_seconds"?: number
                  }
                  Update: {
                    "admin_review"?: boolean,"approval"?: string,"approval_note"?: string | null,"banner_url"?: string | null,"champion"?: string | null,"config"?: NonNullable<Json>,"drawn_at"?: string | null,"drawn_by"?: string | null,"ends_on"?: string | null,"game_mode"?: string,"historic"?: boolean,"id"?: string,"map_pool"?: (string)[] | null,"max_teams"?: number | null,"min_teams"?: number | null,"name"?: string,"organizer_id"?: string | null,"prize"?: string | null,"prize_amount"?: number | null,"prize_currency"?: string | null,"prize_currency_other"?: string | null,"registration_closes_at"?: string | null,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"rules"?: string | null,"seeds"?: (string)[],"starts_on"?: string | null,"status"?: string,"subs_max"?: number,"template"?: string,"testing"?: boolean,"tie_pending"?: Json | null,"veto_turn_seconds"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_champion_fkey"
      columns: ["champion"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_champion_fkey"
      columns: ["champion"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_champion_fkey"
      columns: ["champion"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_game_mode_fkey"
      columns: ["game_mode"]
isOneToOne: false
      referencedRelation: "game_modes"
      referencedColumns: ["code"]
    }
                  ]
                },"game_modes": {
                  Row: {
                    "active": boolean,"code": string,"name": string,"players_per_team": number,"sort": number
                  }
                  Insert: {
                    "active"?: boolean,"code": string,"name": string,"players_per_team": number,"sort"?: number
                  }
                  Update: {
                    "active"?: boolean,"code"?: string,"name"?: string,"players_per_team"?: number,"sort"?: number
                  }
                  Relationships: [
                    
                  ]
                },"game_servers": {
                  Row: {
                    "active": boolean,"allowed_ip": string | null,"connect_address": string | null,"created_at": string,"hud_enabled": boolean,"hud_key": string | null,"hud_port": number | null,"hud_seen_at": string | null,"id": string,"internal_name": string | null,"last_ip": string | null,"last_seen_at": string | null,"license_expires_at": string | null,"listed": boolean,"mm_enabled": boolean,"mode": string | null,"name": string,"official_enabled": boolean,"panel_server_id": string | null,"panel_url": string | null,"pcw_enabled": boolean,"plugin_version": string | null,"region": string | null,"token_hash": string,"tv_port": number | null
                  }
                  Insert: {
                    "active"?: boolean,"allowed_ip"?: string | null,"connect_address"?: string | null,"created_at"?: string,"hud_enabled"?: boolean,"hud_key"?: string | null,"hud_port"?: number | null,"hud_seen_at"?: string | null,"id"?: string,"internal_name"?: string | null,"last_ip"?: string | null,"last_seen_at"?: string | null,"license_expires_at"?: string | null,"listed"?: boolean,"mm_enabled"?: boolean,"mode"?: string | null,"name": string,"official_enabled"?: boolean,"panel_server_id"?: string | null,"panel_url"?: string | null,"pcw_enabled"?: boolean,"plugin_version"?: string | null,"region"?: string | null,"token_hash": string,"tv_port"?: number | null
                  }
                  Update: {
                    "active"?: boolean,"allowed_ip"?: string | null,"connect_address"?: string | null,"created_at"?: string,"hud_enabled"?: boolean,"hud_key"?: string | null,"hud_port"?: number | null,"hud_seen_at"?: string | null,"id"?: string,"internal_name"?: string | null,"last_ip"?: string | null,"last_seen_at"?: string | null,"license_expires_at"?: string | null,"listed"?: boolean,"mm_enabled"?: boolean,"mode"?: string | null,"name"?: string,"official_enabled"?: boolean,"panel_server_id"?: string | null,"panel_url"?: string | null,"pcw_enabled"?: boolean,"plugin_version"?: string | null,"region"?: string | null,"token_hash"?: string,"tv_port"?: number | null
                  }
                  Relationships: [
                    
                  ]
                },"hud_relays": {
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
                },"hud_sessions": {
                  Row: {
                    "seen_at": string,"server_id": string,"user_id": string
                  }
                  Insert: {
                    "seen_at"?: string,"server_id": string,"user_id": string
                  }
                  Update: {
                    "seen_at"?: string,"server_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hud_sessions_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_sessions_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_sessions_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_sessions_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"hud_streamers": {
                  Row: {
                    "granted_at": string,"granted_by": string | null,"revoked_at": string | null,"revoked_by": string | null,"token_created_at": string | null,"token_hash": string | null,"user_id": string
                  }
                  Insert: {
                    "granted_at"?: string,"granted_by"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"token_created_at"?: string | null,"token_hash"?: string | null,"user_id": string
                  }
                  Update: {
                    "granted_at"?: string,"granted_by"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"token_created_at"?: string | null,"token_hash"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "hud_streamers_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
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
                },"live_matches": {
                  Row: {
                    "map": string | null,"max_rounds": number | null,"payload": NonNullable<Json>,"score_a": number,"score_b": number,"seq": number,"server_id": string,"server_name": string | null,"started_at": string | null,"uid": string,"updated_at": string
                  }
                  Insert: {
                    "map"?: string | null,"max_rounds"?: number | null,"payload": NonNullable<Json>,"score_a": number,"score_b": number,"seq": number,"server_id": string,"server_name"?: string | null,"started_at"?: string | null,"uid": string,"updated_at"?: string
                  }
                  Update: {
                    "map"?: string | null,"max_rounds"?: number | null,"payload"?: NonNullable<Json>,"score_a"?: number,"score_b"?: number,"seq"?: number,"server_id"?: string,"server_name"?: string | null,"started_at"?: string | null,"uid"?: string,"updated_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"map_pool": {
                  Row: {
                    "active": boolean,"image_url": string | null,"mixes": boolean,"name": string,"position": number,"versions": (string)[],"veto_default": boolean
                  }
                  Insert: {
                    "active"?: boolean,"image_url"?: string | null,"mixes"?: boolean,"name": string,"position"?: number,"versions": (string)[],"veto_default"?: boolean
                  }
                  Update: {
                    "active"?: boolean,"image_url"?: string | null,"mixes"?: boolean,"name"?: string,"position"?: number,"versions"?: (string)[],"veto_default"?: boolean
                  }
                  Relationships: [
                    
                  ]
                },"match_bookings": {
                  Row: {
                    "abandoned_side": number | null,"assigned_at": string | null,"auto_start": boolean,"between_since": string | null,"created_at": string,"created_by": string | null,"end_reason": string | null,"ended_at": string | null,"id": string,"kind": string,"lost_at": string | null,"lost_from": string | null,"map_no": number,"match_id": string,"min_roster1": number | null,"min_roster2": number | null,"password": string | null,"queued_at": string | null,"ready1_at": string | null,"ready1_by": string | null,"ready2_at": string | null,"ready2_by": string | null,"server_id": string | null,"short1_since": string | null,"short2_since": string | null,"side_n1": number | null,"side_n2": number | null,"side_ok1": boolean | null,"side_ok2": boolean | null,"state_at": string | null,"status": string,"taken_at": string | null,"veto_deadline": string | null,"wait_deadline": string | null,"wait_expired_at": string | null,"wait_minutes": number,"wait_started_at": string | null,"warned_at": string | null
                  }
                  Insert: {
                    "abandoned_side"?: number | null,"assigned_at"?: string | null,"auto_start"?: boolean,"between_since"?: string | null,"created_at"?: string,"created_by"?: string | null,"end_reason"?: string | null,"ended_at"?: string | null,"id"?: string,"kind": string,"lost_at"?: string | null,"lost_from"?: string | null,"map_no"?: number,"match_id": string,"min_roster1"?: number | null,"min_roster2"?: number | null,"password"?: string | null,"queued_at"?: string | null,"ready1_at"?: string | null,"ready1_by"?: string | null,"ready2_at"?: string | null,"ready2_by"?: string | null,"server_id"?: string | null,"short1_since"?: string | null,"short2_since"?: string | null,"side_n1"?: number | null,"side_n2"?: number | null,"side_ok1"?: boolean | null,"side_ok2"?: boolean | null,"state_at"?: string | null,"status": string,"taken_at"?: string | null,"veto_deadline"?: string | null,"wait_deadline"?: string | null,"wait_expired_at"?: string | null,"wait_minutes": number,"wait_started_at"?: string | null,"warned_at"?: string | null
                  }
                  Update: {
                    "abandoned_side"?: number | null,"assigned_at"?: string | null,"auto_start"?: boolean,"between_since"?: string | null,"created_at"?: string,"created_by"?: string | null,"end_reason"?: string | null,"ended_at"?: string | null,"id"?: string,"kind"?: string,"lost_at"?: string | null,"lost_from"?: string | null,"map_no"?: number,"match_id"?: string,"min_roster1"?: number | null,"min_roster2"?: number | null,"password"?: string | null,"queued_at"?: string | null,"ready1_at"?: string | null,"ready1_by"?: string | null,"ready2_at"?: string | null,"ready2_by"?: string | null,"server_id"?: string | null,"short1_since"?: string | null,"short2_since"?: string | null,"side_n1"?: number | null,"side_n2"?: number | null,"side_ok1"?: boolean | null,"side_ok2"?: boolean | null,"state_at"?: string | null,"status"?: string,"taken_at"?: string | null,"veto_deadline"?: string | null,"wait_deadline"?: string | null,"wait_expired_at"?: string | null,"wait_minutes"?: number,"wait_started_at"?: string | null,"warned_at"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_bookings_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_bookings_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_bookings_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_bookings_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_bookings_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_bookings_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_bookings_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_bookings_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_bookings_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_bookings_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"match_chat": {
                  Row: {
                    "created_at": string,"id": number,"match_id": string | null,"message": string,"side": number | null,"tag": string | null,"user_email": string | null,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: number,"match_id"?: string | null,"message": string,"side"?: number | null,"tag"?: string | null,"user_email"?: string | null,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: number,"match_id"?: string | null,"message"?: string,"side"?: number | null,"tag"?: string | null,"user_email"?: string | null,"user_id"?: string | null
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_clips": {
                  Row: {
                    "clutch_start_tick": number | null,"clutch_vs": number | null,"created_at": string,"discord_message_id": string | null,"discord_posted_at": string | null,"end_tick": number | null,"id": string,"kill_ticks": (number)[],"match_id": string,"player_name": string,"player_steamid": string,"round": number,"round_seconds": number,"round_won": boolean,"video_attempts": number,"video_bytes": number | null,"video_claimed_at": string | null,"video_drive_id": string | null,"video_error": string | null,"video_forced": boolean,"video_forced_at": string | null,"video_forced_by": string | null,"video_key": string | null,"video_r2_deleted_at": string | null,"video_reject_reason": string | null,"video_rejected_at": string | null,"video_rejected_by": string | null,"video_rendered_at": string | null,"video_reprocess_count": number,"video_reprocessed_at": string | null,"video_review": string | null,"video_reviewed_at": string | null,"video_reviewed_by": string | null,"video_seconds": number | null,"video_status": string | null
                  }
                  Insert: {
                    "clutch_start_tick"?: number | null,"clutch_vs"?: number | null,"created_at"?: string,"discord_message_id"?: string | null,"discord_posted_at"?: string | null,"end_tick"?: number | null,"id"?: string,"kill_ticks"?: (number)[],"match_id": string,"player_name"?: string,"player_steamid": string,"round": number,"round_seconds"?: number,"round_won": boolean,"video_attempts"?: number,"video_bytes"?: number | null,"video_claimed_at"?: string | null,"video_drive_id"?: string | null,"video_error"?: string | null,"video_forced"?: boolean,"video_forced_at"?: string | null,"video_forced_by"?: string | null,"video_key"?: string | null,"video_r2_deleted_at"?: string | null,"video_reject_reason"?: string | null,"video_rejected_at"?: string | null,"video_rejected_by"?: string | null,"video_rendered_at"?: string | null,"video_reprocess_count"?: number,"video_reprocessed_at"?: string | null,"video_review"?: string | null,"video_reviewed_at"?: string | null,"video_reviewed_by"?: string | null,"video_seconds"?: number | null,"video_status"?: string | null
                  }
                  Update: {
                    "clutch_start_tick"?: number | null,"clutch_vs"?: number | null,"created_at"?: string,"discord_message_id"?: string | null,"discord_posted_at"?: string | null,"end_tick"?: number | null,"id"?: string,"kill_ticks"?: (number)[],"match_id"?: string,"player_name"?: string,"player_steamid"?: string,"round"?: number,"round_seconds"?: number,"round_won"?: boolean,"video_attempts"?: number,"video_bytes"?: number | null,"video_claimed_at"?: string | null,"video_drive_id"?: string | null,"video_error"?: string | null,"video_forced"?: boolean,"video_forced_at"?: string | null,"video_forced_by"?: string | null,"video_key"?: string | null,"video_r2_deleted_at"?: string | null,"video_reject_reason"?: string | null,"video_rejected_at"?: string | null,"video_rejected_by"?: string | null,"video_rendered_at"?: string | null,"video_reprocess_count"?: number,"video_reprocessed_at"?: string | null,"video_review"?: string | null,"video_reviewed_at"?: string | null,"video_reviewed_by"?: string | null,"video_seconds"?: number | null,"video_status"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_kills": {
                  Row: {
                    "headshot": boolean,"id": number,"killer_steam": string | null,"kx": number | null,"ky": number | null,"match_id": string,"round": number,"victim_steam": string,"vx": number,"vy": number,"weapon": string
                  }
                  Insert: {
                    "headshot"?: boolean,"id"?: never,"killer_steam"?: string | null,"kx"?: number | null,"ky"?: number | null,"match_id": string,"round": number,"victim_steam": string,"vx": number,"vy": number,"weapon"?: string
                  }
                  Update: {
                    "headshot"?: boolean,"id"?: never,"killer_steam"?: string | null,"kx"?: number | null,"ky"?: number | null,"match_id"?: string,"round"?: number,"victim_steam"?: string,"vx"?: number,"vy"?: number,"weapon"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_kills_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_kills_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_kills_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_kills_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_kills_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_kills_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_kills_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_crashes": {
                  Row: {
                    "created_at": string,"decision": string | null,"link_code": string | null,"link_side_a": number | null,"match_id": string,"max_rounds": number,"reviewed_at": string | null,"reviewed_by": string | null,"source": string
                  }
                  Insert: {
                    "created_at"?: string,"decision"?: string | null,"link_code"?: string | null,"link_side_a"?: number | null,"match_id": string,"max_rounds": number,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source": string
                  }
                  Update: {
                    "created_at"?: string,"decision"?: string | null,"link_code"?: string | null,"link_side_a"?: number | null,"match_id"?: string,"max_rounds"?: number,"reviewed_at"?: string | null,"reviewed_by"?: string | null,"source"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_crashes_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_crashes_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_crashes_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_crashes_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_crashes_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_crashes_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_crashes_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_player_extra": {
                  Row: {
                    "bombs_exploded": number | null,"clutch_1v1": number | null,"clutch_1v2": number | null,"clutch_1v3": number | null,"clutch_1v4": number | null,"clutch_1v5": number | null,"clutch_tries": number | null,"eco_won": number | null,"match_id": string,"pistol_won": number | null,"rounds_survived": number | null,"rounds_won_ct": number | null,"rounds_won_t": number | null,"steam_id": string,"weapon_hs": Json | null,"weapon_kills": Json | null
                  }
                  Insert: {
                    "bombs_exploded"?: number | null,"clutch_1v1"?: number | null,"clutch_1v2"?: number | null,"clutch_1v3"?: number | null,"clutch_1v4"?: number | null,"clutch_1v5"?: number | null,"clutch_tries"?: number | null,"eco_won"?: number | null,"match_id": string,"pistol_won"?: number | null,"rounds_survived"?: number | null,"rounds_won_ct"?: number | null,"rounds_won_t"?: number | null,"steam_id": string,"weapon_hs"?: Json | null,"weapon_kills"?: Json | null
                  }
                  Update: {
                    "bombs_exploded"?: number | null,"clutch_1v1"?: number | null,"clutch_1v2"?: number | null,"clutch_1v3"?: number | null,"clutch_1v4"?: number | null,"clutch_1v5"?: number | null,"clutch_tries"?: number | null,"eco_won"?: number | null,"match_id"?: string,"pistol_won"?: number | null,"rounds_survived"?: number | null,"rounds_won_ct"?: number | null,"rounds_won_t"?: number | null,"steam_id"?: string,"weapon_hs"?: Json | null,"weapon_kills"?: Json | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_player_extra_match_id_steam_id_fkey"
      columns: ["match_id","steam_id"]
isOneToOne: true
      referencedRelation: "match_player_stats"
      referencedColumns: ["match_id","steam_id"]
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_player_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "match_player_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
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
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"match_round_log": {
                  Row: {
                    "created_at": string,"match_id": string,"rounds": NonNullable<Json>
                  }
                  Insert: {
                    "created_at"?: string,"match_id": string,"rounds": NonNullable<Json>
                  }
                  Update: {
                    "created_at"?: string,"match_id"?: string,"rounds"?: NonNullable<Json>
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_round_log_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_round_log_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_round_log_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_round_log_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_round_log_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_round_log_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_round_log_match_id_fkey"
      columns: ["match_id"]
isOneToOne: true
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_vetos": {
                  Row: {
                    "action": string,"by_user": string | null,"created_at": string,"id": string,"map": string,"match_id": string,"seq": number,"side": number | null,"team_id": string | null,"version": string | null
                  }
                  Insert: {
                    "action": string,"by_user"?: string | null,"created_at"?: string,"id"?: string,"map": string,"match_id": string,"seq": number,"side"?: number | null,"team_id"?: string | null,"version"?: string | null
                  }
                  Update: {
                    "action"?: string,"by_user"?: string | null,"created_at"?: string,"id"?: string,"map"?: string,"match_id"?: string,"seq"?: number,"side"?: number | null,"team_id"?: string | null,"version"?: string | null
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_vetos_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "match_vetos_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_vetos_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["id"]
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"matches": {
                  Row: {
                    "advantage_side": number | null,"best_of": number,"bye": boolean,"cancel_reason": string | null,"cancelled_by": string | null,"dead1": boolean,"dead2": boolean,"demo_attempts": number,"demo_fallback_reason": string | null,"demo_key": string | null,"demo_size": number | null,"demo_status": string,"demo_uploaded_at": string | null,"demo_via": string | null,"end_reason": string | null,"event_id": string | null,"external_id": string | null,"grp": number | null,"id": string,"kind": string,"lineup1": (string)[],"lineup2": (string)[],"link_code": string | null,"map": string | null,"maps": Json | null,"next_lose": string | null,"next_lose_slot": number | null,"next_win": string | null,"next_win_slot": number | null,"parent_approved": boolean | null,"parent_match_id": string | null,"parent_side1": number | null,"phase": number | null,"played_at": string | null,"pos": number | null,"round": number | null,"score1": number | null,"score2": number | null,"server_id": string | null,"server_ip": string | null,"side1_guests": (string)[],"side1_name": string | null,"side2_guests": (string)[],"side2_name": string | null,"stage": string | null,"starts_at": string | null,"status": string,"team1": string | null,"team2": string | null,"tickrate": number | null,"track_key": string | null,"winner": string | null,"winner_side": number | null
                  }
                  Insert: {
                    "advantage_side"?: number | null,"best_of"?: number,"bye"?: boolean,"cancel_reason"?: string | null,"cancelled_by"?: string | null,"dead1"?: boolean,"dead2"?: boolean,"demo_attempts"?: number,"demo_fallback_reason"?: string | null,"demo_key"?: string | null,"demo_size"?: number | null,"demo_status"?: string,"demo_uploaded_at"?: string | null,"demo_via"?: string | null,"end_reason"?: string | null,"event_id"?: string | null,"external_id"?: string | null,"grp"?: number | null,"id"?: string,"kind"?: string,"lineup1"?: (string)[],"lineup2"?: (string)[],"link_code"?: string | null,"map"?: string | null,"maps"?: Json | null,"next_lose"?: string | null,"next_lose_slot"?: number | null,"next_win"?: string | null,"next_win_slot"?: number | null,"parent_approved"?: boolean | null,"parent_match_id"?: string | null,"parent_side1"?: number | null,"phase"?: number | null,"played_at"?: string | null,"pos"?: number | null,"round"?: number | null,"score1"?: number | null,"score2"?: number | null,"server_id"?: string | null,"server_ip"?: string | null,"side1_guests"?: (string)[],"side1_name"?: string | null,"side2_guests"?: (string)[],"side2_name"?: string | null,"stage"?: string | null,"starts_at"?: string | null,"status"?: string,"team1"?: string | null,"team2"?: string | null,"tickrate"?: number | null,"track_key"?: string | null,"winner"?: string | null,"winner_side"?: number | null
                  }
                  Update: {
                    "advantage_side"?: number | null,"best_of"?: number,"bye"?: boolean,"cancel_reason"?: string | null,"cancelled_by"?: string | null,"dead1"?: boolean,"dead2"?: boolean,"demo_attempts"?: number,"demo_fallback_reason"?: string | null,"demo_key"?: string | null,"demo_size"?: number | null,"demo_status"?: string,"demo_uploaded_at"?: string | null,"demo_via"?: string | null,"end_reason"?: string | null,"event_id"?: string | null,"external_id"?: string | null,"grp"?: number | null,"id"?: string,"kind"?: string,"lineup1"?: (string)[],"lineup2"?: (string)[],"link_code"?: string | null,"map"?: string | null,"maps"?: Json | null,"next_lose"?: string | null,"next_lose_slot"?: number | null,"next_win"?: string | null,"next_win_slot"?: number | null,"parent_approved"?: boolean | null,"parent_match_id"?: string | null,"parent_side1"?: number | null,"phase"?: number | null,"played_at"?: string | null,"pos"?: number | null,"round"?: number | null,"score1"?: number | null,"score2"?: number | null,"server_id"?: string | null,"server_ip"?: string | null,"side1_guests"?: (string)[],"side1_name"?: string | null,"side2_guests"?: (string)[],"side2_name"?: string | null,"stage"?: string | null,"starts_at"?: string | null,"status"?: string,"team1"?: string | null,"team2"?: string | null,"tickrate"?: number | null,"track_key"?: string | null,"winner"?: string | null,"winner_side"?: number | null
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
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
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2"]
isOneToOne: false
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"medal_definitions": {
                  Row: {
                    "activated_at": string | null,"aggregation": string,"created_at": string,"created_by": string | null,"data_since": string | null,"description": string | null,"design": NonNullable<Json>,"filters": NonNullable<Json>,"id": string,"key": string,"metric": string,"retroactive": boolean,"scope": string,"series": string | null,"series_order": number | null,"status": string,"target": number,"template": string,"title": string,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "activated_at"?: string | null,"aggregation": string,"created_at"?: string,"created_by"?: string | null,"data_since"?: string | null,"description"?: string | null,"design"?: NonNullable<Json>,"filters"?: NonNullable<Json>,"id"?: string,"key": string,"metric": string,"retroactive"?: boolean,"scope"?: string,"series"?: string | null,"series_order"?: number | null,"status"?: string,"target": number,"template": string,"title": string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "activated_at"?: string | null,"aggregation"?: string,"created_at"?: string,"created_by"?: string | null,"data_since"?: string | null,"description"?: string | null,"design"?: NonNullable<Json>,"filters"?: NonNullable<Json>,"id"?: string,"key"?: string,"metric"?: string,"retroactive"?: boolean,"scope"?: string,"series"?: string | null,"series_order"?: number | null,"status"?: string,"target"?: number,"template"?: string,"title"?: string,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"medal_queue": {
                  Row: {
                    "player_id": string,"queued_at": string
                  }
                  Insert: {
                    "player_id": string,"queued_at"?: string
                  }
                  Update: {
                    "player_id"?: string,"queued_at"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "medal_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "medal_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "medal_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "medal_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "medal_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medal_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medal_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "medal_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "medal_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: true
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"mix_deletions": {
                  Row: {
                    "deleted_at": string,"deleted_by": string | null,"deltas": NonNullable<Json>,"elo_mode": string,"id": number,"map": string | null,"match_id": string,"played_at": string | null,"score1": number | null,"score2": number | null,"server_id": string | null
                  }
                  Insert: {
                    "deleted_at"?: string,"deleted_by"?: string | null,"deltas"?: NonNullable<Json>,"elo_mode": string,"id"?: never,"map"?: string | null,"match_id": string,"played_at"?: string | null,"score1"?: number | null,"score2"?: number | null,"server_id"?: string | null
                  }
                  Update: {
                    "deleted_at"?: string,"deleted_by"?: string | null,"deltas"?: NonNullable<Json>,"elo_mode"?: string,"id"?: never,"map"?: string | null,"match_id"?: string,"played_at"?: string | null,"score1"?: number | null,"score2"?: number | null,"server_id"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"mm_bans": {
                  Row: {
                    "created_at": string,"created_by": string | null,"id": string,"reason": string,"report_id": string | null,"until": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"reason": string,"report_id"?: string | null,"until": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"id"?: string,"reason"?: string,"report_id"?: string | null,"until"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_bans_report_id_fkey"
      columns: ["report_id"]
isOneToOne: false
      referencedRelation: "mm_reports"
      referencedColumns: ["id"]
    }
                  ]
                },"mm_blocks": {
                  Row: {
                    "created_at": string,"player_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"player_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"player_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_blocks_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "mm_blocks_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_blocks_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_blocks_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_blocks_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_blocks_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_blocks_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_blocks_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_blocks_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"mm_commends": {
                  Row: {
                    "created_at": string,"lobby_id": string,"player_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"lobby_id": string,"player_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"lobby_id"?: string,"player_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_commends_lobby_id_fkey"
      columns: ["lobby_id"]
isOneToOne: false
      referencedRelation: "mm_lobbies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_commends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "mm_commends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_commends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_commends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_commends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_commends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_commends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_commends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_commends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"mm_config": {
                  Row: {
                    "abandon_adjust_pct": number,"abandon_extra_elo": number,"abandon_gg_pct": number,"abandon_loss_max": number,"abandon_loss_min": number,"abandon_win_max": number,"abandon_win_min": number,"accept_seconds": number,"balance_rating": boolean,"balance_rating_cap": number,"balance_rating_days": number,"balance_rating_prior_maps": number,"balance_rating_weight": number,"blocks_vip_only": boolean,"connect_minutes": number,"elo_unlimited_after_s": number,"elo_window_every_s": number,"elo_window_max": number,"elo_window_start": number,"elo_window_step": number,"id": number,"max_blocks": number,"max_party_size": number,"min_account_days": number,"min_mixes": number,"mvp_image_url": string | null,"open": boolean,"party_max_elo_gap": number,"penalty_ladder": (number)[],"reconnect_minutes": number,"replace_enabled": boolean,"replace_link_minutes": number,"replace_min_rounds_left": number,"replace_vote_cooldown_s": number,"replace_vote_pct": number,"replace_vote_seconds": number,"require_anticheat": boolean,"season_queue_close_minutes": number,"server_wait_minutes": number,"veto_seconds": number
                  }
                  Insert: {
                    "abandon_adjust_pct"?: number,"abandon_extra_elo"?: number,"abandon_gg_pct"?: number,"abandon_loss_max"?: number,"abandon_loss_min"?: number,"abandon_win_max"?: number,"abandon_win_min"?: number,"accept_seconds"?: number,"balance_rating"?: boolean,"balance_rating_cap"?: number,"balance_rating_days"?: number,"balance_rating_prior_maps"?: number,"balance_rating_weight"?: number,"blocks_vip_only"?: boolean,"connect_minutes"?: number,"elo_unlimited_after_s"?: number,"elo_window_every_s"?: number,"elo_window_max"?: number,"elo_window_start"?: number,"elo_window_step"?: number,"id"?: number,"max_blocks"?: number,"max_party_size"?: number,"min_account_days"?: number,"min_mixes"?: number,"mvp_image_url"?: string | null,"open"?: boolean,"party_max_elo_gap"?: number,"penalty_ladder"?: (number)[],"reconnect_minutes"?: number,"replace_enabled"?: boolean,"replace_link_minutes"?: number,"replace_min_rounds_left"?: number,"replace_vote_cooldown_s"?: number,"replace_vote_pct"?: number,"replace_vote_seconds"?: number,"require_anticheat"?: boolean,"season_queue_close_minutes"?: number,"server_wait_minutes"?: number,"veto_seconds"?: number
                  }
                  Update: {
                    "abandon_adjust_pct"?: number,"abandon_extra_elo"?: number,"abandon_gg_pct"?: number,"abandon_loss_max"?: number,"abandon_loss_min"?: number,"abandon_win_max"?: number,"abandon_win_min"?: number,"accept_seconds"?: number,"balance_rating"?: boolean,"balance_rating_cap"?: number,"balance_rating_days"?: number,"balance_rating_prior_maps"?: number,"balance_rating_weight"?: number,"blocks_vip_only"?: boolean,"connect_minutes"?: number,"elo_unlimited_after_s"?: number,"elo_window_every_s"?: number,"elo_window_max"?: number,"elo_window_start"?: number,"elo_window_step"?: number,"id"?: number,"max_blocks"?: number,"max_party_size"?: number,"min_account_days"?: number,"min_mixes"?: number,"mvp_image_url"?: string | null,"open"?: boolean,"party_max_elo_gap"?: number,"penalty_ladder"?: (number)[],"reconnect_minutes"?: number,"replace_enabled"?: boolean,"replace_link_minutes"?: number,"replace_min_rounds_left"?: number,"replace_vote_cooldown_s"?: number,"replace_vote_pct"?: number,"replace_vote_seconds"?: number,"require_anticheat"?: boolean,"season_queue_close_minutes"?: number,"server_wait_minutes"?: number,"veto_seconds"?: number
                  }
                  Relationships: [
                    
                  ]
                },"mm_friends": {
                  Row: {
                    "created_at": string,"player_id": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"player_id": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"player_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_friends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "mm_friends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_friends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_friends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_friends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_friends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_friends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_friends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_friends_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"mm_lobbies": {
                  Row: {
                    "accept_deadline": string | null,"affects_elo": boolean,"assign_deadline": string | null,"connect_deadline": string | null,"created_at": string,"end_reason": string | null,"ended_at": string | null,"forfeit_team": number | null,"id": string,"map": string | null,"match_id": string | null,"mode": string,"password": string | null,"require_anticheat": boolean,"server_id": string | null,"server_wait_deadline": string | null,"status": string,"veto_deadline": string | null,"veto_turn": number | null,"winner_team": number | null
                  }
                  Insert: {
                    "accept_deadline"?: string | null,"affects_elo"?: boolean,"assign_deadline"?: string | null,"connect_deadline"?: string | null,"created_at"?: string,"end_reason"?: string | null,"ended_at"?: string | null,"forfeit_team"?: number | null,"id"?: string,"map"?: string | null,"match_id"?: string | null,"mode": string,"password"?: string | null,"require_anticheat"?: boolean,"server_id"?: string | null,"server_wait_deadline"?: string | null,"status"?: string,"veto_deadline"?: string | null,"veto_turn"?: number | null,"winner_team"?: number | null
                  }
                  Update: {
                    "accept_deadline"?: string | null,"affects_elo"?: boolean,"assign_deadline"?: string | null,"connect_deadline"?: string | null,"created_at"?: string,"end_reason"?: string | null,"ended_at"?: string | null,"forfeit_team"?: number | null,"id"?: string,"map"?: string | null,"match_id"?: string | null,"mode"?: string,"password"?: string | null,"require_anticheat"?: boolean,"server_id"?: string | null,"server_wait_deadline"?: string | null,"status"?: string,"veto_deadline"?: string | null,"veto_turn"?: number | null,"winner_team"?: number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_lobbies_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_lobbies_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "mm_lobbies_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "mm_lobbies_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_lobbies_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_lobbies_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "mm_lobbies_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "mm_lobbies_mode_fkey"
      columns: ["mode"]
isOneToOne: false
      referencedRelation: "game_modes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "mm_lobbies_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_lobbies_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_lobbies_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"mm_lobby_players": {
                  Row: {
                    "abandoned": boolean,"accepted_at": string | null,"balance_elo": number | null,"connected_at": string | null,"declined_at": string | null,"elo": number,"is_captain": boolean,"joined_at": string,"left_at": string | null,"lobby_id": string,"party_id": string | null,"player_id": string,"region": string | null,"replaced_by": string | null,"replaces_user_id": string | null,"team": number,"user_id": string
                  }
                  Insert: {
                    "abandoned"?: boolean,"accepted_at"?: string | null,"balance_elo"?: number | null,"connected_at"?: string | null,"declined_at"?: string | null,"elo": number,"is_captain"?: boolean,"joined_at": string,"left_at"?: string | null,"lobby_id": string,"party_id"?: string | null,"player_id": string,"region"?: string | null,"replaced_by"?: string | null,"replaces_user_id"?: string | null,"team": number,"user_id": string
                  }
                  Update: {
                    "abandoned"?: boolean,"accepted_at"?: string | null,"balance_elo"?: number | null,"connected_at"?: string | null,"declined_at"?: string | null,"elo"?: number,"is_captain"?: boolean,"joined_at"?: string,"left_at"?: string | null,"lobby_id"?: string,"party_id"?: string | null,"player_id"?: string,"region"?: string | null,"replaced_by"?: string | null,"replaces_user_id"?: string | null,"team"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_lobby_players_lobby_id_fkey"
      columns: ["lobby_id"]
isOneToOne: false
      referencedRelation: "mm_lobbies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_lobby_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "mm_lobby_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_lobby_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_lobby_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_lobby_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_lobby_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_lobby_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_lobby_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_lobby_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"mm_mode_maps": {
                  Row: {
                    "map": string,"mode": string,"position": number
                  }
                  Insert: {
                    "map": string,"mode": string,"position"?: number
                  }
                  Update: {
                    "map"?: string,"mode"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_mode_maps_map_fkey"
      columns: ["map"]
isOneToOne: false
      referencedRelation: "map_pool"
      referencedColumns: ["name"]
    },{
      foreignKeyName: "mm_mode_maps_mode_fkey"
      columns: ["mode"]
isOneToOne: false
      referencedRelation: "game_modes"
      referencedColumns: ["code"]
    }
                  ]
                },"mm_mode_settings": {
                  Row: {
                    "affects_elo": boolean,"enabled": boolean,"mode": string,"position": number
                  }
                  Insert: {
                    "affects_elo"?: boolean,"enabled"?: boolean,"mode": string,"position"?: number
                  }
                  Update: {
                    "affects_elo"?: boolean,"enabled"?: boolean,"mode"?: string,"position"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_mode_settings_mode_fkey"
      columns: ["mode"]
isOneToOne: true
      referencedRelation: "game_modes"
      referencedColumns: ["code"]
    }
                  ]
                },"mm_parties": {
                  Row: {
                    "created_at": string,"id": string,"leader_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"leader_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"leader_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mm_party_invites": {
                  Row: {
                    "created_at": string,"expires_at": string,"from_user": string,"id": string,"party_id": string,"status": string,"to_user": string
                  }
                  Insert: {
                    "created_at"?: string,"expires_at"?: string,"from_user": string,"id"?: string,"party_id": string,"status"?: string,"to_user": string
                  }
                  Update: {
                    "created_at"?: string,"expires_at"?: string,"from_user"?: string,"id"?: string,"party_id"?: string,"status"?: string,"to_user"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_party_invites_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "mm_parties"
      referencedColumns: ["id"]
    }
                  ]
                },"mm_party_members": {
                  Row: {
                    "joined_at": string,"party_id": string,"user_id": string
                  }
                  Insert: {
                    "joined_at"?: string,"party_id": string,"user_id": string
                  }
                  Update: {
                    "joined_at"?: string,"party_id"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_party_members_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "mm_parties"
      referencedColumns: ["id"]
    }
                  ]
                },"mm_penalties": {
                  Row: {
                    "last_offense_at": string | null,"level": number,"until": string | null,"user_id": string
                  }
                  Insert: {
                    "last_offense_at"?: string | null,"level"?: number,"until"?: string | null,"user_id": string
                  }
                  Update: {
                    "last_offense_at"?: string | null,"level"?: number,"until"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mm_penalty_log": {
                  Row: {
                    "created_at": string,"id": number,"lift_reason": string | null,"lifted_at": string | null,"lifted_by": string | null,"reason": string,"until": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"lift_reason"?: string | null,"lifted_at"?: string | null,"lifted_by"?: string | null,"reason": string,"until": string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"lift_reason"?: string | null,"lifted_at"?: string | null,"lifted_by"?: string | null,"reason"?: string,"until"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mm_queue": {
                  Row: {
                    "away_since": string | null,"elo": number,"joined_at": string,"mode": string,"party_id": string | null,"player_id": string,"ready_at": string | null,"region": string | null,"user_id": string
                  }
                  Insert: {
                    "away_since"?: string | null,"elo": number,"joined_at"?: string,"mode": string,"party_id"?: string | null,"player_id": string,"ready_at"?: string | null,"region"?: string | null,"user_id": string
                  }
                  Update: {
                    "away_since"?: string | null,"elo"?: number,"joined_at"?: string,"mode"?: string,"party_id"?: string | null,"player_id"?: string,"ready_at"?: string | null,"region"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_queue_mode_fkey"
      columns: ["mode"]
isOneToOne: false
      referencedRelation: "game_modes"
      referencedColumns: ["code"]
    },{
      foreignKeyName: "mm_queue_party_id_fkey"
      columns: ["party_id"]
isOneToOne: false
      referencedRelation: "mm_parties"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "mm_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "mm_queue_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"mm_queue_log": {
                  Row: {
                    "id": number,"joined_at": string,"left_at": string,"mode": string,"outcome": string,"user_id": string
                  }
                  Insert: {
                    "id"?: never,"joined_at": string,"left_at"?: string,"mode": string,"outcome": string,"user_id": string
                  }
                  Update: {
                    "id"?: never,"joined_at"?: string,"left_at"?: string,"mode"?: string,"outcome"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mm_queue_pings": {
                  Row: {
                    "by_staff": boolean,"created_at": string,"id": string,"mode": string | null,"user_id": string
                  }
                  Insert: {
                    "by_staff"?: boolean,"created_at"?: string,"id"?: string,"mode"?: string | null,"user_id": string
                  }
                  Update: {
                    "by_staff"?: boolean,"created_at"?: string,"id"?: string,"mode"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mm_replacements": {
                  Row: {
                    "connect_deadline": string | null,"connected_at": string | null,"created_at": string,"discord_message_id": string | null,"expires_at": string,"id": string,"joined_round": number | null,"left_round": number | null,"lobby_id": string,"post_attempts": number,"posted_status": string | null,"replaced_user_id": string,"source": string,"status": string,"taken_at": string | null,"taken_by": string | null,"team": number,"token": string | null,"token_hash": string
                  }
                  Insert: {
                    "connect_deadline"?: string | null,"connected_at"?: string | null,"created_at"?: string,"discord_message_id"?: string | null,"expires_at": string,"id"?: string,"joined_round"?: number | null,"left_round"?: number | null,"lobby_id": string,"post_attempts"?: number,"posted_status"?: string | null,"replaced_user_id": string,"source": string,"status"?: string,"taken_at"?: string | null,"taken_by"?: string | null,"team": number,"token"?: string | null,"token_hash": string
                  }
                  Update: {
                    "connect_deadline"?: string | null,"connected_at"?: string | null,"created_at"?: string,"discord_message_id"?: string | null,"expires_at"?: string,"id"?: string,"joined_round"?: number | null,"left_round"?: number | null,"lobby_id"?: string,"post_attempts"?: number,"posted_status"?: string | null,"replaced_user_id"?: string,"source"?: string,"status"?: string,"taken_at"?: string | null,"taken_by"?: string | null,"team"?: number,"token"?: string | null,"token_hash"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_replacements_lobby_id_fkey"
      columns: ["lobby_id"]
isOneToOne: false
      referencedRelation: "mm_lobbies"
      referencedColumns: ["id"]
    }
                  ]
                },"mm_reports": {
                  Row: {
                    "created_at": string,"id": string,"lobby_id": string,"note": string | null,"reason": string,"reported_id": string,"reporter_id": string,"resolved_at": string | null,"resolved_by": string | null,"status": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"lobby_id": string,"note"?: string | null,"reason": string,"reported_id": string,"reporter_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"lobby_id"?: string,"note"?: string | null,"reason"?: string,"reported_id"?: string,"reporter_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"status"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_reports_lobby_id_fkey"
      columns: ["lobby_id"]
isOneToOne: false
      referencedRelation: "mm_lobbies"
      referencedColumns: ["id"]
    }
                  ]
                },"mm_server_passwords": {
                  Row: {
                    "applied_at": string | null,"created_at": string,"id": string,"kind": string,"lobby_id": string | null,"password": string,"server_id": string,"set_by": string,"uid": string | null
                  }
                  Insert: {
                    "applied_at"?: string | null,"created_at"?: string,"id"?: string,"kind": string,"lobby_id"?: string | null,"password": string,"server_id": string,"set_by": string,"uid"?: string | null
                  }
                  Update: {
                    "applied_at"?: string | null,"created_at"?: string,"id"?: string,"kind"?: string,"lobby_id"?: string | null,"password"?: string,"server_id"?: string,"set_by"?: string,"uid"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_server_passwords_lobby_id_fkey"
      columns: ["lobby_id"]
isOneToOne: false
      referencedRelation: "mm_lobbies"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_server_passwords_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_server_passwords_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_server_passwords_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"mm_server_state": {
                  Row: {
                    "last_poll_at": string | null,"plugin_version": string | null,"server_id": string,"unavailable_until": string | null
                  }
                  Insert: {
                    "last_poll_at"?: string | null,"plugin_version"?: string | null,"server_id": string,"unavailable_until"?: string | null
                  }
                  Update: {
                    "last_poll_at"?: string | null,"plugin_version"?: string | null,"server_id"?: string,"unavailable_until"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_server_state_server_id_fkey"
      columns: ["server_id"]
isOneToOne: true
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_server_state_server_id_fkey"
      columns: ["server_id"]
isOneToOne: true
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "mm_server_state_server_id_fkey"
      columns: ["server_id"]
isOneToOne: true
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"mm_sound_choice": {
                  Row: {
                    "sound_id": string | null,"user_id": string
                  }
                  Insert: {
                    "sound_id"?: string | null,"user_id": string
                  }
                  Update: {
                    "sound_id"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "mm_sound_choice_sound_id_fkey"
      columns: ["sound_id"]
isOneToOne: false
      referencedRelation: "mm_sounds"
      referencedColumns: ["id"]
    }
                  ]
                },"mm_sounds": {
                  Row: {
                    "created_at": string,"id": string,"name": string,"owner_id": string | null,"url": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"name": string,"owner_id"?: string | null,"url": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"name"?: string,"owner_id"?: string | null,"url"?: string
                  }
                  Relationships: [
                    
                  ]
                },"mm_summary_last": {
                  Row: {
                    "id": number,"summary": NonNullable<Json>
                  }
                  Insert: {
                    "id"?: number,"summary"?: NonNullable<Json>
                  }
                  Update: {
                    "id"?: number,"summary"?: NonNullable<Json>
                  }
                  Relationships: [
                    
                  ]
                },"notification_sent": {
                  Row: {
                    "kind": string,"ref": string,"sent_at": string
                  }
                  Insert: {
                    "kind": string,"ref": string,"sent_at"?: string
                  }
                  Update: {
                    "kind"?: string,"ref"?: string,"sent_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"notifications": {
                  Row: {
                    "actionable": boolean,"actor_id": string | null,"category": string,"created_at": string,"data": NonNullable<Json>,"id": number,"read_at": string | null,"ref": string | null,"resolution": string | null,"type": string,"user_id": string
                  }
                  Insert: {
                    "actionable"?: boolean,"actor_id"?: string | null,"category": string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"read_at"?: string | null,"ref"?: string | null,"resolution"?: string | null,"type": string,"user_id": string
                  }
                  Update: {
                    "actionable"?: boolean,"actor_id"?: string | null,"category"?: string,"created_at"?: string,"data"?: NonNullable<Json>,"id"?: never,"read_at"?: string | null,"ref"?: string | null,"resolution"?: string | null,"type"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"pcw_bans": {
                  Row: {
                    "created_at": string,"id": string,"lifted_at": string | null,"lifted_by": string | null,"match_id": string | null,"player_id": string | null,"reason": string,"team_id": string | null,"until": string
                  }
                  Insert: {
                    "created_at"?: string,"id"?: string,"lifted_at"?: string | null,"lifted_by"?: string | null,"match_id"?: string | null,"player_id"?: string | null,"reason": string,"team_id"?: string | null,"until": string
                  }
                  Update: {
                    "created_at"?: string,"id"?: string,"lifted_at"?: string | null,"lifted_by"?: string | null,"match_id"?: string | null,"player_id"?: string | null,"reason"?: string,"team_id"?: string | null,"until"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "pcw_bans_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_bans_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "pcw_bans_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "pcw_bans_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_bans_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_bans_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "pcw_bans_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "pcw_bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "pcw_bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "pcw_bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "pcw_bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "pcw_bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "pcw_bans_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "pcw_bans_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_bans_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "pcw_bans_team_id_fkey"
      columns: ["team_id"]
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
                    "best_of": number,"by_user": string,"created_at": string,"id": string,"map_pool": (string)[] | null,"maps": string | null,"match_id": string | null,"note": string | null,"starts_at": string | null,"status": string,"team_id": string
                  }
                  Insert: {
                    "best_of"?: number,"by_user": string,"created_at"?: string,"id"?: string,"map_pool"?: (string)[] | null,"maps"?: string | null,"match_id"?: string | null,"note"?: string | null,"starts_at"?: string | null,"status"?: string,"team_id": string
                  }
                  Update: {
                    "best_of"?: number,"by_user"?: string,"created_at"?: string,"id"?: string,"map_pool"?: (string)[] | null,"maps"?: string | null,"match_id"?: string | null,"note"?: string | null,"starts_at"?: string | null,"status"?: string,"team_id"?: string
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["id"]
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"player_clip_prefs": {
                  Row: {
                    "featured_mode": string,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "featured_mode"?: string,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "featured_mode"?: string,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"player_connections": {
                  Row: {
                    "at": string,"id": number,"ip": unknown,"nick": string | null,"server_id": string | null,"steam_id": string
                  }
                  Insert: {
                    "at"?: string,"id"?: never,"ip": unknown,"nick"?: string | null,"server_id"?: string | null,"steam_id": string
                  }
                  Update: {
                    "at"?: string,"id"?: never,"ip"?: unknown,"nick"?: string | null,"server_id"?: string | null,"steam_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_connections_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_connections_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_connections_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
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
                },"player_extra_steam_ids": {
                  Row: {
                    "added_at": string | null,"added_by": string | null,"player_id": string,"steam_id": string
                  }
                  Insert: {
                    "added_at"?: string | null,"added_by"?: string | null,"player_id": string,"steam_id": string
                  }
                  Update: {
                    "added_at"?: string | null,"added_by"?: string | null,"player_id"?: string,"steam_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_extra_steam_ids_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "player_extra_steam_ids_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_extra_steam_ids_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_extra_steam_ids_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_extra_steam_ids_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_extra_steam_ids_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_extra_steam_ids_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_extra_steam_ids_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_extra_steam_ids_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"player_featured_clips": {
                  Row: {
                    "clip_id": string,"created_at": string,"position": number,"user_id": string
                  }
                  Insert: {
                    "clip_id": string,"created_at"?: string,"position": number,"user_id": string
                  }
                  Update: {
                    "clip_id"?: string,"created_at"?: string,"position"?: number,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_featured_clips_clip_id_fkey"
      columns: ["clip_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_featured_clips_clip_id_fkey"
      columns: ["clip_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_featured_clips_clip_id_fkey"
      columns: ["clip_id"]
isOneToOne: false
      referencedRelation: "match_clips"
      referencedColumns: ["id"]
    }
                  ]
                },"player_ips": {
                  Row: {
                    "first_seen_at": string,"ip": unknown,"last_nick": string | null,"last_seen_at": string,"last_server_id": string | null,"steam_id": string,"times": number
                  }
                  Insert: {
                    "first_seen_at"?: string,"ip": unknown,"last_nick"?: string | null,"last_seen_at"?: string,"last_server_id"?: string | null,"steam_id": string,"times"?: number
                  }
                  Update: {
                    "first_seen_at"?: string,"ip"?: unknown,"last_nick"?: string | null,"last_seen_at"?: string,"last_server_id"?: string | null,"steam_id"?: string,"times"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_ips_last_server_id_fkey"
      columns: ["last_server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_ips_last_server_id_fkey"
      columns: ["last_server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_ips_last_server_id_fkey"
      columns: ["last_server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"player_medals": {
                  Row: {
                    "created_at": string,"definition_id": string | null,"icon": string | null,"id": string,"player_id": string | null,"rank": number | null,"season_id": string | null,"source": string,"tier": string | null,"title": string
                  }
                  Insert: {
                    "created_at"?: string,"definition_id"?: string | null,"icon"?: string | null,"id"?: string,"player_id"?: string | null,"rank"?: number | null,"season_id"?: string | null,"source"?: string,"tier"?: string | null,"title": string
                  }
                  Update: {
                    "created_at"?: string,"definition_id"?: string | null,"icon"?: string | null,"id"?: string,"player_id"?: string | null,"rank"?: number | null,"season_id"?: string | null,"source"?: string,"tier"?: string | null,"title"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_medals_definition_id_fkey"
      columns: ["definition_id"]
isOneToOne: false
      referencedRelation: "medal_definitions"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_medals_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "player_medals_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "player_season_list"
      referencedColumns: ["season_id"]
    },{
      foreignKeyName: "player_medals_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "season_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "player_medals_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "season_live_standings"
      referencedColumns: ["season_id"]
    },{
      foreignKeyName: "player_medals_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"players": {
                  Row: {
                    "achievements": string | null,"bio": string | null,"id": string,"nick": string,"photo_url": string | null,"primary_steam_changed_at": string | null,"privacy": string,"steam_added_at": string | null,"steam_id": string | null,"team_history": string | null,"user_id": string | null,"verified": string | null,"verified_at": string | null,"verified_by": string | null,"verified_note": string | null
                  }
                  Insert: {
                    "achievements"?: string | null,"bio"?: string | null,"id"?: string,"nick": string,"photo_url"?: string | null,"primary_steam_changed_at"?: string | null,"privacy"?: string,"steam_added_at"?: string | null,"steam_id"?: string | null,"team_history"?: string | null,"user_id"?: string | null,"verified"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null,"verified_note"?: string | null
                  }
                  Update: {
                    "achievements"?: string | null,"bio"?: string | null,"id"?: string,"nick"?: string,"photo_url"?: string | null,"primary_steam_changed_at"?: string | null,"privacy"?: string,"steam_added_at"?: string | null,"steam_id"?: string | null,"team_history"?: string | null,"user_id"?: string | null,"verified"?: string | null,"verified_at"?: string | null,"verified_by"?: string | null,"verified_note"?: string | null
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
                },"profiles": {
                  Row: {
                    "id": string,"password_changed_at": string | null,"role": string,"tag": string | null,"tag_changed_at": string | null,"updated_at": string | null
                  }
                  Insert: {
                    "id": string,"password_changed_at"?: string | null,"role"?: string,"tag"?: string | null,"tag_changed_at"?: string | null,"updated_at"?: string | null
                  }
                  Update: {
                    "id"?: string,"password_changed_at"?: string | null,"role"?: string,"tag"?: string | null,"tag_changed_at"?: string | null,"updated_at"?: string | null
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
                },"render_workers": {
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
                },"replanteo71_fotos_ficha": {
                  Row: {
                    "photo_url": string,"player_id": string,"saved_at": string
                  }
                  Insert: {
                    "photo_url": string,"player_id": string,"saved_at"?: string
                  }
                  Update: {
                    "photo_url"?: string,"player_id"?: string,"saved_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"season_config": {
                  Row: {
                    "duration_days": number,"id": number,"min_matches": number,"reset_all": boolean,"reset_floor": number,"reset_pct": number,"tiers": NonNullable<Json>,"top_n": number,"updated_at": string,"updated_by": string | null
                  }
                  Insert: {
                    "duration_days"?: number,"id"?: number,"min_matches"?: number,"reset_all"?: boolean,"reset_floor"?: number,"reset_pct"?: number,"tiers"?: NonNullable<Json>,"top_n"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Update: {
                    "duration_days"?: number,"id"?: number,"min_matches"?: number,"reset_all"?: boolean,"reset_floor"?: number,"reset_pct"?: number,"tiers"?: NonNullable<Json>,"top_n"?: number,"updated_at"?: string,"updated_by"?: string | null
                  }
                  Relationships: [
                    
                  ]
                },"season_standings": {
                  Row: {
                    "eligible": boolean,"elo": number,"elo_after": number,"icon": string | null,"kd": number | null,"losses": number,"matches": number,"peak_elo": number,"player_id": string,"rank": number | null,"rating": number | null,"season_id": string,"tier": string | null,"wins": number
                  }
                  Insert: {
                    "eligible": boolean,"elo": number,"elo_after": number,"icon"?: string | null,"kd"?: number | null,"losses": number,"matches": number,"peak_elo": number,"player_id": string,"rank"?: number | null,"rating"?: number | null,"season_id": string,"tier"?: string | null,"wins": number
                  }
                  Update: {
                    "eligible"?: boolean,"elo"?: number,"elo_after"?: number,"icon"?: string | null,"kd"?: number | null,"losses"?: number,"matches"?: number,"peak_elo"?: number,"player_id"?: string,"rank"?: number | null,"rating"?: number | null,"season_id"?: string,"tier"?: string | null,"wins"?: number
                  }
                  Relationships: [
                    {
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "player_season_list"
      referencedColumns: ["season_id"]
    },{
      foreignKeyName: "season_standings_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "season_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "season_live_standings"
      referencedColumns: ["season_id"]
    },{
      foreignKeyName: "season_standings_season_id_fkey"
      columns: ["season_id"]
isOneToOne: false
      referencedRelation: "seasons"
      referencedColumns: ["id"]
    }
                  ]
                },"seasons": {
                  Row: {
                    "closed_at": string | null,"closed_by": string | null,"created_at": string,"created_by": string | null,"ends_at": string,"id": string,"min_matches": number,"name": string,"number": number,"reset_all": boolean,"reset_floor": number,"reset_pct": number,"starts_at": string,"status": string,"tiers": NonNullable<Json>,"top_n": number
                  }
                  Insert: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at": string,"id"?: string,"min_matches": number,"name": string,"number": number,"reset_all"?: boolean,"reset_floor": number,"reset_pct": number,"starts_at"?: string,"status"?: string,"tiers": NonNullable<Json>,"top_n": number
                  }
                  Update: {
                    "closed_at"?: string | null,"closed_by"?: string | null,"created_at"?: string,"created_by"?: string | null,"ends_at"?: string,"id"?: string,"min_matches"?: number,"name"?: string,"number"?: number,"reset_all"?: boolean,"reset_floor"?: number,"reset_pct"?: number,"starts_at"?: string,"status"?: string,"tiers"?: NonNullable<Json>,"top_n"?: number
                  }
                  Relationships: [
                    
                  ]
                },"site_config": {
                  Row: {
                    "auth_image_url": string | null,"id": number
                  }
                  Insert: {
                    "auth_image_url"?: string | null,"id"?: number
                  }
                  Update: {
                    "auth_image_url"?: string | null,"id"?: number
                  }
                  Relationships: [
                    
                  ]
                },"steam_requests": {
                  Row: {
                    "created_at": string,"id": number,"kind": string,"nick": string | null,"note": string | null,"player_id": string,"reason": string | null,"resolved_at": string | null,"resolved_by": string | null,"server_id": string | null,"status": string,"steam_id": string,"user_id": string | null
                  }
                  Insert: {
                    "created_at"?: string,"id"?: never,"kind"?: string,"nick"?: string | null,"note"?: string | null,"player_id": string,"reason"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"server_id"?: string | null,"status"?: string,"steam_id": string,"user_id"?: string | null
                  }
                  Update: {
                    "created_at"?: string,"id"?: never,"kind"?: string,"nick"?: string | null,"note"?: string | null,"player_id"?: string,"reason"?: string | null,"resolved_at"?: string | null,"resolved_by"?: string | null,"server_id"?: string | null,"status"?: string,"steam_id"?: string,"user_id"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"team_audit": {
                  Row: {
                    "action": string,"actor_id": string | null,"actor_role": string,"at": string,"data": NonNullable<Json>,"id": number,"reason": string | null,"team_id": string
                  }
                  Insert: {
                    "action": string,"actor_id"?: string | null,"actor_role": string,"at"?: string,"data"?: NonNullable<Json>,"id"?: never,"reason"?: string | null,"team_id": string
                  }
                  Update: {
                    "action"?: string,"actor_id"?: string | null,"actor_role"?: string,"at"?: string,"data"?: NonNullable<Json>,"id"?: never,"reason"?: string | null,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_audit_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_audit_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_audit_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_config": {
                  Row: {
                    "id": number,"max_led": number,"max_members": number,"rename_days": number,"updated_at": string
                  }
                  Insert: {
                    "id"?: number,"max_led"?: number,"max_members"?: number,"rename_days"?: number,"updated_at"?: string
                  }
                  Update: {
                    "id"?: number,"max_led"?: number,"max_members"?: number,"rename_days"?: number,"updated_at"?: string
                  }
                  Relationships: [
                    
                  ]
                },"team_invites": {
                  Row: {
                    "created_at": string,"created_by": string | null,"expires_at": string,"id": string,"kind": string,"message": string | null,"player_id": string,"resolved_at": string | null,"resolved_by": string | null,"role": string,"status": string,"team_id": string
                  }
                  Insert: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"kind": string,"message"?: string | null,"player_id": string,"resolved_at"?: string | null,"resolved_by"?: string | null,"role"?: string,"status"?: string,"team_id": string
                  }
                  Update: {
                    "created_at"?: string,"created_by"?: string | null,"expires_at"?: string,"id"?: string,"kind"?: string,"message"?: string | null,"player_id"?: string,"resolved_at"?: string | null,"resolved_by"?: string | null,"role"?: string,"status"?: string,"team_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_invites_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_invites_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
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
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_requests": {
                  Row: {
                    "created_at": string | null,"logo_url": string | null,"name": string,"reject_reason": string | null,"status": string,"tag": string | null,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string | null,"logo_url"?: string | null,"name": string,"reject_reason"?: string | null,"status"?: string,"tag"?: string | null,"user_id": string
                  }
                  Update: {
                    "created_at"?: string | null,"logo_url"?: string | null,"name"?: string,"reject_reason"?: string | null,"status"?: string,"tag"?: string | null,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"teams": {
                  Row: {
                    "captain_id": string | null,"dissolved_at": string | null,"dissolved_by": string | null,"founded_at": string | null,"guests": (string)[],"id": string,"kind": string,"logo_url": string | null,"looking_for": (string)[],"name": string,"name_changed_at": string | null,"owner_id": string | null,"parent_team_id": string | null,"tag": string | null
                  }
                  Insert: {
                    "captain_id"?: string | null,"dissolved_at"?: string | null,"dissolved_by"?: string | null,"founded_at"?: string | null,"guests"?: (string)[],"id"?: string,"kind"?: string,"logo_url"?: string | null,"looking_for"?: (string)[],"name": string,"name_changed_at"?: string | null,"owner_id"?: string | null,"parent_team_id"?: string | null,"tag"?: string | null
                  }
                  Update: {
                    "captain_id"?: string | null,"dissolved_at"?: string | null,"dissolved_by"?: string | null,"founded_at"?: string | null,"guests"?: (string)[],"id"?: string,"kind"?: string,"logo_url"?: string | null,"looking_for"?: (string)[],"name"?: string,"name_changed_at"?: string | null,"owner_id"?: string | null,"parent_team_id"?: string | null,"tag"?: string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"tournament_registration_players": {
                  Row: {
                    "event_id": string,"player_id": string,"role": string,"team_id": string
                  }
                  Insert: {
                    "event_id": string,"player_id": string,"role"?: string,"team_id": string
                  }
                  Update: {
                    "event_id"?: string,"player_id"?: string,"role"?: string,"team_id"?: string
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
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
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
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "tournament_registration_players_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
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
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"user_preferences": {
                  Row: {
                    "preferences": NonNullable<Json>,"updated_at": string,"user_id": string
                  }
                  Insert: {
                    "preferences"?: NonNullable<Json>,"updated_at"?: string,"user_id": string
                  }
                  Update: {
                    "preferences"?: NonNullable<Json>,"updated_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    
                  ]
                },"vip_memberships": {
                  Row: {
                    "created_at": string,"ends_at": string | null,"granted_by": string | null,"id": string,"note": string | null,"revoke_reason": string | null,"revoked_at": string | null,"revoked_by": string | null,"source": string,"starts_at": string,"user_id": string
                  }
                  Insert: {
                    "created_at"?: string,"ends_at"?: string | null,"granted_by"?: string | null,"id"?: string,"note"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"source": string,"starts_at"?: string,"user_id": string
                  }
                  Update: {
                    "created_at"?: string,"ends_at"?: string | null,"granted_by"?: string | null,"id"?: string,"note"?: string | null,"revoke_reason"?: string | null,"revoked_at"?: string | null,"revoked_by"?: string | null,"source"?: string,"starts_at"?: string,"user_id"?: string
                  }
                  Relationships: [
                    {
      foreignKeyName: "vip_memberships_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_granted_by_fkey"
      columns: ["granted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_revoked_by_fkey"
      columns: ["revoked_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Views: {
            "admin_claim_log": {
                  Row: {
                    "alias": string | null,"code": string | null,"created_at": string | null,"id": number | null,"nick": string | null,"ok": boolean | null,"player_id": string | null,"player_nick": string | null,"result": string | null,"search": string | null,"server_id": string | null,"server_name": string | null,"steam_id": string | null,"user_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "claim_log_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "claim_log_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_demo_list": {
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
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
                },"admin_elo_adjustment_list": {
                  Row: {
                    "applied_at": string | null,"created_by": string | null,"created_by_alias": string | null,"delta": number | null,"id": number | null,"nick": string | null,"player_id": string | null,"reason": string | null,"search": string | null,"set_elo": number | null,"source": string | null,"steam_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"admin_server_list": {
                  Row: {
                    "active": boolean | null,"allowed_ip": string | null,"connect_address": string | null,"created_at": string | null,"has_panel": boolean | null,"hud_enabled": boolean | null,"hud_key": string | null,"hud_port": number | null,"hud_seen_at": string | null,"hud_streaming": Json | null,"id": string | null,"internal_name": string | null,"last_ip": string | null,"last_match_at": string | null,"last_seen_at": string | null,"license_expires_at": string | null,"license_state": string | null,"listed": boolean | null,"matches": number | null,"mode": string | null,"name": string | null,"online": boolean | null,"panel_server_id": string | null,"plugin_version": string | null,"region": string | null,"search": string | null,"tv_port": number | null
                  }
                  Insert: {
                           "active"?: boolean | null,"allowed_ip"?: string | null,"connect_address"?: string | null,"created_at"?: string | null,"has_panel"?: never,"hud_enabled"?: boolean | null,"hud_key"?: string | null,"hud_port"?: number | null,"hud_seen_at"?: string | null,"hud_streaming"?: never,"id"?: string | null,"internal_name"?: string | null,"last_ip"?: string | null,"last_match_at"?: never,"last_seen_at"?: string | null,"license_expires_at"?: string | null,"license_state"?: never,"listed"?: boolean | null,"matches"?: never,"mode"?: string | null,"name"?: string | null,"online"?: never,"panel_server_id"?: string | null,"plugin_version"?: string | null,"region"?: string | null,"search"?: never,"tv_port"?: number | null
                         }
                        Update: {
                           "active"?: boolean | null,"allowed_ip"?: string | null,"connect_address"?: string | null,"created_at"?: string | null,"has_panel"?: never,"hud_enabled"?: boolean | null,"hud_key"?: string | null,"hud_port"?: number | null,"hud_seen_at"?: string | null,"hud_streaming"?: never,"id"?: string | null,"internal_name"?: string | null,"last_ip"?: string | null,"last_match_at"?: never,"last_seen_at"?: string | null,"license_expires_at"?: string | null,"license_state"?: never,"listed"?: boolean | null,"matches"?: never,"mode"?: string | null,"name"?: string | null,"online"?: never,"panel_server_id"?: string | null,"plugin_version"?: string | null,"region"?: string | null,"search"?: never,"tv_port"?: number | null
                         }
                        Relationships: [
                    
                  ]
                },"admin_steam_requests": {
                  Row: {
                    "alias": string | null,"created_at": string | null,"id": number | null,"kind": string | null,"matches": number | null,"nick": string | null,"note": string | null,"player_id": string | null,"player_nick": string | null,"player_steam_count": number | null,"reason": string | null,"resolved_at": string | null,"search": string | null,"server_id": string | null,"server_name": string | null,"shares_match": boolean | null,"status": string | null,"status_order": number | null,"steam_id": string | null,"user_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "steam_requests_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "steam_requests_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"admin_team_list": {
                  Row: {
                    "blocked": boolean | null,"captain_alias": string | null,"captain_player_id": string | null,"events_active": number | null,"founded_at": string | null,"id": string | null,"last_change_at": string | null,"logo_url": string | null,"members": number | null,"name": string | null,"players": number | null,"search": string | null,"tag": string | null
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
                    "alias": string | null,"alias_changed_at": string | null,"has_player": boolean | null,"has_steam": boolean | null,"id": string | null,"is_streamer": boolean | null,"player_id": string | null,"role": string | null,"search": string | null,"steam_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"ban_list": {
                  Row: {
                    "created_at": string | null,"created_by": string | null,"created_by_alias": string | null,"created_by_name": string | null,"expires_at": string | null,"id": string | null,"lift_reason": string | null,"lifted_at": string | null,"lifted_by": string | null,"lifted_by_alias": string | null,"lifted_by_name": string | null,"nick": string | null,"permanent": boolean | null,"player_id": string | null,"reason": string | null,"replaced_by": string | null,"search": string | null,"search_all": string | null,"server_id": string | null,"server_name": string | null,"source": string | null,"status": string | null,"steam_id": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "bans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_created_by_fkey"
      columns: ["created_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_lifted_by_fkey"
      columns: ["lifted_by"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_replaced_by_fkey"
      columns: ["replaced_by"]
isOneToOne: false
      referencedRelation: "ban_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_replaced_by_fkey"
      columns: ["replaced_by"]
isOneToOne: false
      referencedRelation: "bans"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "bans_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"event_group_double_standings": {
                  Row: {
                    "event_id": string | null,"grp": number | null,"lost": number | null,"place": number | null,"rounds_against": number | null,"rounds_diff": number | null,"rounds_for": number | null,"seed": number | null,"state": string | null,"team_id": string | null,"won": number | null
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
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
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
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"event_list": {
                  Row: {
                    "admin_review": boolean | null,"approval": string | null,"approval_note": string | null,"banner_url": string | null,"bo": number | null,"bo_final": number | null,"champion_id": string | null,"champion_logo_url": string | null,"champion_name": string | null,"champion_tag": string | null,"current_match_id": string | null,"ends_on": string | null,"finished_at": string | null,"game_mode": string | null,"historic": boolean | null,"id": string | null,"max_teams": number | null,"name": string | null,"organizer_alias": string | null,"organizer_id": string | null,"pending_games": number | null,"players_per_team": number | null,"prize": string | null,"prize_amount": number | null,"prize_currency": string | null,"prize_currency_other": string | null,"progress_played": number | null,"progress_total": number | null,"registration_closes_at": string | null,"search": string | null,"starts_on": string | null,"status": string | null,"subs_max": number | null,"teams": number | null,"template": string | null,"testing": boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "events_champion_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_champion_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "team_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_champion_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "events_game_mode_fkey"
      columns: ["game_mode"]
isOneToOne: false
      referencedRelation: "game_modes"
      referencedColumns: ["code"]
    }
                  ]
                },"event_registrations_view": {
                  Row: {
                    "created_at": string | null,"event_id": string | null,"logo_url": string | null,"name": string | null,"players": number | null,"search": string | null,"seed": number | null,"start_stage": number | null,"tag": string | null,"team_id": string | null
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
      referencedRelation: "admin_team_list"
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
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"featured_clips_shown": {
                  Row: {
                    "clip_id": string | null,"player_id": string | null,"position": number | null
                  }
                  Relationships: [
                    
                  ]
                },"game_servers_public": {
                  Row: {
                    "connect_address": string | null,"id": string | null,"listed": boolean | null,"mode": string | null,"name": string | null,"region": string | null,"tv_port": number | null
                  }
                  Insert: {
                           "connect_address"?: string | null,"id"?: string | null,"listed"?: boolean | null,"mode"?: string | null,"name"?: string | null,"region"?: string | null,"tv_port"?: number | null
                         }
                        Update: {
                           "connect_address"?: string | null,"id"?: string | null,"listed"?: boolean | null,"mode"?: string | null,"name"?: string | null,"region"?: string | null,"tv_port"?: number | null
                         }
                        Relationships: [
                    
                  ]
                },"hud_streamer_list": {
                  Row: {
                    "active": boolean | null,"alias": string | null,"granted_at": string | null,"granted_by_alias": string | null,"has_link": boolean | null,"revoked_at": string | null,"token_created_at": string | null,"user_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "hud_streamers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "hud_streamers_user_id_fkey"
      columns: ["user_id"]
isOneToOne: true
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"live_match_list": {
                  Row: {
                    "map": string | null,"max_rounds": number | null,"parent_match_id": string | null,"parent_side1": number | null,"player_ids": (string)[] | null,"rounds_played": number | null,"score1": number | null,"score2": number | null,"search": string | null,"seq": number | null,"server_id": string | null,"server_name": string | null,"side1_name": string | null,"side2_name": string | null,"stale": boolean | null,"started_at": string | null,"uid": string | null,"updated_at": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "live_matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "admin_server_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "live_matches_server_id_fkey"
      columns: ["server_id"]
isOneToOne: false
      referencedRelation: "game_servers_public"
      referencedColumns: ["id"]
    }
                  ]
                },"live_match_players": {
                  Row: {
                    "assists": number | null,"damage": number | null,"deaths": number | null,"defuses": number | null,"first_deaths": number | null,"first_kills": number | null,"game_nick": string | null,"headshots": number | null,"k2": number | null,"k3": number | null,"k4": number | null,"k5": number | null,"kills": number | null,"plants": number | null,"player_id": string | null,"rating": number | null,"rounds": number | null,"side": number | null,"steam_id": string | null,"uid": string | null
                  }
                  Relationships: [
                    
                  ]
                },"match_chat_public": {
                  Row: {
                    "alias": string | null,"created_at": string | null,"id": number | null,"match_id": string | null,"message": string | null,"side": number | null,"user_id": string | null
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
    },{
      foreignKeyName: "match_chat_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_clip_list": {
                  Row: {
                    "clutch_start_tick": number | null,"clutch_vs": number | null,"created_at": string | null,"demo_status": string | null,"end_tick": number | null,"forced": boolean | null,"id": string | null,"kill_ticks": (number)[] | null,"kills": number | null,"match_id": string | null,"match_status": string | null,"player_id": string | null,"player_name": string | null,"player_steamid": string | null,"position": number | null,"priority": number | null,"review": string | null,"round": number | null,"round_seconds": number | null,"round_won": boolean | null,"tickrate": number | null,"type": string | null,"video_drive_id": string | null,"video_in_r2": boolean | null,"video_key": string | null,"video_seconds": number | null,"video_status": string | null,"vip": boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_clip_ranked": {
                  Row: {
                    "clutch_start_tick": number | null,"clutch_vs": number | null,"created_at": string | null,"demo_status": string | null,"end_tick": number | null,"forced": boolean | null,"id": string | null,"kill_ticks": (number)[] | null,"kills": number | null,"match_id": string | null,"match_status": string | null,"player_id": string | null,"player_name": string | null,"player_steamid": string | null,"position": number | null,"priority": number | null,"review": string | null,"round": number | null,"round_seconds": number | null,"round_won": boolean | null,"tickrate": number | null,"type": string | null,"video_drive_id": string | null,"video_in_r2": boolean | null,"video_key": string | null,"video_seconds": number | null,"video_status": string | null,"vip": boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_clutch_data": {
                  Row: {
                    "clutch_data": boolean | null,"match_id": string | null
                  }
                  Insert: {
                           "clutch_data"?: never,"match_id"?: string | null
                         }
                        Update: {
                           "clutch_data"?: never,"match_id"?: string | null
                         }
                        Relationships: [
                    
                  ]
                },"match_clutches": {
                  Row: {
                    "match_id": string | null,"steam_id": string | null,"vs": number | null,"won": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "admin_demo_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "matches"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "player_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_clips_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"match_list": {
                  Row: {
                    "at": string | null,"best_of": number | null,"bye": boolean | null,"cancel_reason": string | null,"demo_status": string | null,"end_reason": string | null,"event_id": string | null,"event_name": string | null,"grp": number | null,"id": string | null,"kind": string | null,"last_round": number | null,"map": string | null,"parent_match_id": string | null,"phase": number | null,"played_at": string | null,"player_ids": (string)[] | null,"player_search": string | null,"pos": number | null,"review": string | null,"review_max_rounds": number | null,"round": number | null,"score1": number | null,"score2": number | null,"search": string | null,"server_id": string | null,"side1_name": string | null,"side2_name": string | null,"stage": string | null,"stage_order": number | null,"starts_at": string | null,"status": string | null,"team1_id": string | null,"team1_logo_url": string | null,"team1_name": string | null,"team1_tag": string | null,"team2_id": string | null,"team2_logo_url": string | null,"team2_name": string | null,"team2_tag": string | null,"winner_side": number | null
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
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
      columns: ["team1_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["id"]
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "matches_team2_fkey"
      columns: ["team2_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"medal_holders": {
                  Row: {
                    "definition_id": string | null,"holders": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "player_medals_definition_id_fkey"
      columns: ["definition_id"]
isOneToOne: false
      referencedRelation: "medal_definitions"
      referencedColumns: ["id"]
    }
                  ]
                },"mix_list": {
                  Row: {
                    "at": string | null,"cancel_reason": string | null,"current_round": number | null,"demo_status": string | null,"ended_at": string | null,"live_rank": number | null,"live_uid": string | null,"map": string | null,"match_id": string | null,"max_rounds": number | null,"mvp_alias": string | null,"mvp_elo": number | null,"mvp_game_nick": string | null,"mvp_player_id": string | null,"mvp_rating": number | null,"player_ids": (string)[] | null,"rounds_played": number | null,"score1": number | null,"score2": number | null,"search": string | null,"server_id": string | null,"server_name": string | null,"side1_name": string | null,"side2_name": string | null,"stale": boolean | null,"started_at": string | null,"status": string | null,"tv_host": string | null,"tv_port": number | null,"winner_side": number | null
                  }
                  Relationships: [
                    
                  ]
                },"mix_stats": {
                  Row: {
                    "avg_rounds": number | null,"live_now": number | null,"players_recent": number | null,"top_map": string | null,"window_days": number | null
                  }
                  Relationships: [
                    
                  ]
                },"notification_list": {
                  Row: {
                    "actionable": boolean | null,"actor_alias": string | null,"actor_id": string | null,"category": string | null,"created_at": string | null,"data": Json | null,"id": number | null,"read_at": string | null,"ref": string | null,"resolution": string | null,"type": string | null,"user_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"pcw_post_list": {
                  Row: {
                    "best_of": number | null,"by_alias": string | null,"by_user": string | null,"created_at": string | null,"id": string | null,"map_pool": (string)[] | null,"maps": string | null,"match_id": string | null,"note": string | null,"parent_name": string | null,"parent_tag": string | null,"parent_team_id": string | null,"search": string | null,"side_name": string | null,"starts_at": string | null,"status": string | null,"team_id": string | null
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "pcw_posts_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "pcw_posts_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["id"]
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"player_clutches": {
                  Row: {
                    "player_id": string | null,"vs": number | null,"won": number | null
                  }
                  Relationships: [
                    
                  ]
                },"player_elo_adjustment_list": {
                  Row: {
                    "applied_at": string | null,"delta": number | null,"id": number | null,"player_id": string | null,"reason": string | null,"set_elo": number | null
                  }
                  Relationships: [
                    
                  ]
                },"player_elo_history": {
                  Row: {
                    "at": string | null,"elo_after": number | null,"elo_before": number | null,"elo_delta": number | null,"map": string | null,"match_id": string | null,"n": number | null,"player_id": string | null
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "match_player_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "match_player_stats_match_id_fkey"
      columns: ["match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
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
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
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
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
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
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"player_matches": {
                  Row: {
                    "assists": number | null,"damage": number | null,"deaths": number | null,"demo_status": string | null,"elo_after": number | null,"elo_before": number | null,"elo_delta": number | null,"event_id": string | null,"event_name": string | null,"game_nick": string | null,"grp": number | null,"headshots": number | null,"kills": number | null,"kind": string | null,"last_round": number | null,"map": string | null,"match_id": string | null,"parent_match_id": string | null,"phase": number | null,"played_at": string | null,"player_id": string | null,"rating": number | null,"round": number | null,"rounds": number | null,"score1": number | null,"score2": number | null,"side": number | null,"side1_name": string | null,"side2_name": string | null,"stage": string | null,"status": string | null,"team1_name": string | null,"team2_name": string | null,"winner_side": number | null,"won": boolean | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
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
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"player_overview": {
                  Row: {
                    "elo": number | null,"elo_matches": number | null,"has_account": boolean | null,"has_steam": boolean | null,"id": string | null,"kd": number | null,"losses": number | null,"maps": number | null,"nick": string | null,"peak_elo": number | null,"photo_url": string | null,"privacy": string | null,"rating": number | null,"search": string | null,"teams": Json | null,"wins": number | null
                  }
                  Relationships: [
                    
                  ]
                },"player_ranking": {
                  Row: {
                    "country": string | null,"elo": number | null,"elo_matches": number | null,"game_role": string | null,"id": string | null,"kd": number | null,"losses": number | null,"maps": number | null,"nick": string | null,"peak_elo": number | null,"photo_url": string | null,"position": number | null,"rating": number | null,"search": string | null,"teams": Json | null,"wins": number | null
                  }
                  Relationships: [
                    
                  ]
                },"player_season_list": {
                  Row: {
                    "eligible": boolean | null,"elo": number | null,"elo_after": number | null,"ended_at": string | null,"icon": string | null,"losses": number | null,"matches": number | null,"name": string | null,"number": number | null,"peak_elo": number | null,"player_id": string | null,"players": number | null,"rank": number | null,"season_id": string | null,"tier": string | null,"wins": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"player_stats": {
                  Row: {
                    "adr": number | null,"assists": number | null,"damage": number | null,"deaths": number | null,"defuses": number | null,"first_deaths": number | null,"first_kills": number | null,"hs": number | null,"k2": number | null,"k3": number | null,"k4": number | null,"k5": number | null,"kd": number | null,"kills": number | null,"losses": number | null,"maps": number | null,"plants": number | null,"player_id": string | null,"rating": number | null,"rounds": number | null,"wins": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
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
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "match_player_stats_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"player_steam_all": {
                  Row: {
                    "added_at": string | null,"is_primary": boolean | null,"player_id": string | null,"steam_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"player_titles": {
                  Row: {
                    "at": string | null,"event_id": string | null,"event_name": string | null,"player_id": string | null,"result": string | null,"team_id": string | null,"team_name": string | null,"team_tag": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
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
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "tournament_registration_players_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
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
                },"season_list": {
                  Row: {
                    "champion_id": string | null,"champion_nick": string | null,"closed_at": string | null,"ends_at": string | null,"id": string | null,"medals": number | null,"min_matches": number | null,"name": string | null,"number": number | null,"reset_all": boolean | null,"reset_floor": number | null,"reset_pct": number | null,"starts_at": string | null,"status": string | null,"tiers": Json | null,"top_n": number | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "player_overview"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "season_standings_player_id_fkey"
      columns: ["champion_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    }
                  ]
                },"season_live_standings": {
                  Row: {
                    "eligible": boolean | null,"elo": number | null,"elo_after": number | null,"icon": string | null,"kd": number | null,"losses": number | null,"matches": number | null,"nick": string | null,"peak_elo": number | null,"photo_url": string | null,"player_id": string | null,"rank": number | null,"rating": number | null,"search": string | null,"season_id": string | null,"tier": string | null,"wins": number | null
                  }
                  Relationships: [
                    
                  ]
                },"season_standings_list": {
                  Row: {
                    "eligible": boolean | null,"elo": number | null,"elo_after": number | null,"icon": string | null,"kd": number | null,"losses": number | null,"matches": number | null,"nick": string | null,"peak_elo": number | null,"photo_url": string | null,"player_id": string | null,"rank": number | null,"rating": number | null,"search": string | null,"season_id": string | null,"teams": Json | null,"tier": string | null,"wins": number | null
                  }
                  Relationships: [
                    
                  ]
                },"steam_profile_list": {
                  Row: {
                    "elo": number | null,"elo_matches": number | null,"first_played": string | null,"last_nick": string | null,"last_played": string | null,"matches": number | null,"nicks": (string)[] | null,"peak_elo": number | null,"search": string | null,"steam_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"steam_profile_map_stats": {
                  Row: {
                    "adr": number | null,"kd": number | null,"losses": number | null,"map_name": string | null,"maps": number | null,"rating": number | null,"steam_id": string | null,"wins": number | null
                  }
                  Relationships: [
                    
                  ]
                },"steam_profile_matches": {
                  Row: {
                    "assists": number | null,"damage": number | null,"deaths": number | null,"demo_status": string | null,"elo_after": number | null,"elo_before": number | null,"elo_delta": number | null,"game_nick": string | null,"headshots": number | null,"kills": number | null,"kind": string | null,"map": string | null,"match_id": string | null,"parent_match_id": string | null,"played_at": string | null,"rating": number | null,"rounds": number | null,"score1": number | null,"score2": number | null,"side": number | null,"side1_name": string | null,"side2_name": string | null,"status": string | null,"steam_id": string | null,"team1_name": string | null,"team2_name": string | null,"winner_side": number | null,"won": boolean | null
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
      referencedRelation: "live_match_list"
      referencedColumns: ["parent_match_id"]
    },{
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "match_clutch_data"
      referencedColumns: ["match_id"]
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
      foreignKeyName: "matches_parent_match_id_fkey"
      columns: ["parent_match_id"]
isOneToOne: false
      referencedRelation: "steam_profile_matches"
      referencedColumns: ["match_id"]
    }
                  ]
                },"steam_profile_stats": {
                  Row: {
                    "adr": number | null,"assists": number | null,"damage": number | null,"deaths": number | null,"hs": number | null,"kd": number | null,"kills": number | null,"losses": number | null,"maps": number | null,"rating": number | null,"rounds": number | null,"steam_id": string | null,"wins": number | null
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
                    "active": boolean | null,"alias": string | null,"elo": number | null,"game_role": string | null,"has_steam": boolean | null,"is_captain": boolean | null,"joined_at": string | null,"left_at": string | null,"photo_url": string | null,"player_id": string | null,"role": string | null,"team_id": string | null,"team_kind": string | null,"team_logo_url": string | null,"team_name": string | null,"team_tag": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
      referencedColumns: ["captain_player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_list"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "match_clip_ranked"
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
      referencedRelation: "player_ranking"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "players"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_public"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_player_id_fkey"
      columns: ["player_id"]
isOneToOne: false
      referencedRelation: "vip_status"
      referencedColumns: ["player_id"]
    },{
      foreignKeyName: "team_members_team_id_fkey"
      columns: ["team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_overview": {
                  Row: {
                    "captain_id": string | null,"captain_nick": string | null,"captain_player_id": string | null,"dissolved_at": string | null,"events_played": number | null,"founded_at": string | null,"has_space": boolean | null,"id": string | null,"kind": string | null,"logo_url": string | null,"looking_for": (string)[] | null,"max_members": number | null,"members": number | null,"name": string | null,"name_changed_at": string | null,"owner_id": string | null,"parent_team_id": string | null,"search": string | null,"tag": string | null
                  }
                  Insert: {
                           "captain_id"?: string | null,"captain_nick"?: never,"captain_player_id"?: never,"dissolved_at"?: string | null,"events_played"?: never,"founded_at"?: string | null,"has_space"?: never,"id"?: string | null,"kind"?: string | null,"logo_url"?: string | null,"looking_for"?: never,"max_members"?: never,"members"?: never,"name"?: string | null,"name_changed_at"?: string | null,"owner_id"?: string | null,"parent_team_id"?: string | null,"search"?: never,"tag"?: string | null
                         }
                        Update: {
                           "captain_id"?: string | null,"captain_nick"?: never,"captain_player_id"?: never,"dissolved_at"?: string | null,"events_played"?: never,"founded_at"?: string | null,"has_space"?: never,"id"?: string | null,"kind"?: string | null,"logo_url"?: string | null,"looking_for"?: never,"max_members"?: never,"members"?: never,"name"?: string | null,"name_changed_at"?: string | null,"owner_id"?: string | null,"parent_team_id"?: string | null,"search"?: never,"tag"?: string | null
                         }
                        Relationships: [
                    {
      foreignKeyName: "teams_parent_team_id_fkey"
      columns: ["parent_team_id"]
isOneToOne: false
      referencedRelation: "admin_team_list"
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
      referencedRelation: "teams"
      referencedColumns: ["id"]
    }
                  ]
                },"team_ranking": {
                  Row: {
                    "form_official": (string)[] | null,"form_total": (string)[] | null,"logo_url": string | null,"name": string | null,"official_lost": number | null,"official_played": number | null,"official_points": number | null,"official_position": number | null,"official_position_prev": number | null,"official_won": number | null,"search": string | null,"tag": string | null,"team_id": string | null,"total_lost": number | null,"total_played": number | null,"total_points": number | null,"total_position": number | null,"total_position_prev": number | null,"total_won": number | null
                  }
                  Relationships: [
                    
                  ]
                },"team_results": {
                  Row: {
                    "at": string | null,"gano": boolean | null,"match_id": string | null,"team_id": string | null,"tipo": string | null
                  }
                  Relationships: [
                    
                  ]
                },"team_standings": {
                  Row: {
                    "name": string | null,"official_lost": number | null,"official_played": number | null,"official_points": number | null,"official_won": number | null,"pcw_lost": number | null,"pcw_played": number | null,"pcw_points": number | null,"pcw_won": number | null,"tag": string | null,"team_id": string | null
                  }
                  Relationships: [
                    
                  ]
                },"vip_public": {
                  Row: {
                    "player_id": string | null,"user_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vip_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                },"vip_status": {
                  Row: {
                    "active": boolean | null,"active_since": string | null,"alias": string | null,"days_active": number | null,"last_change": string | null,"lifetime": boolean | null,"photo_url": string | null,"player_id": string | null,"since": string | null,"status": string | null,"until": string | null,"user_id": string | null
                  }
                  Relationships: [
                    {
      foreignKeyName: "vip_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "admin_user_list"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "profiles"
      referencedColumns: ["id"]
    },{
      foreignKeyName: "vip_memberships_user_id_fkey"
      columns: ["user_id"]
isOneToOne: false
      referencedRelation: "public_profiles"
      referencedColumns: ["id"]
    }
                  ]
                }
          }
          Functions: {
            "ac_admin_chain":
{ Args: { "p_session": string }; Returns: Json
                           },
"ac_admin_hold":
{ Args: { "p_held": boolean,"p_session": string }; Returns: undefined
                           },
"ac_admin_record_integrity":
{ Args: { "p_detail": Json,"p_result": string,"p_session": string }; Returns: undefined
                           },
"ac_admin_request_capture":
{ Args: { "p_reason": string,"p_session": string }; Returns: string
                           },
"ac_admin_session_evidence":
{ Args: { "p_session": string }; Returns: Json
                           },
"ac_admin_sessions":
{ Args: { "p_limit"?: number,"p_offset"?: number,"p_status"?: string }; Returns: Json
                           },
"ac_agent_unlink":
{ Args: { "p_access": string,"p_secret": string }; Returns: boolean
                           },
"ac_bridge_end":
{ Args: { "p_reason"?: string,"p_steam": string,"p_token": string }; Returns: boolean
                           },
"ac_bridge_player":
{ Args: { "p_in_mix"?: boolean,"p_ip": string,"p_match_uid"?: string,"p_steam": string,"p_token": string }; Returns: Json
                           },
"ac_can_review":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"ac_capture_result":
{ Args: { "p_access": string,"p_request": string,"p_result": string,"p_secret": string }; Returns: boolean
                           },
"ac_device_key":
{ Args: { "p_access": string,"p_secret": string }; Returns: string
                           },
"ac_device_of":
{ Args: { "p_access": string,"p_secret": string }; Returns: string
                           },
"ac_device_revoke":
{ Args: { "p_device": string }; Returns: undefined
                           },
"ac_device_set_key":
{ Args: { "p_access": string,"p_key": string,"p_secret": string }; Returns: boolean
                           },
"ac_evidence_append":
{ Args: { "p_access": string,"p_entry": string,"p_entry_hash": string,"p_item_sha": string,"p_kind": string,"p_prev": string,"p_raw"?: string,"p_ref"?: string,"p_secret": string,"p_seq": number,"p_session": string,"p_signature": string }; Returns: boolean
                           },
"ac_hash":
{ Args: { "p": string }; Returns: string
                           },
"ac_heartbeat":
{ Args: { "p_access": string,"p_ip": string,"p_secret": string,"p_version": string }; Returns: Json
                           },
"ac_ingest_processes":
{ Args: { "p_access": string,"p_events": Json,"p_secret": string,"p_session": string }; Returns: Json
                           },
"ac_integrity_reject":
{ Args: { "p_access": string,"p_problem": string,"p_secret": string,"p_session": string }; Returns: undefined
                           },
"ac_link_approve":
{ Args: { "p_user_code": string }; Returns: Json
                           },
"ac_link_claim":
{ Args: { "p_device_code": string,"p_secret": string }; Returns: Json
                           },
"ac_link_start":
{ Args: { "p_device_name": string,"p_secret": string,"p_version": string }; Returns: Json
                           },
"ac_public_status":
{ Args: { "p_player": string }; Returns: Json
                           },
"ac_require_api":
{ Args: { "p_secret": string }; Returns: undefined
                           },
"ac_retention_delete":
{ Args: { "p_session": string }; Returns: boolean
                           },
"ac_retention_due":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"ac_retention_paths":
{ Args: { "p_session": string }; Returns: Json
                           },
"ac_screenshot_register":
{ Args: { "p_access": string,"p_client_id": string,"p_height": number,"p_kind": string,"p_method": string,"p_request"?: string,"p_secret": string,"p_session": string,"p_sha256": string,"p_size": number,"p_taken": string,"p_width": number }; Returns: Json
                           },
"ac_screenshot_stored":
{ Args: { "p_access": string,"p_id": string,"p_secret": string }; Returns: boolean
                           },
"ac_session_accepts":
{ Args: { "p_at": string,"p_device": string,"p_session": string }; Returns: boolean
                           },
"ac_set_open":
{ Args: { "p_minutes": number }; Returns: string
                           },
"ac_token":
{ Args: { "p_prefix": string }; Returns: string
                           },
"ac_token_refresh":
{ Args: { "p_refresh": string,"p_secret": string }; Returns: Json
                           },
"ac_user_code":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"accept_pcw":
{ Args: { "p_guests": (string)[],"p_name": string,"p_players": (string)[],"p_post": string,"p_team"?: string }; Returns: string
                           },
"admin_account_action":
{ Args: { "p_action": string,"p_user": string }; Returns: Json
                           },
"admin_account_close_sessions":
{ Args: { "p_user": string }; Returns: undefined
                           },
"admin_account_status":
{ Args: { "p_user": string }; Returns: Json
                           },
"admin_create_demo_worker":
{ Args: { "p_name": string }; Returns: {
              "id": string,"token": string
            }[]
                           },
"admin_create_server":
{ Args: { "p_allowed_ip"?: string,"p_connect_address"?: string,"p_license_expires_at"?: string,"p_mode"?: string,"p_name": string,"p_panel_server_id"?: string,"p_region"?: string,"p_tv_port"?: number }; Returns: {
              "id": string,"token": string
            }[]
                           },
"admin_delete_mix":
{ Args: { "p_elo": string,"p_match": string }; Returns: Json
                           },
"admin_demo_retry":
{ Args: { "p_match": string }; Returns: undefined
                           },
"admin_grant_streamer":
{ Args: { "p_user": string }; Returns: undefined
                           },
"admin_name_blocked":
{ Args: { "p": string }; Returns: string
                           },
"admin_pcw_bans":
{ Args: { "p_active"?: boolean,"p_order"?: string,"p_page"?: number,"p_per"?: number,"p_q"?: string,"p_sort"?: string }; Returns: Json
                           },
"admin_player_ips":
{ Args: { "p_player": string }; Returns: {
              "first_seen_at": string,"ip": string,"last_nick": string,"last_seen_at": string,"others": Json,"others_unlinked": number,"steam_id": string,"times": number
            }[]
                           },
"admin_regenerate_hud_key":
{ Args: { "p_server": string }; Returns: string
                           },
"admin_remove_steam":
{ Args: { "p_steam": string }; Returns: undefined
                           },
"admin_revoke_streamer":
{ Args: { "p_user": string }; Returns: undefined
                           },
"admin_set_primary_steam":
{ Args: { "p_steam": string }; Returns: undefined
                           },
"admin_set_server_hud":
{ Args: { "p_enabled": boolean,"p_port": number,"p_server": string }; Returns: undefined
                           },
"admin_users":
{ Args: { "p_q"?: string }; Returns: {
              "id": string,"player_id": string,"player_steam_id": string,"role": string,"tag": string,"tag_changed_at": string
            }[]
                           },
"admin_vip_grant":
{ Args: { "p_lifetime"?: boolean,"p_months"?: number,"p_note"?: string,"p_until"?: string,"p_user": string }; Returns: string
                           },
"admin_vip_revoke":
{ Args: { "p_reason": string,"p_user": string }; Returns: number
                           },
"alias_check":
{ Args: { "p_tag": string }; Returns: string
                           },
"approve_steam_request":
{ Args: { "p_id": number }; Returns: undefined
                           },
"ban_active_for":
{ Args: { "p_steam": string }; Returns: {
              "created_at": string,
"created_by": string | null,
"created_by_name": string | null,
"created_by_steam": string | null,
"expires_at": string | null,
"id": string,
"lift_reason": string | null,
"lifted_at": string | null,
"lifted_by": string | null,
"lifted_by_name": string | null,
"lifted_by_steam": string | null,
"nick": string | null,
"player_id": string | null,
"reason": string,
"replaced_by": string | null,
"server_id": string | null,
"source": string,
"steam_id": string,
"updated_at": string,
"updated_by": string | null
            }[]
                          SetofOptions: {
        from: "*"
        to: "bans"
        isOneToOne: false
        isSetofReturn: true
      } },
"ban_create":
{ Args: { "p_expires": string,"p_player": string,"p_reason": string,"p_steam": string }; Returns: string
                           },
"ban_insert":
{ Args: { "p_by": string,"p_by_name": string,"p_by_steam": string,"p_expires": string,"p_nick": string,"p_player": string,"p_reason": string,"p_server": string,"p_source": string,"p_steam": string }; Returns: string
                           },
"ban_lift":
{ Args: { "p_id": string,"p_reason": string }; Returns: undefined
                           },
"ban_owner":
{ Args: { "p_player": string,"p_steam": string }; Returns: string
                           },
"ban_steams":
{ Args: { "p_player": string,"p_steam": string }; Returns: (string)[]
                           },
"ban_unix":
{ Args: { "p_expires": string }; Returns: number
                           },
"ban_update":
{ Args: { "p_expires": string,"p_id": string,"p_permanent"?: boolean,"p_reason": string }; Returns: undefined
                           },
"blocked_names_hits":
{ Args: Record<PropertyKey, never>; Returns: {
              "id": string,"kind": string,"name": string,"word": string
            }[]
                           },
"booking_abandon":
{ Args: { "p_booking": string,"p_reason": string,"p_side": number }; Returns: undefined
                           },
"booking_after_veto":
{ Args: { "p_match": string }; Returns: undefined
                           },
"booking_assign":
{ Args: { "p_booking": string }; Returns: boolean
                           },
"booking_close":
{ Args: { "p_booking": string,"p_reason": string,"p_status": string }; Returns: undefined
                           },
"booking_emit":
{ Args: { "p_booking": string }; Returns: undefined
                           },
"booking_enqueue":
{ Args: { "p_booking": string,"p_first"?: boolean }; Returns: undefined
                           },
"booking_map":
{ Args: { "p_booking": string }; Returns: string
                           },
"booking_poll_text":
{ Args: { "p_booking": string }; Returns: string
                           },
"booking_report":
{ Args: { "p_booking": string,"p_data": string,"p_event": string,"p_server": string }; Returns: boolean
                           },
"booking_start_wait":
{ Args: { "p_booking": string,"p_delay"?: string }; Returns: undefined
                           },
"booking_tick":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"booking_title":
{ Args: { "p_match": string }; Returns: string
                           },
"booking_users":
{ Args: { "p_booking": string }; Returns: (string)[]
                           },
"can_manage_event":
{ Args: { "p_event": string }; Returns: boolean
                           },
"can_own_event":
{ Args: { "p_event": string }; Returns: boolean
                           },
"cancel_pcw_match":
{ Args: { "p_match": string }; Returns: undefined
                           },
"cancel_pcw_post":
{ Args: { "p_post": string }; Returns: undefined
                           },
"cancel_steam_unlink":
{ Args: { "p_steam": string }; Returns: undefined
                           },
"claim_with_code":
{ Args: { "p_code": string,"p_nick"?: string,"p_steam": string,"p_token": string }; Returns: Json
                           },
"clip_archive_due":
{ Args: { "p_days"?: number,"p_limit"?: number,"p_token": string }; Returns: {
              "clip_id": string,"video_key": string
            }[]
                           },
"clip_archive_mark":
{ Args: { "p_clip": string,"p_token": string }; Returns: boolean
                           },
"clip_discord_mark":
{ Args: { "p_clip": string,"p_message_id": string,"p_token": string }; Returns: boolean
                           },
"clip_discord_pending":
{ Args: { "p_limit"?: number,"p_token": string,"p_top"?: number }; Returns: Json
                           },
"clip_featured_set":
{ Args: { "p_clips": (string)[],"p_mode": string }; Returns: Json
                           },
"clip_force":
{ Args: { "p_clip": string }; Returns: string
                           },
"clip_my_featured":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"clip_reject":
{ Args: { "p_clip": string,"p_reason"?: string }; Returns: string
                           },
"clip_render_claim":
{ Args: { "p_token": string }; Returns: Json
                           },
"clip_render_done":
{ Args: { "p_bytes": number,"p_clip": string,"p_drive_id"?: string,"p_key": string,"p_seconds": number,"p_token": string }; Returns: boolean
                           },
"clip_render_fail":
{ Args: { "p_clip": string,"p_error": string,"p_final"?: boolean,"p_token": string }; Returns: string
                           },
"clip_reprocess":
{ Args: { "p_clip": string }; Returns: string
                           },
"clip_review_ok":
{ Args: { "p_clip": string }; Returns: boolean
                           },
"clip_set_config":
{ Args: { "p_per_match": number,"p_per_player": number,"p_post_seconds": number,"p_pre_seconds": number,"p_priorities": Json,"p_split_gap_seconds": number,"p_vip_per_match"?: number }; Returns: undefined
                           },
"clip_set_featured":
{ Args: { "p_max": number,"p_max_vip": number }; Returns: undefined
                           },
"clip_trash_done":
{ Args: { "p_id": number,"p_token": string }; Returns: boolean
                           },
"clip_trash_list":
{ Args: { "p_limit"?: number,"p_token": string }; Returns: {
              "created_at": string,"id": number,"video_drive_id": string,"video_key": string
            }[]
                           },
"clip_type":
{ Args: { "p_clutch_vs": number,"p_kills": number,"p_priorities": Json,"p_won": boolean }; Returns: string
                           },
"clip_unforce":
{ Args: { "p_clip": string }; Returns: boolean
                           },
"clip_unreject":
{ Args: { "p_clip": string }; Returns: string
                           },
"clips_notify_detected":
{ Args: { "p_match": string }; Returns: undefined
                           },
"crash_min_rounds":
{ Args: { "p_max_rounds": number }; Returns: number
                           },
"create_claim_code":
{ Args: Record<PropertyKey, never>; Returns: {
              "code": string,"expires_at": string
            }[]
                           },
"create_demo_worker_token":
{ Args: { "p_name": string }; Returns: string
                           },
"create_pcw_post":
{ Args: { "p_best_of": number,"p_guests": (string)[],"p_map_pool"?: (string)[],"p_maps": string,"p_name": string,"p_note": string,"p_players": (string)[],"p_starts_at": string,"p_team"?: string }; Returns: string
                           },
"create_render_worker_token":
{ Args: { "p_name": string }; Returns: string
                           },
"create_server_token":
{ Args: { "p_name": string }; Returns: string
                           },
"csstv_after_ingest":
{ Args: { "p": Json,"p_match": string,"p_source": string }; Returns: undefined
                           },
"csstv_auth":
{ Args: { "p_token": string }; Returns: string
                           },
"csstv_ban_add":
{ Args: { "p_admin_name": string,"p_admin_steam": string,"p_minutes": number,"p_nick": string,"p_reason": string,"p_steam": string,"p_token": string }; Returns: Json
                           },
"csstv_ban_check":
{ Args: { "p_steam": string,"p_token": string }; Returns: Json
                           },
"csstv_ban_lift":
{ Args: { "p_admin_name": string,"p_admin_steam": string,"p_steam": string,"p_token": string }; Returns: Json
                           },
"csstv_bans_since":
{ Args: { "p_cursor"?: string,"p_token": string }; Returns: Json
                           },
"csstv_check_token":
{ Args: { "p_token": string }; Returns: Record<string, unknown>
                           },
"csstv_clips_save":
{ Args: { "p": Json,"p_match": string }; Returns: undefined
                           },
"csstv_connections":
{ Args: { "p_attempts"?: Json,"p_seen"?: Json,"p_token": string }; Returns: Json
                           },
"csstv_ingest":
{ Args: { "p": Json,"p_server": string }; Returns: string
                           },
"csstv_ip":
{ Args: { "p": string }; Returns: unknown
                           },
"csstv_jcounts":
{ Args: { "p": Json }; Returns: Json
                           },
"csstv_jint":
{ Args: { "j": Json,"k": string,"p_max"?: number }; Returns: number
                           },
"csstv_jint_null":
{ Args: { "k": string,"p": Json,"p_max": number }; Returns: number
                           },
"csstv_license":
{ Args: { "p_token": string,"p_version"?: string }; Returns: Json
                           },
"csstv_link_game":
{ Args: { "p_code": string,"p_game": string,"p_side_a": number }; Returns: boolean
                           },
"csstv_link_game_base":
{ Args: { "p_code": string,"p_game": string,"p_side_a": number }; Returns: boolean
                           },
"csstv_live_upsert":
{ Args: { "p": Json,"p_server": string,"p_uid": string }; Returns: undefined
                           },
"csstv_match_extra":
{ Args: { "p": Json,"p_match": string }; Returns: undefined
                           },
"csstv_match_lookup":
{ Args: { "p_code": string,"p_token": string }; Returns: string
                           },
"csstv_mm_password":
{ Args: { "p_kind": string,"p_lobby"?: string,"p_password": string,"p_token": string,"p_uid": string }; Returns: boolean
                           },
"csstv_mm_poll":
{ Args: { "p_state"?: string,"p_token": string,"p_version"?: string }; Returns: string
                           },
"csstv_mm_report":
{ Args: { "p_data"?: string,"p_event": string,"p_lobby": string,"p_token": string }; Returns: boolean
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
"csstv_steam0":
{ Args: { "p_s64": string }; Returns: string
                           },
"csstv_steam2":
{ Args: { "p": string }; Returns: string
                           },
"csstv_steam64":
{ Args: { "p": string }; Returns: string
                           },
"csstv_whois":
{ Args: { "p_online"?: string,"p_query"?: string,"p_steam"?: string,"p_token": string }; Returns: Json
                           },
"demo_auth":
{ Args: { "p_token": string }; Returns: string
                           },
"demo_expire":
{ Args: { "p_days"?: number,"p_token": string }; Returns: number
                           },
"demo_fallback":
{ Args: { "p_reason"?: string,"p_token": string,"p_uid": string }; Returns: string
                           },
"demo_mark":
{ Args: { "p_key"?: string,"p_result": string,"p_size"?: number,"p_token": string,"p_uid": string }; Returns: string
                           },
"demo_pending":
{ Args: { "p_limit"?: number,"p_token": string,"p_via"?: string }; Returns: {
              "attempts": number,"external_id": string,"map": string,"panel_server_id": string,"panel_url": string,"played_at": string,"score1": number,"score2": number,"server_name": string,"status": string
            }[]
                           },
"elo_add_adjustment":
{ Args: { "p_at"?: string,"p_delta": number,"p_reason": string,"p_steam_ids": (string)[] }; Returns: number
                           },
"elo_adjust_players":
{ Args: { "p_delta": number,"p_players": (string)[],"p_reason": string,"p_set_elo": number }; Returns: {
              "adjustment_id": number,"elo_after": number,"elo_before": number,"nick": string,"player_id": string
            }[]
                           },
"elo_after_attach":
{ Args: { "p_steam": string }; Returns: undefined
                           },
"elo_apply_adjustment":
{ Args: { "p_delta": number,"p_steam_id": string }; Returns: undefined
                           },
"elo_apply_adjustment_row":
{ Args: { "p_id": number }; Returns: undefined
                           },
"elo_apply_match":
{ Args: { "p_match": string }; Returns: undefined
                           },
"elo_apply_set":
{ Args: { "p_elo": number,"p_steam_id": string }; Returns: undefined
                           },
"elo_crash_apply":
{ Args: { "p_match": string }; Returns: undefined
                           },
"elo_crash_discard":
{ Args: { "p_match": string }; Returns: undefined
                           },
"elo_key":
{ Args: { "p_steam": string }; Returns: string
                           },
"elo_level":
{ Args: { "p_elo": number }; Returns: number
                           },
"elo_recompute_all":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"elo_recompute_player":
{ Args: { "p_from"?: (string)[],"p_key": string }; Returns: number
                           },
"elo_remove_adjustment":
{ Args: { "p_id": number }; Returns: undefined
                           },
"elo_season_event":
{ Args: { "p_close": boolean,"p_season": string }; Returns: undefined
                           },
"elo_season_event_key":
{ Args: { "p_close": boolean,"p_key": string,"p_season": string }; Returns: undefined
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
"event_build_group_double":
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
"event_create_historic_team":
{ Args: { "p_event": string,"p_name": string,"p_tag": string }; Returns: string
                           },
"event_draw":
{ Args: { "p_event": string }; Returns: (string)[]
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
"event_group_double_team":
{ Args: { "p_event": string,"p_grp": number,"p_place": number }; Returns: string
                           },
"event_group_order":
{ Args: { "p_event": string,"p_grp": number }; Returns: {
              "place": number,"team_id": string,"tied": boolean
            }[]
                           },
"event_group_qualifiers":
{ Args: { "p_event": string }; Returns: (string)[]
                           },
"event_max_bo":
{ Args: { "p_config": Json }; Returns: number
                           },
"event_progress":
{ Args: { "p_event": string }; Returns: undefined
                           },
"event_propagate_dead":
{ Args: { "p_event": string }; Returns: undefined
                           },
"event_quiet":
{ Args: { "p_event": string }; Returns: boolean
                           },
"event_ref":
{ Args: { "p_event": string }; Returns: Json
                           },
"event_register":
{ Args: { "p_active": (string)[],"p_event": string,"p_start_stage"?: number,"p_subs"?: (string)[],"p_team": string }; Returns: undefined
                           },
"event_reset":
{ Args: { "p_event": string }; Returns: undefined
                           },
"event_resolve_tie":
{ Args: { "p_event": string,"p_grp": number,"p_order": (string)[] }; Returns: undefined
                           },
"event_resubmit":
{ Args: { "p_event": string }; Returns: undefined
                           },
"event_review":
{ Args: { "p_approve": boolean,"p_event": string,"p_note"?: string }; Returns: undefined
                           },
"event_seed_order":
{ Args: { "s": number }; Returns: (number)[]
                           },
"event_seed_ranking":
{ Args: { "p_event": string }; Returns: (string)[]
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
"event_visible":
{ Args: { "p_event": string }; Returns: boolean
                           },
"historic_team_can_edit":
{ Args: { "p_team": string }; Returns: boolean
                           },
"historic_team_set_logo":
{ Args: { "p_team": string,"p_url": string }; Returns: undefined
                           },
"historic_team_similar":
{ Args: { "p_name": string }; Returns: {
              "kind": string,"logo_url": string,"name": string,"tag": string,"team_id": string
            }[]
                           },
"historic_team_update":
{ Args: { "p_name": string,"p_tag": string,"p_team": string }; Returns: undefined
                           },
"hud_new_key":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"hud_relay_config":
{ Args: { "p_seen"?: Json,"p_sessions"?: Json,"p_token": string }; Returns: Json
                           },
"hud_streamer_new_token":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"hud_streaming":
{ Args: { "p_server": string }; Returns: Json
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
"is_moderator":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_organizer":
{ Args: Record<PropertyKey, never>; Returns: boolean
                           },
"is_steam64":
{ Args: { "p": string }; Returns: boolean
                           },
"is_team_captain":
{ Args: { "p_team": string }; Returns: boolean
                           },
"is_vip":
{ Args: { "p_user"?: string }; Returns: boolean
                           },
"link_steam_id":
{ Args: { "p_player": string,"p_steam": string }; Returns: undefined
                           },
"live_match_close":
{ Args: { "p_uid": string }; Returns: string
                           },
"manual_valores":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"map_pool_check":
{ Args: { "p_min": number,"p_new": (string)[],"p_old": (string)[] }; Returns: undefined
                           },
"match_booking":
{ Args: { "p_match": string }; Returns: Json
                           },
"match_booking_action":
{ Args: { "p_action": string,"p_match": string,"p_minutes"?: number,"p_side"?: number }; Returns: undefined
                           },
"match_booking_release":
{ Args: { "p_match": string }; Returns: undefined
                           },
"match_can_connect":
{ Args: { "p_match": string }; Returns: boolean
                           },
"match_chat_can_write":
{ Args: { "p_match": string }; Returns: boolean
                           },
"match_game_candidates":
{ Args: { "p_from"?: string,"p_limit"?: number,"p_map"?: string,"p_match": string,"p_offset"?: number,"p_server"?: string,"p_to"?: string }; Returns: {
              "approved": boolean,"game_id": string,"linked": boolean,"map": string,"played_at": string,"players": number,"registered": number,"score1": number,"score2": number,"server_name": string,"side1": number,"total": number
            }[]
                           },
"match_game_side":
{ Args: { "p_game": string,"p_match": string }; Returns: number
                           },
"match_link_code":
{ Args: { "p_match": string }; Returns: string
                           },
"match_map_date":
{ Args: { "p": string }; Returns: string
                           },
"match_map_pool":
{ Args: { "p_match": string }; Returns: {
              "active": boolean,
"image_url": string | null,
"mixes": boolean,
"name": string,
"position": number,
"versions": (string)[],
"veto_default": boolean
            }[]
                          SetofOptions: {
        from: "*"
        to: "map_pool"
        isOneToOne: false
        isSetofReturn: true
      } },
"match_my_side":
{ Args: { "p_match": string }; Returns: number
                           },
"match_rankable":
{ Args: { "p_match": string }; Returns: boolean
                           },
"match_ref":
{ Args: { "p_match": string }; Returns: Json
                           },
"match_review_game":
{ Args: { "p_approve": boolean,"p_game": string }; Returns: undefined
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
"match_series_maps":
{ Args: { "p_match": string }; Returns: (string)[]
                           },
"match_set_maps":
{ Args: { "p_maps": Json,"p_match": string }; Returns: undefined
                           },
"match_set_played_at":
{ Args: { "p_at": string,"p_match": string }; Returns: undefined
                           },
"match_side_users":
{ Args: { "p_match": string,"p_side"?: number }; Returns: (string)[]
                           },
"match_start":
{ Args: { "p_match": string,"p_server": string,"p_wait"?: number }; Returns: string
                           },
"match_users":
{ Args: { "p_match": string }; Returns: (string)[]
                           },
"match_veto_done":
{ Args: { "p_match": string }; Returns: boolean
                           },
"medal_activate":
{ Args: { "p_id": string,"p_retro": boolean }; Returns: Json
                           },
"medal_archive":
{ Args: { "p_id": string }; Returns: undefined
                           },
"medal_design":
{ Args: { "d": Database["public"]['Tables']["medal_definitions"]['Row'],"p_rank"?: number,"p_season"?: number }; Returns: Json
                           },
"medal_enqueue":
{ Args: { "p_players": (string)[] }; Returns: undefined
                           },
"medal_evaluate_now":
{ Args: { "p_players": (string)[] }; Returns: undefined
                           },
"medal_metric_values":
{ Args: { "p_aggregation": string,"p_filters": Json,"p_metric": string,"p_players"?: (string)[] }; Returns: {
              "player_id": string,"value": number
            }[]
                           },
"medal_preview":
{ Args: { "p_aggregation": string,"p_filters": Json,"p_metric": string,"p_target": number }; Returns: number
                           },
"medal_progress":
{ Args: { "p_player": string }; Returns: {
              "definition_id": string,"value": number
            }[]
                           },
"medal_stats_since":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"medals_award":
{ Args: { "p_defs"?: (string)[],"p_players": (string)[] }; Returns: number
                           },
"medals_evaluate_all":
{ Args: { "p_def": string }; Returns: number
                           },
"medals_evaluate_pending":
{ Args: { "p_limit"?: number }; Returns: Json
                           },
"mix_users":
{ Args: { "p_match": string }; Returns: (string)[]
                           },
"mm_accept":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mm_active_lobby":
{ Args: { "p_user": string }; Returns: string
                           },
"mm_add_friend":
{ Args: { "p_player": string }; Returns: undefined
                           },
"mm_admin_cancel":
{ Args: { "p_lobby": string,"p_reason"?: string }; Returns: undefined
                           },
"mm_admin_config":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_admin_guard":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mm_admin_lift_penalty":
{ Args: { "p_reason": string,"p_user": string }; Returns: undefined
                           },
"mm_admin_lists":
{ Args: { "p_arg"?: string,"p_what": string }; Returns: Json
                           },
"mm_admin_resolve_report":
{ Args: { "p_action": string,"p_days"?: number,"p_report": string }; Returns: undefined
                           },
"mm_admin_rotate_password":
{ Args: { "p_server": string }; Returns: Json
                           },
"mm_admin_set_mvp_image":
{ Args: { "p_url": string }; Returns: string
                           },
"mm_admin_sound_add":
{ Args: { "p_name": string,"p_url": string }; Returns: Json
                           },
"mm_admin_sound_delete":
{ Args: { "p_id": string }; Returns: string
                           },
"mm_admin_sounds":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_admin_unban":
{ Args: { "p_user": string }; Returns: undefined
                           },
"mm_after_claim":
{ Args: { "p_user": string }; Returns: undefined
                           },
"mm_assign_server":
{ Args: { "p_lobby": string }; Returns: boolean
                           },
"mm_balance_elos":
{ Args: { "p_elos": (number)[],"p_players": (string)[] }; Returns: (number)[]
                           },
"mm_ban_map":
{ Args: { "p_by": string,"p_lobby": string,"p_map": string }; Returns: undefined
                           },
"mm_best_split":
{ Args: { "p_elos": (number)[],"p_parties": (string)[],"p_size": number,"p_users": (string)[] }; Returns: (number)[]
                           },
"mm_block":
{ Args: { "p_player": string }; Returns: undefined
                           },
"mm_block_reason":
{ Args: { "p_user": string }; Returns: string
                           },
"mm_cancel_lobby":
{ Args: { "p_lobby": string,"p_reason": string,"p_requeue"?: boolean }; Returns: undefined
                           },
"mm_chat_can_read":
{ Args: { "p_match": string,"p_side": number }; Returns: boolean
                           },
"mm_commend":
{ Args: { "p_lobby": string,"p_player": string }; Returns: undefined
                           },
"mm_decline":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mm_delete_my_sound":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"mm_elo_abandoned":
{ Args: { "p_game": string,"p_key": string }; Returns: boolean
                           },
"mm_elo_delta":
{ Args: { "p_delta": number,"p_game": string,"p_key": string,"p_prob": number,"p_res": number,"p_team": number }; Returns: number
                           },
"mm_elo_stake":
{ Args: { "p_lobby": string,"p_viewer": string }; Returns: Json
                           },
"mm_elo_window":
{ Args: { "p_wait_s": number }; Returns: number
                           },
"mm_emit":
{ Args: { "p_data"?: Json,"p_lobby": string,"p_type": string,"p_users": (string)[] }; Returns: undefined
                           },
"mm_ensure_player":
{ Args: { "p_user": string }; Returns: string
                           },
"mm_free_server":
{ Args: { "p_regions": (string)[] }; Returns: string
                           },
"mm_friend_users":
{ Args: { "p_player": string }; Returns: (string)[]
                           },
"mm_game_room":
{ Args: { "p_game": string }; Returns: Json
                           },
"mm_game_stats":
{ Args: { "p_game": string,"p_viewer": string }; Returns: Json
                           },
"mm_join":
{ Args: { "p_mode": string,"p_region"?: string }; Returns: undefined
                           },
"mm_leave":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mm_left_last_round":
{ Args: { "p_game": string,"p_player": string }; Returns: boolean
                           },
"mm_lobby_json":
{ Args: { "p_lobby": string,"p_viewer": string }; Returns: Json
                           },
"mm_lobby_match":
{ Args: { "p_lobby": string }; Returns: Json
                           },
"mm_lobby_replacements":
{ Args: { "p_lobby": string }; Returns: Json
                           },
"mm_lobby_users":
{ Args: { "p_lobby": string }; Returns: (string)[]
                           },
"mm_logout":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mm_meetings":
{ Args: { "p_player": string,"p_same": boolean,"p_viewer": string }; Returns: Json
                           },
"mm_mvp_image":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"mm_my_live":
{ Args: { "p_full"?: boolean }; Returns: Json
                           },
"mm_my_profile":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_my_state":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_my_team":
{ Args: { "p_match": string }; Returns: number
                           },
"mm_new_password":
{ Args: { "p_len"?: number }; Returns: string
                           },
"mm_party_clear_queue":
{ Args: { "p_party": string }; Returns: undefined
                           },
"mm_party_detach":
{ Args: { "p_user": string }; Returns: undefined
                           },
"mm_party_invite":
{ Args: { "p_player": string }; Returns: undefined
                           },
"mm_party_kick":
{ Args: { "p_player": string }; Returns: undefined
                           },
"mm_party_leave":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mm_party_promote":
{ Args: { "p_player": string }; Returns: undefined
                           },
"mm_party_respond":
{ Args: { "p_accept": boolean,"p_invite": string }; Returns: undefined
                           },
"mm_penalize":
{ Args: { "p_reason": string,"p_user": string }; Returns: undefined
                           },
"mm_player_card":
{ Args: { "p_lp"?: Database["public"]['Tables']["mm_lobby_players"]['Row'],"p_player": string,"p_viewer": string }; Returns: Json
                           },
"mm_player_elo":
{ Args: { "p_player": string }; Returns: number
                           },
"mm_player_photo":
{ Args: { "p_player": string }; Returns: string
                           },
"mm_public_counts":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_queue_away":
{ Args: { "p_user": string }; Returns: boolean
                           },
"mm_queue_back":
{ Args: { "p_user": string }; Returns: boolean
                           },
"mm_queue_drop_away":
{ Args: { "p_grace_s": number,"p_user": string }; Returns: number
                           },
"mm_queue_ping":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_queue_ping_cancel":
{ Args: { "p_id": string }; Returns: undefined
                           },
"mm_queue_ping_next":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"mm_queue_ping_status":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_queue_presence_sweep":
{ Args: { "p_grace_s": number,"p_online": (string)[] }; Returns: number
                           },
"mm_queue_remove":
{ Args: { "p_outcome": string,"p_user": string }; Returns: undefined
                           },
"mm_queue_sizes":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_remove_friend":
{ Args: { "p_player": string }; Returns: undefined
                           },
"mm_replace_arrived":
{ Args: { "p_lobby": string,"p_user": string }; Returns: undefined
                           },
"mm_replace_can_open":
{ Args: { "p_lobby": string,"p_team": number }; Returns: boolean
                           },
"mm_replace_close_finished":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"mm_replace_hash":
{ Args: { "p_token": string }; Returns: string
                           },
"mm_replace_info":
{ Args: { "p_token": string }; Returns: Json
                           },
"mm_replace_mark":
{ Args: { "p_id": string,"p_message_id": string,"p_ok": boolean,"p_shown": string }; Returns: undefined
                           },
"mm_replace_open":
{ Args: { "p_lobby": string,"p_source": string,"p_team": number,"p_user": string }; Returns: string
                           },
"mm_replace_out":
{ Args: { "p_lobby": string,"p_user": string }; Returns: boolean
                           },
"mm_replace_pending":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_replace_reason":
{ Args: { "p_lobby": string,"p_user": string }; Returns: string
                           },
"mm_replace_round":
{ Args: { "p_lobby": string }; Returns: number
                           },
"mm_replace_rounds_left":
{ Args: { "p_server": string }; Returns: number
                           },
"mm_replace_shown":
{ Args: { "p_status": string }; Returns: string
                           },
"mm_replace_sweep":
{ Args: { "p_lobby": string }; Returns: undefined
                           },
"mm_replace_take":
{ Args: { "p_token": string }; Returns: string
                           },
"mm_report":
{ Args: { "p_lobby": string,"p_note"?: string,"p_player": string,"p_reason": string }; Returns: undefined
                           },
"mm_set_config":
{ Args: { "p": Json }; Returns: Json
                           },
"mm_set_mode_maps":
{ Args: { "p_maps": (string)[],"p_mode": string }; Returns: undefined
                           },
"mm_set_my_sound":
{ Args: { "p_name": string,"p_url": string }; Returns: string
                           },
"mm_set_server_enabled":
{ Args: { "p_enabled": boolean,"p_server": string }; Returns: undefined
                           },
"mm_set_sound":
{ Args: { "p_sound": string }; Returns: undefined
                           },
"mm_start_veto":
{ Args: { "p_lobby": string }; Returns: undefined
                           },
"mm_summary":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_team_win_pct":
{ Args: { "p_lobby": string,"p_map": string,"p_team": number }; Returns: number
                           },
"mm_tick":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"mm_try_build":
{ Args: { "p_mode": string }; Returns: string
                           },
"mm_try_build_now":
{ Args: { "p_mode": string }; Returns: number
                           },
"mm_unblock":
{ Args: { "p_player": string }; Returns: undefined
                           },
"mm_unit_away":
{ Args: { "p_unit": string }; Returns: boolean
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
"notification_category":
{ Args: { "p_type": string }; Returns: string
                           },
"notification_required":
{ Args: { "p_type": string }; Returns: boolean
                           },
"notification_wants":
{ Args: { "p_type": string,"p_user": string }; Returns: boolean
                           },
"notifications_mark_read":
{ Args: { "p_all"?: boolean,"p_ids"?: (number)[] }; Returns: number
                           },
"notifications_resolve":
{ Args: { "p_ref": string,"p_resolution": string }; Returns: undefined
                           },
"notifications_unread":
{ Args: Record<PropertyKey, never>; Returns: {
              "actionable": number,"last_id": number,"unread": number
            }[]
                           },
"notify":
{ Args: { "p_data"?: Json,"p_keep_actor"?: boolean,"p_ref"?: string,"p_type": string,"p_users": (string)[] }; Returns: undefined
                           },
"notify_admin_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"notify_due":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"notify_season_delayed":
{ Args: { "p_season": string }; Returns: undefined
                           },
"notify_staff_ids":
{ Args: Record<PropertyKey, never>; Returns: (string)[]
                           },
"pcw_ban_check":
{ Args: { "p_side": string }; Returns: undefined
                           },
"pcw_ban_lift":
{ Args: { "p_ban": string }; Returns: undefined
                           },
"pcw_ban_side":
{ Args: { "p_match": string,"p_side": number }; Returns: string
                           },
"pcw_ban_until":
{ Args: { "p_side": string }; Returns: string
                           },
"pcw_cleanup":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"pcw_make_side":
{ Args: { "p_guests": (string)[],"p_name": string,"p_players": (string)[] }; Returns: string
                           },
"pcw_ready":
{ Args: { "p_match": string,"p_ready"?: boolean }; Returns: undefined
                           },
"pcw_set_result":
{ Args: { "p_maps": Json,"p_match": string }; Returns: undefined
                           },
"pcw_side_team":
{ Args: { "p_side": string,"p_team": string }; Returns: undefined
                           },
"player_featured_clips_list":
{ Args: { "p_player": string }; Returns: string[]
                           },
"player_is_empty":
{ Args: { "p_player": string }; Returns: boolean
                           },
"player_merge_empty":
{ Args: { "p_from": string,"p_to": string }; Returns: undefined
                           },
"player_heatmap":
{ Args: { "p_kind"?: string,"p_map": string,"p_matches"?: number,"p_player": string }; Returns: {
              "match_id": string,"x": number,"y": number
            }[]
                           },
"player_recent_rating":
{ Args: { "p_days"?: number,"p_players": (string)[] }; Returns: {
              "maps": number,"player_id": string,"rating": number
            }[]
                           },
"player_ref":
{ Args: { "p_player": string }; Returns: Json
                           },
"players_together":
{ Args: { "p_a": string,"p_b": string }; Returns: {
              "a_wins": number,"against_matches": number,"same_matches": number,"same_wins": number
            }[]
                           },
"reject_steam_request":
{ Args: { "p_id": number,"p_reason": string }; Returns: undefined
                           },
"render_auth":
{ Args: { "p_token": string }; Returns: string
                           },
"request_steam_unlink":
{ Args: { "p_note"?: string,"p_steam": string }; Returns: number
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
"season_check":
{ Args: { "p_min_matches": number,"p_reset_floor": number,"p_reset_pct": number,"p_tiers"?: Json,"p_top_n": number }; Returns: undefined
                           },
"season_close":
{ Args: { "p_confirm": string,"p_id": string }; Returns: Json
                           },
"season_close_due":
{ Args: Record<PropertyKey, never>; Returns: Json
                           },
"season_close_run":
{ Args: { "p_by": string,"p_season": string }; Returns: Json
                           },
"season_default_end":
{ Args: { "p_days": number,"p_from": string }; Returns: string
                           },
"season_player_stats":
{ Args: { "p_from": string,"p_until": string }; Returns: {
              "kd": number,"player_id": string,"rating": number
            }[]
                           },
"season_preview":
{ Args: { "p_min_matches": number,"p_reset_all"?: boolean,"p_reset_floor": number,"p_reset_pct": number,"p_top_n": number }; Returns: {
              "eligible": boolean,"elo": number,"elo_after": number,"icon": string,"matches": number,"nick": string,"player_id": string,"rank": number,"reset": boolean,"search": string,"tier": string
            }[]
                           },
"season_preview_summary":
{ Args: { "p_min_matches": number,"p_reset_all"?: boolean,"p_reset_floor": number,"p_reset_pct": number,"p_top_n": number }; Returns: Json
                           },
"season_rank":
{ Args: { "p_from": string,"p_min_matches": number,"p_until": string }; Returns: {
              "eligible": boolean,"elo": number,"last_at": string,"losses": number,"matches": number,"peak_elo": number,"player_id": string,"rank": number,"wins": number
            }[]
                           },
"season_reset_elo":
{ Args: { "p_elo": number,"p_floor": number,"p_pct": number }; Returns: number
                           } |
{ Args: { "p_all": boolean,"p_elo": number,"p_floor": number,"p_pct": number }; Returns: number
                           },
"season_start":
{ Args: { "p_ends_at"?: string,"p_name"?: string }; Returns: string
                           },
"season_tier":
{ Args: { "p_rank": number,"p_tiers": Json,"p_top_n": number }; Returns: {
              "icon": string,"name": string
            }[]
                           },
"season_tier_definition":
{ Args: { "p_rank": number,"p_tiers": Json,"p_top_n": number }; Returns: string
                           },
"season_tiers_ok":
{ Args: { "p": Json }; Returns: boolean
                           },
"season_update":
{ Args: { "p_ends_at"?: string,"p_id": string,"p_min_matches"?: number,"p_name"?: string,"p_reset_all"?: boolean,"p_reset_floor"?: number,"p_reset_pct"?: number,"p_tiers"?: Json,"p_top_n"?: number }; Returns: undefined
                           },
"server_alloc_lock":
{ Args: Record<PropertyKey, never>; Returns: undefined
                           },
"server_busy":
{ Args: { "p_server": string }; Returns: boolean
                           },
"server_free":
{ Args: { "p_kind": string,"p_regions"?: (string)[] }; Returns: string
                           },
"server_is_free":
{ Args: { "p_kind": string,"p_server": string }; Returns: boolean
                           },
"server_set_flags":
{ Args: { "p_mm"?: boolean,"p_official"?: boolean,"p_pcw"?: boolean,"p_server": string }; Returns: undefined
                           },
"servers_free":
{ Args: { "p_kind"?: string }; Returns: Json
                           },
"set_claim_config":
{ Args: { "p_max_steam_ids": number }; Returns: number
                           },
"set_game_mode_active":
{ Args: { "p_active": boolean,"p_code": string }; Returns: undefined
                           },
"set_my_bio":
{ Args: { "p_bio": string }; Returns: string
                           },
"set_my_preferences":
{ Args: { "p_changes": Json }; Returns: Json
                           },
"set_my_primary_steam":
{ Args: { "p_steam": string }; Returns: undefined
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
"set_season_config":
{ Args: { "p_duration_days": number,"p_min_matches": number,"p_reset_all"?: boolean,"p_reset_floor": number,"p_reset_pct": number,"p_tiers": Json,"p_top_n": number }; Returns: undefined
                           },
"set_team_captain":
{ Args: { "p_team": string,"p_user": string }; Returns: undefined
                           },
"set_team_config":
{ Args: { "p_max_led"?: number,"p_max_members": number,"p_rename_days"?: number }; Returns: undefined
                           },
"set_user_role":
{ Args: { "p_role": string,"p_user": string }; Returns: undefined
                           },
"set_user_tag":
{ Args: { "p_force"?: boolean,"p_tag": string,"p_user": string }; Returns: undefined
                           },
"side_users":
{ Args: { "p_event"?: string,"p_team": string }; Returns: (string)[]
                           },
"site_admin_set_auth_image":
{ Args: { "p_url": string }; Returns: string
                           },
"site_auth_image":
{ Args: Record<PropertyKey, never>; Returns: string
                           },
"steam_attach":
{ Args: { "p_by": string,"p_player": string,"p_steam": string }; Returns: boolean
                           },
"steam_detach":
{ Args: { "p_steam": string }; Returns: boolean
                           },
"steam_detach_elo":
{ Args: { "p_steam": string }; Returns: undefined
                           },
"steam_group":
{ Args: { "p_s64": string }; Returns: (string)[]
                           },
"steam_history_release":
{ Args: { "p_player": string,"p_steam": string }; Returns: undefined
                           },
"steam_history_to":
{ Args: { "p_player": string,"p_steam": string }; Returns: undefined
                           },
"steam_make_primary":
{ Args: { "p_by": string,"p_steam": string }; Returns: undefined
                           },
"steam_owner":
{ Args: { "p_steam": string }; Returns: string
                           },
"steam_requests_expire":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"team_actor_role":
{ Args: { "p_team": string }; Returns: string
                           },
"team_audit_add":
{ Args: { "p_action": string,"p_data": Json,"p_team": string }; Returns: undefined
                           },
"team_can_join":
{ Args: { "p_player": string,"p_team": string }; Returns: undefined
                           },
"team_create":
{ Args: { "p_name": string,"p_tag": string }; Returns: string
                           },
"team_dissolve":
{ Args: { "p_team": string }; Returns: undefined
                           },
"team_eligible_modes":
{ Args: { "p_team": string }; Returns: {
              "code": string,"missing": number,"name": string,"players_per_team": number
            }[]
                           },
"team_event_history":
{ Args: { "p_team": string }; Returns: {
              "ends_on": string,"event_id": string,"lost": number,"name": string,"place": number,"played": number,"result": string,"starts_on": string,"status": string,"template": string,"won": number
            }[]
                           },
"team_invite":
{ Args: { "p_alias"?: string,"p_message"?: string,"p_player"?: string,"p_role"?: string,"p_team": string }; Returns: string
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
"team_max_members":
{ Args: Record<PropertyKey, never>; Returns: number
                           },
"team_name_blocked":
{ Args: { "p_name": string,"p_tag": string }; Returns: boolean
                           },
"team_pcw_ban_until":
{ Args: { "p_team": string }; Returns: string
                           },
"team_players":
{ Args: { "p_team": string }; Returns: number
                           },
"team_rankable":
{ Args: { "p_team": string }; Returns: boolean
                           },
"team_ref":
{ Args: { "p_team": string }; Returns: Json
                           },
"team_rename":
{ Args: { "p_name": string,"p_tag": string,"p_team": string }; Returns: undefined
                           },
"team_request_join":
{ Args: { "p_message"?: string,"p_team": string }; Returns: string
                           },
"team_roster_users":
{ Args: { "p_team": string }; Returns: (string)[]
                           },
"team_set_logo":
{ Args: { "p_team": string,"p_url": string }; Returns: undefined
                           },
"team_set_member_role":
{ Args: { "p_player": string,"p_role": string,"p_team": string }; Returns: undefined
                           },
"team_staff_add_member":
{ Args: { "p_player": string,"p_reason"?: string,"p_role"?: string,"p_team": string }; Returns: undefined
                           },
"team_staff_begin":
{ Args: { "p_admin_only": boolean,"p_reason": string,"p_team": string }; Returns: {
              "captain_id": string | null,
"dissolved_at": string | null,
"dissolved_by": string | null,
"founded_at": string | null,
"guests": (string)[],
"id": string,
"kind": string,
"logo_url": string | null,
"looking_for": (string)[],
"name": string,
"name_changed_at": string | null,
"owner_id": string | null,
"parent_team_id": string | null,
"tag": string | null
            }
                          SetofOptions: {
        from: "*"
        to: "teams"
        isOneToOne: true
        isSetofReturn: false
      } },
"team_staff_dissolve":
{ Args: { "p_reason"?: string,"p_team": string }; Returns: undefined
                           },
"team_staff_end":
{ Args: { "p_action": string,"p_extra"?: Json,"p_team": Database["public"]['Tables']["teams"]['Row'] }; Returns: undefined
                           },
"team_staff_remove_logo":
{ Args: { "p_reason"?: string,"p_team": string }; Returns: string
                           },
"team_staff_remove_member":
{ Args: { "p_player": string,"p_reason"?: string,"p_team": string }; Returns: undefined
                           },
"team_staff_rename":
{ Args: { "p_name": string,"p_reason"?: string,"p_tag": string,"p_team": string }; Returns: undefined
                           },
"team_staff_set_captain":
{ Args: { "p_player": string,"p_reason"?: string,"p_team": string }; Returns: undefined
                           },
"team_staff_set_role":
{ Args: { "p_player": string,"p_reason"?: string,"p_role": string,"p_team": string }; Returns: undefined
                           },
"team_standings_at":
{ Args: { "p_at": string }; Returns: {
              "name": string,"official_lost": number,"official_played": number,"official_points": number,"official_won": number,"pcw_lost": number,"pcw_played": number,"pcw_points": number,"pcw_won": number,"tag": string,"team_id": string
            }[]
                           },
"team_update":
{ Args: { "p_looking_for": (string)[],"p_team": string }; Returns: undefined
                           },
"track_mark":
{ Args: { "p_key": string,"p_token": string,"p_uid": string }; Returns: string
                           },
"users_of_players":
{ Args: { "p_players": (string)[] }; Returns: (string)[]
                           },
"users_of_steam":
{ Args: { "p_steam": (string)[] }; Returns: (string)[]
                           },
"veto_act":
{ Args: { "p_map": string,"p_match": string,"p_version"?: string }; Returns: undefined
                           },
"veto_act_base":
{ Args: { "p_map": string,"p_match": string,"p_version"?: string }; Returns: undefined
                           },
"veto_auto":
{ Args: { "p_match": string }; Returns: undefined
                           },
"veto_reset":
{ Args: { "p_match": string }; Returns: undefined
                           },
"veto_sequence":
{ Args: { "p_bo": number,"p_maps": number }; Returns: (string)[]
                           },
"vip_at":
{ Args: { "p_at": string,"p_user": string }; Returns: boolean
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

