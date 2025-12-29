import { Field, GameState, Player, Ball } from '@shared/physics';
import { PhysicsEngine } from '@shared/physics';
export interface ActiveEmote {
    id: string;
    userId: string;
    emoji: string;
    startTime: number;
}
// Team Color Definitions for Gradients
const TEAM_COLORS = {
    red: { base: '#e56e56', light: '#ff9e86', dark: '#c0392b' },
    blue: { base: '#5689e5', light: '#86b9ff', dark: '#2980b9' }
};
export function drawField(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // --- 1. Draw Field (Checkerboard Pattern) ---
    const tileSize = 100;
    const cols = Math.ceil(width / tileSize);
    const rows = Math.ceil(height / tileSize);
    for (let row = 0; row < rows; row++) {
        for (let col = 0; col < cols; col++) {
            // Checkerboard logic
            const isDark = (row + col) % 2 === 1;
            ctx.fillStyle = isDark ? '#6c8655' : '#718c5a';
            ctx.fillRect(col * tileSize, row * tileSize, tileSize, tileSize);
        }
    }
    // --- 1.5 Vignette Effect (Stronger for depth) ---
    const gradient = ctx.createRadialGradient(width / 2, height / 2, height / 3, width / 2, height / 2, width * 0.9);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(0.7, 'rgba(0,0,0,0.1)');
    gradient.addColorStop(1, 'rgba(0,0,0,0.4)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}
export function drawLines(ctx: CanvasRenderingContext2D, width: number, height: number, scaleX: number) {
    // --- 2. Draw Lines (White with Glow) ---
    ctx.shadowColor = 'rgba(255, 255, 255, 0.3)';
    ctx.shadowBlur = 10;
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.9)';
    ctx.lineWidth = 3;
    ctx.lineCap = 'round';
    // Border
    ctx.strokeRect(5, 5, width - 10, height - 10);
    // Center Line
    ctx.beginPath();
    ctx.moveTo(width / 2, 5);
    ctx.lineTo(width / 2, height - 5);
    ctx.stroke();
    // Center Circle
    ctx.beginPath();
    ctx.arc(width / 2, height / 2, 70 * scaleX, 0, Math.PI * 2);
    ctx.stroke();
    // Reset Shadow
    ctx.shadowBlur = 0;
}
export function drawGoalNet(ctx: CanvasRenderingContext2D, field: Field, scaleX: number, scaleY: number) {
    const goalH = field.goalHeight * scaleY;
    const goalTop = (ctx.canvas.height - goalH) / 2;
    const goalBottom = goalTop + goalH;
    const depth = 40 * scaleX; // Net depth
    const drawNet = (isLeft: boolean) => {
        const xFront = isLeft ? 0 : ctx.canvas.width;
        const xBack = isLeft ? -depth : ctx.canvas.width + depth;
        // Draw Net Shape (Trapezoid)
        ctx.beginPath();
        ctx.moveTo(xFront, goalTop);
        ctx.lineTo(xBack, goalTop + 10); // Slight taper
        ctx.lineTo(xBack, goalBottom - 10);
        ctx.lineTo(xFront, goalBottom);
        ctx.closePath();
        ctx.fillStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.4)';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Draw Grid Pattern
        ctx.beginPath();
        // Horizontal lines
        for (let i = 1; i < 5; i++) {
            const y = goalTop + (goalH * i) / 5;
            ctx.moveTo(xFront, y);
            ctx.lineTo(xBack, y);
        }
        // Vertical lines
        for (let i = 1; i < 4; i++) {
            const x = isLeft ? -depth * i / 4 : ctx.canvas.width + depth * i / 4;
            ctx.moveTo(x, goalTop);
            ctx.lineTo(x, goalBottom);
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.lineWidth = 1;
        ctx.stroke();
    };
    drawNet(true); // Left Goal
    drawNet(false); // Right Goal
}
export function drawGoalPosts(ctx: CanvasRenderingContext2D, field: Field, scaleX: number, scaleY: number) {
    const width = ctx.canvas.width;
    const height = ctx.canvas.height;
    const goalH = field.goalHeight * scaleY;
    const goalTop = (height - goalH) / 2;
    // Goal Posts (Simple Black Lines)
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 4;
    // Left Goal
    ctx.beginPath();
    ctx.moveTo(5, goalTop);
    ctx.lineTo(0, goalTop);
    ctx.lineTo(0, goalTop + goalH);
    ctx.lineTo(5, goalTop + goalH);
    ctx.stroke();
    // Right Goal
    ctx.beginPath();
    ctx.moveTo(width - 5, goalTop);
    ctx.lineTo(width, goalTop);
    ctx.lineTo(width, goalTop + goalH);
    ctx.lineTo(width - 5, goalTop + goalH);
    ctx.stroke();
    // --- 3b. Draw Goal Posts & Line ---
    if (field.goalPosts && field.goalPosts.length === 4) {
        // Goal Line (White)
        ctx.beginPath();
        ctx.moveTo(0, field.goalPosts[0].pos.y * scaleY);
        ctx.lineTo(0, field.goalPosts[1].pos.y * scaleY);
        ctx.moveTo(width, field.goalPosts[2].pos.y * scaleY);
        ctx.lineTo(width, field.goalPosts[3].pos.y * scaleY);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Posts (Circles with Gradient)
        field.goalPosts.forEach(post => {
            const px = post.pos.x * scaleX;
            const py = post.pos.y * scaleY;
            const pr = post.radius * scaleX;
            const gradient = ctx.createRadialGradient(px - pr * 0.3, py - pr * 0.3, pr * 0.1, px, py, pr);
            gradient.addColorStop(0, '#f1f5f9'); // Slate-100
            gradient.addColorStop(1, '#94a3b8'); // Slate-400
            ctx.beginPath();
            ctx.arc(px, py, pr, 0, Math.PI * 2);
            ctx.fillStyle = gradient;
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 2;
            ctx.stroke();
        });
    }
}
export function drawPlayers(
    ctx: CanvasRenderingContext2D,
    players: Player[],
    currentUserId: string | undefined,
    showNames: boolean,
    scaleX: number,
    scaleY: number,
    isLocalGame: boolean
) {
    players.forEach((p, index) => {
        const x = p.pos.x * scaleX;
        const y = p.pos.y * scaleY;
        const r = p.radius * scaleX;
        // Kick Range Ring (Visual Hint)
        const kickRange = (p.radius + PhysicsEngine.BALL_RADIUS + PhysicsEngine.KICK_TOLERANCE) * scaleX;
        ctx.beginPath();
        ctx.arc(x, y, kickRange, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.15)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 4]);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
        // Kick Indicator (White Ring on Player)
        if (p.isKicking) {
            ctx.beginPath();
            ctx.arc(x, y, r + 4, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 3;
            ctx.stroke();
        }
        // Body (3D Gradient)
        const colors = p.team === 'red' ? TEAM_COLORS.red : TEAM_COLORS.blue;
        const gradient = ctx.createRadialGradient(x - r * 0.3, y - r * 0.3, r * 0.1, x, y, r);
        gradient.addColorStop(0, colors.light);
        gradient.addColorStop(0.5, colors.base);
        gradient.addColorStop(1, colors.dark);
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = gradient;
        ctx.fill();
        // Stroke (Black Border)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 2;
        ctx.stroke();
        // Jersey Number (Custom or First 2 chars of username)
        const jerseyText = p.jersey || p.username.substring(0, 2).toUpperCase();
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.9)';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 2;
        ctx.fillText(jerseyText, x, y);
        ctx.shadowBlur = 0;
        // Username (Conditional)
        if (showNames) {
            ctx.font = 'bold 14px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom'; // Changed to bottom to sit above player
            ctx.fillStyle = '#ffffff';
            ctx.shadowColor = 'rgba(0,0,0,0.8)';
            ctx.shadowBlur = 4;
            ctx.fillText(p.username, x, y - r - 8);
            ctx.shadowBlur = 0; // Reset shadow
        }
        // "YOU" Indicator
        const isLocalPlayer = isLocalGame && index === 0;
        if ((currentUserId && p.id === currentUserId) || isLocalPlayer) {
            ctx.beginPath();
            ctx.moveTo(x, y - r - 25);
            ctx.lineTo(x - 5, y - r - 35);
            ctx.lineTo(x + 5, y - r - 35);
            ctx.closePath();
            ctx.fillStyle = '#fbbf24'; // Amber-400
            ctx.fill();
            ctx.strokeStyle = '#000000';
            ctx.lineWidth = 1;
            ctx.stroke();
        }
    });
}
export function drawBall(ctx: CanvasRenderingContext2D, ball: Ball, scaleX: number, scaleY: number) {
    const bx = ball.pos.x * scaleX;
    const by = ball.pos.y * scaleY;
    const br = ball.radius * scaleX;
    // Shadow (Contact Shadow)
    ctx.beginPath();
    ctx.ellipse(bx, by + br * 0.2, br, br * 0.6, 0, 0, Math.PI * 2);
    ctx.fillStyle = 'rgba(0, 0, 0, 0.3)';
    ctx.fill();
    // Ball Body (White with Shading)
    const gradient = ctx.createRadialGradient(bx - br * 0.3, by - br * 0.3, br * 0.1, bx, by, br);
    gradient.addColorStop(0, '#ffffff');
    gradient.addColorStop(1, '#cbd5e1'); // Slate-300
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = gradient;
    ctx.fill();
    // Stroke
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2;
    ctx.stroke();
}
export function drawOverlays(
    ctx: CanvasRenderingContext2D,
    state: GameState,
    width: number,
    height: number,
    scaleX: number,
    scaleY: number,
    activeEmotes: ActiveEmote[],
    currentUserId: string | undefined,
    isOnline: boolean
) {
    // --- 6. Overtime Overlay ---
    if (state.isOvertime && state.status !== 'goal') {
        ctx.save();
        ctx.font = 'bold 48px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.shadowColor = 'rgba(0,0,0,0.8)';
        ctx.shadowBlur = 10;
        // Pulse effect
        const scale = 1 + Math.sin(Date.now() / 200) * 0.05;
        ctx.translate(width / 2, height / 4);
        ctx.scale(scale, scale);
        ctx.fillStyle = '#fbbf24'; // Gold
        ctx.fillText('GOLDEN GOAL', 0, 0);
        ctx.strokeStyle = '#ffffff';
        ctx.lineWidth = 2;
        ctx.strokeText('GOLDEN GOAL', 0, 0);
        ctx.restore();
    }
    // --- 7. Goal Celebration Overlay ---
    if (state.status === 'goal') {
        ctx.save();
        ctx.translate(width / 2, height / 2);
        // Pulse/Scale animation
        const scale = 1 + Math.sin(Date.now() / 150) * 0.1;
        ctx.scale(scale, scale);
        ctx.font = '900 120px sans-serif'; // Heavy font
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        // Text Stroke
        ctx.lineWidth = 8;
        ctx.strokeStyle = '#ffffff';
        ctx.strokeText('GOAL!', 0, 0);
        // Text Fill (Gold Gradient)
        const gradient = ctx.createLinearGradient(0, -60, 0, 60);
        gradient.addColorStop(0, '#fbbf24'); // Amber 400
        gradient.addColorStop(1, '#d97706'); // Amber 600
        ctx.fillStyle = gradient;
        ctx.fillText('GOAL!', 0, 0);
        ctx.restore();
    }
    // --- 8. Spectator Overlay ---
    // Check if we are in online mode (externalState exists) and user is NOT playing
    const isSpectating = isOnline && currentUserId && !state.players.some(p => p.id === currentUserId);
    if (isSpectating) {
        ctx.save();
        ctx.font = 'bold 24px sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'top';
        ctx.fillStyle = 'rgba(255, 255, 255, 0.8)';
        ctx.shadowColor = 'rgba(0,0,0,0.5)';
        ctx.shadowBlur = 4;
        ctx.fillText('SPECTATING', width / 2, 20);
        ctx.restore();
    }
    // --- 9. Draw Emotes ---
    const now = Date.now();
    activeEmotes.forEach(emote => {
        const player = state.players.find(p => p.id === emote.userId);
        if (player) {
            const px = player.pos.x * scaleX;
            const py = player.pos.y * scaleY;
            const elapsed = now - emote.startTime;
            const progress = elapsed / 2000;
            // Float up animation
            const offsetY = 40 + (progress * 50);
            const opacity = 1 - Math.pow(progress, 3); // Fade out near end
            ctx.save();
            ctx.font = '40px sans-serif';
            ctx.textAlign = 'center';
            ctx.textBaseline = 'bottom';
            ctx.globalAlpha = opacity;
            ctx.shadowColor = 'rgba(0,0,0,0.5)';
            ctx.shadowBlur = 4;
            ctx.fillText(emote.emoji, px, py - offsetY);
            ctx.restore();
        }
    });
}