const assert=require('assert');
const {createDeck,validBook,validRun,findPartitionAll,canPartitionAll,goOutDiscardIds,minimumRemainingScore,validateMeldLayout,GameRoom}=require('./game');
const deck=createDeck();assert.equal(deck.length,116);
const c=(s,r,id=`${s}${r}`)=>({id,suit:s,rank:r,joker:false});const j=id=>({id,joker:true,suit:null,rank:null});
assert(validBook([c('joint',9,'a'),c('leaf',9,'b'),j('j')],5));
assert(validRun([c('bong',4,'a'),c('bong',5,'b'),j('j'),c('bong',7,'c')],3));
const hand=[c('joint',8,'a'),c('leaf',8,'b'),c('bong',8,'c'),c('joint',3,'d')];
assert(canPartitionAll(hand.slice(0,3),5));assert(findPartitionAll(hand.slice(0,3),5));assert.deepEqual(goOutDiscardIds(hand,5),['d']);assert.equal(minimumRemainingScore(hand,5),3);assert(validateMeldLayout(hand,'d',[['a','b','c']],5));
// Server exposes Go Out only in the discard stage and can auto-build a legal reveal layout.
const g=new GameRoom('OUT42','s1','One','t1');g.addPlayer('s2','Two','t2');g.started=true;g.roundRank=5;g.turnIndex=0;g.turnStage='discard';g.players[0].hand=hand.map(x=>({...x}));g.players[1].hand=[c('leaf',4,'z')];g.drawPile=[c('leaf',10,'draw')];g.discardPile=[c('bong',6,'top')];
let st=g.stateFor(g.players[0].id);assert.equal(st.canGoOut,true);assert.deepEqual(st.goOutDiscardIds,['d']);g.goOut(g.players[0].id,'d',[['a']]);assert.equal(g.roundEnding,true);assert.equal(g.outMelds.length,1);assert.equal(g.outMelds[0].length,3);
// Forfeit should end a two-player game and allow the winner to leave afterward.
const r=new GameRoom('ABCDE','s1','One','t1');const p2=r.addPlayer('s2','Two','t2');r.start(r.players[0].id);r.forfeit(p2.id);assert.equal(r.started,false);assert.equal(r.winnerIds.length,1);assert.equal(r.leave(r.players[0].id),true);

// Avatars are stored with player state and hand order can be rearranged without changing cards.
const aroom=new GameRoom('AV666','s1','Royal Roller','tok1','grinderqueen');const ap2=aroom.addPlayer('s2','Cloud King','tok2','bonglord');
assert.equal(aroom.stateFor(aroom.players[0].id).you.avatarKey,'grinderqueen');assert.equal(aroom.stateFor(aroom.players[0].id).players[1].avatarKey,'bonglord');
aroom.players[0].hand=[c('joint',3,'r1'),c('leaf',9,'r2'),c('bong',5,'r3')];aroom.reorderHand(aroom.players[0].id,['r2','r3','r1']);assert.deepEqual(aroom.players[0].hand.map(x=>x.id),['r2','r3','r1']);
console.log('all game tests passed');
