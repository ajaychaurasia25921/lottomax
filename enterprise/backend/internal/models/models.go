package models

import "time"

type DrawStatus string

const (
	DrawOpen    DrawStatus = "OPEN"
	DrawPaused  DrawStatus = "PAUSED"
	DrawFrozen  DrawStatus = "FROZEN"
	DrawSettled DrawStatus = "SETTLED"
	DrawVoid    DrawStatus = "VOID"
)

type LedgerDirection string

const (
	LedgerCredit LedgerDirection = "CREDIT"
	LedgerDebit  LedgerDirection = "DEBIT"
)

type BroadGroup struct {
	ID               string     `json:"id"`
	Name             string     `json:"name"`
	Status           DrawStatus `json:"status"`
	MaxPlayers       int        `json:"maxPlayers"`
	TicketPriceCents int64      `json:"ticketPriceCents"`
	Currency         string     `json:"currency"`
}

type Ticket struct {
	ID            string    `json:"id"`
	UserID        string    `json:"userId"`
	DrawID        string    `json:"drawId"`
	NumberSet     []int     `json:"numberSet"`
	PriceCents    int64     `json:"priceCents"`
	PurchasedAt   time.Time `json:"purchasedAt"`
	IdempotencyKey string    `json:"idempotencyKey"`
}

type Draw struct {
	ID              string     `json:"id"`
	BroadGroupID    string     `json:"broadGroupId"`
	Status          DrawStatus `json:"status"`
	TicketPriceCents int64     `json:"ticketPriceCents"`
	Currency        string     `json:"currency"`
	FrozenPoolCents int64      `json:"frozenPoolCents"`
	WinningTicketID string     `json:"winningTicketId"`
	ClosedAt        time.Time  `json:"closedAt"`
}

type Settlement struct {
	ID                 string    `json:"id"`
	DrawID             string    `json:"drawId"`
	WinnerUserID       string    `json:"winnerUserId"`
	WinnerTicketID     string    `json:"winnerTicketId"`
	CompanyAmountCents int64     `json:"companyAmountCents"`
	WinnerAmountCents  int64     `json:"winnerAmountCents"`
	Currency           string    `json:"currency"`
	Status             string    `json:"status"`
	SettledAt          time.Time `json:"settledAt"`
}

type LedgerEntry struct {
	ID             string          `json:"id"`
	WalletID       string          `json:"walletId"`
	SettlementID   string          `json:"settlementId"`
	Direction      LedgerDirection `json:"direction"`
	AmountCents    int64           `json:"amountCents"`
	Currency       string          `json:"currency"`
	Reason         string          `json:"reason"`
	IdempotencyKey string          `json:"idempotencyKey"`
	CreatedAt      time.Time       `json:"createdAt"`
}

type AdminActor struct {
	ID string `json:"id"`
	IP string `json:"ip"`
}
