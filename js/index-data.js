/* Main index read model: all Supabase queries used to build the initial page snapshot. */
(function (global) {
'use strict';
async function required(query){var r=await query;if(r.error)throw r.error;return r.data}
async function optional(query,label,onError){var r=await query;if(r.error){if(onError)onError(label,r.error);return []}return r.data||[]}
async function loadSnapshot(client,isAdmin,userId,onError){
 return Promise.all([
  required(client.from('teams').select('*')),
  required(client.from('players').select('*').order('nick')),
  optional(client.from('matches').select('*'),'matches',onError),
  optional(client.from('events').select('*').order('starts_on',{ascending:false}),'events',onError),
  optional(client.from('tournament_registrations').select('*'),'tournament_registrations',onError),
  optional(client.from('player_medals').select('*'),'player_medals',onError),
  optional(client.from('player_map_stats').select('*'),'player_map_stats',onError),
  optional(client.from('profile_requests').select('*'),'profile_requests',onError),
  optional(client.from('match_vetos').select('*'),'match_vetos',onError),
  optional(client.from('pcw_posts').select('*').order('created_at',{ascending:false}),'pcw_posts',onError),
  optional(client.from('result_reports').select('*'),'result_reports',onError),
  (async function(){var r=await client.from('public_profiles').select('*');if(r.error)r=await client.from('profiles').select('id, tag');return r})(),
  isAdmin?required(client.from('team_requests').select('*')):Promise.resolve([]),
  userId?client.from('team_requests').select('*').eq('user_id',userId).maybeSingle().then(function(r){if(r.error)throw r.error;return r.data}):Promise.resolve(null),
  optional(client.from('match_player_stats').select('*'),'match_player_stats',onError),
  isAdmin?optional(client.from('game_servers').select('id,name,active,created_at,last_seen_at').order('created_at'),'game_servers',onError):Promise.resolve([]),
  optional(client.from('player_elo').select('steam_id,elo,peak_elo,matches'),'player_elo',onError),
  optional(client.from('elo_config').select('*').eq('id',1),'elo_config',onError)
 ]);
}
global.CSSTVIndexData=Object.freeze({loadSnapshot:loadSnapshot});
})(window);
