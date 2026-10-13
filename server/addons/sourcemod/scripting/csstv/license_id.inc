/**
 * ID del servidor para el que se compila el plugin (game_servers.id en Supabase).
 *
 * Vacío: el plugin acepta el token de cualquier servidor (nuestro build).
 * server/build_licenciado.sh compila una copia con el UUID de un servidor de terceros:
 * ese .smx solo funciona con el token de ese servidor y, si se filtra, se sabe de quién salió.
 */

#if defined _csstv_license_id_included
	#endinput
#endif
#define _csstv_license_id_included

#define CSSTV_LICENSE_ID ""
