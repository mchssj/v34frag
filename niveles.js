// Niveles de FACEIT: [nivel, ELO mínimo, color]. Los usan index.html y widget.html.
var LV=[[1,0,'#9aa0a6'],[2,501,'#1ca82a'],[3,751,'#1ca82a'],[4,901,'#e0a800'],[5,1051,'#e0a800'],[6,1201,'#e0a800'],[7,1351,'#e0a800'],[8,1531,'#ff6309'],[9,1751,'#ff6309'],[10,2001,'#e5361f']];
function lvlOf(elo){for(var i=LV.length-1;i>0;i--)if(elo>=LV[i][1])return LV[i];return LV[0]}
