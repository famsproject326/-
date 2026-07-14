// Web Audio API
let soundEnabled = true;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();
function playTone(freq, type, duration, vol=0.1) {
    if (!soundEnabled) return;
    try {
        if (audioCtx.state === 'suspended') audioCtx.resume();
        const osc = audioCtx.createOscillator();
        const gain = audioCtx.createGain();
        osc.type = type;
        osc.frequency.setValueAtTime(freq, audioCtx.currentTime);
        gain.gain.setValueAtTime(vol, audioCtx.currentTime);
        gain.gain.exponentialRampToValueAtTime(0.0001, audioCtx.currentTime + duration);
        osc.connect(gain);
        gain.connect(audioCtx.destination);
        osc.start();
        osc.stop(audioCtx.currentTime + duration);
    } catch (e) {}
}
function playChopSound() { playTone(120, 'square', 0.1, 0.15); }
function playCoinSound() { playTone(523.25, 'sine', 0.08, 0.1); setTimeout(() => playTone(659.25, 'sine', 0.15, 0.1), 80); }
function playHuntSound() { playTone(80, 'triangle', 0.15, 0.25); }
function playCookSound() { playTone(300, 'sawtooth', 0.05, 0.05); }
function playExpandSound() {
    playTone(261.63, 'sine', 0.1, 0.1);
    setTimeout(() => playTone(329.63, 'sine', 0.1, 0.1), 100);
    setTimeout(() => playTone(392.00, 'sine', 0.1, 0.1), 200);
    setTimeout(() => playTone(523.25, 'sine', 0.3, 0.15), 300);
}
function toggleSound() {
    soundEnabled = !soundEnabled;
    document.querySelector('.sound-btn').innerText = soundEnabled ? "🔊 音声: ON" : "🔇 音声: OFF";
}

const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");
function resizeCanvas() { canvas.width = window.innerWidth; canvas.height = window.innerHeight; }
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

const player = { x: 200, y: 200, radius: 18, speed: 3.5, vx: 0, vy: 0, wood: 0, maxWood: 20, meat: 0, cookedMeat: 0, maxMeat: 10, gold: 10, angle: 0, isMoving: false };
let territoryRadius = 250;
let expandCost = 30;
let trees = [];
let beasts = [];
let campfires = [];
let particles = [];
const woodSellZone = { x: 120, y: 120, radius: 45, label: "木材売却所" };
const meatSellZone = { x: 280, y: 120, radius: 45, label: "肉売却所" };
const expandZone = { x: 200, y: 280, radius: 50, label: "領地拡大" };

function spawnTree(inInitial=false) {
    const angle = Math.random() * Math.PI * 2;
    const dist = (0.2 + Math.random() * 0.7) * territoryRadius;
    const x = 200 + Math.cos(angle) * dist;
    const y = 200 + Math.sin(angle) * dist;
    if (Math.hypot(x - 200, y - 200) < 90) { spawnTree(inInitial); return; }
    trees.push({ x: x, y: y, hp: 100, maxHp: 100, radius: 16, regenTime: 0 });
}
function spawnBeast() {
    const angle = Math.random() * Math.PI * 2;
    const dist = (0.4 + Math.random() * 0.5) * territoryRadius;
    beasts.push({ x: 200 + Math.cos(angle) * dist, y: 200 + Math.sin(angle) * dist, radius: 14, hp: 50, maxHp: 50, speed: 0.8, vx: (Math.random() - 0.5) * 2, vy: (Math.random() - 0.5) * 2, state: 'idle', stateTimer: 0 });
}

for (let i = 0; i < 8; i++) spawnTree(true);
for (let i = 0; i < 3; i++) spawnBeast();
campfires.push({ x: 200, y: 120, radius: 30, isCooking: false });

function createParticle(x, y, color, count=5) {
    for (let i = 0; i < count; i++) {
        particles.push({ x: x, y: y, vx: (Math.random() - 0.5) * 4, vy: (Math.random() - 0.5) * 4 - 2, radius: Math.random() * 3 + 2, color: color, alpha: 1, life: 30 });
    }
}
let floatingTexts = [];
function createFloatingText(x, y, text, color="#fff") {
    floatingTexts.push({ x: x, y: y, text: text, color: color, vy: -1, alpha: 1, life: 45 });
}

const joystickContainer = document.getElementById("joystick-container");
const joystickKnob = document.getElementById("joystick-knob");
let joystickActive = false;
let joystickStart = { x: 0, y: 0 };
let joystickVector = { x: 0, y: 0 };
joystickContainer.style.display = "none";
joystickContainer.style.position = "absolute";

window.addEventListener("touchstart", e => {
    const touchX = e.touches[0].clientX;
    if (touchX < window.innerWidth / 2) {
        const touchY = e.touches[0].clientY;
        joystickActive = true;
        joystickStart = { x: touchX, y: touchY };
        joystickContainer.style.left = `${touchX - 55}px`;
        joystickContainer.style.top = `${touchY - 55}px`;
        joystickContainer.style.display = "flex";
        const tutorial = document.getElementById("tutorial");
        if (tutorial) tutorial.style.display = "none";
    }
}, { passive: false });

window.addEventListener("touchmove", e => {
    if (!joystickActive) return;
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    const dx = clientX - joystickStart.x;
    const dy = clientY - joystickStart.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = 45;
    const angle = Math.atan2(dy, dx);
    const intensity = Math.min(dist, maxDist) / maxDist;
    joystickVector = { x: Math.cos(angle) * intensity, y: Math.sin(angle) * intensity };
    joystickKnob.style.transform = `translate(${Math.cos(angle) * Math.min(dist, maxDist)}px, ${Math.sin(angle) * Math.min(dist, maxDist)}px)`;
    e.preventDefault();
}, { passive: false });

window.addEventListener("touchend", () => {
    joystickActive = false;
    joystickVector = { x: 0, y: 0 };
    joystickKnob.style.transform = "translate(0px, 0px)";
    joystickContainer.style.display = "none";
});

let lastTime = 0;
let actionTimer = 0;
function update(time) {
    const dt = time - lastTime;
    lastTime = time;
    if (joystickActive) {
        player.vx = joystickVector.x * player.speed;
        player.vy = joystickVector.y * player.speed;
        player.isMoving = true;
        player.angle = Math.atan2(joystickVector.y, joystickVector.x);
    } else {
        player.vx *= 0.8;
        player.vy *= 0.8;
        player.isMoving = false;
    }
    player.x += player.vx;
    player.y += player.vy;
    const distFromCenter = Math.hypot(player.x - 200, player.y - 200);
    if (distFromCenter > territoryRadius - player.radius) {
        const angle = Math.atan2(player.y - 200, player.x - 200);
        player.x = 200 + Math.cos(angle) * (territoryRadius - player.radius);
        player.y = 200 + Math.sin(angle) * (territoryRadius - player.radius);
    }
    actionTimer += dt;
    if (actionTimer > 350) {
        actionTimer = 0;
        trees.forEach(tree => {
            if (tree.hp > 0 && Math.hypot(player.x - tree.x, player.y - tree.y) < tree.radius + player.radius + 15) {
                if (player.wood < player.maxWood) {
                    tree.hp -= 25; playChopSound(); createParticle(tree.x, tree.y - 10, "#8b5a2b", 4);
                    if (tree.hp <= 0) { player.wood++; createFloatingText(tree.x, tree.y, "+1 木材", "#deb887"); tree.regenTime = Date.now() + 8000; }
                }
            }
        });
        beasts.forEach(beast => {
            if (beast.hp > 0 && Math.hypot(player.x - beast.x, player.y - beast.y) < beast.radius + player.radius + 20) {
                if (player.meat < player.maxMeat) {
                    beast.hp -= 25; playHuntSound(); createParticle(beast.x, beast.y, "#ff0000", 6);
                    if (beast.hp <= 0) { player.meat++; createFloatingText(beast.x, beast.y, "+1 生肉", "#ff6347"); setTimeout(() => { beasts = beasts.filter(b => b !== beast); spawnBeast(); }, 6000); }
                }
            }
        });
        if (Math.hypot(player.x - woodSellZone.x, player.y - woodSellZone.y) < woodSellZone.radius + player.radius && player.wood > 0) { player.gold += player.wood * 2; player.wood = 0; playCoinSound(); }
        if (Math.hypot(player.x - meatSellZone.x, player.y - meatSellZone.y) < meatSellZone.radius + player.radius && player.cookedMeat > 0) { player.gold += player.cookedMeat * 10; player.cookedMeat = 0; playCoinSound(); }
        if (Math.hypot(player.x - expandZone.x, player.y - expandZone.y) < expandZone.radius + player.radius && player.gold >= expandCost) {
            player.gold -= expandCost; territoryRadius += 80; expandCost = Math.floor(expandCost * 1.8); playExpandSound(); for (let i = 0; i < 4; i++) spawnTree();
        }
        campfires.forEach(camp => {
            if (Math.hypot(player.x - camp.x, player.y - camp.y) < camp.radius + player.radius + 10 && player.meat > 0) {
                player.meat--; createFloatingText(camp.x, camp.y, "ジュージュー...", "#ffa500"); playCookSound();
                setTimeout(() => { player.cookedMeat++; createFloatingText(player.x, player.y, "🍖 焼き！", "#ff4500"); }, 1500);
            }
        });
    }
    document.getElementById("ui-gold").innerText = player.gold;
    document.getElementById("ui-wood").innerText = `${player.wood}/${player.maxWood}`;
    document.getElementById("ui-meat").innerText = `${player.meat} (🍖${player.cookedMeat})/${player.maxMeat}`;
    render();
    requestAnimationFrame(update);
}
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save(); ctx.translate(canvas.width/2 - player.x, canvas.height/2 - player.y);
    ctx.beginPath(); ctx.arc(200, 200, territoryRadius, 0, Math.PI * 2); ctx.fillStyle = "#3e5c2e"; ctx.fill(); ctx.stroke();
    trees.forEach(t => { if(t.hp > 0) { ctx.fillStyle="#1e4d2b"; ctx.beginPath(); ctx.arc(t.x, t.y, t.radius, 0, Math.PI*2); ctx.fill(); } });
    ctx.fillStyle = "#008080"; ctx.beginPath(); ctx.arc(player.x, player.y, player.radius, 0, Math.PI * 2); ctx.fill();
    ctx.restore();
}
requestAnimationFrame(update);
