const assert=require('assert');
const {createDeck,validBook,validRun,findPartitionAll,canPartitionAll,goOutDiscardIds,minimumRemainingScore,validateMeldLayout,GameRoom,bestBotDiscard,chooseBotDrawSource}=require('./game');
const deck=createDeck();assert.equal(deck.length,116);
const c=(s,r,id=`${s}${r}`)=>({id,suit:s,rank:r,joker:false});const j=id=>({id,joker:true,suit:null,rank:null});
assert(validBook([c('joint',9,'a'),c('leaf',9,'b'),j('j')],5));
assert(validRun([c('bong',4,'a'),c('bong',5,'b'),j('j'),c('bong',7,'c')],3));
const hand=[c('joint',8,'a'),c('leaf',8,'b'),c('bong',8,'c'),c('joint',3,'d')];
assert(canPartitionAll(hand.slice(0,3),5));assert(findPartitionAll(hand.slice(0,3),5));assert.deepEqual(goOutDiscardIds(hand,5),['d']);assert.equal(minimumRemainingScore(hand,5),3);assert(validateMeldLayout(hand,'d',[['a','b','c']],5));
// Server exposes Go Down only in the discard stage and requires a complete valid meld layout.
const g=new GameRoom('OUT42','s1','One','t1');g.addPlayer('s2','Two','t2');g.started=true;g.roundRank=5;g.turnIndex=0;g.turnStage='discard';g.players[0].hand=hand.map(x=>({...x}));g.players[1].hand=[c('leaf',4,'z')];g.drawPile=[c('leaf',10,'draw')];g.discardPile=[c('bong',6,'top')];
let st=g.stateFor(g.players[0].id);assert.equal(st.canGoOut,true);assert.deepEqual(st.goOutDiscardIds,['d']);assert.throws(()=>{const bad=new GameRoom('BAD71','s1','One','t1');bad.addPlayer('s2','Two','t2');bad.started=true;bad.roundRank=5;bad.turnIndex=0;bad.turnStage='discard';bad.players[0].hand=hand.map(x=>({...x}));bad.goOut(bad.players[0].id,'d',[['a']]);},/valid melds/i);g.goOut(g.players[0].id,'d',[['a','b','c']]);assert.equal(g.roundEnding,true);assert.equal(g.outMelds.length,1);assert.equal(g.outMelds[0].length,3);
// A remaining player can also go down on their final turn when every non-discard card is in valid melds.
const f=new GameRoom('FINAL','s1','One','t1');const fp2=f.addPlayer('s2','Two','t2');f.started=true;f.roundRank=5;f.turnIndex=1;f.turnStage='discard';f.roundEnding=true;f.outPlayerId=f.players[0].id;f.players[0].finalDone=true;f.players[1].hand=[c('joint',9,'fa'),c('leaf',9,'fb'),c('bong',9,'fc'),c('lighter',3,'fd')];f.drawPile=[c('leaf',10,'fx')];f.discardPile=[c('bong',6,'ft')];f.goOut(fp2.id,'fd',[['fa','fb','fc']]);assert.equal(f.roundRank,6);assert.equal(fp2.score,0);
// Forfeit should end a two-player game and allow the winner to leave afterward.
const r=new GameRoom('ABCDE','s1','One','t1');const p2=r.addPlayer('s2','Two','t2');r.start(r.players[0].id);r.forfeit(p2.id);assert.equal(r.started,false);assert.equal(r.winnerIds.length,1);assert.equal(r.leave(r.players[0].id),true);

// Avatars are stored with player state and hand order can be rearranged without changing cards.
const aroom=new GameRoom('AV666','s1','Royal Roller','tok1','grinderqueen');const ap2=aroom.addPlayer('s2','Cloud King','tok2','bonglord');
assert.equal(aroom.stateFor(aroom.players[0].id).you.avatarKey,'grinderqueen');assert.equal(aroom.stateFor(aroom.players[0].id).players[1].avatarKey,'bonglord');
aroom.players[0].hand=[c('joint',3,'r1'),c('leaf',9,'r2'),c('bong',5,'r3')];aroom.reorderHand(aroom.players[0].id,['r2','r3','r1']);assert.deepEqual(aroom.players[0].hand.map(x=>x.id),['r2','r3','r1']);
// Draw/discard actions publish table-wide action metadata and full face-card wild labels.
const act=new GameRoom('ACT71','s1','One','t1','jahbuddy',null,2);act.addPlayer('s2','Two','t2');act.started=true;act.roundRank=11;act.turnIndex=0;act.turnStage='draw';act.drawPile=[c('joint',4,'ad')];act.discardPile=[c('bong',9,'at')];act.draw(act.players[0].id,'deck');assert.equal(act.lastAction.type,'draw');assert.equal(act.stateFor(act.players[0].id).wildLabel,'Jacks');const discardId=act.players[0].hand[act.players[0].hand.length-1].id;act.discard(act.players[0].id,discardId);assert.equal(act.lastAction.type,'discard');assert.equal(act.lastAction.nextPlayerName,'Two');
console.log('all game tests passed');


// Room capacity and CPU fill are host-controlled.
const capRoom=new GameRoom('CAP71','s1','Host','tok','jahbuddy','profile_cap_12345',4);
capRoom.addPlayer('s2','Guest','tok2');assert.equal(capRoom.maxPlayers,4);capRoom.fillWithComputers(capRoom.players[0].id);assert.equal(capRoom.players.length,4);assert.equal(capRoom.players.filter(p=>p.isBot).length,2);

// Computer-player mode: bots can join/start, prefer useful discards, and never appear as leaderboard profiles.
const cpuRoom=new GameRoom('CPU69','human-socket','Human','human-token','maryjane','profile_human_cpu_12345');
const cpu=cpuRoom.addComputerPlayer();
assert.equal(cpu.isBot,true);assert.equal(cpu.profileId,null);assert.equal(cpu.avatarKey,'highstakes');
cpuRoom.start(cpuRoom.players[0].id);assert.equal(cpuRoom.players.length,2);assert.equal(cpuRoom.players[1].isBot,true);
const botHand=[c('joint',8,'b1'),c('leaf',8,'b2'),c('bong',8,'b3'),c('lighter',13,'b4')];
const botDiscard=bestBotDiscard(botHand,5);assert.equal(botDiscard.card.id,'b4');assert.equal(botDiscard.penalty,0);
assert.equal(chooseBotDrawSource(botHand,j('cpu-joker'),5),'discard');
const stepRoom=new GameRoom('CPU70','hs','Human','ht');const stepCpu=stepRoom.addComputerPlayer();stepRoom.started=true;stepRoom.roundRank=5;stepRoom.turnIndex=1;stepRoom.turnStage='draw';stepCpu.hand=[c('joint',8,'s1'),c('leaf',8,'s2'),c('lighter',13,'s4')];stepRoom.drawPile=[c('bong',4,'deck1')];stepRoom.discardPile=[c('bong',8,'s3')];
let cpuAction=stepRoom.computerStep();assert.equal(cpuAction.stage,'draw');assert.equal(cpuAction.source,'discard');assert.equal(stepRoom.turnStage,'discard');
cpuAction=stepRoom.computerStep();assert.equal(cpuAction.stage,'goOut');assert.equal(stepRoom.outPlayerId,stepCpu.id);assert.equal(stepRoom.roundEnding,true);
cpuRoom.started=false;cpuRoom.turnStage='gameover';cpuRoom.players[0].score=42;cpuRoom.players[1].score=18;cpuRoom.winnerIds=[cpuRoom.players[1].id];
const cpuSnap=cpuRoom.leaderboardSnapshot();assert.equal(cpuSnap.participants.length,1);assert.equal(cpuSnap.participants[0].name,'Human');assert.equal(cpuSnap.winnerProfileIds.length,0);
console.log('computer player tests passed');

// Leaderboard snapshots include stable profile IDs and record winners once.
const fs=require('fs'),os=require('os'),path=require('path');
const {LeaderboardStore}=require('./leaderboardStore');
const lbFile=path.join(os.tmpdir(),`five-tokes-lb-${Date.now()}.json`);
const lr=new GameRoom('LB123','s1','Champ','tok1','kingkush','profile_champ_12345');const loser=lr.addPlayer('s2','Runner Up','tok2','maryjane','profile_runner_12345');
lr.start(lr.players[0].id);lr.players[0].score=18;lr.players[1].score=44;lr.started=false;lr.turnStage='gameover';lr.winnerIds=[lr.players[0].id];
const snap=lr.leaderboardSnapshot();assert.equal(snap.winnerProfileIds[0],'profile_champ_12345');assert.equal(snap.participants.length,2);
const store=new LeaderboardStore(lbFile);assert.equal(store.recordGame(snap),true);assert.equal(store.recordGame(snap),false);const rows=store.entries();assert.equal(rows[0].name,'Champ');assert.equal(rows[0].wins,1);assert.equal(rows[0].goldenNuggets,1);assert.equal(rows[0].bestScore,18);try{fs.unlinkSync(lbFile)}catch{}
console.log('leaderboard tests passed');

// v0.7.4: final-turn melds are revealed, score announcements are published, and submitted stashes determine final-turn penalty.
const reveal=new GameRoom('REV74','s1','Out Player','t1');const revealP2=reveal.addPlayer('s2','Final Player','t2');
reveal.started=true;reveal.roundRank=7;reveal.turnIndex=1;reveal.turnStage='discard';reveal.roundEnding=true;reveal.outPlayerId=reveal.players[0].id;reveal.players[0].finalDone=true;
reveal.players[1].hand=[c('joint',9,'rv1'),c('leaf',9,'rv2'),c('bong',9,'rv3'),c('lighter',4,'rv4'),c('joint',6,'rv5')];reveal.drawPile=[c('leaf',3,'rvd')];reveal.discardPile=[c('bong',6,'rvt')];
reveal.discard(revealP2.id,{cardId:'rv5',melds:[['rv1','rv2','rv3']]});
assert.equal(reveal.revealedMelds.length,1);assert.equal(reveal.revealedMelds[0].melds.length,1);assert.equal(reveal.revealedMelds[0].points,4);assert.equal(reveal.lastScoreAnnouncement.points,4);assert.equal(revealP2.score,4);

// v0.7.4: an undo can be requested after a turn-ending move, requires next-player approval, and restores the prior turn state.
const undoRoom=new GameRoom('UND74','s1','First','t1');const undoP2=undoRoom.addPlayer('s2','Second','t2');undoRoom.started=true;undoRoom.roundRank=5;undoRoom.turnIndex=0;undoRoom.turnStage='discard';undoRoom.players[0].hand=[c('joint',4,'u1'),c('leaf',6,'u2')];undoRoom.players[1].hand=[c('bong',7,'u3')];undoRoom.drawPile=[c('lighter',8,'ud')];undoRoom.discardPile=[c('grinder',3,'ut')];
const firstId=undoRoom.players[0].id;undoRoom.discard(firstId,'u2');assert.equal(undoRoom.currentPlayer().id,undoP2.id);assert.equal(undoRoom.stateFor(firstId).undo.canRequest,true);undoRoom.requestUndo(firstId);assert.equal(undoRoom.stateFor(undoP2.id).undo.canRespond,true);undoRoom.respondUndo(undoP2.id,true);assert.equal(undoRoom.currentPlayer().id,firstId);assert.equal(undoRoom.turnStage,'discard');assert(undoRoom.players[0].hand.some(x=>x.id==='u2'));assert.equal(undoRoom.discardPile[undoRoom.discardPile.length-1].id,'ut');

// Drawing closes the undo window; denied/expired requests leave the next player's turn intact.
const closeRoom=new GameRoom('CLS74','s1','First','t1');const closeP2=closeRoom.addPlayer('s2','Second','t2');closeRoom.started=true;closeRoom.roundRank=5;closeRoom.turnIndex=0;closeRoom.turnStage='discard';closeRoom.players[0].hand=[c('joint',4,'c1')];closeRoom.players[1].hand=[c('bong',7,'c2')];closeRoom.drawPile=[c('lighter',8,'cd')];closeRoom.discardPile=[c('grinder',3,'ct')];const closeFirst=closeRoom.players[0].id;closeRoom.discard(closeFirst,'c1');closeRoom.draw(closeP2.id,'deck');assert.equal(closeRoom.stateFor(closeFirst).undo,null);assert.throws(()=>closeRoom.requestUndo(closeFirst),/undo window/i);

const denyRoom=new GameRoom('DEN74','s1','First','t1');const denyP2=denyRoom.addPlayer('s2','Second','t2');denyRoom.started=true;denyRoom.roundRank=5;denyRoom.turnIndex=0;denyRoom.turnStage='discard';denyRoom.players[0].hand=[c('joint',4,'d1')];denyRoom.players[1].hand=[c('bong',7,'d2')];denyRoom.drawPile=[c('lighter',8,'dd')];denyRoom.discardPile=[c('grinder',3,'dt')];const denyFirst=denyRoom.players[0].id;denyRoom.discard(denyFirst,'d1');denyRoom.requestUndo(denyFirst);denyRoom.respondUndo(denyP2.id,false);assert.equal(denyRoom.currentPlayer().id,denyP2.id);assert.equal(denyRoom.turnStage,'draw');assert.equal(denyRoom.pendingUndo,null);
console.log('v0.7.4 reveal, scoring, and undo tests passed');
