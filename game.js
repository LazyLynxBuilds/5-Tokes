const crypto = require('crypto');
const SUITS = ['joint', 'grinder', 'leaf', 'bong', 'lighter'];
const RANKS = [3,4,5,6,7,8,9,10,11,12,13];
const CPU_NAMES = ['Royal Toker CPU','Grinder Guard CPU','Bong Baron CPU','Blunt Knight CPU','Kush Court CPU','Cloud Crown CPU'];
const CPU_AVATARS = ['highstakes','bonglord','kingkush','jahbuddy','growwizard','jollyjoker'];

function cardId(prefix, suit, rank, copy) { return `${prefix}-${suit || 'joker'}-${rank || 'J'}-${copy}`; }
function createDeck() {
  const deck=[];
  for (const suit of SUITS) for (const rank of RANKS) for (let copy=1;copy<=2;copy++) deck.push({id:cardId('c',suit,rank,copy),suit,rank,joker:false});
  for (let i=1;i<=6;i++) deck.push({id:cardId('j',null,null,i),suit:null,rank:null,joker:true});
  return deck;
}
function shuffle(cards){const a=[...cards];for(let i=a.length-1;i>0;i--){const j=Math.floor(Math.random()*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
function isWild(card,roundRank){return card.joker||card.rank===roundRank;}
function scoreCard(card,roundRank){if(card.joker)return 50;if(card.rank===roundRank)return 20;return card.rank;}
function rankName(rank){return rank===11?'Jack':rank===12?'Queen':rank===13?'King':String(rank);}
function wildName(rank){return rank===11?'Jacks':rank===12?'Queens':rank===13?'Kings':`${rank}s`;}
function validBook(cards,roundRank){if(cards.length<3)return false;const n=cards.filter(c=>!isWild(c,roundRank));return !n.length||n.every(c=>c.rank===n[0].rank);}
function validRun(cards,roundRank){
  if(cards.length<3)return false; const n=cards.filter(c=>!isWild(c,roundRank)); if(!n.length)return true;
  const suit=n[0].suit;if(!n.every(c=>c.suit===suit))return false;const ranks=n.map(c=>c.rank).sort((a,b)=>a-b);
  for(let i=1;i<ranks.length;i++)if(ranks[i]===ranks[i-1])return false;
  const gaps=(ranks[ranks.length-1]-ranks[0]+1)-ranks.length,w=cards.length-n.length;if(gaps>w)return false;
  return w-gaps <= (ranks[0]-3)+(13-ranks[ranks.length-1]);
}
function validMeld(cards,roundRank){return validBook(cards,roundRank)||validRun(cards,roundRank);}
function findPartitionAll(cards,roundRank){
  if(!cards.length)return [];if(cards.length<3)return null;const n=cards.length,full=(1<<n)-1,meldMasks=[];
  for(let mask=1;mask<=full;mask++){const group=[];for(let i=0;i<n;i++)if(mask&(1<<i))group.push(cards[i]);if(group.length>=3&&validMeld(group,roundRank))meldMasks.push(mask);}
  const by=Array.from({length:n},()=>[]);for(const m of meldMasks)for(let i=0;i<n;i++)if(m&(1<<i))by[i].push(m);const memo=new Map();
  function dfs(mask){
    if(!mask)return [];
    if(memo.has(mask))return memo.get(mask);
    let first=0;while(!(mask&(1<<first)))first++;
    for(const m of by[first])if((m&mask)===m){const rest=dfs(mask^m);if(rest){const group=[];for(let i=0;i<n;i++)if(m&(1<<i))group.push(cards[i]);const result=[group,...rest];memo.set(mask,result);return result;}}
    memo.set(mask,null);return null;
  }
  return dfs(full);
}
function canPartitionAll(cards,roundRank){return findPartitionAll(cards,roundRank)!==null;}
function goOutDiscardIds(hand,roundRank){
  if(!Array.isArray(hand)||hand.length<4)return [];
  const ids=[];for(const card of hand){const remaining=hand.filter(c=>c.id!==card.id);if(findPartitionAll(remaining,roundRank))ids.push(card.id);}return ids;
}
function bestMeldPlan(cards,roundRank){
  const n=cards.length;if(!n)return {score:0,melds:[]};const full=(1<<n)-1,meldMasks=[];
  for(let mask=1;mask<=full;mask++){const group=[];for(let i=0;i<n;i++)if(mask&(1<<i))group.push(cards[i]);if(group.length>=3&&validMeld(group,roundRank))meldMasks.push(mask);}
  const by=Array.from({length:n},()=>[]);for(const m of meldMasks)for(let i=0;i<n;i++)if(m&(1<<i))by[i].push(m);
  const memo=new Map();
  function solve(mask){
    if(!mask)return {score:0,masks:[]};if(memo.has(mask))return memo.get(mask);
    let first=0;while(!(mask&(1<<first)))first++;
    const without=solve(mask^(1<<first));let best={score:scoreCard(cards[first],roundRank)+without.score,masks:without.masks};
    for(const m of by[first])if((m&mask)===m){const rest=solve(mask^m);if(rest.score<best.score)best={score:rest.score,masks:[m,...rest.masks]};}
    memo.set(mask,best);return best;
  }
  const result=solve(full);return {score:result.score,melds:result.masks.map(mask=>cards.filter((_,i)=>mask&(1<<i)))};
}
function minimumRemainingScore(cards,roundRank){return bestMeldPlan(cards,roundRank).score;}
function publicCard(card){return card?{...card}:null;}
function validateMeldLayout(hand,discardId,meldIdGroups,roundRank){
  if(!Array.isArray(meldIdGroups)||!meldIdGroups.length)return false;
  const remaining=hand.filter(c=>c.id!==discardId),byId=new Map(remaining.map(c=>[c.id,c])),seen=new Set();
  for(const ids of meldIdGroups){if(!Array.isArray(ids)||ids.length<3)return false;const cards=[];for(const id of ids){if(seen.has(id)||!byId.has(id))return false;seen.add(id);cards.push(byId.get(id));}if(!validMeld(cards,roundRank))return false;}
  return seen.size===remaining.length;
}
function validPartialMelds(hand,discardId,meldIdGroups,roundRank){
  const remaining=hand.filter(c=>c.id!==discardId),byId=new Map(remaining.map(c=>[c.id,c])),seen=new Set(),melds=[];
  for(const ids of Array.isArray(meldIdGroups)?meldIdGroups:[]){
    if(!Array.isArray(ids)||ids.length<3)continue;const cards=[];let ok=true;
    for(const id of ids){if(seen.has(id)||!byId.has(id)){ok=false;break;}cards.push(byId.get(id));}
    if(!ok||!validMeld(cards,roundRank))continue;for(const c of cards)seen.add(c.id);melds.push(cards);
  }
  return {remaining,melds,usedIds:seen};
}
function scoreUnmelded(remaining,usedIds,roundRank){let total=0;for(const c of remaining)if(!usedIds.has(c.id))total+=scoreCard(c,roundRank);return total;}
function cloneData(x){return JSON.parse(JSON.stringify(x));}
function newPlayer(name,socketId,token,avatarKey='jahbuddy',profileId=null,isBot=false){
  return {id:crypto.randomUUID(),profileId:isBot?null:(profileId||crypto.randomUUID()),sessionToken:isBot?null:(token||crypto.randomUUID()),socketId:isBot?null:socketId,name,avatarKey,hand:[],score:0,connected:true,finalDone:false,roundPenalty:null,isBot:!!isBot};
}
function bestBotDiscard(cards,roundRank){
  if(!cards.length)return null;let best=null;
  for(const card of cards){const remaining=cards.filter(c=>c.id!==card.id),penalty=minimumRemainingScore(remaining,roundRank),raw=scoreCard(card,roundRank);if(!best||penalty<best.penalty||(penalty===best.penalty&&raw>best.raw))best={card,penalty,raw};}
  return best;
}
function chooseBotDrawSource(hand,discardTop,roundRank){
  if(!discardTop)return 'deck';if(isWild(discardTop,roundRank))return 'discard';const current=minimumRemainingScore(hand,roundRank),withTop=bestBotDiscard([...hand,discardTop],roundRank);return withTop&&withTop.penalty<current?'discard':'deck';
}

class GameRoom{
  constructor(code,hostSocketId,hostName,sessionToken,avatarKey='jahbuddy',profileId=null,maxPlayers=7){
    const p=newPlayer(hostName,hostSocketId,sessionToken,avatarKey,profileId);
    this.code=code;this.players=[p];this.hostId=p.id;this.maxPlayers=Math.max(2,Math.min(7,Number(maxPlayers)||7));this.started=false;this.roundRank=3;this.dealerIndex=0;this.turnIndex=0;this.turnStage='draw';this.drawPile=[];this.discardPile=[];this.outPlayerId=null;this.roundEnding=false;this.winnerIds=[];this.outMelds=[];this.message='Waiting for players.';this.lastActivity=Date.now();this.gameId=null;this.gameParticipants=[];this.forfeitedParticipants=[];this.actionSeq=0;this.lastAction=null;
    this.revealedMelds=[];this.revealedMeldRoundRank=null;this.scoreSeq=0;this.lastScoreAnnouncement=null;this.undoAvailable=null;this.pendingUndo=null;this.undoSnapshot=null;
  }
  touch(){this.lastActivity=Date.now();}
  announce(type,data={}){this.lastAction={seq:++this.actionSeq,type,at:Date.now(),...data};}
  announceScore(p,points,roundRank=this.roundRank){this.lastScoreAnnouncement={seq:++this.scoreSeq,at:Date.now(),playerId:p.id,playerName:p.name,points,projectedTotal:p.score+points,roundRank,roundLabel:rankName(roundRank)};}
  addPlayer(socketId,name,token,avatarKey='jahbuddy',profileId=null){if(this.started)throw new Error('Game already started.');if(this.players.length>=this.maxPlayers)throw new Error(`Room is full (${this.maxPlayers} players).`);const p=newPlayer(name,socketId,token,avatarKey,profileId);this.players.push(p);this.message=`${p.name} joined the room.`;this.touch();return p;}
  addComputerPlayer(name=null,avatarKey=null){if(this.started)throw new Error('Game already started.');if(this.players.length>=this.maxPlayers)throw new Error(`Room is full (${this.maxPlayers} players).`);const botIndex=this.players.filter(p=>p.isBot).length;const p=newPlayer(name||CPU_NAMES[botIndex%CPU_NAMES.length],null,null,avatarKey||CPU_AVATARS[botIndex%CPU_AVATARS.length],null,true);this.players.push(p);this.message=`${p.name} joined the table.`;this.touch();return p;}
  fillWithComputers(requester){if(requester!==this.hostId)throw new Error('Only the host can fill seats with CPU players.');if(this.started)throw new Error('The game has already started.');while(this.players.length<this.maxPlayers)this.addComputerPlayer();this.message='Open seats filled with CPU players.';this.touch();}
  reconnect(sessionToken,socketId){const p=this.players.find(x=>x.sessionToken===sessionToken);if(!p)throw new Error('Saved seat not found.');p.socketId=socketId;p.connected=true;this.touch();return p;}
  disconnect(playerId){const p=this.players.find(x=>x.id===playerId);if(p){p.connected=false;p.socketId=null;this.touch();}}
  leave(playerId){
    if(this.started)throw new Error('A game is active. Use Forfeit Game to leave.');const idx=this.players.findIndex(p=>p.id===playerId);if(idx<0)throw new Error('Player not found.');this.players.splice(idx,1);if(this.hostId===playerId)this.hostId=this.players.find(p=>!p.isBot)?.id||this.players[0]?.id||null;if(this.players.length){this.dealerIndex=Math.min(this.dealerIndex,this.players.length-1);this.turnIndex=Math.min(this.turnIndex,this.players.length-1);this.message='Waiting for players.';}this.touch();return this.players.length===0;
  }
  forfeit(playerId){
    if(!this.started)throw new Error('No active game to forfeit.');this.clearUndo();const idx=this.players.findIndex(p=>p.id===playerId);if(idx<0)throw new Error('Player not found.');const currentId=this.currentPlayer()?.id,dealerId=this.players[this.dealerIndex]?.id,wasCurrent=currentId===playerId;const forfeiter=this.players[idx],name=forfeiter.name;this.forfeitedParticipants.push({id:forfeiter.id,profileId:forfeiter.profileId,name:forfeiter.name,avatarKey:forfeiter.avatarKey,score:null,forfeit:true});this.players.splice(idx,1);if(this.hostId===playerId)this.hostId=this.players.find(p=>!p.isBot)?.id||this.players[0]?.id||null;
    if(!this.players.length){this.started=false;this.turnStage='gameover';this.winnerIds=[];this.message=`${name} forfeited. Room is empty.`;this.announce('forfeit',{playerName:name});this.touch();return true;}
    if(this.players.length===1){this.started=false;this.turnStage='gameover';this.winnerIds=[this.players[0].id];this.message=`${name} forfeited. ${this.players[0].name} wins by forfeit.`;this.announce('forfeitWin',{playerName:name,winnerName:this.players[0].name,winnerId:this.players[0].id});this.turnIndex=0;this.dealerIndex=0;this.touch();return false;}
    const currentNew=this.players.findIndex(p=>p.id===currentId);this.turnIndex=wasCurrent?Math.min(idx,this.players.length-1):(currentNew>=0?currentNew:0);if(wasCurrent&&idx>=this.players.length)this.turnIndex=0;const dealerNew=this.players.findIndex(p=>p.id===dealerId);this.dealerIndex=dealerNew>=0?dealerNew:Math.min(this.dealerIndex,this.players.length-1);this.turnStage='draw';const next=this.currentPlayer();this.message=`${name} forfeited. ${next?.name||'Next player'} is up.`;this.announce('forfeit',{playerName:name,nextPlayerName:next?.name,nextPlayerId:next?.id});if(this.roundEnding){const pending=this.players.filter(p=>p.id!==this.outPlayerId&&!p.finalDone);if(!pending.length)this.finishRound();}this.touch();return false;
  }
  start(requester){if(requester!==this.hostId)throw new Error('Only the host can start.');if(this.players.length<2)throw new Error('At least 2 players are required.');this.players=this.players.filter(p=>p.isBot||p.connected);if(this.players.length<2)throw new Error('At least 2 connected players are required.');this.hostId=this.players.some(p=>p.id===this.hostId)?this.hostId:this.players.find(p=>!p.isBot)?.id||this.players[0].id;this.gameId=crypto.randomUUID();this.gameParticipants=this.players.map(p=>({id:p.id,profileId:p.profileId,name:p.name,avatarKey:p.avatarKey,isBot:p.isBot}));this.forfeitedParticipants=[];this.started=true;this.roundRank=3;this.dealerIndex=0;this.winnerIds=[];this.revealedMelds=[];this.revealedMeldRoundRank=null;this.lastScoreAnnouncement=null;this.clearUndo();this.players.forEach(p=>{p.score=0;p.roundPenalty=null;});this.startRound();}
  rematch(requester){if(requester!==this.hostId)throw new Error('Only the host can start a rematch.');if(this.started)throw new Error('The current game is still running.');this.start(requester);}
  startRound(){const deck=shuffle(createDeck());this.players.forEach(p=>{p.hand=[];p.finalDone=false;p.roundPenalty=null;});for(let c=0;c<this.roundRank;c++)for(const p of this.players)p.hand.push(deck.pop());this.drawPile=deck;this.discardPile=[this.drawPile.pop()];this.turnIndex=(this.dealerIndex+1)%this.players.length;this.turnStage='draw';this.outPlayerId=null;this.outMelds=[];this.roundEnding=false;this.message=`${rankName(this.roundRank)} round: ${wildName(this.roundRank)} are wild.`;this.announce('roundStart',{roundRank:this.roundRank,roundLabel:rankName(this.roundRank),wildLabel:wildName(this.roundRank),playerName:this.currentPlayer()?.name,playerId:this.currentPlayer()?.id});this.touch();}
  currentPlayer(){return this.players[this.turnIndex];}
  ensureTurn(id,stage){if(!this.started)throw new Error('Game has not started.');if(this.currentPlayer()?.id!==id)throw new Error('It is not your turn.');if(stage&&this.turnStage!==stage)throw new Error(`You must ${stage} first.`);}
  replenishDraw(){if(this.drawPile.length)return;if(this.discardPile.length<=1)throw new Error('No cards available to draw.');const top=this.discardPile.pop();this.drawPile=shuffle(this.discardPile);this.discardPile=[top];}
  clearUndo(){this.undoAvailable=null;this.pendingUndo=null;this.undoSnapshot=null;}
  snapshotTurn(){return cloneData({players:this.players,started:this.started,roundRank:this.roundRank,dealerIndex:this.dealerIndex,turnIndex:this.turnIndex,turnStage:this.turnStage,drawPile:this.drawPile,discardPile:this.discardPile,outPlayerId:this.outPlayerId,roundEnding:this.roundEnding,winnerIds:this.winnerIds,outMelds:this.outMelds,message:this.message,revealedMelds:this.revealedMelds,revealedMeldRoundRank:this.revealedMeldRoundRank,lastScoreAnnouncement:this.lastScoreAnnouncement});}
  restoreTurn(snapshot){const liveConnections=new Map(this.players.map(p=>[p.id,{connected:p.connected,socketId:p.socketId}]));for(const [k,v] of Object.entries(snapshot))this[k]=cloneData(v);for(const p of this.players){const live=liveConnections.get(p.id);if(live){p.connected=live.connected;p.socketId=live.socketId;}}}
  offerUndo(requester,snapshot){const approver=this.currentPlayer();if(!this.started||requester.isBot||!approver||approver.isBot||!approver.connected||approver.id===requester.id){this.clearUndo();return;}this.undoSnapshot=snapshot;this.pendingUndo=null;this.undoAvailable={requesterId:requester.id,requesterName:requester.name,approverId:approver.id,approverName:approver.name,createdAt:Date.now()};}
  requestUndo(requesterId){
    const u=this.undoAvailable;if(!u||u.requesterId!==requesterId||!this.undoSnapshot)throw new Error('The undo window has closed.');
    if(!this.started||this.turnStage!=='draw'||this.currentPlayer()?.id!==u.approverId)throw new Error('The next player has already started their turn.');
    if(this.currentPlayer()?.isBot)throw new Error('CPU turns cannot approve undo requests.');
    const expiresAt=Date.now()+15000;this.pendingUndo={...u,expiresAt};this.message=`${u.requesterName} requested an undo. ${u.approverName} has 15 seconds to allow or deny it.`;this.announce('undoRequested',{...this.pendingUndo});this.touch();return expiresAt;
  }
  respondUndo(approverId,allow,reason='response'){
    const u=this.pendingUndo;if(!u)throw new Error('There is no pending undo request.');if(reason==='response'&&u.approverId!==approverId)throw new Error('Only the next player can answer this undo request.');
    if(allow){const requesterName=u.requesterName,approverName=u.approverName,snapshot=this.undoSnapshot;if(!snapshot)throw new Error('Undo snapshot is no longer available.');this.restoreTurn(snapshot);this.clearUndo();this.message=`Undo approved by ${approverName}. ${requesterName} may change their turn-ending move.`;this.announce('undoApproved',{requesterName,approverName});this.touch();return true;}
    const requesterName=u.requesterName,approverName=u.approverName;this.clearUndo();this.message=reason==='timeout'?`Undo request expired. ${approverName}'s turn continues.`:`${approverName} denied ${requesterName}'s undo request. Play continues.`;this.announce(reason==='timeout'?'undoExpired':'undoDenied',{requesterName,approverName});this.touch();return false;
  }
  draw(id,source){
    this.ensureTurn(id,'draw');if(this.pendingUndo)throw new Error('Please answer the undo request before drawing.');if(this.undoAvailable)this.clearUndo();
    const p=this.currentPlayer();let card;if(source==='discard'){if(!this.discardPile.length)throw new Error('Discard pile is empty.');card=this.discardPile.pop();}else{this.replenishDraw();card=this.drawPile.pop();source='deck';}p.hand.push(card);this.turnStage='discard';this.message=`${p.name} drew from the ${source==='discard'?'discard pile':'deck'}.`;this.announce('draw',{playerId:p.id,playerName:p.name,source,card:source==='discard'?publicCard(card):null});this.touch();return card;
  }
  reorderHand(id,orderedIds){const p=this.players.find(x=>x.id===id);if(!p)throw new Error('Player not found.');if(!Array.isArray(orderedIds)||orderedIds.length!==p.hand.length)throw new Error('Invalid hand order.');const byId=new Map(p.hand.map(c=>[c.id,c])),seen=new Set(),next=[];for(const cid of orderedIds){if(seen.has(cid)||!byId.has(cid))throw new Error('Invalid hand order.');seen.add(cid);next.push(byId.get(cid));}p.hand=next;this.touch();}
  recordReveal(p,melds,points,roundRank){const entry={playerId:p.id,playerName:p.name,avatarKey:p.avatarKey,roundRank,roundLabel:rankName(roundRank),points,totalAfterRound:p.score+points,at:Date.now(),melds:melds.map(g=>g.map(publicCard))};this.revealedMelds=this.revealedMelds.filter(x=>x.playerId!==p.id||x.roundRank!==roundRank);this.revealedMelds.push(entry);this.revealedMeldRoundRank=roundRank;}
  discard(id,payload){
    this.ensureTurn(id,'discard');if(this.revealedMelds.length&&this.revealedMeldRoundRank!==this.roundRank){this.revealedMelds=[];this.revealedMeldRoundRank=null;}const p=this.currentPlayer(),playerName=p.name,cardIdToDiscard=typeof payload==='string'?payload:payload?.cardId,hasMeldPayload=!!payload&&typeof payload==='object'&&Object.prototype.hasOwnProperty.call(payload,'melds'),submittedMelds=hasMeldPayload?payload.melds:null,idx=p.hand.findIndex(c=>c.id===cardIdToDiscard);if(idx<0)throw new Error('Card not found in your hand.');
    const snapshot=this.snapshotTurn(),roundRank=this.roundRank,[card]=p.hand.splice(idx,1);this.discardPile.push(card);
    if(this.roundEnding&&id!==this.outPlayerId){
      let melds,penalty;
      if(hasMeldPayload){const normalized=validPartialMelds([...p.hand,card],card.id,submittedMelds,roundRank);melds=normalized.melds;penalty=scoreUnmelded(p.hand,normalized.usedIds,roundRank);}else{const best=bestMeldPlan(p.hand,roundRank);melds=best.melds;penalty=best.score;}
      p.finalDone=true;p.roundPenalty=penalty;this.recordReveal(p,melds,penalty,roundRank);this.announceScore(p,penalty,roundRank);
    }
    const beforeRound=this.roundRank;this.touch();this.advanceTurn();const sameRound=this.started&&this.roundRank===beforeRound,next=this.started?this.currentPlayer():null;this.announce('discard',{playerId:id,playerName,card:publicCard(card),nextPlayerId:next?.id,nextPlayerName:next?.name,roundComplete:!sameRound,finalTurn:!!snapshot.roundEnding,points:p.roundPenalty});if(this.started)this.offerUndo(p,snapshot);else this.clearUndo();if(sameRound)this.message=`${playerName} discarded. ${next.name}'s turn.`;
  }
  goOut(id,discardId,melds){
    this.ensureTurn(id,'discard');if(this.revealedMelds.length&&this.revealedMeldRoundRank!==this.roundRank){this.revealedMelds=[];this.revealedMeldRoundRank=null;}const p=this.currentPlayer(),idx=p.hand.findIndex(c=>c.id===discardId);if(idx<0)throw new Error('Choose a card to discard.');if(!validateMeldLayout(p.hand,discardId,melds,this.roundRank))throw new Error('Build valid melds (Meld Stashes) using every card except your selected discard before going down.');
    const snapshot=this.snapshotTurn(),roundRank=this.roundRank,before=new Map(p.hand.map(c=>[c.id,c])),finalGroups=melds.map(g=>g.map(cid=>before.get(cid)).filter(Boolean));const [card]=p.hand.splice(idx,1);this.discardPile.push(card);p.roundPenalty=0;p.finalDone=true;this.recordReveal(p,finalGroups,0,roundRank);this.announceScore(p,0,roundRank);
    const wasRoundEnding=this.roundEnding;if(!wasRoundEnding){this.outMelds=finalGroups.map(g=>g.map(publicCard));this.outPlayerId=id;this.roundEnding=true;this.message=`${p.name} went down! Everyone else gets one final turn.`;}
    const beforeRound=this.roundRank;this.touch();this.advanceTurn();const sameRound=this.started&&this.roundRank===beforeRound,next=this.started?this.currentPlayer():null;this.announce(wasRoundEnding?'finalGoDown':'goDown',{playerId:id,playerName:p.name,card:publicCard(card),melds:finalGroups.map(g=>g.map(publicCard)),nextPlayerId:next?.id,nextPlayerName:next?.name,roundComplete:!sameRound,points:0});if(this.started)this.offerUndo(p,snapshot);else this.clearUndo();if(wasRoundEnding&&sameRound)this.message=`${p.name} went down on the final turn. ${next.name}'s turn.`;
  }
  computerStep(){
    const bot=this.currentPlayer();if(!this.started||!bot?.isBot||this.pendingUndo)return {acted:false};
    if(this.turnStage==='draw'){const source=chooseBotDrawSource(bot.hand,this.discardPile[this.discardPile.length-1],this.roundRank);this.draw(bot.id,source);return {acted:true,stage:'draw',source};}
    if(this.turnStage==='discard'){
      const outs=goOutDiscardIds(bot.hand,this.roundRank);
      if(outs.length){const choice=outs.map(id=>bot.hand.find(c=>c.id===id)).filter(Boolean).sort((a,b)=>scoreCard(b,this.roundRank)-scoreCard(a,this.roundRank))[0],remaining=bot.hand.filter(c=>c.id!==choice.id),partition=findPartitionAll(remaining,this.roundRank);if(partition){this.goOut(bot.id,choice.id,partition.map(g=>g.map(c=>c.id)));return {acted:true,stage:'goOut',cardId:choice.id};}}
      const choice=bestBotDiscard(bot.hand,this.roundRank);if(!choice)throw new Error('Computer has no card to discard.');const cardId=choice.card.id;this.discard(bot.id,cardId);return {acted:true,stage:'discard',cardId};
    }
    return {acted:false};
  }
  advanceTurn(){if(this.roundEnding){const pending=this.players.filter(p=>p.id!==this.outPlayerId&&!p.finalDone);if(!pending.length)return this.finishRound();let next=this.turnIndex;for(let k=0;k<this.players.length;k++){next=(next+1)%this.players.length;if(this.players[next].id!==this.outPlayerId&&!this.players[next].finalDone)break;}this.turnIndex=next;this.turnStage='draw';return;}this.turnIndex=(this.turnIndex+1)%this.players.length;this.turnStage='draw';}
  finishRound(){for(const p of this.players){if(p.id===this.outPlayerId)p.roundPenalty=0;else if(p.roundPenalty==null)p.roundPenalty=minimumRemainingScore(p.hand,this.roundRank);p.score+=p.roundPenalty;}if(this.roundRank===13){const min=Math.min(...this.players.map(p=>p.score));this.winnerIds=this.players.filter(p=>p.score===min).map(p=>p.id);this.message=`Game over. Lowest score wins: ${min}.`;this.started=false;this.turnStage='gameover';this.announce('gameOver',{winnerIds:[...this.winnerIds],score:min,winnerNames:this.players.filter(p=>this.winnerIds.includes(p.id)).map(p=>p.name)});this.touch();return;}this.roundRank++;this.dealerIndex=(this.dealerIndex+1)%this.players.length;this.startRound();}
  leaderboardSnapshot(){
    if(this.started||!this.gameId||!this.winnerIds.length)return null;const currentById=new Map(this.players.map(p=>[p.id,p])),forfeitedById=new Map(this.forfeitedParticipants.map(p=>[p.id,p])),endedByForfeit=/wins by forfeit/i.test(this.message||'');const participants=this.gameParticipants.filter(base=>!base.isBot).map(base=>{const cur=currentById.get(base.id),forfeit=forfeitedById.get(base.id);return {...base,score:endedByForfeit?null:(cur&&Number.isFinite(cur.score)?cur.score:null),forfeit:!!forfeit};});const winnerProfileIds=this.winnerIds.map(id=>currentById.get(id)?.profileId||this.gameParticipants.find(p=>p.id===id)?.profileId).filter(Boolean);return {gameId:this.gameId,participants,winnerProfileIds,completedAt:Date.now()};
  }
  stateFor(id){
    const me=this.players.find(p=>p.id===id),currentId=this.currentPlayer()?.id;const goOutIds=me&&this.started&&currentId===id&&this.turnStage==='discard'?goOutDiscardIds(me.hand,this.roundRank):[];
    let undo=null;if(this.pendingUndo)undo={status:'pending',...this.pendingUndo,canRequest:false,canRespond:this.pendingUndo.approverId===id};else if(this.undoAvailable)undo={status:'available',...this.undoAvailable,canRequest:this.undoAvailable.requesterId===id,canRespond:false};
    return {code:this.code,gameId:this.gameId,hostId:this.hostId,maxPlayers:this.maxPlayers,started:this.started,roundRank:this.roundRank,roundNumber:this.roundRank-2,roundLabel:rankName(this.roundRank),wildLabel:wildName(this.roundRank),dealerIndex:this.dealerIndex,turnIndex:this.turnIndex,turnStage:this.turnStage,currentPlayerId:currentId,outPlayerId:this.outPlayerId,roundEnding:this.roundEnding,discardTop:publicCard(this.discardPile[this.discardPile.length-1]),drawCount:this.drawPile.length,message:this.message,lastAction:this.lastAction,scoreAnnouncement:this.lastScoreAnnouncement,winnerIds:this.winnerIds,outMelds:this.outMelds,revealedMelds:this.revealedMelds,undo,canRematch:!this.started&&this.winnerIds.length>0,canGoOut:goOutIds.length>0,goOutDiscardIds:goOutIds,you:me?{id:me.id,profileId:me.profileId,name:me.name,avatarKey:me.avatarKey,hand:me.hand.map(publicCard),score:me.score,roundPenalty:me.roundPenalty}:null,players:this.players.map((p,i)=>({id:p.id,profileId:p.profileId,name:p.name,avatarKey:p.avatarKey,isBot:!!p.isBot,score:p.score,cardCount:p.hand.length,connected:p.connected,dealer:i===this.dealerIndex,finalDone:p.finalDone,roundPenalty:p.roundPenalty,winner:this.winnerIds.includes(p.id)}))};
  }
}
module.exports={GameRoom,createDeck,isWild,scoreCard,rankName,wildName,validBook,validRun,validMeld,findPartitionAll,canPartitionAll,goOutDiscardIds,bestMeldPlan,minimumRemainingScore,validateMeldLayout,validPartialMelds,bestBotDiscard,chooseBotDrawSource};
