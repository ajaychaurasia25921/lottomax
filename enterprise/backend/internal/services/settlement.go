package services

import (
	"context"
	"fmt"
	"sort"
	"time"

	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/ledger"
	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/models"
	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/money"
	"github.com/ajaychaurasia25921/lottomax/enterprise/backend/internal/rng"
)

type SettlementService struct {
	RNG           rng.Service
	Ledger        ledger.Writer
	CompanyWallet string
	Clock         func() time.Time
}

type SettleDrawCommand struct {
	Draw         models.Draw
	Tickets      []models.Ticket
	WinnerWallet string
	Nonce        string
}

func (s SettlementService) SettleDraw(ctx context.Context, cmd SettleDrawCommand) (models.Settlement, error) {
	if cmd.Draw.Status != models.DrawOpen && cmd.Draw.Status != models.DrawFrozen {
		return models.Settlement{}, fmt.Errorf("draw %s is not settleable from status %s", cmd.Draw.ID, cmd.Draw.Status)
	}
	if len(cmd.Tickets) == 0 {
		return models.Settlement{}, fmt.Errorf("draw %s has no tickets", cmd.Draw.ID)
	}
	if cmd.Draw.TicketPriceCents <= 0 {
		return models.Settlement{}, fmt.Errorf("ticket price must be positive")
	}
	if s.RNG == nil || s.Ledger == nil {
		return models.Settlement{}, fmt.Errorf("rng and ledger dependencies are required")
	}
	now := time.Now().UTC()
	if s.Clock != nil {
		now = s.Clock().UTC()
	}

	tickets := append([]models.Ticket(nil), cmd.Tickets...)
	sort.Slice(tickets, func(i, j int) bool { return tickets[i].ID < tickets[j].ID })
	ids := make([]string, len(tickets))
	for i, ticket := range tickets {
		ids[i] = ticket.ID
	}

	random, err := s.RNG.Int63(ctx, rng.Request{DrawID: cmd.Draw.ID, TicketIDs: ids, Nonce: cmd.Nonce})
	if err != nil {
		return models.Settlement{}, err
	}
	winnerTicket := tickets[int(random%int64(len(tickets)))]
	poolCents := int64(len(tickets)) * cmd.Draw.TicketPriceCents
	companyCents, winnerCents, err := money.SplitPlatformWinner(poolCents)
	if err != nil {
		return models.Settlement{}, err
	}

	settlement := models.Settlement{
		ID:                 "set_" + cmd.Draw.ID,
		DrawID:             cmd.Draw.ID,
		WinnerUserID:       winnerTicket.UserID,
		WinnerTicketID:     winnerTicket.ID,
		CompanyAmountCents: companyCents,
		WinnerAmountCents:  winnerCents,
		Currency:           cmd.Draw.Currency,
		Status:             "POSTED",
		SettledAt:          now,
	}

	entries := []models.LedgerEntry{
		{
			ID:             settlement.ID + "_company",
			WalletID:       s.CompanyWallet,
			SettlementID:   settlement.ID,
			Direction:      models.LedgerCredit,
			AmountCents:    companyCents,
			Currency:       cmd.Draw.Currency,
			Reason:         "COMPANY_SETTLEMENT_15_PERCENT",
			IdempotencyKey: cmd.Draw.ID + ":company",
			CreatedAt:      now,
		},
		{
			ID:             settlement.ID + "_winner",
			WalletID:       cmd.WinnerWallet,
			SettlementID:   settlement.ID,
			Direction:      models.LedgerCredit,
			AmountCents:    winnerCents,
			Currency:       cmd.Draw.Currency,
			Reason:         "WINNER_SETTLEMENT_85_PERCENT",
			IdempotencyKey: cmd.Draw.ID + ":winner",
			CreatedAt:      now,
		},
	}
	for _, entry := range entries {
		if err := s.Ledger.Append(ctx, entry); err != nil {
			return models.Settlement{}, err
		}
	}
	return settlement, nil
}
