# LottoMax

Production-ready client implementation for a LottoMax instant group draw platform inspired by the Manus reference experience.

- Vue 3 + Pinia + Vite
- Wallet-based group entry
- 5/10/15/20-player live groups
- Entry fee and prize pool calculation
- Unique number-card selection
- 2-minute pick phase
- 30-second grace period
- Live draw simulation
- Instant wallet payout
- Transaction history
- Docker Compose deployment

## Development

```bash
npm install
npm run dev
```

## Docker

```bash
docker compose up --build -d
```

The app runs at `http://localhost:5180`.
