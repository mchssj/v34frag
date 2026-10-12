document.getElementById('th').onclick=function(){var r=document.documentElement,d=r.getAttribute('data-theme');
var dark=d?d==='dark':!matchMedia('(prefers-color-scheme: light)').matches;r.setAttribute('data-theme',dark?'light':'dark')};
