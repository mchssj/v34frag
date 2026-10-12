/* CSSTV matchmaking data access. Keep Supabase queries and response checks in one place. */
(function (global) {
  'use strict';

  function unwrap(result) {
    if (result && result.error) throw result.error;
    return result ? result.data : null;
  }

  global.CSSTVMatchmakingData = Object.freeze({
    queueState: async function (client) { return unwrap(await client.rpc('matchmaking_queue_state')); },
    setQueueOpen: async function (client, open) { return unwrap(await client.rpc('matchmaking_set_queue_open', { p_open: !!open })); },
    status: async function (client) {
      return unwrap(await client.rpc('matchmaking_status'));
    },
    servers: async function (client) {
      return unwrap(await client
        .from('game_servers')
        .select('id,name,active,matchmaking_enabled,connect_address,last_assigned_at')
        .order('created_at')) || [];
    },
    isAdmin: async function (client, userId) {
      var row = unwrap(await client
        .from('profiles')
        .select('role')
        .eq('id', userId)
        .maybeSingle());
      return !!(row && row.role === 'admin');
    },
    updateServer: async function (client, serverId, changes) {
      return unwrap(await client
        .from('game_servers')
        .update(changes)
        .eq('id', serverId)
        .select('id')
        .single());
    }
  });
})(window);
