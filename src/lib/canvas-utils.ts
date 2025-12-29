import { Field, GameState, Player, Ball } from '@shared/physics';
import { PhysicsEngine } from '@shared/physics';
export interface ActiveEmote {
    id: string;
    userId: string;
    emoji: string;
    startTime: number;
}
export function drawField(ctx: CanvasRenderingContext2D, width: number, height: number) {
    // --- 1. Draw Field (Striped Turf) ---
    const stripeCount = 7;
    const stripeWidth = width / stripeCount;
    for (let i = 0; i < stripeCount; i++) {
        ctx.fillStyle = i % 2 === 0 ? '#718c5a' : '#6c8655';
        ctx.fillRect(i * stripeWidth, 0, stripeWidth, height);
    }
    // --- 1.5 Vignette Effect ---
    const gradient = ctx.createRadialGradient(width / 2, height / 2, height / 3, width / 2, height / 2, width * 0.8);
    gradient.addColorStop(0, 'transparent');
    gradient.addColorStop(1, 'rgba(0,0,0,0.3)');
    ctx.fillStyle = gradient;
    ctx.fillRect(0, 0, width, height);
}
export function drawLines(ctx: CanvasRenderingContext2D, width: number, height: number, scaleX: number) {
    // --- 2. Draw Lines (White) ---
    ctx.strokeStyle = '#ffffff';
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
        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        ctx.fill();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
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
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
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
        // Posts (Circles)
        field.goalPosts.forEach(post => {
            ctx.beginPath();
            ctx.arc(post.pos.x * scaleX, post.pos.y * scaleY, post.radius * scaleX, 0, Math.PI * 2);
            ctx.fillStyle = '#e2e8f0'; // Slate-200
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
        // Classic Haxball Colors
        const color = p.team === 'red' ? '#e56e56' : '#5689e5';
        // Kick Range Ring (New Feature)
        // We need ball radius to calculate kick range accurately, but for visual we can approximate or pass ball radius if needed.
        // Assuming standard ball radius for visual hint if not passed, but let's use a constant or pass it.
        // Ideally we pass ball radius, but PhysicsEngine.BALL_RADIUS is available.
        const kickRange = (p.radius + PhysicsEngine.BALL_RADIUS + PhysicsEngine.KICK_TOLERANCE) * scaleX;
        ctx.beginPath();
        ctx.arc(x, y, kickRange, 0, Math.PI * 2);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.3)';
        ctx.lineWidth = 2;
        ctx.setLineDash([5, 5]);
        ctx.stroke();
        ctx.setLineDash([]); // Reset dash
        // Kick Indicator (White Ring on Player)
        if (p.isKicking) {
            ctx.beginPath();
            ctx.arc(x, y, r + 6, 0, Math.PI * 2);
            ctx.strokeStyle = '#ffffff';
            ctx.lineWidth = 4;
            ctx.stroke();
        }
        // Body
        ctx.beginPath();
        ctx.arc(x, y, r, 0, Math.PI * 2);
        ctx.fillStyle = color;
        ctx.fill();
        // Stroke (Black Border)
        ctx.strokeStyle = '#000000';
        ctx.lineWidth = 3;
        ctx.stroke();
        // Jersey Number (Custom or First 2 chars of username)
        const jerseyText = p.jersey || p.username.substring(0, 2).toUpperCase();
        ctx.font = 'bold 16px monospace';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillStyle = '#ffffff';
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
            ctx.fillText(p.username, x, y - r - 10);
            ctx.shadowBlur = 0; // Reset shadow
        }
        // "YOU" Indicator
        // If online: match ID.
        // If local: match index 0 (Red 0).
        const isLocalPlayer = isLocalGame && index === 0;
        if ((currentUserId && p.id === currentUserId) || isLocalPlayer) {
            ctx.beginPath();
            ctx.moveTo(x, y - r - 30);
            ctx.lineTo(x - 6, y - r - 40);
            ctx.lineTo(x + 6, y - r - 40);
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
    // Explicitly reset shadow properties to prevent blur bleed from text
    ctx.shadowColor = 'transparent';
    ctx.shadowBlur = 0;
    ctx.shadowOffsetX = 0;
    ctx.shadowOffsetY = 0;
    const bx = ball.pos.x * scaleX;
    const by = ball.pos.y * scaleY;
    const br = ball.radius * scaleX;
    ctx.beginPath();
    ctx.arc(bx, by, br, 0, Math.PI * 2);
    ctx.fillStyle = '#ffffff';
    ctx.fill();
    ctx.strokeStyle = '#000000';
    ctx.lineWidth = 2.5;
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