// --- ゲームの初期設定 ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

// プレイヤーとゲームの変数
let player = { x: canvas.width/2, y: canvas.height/2 };
let trees = [];
let territoryRadius = 150; // 陣地の広さ

// 木を1本生成する関数
function spawnOneTree() {
    const angle = Math.random() * Math.PI * 2;
    const distance = Math.random() * territoryRadius;
    trees.push({
        x: (canvas.width / 2) + Math.cos(angle) * distance,
        y: (canvas.height / 2) + Math.sin(angle) * distance
    });
}

// 最初に木を5本生やす
for (let i = 0; i < 5; i++) spawnOneTree();

// --- ゲームループ ---
function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 1. 陣地（緑の円）を描画
    ctx.fillStyle = "#3e5c2e";
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, territoryRadius, 0, Math.PI * 2);
    ctx.fill();
    
    // 2. 木を描画＆伐採判定
    trees.forEach((t, index) => {
        // 木を描画
        ctx.fillStyle = "#1e4d2b";
        ctx.beginPath();
        ctx.arc(t.x, t.y, 15, 0, Math.PI * 2);
        ctx.fill();
        
        // プレイヤーと木の距離をチェック（触れたら消す）
        const dist = Math.hypot(t.x - player.x, t.y - player.y);
        if (dist < 30) {
            trees.splice(index, 1); // 木を配列から消す
            spawnOneTree();         // 別の場所に新しい木を生やす
        }
    });
    
    // 3. プレイヤーを描画（動かせるように簡易的に中央固定）
    ctx.fillStyle = "#008080";
    ctx.fillRect(player.x - 15, player.y - 15, 30, 30);
    
    // マウスでプレイヤーを動かす簡易操作
    window.onmousemove = (e) => {
        player.x = e.clientX;
        player.y = e.clientY;
    };
    
    requestAnimationFrame(loop);
}
loop();
