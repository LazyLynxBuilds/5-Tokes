const express=require('express');const http=require('http');const crypto=require('crypto');const {Server}=require('socket.io');const {GameRoom}=require('./game');
const app=express(),server=http.createServer(app);
const allowedOrigin=process.env.CORS_ORIGIN||'*';
const io=new Server(server,{cors:{origin:allowedOrigin,methods:['GET','POST']},pingTimeout:20000,pingInterval:25000}),rooms=new Map();
app.get('/health',(_,res)=>res.json({ok:true,name:'5 Tokes Multiplayer',version:'0.6.5',rooms:rooms.size,players:[...rooms.values()].reduce((n,r)=>n+r.players.filter(p=>p.connected).length,0)}));
function roomCode(){const chars='ABCDEFGHJKLMNPQRSTUVWXYZ23456789';let c;do{c=Array.from({length:5},()=>chars[Math.floor(Math.random()*chars.length)]).join('');}while(rooms.has(c));return c;}
function cleanName(n){return String(n||'Player').trim().slice(0,20)||'Player';}
function emitRoom(r){for(const p of r.players)if(p.connected&&p.socketId)io.to(p.socketId).emit('state',r.stateFor(p.id));}
function fail(s,e){s.emit('errorMessage',e.message||String(e));}
function bind(s,r,p){s.join(r.code);s.data.roomCode=r.code;s.data.playerId=p.id;s.emit('session',{roomCode:r.code,playerToken:p.sessionToken,playerId:p.id,name:p.name});emitRoom(r);}
function clearSocketRoom(s,code,reason){if(code)s.leave(code);s.data.roomCode=null;s.data.playerId=null;s.emit('roomExited',{reason});}
function exitFinishedRoom(s,reason='left'){
  const code=s.data.roomCode,r=rooms.get(code);
  if(!r){clearSocketRoom(s,code,reason);return;}
  if(r.started)throw new Error('A game is active. Use Forfeit Game to leave.');
  const empty=r.leave(s.data.playerId);clearSocketRoom(s,code,reason);if(empty)rooms.delete(code);else emitRoom(r);
}
io.on('connection',s=>{
  s.on('createRoom',({name}={})=>{try{const c=roomCode(),token=crypto.randomUUID(),r=new GameRoom(c,s.id,cleanName(name),token);rooms.set(c,r);bind(s,r,r.players[0]);}catch(e){fail(s,e);}});
  s.on('joinRoom',({name,roomCode:rc}={})=>{try{const c=String(rc||'').toUpperCase().trim(),r=rooms.get(c);if(!r)throw new Error('Room not found.');const p=r.addPlayer(s.id,cleanName(name),crypto.randomUUID());bind(s,r,p);}catch(e){fail(s,e);}});
  s.on('resumeSession',({roomCode:rc,playerToken}={})=>{try{const r=rooms.get(String(rc||'').toUpperCase());if(!r)throw new Error('Saved room expired.');const p=r.reconnect(playerToken,s.id);bind(s,r,p);}catch(e){s.emit('resumeFailed',e.message||String(e));}});
  const room=()=>{const r=rooms.get(s.data.roomCode);if(!r)throw new Error('Room not found.');return r;};
  s.on('startGame',()=>{try{const r=room();r.start(s.data.playerId);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('rematch',()=>{try{const r=room();r.rematch(s.data.playerId);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('draw',source=>{try{const r=room();r.draw(s.data.playerId,source);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('discard',cardId=>{try{const r=room();r.discard(s.data.playerId,cardId);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('goOut',payload=>{try{const r=room();const p=typeof payload==='string'?{discardId:payload}:payload||{};r.goOut(s.data.playerId,p.discardId,p.melds);emitRoom(r);}catch(e){fail(s,e);}});
  s.on('leaveRoom',()=>{try{exitFinishedRoom(s,'left');}catch(e){fail(s,e);}});
  s.on('exitRoom',()=>{try{exitFinishedRoom(s,'left');}catch(e){fail(s,e);}});
  s.on('forfeitGame',()=>{try{const r=room(),code=r.code;const empty=r.forfeit(s.data.playerId);clearSocketRoom(s,code,'forfeit');if(empty)rooms.delete(code);else emitRoom(r);}catch(e){fail(s,e);}});
  s.on('disconnect',()=>{const r=rooms.get(s.data.roomCode);if(!r)return;r.disconnect(s.data.playerId);emitRoom(r);});
});
setInterval(()=>{const cutoff=Date.now()-30*60*1000;for(const [c,r] of rooms)if(r.lastActivity<cutoff&&r.players.every(p=>!p.connected))rooms.delete(c);},60000).unref();
const PORT=process.env.PORT||3000;server.listen(PORT,()=>console.log(`5 Tokes server on :${PORT}`));
