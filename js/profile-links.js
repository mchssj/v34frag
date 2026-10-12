/* CSSTV profile identifier validation and safe external profile links. */
(function (global) {
'use strict';
var STEAM64=/^(7656119\d{10}|765612\d{11})$/;
function cleanSteam(v){v=String(v||'').trim();if(!v)return'';if(/^https?:\/\/steamcommunity\.com\/(id|profiles)\/[A-Za-z0-9_\-]+\/?$/i.test(v))return v.replace(/^http:/i,'https:');if(STEAM64.test(v)||/^STEAM_[0-5]:[01]:\d+$/i.test(v)||/^[A-Za-z0-9_\-]{2,32}$/.test(v))return v;return null}
function cleanFaceit(v){v=String(v||'').trim();if(!v)return'';if(/^https?:\/\/(www\.)?faceit\.com\/[^\s]*$/i.test(v))return v.replace(/^http:/i,'https:');if(/^[A-Za-z0-9_\-]{2,32}$/.test(v))return v;return null}
function steamLink(v){v=String(v||'');if(/^https:\/\/steamcommunity\.com\//i.test(v))return v;if(STEAM64.test(v))return'https://steamcommunity.com/profiles/'+v;if(/^[A-Za-z0-9_\-]{2,32}$/.test(v))return'https://steamcommunity.com/id/'+v;return null}
function faceitLink(v){v=String(v||'');if(/^https:\/\/(www\.)?faceit\.com\//i.test(v))return v;if(/^[A-Za-z0-9_\-]{2,32}$/.test(v))return'https://www.faceit.com/es/players/'+v;return null}
global.CSSTVProfileLinks=Object.freeze({STEAM64:STEAM64,cleanSteam:cleanSteam,cleanFaceit:cleanFaceit,steamLink:steamLink,faceitLink:faceitLink});
})(window);
