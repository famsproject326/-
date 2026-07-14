// Web Audio APIによる効果音の生成
let soundEnabled = true;
const audioCtx = new (window.AudioContext || window.webkitAudioContext)();

function playTone(freq, type, duration, vol=0.1) {
    if (!soundEnabled) return;
    try {
        if (audioCtx.state === 'suspended') {
            audioCtx.resume();
        }
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
function playCoinSound() { 
    playTone(523.25, 'sine', 0.08, 0.1); 
    setTimeout(() => playTone(659.25, 'sine', 0.15, 0.1), 80);
}
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

// --- キャンバスとゲーム変数 ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

// 画面サイズ自動調整
function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeCanvas);
resizeCanvas();

// ゲームステート
const player = {
    x: 200,
    y: 200,
    radius: 18,
    speed: 3.5,
    vx: 0,
    vy: 0,
    wood: 0,
    maxWood: 20,
    meat: 0, // 生肉
    cookedMeat: 0, // 焼いた肉
    maxMeat: 10,
    gold: 10, // 初期ゴールド
    angle: 0,
    isMoving: false
};

// 開拓レベル（陣地の大きさ）
let territoryRadius = 250;
let expandCost = 30;

// ゲーム内オブジェクト
let trees = [];
let beasts = [];
let campfires = [];
let particles = [];

// 固定エリア定義
const woodSellZone = { x: 120, y: 120, radius: 45, label: "木材売却所" };
const meatSellZone = { x: 280, y: 120, radius: 45, label: "肉売却所" };
const expandZone = { x: 200, y: 280, radius: 50, label: "領地拡大" };

// 木の生成（ランダム配置を強化）
function spawnTree(inInitial=false) {
    // 領地内ならどこでも生えるように、角度と距離を完全にランダム化
    const angle = Math.random() * Math.PI * 2;
    // 領地の半径の 0.2 ～ 0.9 倍の範囲にランダムで生成
    const dist = (0.2 + Math.random() * 0.7) * territoryRadius;
    
    const x = 200 + Math.cos(angle) * dist;
    const y = 200 + Math.sin(angle) * dist;
    
    // スタート地点（たき火やプレイヤー初期位置）付近には生やさない安全措置
    if (Math.hypot(x - 200, y - 200) < 90) {
        // もし中心近くだったら、もう一度やり直す（再帰）
        spawnTree(inInitial);
        return;
    }
    
    trees.push({
        x: x,
        y: y,
        hp: 100,
        maxHp: 100,
        radius: 16,
        regenTime: 0
    });
}


// 獣（イノシシ）の生成
function spawnBeast() {
    const angle = Math.random() * Math.PI * 2;
    const dist = (0.4 + Math.random() * 0.5) * territoryRadius;
    beasts.push({
        x: 200 + Math.cos(angle) * dist,
        y: 200 + Math.sin(angle) * dist,
        radius: 14,
        hp: 50,
        maxHp: 50,
        speed: 0.8,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
        state: 'idle', // idle, flee
        stateTimer: 0
    });
}

// 初期オブジェクト配置
for (let i = 0; i < 8; i++) spawnTree(true);
for (let i = 0; i < 3; i++) spawnBeast();
campfires.push({ x: 200, y: 120, radius: 30, cookingProgress: 0, isCooking: false });

// エフェクトパーティクル
function createParticle(x, y, color, count=5) {
    for (let i = 0; i < count; i++) {
        particles.push({
            x: x,
            y: y,
            vx: (Math.random() - 0.5) * 4,
            vy: (Math.random() - 0.5) * 4 - 2,
            radius: Math.random() * 3 + 2,
            color: color,
            alpha: 1,
            life: 30
        });
    }
}

// フローティングテキスト
let floatingTexts = [];
function createFloatingText(x, y, text, color="#fff") {
    floatingTexts.push({
        x: x,
        y: y,
        text: text,
        color: color,
        vy: -1,
        alpha: 1,
        life: 45
    });
}

// --- 操作系（タッチ位置に出てくる可変ジョイスティック仕様） ---
const keys = {};
window.addEventListener("keydown", e => keys[e.key] = true);
window.addEventListener("keyup", e => keys[e.key] = false);

// ジョイスティックシステム
const joystickContainer = document.getElementById("joystick-container");
const joystickKnob = document.getElementById("joystick-knob");
let joystickActive = false;
let joystickStart = { x: 0, y: 0 };
let joystickVector = { x: 0, y: 0 };

// 初期状態では非表示にしておく
joystickContainer.style.display = "none";
joystickContainer.style.position = "absolute";

// 画面全体のタッチ開始イベント
window.addEventListener("touchstart", e => {
    // 画面の左半分をタッチしたときだけジョイスティックを出現させる
    const touchX = e.touches[0].clientX;
    if (touchX < window.innerWidth / 2) {
        const touchY = e.touches[0].clientY;
        
        joystickActive = true;
        joystickStart = { x: touchX, y: touchY };
        
        // ジョイスティックの真ん中が指の真下に来るように配置して表示
        joystickContainer.style.left = `${touchX - 55}px`; // 110pxの半分
        joystickContainer.style.top = `${touchY - 55}px`;
        joystickContainer.style.display = "flex";
        
        // チュートリアル表示を消去
        const tutorial = document.getElementById("tutorial");
        if (tutorial) tutorial.style.display = "none";
    }
}, { passive: false });

// タッチ中の移動イベント
window.addEventListener("touchmove", e => {
    if (!joystickActive) return;
    
    const clientX = e.touches[0].clientX;
    const clientY = e.touches[0].clientY;
    
    const dx = clientX - joystickStart.x;
    const dy = clientY - joystickStart.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = 45; // ノブの最大移動半径
    
    const angle = Math.atan2(dy, dx);
    const intensity = Math.min(dist, maxDist) / maxDist;
    
    joystickVector = {
        x: Math.cos(angle) * intensity,
        y: Math.sin(angle) * intensity
    };

    // ジョイスティックの内側の丸（ノブ）だけをスライド
    const moveX = Math.cos(angle) * Math.min(dist, maxDist);
    const moveY = Math.sin(angle) * Math.min(dist, maxDist);
    joystickKnob.style.transform = `translate(${moveX}px, ${moveY}px)`;
    
    // スマホブラウザ特有の画面引っ張りスクロールを防ぐ
    e.preventDefault();
}, { passive: false });

// 指を離したとき
window.addEventListener("touchend", () => {
    joystickActive = false;
    joystickVector = { x: 0, y: 0 };
    joystickKnob.style.transform = "translate(0px, 0px)";
    joystickContainer.style.display = "none"; // 指を離したら非表示に
});

// PC操作（マウスドラッグ）も可変ジョイスティック対応にする
let mouseDrag = false;
window.addEventListener("mousedown", e => {
    if (e.clientX < window.innerWidth / 2) {
        joystickActive = true;
        mouseDrag = true;
        joystickStart = { x: e.clientX, y: e.clientY };
        joystickContainer.style.left = `${e.clientX - 55}px`;
        joystickContainer.style.top = `${e.clientY - 55}px`;
        joystickContainer.style.display = "flex";
        
        const tutorial = document.getElementById("tutorial");
        if (tutorial) tutorial.style.display = "none";
    }
});
window.addEventListener("mousemove", e => {
    if (!mouseDrag) return;
    const dx = e.clientX - joystickStart.x;
    const dy = e.clientY - joystickStart.y;
    const dist = Math.hypot(dx, dy);
    const maxDist = 45;
    const angle = Math.atan2(dy, dx);
    const intensity = Math.min(dist, maxDist) / maxDist;
    
    joystickVector = {
        x: Math.cos(angle) * intensity,
        y: Math.sin(angle) * intensity
    };
    const moveX = Math.cos(angle) * Math.min(dist, maxDist);
    const moveY = Math.sin(angle) * Math.min(dist, maxDist);
    joystickKnob.style.transform = `translate(${moveX}px, ${moveY}px)`;
});
window.addEventListener("mouseup", () => {
    mouseDrag = false;
    joystickActive = false;
    joystickVector = { x: 0, y: 0 };
    joystickKnob.style.transform = "translate(0px, 0px)";
    joystickContainer.style.display = "none";
});

// --- ゲームループ & アップデート ---
let lastTime = 0;
let actionTimer = 0;

function update(time) {
    const dt = time - lastTime;
    lastTime = time;

    let mx = 0;
    let my = 0;

    if (keys["ArrowUp"] || keys["w"] || keys["W"]) my = -1;
    if (keys["ArrowDown"] || keys["s"] || keys["S"]) my = 1;
    if (keys["ArrowLeft"] || keys["a"] || keys["A"]) mx = -1;
    if (keys["ArrowRight"] || keys["d"] || keys["D"]) mx = 1;

    if (mx !== 0 || my !== 0) {
        const len = Math.hypot(mx, my);
        player.vx = (mx / len) * player.speed;
        player.vy = (my / len) * player.speed;
        player.isMoving = true;
        player.angle = Math.atan2(my, mx);
    } else if (joystickActive) {
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

        // 木の伐採
        trees.forEach(tree => {
            if (tree.hp > 0) {
                const dist = Math.hypot(player.x - tree.x, player.y - tree.y);
                if (dist < tree.radius + player.radius + 15) {
                    if (player.wood < player.maxWood) {
                        tree.hp -= 25;
                        playChopSound();
                        createParticle(tree.x, tree.y - 10, "#8b5a2b", 4);
                        if (tree.hp <= 0) {
                            player.wood = Math.min(player.maxWood, player.wood + 3);
                            createFloatingText(tree.x, tree.y, "+3 木材", "#deb887");
                            tree.regenTime = Date.now() + 8000;
                        } else {
                            createFloatingText(tree.x, tree.y, "ザクッ!", "#fff");
                        }
                    } else {
                        createFloatingText(player.x, player.y - 20, "木材がいっぱいや！", "#ffcc00");
                    }
                }
            }
        });

        // 狩り
        beasts.forEach(beast => {
            if (beast.hp > 0) {
                const dist = Math.hypot(player.x - beast.x, player.y - beast.y);
                if (dist < beast.radius + player.radius + 20) {
                    if (player.meat < player.maxMeat) {
                        beast.hp -= 25;
                        playHuntSound();
                        createParticle(beast.x, beast.y, "#ff0000", 6);
                        beast.state = 'flee';
                        beast.stateTimer = 5;
                        if (beast.hp <= 0) {
                            player.meat = Math.min(player.maxMeat, player.meat + 2);
                            createFloatingText(beast.x, beast.y, "+2 生肉", "#ff6347");
                            beast.hp = 0;
                            setTimeout(() => {
                                beasts = beasts.filter(b => b !== beast);
                                spawnBeast();
                            }, 6000);
                        } else {
                            createFloatingText(beast.x, beast.y, "ギャッ!", "#ff3333");
                        }
                    } else {
                        createFloatingText(player.x, player.y - 20, "肉がいっぱいや！", "#ffcc00");
                    }
                }
            }
        });

        // 売却
        const distToWoodSell = Math.hypot(player.x - woodSellZone.x, player.y - woodSellZone.y);
        if (distToWoodSell < woodSellZone.radius + player.radius) {
            if (player.wood > 0) {
                const earned = player.wood * 2;
                player.gold += earned;
                createFloatingText(woodSellZone.x, woodSellZone.y, `+${earned}🪙`, "#ffd700");
                createParticle(woodSellZone.x, woodSellZone.y, "#ffd700", 5);
                player.wood = 0;
                playCoinSound();
            }
        }

        const distToMeatSell = Math.hypot(player.x - meatSellZone.x, player.y - meatSellZone.y);
        if (distToMeatSell < meatSellZone.radius + player.radius) {
            if (player.cookedMeat > 0) {
                const earned = player.cookedMeat * 10;
                player.gold += earned;
                createFloatingText(meatSellZone.x, meatSellZone.y, `+${earned}🪙`, "#ffd700");
                createParticle(meatSellZone.x, meatSellZone.y, "#ffd700", 8);
                player.cookedMeat = 0;
                playCoinSound();
            } else if (player.meat > 0) {
                createFloatingText(player.x, player.y - 20, "肉はたき火で焼くと10倍で売れるで！", "#ffcc00");
            }
        }

        // 拡大
        const distToExpand = Math.hypot(player.x - expandZone.x, player.y - expandZone.y);
        if (distToExpand < expandZone.radius + player.radius) {
            if (player.gold >= expandCost) {
                player.gold -= expandCost;
                territoryRadius += 80;
                expandCost = Math.floor(expandCost * 1.8);
                playExpandSound();
                createFloatingText(expandZone.x, expandZone.y, "領地拡大！", "#00ffcc");
                createParticle(expandZone.x, expandZone.y, "#00ffcc", 15);
                for (let i = 0; i < 4; i++) spawnTree();
                spawnBeast();
            }
        }

        // たき火
        campfires.forEach(camp => {
            const dist = Math.hypot(player.x - camp.x, player.y - camp.y);
            if (dist < camp.radius + player.radius + 10) {
                if (player.meat > 0) {
                    camp.isCooking = true;
                    player.meat--;
                    createFloatingText(camp.x, camp.y, "ジュージュー...", "#ffa500");
                    playCookSound();
                    
                    setTimeout(() => {
                        player.cookedMeat++;
                        createFloatingText(player.x, player.y, "🍖 焼き肉 完成！", "#ff4500");
                        playTone(440, 'sine', 0.15, 0.08);
                        camp.isCooking = false;
                    }, 1500);
                }
            }
        });
    }

    // AIイノシシ徘徊
    beasts.forEach(beast => {
        if (beast.hp <= 0) return;

        if (beast.state === 'flee') {
            const angle = Math.atan2(beast.y - player.y, beast.x - player.x);
            beast.x += Math.cos(angle) * beast.speed * 2.5;
            beast.y += Math.sin(angle) * beast.speed * 2.5;
            beast.stateTimer -= 0.05;
            if (beast.stateTimer <= 0) beast.state = 'idle';
        } else {
            beast.x += beast.vx * beast.speed;
            beast.y += beast.vy * beast.speed;
            if (Math.random() < 0.02) {
                beast.vx = (Math.random() - 0.5) * 2;
                beast.vy = (Math.random() - 0.5) * 2;
            }
        }

        const dist = Math.hypot(beast.x - 200, beast.y - 200);
        if (dist > territoryRadius - beast.radius) {
            const angle = Math.atan2(beast.y - 200, beast.x - 200);
            beast.x = 200 + Math.cos(angle) * (territoryRadius - beast.radius);
            beast.y = 200 + Math.sin(angle) * (territoryRadius - beast.radius);
            beast.vx *= -1;
            beast.vy *= -1;
        }
    });

    // 木の復活
    trees.forEach(tree => {
        if (tree.hp <= 0 && Date.now() > tree.regenTime) {
            tree.hp = tree.maxHp;
            createParticle(tree.x, tree.y, "#228b22", 8);
        }
    });

    particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.alpha -= 0.03;
        p.life--;
    });
    particles = particles.filter(p => p.life > 0);

    floatingTexts.forEach(t => {
        t.y += t.vy;
        t.alpha -= 0.02;
        t.life--;
    });
    floatingTexts = floatingTexts.filter(t => t.life > 0);

    document.getElementById("ui-gold").innerText = player.gold;
    document.getElementById("ui-wood").innerText = `${player.wood}/${player.maxWood}`;
    document.getElementById("ui-meat").innerText = `${player.meat} (🍖${player.cookedMeat})/${player.maxMeat}`;

    render();
    requestAnimationFrame(update);
}

// --- レンダリング ---
function render() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const cameraX = canvas.width / 2 - player.x;
    const cameraY = canvas.height / 2 - player.y;

    ctx.save();
    ctx.translate(cameraX, cameraY);

    // 領地
    ctx.beginPath();
    ctx.arc(200, 200, territoryRadius, 0, Math.PI * 2);
    ctx.fillStyle = "#3e5c2e";
    ctx.fill();
    ctx.lineWidth = 6;
    ctx.strokeStyle = "#deb887";
    ctx.stroke();

    ctx.strokeStyle = "rgba(0,0,0,0.15)";
    ctx.lineWidth = 12;
    ctx.stroke();

    // ゾーン
    drawZone(woodSellZone, "#cd853f", "🪵売却");
    drawZone(meatSellZone, "#ff6347", "🍖売却");

    campfires.forEach(camp => {
        ctx.beginPath();
        ctx.arc(camp.x, camp.y, camp.radius, 0, Math.PI * 2);
        ctx.fillStyle = "rgba(255, 140, 0, 0.15)";
        ctx.fill();
        ctx.lineWidth = 2;
        ctx.strokeStyle = "#ff4500";
        ctx.stroke();

        ctx.fillStyle = camp.isCooking ? "#ff3300" : "#d35400";
        ctx.beginPath();
        ctx.arc(camp.x, camp.y, 10, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = "#ffcc00";
        ctx.beginPath();
        ctx.arc(camp.x, camp.y, 6, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.font = "bold 11px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText("🔥たき火", camp.x, camp.y + 24);
    });

    drawZone(expandZone, "#00ffcc", `👑領地拡大\n(${expandCost}🪙)`);

    // 木
    trees.forEach(tree => {
        if (tree.hp <= 0) {
            ctx.fillStyle = "#5c3d21";
            ctx.beginPath();
            ctx.arc(tree.x, tree.y, 8, 0, Math.PI * 2);
            ctx.fill();
            return;
        }

        ctx.fillStyle = "rgba(0,0,0,0.2)";
        ctx.beginPath();
        ctx.arc(tree.x, tree.y + 10, 15, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#1e4d2b";
        ctx.beginPath();
        ctx.arc(tree.x, tree.y - 10, tree.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#2e6f40";
        ctx.beginPath();
        ctx.arc(tree.x - 4, tree.y - 14, tree.radius - 4, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#8b5a2b";
        ctx.fillRect(tree.x - 4, tree.y, 8, 14);

        if (tree.hp < tree.maxHp) {
            drawHpBar(tree.x, tree.y - 30, tree.hp, tree.maxHp, 25);
        }
    });

    // 獣
    beasts.forEach(beast => {
        if (beast.hp <= 0) return;

        ctx.fillStyle = "rgba(0,0,0,0.15)";
        ctx.beginPath();
        ctx.arc(beast.x, beast.y + 6, beast.radius - 2, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#a0522d";
        ctx.beginPath();
        ctx.arc(beast.x, beast.y, beast.radius, 0, Math.PI * 2);
        ctx.fill();

        ctx.fillStyle = "#fff";
        ctx.fillRect(beast.x + 6, beast.y, 3, 4);

        ctx.fillStyle = "#000";
        ctx.beginPath();
        ctx.arc(beast.x + 4, beast.y - 4, 2, 0, Math.PI * 2);
        ctx.fill();

        drawHpBar(beast.x, beast.y - 20, beast.hp, beast.maxHp, 22);
    });

    // プレイヤー
    ctx.save();
    ctx.translate(player.x, player.y);
    
    ctx.fillStyle = "rgba(0,0,0,0.25)";
    ctx.beginPath();
    ctx.arc(0, 12, player.radius - 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#008080";
    ctx.beginPath();
    ctx.arc(0, 0, player.radius, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#ffdbac";
    ctx.beginPath();
    ctx.arc(0, -4, player.radius - 5, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "#333";
    ctx.beginPath();
    ctx.arc(0, -8, player.radius - 6, Math.PI, 0);
    ctx.fill();

    ctx.fillStyle = "#000";
    const eyeOffset = 3;
    ctx.beginPath();
    ctx.arc(eyeOffset, -5, 2, 0, Math.PI * 2);
    ctx.arc(eyeOffset + 6, -5, 2, 0, Math.PI * 2);
    ctx.fill();

    ctx.save();
    if (player.isMoving) {
        const swing = Math.sin(Date.now() * 0.015) * 0.5;
        ctx.rotate(swing);
    }
    ctx.fillStyle = "#8b5a2b";
    ctx.fillRect(10, -5, 4, 18);
    ctx.fillStyle = "#aaa";
    ctx.fillRect(12, -8, 8, 4);
    ctx.restore();

    ctx.restore();

    // パーティクル & テキスト
    particles.forEach(p => {
        ctx.save();
        ctx.globalAlpha = p.alpha;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.radius, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
    });

    floatingTexts.forEach(t => {
        ctx.save();
        ctx.globalAlpha = t.alpha;
        ctx.fillStyle = t.color;
        ctx.font = "bold 13px sans-serif";
        ctx.textAlign = "center";
        ctx.fillText(t.text, t.x, t.y);
        ctx.restore();
    });

    ctx.restore();
}

function drawZone(zone, color, label) {
    ctx.beginPath();
    ctx.arc(zone.x, zone.y, zone.radius, 0, Math.PI * 2);
    ctx.fillStyle = "rgba(255,255,255,0.06)";
    ctx.fill();
    ctx.lineWidth = 3;
    ctx.strokeStyle = color;
    ctx.stroke();

    ctx.fillStyle = "#fff";
    ctx.font = "bold 11px sans-serif";
    ctx.textAlign = "center";
    const lines = label.split('\n');
    if (lines.length > 1) {
        ctx.fillText(lines[0], zone.x, zone.y - 4);
        ctx.fillText(lines[1], zone.x, zone.y + 10);
    } else {
        ctx.fillText(label, zone.x, zone.y + 4);
    }
}

function drawHpBar(x, y, hp, maxHp, width) {
    const pct = Math.max(0, hp / maxHp);
    ctx.fillStyle = "rgba(0,0,0,0.5)";
    ctx.fillRect(x - width/2, y, width, 4);
    ctx.fillStyle = "#00ff00";
    ctx.fillRect(x - width/2, y, width * pct, 4);
}

requestAnimationFrame(update);
