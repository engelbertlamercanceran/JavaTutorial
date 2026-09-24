const missions = [
  {title:"Syntax Sprout",trainer:"Little Syntax",stars:1,quote:"Hehe… my code is perfect!",hacko:"Tignan nga natin…",code:'System.out.println("Welcome to the Debugging Gym"',prompt:"What completes the statement?",choices:[');',')',';'],answer:0,lesson:"A method call needs a closing parenthesis, then a semicolon."},
  {title:"Bracket Bunny",trainer:"Bracket Bunny",stars:1,quote:"My brackets are hopping perfectly!",hacko:"Sigurado ka ba?",code:'if (true) {\n    System.out.println("Open");\n\n}',prompt:"Which symbol closes the if block?",choices:['}',')',']'],answer:0,lesson:"Curly braces must be balanced: every { needs a }."},
  {title:"Variable Viper",trainer:"Variable Viper",stars:2,quote:"You can’t find what was never declared…",hacko:"Challenge accepted.",code:'score = 100;\nSystem.out.println(score);',prompt:"How should score be declared?",choices:['int score = 100;','score int = 100;','new score = 100;'],answer:0,lesson:"Declare a variable with its type before using it."},
  {title:"Loop Lizard",trainer:"Loop Lizard",stars:2,quote:"This loop will run forever… or will it?",hacko:"Hindi ako papayag.",code:'for (int i = 0; i < 5; i--) {\n    System.out.println(i);\n}',prompt:"Which update lets the loop finish?",choices:['i++','i--','i = 0'],answer:0,lesson:"i must increase to eventually reach 5."},
  {title:"Condition Cobra",trainer:"Condition Cobra",stars:3,quote:"One wrong condition and everything collapses.",hacko:"Let’s fix that logic.",code:'int key = 1;\nif (key = 1) {\n    System.out.println("Door opened");\n}',prompt:"Which operator compares the values?",choices:['==','=','!='],answer:0,lesson:"= assigns a value; == compares two values."},
  {title:"Null Ninja",trainer:"Null Ninja",stars:3,quote:"You cannot call methods on nothingness…",hacko:"NullPointerException, huh?",code:'String name = null;\nSystem.out.println(name.length());',prompt:"Choose the safest beginner fix.",choices:['String name = "Hacko";','name.length = 5;','String name;'],answer:0,lesson:"A method cannot be called on a null reference."},
  {title:"Array Alligator",trainer:"Array Alligator",stars:4,quote:"Index out of bounds… delicious.",hacko:"Hindi ako kakagat.",code:'int[] arr = {10, 20, 30};\nSystem.out.println(arr[3]);',prompt:"Which index gets the final item?",choices:['arr[2]','arr[3]','arr[-1]'],answer:0,lesson:"Arrays start at index 0, so three items use indexes 0–2."},
  {title:"Method Mantis",trainer:"Method Mantis",stars:4,quote:"Wrong method call… strike!",hacko:"I’ll call it correctly.",code:'void greet(String name) { ... }\n\ngreet();',prompt:"Which call matches the method?",choices:['greet("Hacko");','greet;','greet(10);'],answer:0,lesson:"The call must supply the required String argument."},
  {title:"Multi-Bug Mantle",trainer:"Multi-Bug Mantle",stars:5,quote:"Three bugs in one… can you find them all?",hacko:"Dalhin mo ’yan.",code:'for (int i = 0; i <= nums.length; i++) {\n    total += nums[i];\n}\nSystem.out.println("Total: " + total)',prompt:"Choose the complete repair.",choices:['Use i < nums.length and add ;','Use i > nums.length','Only add ;'],answer:0,lesson:"Stay inside the array bounds and end println with a semicolon."},
  {title:"Error Master Vex",trainer:"GYM LEADER · VEX",stars:6,quote:"You fixed nine weaklings… but can you fix perfection itself?",hacko:"Wala nang perfect code… pero may fixed code.",code:'String title = null;\nfor (int i = 0; i <= data.length; i++) {\n    sum += data[i];\n}\nif (sum = 10) {\n    System.out.println(title.toUpperCase());\n}',prompt:"Which patch defeats all three bugs?",choices:['title = "Victory"; i < data.length; sum == 10','title = null; i < data.length; sum = 10','title = "Victory"; i <= data.length; sum == 10'],answer:0,lesson:"You fixed null, array bounds, and comparison logic. Gym cleared!"}
];

/* frontier is the next trainer Hacko has not beaten. Everyone before
   it is a defeated trainer standing beside the gym path; the gym map
   (gym.js) starts a duel when Hacko walks in front of a trainer. */
let current=0, frontier=0, lives=3, selected=null, result=null;
let completed=Array(10).fill(false);
const $=id=>document.getElementById(id);

function setMode(mode){document.body.dataset.mode=mode}

function render(){
  const chip=$('round-chip'); if(chip) chip.textContent=Math.min(10,frontier+1);

  const m=missions[current], progress=completed.filter(Boolean).length*10;
  $('lives').textContent=lives; $('xp').textContent=completed.filter(Boolean).length*100;
  $('progress-bar').style.width=progress+'%'; $('progress-text').textContent=progress+'%';
  $('mission-no').textContent=`MISSION ${String(current+1).padStart(2,'0')} / 10`;
  $('avatar-letter').textContent=current===9?'V':m.trainer.charAt(0);
  $('trainer-name').textContent=m.trainer; $('mission-title').textContent=m.title;
  $('stars').innerHTML='★'.repeat(m.stars)+`<i>${'★'.repeat(6-m.stars)}</i>`;
  $('trainer-quote').textContent=`“${m.quote}”`; $('hacko-quote').textContent=`HACKO: “${m.hacko}”`;
  $('buggy-code').textContent=m.code; $('prompt').textContent=m.prompt;
  $('battle').classList.toggle('boss',current===9);
  $('game-arena').classList.toggle('boss-arena',current===9);
  $('round-number').textContent=String(current+1).padStart(2,'0');
  $('enemy-hud-name').textContent=m.trainer.toUpperCase(); $('enemy-plate').textContent=m.trainer.toUpperCase();
  $('enemy-fighter').style.setProperty('--enemy-hue',`${(current*39+8)%360}`);
  $('hero-hp').style.width=`${Math.max(0,lives/3*100)}%`;
  $('enemy-hp').style.width=result==='win'?'0%':'100%';
  $('choices').innerHTML='';
  m.choices.forEach((choice,i)=>{
    const button=document.createElement('button');
    button.innerHTML=`<span>${String.fromCharCode(65+i)}</span><code></code>`;
    button.querySelector('code').textContent=choice;
    if(selected===i) button.classList.add('selected');
    if(result && i===m.answer) button.classList.add('correct');
    if(result==='lose' && selected===i) button.classList.add('wrong');
    button.onclick=()=>{if(result==='win')return;HackoAudio.play('select');selected=i;result=null;render()};
    $('choices').appendChild(button);
  });
  const feedback=$('feedback'); feedback.className=`feedback ${result||''}`;
  feedback.querySelector('span').textContent=result==='win'?'✓':result==='lose'?'×':'?';
  feedback.querySelector('p').textContent=result==='win'?m.lesson:result==='lose'?'That patch still throws an error. Trace the highlighted line and try again.':'Choose the patch that makes the Java program compile and behave correctly.';
  $('submit').disabled=selected===null||result==='win'; $('submit').innerHTML=result==='win'?'BUG DEFEATED':'RUN PATCH <span>→</span>';
  $('next').classList.toggle('hidden',result!=='win');
  $('next').textContent=current===9?'LEAVE THE GYM →':'BACK TO THE GYM →';
  $('victory').classList.toggle('hidden',!completed[9]);
}

/* called by the gym map when Hacko walks in front of trainer i */
function startBattle(i){
  current=i;selected=null;result=null;lives=3;
  $('hero-fighter').classList.remove('walk','attack','hit');
  $('enemy-fighter').classList.remove('hit','enemy-attack');
  $('battle-message').textContent=`${missions[i].trainer} wants to duel!`;
  setMode('battle');render();
  window.scrollTo({top:$('game-arena').offsetTop-90,behavior:'smooth'});
}

function backToGym(){
  HackoAudio.play('select');
  setMode('map');
  Gym.returnFromBattle({won:true,k:current});
  result=null;selected=null;render();
  window.scrollTo({top:0,behavior:'smooth'});
}

function submit(){
  if(selected===null||result==='win') return;
  if(selected===missions[current].answer){completed[current]=true;frontier=Math.max(frontier,current+1);result='win';if(window.HackoStore){HackoStore.completeLevel(7,current,100)}playAttack()}
  else{result='lose';playDamage();loseLife();return}
  render();
}
function playAttack(){HackoAudio.play('correct');const h=$('hero-fighter'),e=$('enemy-fighter'),i=$('impact');h.classList.remove('attack');e.classList.remove('hit');void h.offsetWidth;h.classList.add('attack');setTimeout(()=>{e.classList.add('hit');i.classList.add('show');$('enemy-hp').style.width='0%';$('battle-message').textContent='Critical patch! Bug defeated.'},280);setTimeout(()=>i.classList.remove('show'),850)}
function playDamage(){HackoAudio.play('hit');const h=$('hero-fighter'),e=$('enemy-fighter');e.classList.remove('enemy-attack');h.classList.remove('hit');void e.offsetWidth;e.classList.add('enemy-attack');setTimeout(()=>{h.classList.add('hit');$('battle-message').textContent='The bug struck back! Try another patch.'},280);setTimeout(()=>h.classList.remove('hit'),900)}

/* Three lives, and losing them drops back one duel - the rule
   every other mission follows. In the gym that means the previous
   trainer steps back onto the path and Hacko is sent back to them. */
function loseLife(){
  lives--;
  if(lives>0){HackoAudio.play('wrong');render();return}
  lives=3;
  const back=window.HackoStore?HackoStore.loseAllLives(7,current):Math.max(0,current-1);
  frontier=Math.min(frontier,back);
  HackoAudio.play('gameover');
  $('battle-message').textContent='Hacko is out of lives!';
  setTimeout(()=>{
    selected=null;result=null;setMode('map');
    Gym.returnFromBattle({won:false,k:current,back});
    render();window.scrollTo({top:0,behavior:'smooth'});
  },1200);
}

function reset(){HackoAudio.play('select');current=0;frontier=0;lives=3;selected=null;result=null;completed=Array(10).fill(false);Gym.reset();setMode('map');render()}
$('submit').onclick=submit; $('next').onclick=backToGym; $('reset').onclick=reset; $('play-again').onclick=reset;

setMode('map');
Gym.init({
  canvas:$('gym-canvas'),dialog:$('gym-dialog'),text:$('gym-text'),
  trainers:missions,getFrontier:()=>frontier,onBattle:startBattle
});
render();

/* ===== SOUND LAYER =====
   Background track plus the shared SOUND ON/OFF button. Audio cannot
   start until the player interacts, so this only requests the track. */
(function () {
    if (!window.HackoAudio) { return; }
    function begin() {
        HackoAudio.music.play("gym");
        HackoAudio.mountToggle(document.body);
    }
    if (document.readyState === "complete") { begin(); }
    else { window.addEventListener("load", begin); }
}());



/* ===== RESUME + AUTOSAVE =====
   Coming back puts Hacko in front of the trainer they had reached,
   with everyone before them already beaten. */
(function () {
    if (!window.HackoStore || !HackoStore.isLoggedIn()) { return; }

    HackoStore.registerTotalLevels(7, 10);

    function goToSavedLevel() {
        var done = HackoStore.mission(7).levelsDone || [];
        done.forEach(function (i) { completed[i] = true; });
        frontier = done.length >= 10
            ? 10
            : Math.min(HackoStore.getResumeLevel(7), done.length);
        Gym.placeAt(frontier);
        try { render(); } catch (e) {}
    }

    if (document.readyState === "complete") { goToSavedLevel(); }
    else { window.addEventListener("load", goToSavedLevel); }

    HackoStore.bindAutosave(function () {
        return { mission: 7, level: Math.min(frontier, 9), lives: lives };
    });
}());
