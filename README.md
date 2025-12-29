# KickStar League: Physics Soccer

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MFLStats/clashball-v0.4)

KickStar League is a fast-paced, physics-based 2D multiplayer soccer game inspired by Haxball, designed with a vibrant 'Kid Playful' aesthetic. Players control a single circular avatar on a stylized pitch, using simple inputs to outmaneuver opponents and score goals.

The core experience revolves around a high-skill ceiling physics engine where momentum, collision angles, and positioning are key. The application features a robust Ranked Mode with a detailed tier system (Bronze to Master) utilizing Glicko-2 rating logic.

## 🚀 Features

- **Physics-Based Gameplay**: A custom deterministic circle-collision physics system handling velocity, friction, restitution, and player-ball interaction.
- **High-Performance Arena**: HTML5 Canvas-based renderer optimized for 60fps gameplay with smooth interpolations and particle effects.
- **Ranked Progression**: Comprehensive tier system ranging from Bronze to Master, featuring visual milestones and animated progress bars.
- **Competitive Matchmaking**: Glicko-2 rating logic powered by Cloudflare Durable Objects for accurate skill assessment.
- **Playful UI/UX**: A "Kid Playful" design system featuring vibrant colors, rounded shapes, and delightful micro-interactions.
- **Cloud-Native Backend**: Built on Cloudflare Workers and Durable Objects for low-latency global state management.

## 🛠️ Technology Stack

**Frontend**
- **Framework**: React 18 + Vite
- **Language**: TypeScript
- **Styling**: Tailwind CSS, Shadcn UI, Lucide React
- **Animations**: Framer Motion, Canvas Confetti
- **State Management**: Zustand
- **Routing**: React Router DOM

**Backend**
- **Runtime**: Cloudflare Workers
- **Framework**: Hono
- **Persistence**: Cloudflare Durable Objects
- **Utilities**: Zod (Validation)

## 📦 Prerequisites

- **Node.js**: v18 or higher
- **Bun**: v1.0 or higher (Required package manager)
- **Cloudflare Account**: For deployment

## ⚡ Getting Started

1. **Clone the repository**
   ```bash
   git clone <repository-url>
   cd kickstar-league
   ```

2. **Install dependencies**
   ```bash
   bun install
   ```

3. **Start the development server**
   This will start the Vite frontend server.
   ```bash
   bun run dev
   ```

4. **Preview the build**
   To test the production build locally:
   ```bash
   bun run preview
   ```

## 🏗️ Project Structure

- `/src`: Frontend React application
  - `/components`: Reusable UI components (Shadcn UI)
  - `/pages`: Application views (Lobby, Game Arena, etc.)
  - `/hooks`: Custom React hooks
  - `/lib`: Utilities and helpers
- `/worker`: Cloudflare Worker backend code
  - `index.ts`: Worker entry point
  - `durableObject.ts`: State management logic
  - `userRoutes.ts`: API endpoints
- `/shared`: Types and constants shared between frontend and backend

## 🚀 Deployment

This project is configured for seamless deployment to Cloudflare Workers.

[![Deploy to Cloudflare](https://deploy.workers.cloudflare.com/button)](https://deploy.workers.cloudflare.com/?url=https://github.com/MFLStats/clashball-v0.4)

### Manual Deployment

To deploy manually using Wrangler:

1. **Login to Cloudflare**
   ```bash
   npx wrangler login
   ```

2. **Deploy**
   ```bash
   bun run deploy
   ```

This command builds the frontend assets and deploys the Worker with the Durable Object configuration.

## 🤝 Contributing

1. Fork the repository
2. Create your feature branch (`git checkout -b feature/amazing-feature`)
3. Commit your changes (`git commit -m 'Add some amazing feature'`)
4. Push to the branch (`git push origin feature/amazing-feature`)
5. Open a Pull Request

## 📄 License

This project is licensed under the MIT License - see the LICENSE file for details.