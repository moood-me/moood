// The play's own clock, real and pausable (engines/1/clock.js): set going before anything that goes by the time — a
// file of its own, as every script of the page is (a host's Content-Security-Policy need allow none inline).
MooodClock(Date.now(), { real: true });
