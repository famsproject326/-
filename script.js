// --- 最小構成のゲームプログラム ---
const canvas = document.getElementById("gameCanvas");
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}
window.addEventListener("resize", resize);
resize();

let player = { x: 200, y: 200 };

function loop() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    
    // 背景（緑の島）
    ctx.fillStyle = "#3e5c2e";
    ctx.beginPath();
    ctx.arc(canvas.width/2, canvas.height/2, 100, 0, Math.PI * 2);
    ctx.fill();
    
    // プレイヤー（四角）
    ctx.fillStyle = "#008080";
    ctx.fillRect(canvas.width/2 - 15, canvas.height/2 - 15, 30, 30);
    
    requestAnimationFrame(loop);
}
loop();
