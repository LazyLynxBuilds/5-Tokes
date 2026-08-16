const express=require('express');
const http=require('http');
const crypto=require('crypto');
const path=require('path');
const {Server}=require('socket.io');
const {GameRoom}=require('./game');
const {LeaderboardStore}=require('./leaderboardStore');

const app=express(),server=http.createServer(app);
const allowedOrigin=process.env.CORS_ORIGIN||'*';
const io=new Server(server,{cors:{origin:allowedOrigin,methods:['GET','POST']},pingTimeout:20000,pingInterval:25000});
const rooms=new Map(),botTimers=new Map();
const leaderboardPath=process.env.LEADERBOARD_FILE||path.join(__dirname,'data','leaderboard.json');
const leaderboard=new LeaderboardStore(leaderboardPath);

function leaderboardPayload(limit=100){return {updatedAt:Date.now(),entries:leaderboard.entries(limit)};}
app.get('/health',(_,res)=>res.json({ok:true,name:'5 Tokes Multiplayer',version:'0.7.3',rooms:rooms.size,players:[...rooms.values()].reduce((n,r)=>n+r.players.filter(p=>p.connected&&!p.isBot).length,0),computerPlayers:[...rooms.values()].reduce((n,r)=>n+r.players.filter(p=>p.isBot).length,0),leaderboardEntries:leaderboard.entries(500).length}));
app.get('/leaderboard',(req,res)=>res.json(leaderboardPayload(req.query.limit||100)));

function roomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c;do{c=Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('');}while(rooms.has(c));return c;}
function cleanName(n){return String(n||'Player').trim().slice(0,20)||'Player';}
function cleanProfileId(id){const x=String(id||'').trim();return /^[A-Za-z0-9_-]{12,80}$/.test(x)?x:crypto.randomUUID();}
function cleanCount(n,min,max,fallback){const x=Number(n);return Number.isFinite(x)?Math.max(min,Math.min(max,Math.floor(x))):fallback;}
const AVATARS=new Set(['jahbuddy','maryjane','kingkush','jollyjoker','grinderqueen','crownconnect','bluntprincess','bonglord','growwizard','spacehighness','dawgking','highstakes']);
function cleanAvatar(a){a=String(a||'jahbuddy').toLowerCase();return AVATARS.has(a)?a:'jahbuddy';}
function recordLeaderboardIfFinished(r){const snapshot=r.leaderboardSnapshot?.();if(!snapshot)return false;const changed=leaderboard.recordGame(snapshot);if(changed)io.emit('leaderboard',leaderboardPayload(100));return changed;}
function scheduleComputer(r){
  const bot=r.currentPlayer?.();if(!r.started||!bot?.isBot||botTimers.has(r.code))return;
  const delay=r.turnStage==='draw'?2200:1750;
  const timer=setTimeout(()=>{botTimers.delete(r.code);if(rooms.get(r.code)!==r||!r.started||!r.currentPlayer()?.isBot)return;try{r.computerStep();emitRoom(r);}catch(e){console.error(`[cpu ${r.code}]`,e);r.message='The computer player hit an error. Please leave the room and try again.';emitRoom(r);}},delay);
  botTimers.set(r.code,timer);
}
function emitRoom(r){recordLeaderboardIfFinished(r);for(const p of r.players)if(!p.isBot&&p.connected&&p.socketId)io.to(p.socketId).emit('state',r.stateFor(p.id));scheduleComputer(r);}
function hasHumanPlayers(r){return r.players.some(p=>!p.isBot);}
function hasConnectedHumans(r){return r.players.some(p=>!p.isBot&&p.connected);}
function fail(s,e){s.emit('errorMessage',e.message||String(e));}
function bind(s,r,p,emit=true){s.join(r.code);s.data.roomCode=r.code;s.data.playerId=p.id;s.emit('session',{roomCode:r.code,playerToken:p.sessionToken,playerId:p.id,profileId:p.profileId,name:p.name,avatarKey:p.avatarKey});if(emit)emitRoom(r);}
function clearSocketRoom(s,code,reason){if(code)s.leave(code);s.data.roomCode=null;s.data.playerId=null;s.emit('roomExited',{reason});}
function exitFinishedRoom(s,reason='left'){const code=s.data.roomCode,r=rooms.get(code);if(!r){clearSocketRoom(s,code,reason);return;}if(r.started)throw new Error('A game is active. Use Forfeit Game to leave.');const empty=r.leave(s.data.playerId);clearSocketRoom(s,code,reason);if(empty||!hasHumanPlayers(r))rooms.delete(code);else emitRoom(r);}

io.on('connection',s=>{
  s.emit('leaderboard',leaderboardPayload(100));
  s.on('getLeaderboard',(limit=100)=>s.emit('leaderboard',leaderboardPayload(limit)));
  s.on('createRoom',({name,avatarKey,profileId,maxPlayers=7,cpuPlayers=0}={})=>{try{
    const capacity=cleanCount(maxPlayers,2,7,7),bots=cleanCount(cpuPlayers,0,capacity-1,0),c=roomCode(),token=crypto.randomUUID(),r=new GameRoom(c,s.id,cleanName(name),token,cleanAvatar(avatarKey),cleanProfileId(profileId),capacity);
    for(let i=0;i<bots;i++)r.addComputerPlayer();rooms.set(c,r);bind(s,r,r.players[0]);
  }catch(e){fail(s,e);}});
  s.on('createComputerGame',({name,avatarKey,profileId}={})=>{try{const c=roomCode(),token=crypto.randomUUID(),r=new GameRoom(c,s.id,cleanName(name),token,cleanAvatar(avatarKey),cleanProfileId(profileId),2),human=r.players[0];r.addComputerPlayer('Royal Toker CPU','highstakes');rooms.set(c,r);bind(s,r,human,false);r.start(human.id);r.message='Solo match started against Royal Toker CPU.';emitRoom(r);}catch(e){fail(s,e);}});
  s.on('joinRoom',({name,roomCode:rc,avatarKey,profileId}={})=>{try{const c=String(rc||'').toUpperCase().trim(),r=rooms.get(c);if(!r)throw new Error('Room not found.');const p=r.addPlayer(s.id,cleanName(name),crypto.randomUUID(),cleanAvatar(avatarKey),cleanProfileId(profileId));bind(s,r,p);}catch(e){fail(s,e);}});
  s.on('resumeSession',({roomCode:rc,playerToken}={})=>{try{const r=rooms.get(String(rc||'').toUpperCase());if(!r)throw new Error('Saved room expired.');const p=r.reconnect(playerToken,s.id);bind(s,r,p);}catch(e){s.emit('resumeFailed',e.message||String(e));}});
  const room=()=>{const r=rooms.get(s.data.roomCode);if(!r)throw new Error('Room not found.');return r;};
  s.on('fillWithCpu',()=>{try{const r=room();r.fillWithComputers(s.data.playerId);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('startGame',()=>{try{const r=room();r.start(s.data.playerId);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('rematch',()=>{try{const r=room();r.rematch(s.data.playerId);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('draw',source=>{try{const r=room();r.draw(s.data.playerId,source);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('reorderHand',orderedIds=>{try{const r=room();r.reorderHand(s.data.playerId,orderedIds);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('discard',cardId=>{try{const r=room();r.discard(s.data.playerId,cardId);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('goOut',payload=>{try{const r=room(),p=typeof payload==='string'?{discardId:payload}:payload||{};r.goOut(s.data.playerId,p.discardId,p.melds);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('leaveRoom',()=>{try{exitFinishedRoom(s,'left');}catch(e){fail(s,e);}});
  s.on('exitRoom',()=>{try{exitFinishedRoom(s,'left');}catch(e){fail(s,e);}});
  s.on('forfeitGame',()=>{try{const r=room(),code=r.code,empty=r.forfeit(s.data.playerId);clearSocketRoom(s,code,'forfeit');emitRoom(r);if(empty||!hasHumanPlayers(r))rooms.delete(code);}catch(e){fail(s,e);}});
  s.on('disconnect',()=>{const r=rooms.get(s.data.roomCode);if(!r)return;r.disconnect(s.data.playerId);emitRoom(r);});
});
setInterval(()=>{const cutoff=Date.now()-30*60*1000;for(const[c,r]of rooms)if(r.lastActivity<cutoff&&!hasConnectedHumans(r)){const timer=botTimers.get(c);if(timer)clearTimeout(timer);botTimers.delete(c);rooms.delete(c);}},60000).unref();
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log(`5 Tokes server on :${PORT} | leaderboard: ${leaderboardPath}`));
